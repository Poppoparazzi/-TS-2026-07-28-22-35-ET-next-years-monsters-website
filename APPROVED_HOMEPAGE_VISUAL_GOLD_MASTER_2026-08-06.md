<!-- TS: 2026-08-06 08:26 ET -->
# Next Year’s Monsters™ Approved Homepage Visual Gold Master

## Approval

The homepage mockup approved by the owner on 2026-08-06 is the permanent visual specification for rebuilding and verifying the live homepage.

## Protected references

- Locked visual-reference branch: `locked/approved-homepage-visual-2026-08-06`
- Protected live-code checkpoint branch: `backup/live-main-before-gold-master-2026-08-06`
- Code checkpoint commit: `540d75877026074631fb0e085a37d0622100475b`
- Approved PNG filename: `2026-08-06_0826_Approved_Homepage_Gold_Master_NextYearsMonsters.png`
- Approved PNG dimensions: `1672 × 941`
- Approved PNG SHA-256: `83511004e43397d2df99385596a2c665cbee23881a935fa4dbefc8eb4ef40196`

## Persistent backup location

The exact approved PNG, checksum, restore instructions, and ZIP restore package are stored in the ChatGPT Library folder:

`/Next Years Monsters/Gold Masters/Homepage 2026-08-06/`

## Visual requirements that must not drift

- Large, readable market ticker tape.
- Large headline with comfortable spacing and the approved centered balance.
- Fingerprint positioned between the copy and the hero artwork.
- Captain Breakout™ and the complete bull visible.
- Bull dust plume visible.
- Rising chart and arrow visible.
- No large empty center gap.
- No next section showing inside the opening hero viewport.
- Dark editorial palette with lime, cream, gold, and black.

## Change-control rule

Do not redesign or replace the approved homepage visual without explicit owner approval. All future homepage work must occur on a separate branch and must be compared visually with the approved PNG before merging.

## Important distinction

The approved image is now locked as the visual Gold Master. The code checkpoint is protected, but the final site-wide Gold Master must be created only after the live homepage has been visually verified against the approved image and the remaining pages have been approved.

## Emergency restore procedure

1. Restore the last verified Gold Master tree onto a new deployment commit.
2. Push that new commit to `main` so the host republishes it.
3. Compare the live homepage against the approved PNG.
4. Use `Ctrl + F5` only after the deployment finishes.
5. Do not resume feature work until the restored live page is visually confirmed.
