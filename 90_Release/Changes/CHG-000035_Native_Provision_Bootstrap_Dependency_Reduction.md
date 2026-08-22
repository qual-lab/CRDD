# 変更トレース: ネイティブ準備入口の依存縮退（Native Provision Bootstrap Dependency Reduction）

- 変更ID: `CHG-000035`
- 状態: `In Review`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-23
- 対象: Windows native `coordinator.exe provision`の有効化前固定blocked入口と配布Identity
- 対象version: v0.18.0 Candidate
- 変更分類: `breaking`
- 移行要否: `migration_required: true`（native entrypoint contract revision 1→2。manifest revision 2、V2署名domain、native result contract revision 1、one-shot revision 2、Effect revision 3、Runtime Activation revision 3およびdoctor version 8は維持する。旧entrypoint revision 1を署名済みmanifestごと拒否し、aliasまたはfallbackを設けない。発行済みproduction manifest、installed state、観測、Authority、CapabilityおよびEffectは0なので永続変換なし）
- 関連正本: [`19_Maintenance.md`](../../19_Maintenance.md#33-internal-typescript-runtime)、[`CHG-000034`](CHG-000034_Native_Direct_Provision_Supervisor_Entrypoint.md)、[`Coordinator README`](../../tools/coordinator/README.md)、[`脅威モデル`](../../tools/coordinator/threat-model.md)、[`実装残件台帳`](../../99_Roadmap/08_CRDD_v0_18_Implementation_Follow_Up_Registry.md)

## 結論と変更経路

CHG-000034の固定blocked入口を、Rust標準Runtimeとその広いimport面を持たない`no_std`／`no_main`のrelease専用bootstrapへ縮退する。raw command lineのexact `provision`だけを許し、その他を固定arguments-invalid結果へ閉じる。結果byte、終了2、stderr空、worker spawn 0および結果byte内の全Effect／Authority／Capability falseは維持する。これは固定結果の報告値であり、実processのNetwork非発火を観測した値ではない。

通常Runtime、source checkout、PATH、Cargo、Shell、installerまたは別binaryへのfallbackは追加しない。既存subscription OAuthだけ、選択ローカル対話ユーザー1名だけという後続境界も変更しない。外部公開、受け手、訴求または市場行動を変更しないためCommunication／Discoveryは非該当である。

## 実装範囲

- `coordinator` binaryをfeature付きrelease buildだけへ限定し、固定entrypoint、panic abort、4つの`KERNEL32.dll` APIだけでraw command line読取り、stdout書込みおよび終了を行う。
- 引数判定と固定結果選択を副作用のないRust Coreへ分離し、発火、非発火、引用符、余分tokenおよび空入力を試験する。
- caller環境の大小文字を正規化し、Rust／Cargo compiler、flag、wrapper、target、profile、registry、source、network、HTTPおよびalias override母集団を拒否する。固定toolchain内のCargo／rustc実体、`--frozen`、target、feature、link argv、Cargo homeおよびbuild cwdからfilesystem rootまでのCargo config不在を確認し、空白を含む別clean targetへ2回buildしてbyte長とSHA-256の完全一致を要求する。同じ成果物の実行前後file Identity／Hashを照合し、exact `provision`と5つのinvalid CLIを直接実行する。
- このbuild確認は記録したlocal Cargo cacheとMSVC環境を含む同じbuild環境内の観測的一致である。既存registry source cacheの供給元真正性とMSVC linker Identityは未検証であり、外部override全排除またはRelease供給網の成立を主張しない。OwnerはQual-Lab、現在の影響は限定implementation候補だけでRelease不可、Release署名、配布artifact採用、toolchain／cache／dependency変更時に再評価し、人間が承認した供給元、Identityおよび再現根拠がそろうまで解除しない。
- 副作用のないPE parserを正負fixtureで検査し、native artifact observerが開いた同一fdから所有snapshot化した最大16 MiBのbyteへ適用する。同じsnapshotからPE判定とSHA-256を一回投影し、policy不一致はRelease staging sessionおよびmanifest配置Effectより前に拒否する。
- native artifactの`entrypointContractRevision`を2へ上げ、Trust Core、package filesystem／gate、release stagingおよび全exact fixtureを同時移行する。manifest Schema revisionと署名domainは変更しない。

## 発火・非発火・境界・情報不足

- 発火例: 実行file名tokenの後が空白またはtabで区切られたunquoted exact `provision`だけの場合、Release binding未実装の固定blocked結果を返す。
- 非発火例: `doctor`、quoted `"provision"`、大文字差、余分token、option、空argument、NULより後を除く不正raw command lineはarguments-invalidへ閉じ、観測またはEffectを発火しない。
- 境界例: 実行file名tokenはWindowsが渡すraw command line上の外側引用を許すが、command token自体の引用、escapeまたはaliasは許さない。
- 判定情報不足例: PE header、section、RVA、import descriptor、文字列またはCLI byteを上限内で一意に解析できなければ検査を失敗させ、配布候補へ使わない。

## 固定PE条件と非主張

検査する条件は16 MiB以下、section 1～32件、x86-64 PE32+、optional header 240 byte、data directory exact 16件、Windows console subsystem、実行可能な一意section内entrypoint、`DYNAMIC_BASE`、`NX_COMPAT`、import exact `KERNEL32.dll` 1件と`GetCommandLineW`、`GetStdHandle`、`WriteFile`、`ExitProcess` exact 4件、delay import／TLS directory／bound import／CLR runtime header 0である。section table／raw／virtual範囲、加算上限、全section間のraw／virtual非重複、RVAの一意な単一section写像、import directory 20～180 byte、descriptor最大8件、`OriginalFirstThunk`と`FirstThunk`の両方非0・同一内容、thunk最大64件、library名64 byte以下、function名256 byte以下、raw 7-bit ASCII、宣言directory内zero terminatorと以後zero paddingを要求する。ordinal、high-bit ASCII alias、未知／重複DLL、未知function、範囲外／曖昧RVAまたは非終端／過大文字列は失敗にする。

`no_std`、source上のAPI不使用またはstatic PE条件だけでは、検証済み実行イメージ（Verified Image）、実行時loaded module集合、DLL探索閉包、DLL side-loading不存在、Network非発火、leaf／全parent handle、local volume、初期Trust、token／Root観測、binder、Protection、active、Provider HomeまたはClaude安全実行を証明しない。PE parserは開発時検証であり、Runtime AuthorityまたはCapabilityを発行しない。

## 契約母集団と利用側

契約母集団はnative source、raw argv grammar、固定result、release build profile、feature、link入口、PE static allowlist、native artifact entrypoint revisionおよびmanifest V2の当該fieldである。利用側はCargo、release build package script、PE検査script、Rust Core／CLI試験、Rust coverage、native artifact観測、Trust Core、package filesystem／gate、release staging、Checker package inventory、README、脅威モデルおよび実装残件台帳である。

変更禁止範囲はmanifest revision 2とV2署名domain、native result contract revision 1のbyte、worker成果物PA03／PR03、one-shot／Effect／Runtime Activation／doctorのrevision、worker spawn上限0、通常Runtime非発火、全Effect／Authority／Capability false、OAuth／課金境界、local interactive user限定および未実装軸の非昇格である。

## 検証義務と現在状態

固定候補ではNode.js 24.12以上のexact実体を固定し、TypeScript typecheck、Biome warning拒否／format、Coordinator全contract test、Rust format、workerとrelease-only native binaryを分けたClippy warning拒否、frozen test、feature付きfrozen release build、Rust／TypeScript coverage、PE static検査、同一成果物のexact `provision`／引数なし／`doctor`／quoted command／余分token／大文字差CLI、Checker packageおよびRepository全体checkerを別軸で確認する。PE検査は独立したbounded parserで行い、LLVM表示toolの存在を合否条件にしない。検証runner自身はCargo／CLI childのProcess Effectとbuild／cleanupのFilesystem Effectを発行し、`--frozen`でdependency Networkを禁止する。固定resultが報告する全Effect false、static PE上の直接Network import 0および実processのNetwork Effect `not_verified`を別軸に記録する。

現在、固定blocked bootstrapとPE static allowlistだけを実装した。次段は同一runのloaded image、leafと全rename可能parent handle、local volume、実行時module／DLL探索閉包およびNetwork非発火である。そこまで成立する前にtoken／Root観測へ進めず、operational one-shot、Gate、準拠表明、StableまたはReleaseを主張しない。

現行実装固定Commit `f678428cc2b1e96756fb1df356dcd86e65510339`の検証結果は[`固定後検証実行記録`](Evidence/CHG-000035_Verification_Run_Record_f678428.md)へ記録した。独立確認後の現在状態は[`現行レビュー記録`](Evidence/CHG-000035_Current_Review_Record_7da5b6c.md)が所有する。旧`1d7bac2`記録はNode.js基準不適合のため`Superseded`とし、合否根拠へ流用しない。本参照追加は固定実装Treeへ自己参照させない記録限定差分である。

初回固定版へRepository全体checkerを一度実行し、Agent／Architecture／Security Review、Document Audit、Gap／Impact AuditおよびConformance Auditを旧合否不流用で実行する。Findingがあれば監査集合を完了して統合方針を各監査へ再提示した後だけ是正し、新固定版へ全必須監査を再実行する。

## 未完了事項と人間判断

`FU-018-PROVIDER-HOME`は`In Progress`を維持する。現在、承認済みbootstrap依存縮退の実装に追加の人間判断は不要である。保護対象の採用・統合、残存risk受容、Gate open、準拠表明、StableまたはReleaseは人間の決定権限へ残す。
