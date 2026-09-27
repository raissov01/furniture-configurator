# 03e2b — Классикалық интерфейс аудитін түзету жоспары

Дерек: `.codex-runs/design-audit-0926/REPORT.md` және нақты PRO100 v7.08 скриншоттары. Өндірістік геометрия мен баға формуласын өзгертпейміз. Жұмыс бір worktree-де жасалады; `codex/0924`-ке тек жасыл тексерістен кейін біріктіріледі.

## Интеграция және бастапқы күй

- [x] Үзілген 03e2b жұмысын, құжаттарды, `codex/0924` бастапқы 244 файл / 2433 тест пен typecheck-ті тексеру.
- [x] `claude/classic-ui-p0`, `codex/0925-par`, `claude/aismebel-rebrand`, `claude/default-prices` бұтақтарын diff-ке қарап, қақтығысты шешіп, әрқайсынан кейін толық тест пен typecheck жүргізу.
- [x] PRO100-дың нақты Properties General · Material · Reports үш қойындысын қарау; төртінші Production — біздің өнімнің бөлек жолы.

## P0 браузер регрессиясы

- [ ] `scripts/e2e-classic-audit.mjs`: экспорт мәзірінің файл жүктеуі, турдың жабылуы, Properties backdrop/Enter/Esc/қате/Apply, disabled белгіше, тіл/тема/баға/аккаунт.
- [ ] Қате табылса: алдымен құлайтын сценарий, кейін `components/Workspace.tsx`, `components/Tour.tsx`, `components/PropertiesDialog.tsx` не CSS-та түбірлік түзету.

## P1 — басу ыңғайлылығы және терезе

- [ ] Классикалық батырма күйлері (hover, pressed, checked, disabled, focus), таңдалған материал жиектемесі. `app/globals.css`, `tests/classicIconStates.test.ts`, e2e.
- [ ] Мәзір семантикасы мен перне/hover ауысуы; ұзын пункттердің бөлінбеуі. `components/ui.tsx`, `components/Workspace.tsx`, e2e.
- [ ] Қауіпті «Сброс» растауы және «Свойства» әрекетінің мәзір/құрал жолындағы орны. `components/Workspace.tsx`, i18n, e2e.
- [ ] Properties General өлшемі/реті, тұрақты биіктік, 1366×768-де ≤80% және Esc-пен жабылатын басқа диалогтар. `components/Configurator.tsx`, `app/globals.css`, e2e.
- [ ] Сахнадағы ақпараттың орынды жылжытпауы, Structure ағашының ашылғанда көрінуі, өлі «Камера 1» тақтасының тағдыры. `components/Workspace.tsx`, `app/globals.css`, e2e.
- [ ] Дубль белгішелер, қысқартулар, контекст мәзірі, таңдау синхроны, i18n және мобиль 390×844. Нақты ақауды растағаннан кейін жеке шағын коммиттер.

## Тексеру және есеп

- [ ] Әр маңызды pure тест үшін `cp` арқылы сақтап, әдейі бұзу → қызыл → `cp` арқылы қайтару.
- [ ] `npm test` (`npx vitest run --maxWorkers=3`) және `npm run typecheck`; UI үшін `npm run build -- --webpack`, бұрынғы және жаңа e2e бір dev серверде кезекпен.
- [ ] 1920×1080, 1366×768, 390×844 before/after және батырма күйлері кадрлары; бәсекелес PNG-і коммитке кірмейді.
- [ ] Өз diff-іне ревью, `.codex-runs/0924-03e2b-classic-ui-fixes-report.md`, `codex/0924`-ке `merge --no-ff`, интеграция тесті, worktree тазалау.

Аудит көлемі бір кезекке сыймаса, аяқталған бөлікті нақты нәтижесімен біріктіріп, қалған тармақты есепте файл/себеп бойынша көрсетеміз.
