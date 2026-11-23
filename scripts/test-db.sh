#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
container=$(docker run --rm -d -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16-alpine)
trap 'docker stop "$container" >/dev/null' EXIT
for attempt in {1..30}; do
  if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres >/dev/null; then
    break
  fi
  sleep 1
done
for file in supabase/tests/bootstrap.sql supabase/migrations/*.sql supabase/tests/progress.sql; do
  docker exec -i "$container" psql -U postgres --set=ON_ERROR_STOP=1 --quiet < "$file"
done
