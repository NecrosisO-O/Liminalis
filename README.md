<h1 align="center">Liminalis</h1>

<p align="center">
  A self-hosted file transfer assistant with end-to-end encryption.
</p>

<p align="center">
  <a href="README.zh-CN.md">简体中文</a>
  ·
  <a href="#use-the-one-line-installer">One-Line Install</a>
  ·
  <a href="#security-model">Security Model</a>
  ·
  <a href="docs/deployment/docker-compose.md">Deployment Guide</a>
</p>

<p align="center">
  <img alt="Release candidate" src="https://img.shields.io/badge/status-v1.0.0--rc.1-0f766e">
  <img alt="Self-hosted" src="https://img.shields.io/badge/self--hosted-Docker%20Compose-1f2937">
  <img alt="End-to-end encrypted" src="https://img.shields.io/badge/browser%20E2EE-WebCrypto-d97706">
  <img alt="License" src="https://img.shields.io/badge/license-GPL--3.0--only-374151">
</p>

![Liminalis timeline](docs/assets/readme/timeline.png)

## What Is Liminalis?

Liminalis is a browser-first file transfer assistant for self-hosted deployments. It helps move files and text between your own devices without relying on a chat app, cloud drive, or third-party transfer service.

It uses end-to-end encryption, supports expiration policies and automatic invalidation, can create share links, and supports P2P or relay-based live transfer.

The server stores operational state and encrypted payloads. Text bodies, filenames, folder paths, public-link secrets, and trusted-browser private key material are handled in the browser-side cryptographic layer.

## Core Capabilities

| Area | What it does |
| --- | --- |
| Timeline | Quick text notes and simple file transfers in a workspace-style timeline. |
| Advanced upload | Large files, grouped files, folder uploads, chunked transfer, and progress-heavy uploads. |
| Sharing | Item-first user shares, password extractions, and public links with fragment-key URLs. |
| Trusted browsers | First-browser setup, later-browser pairing, and recovery-code based account recovery for future use. |
| Live transfer | Browser-to-browser file sessions with confirmation, WebRTC signaling, relay fallback, and stored fallback when policy allows it. |
| Admin site | Independent management site for invitations, approvals, users, policies, storage, quota, and public origin settings. |

## Use the One-Line Installer

```bash
curl -fsSL https://raw.githubusercontent.com/NecrosisO-O/Liminalis/main/scripts/install.sh | bash -s -- --version v1.0.0-rc.1
```

(For Ubuntu and Debian.)

The installer asks for the install directory, deployment mode, public URLs, local ports, and PostgreSQL bind address. It installs missing system packages, downloads the deploy bundle, creates `.env`, pulls production images, runs migrations, seeds the initial admin user, and starts the services.

The generated initial admin password is printed only when `.env` is first created. Store it before closing the terminal.

## Docker Compose

The production bundle contains these deployment files:

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

After deployment, open the admin site first. Set the instance Public Origin to the browser-visible user-site URL, then complete the first trusted-browser setup from the user site.

Save recovery codes when the product asks you to. Recovery restores account and trusted-browser usability for future content, but it does not make old encrypted content readable if all local key material has been lost.

New browsers request pairing with a short code and must be approved by an existing trusted browser.

## Security Model

Under the current end-to-end encryption model, the server cannot see plaintext text bodies, file bodies, filenames, folder paths, grouped manifests, public-link secrets, trusted-device private keys, or user-domain private keys.

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

## License

Liminalis is released under the [GNU General Public License v3.0 only](LICENSE).
