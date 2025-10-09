import { readFile } from 'node:fs/promises'
import https from 'node:https'
import { URL } from 'node:url'
import AWS from 'aws-sdk'

async function gql(url, token, region, query, variables) {
  const forceIAM = String(process.env.SEED_AUTH_MODE || '').toUpperCase() === 'IAM'
  if (token && !forceIAM) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': token }, body: JSON.stringify({ query, variables }) })
    const json = await res.json(); if (json.errors) throw new Error(JSON.stringify(json.errors))
    return json.data
  }
  if (!region) throw new Error('AWS region required for IAM signing')
  AWS.config.update({ region })
  const endpoint = new URL(url)
  const req = new AWS.HttpRequest(endpoint.href, region)
  req.method = 'POST'
  req.headers.host = endpoint.host
  req.headers['Content-Type'] = 'application/json'
  req.body = JSON.stringify({ query, variables })
  await new Promise((resolve, reject) => AWS.config.getCredentials((e) => (e ? reject(e) : resolve())))
  const signer = new AWS.Signers.V4(req, 'appsync', true)
  signer.addAuthorization(AWS.config.credentials, AWS.util.date.getDate())
  const resp = await new Promise((resolve, reject) => {
    const httpReq = https.request({ hostname: endpoint.hostname, method: req.method, path: endpoint.pathname, headers: req.headers }, (res) => {
      let data = ''
      res.on('data', (d) => (data += d))
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }))
    })
    httpReq.on('error', reject)
    httpReq.write(req.body || '')
    httpReq.end()
  })
  const json = JSON.parse(resp.body || '{}'); if (json.errors) throw new Error(JSON.stringify(json.errors))
  return json.data
}

const LIST_MATCHES = "query ListMatches($limit:Int,$nextToken:String){ listMatches(limit:$limit,nextToken:$nextToken){ items{ id heldOn tournament } nextToken } }"
const LIST_TOURNAMENTS = "query ListTournamentMasters($limit:Int,$nextToken:String){ listTournamentMasters(limit:$limit,nextToken:$nextToken){ items{ name } nextToken } }"
const CREATE_TOURNAMENT = "mutation CreateTournamentMaster($input: CreateTournamentMasterInput!){ createTournamentMaster(input:$input){ name } }"

async function collectExisting(url, token, region){
  const exist = new Set()
  let nextToken = null
  do{
    const data = await gql(url, token, region, LIST_TOURNAMENTS, { limit: 200, nextToken })
    for(const it of (data?.listTournamentMasters?.items||[])) if(it?.name) exist.add(it.name)
    nextToken = data?.listTournamentMasters?.nextToken || null
  }while(nextToken)
  return exist
}

async function collectFromMatches(url, token, region){
  const names = new Set()
  let nextToken = null
  do{
    const data = await gql(url, token, region, LIST_MATCHES, { limit: 200, nextToken })
    for(const m of (data?.listMatches?.items||[])) if(m?.tournament) names.add(m.tournament)
    nextToken = data?.listMatches?.nextToken || null
  }while(nextToken)
  return Array.from(names).sort((a,b)=> a.localeCompare(b,'ja'))
}

async function main(){
  const token = process.env.SEED_AUTH_TOKEN
  const outputs = JSON.parse(await readFile('amplify_outputs.json','utf-8'))
  const url = process.env.SEED_API_URL || outputs?.data?.url
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || outputs?.data?.aws_region
  if(!url) throw new Error('data.url missing in amplify_outputs.json')
  if(!token && !region) throw new Error('Provide SEED_AUTH_TOKEN or configure AWS_REGION for IAM signing')
  console.log('[seed:tournaments] API:', url)
  const existing = await collectExisting(url, token, region)
  const names = await collectFromMatches(url, token, region)
  console.log(`[seed:tournaments] Found ${names.length} tournaments in matches, ${existing.size} already exist`)
  let created = 0, skipped = 0
  for(const name of names){
    if(existing.has(name)){ skipped++; continue }
    try{
      await gql(url, token, region, CREATE_TOURNAMENT, { input: { name, active: true } })
      console.log('[OK]', name); created++
    }catch(e){ console.error('[ERR]', name, String(e?.message||e)) }
  }
  console.log(`[seed:tournaments] Created: ${created}, Skipped: ${skipped}`)
}

main().catch(e=>{ console.error('Seed failed:', e?.message||e); process.exit(1) })

