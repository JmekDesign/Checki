---
description: Rules for admin frontend files
globs: admin/*.js
---

- All JS code uses the `CHK` namespace object
- API calls go through `CHK.api()` helper (handles auth headers, base URL)
- No inline event handlers in HTML — use `addEventListener` in JS
- Mobile-first: test on small screens
- No framework — vanilla JS only
