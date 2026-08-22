# 変更トレース: 現在プロセス主体観測（Current Process Principal Observation）

- 変更ID: `CHG-000032`
- 状態: `In Review`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-23
- 対象: CRDD公式Repositoryのprivate Rust製プラットフォームアクセス部とTypeScript AdapterにおけるWindows現在process tokenの読み取り専用分類候補
- 対象version: v0.18.0 Candidate
- 変更分類: `breaking`（private Rust wire protocolをrevision 2から3へ更新し、旧revisionのalias／fallbackを設けない）
- 移行要否: `migration_required: true`（署名manifestのRust成果物Identityとprotocol revision、TypeScript decoderおよびRepository内fixtureを同時更新する。supported production active generationは0で、端末state変換はない）
- 関連正本: [`19_Maintenance.md`](../../19_Maintenance.md#33-internal-typescript-runtime)、[`CHG-000021`](CHG-000021_Protected_Active_Pointer.md)、[`CHG-000026`](CHG-000026_Provider_Home_Protection_Foundation.md)、[`CHG-000029`](CHG-000029_Provider_Home_Mount_Grant_Lifecycle_Foundation.md)、[`CHG-000031`](CHG-000031_Runtime_Owned_Operation_Context_Capability.md)、[`Coordinator README`](../../tools/coordinator/README.md)、[`脅威モデル`](../../tools/coordinator/threat-model.md)、[`実装残件台帳`](../../99_Roadmap/08_CRDD_v0_18_Implementation_Follow_Up_Registry.md)

## 結論と変更経路

Rust wire revision 3は、現在processのprimary tokenから取得する既存の`TokenUser` domain-separated Hashに加え、primary token、enabled interactive／service／batch／network group、restricted token、AppContainerおよび非zero sessionの読み取り専用観測を固定bitへ写像する。TypeScript Adapterは固定magic、revision、長さ、nonce、role、reason、access bit、非zero主体Hash、既知主体bitおよびprimary token bitをexactに検証し、限定名の非Authority候補へ変換する。

この候補は選択ローカル対話ユーザー拘束（selected local interactive user binding）ではない。interactive groupまたはsessionだけ、現在processのHash、elevated group、caller supplied SID／Pathまたは合成responseから、`selectedUserBindingVerified`、`runtimePrincipalBound`、保護済みactive、検証済み実行イメージ、Runtime AuthorityまたはCapabilityを成立させない。Production Adapterは引き続きprocess起動前に`blocked`であり、Filesystem、DACL、Provider Home、Credential、Network、Provider processまたは課金Effectを発火しない。

調査では、active pointerがbinder済み主体Hashを要求する一方、binderに必要なnative helper production起動が保護済みactive／検証済み実行イメージ待ちという循環を確認した。Provider Home保護Effectを先行させない。後続は、人間が真正性を確認した公式署名済みReleaseを初期Trustとする明示`provision`専用pre-active one-shot境界を、人間の決定権限で先に固定する。通常Runtimeのproduction Adapterと分離し、固定manifest／artifact、non-link handle、署名／Hash／byte長／target／wire、固定argv／環境／I/O／timeout／Job Objectへ結合した後にだけbinder、active pointer、通常Runtime readerへ進む。

変更はRust wire、署名manifest contract、TypeScript Adapter、active pointer利用前提、README／脅威モデルおよび残件順へ影響する非自明なSecurity変更である。着手前整合ではMaintenance 3.3、CHG-000021／026／029／031、Rust protocol／Windows access実装、TypeScript decoder、manifest利用側およびProvider Home境界を確認した。完成固定版ではAgent／Architecture／Security Review、Document Audit、Gap／Impact AuditおよびConformance Auditを同一改訂版へ実施する。公開CLI grammar、採用Repository Schema、Communication、Discovery、Provider配布物、外部情報処理およびReleaseは変更しないため非該当である。

## 発火、非発火、境界および情報不足

- 発火例: Rust component試験または将来の検証済みone-shotが、同一requestのRoot accessと現在process primary token属性を読み取り、revision 3固定responseを返す。TypeScript decoderは既知bitだけを限定名へ写像する。
- 非発火例: 通常run、doctor、source checkoutおよび現在の`coordinator provision`はnative helperを起動せず、ユーザー拘束、FilesystemまたはProvider Effectを発火しない。
- 境界例: interactiveとservice等の観測が同時に成立しても観測事実を保持するだけでbinderへ昇格しない。別資格情報昇格、service／batch／network token、restricted token、AppContainerまたはsession差は、後続binderが明示Policyで判定するまで選択済み主体としない。
- 判定情報不足例: response長、revision、nonce、role、reason、未知bit、primary token bitまたは主体Hashを確認できない場合は候補化せず`blocked`とする。Production来歴を確認できないresponseは、構造が正しくてもRuntime Authorityへ昇格しない。

## 保持する意図と変更禁止範囲

既存subscription OAuthだけを使い、API key、追加credit、Host Credential、token copy／injection、installer、外部通信およびPath開示を許可しない。ローカルOS user 1名だけというWindows v1方針、CHG-000026のProvider Home配置、CHG-000029の最長5分／1回限りGrant、CHG-000031のopaque Operation binding、既存12 blocker／6 evidence、Gate `blocked`、v0.18 Candidateおよび非Releaseを維持する。

source checkout、PATH、Cargo、ShellまたはHost binaryへfallbackしない。raw SID、session ID、group SID、token、ACL、Pathまたはraw OS errorを公開結果へ含めない。wire revision 2をalias受理せず、旧manifestをrevision 3へ読み替えない。本変更をselected-user binder、Provider Home保護、active pointer永続化、実Provider readinessまたはClaude安全実行へ読み替えない。

## 検証設計と現在品質状態

- Rust unit／CLI integrationはrevision 3 magic／length、主体Hash、primary token bit、blocked responseのzero bitおよび旧／不正request拒否を確認する。
- TypeScript contract testは8分類bitのexact写像、unknown bit、primary bit欠落、nonce／role／length／access bit／zero Hash拒否、非Authority flagおよびproduction起動前blockedを確認する。
- Rust format、Clippy Warning拒否、locked test、locked release build、Rust coverage、Coordinator strict typecheck／lint／format、全contract test、TypeScript platform-access coverage、Checker package testおよびRepository全体checkerを別軸で確認する。

基準Node.js `v24.19.0`でCoordinator checkはPass、全contract testは410／410だった。Rust `1.94.1-x86_64-pc-windows-msvc`ではformat、Clippy Warning 0、locked test 8／8およびlocked release buildがPassした。Rust coverageはregions `1128/1254`、functions `46/47`、lines `733/802`で、固定stable toolchainがbranch mappingを生成しないためbranch `0/0`を100%へ換算しない。TypeScript platform-access coverageはexact 19 source／18 testでlines `6406/7198`、functions `232/251`、branches `991/1231`だった。変更source `platform-access-adapter.ts`はlines `244/248`、functions `12/12`、branches `38/42`である。compact JSON UTF-8＋末尾LFは140,355 byte、SHA-256 `41515f363539ddc8dc83b6870df757fc9436d90ae334deb39f2c019e485bf57c`が是正後4回連続で一致した。

正式値固定前の反復確認で、既存package directory race fixtureがDirectory metadata変化を先に検出するrunと最終inventory差を検出するrunに分かれ、同じblocked結果でもV8 branch母集団が`991/1231`と`992/1232`の間で揺れることを検出した。fixtureはproductionの判定順を変えず、変更対象child Directoryの`lstat`だけを変更前metadataへ固定し、追加／削除／型変更を最終inventory差で必ず検出するよう是正した。是正後は上記byte長、SHA-256および全coverage値が4回連続で一致した。旧runの一致を現在の反復安定性へ流用しない。

Rust未到達は非Windows main、I/O failure、Windows API failure、rare token query／membership failureおよび一部Root access failureである。TypeScript未到達はBuffer intrinsic failure、内部copy failure、response read防御分岐およびproduction invocation固定blocked分岐を含む。残存riskは、Windows token分類の特殊組合せまたはAPI failureを粗いblockedへまとめること、後続binderが観測候補を十分条件として誤用することである。代替確認は固定bit全数、unknown／欠落bit、現在Windows processのRust integration、旧wire拒否、production起動前blockedおよび全利用側のrevision同期である。OwnerはQual-Labとし、token／session Policy、bootstrap process、binder、active reader、Verified ImageまたはProvider Home Effectを実装する変更で再確認する。100%達成、binder成立、Gate、Stable、ReleaseまたはClaude安全実行は主張しない。

Checker packageのcheckはPass、contract testは151／151だった。Repository全体checkerは543 files、347 Markdown、2,005 local links、578 anchorsを確認し、Error 0／Warning 0だった。実Provider、Docker、OAuth、Network、Provider Home保護、mountまたは課金Effectは発火していない。完成候補commitとtreeを固定して必須監査集合へ渡し、旧CHGの合否を流用しない。

## 未完了事項と人間判断

`FU-018-PROVIDER-HOME`は`In Progress`のまま維持する。次の保護対象判断は、公式署名済みReleaseから明示`provision`時だけ許すpre-active one-shotを、Maintenance 3.3の通常production起動禁止と分離して採用するかである。採用する場合も、固定manifest／artifact／process境界、別資格情報昇格、失敗回復および通常Runtime非発火を同じCHGで固定してから実装する。

現在の実装範囲に追加の人間判断は不要である。pre-active bootstrap例外の採用、保護対象変更の統合、準拠表明、Gate open、StableまたはReleaseは人間の決定権限へ残す。
