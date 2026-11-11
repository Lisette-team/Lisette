# 02.1 PDF validation: owner reading on phone, tablet and web

Delivery plan check for 02.1: owner PDF preview works on Android phone, tablet and web, and clears on lock and logout. If secure owner reading cannot be shown on a device, stop and report.

## How the reader works

- The app never holds the file. The reader is one HTML page (`src/features/manuscripts/reader-html.ts`) that fetches the PDF from the `manuscript-file` Edge Function with the caller's access token and draws it with PDF.js. The response is `Cache-Control: no-store`.
- Android: the page runs in `react-native-webview` with `incognito` and the cache off. This works in Expo Go, so no development build is needed.
- Web: the same page runs in an `<iframe sandbox="allow-scripts">`. Without `allow-same-origin` it cannot read the app's storage or session.
- PDF.js 6.4.299 loads from cdnjs. Both files are checked against SRI hashes before they run. Pages are canvases, with no text layer and no download control, and are drawn only as they scroll into view.
- Because a sandboxed page cannot start a module worker from a blob, PDF.js parses on the page's main thread (`globalThis.pdfjsWorker`). A very large PDF may make the first page slower to appear.
- Unlock: the reader asks for `confirmPrivateAction()` (fingerprint, with the phone PIN as fallback) every time it opens. Cancelling shows only the Unlock button; nothing is fetched. Web and phones with no screen lock are `unavailable` and open directly (decided 2026-10-24).
- Lock: when the app goes to the background (phone locked, app switched, browser tab hidden), the reader unmounts. Its in-memory copy goes with it, and reopening asks again.
- Logout: the private layout redirects to the start screen, which unmounts the reader.

## Results

| Platform | Device | Renders | Clears on lock | Clears on logout | Date, by |
|---|---|---|---|---|---|
| Web | Chromium (Playwright, headless), 900×1100 | Yes: 3-page test PDF, page 1 drawn, the rest on scroll | Yes: hiding the tab removes the iframe and shows Unlock | Yes: signed-out private routes redirect (existing guard) | 2026-10-24, Claude |
| Android phone | _to test_ | | | | |
| Android tablet | _to test_ | | | | |

On web the same run also checked: upload from the UI (file picker, then a new work and version listed), and a renamed non-PDF rejected with "This file isn't a valid PDF".

## Checklist for the phone and tablet (Expo Go)

1. `npx supabase start`. Put the computer's LAN IP in `.env.local` (`EXPO_PUBLIC_SUPABASE_URL=http://<ip>:54321`, anon key from `npx supabase status`), then `npx expo start`.
2. Sign in, open Manuscripts, add the writer profile and upload a real manuscript PDF (several MB, many pages). Confirm with fingerprint or PIN.
3. Read it. Check that pages are sharp, scrolling is smooth and pinch zoom is acceptable.
4. Cancel the fingerprint prompt: the reader must stay locked, showing only Unlock.
5. Lock the phone while reading, then unlock it: the reader must be closed and ask again.
6. Sign out from Settings, then press back: you must not reach the reader.
7. Write the result in the table above. If reading fails on a device, record the error and stop before 02.2.
