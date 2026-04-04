# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**SoulMates** — a SaaS platform for creating personalized digital romantic gifts delivered via link/QR Code. Content is in Brazilian Portuguese (pt-BR). Pricing in BRL.

## Tech Stack

Pure vanilla stack — no build tools, no package manager, no frameworks. Dependencies loaded from CDN only (Bootstrap 5.3.8, Google Fonts). Open any `.html` file directly in a browser or use a local dev server (`npx serve .` or VS Code Live Server).

## Architecture

Three-page public site (`index.html` → `login.html` → `cadastro.html`) plus a multi-step gift creator under `criar/`.

```
index.html          Landing page (hero, features, pricing, footer)
login.html          Login form
cadastro.html       Registration form
criar/              Gift creation wizard (multi-step form)
  index.html
  style.css
  script.js
assets/
  css/              Per-page stylesheets (cadastro.css, login.css, styles.css)
  js/
    main.js         Page transitions + cadastro form validation
    login.js        Login form validation
  images/           Static product images
```

**CSS convention:** each page imports its own stylesheet from `assets/css/`. Global CSS variables (colors, fonts) are defined in `assets/css/styles.css`.

**JS convention:** form validators return `{ valid: boolean, message: string }`. Page transitions use a CSS fade-out class before `window.location.href`. No modules — all scripts are plain `<script src>` tags.

**Gift wizard (`criar/`):** state lives in a single global `state` object, persisted to `localStorage`. Steps are `div.step` elements shown/hidden by JS. The preview panel updates reactively on every input event.

## Color Palette & Fonts

- Primary: `#ff6dba` (pink)
- Background/dark: `#121820`
- Google Fonts: `Sora`, `Syne`
