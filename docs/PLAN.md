# 開発計画（Kendo Club Engine）

最終更新: 2025-09-14

## フェーズ

1. 要件定義（完了）
2. アーキテクチャ/コスト設計（完了）
3. データモデル設計（Point中心 + Exchange/Action準備）（完了）
4. Amplify Gen 2 バックエンド雛形（完了）
5. 認証/RBAC（Cognito, グループ）（継続）
6. マスター投入（Target/Method/Position）（完了）
7. 初期データ投入（University/Player/Match/Bout/Point）（完了）
8. フロント雛形（一覧 + 認証）（完了）
9. 入力UI（Point作成、バリデーション、段技/相打ち）（完了）
10. 集計パイプライン（Streams→Lambda→Aggregates）（雛形追加・手順記載）
11. ダッシュボード（構え・ポジション・会場・時間帯）（未着手）
12. デプロイ/CI（型/ビルド/PRチェック）（継続）

## 次のアクション

- DynamoDB Streams を Point テーブルで有効化し、Lambda `aggStream` をトリガーに接続
- Lambda の環境変数に集計テーブル名を設定（AGG_TARGET_TABLE/AGG_METHOD_TABLE）
- フロントで選手名解決のキャッシュ/ページング最適化
- 入力UIのアクセシビリティ/ガード強化（未ログイン/権限不足）
