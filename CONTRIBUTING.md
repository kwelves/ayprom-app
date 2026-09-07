# Contributing

Работайте через небольшие тематические изменения. Не коммитьте фотографии клиентов, локальные настройки, installers, .tmp или node_modules.

## Проверки

```powershell
npm ci
npm run typecheck
npm test
npm run build
node scripts/qa.mjs
npm run package
node scripts/qa.mjs "release/win-unpacked/AyProm Photo Processor.exe"
```

При изменениях processing используйте реальные локальные fixtures и npm run regression -- <folder>. Сверяйте decoded RGBA, а не только байты PNG. Синтетические тесты не заменяют фото.

Не меняйте watermark, crop/alpha, normalize/CLAHE, sharpening, highlights или порядок стадий без отдельно описанной задачи и доказательств регрессии. Полный reference находится в коммите cfa8c91; второй runtime engine создавать нельзя.

Новый код — strict TypeScript. Heavy processing только в utility process; не расширяйте preload произвольными fs/shell/exec API. Пресеты не содержат пути. Изменение schemaVersion требует явной миграции и тестов.

В PR опишите поведение, проверки и ограничения. Выпуски не должны утверждать проверку installer, реальных фото или подписи, если её не было.
