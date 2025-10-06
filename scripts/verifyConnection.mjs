import { readFile } from 'node:fs/promises';
import https from 'node:https';
import { URL } from 'node:url';
import AWS from 'aws-sdk';

async function main() {
  const outputsRaw = await readFile('amplify_outputs.json', 'utf-8');
  const outputs = JSON.parse(outputsRaw);
  const url = process.env.SEED_API_URL || outputs?.data?.url;
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || outputs?.data?.aws_region;
  if (!url) throw new Error('data.url missing in amplify_outputs.json');
  console.log('[verify] Target URL:', url);

  const query = `query {
    listTargetMasters { items { code nameJa nameEn active order } }
    listMethodMasters { items { code nameJa nameEn active order } }
    listPositionMasters { items { code nameJa nameEn active order } }
  }`;
  const token = process.env.SEED_AUTH_TOKEN;
  const forceIAM = String(process.env.SEED_AUTH_MODE||'').toUpperCase()==='IAM';
  let json;
  if (token && !forceIAM) {
    console.log('[verify] Using Cognito ID token auth');
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': token }, body: JSON.stringify({ query }) });
    json = await res.json();
  } else {
    console.log('[verify] Using AWS_IAM signature auth');
    if (!region) throw new Error('AWS region not resolved. Set AWS_REGION or add aws_region to amplify_outputs.json');
    // IAM-signed request
    AWS.config.update({ region });
    const endpoint = new URL(url);
    const req = new AWS.HttpRequest(endpoint.href, region);
    req.method = 'POST';
    req.headers['host'] = endpoint.host;
    req.headers['Content-Type'] = 'application/json';
    req.body = JSON.stringify({ query });
    const signer = new AWS.Signers.V4(req, 'appsync', true);
    await new Promise((resolve, reject) => {
      AWS.config.getCredentials((err) => (err ? reject(err) : resolve()));
    });
    signer.addAuthorization(AWS.config.credentials, AWS.util.date.getDate());
    const resp = await new Promise((resolve, reject) => {
      const httpReq = https.request({
        hostname: endpoint.hostname,
        method: req.method,
        path: endpoint.pathname,
        headers: req.headers,
      }, (res) => {
        let data = '';
        res.on('data', (d) => (data += d));
        res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
      });
      httpReq.on('error', reject);
      httpReq.write(req.body || '');
      httpReq.end();
    });
    json = JSON.parse(resp.body || '{}');
  }
  if (json.errors) {
    console.error('GraphQL errors:', JSON.stringify(json.errors, null, 2));
    process.exit(2);
  }
  const tItems = json?.data?.listTargetMasters?.items ?? [];
  const mItems = json?.data?.listMethodMasters?.items ?? [];
  const pItems = json?.data?.listPositionMasters?.items ?? [];
  console.log('OK: Connected.');
  console.log('  TargetMaster  count =', tItems.length);
  console.log('  MethodMaster  count =', mItems.length);
  console.log('  PositionMaster count =', pItems.length);
  const show = (arr) => arr.slice(0, 12).map(it=> `${it.code}:${it.nameJa||it.nameEn||''}`).join(', ');
  console.log('  Targets  ->', show(tItems));
  console.log('  Methods  ->', show(mItems));
  console.log('  Positions->', show(pItems));
}

main().catch((e) => {
  console.error('Verify failed:', e.message || e);
  process.exit(1);
});
