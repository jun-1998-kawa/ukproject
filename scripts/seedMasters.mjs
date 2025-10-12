import { readFile } from 'node:fs/promises';
import https from 'node:https';
import { URL } from 'node:url';
import AWS from 'aws-sdk';

async function gql(url, token, region, query, variables) {
  const forceIAM = String(process.env.SEED_AUTH_MODE||'').toUpperCase()==='IAM';
  if (token && !forceIAM) {
    console.log('[seed] Using Cognito ID token auth');
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': token }, body: JSON.stringify({ query, variables }) });
    const json = await res.json();
    if (json.errors) throw new Error(JSON.stringify(json.errors));
    return json.data;
  }
  // IAM-signed
  console.log('[seed] Using AWS_IAM signature auth');
  if (!region) throw new Error('AWS region required for IAM signing');
  AWS.config.update({ region });
  const endpoint = new URL(url);
  const req = new AWS.HttpRequest(endpoint.href, region);
  req.method = 'POST';
  req.headers['host'] = endpoint.host;
  req.headers['Content-Type'] = 'application/json';
  req.body = JSON.stringify({ query, variables });
  await new Promise((resolve, reject) => AWS.config.getCredentials((e) => (e ? reject(e) : resolve())));
  const signer = new AWS.Signers.V4(req, 'appsync', true);
  signer.addAuthorization(AWS.config.credentials, AWS.util.date.getDate());
  const resp = await new Promise((resolve, reject) => {
    const httpReq = https.request({ hostname: endpoint.hostname, method: req.method, path: endpoint.pathname, headers: req.headers }, (res) => {
      let data = '';
      res.on('data', (d) => (data += d));
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    });
    httpReq.on('error', reject);
    httpReq.write(req.body || '');
    httpReq.end();
  });
  const json = JSON.parse(resp.body || '{}');
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

async function loadJSON(p) {
  const raw = await readFile(p, 'utf-8');
  const clean = raw.replace(/^\uFEFF/, ''); // strip BOM if present
  return JSON.parse(clean);
}

async function seed(kind, items, url, token, region) {
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
      await gql(url, token, region, mutation, { input });
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
  const outputs = JSON.parse(await readFile('amplify_outputs.json', 'utf-8'));
  const url = process.env.SEED_API_URL || outputs?.data?.url;
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || outputs?.data?.aws_region;
  if (!url) throw new Error('data.url missing in amplify_outputs.json');
  if (!token && !region) throw new Error('Provide SEED_AUTH_TOKEN or configure AWS_REGION for IAM signing');
  console.log('[seed] Target URL:', url);

  const targets = await loadJSON('seed/targets.json');
  const methods = await loadJSON('seed/methods.json');
  const positions = await loadJSON('seed/positions.json');

  await seed('Target', targets, url, token, region);
  await seed('Method', methods, url, token, region);
  await seed('Position', positions, url, token, region);
}

main().catch((e) => {
  console.error('Seed failed:', e.message || e);
  process.exit(1);
});
