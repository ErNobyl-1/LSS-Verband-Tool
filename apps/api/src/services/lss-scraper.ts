import puppeteer, { Browser, Page } from 'puppeteer';
import * as cheerio from 'cheerio';
import { upsertIncidents, deleteStaleIncidents, updateMissionDetails } from './incidents.js';
import { saveAllianceStats, getLatestAllianceStatsWithChanges } from './alliance-stats.js';
import { upsertMembers, filterExcludedMembers, getAllMembers, getMemberCounts } from './alliance-members.js';
import { broadcastDeleted, broadcastAllianceStats, broadcastMembers } from './sse.js';
import { scraperLogger as logger } from '../lib/logger.js';
import { emailService } from '../lib/email.js';

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
  private isDetailsFetching = false;
  private intervalId: NodeJS.Timeout | null = null;
  private detailsIntervalId: NodeJS.Timeout | null = null;
  private allianceStatsIntervalId: NodeJS.Timeout | null = null;
  private memberTrackingIntervalId: NodeJS.Timeout | null = null;
  private loginAttempts = 0;
  private maxLoginAttempts = 3;
  private startedAt: Date | null = null;
  private lastScrapeAt: Date | null = null;
  private lastDetailsFetchAt: Date | null = null;
  private scrapeCount = 0;
  private detailsFetchCount = 0;
  private sessionCookie: string | null = null;
  private pendingDetailFetches: string[] = [];

  private config = {
    email: process.env.LSS_EMAIL || '',
    password: process.env.LSS_PASSWORD || '',
    // New config: separate intervals for list and details
    missionListInterval: parseInt(process.env.LSS_MISSION_LIST_INTERVAL_MS || '1000', 10),
    missionDetailsInterval: parseInt(process.env.LSS_MISSION_DETAILS_INTERVAL_MS || '15000', 10),
    httpDetailsEnabled: process.env.LSS_HTTP_DETAILS_ENABLED !== 'false',
    httpDetailsParallel: parseInt(process.env.LSS_HTTP_DETAILS_PARALLEL || '5', 10),
    httpDetailsBatchDelay: parseInt(process.env.LSS_HTTP_DETAILS_BATCH_DELAY_MS || '500', 10),
    allianceStatsInterval: parseInt(process.env.LSS_ALLIANCE_STATS_INTERVAL_MS || '300000', 10), // 5 minutes default
    memberTrackingInterval: parseInt(process.env.LSS_MEMBER_TRACKING_INTERVAL_MS || '60000', 10), // 1 minute default
    headless: process.env.LSS_HEADLESS !== 'false',
    baseUrl: 'https://www.leitstellenspiel.de',
  };

  async start(): Promise<void> {
    if (!this.config.email || !this.config.password) {
      logger.error('Missing LSS_EMAIL or LSS_PASSWORD in environment');
      return;
    }

    logger.info('Starting scraper...');
    logger.info({
      missionListInterval: this.config.missionListInterval,
      missionDetailsInterval: this.config.missionDetailsInterval,
      httpDetailsEnabled: this.config.httpDetailsEnabled,
      httpDetailsParallel: this.config.httpDetailsParallel,
      allianceStatsInterval: this.config.allianceStatsInterval,
      memberTrackingInterval: this.config.memberTrackingInterval,
      headless: this.config.headless,
    }, 'Scraper configuration');

    try {
      await this.initBrowser();
      await this.ensureLoggedIn();

      // Extract and store session cookie after login
      this.sessionCookie = await this.extractSessionCookie();
      logger.info('Session cookie extracted');

      // Fetch alliance stats and members immediately after login (before starting loops)
      logger.info('Fetching initial data after login...');
      await Promise.all([
        this.fetchAllianceStats(),
        this.fetchAndTrackMembers(),
      ]);
      logger.info('Initial data fetched successfully');

      // Start separate loops for mission list and details
      this.startMissionListLoop();
      this.startMissionDetailsLoop();
      this.startAllianceStatsLoop();
      this.startMemberTrackingLoop();
      this.startedAt = new Date();
    } catch (error) {
      logger.error({ err: error }, 'Failed to start');
      await emailService.notifyCriticalError(error as Error, {
        component: 'LSS Scraper',
        action: 'start',
        loginAttempts: this.loginAttempts,
      });
      await this.cleanup();
    }
  }

  async stop(): Promise<void> {
    logger.info('Stopping scraper...');
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.detailsIntervalId) {
      clearInterval(this.detailsIntervalId);
      this.detailsIntervalId = null;
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

  getStatus(): {
    running: boolean;
    startedAt: Date | null;
    lastScrapeAt: Date | null;
    scrapeCount: number;
    browserConnected: boolean;
  } {
    return {
      running: this.intervalId !== null,
      startedAt: this.startedAt,
      lastScrapeAt: this.lastScrapeAt,
      scrapeCount: this.scrapeCount,
      browserConnected: this.browser !== null && this.browser.connected,
    };
  }

  private async initBrowser(): Promise<void> {
    logger.info('Launching browser...');

    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    if (executablePath) {
      logger.info({ executablePath }, 'Using custom Chromium path');
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

    logger.info('Browser launched');
  }

  private async ensureLoggedIn(): Promise<boolean> {
    if (!this.page) return false;

    // Navigate to main page
    logger.info('Navigating to LSS...');
    await this.page.goto(this.config.baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Check if we're already logged in by looking for mission_list
    const missionList = await this.page.$('#mission_list');
    if (missionList) {
      logger.info('Already logged in');
      this.loginAttempts = 0;
      return true;
    }

    // Not logged in, need to login
    return await this.performLogin();
  }

  private async performLogin(): Promise<boolean> {
    if (!this.page) return false;

    if (this.loginAttempts >= this.maxLoginAttempts) {
      const errorMsg = 'Max login attempts reached';
      logger.error(errorMsg);
      await emailService.notifyCriticalError(
        new Error(errorMsg),
        {
          component: 'LSS Scraper',
          action: 'login',
          loginAttempts: this.loginAttempts,
          maxAttempts: this.maxLoginAttempts,
        }
      );
      return false;
    }

    this.loginAttempts++;
    logger.info({ attempt: this.loginAttempts, maxAttempts: this.maxLoginAttempts }, 'Login attempt');

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
        logger.info('Login successful');
        this.loginAttempts = 0;
        return true;
      }

      // Check for error message
      const errorMessage = await this.page.$('.alert-danger');
      if (errorMessage) {
        const text = await this.page.evaluate(el => el?.textContent || '', errorMessage);
        logger.error({ reason: text.trim() }, 'Login failed');
        // Send warning email on login failure
        if (this.loginAttempts >= 2) {
          await emailService.notifyWarning('LSS Login failed', {
            attempt: this.loginAttempts,
            maxAttempts: this.maxLoginAttempts,
            reason: text.trim(),
          });
        }
      } else {
        logger.error('Login failed - unknown reason');
        if (this.loginAttempts >= 2) {
          await emailService.notifyWarning('LSS Login failed - unknown reason', {
            attempt: this.loginAttempts,
            maxAttempts: this.maxLoginAttempts,
          });
        }
      }

      return false;
    } catch (error) {
      logger.error({ err: error }, 'Login error');
      if (this.loginAttempts >= 2) {
        await emailService.notifyWarning('LSS Login error', {
          error: (error as Error).message,
          attempt: this.loginAttempts,
          maxAttempts: this.maxLoginAttempts,
        });
      }
      return false;
    }
  }

  // Session Cookie Management
  private async extractSessionCookie(): Promise<string | null> {
    if (!this.page) return null;

    try {
      const cookies = await this.page.cookies(this.config.baseUrl);
      const sessionCookie = cookies.find(c => c.name === '_session_id');

      if (sessionCookie) {
        // Return full cookie header for this domain
        return cookies.map(c => `${c.name}=${c.value}`).join('; ');
      }

      logger.warn('Session cookie not found');
      return null;
    } catch (error) {
      logger.error({ err: error }, 'Failed to extract session cookie');
      return null;
    }
  }

  private async validateSessionCookie(): Promise<boolean> {
    if (!this.sessionCookie) return false;

    try {
      // Use a lightweight endpoint to test session validity
      const response = await fetch(`${this.config.baseUrl}/api/allianceinfo`, {
        headers: {
          'Cookie': this.sessionCookie,
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        redirect: 'manual', // Don't follow redirects automatically
      });

      // If we get 200, session is valid
      // If we get 302/401, session is invalid (redirect to login)
      return response.status === 200;
    } catch (error) {
      logger.error({ err: error }, 'Failed to validate session cookie');
      return false;
    }
  }

  private async ensureValidSession(): Promise<void> {
    const isValid = await this.validateSessionCookie();

    if (!isValid) {
      logger.warn('Session invalid, re-logging in via Puppeteer...');
      await this.ensureLoggedIn();
      this.sessionCookie = await this.extractSessionCookie();

      if (this.sessionCookie) {
        logger.info('Session cookie updated after re-login');
      } else {
        logger.error('Failed to extract session cookie after re-login');
      }
    }
  }

  private startMissionListLoop(): void {
    logger.info('Starting mission list loop');

    // Initial scrape
    this.scrapeMissionList();

    // Set up interval
    this.intervalId = setInterval(() => {
      this.scrapeMissionList();
    }, this.config.missionListInterval);
  }

  private startMissionDetailsLoop(): void {
    logger.info('Starting mission details loop');

    // Set up interval (first run will happen after the interval time)
    this.detailsIntervalId = setInterval(() => {
      this.fetchPendingMissionDetails();
    }, this.config.missionDetailsInterval);
  }

  // Old method - deprecated but kept for reference
  // Use startMissionListLoop() and startMissionDetailsLoop() instead
  private startScrapeLoop(): void {
    logger.warn('startScrapeLoop is deprecated, use startMissionListLoop and startMissionDetailsLoop instead');
  }

  private startAllianceStatsLoop(): void {
    logger.info('Starting alliance stats loop');

    // Set up interval (default: every 5 minutes)
    // Initial fetch already done in start()
    this.allianceStatsIntervalId = setInterval(() => {
      this.fetchAllianceStats();
    }, this.config.allianceStatsInterval);
  }

  private async fetchAllianceStats(): Promise<void> {
    if (!this.browser || !this.page) return;

    try {
      // Use direct HTTP request with session cookies (not browser-based fetch)
      // This avoids "Execution context was destroyed" errors during navigation
      const cookies = await this.page.cookies(this.config.baseUrl);
      const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

      const res = await fetch(`${this.config.baseUrl}/api/allianceinfo`, {
        headers: {
          'Cookie': cookieHeader,
          'Accept': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const response = await res.json();

      if (response && typeof response.id === 'number') {
        await saveAllianceStats(response);

        // Broadcast updated stats via SSE
        const statsWithChanges = await getLatestAllianceStatsWithChanges();
        if (statsWithChanges) {
          broadcastAllianceStats(statsWithChanges);
        }
      } else {
        logger.error({ response }, 'Invalid alliance info response');
      }
    } catch (error) {
      logger.error({ err: error }, 'Failed to fetch alliance stats');
    }
  }

  private startMemberTrackingLoop(): void {
    logger.info('Starting member tracking loop');

    // Set up interval (default: every 1 minute)
    // Initial fetch already done in start()
    this.memberTrackingIntervalId = setInterval(() => {
      this.fetchAndTrackMembers();
    }, this.config.memberTrackingInterval);
  }

  private async fetchAndTrackMembers(): Promise<void> {
    if (!this.browser) return;

    try {
      // Get cookies from page - filtered by LSS domain
      if (!this.page) return;
      const cookies = await this.page.cookies(this.config.baseUrl);
      const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

      // Make direct HTTP request with session cookies
      const res = await fetch(`${this.config.baseUrl}/api/allianceinfo`, {
        headers: {
          'Cookie': cookieHeader,
          'Accept': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const response = await res.json();

      if (response && typeof response.id === 'number' && Array.isArray(response.users)) {
        const result = await upsertMembers(response.id, response.users);

        // Filter for logging (to show accurate counts)
        const filteredMembers = filterExcludedMembers(response.users as Array<{ id: number; name: string; online: boolean }>);
        const onlineCount = filteredMembers.filter((m) => m.online).length;

        logger.info({
          total: filteredMembers.length,
          online: onlineCount,
          created: result.created,
          updated: result.updated,
          statusChanges: result.activityChanges,
        }, 'Members synced');

        // Broadcast updated members via SSE
        const allMembers = await getAllMembers(response.id);
        const counts = await getMemberCounts(response.id);
        broadcastMembers({ members: allMembers, counts });
      }
    } catch (error) {
      logger.error({ err: error }, 'Failed to track members');
    }
  }

  // New method: Only scrape mission list (fast, DOM-based)
  private async scrapeMissionList(): Promise<void> {
    // Don't scrape mission list if details are being fetched, or if already running
    if (this.isRunning || this.isDetailsFetching || !this.page) return;

    this.isRunning = true;

    try {
      // Check if still logged in
      const missionList = await this.page.$('#mission_list');
      if (!missionList) {
        logger.warn('Session expired, re-logging in...');
        const loggedIn = await this.ensureLoggedIn();
        if (!loggedIn) {
          logger.error('Could not re-login, stopping scraper');
          await this.stop();
          return;
        }
        // Update session cookie after re-login
        this.sessionCookie = await this.extractSessionCookie();
      }

      // Extract missions (only basic data from DOM)
      const { missions, stats } = await this.extractMissions();

      // Get list of active mission IDs from the DOM
      const activeLsIds = missions.map(m => m.ls_id);

      // Delete incidents that are no longer in the DOM (completed missions)
      const deletedIncidents = await deleteStaleIncidents(activeLsIds);
      if (deletedIncidents.length > 0) {
        broadcastDeleted(deletedIncidents);
        logger.info({ count: deletedIncidents.length }, 'Deleted completed missions');
      }

      if (missions.length > 0) {
        // Save to database (SSE broadcast happens inside upsertIncidents)
        const result = await upsertIncidents(missions);
        logger.debug({
          total: missions.length,
          created: result.created,
          updated: result.updated,
        }, 'Mission list synced');
      }

      // Collect mission IDs that need details (planned + emergency only)
      const missionsNeedingDetails = missions.filter(m => m.category === 'planned' || m.category === 'emergency');
      this.pendingDetailFetches = missionsNeedingDetails.map(m => m.ls_id);

      // Log stats
      logger.debug({
        emergency: stats.emergency,
        planned: stats.planned,
        event: stats.event.count,
        total: stats.total,
        skipped: stats.skipped,
        pendingDetails: this.pendingDetailFetches.length,
      }, 'Mission list stats');

      // Update scrape stats
      this.lastScrapeAt = new Date();
      this.scrapeCount++;
    } catch (error) {
      logger.error({ err: error }, 'Mission list scrape error');

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

  // Old scrape method (kept for backward compatibility / fallback)
  private async scrape(): Promise<void> {
    if (this.isRunning || !this.page) return;

    this.isRunning = true;

    try {
      // Check if still logged in
      const missionList = await this.page.$('#mission_list');
      if (!missionList) {
        logger.warn('Session expired, re-logging in...');
        const loggedIn = await this.ensureLoggedIn();
        if (!loggedIn) {
          logger.error('Could not re-login, stopping scraper');
          await this.stop();
          return;
        }
      }

      // Extract missions
      const { missions, stats } = await this.extractMissions();

      // Fetch details for planned + emergency missions (sequentially to avoid server overload)
      // The isRunning flag prevents overlapping scrape cycles if this takes longer than the interval
      const missionsNeedingDetails = missions.filter(m => m.category === 'planned' || m.category === 'emergency');
      if (missionsNeedingDetails.length > 0) {
        await this.fetchMissionDetails(missionsNeedingDetails);
      }

      // Get list of active mission IDs from the DOM
      const activeLsIds = missions.map(m => m.ls_id);

      // Delete incidents that are no longer in the DOM (completed missions)
      const deletedIncidents = await deleteStaleIncidents(activeLsIds);
      if (deletedIncidents.length > 0) {
        broadcastDeleted(deletedIncidents);
        logger.info({ count: deletedIncidents.length }, 'Deleted completed missions');
      }

      if (missions.length > 0) {
        // Save to database (SSE broadcast happens inside upsertIncidents)
        const result = await upsertIncidents(missions);
        logger.info({
          total: missions.length,
          created: result.created,
          updated: result.updated,
        }, 'Missions synced');
      }

      // Log stats
      logger.debug({
        emergency: stats.emergency,
        planned: stats.planned,
        event: stats.event.count,
        total: stats.total,
        skipped: stats.skipped,
      }, 'Scrape stats');

      // Update scrape stats
      this.lastScrapeAt = new Date();
      this.scrapeCount++;
    } catch (error) {
      logger.error({ err: error }, 'Scrape error');

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

  // Fetch mission details to get exact remaining time and participating players
  // Processes missions sequentially (queue-style) to avoid overwhelming the server
  private async fetchMissionDetails(missions: MissionData[]): Promise<void> {
    if (!this.page || missions.length === 0) return;

    logger.debug({ count: missions.length }, 'Fetching mission details...');

    // Process missions sequentially to avoid issues with page navigation
    let detailsCount = 0;
    let withTimeCount = 0;

    for (const mission of missions) {
      try {
        // Navigate to mission detail page
        const url = `${this.config.baseUrl}/missions/${mission.ls_id}`;
        const response = await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });

        // 304 is fine (not modified), any 2xx or 304 is OK
        const status = response?.status();
        if (!response || (status !== 304 && (status === undefined || status < 200 || status >= 400))) {
          logger.warn({ missionId: mission.ls_id, status }, 'Failed to load mission details');
          continue;
        }

        // Extract data from the page
        // Note: Using a single function string to avoid TypeScript transpilation issues
        const details = await this.page.evaluate(`
          (function() {
            var missionId = "${mission.ls_id}";
            var remainingSeconds = null;

            var countdownEl = document.getElementById('mission_countdown_' + missionId);
            if (countdownEl) {
              var timeText = countdownEl.textContent ? countdownEl.textContent.trim() : '';
              if (timeText) {
                var parts = timeText.split(':').map(function(p) { return parseInt(p, 10); });
                if (parts.length === 3 && parts.every(function(p) { return !isNaN(p); })) {
                  remainingSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
                } else if (parts.length === 2 && parts.every(function(p) { return !isNaN(p); })) {
                  remainingSeconds = parts[0] * 60 + parts[1];
                }
              }
            }

            // Extract mission duration from detail page (e.g., "Dauer: 2 Stunden" or "Dauer: 1 Stunde 30 Minuten")
            var durationSeconds = null;
            var bodyText = document.body.innerText || '';
            var durationMatch = bodyText.match(/Dauer:\\s*(?:(\\d+)\\s*Stunden?)?\\s*(?:(\\d+)\\s*Minuten?)?/i);
            if (durationMatch) {
              var hours = parseInt(durationMatch[1], 10) || 0;
              var minutes = parseInt(durationMatch[2], 10) || 0;
              if (hours > 0 || minutes > 0) {
                durationSeconds = hours * 3600 + minutes * 60;
              }
            }

            // Extract players from vehicle table
            function getPlayers(tableId) {
              var table = document.getElementById(tableId);
              if (!table) return [];
              var playerLinks = table.querySelectorAll('a[href^="/profile/"]');
              var players = [];
              var seen = {};
              playerLinks.forEach(function(link) {
                var name = link.textContent ? link.textContent.trim() : '';
                if (name && !seen[name]) {
                  seen[name] = true;
                  players.push(name);
                }
              });
              return players;
            }

            // Extract exact earnings for planned missions
            // Simple pattern: find "Verdienst" followed by numbers
            var exactEarnings = null;
            var earningsMatch = bodyText.match(/Verdienst.*?([\\d.]+)/i);
            if (earningsMatch) {
              // Remove dots (thousands separator) and parse as integer
              var earningsStr = earningsMatch[1].replace(/\\./g, '');
              var parsed = parseInt(earningsStr, 10);
              // Only accept reasonable numbers (> 100)
              if (!isNaN(parsed) && parsed > 100) {
                exactEarnings = parsed;
              }
            }

            return {
              remaining_seconds: remainingSeconds,
              remaining_at: new Date().toISOString(),
              duration_seconds: durationSeconds,
              players_driving: getPlayers('mission_vehicle_driving'),
              players_at_mission: getPlayers('mission_vehicle_at_mission'),
              exact_earnings: exactEarnings,
            };
          })()
        `) as { remaining_seconds: number | null; remaining_at: string; duration_seconds: number | null; players_driving: string[]; players_at_mission: string[]; exact_earnings: number | null };

        // Merge into raw_json
        mission.raw_json.remaining_seconds = details.remaining_seconds;
        mission.raw_json.remaining_at = details.remaining_at;
        mission.raw_json.duration_seconds = details.duration_seconds;
        mission.raw_json.players_driving = details.players_driving;
        mission.raw_json.players_at_mission = details.players_at_mission;
        mission.raw_json.exact_earnings = details.exact_earnings;

        detailsCount++;
        if (details.remaining_seconds !== null) withTimeCount++;

      } catch (error) {
        logger.error({ err: error, missionId: mission.ls_id }, 'Error fetching mission details');
      }
    }

    // Navigate back to main page
    try {
      await this.page.goto(this.config.baseUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
    } catch {
      // Ignore navigation errors
    }

    if (detailsCount > 0) {
      logger.debug({ fetched: detailsCount, total: missions.length, withCountdown: withTimeCount }, 'Mission details fetched');
    }
  }

  // New method: Fetch pending mission details via browser
  private async fetchPendingMissionDetails(): Promise<void> {
    // Don't fetch details if mission list is being scraped, or if already fetching, or if no details to fetch
    if (this.isRunning || this.isDetailsFetching || this.pendingDetailFetches.length === 0 || !this.page) return;

    this.isDetailsFetching = true;

    try {
      const missionIds = [...this.pendingDetailFetches]; // Copy array
      logger.debug({ count: missionIds.length }, 'Fetching mission details via browser');

      // Use browser-based method
      await this.fetchMissionDetailsBrowser(missionIds);

      this.lastDetailsFetchAt = new Date();
      this.detailsFetchCount++;
    } catch (error) {
      logger.error({ err: error }, 'Error fetching pending mission details');
    } finally {
      this.isDetailsFetching = false;
    }
  }

  // Browser-based mission details fetcher (optimized to not block)
  private async fetchMissionDetailsBrowser(missionIds: string[]): Promise<void> {
    if (!this.page || missionIds.length === 0) return;

    logger.debug({ count: missionIds.length }, 'Fetching mission details via browser...');

    // Process missions sequentially to avoid issues with page navigation
    let detailsCount = 0;
    let withTimeCount = 0;

    for (const missionId of missionIds) {
      try {
        // Navigate to mission detail page
        const url = `${this.config.baseUrl}/missions/${missionId}`;
        const response = await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });

        // 304 is fine (not modified), any 2xx or 304 is OK
        const status = response?.status();
        if (!response || (status !== 304 && (status === undefined || status < 200 || status >= 400))) {
          logger.warn({ missionId, status }, 'Failed to load mission details');
          continue;
        }

        // Listen to console messages from the page
        const consoleMessages: string[] = [];
        const consoleHandler = (msg: { text: () => string }) => {
          const text = msg.text();
          consoleMessages.push(text);
        };
        this.page.on('console', consoleHandler);

        // Extract data from the page
        // Note: Using a single function string to avoid TypeScript transpilation issues
        const details = await this.page.evaluate(`
          (function() {
            var missionId = "${missionId}";
            var remainingSeconds = null;

            var countdownEl = document.getElementById('mission_countdown_' + missionId);
            if (countdownEl) {
              var timeText = countdownEl.textContent ? countdownEl.textContent.trim() : '';
              if (timeText) {
                var parts = timeText.split(':').map(function(p) { return parseInt(p, 10); });
                if (parts.length === 3 && parts.every(function(p) { return !isNaN(p); })) {
                  remainingSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
                } else if (parts.length === 2 && parts.every(function(p) { return !isNaN(p); })) {
                  remainingSeconds = parts[0] * 60 + parts[1];
                }
              }
            }

            // Extract mission duration from detail page (e.g., "Dauer: 2 Stunden" or "Dauer: 1 Stunde 30 Minuten")
            var durationSeconds = null;
            var bodyText = document.body.innerText || '';
            var durationMatch = bodyText.match(/Dauer:\\s*(?:(\\d+)\\s*Stunden?)?\\s*(?:(\\d+)\\s*Minuten?)?/i);
            if (durationMatch) {
              var hours = parseInt(durationMatch[1], 10) || 0;
              var minutes = parseInt(durationMatch[2], 10) || 0;
              if (hours > 0 || minutes > 0) {
                durationSeconds = hours * 3600 + minutes * 60;
              }
            }

            // Extract players from vehicle table
            function getPlayers(tableId) {
              var table = document.getElementById(tableId);
              if (!table) {
                // Debug: Log which table IDs are found
                var allIds = Array.from(document.querySelectorAll('[id]')).map(function(el) { return el.id; }).filter(function(id) { return id.includes('mission') || id.includes('vehicle'); });
                console.log('Table ' + tableId + ' not found. Available IDs:', allIds);
                return [];
              }
              var playerLinks = table.querySelectorAll('a[href^="/profile/"]');
              var players = [];
              var seen = {};
              playerLinks.forEach(function(link) {
                var name = link.textContent ? link.textContent.trim() : '';
                if (name && !seen[name]) {
                  seen[name] = true;
                  players.push(name);
                }
              });
              console.log('Table ' + tableId + ' found, extracted ' + players.length + ' players:', players);
              return players;
            }

            // Extract earnings text for planned missions (parse it later in Node.js)
            var earningsRawText = null;
            try {
              var colLeft = document.getElementById('col_left');
              if (colLeft) {
                var colLeftText = colLeft.textContent || colLeft.innerText || '';
                var verdienstIndex = colLeftText.indexOf('Verdienst');
                if (verdienstIndex >= 0) {
                  var creditsIndex = colLeftText.indexOf('Credits', verdienstIndex);
                  if (creditsIndex >= 0) {
                    // Extract everything from "Verdienst" to "Credits" (inclusive)
                    earningsRawText = colLeftText.substring(verdienstIndex, creditsIndex + 7); // +7 for "Credits"
                  }
                }
              }
            } catch (e) {
              // Silent catch
            }

            return {
              remaining_seconds: remainingSeconds,
              remaining_at: new Date().toISOString(),
              duration_seconds: durationSeconds,
              players_driving: getPlayers('mission_vehicle_driving'),
              players_at_mission: getPlayers('mission_vehicle_at_mission'),
              earnings_raw_text: earningsRawText,
            };
          })()
        `) as { remaining_seconds: number | null; remaining_at: string; duration_seconds: number | null; players_driving: string[]; players_at_mission: string[]; earnings_raw_text: string | null };

        // Remove console handler
        this.page.off('console', consoleHandler);

        // Parse exact earnings from raw text (in Node.js context where we have full control)
        let exactEarnings: number | null = null;
        if (details.earnings_raw_text) {
          // Extract number from text like "Verdienst: 14.500 Credits"
          // German number format uses dots as thousands separator
          const match = details.earnings_raw_text.match(/(\d[\d.]*\d|\d)/);
          if (match) {
            // Remove dots (thousands separator) and parse as integer
            const numberStr = match[0].replace(/\./g, '');
            exactEarnings = parseInt(numberStr, 10);
          }
        }

        // Prepare details for database update
        const detailsForDb = {
          remaining_seconds: details.remaining_seconds,
          remaining_at: details.remaining_at,
          duration_seconds: details.duration_seconds,
          players_driving: details.players_driving,
          players_at_mission: details.players_at_mission,
          exact_earnings: exactEarnings,
        };

        // Log extracted details for debugging
        logger.debug({
          missionId,
          playersDriving: details.players_driving,
          playersAtMission: details.players_at_mission,
          remainingSeconds: details.remaining_seconds,
          exactEarnings,
          consoleMessages: consoleMessages.slice(0, 10), // Log first 10 console messages
        }, 'Extracted mission details');

        // Log what we're passing to updateMissionDetails
        logger.debug({
          missionId,
          detailsKeys: Object.keys(detailsForDb),
          detailsJson: JSON.stringify(detailsForDb),
        }, 'Calling updateMissionDetails with');

        // Update in database directly
        await updateMissionDetails(missionId, detailsForDb);

        detailsCount++;
        if (details.remaining_seconds !== null) withTimeCount++;

      } catch (error) {
        logger.error({ err: error, missionId }, 'Error fetching mission details');
      }
    }

    // Navigate back to main page
    try {
      await this.page.goto(this.config.baseUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
    } catch {
      // Ignore navigation errors
    }

    if (detailsCount > 0) {
      logger.debug({ fetched: detailsCount, total: missionIds.length, withCountdown: withTimeCount }, 'Mission details fetched');
    }
  }

  // HTTP-based mission details fetcher
  private async fetchMissionDetailsHTTP(missionIds: string[]): Promise<void> {
    if (missionIds.length === 0) return;

    // Ensure session is valid before making requests
    await this.ensureValidSession();

    if (!this.sessionCookie) {
      logger.error('No valid session cookie, cannot fetch details');
      return;
    }

    // Split into chunks for parallel processing
    const chunks = this.chunkArray(missionIds, this.config.httpDetailsParallel);
    let successCount = 0;
    let errorCount = 0;

    for (const chunk of chunks) {
      // Process chunk in parallel
      const results = await Promise.allSettled(
        chunk.map(missionId => this.fetchSingleMissionDetailHTTP(missionId))
      );

      // Count successes and errors
      for (const result of results) {
        if (result.status === 'fulfilled') {
          successCount++;
        } else {
          errorCount++;
        }
      }

      // Delay between batches to avoid overwhelming the server
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, this.config.httpDetailsBatchDelay));
      }
    }

    logger.info({
      total: missionIds.length,
      success: successCount,
      errors: errorCount,
    }, 'Mission details fetched via HTTP');
  }

  // Fetch a single mission detail via HTTP
  private async fetchSingleMissionDetailHTTP(missionId: string): Promise<void> {
    try {
      const url = `${this.config.baseUrl}/missions/${missionId}`;
      const response = await fetch(url, {
        headers: {
          'Cookie': this.sessionCookie!,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        },
      });

      // Check for redirect to login (session expired)
      if (response.status === 401 || response.url.includes('/users/sign_in')) {
        logger.warn({ missionId }, 'Session expired during detail fetch, will re-login');
        await this.ensureValidSession();
        throw new Error('Session expired');
      }

      // Check for 404 (mission no longer exists)
      if (response.status === 404) {
        logger.debug({ missionId }, 'Mission not found (404), likely completed');
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const details = this.parseDetailsFromHTML(html, missionId);

      // Update in database
      await updateMissionDetails(missionId, details);

    } catch (error) {
      logger.error({ err: error, missionId }, 'Failed to fetch mission detail via HTTP');
      throw error;
    }
  }

  // Parse mission details from HTML using cheerio
  private parseDetailsFromHTML(html: string, missionId: string): Record<string, unknown> {
    const $ = cheerio.load(html);

    // Extract remaining seconds from countdown
    let remainingSeconds: number | null = null;
    const countdownEl = $(`#mission_countdown_${missionId}`);
    if (countdownEl.length > 0) {
      const timeText = countdownEl.text().trim();
      if (timeText) {
        const parts = timeText.split(':').map(p => parseInt(p, 10));
        if (parts.length === 3 && parts.every(p => !isNaN(p))) {
          // HH:MM:SS
          remainingSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
        } else if (parts.length === 2 && parts.every(p => !isNaN(p))) {
          // MM:SS
          remainingSeconds = parts[0] * 60 + parts[1];
        }
      }
    }

    // Extract mission duration from detail page (e.g., "Dauer: 2 Stunden" or "Dauer: 1 Stunde 30 Minuten")
    let durationSeconds: number | null = null;
    const bodyText = $('body').text();
    const durationMatch = bodyText.match(/Dauer:\s*(?:(\d+)\s*Stunden?)?\s*(?:(\d+)\s*Minuten?)?/i);
    if (durationMatch) {
      const hours = parseInt(durationMatch[1], 10) || 0;
      const minutes = parseInt(durationMatch[2], 10) || 0;
      if (hours > 0 || minutes > 0) {
        durationSeconds = hours * 3600 + minutes * 60;
      }
    }

    // Extract players from vehicle tables
    const getPlayers = (tableId: string): string[] => {
      const table = $(`#${tableId}`);
      if (table.length === 0) return [];

      const playerLinks = table.find('a[href^="/profile/"]');
      const players: string[] = [];
      const seen = new Set<string>();

      playerLinks.each((_, el) => {
        const name = $(el).text().trim();
        if (name && !seen.has(name)) {
          seen.add(name);
          players.push(name);
        }
      });

      return players;
    };

    const playersDriving = getPlayers('mission_vehicle_driving');
    const playersAtMission = getPlayers('mission_vehicle_at_mission');

    // Extract exact earnings for planned missions (only visible in planned missions)
    // Format: "Verdienst: 14.500 Credits" (Cheerio's .text() method converts &nbsp; to regular space)
    let exactEarnings: number | null = null;
    const earningsMatch = bodyText.match(/Verdienst:\s*([\d.]+)\s*Credits/i);
    if (earningsMatch) {
      // Remove dots (thousands separator) and parse as integer
      const earningsStr = earningsMatch[1].replace(/\./g, '');
      exactEarnings = parseInt(earningsStr, 10);
      if (isNaN(exactEarnings)) {
        exactEarnings = null;
      }
    }

    return {
      remaining_seconds: remainingSeconds,
      remaining_at: new Date().toISOString(),
      duration_seconds: durationSeconds,
      players_driving: playersDriving,
      players_at_mission: playersAtMission,
      exact_earnings: exactEarnings,
    };
  }

  // Helper method to chunk array
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
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

          // Get countdown timeleft if available
          const countdownEl = document.getElementById('mission_overview_countdown_' + missionId);
          const timeleft = countdownEl?.getAttribute('timeleft') || null;

          // Get progress bar percentage for planned missions (Sicherheitswachen)
          // The progress bar shows how much of the mission time has elapsed
          let progressPercent: number | null = null;
          const progressBarEl = document.getElementById('mission_bar_' + missionId);
          if (progressBarEl) {
            const style = progressBarEl.getAttribute('style') || '';
            const widthMatch = style.match(/width:\s*([\d.]+)%/);
            if (widthMatch) {
              progressPercent = parseFloat(widthMatch[1]);
            }
          }

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
              progress_percent: progressPercent,
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
    logger.info('Browser cleaned up');
  }
}

// Singleton instance
export const lssScraper = new LssScraper();
