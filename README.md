<!-- TS: 2026-07-28 19:20 ET -->
# Next Year’s Monsters™ Five-Page Rebuild

This package reconstructs the short Codex-style website prototype as a durable folder that can be placed in GitHub.

## Included pages

1. `index.html` — full-color landing page, Captain Breakout frame, and approved bull-sound button.
2. `monster-check.html` — working search across the 15 VCL stocks.
3. `how-it-works.html` — Monster Rating™, Monster DNA™, Market Weather™, Tipping Point™, and VCL™ process.
4. `vcl-library.html` — the 15-company Visual Case Library list.
5. `about.html` — project and rollout explanation.

## What works now

- Five-page responsive website.
- Search by ticker or company name for all 15 VCL companies.
- Clearly labeled illustrative demo scores.
- Bull-sound button wired to the approved TuneTank WAV filename.
- Captain Breakout image frame uses `object-fit: contain`, preventing the head crop.
- No external libraries are required.

## What still requires the original assets

Place these exact files in `assets/`:

- `captain_breakout.png`
- `tunetank-bull-mad-mooing.wav`

The code intentionally does not invent or substitute either approved asset.

## What is not live yet

- The package is not connected to `NextYearsMonsters.com`.
- The package is not yet stored in a GitHub repository.
- The ratings are not live market calculations.
- The waitlist, accounts, subscriptions, alerts, and live charts require backend services.

## Preview locally

Because the site loads `data/stocks.json`, start a small local server from this folder.

Windows PowerShell:

    python -m http.server 8000

Then open:

    http://localhost:8000

## GitHub Pages deployment

1. Create a repository named `next-years-monsters-website`.
2. Upload every file and folder in this package.
3. Open **Settings → Pages**.
4. Choose **Deploy from a branch**.
5. Select `main` and `/ (root)`.
6. Save.

After the repository exists and is shared with the connected GitHub app, the files can be inspected and updated directly.
