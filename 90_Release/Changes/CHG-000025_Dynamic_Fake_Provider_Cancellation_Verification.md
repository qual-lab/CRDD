# 変更トレース: 動的Fake Provider取消検証（Dynamic Fake Provider Cancellation Verification）

- 変更ID: `CHG-000025`
- 状態: `Ready for Verification`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-19
- 対象: CRDD公式Repositoryの内部Coordinator、固定Docker Fake Providerおよび専用verification command
- 対象version: v0.18.0 Candidate
- 変更分類: `breaking`（privateな取消観測契約とcoverage母集団を追加し、通常診断や実Provider取消との互換推定を認めない）
- 移行要否: `migration_required: true`（Repository内実装、試験、package commandおよび現在説明を同時更新する。supported production consumer／Provider stateは0で永続変換はない）
- 関連正本: [`19_Maintenance.md`](../../19_Maintenance.md#33-internal-typescript-runtime)、[`CHG-000015`](CHG-000015_Coordinator_Runtime_1_0.md)、[`CHG-000022`](CHG-000022_Provider_Lifecycle_Foundation.md)、[`CHG-000023`](CHG-000023_Dynamic_Fake_Provider_Lifecycle.md)、[`CHG-000024`](CHG-000024_Dynamic_Fake_Provider_Failure_Verification.md)、[`tools/coordinator/README.md`](../../tools/coordinator/README.md)、[`tools/coordinator/threat-model.md`](../../tools/coordinator/threat-model.md)

## 結論と変更経路

通常の`doctor --isolation`を非同期化せず、専用`dynamic-fake-provider:verify-cancellation`だけに固定Fakeの取消検証を追加する。Repository所有の固定Docker CLI、固定Digest image、`--network=none`、固定Python source、Operation mountおよび回復経路を使い、Fakeのready出力を確認した後に固定`SIGTERM`を発行する。同じrunで固定ack、status 42、5秒以内の終了、同一mount Identity、container ID／name／labelの3軸不存在およびHost cleanupがすべて成立した場合だけ、Fake限定の`verified`を返す。

plain execution結果のnormalizerはcallerが構成できるため`candidate`に留める。専用実行結果もRuntime Authority、Operation Capability、実Provider readiness、Provider Network Effectまたは課金Effectを発行しない。実Codex／Claude、OAuth、Egress、専用Home、mount Grant、任意signalおよび通常Operation取消は対象外である。

本変更はprocess、Docker Effect、回復および観測来歴を扱う非自明なprivate変更である。候補固定後はAgent／Architecture／Security Review、Document Audit、Gap／Impact AuditおよびConformance Auditを旧合否不流用で実施する。公開Communication、DiscoveryおよびUIは公開成果物、市場行為または操作grammarを変えないため非該当である。

## 契約、発火および停止

- 発火例: 人間または検証工程が専用package commandを明示実行し、固定Docker Engine／CLI／image／mountの前提が成立した場合だけ固定取消scenarioを1回実行する。
- 非発火例: 通常`doctor`、`doctor --isolation`、Runtime、実Codex／Claude要求、source importまたはcontract testは取消scenarioを起動しない。
- 境界例: plain fixtureの正しいack／status／graceは`candidate`に留まる。取消要求なし、負数／小数／5001 ms／非数grace、ack差、status差、signal差またはoutput上限超過は`blocked`である。
- 情報不足例: CLI／Engine／image／mount Identity、Fake ready、取消command、ack、終了、3軸不存在またはHost cleanupのいずれかを確認できなければ`blocked`とし、実際のEffectと必要な回復情報を保持する。

取消は固定container IDへ`docker container kill --signal SIGTERM`をargv配列で送る。shell、PATH探索、任意signal、任意command、任意source、任意image、Host Home、Credential、Docker socket mountまたはNetworkを許可しない。stdout／stderrは読取り開始時から各65,536 byte上限とし、raw byte、Host Path、container ID、recovery token、CredentialまたはOAuth stateをEvidenceへ保存しない。処置後失敗で診断Docker／Filesystem Effectをfalseへ巻き戻さず、cleanup不明時はOperation領域を保持して回復へ接続する。

## 専門探索と収束

| 案 | 利点 | 反証・短所 | 採否 |
| --- | --- | --- | --- |
| 通常`doctor --isolation`全体を非同期化 | 将来Operation cancelへ近い | 通常診断の待ち時間、状態機械、回復面と利用側を同時に拡大する | 不採用 |
| detached containerを一定時間後にstop | 実装が短い | Fakeのreadyとsignal受領を同じstdout来歴へ結合できない | 不採用 |
| Provider自己申告またはplain結果の再評価 | unit試験しやすい | callerが同形結果を偽造できる | 不採用 |
| 専用async attach＋固定SIGTERM＋既存cleanup | 通常診断を変えず受領、終了、不存在、cleanupを同じrunで確認できる | Fake／SIGTERMだけであり実Provider cancelを証明しない | 採用 |

判断を変え得る不確実性は、実Provider CLIの取消契約、Windows／Dockerの別signal、取消競合、Host escape一般およびcleanup失敗時の実回復である。現在案は固定Fake／固定SIGTERM／専用commandに限定することで収束する。保持条件は固定image／source／signal、trusted CLI Identity、bounded output／grace、同一mount再確認、3軸不存在、Host cleanupおよびAuthority／Capability非発行である。再評価契機は通常lifecycleの非同期化、実Provider Adapter、signal変更、Docker image／CLI更新、回復契約変更または実Operation cancel着手である。

## 契約母集団と利用側

- 契約母集団: `docker-isolation.ts`の固定取消source／async attach／normalizer／実行／cleanup、専用verification script、動的Fake coverage runner、package command、README、threat model、Maintenanceおよび本CHG。
- 利用側母集団: 専用取消contract test、coverage contract test、通常doctor／`doctor --isolation`の非利用境界、Host recovery、execution environment、naming／source closureおよびfull checker。
- 非影響: Provider Profile／Authority Registry、OAuth Home／mount Grant、Egress、Rust platform helper、公開Checker、採用Repository Schema、入力CLI grammar、v0.17 Released Baseline。

## 品質義務と自己確認

contract testは固定security args、固定source、plain候補の非Authority、graceの0..5000 safe integer、取消要求、ack、終了statusおよびsignal差を確認する。専用実Docker verificationはready、`SIGTERM`、ack、status 42、grace、container不存在、Host cleanup、残留Operation directory 0、診断Effectの実績およびNetwork／Authority／Capability／readiness非発行を同じrunで確認する。通常doctor、実Provider、任意signalおよびcleanup失敗はこの結果へ流用しない。

動的Fake coverageは取消verification scriptを加えたexact 10 source／7 testを固定母集団とする。固定Node.js `v24.19.0`、cwd `tools/coordinator`、command `node ./scripts/check-dynamic-fake-provider-coverage.ts`の連続実行で、payload SHA-256は`A5F817CFAE3F6718A6E48120F93194C1EB35F9383909A3599CB375A6C54AFBD1`、compact JSON UTF-8＋末尾LFのstdoutは129,194 byte、SHA-256は`8DDB0B4148984772BBACCFDCB5C7941FC13714E88C36D34AB5D76036AF25CF33`、stderrは0 byteだった。合計はlines 3857/5646、functions 150/197、branches 671/858で、未到達187 branchを同じ決定論的JSONのIdentityからreason、risk、代替確認、Owner=`Qual-Lab`、`humanDecision:not_required`および再確認契機へ一対一接続する。100%未達をPassへ読み替えず、実Docker結果とunit coverageを相互代替しない。

初回自己確認の実Docker runは`status:verified`、固定reason、`SIGTERM`、ready／ack／終了／container不存在／Host cleanupすべて`true`、grace 187 ms、stdout 128 byte、stderr 0 byte、exit 42、残留Operation directoryなしだった。診断Docker container／Filesystem Effectは`true`、Provider Network Effect、Runtime Authority、Operation Capabilityおよび実Provider readinessは`false`である。この値は候補固定前の実装確認であり、固定候補のEvidenceまたは独立確認を代替しない。

最初の固定Commit `bf3b37a297d87aa84696aad930469a119c83957d`の実測後、自己確認でFakeがhandler登録前にreadyを出す競合を検出した。readyの発行順をhandler登録後へ変更し、同順序をcontract testで固定したため、この旧固定版とそのEvidenceを現在判定へ流用しない。

最終固定Commit `9c013ceb3a26581b4fa48c4669cd58900aef8de7`、Tree `18906495e7f76dc21aeada52554c6ea920160eb3`、Parent `f3ea04da1bdb3a7d4a00bd45f0c4ad508676256f`のclean worktreeで専用verificationと全機械確認を再実行した。固定runは`verified`、grace 221 ms、stdout 128 byte、stderr 0 byte、exit 42、container／Operation directory残留0で、全非発行境界を維持した。実行条件、正規化出力Hashおよび主張しない範囲は[`最終固定Fake取消検証 Evidence`](Evidence/CHG-000025_Docker_Cancellation_E2E_9c013ce.md)に記録する。

現在、人間による追加判断は必要ない。候補固定と全機械確認、固定候補上の実Docker再実行、Evidenceおよび必須独立監査が完了するまで`Ready for Verification`を維持する。実Codex／Claude、OAuth、Provider endpoint Egress、専用Home保護、mount Grant発行／失効、通常／実Provider取消および実Operationは未実装または`Not Verified`であり、12 blocker、6 current-run evidence、Gate blocked、Authority／Capability非発行、v0.18 Candidate、v0.17 Released Baselineおよび非Releaseを維持する。
