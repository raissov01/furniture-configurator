# iOS: AisMebel өлшеу қабығы

`ios/` — Capacitor жасаған Xcode жобасы. Ол `native/` ішіндегі ортақ өлшеу UI-ын және жергілікті активті қолданады. iOS-та Text Mode пернетақта ретінде жұптасқан Leica DISTO D5 мәтіні ғана қабылданады; Web Bluetooth/GATT не принтер драйвері бұл жинақта жоқ.

## Mac-та жинау

1. Mac-та Node 22, Xcode және [Capacitor iOS талаптарын](https://capacitorjs.com/docs/ios) орнату. `npm ci`.
2. `npm run icons:native && npm run cap:sync`.
3. `npx cap open ios`, Xcode-да `ios/App/App.xcodeproj` ашу.
4. Signing & Capabilities бөлімінде өз Apple Developer Team, бірегей Bundle ID және provisioning profile таңдау. Физикалық iPhone-да өлшем, фото, қолданбаны қайта ашу және тіл ауыстыруды тексеру.
5. Release scheme-мен Archive жасап, App Store Connect-ке жүктеу; [TestFlight](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/) ішкі/сыртқы тестерлерімен сынау. Бұл Linux ортада Xcode жоқ, сондықтан iOS binary мен TestFlight жүктемесі мұнда жасалмайды.

[Apple Developer Program](https://developer.apple.com/programs/) мүшелігі, App Store Connect қолданбасы, signing және [App Privacy](https://developer.apple.com/help/app-store-connect/reference/app-privacy/) жауаптары қажет. Жария `/privacy` URL-ы, оператордың нақты байланысы және сервердегі сақтау мерзімі нақтыланбайынша App Store submission жасалмайды.

Store мәтіні Android құжатындағы kk/ru сипаттамаға сәйкес болуы керек: native қолданба тек офлайн өлшеу қабығы; толық 3D редактор вебте. iOS скриншоттары осы қолданбадан алынады. Apple құрылғысында камера және Bluetooth HID тесті жасалмағанша D5 жұмысын жария түрде кепілдеуге болмайды.
