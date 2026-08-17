# 変更トレース: Rust成果物の署名済みRelease結合

- 変更ID: `CHG-000020`
- 状態: `Verified`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-17
- 対象: CRDD公式Repositoryの内部CoordinatorとRust製プラットフォームアクセス部
- 対象version: v0.18.0 Candidate
- 変更分類: `breaking`
- 移行要否: `migration_required: true`（CRDD公式RepositoryのRelease build／stagingだけ。採用Repositoryと公開CLIは対象外）
- 関連正本: [`19_Maintenance.md`](../../19_Maintenance.md#33-internal-typescript-runtime)、[`CHG-000019`](CHG-000019_Rust_Platform_Access_Core.md)、[`tools/coordinator/README.md`](../../tools/coordinator/README.md)、[`tools/coordinator/threat-model.md`](../../tools/coordinator/threat-model.md)

## 判断と変更境界

Qual-Labが承認したTypeScript＋最小Rust構成を継続し、`CHG-000019`で保留したRust binaryのRelease Identity結合候補を実装する。上限付きプロセス（Bounded Process）によるproduction起動は、保護済み有効世代と検証済み実行イメージ（Verified Image）の結合方式が未決・未実装のため、現在の入口から撤去して固定`blocked`へ戻す。

本変更はReleaseの採用、統合、署名実行または公開を決定しない。明示Release署名commandはステージングmanifestの排他作成・書込み・`fsync`というリリースステージングのファイルシステム処置（Release Staging Filesystem Effect）だけを発行する。Root保護、DACL適用、Platform Provisioner Effect、Runtime Effect、Runtime reader、POSIX、initial Trustおよびactivationは成立させない。既存12 blocker、6 current-run evidence、Gate `blocked`、Runtime Authority／Runtime Capability非発行を維持する。

## 実装

- Windows成果物の固定相対Pathを`90_Release/platform-access/x86_64-pc-windows-msvc/crdd-platform-access.exe`、targetを`x86_64-pc-windows-msvc`、Rust toolchainを`1.94.1`、protocol revisionを1、最大byte長を16 MiBへ固定した。
- package manifestのexact payloadへ、固定相対Path、target、protocol revision、Rust toolchain、byte長およびSHA-256を持つ`platformAccessArtifact`を追加した。v0.18 Candidateでは旧candidate Schemaの互換aliasまたはshimを残さず、Release stagingと署名処理を新Schemaへ移行する。
- 署名commandは固定成果物を同一file handleで読み、最初に得た配布Root／file IdentityとHashを署名前およびmanifest排他配置後まで同じ基準へ再照合する。manifestは固定Pathへ排他作成し、同じdescriptorで書込みと`fsync`を行った後、先頭から期待byte長＋1まで再読取りしてcanonical byte完全一致とEOFを要求する。正常終了はその観測区間でのmanifestと成果物の一致候補だけを示し、継続的同一性、Release採用または実行許可を付与しない。
- 読み取り専用の成果物観測とmanifest配置処置を別moduleへ分離した。配置moduleは初回Root／Release Directory／成果物観測を偽造不能なopaque sessionへ保持し、配置時にcallerからRootまたはPathを再入力させない。production `src/**`、`bin/**`、Adapter、doctorまたはRuntime投影からはimportできず、固定署名scriptと専用contract testだけが利用する。
- manifest作成前の失敗は`releaseStagingFilesystemEffectIssued: false`、排他作成後の失敗は`true`かつ`stagingRootMustBeDiscarded: true`、成功は`true`かつ`stagingRootMustBeDiscarded: false`として内部契約へ保持する。いずれも`runtimeFilesystemEffectIssued`、`provisioningFilesystemEffectIssued`、`runtimeAuthorityConferred`および`runtimeCapabilityIssued`は`false`である。
- 観測区間中に成果物、Root、manifest byteまたはmanifest配置先が変わった場合は失敗する。生成済みmanifestをPathで自動削除せず、残存manifestを含む失敗したstaging Rootを再利用・再署名せず、Root全体を破棄して新規stagingからやり直す。
- production署名入口からcaller指定Trust、任意signer、検証skipおよびtest hookを撤去した。固定公開鍵、commit／tree、Release Identityおよび成果物観測を常に通る一つの入口だけを残し、署名Authorityを持たない配置helperの動的試験にはtest内で生成した一時的な署名包絡だけを使う。
- TypeScript Adapterのproduction process実装を撤去した。入力を参照せず`platform_access_protected_active_generation_binding_not_implemented`で停止し、Path、時刻、manifest、package、processまたはFilesystemへ到達しない。
- locked build入口をdebug buildから`--release`付きへ変更した。生成物の固定Release Pathへの配置と実鍵署名はRelease工程の明示操作であり、本変更では実行しない。

## 利用側と現在状態

Release artifact contract、manifest Core、署名command、Release Identity再計算、package filesystem loader、固定停止するprivate Adapterおよび各contract testを同時更新した。README、脅威モデルおよび保守正本は、次の三段階を一意に区別する。

1. Rust Coreと署名manifestへ結合する成果物観測は読み取り専用候補であり、明示Release署名commandのステージングmanifest配置だけが限定したRelease Staging Filesystem Effectを持つ。
2. 保護済み有効世代、検証済み実行イメージ、production process起動およびRoot観測成果物への写像は未実装である。
3. DACL mutation、Provision Effect、Runtime Effect、Runtime reader、POSIX、initial Trust、activation、Runtime AuthorityおよびRuntime Capabilityも未実装である。

通常run、`doctor`、`activate`または`provision`からprocessを発火しない。source checkoutと署名済みstagingのどちらでも入力Pathやhelper processより前に`blocked`となる。第13 blockerを追加せず、既存`platform_provisioner_verification`と`platform_provisioner_effect`の未完了範囲へ接続する。

## 専門探索・収束

Release binding方式は、tracked binary、post-checkout署名manifest、OS native code signing、binaryの埋込み／resource化、保護済みstagingとhandle／image結合、およびprocess停止継続を比較した。tracked binaryは履歴量とplatform別配布を増やし、post-checkout manifest単独はsupply-chain Identityと再現性に優れるがPath起動のTOCTOUを閉じない。OS native code signingはOS loaderとの親和性が高い一方、証明書LifecycleとOS依存を追加する。埋込み方式は単一artifact化できるが配布量と更新責務をTypeScript側へ集中させる。保護済みstaging／handle結合は実行image同一性に最も直接的だが、writer排他、OS APIおよびRelease世代管理が必要である。

現時点はprocess停止継続を採用する。機能提供は進まないが、署名Hash対象と実行イメージが異なり得る状態で現在process tokenを使って起動しないことを優先する。OwnerはQual-Lab。残存riskはWindows実効access観測がproductionへ接続されずRoot保護が未検証なこと。Release binding着手時に、保護済み有効世代、writer排他、検証済み実行イメージ結合、OS native code signingの要否、復旧および配布artifactを人間判断し、Security／Architectureレビューを再実行する。`osNativeCodeSignatureDecision`は`deferred_until_production_verified_image_binding`であり、現candidate manifestがAuthenticodeを要求しない事実を将来方式の不採用決定へ流用しない。

## 移行と復旧

CRDD公式RepositoryのRelease工程は、locked release buildの成果物を固定相対Pathへ配置してから、新manifest Schemaで署名しなければならない。旧manifest、別target、別toolchain、別Path、別Hashまたは開発用binaryは受理しない。採用Repository、公開Checker、Coordinator公開CLI、JSON Schemaまたは利用者操作には移行を要求しない。

新工程を成立させられない場合はv0.17.0 Released Baselineへ戻し、未結合Rust成果物をReleaseへ含めない。v0.18.0 Candidateの互換wrapper、旧field aliasまたは二重manifest Schemaは作らない。

## Self-checkと独立確認

Node組込みcoverageは`--test-concurrency=1`と`--experimental-test-isolation=none`を固定し、同じsource／test母集団を同一processへ一意に読み込む。LCOV集計器自身とRelease staging配置moduleを含む固定14 source／13 test以外、missing／extra／duplicate `SF`、未知tag、欠落・重複・末尾後データを持つ`end_of_record`、不正／重複`DA`・`FN`・`FNDA`・`BRDA`、非正line、負のblock／branch／count、`FN`と`FNDA`の不一致、summary不一致、Repository外Pathおよび32 MiB超過を拒否する。割合から分母・分子または未到達位置を逆算しない。連続2回の標準出力JSONは完全一致し、SHA-256は`1683CE6A3172946183DE2EBDD3A5A21739EDB1C668DD8659ECEDC64CBFDBD30D`だった。

新固定前のSelf-checkはNode 24.19.0でCoordinator 352/352、Checker 151/151、TypeScript 127／Rust 4 source closure、両private packageの型検査・Biome Lint・Formatterを合格した。Rust 1.94.1では7/7、`rustfmt --check`、Clippy `-D warnings`、locked release buildおよびcoverage確認を合格し、Rust coverageはregions 817/907、functions 36/37、lines 538/590、branches 0/0 `Not Available`だった。全体Checkerは483 files／298 Markdown／1883 links／563 anchors／26 Related／26 versioned documents／8 Stable ID／68 remediation rows、Error 0／Warning 0だった。これは後続の独立確認を代替しない。

| source | line | function | branch |
|---|---:|---:|---:|
| `tools/coordinator/scripts/check-platform-access-ts-coverage.ts` | 332 / 395 | 22 / 24 | 97 / 122 |
| `tools/coordinator/scripts/release-staging-manifest.ts` | 327 / 346 | 10 / 11 | 42 / 53 |
| `tools/coordinator/scripts/sign-release-manifest.ts` | 195 / 347 | 5 / 9 | 6 / 23 |
| `tools/coordinator/src/core/doctor.ts` | 637 / 682 | 24 / 25 | 115 / 173 |
| `tools/coordinator/src/security/platform-access-adapter.ts` | 189 / 193 | 11 / 11 | 32 / 36 |
| `tools/coordinator/src/security/platform-access-release.ts` | 268 / 286 | 11 / 11 | 31 / 41 |
| `tools/coordinator/src/security/platform-provisioner-manifest-loader.ts` | 171 / 183 | 5 / 5 | 39 / 47 |
| `tools/coordinator/src/security/platform-provisioner-package-filesystem.ts` | 480 / 678 | 17 / 21 | 62 / 91 |
| `tools/coordinator/src/security/platform-provisioner-release-identity.ts` | 356 / 386 | 15 / 15 | 47 / 68 |
| `tools/coordinator/src/security/platform-provisioner-trust-core.ts` | 494 / 527 | 16 / 16 | 118 / 130 |
| `tools/coordinator/src/security/platform-provisioner-windows-dacl.ts` | 148 / 150 | 5 / 5 | 48 / 49 |
| `tools/coordinator/src/security/root-observation.ts` | 222 / 224 | 8 / 8 | 44 / 45 |
| `tools/coordinator/src/security/runtime-activation-record.ts` | 1176 / 1184 | 24 / 25 | 81 / 91 |
| `tools/coordinator/src/security/runtime-root-path-identity.ts` | 347 / 523 | 16 / 21 | 59 / 70 |
| 合計 | 5342 / 6104 | 189 / 207 | 821 / 1039 |

未到達branchは、次の各`source:line:block:branch`を個別Identityとして保持する。同じ行内のIdentityは同じ処置分類を共有するが、件数へ縮約せず全件を列挙する。

| source | 未到達branch Identity | 分類・理由・残存risk・代替確認・Owner・再確認 |
|---|---|---|
| `scripts/check-platform-access-ts-coverage.ts` | `391:1:0`, `72:5:0`, `87:13:0`, `115:25:0`, `117:27:0`, `118:28:0`, `119:29:0`, `120:32:0`, `141:40:0`, `142:42:0`, `145:45:0`, `149:48:0`, `164:52:0`, `167:54:0`, `174:58:0`, `217:72:0`, `225:77:0`, `226:78:0`, `228:79:0`, `231:81:0`, `233:83:0`, `245:91:0`, `256:95:0`, `257:97:0`, `313:119:0` | `Not Verified`。CLI main guard、OS I/O failure、全LCOV不正組合せを同一coverage runで到達していない。exact 14 source／13 test母集団、未知tag、数値・cardinality・終端・summary不一致の契約試験と連続JSON一致を代替確認する。残存riskは集計器の未到達failure branchが品質根拠を誤拒否すること。Owner=Qual-Lab、現在の人間判断=不要。LCOV grammar、Node coverageまたは固定母集団変更時に再確認する。 |
| `scripts/release-staging-manifest.ts` | `51:2:0`, `131:14:0`, `160:18:0`, `174:19:0`, `179:20:0`, `195:21:0`, `230:29:0`, `235:31:0`, `243:33:0`, `267:36:0`, `322:49:0` | `Not Verified`。全descriptor短読取り／close／Identity例外と全置換タイミングを同一coverage runで到達していない。opaque session、偽造・別Root・既存manifest拒否、同一fd byte／EOF、配置前後Effect metadataおよび失敗Root非削除の動的契約試験を代替確認する。残存riskは稀なFilesystem failure分類の見落とし。Owner=Qual-Lab、現在の人間判断=不要。実Release staging、Filesystem APIまたは配置契約変更時に再確認する。 |
| `scripts/sign-release-manifest.ts` | `338:1:0`, `338:2:0`, `50:4:0`, `55:6:0`, `68:7:0`, `72:8:0`, `81:9:0`, `94:10:0`, `111:11:0`, `121:13:0`, `134:14:0`, `145:16:0`, `175:18:0`, `196:19:0`, `218:20:0`, `225:21:0`, `228:22:0` | `Not Verified`。固定秘密鍵、完全なRelease tree／期間／引数のproduction CLI経路を実行していないため。実署名失敗分類の見落としriskを、型検査、固定鍵拒否、配置helper動的試験、release identity契約で代替確認する。Owner=Qual-Lab、現在の人間判断=不要。実Release handoff時に実鍵を露出しない隔離環境で再確認する。 |
| `src/core/doctor.ts` | `90:3:0`, `94:5:0`, `96:6:0`, `100:8:0`, `150:11:0`, `153:13:0`, `162:15:0`, `182:22:0`, `198:29:0`, `198:30:0`, `205:32:0`, `215:36:0`, `234:43:0`, `235:45:0`, `235:46:0`, `238:49:0`, `238:50:0`, `275:55:0`, `275:56:0`, `276:57:0`, `277:58:0`, `279:59:0`, `280:60:0`, `286:63:0`, `396:79:0`, `397:80:0`, `427:87:0`, `456:97:0`, `467:108:0`, `508:120:0`, `517:122:0`, `521:124:0`, `524:126:0`, `528:128:0`, `529:130:0`, `533:132:0`, `534:134:0`, `538:135:0`, `539:137:0`, `556:142:0`, `559:144:0`, `563:145:0`, `564:146:0`, `566:148:0`, `567:149:0`, `572:151:0`, `573:152:0`, `575:154:0`, `576:155:0`, `587:157:0`, `599:159:0`, `600:160:0`, `609:162:0`, `622:164:0`, `623:165:0`, `638:167:0`, `652:170:0`, `672:172:0` | `Not Verified`。CHG-000020が消費する固定停止投影以外の既存doctor分岐を本変更の専用testで全到達させていない。状態投影の回帰riskを全doctor契約試験と12 blocker／6 evidence完全一致で代替確認する。Owner=Qual-Lab、現在の人間判断=不要。doctor状態shapeまたは阻害依存変更時に再確認する。 |
| `src/security/platform-access-adapter.ts` | `61:8:0`, `80:14:0`, `98:18:0`, `149:32:0` | `Not Verified`。入力正規化の全失敗形を本coverage母集団で到達していない。Proxy入力非参照と固定blockedの契約試験を代替確認とし、process再導入時に全入力境界を再試験する。Owner=Qual-Lab、現在の人間判断=不要。 |
| `src/security/platform-access-release.ts` | `55:2:0`, `88:8:0`, `115:11:0`, `120:12:0`, `147:15:0`, `153:17:0`, `163:21:0`, `178:27:0`, `243:32:0`, `253:34:0` | `Not Verified`。成果物観測の全OS例外と全Identity failureを同一coverage runで到達していない。正常、同長上書き、短縮、追記、Release Directory／Rust成果物差を動的確認し、残りはfail-closed実装と型検査で代替確認する。Owner=Qual-Lab、現在の人間判断=不要。Release handoffまたはFilesystem API変更時に再確認する。 |
| `src/security/platform-provisioner-manifest-loader.ts` | `19:5:0`, `23:7:0`, `27:9:0`, `36:13:0`, `49:15:0`, `66:26:0`, `90:33:0`, `130:44:0` | `Not Verified`。全read failure／上限／Identity差を同じcoverage runで到達していない。専用loader契約試験と同一handle再読取りを代替確認する。Owner=Qual-Lab、現在の人間判断=不要。manifest Schema／loader変更時に再確認する。 |
| `src/security/platform-provisioner-package-filesystem.ts` | `106:5:0`, `144:9:0`, `167:14:0`, `171:15:0`, `176:16:0`, `187:20:0`, `203:23:0`, `243:33:0`, `254:39:0`, `256:41:0`, `234:45:0`, `270:47:0`, `272:48:0`, `306:56:0`, `319:60:0`, `328:61:0`, `348:65:0`, `352:67:0`, `357:68:0`, `379:71:0`, `417:79:0`, `433:81:0`, `441:82:0`, `442:83:0`, `443:84:0`, `445:85:0`, `481:87:0`, `483:88:0`, `488:89:0` | `Not Verified`。package読取り／writerの既存障害分岐を本変更で全到達していない。package filesystem契約試験、manifest後置成果物除外およびproduction Effect固定停止で代替確認する。Owner=Qual-Lab、現在の人間判断=不要。実stagingまたはwriter接続時に再確認する。 |
| `src/security/platform-provisioner-release-identity.ts` | `53:4:0`, `54:5:0`, `86:9:0`, `90:10:0`, `94:11:0`, `107:12:0`, `117:13:0`, `162:26:0`, `172:29:0`, `275:32:0`, `185:35:0`, `198:42:0`, `208:43:0`, `215:45:0`, `232:50:0`, `236:52:0`, `244:54:0`, `248:56:0`, `253:57:0`, `262:60:0`, `299:63:0` | `Not Verified`。Git object再構成の全invalid tree／Path failureを到達していない。release identity契約試験と署名入口の必須再検証で代替確認する。Owner=Qual-Lab、現在の人間判断=不要。archive／Git tree生成方式変更時に再確認する。 |
| `src/security/platform-provisioner-trust-core.ts` | `162:20:0`, `184:28:0`, `283:76:0`, `335:98:0`, `343:99:0`, `357:101:0`, `369:103:0`, `371:104:0`, `390:106:0`, `391:107:0`, `403:109:0`, `480:128:0` | `Not Verified`。manifest exact Schema／署名Coreの一部failure branchを未到達とする。全field差、専用Rust成果物必須、固定公開鍵、native signing decision分離の契約試験で代替確認する。Owner=Qual-Lab、現在の人間判断=不要。Schema／domain／Trust変更時に再確認する。 |
| `src/security/platform-provisioner-windows-dacl.ts` | `100:45:0` | `Not Verified`。未実装実効access Adapter投影の一失敗分岐。固定blocked契約試験で代替確認する。Owner=Qual-Lab、現在の人間判断=不要。Windows Adapter実装時に再確認する。 |
| `src/security/root-observation.ts` | `182:42:0` | `Not Verified`。Root観測へのRust結果写像は未実装であり、一投影分岐を未到達とする。固定blocked契約試験で代替確認する。Owner=Qual-Lab、現在の人間判断=不要。Root写像実装時に再確認する。 |
| `src/security/runtime-activation-record.ts` | `310:2:0`, `302:12:0`, `303:13:0`, `327:18:0`, `341:22:0`, `334:25:0`, `435:72:0`, `439:74:0`, `448:78:0`, `468:87:0` | `Not Verified`。onboarding阻害依存の既存分岐を本変更で全到達していない。12 blocker／6 evidenceと固定停止projectionの契約試験で代替確認する。Owner=Qual-Lab、現在の人間判断=不要。activationまたは阻害依存変更時に再確認する。 |
| `src/security/runtime-root-path-identity.ts` | `115:16:0`, `132:21:0`, `139:22:0`, `175:38:0`, `190:43:0`, `195:45:0`, `213:47:0`, `244:58:0`, `250:61:0`, `281:64:0`, `371:68:0` | `Not Verified`。POSIX／Windows Path Identityの既存失敗分岐を本変更で全到達していない。Path入力前の固定停止と既存Path Identity契約試験で代替確認する。Owner=Qual-Lab、現在の人間判断=不要。production process、POSIX classifierまたはRoot観測写像実装時に再確認する。 |

局所検証項目の`Pass`は、exact manifest Schema、専用成果物必須化、release tree除外、同一handle Hash、Root／file Identity連続性、同一fd manifest byte再読取り、署名前差、配置後差、自動削除なし、固定公開鍵拒否、production Trust差替え不可、Proxy入力非参照のproduction停止および下流状態投影である。この項目結果はCHG全体の状態`Ready for Verification`、独立監査またはRelease判断を`Verified`へ昇格させない。

本番固定秘密鍵による実署名、実Release staging、command返却後の改変、保護済み有効世代、検証済み実行イメージ、OS native code signing、production processおよび実Windows FFIは`Not Verified`である。残存riskは署名済み候補をReleaseへ昇格できずWindows観測をproduction利用できないこと。OwnerはQual-Labで、Release handoffまたはproduction process再導入時に再評価する。撤去したtimeout／signal／stderr／exitのprocess分岐は`Not Applicable — implementation removed`であり、再導入時に新しい検証義務として発火する。

これは`Self-checked`であり、新固定Commit／Treeの全体Checkerおよび独立監査集合が完了するまで`Verified`または`Resolved`ではない。

独立確認では、manifestの全field差、成果物Hash／Identity差、Root差、署名観測区間、source checkoutを含む入力前停止、公開情報最小化、12 blocker／6 evidence／Gate／非Release境界を水平確認する。実署名Release、production process、Root観測写像、DACL EffectおよびRelease判断は未評価範囲である。

## 固定版`bb9ecdac`の独立確認と無効化

固定対象はCommit `bb9ecdac504159d0b5baad85b04c476aa7a2685d`、Tree `5b5e7617ca38783140a026c98e7978aaaef15d41`、Parent `ddb907330ab57bc1188e8563a6108fb9ad966752`。共通入力はCoordinator 343/343、Checker 151/151、Rust 7/7、TypeScript 124／Rust 4 source closure、両package check、Rust fmt／Clippy／locked release build、full Checker Error 0／Warning 0、cleanだった。

- Agent／Architecture／Security: `Fail`。`ASR-20-01` Critical（Hash観測対象とPath起動imageの同一性切断）、`ASR-20-02` High（production／signing経路の動的検証不足）、`ASR-20-03` Medium（現在状態の文書・試験名不一致）。3件とも今回変更で新規。
- Document: `Fail`。`DOC-REL-001` Major（未定義状態`Draft`）、`DOC-REL-002` Minor（`bounded process`のlocale-first未定義）。2件とも今回変更で新規。
- Gap／Impact: `Fail`。`GCI-20-001` Major（実行image同一性）、`GCI-20-002` Major（TypeScript coverage／検証義務不足）、`GCI-20-003` Minor（専用Rust成果物必須contract不一致）、`GCI-20-004` Major（Release binding方式の専門探索不足）。初回監査のため再監査4分類は非適用。
- Conformance: `Fail`。C-11、PL-16、PL-19がNon-conformantで、準拠claimは`Not Eligible`。

この監査集合は全体として`Invalidated`であり、現在判定へ流用しない。各処置は`Applied`／`Self-checked`で、新固定版の同一監査集合が完了するまで`Resolved`ではない。

## 固定版`054c702`の独立確認と無効化

固定対象はCommit `054c702078771aae365605c3a8bee0528d0a0e5a`、Tree `239e7a6cecb270e0575d22a8d6187ad456e180dc`、Parent `bb9ecdac504159d0b5baad85b04c476aa7a2685d`。共通入力はCoordinator 348/348、Checker 151/151、TypeScript coverage 98/98、Rust 7/7、TypeScript 124／Rust 4 source closure、両package check、Rust fmt／Clippy／locked release build、full Checker Error 0／Warning 0、cleanだった。

- Agent／Architecture／Security: `Fail`。`ASR-20-R01` High（配置後manifestのsame-fd byte再確認欠落）、`ASR-20-R02` High（production sourceにtest Trust／検証skipを保持）、`ASR-20-R03` Major（無関係なSecurity契約の文書短縮と現在状態不一致）。3件はいずれもbb9の是正で新規発生した。
- Document: `Fail`。`DOC-REL-R04` Major（配置失敗後staging Rootの破棄・再作成手順欠落）、`DOC-REL-R05` Minor（検証項目結果とCHG全体状態の混同）、`DOC-REL-R06` Minor（検証済み実行イメージのlocale-first不足）。3件はいずれもbb9の是正で新規発生した。
- Gap／Impact: `Fail`。既存`GCI-20-002` Majorは分母／分子、未到達branchと処置の不足により未解消。`GCI-20-R2-001` Minorは脅威モデルの「Release Identity結合」がmanifest成果物結合と未実装runtime結合を縮約していた初回監査見落としである。新規4分類は初回から存在し見落とし1、修正起因0、修正で初めて確認可能0、承認範囲拡大0で、既存Finding未解消を重複加算しない。
- Conformance: `Fail`。production execution撤去と署名Identity連続性によりC-11、専門探索によりPL-19は適合へ戻ったが、PL-16と現在状態の局所不一致が未解消で準拠claimは`Not Eligible`だった。

この監査集合も全体として`Invalidated`であり、現在判定へ流用しない。処置は、manifestの同一fd byte再読取り、production test Trust撤去、README／脅威モデルの親版要件復元、固定母集団LCOV集計、未到達branch全数の処置および状態層分離へ反映した。いずれも`Applied`／`Self-checked`であり、新固定版の同一監査集合が全て完了するまで`Resolved`ではない。

## 固定版`5af5f73`の独立確認と無効化

固定対象はCommit `5af5f73f2b516912a372c17ec7ea5ab0df2fb552`、Tree `a78c1bc5d2a5e2949f3c0b7f5a3682a407da3187`、Parent `054c702078771aae365605c3a8bee0528d0a0e5a`。共通入力はNode 24.19.0、Coordinator 350/350、Checker 151/151、TypeScript 126／Rust 4 source closure、TypeScript coverage 12 source、Rust 7/7、両package check、Rust fmt／Clippy／locked release build、full Checker Error 0／Warning 0、cleanだった。

- Agent／Architecture／Security: `Fail`。`ASR-20-R3-001` Majorは、Release stagingのmanifest書込みEffectと読み取り専用成果物観測の説明を同じmodule／無限定fieldへ縮約した修正起因Finding。`ASR-20-R3-002` Mediumは、LCOV parserが未知record、不正lineおよび`FN`／`FNDA`不一致をfail closedにしない修正起因Findingだった。
- Document: `Conditional`。`DOC-REL-R07` Minorは、READMEの現行一箇所が撤去済みprocessを実装候補に含めた初回監査見落としだった。
- Gap／Impact: `Fail`。`GCI-20-R3-001` Minorは、coverage生成器自身を固定母集団へ含めない修正起因Finding。`GCI-20-R3-002` Majorは、Release staging manifest write Effectと観測contractの`filesystemEffectIssued: false`が矛盾する修正起因Findingだった。
- Conformance: `Fail`。Release staging Effectの説明不一致によりC-04／C-07、品質根拠生成器の母集団漏れによりPL-16がNon-conformantで、準拠claimは`Not Eligible`だった。

この監査集合も全体として`Invalidated`であり、現在判定へ流用しない。処置は、読み取り専用成果物観測とopaque sessionを持つRelease staging配置moduleの分離、成功／失敗時Effect metadata、Runtime／Provision Effectとの分離、exact 14 source／13 test coverage、LCOV grammarのfail-closed化および現在文書の水平同期へ反映した。いずれも`Applied`／`Self-checked`であり、新固定版の同一監査集合が全て完了するまで`Resolved`ではない。新規4分類は修正起因4、初回から存在し見落とし1、修正で初めて確認可能0、承認範囲拡大0である。

## 固定版`aad8572`の独立確認と無効化

固定対象はCommit `aad8572376d8252693f4b30d8013a2eede04ef36`、Tree `114f6d0d39a9c994b965d6b3fd4c1a223695196c`、Parent `5af5f73f2b516912a372c17ec7ea5ab0df2fb552`。共通入力はNode 24.19.0、Coordinator 352/352、Checker 151/151、TypeScript 127／Rust 4 source closure、TypeScript coverage 14 source／13 test、Rust 7/7、両package check、Rust fmt／Clippy／locked release build、full Checker Error 0／Warning 0、cleanだった。

- Agent／Architecture／Security: `Pass`、Finding 0。
- Document: `Conditional`。`DOC-REL-R08` Minorは、脅威モデルでRelease Staging Filesystem Effectの正式英語名が初出より後に定義されていた修正起因Findingだった。
- Gap／Impact: `Pass`、Finding 0。新規候補4分類は全分類0。
- Conformance: `Pass`、Finding 0。影響基準はConformantだが、v0.18 Candidateかつ非Releaseのため準拠claimは`Not Eligible`だった。

この監査集合も全体として`Invalidated`であり、現在判定へ流用しない。`DOC-REL-R08`の処置は、脅威モデルの初出を日本語表示名（Canonical Term）の順へ修正し、後続の重複英語定義を除去する局所変更へ反映した。処置は`Applied`／`Self-checked`であり、新固定版の同一監査集合が全て完了するまで`Resolved`ではない。

## 固定版`6690d34`の最終独立確認

固定対象はCommit `6690d34436b0f3c6421ab47333e60ab429075265`、Tree `6fc7f90765cdcd6be115909183e8a1860726f7bf`、Parent `aad8572376d8252693f4b30d8013a2eede04ef36`。共通入力はNode 24.19.0、Coordinator 352/352、Checker 151/151、TypeScript 127／Rust 4 source closure、TypeScript coverage 14 source／13 test、Rust 7/7、両package check、Rust format／Clippy／locked release build、full Checker Error 0／Warning 0、cleanだった。

- Agent／Architecture／Security: `Pass`、Finding 0。
- Document: `Pass`、Finding 0。`DOC-REL-R08`は解消した。
- Gap／Impact: `Pass`、Finding 0。
- Conformance: `Pass`、Finding 0。影響基準は`Conformant`だが、Candidate／非Release境界により準拠claimは`Not Eligible`である。

新規候補4分類は、初回から存在し見落とし0、修正起因0、修正で初めて確認可能0、承認範囲拡大0である。旧固定版の監査集合は`Invalidated`の履歴として保持し、現在判定へ流用しない。`GCI-20-001`〜`004`、`GCI-20-R2-001`、`GCI-20-R3-001`／`002`、各ASR同根および各DOC同根は、この固定版の独立確認により`Resolved`となった。

現在の固定記録は[`CHG-000020_Current_Review_Record_6690d34.md`](Evidence/CHG-000020_Current_Review_Record_6690d34.md)が所有する。この`Verified`は変更候補の検証状態であり、採用、統合、準拠表明、Stable化またはReleaseを意味しない。12 blocker、6 current-run evidence、Gate `blocked`、Runtime Authority／Runtime Capability非発行および未実装境界を維持する。
