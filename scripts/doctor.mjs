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

async function main(){
  const report = []
  function ok(msg){ report.push(`OK  - ${msg}`) }
  function warn(msg){ report.push(`WARN - ${msg}`) }
  function err(msg){ report.push(`ERR - ${msg}`) }

  // 1) amplify_outputs.json
  let url, outputs
  try{
    outputs = JSON.parse(await readFile('amplify_outputs.json','utf-8'))
    url = outputs?.data?.url
    if(url){ ok(`amplify_outputs.json found: data.url`) } else { err(`amplify_outputs.json has no data.url`) }
  }catch(e){ err(`amplify_outputs.json not found or unreadable`) }

  const token = process.env.SEED_AUTH_TOKEN
  if(!token){ warn(`SEED_AUTH_TOKEN not set; GraphQL connectivity checks will be skipped`) }

  if(url && token){
    try{
      // Masters
      const mastersQ = `query{ listTargetMasters{items{code}} listMethodMasters{items{code}} listPositionMasters{items{code}} }`
      const m = await gql(url, token, mastersQ, {})
      ok(`Masters: Target=${m.listTargetMasters.items.length}, Method=${m.listMethodMasters.items.length}, Position=${m.listPositionMasters.items.length}`)
    }catch(e){ err(`Masters query failed: ${e.message||e}`) }

    try{
      const q = `query{ listUniversities{items{id}}, listPlayers{items{id}}, listMatches{items{id}}, listBouts{items{id}}, listPoints{items{id}} }`
      const d = await gql(url, token, q, {})
      ok(`Data: Univ=${d.listUniversities.items.length}, Players=${d.listPlayers.items.length}, Matches=${d.listMatches.items.length}, Bouts=${d.listBouts.items.length}, Points=${d.listPoints.items.length}`)
    }catch(e){ err(`Core data query failed: ${e.message||e}`) }

    try{
      const qa = `query{ listAggregatePlayerTargetDailies{items{id: playerId date target count}}, listAggregatePlayerMethodDailies{items{id: playerId date method count}} }`
      const a = await gql(url, token, qa, {})
      const t = a.listAggregatePlayerTargetDailies.items.length
      const m = a.listAggregatePlayerMethodDailies.items.length
      if(t+m>0) ok(`Aggregates present: TargetDaily=${t}, MethodDaily=${m}`)
      else warn(`Aggregates empty: run 'npm run aggregate:rebuild' or wire Streams→Lambda`)
    }catch(e){ warn(`Aggregate query failed (may be undeployed yet): ${e.message||e}`) }
  }

  console.log('--- Doctor Report ---')
  for(const line of report) console.log(line)
  const hasErr = report.some(l=> l.startsWith('ERR'))
  process.exit(hasErr ? 1 : 0)
}

main().catch(e=> { console.error('Doctor failed:', e.message||e); process.exit(1) })

