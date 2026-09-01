# v0.18.1 Coordinator Runtime実行Identityの最終候補検証

状態: 固定候補の実行検証完了、独立再確認待ち  
実行日: 2026-09-01  
対象変更: [CHG-000056](../../90_Release/Changes/CHG-000056_Coordinator_Adoption_Interface_Correction.md)

## 結論

共通起動入口から到達する署名・4経路・Recovery実装と、その推移的な静的依存を含むRuntime実行Identityを固定した。同じIdentityに対し、新規clone、親Repository内submodule、4経路および復旧7シナリオを実行し、いずれも期待する結果を得た。

本結果は公開判断を代替しない。Source、ManifestおよびRuntime実行Identityを再識別できるように固定し、独立再確認と人間によるRelease判断へ渡す。

## 固定Identity

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

Source AからBまでの変更Pathは`template/tools/coordinator/coordinator-package-manifest.json`一件だけである。以後の本記録、CHG、Roadmapおよび品質状態の更新はRuntime実行集合外であり、Runtime実行Identityが不変であることを機械確認する。

## 新規採用形態

新規cloneと、親RepositoryがCRDDを`00_CRDD` submoduleとして持つ構成の双方で、共通起動入口の`capabilities --json`と`task --request-stdin --json`を使用した。

| 採用形態 | 一般Task | cleanup | 正本変更 | 候補処置 |
|---|---|---|---|---|
| 新規clone | `completed` / `coordinator_task_candidate_approved` | 確認済み | なし | 発行後に破棄 |
| 親Repository＋submodule | `completed` / `coordinator_task_candidate_approved` | 確認済み | なし | 発行後に破棄 |

ローカル結果SHA-256は`3e486918d1b07b120f552f0be826a4ef35eca0ba321ff0962836be0203a7d884`である。Provider生出力、Host Pathまたは秘密を本記録へ転記しない。API key、従量課金fallbackおよび追加購入は使用していない。

## 4経路

記録IDは`e06c7b53-e861-46fa-92d8-851d2f03d575`、結果SHA-256は`161ca169cf2715297f13280c908a4e177d4cf2eb4b6269d43c74daf4f03e5027`である。

- forward
- reverse
- same-codex
- same-claude

4/4経路が各一回で完了し、安全再試行0だった。全経路で候補内容一致、候補破棄、cleanup、正本無変更を確認した。手動Recovery、Process再起動、Effect不明、Recovery ID残存、Host Path・秘密・Provider生出力の報告はない。

## 復旧

記録IDは`d65be967-8702-4d03-b5b5-1d06339c4b19`、結果SHA-256は`f06109890334864b96256e3f3bf29306ce97dbb11a00e66a8dfbc50b28dc685c`である。

- timeout
- 出力量超過
- 不正出力
- 非0終了
- cancel
- cleanup観測不明からのfresh recovery
- 親Process消失後の子Process終了とfresh recovery

7シナリオは期待する停止・回復結果へ一致した。残存Operation Directoryはなく、行列全体のcleanup確認済み、手動Recovery不要である。固定検証Workerだけを使用し、Provider CredentialおよびProvider Network Effectは発行していない。

## 機械確認

- Source AでCoordinator試験1351/1351、Windows Process Gate 7/7、直接影響試験、型検査、Traceability、lint、formatを確認した。
- manifest-only Bと本記録作成前の全体Checkerは、Markdown 391件、リンク2708件、Anchor 923件を確認し、Error 0、Warning 0だった。
- 本記録を含む最終文書候補では、Runtime実行Identityの不変確認、全体Checkerおよび独立再確認を改めて行う。

## 限界と次のGate

本検証はWindows Local Personal Profile、固定Node.js、固定Docker Desktop、選択済みのCodex／Claude Code Subscriptionおよび固定公開Taskを対象とする。全OS、全Provider、任意TaskまたはProvider内部処理を一般化しない。

残るGateは、同じ最終文書候補に対するArchitecture／Security、Test／UX、Document／Gap／Impact／Conformanceの独立再確認と、人間による統合・Release判断である。
