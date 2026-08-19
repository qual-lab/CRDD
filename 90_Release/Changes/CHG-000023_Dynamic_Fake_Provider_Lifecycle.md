# 変更トレース: 動的Fake Providerライフサイクル観測（Dynamic Fake Provider Lifecycle Observation）

- 変更ID: `CHG-000023`
- 状態: `Verified`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-18
- 対象: CRDD公式Repositoryの内部Coordinator、Docker Fake Provider Probe、Providerライフサイクル観測およびprivate doctor JSON
- 対象version: v0.18.0 Candidate
- 変更分類: `breaking`（private doctor JSONを`reportVersion: 3`から4、Provider lifecycle contractをrevision 1から2へ更新する）
- 移行要否: `migration_required: true`（Repository内producer、exact contract testおよびfixtureを同時更新し、旧revisionのalias／fallbackを設けない。supported production consumer／Provider stateは0で永続変換はない）
- 関連正本: [`19_Maintenance.md`](../../19_Maintenance.md#33-internal-typescript-runtime)、[`CHG-000015`](CHG-000015_Coordinator_Runtime_1_0.md)、[`CHG-000022`](CHG-000022_Provider_Lifecycle_Foundation.md)、[`tools/coordinator/README.md`](../../tools/coordinator/README.md)、[`tools/coordinator/threat-model.md`](../../tools/coordinator/threat-model.md)

## 結論と着手前整合

既存のDocker隔離Probeが所有する固定Docker CLI、固定Digest image、`--network=none`、固定mount、container Identity、回復記録およびID／name／labelの3軸不存在確認を、Repository所有の動的Fake Provider観測へ結合する。通常の`doctor --isolation`は成功scenarioを1回だけ実行し、意図的timeout、取消、出力超過または残存scenarioを毎回は発火しない。これにより通常診断の遅延と回復riskを増やさず、失敗scenarioは専用verificationで同じ固定経路を確認する。

現在の同期Docker経路は正常結果、timeout、出力上限、結果形式、container／process tree不存在およびHost cleanupを観測できる。Nodeの`spawnSync`実行中に到着する取消は処理できないため、timeoutを取消と呼ばず、`inFlightCancellation:not_implemented`として分離する。今回の実装候補は成功scenarioの動的観測とtimeout／出力上限の正規化までであり、専用失敗scenarioの実Docker検証と実行中取消は`Not Verified`である。

## 変更経路と監査

本変更はCredential、process、container、Filesystem Effectおよび回復境界を横断する非自明なprivate contract変更である。着手前にSecurity／Architecture、Document、Gap／ImpactおよびConformanceの観点を照合した。完成固定版ではAgent／Architecture／Security Review、Document Audit、Gap／Impact AuditおよびConformance Auditを旧合否不流用で実行する。外部Communication、DiscoveryおよびUIは公開成果物、市場行為またはUIを変更しないため非該当である。

## 契約と責務

### 合成候補と動的観測

- CHG-000022の合成Fake観測候補はcaller supplied claimを評価する非Authorityの`candidate`として維持し、動的観測の来歴へ流用しない。
- 動的観測は`docker-isolation.ts`が実行中に所有するCLI、mount、containerおよびabsence capabilityからだけ作る。callerがplain object、状態列、時間または不存在を渡して同じ結果を成立させる入口を設けない。
- 動的観測が`verified`となるのは、Repository所有来歴、status 0／signalなし／errorなしのexact結果、30秒以内の有限safe integer経過時間、同じmount capabilityの実行後Identity再確認、同じcontainerのID／name／label 3軸不存在および同じHost recovery遷移のcleanupを、module-privateの一回限りfinalizerが同じrunで全AND確認した場合だけである。中間状態に`verified`を置かず、どれか一つでも不成立なら内側観測と外側Probe／doctor結果をともに`blocked`とし、cleanup成功による再昇格を許さない。
- `fakeProviderExecuted`、`resultNormalizationVerified`、`containerAbsenceVerified`および`processTreeAbsenceVerified`はFake限定の観測事実である。`processTreeAbsenceVerified`は同じcontainerの3軸不存在から確認できるcontainer内process treeだけを指し、Hostへescapeした任意process一般の不存在を主張しない。Runtime Authority、Operation Capability、実Provider readiness、OAuth、quota、Egressまたは専用Provider Homeマウント許可を成立させない。

### Effectと機密情報

`doctor --isolation`はDocker container create／start／remove、回復recordおよびOperation一時Directoryを実際に処置するため、`diagnosticDockerContainerEffectIssued`と`diagnosticFilesystemEffectIssued`を実事実として投影する。最終結果が`blocked`でも、既に発火したEffectをfalseへ巻き戻さず、回復情報と別軸で保持する。これは実Provider Filesystem Effect、Provider Network Effect、課金EffectまたはOperation Effectではない。`--network=none`を維持し、raw stdout／stderr、Host Path、container ID、recovery token、Credential値またはOAuth stateをdoctor／Evidenceへ出さない。

### private doctor revision 4

`doctor --json`はprivate `reportVersion: 4`だけを生成し、revision 3をalias受理しない。新しい`fakeProviderLifecycle`はpassive doctorで`not_evaluated`、明示`--isolation`で同じProbeの観測結果となる。`provider.codex.*`と`provider.claude.*`は実Provider用なので引き続き`not_implemented`である。入力CLI grammar、公開Checkerおよび採用Repositoryの公開Schemaは変更しない。

| private doctor成果物 | 移行 |
|---|---|
| `tools/coordinator/src/core/doctor.ts` | revision 4だけを生成 |
| `tools/coordinator/tests/doctor.contract.test.ts` | revision 4のtop-level shape、passive非発火およびFake限定境界をexact確認 |
| その他Repository内production decoder／consumer | 全数探索で0。alias／fallbackを新設しない |
| 公開CLI grammar／Checker／採用Repository Schema | 対象外、変更なし |

## 代表例

| 種類 | 条件 | 結果 |
|---|---|---|
| 発火例 | 明示`doctor --isolation`、固定CLI／image／mount、exact結果、3軸不存在およびHost cleanupが成立 | Fake限定の動的観測`verified`。全体Gateは`blocked` |
| 非発火例 | 通常`doctor`、合成候補評価、source checkout上の通常`doctor`（`--isolation`なし）または実Codex／Claude要求 | Fake／実Provider、Network、OAuthまたは課金を発火しない |
| 境界例 | timeout、出力上限、非0終了、signal、malformed結果、cleanupまたは不存在不明 | 個別reasonで`blocked`し、必要な回復情報を保持 |
| 情報不足例 | Docker CLI／engine／image／mount Identity、時計、container ID、absenceまたはcleanupが不明 | `blocked`または`Not Run`。過去Evidenceを流用しない |

## 契約母集団、利用側および変更禁止範囲

契約母集団はProvider lifecycle revision 2、Docker実行／正規化／cleanup／absence capability、Operation mount capability、Host recovery record、doctor producerおよび本変更トレースである。利用側母集団は`doctor --isolation`、doctor exact test、Docker isolation／recovery／Provider lifecycle tests、package scripts、TypeScript source closure、READMEおよび脅威モデルである。

Provider隔離Profile／Authority Registry revision 2、Trust Loader、File Bundle、Prelaunch、Egress、Rust wire、Windows有効ポインター、公開Checkerおよび採用Repository Schemaは変更しない。実Codex／Claude、OAuth、永続専用Home、マウント許可binder、Egress Proxy、quota、Telemetry、Provider imageおよびOperation接続は引き続き未実装である。12 blocker、6 current-run evidence、Gate blocked、Authority／Capability非発行、v0.18 Candidateおよびv0.17 Released Baselineを維持する。

## 専門探索と収束

来歴、権限、試験性、取消、回復および実装量を比較軸に、次の方式を検討した。

| 方式 | 利点 | 反証・短所 | 判断 |
|---|---|---|---|
| plain resultの後段再評価 | 実装量が小さい | callerが同形objectを構成でき、実測来歴を偽装できる | 不採用 |
| exported injected Adapter | unit testしやすい | callerがrunner／argv／結果生成を差し替える権限面を広げる | production経路では不採用 |
| module-private one-shot capability | 同一Probe、container、mount、absenceおよびrecoveryへ来歴を結合できる | private stateと全失敗経路の失効確認が必要 | 現候補として採用 |
| async full lifecycle | 実行中cancelとgraceful／forced terminationを所有できる | 今回の実装量、並行状態および回復riskを拡大する | 将来再評価 |
| sync partial lifecycle | 既存固定Docker Probeを再利用し正常／timeout／出力分類とcleanupを限定確認できる | 実行中cancelを扱えず、実Docker failure E2Eが未検証 | 現候補として採用 |

plain result方式は来歴を閉じず、injection方式はproduction callerの権限を広げるため採らない。async方式はcancelを成立させ得るが、現在の変更範囲では状態と回復の未検証面を増やす。したがって、single finalizer、one-shot provenance、30秒以内のbounded sync success、post-run mount Identity、3軸absenceおよびHost cleanupの全ANDを保持条件として、sync partial lifecycleを採用する。この選択は正常Docker E2EをFake限定で確認できるが、意図的失敗Docker E2Eやcancelを成立させず、現在品質を`Partially Verified`に保つ。再評価契機はasync lifecycle／cancel着手、固定image／CLI変更、実Provider Adapter着手、cleanup／provenance契約変更である。

## 固定版2d15653の監査履歴

固定Commit `2d156534f1c5a5f79bba6dc397afa6c77e07d8b5`、Tree `8e173ca914a0c487c5f7ce272206d708e4db1d80`、Parent `8b1ec1867e336fe9d21d16a93681131c9db60ee8`の監査集合は、次の指摘を受けて`Invalidated`とし、現在の合否へ流用しない。

| 監査 | 正式結果 | Finding／重大度 | 4分類 | 処置状態 |
|---|---|---|---|---|
| Agent／Architecture／Security | Pass／Finding 0 | なし | 全区分0 | 旧結果不流用 |
| Document | Fail | `DOC-DYNAMIC-001`／Major | 今回の修正によって新たに発生 | Applied／Self-checked — pending independent re-review |
| Gap／Impact | Fail | `GCI-23-001`／Major、`GCI-23-002`／Minor、`GCI-23-003`／Moderate | 初回監査のためN/A | Applied／Self-checked — pending independent re-review |
| Conformance | Fail／Not Eligible | C-07、C-11、PL-16、PL-19 | Conformanceは4分類対象外 | Applied／Self-checked — pending independent re-review |

`DOC-DYNAMIC-001`はsynthetic／dynamic／real Providerの現在説明と非発火例へ、`GCI-23-001`はsingle finalizerと失敗単調性へ、`GCI-23-002`はREADME現在状態へ、`GCI-23-003`は本節の代替比較、反証、保持条件および収束根拠へ処置した。独立再監査が完了するまで`Resolved`とは扱わない。

## 検証義務と現在状態

- unit／contract: exact result、malformed、nonzero、signal、timeout、出力上限、経過時間の負数／小数／30001／非有限値、post-run mount、3軸不存在、Host cleanup、run Identityの各AND軸、passive非発火、Fake限定Authority／Effect境界。fixture用pure判定は`candidate`／`blocked`だけを返し、private capabilityまたは`verified`を発行しない
- Docker integration: clean fixed Commitで成功、timeout、取消、出力超過、child残存scenarioを実測し、pre／postのcontainer、Operation rootおよびrecovery marker残留0を確認
- coverage: 変更したProvider lifecycle／Docker decision surface／doctor projectionと直接依存を固定母集団化し、source別line／function／branch、全未到達branch Identity、reason、risk、代替確認、Owner、human decisionおよび再確認契機を保持
- machine: TypeScript、Biome、Coordinator全test、Checker、source closure、full checkerおよびclean tree

固定前の自己確認はNode.js `v24.19.0`で実施した。Coordinatorは371／371、Checkerは151／151、両private packageの型検査／Biome／format、Repository full checkerはすべて合格した。full checkerの母集団は497 files、313 Markdown、1909 local links、566 anchors、26 Related、26 versioned documents、8 Stable IDs、68 remediation rowsで、Error 0／Warning 0である。

動的Fake Provider coverageは次の固定母集団と同じrunから得た。sourceは変更した実装、直接依存、共有LCOV parserおよびcoverage runner自身の8件、testは動的Fake契約、共有parser契約およびrunner契約の5件である。

| Source | Lines | Functions | Branches |
|---|---:|---:|---:|
| `docker-isolation.ts` | 905／1911 | 35／64 | 156／200 |
| `provider-lifecycle.ts` | 327／327 | 9／9 | 78／78 |
| `execution-environment.ts` | 813／883 | 40／41 | 125／170 |
| `host-recovery-record.ts` | 66／74 | 2／3 | 8／15 |
| `plain-data-snapshot.ts` | 141／141 | 4／4 | 43／43 |
| `doctor.ts` | 665／710 | 24／25 | 115／173 |
| `check-platform-access-ts-coverage.ts` | 536／601 | 28／30 | 105／131 |
| `check-dynamic-fake-provider-coverage.ts` | 126／200 | 2／5 | 3／4 |
| 合計 | 3579／4847 | 144／181 | 633／814 |

未到達branch 181件はrunnerがsource／line／block／branch Identityごとに`Not Verified`、reason、risk、代替確認、Owner=`Qual-Lab`、`humanDecision:not_required`および再確認契機へ一対一で出力する。連続2回のpayload SHA-256は`5E7674041665FF558CBB89D376D49F363F68E9C73DAFC7CAD44B911AE62596E8`、compact JSON UTF-8＋末尾LF exact 1件のstdoutは124310 byte、SHA-256は`E2BA5CE68D7944DFF5E7B3215FD34A7B4C9C36289C3285A9A7A2AD1AB1674F22`である。commandはRepository rootからNode.js `v24.19.0`で`node tools/coordinator/scripts/check-dynamic-fake-provider-coverage.ts`を実行する。未到達を100%へ換算せず、現在状態は`Partially Verified`とする。

後続の同一固定版環境ではDocker Desktop Linux Engineを起動し、固定Node.js `v24.19.0`で`doctor --isolation --json`の正常scenarioを実行した。Fake process実行、exact結果正規化、同一containerのID／name／label 3軸不存在、container内process tree不存在およびHost cleanupは同じrunで`verified`となり、診断Docker container Effectと診断Filesystem Effectは`true`、Provider Network Effect、Runtime Authority、Operation Capabilityおよび実Provider readinessは`false`だった。実行後の所有containerとOperation一時Directoryはともに0、回復不要である。固定対象、環境、結果Hashおよび保持しないraw出力の境界は[`実Docker正常scenario Evidence`](Evidence/CHG-000023_Docker_Success_E2E_63e33e7.md)に記録する。意図的失敗scenarioの実Docker動的検証、実行中取消および外部Providerは`Not Verified`である。OwnerはQual-Lab、再確認契機は専用failure verification完成、非同期Docker lifecycle導入、固定image／Docker CLI変更または実Provider Adapter着手時である。

## 停止・復旧

任意image／argv／env／Path／scriptをcaller入力にする、固定Identity／mount／network-noneが崩れる、container IDまたは3軸不存在を確認できない、cleanup／recoveryが不明、raw機密情報を公開する、Fake結果を実Provider／Authority／Capability／Gateへ昇格する、またはprivate doctor revision 4の利用側移行を完了できない場合は停止する。cleanupが不明な場合はOperation rootを保持し、既存の明示recoveryへ戻す。旧Evidence、古いtoken、Host CLI、Shell、PATH、API key、別Runtimeまたは実Providerへfallbackしない。

## 最終独立確認

固定Commit `dad6fb3679ae5508b684fb140e331833d5df039c`、Tree `3ba29c11c363d3ccf3e5269e0b228d9fe940f87f`、Parent `2d156534f1c5a5f79bba6dc397afa6c77e07d8b5`を旧合否不流用で確認した。Agent／Architecture／Security、Document、Gap／ImpactおよびConformanceはすべて`Pass`／Finding 0である。`DOC-DYNAMIC-001`と`GCI-23-001`〜`003`は現在の受入条件へ照合して`Resolved`とし、2d15653の旧監査集合は`Invalidated`の履歴として保持する。

固定結果と共通機械入力は[`CHG-000023 現在のレビュー記録`](Evidence/CHG-000023_Current_Review_Record_dad6fb3.md)へ保存する。

この`Verified`は動的Fake変更候補の検証完了だけを表す。実Docker正常E2EはFake限定で確認済みだが、意図的失敗E2E、実行中cancel、実Codex／Claude、OAuth、固定Provider image、EgressおよびOperation接続は`Not Verified`または未実装であり、12 blocker、6 current-run evidence、Gate blocked、Authority／Capability非発行、v0.18 Candidate、v0.17 Released Baselineおよび非Releaseを維持する。採用、統合、StableまたはReleaseの判断ではない。
