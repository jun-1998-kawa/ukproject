/*
  Simple seeding script for Target/Method/Position masters.
  Requirements:
    - Install deps: npm i aws-amplify cross-fetch
    - Provide GraphQL endpoint and Auth token:
        SEED_API_URL=...   (from amplify_outputs.json -> data -> url)
        SEED_AUTH_TOKEN=... (Cognito ID token for a user in ADMINS or COACHES)
    - Run: npx ts-node scripts/seedMasters.ts
*/

import fs from 'node:fs';
import path from 'node:path';
import fetch from 'cross-fetch';

type MasterItem = { code: string; nameJa: string; nameEn: string; order?: number; active?: boolean };

const API_URL = process.env.SEED_API_URL ?? '';
const AUTH = process.env.SEED_AUTH_TOKEN ?? '';

if (!API_URL || !AUTH) {
  console.error('Missing SEED_API_URL or SEED_AUTH_TOKEN env.');
  process.exit(1);
}

async function gql<T>(query: string, variables: Record<string, any>): Promise<T> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': AUTH,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) {
    // Surface first error but continue decision left to caller
    throw new Error(JSON.stringify(json.errors));
  }
  return json.data as T;
}

const createTarget = /* GraphQL */ `
mutation CreateTargetMaster($input: CreateTargetMasterInput!) {
  createTargetMaster(input: $input) { code }
}`;
const createMethod = /* GraphQL */ `
mutation CreateMethodMaster($input: CreateMethodMasterInput!) {
  createMethodMaster(input: $input) { code }
}`;
const createPosition = /* GraphQL */ `
mutation CreatePositionMaster($input: CreatePositionMasterInput!) {
  createPositionMaster(input: $input) { code }
}`;

async function seed(kind: 'Target'|'Method'|'Position', items: MasterItem[]) {
  for (const it of items) {
    const input = { ...it, active: it.active ?? true };
    try {
      if (kind === 'Target') await gql(createTarget, { input });
      else if (kind === 'Method') await gql(createMethod, { input });
      else await gql(createPosition, { input });
      console.log(`[OK] ${kind} ${it.code}`);
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg.includes('ConditionalCheckFailed') || msg.includes('already exists') || msg.includes('Conflict')) {
        console.log(`[SKIP] ${kind} ${it.code} (exists)`);
      } else {
        console.error(`[ERR] ${kind} ${it.code} -> ${msg}`);
      }
    }
  }
}

function readJSON(file: string): MasterItem[] {
  const p = path.resolve(file);
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as MasterItem[];
}

async function main() {
  const targets = readJSON('seed/targets.json');
  const methods = readJSON('seed/methods.json');
  const positions = readJSON('seed/positions.json');
  await seed('Target', targets);
  await seed('Method', methods);
  await seed('Position', positions);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

