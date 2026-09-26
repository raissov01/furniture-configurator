#!/usr/bin/env bash
set -euo pipefail
mkdir -p docker/secrets
for name in postgres_password session_secret minio_password; do
  if [ ! -f "docker/secrets/$name" ]; then
    openssl rand -hex 32 > "docker/secrets/$name"
    chmod 600 "docker/secrets/$name"
  fi
done
if [ ! -f docker/secrets/openai_key ]; then
  : > docker/secrets/openai_key
  chmod 600 docker/secrets/openai_key
fi
