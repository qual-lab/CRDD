# 変更トレース: Rust成果物の署名済みRelease結合

- 変更ID: `CHG-000020`
- 状態: `Ready for Verification`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-17
- 対象: CRDD公式Repositoryの内部CoordinatorとRust製プラットフォームアクセス部
- 対象version: v0.18.0 Candidate
- 変更分類: `breaking`
- 移行要否: `migration_required: true`（CRDD公式RepositoryのRelease build／stagingだけ。採用Repositoryと公開CLIは対象外）
- 関連正本: [`19_Maintenance.md`](../../19_Maintenance.md#33-internal-typescript-runtime)、[`CHG-000019`](CHG-000019_Rust_Platform_Access_Core.md)、[`tools/coordinator/README.md`](../../tools/coordinator/README.md)、[`tools/coordinator/threat-model.md`](../../tools/coordinator/threat-model.md)

## 判断と変更境界

Qual-Labが承認したTypeScript＋最小Rust構成を継続し、`CHG-000019`で保留したRust binaryのRelease Identity結合候補を実装する。上限付きプロセス（Bounded Process）によるproduction起動は、保護済み有効世代と検証済み実行imageの結合方式が未決・未実装のため、現在の入口から撤去して固定`blocked`へ戻す。

本変更はReleaseの採用、統合、署名実行または公開を決定しない。Root保護、DACL適用、Platform Provisioner Effect、Runtime reader、POSIX、initial Trustおよびactivationも成立させない。既存12 blocker、6 current-run evidence、Gate `blocked`、Authority／Capability／Effect非発行を維持する。

## 実装

- Windows成果物の固定相対Pathを`90_Release/platform-access/x86_64-pc-windows-msvc/crdd-platform-access.exe`、targetを`x86_64-pc-windows-msvc`、Rust toolchainを`1.94.1`、protocol revisionを1、最大byte長を16 MiBへ固定した。
- package manifestのexact payloadへ、固定相対Path、target、protocol revision、Rust toolchain、byte長およびSHA-256を持つ`platformAccessArtifact`を追加した。v0.18 Candidateでは旧candidate Schemaの互換aliasまたはshimを残さず、Release stagingと署名処理を新Schemaへ移行する。
- 署名commandは固定成果物を同一file handleで読み、最初に得た配布Root／file IdentityとHashを署名前およびmanifest排他配置後まで同じ基準へ再照合する。正常終了はその観測区間でのmanifestと成果物の一致候補だけを示し、継続的同一性、Release採用または実行許可を付与しない。
- 観測区間中に成果物、Rootまたはmanifest配置先が変わった場合は失敗する。生成済みmanifestをPathで自動削除せず、失敗したstaging Root全体を破棄して再作成する。
- TypeScript Adapterのproduction process実装を撤去した。入力を参照せず`platform_access_protected_active_generation_binding_not_implemented`で停止し、Path、時刻、manifest、package、processまたはFilesystemへ到達しない。
- locked build入口をdebug buildから`--release`付きへ変更した。生成物の固定Release Pathへの配置と実鍵署名はRelease工程の明示操作であり、本変更では実行しない。

## 利用側と現在状態

Release artifact contract、manifest Core、署名command、Release Identity再計算、package filesystem loader、private process Adapterおよび各contract testを同時更新した。README、脅威モデルおよび保守正本は、次の三段階を一意に区別する。

1. Rust Coreと、署名manifestへ結合する成果物観測・署名候補は実装済みである。
2. 保護済み有効世代、検証済み実行image、production process起動およびRoot観測成果物への写像は未実装である。
3. DACL mutation、Provision Effect、Runtime reader、POSIX、initial Trust、activation、AuthorityおよびCapabilityも未実装である。

通常run、`doctor`、`activate`または`provision`からprocessを発火しない。source checkoutと署名済みstagingのどちらでも入力Pathやhelper processより前に`blocked`となる。第13 blockerを追加せず、既存`platform_provisioner_verification`と`platform_provisioner_effect`の未完了範囲へ接続する。

## 専門探索・収束

Release binding方式は、tracked binary、post-checkout署名manifest、OS native code signing、binaryの埋込み／resource化、保護済みstagingとhandle／image結合、およびprocess停止継続を比較した。tracked binaryは履歴量とplatform別配布を増やし、post-checkout manifest単独はsupply-chain Identityと再現性に優れるがPath起動のTOCTOUを閉じない。OS native code signingはOS loaderとの親和性が高い一方、証明書LifecycleとOS依存を追加する。埋込み方式は単一artifact化できるが配布量と更新責務をTypeScript側へ集中させる。保護済みstaging／handle結合は実行image同一性に最も直接的だが、writer排他、OS APIおよびRelease世代管理が必要である。

現時点はprocess停止継続を採用する。機能提供は進まないが、署名Hash対象と実行imageが異なり得る状態で現在process tokenを使って起動しないことを優先する。OwnerはQual-Lab。残存riskはWindows実効access観測がproductionへ接続されずRoot保護が未検証なこと。Release binding着手時に、保護済み有効世代、writer排他、verified image結合、OS native code signingの要否、復旧および配布artifactを人間判断し、Security／Architectureレビューを再実行する。`osNativeCodeSignatureDecision`は`deferred_until_production_verified_image_binding`であり、現candidate manifestがAuthenticodeを要求しない事実を将来方式の不採用決定へ流用しない。

## 移行と復旧

CRDD公式RepositoryのRelease工程は、locked release buildの成果物を固定相対Pathへ配置してから、新manifest Schemaで署名しなければならない。旧manifest、別target、別toolchain、別Path、別Hashまたは開発用binaryは受理しない。採用Repository、公開Checker、Coordinator公開CLI、JSON Schemaまたは利用者操作には移行を要求しない。

新工程を成立させられない場合はv0.17.0 Released Baselineへ戻し、未結合Rust成果物をReleaseへ含めない。v0.18.0 Candidateの互換wrapper、旧field aliasまたは二重manifest Schemaは作らない。

## Self-checkと独立確認

是正後の局所確認ではCoordinator 348/348、typecheck、Biome lint／formatが合格した。Nodeの`--experimental-test-coverage`で本変更のmanifest Core／loader、package／Release Identity、成果物観測、署名、固定停止Adapterおよび下流投影を含む98件を測定し、全対象合計はline 61.11%、branch 79.24%、function 57.44%だった。主要変更sourceは署名処理73.77%／62.75%／69.23%、成果物観測93.64%／75.00%／100%、固定停止Adapter 97.93%／88.89%／100%、manifest loader 93.44%／82.98%／100%、manifest Core 93.74%／90.08%／100%、Release Identity 92.23%／69.12%／100%である。総test件数やRust 7/7を網羅根拠へ換算しない。

検証義務は、exact manifest Schema、専用成果物必須化、release tree除外、同一handle Hash、Root／file Identity連続性、署名前差、配置後差、manifest自動削除なし、固定公開鍵拒否、Proxy入力非参照のproduction停止、下流状態投影を`Verified`とする。本番固定秘密鍵による実署名、実Release staging、command返却後の改変、protected active generation、verified image、OS native code signing、production process、実Windows FFIは`Not Verified`である。残存riskは署名済み候補をReleaseへ昇格できずWindows観測をproduction利用できないこと。OwnerはQual-Labで、Release handoffまたはproduction process再導入時に再評価する。撤去したtimeout／signal／stderr／exitのprocess分岐は`Not Applicable — implementation removed`であり、再導入時に新しい検証義務として発火する。

これは`Self-checked`であり、新固定Commit／Treeの全体Checkerおよび独立監査集合が完了するまで`Verified`または`Resolved`ではない。

独立確認では、manifestの全field差、成果物Hash／Identity差、Root差、署名観測区間、source checkoutを含む入力前停止、公開情報最小化、12 blocker／6 evidence／Gate／非Release境界を水平確認する。実署名Release、production process、Root観測写像、DACL EffectおよびRelease判断は未評価範囲である。

## 固定版`bb9ecdac`の独立確認と無効化

固定対象はCommit `bb9ecdac504159d0b5baad85b04c476aa7a2685d`、Tree `5b5e7617ca38783140a026c98e7978aaaef15d41`、Parent `ddb907330ab57bc1188e8563a6108fb9ad966752`。共通入力はCoordinator 343/343、Checker 151/151、Rust 7/7、TypeScript 124／Rust 4 source closure、両package check、Rust fmt／Clippy／locked release build、full Checker Error 0／Warning 0、cleanだった。

- Agent／Architecture／Security: `Fail`。`ASR-20-01` Critical（Hash観測対象とPath起動imageの同一性切断）、`ASR-20-02` High（production／signing経路の動的検証不足）、`ASR-20-03` Medium（現在状態の文書・試験名不一致）。3件とも今回変更で新規。
- Document: `Fail`。`DOC-REL-001` Major（未定義状態`Draft`）、`DOC-REL-002` Minor（`bounded process`のlocale-first未定義）。2件とも今回変更で新規。
- Gap／Impact: `Fail`。`GCI-20-001` Major（実行image同一性）、`GCI-20-002` Major（TypeScript coverage／検証義務不足）、`GCI-20-003` Minor（専用Rust成果物必須contract不一致）、`GCI-20-004` Major（Release binding方式の専門探索不足）。初回監査のため再監査4分類は非適用。
- Conformance: `Fail`。C-11、PL-16、PL-19がNon-conformantで、準拠claimは`Not Eligible`。

この監査集合は全体として`Invalidated`であり、現在判定へ流用しない。各処置は`Applied`／`Self-checked`で、新固定版の同一監査集合が完了するまで`Resolved`ではない。
