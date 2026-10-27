# iDom Launcher interface

The launcher is an everyday tool for opening and updating a small catalog of applications. Preserve the iDom wordmark, original app icons, bordered catalog layout, bundled Archivo/Inter/Geist Mono fonts and light/dark themes.

## Hierarchy and typography

- App names are readable in the foreground color. App colors remain accents and original icon artwork.
- Open, Open website and Install are primary actions with the same visual treatment; updates may change the action label, not arbitrarily favor a web app.
- Functional labels and badges use at least 12px; the secondary footer uses 11px. Body copy uses 14px.
- Dark secondary text: #a6a8ad, subtle text #969aa4 on #121316. Light secondary text #55545b, subtle text #62616a on #f2f1ee.
- App repository links belong in Details. The single launcher project link belongs in the footer. Names are headings, not duplicate Details buttons.

## First launch and keyboard

First launch has three stages: try opening, authorize in System Settings, retry. Show one primary action at a time, a Back action when useful, and collapsible exceptional-case help. Completion is shown when the backend reports a matching app process. An unconfirmed launch must remain a request, not a claim of success.

Use normal button popovers with native Tab order rather than incomplete ARIA menus. Escape closes a popover and restores trigger focus. Escape may close guidance. Cmd+F/Ctrl+F focuses and selects catalog search without overriding modal dialogs. Stage transitions move focus to the newly available action.

The desktop window supports a minimum width of 760px. Narrow layouts may stack cards vertically; content and actions must remain accessible without horizontal clipping.
