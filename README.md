# AyProm Photo Processor

Локальное Windows-приложение для приведения товарных фотографий к единому виду. Electron + React + TypeScript + Tailwind + Sharp. Обработка выполняется полностью на устройстве: без аккаунтов, серверов, телеметрии и отправки фотографий.

## Возможности

- Очередь нескольких папок, drag & drop папок и изображений, рекурсивное сканирование.
- Встроенный AyProm Standard и пользовательские пресеты: создание, дублирование, переименование, сохранение, сброс.
- Ручная настройка реальных параметров движка и автоматическое сравнение до/после.
- PNG, JPEG с выбранным фоном, WebP с прозрачностью и режимом без потерь.
- Отдельная папка результата с сохранением структуры; опционально сохранение рядом с источником.
- Пропуск, уникальное имя или перезапись результатов. Исходники защищены.
- Отмена после текущего файла, изоляция ошибок, отчёт и история 30 операций.
- Светлая, тёмная и системная тема. Presets/settings сохраняются в Electron userData.

## Скачать

Windows Setup и Portable публикуются на [странице Releases](https://github.com/kwelves/ayprom-app/releases). Наличие собранных файлов в локальном release/ не означает, что выпуск уже опубликован.

Setup: запустите AyProm-Photo-Processor-Setup-VERSION.exe, выберите каталог установки в мастере. NSIS создаёт пункт удаления и ярлыки. Node.js, npm и инструменты разработки пользователю не нужны.

Portable: запустите AyProm-Photo-Processor-Portable-VERSION.exe. Установка не требуется; настройки сохраняются в профиле Windows, а не рядом с exe.

Сборки без сертификата не подписаны и могут вызвать предупреждение Windows SmartScreen. Проверяйте источник загрузки; глобально отключать SmartScreen/Defender не требуется.

## Работа

1. Добавьте папки.
2. Выберите AyProm Standard или свой пресет.
3. Выберите отдельную папку результата.
4. Выберите PNG, JPEG или WebP.
5. Нажмите «Обработать».

Ручная настройка применяет текущие параметры ко всей очереди. Если очередь пуста, можно обработать выбранное для preview изображение. Приложение не удаляет фон: эталон рассчитан прежде всего на исходники с уже прозрачным фоном.

Несохранённые черновики пресетов сохраняются при переключении внутри сессии. Перед закрытием используйте «Сохранить» или «Сохранить как…».

## Development

Требуется Windows x64, Node.js 24 и npm.

```powershell
npm ci
npm run typecheck
npm test
npm run dev
```

Dev сначала собирает файлы, затем открывает Electron. Приложение загружает локальный HTML через file://; localhost-сервер не используется. После изменения кода перезапустите команду.

```powershell
npm run build
npm run package:dir
npm run package
node scripts/qa.mjs
node scripts/qa.mjs "release/win-unpacked/AyProm Photo Processor.exe"
```

UI QA использует настоящие Electron main/preload/utility/Sharp; ответы выбора папок подставляет тест. Это не проверка взаимодействия человека с native dialog или реального OS drag gesture. Синтетические файлы и скриншоты остаются в игнорируемой .tmp/.

## CLI

```powershell
node "C:/path/to/ayprom-app/enhance-product-photos-folder-for-all.mjs" --input="D:/Products" --output="D:/Processed" --format=png
```

Старые processing-флаги сохранены: --canvas, --fill, --alpha-threshold, --padding, --sharpen-min, --sharpen-max, --highlight-knee, --highlight-ceiling, --force. Без --input используется текущая папка; без --output результат сохраняется рядом с источниками. Дополнительно --conflict=skip|rename|overwrite, --format=png|jpeg|webp, --quality=90. Ctrl+C безопасно отменяет обработку после текущего фото.

--force меняет только отбор числовых PNG, а не разрешение перезаписи оригинала. Отличие от опасного поведения старого скрипта описано в docs/PROCESSING.md.

## Architecture

```text
React Renderer → typed Preload → Electron Main → Utility Process → Shared Core → Sharp
                                              ├ batch / scan
                                              └ preview
CLI ────────────────────────────────────────────────────────→ Shared Core
```

src/shared — схемы Zod, IPC types, presets и branding.
src/processing — эталонный pipeline, export, scan, mapping, worker.
src/main — lifecycle, dialogs, валидация IPC, workers, JSON store.
src/preload — ограниченный contextBridge API.
src/renderer — React, controls, очередь, preview.

Renderer sandboxed, contextIsolation=true, nodeIntegration=false. IPC проверяет отправителя и содержимое. Внешняя навигация, создание окон и сетевые запросы заблокированы.

## Watermark и совместимость

watermark-pattern-figma.svg — обязательный оригинальный asset. Его геометрия не пересоздаётся. electron-builder копирует SVG в resources; production использует process.resourcesPath. SHA-256 зафиксирован тестом; .gitattributes запрещает преобразование переводов строк.

Если SVG отсутствует, обработка завершается понятной ошибкой. Точное описание порядка, констант, alpha/crop и отличий файловой безопасности: [docs/PROCESSING.md](docs/PROCESSING.md).

Первое растровое преобразование большого Figma asset может занять заметное время. Последующие операции используют кэш по SHA-256 и размеру. Preview последовательно показывает уменьшенный холст и полное качество; debounce и отмена старого utility process защищают от устаревшего результата.

```powershell
npm run regression -- "D:/private-real-fixtures"
```

Отдельные реальные фотографии не коммитятся. В исходном SVG обнаружено встроенное фото деталей: node scripts/extract-fixture.mjs извлекает его в .tmp. На этом фото 2491×1875 исходный CLI и новый AyProm Standard дали одинаковые decoded RGBA. Подробные результаты и границы: [docs/QA.md](docs/QA.md).

## Windows build и release

electron-builder.yml: assisted NSIS (oneClick=false), выбор каталога, Portable, ASAR, native Sharp/@img unpacked. Только Sharp остаётся runtime-зависимостью; UI и Zod включены bundler в код. Development icon — стандартный Electron; для собственного значка положите assets/app.ico и задайте win.icon в electron-builder.yml.

Workflow .github/workflows/windows.yml проверяет types/tests, собирает app, проверяет dev/unpacked через Electron и собирает Setup/Portable. Теги vX.Y.Z создают draft Release с артефактами. После проверки установленной/portable версии и ознакомления с QA ограничениям draft можно опубликовать. Никакого auto-update в первой версии.

## Ограничения

- Проверен один реальный товарный fixture из исходного SVG и два синтетических. Эквивалентность всех возможных фото и сотен уникальных исходников не заявляется.
- Прозрачный фон должен быть подготовлен заранее; удаления фона и AI нет.
- Стратегии skip/rename используют hard links для атомарной публикации, поэтому выбирайте NTFS. Неподдерживаемая файловая система выдаст ошибку.
- Preview сохраняет исходную обработку полного разрешения; большие фотографии и первый рендер watermark могут быть медленными.
- Auto-update и code signing не включены.

## License

MIT. См. LICENSE. Название AyProm и фирменный watermark остаются идентификаторами бренда; лицензия кода не предоставляет права выдавать сторонний продукт за официальный.
