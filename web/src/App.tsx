import { useEffect, useMemo, useState } from 'react'
import '@aws-amplify/ui-react/styles.css'
import { Amplify } from 'aws-amplify'
import { Authenticator, View, Heading, Button, Table, TableHead, TableRow, TableCell, TableBody, Badge, Flex, SelectField, TextField, RadioGroupField, Radio, CheckboxField, Alert } from '@aws-amplify/ui-react'
import { useTranslation } from 'react-i18next'
// Removed QuickInputPanel and SheetInput (tabs deprecated)
// import QuickInputPanel from './components/QuickInputPanel'
// import SheetInput from './components/SheetInput'
import NewEntryMode from './components/NewEntryMode'
import PlayersAdmin from './components/PlayersAdmin'
import UniversitiesAdmin from './components/UniversitiesAdmin'
import Dashboard from './components/Dashboard'
import TeamDashboard from './components/TeamDashboard'

import outputs from '../../amplify_outputs.json'

Amplify.configure(outputs)

type Match = { id: string; heldOn: string; tournament?: string; isOfficial?: boolean; ourUniversityId?: string; opponentUniversityId?: string; bouts?: { items: Bout[] } }
type Bout = { id: string; ourPlayerId: string; opponentPlayerId: string; ourPosition?: string; ourStance?: string; opponentStance?: string; winType?: string | null; winnerPlayerId?: string | null; points?: { items: Point[] } }
type Point = { id?: string; tSec: number; target?: string | null; methods?: string[] | null; scorerPlayerId?: string | null; judgement?: string | null }

const listMatchesPage = `query ListMatches($limit:Int,$nextToken:String){ listMatches(limit:$limit,nextToken:$nextToken){ items{ id heldOn tournament isOfficial ourUniversityId opponentUniversityId bouts{ items{ id ourPlayerId opponentPlayerId ourPosition ourStance opponentStance winType winnerPlayerId points{ items{ id tSec target methods scorerPlayerId judgement } } } } } nextToken } }`
const listUniversitiesHome = `query ListUniversities($limit:Int,$nextToken:String){ listUniversities(limit:$limit,nextToken:$nextToken){ items{ id isHome } nextToken } }`
const listUniversitiesNames = `query ListUniversities($limit:Int,$nextToken:String){ listUniversities(limit:$limit,nextToken:$nextToken){ items{ id name shortName isHome } nextToken } }`
const listMastersQuery = `query Masters { listTargetMasters { items { code nameJa nameEn } } listMethodMasters { items { code nameJa nameEn } } listPositionMasters { items { code nameJa nameEn } } }`
const listPlayersPage = `query ListPlayers($limit:Int,$nextToken:String){ listPlayers(limit:$limit,nextToken:$nextToken){ items{ id name } nextToken } }`
const createPointMutation = `mutation CreatePoint($input: CreatePointInput!) { createPoint(input:$input) { id } }`
const deletePointMutation = `mutation DeletePoint($input: DeletePointInput!) { deletePoint(input:$input) { id } }`
const deleteBoutMutation = `mutation DeleteBout($input: DeleteBoutInput!) { deleteBout(input:$input) { id } }`
const deleteMatchMutation = `mutation DeleteMatch($input: DeleteMatchInput!) { deleteMatch(input:$input) { id } }`

export default function App() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [matches, setMatches] = useState<Match[]>([])
  const [error, setError] = useState<string | null>(null)
  const [masters, setMasters] = useState<any>({ targets: [], methods: [], positions: [] })
  const [players, setPlayers] = useState<Record<string,string>>({})
  const [labelJa, setLabelJa] = useState<{ target: Record<string,string>, method: Record<string,string>, position: Record<string,string> }>({ target: {}, method: {}, position: {} })
  const [selectedMatchId, setSelectedMatchId] = useState('')
  const [selectedBoutId, setSelectedBoutId] = useState('')
  const [tab, setTab] = useState<'new'|'players'|'universities'|'dashboard'>('new')
  const [officialFilter, setOfficialFilter] = useState<'all'|'official'|'practice'|'intra'>('all')
  const [homeUniversityId, setHomeUniversityId] = useState<string>('')
  const [universities, setUniversities] = useState<Record<string,string>>({})
  const [dashMode, setDashMode] = useState<'personal'|'team'>('personal')
  const [form, setForm] = useState({ tSec: 60, target: '', methods: [] as string[], scorer: 'our' as 'our' | 'opponent', judgement: 'REGULAR', isDecisive: false, sequenceLen: 1, sequenceTargets: [] as string[], isMutual: false })
  const [techModal, setTechModal] = useState<{ open: boolean, side: 'left'|'right'|null, target: string, methods: string[] }>({ open: false, side: null, target: '', methods: [] })
  const [fouls, setFouls] = useState<Record<string, number>>({})
  const [showLegacy, setShowLegacy] = useState(false)

  const apiUrl = (outputs as any).data.url as string

  // Persist official/practice/intra filter in localStorage
  useEffect(()=>{
    try{
      const saved = localStorage.getItem('filters:type')
      if(saved==="official"||saved==="practice"||saved==="all"||saved==="intra"){ setOfficialFilter(saved as any) }
    }catch{}
  },[])
  useEffect(()=>{ try{ localStorage.setItem('filters:type', officialFilter) }catch{} }, [officialFilter])

  async function fetchHomeUniversity(){
    try{
      const token = await getToken(); if(!token) return
      let nextToken: string | null = null; const acc: {id:string,isHome?:boolean}[] = []
      do{
        const res: Response = await fetch(apiUrl, { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization': token }, body: JSON.stringify({ query: listUniversitiesHome, variables: { limit: 200, nextToken } }) })
        const json: any = await res.json(); if(json.errors) throw new Error(JSON.stringify(json.errors))
        acc.push(...json.data.listUniversities.items)
        nextToken = json.data.listUniversities.nextToken
      } while(nextToken)
      const home = acc.find(u=> u.isHome)
      setHomeUniversityId(home?.id || '')
    }catch{}
  }

  const visibleMatches = useMemo(()=>{
    if(officialFilter==='official') return matches.filter((m:any)=> m.isOfficial !== false)
    if(officialFilter==='practice') return matches.filter((m:any)=> m.isOfficial === false)
    if(officialFilter==='intra') return matches.filter((m:any)=> homeUniversityId && m.ourUniversityId===homeUniversityId && m.opponentUniversityId===homeUniversityId)
    return matches
  }, [matches, officialFilter, homeUniversityId])

  // One-time local reset so user starts fresh (no button needed)
  useEffect(()=>{
    try{
      const KEY = 'app:reset-once:20250924-1'
      if(!localStorage.getItem(KEY)){
        ;['ui:dense','rules:encho','rules:hantei','rules:autoResult','i18nextLng'].forEach(k=> localStorage.removeItem(k))
        localStorage.setItem(KEY,'1')
        if(typeof window!=='undefined') window.location.reload()
      }
    }catch{}
  },[])

  useEffect(()=>{ fetchHomeUniversity() },[])

  // Build universities id->name map for Team Dashboard
  useEffect(()=>{
    async function run(){
      try{
        const token = await getToken(); if(!token) return
        let nextToken: string | null = null
        const map: Record<string,string> = {}
        do{
          const r: Response = await fetch(apiUrl, { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization': token }, body: JSON.stringify({ query: listUniversitiesNames, variables: { limit: 200, nextToken } }) })
          const j: any = await r.json(); if(j.errors) throw new Error(JSON.stringify(j.errors))
          for(const u of j.data.listUniversities.items){ map[u.id] = (u.shortName||u.name||u.id) }
          nextToken = j.data.listUniversities.nextToken
        } while(nextToken)
        setUniversities(map)
      }catch{}
    }
    run()
  },[])


  function winTypeLabel(type?: string | null){
    if(!type) return '-'
    switch(type){
      case 'IPPON': return t('winType.IPPON')
      case 'NIHON': return t('winType.NIHON')
      case 'HANSOKU': return t('winType.HANSOKU')
      case 'ENCHO': return t('winType.ENCHO')
      case 'HANTEI': return t('winType.HANTEI')
      case 'DRAW': return t('winType.DRAW')
      default: return type
    }
  }

  function boutResultText(b: Bout){
    if(b.winType === 'DRAW') return t('result.draw')
    if(b.winnerPlayerId){
      const wl = b.winnerPlayerId === b.ourPlayerId ? t('result.win') : t('result.loss')
      const wt = winTypeLabel(b.winType)
      return `${wl} (${wt})`
    }
    return winTypeLabel(b.winType)
  }

  async function getToken() {
    try { return (await (await import('aws-amplify/auth')).fetchAuthSession()).tokens?.idToken?.toString() ?? null } catch { return null }
  }

  async function fetchMatches() {
    setLoading(true); setError(null)
    try {
      const token = await getToken(); if (!token) return
      let nextToken: string | null = null
      const acc: any[] = []
      do {
        const res: Response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': token }, body: JSON.stringify({ query: listMatchesPage, variables: { limit: 200, nextToken } }) })
        const json: any = await res.json(); if (json.errors) throw new Error(JSON.stringify(json.errors))
        acc.push(...json.data.listMatches.items)
        nextToken = json.data.listMatches.nextToken
      } while(nextToken)
      setMatches(acc)
    } catch (e: any) { setError(String(e?.message ?? e)) } finally { setLoading(false) }
  }

  async function fetchMasters() {
    setError(null)
    try {
      const token = await getToken(); if (!token) return
      const res: Response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': token }, body: JSON.stringify({ query: listMastersQuery }) })
      const json: any = await res.json(); if (json.errors) throw new Error(JSON.stringify(json.errors))
      const tItems = json.data.listTargetMasters.items
      let mItems = json.data.listMethodMasters.items
      // Append client-side extra method modifiers if missing
      const extraMethods = [
        { code: 'GYAKU', nameJa: '逆', nameEn: 'Gyaku' },
        { code: 'HIDARI', nameJa: '左', nameEn: 'Left' },
        { code: 'TOBIKOMI', nameJa: '飛び込み', nameEn: 'Tobikomi' },
        { code: 'AIKOTE', nameJa: '相小手', nameEn: 'Aikote' },
      ]
      for(const ex of extraMethods){ if(!mItems.some((m:any)=> m.code===ex.code)) mItems = [...mItems, ex] }
      const pItems = json.data.listPositionMasters.items
      setMasters({ targets: tItems, methods: mItems, positions: pItems })
      const tMap: Record<string,string> = {}; for(const t of tItems) tMap[t.code]=t.nameJa
      const mMap: Record<string,string> = {}; for(const m of mItems) mMap[m.code]=m.nameJa ?? m.nameEn ?? m.code
      const pMap: Record<string,string> = {}; for(const p of pItems) pMap[p.code]=p.nameJa
      setLabelJa({ target: tMap, method: mMap, position: pMap })
      // players
      let nextToken: string | null = null
      const map: Record<string,string> = {}
      do {
        const r: Response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': token }, body: JSON.stringify({ query: listPlayersPage, variables: { limit: 200, nextToken } }) })
        const j: any = await r.json(); if (j.errors) throw new Error(JSON.stringify(j.errors))
        for (const p of j.data.listPlayers.items) map[p.id] = p.name
        nextToken = j.data.listPlayers.nextToken
      } while(nextToken)
      setPlayers(map)
    } catch (e: any) { setError(String(e?.message ?? e)) }
  }

  useEffect(() => { fetchMatches(); fetchMasters() }, [])

  const selectedMatch = useMemo(() => matches.find(m => m.id === selectedMatchId), [matches, selectedMatchId])
  const selectedBout = useMemo(() => (selectedMatch?.bouts?.items ?? []).find(b => b.id === selectedBoutId), [selectedMatch, selectedBoutId])

  function techniqueKey(target: string, methods: string[]) { return `${target}:${[...methods].sort().join('+')}` }

  function methodFirstLabel(targetCode?: string | null, methods?: string[] | null) {
    if (!targetCode) return '-'
    const tlabel = labelJa.target[targetCode] ?? targetCode
    const mm = methods ?? []
    if (mm.length === 0) return tlabel
    return mm.map(m => `${labelJa.method[m] ?? m}${tlabel}`).join(' / ')
  }

  async function createPointDirect(args:{ scorer: 'our'|'opponent', target: string, methods: string[] }){
    if (!selectedBout) { setError(t('placeholder.select')); return }
    setLoading(true); setError(null)
    try{
      const token = await getToken(); if (!token) throw new Error('No ID token')
      const scorerPlayerId = args.scorer === 'our' ? selectedBout.ourPlayerId : selectedBout.opponentPlayerId
      const opponentPlayerId = args.scorer === 'our' ? selectedBout.opponentPlayerId : selectedBout.ourPlayerId
      const input: any = { boutId: selectedBout.id, tSec: Number(form.tSec)||0, scorerPlayerId, opponentPlayerId, target: args.target, methods: args.methods, position: selectedBout.ourPosition ?? null, scorerStance: args.scorer === 'our' ? (selectedBout.ourStance ?? null) : (selectedBout.opponentStance ?? null), opponentStance: args.scorer === 'our' ? (selectedBout.opponentStance ?? null) : (selectedBout.ourStance ?? null), judgement: 'REGULAR', isDecisive: false, techniqueKey: techniqueKey(args.target, args.methods), recordedAt: new Date().toISOString(), version: 1 }
      const res: Response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': token }, body: JSON.stringify({ query: createPointMutation, variables: { input } }) })
      const json: any = await res.json(); if (json.errors) throw new Error(JSON.stringify(json.errors))
      await fetchMatches()
    } catch(e:any){ setError(String(e?.message ?? e)) } finally { setLoading(false) }
  }

  async function createPointSmart(){
    if (!selectedBout) { setError(t('placeholder.select')); return }
    const tSec = Number(form.tSec); if (!Number.isFinite(tSec) || tSec < 0) { setError(t('field.timeSec')); return }
    const isFoul = form.judgement === 'HANSOKU'
    if (!isFoul) {
      if (!form.target) { setError(t('field.target')); return }
      if (form.methods.length === 0) { setError(t('field.method')); return }
    }
    setLoading(true); setError(null)
    try{
      const token = await getToken(); if (!token) throw new Error('No ID token')
      const scorerPlayerId = form.scorer === 'our' ? selectedBout.ourPlayerId : selectedBout.opponentPlayerId
      const opponentPlayerId = form.scorer === 'our' ? selectedBout.opponentPlayerId : selectedBout.ourPlayerId
      const base: any = { boutId: selectedBout.id, tSec, scorerPlayerId, opponentPlayerId, position: selectedBout.ourPosition ?? null, scorerStance: form.scorer === 'our' ? (selectedBout.ourStance ?? null) : (selectedBout.opponentStance ?? null), opponentStance: form.scorer === 'our' ? (selectedBout.opponentStance ?? null) : (selectedBout.ourStance ?? null), judgement: form.judgement, isDecisive: form.isDecisive, recordedAt: new Date().toISOString(), version: 1 }
      const input = isFoul ? { ...base, techniqueKey: 'HANSOKU' } : { ...base, target: form.target, methods: form.methods, techniqueKey: techniqueKey(form.target, form.methods) }
      const res: Response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': token }, body: JSON.stringify({ query: createPointMutation, variables: { input } }) })
      const json: any = await res.json(); if (json.errors) throw new Error(JSON.stringify(json.errors))
      await fetchMatches(); setForm(f => ({ ...f, tSec: 60, methods: [], isDecisive: false, sequenceLen: 1, sequenceTargets: [], isMutual: false }))
    } catch (e:any) { setError(String(e?.message ?? e)) } finally { setLoading(false) }
  }

  async function addFoul(toSide: 'left'|'right'){
    if(!selectedBout) return
    const penalizedPlayerId = toSide === 'left' ? selectedBout.ourPlayerId : selectedBout.opponentPlayerId
    const opponentPlayerId = toSide === 'left' ? selectedBout.opponentPlayerId : selectedBout.ourPlayerId
    const next = (fouls[penalizedPlayerId] ?? 0) + 1
    setFouls(prev => ({ ...prev, [penalizedPlayerId]: next }))
    if (next >= 2) {
      setLoading(true); setError(null)
      try {
        const token = await getToken(); if (!token) throw new Error('No ID token')
        const input: any = { boutId: selectedBout.id, tSec: Number(form.tSec) || 0, scorerPlayerId: opponentPlayerId, opponentPlayerId: penalizedPlayerId, position: selectedBout.ourPosition ?? null, scorerStance: null, opponentStance: null, judgement: 'HANSOKU', isDecisive: false, techniqueKey: 'HANSOKU', recordedAt: new Date().toISOString(), version: 1 }
        const res: Response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': token }, body: JSON.stringify({ query: createPointMutation, variables: { input } }) })
        const json: any = await res.json(); if (json.errors) throw new Error(JSON.stringify(json.errors))
        await fetchMatches(); setFouls(prev => ({ ...prev, [penalizedPlayerId]: 0 }))
      } catch (e: any) { setError(String(e?.message ?? e)) } finally { setLoading(false) }
    }
  }

  return (
    <Authenticator>
      {({ signOut, user }) => (
        <div className="app-shell">
          <header className="app-header">
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <Heading level={4} style={{ margin:0 }}>{t('app.title')}</Heading>
            </div>
            <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:12 }}>
              <Badge variation="info">{user?.signInDetails?.loginId}</Badge>
              <Button onClick={signOut}>{t('action.signOut')}</Button>
            </div>
          </header>
          <aside className="app-sidebar">
            <nav style={{ display:'grid', gap:6 }}>
              <a className={`nav-item${tab==='dashboard'?' active':''}`} onClick={()=> setTab('dashboard')}>{t('tab.dashboard')}</a>
              <a className={`nav-item${tab==='new'?' active':''}`} onClick={()=> setTab('new')}>{t('tab.new')}</a>
              <hr />
              <div className="muted" style={{ fontSize:'12px', padding:'4px 8px' }}>Admin</div>
              <a className={`nav-item${tab==='players'?' active':''}`} onClick={()=> setTab('players')}>{t('nav.playersRegister')}</a>
              <a className={`nav-item${tab==='universities'?' active':''}`} onClick={()=> setTab('universities')}>{t('nav.universities')}</a>
            </nav>
          </aside>
          <main className="app-main">
          

          {tab==='new' && (
            <NewEntryMode
              matchId={selectedMatchId}
              setMatchId={setSelectedMatchId}
              matches={matches as any}
              bouts={(selectedMatch?.bouts?.items ?? []) as any}
              players={players}
              masters={{ targets: masters.targets as any, methods: masters.methods as any }}
              apiUrl={apiUrl}
              getToken={getToken}
              onSaved={async ()=> { await fetchMatches() }}
            />
          )}


          {tab==='sheet' && (
            <>
              <View marginBottom="1rem" display="flex" gap="0.5rem" style={{flexWrap:'wrap'}}>
                <Button isLoading={loading} onClick={fetchMatches}>{t('action.reload')}</Button>
                <SelectField label={t('filters.type')} value={officialFilter} onChange={e=> setOfficialFilter(e.target.value as any)} size="small">
                  <option value="all">{t('filters.all')}</option>
                  <option value="official">{t('filters.official')}</option>
                  <option value="practice">{t('filters.practice')}</option>
                  <option value="intra">{t('filters.intra') ?? 'Intra-squad only'}</option>
                </SelectField>
                <SelectField label={t('field.match')} value={selectedMatchId} onChange={e=> setSelectedMatchId(e.target.value)} size="small">
                  <option value="">{t('placeholder.select')}</option>
                  {visibleMatches.map(m => (<option key={m.id} value={m.id}>{m.heldOn} {m.tournament ?? ''}</option>))}
                </SelectField>
                <SelectField label={t('field.bout')} value={selectedBoutId} onChange={e=> setSelectedBoutId(e.target.value)} size="small" isDisabled={!selectedMatch}>
                  <option value="">{t('placeholder.select')}</option>
                  {(selectedMatch?.bouts?.items ?? []).map(b => (
                    <option key={b.id} value={b.id}>{labelJa.position[b.ourPosition??''] ? `[${labelJa.position[b.ourPosition??'']}] `: ''}{players[b.ourPlayerId] ?? b.ourPlayerId} vs {players[b.opponentPlayerId] ?? b.opponentPlayerId}</option>
                  ))}
                </SelectField>
              </View>

              {selectedBout && (
                <View border="1px solid #ddd" borderRadius="8px" padding="12px" marginBottom="16px">
                  <SheetInput
                    bout={selectedBout as any}
                    existingPoints={(selectedBout.points?.items ?? []) as any}
                    masters={{ targets: masters.targets as any, methods: masters.methods as any }}
                    labelJa={{ target: labelJa.target, method: labelJa.method }}
                    apiUrl={apiUrl}
                    getToken={getToken}
                    onSaved={async ()=> { await fetchMatches() }}
                  />
                </View>
              )}
            </>
          )}

          {tab==='input' ? (
            <>
              <View marginBottom="1rem" display="flex" gap="0.5rem" style={{flexWrap:'wrap'}}>
                <Button isLoading={loading} onClick={fetchMatches}>{t('action.reload')}</Button>
                <SelectField label={t('filters.type')} value={officialFilter} onChange={e=> setOfficialFilter(e.target.value as any)} size="small">
                  <option value="all">{t('filters.all')}</option>
                  <option value="official">{t('filters.official')}</option>
                  <option value="practice">{t('filters.practice')}</option>
                  <option value="intra">{t('filters.intra') ?? 'Intra-squad only'}</option>
                </SelectField>
                <SelectField label={t('field.match')} value={selectedMatchId} onChange={e=> setSelectedMatchId(e.target.value)} size="small">
                  <option value="">{t('placeholder.select')}</option>
                  {visibleMatches.map(m => (<option key={m.id} value={m.id}>{m.heldOn} {m.tournament ?? ''}</option>))}
                </SelectField>
                <SelectField label={t('field.bout')} value={selectedBoutId} onChange={e=> setSelectedBoutId(e.target.value)} size="small" isDisabled={!selectedMatch}>
                  <option value="">{t('placeholder.select')}</option>
                  {(selectedMatch?.bouts?.items ?? []).map(b => (
                    <option key={b.id} value={b.id}>{labelJa.position[b.ourPosition??''] ? `[${labelJa.position[b.ourPosition??'']}] `: ''}{players[b.ourPlayerId] ?? b.ourPlayerId} vs {players[b.opponentPlayerId] ?? b.opponentPlayerId}</option>
                  ))}
                </SelectField>
              </View>

              {selectedBout && (
                <View border="1px solid #ddd" borderRadius="8px" padding="12px" marginBottom="16px">
                  <Heading level={5}>{t('section.dualPane')}</Heading>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:8 }}>
                    <QuickInputPanel
                      side="left"
                      playerName={(players[selectedBout.ourPlayerId] ?? selectedBout.ourPlayerId) + " (" + t('left') + ")"}
                      targets={masters.targets.map((x:any)=> ({ code:x.code, label:x.nameJa }))}
                      methods={masters.methods.map((x:any)=> ({ code:x.code, label:x.nameJa }))}
                      foulCount={fouls[selectedBout.ourPlayerId] ?? 0}
                      onFoul={addFoul}
                      onPoint={({ side, target, methods })=> createPointDirect({ scorer: side==='left'?'our':'opponent', target, methods })}
                    />
                    <QuickInputPanel
                      side="right"
                      playerName={(players[selectedBout.opponentPlayerId] ?? selectedBout.opponentPlayerId) + " (" + t('right') + ")"}
                      targets={masters.targets.map((x:any)=> ({ code:x.code, label:x.nameJa }))}
                      methods={masters.methods.map((x:any)=> ({ code:x.code, label:x.nameJa }))}
                      foulCount={fouls[selectedBout.opponentPlayerId] ?? 0}
                      onFoul={addFoul}
                      onPoint={({ side, target, methods })=> createPointDirect({ scorer: side==='left'?'our':'opponent', target, methods })}
                    />
                  </div>
                </View>
              )}

              <View border="1px solid #ddd" borderRadius="8px" padding="12px" marginBottom="16px">
                <Heading level={5}>{t('section.legacyInput')}</Heading>
                <Button variation="link" onClick={()=> setShowLegacy(s=> !s)}>{showLegacy ? t('toggle.legacy.hide') : t('toggle.legacy.show')}</Button>
                {showLegacy && (
                  <Flex gap="0.75rem" wrap="wrap" marginTop="0.5rem">
                    <TextField label={t('field.timeSec')} type="number" width="8rem" value={String(form.tSec)} onChange={e=> setForm(f=> ({...f, tSec: Number(e.target.value)}))} />
                    <SelectField label={t('field.target')} value={form.target} onChange={e=> setForm(f=> ({...f, target: e.target.value}))} width="10rem">
                      <option value="">{t('placeholder.select')}</option>
                      {masters.targets.map((tgt:any)=> (<option key={tgt.code} value={tgt.code}>{tgt.nameJa}</option>))}
                    </SelectField>
                    <SelectField label={t('field.method')} value="" onChange={e=> { const v = e.target.value; setForm(f=> f.methods.includes(v) || !v ? f : {...f, methods: [...f.methods, v]}) }} width="14rem">
                      <option value="">{t('action.add')}</option>
                      {masters.methods.filter((m:any)=>{
                        const tgtLabel = labelJa.target[form.target] ?? ''
                        if(!form.target) return true
                        if(m.code==='GYAKU') return /胴/.test(tgtLabel)
                        if(m.code==='HIDARI') return /小手/.test(tgtLabel)
                        if(m.code==='AIKOTE') return /面/.test(tgtLabel)
                        return true
                      }).map((m:any)=> (<option key={m.code} value={m.code}>{m.nameJa}</option>))}
                    </SelectField>
                    <View>
                      <div style={{ fontSize: '0.85em', marginBottom: 4 }}>{t('field.method')}</div>
                      <div>
                        {form.methods.map((m)=> (
                          <Badge key={m} marginRight="4px">
                            {labelJa.method[m] ?? m}
                            <Button size="small" variation="link" onClick={()=> setForm(f=> ({...f, methods: f.methods.filter(x=> x!==m)}))}>x</Button>
                          </Badge>
                        ))}
                        {form.methods.length>0 && (
                          <Button size="small" onClick={()=> setForm(f=> ({...f, methods: []}))}>Clear</Button>
                        )}
                      </div>
                    </View>
                    <RadioGroupField name="scorer" legend={t('field.scorer')} direction="row" value={form.scorer} onChange={(e:any)=> setForm(f=> ({...f, scorer: ((e?.target?.value ?? e) as any)}))}>
                      <Radio value="our">{t('team.our')}</Radio>
                      <Radio value="opponent">{t('team.opponent')}</Radio>
                    </RadioGroupField>
                    <SelectField label={t('field.judgement')} value={form.judgement} onChange={e=> setForm(f=> ({...f, judgement: e.target.value}))} width="10rem">
                      <option value="REGULAR">{t('judgement.REGULAR')}</option>
                      <option value="ENCHO">{t('judgement.ENCHO')}</option>
                      <option value="HANSOKU">{t('judgement.HANSOKU')}</option>
                    </SelectField>
                    <CheckboxField label={t('field.decidingStrike')} checked={form.isDecisive} onChange={e=> setForm(f=> ({...f, isDecisive: e.target.checked}))} />
                    <Button onClick={createPointSmart} isDisabled={!selectedBout} isLoading={loading}>{t('action.add')}</Button>
                  </Flex>
                )}
                {error && <Alert variation="error" marginTop="0.5rem">{error}</Alert>}
              </View>

              <Table variation="striped" highlightOnHover>
                <TableHead>
                  <TableRow>
                    <TableCell as="th">Date</TableCell>
                    <TableCell as="th">Tournament</TableCell>
                    <TableCell as="th">Bout</TableCell>
                  </TableRow>
                </TableHead>
              <TableBody>
                  {visibleMatches.map((m:any) => (
                    <TableRow key={m.id}>
                      <TableCell>{m.heldOn}</TableCell>
                      <TableCell>
                        {m.tournament ?? '-'}
                        <Badge variation={m.isOfficial===false? 'warning':'success'} marginLeft="0.5rem">
                          {m.isOfficial===false ? (t('labels.practice') ?? 'Practice') : (t('labels.official') ?? 'Official')}
                        </Badge>
                        {(homeUniversityId && m.ourUniversityId && m.opponentUniversityId && m.ourUniversityId===homeUniversityId && m.opponentUniversityId===homeUniversityId) && (
                          <Badge variation="info" marginLeft="0.5rem">{t('labels.intra') ?? 'Intra-squad'}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {(m.bouts?.items ?? []).map((b) => (
                          <View key={b.id} paddingBlock="0.25rem">
                            <div>{players[b.ourPlayerId] ?? b.ourPlayerId} vs {players[b.opponentPlayerId] ?? b.opponentPlayerId} [{boutResultText(b)}]</div>
                            <div style={{ fontSize: '0.9em', color: '#444' }}>
                              {(b.points?.items ?? []).map((p, i) => {
                                const label = p.judgement === 'HANSOKU' ? t('label.foulPoint') : methodFirstLabel(p.target, p.methods)
                                const side = p.scorerPlayerId === b.ourPlayerId ? '<-' : (p.scorerPlayerId === b.opponentPlayerId ? '->' : '')
                                return (<span key={i} style={{ marginRight: 8 }}>{side} {p.tSec}s {label}</span>)
                              })}
                            </div>
                          </View>
                        ))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {techModal.open && (
                <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }} onClick={closeTechModal}>
                  <div style={{ background:'#fff', minWidth:320, maxWidth:560, width:'90%', padding:16, borderRadius:8 }} onClick={e=> e.stopPropagation()}>
                    <Heading level={5}>Select Detailed Technique</Heading>
                    <div style={{ color:'#666', margin:'6px 0 12px' }}>Target: {labelJa.target[techModal.target] ?? techModal.target}</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                      {masters.methods.map((m:any)=>{
                        const checked = techModal.methods.includes(m.code)
                        const display = `${m.nameJa}${labelJa.target[techModal.target] ?? techModal.target}`
                        return (
                          <button key={m.code} onClick={()=> setTechModal(s=> ({...s, methods: checked ? s.methods.filter((x:string)=> x!==m.code) : [...s.methods, m.code]}))} style={{ padding:'6px 10px', borderRadius:16, border:'1px solid #ddd', background: checked ? '#eef6ff' : '#fff', cursor:'pointer' }}>{display}</button>
                        )
                      })}
                    </div>
                    <div style={{ display:'flex', gap:8, marginTop:14, justifyContent:'flex-end' }}>
                      <Button onClick={closeTechModal} variation="link">Cancel</Button>
                      <Button onClick={confirmTechModal} variation="primary">Save</Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (tab==='dashboard' ? (
            <>
              <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                <Button variation={dashMode==='personal'?'primary':'link'} onClick={()=> setDashMode('personal')}>{t('dashboard.personal')||'Personal'}</Button>
                <Button variation={dashMode==='team'?'primary':'link'} onClick={()=> setDashMode('team')}>{t('dashboard.team')||'Team'}</Button>
              </div>
              {dashMode==='personal' ? (
                <Dashboard
                  matches={matches as any}
                  players={players}
                  labelJa={labelJa}
                  masters={{ targets: masters.targets as any, methods: masters.methods as any }}
                  homeUniversityId={homeUniversityId}
                />
              ) : (
                <TeamDashboard
                  matches={matches as any}
                  universities={universities}
                  players={players}
                  labelJa={labelJa}
                  homeUniversityId={homeUniversityId}
                />
              )}
            </>
          ) : null)}
          </main>
        </div>
      )}
    </Authenticator>
  )
}












