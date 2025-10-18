import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { View, Heading, SelectField, Table, TableHead, TableRow, TableCell, TableBody, Badge, TextField, Button, Flex, RadioGroupField, Radio, TextAreaField } from '@aws-amplify/ui-react'
import AIPanel from './AIPanel'

type Match = { id: string; heldOn: string; bouts?: { items: Bout[] } }
type Bout = { id: string; ourPlayerId: string; opponentPlayerId: string; winType?: string | null; winnerPlayerId?: string | null; points?: { items: Point[] } }
type Point = { tSec: number; target?: string | null; methods?: string[] | null; scorerPlayerId?: string | null; judgement?: string | null }

type Master = { code: string; nameJa?: string; nameEn?: string }
type PlayerEx = { name: string; gender?: string|null; universityId?: string|null; grade?: number|null }

export default function Dashboard(props:{
  matches: Match[]
  players: Record<string,string>
  masters: { targets: Master[]; methods: Master[] }
  labelJa: { target: Record<string,string>, method: Record<string,string> }
  homeUniversityId?: string
  ai?: { apiUrl: string; getToken: ()=>Promise<string|null> }
}){
  const { t, i18n } = useTranslation()
  const { matches, players, labelJa, homeUniversityId } = props
  const ai = props.ai
  const [playerId, setPlayerId] = useState<string>('')
  const [from, setFrom] = useState<string>('')
  const [to, setTo] = useState<string>('')
  const [tournamentFilter, setTournamentFilter] = useState<string>('')
  const [topN, setTopN] = useState<number>(5)
  const [officialFilter, setOfficialFilter] = useState<'all'|'official'|'practice'|'intra'>('all')
  const [genderFilter, setGenderFilter] = useState<'all'|'MALE'|'FEMALE'>('all')
  const [granularity, setGranularity] = useState<'coarse'|'detailed'>('detailed')
  const [playerSearch, setPlayerSearch] = useState<string>('')
  const [aiOpen, setAiOpen] = useState(false)
  const [aiPayload, setAiPayload] = useState<any|null>(null)
  const [playersEx, setPlayersEx] = useState<Record<string, PlayerEx>>({})
  const [universities, setUniversities] = useState<Record<string, string>>({})
  const [analysisModal, setAnalysisModal] = useState<{ open: boolean; category: string; content: string; importance: string; tags: string; periodStart: string; periodEnd: string }>({ open: false, category: 'TACTICAL', content: '', importance: 'MEDIUM', tags: '', periodStart: '', periodEnd: '' })

  // Fetch players with extended info (gender, university, grade)
  useEffect(()=>{
    async function fetchPlayersEx(){
      try{
        const token = await ai?.getToken(); if(!token || !ai) return
        const q = `query ListPlayers($limit:Int,$nextToken:String){ listPlayers(limit:$limit,nextToken:$nextToken){ items{ id name gender universityId grade } nextToken } }`
        let nextToken: string | null = null; const map: Record<string, PlayerEx> = {}
        do{
          const r = await fetch(ai.apiUrl, { method:'POST', headers:{ 'Content-Type':'application/json','Authorization':token as string }, body: JSON.stringify({ query: q, variables:{ limit:200, nextToken } }) })
          const j:any = await r.json(); if(j.errors) throw new Error(JSON.stringify(j.errors))
          for(const p of j.data.listPlayers.items){ map[p.id] = { name: p.name, gender: p.gender, universityId: p.universityId, grade: p.grade } }
          nextToken = j.data.listPlayers.nextToken
        } while(nextToken)
        setPlayersEx(map)
      }catch{}
    }
    fetchPlayersEx()
  }, [])

  // Fetch universities
  useEffect(()=>{
    async function fetchUniversities(){
      try{
        const token = await ai?.getToken(); if(!token || !ai) return
        const q = `query ListUniversities($limit:Int,$nextToken:String){ listUniversities(limit:$limit,nextToken:$nextToken){ items{ id name shortName } nextToken } }`
        let nextToken: string | null = null; const map: Record<string, string> = {}
        do{
          const r = await fetch(ai.apiUrl, { method:'POST', headers:{ 'Content-Type':'application/json','Authorization':token as string }, body: JSON.stringify({ query: q, variables:{ limit:200, nextToken } }) })
          const j:any = await r.json(); if(j.errors) throw new Error(JSON.stringify(j.errors))
          for(const u of j.data.listUniversities.items){ map[u.id] = u.shortName || u.name || u.id }
          nextToken = j.data.listUniversities.nextToken
        } while(nextToken)
        setUniversities(map)
      }catch{}
    }
    fetchUniversities()
  }, [])

  const playerList = useMemo(() => {
    let list = Object.entries(players).map(([id, name]) => {
      const info = playersEx[id]
      const uniName = info?.universityId ? universities[info.universityId] || '' : ''
      const gradeText = info?.grade ? `${info.grade}年` : ''
      const displayName = [name, uniName, gradeText].filter(Boolean).join('　')
      return { id, name, displayName, info }
    })

    // Gender filter
    if(genderFilter !== 'all'){
      list = list.filter(p=> p.info?.gender === genderFilter)
    }

    // Search filter
    if(playerSearch.trim()){
      const query = playerSearch.trim().toLowerCase()
      list = list.filter(p=> p.displayName.toLowerCase().includes(query))
    }

    return list.sort((a,b)=> a.name.localeCompare(b.name,'ja'))
  }, [players, playersEx, universities, genderFilter, playerSearch])

  // Persist filter in localStorage (share same key with App to keep consistent)
  useEffect(()=>{
    try{
      const saved = localStorage.getItem('filters:type')
      if(saved==="official"||saved==="practice"||saved==="all"||saved==="intra"){ setOfficialFilter(saved as any) }
    }catch{}
  },[])
  useEffect(()=>{ try{ localStorage.setItem('filters:type', officialFilter) }catch{} }, [officialFilter])

  const stat = useMemo(()=>{
    if(!playerId) return null
    const filtered = matches.filter(m=>{
      if(from && m.heldOn < from) return false
      if(to && m.heldOn > to) return false
      if(officialFilter==='official' && (m as any).isOfficial === false) return false
      if(officialFilter==='practice' && (m as any).isOfficial !== false) return false
      if(officialFilter==='intra' && (!homeUniversityId || (m as any).ourUniversityId!==homeUniversityId || (m as any).opponentUniversityId!==homeUniversityId)) return false
      if(tournamentFilter && (m as any).tournament && !(m as any).tournament.toLowerCase().includes(tournamentFilter.toLowerCase())) return false
      if(tournamentFilter && !(m as any).tournament) return false
      return true
    })
    const combinedFor: Record<string, number> = {}
    const combinedAgainst: Record<string, number> = {}
    const vs: Record<string, { bouts:number; wins:number; losses:number; draws:number; pf:number; pa:number }> = {}
    let wins=0, losses=0, draws=0, bouts=0, pf=0, pa=0
    const times:number[]=[]

    // Helper to generate key based on granularity
    const makeKey = (target: string, methods: string[]) => {
      if(granularity === 'coarse') {
        // Coarse: target only (面, 小手, 胴, 突き)
        return target || ''
      } else {
        // Detailed: target:methods (飛び込み面, すり上げ小手, etc.)
        return buildTechniqueKey(target, methods)
      }
    }

    for(const m of filtered){
      for(const b of (m.bouts?.items ?? [])){
        const isLeft = b.ourPlayerId===playerId
        const isRight = b.opponentPlayerId===playerId
        if(!isLeft && !isRight) continue
        bouts++
        const oppId = isLeft ? b.opponentPlayerId : b.ourPlayerId
        const opp = (vs[oppId] ||= { bouts:0, wins:0, losses:0, draws:0, pf:0, pa:0 });
        opp.bouts++
        if(b.winType==='DRAW'){ draws++; opp.draws++ }
        else if(b.winnerPlayerId){
          if(b.winnerPlayerId===playerId){ wins++; opp.wins++ } else { losses++; opp.losses++ }
        }
        for(const p of (b.points?.items ?? [])){
          if(p.scorerPlayerId===playerId){
            pf++; opp.pf++; if(typeof p.tSec==='number') times.push(p.tSec)
            if(p.judgement==='HANSOKU') { combinedFor['HANSOKU']=(combinedFor['HANSOKU']||0)+1; continue }
            const key = makeKey(p.target||'', p.methods||[])
            combinedFor[key] = (combinedFor[key]||0)+1
          } else if(p.scorerPlayerId && (p.scorerPlayerId!==playerId)){
            pa++; opp.pa++
            if(p.judgement==='HANSOKU') combinedAgainst['HANSOKU'] = (combinedAgainst['HANSOKU']||0)+1
            else { const key = makeKey(p.target||'', p.methods||[]); combinedAgainst[key] = (combinedAgainst[key]||0)+1 }
          }
        }
      }
    }
    const avgTime = times.length ? (times.reduce((a,b)=>a+b,0)/times.length) : null
    const winRate = bouts ? wins/bouts : 0
    const vsTop = Object.entries(vs).sort((a,b)=> b[1].bouts - a[1].bouts).slice(0,8)
    const fastest = times.length ? Math.min(...times) : null
    const slowest = times.length ? Math.max(...times) : null
    const ppg = bouts ? pf / bouts : 0
    const diff = pf - pa
    const topCombinedFor = Object.entries(combinedFor).sort((a,b)=> b[1]-a[1]).slice(0, topN)
    const topCombinedAgainst = Object.entries(combinedAgainst).sort((a,b)=> b[1]-a[1]).slice(0, topN)
    return { wins, losses, draws, bouts, pf, pa, avgTime, fastest, slowest, winRate, ppg, diff, topCombinedFor, topCombinedAgainst, vsTop }
  }, [matches, playerId, from, to, tournamentFilter, topN, officialFilter, homeUniversityId, granularity])

  function labelTarget(code:string){ return labelJa.target[code] ?? code }
  function labelMethod(code:string){ return code==='HANSOKU' ? t('winType.HANSOKU') : (labelJa.method[code] ?? code) }
  function buildTechniqueKey(target?:string, methods?:string[]){ const mm = (methods||[]).slice().sort(); return `${target||''}:${mm.join('+')}` }
  function labelTechniqueCombined(key:string){
    if(key==='HANSOKU') return t('winType.HANSOKU')
    if(granularity === 'coarse') {
      // Coarse: show target only (面, 小手, 胴, 突き)
      return labelTarget(key)
    } else {
      // Detailed: show methods + target (飛び込み面, すり上げ小手, etc.)
      const [target, mstr] = key.split(':')
      const ml = (mstr? mstr.split('+') : []).map(labelMethod)
      const base = ml.join('')
      return `${base}${labelTarget(target)}`
    }
  }

  const createPlayerAnalysisMutation = `mutation CreatePlayerAnalysis($input: CreatePlayerAnalysisInput!) {
    createPlayerAnalysis(input:$input){
      id playerId category content importance tags periodStart periodEnd recordedAt
    }
  }`

  async function savePlayerAnalysis(){
    const { category, content, importance, tags, periodStart, periodEnd } = analysisModal
    if(!playerId){ alert(t('dashboard.noData') || 'Please select a player'); return }
    if(!content.trim()){ alert(t('errors.analysisContentRequired') || 'Content is required'); return }
    if(!ai){ alert(t('errors.notSignedIn') || 'Not signed in'); return }
    try{
      const token = await ai.getToken(); if(!token) return
      const tagsArray = tags.trim() ? tags.split(',').map(t=> t.trim()).filter(Boolean) : []
      const input:any = {
        playerId,
        category,
        content: content.trim(),
        importance,
        tags: tagsArray.length > 0 ? tagsArray : null,
        periodStart: periodStart || null,
        periodEnd: periodEnd || null,
        recordedAt: new Date().toISOString()
      }
      const r = await fetch(ai.apiUrl,{method:'POST', headers:{'Content-Type':'application/json','Authorization':token}, body: JSON.stringify({ query:createPlayerAnalysisMutation, variables:{ input } })});
      const j:any = await r.json(); if(j.errors) throw new Error(JSON.stringify(j.errors));
      setAnalysisModal({ open: false, category: 'TACTICAL', content: '', importance: 'MEDIUM', tags: '', periodStart: '', periodEnd: '' })
      alert(t('notices.saved'))
    }catch(e:any){ alert(String(e?.message ?? e)) }
  }

  function PieChart({items, size=160}:{ items: [string, number][], size?:number }){
    const total = items.reduce((s, [,v])=> s+v, 0)
    if(total<=0) return <div>-</div>
    const r = size/2, cx=r, cy=r
    let acc = 0
    const palette = ['#4e79a7','#f28e2b','#e15759','#76b7b2','#59a14f','#edc948','#b07aa1','#ff9da7','#9c755f','#bab0ab']
    const paths = items.map(([label,v],i)=>{
      const a0 = (acc/total)*2*Math.PI - Math.PI/2; acc += v; const a1 = (i === items.length - 1) ? (2*Math.PI - Math.PI/2) : ((acc/total)*2*Math.PI - Math.PI/2)
      const x0 = cx + r*Math.cos(a0), y0 = cy + r*Math.sin(a0)
      const x1 = cx + r*Math.cos(a1), y1 = cy + r*Math.sin(a1)
      const large = (a1-a0) > Math.PI ? 1 : 0
      const d = `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`
      return (<path key={i} d={d} fill={palette[i%palette.length]} stroke="#fff" strokeWidth={1} />)
    })
    const legend = items.map(([label,v],i)=>{
      const pct = ((v/total)*100).toFixed(1)
      return (<div key={i} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, marginTop:4 }}>
        <div style={{ width:12, height:12, background: palette[i%palette.length], border:'1px solid #ccc', flexShrink:0 }}></div>
        <span>{label} ({pct}%)</span>
      </div>)
    })
    return (
      <div>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>{paths}</svg>
        <div style={{ marginTop:8 }}>{legend}</div>
      </div>
    )
  }

  return (
    <View>
      <Heading level={4}>{t('dashboard.title')}</Heading>
      <View marginTop="0.5rem">
        <Flex gap="0.75rem" wrap="wrap" alignItems="flex-end">
          <TextField
            label={t('dashboard.searchPlayer')}
            placeholder={t('dashboard.searchPlayerPlaceholder')}
            value={playerSearch}
            onChange={e=> setPlayerSearch(e.target.value)}
            width="18rem"
          />
          <SelectField label={t('dashboard.selectPlayer')} value={playerId} onChange={e=> setPlayerId(e.target.value)} size="small" width="20rem">
            <option value="">--</option>
            {playerList.map(p => (<option key={p.id} value={p.id}>{p.displayName}</option>))}
          </SelectField>
          <TextField label={t('dashboard.from')} type="date" value={from} onChange={e=> setFrom(e.target.value)} width="11rem" />
          <TextField label={t('dashboard.to')} type="date" value={to} onChange={e=> setTo(e.target.value)} width="11rem" />
          <SelectField label={t('filters.type')} value={officialFilter} onChange={e=> setOfficialFilter(e.target.value as any)} size="small" width="12rem">
            <option value="all">{t('filters.all')}</option>
            <option value="official">{t('filters.official')}</option>
            <option value="practice">{t('filters.practice')}</option>
            <option value="intra">{t('filters.intra')}</option>
          </SelectField>
          <SelectField label={t('filters.gender')} value={genderFilter} onChange={e=> setGenderFilter(e.target.value as any)} size="small" width="10rem">
            <option value="all">{t('filters.all')}</option>
            <option value="MALE">{t('gender.MALE')}</option>
            <option value="FEMALE">{t('gender.FEMALE')}</option>
          </SelectField>
          <TextField label={t('dashboard.tournament')} placeholder={t('dashboard.tournamentPh')} value={tournamentFilter} onChange={e=> setTournamentFilter(e.target.value)} width="16rem" />
          <SelectField label={t('dashboard.topN')} value={String(topN)} onChange={e=> setTopN(Number(e.target.value))} size="small" width="10rem">
            {[5,10,15].map(n=> (<option key={n} value={n}>{n}</option>))}
          </SelectField>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600 }}>{t('dashboard.granularity')}</label>
            <RadioGroupField legend="" name="granularity" value={granularity} onChange={e=> setGranularity(e.target.value as any)} orientation="horizontal">
              <Radio value="coarse">{t('dashboard.granularityCoarse')}</Radio>
              <Radio value="detailed">{t('dashboard.granularityDetailed')}</Radio>
            </RadioGroupField>
          </div>
          <Button onClick={()=> { setFrom(''); setTo(''); setTournamentFilter(''); setTopN(5); setOfficialFilter('all'); setGenderFilter('all'); setPlayerSearch('') }}>{t('dashboard.clear')}</Button>
        </Flex>
      </View>

      {!playerId && (
        <View marginTop="0.75rem" color="#666">{t('dashboard.noData')}</View>
      )}

      {playerId && stat && (
        <View marginTop="0.75rem" style={{display:'grid', gridTemplateColumns:'repeat(3,minmax(180px,1fr))', gap:12}}>
          <View style={{border:'1px solid #eee', borderRadius:8, padding:10}}>
            <Heading level={6}>{t('dashboard.stats')}</Heading>
            <div>{t('filters.type')}: <b>{officialFilter==='all'? t('filters.all') : officialFilter==='official'? t('filters.official') : (officialFilter==='practice' ? t('filters.practice') : t('filters.intra'))}</b></div>
            <div>{t('dashboard.bouts')}: <b>{stat.bouts}</b></div>
            <div>{t('dashboard.wins')}: <b>{stat.wins}</b> / {t('dashboard.losses')}: <b>{stat.losses}</b> / {t('dashboard.draws')}: <b>{stat.draws}</b></div>
            <div>{t('dashboard.winRate')}: <b>{(stat.winRate*100).toFixed(1)}%</b></div>
            <div>{t('dashboard.pointsFor')}: <b>{stat.pf}</b> / {t('dashboard.pointsAgainst')}: <b>{stat.pa}</b></div>
            <div>{t('dashboard.avgTimeToScore')}: <b>{stat.avgTime==null?'-':stat.avgTime.toFixed(1)+'s'}</b></div>
            <div>{t('dashboard.fastest')}: <b>{stat.fastest==null?'-':stat.fastest+'s'}</b> / {t('dashboard.slowest')}: <b>{stat.slowest==null?'-':stat.slowest+'s'}</b></div>
            <div>{t('dashboard.pointsPerBout')}: <b>{stat.ppg.toFixed(2)}</b> / {t('dashboard.diff')}: <b>{stat.diff>0?'+':''}{stat.diff}</b></div>
          </View>

          <View style={{border:'1px solid #eee', borderRadius:8, padding:10}}>
            <Heading level={6}>{t('dashboard.pieFor')}</Heading>
            <PieChart items={stat.topCombinedFor.map(([k,v])=> [labelTechniqueCombined(k), v] as [string, number])} />
          </View>

          <View style={{border:'1px solid #eee', borderRadius:8, padding:10}}>
            <Heading level={6}>{t('dashboard.pieAgainst')}</Heading>
            <PieChart items={stat.topCombinedAgainst.map(([k,v])=> [labelTechniqueCombined(k), v] as [string, number])} />
          </View>

          <View style={{gridColumn:'1 / -1', border:'1px solid #eee', borderRadius:8, padding:10}}>
            <Heading level={6}>{t('dashboard.vsOpponents')}</Heading>
            <Table variation="bordered" highlightOnHover>
              <TableHead>
                <TableRow>
                  <TableCell as="th">{t('dashboard.opponent')}</TableCell>
                  <TableCell as="th">{t('dashboard.bouts')}</TableCell>
                  <TableCell as="th">{t('dashboard.wins')}</TableCell>
                  <TableCell as="th">{t('dashboard.losses')}</TableCell>
                  <TableCell as="th">{t('dashboard.draws')}</TableCell>
                  <TableCell as="th">{t('dashboard.pointsFor')}</TableCell>
                  <TableCell as="th">{t('dashboard.pointsAgainst')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {stat.vsTop.map(([oppId, v])=> (
                  <TableRow key={oppId}>
                    <TableCell>{players[oppId] ?? oppId}</TableCell>
                    <TableCell>{v.bouts}</TableCell>
                    <TableCell>{v.wins}</TableCell>
                    <TableCell>{v.losses}</TableCell>
                    <TableCell>{v.draws}</TableCell>
                    <TableCell>{v.pf}</TableCell>
                    <TableCell>{v.pa}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
          </Table>
        </View>
        {ai && (
          <div style={{ gridColumn:'1 / -1', display:'flex', justifyContent:'flex-end', gap:'0.5rem' }}>
            <Button onClick={()=> setAnalysisModal({ open: true, category: 'TACTICAL', content: '', importance: 'MEDIUM', tags: '', periodStart: from, periodEnd: to })}>
              {t('analysis.playerAnalysis')}
            </Button>
            <Button variation="primary" onClick={async ()=> {
              if(!stat || !playerId) return

              // Fetch qualitative data
              let boutAnalyses: any[] = []
              let playerAnalyses: any[] = []

              try {
                const token = await ai.getToken()
                if(token){
                  // Collect bout IDs from filtered matches
                  const boutIds: string[] = []
                  const filtered = matches.filter(m=>{
                    if(from && m.heldOn < from) return false
                    if(to && m.heldOn > to) return false
                    if(officialFilter==='official' && (m as any).isOfficial === false) return false
                    if(officialFilter==='practice' && (m as any).isOfficial !== false) return false
                    if(officialFilter==='intra' && (!homeUniversityId || (m as any).ourUniversityId!==homeUniversityId || (m as any).opponentUniversityId!==homeUniversityId)) return false
                    if(tournamentFilter && (m as any).tournament && !(m as any).tournament.toLowerCase().includes(tournamentFilter.toLowerCase())) return false
                    if(tournamentFilter && !(m as any).tournament) return false
                    return true
                  })
                  for(const m of filtered){
                    for(const b of (m.bouts?.items ?? [])){
                      if(b.ourPlayerId===playerId || b.opponentPlayerId===playerId){
                        boutIds.push(b.id)
                      }
                    }
                  }

                  // Fetch bout analyses for these bouts
                  for(const boutId of boutIds){
                    try{
                      const q = `query ListBoutAnalysisByBout($boutId:ID!){ listBoutAnalysisByBout(boutId:$boutId){ items{ id boutId category content importance tags recordedAt } } }`
                      const r = await fetch(ai.apiUrl, { method:'POST', headers:{'Content-Type':'application/json','Authorization':token}, body: JSON.stringify({ query: q, variables:{ boutId } }) })
                      const j:any = await r.json()
                      if(j.data?.listBoutAnalysisByBout?.items){
                        boutAnalyses.push(...j.data.listBoutAnalysisByBout.items)
                      }
                    }catch{}
                  }

                  // Fetch player analyses
                  try{
                    const q = `query ListPlayerAnalysisByPlayer($playerId:ID!){ listPlayerAnalysisByPlayer(playerId:$playerId){ items{ id playerId category content importance tags periodStart periodEnd recordedAt } } }`
                    const r = await fetch(ai.apiUrl, { method:'POST', headers:{'Content-Type':'application/json','Authorization':token}, body: JSON.stringify({ query: q, variables:{ playerId } }) })
                    const j:any = await r.json()
                    if(j.data?.listPlayerAnalysisByPlayer?.items){
                      playerAnalyses = j.data.listPlayerAnalysisByPlayer.items
                      // Filter by date range if specified
                      if(from || to){
                        playerAnalyses = playerAnalyses.filter((a:any)=>{
                          if(from && a.periodEnd && a.periodEnd < from) return false
                          if(to && a.periodStart && a.periodStart > to) return false
                          return true
                        })
                      }
                    }
                  }catch{}
                }
              }catch{}

              const payload = {
                version: 'v1', mode: 'personal', locale: (navigator?.language||'ja'),
                filters: { from, to, type: officialFilter, tournamentQuery: tournamentFilter||'' },
                subject: { playerId, displayName: players[playerId]||playerId },
                sampleSizes: { matches: (matches||[]).length, bouts: stat.bouts },
                stats: { bouts: stat.bouts, wins: stat.wins, losses: stat.losses, draws: stat.draws, pf: stat.pf, pa: stat.pa, ppg: stat.ppg, diff: stat.diff, winRate: stat.winRate, avgTimeToScoreSec: stat.avgTime, fastestSec: stat.fastest, slowestSec: stat.slowest },
                topTechniquesFor: (stat.topCombinedFor||[]).map(([k,v]:any)=> ({ key:k, count: v })),
                topTechniquesAgainst: (stat.topCombinedAgainst||[]).map(([k,v]:any)=> ({ key:k, count: v })),
                vsOpponents: (stat.vsTop||[]).map(([oppId, v]: any)=> ({ opponentId: oppId, name: players[oppId]||oppId, ...v })),
                qualitativeData: {
                  boutAnalyses: boutAnalyses.map((a:any)=> ({ boutId: a.boutId, category: a.category, content: a.content, importance: a.importance, tags: a.tags, recordedAt: a.recordedAt })),
                  playerAnalyses: playerAnalyses.map((a:any)=> ({ category: a.category, content: a.content, importance: a.importance, tags: a.tags, periodStart: a.periodStart, periodEnd: a.periodEnd, recordedAt: a.recordedAt }))
                },
                notes: { dataSource: 'client-aggregated' }
              }
              setAiPayload(payload); setAiOpen(true)
            }}>
              AI要約
            </Button>
          </div>
        )}
      </View>
      )}
      {ai && (
        <AIPanel open={aiOpen} onClose={()=> setAiOpen(false)} apiUrl={ai.apiUrl} getToken={ai.getToken} payload={aiPayload} />
      )}
      {analysisModal.open && (
        <div style={{ position:'fixed', top:0, left:0, width:'100vw', height:'100vh', background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={()=> setAnalysisModal({...analysisModal, open:false})}>
          <div style={{ background:'#fff', borderRadius:8, padding:20, minWidth:500, maxWidth:'90vw', maxHeight:'90vh', overflowY:'auto' }} onClick={e=> e.stopPropagation()}>
            <Heading level={5}>{t('analysis.playerAnalysis')}</Heading>
            <View marginTop="1rem">
              <SelectField label={t('analysis.category')} value={analysisModal.category} onChange={e=> setAnalysisModal({...analysisModal, category: e.target.value})} size="small">
                <option value="STRENGTH">{t('analysis.categories.STRENGTH')}</option>
                <option value="WEAKNESS">{t('analysis.categories.WEAKNESS')}</option>
                <option value="TACTICAL">{t('analysis.categories.TACTICAL')}</option>
                <option value="MENTAL">{t('analysis.categories.MENTAL')}</option>
                <option value="TECHNICAL">{t('analysis.categories.TECHNICAL')}</option>
                <option value="PHYSICAL">{t('analysis.categories.PHYSICAL')}</option>
                <option value="OTHER">{t('analysis.categories.OTHER')}</option>
              </SelectField>
              <SelectField label={t('analysis.importance')} value={analysisModal.importance} onChange={e=> setAnalysisModal({...analysisModal, importance: e.target.value})} size="small" marginTop="0.5rem">
                <option value="HIGH">{t('analysis.importance_levels.HIGH')}</option>
                <option value="MEDIUM">{t('analysis.importance_levels.MEDIUM')}</option>
                <option value="LOW">{t('analysis.importance_levels.LOW')}</option>
              </SelectField>
              <TextAreaField label={t('analysis.content')} value={analysisModal.content} onChange={e=> setAnalysisModal({...analysisModal, content: e.target.value})} rows={6} marginTop="0.5rem" />
              <TextField label={t('analysis.tags')} value={analysisModal.tags} onChange={e=> setAnalysisModal({...analysisModal, tags: e.target.value})} marginTop="0.5rem" />
              <Flex gap="0.5rem" marginTop="0.5rem">
                <TextField label={t('analysis.from')} type="date" value={analysisModal.periodStart} onChange={e=> setAnalysisModal({...analysisModal, periodStart: e.target.value})} />
                <TextField label={t('analysis.to')} type="date" value={analysisModal.periodEnd} onChange={e=> setAnalysisModal({...analysisModal, periodEnd: e.target.value})} />
              </Flex>
              <Flex gap="0.5rem" marginTop="1rem" justifyContent="flex-end">
                <Button onClick={()=> setAnalysisModal({...analysisModal, open:false})}>{t('action.cancel')}</Button>
                <Button variation="primary" onClick={savePlayerAnalysis}>{t('action.add')}</Button>
              </Flex>
            </View>
          </div>
        </div>
      )}
    </View>
  )
}

