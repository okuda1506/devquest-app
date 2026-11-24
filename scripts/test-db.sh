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

docker exec "$container" createdb -U postgres devquest_restore
docker exec "$container" pg_dump -U postgres --format=custom postgres |
    docker exec -i "$container" pg_restore -U postgres --exit-on-error --dbname=devquest_restore

snapshot() {
    docker exec "$container" psql -U postgres --set=ON_ERROR_STOP=1 --tuples-only --no-align --dbname="$1" -c "
        SELECT jsonb_build_array(
            (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM auth.users t),
            (SELECT jsonb_agg(to_jsonb(t) ORDER BY user_id) FROM public.learners t),
            (SELECT jsonb_agg(to_jsonb(t) ORDER BY position) FROM public.quest_order t),
            (SELECT jsonb_agg(to_jsonb(t) ORDER BY user_id, task_id) FROM public.progress t),
            (SELECT jsonb_agg(to_jsonb(t) ORDER BY user_id, task_id, run_id, run_attempt) FROM public.submissions t),
            (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.notifications t)
        )"
}
original=$(snapshot postgres)
restored=$(snapshot devquest_restore)
test -n "$original"
test "$original" = "$restored"
echo 'テスト DB のバックアップを復元し、学習者・課題順・進捗・提出・通知が一致することを確認しました。'
