!include nsDialogs.nsh

!ifndef BUILD_UNINSTALLER
Var ayPromDesktopShortcut
Var ayPromShortcutCheckbox
Var ayPromShortcutPageShown

; Feed the wizard choice into electron-builder's existing shortcut logic.
!undef isNoDesktopShortcut
!define isNoDesktopShortcut `$ayPromDesktopShortcut == ${BST_UNCHECKED}`

!macro customInit
  StrCpy $ayPromShortcutPageShown 0
  StrCpy $ayPromDesktopShortcut ${BST_CHECKED}
  ${StdUtils.TestParameter} $0 "no-desktop-shortcut"
  ${If} $0 == "true"
    StrCpy $ayPromDesktopShortcut ${BST_UNCHECKED}
  ${EndIf}
!macroend

; Expand functions here, after electron-builder has loaded MUI and plugins.
!macro customPageAfterChangeDir
  Page custom AYPROMShortcutPageCreate AYPROMShortcutPageLeave

  Function AYPROMShortcutPageCreate
    ${If} ${isUpdated}
      Abort
    ${EndIf}
    !insertmacro MUI_HEADER_TEXT "Ярлык приложения" "Выберите, как открывать AYPROM."
    nsDialogs::Create 1018
    Pop $0
    ${If} $0 == error
      Abort
    ${EndIf}
    StrCpy $ayPromShortcutPageShown 1
    ${NSD_CreateLabel} 0 0 100% 28u "Приложение будет доступно в меню «Пуск». Дополнительно можно создать ярлык на рабочем столе."
    Pop $0
    ${NSD_CreateCheckbox} 0 40u 100% 14u "Создать ярлык на рабочем столе"
    Pop $ayPromShortcutCheckbox
    ${NSD_SetState} $ayPromShortcutCheckbox $ayPromDesktopShortcut
    nsDialogs::Show
  FunctionEnd

  Function AYPROMShortcutPageLeave
    ${NSD_GetState} $ayPromShortcutCheckbox $ayPromDesktopShortcut
  FunctionEnd
!macroend

!macro customInstall
  ; An explicit choice also applies on reinstall. Silent updates keep the
  ; standard behavior and do not recreate a shortcut the user had removed.
  ${If} $ayPromShortcutPageShown == 1
    ${If} $ayPromDesktopShortcut == ${BST_CHECKED}
      CreateShortCut "$newDesktopLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
      WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
    ${Else}
      WinShell::UninstShortcut "$newDesktopLink"
      Delete "$newDesktopLink"
    ${EndIf}
    System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
  ${EndIf}
!macroend
!endif
