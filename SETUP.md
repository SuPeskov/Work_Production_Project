# Развёртывание базы знаний «Скаут Хаус» на VPS Reg.ru (Ubuntu 26.04 LTS)

## Архитектура
```
Браузер ──HTTPS──> Nginx (443) ──> Node.js/Express (127.0.0.1:3000)
                                      ├── SQLite (users, read_log — журнал ознакомлений)
                                      └── static ./public (HTML/CSS/JS сайта)
```
Вся проверка прав и запись отметок «Ознакомлен» выполняется **на сервере**.
Пароли — только bcrypt-хеши; сессия — JWT в httpOnly-cookie (недоступен JS).

## Шаг 0. Покупка (в панели Reg.ru)
- VPS линейки **«Виртуальные VPS»** (или Облачные): 1 vCPU / 2 GB RAM / SSD ~20 ГБ, ОС **Ubuntu 26.04 LTS**;
- **публичный IPv4** (плавающий);
- домен + **A-запись** домена на IP VPS (DNS Reg.ru или свои NS).

## Шаг 1. Первый вход на сервер (с вашего компьютера)
```bash
ssh root@151.248.116.243        # пароль — из письма Reg.ru
adduser kbapp && usermod -aG sudo kbapp   # рабочий пользователь без root
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw enable
```

## Шаг 2. ПО
```bash
apt update && apt install -y curl git nginx gnupg
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt install -y nodejs
node -v   # ожидается v22.x
```

## Шаг 3. Код проекта
Рекомендуется SSH Deploy Key (без токенов):
```bash
ssh-keygen -t ed25519 -f /root/.ssh/deploy_key -N ''
cat /root/.ssh/deploy_key.pub   # содержимое добавить на GitHub:
# Settings repo -> Deploy keys -> Add deploy key (Read-only)
echo -e "Host github.com\n  IdentityFile /root/.ssh/deploy_key\n  User git" >> /etc/ssh/ssh_config
git clone git@github.com:SuPeskov/Work_Production_Project.git /opt/scout-kb
```
(Либо однократно: `printf 'TOKEN' > /root/.github_token; chmod 600 /root/.github_token; bash /opt/scout-kb/server/deploy.sh` — скрипт сам удалит файл токена.)

Если клонирован репозиторий без папки server/public — скопируйте структуру из этой ветки (server/, public/) в /opt/scout-kb.

## Шаг 4. Настройка приложения
```bash
mkdir -p /opt/scout-kb/public
# перенести статику сайта в public (deploy.sh делает это автоматически)
cd /opt/scout-kb/server && npm ci --omit=dev
openssl rand -hex 32   # сгенерировать секрет
cat > /etc/scout-kb.env << EOF
KB_JWT_SECRET=<сюда 64-символьный hex>
KB_DB_PATH=/var/lib/scout-kb/kb.sqlite
PORT=3000
KB_SECURE_COOKIE=1
