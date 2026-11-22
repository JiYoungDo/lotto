#!/usr/bin/env bash
# DB 백업: 앱을 잠깐(몇 초) 멈추고 DB 폴더를 압축한 뒤 다시 켭니다. (켜져 있는 DB 파일을 복사하면 깨질 수 있어서)
# 사용: 프로젝트 폴더에서  bash deploy/backup.sh   (cron에 등록하면 매일 자동)
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p backups

docker compose stop app
CID="$(docker compose ps -a -q app)"
docker run --rm --volumes-from "$CID" -v "$PWD/backups:/backup" alpine \
  tar czf "/backup/lotto-$(date +%F-%H%M).tar.gz" -C /app data
docker compose start app

# 14일 지난 백업은 지운다
find backups -name 'lotto-*.tar.gz' -mtime +14 -delete
echo "백업 완료: $(ls -t backups | head -1)"
