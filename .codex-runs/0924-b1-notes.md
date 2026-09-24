# 2026-09-24 B1 — жеңілдік

- Бастапқы күй: `PriceOverrides` тек `coefficient` және `salePrice`; `pricing.ts`, `QuoteView.tsx`, `quotePdf.ts` файлдарында жеңілдік есебі жоқ. Граф картасы: `graphify-out/GRAPH_REPORT.md` Pricing (core), Cut Page & Quote View, Quote Pdf қауымдары.
- API: `PriceOverrides.lineDiscounts` кілті `materials:<id>` / `edges:<id>` / `hardware:<id>` / `services:<id>`; `overallDiscount`. Екеуі де `{kind:'percent'|'amount', value}`. Жоба нұсқасы өзгермейді; optional өрістерді `PriceOverridesSchema` және store сақтайды. Ағаш v4 merge кезінде осы ортақ schema өрістері сақталуы керек.
- Есеп реті: `calculatedTotal` цех есебі болып қалады; `salePrice` берілсе `grossTotal` болады; әр позиция жеңілдігі сол `PriceLine.cost` негізінде есептеліп, `grossTotal`-дан шегеріледі; жалпы жеңілдік осы қалдыққа қолданылады. `total = grossTotal − lineDiscountTotal − overallDiscountAmount`. Жеңілдік негізден асса `ConfigValidationError`.
- `DISCOUNT_ROUNDING_RULE`: әр пайыздық жеңілдік тиынға дәл жартысы жоғары дөңгелектенеді. Ондық пайызды `BigInt` бөлшегіне айналдырамыз, себебі float `5000 × 0.57%` нәтижесін 28.4999… деп есептейді. Ақша бүтін тиын; экран/PDF тиын қалдығын көрсетеді.
- Қолмен сату бағасы бар клиент КП-сына материал/қызмет жолдары мен өзіндік құн/коэффициент кірмейді. Цех сметасында олар қалады; PDF-та `ВСЕГО / СКИДКА / К ОПЛАТЕ` шығады.

## TDD

- Алғашқы 6 тесттің 6-уы red: жолдық %, жолдық сома, қолмен баға, validation, overflow, persistence. Кейін `quoteLineGroups` үшін 2 red; тиын форматы үшін 1 red; review түзетуінде decimal half-up/schema/unsafe salePrice үшін 3 red.
- Green: `npm test` — 126 файл, 1489 тест; `npm run typecheck` — таза.
- Мутация 1: пайыздық есеп `Math.round → Math.floor`, 351852 орнына 351851; тест құлады.
- Мутация 2: жалпы жеңілдік `remaining` орнына `grossTotal`, екі тест құлады (490000 орнына 500000 т.б.).
- Мутация 3: `quoteLineGroups` қолмен бағаның шартын кері аудару, екі confidentiality тесті құлады.
- Мутация 4: `formatTengeExact` тиын қалдығын нөлдеу, 123,45 орнына 123; тест құлады.
- Мутация 5: BigInt half-up орнына floor, `5000 × 0.57%` 29 орнына 28; екі тест құлады. Барлық мутацияға дейін `cp` backup жасалып, одан кейін `cp` арқылы қайтарылды.

## Merge ескертпесі

- Жаңа dependency жоқ. `ProjectFile` құрылымы/schemaVersion өзгерген жоқ; тек ортақ `PriceOverridesSchema` кеңейді. A v4 өзгерісін біріктіргенде optional `priceOverrides` сақталатынын қарау керек.
- `lineDiscounts` материалдың тұрақты id-іне байланған; B4 прайс-парақ ауыстырғанда id сақталса жеңілдік те сақталады. Жол өшсе priceProject path/range қатесін көрсетеді, UI error блогында сол жол жеңілдігін өшіру батырмасы бар.
