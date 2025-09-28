import { readFile } from 'node:fs/promises';

async function gql(url, token, query, variables) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': token },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

async function loadJSON(p) {
  return JSON.parse(await readFile(p, 'utf-8'));
}

async function seed(kind, items, url, token) {
  const map = {
    Target: 'createTargetMaster',
    Method: 'createMethodMaster',
    Position: 'createPositionMaster',
  };
  const field = map[kind];
  const mutation = `mutation($input: Create${kind}MasterInput!){ ${field}(input:$input){ code } }`;
  for (const it of items) {
    const input = { ...it, active: it.active ?? true };
    try {
      await gql(url, token, mutation, { input });
      console.log(`[OK] ${kind} ${it.code}`);
    } catch (e) {
      const msg = String(e?.message || e);
      if (msg.includes('ConditionalCheckFailed') || msg.includes('exists') || msg.includes('Conflict')) {
        console.log(`[SKIP] ${kind} ${it.code}`);
      } else {
        console.error(`[ERR] ${kind} ${it.code} -> ${msg}`);
      }
    }
  }
}

async function main() {
  const token = process.env.SEED_AUTH_TOKEN;
  if (!token) throw new Error('SEED_AUTH_TOKEN env missing');
  const outputs = JSON.parse(await readFile('amplify_outputs.json', 'utf-8'));
  const url = outputs?.data?.url;
  if (!url) throw new Error('data.url missing in amplify_outputs.json');

  const targets = await loadJSON('seed/targets.json');
  const methods = await loadJSON('seed/methods.json');
  const positions = await loadJSON('seed/positions.json');

  await seed('Target', targets, url, token);
  await seed('Method', methods, url, token);
  await seed('Position', positions, url, token);
}

main().catch((e) => {
  console.error('Seed failed:', e.message || e);
  process.exit(1);
});

