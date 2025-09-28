# Claude Code / Agent 運用メモ

このリポジトリは Amplify Gen 2（code-first）を前提にしています。Claude Code から継続作業する場合は、以下の手順・コマンドを参照してください。

## 主要コマンド

- サンドボックス起動: `npm run sandbox`（root）
- 型チェック: `npm run typecheck`
- 接続検証: `npm run verify:api`（環境変数 `SEED_AUTH_TOKEN` が必要）
- マスター投入: `npm run seed:masters`
- 初期データ投入: `npm run seed:initial`
- 集計再構築（バッチ）: `npm run aggregate:rebuild`
- 常時集計の自動配線（Windows/PowerShell）: `powershell -ExecutionPolicy Bypass -File scripts/wireStreams.ps1`
  - 既定では `amplify_outputs.json` と AWS CLI から自動推測します
  - 任意引数: `-Region`, `-PointTable`, `-AggTargetTable`, `-AggMethodTable`, `-FunctionName`

必要環境変数（PowerShell例）
```
$env:SEED_AUTH_TOKEN = "<Cognito ID token>"
```

GraphQLエンドポイントは `amplify_outputs.json` の `data.url` を参照します。

## 作業方針（要約）

- 現状は「有効打突 Point」を主データとし、Exchange/Actionは将来拡張用。
- 集計はまずバッチ（`scripts/rebuildAggregates.mjs`）で実装。
  - 後日 DynamoDB Streams → Lambda へ差し替え可能。
- 和名併記は `Target/Method/Position` の各マスターで管理。

## ToDo（2025-09-14 時点）

- [ ] Aggregates の可視化（フロントの簡易ダッシュボード）
- [ ] DynamoDB Streams → Lambda の常時集計に切替（設計済み）
- [ ] 入力UIのアクセシビリティ・トースト改善
- [ ] AppSync リゾルバのページング最適化（players/matches）

## 参考

- 設計計画: `docs/PLAN.md`
- 実装ログ: `docs/LOG.md`
## DynamoDB Streams → Lambda 常時集計の切替手順

0) まず `npm run sandbox` で `aggStream` を作成
- 既に `amplify/functions/aggStream` を追加済み。`npm run sandbox` で反映。

2) Pointテーブルに Streams を有効化（コンソール）
- DynamoDB → テーブル（Point の物理テーブル）→ 設定 → Streams を有効化（NEW_IMAGE）

3) Lambda トリガーの追加（コンソール）
- Lambda → 関数 `aggStream` → トリガー追加 → DynamoDB → 対象テーブル（Point）→ LATEST → バッチサイズ適宜

4) 集計テーブル名の設定（環境変数）
- Lambda `aggStream` の 環境変数に次を設定
  - `AGG_TARGET_TABLE`: AggregatePlayerTargetDaily の物理テーブル名
  - `AGG_METHOD_TABLE`: AggregatePlayerMethodDaily の物理テーブル名
- 物理名は DynamoDB コンソールのテーブル詳細からコピー

5) スクリプトで自動化（Windows）
- PowerShell: `powershell -ExecutionPolicy Bypass -File scripts/wireStreams.ps1`

6) 動作確認
- Web から有効打突を追加 → CloudWatch Logs `aggStream` にエラーが無いか確認
- DynamoDB の `Aggregate*` テーブルで値がインクリメントされることを確認

備考
- 本実装は直接 DynamoDB を更新（GraphQLは未使用）。バックフィルは `npm run aggregate:rebuild` を使用可能。
