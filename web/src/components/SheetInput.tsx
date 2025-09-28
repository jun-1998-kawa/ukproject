import { useCallback, useMemo, useRef, useState } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef } from 'ag-grid-community'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import { Button, View, Heading } from '@aws-amplify/ui-react'

type Master = { code: string; nameJa?: string; nameEn?: string }
type Bout = { id: string; ourPlayerId: string; opponentPlayerId: string; ourPosition?: string; ourStance?: string; opponentStance?: string }

type Row = {
  _existing?: boolean
  tSec: number | ''
  scorer: 'our' | 'opponent'
  judgement: 'REGULAR' | 'ENCHO' | 'HANSOKU'
  target: string | ''
  methods: string // comma separated codes
}

export default function SheetInput(props: {
  bout: Bout
  existingPoints: { tSec: number; target?: string | null; methods?: string[] | null; scorerPlayerId?: string | null; judgement?: string | null }[]
  masters: { targets: Master[]; methods: Master[] }
  labelJa: { target: Record<string, string>; method: Record<string, string> }
  apiUrl: string
  getToken: () => Promise<string | null>
  onSaved?: () => Promise<void> | void
}) {
  const { bout, existingPoints, masters, labelJa, apiUrl, getToken, onSaved } = props
  const gridRef = useRef<AgGridReact<Row>>(null)

  const existingRows: Row[] = useMemo(() => {
    return (existingPoints || []).map((p) => ({
      _existing: true,
      tSec: p.tSec,
      scorer: p.scorerPlayerId === bout.ourPlayerId ? 'our' : 'opponent',
      judgement: (p.judgement as any) ?? 'REGULAR',
      target: p.target ?? '',
      methods: (p.methods ?? []).join(',')
    }))
  }, [existingPoints, bout.ourPlayerId])

  const [rows, setRows] = useState<Row[]>([
    ...existingRows,
    ...new Array(5).fill(0).map(() => ({ _existing: false, tSec: 60, scorer: 'our', judgement: 'REGULAR', target: '', methods: '' } as Row))
  ])

  const targetOptions = useMemo(() => masters.targets.map((t) => t.code), [masters.targets])
  const methodOptions = useMemo(() => masters.methods.map((m) => m.code), [masters.methods])

  const colDefs = useMemo<ColDef<Row>[]>(() => [
    { headerName: 'Time(s)', field: 'tSec', width: 100, editable: (p) => !p.data._existing, valueParser: (p) => {
        const v = Number(p.newValue); return Number.isFinite(v) && v >= 0 ? v : ''
      }
    },
    { headerName: 'Scorer', field: 'scorer', width: 110, editable: (p) => !p.data._existing, cellEditor: 'agSelectCellEditor', cellEditorParams: { values: ['our', 'opponent'] },
      valueFormatter: (p) => p.value === 'our' ? 'Our' : 'Opp.'
    },
    { headerName: 'Judgement', field: 'judgement', width: 130, editable: (p) => !p.data._existing, cellEditor: 'agSelectCellEditor', cellEditorParams: { values: ['REGULAR','ENCHO','HANSOKU'] } },
    { headerName: 'Target', field: 'target', width: 140, editable: (p) => !p.data._existing, cellEditor: 'agSelectCellEditor', cellEditorParams: { values: targetOptions },
      valueFormatter: (p) => (p.value && labelJa.target[p.value]) ? labelJa.target[p.value] : (p.value ?? '')
    },
    { headerName: 'Method(s)', field: 'methods', flex: 1, editable: (p) => !p.data._existing,
      tooltipValueGetter: (p) => p.value,
      valueFormatter: (p) => (String(p.value || '')).split(/[\s,、，]+/).filter(Boolean).map((c) => labelJa.method[c] ?? c).join(', ')
    }
  ], [labelJa.method, labelJa.target, methodOptions, targetOptions])

  const addBlankRows = useCallback((count = 5) => {
    setRows((prev) => ([...prev, ...new Array(count).fill(0).map(() => ({ _existing: false, tSec: 60, scorer: 'our', judgement: 'REGULAR', target: '', methods: '' }))]))
    setTimeout(() => gridRef.current?.api.ensureIndexVisible(rows.length), 0)
  }, [rows.length])

  const replaceNewWithParsed = useCallback((text: string) => {
    // Allow paste of CSV/TSV: tSec,scorer,target,methods,judgement
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    if (lines.length === 0) return
    const parsed: Row[] = lines.map((l) => {
      const parts = l.split(/[\t,]+/)
      const tSec = Number(parts[0]);
      const scorer = (parts[1] || 'our').toLowerCase().startsWith('o') ? 'opponent' : 'our'
      const target = parts[2] || ''
      const methods = parts[3] || ''
      const judgement = (parts[4] as any) || 'REGULAR'
      return { _existing: false, tSec: Number.isFinite(tSec) ? tSec : ('' as any), scorer, target, methods, judgement }
    })
    setRows((prev) => ([...existingRows, ...parsed]))
  }, [existingRows])

  const onCellValueChanged = useCallback((e: any) => {
    // keep state in sync with grid
    setRows(e.api.getDisplayedRowCount() ? e.api.getModel().rowsToDisplay.map((r: any) => r.data) : rows)
  }, [rows])

  async function saveNewRows() {
    const newRows = rows.filter((r) => !r._existing)
      .filter((r) => r.judgement === 'HANSOKU' || (r.tSec !== '' && r.target && String(r.methods).trim() && (r.scorer === 'our' || r.scorer === 'opponent')))
    if (newRows.length === 0) return
    const token = await getToken(); if (!token) return
    for (const r of newRows) {
      const scorerPlayerId = r.scorer === 'our' ? bout.ourPlayerId : bout.opponentPlayerId
      const opponentPlayerId = r.scorer === 'our' ? bout.opponentPlayerId : bout.ourPlayerId
      const isFoul = r.judgement === 'HANSOKU'
      const base: any = {
        boutId: bout.id,
        tSec: Number(r.tSec) || 0,
        scorerPlayerId,
        opponentPlayerId,
        position: bout.ourPosition ?? null,
        scorerStance: r.scorer === 'our' ? (bout.ourStance ?? null) : (bout.opponentStance ?? null),
        opponentStance: r.scorer === 'our' ? (bout.opponentStance ?? null) : (bout.ourStance ?? null),
        judgement: r.judgement,
        isDecisive: false,
        recordedAt: new Date().toISOString(),
        version: 1
      }
      const methods = String(r.methods || '').split(/[\s,、，]+/).filter(Boolean)
      const input = isFoul
        ? { ...base, techniqueKey: 'HANSOKU' }
        : { ...base, target: r.target, methods, techniqueKey: techniqueKey(r.target, methods) }
      await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': token },
        body: JSON.stringify({ query: createPointMutation, variables: { input } })
      }).then((res) => res.json()).then((json) => { if (json.errors) throw new Error(JSON.stringify(json.errors)) })
    }
    // refresh
    await onSaved?.()
  }

  function techniqueKey(target: string, methods: string[]) {
    if (!target || methods.length === 0) return ''
    return `${target}:${methods.join('+')}`
  }

  const createPointMutation = `mutation CreatePoint($input: CreatePointInput!) { createPoint(input:$input) { id } }`

  // simple text area paste helper
  const [pasteText, setPasteText] = useState('')

  return (
    <View>
      <Heading level={5}>Sheet Entry</Heading>
      <div className="ag-theme-alpine" style={{ height: 420, width: '100%', marginTop: 8 }}>
        <AgGridReact<Row>
          ref={gridRef as any}
          rowData={rows}
          columnDefs={colDefs}
          defaultColDef={{ resizable: true, sortable: false, editable: true }}
          suppressDragLeaveHidesColumns
          onCellValueChanged={onCellValueChanged}
          enableRangeSelection
          enableCellTextSelection
          ensureDomOrder
          stopEditingWhenCellsLoseFocus
        />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button onClick={() => addBlankRows(10)}>+10 rows</Button>
        <Button variation="primary" onClick={saveNewRows}>Save New Rows</Button>
        <span style={{ color: '#666' }}>Paste CSV/TSV: tSec, scorer(our/opponent), target, methods, judgement</span>
      </div>
      <textarea
        value={pasteText}
        onChange={(e) => setPasteText(e.target.value)}
        onPaste={(e) => {
          // let default paste go to grid if focused; this is a helper only
        }}
        placeholder="Optional: paste lines here then click 'Use Text'"
        rows={3}
        style={{ width: '100%', marginTop: 8 }}
      />
      <div style={{ display:'flex', gap:8, marginTop:4 }}>
        <Button onClick={() => replaceNewWithParsed(pasteText)}>Use Text</Button>
        <Button onClick={() => setPasteText('')} variation="link">Clear</Button>
      </div>
    </View>
  )
}

