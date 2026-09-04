#!/usr/bin/env bash
#
# VPS-ке деплой: mebel.studywithraissov.com (209.38.247.103).
#
# Неге скрипт. Қолмен жүргізгенде екі қате оңай жіберіледі, екеуі де 2026-09-04
# жіберілді:
#   1. `.env.local` файлы rsync-пен ҮСТІНЕ ЖАЗЫЛАДЫ — серверде басқа кілт
#      тұрса, ол жоғалады. Сондықтан ол әрқашан ЕСКЕРІЛМЕЙДІ (exclude).
#   2. Контейнерді қайта қосқанда ортаның айнымалылары ЖОҒАЛАДЫ. Сондықтан
#      олар контейнерден емес, СЕРВЕРДЕГІ `.env.local`-дан алынады.
#
# Дерекқор `furniture-data` томында жатыр — контейнер жаңарғанда аккаунт та,
# жобалар да орнында қалады.
set -euo pipefail

HOST="${DEPLOY_HOST:-root@209.38.247.103}"
DIR="${DEPLOY_DIR:-/opt/furniture-configurator}"

echo "→ Код жіберілуде ($HOST:$DIR)"
rsync -az --delete \
  --exclude node_modules --exclude .next --exclude .git --exclude .data \
  --exclude .env.local --exclude tsconfig.tsbuildinfo --exclude dist \
  ./ "$HOST:$DIR/"

echo "→ Образ жиналуда"
ssh "$HOST" "cd $DIR && docker build -q -t furniture-configurator:latest . >/dev/null"

echo "→ Контейнер қайта қосылуда"
ssh "$HOST" "cd $DIR && set -a && . ./.env.local && set +a && \
  docker rm -f furniture-configurator >/dev/null 2>&1 || true; \
  docker run -d --name furniture-configurator --restart unless-stopped \
    -p 172.18.0.1:8096:3000 -v furniture-data:/data \
    -e OPENAI_API_KEY=\"\$OPENAI_API_KEY\" -e DATA_DIR=/data \
    \${BILLING:+-e BILLING=\$BILLING} \
    furniture-configurator:latest >/dev/null"

sleep 6
CODE=$(curl -s -o /dev/null -w '%{http_code}' https://mebel.studywithraissov.com/)
echo "→ Сайт: $CODE"
[ "$CODE" = "200" ] || { echo "✗ Сайт көтерілмеді"; exit 1; }
echo "✓ Дайын. Толық тексеру: npm run test:e2e https://mebel.studywithraissov.com"
