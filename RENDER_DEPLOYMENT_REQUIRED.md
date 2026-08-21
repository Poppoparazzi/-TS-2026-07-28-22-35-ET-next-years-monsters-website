# Render Deployment Required

<!-- TS: 2026-08-21 15:16 UTC -->

## Confirmed production blocker

The repository contains the current backend recovery and reserve/backfill strategy, but Render must deploy the current `main` branch and synchronize the current Blueprint configuration before production can use it.

The production strategy is intentionally overfilled:

- candidate universe: **5,000**
- SEC startup batch capacity: **5,000**
- usable SEC evidence-ready target: **2,200 or more**
- SEC worker concurrency: **8**
- completed-record refresh age: **720 hours / 30 days**

The purpose is to stop treating the original fixed 2,000 attempted stocks as the finish line. Ordinary failures become auditable replaceable exceptions while successful reserve candidates push the usable SEC evidence-ready population to at least 2,200. Protected pilot and strategic stocks remain mandatory repair targets and must not be silently replaced.

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
5. Open the service **Environment** page and confirm these current values:
   - `DATABASE_URL` is connected to `next-years-monsters-db`
   - `SEC_USER_AGENT` has a real identifying value and contact email
   - `MARKET_DATA_PROVIDER=unconfigured`
   - `AUTO_IMPORT_UNIVERSE_LIMIT=5000`
   - `AUTO_SEC_BATCH_SIZE=5000`
   - `SEC_USABLE_TARGET=2200`
   - `SEC_BATCH_CONCURRENCY=8`
   - `SEC_BATCH_MAX_AGE_HOURS=720`
   - `AUTO_REFRESH_PILOT_ON_START=true`
   - `PILOT_REFRESH_MAX_AGE_HOURS=24`
6. Save environment changes using **Save, rebuild, and deploy**.
7. Open **Deploys** and choose **Manual Deploy → Deploy latest commit**.
8. Do not choose **Restart service**. Restarting can reuse the currently deployed old commit instead of deploying current `main`.

## Expected deploy log sequence

The successful deployment should show:

1. backend dependency installation
2. TypeScript checks and backend tests
3. TypeScript build
4. database migrations
5. database verification
6. API startup
7. up-to-5,000-company universe import
8. reserve-first SEC evidence batch, stopping only after the usable target is satisfied under the current protection rules
9. guarded pilot refresh for protected important stocks

## Completion checks

The deployment is complete only when all of these are true:

- `/api/health` returns version `0.6.0`
- database provider is configured
- SEC provider is configured
- universe provider is configured
- `/api/startup-status` reports the current backfill policy rather than stale values
- `/api/ratings/AAPL` exists and fails closed with `score: null` until real provider-backed rating inputs are connected
- `/api/universe/status?limit=5000` can report the loaded reserve population without a hidden 2,000 or 2,500 ceiling
- pipeline-state counts reconcile with the examined company count
- SEC evidence-ready reaches **at least 2,200** without requiring every ordinary exception to resolve
- ordinary failures are retained in the replaceable roster and replaced from the reserve
- protected pilot and strategic stocks are SEC evidence-ready before the reserve worker declares the target satisfied
- `quoteCompleteCount` and `ratingCompleteCount` advance only from real provider data
- `factory-status.html` displays production counts instead of an unavailable message
- production smoke workflow passes

## Important secret-variable note

`SEC_USER_AGENT` is declared with `sync: false` in `render.yaml`. For an existing Render Blueprint, that secret must be added manually in the Render Dashboard. Updating the YAML file alone does not populate its value.

## Deployment authority used by the hourly recovery

The prepared recovery workflow can trigger Render automatically only when either:

- `RENDER_DEPLOY_HOOK_URL` is available, or
- both `RENDER_API_KEY` and `RENDER_SERVICE_ID` are available.

The prepared Vercel collateral path remains separate and requires `VERCEL_TOKEN`. The frontend must remain pointed at Render unless an alternate backend is actually deployed and verified.
