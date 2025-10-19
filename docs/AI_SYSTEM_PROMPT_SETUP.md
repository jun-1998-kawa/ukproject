# AI System Prompt Setup Guide

このガイドでは、aiCoach Lambda関数のシステムプロンプトを設定する方法を説明します。

## 📋 システムプロンプトの優先順位

aiCoach関数は以下の優先順位でシステムプロンプトを取得します：

1. **S3バケット** (最優先) - 長いプロンプトに最適
2. **環境変数** - 短いプロンプト向け（4KB制限あり）
3. **デフォルトプロンプト** - フォールバック

## 🪣 方法1: S3バケットを使用（推奨）

### ステップ1: S3バケットの作成

```bash
# S3バケットを作成（バケット名は一意である必要があります）
aws s3 mb s3://kendo-ai-prompts-YOUR-ACCOUNT-ID

# または、既存のバケットを使用
```

### ステップ2: システムプロンプトファイルのアップロード

```bash
# プロンプトファイルを作成
cat > system-prompt.txt << 'EOF'
あなたは大学剣道部のアナリティクスコーチです。

## 役割
- 提供された統計データのみに基づいて分析を行う
- 全ての数値に根拠を明記する（例: PF=68, 勝率=55.6%）
- データ以外の推測は行わない

## 出力形式
1. **要約**: データの主要な傾向を3-5文で説明
2. **強み**: 数値的根拠を伴う強みの列挙
3. **改善点**: 数値的根拠を伴う課題の列挙
4. **次のステップ**: 3つの具体的な質問を提案

## 言語
全ての回答は日本語で行ってください。

## 定性データの活用
ペイロードに `qualitativeData` (BoutAnalysis/PlayerAnalysis) が含まれる場合、
これらも統計データと組み合わせて総合的な分析を行ってください。
EOF

# S3にアップロード
aws s3 cp system-prompt.txt s3://kendo-ai-prompts-YOUR-ACCOUNT-ID/prompts/system-prompt.txt
```

### ステップ3: 環境変数の設定

プロジェクトルートに `.env` ファイルを作成：

```bash
# .env
AI_PROMPT_S3_BUCKET=kendo-ai-prompts-YOUR-ACCOUNT-ID
AI_PROMPT_S3_KEY=prompts/system-prompt.txt
AI_MODEL_ID=anthropic.claude-3-5-sonnet-20240620-v1:0
AI_BEDROCK_REGION=us-east-1
```

### ステップ4: デプロイ

```bash
# Amplify sandboxの場合
npx ampx sandbox --once

# 本番環境の場合
git push  # Amplify Hostingが自動的にデプロイ
```

## 🔧 方法2: 環境変数を使用

短いプロンプト（4KB未満）の場合、環境変数で直接指定できます：

```bash
# .env
AI_SYSTEM_PROMPT="あなたは大学剣道部のアナリティクスコーチです。提供された統計データのみに基づいて分析を行い、全ての数値に根拠を明記してください。日本語で回答してください。"
AI_MODEL_ID=anthropic.claude-3-5-sonnet-20240620-v1:0
AI_BEDROCK_REGION=us-east-1
```

**注意**: 環境変数には4KB（約4,000文字）の制限があります。

## 📝 方法3: デフォルトプロンプト

環境変数もS3も設定されていない場合、以下のデフォルトプロンプトが使用されます：

```
You are an analytics coach for a university kendo team.
Summarize only from the provided stats. In every figure include
the numeric basis (e.g., PF=68, WinRate=55.6%). Do not speculate
beyond data. End with three Next Questions. Please answer in Japanese.
```

## 🔍 動作確認

### CloudWatch Logsで確認

Lambda関数の実行ログで、どのプロンプトソースが使用されているか確認できます：

```
[aiCoach] Using system prompt from S3           # S3から取得
[aiCoach] Using system prompt from environment variable  # 環境変数から取得
[aiCoach] Using default system prompt            # デフォルト使用
```

### ローカルテスト（Sandbox）

```bash
# Sandboxを起動
npx ampx sandbox

# 別のターミナルで
node scripts/testAICoach.mjs
```

## 🚨 トラブルシューティング

### S3アクセスエラー

```
Failed to load system prompt from S3: Access Denied
```

**解決策**: Lambda実行ロールにS3読み取り権限があることを確認

```bash
# IAMポリシーを確認
aws iam get-role-policy --role-name <lambda-role-name> --policy-name S3PromptReadPolicy
```

### プロンプトが空

```
S3 object was empty
```

**解決策**: S3オブジェクトが正しくアップロードされているか確認

```bash
aws s3 cp s3://kendo-ai-prompts-YOUR-ACCOUNT-ID/prompts/system-prompt.txt -
```

### Lambda環境変数が反映されない

Amplify Sandboxを再起動してください：

```bash
# Ctrl+C でsandboxを停止
npx ampx sandbox --once
```

## 📊 キャッシング戦略

aiCoach関数は以下のキャッシング戦略を使用します：

1. **Lambda Warm Start時**: S3プロンプトはキャッシュされ、再取得されません
2. **Cold Start時**: S3から新しいプロンプトを取得
3. **キャッシュのクリア**: Lambda関数を再デプロイすると自動的にクリア

## 🎯 推奨プロンプト構造

効果的なシステムプロンプトの例：

```
# 役割定義
あなたは[具体的な役割]です。

# 制約
- [制約1]
- [制約2]

# 出力形式
1. [セクション1]
2. [セクション2]

# 言語・トーン
[言語指定]
```

## 🔄 プロンプトの更新

S3プロンプトを更新する場合：

```bash
# 新しいプロンプトをアップロード
aws s3 cp new-system-prompt.txt s3://kendo-ai-prompts-YOUR-ACCOUNT-ID/prompts/system-prompt.txt

# Lambda関数を再デプロイしてキャッシュをクリア
npx ampx sandbox --once
```

**注意**: Warm Lambdaは古いプロンプトをキャッシュしている可能性があります。
完全な更新には数分かかる場合があります。

## 📚 関連ファイル

- `amplify/functions/aiCoach/handler.ts` - メインロジック
- `amplify/functions/aiCoach/resource.ts` - 環境変数定義
- `amplify/backend.ts` - S3アクセス権限設定

## 🆘 サポート

問題が発生した場合は、以下を確認してください：

1. CloudWatch Logsでエラーメッセージを確認
2. S3バケットとキーが正しいか確認
3. Lambda実行ロールのIAMポリシーを確認
4. 環境変数が正しく設定されているか確認
