# Upgrade

Before upgrading, create a backup of PostgreSQL, the encrypted storage volume,
and `.env`. See `docs/deployment/backup-restore.md`.

## Production Bundle Deployment

For production deployments installed from a deploy bundle:

```bash
./scripts/deploy.sh
```

This pulls the configured images, applies pending migrations, seeds default
policy data, and restarts the services.

To pin a release, update `LIMINALIS_VERSION` in `.env` before running the
deploy script.

If images are already preloaded on the host, use `./scripts/deploy.sh --skip-pull`.

## Source Checkout Deployment

For deployments built from this repository:

```bash
git pull
scripts/deploy.sh --source-build
```

Then check service status:

```bash
docker compose ps
docker compose logs --tail=100 api
```

## What Must Persist

These must survive upgrades:

- `.env`
- `liminalis-postgres-data`
- `liminalis-storage`

It is safe to rebuild or recreate the `api`, `web`, and `admin` containers.

## Rolling Back

If an upgrade fails:

1. Stop the services.
2. Restore the database, storage volume, and `.env` from the backup made before
   the upgrade.
3. Check out the previous working commit or release.
4. Rebuild and start Compose again.

Database migrations are not always reversible. Restoring the pre-upgrade
database backup is the safest rollback path.
