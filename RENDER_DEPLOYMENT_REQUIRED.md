# Render Deployment Required

<!-- TS: 2026-08-02 15:50 ET -->

## Confirmed production blocker

GitHub Actions production smoke run `30761741073` checked the live Render API 10 times over approximately five minutes.

Every check returned:

- live API version `0.3.0`
- expected API version `0.6.0`
- production database not configured
- bulk universe store not configured

The repository factory code is committed and has passed backend and static validation. Render has not deployed the current `main` branch or synchronized the current Blueprint configuration.

## Render dashboard steps

1. Open the Render Dashboard.
2. Open the service named `next-years-monsters-api`.
3. Open **Settings** and confirm:
   - linked repository is `Poppoparazzi/-TS-2026-07-28-22-35-ET-next-years-monsters-website`
   - linked branch is `main`
   - Root Directory is `backend`
   - Auto-Deploy is **On Commit** or **After CI Checks Pass**
4. If this service is managed by a Blueprint:
   - open **Blueprints** in the Render Dashboard
   - open the Blueprint connected to this repository
   - run **Manual Sync** if automatic sync is not active
5. Open the service **Environment** page and confirm these variables:
   - `DATABASE_URL` is connected to `next-years-monsters-db`
   - `SEC_USER_AGENT` has a real identifying value and contact email
   - `MARKET_DATA_PROVIDER=unconfigured`
   - `AUTO_IMPORT_UNIVERSE_LIMIT=100`
   - `AUTO_SEC_BATCH_SIZE=100`
   - `SEC_BATCH_CONCURRENCY=3`
   - `SEC_BATCH_MAX_AGE_HOURS=24`
   - `AUTO_REFRESH_PILOT_ON_START=true`
   - `PILOT_REFRESH_MAX_AGE_HOURS=24`
6. Save environment changes using **Save, rebuild, and deploy**.
7. Open **Deploys** and choose **Manual Deploy → Deploy latest commit**.
8. Do not choose **Restart service**. Restarting reuses the currently deployed old commit.

## Expected deploy log sequence

The successful deployment should show:

1. backend dependency installation
2. TypeScript checks and backend tests
3. TypeScript build
4. database migrations
5. database verification
6. API startup
7. 100-company universe import
8. 100-company SEC evidence batch
9. guarded pilot refresh

## Completion checks

The deployment is complete only when all of these are true:

- `/api/health` returns version `0.6.0`
- database provider is configured
- SEC provider is configured
- universe provider is configured
- `/api/universe/status?limit=100` returns at least 100 companies
- queued, processing, complete, partial, failed, and stale counts total the examined company count
- `factory-status.html` displays production counts instead of an unavailable message
- production smoke workflow passes

## Important secret-variable note

`SEC_USER_AGENT` is declared with `sync: false` in `render.yaml`. For an existing Render Blueprint, that secret must be added manually in the Render Dashboard. Updating the YAML file alone does not populate its value.
