# 変更トレース: 現在プロセス主体観測（Current Process Principal Observation）

- 変更ID: `CHG-000032`
- 状態: `In Review`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-23
- 対象: CRDD公式Repositoryのprivate Rust製プラットフォームアクセス部とTypeScript AdapterにおけるWindows現在process tokenの読み取り専用分類候補
- 対象version: v0.18.0 Candidate
- 変更分類: `breaking`（private Rust wire protocolをrevision 2から3へ更新し、旧revisionのalias／fallbackを設けない）
- 移行要否: `migration_required: true`（署名manifestのRust成果物Identityとprotocol revision、TypeScript decoderおよびRepository内fixtureを同時更新する。supported production active generationは0で、端末state変換はない）
- 関連正本: [`19_Maintenance.md`](../../19_Maintenance.md#33-internal-typescript-runtime)、[`CHG-000021`](CHG-000021_Protected_Active_Pointer.md)、[`CHG-000026`](CHG-000026_Provider_Home_Protection_Foundation.md)、[`CHG-000029`](CHG-000029_Provider_Home_Mount_Grant_Lifecycle_Foundation.md)、[`CHG-000031`](CHG-000031_Runtime_Owned_Operation_Context_Capability.md)、[`Coordinator README`](../../tools/coordinator/README.md)、[`脅威モデル`](../../tools/coordinator/threat-model.md)、[`実装残件台帳`](../../99_Roadmap/01_Product_Roadmap.md)

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

基準Node.js `v24.19.0`で`npm.cmd run check`はPassし、`npm.cmd test`の全contract testは412／412だった。Rust `1.94.1-x86_64-pc-windows-msvc`では`cargo fmt --manifest-path ../platform-access/Cargo.toml --check`、`cargo clippy --manifest-path ../platform-access/Cargo.toml --locked --target x86_64-pc-windows-msvc -- -D warnings`、locked test 9／9およびlocked release buildがPassした。Rust coverageは`npm.cmd run platform-access:coverage`が一時targetへ`-C instrument-coverage`でunit／CLIを逐次実行し、固定toolchainの`llvm-profdata`／`llvm-cov export`でsourceを集約する。全体はregions `1179/1305`（90.34%、不足126）、functions `47/48`（97.92%、不足1）、lines `752/821`（91.60%、不足69）だった。branch mappingは固定stable toolchainでは利用不能であり、branch `0/0`は対象外（N/A）であって100%ではない。

変更Rust source別では、`src/main.rs`がregions `16/27`（59.26%、不足11）、functions `1/2`（50.00%、不足1）、lines `10/27`（37.04%、不足17）、`src/protocol.rs`がregions `484/510`（94.90%、不足26）、functions `22/22`（100.00%、不足0）、lines `268/275`（97.45%、不足7）、`src/windows.rs`がregions `461/550`（83.82%、不足89）、functions `19/19`（100.00%、不足0）、lines `362/407`（88.94%、不足45）だった。各sourceのbranchは同じくN/Aである。

TypeScript coverageは`npm.cmd run platform-access:ts-coverage`がNode.jsの`--experimental-test-coverage`を逐次・単一processで実行し、LCOVをexact 19 source／18 testへ限定して集約する。全体はlines `6406/7198`（89.00%、不足792）、functions `232/251`（92.43%、不足19）、branches `991/1231`（80.50%、不足240）だった。変更source `platform-access-adapter.ts`はlines `244/248`（98.39%、不足4）、functions `12/12`（100.00%、不足0）、branches `38/42`（90.48%、不足4）、`platform-access-release.ts`はlines `268/286`（93.71%、不足18）、functions `11/11`（100.00%、不足0）、branches `31/41`（75.61%、不足10）である。compact JSON UTF-8＋末尾LFは140,355 byte、SHA-256 `41515f363539ddc8dc83b6870df757fc9436d90ae334deb39f2c019e485bf57c`が是正後4回連続で一致した。目標は100%だが、対象外や未到達を100%へ換算せず、未到達を次の義務として保持する。

- `platform-access-adapter.ts`: `79/B8/0`、`98/B14/0`、`116/B18/0`、`195/B37/0`。入力正規化の全failure形を同一runで到達していない。riskはwire不正値の誤受理、代替確認はrevision／nonce／role／全bit／主体Hash／Proxy負例、OwnerはQual-Lab、人間判断は不要、wire protocolまたはproduction process再導入時に再確認する。
- `platform-access-release.ts`: `55/B2/0`、`88/B8/0`、`115/B11/0`、`120/B12/0`、`147/B15/0`、`153/B17/0`、`163/B21/0`、`178/B27/0`、`243/B32/0`、`253/B34/0`。成果物観測の全OS例外とIdentity failureを同一runで到達していない。riskはRelease artifact差替えの検出漏れ、代替確認は同一handle観測／同長上書き／短縮／追記／Root差試験、OwnerはQual-Lab、人間判断は不要、Release artifactまたはFilesystem API変更時に再確認する。

正式値固定前の反復確認で、既存package directory race fixtureがDirectory metadata変化を先に検出するrunと最終inventory差を検出するrunに分かれ、同じblocked結果でもV8 branch母集団が`991/1231`と`992/1232`の間で揺れることを検出した。fixtureはproductionの判定順を変えず、変更対象child Directoryの`lstat`だけを変更前metadataへ固定し、追加／削除／型変更を最終inventory差で必ず検出するよう是正した。是正後は上記byte長、SHA-256および全coverage値が4回連続で一致した。旧runの一致を現在の反復安定性へ流用しない。

Rust未到達は非Windows main、I/O failure、Windows API failure、rare token query／membership failureおよび一部Root access failureである。TypeScript未到達はBuffer intrinsic failure、内部copy failure、response read防御分岐およびproduction invocation固定blocked分岐を含む。残存riskは、Windows token分類の特殊組合せまたはAPI failureを粗いblockedへまとめること、後続binderが観測候補を十分条件として誤用することである。誤用すると将来は別主体のProvider session／Credentialへ触れる恐れがあるが、現在はproduction invocation、binding、Authority、CapabilityおよびEffectがfalseなので、現在の利用者影響は安全側の拒否と手動作業の遅延に限定される。代替確認は固定bit全数、unknown／欠落bit、現在Windows processのRust integration、旧wire拒否、production起動前blockedおよび全利用側のrevision同期である。OwnerはQual-Labとし、token／session Policy、bootstrap process、binder、active reader、Verified ImageまたはProvider Home Effectを実装する変更で再確認する。100%達成、binder成立、Gate、Stable、ReleaseまたはClaude安全実行は主張しない。

Checker packageのcheckはPass、contract testは151／151だった。Repository全体checkerは543 files、347 Markdown、2,005 local links、578 anchorsを確認し、Error 0／Warning 0だった。実Provider、Docker、OAuth、Network、Provider Home保護、mountまたは課金Effectは発火していない。完成候補commitとtreeを固定して必須監査集合へ渡し、旧CHGの合否を流用しない。

## 初回監査指摘と是正

初回固定版へのAgent／Architecture／Security Reviewは`AAS-CHG32-001`（Medium）として、8主体bitの一対一写像と旧revision直接拒否の証拠不足を指摘した。Document Auditは`DOC32-COVERAGE-001`（Major）としてcommand、母集団、source別割合／不足、未到達branch Identityと義務の不足、`DOC32-THREAT-PROPAGATION-002`（Minor）としてProvisioning実装境界に残るTokenUser-only表現を指摘した。Gap／Impact＋Conformance Auditは`GCI-032-001`（Major）として、契約母集団と利用側母集団における旧revision拒否の直接証拠不足によりPL-08／PL-16／AD-02を非適合とした。

全監査結果を受領後、編集前に統合是正案を各監査へ再提示し整合を確認した。Rust request契約とCLI利用側へexact `CRDDPA02`／revision 2拒否およびrevision 3 blocked responseを追加した。TypeScript decoderへexact 82-byte `CRDDPR02`／revision 2、magic-only、revision-only、unknown主体bit、primary欠落を含む全parser-negative共通assertを追加し、privacy／来歴／binding／Authority／Capability／Effectの全安全fieldと結果key集合の非昇格を固定した。primary-onlyとprimary＋各非primary bitの8 caseで一対一写像を確認した。release／Trust利用側ではrevision 2 payloadのcanonical byteを正常署名し、暗号検証成功を独立確認したうえでprotocol不一致だけを含む入力がblockedになることを確認した。脅威モデルの残存表現と本節のcoverage証拠を更新した。初回Failや旧coverage runを是正後の合否へ流用せず、新固定版で全確認と独立再監査を行う。

## 最終独立再監査

固定commit `0a1131f850286c376574bd65141c933bb5b69ba8`／tree `eb59bd4c990c3db99e331c8a2dc368af13bd4ce1`へ、旧合否を流用せず必須監査集合を再実行した。Agent／Architecture／Security ReviewはPass（Finding 0）、Document AuditはPass（Finding 0）、Gap／Impact AuditおよびConformance AuditはPass／Eligible（Finding 0）だった。`AAS-CHG32-001`、`DOC32-COVERAGE-001`、`DOC32-THREAT-PROPAGATION-002`、`GCI-032-001`および`GCI-032-001-R1`はすべてResolved、新規候補は4分類とも0と判定された。

最終固定前の再監査では、unknown主体bit負例が`0x100`でprimary欠落を同時に含み、unknown bit拒否を独立証明していない残存を検出した。productionを変えずfixtureを`0x101`へ限定修正し、primary保持＋unknown bitと、別fixtureのprimary欠落`0x82`を分離した。共通の完全blocked assertにより結果key集合、privacy、来歴、binding、helper、Authority、CapabilityおよびEffectの全安全field非昇格を確認し、新固定版で全監査をやり直した。

確認済み範囲はRust revision 3 request／response、Windows現在process主体観測、TypeScript exact decoder、Release成果物／manifest／Trust／Package Gate、旧revision 2のrequest／response／正しく署名されたmanifest拒否、8分類の一対一写像、変更試験、CHG／README／脅威モデル／実装残件台帳およびcoverage義務である。source、call site、変更契約、直接利用側および文書は全数走査し、サンプリングしていない。特殊Windows token／API failureの実機行列、protected active／Verified Image、production helper起動、bootstrap、binder、Provider Home Effect、実Provider／OAuth／Network／課金は未評価または未実装のまま保持する。

独立再監査後の変更は、本節への監査結果記録だけに限定する。実装、試験、README、脅威モデル、coverage値、公開形式、永続形式および実装残件台帳は変更しない。記録後の新固定版ではRepository全体checkerを再実行し、この限定差分を独立確認へ戻す。

## 未完了事項と人間判断

`FU-018-PROVIDER-HOME`は`In Progress`のまま維持する。公式署名済みReleaseから明示`provision`時だけ許すpre-active one-shotは人間により承認され、後続[`CHG-000033`](CHG-000033_Pre_Active_Provisioning_One_Shot_Contract.md)へ移した。固定manifest／artifact／process境界、別資格情報昇格、失敗回復および通常Runtime非発火を同CHGで固定してから実装する。

現在の実装範囲に追加の人間判断は不要である。後続CHG33の採用、保護対象変更の統合、準拠表明、Gate open、StableまたはReleaseは人間の決定権限へ残す。
