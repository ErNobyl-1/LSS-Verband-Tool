import puppeteer, { Browser, Page } from 'puppeteer';
import { upsertIncidents, deleteStaleIncidents } from './incidents.js';
import { saveAllianceStats } from './alliance-stats.js';
import { upsertMembers, filterExcludedMembers } from './alliance-members.js';
import { broadcastDeleted } from './sse.js';

// Mission list configuration - same as Tampermonkey script
const MISSION_LISTS = [
  // NOTFÄLLE (emergency)
  { containerId: 'mission_list', source: 'own', category: 'emergency', requiresShared: true, description: 'Eigene Einsätze' },
  { containerId: 'mission_list_krankentransporte', source: 'own', category: 'emergency', requiresShared: true, description: 'Eigene Krankentransporte' },
  { containerId: 'mission_list_alliance', source: 'alliance', category: 'emergency', requiresShared: false, description: 'Verbands-Einsätze' },
  { containerId: 'mission_list_krankentransporte_alliance', source: 'alliance', category: 'emergency', requiresShared: false, description: 'Verbands-Krankentransporte' },
  // GEPLANTE EINSÄTZE (planned)
  { containerId: 'mission_list_sicherheitswache', source: 'own', category: 'planned', requiresShared: true, description: 'Eigene Sicherheitswachen' },
  { containerId: 'mission_list_sicherheitswache_alliance', source: 'alliance', category: 'planned', requiresShared: false, description: 'Verbands-Sicherheitswachen' },
  // GROSSSCHADENSLAGEN (event)
  { containerId: 'mission_list_alliance_event', source: 'alliance_event', category: 'event', requiresShared: false, description: 'Großschadenslagen' },
] as const;

interface MissionData {
  ls_id: string;
  title: string;
  type: string | null;
  status: string;
  source: 'own' | 'own_shared' | 'alliance' | 'alliance_event' | 'unknown';
  category: 'emergency' | 'planned' | 'event';
  lat: number | null;
  lon: number | null;
  address: string | null;
  raw_json: Record<string, unknown>;
}

interface ScraperStats {
  emergency: { own: number; alliance: number };
  planned: { own: number; alliance: number };
  event: { count: number };
  total: number;
  skipped: number;
}

class LssScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private allianceStatsIntervalId: NodeJS.Timeout | null = null;
  private memberTrackingIntervalId: NodeJS.Timeout | null = null;
  private loginAttempts = 0;
  private maxLoginAttempts = 3;

  private config = {
    email: process.env.LSS_EMAIL || '',
    password: process.env.LSS_PASSWORD || '',
    scrapeInterval: parseInt(process.env.LSS_SCRAPE_INTERVAL_MS || '10000', 10),
    allianceStatsInterval: parseInt(process.env.LSS_ALLIANCE_STATS_INTERVAL_MS || '300000', 10), // 5 minutes default
    memberTrackingInterval: parseInt(process.env.LSS_MEMBER_TRACKING_INTERVAL_MS || '60000', 10), // 1 minute default
    headless: process.env.LSS_HEADLESS !== 'false',
    baseUrl: 'https://www.leitstellenspiel.de',
  };

  async start(): Promise<void> {
    if (!this.config.email || !this.config.password) {
      console.error('[LSS-Scraper] Missing LSS_EMAIL or LSS_PASSWORD in environment');
      return;
    }

    console.log('[LSS-Scraper] Starting...');
    console.log(`[LSS-Scraper] Scrape interval: ${this.config.scrapeInterval}ms`);
    console.log(`[LSS-Scraper] Alliance stats interval: ${this.config.allianceStatsInterval}ms`);
    console.log(`[LSS-Scraper] Member tracking interval: ${this.config.memberTrackingInterval}ms`);
    console.log(`[LSS-Scraper] Headless mode: ${this.config.headless}`);

    try {
      await this.initBrowser();
      await this.ensureLoggedIn();

      // Fetch alliance stats and members immediately after login (before starting loops)
      console.log('[LSS-Scraper] Fetching initial data after login...');
      await Promise.all([
        this.fetchAllianceStats(),
        this.fetchAndTrackMembers(),
      ]);
      console.log('[LSS-Scraper] Initial data fetched successfully');

      this.startScrapeLoop();
      this.startAllianceStatsLoop();
      this.startMemberTrackingLoop();
    } catch (error) {
      console.error('[LSS-Scraper] Failed to start:', error);
      await this.cleanup();
    }
  }

  async stop(): Promise<void> {
    console.log('[LSS-Scraper] Stopping...');
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.allianceStatsIntervalId) {
      clearInterval(this.allianceStatsIntervalId);
      this.allianceStatsIntervalId = null;
    }
    if (this.memberTrackingIntervalId) {
      clearInterval(this.memberTrackingIntervalId);
      this.memberTrackingIntervalId = null;
    }
    await this.cleanup();
  }

  private async initBrowser(): Promise<void> {
    console.log('[LSS-Scraper] Launching browser...');

    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    if (executablePath) {
      console.log(`[LSS-Scraper] Using Chromium at: ${executablePath}`);
    }

    this.browser = await puppeteer.launch({
      headless: this.config.headless,
      executablePath: executablePath || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
      ],
    });

    this.page = await this.browser.newPage();

    await this.page.setViewport({ width: 1920, height: 1080 });
    await this.page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Block unnecessary resources to speed up loading
    await this.page.setRequestInterception(true);
    this.page.on('request', (request) => {
      const resourceType = request.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });

    console.log('[LSS-Scraper] Browser launched');
  }

  private async ensureLoggedIn(): Promise<boolean> {
    if (!this.page) return false;

    // Navigate to main page
    console.log('[LSS-Scraper] Navigating to LSS...');
    await this.page.goto(this.config.baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Check if we're already logged in by looking for mission_list
    const missionList = await this.page.$('#mission_list');
    if (missionList) {
      console.log('[LSS-Scraper] Already logged in');
      this.loginAttempts = 0;
      return true;
    }

    // Not logged in, need to login
    return await this.performLogin();
  }

  private async performLogin(): Promise<boolean> {
    if (!this.page) return false;

    if (this.loginAttempts >= this.maxLoginAttempts) {
      console.error('[LSS-Scraper] Max login attempts reached');
      return false;
    }

    this.loginAttempts++;
    console.log(`[LSS-Scraper] Login attempt ${this.loginAttempts}/${this.maxLoginAttempts}`);

    try {
      // Navigate to login page
      await this.page.goto(`${this.config.baseUrl}/users/sign_in`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait for form to be visible
      await this.page.waitForSelector('#user_email', { timeout: 10000 });

      // Fill in credentials
      await this.page.type('#user_email', this.config.email, { delay: 50 });
      await this.page.type('#user_password', this.config.password, { delay: 50 });

      // Check "remember me" checkbox
      const rememberMe = await this.page.$('#user_remember_me');
      if (rememberMe) {
        await rememberMe.click();
      }

      // Submit form
      await Promise.all([
        this.page.click('input[type="submit"]'),
        this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      ]);

      // Check if login was successful
      const missionList = await this.page.$('#mission_list');
      if (missionList) {
        console.log('[LSS-Scraper] Login successful');
        this.loginAttempts = 0;
        return true;
      }

      // Check for error message
      const errorMessage = await this.page.$('.alert-danger');
      if (errorMessage) {
        const text = await this.page.evaluate(el => el?.textContent || '', errorMessage);
        console.error('[LSS-Scraper] Login failed:', text.trim());
      } else {
        console.error('[LSS-Scraper] Login failed - unknown reason');
      }

      return false;
    } catch (error) {
      console.error('[LSS-Scraper] Login error:', error);
      return false;
    }
  }

  private startScrapeLoop(): void {
    console.log('[LSS-Scraper] Starting scrape loop');

    // Initial scrape
    this.scrape();

    // Set up interval
    this.intervalId = setInterval(() => {
      this.scrape();
    }, this.config.scrapeInterval);
  }

  private startAllianceStatsLoop(): void {
    console.log('[LSS-Scraper] Starting alliance stats loop');

    // Set up interval (default: every 5 minutes)
    // Initial fetch already done in start()
    this.allianceStatsIntervalId = setInterval(() => {
      this.fetchAllianceStats();
    }, this.config.allianceStatsInterval);
  }

  private async fetchAllianceStats(): Promise<void> {
    if (!this.page) return;

    try {
      // Use the existing session to fetch the API endpoint
      const response = await this.page.evaluate(async () => {
        const res = await fetch('/api/allianceinfo');
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return await res.json();
      });

      if (response && typeof response.id === 'number') {
        await saveAllianceStats(response);
      } else {
        console.error('[LSS-Scraper] Invalid alliance info response:', response);
      }
    } catch (error) {
      console.error('[LSS-Scraper] Failed to fetch alliance stats:', error);
    }
  }

  private startMemberTrackingLoop(): void {
    console.log('[LSS-Scraper] Starting member tracking loop');

    // Set up interval (default: every 1 minute)
    // Initial fetch already done in start()
    this.memberTrackingIntervalId = setInterval(() => {
      this.fetchAndTrackMembers();
    }, this.config.memberTrackingInterval);
  }

  private async fetchAndTrackMembers(): Promise<void> {
    if (!this.page) return;

    try {
      // Use the existing session to fetch the API endpoint
      const response = await this.page.evaluate(async () => {
        const res = await fetch('/api/allianceinfo');
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return await res.json();
      });

      if (response && typeof response.id === 'number' && Array.isArray(response.users)) {
        const result = await upsertMembers(response.id, response.users);

        // Filter for logging (to show accurate counts)
        const filteredMembers = filterExcludedMembers(response.users as Array<{ id: number; name: string; online: boolean }>);
        const onlineCount = filteredMembers.filter((m) => m.online).length;

        console.log(
          `[LSS-Scraper] Members: ${filteredMembers.length} total, ${onlineCount} online ` +
          `(${result.created} new, ${result.updated} updated, ${result.activityChanges} status changes)`
        );
      }
    } catch (error) {
      console.error('[LSS-Scraper] Failed to track members:', error);
    }
  }

  private async scrape(): Promise<void> {
    if (this.isRunning || !this.page) return;

    this.isRunning = true;

    try {
      // Check if still logged in
      const missionList = await this.page.$('#mission_list');
      if (!missionList) {
        console.log('[LSS-Scraper] Session expired, re-logging in...');
        const loggedIn = await this.ensureLoggedIn();
        if (!loggedIn) {
          console.error('[LSS-Scraper] Could not re-login, stopping scraper');
          await this.stop();
          return;
        }
      }

      // Extract missions
      const { missions, stats } = await this.extractMissions();

      // Get list of active mission IDs from the DOM
      const activeLsIds = missions.map(m => m.ls_id);

      // Delete incidents that are no longer in the DOM (completed missions)
      const deletedIncidents = await deleteStaleIncidents(activeLsIds);
      if (deletedIncidents.length > 0) {
        broadcastDeleted(deletedIncidents);
        console.log(`[LSS-Scraper] Deleted ${deletedIncidents.length} completed missions`);
      }

      if (missions.length > 0) {
        // Save to database (SSE broadcast happens inside upsertIncidents)
        const result = await upsertIncidents(missions);
        console.log(
          `[LSS-Scraper] Synced ${missions.length} missions (${result.created} new, ${result.updated} updated)`
        );
      }

      // Log stats
      console.log(
        `[LSS-Scraper] Stats: Notfälle(E:${stats.emergency.own}/V:${stats.emergency.alliance}) ` +
        `Geplant(E:${stats.planned.own}/V:${stats.planned.alliance}) GSL:${stats.event.count} | ` +
        `Total:${stats.total} Skipped:${stats.skipped}`
      );
    } catch (error) {
      console.error('[LSS-Scraper] Scrape error:', error);

      // Try to recover by reloading page
      try {
        await this.page?.reload({ waitUntil: 'networkidle2' });
      } catch {
        // Ignore reload errors
      }
    } finally {
      this.isRunning = false;
    }
  }

  private async extractMissions(): Promise<{ missions: MissionData[]; stats: ScraperStats }> {
    if (!this.page) return { missions: [], stats: this.emptyStats() };

    // Pass MISSION_LISTS as serializable data
    const missionListsData = MISSION_LISTS.map(l => ({
      containerId: l.containerId,
      source: l.source,
      category: l.category,
      requiresShared: l.requiresShared,
    }));

    // Extract data from page using evaluate with a string function to avoid tsx transformation issues
    const result = await this.page.evaluate((missionLists: Array<{containerId: string; source: string; category: string; requiresShared: boolean}>) => {
      const missions: Array<{
        ls_id: string;
        title: string;
        type: string | null;
        status: string;
        source: string;
        category: string;
        lat: number | null;
        lon: number | null;
        address: string | null;
        raw_json: Record<string, unknown>;
      }> = [];

      const stats = {
        emergency: { own: 0, alliance: 0 },
        planned: { own: 0, alliance: 0 },
        event: { count: 0 },
        total: 0,
        skipped: 0,
      };

      for (const listConfig of missionLists) {
        const container = document.getElementById(listConfig.containerId);
        if (!container) continue;

        const missionElements = container.querySelectorAll('.missionSideBarEntry');

        for (const el of missionElements) {
          const missionId = el.getAttribute('mission_id');
          if (!missionId) continue;

          // Check if shared
          const panelEl = document.getElementById('mission_panel_' + missionId);
          const isShared = panelEl?.classList.contains('panel-success') || false;

          // Skip non-shared missions from own lists
          if (listConfig.requiresShared && !isShared) {
            stats.skipped++;
            continue;
          }

          // Get coordinates
          const lat = parseFloat(el.getAttribute('latitude') || '') || null;
          const lon = parseFloat(el.getAttribute('longitude') || '') || null;
          const missionTypeId = el.getAttribute('mission_type_id') || null;

          // Get title and address
          const captionEl = document.getElementById('mission_caption_' + missionId);
          let title = 'Unbekannter Einsatz';
          let address: string | null = null;

          if (captionEl) {
            const clone = captionEl.cloneNode(true) as HTMLElement;
            const addressEl = clone.querySelector('#mission_address_' + missionId);
            if (addressEl) {
              address = addressEl.textContent?.trim() || null;
              addressEl.remove();
            }
            const oldCaptionEl = clone.querySelector('#mission_old_caption_' + missionId);
            if (oldCaptionEl) {
              oldCaptionEl.remove();
            }
            title = clone.textContent?.trim().replace(/,\s*$/, '').trim() || title;
          }

          if (!address) {
            const addrEl = document.getElementById('mission_address_' + missionId);
            address = addrEl?.textContent?.trim() || null;
          }

          // Get status from panel color
          let status = 'active';
          let panelColor = 'unknown';

          if (panelEl) {
            const classes = panelEl.className;
            if (classes.includes('mission_panel_green')) {
              status = 'green';
              panelColor = 'green';
            } else if (classes.includes('mission_panel_yellow')) {
              status = 'yellow';
              panelColor = 'yellow';
            } else if (classes.includes('mission_panel_red')) {
              status = 'red';
              panelColor = 'red';
            }
          }

          // Get additional info
          const missingEl = document.getElementById('mission_missing_' + missionId);
          const missingText = missingEl?.textContent?.trim() || null;

          const patientsEl = document.getElementById('mission_patients_' + missionId);
          const patientCount = patientsEl ? patientsEl.querySelectorAll('[id^="patient_"]').length : 0;

          const countdownEl = document.getElementById('mission_overview_countdown_' + missionId);
          const timeleft = countdownEl?.getAttribute('timeleft') || null;

          // Determine effective source
          let effectiveSource = listConfig.source;
          if (listConfig.source === 'own' && isShared) {
            effectiveSource = 'own_shared';
          }

          missions.push({
            ls_id: missionId,
            title,
            type: missionTypeId,
            status,
            source: effectiveSource,
            category: listConfig.category,
            lat,
            lon,
            address,
            raw_json: {
              mission_id: missionId,
              mission_type_id: missionTypeId,
              panel_color: panelColor,
              is_shared: isShared,
              category: listConfig.category,
              list_id: listConfig.containerId,
              missing_text: missingText,
              patient_count: patientCount,
              timeleft,
              extracted_at: new Date().toISOString(),
            },
          });

          stats.total++;

          // Update category stats
          if (listConfig.category === 'emergency') {
            if (effectiveSource === 'own_shared') stats.emergency.own++;
            else if (effectiveSource === 'alliance') stats.emergency.alliance++;
          } else if (listConfig.category === 'planned') {
            if (effectiveSource === 'own_shared') stats.planned.own++;
            else if (effectiveSource === 'alliance') stats.planned.alliance++;
          } else if (listConfig.category === 'event') {
            stats.event.count++;
          }
        }
      }

      return { missions, stats };
    }, missionListsData);

    return result as { missions: MissionData[]; stats: ScraperStats };
  }

  private emptyStats(): ScraperStats {
    return {
      emergency: { own: 0, alliance: 0 },
      planned: { own: 0, alliance: 0 },
      event: { count: 0 },
      total: 0,
      skipped: 0,
    };
  }

  private async cleanup(): Promise<void> {
    if (this.page) {
      await this.page.close().catch(() => {});
      this.page = null;
    }
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
    console.log('[LSS-Scraper] Cleaned up');
  }
}

// Singleton instance
export const lssScraper = new LssScraper();
