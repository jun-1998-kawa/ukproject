import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { View, Heading, SelectField, Table, TableHead, TableRow, TableCell, TableBody, TextField, Button, Flex } from '@aws-amplify/ui-react'

type Match = { id: string; heldOn: string; tournament?: string; isOfficial?: boolean; ourUniversityId?: string; opponentUniversityId?: string; bouts?: { items: Bout[] } }
type Bout = { id: string; ourPlayerId: string; opponentPlayerId: string; winType?: string | null; winnerPlayerId?: string | null; points?: { items: Point[] } }
type Point = { tSec: number; target?: string | null; methods?: string[] | null; scorerPlayerId?: string | null; judgement?: string | null }

export default function TeamDashboard(props:{ matches: Match[]; universities: Record<string,string>; labelJa: { target: Record<string,string>, method: Record<string,string> }; homeUniversityId?: string; players?: Record<string,string>; apiUrl?: string; getToken?: ()=> Promise<string|null>; tournamentPlaylists?: Record<string,string>; }){
  const { t, i18n } = useTranslation()
  const { matches, universities, labelJa, homeUniversityId, players } = props
  const [teamId, setTeamId] = useState<string>('')
  const [from, setFrom] = useState<string>('')
  const [to, setTo] = useState<string>('')
  const [tournamentFilter, setTournamentFilter] = useState<string>('')
  const TOP_N = 5
  const [officialFilter, setOfficialFilter] = useState<'all'|'official'|'practice'|'intra'>('all')
  // YouTube playlists per tournament
  const [ytMap, setYtMap] = useState<Record<string,string>>(props.tournamentPlaylists || {})
  const [ytOpen, setYtOpen] = useState(false)
  const [noteCountByMatch, setNoteCountByMatch] = useState<Record<string,number>>({})
  const [noteCountByOpponent, setNoteCountByOpponent] = useState<Record<string,number>>({})

  useEffect(()=>{ if(!teamId && homeUniversityId) setTeamId(homeUniversityId) }, [homeUniversityId])

  const teamList = useMemo(()=>{
    const ids = new Set<string>()
    for(const m of matches){ if(m.ourUniversityId) ids.add(m.ourUniversityId); if(m.opponentUniversityId) ids.add(m.opponentUniversityId) }
    return Array.from(ids).map(id=> [id, universities[id] || id] as const).sort((a,b)=> a[1].localeCompare(b[1],'ja'))
  }, [matches, universities])

  // Unique tournament names across all matches (sorted)
  const tournamentNames = useMemo(()=>{
    const s = new Set<string>()
    for(const m of matches){ if(m.tournament) s.add(m.tournament) }
    return Array.from(s).sort((a,b)=> a.localeCompare(b,'ja'))
  }, [matches])

  useEffect(()=>{
    try{ const raw = localStorage.getItem('yt.playlists'); if(raw){ const j = JSON.parse(raw); if(j && typeof j==='object') setYtMap(j) } }catch{}
  },[])
  useEffect(()=>{ try{ const srv = (window as any).__tournamentPlaylists as Record<string,string>|undefined; if(srv){ setYtMap(m=> ({ ...srv, ...m })) } }catch{} },[])
  function canonicalPlaylistUrl(input: string): string | '' {
    const s = (input||'').trim()
    if(!s) return ''
    try{
      if(/^https?:\/\//i.test(s)){
        const u = new URL(s)
        const id = u.searchParams.get('list') || ''
        return id ? `https://www.youtube.com/playlist?list=${id}` : s
      }
      // treat as playlist id
      return `https://www.youtube.com/playlist?list=${s}`
    }catch{ return '' }
  }

  async function saveYt(){
    try{ localStorage.setItem('yt.playlists', JSON.stringify(ytMap)) }catch{}
    if(props.apiUrl && props.getToken){
      try{
        const token = await props.getToken();
        if(token){
          const updateMut = `mutation UpdateTournamentMaster($input: UpdateTournamentMasterInput!){ updateTournamentMaster(input:$input){ name } }`
          const createMut = `mutation CreateTournamentMaster($input: CreateTournamentMasterInput!){ createTournamentMaster(input:$input){ name } }`
          for(const name of tournamentNames){
            const input: any = { name, youtubePlaylist: ytMap[name] || null }
            try{ await fetch(props.apiUrl, { method:'POST', headers:{ 'Content-Type':'application/json','Authorization': token }, body: JSON.stringify({ query: updateMut, variables: { input } }) }) }catch{}
            try{ await fetch(props.apiUrl, { method:'POST', headers:{ 'Content-Type':'application/json','Authorization': token }, body: JSON.stringify({ query: createMut, variables: { input } }) }) }catch{}
          }
        }
      }catch{}
    }
    setYtOpen(false)
  }

  // Fetch PlayerNote counts for matches involving selected team
  useEffect(()=>{
    (async()=>{
      setNoteCountByMatch({}); setNoteCountByOpponent({})
      if(!props.apiUrl || !props.getToken || !teamId) return
      const filtered = matches.filter(m=>{
        if(from && m.heldOn < from) return false
        if(to && m.heldOn > to) return false
        if(officialFilter==='intra' && (!homeUniversityId || m.ourUniversityId!==homeUniversityId || m.opponentUniversityId!==homeUniversityId)) return false
        if(tournamentFilter && m.tournament && !m.tournament.toLowerCase().includes(tournamentFilter.toLowerCase())) return false
        if(tournamentFilter && !m.tournament) return false
        return (m.ourUniversityId===teamId || m.opponentUniversityId===teamId)
      })
      try{
        const token = await props.getToken(); if(!token) return
        const byMatch: Record<string,number> = {}
        for(const m of filtered){
          const q = `query ListPlayerNotesByMatch($matchId: ID!, $limit:Int){ listPlayerNotesByMatch(matchId:$matchId, limit:$limit){ items{ playerId } } }`
          try{
            const res: Response = await fetch(props.apiUrl, { method:'POST', headers:{ 'Content-Type':'application/json','Authorization': token }, body: JSON.stringify({ query: q, variables: { matchId: m.id, limit: 500 } }) })
            const j:any = await res.json(); const cnt = (j?.data?.listPlayerNotesByMatch?.items||[]).length||0
            byMatch[m.id] = cnt
          }catch{}
        }
        setNoteCountByMatch(byMatch)
        const byOpp: Record<string,number> = {}
        for(const m of filtered){
          const opp = m.ourUniversityId===teamId ? (m.opponentUniversityId||'') : (m.ourUniversityId||'')
          if(!opp) continue
          byOpp[opp] = (byOpp[opp]||0) + (byMatch[m.id]||0)
        }
        setNoteCountByOpponent(byOpp)
      }catch{}
    })()
  }, [matches, teamId, from, to, tournamentFilter, officialFilter, homeUniversityId, props.apiUrl, props.getToken])

  function buildTechniqueKey(target?:string, methods?:string[]){ const mm = (methods||[]).slice().sort(); return `${target||''}:${mm.join('+')}` }
  function labelTarget(code:string){ return labelJa.target[code] ?? code }
  function labelMethod(code:string){ return code==='HANSOKU' ? (t('winType.HANSOKU')||'HANSOKU') : (labelJa.method[code] ?? code) }
  function labelTechniqueCombined(key:string){ if(key==='HANSOKU') return (t('winType.HANSOKU')||'HANSOKU'); const [target, mstr] = key.split(':'); const ml = (mstr? mstr.split('+') : []).map(labelMethod); const base = ml.join(''); return `${base}${labelTarget(target)}` }

  const stat = useMemo(()=>{
    if(!teamId) return null
    const filtered = matches.filter(m=>{
      if(from && m.heldOn < from) return false
      if(to && m.heldOn > to) return false
      if(officialFilter==='official' && (m.isOfficial === false)) return false
      if(officialFilter==='practice' && (m.isOfficial !== false)) return false
      if(officialFilter==='intra' && (!homeUniversityId || m.ourUniversityId!==homeUniversityId || m.opponentUniversityId!==homeUniversityId)) return false
      if(tournamentFilter && m.tournament && !m.tournament.toLowerCase().includes(tournamentFilter.toLowerCase())) return false
      if(tournamentFilter && !m.tournament) return false
      const involved = m.ourUniversityId===teamId || m.opponentUniversityId===teamId
      return involved
    })

    const combinedFor: Record<string, number> = {}
    const combinedAgainst: Record<string, number> = {}
    const stanceKey = (s?:string|null)=> s==='JODAN' ? 'JODAN' : ((s||'').startsWith('NITOU') ? 'NITOU' : '')
    const vsStance: Record<string, { bouts:number; wins:number; losses:number; draws:number }> = { JODAN:{bouts:0,wins:0,losses:0,draws:0}, NITOU:{bouts:0,wins:0,losses:0,draws:0} }
    const vsTeam: Record<string, { bouts:number; wins:number; losses:number; draws:number; pf:number; pa:number }> = {}
    let wins=0, losses=0, draws=0, bouts=0, pf=0, pa=0

    for(const m of filtered){
      const teamIsLeft = m.ourUniversityId===teamId
      const teamIsRight = m.opponentUniversityId===teamId
      for(const b of (m.bouts?.items ?? [])){
        const myPlayerId = teamIsLeft ? b.ourPlayerId : b.opponentPlayerId
        const oppPlayerId = teamIsLeft ? b.opponentPlayerId : b.ourPlayerId
        const oppTeamId = teamIsLeft ? (m.opponentUniversityId||'') : (m.ourUniversityId||'')
        const opp = (vsTeam[oppTeamId] ||= { bouts:0, wins:0, losses:0, draws:0, pf:0, pa:0 });
        opp.bouts++; bouts++
        if(b.winType==='DRAW'){ draws++; opp.draws++; const sk = stanceKey(teamIsLeft ? (b as any).opponentStance : (b as any).ourStance); if(sk){ vsStance[sk].bouts++; vsStance[sk].draws++ } }
        else if(b.winnerPlayerId){ const sk = stanceKey(teamIsLeft ? (b as any).opponentStance : (b as any).ourStance); if(sk){ vsStance[sk].bouts++ }
          if(b.winnerPlayerId===myPlayerId){ wins++; opp.wins++; if(sk) vsStance[sk].wins++ } else if(b.winnerPlayerId===oppPlayerId){ losses++; opp.losses++; if(sk) vsStance[sk].losses++ } }
        for(const p of (b.points?.items ?? [])){
          if(p.scorerPlayerId===myPlayerId){ pf++; opp.pf++; if(p.judgement==='HANSOKU'){ combinedFor['HANSOKU']=(combinedFor['HANSOKU']||0)+1; } else { const key=buildTechniqueKey(p.target||'', p.methods||[]); combinedFor[key]=(combinedFor[key]||0)+1 } }
          else if(p.scorerPlayerId===oppPlayerId){ pa++; opp.pa++; if(p.judgement==='HANSOKU'){ combinedAgainst['HANSOKU']=(combinedAgainst['HANSOKU']||0)+1 } else { const key=buildTechniqueKey(p.target||'', p.methods||[]); combinedAgainst[key]=(combinedAgainst[key]||0)+1 } }
        }
      }
    }

    const diff = pf - pa
    const topCombinedFor = Object.entries(combinedFor).sort((a,b)=> b[1]-a[1]).slice(0, TOP_N)
    const topCombinedAgainst = Object.entries(combinedAgainst).sort((a,b)=> b[1]-a[1]).slice(0, TOP_N)
    const vsTop = Object.entries(vsTeam).sort((a,b)=> b[1].bouts - a[1].bouts).slice(0,8)
    const vsHentou = (()=>{ const j=vsStance.JODAN, n=vsStance.NITOU; const b=j.bouts+n.bouts, w=j.wins+n.wins, l=j.losses+n.losses, d=j.draws+n.draws; return { bouts:b, wins:w, losses:l, draws:d, winRate: b? (w/b): 0 } })()
    return { wins, losses, draws, bouts, pf, pa, diff, topCombinedFor, topCombinedAgainst, vsTop, vsStance, vsHentou }
  }, [matches, teamId, from, to, tournamentFilter, officialFilter, homeUniversityId])

  // Match-level W/L/D and tournament rankings
  const matchStats = useMemo(()=>{
    if(!teamId) return null
    const rows: { id:string; tournament:string; teamWins:number; oppWins:number; draws:number; result:'W'|'L'|'D' }[] = []
    for(const m of matches){
      if(from && m.heldOn < from) continue
      if(to && m.heldOn > to) continue
      if(officialFilter==='official' && (m.isOfficial === false)) continue
      if(officialFilter==='practice' && (m.isOfficial !== false)) continue
      if(officialFilter==='intra' && (!homeUniversityId || m.ourUniversityId!==homeUniversityId || m.opponentUniversityId!==homeUniversityId)) continue
      const involved = m.ourUniversityId===teamId || m.opponentUniversityId===teamId
      if(!involved) continue
      if(tournamentFilter){
        const tn = (m.tournament||'').toLowerCase(); if(!tn.includes(tournamentFilter.toLowerCase())) continue
      }
      const teamIsLeft = m.ourUniversityId===teamId
      let teamWins=0, oppWins=0, draws=0
      for(const b of (m.bouts?.items ?? [])){
        if(b.winType==='DRAW'){ draws++; continue }
        if(b.winnerPlayerId){
          const myWinner = teamIsLeft ? b.ourPlayerId : b.opponentPlayerId
          if(b.winnerPlayerId===myWinner) teamWins++; else oppWins++
        }
      }
      const result: 'W'|'L'|'D' = (teamWins>oppWins ? 'W' : (teamWins<oppWins ? 'L' : 'D'))
      rows.push({ id: m.id, tournament: m.tournament||'-', teamWins, oppWins, draws, result })
    }
    const totals = rows.reduce((a,r)=>{ a.matches++; if(r.result==='W') a.wins++; else if(r.result==='L') a.losses++; else a.draws++; return a }, { matches:0, wins:0, losses:0, draws:0 })
    const byTournament: Record<string, { matches:number; wins:number; losses:number; draws:number }>= {}
    for(const r of rows){ const t = (byTournament[r.tournament] ||= { matches:0,wins:0,losses:0,draws:0 }); t.matches++; if(r.result==='W') t.wins++; else if(r.result==='L') t.losses++; else t.draws++ }
    const ranking = Object.entries(byTournament).map(([name,v])=> ({ name, ...v, winRate: v.matches? v.wins/v.matches : 0 }))
      .sort((a,b)=> (b.winRate - a.winRate) || (b.wins - a.wins) || (b.matches - a.matches))
    return { rows, totals, ranking }
  }, [matches, teamId, from, to, tournamentFilter, officialFilter, homeUniversityId])

  // Player contribution breakdown within team context
  const playerContrib = useMemo(()=>{
    if(!teamId) return [] as { playerId:string; name:string; pf:number; pa:number }[]
    const map: Record<string, { pf:number; pa:number }> = {}
    for(const m of matches){
      if(m.ourUniversityId!==teamId && m.opponentUniversityId!==teamId) continue
      const teamIsLeft = m.ourUniversityId===teamId
      for(const b of (m.bouts?.items ?? [])){
        const myId = teamIsLeft ? b.ourPlayerId : b.opponentPlayerId
        const oppId = teamIsLeft ? b.opponentPlayerId : b.ourPlayerId
        const me = (map[myId] ||= { pf:0, pa:0 })
        const opp = (map[oppId] ||= { pf:0, pa:0 })
        for(const p of (b.points?.items ?? [])){
          if(p.scorerPlayerId===myId) me.pf++
          else if(p.scorerPlayerId===oppId) me.pa++
        }
      }
    }
    return Object.entries(map).map(([playerId, v])=> ({ playerId, name: (players && players[playerId]) || playerId, pf: v.pf, pa: v.pa }))
      .sort((a,b)=> (b.pf - a.pf) || (a.pa - b.pa))
  }, [matches, teamId])

  // Export helpers
    function downloadCSV(filename:string, rows: (string|number)[][]){
    const csv = rows
      .map(r => r
        .map(x => {
          const s = String(x)
          return (s.includes(',') || s.includes('"') || s.includes('\r\n')) ? '"'+s.replace(/"/g,'""')+'"' : s
        })
        .join(',')
      )
      .join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url)
  }function exportPlayers(){
    const header = [t('dashboard.player')||'Player', t('dashboard.pointsFor')||'PF', t('dashboard.pointsAgainst')||'PA']
    const rows = playerContrib.map(p=> [p.name, p.pf, p.pa])
    downloadCSV('team_players.csv', [header, ...rows])
  }
  function exportVsTeams(){
    const header = [t('dashboard.opponent')||'Opponent', t('dashboard.bouts')||'Bouts', t('dashboard.wins')||'Wins', t('dashboard.losses')||'Losses', t('dashboard.draws')||'Draws', t('dashboard.pointsFor')||'PF', t('dashboard.pointsAgainst')||'PA']
    const rows = (stat?.vsTop||[]).map(([oppId, v]: any)=> [universities[oppId]||oppId, v.bouts, v.wins, v.losses, v.draws, v.pf, v.pa])
    downloadCSV('team_vs_teams.csv', [header, ...rows])
  }
  function exportTournaments(){
    const header = [t('dashboard.tournament')||'Tournament', t('dashboard.matches')||'Matches', t('dashboard.wins')||'Wins', t('dashboard.losses')||'Losses', t('dashboard.draws')||'Draws', t('dashboard.winRate')||'Win%']
    const rows = (matchStats?.ranking||[]).map(r=> [r.name, r.matches, r.wins, r.losses, r.draws, (r.winRate*100).toFixed(1)])
    downloadCSV('team_tournaments.csv', [header, ...rows])
  }

  function Pie({items, size=140}:{ items: [string, number][], size?:number }){
    const total = items.reduce((s, [,v])=> s+v, 0)
    if(total<=0) return <div>-</div>
    const r = size/2, cx=r, cy=r
    const palette = ['#4e79a7','#f28e2b','#e15759','#76b7b2','#59a14f','#edc948','#b07aa1','#ff9da7','#9c755f','#bab0ab']
    const nonZeroIdx = items.findIndex(([,v])=> v>0)
    if(items.filter(([,v])=> v>0).length===1 && nonZeroIdx>=0){
      const color = palette[nonZeroIdx % palette.length]
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
      return (<path key={i} d={d} fill={palette[i%palette.length]} stroke="#fff" strokeWidth={1} />)
    })
    return (<svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>{paths}</svg>)
  }

  return (
    <View className="min-w-0">
      <Heading level={4}>{t('dashboard.teamTitle') || 'Team Dashboard'}</Heading>
      <View marginTop="0.5rem">
        <Flex gap="0.75rem" wrap="wrap" alignItems="flex-end">
          <SelectField label={t('dashboard.selectTeam') || 'Team'} value={teamId} onChange={e=> setTeamId(e.target.value)} size="small" width="18rem">
            <option value="">--</option>
            {teamList.map(([id,name])=> (<option key={id} value={id}>{name}</option>))}
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
          {/* Top N selector removed for simplicity */}
          <Button onClick={()=> { setFrom(''); setTo(''); setTournamentFilter(''); setOfficialFilter('all') }}>{t('dashboard.clear')}</Button>
          <div className="no-print" style={{ display:'flex', gap:8 }}>
            <Button onClick={exportPlayers}>{t('export.players')||'選手一覧を出力 (CSV)'}</Button>
            <Button onClick={exportVsTeams}>{t('export.vsTeams')||'対戦校別を出力 (CSV)'}</Button>
            <Button onClick={exportTournaments}>{t('export.tournaments')||'大会別を出力 (CSV)'}</Button>
            <Button variation="link" onClick={()=> window.print()}>{t('export.print')||'印刷'}</Button>
            <Button onClick={()=> setYtOpen(true)}>{t('youtube.edit')||'YouTube再生リスト設定'}</Button>
          </div>
        </Flex>
      </View>

      {!teamId && (
        <View marginTop="0.75rem" color="#666">{t('dashboard.noData')}</View>
      )}

      {teamId && stat && (
        <View marginTop="0.75rem" style={{display:'grid', gridTemplateColumns:'repeat(2,minmax(0,1fr))', gap:12, minWidth:0}}>
          <View style={{gridColumn:'1 / -1', border:'1px solid #eee', borderRadius:8, padding:10, overflow:'hidden'}}>
            <Heading level={6}>{t('dashboard.stats')}</Heading>
            <div>{t('dashboard.bouts')}: <b>{stat.bouts}</b></div>
            <div>{t('dashboard.wins')}: <b>{stat.wins}</b> / {t('dashboard.losses')}: <b>{stat.losses}</b> / {t('dashboard.draws')}: <b>{stat.draws}</b></div>
            <div>{t('dashboard.pointsFor')}: <b>{stat.pf}</b> / {t('dashboard.pointsAgainst')}: <b>{stat.pa}</b> / {t('dashboard.diff')}: <b>{stat.diff>0?'+':''}{stat.diff}</b></div>
            <div>{t('dashboard.vsHentou')||'対変刀'}: <b>{(((stat as any).vsHentou?.winRate||0)*100).toFixed(1)}%</b> <span className="muted">({(stat as any).vsHentou?.wins||0}-{(stat as any).vsHentou?.losses||0}-{(stat as any).vsHentou?.draws||0} / {(stat as any).vsHentou?.bouts||0})</span></div>
          </View>

          <View style={{border:'1px solid #eee', borderRadius:8, padding:10, overflow:'hidden'}}>
            <Heading level={6}>{t('dashboard.pieFor')}</Heading>
            <div className="graph"><Pie items={(stat.topCombinedFor as any).map(([k,v]:[string,number])=> [labelTechniqueCombined(k), v])} /></div>
          </View>

          <View style={{border:'1px solid #eee', borderRadius:8, padding:10, overflow:'hidden'}}>
            <Heading level={6}>{t('dashboard.pieAgainst')}</Heading>
            <div className="graph"><Pie items={(stat.topCombinedAgainst as any).map(([k,v]:[string,number])=> [labelTechniqueCombined(k), v])} /></div>
          </View>

          {/* 対変刀は統計カードに集約するため、このセクションは削除 */}

          <View style={{gridColumn:'1 / -1', border:'1px solid #eee', borderRadius:8, padding:10, overflow:'hidden'}}>
            <Heading level={6}>{t('dashboard.vsOpponents') || 'Vs Teams'}</Heading>
            <View className="table-wrap">
            <Table variation="bordered" highlightOnHover>
              <TableHead>
                <TableRow>
                  <TableCell as="th">{t('dashboard.opponent') || 'Opponent'}</TableCell>
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
                {(stat.vsTop as any).map(([oppId, v]:[string, any])=> (
                  <TableRow key={oppId}>
                    <TableCell>{universities[oppId] || oppId || '-'}</TableCell>
                    <TableCell>{v.bouts}</TableCell>
                    <TableCell>{v.wins}</TableCell>
                    <TableCell>{v.losses}</TableCell>
                    <TableCell>{v.draws}</TableCell>
                    <TableCell>{v.pf}</TableCell>
                    <TableCell>{v.pa}</TableCell>
                    <TableCell>{(noteCountByOpponent[oppId]||0)>0 ? `💬 ${(noteCountByOpponent[oppId]||0)}` : ''}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </View>
          </View>

          {/* Match-level W/L/D and tournament ranking */}
          <View style={{gridColumn:'1 / -1', border:'1px solid #eee', borderRadius:8, padding:10, overflow:'hidden'}}>
            <Heading level={6}>{t('dashboard.matchSummary') || '試合結果'}</Heading>
            <View className="table-wrap">
            <Table variation="bordered" highlightOnHover>
              <TableHead>
                <TableRow>
                  <TableCell as="th">{t('dashboard.tournament')||'大会'}</TableCell>
                  <TableCell as="th">{t('dashboard.teamWins')||'チーム勝ち'}</TableCell>
                  <TableCell as="th">{t('dashboard.oppWins')||'相手勝ち'}</TableCell>
                  <TableCell as="th">{t('dashboard.draws')||'引分'}</TableCell>
                  <TableCell as="th">{i18n.language?.startsWith('ja') ? '結果' : 'Result'}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(matchStats?.rows||[]).map(r=> (
                  <TableRow key={r.id}>
                    <TableCell>
                      {r.tournament}
                      {r.tournament && ytMap[r.tournament] && (
                        <a href={ytMap[r.tournament]} target="_blank" rel="noopener noreferrer" style={{ marginLeft:8, fontSize:12 }}>▶</a>
                      )}
                    </TableCell>

                    <TableCell>{r.teamWins}</TableCell>
                    <TableCell>{r.oppWins}</TableCell>
                    <TableCell>{r.draws}</TableCell>
                    <TableCell>{r.result}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </View>
          </View>

          <View style={{gridColumn:'1 / -1', border:'1px solid #eee', borderRadius:8, padding:10, overflow:'hidden'}}>
            <Heading level={6}>{t('dashboard.tournamentRanking') || '大会ランキング'}</Heading>
            <View className="table-wrap">
            <Table variation="bordered" highlightOnHover>
              <TableHead>
                <TableRow>
                  <TableCell as="th">#</TableCell>
                  <TableCell as="th">{t('dashboard.tournament')||'大会'}</TableCell>
                  <TableCell as="th">{t('dashboard.matches')||'試合数'}</TableCell>
                  <TableCell as="th">{t('dashboard.wins')||'勝'}</TableCell>
                  <TableCell as="th">{t('dashboard.losses')||'敗'}</TableCell>
                  <TableCell as="th">{t('dashboard.draws')||'分'}</TableCell>
                  <TableCell as="th">{t('dashboard.winRate')||'勝率'}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(matchStats?.ranking||[]).map((r, i)=> (
                  <TableRow key={r.name+String(i)}>
                    <TableCell>{i+1}</TableCell>
                    <TableCell>
                      {r.name}
                      {r.name && ytMap[r.name] && (
                        <a href={ytMap[r.name]} target="_blank" rel="noopener noreferrer" style={{ marginLeft:8, fontSize:12 }}>▶</a>
                      )}
                    </TableCell>
                    <TableCell>{r.matches}</TableCell>
                    <TableCell>{r.wins}</TableCell>
                    <TableCell>{r.losses}</TableCell>
                    <TableCell>{r.draws}</TableCell>
                    <TableCell>{(r.winRate*100).toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </View>
          </View>

          {/* Player contribution list */}
          <View style={{gridColumn:'1 / -1', border:'1px solid #eee', borderRadius:8, padding:10, overflow:'hidden'}}>
            <Heading level={6}>{t('dashboard.playerContribution')||'選手貢献'}</Heading>
            <View className="table-wrap">
            <Table variation="bordered" highlightOnHover>
              <TableHead>
                <TableRow>
                  <TableCell as="th">{t('dashboard.player')||'選手'}</TableCell>
                  <TableCell as="th">{t('dashboard.pointsFor')||'PF'}</TableCell>
                  <TableCell as="th">{t('dashboard.pointsAgainst')||'PA'}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {playerContrib.map(p=> (
                  <TableRow key={p.playerId}>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>{p.pf}</TableCell>
                    <TableCell>{p.pa}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </View>
          </View>
        </View>
      )}
      {/* Print styles */}
      <style>{`@media print { .no-print { display: none !important; } .app-sidebar { display:none !important } .app-main { padding: 0 !important } }`}</style>
      {ytOpen && (
        <div className="no-print" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1200 }} onClick={()=> setYtOpen(false)}>
          <div style={{ background:'#fff', minWidth:360, maxWidth:780, width:'90%', padding:16, borderRadius:8 }} onClick={e=> e.stopPropagation()}>
            <Heading level={5}>{t('youtube.title')||'大会ごとのYouTube再生リスト'}</Heading>
            <div style={{ fontSize:12, color:'#555', marginTop:4 }}>{t('youtube.help')||'URLまたはプレイリストID（list=...）を入力してください。空にすると未設定になります。'}</div>
            <div style={{ display:'grid', gap:8, marginTop:12, maxHeight: '50vh', overflow:'auto' }}>
              {tournamentNames.length===0 ? (
                <div className="muted">{t('youtube.noTournaments')||'大会名がありません'}</div>
              ) : tournamentNames.map(name=> (
                <div key={name} style={{ display:'grid', gridTemplateColumns:'180px 1fr', gap:8, alignItems:'center' }}>
                  <div style={{ fontSize:13 }}>{name}</div>
                  <input value={ytMap[name]||''} onChange={e=> setYtMap(m=> ({...m, [name]: canonicalPlaylistUrl(e.target.value)}))} placeholder="https://www.youtube.com/playlist?list=..." style={{ width:'100%', padding:'6px 8px', fontSize:13 }} />
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:12 }}>
              <Button variation="link" onClick={()=> setYtOpen(false)}>{t('action.cancel')||'キャンセル'}</Button>
              <Button variation="primary" onClick={saveYt}>{t('actions.save')||'保存'}</Button>
            </div>
          </div>
        </div>
      )}
    </View>
  )
}
















