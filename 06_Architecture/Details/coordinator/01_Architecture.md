# Coordinator Runtimeの実行アーキテクチャ

Host操作領域のDirectory・File・descriptor識別は、WindowsのNode BigInt statが返す`-2^63 ≤ ino < 0`だけを同じ64bit列の符号なし値へ揃えてから比較・保存する。ゼロ・型不正・範囲外・POSIX負値・型・link・dev・birthtimeの既存拒否と、元操作の作成・再検証・回収条件は維持する。保存済み正値・履歴・回復参照は読み替えず、補正のための新状態・回復経路を追加しない。

[Workspace再編の目標責務](../orchestrator/03_Workspace.md#3-packageの責務と依存方向)により、本領域は単発AIの調整・取消・通知・結果返却へ縮小する。通常実行はOrchestrator経由とし、業務永続状態・Workspace／Candidate寿命・採用・Promotionを所有しない。以下の現行state・Bundle Store・workbench-ai・Host相関は移行元であり、対応能力の接続前に撤去しない。DI完成を新Workspace借用の検証済み根拠にしない。具体切替・API・Schemaは未完了。

[実行対象の引渡しとCLIの責務](../orchestrator/03_Workspace.md#実行対象の引渡しとcliの責務2026-10-18人間確認済み)に従い、Workspace選択・ID解決・Direct／Isolated選択は上位が所有する。Coordinatorは解決済み作業対象の同一性・Repository境界・Git保護・実体・Mount材料を確認して単発実行するだけで、Workspaceの検索・配置再構築・台帳読取りを所有しない。現行`BorrowedWorkspaceTarget`がWorkspace情報を含むことを、その管理責務の根拠にしない。既存のID依存照合と必要な安全確認の分離は今後のSource切替対象であり、未指定時の旧Bundle経路又は自動Direct化を残す方針ではない。

## 単発Workbench依頼の終了相関（2026-10-18、実装・検証中）

Workbench用途で上位の回復相関を持つ新しい終了要約に限り、`operation-summary/v4`へ`consumer`と`recoveryCorrelationId`を検証済み操作Identityから追加する。既存の要約要素と必要時の`dockerRestart`は維持し、要約Hash・履歴行Hash・結果IDは同じ符号化から導出する。新しい保存先は作らない。既に固定・出版したv2/v3要約は元Hashと本文を維持し、Schema更新のために上書きしない。

`observeRuntimeOwnedWorkbenchTaskCompletion`は既存の状態・履歴ReaderとKernel排他を使い、exact回復ID、workbench利用元、元上位相関、全行の正常な終了・回収条件、現在操作・未解決参照・配送の不存在とpending不存在を共同照合する。履歴欠測・重複・旧要約・相関差・Reader拒否は未解決のままであり、単なる現在一覧の欠落を終了根拠にしない。この限定観測はTask成功・採用・再実行許可ではなく、回収後の上位保存失敗から同じ依頼へ戻るための確認である。

## Workspace実行接続の切替契約（2026-10-17）

基準`135e032c`のOrchestrator現在保存・VC・Task搬送に対し、Coordinatorの借用実行を接続する。保存先Rootの単純置換、旧固定複製への借用Tree混入、旧Bundleの成功を新Git成果へ転用する変更は行わない。

| 順序・接続箇所 | 実装へ渡す条件 | 変更しない境界 |
|---|---|---|
| 1. `task/types.ts`／`task/attempt.ts` | 所属保存Rootと借用実行対象を別入力にする。IsolatedはUUID・固定配置・Base・現在HEAD・実登録・実体をVCで再照合する。Directは所属Rootの現在Treeを扱う | CoordinatorからOrchestratorへ依存しない。継続中のdirtyを初回作成条件で拒否しない |
| 2. DIの共通保護 | 通常SourceのRWと、`.git`・実Git管理領域・`.crdd`の書込み禁止を同時に成立させる。Directory型とポインタfile型、別名経路を評価する | 開発用`.env`の読取りを新たな拒否条件にしない。file別ACL・動的Mount承認・新Secret管理を作らない |
| 3. `task/execution.ts`／`repository-operation/workspace.ts` | 認可・受付・保存・回復・配送は所属Root、Providerだけ借用Treeへ接続する。借用TreeをOperation所有の一時領域として登録しない | Git Ref操作・Workspace寿命はVC／Orchestrator。Coordinator清掃はContainer・Process・自己所有の一時物だけ |
| 4. 旧capture／Review／publishの分離 | 旧Candidate capture／Bundleを要求しない新成果返却へ切替。レビュー対象の差分・基準・未確定事項を実結果と相関する | AI完了によるCommit・採用・Promotionなし。成果を保全できない箇所は旧能力の置換済みとしない |
| 5. 利用側・失敗・終了後確認 | 正常・開始前後取消・通知失敗・配送失敗・親喪失と次Taskを確認する | 一次失敗・元回復参照を維持。Task終端からTree削除・resetへ進まない |

借用実行は`/work`のbindと`.git`・`.crdd`の空placeholderのRO bindという三本構成を使用する。ExecutorはSourceをRW、ReviewerはROとし、二保護領域は常にROとする。作成計画と保存する回収Identityに同じ保護Sourceを結合し、実観測の欠落・RW化・Source差を拒否する。固定Path書込み境界の実測は[DIの限定確認](../docker-isolation/01_Architecture.md#固定path書込み境界の限定確認)に限り、全別名経路や任意Repositoryを保証しない。借用走査はlink・複数hardlink・入れ子Git・既存の容量／件数上限超過を拒否し、保証不能な対象を新しいACL等で自動補完しない。

### 借用実行の具体接続

| 所有者 | 実装契約 |
|---|---|
| Orchestrator | DirectもIsolatedも実行直前に対象を解決する。Reader拒否を旧入口へfallbackしない。所属Rootと実行Treeを別々に渡す |
| Coordinator | 既存Operationの短命な参照へ対象を結合する。開始時の実内容を差分基準とし、既存dirtyを今回成果へ含めない。外部変更との帰属は断定しない |
| Provider／DI | 借用Treeを実行先へ渡し、固定二保護領域を加える。一時placeholderは元Operationのprojectionが所有する |
| 終了・成果 | 旧Bundleの準備・保存・出版は行わない。既存のcapture／Reviewer照合だけを再利用し、想定外変更では停止して差分確認へ返す。変更は戻さない |
| 清掃 | 元Operationの一時物だけを回収する。借用Tree／Branchを所有集合へ入れず、削除・reset・commitしない。空の`.crdd` Mount先が必要な場合だけ初期化し、状態は保存しない |

Coordinatorの内部完了値は`workspaceResult`にWorkspace ID、開始後の変更Pathまたは観測不能のnull、帰属未確定、CoordinatorによるTree削除要求なしを返す。Directの`canonicalRepositoryChanged`は実観測からboolean／nullへ投影し、Isolatedの変更を所属RootのSource変更と混同しない。これは成果のGit採用や永続受領の代わりではなく、Orchestratorの既存完了・配送契約を維持する。取消・失敗後も同じ開始基準で観測する。Treeの現存を未観測のまま`retained=true`とは表示しない。

借用走査の現行上限は20,000 file・全体256MiB・単一64MiBである。依存物等も走査に含むため上限を超えるTreeは実行前拒否となる。任意の開発Treeへ適用可能とは主張しない。実Providerを使用した公開E2E・親喪失・利用者確認は、本接続の局所／結合試験と別の未実施範囲である。

変更観測は全終端処理の後の共通投影で生成する。Host清掃意図／Receipt保存の失敗等で先に返った場合も、元理由・exact回復参照・清掃結果は不変のまま、変更あり／なし／観測不能を補う。`workspaceResult`自身に`canonicalRepositoryChanged`を結合し、TaskAttemptで方式とPathの閉じた相関を検査する。必須の観測metadata欠落・別Workspaceは変更なしへ補正しない。同じmetadataをOrchestrator単発結果から、今回runのTask／Attempt／Operationに結合した`workspaceResults`へ搬送し、途中失敗やLease解放失敗でも既得観測を落とさない。これは今回runの返却情報であり、新しいdurable Stage・State・履歴Storeは追加しない。既存段階結果の参照／ACKはこの最終観測の代替としない。

正常例は同じWorkspaceで二Taskを継続する場合、非発火例は対象指定のない旧診断、境界例はIsolatedのGitポインタと既存dirty、情報不足例は実体・登録・現在HEADの観測不能である。後者はProvider Effect前に停止する。既存の複製・Bundle・取消の検証は移行元の根拠として維持し、新経路の限定代役試験・実Mount試験・実Provider試験と区別する。詳細な試験範囲と現在の承認は[変更記録](../../../99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md)へ接続する。

成果物種別: Architecture詳細設計
詳細設計領域: coordinator
状態: Candidate

Workspace新方式の情報区分・隔離は[DI共通方針](../docker-isolation/01_Architecture.md#workspace-isolation-policy)に従う。開発用`.env`がCoding AIから読まれ得るリスクの受容を、全秘密の公開・CRDDによるPrompt／logへの明示複製・本番資格の注入許可へ拡張しない。Direct／Candidateで同じ隔離方針を使い、Coordinator固有Secret管理やfile別ACLを追加しない。以下の現行秘密拒否・投影・Provider認証保護は移行元として用途別に照合し、Source切替前に一律撤去しない。

Provider計画の投影では、Proxy包装の解釈とContainer内Homeの定数生成をDIへ委譲し、元Providerと返却profileの相関だけを判定する。Seccompの適用要否と期待Hash／bytesはProvider metadataからDI計画へ渡し、固定Host Pathの解決・実体照合・option構築はDI内に閉じる。旧Coordinator側のFilesystem Resolverを再実装しない。上位の計画投影と元Runtime相関は`provider/isolation-execution.ts`、実行許可・取消・通知・結果調整は`provider/execution-controller.ts`、公開固定理由は`provider/execution-result-reasons.ts`、Taskの現在状態・排他・受領・終了は`task/recovery.ts`が所有する。旧`docker-desktop/`と`docker-execution/`は撤去し、互換中継を残さない。この配置だけから全体の技術依存除去・実境界成立を主張しない。

Task回復の技術接続はDIの固定`createDockerTaskRecoveryExecutor`へ、借用managementDirectoryと同期assertOwnerだけを渡す。CLI出所snapshot、Windows実行物、Engine、環境変数の構成はCoordinatorが保持・選択しない。返却された元executorを使い、既存finallyで元closeを呼び、config回収不明を上位状態へ保持する。回復義務の保存・現在Owner確認・受領・終了判定は引き続きCoordinatorの責務である。

隔離診断の上位調整は`diagnostics/isolation-probe.ts`が所有する。Dockerの技術実行・環境判定はDocker Isolation、Host記録の保存と遷移は既存Host Ownerへ委譲し、診断本体は順序、私有の対象相関と公開結果を扱う。旧`docker-execution/isolation-probe.ts`の互換入口は残さない。この配置変更は実行・回復本体の移管完了を意味しない。

診断ProbeのHost状態遷移は、既存`host-execution/operation-workspace-lifecycle.ts`が所有する。開始・作成前取消は同Ownerの既存遷移へ委譲し、不存在確定は元Host markerの保存・token更新・元Capabilityへの採用を同じ順序で行う。Probeは遷移結果を受け渡すだけでmarkerを直接更新しない。明示Rootを使う再入場と生存OwnerのCapability経路を区別し、新しい状態・Lock・共有管理を追加しない。この配置だけからDocker資源不存在の成立は主張しない。

Hostと診断Probeの回復token・記録codec・Filesystem保存／読取りは、既存`host-execution/recovery-record.ts`へ集約する。診断本体は同じOwnerのWriter／Readerを明示呼出しし、作成前とID確定後の二保存、fresh回復時のRoot・実体照合から技術観測への順序を維持する。WriterはDIの固定資源記述を記録するだけでCLIやEngineを判定しない。Host／ProbeのSchemaとtoken文法は別のまま、現在形式だけを扱い、Package root APIや互換中継は追加しない。

<a id="repair-directory-disposition"></a>

### 修復退避物の後続処置（採用済み・実装未完了）

明示保持の引渡し値は、新しいhandoff形だけに存在する`retention:{decidedAt,reviewAfter,targets}`とする。二時刻は正規UTC、期限は判断時刻のexact7日後で、再入場時刻から計算し直さない。targetsはDI所有の三用途Node実体／nullを復号し、元checkpointの用途別retained・expected・対応actionへ再照合する。元presentの消失や用途交換をnullへ補完しない。生実体の履歴投影は明示保持限定の非秘密metadata例外であり、Path・Owner・Scope・処置Authorityは含めない。

保持Callerは専用の引渡し候補を使い、通常更新からのreceipt導入・変更を拒否する。物理Writer・pending・履歴・completion・Caller／CLIは限定接続済みであり、旧保持候補APIと通常遷移の旧保持例外は撤去した。旧非handoffの状態・要約・履歴bytesは維持し、既出版値へreceiptを補完しない。新handoffの履歴時刻はdecidedAtへ固定する。限定接続の成功だけでは実保持物の責任引渡し・fresh Task・Package全体完成は成立しない。

保持引渡しの保存用途は`retention_handoff`に固定し、外側事前検査とKernel内検査が同じ専用全文再導出を使う。通常checkpoint・Session・回収用途への代用は拒否する。未保存pendingは同じ専用用途で再開し、既保存本文と同値の場合だけ既存`remove_pending`として短命物を清掃する。保持判断の同値再保存や期限再計算を追加しない。Caller・期限前履歴保護・終了処理への接続は別途検証する。

引渡し完了後のreceipt履歴は少なくともreviewAfter前を通常期間と無関係に保護し、期限後は既存の通常履歴整理へ戻す。未完了操作・未確認出版の参照保護は期限と独立して維持する。期限超過を保存済みreceiptの不正や永久停止へ読み替えず、期限だけで物理物を削除・延長しない。利用者は期限までに削除／延長を判断し、延長する場合は必要な照合情報も管理する。Runtimeは期限後の永久再特定を保証せず、新たな削除・延長Protocolや永久Registryを今回追加しない。

期限前保護は検査済み要約から得た読取りmetadataだけで判定し、履歴行本文・両Hashは変更しない。現在状態に保持引渡し操作と履歴参照が残る間は、確認済みでも同ID行を保護し、行の欠測は拒否する。操作除去後、期限同時刻以降は通常保持期間の判定だけに戻す。

終了候補は従来の不存在／回収済みに加え、元stale retainedかつ有効なreceipt付き明示保持を受理する。技術終端・履歴確認・同ID参照不存在などの共同条件は維持し、receipt欠測の旧保持を昇格しない。専用Readerは操作ありでは終了候補と履歴行全文一致後、操作なしでは検査済み履歴行から、期限だけを`repairRetentionReviewAfter`へ返す。拒否・通常二形はnull。Path・targetsは公開せず、期限前後で終了資格を変えない。CallerとCLIへの接続はこの下位条件だけから成立したと扱わない。

明示保持Callerは未出版の判断待ちでだけDIの固定保持先読取りを行い、判断時刻とexact7日後の期限を一度だけ保存する。保存済みreceipt・pending・未確認履歴・終了途中は元receiptのmetadata処理だけを再開し、再観測や日時再生成をしない。終了Reader前後の期限が保存値と一致した場合だけ引渡し完了とし、CLIへ非秘密の`retentionReviewAfter`を返す。retain要求で通常終了のnull期限を引渡しへ転用しない。CLIは入力exact IDとも照合し、保持・履歴・終了・正規期限・CLI解除の共同成立でexit0、未成立はexit2。操作除去後の再入場では技術再観測のflagをtrueへ補完せず、既存終了確認と期限で同じ引渡しを表示する。期限は削除／延長判断の目安であり、削除許可ではない。

修復成功後の不要な退避物は[Docker Isolationの限定回収](../docker-isolation/01_Architecture.md#修復後の退避物回収採用済み実装未完了)へ渡す。元の修復checkpoint・outcome・primaryFailure・確定済み履歴は不変に保ち、後続処置は既存`runtime_repair`操作内へ限定して保存する。判断、判断時刻、保持期限、三用途ごとの回収意図と観測を分離し、期待実体は元checkpointを参照する。新Store・共有Registry・Lockは作らない。通常Writerからの専用値偽装を拒否し、既存Owner・CAS・Writerの保存／読戻し／排他解放を処置前後で確認する。物理回収後の保存失敗は同じexact IDで再入場し、現在の不存在を確認する。元repair成功と後続回収失敗を同じ結果へ潰さない。

通常回収は、三用途すべての不存在を確認してから既存`history.jsonl`へ一度だけ記録する。別種別・別Writer・同IDの複数行を追加しない。discardの要約だけに判断時刻と三用途checkpointを含め、元要求のunknownは保持する。非discard要約の既存bytes・Hash・時刻は変えない。回収途中は要約・履歴を確定せず、確定後は回収進捗を変更しない。初回時刻・Hash固定、部分出版再入場、二重append拒否と出版確認後の終了を既存経路で確認する。旧形式の回収途中かつ履歴確定済み状態は自動補完せず拒否し、移行はフロントAIが扱う。履歴保持期限を物理回収許可や7日の保持期限へ流用しない。

通常回収では必要な全対象の不存在、既存修復要約の確定と既存終了条件を共同確認してから操作を除去する。調査用保持では判断時刻と既定7日の期限、固定対象、利用者の管理責任の引渡しが耐久確定した場合だけRuntimeの追跡を終えられる。保持用の履歴投影・Caller／CLIの限定接続は確認済みだが、実保持物と次Taskの成立は別に確認する。UTCの判断時刻を使用し、期限欠測・不正やReader前後差では引渡し未完了とする。期限到来だけで削除・延長・completionしない。保持CLIは正規期限・履歴・終了・CLI解除が共同成立すればexit0、それ以外はexit2とする。保持引渡し後の次Task開始まで同じ目標へ含め、通常回収や模擬技術境界の部分成立を全体完成としない。

回収判断の保存形は、既存操作の必須`disposal`（初期値`null`）とする。未出版の`awaiting_disposition/pending_human_decision`で修復成功・全技術終端・Native回収確認が揃う場合だけ、専用候補が`settling/discard`とUTC判断時刻・DI所有の未保存初期進捗を結合する。明示保持済み・元要約または履歴が存在する操作からは切り替えない。判断の保存を各用途の削除意図保存と同一視せず、各用途の`intent=saved`は別の進捗保存で確定する。

`disposal`は`decidedAt/checkpoint`だけを持ち、要約・履歴は既存操作直下のfieldを使用する。専用progress候補は要約・履歴がともに未確定の場合だけ、一用途をDIの遷移契約で検査し、元checkpoint・outcome・判断時刻・他操作・参照・配送を全文維持する。同値も要約確定後は拒否する。未確定時の同値は改訂・元版Hashを変えない元版bytesを返す。通常遷移は回収判断・進捗変更を拒否し、判断後は履歴の出版field以外の操作本文を凍結する。純粋な候補と検査だけでは物理保存・削除・完了は成立しない。

専用保存の接続では、既存Repair Writerの用途を通常checkpoint・Session開始・回収判断・三用途進捗へ固定し、既定値を使わない。外側とKernel内の保存／pending出版は同じ用途別再導出を要求する。pendingの分類も専用四用途を一意に識別し、再入場でその用途を私有Contextへ保持する。currentと既に同値のpendingは既存のmetadata清掃として扱い、進捗の無書込み確認から実清掃Effectを推定しない。

回収Callerは初回修復のoutcome保存後とexact再入場を同じ処理へ接続し、元修復のrecovered／未出版の判断待ちだけを専用decision保存でdiscardへ進める。順序はprimary→failed→auxiliaryとし、各用途の意図保存・読戻し・排他解放後だけDIを呼ぶ。DIの現在確認はWriter排他の外で、同じOwner・exact操作・判断時刻・用途意図と保存本文を既存Readerで照合する。Writer内のOwner callbackはこのReaderを再帰取得しない。

今回新しく意図保存を確認した用途以外では、既存not_issued／不存在未確認を新要求前にunknown／unknownへ保存して切断窓を閉じる。issued／unknownは以後巻き戻さず、fresh結果の不存在だけを更新する。一用途でも回収または保存が不明なら後続用途0とし、既に不存在確認済みの用途はDIへ再処置しない。修復履歴Readerだけは、履歴未出版でrecoveredの判断待ち／discard回収中を既存technical_stateへ分類できる。三用途settled後は既存publicationへ進める。Completionはnot_applicable＋元stale absent、discard＋元stale retained＋三用途settled、または有効receipt付き明示保持＋元stale retainedの三形とし、いずれも履歴確認済みを要求する。操作不存在後のReaderも同じ履歴契約を検査する。保持の終了候補・Readerは限定接続済みだが、Caller／CLIとHost物理回収・保持引渡し・全体完成は未成立である。

三用途進捗の未出版同値通知だけは、Context生成と物理Writerの前に既存Reader自身のKernel観測へ分岐する。同期Owner・正規元版・raw由来payloadHash・再符号化本文の一致、対象exact一件、pending／marker／未知entryなし、排他解放と返却直前Ownerを共同要求する。成立時は改訂・Hash・実体を変えず、書込みAPIを呼ばない。decision・Session・通常checkpointの同値をこの経路へ入れない。専用保存・保存再開は限定検証済み。通常discardの一回出版・終了接続は候補実装済みで、実Filesystemの限定確認も成功し、契約・品質の独立再確認は残指摘0。実退避物回収境界・保持引渡し・全体完成は未成立である。

### 現在状態の入場観測

Task起動前とCLI診断は、検査対象Repository Rootを明示して同じ現在状態Readerを使う。入場可能とは現在本文が安定して読めて排他解放も確認できたことを表し、実行資格や資源不存在の証明ではない。本文内の別操作・未解決参照・配送を理由に全域拒否せず、実Home・Host・操作が確定した後の既存begin／Writerで衝突を判定する。

専用の初回判定だけは、同じKernel排他内でRootと排他の生存、二回の明示的な領域不存在、排他解放を共同確認して入場可能とする。空の既存領域、保存途中、不正本文、未知物、観測不能、途中で領域が出現した場合は拒否する。通常Readerの不存在拒否は維持する。公開結果は有限な理由・入場可否・排他解放だけで、本文や内部回復IDを複製しない。旧AppData在庫の全域拒否は使わず、診断の可否と実Taskの開始可否を同一視しない。

2026-10-14の人間判断で、CRDD独自署名を通常Runtimeの必須条件から外した。現在の契約は[§9の三分離](#9-通常実行追跡正式配布の分離)とする。通常Task・CLI・Workbench・Orchestratorの旧Gate、専用署名Tool・配布Manifest・固定AST graphはSourceから物理撤去した。本文の旧署名方式は明示した移管前比較基準に限り、現行の完成条件へ再利用しない。撤去後の全体回帰・実境界・実Provider／E2Eは未完了であり、局所接続を全体完成の根拠にしない。

本候補は責務再編後のCoordinator詳細設計である。公開API・依存は本書、Provider固有差は[AI Adapter詳細](../ai-adapter/01_Architecture.md)、上位状態と採用は[Orchestrator詳細](../orchestrator/01_Architecture.md)が所有する。旧回復・署名方式の記述は移管前の保証と利用側を照合する基準として区別し、新配置・縮小方式の実装済み根拠にしない。未移管の保証を削除・置換済みとは扱わない。

2026-10-14に独立した[Docker隔離の技術Owner](../docker-isolation/01_Architecture.md)への分離を採用し、追加指示でDocker固有の技術処理と環境依存を下位へ集約する方針に訂正した。CoordinatorはTask／助言、選定・送信許可、Home利用許可、運用介入の承認、正本状態・結果との相関を保持する。下位の共通APIへ依頼し、閉じた事実通知から状態を更新し、必要な通知だけをOrchestratorへ伝播する。Docker開始・所有Process・exact資源回収・診断・Desktop実処理を重複実装せず、DockerのOS・配置形態を選択／判定しない。現SourceにはWindows／Desktopの型・分岐・技術実処理が残るため未移管として扱い、本番全接続・環境依存の除去を完成済みとは表示しない。

## 基本設計との関係

### 修復専用保存Ownerの接続契約（CLI候補・全体未完了）

修復Ownerは既存領域がreadyで現在Ownerが有効な場合、通常Readerの前に既存の出版marker清掃を一回だけ呼ぶ。status completed・storageConfirmed・markerAbsentConfirmed・lockReleasedとOwner再確認が共同成立してから通常Readerで本文を再取得する。清掃結果は非秘密の診断事実として返し、保存本文・修復成功・実資源不存在の代替根拠にしない。pending・不正marker・未知Fileの処置前拒否では除去0、除去後の観測や解放不明では既発生事実を保持して停止する。取消はmetadata清掃を妨げないが技術Session開始前の拒否は維持する。これは出版済みcurrentのmarkerだけの処置であり、未出版pendingの確定は後述の専用Reader／publisherで別に判断する。

`diagnostics/runtime-repair.ts`は検証済みRootと現在Revisionを固定し、DIの固定Session入口からH／Scopeを受けた同じ呼出し内でIdentity保存→初checkpoint保存→Machineを接続する。現在許可は呼出し生存・Root／Revision・未取消で確認し、準備保存済みをNative準備前の許可条件には含めない。処置先行防止はDIの`onPrepared`同期trueの順序で所有する。保存Ownerは取消から独立し、保存不明またはfinally後の再利用を拒否する。freshのSession候補とDI準備値は既存の正規JSON符号化で比較し、Property順を実体差と扱わない。二版の結果保存・出版済みmarker清掃・未出版metadata確定・明示保持判断・履歴・退避物がない現在操作の終了整理は本番修復呼出しへ接続して局所検証済み。CLI切替は次の候補契約まで実装しているが、旧経路の全撤去と実修復を含む全体完成とは扱わない。

CLIの通常明示修復は既存`--repair-docker-desktop-runtime`を維持して新compositionへ接続し、新exact IDは既存`--recover-isolation`でTask／Host／Probeより先に分類する。現在Rootを検証し、取消をsignalへ結合、finallyでlistenerを解除してから固定診断を表示する。解除不明は一次理由を上書きせず別fieldとexit2へ投影し、表示失敗から処置を再発行しない。旧close／adopt／after-repairと署名Root引数は撤去し、処置前の未知引数拒否とする。現行repair／retain／restart／recoverを維持し、旧Desktop記録3 Source・旧Inventory／回復APIは撤去済みである。実保持物・次Task・実Docker／再ログオン／E2Eの未完了は別に保持する。

再起動の上位Callerは`diagnostics/runtime-restart.ts`が所有する。検証済みRoot・同じ回復対象の許可と現在checkpointを接続し、処置はDI公開`restartDockerRuntime`へ委譲する。準備・確認・保存・解放・終了確定の5操作はCoordinator私有の現在状態接続であり、Package Rootへ再公開しない。CallerはDIのprivate module、旧Desktop記録、OS／Desktopの起動方式を参照しない。移動は処理・保存契約・公開関数名を変更せず、技術再起動とTask回復完了を区別する。

公開診断`crdd-coordinator/current-runtime-repair`は、status／有限reason／exact recoveryIdと、結果・保持・履歴・終了整理・Native回収・CLI解除の個別確認だけを固定fieldで投影する。内部のRoot・Scope・checkpoint・出版／marker objectは公開しない。getter／Proxyを実行せず拒否する。

明示保持は`doctor --retain-docker-runtime-repair <exact-repair-id> [--json]`から既存修復APIの`retain`用途へ接続する。IDは現在の`docker-runtime-repair.<64hex>.<64hex>`に限定し、JSON指定以外のdoctor操作との混在・重複・欠測を処置前に拒否する。CLIは修復／保持の用途を必須引数で明示搬送し、省略から通常修復へ落とさない。保持の開始前取消はRoot解決とAPI呼出し前に拒否し、通常修復の取消後metadata再入場は維持する。これは退避物を残す人間判断の保存であり、技術Sessionの再取得・再修復・削除を発行しない。保持と履歴を確認しても終了整理は未完了で、固定診断は「保持済み・終了整理待ち」／exit 2とする。退避物の物理引渡しや新Task資源の不存在を推定せず、既存の保持適格条件・Writer・Schemaは変更しない。

| 公開結果の分類 | 共同条件とCLIの処置 |
|---|---|
| 終了済み | observed／recovered、exact ID、履歴・終了確認true、保持false。除去済み再入場のため技術詳細を再構成しない。CLI解除も確認した場合だけexit0。 |
| 保持済み | observed／recovered、exact ID、保持・履歴・outcome・最終checkpoint・Native回収true、終了false。終了整理待ちとしてexit2。 |
| 保持判断待ち | observed／recovered、exact ID、outcome・最終checkpoint・Native回収true、保持・履歴・終了false。判断待ちとしてexit2。 |
| 停止 | recovered以外の有限reason、終了false。observed／blockedを区別し、先行保存済みの部分事実を保持してexit2。 |

明示的な修復CLI呼出しの内部で、検証済みRoot・Repository結合・現在Revision、内部生成したnonce／操作ID、exact修復Identity／回復ID、元版と呼出し生存を私有Contextへ固定する。Root借用は読取り専用のまま維持し、それだけからWriter資格を作らない。新しい永続Store／Registry／Lockは設けず、既存`settlements`の修復variantと、既存物理Writerの短期Kernel排他・CAS・読戻しを用いる。

Task専用の`dockerTerminal`や管理Capabilityを捏造しない。初期化資格とWriter引数は修復の判別分岐へ限定し、対象修復以外のTask・修復・履歴・配送を全文保全する。初期保存は、同じ呼出しが作成した領域・固定本文へ結合する既存初期化証拠を修復種別へ明示的に拡張する。保存済みJSONだけをOwnerとして扱わない。

保存途中の出版と技術処置の再開を分ける。明示されたexact修復のpendingは、現在Root／Revision・私有呼出しOwnerと既存Kernel排他の下で、固定File集合・領域／File実体・正規marker・currentの明示有無・元版revision／Hash・canonical全文を照合する。既存Repairの一遷移、新Repairの初期Identity追加、既出版と同値の重複pendingだけを既存物理Writerで処置する。現在本文とpendingから純粋モデルで再導出し、非対象操作・参照・配送・summary／historyを保持する。出版は実主体・Scopeの確認やNative実行許可を生成せず、取消済みでも現在保存Ownerが有効なら許可する。current読戻し・pending不存在・排他解放後、通常Readerでfresh本文を取得し、技術再開に必要な新Sessionの実H／Scopeと既存DI gateを別途要求する。pending内のcleanup pending／unknown・未確定intentを成功や再発行可能へ変更しない。

currentがない初回pendingは、通常初期化Ownerの復元や新品領域作成とは扱わない。現在の明示Ownerによる限定metadata出版として、exactなpendingとmarkerの二Fileだけ、revision=1／previous=null、単一runtime_repair、repairing、checkpoint／一次失敗／outcome／summary／historyはnull、disposition=not_applicable、未解決参照／配送なし、Identityと回復ID／Repository Bindingの正規相関をすべて要求する。通常Writerの新品領域・WeakMap証拠条件は維持し、この有限形だけを専用出版用途で区別する。既出版同値ではrevisionを増やさず短命材料だけを回収する。不明、別対象、複数候補やRoot／Revision変更では確定を補完しない。この限定出版は既存Writerへ接続・局所検証済みであり、技術再開・修復終了全体の成立とは区別する。

技術処置を再開しない記録確定は限定して分ける。通常Readerのcurrent確認・排他解放と同じRoot／Revisionの保存Ownerが成立し、明示したexact修復一件がrepairing／outcome=null、今回のProducerの不可逆一次失敗`stage=repair／reason=runtime_repair_effect_unknown`、checkpoint.cleanupがconfirmedまたはunknownの場合だけ、既存primaryとcheckpoint全体を不変更でblocked outcomeへ確定しsettlingへ進められる。変更はphaseとoutcomeだけとし、Identity・disposition・summary/history・他操作・回復参照・配送を保持する。Native／DI Session、Provider／Docker処置は0であり、新しい主体・Scopeの技術処置許可を生成しない。Native回収は保存済み事実であってfresh資源不存在を主張せず、結果保存確認と分離して返す。primaryなし・他分類、checkpoint欠落、cleanup pending／not_requested、保存途中またはOwner不明はこの記録確定の対象外とし、recoveredを保存値だけから導出しない。

保存Ownerの生存と、Nativeの生存・取消を別に判定する。Native喪失や取消後も、同じ保存Ownerが有効な間は当該操作の単調なunknown・cleanup・一次失敗の記録だけを許し、新intent・再発行・既知結果の置換を許さない。保存Ownerも失効した場合は保存成功としない。最終技術checkpoint後に下位のjoin済み返却を受け、cleanupと不可逆な一次失敗を同じ第1版へ保存し、最終outcomeを第2版へ保存する。既存の一次失敗は維持し、回収・protocolの失敗を一次失敗へ混入しない。第2版の保存不明では、第1版の耐久事実を保持しつつoutcome未確認を返し、技術処置や保存callbackを再実行しない。保持判断、履歴確定とCLIへの一時返却はそれぞれの既存Ownerへ接続し、下位回収を表示や任意保存に依存させない。

修復結果の分類はMachine・現在checkpoint・Native生涯結果を共同で確認する。Machine recovered、全slot終端、Engine ready、Host safe、保持状態既知、cleanup confirmed／失敗なし、protocol completedが揃い、Native側の失敗がnullまたは技術完了後の外部取消だけならrecoveredとする。技術完了後にrelease／join中の取消が届いても、成立済み技術完了をcancelledへ巻き戻さない。後着Native故障、回収不明またはprotocol失敗は成功にしない。非recoveredでは下位のfirst-wins理由を使い、Native喪失の後に利用者取消が来てもcancelledへ上書きしない。再開可能incompleteはrepairing／outcome=nullを維持する。recoveredでも未承認保持物があればawaiting_disposition、それ以外の終端結果は既存settlingへ進め、履歴・終了整理の成立とは区別する。

明示保持操作はexact修復の`awaiting_disposition`、`pending_human_decision`、recovered、一次失敗なし、全技術slot終端、Engine ready、Host safe、cleanup confirmed／失敗なしを共同要求する。候補はphaseをsettling、dispositionをretainedへ変えるだけとし、Identity・checkpoint・結果・一次失敗・summary／history・他操作・参照・配送の全文を保持する。処置前取消・保存Owner失効は書込み0、保存後取消は成立済み判断を巻き戻さない。Repairのphaseは単純な順序比較ではなく許可辺で検査し、保持待ちからsettlingへの移行と保持待ちから配送待ちへの飛越しを区別する。この値候補だけでは人間判断・物理保存・退避物引渡しは成立せず、明示入口と既存Writerへの接続を別途要求する。CLI transientの修復終了はTask配送・耐久ACKを作らない。

pendingからretainedへの判断変更は上記の専用一辺だけに閉じ、同じphaseや通常技術checkpointからの迂回、pendingから非該当への巻戻しを拒否する。同じ明示呼出しがexactな保持pendingの出版を完了し、本文確認・排他解放後の通常Readerで同ID一件・settling／retainedと全共同終端を確認できた場合は、現在Ownerを再確認し、追加保存・技術再取得なしに保持確認を返す。出版不要の単なる既保持値を新しい判断の根拠にせず、通常の重複判断は保存0で拒否する。保持確認は履歴保存・退避物の引渡し・状態除去の確認ではない。

修復の終了要約は`crdd-coordinator/repair-summary/v1`とし、既存`history-row/v2`のsummaryをschemaで判別する。Taskの`operation-summary/v2`の本文・Hash・専用関数は変更しない。discardでもhandoffでもない修復要約の閉集合はschema、operationId、operationNonce、recoveryId、identitySha256、primaryFailure、outcome、disposition、technicalとする。discard時だけ`disposal:{decidedAt,checkpoint}`を追加し、三用途の不存在確認済み値を要求する。handoff時だけ`retention:{decidedAt,reviewAfter,targets}`を追加し、明示保持限定の非Authority Node実体を条件付き投影する。technicalは九処置のintent／request／result、engine、stale、hostSafety、cleanup、cleanupFailureだけであり、Directory実体を含めない。すべての形で生Path・Owner／Scope・Task fieldを含めない。修復回復IDはnonceとIdentity Hashへ相関し、Task parserへ渡さない。

修復履歴は結果の記録であり、安全な復旧や現在状態の除去とは別である。適用条件を次に固定する。以下の候補接続は局所・実Hostの限定確認と独立再レビューを通過した。既存成功経路の検証だけから成立済みと扱わず、Docker実処置やPackage全体の完成も主張しない。

| 保存済み状態 | 履歴への処置 | 終了整理・再実行 |
|---|---|---|
| settling／recovered、一次失敗なし、全技術終端、Engine ready、Host safe、cleanup confirmed／失敗なし、保持不要または保持済み | 従来どおり成功結果を記録する。 | 退避物なし等の別の終了条件を満たす場合だけ終了整理する。 |
| settling／blockedまたはcancelled、checkpointとoutcomeあり、cleanup confirmedまたはunknown、保持不要または保持判断済み | 失敗・取消理由、一次失敗、未確定処置、Engine／Host／保持状態、回収結果を実値のまま記録する。unknownを成功・不存在へ変換しない。 | 履歴確認だけでは現在状態を除去せず、技術処置を再取得・再発行しない。 |
| 失敗結果に保持物あり・保持判断待ち | 失敗は現在状態へ保持するが、変更可能な判断を履歴へ先に固定しない。保持承認を補完しない。 | 成功時の明示保持契約を流用せず、別の処遇が確定するまで保持する。判断遷移・真正入口の接続後に履歴化する。 |
| outcome未確定、checkpointなし、cleanup pending／not_requested、元版・Owner・排他・保存不明 | 履歴保存成功を主張しない。保存済み事実とexact参照を保持する。 | 実行中や観測不能を終了へ畳まない。 |

失敗要約も閉集合で検査する。blockedは有限な非成功・非取消理由、cancelledは取消理由かつ一次失敗なし、一次失敗がある場合はoutcome理由と一致する。九処置の意図・要求・結果と前処置終端の相関、cleanupと失敗分類、staleとdispositionの相関は維持し、Directory実体・Path・Owner・Scopeを要約へ複製しない。履歴再入場は元の結果理由と実際の回収確認を返し、recoveredやNative回収trueを補完しない。履歴失敗でも先行する一次失敗を保存失敗理由で上書きせず、履歴確認fieldで区別する。除去済み再入場は成功履歴だけに限定する。履歴開始後の操作本文固定は維持し、遅延callbackでcleanup unknown等を上書きしない。後日の回復観測を過去Attemptの成功へ書き換えず、未解決状態の処置は別の現在観測と終了契約で扱う。

summaryHashは末尾LF付き要約本文、lineHashは初回の正規UTC時刻を含む末尾LF付き履歴行へ結合する。初回はconfirmed=falseを現在状態へ先に保存し、時刻・両Hashを以後固定して、物理読戻し後だけtrueへ進める。通常修復Writerは履歴更新を拒否し、専用用途だけが元版から再導出した候補を既存物理Writerへ渡す。未確認行は期限外でも保護し、確認済み行が期間整理後に欠測した場合は再追加しない。この要約は物理保持物の引渡し台帳ではなく、引渡し責任が未確定なら操作を除去しない。履歴値候補・物理出版・fresh再入場・状態除去の成立は別々に検証する。

履歴の保存処理はTask／修復の種別固定入口から既存の私有`current_history` Contextへ結合する。Readerがexact操作から確認した種別、Identity内operationId、現在RepositoryのoperationIdをWriterの排他内で再照合し、候補再導出・JSONL出版・最終読戻しの三箇所すべてで種別別の値関数を使う。修復でTask配送Readerへfallbackせず、TaskのACKや管理資格を流用しない。保存Ownerは現在Root・Revision・同じ呼出しの生存へ結合し、保存済みJSONだけから資格を復元しない。新しいStore・Lockは追加しない。保存部の有限再入場、故障・差替え、対象外保全は局所検証済みである。本番修復呼出しへ次の接続を実装した候補を検証中であり、実ファイル試験の完了、操作除去、CLI切替および実修復を含む全体完成とは扱わない。

| 本番呼出しの境界 | 契約 |
|---|---|
| 履歴未開始の技術状態 | 専用Readerがexact対象の`repairing`、outcome／summary／history=null、正常な履歴全行、同ID行なし、履歴pendingなしを確認した場合だけ`technical_state`と分類する。分類自体はNative許可やWriter資格ではない。 |
| 未出版metadata | Readerがblockedでも排他解放が確認できた場合だけ、既存の厳密な修復metadata出版を一度試みる。出版確認・排他解放・現在Ownerの再確認後、専用Readerで再分類する。blockedから技術処置へ直接進めない。 |
| 履歴の確定 | 現在本文から候補を導出し、履歴checkpointと出版を最大二回の保存で進める。各保存後にfresh読取りを要求し、Identityの変化、保存不明またはOwner失効では後続保存を止める。 |
| 観測済み事実の返却 | outcome、保持判断、履歴、Native回収、出版および排他解放の確認を別々に返す。後続の履歴失敗によって先行する結果保存や保持確認を未確認へ戻さない。 |
| 個別回収と集約回収 | 同呼出しで確認したNative回収成功を、別の観測資源を含むcheckpoint cleanup unknownで巻き戻さない。fresh再入場では集約unknownからNative成功を復元しない。 |
| 保持判断後の再入場 | 保存済みの保持判断を新しい人間判断として扱わず、履歴だけを再開する。技術Sessionと通常の保持保存を再発行しない。 |

本番修復compositionは、保持物がない履歴確認済み修復だけを終了保存へ接続する。exact再入場の前置Readerが終了候補または除去済み状態を確認した場合、その呼出しは終了保存・marker清掃・fresh除去確認だけに閉じる。各境界の保存・解放・現在Ownerを共同確認し、不明後はsticky停止して履歴／技術処置へ戻らない。前置Readerのblockedかつ解放済みだけでは技術処置を許可せず、既存の履歴Reader／厳密metadata出版による別の証明を要求する。終了確認・Effect・排他を個別に返し、履歴・outcomeの先行確認を保存失敗で失わない。除去済みのfresh再確認では、exact ID・履歴確認・終了確認・marker／排他と固定回復理由だけを返し、技術checkpoint・Native回収・outcome詳細を履歴から復元しない。実Hostの新切断点と既存履歴五切断点の再回帰は局所成功しており、CLIの配線試験と実Docker修復・全体E2Eは別の成立範囲とする。

退避物がない修復の終了候補は、履歴確認済みのsettling／recovered、一次失敗なし、九処置終端、Engine ready、Host safe、cleanup confirmed、stale absent、disposition not_applicable、CLI consumerと同IDの回復参照・配送不存在を要求する。対象操作一件と版相関だけを変更し、他操作・参照・配送を全文維持する。通常更新の暗黙除去拒否とTask completionは変更しない。純粋候補・物理保存・本番呼出しへの接続を局所試験と限定レビューで確認した。保持済み退避物の処遇は別の人間判断を待ち、この候補からフォルダ削除を許可しない。

物理終了接続は既存`current_completion` ContextとWriterを種別固定で共用する。Task wrapperと既定種別は変更せず、修復専用wrapperからだけ修復候補・修復履歴行をReaderと排他内Writerで再導出する。修復では除去前にもexact履歴行の存在と全文一致を必須にする。Taskの期間整理後の履歴欠測許容は変更しない。状態rename前のexact pendingは同候補として再開でき、rename後の対象除去済み状態は、同ID／nonceの操作・回復参照・配送がなく、同exact修復のcanonical履歴行がstale absent／not_applicableで、短命pendingがない場合だけ読取り専用の`repairCompletionAbsent`を返す。markerは既存清掃で処置しfreshに再確認する。履歴欠測または不明を除去済み根拠にせず、新しいtombstone・Store・Lockを作らない。本番修復呼出しへ接続し、CLIの配線・公開結果を限定検証した。実Docker修復の成功はこれらから推定しない。

同じ修復のfresh準備は、phase=`repairing`、outcome／primaryFailureがnull、既存cleanupがconfirmedかつcleanupFailureがnullの場合だけ、下位のSession開始候補を専用Writer用途で保存できる。同じRoot／Revision／主体／Scope・exact回復ID・元版を照合し、cleanup以外の変更を拒否する。通常checkpoint用Writerはこの巻戻しを受理しない。未確定の一次失敗を消す経路や、終端済み操作を再起動する経路にしない。

再開可能なEngine観測不明や準備中断は、今回の診断・技術観測と、既存の循環する運用履歴へ保持し、操作全体の不可逆な一次失敗へ自動昇格しない。`primaryFailure`は再発行不能なEffect不明等の最初の終端失敗に限定する。再入場可能な中間返却では`repairing`／outcome=nullを維持し、failed-launchの期待された追加四処置を失敗終端にしない。失敗／取消履歴の候補接続は局所・修正版実Hostと独立再レビューで限定確認済みである。後日の回復観測、保持物処置と失敗操作の終了整理は未完了であり、履歴確認や返却表示だけでこれらを完成としない。

未リリースの`runtime_repair` IdentityはNativeのprincipal identity hashを`ownerBindingSha256`として保持する。既存Taskおよび移管前の修復記録の`localUserBindingHash`はtoken／認証Sessionを含む別計算であり変更しない。新修復Identityは旧keyを受理せず、同じ正規JSONからIdentity Hashと回復IDを算出する。相関値だけをWriter資格として扱わず、同じ呼出しの現在Ownerと既存Writerの元版・読戻し・排他確認へ結合する。

| Architecture定義 | この領域が具体化する責務 | Relation状態 |
|---|---|---|
| [ARCH-000004](../../Definitions/ARCH-000004/architecture_definition.md) | Orchestratorまたは単体利用側から公開APIでTaskを受け、Provider・Process・Containerの実行lifecycleとexactな結果を返す。 | Partial |
| [ARCH-000008](../../Definitions/ARCH-000008/architecture_definition.md) | Provider、Process、Docker、結果搬送の各phaseを診断可能にし、推測せず故障境界を返す。 | Covered |
| [ARCH-000010](../../Definitions/ARCH-000010/architecture_definition.md) | AI Adapterの適格性・計画を利用し、選定根拠、短命Grant、実行許可と再選定条件をEffect前に固定する。 | Partial |
| [ARCH-000014](../../Definitions/ARCH-000014/architecture_definition.md) | 独立した読取り評価との責務境界を保持する。v0.22では利用者Trust Policyの有効化・Provider起動接続を要求しない。 | Partial |
| [ARCH-000015](../../Definitions/ARCH-000015/architecture_definition.md) | 外部送信同意、Provider Effect、結果帰還、Review、Candidate dispositionを別Authorityとして処理する。 | Covered |

Relation状態は、この領域が担当する責務断面に対する状態である。複数領域で同じARCH-IDを実現する場合、各領域の断面を合成して基本設計全体を閉じる。

## 詳細成果物の適用判断

| 詳細成果物 | 判定 | 理由 | 正本節／成果物 |
|---|---|---|---|
| Component Model | Required | Runtime Core、Provider Adapter、Process Controller、Recoveryを分ける。 | [§2](#2-現行profileと公開入口) |
| Interface Model | Required | 実行要求、外部送信Authority、候補結果の境界を固定する。 | [§7](#7-authorityと外部送信) |
| Data Flow | Required | Task PacketからProvider結果、Review、候補帰還までを追跡する。 | [§3](#3-一般taskの主シーケンス) |
| State Model | Required | Task、Attempt、Process、Container、Review、Recovery状態を分ける。 | [§4](#4-状態と遷移) |
| Sequence | Required | 選定、許可、Provider Effect、結果搬送、cleanupの順序を固定する。 | [§3](#3-一般taskの主シーケンス) |
| Failure／Recovery | Required | 取消、親喪失、Docker停止、Effect不明から同じIdentityへ再入場する。 | [§11](#11-取消と回復) |
| Deployment | Required | 選択Checkout／Packageの固定入口、必要Artifact、Provider Home、Container、Host helperの配置を示す。 | [§2](#2-現行profileと公開入口) |
| Observability | Required | Provider境界の各phaseと終了後資源を相関して診断する。 | [§13](#13-検証接続) |
| Security Boundary | Required | Provider Credential、外部送信同意、現在の用途別実行許可、必要Artifact同一性を分離する。 | [§7](#7-authorityと外部送信) |
| Implementation Structure | Required | Provider／Process／Recoveryの差分軸、生成・選択、状態依存、構成および資源Ownerを固定する。 | [§16](#16-implementation-structure) |

`N/A`は未検討を意味しない。対象外にできるArchitecture上の理由を記載する。

## Engineering Concern評価

| Concern | Result | Rationale | Evidence／Related ID |
|---|---|---|---|
| Concurrency | PASS | Task、Attempt、Queue、ProcessのLock順序と世代を固定する。 | [正本節](#6-lock順序) |
| Timing | PASS | Provider待機、取消、Process終了、cleanupを別の有界待機として観測する。 | [正本節](#11-取消と回復) |
| Resource Lifecycle | PASS | 子Process、stream、Container、候補、一時領域をTask／Attemptへ結ぶ。 | [正本節](#5-資源所有) |
| External Boundary | PASS | Codex、Claude、Docker、OS Process、Filesystemへ診断可能なAdapterで接続する。 | [正本節](#13-検証接続) |
| Failure／Recovery | PASS | 要求、受理、開始、結果、終了、cleanupを別状態にする。 | [正本節](#11-取消と回復) |
| State／Consistency | PASS | Task、Attempt、Process、Container、Review、Recovery状態を分ける。 | [§4](#4-状態と遷移) |
| Observability | PASS | Provider境界の各phaseと終了後資源を相関して診断する。 | [§13](#13-検証接続) |
| Security／Trust | PASS | Provider Credential、外部送信同意、現在の用途別実行許可、必要Artifact同一性を分離する。実装と実測の成立は別に評価する。 | [§7](#7-authorityと外部送信) |

結果語彙は次の意味に限定する。

- `PASS`: 詳細設計上の処置と根拠節が揃った状態。実装済み・試験済みを意味しない。
- `N/A`: Architecture上、そのConcern自体が存在しない状態。未検討や後工程送りを意味しない。
- `OPEN`: 未解決の設計事項が残る状態。
- `FAIL`: 必須設計と矛盾する、または必要な設計が未充足の状態。

## Qualityへの引渡し

| 導出キー | 設計項目種別 | 対象 | 正常条件 | 反証する失敗 | 主な試験段階 | 外部境界の段階 | 観測 | 終了後条件 | 未確認 |
|---|---|---|---|---|---|---|---|---|---|
| `coord.advice-code-mode-host` | Interface／Sequence／Failure-Recovery | §7.5.1の公式CLI・Host、stdin入力、Docker隔離 | 未改造の公式配布と公開設定で助言結果を搬送し終了後確認まで到達 | 実行物欠落・差替え、起動失敗、不正通知・複数結果、取消・親Process喪失後の残存 | IT／ST | IT: Related 2 Blocks<br>ST: System/E2E | 配布Hash、構成、通知分類、結果、終了後の資源観測 | 所有資源不存在またはexact回復義務保持。観測不能は成功にしない | 公式CLIの公開経路、失敗・取消反証および実Provider E2E |
| `coord.provider-selection` | Interface／Implementation Structure | Task属性、Provider／Model構成、Home、Trust結果 | 利用可能性・Policy・Trustを満たす計画だけをEffect前に固定 | 不正Home、未信頼Runtime、利用不能Modelの選択 | IT | Direct Boundary | 選定理由、再選定条件、Trust結果、Effect 0 | Provider Process未開始 | 実Provider／実Homeを使う結合確認 |
| `coord.provider-attempt` | Sequence／Failure-Recovery | Task／Attempt、送信Authority、Provider Effect、Reviewer結果 | 同じIdentityで結果または理由別停止へ到達 | 承認不足、sandbox拒否、CLI exit、無許可送信、生結果の直接採用 | IT／ST | IT: Related 2 Blocks<br>ST: System/E2E | phase診断、exit、送信範囲、候補状態 | Process／stream／Container回収、未採用候補隔離 | 実Providerによる双方向経路と候補Review |
| `coord.signed-promotion` | Data Flow／Sequence | 任意正式配布のDistribution Root、Manifest、署名結果、staging（通常Runtimeの必須条件ではない） | 採用した配布範囲を一つの固定Snapshotとして署名し、競合なくpromotion | Root差、対象漏れ、別Snapshot混入、配置途中失敗 | IT／ST | IT: Adjacent 1 Block<br>ST: System/E2E | Manifest hash、Snapshot Identity、staging／promotion状態 | 失敗候補は正式配布不可、staging義務を保持。通常実行の許可とは独立 | 任意正式配布として適用した場合のRelease署名とpromotion |
| `coord.task-recovery` | State Transition／Failure-Recovery | exact Task／Attempt／Recovery Identity | 取消要求後の終了状態を観測し、同じIdentityへ再入場 | Effect不明の再発行、別Task混入、要求受理だけの完了化 | IT／ST | IT: Related 2 Blocks<br>ST: System/E2E | 状態、資源、Recovery Identity | 不存在確認または義務保持 | 実Processの取消・競合完了・再入場 |
| `coord.docker-repair-handoff` | Sequence／Failure-Recovery | repair／restart／handoff IdentityとHost資源 | 旧Effectを再発行せず、現在状態をfresh観測して同じ義務を継続 | stale socket残存、旧Runtime Effect再発行、別Session混入 | IT／ST | IT: Related 2 Blocks<br>ST: System/E2E | Operation状態、Process／socket、Engine readiness、handoff chain | 不存在またはexact義務保持 | 実機停止・修復・再起動・別Runtime引継ぎの正式E2E |

## 現行実装との照合

現行Sourceと既存試験は本詳細設計の正式入力ではない。本設計候補を固定した後、成立済み能力を失わないよう`Covered`、`Partial`、`Missing`、`Legacy`または`Implementation Detail`へ分類する。

担当責任者: Qual-Lab
最終更新日: 2026-10-07

## 1. 文書責務

本書は、Agent Organizationを実行するReference Runtimeとして、Coordinatorが依頼、Authority、Provider、候補、取消、回復および結果をどう接続するかを定義する。Role、Independent Review、Cost、Human Boundary等の上位原則は[Agent Organization](../../../04_Agent_Organization.md)、利用手順は[Workflow](../../../19_Workflows/01_Coordinator_Runtime.md)、具体的な利用者向け挙動は[振る舞い仕様](../../../05_SPEC/01_Behavior_Specification.md)が所有する。

実装は[40_Develop/coordinator](../../../40_Develop/coordinator)、Windows固有境界は[platform-access](../platform-access/01_Architecture.md)、検証義務は[検証設計](../../../07_Quality/03_Verification_Design.md)へ接続する。

## 2. 現行Profileと公開入口

### 内部ブロック図

以下は再編後の主要責務を示す。Sourceは`src`直下の用途別Directoryへ配置し、権限判断だけを`authority/`へ置く。`src`配下は2階層までとし、`core/`、`security/`、`composition/`、`internal/`を汎用の置場として残さない。基準版の全数配置は[旧配置対応表](../../../99_Roadmap/Changes/CHG-000082/Evidence/261007_coordinator-source-layout-plan.md)、今回の移管は[全File棚卸し](../../../99_Roadmap/Changes/CHG-000082/Evidence/261007_develop-file-inventory.md)で追跡する。

| Source Directory | 所有する責務 |
|---|---|
| `cli/` | 引数、対話入力、表示、CLI取消と用途の振り分け |
| `task/` | 一般Taskの受付、Executor／Reviewerの実行調整、現在Runtimeへ接続する開発計測 |
| `provider/` | Provider選択Grant、Home、Mount、共通実行接続。固有コマンド・出力変換・Model差はAI Adapterへ移す |
| `external-send/` | 外部送信の同意、許可、一回消費と出口制御 |
| `authority/` | Grant、事前許可、Trust読取り、秘密情報拒否の判断 |
| `repository-operation/` | Repository／Workspaceと操作Ownerの結合 |
| `host-runtime/` | Host資源、固定子Process入口、端末、共有する実効排他 |
| `docker-runtime/` | TaskのDocker隔離実行と資源回収 |
| `docker-desktop/` | Docker Desktop／Engineの明示運用処置 |
| `platform-access/` | Native／Platform Provisionerと保護配布閉包への接続 |
| `state-storage/` | Coordinator現在状態のSchema・遷移・保存Owner。共有保存primitiveはDomain Modelへ移す |
| `candidate/` | 候補本体の保存、確認、回収とNative接続 |
| `orchestrator/` | 廃止する配置。上位状態・Queue・判断・採用・CompositionはOrchestrator、共通保存部品はDomain Modelへ移す。下位Task・資源回復は対応するCoordinator責務へ残す |
| `workbench-ai/` | 助言・変更候補Mode、送信確認、一回Packet、実行・取消・共通結果。Provider固有計画・出力抽出はAI Adapter、画面・依頼受付はWorkbench Serverへ移す |
| `diagnostics/` | 環境、配布物、実行時間の診断 |

`src/plain-data-snapshot.ts`は純粋な値取込みを所有する。公開Symbolは必要操作と検査へ限定して`src/index.ts`に集約し、型だけのファイルは`types.ts`とする。通常Runtimeから実装依存を持たない検査・E2E補助は`scripts/`、試験と試験専用支援は`tests/`が所有する。旧配置変更の完了根拠と今回の責務移管は区別する。

同じ制御参照への取消搬送、元の完了待機と監視解除は`task/task-completion-observation.ts`が所有する。開始通知の登録・重複抑止と登録先の待機は`task/task-attempt-runtime.ts`が所有し、Handle返却時に上位状態を更新しない。取消の返値・失敗を資源回収の根拠にせず、元の完了通知を待ち、完了拒否は観測不能として上位へ返す。上位Attempt・Revisionの相関と状態保存は登録先が所有し、この共通処理へ持ち込まない。

`task/task-attempt-runtime.ts`は単一Taskの開始・完了結果の形、既知のEffect前拒否、取消・回収結果を検証し、Operationに対応する閉結果を返す。Workbenchの候補実行と上位実行Adapterはこの同じ処理を利用する。共通処理はProject、Attempt、上位判断権限またはRevisionを所有せず、Orchestratorをimportしない。上位Adapterはこれらの相関入力をEffect前に検証し、共通結果へ上位Identityを結合する。WorkbenchではRootとRevisionの観測、ProfileとPath選択、Capability発行・失効を既存の候補実行Ownerが保持する。

Task専用公開入口は`task/index.ts`であり、旧上位公開Adapterを推移的に読み込まない。上位AdapterはOrchestratorの`src/task/single-task-adapter.ts`へ移した。Coordinatorルートは共通Task操作・結果型とNode実行条件だけを公開し、上位業務操作の再exportを撤去した。MCP配布入口とWorkbench状態観測はOrchestratorの業務公開入口を直接利用する。Project業務CLIもOrchestratorの`src/cli/project-command.ts`へ移し、配布入口が同じコマンドを配送する。単体binと内部CLIは業務Moduleをimportしない。全利用側・保存Root・残る親Directoryの切替は未完了であり、公開面の撤去だけを全体依存境界の完成とは扱わない。

同入口は既存のProcess世代参照、回復参照の生成・照合、終了不明時の実行停止操作も公開する。Process安全状態は従来のHost Ownerが一つだけ保持する。Orchestrator向けの時刻・識別子組立てとRepository結合の回復Adapterは上位へ移し、CoordinatorにProject固有のPort型を残さない。これらの公開を新しい外部Transportや回復Authorityの発行へ拡張しない。

Docker回復入口はCoordinator所有の固定操作だけを公開し、OrchestratorのTask状態を読み込まない。上位の確定世代・Task・Attempt・Operation・回復参照と耐久応答の一致は、Orchestrator（改名後のOrchestrator）の`src/task/docker-recovery-settlement.ts`が照合する。同ファイルと保存基盤は上位Ownerへ物理移管済みであり、残る本番組立ての移管は別に確認する。下位の応答確認・終了整理は既存の内部Runtime所有操作へ委譲する。この二操作を下位公開入口から直接公開せず、Root、観測器や実行器を呼出し側から渡す入口も追加しない。

```text
単体CLI / Orchestrator / Workbench Server
                   ↓ 公開API
               Coordinator
  ├─ Task / Review / Advice Mode
  ├─ 外部送信 / 実行許可 / Home・Mount
  ├─ 候補本体 / 現在状態 / 資源回復
  ├→ AI Adapter：Provider計画・出力変換
  ├→ Domain Model：保存・設定部品
  ├→ Platform Access：OS観測・保護原語
  ├→ Version Control：許可済みSnapshot読取り
  └→ Execution Intelligence：下位実行事実

Coordinator ─×→ Orchestrator / Workbench Server / MCP Server
任意の正式配布署名・検証補助（scripts/）→ 配布対象の検証（通常実行の許可から独立）
```

矢印は主要責務の接続であり、Source上の全importや実行順序を定義しない。各操作のAuthority・回収順序は後続節に従う。検証付き再起動は、選択Checkout／Packageの固定公開入口、必要Artifact同一性、現在の介入許可、実機停止、修復、再起動、Task回復までを同じRecovery Identityで検証して初めて完成とする。署名成功をこれらの根拠にしない。

現行Profileは`local_personal`である。利用可能な公開CLIは次の閉集合に限定する。

| command | 利用目的 | 主なEffect |
|---|---|---|
| `task --request-stdin --json` | 一般Taskの委譲・独立確認・限定是正 | Provider送信、隔離候補作成 |
| `doctor` | 診断、Docker Task回復、Docker Desktop最終復旧 | 既定は観測。明示復旧だけ限定Effect |
| `capabilities --json` | 現行Profileと公開Capabilityの機械確認 | Effectなし |

Local Personalは永続的なRuntime有効化状態、Platform Provisioningまたは事前Activation Recordを持たない。削除済みの有効化・無効化・準備commandは、parser、help、実装、互換shimまたは失敗専用入口として残さない。

利用者向けの安定入口`template/tools/crdd-coordinator.ts`は薄い配送を所有する。Task／doctor／capabilities／candidateは同じ改訂版の`bin/coordinator.ts`へ、既存project操作はOrchestrator公開APIへ接続する。Coordinator libraryへ上位依存を残すための転送ではない。通常入口は用途、Node版、stdioと引数を確認し、同じProcessで対応する処理へ接続する。binはcoordinator.ts一つを維持し、新しいShell、cwd変更、stdio横取りまたはsignal ownerを作らない。MCP Serverは独立入口から同じ下位・上位公開APIを利用する。

### 2.1. 公開操作の対象と実装対応

現在の公開indexは上位Project操作を再exportしており、次の下位操作を再編後の公開面へ接続する必要がある。内部関数の一括exportではなく、必要なAuthority・Result検査を備えた閉じた操作に限定する。開発用factoryはtests／scriptsからのみ利用し、本番公開面へ追加しない。

| 公開する操作 | 現在のSymbol・境界 | 入力・結果とEffect |
|---|---|---|
| Task開始 | `startRuntimeOwnedCoordinatorTask` | 検査済み要求、検証済みRepository、現在の用途別実行許可、上位相関参照 → Operation・取消用control・完了結果。CRDD署名Capability引数・消費Gateは撤去済み。Process停止条件と要求・送信許可・隔離の確認は維持する。 |
| Task取消 | `cancelRuntimeOwnedCoordinatorTask` | 同じcontrol Capability → 取消要求の受理。実停止・cleanup・最終結果は対象Taskの終了経路で別に観測する。 |
| 助言／変更候補 | 既存Workbench AI Mode Router、Dispatch、Runtime Packet | 一回送信確認、Profile・Task・Projection結合 → 助言または隔離候補。画面受付・Profile管理とProvider差は所有しない。 |
| Workspace成果の確認 | 上位が解決した作業Treeと一時Review投影 | Coordinatorは変更範囲とReview結果を返す。候補固定・Git統合・領域終了は上位操作であり、旧Store APIは公開しない。 |
| 診断／exact回復 | 既存doctor・Task回復の意味操作 | 現在Repository・Runtime結合、exact参照、必要な介入承認 → 診断・資源終端または未解決。新しいProvider依頼を発行しない。 |
| 配布物の読取り検査 | 既存Manifest・閉包・Native検証は分解対象 | 必要なArtifact同一性確認は専門Ownerへ、正式配布の真正性は必要時のRelease検査へ分ける。検査結果から通常Runtime用の一回Capabilityを発行しない。 |
| 保存用Host排他 | `host-runtime/index.ts`から既存`acquireRuntimeOwnedOrchestratorStateKernelLock`を公開 | 上位が確認したRootのHash → 保持確認・解放handleまたはnull。既存OS名前空間と取消・終了確認を維持し、Project状態・履歴・業務Writerは読み込まない。HashをRoot確認やAuthorityへ昇格しない。 |

APIの具体的な型・呼出し点・利用側全数は棚卸しの関数単位対応へ接続する。通常入口の旧署名Gate引数・発行・消費は撤去済みだが、専用静的検査・任意署名Toolは物理撤去済みで、必要Artifact同一性の全体回帰とQA全数照合・実Provider境界はOPENであり、現在の内部関数が存在するだけで公開能力の完成としない。

<a id="coordinator-task-notification"></a>

### 2.2. Coordinator所有の通知と上位処置

| 通知の意味 | Coordinatorが保証する内容 | Orchestrator等が別に確認する内容 |
|---|---|---|
| 開始 | exact Operation・Task役割・Providerと、検証したProcess開始観測を結ぶ。要求発行・Handle返却とは区別する。 | 自分のAttempt・世代・Authorityへ結合し、上位状態を保存する。 |
| 終了 | Provider結果、Process終了、資源回収、Effect状態、一次失敗と後続失敗を区別する。 | 結果の相関・保存、統合・受入、Queueとslotの解除。 |
| 取消 | 同じ操作の要求受理と実停止・回収を区別する。登録と取消の間の競合を再観測する。 | 通知／Promise完了からcancelledや受入を推定しない。 |
| 通知失敗・遅延・重複 | 同じOperationの失敗として保持し、別操作へ付け替えない。終了後に新しいEffectを発行しない。 | 旧Attemptを更新しない。保存失敗と下位cleanup不明を別に残す。 |

通知型・ハンドラー登録はCoordinatorが所有する。下位から上位型をimportせず、公開要求へ用途限定のハンドラーを登録する。通知本文は秘密、生Provider出力、任意Path、Authorityを含めない。ハンドラーの完了を上位の耐久保存完了へ読み替えず、通知失敗で最初の失敗をcleanup理由へ上書きしない。汎用Event Busや新しい通知DBは追加しない。

開始通知は、既存Docker Process ControllerがProvider接続用Docker CLIのHost Process開始を観測した時点から搬送する。制御Handle返却、Container内AIの起動、要求受理またはProvider Effect完了とは同一視しない。Taskごとの登録先へ渡し、共有の診断Reporterを差し替えない。上位の登録Operationと下位で生成したRuntime Operationを区別し、登録した呼出しの相関を保持する。

初回Executor開始の登録ハンドラーを待機してから同じ実行を継続する。通知がfalseまたは例外となった場合は、既存の開始観測失敗・取消・回収経路へ収束させる。取消監視はハンドラー待機より前に登録し、取消要求の返却で元の完了待機を切り離さない。Reviewerの開始は別の下位実行観測であり、上位Task開始の二重通知にしない。未登録のCoordinator単体利用は既存の実行契約を維持する。終端後は呼出し単位の登録参照を解放し、遅延通知で新しい呼出しを更新しない。Source搬送と登録先保存・取消の局所反証は接続済みであるが、全本番組立て・実Provider境界・保存方式切替の完了は別に確認する。

### 2.3. Task操作の型・呼出し点と移管順序

Taskの既存型契約は`startRuntimeOwnedCoordinatorTask`の引数・戻り値と`cancelRuntimeOwnedCoordinatorTask`の引数・戻り値を基準にする。開始結果は`status: started`、同一Process内の不透明な`controlCapability`および`completion`を持つ。開始結果の返却はProvider開始・完了・資源回収の証明ではない。取消は同じcontrolだけを受理し、取消結果とは別に元の`completion`を待つ。controlをJSONへ保存・外部公開せず、新Processの回復参照の代用にしない。

| 現在の呼出し点 | 再編後の担当と接続 | 保持する契約・確認 |
|---|---|---|
| `cli/coordinator-command.ts`のTask処理 | CoordinatorのCLIから下位公開Task操作へ接続 | Runtime検証とRoot確認、開始拒否、Signal登録、完了待機、Signal解除、最終結果を保持する。単体利用にOrchestratorを要求しない。 |
| `workbench-ai/workbench-ai-change-candidate-runtime.ts` | Coordinatorの候補実行処理から同じTask操作へ接続 | Workbench受付は上位へ分離しても、候補生成時のTask開始・取消・回収は重複実装しない。正本採用・Commit・Pushを発行しない。 |
| `orchestrator/orchestrator-composition-root.ts`の`productionExecutionDependencies.startTask/cancelTask` | Orchestratorの本番構成からCoordinator公開入口をimport | 下位から上位へのimportと旧署名実行Capabilityの発行・失効を撤去する。現在の実行許可、Task取消、上位結果保存、slot解除の責務を混ぜない。 |
| `scripts/verify-signed-general-task.ts` | Coordinatorの検証スクリプトから同じ公開Task操作へ接続 | 本番と同じ開始・取消・完了境界を検証する。開発factoryだけの成功を公開入口の成功にしない。 |
| `tests/fixtures/*poison-probe.ts`等の拒否試験とTask契約試験 | Coordinatorの試験から新公開入口または用途限定の試験入口へ接続 | 無効Capability、終了後control、Process利用不能状態の拒否を保持する。開発用Task factoryを本番公開入口へ追加しない。 |
| `platform-access/platform-provisioner-package-filesystem.ts`のTask Symbol照合 | Coordinator配布閉包の照合として維持し、Native OS処理と混同しない | Symbol文字列・実行入口・配布物の対応を更新する。名前が一致するだけで本番接続済みとはしない。 |

呼出し順は、①検証済みRoot・要求・現在の用途別実行許可・固定入口と必要Artifact同一性、およびCoordinator所有の通知ハンドラーを確定して同じ開始呼出しへ渡す、②通知登録を検証した上でTaskを開始、③同じcontrolへ取消を結合、④用途限定の開始・終了通知を受ける、⑤元の`completion`と資源終端を確認、⑥上位が自身の結果を保存・読戻し、⑦通知／Signalを解除して公開結果を返す、とする。署名／Hash一致だけから許可を生成しない。開始前の取消は新Effectを発行せず、通知登録の不正は開始前に拒否し、開始後の通知処置失敗は取消と完了待機を行う。遅延・重複通知は同じAttemptの処置に限定し、保存失敗でProviderを再実行しない。

新しい公開型はCoordinator側の`types.ts`へ置き、開始結果・取消結果・終了結果・通知本文を区別する。型名の変更だけで結果fieldを削除せず、実装移管時に既存の相関条件を照合する。現在のTask関数Headerには外部Effectを持たない旨の記載があるが、本体は実行開始・取消を発行するため設計と一致しない。段階5では入口の移管と同時にHeaderを是正し、Header検査の成功だけを意味妥当性の証明としない。

この表はTask開始・取消の実Consumer集合の対応であり、Workspace候補、診断、任意配布検証と旧署名Gate撤去の全Symbol対応を代替しない。未署名通常入口の実装・本番接続・回帰・必要な実Provider E2Eは段階5〜7で確認する。任意配布署名は別の適用範囲で確認する。

### 2.4. 候補・診断・配布検証と旧署名Gateの公開境界

既存の内部exportをすべて公開APIへ昇格させない。利用側に必要な意味操作と、Coordinator内部だけで用いる保存・Authority部品を分ける。

| 既存Symbolと実利用側 | 再編後の境界 | 保持する意味・処置 |
|---|---|---|
| 旧Candidate Bundleの保存・読取り・公開・破棄・Store回復 | 専用API・実体・Native受付を撤去 | Worktreeの生成・観測・明示終了は上位とVersion Controlが所有する。Coordinatorは解決済み対象を借用し、Task完了でCommit・Merge・採用・Worktree削除を発行しない。 |
| `runDoctor`、`dispatchDockerDesktopRepairDoctorCommand`：診断CLI | Coordinatorの診断／明示介入操作 | 読取り診断とDocker停止・再起動等のEffectを分ける。診断呼出しだけで修復を発行しない。各介入の承認・現在Scope・終了観測を保持する。 |
| 旧署名資格の発行 | API・状態とも撤去済み。現在の通常利用側なし | 現在認可・固定入口・必要Artifact同一性はそれぞれのOwnerで維持し、Hash Capabilityや常時成功の代替Gateを作らない。 |
| 旧署名資格の消費・失効 | 発行側と一体で撤去済み。現在の通常利用側なし | 用途別Grant・取消control等の現在の許可と失効は維持し、保存結果や任意配布署名から通常実行許可を復元しない。 |
| 旧Package検査・署名候補検証・Store testing factory | 専用APIは退役済み | 現行の固定入口・必要Artifact観測は各Ownerで維持し、任意Path検査や試験factoryを一般Task Authority入口へ追加しない。 |

Workbenchの画面・Principal受付はWorkbench Server、Workspaceと採否・耐久判断はOrchestrator、Git操作はVersion Controlが所有する。Coordinatorの`candidate/`へ保存実体を残さず、候補内容の検証・一時Review投影だけを実行側に維持する。検証・消費・失効の型と利用側はCoordinator所有とし、Orchestratorの依存型をCoordinatorへ戻さない。

ここで固定した操作の移管確認には、正常読取りだけでなく未許可対象、改訂不一致、保存確定失敗、応答喪失、破棄不能、回復参照不一致、Runtime検証拒否、Capability再消費を含める。Sourceの旧内部importがなくなることと、本番入口で同じ能力が成立することは別に確認する。

<a id="3-主実行シーケンス"></a>

## 3. 一般Taskの主シーケンス

```text
Task Request
  ↓ exact Schema・Repository・予算
選択Checkout・固定入口・必要な実行物の同一性確認（署名を実行許可にしない）
  ↓
選択ユーザー・Provider Home・Runtime Stateの観測
  ↓
外部送信Policy・Authority・Provider適格性
  ↓
Executor選定と理由の固定
  ↓
隔離Workspace・Mount Grant・Egress制約
  ↓
Executor
  ↓ structured result
Candidate検証
  ↓
Independent Reviewer
  ├ Pass → Result integration
  └ Finding → 同じExecutorへ一回限りの限定是正 → 再検証
  ↓
全Provider・Container・Mount・Lock・一時領域の回収
  ↓
構造化結果
```

各段階は前段の候補値をAuthorityへ自動昇格しない。Provider同士を直接spawnさせず、Coordinatorが各Processを独立して起動する。Provider出力、Credential、Host Pathまたは未検証候補をそのまま公開しない。

<a id="8-不変条件"></a>

## 4. 状態と遷移

| 状態 | 入口条件 | 次の状態 | 終了後条件 |
|---|---|---|---|
| `preflight` | exact request | `authorized`または`blocked` | Effect前拒否なら資源0 |
| `authorized` | package・Repository・送信・Authority成立 | `executing` | 未消費Capabilityを失効 |
| `executing` | Executor Capability消費 | `reviewing`、`cancelling`、`blocked` | 子ProcessとContainerを所有 |
| `reviewing` | 候補Identity固定 | `completed`、`remediating`、`blocked` | Reviewerは候補を書き換えない |
| `remediating` | 閉集合Finding、一回限り | `reviewing`または`blocked` | 元Scopeを拡張しない |
| `cancelling` | Human取消、timeout、owner loss | `cancelled`または`recovery_required` | 新Effectを停止し回収を待つ |
| `recovery_required` | cleanupまたはIdentity不明 | `recovered`または停止継続 | exact Recovery IDだけを受理 |
| `completed` | 結果とcleanupの両方が成立 | terminal | Canonical Repositoryは未変更 |

Provider成功だけで`completed`にしない。cleanup不明、候補Identity不明、Recovery競合またはEffect状態不明は、成功結果が存在してもfail closedにする。

<a id="4-資源所有"></a>
<a id="docker-cliの結果と子プロセスの所有"></a>

## 5. 資源所有

| 資源 | 所有者 | 取得 | 解放・確認 |
|---|---|---|---|
| Host Operation lock | Host supervisor | Operation開始前 | 全子・Container・Console reader停止後 |
| Provider Home lock | Home session controller | Home観測後 | 対応Stage終了後 |
| Mount Grant | Mount Grant runtime | 対象PathとStage固定後 | Stage終了・取消・失敗時に失効 |
| Docker container/network | Docker process controller | Provider起動時 | `docker wait`／inspectと不存在確認 |
| Candidate Workspace | Orchestrator／Version ControlのRepository operation runtime | Executor前 | 固定Candidateの採用・終了またはWorkspaceの明示終了後 |
| Console reader | 対話境界 | 必要なHuman入力前 | reader、pipe、childの終了確認 |
| Recovery record | 対応Effect controller | Effect前に耐久化 | 復旧完了のread-back後だけ完了化 |

同じstream、handle、Processまたは一時Directoryを複数役割で共有しない。共有が避けられない場合は所有者、開始、終了、競合およびcleanup後条件を同じ設計・実装・試験へ結ぶ。

<a id="5-lock順序と解放窓"></a>

## 6. Lock順序

基本順序は次のとおりである。

```text
Host Operation
  → Provider Home
    → Runtime StateまたはDocker Recovery
      → Console reader（必要時だけ）
```

逆順取得、待機中の未知lock削除、別OperationのRecovery ID流用を禁止する。取消は新規取得を止め、既に所有する内側資源から順に回収し、最後にHost Operation lockを解放する。

旧同期排他controllerと解放集約は本番Consumerの撤去に伴い退役した。現在の回収OwnerはHost／Home／Runtimeの三長期排他と短期State排他を既存Kernel／Writerで所有し、取得済み排他の解放を全て試行する。解放不明では後続処置を進めず、最初の失敗と解放失敗を分けて保持する。Journalの削除・移動・清掃分類はJournal本体、Snapshot保存再入場の分類はsettlement-storeが所有する。純粋判定の成功だけから実資源回収や全Recovery成立を推定しない。

## 7. Authorityと外部送信

Taskの清掃可否判定は`src/task/cleanup-eligibility.ts`、現在入場と回復結果の公開投影は`src/task/recovery-projection.ts`が所有する。両者は上位の結果・参照相関だけを検査し、Docker操作や処置Authorityを発行しない。Task回復IDの固定文法は`src/state-storage/recovery-identity.ts`へ集約し、現在状態、CLI、回復Callerと結果公開が同じ解析を用いる。配置変更を理由に公開理由・DTO・ID文法・清掃条件を変更しない。

Repository読取り、外部送信、Provider起動、候補書込み、候補export、Docker復旧は別Authorityである。RoleはAuthorityを意味しない。

外部送信はRepository-local Policyと認証済みローカルユーザーの初期確認を境界とする。許可したProvider、情報分類、目的、Subscription、候補保持および取消条件が変わらない限り、Operationごとの確認コードを要求しない。Password、秘密鍵、Session Token、API Keyその他の秘密値をPrompt、Task Packet、logまたはProvider投影へ含めない。API key課金fallbackと追加購入は非対応である。

費用上限の個別確認は、利用者が明示した場合または既存Policyの上限を超える場合だけ必要とする。通常速度を既定とし、高コストmodel／effortは難易度・Risk・判断影響から説明可能な場合だけ選ぶ。

### 7.1 最小信頼境界

Coordinator Runtimeは、正常に動作するOSの認証、Filesystem、Process、AppContainerおよび署名検証機能と、OSが認証した選択ローカル対話ユーザーを信頼計算基盤（Trusted Computing Base、TCB）として扱う。

- 通常Taskは、利用者が選択・許可したCheckout／Packageの固定公開入口から開始する。CRDD署名の有無を通常実行資格にしない。公式Publisher真正性を確認していない内容は、公式配布物と表示しない。
- Runtimeは外部Effect前に、現在の実行許可、Repository／Revisionと用途の拘束、必要なNative・CLI・Image・設定の同一性と用途限定条件を確認する。CRDD署名Manifestや署名由来の一回Capabilityを要求せず、Commit／HashをAuthorityの代替にしない。
- 別ローカルユーザー、Repository内容、Provider／Workerとその出力、Network入力、未検証artifact、未検証Authority／Revisionおよび呼出し元が渡したPathは信頼対象へ昇格しない。Identity差または判定情報不足では処置前にFail Closedとしなければならない（MUST）。

同一ローカルユーザー、machine Administrator／SYSTEM、kernel、OSまたはVerifierが悪意を持ち、起動前置換、検査回避、debugger、injection等によってTCB自体を破る攻撃への完全なtamper resistanceは保証対象外である。この対象外境界を、署名manifest、artifact／Provider／Repository／Revision Identity、Authority、Provider Home、Egress、隔離、Process Effectまたは終了確認の省略根拠にしてはならない（MUST NOT）。より強い耐性が必要な場合は、OS保護済みbootstrap、managed install root、実行制御またはhardware-backed trustを別のHardened／Managed変更として再評価する。

### 7.2 専用Provider Homeの観測

専用Provider Home保護基盤（Dedicated Provider Home Protection Foundation）は、Windowsのlocal userとProvider単位の永続Home方針、固定配置および読み取り専用のRuntime所有観測をCoordinator側に保持する。OS観測だけをprivateな[Windowsプラットフォームアクセス部](../platform-access/01_Architecture.md)へ限定する。

**入力と取得**

- 呼出し元が渡したWindows絶対Pathは、Authorityを持たない字句候補に限る。
- Runtime observerのrequestへPath、SID、ACL、Profile IDまたはOperation IDを含めてはならない（MUST NOT）。
- observerはWindows既知フォルダーのローカルアプリデータ（Windows Known Folder local app data）からRootを独立取得しなければならない（MUST）。

**結合条件**

observerは固定`Qual-Lab/CRDD/ProviderHomes/{codex|claude}`を、現在Processのlocal interactive primary token、同じlogin session、Root handle／Identity、local fixed volume、全固定segmentのnon-link／non-reparse、selected user ownerおよびprotected DACLへ結合しなければならない（MUST）。Provider Homeのwrite-capable ACEは、selected userとSYSTEMの継承付きFull Controlだけに限定する。別writer、未保護DACL、Identity差または情報不足では修復せずFail Closedとする。

**出力とCapability**

- 結果は、Provider、nonce、既知flagおよびProvider Home Identity／保護／local user bindingのdomain-separated Hashだけへ限定する。
- Path、SID、login LUID、ACLまたはCredential内容を返してはならない（MUST NOT）。
- 必要なNative Artifactの実体／Hashの起動前後一致、用途限定の元要求および上限付きProcess終了を同じRuntime invocationで確認できない場合は、観測Capabilityを発行しない。CRDD署名Manifestの有無はこの発行条件にしない。
- 観測CapabilityはProcess-local、opaque、短命かつ一回限りとする。単独でAuthority、Operation Capability、Mount Grant、mount、loginまたはProvider spawnを成立させてはならない（MUST NOT）。

observerはHome作成またはDACL修復を行わない。明示bootstrap Effect、回復、logout／revoke／削除は別Lifecycleとして再評価する。

### 7.3 Claude Subscriptionの人手再認証

Claude専用Provider HomeのSubscription OAuthが失効した場合だけ、選択Checkoutの許可済み固定`authenticate-claude`入口と必要Artifact同一性確認から人手再認証を行う。この入口は通常Task Authority、外部送信許可、自動実行または自動再認証へ接続しない。

| 観点 | 固定条件 |
|---|---|
| 操作者 | OSが認証した選択ローカル対話ユーザー |
| 入出力 | direct TTY。公式Claude CLIと外部system browserだけを対話入口にする |
| 実行物 | 用途を固定し必要Artifact同一性を確認したClaude ImageとProxy Image |
| 永続書込み | 選択UserのClaude専用Provider Homeだけ |
| Network | Provider Containerは内部Networkだけ。Claude allowlistを強制する固定Proxyだけが外部Networkへ接続 |
| Proxy接続 | Provider Containerは内部Network上の固定alias `proxy`、container port `8080`へ接続する。Host portは公開せず、Proxy実装の待受portと同じ値を使用する |
| 非接続 | Repository、Workspace、Host既定Home、API key、別Provider Home、Task Packet |
| 排他 | 検証済みLogical Provider Home IdentityのOS Kernel Lockを最初のEffect前に取得する。後発ProcessはEffect 0で停止する |
| 回復記録 | OS管理CRDD Runtime Rootの`Recovery/claude-subscription-authentication`へ、Path・Credentialを含まないexact Recovery Identity、所有Label、5資源名、`active`／`settled`状態および`idle`／`in_flight` Command世代を耐久化する。各CommandはEffect前に`in_flight`、子Process close後にだけ`idle`へ遷移する |
| 成功条件 | `auth login --claudeai`完了後、networkなし・Provider Home read-onlyの`auth status --json`が`claude.ai`、`firstParty`、`max`を確認する |
| 終了条件 | 所有Labelが一致するLogin／Probe／Proxy Containerと内部／Egress Networkの明示的なexact不存在、回復記録の`settled`化およびKernel Lock解放を再観測する |

認証用URL、PKCE値、code、token、email、組織情報、Provider Home実PathおよびProvider生出力を結果・Log・Evidenceへ保存してはならない（MUST NOT）。任意段階の失敗、事後Probe不成立またはcleanup観測不能では成功を公開せず、自動再試行しない。秘密codeの入力はProvider CLIのdirect TTYへ委ね、CRDDは入力内容を横取り・反響しない。入力文字が表示されないこと、一度だけ貼り付けてEnterを押すこと、および結果が出るまで再入力しないことを対話開始前に明示する。Proxy URLのportはProxy実装の固定待受port `8080`と一致させ、Planの局所試験で別portへの差替えを拒否する。Docker CLIは固定Path、Docker Inc.のAuthenticode、同一実体Identity、最小Process環境およびOS System Directoryの固定cwdをEffectごとに確認し、PATH、親EnvironmentまたはRepository cwdを実行Authorityにしない。対話実行中もKernel Lockの生存を監視し、喪失時はDocker CLI子Processを終了して以後のEffectを止める。`inspect`の任意非ゼロを不存在へ畳まず、対象名に対する明示的な`No such container/object/network`だけを不存在として受理する。現行Docker CLIが不存在時にstdoutへ返す空配列`[]`は空出力と同じ明示的な不存在補助情報として受理するが、その他のstdoutや別stderrを不存在へ畳まない。同名資源が存在しても所有Labelが一致しなければ削除せず、同じRecovery IDで停止する。

Process loss後のfresh invocationは、同じLogical Provider Home Identityから同じRecovery ID、所有LabelおよびDocker資源名を再構成する。`active`かつ`idle`な耐久記録がexact schemaと一致する場合だけ、認証Effectより先に所有資源を回収して不存在を確認し、同じ記録を`settled`へ閉じた後で新しい`active` Lifecycleを開始する。`in_flight`が残る場合は、旧Docker Commandの終了と遅延Effectをfresh Ownerが証明できないため、cleanupを含むDocker Effectを0にして同じRecovery IDと手動回復義務を返す。正常完了時も記録を削除せず`settled`として保持するため、Kernel Lock解放を確認できない結果からexact Recovery Identityを失わない。記録の不一致、Docker観測不能、所有不一致、削除不能またはLock解放不明でも`manualRecoveryRequired: true`、`effectStateUnknown: true`および同じRecovery IDを返し、新しい認証Effectを発行しない。通常Taskは認証失敗からこの入口を自動起動せず、人間へ固定理由を返す。

### 7.4 Provider Homeマウント許可

Runtime所有Provider Homeマウント許可（Runtime-owned Provider Home Mount Grant）は、同じOperation世代のopaque management Capabilityと、一回限りのRuntime所有Provider Home観測Capabilityからだけ発行しなければならない（MUST）。呼出し元が渡したOperation ID、観測Hash、時刻、Path、SID、ACLまたはCredential値を発行Authorityとして受理してはならない（MUST NOT）。

Grantは、Process-local atomic store、Runtime所有の壁時計と単調時計、暗号学的乱数参照、最長5分、使用上限1回へ固定する。Provider、Profile、Operation、Provider Home Identity／保護状態およびselected local user bindingを結合する。

発行control、使用useおよび消費後mount authorizationのaliasは分離する。use時には、Grant発行に使用して消費済みとなった観測Capabilityを再利用せず、Provider Homeを再観測して得たfreshなRuntime所有観測Capabilityを再結合する。再観測が不成立、Provider不一致またはCapability未発行なら、Mount Grantを消費せずProvider Effect 0で停止する。Operation終了時またはmount完了後の取消では、全aliasとrecordを失効しなければならない（MUST）。Process restartではGrantを永続復元せず、全て失ってFail Closedとする。active mount、ContainerおよびOperation Filesystemの回復は、別のDocker／Host Recovery契約が所有する。

Mount Authorizationは、Provider Home Path、token、session、Credential、一般Runtime AuthorityまたはOperation Capabilityを含まない。実mount／unmount、Filesystem Effect、Provider spawnおよびcleanup確認が未成立なら、実行可能へ昇格してはならない（MUST NOT）。

### 7.5 Workbench読取り助言の一回送信境界

Workbenchの読取り助言は、一般Taskの`executor`または`reviewer`へ読み替えない。専用Task Packetと専用結果契約を使用し、次の順序を固定する。

```text
利用者の一回送信確認
  ↓
Task Hash + Catalog Revision + exact Profile + Provider
  ↓ 一回消費
Workbench AI Advice Dispatch
  ↓
Provider Adapter
  ↓
Effect／cleanupを独立観測
  ↓
許可済み参照へ拘束した結果正規化
```

- 確認は同じTaskだけに有効で、永続同意、別Task、別Profileまたは変更候補のAuthorityへ再利用しない。
- Effect前の取消はProvider呼出し0で閉じる。Effect後の例外・取消・cleanup不明は自動再送せず`unknown`へ保つ。
- `completed`は、Provider Effect発行、cleanup確認、単一JSONおよび許可済み参照だけを持つ結果がすべて確認できた場合に限る。
- 現行Production CompositionはこのDispatch、Provider別の固定Adapter選択、読取り助言専用Execution Planまで接続する。Execution PlanはCatalog Revision、Provider、exact Profile／Model／推論強度、Task／Projection Hashを固定し、Promptを標準入力だけで搬送する。Repository／Workspace mount、Tool、Session保持、API Key／有料fallbackを許可しない。
- Provider Command Planは固定配布物のCLI Path／Image Digestへexact Modelと推論強度を接続する。Codexは公開設定による操作抑制を伴う標準入力とJSONL、ClaudeはTool無効の標準入力とJSON envelope／inline Schemaを用いる。Provider Executor Coreは事前取消、Runtime拒否、cleanup不明および例外を成功へ畳まず、Codexの既知通知と最終結果を分離し、未知通知・不正Item・Errorを拒否する。Claude助言は人間承認済みPilotとして内部Turn上限を2に固定し、整数の1〜2Turn成功Envelopeから`structured_output`だけを共通Result Parserへ渡す。0、上限超過、不正型、失敗Envelopeおよび出力欠落は拒否する。内部Turnは一つの依頼・一回消費Packet・一つのProvider Processの中に限定し、Tool、Repository／Workspace共有、Session保持または自動再送のAuthorityを新設しない。実Providerでの成立確認後に正式化を判断し、Pilotの局所成功だけを利用可能またはRelease可能と表示しない。Session、Cost、Usage、生Eventおよび生Provider出力は公開しない。
- Codex助言のJSONLでは、`agent_message`、`reasoning`、`command_execution`、`file_change`、`mcp_tool_call`、`collab_tool_call`、`web_search`、`todo_list`を既知通知として分類する。最終助言以外の通知は結果本文へ投影しない。思考本文は助言、診断または根拠へ投影しない。最終回答は`item.completed`の`agent_message`一件だけから抽出し、本文欠落・不正型を拒否する。`item.started`、`item.updated`、`item.completed`のいずれでも未知Item種別、Errorまたは不正Itemを拒否し、未知の`item.*`も検査を迂回させない。正常な思考通知とTool操作の区別は[Codexの公式通知形式](https://learn.chatgpt.com/docs/non-interactive-mode)に基づく。思考通知の本文Fieldは結果成立の根拠に使用せず、未確認の段階別必須Fieldを推測で要求しない。
- Executor Coreと現在Runtime Adapterの間では、Operation、Profile、Task／Projection Hash、Provider PromptおよびProvider Command Hashを`ADVICEPKT-*`へ固定する一回消費Packetを使用する。PacketはRepository／Workspace共有、ToolおよびSessionを常に`false`とし、CodexのTool fieldはCRDDによる追加Tool権限の非付与を表す。公式CLI内部の操作不存在の証明にはしない。別Ownerによる消費、再利用および未使用取消後の利用を拒否する。Packet発行だけではProvider Effect Authorityを生成しない。
- Coordinatorの実Docker lifecycleへ`workbench_advice`専用Modeを接続する。Boolean ProbeまたはWorkspace付き一般Taskを流用せず、現在の用途別許可、固定入口と必要Artifact同一性、Operation世代、元Repository Identity結合、Provider Home、Selection、限定Egress、取消、Docker Recovery、Host cleanupおよび最終Recovery確定を同じLifecycleで所有する。元Repositoryへの結合はSelection AuthorityのScope確認にだけ用い、ProviderへのRepository／Workspace Mount、Path搬送または任意読取りAuthorityを生成してはならない（MUST NOT）。Task／Projection／Profile／Command Identityを一回消費Packetへ結合し、HostとDockerのcleanupが確定するまで助言JSONを公開してはならない（MUST NOT）。助言の旧署名資格の引数・発行・消費はSourceと本番Launcherから撤去した。通常Task・候補生成・Orchestratorの旧GateもSourceから撤去済みである。撤去後の全体回帰・実境界確認と実Provider／全体E2Eは残る。局所成立を本目標の全体成立と区別する。

Claude助言の拒否理由は、通常の結果搬送で次の順に検査する。最初に不成立となった層だけを返し、後続条件が成立したことや外部CLIの原因まで確定したことを意味しない。受理条件、Turn上限、取消、資源回収および自動再送禁止は変更しない。

| 検査順 | 不成立の範囲 | 固定理由 |
|---|---|---|
| 1 | 一意なJSONの通常Recordではない | `workbench_ai_claude_envelope_invalid` |
| 2 | `result`／`success`／非Errorの完了状態ではない | `workbench_ai_claude_completion_invalid` |
| 3 | 整数の1〜2Turnではない | `workbench_ai_claude_turn_count_invalid` |
| 4 | Cost情報が有限の非負数ではない | `workbench_ai_claude_metadata_invalid` |
| 5 | `structured_output`が欠落、または通常Recordではない | `workbench_ai_claude_structured_output_invalid` |

固定理由以外の値、Turn数実値、Cost値、回答本文またはSession情報を診断へ追加しない。結果Schemaの形は維持するが、公開理由の閉集合の変更は、対象契約・Schemaの改訂と実行Source／必要Artifactの同一性で追跡する。新しい署名IdentityやHash Capabilityを作らず、追跡値をAuthorityまたはPublisher真正性へ昇格しない。旧候補の観測理由を書き換えず、旧版の固定理由集合との互換性を推定しない。

<a id="development-provider-measurement"></a>

<a id="751-codex助言専用の起動制限"></a>

### 7.5.1 公式Codexによる助言とDocker隔離

助言には未改造の公式Codex CLIを使用する。CRDDはCodex内部のToolPolicyを変更せず、既存Docker境界でアクセス・変更・通信範囲を制限する。助言のみという目的を「Codex内部で一切の操作を試みない」保証へ拡張しない。Promptと公開設定による操作抑制は、Docker隔離の代替または操作不存在の証明ではない。

通常Taskの公式0.149.1は変更せず、助言の移行対象は公式0.159.2と同版の公式Code Mode Hostとする。公式配布物の検証済みHashを使用し、Codex本体のSource Build、起動Patch、試験Patchおよび専用linkerを新方式に要求しない。Dockerの配置用Imageは公式実行物を収める包装であり、Codexの改造版ではない。

| 境界 | 新方式で保持する条件 |
|---|---|
| 入力 | 許可済みProjectionだけを標準入力で渡す。Repository／Workspaceを共有しない |
| 隔離 | 固定Image、非root、読取り専用root filesystem、既存のmount・権限・通信制限を保持する |
| 設定 | ユーザー設定・Hook・MCP・Plugin等を継承せず、approval never、read-only等の公式設定で操作を抑制する。設定だけから完全なTool禁止を主張しない |
| 出力 | 公式JSONLの既知Itemを最終助言本文と分離する。内部計算の通知だけで拒否せず、Error、不正形式、複数最終本文と助言Schema不適合を拒否する。生通知を公開しない |
| 終了 | init、timeout、取消、Process終了、Container／Network回収、cleanup確定後の結果公開とexact Recovery Identityを保持する |
| 配布切替 | 新Imageの実Digestを取得し、計画・Effect直前検査・終了後検査・Recoveryへ一括接続する。旧専用Digestを公式Imageの値として流用しない |
| 未準備 | 実Image・局所確認・現在認可・固定入口・必要Artifact同一性・隔離境界確認が未成立の間、新方式を実行可能またはE2E合格と表示しない。旧RecoveryのIdentityは書き換えない |

旧方式のSource Build、起動Patch、試験Patchと専用linkerは新規実行の入力から外す。過去の内部試験と旧配布Identityは変更履歴で追跡し、新方式の保証へ流用しない。未解決の旧exact Recoveryだけは旧Imageのinit構成を照合できるように維持する。

Qualityでは公式配布一致、公開設定、標準入力とDocker隔離、有限な通知分類、唯一の結果、取消・Process喪失・資源回収を確認する。公式CLI内部のTool登録拒否やJS能力不存在をCRDDの保証として要求しない。局所確認と実Provider E2Eを分け、後者が未実施なら完成を表示しない。

## 8. Providerとモデル選定

Docker準備候補の取消・期限確認・一回消費は`src/provider/preparation-lifecycle.ts`へまとめる。呼出し側が所有する計画・管理対応の二WeakMapをそのまま利用し、Provider別のStoreを合成・コピーしない。共通処理は管理Capabilityの参照一致、壁時計と単調時計の両方が30秒未満である条件、Authority失効とHome Lease解放の既存順序を維持する。Mount解放が未確認なら候補参照を保持し、所定の解放確認後にだけ除去する。消費後の具体Provider計画型と、Provider別の拒否理由・公開結果は維持する。CLI・Model解釈はAI Adapter、計画相関・実行Authorityと現在状態はCoordinator、Docker技術構成と資源LifecycleはDocker Isolationの責務であり、新しい保存状態・回復方式を作らない。

固定Dockerコマンドとbind Mount文字列は`40_Develop/docker-isolation/src/execution/command-plan.ts`へ単一化する。認証確認、内部／外向きNetwork、Proxy、Provider作成、起動の九コマンドとその順序、non-root・read-only・cap-drop・no-new-privileges、Reviewer Workspaceのreadonlyは同じ実体で保持する。Provider固有CLI・認証環境・init要求・Seccompの適用要否と期待Identityを記述として渡し、共通組立てでModelやAuthorityを再判断しない。組立てはDocker要求を発行せず、Prompt本文もargvへ入れない。実要求と終了後観測は既存Docker実行Ownerが保持する。

資源名とProxy用乱数の値検査は`40_Develop/docker-isolation/src/execution/command-plan.ts`へまとめる。呼出し側所有の乱数関数を使い、Buffer型と所定byte数を維持する。認証・Proxy・二Networkは同じsuffixへ、Provider Containerは固定Provider名とHome Identity Hash先頭16桁へ結合する。既存の64桁小文字hexと63文字上限を維持し、資源名やlabelだけを所有・不存在・削除Authorityの証明へ昇格しない。

準備候補の受理から保存までは`src/provider/preparation.ts`へまとめる。入力modeと回復参照、Mount有効化、Model・Task・助言Packetの一回消費、Home取得、二時計、計画、Authority照合、既存二WeakMapへの保存を同じ順序で接続する。Provider別の計画と公開結果、Claudeの作業量確認は二つの固定呼出し側から渡し、外部入力で接続先を選ばない。失敗時の失効・Mount解放と例外搬送を維持し、新しい保存状態、汎用実行FrameworkまたはDocker要求を追加しない。局所検証用Factoryも同じFileでprobe・Task・助言の引数搬送、取消と一回消費を所有し、Provider別状態に結合した固定操作だけを受け取る。本番Authorityは持たず、準備・取消の例外を固定理由へ、消費例外をnullへ搬送する既存契約を保持する。

選定・操作・Mountと固定CLI計画の相関、Home／tmp／Workspace、資源名、Proxy環境、認証確認と九commandの組立ては`src/provider/execution-plan.ts`へまとめる。AI Adapterから取得した二Providerの固定記述を利用し、CodexだけのExecutor Seccomp、追加Proxy変数・認証Home環境・init要求と、ClaudeのModel／effort引数・仕事量を区別して保持する。Taskと助言の同時入力、異なる操作・Profile・Provider、取得不能なSeccompや不正Mountを拒否し、取得例外は既存準備Ownerの失効・Mount回収へ返す。公開候補の成功表示やAuthority発行はこの組立ての責務ではない。

本番準備の共通依存は`src/provider/execution-composition.ts`で組み立てる。Mount照合・有効化・解放、Packet消費、選定消費、Authority発行・失効、乱数と二時計を同じ既存Ownerへ結合し、組立て自体は取得・消費・外部要求を実行しない。同じFileの状態FactoryはOwnerごとに独立した二WeakMapを生成し、準備Storeと管理対応をProvider間または同じProviderの別Owner間で共有しない。具体計画、消費済み選定・Task、準備状態の型は既存の`provider/execution-types.ts`が所有する。Providerと購読種別、Claudeだけの作業量を型でも区別する。Codex ExecutorのSeccomp適用要否と期待IdentityをDI計画へ渡し、Claudeへ暗黙適用しない。上位状態と依存型へSeccompのPathや検証関数を保持しない。Effect前の拒否結果は共通準備Fileが一つだけ構築し、既存field、null、falseとProvider別理由値を維持する。両Providerの計画型と成功結果の差をこの整理だけで統一しない。

固定呼出し側の共通組立ては`src/provider/execution-adapter.ts`へ接続済みである。準備・取消・一回消費を同じOwnerで組み立て、本番AdapterはProviderごとに一度だけ生成する。二Providerの既存入口とTask本番利用側は同じ固定Ownerを取得し、取得のたびにStoreを作り直さない。局所試験の独立Factoryは本番Storeと分離する。Claudeの作業量検査と公開結果field、CodexのSeccomp接続は区別したまま保持する。Taskの回復相関も同じ計画へ搬送する。これは準備組立ての移管であり、Snapshot本番保存・回収・搬送の完了を意味しない。

別Providerへの委譲を基本とし、同一Providerは、委譲不要、能力上の適合、Provider利用不能または独立した別Contextを説明できる場合だけ選ぶ。Front CodexからはClaude Executor、Front Claude CodeからはCodex Executorを優先するが、品質条件を満たす適格集合の中で判断する。

選定前に、Role、work class、plan state、Risk、難易度、判断影響、利用可能性、Authority、Costを固定する。Provider、model family、effort、速度、選定理由、高コスト選択の有無、再選定条件をProvider Effect前に記録する。AvailabilityやScopeが変わった場合は、元の選定を暗黙fallbackせず再評価する。

選定Grantは30秒の一回限りCapabilityであり、Provider Homeの実観測やMount照合より前に発行したGrantを、その前処理後のProvider Effectへ持ち越さない。Stageは最初の選定をProviderとProfileのMount照合にだけ用い、二回目のHome観測とMount Grant消費後に旧Selectionを明示失効する。同じ入力から新しいSelectionをEffect直前に発行し、Provider、Profile、model、effort、速度および選定理由が最初の選定と完全一致した場合だけ、選定表示、Task PacketおよびProvider準備へ進む。発行済みのSelection Controlは意味検証より先にLifecycle Ownerの清掃対象として保持し、意味不一致や検証不能でも失効を試みる。再発行失敗、旧Grantまたは再発行Grantの失効失敗、失効結果の観測不能、もしくは意味差がある場合はProvider Effect 0で停止する。失効失敗または観測不能を清掃成功へ畳まず、Processを再利用不能として汚染状態へ移す。期限を伸ばして前処理時間を吸収せず、短命なAuthorityの有効期間を必要なEffect境界へ合わせる。

Workbenchで利用者が明示したAI Profileによる助言実行は、Front AIだけで完結する`delegationNeed: none`ではなく、`beneficial`かつ`explicit_user_delegation`としてSelection Grantを要求する。`none`はGrant不要の保持経路であり、明示Provider／Profileを持つ外部実行へ流用してはならない（MUST NOT）。Workbenchは明示Provider、Profile、Coordinator役割および同じOperation IdentityをSelection Runtimeへ渡し、Production Selection契約が発行したGrantだけを二段階Selectionへ使用する。

固定開発版によるProvider実測は、検証済みのSource、Native成果物、Repository、期限、Task数およびCLI呼出し数へ閉じた開発Sessionだけを発行し、Release AuthorityまたはProvider送信Authorityを与えない。このSession開始時に外部送信とは別の対話確認を重ねない。実際のProvider送信は通常運用と同じ初期外部送信許可だけが制御し、永続境界が同じ間は既存許可を再利用する。許可が存在しない、変更・失効・取消された、または状態を確認できない場合は、Provider Effect前に初期確認へ戻るかEffect 0で停止する。固定開発版のIdentityやTask上限から、外部送信範囲、実行AuthorityまたはRelease Authorityを拡張してはならない。

開発Sessionの完全Identity観測と進行中作業の生存確認を分ける。完全観測は、Admission前後、Task予約、Operation結合、Native lifecycleへの初回進入、各Provider Effect直前、各Provider終了後およびcleanup lifecycleへの初回進入で行う。同じNative／cleanup lifecycle内の補助観測、進捗参照、取消・期限・Process停止の確認およびread-onlyな利用量集計は、直前の完全観測で固定したSession bindingと現在時刻へ結合し、配布物全体を再Hashしない。各Native Adapterはこの固定を配布全体の同一性証明として再解釈せず、使用するNative成果物をProcess実行前後に個別照合する。Provider終了後の完全観測が不成立なら、Provider結果が成功でもTask成功を公開しない。生存確認または同一lifecycle内の補助観測は、新しいAuthority、別のNative lifecycleまたはProvider Effectを発行できず、次の境界の完全再観測を代替しない。

<a id="release-artifact-binding"></a>

## 9. 通常実行・追跡・正式配布の分離

### 開発実測Sessionの署名・複製依存撤去（限定接続確認済み・全体未完了）

SessionはTask数、期限、予約・一回消費、Operation／Repository結合、取消、送信許可と結果相関を維持する。一方、実測のために別の署名済みNative配布を用意する契約は廃止し、Moduleから導出した同じSource Rootの固定Bootstrap Nativeを使用する。旧`nativeDistributionRoot`と`expectedNativeRelease`は新入力から除去し、旧packetを互換受理しない。期待Source Hashは`expectedSourceSha256`として維持し、同じadmission呼出し内で現在値を自動補完しない。

Source観測は正確なModule到達閉包ではなく、版付きの有界Snapshotとする。既存Runtime母集団の11 Package（coordinator、platform-access、docker-isolation、domain-model、ai-adapter、artifact-signing、access-management、mcp-server、orchestrator、execution-intelligence、version-control）について、直下`package.json`と`src/`・`bin/`・`runtime/`・`scripts/`・`policies/`を固定対象とする。任意Directoryの不存在はScopeに記録し、追加時にはHashが変わる。Package本体・`package.json`・`src/`の欠落、空の部分結果、link・非通常File、観測不明は拒否する。

| 観点 | 契約 |
|---|---|
| 内容Hash | Scope版、正規相対Path、byte長、内容SHA-256を固定順で結合する。Node実体・絶対Pathは期待内容Hashへ混入しない |
| Session内同一性 | Root・Directory・Fileの実体と前後観測を内容Hashとは別に捕捉する。追加・欠落・途中差替え・読取り不明で拒否する |
| 上限 | 旧観測と同じ2,048 File・合計64 MiBを維持し、単一File 1 MiB・深さ8を上限とする。Directoryも2,048件まで、各Directoryは逐次列挙で4,096名までとし、4,097件目で拒否して同handleを閉じる。超過時に自動拡張しない |
| 除外 | `tests/`、`.crdd/`、`node_modules/`、`target/`、`dist/`、coverageと文書は実行Source Snapshotの対象外。Task入力・実行設定・外部CLI／Image／Nativeの保証は各既存Ownerが別に確認する |
| Native | 同Source RootでPA固定Bootstrap Hashを確認し、既存の私有WeakMapへ元観測を結合する。再観測は元admission IdentityのMap欠測を拒否し、旧token確認→Source／新Native観測→Repository再確認→旧token再確認→新token最終確認を重ねる。同内容への実体差替えをfresh Hashで上書きしない。各Native要求の前後確認と借用token再確認は別に維持する |
| 再観測時点 | Admission前後、予約、Operation結合、Native初回、Provider発行前／終了後、cleanup初回の完全観測を維持する。同lifecycle補助確認へ全Source再Hashを増殖させない |
| 生成入口 | 既存の実測Toolへ読取り専用のSource観測入口を接続し、Frontend AIがその結果から新packetを生成する。ProducerとConsumerは同じ観測規則を使用する |
| 保証上限 | Hashは固定した候補の内容照合と追跡であり、実行Authority、Publisher真正性、配布署名、ロード済みModule本文との原子的な一致を保証しない |

旧配布Hashとは観測Scopeが異なるため同一視せず、旧packet／Hashの移行はFrontend AIが現在Sourceから再生成する。旧配布Root・署名記録を通常実行へ読み戻す互換経路は作らない。任意配布APIと歴史Evidenceは、このSession移行の成功から撤去済み・検証済みとは扱わない。

内容Hashの再構成はUTF-8の`JSON.stringify` byte列をSHA-256へ渡す。先頭はScope版文字列、固定Package名配列、固定対象Directory名配列の三要素とし、残る観測要素は各要素の`JSON.stringify`文字列をコード単位順で比較して整列する。File要素は`[相対Path, byte長, 内容SHA-256]`、Directory要素は`[相対Path, "directory", コード単位順の名前配列]`、任意Directoryの不存在は`[相対Path, "absent"]`とする。相対Pathの区切りは`/`、大小文字・Unicode・File本文のbyte列は変換しない。実体Hashはこの内容Hashと別の実体観測を使用し、portableな期待値や公開照会結果へ含めない。

Source観測の具体処理は同じtask責務内の`development-source-observation.ts`へ置き、ゼロ引数でModule由来Rootだけを読む。既存実測Toolの`--describe-source`は通常実測準備より前に同じ観測を呼び、期待Hashの取得だけを行う。Source／Session／結果搬送の接続は限定確認済みで、旧署名APIは撤去済みで、撤去後の全体回帰・実Provider・全体E2Eは未成立である。

Sessionは既存観測関数の`priorIdentity`にadmissionの元Identityを渡す。完全再観測とcleanup初回だけがSourceを読み直し、同lifecycle内の借用は保存した元Native tokenの照合を行う。私有Mapへ結合できない値・失効・観測例外は拒否し、孤立試験の値を本番借用へ流用しない。`inspect()`と実測結果の`sourceObservation`は、期待値と一致した実観測から固定したScopeと`expectedSourceSha256`だけを返す。Root・Source実体Hash・Native token・Release情報は公開しない。開発Nativeの欠測理由も固定Bootstrapへ統一する。Source／Session／結果搬送の接続は限定確認済みである。一方、旧署名APIは撤去済みであるが、撤去後の全体回帰・実Provider・全体E2Eの成立はまだ主張しない。

Host終端記録の保存・読戻しと対象観測の通常入口は、Platform Accessの採用済み固定Bootstrap Hash・固定Path・Root／File実体を確認する。同じ観測tokenを各要求の直前／直後に再確認し、Git HEADのBlob一致を実行条件にしない。これは配布元真正性やCommit由来一致の証明ではない。署名専用の評価時刻引数はAdapter、記録準備と全利用側から撤去し、取消・保存改訂版・nonceには転用しない。補助処理後の観測不成立は応答解析前に停止し、保存要求後なら記録Effect不明と同じ参照・終了事実を保持する。Current／Knownの二観測は各呼出し内のRoot／File前後一致に加え、両成功結果のArtifact全6 fieldと通常／開発区分を照合する。二呼出し間のRoot／File継続同一性は主張しない。通常方式は`fixed_bootstrap_native_artifact`、Revisionは`null`であり、未確認のGit由来を表示しない。開発経路は同じ開発Contextのfresh再借用とArtifact一致、従来の方式・Revision `null`を維持する。比較用の不変`nativeProvenance`はPackage内部の成功観測（Package外非公開）だけに保持し、Authority、Native frame、caller保存本文、履歴または最終candidate結果へ広げない。

Windowsの共有回復領域初期化も、通常署名やGit HEAD一致を前提にしない。採用済み固定Bootstrap Artifactと実体を初期基準とし、親観測・初期化の各要求直前と直後に同じ観測tokenを確認する。親TEMP／TMP、利用者・親実体の独立期待値、nonce、固定Protocol、子の部分作成receipt、終了確認は維持する。初期化要求前の停止はFilesystem Effectなし、要求後の観測不成立は不明を保持し、先行する親観測や実終了の事実を消さない。`artifactVerifiedBeforeAndAfter`は発行済み補助処理の固定Artifact・実体の前後一致であり、初期化全体の完了は`status`とNative応答の共同成立で判定する。

| 責務 | 現在採用した契約 | 所有しない保証 |
|---|---|---|
| 通常実行 | Coordinatorは現在の要求・送信許可、Repository／用途、選択Checkout／Packageと固定入口を確認し、Docker Isolationへ技術実行を依頼する。CRDD独自署名と署名Runtime Capabilityを必須にしない | 署名・Hash・Commitから実行許可を生成しない |
| 出所・同一性の追跡 | 選択したSourceの基準Commit／Tree、実際の作業Treeとの差、必要なNative・CLI・Image・設定のIdentity／Hashを用途に応じて相関する。必要な元値との不一致・観測不能では当該Effect前に停止する | Hash一致からPublisher真正性、途中の変更不能、悪意ある同一OS利用者への完全防御を推定しない |
| 正式配布の真正性 | 必要な配布単位だけRelease／QA Ownerが評価する。署名機能の利用自体は任意で、v0.22通常Runtimeの完成Gateにしない | 通常Taskの一回Capability、Docker／Recovery Authorityを発行・失効しない |

署名済みReleaseを未署名として表示したり、未確認Publisherを真正と表示したりしない。必要な公式CLI／Imageの出所確認と実体検査は維持するが、CRDD独自署名Frameworkとは別の専門Ownerの責務であり、新しい組織Trust Policy Frameworkを追加しない。一般の`artifact-signing`を配布時の独立Toolとして残すことと、Coordinator専用の署名・配布閉包・準備／回復機構を通常実行から撤去することを分ける。

固定Workerの回復MatrixはCRDD署名を実行前提にしない。親の直接呼出しと内部子の両入口はRoot生成・シナリオ開始前に既存Node対応版を確認し、その後は既存の隔離・Host境界で処理する。代替資格は発行しない。結果改訂2は`packageVerification: not_required`、`signatureRequired: false`を宣言する。残るTool群の移行中は`verify-signed-recovery-matrix.ts`と既存の公開識別子を維持するが、署名成立の主張には使わない。七シナリオの呼出し接続確認と、実回復成立の検証を区別する。

一般Taskと経路別検証も署名資格を要求しない。検証Runnerの固定module Rootで既存11Package Source観測とGit改訂を取得し、開始前と全Task settlement後でScope・内容Hash・内部実体Hash・Commit／Treeを比較する。公開するのは`sourceScope`、`sourceSha256`、`crddCommit`、`crddTree`と固定語彙の検証状態だけで、内部実体Hashや絶対Rootを公開しない。これはロード済みModuleの原子的固定、配布元真正性または実行Authorityの証明ではない。初回の欠測はTask開始前に停止する。終了時のSource不成立でも候補破棄・取消・終了待機を省略せず、既存の一次失敗を保持する。Source変更と作業対象Repositoryの変更、検証不成立とProvider Effect不明を分離する。四経路の全試行および二経路の結合は同じ公開Source tupleを要求し、対象Repositoryの改訂比較は別に維持する。

Workbench助言、Task、CLI、Workbench候補実行およびOrchestratorから旧署名Gateの引数・発行・消費を外し、Orchestratorの署名専用Execution Authorization PortとAdapterを撤去した。Task公開契約は改訂36で通常実行に署名資格を要求しない。Processの片付け中・再利用禁止、現在の送信許可、Root／Revision、隔離・取消・回収は維持する。旧資格三APIと専用Script・固定AST graph・配布Identity・専用試験／設定は物理撤去した。`package-verification.ts`の通常保証は維持する各Ownerの試験へ対応付け、旧Fileを削除した。撤去後の全体回帰・実境界・実Provider／E2Eは未完了である。署名Capabilityの改名、常時trueの代替Gate、巨大閉包・全体コピー・署名準備状態を通常実行へ残さない。

署名・Manifest・Release chainを含む旧記録は歴史的根拠として当時のIdentityを保持する。Commit／Hashへの機械置換、現在Authorityへの流用、Runtime互換Readerは追加しない。移行・清掃はフロントAIが確認し、移行不能・未完了・現在相関不明では新Effect前に停止する。移行後の制御は現在のRoot・利用許可・Operation／Recovery相関と実資源観測へ接続する。

完成には未署名の通常実行、署名欠測を理由にした拒否の撤去、任意配布署名の失敗と通常実行の独立、Hash不一致・観測不能の停止、署名なしでも送信許可・隔離・取消・清掃・同じRecovery IDの保持が成立する実利用側試験が必要である。Source接続とQA対応が未完了の間は、新方式の完成・実E2E Passを表示しない。

通常開発Gateは型・整形・Lint・現在のTraceabilityと、生存するProcess所有・private import・実行Artifact出所等の個別境界試験を維持する。全`scripts/**/*.ts`集合の固定AST／body SHA検査、専用の任意検査入口、`Legacy Verification Tools:`による通常回帰の除外は撤去した。維持する通常保証は現在のOwnerと試験へ対応付け、旧graph保証そのものを別Frameworkで再実装しない。通常回帰成功を正式配布の真正性検証や実Docker／Provider E2Eの成功へ読み替えない。

Local Personalの許可元は、署名済み配布物から生成しない。既存の管理参照が現在の実Operationに結合し、要求のOperation IDと一致することを各loadで一回、cache参照前に確認する。開発用Contextが存在する場合だけ同じContextの`checkNewWork() === true`も必要とし、偽造・別Operation・清掃後失効・観測例外では許可元を返さない。内部確認はstrictな`true`だけを受理する。Profile／Provider／Operationの既存制約、30秒のcache、GrantとHome／Egressの結合、実Provider直前の再検査は維持する。署名／Hashを代替資格へ変換せず、新たな管理状態・排他・回復は追加しない。

Git改訂の単一Native出所照合は、追跡／任意配布の読取りとして維持し、通常Adapterの実行Gateにはしない。この読取りは選択Rootの最寄りの検証済みRepositoryと相対prefix・固定Native Pathを使い、捕捉した改訂のBlobについてmode `100644`・bytes長・SHA-256を実物へ照合し、終了前にもRepositoryとNativeを再確認する。NativeがHEADと異なれば、このGit照合は引き続き拒否する。一方、通常Adapterは採用済みBootstrap Hashと同token前後観測を使うため、Git欠落・未Commit更新だけを理由に停止しない。どちらも署名、Publisher真正性、全Checkout一致、実行許可は発行しない。

保護RootとProvider HomeのWindows Adapterは通常経路でPAの固定Bootstrap確認を使い、開発経路だけ既存の借用済みNative観測を使う。両経路とも固定Artifactの要求直前・終了後確認を維持する。通常の成功表示は`executionSourceKind: fixed_bootstrap_native_artifact`、`nativeSourceRevision: null`であり、未確認のGit由来を示さない。開発経路は`fixed_development_candidate`を維持する。署名専用の時刻引数と`releaseIdentityVerified`／`nativeReleaseIdentityVerified`は廃止済み。Provider Home Adapterの公開改訂版は7。Sourceと模擬Native Protocolの結合は実補助Process・Docker・Provider E2Eの成立とは別に確認する。

Orchestrator実Provider検証Toolは、公開MCPの起動要求前と発行後の不明を区別する。起動引数の構築を終えてspawn要求を発行する直前に、当該Process内だけの発行状態を固定する。未発行で停止した場合は`verification_not_started`と`no_effect`を標準出力だけへ返し、回復・再起動・結果保存・fixture書戻しを要求しない。ここでのjoin／清掃成立は子資源を生成せず回収義務がない意味であり、実子の終了観測を意味しない。発行後の例外は、同期spawn例外も含め既存の不明結果と保存を維持する。通常の試験Directory作成は結果保存直前まで遅らせる。これは署名依存切替の前段是正であり、同Toolの旧署名依存撤去や実Provider E2Eの成立を示さない。

同Toolの現在方式は、引数で別配布Rootを受け取らず、module自身のCheckoutにある公開MCP入口を起動する。既存11Package Source観測に加え、固定`template/tools/crdd-mcp-server.ts`を既存Domain Readerの64KiB上限で読み、通常File・非Link・単一Linkと前後の実体一致を確認する。`mcpEntrySourceSha256`はReaderが返したUTF8文字列のHashであり、生byteの完全性Hashではない。開始前と全経路終了後のSource・内部実体・Git・入口を照合し、最終欠測は`unavailable`、差分は`changed`として検証完成だけを拒否する。既知の回収結果・一次問題をSource不成立で上書きしない。

結果改訂12は作業対象の`executionIdentity`と実行Sourceの`runtimeSource`を分離する。後者はScope・内容Hash・Commit／Tree・入口文字列Hash・固定観測状態・署名不要の七項目だけを再構築し、実体Hash・時刻・絶対Root・未知fieldを公開しない。旧`distributionIdentity`や署名Manifestを新版の根拠へ流用せず、歴史Evidenceは不変更。正常二経路・取消・親喪失・同じRequestの再入場・公開受付世代取得・fixture復元を維持し、Source観測の成功だけをそれらの実成立と表示しない。

旧署名資格の発行・消費・失効API、そのWeakMap・5秒寿命・同一性Record・試験専用factoryは撤去した。資格を一回消費する旧保証は退役し、別資格へ置換しない。TaskのProcess poison／drain拒否とExternal Sendの現在許可は、それぞれ現在の入口で確認する。旧APIへのProxy読取り試験はTask入力のget・ownKeys・descriptor読取り0の直接反証へ移し、旧資格だけの試験は公開namespaceから四入口が消えたことの反証へ置換した。Coordinator専用の署名Script・配布Identity・Manifest／Tree検証・固定AST graphと専用試験は物理撤去した。現在Treeの固定旧18Pathの明示不存在と通常入口・Task回復・Nativeの非依存を専用試験で確認する。汎用artifact-signingと固定Native／公式CLI／Imageの検証は維持し、歴史Evidenceは変更しない。撤去後の全体回帰・実境界・最終独立レビューの完了は別に確認する。

Coordinator固有の署名・準備コピー・Manifest昇格・巨大閉包検査は退役対象とし、正式配布で署名が必要な場合だけ独立した汎用`artifact-signing`を利用する。Nativeの単一Git出所観測、必要Artifact Hash、公式CLI／Image、現在認可、Docker隔離・取消・回収はこの退役へ含めない。先行して共通Launcherの`sign-release`／`promote-release`をmode集合・dispatch・help・端末条件から削除し、旧modeは引数・端末条件を問わず既存`coordinator_launch_mode_invalid`／exit64で対象Tool読込み前に拒否する。通常Task・対話・自動処理・経路検証・回復検証・Claude認証の入口は維持する。旧Script本体・graph・配布Identity・専用試験と設定の物理撤去は別に閉じ、Launcher撤去だけでFramework全体の退役完了としない。

単一NativeのGit出所照合は`diagnostics/native-git-provenance.ts`が所有し、旧配布全体の`platform-access/release-identity.ts`から分離する。対応する実Git・Blob差・読取り中差替え・Windows junctionのITも同名の専用Suiteへ移し、処理本文と試験本文は変更しない。旧配布Tree／署名閉包の試験をNative観測の根拠へ混在させず、Source／Test Symbol・台帳・Host Profile・coverage対象も同じOwnerへ接続する。これはGit出所観測を通常Nativeの必須Gateへ戻すものではなく、固定Bootstrap Hashと同じtokenの要求前後確認は現行方式を維持する。

現行のレシピ・Provider設定・助言Image準備の入力搬送は、署名配布graphと独立した資産相関として維持する。専用の`runtime-assets.contract.test.ts`で既存の三つの検査本文を保持し、公式CLIの未改造利用と資産Owner間の接続を確認する。この局所検査を未知状態のEffect拒否、公式実行物検証、実Buildまたは実Docker隔離の証明へ拡張しない。検証義務の限定範囲はQA-000006を正本とする。

### 移管前の署名方式（V6比較基準・現在の実行契約ではない）

以下の旧方式は、過去能力と撤去・代替対象の照合に限って保持する。現在の通常Runtimeに必須署名、配布閉包、一回署名Capabilityまたは旧署名chainを要求する根拠へ再利用しない。

独立Trust Policyの有効化とProvider起動へのAdapter接続は[Roadmapの将来版](../../../99_Roadmap/01_Roadmap.md#2-版ごとにできるようになること)の対象であり、現行Coordinatorの必須能力ではない。旧V6の署名・完全性・起動時再検証は当時の比較保証に限定し、現在の保証は§9の現在認可・固定入口・必要Artifact同一性へ接続し、独立読取り評価だけから実行Capabilityを発行しない。

### 署名範囲の縮小 — V6方式と再編後の閉包

2026-10-06の人間判断により、候補ごとのRepository全体展開と署名前／Manifest昇格時の全体Tree再構成を廃止する。現在SourceのManifest改訂版と署名domainは6／V6へ切替済みである。局所検証と必要な実署名・TTY・製品E2Eを区別し、Source接続だけで実Runtimeの利用可能を表示しない。今回の責務再編では、同じ閉包抽出に新しい公開入口・子入口・Package metadataを接続し、旧版の署名や検証結果を新しい実行Identityへ流用しない。

| 観点 | 変更目標 | 維持する保証 |
|---|---|---|
| 実行対象 | 既存の実行閉包観測を使用する。Coordinatorのproduction allowlist、公開入口、登録済み子入口、到達した兄弟Componentとpackage metadataを対象にする。全`40_Develop`へ広げない。 | 集合内の欠落・追加・改変、集合外依存、未登録子入口と観測不能を拒否する。 |
| Native／外部実行物 | Platform AccessのPath・bytes・Hash・protocol等を同じ署名Identityへ結合する。Provider image／binary／settingsは既存Provider Ownerの検証へ接続する。 | コードHash一致だけでNativeや外部Provider実行物の一致を推定しない。 |
| Gitの出所 | CommitとTreeの結合は維持し、署名する選択FileとNativeのGit Blob・mode・正規化後bytesだけを照合する。 | 未Commitまたは別Commitの実行物混入を署名前に拒否する。非実行文書等の全体一致は保証しない。 |
| 設定 | 固定Security Policyは署名対象のまま維持する。Repository Manifestと外部送信Policyはそれぞれの既存Ownerが検証・更新する。 | Repository固有設定を署名済みRuntime設定と誤表示せず、秘密・Credential・現在状態を署名対象に混ぜない。 |
| 形式と利用側 | 新しい意味をManifest revision 6と署名domain V6で識別し、署名／検証を同時に変更する。 | V5署名をV6の現在実行許可へ読み替えない。必要な旧履歴専用検証は旧domainのまま分離する。 |
| 一時配置 | 通常試験は作業Sourceで実行する。署名・原子配置に必要な最小集合だけを固定`tmp/signature/work/`へ配置する。 | 全Repositoryコピー、恒久候補Directoryの累積、新しい清掃Frameworkは作らない。 |

署名準備はOrchestratorのAI実行キューとは別の入口であり、キューへの保存を回復参照の保持根拠にしない。起動するフロントAIが最初の作成前に`operationId`と`identity`を確定・保持し、CLIから準備処理へ同じ値を渡す。初期参照は既存Runtime Dataの固定Owner `coordinator-release-runtime`と世代`1`へ結合する。内部生成後の端末表示だけに依存せず、既存の一時操作記録とexact参照による再入場を利用する。識別子から操作能力を復元せず、新しいstate・キュー・回復DBを作らない。

公開入口から、集合抽出、出所確認、秘密入力前の検査、同じ固定入力の再観測、署名、opaqueなManifest bytesの原子公開、結果受理と終了清掃までを一つの経路として接続する。失敗・中断時はexactな未解決対象をOwnerが再確認し、不明を不存在や成功へ畳まない。配置後のManifest一致だけで署名元Runtime・実際の起動物・現在Authorityの一致を推定しない。

実行前後のHashはその観測時点の一致であり、途中の変更・復元や後続の子起動まで変更不能だった証明ではない。既存のRoot Protection、Native選択、子起動とEffect前の再検証の責務を維持し、未実装の保護を今回の縮小で完成へ昇格しない。全体Tree照合も実行中の変更不能を保証していたわけではない。

必須反例は、文書のみの変更によるRuntime一致、実行Source／Policy／Nativeの変更拒否、未登録子入口と兄弟metadata欠落の拒否、Commit由来不一致、Repository設定やProvider Identity不一致の処置、観測後の差替え、V5／V6混在、Manifest公開競合、途中停止と再入場である。検証設計は既存QA-000010の項目を使用し、項目追加そのものを目的にしない。旧V5の全配布展開・旧候補Pathの記述は移管前の比較基準であり、V6の新規入口へ適用しない。現在の固定一時配置は末尾の「署名準備の一時領域」に従う。旧署名方式の残る記述と全利用側の対応は段階3で整理し、旧実物の清掃はフロントAIへ渡す。

配布担当者の端末補助は`40_Develop/coordinator/scripts/sign-release-terminal.ts`へ固定する。候補ごとの一時Scriptを量産せず、候補Identityと非秘密の署名条件だけを引数で渡す。補助入口は単一の現在UTCから時刻を整え、既存の署名Commandを同一Processで呼ぶ。新しい子Process、秘密入力Owner、署名Authority、結果Storeまたは回復Frameworkを設けない。署名完了後だけ画面保持の入力を所有し、画面保持の失敗で署名結果を変更しない。窓の強制終了は完了・Effect 0と推定せず、既存Manifest検証へ戻す。既存共通Launcherの契約は維持する。

### 選択した署名入力の観測予算

署名準備が観測する選択File集合は、最大4096ファイル・合計64MiBの固定予算とする。件数と容量を別々に判定し、どちらかの超過、実体変更、alias、Root差または選択したGit由来不一致を拒否する。予算はRepository全体を展開する要求ではない。観測予算内であることを署名・Authorityの成立とは扱わない。Runtime packageやTrust Coreの別母集合の予算はこの値へ一括変更しない。

この件数はV6の選択したRuntime入力と固定成果物のための上限であり、Runtimeの履歴保持数や同時実行数ではない。秘密入力前に同じ固定入力を観測し、選択FileのGit Blob・modeと実行bytesの一致を確認する。文書・試験・未到達Componentの全体コピーを新規署名の前提にしない。

鍵参照、direct TTYの秘密入力および任意byte列への暗号署名は[成果物署名Component](../artifact-signing/01_Architecture.md)が所有する。CoordinatorはRuntime依存集合、Manifest payload、固定Publisher Policy、P検査／S検査の順序、Envelopeおよびstaging配置だけを所有し、鍵PathのFilesystem検査や暗号Primitiveを再実装しない。

CRDDはGit clone／submoduleだけでRuntimeを利用できる配布構造を採る。v0.21の目標Release候補TreeにはSource、文書、試験および固定成果物`40_Develop/platform-access/artifacts/windows-x64/crdd-platform-access.exe`を含める。署名ManifestはCoordinator配布物の固定入口である`template/tools/coordinator/coordinator-package-manifest.json`へ置き、launcher、公開API改訂、`40_Develop`実装およびNative Runtime Artifactを同じ配布全体Identityへ結合する。実装、署名、昇格および検証は同じPathを正本として使用し、設定用の別Pathへ複製しない。

配布には二つのIdentityを用いる。V6の現在の署名対象は上記の選択集合であり、以下のrevision 5の記述は旧母集団との比較だけに用いる。

- リリースIdentity（Release Identity）は、Version、tag、Repository Commit／Tree、文書、移行およびCHANGELOGを含み、「このCRDD Releaseは何か」を示す。
- Runtime実行Identity（Runtime Execution Identity）は、実行に影響する閉じた依存集合、Security Policyおよび固定Platform Access成果物を含み、「何の実行へAuthorityを与えるか」を示す。

manifest revision 5は、Coordinatorのproduction distribution allowlistである`bin/**`、`src/**`、`runtime/**`、`policies/**`および`package.json`全体に加え、共通Launcherの正本が選ぶ署名・4経路・Recovery入口と、そこから静的に到達する選択済み`script`依存を自動走査する。2つの公開Launcherと、責務分離されたMCP、Orchestratorおよび実行知（Execution Intelligence）は、公開入口からcanonicalな静的importで到達する許可済み`src/**`と、そのNode module解釈を決める各componentの`package.json`を同じ実行閉包へ含める。したがってallowlist内の未参照Coordinator production sourceはIdentityを変えるが、未到達の兄弟Component、文書、試験およびbuild-only sourceは変えない。到達した兄弟Component／Launcher／protocol source、または到達Componentのpackage名・版・`private`・module種別を含むmetadataはIdentityを変える。package metadataの欠落・不正と実行集合外importは拒否する。このcontent root、Root Protection／Key Storage Policy Hash、Platform Access成果物のPath・target・protocol・toolchain・byte長・SHA-256からRuntime実行Identityを決定論的に算出し、Ed25519署名へ結合する。

兄弟Componentは名称やDirectoryの存在ではなく、固定公開入口と登録された検証・子入口からの実際の依存だけで署名閉包へ入る。再編後はAI AdapterのProfile／Provider計画、Domain Modelの用途別公開入口、実行知とVersion Controlの到達部分を新Path・metadataへ接続する。Orchestrator／MCP Server／CROSは検証入口から必要な部分を含めるが、Coordinator本体から上位操作を再公開する理由にしない。WorkbenchのBrowser BundleやReactを閉包へ無条件に加えない。公開入口は軽量な責務別exportを用い、Catalog解決だけでStore・管理画面・全Domainを引き込まない。新しい閉包は実装後に抽出・照合し、以下の旧母集団を改名するだけで一致済みとしない。

| 現行閉包の宣言 | 再編後の対象 | 同時に照合する利用側 |
|---|---|---|
| ai-runtime | ai-adapterの到達したProfile／Provider公開操作とmetadata | Coordinator実行・署名準備・検証入口。秘密Homeや外部CLI本体は別Ownerの実物検証を保持。 |
| project-operation／runtime-dataの宣言とcrdd-domain-libraryの利用側 | domain-modelの用途別公開操作と一つのpackage metadata | Root／保存／署名一時操作と、検証入口が使用する成果物操作。現在の宣言外利用も不足として照合し、未到達の全機能を追加しない。 |
| orchestrator | orchestratorの検証入口が到達した操作 | 本体の逆依存を撤去し、署名検証の実入口から下位呼出しまでを確認。 |
| mcp | mcp-serverの登録検証入口からの到達部分 | 配布Launcher、stdio／HTTP試験入口、CROS能力接続。旧REST／Gatewayは撤去。 |
| artifact-signing／cros／execution-intelligence／version-control | 維持するOwnerの到達部分とmetadata | 既存の暗号・認可・記録・Git意味と新利用側の接続を保持。 |

閉包表、Launcherのliteral import、子Process／Worker宣言、Source上の実呼出し、Package名・module解釈、Git由来、Native固定Pathを同じ改訂で更新する。表の予定処置だけからSource接続や署名検証Passを主張しない。

TypeScript依存は正規表現ではなく、コメント、文字列、template、正規表現literalおよび構文tokenを区別するFail Closedの字句解析で抽出する。静的import、再export、動的import、型専用bindingおよび値bindingは、前のsemicolonや改行位置から逆算せず、括弧と宣言の終端を先頭から対応付ける一つのmodule宣言解釈から導出する。許可するmodule指定は、Node.jsが実在を確認できる`node:`組込みmoduleと、閉じた実行集合内へ正規解決されるrelative pathだけである。bare package、絶対Path、`file:`／`data:` URL、escapeを含むspecifier、許可された一つの検証入口を除く非literalの動的import、解析不能なsource、実行集合外へ解決される依存を拒否する。`createRequire`、bare `require`または`process.getBuiltinModule`による保護moduleの再取得も許可しない。共通Launcherは入口表の各対象をliteral importとして所有し、入口表とliteral依存を双方向に照合する。

子Process、Workerおよび実行後Lifecycleの利用側閉包は、手書き一覧の存在だけでは成立しない。本番実行集合から導出したmodule宣言、能力binding、直接呼出しおよび全値利用と、許可するsource、所有関数、primitive、実行対象式、引数式、事前Authority証明および期待件数を持つ宣言集合を双方向に照合する。未知の実行対象、追加呼出し、別名・namespace・再export・関数値・property・依存注入による再搬送、または宣言だけで実利用がない状態を拒否する。CanonicalなPath、Identity、StateまたはCapabilityをConsumerが別の基準で再解釈・再構成してはならない。純粋な型import／型re-exportは実行能力取得とせず、値re-exportや未使用の値importは取得済み能力として扱う。固定`taskkill.exe`等の非Node成果物も、source単位の広い許可ではなく、正規の呼出し位置と証明済み実行対象へ結合する。旧revision、削除済みfield、別Path alias、Identity不一致または欠落fallbackを受理しない。

content rootでは、署名対象の`.ts`、`.json`、`.policy`、`.py`、`.txt`および`.Dockerfile`をLFへ正規化する。Windows CheckoutのCRLFとLFは同じ正本内容として扱うが、行内容、終端改行、単独CRその他の差分は同一視しない。Native成果物その他の非テキストは生バイトの長さとSHA-256を完全一致させる。README、CHG、Roadmap、品質記録、試験source、build設定その他の実行集合外の変更はリリースIdentityを変えるが、Runtime実行Identityを変えない。

Runtimeは現在CheckoutのRepository Tree全体を実行Authorityとして要求しない。固定manifest、閉じた実行集合、PolicyおよびNative成果物を起動前後に照合し、Runtime実行Identityの一致からAuthority候補を得る。これにより文書だけの修正後も同じRuntime実行Identityと既存の署名・E2E根拠を再利用できる一方、実行集合、PolicyまたはNative成果物が1 byteでも変われば再署名が必要になる。RecoveryもRepository Treeではなく、Runtime実行Identity、Operation、Resource、Provider／Home bindingおよびRecovery契約revisionへ結合する。

署名入口は、非秘密条件と配布候補を確認するP検査、秘密入力、P検査が発行した一回限りの不透明な能力を消費する独立S検査、秘密鍵読取り、署名、配置、公開結果の順序を唯一の実行経路とする。P検査は入力のdata propertyを一度だけsnapshotし、Accessor、Proxy、欠落または追加fieldを拒否する。S検査はP検査の観測値を署名値として流用せず、同じ固定入力から配布物、Runtime実行Identity、Release Identityおよびstaging sessionを再観測する。S検査へ渡す能力を偽造、再構成または再利用できず、別のoptions、fallback値またはP／Sの観測値を混ぜない。

保護対象経路の検証は、一般的なTypeScript解析器をRuntimeへ追加せず、CRDD公式Runtimeが宣言した署名、実行能力、回復および昇格の経路だけを限定した構文・binding・値由来グラフとして扱う。Actualグラフは実sourceの正規named import、所有関数、直接call、引数、結果binding、guard、最初のEffectおよび公開結果から導出し、独立に宣言したExpectedグラフと不足・余分の両方向で完全一致させる。別名、shadow、property化、関数値化、wrapper、結果再構成、guard前Effectまたは判定不能なescapeは拒否する。本文Hashとtoken列は変更検知の補助であり、binding、到達可能性、支配または値由来の証明を代替しない。

署名Source Aからmanifest carrier Bへの境界は、署名済みManifestをJSON文書として再生成する境界ではなく、不透明なbyte列を固定Pathへ昇格するRelease Effectである。署名器が固定`.crdd/tmp/signature/work/`で完成・flush・再読取り済みのfileを入力とし、昇格Coreは一時Root、Source file、Repository Rootおよび両親DirectoryのIdentityを保持する。昇格コード自身も署名対象の閉じたRuntime実行集合へ含め、署名済み一時集合内のLauncherだけを実行入口にする。作業Checkoutの未署名コードへ一時Pathを渡してはならず、実行元が検証済みRepository直下の固定`.crdd/tmp/signature/work/`と一致しない場合はEffect 0で停止する。最終Pathへ段階的に書き込まず、同一Filesystem上の排他的なhard link作成によって完成fileだけを一度に公開し、開始時のsourceと公開後の二名が同じfile objectを指すこと、byte数およびSHA-256を確認する。公開Effectの中ではPathによるsource削除を行わない。一時側の名前は所有範囲を再確認する明示清掃へ委ね、昇格成功結果には残存状態を返す。公開昇格入口はそれに先立ち、固定公開鍵による署名、Source AのCommit／Treeと選択FileのGit由来、一時集合内の閉じたRuntime実行集合、Policy、Native成果物、配置先Repositoryの現在HEADおよび配置先不存在を同じ候補へ結合し、昇格後にも同じ検査をやり直す。Git管理外の依存物や一時物をGit由来検証へ混入させず、実行集合のbyte完全性は署名済み一時集合から検証する。API呼出し、link要求またはfile存在だけを昇格完了としない。正式適用後は末尾の一時領域契約で清掃し、旧release候補Directoryを恒久保持しない。

昇格前の観測不能は不存在へ畳まずEffect 0で停止する。Process消失後は、`stagingだけに存在`、`stagingと最終Pathが同じfile objectを指す`、`明示破棄後に最終Pathだけに存在`の三状態を、同じ署名済みbyteとRoot／親Directory Identityで再構成して再入場する。二名が同じfile objectを指す状態を昇格成功の耐久状態とし、別Identityの二重存在、内容変化、Root／親Directory置換または観測不能では自動削除しない。公開後の失敗を推測rollbackせず、同じ昇格入口で正確な状態から収束させる。昇格成功はRelease Authority、Runtime Authority、Capability、Commit B、staging破棄完了または公開を単独では成立させない。

リリースIdentity、Runtime実行Identityおよび作業対象のExecution Revisionは同一ではない。一般Task開始前後に観測するExecution Commit／Treeは変更候補を作るRepositoryのIdentityであり、Executor候補の`baseCommit`／`baseTree`はこれへ一致しなければならない。CRDD自身のDogfoodingと、親RepositoryがCRDDをsubmoduleとして利用する場合を同じIdentityへ畳み込まない。

作業対象Commitから外部送信Policy等の明示ファイルだけを読む場合、Git object readerは許可された読取り投影へ到達するTreeと対象fileだけを処理する。投影外の通常file、symlinkまたはgitlinkは作業対象へ含めず、親Repositoryが別位置にCRDD等のsubmoduleを持つことだけで対象fileの読取りを拒否しない。ただし、選択Path自体またはその祖先がsymlink／gitlink／未対応modeである場合と、Commit全体を隔離候補へ展開する場合は従来どおり拒否する。限定投影を、gitlink配下の横断読取りや全体展開の許可へ拡張しない。

<a id="task-result-transport"></a>
<a id="task-turn-budget"></a>

## 10. Provider実行と候補

Reviewerへの結果指示は、選択肢を一つの文字列へ連結した疑似値をJSON例として示さない。承認時と変更要求時の具体的な閉じたObject形を別々に示し、余分なkeyを禁止する。Provider CLIのSchema機能に既知の複合配列不具合がある経路では、Schema強制を成立済みと推定せず、通常JSON EnvelopeをCRDD所有Validatorで厳密検証する。拒否時は生Provider本文、未知key名、SummaryまたはFinding本文を公開せず、Top-level key、decision、summary、findings、個別findingおよびdecision整合のどの構造条件で停止したかだけを固定Reasonへ分類する。同じRole／Providerで一回成功したことを後続応答の形式保証へ昇格しない。

Provider CLIは固定Docker image、最小環境、専用Provider Home session、限定Egress、上限付きstdout／stderr、turn、時間およびProcess treeで実行する。親環境、Proxy、PATHまたは別Provider Credentialを無条件に継承しない。

Host上のDocker CLIは固定の公式配置からだけ取得し、OSが有効と判定したDocker IncのAuthenticode署名、Filesystem実体および必要Capabilityを確認する。通常TaskではDocker DesktopまたはDocker CLIの過去の特定Version、Hash、byte数との一致を実行条件にしない。TaskまたはRecoveryへの再入場ごとにCLI IdentityとHashを観測し、その一つのOperation内では同じ値を保持する。観測中または実行中の差替え、署名不成立、Publisher不一致、配置不一致または必要Capability不成立ではDocker Effect前に停止する。特定VersionとArtifactを固定するDocker Desktop修復PolicyはHost状態を変更する限定修復だけに用い、通常Taskの互換性判定または更新許可へ流用しない。

Authenticode検査を実行するPowerShellには、Docker CLI用の中立化環境を流用しない。Native OS観測から検証したWindows Directoryと現在主体のUser Profileを基に、`SystemRoot`、`WINDIR`、`USERPROFILE`、OS標準Directoryだけの`PATH`および固定`PATHEXT`からなる専用環境を構成する。親Processの環境値、Proxy、Credential、NodeまたはDocker設定は継承せず、PowerShellのAuthenticode機能の成立に必要なOS初期化情報だけを与える。直接起動だけでなく、中立化したRuntime子Processからの多段起動でも同じ検査が成立することを結合試験する。環境更新をVersion／Hash固定で拒否せず、署名検査Process自体とPublisher Trustの両方を確認できない場合だけDocker Effect前に停止する。

Providerへ指定するturn数は、検証済み作業量から算出する実行目標であり、Runtimeが直接強制した絶対上限とは扱わない。Providerが指定値を超える成功応答を返し得る境界では、Runtime所有のtimeout、出力量およびProcess停止を実効的な強制境界とし、Provider報告turn数は別の絶対受理上限まで検証する。指定値超過を正常な上限遵守へ読み替えず、有用性評価とProvider更新判断で追跡する。絶対受理上限を超える結果、turn数が不正な結果または上限到達を示す失敗結果は採用しない。

Provider ProcessのLifecycleはTypeScriptが所有する。固定Digest image、exact Provider CLI versionおよび自動更新停止を管理対象依存として扱う。Shell、PATH、Host既定Home、Host CLIまたはAPI keyへfallbackしない。更新時はimage／CLI Identity、利用側、検証および復旧を再評価し、人間が有効化する。

Process、Workerまたは対話入力Readerの生成を所有する本番leafは、起動前提の確認、handle取得、取消登録、完了観測およびcleanup後条件を一つのLifecycleへ接続する。生成済みhandle以降の状態遷移を共通化する場合、専用の内部Lifecycle moduleへ閉じ、本番では対応するleafだけが利用する。内部Lifecycle moduleは、対象module、公開symbol、利用leaf、所有関数、引数の由来、事前に成立すべきhandle生成／観測、および結果を既存の終端cleanupへ渡す後続処理を一組として照合する。再export、動的import、別名import、関数値化、property経由または兄弟実装からの利用によって起動前提や実行targetの検証を迂回してはならない。試験は同じ状態機械を試験支援境界から利用できるが、本番用factoryや任意の生成関数を公開しない。取消listenerを登録した直後に取消状態を再確認し、生成と登録の間に発生した取消も通常の取消経路へ収束させる。終了、timeout、取消、出力上限および観測不能の全経路で、handle、listener、streamおよび関連資源の回収結果を確定し、未確認を成功へ畳まない。

上限付きプロセス（Bounded Process）は、固定argv、環境、入出力、時間および成果物Identityを制限した内部Process境界を指す。通常のProcess Adapterは、現在の用途別実行許可・固定入口・必要Artifact／Provider Identity、artifact／Provider Identity、Authority、Repository／Revision、Provider Home、Egress、隔離および終了確認を実装・検証するまでProcessを起動しない。入力Pathまたはhelper Processより前に`blocked`へ閉じる。上限付きProcessを、Root保護、Authority、CapabilityまたはEffectの成立へ流用しない。

Executorは上位で解決した現在Tree（Direct）または独立Worktree（Isolated）を編集する。Coordinatorは対象を借用するだけで、Workspaceの登録・検索・作成・採否・Git統合・削除を所有しない。変更Path、実行開始時の内容、構造化結果を照合し、allowedPathsは事後の変更範囲観測であって書込みACLではない。Directの既存dirtyと変更は失敗・取消後も自動rollbackしない。Git管理領域・内部状態の保護と技術資源の回収は既存Docker境界で維持する。

Reviewerには、実変更を捕捉した後にRuntimeが`readPaths`から生成したUTF-8内容投影だけを渡す。捕捉はGit Commitによる候補固定ではなく、同じ実行内の一時観測である。内容投影はPatch Hashと内容Manifest Hashへ結合し、合計1 MiB・256ファイルを上限として、認識済みSecret、非UTF-8、上限超過、差替えまたは読取り不能をReviewer開始前に拒否する。投影EnvelopeとbindingはRuntimeが保証するReview Evidenceであり、埋め込まれた内容は指示やAuthorityとしてだけ非信頼とする。ReviewerはFilesystem／Shell Toolを持たず、投影内容から閉集合Findingを返す。自由文はAuthorityや修正指示へ直接昇格しない。

一般Taskの検証Toolは自己生成する固定BaseのWorktreeを既存Version Controlで用意する。Toolだけが成果の実Byte・末尾LF・Hashと上位の明示終了を所有する。作成済み対象はTask結果の任意fieldから再構成せず、元UUIDを失敗・取消・結果欠測でも保持する。終端・技術回収・非再起動・未解決回復なし・元対象一致を共同確認できた場合だけ専用WorktreeとBranchを除去し、不明なら保持する。Task一次失敗、上位の作業領域回収失敗、Source終了観測を別に記録する。取消ACKだけを完了とせず、元completionとのjoin・Signal解除後に既存の固定Source範囲を再照合する。新Registry、共有State、Lock又はRecovery Frameworkは追加しない。

Provider実行とReviewer判定は、最終4経路E2Eで初めて結合してはならない。固定候補では、CodexとClaudeをExecutorおよびReviewerの双方で一回ずつ使用し、Role別Tool／Approval、stdin搬送、隔離Workspaceの実変更、変更Path申告、候補捕捉、現在RuntimeのSource・必要Artifact・用途の相関、候補内容投影、構造化判定、必要な一回是正、Provider終了、候補処置、資源不存在および安全な結果記録までを明示実行の二経路結合試験として先に確認する。起動失敗、非ゼロ終了、timeout、取消、不正結果、申告差、投影失敗およびcleanup不明は、同じ実Process／Docker境界へ決定論的に注入して反証する。通常回帰は外部Provider Effectを発行しない。実Reviewerが拒否した場合は、生の応答や自由文を公開せず、判定、Finding件数、severity／path／category／criterion、message Hash、投影Hash、対象fileのbyte長／Hashおよび是正有無だけを保持し、投影不一致とProvider判断を切り分けられる状態にする。

CLI optionは個別の存在だけでなく、同時指定する全optionの組合せと実Workspace変更を固定Binaryの実境界で反証する。Codex Executorは、外側のDocker境界と固定CLIの内部bubblewrapを共同で成立させる。固定CLIには`--approve-for-me`を指定し、内部Sandboxを無効化しない。Dockerは非root user、read-only root、Capability全削除、限定Workspace mount、Network proxyおよび終了後資源不存在を所有する。Executor Containerだけは、Moby既定seccompを基礎に`clone`、`clone3`、`mount`、`pivot_root`、`unshare`、`umount2`を追加許可した用途拘束された固定profileを使用する。この追加集合は内部bubblewrapのnamespace構築に限定し、`seccomp=unconfined`または`CAP_SYS_ADMIN`へ拡張しない。内部SandboxはWorkspaceの許可範囲とProvider HomeのCommand非到達を所有する。profileのPath、byte長またはSHA-256が同じ操作で確認した必要Artifact Identityと一致しない場合はProvider Effect前に停止する。固定profileのPathと実体はDI planner内の非公開Resolverだけが観測する。AdapterのCommand生成とDocker Effect側のCommand再検証は同じ期待Identityから固定実物を再観測し、同一commandを要求する。上位へ固定Host Pathを返すAPIは持たない。既存Contextの清掃は元Owner・plan identityで照合し、新しいArtifact観測を条件にしない。ConsumerがPathまたはoption列を独自に再構成しない。Reviewerは`approval_policy="never"`と`--sandbox read-only`を明示し、Shell／Filesystem Toolを無効化する。

固定Codex CLIの正常終了と構造化結果だけでは、書込みToolを試さなかった状態、拒否された状態、完了した状態および候補捕捉の失敗を区別できない。固定CLI `0.149.1`ではJSON Linesの実行Eventを内部搬送に使用し、Command実行とFile変更について開始・完了・失敗・拒否の件数、Command終了code、Tool系統、既知の失敗分類およびTurn完了だけを非Authority診断へ投影する。Tool系統はPython、POSIX text、Gitおよび`apply_patch`の閉じた区分とし、失敗は権限、read-only Filesystem、Path不存在、Command不存在、構文、Sandboxおよび未分類の区分とする。Command本文、対象Path、生Event、生出力およびProvider本文は公開しない。この診断は候補Filesystemの実差分を置換せず、Provider申告、実行Eventおよび候補捕捉のどこで不一致が始まったかを切り分けるためだけに用いる。CLI版またはEvent契約が変わる場合は、同じTransportとして推定せず再検証する。

<a id="7-cleanup依存順"></a>
<a id="22-docker-desktop最終復旧時の起動環境"></a>

## 11. 取消と回復

一回目のCtrl+C、timeoutまたはowner lossは取消要求であり、完了ではない。CoordinatorはProvider子孫、Container、network、Mount、Console reader、候補およびlockを依存の逆順で回収する。二回目の割込みは回収を省略する許可ではない。

回収を直接観測できなければ、exact Recovery ID、`manualRecoveryRequired`、`processRestartRequired`および`effectStateUnknown`を保持して停止する。新しいProcessで同じRepository・選択ユーザー・配布Identityへ再結合できた場合だけ復旧を続ける。復旧後も元Taskを自動再開しない。

Docker Desktopの破損時は通常Taskと分離した最終復旧経路を使う。対象Process、固定artifact、mutex、耐久記録、Directory Identityおよび再開条件を確認する。親Directory renameはWindowsの限定最終手段であり、推測削除や無条件再起動を行わない。

### 元の回復参照を確定できないHost残存の保守候補

**現状: 候補判定、現在観測とcaller記録の内部接続まで実装した。保守Authority、公開入口、削除処理と一連の実境界確認は未接続であり、回復成立ではない。** 同じCHG-000082で限定経路を追加する人間判断は得ているが、既存三件の処置は対象を提示した別の承認が必要である。

現行実装の対象候補は、Coordinatorが作成した`host_only`記録と対応する六つの空の子Directoryだけを持つHost作業領域に限定する。元Tokenをmarkerから生成し直さず、人間が新たに承認した単一対象の保守と、元Taskの回復Authorityを分ける。2026-10-04に、後述の既知試験ファイル一件を別クラスの設計対象へ含める人間判断を得た。これは現行の空クラスへの非空受理、実停止・削除承認または実装済みの主張ではない。後述の一件以外の非空領域、別状態、Docker資源、永続Provider Home、由来不明な領域および汎用強制削除は対象外である。

| 必須条件 | 保存・確認する根拠 | 不成立時 |
|---|---|---|
| 対象と人間承認の一致 | 選択ユーザー、Runtime／Repository結合、対象snapshotのHashとfreshな明示承認。snapshotは親、記録Directory、marker、Root、六childのexact Identity、marker bytes、固定child集合と空観測を含む。取得時刻と比較対象Hashを分ける。 | 対象変更、承認欠落または不明なら処置前にEffect 0。 |
| 所有範囲と現在Identity | 許可したOS管理Root内の由来・所有主体と、全対象のfreshな一致。名前、prefix、marker自己申告だけを根拠にしない。 | 範囲外、差替え、別世代、reparseまたは観測不能を拒否する。 |
| 非使用と初期化中の排他 | 作成前から最終清掃までの連続した排他、および対象を使用し得るproducer／consumerの閉じた母集団。旧形式には別の移行根拠が必要である。 | KernelLock取得成功、六childが空または既知Process件数0だけでは非使用確認としない。旧形式の根拠が不明なら停止する。 |
| Dockerとの非結合 | 対象に結合する耐久記録と現在の観測で、Docker bindingの明示不存在を確認する。 | 未観測・破損を不存在へ畳まず、Docker清掃へ範囲を広げない。 |
| 耐久的な進行記録と再入場 | Repository-local `.crdd`を使う場合は非Authorityのcheckpointに限定し、再入場ごとにfreshな人間承認と保護済み対象へ再結合する。次Processの削除許可を発行する記録は別の保護済みRecovery Authorityであり、自己申告JSONから発行しない。 | 別対象への再結合、承認範囲の拡張および欠測の成功化を拒否する。 |
| 処置後の直接観測 | 将来の処置実装では非再帰の限定削除後に六child、Root、markerの明示不存在、handle／observer／Lockの解放と記録の終端を確認する。 | 部分処置または観測不能は回復義務と処置事実を保持する。Effect発行後をEffect 0と表示しない。 |

候補判定は[内部Policy](../../../40_Develop/coordinator/src/host-execution/orphan-recovery-policy.ts)が所有する。十一条件の値を閉じたSchemaで照合するだけで、根拠の実在性を証明しない。`candidate_ready`でも`authorityConferred:false`、`cleanupConfirmed:false`、`productionConnected:false`を維持し、回復Token、Pathまたは削除Capabilityを返さない。この診断断面をARCH-000008へ接続し、実処置はその診断Authorityへ追加しない。

後段の接続順序は、対象観測→人間へのexact対象提示→限定承認→連続排他とfresh再確認→限定処置→不存在・資源解放観測である。部分処置後の再入場は事前固定した対象と許可した進行だけを扱い、初回snapshotと同じ完全存在を要求して回復不能にしない。

#### 既知の7バイト試験ファイルを含む対象

**設計対象への追加は承認済み、専用記録codec・十二実体の観測搬送と保存前Known照合は局所確認済みである。Native保存・読戻しはSource上で接続し、取得前拒否を実CLIで確認した。Coordinator Adapter／caller耐久記録もSource接続し、自己生成Repositoryの保存・読戻し・非置換を局所確認した。正常な固定OS保存・Native読戻しと公開処置は未成立である。** 対象は既存Root `crdd-coordinator-doctor-26606538-94a3-4b8a-bee3-40c14195e3f6`の`workspace/fixture.txt`一件である。現在の`empty_host_only_v1`、十一実体の観測・intent・Protocolは変更せず、空クラスと混在しない別クラスとして具体化する。既知bytesとの一致は試験データとの対応であり、元Taskの由来、非使用または削除Authorityを証明しない。

| 必須条件 | 固定する内容 | 不一致・未確認時 |
|---|---|---|
| 単一対象 | 人間へ提示したRoot・marker・六childと、`workspace`直下の固定名`fixture.txt`だけを対象snapshotへ含める。Root直下は六childだけ、他五childは空、workspace内は当該fileだけである。 | 別Rootへの暗黙適用、別名、追加entry、列挙不能では処置前に停止する。 |
| file実体と内容 | 保持した同じhandleで通常file・非reparse・リンク数1、五識別値と属性、サイズ7bytes、全bytes・EOFを確認する。SHA-256は`be9351741a8155d01fd028d158546f1005e73ceeb0bb2d093335feac4144e450`に限定する。 | fileとDirectoryの代替、hardlink、リンク数不明、差替え、部分read、サイズ・Hash差を拒否する。通常fileという表示だけでリンク数1を推定しない。 |
| 非使用・人間承認 | 当初の利用終了、全既知consumerの再入場抑止、同世代排他、Docker bindingの不存在、freshなexact対象の人間承認を空クラスと同じく要求する。 | 人間の「別途使っていない」という申告やfile内容一致だけから、終了・非使用・削除許可を作らない。 |
| 連続保持 | 最終Nativeが同世代排他と対象の保持を処置前から終了まで所有する。fileのwrite／delete競合を拒否する共有条件で同handleを保持し、Identity・内容を確認してからそのhandleへ限定処置を発行する。 | Path再openへの持替え、親喪失による早期解放、競合または必要保証不明では処置しない。 |
| 処置と不存在 | 当該file→六child→Root→markerの順に非再帰で処置し、各直接不存在、全reader／handleの終了、最後の同世代排他解放を確認する。 | 削除要求受理を不存在としない。互換readerの残存、close不明または観測不能は未完了として保持する。 |
| 部分処置・再入場 | 処置前snapshotへfileの実体・サイズ・Hashを追加し、同じ参照と許可した進行を保持する。処置済みのfile不存在と、未処置の同file実体を区別して再入場する。 | 欠測を処置済みへ畳まない。同名fileの再出現、異なる実体、矛盾または新しい承認なしの再入場を拒否する。 |

このクラスはnamespace三実体と既存のRoot・marker・六childにfile一実体を加えた十二実体を扱う。空クラスの十一実体へfileを黙って除外・合成して保存してはならない。既存記録を新Schemaへ後付け変換せず、異なるクラス・改訂版を明示拒否する。専用codecでは`contractRevision:3`と`resourceClass:known_fixture_host_only_v1`を候補として扱う。旧revision 2のcodec・保存・Native入口とは別型・別入口とし、搬送一式の完成前に全Protocolの正式固定とは扱わない。

記録codecはRootの構造とmarker名の世代対応を検査するが、特定Rootの処置許可を所有しない。上位の対象選択Ownerが承認済みのexact Rootと選択snapshotへ結合する。codec単独で別Rootの形状を受理しても、保守対象・削除Authorityを拡張しない。

| 記録候補のfield | 固定条件 |
|---|---|
| `contractRevision`／`resourceClass` | `3`／`known_fixture_host_only_v1`。未知field、クラス・改訂版差を拒否する。 |
| `producer` | `human_orphan_cleanup`だけ。選択snapshot Hashと`original_reference_unconfirmed`を保持し、通常owned producerと混在しない。 |
| `target.knownFile` | `parent:workspace`、`name:fixture.txt`、六u32 Identity、`byteLength:7`、上記固定SHA-256、`linkCount:1`。十二実体はvolume／file indexで相異なる。 |
| `cleanupOrder` | `file_absence → root_absence → marker_absence → lease_terminal`。六childの処置はRoot不存在に先立つ条件であり、順序省略を許さない。 |
| 正規bytes | 固定key順・改行なしUTF-8、8192bytes以内。BOM、重複key、余剰bytesと非正規数値表現を拒否する。期待値の受理を実観測へ昇格しない。 |

| 接続先 | 必要な処置 | 現在状態 |
|---|---|---|
| Coordinatorの候補Policy・対象観測 | クラスを区別し、固定entry集合・file内容・リンク数と同世代非使用を別の条件として照合する。 | 未接続。空クラスの受理条件を維持する。 |
| intent codec・選択Hash・caller checkpoint | 十二実体とfileの固定内容を同じ選択へ結合し、保存・読戻し・部分進行で落とさない。 | 専用候補codec、Adapter／caller耐久記録と二時点観測から選択Hash・完全記録を準備するSourceを接続し、局所field差・部分失敗と自己生成Repositoryの保存・読戻し・非置換を確認済み。正常Native保存と最終処置への接続は未成立。現行十一実体の記録を新クラスへ使わない。 |
| Native Protocol・Current／Known・保存・読戻し・最終処置 | file保持、bounded読取り、リンク数、個別close、処置事実と同参照の再入場を共同搬送する。 | 専用Current／namespace-Knownの搬送と私有の全十二対象Known照合を自己生成対象で局所確認済み。namespace-Knownは全対象Knownではない。十二実体用のNative保存・読戻しdispatchと既存writer／readerはSource上で接続し、本文Hash差の取得前拒否を実CLIで確認した。Coordinator Adapter／callerも専用入口へSource接続し、局所frameと自己生成caller保存・読戻しを確認した。正常な固定OS保存・Native読戻し、最終処置、現在固定入口・必要Artifact確認・本番回復接続は未成立。旧署名Runtimeの結果は比較基準に限定する。 |
| Host／Docker exact回復、診断、通常作成 | 通常経路は既存契約で継続し、限定保守と同じ旧世代の排他へ接続する。新規作成は旧Rootを再利用しない。 | 既存の接続確認を維持する。元の生存中owned能力・旧版閉包の終了根拠は未成立。 |
| Qualityの既存Local Item | PRL-UT-006と回復・清掃の関連項目へ正常、差替え、未知entry、hardlink、内容差、reader残存、親喪失、途中処置と再入場を接続する。 | 新クラスの記録候補・観測搬送を局所UT、同handle観測・十二対象Knownを自己生成対象の局所ITで確認済み。保存・実Recovery・清掃の全義務は未成立。既存の空クラスPassを流用しない。 |

発火例は、指定した一件の全実体・固定bytes・非使用・fresh承認・保持条件を確定できた場合である。非発火例は、別file、任意の非空領域、通常のexact回復またはDocker結合がある場合である。境界例は、Hashが一致してもhardlinkが二つある場合、あるいは削除要求受理後に互換readerが残る場合であり、前者は処置前拒否、後者は未完了として保持する。判定情報不足例はリンク数・列挙・当初利用終了の不明であり、空や非使用へ補完しない。

#### Coordinator所有範囲で非使用を確認する設計条件

Windows全体の再起動を前提にせず、Coordinatorが所有する処理の終了と、対象を再利用できない状態を限定清掃まで保つ方向で設計する。以下は未接続の後段が満たすべき条件であり、現行Sourceの実装保証または既存三領域の清掃許可ではない。対象を使う処理が閉じていることを確認できない場合は停止し、Coordinator所有外のProcessを一括停止しない。

| 境界 | 必要な保証 | 反証／停止条件 |
|---|---|---|
| 新規取得・初期化 | 対象を作成する前から、利用受付と初期化が限定保守と競合しないことを同じ所有境界で強制する。途中取得失敗も保持・回復・資源解放へ接続する。 | 作成後だけのLock、未処置の初期化経路、取消後の遅延取得。 |
| 利用・診断・通常回収 | 通常Taskだけでなく、受動Doctor、検証Script、通常exact ID回復と保守を通じ、対象へ触れる全利用側の排他と終了を接続する。 | ロックを通らない利用側、新たな受付、再入場による旧対象の利用。 |
| 所有Processと資源 | 対象へ結合したNode、Supervisor、Native／Provider子孫、Docker資源等、実在する利用者をexactな世代Identityで区別し、終了要求と実終了を分ける。全OS Processや全Docker処理を対象にしない。 | 子Process・待機・observer・handle等の残存、結合不明、終了観測不能。Docker一覧だけの空観測。 |
| 旧形式の移行 | 新排他の導入だけでは旧形式の非使用を証明しない。旧対象を利用できる処理と入口の閉包、終了および再利用抑止を別に確認する。 | 旧版・複製したRuntime・別入口の利用可能性が未確認。Process名や件数0だけの判定。 |
| OS限定処置 | 対象Identityの差替え防止と、処置時の使用・再利用防止を実環境が提供する保証へ接続する。Pathやhandleの取得だけを保証成立としない。 | 保証不明、使用中、対象不一致、部分処置または観測不能。 |

#### 旧形式に限定した実接続の最小案

**既存Supervisorを通常経路で維持し、限定清掃を行う最終Native自身が同じ旧世代の排他を保持する。** 以下はSourceとの着手前照合で得た接続案であり、実処置・公開契約の完成や実三件の許可ではない。全通常利用側のSupervisor置換を、限定回復の暗黙の前提にしない。

| 必要な保証 | 最小接続 | 拒否・変更禁止範囲 |
|---|---|---|
| 同じ旧世代への結合 | 固定Root名のUUID suffixからnonceを導き、marker名の`SHA256(nonce)`由来、fresh marker本文の`rootName`、保持したmarker実体／全bytes Hashを共同照合する。旧`host-recovery/v1`本文にはnonceがないため、本文からの読取りやfield追加は要求しない。既存`hostOperationGenerationBindingHash`と同じdomain・順序・UTF-8で排他名へ結合する。 | nonceを元Tokenや処置Authorityに変換しない。名の対応は準備入口で拒否できるが、本文・実体のfresh確認とNativeでの排他保持は別の未成立条件である。別世代、不明な旧形式や対象差では停止する。intentの成功fieldや新Canonical IDを追加しない。 |
| 旧世代への再入場抑止 | Host exact回復、Docker exact回復および診断回復が使う同じHostOperation排他を、処置するNative Processが直接所有する。 | Node／Supervisorだけの保持に依存しない。親喪失で排他が先に解放され、Nativeだけが処置を継続する反例を拒否する。 |
| 当初の利用終了 | 当初Process、実際に対象を利用した子孫、生成実行物と既知consumerの閉包を独立根拠で確認する。通常作成が新UUIDだけを受けることと、当初owned能力が生存中に旧Rootを利用し得ることを区別する。 | 新しい排他の取得、名前、空状態、`host_only`、Process一覧0を当初Processのexact終了へ昇格しない。旧Runtime・検証入口の結合不明では処置前に停止する。 |
| 処置と終了 | 同参照読戻し→fresh承認→Nativeの同世代排他→現在の記録・対象・非使用／Docker binding再確認→六空childの非再帰処置→Root直接不存在→exact marker処置・直接不存在→全Reader終了→排他解放。 | 未知entry・非空内容・使用中・観測不能は拒否する。途中処置の事実と未解決参照を保持し、記録書込みや通知上成功だけから不存在・全終端を作らない。 |

発火例は、元Authority不明でも同じ対象・旧世代・非使用根拠・fresh承認を確定できた空`host_only`領域である。非発火例は通常の正当なexact回復、Coordinator外の領域、非空対象またはDocker bindingを持つ対象である。境界例は当初Processが終了していても旧exact回復が排他を保持している場合で、取得競合として処置0へ停止する。判定情報不足例は生成元／当初Processの終了根拠が欠ける場合であり、現在のProcess件数0から補完しない。

この最小案の確認は、小部品の三観点反復を追加せず、入口から最終不存在・排他解放までの固定候補へ統合する。必須の独立技術確認、文書確認、直接影響確認は維持する。実際の旧三領域はこの表だけから処置可能とは判定しない。

Native読戻しは同じ旧世代の排他を自身で保持し、記録Readerと外側guardの終了後に解放するSource接続まで実装した。応答revision 2で取得と解放を個別搬送する。自己生成した世代では、同期Node Workerと非同期Supervisorの両経路で相互の取得拒否と解放後の再取得を[局所確認した](../../../99_Roadmap/Changes/CHG-000082/Evidence/261002_host-orphan-recovery-design.md#非同期supervisorとの排他相互運用--2026-10-04)。現在固定入口・必要Artifact確認を経た正常搬送、旧版consumerの終了、異常・親喪失経路と最終清掃の連続保持は未成立である。読戻しの終了を別操作への排他引継ぎ、元利用者の終了または実対象の非使用確認にしない。

#### 共有回復記録Directoryの所有と初期化

複数TaskのHost回復記録を保持する共有Directoryは、Coordinatorの管理資源であり、一つのOperationの一時Rootではない。Operationの作成失敗・通常清掃・回復では共有Directoryを削除せず、対象Operationへ結合したRoot・marker等だけを処置する。共有Directoryの管理清掃を本経路へ暗黙に追加しない。

| 初期化状態 | 処置と結果の意味 |
|---|---|
| 既存Directoryのfresh検証成功 | 固定parent／child、実DirectoryとIdentityを確認して再利用する。既存markerの本文やHashから回復Tokenを発行しない。 |
| 未存在からmkdir成功、検証成功 | 共有管理資源として保持する。後続Operationが失敗しても共有Directoryはrollbackしない。 |
| mkdir呼出しがEEXIST | その通知だけを成功・由来・Authorityにせず、同じfreshな境界・実体・Identity検証へ戻る。別の観測や検証で生じたEEXISTを成功扱いしない。 |
| 初期観測不明、mkdir失敗、境界・Identity検証失敗 | `cleanupConfirmed:false`、`hostRecoveryId:null`を上位へ保持し、`manualRecoveryRequired:true`で停止する。Root／marker未作成とnamespace状態不明を分け、全Effect 0とは表示しない。 |

namespace初期化の失敗ではexact Token回復へ接続できない。Tokenを生成せず、Operatorによる共有Directory状態確認へ移送する。再入場は通常作成入口のfresh検証から行い、不明の間は停止する。自動retry、元Task再開または共有Directory削除は行わない。成功した共有Directoryの存在だけをOperation清掃の失敗にせず、Operation所有資源の終端と未解決のnamespace初期化失敗を区別する。

この所有分離は作成前からの連続排他、OSによる差替え防止、全利用側移行または旧三領域の非使用を証明しない。これらのOPENは維持する。

#### 同一Processの排他と終端追跡の接続候補

**現状: 内部状態機械を局所試験で確認する段階。本番入口、OS Adapter、Root／markerの処置および全利用側の移行は未接続である。** 排他は対象へ触れるCoordinatorと同じProcessが所有する候補を用いる。別Supervisorだけが先に終了して親の同期処理が継続する反例を避ける。限定実測の四場面は[変更記録](../../../99_Roadmap/Changes/CHG-000082/Evidence/261002_host-orphan-recovery-design.md#同一processの排他候補--限定実測)に置き、実測だけで本番保証を宣言しない。

| 状態・通知 | 候補が保持する条件 |
|---|---|
| 取得前の取消 | listenを開始しない。取得なしと、生成後の終端未確認を区別する。 |
| 取得待機中 | 公開結果とは別に取得要求の保留を保持する。期限・取消だけでcloseを先行せず、listeningまたはlisten_failedまで購読を保持する。取得より先のclose通知は、その後の取得の終端根拠にしない。 |
| listening | 取消・失敗がない場合だけ保持中として返す。後着取得は同じOwnerがcloseへ接続する。 |
| error、予期しない通知または解放開始 | 新しい利用を拒否し、失敗を単調に保持する。close要求を一回に限定し、各受理socketの終端も確認する。 |
| 取得要求の通知上settlement、その後のclose通知と全受理socketの終端 | Transport通知上の終端を返す。native endgame、全OS handle不存在、Root清掃またはOperation全体の`cleanupConfirmed`とは別である。 |
| close throw、期限または観測不能 | 終端未確認としてOwnerを保持する。後着通知を処置しても、先に返した不明結果を成功へ書き換えない。 |

局所試験と将来のOS Adapterは同じ内部状態機械を用いる。試験用依存から本番の削除権限を発行せず、公開indexへ入口を追加しない。実装境界はCoordinatorの既存security Ownerに閉じ、新しいSubsystem、addon、汎用Lock機能または任意Pathの利用入口を作らない。

全利用側移行の前提は、**同じ内部Identityへ結合した非Authorityの耐久終端記録を先に確定し、Root処置・直接不存在→exact marker処置・直接不存在→排他解放を順に確認する**ことである。解放後にmarkerを削除する案は排他外の処置を残すため採用しない。終端記録は所在と処置進行の手掛かりであり、元TaskのToken再発行、削除許可、非使用証明または成功証明にしない。次Processはfreshな権限・Identity・資源観測へ再結合し、記録単体からEffectを発行しない。

終端記録の候補契約は次節へ具体化する。候補契約の定義と、保存・保護・公開・再入場の実環境での成立は別である。後者と各資源の共同終端条件を確認するまで、Root／marker処置、既存Supervisorの置換および全利用側の移行を開始しない。同期wrapperへPromiseを渡すだけの変更も行わない。旧三領域、新実Task停止、実停止・実削除の別承認および全体品質は不変である。

#### 終端記録の保存・再入場の候補契約

**目的は、Rootや元markerがなくなった後にも、未確認の排他解放を同じ対象として追えることである。** 記録の存在・Hash・保存済み進行から、削除権限、現在の非使用または成功を発行しない。以下は本番未接続の設計候補であり、現在のLoader、Windows保護または清掃の実装保証ではない。

| 所有する項目 | 候補契約 | 接続前に確認する条件 |
|---|---|---|
| 保存先 | 既存の検証済みOS temporary parent内にある`crdd-coordinator-recovery-v1`の固定child `terminal-v1/`。対象Rootと元markerから分離し、任意Pathを入力にしない。 | parent、共有Directory、固定childの実体・Identity・非reparse境界をfreshに確認する。Operation清掃で共有Directoryを削除しない。 |
| 記録保護 | 同じ利用者のCoordinator管理資源として、書込み主体、所有者、アクセス制御、処理中の差替え防止を確認する。 | 現行の実Path・属性・Identity確認や`0700/0600`をWindowsの所有者／DACL保護の証明にしない。保護不明ではRoot／marker処置0。 |
| 参照の取得 | 最初の記録Effect前に、同じ処置対象へ結合した非Authorityの内部参照を一回確定する。stageと公開先はこの参照から決定する。 | Process喪失後にも参照を取得できるcaller側の既存耐久接続を確認する。Process内変数だけでは不足。取得前失敗では参照を捏造せず、取得後の結果・例外・再入場では同じ参照を保持する。 |
| 記録内容 | 固定Schema／Revision、参照、producer種別、対象Root・元marker・固定childのIdentity、必要なbyte Hash、元参照との関係または不明理由、処置対象と順序を保存する。 | 自由Path、秘密値、元TaskのToken再発行、成功を自己申告するfieldを受理しない。元marker消失後も対象の結合情報を失わない。 |
| 公開 | caller-known stageへ完全なbounded文書を書き、file flush後、同じwriterを保持した非置換renameで公開する。stage直接不存在、public実体・完全なbytesとreader closeを別に照合する。Nativeの私有部品は[platform-access](../platform-access/01_Architecture.md#host終端記録の内部保存部品)が具体化する。 | 書込み・flush・rename要求だけを確定にしない。公開不明や衝突で上書き、再rename、復元、別参照の再発行またはRoot処置を行わない。 |
| 耐久範囲 | 公開各段階のProcess喪失と再入場を確認する。 | Directory自身の耐久化、OS喪失・電源断後の残存は別の未保証条件。file flushだけで全耐久性を宣言しない。 |
| 容量と受付 | 初期候補値は一文書8KiB、stage／公開先を合わせた物理entry上限1024件、総byte上限8MiB。併存する二名の両方を計数する。 | 全producer共通の予約・計数で並行超過を防ぐ。上限／計数不明では新Root取得前に停止する。既存参照の読取りは継続できるが、新記録が必要な回復Effectは上限を迂回しない。値は接続前の固定候補レビューで確認し、削除許可にしない。 |

保存原理は[Runtime Dataの一時Operation管理](../domain-model/03_Repository_Storage.md#42-operation所有契約)と照合するが、その実装をHost清掃へ接続済みとは扱わない。Nodeのfile modeはWindowsで利用者別アクセス制御を表さず、現在方式のno-replace公開と保持中保護はNativeの実境界で反証する。旧hardlink二名は新方式へ自動収束させず、保存方式／producer版との再入場対応をOPENとして残す。stage不存在は観測時点の事実であり、親保持だけから後続のstage新規作成禁止やclose後不変性を主張しない。

| producer | 結合元 | 禁止する推定 |
|---|---|---|
| 元exact参照を確認済みの通常清掃 | 現在の所有世代、Root、nonce、記録Hashと既存回復関係。 | 記録単体から既存Authorityを再発行すること。 |
| 元参照不明の限定保守 | 人間に提示したexact Root・marker・六child snapshotと、今回の保守選択Identity。 | marker本文や名前から旧Token・旧nonce・旧Authorityを復元すること。新lease取得を旧利用者との排他成立とみなすこと。 |

通常清掃は現在の正当な所有／回復契約へ再結合し、限定保守は新しいfresh承認と保護済みlineageへ再結合する。どちらも同じ対象の現在Identity・非使用・連続排他を確認し、保存済みの確認結果を流用しない。変更によって元Taskを再開しない。

| 再入場時の記録観測 | 許可する記録上の処置 | Root／markerへの処置 |
|---|---|---|
| stageのみ | exact参照へ結合した完全な文書・保護・実体を確認した場合だけ公開を継続する。不完全／不明では保持して停止する。 | 公開の確定前は0。 |
| stageと公開先の二名 | 旧hardlink候補、または現在方式では不整合の候補として保持する。方式／producer版・実体・bytesと現在参照を照合する再入場処理が未接続のため、自動改名・除去をしない。 | 追加処置0。旧二名の移行・再入場はOPEN。 |
| 公開先のみ | 同じ参照、Schema、保護、実体・bytesを再検証する。 | freshな権限・対象・非使用・排他へ再結合後だけ、事前固定した残存対象を処置する。 |
| 不一致、未知entryまたは観測不能 | 別参照で回避せず、同じ取得済み参照と根拠を保持して停止する。 | 追加Effect 0。 |

清掃は公開済みintent→Root処置・直接不存在→元marker処置・直接不存在→排他解放の順で進める。取消・部分処置・通知喪失・例外は同じ終端記録へ接続する。進行追記を持つ場合も、書込みを処置済みの証明にせず、対象ごとのfresh観測を正本にする。leaseの通知上`closed`だけでnative資源の回収まで成立としない。

#### 限定保守のcaller接続と二回の短命処理

固定保存境界の読取り部品は[Platform Details](../platform-access/01_Architecture.md#固定保存境界の私有観測)へ具体化している。固定保存境界では三Directoryの独立期待値と利用者を照合し、十一実体のCurrent／Known観測は[Platformの私有読取り接続](../platform-access/01_Architecture.md#対象一式の私有読取り接続)へ具体化している。Source上では専用の読取り確認Protocolと`host-terminal-windows-adapter.ts`を接続する。Adapterは完全intentから三独立期待値・利用者と固定名を搬送し、nonce、応答形状、十一実体の型・相異、最初の三期待値、全資源close、実child終了と成果物前後一致を確認する。Generic Platform Adapterを置換せず、成功でも清掃Authorityを発行しない。回復Ownerからの実呼出し、初回期待値の取得、保存先初期化、記録公開・同参照の本番再入場と現在固定入口・必要Artifact確認は未接続である。所在候補の取得を許可済み保存先や新しいAuthorityの発行にしない。

元Taskを確定できない限定保守では、OrchestratorのTaskRecordへ回復情報を後付けしない。Coordinator自身が、検証済みRepository Rootから解決する`.crdd/coordinator/recovery/host-terminal/`に、同じ非Authority参照と完全intentを保持する。実行知の`task_attempt_settled`を保守記録へ流用せず、新しい汎用Storeや独立Subsystemも作らない。

| 段階 | 所有する処理 | 次へ進む条件 | 停止時に保持するもの |
|---|---|---|---|
| 対象観測 | 短命Nativeが固定namespace、親・管理Directory・Root・marker・六childの11実体と選択利用者を観測する。必要なnamespace初期化は独立した管理Effectとする。 | 全対象とmarker bytesを観測し、自己所有handleの終了を確認する。 | 取得済みの同参照、管理Effectの発行・確認状態。既存共有Directoryをrollbackで削除しない。 |
| caller保存 | CoordinatorがRoot／Ignore確認、閉Schema、producerとbinding照合を行い、完全intentを保存・flush・再読取りする。 | 同参照の完全bytesが一致し、保存資源を終端した。 | 同参照と完全intent。衝突、部分書込み、返却喪失またはclose不明では書き換え・別参照発行をしない。 |
| 記録公開 | 別の短命Nativeが同じnamespace、11実体、marker bytesと利用者をfreshに再照合する。共通容量排他をそのNative自身が取得し、計数・予約・CREATE_NEW・write・flush・非置換公開・結果観測まで保持する。 | 全再照合、保存・公開、個別closeと実child終端が成立した。 | 同参照と単調な部分receipt。上位のpacket受信を実child終了へ読み替えない。 |
| 同参照再入場 | fresh Processがcaller保存を再検証し、独立した全bytesをNativeの現在候補readerへ渡す。 | 同じ参照の唯一名、現在実体、保護、全bytesと今回の終了を確認する。 | 現在観測だけ。過去の成功receipt、旧file連続性、Authorityを生成しない。 |

二回のNative呼出し間で対象を継続保持したとは主張しない。記録公開前に全対象を再確認し、不一致・未知ならstage作成を行わない。namespace初期化後の失敗を「全Effect 0」にせず、記録Effect、管理Effect、Process／handle取得とRoot／marker処置を区別する。容量排他は別Supervisorの生存表示から推定せず、保存Effectを発行する同じNative Processが所有する。

`publishHostTerminalRecoveryCheckpoint`は同参照のcaller canonicalを既存Readerでfreshに検証し、正規bytes／Hash、独立bindingsと十一Known値を専用保存要求へ結合する。自己申告のsaved結果Objectを入力にせず、保存前後で同じcaller bytesを照合する。`terminal-windows-adapter.ts`は採用済み固定Bootstrap Native／開発候補の実体、実child終了、成果物前後一致、nonceと同参照、対象全体、計数・保存・全closeを共同評価する。保存場所だけの一致から対象差替えを見逃さない。

Nativeへの保存要求は一回だけ発行する。搬送・返却・終了・成果物観測が不明なら記録Effectをfalseへ戻さず、同参照とcaller完全bytesを保持する。応答の形状・相関を確認できても終了コードと矛盾する場合は停止し、取得済みのNative部分結果を保持する。保存Effectは不明とし、部分結果から保存成功を主張しない。Nativeが保存した後でcaller再確認や取消が失敗しても、公開済みreceiptを消さない。これは内部の記録接続であり、公開Recovery CLI、非使用、処置承認、Root／marker清掃または同参照Native再入場の実境界成立ではない。

`readHostTerminalRecoveryCheckpoint`は、同じcaller canonicalのfreshな完全bytesと独立bindingsを専用読戻し要求へ結合し、Native前後の同一内容を確認する。読戻しは現在のPrepared／Published記録と実体だけを観測し、Root／marker／六childを取得しない。清掃途中で対象が消失しても同参照を追えることと、処置直前に対象・非使用・承認をfresh確認することを分ける。現在記録の一致は過去receiptやAuthorityではない。Reader・外側guard・子Process終了の共同成立後だけ観測成功とし、取消、caller差替え、搬送不明では取得済み参照とNative部分結果を保持する。読戻し自体は記録Effectを発行しない。

この接続の完成候補は、caller保存だけでなく固定OS namespace、共有容量、Native protocol／Adapter、同参照を消費する入口まで一体とする。保存だけの入口を公開Recoveryとして表示しない。caller側にも容量・保持Ownerを持たせ、共同終端とEvidence移管を確認する前に自動削除しない。現在は接続実装中であり、通常producerの新Root作成前予約、全async利用側移行、legacy非使用、fresh承認と連続排他、およびRoot／marker処置は未成立である。

caller保存の排他は、検証済みRepository Rootをdomain-separated Hashへ変換した固定Windows named pipeを、保存するNode Process自身が所有する。取得の`listening`、失敗、取消、後着取得、受理socketと`close`を既存の同一Process状態機械へ接続する。pipeは通信入口ではなく、受理socketをデータ交換せず終端する。任意pipe名・Pathを入力にせず、別Supervisorの生存やLock Directoryの削除を排他の根拠にしない。取得・解放の待機上限は各2秒とし、再試行しない。未取得と終端未確認を区別する。Process喪失後に部分fileが消えるとは主張しない。

caller Directoryでは8KiB／1024物理entry／8MiBを上限とし、新規保存前にstageと公開名の2entry・両名byte分を同期予約計数する。未知entryと分類不能では新記録を止め、既存参照の読取りは別に維持する。完全bytesを`CREATE_NEW` stageへ保存・flush・再読取りし、Repository-localの非置換hardlinkでcanonical名を公開する。両名の同一実体を確認し、writer close後に自分のstageだけを除去してcanonical全bytesを再検証する。これはOS保存側の同writer保持rename契約とは別のcaller接続であり、Windows ACL・連続handle防御・過去のNative receiptを証明しない。部分stage、併存、不一致、close不明では再公開・上書き・修復をしない。

fresh callerは検証済みRepository Rootから同参照のcanonicalのみを読み、独立期待bindings、codec、descriptor実体の前後一致とcloseを確認する。readerのclose失敗は読取り失敗との併発時も保持し、保存結果の終了確認をfalseにする。Native前後のcaller読取りでも、終了未確認の固定理由を上位結果へ保持する。Native呼出し後なら取得済み部分結果と同参照を保持し、再close・再送はしない。新規保存を許すのは最初のcanonical直接観測が明示ENOENTだった場合だけであり、存在観測後の消失を新規受付へ戻さない。この現在値だけをNative再観測へ渡し、記録自身から期待binding、旧Identity、過去成功またはAuthorityを作らない。共同終端とEvidence移管後のcaller記録清掃は別に接続する必要があり、未解決参照の自動削除は行わない。caller側の部分実装は私有入口に限定し、公開CLIと全Recoveryの完成として表示しない。

#### 助言初期化失敗の分類と初回参照保持

Workbench助言の初期化失敗では、Operationが呼出し元へ返る前でも、下位作成境界が確認した清掃分類と取得済みexact参照を失わない。作成、世代Lockのactivation／readiness失敗の私有分類を外側の失敗処理へ渡し、`operation=null`だけから清掃失敗またはHost不存在を推定しない。既知の清掃確認は維持し、未知例外は未確認のまま停止する。

初回Runtime結果には同じ清掃分類と未解決の元参照を非列挙の内部結合として保持する。公開結果Schema、JSON、理由、Provider入力へ元参照を追加せず、この結合から回復Authorityを発行しない。保持は元の結果Objectが生存する現在Process内だけであり、executor以降の投影、WorkbenchのRequest Ownerおよび別Processの再入場へ接続済みとは扱わない。清掃確認済みの場合は回復対象参照をnullとする。後段の照会Ownerと耐久接続はOPENである。

#### 終端intentの閉じた搬送形式

完全に観測できたsnapshotだけを、内部codec `host-terminal-record.ts`の入力にする。Root未作成、六childの部分作成、Identity不明の初期化失敗はこの形式の適用外である。欠けた値をゼロや推測で埋めず、既存の失敗分類と取得済みexact参照保持を維持する。初期化途中からの耐久再入場は別に接続する必要がある。

| field | revision 2の形と意味 |
|---|---|
| `contract`／`contractRevision` | `crdd-coordinator/host-terminal-intent`／`2`。属性を持たないRevision 1と未知Revisionを拒否し、既存の観測値から属性を推測補完しない。 |
| `reference` | caller-knownな`host-terminal.<小文字UUID v4>`。codecは発行しない。限定保守では今回の保守選択Identityにも相当し、snapshot Hashだけで選択を結合しない。 |
| `producer` | `owned_cleanup`は`originalReferenceSha256`だけ、`human_orphan_cleanup`は`selectionSnapshotSha256`と`originalReferenceUnknownReason: original_reference_unconfirmed`だけを持つ。混在・欠落を拒否する。 |
| `bindings` | `runtimeSha256`、`repositorySha256`、`selectedUserSha256`。小文字64桁。実行物・Repository・選択利用者との実際の照合は記録Ownerが行う。 |
| `target` | `parentIdentity`、`recoveryDirectoryIdentity`、`terminalDirectoryIdentity`、`root`、`marker`、`children`の閉集合。 |
| `root`／`marker` | `name`と`identity`。markerだけに元bytesの`sha256`を加える。Root名は`crdd-coordinator-doctor-`＋1〜96文字のASCII英数字・`_`・`-`、marker名は`host-<64桁小文字Hash>.json`。自由Pathを受け取らない。 |
| `children` | 実名`workspace`、`provider-home`、`tmp`、`events`、`projection`、`management`の六件を全て保持する。現行Sourceのobject key `providerHome`をこの実名へ明示変換するAdapterは未接続。 |
| 各`identity` | Win32の`volumeSerial`、`fileIndexHigh`、`fileIndexLow`、`creationTimeHigh`、`creationTimeLow`の五識別値と、同じhandleの`attributes`を六u32として全十一対象に保持する。整数0〜4294967295、負のゼロ不可。同じvolume／file indexが二対象に現れるsnapshotを拒否する。属性は欠落・既定値補完・maskによる削減を許さない。file／Directory／reparseの適否はNativeのfresh観測が判定し、codecでの形状受理を実体判定へ昇格しない。 |
| `cleanupOrder` | `root_absence`→`marker_absence`→`lease_terminal`の固定三要素。保存済み進行、成功、非使用やAuthorityを表すfieldは持たない。 |

Win32の五識別値と属性は専用型であり、Nodeの`dev/ino/birthtimeNs`、既存Native protocolの三field Identityと互換扱いしない。creation timeと属性を取得する私有Readerは自己生成fixtureへ接続済みで、専用観測Adapterと保護付き現在値の初回取得はSource上に実装した。回復Ownerの呼出しと現在固定入口・必要Artifact確認はOPENである。旧Revision 1の試験記録を上書きせず、属性を後付けして再入場や処置の入力にしない。元参照HashとRoot／markerの実際の関係はcodecから証明できない。通常清掃の元exact参照・Hash・対象照合、限定保守のfresh承認・同じ選択参照との照合、情報分類はpublication前のOwner責務である。

正規文書は表のfield順、nested fieldもcodecの固定順、改行なしUTF-8 JSONとする。全ての文書bytesを一文書8KiB上限へ数え、SHA-256もそのbytesだけを対象とする。UUID／Hashは小文字、u32は通常の十進整数表現に限定する。encode前にnestedのProxy、Accessor、未知fieldと特殊prototypeを拒否し、未検証objectの`toJSON`等を実行しない。decodeは最大8KiBの所有copyを取り、共有memoryを拒否し、fatal UTF-8解析・閉Schema確認・再encodeとのbyte完全一致を要求する。BOM、重複key、空白・改行・余分bytes、escapeや指数表現による非正規値を受理しない。正規文書受理は保存・保護・実Identity・現在権限・非使用・清掃成立を意味しない。

初回対象確認と完全intent作成は分離する。対象名、独立して保持した三保存場所の実体と選択利用者だけから確認要求を作れ、未取得のRoot／marker／child実体を捏造しない。初回の保存場所自体がまだ未知の場合は、同じ固定Nativeの読取り専用Current要求（`CRDDHC01`）で取得する。Nativeは固定OS所在の全祖先を保持し、同じTokenで選択利用者を取得し、recovery／terminal双方の保護と三実体の型・相異を確認する。欠落・保護不適合は停止し、自動作成やACL修復をしない。Current結果は現在観測だけであり、上位Ownerが保持した後の別呼出し（`CRDDHT02`）で全期待値を再照合する。二呼出し間の連続保持、旧Task由来、非使用および清掃許可は主張しない。応答は既存`CRDDHR02`を共有し、要求種別を私有相関Contextへ保持してCurrentとKnownを混同しない。

`observeHostTerminalWindowsCandidate`は、この二呼出しを接続する。初回が拒否・終了不明なら二回目を発行せず、初回で実取得した三保存場所と利用者をKnown要求へ渡す。両応答の十一実体、利用者と元marker Hashが全て一致した場合だけ、二時点の対象一致を返す。不一致は停止し、二時点一致から連続保持や非使用を推定しない。取消は呼出し前後で確認し、同期Native実行の即時取消は保証しない。

`prepareHostTerminalRecoveryCheckpoint`は、検証済みRepository、callerが一回確定した同じ参照、固定名と独立した三結合Hashを受け取り、上記の二回観測から完全intentを構成し、既存のRepository内caller保存へ渡す。選択snapshot Hashは、固定名、十一実体の六値、元marker Hashと三結合Hashの固定順から導出し、nonce・終了状態・参照・Hash自身を含めない。観測と保存の結果を分け、取消や失敗でも取得済み参照、保存済みbytesとEffectを保持する。予期しない搬送・保存例外のEffectは不明として返し、Effectなしへ畳まない。保存した二時点snapshotは履歴上の結合根拠であって、保存待機後の現在値や非使用の証明ではない。現在、前提拒否と既存caller保存を局所確認した段階であり、実Native正常観測から保存までの共同成立、保護済みNative公開・承認・清掃のOwner接続と現在固定入口・必要Artifact確認は未成立である。

既知fileクラスは`observeKnownFileHostTerminalWindowsCandidate`と`prepareKnownFileHostTerminalRecoveryCheckpoint`の専用入口を使う。専用Currentから別呼出しのnamespace-Knownへ接続し、十二Identity、利用者、元marker Hashとfileの長さ・リンク数・Hashを二時点で比較する。namespace三実体の一致だけで対象全体一致としない。初回拒否・終了不明・取消では二回目を発行せず、二回目失敗・例外でも初回の取得済み結果を保持する。両Process終了が確認できない結果を準備可能としない。

新クラスの選択HashはUTF-8の`crdd/host-terminal-known-file-selection/v1\0`に、改行なしJSON配列を結合したSHA-256とする。配列はRoot名、marker名、十二Identityの配列、元marker Hash、Runtime Hash、Repository Hash、選択利用者Hash、file三値の配列の順とする。各IdentityはvolumeSerial、fileIndexHigh、fileIndexLow、creationTimeHigh、creationTimeLow、attributesの順、file三値はbyteLength、linkCount、sha256の順である。nonce、回復参照、結果・終了状態とHash自身は含めない。旧クラスのdomainと配列順は変更しない。

専用準備Ownerは同参照のrevision 3完全intentを専用caller保存へ渡す。実codecと準備bodyの局所確認、および合成観測から自己生成Repositoryの実caller保存・再読取りまでを確認するが、合成観測をNative正常搬送の根拠へ昇格しない。保存開始後の例外はEffect不明、保存後の取消は既存receiptとEffectを保持する。Hashは対象選択の相関だけであり、bindingsの実由来、fresh承認、非使用、連続排他、実清掃と公開Recoveryを証明しない。

Host終端の観測・保存・読戻しは、`createWindowsHostTerminalHelperEnvironment`の専用環境を共用する。一般Native helperの空`TMP`／`TEMP`を変更せず、既存Host producerと同じ`os.tmpdir()`の候補を通常Directory・非symlinkとして確認し、正規の実Pathを両fieldへ同じ値で搬送する。不正・取得不能では別場所へ補完しない。この値は所在候補であって所有証明ではない。Nativeは全祖先の保持、選択利用者、三実体と二保護を確認し、上位Ownerは元対象の親との一致を独立した根拠へ結合する。固定`terminal-v1`の欠落・保護不適合では停止し、自動作成・ACL修復・削除を行わない。専用保存先の初期化は、別の用途限定操作とexact Rootへの許可が成立するまで実行しない。

既存共有recoveryのWindows保護は、通常producerのUnix mode指定だけでは成立しない。2026-10-04の人間判断により、共有Directoryの限定ACL移行と通常producerの保護付き作成／fresh検証を、同じCHGの設計・実装・試験へ追加した。これは実ACL変更、実OS作成、Process停止または旧三件削除の許可ではない。通常入口は既存不適合を停止し、自動ACL修復・旧marker更新・新保存先へのfallbackを行わない。[比較と判断境界](../../../99_Roadmap/Changes/CHG-000082/Evidence/261002_host-orphan-recovery-design.md#共有管理フォルダの保護不一致と次の判断--2026-10-04)を参照する。

通常のTask／doctor／Workbench助言の作成Ownerは、WindowsではRoot・marker作成前に固定親を解決し、必要Nativeの既知Identity・固定Protocol・用途確認後の親観測→独立期待値付き保護初期化を確認する。必要Native同一性・親・利用者・保護・終了の不明では共有物をrollbackせず、清掃未確認・回復IDなしとして移送する。非Windowsの既存作成処理は変更しない。下位のNode作成primitiveはRoot／markerのrollback等の局所契約を所有するが、Windows保護成立の証明ではない。明示親を使う既存の負例は下位primitiveの失敗点を引き続き確認し、必要Artifact確認の早期拒否をそのOracleの成功に読み替えない。通常の本番接続と下位fixtureの観測範囲を分離する。

| 本番への接続点 | 現状と必要な処置 |
|---|---|
| 作成前の容量予約とcaller参照 | 未接続。`createOwnedOperationDirectories`が戻った後のhost参照返却へfieldを足すだけでは、最初のEffect前・Process喪失後の同じ参照を保証できない。 |
| 完全snapshotからintentへ | codecと専用観測AdapterをSource上に実装した。回復Ownerの呼出し、実bindings、元exact参照または保守選択・承認との照合は未接続。 |
| Native保護付きstage・公開 | 未接続。局所保護実測を本番の保護、保持handle、no-replace公開・直接観測へ接続する。 |
| Root／marker／lease共同終端 | 未接続。現在のRoot→世代失効／解放→marker順をcodec追加では変更しない。公開確定後、Root直接不存在→marker直接不存在→lease実終端へまとめて移行する。 |
| async利用側と再入場 | 未接続。同期wrapperへのPromise搬送を禁止し、Host→ProcessAbsence→RuntimeStateの取得と逆順解放、待機後のfresh観測を全利用側へ接続する。 |
| 初期化途中・旧形式 | 未解決。部分snapshotを新形式へ捏造しない。旧三件の非使用、実停止・実削除は別のfresh根拠と承認が必要である。 |

私有Nativeの[現在読取り](../platform-access/01_Architecture.md#別processからの現在読取り)は、上表の形状をcaller既知の参照・実体・全bytesへ照合する内部部品である。`Prepared`／`Published`は現在の唯一名だけを示し、過去のwrite／flush／rename／明示closeを復元しない。Native失敗の今回open・close確認も、保存済み履歴とは別に保持する。

Coordinatorの記録Ownerは、再入場前の耐久参照、producer版、Schema、容量、現在Authorityとlineageを別に検証する。stage-onlyの公開継続、本番callerの再起動接続と全利用側への搬送は未接続である。自己生成Workerの意図的Process終了とfresh読取りから、旧三領域の非使用、清掃許可または元Taskの完了を推定しない。

記録fileの旧Identityが返る前にProcessを失った場合は、同じ参照とcallerが独立保持した完全intentのbytes／対象bindingを、Nativeの[現在候補観測](../platform-access/01_Architecture.md#返却された実体情報がない場合の現在候補観測)へ渡す。今回の現在Identityを旧期待値へ付け替えず、元fileの連続性は未確認のまま保持する。参照と完全intentを最初の記録Effect前に保存・readbackするcaller接続、固定保存境界、共有容量予約、Native Protocol／Adapterおよびfreshな権限・対象・非使用・排他への再結合はOPENである。現在候補の受理だけでは再公開やRoot／marker処置を開始しない。

#### 終端記録自身の管理清掃

終端記録の清掃は元Taskの清掃とは別の管理責務であり、CoordinatorのHost回復記録Ownerが所有する。元Root・元marker・leaseの共同終端を確認する前、未解決参照がある間、または観測不能の間は削除しない。

- 必要Evidenceは、今回許可されたRepository内の対象CHG／Releaseの`Evidence/`へ移す。一時的な試験結果の保存先`.crdd/tests/`を正式保持先と扱わず、許可されたexact Root以外へ暗黙にarchiveしない。移動先の実bytes・Identity・同じ参照を確認した引渡しReceiptがなければ、原記録を削除しない。
- 引渡し後、当該記録のfresh Identity、参照解消、非使用と専用管理清掃のAuthorityを確認して、その記録だけを処置する。共有Directory、別Operationの記録および元Rootへ処置を拡張しない。
- 各処置の直後と、次回の新規記録受付前に終了済み記録の清掃要否を評価する。経過時間・古い順・容量超過だけで自動削除しない。清掃できなければ上限を守って停止し、必要な人間処置を示す。
- 管理清掃が部分成功・不明なら、同じ管理対象のfile Identityと引渡しReceiptを保持する。元Taskを再開せず、元Root清掃用記録を再帰的に作らない。管理清掃の終了は原記録とstageの直接不存在、処置用handle／observerの終端を確認して判定する。

**接続前OPEN:** 実際の保存・アクセス制御・差替え防止、no-replace公開、caller耐久接続、容量予約、Evidence引渡しと管理清掃は未実装・未観測。これらと旧利用側の閉包、Root／markerの限定OS処置を満たすまで、候補契約を実Recovery成立へ昇格しない。

旧形式の非使用を安全に確認できる具体的方式、作成前排他と全利用側の移行、OS処置境界はまだ未確定である。必要な保証を検証できない場合は処置しない。Windows再起動が不可欠という根拠が得られない限り、それを既定の前提または利用者への必須操作にしない。

限定保守の再利用防止では、現在のSourceで旧Rootを利用できる入口を対象とする。新規Taskと受動Doctorは新UUIDのRootだけを生成し、旧Rootを選択しない。当初Process内のowned／mount／management能力、exactなHost回復、Docker Taskの耐久base／journalに保持したHost lineage、およびDocker診断回復が既知の利用側である。当初能力の終了根拠と、fresh回復の対象排他を分け、全OSのProcess不存在や名前だけの一覧を代替証明にしない。

Docker診断回復は、exact TokenのRoot名から既存producerが発行したHost世代を純粋に導出し、対象Rootの最初の記録読取りより前にHost世代排他を取得する。Probe nonceをHost世代へ流用しない。取得後に元の記録を読み、埋め込まれたHost TokenのRoot名・nonceと照合し、差または不明ではDocker利用前に停止する。同じ排他能力をHost清掃へ渡し、取得済み排他を解放してから結果を返す。解放未確認では成功を返さず現在のexact参照と清掃未確認を保持する。この接続の局所確認だけで、実三Rootの当初世代終了、限定保守の承認・OS処置・耐久再入場または全Recoveryを成立済みにしない。

以下は旧形式Task回復の契約である。旧Runtime Stateのbase／journalからHost結合を取得し、対象Root観測前の同世代排他、終端清掃分岐だけの排他省略、一時解放・同世代再取得を要求していた。この旧回復経路と専用controllerは退役済みであり、現在の処理へ一時解放窓を再導入しない。現行の三長期排他、短期State排他と元版・exact ID・Owner再確認は、後述のRepository内現在状態の節に従う。JournalのIdentity・Schema検証と、最終限定Native清掃の実境界受入条件は別途維持する。

**OPEN:** 旧形式の非使用根拠、初期化前からの排他、差替えを防ぐOS処置境界、保護済み再入場、SPEC／Workflowへの実処置契約と公開入口は未成立である。これらを反証・独立確認するまでHelp／capabilitiesに未完成clean操作を公開しない。詳細な進行と承認範囲は[CHGの記録](../../../99_Roadmap/Changes/CHG-000082/Evidence/261002_host-orphan-recovery-design.md)、検証義務は[QA-000003](../../../07_Quality/Definitions/QA-000003/quality_definition.md#host残存の保守候補判定)と[QA-000006](../../../07_Quality/Definitions/QA-000006/quality_definition.md#host残存の限定回復に追加する観測条件)を参照する。

#### Docker外部境界の結合単位

Docker境界は一つのCLI呼出しとして扱わず、同じ状態、Authorityおよび資源のlifecycleを閉じられる単位に分ける。各単位を実Dockerまたは安全に同等な実境界へ段階的に接続し、最後に公開Task入口から組み合わせる。

```text
[Docker CLI Trust・同一Operation Identity]
                    ↓
[Task作成・実行] ──取消／応答不明──> [Task資源観測・回収]
        │                                  │
        │正常完了                          │残存・観測不能
        ↓                                  ↓
   [Task結果]                      [Task Recovery記録・再入場]
                                           │
                           Engine正常 ─────┤
                                           │ 既知のDesktop障害
                                           ↓
                              [Desktop障害修復Lifecycle]
                                           ↓
                              [Engine・資源のfresh観測]
                                           ↓
                              [Task固有Recovery・settlement]
```

障害修復の耐久状態は次の遷移だけを許可する。各Effectの発行前後で同じ修復ID、境界および記録prefixを照合し、不明状態を次へ進めない。

現在の状態表は現在Schemaで開始したOperationだけに適用する。旧記録・旧世代と判定した場合は、フロントAIの移行確認までEffect 0で停止し、Runtimeが旧記録へContinuationを作成したり追加Effectを進めたりしない。同じexact Recovery ID、一次Effectの再発行0、fresh観測とunknown保持は維持する。

| 現在状態 | 成立条件／処置 | 次状態 | 不成立・取消・観測不能 |
|---|---|---|---|
| 未作成 | 境界、排他、修復対象を確認し初期記録を耐久化 | `prepared` | Effect 0で停止 |
| `prepared` | 対象Processをfresh観測し、存在時だけ公式停止と必要な限定強制停止を行う。不在時は各操作を`not_issued`として耐久化し、再開時にも同じ境界を再観測する | `processes_stopped` | 同じ修復IDで停止 |
| `prepared`／`processes_stopped` | stale対象がなく、既知Effectまたは履歴Effect不明を分類 | `no_stale_known_effect_recovery_pending`または`no_stale_historical_effect_unknown_pending` | 推測で不存在へ畳まない |
| `processes_stopped` | exactな`run` Directoryを同一親内へrenameし、新旧Identityを確認 | `renamed` | rename結果不明として同じ修復IDを保持 |
| `renamed` | Desktopを起動し、Engine応答、Host安全性、Evidence保持を確認 | `recovered_pending_disposition` | 起動を盲目的に再発行せず停止 |
| `renamed`かつ初回起動失敗 | confirmedな初回起動を期限まで再観測する。Engine Probeが一時Timeoutでも、失敗起動が作った既知2領域のexact lockとDocker Process集合を確認できる場合は、現在Schemaの同じInvocation・同じ修復IDで継続する。Processを一回だけ停止し、Engine既知停止とProcess不在をfreshに確認した後にだけ一領域ずつ退避する。現在Schemaで新規開始した修復だけを対象とし、起動済みEffectを再発行しない | `failed_launch_process_stopped`→`failed_run_renamed`→`secrets_engine_renamed` | 未知領域、一領域でもIdentity・lock・停止・退避結果が不明、または取消時は自動継続せず、秘密値とHost Pathを含まない条件別理由を返して同じ修復IDで停止 |
| `secrets_engine_renamed` | 再起動意図を耐久化してDesktopを一回だけ再起動し、Engine、Process、新しいRuntime領域および退避領域をfresh観測 | `recovered_pending_disposition` | 起動結果不明なら再発行せず、同じ修復IDで停止 |
| `recovered_pending_disposition` | 人間が残存Evidenceの保持を決定し、終了記録を耐久化 | `closed_retained` | 回復済みと表示しない |
| `no_stale_known_effect_recovery_pending` | 既知EffectのEvidence保持を決定し終了記録を耐久化 | `closed_no_stale_known_effect_retained` | 回復義務を保持 |
| `no_stale_historical_effect_unknown_pending` | 履歴Effect不明のEvidence保持を決定し終了記録を耐久化 | `closed_historical_effect_unknown_retained` | Effect不存在を捏造しない |

#### 旧修復履歴の分岐（移管前比較・現在実行禁止）

旧修復本体・Record Store・Continuation Store・履歴hardlink出版と専用試験は撤去済みである。以下は当時の方式の説明に限り、現在の実装契約ではない。現在の修復はDocker Isolationの技術checkpointとCoordinator現在状態の専用Writer／Callerへ接続する。旧namespaceを現在Inventoryで許可せず、フロントAIによる明示移行の確認前は未知entryとして処置を拒否する。一般的な実行記録の保存保証は現行Execution Intelligenceの二Producer結合試験へ接続し、旧Storeの維持理由にしない。

以下の二分岐は旧Runtimeの比較基準であり、現在Runtimeは実行しない。現在の処置はフロントAI移行確認までEffect 0で停止する。

未終了の旧修復履歴へ、旧Runtimeが知らなかったEffectを旧記録の改変として継ぎ足さない。旧方式では由来、現在Session、現在Engine停止、Process集合、元のstale対象および現在の既知Runtime領域を確認したうえで、次のいずれかに分類した。

- 旧Effectを安全に確定でき、現在の障害が独立している場合は、旧Operationを証拠保持終了へ閉じ、新しい修復IDの`prepared`を別Operationとして開始する。
- 旧Operation自身のsettledな初回起動が新しい失敗世代を作った場合は、同じ修復IDに現在Release所有の追記専用継続記録を接続する。旧記録を変更せず、旧Effectを再発行せず、追加Effectごとに意図と結果を耐久化する。

現在の`run`が旧履歴のIdentityと異なる場合も、世代交代を旧Effect不存在の証明へ読み替えない。

#### 現在Schemaのprepared観測

`prepared`のProcess操作は、要求したかどうかだけでなく、freshな実状態から必要性を分類する。Engineが既知停止、修復対象の`run` Identityが一致、stale対象が不存在で、Docker Desktop Processも明示的不在なら、公式停止とNative強制停止は`known_not_needed`である。この場合はHost操作を発行せず、`issued=false`／`confirmation=not_issued`を同じ修復IDへ耐久化して次の段階へ進む。再開時は保存済みの`not_issued`だけを信用せず、同じ条件を再観測する。Processの再出現、Identity差、観測不能またはEngine状態の変化では後続Effectを発行しない。

#### 旧署名版をまたぐ継続と図（移管前比較・現在実行禁止）

次の旧方式本文と図は比較専用であり、現在の再入場経路ではない。現在Runtimeは旧chainから追加Effectを進めず、フロントAI移行確認までEffect 0を維持する。

署名済みRuntimeの更新をまたぐ未完了修復は、旧RuntimeのHost操作を新Runtimeから再発行しない。旧署名、引継ぎ連鎖、現在Session、元の退避対象および現在の既知Runtime領域を検証する。旧Effectを確定して終了できる場合は旧Operationを証拠保持終了する。旧Operationのsettledな起動Effectが新しい失敗世代を作った場合だけ、同じ修復IDへ現在Release所有の追記専用継続記録を接続し、未発行の追加Effectだけを進める。どちらにも分類できなければ、新しい修復IDへ逃がさず同じ修復IDで停止する。

```text
旧署名の修復記録（変更しない）
        │
        ├─ 旧Effectを再発行しない
        │
        └─ exactな由来・Session・失敗世代を検証
                         ↓
             同じRepair IDの継続記録
                         │
              失敗起動Process停止
              意図→停止→不存在確認
                         │
          ┌──────────────┴──────────────┐
          ▼                             ▼
  Docker\run失敗世代            docker-secrets-engine
  意図→退避→結果                 意図→退避→結果
          └──────────────┬──────────────┘
                         ▼
                 再起動意図→一回起動
                         ▼
       Engine・Process・新世代・退避物を再観測
```

#### 現在Schemaの継続に必要な実観測

継続記録の一部だけが成立しても修復成功にしない。各Host Effectの直前には、保存済み観測を流用せず、Engine停止、Docker Desktop Process不在、当該source Directoryとlockのexact Identity、退避先不存在、および先行退避結果をfreshに再観測する。意図の耐久化後からEffect発行前にも同じGateを再確認し、その間にDockerが再起動した、Processが再出現した、Identityが変化した、または観測不能になった場合は、そのEffectを発行せず同じ修復IDで停止する。

confirmedな初回起動の全体期限が満了しても、それだけでは二回目の起動を発行しない。期限満了後の単一Probeが`transient_unavailable`でも、`Docker/run`失敗世代と`docker-secrets-engine`の両方のexact Identityおよび既知lockが同時に成立し、Docker Desktop Process集合が存在または不存在として確定した場合だけ、同じInvocation内で上記継続記録へ移る。Processが残存する場合は、退避より前に専用の停止意図を耐久化し、停止Effectを一回だけ発行する。その後にEngine既知停止とProcess不存在をfreshに確認できた場合だけDirectory退避へ進む。Engine状態不明、停止の部分成功・観測不能、片側だけのlock、単なる低速起動または取消ではDirectoryを変更せず、どのGateが不成立かを条件別理由で返して同じRepair IDの回復義務を保持する。

回復済み候補と明示closeは、現在Releaseへ結合した追記専用継続記録を利用側として検証する。3 Effectがすべて`settled`／`issued=true`／`confirmation=confirmed`であり、`Docker/run`と`docker-secrets-engine`の両方について、退避した旧世代がexactに残り、別Identityの新世代が現在位置へ存在し、Engine readyとProcess安全性がfreshに成立した場合だけ回復済みへ進める。継続記録の欠落、改変、別Release結合、部分settlement、いずれかの新世代欠落または観測不能ではcloseせず、同じ修復IDの回復義務を保持する。旧形式の修復記録に継続記録が存在しない場合だけ、従来の終了条件を独立して適用する。

### 正常復帰後の検証付き再起動

本節から「現在状態と履歴を分ける縮小設計」の直前までは、切替前Runtimeの能力と移行元を説明する基準設計である。旧Releaseのorigin／adoption／handoff／continuation連鎖を新Runtimeへ実装し直す指示ではない。新方式の正本は後続の縮小設計と「使い捨て実行環境と限定終了」であり、Source撤去前に必要な保証を以下の処置表へ対応させる。基準方式が動作した過去Evidenceは保持するが、新方式の成立証明にはしない。

| 基準方式の保証・仕組み | 再編後の処置 | 検証義務 |
|---|---|---|
| Taskに結合した要求・資源Identity、一次失敗、回収未確認 | 現在の同じ操作をSnapshotへ結合し、回収・結果受理まで保持する。過去unknownは成功へ変更しない。 | `ERB-IT-003`、`ERB-IT-004`、`ERB-ST-030` |
| 停止・再起動の実要求と実観測、影響する現在Ownerの排他、起動待機と参考計測 | 人間が必要な再起動を承認した場合の限定介入として維持する。現在の対象集合を再観測し、終了済み履歴との一覧完全一致を許可条件にしない。 | `ERB-IT-014`、`ERB-ST-030` |
| 既知socket障害の二領域退避とNative実体・停止観測 | Taskの通常回復から自動発火しない。明示的なHost障害修復を選択した場合だけ、既存Native境界の安全条件を維持する。新しい修復Frameworkを作らない。 | `ERB-ST-009`、`ERB-IT-014` |
| 旧Release原記録の採用、別Session／Releaseへのhandoff、旧Continuationの追記 | 新Runtimeの要求から除外する。フロントAIが停止・現在資源・未解決参照・保全対象を確認して旧形式を処置し、新形式を初期化する。Runtimeは旧形式を探索・採用しない。 | 旧`ERB-ST-011`／`ERB-IT-012`は移行元履歴。新方式の再入場は`ERB-IT-003`／`ERB-ST-030`。 |
| 再起動後の旧Task実行再開・Container再利用 | 行わない。回収・限定終了と新しい試行の開始を分け、再送、候補採用、Commit／Pushを暗黙発行しない。 | `ERB-IT-003`、`ERB-ST-030` |

この対応は設計上の処置である。旧Source、公開引数、保存Reader、署名閉包と試験の撤去・置換は段階5、現在の再入場と実境界の確認は段階6／7で完了させる。未接続のSnapshotや単発の空一覧を回復完了の根拠にしない。

  正常Engineへ戻った後にも作成結果不明のTaskを復旧できるよう、障害修復とは別に検証付き再起動を設ける。この経路は、現在認可・固定入口・必要Artifact同一性を確認した通常入口から実機境界を通り、同じRecovery IdentityでTask回復まで到達した新しいEvidenceが揃うまで完成を表示しない。旧署名配布物からの成功を新経路の根拠へ流用しない。

| 責務 | 障害修復 | 検証付き再起動 |
|---|---|---|
| 発火 | 既知のDocker Desktop障害 | exact Taskの作成要求が未確定で、停止境界が必要 |
| 正常Engine | 新規修復を開始しない | 必要な対象・権限・排他を確認した場合だけ開始候補 |
| Filesystem | 障害時のrun退避を所有 | runの退避・削除を行わない。保護された復旧記録だけを所有 |
| 停止根拠 | 既存の修復履歴契約 | 作成要求より後の旧実行主体の停止完了と、後続起動を順序付きで記録 |
| Taskの完了 | 別のTask復旧が判定 | 別のTask復旧が判定。再起動成功だけでは完了しない |

#### 実行と回復の全体図

以下は責務間の接続図であり、新しい保存状態名の定義ではない。再起動の終了とTask回復の終了を分け、Taskの自動再実行には接続しない。

```text
Task受付・境界検証
  ↓
許可されたTask実行
  ↓
結果と資源回収を確認
  ├─ 確認済み → Task結果を返す
  └─ 残存・観測不能 → 同じ回復IDを保持して停止
                         ↓
                     現在の回復条件を検証
                       ├─ 権限不足・競合・不明 → 停止を維持
                       ├─ 通常回復が可能 ──────────────┐
                       ├─ 既知のDocker障害             │
                       │    ↓                         │
                       │  既存の障害修復               │
                       │    ↓                         │
                       │  停止・再起動の根拠を検証 ────┤
                       └─ 作成結果不明・停止境界が必要 │
                            ↓                         │
                          検証付き再起動               │
                            ↓                         │
                          停止・再起動の根拠を検証 ────┘
                                                      ↓
                                             Task固有の資源回復
                                                      ↓
                                         対象資源と記録の終了条件
                                           ├─ 不成立・不明
                                           │    → 同じ回復IDで停止
                                           └─ 成立 → Task回復完了
                                                      ↓
                                             元Taskは再実行しない
```

#### Host記録の読取り所在と現在操作

初期保存直後・Host submission前のProcess消失では、実markerが`host_only`かつ私有Ownerのtokenと初期tokenが一致し、初期操作から既存退役処理の`phase=settling / ownerEffect=disabled`と清掃進捗だけが変化した場合に限り、Host不存在遷移を不要とする。初期操作は既存modelで再導出し、五資源の全初期field、未開始／未送信／共有書込み未発行、再利用不可、一次失敗・結果・履歴を全文比較する。再起動記録だけは共通の終了判定を満たす場合に、その内容を変更せず比較対象へ保持する。これはTask資源が未要求であることと再起動義務の終了を分けるためであり、未確定の再起動、回収不明、最終結果欠落またはEffect不明は拒否する。同じID／nonceの未解決参照・配送があれば拒否する。`host_only`一般、Task資源のnot_issued、意図保存済み、unknownまたは発行後の不存在をこの例外へ含めない。

この有限切断点はDocker不存在の再観測ではなく、submission未到達の確認である。確認関数と清掃関数は同じ私有判定を使い、確認だけではtoken・marker・不存在事実を保存しない。清掃は既存のpending保存→元版・Owner・世代再確認→Host清掃→Root／marker両不存在→confirmed保存を維持する。清掃予定保存後の再入場のため`not_requested / pending`だけを許容し、confirmedは既存の両不存在再入場経路で扱う。通常の`docker_submission_started → docker_absent_confirmed`は変更しない。局所試験・失敗反証と独立確認が完了するまで、この候補接続をPackage全体完成としない。

初期切断の清掃途中再入場では、pendingの実保存確定後と、Host Root／markerの実回収後・confirmed出版前を別の切断点とする。各fresh処置は既存resource-cleanup checkpointを一度保存するため、資源欄が同値でもSnapshotの改訂・元版Hashは進む。この保存を新しい技術進捗やHost清掃成立へ解釈せず、操作・参照・配送の保全と、modelで再導出したSnapshot全文・改訂・元版Hashを別々に照合する。Host清掃確定・履歴・対象除去は最後のfresh処置で共同成立を確認する。

現在操作のfresh回復Ownerは、現在Repositoryのexact操作と元本文へ結合し、既存Host世代、Home、Runtime排他を順序取得する。Host世代の内部検証は真正なMap・Root・nonceと保持Lockの生存を共同確認し、raw Host Lockを二重取得しない。取得直後と保存直前に同じHost markerを読み直し、全現在本文の元版一致を確認する。既存の準備用私有Mapを`restart / recovery`の判別付き集合として使い、各利用側は種別を照合する。新しい共有Registry、永続Owner、Lock Frameworkは作らない。

準備が受理した履歴出版途中の有限形は、直後の旧Owner退役確認でも同じexact IDと元本文で再読取りする。通常Readerが解放確認付きで拒否し、Host両不存在を確認済み・Host清掃出版なし・completion出版なしの場合だけ、既存のCurrent History Readerへ一回接続する。例外・解放不明・Host残存／不明からは接続しない。専用Readerも元本文全文一致とfresh Owner確認を要求し、既退役なら追加Writerなしで残る履歴／終了処理へ進む。履歴pendingを理由にOwnerを再生成したり、未知資源・未退役Ownerを終了済みへ変換したりしない。

Host遷移途中のfresh準備では、保存済みpendingがない場合は現tokenだけを使う。pendingがある場合は`docker_submission_started → docker_absent_confirmed`だけをこの回復分岐の対象とし、元token、系譜Hash、Root・nonce、元OwnerのEffect無効化と五資源の既知終了を要求する。実markerが元本文なら旧token、予定の後続本文と完全一致する場合だけ予定tokenを取得対象へ採用する。採用後も現在stateのtokenを自動更新せず、同じ実markerを世代取得後・保存直前に再確認する。別種類の正式pendingはこの入口で処置済みにせず取得前停止し、対応する回復分岐の未完成義務として残す。予定tokenの保存確定・Host実遷移と物理清掃は後段の別接続である。

Host不存在遷移のDriverは、同じ現在Ownerと全元版、元OwnerのEffect無効化、五資源の既知終了を前提に次を処置する。この関数はmarker存続中の遷移・token確定を所有し、Host物理清掃と清掃後の保存は後述の「現在回収OwnerのHost清掃確定」が所有する。先行した新規遷移とsettled再入場の確認では、別Processの実Host／Kernel排他と現在状態Writerを使い、初回の意図・token確定二版の全文・改訂・元版Hash、および同Owner反復・fresh再入場で追加公開0を照合した。この遷移単体の試験終了時清掃はfixture回収であり、後述する製品Host清掃Driverの検証とは区別する。pending旧／予定tokenの実Storage接続、競合CAS、実Dockerと本番切替は未完了である。

| 保存状態 | 同Rootの実marker | 処置 |
|---|---|---|
| pendingなし・旧token | `docker_submission_started`の旧本文 | 意図を保存・全読戻し後、処置直前の全元版を再確認し、一度遷移して予定本文を読み直す。その後だけtoken確定・pending解除を保存する |
| exact pending・旧token | 旧本文 | 意図を再保存せず、同じ一度の遷移と予定本文確認・token確定を行う |
| exact pending・旧token | 予定本文 | 実Host遷移0で予定token確定・pending解除だけを保存する |
| pendingなし・予定token | `docker_absent_confirmed`の予定本文 | 処置・Writerとも0で既確定を確認する |

処置返却・保存が不明なら同じOwnerの追加処置を停止し、保存済み意図と実markerをfresh Ownerが再照合する。Host checkpointの汎用入口でも、捕捉した保存要求tokenと、私有Ownerが実markerへ結合して保持するtokenの一致を要求する。保存済み意図だけでstateを予定tokenへ先行更新しない。Driverは返却tokenと実marker全文が一致した後だけ私有tokenを更新する。固定Writerは同じexact pending、既知終了、Effect無効化、cleanup不変、pending解除を共同確認し、他操作・一次失敗・元結果は変えない。

回復Ownerの固定Writerは`resource / cleanup / host / lifecycle`の対象欄だけを既存状態変換・保存へ搬送する。Reader・保存JSON・任意candidateだけで書込みOwnerを復元せず、他操作、一次失敗、確定結果と配送集合を保全する。保存・読戻し・更新排他解放が不明ならOwnerを失効させ、追加Writerを停止する。解放は取得済み全排他を逆順に一度試行し、一つのfalse／例外でも残りを省略せず、過去の回収不明を消さない。

一般の四種checkpointはmarker存続中の途中更新に限定し、Owner取得だけを資源不存在・Host清掃・Lease解放の根拠にしない。一般入口の`host.cleanup=confirmed`、Lease解放と新しい完了結果の拒否は維持する。Host清掃confirmedの保存は、専用Driver／Writerで同じ世代保持とRoot／marker両不存在へ結合した。出版途中のA／B／Cも同じ固定候補だけを再確定し、既confirmedで途中材料がない場合はWriter 0とする。通常Readerの保存途中拒否は維持し、専用経路の契約は後述節を正本とする。Lease解放とTask全体の結果・終了確定はこのHost清掃接続から推定しない。

現在操作の資源回収はContainer先行（Provider、認証Probe、Proxy）からNetwork（Internal、Egress）へ進み、cleanup保存は既存stateの五用途順を維持する。未要求・未発行はDI要求0。処置前意図だけがある場合はunknownを保存・読戻ししてから発見を試み、発見したIDをruntime reconciliationとして同じresource欄へ保存・読戻しした後だけ削除する。Proxyは内部接続のみ／内部と外部接続の閉じた二構成を下位で照合する。空照会・構成差・観測不能を過去要求の未発行や回収成功へ変換しない。既存absenceの再観測失敗では元事実を消さず、新しい不存在根拠も捏造しない。

DIの構成照合後・rm直前には同じ現在Ownerと元版の同期確認を結合する。厳密なtrue以外、例外、非同期返却は削除0。確認が一度不明になった場合は後着成功で処置を再開せず、次候補・後続資源・追加Writerを停止する。上位StateやLock操作自体をDIへ渡さず、用途限定の生存確認だけを借用する。本番用configの構成・使用・closeとHost清掃後保存はSourceへ接続し、模擬Docker境界および実Host／状態保存の局所試験を行った。実Dockerでの回収、通常／記録後回復の全体入口と本番の一体切替は未完了であり、この局所接続をTask回復完了とは表示しない。

Host tokenは親Directoryを含まない。記録Readerは、元management／mount／取得済みHost世代、または検証済みRepositoryの現在操作が保持するexact操作Rootを明示入力とし、その親だけを読む。OS tmpへのdefault、別親列挙、旧形式探索を行わない。Root名とtoken、canonicalな親、直下の非link記録Directory、nonceに対応するmarker名、内容Hash／Schema／Root名と読取り前後のmarker実体を照合する。操作Rootの不存在はmarkerの読取不能とは別に扱う。

Docker回収用の管理領域は、同じtokenと真正なHost回復世代からだけ借用する。保持排他・marker・started状態・Root実体・記録済みmanagement子の実体を毎回照合し、Root直下、非link、canonical一致を要求する。借用は所在と同期生存確認だけで、生management Capabilityを復元しない。一時Docker configの作成・使用・closeは下位に任せ、上位は成功、blocked、例外の全経路でcloseを待つ。close不明は同じ回復参照の清掃不明として保持し、Host清掃、Lease解放とTask完了へ進めない。

Root値とReader成功は書込み・清掃Authorityではない。処置は既存Host世代排他と実Root／子領域／marker照合へ別に結合する。通常Callerは元OwnerのRoot、fresh CLIは現在stateへ対応する単一操作のRootを使い、現在対応のない旧世代はフロントAI移行対象として停止する。Probeの回復記録も同じRootへ結合し、返却された名前だけで対象を削除しない。既存Native creatorの保存先はこのReader是正だけを理由に変更しない。

#### 現在回収OwnerのHost清掃確定

Host清掃は既存の`host.cleanup`を使い、`not_requested → pending`の保存・全読戻し後だけ、保持中のHost世代で物理Rootとmarkerを回収する。処置直前に全元版と既存Host／Home／Runtime排他を再確認する。清掃のblocked、例外または観測不能ではpendingと同じ回復参照を保持し、そのOwnerの後続処置・Writerを停止する。一次失敗、元結果、Lease、資源、履歴と配送は変更しない。

清掃後はHost Ownerが固定Root／markerを別々に観測し、両方の明示不存在と同じ世代・保持排他を確認した場合だけ、専用の終端Writerで`pending|unknown → confirmed`を保存する。一般checkpointのconfirmed拒否は維持する。専用Writerは同じ操作・全元版・token・pending遷移なし・Owner Effect無効・五資源の既知終端を照合し、Host清掃欄以外の変更を許可しない。

清掃成功後の保存失敗では、fresh Processが同じ現在操作のpending／unknownとRoot／marker両不存在を確認し、既存のIdentity指定Host世代を取得してから再観測する。取得前観測だけで書込み可能としない。保存途中材料のないconfirmedの再入場は処置・Writer 0。confirmedなのに実体が存在する場合、Rootだけが存在する場合、親・記録Directory・保存Identityの差または観測不能では停止する。marker存続時は従来のtoken照合を維持する。新しい台帳、Map、Lockまたは旧形式の探索は追加しない。

現在のSourceは、予定保存・物理清掃・確定保存、通常材料からのfresh不存在再入場と、出版途中の限定再確定まで接続した。実Host／Kernel／Writerで正常清掃と確定後再入場を確認し、模擬境界では保存前拒否・清掃拒否／例外／観測不能・最終Writer拒否を反証した。Host清掃の確定はTask全体の結果・Lease解放・履歴・配送の確定ではない。

出版途中の再確定は、通常Readerを緩めず、exact操作に限定した内部Reader／Writerへ次の有限形だけを接続する。既存準備Map内へ元本文・固定候補・受理形を保持し、再確定中は他の資源処置を禁止する。すべてでlock本文・実体・Repository結合を照合し、Writer前後に世代・両不存在・同じ元版を再確認する。完了はcurrent全文と固定候補の一致、およびpending／lockの不存在で判定する。

| 出版途中形 | 現在本文 | 短命ファイル | 処置 |
|---|---|---|---|
| A | Host清掃pending／unknown | lockのみ | 現在本文からHost清掃候補だけを再導出する。別Writerの未発行意図を推測復元しない |
| B | Host清掃pending／unknown | lock＋固定候補と全文一致するpending | 同じ候補の出版だけを再確定する |
| C | Host清掃confirmed | lockのみ | 出版済み同本文を確認し、短命markerの回収だけを再確定する |
| 拒否 | その他 | lockなしpending、別候補、confirmed＋pending、余分な内容等 | 処置せず同じ参照を保持する。confirmed＋pendingは現在Writerから自然到達する根拠がないため受理しない |

この出版途中Reader／WriterはSourceへ接続した。実Writerのlock作成後・出版直前・出版直後へ故障を入れ、A／B／Cの各残存から別Processで同じ候補へ再確定した。通常Readerの拒否、不正pending／lock、confirmed＋pendingの拒否、再確定中の他処置拒否、最終短命材料不存在と確定後Writer 0を確認した。固定候補の契約／品質の限定最終再確認は残指摘0。Architectureの旧現在形3段落の矛盾を是正した。未実施の競合CASや実Docker、Task全体の回復へ実証範囲を拡張しない。

#### 現在回収Ownerの終了結果確定

通常回収の終了保存は、五資源が未要求・未発行または実ID確定後の不存在であり、旧OwnerのEffectが無効、Host遷移が解消、Root／marker両方の不存在と清掃保存が確認済みの場合に限定する。この現在保証が旧live経路のMount終了・回復終了確認を置き換える。元の生存Capabilityや終了通知を保存JSONから復元しない。作成結果不明を現在の不存在だけで終端化する別Classは、この通常契約に含めない。

同じ準備Owner内で外側排他の逆順全解放を一回試行し、解放試行・全解放確認・終端保存試行を保持する。false、例外と過去の清掃不明があれば終了保存しない。全解放後のOwnerは、同じRepository・exact操作・元本文の固定終了保存だけへ一回使用でき、新しいDocker処置や別操作のOwnerには戻らない。保存失敗後も同Ownerで再発行せず、耐久的に未確定の操作はfresh Ownerから同じ回復IDで再入場する。

既存結果のstatus／reasonと一次失敗はnullを含め保持し、清掃確認だけをtrueにする。結果がnullの場合だけ、既存の`blocked / docker_process_controller_execution_failed_closed`を固定し、成功・取消・個別のProvider原因を推測しない。実行の既知値、資源Receiptと他操作は保持する。終了保存は`phase=settling / lease=released`までとし、要約・履歴・配送の成立を推定しない。Orchestratorは履歴確認と耐久配送登録後に受領待ちへ進める。CLI／Workbenchの中断後回復は、真正な技術終端と必要成果物・履歴の保全後に、表示の再搬送を条件とせず操作を除去する。回復CLIが返すのは技術回復の診断であり、Workbenchの回答を代理受領・再配送するものではない。

解放後も、終端WriterがOwnerを確認する各時点でexact token／Rootの両不存在をfresh観測する。present、unknownまたは例外では保存せず、同Ownerの再試行も許可しない。再起動記録は、記録なし、`not_issued / not_required / result=null`、`confirmed / confirmed / result確定済み`、上位`unknown / confirmed`かつ最終結果が`blocked / request=not_issued / effectOutcomeUnknown=false`、または上位`issued / confirmed`かつ最終結果が`blocked / request=issued / effectOutcomeUnknown=false`の形だけを許可する。後二形は再起動成功ではなく、同じDI操作が確定未発行または発行済み既知失敗として終了し資源回収を確認した事実である。元のblocked理由・要求・Task一次失敗・結果を成功へ書き換えず、再発行許可にも使用しない。終端Writerと履歴Readerは同じ純粋判定を使用し、Task資源終了・Owner退役・Host不存在・Lease・排他・履歴の既存条件を維持する。受付・清掃が確認済みでも結果がnullなら、その義務を消さず同じ参照を保持する。作成結果不明の限定終了に必要な再起動completed条件は別判定であり、この既知失敗をその根拠にしない。

この終了保存単体の確認は、後段の通常CLI接続候補や全体E2Eの完成を意味しない。履歴・配送・用途別終了の接続と現在の限定確認は以下で区別する。

#### 現在回収の履歴出版と用途別返却

現在回収の履歴出版は、保存済み`history.occurredAt`と行Hash、canonical履歴、pending履歴全文および現在の保持設定から候補を再導出する。Process内の旧`historyAttempts`を復元しない。同じ回復IDの行がcanonicalへ既に存在する場合は全文一致を確認して再追加せず、異内容・重複・pending全文差は停止する。出版途中の再入場では固定時刻を現在時刻へ更新せず、保持設定の差で候補を再導出できない場合もpendingを削除・再作成しない。現在時刻による次の期間整理は後続の通常履歴出版が所有する。

既存の`settlements`内の短命Contextと同じ物理Writerへ、現在履歴の専用modeを接続する。旧liveの清掃結果・Controller結果・management・historyAttempts、既存ACK modeと混在させない。stage、時刻と候補はCaller入力ではなく、exact現在操作と物理材料から導出する。Readerが観測した履歴全文・File実体・設定もContextへ固定し、Writer内の再導出と各I/O前後のOwner／Root／Host両不存在・設定確認へ結合する。Contextは一段ごとに破棄し、終了済み同Ownerの最大二段で履歴confirmedまで進める。途中失敗後は同Ownerを停止し、fresh Ownerだけが同じexact参照から再入場する。新Map、Lock、Schemaと旧実行Authorityは作らない。

通常Readerの保存途中拒否を維持し、履歴専用Readerは次の有限形だけを受理する。Host清掃の出版途中ReaderはLease解放済み・清掃確認済み結果・履歴ありを受理せず、markerだけの状態を別段階の清掃完了へ誤分類しない。

| 現在状態と短命材料 | 履歴専用経路の処置 |
|---|---|
| 終了結果確定、履歴なし | 時刻を一度固定してcheckpoint候補を作る |
| exact checkpointのstate.pending＋state.lock | pending内の固定時刻で同じ候補を再導出して出版する |
| 履歴未確認、短命材料なし | 固定行と保持設定から履歴出版を開始する |
| 履歴未確認、exact history.pending、state.pendingなし | 全文再導出後に履歴を出版する。Writer順序上、state.lockの不存在を許す |
| canonicalにexact行、履歴未確認 | 行を再追加せずconfirmedを保存する |
| canonicalにexact行、exact confirmed state.pending＋state.lock | 同じconfirmed候補を出版する |
| 履歴confirmed、state.lockのみ | 同じcurrentを確認しmarkerだけ回収する |
| 履歴confirmed、短命材料なし | Writer 0。保存済みの確認状態を保持する |

交差候補、別行、未知File、観測不能、同時のstate.pendingとhistory.pendingは停止する。共通履歴Driverは配送登録・ACK・操作除去を行わない。Orchestratorの耐久配送とCLI／Workbenchの技術終端後の終了整理には後段のSource接続候補があり、回復CLIからWorkbench回答の代理受領を主張しない。現在のSourceは物理出版・fresh再入場の検証候補で、通常CLI・配送・Package全体完成を意味しない。

履歴確認後の耐久配送登録は、同じ解放済み回収Ownerと既存`settlements`の`current_delivery`へ限定する。必要集合は保存済みIdentityから導出し、Orchestratorだけ既存pendingDeliveriesへ一件登録する。結果IDは既存の固定要約Hashであり、ACKはnullのまま保持する。CLI／Workbenchは登録・操作除去とも書込み0。共通Driverは結果返却成功を推測しない。

| 現在状態と短命材料 | 配送登録専用経路の処置 |
|---|---|
| 履歴確認済み、未登録、短命材料なし | 保存Identityからexact登録候補を導出する |
| 未登録、Repo結合markerのみ | 同じ候補を再導出する |
| 未登録、exact登録pending＋marker | 同じ登録候補を出版する |
| 登録済み、markerのみ | 同じcurrentと登録集合を確認しmarkerを回収する |
| 登録済み、短命材料なし | Writer 0。固定結果IDと未受領状態を保持する |

pending単独、登録済みcurrentと同内容pendingの併存、別候補、history.pending併存、別利用側・別結果・受領済み登録の流用は拒否する。pendingを許すのは未登録currentと異なるexact登録候補だけであり、ReaderとWriter双方で再導出する。履歴全文・実体、元版、RootとHost両不存在を照合する。途中失敗後は同Ownerから再発行せず、fresh Ownerだけが同じ参照で再入場する。過去のlive清掃・Controller結果を合成せず、ACKを必要とする既存recoveredDeliveryを未受領登録へ流用しない。履歴確認済み行の期間整理後不存在は許容し再追加しない。

この登録接続は検証候補であり、既存Orchestratorの結果参照・耐久受領・整理、CLI／Workbenchの実際の返却、通常CLI回復入口のSource接続候補と全体E2Eの成立は別に確認する。phaseはsettlingを維持し、awaiting_deliveryを新たに生成しない。新Map、Lock、Schemaと配送Frameworkは追加しない。

現在Root専用の技術回収組立ては、既存準備Owner、DI資源回収、Host不存在遷移・清掃、全排他解放、終了保存、履歴確認、必要配送登録の順とする。準備済みOwnerのHostが既に不存在であれば、準備が確認した既知終端の五資源を維持し、削除済みHostへconfigを作り直さない。Host清掃の保存途中なら、その出版だけを既存Ownerで確定する。取得後は失敗・取消でも外側排他を一度解放し、解放不明では終了保存以降へ進めない。最初の停止理由と解放失敗を分けて返す。準備失敗時の清掃不明と、終了・履歴・配送Writerが返す短期Lock解放不明も同じ分離対象とし、例外だけから解放不明を推定しない。履歴または配送の保存確認後に解放だけが不明となった場合、確認済みの履歴・配送登録事実を失敗値へ戻さず保持する。

同期する下位要求は返却を待ち、段階間で取消通知を処理して次段の新Effectを止める。取消入力は非ProxyのAbortSignalに限定し、不正入力ではgetterやProxy trapを実行せず準備・要求0で拒否する。実行中の同期Docker要求を即時中断したという保証は置かない。開始前取消は準備・要求0。技術回収Driverの`recoverRuntimeOwnedDockerTaskFromCurrentRepository`単独では、技術回収・履歴・配送登録が済んでも操作を保持し、Task再実行、利用者への結果返却・受領、操作除去の完了を主張しない。後段ではtransient専用終了処理とdurable受領ACKを分ける。内部準備キーはPackage内部の後段処理へだけ渡し、公開診断へ展開しない。通常CLIにはこの組立てと用途別終了への接続候補を実装し、固定候補の独立指摘是正・再確認を進める。旧入口の現存だけを新方式の成立根拠にしない。

現在回復のtransient終了用の内部限定API候補は、その真正な内部準備Ownerから`completeRuntimeOwnedDockerTaskTransientRecovery`を一回だけ呼ぶ。全解放・終端確認済み、または同じ終了出版途中の正規再入場だけを受け、固定Root／Host両不存在を保存Ownerの各確認へ結合する。既存`settlements`の`current_completion`は終了候補・元本文・履歴全文／実体を一時保持するだけで、表示Receiptではない。保存OwnerはIdentity由来の固定consumerがtransientであること、対象pending配送0、現在終端・履歴確認、exact元版・候補と非対象保全を再導出する。Contextは一回の保存試行後に破棄し、新Map／Lock／Schemaは追加しない。内部APIの直接試験は、通常CLI／Workbenchの本番利用側への接続成立を意味しない。

| 現在状態と短命材料 | transient終了専用経路の処置 |
|---|---|
| 技術終端・履歴確認済み、短命材料なし | 既存Completion候補で対象操作だけを除去する |
| 同じcurrentとRepo結合markerのみ | 同じ終了候補を確定し、markerも回収する |
| 同じcurrentとexact終了pending＋marker | fresh回収Ownerで同じ候補を再確認して出版する。表示の再受領を要求しない |
| 対象除去済み、markerのみ | 保存marker限定清掃だけを行う。元Task成功・過去受領は再構成しない |

pending単独、同じcurrent本文のpending、別候補、履歴pending、未知File、durable consumerは拒否する。終了途中再入場では、既存の技術終端・履歴を確認済みなら同じ保存を再発行せず、対象の終了出版へだけ進む。保存確認とLock解放が共同成立した場合だけ`operationRemovalConfirmed`をtrueにし、保存途中失敗から対象の存在・不存在を断定しない。通常CLIへのSource接続候補は実装し、独立指摘是正・再確認中である。全体回帰・E2EとPackage完成は未成立である。

通常CLI接続の実装対象は、追加flagのない`doctor --recover-isolation <docker-task-id>`とする。CLIは既存取消binding、現在cwdのRepository検証、回復組立て呼出し、finallyでのunbind、診断表示を所有する。現在回復組立てはprivate準備Ownerの保存Identityからconsumerを確認し、技術回収・Host・排他・履歴の共同成立と配送方式の一致を要求する。CLI／Workbenchは表示前にtransient終了を一回だけ行い、Orchestratorは耐久ACK待ちで操作を保持する。CLI listenerの解放不明は一次理由・既確認技術結果と分離し、終了整理を巻き戻さずCLI終了コードへ反映する。

公開診断は固定fieldの明示投影に限定し、内部準備キー・Root・本文・候補を含めない。表示失敗で操作を復元・再実行しない。旧再起動後／Desktop修復後flagsは、この通常入口の代替能力とは扱わず、限定unknown終了Classの代替成立後に撤去する。新方式失敗から旧Journalへfallbackしない。接続候補はSource・利用側・試験が成立するまで本番接続済みと表示しない。

#### 保存markerだけが残った場合の限定清掃

`state.json`の出版後に`state.lock`だけが残った場合は、Taskの結果返却や受領を推定せず、Repositoryの保存markerだけを回収できる。初回current出版前の残存、不正current、pending併存はこの処置の対象外とする。通常Readerの拒否条件、既存のTask／Consumer Writerの根拠を緩めて代用しない。

入力は明示検証済みRepository Rootだけとし、保存Ownerの非公開処置として既存Kernel排他を使用する。新しいState、Schema、Map、receiptまたはLockを追加しない。現在Root／保存領域の実体、現在SchemaとRepository結合、exact本文のRepo結合marker、通常File・非link・単一linkを確認し、state／historyの全bytesと実体、pending不存在、既知File集合を処置直前まで再照合する。historyの明示不存在と読取不能は区別する。marker不存在は書込み0の処置不要とし、保存領域不明を不存在へ畳まない。

unlinkは確認したexact markerへ一回だけ行い、処置後はmarker／pending不存在、未知File追加なし、state／historyの実体・本文不変とKernel解放を確認する。unlink後例外、後観測不明、解放不明は成功にせず、既知の削除事実は保持する。自動unlink再試行は行わない。返却はmarker処置・保存内容保全・排他解放の確認だけであり、Task完了、Consumer受領、Docker資源不存在や実行Authorityを表さない。既存排他に従わない外部Processとの競合を原子的に防ぐ保証は置かない。

保存marker単独清掃に限る実装・実Repository／Kernel境界の候補を確認した。既存Readerの停止条件は解除せず、用途別終了整理と通常CLIへのSource接続候補は実装し、独立指摘是正・再確認中である。Task完了・受領・Docker回収の成立には拡張しない。

#### 再起動要求の現在状態と下位の短命状態

下位の終了通知では技術結果だけを取り込み、開始済み要求の`cleanup=pending / result=null`を維持する。Host／Home／Runtimeの外側排他をすべて逆順に解放した後、元の不透明な準備Ownerが同じ対象・要求・Scope・元版の終端値を一度だけ保存する。解放不明では`cleanup=unknown / result=blocked`とし、終端保存不明ではpendingを保持して追加処置を発行しない。終了通知だけで耐久結果をcompletedにしない。

終端保存には既存の短期State Writerを使用する。このWriter自身の排他解放は`lockReleased`、保存・読戻しは`snapshotConfirmed`として別に確認し、再起動の資源Scopeへ再帰的に加えない。解放済みOwnerはこの終端保存だけに使え、新しい処置・別対象更新・二度目の終端保存を許可しない。初期checkpoint未確定の開始前拒否からは、unknownやpendingを新たに生成しない。

以下はDocker Isolationへの移管先契約である。現在の準備・通常再起動組立ては単一checkpointとDI Rootへ切替えた候補だが、記録後Task回復・修復側・実Host本番接続の全面切替は未完了である。移管前に成立した停止・起動・取消・回収・再入場の保証を新入口と検証へ全数対応する。純粋な状態検査や記録の存在を実機対応の根拠にしない。

準備Ownerは現在Root、元操作・回復参照、Scopeと全Snapshot元本文を取得済みHost／Home／Runtime排他へ一回結合し、既存の不透明な準備Mapへ保持する。Scopeは実行義務が残る操作だけを含み、配送待ちだけの操作を除くには五資源終端、Host清掃、Lease解放、Owner失効と既存結果の清掃確認をすべて要求する。Host／HomeのIdentityは現Snapshotから解析し、旧AppData inventoryへfallbackしない。各処置前のfresh読取りで元本文を完全一致照合し、保存後は既存Writerが返した改訂・内容Hashと同じ読戻しだけを次の元版へ採用する。Writer内の現在Owner確認は保持中排他とRootだけで行い、状態Lockを再取得しない。Reader／Writerの排他解放不明は操作内に保持し、外側解放の成功で消さない。通常入口は現在Repositoryを固定し、旧配布Root引数・署名資格・phase／handoffから処置を許可しない。

再起動要求は既存のexact Task操作に結合し、単一`state.json`の`operations[].dockerRestart`へ保存する。初期値は`null`、操作の生存期間に一度だけ記録へ遷移できる。同じ操作で二度目の再起動や記録の置換を許可しない。停止・起動の個別phase、配列、日時、履歴chain、新しい共有Registry／Lockは追加しない。

| 保存項目 | 意味と固定条件 |
|---|---|
| `requestId` | Schema版、Repository結合、元操作Identity／exact回復ID、採用Scope／既存fence、再起動用途を含む非秘密envelopeのHash。Writerは再計算して照合し、後続更新で置換しない。Hashから実行許可を発行しない。 |
| `scopeSha256` | 採用した対象集合と既存Host fenceの固定非秘密表現のHash。要求IDの再計算に保持し、現在Scopeの再確認を代替しない。元要求の途中で置換しない。 |
| `request` | `not_issued / unknown / issued / confirmed`。記録の存在が保存済みの要求意図を表す。要求発行前に`unknown`を保存し、呼出し後の記録失敗でも未発行へ戻さない。 |
| `cleanup` | `not_required / pending / confirmed / unknown`。開始前の清掃不要と、開始後に実際に清掃した確認を区別する。 |
| `result` | `null`または`status / reason / request / effectOutcomeUnknown`の閉じた最終観測。DI返却の要求状態とEffect不明を欠測補完せず保存し、一次確定後は全fieldを上書きしない。元Taskの一次失敗・結果を変更しない。 |

| 現在値 | 再入場時の処置 |
|---|---|
| 記録なし・旧Schema・移行未確認 | 過去のphaseや署名から復元しない。新しい要求の現在許可と対象を確認できるまでEffect 0。 |
| `not_issued / not_required / null` | 現在の人間承認・Scope・既存Host排他を再確認し、同じWriterで`unknown / pending / null`を保存・読戻し・State Writerの更新排他だけを解放した後、初回要求を一度発行できる。Host-wide排他は解放しない。 |
| `unknown`または`issued` | 要求再発行0。exact要求に結合した実結果の観測と資源回収だけを行う。現在Engineがreadyでも、過去unknownを再起動成功へ書き換えない。 |
| `confirmed`かつ結果確定 | 再起動要求・結果の再観測0。残る既存Task回復と結果搬送は別の責務。 |
| `cleanup=unknown` | 回収を確認済みへ推定しない。同じ対象の未解決義務と現在の処置条件を保持する。 |

通常進行は、要求記録`not_issued/not_required`→外部呼出し前の`unknown/pending`→受付既知の`issued/pending`→exact完了・回収確認の`confirmed/confirmed/completed`とする。呼出し前のunknownから受付既知へ進めるのは、同じ稼働Ownerが元要求の受付結果を取得した場合だけである。Owner喪失・応答喪失で終了した過去要求のunknownと回収unknownは保持し、freshなEngine観測から上書きしない。結果は`null`から一度だけ確定する。`completed`は要求確認と回収確認が両方成立した場合だけ許可する。保存失敗、取消、応答喪失、清掃不明を成功へ畳まない。未解決の再起動要求は同じSnapshot内で最大一件とし、これをHost全体の安全確認の代用にはしない。

保存値は次の組合せだけを許可する。表にない組合せはSchema／Writerで拒否し、値を補完しない。

最終観測の`request`は`not_issued / unknown / issued / confirmed`、`effectOutcomeUnknown`は必須booleanとする。`completed`には上位の要求・回収の両confirmedに加えて、最終`request=confirmed`と`effectOutcomeUnknown=false`を要求する。上位unknownと最終not_issuedは異なる時点の事実であり、上位を未発行へ巻き戻さない。上位issued／confirmedと最終not_issuedの矛盾は拒否する。最終結果は、DI Sessionの終了と外側排他解放を試行した同じclosed Ownerが、既存finalizeと元版CASを通して一度だけ確定する。理由文字列から未発行やEffect不明falseを推定しない。欠測・旧result形式は拒否し、Front AIによる旧試験物の処置と新形式の検証を分離する。現在Sourceの同期が完了するまでは、この新しい最終観測契約を実装済みと扱わない。

| `request` | 許可する`cleanup` | 許可する`result` |
|---|---|---|
| `not_issued` | `not_required` | `null / blocked` |
| `unknown / issued` | `pending / confirmed` | `null / blocked` |
| `unknown / issued` | `unknown` | `blocked` |
| `confirmed` | `pending` | `null / blocked` |
| `confirmed` | `confirmed` | `null / completed / blocked` |
| `confirmed` | `unknown` | `blocked` |

`requestId`と`scopeSha256`は全遷移で不変、結果は`null`からterminalへ一度だけ確定する。先に確定した`blocked`は、後から回収が確認できても`completed`へ変更しない。blocked後にも同じ要求の回収だけを`pending`から`confirmed / unknown`へ進められるが、確定した回収値を戻さない。両confirmedはcompletedの必要条件であり、十分条件ではない。同じ稼働Ownerの完了成立、既存blockedなし、保存・読戻しの成立も要求する。

実際の停止、管理Process・Engine・backendの不存在、起動、起動後のEngine応答、補助Processの回収はDocker Isolationが一つの固定操作内で所有する。その内部進行は短命値であり、上位callbackへOS別phaseや生Sessionを渡さない。既存Host-wide lease／fence／排他は同じexact Identityで全Effectとcleanup終端まで保持する。各Effect直前には現在の許可・Scope・その排他・取消を再確認し、排他喪失・差・観測不能なら後続Effect 0とする。上位は現在状態の保存と既存の判断だけを担当する。

再起動結果はTask回復完了ではない。元Taskの再実行、Provider再送、候補採用、Commit／Pushを暗黙発行しない。未発行・呼出し前保存失敗・受付後保存失敗・完了後回収不明・取消・fresh再入場・別要求／別Scope・同時要求・terminal置換を反証し、Writerの元版Hash、読戻し、排他解放と実資源観測を別々に確認する。過去unknownを保持することと現在の実資源不存在に基づくTaskの限定終了は別の判定であり、後者の既存条件を再起動記録から変更しない。

記録後のTask回復も、検証済み現在Repositoryとexact IDを受ける通常CLI／公開Consumerへ統一する。旧`AfterRecorded`専用処理と`--after-recorded-docker-restart`は廃止し、旧flagは引数不正として処置前に拒否する。現在checkpoint・資源配列・実Owner・既存排他を再確認し、旧署名Manifest、AppData一覧、五件のrestart chainやsession handoffを通常回復のAuthorityへ再導入しない。旧`AfterVerified`修復引継ぎ・修復Gate・共通旧Readerも、現在経路との対応を確認して撤去した。実境界の未確認を撤去だけで成立へ変更しない。過去Evidenceの署名・本文は当時の記録として維持する。

検証付き再起動と障害修復は、公式Path、Docker Incの有効な署名および同一操作中の実体Identity／Hash固定を共通のNative Trust境界として使用する。Dockerの版または過去操作のHashを次の操作へ固定せず、正規Updaterによる更新を再署名や再設定なしで受理する一方、署名不明、Path差、操作中の差替えまたは必要実体の欠落ではEffect 0とする。正常再起動は公式Desktop pluginの`S`停止を使用し、run Directoryを変更しない。正常起動が既知socket障害で成立しない場合は、同じ起動Effectを盲目的に再発行せず、正常再起動を終了してから既存の障害修復Lifecycleへ移る。障害修復だけが`K`停止、Docker WSL停止およびrun世代退避を所有する。子Job・EOF取消・応答の責務は[Native設計](../platform-access/01_Architecture.md#5-状態資源回復)を参照する。TypeScriptから渡したPathやHashだけをNative操作Authorityにしない。停止CLIのexit 0の後にも管理Process・CLI不存在、Linux Engineの既知停止およびWSL停止を確認する。起動後は信頼済みCLIによるLinux Engine応答を別に確認し、選択されたDocker backendの実装詳細であるWSL Distributionの`running`状態をEngine Readyの必須条件にしない。

Engine観測は`ready`、`known_unavailable`、起動直後のCLI Probe Timeoutである`transient_unavailable`、全体起動期限を超えた`startup_timeout`および`unknown`を区別する。再起動Effectがconfirmedになった後だけ、`known_unavailable`と`transient_unavailable`をHost Effectなしの読取り再観測へ接続し、冷間起動を考慮した180秒の全体期限まで待機する。単一ProbeのTimeoutを状態不明として即時終了せず、同じ起動Effectを再発行しない。全体期限超過は専用理由で停止し、取消、Trust変化、権限・資源不足および分類不能な一般エラーは待機対象へ広げず`unknown`で即時停止する。Engine Readyを同一実行内で確認できた場合は、起動要求直前からReadyまでの単調時計による所要時間を診断用の参考値として公開結果とEvidenceへ残す。再入場をまたいで開始時点を観測していない場合は推測せず未計測とし、この値をAuthority、成功条件または将来の固定Timeout根拠にしない。Engine named pipeも`present`、`absent`、`unknown`で観測し、明示的な`ENOENT`だけを`absent`とする。open後のclose失敗はEngine状態だけでなく資源回収状態にも保持し、Native helperのreleaseが成功しても上位のcleanupを確認済みにしない。

#### 旧署名保存状態からの限定再入場（比較基準・現在実行禁止）

この小節全体は旧署名方式の記録・command・Sourceを照合する比較基準であり、現在Runtimeへ適用しない。旧Root／Manifest／chainを読む互換Readerや旧Doctor引数を新Runtimeへ残さない。現在はフロントAIの移行確認が完了するまで新Effect 0で停止する。現在の回復契約は同じexact Recovery ID、Effect再発行0、fresh実資源観測、観測不能と不存在の区別、unknownと未解決義務の保持を維持する。これらの一般保証は本節の旧署名方式の廃止とは別である。

現在署名から発行する操作権限と、`originReleaseRoot`で確認する旧署名の由来は別である。元の`engine-restart-*`を上書きせず、対象・submission・保護Rootを結合した`engine-handoff-*`と`engine-continuation-*`を追記する。旧署名は現在の実行権限を発行しない。

| `currentPhase` | 必要な処置と限界 |
|---|---|
| 未記録 | 停止意図を記録して公式停止へ進む |
| 現在Runtimeの`stop_intent` | freshな停止観測だけで照合する。Desktop生存なら同じ停止を再発行せず未確定を保持 |
| `stopped` | 停止を再観測し、未発行の起動意図・起動へ進む |
| `start_intent` | 起動を再発行せずEngine Readyをfreshに観測する。成立時だけ`ready`を追記し、回収と確定へ進む |
| `ready` | Engineを再観測し、回収後の確定だけを進める |
| `settled` | 再起動Effectを再発行せず停止。完了Task復旧は別入口 |

別Runtimeの引継ぎは、元記録が単一`stop_intent`である限定契約だけを受理する。現在Runtimeの継続記録がまだなければ、元の`stop_intent`を現在phaseとして継承し、同じphaseの継続記録をseedとして追記する。その後は公式停止を再発行せず、停止状態のfreshな観測からだけ再開する。原記録は保持し、任意の旧phase継続は保証しない。Host・Home・Runtime Stateの3 Lock、Native実体と旧CLI不存在を確認して引継ぎを確定し、待機後にも境界・取消を照合する。完成判定には、署名済み配布物から別Runtimeへの引継ぎと停止再開を実機で反証したEvidenceを要求する。

利用側への伝播対象は、公開Help／引数Parser／Dispatcher、Native要求と結果、保護記録の読取りと再入場、Task復旧、結果投影、署名依存集合およびWorkflowとする。正常再起動、対象なし、他Task稼働、観測不能、停止中断、起動失敗、資源残存、取消、親喪失および再入場を契約試験から公開入口の結合試験へ対応付ける。再入場は保存済みphaseごとに、前のEffectを再発行せず現在状態を観測して次の耐久phaseへ進める経路を持つ。とくに`start_intent`は起動要求済み・結果未確定を表すため、Engine Readyのfreshな観測から`ready`へ収束できなければならない。

以下は旧Runtime当時の契約であり、現在の実行入口ではない。Docker create要求の耐久化後に応答を失った状態は、Engineの空一覧だけから未作成へ収束させない。ただし、同じ選択ユーザー・保護Root・Policyへ結合されたDocker Desktop最終復旧が当該要求より後にProcess世代を切り、Engine再起動・安全状態・Evidence保持を確認して終了した場合、その署名済み履歴を再起動境界として利用できる。現在のRuntime Authorityと旧復旧記録の由来確認を分離し、旧manifestは履歴検証だけに使って実行Capabilityを発行しない。対象Taskのexact名と所有labelがともに不存在であることを再観測し、その結果と復旧記録hashをTaskのOperation Directoryへ耐久化した後だけ、未知のcreate結果をEffect 0へ収束させる。順序、由来、終了状態または不存在のいずれかが不明なら回復義務を保持する。

旧Releaseの署名manifestと修復chainを照合する上記方式は歴史比較・フロントAIによる旧形式移行の入力に限定し、現在Runtimeの利用者入口にはしない。公開Doctorから旧adopt／close／after-repairと`--repair-release-root`を撤去し、未知引数として処置前に拒否する。旧記録を現在stateへ推測変換せず、元Evidenceは不変とする。現在の修復はRepository内の同exact ID、不要退避物の回収または期限付き明示保持の履歴／終了へ接続する。Taskは`--restart-docker-for-recovery`と通常の`--recover-isolation`を別操作として現在checkpointへ接続し、署名済み修復履歴を実行許可へ変換しない。既知ID回収と認証作成結果不明の限定終了を区別し、その他のunknownへ一般化しない。実Docker再起動・遅延create・再ログオン・実E2Eは別の未完了検証とし、この入口撤去から成立を主張しない。

選択ユーザーの安定IdentityとログオンSession Identityを分離する。安定Identityは、再ログオンをまたいで同じ所有者の耐久記録を相関する根拠であり、それだけでは現在の変更権限にならない。旧記録のログオンSession Identityは発行時の証拠として上書きしない。現在の変更権限は、現在の署名済みRuntime、Native helper、Root Identityと保護、Policy、物理Lock、および変更直前・直後の現在Session観測がすべて成立した場合だけ得られる。旧Sessionのhandle、Capability、helper、Provider Home許可またはLockを再利用しない。

旧Runtime当時の再ログオン後のDocker Desktop修復履歴は、元記録を変更せず、前後Session、安定Identity、Runtime実行Identity、直前の引継ぎhashを持つ順序付きの引継ぎ記録を別途追加する。終了済みの旧修復は、現在のDocker状態を観測・変更できない場合でも、由来、原記録、引継ぎ連鎖および現在境界を確認し、Effect 0で履歴の採用と終了を記録できる。現在のDocker障害は同じ修復の再開とはせず、新しい修復Operationとして扱う。未終了の旧修復は、段階ごとに安全な再開、現在状態のexactな観測と収束、または同じ修復IDを保持した停止へ分類し、履歴採用だけでHost Effectを再発行しない。

修復Operationの配下にあるContinuation記録は、発行元Session／ReleaseのIdentityを上書きしない。Record StoreがOperationの署名済み引継ぎ連鎖を検証し、その同じ読取りでOperationを現在Session／Releaseへexactに結合した場合に限り、連鎖に含まれる`localUserBindingHash`、manifest hash、Release番号およびRuntime実行Identityの完全な組を旧Continuationの読取り根拠として使用できる。同じSessionのままReleaseだけが更新され、Session handoff記録を新設しない場合は、検証済みの現在実行境界を連鎖末尾の読取り・追記Authorityとして追加する。Consumerが同じfieldを持つplain Operationを組み立ててもAuthorityにはならない。新しいContinuation段階は常に現在の境界で追記し、連鎖外の組、部分一致、改変、現在境界との未結合または降格をEffect 0で拒否する。これにより、旧Runtimeで確認済みのEffectを再発行せず、同じ修復IDと順序を保ったまま現在Runtimeへ収束させる。

未終了の旧修復が現在Sessionへ正しく引き継がれた後、現在Engineが既知の停止、現在のDocker Process集合の存在または不存在が確定し、旧stale対象が明示的不在または旧Operationの`runIdentity`と完全一致するEvidenceとして保持され、かつ現在の`Docker/run`と同じIdentityに既知のlock障害がある場合は、明示終了操作により旧履歴の不確定Effectと既存stale Evidenceを保持して閉じ、新しい修復Operationを許可できる。現在の`Docker/run`が旧記録から別世代へ置換済みでも、freshな二回の観測とlock対象が同じ現在世代へ一致する場合だけこの分類を使う。旧stale対象が別Identityまたは観測不能なら閉じない。この処置はDockerの復旧成功も旧Effectの不存在も意味せず、`manualRecoveryRequired`を維持し、Host Effectや削除を発行しない。新しい修復だけが現在Authorityの下で停止、`run`世代退避、再起動およびEngine確認を行う。これにより「旧履歴を閉じるには既に復旧済みであることが必要だが、復旧するには旧履歴が閉じていることが必要」という循環を作らない。

既知のruntime directory lockは特定のsocket名へ固定しない。現在の既知Runtime領域は`%LOCALAPPDATA%\Docker\run`と`%LOCALAPPDATA%\docker-secrets-engine`の閉集合である。各領域を独立して有限件数で列挙し、子Directoryまたはlinkを拒否し、項目集合とDirectory Identityが観測前後で不変で、少なくとも一つの直下項目が既知のlock errorを返す場合だけ認定する。再帰探索、wildcardまたは名前の追加だけで修復範囲を拡張しない。列挙不能、件数超過、境界変化、未知errorまたは一領域だけの成立ではEffect 0または同じ修復IDでの停止とする。修復Effectは個別socketを削除せず、信頼済みProcess停止後に各exact Directory全体を同一親内へ順序付きで退避する。

Runtime利用側は履歴の有無だけで処置を決めない。`不正 → 履歴なし → 終了済み → 現在Session結合済み → 旧Session結合`の順で排他的に分類する。現在Session結合はboolean表示だけでなく、履歴が返す現在Session Identityと準備済み境界のIdentityが一致した場合だけ成立する。旧Session結合ではStoreの正式な引継ぎ処理をexactに1回呼び、元Operation、元adoption、ledgerおよび履歴連鎖の不変fieldを保持したまま、handoff件数、handoff tipおよび現在Session結合だけが許可どおり変化したことを再読取りで確認する。Storeへの書込み後に返値検証または後段が失敗しても、正規記録をrollback、削除または上書きせず、同じ修復IDを保持して次回inventoryから再分類する。終了済み履歴では現在境界の認証とread-only報告に必要なhelper確認を許すが、新しいhandoff、closure、Host観測またはHost Effectを発行しない。

Docker Task Recoveryは元のRecovery IDと発行時Sessionの証拠を保持し、再ログオン時は同じ安定Identity、元の耐久記録、現在の保護境界および現在Sessionを結ぶ順序付き引継ぎ記録を追加する。引継ぎ後も変更前にHost世代、論理Home、Runtime Stateの各Lockを取得し、外部観測の間だけ解放したLockを同じIdentityで再取得してから続行する。Docker Desktop再起動Fenceは、終了済み修復記録と現在のfreshなEngine・資源不存在観測が両方成立した場合だけ利用でき、履歴の採用または引継ぎだけでは成立しない。

複数のDocker Task Recoveryが同じRuntime Stateに残る場合も、件数競合だけを理由に全Recoveryを処置不能へしない。検証付き再起動の準備は、現在Inventoryにある全Recovery IDを閉集合として取得し、各IDから導いたHost世代を決定順で、続いて各論理Homeを決定順で、最後にRuntime StateをLockする。全Lock取得後にInventory、論理Home集合、Host Root／NonceおよびRuntime State Rootをfreshに再観測し、追加、欠落、置換または観測不能があればHost Effect 0で停止する。全Scopeが非稼働と確認できた場合だけ、選択した一つのexact Recovery IDへ再起動記録を結ぶ。再起動後のTask回復は、対象IDがInventoryへ残り、対象固有の再起動chain、pending submissionおよび資源不存在を検証できる場合に限り、その対象だけを収束させる。他のRecoveryを削除、完了化または同じEvidenceへ合成せず、残ったIDは次の独立した回復として処置する。

いずれの引継ぎ連鎖も件数を上限8に制限し、自己参照、循環、分岐、番号飛び、前後Session不一致、Identity不一致、改変、部分書込みまたは上限超過をEffect 0で拒否する。Releaseは`origin <= adoption <= handoff[0] <= ... <= handoff[n] <= closure <= current boundary`の単調な連鎖とし、同じRelease番号では同じ署名済みRelease Identityだけを許す。将来Release、降格または同じ番号の別Identityが混在する連鎖は採用しない。

新しい履歴記録は同一Filesystem上の準備fileをflush・再読取りした後にhard linkで排他的に公開し、単一の勝者だけを採用する。読取り専用の利用側は、公開済みtargetだけ、公開済みtargetと同一fileの準備残存、準備fileだけ、不正または観測不能を区別し、残存物を削除せず、準備残存を含む履歴全体を`verified`または完了へ昇格しない。現在の署名済みRuntime、検証済みRoot／保護／Policy、現在Sessionおよび外側Lockを確認済みの対象限定persist経路だけが、期待byteと同一file Identityの準備残存を削除して公開済みtargetへ収束できる。共有公開処理のbyte一致やhard link成立自体はAuthorityを作らない。別file、別候補、未知名、不正byte、部分file、観測不能またはDirectory境界の確定不能では何も削除せず、元記録と同じRecovery IDを保持して停止する。

公開成功は、Platform固有の確定確認、freshなtargetのexact byte、および準備fileの明示的な不存在を同じ最終判定で再確認した場合だけ成立する。POSIXではfileのflushに加えてDirectoryを`fsync`する。Windowsでは同じ呼出し中のDirectory Identity不変と最終形状を確認し、Process crashまたは再ログオン後に安全に再分類できることを保証するが、Directory metadataの電源断耐久性までは主張しない。したがって、この契約を「耐久公開」ではなく「回復可能な公開（Recoverable Publication）」と呼ぶ。

異なるbyteの同時公開では、勝者が作った最終共有状態と敗者の局所結果を混同しない。敗者は公開前の競合拒否としてEffect 0を返し、敗者固有の開始状態または終了状態を捏造しない。全Process終了後の共有観測は、targetが勝者のexact byte、準備fileが不存在、状態が`STATE-REPAIR-HISTORY-PUBLISHED`であることを別に確認する。

<a id="14-consoletask内部搬送回収の実装契約"></a>

### 現在状態と履歴を分ける縮小設計

切替前の設計として、Repository Rootを検証した`.crdd/coordinator/`へ`state.json`、`state.lock`、`state.pending.json`、`history.jsonl`を置く。配置の共通責務は[Runtime Data](../domain-model/03_Repository_Storage.md#compact-owner-layout)、Project側の仕事の保存は[Orchestrator詳細設計](../orchestrator/02_Detailed_Design.md#compact-runtime-storage)が所有する。既存の回復記録とcaller接続を置換済みとは扱わない。

| 情報 | 所有・終了条件 |
|---|---|
| `state.json` | `operations / unresolvedRecoveries / pendingDeliveries`を中心とする現在の閉集合。完了・回収・受領を確認した項目は除き、過去の診断やEvidenceを追加し続けない。 |
| `state.lock / state.pending.json` | Coordinator側の単一Writerによる短期更新。実効排他、期待改訂版、保存確定、read-backと中断時の同一Identity再入場を確認する。複数Writer用の新Lock Frameworkは作らない。 |
| `history.jsonl` | 時刻と相関Identityを含む有限な終了・診断要約。最初の失敗とcleanup／後続失敗を別々に残す。回復AuthorityやEvidenceの代わりにしない。 |

通常の回復は内部で処置し、自動処置できず人間操作が必要な場合だけ「再認証」「Docker再起動」等の具体的な介入を要求する。未解決回復を自動期限切れにせず、大量の未解決蓄積はRuntime不具合として扱う。通常履歴の保持は、他のRuntime所有者と同じ期間基準を用い、下表のTool別設定へ固定する。状態から履歴への確定搬送、既存回復・利用側のSource切替は未完了であり、現行の診断通知を耐久搬送済みと主張しない。

| 項目 | 縮小後の契約 |
|---|---|
| 設定 | `.crdd/config/coordinator.json`。非秘密のTool別設定として明示allowlistでGit管理できる。OrchestratorやExecution Intelligenceの設定を流用しない。 |
| 形式・既定 | `schemaRevision: 1`、正の整数`historyRetentionDays`。当該Fileの明示不存在だけを既定30日の根拠にする。不正・観測不能では履歴整理を停止する。 |
| 配布例・Schema | `template/.crdd/config/coordinator.example.json`、`template/tools/schemas/coordinator-config-schema.json`。Domain Modelの`readCoordinatorConfig`が実設定だけを読取り、例を実設定として読まない。履歴本番Writerへの適用は一体切替で確認する。 |
| 整理範囲 | 終了要約・通常診断のJSONLだけを期間で整理する。`state.json`の未解決回復・未受理結果、Candidate、認証情報、正式Evidenceへこの期間を適用しない。 |
| 時刻・相関 | 各行にUTC時刻、Operation／Attemptの相関、記録区分を持つ。一次失敗とcleanup結果を別のfieldへ保持し、生出力・秘密値・絶対Pathを保存しない。 |
| 状態からの除去 | 必要な終了要約を保存・読戻し確認し、資源終端・回復解決・固定利用形態に必要な受領条件を確認した後だけ操作を除く。CLI／Workbenchは耐久ACKを要求せず、Orchestratorは耐久受領を確認する。履歴はAuthorityやstate復元元にしない。 |
| 中断・重複 | 同じOperation／Attemptと記録区分に結合した要約の保存を再確認する。履歴書込み失敗をTaskの再実行へ変換せず、確認前のstate除去を拒否する。同じ結果の再搬送でProvider Effectを再発行しない。 |

件数・容量を通常履歴の削除基準として追加しない。処理の入力上限と未解決状態の受付上限は、通常履歴保持と別の安全条件である。履歴保存・期間整理はCoordinatorの単一Writerが共通保存部品を使って行い、独立した履歴サービス、回復DBまたはOperationごとの診断Directoryを追加しない。

過去の作成結果がunknownであるAttemptの終了は、今回の限定Classだけを対象にする。Provider本体起動前、外部送信なし、共有書込みEffectなし、旧OwnerのEffect不能、遅延Createの無害化、現在の対象Process／Container／Network等の不存在をすべて確認する。観測不能は不存在ではない。条件を証明できない場合は閉鎖しない。過去unknownを保持した終了分類と新規受付の可否を別判定にし、通常cleanup成功、過去Effect不存在、Provider開始後の回復へ一般化しない。この終了経路の実接続・反証はOPENである。


#### 現在状態Snapshotの構造

修復の回復結果には、九処置すべての確認済み／明示不要をDIの純粋終端判定で要求する。Engine準備完了・現在安全・退避状態既知・補助Process清掃確認との共同成立を必要とし、未観測を不要へ読み替えない。結果確定後は一次失敗のnullを含む全文と九処置を固定し、後続の清掃確認・安全性観測で過去の失敗を消さない。Task専用の未解決回復参照へ修復variantを混入させない。

現在のSource候補は`crdd-coordinator/current-state/v2`だけを受理し、`operations`を`docker_task`と`runtime_repair`の判別unionにする。前者は従来のTask Identity・五資源・Host・Lease・実行状態を保持する。後者は修復専用Identity（操作世代・操作ID・Repository結合・利用者結合・Scope Hash・CLI利用側）、exact回復ID、修復phase、DI技術checkpoint、上位の保持判断・一次失敗・結果だけを持ち、Task fieldを架空値で補完しない。新修復IDは固定IdentityのHashと世代へ結合し、Task回復ID parserへ渡さない。

DI checkpointのkey・技術順序は下位Root codecで検証し、CoordinatorはIdentity・改訂・対象外全文・人間の保持判断との相関を検証する。Task専用利用側はkindを確認してからTask fieldへ触れ、同じSnapshot内の修復を保全する。Task Writerは修復の新規作成・更新を拒否し、技術checkpointと保持判断は修復専用Writer・真正Ownerへ接続する。修復のsummary／historyは専用値契約で検査し、通常修復Writerはその更新を外側と排他内で拒否する。専用履歴出版・除去が未接続の間はTask履歴・配送から修復を終端化せず、値候補の成立を実保存・本番再入場の成立にしない。旧v1や旧Journalの移行はフロントAIが行い、Runtimeのfallback Readerは作らない。

開始保存または開始Context準備が失敗した場合、固定Identity確定済みの元Ownerは、元失敗・回復参照・実Lease解放の確認を保持する。Controllerは同じOwner、管理Capability、Home、回復参照および失敗理由を照合した停止だけを公開分類へ搬送し、初期化停止を不正Identityへ一律置換しない。公開停止結果への内部寿命結合は処置権限ではなく、その結果を通常処置・Lease解放のCapabilityとして利用できない。Mount返却だけから全体cleanup成功を推定しない。この接続は局所試験済みであり、実境界・全体完成の確認とは区別する。

以下は縮小後の保存契約である。開始Owner、資源checkpoint、通常Host復帰と終了driverへの本番callbackはこの形式へ切替中である。実行評価の全発生点、上位ACKの本番接続、新Processの回復入口と旧試験の移行は未完了であり、Runtime全体の切替済みとは扱わない。保存名は`state.json`を維持する。実行終了後も回復・結果搬送のために基本情報が必要なので、当初案の`activeOperations`を`operations`へ具体化する。稼働中かどうかは一覧の存在ではなく、その操作の現在phaseと実Ownerの観測で判断する。

| 最上位field | 保存する内容 | 不変条件 |
|---|---|---|
| `schema` | 現行Snapshot形式の識別値。 | 最新形式のみを受理する。旧形式の移行はフロントAIが担当する。 |
| `revision` | Snapshot更新の単調増加整数。 | 更新は期待する元版から次版へ一回だけ進む。同版別内容は拒否する。 |
| `previous` | 元Snapshotの`revision`と`payloadSha256`。初回だけ`null`。 | Hashは元`state.json`のexact UTF-8 bytesに結合する。元内容を複製しない。 |
| `repositoryBinding` | 検証済みRepository Identityと物理Rootへの結合。 | 複製・移動・別worktreeのSnapshotをそのまま操作許可へ使わない。 |
| `operations` | 未終了の操作基本情報、現在phase、必要な資源checkpoint。 | 同一操作の基本情報を一箇所だけに保持する。終了済みだが未受理の操作も、削除条件成立まで残す。 |
| `unresolvedRecoveries` | 操作参照、exact回復参照、残る回収義務と現在の停止理由。 | 必ず同じ`operations`項目へ結合する。期限や履歴件数で削除しない。 |
| `pendingDeliveries` | 耐久受領が必要な利用側への操作参照、結果Identity、未受理の結果と受理checkpoint。 | 固定Consumerの同一結果への耐久ACKを確認した後だけ除去する。配送待ちを未回収Docker資源と扱わず、操作基本情報や資源記録を複製しない。 |

`operations`の一項目は、Operation／Attempt／Recovery Identity、ProviderとProfile、発行時RuntimeとHomeの結合、現在のOwner世代、資源の種類・正確なID・要求状態、Host／Leaseの現在checkpoint、一次失敗、最終結果区分を保持する。秘密値、Prompt、Provider生出力、診断全文、過去の状態列は保持しない。書込み可能な共有Mountの有無は限定終了の判定に必要なため、省略して非該当と扱わない。

操作の固定情報と更新可能な現在値を区別する。回復IDは固定した操作情報の内容Hashへ結合し、可変Snapshot全体のHashへ結合しない。同じ操作のcheckpoint更新で回復IDを変えず、更新時には固定情報の一致も確認する。新しいAttemptには新しいnonceを発行し、過去Attemptの回復IDを再利用しない。

| 保存内容 | Ownerと更新条件 | 維持する検証 |
|---|---|---|
| 操作の固定情報 | 操作開始時に一度固定する。Operation、nonce、Provider／Profile、許可参照、Home／Runtime結合、予定資源、Image、操作mode、共有Mount条件、初期Host結合。 | 閉じたfield集合、同じ基本情報の内容Hash、同じexact回復IDへの相関。 |
| 資源・Host・Leaseの現在checkpoint | 同じ操作の実要求・実観測・現在世代に応じて更新する。 | 個別checkpointの構造検証だけでなく、要求前記録、相関、遷移順、現在の実体観測を照合する。 |
| Hostの処置前提 | Coordinatorの確認結果を既存Host Ownerへ用途限定で渡す。 | opaque Capability、一回消費、現在Host世代と実体排他を維持する。Snapshot項目の存在だけで回収許可を作らない。 |

現在の記録構造検証は`state-storage/model.ts`のprivate検証・codec・遷移候補が所有し、保存・読戻し・履歴・受領確定は`state-storage/settlement-store.ts`、現在資源／Host／Ownerの接続はRuntime Callerが所有する。構造検証のPassを資源不存在、現在Authorityまたは完全な遷移検証の代替にしない。旧`active-docker-task-v1.json`・旧record-model・旧全域Inventory／回復APIは退役済みであり、互換Readerを追加しない。現在経路の元版・exact ID・資源終端・Host世代・Writer／ACKの確認は保持する。実資源の処置、実再ログオンと公開E2Eの未証明を、旧経路撤去から成立へ換算しない。

旧RuntimeState一覧向けの`recovery-lock-controller.ts`と`state-binding.ts`は本番利用側がなくなったため撤去する。旧controllerの処理中解放・再取得は現行方式へ移植しない。現在の回収OwnerはHost／Home／Runtimeの長期排他を保持し、状態保存だけ短期State排他を用いる。外側観測の後は元版全文・exact回復ID・現在Ownerを再確認し、解放不明では後続処置を拒否する。旧方式の専用試験7件の退役は、正式検証義務や実境界の完了を意味しない。

初回操作の候補構築は`prepareCoordinatorStateOperationSnapshot`が既存の固定Identity本文を一度だけ現在集合へ追加する。全五purposeは未要求・未観測、Hostは初期Token、Leaseは保持中、実行・送信・共有書込みは未発行として評価する。Host遷移意図は初回Identity保存とは別の次版で記録し、候補構築だけでHost処置を発行しない。既存操作・未解決回復・未受理搬送を保持し、元本文Hashと次版を結合する。重複操作や不正元版は候補を返さず、初回nullを新品Rootの証明へ昇格しない。本番Producerはこの候補を既存Writerへ接続し、現在Root・Lease・Hostを保存時に別途再確認する。候補単体から本番実境界全体の成立を主張しない。

資源要求は既存の五purpose（`create_subscription_auth_probe`、`create_internal_network`、`create_egress_network`、`create_proxy`、`create_provider`）に限定する。要求前、意図保存、要求発行、応答／ID確定、現在資源の存在・不存在・観測不能を区別する。意図保存からDocker受理を、空IDから不存在を、清掃要求から清掃完了を推定しない。動作を広げるための任意purposeや任意Pathは追加しない。

##### 現在状態の本文と証明情報

実行側の通常回収も五purposeのReceiptを明示評価する。Receipt読取り自体が不明、またはいずれかのpurposeが欠測なら、未要求の値で補完せず回収未確認を返す。その状態から資源削除やconfig除去を進めない。明示された未要求と記録欠測を同一視しない。旧集約不存在記録への保存経路は撤去済みであり、現在Snapshotでは資源別結果を同じexact参照へ結合する。全Producerと実資源境界の共同確認は未完了である。

実行側から回収記録側へ渡す資源別結果は、固定purpose、計画名、取得済みDocker IDと`not_requested / absent / unknown`を保持する。明示的な未要求を不存在観測へ読み替えず、exact Receiptがない経路は資源別結果を`null`とする。Controllerは結果を変更せず搬送する。この搬送値だけを耐久的な不存在証明とは扱わない。Snapshot保存への接続時には操作Identity・所有境界と再観測根拠を照合する。搬送値は現在のresource／cleanup Writerへ接続するが、搬送だけを保存確定や実資源不存在の根拠にしない。全体の実境界確認は別に残す。

一資源の保存接続は`checkpointRuntimeOwnedCoordinatorResource`が所有する。現在の操作OwnerとRepository結合を借用し、短期読取り後にLockを解放してから、同じexact参照と操作IDを確認する。更新候補を既存Writerへ渡し、Writerの排他下で元改訂版を再照合する。読取りと保存の間の競合では古い候補を再試行せず停止する。戻り値の保存確定、Lock解放、Filesystem Effectを分けて受理する。呼出し自体はDocker要求やProvider送信を発行せず、実行側の全checkpointと実Effectの対応について、全Producerを通す実境界確認は未完了である。

一資源の更新候補は既存モデル内の`prepareCoordinatorStateResourceSnapshot`で構築する。同じexact回復参照の資源だけを更新し、他資源、Host、一次失敗と結果を保持する。`not_requested → intent_saved → issued`を区別し、発行後に応答が不明なら`unknown`を記録できる。後着の作成結果または現在照合でIdentityを確定するまで、未発行や成功へ戻さない。この値変換は保存確定・実資源観測・Authorityの証明ではなく、要求の再発行も行わない。本番Producerと物理Writerの全checkpoint接続について、実境界を含む一体確認は未完了である。

全回収観測は`prepareCoordinatorStateCleanupSnapshot`と`checkpointRuntimeOwnedCoordinatorCleanup`で同じ元版へまとめる。五purposeの順序・計画名・現在IDを照合し、欠測・重複・別資源を拒否する。明示的な未要求は未要求のまま保持し、通常回収の不存在はID確定済み資源だけに許可する。ID未確定の終了は別の限定unknown終了契約で扱い、本経路から一般化しない。不存在の根拠Hashは観測結果・exact参照・元本文Hashの相関用であり、実観測やAuthorityの代替ではない。保存は既存の短期排他・元版照合Writerを共用し、五資源ごとの部分保存を行わない。旧回収記録経路は撤去済みであり、現在の全回収観測と現行Writer／Callerの全Producer接続は、実資源境界を含む全体確認が未完了である。

Hostの保存接続は`prepareCoordinatorStateHostSnapshot`と`checkpointRuntimeOwnedCoordinatorHost`が同じWriterを使う。既存Host Ownerのexact処置前本文を保存し、その本文が示す次世代Tokenを観測した後だけ現在世代を進めて意図を解消する。処置前記録なしの世代変更、未確定意図の消去、旧世代への巻戻しを拒否する。本文検査はHost実体の終端、排他解放や処置Authorityを代替しない。新しいHost遷移・Lock・DBは追加せず、現在Host Owner／Writer／Callerの一体接続の実境界確認を残す。

実行と終端の評価は`prepareCoordinatorStateLifecycleSnapshot`と`checkpointRuntimeOwnedCoordinatorLifecycle`で保存する。受理する項目はphase、Lease、実行・送信・共有Effect、一次失敗、最終結果、終了要約Hashの六fieldに限定する。固定Identity、資源、Host、回復と搬送一覧はこの更新から変更できない。既知Effectの未発行化、unknownの未発行化、一次失敗・確定結果・要約Hashの上書きは既存遷移検査で拒否する。保存値を実Lease解放、Authority失効や回収完了の証拠にせず、それぞれのOwnerの実測を前提にする。本番Controller・終端Ownerは現在WriterへSource上で接続している。全Producerと実資源・Hostを通す一体実証は未完了である。

回収と搬送の参照集合は`prepareCoordinatorStateReferencesSnapshot`と`checkpointRuntimeOwnedCoordinatorReferences`で保存する。現在Ownerに一致する一操作だけを更新し、回復ID・操作nonce・結果ID・Consumerと受理Hashを保持する。他操作の集合は保存したまま、固定順序と重複拒否を適用する。未受理から同じ結果の受理Hash確定へ進められるが、確定後の差替えや巻戻しを拒否する。終端証明の本番接続が未完了の間は、回収義務と搬送項目を削除しない。この記録だけをConsumerの実受理や回収解決の証拠へ昇格しない。

現在状態の外側はobject keyを辞書順とするUTF-8 JSONと末尾一つのLFで固定する。配列の順序は保持し、集合は操作nonce、資源purpose、操作nonceとConsumerの組で昇順・一意にする。非正規本文、重複key、不正UTF-8、BOM、未知fieldを拒否する。

| 保存項目 | 固定する意味 | 検査の限界 |
|---|---|---|
| `identityJson`、`identitySha256` | 操作開始時の閉じた基本情報の確定本文とSHA-256。本文の項目順と末尾LFも保持する。 | 可変SnapshotのHashへ回復IDを付け替えない。固定情報のPathを現在の書込み許可にしない。 |
| `host.pendingTransitionJson` | Host Ownerが確定した処置前本文と次世代Tokenの相関。元のJSON項目順を保持する。 | 外側のkey整列をNative証明本文へ適用しない。保存内容検査は現在Hostの実体確認を代替しない。 |
| `resources` | 五purposeを必ず評価し、要求状態と現在観測を別fieldにする。 | ID確定済みで観測がunknownになってもIDと受理根拠を保持する。不存在の根拠Hashだけから実不存在を推定しない。 |
| `primaryFailure`、`outcome` | 最初の失敗と後続清掃・最終結果を別に保持する。 | 最終結果による一次失敗の上書きを禁止する。 |

本文上限は16MiB、未終了操作と回復参照は各64件、耐久結果搬送は操作ごとにOrchestrator一Consumer、全体で64件までとする。CLI／Workbenchの一時返却はこの耐久配送集合へ追加しない。上限到達時は未解決情報を削除せず新しい受付を停止する。これらは履歴保持上限ではない。`state-storage/model.ts`はcodec・構造検査・候補導出・改訂間遷移を所有し、実際の受付・保存確定とHost回収への接続は本番Writer／Callerが担う。現在Sourceに接続しているが、全Producerと実資源・Hostを通す一体実証は未完了である。

基本情報の除去条件は、対象の資源終端、回復義務の解決、全結果受理、必要な終了要約の保存確認がすべて成立したことである。Process終了だけで除去しない。回復参照と搬送参照の重複、参照先不存在、別Attemptへの参照流用、immutable Identity差を拒否する。履歴を失っても操作Authorityを復元せず、同じ旧領域を新しいAttemptへ再利用しない。

#### 終了履歴の導出と現在状態の整理

通常終了では、過去のProvider開始・外部送信・共有書込みの観測評価と、現在の資源回収義務を分離する。過去評価が`unknown`でも、それを未発行・成功へ変換せず終了要約に保持する。五purposeが明示的な未要求／未発行、または既知IDに対する現在不存在であり、真正なProcess終端・Host清掃・Home／Mount Lease解放・旧OwnerのEffect不能・履歴確定・用途別受領がすべて成立した場合だけ現在操作を整理できる。作成結果不明、ID未確定、資源観測不能、現在も残る未解決の書込み影響は本条件で終了しない。限定unknown Create終了Classと新規開始の競合条件は変更しない。

再起動記録がない通常終了要約は`crdd-coordinator/operation-summary/v2`の本文を維持する。再起動記録がある場合は`crdd-coordinator/operation-summary/v3`で非秘密の既存`dockerRestart` checkpointを必須追加し、元のrequest・cleanup・blocked／completed・reason・Effect不明評価を別項目のまま残す。v3でnull・欠落・未終端を許可せず、v2へ同fieldを追加しない。両形は現在の「再起動なし／記録あり」の閉じた投影であり、旧再起動履歴を推測補完する互換Readerではない。履歴行は`crdd-coordinator/history-row/v2`を維持し、元の`execution`・一次失敗・Task結果を保持する。要約固定後の評価差はHash不一致として拒否し、旧結果ID・旧ACKを流用しない。既に固定・配送・出版した旧要約を同じIdentityで新版Hashへ結び直さない。旧ローカル履歴・途中状態の移行はフロントAIが参照・実資源・固定済み要約の有無を確認して行い、過去履歴を改変・削除して未解決を解消しない。今回の未終端試験物は要約・履歴未固定を確認した後だけ、新しい正式Writerで確定する。これは通常終了の契約であり、Task成功や過去Effect不存在を新たに保証する変更ではない。

終了履歴は保存済みの現在状態から導出し、呼出し側が任意の要約本文やPathを渡す入口を作らない。Orchestratorの仕事履歴とはOwner・操作Identity・失敗分類が異なるため、Coordinatorから上位の履歴Writerへ依存しない。共通化するのは既存のRoot観測・File Identity・保存primitiveであり、二つの履歴を統合しない。

| 履歴に保持する内容 | 導出元と条件 |
|---|---|
| 操作の相関 | 保存済み操作のID、exact回復ID、固定IdentityのHash。基本情報本文に含まれるPathを複製しない。 |
| 終了記録の時刻 | 最初に確定した終了要約のUTC時刻。同じ操作の再入場では既存時刻を維持し、再試行のたびに保持期限を延長しない。 |
| 一次失敗 | 保存済み`primaryFailure`の固定分類と観測状態。最終結果や清掃結果で上書きしない。 |
| 結果と清掃 | 保存済み`outcome`、Host清掃状態、Lease状態。清掃不明を成功へ変換しない。 |
| 要約の同一性 | 相関・一次失敗・結果・清掃の固定内容を照合する。同じ操作で内容が異なる履歴を上書きせず停止する。 |

途中の一次失敗と清掃不明は`state.primaryFailure`、現在の清掃評価と既存診断sinkへ保持し、履歴へ逐次Snapshot化しない。`prepareCoordinatorStateHistorySummary`の返却は現在の診断内容を非Authorityの値へ導出しただけであり、要約固定・履歴保存・操作除去の許可ではない。

`summarySha256`を固定し、終了履歴へ確定する時点は、Host・Lease・五purposeの終端、旧Ownerの新Effect不能と遅延Createの無害化を既存の実行・回収Ownerの根拠で確認した後とする。状態文字列、Hashや一時的な不存在だけで固定しない。これにより、清掃不明で固定した要約と後の清掃完了との矛盾を作らない。上位Consumer受理は要約本文へ含めないため、未受理でも最終要約の保存は可能だが、全受理まで操作・搬送参照を除去しない。履歴からAuthority、現在状態または失われた操作を復元しない。

本番終端接続では、次の根拠を同じ操作へ共同照合する。旧完了Capabilityの包み直し、集約された不存在記録、Contextの不存在だけでは代替しない。

| 根拠の所有者 | 接続する事実 | 現在の不足と予定処置 |
|---|---|---|
| Docker Effect Owner | 実cleanup返却と同じ管理Capability・回復Capability・計画Identity、五purposeの要求状態・exact予定名・既知ID・終端観測 | 旧absence記録は集約booleanだけを保存し、渡された五purpose観測を保持しない。実返却objectの相関を既存Owner内で保持し、Controllerの終端Contextから照合する。コピーJSONや呼出し側の成功booleanを真正結果としない。 |
| Host／Home Owner | 同じ操作・Root・nonceに結合した実Host清掃と実HomeLease解放 | 旧完了CapabilityはHost遷移・pointer除去・Lease解放の限定根拠として使い、Docker清掃やHost作業領域清掃の代替にしない。 |
| 既存Effect入口 | 同じAttemptの終了後の再要求拒否と、既発行要求の終端 | 現行Contextは清掃後に削除され、有効な管理Ownerから再作成できる。Context不存在を旧OwnerのEffect不能へ昇格せず、同じAttemptの終了を既存入口へ接続する。新しいLock Frameworkや回復DBを作らない。 |

旧record消費後も、上位受理・履歴保存に必要な非Authorityの終端根拠だけを既存の終端Contextへ保持する。別操作の真正結果、同操作の別計画、五purposeの欠測・重複・ID差、清掃後の再Create・遅延Create、Lease解放失敗、Host清掃不明を反例として確認する。模擬Runtimeの結果を本番根拠として受理しない。この接続は未実装であり、保存モデルの構造検査や局所成功で成立済みとは扱わない。

同じ計画の再要求拒否は、Effect Runtime内の管理Capabilityと計画Identityの相関へ接続した。正規Contextで清掃へ入る前に停止対象を固定し、清掃不明の場合も同じ計画の`startCommand`を拒否する。清掃後にContextを除去しても拒否を保持する。同じ管理領域の別計画は停止対象にしない。この再要求入口の拒否だけでは既発行の遅延Create終端や履歴固定の共同証明を代替しない。

実cleanup返却の相関はEffect Runtime内の私有WeakMapへ接続した。五purposeを評価して実清掃完了した返却objectだけを管理Capability・回復Capability・計画Identityへ結合し、同じ計画の停止保持も照合する。五purpose欠測、旧模擬集約結果、コピーJSON、別操作・別計画・別Runtimeの結果は返さない。`verifyRuntimeOwnedDockerCleanupOutcome`は本番Ownerの集合だけを使用する。本番Controllerはこの照合が成立した観測だけを終端処置へ渡し、不一致・例外ではMount完了と回復完了を開始しない。模擬Controllerの依存注入は局所試験用であり、本番入口の照合を省略しない。Host清掃・Lease解放、既発行要求の遅延終端、履歴Writerと現在状態除去への共同接続の全実境界確認は未完了である。

Controllerの元の完了結果へ、同じ管理Capability・操作ID・回復参照と照合済みの資源観測、実Mount完了・回復完了の結果を私有保持する。`borrowRuntimeOwnedDockerTerminalObservations`は本番Ownerの元結果と同じ相関だけから非Authorityの観測を返す。制御Contextは従来どおり完了時に除去し、終端借用で取消・実行を再開しない。公開結果へ資源一覧や管理Capabilityを追加せず、旧操作別FileのSchemaを拡張しない。本番Producerから現在状態Writerへの一体接続はSourceに存在する。全Producerの確認とHomeLease解放の共同照合・遅延要求終端の実境界確認は残る。

終端Writerの資源変更は、清掃前Contextに保持した管理Capability・操作ID・回復参照と元の本番Controller結果を照合する。更新排他内で元Snapshotから`prepareCoordinatorStateCleanupSnapshot`を導出し、その五purpose評価と候補の資源集合が一致した場合だけ保存へ進める。要求状態・既知IDの差替え、欠測・別名・観測不能の不存在化はモデルの既存検査で拒否し、根拠なし・コピー結果では資源差分を拒否する。Host清掃結果の照合、他操作変更・参照除去・履歴変更の拒否は維持する。この内部Writer接続を本番Producerの一体切替済みや実Docker清掃済みとは扱わない。

現在状態に保存する固定操作情報は`crdd-coordinator/operation-identity/v1`とする。旧`runtimeStateBinding`を保持せず、外側Snapshotと同じ検証済み`repositoryBinding`を必須とする。操作・世代・Provider・Grant・Profile、Provider Homeの結合・実体・保護、選択ユーザー、五用途の資源名とImage、操作／Mount種別、初期Host token・Snapshot・Pathおよび既存の相関参照は保持する。Repository HashでHomeやHostの保護証明を代替しない。旧Schema・旧項目の混入・別Repository結合は拒否し、恒久互換Readerを作らない。回復IDの三Hash書式は維持し、第三Hashは新Identityの固定本文から導出する。旧IDを新Identityへ付け替えない。上位の受理契約と本番Producerは同じ切替対象であり、モデルの変更だけで移行済みとはしない。

本番切替は次の旧保存責務を同時に置き換える。新Writerの直接試験だけで移行済みとは扱わず、旧保存へ戻るfallbackと恒久的な二重書込みを作らない。

| 処理境界 | 現行本番の保存 | 新現在状態での対応と切替条件 |
|---|---|---|
| 開始Identity | pending base、base commit、operation Directory、active lease pointer、Host active binding | `saveRuntimeOwnedCoordinatorOperationStart`で同じ操作を確定する。新品領域の独立作成証明を維持し、保存・読戻し・排他解放が未確認ならDocker要求へ進まない。 |
| Host開始 | host-begin intent／receipt | `host.pendingTransitionJson`と`host.currentToken`へ同じ遷移を保存する。要求前・後の記録順を保つ。 |
| 資源要求 | submission-purpose File | 五用途の`resources.request`へ要求前のintentを保存し、要求発行・結果不明を区別する。 |
| 作成応答 | receipt-purpose File | 同じ用途のIDと応答取得根拠を保存する。要求記録がない応答・異なるIDは拒否する。 |
| Docker清掃 | docker-absence Fileの集約true | 元の清掃結果に結合した五用途の観測を保存する。集約trueや未要求を実不存在へ読み替えない。 |
| Mount／Home Lease終了 | mount completion、Host complete intent／receipt、lease release receipt | 実完了と同じ操作の解放観測へ結合する。現在状態名だけを完了証明にしない。 |
| Host清掃後 | host cleanup intent／receipt、operation Directory除去 | 清掃前の同じ終端Contextと元の実清掃結果を使い、Host閉鎖・履歴・利用側受理を順に確認する。 |
| 最終終了 | normal run completion、completed／acknowledged receipt | 登録された利用側の受理と同じ履歴行の保存を確認し、対象操作とその回復・搬送参照だけを除く。過去作成unknownをsuccessへ書き換えない。 |

結果公開前に固定結果IDと、その利用形態で必要な耐久搬送先を登録する。`registerRuntimeOwnedCoordinatorSettlementResultDeliveries`は同じ操作Owner・回復参照・真正Host清掃・Controller終端へ登録を結合し、既存Writerの元版照合・読戻し・排他解放を確認する。結果IDは固定操作終端要約から導出し、任意の結果IDは受け付けない。必要集合は保存Identityから導出し、Orchestratorの空集合、重複、未知の搬送先、受理Hashの持込みと登録済み集合の差替えは拒否する。CLI／Workbenchは耐久搬送先を持たず、ACKを生成しない。既存の回復義務は保持し、耐久搬送先は未受理から開始する。通常の参照更新と汎用Writerでは搬送集合・受理状態を変更できない。登録集合が空であることを全受理と扱わず、同じ操作の搬送先は同じ結果IDへ結合する。結果IDを現在Snapshot全体のHashやFile Identityから導出せず、他操作更新で結果の同一性が変わらないようにする。`readRuntimeOwnedCoordinatorSettlementResult`は登録済み耐久搬送先のRepository結合・操作・回復参照・結果ID・Consumerだけを返し、排他解放不明の値は搬送しない。上位Ownerの保存成功後に現在状態を再読取りし、同じRepository・Task・Attempt・操作・回復参照・結果の保存受理を確認してから、対象Consumerの受理を反映する。任意の受理Hash代入だけを受理根拠にしない。登録・取得入口の実保存確認と、本番結果Producerの公開前接続・上位の耐久受理接続は別に判定する。

旧completed／acknowledged Fileの二段GC、AppData Rootの保護結合、Receipt inode、commit companion、tombstone容量管理は新方式へ再実装しない。保持するのは上位耐久受理と読戻し、全搬送受理・履歴・実終端後の対象除去、次Attemptへ進む順序である。除去後に応答が失われた場合も、上位Ownerの保存済みexact結果と同じAttemptをfresh確認できる場合に限り追加Effectなしの再確認を扱う。単なる対象欠落を資源不存在や処理成功へ変換せず、旧IDの再実行や履歴からのAuthority復元を禁止する。再起動後の確認は保存Ownerの既存Readerを使い、WeakMapだけを耐久受理根拠にしない。

開始保存の入口は現在の本番Recovery OwnerからSource上で接続している。全Producerと実資源・Hostの一体実証は未完了である。有効な同じ操作IdentityをReader前に検証して非Authorityの回復参照を固定し、読取り不明・重複・初期化失敗でも同じ参照を保持する。Readerの排他解放が未確認なら初期化・Writerへ進まず、元の本文と回復参照を保持する。初期化の領域作成EffectはWriterのEffectとORして返すが、保存確認・排他解放をORしない。これはHome Lease取得、Docker要求Authority、Host遷移または本番切替の完了証明ではない。

`prepareRuntimeOwnedRepositoryDockerOperationIdentity`は本番の固定計画と同じ操作Ownerから、現在Repository結合および実Host token・固定記録・Pathを取得して新Identityを組み立てる。固定組立てが渡す必須の`consumer`もIdentity本文へ含め、受領方式自体は保存せず固定対応から導出する。Hostは`borrowOwnedHostRecoverySnapshot`で同じ管理Capabilityが保持する実体から読み取り、読取り前後に記録Hash・実体Identity・現在状態を検査する。tokenからOS一時Rootを逆算せず、任意Pathも受け付けない。AppData RuntimeStateの観測を使用せず、別操作・不正世代・観測不能は拒否する。組立て後のRepository再確認と新モデル検査を通した本文だけを開始Writerへ渡す。この関数は保存、Home Lease取得、Docker要求を発行せず、Homeの実観測・Lease照合は一体切替する開始Ownerの責務として保持する。現在の本番開始Ownerはこの関数へ接続しているが、関数の局所確認だけで全Producerの実境界成立とは扱わない。

2026-10-08の受領方式採用に伴い、本番未採用Draftの`operation-identity/v1`へ必須`consumer`を追加する。同じ識別子のDraftを最新形態だけへ更新し、欠落版の自動補完・互換Readerは設けない。過去固定試験の結果を新版の根拠へ流用しない。新しい固定本文からIdentity Hash・exact回復ID・結果要約を導出し、旧記録や旧IDは付け替えない。保存済みIdentityは更新不能であり、Consumer変更後にHashと回復IDを再計算しても同じ操作の更新として拒否する。Settlement Contextの利用側は保存Identityの`consumer`と一致しなければならない。旧形式入りstate／pendingは新品として初期化せず保全停止する。これは本番組立ての切替や配送・完了の成立証明ではない。

結果登録の必要集合も保存Identityから導出する。Orchestratorは厳密に`[orchestrator]`、CLI／Workbenchは厳密に空集合とし、登録入力の欠落、別Consumer、重複、余分な値を補完しない。現在状態の`pendingDeliveries`は`orchestrator`だけを許可し、対応操作の保存Consumerとの一致を要求する。CLI／Workbenchの空集合は真正終端・固定要約の確認後に元Snapshotを返すだけで、改訂増加・ACK・新しい配送待ちを生成しない。この段階では一時返却の実接続・終了確認をまだ持たず、空集合を完了の証明にしない。以前の全Consumer耐久登録の試験正例は新版へ流用せず、他Consumer混入はモデル／decoderで拒否する。

同じProcessで所有しているHostの開始・完了遷移も、管理Capabilityから確認したRoot・記録を使用する。tokenはそのOwnerのRoot名・nonce・現在Hash・世代に一致するかを検査するために用い、保存先の逆算や新しいRoot Authorityには使用しない。未発行Owner、別操作、古いtokenは遷移前に拒否する。この所有中の遷移経路と、別Processでの回復観測・現在状態Writerへの意図／結果保存接続は別に判定する。

`beginRuntimeOwnedCoordinatorHostSubmission`は開始Identityを確認し、実Host記録から導いた開始予定をstate.jsonへ保存・読戻し・排他解放した後だけ、所有中Hostを開始状態へ遷移させる。実tokenと予定tokenの一致を再観測してから、現在tokenを更新し予定を解消する。予定保存後の開始前失敗では同じ予定・回復参照を保持する。開始後の応答喪失では実Hostが予定の後継tokenであることを再確認し、Host開始を再発行せず結果保存へ進む。実Ownerの記録を確認できない場合は推測で予定を解消しない。Host開始要求と確認・Snapshot確認を区別し、途中の失敗をEffect 0または成功へ丸めない。この内部接続の実試験は、本番Home Lease取得・Docker要求・Provider Taskの一体切替の完了証明ではない。

要約内容Hashと時刻込みの履歴行の同一性は区別する。history確定後にstate更新が失敗した場合や、未受理のまま保持期限を越えた場合も、同じ時刻と保存確認を再照合できなければならない。既存行の不存在を未保存と決めて再追加せず、期限外の入力を黙って捨てた結果を保存読戻し成功にしない。現在状態には未終了操作が残る間だけ、次の最小相関を保持する。別File、履歴DB、診断Identityは追加しない。

| 現在操作の項目 | 固定内容と遷移 |
|---|---|
| `summarySha256` | 要約内容のHash。`history`と両方nullまたは両方非nullとし、一度固定した内容を変更しない。 |
| `history.occurredAt` | 最初の正規UTC時刻。再試行時刻へ変更しない。 |
| `history.lineSha256` | 固定要約と最初の時刻、末尾LFを含むexact履歴行Hash。確認状態を行本文へ含めない。 |
| `history.confirmed` | 初回はfalse。exact行の保存・読戻し後だけtrueとし、巻戻さない。trueの操作は期限後も履歴へ再追加しない。 |

`prepareCoordinatorStateHistorySnapshot`は構造・時刻・両Hash・単調遷移の候補生成だけを所有する。通常lifecycleの六項目から要約Hashだけを固定することは拒否する。一般の物理Writerはhistoryの変更を拒否し、内部の`writeRuntimeOwnedCoordinatorHistoryCheckpoint`だけが、元Host結果と元Controller結果の共同照合後に対象一件の未確認要約を固定する。初回時刻はこの入口で生成し、再試行では固定済み時刻を維持する。更新排他内で元状態から候補を再導出し、差分がなくても真正五観測のpurpose・予定名・ID・要求状態・終端を照合する。ID不明・観測不明は固定せず、初回true、他操作・参照の変更も許可しない。このcheckpointを履歴行の保存・読戻しや操作除去の成立へ昇格しない。

履歴公開後、確認checkpointを保存する前の中断では、確認前の行を通常整理で失わない順序が必要である。`publishRuntimeOwnedCoordinatorHistory`は固定済みの要約だけを同じWriterへ渡し、履歴の全行検査・期間整理・保存・exact読戻し後にtrueのSnapshotを確定する。初回追加根拠とpending全体結合は同じ管理Owner・回復参照の私有集合へ保持し、別Contextからの再入場でも再発行しない。一般Readerがpendingを拒否する場合は元Ownerが保持する固定候補だけを更新排他内で再照合する。根拠喪失時は操作を保持し、時刻更新・確認更新・履歴再追加をしない。既確認の同じSnapshotは更新排他内でも識別し、期限後の履歴行を要求・再追加せず、必要なpending／marker終了だけを行う。これは既確認の受理であり新しい履歴保存成功ではない。旧履歴から状態を復元する互換処理や新しい回復Frameworkを追加しない。履歴Writerは現在の本番Producerへ接続している。物理正常保存・中断反例を全Producerで通す統合実証は未完了である。

履歴更新では通常のSnapshotと同じ短期排他を使用する。終端Contextで元状態を読み、読取り排他を解放した後、更新排他内で元版と実体を再照合する。排他中に共用Readerを再呼出しして同じLockを二重取得しない。`history.pending.jsonl`のflush・置換・exact読戻しを完了し、排他解放結果も別に返す。未確認→trueでは既存exact行を再利用する場合も、同じ履歴descriptorのIdentity照合・fsync・close・全行再読戻しを省略しない。保存・close・最終再照合が不明なら確認trueを成功表示しない。既存pendingの別本文上書き、未知Fileの回収、新しいLock Frameworkは追加しない。

保持期間はCoordinator専用設定で評価し、既定30日とする。`decodeCoordinatorHistoryRows`が全行の正規encoding、UTC時刻、Schema、要約・操作相関、重複を検証し、`prepareCoordinatorHistoryRetention`が同じSnapshotと固定判定時刻・日数から整理候補を生成する。期限境界ちょうどの行は保持し、期限を越えた行だけを対象にする。未確認の行は期間外でも保持し、欠落・Hash不一致では候補を返さない。確認済みの行が既にない場合は再追加しない。このモデルは既存Writerへ接続したが、候補生成だけから物理保存・読戻し・操作除去の成立を主張せず、正常物理保存の肯定試験は未完了である。破損・部分行・重複・観測不能を期限切れへ丸めない。読取り容量限界は停止条件であり、件数や総容量による黙示削除を加えない。通常履歴の期限から未解決操作・搬送・Candidateを消さず、設定変更で過去の削除根拠を再解釈しない。

履歴の初回追加可否は、同じ更新排他内で実際に`history:null`から未確認値へ初回固定し、保存読戻しと排他解放が成功した事実に限定する。既存falseの再保存では再発行せず、同じ操作の別Contextにも共有する既存Owner内の短命な事実とする。最初の履歴I/O試行前に消費し、書込み失敗を未発行へ戻さない。中断後のpendingは対象行だけでなく元履歴全体・元File実体・候補全体・固定判定時刻・設定とstate候補に結合し、他の行を失った本文を公開しない。結合を再構成できない場合は自動公開せず停止する。この接続はSourceへ実装した。Docker終端観測だけを試験worker内で模擬し、実Host清掃・Filesystem・OS排他を使う局所試験では、履歴保存、fsync失敗、pending本文破損、履歴公開後state保存失敗、別Context再入場、二重追加防止と整理済み確認行の非再生成を観測した。本番の真正Docker終端や本番Producerの接続、完成独立レビューPassを表さない。

現在状態からの対象除去は、五資源とHostの終端、Lease解放、同じ資源回復義務の解決、利用形態別の必要受領条件、同じ終了要約の保存読戻しを照合した場合だけ許可する。履歴の書込み成功だけでは除去しない。`prepareCoordinatorStateCompletionSnapshot`は、非実行・清掃確認・Host pendingなし・Lease解放・Owner Effect無効・現在資源と回収義務の終端確認・履歴確認を共通条件とし、保存Identityの利用側から終了方式を導出する。Orchestratorは空でない耐久搬送と固定結果に結合した受理Hashを要求し、CLI／Workbenchは対象pending無しを要求する。wrapperと更新排他内Writerは保存Identityと固定Contextの利用側一致を確認し、耐久方式だけ固定上位Readerのfresh ACKを再照合する。一時返却にReaderを接続せず、保存後の再入場でも保持した元版・候補相関と同じ利用側の確認を省略しない。一般の遷移検査と通常物理Writerの除去拒否は維持する。保存失敗、元版競合、別操作の真正結果、必要ACK不一致、観測不能では対象を保持する。終了整理の成功は画面への返却成功の証明ではなく、応答喪失からProvider Effectを再発行しない。Filesystem局所試験はDocker終端の模擬境界であり、本番Producerと全利用形態の終了整理について、Source接続を越える一体実証は未完了である。

内部の`completeRuntimeOwnedCoordinatorSettlement`だけが、共用物理Writerの更新排他内で固定元本文から終了候補を再導出し、元Host清掃結果・同じController終端・Lease・五資源・利用形態別の受領条件・履歴相関と同時照合する。内部処理は固定三用途に対応し、Orchestratorは固定上位Readerの耐久受理、CLI／Workbenchは耐久pending・Reader無しを確認する。本番ProducerへのSource接続と全利用形態の一体実証を分け、内部接続だけを全利用形態の完成状態としない。通常履歴に固定行が存在する場合はexact一致を確認し、明示的不存在なら既確認の履歴相関を保持して再追加しない。不正本文や未知I/Oは拒否する。

同Processの処置発行後は、同Contextが確認した元本文とexact終了候補だけを私有メモリへ保持する。再入場では現在本文が元版または同じ保存済み候補であること、pendingが同じ候補であることを確認する。耐久方式ではfresh上位受理を確認し、全方式で真正終端・履歴相関と保存Identity／Contextの利用側一致を毎回確認する。出版後の応答喪失でも対象不存在だけから成功とせず、別Contextや根拠なし再入場は拒否する。保存確認と排他解放の両成功を完了条件とし、この経路をfresh Processの再入場や実Consumer全接続の証明としない。

Orchestratorの受理に含む`operationId`は上位Task／Attemptの論理操作IDであり、Coordinatorの実行操作IDとは区別する。結果参照の投影と受理照合は、保存Identityの`recoveryCorrelationId`が存在する場合にはその値だけを使用し、存在しない独立操作では保存済み実行操作IDを使用する。どちらかのIDが一致すればよいという判定や、上位入力による欠落値の補完は行わない。Host、Controller、保存Owner、終了要約は実行操作IDを維持する。

#### 更新・中断後の再入場

下位整理の出版後に上位確定が中断した場合は、`observeRuntimeOwnedCoordinatorCompletedDelivery`が現在の配送残件不存在だけを観測する。固定上位Readerの十一項目ACK、現在Repository結合、対象回復ID／nonceを持つ操作・回復・配送参照の不存在、同じ回復IDと結果Hashの終端履歴を既存の短期排他内で共同確認する。履歴Decoderは終端・Host清掃・Lease解放・旧Owner無効を確認し、物理Readerは状態・履歴の安定Identityと排他解放を確認する。保存途中、履歴欠測・破損、対象残存、上位ACK不一致または観測変更では停止する。本文更新・Task再実行・旧Capability復元を行わず、結果は配送残件不存在だけであり、実資源清掃・過去のProducer ACK保存・Task成功の新しい証明ではない。履歴保持期限後の相関欠測は未解決の残件とする。

保存済み終端の終了処理は、真正な`recovered` Contextから固定元版・候補・処置種別を私有Writer optionへ渡す。受理処置は対象配送のACK Hashだけ、整理処置は対象操作と対応する回復・配送参照の除去だけを許す。更新Lock内で現在本文が固定元版または自分の候補に完全一致し、同じモデルの候補再導出、現在Root再確認、固定上位Readerのfresh読戻し、固定履歴Hash・存在する行の相関・pending履歴なしを確認する。履歴保持期間で回収済みの行は再追加しない。受理保存の`completed / snapshotConfirmed / lockReleased`が揃った候補だけを整理の元版とする。保存後応答不明・解放不明・整理失敗では元版と候補を保持し、同Contextの再入場でもReaderと履歴の確認を省略しない。除去後の新Contextは作成できず、対象欠落だけで成功しない。元実行Owner用の真正Host・Controller条件を変更せず、保存値をその代用品にしない。新Processでの保存途中再構成は次段落の終了限定入口へ接続し、残存実資源回収とは区別する。

保存済み終端配送の結合は`prepareRuntimeOwnedCoordinatorRecoveredSettlement`で準備する。現在Rootの真正な結合、exact回復参照、登録済み`orchestrator`結果、固定要約および履歴確認済みを照合し、五資源・Host・Lease・旧Ownerの終端条件を満たす場合だけ既存の私有Context集合へ保持する。実行操作IDは保存対象の相関値として保持するだけで、管理Capability・清掃結果・Controller観測を復元しない。元Owner用の全入口は`live`種別だけを受理し、保存済み終端用の`recovered`種別とコピーを拒否する。保存途中の候補がない場合、準備時はReaderを呼び出さない。保存途中の場合だけ同じRoot・排他内で固定Readerを読み、同じ受理候補または受理済み現在版からの同じ整理候補へ完全一致する候補を既存Writerへ結合する。Reader不明・別候補・観測中変更では保全停止し、通常Readerの保存途中拒否は維持する。準備では状態・履歴の本文を変更しない。上位ACKの保存・操作整理は終了限定Writerへ接続済みであり、局所検証対象とする。本番上位の受領・終了二経路は接続済みだが、保存途中の共同接続と整理後の上位確定中断の確認は未完了である。更新時は固定Readerのfresh読戻し、元版または自分の候補との完全一致、同じモデルでの候補再導出、既存履歴相関および他操作不変を要求する。保存途中からの新Process再入場は局所検証対象であり、実資源回収・整理後の上位確定中断・保持期限後の再開をこの結合だけで完成扱いしない。

新Processの結果参照読取りは`readRuntimeOwnedCoordinatorRecoveryResult`が所有する。明示選択して検証済みの現在Rootから通常と同じSnapshot Reader・短期排他を使用し、exact回復参照と`orchestrator`固定Consumerを照合する。同Processの結果Readerと登録済み搬送先・固定要約・必要集合の投影検査を共有し、元bytesと同一の検査結果だけを五項目参照へ投影する。未登録、非終端、未確定資源要求、要約・集合不一致、保存途中、Root変更または読取り・排他解放不明では値を返さない。元操作Capabilityや真正清掃結果を保存値から復元せず、履歴出版未確認や受理済み参照の読取りは既存契約を維持する。この入口は結果参照だけであり、fresh ProcessのACK受理・操作整理・実資源回復の成立を意味しない。保存本文を更新しないが、短命Lockの取得・解放をFilesystem Effectとして区別する。

Provider開始要求の直前には、同じControllerが元操作・回復参照へ結合した短命通知を同期保存中だけ保持する。既存Ownerは元通知を照合して六fieldのlifecycle checkpointを保存し、開始前の`providerStart / externalSend / sharedWrite`を`unknown`へ進める。既知評価は巻き戻さず、他のlifecycle値を保持する。保存確定と排他解放のいずれかが未確認ならProvider要求を発行しない。保存後の同期再入取消でも要求を停止し、保存済みunknownを未発行へ戻さない。認証Probe・Create・Network準備にはこの通知を発火せず、資源要求前取消の未発行通知と用途を混同しない。OSのDocker CLI開始、正常出力、清掃成功はProvider実開始・外部送信・共有書込み成立の根拠ではなく、評価を既知化しない。要約固定後・終端・偽通知・別操作・失効通知は保存前に拒否する。新しい共有State、Registry、LockやProvider内部観測機構は追加しない。

Coordinatorは既存の短期排他と保存primitiveを利用し、Snapshotごとに新しいLockやJournalを増やさない。単一WriterはI/O直前にRepository結合、操作Owner、期待revisionを再確認する。長いProvider実行中や人間判断待ちに保存用Lockを保持し続けない。

通常操作の保存先は、Repository Operation Ownerが検証済みのRoot・論理Identity・実体Identityを内部借用Portへ返し、保存境界で同じOwnerと結合を再検証する。公開検証結果へPathを追加せず、借用自体を書込み・削除・回復Authorityとして扱わない。この通常操作Portは発行revisionも確認するため、旧Attemptの回収入口へそのまま転用しない。再入場・回収では明示選択した現在Repositoryの実体と保存済み結合を照合する入口が別途必要である。

Host清掃後の最終保存には、通常の操作Ownerを延命して使用しない。清掃前に既存Repository結合とexact操作・回復参照を保持中の実行Contextへ固定し、清掃後は同じRepositoryの終端更新だけに使用する。Docker終端recordの破棄後も結果受理まで保持できる寿命とし、Provider起動・資源要求・別操作への書込みを許可しない。清掃不明の場合も同じ参照で記録できる必要があり、清掃成功時だけ保存経路を作る設計にはしない。

終端保存は、Host清掃結果の真正性だけでなく操作・Root・nonceとの一致を確認する。一般のSnapshot遷移で操作・回復・搬送参照の削除を許可せず、五purposeの終端、Host清掃、回復義務解決、上位の耐久受理読戻し、終了要約の保存読戻しが共同成立した対象だけを整理する。元の失敗と清掃確認は別に保持する。

操作終端の結果IDは、固定操作要約（再起動なしv2、記録ありv3）を正規JSON・UTF-8・末尾LFで符号化したSHA-256とする。操作・回復参照、固定Identity、一次失敗、実行評価、終端結果、Host清掃、Lease状態と、v3では同じ再起動checkpointを含み、履歴時刻、Snapshot改訂番号、File Identityを含めない。これは下位操作の終端結果であり、AI候補の採用やTask全体の成功を表さない。真正なHost清掃結果と同じController終端結果を照合し、更新排他内で同じ要約と搬送先集合を再導出して未受理として登録する。同じ登録の再入場では結果ID・必要集合・受理状態を変更しない。state.jsonの更新が不要でも、短命state.lockの作成・回収をFilesystem操作として報告する。利用形態別の必要集合、上位耐久受理と本番一体切替は別に接続・確認する。

Orchestratorの耐久受理は、既存のRepository・Project・Milestone・Task・Attempt・操作・回復参照と最初の受理世代を保持し、新Repository結合・固定結果ID・`consumer: orchestrator`へ結合する。受理本文の閉集合は`repositoryBindingId / projectId / milestoneId / taskId / attemptId / operationId / recoveryId / settlementGeneration / repositoryBinding / resultId / consumer`とし、正規JSON・UTF-8・末尾LFのSHA-256を下位の受理Hashとする。Hash自身、現在state全体、時刻、一時File Identity、再試行回数を本文へ追加しない。再入場で最初の受理世代を書き換えない。

上位Writerの保存・排他解放後、既存の本番Readerで同じTask・Attempt・操作・回復義務と保存済み受理本文を再確認する。同じReaderへ固定した内部接続をCoordinator更新排他内でも再確認し、対象一搬送の未受理から同じ受理Hashへの変更だけを許可する。任意callbackや任意Hashを外部入力で受け付けず、Coordinatorから上位型・実装をimportしない。上位保存Lockを保持したまま下位更新へ入らない。読み戻し不能、解放不明、別結果・対象・世代競合は受理未反映とし、同じ回復参照を保持する。終了候補は空でない全搬送の受理に加え、全結果IDと固定終端要約IDの一致を確認する。受理だけから資源不存在や操作除去成立を推定しない。この上位受理の具体契約は切替設計であり、旧ACK・Receiptの本番利用側を残したまま新型だけを有効化しない。

`prepareRuntimeOwnedCoordinatorSettlement`は清掃前に既存Repository結合・保存済みexact参照・Host清掃結果照合を固定し、`writeRuntimeOwnedCoordinatorSettlement`は通常保存と同じ私有I/O本体へ接続する。通常Ownerの失効条件は変更しない。終端借用は現在の論理・実体Identityを確認し、旧発行revisionから操作Authorityを復元しない。`readRuntimeOwnedCoordinatorSettlementSnapshot`は同じ内部Contextから通常Readerの固定Root・File・短期排他経路を共有し、同じ操作の保存済みexact参照を読み戻す。対象欠落、偽Context、Repository観測失敗、保存途中では値を返さず保存物を保全する。この読取りは起動・回収Authorityを作らない。新操作・資源要求・他操作変更・未証明除去を拒否し、Host確認からDocker資源終端や全cleanupを推定しない。実Filesystemの清掃後保存接続は局所試験済みだが、旧保存経路は撤去済みである。現在Producerの受理・履歴・除去とfresh再入場を含む全利用側・実境界の一体確認は未完了である。

Orchestratorの`createProjectResultAcceptanceReader`は、本番組立ての固定八項目から同期Readerを作る。読取り先は既存上位現在状態Readerであり、保存確認と排他解放の成功を含む`completed`だけを利用する。同じProject・Milestone・Task・Attempt・操作・Docker回復義務の保存済み十一項目を返し、現在世代が進んでも初回受理世代を再生成しない。別対象・旧形式・読取り失敗ではnullを返す。新Repository結合・固定結果IDの下位実対象との一致はCoordinatorの候補再導出が確認する。この内部Readerは現在の保存decoder・本番ProducerのACKへSource上で接続している。全Producerと実保存・fresh再入場を含む実境界の一体確認は未完了である。

上位受理の専用保存は`acceptRuntimeOwnedCoordinatorProjectResult`が所有する。同期上位Readerは本番組立て時に既存終端Contextへ固定し、後から差し替えず、CLI・Request・JSONの入力にはしない。通常の値導出後、共用Writerの更新排他内でも同じReaderを呼び、正規受理本文から導出したexact候補だけを保存する。上位の読取り失敗・例外・非同期値・受理変更では元状態を維持する。保存処置発行後の失敗では、同Contextが発行した候補だけを私有メモリへ保持し、同じpending・元版・fresh上位受理を共用Writerで再照合して終了する。私有候補は保存完了後に破棄し、永続履歴や別の回復Fileへしない。この同Process経路をfresh Processの再入場、実上位Readerの接続または両Fileの同時transactionの成立証明へ拡張しない。

同Processでは、清掃前に取得した元のContextへ、Orchestrator本番組立てが保持する同期Readerを`bindRuntimeOwnedCoordinatorProjectAcceptanceReader`で一度だけ結合できる。同じexact回復参照・耐久Consumerと私有Contextを照合し、同じ関数の再入場だけを許可する。別関数への差替え、一時返却Consumer、偽Contextと別参照は拒否する。結合処理はReaderを実行せず、ACK受理・資源不存在・操作除去を証明しない。清掃後に操作CapabilityやContextを再生成せず、保存済みACKのfresh照合と元の真正終端結果による終了は既存処理へ委譲する。この内部接続の追加だけでは本番Orchestrator一体接続やfresh Process回復を完了としない。

本番Docker終了Ownerは、同じProcessで保持した`orchestrator`の元Contextから固定五項目の結果参照をfresh取得する。過去の返却値だけを再使用せず、保存読取りと排他解放の成功を要求する。保存Ownerからの固定Readerを一度結合し、元Host清掃結果・元Controller結果で受理保存と操作整理を順に実行する。受理保存の`completed / snapshotConfirmed / lockReleased`がすべて成立した元結果だけを既存Owner内に保持し、整理の再入場では受理保存を再発行せず、既存整理処理の元版・候補・fresh ACK照合を毎回行う。完了結果のキャッシュから成功を返さない。新しい台帳・Lock・共有状態は設けず、同Processの元Owner寿命に限定する。CLI／Workbenchの一時返却経路、元結果、一次失敗、実資源の回収条件は変更しない。上位TaskはACK後に旧finalizeを二重発行せず、この終了経路へ一意に接続する。本番Task／OrchestratorへのSource接続と、全利用側・fresh Process回復を通す実境界確認は分け、後者を未完了項目として保持する。

Taskの本番Runtimeは、実行中の真正な`orchestrator` Controlから同Process限定の結果配送閉包を捕捉できる。Task完了時のControl削除は維持し、完了後の再捕捉、CLI／Workbenchへの提供を拒否する。捕捉済み閉包の各利用時に、Host清掃・旧操作なし・終端状態・全handoff終了と、元終了capability／回復IDの一意な対応を再確認する。結果集合は全件のfresh読取り・排他解放・利用形態・回復ID一致を確認した後だけ返し、対象0件や部分成功を耐久配送成立にしない。上位は集合を保存してから各結果をACKで終了し、部分終了後の再入場でも保存済み参照と同じ閉包を使う。新しい台帳・Registry・Lockを作らず、IDから元Ownerを生成しない。このTask内接続は局所確認対象であり、Orchestratorの実保存との一体接続と新Process回復を通す全利用側の実境界確認は未完了である。

Snapshot排他は既存のWindows名前付きPipe primitiveを用い、検証済みRepository Root HashをCoordinator専用namespaceへ結合する。同じRootのWriterだけを競合させ、Orchestratorの排他とは分離する。排他取得だけでRoot・File Identityの検証を省略しない。長時間の外部I/OやNative処置をSnapshot排他内で待機しない。

取得順は、実行側のHost／Home／Runtime所有権を確定した後、必要な一更新だけSnapshot排他を取得し、保存・読戻し・排他解放を完了してから外部要求へ戻る順とする。Snapshot排他を保持して新たなHost／Home／Runtime排他を取得せず、Provider完了、通知ハンドラー、上位保存、Docker応答または人間操作を待たない。現在状態の読取りから外部回収を始める場合も、短期読取りを終えて排他を解放し、実行側の所有権と現在資源を確認してから新しい短期更新で元revisionを再照合する。間に別更新が成立した場合は最新の実体を再評価し、古い保存候補を盲目的に再試行しない。

| 本番で保存する時点 | 保存Ownerと内容 | 保存後の処置・失敗時 |
|---|---|---|
| 操作受付後、最初の外部要求前 | Coordinatorが固定Identityと予定資源、Owner世代を保存する。初回だけ領域初期化証拠へ結合する。 | 保存未確認なら要求発行0。受付通知だけから実行中にしない。 |
| 各資源要求の直前 | 同じ操作の資源purposeと要求前checkpointを保存する。 | 保存確定・現在Authorityの再確認後だけ発行する。意図の保存を要求受理へ変更しない。 |
| 要求結果・資源ID・開始／終了の観測後 | 同じ操作の観測とcheckpointを更新する。一次失敗を維持する。 | 保存失敗でも既発行のEffectを未発行へ戻さず、同じ回復参照を保持する。 |
| 取消・清掃の処置前後 | 新Effectを止め、同じ操作へ取消、各資源の終端または観測不能を記録する。 | 保存失敗を清掃不要にせず、安全に所有する実資源の停止・回収と記録未確定を別に扱う。 |
| 結果の公開前とConsumer受理後 | Coordinatorが結果Identityと未受理搬送を保存し、上位の耐久受理後に同じ結果のackを保存する。 | 応答喪失では同じ結果を再照合する。Provider再実行・上位採用を自動発行しない。 |
| 終了要約の保存・読戻し後 | 全資源終端、回復解決、全結果受理を確認した操作だけを除去する。 | history保存不明、未受理、清掃不明ならstateへ保持する。通常履歴整理を解除証明にしない。 |

本番Writerは既存`writeRuntimeOwnedCoordinatorStateSnapshot`と`prepareRuntimeOwnedCoordinatorStateInitialization`の意味を保持して接続する。`snapshotConfirmed`、`lockReleased`、`filesystemEffectIssued`を分けて受理し、保存確認だけで解放成功やEffect未発行を推定しない。通常操作用の借用入口とfresh Process回収用の現在Root検証はCoordinator内部に閉じる。後者は明示選択した検証済みRoot、保存済みRepository結合、exact操作／回復参照、現在所有権・資源を照合し、旧ProcessのCapabilityを復元しない。初回中断もpendingのexact bytesと領域Identityを確認できる場合に限って同じ初期化を確定し、空Directoryや履歴から初回Authorityを作らない。これらの本番接続とfresh Process試験は段階5〜7の実装・検証対象である。

資源作成Receiptの保存中断は、同じTaskのexact回復参照に限定して通常doctorから再入場する。通常Readerのpending拒否は維持する。専用Readerはcurrent／pendingの正規全bytes・Repository結合・前版Hash・同じ操作Identityを照合し、`intent_saved → identified`かつ`docker_create_result`の一資源だけを既存Snapshot生成から完全再導出する。他操作、Owner、Authority、結果、履歴、配送が変わる候補は拒否する。既にcurrentとpendingが同本文なら値は再適用せず短命物だけを回収する。fresh回収Ownerが既存Host世代・Home・Runtime排他を取得して元OwnerのEffect不能を確認した後、同じpairを既存Writerへ渡し、保存・読戻し・pending／marker除去と解放を別々に確認する。候補の読取りやID保存を資源の現在存在・清掃完了にしない。別回復IDのpendingを代わりに出版せず、create要求・Task・Providerを再発行しない。この接続の局所・実境界成立は変更計画で追跡し、Source追加だけを全体完成としない。

既に解放済みのTaskは、旧OwnerのEffect不能、Workspace再利用不可、五資源すべてのID確定・現在不存在、Host遷移なし、未解決再起動なしが記録上成立する場合だけ、Host清掃が`not_requested`でも既存のRoot／marker不存在観測へ進める。同じRoot・token結合を確認し、fresh回収Ownerが既存排他を保持した状態でRootとmarkerの両方の明示不存在を再確認する。片側不存在・観測不能・再出現は拒否する。不存在を確認した場合は既存host checkpointの`pending`を保存・読戻しし、その後に既存の清掃確定Writerを使う。このpendingは現在の確認処理の進行を表し、過去の物理削除要求を発行済みへ変更しない。別操作の回収成功だけで対象の終了を推定せず、新しい削除、再起動、共有状態または回復Frameworkを追加しない。

| 順序 | 処置 | 失敗時の扱い |
|---|---|---|
| 1 | 保存用排他を取得し、現在Root・元revision・Ownerを確認する。 | 不一致・観測不能では書込みと次Effectを発行しない。 |
| 2 | `previous`へ元revisionと元bytes Hashを含めた次Snapshotのexact bytesを`state.pending.json`へ保存し、flush・read-backする。 | 中断残存を新しいpayloadで上書きしない。 |
| 3 | 同一Directory内で`state.json`へ置換し、正確な完成payload・Root Identity・pending不存在を再確認する。 | 公開後観測失敗を未実行へ巻き戻さず、同じ操作／回復参照を保持して再入場する。 |
| 4 | 保存確定後にだけ、記録へ結合した次の外部Effectまたは結果搬送へ進む。 | 記録の存在だけではAuthorityを発行せず、現在の実資源・許可も再確認する。 |

残存pendingの処置は、元版／次版と正確な内容を比較する。

| 現在の正規Snapshot | pendingとの関係 | 再入場 |
|---|---|---|
| 期待する元revision・元内容 | 次revisionとpayloadが正しい。 | 同じ保存を確定する。別Effectや新Attemptは発行しない。 |
| 次revision・exact payload一致 | 既に同じ更新が成立している。 | 更新の再発行0で短命物を回収する。 |
| 同revision別payload、別世代、参照不正、観測不能 | 更新の同一性を確認できない。 | 上書き0で同じ参照を保持して停止する。 |

pendingと正規Snapshotは同一形式・同一bytesであり、wrapperからpayloadを別公開しない。初回は`revision: 1 / previous: null`とし、新しい保存Rootと正規Snapshotの明示不存在を確認する。初回pendingの再入場でも同じ条件とexact bytesを確認する。正規Snapshot不存在かつ`previous`がnullでない場合は、既知元版の喪失として停止し、履歴から復元しない。未清掃の旧形式Rootを初回として自動採用しない。元内容との結合も検証し、revision番号だけを同一更新の証拠にしない。Windowsでのflush、replace、read-backは、既存primitiveが提供するProcess中断後の再分類保証として扱う。Directory metadataを含む電源断耐久性が未確認の間は、それを保証したと表示しない。通常historyの欠損からSnapshotを復元しない。

初回保存はRuntime Data Ownerによる領域の排他的作成へ結合する。空の既存領域を新品と扱わない。内部初期化証拠は同じ操作Owner・領域Identity・初回本文Hashだけへ結合し、公開要求前に発行済みとし、公開確認後に消費する。失敗後に別本文へ転用せず、公開後のstate喪失を初回へ戻さない。別Processからの初回中断再入場は専用入口未接続として停止する。

保存I/Oは本文とFile Identityを保持し、再openしたdescriptorと置換・削除前の実体を照合する。同じ本文の別Fileや途中消失を拒否する。正規rename後だけpendingのdev/inoを公開先へ引き継ぐ。回復参照と結果搬送の差分も参照操作のOwnerへ結合する。終端証明Portが未接続の間は操作・回復参照・搬送の削除を拒否し、unknown実行情報を処置証明なしに未発行へ変えない。保存確認と排他解放確認を別結果で返し、このPortの局所成立を本番Producer・回収入口・Host終端の全面切替と表示しない。

#### 利用形態別の受領と資源回収の分離

Producerの資源回収lifecycleは、Consumerの表示、閲覧または任意の保存方式に依存しない。2026-10-08の人間判断により、利用形態を次へ固定する。

| 本番利用側 | 受領方式 | 通常live実行の返却 | 保証しないこと |
|---|---|---|---|
| 単体CLI（`coordinator_cli`） | 一時的な返却（`transient`） | 既存CLI返却境界への同じ結果の引渡し。 | 閲覧、stdout先の耐久保存、Process終了後の回答再取得。 |
| Workbench（`workbench`） | 一時的な返却（`transient`） | 既存AI依頼Applicationへの同じ結果の引渡し。 | 人間の閲覧、任意のSession履歴、Server再起動後の一時回答再取得。 |
| Orchestrator（`orchestrator`） | 耐久受領（`durable`） | 保存Ownerが同じTask／Attempt／結果を確認して発行するACK。 | ACKだけを実資源不存在やTask全体成功の証明にすること。 |

固定対応は本番組立てが操作へ結合する。`coordinatorConsumerCompletionPolicy`はこの対応の値判定を一か所で所有する。Request、任意のpolicy値、保存JSONの宣言、Consumer欠落や空集合から耐久受領を一時返却へ降格しない。正当な単体利用と登録漏れを、固定された利用形態の照合で区別する。任意の利用側が任意の方式を選べる新Frameworkは作らない。

この通常live返却と、Process中断後の現在回復は分ける。中断後の`coordinator_cli`／`workbench`では、真正な回収Ownerが五資源、Host、Lease・旧Ownerの終端、必要なCandidate・一次失敗・終了要約と履歴保全を確認した後、対象pending配送0を要求する既存のtransient終了候補で操作を除去する。失われた回答の再表示や出力受付は前提にしない。元の一時回答を再送するContext、Receipt、別Store、Workbench回復endpointを追加しない。

回復コマンドは、終了整理後に同じ呼出しで捕捉済みの非秘密な技術診断を返せる。render／write失敗はCLI I/O失敗として報告するが、確認済みcleanupを巻き戻さず、除去済み操作・回復義務を復元せず、Providerを再実行しない。診断出力の成功も操作整理保存の成功を補完しない。Process中断により診断や一時回答を失う場合があり、少なくとも一回表示や表示と操作除去の原子的成立は保証しない。通常live実行の既存返却経路は、この中断後回復の変更を理由に変更しない。Orchestratorは中断後も同じ結果に結合した耐久ACKを要求する。

資源回収完了は、Provider Effect終端、必要なCandidate／一次失敗・終了要約の保全、真正なDocker／Host／Lease終端で確定する。耐久ACK待ちは結果配送の残件であり、Docker資源の再生成やcleanup不明への巻戻しを行わない。`pendingDeliveries`には耐久配送の残件だけを保持し、一時返却のための永続Receiptや別Storeは追加しない。配送失敗、ACK欠測、返却後のProcess喪失からProviderを自動再実行しない。Candidate本体、未解決の資源回復義務と一次失敗はそれぞれのOwnerが保全し、一時回答の保持方式を消去許可にしない。

耐久ACKは固定Consumer・Repository・操作・回復参照・固定結果へ結合する。Coordinatorは上位のFile／DBを直接知らず、保存Ownerが確認したACK契約だけを受理する。現在の上位ReaderはOrchestrator内部の保存確認実装として扱い、外部入力の任意Hashや任意callbackに置換しない。保存方式の変更はそのOwner内部で処置する。資源終端を確認した操作がACK待ちで現在状態に残る場合でも、資源の復元・旧Workspace再利用・新Provider要求は許可しない。

通常Taskの配送閉包は元Controlが存在する起動直後に捕捉し、Task完了時のControl削除は維持する。終端前・Host清掃不明・handoff相関不一致は読取りを拒否する。真正終端でhandoffとfinalizationがともに0件なら`not_required`を返すが、配送不要をProvider Effectなしへ昇格しない。結果ありでは全件をfresh確認し、上位は同じ集合の耐久保存後に各元Ownerへ固定ACK Readerを渡す。捕捉済み参照を新しい台帳へ登録せず、CLI／Workbenchへ提供しない。本番Sourceの接続、局所実保存、実Docker一体確認と新Process回復は別の確認範囲である。

この節が全Consumer耐久受理を要求していた途中実装の置換先である。終了候補・限定Writerへの方式適用と、本番Producerの接続・実測は別に判定する。現在Sourceは利用側別の終了方式へ接続しているが、全利用側と実境界の一体検証は未完了であり、値判定や終了整理の局所成功だけでcleanup、返却や耐久ACKの実成立を主張しない。

利用側は本番の呼出し組立てで固定する。通常CLIは`coordinator_cli`、Workbench候補・助言は`workbench`、Orchestrator Taskは`orchestrator`を使用し、要求JSON、相関IDの有無または候補の処置から推測しない。同じTaskのExecutor／Reviewer／是正でも管理情報に保持した値を計画へ渡す。不正利用側は処理開始またはMount有効化前に拒否する。現在の用途別許可・必要Artifact同一性の確認を本番開始前に行い、旧署名Capabilityの消費は撤去する。独立probeの検証用入口を、本番の受理・終了接続の成立根拠と扱わない。

新しい開始Identityの組立てでは、計画に明示した利用側と開始Ownerが固定した利用側の一致をRepository／Host借用前に確認する。欠落・未知値・別用途をCLI等へ補完しない。実OP、相関ID、Home・Host、資源名、nonceと回復参照の導出は維持する。旧本番beginの記録経路は撤去済みである。この組立て・保存の局所確認を、全Producerの実境界成立という主張に用いない。

Hostを通常状態へ戻す判断では、Controllerの最終結果を前提にしない。Host復帰が最終結果生成の前に必要であるためである。既存Docker回収Ownerが保持する元清掃結果と五資源観測、既存Mount Ownerが返した元完了結果を共同根拠として使う。Mount Ownerは同じRuntime内のWeakMapへ元結果と管理Capability・Mount・実OP・Home結合を保持し、コピー、別操作、別Runtimeの結果を拒否する。これはProcess内の非Authority観測であり、永続Receipt Storeではない。Controllerは元Mount結果を終了Ownerへ渡し、成功booleanだけへ縮約しない。Mount完了だけからDocker資源不存在、Home Lease解放、Host清掃または回復全体完了を推定しない。

`completeRuntimeOwnedCoordinatorHostSubmission`は元清掃結果と元Mount結果を同じ保存Identity・実OP・固定利用側・Home・資源計画へ照合する。Process終了、Container／Network不存在と清掃確認を全て要求し、五資源の回収観測を保存してからHost復帰へ進む。Host開始と通常復帰は同じ内部保存経路を用い、予定保存・排他解放後に実Ownerを処置し、後継tokenを再観測した場合だけ予定を解消する。応答喪失後に後継tokenを観測した場合は遷移を再発行しない。Host領域清掃は別処理であり、通常復帰だけで`host.cleanup`を確認済みへ変更しない。

正常復帰Ownerは、この共同照合・Host復帰と実Home Lease解放の後、`lease: released`と`execution.ownerEffect: disabled`を既存Writerの同じ版へ保存する。他の実行評価・資源・一次失敗・結果は保持し、保存・読戻し・排他解放の三確認が揃わなければ正常completeを返さない。物理Host清掃や結果保存の完了は別であり、この技術終端をTask成功へ変換しない。

この元結果保持・搬送とHost復帰APIは局所試験済みである。旧本番保存Ownerの記録経路は撤去済みであり、模擬Docker回収結果を含む局所照合を実Docker不存在や本番切替完了として扱わない。

Controllerの回復終了callbackには、同じ計画・元清掃結果・元Mount結果を一つの読取り専用引数で渡す。外側のfreezeを真正性の証明にせず、各結果をコピー・再生成しない。現在保存Ownerはこれらを既存verifierと保存Identityへ照合する。清掃相関不一致・Mount失敗・Mount記録失敗ではcallbackを呼ばない。元結果搬送の局所確認だけを、全Producer・実資源・Host境界の一体確認へ昇格しない。

Taskは各終了Capabilityに投影前のController元完了結果を保持する。Host領域の清掃では元結果を既存分類器へ渡し、分類成功後だけ同じ結果を既存の清掃記録callbackへ搬送する。callbackの外枠だけをfreezeし、Host元結果とController元結果はコピーしない。分類不能・清掃例外では記録とfinalizeへ進まず、清掃前に保存したexact回復参照を保持する。protocol failureの清掃確認は処理成功へ変換しない。この搬送は現在の清掃記録callbackへ接続する。局所搬送だけを全Producer・実資源・Host境界の完成へ昇格しない。

終端保存先は清掃前の現在管理Ownerに結合済みのRepositoryを既存Ownerから借用する。同じ結合を表す第二Capabilityの再搬送や新索引を要求しない。現在Owner・実操作・Repository実体・発行Revisionを確認してから終端専用Contextへ固定し、清掃後の初回借用は拒否する。既に取得したContextは現在Repository実体を再確認して終端保存だけに使い、通常操作Authorityを復活させない。Workbench助言の別終了経路もTaskと同じ元結果搬送を行い、清掃確認済みProtocol失敗から助言成功を生成しない。

回収処理の資源要求Readerは`readRuntimeOwnedCoordinatorResourceRequests`を用い、同じ管理Owner・Repository・実操作・exact回復参照と、保存読取り・排他解放を照合する。固定五用途を不変な新しい投影として返し、`not_requested`と確定済み`not_issued`だけ要求なし、予定保存・発行済み・結果不明・ID確認済みは要求ありとして扱う。保存済みDocker IDをそのまま保持し、保存情報から現在不存在を推定しない。観測不能はnullで停止し、旧保存物、空要求情報または名前ベース清掃へfallbackしない。本番接続時は所有Process停止後に再取得し、停止前の投影を再利用しない。このReaderの局所検証と、本番回収Ownerの一体切替は区別する。

予定保存後、実要求を呼ぶ前の取消は、結果不明とは分けて扱う。Controllerは同じ同期処理で要求未発行を確認した場合だけ、`recordResourceNotIssued`へ元通知を渡す。通知は管理Owner・回復Capability・実操作・exact回復参照・purposeへ結合し、同じ保存callback中だけ照合できる。要求呼出し後の例外、handle欠測、応答期限超過を未発行の根拠にせず、callback後・別Process・コピー・別対象からの再利用を拒否する。予定を未要求へ巻き戻さず、`intent_saved→not_issued`だけを許可して再要求不可の終端として保持する。保存確定前のProcess喪失は不明のまま残す。

専用Writerは`checkpointRuntimeOwnedCoordinatorResourceNotIssued`を使い、元通知を入口と保存排他下で再照合する。一般Writer・通常資源checkpointでは新しい未発行遷移を拒否する。`not_issued`はID・receipt・absenceをnull、観測をunobservedのまま保持し、清掃投影の`not_requested`を現在不存在の観測にしない。結果登録・履歴・終了条件でも同じ未発行区別を保持する。専用保存と迂回拒否は局所検証済みだが、本番callbackからの接続の実境界確認は未完了であり、未発行処置全体の完成としない。

保存済み作成予定に対して正常なDocker create応答のexact IDを取得した場合は、中間の発行済み保存を増やさず`intent_saved→identified`で確定できる。短縮辺は有効な64桁IDと`docker_create_result`を要求し、元版・次版の観測を`unobserved`、absenceをnullに保つ。名前からの再構成、照合観測によるID補完、無応答・throw、実不存在の同時推定には適用しない。値モデルの許可辺自体は実要求の証明ではなく、本番Ownerが同じ計画・管理Owner・purposeへ結合した正常応答だけを保存する。この接続のために新しい発行callback、Receipt Storeや共有Stateを追加しない。

同じSnapshotへ新操作を追加する場合、同じ認証領域の旧操作が未終端なら拒否する。次段落の同一Host限定経路を除く例外は、元版と保存候補の双方で清掃確認・Host清掃・Lease解放・旧OwnerのEffect不能・五資源終端を保持し、未解決義務が結果配送だけになっている場合である。耐久ACK待ち自体は次の実行を阻害しない。同じ更新で旧操作を終端化した値だけを根拠に新開始を許可せず、旧操作へ資源義務を再追加しながらの新開始も拒否する。検査は新操作追加の遷移へ適用し、既存Snapshot全体の読取りや回収を拒否するdecoder制約にはしない。この値検査は別Repositoryの残存検出、実清掃、または遅延Docker要求の終端を証明しない。

同一Host内の正常直列実行では、Host領域の清掃を最後に一度だけ行える。旧操作が元版と候補で全文不変であり、保存Identityの操作ID・Host root／marker所在・初期Host参照・root directory identityが一致し、旧current tokenが新操作の初期Host参照へ戻っている場合に限る。marker実体は原子的置換で変わるため、その物理identityの一致は要求しない。さらに旧操作は`executing`、Home Lease解放済み・旧Owner disabled・五資源終端・実行評価unknownなし・Workspace再利用不可・Host清掃未要求・遷移予定なし・再起動なし・一次失敗／結果／要約／履歴なしを全て満たす。未解決の資源義務が残る場合はこの例外でも拒否する。旧操作の物理清掃済みや成功を捏造せず、新操作は別nonce・別回復IDで開始する。別Hostには従来の完全清掃条件を維持し、同じ更新内の旧操作改変・取消・abandon・清掃不明をこの例外へ昇格させない。

#### 使い捨て実行環境と限定終了

回復の目的は旧Containerや旧Workspaceを復元することではなく、所有資源を安全に回収し、新しいIdentityの試行を開始できる状態に戻すことである。Provider処理や候補採用を回復から自動再送しない。

| 現在の分類 | 処置 | 残す事実 |
|---|---|---|
| 所有資源を確定し、通常回収できる。 | 既存の停止・回収・結果搬送を行う。 | 一次失敗、清掃結果、最終結果。 |
| 認証Probe作成結果だけがunknownで、限定終了の全条件を確認できる。 | 旧領域を再利用不能にし、過去結果不明の終了として閉じる。新Attemptは別操作で開始する。 | 作成結果unknownを維持し、通常成功や過去Effect不存在へ変更しない。 |
| 旧Owner、遅延要求、実資源、共有書込み等が未確認。 | 新Effectを発行せず同じ回復参照で停止する。具体的な介入が必要な場合だけ利用者へ示す。 | 未確認の条件と残る義務。 |

限定終了は、Provider本体未開始、外部送信なし、共有書込みEffectなし、旧Ownerの後発start不能、遅延createが実行を開始できないこと、現在の対象Process／Container／Network不存在、旧Workspace非再利用を全て確認する。単発の空一覧や、現在Processだけの終了で遅延Docker要求の無害化を証明しない。

現在回収Driverは、同Root・Host世代とHost／Home／Runtimeの全排他を取得した後、fresh状態全文を照合し、既存lifecycle Writerで旧Ownerの新規要求不能を保存・読戻ししてからDI回収へ進む。保存候補は対象操作のphaseを`executing→settling`、`execution.ownerEffect`を`disabled`とする差分だけで、他の実行評価・資源・一次失敗・結果・履歴・他操作を変更しない。既にdisabledならphase変更を保証せず、同じfresh照合だけで書込み0とする。`awaiting_delivery`で未退役の状態は巻戻さず拒否する。保存不明後は同Ownerで新しい処置を出さず、保存直後の取消でも退役を戻さない。この退役は旧Ownerからの新規要求不能の評価であり、既発行・孤立CLIの終端、遅延create無害化、実資源不存在や限定unknown終了の成立を意味しない。

同じ操作の再起動記録を限定終了の前提に使う場合、requestId／Scopeの一致だけから前後関係を推定しない。既存の状態遷移検査は、再起動checkpoint初期化と資源配列全体の変更を一更新へ混在させず、初期化後の新しい作成意図・発行・結果不明への進行を拒否する。意図から結果不明への保存正規化は再起動初期化前に行う。同値保持、発見した実IDの確定、既存の未発行判定・通常回収は維持する。これは保存順序の条件であり、実再起動・旧Owner終了・遅延要求排除・二回のfresh不存在観測の証明ではない。generic cleanupとabsenceの構造は本条件だけで緩めず、認証unknown専用のWriterと全終端利用側が成立するまで限定終了をOPENとして扱う。

この限定Classの再起動根拠は、同じTaskへ結合した上位要求confirmed・回収confirmed・最終completed／request confirmed／Effect不明falseを全て満たす場合だけである。blocked・最終not_issuedの確定は再起動を発行していない事実であり、未発見unknown要求を終了する根拠にはならない。停止の実体はDIが、固定CLI不存在・管理Process不存在・Engine既知停止・backend停止を共同観測し、起動直前にも停止を再確認した同じ処置へ結合する。旧Ownerの新規要求不能、既発行CLIの終端とDaemon側の停止境界は別々に照合し、保存されたdisabled一値だけで代替しない。

専用接続は、authだけunknown、他四資源通常終端、Provider未開始・外部送信／共有書込み未発行・旧Owner失効・全長期排他と元版一致を共同要求する。IDを発見した場合は既存identified保存・回収を優先する。未発見時のfresh不存在は二組とし、各組でDIの名前／名前＋Labelの二照会を確認し、各組の間と保存直前にOwner・元版を再確認する。外部CLI観測を短期State Writer排他の中で実行しない。専用の短命Contextだけが固定元本文・候補・観測結果を既存Writerへ一回渡し、保存排他内では元版CAS、Root、Owner、全長期排他、候補全文とContext未消費を同期照合する。一般resource／cleanup候補と一般Writerから新しいunknown＋absenceを生成・変更する辺は拒否し、専用記録の同値保全は許容する。

保存ではrequest unknownとnull IDを保持し、authの既存absenceだけを確定する。専用evidence Hashは版付きdomain、既存canonical encoder、固定順のIdentity Hash・exact回復ID・用途・予定名・所有Label・null ID・完全確定した再起動全文・二組四観測を用い、後続のoperation全体の共同終了判定から再導出できる形にする。元payload Hashは過去本文の追加保持を避けるため混ぜず、既存CAS／previousと読戻しで別に拘束する。Hashは実観測や処置Authorityを発行しない。Host遷移・清掃、終端、履歴、配送／ACK、操作除去と次受付が同じ共同判定へ接続し、正常・観測不能・失効・出版中断・通常経路迂回の反証が揃うまで本番の限定終了を完成扱いにしない。

専用記録を保持する後続保存では、排他外の差分検査と、排他内の実元版・Owner確認を分ける。履歴・配送・終了・修復・Host清掃の私有Contextが固定した元本文／候補を持つ場合、排他外ではその元本文の復号と候補全文一致、auth不存在の同値保持だけを確認する。複数の固定対が競合する、元本文欠測・不正、候補差またはauth差分があれば拒否する。ACK保存も候補生成時の元本文／候補を既存の私有Mapへ固定し、Readerが存在することだけを資格にしない。物理Effect後の未確定時だけ同じ対を保持する。一般入口は通常Readerを維持する。固定対は保存資格ではなく、実Root・元版CAS・File実体・候補再導出・現在Ownerと一回性を、物理Effect前に既存Kernel排他内で必ず照合する。この構造で正規のpending出版を通常Readerへ戻さず、新しいReader振分けやLock機構を増やさない。

認証Probeの限定Classでは、`create`と`start --attach`を別要求として扱う。基準Sourceの固定Probe計画は`--network=none`、`--read-only`、Provider Homeのreadonly mountであり、Workspace mountを持たない。新方式もこの閉じた計画を照合し、createだけからProvider実行・外部送信・共有書込みが始まる構成を拒否する。旧Ownerの終了確認だけでは不十分で、旧Attemptを参照するstart配送と再入場経路も失効させる。現在のProcess／Container／Network観測、未受理要求の終端と固定計画の確認を同じAttemptへ相関する。遅延createが無害な停止Containerを作り得る場合でも、未来の資源不存在や清掃完了を断定せず、未確定要求の終端・必要な回収を確認するまでその義務をSnapshotに保持する。過去unknownを残した終了区分と新しい試行の可否を分け、停止中Containerの存在を新試行のAuthorityやWorkspace共有へ使わない。

基準Sourceの`removeExactResource`は、作成要求済みかつDocker ID未取得では回収未確認を返す。名前だけから強制削除する変更でこの停止を解除しない。段階5では、現在Snapshot・固定計画・旧Ownerとstart不能・実観測の組合せへ限定終了を接続し、031の公式CLI局所起動とは別に003／014／030で反証する。

再起動は通常の終了要件ではない。限定終了を証明できない実際の未確認境界がある場合にだけ、既存の承認付きDocker再起動を候補とする。Windows再起動や汎用強制清掃を新設しない。再起動Scopeの変更では、現在の全稼働Ownerと未確定要求を閉集合として固定し、終了済み参照を除外する根拠を別に確認する。回復一覧の単純な部分集合判定へ置換しない。

OPEN: Snapshotの実保存Portと現在Writer／Caller、Windows保存primitive、Coordinator履歴設定Reader／Writer、全利用側と最終清掃について、Source接続を越える実境界の一体確認は未完了である。旧Owner／遅延createを無害化する限定終了の実証も残る。必要な条件を確認できないまま再起動条件だけを緩和しない。

## 12. 利用者との対話

利用者に示す質問は、何を承認するか、何が送信・変更されるか、入力後に何が起きるかを主要ロケールで先に示す。開始だけのEnter、公開確認値、秘密passphraseを区別する。通常運用では初期設定後の送信確認を再要求せず、Release鍵passphraseはRelease署名時だけHuman-only入力とする。

機械結果と人間表示を分離する。文字化け、二回Enter、入力reader失敗、ウィンドウ自動閉鎖または結果未保存はUX不具合であり、Security上のfail closedだけを理由に受容しない。

### Provider外部境界の診断接続

非0終了の一次診断には、同じCommandの観測値として`commandObservation`（`exitCode`、`stdoutBytes`、`stderrBytes`）を保持する。応答未観測は`null`とし、前Commandの値を転用しない。これはDocker CLIの終了観測であり、Container内AIの開始又は終了を単独では証明しない。過去記録の欠落はゼロへ補完しない。生本文は保存しない。

Codex非0終了は既知stderr分類を優先し、未分類時だけ容量・行数・行長を制限したJSONLの`error.message`又は`turn.failed.error.message`を既存理由へ分類する。通常回答本文、未知・重複キー・不正・過大入力を診断へ昇格せず、原文を返さない。実行許可・隔離・清掃条件は変更しない。

実行loop移管では、Coordinatorはraw HandleやDocker commandの反復を所有せず、DIの不透明cancel／completionへ接続する。保存と認証・AI結果受理は有限同期hookへ残す。開始factの通知からReporter→Task開始保存の既存順序でPromiseを監視するが、そのPromiseをDIへ返さない。上位の最終結果は確認のsettleを待ち、false／throwは開始観測失敗として保持し同じcancelへ一度だけ接続する。技術completion後に判明しても成功へ丸めず、既発生の保存を巻き戻したとは主張しない。DIの技術一次失敗・清掃事実と上位開始確認失敗を分け、誘発した取消や清掃理由で元失敗を上書きしない。実行期限はDIの開始観測から起算し、上位保存待ちでは延長しない。上位確認の新期限や再送・回復管理は追加しない。

起動構成の意味は下位Ownerへ委ねる。CoordinatorはDIの`projectDockerExecutionBoundary`からDocker三設定と分離済みpayloadを受け、Codexの場合だけAI Adapterの`projectCodexExecutionBoundary`へpayloadを渡して既存構成通知を組み立てる。Claudeの承認／sandboxはnot_applicableとし、Role・Provider・操作ID・Workspace modeは元計画へ相関する。Coordinator自身ではDocker／Codex optionを走査しない。分離不能は三設定false・Codex other／implicitとして表し、診断だけを理由に本処理・Authority・cleanupを変更しない。内側のDocker風flagを外側設定と数えていた旧診断は是正するが、正常計画の通知fieldと語彙は維持する。

終端保存では、元Controllerの完了結果と同じ管理Owner・実OP・開始時回復参照へ結合した私有観測から一次失敗を取得する。終端候補の診断は元観測の全項目と`null`を含めて一致させる。元観測が非nullなのに診断を欠落させること、および元観測と異なる診断への再構成を拒否する。元観測を取得できない場合は既存の固定診断を変更しない。五資源の検証済み観測がない経路では終端観測を登録せず、一次失敗搬送を全経路の耐久保存保証へ読み替えない。

最初の失敗と、その後の清掃結果は別の事実として保持する。Process Controllerは既存の終了後診断へ`primaryFailure`を追加し、失敗したCommand用途、固定段階、固定理由、既知例外の分類、Handle取得・応答観測・資源ID記録の成否を最初の失敗時に固定する。Timeout後の終了処理や清掃の失敗で、この一次失敗を上書きしない。正常終了時は`null`とし、清掃だけの失敗を存在しない一次実行失敗へ変換しない。最終status、cleanupとexact Recoveryの安全条件は変更しない。

Handle取得はDockerの要求受理ではなく、CLI応答は資源IDの記録成立ではない。作成意図記録だけから要求発行やDocker受理を推定しない。診断は秘密値、Host Path、argv、stackおよび生出力を含まず、固定語彙外の例外は`unclassified_exception`とする。既存の診断通知はbest-effortであり、受信した検証Toolが記録を保存する。通知未達、清掃中の停止またはProcess喪失時の耐久保存は保証しない。過去の署名Runtimeの診断に当該Fieldがないことを、失敗不存在へ読み替えない。

ProviderとDockerの外部境界は、一般Architectureの[外部境界の診断可能性](../../../27_Architecture.md#外部境界の診断可能性)を次の二系列で実装する。

Workbenchの読取り助言は一般Taskを偽装せず、`workbench_advice`を第3実行モードとして扱う。Runtime所有の一回消費PacketがOperation、Profile、Task／Projection Hash、Provider Command HashおよびPromptを結合し、Codex／Claude Adapter、Docker Effect、Process Controller、Recoveryが同じModeを保持する。Provider HomeとOperation一時領域だけをMountし、Repository／WorkspaceはMountしない。Provider出力は固定CLIの完了Envelopeを検証して助言JSONだけへ縮約し、全資源のcleanup後にのみ上位Executorへ返す。

| 系列 | Coordinatorが保持する閉じた観測 | 保持しない内容 |
| --- | --- | --- |
| 実行構成 | 承認方式、Sandbox、Workspace mount mode、read-only root、非root user、workdir | 起動Command本文、Host Path、Credential |
| 実行結果 | 同じOperation ID、Container作成、Provider Process開始・完了、終了code区分、Command／File変更Event件数、cleanup | Provider生Event、生出力、Event内Path、候補本文 |

実行構成は設定済みの値、実行結果は外部境界で観測済みの値として表示し、両者を同じ成立事実へ畳まない。診断sinkの失敗、遅延または不在はAuthority、Sandbox、外部Effect、cleanupおよび本処理の結果を変更しない。診断だけからWorkspaceのbyte変化を推定せず、候補Filesystemの独立観測を正本とする。

Provider境界のLifecycle診断は、`coordinator_provider_boundary_configured`、`coordinator_provider_process_started`、`coordinator_provider_boundary_settled`の閉じたEvent集合として扱う。検証側は設定、OS Process開始、完了・cleanupを同じEventへ畳まず、`operationId`、ProviderおよびTask Roleで相関する。既知の設定または終了Eventを未知Protocol違反へ誤分類して後続の取消・親喪失操作を抑止してはならず、反対にEvent欠落、余分なEvent、順序差またはIdentity差を成功へ補正してはならない。

外部Agentへ渡すTask Packetは、通常の対話環境から推測できない実行Capabilityを明示する。隔離WorkspaceにGit Metadataがないこと、利用できない編集Command、および検証済みの決定論的な編集手段を実装と同じ変更で接続する。Agentに試行錯誤でTool Inventoryを推定させず、設定したCapabilityと実際のImage内Toolを結合試験で照合する。

<a id="11-変更と検証"></a>

## 13. 検証接続

固定候補では、単体試験だけでなく次を確認する。

### 実行環境別の試験プロファイル

試験段階と実行環境を同一視しない。Unit／Integration／Systemは検証する境界の深さを表し、Portable／Host Windowsは試験を安全に実行できる環境を表す。既定の`npm test`と`test:portable`は、Repository内のfixture、隔離した一時領域および置換可能なAdapterだけで完結し、実Docker Engine、Windowsの実子Process終了、Named PipeまたはHost権限を必要とする試験を開始しない。

実Host境界を必要とする試験は`Host Windows:`の閉じた分類へ所属させ、`test:host-windows`からだけ実行する。Release前の全回帰は`test:all`を明示し、Portable試験を完了した後、Host権限を持つ実行環境でHost Windows試験を実行する。Sandboxや権限不足による拒否を実装失敗へ畳まず、逆にPortable試験の失敗をHost環境差として除外しない。新しい実環境試験を追加する場合は、Host分類、Owner Runner、必要環境、cleanupおよび終了後条件を同じ変更で閉集合へ追加する。

- 公開CLI閉集合と`capabilities --json`
- manifest revision 5、閉じたRuntime実行集合、Policy、単一Native成果物、改変・欠落・旧Schema拒否
- 正常、準正常、異常のTask／Review／Remediation
- timeout、cancel、Provider失敗、owner loss、cleanup不明、fresh recovery
- Codex→Claude、Claude→Codex、同一Provider例外の4経路
- 実端末の表示、一回入力、取消、結果保存
- cleanup後のContainer、network、Mount、lock、候補一時領域およびRecovery残存

設計要素から実装symbol、試験、観測方法および終了後条件への対応は[Coordinatorの機械可読な検証対応](../../../07_Quality/Registry/coordinator-runtime-traceability.json)で確認する。この投影は実行時構成ではなく、機械試験は独立レビュー、Architecture／Security、Gap／Impact、DocumentおよびConformance監査を代替しない。

### 13.1 機械Traceへ結合する設計ID

次のIDは本文の状態・資源・遷移・不変条件に安定した機械参照を与える。JSON側が意味を新設するのではなく、本節の集合と本文の設計を試験へ結合する。追加・削除・意味変更では、本文、JSON、実装所有者、正常・準正常・異常の試験および終了後観測を同じ変更で更新する。

資源ID:

```text
`RES-HOST-GENERATION`          Host Operation lockと作業Directory
`RES-LOGICAL-HOME-LOCK`       Provider Home単位の排他
`RES-RUNTIME-STATE-LOCK`      Runtime Stateの限定読書き排他
`RES-INTERACTIVE-CONSOLE`     Console lock、reader、pipe、child
`RES-MOUNT-GRANT`             一回限りCapabilityとMount lease
`RES-DOCKER-OWNED`            Provider child、Container、network
`RES-OPERATION-WORKSPACE`     Host内の一時投影・保護Mount。上位から借用する作業Treeは含めない
`RES-TASK-CONTROL`            Process-local取消・終端Capability
```

状態IDは主系列と終端・回復系列を分ける。

```text
`STATE-ADMISSION`
→ `STATE-OPERATION-ACQUIRING`
→ `STATE-OPERATION-READY`
→ `STATE-TASK-AUTHORIZED`
→ `STATE-EXECUTOR-CLEAN`
→ `STATE-CANDIDATE-CAPTURED`
→ `STATE-REVIEWER-CLEAN`
→ `STATE-HOST-CLEAN`
→ `STATE-RESULT-PUBLISHED`

`STATE-REMEDIATION-AUTHORIZED`
→ `STATE-REMEDIATION-EXECUTOR-CLEAN`
→ `STATE-REMEDIATION-CANDIDATE-CAPTURED`
→ `STATE-REMEDIATION-REVIEWER-CLEAN`

`STATE-BLOCKED-CLEAN`
`STATE-PROCESS-RESTART-REQUIRED`
`STATE-RECOVERY-REQUIRED`
`STATE-OPERATOR-TRANSFER-REQUIRED`
```

遷移ID:

```text
`TRANS-ADMISSION-TO-OPERATION-ACQUIRING`
`TRANS-OPERATION-ACQUIRING-TO-READY`
`TRANS-OPERATION-TO-AUTHORIZED`
`TRANS-AUTHORIZED-TO-EXECUTOR-CLEAN`
`TRANS-EXECUTOR-TO-CANDIDATE`
`TRANS-CANDIDATE-TO-REVIEWER-CLEAN`
`TRANS-REVIEWER-TO-REMEDIATION`
`TRANS-REMEDIATION-AUTHORIZED-TO-EXECUTOR-CLEAN`
`TRANS-REMEDIATION-EXECUTOR-TO-CANDIDATE`
`TRANS-REMEDIATION-CANDIDATE-TO-REVIEWER-CLEAN`
`TRANS-REVIEWER-TO-HOST-CLEAN`
`TRANS-REMEDIATION-REVIEWER-TO-HOST-CLEAN`
`TRANS-HOST-CLEAN-TO-RESULT`
`TRANS-ACTIVE-TO-BLOCKED-CLEAN`
`TRANS-ACTIVE-TO-RECOVERY`
`TRANS-ACTIVE-TO-OPERATOR-TRANSFER`
`TRANS-ACTIVE-TO-PROCESS-RESTART`
`TRANS-HOST-CLEAN-TO-PROCESS-RESTART`
```

不変条件ID:

```text
`INV-NO-PROVIDER-EFFECT-BEFORE-AUTHORITY`
`INV-LOCK-ORDER-AND-REVALIDATION`
`INV-DURABLE-BEFORE-EFFECT`
`INV-STAGE-CLEAN-BEFORE-HANDOFF`
`INV-CANDIDATE-EXACT-AND-NONCANONICAL`
`INV-BOUNDED-REMEDIATION`
`INV-RESULT-AFTER-CLEANUP`
`INV-HOST-CLEANUP-AFTER-DOCKER-CLOSURE`
`INV-CLEAN-BLOCK-HAS-NO-RECOVERY`
`INV-UNKNOWN-PRESERVES-RECOVERY`
```

主系列外の遷移は、発生時点のActive状態から安全な終端へ移る。`BLOCKED-CLEAN`は全資源不存在とRecovery IDなし、`PROCESS-RESTART-REQUIRED`は資源回収済みだがProcess再利用不可、`RECOVERY-REQUIRED`はexact Authority付きEvidence保持、`OPERATOR-TRANSFER-REQUIRED`は安全な自動処置に足るAuthorityがない状態である。この四つを同じ`blocked`表示だけで同一視しない。

旧修復Store専用の`REPAIR-HISTORY`資源・状態・遷移・拒否分類・不変条件は、実装と現行の検証対応から撤去した。過去のEvidenceとGit履歴は当時の方式を示す証跡であり、現在方式の成立根拠には使用しない。現在の修復checkpoint、通常履歴への一回出版、期限付き保持引渡しは現在状態の契約と専用Writer／Callerで検証し、旧hardlink公開・adoption・Session chainを再実装しない。

### 13.2 機械生成する意味要素

次の表はSemantic IR Pilotの入力である。表から抽出できない意味を生成器やAIが補完しない。Semantic Keyと種別はPilot用であり、[Semantic Coverage基盤](../semantic-coverage/02_Semantic_IR_and_Relation_Design.md)の評価後に固定する。

| Semantic Key | 種別 | 要求する意味 | Architecture定義 | 検証要否 | 根拠節 | N/A理由 |
|---|---|---|---|---|---|---|
| `coordinator.objective-lifecycle` | `lifecycle` | Task／Attemptを要求、許可、Provider実行、Review、候補、cleanup、結果公開へ進め、途中失敗を安全な停止または同じIdentityの回復義務へ収束させる。 | `ARCH-000004` | `Required` | `## 3. 一般Taskの主シーケンス` | — |
| `coordinator.provider-effect-authority` | `authority` | 外部送信同意、Task Authority、Provider Effectおよび候補採用を別の決定権限として扱い、必要なAuthorityが揃う前にProvider Effectを開始しない。 | `ARCH-000004`<br>`ARCH-000015` | `Required` | `## 7. Authorityと外部送信` | — |
| `coordinator.provider-selection-boundary` | `boundary` | 利用可能性、Task属性、構成、PolicyおよびTrust結果からProvider／ModelをEffect前に選び、選定理由と再選定条件を固定する。 | `ARCH-000010` | `Required` | `## 8. Providerとモデル選定` | — |
| `coordinator.external-boundary-diagnostics` | `observability` | Provider、Docker、OS Processおよび結果搬送の要求、開始、完了、失敗、cleanupを同じOperationで相関し、観測不能を成功へ畳まない。 | `ARCH-000008` | `Required` | `### Provider外部境界の診断接続` | — |
| `coordinator.candidate-review-boundary` | `boundary` | Providerの生結果を正本へ直接採用せず、隔離候補、Review、必要なRemediationおよびCandidate dispositionを経て利用側へ返す。 | `ARCH-000015` | `Required` | `## 10. Provider実行と候補` | — |
| `coordinator.recovery-obligation` | `recovery` | Effectまたはcleanupが不明な場合はexact Recovery IdentityとEvidenceを保持し、別Taskへの再発行や不明状態の正常化を行わない。 | `ARCH-000004`<br>`ARCH-000008`<br>`ARCH-000015` | `Required` | `## 11. 取消と回復` | — |
| `coordinator.cleanup-before-result` | `resource` | Process、stream、Container、network、Mount、lock、候補一時領域の終了後状態を確認し、cleanup未確認のまま完了結果を公開しない。 | `ARCH-000004`<br>`ARCH-000008` | `Required` | `## 5. 資源所有` | — |

<a id="orchestrator-integration"></a>

## 14. Orchestratorとの接続

この見出しは既存参照の解決用に保持する。再編後はOrchestratorがCoordinator公開APIを直接呼び、Coordinatorは単体利用も成立させる。Provider選定の実行Gate、単一Task、候補生成、Review、exact回復情報とcleanup結果を下位の責務として返す。Project、Milestone、Objective、Task Graph、統合、受入とProject状態は[Orchestrator詳細](../orchestrator/01_Architecture.md)が所有する。

```text
Orchestrator / 単体利用側
  │ Task要求・縮小Authority・登録ハンドラー
  ▼
Coordinator公開API
  │ 選定Gate / 実行 / Review / 回収・結果
  ▼
Coordinator
  │
  ├→ AI Adapter：Codex / Claude差
  ├→ Platform Access：OS原語
  └→ Execution Intelligence：下位事実
```

| 境界 | Orchestrator | Coordinator |
|---|---|---|
| Taskの意味 | ObjectiveとTask Graphから実行要求を作る | 閉じた実行要求を処理する |
| Provider | Task内容・Role・任意の選択Profileを渡す | AI Adapterの適格性・計画を使い、実観測・Grant・送信許可成立後に実行する |
| 候補 | Task結果をProject状態と統合へ接続する | CandidateとReview結果を返す |
| Recovery | Project／Taskとの相関を保持する | 実行資源のexact Recovery情報を返す |
| 完成 | 明示Authorityと根拠からObjective／Milestoneの判断を記録する | Task結果とcleanupを別軸で報告する |

CoordinatorはProject状態を再定義せず、Orchestratorをimport・構成・再exportしない。OrchestratorはProvider、OS、Containerや退役した候補Storeの内部実装へ依存せず、公開APIから必要な結果を受ける。通知型はCoordinatorが定義し、Orchestratorがハンドラーを登録する。意味契約は[状態・資源詳細](../orchestrator/02_Detailed_Design.md)、実装・試験接続は既存の機械投影と契約試験で照合する。旧上位Adapterに存在する結果検査を捨てず、下位共通結果検査と上位結合検査へ分けて移す。

単一Taskの拒否結果では、実効Executor Providerが未選択の場合の`executorProvider: null`を正当な未選択として受け取る。上位の省略可能なProvider項目へは投影せず、元の拒否理由、cleanup、再起動要否およびexact回復参照を保持する。未選択だけからEffect 0や資源不存在を推定しない。成功結果のnull、未知Provider、ProxyまたはAccessorは拒否し、欠測・data `undefined`の既存互換は維持する。Accessorを欠測へ読み替えず、Getterを実行しない。

外部送信確認を取得できない拒否は、この結果搬送の是正とは別である。Workbenchでの送信確認表示や会話上の承認を、Runtimeの検証済み同意の代替にしない。有効な同意を再利用できなければ正式な対話確認へ戻り、自動承認、無条件再送またはProvider開始によって拒否を回避しない。

## 15. 非目標

- Provider同士の直接spawn
- AIへのmerge、tag、Releaseまたは課金購入Authority
- API key課金fallback
- 永続Activation／Provisioning state
- Platform準備用SupervisorまたはAppContainer bootstrap
- 任意外部Toolへの無制限Authority
- Linux／Remote／Multi-projectの先行抽象化

将来Remote RuntimeやOrganization Runtimeが必要になった場合は、実在する利用者・運用・Authority・Recoveryから新しいArchitectureを設計する。削除済みのLocal Personal準備契約を互換性名目で復活させない。

## 16. Implementation Structure

| 観点 | 適用 | 判定理由 | 成立させる構造 | 局所責務・不変条件 | 失敗・変更時の影響 | Qualityへの導出キー |
|---|---|---|---|---|---|---|
| Variation | Required | CodexとClaude、OS原語、実行Modeの差が存在する。 | Provider差はAI Adapter、OS差はPlatform Access、Task／助言／回収の意味はCoordinatorへ閉じる。 | 上位利用側はProvider固有argv、CLI出力やDocker資源操作を持たない。 | 新Provider追加時にAuthority、診断、cleanupの抜けが生じる。 | `coord.provider-selection`、`coord.provider-attempt` |
| Common Contract | Required | この観点を成立させる構造と責務が存在するため。 | Provider、Process Controller、候補ReviewおよびRecoveryの具象差を、Authority、結果、診断、取消とcleanupの共通契約へ揃える。 | 各具象は同じTask／Attempt Identity、Effect境界および終了後条件を保ち、固有出力を上位へ漏らさない。 | 新ProviderやOS経路だけが別の承認、状態、結果または資源回収規則を持つ。 | `coord.provider-selection`、`coord.provider-attempt`、`coord.task-recovery` |
| Creation／Selection | Required | Role・Profile・利用可能性・実行許可の選択が必要である。 | AI Adapterで構成・適格性を解決し、Coordinatorで実Home・固定入口と必要Artifact同一性・現在の送信許可・短命GrantをEffect前に結合する。 | 選定とProvider Effectを分け、署名を通常実行資格にせず、独立Trust Policy Frameworkは要求しない。 | 選択後の再解釈や入口別選択で経路が不一致になる。 | `coord.provider-selection` |
| State-dependent Behavior | Required | この観点を成立させる構造と責務が存在するため。 | Task／Attempt／Process／Review／Recovery状態ごとに許可する操作を限定する。 | Effect不明やcleanup未確認を成功状態へ遷移させない。 | 状態分岐の分散で再発行や回復Identity喪失が起きる。 | `coord.provider-attempt`、`coord.task-recovery` |
| Composition／Recursion | Required | この観点を成立させる構造と責務が存在するため。 | 選定、送信許可、Provider実行、Review、候補、cleanupを順序付きで合成する。 | 各段階は前段の確定結果だけを入力とし、循環再試行を作らない。 | 部分成功を全体成功に畳む、または同じEffectを再実行する。 | `coord.provider-attempt`、`coord.signed-promotion` |
| Lifecycle Ownership | Required | この観点を成立させる構造と責務が存在するため。 | 子Process、stream、Container、候補一時領域とRecovery義務をTask／Attemptへ結ぶ。 | 生成したOwnerが移送またはcleanup確認まで責任を持つ。 | 利用側が完了を受け取っても資源と回復義務が残る。 | `coord.task-recovery`、`coord.docker-repair-handoff` |
| External Boundary | Required | この観点を成立させる構造と責務が存在するため。 | Provider、Docker、OS Process、Filesystemを診断可能なAdapterで隔離する。 | 要求・開始・完了・結果搬送・終了後状態を同じOperationで相関する。 | CLIやOS差を成功／不存在へ畳み、原因境界を失う。 | `coord.provider-attempt`、`coord.docker-repair-handoff` |

CodexとClaudeの計画・出力変換はAI Adapter内の共通契約へ揃える。CoordinatorはAuthority、結果、診断、取消とcleanupを共通化し、Provider別の専用実行ファイルを持ち続けない。OS原語はNative、ProcessやDocker資源の業務lifecycleはCoordinatorが所有する。限定unknown終了を通常実行・認証・任意孤児清掃へ一般化しない。

<a id="ui-spec-detail-placement"></a>

## 上流UI／SPEC Detailとの関係

| Detail Source | UI／SPEC Definition | この領域が担当するSCR／PRT／Interaction／BHV | Relation状態 | 未解決Gap／戻し先 |
|---|---|---|---|---|
| [UI／SPEC Detail Architecture Traceability](../../08_UI_SPEC_Detail_Traceability.md) | ARCH-000004、ARCH-000008、ARCH-000010、ARCH-000014、ARCH-000015のSource Definition | 同Traceability表で上記ARCH-IDへ接続された全Detail ID | Covered | Detailの意味変更はUI／SPECへ、配置責務の変更は該当ARCH定義へ戻す |

担当Interaction Relation: `PRT-000002.spec-000002`、`PRT-000002.spec-000003`、`PRT-000002.spec-000028`、`PRT-000002.spec-000029`、`PRT-000003.spec-000004`、`PRT-000003.spec-000005`、`PRT-000005.spec-000009`、`PRT-000010.spec-000014`、`PRT-000010.spec-000015`、`PRT-000011.spec-000005`、`PRT-000012.spec-000017`、`PRT-000013.spec-000018`、`PRT-000016.spec-000021`、`PRT-000016.spec-000026`、`PRT-000016.spec-000027`

本領域は上記Relationの配置責務を局所所有する。Detailを新しい要求として解釈せず、対応ARCH-IDが所有する配置・境界・状態・観測の制約として実現する。

このうち`PRT-000002.spec-000002`／`PRT-000002.spec-000003`／`PRT-000003.spec-000004`／`PRT-000003.spec-000005`／`PRT-000005.spec-000009`／`PRT-000011.spec-000005`／`PRT-000012.spec-000017`のDocker／Process技術担当は[Docker Isolationの局所分担](../docker-isolation/01_Architecture.md#ui-spec-detail-placement)へ接続する。CoordinatorはTask・Authority・対象・保存・保持・通知相関・利用側結果を所有し続け、技術処理の重複Ownerにはしない。受理はTask作成まで、照会は読取り、次行動は分類までで新しいEffectを追加しない。診断は修復／再起動の許可を含まず、結果再取得もDocker再実行を要求しない。モデル選択28／29はAI Adapterとの上位接続のままDIへ移さない。中央表のCoveredは配置対応であり、未観測境界やCapability全体の完成を意味しない。

## 保存方式の切替確認

現在状態、有限履歴、Evidenceを分け、物理切替と診断搬送の未実装範囲を明示した。unknown終了を今回の限定Classに留め、過去unknown保持と新規受付を別判定にした。

OPEN: 保存確定、履歴上限、既存回復の移行と限定Classの実接続・反証は未完了。該当境界の実装前に具体化し、実境界の反例と独立確認が揃うまで完了としない。


### 廃止したCoordinator署名準備領域の処置

Coordinator固有署名ToolとManifest設定を撤去したため、現行Runtimeは`.crdd/tmp/signature/`を作成・読込み・回復しない。旧`preparation.json`・Lock・pending・workと正式Manifestの自動移行は実装しない。フロントAIが現在参照、非使用、exact Rootと所有実体を照合し、唯一の必要な成果物を保全してから旧一時物を清掃する。名前や経過時間だけを削除許可にせず、秘密鍵・Local秘密設定・歴史Evidenceは対象へ含めない。

将来の正式配布署名が必要になった場合は、汎用artifact-signingと配布物の具体的Consumerから再評価する。旧準備領域や通常Runtime資格を再導入する根拠にはしない。

### 現在状態と利用側接続の評価

縮小Snapshotの基本情報・回復・搬送の相関と、元版／次版／exact bytesの保存形式は局所照合済みである。本番保存、限定終了と全利用側の実接続・実境界反証は未完了であり、設計の自己確認を実装Passにしない。

Checklist評価根拠: §2.3／2.4の公開操作・実Consumer、Provider分割、現在状態の保存時点と旧回復の処置により、Component、Interface、Data／StateおよびSequenceを具体化した。実移管・本番接続は未評価である。QA-000006へ通知・保存・限定終了・未署名通常入口・必要Artifact同一性と旧署名Gate撤去の検証義務を渡した。実観測と必要な実Provider E2Eは未完了である。任意正式配布署名は別の適用範囲に限定する。

HomeLeaseの解放観測は、既存Recovery Ownerが実`release()`の成功直後に元の回復Capability・管理Capability・操作ID・回復参照へ保持する非Authorityの事実である。旧recordの消費後も、元Capabilityが存在する間は同じ相関だけで照合できる。abandonや保存値、コピー結果は実解放の根拠にならない。終端Writerの`released`への変更はこの根拠を必須とし、全清掃成功にはHost・五purpose・Mount・HomeLease・回復完了を共同照合する。このProcess内接続を新Process再入場の証明や本番Producer一体切替済みとして扱わない。

## Checklist

- [x] 関連するARCH-IDと担当する責務断面を明示した
- [x] 10種類の詳細成果物を全数Applicability判定した
- [x] Requiredを実在する節または成果物へ接続した
- [x] N/AにArchitecture上の理由を記録した
- [x] 8種類のEngineering Concernを全数評価した
- [x] PASSを設計済みの意味に限定した
- [x] Component、Interface、Data／StateおよびSequenceを必要な粒度で具体化した
- [x] Failure／Recovery、ObservabilityおよびSecurity Boundaryを具体化した
- [x] 7種類のImplementation Structure観点を全数Applicability判定した
- [x] 二つ目の具象実装がある責務で、共通契約への昇格または非昇格理由を評価した
- [x] Qualityへ渡す設計項目を局所的な導出キーまたは同等に一意な参照へ接続した
- [x] Qualityへ対象、正常条件、反証する失敗、観測および終了後条件を渡した
- [x] Human Inputの必要性とOpen／Gapを評価した
- [x] 現行実装との照合をReality Auditとして分離した
- [x] Source構造をCanonical詳細設計へ逆輸入していない
