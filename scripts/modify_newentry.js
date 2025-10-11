const fs=require('fs');
const p='web/src/components/NewEntryMode.tsx';
let s=fs.readFileSync(p,'utf8');
// 1) import useMemo
if(!/from 'react'\s*\r?\nimport \{ useMemo \} from 'react'/.test(s)){
  s=s.replace(/^import \{[^}]+\} from 'react'\s*\r?\n/, m=> m+"import { useMemo } from 'react'\r\n");
}
// 2) quick states
s=s.replace(/(const \[notesLoading, setNotesLoading\] = useState\(false\)\s*\r?\n)/, "$1  // Quick add player states\r\n  const [quickPlayerName, setQuickPlayerName] = useState('')\r\n  const [quickPlayerUniversityId, setQuickPlayerUniversityId] = useState<string>('')\r\n");
// 3) helper block after createBoutMutation
const anchorIdx = s.indexOf('const createBoutMutation = `mutation CreateBout');
if(anchorIdx>=0){
  const lineEnd = s.indexOf('\n', anchorIdx);
  const insertAt = s.indexOf('\n', lineEnd+1)>=0? lineEnd+1 : lineEnd;
  const helper = "\n  // Merge provided players map with fetched playersEx for reliable name resolution\n  const nameById = useMemo(()=>{\n    const m = { ...players };\n    for(const p of playersEx){ if(p.id && p.name && !m[p.id]) m[p.id] = p.name }\n    return m;\n  }, [players, playersEx]);\n\n  // Quick add minimal player (name + university)\n  async function quickAddPlayer(){\n    const name = quickPlayerName.trim();\n    const uniId = (quickPlayerUniversityId || opponentUniversityId || ourUniversityId || '').trim();\n    if(!name || !uniId){ alert(t('alerts.nameAndUniversityRequired') || '選手名と大学を選んでください'); return }\n    try{\n      const token = await getToken(); if(!token) return;\n      const q = \"mutation CreatePlayer($input: CreatePlayerInput!) { createPlayer(input:$input){ id name universityId } }\";\n      const r = await fetch(apiUrl, { method:'POST', headers:{ 'Content-Type':'application/json','Authorization': token }, body: JSON.stringify({ query: q, variables: { input: { name, universityId: uniId } } }) });\n      const j = await r.json(); if(j.errors) throw new Error(JSON.stringify(j.errors));\n      const created = j.data.createPlayer;\n      setPlayersEx(list => [...list, created]);\n      setQuickPlayerName('');\n      if(!quickPlayerUniversityId) setQuickPlayerUniversityId(uniId);\n      setOpMsg(t('messages.playerCreated') || '選手を作成しました');\n    } catch(e){ setRefError(String(e?.message ?? e)) }\n  }\n";
  s = s.slice(0, insertAt) + helper + s.slice(insertAt);
}
// 4) insert UI block after search player TextField
const searchIdx = s.indexOf("label={t('labels.searchPlayer')}");
if(searchIdx>=0){
  const closeIdx = s.indexOf('/>', searchIdx);
  if(closeIdx>0){
    const insertAt = closeIdx+2;
    const ui = "\n        <div style={{ display:'flex', alignItems:'flex-end', gap:8 }}>"+
              "\n          <TextField label={t('admin.players.newName') || '選手名'} value={quickPlayerName} onChange={e=> setQuickPlayerName(e.target.value)} width={dense?\"12rem\":\"16rem\"} />"+
              "\n          <SelectField label={t('admin.players.universityReq') || '大学'} value={quickPlayerUniversityId || (opponentUniversityId || ourUniversityId)} onChange={e=> setQuickPlayerUniversityId(e.target.value)} width={dense?\"12rem\":\"14rem\"}>"+
              "\n            <option value=\"\">{t('placeholders.unselected')}</option>"+
              "\n            {universities.map(u=> (<option key={u.id} value={u.id}>{u.name}</option>))}"+
              "\n          </SelectField>"+
              "\n          <Button size=\"small\" onClick={quickAddPlayer} isDisabled={!quickPlayerName.trim() || !(quickPlayerUniversityId || opponentUniversityId || ourUniversityId)}>{t('actions.add')}</Button>"+
              "\n        </div>\n";
    s = s.slice(0, insertAt) + ui + s.slice(insertAt);
  }
}
// 5) replace name renderers
s = s.replace(/\{players\[b\.ourPlayerId\] \?\? b\.ourPlayerId\}/g, '{nameById[b.ourPlayerId] ?? b.ourPlayerId}');
s = s.replace(/\{players\[b\.opponentPlayerId\] \?\? b\.opponentPlayerId\}/g, '{nameById[b.opponentPlayerId] ?? b.opponentPlayerId}');
fs.writeFileSync(p, s, 'utf8');
console.log('OK');
