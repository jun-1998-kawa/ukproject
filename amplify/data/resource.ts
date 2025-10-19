import { a, defineData, type ClientSchema } from "@aws-amplify/backend";
import { aiCoach } from "../functions/aiCoach/resource.ts";

// Enums (string-based for flexibility)
const TargetValues = ["MEN", "KOTE", "DO", "TSUKI"] as const;
const MethodValues = ["SURIAGE","KAESHI","NUKI","DEBANA","HIKI","HARAI","KATSUGI","RENZOKU"] as const;
const StanceValues = ["JODAN","CHUDAN","NITOU_SHO","NITOU_GYAKU"] as const;
const PositionValues = ["SENPO","JIHO","GOSHO","CHUKEN","SANSHO","FUKUSHO","TAISHO"] as const;
const WinTypeValues = ["IPPON","NIHON","HANSOKU","HANTEI"] as const;
const PointJudgementValues = ["REGULAR","ENCHO","HANSOKU"] as const;

const schema = a.schema({
  // ---- Custom types for AI integration ----
  AiResponse: a.customType({
    text: a.string().required(),
    conversationId: a.string(),
    model: a.string(),
  }),
  AiAskInput: a.customType({
    question: a.string().required(),
    payload: a.json().required(),
    conversationId: a.string(),
  }),
  aiSummarize: a.mutation()
    .arguments({ payload: a.json().required() })
    .returns(a.ref("AiResponse"))
    .authorization((allow)=>[
      allow.groups(["ADMINS","COACHES","ANALYSTS"]),
    ])
    .handler(a.handler.function(aiCoach)),
  aiAsk: a.mutation()
    .arguments({ input: a.ref("AiAskInput").required() })
    .returns(a.ref("AiResponse"))
    .authorization((allow)=>[
      allow.groups(["ADMINS","COACHES","ANALYSTS"]),
    ])
    .handler(a.handler.function(aiCoach)),
  University: a.model({
    name: a.string().required(),
    shortName: a.string(),
    code: a.string(),
    isHome: a.boolean().default(false),
    players: a.hasMany("Player", "universityId"),
    homeMatches: a.hasMany("Match", "ourUniversityId"),
    opponentMatches: a.hasMany("Match", "opponentUniversityId"),
  }).authorization((allow)=>[
    allow.groups(["ADMINS","COACHES"]).to(["create","update","delete","read"]),
    allow.groups(["ANALYSTS","VIEWERS"]).to(["read"]),
  ]),

  Venue: a.model({
    name: a.string().required(),
    address: a.string(),
    matches: a.hasMany("Match", "venueId"),
  }).authorization((allow)=>[
    allow.groups(["ADMINS","COACHES"]).to(["create","update","delete","read"]),
    allow.groups(["ANALYSTS","VIEWERS"]).to(["read"]),
  ]),

  Player: a.model({
    universityId: a.id().required(),
    university: a.belongsTo("University","universityId"),
    name: a.string().required(),
    nameKana: a.string(),
    gender: a.string(),
    grade: a.integer(),
    enrollYear: a.integer(),
    gradeOverride: a.integer(),
    programYears: a.integer(),
    studentNo: a.string(),
    dan: a.string(),
    preferredStance: a.string(),
    isActive: a.boolean().default(true),
    notes: a.string(),
    ourBouts: a.hasMany("Bout","ourPlayerId"),
    opponentBouts: a.hasMany("Bout","opponentPlayerId"),
    wonBouts: a.hasMany("Bout","winnerPlayerId"),
    scoredPoints: a.hasMany("Point","scorerPlayerId"),
    concededPoints: a.hasMany("Point","opponentPlayerId"),
    awardedExchanges: a.hasMany("Exchange","awardedToPlayerId"),
    actions: a.hasMany("Action","actorPlayerId"),
    analyses: a.hasMany("PlayerAnalysis","playerId"),
  }).secondaryIndexes((idx)=>[
    idx("universityId").queryField("listPlayersByUniversity"),
    idx("name").queryField("listPlayersByName"),
    idx("studentNo").queryField("getPlayerByStudentNo"),
  ]).authorization((allow)=>[
    allow.groups(["ADMINS","COACHES"]).to(["create","update","delete","read"]),
    allow.groups(["ANALYSTS","VIEWERS"]).to(["read"]),
  ]),

  TargetMaster: a.model({
    code: a.string().required(),
    nameJa: a.string().required(),
    nameEn: a.string().required(),
    order: a.integer(),
    active: a.boolean().required().default(true),
  }).identifier(["code"]).authorization((allow)=>[
    allow.groups(["ADMINS","COACHES"]).to(["create","update","delete","read"]),
    allow.groups(["ANALYSTS","VIEWERS"]).to(["read"]),
  ]),

  MethodMaster: a.model({
    code: a.string().required(),
    nameJa: a.string().required(),
    nameEn: a.string().required(),
    order: a.integer(),
    active: a.boolean().required().default(true),
  }).identifier(["code"]).authorization((allow)=>[
    allow.groups(["ADMINS","COACHES"]).to(["create","update","delete","read"]),
    allow.groups(["ANALYSTS","VIEWERS"]).to(["read"]),
  ]),

  PositionMaster: a.model({
    code: a.string().required(),
    nameJa: a.string().required(),
    nameEn: a.string().required(),
    order: a.integer(),
    active: a.boolean().required().default(true),
  }).identifier(["code"]).authorization((allow)=>[
    allow.groups(["ADMINS","COACHES"]).to(["create","update","delete","read"]),
    allow.groups(["ANALYSTS","VIEWERS"]).to(["read"]),
  ]),

  TechniqueDictionary: a.model({
    code: a.string().required(),
    target: a.string().required(),
    method: a.string().required(),
    nameJa: a.string().required(),
    nameEn: a.string().required(),
    aliases: a.string().array(),
    active: a.boolean().required().default(true),
  }).identifier(["code"]).authorization((allow)=>[
    allow.groups(["ADMINS","COACHES"]).to(["create","update","delete","read"]),
    allow.groups(["ANALYSTS","VIEWERS"]).to(["read"]),
  ]),

  Match: a.model({
    heldOn: a.date().required(),
    tournament: a.string(),
    // Official match vs. practice/friendly flag
    isOfficial: a.boolean().required().default(true),
    venueId: a.id(),
    venue: a.belongsTo("Venue","venueId"),
    ourUniversityId: a.id().required(),
    ourUniversity: a.belongsTo("University","ourUniversityId"),
    opponentUniversityId: a.id().required(),
    opponentUniversity: a.belongsTo("University","opponentUniversityId"),
    note: a.string(),
    videoUrl: a.string(),
    videoPlaylist: a.string(),
    bouts: a.hasMany("Bout","matchId"),
  }).secondaryIndexes((idx)=>[
    idx("heldOn").queryField("listMatchesByDate"),
    idx("opponentUniversityId").queryField("listMatchesByOpponent"),
  ]).authorization((allow)=>[
    allow.groups(["ADMINS","COACHES"]).to(["create","update","delete","read"]),
    allow.groups(["ANALYSTS","VIEWERS"]).to(["read"]),
  ]),

  Bout: a.model({
    matchId: a.id().required(),
    match: a.belongsTo("Match","matchId"),
    ourPlayerId: a.id().required(),
    ourPlayer: a.belongsTo("Player","ourPlayerId"),
    opponentPlayerId: a.id().required(),
    opponentPlayer: a.belongsTo("Player","opponentPlayerId"),
    ourPosition: a.string(),
    ourStance: a.string(),
    opponentStance: a.string(),
    startAt: a.datetime(),
    endAt: a.datetime(),
    winnerPlayerId: a.id(),
    winnerPlayer: a.belongsTo("Player","winnerPlayerId"),
    winType: a.string(),
    videoUrl: a.string(),
    videoTimestamp: a.string(),
    points: a.hasMany("Point","boutId"),
    exchanges: a.hasMany("Exchange","boutId"),
    actions: a.hasMany("Action","boutId"),
    analyses: a.hasMany("BoutAnalysis","boutId"),
  }).secondaryIndexes((idx)=>[
    idx("matchId").queryField("listBoutsByMatch"),
    idx("ourPlayerId").queryField("listBoutsByOurPlayer"),
    idx("opponentPlayerId").queryField("listBoutsByOpponentPlayer"),
  ]).authorization((allow)=>[
    allow.groups(["ADMINS","COACHES"]).to(["create","update","delete","read"]),
    allow.groups(["ANALYSTS","VIEWERS"]).to(["read"]),
  ]),

  Point: a.model({
    boutId: a.id().required(),
    bout: a.belongsTo("Bout","boutId"),
    tSec: a.integer().required(),
    scorerPlayerId: a.id().required(),
    scorer: a.belongsTo("Player","scorerPlayerId"),
    opponentPlayerId: a.id().required(),
    opponent: a.belongsTo("Player","opponentPlayerId"),

    // Optional for foul-only ippon
    target: a.string(),
    methods: a.string().array(),
    sequenceLen: a.integer(),
    sequenceTargets: a.string().array(),
    isMutual: a.boolean(),

    position: a.string(),
    scorerStance: a.string(),
    opponentStance: a.string(),
    judgement: a.string(),
    isDecisive: a.boolean(),
    techniqueKey: a.string(),

    exchangeKey: a.string(),
    version: a.integer().required().default(1),
    recordedAt: a.datetime().required(),
  }).secondaryIndexes((idx)=>[
    idx("boutId").sortKeys(["tSec"]).queryField("listPointsByBout"),
    idx("scorerPlayerId").sortKeys(["tSec"]).queryField("listPointsByScorer"),
    idx("target").sortKeys(["tSec"]).queryField("listPointsByTarget"),
    idx("techniqueKey").sortKeys(["tSec"]).queryField("listPointsByTechnique"),
  ]).authorization((allow)=>[
    allow.groups(["ADMINS","COACHES"]).to(["create","update","delete","read"]),
    allow.groups(["ANALYSTS","VIEWERS"]).to(["read"]),
  ]),

  Exchange: a.model({
    boutId: a.id().required(),
    bout: a.belongsTo("Bout","boutId"),
    startSec: a.integer().required(),
    endSec: a.integer(),
    isMutual: a.boolean(),
    awardedToPlayerId: a.id(),
    awardedTo: a.belongsTo("Player","awardedToPlayerId"),
    sequenceLen: a.integer(),
    version: a.integer().required().default(1),
    actions: a.hasMany("Action","exchangeId"),
  }).secondaryIndexes((idx)=>[
    idx("boutId").sortKeys(["startSec"]).queryField("listExchangesByBout"),
  ]).authorization((allow)=>[
    allow.groups(["ADMINS","COACHES"]).to(["create","update","delete","read"]),
    allow.groups(["ANALYSTS","VIEWERS"]).to(["read"]),
  ]),

  Action: a.model({
    exchangeId: a.id(),
    exchange: a.belongsTo("Exchange","exchangeId"),
    boutId: a.id().required(),
    bout: a.belongsTo("Bout","boutId"),
    actorPlayerId: a.id().required(),
    actor: a.belongsTo("Player","actorPlayerId"),
    tSec: a.integer().required(),
    step: a.integer(),
    target: a.string().required(),
    methods: a.string().array().required(),
    role: a.enum(["ATTACK","COUNTER","DEFENSE"]),
    isPoint: a.boolean(),
    version: a.integer().required().default(1),
  }).secondaryIndexes((idx)=>[
    idx("exchangeId").sortKeys(["step","tSec"]).queryField("listActionsByExchange"),
    idx("actorPlayerId").sortKeys(["tSec"]).queryField("listActionsByActor"),
  ]).authorization((allow)=>[
    allow.groups(["ADMINS","COACHES"]).to(["create","update","delete","read"]),
    allow.groups(["ANALYSTS","VIEWERS"]).to(["read"]),
  ]),

  AggregatePlayerTargetDaily: a.model({
    playerId: a.id().required(),
    date: a.string().required(),
    target: a.string().required(),
    count: a.integer().required().default(0),
  }).identifier(["playerId","date","target"]).secondaryIndexes((idx)=>[
    idx("playerId").sortKeys(["date"]).queryField("listAggTargetByPlayerDate"),
    idx("date").sortKeys(["playerId"]).queryField("listAggTargetByDate"),
  ]).authorization((allow)=>[
    allow.groups(["ADMINS","COACHES","ANALYSTS"]).to(["create","update","read"]),
    allow.groups(["VIEWERS"]).to(["read"]),
  ]),

  AggregatePlayerMethodDaily: a.model({
    playerId: a.id().required(),
    date: a.string().required(),
    method: a.string().required(),
    count: a.integer().required().default(0),
  }).identifier(["playerId","date","method"]).secondaryIndexes((idx)=>[
    idx("playerId").sortKeys(["date"]).queryField("listAggMethodByPlayerDate"),
    idx("date").sortKeys(["playerId"]).queryField("listAggMethodByDate"),
  ]).authorization((allow)=>[
    allow.groups(["ADMINS","COACHES","ANALYSTS"]).to(["create","update","read"]),
    allow.groups(["VIEWERS"]).to(["read"]),
  ]),

  // Qualitative Analysis Models for structured coaching comments
  BoutAnalysis: a.model({
    boutId: a.id().required(),
    bout: a.belongsTo("Bout","boutId"),
    subjectPlayerId: a.id().required(), // Which player this analysis is about (ourPlayer or opponentPlayer)
    subjectPlayer: a.belongsTo("Player","subjectPlayerId"),
    category: a.enum(["STRENGTH","WEAKNESS","TACTICAL","MENTAL","TECHNICAL","OTHER"]),
    content: a.string().required(),
    importance: a.enum(["HIGH","MEDIUM","LOW"]),
    tags: a.string().array(),
    recordedAt: a.datetime().required(),
    recordedBy: a.string(),
  }).secondaryIndexes((idx)=>[
    idx("boutId").sortKeys(["recordedAt"]).queryField("listBoutAnalysisByBout"),
    idx("subjectPlayerId").sortKeys(["recordedAt"]).queryField("listBoutAnalysisBySubject"),
  ]).authorization((allow)=>[
    allow.groups(["ADMINS","COACHES","ANALYSTS"]).to(["create","update","delete","read"]),
    allow.groups(["VIEWERS"]).to(["read"]),
  ]),

  PlayerAnalysis: a.model({
    playerId: a.id().required(),
    player: a.belongsTo("Player","playerId"),
    category: a.enum(["STRENGTH","WEAKNESS","TACTICAL","MENTAL","TECHNICAL","PHYSICAL","OTHER"]),
    content: a.string().required(),
    importance: a.enum(["HIGH","MEDIUM","LOW"]),
    tags: a.string().array(),
    periodStart: a.date(),
    periodEnd: a.date(),
    recordedAt: a.datetime().required(),
    recordedBy: a.string(),
  }).secondaryIndexes((idx)=>[
    idx("playerId").sortKeys(["recordedAt"]).queryField("listPlayerAnalysisByPlayer"),
  ]).authorization((allow)=>[
    allow.groups(["ADMINS","COACHES","ANALYSTS"]).to(["create","update","delete","read"]),
    allow.groups(["VIEWERS"]).to(["read"]),
  ]),

  // Unique index for enforcing application-level uniqueness (e.g., University name/code)
  UniqueIndex: a.model({
    pk: a.string().required(), // e.g., 'UNIVERSITY'
    sk: a.string().required(), // e.g., 'name:<normalized>' or 'code:<normalized>'
  })
  .identifier(["pk","sk"]) // composite primary key guarantees uniqueness
  .authorization((allow)=>[
    allow.groups(["ADMINS","COACHES"]).to(["create","delete","read"]),
    allow.groups(["ANALYSTS","VIEWERS"]).to(["read"]),
  ]),
});

export type Schema = ClientSchema<typeof schema>;
export const data = defineData({
  schema,
  authorizationModes: { defaultAuthorizationMode: "userPool" },
});

