# Version ControlのSource構造整理・棚卸し

## Git技術責務への再編計画（2026-11-05、実装中）

現在の基準は`26c35783acdc911b4b31ea960afc2ba3ba6a7412`。利用者は、Git専用の完成操作、`get`による対象取得、`read`による内容取得、Repository内のFile／差分／Index／Commit処理の集約、Worktree管理の分離、不要Adapterの撤去を承認した。以下の旧計画・Evidenceは当時の記録として保持し、本節を現在の実装計画とする。

変更分類は公開契約と複数Packageの利用側へ及ぶ非自明な技術リファクタリング。Version Control、Domainの技術要求への投影、CoordinatorとWorkbench等の実利用側、Architecture／Qualityを追従する。独立した着手前確認は、exact Main／Linkedの操作先、非Git Directory読取り、CommitとRefの段階、PublicationのProcess条件を重点確認した。完成時は技術レビュー、文書・変更影響確認、実Git回帰、利用側の契約・型検査を実施する。準拠基準・決定権限・Releaseは変更せず、準拠監査と実AI・実Docker試験は対象外とする。

| 基準Capability | 現在のOwner | 新しいOwner・処置 | 保持する検証・終了条件 |
|---|---|---|---|
| Root／Layout／保存Identity／Local Ignore | repository各Source | Repository対象取得と技術操作へ統合。能力とfreshな実体確認を維持 | Main／Linked／submodule、fake境界・link・途中差替え、Ignoreの部分Effect・exact回復参照 |
| 固定Revision／Object／展開 | revision・snapshot・git/objects | repository/revision・files。中間出力先APIとAdapterを完成操作へ内包 | loose／packed／delta、checksum、OID・mode・Path・容量、部分展開・Cleanup |
| Tree／Diff／Index／通常Commit | worktree-view・changes・publication | repository/files・changes・working-directory・commit。共通Git起動へ接続 | Main／Linkedの個別HEAD／Index、選択外dirtyの保持、非0・期限・観測不能 |
| Worktree管理 | workspace/worktree | worktree。命名・Path選択は上位の技術要求へ | 登録／Branch／Directoryの個別観測、部分生成・削除、専用対象以外の拒否 |
| 選択内容の固定・Merge・保持Ref | workspace/candidate・merge | repository/commit・merge・reference。命名と業務MessageはDomain／Coordinatorへ | Base・親・選択Blob／mode・Ref CAS・readback、二親順、競合、同一対象再入場 |
| 非Gitの借用Tree観測 | workspace/observation | Coordinatorの実行領域Ownerへ戻す。Git File読取りへ偽装しない | 安定Identity、容量、link／hardlink、未知Path、変更前後差 |
| 通常Push | publication | repository/remote。不要Port／Factoryを撤去 | 現在対象の再観測、人間確認、HEAD一致、Remote readback、Force・自動再送なし |

CommitとRefの公開APIは分離するが、上位は既存Intent保存後、同じProcessで同期的に`createCommit`→`createReference`（CAS・readback）を呼び、両者と必要なCleanupを確認した合成結果だけを既存DTOへ保存する。中間に通常保存・await・別Process搬送を追加しない。既存Ref名・Path・保存DTOは維持し、既存Ref又は既知OIDから親・Tree・内容を再検証して同じ対象へ再入場する。生成後Cleanup不明でも検証済みOIDを捨てず、保持Refの確保と一次失敗・Cleanup結果を別々に扱う。

旧実装にもCommit生成からRef確保前までのProcess喪失gapがある。RefなしのCommit生成成功だけを保持完了へ昇格せず、DomainのJSONにOIDがあることをGitのGC保護と同一視しない。隠れたRef、新しいStore、類似Object探索、自動再生成は追加しない。独立した耐久Phaseとして任意時点から確実な復帰を求める場合は別の人間判断が必要だが、今回その保証は追加しない。

着手前の参照探索ではRoot公開104名、外部参照候補175Fileを検出した。後者は反例文字列等を含む候補であり本番Consumer数ではない。基準のVersion Control回帰73成功は過去Evidenceであり、今回の新構造の成功根拠には流用しない。着手時の再実行では73件中69成功・4失敗で、Root Consumer抽出とExecutorの既存Script利用一覧の不整合だった。Named動的importの限定受付と実利用一覧を是正し、深いPath・Namespace・計算されたimport等の拒否は維持した。

### 現在の実装・検証状態（中間候補、2026-11-05）

| 範囲 | 実装・確認結果 |
|---|---|
| Git Process | `git/execute.ts`へ既存の固定起動条件を集約。親Git環境、Hook、外部Filter、期限、出力上限、Main／LinkedのHEAD・Index分離を保持 |
| 非Git実行領域 | File観測をCoordinatorの`execution/files.ts`へ戻し、借用Treeの実境界試験も利用側へ移管 |
| Stage／Commit／Push | `repository/working-directory.ts`・`commit.ts`・`remote.ts`へ完成操作を接続。旧`publication/`のAdapter／Factory／受付層を撤去。WorkbenchのUI操作種別は上位へ維持 |
| Ref | 上位指定名と期待OIDを受けるCAS・readbackを実装。共有の直接Branch Refに限定し、Symbolic Ref・使用中Branch・Worktree固有Refを拒否。Commit生成との上位接続は未完了 |
| Root／Revision | `Repository`・`getRepository`・`getRepositoryFromWorkingDirectory`へ改名し利用側を追従。Revision／形式／固定IdentityのAdapter型・注入引数・公開constを実撤去。既存私有結合・fresh確認とGit読取り本体を維持 |
| 現在内容の読取り（2026-11-06確認） | `readWorkingChanges`を`working-directory.ts`、`readTree`を`files.ts`、`readFileDiff`を`changes.ts`へ接続。旧Local Change Set／Worktree ViewのAdapter・Factory・注入引数・中間観測型を撤去。旧`worktree-view.ts`も削除。`WorkingChanges`・`TreePage`・`FileDiff`は`types.ts`が所有。利用側・Architecture・Symbolを追従 |
| 静的確認 | VC・Domain Model・Coordinator・Workbench・Access Management・Execution Intelligence・MCP・Executorの型検査成功。VCとWorkbenchのFormatter／Lint成功。Checkerの既存配布入口はモジュール指定不足だけを`export {}`で是正し、型検査成功 |
| VC回帰 | 中間候補の`npm test`が73／73成功（149281ms）。Root Consumer照合12／12成功を含む。実Gitは新規のRepository内試験領域とローカルの合成Remoteだけを使用 |
| 利用側の実境界 | Publication追従後のWorkbench関連7／7成功。Coordinatorへ移したFile観測の既存結合Case成功。最新Root／Revision変更後、正式試験mainの有限代役＋公開HTTP試験1／1成功、Source固定後のPackage直結事前確認1／1成功（84429ms）。後者は実Git・Domainを使い、Direct／Isolatedの固定候補・二親Merge・回収を確認。実AI・実Dockerは呼ばない |
| 限定独立レビュー | Process／Refの3指摘を是正・再確認。Root改名・Revision Adapter撤去は必須指摘なし。全体完成レビューではない |
| 読取り再編の回帰（2026-11-06確認） | VCのFormatter・型・Lintを含む`npm test`が73／73成功（151548ms）。局所の実Git読取り8／8、Workbench表示・Repository操作2／2、Checkerの変更集合契約5／5成功。Workbench静的検査、Coordinator／Checker型検査も成功。読取り再編の限定独立レビューは必須指摘なし、残っていたSource責務・Adapter文言を是正 |
| Ignore完成操作（2026-11-06確認） | `registerRepositoryLocalIgnore`を既存更新本体へ直結。旧Adapter・注入型・重複結果型・DomainのWithAdapter入口を撤去。公開は登録関数だけとし、既存の契約ID・保存field・Lock・更新順序は維持。7段階の故障は内部技術更新試験、公開結果のEffect不明は実rename後のreadback EIOによるDomain結合試験で確認 |
| Ignore整理の検証（2026-11-06確認） | VC局所17／17、Domain保存領域9／9、Consumer照合12／12、VC全回帰73／73成功（159306ms）。VC／DomainのFormatter・型・Lint成功、Coordinator／Workbench型検査成功。限定独立レビューは必須是正なし。整形差分と内部ヘッダーの旧Adapter語句は是正 |

Snapshotは`readCommitFile`／`copyCommitFiles`へ接続し、旧`snapshot.ts`・Adapter・出力Token／WeakMap・中間公開型を撤去した。局所試験12件、利用側のObject Reader／Native出所読取り29件、Consumer照合12件が成功している。限定独立レビューの2指摘（空一覧からのEffect未発行推定、同期内容Queryから返るPromiseの未処理Reject）を是正し、再レビューは必須是正なし。最新の固定候補によるVC全体回帰と最終統合確認はまだ実施完了ではない。過去の73件成功をこのSnapshot変更後の全体成功へ流用しない。

### 公開境界の追加整理（2026-11-06、限定範囲の検証済み・全体未完了）

WorktreeのMain／Linked共通対象、選択Commitと保持Refの上位合成、Merge・明示Ref回収の利用側接続を実装し、VCの旧`workspace/`を撤去した。既存の保存DTO、Path／Branch／Ref名、Intent保存順序は維持している。VCの固定候補回帰76件、Workbenchの非AI結合2件が成功した。

追加棚卸しではRoot公開64 Symbolに、直接共有する本番利用がない型19件と静的なLocation説明辞書1件が残っていた。型定義自体は各Ownerへ維持してRoot再exportを撤去し、説明辞書関数は本体ごと撤去した。診断は実際のRepository取得結果とTokenの契約値だけを投影する。この候補では34関数・10型であり、その時点では公開統合の完了を主張していない。

Coordinatorの広域結合は40件中39件成功し、Ref読取り不能を旧「不一致」と期待する1件が失敗した。実際の故障注入が非0・非空の観測不能であることを確認して期待を訂正し、Merge前の非直接Ref／観測不能のEffect 0を追加確認した。是正後のCoordinator限定回帰6／6成功（105064ms）。Domainの公開一覧は新Ownerの型・業務検査へ追従し1／1成功。排他競合試験は期限・検査を変更せず単独再実行で1／1成功（405ms）したが、前回の待機失敗の原因を断定せず、広域Domain回帰全体の成功とは区別する。

限定独立レビューは、型削減・Location診断・Ref失敗分類とArchitectureのOwner是正について必須是正なし。Snapshot／Layout／変更Path集約の未実装部分と、未終了の最新回帰の成功を証明するものではない。

この限定変更後のVC公開`npm test`は76／76成功（142647ms）。VC・Domain・CoordinatorのFormatter／型／Lint、CoordinatorのRuntime／Task設計追跡検査も成功した。差分の空白検査は成功。今回のVC試験で残った専用Root内のNode compile cacheだけを実体・範囲・非link確認後に回収し、不存在を確認した。過去保持物は操作していない。実AI・Docker・外部Remoteの試験、最終公開集合の固定、全体完成レビューは未実施である。

### VCの残り3点の完了（2026-11-06、実AI・Dockerは対象外）

| 対象 | 実施結果 |
|---|---|
| Snapshot取得 | `readRepositorySnapshot(Repository \| null)`へ実統合。旧3入口・中間候補変換を撤去し、初期実体／前HEAD／Commit・Tree／後HEAD／最終実体を照合。既存JSON契約とSHA-1限定を維持 |
| Layout公開 | Root再exportを撤去。CoordinatorはHEAD不要の`readRepositoryStorageIdentity`で配置・所属を確認。内部解析と既存反証は維持し、未CommitへHEAD要件を加えない |
| 変更Path | 4観測成功後に`readWorkingChanges`が文字順・重複排除したPathを一度集約。旧公開関数を撤去。Workbenchは既存fieldだけの凍結済み表示値へ投影 |
| 公開集合 | 30関数・10型。Architectureとの完全一致、全本番Consumer・深いimportの照合を維持。旧`workspace/`・`publication/`はSourceに存在しない |
| 保存と診断 | DTOのCommit／Treeと診断Hashの旧field順を明示投影で維持。新Snapshot全体を旧記録へspreadしない |
| 独立レビュー | 中央Object読取り後のHEAD変更、後HEAD読取り後のRoot実体交換という必須2反例を追加し2／2成功。元Root／HEAD復元後の正常対照も確認し、再レビューは必須残件なし |

| 実行範囲 | 最新の結果 |
|---|---|
| VC公開`npm test`（静的検査→全実Git Integration） | 78／78成功、120257ms。Consumer照合12件・途中差替え2件を含む |
| Coordinator関連結合・試験器 | 282／282成功、259521ms。`repository-workspace-runtime`・`repository-root-resolution`・`repository-git-layout`・`git-object-reader`・`native-git-provenance`・`development-native-observation`・`signed-general-task-verification`・`task-real-provider-verification-script`の8 File。有限Provider／Native代役と実Git・子Processであり実AI成功を表さない |
| Workbench非AI結合 | 表示値の従来不変性を維持する最終調整後、Package直結事前確認と共有Repository操作を再実行し2／2成功、75300ms。前者はDirect／Isolatedの実Git・Domain保存・回収を確認 |
| Checker変更集合の公開利用 | `test-catalog/command` 5／5成功、10641ms |
| Domain公開・Workspace入力契約 | `public-boundary`と`workspace-technical-contract` 15／15成功、1061ms |
| 静的検査 | VC・Coordinator・Workbench・Checker・DomainのFormatter／型／Warning拒否Lint成功。CoordinatorのRuntime／Task設計追跡検査も成功。差分空白検査成功 |

実行対象の基準HEADは`26c35783acdc911b4b31ea960afc2ba3ba6a7412`に未Commit変更を加えた作業Tree。最終Workbench調整後のSource集合は`68b6fd371d1b71b49a3b83d54870a51d59b9438565e652c931f8b996c9349b99`（SHA-256）、1196 File、欠測0。Node v24.19.0、Git 2.54.0.windows.1で実行した。

Source集合の再導出は、`git ls-files -z -- 40_Develop template/tools .node-version .gitattributes biome.json package.json package-lock.json`のPathをUTF-8 byte順で整列し、各Pathについて`Path + NUL + file + NUL + raw bytesのSHA-256小文字hex + NUL`を順にSHA-256へ渡す。欠測は`Path + NUL + absent + NUL + NUL`。これは宣言したSource集合の識別であり、Repository全体、実AI・Docker E2E又はRelease Identityの成立証明ではない。Workbenchの最後の変更は表示投影をObject.freezeで包むだけでVC／Coordinator Sourceは不変とし、影響するWorkbench 2件をその変更後に再確認した。

最新試験の専用Rootは回収済み。VCのNode compile cacheとCoordinator試験の空Recovery親だけが残ったため、exact Root・内容・非linkを確認して削除し不存在を確認した。Recovery Recordや過去保持物は削除していない。実AI・Docker・外部Remote操作、Commit・Pushは実施していない。

今回のVC技術再編・公開整理の範囲は完了とする。以前の広域Domain待機失敗、他Packageの既存規約不整合、実AI／Dockerの未実施を全Repository成功へ読み替えない。Symbol別名の横断是正は利用者の指示どおりVC後の別作業として維持する。

読取り再編では、不正な`core.worktree`設定に対する試験を、旧private Adapterの明示Worktree指定による上書き成功から、完成APIのRoot原本確認によるEffect前拒否へ変更した。旧低レベルの成功実測をそのまま継続したとは表示しない。親`GIT_*`の対象注入抑止、正規Main／Linkedの読取りと個別Index／HEAD保全、外部Filter拒否は別の対照で維持した。

追加利用側試験の初回は、試験中に実装者がSourceを編集したため、両方式の技術操作と回収が成功していても`sourceUnchanged: false`となり失敗した。成功へ丸めず、編集停止後に当該Caseを再実行して成功を確認した。失敗時に残った今回の結果Fileは、exact試験Root・非link・単一link・閉じた内容・両方式の回収済み記録を照合し、そのFileと空親だけを削除して不存在を確認した。過去保持物は操作していない。

### 完了後の再点検と追加是正（2026-11-06、是正・検証完了）

再点検で、Remoteの観測失敗を未設定へ畳む分類と未検査の送信先公開、Treeの整列とCursor比較の不一致、DiscoveryのRoot拒否後fallback、未使用Release展開と転送層、Domain試験の旧Path／架空Source注入、Architectureの旧Adapter規範を確認した。上記の成功記録は当時の候補のEvidenceとして保持し、追加是正の成功へ流用しない。

変更分類は既存Git操作の失敗分類・情報境界と利用側の限定是正。公開APIは追加しない。Remoteは未設定を終了1・空出力・異常なしの場合だけとし、失敗を優先する。公開する送信先は登録済みRemote名かGit標準の同Repository指定`.`だけとし、URLや任意Pathを返さない。Treeは整列とCursorで同じ文字列全順序を使う。DiscoveryはRoot拒否時にGitを呼ばない。未使用の内容検査なしRelease展開と転送Wrapperは実撤去し、既存の内容検査付き本体を維持する。

試験の旧Path特例を除去し、故障注入先の現Source存在を要求する。これで顕在化したCoordinatorのWorkspace親Path構築は、既存の名前付き保存領域取得へ接続し、既存Path・親segmentのlink検査・空親だけの回収を維持する。台帳の重複参照と内部専用関数のexportも除去した。

独立レビューで、新しいDiscovery試験の`.git`なしDirectoryは親CRDDへ正常解決されるという前提誤りを確認した。製品の最寄りRoot探索は変更せず、不正な`.git`境界による拒否を先に観測してGit要求0を検査するよう是正する。実AI・Docker・過去保持物は操作せず、実Gitは新規のRepository内試験物とローカル合成Remoteに限定する。準拠基準・決定権限・保存Schemaは変更せず、準拠監査・Release判断は対象外とする。

| 最終候補の確認 | 結果 |
|---|---|
| VCの静的検査＋全実Git回帰 | `npm test`、79／79成功、155806ms。Remote設定の失敗・欠測・混在、URL／Path非公開、標準`.`とUnicode Remote、大小文字／Unicodeを含む全Page、Discovery拒否時Git要求0と正常子Directoryを含む |
| Coordinator Workspace結合 | 22／22成功、175056ms。親回収試験は真正Git Rootを準備し、実削除後のEIOと未確認の保存投影を維持 |
| Domain保存境界・公開・Workspace入力 | 19／19成功、2102ms。故障注入先の実在を要求し、旧Path特例は撤去 |
| Workbench Repository操作 | 4／4成功、19647ms。今回のローカルGitとHTTPの結合でありBrowser・実AI成功は主張しない |
| 静的・台帳・文書 | VC・DomainのFormatter／型／Warning拒否Lint、Coordinatorの全静的検査とRuntime／Task追跡検査、差分空白検査が成功。既存Info診断は失敗へ分類しない。公開30関数・10型とArchitectureの一致を維持 |
| 独立レビュー | 試験前提の是正、追加Consumer、利用一覧と試験準備、旧Port語彙の文書修正まで再レビューし、必須残件なし |

初回のVC回帰は追加Discovery試験の誤った前提で78／79、次の実行は新しいRoot取得Consumerの一覧追従漏れで78／79となった。Coordinatorの初回は非Gitの親回収Fixtureが新しい真正Root前提を満たさず21／22だった。各失敗を成功へ丸めず、前提・利用一覧を是正し、固定候補で上記の全回帰を再実行した。

最終の実装・試験Source集合は`ccfef53d4e3e6ef1df9ec8bb7da6b201fbf25414d5289d91626eb0c1c0b017ad`（前節と同じSHA-256導出、1196 File、欠測0）。今回の専用Rootは、残ったcompile cacheと空Recovery親のexact対象・非link・内容を確認して回収し、不存在を確認した。過去保持物は操作していない。現在、この追加是正に人間判断を要する残件はない。Commit・Push、実AI・Docker・外部Remote操作は行っていない。

### 通常Stageの外部Filter境界の是正（2026-11-06）

全Source再点検で、通常Stageだけが外部clean／process Filterを拒否せず、変換後の内容をStageして成功を返すことを、無害なFilterの実発火で確認した。未使用の旧Layout契約定数2個も検出した。利用者の是正承認を受け、既存の設定名観測を共用し、Stageの実対象に適用される外部FilterだけをEffect前に拒否する。公開関数・型・保存形式は変更しない。

変更分類はGit Processの安全条件を補う限定的な本質修正。Architecture、VCの実装・試験・台帳、Workbenchの結果閉検査とHTTP試験を追従する。着手前に正常・Filter適用・未適用・観測不能・期限を照合し、独立の技術確認で設定範囲と結果搬送を確認した。準拠基準・決定権限・Release判断を変更しないため準拠監査・リリース処理は対象外。実AI・Docker・外部Remote・過去保持物は操作しない。

最初の設定存在だけによる拒否案は、Hostの標準LFS設定だけで未適用Fileも止めると実試験で判明したため採用しない。同じ有効設定範囲で設定名を観測し、設定がある場合だけliteral PathのFile列挙とGit標準の属性観測を行う。Directory／混在指定を含む対象と属性応答を一対一照合し、設定されたdriverが実対象に適用される場合、又は観測不能・期限消費時に停止する。予約表示値`unset`／`unspecified`と同名driverの衝突も許可へ補完しない。

設定・属性観測とaddは同じRoot、Repository・global・systemの有効設定、既存の有界出力、総30秒を使用する。拒否結果は`blocked / prepare_external_filter_unavailable / effectIssued:false / effectConfirmed:false / revisionIdentity:null`で、Workbenchでもprepare専用の組合せとして扱う。Unstageと発行後unknownの意味は維持し、Filter Command値を公開しない。新しいLock・Manager・Store・監視・公開APIは追加しない。Layout解析や安全条件を変えず、未使用定数2個だけを撤去した。

| 最新の確認 | 結果 |
|---|---|
| VC局所の実Git／故障代役 | 9／9成功、13052ms。実発火対照、local clean／process、Global、Directory／混在、予約値衝突、属性欠測・余分・違うPath・非UTF8・Signal・期限、列挙失敗、add要求0・markerなし・Index bytes不変を確認 |
| VC静的検査＋全回帰 | `npm test`、81／81成功、138091ms。公開集合・本番Consumer・Domain逆依存検査を含む |
| Workbench操作 | 4／4成功、21247ms。実HTTPでStage前拒否と未発行状態を保持し、通常操作も成功。最後のFormatter調整後に全静的検査成功 |
| Domain保存境界 | 4／4成功、1029ms。名前付き境界と既知Consumerの検査を維持 |
| Checker試験台帳入口 | 5／5成功、9608ms。既存の検査・選択入口を維持し、今回の専用Rootも回収済み |
| 独立レビュー・再点検 | 属性方式への再整合、固定候補の技術・利用側・台帳・文書の独立確認を実施。最終再点検で追加の確定漏れなし |

System設定はHostを変更せず、同じ有効環境を渡す有限代役で確認した。Commit／Unstageも今回の合成Repositoryと無害markerで局所診断し、当該条件ではmarker未生成だったが、一般的な外部処理不存在の網羅証明にはしない。設定・属性観測とEffect間の非協調な変更の原子性、実AI・Docker・外部Remote E2Eは今回の成立範囲外とする。

最終Source集合は`7b5adf3f074480e8ccedcc7f17661b7df12c89a5c6932cee4668119c9c027368`（前節と同じSHA-256導出、1196 File、欠測0）。今回のFixture・合成Home・marker・診断用Rootは回収済み。最終回帰のcompile cacheもexact Root・内容・非linkを確認して回収し、不存在を確認した。製品の保存値、生出力、認証値を新たに保存していない。Commit・Pushは実施していない。

### 共通命名規約への追記（2026-11-06）

利用者が、追跡しやすさのために、実際の名前競合以外の`as`によるSymbol改名を禁止するよう指示した。[内部コーディング規約](../../../06_Architecture/99_Coding_Standards.md)の「import／exportで元のSymbol名を維持する」を正本として追記した。変更分類は内部実装規約の制約追加であり、同名参照・違反・実競合・根拠不足の境界を親担当が確認した。文書の独立レビューは必須是正なし、差分の空白検査も成功した。準拠基準・決定権限・実行動作・保存形式は変えず、準拠監査と実境界試験は追加しない。

AI AdapterのRoot入口には、公開名へ置換する型の別名exportが10件ある。今回の調査では競合回避の根拠は確認できず、新規約の移行対象として保持する。今回は規約の追加と適用境界の確認であり、AI Adapter本体、全既存Sourceの改名又はCheckerの自動検査を実装済みとはしない。改名する際は、公開入口だけの別名処置ではなく、所有元の宣言と利用側の対応を同時に追従する。

### VC完了後の一括対応：Symbol別名の移行候補（2026-11-06）

利用者が、AI Adapterだけでなく他Packageの別名もVC完了後にまとめて対応するよう指定した。VCの実装完了を優先し、この棚卸しを理由に各Packageの改名や公開契約変更を先行しない。DI／Executor／AI Adapterの本番Sourceも、この時点では追加変更しない。

現在の未Commit作業Treeを対象に、`40_Develop/**`と`template/tools/**`の追跡・追加済みTS／JS系SourceからNamed import／exportの`元名 as 別名`を抽出した。型アサーションとNamespace束縛を除く。字句抽出であり、試験内の例示文字列等を含み得る移行候補であって、競合判定済みの違反一覧又はASTによる網羅証明ではない。実装時に再棚卸しし、各候補を実競合による維持、宣言元からの改名、元名へ戻す、例示・非該当のいずれかへ判定する。

候補は全体369箇所、本番`src/`は150箇所（AI Adapter以外137箇所）。同一Symbolのimportとexportは別箇所として数える。件数を削減目標にはしない。

| 本番Package | src内の候補数 |
|---|---:|
| `access-management` | 2 |
| `ai-adapter` | 13 |
| `checker` | 4 |
| `coordinator` | 57 |
| `docker-isolation` | 12 |
| `domain-model` | 35 |
| `execution-intelligence` | 1 |
| `executor` | 9 |
| `mcp-server` | 5 |
| `platform-access` | 1 |
| `version-control` | 2 |
| `visual-preview` | 3 |
| `workbench-server` | 6 |

実施条件は、[命名規約](../../../06_Architecture/99_Coding_Standards.md)を正本とし、例外を実際の識別子競合だけへ限定すること。公開名だけのAlias、互換Alias又は空Wrapperで済ませず、所有元・利用側・公開契約・試験・台帳を同時に追従する。型アサーションはこの残件に混ぜない。既存の契約ID、Schema値、永続化データ、実行保証は改名と同時に変更しない。VC完了後の固定候補で回帰・独立レビューを行う。

<details>
<summary>移行候補の所在（未判定。行番号は棚卸し時点）</summary>

| File・行 | 種別 | 元名 → 別名 |
|---|---|---|
| `40_Develop/access-management/src/role/assign.ts:17` | import | `isAccessRole` → `isRole` |
| `40_Develop/access-management/src/user/crud.ts:17` | import | `isAccessRole` → `isRole` |
| `40_Develop/access-management/tests/integration/authorization/management.contract.test.ts:16` | import | `readCurrentAccessState` → `readCurrentAccess` |
| `40_Develop/access-management/tests/integration/initialization/storage.contract.test.ts:21` | import | `readCurrentAccessState` → `readCurrentAccess` |
| `40_Develop/access-management/tests/integration/initialization/storage.contract.test.ts:46` | import | `saveUserRegistration` → `registerUser` |
| `40_Develop/access-management/tests/integration/repository/management.contract.test.ts:25` | import | `readCurrentAccessState` → `readCurrentAccess` |
| `40_Develop/access-management/tests/integration/repository/management.contract.test.ts:32` | import | `saveExposure` → `updateExposure` |
| `40_Develop/access-management/tests/integration/repository/management.contract.test.ts:34` | import | `saveRepositoryRegistration` → `registerRepository` |
| `40_Develop/access-management/tests/integration/repository/management.contract.test.ts:35` | import | `saveRepositoryRemoval` → `unregisterRepository` |
| `40_Develop/access-management/tests/integration/repository/management.contract.test.ts:39` | import | `saveUserRegistration` → `registerUser` |
| `40_Develop/access-management/tests/integration/storage/fixture.ts:33` | import | `saveExposure` → `updateExposure` |
| `40_Develop/access-management/tests/integration/storage/fixture.ts:34` | import | `saveRepositoryRegistration` → `registerRepository` |
| `40_Develop/access-management/tests/integration/storage/store.contract.test.ts:35` | import | `saveExposure` → `updateExposure` |
| `40_Develop/access-management/tests/integration/storage/store.contract.test.ts:37` | import | `saveUserRole` → `updateUserRole` |
| `40_Develop/access-management/tests/integration/storage/store.contract.test.ts:38` | import | `saveRoleContentAccess` → `updateRoleContentAccess` |
| `40_Develop/access-management/tests/integration/storage/store.contract.test.ts:47` | import | `saveUserRegistration` → `registerUser` |
| `40_Develop/access-management/tests/integration/storage/store.contract.test.ts:48` | import | `saveUserName` → `updateUserName` |
| `40_Develop/access-management/tests/integration/user/management.contract.test.ts:17` | import | `readManagementStateSnapshot` → `readManagementState` |
| `40_Develop/access-management/tests/integration/user/management.contract.test.ts:23` | import | `saveUserRole` → `updateUserRole` |
| `40_Develop/access-management/tests/integration/user/management.contract.test.ts:24` | import | `saveRoleContentAccess` → `updateRoleContentAccess` |
| `40_Develop/access-management/tests/integration/user/management.contract.test.ts:29` | import | `saveUserRegistration` → `registerUser` |
| `40_Develop/access-management/tests/integration/user/management.contract.test.ts:30` | import | `saveUserName` → `updateUserName` |
| `40_Develop/ai-adapter/src/index.ts:13` | export | `AiModelCatalogSnapshot` → `ModelCatalog` |
| `40_Develop/ai-adapter/src/index.ts:14` | export | `AiModelSelectionResult` → `ModelSelectionResult` |
| `40_Develop/ai-adapter/src/index.ts:18` | export | `AiProvider` → `Provider` |
| `40_Develop/ai-adapter/src/index.ts:19` | export | `AiReasoningEffort` → `ReasoningEffort` |
| `40_Develop/ai-adapter/src/index.ts:20` | export | `AiModelSelection` → `ModelSelection` |
| `40_Develop/ai-adapter/src/index.ts:21` | export | `ProviderTurnCountDiagnostic` → `TurnCountDiagnostic` |
| `40_Develop/ai-adapter/src/index.ts:25` | export | `ProviderExecutionInput` → `ExecutionRequest` |
| `40_Develop/ai-adapter/src/index.ts:26` | export | `ProviderExecutionPlanResult` → `ExecutionPlan` |
| `40_Develop/ai-adapter/src/index.ts:31` | export | `ProviderAuthenticationDefinition` → `AuthenticationDefinition` |
| `40_Develop/ai-adapter/src/index.ts:33` | export | `ProviderBillingPolicy` → `BillingPolicy` |
| `40_Develop/ai-adapter/src/provider/input.ts:10` | import | `types` → `utilTypes` |
| `40_Develop/ai-adapter/src/provider/result.ts:25` | import | `types` → `utilTypes` |
| `40_Develop/ai-adapter/src/provider/task-result.ts:10` | import | `types` → `utilTypes` |
| `40_Develop/ai-adapter/tests/unit/codex/result.contract.test.ts:2` | import | `parseExecutionContent` → `parseFullProviderResult` |
| `40_Develop/ai-adapter/tests/unit/codex/result.contract.test.ts:3` | import | `extractProviderResult` → `parseProviderResult` |
| `40_Develop/ai-adapter/tests/unit/provider/advice-result.contract.test.ts:14` | import | `parseAdviceResult` → `normalizeAdviceResult` |
| `40_Develop/ai-adapter/tests/unit/provider/task-result.contract.test.ts:14` | import | `parseProviderResult` → `parseResolvedResult` |
| `40_Develop/checker/src/repository/reality.ts:12` | import | `createRealitySymbolGraph` → `createDomainRealitySymbolGraph` |
| `40_Develop/checker/src/repository/semantic.ts:7` | import | `compileQualitySemanticRelations` → `compileDomainQualitySemanticRelations` |
| `40_Develop/checker/src/repository/semantic.ts:9` | import | `compileSemanticIr` → `compileDomainSemanticIr` |
| `40_Develop/checker/src/repository/semantic.ts:11` | import | `createSemanticCoverageGraph` → `createDomainSemanticCoverageGraph` |
| `40_Develop/checker/tests/integration/crdd-check.contract.test.ts:26` | import | `runChecker` → `runDocumentChecker` |
| `40_Develop/checker/tests/unit/repository/reality.contract.test.ts:29` | import | `validateRealitySymbolManifest` → `validateDomainRealitySymbolManifest` |
| `40_Develop/checker/tests/unit/repository/semantic.contract.test.ts:22` | import | `createSemanticCoverageGraphResult` → `createSemanticCoveragePilotGraph` |
| `40_Develop/checker/tests/unit/repository/semantic.contract.test.ts:24` | import | `validateRealitySymbolManifest` → `validateDomainRealitySymbolManifest` |
| `40_Develop/coordinator/scripts/probe-verification.ts:11` | import | `DockerContainerBinding` → `ProbeBinding` |
| `40_Develop/coordinator/scripts/verification-result-record.ts:10` | import | `types` → `utilTypes` |
| `40_Develop/coordinator/scripts/verification-safety.ts:7` | import | `types` → `utilTypes` |
| `40_Develop/coordinator/scripts/verify-general-task.ts:11` | import | `types` → `utilTypes` |
| `40_Develop/coordinator/scripts/verify-route-matrix.ts:9` | import | `types` → `utilTypes` |
| `40_Develop/coordinator/src/api.ts:24` | import | `ProviderAuthenticationRequest` → `AuthenticationRequest` |
| `40_Develop/coordinator/src/api.ts:25` | export | `ProviderAuthenticationRequest` → `AuthenticationRequest` |
| `40_Develop/coordinator/src/api.ts:86` | export | `runCoordinatorPublicObjective` → `runObjective` |
| `40_Develop/coordinator/src/api.ts:87` | export | `runCoordinatorPublicDecision` → `submitDecision` |
| `40_Develop/coordinator/src/api.ts:88` | export | `runCoordinatorPublicAcceptanceDecision` → `acceptResult` |
| `40_Develop/coordinator/src/api.ts:89` | export | `runCoordinatorPublicStateQuery` → `queryState` |
| `40_Develop/coordinator/src/api.ts:90` | export | `executeWorkspaceCommand` → `executeWorkspace` |
| `40_Develop/coordinator/src/api.ts:91` | export | `readAuthorizedRuntimeActivity` → `queryActivity` |
| `40_Develop/coordinator/src/api.ts:399` | export | `observeRuntimeOwnedProjectClientPrincipal` → `observeClientPrincipal` |
| `40_Develop/coordinator/src/api.ts:401` | export | `isSupportedCoordinatorNodeRuntime` → `isSupportedNodeRuntime` |
| `40_Develop/coordinator/src/api.ts:402` | export | `getCoordinatorCapabilities` → `getCapabilities` |
| `40_Develop/coordinator/src/cli/authentication.ts:11` | import | `isSupportedNodeRuntime` → `isSupportedCoordinatorNodeRuntime` |
| `40_Develop/coordinator/src/cli/cancellation.ts:7` | import | `types` → `utilTypes` |
| `40_Develop/coordinator/src/cli/recovery-report.ts:7` | import | `types` → `utilTypes` |
| `40_Develop/coordinator/src/decision/acceptance.ts:16` | import | `createCurrentCoordinatorPersistencePorts` → `createCoordinatorPersistencePorts` |
| `40_Develop/coordinator/src/decision/acceptance.ts:19` | import | `createCoordinatorSnapshotAcceptanceDecisionStore` → `createCoordinatorAcceptanceDecisionStore` |
| `40_Develop/coordinator/src/decision/lifecycle.ts:26` | import | `createCurrentCoordinatorPersistencePorts` → `createCoordinatorPersistencePorts` |
| `40_Develop/coordinator/src/execution/authority.ts:12` | import | `types` → `utilTypes` |
| `40_Develop/coordinator/src/execution/authority.ts:35` | import | `ResourceTarget` → `ExecutorResourceTarget` |
| `40_Develop/coordinator/src/execution/authority.ts:37` | import | `createExecutor` → `createAuthentication` |
| `40_Develop/coordinator/src/execution/controller.ts:17` | import | `types` → `utilTypes` |
| `40_Develop/coordinator/src/execution/diagnostics.ts:25` | import | `types` → `utilTypes` |
| `40_Develop/coordinator/src/execution/lease.ts:12` | import | `hashRuntimeStateValueText` → `digest` |
| `40_Develop/coordinator/src/execution/lease.ts:14` | import | `hasRuntimeStateKeys` → `exactKeys` |
| `40_Develop/coordinator/src/execution/lease.ts:20` | import | `isRuntimeStateObject` → `plainObject` |
| `40_Develop/coordinator/src/execution/observation.ts:12` | import | `Provider` → `AiProvider` |
| `40_Develop/coordinator/src/execution/operation.ts:27` | import | `ExecutionFileEntry` → `InventoryEntry` |
| `40_Develop/coordinator/src/execution/operation.ts:28` | import | `readExecutionInventory` → `inventory` |
| `40_Develop/coordinator/src/execution/operation.ts:29` | import | `isExecutionRelativePath` → `validRelativePath` |
| `40_Develop/coordinator/src/execution/operation.ts:30` | import | `readExecutionFile` → `stableFileContent` |
| `40_Develop/coordinator/src/execution/preparation.ts:11` | import | `ReasoningEffort` → `AiReasoningEffort` |
| `40_Develop/coordinator/src/execution/provider-executor.ts:8` | import | `types` → `utilTypes` |
| `40_Develop/coordinator/src/execution/provider-executor.ts:9` | import | `Provider` → `AiProvider` |
| `40_Develop/coordinator/src/execution/provider-executor.ts:36` | import | `abandonRuntimeOwnedExecutorAttempt` → `abandonBoundExecutorAttempt` |
| `40_Develop/coordinator/src/execution/recovery.ts:11` | import | `setImmediate` → `yieldRecoveryEvents` |
| `40_Develop/coordinator/src/execution/recovery.ts:12` | import | `types` → `utilTypes` |
| `40_Develop/coordinator/src/execution/recovery.ts:31` | import | `decodeRuntimeDomainSnapshot` → `decodeCoordinatorStateSnapshot` |
| `40_Develop/coordinator/src/execution/recovery.ts:80` | import | `CompletionResult` → `TechnicalCompletionResult` |
| `40_Develop/coordinator/src/execution/recovery.ts:83` | import | `ResourceCleanupResult` → `AttemptResourceCleanupResult` |
| `40_Develop/coordinator/src/execution/recovery.ts:105` | import | `readCurrentCoordinatorState` → `readCoordinatorState` |
| `40_Develop/coordinator/src/execution/types.ts:9` | import | `ModelSelection` → `AiModelSelection` |
| `40_Develop/coordinator/src/execution/types.ts:10` | import | `Provider` → `AiProvider` |
| `40_Develop/coordinator/src/execution/types.ts:11` | import | `ReasoningEffort` → `AiReasoningEffort` |
| `40_Develop/coordinator/src/execution/validation.ts:11` | import | `types` → `utilTypes` |
| `40_Develop/coordinator/src/objective/execute.ts:16` | import | `snapshotRuntimeStateArray` → `snapshotPlainArray` |
| `40_Develop/coordinator/src/objective/execute.ts:17` | import | `snapshotRuntimeStateRecord` → `snapshotPlainRecord` |
| `40_Develop/coordinator/src/objective/replan.ts:8` | import | `snapshotRuntimeStateArray` → `snapshotPlainArray` |
| `40_Develop/coordinator/src/objective/replan.ts:9` | import | `snapshotRuntimeStateRecord` → `snapshotPlainRecord` |
| `40_Develop/coordinator/src/selection/resolve.ts:15` | import | `validateAiSelectionConfig` → `validateDomainAiSelectionConfig` |
| `40_Develop/coordinator/src/state/observation.ts:8` | import | `types` → `utilTypes` |
| `40_Develop/coordinator/src/state/observation.ts:11` | import | `snapshotRuntimeStateArray` → `snapshotPlainArray` |
| `40_Develop/coordinator/src/state/observation.ts:12` | import | `snapshotRuntimeStateRecord` → `snapshotPlainRecord` |
| `40_Develop/coordinator/src/state/query.ts:26` | import | `createCurrentCoordinatorPersistencePorts` → `createCoordinatorPersistencePorts` |
| `40_Develop/coordinator/src/task/dispatch.ts:36` | import | `types` → `utilTypes` |
| `40_Develop/coordinator/src/task/requests.ts:24` | import | `snapshotRuntimeStateArray` → `snapshotPlainArray` |
| `40_Develop/coordinator/src/task/requests.ts:25` | import | `snapshotRuntimeStateRecord` → `snapshotPlainRecord` |
| `40_Develop/coordinator/src/workspace/commands.ts:32` | import | `validIdentity` → `isStableId` |
| `40_Develop/coordinator/tests/fixtures/attempt-preparation.ts:10` | import | `Provider` → `AiProvider` |
| `40_Develop/coordinator/tests/fixtures/attempt-preparation.ts:11` | import | `TestAttemptPlan` → `AttemptPlan` |
| `40_Develop/coordinator/tests/fixtures/attempt-preparation.ts:14` | import | `createAttemptPreparation` → `createOwner` |
| `40_Develop/coordinator/tests/fixtures/docker-auth-create-closure-verifier.ts:24` | import | `setTimeout` → `delay` |
| `40_Develop/coordinator/tests/fixtures/docker-auth-create-closure-verifier.ts:25` | import | `setImmediate` → `yieldEvents` |
| `40_Develop/coordinator/tests/fixtures/task-result-fixture.ts:25` | import | `decodeRuntimeDomainSnapshot` → `decodeCoordinatorStateSnapshot` |
| `40_Develop/coordinator/tests/fixtures/terminal-interaction-probe.ts:13` | import | `TerminalOperationOutcome` → `InteractiveConsoleOperationOutcome` |
| `40_Develop/coordinator/tests/integration/coordinator-claude-delegation.integration.test.ts:15` | import | `preparationSelection` → `attemptSelection` |
| `40_Develop/coordinator/tests/integration/coordinator-state-runtime.contract.test.ts:35` | import | `decodeRuntimeDomainSnapshot` → `decodeCoordinatorStateSnapshot` |
| `40_Develop/coordinator/tests/integration/coordinator-task-runtime.contract.test.ts:29` | import | `types` → `utilTypes` |
| `40_Develop/coordinator/tests/integration/coordinator-task-runtime.contract.test.ts:46` | import | `executionSelection` → `createExecutionSelection` |
| `40_Develop/coordinator/tests/integration/coordinator-task-runtime.contract.test.ts:70` | import | `decodeRuntimeDomainSnapshot` → `decodeCoordinatorStateSnapshot` |
| `40_Develop/coordinator/tests/integration/current-recovery-resources.contract.test.ts:16` | import | `types` → `utilTypes` |
| `40_Develop/coordinator/tests/integration/docker-effect-runtime.contract.test.ts:22` | import | `preparationSelection` → `attemptSelection` |
| `40_Develop/coordinator/tests/integration/docker-probe-configuration-projection.contract.test.ts:15` | import | `sourceDeclaration` → `functionSource` |
| `40_Develop/coordinator/tests/integration/docker-restart-preparation-order.contract.test.ts:26` | import | `decodeRuntimeDomainSnapshot` → `decodeCoordinatorStateSnapshot` |
| `40_Develop/coordinator/tests/integration/git-object-reader.contract.test.ts:165` | import | `materializeGitCommitTreeCandidate` → `materializeVersionControlTree` |
| `40_Develop/coordinator/tests/integration/git-object-reader.integration.test.ts:18` | import | `materializeGitCommitTreeCandidate` → `materializeVersionControlTree` |
| `40_Develop/coordinator/tests/integration/provider-execution-boundary-matrix.contract.test.ts:6` | import | `ProviderEnvelopeInput` → `ProviderResultInput` |
| `40_Develop/coordinator/tests/integration/provider-execution-boundary-matrix.contract.test.ts:7` | import | `extractProviderResult` → `parseProviderResult` |
| `40_Develop/coordinator/tests/integration/provider-execution-boundary-matrix.contract.test.ts:22` | import | `ExecutionRequest` → `ProviderExecutionInput` |
| `40_Develop/coordinator/tests/integration/repository-workspace-runtime.contract.test.ts:40` | import | `bindRuntimeOwnedExecutionSnapshot` → `materializeReceivedTarget` |
| `40_Develop/coordinator/tests/integration/runtime-activity.contract.test.ts:32` | import | `queryActivity` → `readAuthorizedRuntimeActivity` |
| `40_Develop/coordinator/tests/integration/task-execution.contract.test.ts:29` | import | `createCurrentCoordinatorPersistencePorts` → `createCoordinatorPersistencePorts` |
| `40_Develop/coordinator/tests/integration/task-execution.contract.test.ts:33` | import | `runCoordinatorOperation` → `runCoordinatorOperationWithPorts` |
| `40_Develop/coordinator/tests/integration/task-full-flow.integration.test.ts:35` | import | `createCoordinatorSnapshotAcceptanceDecisionStore` → `createCoordinatorAcceptanceDecisionStore` |
| `40_Develop/coordinator/tests/integration/task-full-flow.integration.test.ts:46` | import | `resolveCoordinatorReplan` → `resolveCoordinatorReplanWithPort` |
| `40_Develop/coordinator/tests/integration/task-full-flow.integration.test.ts:51` | import | `readCurrentCoordinatorState` → `readCoordinatorState` |
| `40_Develop/coordinator/tests/integration/task-full-flow.integration.test.ts:52` | import | `createCurrentCoordinatorPersistencePorts` → `createCoordinatorPersistencePorts` |
| `40_Develop/coordinator/tests/integration/task-objective-intake.contract.test.ts:34` | import | `runCoordinatorObjective` → `runCoordinatorObjectiveWithPorts` |
| `40_Develop/coordinator/tests/integration/task-replanning-and-decision.contract.test.ts:38` | import | `resolveCoordinatorReplan` → `resolveCoordinatorReplanWithPort` |
| `40_Develop/coordinator/tests/integration/task-replanning-and-decision.contract.test.ts:44` | import | `createCurrentCoordinatorPersistencePorts` → `createCoordinatorPersistencePorts` |
| `40_Develop/coordinator/tests/integration/task-replanning-and-decision.contract.test.ts:47` | import | `runCoordinatorOperation` → `runCoordinatorOperationWithPorts` |
| `40_Develop/coordinator/tests/integration/workspace-lifecycle.integration.test.ts:43` | import | `executeWorkspace` → `executeWorkspaceCommand` |
| `40_Develop/coordinator/tests/support/console.ts:10` | import | `TerminalHandles` → `InteractiveConsoleHandles` |
| `40_Develop/coordinator/tests/support/console.ts:11` | import | `TerminalOperationOutcome` → `InteractiveConsoleOperationOutcome` |
| `40_Develop/coordinator/tests/support/console.ts:16` | import | `WINDOWS_TERMINAL_WRITE_TIMEOUT_MS` → `TERMINAL_WRITE_TIMEOUT_MS` |
| `40_Develop/coordinator/tests/support/probe-executor.ts:11` | import | `runInNewContext` → `runVm` |
| `40_Develop/coordinator/tests/system/task-recovery.contract.test.ts:25` | import | `runCoordinatorObjective` → `runCoordinatorObjectiveWithPorts` |
| `40_Develop/coordinator/tests/unit/execution/claude-preparation.contract.test.ts:24` | import | `preparationSelection` → `attemptSelection` |
| `40_Develop/coordinator/tests/unit/execution/codex-preparation.contract.test.ts:38` | import | `preparationSelection` → `attemptSelection` |
| `40_Develop/coordinator/tests/unit/execution/provider-execution.contract.test.ts:18` | import | `PreparationInput` → `AttemptInput` |
| `40_Develop/coordinator/tests/unit/execution/provider-execution.contract.test.ts:42` | import | `types` → `utilTypes` |
| `40_Develop/coordinator/tests/unit/provider-advice-output.contract.test.ts:1` | import | `extractProviderResult` → `parseProviderResult` |
| `40_Develop/coordinator/tests/unit/provider-authentication.contract.test.ts:16` | import | `authenticateProvider` → `authenticateFromApi` |
| `40_Develop/coordinator/tests/unit/storage/host-observation.contract.test.ts:17` | import | `decodeRuntimeDomainSnapshot` → `decodeCoordinatorStateSnapshot` |
| `40_Develop/docker-isolation/src/cleanup/resources.ts:6` | import | `types` → `utilTypes` |
| `40_Develop/docker-isolation/src/docker-desktop/directory.ts:10` | import | `types` → `utilTypes` |
| `40_Develop/docker-isolation/src/docker-desktop/dispose.ts:12` | import | `setImmediate` → `yieldToOwner` |
| `40_Develop/docker-isolation/src/docker-desktop/repair-operations.ts:8` | import | `DockerRuntimeRepairCheckpoint` → `Checkpoint` |
| `40_Develop/docker-isolation/src/docker-desktop/repair-operations.ts:9` | import | `decodeDockerRuntimeRepairCheckpoint` → `decode` |
| `40_Develop/docker-isolation/src/docker-desktop/repair-operations.ts:10` | import | `DockerDesktopRepairNativeHelperSession` → `Session` |
| `40_Develop/docker-isolation/src/docker-desktop/repair-session.ts:9` | import | `DockerRuntimeRepairCheckpoint` → `Checkpoint` |
| `40_Develop/docker-isolation/src/docker-desktop/repair-session.ts:13` | import | `decodeDockerRuntimeRepairCheckpoint` → `decode` |
| `40_Develop/docker-isolation/src/docker-desktop/repair.ts:8` | import | `DockerRuntimeRepairCheckpoint` → `Checkpoint` |
| `40_Develop/docker-isolation/src/docker-desktop/repair.ts:9` | import | `decodeDockerRuntimeRepairCheckpoint` → `decode` |
| `40_Develop/docker-isolation/src/docker-desktop/repair.ts:11` | import | `validateDockerRuntimeRepairCheckpointTransition` → `transition` |
| `40_Develop/docker-isolation/src/process/environment.ts:7` | import | `types` → `utilTypes` |
| `40_Develop/docker-isolation/tests/integration/attached-process.contract.test.ts:18` | import | `setTimeout` → `delay` |
| `40_Develop/docker-isolation/tests/integration/attached-process.contract.test.ts:22` | import | `createDockerAuthenticationRuntimeUsing` → `createDockerAuthenticationRuntime` |
| `40_Develop/docker-isolation/tests/integration/command-runtime.contract.test.ts:19` | import | `types` → `utilTypes` |
| `40_Develop/docker-isolation/tests/integration/isolation-lifecycle.contract.test.ts:11` | import | `createIsolationFixture` → `fixture` |
| `40_Develop/docker-isolation/tests/integration/network-policy.integration.test.ts:17` | import | `setTimeout` → `delay` |
| `40_Develop/docker-isolation/tests/integration/probe-lifecycle.contract.test.ts:14` | import | `types` → `utilTypes` |
| `40_Develop/docker-isolation/tests/integration/probe-runtime.contract.test.ts:17` | import | `types` → `utilTypes` |
| `40_Develop/docker-isolation/tests/integration/probe-runtime.contract.test.ts:56` | import | `types` → `utilTypes` |
| `40_Develop/docker-isolation/tests/integration/repair-directory-disposal.contract.test.ts:15` | import | `types` → `utilTypes` |
| `40_Develop/docker-isolation/tests/integration/repair-disposal-composition.contract.test.ts:12` | import | `decodeDockerRuntimeRepairCheckpoint` → `decode` |
| `40_Develop/docker-isolation/tests/integration/repair-host-operations.contract.test.ts:19` | import | `types` → `utilTypes` |
| `40_Develop/docker-isolation/tests/integration/repair-machine.contract.test.ts:11` | import | `decodeDockerRuntimeRepairCheckpoint` → `decode` |
| `40_Develop/docker-isolation/tests/integration/repair-machine.contract.test.ts:13` | import | `DockerRuntimeRepairCheckpoint` → `Checkpoint` |
| `40_Develop/docker-isolation/tests/integration/repair-machine.contract.test.ts:21` | import | `runDockerRuntimeRepairMachine` → `run` |
| `40_Develop/docker-isolation/tests/integration/repair-machine.contract.test.ts:22` | import | `validateDockerRuntimeRepairCheckpointTransition` → `transition` |
| `40_Develop/docker-isolation/tests/integration/repair-machine.contract.test.ts:25` | import | `parseDockerTaskRecoveryId` → `parseTechnicalRecovery` |
| `40_Develop/docker-isolation/tests/integration/repair-machine.contract.test.ts:26` | import | `parseDockerTaskRecoveryId` → `parseStoredRecovery` |
| `40_Develop/docker-isolation/tests/integration/repair-operations.contract.test.ts:11` | import | `decodeDockerRuntimeRepairCheckpoint` → `decode` |
| `40_Develop/docker-isolation/tests/integration/repair-operations.contract.test.ts:12` | import | `DockerRuntimeRepairCheckpoint` → `Checkpoint` |
| `40_Develop/docker-isolation/tests/integration/repair-operations.contract.test.ts:26` | import | `createDockerDesktopRepairOperations` → `operations` |
| `40_Develop/docker-isolation/tests/integration/repair-operations.contract.test.ts:27` | import | `runDockerRuntimeRepairSessionUsing` → `run` |
| `40_Develop/docker-isolation/tests/integration/repair-operations.contract.test.ts:29` | import | `validateDockerRuntimeRepairCheckpointTransition` → `transition` |
| `40_Develop/docker-isolation/tests/integration/repair-operations.contract.test.ts:32` | import | `DockerDesktopRepairNativeHelperSession` → `Session` |
| `40_Develop/docker-isolation/tests/integration/repair-runtime.contract.test.ts:11` | import | `decodeDockerRuntimeRepairCheckpoint` → `decode` |
| `40_Develop/docker-isolation/tests/integration/repair-runtime.contract.test.ts:12` | import | `DockerRuntimeRepairCheckpoint` → `Checkpoint` |
| `40_Develop/docker-isolation/tests/integration/repair-runtime.contract.test.ts:22` | import | `ownDockerRepairNativeSession` → `run` |
| `40_Develop/docker-isolation/tests/integration/repair-runtime.contract.test.ts:23` | import | `runDockerRuntimeRepairSessionUsing` → `runSession` |
| `40_Develop/docker-isolation/tests/integration/repair-runtime.contract.test.ts:25` | import | `validateDockerRuntimeRepairCheckpointTransition` → `transition` |
| `40_Develop/docker-isolation/tests/integration/repair-runtime.contract.test.ts:28` | import | `DockerDesktopRepairNativeHelperSession` → `Session` |
| `40_Develop/docker-isolation/tests/support/authentication/plan.ts:7` | import | `types` → `utilTypes` |
| `40_Develop/docker-isolation/tests/support/cleanup.ts:7` | import | `types` → `utilTypes` |
| `40_Develop/docker-isolation/tests/support/execution-plan.ts:9` | import | `types` → `utilTypes` |
| `40_Develop/docker-isolation/tests/support/execution.ts:23` | import | `types` → `utilTypes` |
| `40_Develop/docker-isolation/tests/support/probe-plan.ts:8` | import | `types` → `utilTypes` |
| `40_Develop/docker-isolation/tests/support/probe.ts:11` | import | `types` → `utilTypes` |
| `40_Develop/docker-isolation/tests/support/session.ts:7` | import | `types` → `utilTypes` |
| `40_Develop/docker-isolation/tests/unit/execution/plan.contract.test.ts:18` | import | `types` → `utilTypes` |
| `40_Develop/domain-model/src/ai-selection/types.ts:2` | import | `Provider` → `AiProvider` |
| `40_Develop/domain-model/src/ai-selection/types.ts:3` | import | `ReasoningEffort` → `AiReasoningEffort` |
| `40_Develop/domain-model/src/ai-selection/types.ts:4` | import | `ModelSelection` → `AiModelSelection` |
| `40_Develop/domain-model/src/ai-selection/validation.ts:11` | import | `types` → `utilTypes` |
| `40_Develop/domain-model/src/attempt/settlement.ts:16` | import | `decodeRuntimeDomainSnapshot` → `decodeCoordinatorStateSnapshot` |
| `40_Develop/domain-model/src/attempt/settlement.ts:18` | import | `observeRuntimeSettlementStorageAccess` → `borrowRuntimeOwnedCoordinatorSettlementRepository` |
| `40_Develop/domain-model/src/attempt/settlement.ts:19` | import | `observeRuntimeTerminalForStorage` → `borrowRuntimeOwnedDockerTerminalObservations` |
| `40_Develop/domain-model/src/attempt/settlement.ts:20` | import | `captureRuntimeCleanupVerification` → `captureOwnedOperationCleanupVerification` |
| `40_Develop/domain-model/src/attempt/types.ts:10` | import | `TurnCountDiagnostic` → `ProviderTurnCountDiagnostic` |
| `40_Develop/domain-model/src/decision/validation.ts:12` | import | `CoordinatorAcceptanceDecisionEnvelope` → `Envelope` |
| `40_Develop/domain-model/src/decision/validation.ts:234` | export | `validRecord` → `validCoordinatorAcceptanceDecisionRecord` |
| `40_Develop/domain-model/src/decision/validation.ts:235` | export | `validEnvelope` → `validCoordinatorAcceptanceDecisionEnvelope` |
| `40_Develop/domain-model/src/decision/validation.ts:298` | export | `validIntent` → `validCoordinatorDecisionRecoveryIntent` |
| `40_Develop/domain-model/src/index.ts:285` | export | `actions` → `RUNTIME_REPAIR_ACTIONS` |
| `40_Develop/domain-model/src/index.ts:289` | export | `directories` → `RUNTIME_REPAIR_DIRECTORIES` |
| `40_Develop/domain-model/src/index.ts:616` | export | `Envelope` → `RuntimeStateEnvelope` |
| `40_Develop/domain-model/src/index.ts:637` | export | `digest` → `hashRuntimeStateValueText` |
| `40_Develop/domain-model/src/index.ts:638` | export | `exactKeys` → `hasRuntimeStateKeys` |
| `40_Develop/domain-model/src/index.ts:639` | export | `exactRecordKeys` → `hasRuntimeStateRecordKeys` |
| `40_Develop/domain-model/src/index.ts:645` | export | `plainObject` → `isRuntimeStateObject` |
| `40_Develop/domain-model/src/index.ts:648` | export | `snapshotPlainArray` → `snapshotRuntimeStateArray` |
| `40_Develop/domain-model/src/index.ts:649` | export | `snapshotPlainRecord` → `snapshotRuntimeStateRecord` |
| `40_Develop/domain-model/src/plain-data/snapshot.ts:7` | import | `types` → `utilTypes` |
| `40_Develop/domain-model/src/state/activity.ts:10` | import | `types` → `utilTypes` |
| `40_Develop/domain-model/src/state/codec.ts:10` | import | `types` → `utilTypes` |
| `40_Develop/domain-model/src/state/crud.ts:91` | import | `decodeRuntimeDomainSnapshot` → `decodeCoordinatorStateSnapshot` |
| `40_Develop/domain-model/src/state/history.ts:17` | import | `decodeRuntimeDomainSnapshot` → `decodeCoordinatorStateSnapshot` |
| `40_Develop/domain-model/src/state/validation.ts:35` | import | `CoordinatorLeaseKind` → `LeaseKind` |
| `40_Develop/domain-model/src/state/validation.ts:37` | import | `types` → `utilTypes` |
| `40_Develop/domain-model/src/storage/runtime-lock.ts:13` | import | `observeRuntimeRecoveryRepository` → `borrowRuntimeOwnedCoordinatorRecoveryRepository` |
| `40_Develop/domain-model/src/storage/runtime-lock.ts:14` | import | `observeRuntimeStorageRepository` → `borrowRuntimeOwnedCoordinatorStorageRepository` |
| `40_Develop/domain-model/src/storage/runtime-store.ts:122` | import | `decodeRuntimeDomainSnapshot` → `decodeCoordinatorStateSnapshot` |
| `40_Develop/domain-model/src/storage/runtime-store.ts:191` | import | `observeRuntimeRecoveryRepository` → `borrowRuntimeOwnedCoordinatorRecoveryRepository` |
| `40_Develop/domain-model/src/storage/runtime-store.ts:192` | import | `observeRuntimeExecutionRepository` → `borrowRuntimeOwnedCoordinatorStateRepository` |
| `40_Develop/domain-model/src/workspace/result.ts:9` | import | `types` → `utilTypes` |
| `40_Develop/domain-model/tests/integration/runtime-marker-cleanup.contract.test.ts:22` | import | `decodeRuntimeDomainSnapshot` → `decodeCoordinatorStateSnapshot` |
| `40_Develop/domain-model/tests/integration/runtime-marker-cleanup.contract.test.ts:31` | import | `observeRuntimeRecoveryRepository` → `borrowRuntimeOwnedCoordinatorRecoveryRepository` |
| `40_Develop/domain-model/tests/integration/runtime-settlement.contract.test.ts:33` | import | `decodeRuntimeDomainSnapshot` → `decodeCoordinatorStateSnapshot` |
| `40_Develop/domain-model/tests/integration/runtime-snapshot-io.contract.test.ts:21` | import | `types` → `utilTypes` |
| `40_Develop/domain-model/tests/integration/runtime-snapshot-io.contract.test.ts:30` | import | `decodeRuntimeDomainSnapshot` → `decodeCoordinatorStateSnapshot` |
| `40_Develop/domain-model/tests/integration/runtime-snapshot-io.contract.test.ts:44` | import | `acquireRuntimeOwnedCoordinatorStateKernelLock` → `acquireRuntimeOwnedProjectStateKernelLock` |
| `40_Develop/domain-model/tests/integration/runtime-snapshot-io.contract.test.ts:52` | import | `initializeCoordinatorSnapshot` → `initializeSnapshot` |
| `40_Develop/domain-model/tests/integration/topic-meeting-repository.contract.test.ts:19` | import | `setTimeout` → `delay` |
| `40_Develop/domain-model/tests/unit/attempt/lease-candidates.contract.test.ts:13` | import | `projectCoordinatorLeaseAcquisitionOwner` → `projectOwner` |
| `40_Develop/domain-model/tests/unit/attempt/lease-candidates.contract.test.ts:14` | import | `prepareCoordinatorLeaseAcquisitionReservation` → `reserve` |
| `40_Develop/domain-model/tests/unit/attempt/lease-candidates.contract.test.ts:15` | import | `prepareCoordinatorLeaseAcquisitionConfirmation` → `acquire` |
| `40_Develop/domain-model/tests/unit/attempt/lease-candidates.contract.test.ts:16` | import | `prepareCoordinatorLeaseReleaseIntent` → `releaseIntent` |
| `40_Develop/domain-model/tests/unit/attempt/lease-candidates.contract.test.ts:17` | import | `prepareCoordinatorLeaseReleaseSettlement` → `release` |
| `40_Develop/domain-model/tests/unit/attempt/lease-candidates.contract.test.ts:18` | import | `projectCoordinatorLeaseOwnerLossState` → `inspectLoss` |
| `40_Develop/domain-model/tests/unit/attempt/lease-candidates.contract.test.ts:19` | import | `prepareCoordinatorReleasedLeaseReconciliation` → `reconcileReleased` |
| `40_Develop/domain-model/tests/unit/attempt/lease-candidates.contract.test.ts:20` | import | `prepareCoordinatorLeaseRecoveryReservation` → `reserveRecovery` |
| `40_Develop/domain-model/tests/unit/attempt/lease-candidates.contract.test.ts:21` | import | `prepareCoordinatorLeaseRecoverySettlement` → `settleRecovery` |
| `40_Develop/domain-model/tests/unit/attempt/repair-model.contract.test.ts:16` | import | `encodeRuntimeStateValue` → `encode` |
| `40_Develop/domain-model/tests/unit/attempt/repair-model.contract.test.ts:30` | import | `decodeRuntimeDomainSnapshot` → `decode` |
| `40_Develop/domain-model/tests/unit/attempt/repair-model.contract.test.ts:31` | import | `prepareCoordinatorStateRepairSnapshot` → `start` |
| `40_Develop/domain-model/tests/unit/attempt/repair-model.contract.test.ts:32` | import | `prepareCoordinatorStateRepairCheckpointSnapshot` → `checkpoint` |
| `40_Develop/domain-model/tests/unit/attempt/repair-model.contract.test.ts:34` | import | `prepareCoordinatorStateRepairDisposalDecisionSnapshot` → `discard` |
| `40_Develop/domain-model/tests/unit/attempt/repair-model.contract.test.ts:35` | import | `prepareCoordinatorStateRepairDisposalProgressSnapshot` → `progress` |
| `40_Develop/domain-model/tests/unit/attempt/repair-model.contract.test.ts:36` | import | `validateCoordinatorStateRepairDisposalTransition` → `disposalTransition` |
| `40_Develop/domain-model/tests/unit/attempt/repair-model.contract.test.ts:41` | import | `classifyCoordinatorRepairPublication` → `publication` |
| `40_Develop/domain-model/tests/unit/attempt/repair-model.contract.test.ts:42` | import | `prepareCoordinatorStateRepairRetentionHandoffSnapshot` → `handoff` |
| `40_Develop/domain-model/tests/unit/attempt/repair-model.contract.test.ts:43` | import | `validateCoordinatorStateRepairRetentionHandoffTransition` → `handoffTransition` |
| `40_Develop/domain-model/tests/unit/attempt/repair-model.contract.test.ts:44` | import | `prepareCoordinatorRepairHistorySummary` → `repairSummary` |
| `40_Develop/domain-model/tests/unit/attempt/repair-model.contract.test.ts:45` | import | `prepareCoordinatorRepairHistorySnapshot` → `repairHistory` |
| `40_Develop/domain-model/tests/unit/attempt/repair-model.contract.test.ts:46` | import | `prepareCoordinatorRepairHistoryLine` → `repairLine` |
| `40_Develop/domain-model/tests/unit/attempt/repair-model.contract.test.ts:47` | import | `prepareCoordinatorRepairHistoryPublication` → `repairPublication` |
| `40_Develop/domain-model/tests/unit/attempt/repair-model.contract.test.ts:49` | import | `prepareCoordinatorStateRepairCompletionSnapshot` → `completeRepair` |
| `40_Develop/domain-model/tests/unit/attempt/repair-state.contract.test.ts:13` | import | `decodeDockerRuntimeRepairCheckpoint` → `decode` |
| `40_Develop/domain-model/tests/unit/attempt/repair-state.contract.test.ts:14` | import | `dockerRuntimeRepairCheckpointIsSettled` → `isSettled` |
| `40_Develop/domain-model/tests/unit/attempt/repair-state.contract.test.ts:15` | import | `decodeDockerRuntimeRepairDisposalCheckpoint` → `decodeDisposal` |
| `40_Develop/domain-model/tests/unit/attempt/repair-state.contract.test.ts:16` | import | `dockerRuntimeRepairDisposalIsSettled` → `disposalSettled` |
| `40_Develop/domain-model/tests/unit/attempt/repair-state.contract.test.ts:17` | import | `decodeDockerRuntimeRepairRetentionTargets` → `decodeTargets` |
| `40_Develop/domain-model/tests/unit/attempt/repair-state.contract.test.ts:20` | import | `validateDockerRuntimeRepairCheckpointTransition` → `transition` |
| `40_Develop/domain-model/tests/unit/attempt/repair-state.contract.test.ts:21` | import | `createDockerRuntimeRepairDisposalCheckpoint` → `createDisposal` |
| `40_Develop/domain-model/tests/unit/attempt/repair-state.contract.test.ts:22` | import | `validateDockerRuntimeRepairDisposalTransition` → `disposalTransition` |
| `40_Develop/domain-model/tests/unit/attempt/repair-state.contract.test.ts:25` | import | `prepareDockerRuntimeRepairSessionCheckpoint` → `beginSession` |
| `40_Develop/domain-model/tests/unit/attempt/repair-state.contract.test.ts:26` | import | `validateDockerRuntimeRepairSessionCheckpoint` → `sessionTransition` |
| `40_Develop/domain-model/tests/unit/resource-book.contract.test.ts:10` | import | `createResourceOperationFixture` → `operationState` |
| `40_Develop/domain-model/tests/unit/state/history-candidates.contract.test.ts:13` | import | `prepareCoordinatorHistoryPending` → `prepare` |
| `40_Develop/domain-model/tests/unit/state/history-candidates.contract.test.ts:14` | import | `prepareCoordinatorTerminalRecordRetirement` → `retire` |
| `40_Develop/domain-model/tests/unit/state/history-candidates.contract.test.ts:15` | import | `prepareCoordinatorHistoryTransfer` → `transfer` |
| `40_Develop/domain-model/tests/unit/storage/runtime-codec.contract.test.ts:19` | import | `decodeRuntimeDomainSnapshot` → `decodeCoordinatorStateSnapshot` |
| `40_Develop/domain-model/tests/unit/storage/runtime-transitions.contract.test.ts:30` | import | `decodeRuntimeDomainSnapshot` → `decodeCoordinatorStateSnapshot` |
| `40_Develop/domain-model/tests/unit/task/queue-execution-candidates.contract.test.ts:13` | import | `prepareCoordinatorSingleTaskQueueCreation` → `enqueue` |
| `40_Develop/domain-model/tests/unit/task/queue-execution-candidates.contract.test.ts:14` | import | `prepareCoordinatorSingleTaskQueueUpdate` → `updateSingle` |
| `40_Develop/domain-model/tests/unit/task/queue-execution-candidates.contract.test.ts:15` | import | `prepareCoordinatorUnstartedTaskQueueClosure` → `closeUnstarted` |
| `40_Develop/domain-model/tests/unit/task/queue-execution-candidates.contract.test.ts:16` | import | `prepareCoordinatorQueueOperationUpdate` → `updateQueue` |
| `40_Develop/domain-model/tests/unit/task/queue-execution-candidates.contract.test.ts:17` | import | `prepareCoordinatorQueueRecoverySettlement` → `recoverQueue` |
| `40_Develop/domain-model/tests/unit/task/queue-execution-candidates.contract.test.ts:18` | import | `prepareCoordinatorQueueSelection` → `applySelection` |
| `40_Develop/domain-model/tests/unit/task/queue-execution-candidates.contract.test.ts:19` | import | `prepareCoordinatorQueueLeaseReleaseSettlement` → `releaseQueue` |
| `40_Develop/domain-model/tests/unit/task/validation.contract.test.ts:12` | import | `types` → `utilTypes` |
| `40_Develop/domain-model/tests/unit/workspace/crud.contract.test.ts:13` | import | `prepareCoordinatorIntegrationRecordCreation` → `resultCandidate` |
| `40_Develop/domain-model/tests/unit/workspace/crud.contract.test.ts:14` | import | `prepareCoordinatorWorkspaceRecordUpdate` → `workspaceCandidate` |
| `40_Develop/execution-intelligence/src/record/validation.ts:7` | import | `types` → `utilTypes` |
| `40_Develop/executor/scripts/executor-test.ts:18` | import | `types` → `utilTypes` |
| `40_Develop/executor/scripts/executor-test.ts:37` | import | `prepareAttempt` → `prepareProductAttempt` |
| `40_Develop/executor/scripts/executor-test.ts:39` | import | `resolveIsolationCommandInput` → `resolveProductConfiguration` |
| `40_Develop/executor/scripts/executor-test.ts:42` | import | `isAttemptPlanValid` → `validateProductPlan` |
| `40_Develop/executor/scripts/executor-test.ts:58` | import | `AttemptPlan` → `ProductAttemptPlan` |
| `40_Develop/executor/scripts/executor-test.ts:60` | import | `AttemptTerminalObservation` → `TechnicalObservation` |
| `40_Develop/executor/scripts/executor-test.ts:66` | import | `AttemptDiagnosticNotice` → `TechnicalDiagnosticNotice` |
| `40_Develop/executor/scripts/task-summary-observation.ts:15` | import | `extractProviderResult` → `parseProviderResult` |
| `40_Develop/executor/src/lifecycle/attempt.ts:9` | import | `types` → `utilTypes` |
| `40_Develop/executor/src/lifecycle/attempt.ts:11` | import | `ModelSelection` → `AiModelSelection` |
| `40_Develop/executor/src/lifecycle/attempt.ts:17` | import | `ExecutionResult` → `ProviderResultParseResult` |
| `40_Develop/executor/src/lifecycle/attempt.ts:46` | import | `AttemptCompletionResult` → `CompletionResult` |
| `40_Develop/executor/src/lifecycle/attempt.ts:55` | import | `AttemptStartResult` → `StartResult` |
| `40_Develop/executor/src/lifecycle/types.ts:15` | import | `ModelSelection` → `AiModelSelection` |
| `40_Develop/executor/src/lifecycle/types.ts:16` | import | `Provider` → `AiProvider` |
| `40_Develop/executor/src/lifecycle/types.ts:17` | import | `ExecutionResult` → `ProviderResultParseResult` |
| `40_Develop/executor/src/lifecycle/types.ts:18` | import | `TurnCountDiagnostic` → `ProviderTurnCountDiagnostic` |
| `40_Develop/executor/tests/fixtures/attempt-plan.ts:9` | import | `TestAttemptPlan` → `AttemptPlan` |
| `40_Develop/executor/tests/integration/task-summary-observation.contract.test.ts:13` | import | `extractProviderResult` → `parseProviderResult` |
| `40_Develop/executor/tests/integration/task-summary-observation.contract.test.ts:14` | import | `parseExecutionContent` → `parseContent` |
| `40_Develop/executor/tests/support/result-validation.ts:10` | import | `types` → `utilTypes` |
| `40_Develop/executor/tests/unit/attempt/advice.contract.test.ts:12` | import | `parseExecutionContent` → `parseProviderResult` |
| `40_Develop/executor/tests/unit/attempt/task.contract.test.ts:15` | import | `parseExecutionContent` → `parseProviderResult` |
| `40_Develop/executor/tests/unit/binding.contract.test.ts:25` | import | `TestAttemptPlan` → `AttemptPlan` |
| `40_Develop/executor/tests/unit/plan.contract.test.ts:22` | import | `TestAttemptPlan` → `AttemptPlan` |
| `40_Develop/executor/tests/unit/plan.contract.test.ts:24` | import | `bindTestIsolationRuntime` → `bindIsolationRuntime` |
| `40_Develop/mcp-server/src/request/snapshot.ts:7` | import | `types` → `utilTypes` |
| `40_Develop/mcp-server/src/tools/access-management.ts:10` | import | `setTimeout` → `yieldToTransport` |
| `40_Develop/mcp-server/src/tools/project-context.ts:13` | import | `types` → `utilTypes` |
| `40_Develop/mcp-server/src/tools/topic-meeting.ts:5` | import | `types` → `utilTypes` |
| `40_Develop/mcp-server/src/transport/http.ts:14` | import | `types` → `utilTypes` |
| `40_Develop/mcp-server/tests/integration/access-capabilities.integration.test.ts:26` | import | `request` → `httpRequest` |
| `40_Develop/mcp-server/tests/integration/access-capabilities.integration.test.ts:41` | import | `executeWorkspace` → `executeWorkspaceCommand` |
| `40_Develop/mcp-server/tests/integration/initial-connection.integration.test.ts:15` | import | `request` → `httpRequest` |
| `40_Develop/mcp-server/tests/integration/transport-lifecycle.contract.test.ts:14` | import | `request` → `httpRequest` |
| `40_Develop/mcp-server/tests/system/streamable-http-transport.integration.test.ts:22` | import | `request` → `httpRequest` |
| `40_Develop/mcp-server/tests/system/streamable-http-transport.integration.test.ts:24` | import | `createServer` → `createHttpsServer` |
| `40_Develop/mcp-server/tests/system/streamable-http-transport.integration.test.ts:25` | import | `request` → `httpsRequest` |
| `40_Develop/platform-access/src/host-record/record.ts:12` | import | `types` → `utilTypes` |
| `40_Develop/platform-access/tests/support/terminal-reader-harness.ts:13` | import | `InteractiveConsoleReaderLifecycleOutcome` → `InteractiveConsoleReadOutcome` |
| `40_Develop/platform-access/tests/system/terminal-reader.contract.test.ts:20` | import | `readInteractiveConsoleLineFromStream` → `readTerminalLineUsingStream` |
| `40_Develop/platform-access/tests/unit/host-record/record.contract.test.ts:23` | import | `createHostTerminalObservationRequest` → `native_createHostTerminalObservationRequest` |
| `40_Develop/platform-access/tests/unit/host-record/record.contract.test.ts:24` | import | `createHostTerminalReadRequest` → `native_createHostTerminalReadRequest` |
| `40_Develop/platform-access/tests/unit/host-record/record.contract.test.ts:25` | import | `createHostTerminalSaveRequest` → `native_createHostTerminalSaveRequest` |
| `40_Develop/platform-access/tests/unit/host-record/record.contract.test.ts:28` | import | `createKnownFileHostTerminalReadRequest` → `native_createKnownFileHostTerminalReadRequest` |
| `40_Develop/platform-access/tests/unit/host-record/record.contract.test.ts:29` | import | `createKnownFileHostTerminalSaveRequest` → `native_createKnownFileHostTerminalSaveRequest` |
| `40_Develop/version-control/src/repository/ignore.ts:13` | import | `REPOSITORY_GIT_EXCLUDE_MAX_BYTES` → `MAX_EXCLUDE_FILE_BYTES` |
| `40_Develop/version-control/src/repository/layout.ts:7` | import | `types` → `utilTypes` |
| `40_Develop/visual-preview/src/browser/devtools.ts:10` | import | `setTimeout` → `wait` |
| `40_Develop/visual-preview/src/browser/measure.ts:10` | import | `setTimeout` → `wait` |
| `40_Develop/visual-preview/src/browser/process.ts:11` | import | `setTimeout` → `wait` |
| `40_Develop/visual-preview/tests/integration/visual-preview-server.contract.test.ts:13` | import | `request` → `httpRequest` |
| `40_Develop/workbench-server/scripts/verify-readonly-ai.ts:12` | import | `setTimeout` → `delay` |
| `40_Develop/workbench-server/src/server/routes/ai-selection.ts:13` | import | `setTimeout` → `yieldToTransport` |
| `40_Develop/workbench-server/src/server/routes/management.ts:13` | import | `setTimeout` → `yieldToTransport` |
| `40_Develop/workbench-server/src/server/routes/record.ts:12` | import | `setTimeout` → `yieldToTransport` |
| `40_Develop/workbench-server/src/server/routes/repository.ts:12` | import | `setTimeout` → `yieldToTransport` |
| `40_Develop/workbench-server/src/server/routes/shared-view.ts:34` | import | `setTimeout` → `yieldToTransport` |
| `40_Develop/workbench-server/src/server/routes/workspace.ts:13` | import | `setTimeout` → `yieldToTransport` |
| `40_Develop/workbench-server/tests/integration/ai-verification.contract.test.ts:16` | import | `request` → `httpRequest` |
| `40_Develop/workbench-server/tests/integration/artifact.integration.test.ts:17` | import | `request` → `httpRequest` |
| `40_Develop/workbench-server/tests/integration/management.integration.test.ts:24` | import | `request` → `httpRequest` |
| `40_Develop/workbench-server/tests/integration/management.integration.test.ts:30` | import | `setTimeout` → `delay` |
| `40_Develop/workbench-server/tests/integration/public-origin.contract.test.ts:15` | import | `request` → `httpRequest` |
| `40_Develop/workbench-server/tests/integration/workbench-server.contract.test.ts:39` | import | `request` → `httpRequest` |
| `40_Develop/workbench-server/tests/integration/workspace-task-diagnostic.contract.test.ts:1` | import | `extractProviderResult` → `parseProviderResult` |
| `40_Develop/workbench-server/tests/system/credential-administration-browser.contract.test.ts:32` | import | `setTimeout` → `delay` |
| `40_Develop/workbench-server/tests/system/workbench-server-entry.integration.test.ts:23` | import | `createServer` → `createHttpServer` |
| `40_Develop/workbench-server/tests/system/workbench-server-entry.integration.test.ts:24` | import | `request` → `httpRequest` |
| `40_Develop/workbench-server/tests/system/workbench-server-entry.integration.test.ts:28` | import | `createServer` → `createHttpsServer` |
| `40_Develop/workbench-server/tests/system/workbench-server-entry.integration.test.ts:29` | import | `request` → `httpsRequest` |

</details>

成果物種別: 変更計画の移管分析
対象: [第二段階](second-stage-plan.md)／`40_Develop/version-control`
基準Commit: `5fa9a6c18`
状態: 対象の再配置・回帰・独立レビュー完了。全体QAと実System移行は別途
維持責任者・判断権限: Qual-Lab
確認日: 2026-10-20

## 1. 結論と変更境界

利用者の再編方針を基本とし、`git/command.ts`だけを合意済みの`git/read.ts`へ補正する。Version Controlを独立Packageとして維持し、Git操作の再実装・Library追加・安全条件の緩和を行わない。

現行Sourceは23 File・9,036行、Root公開は実行時61名と型37名である。添付の基準`add26c3`以降、同Packageの本体変更はなく、利用側閉包試験のPath追従だけがある。公開API維持を基本とし、移行比較の1操作・1型の退役だけは別判断とする。

調査範囲は全Sourceの宣言・依存・主要操作、Root公開、`40_Develop`と`template/tools`の参照、登録試験、対応Architecture・Qualityである。単純な文字列検索には試験内の反例文字列も含まれるため、本番利用と合算しない。今回の棚卸しで試験は再実行していない。

変更分類は非自明な実装Refactorの計画。実装時は詳細Architecture・公開API・Consumer・試験・Symbol・台帳へ伝播し、技術／品質の独立レビューと文書／直接影響の確認を行う。準拠基準・Release・外部AI・Docker実行は変更しないため、それらの監査・E2Eを今回の配置変更だけから追加しない。

## 2. After候補

以下は責務配置の候補であり、実装済みの宣言ではない。

```text
src/
├ index.ts                    実Ownerから公開名を明示列挙
├ repository/
│  ├ location.ts              exact Root検証・利用時の再確認
│  ├ layout.ts                Git管理領域・実体・構成の観測
│  ├ revision.ts              Revision／形式／固定Identity
│  ├ snapshot.ts              固定内容の検査・読取り・限定実体化
│  ├ changes.ts               変更集合の検査とGit差分観測
│  ├ worktree-view.ts         読取り用Tree・選択差分・ページング
│  └ ignore.ts                Repository-local除外の登録と安全な更新
├ workspace/
│  ├ worktree.ts              専用Worktree／Branchの作成・観測・終了
│  ├ candidate.ts             選択差分の固定・内容確認・専用Ref回収
│  └ merge.ts                 固定Candidateの明示Merge・二親確認
├ publication/
│  ├ change.ts                通常Stage／Commit／Pushの要求・結果と受付
│  └ git.ts                   上記操作の具体的なGit接続
└ git/
   ├ read.ts                  diff／ls-filesの既存限定実行
   ├ objects.ts               既存Object Reader。改名・参照追従のみ
   └ observation.ts           入れ子Repository等の有限な観測
```

Packageには現在binがない。今回のためにbin／CLI受付を新設しない。`git/read.ts`は全Git操作の共通実行基盤ではなく、`cli/command.ts`に相当するコマンド受付でもない。

## 3. 全Sourceの対応

PathはPackageの`src/`からの相対Path。

| 現行 | 配置候補 | 理由・維持する境界 |
|---|---|---|
| `index.ts` | 同左 | 明示公開を維持。Capability内barrelを作らない |
| `repository/location.ts` | 同左 | Root能力の所有・発行・再確認を維持 |
| `git/layout.ts` | `repository/layout.ts` | 管理領域の観測と実体確認を所有 |
| `git/layout-adapter.ts` | `repository/layout.ts`へ同居 | 同じLayoutの入力拒否・結果投影。実処理を残し単独中継Fileを除く |
| `repository/revision.ts` | 同左 | 現在Revisionの操作・型 |
| `fixed-revision.ts` | `repository/revision.ts`へ同居 | 固定Identityも同じRevision責務 |
| `git/revision-adapter.ts` | `repository/revision.ts`へ同居 | HEAD／Ref観測と中立結果への変換を維持 |
| `fixed-snapshot.ts` | `repository/snapshot.ts` | 出力先能力・容量・Content Policy・部分成立結果を維持 |
| `git/fixed-snapshot-adapter.ts` | `repository/snapshot.ts`へ同居 | Object Readerへの実接続。単純reexportにしない |
| `local-change-set.ts` | `repository/changes.ts` | 比較基準・変更Path・結果契約 |
| `git/local-change-set-adapter.ts` | `repository/changes.ts`へ同居 | 有限Git出力の解析と変更集合への変換 |
| `repository/worktree-view.ts` | 同左 | 読取り表示・Path／Cursor検査 |
| `git/worktree-view-adapter.ts` | `repository/worktree-view.ts`へ同居 | Tree／差分への実接続と失敗区別 |
| `repository/local-ignore.ts` | `repository/ignore.ts` | 除外登録の受付・結果 |
| `git/local-ignore-adapter.ts` | `repository/ignore.ts`へ同居 | exactなGit除外File更新・所有Lock・読戻し・失敗相関を維持 |
| `git/worktree-management.ts` | `workspace/worktree.ts` | 専用Worktreeの技術操作。Taskや採否判断を持たせない |
| `git/workspace-candidate.ts`の固定・確認・回収 | `workspace/candidate.ts` | 一つのBaseと選択集合から固定し、専用Refだけを回収 |
| 同FileのMergeとMerge状態読取り | `workspace/merge.ts` | 固定後の別操作・取込先のEffectと二親確認を分離 |
| `change-publication.ts` | `publication/change.ts` | 通常の変更公開とCandidate統合を混ぜない |
| `git/change-publication-adapter.ts` | `publication/git.ts` | 独立した具体的Git操作と注入Runnerの試験境界を維持 |
| `git/read-command.ts` | `git/read.ts` | diff／ls-files限定、filter確認・環境・出力上限・合計期限は不変 |
| `git/commit-tree.ts` | `git/objects.ts` | loose／packed／deltaの実装は置換しない |
| `git/checker-observation-adapter.ts` | `git/observation.ts` | 実際にGitを呼び結果変換している。品質判断は移さない |
| `migration-closure.ts` | Runtime公開からの退役候補 | 本番Consumerなし。専用合成試験とQA義務の処置は§6で別判断 |

統合は安全条件の削除ではない。公開Adapter型・値・契約ID・revisionは保持し、File名だけを理由に改名しない。同名private関数・定数の衝突が生じる場合は、参照先の一意性を保った内部改名に限定する。

### Candidate／Mergeの分離

`mergeWorkspaceCandidate`と、その操作だけが使う`readCandidateMergeHead`を`merge.ts`へ移す。共有する`operateCandidate`、`verifyCandidate`、`temporaryIdentity`等は実Ownerの`candidate.ts`から内部参照し、複製や転送専用Fileを追加しない。依存は`merge → candidate → worktree`とし、逆依存を作らない。Rootは各実Ownerから直接exportする。

## 4. Capability・利用側・検証の対応

| 保持Capability | 主な利用側 | 主な検証・反証 |
|---|---|---|
| Root／Layout | Domain、AM、Checker、Coordinator、EI、MCP、Orchestrator、Visual、Workbench、配布入口 | 通常／linked／submodule、偽装境界、link、発行後変更、観測不能 |
| Revision／固定Identity | Coordinator、Checker、各観測利用側 | HEAD／Ref／packed参照、形式不一致、観測間変化 |
| 固定Snapshot | Coordinator、固定内容利用側 | loose／packed・delta・checksum、容量・Path・mode、出力先の実体、部分生成と回収 |
| Local Changes／Tree／Diff | Checker、Domain、Workbench等 | dirty・未追跡、比較基準、Path／Cursor、filter拒否、環境差替え・出力上限 |
| Local Ignore | Domain等のRepository-local保存 | 並行更新、exact Lock、原子的公開、読戻し、Effect不明と清掃不明の相関 |
| Worktree／Candidate／Merge | Orchestrator、本番Workbench／MCPのWorkspace経路 | dirty／stage非混入、Baseと固定Commit、二親順序、Conflict・HEAD変化、途中失敗、再入場、他資源保全 |
| 通常Stage／Commit／Push | Workbench `server.ts`、`project/surface.ts` | 選択Path、確認済み公開先、通信失敗／拒否／不明、Force・自動再送なし |
| Repository観測 | Checkerの観測・回帰選択経路 | nested境界、Gitlink、入力・出力・失敗の区別 |

成立済み能力と過去Evidenceは[Version Control詳細設計の基準版移行表](../../../06_Architecture/Details/version-control/01_Architecture.md#9-基準版capabilityの移行)を比較入力とする。実装履歴は`9c462a2e9`（Worktree）、`5038b6bdd`（固定・明示Merge）、`174bef00d`（公開入口）、`9e99cdf10`（Workspace回帰是正）を確認した。過去の署名・Provider結果は当時の根拠として維持し、新配置の検証を代替しない。

他PackageのSourceはRoot公開入口を利用している一方、Coordinatorの一部試験はObject／Layout等の内部へ直接接続している。配置換え時には単なるPath追従と正式APIへの接続判断を分け、試験用内部Symbolを無条件にRoot公開しない。利用側閉包試験内の不正import反例は、本物の未移管参照として消さない。

## 5. 実装前に固定する検証境界

1. 全Sourceの移動と公開集合・型・契約値を照合する。操作順・引数・環境・出力上限・期限は不変。
2. 既存の実Git試験をRepository内の自己生成領域だけで再実行する。本体のBranch／Index／dirtyは試験対象にしない。Push試験は合成Local Remoteを用い、外部Remoteへ送信しない。
3. Worktreeの作成要求・登録観測・部分成立・取消／失敗後の資源状態を分ける。自動Rollback・強制回収・新しい回復機構は追加しない。
4. 単一結果や試験件数から全能力完成を推定しない。実行していない境界と既知の全体QA不合格を区別する。
5. Root／File／関数Headerを実際の読取り・書込み・Process起動へ合わせる。`effect N/A`なのにFS／Git操作を呼ぶ既存の説明は、操作本体を変えず訂正する。

## 6. 人間へ返す判断：移行比較APIと専用合成試験

### 確認できた事実

`inspectMigrationSystemClosure`と`MigrationConsumerObservation`は、専用`migration-system-closure.contract.test.ts`と、その固定Consumer一覧Fixtureだけが使う。本番の移行・公開・回復入口では呼ばれていない。比較対象も`producer`等の合成配列であり、実SourceからConsumerを発見せず、公開／署名／Release／Recoveryを実行しない。

削除で失うのは、不足・余剰、旧契約・別Snapshot混在、固定役割の存在という合成集合の比較機能である。実Systemの移行保証を既に検証できていた、と扱わない。[現在のReality Audit](../../../07_Quality/05_Current_Implementation_Reality_Audit.md)も、固定観測配列は実Consumerの実行を証明しないと区別している。

### 選択肢と推奨

| 選択肢 | 得るもの／失うもの | QAの扱い |
|---|---|---|
| 専用比較処理を試験側へ移す | 局所比較を残し、Runtime公開を減らせる。ただし本番で使わない比較処理を自分の試験だけのために維持する | 実System試験と表示しない。実移行の確認義務は未成立のまま |
| 比較処理・専用合成試験・Fixtureを撤去する（推奨） | 実行時1操作・1型と専用3Fileを退役し、不要な維持対象を減らす。合成集合の判定機能自体は失う | `RCM-ST-012`の実Consumer移行確認義務は削除せずOPENを維持。既存の実利用側・境界試験を接続し、足りない実境界を明示する |

`RCM-ST-012`のOwnerは[QA-000001](../../../07_Quality/Definitions/QA-000001/quality_definition.md)である。Version Control詳細の`contract-migration-closure`と[Quality対応表](../../../07_Quality/04_Quality_Integration.md)へ同じ処置を伝播する。古い署名経路の記述を今回の命名変更だけで現行要求へ復活させない。

利用者は比較処理・専用合成試験・Fixtureの撤去を承認した。実Consumer移行確認義務はOPENのまま残す。新しい移行Runner・Registry・永続状態・同じ比較処理の恒久的な移し先Packageは作らない。

## 7. 今回の棚卸し結果と未実施

棚卸し時点の読取り専用の技術／品質確認で、配置案とCandidate／Mergeの一方向分離は妥当と確認した。移行比較の退役と、実Consumer確認義務を分ける条件を利用者が承認した。その後、Source16 Fileへの再配置、移行比較の退役と既存試験・利用側・台帳の追従を実施した。実Git63件、関連Coordinator54件、台帳・保存境界29件が成功した。独立レビューのHeader誤記20関数を処理不変で訂正し、公開／Header／QA接続8件も成功した。最終確認結果と全体品質の留保は[変更計画](second-stage-plan.md)へ要約する。
