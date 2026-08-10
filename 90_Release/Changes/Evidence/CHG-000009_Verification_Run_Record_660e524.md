# CHG-000009 固定後Checker実行記録（660e524）

## 対象同一性

- 宣言対象Commit: `660e52450ab512836112b8c2e849ad8e894c9485`
- Root Tree: `b47b36005f00c2b9a62602656e24e4b50db77979`
- 基準main: `89314224b509614734b5a92754deb47f17f2e6d5`
- 対象範囲: 固定CommitのGit Tree全体
- 実行場所: `C:\project\CRDD-IR\v015-660e524`
- 実行形態: 固定Commitから作成したdetached分離worktree
- Submodule: なし

## 実観測対象と実行対象

- 実行直前HEAD: `660e52450ab512836112b8c2e849ad8e894c9485`
- 実行直前Root Tree: `b47b36005f00c2b9a62602656e24e4b50db77979`
- 実行直前のtracked差分: 0件
- 実行直前の未追跡物: 0件
- 実行直後HEAD: `660e52450ab512836112b8c2e849ad8e894c9485`
- 実行直後Root Tree: `b47b36005f00c2b9a62602656e24e4b50db77979`
- 実行直後のtracked差分: 0件
- 実行直後の未追跡物: 0件
- Git Tree所有ファイル: 95件
- 分離worktree内の通常ファイル: 95件（Git管理用`.git`接続情報を除く）
- Checker discovery: 95件
- Git-ignored files: Checkerの未確認範囲
- 元worktreeの`CRDD_Introduction.pptx`: 分離worktreeに存在せず、移動、削除または変更していない

Git Tree、分離worktree内の通常ファイルおよびChecker discoveryの件数が一致し、実行前後にtracked差分と未追跡物がないため、固定Tree以外の通常ファイルを実行対象へ混入させていない。Checker結果と本記録は実行対象worktreeの外側へ保存した。

## 実行条件

- Command: `node tools/crdd_check.mjs --json --summary`
- Node.js: `v22.18.0`
- Git: `git version 2.54.0.windows.1`
- Checker SHA-256: `EA7C700BBC5291DC32A8935ED61D87C475E50847F0D96CA7D1C8554A6A9A469F`
- 開始UTC: `2026-08-10T06:06:40.6442699Z`
- Checker内部実行UTC: `2026-08-10T06:06:44.292Z`
- 終了確認UTC: `2026-08-10T06:06:51.0361248Z`
- Exit Code: `0`

## 完全結果

- JSON: [`CHG-000009_Checker_Run_660e524.json`](CHG-000009_Checker_Run_660e524.json)
- 発見ファイル: 95件
- Markdown発見／確認: 72件／72件
- ローカルリンク: 1,379件
- Anchor: 470件
- Version文書: 26件
- 是正表行: 22件
- Error: 0件
- Warning: 0件

## 判定境界

本記録は固定Commitに対する決定論的Checker結果であり、規範の意味、依存関係の適用判定、専門品質、独立レビュー、監査、人間のリリース判断を代替しない。旧固定版`27e04f00341928aea935926cfa2fa212a1defcf6`以前のCheckerまたは監査結果は、現在の解消判定へ流用しない。

## 未確認範囲

- Git-ignored files
- 元worktreeの未追跡`CRDD_Introduction.pptx`
- 外部採用先での移行および運用結果
- 法務、ブランド、Privacy、Security、市場因果の個別専門判断
- 人間によるリリース判断
