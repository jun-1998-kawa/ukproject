#!/usr/bin/env node
/**
 * Test script for aiCoach Lambda function
 *
 * This script tests the AI summarization and Q&A features
 * with sample kendo statistics data.
 *
 * Usage:
 *   1. Start Amplify sandbox: npx ampx sandbox
 *   2. In another terminal: node scripts/testAICoach.mjs
 *
 * Environment variables required:
 *   - SEED_API_URL: GraphQL endpoint
 *   - SEED_AUTH_TOKEN: Cognito ID token
 */

import { readFile } from 'node:fs/promises';

// Load environment variables
const SEED_API_URL = process.env.SEED_API_URL || '';
const SEED_AUTH_TOKEN = process.env.SEED_AUTH_TOKEN || '';

if (!SEED_API_URL || !SEED_AUTH_TOKEN) {
  console.error('❌ Error: SEED_API_URL and SEED_AUTH_TOKEN must be set in .env');
  console.error('   See .env.example for reference');
  process.exit(1);
}

// Sample payload for testing
const samplePayload = {
  version: 'v1',
  mode: 'personal',
  locale: 'ja',
  filters: {
    from: '2024-01-01',
    to: '2024-12-31',
    type: 'all',
    tournamentQuery: '',
  },
  subject: {
    playerId: 'test-player-1',
    displayName: '山田太郎',
    universityId: 'test-university-1',
    universityName: '○○大学',
    gender: 'MALE',
    grade: 3,
  },
  sampleSizes: {
    matches: 15,
    bouts: 42,
  },
  stats: {
    bouts: 42,
    wins: 28,
    losses: 12,
    draws: 2,
    pf: 68,
    pa: 34,
    ppg: 1.62,
    diff: 34,
    winRate: 0.667,
    avgTimeToScoreSec: 45.3,
    fastestSec: 12,
    slowestSec: 118,
  },
  topTechniquesFor: [
    { key: 'MEN:TOBIKOMI', count: 28 },
    { key: 'KOTE:DEBANA', count: 18 },
    { key: 'DO:GYAKU', count: 12 },
    { key: 'KOTE:SURIAGE', count: 10 },
  ],
  topTechniquesAgainst: [
    { key: 'MEN:TOBIKOMI', count: 12 },
    { key: 'KOTE:DEBANA', count: 8 },
    { key: 'DO:', count: 6 },
    { key: 'MEN:HIKI', count: 5 },
  ],
  vsOpponents: [
    {
      opponentId: 'opp-1',
      name: '佐藤次郎',
      bouts: 5,
      wins: 3,
      losses: 2,
      draws: 0,
      pf: 8,
      pa: 5,
    },
    {
      opponentId: 'opp-2',
      name: '鈴木三郎',
      bouts: 4,
      wins: 2,
      losses: 2,
      draws: 0,
      pf: 6,
      pa: 6,
    },
  ],
  qualitativeData: {
    boutAnalyses: [
      {
        boutId: 'bout-1',
        category: 'STRENGTH',
        content: '飛び込み面のタイミングが非常に良い。相手の攻撃開始直後に攻め入る判断力が優れている。',
        importance: 'HIGH',
        tags: ['面技', 'タイミング'],
        recordedAt: '2024-10-15T10:30:00Z',
      },
      {
        boutId: 'bout-2',
        category: 'WEAKNESS',
        content: '引き技への対応が遅れがち。下がる相手に対する追撃のスピードを上げる必要がある。',
        importance: 'MEDIUM',
        tags: ['引き技', '対応'],
        recordedAt: '2024-10-16T14:20:00Z',
      },
    ],
    playerAnalyses: [
      {
        category: 'TACTICAL',
        content: '試合序盤は様子見が多く、中盤以降に攻勢に転じる傾向。序盤からの積極性向上が課題。',
        importance: 'HIGH',
        tags: ['試合運び', '序盤'],
        periodStart: '2024-09-01',
        periodEnd: '2024-10-15',
        recordedAt: '2024-10-15T18:00:00Z',
      },
    ],
  },
  notes: {
    dataSource: 'test-script',
  },
};

async function testAISummarize() {
  console.log('\n🧪 Testing aiSummarize...\n');

  const query = `
    mutation TestAISummarize($payload: AWSJSON!) {
      aiSummarize(payload: $payload) {
        text
        conversationId
        model
      }
    }
  `;

  try {
    const response = await fetch(SEED_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': SEED_AUTH_TOKEN,
      },
      body: JSON.stringify({
        query,
        variables: {
          payload: JSON.stringify(samplePayload),
        },
      }),
    });

    const json = await response.json();

    if (json.errors) {
      console.error('❌ GraphQL Errors:', JSON.stringify(json.errors, null, 2));
      return null;
    }

    const result = json.data?.aiSummarize;
    if (!result) {
      console.error('❌ No data returned');
      return null;
    }

    console.log('✅ Success!');
    console.log('📝 Summary:');
    console.log('─'.repeat(60));
    console.log(result.text);
    console.log('─'.repeat(60));
    console.log(`\n🔑 Conversation ID: ${result.conversationId}`);
    console.log(`🤖 Model: ${result.model}`);

    return result.conversationId;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return null;
  }
}

async function testAIAsk(conversationId, question) {
  console.log(`\n🧪 Testing aiAsk with question: "${question}"\n`);

  const query = `
    mutation TestAIAsk($input: AiAskInputInput!) {
      aiAsk(input: $input) {
        text
        conversationId
        model
      }
    }
  `;

  try {
    const response = await fetch(SEED_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': SEED_AUTH_TOKEN,
      },
      body: JSON.stringify({
        query,
        variables: {
          input: {
            question,
            payload: JSON.stringify(samplePayload),
            conversationId,
          },
        },
      }),
    });

    const json = await response.json();

    if (json.errors) {
      console.error('❌ GraphQL Errors:', JSON.stringify(json.errors, null, 2));
      return;
    }

    const result = json.data?.aiAsk;
    if (!result) {
      console.error('❌ No data returned');
      return;
    }

    console.log('✅ Success!');
    console.log('💬 Answer:');
    console.log('─'.repeat(60));
    console.log(result.text);
    console.log('─'.repeat(60));
    console.log(`\n🔑 Conversation ID: ${result.conversationId}`);
    console.log(`🤖 Model: ${result.model}`);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Main execution
async function main() {
  console.log('🥋 Kendo AI Coach Test Script');
  console.log('═'.repeat(60));

  // Test 1: Summarize
  const conversationId = await testAISummarize();

  if (!conversationId) {
    console.error('\n❌ aiSummarize test failed, skipping aiAsk test');
    process.exit(1);
  }

  // Wait a bit before next request
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Test 2: Ask follow-up questions
  await testAIAsk(conversationId, 'この選手の最大の強みは何ですか？具体的な数値を含めて説明してください。');

  await new Promise((resolve) => setTimeout(resolve, 2000));

  await testAIAsk(conversationId, '引き技への対応を改善するための具体的なトレーニング方法を3つ提案してください。');

  console.log('\n✅ All tests completed!');
  console.log('\n💡 Tip: Check CloudWatch Logs to see which prompt source was used:');
  console.log('   - "Using system prompt from S3" → S3');
  console.log('   - "Using system prompt from environment variable" → Env var');
  console.log('   - "Using default system prompt" → Default');
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
