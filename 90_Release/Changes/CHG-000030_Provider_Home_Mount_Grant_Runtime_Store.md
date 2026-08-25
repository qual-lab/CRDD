# 変更トレース: Provider Homeマウント許可Runtime Store（Provider Home Mount Grant Runtime Store）

- 変更ID: `CHG-000030`
- 状態: `Close without Release`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-22
- 対象: CRDD公式Repositoryのprivate CoordinatorにおけるRuntime所有Mount Grant storeの先行実装候補
- 対象version: v0.18.0 Candidate
- 変更分類: `non-breaking`（未接続moduleの候補追加を評価し、不採用として現在成果物から除去した）
- 移行要否: `migration_required: false`（production consumer、発行済みGrant、永続state、実mountおよび公開Schema変更は0）
- 関連正本: [`16_Quality_Assurance.md`](../../16_Quality_Assurance.md)、[`19_Maintenance.md`](../../19_Maintenance.md#33-internal-typescript-runtime)、[`CHG-000029`](CHG-000029_Provider_Home_Mount_Grant_Lifecycle_Foundation.md)、[`実装残件台帳`](../../99_Roadmap/01_Product_Roadmap.md)

## 結論

固定候補commit `e466fd309ecf8e62c6f0db610d16ca8a964fbf3a`／tree `ea53efe43d806e4da04f87356e650bc8ee32d2c1`へ実装した先行store候補は、独立レビューと監査でAuthority provenance、時刻、record Identity、失敗Effect、失効aliasに重大な欠陥を確認したため採用せず、現在成果物から除去した。実装順をselected-user binder、Provider Home保護観測、Operation context Capability、Runtime store／clock／issuer、mount／Operation終了時失効へ変更する。

これはCRDD v0.18.0 Candidate、CHG-000029のpure Core、5分、1回、4状態、半開区間、Path／Credential非表示、API key／追加credit拒否、通常`doctor`からGrant Store Effectを発火しない境界、およびClaude-firstの目標を変更しない。通常`doctor`が持つ既存の診断Filesystem Effectも変更しない。

## 確認した問題

- caller suppliedのOperation ID、Provider／Profileおよび三観測Hashを、Operation `management/`の所有CapabilityだけでRuntime Authorityへ昇格していた。
- 可変wall clockだけを使い、時刻後退後に実経過5分を超えて使用できる可能性があった。
- 保存recordの完全binding／canonical bytes／stable file IdentityをCapabilityへ結合せず、Pathの`lstat`後に別のPath読取りを行っていた。
- 部分Filesystem Effect、commit不明、lock／temporary残留を全て`filesystemEffectIssued:false`へ丸めていた。
- Grant controlとmount authorizationのaliasを共有し、明示失効時に全aliasを不可逆失効できなかった。
- Effect入口でProfile ID／Operation IDの64文字上限を先に適用していなかった。

## 検証と監査結果

固定候補では基準Node.js `v24.19.0`でCoordinator strict typecheck／Biome lint／formatはPass、全contract testは402／402、Provider Home coverage runnerはPass、Repository全体checkerは543 files、345 Markdown、1,987 local links、576 anchors、Error 0／Warning 0だった。機械確認のPassは上記Authority欠陥を否定しない。

同じ固定候補へのAgent／Architecture／Security ReviewはFail（High 3、Medium 2、Low 1）、Document AuditはFail（Major 2、Minor 1）、Gap／Impact AuditおよびConformance AuditはFail／Not Eligible（Major 3、Minor 1）だった。共通原因は、必要なbinderより先にstoreを実装し、格納場所の所有とbindingのAuthority provenanceを混同したことである。

## 終了と後続

候補module、直接試験、coverage母集団追加および実装済み表示を現在成果物から除去する。過去固定候補と監査結果は本変更に保持し、合格またはReleaseへ読み替えない。未完了事項は実装残件台帳の`FU-018-PROVIDER-HOME`へ戻し、selected-user binder、Provider Home保護観測およびOperation context Capabilityを先に成立させた後、新しい変更としてstoreを再実装する。

除去後固定commit `756cec1e53cb5fb5cba238aeed5aa60bf694da77`／tree `da35d3911a58c8aab80a5ad88881fa05fcc23b90`では、Coordinator strict typecheck／Biome lint／formatはPass、全contract testは399／399、Repository全体checkerは541 files、345 Markdown、1,988 local links、576 anchors、Error 0／Warning 0だった。

状態とEvidence順序を訂正した固定commit `9e39affd09d43ee2aeb32cdc2a362e845a5f1062`／tree `3514a20f90adcb6f5877a98c8886c51b58271e7e`へのAgent／Architecture／Security Review、Document Audit、Gap／Impact AuditおよびConformance AuditはすべてPass、Finding 0で、監査対象scopeはEligibleだった。同じ固定版へのRepository全体checkerも541 files、345 Markdown、1,988 local links、576 anchors、Error 0／Warning 0だった。Eligibleは本変更を`Close without Release`とする人間の終了処置、Release、Gate openまたは将来store設計の採用を代替しない。

現在、人間による追加設計判断は必要ない。安全側の依存順へ戻す処置であり、保護対象の採用、リスク受容、統合またはReleaseは行っていない。Qual-Labの理由付き終了として`Close without Release`を確定し、後続は実装残件台帳から再開する。
