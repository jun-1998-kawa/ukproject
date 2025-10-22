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
  const [analysisModal, setAnalysisModal] = useState<{ open: boolean; id?: string; category: string; content: string; importance: string; tags: string; periodStart: string; periodEnd: string }>({ open: false, category: 'TACTICAL', content: '', importance: 'MEDIUM', tags: '', periodStart: '', periodEnd: '' })
  const [playerAnalyses, setPlayerAnalyses] = useState<any[]>([])
  const [boutAnalyses, setBoutAnalyses] = useState<any[]>([])
  const [showAnalyses, setShowAnalyses] = useState(false)
  const [analysisFilter, setAnalysisFilter] = useState<{ category: string; importance: string; tag: string }>({ category: 'all', importance: 'all', tag: '' })
  const [videoModal, setVideoModal] = useState<{ open: boolean; matchId?: string; boutId?: string; matchVideoUrl: string; matchVideoPlaylist: string; boutVideoUrl: string; boutVideoTimestamp: string }>({ open: false, matchVideoUrl: '', matchVideoPlaylist: '', boutVideoUrl: '', boutVideoTimestamp: '' })

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
      try{
        const token = await ai.getToken(); if(!token) return

        // Collect bout IDs for this player
        const boutIds: string[] = []
        for(const m of matches){
          for(const b of (m.bouts?.items ?? [])){
            if(b.ourPlayerId===playerId || b.opponentPlayerId===playerId){
              boutIds.push(b.id)
            }
          }
        }

        // Fetch bout analyses for these bouts
        const analyses: any[] = []
        for(const boutId of boutIds){
          try{
            const q = `query ListBoutAnalysisByBout($boutId:ID!){ listBoutAnalysisByBout(boutId:$boutId){ items{ id boutId subjectPlayerId category content importance tags recordedAt } } }`
            const r = await fetch(ai.apiUrl, { method:'POST', headers:{'Content-Type':'application/json','Authorization':token}, body: JSON.stringify({ query: q, variables:{ boutId } }) })
            const j:any = await r.json()
            if(j.data?.listBoutAnalysisByBout?.items){
              analyses.push(...j.data.listBoutAnalysisByBout.items)
            }
          }catch{}
        }
        setBoutAnalyses(analyses)
      }catch{ setBoutAnalyses([]) }
    }
    fetchBoutAnalyses()
  }, [playerId, matches])

  const playerList = useMemo(() => {
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

    // Home university filter - only show home university players
    if(homeUniversityId){
      list = list.filter(p=> p.info?.universityId === homeUniversityId)
    }

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
  }, [players, playersEx, universities, genderFilter, playerSearch, homeUniversityId])

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

  // Build match list with video links for the selected player
  const matchList = useMemo(()=>{
    if(!playerId) return []

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

    const list: any[] = []
    for(const m of filtered){
      for(const b of (m.bouts?.items ?? [])){
        if(b.ourPlayerId === playerId || b.opponentPlayerId === playerId){
          const isOur = b.ourPlayerId === playerId
          const oppId = isOur ? b.opponentPlayerId : b.ourPlayerId
          const oppName = players[oppId] || playersEx[oppId]?.name || oppId
          const oppInfo = playersEx[oppId]
          const oppUni = oppInfo?.universityId ? universities[oppInfo.universityId] || '' : ''
          const oppDisplay = oppUni ? `${oppName}（${oppUni}）` : oppName

          let result = '-'
          if(b.winType === 'DRAW') result = i18n.language?.startsWith('ja') ? '引き分け' : 'Draw'
          else if(b.winnerPlayerId){
            if(b.winnerPlayerId === playerId) result = i18n.language?.startsWith('ja') ? '勝ち' : 'Win'
            else result = i18n.language?.startsWith('ja') ? '負け' : 'Loss'
          }

          list.push({
            matchId: m.id,
            boutId: b.id,
            date: m.heldOn,
            tournament: (m as any).tournament || '-',
            opponent: oppDisplay,
            result,
            matchVideoUrl: (m as any).videoUrl || null,
            matchVideoPlaylist: (m as any).videoPlaylist || null,
            boutVideoUrl: (b as any).videoUrl || null,
            boutVideoTimestamp: (b as any).videoTimestamp || null
          })
        }
      }
    }

    return list.sort((a,b)=> b.date.localeCompare(a.date))
  }, [matches, playerId, from, to, tournamentFilter, officialFilter, homeUniversityId, players, playersEx, universities, i18n.language])

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

  // Filter analyses
  const filteredPlayerAnalyses = useMemo(()=>{
    let filtered = playerAnalyses
    if(analysisFilter.category !== 'all'){
      filtered = filtered.filter(a=> a.category === analysisFilter.category)
    }
    if(analysisFilter.importance !== 'all'){
      filtered = filtered.filter(a=> a.importance === analysisFilter.importance)
    }
    if(analysisFilter.tag.trim()){
      const query = analysisFilter.tag.trim().toLowerCase()
      filtered = filtered.filter(a=> {
        const tags = (a.tags || []).join(',').toLowerCase()
        return tags.includes(query) || a.content.toLowerCase().includes(query)
      })
    }
    // Filter by date range
    if(from || to){
      filtered = filtered.filter(a=>{
        if(from && a.periodEnd && a.periodEnd < from) return false
        if(to && a.periodStart && a.periodStart > to) return false
        return true
      })
    }
    // Sort by recordedAt desc
    return filtered.sort((a,b)=> (b.recordedAt||'').localeCompare(a.recordedAt||''))
  }, [playerAnalyses, analysisFilter, from, to])

  const filteredBoutAnalyses = useMemo(()=>{
    let filtered = boutAnalyses
    if(analysisFilter.category !== 'all'){
      filtered = filtered.filter(a=> a.category === analysisFilter.category)
    }
    if(analysisFilter.importance !== 'all'){
      filtered = filtered.filter(a=> a.importance === analysisFilter.importance)
    }
    if(analysisFilter.tag.trim()){
      const query = analysisFilter.tag.trim().toLowerCase()
      filtered = filtered.filter(a=> {
        const tags = (a.tags || []).join(',').toLowerCase()
        return tags.includes(query) || a.content.toLowerCase().includes(query)
      })
    }
    // Sort by recordedAt desc
    return filtered.sort((a,b)=> (b.recordedAt||'').localeCompare(a.recordedAt||''))
  }, [boutAnalyses, analysisFilter])

  const createPlayerAnalysisMutation = `mutation CreatePlayerAnalysis($input: CreatePlayerAnalysisInput!) {
    createPlayerAnalysis(input:$input){
      id playerId category content importance tags periodStart periodEnd recordedAt
    }
  }`

  const updatePlayerAnalysisMutation = `mutation UpdatePlayerAnalysis($input: UpdatePlayerAnalysisInput!) {
    updatePlayerAnalysis(input:$input){
      id playerId category content importance tags periodStart periodEnd recordedAt
    }
  }`

  const deletePlayerAnalysisMutation = `mutation DeletePlayerAnalysis($input: DeletePlayerAnalysisInput!) {
    deletePlayerAnalysis(input:$input){
      id
    }
  }`

  async function savePlayerAnalysis(){
    const { id, category, content, importance, tags, periodStart, periodEnd } = analysisModal
    if(!playerId){ alert(t('dashboard.noData') || 'Please select a player'); return }
    if(!content.trim()){ alert(t('errors.analysisContentRequired') || 'Content is required'); return }
    if(!ai){ alert(t('errors.notSignedIn') || 'Not signed in'); return }
    try{
      const token = await ai.getToken(); if(!token) return
      const tagsArray = tags.trim() ? tags.split(',').map(t=> t.trim()).filter(Boolean) : []

      if(id){
        // Update existing analysis
        const input:any = {
          id,
          category,
          content: content.trim(),
          importance,
          tags: tagsArray.length > 0 ? tagsArray : null,
          periodStart: periodStart || null,
          periodEnd: periodEnd || null,
        }
        const r = await fetch(ai.apiUrl,{method:'POST', headers:{'Content-Type':'application/json','Authorization':token}, body: JSON.stringify({ query:updatePlayerAnalysisMutation, variables:{ input } })});
        const j:any = await r.json(); if(j.errors) throw new Error(JSON.stringify(j.errors));
      } else {
        // Create new analysis
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
      }

      setAnalysisModal({ open: false, category: 'TACTICAL', content: '', importance: 'MEDIUM', tags: '', periodStart: '', periodEnd: '' })

      // Reload analyses
      const q = `query ListPlayerAnalysisByPlayer($playerId:ID!){ listPlayerAnalysisByPlayer(playerId:$playerId){ items{ id playerId category content importance tags periodStart periodEnd recordedAt } } }`
      const r = await fetch(ai.apiUrl, { method:'POST', headers:{ 'Content-Type':'application/json','Authorization':token }, body: JSON.stringify({ query: q, variables:{ playerId } }) })
      const j:any = await r.json()
      if(j.data?.listPlayerAnalysisByPlayer?.items){
        setPlayerAnalyses(j.data.listPlayerAnalysisByPlayer.items)
      }

      alert(t('notices.saved'))
    }catch(e:any){ alert(String(e?.message ?? e)) }
  }

  async function deletePlayerAnalysis(id: string){
    if(!confirm(t('confirm.delete') || 'Delete?')) return
    if(!ai) return
    try{
      const token = await ai.getToken(); if(!token) return
      const r = await fetch(ai.apiUrl,{method:'POST', headers:{'Content-Type':'application/json','Authorization':token}, body: JSON.stringify({ query:deletePlayerAnalysisMutation, variables:{ input: { id } } })});
      const j:any = await r.json(); if(j.errors) throw new Error(JSON.stringify(j.errors));

      // Reload analyses
      setPlayerAnalyses(prev=> prev.filter(a=> a.id !== id))
      alert(t('notices.deleted') || 'Deleted')
    }catch(e:any){ alert(String(e?.message ?? e)) }
  }

  function PieChart({items, size=160}:{ items: [string, number][], size?:number }){
    const total = items.reduce((s, [,v])=> s+v, 0)
    if(total<=0) return <div>-</div>
    const r = size/2, cx=r, cy=r

    // 技の種類ごとに固定色を割り当て
    const getColorForTechnique = (label: string): string => {
      // 反則
      if(label.includes('反則') || label.includes('HANSOKU')) return '#999999'

      // 面系 - 赤系グラデーション
      if(label.includes('面')) {
        if(label.includes('飛び込み') || label.includes('飛込')) return '#e15759'
        if(label.includes('引き')) return '#d63447'
        if(label.includes('出ばな') || label.includes('出鼻')) return '#ff6b6b'
        if(label.includes('すり上げ')) return '#ee5a6f'
        if(label.includes('返し')) return '#c92a2a'
        return '#e63946' // デフォルト面
      }

      // 小手系 - 青系グラデーション
      if(label.includes('小手')) {
        if(label.includes('引き')) return '#1971c2'
        if(label.includes('すり上げ')) return '#339af0'
        if(label.includes('出ばな') || label.includes('出鼻')) return '#4dabf7'
        if(label.includes('返し')) return '#1864ab'
        return '#1c7ed6' // デフォルト小手
      }

      // 胴系 - 緑系グラデーション
      if(label.includes('胴')) {
        if(label.includes('逆')) return '#37b24d'
        if(label.includes('引き')) return '#2b8a3e'
        return '#2f9e44' // デフォルト胴
      }

      // 突き - 黄色/オレンジ系
      if(label.includes('突き') || label.includes('突')) return '#f59f00'

      // その他 - 紫/グレー系
      const otherColors = ['#9775fa', '#ae3ec9', '#cc5de8', '#e599f7', '#fa5252', '#ff8787', '#51cf66', '#94d82d', '#ffd43b', '#ffa94d']
      let hash = 0
      for(let i=0; i<label.length; i++){
        hash = ((hash << 5) - hash) + label.charCodeAt(i)
        hash = hash & hash
      }
      return otherColors[Math.abs(hash) % otherColors.length]
    }

    // Special case: only one item (100%)
    if(items.length === 1){
      const [label, v] = items[0]
      const pct = ((v/total)*100).toFixed(1)
      const color = getColorForTechnique(label)
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
      const color = getColorForTechnique(label)
      return (<path key={i} d={d} fill={color} stroke="#fff" strokeWidth={1} />)
    })
    const legend = items.map(([label,v],i)=>{
      const pct = ((v/total)*100).toFixed(1)
      const color = getColorForTechnique(label)
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
            <RadioGroupField legend="" name="granularity" value={granularity} onChange={e=> setGranularity(e.target.value as any)} direction="row">
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
        <View marginTop="0.75rem" className="responsive-grid" style={{display:'grid', gridTemplateColumns:'repeat(3,minmax(180px,1fr))', gap:12}}>
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
                {stat.vsTop.map(([oppId, v])=> {
                  const playerName = players[oppId] || playersEx[oppId]?.name || oppId
                  const playerInfo = playersEx[oppId]
                  const uniName = playerInfo?.universityId ? (universities[playerInfo.universityId] || '') : ''
                  const displayName = uniName ? `${playerName}（${uniName}）` : playerName
                  return (
                    <TableRow key={oppId}>
                      <TableCell>{displayName}</TableCell>
                      <TableCell>{v.bouts}</TableCell>
                      <TableCell>{v.wins}</TableCell>
                      <TableCell>{v.losses}</TableCell>
                      <TableCell>{v.draws}</TableCell>
                      <TableCell>{v.pf}</TableCell>
                      <TableCell>{v.pa}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
          </Table>
        </View>

        {/* Match List with Video Links */}
        <View style={{ gridColumn:'1 / -1', padding:'1rem', background:'white', borderRadius:'8px' }}>
          <Heading level={5}>{i18n.language?.startsWith('ja') ? '試合一覧' : 'Match List'}</Heading>
          <Table highlightOnHover variation="striped" size="small">
            <TableHead>
              <TableRow>
                <TableCell as="th">{i18n.language?.startsWith('ja') ? '日付' : 'Date'}</TableCell>
                <TableCell as="th">{i18n.language?.startsWith('ja') ? '大会' : 'Tournament'}</TableCell>
                <TableCell as="th">{i18n.language?.startsWith('ja') ? '対戦相手' : 'Opponent'}</TableCell>
                <TableCell as="th">{i18n.language?.startsWith('ja') ? '結果' : 'Result'}</TableCell>
                <TableCell as="th">{i18n.language?.startsWith('ja') ? '動画' : 'Video'}</TableCell>
                <TableCell as="th">{i18n.language?.startsWith('ja') ? '編集' : 'Edit'}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {matchList.map((m, idx)=> {
                // Construct YouTube URL with timestamp if available
                let videoUrl = m.boutVideoUrl || m.matchVideoUrl || m.matchVideoPlaylist
                if(videoUrl && m.boutVideoTimestamp){
                  // Add timestamp parameter
                  const separator = videoUrl.includes('?') ? '&' : '?'
                  videoUrl = `${videoUrl}${separator}t=${m.boutVideoTimestamp}`
                }

                return (
                  <TableRow key={idx}>
                    <TableCell>{m.date}</TableCell>
                    <TableCell>{m.tournament}</TableCell>
                    <TableCell>{m.opponent}</TableCell>
                    <TableCell>
                      <span style={{
                        color: m.result.includes('勝') || m.result.includes('Win') ? 'green' :
                               m.result.includes('負') || m.result.includes('Loss') ? 'red' : 'gray',
                        fontWeight: 600
                      }}>
                        {m.result}
                      </span>
                    </TableCell>
                    <TableCell>
                      {videoUrl ? (
                        <a
                          href={videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: '#c00',
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          ▶ YouTube
                        </a>
                      ) : (
                        <span style={{ color: '#999' }}>-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        onClick={()=> {
                          setVideoModal({
                            open: true,
                            matchId: m.matchId,
                            boutId: m.boutId,
                            matchVideoUrl: m.matchVideoUrl || '',
                            matchVideoPlaylist: m.matchVideoPlaylist || '',
                            boutVideoUrl: m.boutVideoUrl || '',
                            boutVideoTimestamp: m.boutVideoTimestamp ? String(m.boutVideoTimestamp) : ''
                          })
                        }}
                      >
                        {i18n.language?.startsWith('ja') ? '編集' : 'Edit'}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
              {matchList.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} style={{ textAlign: 'center', color: '#999' }}>
                    {i18n.language?.startsWith('ja') ? '試合データがありません' : 'No matches found'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </View>

        {ai && (
          <div style={{ gridColumn:'1 / -1', display:'flex', justifyContent:'flex-end', gap:'0.5rem' }}>
            <Button onClick={()=> setShowAnalyses(!showAnalyses)}>
              {showAnalyses ? (i18n.language?.startsWith('ja') ? '分析記録を非表示' : 'Hide Analyses') : (i18n.language?.startsWith('ja') ? '分析記録を表示' : 'Show Analyses')}
            </Button>
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
                      const q = `query ListBoutAnalysisByBout($boutId:ID!){ listBoutAnalysisByBout(boutId:$boutId){ items{ id boutId subjectPlayerId category content importance tags recordedAt } } }`
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

              const playerInfo = playersEx[playerId]
              const universityId = playerInfo?.universityId || null
              const universityName = universityId ? (universities[universityId] || null) : null
              const payload = {
                version: 'v1', mode: 'personal', locale: (navigator?.language||'ja'),
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
                vsOpponents: (stat.vsTop||[]).map(([oppId, v]: any)=> ({ opponentId: oppId, name: players[oppId] || playersEx[oppId]?.name || oppId, ...v })),
                qualitativeData: {
                  boutAnalyses: boutAnalyses.filter((a:any)=> a && a.boutId).map((a:any)=> {
                    // Find bout to get context
                    let opponentName = null
                    let opponentUniversity = null
                    let subjectName = null
                    let isAboutSelectedPlayer = false
                    for(const m of matches){
                      const bout = (m.bouts?.items ?? []).find((b:any)=> b.id === a.boutId)
                      if(bout){
                        const isOur = bout.ourPlayerId === playerId
                        const oppId = isOur ? bout.opponentPlayerId : bout.ourPlayerId
                        opponentName = players[oppId] || playersEx[oppId]?.name || oppId
                        const oppInfo = playersEx[oppId]
                        opponentUniversity = oppInfo?.universityId ? (universities[oppInfo.universityId] || '') : ''

                        // Identify who this analysis is about
                        isAboutSelectedPlayer = a.subjectPlayerId === playerId
                        if(isAboutSelectedPlayer){
                          subjectName = players[playerId] || playersEx[playerId]?.name || playerId
                        } else {
                          subjectName = opponentName
                        }
                        break
                      }
                    }
                    return {
                      boutId: a.boutId,
                      subjectPlayerId: a.subjectPlayerId,
                      subjectName,  // Who this analysis is about
                      isAboutSelectedPlayer,  // True if about the main subject, false if about opponent
                      category: a.category,
                      content: a.content,
                      importance: a.importance,
                      tags: a.tags,
                      recordedAt: a.recordedAt,
                      opponentName,
                      opponentUniversity
                    }
                  }),
                  playerAnalyses: playerAnalyses.filter((a:any)=> a).map((a:any)=> ({ category: a.category, content: a.content, importance: a.importance, tags: a.tags, periodStart: a.periodStart, periodEnd: a.periodEnd, recordedAt: a.recordedAt }))
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

      {showAnalyses && playerId && ai && (
        <View marginTop="1rem" padding="1rem" style={{ border:'1px solid #eee', borderRadius:8 }}>
          <Heading level={5}>{i18n.language?.startsWith('ja') ? '分析記録' : 'Analysis Records'}</Heading>

          <Flex gap="0.5rem" marginTop="0.75rem" wrap="wrap" alignItems="flex-end">
            <SelectField label={t('analysis.category')} value={analysisFilter.category} onChange={e=> setAnalysisFilter({...analysisFilter, category: e.target.value})} size="small" width="12rem">
              <option value="all">{t('filters.all')}</option>
              <option value="STRENGTH">{t('analysis.categories.STRENGTH')}</option>
              <option value="WEAKNESS">{t('analysis.categories.WEAKNESS')}</option>
              <option value="TACTICAL">{t('analysis.categories.TACTICAL')}</option>
              <option value="MENTAL">{t('analysis.categories.MENTAL')}</option>
              <option value="TECHNICAL">{t('analysis.categories.TECHNICAL')}</option>
              <option value="PHYSICAL">{t('analysis.categories.PHYSICAL')}</option>
              <option value="OTHER">{t('analysis.categories.OTHER')}</option>
            </SelectField>
            <SelectField label={t('analysis.importance')} value={analysisFilter.importance} onChange={e=> setAnalysisFilter({...analysisFilter, importance: e.target.value})} size="small" width="10rem">
              <option value="all">{t('filters.all')}</option>
              <option value="HIGH">{t('analysis.importance_levels.HIGH')}</option>
              <option value="MEDIUM">{t('analysis.importance_levels.MEDIUM')}</option>
              <option value="LOW">{t('analysis.importance_levels.LOW')}</option>
            </SelectField>
            <TextField label={i18n.language?.startsWith('ja') ? 'タグ・キーワード検索' : 'Tag/Keyword'} value={analysisFilter.tag} onChange={e=> setAnalysisFilter({...analysisFilter, tag: e.target.value})} width="16rem" />
            <Button onClick={()=> setAnalysisFilter({ category: 'all', importance: 'all', tag: '' })}>{t('dashboard.clear')}</Button>
          </Flex>

          {/* Player Analyses */}
          <View marginTop="1rem">
            <Heading level={6}>{i18n.language?.startsWith('ja') ? '選手分析記録' : 'Player Analysis Records'} ({filteredPlayerAnalyses.length})</Heading>
            {filteredPlayerAnalyses.length === 0 && (
              <div style={{ color:'#666', marginTop:'0.5rem' }}>{i18n.language?.startsWith('ja') ? '記録がありません' : 'No records'}</div>
            )}
            {filteredPlayerAnalyses.map(a=> (
              <View key={a.id} marginTop="0.75rem" padding="0.75rem" style={{ border:'1px solid #ddd', borderRadius:6, background:'#fafafa' }}>
                <Flex justifyContent="space-between" alignItems="flex-start">
                  <div>
                    <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4 }}>
                      <Badge variation={a.category==='STRENGTH'?'success':a.category==='WEAKNESS'?'error':'info'}>{t(`analysis.categories.${a.category}`)}</Badge>
                      <Badge variation={a.importance==='HIGH'?'error':a.importance==='LOW'?'info':'warning'}>{t(`analysis.importance_levels.${a.importance}`)}</Badge>
                      {a.tags && a.tags.length > 0 && a.tags.map((tag:string, i:number)=> (<Badge key={i}>{tag}</Badge>))}
                    </div>
                    {a.periodStart && a.periodEnd && (
                      <div style={{ fontSize:11, color:'#666', marginBottom:4 }}>{a.periodStart} ～ {a.periodEnd}</div>
                    )}
                    <div style={{ marginTop:6, whiteSpace:'pre-wrap' }}>{a.content}</div>
                    <div style={{ fontSize:11, color:'#999', marginTop:6 }}>{a.recordedAt ? new Date(a.recordedAt).toLocaleString() : ''}</div>
                  </div>
                  <Flex gap="0.5rem">
                    <Button size="small" onClick={()=> setAnalysisModal({ open: true, id: a.id, category: a.category, content: a.content, importance: a.importance, tags: (a.tags||[]).join(', '), periodStart: a.periodStart||'', periodEnd: a.periodEnd||'' })}>{t('actions.edit') || 'Edit'}</Button>
                    <Button size="small" variation="destructive" onClick={()=> deletePlayerAnalysis(a.id)}>{t('actions.delete')}</Button>
                  </Flex>
                </Flex>
              </View>
            ))}
          </View>

          {/* Bout Analyses */}
          <View marginTop="1.5rem">
            <Heading level={6}>{i18n.language?.startsWith('ja') ? '試合分析記録' : 'Bout Analysis Records'} ({filteredBoutAnalyses.length})</Heading>
            {filteredBoutAnalyses.length === 0 && (
              <div style={{ color:'#666', marginTop:'0.5rem' }}>{i18n.language?.startsWith('ja') ? '記録がありません' : 'No records'}</div>
            )}
            {filteredBoutAnalyses.map(a=> (
              <View key={a.id} marginTop="0.75rem" padding="0.75rem" style={{ border:'1px solid #ddd', borderRadius:6, background:'#fafafa' }}>
                <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4 }}>
                  <Badge variation={a.category==='STRENGTH'?'success':a.category==='WEAKNESS'?'error':'info'}>{t(`analysis.categories.${a.category}`)}</Badge>
                  <Badge variation={a.importance==='HIGH'?'error':a.importance==='LOW'?'info':'warning'}>{t(`analysis.importance_levels.${a.importance}`)}</Badge>
                  {a.tags && a.tags.length > 0 && a.tags.map((tag:string, i:number)=> (<Badge key={i}>{tag}</Badge>))}
                  <span style={{ fontSize:11, color:'#666' }}>Bout ID: {a.boutId.substring(0,8)}...</span>
                </div>
                <div style={{ marginTop:6, whiteSpace:'pre-wrap' }}>{a.content}</div>
                <div style={{ fontSize:11, color:'#999', marginTop:6 }}>{a.recordedAt ? new Date(a.recordedAt).toLocaleString() : ''}</div>
              </View>
            ))}
          </View>
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

      {/* Video Edit Modal */}
      {videoModal.open && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '2rem', borderRadius: '8px', maxWidth: '600px', width: '100%', maxHeight: '80vh', overflow: 'auto' }}>
            <View>
              <Heading level={4}>{i18n.language?.startsWith('ja') ? '動画URL編集' : 'Edit Video URLs'}</Heading>
              <div style={{ marginTop: '1rem' }}>
                <Heading level={6}>{i18n.language?.startsWith('ja') ? '試合全体の動画' : 'Match Video'}</Heading>
                <TextField
                  label={i18n.language?.startsWith('ja') ? '動画URL' : 'Video URL'}
                  value={videoModal.matchVideoUrl}
                  onChange={e=> setVideoModal({...videoModal, matchVideoUrl: e.target.value})}
                  placeholder="https://youtube.com/watch?v=..."
                  marginTop="0.5rem"
                />
                <TextField
                  label={i18n.language?.startsWith('ja') ? 'プレイリストURL' : 'Playlist URL'}
                  value={videoModal.matchVideoPlaylist}
                  onChange={e=> setVideoModal({...videoModal, matchVideoPlaylist: e.target.value})}
                  placeholder="https://youtube.com/playlist?list=..."
                  marginTop="0.5rem"
                />
              </div>
              <div style={{ marginTop: '1.5rem' }}>
                <Heading level={6}>{i18n.language?.startsWith('ja') ? 'この試合の動画（優先）' : 'Bout Video (Priority)'}</Heading>
                <TextField
                  label={i18n.language?.startsWith('ja') ? '動画URL' : 'Video URL'}
                  value={videoModal.boutVideoUrl}
                  onChange={e=> setVideoModal({...videoModal, boutVideoUrl: e.target.value})}
                  placeholder="https://youtube.com/watch?v=..."
                  marginTop="0.5rem"
                />
                <TextField
                  label={i18n.language?.startsWith('ja') ? 'タイムスタンプ（秒）' : 'Timestamp (seconds)'}
                  type="number"
                  value={videoModal.boutVideoTimestamp}
                  onChange={e=> setVideoModal({...videoModal, boutVideoTimestamp: e.target.value})}
                  placeholder="125"
                  marginTop="0.5rem"
                />
                <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
                  {i18n.language?.startsWith('ja')
                    ? '※タイムスタンプを指定すると、動画がその位置から再生されます'
                    : '* Timestamp will make the video start at that position'}
                </div>
              </div>
              <Flex gap="0.5rem" marginTop="1.5rem" justifyContent="flex-end">
                <Button onClick={()=> setVideoModal({...videoModal, open:false})}>
                  {i18n.language?.startsWith('ja') ? 'キャンセル' : 'Cancel'}
                </Button>
                <Button variation="primary" onClick={async ()=> {
                  if(!ai) return
                  try {
                    const token = await ai.getToken()
                    if(!token) return

                    // Update Match video URLs
                    if(videoModal.matchId){
                      const updateMatchMutation = `mutation UpdateMatch($input: UpdateMatchInput!) {
                        updateMatch(input:$input){ id videoUrl videoPlaylist }
                      }`
                      const matchInput = {
                        id: videoModal.matchId,
                        videoUrl: videoModal.matchVideoUrl || null,
                        videoPlaylist: videoModal.matchVideoPlaylist || null
                      }
                      const r1 = await fetch(ai.apiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': token },
                        body: JSON.stringify({ query: updateMatchMutation, variables: { input: matchInput } })
                      })
                      const j1: any = await r1.json()
                      if(j1.errors) throw new Error(JSON.stringify(j1.errors))
                    }

                    // Update Bout video URLs
                    if(videoModal.boutId){
                      const updateBoutMutation = `mutation UpdateBout($input: UpdateBoutInput!) {
                        updateBout(input:$input){ id videoUrl videoTimestamp }
                      }`
                      const boutInput: any = {
                        id: videoModal.boutId,
                        videoUrl: videoModal.boutVideoUrl || null,
                        videoTimestamp: videoModal.boutVideoTimestamp ? parseInt(videoModal.boutVideoTimestamp) : null
                      }
                      const r2 = await fetch(ai.apiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': token },
                        body: JSON.stringify({ query: updateBoutMutation, variables: { input: boutInput } })
                      })
                      const j2: any = await r2.json()
                      if(j2.errors) throw new Error(JSON.stringify(j2.errors))
                    }

                    setVideoModal({...videoModal, open: false})
                    // Refresh matches to show updated video links
                    window.location.reload()
                  } catch(e: any) {
                    alert(i18n.language?.startsWith('ja') ? '保存に失敗しました' : 'Failed to save')
                  }
                }}>
                  {i18n.language?.startsWith('ja') ? '保存' : 'Save'}
                </Button>
              </Flex>
            </View>
          </div>
        </div>
      )}
    </View>
  )
}

