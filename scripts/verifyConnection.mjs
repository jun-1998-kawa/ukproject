import { readFile } from 'node:fs/promises';

async function main() {
  const token = process.env.SEED_AUTH_TOKEN;
  if (!token) throw new Error('SEED_AUTH_TOKEN env missing');

  const outputsRaw = await readFile('amplify_outputs.json', 'utf-8');
  const outputs = JSON.parse(outputsRaw);
  const url = outputs?.data?.url;
  if (!url) throw new Error('data.url missing in amplify_outputs.json');

  const query = `query { listTargetMasters { items { code nameJa nameEn active order } } }`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': token },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  if (json.errors) {
    console.error('GraphQL errors:', JSON.stringify(json.errors, null, 2));
    process.exit(2);
  }
  const items = json?.data?.listTargetMasters?.items ?? [];
  console.log('OK: Connected. TargetMaster count =', items.length);
  for (const it of items) console.log('-', it.code, it.nameJa, '/', it.nameEn);
}

main().catch((e) => {
  console.error('Verify failed:', e.message || e);
  process.exit(1);
});

