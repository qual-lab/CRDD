# Phase 5 Workbench Production Selection契約

## 結論

Repository結合と二段階Selectionを反映した署名候補は、初回Selectionで`workbench_ai_advice_selection_unavailable`としてProvider Effect前に停止した。原因は、WorkbenchがSelection Grantを必要とする明示AI実行を`delegationNeed: none`として要求していたことである。

`none`はFront AIだけで完結しSelection Grantを発行しない経路であり、明示Providerを同時指定する要求はProduction Selection契約が拒否する。Workbenchの要求を`beneficial`かつ`explicit_user_delegation`へ是正し、一般Selectionの安全条件は変更していない。

## 原因と是正

| 項目 | 修正前 | 修正後 |
|---|---|---|
| 利用者意図 | WorkbenchでAI Profileを明示して助言を実行 | 同左 |
| Selection要求 | `none`＋明示Provider | `beneficial`＋`explicit_user_delegation`＋明示Provider／Profile |
| Production結果 | 要求不整合としてGrant非発行 | 実Selection契約でProvider／Profileへ固定したGrantを発行可能 |
| 安全境界 | Provider Effect 0で停止 | `none`契約を緩めず、発行済みGrantだけを利用 |

Unit fixtureが要求内容を十分に検査せず発行済みSelectionを返していたため、局所試験では乖離を検出できなかった。Fixtureへ要求fieldの全比較を追加し、Selection Grant RuntimeにもWorkbench相当要求を通す契約試験を追加した。

## 局所確認

| 確認 | 結果 |
|---|---|
| Workbench助言／Route／Selection対象試験 | 35件中35件Pass |
| Workbench要求field | Provider、Need、Reason、Profile、Role、Work Class、Risk、判断影響、Operation Identityを全比較 |
| 実Selection Runtime直接結合 | Productionが生成した初回・再発行要求を実Selection Runtimeへ渡し、旧Grant失効、新Grant消費およびProvider準備までを確認 |
| TypeScript型検査 | Pass |
| Formatter／Lint | Pass |
| Runtime Capability Graph／Traceability | Pass |
| Coordinator Portable全回帰 | 2,117件中2,112件Pass、5件Explicit Skip、0件Fail |

5件のSkipはHostまたは人間入力を必要とする明示的な条件付き実行である。旧Manifest削除後に前提不成立となっていた署名拒否fixtureも、現在のManifestを用いた同一回帰内でPassした。

## 確認済み

- 更新候補の独立レビュー、文書監査およびGap影響監査はFinding 0で完了した

## 未完了

- 新Source CommitとRelease Sequenceによる再署名
- 新Manifest存在下の署名拒否試験
- 署名候補の直接起動
- Codex／Claude実Provider E2Eと必要な四経路E2E

## Checklist

- [x] 実Production契約の拒否理由をSourceから特定した
- [x] `none`の安全契約を緩めていない
- [x] Workbenchの利用者意図をSelection要求へ一意に接続した
- [x] Mockだけでなく実Selection Runtimeへの直接結合を局所確認した
- [ ] 更新候補の署名実境界で確認した
