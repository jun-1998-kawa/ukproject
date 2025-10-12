# AI 要約/QA 連携メモ

最終更新: 2025-10-12

## 概要

- ダッシュボードで計算済みの統計を JSON（SummarizePayload v1）に整形し、AppSync Mutation 経由で Lambda（`aiCoach`）→ Bedrock に渡して要約と Q&A を生成します。
- モデルは環境変数 `AI_MODEL_ID` で切り替え可能（例: `anthropic.claude-3-5-sonnet-20240620-v1:0` / `amazon.titan-text-premier-v1:0`）。

## 追加ファイル

- `amplify/functions/aiCoach` … Bedrock 呼び出し実装（Anthropic/Titan を自動切替）
- `amplify/data/resource.ts` … `aiSummarize` / `aiAsk` の Mutation を追加
- `web/src/components/AIPanel.tsx` … 要約表示と QA 入力 UI
- `web/src/components/Dashboard.tsx` / `TeamDashboard.tsx` … 「AI要約」ボタンとペイロード構築
- `scripts/AllowInvokeBedrock.json` … Lambda ロールに付与する IAM ポリシーの例

## デプロイ手順（概要）

1) 環境変数の設定（Amplify コンソール → 関数 `aiCoach`）

- `AI_MODEL_ID`: 例 `anthropic.claude-3-5-sonnet-20240620-v1:0`

2) Lambda ロールに Bedrock 権限を付与

- 例ポリシー: `scripts/AllowInvokeBedrock.json`
- アタッチ先: 関数 `aiCoach` の実行ロール

3) AppSync スキーマ/リゾルバは Amplify Gen2 のコードから自動反映

- `aiSummarize(payload: AWSJSON!): AiResponse!`
- `aiAsk(input: AiAskInput!): AiResponse!`
- 認可: `ADMINS|COACHES|ANALYSTS`（`data/resource.ts` 内で制御）

4) 動作確認

- Web ログイン → ダッシュボード → 「AI要約」
- 失敗時は CloudWatch Logs（`/aws/lambda/aiCoach`）を参照

## 注意

- 送信データは統計のサマリのみ（個人名は表示名程度）。
- コスト管理は上位N件/出力トークン上限で制御（初期値 800/600 tokens）。
- Titan/Anthropic 以外のモデルは未検証。`AI_MODEL_ID` のプレフィックスで分岐しています。

