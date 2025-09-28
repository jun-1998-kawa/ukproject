export function buildTechniqueKey(target?:string, methods?:string[]){
  const mm = (methods||[]).slice().sort()
  return `${target||''}:${mm.join('+')}`
}

// Determine if a method is allowed for a given target Japanese label
// Original rule: GYAKU -> 胴, HIDARI -> 小手, AIKOTE -> 面
export function methodAllowedForTargetJaLabel(methodCode:string, targetLabelJa:string){
  if(!targetLabelJa) return true
  if(methodCode==='GYAKU') return /胴/.test(targetLabelJa)
  if(methodCode==='HIDARI') return /小手/.test(targetLabelJa)
  if(methodCode==='AIKOTE') return /面/.test(targetLabelJa)
  return true
}

