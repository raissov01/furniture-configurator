# Bluetooth бирка принтері: зерттеу және мок

`lib/mobile/labelPrinter.ts` ішіндегі `LabelPrinter` келісімі және `MockLabelPrinter` QR payload пен көшірме санын аппаратсыз тексереді. Мок пакет жібермейді, басып шығарылды деп көрсетпейді; тесттегі receipt тек `simulated`.

Қазіргі QR бирка PDF/CSV цех принтерінде басыла алады. Тікелей Bluetooth басып шығару үшін принтердің нақты моделі, қағаз өлшемі, командалар хаттамасы, қайта қосылу және қате мәртебелері қажет. Бұл деректерсіз NIIMBOT немесе басқа модельдің пакеттерін ойдан жасауға болмайды. [Brother Mobile SDK](https://support.brother.com/g/s/es/htmldoc/mobilesdk/) және [Zebra Link-OS Android SDK](https://developer.zebra.com/blog/learning-how-get-started-linkos-android-sdk) ресми native бағыттарды береді; нақты құрылғы таңдалғанда сол өндірушінің лицензиясы мен API-ы тексеріледі. [Web Bluetooth](https://developer.chrome.com/docs/capabilities/bluetooth) generic GATT қатынауын береді, бірақ бирка пішімін немесе принтер хаттамасын анықтамайды.

Келесі аппараттық қадам: модельді бекіту, өндіруші нұсқаулығын алу, 58×40 мм және үлкенірек биркада QR оқылуын сынау, mock келісімін нақты драйвермен алмастыру. Бұл кезекте тікелей Bluetooth басу аяқталмаған.
