import { useEffect, useState } from 'react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { View, Table, TableHead, TableRow, TableCell, TableBody, Button, SelectField, TextField, Badge, Heading } from '@aws-amplify/ui-react'
import { methodAllowedForTargetJaLabel } from '../lib/tech'
import Typeahead, { TypeaheadItem } from './Typeahead'

type Master = { code: string; nameJa?: string; nameEn?: string }
type Bout = {
  id: string;
  createdAt?: string;
  seq?: number;
  ourPlayerId: string;
  opponentPlayerId: string;
  ourPosition?: string;
  ourStance?: string;
  opponentStance?: string;
  winType?: string | null;
  winnerPlayerId?: string | null;
  points?: { items: { id: string; tSec: number; target?: string|null; methods?: string[]|null; scorerPlayerId?: string|null; judgement?: string|null }[] }
}
type PointInput = { tSec: number | ''; target: string; methods: string[] }
type University = { id: string; name: string; shortName?: string|null }
type PlayerEx = { id: string; name: string; nameKana?: string|null; universityId?: string|null; gender?: 'MEN'|'WOMEN'|null; enrollYear?: number|null; grade?: number|null }

  function IpponCell(props: {
  value: PointInput | null
  onChange: (next: PointInput | null) => void
  targets: Master[]
  methods: Master[]
  onFocus?: () => void
}){
  const { t, i18n } = useTranslation()
  const { value, onChange, targets, methods, onFocus } = props
  const v = value ?? { tSec: 0, target: '', methods: [] }
  const valid = (v.methods.length>0) && !!v.target && ((typeof v.tSec === 'number' && v.tSec >= 0) || v.tSec==='')
  const [open, setOpen] = useState(false)

  function parseTime(input: string): number | '' {
    const s = input.trim()
    if(s === '') return ''
    const mmss = s.match(/^([0-9]{1,2})[:'m]\s*([0-5]?[0-9])$/)
    if(mmss){ return Number(mmss[1])*60 + Number(mmss[2]) }
    const n = Number(s); return Number.isFinite(n) && n>=0 ? n : ''
  }

  function targetLabelJa(code:string){ const m = targets.find(t=> t.code===code); return (m?.nameJa ?? m?.nameEn ?? '') }
  function methodAllowedForTarget2(mcode:string, tcode:string){
    if(!tcode) return true
    const tl = targetLabelJa(tcode)
    // Prefer Japanese label; fall back to common target codes
    if(tl) return methodAllowedForTargetJaLabel(mcode, tl)
    const code = (tcode||'').toUpperCase()
    if(mcode==='GYAKU') return code.includes('DO')
    if(mcode==='HIDARI') return code.includes('KOTE')
    if(mcode==='AIKOTE') return code.includes('MEN')
    return true
  }
  function methodAllowedForTarget(mcode:string, tcode:string){
    if(!tcode) return true
    const tl = targetLabelJa(tcode)
    if(mcode==='GYAKU') return tl.includes('胴')
    if(mcode==='HIDARI') return tl.includes('小手')
    if(mcode==='AIKOTE') return tl.includes('面')
    return true
  }

  return (
    <div style={{ position:'relative', display: 'grid', gridTemplateColumns: 'minmax(32px,auto) 1fr', gridAutoRows:'minmax(20px,auto)', gap: 4, border: valid ? '1px solid transparent' : '1px solid #e66', borderRadius:6, padding:'2px 4px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:4, minHeight: 24 }}>
        <Button size="small" variation="link" onClick={()=> { onFocus?.(); setOpen(o=> !o) }} title={open ? t('ipponCell.closeMethods') : t('ipponCell.chooseMethods')} style={{ minWidth:28, padding:'2px 4px' }}>
          {open ? '-' : '+'}
        </Button>
        {!open && (
          <div style={{ display:'flex', gap:2, overflow:'hidden', whiteSpace:'nowrap' }}>
            {v.methods.slice(0,2).map(code=> {
              const found = methods.find(mm=> mm.code===code)
              const label = found ? (i18n.language.startsWith('ja') ? (found.nameJa ?? found.nameEn ?? found.code) : (found.nameEn ?? found.code)) : code
              return (<Badge key={code} variation="info" style={{ padding:'0 4px' }}>{label}</Badge>)
            })}
            {v.methods.length>2 && (<Badge variation="info" style={{ padding:'0 4px' }}>+{v.methods.length-2}</Badge>)}
          </div>
        )}
      </div>
      {open && (
        <div style={{ position:'absolute', top:'100%', left:0, zIndex:20, marginTop:4, background:'#fff', display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:4, maxHeight:140, width:260, overflowY:'auto', border:'1px solid #ddd', borderRadius:6, padding:6, boxShadow:'0 2px 8px rgba(0,0,0,0.15)' }}>
          {methods.map(m=> {
            const checked = v.methods.includes(m.code)
            const allowed = methodAllowedForTarget2(m.code, v.target)
            return (
              <label key={m.code} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, opacity: allowed?1:0.4 }}>
                <input type="checkbox" disabled={!allowed} checked={checked && allowed} onChange={(e)=>{
                  onFocus?.();
                  if(e.target.checked) onChange({ ...v, methods: [...v.methods, m.code] })
                  else onChange({ ...v, methods: v.methods.filter(x=> x!==m.code) })
                  // Close the method picker immediately after a click for faster entry
                  setOpen(false)
                }} />
                <span>{i18n.language.startsWith('ja') ? (m.nameJa ?? m.nameEn ?? m.code) : (m.nameEn ?? m.code)}</span>
              </label>
            )
          })}
        </div>
      )}
      <SelectField label={t('labels.target')||'Target'} labelHidden placeholder={t('ipponCell.targetPlaceholder')} value={v.target} onChange={(e)=> { onFocus?.(); const nextTarget=e.target.value; const filtered = (v.methods||[]).filter(m=> methodAllowedForTarget2(m, nextTarget)); onChange({ ...v, target: nextTarget, methods: filtered }) }} size="small">
        <option value=""></option>
        {targets.map(tgt=> (
          <option key={tgt.code} value={tgt.code}>{i18n.language.startsWith('ja') ? (tgt.nameJa ?? tgt.nameEn ?? tgt.code) : (tgt.nameEn ?? tgt.code)}</option>
        ))}
      </SelectField>
      <div style={{ gridColumn:'1 / 2', display:'flex', alignItems:'center', gap:4 }}>
        <TextField label={t('labels.seconds')||'Seconds'} labelHidden placeholder={t('ipponCell.secondsPlaceholder')} value={v.tSec === '' ? '' : String(v.tSec)} onChange={(e)=> { onFocus?.(); onChange({ ...v, tSec: parseTime(e.target.value) }) }} width="40px" style={{ padding:'2px 4px' }} />
        <span style={{ fontSize:10, color:'#666' }}>s</span>
      </div>
    </div>
  )
}

export default function NewEntryMode(props: {
  matchId: string
  setMatchId: (id: string)=> void
  matches: { id: string; heldOn: string; tournament?: string; isOfficial?: boolean; bouts?: { items: Bout[] } }[]
  bouts: Bout[]
  players: Record<string,string>
  masters: { targets: Master[]; methods: Master[] }
  apiUrl: string
  getToken: () => Promise<string | null>
  onSaved: ()=> Promise<void> | void
}){
  const { t } = useTranslation()
  const { matchId, setMatchId, matches, bouts, players, masters, apiUrl, getToken, onSaved } = props
  type RowState = { left1: PointInput | null; left2: PointInput | null; right1: PointInput | null; right2: PointInput | null; leftFouls: number; rightFouls: number }
  const [rows, setRows] = useState<Record<string, RowState>>({})
  const [boutsLocal, setBoutsLocal] = useState<Bout[]>(bouts)
  const [autoResult, setAutoResult] = useState<boolean>(true)
  const [resultEdit, setResultEdit] = useState<Record<string, { winType: string; winner: 'our'|'opponent'|'' }>>({})
  const [tournament, setTournament] = useState<string>('')
  const [heldOn, setHeldOn] = useState<string>('')
  const [newLeft, setNewLeft] = useState<string>('')
  const [newRight, setNewRight] = useState<string>('')
  const [playerFilter, setPlayerFilter] = useState('')
  const [playerGenderFilter, setPlayerGenderFilter] = useState<'ALL'|'MEN'|'WOMEN'>('ALL')
  const [universities, setUniversities] = useState<University[]>([])
  const [playersEx, setPlayersEx] = useState<PlayerEx[]>([])
  const [ourUniversityId, setOurUniversityId] = useState<string>('')
  const [opponentUniversityId, setOpponentUniversityId] = useState<string>('')
  const [isOfficial, setIsOfficial] = useState<boolean>(true)
  const [refError, setRefError] = useState<string|undefined>(undefined)
  const [dense, setDense] = useState<boolean>(true)
  // Fallback masters when API returns empty in prod
  const fallbackTargets: Master[] = [
    { code: 'MEN', nameJa: '面', nameEn: 'Men' },
    { code: 'KOTE', nameJa: '小手', nameEn: 'Kote' },
    { code: 'DO', nameJa: '胴', nameEn: 'Do' },
    { code: 'TSUKI', nameJa: '突き', nameEn: 'Tsuki' },
  ]
  const fallbackMethods: Master[] = [
    { code:'SURIAGE', nameJa:'すり上げ', nameEn:'Suriage' },
    { code:'KAESHI', nameJa:'返し', nameEn:'Kaeshi' },
    { code:'NUKI', nameJa:'抜き', nameEn:'Nuki' },
    { code:'DEBANA', nameJa:'出ばな', nameEn:'Debana' },
    { code:'HIKI', nameJa:'引き', nameEn:'Hiki' },
    { code:'HARAI', nameJa:'払い', nameEn:'Harai' },
    { code:'TOBIKOMI', nameJa:'飛び込み', nameEn:'Tobikomi' },
    { code:'GYAKU', nameJa:'逆', nameEn:'Gyaku' },
    { code:'HIDARI', nameJa:'左', nameEn:'Left' },
    { code:'AIKOTE', nameJa:'相小手', nameEn:'Aikote' },
  ]
  const safeTargets = (masters.targets && masters.targets.length>0) ? masters.targets : fallbackTargets
  const safeMethods = (masters.methods && masters.methods.length>0) ? masters.methods : fallbackMethods
  const [focusBoutId, setFocusBoutId] = useState<string>('')
  const [allowEncho, setAllowEncho] = useState<boolean>(true)
  const [allowHantei, setAllowHantei] = useState<boolean>(false)
  const [opMsg, setOpMsg] = useState<string|undefined>(undefined)
  const [savingId, setSavingId] = useState<string>('')
  // YouTube playlist settings for current tournament
  const [ytOpen, setYtOpen] = useState(false)
  const [ytUrl, setYtUrl] = useState<string>('')
  // Player qualitative notes
  const [noteOpen, setNoteOpen] = useState(false)
  // Keyed by `${boutId}:${playerId}` to keep comments per-bout per-player
  const [notes, setNotes] = useState<Record<string,string>>({})
  const [notesLoading, setNotesLoading] = useState(false)

  // Quick add player states
  const [quickPlayerName, setQuickPlayerName] = useState('')
  const [quickPlayerUniversityId, setQuickPlayerUniversityId] = useState<string>('')
  useEffect(()=>{
    const init: Record<string, RowState> = {}
    for(const b of bouts){ init[b.id] = rows[b.id] ?? { left1:null, left2:null, right1:null, right2:null, leftFouls:0, rightFouls:0 } }
    setRows(init)
    const m = matches.find(m=> m.id===matchId)
    if(m){ setTournament(m.tournament ?? ''); setHeldOn(m.heldOn ?? ''); setIsOfficial((m as any).isOfficial ?? true); setOurUniversityId((m as any).ourUniversityId ?? ''); setOpponentUniversityId((m as any).opponentUniversityId ?? '') }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bouts.map(b=> b.id).join(','), matchId])
  // Load initial YouTube URL for selected tournament from localStorage (best-effort)
  useEffect(()=>{
    try{
      const raw = localStorage.getItem('yt.playlists');
      if(raw){
        const map = JSON.parse(raw) as Record<string,string>;
        setYtUrl(map[tournament] || '')
      } else { setYtUrl('') }
    }catch{ setYtUrl('') }
  }, [tournament])

  function canonicalPlaylistUrl(input: string): string | '' {
    const s = (input||'').trim()
    if(!s) return ''
    try{
      if(/^https?:\/\//i.test(s)){
        const u = new URL(s)
        const id = u.searchParams.get('list') || ''
        return id ? "https://www.youtube.com/playlist?list=" + id : s
      }
      // treat as playlist id
      return "https://www.youtube.com/playlist?list=" + s
    }catch{ return '' }
  }

  async function saveYtForTournament(){
    try{ // persist locally
      const key = tournament?.trim(); if(!key){ setYtOpen(false); return }
      const url = canonicalPlaylistUrl(ytUrl)
      let map: Record<string,string> = {}
      try{ const raw = localStorage.getItem('yt.playlists'); if(raw) map = JSON.parse(raw) }catch{}
      if(url) map[key] = url; else delete map[key]
      try{ localStorage.setItem('yt.playlists', JSON.stringify(map)) }catch{}
      // send to API (inline input; no variables)
      if(apiUrl && getToken){
        try{
          const token = await getToken();
          if(token){
            const updateMut = "mutation UpdateTournamentMaster { updateTournamentMaster(input:{ name: \"" + key.replace(/\"/g,'\\\"') + "\", youtubePlaylist: " + (url?("\"" + url.replace(/\"/g,'\\\"') + "\""):"null") + " }){ name } }"
            const createMut = "mutation CreateTournamentMaster { createTournamentMaster(input:{ name: \"" + key.replace(/\"/g,'\\\"') + "\", youtubePlaylist: " + (url?("\"" + url.replace(/\"/g,'\\\"') + "\""):"null") + " }){ name } }"
            try{ await fetch(apiUrl, { method:'POST', headers:{ 'Content-Type':'application/json','Authorization': token }, body: JSON.stringify({ query: updateMut }) }) }catch{}
            try{ await fetch(apiUrl, { method:'POST', headers:{ 'Content-Type':'application/json','Authorization': token }, body: JSON.stringify({ query: createMut }) }) }catch{}
          }
        }catch{}
      }
    }finally{
      setYtOpen(false)
    }
  }

  // New per-bout note schema
  const listNotesByBout = `query ListPlayerNotesByBout($boutId: ID!, $limit:Int){ listPlayerNotesByBout(boutId:$boutId, limit:$limit){ items{ playerId boutId matchId comment } } }`
  const updateBoutNoteMut = `mutation UpdatePlayerBoutNote($input: UpdatePlayerBoutNoteInput!){ updatePlayerBoutNote(input:$input){ playerId boutId } }`
  const createBoutNoteMut = `mutation CreatePlayerBoutNote($input: CreatePlayerBoutNoteInput!){ createPlayerBoutNote(input:$input){ playerId boutId } }`

  function sortedBouts(){
    return boutsLocal.slice().sort((a:any,b:any)=>{
      const as = (typeof a.seq==='number')? a.seq : Number.MAX_SAFE_INTEGER
      const bs = (typeof b.seq==='number')? b.seq : Number.MAX_SAFE_INTEGER
      if(as!==bs) return as-bs
      const ad = a.createdAt? new Date(a.createdAt).getTime() : 0
      const bd = b.createdAt? new Date(b.createdAt).getTime() : 0
      if(ad!==bd) return ad-bd
      return String(a.id).localeCompare(String(b.id))
    })
  }

  async function openNotes(){
    setNoteOpen(true)
    if(!matchId) return
    setNotesLoading(true)
    try{
      const token = await getToken(); if(!token) return
      const map: Record<string,string> = {}
      for(const b of sortedBouts()){
        try{
          const res: Response = await fetch(apiUrl, { method:'POST', headers:{ 'Content-Type':'application/json','Authorization': token }, body: JSON.stringify({ query: listNotesByBout, variables: { boutId: b.id, limit: 200 } }) })
          const j: any = await res.json();
          const arr = (j?.data?.listPlayerNotesByBout?.items ?? []) as any[]
          for(const it of arr){ map[`${it.boutId}:${it.playerId}`] = it.comment || '' }
        }catch{}
      }
      setNotes(map)
    }catch{}
    finally{ setNotesLoading(false) }
  }
  async function saveNotes(){
    if(!matchId) { setNoteOpen(false); return }
    try{
      const token = await getToken(); if(!token) return
      for(const b of sortedBouts()){
        for(const pid of [b.ourPlayerId, b.opponentPlayerId]){
          const key = `${b.id}:${pid}`
          const comment = (notes[key]||'').trim()
          if(comment){
            const input: any = { playerId: pid, boutId: b.id, matchId, comment }
            try{ await fetch(apiUrl, { method:'POST', headers:{ 'Content-Type':'application/json','Authorization': token }, body: JSON.stringify({ query: updateBoutNoteMut, variables: { input } }) }) }catch{}
            try{ await fetch(apiUrl, { method:'POST', headers:{ 'Content-Type':'application/json','Authorization': token }, body: JSON.stringify({ query: createBoutNoteMut, variables: { input } }) }) }catch{}
          }
        }
      }
    }catch{}
    setNoteOpen(false)
  }

  async function loadRefData(){
    setRefError(undefined)
    try{
      const token = await getToken(); if(!token) return
      // universities
      const qU = `query ListUniversities($limit:Int,$nextToken:String){ listUniversities(limit:$limit,nextToken:$nextToken){ items{ id name shortName } nextToken } }`
      let ntU: string | null = null; const accU: University[] = []
      do{ const r = await fetch(apiUrl, { method:'POST', headers:{ 'Content-Type':'application/json','Authorization':token }, body: JSON.stringify({ query: qU, variables:{ limit:200, nextToken: ntU } }) }); const j:any = await r.json(); if(j.errors) throw new Error(JSON.stringify(j.errors)); accU.push(...j.data.listUniversities.items); ntU=j.data.listUniversities.nextToken } while(ntU)
      setUniversities(accU)
      // players with universityId and gender
      const qP = `query ListPlayers($limit:Int,$nextToken:String){ listPlayers(limit:$limit,nextToken:$nextToken){ items{ id name nameKana universityId gender enrollYear grade } nextToken } }`
      let ntP: string | null = null; const accP: PlayerEx[] = []
      do{ const r = await fetch(apiUrl, { method:'POST', headers:{ 'Content-Type':'application/json','Authorization':token }, body: JSON.stringify({ query: qP, variables:{ limit:200, nextToken: ntP } }) }); const j:any = await r.json(); if(j.errors) throw new Error(JSON.stringify(j.errors)); accP.push(...j.data.listPlayers.items); ntP=j.data.listPlayers.nextToken } while(ntP)
      setPlayersEx(accP)
    } catch(e:any){ setRefError(t('errors.refDataLoadFailed')) }
  }
  useEffect(()=>{ try{ const saved=localStorage.getItem('ui:dense'); if(saved!=null) setDense(saved==='1') }catch{}; try{ const re=localStorage.getItem('rules:encho'); if(re!=null) setAllowEncho(re==='1') }catch{}; try{ const rh=localStorage.getItem('rules:hantei'); if(rh!=null) setAllowHantei(rh==='1') }catch{}; loadRefData() }, [])
  useEffect(()=>{ try{ const ar=localStorage.getItem('rules:autoResult'); if(ar!=null) setAutoResult(ar==='1') }catch{} },[])
  useEffect(()=>{ try{ localStorage.setItem('ui:dense', dense?'1':'0') }catch{} }, [dense])
  useEffect(()=>{ try{ localStorage.setItem('rules:encho', allowEncho?'1':'0') }catch{} }, [allowEncho])
  useEffect(()=>{ try{ localStorage.setItem('rules:hantei', allowHantei?'1':'0') }catch{} }, [allowHantei])
  useEffect(()=>{ try{ localStorage.setItem('rules:autoResult', autoResult?'1':'0') }catch{} }, [autoResult])
  useEffect(()=>{ if(!focusBoutId) return; setTimeout(()=>{ const el=document.getElementById(`row-${focusBoutId}`); el?.scrollIntoView({behavior:'smooth', block:'center'}) },150) }, [focusBoutId, bouts.length])
  useEffect(()=>{ setBoutsLocal(bouts) }, [bouts])

  // hydrate input rows from existing points so previously-saved techniques are visible
  useEffect(()=>{
    if(!bouts || bouts.length===0) return
    setRows(prev => {
      const next = { ...prev }
      for(const b of bouts){
        const existed = next[b.id]
        if(existed && (existed.left1 || existed.left2 || existed.right1 || existed.right2)) continue
        const pts = (b.points?.items ?? []).filter(p=> p.judgement !== 'HANSOKU')
        const leftPts = pts.filter(p=> p.scorerPlayerId===b.ourPlayerId).sort((a,b)=> (a.tSec||0)-(b.tSec||0)).slice(0,2)
        const rightPts = pts.filter(p=> p.scorerPlayerId===b.opponentPlayerId).sort((a,b)=> (a.tSec||0)-(b.tSec||0)).slice(0,2)
        const map = (p:any): PointInput => ({ tSec: Number(p.tSec)||0, target: p.target || '', methods: (p.methods||[]) })
        next[b.id] = {
          left1: leftPts[0] ? map(leftPts[0]) : null,
          left2: leftPts[1] ? map(leftPts[1]) : null,
          right1: rightPts[0] ? map(rightPts[0]) : null,
          right2: rightPts[1] ? map(rightPts[1]) : null,
          leftFouls: 0,
          rightFouls: 0,
        }
      }
      return next
    })
  }, [bouts])

  function techniqueKey(target: string, methods: string[]) { return `${target}:${[...methods].sort().join('+')}` }

  const createPointMutation = `mutation CreatePoint($input: CreatePointInput!) { createPoint(input:$input) { id } }`
  const createMatchMutation = `mutation CreateMatch($input: CreateMatchInput!) { createMatch(input:$input){ id heldOn tournament isOfficial ourUniversityId opponentUniversityId } }`
  const createBoutMutation = `mutation CreateBout($input: CreateBoutInput!) { createBout(input:$input){ id ourPlayerId opponentPlayerId } }`

  // Merge provided players map with fetched playersEx for reliable name resolution
  const nameById = useMemo(()=>{
    const m = { ...players };
    for(const p of playersEx){ if(p.id && p.name && !m[p.id]) m[p.id] = p.name }
    return m;
  }, [players, playersEx]);

  // Quick add minimal player (name + university)
  async function quickAddPlayer(){
    const name = quickPlayerName.trim();
    const uniId = (quickPlayerUniversityId || opponentUniversityId || ourUniversityId || '').trim();
    if(!name || !uniId){ alert(t('alerts.nameAndUniversityRequired') || '選手名と大学を選んでください'); return }
    try{
      const token = await getToken(); if(!token) return;
      const q = "mutation CreatePlayer($input: CreatePlayerInput!) { createPlayer(input:$input){ id name universityId } }";
      const r = await fetch(apiUrl, { method:'POST', headers:{ 'Content-Type':'application/json','Authorization': token }, body: JSON.stringify({ query: q, variables: { input: { name, universityId: uniId } } }) });
      const j = await r.json(); if(j.errors) throw new Error(JSON.stringify(j.errors));
      const created = j.data.createPlayer;
      setPlayersEx(list => [...list, created]);
      setQuickPlayerName('');
      if(!quickPlayerUniversityId) setQuickPlayerUniversityId(uniId);
      setOpMsg(t('messages.playerCreated') || '選手を作成しました');
    } catch(e:any){ setRefError(String(e?.message ?? e)) }
  }
  const updateBoutMutation = `mutation UpdateBout($input: UpdateBoutInput!) { updateBout(input:$input){ id winType winnerPlayerId } }`
  const deletePointMutation = `mutation DeletePoint($input: DeletePointInput!) { deletePoint(input:$input){ id } }`
  const deleteBoutMutation = `mutation DeleteBout($input: DeleteBoutInput!) { deleteBout(input:$input){ id } }`
  const deleteMatchMutation = `mutation DeleteMatch($input: DeleteMatchInput!) { deleteMatch(input:$input){ id } }`

  const [delModal, setDelModal] = useState<{ open:boolean; kind:'bout'|'match'; targetId: string; bout?: Bout|null }|null>(null)

  async function deleteBoutDeep(b: Bout){
    const token = await getToken(); if(!token) return
    for(const p of (b.points?.items ?? [])){
      await fetch(apiUrl,{ method:'POST', headers:{'Content-Type':'application/json','Authorization':token}, body: JSON.stringify({ query: deletePointMutation, variables:{ input:{ id: p.id } } }) }).then(r=> r.json()).then(j=> { if(j.errors) throw new Error(JSON.stringify(j.errors)) })
    }
    await fetch(apiUrl,{ method:'POST', headers:{'Content-Type':'application/json','Authorization':token}, body: JSON.stringify({ query: deleteBoutMutation, variables:{ input:{ id: b.id } } }) }).then(r=> r.json()).then(j=> { if(j.errors) throw new Error(JSON.stringify(j.errors)) })
  }

  async function deleteMatchDeep(matchId:string){
    const m = matches.find(x=> x.id===matchId); if(!m) return
    const token = await getToken(); if(!token) return
    for(const b of (m.bouts?.items ?? [])){
      await deleteBoutDeep(b as any)
    }
    await fetch(apiUrl,{ method:'POST', headers:{'Content-Type':'application/json','Authorization':token}, body: JSON.stringify({ query: deleteMatchMutation, variables:{ input:{ id: matchId } } }) }).then(r=> r.json()).then(j=> { if(j.errors) throw new Error(JSON.stringify(j.errors)) })
  }

  async function saveBout(b: Bout, s: RowState){
    const token = await getToken(); if(!token) return
    // Replace mode: clear existing points before creating new ones, so edits don't accumulate
    try{
      for(const p of (b.points?.items ?? [])){
        await fetch(apiUrl,{ method:'POST', headers:{'Content-Type':'application/json','Authorization':token}, body: JSON.stringify({ query: deletePointMutation, variables:{ input:{ id: p.id } } }) }).then(r=> r.json()).then(j=> { if(j.errors) throw new Error(JSON.stringify(j.errors)) })
      }
    }catch(e){ /* ignore and continue */ }
    const payloads: any[] = []
    const push = (side:'left'|'right', p:PointInput|null)=>{
      if(!p) return; if(!p.target||p.methods.length===0) return
      const scorerPlayerId = side==='left' ? b.ourPlayerId : b.opponentPlayerId
      const opponentPlayerId = side==='left' ? b.opponentPlayerId : b.ourPlayerId
      payloads.push({ boutId:b.id, tSec:Number(p.tSec)||0, scorerPlayerId, opponentPlayerId, position:b.ourPosition ?? null, scorerStance: side==='left' ? (b.ourStance ?? null) : (b.opponentStance ?? null), opponentStance: side==='left' ? (b.opponentStance ?? null) : (b.ourStance ?? null), judgement:'REGULAR', isDecisive:false, target:p.target, methods:p.methods, techniqueKey: techniqueKey(p.target,p.methods), recordedAt:new Date().toISOString(), version:1 })
    }
    push('left', s.left1); push('left', s.left2); push('right', s.right1); push('right', s.right2)
    const foulToPoint = (penalized:'left'|'right', count:number)=>{ if(count>=2){ const scorerPlayerId = penalized==='left' ? b.opponentPlayerId : b.ourPlayerId; const opponentPlayerId = penalized==='left' ? b.ourPlayerId : b.opponentPlayerId; payloads.push({ boutId:b.id, tSec:0, scorerPlayerId, opponentPlayerId, position:b.ourPosition ?? null, scorerStance:null, opponentStance:null, judgement:'HANSOKU', isDecisive:false, techniqueKey:'HANSOKU', recordedAt:new Date().toISOString(), version:1 }) } }
    foulToPoint('left', s.leftFouls); foulToPoint('right', s.rightFouls)
    for(const input of payloads){ const r= await fetch(apiUrl,{method:'POST', headers:{'Content-Type':'application/json','Authorization':await getToken() as any}, body: JSON.stringify({ query:createPointMutation, variables:{ input } })}); const j:any=await r.json(); if(j.errors) throw new Error(JSON.stringify(j.errors)) }
    // Auto winType (optional): if enabled, compute from inputs
    const leftCount = payloads.filter(p=> p.scorerPlayerId===b.ourPlayerId).length
    const rightCount = payloads.filter(p=> p.scorerPlayerId===b.opponentPlayerId).length
    let winType: string | null = null
    if(autoResult){
      if(payloads.length === 0){
        winType = 'DRAW'
      } else if(leftCount!==rightCount){
        const winnerPoints = Math.max(leftCount, rightCount)
        winType = winnerPoints>=2 ? 'NIHON' : 'IPPON'
      } else {
        // tie
        if(allowEncho) winType = 'ENCHO'
        else if(allowHantei) winType = 'HANTEI'
        else winType = 'DRAW'
      }
      const nextWinner = leftCount>rightCount? b.ourPlayerId : (rightCount>leftCount? b.opponentPlayerId : null)
      // Only update if different from current
      if(winType && (b.winType !== winType || (b as any).winnerPlayerId !== nextWinner)){
        const r= await fetch(apiUrl,{method:'POST', headers:{'Content-Type':'application/json','Authorization':await getToken() as any}, body: JSON.stringify({ query:updateBoutMutation, variables:{ input:{ id:b.id, winType, winnerPlayerId: nextWinner } } })});
        const j:any= await r.json(); if(j.errors) throw new Error(JSON.stringify(j.errors))
      }
    }
  }

  async function setBoutResult(b:Bout){
    const ed = resultEdit[b.id]; if(!ed) return
    const token = await getToken(); if(!token) return
    const winnerPlayerId = ed.winType==='DRAW' ? null : (ed.winner==='our' ? b.ourPlayerId : b.opponentPlayerId)
    const r= await fetch(apiUrl,{method:'POST', headers:{'Content-Type':'application/json','Authorization':token}, body: JSON.stringify({ query:updateBoutMutation, variables:{ input:{ id:b.id, winType: ed.winType, winnerPlayerId } } })});
    const j:any= await r.json(); if(j.errors) throw new Error(JSON.stringify(j.errors))
    await onSaved()
  }

  async function saveRow(b:Bout){
    const s = rows[b.id]; if(!s) return;
    setOpMsg(undefined); setSavingId(b.id)
    try{
      const token = await getToken(); if(!token){ setOpMsg(t('errors.notSignedIn')); return }
      await saveBout(b,s)
      setOpMsg(t('notices.saved'))
      await onSaved()
    }catch(e:any){ setOpMsg(String(e?.message ?? e)) }
    finally{ setSavingId('') }
  }

  async function saveAll(){ for(const b of bouts){ const s = rows[b.id]; if(!s) continue; await saveBout(b,s) } await onSaved() }

  async function addNewBout(){
    if(!newLeft || !newRight){ alert(t('alerts.selectPlayers')); return }
    let useMatchId = matchId
    const token = await getToken(); if(!token) return
    if(!useMatchId){
      if(!heldOn){ alert(t('alerts.enterDate')); return }
      if(!ourUniversityId || !opponentUniversityId){ alert(t('alerts.selectUniversities')); return }
      const input:any = { heldOn, tournament: tournament||null, isOfficial, ourUniversityId, opponentUniversityId }
      const r= await fetch(apiUrl,{method:'POST', headers:{'Content-Type':'application/json','Authorization':token}, body: JSON.stringify({ query:createMatchMutation, variables:{ input } })});
      const j:any = await r.json(); if(j.errors) throw new Error(JSON.stringify(j.errors));
      useMatchId = j.data.createMatch.id; setMatchId(useMatchId)
    }
    // Assign seq as next number within the match to preserve input order
    let nextSeq = 1
    try{
      const m = matches.find(mm=> mm.id===useMatchId)
      if(m){
        const items = (m.bouts?.items ?? []) as any[]
        const currentMax = items.reduce((mx, bb)=> typeof bb.seq==='number' && Number.isFinite(bb.seq) ? Math.max(mx, bb.seq) : mx, 0)
        nextSeq = currentMax + 1
      }
    }catch{}
    const boutInput:any = { matchId: useMatchId, ourPlayerId: newLeft, opponentPlayerId: newRight, ourPosition:null, ourStance:null, opponentStance:null, winType:null, seq: nextSeq }
    const r2= await fetch(apiUrl,{method:'POST', headers:{'Content-Type':'application/json','Authorization':token}, body: JSON.stringify({ query:createBoutMutation, variables:{ input:boutInput } })});
    const j2:any= await r2.json(); if(j2.errors) throw new Error(JSON.stringify(j2.errors));
    const newId = j2.data.createBout.id as string; setFocusBoutId(newId); setNewLeft(''); setNewRight(''); await onSaved()
  }

  function gradeLabel(p: PlayerEx){
    if(typeof p.grade==='number' && p.grade>0 && p.grade<10) return `${p.grade}年`
    return ''
  }
  const typeaheadItems: TypeaheadItem[] = (playersEx||[])
    .filter(p=> (playerGenderFilter==='ALL') || ((p.gender||null)===playerGenderFilter))
    .map(p=> {
      const uni = universities.find(u=> u.id===p.universityId)
      const uniLabel = uni?.shortName || uni?.name || ''
      const gl = gradeLabel(p)
      const label = [p.name, uniLabel, gl].filter(Boolean).join(' ')
      const searchKey = [p.name, p.nameKana||'', uniLabel, gl].join(' ')
      return { id: p.id, label, searchKey }
    })
    .sort((a,b)=> a.label.localeCompare(b.label,'ja'))

  function ipponValidOrEmpty(v: PointInput | null){ if(!v) return true; const empty = (!v.target && v.methods.length===0 && (v.tSec==='' || v.tSec===undefined)); if(empty) return true; const valid = (v.methods.length>0) && !!v.target && ((typeof v.tSec==='number' && v.tSec>=0) || v.tSec===''); return valid }
  function ipponIsValid(v: PointInput | null){ return !!(v && v.methods.length>0 && !!v.target) }
  function rowHasData(s: RowState){
    return ipponIsValid(s.left1) || ipponIsValid(s.left2) || ipponIsValid(s.right1) || ipponIsValid(s.right2) || (s.leftFouls>=2) || (s.rightFouls>=2)
  }

  return (
    <>
    <View>
      <View marginBottom="0.5rem" display="flex" style={{gap:'0.5rem', flexWrap:'wrap', alignItems:'flex-end'}}>
        <SelectField label={t('labels.match')} value={matchId} onChange={e=> setMatchId(e.target.value)} size="small">
          <option value="">{t('placeholders.select')}</option>
          {matches.map(m => (<option key={m.id} value={m.id}>{m.heldOn} {m.tournament ?? ''}</option>))}
        </SelectField>
        <TextField label={t('labels.tournament')} value={tournament} onChange={e=> setTournament(e.target.value)} width={dense?"12rem":"16rem"} />
        <Button size="small" onClick={()=> setYtOpen(true)} isDisabled={!tournament?.trim()}>{t('youtube.edit')||'YouTube再生リスト設定'}</Button>
        <TextField label={t('labels.date')} type="date" value={heldOn} onChange={e=> setHeldOn(e.target.value)} width={dense?"10rem":"12rem"} />
        <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12 }}>
          <input type="checkbox" checked={isOfficial} onChange={e=> setIsOfficial(e.target.checked)} disabled={!!matchId} /> {isOfficial ? t('labels.official') : t('labels.practice')}
        </label>
        <SelectField label={t('labels.ourUniversity')} value={ourUniversityId} onChange={e=> setOurUniversityId(e.target.value)} size="small" isDisabled={!!matchId}>
          <option value="">{t('placeholders.unselected')}</option>
          {universities.map(u=> (<option key={u.id} value={u.id}>{u.name}</option>))}
        </SelectField>
        <SelectField label={t('labels.opponentUniversity')} value={opponentUniversityId} onChange={e=> setOpponentUniversityId(e.target.value)} size="small" isDisabled={!!matchId}>
          <option value="">{t('placeholders.unselected')}</option>
          {universities.map(u=> (<option key={u.id} value={u.id}>{u.name}</option>))}
        </SelectField>
        <Button size="small" onClick={openNotes} isDisabled={!matchId}>{t('analysis.playerNotes')||'選手分析'}</Button>
        <Button size="small" variation="primary" onClick={saveAll} isDisabled={bouts.length===0}>{t('actions.saveAll')}</Button>
        {matchId && (
          <Button size="small" variation="link" colorTheme="warning" onClick={()=> setDelModal({ open:true, kind:'match', targetId: matchId, bout: null })}>{t('actions.deleteMatch')}</Button>
        )}
        <Button size="small" variation="link" onClick={()=> setDense(d=> !d)}>{dense? t('actions.switchStandard'):t('actions.switchDense')}</Button>
      </View>
      <View marginBottom="0.25rem" display="flex" style={{gap:'0.5rem', flexWrap:'wrap', alignItems:'center'}}>
        <TextField label={t('labels.searchPlayer')} placeholder={t('placeholders.nameFilter')} value={playerFilter} onChange={e=> setPlayerFilter(e.target.value)} width={dense?"12rem":"16rem"} />
        <SelectField label={t('admin.players.gender')||'性別'} value={playerGenderFilter} onChange={e=> setPlayerGenderFilter(e.target.value as any)} size="small" width={dense?"8rem":"10rem"}>
          <option value="ALL">{t('filters.all')||'すべて'}</option>
          <option value="MEN">{t('gender.MEN')||'男子'}</option>
          <option value="WOMEN">{t('gender.WOMEN')||'女子'}</option>
        </SelectField>
        <div style={{ display:'flex', alignItems:'flex-end', gap:8 }}>
          <TextField label={t('admin.players.newName') || '選手名'} value={quickPlayerName} onChange={e=> setQuickPlayerName(e.target.value)} width={dense?"12rem":"16rem"} />
          <SelectField label={t('admin.players.universityReq') || '大学'} value={quickPlayerUniversityId || (opponentUniversityId || ourUniversityId)} onChange={e=> setQuickPlayerUniversityId(e.target.value)} width={dense?"12rem":"14rem"}>
            <option value="">{t('placeholders.unselected')}</option>
            {universities.map(u=> (<option key={u.id} value={u.id}>{u.name}</option>))}
          </SelectField>
          <Button size="small" onClick={quickAddPlayer} isDisabled={!quickPlayerName.trim() || !(quickPlayerUniversityId || opponentUniversityId || ourUniversityId)}>{t('actions.add')}</Button>
        </div>

        <Button size="small" onClick={loadRefData}>{t('actions.reloadRefs')}</Button>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <label style={{ display:'flex', alignItems:'center', gap:4, fontSize:12 }}>
            <input type="checkbox" checked={allowEncho} onChange={e=> setAllowEncho(e.target.checked)} /> {t('rules.allowEncho')}
          </label>
          <label style={{ display:'flex', alignItems:'center', gap:4, fontSize:12 }}>
            <input type="checkbox" checked={allowHantei} onChange={e=> setAllowHantei(e.target.checked)} /> {t('rules.allowHantei')}
          </label>
          <label style={{ display:'flex', alignItems:'center', gap:4, fontSize:12 }}>
            <input type="checkbox" checked={autoResult} onChange={e=> setAutoResult(e.target.checked)} /> {t('rules.autoResult')}
          </label>
        </div>
      </View>
      {(refError || opMsg) && (
        <div style={{ color: refError? '#b00':'#156a15', fontSize:12, marginBottom:6 }}>
          {refError || opMsg}
        </div>
      )}

      <Table variation="bordered" highlightOnHover style={{ fontSize: dense? 12: 14, lineHeight: dense? 1.15: 1.35 }}>
        <TableHead>
          <TableRow>
            <TableCell as="th" width="16%">{t('columns.leftPlayer')}</TableCell>
            <TableCell as="th" width="16%">{t('columns.first')}</TableCell>
            <TableCell as="th" width="16%">{t('columns.second')}</TableCell>
            <TableCell as="th" width="16%">{t('columns.second')}</TableCell>
            <TableCell as="th" width="16%">{t('columns.first')}</TableCell>
            <TableCell as="th" width="16%">{t('columns.rightPlayer')}</TableCell>
            <TableCell as="th" width="8%">{t('columns.actions')}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>
              <div>
                <label style={{ fontSize:12, color:'#444' }}>{t('placeholders.selectLeft')}</label>
                <Typeahead value={newLeft} onChange={setNewLeft} items={typeaheadItems} width={dense? '14rem':'18rem'} placeholder={t('placeholders.nameFilter')||'選手名を入力'} />
              </div>
            </TableCell>
            <TableCell colSpan={3}>
              <div style={{ color:'#666', fontSize:12 }}>{t('hints.addNewMatch')}</div>
            </TableCell>
            <TableCell>
              <div>
                <label style={{ fontSize:12, color:'#444' }}>{t('placeholders.selectRight')}</label>
                <Typeahead value={newRight} onChange={setNewRight} items={typeaheadItems} width={dense? '14rem':'18rem'} placeholder={t('placeholders.nameFilter')||'選手名を入力'} />
              </div>
            </TableCell>
            <TableCell>
              <Button size="small" onClick={addNewBout} isDisabled={!newLeft || !newRight}>{t('actions.add')}</Button>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedBouts().map((b)=>{
            const s = rows[b.id] ?? { left1:null, left2:null, right1:null, right2:null, leftFouls:0, rightFouls:0 }
            const rowValid = [s.left1, s.left2, s.right1, s.right2].every(ipponValidOrEmpty)
            const hasData = rowHasData(s)
            return (
              <TableRow key={b.id} id={`row-${b.id}`}>
                <TableCell>
                  <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                    <div style={{ fontWeight: focusBoutId===b.id ? 700 : 600, color: focusBoutId===b.id ? '#156a15' : '#2f4f2f', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{nameById[b.ourPlayerId] ?? b.ourPlayerId}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                      <Button size="small" variation="link" title={t('actions.foulMinus')} onClick={()=> setRows(r=> ({...r, [b.id]: { ...s, leftFouls: Math.max(0, (s.leftFouls||0)-1) }}))} style={{ minWidth:22, padding:'0 4px' }}>-</Button>
                      <Badge variation={s.leftFouls>=2? 'warning':'info'} style={{ padding:'0 6px' }}>{s.leftFouls||0}</Badge>
                      <Button size="small" variation="link" title={t('actions.foulPlus')} onClick={()=> setRows(r=> ({...r, [b.id]: { ...s, leftFouls: Math.min(2, (s.leftFouls||0)+1) }}))} style={{ minWidth:22, padding:'0 4px' }}>+</Button>
                    </div>
                    {s.rightFouls>=2 && (
                      <div><Badge variation="warning" style={{ padding:'0 4px' }}>{t('badges.opponentFoulIppon')}</Badge></div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                    <IpponCell value={s.left1} onFocus={()=> setFocusBoutId(b.id)} onChange={(next)=> setRows(r=> ({...r, [b.id]: { ...s, left1: next }}))} targets={safeTargets} methods={safeMethods} />
                </TableCell>
                <TableCell>
                    <IpponCell value={s.left2} onFocus={()=> setFocusBoutId(b.id)} onChange={(next)=> setRows(r=> ({...r, [b.id]: { ...s, left2: next }}))} targets={safeTargets} methods={safeMethods} />
                </TableCell>
                <TableCell>
                    <IpponCell value={s.right2} onFocus={()=> setFocusBoutId(b.id)} onChange={(next)=> setRows(r=> ({...r, [b.id]: { ...s, right2: next }}))} targets={safeTargets} methods={safeMethods} />
                </TableCell>
                <TableCell>
                    <IpponCell value={s.right1} onFocus={()=> setFocusBoutId(b.id)} onChange={(next)=> setRows(r=> ({...r, [b.id]: { ...s, right1: next }}))} targets={safeTargets} methods={safeMethods} />
                </TableCell>
                <TableCell>
                  <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                    <div style={{ fontWeight: focusBoutId===b.id ? 700 : 600, color: focusBoutId===b.id ? '#8a1b1b' : '#4f2f2f', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{nameById[b.opponentPlayerId] ?? b.opponentPlayerId}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                      <Button size="small" variation="link" title={t('actions.foulMinus')} onClick={()=> setRows(r=> ({...r, [b.id]: { ...s, rightFouls: Math.max(0, (s.rightFouls||0)-1) }}))} style={{ minWidth:22, padding:'0 4px' }}>-</Button>
                      <Badge variation={s.rightFouls>=2? 'warning':'info'} style={{ padding:'0 6px' }}>{s.rightFouls||0}</Badge>
                      <Button size="small" variation="link" title={t('actions.foulPlus')} onClick={()=> setRows(r=> ({...r, [b.id]: { ...s, rightFouls: Math.min(2, (s.rightFouls||0)+1) }}))} style={{ minWidth:22, padding:'0 4px' }}>+</Button>
                    </div>
                    {s.leftFouls>=2 && (
                      <div><Badge variation="warning" style={{ padding:'0 4px' }}>{t('badges.foulIppon')}</Badge></div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {!rowValid && (<div style={{ color:'#d17', fontSize:12, marginBottom:4 }}>{t('warnings.incompleteInputs')}</div>)}
                  {rowValid && autoResult && (<div style={{ color:'#666', fontSize:11, marginBottom:4 }}>{t('hints.saveAutoJudgement')}</div>)}
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <Button size="small" onClick={()=> saveRow(b)} isDisabled={!rowValid || savingId===b.id} isLoading={savingId===b.id}>{t('actions.save')}</Button>
                  <Button size="small" variation="link" colorTheme="warning" onClick={()=> setDelModal({ open:true, kind:'bout', targetId: b.id, bout: b })}>{t('actions.delete')}</Button>
                    {!autoResult && (
                      <>
                        <select value={(resultEdit[b.id]?.winType)|| (b.winType ?? '')} onChange={(e)=> setResultEdit(x=> ({...x, [b.id]: { winType: e.target.value, winner: (resultEdit[b.id]?.winner ?? (b.winnerPlayerId? (b.winnerPlayerId===b.ourPlayerId?'our':'opponent') : '') ) as any }}))} style={{ fontSize:12 }}>
                          <option value="">-</option>
                          <option value="IPPON">{t('winType.IPPON')}</option>
                          <option value="NIHON">{t('winType.NIHON')}</option>
                          <option value="ENCHO">{t('winType.ENCHO')}</option>
                          <option value="HANTEI">{t('winType.HANTEI')}</option>
                          <option value="HANSOKU">{t('winType.HANSOKU')}</option>
                          <option value="DRAW">{t('winType.DRAW')}</option>
                        </select>
                        {(resultEdit[b.id]?.winType ?? b.winType) !== 'DRAW' && (
                          <select value={(resultEdit[b.id]?.winner) || (b.winnerPlayerId? (b.winnerPlayerId===b.ourPlayerId?'our':'opponent'): '')} onChange={(e)=> setResultEdit(x=> ({...x, [b.id]: { winType: (resultEdit[b.id]?.winType ?? (b.winType || '')) as any, winner: e.target.value as any }}))} style={{ fontSize:12 }}>
                            <option value="">-</option>
                            <option value="our">{t('team.our')}</option>
                            <option value="opponent">{t('team.opponent')}</option>
                          </select>
                        )}
                        <Button size="small" onClick={()=> setBoutResult(b)} isDisabled={!resultEdit[b.id]?.winType && !b.winType}>{t('resultEditor.set')}</Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </View>
    {ytOpen && (
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1200 }} onClick={()=> setYtOpen(false)}>
        <div style={{ background:'#fff', minWidth:360, maxWidth:720, width:'90%', padding:16, borderRadius:8 }} onClick={e=> e.stopPropagation()}>
          <Heading level={5}>{t('youtube.title')||'大会ごとのYouTube再生リスト'}</Heading>
          <div style={{ fontSize:12, color:'#555', marginTop:4 }}>{t('youtube.help')||'URLまたはプレイリストID（list=...）を入力してください。空にすると未設定になります。'}</div>
          <div style={{ display:'grid', gap:8, marginTop:12 }}>
            <div style={{ display:'grid', gridTemplateColumns:'180px 1fr', gap:8, alignItems:'center' }}>
              <div style={{ fontSize:13 }}>{tournament || '-'}</div>
              <input value={ytUrl} onChange={e=> setYtUrl(e.target.value)} placeholder="https://www.youtube.com/playlist?list=..." style={{ width:'100%', padding:'6px 8px', fontSize:13 }} />
            </div>
          </div>
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:12 }}>
            <Button variation="link" onClick={()=> setYtOpen(false)}>{t('action.cancel')||'キャンセル'}</Button>
            <Button variation="primary" onClick={saveYtForTournament}>{t('actions.save')||'保存'}</Button>
          </div>
        </div>
      </div>
    )}
    {noteOpen && (
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1200 }} onClick={()=> setNoteOpen(false)}>
        <div style={{ background:'#fff', minWidth:360, maxWidth:820, width:'90%', padding:16, borderRadius:8 }} onClick={e=> e.stopPropagation()}>
          <Heading level={5}>{t('analysis.playerNotes')||'選手分析'}</Heading>
          {notesLoading ? (
            <div className="muted" style={{ padding:'12px 0' }}>{t('loading')||'Loading...'}</div>
          ) : (
            <div style={{ display:'grid', gap:8, marginTop:8, overflow:'auto' }}>
              {sortedBouts().map(b=> (
                <div key={b.id} style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, alignItems:'start', border:'1px solid #eee', borderRadius:6, padding:8 }}>
                  <div>
                    <div style={{ fontWeight:600, marginBottom:6 }}>{nameById[b.ourPlayerId] ?? b.ourPlayerId}</div>
                    <textarea rows={3} value={notes[`${b.id}:${b.ourPlayerId}`]||''} onChange={e=> setNotes(m=> ({...m, [`${b.id}:${b.ourPlayerId}`]: e.target.value }))} style={{ width:'100%', fontSize:13, padding:'6px 8px' }} />
                  </div>
                  <div>
                    <div style={{ fontWeight:600, marginBottom:6 }}>{nameById[b.opponentPlayerId] ?? b.opponentPlayerId}</div>
                    <textarea rows={3} value={notes[`${b.id}:${b.opponentPlayerId}`]||''} onChange={e=> setNotes(m=> ({...m, [`${b.id}:${b.opponentPlayerId}`]: e.target.value }))} style={{ width:'100%', fontSize:13, padding:'6px 8px' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:12, position:'sticky', bottom:0, background:'#fff', paddingTop:8 }}>
            <Button variation="link" onClick={()=> setNoteOpen(false)}>{t('action.cancel')||'キャンセル'}</Button>
            <Button variation="primary" onClick={saveNotes} isDisabled={!matchId}>{t('actions.save')||'保存'}</Button>
          </div>
        </div>
      </div>
    )}
    {delModal?.open && (
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1200 }} onClick={()=> setDelModal(null)}>
        <div style={{ background:'#fff', minWidth:320, maxWidth:520, width:'90%', padding:16, borderRadius:8 }} onClick={e=> e.stopPropagation()}>
          <h4 style={{ marginTop:0 }}>{delModal.kind==='bout' ? t('confirm.deleteBoutTitle') : t('confirm.deleteMatchTitle')}</h4>
          <div style={{ color:'#444', marginBottom:12 }}>
            {delModal.kind==='bout' && (<>
              <div>{t('confirm.deleteBoutBody')}</div>
              <div style={{ fontSize:12, color:'#666' }}>{t('confirm.deleteBoutNote')}</div>
            </>)}
            {delModal.kind==='match' && (<>
              <div>{t('confirm.deleteMatchBody')}</div>
              <div style={{ fontSize:12, color:'#666' }}>{t('confirm.deleteMatchNote')}</div>
            </>)}
          </div>
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
            <Button onClick={()=> setDelModal(null)} variation="link">{t('action.cancel')||'Cancel'}</Button>
            <Button variation="warning" onClick={async()=>{
              try{
                if(delModal.kind==='bout' && delModal.bout){ await deleteBoutDeep(delModal.bout) }
                if(delModal.kind==='match'){ await deleteMatchDeep(delModal.targetId) }
                if(delModal.kind==='bout' && delModal.bout){ setBoutsLocal(prev=> prev.filter(x=> x.id!==delModal.bout!.id)); setRows(prev=> { const cp={...prev}; delete cp[delModal.bout!.id]; return cp }) }
                if(delModal.kind==='match'){ setBoutsLocal([]); setRows({}) }
                setDelModal(null); await onSaved()
              }catch(e){ alert(String(e)) }
            }}>{t('action.delete')||'Delete'}</Button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}



















