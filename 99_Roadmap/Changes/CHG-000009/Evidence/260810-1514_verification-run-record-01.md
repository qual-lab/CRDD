# CHG-000009 修正後固定版の機械確認記録

対象変更: [CHG-000009](../CHG-000009_Communication_and_Context_Dependency.md)

## 結論

初回監査6件の統合修正を含む固定コミット `41bfa5f91699b4fa8ca6946f1e1e2bc8af87ec51` だけを展開した分離worktreeで、CRDD Checkerをリポジトリ全体へ実行した。Error 0件、Warning 0件で完了し、固定Treeの所有ファイル95件、分離worktreeの通常ファイル95件、Checkerの発見ファイル95件が一致した。

旧固定コミット`c6433354ed2bca75a603c32abb6bf907addaa306`のCheckerおよび監査結果は初回履歴であり、本候補の解消判定またはRelease Handoffへ流用しない。

## 宣言対象

- リポジトリ: `qual-lab/CRDD`
- 基準main: `89314224b509614734b5a92754deb47f17f2e6d5`
- Object Format: `sha1`
- Commit OID: `41bfa5f91699b4fa8ca6946f1e1e2bc8af87ec51`
- Root Tree OID: `67f49ab0cb82d41d056b4bd728232d4f991192da`
- 対象Path: 固定コミットが所有するリポジトリ全体
- 分離worktree: `C:\project\CRDD-IR\v015-41bfa5f`
- worktree状態: detached HEAD
- Submodule: Git Indexのmode `160000`は0件、Checkerの観測gitlinkも0件

## 実観測対象と実行対象

同じ実行内で、Checker実行の直前と直後に固定対象の状態を確認した。

| 観測 | 実行直前 | 実行直後 |
|---|---|---|
| HEAD OID | `41bfa5f91699b4fa8ca6946f1e1e2bc8af87ec51` | `41bfa5f91699b4fa8ca6946f1e1e2bc8af87ec51` |
| Root Tree OID | `67f49ab0cb82d41d056b4bd728232d4f991192da` | `67f49ab0cb82d41d056b4bd728232d4f991192da` |
| tracked差分 | なし | なし |
| 未追跡物 | なし | なし |

- `git ls-tree -r --name-only HEAD`の対象: 95件
- 分離worktree内の通常ファイル: 95件（worktree接続用`.git`管理ファイルを除く）
- Checkerの`files_discovered`: 95件
- Checker出力は実行対象の外側で取得し、固定対象の母集団を増やしていない。
- 元worktreeの未追跡`CRDD_Introduction.pptx`は移動、削除、変更しておらず、分離worktreeには存在しない。

## 実行条件

- 実行主体: CRDD保守タスクの親エージェント `/root`
- Git: `git version 2.54.0.windows.1`
- Node.js: `v22.18.0`
- Node実行物SHA-256: `C22D1C59A1F767A1ED0178445A027F2257D318C55430FC819D48F269586822B7`
- Checker: 固定コミット内の `template/tools/crdd_check.mjs`
- Checker SHA-256: `2013153F0DCEBB71795725D7D888C63514AD8A6D5D370E7A1CDCB4272CC4CE17`
- Command: `node tools/crdd_check.mjs --json --summary`
- Checker内部実行時刻（UTC）: `2026-08-10T05:47:34.905Z`
- 所要時間: `515 ms`
- Exit Code: `0`

## 完全結果

- [Checker完全結果](CHG-000009_Checker_Run_41bfa5f.json)
- 出力SHA-256: `40794D416519DA1C2D95F22E0FF1028ECF2A8E24D99DF487CBE7DE0D0D9B2C56`
- 発見ファイル: 95件
- Markdown: 72件中72件
- ローカルリンク: 1,377件
- アンカー: 470件
- 版付き正本文書: 26件
- 是正表: 22行
- Error: 0件
- Warning: 0件

## 未評価範囲

- 文書規範の意味、専門品質、準拠影響および人間判断
- Git-ignoredファイル
- 元worktreeの未追跡 `CRDD_Introduction.pptx`
- 外部採用先における実際の移行、公開、依存更新運用
- リリース後の運用効果

上記は修正後の独立レビュー、文書監査、不足／影響・準拠影響監査またはリリース後の別変更契機で扱う。
