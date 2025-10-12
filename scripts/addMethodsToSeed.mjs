import fs from 'node:fs'
const path = 'seed/methods.json'
const raw = fs.readFileSync(path,'utf8')
const arr = JSON.parse(raw)
function upsert(code, nameJa, nameEn, order){
  const i = arr.findIndex(x=> x.code===code)
  if(i>=0){ arr[i].nameJa = nameJa; arr[i].nameEn = nameEn; if(order!=null) arr[i].order = order; arr[i].active = true; return 'updated' }
  arr.push({ code, nameJa, nameEn, order, active: true }); return 'added'
}
const r1 = upsert('KATATE','片手','One-hand', 14)
const r2 = upsert('MOROTE','諸手','Two-hands', 15)
arr.sort((a,b)=> (a.order||999)-(b.order||999) || a.code.localeCompare(b.code))
fs.writeFileSync(path, JSON.stringify(arr, null, 2)+'\n', 'utf8')
console.log('methods.json updated:', r1, r2)
