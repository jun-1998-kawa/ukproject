Ops Notes

TypeScript Type Check
- Requirements: Node.js 18+ (LTS recommended) and npm.
- Commands (from repo root):
  - npm ci
  - npm run typecheck         # Amplify/backend TS
  - npm run typecheck:web     # Web UI TS

Web Build (optional)
- npm run build:web

Backfill Bout.seq
- Purpose: Preserve bout display order by input order.
- Script: scripts/backfillBoutSeq.mjs (invoked via web script or from repo root).
- Auth: Set `AUTH_ID_TOKEN` (preferred) or AWS creds for SigV4. Region defaults to outputs or `AWS_REGION`.
- Recommended: Dry run first; then run for real.
- Options:
  - From repo root:
    - `node scripts/backfillBoutSeq.mjs --dry-run`
    - `node scripts/backfillBoutSeq.mjs`
  - From `web/`:
    - `npm run backfill:boutSeq -- --dry-run`
    - `npm run backfill:boutSeq`
  - If running from `web/` and outputs are not found, either:
    - `set AMPLIFY_OUTPUTS_PATH=..\amplify_outputs.json` (Windows) or `export AMPLIFY_OUTPUTS_PATH=../amplify_outputs.json`
    - or set `GRAPHQL_URL` env directly

Environment
- Requires a valid ID token in AUTH_ID_TOKEN or the script’s built‑in auth flow.
- Requires AWS credentials configured for the target Amplify backend.

Notes
- YouTube playlist settings are read/written via TournamentMaster.youtubePlaylist and also cached in localStorage under key yt.playlists.
- Player qualitative notes are stored per (playerId, matchId) via PlayerNote; overall per‑player notes are Player.notes.
