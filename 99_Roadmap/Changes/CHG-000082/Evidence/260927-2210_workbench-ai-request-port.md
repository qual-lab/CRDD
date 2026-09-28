# Phase 4 Workbench AI依頼Port検証記録

Evidence種別: Integration Verification
対象変更: `CHG-000082`
観測日時: 2026-09-27 22:10 JST
対象状態: v0.22 Feature Branchの未Commit変更候補。Phase 4全体または実Provider E2Eの完了Evidenceではない。

## 結論

WorkbenchのAI依頼面を、現在Sessionの一件だけを扱うApplication Portとして接続した。Profile選択、開始、状態確認、取消および結果表示を定義し、結果は「確認できた事実」「共有済み分析」「追加推論」「次の選択肢」へ分離する。

AI実行Applicationが未接続の場合は入力を無効化し、Profile設定の存在を実行可能性へ読み替えない。今回の検証では決定論的Fake Applicationだけを使用しており、外部AIへの送信、Provider Effect、Credential利用および会話履歴保存は発生していない。

## 検証結果

| 検証 | 結果 | 観測 |
|---|---|---|
| Workbench format／type／lint | PASS | 9 filesを検査 |
| Workbench IT | PASS | 14／14 |
| AI依頼開始 | PASS | 固定Profile ID、Prompt、`PROJECT_CONTEXT.md`参照だけをApplication Portへ搬送 |
| 状態再観測 | PASS | 同じRequest IDから完了Snapshotを取得 |
| 結果意味分離 | PASS | 事実、共有済み分析、追加推論、次の選択肢を別Sectionへ表示 |
| 外部Text表示 | PASS | HTMLとしてescapeし、Markupを実行しない |
| 履歴所有 | PASS | 過去依頼一覧やProvider会話履歴を生成・保存しない |
| 未接続時 | PASS | Profile一覧があっても入力を無効化し、実行可能と表示しない |
| Repository Catalog投影 | PASS | Ownerが耐久採用した追加Profileを再起動後のWorkbenchへ表示 |
| Repository Profile管理 | PASS | 登録済みAdapter／Modelだけで作成・更新し、未確認削除をEffect 0で拒否 |

## 主な反映先

- `40_Develop/workbench/src/ai-request.ts`
- `40_Develop/workbench/src/workbench-server.ts`
- `40_Develop/workbench/src/index.ts`
- `40_Develop/workbench/tests/integration/workbench-server.contract.test.ts`
- `40_Develop/workbench/symbol.json`
- `07_Quality/Registry/test-catalog.json`

## 残る範囲

- Workbench AI依頼PortとCoordinatorの実Adapter
- 採用済みAI Profile Snapshotの実Provider実行への注入
- 外部送信Authority、取消完了、結果不明およびRecoveryの実境界
- 実Providerを使用した署名E2E

上記をFake Applicationの成功から推測せず、別の直接境界検証と実Provider E2Eで閉じる。

## Checklist

- [x] Profile設定と実行可能性を区別した
- [x] 未接続時にProvider実行を開始しない
- [x] Workbenchを会話履歴の正本にしていない
- [x] 事実と追加推論を同じ欄へ畳んでいない
- [x] 外部AI由来TextをHTMLとして解釈していない
- [x] 実Provider E2Eを成立済みと表示していない
