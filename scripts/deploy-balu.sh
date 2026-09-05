#!/usr/bin/env bash
#
# Балу-фит VPS-іне деплой: mebel.balu-fit.com (85.137.91.47).
#
# Неге бөлек скрипт (`deploy.sh` DO дроплетіне арналған): бұл машинада
# төлемді клиенттердің боттары тұр, сондықтан образ ОСЫ ЖЕРДЕ жиналмайды —
# билдтің RAM шыңы 2 vCPU / 3.7 GiB машинаны шайқалтуы мүмкін. Жергілікті
# жиналған образ `docker save | ssh docker load` арқылы тасылады.
#
# ⚠ `.env.local` (OPENAI_API_KEY) серверде ҚАЛАДЫ, әр деплойда үстіне
# жазылмайды — жоғалмауы үшін.
set -euo pipefail

HOST="${BALU_HOST:-root@85.137.91.47}"
DIR="${BALU_DIR:-/opt/furniture-configurator}"
IMAGE="furniture-configurator:latest"

echo "→ Образ жергілікті жиналуда"
docker build -q -t "$IMAGE" . >/dev/null

echo "→ Образ тасылуда ($HOST)"
docker save "$IMAGE" | gzip | ssh "$HOST" "gunzip | docker load" >/dev/null

echo "→ Контейнер қайта қосылуда"
ssh "$HOST" "
  docker rm -f furniture-configurator >/dev/null 2>&1 || true
  docker run -d --name furniture-configurator --restart unless-stopped \
    -p 127.0.0.1:8096:3000 -v furniture-data:/data \
    --env-file $DIR/.env.local -e DATA_DIR=/data \
    $IMAGE >/dev/null
"
sleep 5
CODE=$(ssh "$HOST" "curl -s -o /dev/null -w '%{http_code}' --max-time 8 http://127.0.0.1:8096/configurator")
echo "→ Ішкі тексеру: $CODE"
[ "$CODE" = "200" ] || { echo "✗ Контейнер көтерілмеді"; exit 1; }
echo "✓ Дайын. Сыртқы тексеру: curl -I https://mebel.balu-fit.com/configurator"
