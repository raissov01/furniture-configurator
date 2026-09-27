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

### Қазіргі қолжетімділік

Қазір жергілікті Claude Code клиенті HTTP `Authorization: Bearer` тақырыбымен
немесе дерекқормен бір машинадағы stdio клиенті жұмыс істейді. Claude-тың
қашықтағы custom connector-ы мен ChatGPT бұл серверге қосыла алмайды:
сервер OAuth авторизациясын жарияламайды. Төмендегі Claude Desktop үлгісі
ноутбуктағы қашық серверге жалғанбайды; ол `DATA_DIR`/`DATABASE_URL` арқылы
дерекқорды тікелей оқиды. Оны тек дерекқорға рұқсаты бар машинада қолданыңыз.

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

Дерекқормен бір машинадағы Claude Desktop үшін stdio companion тоғыз құралды
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
көріңіз. Companion HTTP серверін қажет етпейді; ол дерекқорға тікелей кіреді.
Claude Desktop-тың қашықтағы connector-ы үшін бұл конфигурация жарамсыз.

### Қашықтағы Claude connector және ChatGPT

Статикалық веб-сессия bearer токені remote connector авторизациясын
алмастырмайды. [MCP авторизация спецификациясы](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization)
OAuth 2.1, protected resource metadata (RFC 9728), authorization server
discovery (RFC 8414), PKCE, клиентті тіркеу және resource audience тексеруін
талап етеді. Бұл репода OAuth authorization server, тіркеу және цехқа арналған
scope шектеуі жоқ. Сондықтан Claude remote connector мен ChatGPT қосылымын
осы серверге баптамаңыз; сервер жағы аяқталып, жеке қауіпсіздік тесттерінен
өткеннен кейін ғана іске қосыңыз.

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
3. Локальный Claude Desktop stdio companion запускайте только на машине с
   прямым доступом к той же базе. Ноутбук владельца не соединяется через него
   с удалённым сервером.
4. Удалённые коннекторы Claude и ChatGPT сейчас не поддерживаются: отсутствуют
   OAuth 2.1 authorization server, discovery, PKCE, регистрация клиента,
   audience и отдельные права для MCP. Текущий HTTP bearer рассчитан на
   локальное использование с Claude Code.

`get_project` и все производственные инструменты ограничены `shopId` из
проверенной сессии. `shop` и `client` не получают доступ к внутренним ценам
или полному проекту через MCP. Неверный или чужой ID проекта возвращает
одинаковую ошибку «Жоба табылмады».
