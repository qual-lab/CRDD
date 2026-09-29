# Phase 5 Workbench Repository結合とSelection更新

## 結論

Mount Grant fresh再観測を反映した署名候補はMount境界を通過したが、次のSelection境界で`workbench_ai_advice_selection_unavailable`としてEffect前に停止した。原因は、Workbench専用Operationに一般Selection Runtimeが必須とするRepository Operation結合がなく、設計正本が要求するMount前／Effect直前の二段階Selectionも未接続だったことである。

本Evidenceは原因、是正契約および局所確認を記録する。再署名後の実Provider E2E結果は別Evidenceで記録し、本記録から成立を推定しない。

## 観測した事実

| 項目 | 結果 |
|---|---|
| 署名候補 | Source Commit `6592826131cf5d96c8c52e3381edad5941d92c56`、Release Sequence `2026092903` |
| Mount境界 | fresh Provider Home観測とMount Grant消費を通過 |
| 停止理由 | `workbench_ai_advice_selection_unavailable` |
| Provider Effect | 発行なし |
| 一般Task経路 | Operation作成後にRepository Operationを結合してからSelectionを発行 |
| Workbench助言経路 | 修正前はOperation作成後にRepository結合をせず、Mount後にSelectionを一回だけ発行 |
| 設計要求 | Mount前の初回Selection、Mount後の旧Selection失効、同じ入力によるEffect直前Selection再発行と意味完全一致 |

## 是正

```text
検証済みRepository Root Capability
        ↓
Workbench OperationへRepository Identityを内部結合
        ↓
初回Selection
        ↓
Provider Home観測／Mount Grant発行
        ↓
fresh再観測／Mount Grant消費
        ↓
初回Selection失効
        ↓
同じ入力でSelection再発行
        ↓
Provider／Profile／Model／Effort／Speed／Reason完全一致
        ↓
Packet／Provider Effect
```

Repository結合はSelection AuthorityのScope確認にだけ用いる。ProviderへRepository／WorkspaceをMountせず、Repository Pathまたは任意読取りAuthorityをTask Packetへ追加しない。

## 局所確認

| 確認 | 結果 |
|---|---|
| Workbench助言Runtime契約試験 | 8件中8件Pass |
| Repository結合不能 | Selection 0、Provider Effect 0、Operation cleanup 1 |
| Mount再観測不能 | 初回Selection 1、初回Selection失効1、Mount Grant失効1、Provider Effect 0 |
| Selection再発行の意味差 | Selection 2、両Selection失効、Packet 0、Provider Effect 0、Operation cleanup 1 |
| 初回Selection失効失敗 | Selection再発行0、Packet／Process／Provider Effect 0、Operation cleanup 1、Authority cleanup未確認としてProcess poison |
| 不正な再Selection | 発行済みControlを検証前からcleanup対象として保持し、Selection 2、両Selection失効、Packet／Process／Provider Effect 0、Operation cleanup 1 |
| TypeScript型検査 | Pass |
| Formatter／Lint | Pass |
| Runtime Capability Graph／Traceability | Pass |
| Workbench全試験 | 21件中21件Pass |
| Coordinator Portable回帰 | 2,115件中2,106件Pass、8件Skip、1件はSource Commit確定前の署名試験前提により未成立 |

Portable回帰で未成立だった1件は、固定公開鍵に対応しない秘密鍵を拒否する試験である。実行時点では旧Manifestを削除済みで新しいSource Commitと新Manifestが未確定だったため、試験fixtureが履歴上の旧署名Commitを復元し、現在のRuntime依存閉包と一致しなかった。Selection是正後に追加したAuthority cleanup反証2件、Selection対象試験およびPackage Capability利用側閉包はPassしており、これ以外の新規失敗はない。新Source Commit確定・再署名後、新Manifestが存在する状態で同試験を含む回帰を再実行し、秘密鍵拒否の成立を確認する。

## 未完了

- 現在TreeのCommit
- 新しいSource CommitとRelease SequenceによるCoordinator Runtime再署名
- 新Manifest存在下の秘密鍵拒否試験再確認
- 署名候補の直接起動
- 修正後署名候補によるCodex／Claude実Provider E2E
- 同じRelease Identityで必要な四経路E2E

## Checklist

- [x] 事実と原因仮説を分けて確認した
- [x] 一般Selectionの安全条件を弱めていない
- [x] Repository結合とProvider Mountを分離した
- [x] Mount前／Effect直前のSelection更新契約へ接続した
- [x] 失敗時のProvider Effect 0とcleanupを局所確認した
- [ ] 修正後の署名実境界で確認した
