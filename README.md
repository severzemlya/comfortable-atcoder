# Comfortable Atcoder (MV3 fork)

A Chrome extension that makes your AtCoder life more comfortable.

> **About this fork**
> This repository is an unofficial fork of [drafear/comfortable-atcoder](https://github.com/drafear/comfortable-atcoder) that ports the extension to **Manifest V3 (MV3)**.
> The upstream extension targets MV2, which is no longer accepted by recent versions of Chrome. This fork keeps the same feature set while migrating the manifest, the background page (now a service worker), and the watcher logic so that the extension keeps working under MV3.
>
> All credit for the original design and implementation goes to **drafear** and the contributors of the upstream repository.

## Features

- Notify the judge result of code you submit
- Notify new clarifications on the contest page you have open
- Add a link tab to the beta page (`atcoder.jp`) on legacy `*.contest.atcoder.jp` pages
- Dropdown list of problems on contest pages
- Warn when you choose specific languages for submission such as `text`, `bash`, etc. (configurable)
- Add a tweet button to the rating history page
- Toggle each feature on / off from the options page

## Installation

No pre-built release is published for this fork. Build it locally and load it as an unpacked extension.

```bash
git clone https://github.com/severzemlya/comfortable-atcoder.git
cd comfortable-atcoder
npm install
npm run build
```

Then:

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and choose the generated `dist/` directory

## Development

```bash
npm install
npm run watch
```

`npm run watch` compiles TypeScript and Less in the `src/` tree on every change. Load `src/` as an unpacked extension on `chrome://extensions/`, and reload the extension after each edit to apply the changes.

For [Visual Studio Code](https://code.visualstudio.com/) users, recommended extensions can be installed via `@recommended` in the Extensions view.

### Build for release

```bash
npm run build
```

The output goes into `dist/`. Load that directory as an unpacked extension.

## MV3 migration notes

The migration is contained in commits `4a37b0f`, `81b51b2`, and `516ea2e`. Highlights:

- `manifest_version` bumped from `2` → `3`
- Background page replaced with a service worker (`src/background/dispatcher.ts`)
- Host access split into `host_permissions`
- `web_accessible_resources` rewritten with the MV3 object form (per-resource `matches`)
- Submission watcher reworked so it survives service-worker termination (state persisted via `chrome.storage`, image generation moved to `OffscreenCanvas`)
- Content script load order fixed for the legacy → beta link injection

## License & credits

The upstream project [drafear/comfortable-atcoder](https://github.com/drafear/comfortable-atcoder) does **not** specify a license. Under default copyright law that means **all rights are reserved by the original author (drafear)**.

For that reason this fork is published **without a license file** and is intended for **personal use only** — specifically, to keep using the extension locally now that MV2 has been deprecated. It is not redistributed as a packaged product and is not published to the Chrome Web Store.

If you are the original author and would like this fork removed, relicensed, or upstreamed, please open an issue and we will respond promptly.
