# Обновления AYPROM

AYPROM использует `electron-updater`, NSIS и публичные GitHub Releases репозитория `kwelves/ayprom-app`. Renderer не обращается к GitHub: main process проверяет, скачивает и устанавливает обновление, а preload передаёт только валидированное состояние.

## Поведение приложения

- Установленная Setup-версия делает одну фоновую проверку через 5 секунд после показа окна. Повторная проверка запускается только вручную.
- `autoDownload` и `autoInstallOnAppQuit` отключены. Пользователь отдельно выбирает «Скачать» и «Перезапустить и обновить».
- Во время обработки фотографий установка запрещена; готовое обновление ждёт безопасного завершения batch.
- Portable определяется по `PORTABLE_EXECUTABLE_FILE`/`PORTABLE_EXECUTABLE_DIR`, не запускает electron-updater и открывает только фиксированный HTTPS URL официальных Releases.
- Development-сборка не выполняет сетевую проверку и не пытается установить обновление.

## Release flow

1. Обычные push/PR проходят verification без GitHub Release.
2. Версия в `package.json` должна совпадать с тегом `vX.Y.Z`.
3. Tag workflow вызывает `electron-builder --publish always` с временным `GH_TOKEN` GitHub Actions.
4. Electron-builder из одной сборки создаёт Setup, blockmap и `latest.yml` и загружает их вместе с Portable в draft Release.
5. CI сверяет version, имя installer и SHA-512 из `latest.yml`, проверяет unpacked/installed/Portable и добавляет `SHA256SUMS.txt`.
6. Draft остаётся невидимым для updater до ручной публикации.

`v1.0.2` updater не содержит, поэтому переход `v1.0.2 → v1.1.0` выполняется вручную. `v1.1.0` — bootstrap release; штатный in-app путь начинается с `v1.1.0 → v1.1.1+`.

## Unsigned Windows build

Сейчас Authenticode отсутствует. В `electron-builder.yml` явно задано `verifyUpdateCodeSignature: false`, потому что проверять publisher у неподписанного NSIS installer невозможно. Это не отключает HTTPS и SHA-512-проверку файла по metadata electron-updater.

TODO после внедрения Windows code signing: удалить override `verifyUpdateCodeSignature: false`, настроить сертификат/publisher и проверить подписанный update path перед выпуском.
