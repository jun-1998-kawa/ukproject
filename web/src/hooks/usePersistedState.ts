import { useEffect, useState } from 'react'

export default function usePersistedState<T>(key: string, initial: T){
  const [state, setState] = useState<T>(initial)
  useEffect(()=>{
    try{
      const raw = localStorage.getItem(key)
      if(raw!=null){ setState(JSON.parse(raw)) }
    }catch{}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[])
  useEffect(()=>{ try{ localStorage.setItem(key, JSON.stringify(state)) }catch{} }, [key, state])
  return [state, setState] as const
}

