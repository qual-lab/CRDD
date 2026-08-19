# 変更トレース: 動的Fake Provider失敗検証（Dynamic Fake Provider Failure Verification）

- 変更ID: `CHG-000024`
- 状態: `Ready for Verification`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-19
- 対象: CRDD公式Repositoryの内部Coordinator、Docker Fake Provider Probeおよび専用verification command
- 対象version: v0.18.0 Candidate
- 変更分類: `breaking`（privateなFake failure reasonとcoverage母集団を固定し、旧generic failure表示を互換受理しない）
- 移行要否: `migration_required: true`（Repository内実装、試験、package commandおよび説明を同時更新する。supported production consumer／Provider stateは0で永続変換はない）
- 関連正本: [`19_Maintenance.md`](../../19_Maintenance.md#33-internal-typescript-runtime)、[`CHG-000015`](CHG-000015_Coordinator_Runtime_1_0.md)、[`CHG-000022`](CHG-000022_Provider_Lifecycle_Foundation.md)、[`CHG-000023`](CHG-000023_Dynamic_Fake_Provider_Lifecycle.md)、[`tools/coordinator/README.md`](../../tools/coordinator/README.md)、[`tools/coordinator/threat-model.md`](../../tools/coordinator/threat-model.md)

## 結論と変更経路

CHG-000023で通常`doctor --isolation`から分離した失敗scenarioを、専用`dynamic-fake-provider:verify-failures`だけが固定実行する。対象はtimeout、出力上限超過、不正結果およびnonzero exitの4件である。任意command、任意source、任意image、任意argvまたはcaller supplied期待値を受理せず、既存の固定Docker CLI、固定Digest image、`--network=none`、Operation mount、回復記録、3軸container不存在およびHost cleanupを再利用する。

本変更はCredential、process、Docker Effectおよび回復境界を扱う非自明なprivate変更である。完成固定版ではAgent／Architecture／Security Review、Document Audit、Gap／Impact AuditおよびConformance Auditを旧合否不流用で実施する。公開Communication、DiscoveryおよびUIは公開成果物、市場行為または操作grammarを変更しないため非該当である。

## 契約、発火および停止

- 発火例: 人間または検証工程が専用package commandを明示実行し、固定Docker Engine／CLI／image／mountの前提が成立する場合だけ、4 scenarioを順番に実行する。
- 非発火例: 通常`doctor`、`doctor --isolation`、Runtime、実Codex／Claude要求、source importまたはcontract testは専用失敗scenarioを起動しない。
- 境界例: timeoutは250 msを超えた固定2秒sleep、出力上限は固定70,000 byte、結果不正は固定non-JSON、nonzero exitは固定status 7である。各結果は専用固定reasonまたはgeneric failure reasonへ閉じ、cleanup成功で成功へ再昇格しない。
- 情報不足例: Docker CLI／Engine／image／mount Identity、result attribution、3軸不存在またはHost cleanupのいずれかを確認できない場合は`blocked`とし、回復情報を保持する。推測成功、別scenarioへのfallbackまたはHost rootの自動削除を行わない。

実行結果が`blocked`でも、Docker create submissionまたはOperation一時領域処置が発火した事実を`diagnosticDockerContainerEffectIssued`および`diagnosticFilesystemEffectIssued`へ保持する。Provider Network Effect、外部課金Effect、Runtime Authority、Operation Capabilityおよび実Provider readinessは常に`false`である。raw stdout／stderr、Host Path、container ID、recovery token、CredentialまたはOAuth stateを結果／Evidenceへ保存しない。

## 専門探索と収束

| 案 | 利点 | 反証・短所 | 採否 |
| --- | --- | --- | --- |
| caller supplied command／source | scenario追加が容易 | production相当の任意実行権限と期待値偽造を導入する | 不採用 |
| test hook／runner injection | unit試験しやすい | production closureへcallback権限を持ち込み、Docker来歴を薄める | 不採用 |
| Fake用imageをscenarioごとに追加 | container内容を分離できる | managed imageと供給網母集団を増やす | 不採用 |
| 同一固定image内のRepository所有source allowlist | 既存隔離・回復経路をそのまま実測できる | 固定source表と全利用側の同期が必要 | 採用 |

判断を変え得る不確実性は、同期`spawnSync`では実行中cancel／signalを所有できないこと、意図的cleanup失敗や残存containerを安全に作ると回復riskが増えることである。このため現在は固定4 scenarioだけを採用し、signal、in-flight cancel、cleanup失敗および残存containerを`Not Verified`に保つ。再評価契機は非同期lifecycle着手、Docker image／CLI変更、回復契約変更または実Provider Adapter着手である。

## 契約母集団と利用側

- 契約母集団: `docker-isolation.ts`の固定scenario／normalizer／実行／cleanup、専用verification script、動的Fake coverage runner、package command、README、threat modelおよび本CHG。
- 利用側母集団: doctor contract test、専用verification contract test、coverage contract test、通常`doctor --isolation`の非利用境界、Host recovery、execution environment、naming／source closureおよびfull checker。
- 非影響: Provider Profile／Authority Registry、OAuth Home／mount Grant、Egress、Rust platform helper、公開Checker、採用Repository Schema、入力CLI grammar、v0.17 Released Baseline。

## 品質義務と現在状態

専用verificationは4 scenarioについて、固定source／expected reason、`blocked`、container／Host cleanup、残留container 0、残留Operation directory 0、回復不要、診断Effectの実績およびNetwork／Authority／Capability／readiness非発行を同一runで確認する。contract testは任意source／argv／imageを受理する公開入口がないこと、timeout／output overflowのOS error分類、固定security argsおよび通常scenario不変を確認する。

動的Fake coverageは変更したfailure verification scriptを加えたexact 9 source／6 testを固定母集団とする。固定Node.js `v24.19.0`、cwd `tools/coordinator`、command `node ./scripts/check-dynamic-fake-provider-coverage.ts`の連続2回で、payload SHA-256は`300DD16DD34FE54BB793171AECA0D010EE55F63E4D6D3E13C4000E79413624D8`、compact JSON UTF-8＋末尾LFのstdoutは126,067 byte、SHA-256は`6CF7E68B169438C572CE5A13F23B160B40DE8C70C17077698437C61EC6B53A62`、stderrは0 byteだった。

| source | line | function | branch |
| --- | ---: | ---: | ---: |
| `docker-isolation.ts` | 990/2020 | 38/70 | 163/208 |
| `provider-lifecycle.ts` | 327/327 | 9/9 | 78/78 |
| `execution-environment.ts` | 813/883 | 40/41 | 125/170 |
| `host-recovery-record.ts` | 66/74 | 2/3 | 8/15 |
| `plain-data-snapshot.ts` | 141/141 | 4/4 | 43/43 |
| `doctor.ts` | 665/710 | 24/25 | 115/173 |
| `verify-dynamic-fake-provider-failures.ts` | 18/72 | 0/1 | 1/2 |
| `check-platform-access-ts-coverage.ts` | 536/601 | 28/30 | 105/131 |
| `check-dynamic-fake-provider-coverage.ts` | 135/209 | 2/5 | 3/4 |
| 合計 | 3691/5037 | 147/188 | 641/824 |

未到達183 branchは同じ決定論的JSONでsource／line／block／branch Identityごとに、理由、risk、代替確認、Owner=`Qual-Lab`、`humanDecision:none`および再確認契機へ一対一接続する。主な未到達はOS／Docker例外、防御的cleanup／recovery、actual CLI分岐およびrunner自身の失敗処理であり、今回の固定4 scenario、contract負例、通常`doctor --isolation`および明示recoveryが代替確認を分担する。100%未達をPassへ読み替えず、実Docker結果とunit coverageを相互代替しない。固定候補の実Docker Evidenceは候補Commit固定後に追記する。

## 固定候補の実Docker結果

固定Commit `967f1b625c5075b06ab29d7d411f15b69dd56db5`、Tree `4aabd464cad5ec3b66adc551fc18b4e1b912742a`、Parent `95ce472c12d0836dcb5e354e785b0cc0cd09706d`のclean worktreeで、固定Node.js `v24.19.0`から専用verificationを実行した。4 scenarioはすべて期待する`blocked` reasonへ一致し、Host cleanupは全件`confirmed`、実行後の所有containerとOperation一時Directoryはともに0、回復は不要だった。診断Docker container／Filesystem Effectは全件`true`、Provider Network Effect、Runtime Authority、Operation Capabilityおよび実Provider readinessは全件`false`である。固定環境、結果Hashおよびraw出力非保持境界は[`実Docker失敗scenario Evidence`](Evidence/CHG-000024_Docker_Failure_E2E_967f1b6.md)に記録する。

同じ候補内容について、Coordinatorのstrict typecheck／lint／formatはPass、contract testは374/374、Checker packageのcheckはPass、contract testは151/151だった。全Repository checkerはEvidence追加前505 files／319 Markdown／1920 links／567 anchors、Evidence追加後506 files／320 Markdown／1921 links／567 anchorsを確認し、いずれもError 0／Warning 0だった。Rust helper、公開Checker contract、Profile／Registry、実Providerおよび公開SchemaはNo Impactであり、既存Rust結果を本変更の成立根拠へ流用しない。

現在、人間による追加判断は必要ない。実Codex／Claude、OAuth、Provider endpoint Egress、専用Home保護、mount Grant発行／失効、実行中cancelおよび実Operationは未実装または`Not Verified`であり、12 blocker、6 current-run evidence、Gate blocked、Authority／Capability非発行、v0.18 Candidate、v0.17 Released Baselineおよび非Releaseを維持する。
