#!/bin/bash
set -e

# =============================================================================
# LSS-Verband-Tool Server Setup Script
# =============================================================================
# Dieses Script richtet einen Server KOMPLETT ein:
# - System-Hardening (SSH, Firewall, fail2ban)
# - Docker + Docker Compose
# - nginx als Reverse Proxy
# - Let's Encrypt SSL-Zertifikate (mit Auto-Renewal)
# - Automatische Sicherheitsupdates
# - Swap (für kleine Server)
# =============================================================================

# Farben für Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Prüfen ob root
if [ "$EUID" -ne 0 ]; then
    log_error "Bitte als root ausführen: sudo ./setup.sh"
    exit 1
fi

# =============================================================================
# Konfiguration abfragen
# =============================================================================
echo ""
echo "=========================================="
echo "  LSS-Verband-Tool Server Setup"
echo "=========================================="
echo ""

# Domain abfragen und validieren
while true; do
    read -p "Domain für das Tool (z.B. verband.ernobyl.de): " DOMAIN
    if [ -z "$DOMAIN" ]; then
        log_error "Domain ist erforderlich!"
        continue
    fi
    # Validierung: Domain-Format prüfen (keine Leerzeichen, kein http://, mindestens ein Punkt)
    if [[ "$DOMAIN" =~ ^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$ ]]; then
        break
    else
        log_error "Ungültiges Domain-Format! Beispiel: verband.example.de"
        log_error "Kein http:// oder https:// verwenden!"
    fi
done

# E-Mail für Let's Encrypt abfragen und validieren
while true; do
    read -p "E-Mail für Let's Encrypt Zertifikate: " EMAIL
    if [ -z "$EMAIL" ]; then
        log_error "E-Mail ist erforderlich!"
        continue
    fi
    # Einfache E-Mail-Validierung
    if [[ "$EMAIL" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
        break
    else
        log_error "Ungültiges E-Mail-Format!"
    fi
done

# Installationspfad
INSTALL_DIR="/opt/lss-verband-tool"
read -p "Installationspfad [$INSTALL_DIR]: " INPUT_DIR
INSTALL_DIR="${INPUT_DIR:-$INSTALL_DIR}"

# Pfad validieren (muss absoluter Pfad sein, keine Sonderzeichen)
if [[ ! "$INSTALL_DIR" =~ ^/[a-zA-Z0-9/_-]+$ ]]; then
    log_error "Ungültiger Installationspfad! Muss absoluter Pfad sein (z.B. /opt/lss-tool)"
    exit 1
fi

# Git Repository (public)
GIT_REPO="https://github.com/ErNobyl-1/LSS-Verband-Tool.git"

echo ""
log_info "Konfiguration:"
echo "  Domain:     $DOMAIN"
echo "  E-Mail:     $EMAIL"
echo "  Pfad:       $INSTALL_DIR"
echo ""
read -p "Fortfahren? (j/n): " CONFIRM
if [ "$CONFIRM" != "j" ] && [ "$CONFIRM" != "J" ]; then
    log_warn "Abgebrochen."
    exit 0
fi

# =============================================================================
# OS Detection
# =============================================================================
log_info "Erkenne Betriebssystem..."

if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    OS_VERSION=$VERSION_ID
else
    log_error "Kann Betriebssystem nicht erkennen!"
    exit 1
fi

log_success "Erkannt: $OS $OS_VERSION"

# Package Manager bestimmen
case $OS in
    debian|ubuntu)
        PKG_UPDATE="apt-get update"
        PKG_INSTALL="apt-get install -y"
        ;;
    rocky|centos|rhel|almalinux)
        PKG_UPDATE="dnf check-update || true"
        PKG_INSTALL="dnf install -y"
        ;;
    *)
        log_error "Nicht unterstütztes OS: $OS"
        log_error "Unterstützt: Debian, Ubuntu, Rocky Linux, CentOS, AlmaLinux"
        exit 1
        ;;
esac

# =============================================================================
# Timezone setzen
# =============================================================================
log_info "Setze Timezone auf Europe/Berlin..."
timedatectl set-timezone Europe/Berlin
log_success "Timezone gesetzt"

# =============================================================================
# System aktualisieren
# =============================================================================
log_info "Aktualisiere System..."
$PKG_UPDATE
case $OS in
    debian|ubuntu)
        apt-get upgrade -y
        ;;
    rocky|centos|rhel|almalinux)
        dnf upgrade -y
        ;;
esac
log_success "System aktualisiert"

# =============================================================================
# Swap einrichten (falls nicht vorhanden)
# =============================================================================
log_info "Prüfe Swap..."

if [ "$(swapon --show | wc -l)" -eq 0 ]; then
    log_info "Kein Swap gefunden, erstelle 2GB Swap..."
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    # Swappiness reduzieren (nur bei wenig RAM swappen)
    echo 'vm.swappiness=10' >> /etc/sysctl.conf
    sysctl vm.swappiness=10
    log_success "2GB Swap erstellt"
else
    log_success "Swap bereits vorhanden"
fi

# =============================================================================
# Basis-Pakete installieren
# =============================================================================
log_info "Installiere Basis-Pakete..."
case $OS in
    debian|ubuntu)
        $PKG_INSTALL curl wget git ca-certificates gnupg lsb-release
        ;;
    rocky|centos|rhel|almalinux)
        $PKG_INSTALL curl wget git ca-certificates
        ;;
esac
log_success "Basis-Pakete installiert"

# =============================================================================
# Docker installieren
# =============================================================================
log_info "Installiere Docker..."

if command -v docker &> /dev/null; then
    log_success "Docker bereits installiert"
else
    case $OS in
        debian|ubuntu)
            # Docker GPG Key
            install -m 0755 -d /etc/apt/keyrings
            curl -fsSL https://download.docker.com/linux/$OS/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
            chmod a+r /etc/apt/keyrings/docker.gpg

            # Docker Repository
            echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$OS $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

            apt-get update
            apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
            ;;
        rocky|centos|rhel|almalinux)
            dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
            dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
            ;;
    esac

    systemctl enable docker
    systemctl start docker
    log_success "Docker installiert und gestartet"
fi

# =============================================================================
# nginx installieren
# =============================================================================
log_info "Installiere nginx..."

if command -v nginx &> /dev/null; then
    log_success "nginx bereits installiert"
else
    $PKG_INSTALL nginx
    systemctl enable nginx
    log_success "nginx installiert"
fi

# =============================================================================
# EPEL Repository aktivieren (für Rocky/CentOS/RHEL)
# =============================================================================
case $OS in
    rocky|centos|rhel|almalinux)
        if ! rpm -q epel-release &> /dev/null; then
            log_info "Aktiviere EPEL Repository..."
            $PKG_INSTALL epel-release
            log_success "EPEL Repository aktiviert"
        else
            log_success "EPEL Repository bereits aktiviert"
        fi
        ;;
esac

# =============================================================================
# Certbot installieren
# =============================================================================
log_info "Installiere Certbot..."

if command -v certbot &> /dev/null; then
    log_success "Certbot bereits installiert"
else
    case $OS in
        debian|ubuntu)
            $PKG_INSTALL certbot python3-certbot-nginx
            ;;
        rocky|centos|rhel|almalinux)
            $PKG_INSTALL certbot python3-certbot-nginx
            ;;
    esac
    log_success "Certbot installiert"
fi

# =============================================================================
# Firewall einrichten
# =============================================================================
log_info "Richte Firewall ein..."

case $OS in
    debian|ubuntu)
        $PKG_INSTALL ufw
        ufw --force reset
        ufw default deny incoming
        ufw default allow outgoing
        ufw allow 22/tcp comment 'SSH'
        ufw allow 80/tcp comment 'HTTP'
        ufw allow 443/tcp comment 'HTTPS'
        ufw --force enable
        log_success "UFW Firewall konfiguriert"
        ;;
    rocky|centos|rhel|almalinux)
        systemctl enable firewalld
        systemctl start firewalld
        firewall-cmd --permanent --add-service=ssh
        firewall-cmd --permanent --add-service=http
        firewall-cmd --permanent --add-service=https
        firewall-cmd --reload
        log_success "Firewalld konfiguriert"
        ;;
esac

# =============================================================================
# fail2ban installieren
# =============================================================================
log_info "Installiere fail2ban..."

if command -v fail2ban-client &> /dev/null; then
    log_success "fail2ban bereits installiert"
else
    $PKG_INSTALL fail2ban
fi

# fail2ban Konfiguration
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 24h
EOF

# Für Rocky/CentOS anderen Log-Pfad
case $OS in
    rocky|centos|rhel|almalinux)
        sed -i 's|/var/log/auth.log|/var/log/secure|g' /etc/fail2ban/jail.local
        ;;
esac

systemctl enable fail2ban
systemctl restart fail2ban
log_success "fail2ban konfiguriert"

# =============================================================================
# Deploy-User erstellen
# =============================================================================
log_info "Erstelle Deploy-User..."

DEPLOY_USER="deploy"
DEPLOY_PW=$(openssl rand -base64 16 | tr -d '/+=' | head -c 16)

if id "$DEPLOY_USER" &>/dev/null; then
    log_success "User '$DEPLOY_USER' existiert bereits"
else
    # User erstellen
    useradd -m -s /bin/bash "$DEPLOY_USER"
    echo "$DEPLOY_USER:$DEPLOY_PW" | chpasswd

    # Sudo-Rechte geben
    usermod -aG sudo "$DEPLOY_USER" 2>/dev/null || usermod -aG wheel "$DEPLOY_USER" 2>/dev/null

    # Docker-Rechte geben
    usermod -aG docker "$DEPLOY_USER"

    log_success "User '$DEPLOY_USER' erstellt mit sudo + Docker Rechten"
fi

# =============================================================================
# SSH absichern
# =============================================================================
log_info "Sichere SSH ab..."

# Backup der SSH-Konfiguration
cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup

# SSH härten (Passwort bleibt erlaubt für alle - fail2ban schützt)
sed -i 's/#\?PermitRootLogin.*/PermitRootLogin yes/' /etc/ssh/sshd_config
sed -i 's/#\?PasswordAuthentication.*/PasswordAuthentication yes/' /etc/ssh/sshd_config
sed -i 's/#\?PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config
sed -i 's/#\?MaxAuthTries.*/MaxAuthTries 3/' /etc/ssh/sshd_config
sed -i 's/#\?LoginGraceTime.*/LoginGraceTime 60/' /etc/ssh/sshd_config

# SSH neustarten
systemctl restart sshd
log_success "SSH konfiguriert (Passwort-Login erlaubt, fail2ban schützt)"

# =============================================================================
# Automatische Updates einrichten
# =============================================================================
log_info "Richte automatische Sicherheitsupdates ein..."

case $OS in
    debian|ubuntu)
        $PKG_INSTALL unattended-upgrades apt-listchanges
        cat > /etc/apt/apt.conf.d/20auto-upgrades << 'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF
        systemctl enable unattended-upgrades
        log_success "unattended-upgrades konfiguriert"
        ;;
    rocky|centos|rhel|almalinux)
        dnf install -y dnf-automatic
        sed -i 's/apply_updates = no/apply_updates = yes/' /etc/dnf/automatic.conf
        systemctl enable dnf-automatic.timer
        systemctl start dnf-automatic.timer
        log_success "dnf-automatic konfiguriert"
        ;;
esac

# =============================================================================
# Projekt klonen
# =============================================================================
log_info "Klone Repository..."

if [ -d "$INSTALL_DIR" ]; then
    log_warn "Verzeichnis existiert bereits: $INSTALL_DIR"
    read -p "Löschen und neu klonen? (j/n): " DELETE_DIR
    if [ "$DELETE_DIR" = "j" ] || [ "$DELETE_DIR" = "J" ]; then
        rm -rf "$INSTALL_DIR"
    else
        log_error "Abgebrochen."
        exit 1
    fi
fi

git clone "$GIT_REPO" "$INSTALL_DIR"
cd "$INSTALL_DIR"
log_success "Repository geklont"

# =============================================================================
# .env erstellen
# =============================================================================
log_info "Erstelle .env Konfiguration..."

if [ -f "$INSTALL_DIR/.env" ]; then
    log_warn ".env existiert bereits"
else
    cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"
fi

# Sichere Passwörter generieren
ADMIN_PW=$(openssl rand -base64 24 | tr -d '/+=' | head -c 20)
POSTGRES_PW=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)

# .env aktualisieren
sed -i "s|ADMIN_PASSWORD=.*|ADMIN_PASSWORD=${ADMIN_PW}|" "$INSTALL_DIR/.env"
sed -i "s|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${POSTGRES_PW}|" "$INSTALL_DIR/.env"
sed -i "s|CORS_ORIGIN=.*|CORS_ORIGIN=https://${DOMAIN}|" "$INSTALL_DIR/.env"
sed -i "s|VITE_API_URL=.*|VITE_API_URL=https://${DOMAIN}/api|" "$INSTALL_DIR/.env"
sed -i "s|NODE_ENV=.*|NODE_ENV=production|" "$INSTALL_DIR/.env"

log_success ".env konfiguriert"

echo ""
echo "=========================================="
echo -e "${YELLOW}WICHTIG: Trage deine LSS-Zugangsdaten ein!${NC}"
echo "=========================================="
echo ""
echo "Bearbeite die Datei: $INSTALL_DIR/.env"
echo "Setze LSS_EMAIL und LSS_PASSWORD"
echo ""

# E-Mail-Benachrichtigungen konfigurieren (optional)
echo ""
log_info "E-Mail-Benachrichtigungen konfigurieren (optional)"
echo "Das Tool kann bei kritischen Fehlern automatisch E-Mails senden."
echo ""
read -p "E-Mail-Benachrichtigungen aktivieren? (j/n): " SETUP_EMAIL

if [ "$SETUP_EMAIL" = "j" ] || [ "$SETUP_EMAIL" = "J" ]; then
    echo ""
    echo "SMTP-Konfiguration:"
    echo "Beispiele:"
    echo "  Gmail:        smtp.gmail.com (Port 587)"
    echo "  Outlook:      smtp.office365.com (Port 587)"
    echo "  Custom SMTP:  mail.example.com"
    echo ""

    read -p "SMTP Host (z.B. smtp.gmail.com): " SMTP_HOST
    read -p "SMTP Port [587]: " SMTP_PORT
    SMTP_PORT="${SMTP_PORT:-587}"

    # SMTP_SECURE basierend auf Port setzen
    if [ "$SMTP_PORT" = "465" ]; then
        SMTP_SECURE="true"
    else
        SMTP_SECURE="false"
    fi

    read -p "SMTP Benutzername (E-Mail): " SMTP_USER
    read -sp "SMTP Passwort (App-Passwort empfohlen): " SMTP_PASSWORD
    echo ""
    read -p "E-Mail für Benachrichtigungen: " ALERT_EMAIL

    # .env aktualisieren mit SMTP-Daten
    sed -i "s|SMTP_HOST=.*|SMTP_HOST=${SMTP_HOST}|" "$INSTALL_DIR/.env"
    sed -i "s|SMTP_PORT=.*|SMTP_PORT=${SMTP_PORT}|" "$INSTALL_DIR/.env"
    sed -i "s|SMTP_SECURE=.*|SMTP_SECURE=${SMTP_SECURE}|" "$INSTALL_DIR/.env"
    sed -i "s|SMTP_USER=.*|SMTP_USER=${SMTP_USER}|" "$INSTALL_DIR/.env"
    sed -i "s|SMTP_PASSWORD=.*|SMTP_PASSWORD=${SMTP_PASSWORD}|" "$INSTALL_DIR/.env"
    sed -i "s|SMTP_FROM=.*|SMTP_FROM=LSS Verband Tool <${SMTP_USER}>|" "$INSTALL_DIR/.env"
    sed -i "s|ALERT_EMAIL=.*|ALERT_EMAIL=${ALERT_EMAIL}|" "$INSTALL_DIR/.env"

    log_success "E-Mail-Benachrichtigungen konfiguriert"
    echo ""
    log_info "Hinweis für Gmail:"
    echo "  1. Aktiviere 2-Faktor-Authentifizierung"
    echo "  2. Erstelle App-Passwort: https://myaccount.google.com/apppasswords"
    echo "  3. Verwende das App-Passwort statt deinem normalen Passwort"
else
    log_info "E-Mail-Benachrichtigungen übersprungen (kann später in .env konfiguriert werden)"
fi

echo ""
read -p "Jetzt .env bearbeiten? (j/n): " EDIT_ENV
if [ "$EDIT_ENV" = "j" ] || [ "$EDIT_ENV" = "J" ]; then
    ${EDITOR:-nano} "$INSTALL_DIR/.env"
fi

# =============================================================================
# nginx konfigurieren (HTTP mit Proxy-Locations)
# =============================================================================
log_info "Konfiguriere nginx..."

# Prüfen ob bereits konfiguriert (idempotent)
if [ -f "/etc/nginx/sites-available/lss-verband-tool" ] && grep -q "$DOMAIN" /etc/nginx/sites-available/lss-verband-tool 2>/dev/null; then
    log_success "nginx bereits für $DOMAIN konfiguriert"
else
    cat > /etc/nginx/sites-available/lss-verband-tool << EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    # Security Headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Frontend
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # API
    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;

        # SSE Support
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
    }

}
EOF

# Sites-enabled Symlink
case $OS in
    debian|ubuntu)
        ln -sf /etc/nginx/sites-available/lss-verband-tool /etc/nginx/sites-enabled/
        rm -f /etc/nginx/sites-enabled/default
        ;;
    rocky|centos|rhel|almalinux)
        cp /etc/nginx/sites-available/lss-verband-tool /etc/nginx/conf.d/lss-verband-tool.conf
        ;;
esac

    # nginx testen und starten
    nginx -t
    systemctl start nginx
    log_success "nginx gestartet"
fi

# =============================================================================
# SSL-Zertifikat holen (Certbot konfiguriert nginx automatisch um)
# =============================================================================
# Prüfen ob bereits SSL vorhanden (idempotent)
if [ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
    log_success "SSL-Zertifikat bereits vorhanden für $DOMAIN"
else
    log_info "Hole SSL-Zertifikat..."

    # nginx muss laufen für certbot
    systemctl start nginx 2>/dev/null || true

    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect

    log_success "SSL-Zertifikat installiert"
fi

# HSTS Header hinzufügen (Certbot macht das nicht automatisch)
log_info "Füge HSTS Header hinzu..."
case $OS in
    debian|ubuntu)
        NGINX_CONF="/etc/nginx/sites-available/lss-verband-tool"
        ;;
    rocky|centos|rhel|almalinux)
        NGINX_CONF="/etc/nginx/conf.d/lss-verband-tool.conf"
        ;;
esac

# HSTS in den SSL-Block einfügen (nach ssl_dhparam Zeile)
sed -i '/ssl_dhparam/a\    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;' "$NGINX_CONF"

nginx -t && systemctl reload nginx
log_success "nginx konfiguriert (HTTPS aktiv)"

# Certbot Auto-Renewal Timer prüfen/aktivieren
log_info "Prüfe Certbot Auto-Renewal..."
if systemctl list-timers | grep -q certbot; then
    log_success "Certbot Timer aktiv"
else
    # Timer manuell erstellen falls nicht vorhanden
    systemctl enable certbot.timer 2>/dev/null || true
    systemctl start certbot.timer 2>/dev/null || true
    log_success "Certbot Timer aktiviert"
fi

# =============================================================================
# Backup-Script erstellen
# =============================================================================
log_info "Erstelle Backup-Script..."

cat > "$INSTALL_DIR/backup.sh" << 'BACKUP_EOF'
#!/bin/bash
# LSS-Verband-Tool Backup Script

BACKUP_DIR="/opt/lss-backups"
INSTALL_DIR="/opt/lss-verband-tool"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting backup..."

# PostgreSQL Backup via Docker
docker compose -f "$INSTALL_DIR/docker-compose.prod.yml" exec -T postgres pg_dump -U lss lss_tool > "$BACKUP_DIR/db_$DATE.sql"

if [ $? -eq 0 ]; then
    gzip "$BACKUP_DIR/db_$DATE.sql"
    echo "[$(date)] Database backup: $BACKUP_DIR/db_$DATE.sql.gz"
else
    echo "[$(date)] ERROR: Database backup failed!"
    exit 1
fi

# .env sichern
cp "$INSTALL_DIR/.env" "$BACKUP_DIR/env_$DATE.backup"
echo "[$(date)] Config backup: $BACKUP_DIR/env_$DATE.backup"

# Alte Backups löschen
find "$BACKUP_DIR" -name "db_*.sql.gz" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -name "env_*.backup" -mtime +$RETENTION_DAYS -delete
echo "[$(date)] Old backups cleaned (retention: $RETENTION_DAYS days)"

echo "[$(date)] Backup complete!"
BACKUP_EOF

chmod +x "$INSTALL_DIR/backup.sh"

# Backup Cronjob einrichten (täglich um 3:00)
(crontab -l 2>/dev/null | grep -v "lss-verband-tool/backup.sh"; echo "0 3 * * * $INSTALL_DIR/backup.sh >> /var/log/lss-backup.log 2>&1") | crontab -

log_success "Backup-Script erstellt (täglich um 3:00 Uhr)"

# =============================================================================
# Docker Container starten (verwendet fertige Images von GHCR)
# =============================================================================
log_info "Starte Docker Container..."

cd "$INSTALL_DIR"

# Prüfen ob Container bereits laufen
if docker compose -f docker-compose.prod.yml ps 2>/dev/null | grep -q "Up"; then
    log_warn "Container laufen bereits"
    read -p "Container neu starten? (j/n): " RESTART_CONTAINERS
    if [ "$RESTART_CONTAINERS" = "j" ] || [ "$RESTART_CONTAINERS" = "J" ]; then
        docker compose -f docker-compose.prod.yml down
        docker compose -f docker-compose.prod.yml pull
        docker compose -f docker-compose.prod.yml up -d
    fi
else
    # Images pullen und Container starten
    docker compose -f docker-compose.prod.yml pull
    docker compose -f docker-compose.prod.yml up -d
fi

log_success "Container gestartet"

# =============================================================================
# Berechtigungen setzen
# =============================================================================
log_info "Setze Berechtigungen für deploy-User..."

# Deploy-User Zugriff auf Installationsverzeichnis geben
chown -R root:docker "$INSTALL_DIR"
chmod -R g+rw "$INSTALL_DIR"

# Backup-Verzeichnis erstellen mit richtigen Rechten
mkdir -p /opt/lss-backups
chown root:docker /opt/lss-backups
chmod 770 /opt/lss-backups

log_success "Berechtigungen gesetzt"

# =============================================================================
# Abschluss
# =============================================================================

# Status-Check
echo ""
log_info "Führe Systemcheck durch..."
sleep 5  # Warten bis Container hochgefahren sind

HEALTH_OK=true

# Docker Container prüfen
if docker compose -f docker-compose.prod.yml ps | grep -q "Up"; then
    log_success "Docker Container laufen"
else
    log_error "Docker Container Problem!"
    HEALTH_OK=false
fi

# nginx prüfen
if systemctl is-active --quiet nginx; then
    log_success "nginx läuft"
else
    log_error "nginx Problem!"
    HEALTH_OK=false
fi

# SSL prüfen
if [ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
    log_success "SSL-Zertifikat vorhanden"
else
    log_warn "SSL-Zertifikat nicht gefunden"
fi

# Firewall prüfen
case $OS in
    debian|ubuntu)
        if ufw status | grep -q "Status: active"; then
            log_success "Firewall aktiv"
        else
            log_warn "Firewall inaktiv"
        fi
        ;;
    rocky|centos|rhel|almalinux)
        if systemctl is-active --quiet firewalld; then
            log_success "Firewall aktiv"
        else
            log_warn "Firewall inaktiv"
        fi
        ;;
esac

echo ""
echo "=========================================="
echo -e "${GREEN}  Setup abgeschlossen!${NC}"
echo "=========================================="
echo ""
echo -e "${BLUE}═══ WEB-ANWENDUNG ═══${NC}"
echo "  URL:            https://${DOMAIN}"
echo "  Admin-User:     admin"
echo "  Admin-Passwort: ${ADMIN_PW}"
echo ""
echo -e "${BLUE}═══ SERVER-ZUGANG ═══${NC}"
echo "  Option 1:       ssh root@${DOMAIN} (dein bestehendes Passwort)"
echo "  Option 2:       ssh ${DEPLOY_USER}@${DOMAIN}"
echo "                  Passwort: ${DEPLOY_PW}"
echo ""
echo "  EMPFEHLUNG: Nutze '${DEPLOY_USER}' für den Alltag (hat sudo + Docker)"
echo ""
echo -e "${BLUE}═══ DATEIEN ═══${NC}"
echo "  Installation:   ${INSTALL_DIR}"
echo "  Konfiguration:  ${INSTALL_DIR}/.env"
echo "  Backups:        /opt/lss-backups/"
echo "  Backup-Logs:    /var/log/lss-backup.log"
echo ""
echo -e "${BLUE}═══ BEFEHLE ═══${NC}"
echo "  cd ${INSTALL_DIR}"
echo "  ./update.sh                   # Update auf neue Version"
echo "  docker compose -f docker-compose.prod.yml logs -f        # Logs anzeigen"
echo "  docker compose -f docker-compose.prod.yml logs -f api    # Nur API-Logs"
echo "  docker compose -f docker-compose.prod.yml restart        # Neustart"
echo "  docker compose -f docker-compose.prod.yml down           # Stoppen"
echo "  sudo ./backup.sh              # Manuelles Backup"
echo ""
echo -e "${BLUE}═══ AUTOMATISCHE TASKS ═══${NC}"
echo "  - Backups:      Täglich um 3:00 Uhr"
echo "  - SSL-Renewal:  Automatisch via Certbot"
echo "  - Updates:      Automatische Sicherheitsupdates"
echo "  - Sessions:     Stündliche Bereinigung"
echo ""

if [ "$HEALTH_OK" = false ]; then
    echo -e "${RED}═══ WARNUNG ═══${NC}"
    echo "Einige Dienste haben Probleme!"
    echo "Prüfe Logs mit: docker compose -f docker-compose.prod.yml logs"
    echo ""
fi

echo -e "${YELLOW}═══ JETZT ERLEDIGEN ═══${NC}"
echo "1. BEIDE Passwörter sicher speichern (Admin + SSH)!"
echo "2. Prüfe ob LSS_EMAIL und LSS_PASSWORD in .env gesetzt sind:"
echo "   nano ${INSTALL_DIR}/.env"
echo "3. (Optional) Prüfe E-Mail-Benachrichtigungen in .env"
echo "4. Falls .env geändert: docker compose -f docker-compose.prod.yml restart"
echo "5. Teste Login: https://${DOMAIN}"
echo "6. Teste SSH: ssh ${DEPLOY_USER}@${DOMAIN}"
echo ""
echo -e "${BLUE}═══ E-MAIL-BENACHRICHTIGUNGEN ═══${NC}"
if [ "$SETUP_EMAIL" = "j" ] || [ "$SETUP_EMAIL" = "J" ]; then
    echo "  Status:         Konfiguriert"
    echo "  SMTP Host:      ${SMTP_HOST}:${SMTP_PORT}"
    echo "  Alerts an:      ${ALERT_EMAIL}"
    echo "  Dokumentation:  ${INSTALL_DIR}/docs/email-notifications.md"
else
    echo "  Status:         Nicht konfiguriert"
    echo "  Aktivieren:     Bearbeite ${INSTALL_DIR}/.env und setze SMTP_* Variablen"
    echo "  Dokumentation:  ${INSTALL_DIR}/docs/email-notifications.md"
fi
echo ""

# Passwörter in Datei speichern (nur lesbar für root)
cat > "${INSTALL_DIR}/.credentials" << CRED_EOF
# LSS-Verband-Tool Zugangsdaten
# Erstellt: $(date)
# SICHER AUFBEWAHREN UND DIESE DATEI LÖSCHEN!

Web-Admin:
  URL:      https://${DOMAIN}
  User:     admin
  Passwort: ${ADMIN_PW}

SSH-Zugang:
  Host:     ${DOMAIN}
  User:     ${DEPLOY_USER}
  Passwort: ${DEPLOY_PW}

Datenbank:
  Passwort: ${POSTGRES_PW}
CRED_EOF

chmod 600 "${INSTALL_DIR}/.credentials"
echo -e "${GREEN}Alle Zugangsdaten gespeichert in: ${INSTALL_DIR}/.credentials${NC}"
echo -e "${YELLOW}WICHTIG: Datei sichern und dann löschen!${NC}"
echo ""
