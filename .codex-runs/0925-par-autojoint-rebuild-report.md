# 0925-par — автоматты буынды қайта есептеу

## Орындалды

- v4 жоба файлына `autoJoints` жазбасы қосылды: екі board id, бет/торц, бекіткіш, рұқсат етілген жанасу қателігі, қол түзету белгісі, күй және өріс аты бар қате. v1–v3 миграциясы бос тізім береді.
- `createAutoJoint`, `rebuildAutoJoints`, `applyAutoJointChange` таза функциялары қосылды. Соңғысы store өзгерістеріне арналған жалғыз адаптер: жаңа root, материал/кромка каталогы, settings, layer немесе бекіткіш түрін бір рет қабылдап, барлық буынды бір операцияда жаңартады. Жанасу жоғалса `broken` және `joint.boardIds` қатесі қалады; жарамсыз тесіктер өндірістік көрініске берілмейді.
- `flattenTree` ерікті `autoJoints` аргументінен тесіктерді ағымдағы геометрияға сай қайта құрып қосады. `BoardSpec.drilling` қол тесіктеріне арналған және өзгермейді. v4 оқылғанда сақталған ескі есеп те қайта есептеледі.
- Бет/торц тесігінің орны, диаметрі және тереңдігі нақты кесілген панель шегінде тексеріледі; торц тесігі қалыңдық ортасында. Қате `board[...].drilling.N.depth/position` немесе `joint.drilling...` өрісімен беріледі.
- Бұрынғы Ø35 cup тест дерегіндегі жиектен 10 мм орын физикалық жарамсыз болғандықтан 22 мм-ге түзетілді.

## Тексеру

- `NODE_OPTIONS=--max-old-space-size=2048 npx vitest run tests/autoJointRebuild.test.ts tests/autoJoint.test.ts tests/projectV4.test.ts tests/boardStore.test.ts tests/configuratorV4.test.ts tests/boardProductionUi.test.ts tests/drillEdits.test.ts --maxWorkers=2`: 7 файл, 54 тест өтті.
- `npm run -s typecheck`: өтті.
- Мутация: тереңдік шегін әдейі 1 мм босаңсытқанда `autoJointRebuild.test.ts` құлады; файл `cp` арқылы қайтарылды.

## Негізгі Codex үшін жалғау

UI компоненттеріне және `store/configurator.ts` файлына бұл бұтақта тимедім: берілген шек тек `src/core`, `tests`, `docs`, `scripts`. Store-дағы `autoJointBoards` жаңадан `applyAutoJointChange(..., { create })` нәтижесін бір `treeEdit`/history қадамына салуы, `editBoard` және `setBoardPosition` нәтижесін `{ root }` арқылы өткізуі, материал/кромка/бекіткіш өзгерістерін сол адаптерге беруі керек. `exportProject`/`loadProject` `autoJoints` өрісін алып жүруі керек. Өндірістік flatten шақырулары бесінші аргументке `autoJoints` беруі керек. Қазір store қосылмағандықтан UI-де автоматты қайта құру әлі іске қосылмайды.
