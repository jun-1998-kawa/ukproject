# TODO (Kendo Club Engine)

優先度: 上から順に対応。完了したら [x] を付ける。

## P0 — 運用・メタ
- [x] 永続TODOの作成（このファイル）

## P1 — 入力UI（実装中/完了）
- [x] 新規入力: 一本セルの未完バリデーション（枠赤）
- [x] 新規入力: 時刻の柔軟入力（1:23 / 1'23 / 83）
- [x] 新規入力: 反則UIを±ボタン化・2到達で反則一本予告
- [x] 新規入力: 試合追加（大会名・日程未選択時は開催日作成→試合作成）
- [x] 選手登録: 所属/入学年/段級位/構えの編集・新規追加
- [x] 選手登録: 大学一覧の読み込み
- [x] 新規入力: 選手プルダウンに検索フィルタ（簡易）
- [x] 新規入力: 選手プルダウンを所属ごとにグルーピング（大学ごとoptgroup）
- [x] 新規入力: 方法の複数選択UI（チェックボックスドロップダウン）
- [x] 新規入力: 行保存禁止時のヘルプ表示（未完メッセージ/ボタン無効化）

## P2 — 選手管理拡張（要スキーマ拡張）
- [ ] Player: 学籍番号(studentNo) / 在籍(isActive) / かな(nameKana) / 備考(notes)
- [ ] Player: 学年の自動計算に gradeOverride を追加（任意）
- [ ] 所属(University) 管理画面（新規・編集・削除）

## P3 — インポート/エクスポート
- [ ] 選手CSVインポート（プレビュー→重複チェック→確定）
- [ ] 選手CSVエクスポート

## P4 — シート(Excel)強化
- [ ] 方法セルの複数選択UI
- [ ] 既存ポイントの編集/削除API接続
- [ ] ペースト用テンプレート提示

## メモ
- P2の項目はAmplifyスキーマ変更とデプロイが必要。実施タイミングを相談。

---

�ǋL: 2025-09-23 TODO�i�����E�d������E�N�C�b�N�ǉ��j

- [x] �t�����g: UniversitiesAdmin �ɖ���/�R�[�h�̏d���`�F�b�N��ǉ��i�����G���[�\���j
- [x] �t�����g: PlayersAdmin �̏����v���_�E���Ɂu�{������ǉ��v���[�_����ǉ��i����/����/�R�[�h�j�B�쐬��Ɉꗗ�ēǍ����V�K������I���B
- [x] �o�b�N�G���h: UniqueIndex ���f����ǉ��ipk='UNIVERSITY', sk='name:<norm>'/ 'code:<norm>'�j�B����PK�ň�ӕۏ؁B�v�f�v���C�B
- [ ] �f�v���C: Amplify �֔��f�i�K�{�j�� �v���W�F�N�g���[�g�� mplify push �����s����B
- [ ] �f�[�^�ڍs: ����University�� name/code �ɂ��� UniqueIndex ���o�b�N�t�B���i�d��������ꍇ�͎��O�Ɏ蓖�j�B�X�N���v�g���i��: Node.js �� list�������j�B
- [ ] �t�����g: UniversitiesAdmin �̍X�V�iname/code�ύX�j���� UniqueIndex �̍ė\��i���L�[�폜���V�L�[�쐬���X�V�����s�����[���o�b�N�j����������B
- [ ] �����΍�i�C�Ӂj: AppSync/Lambda �� create/update �����b�v���AUniqueIndex �\��Ɩ{�̍X�V�����q�I�ɏ�������iConditionalCheck���p�j�B
- [ ] UX: PlayersAdmin �̃N�C�b�N�ǉ��������Ƀg�[�X�g�ʒm�A���s���̃��g���C�����B

����:
- UniqueIndex �� sk ���K���� 	oLowerCase().trim()�i�t�����g�����ꃋ�[����K�p�j
- code �͔C�ӁB�����͎��� code �\����s��Ȃ��B
- �����I�ɏ����̖������iisActive�j�� University �ɒǉ�����ꍇ�́APlayersAdmin/UniversitiesAdmin �o���Ńt�B���^UI�𕹐݁B
