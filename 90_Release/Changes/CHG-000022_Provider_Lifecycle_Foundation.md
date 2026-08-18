# 変更トレース: Providerライフサイクル基盤（Provider Lifecycle Foundation）

- 変更ID: `CHG-000022`
- 状態: `Ready for Verification`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-18
- 対象: CRDD公式Repositoryの内部Coordinator、Provider認証方針、専用Homeおよび上限付きライフサイクルCore
- 対象version: v0.18.0 Candidate
- 変更分類: `breaking`（private `doctor` JSONの`reportVersion`を2から3へ更新する。入力CLI grammar、公開Checkerおよび採用RepositoryのSchemaは不変）
- 移行要否: `migration_required: true`（Repository内のprivate doctor JSON consumerをrevision 3へ同時更新し、revision 2のalias／fallbackを設けない。supported production Provider stateはなく、永続state変換は発生しない）
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
- Provider隔離Profile revision 1のgeneric Credential Grantはsubscription OAuth v1へ適用しない。subscription OAuthではtokenやsessionをOperationへcopy／injectせず、Provider・Profile・Operationへ結合した不透明で一回限りのProvider Home mount Grantだけを将来発行する。Operation終了時に失効させるのはGrant、handleおよびmountで、永続Home／sessionのlogout、remote revokeまたは削除は別の明示bootstrap lifecycleである。現在はGrantを発行しない。

### 上限付きライフサイクルCore

Repository所有CoreはProvider、`login|run` mode、deadline 300000 ms、cancel grace 5000 ms、stdin 1048576 byte、stdout 1048576 byte、stderr 262144 byte、結果exact 1件を固定する。任意image、argv、Home、shell、PATH lookup、session resume、auto-updateまたは追加購入をcaller入力にしない。

合成Fake観測候補は`prepared`、`submission_started`、`created`、`inspect_verified`、`started`、`exited_or_terminated`、`absence_confirmed`、`cleanup_confirmed`のexact順序を要求する。`stdinBytes`は0以上1048576以下、cancelなしでは`cancellationElapsedMs:null`、cancelありでは0以上5000以下のsafe integerだけを通常cancelとして受理し、上限超過を別reasonへ閉じる。非0終了、signal、timeout、cancel、stdin／stdout／stderr超過、二重結果、malformed結果、quota不足／不明、process treeまたはcontainer残存claimを別々に判定する。これらはすべてcaller supplied claimであり、正常形も`candidate`、`observationAuthority:false`、`fakeProviderExecuted:false`、`processAbsenceVerified:false`、`resultNormalizationVerified:false`、`credentialGrantIssued:false`に固定する。

実Provider計画は現在常に`spawnAllowed:false`で、loginは`provider_explicit_login_effect_not_implemented`、runは`provider_egress_auth_and_fixed_image_binding_not_implemented`となる。Filesystem Effect、Network Effect、Operation Capability、AuthorityおよびGateを発行しない。

## 代表例

| 種類 | 入力・条件 | 結果 |
|---|---|---|
| 発火例 | callerがexact状態順、exit 0、結果exact 1件、process tree／container不存在claimを渡す | 非Authorityの合成Fake観測`candidate`。Fake process実行や不存在確認は成立しない |
| 非発火例 | `doctor`、通常run、source checkoutまたは合成候補評価 | OAuth login、Fake／実Provider spawn、Network、課金、Repository Effectを発火しない |
| 境界例 | timeout、cancel、出力上限超過、signal、二重完了、quota exhausted | 固定reasonで`blocked`し、fallbackや追加購入を行わない |
| 情報不足例 | 固定image、Home保護、Egress、auth session、quota、process不存在のいずれか不明 | 実Provider spawn前に`blocked` |

## 利用側と変更禁止範囲

直接利用側は`provider-lifecycle.ts`、`plain-data-snapshot.ts`、両contract test、`provider-isolation-profile`のgeneric Grant非適用説明、`doctor`のProvider check／contract投影、Coordinator README／脅威モデル、TypeScript source closureおよび本変更トレースである。既存Fake Docker ProbeのOperation一時`provider-home/`は隔離確認用の一時領域として維持し、永続専用Homeへ読み替えない。

private doctor JSONは`reportVersion:2`から3へのbreaking変更であり、Repository内consumerを同時更新して2を拒否する。互換alias／fallbackを設けない。入力CLI grammar、公開Checker、採用Repositoryの公開Schema、Rust wire、Windows有効ポインター、12 blocker、6 current-run evidence、Gate、Authority、Capability、Platform Effect、v0.18 Candidateおよびv0.17 Released Baselineは変更しない。CHG-000015以前の履歴を現在の実Provider対応根拠へ流用しない。

| private doctor consumer | revision 2 | revision 3の移行 |
|---|---|---|
| Coordinator contract test | Provider lifecycle fieldなし | 認証Policy、専用Home、mount Grant、合成候補状態をexact確認 |
| Repository内JSON consumer | revision 2を前提 | `reportVersion:3`だけを受理し、2を拒否 |
| 採用Repository／公開Schema | 対象外 | 入力grammarと公開CRDD Schemaは変更なし |

## 検証と未評価

Node.js v24.19.0で次を実行した。

- Coordinator `check`: TypeScript型検査、Biome Warning拒否、format確認がPass
- Coordinator全contract test: 354／354 Pass
- Provider lifecycle／plain-data snapshot test: 15／15 Pass
- 固定coverage母集団: production source 2（`provider-lifecycle.ts`、直接依存`plain-data-snapshot.ts`）／test 2。両sourceと合計のlines、functions、branchesは100.00%、未到達branch 0
- source closure: Coordinator production 62、Coordinator test 54、Checker／template 5、Rust 4、unique total 122で完全一致
- Checker命名／参照試験: 5／5 Pass
- 公式Repository full checker: 488 files、308 Markdown、1899 links、565 anchors、26 Related、26 versioned documents、8 stable IDs、68 remediation rows、Error 0／Warning 0

coverage commandは`npm run provider-lifecycle:coverage --prefix tools/coordinator`である。Node built-in coverageが列挙する固定2 sourceを同じ2 contract testで測定し、入力snapshotのreflection failure、array length欠落／超過を含む全分岐を通す。100%は純粋な合成claim評価と直接依存だけの結果であり、Fake／実Provider process、Docker、OAuth、Egress、Home保護またはprocess不存在の実測を意味しない。

実Docker、実OAuth、Provider公式image、実Egress、実quotaおよび実process-tree terminationは`Not Verified`である。残存riskは、Provider仕様やquota出力の変化、Home外Credential書込み、自動更新、Egress迂回および子process残存である。代替確認はFake Coreの正負・境界試験と既存Docker隔離Probeに限定し、OwnerはQual-Lab、再確認契機は固定image／login／Egress／実Provider Adapterのいずれかへの着手時とする。

## 初回固定版の独立監査と是正状態

初回固定版はCommit `e97dcf5a6718ec65c0abb37b9d42370aa4a8fa6a`、Tree `d41c2401c0c11680944b26083abe4e15704f7668`、Parent `cfef3f53f01487ad81b610fe4f7458d7272d1a13`である。Agent／Architecture／Securityは`Fail`（Major 2、Moderate 1: `ASR-22-001`合成claimの`confirmed`化、`ASR-22-002`認証／課金Policy不足、`ASR-22-003` doctor revision未更新）、Documentは`Fail`（Major 2: `DOC-PROV-001`永続OAuth Homeと短期Credential Brokerの二重モデル、`DOC-PROV-002`公式根拠とClaude `-p`のtrace不足）、Gapは`Fail`（Major 2: `GCI-22-001` Fake provenance不足、`GCI-22-002` bounded軸と直接依存coverage不足）、Conformanceは`Fail`（C-07／PL-16、claim `Not Eligible`）だった。この監査集合は`Invalidated`で現在判定へ流用しない。

各Findingは、合成候補への縮小、Policy拡張、doctor v3、OAuth mount Grant分離、公式情報表、bounded field判定および固定2 source／2 test coverageで`Applied / Self-checked — pending independent re-review`である。初回監査の新規4分類はCHG22初回走査のため非適用であり、各FindingはCHG22が導入した変更内の指摘として保持する。`Applied`または`Self-checked`を`Resolved`へ昇格しない。

現在の処置状態は`Applied / Self-checked — pending independent re-review`であり、`Resolved`、`Verified`、採用、統合、準拠、StableまたはReleaseを意味しない。
