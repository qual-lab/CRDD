# 変更トレース: 有効化前準備一回実行契約（Pre-active Provisioning One-shot Contract）

- 変更ID: `CHG-000033`
- 状態: `In Review`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-23
- 対象: CRDD公式RepositoryのWindows Platform Provisionerにおける、有効化前の読み取り専用主体観測を許可する限定実行契約
- 対象version: v0.18.0 Candidate
- 変更分類: `breaking`（private Platform Provisioner Effect result／descriptor、Runtime Activation説明／recordおよびdoctor reportのSchemaを同時更新する）
- 移行要否: `migration_required: true`（Effect contract revision 1→2、Runtime Activation revision 1→2、doctor report version 6→7、CLI result reason／keyおよびRepository内exact consumerを同時移行し、旧revision／versionのaliasまたはfallbackを設けない。supported production decoder、発行済みactivation record、永続stateおよび実Effectは0なので永続変換はない）
- 関連正本: [`19_Maintenance.md`](../../19_Maintenance.md#33-internal-typescript-runtime)、[`CHG-000021`](CHG-000021_Protected_Active_Pointer.md)、[`CHG-000032`](CHG-000032_Current_Process_Principal_Observation.md)、[`Coordinator README`](../../tools/coordinator/README.md)、[`脅威モデル`](../../tools/coordinator/threat-model.md)、[`実装残件台帳`](../../99_Roadmap/01_Product_Roadmap.md)

## 結論と承認済み境界

人間の決定権限者は、人間が真正性を確認した未改変の公式署名済みCRDD Releaseから、明示`coordinator provision`時だけ有効化前のnative one-shotを許す方針を承認した。通常Runtime Adapterのprocess起動禁止は維持する。本変更は、有効化前準備一回実行を別契約として固定し、1明示invocationにつき最大1 spawn attempt、固定Release／artifact／process境界、Network非発火、失敗時fail closed、通常run／doctor／source／PATH／Cargo／Shell／installer fallback禁止を正本へ反映する。

Microsoftの`CreateProcessW`は実行moduleをPath文字列で指定し、検証済みfile handleを実行imageとして直接指定するparameterを持たない。したがってNodeでHashを確認してからPathを起動する方式だけでは、検証対象とloaderが後で開くimageの連続性を証明できない。以下は外部仕様が直接裏付ける範囲と、CRDD側の設計推論を分離した設計入力である。

| 外部資料 | 公式更新日／確認日 | 適用箇所 | 直接裏付ける範囲 | この資料だけでは裏付けない範囲 |
| --- | --- | --- | --- | --- |
| [`CreateProcessW function`](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-createprocessw) | 2023-02-09／2026-08-23 | `lpApplicationName`、`lpCommandLine`、`lpEnvironment`、`lpStartupInfo`、Security Remarks | module名はPath／file名の文字列で渡し、明示環境と`STARTUPINFOEX`を指定できる | 検証済みhandleとloader imageの同一性、Network deny、process tree終了 |
| [`UpdateProcThreadAttribute function`](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-updateprocthreadattribute) | 2022-11-01／2026-08-23 | `PROC_THREAD_ATTRIBUTE_HANDLE_LIST`、`MITIGATION_POLICY`、`JOB_LIST` | childへ継承するhandle集合、mitigation policy、Job handleをprocess作成属性へ与えられる | 実行image真正性、Network deny、全descendant終了の成立 |
| [`Job Objects`](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects) | 2025-07-14／2026-08-23 | process関連付け、breakaway、`KILL_ON_JOB_CLOSE`、process tree | Job単位のprocess管理、child関連付け、breakaway条件および終了制御 | image真正性、Network deny、設定なしでのbreakaway不存在 |

「人間が真正性を確認した公式Releaseのnative top-level supervisorを直接起動する方式だけを次段候補とする」は、上記仕様とCHG-000021の初期Trust境界から導いたCRDD側の設計推論であり、Microsoft資料の直接の推奨ではない。OS、kernel、同じ管理者または初回実行前の改変は既存どおりv1保証対象外である。

CHG33-Aではpure contractと非発火投影だけを実装する。native supervisor、Release所有の外部生成不能なexecution binding、leafと全parentのnon-link／write-delete非共有handle、実行image Identity、固定argv／置換環境／上限付きI/O／timeout／Job／process tree終了およびNetwork非発火は未実装なので、運用one-shot、Verified Image、binder、Authority、Capability、Filesystem Effect、GateまたはClaude安全実行を主張しない。

## 契約母集団と利用側

契約母集団は、明示provision invocation、公式Release初期Trust、manifest／package／artifact Identity、private one-shot attempt、Process Effect、終了／回復状態および非昇格結果である。副作用のない`describePreActiveProvisioningOneShotContract()`をone-shot説明の唯一の正本とし、Effectは要約を、Runtime Activationとdoctorは同descriptorのsnapshotを投影する。Runtime／doctorはinspectorまたはEffect controllerを呼ばず、このsnapshotをreadiness、blocker、Gate、Authority、CapabilityまたはEffectの入力にしない。利用側はCLI dispatch、Platform Provisioner Effect、通常Platform Access Adapter、manifest loader、Release Identity、package filesystem／Trust／Gate、Rust revision 3 protocol、doctor／Runtime状態投影、README、脅威モデル、CHG-000032および実装残件台帳である。

今回、通常`inspectWindowsPlatformAccessCandidate`、Rust wire revision 3、manifest Schema、active pointer、Root observation、binderおよびProvider Homeは変更しない。新pure contractはcaller inputを読まず、native supervisor未実装理由でprocess前に`blocked`へ閉じる。Platform Provisioner Effect resultはreasonを`platform_provisioner_effective_access_adapter_not_implemented`から`pre_active_native_provision_supervisor_not_implemented`へ変更し、`processEffectIssued`と`helperProcessSpawned`を追加して全keyをCLI exact testへ固定する。Effect contract revisionは1→2、Runtime Activation revisionは1→2、doctor report versionは6→7へ更新する。Repository内利用側はCLI、Runtime Activation、doctorと各contract testで、supported production decoderは0、発行済みrevision 1 activation recordと永続stateは0であり、永続変換は行わない。Platform Provisioner Effectは`processEffectIssued:false`とFilesystem／Network／Authority／Capability falseを別軸で返す。

## 発火、非発火、境界および情報不足

- 発火例: 後続実装で、人間が真正性を確認した公式署名済みReleaseのnative top-level `coordinator provision`を明示実行し、同invocationの初回attemptで全Trust／artifact／handle／process／終了／Network条件が成立する場合だけ、読み取り専用workerを起動する。正常結果も現在process主体観測候補に限る。
- 非発火例: 現固定版、Node CLI、通常run、doctor、activate、disable、source checkout、開発build、direct caller object、PATH、Cargo、Shell、installer、別binary、自動retryまたはfallbackではprocessを起動しない。
- 境界例: 後続実装でspawn後にtimeout、不正response、異常exitまたはprocess tree終了不明となった場合は、Process Effect発生済みを保持して成功にせず、同invocationでretryしない。Filesystem mutation前なのでFilesystem Effectはfalseを維持する。
- 判定情報不足例: 初期Trust、Release signature、artifact／parent handle Identity、selected user、Root Identity、wire、Job、終了またはNetwork非発火の一件でも不明なら起動前に`blocked`とする。起動後に終了を確認できない場合は手動回復待ちとしてbinder／active／Effectへ進めない。

## 保持する意図と変更禁止範囲

既存subscription OAuthだけを使用し、API key、追加credit、Host Credential、token copy／injection、自動plan切替、Provider／model／fallback selectorおよび外部通信を導入しない。Windows v1はローカル対話ユーザー1名だけとし、別資格情報昇格、service／batch／network token、restricted token、AppContainerまたはsession属性だけからselected userを成立させない。raw Path、SID、group、session、token、ACL、stdout、stderrまたはOS errorを公開しない。

通常Adapter、Rust revision 3、旧revision alias禁止、source／PATH／Cargo／Shell／installer fallback禁止、12 blocker、6 evidence、Gate `blocked`、FU `In Progress`、v0.18 Candidateおよび非Releaseを維持する。Jobはprocess tree制御でありimage真正性またはNetwork denyの根拠にしない。Process EffectをFilesystem、権限、Network、Providerおよび課金Effectと混同しない。one-shot resultの`manualRecoveryRequired`と既存Effect resultの`recoveryRequired`は現在どちらもfalseだが別契約であり、相互aliasまたは自動変換を設けない。

## 段階実装、停止および回復

CHG33-Aのpure contract後は、native-first read-only supervisor、handle／image／Jobを結ぶbounded worker、selected-user binder、staging／Protection／active Effectの順に分離する。native supervisor自身が固定公開鍵でmanifestを検証し、leafと全rename可能parentのhandleを保持した同じ制御経路でだけworkerを起動する。Root Path／File Identityをcaller入力から取得しない。最初のFilesystem mutation前は失敗を`blocked`へ閉じ、mutationを導入する後続CHGではdurable intentを最初のEffectとして回復契約を別途固定する。

初期native entrypointの真正性をNode Path起動以外で固定できない、handle share／parent chain／process image／Job／timeout後tree不存在を実Windowsで確認できない、selected userを別資格情報と区別できない、またはNetwork非発火の根拠を実装閉包から説明できない場合は、該当段階を実装せず停止する。runtime fallback、暗黙retry、自動rollbackまたは状態削除は行わない。

## 検証設計と現在品質状態

CHG33-Aは、callerのProxy／accessorを実行しないこと、結果key集合、初期Trust／native supervisor／Verified Image／attempt／Process Effect／終了／回復／principal／binder／Authority／Capability／Filesystem／Networkの全軸、通常Runtime非発火およびEffect controller投影を直接試験する。Platform-access TypeScript coverageの固定母集団へ新source／testを追加し、line／function／branchの実測、未到達branch、理由、risk、代替確認、Owner、人間判断および再確認契機を取得する。Coordinator check／全test、Rust不変確認、Checker packageおよびRepository全体checkerを別軸で実行する。

是正後の実測ではCoordinator全414 test、typecheck、lint、formatがPassした。Platform-access TypeScript固定母集団は20 source／19 test、全体line 6493/7285、function 235/254、branch 995/1235で、新規one-shot sourceはline 65/65、function 3/3、branch 4/4、既存Effect sourceはline 54/54、function 3/3、branch 4/4、未到達branchなしを4回連続で再現した。Checker packageはtypecheck、lint、formatおよび全151 testがPassし、Repository全体checkerはMarkdown 348件、local link 2014件、anchor 579件を確認してerror 0／warning 0だった。Rustは変更なしのままformat、clippy、release build、9 testがPassし、固定stable toolchainでline 752/821、function 47/48、region 1179/1305を再確認した。Rust branch coverageは固定toolchainで取得不能のため、既存の明示的test母集団とTypeScript非発火投影を代替根拠とし、native supervisor導入時に再確認する。

初回固定版`fbf8521b223d16f6e41bfcc360ae8ee5b2512c8b`では、Agent／Architecture／Security ReviewがREADMEのCLI入力説明1件、Document Auditがprivate Schema版・正式状態語・外部根拠属性の3件、Gap／Impact／Conformance AuditがSchema移行とruntime／doctor oracleの2件を返した。全監査結果の完了後に統合し、各監査へ修正前再提示して整合を確認した。上記のbreaking移行、revision／version更新、exact consumer試験、descriptor-only投影、限定CLI説明、状態軸分離および外部設計入力表を適用した状態は再レビュー待ちであり、適用を解消判定へ流用しない。

## 最終独立再監査

是正版commit `16daf156ae8abda935e3cdfeae9aef1c62af4026`／tree `74aeea97fe30c1b2e5e1e1f228b135c9e62b24ca`へ、旧合否を流用せず必須監査集合を再実行した。Agent／Architecture／Security ReviewはPass（Finding 0）、Document AuditはPass（Finding 0）、Gap／Impact AuditおよびConformance AuditはPass／pure contract scope Eligible（Finding 0）だった。`AAS-CHG33A-001`、`DOC33-PRIVATE-SCHEMA-001`、`DOC33-STATE-AXIS-002`、`DOC33-EXTERNAL-EVIDENCE-003`、`GCI-033A-001`および`GCI-033A-002`はすべてResolvedで、新規または回帰Findingは0と判定された。

確認済み範囲は、one-shot pure descriptorとblocked result、Effect revision 2、Runtime Activation revision 2、doctor version 7、CLI／runtime／doctor exact利用側、通常Adapter非発火、Rust wire revision 3／manifest／active pointer不変、README／脅威モデル／CHG-000032／実装残件台帳、breaking移行、外部設計入力および全Effect／Authority／Capability非昇格である。source、call site、変更契約、直接利用側および文書は全数走査し、サンプリングしていない。native supervisor、実Windows handle／image／Job／race／Network enforcement、selected-user binder、protected active、Provider Home、実Provider、OAuthおよび課金は未評価または未実装のまま保持する。

独立再監査後の変更は、本節への監査結果記録だけに限定する。実装、試験、README、脅威モデル、coverage値、公開形式、永続形式および実装残件台帳は変更しない。記録後の新固定版ではRepository全体checkerを再実行し、この限定差分を独立確認へ戻す。

現在はpure contractだけが実装対象である。native supervisor、実process、Windows handle／Job race、Process Effect、Filesystem／Network／Provider／課金Effectは発火していない。運用one-shotは未実装のため現固定版では実行不能であり、本監査対象はpure contract scopeに限定する。準拠適格性は上記固定版のConformance Auditで別に判定した。Agent／Architecture／Security Review、Document Audit、Gap／Impact AuditおよびConformance Auditは同じcommit／treeへ実施し、旧CHGの合否を流用していない。

## 未完了事項と人間判断

`FU-018-PROVIDER-HOME`は`In Progress`を維持する。承認済み境界の次段はnative-first supervisorであり、pure contractのPassを実行安全性へ流用しない。native supervisor→実Windows handle／image／Job根拠→binder→protected active／Provider Home保護→issuer／store／clock→mount／失効の順を維持する。

現在、CHG33-Aの実装に追加の人間判断は不要である。native supervisorの採用、保護対象統合、残存risk受容、準拠表明、Gate open、StableまたはReleaseは人間の決定権限へ残す。
