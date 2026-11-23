# adarsh.fun

Personal site for Adarsh Singh. Built with Astro as a static site, deployed to GitHub Pages.

## What is in here

- `src/components/` one file per section of the page
- `src/data/` snapshot data for GitHub contributions and Hugging Face downloads
- `scripts/fetch-data.mjs` refreshes those snapshots (it runs before every build)
- `public/resume/` the current resume PDF

The Hugging Face numbers also refresh in the browser each time the page loads.

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

`npm run build` refreshes the data first. For the GitHub graph it needs a token, so it uses `GITHUB_TOKEN` when set and otherwise `gh auth token`. If a fetch fails, the last snapshot is kept.

## Deploy

Pushing to `main` builds and deploys through `.github/workflows/deploy.yml`. The workflow also runs every day so the numbers stay fresh.
