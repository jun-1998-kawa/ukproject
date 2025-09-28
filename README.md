# Kendo Club Analysis Engine (Amplify Gen 2)

This repository contains the initial Amplify Gen 2 backend scaffolding and data model for the university kendo club analytics app. It’s designed to be low-cost, extensible, and to support a future transition from “point-only logging” to full action logs.

## What’s included

- Amplify backend composition: `amplify/backend.ts`
- Auth with user groups (RBAC): `amplify/auth/resource.ts`
- Data schema (models + enums): `amplify/data/resource.ts`
- TypeScript config for backend: `amplify/tsconfig.json`
- Type check script: `npm run typecheck`

## Models overview

- Master: `University`, `Venue`, `Player`, `TechniqueDictionary`
- Competition: `Match`, `Bout`
- Logging (current): `Point` — valid scoring events only
- Logging (future-ready): `Exchange`, `Action` — for full technique logging

Label masters (Japanese + English): `TargetMaster`, `MethodMaster`, `PositionMaster`.

Key enums: `Target (MEN/KOTE/DO/TSUKI)`, `Method (SURIAGE/KAESHI/NUKI/DEBANA/HIKI/HARAI/KATSUGI/RENZOKU)`, `Stance`, `Position`, `WinType`, `PointJudgement`.

## Local setup

1. Node.js 18+ recommended.
2. Install deps:
   ```bash
   npm install
   ```
3. Type check backend:
   ```bash
   npm run typecheck
   ```
4. (Optional) Start an Amplify sandbox to iterate locally:
   ```bash
   npx ampx sandbox
   ```

## Frontend (web)

Under `web/` a minimal React + Vite app is provided:
- Auth via Amplify Authenticator
- Lists Matches → Bouts → Points using the GraphQL endpoint from `amplify_outputs.json`

Run locally:
```bash
cd web
npm install
npm run dev
```
Open http://localhost:5173 and sign in with a Cognito user (ADMINS/COACHES). The app reads `../amplify_outputs.json` for configuration.

## Seed master data (JA/EN labels)

Masters are stored in JSON under `seed/`. To insert them into your API:

1) Ensure the API is deployed (sandbox or cloud) and you have a valid user in `ADMINS` or `COACHES`.

2) Obtain the GraphQL endpoint URL and an ID token:
   - Endpoint: from `amplify_outputs.json` → `data.url`
   - ID token: sign in to your app (Amplify Auth) and copy the Cognito ID token, or use sandbox auth.

3) Install tooling and run the seeder:
   ```bash
   npm install
   export SEED_API_URL="https://<appsync-endpoint>.amazonaws.com/graphql"
   export SEED_AUTH_TOKEN="<Cognito ID token>"
   npx ts-node scripts/seedMasters.ts
   ```
   Re-running is safe; conflicts are skipped.

## Deploy (high level)

1. Initialize Amplify in your AWS account (Gen 2, code-first).
2. Push backend (auth + data). Ensure Cognito groups exist: `ADMINS`, `COACHES`, `ANALYSTS`, `VIEWERS`.
3. Connect the repo to Amplify Hosting for CI/CD (frontend to be added).

## Notes

- The data model separates `Target` (MEN/KOTE/DO/TSUKI) from `Method` (e.g., SURIAGE/KAESHI…).
- Japanese labels are always paired via `TargetMaster`/`MethodMaster` and also per technique in `TechniqueDictionary (nameJa/nameEn)`.
- `Point.techniqueKey` is a denormalized string to support efficient filtering by target+methods without array indexing.
- Future migration to full logging only requires enabling `Exchange`/`Action` in the UI; existing analytics can continue to read from `Point`.
