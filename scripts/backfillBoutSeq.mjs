#!/usr/bin/env node
/**
 * Backfill Bout.seq (input order) per match.
 *
 * Auth:
 *  - Preferred: set env AUTH_ID_TOKEN to a valid Cognito IdToken (will be sent as Authorization header)
 *  - Or: provide AWS credentials (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION) to use SigV4 (AWS_IAM)
 *
 * Usage:
 *   node scripts/backfillBoutSeq.mjs [--region ap-northeast-1] [--dry-run]
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
// Resolve amplify_outputs.json
let outputsPath = process.env.AMPLIFY_OUTPUTS_PATH || path.join(ROOT, 'amplify_outputs.json')
if (!fs.existsSync(outputsPath)) {
  const parent = path.join(ROOT, '..', 'amplify_outputs.json')
  if (fs.existsSync(parent)) outputsPath = parent
}
let outputs = {}
if (fs.existsSync(outputsPath)) {
  outputs = JSON.parse(fs.readFileSync(outputsPath, 'utf8'))
} else {
  console.warn('[backfill] amplify_outputs.json not found. Falling back to env GRAPHQL_URL/AWS_REGION.')
}
const GRAPHQL_URL = process.env.GRAPHQL_URL || outputs?.data?.url
const DEFAULT_REGION = outputs?.data?.aws_region || process.env.AWS_REGION || 'ap-northeast-1'
const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const regionArgIdx = args.indexOf('--region')
const REGION = regionArgIdx >= 0 ? (args[regionArgIdx + 1] || DEFAULT_REGION) : DEFAULT_REGION

if (!GRAPHQL_URL) {
  console.error('GraphQL URL not found. Set GRAPHQL_URL env or provide amplify_outputs.json (or AMPLIFY_OUTPUTS_PATH).')
  process.exit(1)
}

// Minimal SigV4 signer if no ID token is present (optional)
async function signedFetch(url, { method = 'POST', headers = {}, body } = {}) {
  if (process.env.AUTH_ID_TOKEN) {
    return fetch(url, { method, headers: { 'Content-Type': 'application/json', Authorization: process.env.AUTH_ID_TOKEN, ...headers }, body })
  }
  // Try AWS_IAM if credentials are present
  const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN } = process.env
  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
    throw new Error('Missing AUTH_ID_TOKEN or AWS credentials for SigV4')
  }
  const crypto = await import('node:crypto')
  const service = 'appsync'
  const amzdate = new Date().toISOString().replace(/[:-]|\u0000/g, '').replace(/\.\d{3}Z$/, 'Z')
  const date = amzdate.slice(0, 8)
  const host = new URL(url).host
  const canonicalUri = '/graphql'
  const canonicalQuerystring = ''
  const payloadHash = crypto.createHash('sha256').update(body || '', 'utf8').digest('hex')
  const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-amz-date:${amzdate}\n`
  const signedHeaders = 'content-type;host;x-amz-date'
  const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQuerystring}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`
  const algorithm = 'AWS4-HMAC-SHA256'
  const credentialScope = `${date}/${REGION}/${service}/aws4_request`
  const stringToSign = `${algorithm}\n${amzdate}\n${credentialScope}\n${crypto.createHash('sha256').update(canonicalRequest, 'utf8').digest('hex')}`
  const kDate = crypto.createHmac('sha256', 'AWS4' + AWS_SECRET_ACCESS_KEY).update(date).digest()
  const kRegion = crypto.createHmac('sha256', kDate).update(REGION).digest()
  const kService = crypto.createHmac('sha256', kRegion).update(service).digest()
  const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest()
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex')
  const authorizationHeader = `${algorithm} Credential=${process.env.AWS_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
  const finalHeaders = {
    'Content-Type': 'application/json',
    'X-Amz-Date': amzdate,
    Authorization: authorizationHeader,
  }
  if (AWS_SESSION_TOKEN) finalHeaders['X-Amz-Security-Token'] = AWS_SESSION_TOKEN
  return fetch(url, { method, headers: { ...finalHeaders, ...headers }, body })
}

const listMatches = `query ListMatches($limit:Int,$nextToken:String){ listMatches(limit:$limit,nextToken:$nextToken){ items{ id heldOn createdAt } nextToken } }`
// Some environments may not have 'seq' on Bout yet. Query only safe fields.
const listBoutsByMatch = `query ListBoutsByMatch($matchId:ID!,$limit:Int,$nextToken:String){ listBoutsByMatch(matchId:$matchId,limit:$limit,nextToken:$nextToken){ items{ id createdAt } nextToken } }`
// Keep selection minimal to avoid schema mismatches on old APIs
const updateBout = `mutation UpdateBout($input: UpdateBoutInput!){ updateBout(input:$input){ id } }`
// Preflight: detect if Bout.seq exists on the API
const listBoutsWithSeq_check = `query ListBoutsByMatchSeq($matchId:ID!,$limit:Int){ listBoutsByMatch(matchId:$matchId,limit:$limit){ items{ id seq } } }`

async function gql(query, variables) {
  const res = await signedFetch(GRAPHQL_URL, { method: 'POST', body: JSON.stringify({ query, variables }) })
  const json = await res.json()
  if (json.errors) throw new Error(JSON.stringify(json.errors))
  return json.data
}

async function* iterMatches() {
  let nextToken = null
  do {
    const data = await gql(listMatches, { limit: 200, nextToken })
    const page = data.listMatches
    for (const m of page.items || []) yield m
    nextToken = page.nextToken || null
  } while (nextToken)
}

async function getBouts(matchId) {
  let acc = []
  let nextToken = null
  do {
    const data = await gql(listBoutsByMatch, { matchId, limit: 200, nextToken })
    const page = data.listBoutsByMatch
    acc = acc.concat(page.items || [])
    nextToken = page.nextToken || null
  } while (nextToken)
  return acc
}

async function main() {
  console.log(`[backfill] GraphQL: ${GRAPHQL_URL}`)
  // Preflight check against the first match to see if 'seq' is supported
  let seqSupported = true
  try {
    // Try small call; we only need an existing matchId. If none, skip.
    const firstPage = await gql(listMatches, { limit: 1 })
    const firstMatch = firstPage?.listMatches?.items?.[0]
    if (firstMatch) {
      try { await gql(listBoutsWithSeq_check, { matchId: firstMatch.id, limit: 1 }) }
      catch (e) { seqSupported = false }
    }
  } catch {}
  if (!seqSupported) {
    console.error('[backfill] The API does not expose Bout.seq yet. Please deploy the backend schema with Bout.seq and retry.')
    console.error('Hint: amplify/data/resource.ts should define Bout.seq; then deploy (e.g., npx ampx push or CI pipeline).')
    process.exit(1)
  }
  const updates = []
  for await (const m of iterMatches()) {
    const bouts = await getBouts(m.id)
    if (!bouts.length) continue
    const sorted = bouts
      .slice()
      .sort((a, b) => (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) || String(a.id).localeCompare(String(b.id)))
    let expected = 1
    for (const b of sorted) {
      if (b.seq !== expected) updates.push({ id: b.id, seq: expected, matchId: m.id })
      expected++
    }
  }
  console.log(`[backfill] Pending updates: ${updates.length}`)
  if (DRY_RUN || updates.length === 0) return
  for (const u of updates) {
    await gql(updateBout, { input: { id: u.id, seq: u.seq } })
    console.log(`updated ${u.id} -> seq=${u.seq}`)
  }
}

main().catch(e => { console.error(e?.message || e); process.exit(1) })
