import { readFile } from 'node:fs/promises'

async function gql(url, token, query, variables) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': token },
    body: JSON.stringify({ query, variables }),
  })
  const json = await res.json()
  if (json.errors) throw new Error(JSON.stringify(json.errors))
  return json.data
}

async function getApi() {
  const outputs = JSON.parse(await readFile('amplify_outputs.json', 'utf-8'))
  const url = outputs?.data?.url
  if (!url) throw new Error('data.url missing in amplify_outputs.json')
  const token = process.env.SEED_AUTH_TOKEN
  if (!token) throw new Error('SEED_AUTH_TOKEN env missing')
  return { url, token }
}

const listPoints = /* GraphQL */ `
query ListPoints($limit:Int,$nextToken:String){
  listPoints(limit:$limit,nextToken:$nextToken){
    items{ id scorerPlayerId target methods recordedAt }
    nextToken
  }
}`

const upsertTarget = /* GraphQL */ `
mutation UpsertAggTarget($input: CreateAggregatePlayerTargetDailyInput!){
  createAggregatePlayerTargetDaily(input:$input){ playerId date target count }
}`

const upsertMethod = /* GraphQL */ `
mutation UpsertAggMethod($input: CreateAggregatePlayerMethodDailyInput!){
  createAggregatePlayerMethodDaily(input:$input){ playerId date method count }
}`

function dayFrom(recordedAt){
  if(!recordedAt) return new Date().toISOString().slice(0,10)
  return String(recordedAt).slice(0,10)
}

async function main(){
  const { url, token } = await getApi()
  const aggTarget = new Map() // key: `${playerId}|${date}|${target}` -> count
  const aggMethod = new Map() // key: `${playerId}|${date}|${method}` -> count

  // 1) Scan all points via pagination
  let nextToken = null
  do{
    const data = await gql(url, token, listPoints, { limit: 500, nextToken })
    const page = data.listPoints
    nextToken = page.nextToken
    for(const p of page.items){
      const date = dayFrom(p.recordedAt)
      const k1 = `${p.scorerPlayerId}|${date}|${p.target}`
      aggTarget.set(k1, (aggTarget.get(k1)||0)+1)
      for(const m of (p.methods||[])){
        const k2 = `${p.scorerPlayerId}|${date}|${m}`
        aggMethod.set(k2, (aggMethod.get(k2)||0)+1)
      }
    }
  } while(nextToken)

  // 2) Upsert aggregates
  for(const [k,c] of aggTarget){
    const [playerId,date,target] = k.split('|')
    await gql(url, token, upsertTarget, { input: { playerId, date, target, count: c }})
    console.log(`[AggTarget] ${playerId} ${date} ${target} = ${c}`)
  }
  for(const [k,c] of aggMethod){
    const [playerId,date,method] = k.split('|')
    await gql(url, token, upsertMethod, { input: { playerId, date, method, count: c }})
    console.log(`[AggMethod] ${playerId} ${date} ${method} = ${c}`)
  }

  console.log('Rebuild aggregates complete.')
}

main().catch(e=>{ console.error('Rebuild failed:', e.message||e); process.exit(1) })

