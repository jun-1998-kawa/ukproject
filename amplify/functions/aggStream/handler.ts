/*
  DynamoDB Streams -> Aggregates updater
  - Trigger: DynamoDB Stream on Point table (INSERT/MODIFY)
  - Updates AggregatePlayerTargetDaily / AggregatePlayerMethodDaily via DynamoDB DocumentClient
  - Requires env: AGG_TARGET_TABLE, AGG_METHOD_TABLE (physical table names)
*/
import AWS from 'aws-sdk'

const ddb = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION })
const AGG_TARGET_TABLE = process.env.AGG_TARGET_TABLE || ''
const AGG_METHOD_TABLE = process.env.AGG_METHOD_TABLE || ''

function getString(attr: any) { return attr?.S ?? attr?.s ?? undefined }
function getNumber(attr: any) { if (attr?.N) return Number(attr.N); if (attr?.n) return Number(attr.n); return undefined }
function getList(attr: any): string[] { const l = attr?.L ?? attr?.l; if (!Array.isArray(l)) return []; return l.map((x:any)=> getString(x)!).filter(Boolean) as string[] }

exports.handler = async (event: any) => {
  if (!AGG_TARGET_TABLE || !AGG_METHOD_TABLE) {
    console.warn('Missing AGG_TARGET_TABLE/AGG_METHOD_TABLE env. Skipping.');
    return;
  }

  for (const rec of event.Records ?? []) {
    if (rec.eventName !== 'INSERT' && rec.eventName !== 'MODIFY') continue
    const img = rec.dynamodb?.NewImage
    if (!img) continue
    const scorerPlayerId = getString(img.scorerPlayerId)
    const target = getString(img.target)
    const methods = getList(img.methods)
    const recordedAt = getString(img.recordedAt)
    if (!scorerPlayerId || !target || !recordedAt) continue
    const date = String(recordedAt).slice(0,10)

    // Upsert target aggregate (ADD count :inc)
    await ddb.update({
      TableName: AGG_TARGET_TABLE,
      Key: { playerId: scorerPlayerId, date, target },
      UpdateExpression: 'ADD #c :inc',
      ExpressionAttributeNames: { '#c': 'count' },
      ExpressionAttributeValues: { ':inc': 1 },
    }).promise()

    for (const m of methods) {
      await ddb.update({
        TableName: AGG_METHOD_TABLE,
        Key: { playerId: scorerPlayerId, date, method: m },
        UpdateExpression: 'ADD #c :inc',
        ExpressionAttributeNames: { '#c': 'count' },
        ExpressionAttributeValues: { ':inc': 1 },
      }).promise()
    }
  }
}

