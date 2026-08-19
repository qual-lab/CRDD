# 変更トレース: 動的Fake Provider取消検証（Dynamic Fake Provider Cancellation Verification）

- 変更ID: `CHG-000025`
- 状態: `Verified`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-19
- 対象: CRDD公式Repositoryの内部Coordinator、固定Docker Fake Providerおよび専用verification command
- 対象version: v0.18.0 Candidate
- 変更分類: `breaking`（privateな取消観測契約とcoverage母集団を追加し、通常診断や実Provider取消との互換推定を認めない）
- 移行要否: `migration_required: true`（Repository内実装、試験、package commandおよび現在説明を同時更新する。supported production consumer／Provider stateは0で永続変換はない）
- 関連正本: [`19_Maintenance.md`](../../19_Maintenance.md#33-internal-typescript-runtime)、[`CHG-000015`](CHG-000015_Coordinator_Runtime_1_0.md)、[`CHG-000022`](CHG-000022_Provider_Lifecycle_Foundation.md)、[`CHG-000023`](CHG-000023_Dynamic_Fake_Provider_Lifecycle.md)、[`CHG-000024`](CHG-000024_Dynamic_Fake_Provider_Failure_Verification.md)、[`tools/coordinator/README.md`](../../tools/coordinator/README.md)、[`tools/coordinator/threat-model.md`](../../tools/coordinator/threat-model.md)

## 結論と変更経路

通常の`doctor --isolation`を非同期化せず、専用`dynamic-fake-provider:verify-cancellation`だけに固定Fakeの取消検証を追加する。Repository所有の固定Docker CLI、固定Digest image、`--network=none`、固定Python source、Operation mountおよび回復経路を使い、Fakeのready出力を確認した後に固定`SIGTERM`を発行する。同じrunで固定ack、status 42、5秒以内の終了、ホスト側Docker CLI attachプロセス（Host Docker CLI Attach Process）のclose、同一mount Identity、container ID／name／labelの3軸不存在およびHost cleanupがすべて成立した場合だけ、Fake限定の`verified`を返す。

plain execution結果のnormalizerはcallerが構成できるため`candidate`に留める。専用実行結果もRuntime Authority、Operation Capability、実Provider readiness、Provider Network Effectまたは課金Effectを発行しない。実Codex／Claude、OAuth、Egress、専用Home、mount Grant、任意signalおよび通常Operation取消は対象外である。

本変更はprocess、Docker Effect、回復および観測来歴を扱う非自明なprivate変更である。候補固定後はAgent／Architecture／Security Review、Document Audit、Gap／Impact AuditおよびConformance Auditを旧合否不流用で実施する。公開Communication、DiscoveryおよびUIは公開成果物、市場行為または操作grammarを変えないため非該当である。

## 契約、発火および停止

- 発火例: 人間または検証工程が専用package commandを明示実行し、固定Docker Engine／CLI／image／mountの前提が成立した場合だけ固定取消scenarioを1回実行する。
- 非発火例: 通常`doctor`、`doctor --isolation`、Runtime、実Codex／Claude要求、source importまたはcontract testは取消scenarioを起動しない。
- 境界例: plain fixtureの正しいack／status／graceは`candidate`に留まる。取消要求なし、負数／小数／5001 ms／非数grace、ack差、status差、signal差またはoutput上限超過は`blocked`である。
- 情報不足例: CLI／Engine／image／mount Identity、Fake ready、取消command、ack、Fake container内process終了、ホスト側attachプロセスのclose、3軸不存在またはHost cleanupのいずれかを確認できなければ`blocked`とし、実際のEffectと必要な回復情報を保持する。

取消は固定container IDへ`docker container kill --signal SIGTERM`をargv配列で送る。async attachを所有するmodule-private controllerはready、completion、出力上限およびcloseを同じchildへ結合し、異常経路では終了要求をexact 1回だけ発行してcloseまで待つ。正常終了済みのchildへ追加終了要求を発行しない。ready／completion timeout、出力上限超過または例外では、ホスト側attachプロセスのcloseを先に確認してからcontainer cleanup、3軸不存在、Host cleanupの順に進む。closeが不明でもcleanupは試みるが、全体結果を成功へ戻さない。shell、PATH探索、任意signal、任意command、任意source、任意image、Host Home、Credential、Docker socket mountまたはNetworkを許可しない。stdout／stderrは読取り開始時から各65,536 byte上限とし、raw byte、Host Path、container ID、recovery token、CredentialまたはOAuth stateをEvidenceへ保存しない。処置後失敗で診断Docker／Filesystem Effectをfalseへ巻き戻さず、cleanup不明時はOperation領域を保持して回復へ接続する。

## 専門探索と収束

| 案 | 利点 | 反証・短所 | 採否 |
| --- | --- | --- | --- |
| 通常`doctor --isolation`全体を非同期化 | 将来Operation cancelへ近い | 通常診断の待ち時間、状態機械、回復面と利用側を同時に拡大する | 不採用 |
| detached containerを一定時間後にstop | 実装が短い | Fakeのreadyとsignal受領を同じstdout来歴へ結合できない | 不採用 |
| Provider自己申告またはplain結果の再評価 | unit試験しやすい | callerが同形結果を偽造できる | 不採用 |
| Promiseだけを返す専用async attach | 実装が小さい | deadline後にHost側childを所有して終了・close確認できず、container cleanupを代用にし得る | 不採用 |
| module-private child controller＋固定SIGTERM＋既存cleanup | 通常診断を変えず受領、Fake終了、Host側attach close、不存在、cleanupを同じrunで確認できる | Fake／SIGTERMだけであり実Provider cancelを証明しない | 採用 |

判断を変え得る不確実性は、実Provider CLIの取消契約、Windows／Dockerの別signal、取消競合、Host escape一般およびcleanup失敗時の実回復である。現在案は固定Fake／固定SIGTERM／専用commandに限定することで収束する。保持条件は固定image／source／signal、trusted CLI Identity、bounded output／grace、同一childのone-owner終了、Host側attach close、同一mount再確認、3軸不存在、Host cleanupおよびAuthority／Capability非発行である。再評価契機は通常lifecycleの非同期化、実Provider Adapter、signal変更、Docker image／CLI更新、process ownership／回復契約変更または実Operation cancel着手である。

## 契約母集団と利用側

- 契約母集団: `docker-isolation.ts`の固定取消source／async attach／normalizer／実行／cleanup、専用verification script、動的Fake coverage runner、package command、README、threat model、Maintenanceおよび本CHG。
- 利用側母集団: 専用取消contract test、coverage contract test、通常doctor／`doctor --isolation`の非利用境界、Host recovery、execution environment、naming／source closureおよびfull checker。
- 非影響: Provider Profile／Authority Registry、OAuth Home／mount Grant、Egress、Rust platform helper、公開Checker、採用Repository Schema、入力CLI grammar、v0.17 Released Baseline。

## 品質義務と自己確認

contract testは固定security args、固定source、plain候補の非Authority、graceの0..5000 safe integer、取消要求、ack、終了statusおよびsignal差に加え、固定Node childのnever-ready、ready後未完了、出力上限超過で終了要求exact 1回とcloseを確認する。専用実Docker verificationはready、`SIGTERM`、ack、status 42、grace、Fake終了、ホスト側attach close、正常経路の追加終了要求0、container不存在、Host cleanup、残留Operation directory 0、診断Effectの実績およびNetwork／Authority／Capability／readiness非発行を同じrunで確認する。通常doctor、実Provider、任意signalおよびcleanup失敗はこの結果へ流用しない。

動的Fake coverageは取消verification scriptを加えたexact 10 source／7 testを固定母集団とする。固定Node.js `v24.19.0`、cwd `tools/coordinator`、command `node ./scripts/check-dynamic-fake-provider-coverage.ts`の連続実行で、payload SHA-256は`3ACF0948027E9A5B87690BF89704FBA213541A9A4D80F115E00EDB971631A8BA`、compact JSON UTF-8＋末尾LFのstdoutは134,164 byte、SHA-256は`959498EF964049B589239B03CFB0A292BE3F4D795EFE145ED1477E35D174407B`、stderrは0 byteだった。合計はlines 4057/5792、functions 165/214、branches 696/890で、未到達194 branchを同じ決定論的JSONのIdentityからreason、risk、代替確認、Owner=`Qual-Lab`、`humanDecision:not_required`および再確認契機へ一対一接続する。100%未達をPassへ読み替えず、実Docker結果とunit coverageを相互代替しない。

初回自己確認の実Docker runは`status:verified`、固定reason、`SIGTERM`、ready／ack／終了／container不存在／Host cleanupすべて`true`、grace 187 ms、stdout 128 byte、stderr 0 byte、exit 42、残留Operation directoryなしだった。診断Docker container／Filesystem Effectは`true`、Provider Network Effect、Runtime Authority、Operation Capabilityおよび実Provider readinessは`false`である。この値は候補固定前の実装確認であり、固定候補のEvidenceまたは独立確認を代替しない。

最初の固定Commit `bf3b37a297d87aa84696aad930469a119c83957d`の実測後、自己確認でFakeがhandler登録前にreadyを出す競合を検出した。readyの発行順をhandler登録後へ変更し、同順序をcontract testで固定したため、この旧固定版とそのEvidenceを現在判定へ流用しない。

最終固定Commit `9c013ceb3a26581b4fa48c4669cd58900aef8de7`、Tree `18906495e7f76dc21aeada52554c6ea920160eb3`、Parent `f3ea04da1bdb3a7d4a00bd45f0c4ad508676256f`のclean worktreeで専用verificationと全機械確認を再実行した。固定runは`verified`、grace 221 ms、stdout 128 byte、stderr 0 byte、exit 42、container／Operation directory残留0で、全非発行境界を維持した。実行条件、正規化出力Hashおよび主張しない範囲は[`最終固定Fake取消検証 Evidence`](Evidence/CHG-000025_Docker_Cancellation_E2E_9c013ce.md)に記録する。

Host側process所有是正の自己確認runは`status:verified`、`SIGTERM`、ready／ack／Fake終了／Host側attach close／container不存在／Host cleanupすべて`true`、正常経路のHost側終了要求0、grace 202 ms、stdout 128 byte、stderr 0 byte、exit 42、残留Operation directoryなしだった。この値は是正候補固定前の実装確認であり、新固定版のEvidenceまたは独立確認を代替しない。

現在、人間による追加判断は必要ない。候補固定と全機械確認、固定候補上の実Docker再実行、Evidenceおよび必須独立監査が完了するまで`Ready for Verification`を維持する。実Codex／Claude、OAuth、Provider endpoint Egress、専用Home保護、mount Grant発行／失効、通常／実Provider取消および実Operationは未実装または`Not Verified`であり、12 blocker、6 current-run evidence、Gate blocked、Authority／Capability非発行、v0.18 Candidate、v0.17 Released Baselineおよび非Releaseを維持する。

## `9c013ce`監査集合と是正状態

対象Commit `9c013ceb3a26581b4fa48c4669cd58900aef8de7`の監査集合は、Agent／Architecture／Securityが`Fail`（`AG-CANCEL-001`、Major、元監査の4分類literalは「今回の修正によって新たに発生した」）、Documentが`Pass`／Finding 0、Gap／Impactの初回結果が`Pass`／Finding 0、Conformanceの初回結果が`Pass`だった。このliteralの「今回」はCHG-000025の初回実装`f4e3250`を指し、技術的不備は`f4e3250`から`9c013ce`まで存在して`9c013ce`の初回Agent／Architecture／Security確認で検出された。全結果統合後、Gap／Impactは同根の`GCI-CANCEL-001`（Major、`9c013ce`の初回Gap／Impact監査時から存在したが見落としていた）を現在結果として`Fail`へ訂正し、Conformanceも`Fail`、claimを`Not Eligible`へ訂正した。初回のGap／Conformance Passを含む集合全体は`Invalidated`であり、現在候補へ流用しない。

`AG-CANCEL-001`／`GCI-CANCEL-001`の原因は、Promiseだけを返すasync attachがdeadline後のHost側childを所有して終了・close確認できず、container cleanupをHost側process終了の代用にできたことである。module-private controller、全異常経路の終了要求exact 1回、close待機、Fake終了とHost側attach終了の別投影、final ANDおよび固定Node負例を適用した。状態は`Applied / Self-checked — pending independent re-review`であり、新固定版の独立再監査前に`Resolved`とは扱わない。旧Evidenceは固定履歴として変更しない。

## `893e4a4`監査集合と文書是正状態

対象Commit `893e4a491ca24bdac10cb2a16e13d0fd11d3a229`、Tree `53bddf0247abd08180cdb2f5a473a158eaaeac05`、Parent `c20082c02d43588a30755ee6c52d4995fea3f7aa`の監査集合は、Agent／Architecture／Securityが`Pass`／Finding 0で`AG-CANCEL-001`を解消候補、Documentが`Conditional`（`DOC-CANCEL-R1-001`／`DOC-CANCEL-R1-002`、各Minor、今回の是正によって新たに発生した）、Gap／Impactが`Pass`／Finding 0で`GCI-CANCEL-001`を解消候補、Conformanceが`Pass`でCHG-000025変更scopeのclaimを`Eligible`とした。

Document 2件は、元Security監査の4分類literalが指す変更時点の曖昧さと、READMEでのHost側attach用語のlocale-first初出漏れである。元literal、技術的不備の発生時点、Security検出時点およびGap見落とし／訂正時点を上記のとおり分離し、README初出を局所修正した。処置状態は`Applied / Self-checked — pending independent re-review`であり、現在の監査集合全体も文書是正後の新固定版へは`Invalidated`／不流用とする。実装、machine contract、旧Evidence、coverage母集団、分母／分子およびHashは変更しない。新固定版のAgent／Architecture／Security、Document、Gap／ImpactおよびConformanceの全必須確認が終了するまで、旧Passまたは解消候補を現在版の`Resolved`へ流用しない。

## 最終独立確認

最終固定対象はCommit `1c874af10d8ad059e0a34253ae3d73d271654575`、Tree `e421aa2b8a0ae8094426ee3f87b893ee1b3b14f1`、Parent `893e4a491ca24bdac10cb2a16e13d0fd11d3a229`である。旧合否を流用せず、Agent／Architecture／Security、Document、Gap／ImpactおよびConformanceを同じ固定Identityと共通機械入力で再実行した。

- Agent／Architecture／Security: `Pass`／Finding 0。`AG-CANCEL-001`は`Resolved`。
- Document: `Pass`／Finding 0。`DOC-CANCEL-R1-001`／`DOC-CANCEL-R1-002`は`Resolved`。
- Gap／Impact: `Pass`／Finding 0。`GCI-CANCEL-001`は`Resolved`。
- Conformance: `Pass`。CHG-000025変更scopeのclaim eligibilityは`Eligible`。
- 新規候補4分類は各監査ですべて0件。

固定結果とSHAは[`現在のレビュー記録`](Evidence/CHG-000025_Current_Review_Record_1c874af.md)に保持する。この`Verified`はCHG-000025変更候補の検証完了だけを示す。実Provider／OAuth／Egress／通常Operation取消、12 blocker、6 current-run evidence、Gate blocked、Authority／Capability非発行、v0.18 Candidate、v0.17 Released Baselineおよび非Releaseは不変であり、採用、統合、StableまたはReleaseを意味しない。
