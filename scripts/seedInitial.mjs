import { readFile } from 'node:fs/promises';

async function gql(url, token, query, variables) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': token },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

async function getApi() {
  const outputs = JSON.parse(await readFile('amplify_outputs.json', 'utf-8'));
  const url = outputs?.data?.url;
  if (!url) throw new Error('data.url missing in amplify_outputs.json');
  const token = process.env.SEED_AUTH_TOKEN;
  if (!token) throw new Error('SEED_AUTH_TOKEN env missing');
  return { url, token };
}

async function listItems(url, token, listName, fields) {
  const q = `query { ${listName} { items { ${fields.join(' ')} } } }`;
  const data = await gql(url, token, q, {});
  return data[listName]?.items ?? [];
}

async function findOne(url, token, listName, field, value) {
  const items = await listItems(url, token, listName, ['id', field]);
  const found = items.find((it) => it[field] === value);
  return found?.id || null;
}

async function create(url, token, model, input) {
  const m = `mutation($input: Create${model}Input!){ create${model}(input:$input){ id } }`;
  const data = await gql(url, token, m, { input });
  return data[`create${model}`].id;
}

async function upsertUniversity(url, token, { name, shortName, code }) {
  const existing = await findOne(url, token, 'listUniversities', 'name', name);
  if (existing) return existing;
  return await create(url, token, 'University', { name, shortName, code });
}

async function upsertVenue(url, token, { name, address }) {
  const existing = await findOne(url, token, 'listVenues', 'name', name);
  if (existing) return existing;
  return await create(url, token, 'Venue', { name, address });
}

async function upsertPlayer(url, token, { universityId, name, grade, enrollYear, dan, preferredStance }) {
  const players = await listItems(url, token, 'listPlayers', ['id', 'name', 'universityId']);
  const found = players.find((p) => p.name === name && p.universityId === universityId)?.id;
  if (found) return found;
  return await create(url, token, 'Player', { universityId, name, grade, enrollYear, dan, preferredStance });
}

function techniqueKey(target, methods) {
  return `${target}:${[...methods].sort().join('+')}`;
}

async function main() {
  const { url, token } = await getApi();

  // 1) Masters are already seeded.

  // 2) Universities
  const ourUniId = await upsertUniversity(url, token, { name: '本学', shortName: 'UT', code: 'UT' });
  const oppUniId = await upsertUniversity(url, token, { name: '相手大学A', shortName: 'OPPA', code: 'OPPA' });

  // 3) Venue
  const venueId = await upsertVenue(url, token, { name: '学内体育館', address: 'キャンパス内' });

  // 4) Players (minimal)
  const pYamada = await upsertPlayer(url, token, { universityId: ourUniId, name: '山田 太郎', grade: 3, enrollYear: 2023, dan: '三段', preferredStance: 'CHUDAN' });
  const pSato   = await upsertPlayer(url, token, { universityId: ourUniId, name: '佐藤 花子', grade: 2, enrollYear: 2024, dan: '二段', preferredStance: 'CHUDAN' });
  const pSuzuki = await upsertPlayer(url, token, { universityId: oppUniId, name: '鈴木 次郎', grade: 3, enrollYear: 2023, dan: '二段', preferredStance: 'CHUDAN' });
  const pTanaka = await upsertPlayer(url, token, { universityId: oppUniId, name: '田中 美咲', grade: 1, enrollYear: 2025, dan: '初段', preferredStance: 'CHUDAN' });

  // 5) Match
  const matches = await listItems(url, token, 'listMatches', ['id', 'heldOn', 'opponentUniversityId']);
  let matchId = matches.find((m) => m.heldOn === '2025-08-31' && m.opponentUniversityId === oppUniId)?.id;
  if (!matchId) {
    matchId = await create(url, token, 'Match', { heldOn: '2025-08-31', tournament: '秋季リーグ 第1戦', venueId, ourUniversityId: ourUniId, opponentUniversityId: oppUniId, note: '初期データ' });
  }

  // 6) Bout 1 (山田 vs 鈴木)
  const boutsAll = await listItems(url, token, 'listBouts', ['id', 'matchId', 'ourPlayerId', 'opponentPlayerId']);
  let bout1Id = boutsAll.find((b) => b.matchId === matchId && b.ourPlayerId === pYamada && b.opponentPlayerId === pSuzuki)?.id;
  if (!bout1Id) {
    bout1Id = await create(url, token, 'Bout', { matchId, ourPlayerId: pYamada, opponentPlayerId: pSuzuki, ourPosition: 'SENPO', ourStance: 'CHUDAN', opponentStance: 'CHUDAN', winType: 'NIHON', winnerPlayerId: pYamada });
  }

  // 7) Points for Bout 1 (山田 2本)
  const nowIso = new Date().toISOString();
  const createPoint = async (input) => create(url, token, 'Point', input);
  await createPoint({
    boutId: bout1Id,
    tSec: 45,
    scorerPlayerId: pYamada,
    opponentPlayerId: pSuzuki,
    target: 'KOTE',
    methods: ['KAESHI'],
    position: 'SENPO',
    scorerStance: 'CHUDAN',
    opponentStance: 'CHUDAN',
    judgement: 'REGULAR',
    isDecisive: false,
    techniqueKey: techniqueKey('KOTE', ['KAESHI']),
    recordedAt: nowIso,
    version: 1,
  });
  await createPoint({
    boutId: bout1Id,
    tSec: 180,
    scorerPlayerId: pYamada,
    opponentPlayerId: pSuzuki,
    target: 'MEN',
    methods: ['DEBANA'],
    position: 'SENPO',
    scorerStance: 'CHUDAN',
    opponentStance: 'CHUDAN',
    judgement: 'REGULAR',
    isDecisive: true,
    techniqueKey: techniqueKey('MEN', ['DEBANA']),
    recordedAt: nowIso,
    version: 1,
  });

  // 8) Bout 2 (佐藤 vs 田中)
  let bout2Id = boutsAll.find((b) => b.matchId === matchId && b.ourPlayerId === pSato && b.opponentPlayerId === pTanaka)?.id;
  if (!bout2Id) {
    bout2Id = await create(url, token, 'Bout', { matchId, ourPlayerId: pSato, opponentPlayerId: pTanaka, ourPosition: 'JIHO', ourStance: 'CHUDAN', opponentStance: 'CHUDAN', winType: 'IPPON', winnerPlayerId: pTanaka });
  }
  await createPoint({
    boutId: bout2Id,
    tSec: 95,
    scorerPlayerId: pTanaka,
    opponentPlayerId: pSato,
    target: 'MEN',
    methods: ['HIKI'],
    position: 'JIHO',
    scorerStance: 'CHUDAN',
    opponentStance: 'CHUDAN',
    judgement: 'REGULAR',
    isDecisive: true,
    techniqueKey: techniqueKey('MEN', ['HIKI']),
    recordedAt: nowIso,
    version: 1,
  });

  console.log('Initial data seeding complete.');
}

main().catch((e) => {
  console.error('Seed initial failed:', e.message || e);
  process.exit(1);
});
