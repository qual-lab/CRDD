# 変更トレース: Rust成果物の署名済みRelease結合

- 変更ID: `CHG-000020`
- 状態: `Draft`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-17
- 対象: CRDD公式Repositoryの内部CoordinatorとRust製プラットフォームアクセス部
- 対象version: v0.18.0 Candidate
- 変更分類: `breaking`
- 移行要否: `migration_required: true`（CRDD公式RepositoryのRelease build／stagingだけ。採用Repositoryと公開CLIは対象外）
- 関連正本: [`19_Maintenance.md`](../../19_Maintenance.md#33-internal-typescript-runtime)、[`CHG-000019`](CHG-000019_Rust_Platform_Access_Core.md)、[`tools/coordinator/README.md`](../../tools/coordinator/README.md)、[`tools/coordinator/threat-model.md`](../../tools/coordinator/threat-model.md)

## 判断と変更境界

Qual-Labが承認したTypeScript＋最小Rust構成を継続し、`CHG-000019`で保留したRust binaryのRelease Identity結合とbounded process境界を実装する。Rustを公開CLI、単独製品または採用Repositoryの依存へ広げず、Shell、PATH、`cargo run`または開発用`target/`成果物へRuntime fallbackしない。

本変更はReleaseの採用、統合、署名実行または公開を決定しない。Root保護、DACL適用、Platform Provisioner Effect、Runtime reader、POSIX、initial Trustおよびactivationも成立させない。既存12 blocker、6 current-run evidence、Gate `blocked`、Authority／Capability／Effect非発行を維持する。

## 実装

- Windows成果物の固定相対Pathを`90_Release/platform-access/x86_64-pc-windows-msvc/crdd-platform-access.exe`、targetを`x86_64-pc-windows-msvc`、Rust toolchainを`1.94.1`、protocol revisionを1、最大byte長を16 MiBへ固定した。
- package manifestのexact payloadへ、固定相対Path、target、protocol revision、Rust toolchain、byte長およびSHA-256を持つ`platformAccessArtifact`を追加した。v0.18 Candidateでは旧candidate Schemaの互換aliasまたはshimを残さず、Release stagingと署名処理を新Schemaへ移行する。
- 署名commandは固定成果物を同一file handleで読み、配布Rootと成果物のIdentityが読取り前後で安定し、Git Tree計算から後置manifestと後置Rust成果物だけが除外されている場合にだけ署名する。秘密鍵は引き続きRepository外の固定公開鍵対応鍵だけを使う。
- TypeScript Adapterは同じ署名済みmanifestで検証した固定絶対Pathだけを空argv、Shellなし、PATH検索なし、最小環境、固定binary stdin、5秒timeout、stdout／stderr各4096 byte上限で起動する。起動後に成果物とRootのIdentityを再確認し、exit、signal、stderr、nonce、role、status、access bitおよびresponse byte長をstrictに検証する。
- manifest、成果物、Hash、Identityまたはresponseの欠落・不一致、source checkout、timeoutまたはprocess errorは固定`blocked`へ閉じる。絶対Path、SID、ACL、token、descriptor、raw stdout／stderrまたはraw OS errorを公開しない。
- locked build入口をdebug buildから`--release`付きへ変更した。生成物の固定Release Pathへの配置と実鍵署名はRelease工程の明示操作であり、本変更では実行しない。

## 利用側と現在状態

Release artifact contract、manifest Core、署名command、Release Identity再計算、package filesystem loader、private process Adapterおよび各contract testを同時更新した。README、脅威モデルおよび保守正本は、次の三段階を一意に区別する。

1. Rust Coreと署名済み成果物を起動するbounded process Adapterは実装済み候補である。
2. process結果をRoot観測成果物へ写像し、Protection Hashへ結ぶ処理は未実装である。
3. DACL mutation、Provision Effect、Runtime reader、POSIX、initial Trust、activation、AuthorityおよびCapabilityは未実装である。

通常run、`doctor`、`activate`または`provision`からprocess Adapterを暗黙発火しない。source checkoutには署名済みmanifestと固定Release成果物がないため、入力Pathやhelper processより前に`blocked`となる。第13 blockerを追加せず、既存`platform_provisioner_verification`と`platform_provisioner_effect`の未完了範囲へ接続する。

## 移行と復旧

CRDD公式RepositoryのRelease工程は、locked release buildの成果物を固定相対Pathへ配置してから、新manifest Schemaで署名しなければならない。旧manifest、別target、別toolchain、別Path、別Hashまたは開発用binaryは受理しない。採用Repository、公開Checker、Coordinator公開CLI、JSON Schemaまたは利用者操作には移行を要求しない。

新工程を成立させられない場合はv0.17.0 Released Baselineへ戻し、未結合Rust成果物をReleaseへ含めない。v0.18.0 Candidateの互換wrapper、旧field aliasまたは二重manifest Schemaは作らない。

## Self-checkと独立確認

編集途中の局所確認では、Coordinator typecheckと343 contract testsが合格した。Checkerの固定Cargo command契約はlocked release buildへ更新し、新しいproduction／test sourceを命名・所有範囲へ追加した。これは`Self-checked`であり、固定Commit／Tree、全体Checkerおよび独立したAgent／Architecture／Security、Document、Gap／Conformanceの監査集合が完了するまで`Verified`または`Resolved`ではない。

独立確認では、少なくともmanifestの全field差、成果物Hash／Identity差、Root差、process timeout／signal／stderr／exit、response nonce／role／status／bit、source checkoutでの入力前停止、公開情報最小化、12 blocker／6 evidence／Gate／非Release境界を水平確認する。実署名Release、実機でRelease成果物を介した正常process、Root観測写像、DACL EffectおよびRelease判断は本変更の未評価範囲である。
