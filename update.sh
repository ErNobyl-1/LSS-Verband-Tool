#!/bin/bash
# =============================================================================
# LSS-Verband-Tool Update Script
# =============================================================================
# Einfaches Update: Neue Images pullen und Container neu starten
# Usage: ./update.sh
# =============================================================================

set -e

# Farben
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

# Zum Installationsverzeichnis wechseln
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "=========================================="
echo "  LSS-Verband-Tool Update"
echo "=========================================="
echo ""

# Git pull (falls Repository vorhanden)
if [ -d ".git" ]; then
    log_info "Hole neueste Änderungen von GitHub..."
    git pull --ff-only || log_warn "Git pull fehlgeschlagen (lokale Änderungen?)"
fi

# Neue Images pullen
log_info "Lade neue Docker Images..."
docker compose -f docker-compose.prod.yml pull

# Container neu starten
log_info "Starte Container neu..."
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d

# Alte Images aufräumen
log_info "Räume alte Images auf..."
docker image prune -f

echo ""
log_success "Update abgeschlossen!"
echo ""
echo "Prüfe Status mit:"
echo "  docker compose -f docker-compose.prod.yml ps"
echo "  docker compose -f docker-compose.prod.yml logs -f"
echo ""
