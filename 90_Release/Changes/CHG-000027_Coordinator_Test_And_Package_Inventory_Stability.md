# 変更トレース: Coordinator試験とpackage inventoryの安定化（Coordinator Test and Package Inventory Stabilization）

- 変更ID: `CHG-000027`
- 状態: `Ready for Verification`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-19
- 対象: CRDD公式Repositoryの内部Coordinator、package Filesystem観測と動的Fake取消fixture
- 対象version: v0.18.0 Candidate
- 変更分類: `non-breaking`（既存のfail-closed条件を、Filesystem時刻および250 ms性能仮定に依存しない判定へ強化する）
- 移行要否: `migration_required: false`（schema、永続state、CLI grammarおよび公開machine contractを変更しない）
- 関連正本: [`19_Maintenance.md`](../../19_Maintenance.md#33-internal-typescript-runtime)、[`16_Quality_Assurance.md`](../../16_Quality_Assurance.md)、[`CHG-000025`](CHG-000025_Dynamic_Fake_Provider_Cancellation_Verification.md)、[`CHG-000026`](CHG-000026_Provider_Home_Protection_Foundation.md)

## 結論

`CHG-000026`の最終履歴訂正候補`2e84bdf`をNode.js v24.19.0で再確認した際、同じ全386 contract test母集団で異なる2件の不安定性を観測した。並列runでは`ready_then_never_complete`のNode子processが250 ms以内にready markerを返さず取消所有fixtureが失敗し、逐次runでは同一timestamp tick内のdirectory entry追加をmetadata Identityだけで検出できずpackage inventory fixtureが失敗した。成功runだけを選択せず、`GCI-HOME-004`／`AG-CANCEL-FIXTURE-TIMING-001`と`GCI-HOME-005`／`AG-PACKAGE-RACE-001`として別原因のまま追跡する。

package inventoryは各directoryの最初の走査でsortedなentry名と種別を固定し、全file読取り後に同じdirectoryを再列挙して完全一致を要求する。directory Identity／realpath、fileの同一handle Identity／byte、link拒否および上限も従来どおりANDする。これにより追加、削除、fileとdirectoryの型変更をdirectory時刻の分解能に依存せず`blocked`にする。

動的Fake取消fixtureはRepository所有の子processから`spawn` eventを一度だけ観測する。`never_ready`は開始後すぐ所有終了処置へ進み、`ready_then_never_complete`だけを固定5秒上限でready待機し、`output_overflow`は所有completionを固定5秒上限で待つ。全異常scenarioで終了要求exact 1回とcloseを要求し、任意runner、argv、source、signalまたは実Provider入口は公開しない。

## 着手前整合と代表例

- 発火例: 初回directory走査後にentryが追加、削除または型変更されると、最終再列挙との差によりpackage候補を`blocked`にする。固定fixture childの`spawn`後に各異常scenarioを実行し、終了要求1回とcloseが揃う場合だけfixture結果を`verified`にする。
- 非発火例: entry集合とIdentityが不変なpackage観測、通常doctor、実Provider、OAuth、Egress、billingおよびProvider Homeには新しい処置を発火しない。
- 境界例: 同じtimestamp tick内のentry差も拒否する。子processが5秒以内に開始または対象scenarioの状態へ到達しない場合は終了処置後も`blocked`とする。
- 判定情報不足例: directory再列挙、子process開始、completionまたはcloseを確認できない場合は成功へ推定せず、既存の固定reasonと回復境界へ閉じる。

変更禁止範囲は、package観測の非Authority／非Capability／非Effect境界、動的Fake限定の来歴、実Provider readiness=false、Provider Network Effect=false、12 blocker、6 current-run evidence、Gate blocked、v0.18 Candidate、v0.17 Released Baseline、公開CLI／Checker／採用Repository Schemaおよび実OAuth／billing経路である。

## 契約母集団と利用側

契約母集団は`platform-provisioner-package-filesystem.ts`のdirectory／file安定観測、`docker-isolation.ts`のmodule-private owned attach process、対応する2 contract test、Platform Access TypeScript coverageおよびDynamic Fake Provider coverageである。利用側は署名manifest作成前のpackage観測、package Trust候補、動的Fake取消verification、全Coordinator test、coverage runner、CHG25／26の完了Gateである。

package inventoryの最終候補は再列挙の一致だけでAuthorityへ昇格せず、既存の署名、Release Identity、DACLおよびProvision Effect条件を置換しない。子processの`spawn`観測はfixture所有の開始同期だけであり、実Docker、実Provider、OAuthまたはOperation Capabilityの成立根拠にしない。

## 検証設計と現在品質状態

Node.js v24.19.0で、変更した2 contract fileの10／10、全Coordinator contract testの並列run 386／386を連続2回、逐次run 386／386を確認した。Coordinator typecheck／lint／format、Checker 151／151およびfull checkerも新固定版で確認する。

Platform Access TypeScript coverageはexact 19 source／18 testで、lines 6372／7164、functions 231／250、branches 988／1228、未到達240件である。compact JSON UTF-8＋末尾LFは140,355 byte、SHA-256 `9a9cd6171aa99937e884a98d6c231f156ed8d99a3a67edbac64ebcaaca82bd66`で、連続2回一致した。Dynamic Fake Provider coverageはexact 10 source／7 testで、lines 4071／5808、functions 167／218、branches 704／898、未到達194件、payload SHA-256 `542555e77e57dc6eba158c5f097de78cdad1316b62a891728463aa96fd8270f2`、stdout 134,164 byte／SHA-256 `eb9f4e7111191ee6f69481f01141951af675fe029e8db5d053389f843fd27d08`である。

未到達branchは各runner既存のIdentity別義務、理由、risk、代替確認、Owner=`Qual-Lab`、`humanDecision=not_required`およびrecheckへ接続し、100%へ丸めない。実Windows Release package、実Docker取消、実Provider／OAuth／Egressは今回のPass根拠にせず従来の`Not Verified`を維持する。現在品質状態は`Self-checked / Ready for Verification`であり、独立監査完了前に`Verified`またはFinding `Resolved`へ昇格しない。

## 専門探索・収束

package側では、(a) sleepまたはmtime強制、(b) directory metadataだけ、(c) exact entry再列挙を比較した。(a)はFilesystem分解能と試験時刻への依存を残し、(b)は同一tick差を見落とす反例が得られたため不採用とし、entry名・種別を直接比較する(c)を採用した。file byte／Identityおよびlink確認は別の攻撃面を所有するため維持する。

取消側では、(a)250 ms ready期限の維持、(b)全scenarioを一律5秒待機、(c)spawn開始同期後にscenario別条件を待つ方式を比較した。(a)はscheduler負荷を契約違反へ誤分類し、(b)は`never_ready`を毎回不要に遅延させるため不採用とした。(c)は開始確認とready／overflow条件を分離し、終了所有条件を弱めずに反復時間を限定できるため採用した。Node child process event仕様、Windows directory timestamp反例、既存one-owner termination patternを対象とし、実Provider cancellation一般、Host escape一般およびOS kernel侵害は対象外とする。

再評価契機は、package inventory形式、directory API、link／reparse方針、Node ChildProcess開始event、取消deadline、実Docker Adapterまたは実Provider lifecycleの変更である。追加の人間判断は不要である。

## 監査履歴と完了条件

固定Commit `2e84bdf89da01b425a01280de1b43b1f80c30871`／Tree `5f8f7599d0f6a8c30d2b06ac2427759896aadae1`／Parent `06289daff4593f0dc3d7827ae3730969703e2f26`の監査集合は、Agent／Architecture／Securityが`Fail`（`AG-PACKAGE-RACE-001` Major、`AG-CANCEL-FIXTURE-TIMING-001` Minor、いずれも初回監査から存在した見落し）、Documentが`Fail`（`DOC-HOME-R5-001` Major、今回の修正によって初めて確認可能）、Gap／Impactが`Fail`（`GCI-HOME-004`／`GCI-HOME-005` Major、いずれも今回の修正によって初めて確認可能）、Conformanceが`Fail / Not Eligible`であった。`DOC-HOME-R4-001`の履歴訂正は解消候補だが、全testの反復安定性が未成立のためCHG26を閉じられない。同集合は`Invalidated`／現在不流用とし、今回の2根本原因は`Applied / Self-checked — pending independent re-review`とする。

完了条件は、新固定Commit／Treeで全機械確認、並列2回と逐次1回の全386 contract test、両coverageの固定母集団と全未到達義務、Agent／Architecture／Security、Document、Gap／Impact、Conformanceの独立再監査を旧合否不流用で完了し、CHG26の最終履歴訂正と今回Findingを同じ現在状態へ伝播することである。採用、統合、Gate open、StableまたはReleaseの判断は本変更に含めない。
