# Backup And Restore

Back up three things together:

1. PostgreSQL data.
2. The `liminalis-storage` Docker volume.
3. The `.env` file.

The database contains records and cryptographic package metadata. The storage
volume contains encrypted file bytes. They should be restored from roughly the
same point in time so database records and stored objects still match.

## Backup

Load deployment variables if you customized database names or users:

```bash
set -a; source .env; set +a
```

Create a backup directory:

```bash
export BACKUP_DIR=backups/$(date +%Y%m%d-%H%M%S)
mkdir -p "$BACKUP_DIR"
```

Dump PostgreSQL:

```bash
docker compose exec -T postgres pg_dump \
  -U "${POSTGRES_USER:-liminalis}" \
  -d "${POSTGRES_DB:-liminalis}" \
  --format=custom \
  > "$BACKUP_DIR/liminalis.postgres.dump"
```

Archive encrypted storage:

```bash
docker run --rm \
  -v liminalis_liminalis-storage:/data:ro \
  -v "$PWD/$BACKUP_DIR":/backup \
  alpine tar czf /backup/liminalis-storage.tgz -C /data .
```

Copy environment secrets:

```bash
cp .env "$BACKUP_DIR/.env"
chmod 600 "$BACKUP_DIR/.env"
```

## Restore

Stop the application:

```bash
docker compose down
```

Restore `.env`:

```bash
cp "$BACKUP_DIR/.env" .env
chmod 600 .env
```

Start PostgreSQL:

```bash
docker compose up -d postgres
```

Restore the database into an empty database:

```bash
docker compose exec -T postgres pg_restore \
  -U "${POSTGRES_USER:-liminalis}" \
  -d "${POSTGRES_DB:-liminalis}" \
  --clean \
  --if-exists \
  < "$BACKUP_DIR/liminalis.postgres.dump"
```

Restore encrypted storage:

```bash
docker run --rm \
  -v liminalis_liminalis-storage:/data \
  -v "$PWD/$BACKUP_DIR":/backup \
  alpine sh -c 'rm -rf /data/* && tar xzf /backup/liminalis-storage.tgz -C /data'
```

Start the instance:

```bash
docker compose up -d
```

If your Compose project name is not `liminalis`, Docker volume names may differ.
Check them with:

```bash
docker volume ls | grep liminalis
```
