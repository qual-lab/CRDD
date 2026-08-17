# 変更トレース: 保護済み有効ポインター（Protected Active Pointer）とWindows production接続

- 変更ID: `CHG-000021`
- 状態: `Verified`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-18
- 対象: CRDD公式Repositoryの内部Coordinator、Windows provision経路およびRust製プラットフォームアクセス部
- 対象version: v0.18.0 Candidate
- 変更分類: `breaking`
- 移行要否: `migration_required: true`（CRDD公式Repositoryのv0.18 Windows machine stateとRelease工程だけ。採用Repositoryと公開Checkerは対象外）
- 関連正本: [`19_Maintenance.md`](../../19_Maintenance.md#33-internal-typescript-runtime)、[`CHG-000020`](CHG-000020_Platform_Access_Release_Binding.md)、[`tools/coordinator/README.md`](../../tools/coordinator/README.md)、[`tools/coordinator/threat-model.md`](../../tools/coordinator/threat-model.md)

## 人間判断とbootstrap境界

Windows v1は、管理者が配布元または別の経路で真正性を確認した未改変の公式署名済みCRDD Releaseを選択し、そのRelease内の固定`coordinator provision`入口を明示実行することを初期Trust境界とする。実行中codeが自身のmanifest署名を検証した事実だけから、自身の正当性を証明したとは扱わない。初回実行前の改変、同じ管理者、OSまたはkernelの侵害はv1の保証対象外であり、通常RuntimeのProtection成立へ混在させない。

専用installerおよびOS native code signingはv1の必須条件にしない。OwnerはQual-Labとし、配布経路の変更、非技術利用者向けinstaller、企業端末の実行Policy、bootstrap改変incidentまたはWindows publisher enforcement要求が発生した場合に再評価する。

Windows v1で許可するRuntime主体は、明示provisionで選択したローカル対話ユーザー（`local_interactive_selected_user`）1名だけに限定する。現在実装したRust native境界は現在process tokenの`TokenUser`からSIDのdomain-separated Hashを観測する非Authority候補だけで、選択userとの一致を確認するbinderは未実装である。管理者昇格は同じuserのtokenであることを将来binderの成立条件とし、別資格情報による昇格など選択userとの一致を決定論的に確認できない場合は処置前に`blocked`とする。elevated tokenのgroup、caller指定SIDまたは外部claimをRuntime主体へ昇格させない。有効ポインターには将来binderが確認したmodeとSID Hashだけを結合し、raw SIDは外部結果、Evidenceまたは文書へ出力しない。`server_dedicated_service_account`は将来候補に限り、v1では未実装かつ`blocked`とし、service accountの作成、資格情報、更新およびLifecycleを今回の範囲へ含めない。

一般のProvisioning Record Schemaが両modeを将来候補として表現できることは、Windows v1の現在対応または選択済みmodeを意味しない。Runtime activationと`doctor`は、許可方針の`local_interactive_selected_user`と将来blocked候補の`server_dedicated_service_account`を別fieldへ投影し、binder未実装中はmodeを一件も発行しない。Root observationの`selected_local_user_binding_caller_claim`は構造候補を作る非Authority入力に限り、`selectedUserBindingVerified: false`および`runtimePrincipalBound: false`を維持する。将来binderはcaller claimと異なる検証済み成果物型を所有しなければならない。

Windows予約DOS basenameの比較は、予約名比較用の限定大文字写像（Reserved-name Limited Uppercase Mapping）をRepository正本として使う。処理順は、最初の`.`より前のbasename候補取得、basename末尾のASCII `.`／space除去、Unicode code point単位の限定写像、ASCII予約名集合とのexact比較である。locale、言語組込みのuppercase／case-fold、NFC／NFKC、一般Unicode正規化または再帰的変換を使用しない。TypeScript入力はwell-formed Unicode scalar列だけを受理し、孤立UTF-16 surrogateを拒否する。元入力のUTF-8 byte長4096上限、一般Unicode Pathの許容、および実Filesystem上のcase／Unicode aliasを未確認とする境界は変更しない。

| 入力code point | 比較用出力 |
|---|---|
| ASCII `a`–`z` | ASCII `A`–`Z` |
| U+00DF `ß` | `SS` |
| U+0131 `ı` | `I` |
| U+017F `ſ` | `S` |
| U+212A `K` | `K` |
| U+FB00 `ﬀ` | `FF` |
| U+FB01 `ﬁ` | `FI` |
| U+FB02 `ﬂ` | `FL` |
| U+FB03 `ﬃ` | `FFI` |
| U+FB04 `ﬄ` | `FFL` |
| U+FB05 `ﬅ` | `ST` |
| U+FB06 `ﬆ` | `ST` |

表にないcode pointは変換しない。写像後のbasenameが予約名集合へexact一致する場合だけ追加拒否し、非ASCII Pathを一律拒否しない。TypeScript pure validator、install layout利用側およびRust protocol parserはこの表の全entryと同じ正負fixtureを検査し、表、予約集合または処理順の変更時に両言語を再確認する。

## 最小更新モデル

利用者向けの世代管理機能は作らない。内部更新境界は次の二状態だけを所有する。

- `staging`: 次に切り替える候補exact 1件。衝突と同名置換を防ぐ内部opaque IDおよびWindows Root Identityを持つ。
- `active`: atomic pointerが参照する現在確認済みexact 1件。

過去版一覧、任意版選択、複数active、自動rollback、旧Schema fallback、compatibility aliasまたはshimを設けない。切替後の旧activeは非選択のimmutable orphanとして保持できるが、切替処理から削除しない。削除はone-shot cleanup token、旧Root Identityおよび旧pointer Hashを再確認する別の明示操作だけが行い、曖昧な対象は保持して`blocked`とする。

## 安全な処理順

1. 固定公開鍵で署名された公式Releaseのmanifest、全package fileおよびRust artifactをnon-link handleで開き、同じhandleでIdentity、size、Hashおよび署名を確認する。
2. 検証済みsource handleのbyteだけを、同一volume上の新規exclusive stagingへ流す。検証後にsource Pathを再openしない。
3. 全fileとDirectoryのdurability、inventory closure、non-link／non-reparse、Root／parent／staging Identity、owner／DACL／inheritance、writer排他、親Directoryの削除権およびRust image HashをWindows native境界で確認する。
4. 有効ポインターへopaque ID、Root Identity Hash、Protection Hash、将来binderが確認したRuntime主体mode／Identity Hash、Release Identity、package content Root、Rust image Identity／Hash、期待previous active Hashをcanonicalに結合する。
5. 期待current pointerを再読し、exclusive temporary pointer write／flush、native atomic replace、parent durabilityおよび再読確認が完了した場合だけactiveを切り替える。
6. 通常Runtimeはpointerが示すactiveだけを再検証し、staging、orphanまたはDirectory探索から候補を選ばない。
7. Rust native境界がVerified Image handleをwrite／delete非共有で保持し、`CreateProcessW`、Job Object、固定protocolおよびRoot observationを一つのone-shot接続として実行する。

Rust wire protocolはmagicを`CRDDPA02`／`CRDDPR02`、revisionを2へ破壊的に更新し、既存access bitに加えて現在tokenのuser SIDをdomain-separated SHA-256へ変換した32 byte Identityだけを返す。生SID、group、tokenまたはdescriptorは返さない。TypeScript Adapterはnonce、role、revision、固定長、reason、既知access bitおよび非zero主体Hashをexactに検証し、旧magic／revision 1を受け入れない。Adapterが示すのは`current_process_token_user`の観測だけで、選択済みRuntime modeを発行しない。この主体観測はcomponent候補であり、DACL適用、有効ポインター永続化またはproduction processの成立を単独では意味しない。

最初のFilesystem処置後に失敗した場合は`filesystemEffectIssued: true`と`recoveryRequired: true`を保持する。推測rollback、自動repair、自動retry、自動削除または旧activeへのfallbackを行わない。どの段階でもIdentity、durability、Protection、process tree終了またはprotocolを証明できなければ、その段階と下流を`blocked`とする。

## 変更禁止範囲と現在状態

- source checkout、開発build、PATH、Shell、Cargoまたはcaller指定Pathをproduction fallbackにしない。
- Nodeの事前／事後Path Hash、Rust binaryの自己申告またはcaller supplied claimだけをVerified Image、Protection、AuthorityまたはCapabilityへ昇格させない。
- raw Path、SID、ACL、署名値またはraw OS errorを公開結果へ含めない。
- 全段階の実装・試験・独立確認が完了するまで、production Adapter、active readerおよびProvision Effectは固定`blocked`を維持する。
- 既存12 blocker、6 current-run evidence、Gate `blocked`、Runtime Authority／Runtime Capability非発行を維持し、第13 blockerを追加しない。
- v0.18.0は`Candidate`、Released Baselineはv0.17.0とし、採用、統合、準拠表明、Stable化またはReleaseを先取りしない。

## 現在の実装範囲

本固定前候補は、旧release floor／active release／state transactionのsourceと試験を削除し、次のcomponent候補へ置換した。

- 有効ポインターrevision 1のexact canonical codec、Hash、任意の正の初回`releaseSequence`または直前Hashと厳密増加Sequenceからの単調遷移
- `state/active-pointer.json`のnon-link同一file安定読取り候補
- `images/`、`staging/`、`state/active-pointer.json`だけを返す最小layout候補
- Rust wire revision 2による現在process `TokenUser`のdomain-separated Identity Hash観測
- TypeScript Adapter、Root observationおよびRuntime activationにおけるlocal-user-only方針とcurrent-process観測sourceの分離（selected mode非発行）

native durable atomic pointer store、staging copy、DACL適用と再確認、選択userと現在tokenの実結合、保護済みactive reader、検証済み実行イメージ、上限付きprocessおよびRoot観測の完全写像は未実装である。したがって有効ポインターStoreの永続化入口、Runtime reader、Platform Provisioner Effectおよびproduction Adapterは固定`blocked`のままであり、Filesystem状態、AuthorityまたはCapabilityを変更しない。

## 移行と復旧

旧active／floor／transaction Schemaを新しい有効ポインターへ読み替えるfallbackは設けない。v0.18 Candidateの既存machine stateは破棄して、公式署名済みReleaseから明示provisionをやり直す。旧candidate stateをv0.17 Runtimeまたは新Runtimeが推測消費しない。

新経路を成立させられない場合はproduction入口を`blocked`のまま維持し、公開Releaseはv0.17.0 Released Baselineへ戻す。採用Repository、公開Checker、一般利用者向けSchemaおよび公開CLIには移行を要求しない。

## 検証と監査

発火例は、管理者が公式署名済みReleaseから新規stagingを作り、全検証後にpointerを一度だけ切り替える場合である。非発火例は通常run、`doctor`またはsource checkoutである。同一`releaseSequence`の候補はIdentityが同じか異なるかにかかわらず厳密増加違反として`blocked`となる。旧activeの残存または切替後のcleanup保留はinactive immutable orphanとして保持できるが、有効ポインターの選択対象にせず、Directory探索、自動fallbackまたはrollbackを行わない。判定情報不足例はdurability、DACL、parent delete、full tree、image Identityまたはprocess treeを確認できない場合で、正式結果は`blocked`である。

TypeScriptとRustのunit／contract／integration試験、source別branch coverageと未到達処置、Rust format／Clippy／locked release build、全体Checkerを取得する。固定改訂版へAgent／Architecture／Security Review、Document Audit、Gap／Impact AuditおよびConformance Auditを旧合否不流用で実行する。実管理者provision、本番秘密鍵、実Release handoffまたは別Windows環境を使わない範囲は`Not Verified`としてrisk、Ownerおよび再確認契機を保持し、機械試験件数をRelease根拠へ流用しない。

編集後の自己確認では、Coordinator 338/338、Checker 151/151、TypeScript typecheck／Biome lint・format、Rust unit／integration 7/7、`cargo fmt --check`、Clippy warning 0、locked release buildおよび命名closureが合格した。TypeScript coverageの固定母集団は17 source／16 testで、line 5921/6705、function 210/228、branch 932/1165である。未到達233 branchは、本変更の合格率またはSecurity成立へ換算しない。OwnerはQual-Labとし、native durable store、DACL Effect、Verified Imageまたはproduction processを実装する変更で、該当source別の正負／境界試験、残存risk、代替確認、人間判断要否および再確認条件へ接続する。Rust branchはstable toolchainで引き続き取得不能なため`Not Available`であり、0/0を100%へ換算しない。

この状態は`Applied`かつ`Self-checked`であり、独立監査前の`Resolved`、採用、統合またはReleaseを意味しない。

## 固定版`af37c8c`の独立監査

固定対象はCommit `af37c8cff0e011e293ff25d2910960f4be8df207`、Tree `87b42eb3b9cb8ea8d08b76fc743a654ae12c6537`、Parent `a7f1493299cfe77d2a39bece4da1eef833f6a0fa`である。共通入力はCoordinator 338/338、Checker 151/151、TypeScript coverage 17 source／16 test、Rust 7/7、両private package check、Rust format／Clippy／locked release build、全体Checker Error 0／Warning 0、cleanだった。

- Agent／Architecture／Security Review: `Fail`。`ASR-21-001` Majorは`releaseSequence`を端末の連番へ誤変換、`ASR-21-002` Majorは削除済みfloor／active／transactionとorphanに矛盾するlayout表現の残存、`ASR-21-003` Majorは現在process `TokenUser`を選択済みlocal userへ早期昇格、`ASR-21-004` MediumはTypeScript側Windows Path字句検査の不足、`ASR-21-005` Majorは品質義務母集団と未到達処置の不足だった。001、002、003、005は今回変更で新規発生、004は初回から存在し見落としていた。
- Document Audit: `Fail`。`DOC-AP-001` Majorはlocal-user-only方針とservice account現在形の伝播競合、`DOC-AP-002` Minorは有効ポインターのlocale-first初出不足で、いずれも今回変更で新規発生した。
- Gap／Impact Audit: `Fail`。`GCI-21-001` Majorは旧machine state利用側の移行漏れ、`GCI-21-002` MajorはRelease Sequenceの連番化、`GCI-21-003` Majorは品質義務母集団と未到達処置の不足だった。CHG21範囲の初回独立監査であるため再監査4分類は非適用であり、3件はCHG21変更で導入または露呈したFindingとして保持する。
- Conformance Audit: `Fail`。C-04／C-07、PL-08およびPL-16がNon-conformant、準拠claimは`Not Eligible`だった。

この監査集合は全体として`Invalidated`であり、現在判定へ流用しない。処置は、任意の正の初回Sequenceと厳密増加更新、旧state語彙の有効ポインターmodelへの置換、現在token観測と将来selected-user binderの分離、Windows/POSIX字句validatorの分離、利用側を含むcoverage母集団および文書のlocal-user-only／locale-first同期へ反映した。各Findingは`Applied`／`Self-checked`であり、新固定版の同一監査集合が全て完了するまで`Resolved`ではない。

## 固定版`78a58b2`の独立再監査

固定対象はCommit `78a58b21503025675edff6f80d1667660380871b`、Tree `02013823d4c037a83619df63f819df18137196da`、Parent `af37c8cff0e011e293ff25d2910960f4be8df207`である。共通入力はCoordinator 341/341、Checker 151/151、TypeScript coverage 19 source／18 test、Rust 7/7、両private package check、Rust format／Clippy／locked release build、全体Checker Error 0／Warning 0、cleanだった。

- Agent／Architecture／Security Review: `Fail`。既知`ASR-21-003` Majorは、Runtime activation／doctorの無状態な主体mode列挙と、caller入力を検証済み候補と呼ぶRoot観測literalにより部分未解消だった。前者は初回から存在し見落としていた箇所、後者は今回の修正で新規発生した箇所である。`ASR-21-R1-001` Mediumは、品質記録がcompact JSON byteのHashを主張する一方、実CLIがpretty JSONを出力する不一致で、今回の修正により新規発生した。
- Document Audit: `Fail`。`DOC-AP-R01` Majorはtarget policy、現在の非Authority観測、将来binderおよびproduction blockedの伝播漏れで、今回の修正により新規発生した。`DOC-AP-R02` Minorは同一Sequence拒否とinactive orphan保持を同じ境界文へ束ねた曖昧さで、初回監査時から存在したが見落としていた。
- Gap／Impact Audit: `Fail`。`GCI-21-R2-001` Majorは、予約済みDOS device basenameの末尾spaceを拡張子判定前に除くTypeScriptと除かないRustの字句subset不一致で、初回監査時から存在したが見落としていた。
- Conformance Audit: `Fail`。C-07およびPL-16がNon-conformantで、準拠claimは`Not Eligible`だった。

この監査集合は全体として`Invalidated`であり、現在判定へ流用しない。処置は、許可方針と将来候補を分けた主体mode投影、caller claimの非Authority化とbinder未成立の機械投影、CLIと試験が共用するcompact JSON＋末尾LF serializer、同一Sequence拒否とinactive orphan保持の分離、およびTypeScript／Rustの予約済みbasename境界同期へ反映した。各Findingは`Applied`／`Self-checked`であり、新固定版の同一監査集合が全て完了するまで`Resolved`ではない。

## 固定版`10d2f37`の独立再監査

固定対象はCommit `10d2f377874e327e536f31c219a5077098fdc899`、Tree `69af42b57b2bc282c8e344a41fd5b40b436f2071`、Parent `78a58b21503025675edff6f80d1667660380871b`である。共通入力はCoordinator 342/342、Checker 151/151、TypeScript coverage 19 source／18 test、Rust 7/7、両private package check、Rust format／Clippy／locked release build、全体Checker Error 0／Warning 0、cleanだった。

- Agent／Architecture／Security Review: `Pass`、Finding 0。
- Document Audit: `Pass`、Finding 0。
- Gap／Impact Audit: `Fail`。`GCI-21-R3-001` Majorは、TypeScriptのUnicode-aware regexとRustのUnicode full uppercaseで予約済みDOS basenameのcase正規化が一致せず、dotless i等を含む入力の判定が分岐した。初回監査時から存在したが見落としていた候補である。
- Conformance Audit: `Fail`。C-07およびPL-16がNon-conformantで、準拠claimは`Not Eligible`だった。

この監査集合は全体として`Invalidated`であり、現在判定へ流用しない。`GCI-21-R3-001`の処置は、言語組込みのcase変換を予約名判定経路から除き、上記の限定写像、well-formed Unicode scalar列、孤立surrogate拒否および両言語の全件表駆動試験へ反映した。処置は`Applied`／`Self-checked`であり、新固定版の同一監査集合が全て完了するまで`Resolved`ではない。

## 是正後の品質義務記録

Node 24.19.0、cwd `tools/coordinator`で`node ./scripts/check-platform-access-ts-coverage.ts`を連続2回実行し、exact 19 source／18 testのstdout byteが完全一致した。stdoutは`JSON.stringify(value)`によるcompact JSON UTF-8 byteと末尾LF exact 1件だけで、CRLF、pretty表示または進捗出力を含まない。parse後objectやtrim後文字列ではなく、このstdout全140332 byteへ計算したSHA-256は`3FC914BA901D29D026359A060FEB2A46838E2158791D0DB3EBD0C3B80CA0CC7C`、合計はline 6279/7071、function 225/244、branch 964/1204である。未到達240 branchは出力の`uncoveredBranchObligations`で各`source:line:block:branch`へ`Not Verified`、理由、残存risk、代替確認、Owner、現在の人間判断要否および再確認条件を一対一に結合し、件数または割合をSecurity成立へ換算しない。

| source | line | function | branch | 未到達 |
|---|---:|---:|---:|---:|
| `scripts/check-platform-access-ts-coverage.ts` | 522/587 | 27/29 | 104/130 | 26 |
| `scripts/release-staging-manifest.ts` | 327/346 | 10/11 | 42/53 | 11 |
| `scripts/sign-release-manifest.ts` | 195/347 | 5/9 | 6/23 | 17 |
| `src/core/doctor.ts` | 637/682 | 24/25 | 115/173 | 58 |
| `src/security/authority-root-path-lexical.ts` | 110/116 | 7/8 | 31/32 | 1 |
| `src/security/platform-access-adapter.ts` | 210/214 | 11/11 | 34/38 | 4 |
| `src/security/platform-access-release.ts` | 268/286 | 11/11 | 31/41 | 10 |
| `src/security/platform-provisioner-manifest-loader.ts` | 171/183 | 5/5 | 39/47 | 8 |
| `src/security/platform-provisioner-active-pointer.ts` | 322/336 | 11/11 | 60/72 | 12 |
| `src/security/platform-provisioner-active-pointer-store.ts` | 139/147 | 6/6 | 24/32 | 8 |
| `src/security/platform-provisioner-effect.ts` | 49/49 | 3/3 | 4/4 | 0 |
| `src/security/platform-provisioner-install-layout.ts` | 139/139 | 5/5 | 15/15 | 0 |
| `src/security/platform-provisioner-package-filesystem.ts` | 480/678 | 17/21 | 62/91 | 29 |
| `src/security/platform-provisioner-release-identity.ts` | 355/385 | 15/15 | 47/68 | 21 |
| `src/security/platform-provisioner-trust-core.ts` | 494/527 | 16/16 | 118/130 | 12 |
| `src/security/platform-provisioner-windows-dacl.ts` | 146/148 | 5/5 | 48/49 | 1 |
| `src/security/root-observation.ts` | 228/230 | 7/7 | 44/45 | 1 |
| `src/security/runtime-activation-record.ts` | 1140/1148 | 24/25 | 81/91 | 10 |
| `src/security/runtime-root-path-identity.ts` | 347/523 | 16/21 | 59/70 | 11 |

Rust 1.94.1の固定`x86_64-pc-windows-msvc`対象は、`node ./scripts/check-platform-access-coverage.ts`で8/8を合格し、region 1035/1143、function 43/44、line 663/725だった。source別には`main.rs`が16/27・1/2・10/26、`protocol.rs`が458/485・21/21・255/263、`windows.rs`が384/454・16/16・301/339、`tests/cli.rs`が177/177・5/5・97/97である。stable toolchainはbranchを0/0しか生成しないため`Not Available`であり、100%へ換算しない。未到達FFI、実Windows DACL、selected-user binder、native durable store、Verified Imageおよびproduction processは`Not Verified`、Owner=Qual-Labとし、それぞれの実装またはRelease binding着手時に再確認する。

この品質記録は局所testまたはcoverage合格、検証義務の評価および現在品質状態を分離する。production Adapter、active reader、Provision Effect、Authority、Capability、12 blocker、6 current-run evidenceおよびGate `blocked`を変更せず、独立再監査前に`Verified`または`Resolved`へ昇格しない。

## 固定版`d88a4c5`の最終独立確認

固定対象はCommit `d88a4c56d6d2f2f0e2ab06d64e16ca808dce7b71`、Tree `31926d02ae27f230b54beeec9152c6cb4f55c8a6`、Parent `10d2f377874e327e536f31c219a5077098fdc899`である。共通入力はCoordinator 343/343、Checker 151/151、TypeScript coverage 19 source／18 test、Rust 8/8、両private package check、Rust format／Clippy／locked release build、全体Checker Error 0／Warning 0、cleanだった。

- Agent／Architecture／Security Review: `Pass`、Finding 0。
- Document Audit: `Pass`、Finding 0。
- Gap／Impact Audit: `Pass`、Finding 0。
- Conformance Audit: `Pass`、Finding 0。影響基準は`Conformant`である。準拠claimは、v0.18 Candidate、production bindingおよびGateが未成立で、Released Baselineがv0.17.0のため`Not Eligible`である。これは基準不適合を意味しない。

`GCI-21-R3-001`は、予約名比較用の限定大文字写像、well-formed Unicode scalar列、両言語の全件表駆動試験および同一変換順を新固定版で確認し、`Resolved`とした。既知`ASR-21-001`〜`005`、`DOC-AP-001`／`002`／`R01`／`R02`、`GCI-21-001`〜`003`、`GCI-21-R2-001`および同根Findingも、各受入条件を満たす現在状態へ接続した。新規候補4分類は、初回監査時から存在した見落とし0、今回修正起因0、今回修正で初めて確認可能0、承認済み対象範囲拡大0である。

`d88a4c5`より前の監査集合は固定履歴として保持するが、全て`Invalidated`で現在判定へ流用しない。現在の独立結果と機械入力は[`CHG-000021_Current_Review_Record_d88a4c5.md`](Evidence/CHG-000021_Current_Review_Record_d88a4c5.md)へ固定する。この`Verified`は変更候補の検証完了を表し、採用、統合、準拠主張、Stable化またはReleaseを意味しない。
