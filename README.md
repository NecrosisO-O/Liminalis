<h1 align="center">Liminalis</h1>

<p align="center">
  A self-hosted encrypted transfer workspace for files, text, public links, and browser-to-browser live transfer.
</p>

<p align="center">
  <a href="README.zh-CN.md">简体中文</a>
  ·
  <a href="#quick-start">Quick Start</a>
  ·
  <a href="#security-model">Security Model</a>
  ·
  <a href="docs/deployment/docker-compose.md">Deployment Guide</a>
</p>

<p align="center">
  <img alt="Release candidate" src="https://img.shields.io/badge/status-v1.0.0--rc.1-0f766e">
  <img alt="Self-hosted" src="https://img.shields.io/badge/self--hosted-Docker%20Compose-1f2937">
  <img alt="End-to-end encrypted" src="https://img.shields.io/badge/browser%20E2EE-WebCrypto-d97706">
</p>

![Liminalis timeline](docs/assets/readme/timeline.png)

## What Is Liminalis?

Liminalis is a browser-first transfer workspace for people who want a small private station between their own devices, browsers, and trusted users. It is not a public cloud drive or a chat app. The main flow is simple: open the workspace, send text or a file to yourself, and retrieve it from another trusted browser.

The server stores operational state and encrypted payloads. Content, filenames, folder paths, public-link secrets, and trusted-browser private key material are handled in the browser-side cryptographic layer.

## Core Capabilities

| Area | What it does |
| --- | --- |
| Timeline | Quick text notes and simple file transfers in a workspace-style timeline. |
| Advanced upload | Large files, grouped files, folder uploads, chunked transfer, and progress-heavy uploads. |
| Sharing | Item-first user shares, password extractions, and public links with fragment-key URLs. |
| Trusted browsers | First-browser setup, later-browser pairing, and recovery-code based account recovery for future use. |
| Live transfer | Browser-to-browser file sessions with confirmation, WebRTC signaling, relay fallback, and stored fallback when policy allows it. |
| Admin site | Independent management site for invitations, approvals, users, policies, storage, quota, and public origin settings. |

## Quick Start

The recommended v1 deployment path is Docker Compose with the clean release bundle. On a fresh Debian or Ubuntu host:

```bash
curl -fsSL https://raw.githubusercontent.com/NecrosisO-O/Liminalis/main/scripts/install.sh | bash -s -- --version v1.0.0-rc.1
```

The installer asks for the install directory, deployment mode, public URLs, local ports, and PostgreSQL bind address. It installs missing system packages, downloads the deploy bundle, creates `.env`, pulls production images, runs migrations, seeds the initial admin user, and starts the services.

For a local test deployment on the same ports used during acceptance testing:

```bash
curl -fsSL https://raw.githubusercontent.com/NecrosisO-O/Liminalis/main/scripts/install.sh | bash -s -- --version v1.0.0-rc.1 --local --yes --web-port 5173 --admin-port 3001
```

The generated initial admin password is printed only when `.env` is first created. Store it before closing the terminal.

## Docker Compose

A production bundle contains only deployment files:

```text
compose.yml
.env.example
README.md
VERSION
scripts/deploy.sh
scripts/install.sh
```

If you already have the bundle:

```bash
tar -xzf liminalis-deploy-v1.0.0-rc.1.tar.gz
cd liminalis-deploy-v1.0.0-rc.1
chmod +x scripts/deploy.sh
scripts/deploy.sh
```

The default public deployment shape is:

| Service | Default local port | Production URL example |
| --- | ---: | --- |
| User site | `8080` | `https://app.example.com` |
| Admin site | `8081` | `https://admin.example.com` |
| API | internal | proxied through `/api` |
| PostgreSQL | `127.0.0.1:5432` | local maintenance only |

Detailed deployment, upgrade, and backup notes live in [`docs/deployment/docker-compose.md`](docs/deployment/docker-compose.md), [`docs/deployment/upgrade.md`](docs/deployment/upgrade.md), and [`docs/deployment/backup-restore.md`](docs/deployment/backup-restore.md).

## First Run

After deployment, open the admin site first. Set the instance public origin to the browser-visible user-site URL, create invitations, approve users, and then complete the first trusted-browser setup from the user site.

New browsers do not silently inherit access. They request pairing with a short code, and an existing trusted browser approves them. Save recovery codes when the product asks you to; recovery restores account and trusted-browser usability for future content, but it does not make old encrypted content readable if all local key material has been lost.

## Security Model

Liminalis is designed around browser-side end-to-end encryption for protected content. The server should not see plaintext text bodies, file bodies, filenames, folder paths, grouped manifests, public-link secrets, trusted-device private keys, or user-domain private keys.

Private key material is stored in the browser's IndexedDB vault. Public links use fragment-key URLs shaped like `/public/<token>#k=<secret>`, so the secret fragment is not sent to the server in normal browser navigation.

This model depends on a browser secure context. Use HTTPS in production. `localhost` and `127.0.0.1` are acceptable for local testing, but bare LAN HTTP such as `http://192.168.x.x` may break WebCrypto-based trust setup.

## Operations

Common commands from the deployment directory:

```bash
docker compose ps
docker compose logs -f api
docker compose up -d
docker compose down
./scripts/deploy.sh
```

Back up `.env`, the PostgreSQL volume, and the encrypted storage volume together. Do not use `docker compose down -v` unless you intentionally want to delete the database and stored encrypted payloads.

## Current Status

Liminalis is currently at `v1.0.0-rc.1`. The release candidate includes the production deploy bundle, GHCR images, one-line installer, Docker Compose deployment, user site, admin site, browser E2EE, sharing flows, live transfer, and large-file advanced upload.

Known v1 limitation: advanced uploads are not resumable across refresh, page leave, or browser shutdown. Large uploads should stay on the upload page until completion.

## Development

For source work, use the npm workspaces in this repository:

```bash
npm install
npm run build
npm run lint
npm run test
```

Source checkout deployment is available for development and validation:

```bash
scripts/deploy.sh --source-build
```

For production, prefer the clean deploy bundle or the one-line installer.
