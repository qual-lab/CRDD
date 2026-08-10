# CHG-000009 固定後Checker実行記録 27e04f0

- 状態: Current
- 対象Commit: `27e04f00341928aea935926cfa2fa212a1defcf6`
- Root Tree: `7948f167999179c256ff11ba884017d8f9753b1b`
- 基準main: `89314224b509614734b5a92754deb47f17f2e6d5`
- 実行場所: `C:\project\CRDD-IR\v015-27e04f0`（detached分離worktree）
- 実行コマンド: `node tools/crdd_check.mjs --json --summary`
- Node: `v22.18.0`
- Git: `2.54.0.windows.1`
- Checker SHA-256: `EA7C700BBC5291DC32A8935ED61D87C475E50847F0D96CA7D1C8554A6A9A469F`
- 実行開始: `2026-08-10T05:57:29.287Z`
- 記録終了: `2026-08-10T05:57:42.6580612Z`
- Exit Code: `0`
- 完全Result: [CHG-000009_Checker_Run_27e04f0.json](CHG-000009_Checker_Run_27e04f0.json)

## 対象同一性

- 実行前後のHEADは対象Commitと一致した。
- 実行前後のRoot Treeは対象Treeと一致した。
- 実行前後ともtracked差分および未追跡物は0件だった。
- 固定Tree所有ファイル、分離worktree内の通常ファイル、Checkerの発見対象はすべて95件だった。
- 対象リポジトリにSubmoduleは存在しない。
- Checker出力と本記録は対象worktree外へ保存し、固定対象へ混入させていない。
- 元worktreeの未追跡`CRDD_Introduction.pptx`および旧Evidenceは、分離worktreeに存在せず、移動・削除・変更していない。

## 結果

- Markdown: 72件
- links: 1,377件
- anchors: 470件
- version docs: 26件
- remediation rows: 22件
- errors: 0件
- warnings: 0件

## 未確認範囲

- Git-ignoredファイル
- 未追跡PPTXの内容
- 外部採用先での実移行、公開、依存更新の実運用
- 法務、ブランド、プライバシー、セキュリティ、市場因果の専門判断

本実行は決定論的な機械確認であり、独立レビュー、文書監査、不足／影響・準拠影響監査、人間のリリース判断を代替しない。
