#!/usr/bin/env bash
set -euo pipefail

base_dir="${DAOFLOW_BASE_DIR:-/opt/daoflow}"
release_dir="${DAOFLOW_RELEASE_DIR:-$base_dir/current}"
backup_dir="$base_dir/backups/postgres"
compose_file="$release_dir/ops/production/stack.compose.yml"
env_file="$base_dir/shared/stack.env"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
destination="$backup_dir/daoflow-$timestamp.dump"
temporary="$destination.partial"

install -d -m 0700 "$backup_dir"
umask 077

docker compose --project-name daoflow --env-file "$env_file" -f "$compose_file" \
  exec -T db pg_dump -U supabase_admin -d postgres --format=custom --no-owner --no-privileges > "$temporary"

docker compose --project-name daoflow --env-file "$env_file" -f "$compose_file" \
  exec -T db pg_restore --list < "$temporary" >/dev/null
mv "$temporary" "$destination"
find "$backup_dir" -maxdepth 1 -type f -name 'daoflow-*.dump' -mtime +14 -delete

echo "Postgres backup verified: $destination"
