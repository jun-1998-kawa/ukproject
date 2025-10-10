import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { View, Heading, SelectField, Table, TableHead, TableRow, TableCell, TableBody, Badge, TextField, Button, Flex } from '@aws-amplify/ui-react'

// Shared color palette for charts/legend
const PALETTE = ['#4e79a7','#f28e2b','#e15759','#76b7b2','#59a14f','#edc948','#b07aa1','#ff9da7','#9c755f','#bab0ab']

type Match = { id: string; heldOn: string; bouts?: { items: Bout[] } }
type Bout = { id: string; ourPlayerId: string; opponentPlayerId: string; winType?: string | null; winnerPlayerId?: string | null; points?: { items: Point[] } }
type Point = { tSec: number; target?: string | null; methods?: string[] | null; scorerPlayerId?: string | null; judgement?: string | null; recordedAt?: string | null }

type Master = { code: string; nameJa?: string; nameEn?: string }

export default function Dashboard(props:{
  matches: Match[]
  players: Record<string,string>
  masters: { targets: Master[]; methods: Master[] }
  labelJa: { target: Record<string,string>, method: Record<string,string> }
  homeUniversityId?: string
  apiUrl?: string
  getToken?: ()=> Promise<string|null>
}){
  const { t } = useTranslation()
  const { matches, players, labelJa, homeUniversityId } = props
  const [playerId, setPlayerId] = useState<string>('')
  const [from, setFrom] = useState<string>('')
  const [to, setTo] = useState<string>('')
  const [tournamentFilter, setTournamentFilter] = useState<string>('')
  const [granularity, setGranularity] = useState<'target'|'technique'>('technique')
  const TOP_N = 5
  const BIN_SIZE_SEC = 15
  const [officialFilter, setOfficialFilter] = useState<'all'|'official'|'practice'|'intra'>('all')
  const [notes, setNotes] = useState<{ matchId:string, comment:string }[]>([])
  const [noteModal, setNoteModal] = useState<{ open:boolean; matchId:string; text:string }>( { open:false, matchId:'', text:'' } )
  const [overallNote, setOverallNote] = useState<string>('')
  const [overallSaving, setOverallSaving] = useState<boolean>(false)

  const playerList = useMemo(() => Object.entries(players).sort((a,b)=> a[1].localeCompare(b[1],'ja')), [players])

  // Persist filter in localStorage (share same key with App to keep consistent)
  useEffect(()=>{
    try{
      const saved = localStorage.getItem('filters:type')
      if(saved==="official"||saved==="practice"||saved==="all"||saved==="intra"){ setOfficialFilter(saved as any) }
    }catch{}
  },[])
  useEffect(()=>{ try{ localStorage.setItem('filters:type', officialFilter) }catch{} }, [officialFilter])
  // Fetch qualitative notes for selected player
  useEffect(()=>{
    (async()=>{
      setNotes([])
      if(!props.apiUrl || !props.getToken || !playerId) return
      try{
        const token = await props.getToken(); if(!token) return
        const q = `query ListPlayerNotesByPlayer($playerId: ID!, $limit:Int){ listPlayerNotesByPlayer(playerId:$playerId, limit:$limit){ items{ matchId comment } } }`
        const res: Response = await fetch(props.apiUrl, { method:'POST', headers:{ 'Content-Type':'application/json','Authorization': token }, body: JSON.stringify({ query: q, variables: { playerId, limit: 200 } }) })
        const j:any = await res.json(); const arr = (j?.data?.listPlayerNotesByPlayer?.items ?? []) as any[]
        setNotes(arr.map((x:any)=> ({ matchId:x.matchId, comment:x.comment||'' })))
      }catch{}
    })()
  }, [playerId, props.apiUrl, props.getToken])

  const updateNoteMut = `mutation UpdatePlayerNote($input: UpdatePlayerNoteInput!){ updatePlayerNote(input:$input){ playerId matchId } }`
  const createNoteMut = `mutation CreatePlayerNote($input: CreatePlayerNoteInput!){ createPlayerNote(input:$input){ playerId matchId } }`
  const getPlayerQuery = `query GetPlayer($id:ID!){ getPlayer(id:$id){ id notes } }`
  const updatePlayerMut = `mutation UpdatePlayer($input: UpdatePlayerInput!){ updatePlayer(input:$input){ id } }`

  function playerMatches(){
    if(!playerId) return [] as Match[]
    const arr: Match[] = []
    for(const m of matches){
      const has = (m.bouts?.items ?? []).some(b=> b.ourPlayerId===playerId || b.opponentPlayerId===playerId)
      if(has) arr.push(m)
    }
    return arr
  }
  function openAddNote(){
    const pm = playerMatches()
    const firstId = pm[0]?.id || ''
    setNoteModal({ open:true, matchId:firstId, text:'' })
  }
  function openEditNote(mId:string, text:string){ setNoteModal({ open:true, matchId:mId, text }) }
  async function saveNote(){
    if(!props.apiUrl || !props.getToken || !playerId || !noteModal.matchId) { setNoteModal({ open:false, matchId:'', text:'' }); return }
    try{
      const token = await props.getToken(); if(!token) return
      const input:any = { playerId, matchId: noteModal.matchId, comment: (noteModal.text||'').trim() }
      if(!input.comment){ setNoteModal({ open:false, matchId:'', text:'' }); return }
      try{ await fetch(props.apiUrl, { method:'POST', headers:{ 'Content-Type':'application/json','Authorization': token }, body: JSON.stringify({ query: updateNoteMut, variables: { input } }) }) }catch{}
      try{ await fetch(props.apiUrl, { method:'POST', headers:{ 'Content-Type':'application/json','Authorization': token }, body: JSON.stringify({ query: createNoteMut, variables: { input } }) }) }catch{}
      // refresh list
      const q = `query ListPlayerNotesByPlayer($playerId: ID!, $limit:Int){ listPlayerNotesByPlayer(playerId:$playerId, limit:$limit){ items{ matchId comment } } }`
      const res: Response = await fetch(props.apiUrl, { method:'POST', headers:{ 'Content-Type':'application/json','Authorization': token }, body: JSON.stringify({ query: q, variables: { playerId, limit: 200 } }) })
      const j:any = await res.json(); const arr = (j?.data?.listPlayerNotesByPlayer?.items ?? []) as any[]
      setNotes(arr.map((x:any)=> ({ matchId:x.matchId, comment:x.comment||'' })))
    }catch{}
    setNoteModal({ open:false, matchId:'', text:'' })
  }

  // Load/save overall player analysis (Player.notes)
  useEffect(()=>{
    (async()=>{
      setOverallNote('')
      if(!props.apiUrl || !props.getToken || !playerId) return
      try{
        const token = await props.getToken(); if(!token) return
        const res: Response = await fetch(props.apiUrl, { method:'POST', headers:{ 'Content-Type':'application/json','Authorization': token }, body: JSON.stringify({ query: getPlayerQuery, variables: { id: playerId } }) })
        const j:any = await res.json(); const p = j?.data?.getPlayer
        setOverallNote(p?.notes || '')
      }catch{}
    })()
  }, [playerId, props.apiUrl, props.getToken])

  async function saveOverall(){
    if(!props.apiUrl || !props.getToken || !playerId) return
    setOverallSaving(true)
    try{
      const token = await props.getToken(); if(!token) return
      const input:any = { id: playerId, notes: (overallNote||'').trim() }
      await fetch(props.apiUrl, { method:'POST', headers:{ 'Content-Type':'application/json','Authorization': token }, body: JSON.stringify({ query: updatePlayerMut, variables: { input } }) })
    }catch{}
    finally{ setOverallSaving(false) }
  }
  // Fetch qualitative notes for selected player
  useEffect(()=>{
    (async()=>{
      setNotes([])
      if(!props.apiUrl || !props.getToken || !playerId) return
      try{
        const token = await props.getToken(); if(!token) return
        const q = `query ListPlayerNotesByPlayer($playerId: ID!, $limit:Int){ listPlayerNotesByPlayer(playerId:$playerId, limit:$limit){ items{ matchId comment } } }`
        const res: Response = await fetch(props.apiUrl, { method:'POST', headers:{ 'Content-Type':'application/json','Authorization': token }, body: JSON.stringify({ query: q, variables: { playerId, limit: 200 } }) })
        const j:any = await res.json(); const arr = (j?.data?.listPlayerNotesByPlayer?.items ?? []) as any[]
        setNotes(arr.map((x:any)=> ({ matchId:x.matchId, comment:x.comment||'' })))
      }catch{}
    })()
  }, [playerId, props.apiUrl, props.getToken])

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
    const targetOnlyFor: Record<string, number> = {}
    const targetOnlyAgainst: Record<string, number> = {}
    const vs: Record<string, { bouts:number; wins:number; losses:number; draws:number; pf:number; pa:number }> = {}
    let wins=0, losses=0, draws=0, bouts=0, pf=0, pa=0
    const times:number[]=[]
    const hoursFor = new Array(24).fill(0)
    const hoursAgainst = new Array(24).fill(0)
    // time-in-bout bins by seconds
    const tForBins: number[] = []
    const tAgainstBins: number[] = []
    const incBin = (arr:number[], t:number)=>{ const idx = Math.floor(Math.max(0,t)/Math.max(1,BIN_SIZE_SEC)); arr[idx] = (arr[idx]||0)+1 }
    const stanceKey = (s?:string|null)=> s==='JODAN' ? 'JODAN' : ((s||'').startsWith('NITOU') ? 'NITOU' : '')
    const vsStance: Record<string, { bouts:number; wins:number; losses:number; draws:number }> = { JODAN:{bouts:0,wins:0,losses:0,draws:0}, NITOU:{bouts:0,wins:0,losses:0,draws:0} }

    for(const m of filtered){
      for(const b of (m.bouts?.items ?? [])){
        const isLeft = b.ourPlayerId===playerId
        const isRight = b.opponentPlayerId===playerId
        if(!isLeft && !isRight) continue
        bouts++
        const oppId = isLeft ? b.opponentPlayerId : b.ourPlayerId
        const opp = (vs[oppId] ||= { bouts:0, wins:0, losses:0, draws:0, pf:0, pa:0 });
        opp.bouts++
        if(b.winType==='DRAW'){ draws++; opp.draws++; const sk = stanceKey(isLeft ? (b as any).opponentStance : (b as any).ourStance); if(sk){ vsStance[sk].bouts++; vsStance[sk].draws++ } }
        else if(b.winnerPlayerId){
          const sk = stanceKey(isLeft ? (b as any).opponentStance : (b as any).ourStance); if(sk){ vsStance[sk].bouts++ }
          if(b.winnerPlayerId===playerId){ wins++; opp.wins++; if(sk) vsStance[sk].wins++ } else { losses++; opp.losses++; if(sk) vsStance[sk].losses++ }
        }
        for(const p of (b.points?.items ?? [])){
          if(p.scorerPlayerId===playerId){
            pf++; opp.pf++; if(typeof p.tSec==='number') times.push(p.tSec)
            if(p.judgement==='HANSOKU') { combinedFor['HANSOKU']=(combinedFor['HANSOKU']||0)+1; continue }
            const key = buildTechniqueKey(p.target||'', p.methods||[])
            combinedFor[key] = (combinedFor[key]||0)+1
            if(p.target) targetOnlyFor[p.target] = (targetOnlyFor[p.target]||0)+1
            if(p.recordedAt){ const h = new Date(p.recordedAt).getHours(); if(!Number.isNaN(h)) hoursFor[h]++ }
            if(typeof p.tSec==='number') incBin(tForBins, p.tSec)
          } else if(p.scorerPlayerId && (p.scorerPlayerId!==playerId)){
            pa++; opp.pa++
            if(p.judgement==='HANSOKU') combinedAgainst['HANSOKU'] = (combinedAgainst['HANSOKU']||0)+1
            else {
              const key = buildTechniqueKey(p.target||'', p.methods||[])
              combinedAgainst[key] = (combinedAgainst[key]||0)+1
              if(p.target) targetOnlyAgainst[p.target] = (targetOnlyAgainst[p.target]||0)+1
            }
            if(p.recordedAt){ const hh = new Date(p.recordedAt).getHours(); if(!Number.isNaN(hh)) hoursAgainst[hh]++ }
            if(typeof p.tSec==='number') incBin(tAgainstBins, p.tSec)
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
    const topCombinedFor = Object.entries(combinedFor).sort((a,b)=> b[1]-a[1]).slice(0, TOP_N)
    const topCombinedAgainst = Object.entries(combinedAgainst).sort((a,b)=> b[1]-a[1]).slice(0, TOP_N)
    const topTargetFor = Object.entries(targetOnlyFor).sort((a,b)=> b[1]-a[1]).slice(0, TOP_N)
    const topTargetAgainst = Object.entries(targetOnlyAgainst).sort((a,b)=> b[1]-a[1]).slice(0, TOP_N)
    const vsHentou = (()=>{ const j=vsStance.JODAN, n=vsStance.NITOU; const b=j.bouts+n.bouts, w=j.wins+n.wins, l=j.losses+n.losses, d=j.draws+n.draws; return { bouts:b, wins:w, losses:l, draws:d, winRate: b? (w/b): 0 } })()
    return { wins, losses, draws, bouts, pf, pa, avgTime, fastest, slowest, winRate, ppg, diff, topCombinedFor, topCombinedAgainst, topTargetFor, topTargetAgainst, vsTop, hoursFor, hoursAgainst, tForBins, tAgainstBins, vsStance, vsHentou }
  }, [matches, playerId, from, to, tournamentFilter, officialFilter, homeUniversityId])

  function labelTarget(code:string){ return labelJa.target[code] ?? code }
  function labelMethod(code:string){ return code==='HANSOKU' ? t('winType.HANSOKU') : (labelJa.method[code] ?? code) }
  function buildTechniqueKey(target?: string|null, methods?: string[]|null){
    const mm = methods ?? []
    return `${target||''}:${mm.join('+')}`
  }
  function labelTechnique(targetCode?: string|null, methods?: string[]|null){
    if(!targetCode) return '-'
    const tlabel = labelJa.target[targetCode] ?? targetCode
    const mm = methods ?? []
    if(mm.length===0) return tlabel
    return mm.map(m=> `${labelJa.method[m] ?? m}${tlabel}`).join(' / ')
  }

  function PieChart({items, size=140}:{ items: [string, number][], size?:number }){
    const total = items.reduce((s, [,v])=> s+v, 0)
    if(total<=0) return <div>-</div>
    const r = size/2, cx=r, cy=r
    const nonZeroIdx = items.findIndex(([,v])=> v>0)
    if(items.filter(([,v])=> v>0).length===1 && nonZeroIdx>=0){
      const color = PALETTE[nonZeroIdx % PALETTE.length]
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={cx} cy={cy} r={r} fill={color} />
        </svg>
      )
    }
    let acc = 0
    const paths = items.map(([,v],i)=>{
      const a0 = (acc/total)*2*Math.PI; acc += v; const a1 = (acc/total)*2*Math.PI
      const x0 = cx + r*Math.cos(a0), y0 = cy + r*Math.sin(a0)
      const x1 = cx + r*Math.cos(a1), y1 = cy + r*Math.sin(a1)
      const large = (a1-a0) > Math.PI ? 1 : 0
      const d = `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`
      return (<path key={i} d={d} fill={PALETTE[i%PALETTE.length]} stroke="#fff" strokeWidth={1} />)
    })
    return (<svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>{paths}</svg>)
  }

  return (
    <View className="min-w-0">
      <Heading level={4}>{t('dashboard.title')}</Heading>
      <View marginTop="0.5rem">
        <Flex gap="0.75rem" wrap="wrap" alignItems="flex-end">
          <SelectField label={t('dashboard.selectPlayer')} value={playerId} onChange={e=> setPlayerId(e.target.value)} size="small" width="18rem">
            <option value="">--</option>
            {playerList.map(([id,name])=> (<option key={id} value={id}>{name}</option>))}
          </SelectField>
          <TextField label={t('dashboard.from')} type="date" value={from} onChange={e=> setFrom(e.target.value)} width="11rem" />
          <TextField label={t('dashboard.to')} type="date" value={to} onChange={e=> setTo(e.target.value)} width="11rem" />
          <SelectField label={t('filters.type')} value={officialFilter} onChange={e=> setOfficialFilter(e.target.value as any)} size="small" width="12rem">
            <option value="all">{t('filters.all')}</option>
            <option value="official">{t('filters.official')}</option>
            <option value="practice">{t('filters.practice')}</option>
            <option value="intra">{t('filters.intra') ?? 'Intra-squad only'}</option>
          </SelectField>
          <TextField label={t('dashboard.tournament')} placeholder={t('dashboard.tournamentPh')} value={tournamentFilter} onChange={e=> setTournamentFilter(e.target.value)} width="16rem" />
          <SelectField label={t('dashboard.granularity')||'Granularity'} value={granularity} onChange={e=> setGranularity(e.target.value as any)} size="small" width="12rem">
            <option value="technique">{t('dashboard.gran.technique')||'Technique x Target'}</option>
            <option value="target">{t('dashboard.gran.target')||'Target only'}</option>
          </SelectField>
          <Button onClick={()=> { setFrom(''); setTo(''); setTournamentFilter(''); setOfficialFilter('all') }}>{t('dashboard.clear')}</Button>
        </Flex>
      </View>

      {!playerId && (
        <View marginTop="0.75rem" color="#666">{t('dashboard.noData')}</View>
      )}

      {playerId && stat && (
        <View marginTop="0.75rem" style={{display:'grid', gridTemplateColumns:'repeat(2,minmax(0,1fr))', gap:12, minWidth:0}}>
          <View style={{gridColumn:'1 / -1', border:'1px solid #eee', borderRadius:8, padding:10, overflow:'hidden'}}>
            <Heading level={6}>{t('dashboard.stats')}</Heading>
            <div>{t('filters.type')}: <b>{officialFilter==='all'? t('filters.all') : officialFilter==='official'? t('filters.official') : (officialFilter==='practice' ? t('filters.practice') : (t('filters.intra')||'Intra-squad'))}</b></div>
            <div>{t('dashboard.bouts')}: <b>{stat.bouts}</b></div>
            <div>{t('dashboard.wins')}: <b>{stat.wins}</b> / {t('dashboard.losses')}: <b>{stat.losses}</b> / {t('dashboard.draws')}: <b>{stat.draws}</b></div>
            <div>{t('dashboard.winRate')}: <b>{(stat.winRate*100).toFixed(1)}%</b></div>
            <div>{t('dashboard.pointsFor')}: <b>{stat.pf}</b> / {t('dashboard.pointsAgainst')}: <b>{stat.pa}</b></div>
            <div>{t('dashboard.avgTimeToScore')}: <b>{stat.avgTime==null?'-':stat.avgTime.toFixed(1)+'s'}</b></div>
            <div>{t('dashboard.fastest')}: <b>{stat.fastest==null?'-':stat.fastest+'s'}</b> / {t('dashboard.slowest')}: <b>{stat.slowest==null?'-':stat.slowest+'s'}</b></div>
            <div>{t('dashboard.pointsPerBout')}: <b>{stat.ppg.toFixed(2)}</b> / {t('dashboard.diff')}: <b>{stat.diff>0?'+':''}{stat.diff}</b></div>
            <div>{t('dashboard.vsHentou')||'対変刀'}: <b>{(((stat as any).vsHentou?.winRate||0)*100).toFixed(1)}%</b> <span className="muted">({(stat as any).vsHentou?.wins||0}-{(stat as any).vsHentou?.losses||0}-{(stat as any).vsHentou?.draws||0} / {(stat as any).vsHentou?.bouts||0})</span></div>
          </View>

          <View style={{border:'1px solid #eee', borderRadius:8, padding:10, overflow:'hidden'}}>
            <Heading level={6}>{t('dashboard.pieFor')}</Heading>
            <div className="graph">
              <PieChart items={(granularity==='technique' ? stat.topCombinedFor : (stat as any).topTargetFor) as any} />
            </div>
            <Legend items={(granularity==='technique' ? stat.topCombinedFor : (stat as any).topTargetFor) as any} labelJa={labelJa} />

          </View>
          <View style={{border:'1px solid #eee', borderRadius:8, padding:10, overflow:'hidden'}}>
            <Heading level={6}>{t('dashboard.pieAgainst')}</Heading>
            <div className="graph">
              <PieChart items={(granularity==='technique' ? stat.topCombinedAgainst : (stat as any).topTargetAgainst) as any} />
            </div>
            <Legend items={(granularity==='technique' ? stat.topCombinedAgainst : (stat as any).topTargetAgainst) as any} labelJa={labelJa} />
          </View>

          <View style={{gridColumn:'1 / -1', border:'1px solid #eee', borderRadius:8, padding:10, overflow:'hidden'}}>
          </View>
          <View style={{gridColumn:'1 / -1', border:'1px solid #eee', borderRadius:8, padding:10, overflow:'hidden'}}>
            <Heading level={6}>{t('dashboard.vsStance') || '対変刀勝率'}</Heading>
            <View className="table-wrap">
              <Table variation="bordered" highlightOnHover>
                <TableHead>
                  <TableRow>
                    <TableCell as="th">{t('stance.stance')||'構え'}</TableCell>
                    <TableCell as="th">{t('dashboard.bouts')}</TableCell>
                    <TableCell as="th">{t('dashboard.wins')}</TableCell>
                    <TableCell as="th">{t('dashboard.losses')}</TableCell>
                    <TableCell as="th">{t('dashboard.draws')}</TableCell>
                    <TableCell as="th">{t('dashboard.winRate')||'Win %'}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(()=>{ const s=(stat as any).vsStance?.JODAN||{bouts:0,wins:0,losses:0,draws:0}; const wr=s.bouts? (s.wins/s.bouts*100).toFixed(1)+'%':'-'; return (
                    <TableRow>
                      <TableCell>{t('stance.JODAN')||'上段'}</TableCell>
                      <TableCell>{s.bouts}</TableCell>
                      <TableCell>{s.wins}</TableCell>
                      <TableCell>{s.losses}</TableCell>
                      <TableCell>{s.draws}</TableCell>
                      <TableCell>{wr}</TableCell>
                    </TableRow>
                  )})()}
                  {(()=>{ const s=(stat as any).vsStance?.NITOU||{bouts:0,wins:0,losses:0,draws:0}; const wr=s.bouts? (s.wins/s.bouts*100).toFixed(1)+'%':'-'; return (
                    <TableRow>
                      <TableCell>{t('stance.NITOU')||'二刀'}</TableCell>
                      <TableCell>{s.bouts}</TableCell>
                      <TableCell>{s.wins}</TableCell>
                      <TableCell>{s.losses}</TableCell>
                      <TableCell>{s.draws}</TableCell>
                      <TableCell>{wr}</TableCell>
                    </TableRow>
                  )})()}
                </TableBody>
              </Table>
            </View>
          </View>
          <View style={{gridColumn:'1 / -1', border:'1px solid #eee', borderRadius:8, padding:10, overflow:'hidden'}}>
            <View style={{gridColumn:'1 / -1', border:'1px solid #eee', borderRadius:8, padding:10, overflow:'hidden', marginBottom:12}}>
              <Heading level={6}>{t('dashboard.timeInBout') || '経過秒分布'}</Heading>
              <TimeInBoutHistogram binsFor={(stat as any).tForBins} binsAgainst={(stat as any).tAgainstBins} binSizeSec={BIN_SIZE_SEC} />
            </View>
            <Heading level={6}>{t('dashboard.vsOpponents')}</Heading>
            <View className="table-wrap">
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
                  <TableCell as="th">💬</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {stat.vsTop.map(([oppId, v])=> {
                  // count notes for this opponent across matches for selected player
                  let c = 0
                  for(const n of notes){
                    const m = matches.find(mm=> mm.id===n.matchId)
                    if(!m) continue
                    for(const b of (m.bouts?.items ?? [])){
                      const isLeft = b.ourPlayerId===playerId
                      const isRight = b.opponentPlayerId===playerId
                      if(!isLeft && !isRight) continue
                      const thisOpp = isLeft ? b.opponentPlayerId : b.ourPlayerId
                      if(thisOpp===oppId){ c++; break }
                    }
                  }
                  return (
                    <TableRow key={oppId}>
                      <TableCell>{players[oppId] ?? oppId}</TableCell>
                      <TableCell>{v.bouts}</TableCell>
                      <TableCell>{v.wins}</TableCell>
                      <TableCell>{v.losses}</TableCell>
                      <TableCell>{v.draws}</TableCell>
                      <TableCell>{v.pf}</TableCell>
                      <TableCell>{v.pa}</TableCell>
                      <TableCell>{c>0 ? `💬 ${c}` : ''}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            </View>
          </View>
          {/* Player overall analysis (per player, not per match) */}
          <View style={{gridColumn:'1 / -1', border:'1px solid #eee', borderRadius:8, padding:10, overflow:'hidden'}}>
            <Heading level={6}>{t('analysis.overallTitle')||'選手全体分析'}</Heading>
            <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:8, marginTop:8 }}>
              <textarea rows={4} value={overallNote} onChange={(e)=> setOverallNote(e.target.value)} placeholder={t('analysis.overallPh')||'選手全体の所感・課題・方針など'} style={{ width:'100%', fontSize:13, padding:'6px 8px' }} />
              <div className="no-print" style={{ display:'flex', justifyContent:'flex-end' }}>
                <Button size="small" onClick={saveOverall} isLoading={overallSaving} isDisabled={!playerId}>{t('actions.save')||'保存'}</Button>
              </div>
            </div>
          </View>

          {/* Player qualitative analysis (per match) */}
          <View style={{gridColumn:'1 / -1', border:'1px solid #eee', borderRadius:8, padding:10, overflow:'hidden'}}>
            <Heading level={6}>{t('analysis.playerNotes')||'選手分析'}</Heading>
            <div className="no-print" style={{ display:'flex', justifyContent:'flex-end', marginBottom:8 }}>
              <Button size="small" onClick={openAddNote} isDisabled={!playerId || playerMatches().length===0}>{t('analysis.add')||'コメント追加'}</Button>
            </div>
            {notes.length===0 ? (
              <div className="muted" style={{ fontSize:12 }}>{t('analysis.noNotes')||'コメントはありません'}</div>
            ) : (
              <View className="table-wrap">
                <Table variation="bordered" highlightOnHover>
                  <TableHead>
                    <TableRow>
                      <TableCell as="th">{t('labels.match')||'試合/日付'}</TableCell>
                      <TableCell as="th">{t('analysis.comment')||'コメント'}</TableCell>
                      <TableCell as="th"></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {notes.map((n,i)=>{
                      const m = matches.find(mm=> mm.id===n.matchId)
                      const title = m ? `${(m as any).heldOn||''} ${(m as any).tournament||''}` : n.matchId
                      return (
                        <TableRow key={n.matchId+String(i)}>
                          <TableCell>{title}</TableCell>
                          <TableCell>{n.comment}</TableCell>
                          <TableCell><Button size="small" variation="link" onClick={()=> openEditNote(n.matchId, n.comment)}>{t('analysis.edit')||'編集'}</Button></TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </View>
            )}
          </View>
        </View>
      )}
      {noteModal.open && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1200 }} onClick={()=> setNoteModal({ open:false, matchId:'', text:'' })}>
          <div style={{ background:'#fff', minWidth:360, maxWidth:720, width:'90%', padding:16, borderRadius:8 }} onClick={e=> e.stopPropagation()}>
            <Heading level={6}>{t('analysis.playerNotes')||'選手分析'}</Heading>
            <div style={{ display:'grid', gap:8, marginTop:12 }}>
              <div style={{ display:'grid', gridTemplateColumns:'180px 1fr', gap:8, alignItems:'center' }}>
                <div style={{ fontSize:13 }}>{t('labels.match')||'試合/日付'}</div>
                <select value={noteModal.matchId} onChange={(e)=> setNoteModal(m=> ({ ...m, matchId: e.target.value }))} style={{ padding:'6px 8px', fontSize:13 }}>
                  {playerMatches().map(m=> (<option key={m.id} value={m.id}>{(m as any).heldOn||''} {(m as any).tournament||''}</option>))}
                </select>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'180px 1fr', gap:8, alignItems:'start' }}>
                <div style={{ fontSize:13 }}>{t('analysis.comment')||'コメント'}</div>
                <textarea rows={4} value={noteModal.text} onChange={(e)=> setNoteModal(m=> ({ ...m, text: e.target.value }))} style={{ width:'100%', fontSize:13, padding:'6px 8px' }} />
              </div>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:12 }}>
              <Button variation="link" onClick={()=> setNoteModal({ open:false, matchId:'', text:'' })}>{t('action.cancel')||'キャンセル'}</Button>
              <Button variation="primary" onClick={saveNote} isDisabled={!noteModal.matchId || !playerId}>{t('actions.save')||'保存'}</Button>
            </div>
          </div>
        </div>
      )}
    </View>
  )
}

// Simple legend for pie items: expects [ [key,count], ... ]
function Legend(props:{ items: [string,number][], labelJa: { target: Record<string,string>, method: Record<string,string> } }){
  const { items, labelJa } = props
  const label = (key:string)=>{
    if(key==='HANSOKU') return '反則'
    const [t, rest] = key.split(':')
    if(!rest) return labelJa.target[t] ?? t
    const methods = rest.split('+')
    const tlabel = labelJa.target[t] ?? t
    if(methods.length===0 || (methods.length===1 && methods[0]==='')) return tlabel
    return methods.map(m=> (labelJa.method[m] ?? m)+tlabel).join(' / ')
  }
  return (
    <div style={{ marginTop:6, display:'grid', gap:4 }}>
      {items.map(([k,c],i)=> (
        <div key={k} style={{ display:'flex', alignItems:'center', gap:8, fontSize:12 }}>
          <div style={{ width:10, height:10, background:PALETTE[i % PALETTE.length], borderRadius:2 }} />
          <div style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{label(k)}</div>
          <div style={{ color:'#666' }}>{c}</div>
        </div>
      ))}
    </div>
  )
}

// Hour-of-day histogram (0-23) for For/Against
function TimeHistogram(props:{ forHours:number[]; againstHours:number[] }){
  const { forHours, againstHours } = props
  const max = Math.max(1, ...forHours, ...againstHours)
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(24,1fr)', gap:2, alignItems:'end', height:120 }}>
      {new Array(24).fill(0).map((_,h)=>{
        const f = forHours[h]||0; const a = againstHours[h]||0
        const fh = Math.round((f/max)*100); const ah = Math.round((a/max)*100)
        return (
          <div key={h} title={`${h}:00`} style={{ display:'grid', gap:2 }}>
            <div style={{ background:'#4caf50', height:`${fh}%`, width:'100%' }} />
            <div style={{ background:'#f44336', height:`${ah}%`, width:'100%' }} />
            <div style={{ fontSize:10, textAlign:'center', color:'#666' }}>{h}</div>
          </div>
        )
      })}
    </div>
  )
}

// Time-in-bout histogram by seconds (stacked per bin)
function TimeInBoutHistogram(props:{ binsFor:number[]; binsAgainst:number[]; binSizeSec:number }){
  const { binsFor, binsAgainst, binSizeSec } = props
  const n = Math.max(binsFor.length, binsAgainst.length)
  const max = Math.max(1, ...binsFor, ...binsAgainst)
  return (
    <div style={{ display:'grid', gridTemplateColumns:`repeat(${n},1fr)`, gap:2, alignItems:'end', height:120 }}>
      {new Array(n).fill(0).map((_,i)=>{
        const f = binsFor[i]||0; const a = binsAgainst[i]||0
        const fh = Math.round((f/max)*100); const ah = Math.round((a/max)*100)
        const start = i*binSizeSec
        const end = start + binSizeSec
        return (
          <div key={i} title={`${start}-${end}s`} style={{ display:'grid', gap:2 }}>
            <div style={{ background:'#4caf50', height:`${fh}%`, width:'100%' }} />
            <div style={{ background:'#f44336', height:`${ah}%`, width:'100%' }} />
            <div style={{ fontSize:10, textAlign:'center', color:'#666' }}>{start}</div>
          </div>
        )
      })}
    </div>
  )
}




