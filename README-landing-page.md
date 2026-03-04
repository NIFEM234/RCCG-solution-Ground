This repository contains the website for "RCCG Solution Ground".

Purpose: ensure the welcome page (`index.html`) is always served as the
default landing page when the site is launched.

What I added

- `.htaccess` — for Apache servers: sets `index.html` as the `DirectoryIndex` and
  rewrites unknown paths to `index.html` (SPA fallback).
- `web.config` — for IIS hosts: sets `index.html` as the default document and
  rewrites unknown paths to `index.html`.
- `_redirects` — for Netlify: `/* /index.html 200` to serve `index.html` for all
  routes.

Custom 404

- `404.html` — a styled custom error page (includes a "Back to Home" link and a "Go to previous page" button). Note: hosting platforms differ in how they handle 404s when a SPA fallback is configured. On Netlify, the `/* /index.html 200` rule will cause unknown routes to return `index.html` (200) instead of `404.html`. If you prefer Netlify to return the 404 page for missing resources, remove the SPA fallback or configure it differently.

Notes / Next steps

- If you host on a platform not listed here (GitHub Pages, S3/CloudFront, Vercel),
  the platform normally serves `index.html` by default — check their docs if
  you experience a different landing page.
- Replace placeholder `https://example.com/` values in `index.html` meta tags
  with your real site URL and upload high-quality PNG/SVG logo files for best
  search engine results.
- If you want, I can also add `link rel="canonical"` tags to all pages and
  add explicit `favicon.ico`/`favicon-32x32.png` files to the `img/` folder.
