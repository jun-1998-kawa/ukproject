import { useEffect, useMemo, useRef, useState } from 'react'

export type TypeaheadItem = { id: string; label: string; searchKey?: string }

export default function Typeahead(props: {
  value: string
  onChange: (id: string)=> void
  items: TypeaheadItem[]
  placeholder?: string
  width?: string
  maxItems?: number
}){
  const { value, onChange, items, placeholder, width='16rem', maxItems=20 } = props
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [hover, setHover] = useState(-1)
  const inputRef = useRef<HTMLInputElement|null>(null)
  const containerRef = useRef<HTMLDivElement|null>(null)

  useEffect(()=>{
    function onDocClick(e: MouseEvent){
      if(containerRef.current && !containerRef.current.contains(e.target as any)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return ()=> document.removeEventListener('mousedown', onDocClick)
  },[])

  const selected = useMemo(()=> items.find(x=> x.id===value) || null, [items, value])
  useEffect(()=>{ setQuery(selected?.label || '') }, [selected?.label])

  const normalized = (s:string)=> s.normalize('NFKC').toLowerCase()
  const filtered = useMemo(()=>{
    const q = normalized(query.trim())
    if(!q) return items.slice(0, maxItems)
    const res = [] as TypeaheadItem[]
    for(const it of items){
      const key = (it.searchKey || it.label)
      if(normalized(key).includes(q)) res.push(it)
      if(res.length>=maxItems) break
    }
    return res
  }, [items, query, maxItems])

  function pick(it: TypeaheadItem){ onChange(it.id); setOpen(false) }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>){
    if(!open && (e.key==='ArrowDown' || e.key==='Enter')){ setOpen(true); setHover(0); return }
    if(!open) return
    if(e.key==='ArrowDown'){ e.preventDefault(); setHover(h=> Math.min(filtered.length-1, h+1)) }
    else if(e.key==='ArrowUp'){ e.preventDefault(); setHover(h=> Math.max(0, h-1)) }
    else if(e.key==='Enter'){ e.preventDefault(); const it = filtered[hover]; if(it) pick(it) }
    else if(e.key==='Escape'){ setOpen(false) }
  }

  return (
    <div ref={containerRef} style={{ position:'relative', width }}>
      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
        <input ref={inputRef} value={query} placeholder={placeholder}
          onFocus={()=> setOpen(true)}
          onChange={e=> { setQuery(e.target.value); setOpen(true); setHover(0) }}
          onKeyDown={onKeyDown}
          style={{ width:'100%', padding:'6px 8px', fontSize:13, border:'1px solid #ccc', borderRadius:6 }} />
        {value && (
          <button onClick={()=> { onChange(''); setQuery(''); inputRef.current?.focus() }} title="Clear" style={{ border:'1px solid #ddd', background:'#fafafa', borderRadius:6, padding:'4px 6px' }}>×</button>
        )}
      </div>
      {open && (
        <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:50, background:'#fff', maxHeight:220, overflowY:'auto', border:'1px solid #ddd', borderRadius:6, marginTop:4, boxShadow:'0 2px 8px rgba(0,0,0,0.1)' }}>
          {filtered.length===0 && (<div style={{ padding:'6px 8px', color:'#666', fontSize:12 }}>No matches</div>)}
          {filtered.map((it,idx)=> (
            <div key={it.id} onMouseEnter={()=> setHover(idx)} onMouseDown={(e)=> e.preventDefault()} onClick={()=> pick(it)}
              style={{ padding:'6px 8px', fontSize:13, background: hover===idx? '#eef6ff':'#fff', cursor:'pointer', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{it.label}</div>
          ))}
        </div>
      )}
    </div>
  )
}

