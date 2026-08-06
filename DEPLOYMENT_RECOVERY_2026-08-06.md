<!-- TS: 2026-08-06 10:48 ET -->
# Frontend Deployment Recovery

## Approved homepage visual

- Reference: `approved-homepage-gold-master-2026-08-06`
- Live frontend branch: `main`
- Public deployment marker: `2026-08-06-homepage-recovery-1045-ET`

## GitHub Pages deployment

- Workflow: `.github/workflows/deploy-pages.yml`
- Trigger: every push to `main`, plus manual workflow dispatch
- Static source: repository root
- Jekyll processing disabled by `.nojekyll`

## Homepage connection status

The homepage contains a `DATA STATUS` strip with:

- Market Charts: external and possibly delayed
- SEC Evidence: checks the Render backend health endpoint
- Monster Ratings: verified-versus-demonstration status

The SEC indicator is implemented in `assets/home-data-status.js` and uses the backend URL in `assets/runtime-config.js`.

## Verification

After deployment, `/site-version.json` must report:

- `release`: `2026-08-06-homepage-recovery-1045-ET`
- `sec_connection_strip`: `true`

Do not call the homepage deployed or approved until the public domain serves this release marker and the user visually approves the live page.
