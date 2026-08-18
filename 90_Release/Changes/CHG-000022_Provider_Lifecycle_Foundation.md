# 変更トレース: Providerライフサイクル基盤（Provider Lifecycle Foundation）

- 変更ID: `CHG-000022`
- 状態: `Verified`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-18
- 対象: CRDD公式Repositoryの内部Coordinator、Provider認証方針、専用Homeおよび上限付きライフサイクルCore
- 対象version: v0.18.0 Candidate
- 変更分類: `breaking`（private `doctor` JSONの`reportVersion`を2から3、Provider隔離ProfileとAuthority Registryの`contractRevision`を1から2へ更新する。入力CLI grammar、公開Checkerおよび採用RepositoryのSchemaは不変）
- 移行要否: `migration_required: true`（Repository内の固定fixture／private contract consumerをrevision 2／3へ同時更新し、旧revisionのalias／fallbackを設けない。supported production Provider stateはなく、永続state変換は発生しない）
- 関連正本: [`19_Maintenance.md`](../../19_Maintenance.md#33-internal-typescript-runtime)、[`CHG-000015`](CHG-000015_Coordinator_Runtime_1_0.md)、[`tools/coordinator/README.md`](../../tools/coordinator/README.md)、[`tools/coordinator/threat-model.md`](../../tools/coordinator/threat-model.md)

## 結論と人間判断

既存のCodex／Claude利用契約を活用し、API keyや従量APIを新たに契約しない方式を採用した。Codexは`existing_chatgpt_plan_subscription_oauth`、Claude Codeは`existing_subscription_oauth`だけを許可する。Providerごとにexact 1 accountを使い、API key、追加credit購入、別planへの自動切替、Host既定Home／Credential Store／環境変数からの認証状態copyまたはfallbackを禁止する。quota／credit不足または状態不明では追加購入やAPI fallbackを行わず`blocked`とする。

人間は、Claude Codeの`-p`を将来の固定CLI呼出候補とし、選択済みsubscription／Agent SDK creditの範囲だけを使い、追加購入しない運用Policyも承認した。ただし`-p`が特定planのcreditへどのように課金されるか、quota不足をどのstable exit／statusで判定できるかは、実CLI versionを固定していない現在は`Not Verified`である。判定不能ならspawn前に停止し、追加購入、API key、従量APIまたは別planへ切り替えない。

### 外部情報の確認記録

| Provider | 公式情報 | 確認日 | 確認した範囲 | 未確認・限界 |
|---|---|---|---|---|
| Codex | OpenAI Help Center, [Using Codex with your ChatGPT plan](https://help.openai.com/en/articles/11369540/) | 2026-08-18 | ChatGPT planからCodexを利用できることとlogin導線 | exact CLI version、container内OAuth、quota signal、将来のplan／billing条件 |
| Claude Code | Anthropic, [Authentication](https://code.claude.com/docs/en/authentication) | 2026-08-18 | subscription OAuthによるlogin方式 | `-p`のexact argv、Agent SDK creditへの課金適用、quota signal、container内refresh／logout |

外部情報は確認時点の実装候補を支えるだけで、CRDDの恒久事実または可用性証明ではない。Provider CLI version、plan、利用条件、認証方式または課金表示が変わる場合と、固定image／実login／実Provider Adapterへ着手する場合にQual-Labが再確認する。

今回成立させるのは認証Policy、専用Homeの目標契約、およびcaller supplied claimを評価する上限付きの合成Fake観測候補Coreである。2026-08-18の追加承認により、Repository-owned Fake runner／Docker Adapterの動的実行は今回の必須範囲から外し、OwnerをQual-Lab、再評価契機をDocker lifecycle Adapter着手時として追跡する。実OAuth login、実Provider image、Fake／実Codex／Claude process起動、Provider endpoint Egress、認証probe、Telemetry判断およびOperation Capabilityは未実装で、spawn前に停止する。よって今回の変更は外部認証、Network、Repositoryまたは課金Effectを発火しない。

## 専門探索と収束

比較対象は、(1) API key／従量API、(2) Host CLIとHost Homeの直接再利用、(3) Operationごとの一時Home、(4) OS user＋Provider単位の永続専用Home、(5) shell／PATH経由のHost process、(6)固定Digest containerである。API keyは既存plan活用という目的と費用管理に反し、Host再利用はCredential分離を証明できず、OperationごとのHomeはlogin頻度とrefresh stateの運用負荷が大きい。shell／PATHは実行Identityと引数境界を固定できない。そこで永続専用Homeと固定Digest containerを採用候補とした。

この候補の弱点は、ProviderがHome内へ保存するOAuth stateの形式と更新挙動、公式image／CLI version、Egress endpoint、logout／remote revoke、Telemetryおよびquota状態が外部仕様に依存することである。保持条件は、Home外へのCredential書込みがなく、auto-updateを停止でき、固定imageとexact CLIを取得でき、Egressを限定でき、process tree／container不存在を確認できることとする。いずれかが成立しなければ実Provider入口を有効化しない。Provider仕様変更、実login Effect着手、image有効化またはEgress Proxy着手時に再評価する。

## 実装契約

### 認証と専用Home

- 専用HomeはローカルOS user＋Provider単位で分離し、同じOS userの複数Repository／Operationから再利用する。
- CodexとClaude CodeのHomeを共有しない。Host既定Home、通常Credential Store、SSH agent、API-key環境およびOperation一時`provider-home/`からcopy／importしない。
- 専用Homeは通常Operation cleanupの所有母集団へ含めない。現在はPath、作成、owner／ACL、non-link Identity、login／logout、refresh writeまたは削除Effectを実装しない。
- Runtimeはtoken、refresh state、device code、生promptまたは生Provider出力を読取り、hash、logまたはEvidence化しない。
- loginは将来も明示bootstrapだけから発火し、workspace、Git metadata、events、projectionまたはmanagementをmountしない。runは検証済みworkspace、同Provider Homeおよび専用tmpだけを対象にする。
- Provider隔離Profile revision 2は`authMethod:subscription_oauth`をexactに保持し、旧revision 1のgeneric `credentialGrant`と`credential_broker`を削除する。subscription OAuthではtokenやsessionをOperationへcopy／injectせず、Provider・Profile・Operationへ結合した不透明で一回限りの専用Provider Homeマウント許可（Provider Home Mount Grant）だけを将来発行する。`authority.grantRef`と`providerHomeMountGrant.grantRef`は別namespaceで、後者は`PHMGRANT-*`だけを許可する。Operation終了時に失効させるのは許可、handleおよびmountで、永続Home／sessionのlogout、remote revokeまたは削除は別の明示bootstrap lifecycleである。
- Authority Registry revision 2も同じ専用Homeマウント許可参照を保持し、Registry entry、Profileおよび評価contextのProvider・Profile・Operationを全方向exact照合する。内容版`registryRevision`は3を維持し、Profile／Registry contract revision 1、旧`credentialGrant`、参照namespace混在、同一専用Homeマウント許可参照の重複および結合差をalias変換せず拒否する。要求は`grantIssued:false`、実装は`not_implemented`、失効観測は`false`であり、許可発行、Authority、CapabilityまたはEffectを成立させない。

### 上限付きライフサイクルCore

Repository所有CoreはProvider、`login|run` mode、deadline 300000 ms、cancel grace 5000 ms、stdin 1048576 byte、stdout 1048576 byte、stderr 262144 byte、結果exact 1件を固定する。任意image、argv、Home、shell、PATH lookup、session resume、auto-updateまたは追加購入をcaller入力にしない。

合成Fake観測候補は`prepared`、`submission_started`、`created`、`inspect_verified`、`started`、`exited_or_terminated`、`absence_confirmed`、`cleanup_confirmed`のexact順序を要求する。`stdinBytes`は0以上1048576以下、cancelなしでは`cancellationElapsedMs:null`、cancelありでは0以上5000以下のsafe integerだけを通常cancelとして受理し、上限超過を別reasonへ閉じる。非0終了、signal、timeout、cancel、stdin／stdout／stderr超過、二重結果、malformed結果、quota不足／不明、process treeまたはcontainer残存claimを別々に判定する。これらはすべてcaller supplied claimであり、正常形も`candidate`、`observationAuthority:false`、`fakeProviderExecuted:false`、`processAbsenceVerified:false`、`resultNormalizationVerified:false`、`providerHomeMountGrantIssued:false`に固定する。

実Provider計画は現在常に`spawnAllowed:false`で、loginは`provider_explicit_login_effect_not_implemented`、runは`provider_egress_auth_and_fixed_image_binding_not_implemented`となる。Filesystem Effect、Network Effect、Operation Capability、AuthorityおよびGateを発行しない。

## 代表例

| 種類 | 入力・条件 | 結果 |
|---|---|---|
| 発火例 | callerがexact状態順、exit 0、結果exact 1件、process tree／container不存在claimを渡す | 非Authorityの合成Fake観測`candidate`。Fake process実行や不存在確認は成立しない |
| 非発火例 | `doctor`、通常run、source checkoutまたは合成候補評価 | OAuth login、Fake／実Provider spawn、Network、課金、Repository Effectを発火しない |
| 境界例 | timeout、cancel、出力上限超過、signal、二重完了、quota exhausted | 固定reasonで`blocked`し、fallbackや追加購入を行わない |
| 情報不足例 | 固定image、Home保護、Egress、auth session、quota、process不存在のいずれか不明 | 実Provider spawn前に`blocked` |

## 利用側と変更禁止範囲

直接利用側は`provider-lifecycle.ts`、`plain-data-snapshot.ts`、Provider隔離Profile、Authority Registry／Grant Verifier、Trust Loader、File Bundle、Prelaunch Verifier、Egress Policy、各contract test、`doctor`のProvider check／contract投影、Coordinator README／脅威モデル、TypeScript source closureおよび本変更トレースである。既存Fake Docker ProbeのOperation一時`provider-home/`は隔離確認用の一時領域として維持し、永続専用Homeへ読み替えない。Authority File Bundle envelopeとTrust Policyのcontract revisionはshapeを変更せず、Registryのcanonical byte、`registryId`、内容版revisionおよびHashをrev2 decoderへexact結合するため据え置く。

private doctor JSONは`reportVersion:2`から3へのbreaking変更である。version decoderやproduction consumerはなく、producerとexact contract testだけを同時更新し、revision 2のalias／fallbackを設けない。Provider Profile／Authority Registry revision 1のcandidate fixtureはrevision 2で再生成し、旧canonical byte／Hashを流用しない。入力CLI grammar、公開Checker、採用Repositoryの公開Schema、Rust wire、Windows有効ポインター、12 blocker、6 current-run evidence、Gate、Authority、Capability、Platform Effect、v0.18 Candidateおよびv0.17 Released Baselineは変更しない。CHG-000015以前の履歴を現在の実Provider対応根拠へ流用しない。

| private doctor成果物 | revision 2 | revision 3の移行 |
|---|---|---|
| `tools/coordinator/src/core/doctor.ts` | revision 2のproducer | revision 3だけを生成 |
| `tools/coordinator/tests/doctor.contract.test.ts` | revision 2のexact assertion | revision 3のtop-level shape、Provider reason domain、Profile revision 2、専用Homeマウント許可および合成候補状態をexact確認 |
| その他Repository内production consumer | 全数探索で0 | decoder／alias／fallbackを新設しない |
| 採用Repository／公開Schema | 対象外 | 入力grammarと公開CRDD Schemaは変更なし |

## 検証と未評価

Node.js v24.19.0で次を実行した。

- Coordinator `check`: TypeScript型検査、Biome Warning拒否、format確認がPass
- Coordinator全contract test: 362／362 Pass
- Provider lifecycle／plain-data snapshot test: 15／15 Pass
- 固定coverage母集団: production source 2（`provider-lifecycle.ts`、直接依存`plain-data-snapshot.ts`）／test 2。両sourceと合計のlines、functions、branchesは100.00%、未到達branch 0
- source closure: Coordinator production 62、Coordinator test 55、Checker／template 5、Rust 4、unique total 124で完全一致
- Checker命名／参照試験: 5／5 Pass
- 公式Repository full checker: 490 files、308 Markdown、1900 links、565 anchors、26 Related、26 versioned documents、8 stable IDs、68 remediation rows、Error 0／Warning 0

coverage commandは`npm run provider-lifecycle:coverage --prefix tools/coordinator`である。Node built-in coverageが列挙する固定2 sourceを同じ2 contract testで測定し、入力snapshotのreflection failure、array length欠落／超過を含む全分岐を通す。100%は純粋な合成claim評価と直接依存だけの結果であり、Fake／実Provider process、Docker、OAuth、Egress、Home保護またはprocess不存在の実測を意味しない。

Profile／Authority revision 2は`npm run provider-authority:coverage --prefix tools/coordinator`で、固定4 source（`provider-isolation-profile.ts`、`authority-grant-verifier.ts`、`authority-prelaunch-verifier.ts`、直接依存`plain-data-snapshot.ts`）と固定7 test（plain-data snapshot、Profile、Grant Verifier、Trust Loader、File Bundle、Prelaunch Verifier、Egress Policyの各contract test）を測定する。runnerはRepository所有のexact LCOV parserを使い、missing／extra／duplicate source、summary不一致および未知recordを拒否し、同じ母集団を連続2回測定したcompact JSON UTF-8 byte＋末尾LF exact 1件の完全一致を要求する。

是正後のsource別lines／functions／branchesは、Profile `256/258`・`12/12`・`73/81`、Grant Verifier `516/520`・`20/20`・`172/189`、Prelaunch Verifier `125/129`・`5/5`・`28/32`、plain-data snapshot `141/141`・`4/4`・`45/45`、合計`1038/1048`・`41/41`・`318/347`である。未到達branch 29件は割合から逆算せず、同じ決定論的stdoutにsource、line、block、branchと、reason、risk、代替確認、Owner=`Qual-Lab`、`humanDecision:not_required`、再確認契機を1件ずつ保持する。stdoutは22,855 byte、SHA-256は`9E977582DC761529A79754AE3CF79EA445C557CC69CBF9640347C3A396B01684`、連続実行payload SHA-256は`F40DB2D78D765DF03556CAB1D2FBC2C73537FCB2D6F5CB95289D3B996BE6E3EA`である。現在の品質状態は`Partially Verified`で、100%とは表明しない。

未到達義務はsourceごとに分離する。Profileはshape、ID、auth method、Authority参照、専用Homeマウント許可結合、Originおよび防御的catch、Grant VerifierはRegistry、Grant、時刻、参照重複、Provider／Profile／Operation／Scope／Hash／専用Homeマウント許可参照の四者結合および防御的catch、Prelaunch VerifierはRuntime時計、Bundle failureとProvider／Profile／Operation／Scope／専用Homeマウント許可参照の起動直前照合、snapshotは全branch到達済みである。代替確認は各sourceの正負・境界・旧revision・namespace混入・上限・動的入力および上位File Bundle／Egress経路のcontract testである。残存riskは同じ固定reasonへ合流する稀な短絡順序または防御的catchの退行をbranch実行で直ちに検出できないこと、再確認契機は各predicate、snapshot境界、Node coverageのbranch Identity出力またはproduction binder着手時である。Trust Loader、File Bundle、Egressおよびdoctorは新しいdecision branchを所有せず、fixture／文字列投影の利用側としてcontract testを適用する。Prelaunch VerifierはProvider、Profile、Operation、Scopeおよび専用Homeマウント許可参照を判定するため固定coverage母集団へ含める。

実Docker、実OAuth、Provider公式image、実Egress、実quotaおよび実process-tree terminationは`Not Verified`である。残存riskは、Provider仕様やquota出力の変化、Home外Credential書込み、自動更新、Egress迂回および子process残存である。代替確認はFake Coreの正負・境界試験と既存Docker隔離Probeに限定し、OwnerはQual-Lab、再確認契機は固定image／login／Egress／実Provider Adapterのいずれかへの着手時とする。

## 固定版の独立監査と是正状態

初回固定版はCommit `e97dcf5a6718ec65c0abb37b9d42370aa4a8fa6a`、Tree `d41c2401c0c11680944b26083abe4e15704f7668`、Parent `cfef3f53f01487ad81b610fe4f7458d7272d1a13`である。この監査集合は`Invalidated`で現在判定へ流用しない。

| ID／判定 | 監査 | 重大度 | 4分類 | 現在の処置 |
|---|---|---|---|---|
| `ASR-22-001` | Agent／Architecture／Security | Major | 記録未取得（推定しない） | 合成claimを非Authority candidateへ縮小し、`Applied / Self-checked` |
| `ASR-22-002` | Agent／Architecture／Security | Major | 記録未取得（推定しない） | 認証／課金Policyを固定し、`Applied / Self-checked` |
| `ASR-22-003` | Agent／Architecture／Security | Moderate | 記録未取得（推定しない） | private doctorをrevision 3へ更新し、`Applied / Self-checked` |
| `DOC-PROV-001` | Document | Major | 今回の修正によって新たに発生した | 永続OAuth Homeと専用Homeマウント許可へ一意化し、`Applied / Self-checked` |
| `DOC-PROV-002` | Document | Major | 今回の修正によって新たに発生した | 公式情報とClaude `-p`のPolicy／外部事実を分離し、`Applied / Self-checked` |
| `GCI-22-001` | Gap／Impact | Major | N/A（CHG22初回独立監査） | Fake provenance主張を縮小し、`Applied / Self-checked` |
| `GCI-22-002` | Gap／Impact | Major | N/A（CHG22初回独立監査） | bounded軸と直接依存coverageを補い、`Applied / Self-checked` |
| C-07／PL-16、claim `Not Eligible` | Conformance | Fail | Finding分類の対象外 | 上記是正を反映し、`Applied / Self-checked` |

一次是正版はCommit `dd8bcec8d209e6ebb20e5ade6af6da827cdaae5a`、Tree `231de02c555fb64ece82733b44f3999e5d8c9030`、Parent `e97dcf5a6718ec65c0abb37b9d42370aa4a8fa6a`である。Agent／Architecture／Securityは`Fail`（Major 1、Moderate 1）、Documentは`Conditional`（Minor 3）、Gapは`Fail`（Major 1）、Conformanceは`Fail`（C-07／C-11、claim `Not Eligible`）だった。この集合も`Invalidated`で現在判定へ流用しない。

| ID | 監査 | 重大度 | 4分類 | 現在の処置 |
|---|---|---|---|---|
| `ASR-22-R1-001` | Agent／Architecture／Security | Major | 今回の修正によって新たに発生した | Profile／Registry revision 2へ構造是正し、`Applied / Self-checked` |
| `ASR-22-003-R1` | Agent／Architecture／Security | Moderate | 既存Findingの部分未解消（新規4分類へ非計上） | doctor v3のexact contractと実在consumer表へ修正し、`Applied / Self-checked` |
| `DOC-PROV-R01` | Document | Minor | 今回の修正によって新たに発生した | e97 Finding単位の分類表へ修正し、`Applied / Self-checked` |
| `DOC-PROV-R02` | Document | Minor | 今回の修正によって新たに発生した | locale-first表示へ修正し、`Applied / Self-checked` |
| `DOC-PROV-R03` | Document | Minor | 今回の修正によって新たに発生した | doctor v3のproducer／test／consumer 0を実在pathで記録し、`Applied / Self-checked` |
| `GCI-22-R2-001` | Gap／Impact | Major | 今回の修正によって新たに発生した | generic Credential二重契約をProfile／Registry revision 2で撤去し、`Applied / Self-checked` |
| C-07／C-11、claim `Not Eligible` | Conformance | Fail | Finding分類の対象外 | 上記構造是正を反映し、`Applied / Self-checked` |

全処置は`Applied / Self-checked — pending independent re-review`であり、`Resolved`、`Verified`、採用、統合、準拠、StableまたはReleaseを意味しない。

二次是正版はCommit `3c3021a6769d9e0dd202950d5def4b70577333e4`、Tree `6547c3639dc38cf34b8d8d3b00f8d498f7f226f7`、Parent `dd8bcec8d209e6ebb20e5ade6af6da827cdaae5a`である。Agent／Architecture／Securityは`Fail`（Moderate 1）、Documentは`Conditional`（Minor 1）、Gapは`Fail`（Major 1）、Conformanceは`Fail`（C-07／PL-16、claim `Not Eligible`）だった。この集合も`Invalidated`で現在判定へ流用しない。

| ID／判定 | 監査 | 重大度 | 4分類 | 現在の処置 |
|---|---|---|---|---|
| `ASR-22-R2-001` | Agent／Architecture／Security | Moderate | 今回の修正によって新たに発生した | 起動直前contextへ専用Homeマウント許可参照を必須化し、Profile／Registryとのexact照合を追加して`Applied / Self-checked` |
| `DOC-PROV-R04` | Document | Minor | 今回の修正によって新たに発生した | READMEからprivate doctor revision 3の互換境界とCHG正本へ接続し、`Applied / Self-checked` |
| `GCI-22-R3-001` | Gap／Impact | Major | 今回の修正によって新たに発生した | Prelaunchを含むexact 4-source coverageと全未到達branch義務へ修正し、`Applied / Self-checked` |
| C-07／PL-16、claim `Not Eligible` | Conformance | Fail | Finding分類の対象外 | context利用側と品質記録を同期し、`Applied / Self-checked` |

この二次是正への処置も`Applied / Self-checked — pending independent re-review`であり、新固定版の必須監査集合が完了するまで`Resolved`または`Verified`へ昇格しない。

## 固定版`f11ac73`の最終独立確認

固定対象はCommit `f11ac73ad22b1af6d0983c9f941600bef4be9755`、Tree `49655ba56a3190b696afeaaa43f6e7308ada2c13`、Parent `3c3021a6769d9e0dd202950d5def4b70577333e4`である。共通入力はCoordinator check、Coordinator 362/362、Provider lifecycle 15/15、Provider Authority exact 4 source／7 test、platform-access TypeScript coverage、Checker 151/151、source closure unique 124、全体Checker Error 0／Warning 0、cleanだった。

- Agent／Architecture／Security Review: `Pass`、Finding 0。
- Document Audit: `Pass`、Finding 0。
- Gap／Impact Audit: `Pass`、Finding 0。
- Conformance Audit: `Pass`、Finding 0。C-04、C-07、C-10、C-11、PL-08、PL-16およびPL-19を含む影響基準は`Conformant`である。準拠claimはCHG-000022の監査対象範囲で`Eligible`だが、CRDD全体の準拠表明を発行せず、採用、統合、Gate open、StableまたはReleaseを意味しない。

`ASR-22-001`／`002`／`003`／`R1-001`／`003-R1`／`R2-001`、`DOC-PROV-001`／`002`／`R01`／`R02`／`R03`／`R04`、`GCI-22-001`／`002`／`R2-001`／`R3-001`および同根Findingは、各受入条件を満たす現在状態へ接続し`Resolved`とした。新規候補4分類は、初回監査時から存在した見落とし0、今回修正起因0、今回修正で初めて確認可能0、承認済み対象範囲拡大0である。

`f11ac73`より前の監査集合は固定履歴として保持するが、全て`Invalidated`で現在判定へ流用しない。現在の独立結果と機械入力は[`CHG-000022_Current_Review_Record_f11ac73.md`](Evidence/CHG-000022_Current_Review_Record_f11ac73.md)へ固定する。この`Verified`は変更候補の検証完了を表し、実OAuth、実Provider起動、Provider Home保護、Authority、Capability、Operation接続、採用、統合、Gate open、Stable化またはReleaseを意味しない。
