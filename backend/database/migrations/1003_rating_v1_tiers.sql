-- TS: 2026-08-21 17:08 UTC

BEGIN;

ALTER TABLE monster_rating_runs
  DROP CONSTRAINT IF EXISTS rating_tier_check;

ALTER TABLE monster_rating_runs
  ADD CONSTRAINT rating_tier_check CHECK (
    tier IN (
      'Platinum',
      'Gold',
      'Silver',
      'Bronze',
      'Watch',
      'Goblin',
      'Cemetery',
      'Cemetery Risk',
      'Tier Boundary Unresolved'
    )
  );

COMMIT;
