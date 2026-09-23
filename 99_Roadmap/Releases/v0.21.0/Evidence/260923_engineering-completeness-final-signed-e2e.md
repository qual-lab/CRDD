# v0.21.0 Engineering Completeness 最終署名検証

記録日: 2026-09-23
対象版: `v0.21.0`
状態: 最終Release候補C向けEvidence
担当責任者: Qual-Lab

## 1. 結論

最終Source Aから作成した署名済みCoordinator Runtimeについて、Recovery MatrixとCodex／Claudeの4経路E2Eを同じRuntime実行Identityで完了した。

| 検証 | 結果 | 主な確認 |
|---|---|---|
| Recovery Matrix | Pass | 7シナリオ、最終cleanup確認済み、手動回復義務なし |
| 4経路E2E | Pass | forward、reverse、same-codex、same-claudeの4／4完了 |
| 正本Repository | Pass | 4経路終了後も変更なし |
| 終了状態 | Pass | cleanup確認済み、Process再起動不要、Effect不明なし、回復Identity曖昧なし |

本記録はReleaseを自己承認しない。Commit Cの閉集合確認、独立レビューと監査、main統合後のexact Identity確認、および人間による最終Release判断は後続Gateである。

## 2. 固定したIdentity

| 項目 | 値 |
|---|---|
| Source A Commit | `419fe21b0601e902bde7163c1194f9f437cbd961` |
| Source A Tree | `7475af191bf7e8ba5823d5fe5d025d412833f460` |
| Manifest carrier B Commit | `aa97f584593c1d7a9e818401e154a2accc4d6d1b` |
| Manifest carrier B Tree | `eee604907334ffe1c9b9a7a4b75ea540e56c4602` |
| Release sequence | `2026092305` |
| Manifest file SHA-256 | `c09463a7790a854b824efdf7d28ffa2608f4ec738d55918eeca5ba27b2323c9e` |
| Manifest Hash | `2b1513260da841b804e9965ef29f299ae6753eca870ca5de501f46c6c120f185` |
| Package Content Root SHA-256 | `e712a8daaf135d6482cb7faef0e0afdcf8e870bbfe180174602534aee6790235` |
| Runtime Execution Identity SHA-256 | `cf11ad32749f0856a91bbf1e18aebad0eff34e29018c77a080cf6340f237d433` |

## 3. Recovery Matrix

7シナリオを実行した。timeout、出力上限、無効出力および非ゼロ終了は、意図した失敗理由で停止し、残存Operation Directoryなしを確認した。取消は固定Provider Workerで確認した。cleanup観測不能からのexact回復と、親Process消失後のfresh回復も完了した。

| 項目 | 値 |
|---|---|
| 結果 | `completed` |
| 理由 | `signed_recovery_matrix_verified` |
| Cleanup | 確認済み |
| 手動回復義務 | なし |
| 保存結果SHA-256 | `fab813c86cde2c92f64d2e6e6c1566bb2726bdede1a12ce087dd4c9b8b0d517d` |

## 4. 4経路E2E

既に承認された固定送信範囲を再利用し、次の4経路を実Providerで確認した。

| 経路 | 結果 | Candidate処置 | Cleanup |
|---|---|---|---|
| forward | Pass | exact内容確認後に破棄 | 確認済み |
| reverse | Pass | exact内容確認後に破棄 | 確認済み |
| same-codex | Pass | exact内容確認後に破棄 | 確認済み |
| same-claude | Pass | exact内容確認後に破棄 | 確認済み |

再試行経路は0件で、Canonical Repository変更、Effect不明、回復Identity曖昧、手動回復義務およびProcess再起動要求はいずれもなかった。

保存結果SHA-256: `b7929ab931283d2ca0ec9b08504be78b33757b5a65c4f1b2675df0c5613fe944`

## 5. Quality Local Itemへの処置

| Local Item | 判定 | 本Evidenceが直接示すこと | 残ること |
|---|---|---|---|
| `EST-ST-003` | Pass | 許可済みの最小範囲でProviderへ送り、同じ依頼へ結果を戻す4経路が完了した | なし |
| `EST-ST-005` | Pass | timeout、出力上限、無効出力、非ゼロ終了、取消、cleanup観測不能、親Process消失を区別して安全に回復した | なし |
| `RCM-ST-012` | Partial | 署名、manifest昇格、Recovery、Provider経路の実Consumerを同じ固定候補で観測した | Commit C閉集合監査とmain統合後の照合 |
| `CQS-ST-005` | Partial | 未実施項目をPassへ畳まず、最終候補Gateを生成した | Commit Cの監査結果と最終判断の反映 |
| `CQS-UAT-006` | OPEN | 残存範囲と後続Gateを分けて提示した | main統合後の人間による最終Release判断 |
| `ERB-ST-011` | OPEN | Recovery Matrixの親Process消失とfresh回復を確認した | Docker Engine／Host資源を独立観測する別Session handoff確認 |

未実施のManual／Hybrid項目を本E2EだけでPassへ変更しない。v0.22へ移管したProject Operation、Workbench、CROS、複数Repositoryおよび利用者所有Trustの26 Local Itemも、本記録のRelease成立範囲へ含めない。

## 6. 情報境界

本記録と対になる機械結果には、Provider生出力、OAuth URL、認証code、秘密、Host PathまたはRecovery Authorityを保存していない。ローカル検証記録はRepositoryへ収載せず、その内容を公開可能な結果、件数、IdentityおよびSHA-256へ限定して本Evidenceへ投影した。

## Checklist

- [x] Source A、manifest carrier Bおよび署名Runtime Identityを固定した
- [x] Recovery Matrixを最終署名Identityで実行した
- [x] 4経路E2Eを同じ最終署名Identityで実行した
- [x] Cleanup、正本非変更および回復義務の終了状態を確認した
- [x] 未実施Local ItemをPassへ畳んでいない
- [x] v0.22移管範囲をv0.21の成立範囲へ含めていない
- [x] Provider生出力、認証情報、秘密、Host PathおよびRecovery Authorityを保存していない
- [x] Commit C、main統合および最終Release判断を後続Gateとして残した
