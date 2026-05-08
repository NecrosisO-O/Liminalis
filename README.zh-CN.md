<h1 align="center">Liminalis</h1>

<p align="center">
  一个自托管的文件传输助手，使用端到端加密。
</p>

<p align="center">
  <a href="README.md">English</a>
  ·
  <a href="#使用一键部署脚本">一键部署</a>
  ·
  <a href="#安全模型">安全模型</a>
  ·
  <a href="docs/deployment/docker-compose.md">部署文档</a>
</p>

<p align="center">
  <img alt="Release" src="https://img.shields.io/badge/release-v1.0.0-0f766e">
  <img alt="Self-hosted" src="https://img.shields.io/badge/self--hosted-Docker%20Compose-1f2937">
  <img alt="End-to-end encrypted" src="https://img.shields.io/badge/browser%20E2EE-WebCrypto-d97706">
  <img alt="License" src="https://img.shields.io/badge/license-GPL--3.0--only-374151">
</p>

![Liminalis timeline](docs/assets/readme/timeline.png)

## Liminalis 是什么？

Liminalis 是一个浏览器优先的文件传输助手，自托管部署，可以方便地实现不同设备间的文件、文本传递。它使用端到端加密，支持到期策略和自动失效，支持生成分享链接，也支持 P2P 或中继实时传输。

服务器负责保存运行状态和加密后的载荷。正文、文件名、文件夹路径、公开链接密钥和受信浏览器私钥材料，都由浏览器侧的加密层处理。

## 核心能力

| 范围 | 作用 |
| --- | --- |
| Timeline | 用工作区式时间线快速发送文本和简单文件。 |
| Advanced upload | 处理大文件、多文件、文件夹、分块传输和需要进度反馈的上传。 |
| 分享 | 支持从条目出发的用户分享、密码提取和带 fragment key 的公开链接。 |
| 受信浏览器 | 支持首个浏览器建立信任、后续浏览器配对，以及面向未来使用的恢复码。 |
| Live transfer | 支持需要双方确认的浏览器到浏览器文件会话、WebRTC 信令、relay fallback，以及策略允许时的 stored fallback。 |
| 管理站 | 独立管理站负责邀请、审批、用户、策略、存储、quota 和 Public Origin 设置。 |

## 使用一键部署脚本

```bash
curl -fsSL https://raw.githubusercontent.com/NecrosisO-O/Liminalis/main/scripts/install.sh | bash -s -- --version v1.0.0
```

（适用于 Ubuntu 和 Debian）

安装脚本会询问安装目录、部署模式、公开 URL、本地端口和 PostgreSQL 绑定地址。它会安装缺失的系统包，下载部署包，创建 `.env`，拉取生产镜像，执行数据库迁移，初始化管理员账号，然后启动服务。

初始管理员密码只会在第一次创建 `.env` 时打印。关闭终端前请先保存。

## Docker Compose

包含以下部署文件：

```text
compose.yml
.env.example
README.md
VERSION
scripts/deploy.sh
scripts/install.sh
```

如果你已经拿到了部署包：

```bash
tar -xzf liminalis-deploy-v1.0.0.tar.gz
cd liminalis-deploy-v1.0.0
chmod +x scripts/deploy.sh
scripts/deploy.sh
```

默认公开部署形态如下：

| 服务 | 默认本地端口 | 生产 URL 示例 |
| --- | ---: | --- |
| 用户站 | `8080` | `https://app.example.com` |
| 管理站 | `8081` | `https://admin.example.com` |
| API | 容器内部 | 通过 `/api` 代理 |
| PostgreSQL | `127.0.0.1:5432` | 仅用于本机维护 |

更完整的部署、升级和备份说明见 [`docs/deployment/docker-compose.md`](docs/deployment/docker-compose.md)、[`docs/deployment/upgrade.md`](docs/deployment/upgrade.md) 和 [`docs/deployment/backup-restore.md`](docs/deployment/backup-restore.md)。

## 首次使用

部署完成后，先打开管理站。把实例的 Public Origin 设置为浏览器实际访问的用户站 URL，然后再从用户站完成第一个受信浏览器设置。

产品提示保存恢复码时请保存好；恢复码可以恢复账号和受信浏览器面向未来内容的可用性，但如果所有本地密钥材料都丢失，它不会让旧的加密内容重新可读。

新浏览器需要发起带 short code 的配对请求，并由已有受信浏览器批准。

## 安全模型

在当前端到端加密模型下，服务器无法看到明文正文、文件内容、文件名、文件夹路径、分组 manifest、公开链接密钥、受信设备私钥或用户域私钥。

私钥材料保存在浏览器 IndexedDB vault 中。公开链接使用类似 `/public/<token>#k=<secret>` 的 fragment-key URL，因此正常浏览器导航不会把 secret fragment 发送给服务器。

这个模型依赖浏览器 secure context。生产环境请使用 HTTPS。`localhost` 和 `127.0.0.1` 可以用于本地测试，但裸 LAN HTTP，例如 `http://192.168.x.x`，可能导致基于 WebCrypto 的信任建立失败。

## 日常运维

在部署目录中常用的命令：

```bash
docker compose ps
docker compose logs -f api
docker compose up -d
docker compose down
./scripts/deploy.sh
```

请把 `.env`、PostgreSQL volume 和加密存储 volume 放在一起备份。除非你明确想删除数据库和已存储的加密载荷，否则不要使用 `docker compose down -v`。

## 开发

如果要做源码开发，可以使用仓库中的 npm workspaces：

```bash
npm install
npm run build
npm run lint
npm run test
```

源码 checkout 部署仍可用于开发和验证：

```bash
scripts/deploy.sh --source-build
```

## 开源协议

Liminalis 使用 [GNU General Public License v3.0 only](LICENSE) 发布。
