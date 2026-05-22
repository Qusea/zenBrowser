# CLAUDE.md — Zen Browser

## Overview

Zen Browser is a Firefox-based browser that layers a custom UI and feature set on top of the Firefox source tree. It is not a standalone app — it patches and extends Firefox using the `@zen-browser/surfer` build tool, which downloads the Firefox source, applies patches, copies Zen source files, and invokes the Mozilla build system (`mach`).

**Current Firefox base**: `142.0.1` (release), `143.0` RC (twilight)  
**License**: MPL-2.0  
**Node**: v20 (see `.nvmrc`)  
**Python**: 3.11 (see `.python-version`)  
**Rust**: 1.82 (see `.rust-toolchain`) — only for the `ffprefs` tool

---

## Repository Layout

```
zenBrowser/
├── src/                  # All Zen source
│   ├── zen/              # Zen feature modules (JS, CSS, C++)
│   └── */                # Patch files (.patch) applied to Firefox source
├── prefs/                # Browser preference definitions (YAML)
├── configs/              # Platform branding (linux/macos/windows + icons)
├── build/                # Build infrastructure (AppDir, flatpak, winsign, TS types)
├── scripts/              # Python release/utility scripts
├── tools/
│   ├── ffprefs/          # Rust binary that compiles prefs/**.yaml → Firefox pref format
│   └── virustotal-checker/ # C++ release-scanning tool
├── locales/              # i18n language packs and update scripts
├── docs/                 # Feature specifications and contribution guide
├── .github/workflows/    # CI/CD: build, lint, test, release pipelines
├── surfer.json           # Surfer configuration (app ID, versions, brands)
└── package.json          # npm scripts — primary developer interface
```

---

## Feature Modules (`src/zen/`)

Each subdirectory is a self-contained feature:

| Directory        | Purpose                                                        |
|-----------------|----------------------------------------------------------------|
| `common/`        | Base classes, startup, UI manager, emoji picker, shared CSS    |
| `compact-mode/`  | Compact sidebar mode                                           |
| `downloads/`     | Download progress animations                                   |
| `folders/`       | Tab folders (grouping tabs under collapsible headers)          |
| `glance/`        | Glance — peek at a tab without fully switching to it          |
| `kbs/`           | Keyboard shortcut management                                   |
| `media/`         | In-browser media controls overlay                             |
| `mods/`          | User mods (custom CSS/JS injection) + marketplace actors      |
| `split-view/`    | Side-by-side tab split view                                    |
| `tabs/`          | Vertical tab bar, pinned tabs, pinned tab storage              |
| `toolkit/`       | Shared C++ utilities (XPCOM, macOS haptics, share sheet)      |
| `urlbar/`        | URL bar customization, action providers                        |
| `vendor/`        | Bundled third-party JS (Motion, tsParticles)                   |
| `welcome/`       | First-run welcome experience                                   |
| `workspaces/`    | Workspace management, storage, sync, gradient generator        |
| `@types/`        | TypeScript type definitions for Gecko APIs                     |

### Patches (`src/` outside `src/zen/`)

Files outside `src/zen/` are unified-diff patches applied to the Firefox source tree by `surfer import`. They follow the Firefox source directory structure and are named after the file they patch (e.g., `src/browser/base/moz-build.patch` patches `browser/base/moz.build`).

Special patches:
- `src/Cargo-toml.patch` / `src/Cargo-lock.patch` — Rust workspace changes
- `src/firefox-patches/` — Named feature patches not tied to a single file

---

## Development Commands

All commands are run from the repo root via `npm run <script>`.

### First-time Setup

```bash
npm install                  # install Node dependencies
npm run init                 # download Firefox source + apply patches + bootstrap build
```

This is equivalent to: `surfer download && npm run import && surfer bootstrap`

### Day-to-Day Development

```bash
npm run build                # full Firefox + Zen build (~30–90 min first time)
npm run build:ui             # rebuild only Zen JS/CSS assets (fast, ~seconds)
npm run start                # launch built browser without a profile
```

### Linting and Formatting

```bash
npm run lint                 # eslint + prettier check + autopep8 diff
npm run lint:fix             # eslint --fix + prettier --write + autopep8 in-place
npm run pretty               # prettier + autopep8 write (no eslint)
```

Pre-commit hook (`husky`) runs `lint-staged` automatically.

### Testing

```bash
npm run test                 # run all Zen browser tests via python3 scripts/run_tests.py
npm run test:dbg             # same, with JS debugger + debug-on-failure
```

Tests are mochitest-style browser tests located in `src/zen/tests/`.

### Other

```bash
npm run ffprefs              # compile prefs/**.yaml → Firefox pref format (Rust tool)
npm run update-ff            # update Firefox base version
npm run export               # export patches back from engine/ after editing Firefox source
npm run reset-ff             # reset Firefox source to clean state
npm run lc                   # check MPL-2.0 license headers
npm run lc:fix               # auto-add missing MPL-2.0 headers
```

---

## Code Conventions

### License Header

Every source file must begin with:

```js
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
```

Use `//` for JS/CSS/Rust, `#` for Python/YAML/moz.build, `<!--` for HTML/XUL.

### JavaScript Style (enforced by ESLint + Prettier)

- **Indent**: 2 spaces, LF line endings
- **Quotes**: single quotes
- **Semicolons**: required
- **Trailing commas**: ES5 style
- **Print width**: 100 characters
- **No comments** unless the WHY is non-obvious

### File Types and When to Use Each

| Extension    | Used for                                                   |
|-------------|-------------------------------------------------------------|
| `*.mjs`      | Browser-window scripts loaded via `loadSubScript` (chrome context) |
| `*.sys.mjs`  | ES modules loaded via `ChromeUtils.importESModule` (can be shared across processes) |
| `*.js`       | Legacy preloaded scripts or non-module globals             |
| `*.css`      | Styles for the browser chrome UI                           |
| `*.inc.xhtml`| XUL/HTML fragments included into the main browser window   |
| `*.inc.css`  | CSS fragments included from a parent stylesheet            |

### Browser-Window Module Pattern

Singletons that live in the browser window context use this pattern (wrapped in a block to avoid polluting the global scope while still declaring the variable on `window`):

```js
{
  var gZenFeatureName = new (class extends nsZenMultiWindowFeature {
    init() { /* called at startup */ }
  })();
}
```

Or for object literals:

```js
var gZenFeatureName = {
  init() { /* ... */ }
};
```

### Base Classes (defined in `src/zen/common/ZenCommonUtils.mjs`)

- **`nsZenMultiWindowFeature`** — Base for features that need to operate on all open browser windows. Provides `static get browsers()`, `foreachWindowAsActive()`, etc. The singleton is created with `new (class extends nsZenMultiWindowFeature {})()`.

- **`nsZenDOMOperatedFeature`** — Automatically calls `this.init()` when `DOMContentLoaded` fires. Use when DOM access is needed at startup.

- **`nsZenPreloadedFeature`** — (implicit pattern) Features loaded before the main browser UI, via `ZenPreloadedScripts.js`.

### Lazy Preference Access

Always use `XPCOMUtils.defineLazyPreferenceGetter` for preferences — never read them synchronously on every call:

```js
XPCOMUtils.defineLazyPreferenceGetter(
  this,
  'propertyName',
  'zen.feature.pref-name',
  defaultValue
);
```

### JSWindowActors (Content Process Communication)

For features that need to communicate with web content, add Parent/Child actor pairs:

- Place in `src/zen/<feature>/actors/Zen<Feature>Parent.sys.mjs` and `Zen<Feature>Child.sys.mjs`
- Register via `gZenActorsManager.addJSWindowActor(name, data)` in `ZenActorsManager.mjs`
- Actors are registered in `FINAL_TARGET_FILES.actors` in the feature's `moz.build`

### Storage

- Workspace and pinned tab data uses `PlacesUtils.withConnectionWrapper` for SQLite
- Prefs for user settings live in the `prefs/*.yaml` files

### Preferences

Define new preferences in the appropriate YAML file under `prefs/`. Use the `zen.` namespace:

```yaml
- name: zen.feature.pref-name
  value: true
```

Run `npm run ffprefs` after editing any `prefs/*.yaml` file to regenerate the compiled prefs. Do **not** edit the compiled output manually.

---

## Testing Conventions

Tests live in `src/zen/tests/<feature>/` and follow mochitest browser test conventions:

```js
/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

add_setup(async function () { /* one-time setup */ });

add_task(async function test_MyFeature() {
  // use gZen* globals directly — they exist in the browser window context
  ok(condition, 'message');
});
```

- Test files: `browser_<feature_name>.js`
- Test manifest: `browser.toml` in the same directory
- Shared helpers: `head.js` in the same directory
- ESLint ignores `**/tests/**` — test files may use globals freely

---

## Commit Message Format

Commits use the `formal-git` convention:

```
{type}: {message}, b={bugId}, c={components}
```

- **type**: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `style`
- **b**: bug/issue ID or `no-bug`
- **c**: comma-separated component names from `.formal-git/components`

**Valid components**: `split-view`, `kbs`, `folders`, `workspaces`, `mods`, `tests`, `glance`, `media`, `images`, `vendor`, `tabs`, `compact-mode`, `common`, `fonts`, `welcome`, `scripts`, `workflows`, `winsign`, `flatpak`, `configs`, `l10n`

**Example**:
```
feat: Add live folder RSS support, b=no-bug, c=folders
fix: Compact mode width regression, b=#1234, c=compact-mode, tabs
```

---

## Branch Strategy

```
dev (default branch — all feature work goes here)
 ├── feature/* (feature branches, branch from dev)
 └──> stable (release branch, merged from dev)
         └── hotfix/* (emergency fixes, branch from stable)
```

- **`dev`** — main development branch, maps to the "twilight" build
- **`stable`** — release branch, used for tagged releases
- PRs should target `dev` unless they are hotfixes

---

## CI/CD

Workflows in `.github/workflows/`:

| Workflow                    | Trigger                              | Purpose                              |
|-----------------------------|--------------------------------------|--------------------------------------|
| `code-linter.yml`           | All PRs                              | ESLint + Prettier check              |
| `pr-test.yml`               | All PRs                              | Run Zen browser tests                |
| `build.yml`                 | Manual / scheduled                   | Full cross-platform release build    |
| `linux-release-build.yml`   | Called by `build.yml`                | Linux x86_64 + aarch64              |
| `macos-release-build.yml`   | Called by `build.yml`                | macOS x64 + aarch64                 |
| `windows-release-build.yml` | Called by `build.yml` (3-step PGO)  | Windows x86_64 + arm64              |

Builds run on Blacksmith runners (Ubuntu 24.04). Release builds create GitHub releases with `.mar` update manifests, AppImages, `.dmg`, and Windows installers.

---

## Key Files Reference

| File                                      | Purpose                                              |
|-------------------------------------------|------------------------------------------------------|
| `surfer.json`                             | App name, Firefox version, brand configs             |
| `package.json`                            | All developer commands (`npm run ...`)               |
| `src/zen/zen.globals.js`                  | List of all Zen globals exposed to ESLint            |
| `src/zen/common/ZenCommonUtils.mjs`       | Base classes (`nsZenMultiWindowFeature`, etc.)       |
| `src/zen/common/ZenStartup.mjs`           | Browser layout initialization at startup             |
| `src/zen/common/ZenPreloadedScripts.js`   | Registers scripts loaded before browser window ready |
| `src/zen/common/ZenActorsManager.mjs`     | Registers JSWindowActors                             |
| `src/zen/common/ZenUIManager.mjs`         | UI utilities: toasts, popups, animations, URL bar    |
| `src/zen/moz.build`                       | Top-level build entry for all Zen modules            |
| `src/browser/base/moz-build.patch`        | Hooks `src/zen/` into Firefox's moz.build            |
| `src/browser/base/jar-mn.patch`           | Hooks Zen assets into Firefox's JAR manifest         |
| `prefs/zen.yaml`                          | Core Zen preferences                                 |
| `tools/ffprefs/src/main.rs`               | YAML → Firefox pref format compiler                  |
