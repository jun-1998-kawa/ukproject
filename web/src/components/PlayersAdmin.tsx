import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { View, Heading, Button, TextField, Table, TableHead, TableRow, TableCell, TableBody, Alert, SelectField, Badge } from '@aws-amplify/ui-react'

type Player = { id: string; name: string; nameKana?: string|null; universityId?: string|null; enrollYear?: number|null; grade?: number|null; gradeOverride?: number|null; programYears?: number|null; studentNo?: string|null; dan?: string|null; preferredStance?: string|null; isActive?: boolean|null; notes?: string|null }
type University = { id: string; name: string; shortName?: string|null }

const listPlayersPage = `query ListPlayers($limit:Int,$nextToken:String){ listPlayers(limit:$limit,nextToken:$nextToken){ items{ id name nameKana universityId enrollYear grade gradeOverride programYears studentNo dan preferredStance isActive notes } nextToken } }`
const listUniversities = `query ListUniversities($limit:Int,$nextToken:String){ listUniversities(limit:$limit,nextToken:$nextToken){ items{ id name shortName } nextToken } }`
const createPlayerMutation = `mutation CreatePlayer($input: CreatePlayerInput!) { createPlayer(input:$input){ id name nameKana universityId enrollYear grade gradeOverride programYears studentNo dan preferredStance isActive notes } }`
const updatePlayerMutation = `mutation UpdatePlayer($input: UpdatePlayerInput!) { updatePlayer(input:$input){ id name nameKana universityId enrollYear grade gradeOverride programYears studentNo dan preferredStance isActive notes } }`
const deletePlayerMutation = `mutation DeletePlayer($input: DeletePlayerInput!) { deletePlayer(input:$input){ id } }`

export default function PlayersAdmin(props:{ apiUrl:string; getToken: ()=> Promise<string|null> }){
  const { t } = useTranslation()
  const { apiUrl, getToken } = props
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string|null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [universities, setUniversities] = useState<University[]>([])
  const [filter, setFilter] = useState('')
  const [newName, setNewName] = useState('')
  const [newUniversityId, setNewUniversityId] = useState('')
  const [newEnrollYear, setNewEnrollYear] = useState<string>('')
  const [newDan, setNewDan] = useState('')
  const [newStance, setNewStance] = useState('')
  const [newKana, setNewKana] = useState('')
  const [newStudentNo, setNewStudentNo] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [newIsActive, setNewIsActive] = useState(true)

  // Quick Add University modal state
  const [uniModal, setUniModal] = useState<{open:boolean, name:string, shortName:string, code:string, error:string|null}>({ open:false, name:'', shortName:'', code:'', error:null })

  // UniqueIndex helpers (backend B案)
  const createUniqueIndex = async (pk:string, sk:string, token:string)=>{
    const q = `mutation CreateUniqueIndex($input: CreateUniqueIndexInput!){ createUniqueIndex(input:$input){ pk sk } }`
    const r: Response = await fetch(apiUrl, { method:'POST', headers:{'Content-Type':'application/json','Authorization': token }, body: JSON.stringify({ query:q, variables:{ input:{ pk, sk } } }) })
    const j:any = await r.json(); if(j.errors) throw new Error('UniqueIndex: '+JSON.stringify(j.errors))
  }
  const deleteUniqueIndex = async (pk:string, sk:string, token:string)=>{
    const q = `mutation DeleteUniqueIndex($input: DeleteUniqueIndexInput!){ deleteUniqueIndex(input:$input){ pk sk } }`
    const r: Response = await fetch(apiUrl, { method:'POST', headers:{'Content-Type':'application/json','Authorization': token }, body: JSON.stringify({ query:q, variables:{ input:{ pk, sk } } }) })
    const j:any = await r.json(); if(j.errors) throw new Error('UniqueIndex: '+JSON.stringify(j.errors))
  }
  const normalize = (s:string)=> s.trim().toLowerCase()

  async function quickAddUniversity(){
    setUniModal(m=> ({...m, error:null}))
    try{
      const token = await getToken(); if(!token) { setUniModal(m=> ({...m, error:t('errors.notSignedIn')})); return }
      const name = uniModal.name.trim(); if(!name){ setUniModal(m=> ({...m, error:t('admin.universities.errors.requiredName')})); return }
      const shortName = uniModal.shortName.trim()||undefined
      const code = uniModal.code.trim()||undefined
      // reserve unique keys
      await createUniqueIndex('UNIVERSITY', `name:${normalize(name)}`, token)
      if(code) await createUniqueIndex('UNIVERSITY', `code:${normalize(code)}`, token)
      // create university
      const q = `mutation CreateUniversity($input: CreateUniversityInput!){ createUniversity(input:$input){ id name } }`
      const r: Response = await fetch(apiUrl, { method:'POST', headers:{'Content-Type':'application/json','Authorization': token }, body: JSON.stringify({ query:q, variables:{ input:{ name, shortName, code } } }) })
      const j:any = await r.json(); if(j.errors) throw new Error(JSON.stringify(j.errors))
      const newId = j.data.createUniversity.id as string
      // refresh list and select
      await load()
      setNewUniversityId(newId)
      setUniModal({ open:false, name:'', shortName:'', code:'', error:null })
    }catch(e:any){
      const msg = String(e?.message ?? e)
      if(msg.includes('UniqueIndex') || msg.includes('ConditionalCheckFailed') || msg.includes('already exists')){
        setUniModal(m=> ({...m, error: t('admin.universities.errors.duplicateName')}))
      }else{
        setUniModal(m=> ({...m, error: msg}))
      }
    }
  }

  async function load(){
    setLoading(true); setError(null)
    try{
      const token = await getToken(); if(!token) return
      let nextToken: string | null = null
      const acc: Player[] = []
      do{
        const r: Response = await fetch(apiUrl, { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization': token }, body: JSON.stringify({ query: listPlayersPage, variables: { limit: 200, nextToken } }) })
        const j: any = await r.json(); if(j.errors) throw new Error(JSON.stringify(j.errors))
        acc.push(...j.data.listPlayers.items)
        nextToken = j.data.listPlayers.nextToken
      } while(nextToken)
      setPlayers(acc)
      let nextU: string | null = null
      const uni: University[] = []
      do{
        const ur: Response = await fetch(apiUrl, { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization': token }, body: JSON.stringify({ query: listUniversities, variables: { limit: 200, nextToken: nextU } }) })
        const uj:any = await ur.json(); if(uj.errors) throw new Error(JSON.stringify(uj.errors))
        uni.push(...uj.data.listUniversities.items)
        nextU = uj.data.listUniversities.nextToken
      } while(nextU)
      setUniversities(uni)
    } catch(e:any){ setError(String(e?.message ?? e)) } finally { setLoading(false) }
  }

  useEffect(()=>{ load() }, [])

  const visible = useMemo(()=> players.filter(p => (p.name.toLowerCase().includes(filter.toLowerCase()) || (p.nameKana||'').toLowerCase().includes(filter.toLowerCase()))), [players, filter])

  function currentAcademicYear(today = new Date()){
    const y = today.getFullYear();
    const isAfterApril = (today.getMonth()+1) >= 4;
    return isAfterApril ? y : y - 1;
  }
  function calcGrade(enrollYear?: number|null){
    if(!enrollYear) return null;
    const g = currentAcademicYear() - enrollYear + 1;
    return g > 0 && g < 10 ? g : null;
  }

  async function add(){
    if(!newName.trim()) return
    if(!newUniversityId){ setError(t('errors.universityRequired')); return }
    setLoading(true); setError(null)
    try{
      const token = await getToken(); if(!token) return
      const enrollYear = Number(newEnrollYear) || undefined
      const grade = calcGrade(enrollYear) ?? undefined
      const input:any = { name: newName.trim() }
      if(newUniversityId) input.universityId = newUniversityId
      if(enrollYear) input.enrollYear = enrollYear
      if(grade) input.grade = grade
      if(newDan) input.dan = newDan
      if(newStance) input.preferredStance = newStance
      if(newKana) input.nameKana = newKana
      if(newStudentNo) input.studentNo = newStudentNo
      if(newNotes) input.notes = newNotes
      input.isActive = newIsActive
      const r: Response = await fetch(apiUrl, { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization': token }, body: JSON.stringify({ query: createPlayerMutation, variables: { input } }) })
      const j: any = await r.json(); if(j.errors) throw new Error(JSON.stringify(j.errors))
      setNewName(''); setNewUniversityId(''); setNewEnrollYear(''); setNewDan(''); setNewStance(''); setNewKana(''); setNewStudentNo(''); setNewNotes(''); setNewIsActive(true)
      await load()
    } catch(e:any){ setError(String(e?.message ?? e)) } finally { setLoading(false) }
  }

  async function save(p: Player){
    setLoading(true); setError(null)
    try{
      const token = await getToken(); if(!token) return
      const input:any = { id:p.id, name: p.name.trim(), nameKana: p.nameKana ?? null, universityId: p.universityId ?? null, enrollYear: p.enrollYear ?? null, grade: p.grade ?? null, gradeOverride: p.gradeOverride ?? null, programYears: p.programYears ?? null, studentNo: p.studentNo ?? null, dan: p.dan ?? null, preferredStance: p.preferredStance ?? null, isActive: p.isActive ?? null, notes: p.notes ?? null }
      const r: Response = await fetch(apiUrl, { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization': token }, body: JSON.stringify({ query: updatePlayerMutation, variables: { input } }) })
      const j:any = await r.json(); if(j.errors) throw new Error(JSON.stringify(j.errors))
      await load()
    } catch(e:any){ setError(String(e?.message ?? e)) } finally { setLoading(false) }
  }

  async function remove(id: string){
    if(!confirm(t('confirm.delete'))) return
    setLoading(true); setError(null)
    try{
      const token = await getToken(); if(!token) return
      const r: Response = await fetch(apiUrl, { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization': token }, body: JSON.stringify({ query: deletePlayerMutation, variables: { input: { id } } }) })
      const j:any = await r.json(); if(j.errors) throw new Error(JSON.stringify(j.errors))
      await load()
    } catch(e:any){ setError(String(e?.message ?? e)) } finally { setLoading(false) }
  }

  return (
    <>
    <View>
      <Heading level={5}>{t('admin.players.title')}</Heading>
      <View marginBottom="0.5rem" display="flex" style={{gap:'0.5rem', flexWrap:'wrap'}}>
        <TextField label={t('admin.players.search')} placeholder={t('placeholders.nameFilter')} value={filter} onChange={e=> setFilter(e.target.value)} width="16rem" />
        <TextField label={t('admin.players.newName')} value={newName} onChange={e=> setNewName(e.target.value)} width="16rem" />
        <TextField label={t('admin.players.kana')} value={newKana} onChange={e=> setNewKana(e.target.value)} width="12rem" />
        <TextField label={t('admin.players.studentNo')} value={newStudentNo} onChange={e=> setNewStudentNo(e.target.value)} width="12rem" />
        <SelectField label={t('admin.players.universityReq')} value={newUniversityId} onChange={e=> setNewUniversityId(e.target.value)} width="14rem">
          <option value="">{t('placeholders.unselected')}</option>
          {universities.map(u=> (<option key={u.id} value={u.id}>{u.name}</option>))}
        </SelectField>
        <Button onClick={()=> setUniModal({ open:true, name:'', shortName:'', code:'', error:null })}>
          + {t('nav.universities')}
        </Button>
        <TextField label={t('admin.players.enrollYear')} type="number" value={newEnrollYear} onChange={e=> setNewEnrollYear(e.target.value)} width="9rem" />
        <TextField label={t('admin.players.dan')} value={newDan} onChange={e=> setNewDan(e.target.value)} width="9rem" />
        <SelectField label={t('admin.players.stance')} value={newStance} onChange={e=> setNewStance(e.target.value)} width="10rem">
          <option value="">{t('placeholders.unselected')}</option>
          <option value="JODAN">{t('stance.JODAN')}</option>
          <option value="CHUDAN">{t('stance.CHUDAN')}</option>
          <option value="NITOU_SHO">{t('stance.NITOU_SHO')}</option>
          <option value="NITOU_GYAKU">{t('stance.NITOU_GYAKU')}</option>
        </SelectField>
        <SelectField label={t('admin.players.active')} value={String(newIsActive)} onChange={e=> setNewIsActive(e.target.value==='true')} width="8rem">
          <option value="true">{t('admin.players.activeTrue')}</option>
          <option value="false">OB/OG</option>
        </SelectField>
        <TextField label={t('admin.players.notes')} value={newNotes} onChange={e=> setNewNotes(e.target.value)} width="16rem" />
        <Button onClick={add} isLoading={loading} isDisabled={!newName.trim() || !newUniversityId}>{t('actions.add')}</Button>
        <Button variation="link" onClick={load} isLoading={loading}>{t('action.reload')}</Button>
      </View>
      {error && <Alert variation="error" marginTop="0.5rem">{error}</Alert>}
      <div id="players-admin-table" style={{ overflowX:'auto' }}>
      <Table highlightOnHover marginTop="0.5rem" style={{ fontSize: 12, lineHeight: 1.2, minWidth: 1400 }}>
        <TableHead>
          <TableRow>
            <TableCell as="th" width="360">{t('admin.players.th.name')}</TableCell>
            <TableCell as="th" width="240">{t('admin.players.th.kana')}</TableCell>
            <TableCell as="th" width="160">{t('admin.players.th.studentNo')}</TableCell>
            <TableCell as="th" width="200">{t('admin.players.th.university')}</TableCell>
            <TableCell as="th" width="100">{t('admin.players.th.enrollYear')}</TableCell>
            <TableCell as="th" width="80">{t('admin.players.th.grade')}</TableCell>
            <TableCell as="th" width="100">{t('admin.players.th.dan')}</TableCell>
            <TableCell as="th" width="110">{t('admin.players.th.stance')}</TableCell>
            <TableCell as="th" width="90">{t('admin.players.th.active')}</TableCell>
            <TableCell as="th" width="320">{t('admin.players.th.notes')}</TableCell>
            <TableCell as="th" width="160">{t('columns.actions')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {visible.map(p => (
            <TableRow key={p.id}>
              <TableCell>
                <TextField size="small" label={t('admin.players.name')||'Name'} labelHidden value={p.name} onChange={e=> { const v=e.target.value; setPlayers(list=> list.map(x=> x.id===p.id? {...x, name:v}: x)) }} width="100%" />
              </TableCell>
              <TableCell>
                <TextField size="small" label={t('admin.players.kana')||'Kana'} labelHidden value={p.nameKana ?? ''} onChange={e=> { const v=e.target.value; setPlayers(list=> list.map(x=> x.id===p.id? {...x, nameKana:v||null}: x)) }} width="100%" />
              </TableCell>
              <TableCell>
                <TextField size="small" label={t('admin.players.studentNo')||'Student No.'} labelHidden value={p.studentNo ?? ''} onChange={e=> { const v=e.target.value; setPlayers(list=> list.map(x=> x.id===p.id? {...x, studentNo:v||null}: x)) }} width="100%" />
              </TableCell>
              <TableCell>
                <SelectField size="small" label={t('admin.players.university')||'University'} labelHidden value={p.universityId ?? ''} onChange={e=> { const v=e.target.value; setPlayers(list=> list.map(x=> x.id===p.id? {...x, universityId: v||null}: x)) }} width="100%">
                  <option value="">{t('placeholders.unselected')}</option>
                  {universities.map(u=> (<option key={u.id} value={u.id}>{u.name}</option>))}
                </SelectField>
              </TableCell>
              <TableCell>
                <TextField size="small" label={t('admin.players.enrollYear')||'Enroll Year'} labelHidden type="number" value={String(p.enrollYear ?? '')} onChange={e=> { const v=e.target.value; setPlayers(list=> list.map(x=> x.id===p.id? {...x, enrollYear: v? Number(v): null}: x)) }} width="100%" />
              </TableCell>
              <TableCell>
                <Badge variation="info">{calcGrade(p.enrollYear) ?? '-'}</Badge>
              </TableCell>
              <TableCell>
                <TextField size="small" label={t('admin.players.dan')||'Dan'} labelHidden value={p.dan ?? ''} onChange={e=> { const v=e.target.value; setPlayers(list=> list.map(x=> x.id===p.id? {...x, dan: v||null}: x)) }} width="100%" />
              </TableCell>
              <TableCell>
                <SelectField size="small" label={t('admin.players.stance')||'Stance'} labelHidden value={p.preferredStance ?? ''} onChange={e=> { const v=e.target.value; setPlayers(list=> list.map(x=> x.id===p.id? {...x, preferredStance: v||null}: x)) }} width="100%">
                  <option value="">{t('placeholders.unselected')}</option>
                  <option value="JODAN">{t('stance.JODAN')}</option>
                  <option value="CHUDAN">{t('stance.CHUDAN')}</option>
                  <option value="NITOU_SHO">{t('stance.NITOU_SHO')}</option>
                  <option value="NITOU_GYAKU">{t('stance.NITOU_GYAKU')}</option>
                </SelectField>
              </TableCell>
              <TableCell>
                <SelectField size="small" label={t('admin.players.active')||'Active'} labelHidden value={String(p.isActive ?? true)} onChange={e=> { const v=e.target.value==='true'; setPlayers(list=> list.map(x=> x.id===p.id? {...x, isActive: v}: x)) }} width="100%">
                  <option value="true">{t('admin.players.activeTrue')}</option>
                  <option value="false">OB/OG</option>
                </SelectField>
              </TableCell>
              <TableCell>
                <TextField size="small" label={t('admin.players.notes')||'Notes'} labelHidden value={p.notes ?? ''} onChange={e=> { const v=e.target.value; setPlayers(list=> list.map(x=> x.id===p.id? {...x, notes: v||null}: x)) }} width="100%" />
              </TableCell>
              <TableCell>
                <Button size="small" onClick={()=> save(players.find(x=> x.id===p.id)!)} isLoading={loading}>{t('actions.save')}</Button>
                <Button size="small" variation="destructive" onClick={()=> remove(p.id)} isLoading={loading} marginLeft="0.5rem">{t('actions.delete')}</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <style>{`
        #players-admin-table input, #players-admin-table select, #players-admin-table textarea { font-size: 12px; padding: 2px 6px; height: 28px; }
        #players-admin-table .amplify-badge { font-size: 11px; }
      `}</style>
      </div>
    </View>
    {uniModal.open && (
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }} onClick={()=> setUniModal(m=> ({...m, open:false }))}>
        <div style={{ background:'#fff', minWidth:320, maxWidth:560, width:'90%', padding:16, borderRadius:8 }} onClick={e=> e.stopPropagation()}>
          <Heading level={5}>{t('nav.universities')}</Heading>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:8 }}>
            <TextField label={t('admin.universities.newName')} value={uniModal.name} onChange={e=> setUniModal(m=> ({...m, name:e.target.value}))} width="16rem" />
            <TextField label={t('admin.universities.shortName')} value={uniModal.shortName} onChange={e=> setUniModal(m=> ({...m, shortName:e.target.value}))} width="10rem" />
            <TextField label={t('admin.universities.code')} value={uniModal.code} onChange={e=> setUniModal(m=> ({...m, code:e.target.value}))} width="8rem" />
          </div>
          {uniModal.error && (<div style={{ color:'#b00', fontSize:12, marginTop:8 }}>{uniModal.error}</div>)}
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:12 }}>
            <Button variation="link" onClick={()=> setUniModal(m=> ({...m, open:false }))}>{t('action.cancel') || 'Cancel'}</Button>
            <Button variation="primary" onClick={quickAddUniversity}>{t('actions.add')}</Button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
