#!/usr/bin/env node
// Convert Figma variables (exported via MCP) to CSS variables
// Usage:
//   FIGMA_VARIABLES_JSON=./figma_variables.json npm run tokens:css
//   or: node scripts/figma-to-css.mjs --in ./figma_variables.json --mode Base

import fs from 'node:fs'
import path from 'node:path'

function parseArgs() {
  const args = process.argv.slice(2)
  const out = { in: process.env.FIGMA_VARIABLES_JSON, mode: process.env.FIGMA_MODE || 'Base' }
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i]
    if (a === '--in' || a === '-i') out.in = args[i + 1]
    if (a === '--mode' || a === '-m') out.mode = args[i + 1]
  }
  if (!out.in) {
    console.error('Missing input: provide FIGMA_VARIABLES_JSON or --in <path>')
    process.exit(1)
  }
  return out
}

function kebabize(name) {
  return String(name)
    .replace(/\s+/g, '-')
    .replace(/[\/_.]+/g, '-')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()
}

function rgbaToHex({ r, g, b, a }) {
  const to255 = (v) => Math.round((v ?? 0) * 255)
  const hex = (v) => v.toString(16).padStart(2, '0')
  const rr = hex(to255(r))
  const gg = hex(to255(g))
  const bb = hex(to255(b))
  if (a == null || a === 1) return `#${rr}${gg}${bb}`
  const aa = hex(to255(a))
  return `#${rr}${gg}${bb}${aa}`
}

function resolveModeName(collection, modeId) {
  if (!collection?.modes) return 'Base'
  const m = collection.modes.find((x) => x.modeId === modeId || x.nodeId === modeId || x.name === modeId)
  return m?.name || collection.modes[0]?.name || 'Base'
}

function main() {
  const { in: inPath, mode } = parseArgs()
  const raw = fs.readFileSync(inPath, 'utf-8')
  const data = JSON.parse(raw)

  // Expected MCP JSON shape (typical): {
  //   collections: { [id]: { name, modes: [{modeId|nodeId, name}] } },
  //   variables: { [varId]: { name, resolvedType, valuesByMode: { [modeId]: { r,g,b,a } | number | string }, collectionId } }
  // }
  const collections = data.collections || {}
  const variables = data.variables || data.meta?.variables || {}

  const entries = []
  for (const [id, v] of Object.entries(variables)) {
    const collection = collections[v.collectionId]
    if (!v || (v.resolvedType !== 'COLOR' && v.type !== 'COLOR')) continue
    // pick mode
    let modeId = Object.keys(v.valuesByMode || {})[0]
    if (collection) {
      const preferred = (collection.modes || []).find((m) => m.name.toLowerCase() === mode.toLowerCase())
      if (preferred && (v.valuesByMode?.[preferred.modeId] || v.valuesByMode?.[preferred.nodeId])) {
        modeId = preferred.modeId || preferred.nodeId
      }
    }
    const val = v.valuesByMode?.[modeId]
    if (!val) continue
    const hex = typeof val === 'object' && val?.r != null ? rgbaToHex(val) : String(val)
    const name = kebabize(v.name)
    entries.push({ name, value: hex, collection: collection?.name, modeName: resolveModeName(collection, modeId) })
  }

  const lines = []
  lines.push('/* Generated from Figma variables via MCP. Do not edit manually. */')
  lines.push(':root {')
  for (const e of entries) {
    lines.push(`  --fig-${e.name}: ${e.value};`)
  }
  lines.push('}')

  // Optional mappings → project tokens
  const map = (needle) => entries.find((e) => e.name.includes(needle))?.value
  const mappings = {
    'color-primary': map('primary-500') || map('primary') || map('brand-primary') || map('brand'),
    'color-primary-600': map('primary-600') || map('brand-600'),
    'color-primary-700': map('primary-700') || map('brand-700'),
    'bg': map('bg') || map('background') || map('surface-0'),
    'surface': map('surface') || map('surface-1') || map('layer-1'),
    'surface-2': map('surface-2') || map('layer-2'),
    'text': map('text') || map('fg') || '#0c111d',
    'text-muted': map('text-muted') || map('fg-muted') || '#3b4453',
    'border': map('border') || map('outline') || '#d7dce5',
    'success': map('success-500') || map('success') || '#27c59a',
    'warning': map('warning-500') || map('warning') || '#ffb020',
    'danger': map('danger-500') || map('danger') || '#ff5d62'
  }
  const override = []
  override.push(':root {')
  for (const [k, v] of Object.entries(mappings)) if (v) override.push(`  --${k}: ${v};`)
  override.push('}')

  const outPath = path.join('web', 'src', 'styles', 'tokens.generated.css')
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, lines.concat('\n', override).join('\n'))
  console.log(`Wrote ${outPath} with ${entries.length} color variables.`)
}

main()

