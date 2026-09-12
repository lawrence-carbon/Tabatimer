# Tabatimer

A simple browser workout timer for series, reps, and rest.

**Live:** [lawrence-carbon.github.io/Tabatimer](https://lawrence-carbon.github.io/Tabatimer/)

Open `index.html` in any modern browser — no build step required.

Installable as a PWA (Chrome/Edge “Install” in the URL bar) for a standalone, app-like window.

## What it does

- Set **work** length, **rest** between reps, **reps**, and **sets**
- Optional **rest between sets**
- 5-second get-ready countdown
- Pause / resume, skip phase, end session
- Audio cues on phase changes and the last 3 seconds of each interval

## Quick start

```bash
# optional local server
python3 -m http.server 4173
# then open http://localhost:4173
```

Or just double-click `index.html`.

## GitHub Pages

The static site is published from the `gh-pages` branch.

If the live link 404s, enable Pages once:

1. Repo **Settings → Pages**
2. **Build and deployment → Source:** Deploy from a branch
3. Branch: `gh-pages` / `/` (root) → **Save**

After that, the site is at `https://lawrence-carbon.github.io/Tabatimer/`.

Pushing to `main` can also redeploy via `.github/workflows/deploy-pages.yml` once Pages is set to **GitHub Actions** (optional alternative to the branch source).
