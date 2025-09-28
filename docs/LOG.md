# 実装ログ / 実績

日付: 2025-09-14

- Amplify Gen 2 バックエンド追加（auth/data/backend）
- データモデル: University/Venue/Player/TechniqueDictionary/Match/Bout/Point/Exchange/Action
- マスター `TargetMaster`/`MethodMaster`/`PositionMaster` 追加（和名併記）
- `NIDAN`/`MUTEI` を Method から削除（段技は `sequenceLen/sequenceTargets` で表現）
- スキーマ調整: `belongsTo/hasMany` 双方向関係, 文字列列挙で柔軟化
- Seed スクリプト: masters, initial（大学/選手/試合/取組/有効打突）
- 接続検証スクリプト追加
- Web(React+Vite) 雛形追加、認証 + 試合/取組/有効打突の一覧
- 入力UI追加: Point作成、バリデーション、段技/相打ち、技/段技ターゲットの複数選択、登録後の自動リロード
- 表示: Player ID→氏名解決
- ダッシュボード（簡易）: 選手×日付で部位/方法ヒートマップ（Aggregate* をGraphQLで取得）
- ダッシュボード改善: 期間プリセット（直近7/30/90日）、凡例追加
- ページング最適化: listMatches/listPlayers をページネーション取得（上限回避・高速化）

保留中:
- 集計パイプライン（Streams→Lambda）
- ダッシュボード可視化
- UI の細部（トースト、エラーハンドリング改善など）
