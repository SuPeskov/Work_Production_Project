#!/usr/bin/env bash
# deploy.sh — безопасный деплой кода с GitHub без токенов в чатах.
# Выполняется НА VPS от root. Токен читается из файла /root/.github_token (chmod 600),
# который создаёте вы лично один раз.
set -euo pipefail
APP_DIR=/opt/scout-kb
TOKEN=$(cat /root/.github_token)
REPO="SuPeskov/Work_Production_Project"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull --ff-only "https://x-access-token:${TOKEN}@github.com/${REPO}.git" main
else
  git clone --depth 1 "https://x-access-token:${TOKEN}@github.com/${REPO}.git" "$APP_DIR"
fi
rm -f /root/.github_token   # токен не хранится дольше момента клонирования
mkdir -p "$APP_DIR/public"
shopt -s dotglob
for f in "$APP_DIR"/*; do
  base=$(basename "$f")
  [ "$base" = "public" ] || [ "$base" = "server" ] || [ "$base" = ".git" ] || cp -r "$f" "$APP_DIR/public/"
done
shopt -u dotglob
cd "$APP_DIR/server" && npm ci --omit=dev
systemctl restart scout-kb
echo "DEPLOY OK: $(git -C "$APP_DIR" rev-parse --short HEAD)"
