import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { View, Heading, Button, TextField, Table, TableHead, TableRow, TableCell, TableBody, Alert } from '@aws-amplify/ui-react'

type University = { id: string; name: string; shortName?: string|null; code?: string|null; isHome?: boolean }

const listUniversities = `query ListUniversities($limit:Int,$nextToken:String){ listUniversities(limit:$limit,nextToken:$nextToken){ items{ id name shortName code isHome } nextToken } }`
const createUniversityMutation = `mutation CreateUniversity($input: CreateUniversityInput!) { createUniversity(input:$input){ id name shortName code isHome } }`
const updateUniversityMutation = `mutation UpdateUniversity($input: UpdateUniversityInput!) { updateUniversity(input:$input){ id name shortName code isHome } }`
const deleteUniversityMutation = `mutation DeleteUniversity($input: DeleteUniversityInput!) { deleteUniversity(input:$input){ id } }`

export default function UniversitiesAdmin(props:{ apiUrl:string; getToken: ()=> Promise<string|null> }){
  const { t } = useTranslation()
  const { apiUrl, getToken } = props
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string|null>(null)
  const [list, setList] = useState<University[]>([])

  const [filter, setFilter] = useState('')
  const [newName, setNewName] = useState('')
  const [newShort, setNewShort] = useState('')
  const [newCode, setNewCode] = useState('')
  const norm = (s:string)=> s.trim().toLowerCase()
  const nameExists = (name:string, exceptId?:string)=> list.some(u=> u.id!==exceptId && norm(u.name)===norm(name))
  const codeExists = (code?:string|null, exceptId?:string)=> {
    const c = norm(code||''); if(!c) return false; return list.some(u=> u.id!==exceptId && norm(u.code||'')===c)
  }

  async function load(){
    setLoading(true); setError(null)
    try{
      const token = await getToken(); if(!token) return
      let nextToken: string | null = null
      const acc: University[] = []
      do{
        const r: Response = await fetch(apiUrl, { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization': token }, body: JSON.stringify({ query: listUniversities, variables: { limit: 200, nextToken } }) })
        const j: any = await r.json(); if(j.errors) throw new Error(JSON.stringify(j.errors))
        acc.push(...j.data.listUniversities.items)
        nextToken = j.data.listUniversities.nextToken
      } while(nextToken)
      setList(acc)
    }catch(e:any){ setError(String(e?.message ?? e)) }finally{ setLoading(false) }
  }

  useEffect(()=>{ load() }, [])

  const visible = useMemo(()=> list.filter(u => (
    u.name.toLowerCase().includes(filter.toLowerCase()) || (u.shortName||'').toLowerCase().includes(filter.toLowerCase()) || (u.code||'').toLowerCase().includes(filter.toLowerCase())
  )), [list, filter])

  async function add(){
    if(!newName.trim()) return
    if(nameExists(newName)){ setError(t('admin.universities.errors.duplicateName')); return }
    if(codeExists(newCode)){ setError(t('admin.universities.errors.duplicateCode')); return }
    setLoading(true); setError(null)
    try{
      const token = await getToken(); if(!token) return
      const input:any = { name: newName.trim() }
      if(newShort.trim()) input.shortName = newShort.trim()
      if(newCode.trim()) input.code = newCode.trim()
      const r: Response = await fetch(apiUrl, { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization': token }, body: JSON.stringify({ query: createUniversityMutation, variables: { input } }) })
      const j:any = await r.json(); if(j.errors) throw new Error(JSON.stringify(j.errors))
      setNewName(''); setNewShort(''); setNewCode('')
      await load()
    }catch(e:any){ setError(String(e?.message ?? e)) }finally{ setLoading(false) }
  }

  async function save(u: University){
    setLoading(true); setError(null)
    try{
      const token = await getToken(); if(!token) return
      const input:any = { id: u.id, name: u.name.trim(), shortName: (u.shortName??'')||null, code: (u.code??'')||null, isHome: !!u.isHome }
      if(!input.name){ setError(t('admin.universities.errors.requiredName')); return }
      if(nameExists(input.name, u.id)){ setError(t('admin.universities.errors.duplicateName')); return }
      if(codeExists(input.code, u.id)){ setError(t('admin.universities.errors.duplicateCode')); return }
      const r: Response = await fetch(apiUrl, { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization': token }, body: JSON.stringify({ query: updateUniversityMutation, variables: { input } }) })
      const j:any = await r.json(); if(j.errors) throw new Error(JSON.stringify(j.errors))
      // ensure single home: if setting this as home, unset others
      if(!!u.isHome){
        for(const other of list){
          if(other.id!==u.id && other.isHome){
            await fetch(apiUrl, { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization': token }, body: JSON.stringify({ query: updateUniversityMutation, variables: { input: { id: other.id, isHome: false } } }) })
          }
        }
      }
      await load()
    }catch(e:any){ setError(String(e?.message ?? e)) }finally{ setLoading(false) }
  }

  async function remove(id: string){
    if(!confirm(t('confirm.delete'))) return
    setLoading(true); setError(null)
    try{
      const token = await getToken(); if(!token) return
      const r: Response = await fetch(apiUrl, { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization': token }, body: JSON.stringify({ query: deleteUniversityMutation, variables: { input: { id } } }) })
      const j:any = await r.json(); if(j.errors) throw new Error(JSON.stringify(j.errors))
      await load()
    }catch(e:any){ setError(String(e?.message ?? e)) }finally{ setLoading(false) }
  }

  return (
    <View>
      <Heading level={5}>{t('admin.universities.title')}</Heading>
      <View marginBottom="0.5rem" display="flex" style={{gap:'0.5rem', flexWrap:'wrap'}}>
        <TextField label={t('admin.universities.search')} placeholder={t('placeholders.nameFilter')} value={filter} onChange={e=> setFilter(e.target.value)} width="16rem" />
        <TextField label={t('admin.universities.newName')} value={newName} onChange={e=> setNewName(e.target.value)} width="16rem" />
        <TextField label={t('admin.universities.shortName')} value={newShort} onChange={e=> setNewShort(e.target.value)} width="10rem" />
        <TextField label={t('admin.universities.code')} value={newCode} onChange={e=> setNewCode(e.target.value)} width="8rem" />
        <Button onClick={add} isLoading={loading} isDisabled={!newName.trim()}>{t('actions.add')}</Button>
        <Button variation="link" onClick={load} isLoading={loading}>{t('action.reload')}</Button>
      </View>
      {error && <Alert variation="error" marginTop="0.5rem">{error}</Alert>}
      <Table highlightOnHover marginTop="0.5rem">
        <TableHead>
          <TableRow>
            <TableCell as="th" width="40%">{t('admin.universities.th.name')}</TableCell>
            <TableCell as="th" width="20%">{t('admin.universities.th.shortName')}</TableCell>
            <TableCell as="th" width="20%">{t('admin.universities.th.code')}</TableCell>
            <TableCell as="th" width="10%">{t('admin.universities.th.home')||'Home'}</TableCell>
            <TableCell as="th" width="10%">{t('columns.actions')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {visible.map(u => (
            <TableRow key={u.id}>
              <TableCell>
                <TextField label={t('admin.universities.name')||'Name'} labelHidden value={u.name} onChange={e=> { const v=e.target.value; setList(list=> list.map(x=> x.id===u.id? {...x, name:v}: x)) }} />
              </TableCell>
              <TableCell>
                <TextField label={t('admin.universities.shortName')||'Short Name'} labelHidden value={u.shortName ?? ''} onChange={e=> { const v=e.target.value; setList(list=> list.map(x=> x.id===u.id? {...x, shortName:v||null}: x)) }} />
              </TableCell>
              <TableCell>
                <TextField label={t('admin.universities.code')||'Code'} labelHidden value={u.code ?? ''} onChange={e=> { const v=e.target.value; setList(list=> list.map(x=> x.id===u.id? {...x, code:v||null}: x)) }} />
              </TableCell>
              <TableCell>
                <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12 }}>
                  <input type="checkbox" checked={!!u.isHome} onChange={e=> { const v=e.target.checked; setList(list=> list.map(x=> x.id===u.id? {...x, isHome:v}: x)) }} />
                  {t('admin.universities.home')||'Home'}
                </label>
              </TableCell>
              <TableCell>
                <Button size="small" onClick={()=> save(u)} isLoading={loading}>{t('actions.save')}</Button>
                <Button size="small" variation="destructive" onClick={()=> remove(u.id)} isLoading={loading} marginLeft="0.5rem">{t('actions.delete')}</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </View>
  )
}
