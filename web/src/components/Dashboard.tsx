import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { View, Heading, SelectField, Table, TableHead, TableRow, TableCell, TableBody, Badge, TextField, Button, Flex } from '@aws-amplify/ui-react'
import AIPanel from './AIPanel'

type Match = { id: string; heldOn: string; bouts?: { items: Bout[] } }
type Bout = { id: string; ourPlayerId: string; opponentPlayerId: string; winType?: string | null; winnerPlayerId?: string | null; points?: { items: Point[] } }
type Point = { tSec: number; target?: string | null; methods?: string[] | null; scorerPlayerId?: string | null; judgement?: string | null }

type Master = { code: string; nameJa?: string; nameEn?: string }

export default function Dashboard(props:{
  matches: Match[]
  players: Record<string,string>
  masters: { targets: Master[]; methods: Master[] }
  labelJa: { target: Record<string,string>, method: Record<string,string> }
  homeUniversityId?: string
  ai?: { apiUrl: string; getToken: ()=>Promise<string> }
}){
  const { t } = useTranslation()
  const { matches, players, labelJa, homeUniversityId } = props
  const ai = props.ai
  const [playerId, setPlayerId] = useState<string>('')
  const [from, setFrom] = useState<string>('')
  const [to, setTo] = useState<string>('')
  const [tournamentFilter, setTournamentFilter] = useState<string>('')
  const [topN, setTopN] = useState<number>(5)
  const [officialFilter, setOfficialFilter] = useState<'all'|'official'|'practice'|'intra'>('all')
  const [aiOpen, setAiOpen] = useState(false)
  const [aiPayload, setAiPayload] = useState<any|null>(null)

  const playerList = useMemo(() => Object.entries(players).sort((a,b)=> a[1].localeCompare(b[1],'ja')), [players])

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
            const key = buildTechniqueKey(p.target||'', p.methods||[])
            combinedFor[key] = (combinedFor[key]||0)+1
          } else if(p.scorerPlayerId && (p.scorerPlayerId!==playerId)){
            pa++; opp.pa++
            if(p.judgement==='HANSOKU') combinedAgainst['HANSOKU'] = (combinedAgainst['HANSOKU']||0)+1
            else { const key = buildTechniqueKey(p.target||'', p.methods||[]); combinedAgainst[key] = (combinedAgainst[key]||0)+1 }
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
  }, [matches, playerId, from, to, tournamentFilter, topN, officialFilter, homeUniversityId])

  function labelTarget(code:string){ return labelJa.target[code] ?? code }
  function labelMethod(code:string){ return code==='HANSOKU' ? t('winType.HANSOKU') : (labelJa.method[code] ?? code) }
  function buildTechniqueKey(target?:string, methods?:string[]){ const mm = (methods||[]).slice().sort(); return `${target||''}:${mm.join('+')}` }
  function labelTechniqueCombined(key:string){ if(key==='HANSOKU') return t('winType.HANSOKU'); const [target, mstr] = key.split(':'); const ml = (mstr? mstr.split('+') : []).map(labelMethod); const base = ml.join(''); return `${base}${labelTarget(target)}` }

  function PieChart({items, size=160}:{ items: [string, number][], size?:number }){
    const total = items.reduce((s, [,v])=> s+v, 0)
    if(total<=0) return <div>-</div>
    const r = size/2, cx=r, cy=r
    let acc = 0
    const palette = ['#4e79a7','#f28e2b','#e15759','#76b7b2','#59a14f','#edc948','#b07aa1','#ff9da7','#9c755f','#bab0ab']
    const paths = items.map(([label,v],i)=>{
      const a0 = (acc/total)*2*Math.PI; acc += v; const a1 = (acc/total)*2*Math.PI
      const x0 = cx + r*Math.cos(a0), y0 = cy + r*Math.sin(a0)
      const x1 = cx + r*Math.cos(a1), y1 = cy + r*Math.sin(a1)
      const large = (a1-a0) > Math.PI ? 1 : 0
      const d = `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`
      return (<path key={i} d={d} fill={palette[i%palette.length]} stroke="#fff" strokeWidth={1} />)
    })
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>{paths}</svg>
    )
  }

  return (
    <View>
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
          <SelectField label={t('dashboard.topN')} value={String(topN)} onChange={e=> setTopN(Number(e.target.value))} size="small" width="10rem">
            {[5,10,15].map(n=> (<option key={n} value={n}>{n}</option>))}
          </SelectField>
          <Button onClick={()=> { setFrom(''); setTo(''); setTournamentFilter(''); setTopN(5); setOfficialFilter('all') }}>{t('dashboard.clear')}</Button>
        </Flex>
      </View>

      {!playerId && (
        <View marginTop="0.75rem" color="#666">{t('dashboard.noData')}</View>
      )}

      {playerId && stat && (
        <View marginTop="0.75rem" style={{display:'grid', gridTemplateColumns:'repeat(3,minmax(180px,1fr))', gap:12}}>
          <View style={{border:'1px solid #eee', borderRadius:8, padding:10}}>
            <Heading level={6}>{t('dashboard.stats')}</Heading>
            <div>{t('filters.type')}: <b>{officialFilter==='all'? t('filters.all') : officialFilter==='official'? t('filters.official') : (officialFilter==='practice' ? t('filters.practice') : (t('filters.intra')||'Intra-squad'))}</b></div>
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
            <PieChart items={stat.topCombinedFor as any} />
          </View>

          <View style={{border:'1px solid #eee', borderRadius:8, padding:10}}>
            <Heading level={6}>{t('dashboard.pieAgainst')}</Heading>
            <PieChart items={stat.topCombinedAgainst as any} />
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
          <div style={{ gridColumn:'1 / -1', display:'flex', justifyContent:'flex-end' }}>
            <Button variation="primary" onClick={()=> {
              if(!stat || !playerId) return
              const payload = {
                version: 'v1', mode: 'personal', locale: (navigator?.language||'ja'),
                filters: { from, to, type: officialFilter, tournamentQuery: tournamentFilter||'' },
                subject: { playerId, displayName: players[playerId]||playerId },
                sampleSizes: { matches: (matches||[]).length, bouts: stat.bouts },
                stats: { bouts: stat.bouts, wins: stat.wins, losses: stat.losses, draws: stat.draws, pf: stat.pf, pa: stat.pa, ppg: stat.ppg, diff: stat.diff, winRate: stat.winRate, avgTimeToScoreSec: stat.avgTime, fastestSec: stat.fastest, slowestSec: stat.slowest },
                topTechniquesFor: (stat.topCombinedFor||[]).map(([k,v]:any)=> ({ key:k, count: v })),
                topTechniquesAgainst: (stat.topCombinedAgainst||[]).map(([k,v]:any)=> ({ key:k, count: v })),
                vsOpponents: (stat.vsTop||[]).map(([oppId, v]: any)=> ({ opponentId: oppId, name: players[oppId]||oppId, ...v })),
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
    </View>
  )
}

