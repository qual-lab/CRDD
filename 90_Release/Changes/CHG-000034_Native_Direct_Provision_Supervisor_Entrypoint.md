# 変更トレース: ネイティブ直接準備入口（Native Direct Provision Supervisor Entrypoint）

- 変更ID: `CHG-000034`
- 状態: `In Review`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-23
- 対象: CRDD公式RepositoryのWindows有効化前準備一回実行、native成果物およびprivate投影Schema
- 対象version: v0.18.0 Candidate
- 変更分類: `breaking`
- 移行要否: `migration_required: true`（one-shot 1→2、Effect 2→3、Runtime Activation 2→3、doctor 7→8、package manifest 1→2、package filesystem descriptor 1→2、Release Identity descriptor 1→2、Release staging manifest descriptorの旧unversioned shape→2、署名結果 1相当→2。旧revision／versionのaliasまたはfallbackなし。supported production decoder、発行済みrecord、installed stateおよび実Effectは0なので永続変換なし）
- 関連正本: [`19_Maintenance.md`](../../19_Maintenance.md#33-internal-typescript-runtime)、[`CHG-000021`](CHG-000021_Protected_Active_Pointer.md)、[`CHG-000033`](CHG-000033_Pre_Active_Provisioning_One_Shot_Contract.md)、[`Coordinator README`](../../tools/coordinator/README.md)、[`脅威モデル`](../../tools/coordinator/threat-model.md)、[`Product Roadmap`](../../99_Roadmap/01_Product_Roadmap.md)

## 結論と変更経路

人間の決定権限者が承認したnative-first境界を、workerを起動しないnative top-level直接観測へ収束する。人間が真正性を確認した未改変の公式署名済みRelease内の`coordinator.exe provision`自身が、将来同一process内で現在process tokenと固定Rootを1回だけ観測する。worker spawn上限は0であり、人間が開始したtop-level processをCoordinator-issued Process Effectへ数えない。

成果物と安定code termに残る`supervisor`はnative top-level入口のIdentityを表し、現方式でworkerを監督または起動することを意味しない。

この経路は、読み取り専用pre-active観測にchild隔離を導入した場合に増えるPath差替え、loader image連続性、pipe、Job、timeout後tree不存在および回復の不確実性を除く。hard timeoutまたはcrash isolationの必要性が実証された場合だけ、worker方式を別の保護対象変更として再評価する。CHG-000021の通常active Runtime向けVerified Image／bounded process境界は変更しない。

変更分類は、private Schema、署名domain、manifest payload、配布成果物、native CLI surfaceおよび全exact consumerを同時に変えるためbreakingである。保護対象採用、統合、Gate open、準拠表明、StableまたはReleaseは本変更で自己決定しない。Communication／Discoveryは外部公開、受け手、訴求または市場行動を変更しないため非該当である。

## 実装範囲

- Rust crateへ別成果物`coordinator.exe`を追加し、exact `provision`だけを受理する。現在はRelease binding未実装reasonで終了2を返し、観測、worker、Filesystem、Network、AuthorityまたはCapabilityを発火しない。
- 既存`crdd-platform-access.exe`とPA03／PR03 wire revision 3は別成果物として維持し、通常Adapterから起動しない。
- manifest revision 2は`platformAccessArtifact`と`nativeProvisionSupervisorArtifact`を別fieldへ固定する。後者は固定相対Path、target、entrypoint contract revision、Rust toolchain、byte長およびSHA-256を持つ。署名domainは`V2`とし、旧manifest revision 1を受理しない。
- Release staging sessionは両成果物を同時にstable same-file観測し、どちらかが欠落または変更された場合は署名または配置を成功にしない。Release Identityは両成果物を後置成果物としてGit Treeから明示除外する。
- 形状が変わるpackage filesystem、Release Identity、Release stagingおよび署名結果のprivate投影もrevision 2へ上げ、旧形状を同じrevisionへ混在させない。
- one-shot revision 2は`native_top_level_direct_self_observation`、観測上限1、worker spawn上限0を固定する。worker bounded processとprocess tree終了は`not_applicable_no_worker`であり、検証済み成功を意味しない。
- Effect revision 3、Runtime Activation revision 3およびdoctor version 8は同descriptorを副作用なしで投影する。Node CLI、通常Runtime、doctorはnative inspectorまたはEffect controllerを呼ばず、readiness、Gate、AuthorityまたはCapabilityへ使わない。

## 発火・非発火・境界・情報不足

- 発火例: 後続実装で、人間が真正性を確認した公式署名済みReleaseのnative `coordinator.exe provision`を明示実行し、初期Trustとは独立した事後Release／loaded image結合、local volume、全parent、PE依存閉包、Network非発火、現在tokenおよび固定Rootの全条件が同じrunで成立した場合に、直接観測をexact 1回行う。
- 非発火例: 現固定版、Node CLI、通常run、doctor、activate、disable、source checkout、開発build、PATH、Cargo、Shell、installer、別binary、自動retryまたはfallbackは観測しない。
- 境界例: native入口自体は人間が開始済みだが、Coordinator-issued child Process Effectはfalseである。worker不存在時のJob、bounded workerまたはtree terminationは非該当であり、成立確認へ読み替えない。
- 判定情報不足例: human trust ceremony、manifest、own loaded image、leafまたはrename可能parent、local volume、PE import／delay-import、DLL side-loading、Network非発火、tokenまたはRoot Identityの一件でも不明なら観測候補を発行せず`blocked`とする。

## Security不変条件と停止条件

自己Hashまたは自己署名検証だけから初期Trustを生成しない。Nodeまたは外部callerが与えたPath、SID、manifest、`verified` claim、結果fileまたは再投入objectをTrust、binder、AuthorityまたはCapabilityへ昇格しない。raw Path、SID、group、session、token、ACL、stdout、stderrまたはOS errorを外部結果へ含めない。

PE import／delay-import allowlistとDLL探索閉包、Release外DLL side-loading負例、own imageとmanifest artifactの同一run結合、leafと全rename可能parentのnon-link Identity、network／removable／unknown volume拒否およびNetwork API非発火を実Windowsで確認できない場合は直接観測を実装せず停止する。Job、空環境またはNetwork APIを明示使用しないというsource claimだけをNetwork denyへ換算しない。正常観測も同じnative invocation内の非Authority候補に限り、外部保存・再投入からbinderへ接続しない。

既存subscription OAuthだけを使用し、API key、Console API account、追加credit購入、自動plan切替、Host CLI、PATH、Shell、installerまたは第三者Providerへfallbackしない。Windows v1は選択ローカル対話ユーザー1名だけを対象とし、service、batch、network、restricted、AppContainerまたはsession属性だけからselected userを成立させない。

## 契約母集団と利用側

契約母集団はnative CLI／result、one-shot descriptor、Platform Provisioner Effect、Runtime Activation、doctor、manifest／envelope／signature domain、両Rust artifact、Release staging観測およびRelease Identityである。利用側はNode CLI exact result、runtime／doctor exact projection、manifest loader、Trust Core、package filesystem／gate、signing command／fixture、Rust unit／CLI、TypeScript／Rust coverage、README、脅威モデル、Maintenanceおよび実装残件台帳である。

active pointer、selected-user binder、Provider Home、mount Grant、実Provider、OAuth、Egress、quota、課金、GateおよびReleaseは直接callを追加せず、前提未成立または理由付き非該当として維持する。

## 検証義務と現在状態

固定候補ではCoordinator typecheck、lint、format、全contract test、manifest revision 1拒否、両artifact欠落／改変、Rust format、Clippy warning拒否、locked test／release build、coverage母集団、Checker packageおよびRepository全体checkerを別軸で確認する。native entrypointのexact argv、固定blocked byte、exit code、stderr空、worker spawn 0および全Effect falseを直接試験する。

監査是正後の固定Commit `c411738`／Tree `88e427b`では、Node.js 24.19.0でCoordinator 419件、Checker 151件、Rust 1.94.1で11件が全件成功し、locked release buildも成功した。Repository全体checkerはMarkdown 349、link 2022、error 0、warning 0だった。coverageのexact command、aggregate／変更source別実測、未到達Identity、理由、risk、利用者影響、代替確認、安全策、Owner、人間判断、再確認契機、連続2回で一致したpayload SHA-256および未評価範囲は[固定後検証実行記録](Evidence/CHG-000034_Verification_Run_Record_c411738.md)に保持する。100%未到達またはRust branch mapping非対応を成功へ換算しない。

現在実装したのはnative入口骨格、二成果物manifest binding、release staging／identity、private descriptorと非発火投影までである。loaded image、全parent handle、PE依存閉包、local volume、Network非発火、直接token／Root観測、binder、Protection、activeおよびProvider Homeは未実装または未検証であり、operational one-shot、Claude安全実行、Gate、StableまたはReleaseを主張しない。

初回固定前に、予定した正本、契約母集団、利用側母集団、代表例、変更禁止範囲と実差分を再照合する。固定版へRepository全体checkerを一度実行し、Agent／Architecture／Security Review、Document Audit、Gap／Impact AuditおよびConformance Auditを旧合否不流用で実行する。Findingがあれば監査集合を完了して統合方針を各監査へ再提示した後だけ是正し、新固定版へ全必須監査を再実行する。

## 最終独立再監査

最終固定版commit `79f78e994945530a89adc9e4b03ae6da08bff855`／tree `14ef4376194a6fa1777521ff0ec62411a63440e9`へ、旧合否を流用せず必須監査集合を再実行した。Agent／Architecture／Security ReviewはPass（Finding 0）、Document AuditはPass（Finding 0）、Gap／Impact AuditおよびConformance AuditはPass／限定implementation scope Eligible（Finding 0）だった。`AAS-CHG34-001`、`DOC34-RUST-CLI-BOUNDARY-001`、`DOC34-THREAT-SPAWNLESS-DUPLICATION-002`、`DOC34-COVERAGE-EVIDENCE-003`、`DOC34-MIGRATION-IDENTITY-004`、`DOC34-LOCALE-TERM-005`、`GCI-034-001`および`GCI-034-002`はすべてResolvedで、新規または回帰Findingは0と判定された。

確認済み範囲は、native exact blocked入口、spawn上限0、one-shot revision 2、Effect revision 3、Runtime Activation revision 3、doctor version 8、manifest／envelope revision 2とV2署名domain、二成果物Identity、release staging／identity、旧V1署名valid後の拒否、V2再署名後の各artifact単独欠落／native artifact全field・extra差拒否、Node／Runtime非発火、README／脅威モデル／Maintenance／実装残件台帳、breaking移行、coverage Evidenceおよび全Effect／Authority／Capability非昇格である。source、call site、変更契約、直接利用側および文書は全数走査し、サンプリングしていない。

独立再監査後の変更は、本節への監査結果記録だけに限定する。実Windowsのloaded image、leafと全rename可能parent、local volume、PE import／delay-import、DLL side-loading、Network API非発火、token／Root直接観測、binder、Protection、active、Provider Home、実Provider、OAuth、Egress、quotaおよび課金は未実装または未評価である。したがってoperational one-shot、Claude安全実行、Gate、準拠表明、Stable、Releaseまたは採用へ今回のPassを拡張しない。

## 未完了事項と人間判断

`FU-018-PROVIDER-HOME`は`In Progress`を維持する。次段はnative supervisorのloaded image／全parent／local volume／PE import／Network非発火の実Windows根拠で、その後に同process直接観測、selected-user binder、protected active／Provider Home保護、issuer／store／clock、mount／失効を接続する。

現在、承認済みnative direct入口骨格の実装に追加の人間判断は不要である。保護対象の採用・統合、残存risk受容、worker方式への変更、binder接続、Gate open、準拠表明、StableまたはReleaseは人間の決定権限へ残す。
