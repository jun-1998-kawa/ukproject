/*
  Verifies connectivity to the Amplify Gen 2 GraphQL API using the current amplify_outputs.json.
  Usage:
    set AUTH token env (Cognito ID token belonging to ADMINS/COACHES user)
      - PowerShell:  $env:SEED_AUTH_TOKEN = "<id token>"
      - bash/zsh:   export SEED_AUTH_TOKEN="<id token>"
    then:
      npx ts-node scripts/verifyConnection.ts
*/
import fs from 'node:fs';
import path from 'node:path';
import fetch from 'cross-fetch';

type AmplifyOutputs = {
  data?: { url?: string };
};

function getApiUrl(): string {
  const guess = path.resolve('amplify_outputs.json');
  if (!fs.existsSync(guess)) {
    throw new Error('amplify_outputs.json not found at repo root. Start sandbox or deploy first.');
  }
  const j = JSON.parse(fs.readFileSync(guess, 'utf-8')) as AmplifyOutputs;
  const url = j?.data?.url;
  if (!url) throw new Error('data.url missing in amplify_outputs.json');
  return url;
}

async function main() {
  const url = getApiUrl();
  const token = process.env.SEED_AUTH_TOKEN;
  if (!token) throw new Error('SEED_AUTH_TOKEN env missing');

  const query = /* GraphQL */ `
    query VerifyTargets { listTargetMasters { items { code nameJa nameEn active order } } }
  `;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token,
    },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  if (json.errors) {
    console.error('GraphQL errors:', JSON.stringify(json.errors, null, 2));
    process.exit(2);
  }
  const items = json?.data?.listTargetMasters?.items ?? [];
  console.log('OK: Connected. TargetMaster count =', items.length);
  console.table(items);
}

main().catch((e) => {
  console.error('Verify failed:', e.message || e);
  process.exit(1);
});

