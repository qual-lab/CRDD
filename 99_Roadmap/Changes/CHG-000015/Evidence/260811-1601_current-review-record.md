# CHG-000015 現在のレビュー記録

- 固定対象Commit: `b0856c99d45b43e995cb76d1e0b5b7ee938bcfe7`
- 固定対象Tree: `3911b781c8170a802841657ed00c778d65133f0b`
- 共通機械確認: Checker Error `0` / Warning `0`、Coordinator `114 / 114 Pass`、Checker `143 / 143 Pass`、diff／worktree clean
- 現在状態: linked worktree Runtime Root方針の候補Core反映と独立確認完了、metadata書込み・activation・Capability未実装、Execution Environment Gateは`blocked`

| 確認 | 結果 | 固定記録 | SHA-256 |
|---|---|---|---|
| Agent／Architecture／Security Review | `Pass` | [`CHG-000015_Agent_Security_Review_b0856c9.md`](CHG-000015_Agent_Security_Review_b0856c9.md) | `1A05CD547782AED2B6ED7B39142D87CD83BCA4D47626852959CCC9E61582F306` |
| Document Audit | `Pass` | [`CHG-000015_Document_Audit_b0856c9.md`](CHG-000015_Document_Audit_b0856c9.md) | `ECC3209B656A63D5AEA00D37B042E4E4F23B0FCED721456BE58B04AC713D0A7E` |
| Gap／Impact＋Conformance Audit | `Pass` | [`CHG-000015_Gap_Conformance_Audit_b0856c9.md`](CHG-000015_Gap_Conformance_Audit_b0856c9.md) | `E3C6A4CE69BCB1CB362446CC4A4803556632AB1C961881F8E61399201CF7B068` |

## 独立確認済み範囲

- linked worktreeではRepository内の既定`<repository>/.crdd-runtime/`だけを許可
- 無指定、CLI同値指定および環境同値指定を同じ既定Root候補として処理
- linked worktreeの真のRepository内custom Rootを拒否
- Repository外overrideをGit exclude不要候補として維持
- layout Core再検証、Path非出力、metadata書込み未発行およびCapability未発行
- README導入説明における通常、linked、対象自身のsubmodule worktree、参照submoduleおよび別Repositoryの分離

旧`1da5108`以前の監査結果は各固定範囲の履歴としてだけ保持し、この固定版の合否または解消判定へ流用していない。

## 未解決・未評価

- Repository Identity、Root／Git metadata Pathのrealpath、non-link／non-reparse、owner／mode／ACL
- `.git/info/exclude`の原子的・冪等書込み、同時更新および事後確認
- CLI／環境overrideの実接続、activation記録、Capability発行／消費
- Candidate Revision、Operation入力およびProvider mountからのRuntime Root実除外
- 実Provider／Operation、採用、移行、準拠、Stable、Releaseおよび公開

## Current Decision Set

現在のlinked worktree Root方針について追加の人間判断はない。次段階は、既に承認されたlocal exclude方式の範囲で、Repository IdentityとFilesystem境界を確認してから`.git/info/exclude`を原子的・冪等に更新し、exact entryを事後確認するAdapter候補である。

この後続は、caller指定の任意Git metadata Path、tracked `.gitignore`変更、複数Repository書込み、activation、Capability、Provider起動またはReleaseへ範囲を広げない。安全な一意実装が成立しない新しい選択、Platform権限モデルの受容、または残存リスクの受容が必要になった時点でQual-Labへ判断を移送する。
