# 09-visual есебі

Бұтақ: `codex/0924-09-visual`; негізі `efe2366`. Оркестр `codex/0924`-ке merge жасайды. PRO100-дың нақты Properties → Material скриншоты қаралды; экранда General · Material · Reports үш қосымшасы бар. Біздің көрініс баптаулары бөлек RenderPanel ішінде берілді.

## Нәтиже

- ✅ `Material.pbr`: roughness, metalness, reflection, opacity, normal URL/өлшем/бедер күші; Zod шектері және v4 roundtrip. Ескі материал өріссіз ашылады. Normal URL тек `http(s)` қабылдайды; декор коды мен бар `Decor.mapUrl` ережесі өзгермеді.
- ✅ R3F PBR override, normal картаның физикалық мм масштабы, texture келгенде `invalidate()`, texture cleanup және map/normal/physical ауысуына `key`. Normal карта — түстік дерек емес, сондықтан Three.js [MeshStandardMaterial құжатына](https://threejs.org/docs/pages/MeshStandardMaterial.html) сай `NoColorSpace` қойылды.
- ✅ Жобада сақталатын point/spot/sun жарықтары: түс, қарқын, орын/бағыт, Zod, load/export/hydrate/undo және `frameloop=demand` redraw. Бастапқы бекітілген жарық сақталды.
- ✅ Нақты 360° PNG: бір камера орнынан алты 90° WebGL render, куб беттерін 2:1 equirectangular проекцияға түсіру, renderer күйін `finally` қайтару. Суретті созу қолданылмайды.
- ✅ RenderPanel-де PBR және жарық редакторлары, панорама экспорты, қазақша/орысша аударма, тегіс түс пен жиек. Бұрынғы blur алынды. `scripts/e2e.mjs`-ке жаңа сценарий қосылды.
- ✅ `editShop` материалының PBR өзгерісі жобалық материал көшірмесіне таралады. `docs/pro100/parity.md` 09 жолдары нақтыланды.
- ⚠ Сыртқы normal texture URL желіде жүктелмесе, `TextureLoader` қатені PBR редакторына әлі шығармайды; карта көрінбей қалады. Оны кейінгі кезекте UI қатесімен және қайта жүктеу жолымен өңдеу керек.
- ⚠ Chrome/WebGL e2e және `npm run build -- --webpack` агентте жүргізілген жоқ; ноутбук жады ережесіне сай оркестр интеграциядан кейін орындайды. Сондықтан нақты браузер экспорт сапасы мен UI сценарийі әзірге расталмаған.

## Тексеру

- Басында: 176 тест файлы / 1873 тест, typecheck жасыл.
- Соңында: 179 тест файлы / 1888 тест, `NODE_OPTIONS=--max-old-space-size=2048 npm test -- --maxWorkers=2` жасыл; `npm run typecheck` жасыл; `git diff --check` таза.
- RED→GREEN: `tests/visualPbr.test.ts` (PBR көшу/шек/URL/key/shop sync), `tests/visualLights.test.ts` (схема/roundtrip/undo), `tests/panorama.test.ts` (алты бет, seam, таңбаланған UV, renderer қалпына келуі).
- `cp` мутациялары: `materialRenderKey`-ден normal белгісін өшіру → key тесті құлады; panorama U таңбасын терістеу → UV тесті құлады; export-тегі lights-ты босату → lights тесті құлады. Үшеуі де `cp` арқылы қалпына келтірілді.

## Коммиттер

- `c3bc607` — `feat(visual): PBR материал, жоба жарығы және 360° панорама`.
- `docs(visual): 09 есеп пен жоспарды аяқтау` — есеп пен жоспардың соңғы белгілері (осы құжат коммиті).

## Қалған жұмыс және шешім

- Оркестр: merge алдында diff review, әр merge-ден кейін толық test/typecheck; интеграция соңында build және e2e. Browser/WebGL панорама істемесе, 09 бөлігі аяқталды деп белгіленбеуі керек.
- Кейінгі кезек: normal карта желі қатесін пайдаланушыға көрсету; PRO100 AO/жарқыл паритеті бөлек.
- Пайдаланушы шешімін қажет ететін сұрақ жоқ.
