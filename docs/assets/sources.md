# Өндіруші активтерінің дереккөздері

2026-09-25 күнгі дайын зерттеу: `.codex-runs/lite/assets/sources.md` (негізгі ағашта). Бұл құжат өзекке енгізілген құқық шешімін қысқаша тіркейді. Декор коды, атауы, өлшемі сияқты фактілер мен сурет/3D файлға құқық бөлек қаралады. Репода өндіруші активінің файлы жоқ.

| Өндіруші | Не береді / формат | Ашық шарттың SaaS үшін мәні | Коммерциялық қолдану және алу жолы |
|---|---|---|---|
| [EGGER](https://www.egger.com/en/furniture-interior-design/decorative-collection/planning-and-visualization?country=US) | Декор суреті, CAD/BIM, VDS | [Сурет шарты](https://downloads.egger.com/static/group/GTC_Image_Video_Usage_2021_EN.pdf?country=XK) EGGER өнімімен байланысты жарнама және атрибуция шеңберін белгілейді; көп клиентті CDN кітапханасына ашық рұқсат жоқ. | Шартпен, SaaS үшін жеке келісім қажет; myEGGER тіркелуі керек, ашық API көрсетілмеген. |
| [Kronospan](https://www.kronospan.com/en_HU/decors/) | Онлайн декор суреттері | [Сайт шарты](https://kronospan.com/terms_and_conditions/files/Terms-Conditions-202501.pdf) жеке, коммерциялық емес пайдалануды ғана әдепкі рұқсат етеді. | Жазбаша рұқсатсыз сурет алуға болмайды; ресми бетке сілтеме ғана. |
| [Kastamonu](https://www.kastamonuentegre.com/tr_tr/sen-tasarla) | Каталог, 3D визуализатор | [Сайт шарты](https://www.kastamonuentegre.com/fr/page/conditions-dutilisation) көшіру/тарату үшін жазбаша рұқсат сұрайды. | Жазбаша рұқсатсыз актив алынбайды; ашық API табылмаған. |
| [Lamarty](https://www.lamarty.ru/lamarty/promo/all_Lamarty_decors.html) | 3D бағдарламасына арналған декор суреттері, БАЗИС архиві | Жүктеуге мүмкіндік бар, бірақ SaaS-та қайта тарату лицензиясы анықталмаған. | Шарт белгісіз; өндіруші бетіне сілтеме, жазбаша келісім қажет. |
| [Увадрев](https://www.uvadrev.ru/) | Декор каталогы, веб-визуализатор | Активті бөлек SaaS-та сақтау/тарату шарты жарияланбаған. | Шарт белгісіз; ресми бетке сілтеме, жазбаша келісім қажет. |
| [Blum](https://www.blum.com/ca/en/services/planning-construction-product-selection/productdata-service/) | CAD/CAM, 2D/3D, BXF, Product Data Service | Өндірістік жоспарлау және software partner интеграциясы қолдау табады, бірақ көп клиентті файл кітапханасы үшін келісім керек. | Шартпен; Product Data Service немесе CAD қызметі арқылы сұрау. |
| [Hettich](https://www.hettich.com/en-ca/services-1/hettich-cad) | 2D/3D CAD, монтаж сызбасы | [Жүктеу шарты](https://diy.hettich.com/en-gb/terms-of-use/terms-of-use-for-downloads) өз бизнесіндегі Hettich өнімін таныстырумен шектеледі; өзгеге таратуға жалпы рұқсат емес. | Шектеулі; SaaS үшін жеке рұқсат керек. |
| [GTV](https://gtv-rus.com.ru/wsparcie-3-ru/biblioteka-3d-modelej-bazis-mebelshchik) | БАЗИС/TopSolid 3D кітапханалары | Ашық жүктеу қайта тарату лицензиясын білдірмейді. | Шарт белгісіз; өндіруші бетіне сілтеме ғана. |
| [BOYARD](https://www.boyard.biz/3d_models) | 3D кітапхана: OBJ, FBX, STL, DWG, 3DS | Сайт архив береді, коммерциялық SaaS-та сақтау/тарату құқығын нақты бермейді. | Шарт белгісіз; өндіруші бетіне сілтеме ғана. |

## Өзектегі байланыс

`OwnMaterialMeta.textureSource` әр материалға міндетті. Қазір ол ресми `manufacturer-page` немесе `none`; бұл екеуінде `imageUrl` жоқ. `resolveTextureSource` өндіруші + декор коды + бет құрылымы дәл келген және `TextureGrantSchema` қабылдаған жазбаны ғана `licensed-image` етеді. Грантта HTTPS сурет/шарт URL-і, лицензия идентификаторы, атрибуция және `saas-display` рұқсаты міндетті. Қазіргі `MANUFACTURER_TEXTURE_GRANTS` бос: дайын зерттеу көп клиентті SaaS-қа жарайтын бірде-бір сурет грантын растамады. Грантты қосар алдында оның жазбаша шарты сақтау, кэштеу, өзгерту, клиентке көрсету және қайтарып алу тәртібін қамтуы керек.

`SolidSpec.modelSource` фурнитура артикуласына ресми модель бетінің сілтемесін сақтайды (`manufacturer-page`, `licenseStatus: unverified`). `licensed-model` түрі үшін модель URL-і, формат, лицензия URL/идентификаторы және атрибуция міндетті. Сілтеме `ProjectFileV4` арқылы сақталады; көрініс пен файл жүктеу UI-ы бөлек жасалады. Өндірушінің STEP/OBJ файлы автоматты түрде жүктелмейді және репоға кірмейді.
