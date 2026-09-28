# Phase 5 AI Runtime Package Closure

## 結論

Workbenchの読取り助言と変更候補を追加した後も、署名対象となるCoordinator Runtimeの依存閉包とCapability利用側の閉集合が成立する状態へ是正した。

## 発見と是正

| 発見 | 原因 | 是正 |
|---|---|---|
| 配布Filesystem契約の反証試験が共通して停止した | Workbench AI Runtimeから増えたPackage Capability利用側が閉集合へ未登録だった | 助言Runtimeのconsume、変更候補Runtimeのissue／revokeを利用側閉集合へ追加した |
| 変更候補Runtimeから不要なVersion Control実装まで署名依存閉包へ到達した | `version-control/src/index.ts`を参照していた | 必要な固定Revision Adapterを所有Moduleから直接参照した |
| 共通停止理由から原因箇所を判別しにくかった | 入れ子の閉じたRuntime契約違反を診断結果へ投影していなかった | PathやSource本文を公開せず、既知の契約理由だけを検証診断へ投影した |

## 検証結果

| 検証 | 結果 |
|---|---|
| Coordinator format／type／lint／Runtime Graph | Pass |
| Workbench全Integration 16件 | Pass |
| Coordinator署名Package Filesystem契約 125件 | Pass |
| Coordinator Portable全回帰 | 2101件中2094件Pass、5件Skip、2件Fail |
| CRDD Checker | 作業Branch固有の`stable-release-tag-identity-mismatch` 1件だけ。文書・Link・ID・構造の新規Errorなし |
| 実Provider送信 | 未実施。別途、明示許可後に実行する |

全回帰の2件はWorkbench AI Runtimeの動作失敗ではない。いずれも、v0.21の署名済み固定Snapshotを、v0.22で追加したPackage Capability利用側の現行閉集合で再検査したために停止した。

| 失敗した検証 | 現在の判定 |
|---|---|
| 固定公開鍵に対応しない秘密鍵ではManifestを生成しない | 鍵照合より前のPackage観測で、履歴Snapshotと現行利用側閉集合が不一致になった |
| 署名済み固定Snapshotを昇格し明示破棄後は最終Pathだけを残す | 署名済み履歴Snapshotの検証に現行の署名前閉集合を適用し、履歴Distributionを拒否した |

新規署名前の現行閉集合検査と、署名でIdentityが固定された履歴Distributionの検証を同じ規則で扱わない境界整理が必要である。検査を省略または弱化してPassへ変更してはならない。

## 残る事項

- 署名済み実Providerで読取り助言と変更候補を観測する。
- 未信頼候補を確認して採用する操作は、既存Project Runtime IntegrationのAuthorityとLeaseを迂回しない別操作として閉じる。
- 現行署名前検査と署名済み履歴Distribution検証のPolicy境界を分離し、上記2件を再実行する。
- Production全Profileと残る画面をReality Auditし、独立レビューへ渡す。
