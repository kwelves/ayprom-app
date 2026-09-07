Unicode true
RequestExecutionLevel user
SilentInstall silent
Name "AyProm shortcut QA"
OutFile "${QA_OUTPUT}"
!addincludedir "${QA_INCLUDES}"
!addplugindir /x86-unicode "${QA_PLUGINS}"
!include MUI2.nsh
!include StdUtils.nsh
!define APP_ID "com.ayprom.photo-processor.qa"
!define APP_DESCRIPTION "AyProm isolated shortcut QA"
!define isUpdated `0 == 1`
!define isNoDesktopShortcut `0 == 1`
Var newDesktopLink
Var appExe
!include "${QA_INSTALLER}"
!insertmacro customPageAfterChangeDir
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Russian"

Function .onInit
  !insertmacro customInit
FunctionEnd

!macro assertLink present failureCode
  IfFileExists "$newDesktopLink" 0 +3
    StrCpy $1 1
    Goto +2
  StrCpy $1 0
  ${If} $1 != ${present}
    SetErrorLevel ${failureCode}
    Quit
  ${EndIf}
!macroend

Section
  StrCpy $appExe "$EXEPATH"
  StrCpy $newDesktopLink "$EXEDIR\test-shortcut.lnk"
  ${StdUtils.TestParameter} $0 "no-desktop-shortcut"
  ${If} $0 == "true"
    ${IfNot} ${isNoDesktopShortcut}
      SetErrorLevel 10
      Quit
    ${EndIf}
  ${Else}
    ${If} ${isNoDesktopShortcut}
      SetErrorLevel 11
      Quit
    ${EndIf}
  ${EndIf}

  ; Same code as the full installer: explicit checked creates the link.
  StrCpy $ayPromShortcutPageShown 1
  StrCpy $ayPromDesktopShortcut ${BST_CHECKED}
  !insertmacro customInstall
  !insertmacro assertLink 1 12

  ; Explicit unchecked removes an existing app link on reinstall.
  StrCpy $ayPromDesktopShortcut ${BST_UNCHECKED}
  !insertmacro customInstall
  !insertmacro assertLink 0 13

  ; Silent updates preserve an absent shortcut.
  StrCpy $ayPromShortcutPageShown 0
  StrCpy $ayPromDesktopShortcut ${BST_CHECKED}
  !insertmacro customInstall
  !insertmacro assertLink 0 14

  ; Checking on reinstall recreates a removed shortcut.
  StrCpy $ayPromShortcutPageShown 1
  !insertmacro customInstall
  !insertmacro assertLink 1 15

  ; A skipped page must not remove an existing shortcut.
  StrCpy $ayPromShortcutPageShown 0
  StrCpy $ayPromDesktopShortcut ${BST_UNCHECKED}
  !insertmacro customInstall
  !insertmacro assertLink 1 16

  ; Only remove the test-owned shortcut in the isolated executable directory.
  StrCpy $ayPromShortcutPageShown 1
  !insertmacro customInstall
  !insertmacro assertLink 0 17
  SetErrorLevel 0
SectionEnd
