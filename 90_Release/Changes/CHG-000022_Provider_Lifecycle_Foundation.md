# 変更トレース: Providerライフサイクル基盤（Provider Lifecycle Foundation）

- 変更ID: `CHG-000022`
- 状態: `Ready for Verification`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-18
- 対象: CRDD公式Repositoryの内部Coordinator、Provider認証方針、専用Homeおよび上限付きライフサイクルCore
- 対象version: v0.18.0 Candidate
- 変更分類: `non-breaking`
- 移行要否: `migration_required: false`（現在supported production Provider stateはない。Host認証や旧Operation Homeを移行元にせず、将来Providerごとに明示loginを行う）
- 関連正本: [`19_Maintenance.md`](../../19_Maintenance.md#33-internal-typescript-runtime)、[`CHG-000015`](CHG-000015_Coordinator_Runtime_1_0.md)、[`tools/coordinator/README.md`](../../tools/coordinator/README.md)、[`tools/coordinator/threat-model.md`](../../tools/coordinator/threat-model.md)

## 結論と人間判断

既存のCodex／Claude利用契約を活用し、API keyや従量APIを新たに契約しない方式を採用した。Codexは`existing_chatgpt_plan_subscription_oauth`、Claude Codeは`existing_subscription_oauth`だけを許可する。Providerごとにexact 1 accountを使い、API key、追加credit購入、別planへの自動切替、Host既定Home／Credential Store／環境変数からの認証状態copyまたはfallbackを禁止する。quota／credit不足または状態不明では追加購入やAPI fallbackを行わず`blocked`とする。

CodexのChatGPT plan loginとClaude Codeのsubscription OAuthはProvider公式情報を2026-08-18に確認した。外部product、plan、quotaまたはbilling条件はCRDDの恒久事実にせず、Provider version、planまたは利用条件が変わった場合にQual-Labが再確認する。Claude Agent SDK creditを利用する場合も選択済みsubscriptionの範囲内に限定し、追加購入を自動化しない。

今回成立させるのは認証Policy、専用Homeの目標契約、上限付き状態判定およびFake Provider試験である。実OAuth login、実Provider image、実Codex／Claude起動、Provider endpoint Egress、認証probe、Telemetry判断およびOperation Capabilityは未実装で、spawn前に停止する。よって今回の変更は外部認証、Network、Repositoryまたは課金Effectを発火しない。

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

### 上限付きライフサイクルCore

Repository所有CoreはProvider、`login|run` mode、deadline 300000 ms、cancel grace 5000 ms、stdin 1048576 byte、stdout 1048576 byte、stderr 262144 byte、結果exact 1件を固定する。任意image、argv、Home、shell、PATH lookup、session resume、auto-updateまたは追加購入をcaller入力にしない。

Fake Provider観測は`prepared`、`submission_started`、`created`、`inspect_verified`、`started`、`exited_or_terminated`、`absence_confirmed`、`cleanup_confirmed`のexact順序を要求する。正常、非0終了、signal、timeout、cancel、stdout／stderr超過、二重結果、malformed結果、quota不足／不明、process treeまたはcontainer残存を別々に判定する。Fake正常は実Provider、OAuth、Egress、quota、Telemetry、自動更新またはOperation Capabilityを証明しない。

実Provider計画は現在常に`spawnAllowed:false`で、loginは`provider_explicit_login_effect_not_implemented`、runは`provider_egress_auth_and_fixed_image_binding_not_implemented`となる。Filesystem Effect、Network Effect、Operation Capability、AuthorityおよびGateを発行しない。

## 代表例

| 種類 | 入力・条件 | 結果 |
|---|---|---|
| 発火例 | Fake Providerがexact状態順、exit 0、結果exact 1件、process tree／container不存在を返す | Fake lifecycle Coreだけ`confirmed`。実Provider readinessは成立しない |
| 非発火例 | `doctor`、通常run、source checkoutまたはFake Provider確認 | OAuth login、Provider spawn、Network、課金、Repository Effectを発火しない |
| 境界例 | timeout、cancel、出力上限超過、signal、二重完了、quota exhausted | 固定reasonで`blocked`し、fallbackや追加購入を行わない |
| 情報不足例 | 固定image、Home保護、Egress、auth session、quota、process不存在のいずれか不明 | 実Provider spawn前に`blocked` |

## 利用側と変更禁止範囲

直接利用側は`provider-lifecycle.ts`、専用contract test、`doctor`のProvider check／contract投影、Coordinator README／脅威モデル、TypeScript source closureおよび本変更トレースである。既存Fake Docker ProbeのOperation一時`provider-home/`は隔離確認用の一時領域として維持し、永続専用Homeへ読み替えない。

公開Coordinator CLI／JSON Schema、公開Checker、採用Repository、Rust wire、Windows有効ポインター、12 blocker、6 current-run evidence、Gate、Authority、Capability、Platform Effect、v0.18 Candidateおよびv0.17 Released Baselineを変更しない。CHG-000015以前の履歴を現在の実Provider対応根拠へ流用しない。

## 検証と未評価

Node.js v24.19.0で次を実行した。

- Coordinator `check`: TypeScript型検査、Biome Warning拒否、format確認がPass
- Coordinator全contract test: 352／352 Pass
- Provider lifecycle test: 9／9 Pass
- Provider lifecycle source coverage: lines 100.00%、functions 100.00%、branches 100.00%、未到達行0
- source closure: Coordinator production 62、Coordinator test 54、Checker／template 5、Rust 4、unique total 122で完全一致
- Checker命名／参照試験: 5／5 Pass
- 公式Repository full checker: 488 files、308 Markdown、1899 links、565 anchors、26 Related、26 versioned documents、8 stable IDs、68 remediation rows、Error 0／Warning 0

coverage commandは`npm run provider-lifecycle:coverage --prefix tools/coordinator`である。Node built-in coverageは対象Coreから直接importされる既存`plain-data-snapshot.ts`も同じ表示へ含めるため、全体aggregateはlines 89.34%、functions 100.00%、branches 90.91%となる。ただし今回新設した`provider-lifecycle.ts`自身はline／function／branchの全軸100%である。既存共有helperの未到達分岐を新機能の不足へ混ぜず、同時にaggregate値を100%と主張しない。

実Docker、実OAuth、Provider公式image、実Egress、実quotaおよび実process-tree terminationは`Not Verified`である。残存riskは、Provider仕様やquota出力の変化、Home外Credential書込み、自動更新、Egress迂回および子process残存である。代替確認はFake Coreの正負・境界試験と既存Docker隔離Probeに限定し、OwnerはQual-Lab、再確認契機は固定image／login／Egress／実Provider Adapterのいずれかへの着手時とする。

現在の処置状態は`Applied / Self-checked — pending independent review`であり、`Resolved`、`Verified`、採用、統合、準拠、StableまたはReleaseを意味しない。
