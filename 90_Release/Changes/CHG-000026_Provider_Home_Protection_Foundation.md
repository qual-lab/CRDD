# 変更トレース: 専用Provider Home保護基盤（Dedicated Provider Home Protection Foundation）

- 変更ID: `CHG-000026`
- 状態: `Ready for Verification`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-19
- 対象: CRDD公式Repositoryの内部Coordinator、Windowsローカルユーザー専用Provider Homeの配置候補と保護要件
- 対象version: v0.18.0 Candidate
- 変更分類: `breaking`（private Provider lifecycle revision 2から3、private doctor `reportVersion` 4から5）
- 移行要否: `migration_required: true`（Repository内producerとcontract testを同時更新し、旧revisionのalias／fallbackを設けない。supported production Provider Home stateは0で永続state変換はない）
- 関連正本: [`19_Maintenance.md`](../../19_Maintenance.md#33-internal-typescript-runtime)、[`CHG-000022`](CHG-000022_Provider_Lifecycle_Foundation.md)、[`CHG-000025`](CHG-000025_Dynamic_Fake_Provider_Cancellation_Verification.md)、[`tools/coordinator/README.md`](../../tools/coordinator/README.md)、[`tools/coordinator/threat-model.md`](../../tools/coordinator/threat-model.md)

## 結論

追加課金なしで既存subscription OAuthを利用する方針を維持し、実loginより先に専用Provider Homeの固定配置候補と保護要件を機械契約化する。Windowsのlocal app data Rootから固定`Qual-Lab/CRDD/ProviderHomes/{codex|claude}`だけを候補化し、ローカルOS user＋Provider単位で永続、同じuserの複数Repositoryから再利用、他Providerと非共有、通常Operation cleanupの対象外とする。

今回実装するのはcaller supplied Windows絶対Pathを使う字句上の配置候補と目標契約だけである。候補入力がWindows Known Folderのlocal app dataから取得された事実も未確認であり、将来EffectはそのOS sourceを別途必須とする。ディレクトリ作成、owner／DACL変更、実在性、stable Root Identity、non-link／non-reparse、selected local user binding、OAuth session、login／logout、remote revoke、削除、専用Homeマウント許可、Authority、Capabilityおよび実Provider spawnは実装しない。callerが渡したPathはAuthorityではなく、結果へPathを含めない。

## 着手前整合と代表例

- 発火例: `codex|claude`と保守的Windows絶対Path subsetに適合するlocal app data Rootを内部候補評価へ渡すと、Provider別の非Authority layout `candidate`を返す。
- 非発火例: 通常doctor、通常run、`doctor --isolation`、source checkout、Host HomeまたはOperation一時`provider-home/`は作成、ACL、loginまたはProvider spawnを発火しない。
- 境界例: 相対Path、forward slash、末尾separator、unsupported Provider、余分field、accessorまたはProxyは処置前に固定reasonで`blocked`となる。
- 情報不足例: local app data Root、実在性、Identity、reparse、owner／DACLまたはselected local userを確認できない場合は保護済みとせず、実Provider runをspawn前に`blocked`する。

## 契約と利用側

新しい`crdd-coordinator/provider-home` revision 1は、Provider集合、固定Root segment、Provider別directory名、永続範囲、非移行元、保護観測要件および非Authority境界を所有する。`provider-lifecycle` revision 3はこの契約を直接投影し、実runのblocked reasonへHome保護不足を明示する。private doctorは`reportVersion:5`だけを生成する。

利用側は`provider-home.ts`、`provider-lifecycle.ts`、`doctor.ts`、各contract test、coverage command、README、脅威モデル、Maintenanceおよび本変更トレースである。Profile／Authority Registry revision 2、専用Homeマウント許可参照、dynamic Fake、Docker recovery、公開CLI入力grammar、公開Checker、採用Repository Schema、Rust wire、12 blocker、6 current-run evidence、Gate、v0.18 Candidateおよびv0.17 Released Baselineは変更しない。

private doctorのRepository内production decoder／consumerは全数探索で0であり、producerとexact schema assertion testだけをrevision 5へ更新する。Provider lifecycle revision 2またはdoctor revision 4をalias変換せず、未受入candidateは再生成する。supported production Provider Homeがないため既存CredentialやHost Homeを移行しない。

## 専門探索と収束

比較した案は、Host既定Homeの再利用、Operationごとの一時Home、Repository単位の永続Home、local user＋Provider単位の永続Homeである。Host再利用はCredential分離を証明できず、一時Homeは毎Operation loginとrefresh state喪失を招き、Repository単位は同一user内で不要なsession複製を作る。既承認のlocal user＋Provider単位を維持し、Windowsのuser-local stateとしてlocal app data配下の固定Repository-owned segmentを候補にした。

弱点は、字句候補だけではFilesystem実体、ACL、selected user、OAuth stateまたはProviderのHome外書込みを証明できないことである。このため候補を`candidate`、保護・認証・許可をfalse／`not_implemented`へ固定する。保持条件は、将来Effectが同じ固定RootをOS handle／Identityへ結合し、link／reparseを拒否し、選択local userだけの必要権限と他writer不在を確認し、token内容をRuntimeへ出さないこと。保護Effect、auth probe、loginまたはmount binder着手時に再評価する。

## 品質状態と未評価

対象contract testは方針、Codex／Claude正例、Path非出力、Host／Operation Home非移行、unsupported Provider、Path境界、余分field、accessor、Proxyおよび非昇格を確認する。`npm run provider-home:coverage --prefix tools/coordinator`はWindows Path validator、plain snapshot、Provider Home、Provider lifecycle、doctor、共有exact LCOV parserおよびrunner自身の固定7 production sourceと固定7 testを連続2回測定する。source別line／function／branchのcovered／total、全未到達BRDA Identity、reason、risk、代替確認、Owner、human decisionおよびrecheckをcompact JSON UTF-8＋末尾LF exact 1件へ保存する。platform dispatchの反対OS分岐、実Docker／Filesystem failure、複合短絡およびrunner failureは、実OS／Effectを捏造して100%へ上げず個別義務として残す。

自己確認時の合計はlines `2025/2213`、functions `80/87`、branches `402/481`で、未到達branchは79件である。新規`provider-home.ts`はlines `135/135`、functions `6/6`、branches `17/17`の全到達、`provider-lifecycle.ts`と`plain-data-snapshot.ts`も全到達である。未到達は反対OS dispatch 1件、doctorの環境／Docker／cleanup分岐51件、共有parser 26件、runner main guard 1件で、全件を決定論的出力の義務へ接続した。連続2回のpayload SHA-256は`6005503557356981ed65dfa9d84a44b4a0fc27648753ef06b7cc83de8a14bf32`、stdoutは60,987 byte、SHA-256は`cc53e4e15c779e7b7b17ddfcdc2a95a44d1f59da8fa05f424b74ffe0df3b9411`である。100%未達はProvider Home Coreの未検証分岐ではなく、母集団に含めた共有利用側と品質生成器のOS／環境／防御分岐である。

Node.js v22.18.0でCoordinator check、Coordinator全contract test 385／385、Checker contract test 151／151、Provider Home coverage、tools命名／source closure 5／5およびfull checkerを確認対象とする。source closureの固定値はCoordinator production 66、Coordinator test 60、Checker／template 5、Rust 4、unique total 134である。Rust sourceとwireを変更していないためRust test／coverageは本変更の成立根拠へ流用せず`No Impact`とする。

実Windows Home作成、ACL、selected user binder、実OAuth、auth session probe、固定Provider image、Egressおよび実Provider processは`Not Verified`である。現在の品質状態は`Partially Verified`で、機械確認または配置候補成立をProvider readinessへ流用しない。

## 初回独立監査と是正状態

固定Commit `4900edc923595bda98999b9e54d23d733324f02d`／Tree `5de594f128660fb04c886cb33e68f6c165e74251`／Parent `5b51e8d89511796e17735a250a759df16cc562ec`の初回監査では、Agent／Architecture／Securityは`Pass`／Finding 0、Documentは`Fail`（`DOC-HOME-001` Major、`DOC-HOME-002` Minor）であった。Documentの2件はともに「今回の変更によって発生」と分類された。初回Gap／ImpactとConformanceはいったん`Pass`／`Eligible`を返したが、Document Majorの統合後は`GCI-HOME-001` Major（L3 Cross-layer、初回Gapの見落し）によりそれぞれ`Fail`、`Fail / Not Eligible`へ訂正された。

この監査集合は`Invalidated`であり、新固定版の現在判定へ流用しない。是正はREADME、脅威モデルおよびMaintenanceの現在入力／将来Effect source分離と、本CHGのcoverage入口名に限る。`DOC-HOME-001`、`DOC-HOME-002`および`GCI-HOME-001`の状態は`Applied / Self-checked — pending independent re-review`であり、新固定版の必須監査集合完了前に`Resolved`としない。

是正後固定Commit `fb949110e071043eab6284d8f5117ce080c017b0`／Tree `97587f4e0c0350fcdd0a266805b45cbc3b192f3c`／Parent `4900edc923595bda98999b9e54d23d733324f02d`では、Agent／Architecture／Security、Document、Gap／ImpactおよびConformanceがすべて`Pass`／Finding 0となり、既知3 Findingは解消候補となった。しかしEvidence固定前の機械入力再照合で、実行Nodeが`v22.18.0`であるのに自己確認記録が旧系列の`v24.19.0`を示していた品質根拠の同一性不整合`QA-HOME-001`（Major、今回の変更によって発生）を親Agentが検出した。`fb94911`の監査集合も`Invalidated`／現在不流用とし、実測Node版だけを訂正した。`QA-HOME-001`は`Applied / Self-checked — pending independent re-review`であり、機械結果、coverage値およびHash自体は変更しない。

## 変更禁止範囲と完了条件

API key、従量API、追加credit購入、自動plan切替、Host Credential import、実Provider／Network Effect、Authority、Capability、Gate、StableまたはReleaseを有効化しない。CHG-000022からCHG-000025の固定履歴とEvidenceを書き換えない。

新固定Commit／TreeでCoordinator check、全contract test、Provider Home coverage（`npm run provider-home:coverage --prefix tools/coordinator`）、source closure、Checker、full checkerを取得し、Agent／Architecture／Security、Document、Gap／ImpactおよびConformanceの4つの必須独立確認を同一Commit／Treeと共通機械入力で旧合否不流用のまま完了するまで、Findingを`Resolved`またはCHGを`Verified`へ昇格しない。
