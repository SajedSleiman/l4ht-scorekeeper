---
name: Angular CDP verification timing
description: Avoid false failures when controlling l4ht's Angular preview through headless Chromium CDP.
---

When using Chrome DevTools Protocol against the Angular development preview, a successful navigation response does not guarantee that Angular has bootstrapped or rendered the app. Early DOM reads may show an empty body even though the preview is healthy.

**Why:** Navigation can complete before the Angular app finishes loading; treating that transient state as a broken app led to false failures during browser verification.

**How to apply:** Wait for a rendered app selector or visible text with a bounded timeout before reading the DOM or sending interactions. Verify the app through its actual preview when possible.