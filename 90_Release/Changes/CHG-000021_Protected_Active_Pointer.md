# 変更トレース: 保護済みactive pointerとWindows production接続

- 変更ID: `CHG-000021`
- 状態: `Ready for Verification`
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

v1のRuntime主体は、明示provisionで選択したローカル対話ユーザー（`local_interactive_selected_user`）1名だけに限定する。Rust native境界は現在process tokenの`TokenUser`からSIDを観測し、DACLへはそのuser SIDだけを使用する。管理者昇格は同じuserのtokenであることを要求し、別資格情報による昇格など選択userとの一致を決定論的に確認できない場合は処置前に`blocked`とする。elevated tokenのgroup、caller指定SIDまたは外部claimをRuntime主体へ昇格させない。active pointerにはmodeとSIDのdomain-separated Hashだけを結合し、raw SIDは外部結果、Evidenceまたは文書へ出力しない。`server_dedicated_service_account`はv1で未実装かつ`blocked`とし、service accountの作成、資格情報、更新およびLifecycleを今回の範囲へ含めない。

## 最小更新モデル

利用者向けの世代管理機能は作らない。内部更新境界は次の二状態だけを所有する。

- `staging`: 次に切り替える候補exact 1件。衝突と同名置換を防ぐ内部opaque IDおよびWindows Root Identityを持つ。
- `active`: atomic pointerが参照する現在確認済みexact 1件。

過去版一覧、任意版選択、複数active、自動rollback、旧Schema fallback、compatibility aliasまたはshimを設けない。切替後の旧activeは非選択のimmutable orphanとして保持できるが、切替処理から削除しない。削除はone-shot cleanup token、旧Root Identityおよび旧pointer Hashを再確認する別の明示操作だけが行い、曖昧な対象は保持して`blocked`とする。

## 安全な処理順

1. 固定公開鍵で署名された公式Releaseのmanifest、全package fileおよびRust artifactをnon-link handleで開き、同じhandleでIdentity、size、Hashおよび署名を確認する。
2. 検証済みsource handleのbyteだけを、同一volume上の新規exclusive stagingへ流す。検証後にsource Pathを再openしない。
3. 全fileとDirectoryのdurability、inventory closure、non-link／non-reparse、Root／parent／staging Identity、owner／DACL／inheritance、writer排他、親Directoryの削除権およびRust image HashをWindows native境界で確認する。
4. active pointerへopaque ID、Root Identity Hash、Protection Hash、Runtime主体mode／Identity Hash、Release Identity、package content Root、Rust image Identity／Hash、期待previous active Hashをcanonicalに結合する。
5. 期待current pointerを再読し、exclusive temporary pointer write／flush、native atomic replace、parent durabilityおよび再読確認が完了した場合だけactiveを切り替える。
6. 通常Runtimeはpointerが示すactiveだけを再検証し、staging、orphanまたはDirectory探索から候補を選ばない。
7. Rust native境界がVerified Image handleをwrite／delete非共有で保持し、`CreateProcessW`、Job Object、固定protocolおよびRoot observationを一つのone-shot接続として実行する。

Rust wire protocolはmagicを`CRDDPA02`／`CRDDPR02`、revisionを2へ破壊的に更新し、既存access bitに加えて現在tokenのuser SIDをdomain-separated SHA-256へ変換した32 byte Identityだけを返す。生SID、group、tokenまたはdescriptorは返さない。TypeScript Adapterはnonce、role、revision、固定長、reason、既知access bitおよび非zero主体Hashをexactに検証し、旧magic／revision 1を受け入れない。この主体観測はcomponent候補であり、DACL適用、active pointer永続化またはproduction processの成立を単独では意味しない。

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

- active pointer revision 1のexact canonical codec、Hash、初回または直前Hashからの単調遷移
- `state/active-pointer.json`のnon-link同一file安定読取り候補
- `images/`、`staging/`、`state/active-pointer.json`だけを返す最小layout候補
- Rust wire revision 2による現在process `TokenUser`のdomain-separated Identity Hash観測
- TypeScript Adapter、Root observationおよびRuntime activationのlocal-user-only投影

native durable atomic pointer store、staging copy、DACL適用と再確認、選択userと昇格tokenの実結合、保護済みactive reader、検証済み実行イメージ、上限付きprocessおよびRoot観測の完全写像は未実装である。したがってactive pointer storeの永続化入口、Runtime reader、Platform Provisioner Effectおよびproduction Adapterは固定`blocked`のままであり、Filesystem状態、AuthorityまたはCapabilityを変更しない。

## 移行と復旧

旧active／floor／transaction Schemaを新active pointerへ読み替えるfallbackは設けない。v0.18 Candidateの既存machine stateは破棄して、公式署名済みReleaseから明示provisionをやり直す。旧candidate stateをv0.17 Runtimeまたは新Runtimeが推測消費しない。

新経路を成立させられない場合はproduction入口を`blocked`のまま維持し、公開Releaseはv0.17.0 Released Baselineへ戻す。採用Repository、公開Checker、一般利用者向けSchemaおよび公開CLIには移行を要求しない。

## 検証と監査

発火例は、管理者が公式署名済みReleaseから新規stagingを作り、全検証後にpointerを一度だけ切り替える場合である。非発火例は通常run、`doctor`またはsource checkoutである。境界例は同一releaseSequenceでもIdentityが異なる、旧activeが残る、または切替後にcleanupを保留する場合で、いずれもDirectory探索や自動fallbackを行わない。判定情報不足例はdurability、DACL、parent delete、full tree、image Identityまたはprocess treeを確認できない場合で、正式結果は`blocked`である。

TypeScriptとRustのunit／contract／integration試験、source別branch coverageと未到達処置、Rust format／Clippy／locked release build、全体Checkerを取得する。固定改訂版へAgent／Architecture／Security Review、Document Audit、Gap／Impact AuditおよびConformance Auditを旧合否不流用で実行する。実管理者provision、本番秘密鍵、実Release handoffまたは別Windows環境を使わない範囲は`Not Verified`としてrisk、Ownerおよび再確認契機を保持し、機械試験件数をRelease根拠へ流用しない。

編集後の自己確認では、Coordinator 338/338、Checker 151/151、TypeScript typecheck／Biome lint・format、Rust unit／integration 7/7、`cargo fmt --check`、Clippy warning 0、locked release buildおよび命名closureが合格した。TypeScript coverageの固定母集団は17 source／16 testで、line 5921/6705、function 210/228、branch 932/1165である。未到達233 branchは、本変更の合格率またはSecurity成立へ換算しない。OwnerはQual-Labとし、native durable store、DACL Effect、Verified Imageまたはproduction processを実装する変更で、該当source別の正負／境界試験、残存risk、代替確認、人間判断要否および再確認条件へ接続する。Rust branchはstable toolchainで引き続き取得不能なため`Not Available`であり、0/0を100%へ換算しない。

この状態は`Applied`かつ`Self-checked`であり、独立監査前の`Resolved`、採用、統合またはReleaseを意味しない。
