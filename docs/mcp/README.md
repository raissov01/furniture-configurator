# AisMebel MCP / MCP для AisMebel

## Қазақша

MCP цех иесіне тоғыз құрал береді: `create_project_from_text`, `get_quote`,
`get_cut_list`, `compute_nesting`, `search_materials`, `get_drilling`,
`validate_config`, `list_projects`, `get_project`. Әр нәтиже сол жоба ағашының
`Panel[]` дерегінен есептеледі. Өлшемдер бүтін миллиметр; шкаф габариті әрқашан
`H × W × D` ретімен, мысалы `2000 (H) × 600 (W) × 450 (D)`.
Ақша сақталғанда тиын, жауаптағы оқылатын сома ₸ түрінде болады. Бағасы жоқ
позициялар `get_quote.missingPrices` ішінде көрсетіледі; оларды толықтырмай
клиентке КП жібермеңіз.

### Іске қосу және токен

`npm ci` жасаңыз. MCP бөлек Node рөлі ретінде жұмыс істейді; қолданба мен MCP
бірдей `DATA_DIR` не `DATABASE_URL` қолдануы керек. Әдепкі HTTP адресі
`127.0.0.1:3100/mcp`; сырттан қолжетімді ету үшін HTTPS reverse proxy және
`MCP_HOST`/`MCP_PORT` баптаңыз. Жариялау бұл репода жасалмаған.

```sh
DATA_DIR=/absolute/path/to/app-data npm run mcp:serve
```

Цехтың `owner` немесе `designer` аккаунтымен токен алыңыз. Құпиясөз команда
тарихына жазылмайды; файлға тек 30 күндік сессия токені түседі:

```sh
umask 077
printf 'Password: ' >&2; read -rs MCP_PASSWORD; printf '\n' >&2
printf '%s' "$MCP_PASSWORD" | DATA_DIR=/absolute/path/to/app-data npm run -s mcp:token -- owner@example.kz > "$HOME/.aismebel-mcp-token"
unset MCP_PASSWORD
chmod 600 "$HOME/.aismebel-mcp-token"
```

Токенді `Authorization: Bearer <token>` ретінде беріңіз. Cookie, URL параметрі
және өзге цехтың жоба ID-сі қабылданбайды. Мерзімі өтсе жаңа токен алыңыз;
осы токенді қайтару үшін `npm run -s mcp:token -- --revoke "$HOME/.aismebel-mcp-token"`
шақырыңыз. Сервер origin тақырыбын әдепкіде
бұғаттайды; браузер клиенті керек болса `MCP_ALLOWED_ORIGINS` ішінде рұқсат
етілген origin тізімін үтірмен беріңіз.

### Claude Desktop

Жергілікті Claude Desktop үшін реподағы stdio companion бірдей тоғыз құралды
ресми SDK арқылы жариялайды. `claude_desktop_config.json` ішіндегі `mcpServers`
бөлігіне абсолют жолдарды қойыңыз:

```json
{
  "mcpServers": {
    "aismebel": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/furniture-configurator/scripts/mcp-stdio.ts"],
      "env": {
        "DATA_DIR": "/absolute/path/to/app-data",
        "MCP_TOKEN_FILE": "/absolute/path/to/.aismebel-mcp-token"
      }
    }
  }
}
```

Claude Desktop-ты қайта ашып, `list_projects` және `search_materials` шақырып
көріңіз. Жергілікті companion HTTP серверін қажет етпейді; екеуі бір құралдар
тізбегін және бір дерекқорды қолданады. Claude Desktop-тың жергілікті MCP
механизмі remote connector-дан бөлек екені [Claude Help Center-де](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)
түсіндірілген.

### ChatGPT

ChatGPT-тің қашықтағы жеке MCP қосқышы үшін жай статикалық bearer токені
жеткіліксіз. [OpenAI-дың ресми auth нұсқаулығы](https://developers.openai.com/plugins/build/auth)
OAuth 2.1 authorization code + PKCE, protected resource metadata және
authorization server discovery талап етеді. Бұл репода ондай OAuth provider
жоқ, сондықтан осы нұсқаны ChatGPT Plugins тізіміне **тікелей қосу әлі
мүмкін емес**. Кейін OAuth provider қосылып, `/mcp` HTTPS арқылы ашылғанда,
[ресми қосу қадамдары](https://developers.openai.com/plugins/deploy/connect-chatgpt)
бойынша Settings → Security and login → Developer mode, содан кейін Plugins →
Add → сервердің `https://…/mcp` адресін енгізіңіз. Бұл жерде ештеңе
деплойланбаған.

## Русский

Сервер использует официальный TypeScript MCP SDK и существующие расчёты ядра:
детали, раскрой, сверление и смета получают панели из одного дерева проекта.
Размеры — целые миллиметры и всегда в порядке `H × W × D`, например
`2000 (H) × 600 (W) × 450 (D)`. Деньги хранятся в тиынах; суммы в ответах
форматируются в ₸. `missingPrices` означает, что коммерческое предложение
пока нельзя выдавать клиенту как окончательное.

1. Установите зависимости `npm ci`; задайте тот же `DATA_DIR` или
   `DATABASE_URL`, что у приложения.
2. Выпустите токен командой выше для роли `owner` или `designer` и храните
   файл с правами `600`. Срок действия — 30 дней.
3. Для Claude Desktop добавьте локальный stdio companion из примера выше.
   Он использует токен из файла и ту же базу. Для прямого удалённого MCP
   запустите `npm run mcp:serve`, настройте HTTPS и OAuth через внешний
   авторизационный слой.
4. Для ChatGPT сначала нужен полноценный OAuth 2.1 provider с discovery и
   PKCE. Текущий bearer сервер напрямую в ChatGPT Plugins не подключается;
   требования и шаги подключения приведены в [официальной документации
   OpenAI](https://developers.openai.com/plugins/build/auth).

`get_project` и все производственные инструменты ограничены `shopId` из
проверенной сессии. `shop` и `client` не получают доступ к внутренним ценам
или полному проекту через MCP. Неверный или чужой ID проекта возвращает
одинаковую ошибку «Жоба табылмады».
