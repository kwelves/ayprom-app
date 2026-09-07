# Проверка версии 1.0.1

Дата: 2026-09-08. Платформа: Windows x64, Node 24.17.0, Electron 44.2.0, Sharp 0.35.4.

## Автоматические проверки

- TypeScript strict: без ошибок.
- 44 теста: 44 passed, 0 failed. Preset validation/serialization/version, export/IPC validation, sorting/extensions/numeric force, recursion/mapping, conflicts, source preservation, cancellation, PNG/JPEG/WebP, corrupt store recovery.
- Production build: успешно. Renderer JS 310 kB, gzip 94.31 kB; CSS 14.14 kB.
- Preset UI: Duplicate, Rename, Save, Reset, Delete, factory protection, session drafts, keyboard focus trap; полное закрытие/повторный запуск подтверждает сохранение пресета и темы.
- Electron UI: загрузка renderer, отсутствие Node в renderer, ограниченный preload, папки и recursion, batch → utility → Sharp, preview, latest setting updates, history, 900×650.
- Chromium file-backed drag events: одна папка, несколько отдельных файлов; queue remove; кнопка Cancel действительно отменяет очередь.
- Packaged unpacked и установленная NSIS-копия проходят полный UI harness.
- Portable launcher реально распаковывается и запускается; отдельный CDP harness проверяет Sharp, SVG, PNG/JPEG/WebP и preview. Прямой electron.launch Playwright с оболочкой Portable не подходит; это ограничение тестового подключения.
- NSIS silent install завершился кодом 0. app.asar установленной и unpacked-копии имеет одинаковый SHA-256.
- Установщики НЕ подписаны: Get-AuthenticodeSignature = NotSigned.

Исправление Windows aliases: первый CI выявил обход проверки вложенного output через короткое имя пути. Добавлен сначала падающий тест; после канонизации обеих сторон все тесты проходят локально и на GitHub runner.

IPC Windows aliases: CI Portable использовал разные короткое и длинное представления пути собственного renderer. В 1.0.1 URL сверяется по realpath при сохранении проверки webContents, main frame и file protocol. Два теста подтверждают доверие тому же файлу и отказ чужим файлам/протоколам. Тег v1.0.0 сохранён в истории, публичного выпуска 1.0.0 нет.

## Processing regression

Исходная программа берётся из неизменного Git commit cfa8c91. Новый core использует тот же Sharp 0.35.4.

1. Два синтетических fixtures: размеры совпали, RGBA без отличий.
2. Реальная фотография деталей 2491×1875 извлечена из image1_0_1 предоставленного Figma SVG. Это существующее фото, не генерация. AyProm Standard 1600×1204: differingChannels=0, maxDelta=0, sameGeometry=true.

Вывод ограничен проверенными файлами. Это не доказательство эквивалентности на всех камерах, цветовых профилях или фотографиях.

Воспроизведение:

```powershell
node scripts/extract-fixture.mjs
npm run regression -- .tmp/embedded-fixture
```

Watermark SHA-256 в source, unpacked resources и installed resources:
`46ad8e02d90b818720daa5004d206e7db9545c6c82985136b5f3c3463ccf3df8`.

## Локальные артефакты

| Артефакт                   | Размер, байт |    MiB |
| -------------------------- | -----------: | -----: |
| Setup 1.0.1                |    119102800 | 113.59 |
| Portable 1.0.1             |    118872753 | 113.37 |
| win-unpacked, сумма файлов |    409802974 | 390.82 |
| installed-qa, сумма файлов |    409974367 | 390.98 |

Размер каталога означает сумму файлов, а не выделенные диском кластеры. Кэш пользовательского профиля в эти размеры не входит. Пересборка CI может изменить байты/хэши упаковки; SHA256SUMS.txt сопровождает каждый набор артефактов.

## Границы проверки

- Один реальный товарный fixture и два синтетических. Полная съёмка из сотен уникальных фото не прогонялась.
- Перетаскивание проверено file-backed событиями Chromium; ручной жест из Проводника и мастер установки мышью отдельно не проверялись.
- NSIS установлен в автоматическом режиме с заданным каталогом. Конфигурация assisted installer и allowToChangeInstallationDirectory подтверждена сборкой, но страницы мастера не просмотрены вручную.
- Windows x64 подтверждён на текущей машине; Windows ARM, macOS/Linux не проверялись.
- Первая растеризация большого SVG занимает заметное время. Кэш снижает повторные расходы; весь original enhancement остаётся полноразмерным.
- Hard-link publication в Skip/Rename требует подходящей файловой системы (NTFS). ExFAT/network shares отдельно не проверялись.
- Иконка пока стандартная Electron. Code signing и auto-update отсутствуют.

История прежних временных ошибок не является статусом финальной сборки. Финальные отчёты хранятся локально под .tmp; GitHub workflow прикладывает воспроизводимые QA-артефакты.
