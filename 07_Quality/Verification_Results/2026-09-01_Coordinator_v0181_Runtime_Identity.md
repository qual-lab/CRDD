# v0.18.1 Coordinator Runtime実行Identityの検証結果

状態: 現行署名Identityの実測完了、最終独立確認待ち
実行日: 2026-09-01（2026-09-02に独立確認結果を反映）
対象変更: [CHG-000056](../../90_Release/Changes/CHG-000056_Coordinator_Adoption_Interface_Correction.md)

## 結論

字句解析、共通Launcher結合および選択scriptの子Process／Worker target結合を含むSource Aを署名前に独立確認し、Code、Document、History／Traceabilityの3系統すべてで指摘0件のPassを得た。そのSource AからRuntime実行Identityを署名し、manifest一件だけを加えた配布Commit Bを作成した。

現行Identityに対し、新規clone、親Repository内submodule、4経路および復旧7シナリオを実行し、期待する結果を得た。Providerの一過性な不正JSON出力で最初の4経路行列がreverseにて安全停止したが、cleanup確認後の同一reverse単独実行と、新しい行列全体の再実行は完了した。最終行列は4/4経路、再試行0、cleanup確認済みである。本結果は公開判断を代替しない。

## 現行署名Identity

| 対象 | 値 |
|---|---|
| Source A Commit | `0211aaa4a61f4380104e720bb16de499972ac423` |
| Source A Tree | `27908bc8735a8a9d9b23e769cdb0449d690a3f74` |
| manifest-only B Commit | `2e70cfc2c4e37f465f84fb5108c58f299bad5b31` |
| manifest-only B Tree | `41a575fa6b47ca16660510dbda222c5670c5a80b` |
| Runtime実行Identity | `e290df01fc74ce6bc582c270058d99d9ddd156867e3397da967e868441dd9d41` |
| Package content root | `e264c1cb39ab019ddb5c66740755825b14255481badfc7c2e6409c216d694fe7` |
| Manifest identity | `d474b837786857fc254c812c32a7986494d4ba25f8da9ca610262f9e46a46693` |
| Manifest file SHA-256 | `475e24422617c80c7b574a2b3b92a1d14c29946b7c50e5724be22ff44f4f7a34` |
| Release sequence | `2026090107` |

Source AからBまでの変更Pathは`template/tools/coordinator/coordinator-package-manifest.json`一件だけである。B上のPackage検証はSource A、Package root、Manifest署名およびRuntime実行Identityの一致を確認した。

## 不採用になった固定Identity

| 対象 | 値 |
|---|---|
| Source A Commit | `ae35bb4889e0359d08166adb574aadf483736d99` |
| Source A Tree | `85c75d854b4a9f04208793f8cff903dfcb0bd6d4` |
| manifest-only B Commit | `423cb510e995915a0ce113de3e317a6f7e491132` |
| manifest-only B Tree | `33a27615bd7df06eda9237fc391d57f4f49faae4` |
| Runtime実行Identity | `33cca9b840e46fe290530232dcdd09c0f99e3d63b01c59f51362112428e2473a` |
| Package content root | `b0dde062442a8b874d5bd9b8e9d9e0406ae74437ae09373955134bccc917de74` |
| Manifest identity | `68dfb33e417867ab1256bcfdc2861fbe5e13f058a2f080f3af1d125bba35850f` |
| Manifest file SHA-256 | `698e4aa1971ac0209b3d363e82f1af10f29d66d60e165ed5f66e7d9175a8e922` |
| Release sequence | `2026090106` |

Source AからBまでの変更Pathは`template/tools/coordinator/coordinator-package-manifest.json`一件だけである。このIdentityは依存閉包の不足により不採用であり、以後の字句解析・Launcher・子Process targetの変更はRuntime実行集合内なのでIdentityを変更する。

## 新規採用形態

新規cloneと、親RepositoryがCRDDを`00_CRDD` submoduleとして持つ構成の双方で、共通起動入口の`capabilities --json`と`task --request-stdin --json`を使用した。

| 採用形態 | 一般Task | cleanup | 正本変更 | 候補処置 |
|---|---|---|---|---|
| 新規clone | `completed` / `coordinator_task_candidate_approved` | 確認済み | なし | 発行後に破棄 |
| 親Repository＋submodule | `completed` / `coordinator_task_candidate_approved` | 確認済み | なし | 発行後に破棄 |

新規cloneの記録IDは`20d5d4d5-0b30-445f-99a6-52c1c6580f44`、親Repository＋submoduleの記録IDは`4e1d8f5a-3608-4d16-834a-62685bd457ca`である。集約SHA-256は`941a7d36b33d18c915952bf05575e7a6bb0befdce2fba1c98cf0f4956b8c80cb`である。両方で実行前後のExecution Revision一致、Candidate base一致、exact capability、候補発行・破棄、正本不変およびcleanupを確認した。Provider生出力、Host Pathまたは秘密を本記録へ転記しない。API key、従量課金fallbackおよび追加購入は使用していない。

## 4経路

完了記録IDは`3eaeaea5-7191-46ce-8424-dc97e99b7932`、結果SHA-256は`f2415476e4198a29d0adc5a2e7e73fd993ab445df7f4f3a2dfebaea57471a4c9`である。

- forward
- reverse
- same-codex
- same-claude

4/4経路が各一回で完了し、安全再試行0だった。全経路で候補内容一致、候補破棄、cleanup、正本無変更を確認した。手動Recovery、Process再起動、Effect不明、Recovery ID残存、Host Path・秘密・Provider生出力の報告はない。

## 復旧

記録IDは`96e53dc3-21a1-4929-a1da-4f2a2bac631b`、結果SHA-256は`cb66d653e5b7abdd8afdd740d2387804e630f2e9aed6ec4ed4b37c3e33d691bc`である。

- timeout
- 出力量超過
- 不正出力
- 非0終了
- cancel
- cleanup観測不明からのfresh recovery
- 親Process消失後の子Process終了とfresh recovery

7シナリオは期待する停止・回復結果へ一致した。残存Operation Directoryはなく、行列全体のcleanup確認済み、手動Recovery不要である。固定検証Workerだけを使用し、Provider CredentialおよびProvider Network Effectは発行していない。

## 機械確認

- Source AでCoordinator試験1352/1352、Windows Process Gate 7/7、依存閉包・Launcherの直接影響試験27/27、型検査、Traceability、lint、formatを確認した。
- manifest-only Bと本記録作成前の全体Checkerは、Markdown 392件、リンク2710件、Anchor 921件を確認し、Error 0、Warning 0だった。
- 署名前プレチェックはCode、Document、History／Traceabilityの3系統すべてで指摘0件のPassだった。
- 本記録を含む最終文書候補では、Runtime実行Identityの不変確認、全体Checkerおよび独立再確認を改めて行う。

## 限界と次のGate

本検証はWindows Local Personal Profile、固定Node.js、固定Docker Desktop、選択済みのCodex／Claude Code Subscriptionおよび固定公開Taskを対象とする。全OS、全Provider、任意TaskまたはProvider内部処理を一般化しない。

残るGateは、文書反映後もRuntime実行Identityが不変であることの確認、同じ固定候補に対するArchitecture／Security、Test／UX、Document／Gap／Impact／Conformanceの独立再確認、および人間による統合・Release判断である。
