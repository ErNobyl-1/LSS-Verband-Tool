# GitHub Actions Workflows

## Docker Image Publishing

### Workflow: `docker-publish.yml`

Automatischer Build und Deployment der Docker Images zu GitHub Container Registry (GHCR).

#### Trigger

Der Workflow wird ausgelöst bei:

1. **Push auf `main` Branch**
   - Baut beide Images (API + Web)
   - Pusht als `latest` Tag
   - Beispiel: `ghcr.io/ernobyl-1/lss-verband-tool-api:latest`

2. **Git Tags (Versionen)**
   - Format: `v*.*.*` (z.B. `v1.1.0`)
   - Baut Images mit Versions-Tags
   - Beispiel: `ghcr.io/ernobyl-1/lss-verband-tool-api:1.1.0`

3. **Pull Requests**
   - Baut Images zum Testen (pushed nicht)
   - Validiert, dass Images buildbar sind

4. **Manueller Trigger**
   - Über GitHub Actions UI: "Run workflow"
   - Nützlich für Re-Builds

#### Images

Zwei Images werden gebaut:

- **API**: `ghcr.io/ernobyl-1/lss-verband-tool-api`
- **Web**: `ghcr.io/ernobyl-1/lss-verband-tool-web`

#### Tags

Automatische Tag-Generierung basierend auf Event:

| Event | Tags | Beispiel |
|-------|------|----------|
| Push main | `latest` | `ghcr.io/.../api:latest` |
| Tag v1.1.0 | `1.1.0`, `1.1`, `1`, `latest` | `ghcr.io/.../api:1.1.0` |
| PR #12 | `pr-12` | `ghcr.io/.../api:pr-12` |

#### Optimierungen

- **Build Cache**: GitHub Actions Cache für schnellere Builds
- **Parallele Builds**: API und Web werden parallel gebaut
- **Multi-Platform**: Derzeit nur `linux/amd64` (erweiterbar)

#### Neue Version veröffentlichen

1. **Code auf main mergen**
   ```bash
   git checkout main
   git pull
   ```

2. **Version taggen**
   ```bash
   git tag v1.1.0
   git push origin v1.1.0
   ```

3. **Workflow startet automatisch**
   - Siehe: https://github.com/ErNobyl-1/LSS-Verband-Tool/actions

4. **Images verfügbar**
   - API: https://github.com/ErNobyl-1/LSS-Verband-Tool/pkgs/container/lss-verband-tool-api
   - Web: https://github.com/ErNobyl-1/LSS-Verband-Tool/pkgs/container/lss-verband-tool-web

#### Permissions

Der Workflow verwendet `GITHUB_TOKEN` mit:
- `contents: read` - Repository lesen
- `packages: write` - GHCR pushen

Keine zusätzlichen Secrets erforderlich!

#### Troubleshooting

**Build schlägt fehl:**
- Prüfe Dockerfiles: `docker build -f apps/api/Dockerfile .`
- Prüfe Workflow-Logs in GitHub Actions

**Push schlägt fehl:**
- Permissions prüfen in Repository Settings → Actions → General
- "Read and write permissions" muss aktiviert sein

**Image nicht verfügbar:**
- Nach erstem Push: Package auf "Public" setzen
- Settings → Packages → Change visibility

## Dependabot

Automatische Dependency Updates werden von Dependabot verwaltet.

Konfiguration: `.github/dependabot.yml` (falls vorhanden)
