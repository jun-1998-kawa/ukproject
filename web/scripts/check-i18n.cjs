/*
  Simple i18n guard (CommonJS):
  - Fails if any non-ASCII characters appear in TS/TSX outside locales folder
  - Fails if any t('key.path') used in code is missing in en translation
*/
const fs = require('fs')
const path = require('path')

const SRC_DIR = path.join(__dirname, '..', 'src')
const EN_JSON = path.join(SRC_DIR, 'locales', 'en', 'translation.json')

function walk(dir, files = []){
  for(const entry of fs.readdirSync(dir, { withFileTypes: true })){
    if(entry.name.startsWith('.')) continue
    const p = path.join(dir, entry.name)
    if(entry.isDirectory()) walk(p, files)
    else files.push(p)
  }
  return files
}

function hasKey(obj, pathStr){
  const parts = pathStr.split('.')
  let cur = obj
  for(const k of parts){
    if(cur == null || !(k in cur)) return false
    cur = cur[k]
  }
  return true
}

let enText = fs.readFileSync(EN_JSON, 'utf8')
if(enText.charCodeAt(0) === 0xFEFF){ enText = enText.slice(1) }
const en = JSON.parse(enText)

let nonAsciiIssues = []
let missingKeyIssues = []

const files = walk(SRC_DIR).filter(f=> /\.(ts|tsx)$/.test(f) && !f.includes(path.join('src','locales')))
const tKeyRegex = /\bt\(\s*(["'`])([^"'`]+)\1\s*\)/g
for(const file of files){
  let text = fs.readFileSync(file, 'utf8')
  // strip BOM
  if(text.charCodeAt(0) === 0xFEFF){ text = text.slice(1) }
  const rel = path.relative(process.cwd(), file)
  // 1) Non-ASCII scan
  const lines = text.split(/\r?\n/)
  lines.forEach((line, idx)=>{
    // Flag only Japanese Kana/Kanji ranges to avoid false positives
    if(/[\u3040-\u30FF\u4E00-\u9FFF]/.test(line)){
      nonAsciiIssues.push(`${rel}:${idx+1}: ${line.trim()}`)
    }
  })
  // 2) t('...') key existence
  let m
  while((m = tKeyRegex.exec(text))){
    const key = m[2]
    if(!hasKey(en, key)){
      const upto = text.slice(0, m.index)
      const line = upto.split(/\r?\n/).length
      missingKeyIssues.push(`${rel}:${line}: missing key '${key}'`)
    }
  }
}

if(nonAsciiIssues.length){
  console.error('[i18n] Non-ASCII occurrences found:')
  console.error(nonAsciiIssues.join('\n'))
}
if(missingKeyIssues.length){
  console.error('[i18n] Missing translation keys:')
  console.error(missingKeyIssues.join('\n'))
}

if(nonAsciiIssues.length || missingKeyIssues.length){
  process.exit(1)
}
console.log('i18n check passed')
