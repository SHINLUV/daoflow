#!/usr/bin/env bash
set -euo pipefail

psql -v ON_ERROR_STOP=1 <<'SQL'
create schema if not exists daoflow_ops;
create table if not exists daoflow_ops.schema_migrations (
  filename text primary key,
  checksum text not null,
  applied_at timestamptz not null default now()
);
revoke all on schema daoflow_ops from public, anon, authenticated;
SQL

for migration in /migrations/*.sql; do
  filename="$(basename "$migration")"
  checksum="$(sha256sum "$migration" | awk '{print $1}')"
  existing="$(psql -v ON_ERROR_STOP=1 -Atc "select checksum from daoflow_ops.schema_migrations where filename = '$filename'")"

  if [[ -n "$existing" ]]; then
    if [[ "$existing" != "$checksum" ]]; then
      echo "Refusing changed migration: $filename" >&2
      exit 1
    fi
    echo "Already applied: $filename"
    continue
  fi

  echo "Applying: $filename"
  psql -v ON_ERROR_STOP=1 -1 -f "$migration"
  psql -v ON_ERROR_STOP=1 -c "insert into daoflow_ops.schema_migrations(filename, checksum) values ('$filename', '$checksum')"
done
