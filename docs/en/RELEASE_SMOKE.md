<!-- ✦ ⋆ ｡˚ Constella — Release smoke test & the /login hydration invariant ˚｡ ⋆ ✦ -->
# Release builds & the `/login` hydration crash

🇧🇷 Versão em português: [docs/pt/RELEASE_SMOKE.md](../pt/RELEASE_SMOKE.md)

## What went wrong (0.2.15)

The published **0.2.15** opened to a root crash on `/login`:

```
Something broke at the root
invariant expected layout router to be mounted
```

The server looked healthy — the HTML, the RSC payload and every `/_next/static` chunk returned **200**. But
the page died during **client hydration**: the App Router lost its internal `LayoutRouterContext`, so the moment
React committed the page it threw the invariant and fell back to the root error screen.

It was **not** the database reset, the antivirus, a browser extension, the login screen, or Node 26 — all were
ruled out. The login screen was only *visible* because the DB reset removed the operator/session and redirected
to auth.

## Root cause: an inconsistent `.next` build artifact

`0.2.15` shipped a **stale/inconsistent `.next`**. The old `prebuild` only purged `.next/cache`, so
`next build` ran **incrementally over a stale `.next/server` + `.next/static`**. This repo lives under
**OneDrive** (`Documents\`), which offloads/syncs `.next` mid-build. The result: a published artifact whose
**server RSC/manifest referenced client-chunk state the emitted static chunks no longer matched**. That mismatch
is invisible to a server-side check (everything is 200) and only surfaces in a real browser, at hydration, as
the layout-router invariant. It happened to surface at the heaviest client component on `/login`
(`AnimToggle`), which misled an early bisect — but it is **not** a source bug: the *same source/version* built
cleanly works (proof: broken build `Of6-jFnSNoufAVztuYupK` vs a clean rebuild `i4Z…`/`nn5…` of identical
source — one crashes, one doesn't).

## How it's prevented now

Two layers, added in **0.2.16**:

1. **Clean release build.** `npm run validate` now runs `build:release`, which **purges the whole `.next`**
   (`clean:next`) before `next build` — the shipped artifact always compiles from an empty `.next`. The plain
   `npm run build` stays incremental for fast local iteration.
2. **A pre-publish smoke gate.** `npm run smoke` boots the built package in an isolated runtime and loads
   `/login` (both the **signin** and **signup** screens) in **headless Chrome**, failing (exit 1) if the page
   crashes at hydration. A `curl` check can't catch this; only a real browser can.

## Release procedure (do this every publish)

`npm publish --access public --ignore-scripts` **skips** `prepublishOnly`/`prepack`, so the gate is **manual**:

```bash
# 1. Bump the version (0.2.15 is taken; never republish an existing version)
#    package.json + CHANGELOG.md + CHANGELOG.pt-BR.md + README badges

# 2. Clean build (full .next purge) + typecheck + i18n parity
npm run validate

# 3. Smoke gate — /login signin + signup must hydrate clean in a real browser
npm run smoke
#    → "✓ smoke PASSED — safe to publish."  (exit 1 = DO NOT PUBLISH)

# 4. Mirror to the public repo, then publish the tarball
node scripts/publish-public.mjs --push
npm publish --access public --ignore-scripts
```

If `npm run smoke` fails, **do not publish** — rebuild clean (`npm run validate` already purges `.next`) and
re-run `npm run smoke` until green.

## If a bad build ever ships again

Symptoms: `/login` (or any page) shows "Something broke at the root / invariant expected layout router to be
mounted" in a clean browser, while `curl http://127.0.0.1:3000/login` returns 200.

- **Confirm** it's an artifact problem: a clean rebuild of the same source works. Compare `.next/BUILD_ID` of
  the broken install vs a fresh `npm run validate` build — different IDs, same source/version → bad artifact.
- **Unstick an install in place** (no republish): build clean locally (`npm run validate`), back up the broken
  build, and copy the fresh `.next` over the global install:
  ```bash
  PKG="$(npm root -g)/constellai"
  mv "$PKG/.next" "$PKG/.next.broken-$(date +%Y%m%d-%H%M%S)"
  cp -r ./.next "$PKG/.next"   # the clean local build
  ```
  Restart Constella → `/login` hydrates again.
- **Proper fix:** publish a new patch (`0.2.x+1`) built via `npm run validate` and verified by `npm run smoke`.

## Related

- The in-app self-updater installs the **exact resolved version** (not bare `@latest`) to dodge npm-registry
  `latest`-tag CDN lag, and runs from a neutral cwd to avoid the Windows `EBUSY` rename loop — see
  [UPDATE.md](UPDATE.md).
- The client auto-reloads once (cache-busting, loop-guarded) on a deployment-skew/invariant error, so a
  transient post-update crash self-heals instead of stranding the tab.
