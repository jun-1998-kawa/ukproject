import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { View, Heading, SelectField, Table, TableHead, TableRow, TableCell, TableBody, Badge, TextField, Button, Flex, RadioGroupField, Radio, TextAreaField } from '@aws-amplify/ui-react'
import AIPanel from './AIPanel'
import { createPlayerAnalysisMutation } from '../graphql/matchMutations'

type Match = { id: string; heldOn: string; ourUniversityId?: string; opponentUniversityId?: string; bouts?: { items: Bout[] } }
type Bout = { id: string; ourPlayerId: string; opponentPlayerId: string; winType?: string | null; winnerPlayerId?: string | null; points?: { items: Point[] } }
type Point = { tSec: number; target?: string | null; methods?: string[] | null; scorerPlayerId?: string | null; judgement?: string | null }

type Master = { code: string; nameJa?: string; nameEn?: string }
type PlayerEx = { name: string; gender?: string|null; universityId?: string|null; grade?: number|null }

export default function ScoutingDashboard(props:{
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
  const [officialFilter, setOfficialFilter] = useState<'all'|'official'|'practice'>('all')
  const [playerSearch, setPlayerSearch] = useState<string>('')
  const [granularity, setGranularity] = useState<'coarse'|'detailed'>('detailed')
  const [aiOpen, setAiOpen] = useState(false)
  const [aiPayload, setAiPayload] = useState<any|null>(null)
  const [playersEx, setPlayersEx] = useState<Record<string, PlayerEx>>({})
  const [universities, setUniversities] = useState<Record<string, string>>({})
  const [playerAnalyses, setPlayerAnalyses] = useState<any[]>([])
  const [boutAnalyses, setBoutAnalyses] = useState<any[]>([])

  // Form state for adding new player analysis
  const [newAnalysisCategory, setNewAnalysisCategory] = useState<string>('TACTICAL')
  const [newAnalysisContent, setNewAnalysisContent] = useState<string>('')
  const [newAnalysisImportance, setNewAnalysisImportance] = useState<string>('MEDIUM')
  const [newAnalysisTags, setNewAnalysisTags] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

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

  // Fetch player analyses when player is selected
  useEffect(()=>{
    async function fetchPlayerAnalyses(){
      if(!playerId || !ai) return
      try{
        const token = await ai.getToken(); if(!token) return
        const q = `query ListPlayerAnalysisByPlayer($playerId:ID!){ listPlayerAnalysisByPlayer(playerId:$playerId){ items{ id playerId category content importance tags periodStart periodEnd recordedAt } } }`
        const r = await fetch(ai.apiUrl, { method:'POST', headers:{ 'Content-Type':'application/json','Authorization':token }, body: JSON.stringify({ query: q, variables:{ playerId } }) })
        const j:any = await r.json()
        if(j.data?.listPlayerAnalysisByPlayer?.items){
          setPlayerAnalyses(j.data.listPlayerAnalysisByPlayer.items)
        } else {
          setPlayerAnalyses([])
        }
      }catch{ setPlayerAnalyses([]) }
    }
    fetchPlayerAnalyses()
  }, [playerId])

  // Fetch bout analyses when player is selected
  useEffect(()=>{
    async function fetchBoutAnalyses(){
      if(!playerId || !ai) return
      const analyses: any[] = []
      try{
        const token = await ai.getToken(); if(!token) return
        // Find all bouts for this player
        for(const m of matches){
          for(const b of (m.bouts?.items ?? [])){
            if(b.ourPlayerId===playerId || b.opponentPlayerId===playerId){
              const boutId = b.id
              try{
                const q = `query ListBoutAnalysisByBout($boutId:ID!){ listBoutAnalysisByBout(boutId:$boutId){ items{ id boutId subjectPlayerId category content importance tags recordedAt } } }`
                const r = await fetch(ai.apiUrl, { method:'POST', headers:{'Content-Type':'application/json','Authorization':token}, body: JSON.stringify({ query: q, variables:{ boutId } }) })
                const j:any = await r.json()
                if(j.data?.listBoutAnalysisByBout?.items){
                  analyses.push(...j.data.listBoutAnalysisByBout.items)
                }
              }catch{}
            }
          }
        }
        setBoutAnalyses(analyses)
      }catch{ setBoutAnalyses([]) }
    }
    fetchBoutAnalyses()
  }, [playerId, matches])

  // Filter to opponent players only (not from home university)
  const opponentPlayerList = useMemo(() => {
    // Merge players from both sources: props.players and playersEx
    const allPlayerIds = new Set([...Object.keys(players), ...Object.keys(playersEx)])

    let list = Array.from(allPlayerIds).map(id => {
      const name = players[id] || playersEx[id]?.name || id  // Fallback to playersEx name, then ID
      const info = playersEx[id]
      const uniName = info?.universityId ? universities[info.universityId] || '' : ''
      const gradeText = info?.grade ? `${info.grade}年` : ''
      const displayName = [name, uniName, gradeText].filter(Boolean).join('　')
      return { id, name, displayName, info }
    })

    // Filter: Only opponent players (not from home university)
    if(homeUniversityId){
      list = list.filter(p => p.info?.universityId !== homeUniversityId)
    }

    // Search filter
    if(playerSearch.trim()){
      const query = playerSearch.trim().toLowerCase()
      list = list.filter(p=> p.displayName.toLowerCase().includes(query))
    }

    return list.sort((a,b)=> a.name.localeCompare(b.name,'ja'))
  }, [players, playersEx, universities, homeUniversityId, playerSearch])

  const stat = useMemo(()=>{
    if(!playerId) return null
    const filtered = matches.filter(m=>{
      if(from && m.heldOn < from) return false
      if(to && m.heldOn > to) return false
      if(officialFilter==='official' && (m as any).isOfficial === false) return false
      if(officialFilter==='practice' && (m as any).isOfficial !== false) return false
      if(tournamentFilter && (m as any).tournament && !(m as any).tournament.toLowerCase().includes(tournamentFilter.toLowerCase())) return false
      if(tournamentFilter && !(m as any).tournament) return false
      return true
    })
    const combinedFor: Record<string, number> = {}
    const combinedAgainst: Record<string, number> = {}
    let wins=0, losses=0, draws=0, bouts=0, pf=0, pa=0
    const times:number[]=[]

    const buildTechniqueKey = (target: string, methods: string[]) => {
      const mm = (methods||[]).slice().sort()
      return `${target||''}:${mm.join('+')}`
    }

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
        // Check if this player is involved
        const isLeft = b.ourPlayerId===playerId
        const isRight = b.opponentPlayerId===playerId
        if(!isLeft && !isRight) continue
        bouts++
        if(b.winType==='DRAW'){ draws++ }
        else if(b.winnerPlayerId){
          if(b.winnerPlayerId===playerId){ wins++ } else { losses++ }
        }
        for(const p of (b.points?.items ?? [])){
          if(p.scorerPlayerId===playerId){
            pf++; if(typeof p.tSec==='number') times.push(p.tSec)
            if(p.judgement==='HANSOKU') { combinedFor['HANSOKU']=(combinedFor['HANSOKU']||0)+1; continue }
            const key = makeKey(p.target||'', p.methods||[])
            combinedFor[key] = (combinedFor[key]||0)+1
          } else if(p.scorerPlayerId && (p.scorerPlayerId!==playerId)){
            pa++
            if(p.judgement==='HANSOKU') combinedAgainst['HANSOKU'] = (combinedAgainst['HANSOKU']||0)+1
            else { const key = makeKey(p.target||'', p.methods||[]); combinedAgainst[key] = (combinedAgainst[key]||0)+1 }
          }
        }
      }
    }
    const avgTime = times.length ? (times.reduce((a,b)=>a+b,0)/times.length) : null
    const winRate = bouts ? wins/bouts : 0
    const fastest = times.length ? Math.min(...times) : null
    const slowest = times.length ? Math.max(...times) : null
    const ppg = bouts ? pf / bouts : 0
    const diff = pf - pa
    const topCombinedFor = Object.entries(combinedFor).sort((a,b)=> b[1]-a[1]).slice(0, topN)
    const topCombinedAgainst = Object.entries(combinedAgainst).sort((a,b)=> b[1]-a[1]).slice(0, topN)
    return { wins, losses, draws, bouts, pf, pa, avgTime, fastest, slowest, winRate, ppg, diff, topCombinedFor, topCombinedAgainst }
  }, [matches, playerId, from, to, tournamentFilter, topN, officialFilter, granularity])

  // Match list for selected opponent player
  const matchList = useMemo(()=>{
    if(!playerId) return []
    const filtered = matches.filter(m=>{
      if(from && m.heldOn < from) return false
      if(to && m.heldOn > to) return false
      if(officialFilter==='official' && (m as any).isOfficial === false) return false
      if(officialFilter==='practice' && (m as any).isOfficial !== false) return false
      if(tournamentFilter && (m as any).tournament && !(m as any).tournament.toLowerCase().includes(tournamentFilter.toLowerCase())) return false
      if(tournamentFilter && !(m as any).tournament) return false
      return true
    })
    const list: any[] = []
    for(const m of filtered){
      for(const b of (m.bouts?.items ?? [])){
        const isLeft = b.ourPlayerId===playerId
        const isRight = b.opponentPlayerId===playerId
        if(!isLeft && !isRight) continue

        const opponentId = isLeft ? b.opponentPlayerId : b.ourPlayerId
        const opponentName = players[opponentId] || playersEx[opponentId]?.name || opponentId
        const opponentInfo = playersEx[opponentId]
        const opponentUniversity = opponentInfo?.universityId ? (universities[opponentInfo.universityId] || '') : ''

        let winStatus = '-'
        if(b.winType==='DRAW'){ winStatus = '△' }
        else if(b.winnerPlayerId===playerId){ winStatus = '○' }
        else if(b.winnerPlayerId){ winStatus = '●' }

        // Points scored by selected player
        const pointsFor = (b.points?.items ?? []).filter(p=> p.scorerPlayerId===playerId)
        const pointsForLabels = pointsFor.map(p=> {
          if(p.judgement==='HANSOKU') return t('winType.HANSOKU')
          const tgt = p.target ? labelJa.target[p.target] ?? p.target : ''
          const mth = (p.methods||[]).map(m=> labelJa.method[m] ?? m).join('')
          return `${mth}${tgt}`
        }).join(', ')

        // Build video URL with timestamp
        const boutVideoUrl = (b as any).videoUrl
        const matchVideoUrl = (m as any).videoUrl
        const matchVideoPlaylist = (m as any).videoPlaylist
        let videoUrl = boutVideoUrl || matchVideoUrl || matchVideoPlaylist || ''
        if(videoUrl && (b as any).videoTimestamp){
          const ts = (b as any).videoTimestamp
          const separator = videoUrl.includes('?') ? '&' : '?'
          videoUrl = `${videoUrl}${separator}t=${ts}`
        }

        list.push({
          matchId: m.id,
          boutId: b.id,
          date: m.heldOn,
          opponentName,
          opponentUniversity,
          winStatus,
          pointsFor: pointsForLabels || '-',
          videoUrl
        })
      }
    }
    return list.sort((a,b)=> b.date.localeCompare(a.date))
  }, [matches, playerId, from, to, officialFilter, tournamentFilter, players, playersEx, universities, labelJa, t])

  function labelTarget(code:string){ return labelJa.target[code] ?? code }
  function labelMethod(code:string){ return code==='HANSOKU' ? t('winType.HANSOKU') : (labelJa.method[code] ?? code) }
  function labelTechniqueCombined(key:string){
    if(key==='HANSOKU') return t('winType.HANSOKU')
    if(granularity === 'coarse') {
      // Coarse mode: show target only
      return labelTarget(key)
    } else {
      // Detailed mode: show methods + target
      const [target, mstr] = key.split(':')
      const ml = (mstr? mstr.split('+') : []).map(labelMethod)
      const base = ml.join('')
      return `${base}${labelTarget(target)}`
    }
  }

  function PieChart({items, size=160}:{ items: [string, number][], size?:number }){
    const total = items.reduce((s, [,v])=> s+v, 0)
    if(total<=0) return <div>-</div>
    const r = size/2, cx=r, cy=r
    const palette = ['#4e79a7','#f28e2b','#e15759','#76b7b2','#59a14f','#edc948','#b07aa1','#ff9da7','#9c755f','#bab0ab']

    const getColorIndex = (label: string) => {
      let hash = 0
      for(let i=0; i<label.length; i++){
        hash = ((hash << 5) - hash) + label.charCodeAt(i)
        hash = hash & hash
      }
      return Math.abs(hash) % palette.length
    }

    if(items.length === 1){
      const [label, v] = items[0]
      const pct = ((v/total)*100).toFixed(1)
      const color = palette[getColorIndex(label)]
      return (
        <div>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle cx={cx} cy={cy} r={r} fill={color} stroke="#fff" strokeWidth={1} />
          </svg>
          <div style={{ marginTop:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, marginTop:4 }}>
              <div style={{ width:12, height:12, background: color, border:'1px solid #ccc', flexShrink:0 }}></div>
              <span>{label} ({v}本, {pct}%)</span>
            </div>
          </div>
        </div>
      )
    }

    let acc = 0
    const paths = items.map(([label,v],i)=>{
      const a0 = (acc/total)*2*Math.PI - Math.PI/2; acc += v; const a1 = (i === items.length - 1) ? (2*Math.PI - Math.PI/2) : ((acc/total)*2*Math.PI - Math.PI/2)
      const x0 = cx + r*Math.cos(a0), y0 = cy + r*Math.sin(a0)
      const x1 = cx + r*Math.cos(a1), y1 = cy + r*Math.sin(a1)
      const large = (a1-a0) > Math.PI ? 1 : 0
      const d = `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`
      const color = palette[getColorIndex(label)]
      return (<path key={i} d={d} fill={color} stroke="#fff" strokeWidth={1} />)
    })
    const legend = items.map(([label,v],i)=>{
      const pct = ((v/total)*100).toFixed(1)
      const color = palette[getColorIndex(label)]
      return (<div key={i} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, marginTop:4 }}>
        <div style={{ width:12, height:12, background: color, border:'1px solid #ccc', flexShrink:0 }}></div>
        <span>{label} ({v}本, {pct}%)</span>
      </div>)
    })
    return (
      <div>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>{paths}</svg>
        <div style={{ marginTop:8 }}>{legend}</div>
      </div>
    )
  }

  // Submit handler for adding new player analysis
  async function handleAddAnalysis(){
    if(!playerId || !newAnalysisContent.trim()) {
      alert(i18n.language?.startsWith('ja') ? '選手を選択し、内容を入力してください' : 'Please select a player and enter content')
      return
    }
    if(!ai) return
    setSubmitting(true)
    try{
      const token = await ai.getToken(); if(!token) throw new Error('No token')
      const input = {
        playerId,
        category: newAnalysisCategory,
        content: newAnalysisContent.trim(),
        importance: newAnalysisImportance,
        tags: newAnalysisTags.trim() ? newAnalysisTags.split(',').map(t=> t.trim()).filter(Boolean) : [],
        recordedAt: new Date().toISOString()
      }
      const res = await fetch(ai.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'Authorization': token },
        body: JSON.stringify({ query: createPlayerAnalysisMutation, variables:{ input } })
      })
      const json = await res.json()
      if(json.errors) throw new Error(JSON.stringify(json.errors))
      const created = json.data?.createPlayerAnalysis
      if(!created) throw new Error('No data returned')
      // Add to local state
      setPlayerAnalyses(prev=> [created, ...prev])
      // Clear form
      setNewAnalysisContent('')
      setNewAnalysisTags('')
      setNewAnalysisCategory('TACTICAL')
      setNewAnalysisImportance('MEDIUM')
      alert(i18n.language?.startsWith('ja') ? '分析記録を追加しました' : 'Analysis added successfully')
    }catch(e:any){
      alert(`Error: ${e.message}`)
    }finally{
      setSubmitting(false)
    }
  }

  return (
    <View>
      <Heading level={4}>{i18n.language?.startsWith('ja') ? '対戦相手分析（スカウティング）' : 'Opponent Scouting'}</Heading>
      <View marginTop="0.5rem">
        <Flex gap="0.75rem" wrap="wrap" alignItems="flex-end">
          <TextField
            label={i18n.language?.startsWith('ja') ? '相手選手検索' : 'Search Opponent Player'}
            placeholder={i18n.language?.startsWith('ja') ? '選手名、大学名で検索' : 'Search by name, university'}
            value={playerSearch}
            onChange={e=> setPlayerSearch(e.target.value)}
            width="20rem"
          />
          <SelectField
            label={i18n.language?.startsWith('ja') ? '相手選手選択' : 'Select Opponent'}
            value={playerId}
            onChange={e=> setPlayerId(e.target.value)}
            size="small"
            width="22rem"
          >
            <option value="">--</option>
            {opponentPlayerList.map(p => (<option key={p.id} value={p.id}>{p.displayName}</option>))}
          </SelectField>
          <TextField label={t('dashboard.from')} type="date" value={from} onChange={e=> setFrom(e.target.value)} width="11rem" />
          <TextField label={t('dashboard.to')} type="date" value={to} onChange={e=> setTo(e.target.value)} width="11rem" />
          <SelectField label={t('filters.type')} value={officialFilter} onChange={e=> setOfficialFilter(e.target.value as any)} size="small" width="12rem">
            <option value="all">{t('filters.all')}</option>
            <option value="official">{t('filters.official')}</option>
            <option value="practice">{t('filters.practice')}</option>
          </SelectField>
          <TextField label={t('dashboard.tournament')} placeholder={t('dashboard.tournamentPh')} value={tournamentFilter} onChange={e=> setTournamentFilter(e.target.value)} width="16rem" />
          <SelectField label={t('dashboard.topN')} value={String(topN)} onChange={e=> setTopN(Number(e.target.value))} size="small" width="10rem">
            {[5,10,15].map(n=> (<option key={n} value={n}>{n}</option>))}
          </SelectField>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600 }}>{t('dashboard.granularity')}</label>
            <RadioGroupField legend="" name="granularity" value={granularity} onChange={e=> setGranularity(e.target.value as any)} direction="row">
              <Radio value="coarse">{t('dashboard.granularityCoarse')}</Radio>
              <Radio value="detailed">{t('dashboard.granularityDetailed')}</Radio>
            </RadioGroupField>
          </div>
          <Button onClick={()=> { setFrom(''); setTo(''); setTournamentFilter(''); setTopN(5); setOfficialFilter('all'); setPlayerSearch(''); setPlayerId(''); setGranularity('detailed') }}>
            {t('dashboard.clear')}
          </Button>
        </Flex>
      </View>

      {!playerId && (
        <View marginTop="0.75rem" padding="1rem" style={{ background: '#f9f9f9', borderRadius: 8 }}>
          <div style={{ textAlign: 'center', color: '#666', fontSize: 14 }}>
            {i18n.language?.startsWith('ja')
              ? '対戦相手の選手を選択してください。ホーム大学以外の選手のみ表示されます。'
              : 'Select an opponent player to analyze. Only players from other universities are shown.'}
          </div>
        </View>
      )}

      {playerId && stat && (
        <View marginTop="0.75rem" className="responsive-grid" style={{display:'grid', gridTemplateColumns:'repeat(3,minmax(180px,1fr))', gap:12}}>
          <View style={{border:'1px solid #eee', borderRadius:8, padding:10}}>
            <Heading level={6}>{t('dashboard.stats')}</Heading>
            <div>{t('filters.type')}: <b>{officialFilter==='all'? t('filters.all') : officialFilter==='official'? t('filters.official') : t('filters.practice')}</b></div>
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

          {/* Technique Details Tables */}
          <View style={{ gridColumn:'1 / -1', border:'1px solid #eee', borderRadius:8, padding:10 }}>
            <Heading level={6}>{i18n.language?.startsWith('ja') ? '取得技詳細' : 'Scored Techniques Detail'}</Heading>
            <div className="table-responsive">
            <Table size="small" variation="striped">
              <TableHead>
                <TableRow>
                  <TableCell as="th">{i18n.language?.startsWith('ja') ? '技' : 'Technique'}</TableCell>
                  <TableCell as="th">{i18n.language?.startsWith('ja') ? '本数' : 'Count'}</TableCell>
                  <TableCell as="th">{i18n.language?.startsWith('ja') ? '割合' : 'Percentage'}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {stat.topCombinedFor.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} style={{ textAlign:'center', color:'#999' }}>
                      {i18n.language?.startsWith('ja') ? 'データなし' : 'No data'}
                    </TableCell>
                  </TableRow>
                ) : stat.topCombinedFor.map(([k,v],i)=> {
                  const pct = ((v/stat.pf)*100).toFixed(1)
                  return (
                    <TableRow key={i}>
                      <TableCell>{labelTechniqueCombined(k)}</TableCell>
                      <TableCell><b>{v}</b></TableCell>
                      <TableCell>{pct}%</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            </div>
          </View>

          <View style={{ gridColumn:'1 / -1', border:'1px solid #eee', borderRadius:8, padding:10 }}>
            <Heading level={6}>{i18n.language?.startsWith('ja') ? '被取得技詳細' : 'Conceded Techniques Detail'}</Heading>
            <div className="table-responsive">
            <Table size="small" variation="striped">
              <TableHead>
                <TableRow>
                  <TableCell as="th">{i18n.language?.startsWith('ja') ? '技' : 'Technique'}</TableCell>
                  <TableCell as="th">{i18n.language?.startsWith('ja') ? '本数' : 'Count'}</TableCell>
                  <TableCell as="th">{i18n.language?.startsWith('ja') ? '割合' : 'Percentage'}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {stat.topCombinedAgainst.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} style={{ textAlign:'center', color:'#999' }}>
                      {i18n.language?.startsWith('ja') ? 'データなし' : 'No data'}
                    </TableCell>
                  </TableRow>
                ) : stat.topCombinedAgainst.map(([k,v],i)=> {
                  const pct = ((v/stat.pa)*100).toFixed(1)
                  return (
                    <TableRow key={i}>
                      <TableCell>{labelTechniqueCombined(k)}</TableCell>
                      <TableCell><b>{v}</b></TableCell>
                      <TableCell>{pct}%</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            </div>
          </View>

          {/* Match List Section */}
          <View style={{ gridColumn:'1 / -1', border:'1px solid #eee', borderRadius:8, padding:10 }}>
            <Heading level={6}>{i18n.language?.startsWith('ja') ? '試合一覧' : 'Match History'}</Heading>
            {matchList.length === 0 ? (
              <div style={{ textAlign:'center', color:'#999', padding:'1rem' }}>
                {i18n.language?.startsWith('ja') ? '試合データがありません' : 'No match data'}
              </div>
            ) : (
              <div className="table-responsive">
              <Table size="small" variation="striped">
                <TableHead>
                  <TableRow>
                    <TableCell as="th">{i18n.language?.startsWith('ja') ? '日付' : 'Date'}</TableCell>
                    <TableCell as="th">{i18n.language?.startsWith('ja') ? '対戦相手' : 'Opponent'}</TableCell>
                    <TableCell as="th">{i18n.language?.startsWith('ja') ? '大学' : 'University'}</TableCell>
                    <TableCell as="th">{i18n.language?.startsWith('ja') ? '勝敗' : 'Result'}</TableCell>
                    <TableCell as="th">{i18n.language?.startsWith('ja') ? '取った技' : 'Points Scored'}</TableCell>
                    <TableCell as="th">{i18n.language?.startsWith('ja') ? '動画' : 'Video'}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {matchList.map((item:any, idx:number)=> (
                    <TableRow key={idx}>
                      <TableCell>{item.date}</TableCell>
                      <TableCell>{item.opponentName}</TableCell>
                      <TableCell>{item.opponentUniversity}</TableCell>
                      <TableCell>{item.winStatus}</TableCell>
                      <TableCell>{item.pointsFor}</TableCell>
                      <TableCell>
                        {item.videoUrl ? (
                          <a href={item.videoUrl} target="_blank" rel="noopener noreferrer" style={{ color:'#0066cc', textDecoration:'none' }}>
                            {i18n.language?.startsWith('ja') ? '動画を見る' : 'Watch'}
                          </a>
                        ) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            )}
          </View>

          {/* Video List Section */}
          <View style={{ gridColumn:'1 / -1', border:'1px solid #eee', borderRadius:8, padding:10 }}>
            <Heading level={6}>{i18n.language?.startsWith('ja') ? '動画一覧' : 'Video List'}</Heading>
            {matchList.filter(m=>m.videoUrl).length === 0 ? (
              <div style={{ textAlign:'center', color:'#999', padding:'1rem' }}>
                {i18n.language?.startsWith('ja') ? '動画データがありません' : 'No video data'}
              </div>
            ) : (
              <div className="table-responsive">
              <Table size="small" variation="striped">
                <TableHead>
                  <TableRow>
                    <TableCell as="th">{i18n.language?.startsWith('ja') ? '日付' : 'Date'}</TableCell>
                    <TableCell as="th">{i18n.language?.startsWith('ja') ? '対戦相手' : 'Opponent'}</TableCell>
                    <TableCell as="th">{i18n.language?.startsWith('ja') ? '大学' : 'University'}</TableCell>
                    <TableCell as="th">{i18n.language?.startsWith('ja') ? '動画' : 'Video'}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {matchList.filter(m=>m.videoUrl).map((item:any, idx:number)=> (
                    <TableRow key={idx}>
                      <TableCell>{item.date}</TableCell>
                      <TableCell>{item.opponentName}</TableCell>
                      <TableCell>{item.opponentUniversity}</TableCell>
                      <TableCell>
                        <a href={item.videoUrl} target="_blank" rel="noopener noreferrer" style={{ color:'#0066cc', textDecoration:'none' }}>
                          {i18n.language?.startsWith('ja') ? '動画を見る' : 'Watch'}
                        </a>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            )}
          </View>

          {ai && (
            <div style={{ gridColumn:'1 / -1', display:'flex', justifyContent:'flex-end', gap:'0.5rem' }}>
              <Button variation="primary" onClick={async ()=> {
                if(!stat || !playerId) return

                const playerInfo = playersEx[playerId]
                const universityId = playerInfo?.universityId || null
                const universityName = universityId ? (universities[universityId] || null) : null
                const payload = {
                  version: 'v1',
                  mode: 'scouting', // ← スカウティング専用モード
                  locale: (navigator?.language||'ja'),
                  filters: { from, to, type: officialFilter, tournamentQuery: tournamentFilter||'' },
                  subject: {
                    playerId,
                    displayName: players[playerId]||playerId,
                    universityId,
                    universityName,
                    gender: playerInfo?.gender || null,
                    grade: playerInfo?.grade || null
                  },
                  sampleSizes: { matches: (matches||[]).length, bouts: stat.bouts },
                  stats: { bouts: stat.bouts, wins: stat.wins, losses: stat.losses, draws: stat.draws, pf: stat.pf, pa: stat.pa, ppg: stat.ppg, diff: stat.diff, winRate: stat.winRate, avgTimeToScoreSec: stat.avgTime, fastestSec: stat.fastest, slowestSec: stat.slowest },
                  topTechniquesFor: (stat.topCombinedFor||[]).map(([k,v]:any)=> ({ key:k, count: v })),
                  topTechniquesAgainst: (stat.topCombinedAgainst||[]).map(([k,v]:any)=> ({ key:k, count: v })),
                  qualitativeData: {
                    boutAnalyses: boutAnalyses.filter((a:any)=> a && a.boutId).map((a:any)=> {
                      // Find bout to get context
                      let vsPlayerName = null
                      let vsUniversity = null
                      let subjectName = null
                      let isAboutScoutedPlayer = false
                      for(const m of matches){
                        const bout = (m.bouts?.items ?? []).find((b:any)=> b.id === a.boutId)
                        if(bout){
                          // For scouting, we're analyzing the selected player (playerId)
                          // We want to know who they were fighting against
                          const isOur = bout.ourPlayerId === playerId
                          const vsPlayerId = isOur ? bout.opponentPlayerId : bout.ourPlayerId
                          vsPlayerName = players[vsPlayerId] || playersEx[vsPlayerId]?.name || vsPlayerId
                          const vsInfo = playersEx[vsPlayerId]
                          vsUniversity = vsInfo?.universityId ? (universities[vsInfo.universityId] || '') : ''

                          // Identify who this analysis is about
                          isAboutScoutedPlayer = a.subjectPlayerId === playerId
                          if(isAboutScoutedPlayer){
                            subjectName = players[playerId] || playersEx[playerId]?.name || playerId
                          } else {
                            subjectName = vsPlayerName
                          }
                          break
                        }
                      }
                      return {
                        boutId: a.boutId,
                        subjectPlayerId: a.subjectPlayerId,
                        subjectName,  // Who this analysis is about
                        isAboutScoutedPlayer,  // True if about the scouted opponent, false if about their opponent
                        category: a.category,
                        content: a.content,
                        importance: a.importance,
                        tags: a.tags,
                        recordedAt: a.recordedAt,
                        vsPlayer: vsPlayerName,  // 誰と対戦したか
                        vsUniversity
                      }
                    }),
                    playerAnalyses: playerAnalyses.filter((a:any)=> a).map((a:any)=> ({ category: a.category, content: a.content, importance: a.importance, tags: a.tags, periodStart: a.periodStart, periodEnd: a.periodEnd, recordedAt: a.recordedAt }))
                  },
                  notes: { dataSource: 'client-aggregated', context: 'opponent-scouting' }
                }
                setAiPayload(payload); setAiOpen(true)
              }}>
                {i18n.language?.startsWith('ja') ? 'スカウティングレポート生成' : 'Generate Scouting Report'}
              </Button>
            </div>
          )}

          {/* Add New Player Analysis Form */}
          {playerId && ai && (
            <View style={{ gridColumn:'1 / -1', border:'1px solid #667eea', borderRadius:8, padding:12, marginTop:12, background:'#f8f9ff' }}>
              <Heading level={6} style={{ marginBottom:'0.75rem' }}>
                {i18n.language?.startsWith('ja') ? '新規分析記録を追加' : 'Add New Analysis Record'}
              </Heading>
              <Flex direction="column" gap="0.75rem">
                <Flex gap="0.75rem" wrap="wrap">
                  <SelectField
                    label={i18n.language?.startsWith('ja') ? 'カテゴリー' : 'Category'}
                    value={newAnalysisCategory}
                    onChange={e=> setNewAnalysisCategory(e.target.value)}
                    width="180px"
                  >
                    <option value="STRENGTH">{t('analysis.categories.STRENGTH')}</option>
                    <option value="WEAKNESS">{t('analysis.categories.WEAKNESS')}</option>
                    <option value="TACTICAL">{t('analysis.categories.TACTICAL')}</option>
                    <option value="MENTAL">{t('analysis.categories.MENTAL')}</option>
                    <option value="TECHNICAL">{t('analysis.categories.TECHNICAL')}</option>
                    <option value="PHYSICAL">{t('analysis.categories.PHYSICAL')}</option>
                    <option value="OTHER">{t('analysis.categories.OTHER')}</option>
                  </SelectField>
                  <SelectField
                    label={i18n.language?.startsWith('ja') ? '重要度' : 'Importance'}
                    value={newAnalysisImportance}
                    onChange={e=> setNewAnalysisImportance(e.target.value)}
                    width="150px"
                  >
                    <option value="HIGH">{t('analysis.importance_levels.HIGH')}</option>
                    <option value="MEDIUM">{t('analysis.importance_levels.MEDIUM')}</option>
                    <option value="LOW">{t('analysis.importance_levels.LOW')}</option>
                  </SelectField>
                </Flex>
                <TextAreaField
                  label={i18n.language?.startsWith('ja') ? '内容' : 'Content'}
                  value={newAnalysisContent}
                  onChange={e=> setNewAnalysisContent(e.target.value)}
                  placeholder={i18n.language?.startsWith('ja') ? '分析内容を記入してください' : 'Enter analysis content'}
                  rows={4}
                  required
                />
                <TextField
                  label={i18n.language?.startsWith('ja') ? 'タグ（カンマ区切り）' : 'Tags (comma-separated)'}
                  value={newAnalysisTags}
                  onChange={e=> setNewAnalysisTags(e.target.value)}
                  placeholder={i18n.language?.startsWith('ja') ? '例: 攻撃的, 左構え' : 'e.g., aggressive, left-handed'}
                />
                <Button
                  variation="primary"
                  onClick={handleAddAnalysis}
                  isDisabled={submitting || !newAnalysisContent.trim()}
                  width="200px"
                >
                  {submitting
                    ? (i18n.language?.startsWith('ja') ? '追加中...' : 'Adding...')
                    : (i18n.language?.startsWith('ja') ? '分析記録を追加' : 'Add Analysis')
                  }
                </Button>
              </Flex>
            </View>
          )}

          {/* Analysis Records Section */}
          <View style={{ gridColumn:'1 / -1', border:'1px solid #eee', borderRadius:8, padding:10, marginTop:12 }}>
            <Heading level={6}>{i18n.language?.startsWith('ja') ? '分析記録' : 'Analysis Records'}</Heading>

            {/* Player Analyses */}
            <View marginTop="1rem">
              <Heading level={6} style={{ fontSize:'0.9rem', marginBottom:'0.5rem' }}>
                {i18n.language?.startsWith('ja') ? '選手分析記録' : 'Player Analysis Records'} ({playerAnalyses.filter((a:any)=> a).length})
              </Heading>
              {playerAnalyses.length === 0 ? (
                <div style={{ color:'#999', fontSize:'0.875rem', padding:'0.5rem' }}>
                  {i18n.language?.startsWith('ja') ? '記録がありません' : 'No records'}
                </div>
              ) : (
                playerAnalyses.filter((a:any)=> a).map(a=> (
                  <View key={a.id} marginTop="0.5rem" padding="0.75rem" style={{ border:'1px solid #ddd', borderRadius:6, background:'#fafafa' }}>
                    <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:4, flexWrap:'wrap' }}>
                      {a.category && (
                        <Badge variation={a.category==='STRENGTH'?'success':a.category==='WEAKNESS'?'error':'info'} size="small">
                          {t(`analysis.categories.${a.category}`)}
                        </Badge>
                      )}
                      {a.importance && (
                        <Badge variation={a.importance==='HIGH'?'error':a.importance==='LOW'?'info':'warning'} size="small">
                          {t(`analysis.importance_levels.${a.importance}`)}
                        </Badge>
                      )}
                      {a.tags && a.tags.length > 0 && a.tags.map((tag:string, i:number)=> (
                        <Badge key={i} size="small">{tag}</Badge>
                      ))}
                    </div>
                    {a.periodStart && a.periodEnd && (
                      <div style={{ fontSize:'0.75rem', color:'#666', marginBottom:4 }}>
                        {a.periodStart} ～ {a.periodEnd}
                      </div>
                    )}
                    <div style={{ marginTop:6, fontSize:'0.875rem', whiteSpace:'pre-wrap' }}>
                      {a.content || <span style={{ color:'#999', fontStyle:'italic' }}>{i18n.language?.startsWith('ja') ? '（内容なし）' : '(No content)'}</span>}
                    </div>
                    <div style={{ fontSize:'0.7rem', color:'#999', marginTop:6 }}>
                      {a.recordedAt ? new Date(a.recordedAt).toLocaleString() : ''}
                    </div>
                  </View>
                ))
              )}
            </View>

            {/* Bout Analyses */}
            <View marginTop="1.5rem">
              <Heading level={6} style={{ fontSize:'0.9rem', marginBottom:'0.5rem' }}>
                {i18n.language?.startsWith('ja') ? '試合分析記録' : 'Bout Analysis Records'} ({boutAnalyses.filter((a:any)=> a).length})
              </Heading>
              {boutAnalyses.length === 0 ? (
                <div style={{ color:'#999', fontSize:'0.875rem', padding:'0.5rem' }}>
                  {i18n.language?.startsWith('ja') ? '記録がありません' : 'No records'}
                </div>
              ) : (
                boutAnalyses.filter((a:any)=> a).map(a=> (
                  <View key={a.id} marginTop="0.5rem" padding="0.75rem" style={{ border:'1px solid #ddd', borderRadius:6, background:'#fafafa' }}>
                    <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:4, flexWrap:'wrap' }}>
                      {a.category && (
                        <Badge variation={a.category==='STRENGTH'?'success':a.category==='WEAKNESS'?'error':'info'} size="small">
                          {t(`analysis.categories.${a.category}`)}
                        </Badge>
                      )}
                      {a.importance && (
                        <Badge variation={a.importance==='HIGH'?'error':a.importance==='LOW'?'info':'warning'} size="small">
                          {t(`analysis.importance_levels.${a.importance}`)}
                        </Badge>
                      )}
                      {a.tags && a.tags.length > 0 && a.tags.map((tag:string, i:number)=> (
                        <Badge key={i} size="small">{tag}</Badge>
                      ))}
                      <span style={{ fontSize:'0.7rem', color:'#666' }}>
                        Bout: {a.boutId?.substring(0,8)}...
                      </span>
                    </div>
                    <div style={{ marginTop:6, fontSize:'0.875rem', whiteSpace:'pre-wrap' }}>
                      {a.content || <span style={{ color:'#999', fontStyle:'italic' }}>{i18n.language?.startsWith('ja') ? '（内容なし）' : '(No content)'}</span>}
                    </div>
                    <div style={{ fontSize:'0.7rem', color:'#999', marginTop:6 }}>
                      {a.recordedAt ? new Date(a.recordedAt).toLocaleString() : ''}
                    </div>
                  </View>
                ))
              )}
            </View>
          </View>
        </View>
      )}

      {ai && (
        <AIPanel open={aiOpen} onClose={()=> setAiOpen(false)} apiUrl={ai.apiUrl} getToken={ai.getToken} payload={aiPayload} />
      )}
    </View>
  )
}
