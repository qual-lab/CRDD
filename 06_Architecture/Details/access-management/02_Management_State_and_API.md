# 管理APIと現在状態の保存設計

成果物種別: Architecture詳細設計
詳細設計領域: access-management
状態: Candidate（最小鍵提示方式の設計伝播・限定再レビュー済み（最小鍵提示方式の伝播差分、全重大度0）。既存保存部分の局所結果は対象固定版の履歴。初回確認の具体入口・Schema・鍵管理本番接続は未成立）
維持責任者: Qual-Lab

## 1. 対象と保持条件

[責務・意味・処理境界](01_Architecture.md)を具体化する。既存管理分担、鍵操作の入口、交換の意味は維持し、共有Profile管理のmanager／administrator許可を追加した9 Role分担行を内容権限設定から生成しない。管理能力から内容閲覧を許可しない。先行したProfile接続段階は既存四Toolだけを対象とし、通常管理Toolを追加しなかった。現在は非鍵管理10操作を注入ResolverのWIP Sourceへ接続済みである。人間判断待ちのRemote登録はSource・Schema・一覧・dispatchに追加しておらず、公開Launcher・Workbench本番・正式評価は未接続である。§2.4.1は11候補全体の契約正本であり、10操作の局所実装を公開Capability全体の完成へ昇格しない。鍵操作はMCPの一覧・Schema・登録・dispatchの全てで非公開とし、応答へSecretを含めない。

今回比較するのは、公開読取り、操作別更新、同一改訂の保存単位、出版後故障、移行である。汎用IAM、Receipt Store、Lock Framework、共有Recovery、Docker操作は対象外。候補API名やFile名はSourceへ実装済みという意味ではない。

## 2. 操作別API候補

Workbench通常管理の結果投影は、AMの`management/result.ts`を共通Ownerとする。既存管理read・保存結果を非秘密の閉結果へ写し、Binding・Path・自由文字列理由を含めない。MCP／Workbenchは同じ投影を利用し、HTTP／JSON-RPC envelope、取消、入力と応答の容量制限は各Transportが所有する。新しい保存Stateや認可判断を投影へ持たせない。具体結果意味は§2.4.1に従う。

通常接続の本人表示は既存`readCurrentAccess`をOwnerとし、同Process Workbenchは直接、Remote Workbenchは`crdd.get_current_access`を利用する。公開投影は同改訂のuser（userId・username・role）、contentAccess、permittedRepositoriesに限定する。内部managementOperationsを公開済みSurfaceの能力一覧へ転用せず、資格・管理Root・Binding・他Userを含めない。初回途中の通常本人readは提供せず、拒否・観測不能を空本人へ変換しない。

### 管理の計数単位

| 計数軸 | 母集合と対象外 |
|---|---|
| Role別分担9行 | REQ-000041の担当Role表。複数操作のまとめと対象Role別の分割を含むため、操作数ではない |
| 認可要求11種別 | User管理4、Repository管理3、Profile管理1、鍵管理3。Profileの一覧・登録・変更・削除は共通の`manageAiProfiles`で判定するため、公開API数ではない |
| 通常保存7操作 | `registerUser`、`updateUserName`、`changeUserRole`、`updateRoleContentAccess`、`registerRepository`、`unregisterRepository`、`updateExposure`。ProfileのCatalog保存、鍵Lifecycle、初回設定・Host交換は含まない |

計数軸の訂正は許可条件や操作の追加・削除ではない。各操作の対象・Authority・保存条件は以下の既存契約を維持する。

固定分担だけを判定する`evaluateManagementPermission`は、`40_Develop/access-management/src/index.ts`から局所公開した。9 Role分担表を、ユーザー登録・名前変更・Role変更・Role内容設定・Repository登録・登録解除・Exposure変更・鍵発行・独立失効・交換・共有Profile管理の11認可要求種別へ対応する。結果は`allowed`／`denied`／`invalid`だけで、認証、対象存在、現在改訂、保存・鍵Effect、Host信頼を確認するAuthorityではない。登録予定Role、変更前後Role、名前／内容設定の対象Roleを操作別に検査する。これは保存Gateを必要としない純粋判定部分であり、以下の管理操作・公開readの実装を意味しない。

以下はAccess Management内部の関数契約候補であり、HTTP RouteやMCP Tool名ではない。公開はPackage Rootの`src/index.ts`だけを入口とし、再export専用の中間Fileを増やさない。

| 操作候補 | 入力・判定 | 結果・利用側 |
|---|---|---|
| `authenticateCredential` | Bearerと現在管理改訂。既存User・現在Role・資格状態を同じ改訂から解決 | 初回途中も含む本人確認。Token・Verifierを返さず、通常Surface接続の許可には単独で使わない |
| `authenticateNormalConnection` | 検証済み管理RootとBearer。同じLockの現在資格・User・Roleと初回`completed`を照合 | 通常Surfaceの要求内認証。初回途中の本人確認とは分離し、内容権限・Session・受領記録を作らない |
| `resolveAiProfileManagementAccess` | `src/index.ts`→`access/profile-management.ts`。同じ通常認証から現在Roleの`manageAiProfiles`を判定 | `AiProfileManagementAccess`のallowed／denied／unavailableだけを返す局所実装候補。Catalogをimportせず、認証不成立・初回未完了・状態不明をdeveloper拒否へ畳まない。既存Lock解放後にMCPがCatalog操作を結合する。本番入口の完成ではない |
| `readCurrentAccess` | 認証主体と現在改訂 | 自己表示名・Role・認可済み範囲。管理能力と内容範囲を分離 |
| `readManagementState` | 現在の管理認可と必要な対象 | 許可されたUser／Role／接続／公開の投影だけ。全内部Snapshotは返さない |
| `readCredentialAdministrationState` | 同Process Workbenchの検証済み管理Rootと現在Bearer | 現在administrator・初回完了・材料／清掃／解放確認後だけ、同改訂のactorUserId・User選択候補・資格Metadata・未解決交換一件以下を非秘密投影。四管理kindやMCP公開へ追加しない |
| `registerUser` | 予定Role・表示名・期待改訂。managerはdeveloper／managerだけ、administratorは三Role | 新User ID・改訂・読戻し。資格発行0、自己登録なし |
| `updateUserName` | 既存userId・新表示名・期待改訂。manager／administrator。administrator対象も許可 | 名前だけ変更。User ID・Role・資格を保持 |
| `changeUserRole` | 変更前・変更後Roleを含む対象と期待改訂 | developer／manager間はmanager／administrator。administratorへの変更・administratorの変更はadministratorのみ |
| `updateRoleContentAccess` | 対象Role・明示内容範囲・期待改訂 | administrator内容設定はadministratorのみ。他Roleはmanager／administrator。固定管理能力は変更しない |
| `registerRepository` | 対象ID・検証済みBinding・現在未登録・期待改訂。現在manager／administrator | 接続登録だけ。登録≠公開 |
| `unregisterRepository` | 既存Repository ID・現在登録状態・現在Exposure状態・期待改訂。現在manager／administrator | 同じ受理済み操作・採用改訂で対象登録と対応Exposureを除去し、両方の読戻し確認時だけ完了。他登録・Exposure、対象Repository本体・Product Dataを保持。登録時のBinding再検証を解除条件に転用しない。開始済み操作の取消完了は証明しない |
| `updateExposure` | 既存登録ID・現在登録／公開状態・変更範囲・期待改訂。manager／administrator | 内容認可・実アクセスとは独立した現在公開設定 |
| `issueCredential` | 現在administrator・既存userId・期待改訂 | 同一Process Workbenchのみ。新資格と一度のSecret。旧資格失効0 |
| `revokeCredential` | 現在administrator・exact Credential IDと既存userIdの結合・期待改訂 | 同一Process Workbenchのみ。対象だけ失効、対象外失効0・新発行0・Secret0・交換Recovery0 |
| `exchangeCredentials` | 現在administrator・期待改訂。指定Userの全旧有効資格、または自身を含む全員の全旧有効資格 | 指定は同じ既存userId、全員は指定既存administratorへ一資格を発行。同じRecoveryを保持。通常指定は事前表示のみ、通常全員は表示＋明示確認 |
| `exchangeCredentialsFromHost` | ログイン済みHost対話入口・期待改訂。指定User／全員交換の2種、双方表示＋明示確認 | 指定は対象全旧有効資格→同じ既存userId、全員は全旧有効資格→指定既存administratorへ一資格。同じRecovery。追加認証・OS昇格・回復専用Userなし |
| `readKeyExchangeState` | 現在Authorityと同じexact Recovery参照 | 非秘密の段階・既知結果。参照自体をAuthorityにせず、MCPには公開しない |
| `recordCredentialPresentation` | 信頼済み内部RootとcredentialId／issuanceOperationId／expectedRevision／target。confirmedは提示観測OwnerのpresentationOperationIdも要求 | not_attempted→unconfirmed、unconfirmed→confirmedだけを同Lock fresh照合して別出版する。前者は今回の提示Operation IDと採用改訂を返す。後者はそれをexact照合し、同状態再入場・失効・交換・別改訂・別提示を拒否。Secretと出力観測自体を受け取らず、MCP／HTTP公開操作ではない |

更新は操作・対象・期待改訂を受け、結果には状態、最初の失敗段階、期待／採用改訂、既知Effect、読戻し、解放結果を相関させる。`completed`／`blocked`／`unknown`は結果候補値で、具体Schemaは未固定。出版後故障は`blocked`や`unknown`でも既知Effectを保持し、Effect 0やRollbackへ戻さない。Profile管理Roleはmanager／administratorに確定した。現在認可の用途限定入口とMCP Consumerは局所実装候補へ接続中で、本番Launcher／Workbenchは未接続であり、CatalogをAM状態へ保存しない。

交換4組とも対象ID・表示名・失効範囲・発行先・保持情報を事前表示し、通常全員・Host指定・Host全員の3組だけ明示確認する。User ID・表示名・Role・Role内容権限・Repository登録・Product Dataは保持する。

### 2.1 初回Host設定の内部操作候補

意味・状態遷移は[AM詳細§4.1](01_Architecture.md#41-初回host設定のstateとsequence)に従う。以下は内部関数の候補で、外部公開API・MCP Tool・CLI引数・Source実装ではない。通常管理判定や既存administrator資格認証を初回へ適用せず、ログイン済みHostの明示操作と既存Root／Path検証を用いる。

| 操作候補 | 入力・判定 | 結果・禁止条件 |
|---|---|---|
| `readHostInitializationState` | 信頼されたHost入口・検証済みRoot。同じ保存Ownerの排他下で管理状態と進行記録を照合 | 未初期化／確認済み途中／既存／観測不能と非秘密な既知事実。単一File不在を未初期化にしない。未作成IDを推定しない |
| `initializeFromHost` | Host明示開始・表示名・確認した初期状態。排他下で双方未初期化を再照合 | 元試行相関の確定・読戻し後に最初のadministrator UUIDと同userId資格を生成し、Host端末へ一度提示する。提示≠初回完了。exact同鍵の限定接続確認と、その保存・読戻し・短命材料清掃・Lock終了後だけcompleted／通常Authorityへ進む。既存・途中・観測不能から新作成0 |
| `observeHostInitializationAttempt` | 確認済み元試行の非秘密参照・現在のHost Authority。参照自体は非Authority | 元試行と現在状態を再観測するだけ。発行／記録不明から新交換・新UUID・追加鍵・Secret再取得0。相関不能は停止 |

発行と結果記録が確定しHost提示または同鍵の限定接続確認だけ不明なら、作成済みadministratorへの既存`exchangeCredentialsFromHost`指定交換を別明示操作として選ぶ。初期化再実行・Secret取得APIを作らず、元試行と別交換を分離する。提示不明と提示確定後の接続未確認を混同しない。初回状態readにVerifier・salt・Secret・任意Pathを含めず、MCP／Remote Workbenchへ公開しない。

`readHostInitializationState`の局所実装は、同じ`access-management.lock`下で最新current／pending／replaceを観測し、完全v2と既知出版材料のexact処置・Lock終了後にだけ非Authorityの段階を返す。`fresh`はAM三入力の確認済み不存在だけで、旧入力不存在やHost初期化許可ではない。`in_progress`は保存済みattemptId／revisionと段階を持ち、User・資格IDは生成済み段階だけに含める。資格段階では歴史的初資格と最新確認対象を分け、presentationと交換有無を返すがtokenを返さず再表示を許可しない。completedは`existing`だけ、破損・partial・初回base材料・孤立replace・読取り／清掃／Lock終了不明は固定`unknown`だけとする。型と純粋投影は`initialization/host-state.ts`、物理処置は既存`state/file-store.ts`が所有する。

Host compositionは後続の実装で既存OS管理state Rootを準備・再検証し、旧`credential-registry/`と`credential-access-recovery/`の確認済み不存在を別に照合する。無関係なCROS所有物を未初期化判定へ混ぜない。旧Writer停止・旧入力清掃はフロントAIの切替／移行契約で確認し、旧Writerが稼働し得る未確認状態では初期化へ進まない。最新Sourceへ旧形式Parser、旧Writer用共通Lock、共有Process Registryや自動移行を追加しない。Root準備・旧入力観測・TTY提示・Host本番入口は本Readerの成立範囲ではない。

初回確認の論理Owner・完全限定Protocol・exact Bindingは§2.5、v2目標形状はSchema切替案へ具体化した。保存・読戻し・短命pending／材料とLock終了の実装・実境界は残る。現在の`authenticateNormalConnection`はcompletedを必要とするため初回へ流用しない。`authenticateCredential`の途中本人照合だけでも通常Authorityを与えない。Host明示交換後は新提示資格へ確認対象を結び直し、旧初資格・元発行の既知事実を新交換成功で上書きしない。v2目標形状は具体化済み、完全Parser・実状態移行・本番保存はOPEN。別Receipt・Session・Store・Lockは追加しない。どの必要条件も未確認・失敗・観測不能ならcompleted表示と通常Authorityは0。

### 初回保存段階とHost提示の局所接続 — 2026-10-13

`initializeFromHost`はPackage公開入口から信頼済み内部Host Consumerへ提供する。実処理は`initialization/initialize-from-host.ts`に置き、保存Ownerの責務を増やさない。入力は既存の検証済みRoot、表示名、明示開始、旧入力の同期読取り、Host所有TTYと取消Signal。Root作成・旧形式解析・旧Writer停止・MCP公開・通常鍵交換は含まない。旧Writer停止を済ませた切替条件下で、freshだけ生成前と相関保存Lock内の旧入力不存在確認を通す。correlated／user_storedは保存済み元試行で進め、credential_storedはSecret再取得・再表示を行わず、確認済み提示は接続待ち、他は既存明示交換への案内とする。既存・観測不能は新初期化しない。

新規資格の保存終了後、提示前unconfirmedの別出版・読戻し・清掃・Lock終了を確認する。TTY鍵行を単一writeへ渡し、false返却でも再送しない。callbackが来るまで取消・error・closeは失敗事実だけを固定し、完了やListener回収を主張しない。callback未着なら保留のまま。callback後はBufferを消去し、Nodeがcallbackの後に発行するerror通知のtickを処置して、当該error／close／abort Listenerだけを外す。stdoutをend／destroyしない。出力成功はサービス側の当該chunk処理で、人間閲覧ではない。取消を再確認し、非秘密exact Bindingでconfirmedを別出版する。保存失敗・取消・故障から再表示しない。JS stringの物理zeroizeは保証しない。

局所注入試験は実保存順・再入場・callback join・Listener回収を確認するが、実Host TTY・Root準備・CLI最終入口・Workbench本番接続・正式Local Itemの全成立を代替しない。これらは初回Host縦断の未完了範囲として維持する。

### Host Root準備と初回CLIの接続 — 2026-10-13

公開されたHost専用内部APIの`prepareHostInitializationRoot`が既存CROS Root入力とDomain Resolverからstate候補だけを選ぶ。Root構成はHostの信頼済み入力であり、Remote／MCPの任意Path要求を受ける一般作成APIではない。明示されたOS state baseが未作成の場合は、対象chain上の最も近い既存祖先を確認し、stateまでの不足chainだけ非再帰mkdirする。Linuxの既定HOMEは既存通常Directoryを要求する。各既存chainの非link・Directory・realpath一致を確認し、Rootのdev／inoはBigIntで比較する。EEXISTは再観測、その他の作成／検証故障は停止し、成功したexact mkdir集合を内部結果で保持する。最終実体と既存Root Capabilityを再検証してからreadyとする。readyは初期化Authorityではなく、作成済み集合も削除許可ではない。自動削除・ACL修復・rollbackは0。

Rootに結合した同期Observerは旧credential-registryとcredential-access-recoveryのmetadataだけを読む。lstat成功はfile／linkでも既知存在、ENOENTだけ不存在、EACCES・Root実体差等は観測不能へ分ける。旧本文をparse・採用せず、旧回復領域の存在を確認済み元試行にしない。freshの生成前と既存保存Lock内で同じObserverを使い、旧Writer停止はフロントAI切替前提であってAM Lockによる旧Writer排他を主張しない。

CLIの意味と対話所有は`initialization/host-command.ts`の`runHostAccessCommand`へ集約する。主要入口は`bin/access-management.ts`、配布入口は`template/tools/crdd-access-management.ts`で、双方とも同じPackage公開APIへ委譲する。npm startとbin定義から主要入口へ接続する。--help、未知／重複／位置引数、環境不足、未対応OS、非TTYはRoot準備・prompt・保存0。公式入口はqual-lab／crosと明示CROS_TRUST_DOMAIN_ID、OS標準領域だけを選ぶ。正規対話ではRoot準備と旧入力観測後、既存／不明／資格保存済みは入力を要求せず非秘密の次行動を案内する。必要な初回表示名だけ一回入力し、既存初回compositionへ渡す。readlineのEOF／SIGINT／入力・出力error／closeを取消へ結び、自身のinterface／Listenerをfinallyで回収する。stdin／stdoutをend／destroyしない。内部絶対Path集合と例外本文はCLIへ透過しない。

局所試験はRepository-localの模擬OS baseとTTY代役、実子Processのhelp／不正入力／非TTY拒否を使う。実Host TTY・旧Writer停止・通常鍵／Host交換・Workbench本番接続・初回ST/UAT全体は未成立で、旧CROS入口の撤去完了を意味しない。

### 2.2 初回状態の純粋判定 — 2026-10-11

`evaluateHostInitializationState`をPackage Rootから局所公開する候補を実装した。これは§2.1の物理read・初期化操作ではなく、保存Ownerが取得した観測分類と明示開始のBooleanから四状態と次の処置を返す純粋計算である。`canStart`は形式上の条件成立で、Host信頼、Root・排他、相関保存、UUID・鍵EffectのAuthorityではない。現在のSourceはこれらの実処置へ接続していない。

| 管理観測 | 進行試行の観測 | 判定と次の処置 |
|---|---|---|
| `uninitialized` | `absent` | `uninitialized`。明示開始trueだけ`canStart: true`／`start`、falseは`await_explicit_start` |
| `uninitialized`または`same_attempt` | `confirmed` | `in_progress`／`observe_attempt`。新規開始不可 |
| `existing` | `absent` | `existing`／`reject_initialization`。新規開始不可 |
| その他、未知、不正型、相関矛盾 | 任意 | `unknown`／`stop`。新規開始不可 |

`absent`は進行試行の確認済み不存在で、単一Fileの欠測ではない。`confirmed`は確認済みの進行試行だけを表し、過去の終了記録の存在を含めない。`same_attempt`は管理状態と同じ元試行の結合を呼出側が確認した分類であり、本関数がIdentityを証明するものではない。完了済みの初回記録を保持する場合、その履歴を進行試行へ転用せず、保存Ownerが現在の既存管理状態と進行試行の不存在を別に観測する。内部保存Owner・Schema・相関保存は局所接続済みで、旧入力の本番観測は未接続である。

局所UTは`RFD-UT-023`へ接続し、四管理観測×三試行観測×開始二値の24組と、不正値・暗黙変換なし・返却値非共有を確認する。候補試験の成功は正式Local Item評価や物理保存・Host入口の成立ではない。固定15Fileの契約・品質限定独立再レビューは両方Pass、全重大度の残指摘0。

### 2.3 通常User／Role管理4操作の局所接続 — 2026-10-12

`registerUser`、`updateUserName`、`changeUserRole`、`updateRoleContentAccess`をPackage Rootから専用公開する。共通の先頭入力は検証済みRoot、Bearer、期待改訂、受付operationId（UUID）。後続入力はそれぞれ表示名／予定Role、既存userId／新表示名、既存userId／変更前後Role、対象Role／明示workspaceIdsとする。Transport SchemaやMCP Toolの採用ではない。

意味判断は`management/user-role.ts`、既存Lockと出版は`state/file-store.ts`が所有する。循環依存と再export中継を避け、4公開関数は保存Ownerから純粋判断を呼ぶ。低水準`updateAccessManagementState`のcallbackを拒否やUUID生成へ転用せず、その契約を変更しない。4操作専用の私有処理で、同じ現在状態の資格・Role・対象・期待改訂を確認する。完了初期化だけを対象とし、変更前Roleで認可する。managerのadministrator表示名変更は許可し、administrator関与のRole／内容変更はadministratorだけ。最後のadministrator保持という未採用条件を追加しない。

登録だけ、固定36文字の非採用placeholderでnext／pendingの正確byte容量を予約してからUUIDを一回生成する。placeholderは保存・parse・結果へ使用せず、最終候補は完全parseと容量検査を通す。他3操作はUUIDを生成しない。容量と実出版のbyte構築は既存保存部品で共有する。

`UserRoleManagementResult`は、認証・管理許可成立前の固定`management_operation_rejected`と、認可後の今回保存観測を区別する。成功はoperationId、expectedRevision、revision、userId（内容設定ではnull）、publication: confirmed、cleanupConfirmed: trueだけ。認可後未完了は固定結果種別と最初の失敗、operationId、expectedRevision、observedRevision、今回publication、cleanupConfirmedを返す。Token・salt・Verifier・全Snapshot・内部Path・Lock回復参照は返さない。前操作pendingの処置は今回Effectへ帰属させず、今回更新0で停止する。出版確認後の清掃／解放不明は未完了のまま既知出版を保持し、自動再送・rollbackしない。

RFD-IT-021の4操作部分に6 Caseを接続し、三Role×対象三Role×4操作の36組、生成前容量拒否、通常拒否・現在Role・対象外不変、前操作材料と出版／清掃故障を実Filesystemで観測した。認可・対象・期待改訂確認後だけ先行材料を処置する。誤鍵・developer・改訂競合・禁止対象ではbase／next両材料のbyteを保持し、巨大入力は詳細走査前に拒否する。AM全41 Case・静的3軸成功、固定13ファイルの限定独立再レビューPass・残指摘0。通常管理全体、Repository／Exposure、公開ST／UAT、本番Consumer、191項目の正式評価は未成立である。

### 2.4 登録・公開範囲管理の実装接続方針 — 2026-10-12

3操作の専用入口を同じ保存Ownerへ接続する。登録は現在認証・固定管理許可・期待改訂・未登録の確認後だけ、Version Controlでexact Git Rootを検証し、Domainの固定File観測でCanonical manifestとPROJECT_CONTEXTのprojectId／repositoryId／repositoryRole一致を照合する。BindingはSchemaと同じ式から導出する。登録だけを保存し、Exposureは作らない。観測時点のBindingから永久アクセス保証を推定しない。

登録入力の受理上限はRoot 32,768 UTF-16 code unit、manifestとPROJECT_CONTEXTはそれぞれ1 MiBとする。これは登録入力の実装上限であり利用規模保証ではない。Rootは長さをPath処理前に拒否し、固定FileはDomain観測Ownerの同じdescriptorで最大+1 byteまで検査する。超過・伸縮・観測不能では出版せず、currentと先行材料を保持し、開いたdescriptorを解放する。未指定の既存Domain観測Consumerへこの上限を一律適用しない。

解除は登録と対応Exposureを同じcandidate／改訂で除き、旧Rootの存在・再検証を条件にしない。公開設定は登録済みIDの明示development／management集合だけを更新する。空集合も既存Schemaどおり公開範囲0として保持し、新しい禁止条件を増やさない。Role内容範囲・管理能力・実アクセスとは独立する。通常管理の認可前拒否では先行材料を保持し、許可済み先行材料の処置は今回更新0で停止する。

Source・Package公開入口・Symbol・試験台帳を接続し、既存保存ITへ4 Caseを追加した。AM全45 Case・静的3軸成功。登録と公開の分離、Identity不一致、認可前Root観測0、旧Root不成立時の登録解除、公開範囲0、出版後清掃不明、非認可時の先行材料保持と許可済み先行清掃を確認した。固定18ファイルの限定独立再レビューPass・全重大度の残指摘0。本番Consumer接続は未完了で、191項目の正式評価はNot Runを維持する。新しいStore・Lock・Registry・一般回復、旧CROS削除・実Host移行・Transport公開は本段階の対象外。

#### 2.4.1 通常管理の公開利用側への引渡し候補

通常管理の公開接続は[MCP詳細§3.3.1](../mcp-server/01_Architecture.md#331-非鍵管理toolの具体化候補)と[Workbench詳細§6.2.1](../workbench-server/01_Architecture.md#621-非鍵管理の接続候補)の候補へ渡す。Packageの四読取りDTOと七保存Resultは内部契約であり、通信契約へ無条件転記しない。公開読取りからBindingと種類識別を除き、操作名から必要な対象だけを投影する。四読取りの改訂はそれぞれ独立し、単一改訂の複合Snapshotを生成した保証はない。現在filter、公開範囲null／明示空、既知出版と清掃・最初の失敗の分離は保持する。Remote登録対象Rootの指定Authorityは人間判断待ちで、内部APIの絶対Root受理だけから公開採用を推定しない。Source・Store・Schema・Lock・鍵の公開境界はこの候補具体化では変更しない。

### 2.5 初回限定接続の具体契約

基準`5a8f6ce9`のSourceを照合した具体化である。初回設定そのものはHostだけが開始し、MCP／Workbenchは作成済み資格による限定接続だけを受ける。鍵の発行・交換・状態照会をMCPへ追加しない。初回接続成功は、完全な限定要求のサービス側受理と確認の保存確定を表し、相手による応答受領・画面閲覧の保証ではない。追加受領ボタン、ACK、Session、Store、Lockは作らない。

| 順序・Owner | 具体処理 | 成立条件と拒否 |
|---|---|---|
| AMの`resolveConnectionAuthentication` | 同じ既存Lock・同改訂で資格を照合し、通常接続または初回限定接続へ分類する | 初回候補は元attemptId・userId・最新confirmationCredentialId・revisionへ相関。通常認証と途中本人認証を二度呼んで組み合わせず、Lock外stage読取りをしない。候補は通常Authorityではない |
| MCPの限定Handler | HTTPのOrigin／Endpoint／POST／Header／容量／完全JSON／Header相関検査後、既存`server/discover`だけを完全検査する | 非null Request ID、exact method、閉じたparamsと`_meta`、既存Envelopeを検査する。`tools/list`／`tools/call`・他method・不正入力・開始前取消はAM更新0。通常Routingの依存やToolを初回Handlerへ渡さない |
| AMの`confirmInitialConnection` | signal再確認後、同じ保存LockでBearerと期待Bindingをfresh再照合し、初回completedを一回出版する | `credential_stored`、同attempt／user／最新資格／期待revision、資格有効、Host提示confirmed、未解決交換0が必要。確認保存・正確byte読戻し・pending／短命材料清掃・Lock終了まで成功した場合だけ非秘密の成功を返す |
| Surfaceの成功応答 | 確認の確定後に限定discover応答を返す | 応答前に通常内容・管理・鍵操作を実行しない。通常Authorityは次要求のfresh通常認証だけ。応答結果に元試行ID・User／資格ID・Root・Verifier・Secretを出さない |
| Workbenchの接続操作 | 現行UIの接続操作から同じ限定discover、次いでfreshな通常読取りへ進む | 同一Processも同じAM用途判定・確認契約を使う。初回完了表示は後続通常読取り成功後だけ。別の確認操作を利用者へ要求しない |

MCP-only初回は、CRDDの完全な`server/discover`を送るClientで成立させる。任意のMCP Clientがこの固有Protocolを使えるとは主張しない。Workbenchの現`/connection/action`は旧REST Portfolio取得であり、上表へのConsumer切替は未実装である。HTTP本文前のResolverは用途分類だけを行い、本文の妥当性を確認する前に初回状態を更新しない。

MCPの局所実装は、`createAccessMcpResolver`がAM用途判定からnormalとinitialのHandlerを分け、initialには`request/initial-connection.ts`の限定Handlerだけを構成する。完全discover検査と固定応答は副作用なしの`request/discover.ts`を通常Routeと共用し、通常Tool・内容・管理依存を限定Handlerへ渡さない。AM確認失敗は内部相関や理由を含めない固定`-32603`へ閉じる。既存HTTP Transportの順序は維持し、Content-Type／Accept／本文容量／JSON／Header相関の拒否前にもResolver認証の読取り・KDFと既存pending処置はあり得る。これらの拒否は初回確認出版0／通常Tool0であり、認証観測0や全Filesystem Effect 0ではない。公開Launcher・Workbench・実Host入口の切替は別に残る。

応答書込み失敗・切断が確認出版後なら、既知completedを保持しrollbackや新資格生成をしない。Clientは同鍵の次要求で現在状態を再観測できる。出版・読戻し・清掃・Lock終了が不明なら成功応答と当該要求の通常Authorityは0とし、既存pendingと元相関を保持する。次要求は既存の同相関再観測・清掃・Lock終了を確認するまで通常認証成功にしない。取消は保存開始前なら更新0、開始後は既存同期保存の終了を待ち、取消後の成功応答を止める。応答後に秘密を保持したまま`finish`で保存する経路は採らない。[Node.js HTTPのfinish仕様](https://nodejs.org/docs/latest-v24.x/api/http.html#event-finish_1)はOSへの送出引渡しであり、Client受領の証明ではない。

同時要求は同じ既存Lockで順序化する。同Bindingの再要求は一回の出版を再観測するだけで、追加資格・追加の業務Identityを作らない。初回completedへの出版では既存保存契約のoperationIdを一つ生成し、再観測では生成しない。既に同attempt／user／確認資格でcompletedなら、現在資格の有効性・未解決交換0・`current.revision === expectedRevision + 1`と短命材料・Lock終了をfreshに確認して限定成功を再観測する。未完了の更新には期待revisionの完全一致が必要であり、用途解決後のHost交換や別改訂では古い候補の更新を拒否する。表示・通信・保存の故障を通常の本人受領へ読み替えない。

内部保存の実装では、閉入力とSnapshot上の用途／確認条件を`credential/initial-connection.ts`、同LockのKDF・pending処置・物理出版を`state/file-store.ts`へ置く。`confirmInitialConnection`のAbortSignalは呼出し開始時のGateだけであり、開始前取消はRoot／KDF／保存0とする。同期保存開始後は終了まで進めて既知出版を返し、Transport Consumerが直後にSignalを再確認して取消後の成功応答を抑止する。AM単体結果からHTTP応答0や保存中のイベント観測を推定しない。新しいSession・ACK・Store・Lockは作らない。

反証対象は、不正Header／body／Envelope／ID／method、Tool呼出し、提示未確認、旧・失効・別User資格、attempt／user／資格／revision差、未解決交換、Lock／状態不明、二要求競合、交換競合、保存前／保存後取消、出版／読戻し／清掃／解放故障、成功保存後の応答喪失と次要求である。既存初回義務`RFD-IT-024`／`025`／`RFD-ST-026`／`RFD-UAT-027`へ具体観測を渡す。QA定義は伝播済みで、内部用途判定・確認保存のSourceは局所候補へ接続済み。本番Consumerは未接続、正式結果はNot Run。この具体設計5文書差分の契約・品質限定独立再レビューは文書だけのPass・全重大度0で、実装Ready・本番成立を意味しない。保存側の実測範囲は[変更計画](../../../99_Roadmap/Changes/CHG-000082/second-stage-plan.md#初回接続の用途判定と確認保存候補--2026-10-12)で区別する。

## 3. 内部状態と公開読取り

### 認証主体の局所接続 — 2026-10-12

`authenticateCredential(root, token)`をPackage Rootから専用公開する。既存保存Ownerの同じ短いLock区間でcurrent検査・pending照合・資格照合・現在User／Role投影を行い、解放確認後だけ本人Snapshotを返す。純粋解決は`credential/authentication.ts`が所有しPackage Rootへ公開しない。結果は本人のrevision、credentialId、userId、username、role、Role内容workspaceIdsだけで、Secret・salt・Verifier・他User・Root・Lock回復参照は含めない。内容範囲は管理実行許可・認可済みRepository・実アクセスではない。後続Effectは現在認可を取り直す。

RFD-IT-013の資格→現在User／Role部分とIT024の初回状態非更新を局所接続した。AM全35 Case・静的3軸成功、固定13ファイルの限定独立再レビューPass・残指摘0。失効・誤鍵・参照破損・pending不正・Lock解放不明は主体なしで拒否する。初回credential_storedを照合しても提示／初回限定接続確認／通常接続・completedへ更新しない。内容認可、管理実処置、本番認証Consumerは未接続。以下の認証未成立表示はこれらの全体・本番範囲を示し、今回の局所主体解決と区別する。

| 内部論理情報 | 同一管理改訂で保持する内容 |
|---|---|
| `users` | UUID、表示名、一つのRole |
| `roleContentAccess` | Role別の明示内容権限。固定管理分担を保存設定にしない |
| `credentials` | Credential ID、既存userId、Verifier・salt・状態。生Secretなし |
| `registeredRepositories` | 接続先Binding。Context本文・Portfolio結果はDomain Modelが所有 |
| `exposure` | 現在の公開範囲。登録一覧から暗黙生成しない |
| `initialization` | 初回管理状態、確認済み元試行相関、作成UUID、確認対象資格と元発行処置、結果記録／Host提示／限定接続確認の個別事実。非秘密。確認保存・読戻し・清掃・Lock終了後だけ完了へ進む。v2目標SchemaとHost交換後Bindingは切替案で具体化済み。実装・実状態移行はOPEN。交換Recoveryとは分離 |
| `unresolvedKeyExchanges` | exact Recovery、旧資格集合、既存発行先、段階と既知結果。非秘密 |

初回進行記録はProcess喪失後にも再観測する耐久的な論理事実で、出版前短命の`access-management.pending.json`そのものではない。単一現在Fileに含め、別Store・実行毎Directory・履歴列を追加しない。Schemaと相関baselineの保存・再入場は局所接続済み。Root準備・提示／初回限定接続確認／通常接続の後続段階・解消後整理は未完了。未解決参照を失わず有限化する条件は保存Gateで閉じる。

これらは内部候補キーであり、新たな正本Entityや汎用Registryではない。User・Role・資格の参照整合と交換結果を一つの採用改訂に結合する。遷移は期待改訂→次改訂で保存し、同じ改訂を異なる状態で上書きしない。

ExposureのRepository IDは既存登録を参照し、重複・孤立参照を拒否する。登録解除では同じ受理済み操作・採用改訂で対象登録と対応Exposureを除去する。事前の別Exposure解除は必須とせず、対象外登録・Exposureと対象Repository本体・Product Dataを保持する。両除去の読戻しを確認した場合だけ完了とし、片側残存・観測不能は完了にしない。両除去が確定しても開始済み操作の終了が未観測なら、その不明を別に保持し、取消成功・過去Effect 0・実資源終了を推定しない。新しい取消処置は追加しない。同一改訂の論理整合は確定方針であり、物理的な原子出版・排他の成立は§4で別途確認する。

公開readではVerifier・salt・Secret・内部Pathを除く。自己表示、権限内の他User参照、非認証拒否を別条件として検査する。破損・観測不能を空集合や「未登録」に畳まない。内容要求は現在Role・Exposure・実アクセスから解決し、Domain Modelへ許可済みRepository集合だけを渡す。

通常管理で応答が失われた場合、現在readの再取得を案内し、自動再更新は行わない。後続改訂があれば現在値だけで元要求の成功を証明できないため、「現在値取得」と「元要求完了」を区別し、相関不能は不明のまま保持する。通常管理用の新Receipt Storeは作らない。

### 3.1. 公開読取りの結果と情報境界

以下はPackage APIの候補Schemaであり、HTTP／MCP公開の採用やSource接続を意味しない。認証・現在認可・投影は§4の同じ保存Ownerの短い排他区間で一つの管理改訂から生成する。返却する`revision`は観測Snapshotの相関値で、更新Authority、元更新のReceipt、Repositoryの取得可能性の証明ではない。後続更新では現在認可・対象・期待改訂を取り直す。

| 結果field | 候補形状と条件 |
|---|---|
| `status` | `completed`または`unavailable`。Snapshot検査・認可・投影・排他解放を全て確認した場合だけ`completed` |
| `snapshot` | `completed`の場合だけ存在する操作別投影。`unavailable`には存在しない。空配列は確認済みの0件だけ |
| `reason` | `unavailable`の場合だけ、認証不成立、参照拒否、Lock取得不可、回収確認待ち、観測不明、解放不明を区別。認証・参照拒否では対象の不存在と非許可を区別する情報を返さない |

読取りは確認できたが解放が不明な場合、既知の読取事実は保存Owner内部に保持し、公開結果は`unavailable`・解放不明とする。読めたSnapshotを一般的な`value`や不完全な成功として返さない。raw Lock回復ID・Proof・Capability・内部Pathは外部結果へ含めず、exact回収は保存Ownerが処置する。公開失敗理由から非許可対象の存在・件数・名前を推定できる差を作らない。

`readCurrentAccess`の成功Snapshotは次の情報を分離する。

| field | 内容 | 主張しないこと |
|---|---|---|
| `revision` | 認証・現在認可・投影に使った管理改訂 | 元更新完了、後続要求の許可 |
| `user` | `userId`、表示専用`username`、現在の一つの`role` | 他ユーザーの存在・名前・件数、表示名によるIdentity／認可 |
| `managementOperations` | 9 Role分担行から導出する非Authorityの操作候補と適用対象制約。managerのRole変更はdeveloper／manager間、administrator対象は表示名変更のみ、鍵群はadministratorのみ、Profile管理はmanager／administrator | 対象非依存の実行許可、Role内容設定による管理権限変更、内容の自動閲覧 |
| `contentAccess` | 現在Roleの明示内容権限の投影 | Credential別追加権限。具体操作語彙は未固定のまま保持 |
| `permittedRepositories` | 内容権限と現在Exposureが許可する`repositoryId`／`workspaceIds`の集合 | 実体の存在・接続成功・取得可能性。実アクセスは内容取得時に別評価 |

操作名だけで対象可否を決めず、対象別`readManagementState`と実操作の現在認可で判定する。Package内部DTOをMCPのTool／Schema／一覧／dispatchや応答へ投影しない。操作候補の表示は実行AuthorityでもMCP公開の採用でもない。

本人読取りの具体化では、`managementOperations`を既存11認可要求種別と対象Roleの閉じた組合せから固定管理判定で絞る。初回`credential_stored`でも本人表示は可能だが、初回完了・通常接続・実操作許可には昇格しない。通常管理の完了済み初回条件は維持する。`permittedRepositories`はRole範囲とExposureの積集合が非空の登録だけを返し、Root・Binding・登録のみのRepositoryを含めない。認証後の短命材料照合はcurrentを変更せず、清掃確認後に同改訂から投影する。材料破損・清掃不明・Lock解放不明ではSnapshotを返さない。認証前の既存exact Lock回収は保存Ownerの安全処置で、資格認証やpending清掃の成立ではない。

本人読取り接続時のAM全48 Case・静的3軸成功、固定11ファイルの限定独立再レビューPassは履歴である。現在は以下の管理対象別読取りも局所接続した候補。実Repository内容認可・Surface本番接続は未完了で、§3.1全体の完成ではない。

`readManagementState`は要求された管理対象の種類を判別し、その種類に必要な現在参照許可だけを評価する。共通の全内部Snapshotや、全ユーザー一覧を全操作へ添付しない。

| 管理対象 | 成功投影の内容 | 除外する情報 |
|---|---|---|
| ユーザー | 許可された対象の`userId`／`username`／`role` | Credential情報、非許可対象の存在・件数 |
| Role内容設定 | 許可された対象Roleと明示内容権限 | 固定管理分担のON／OFF設定、他Roleの非許可設定 |
| Repository登録 | 許可された登録IDと接続管理に必要な非秘密表示 | 内部保存Path、Context本文。Bindingの具体表示Schemaは別途照合 |
| Exposure | 許可された登録IDと現在公開Workspace範囲 | 登録からの暗黙公開、Role内容権限の自動生成 |

各投影は`revision`と対象種類を持ち、他種類のfieldを混在させない。鍵一覧・発行結果・元発行Identity・交換参照は通常管理DTOへ入れず、鍵Ownerの許可された入口で別に具体化する。管理参照許可は内容閲覧許可ではなく、登録一覧は公開集合でもない。通常管理のMCP公開はこの設計から追加しない。

管理読取りの`kind`は`users`／`roleContentAccess`／`registeredRepositories`／`exposure`の4 literalに限定し、不正値はLock取得前に`management_state_read_rejected`で拒否する。完全状態・現在認証に続いて初回`completed`と対象種類の現在管理許可を確認し、その後だけ短命材料を清掃する。developer・初回未完了・参照不許可は同じ非開示拒否とする。ユーザー投影は表示名変更の対象Role判定で絞り、manager／administratorは三Roleを参照可。Role内容設定はmanagerがdeveloper／managerだけ、administratorが三Roleを参照可。Repository登録・Exposureはmanager／administratorだけ。

各Snapshotは共通`revision`／`kind`に、`users`なら`users`、`roleContentAccess`なら`roles`、登録／Exposureなら`repositories`だけを持つ。登録行は`repositoryId`／`bindingId`に限定し、Bindingは表示相関用の非AuthorityでRoot・接続成功・実アクセスを証明しない。Exposure行は全登録の順に`repositoryId`／`workspaceIds`を持つ。`null`は完全検査済み同改訂で対応Exposureレコードの不存在を確認した場合だけ、`[]`は明示的な公開範囲0、設定ありはその所有配列である。破損・観測不能を`null`へ畳まない。全行・配列・入れ子を複製・凍結し、種類外field・資格材料・内部Pathを含めない。

公開DTOは検査済み状態から所有済みの値として明示構築し、内部Snapshotの参照・共有配列・余分fieldを透過しない。返却後の内部変更で値を変えない。Proxy／accessor等を内部状態検査の代替にせず、Schemaの閉包と値の検査を経てから投影する。

4kindの管理読取りを既存保存OwnerとPackage Rootへ局所接続した。三Role×四対象の完全DTO、現在Role変更後の拒否、未設定と明示空Exposure、不正kindのI/O0、認証・認可前の材料保持、清掃／解放不明時の非開示を既存ITに3 Caseで接続した。AM全51 Case・静的3軸成功、固定11ファイルの限定独立レビューPass・全重大度残指摘0。MCP／Workbench本番入口・内容実アクセス認可・鍵管理は未完了、191項目正式Not Runを維持する。

反証は、自己表示へ他User情報を添付、古いRole認可と新改訂DTOの混合、管理許可から内容を公開、観測不能から空集合生成、解放不明の成功表示、後続改訂から元要求完了を推定、入れ子・余分field・エラー経由の秘密透過である。既存RFD-IT-013／RFD-ST-004、RFD-IT-021、RFD-ST-022、RFD-UAT-007へ接続し、Not Runを維持する。内容実アクセス認可・鍵読取り・初回全体・本番保存と利用側接続は未完了である。

### 3.3 内容要求の実Repository解決 — 2026-10-12

`resolveRepositoryAccess(root, token, repositoryId, workspaceId)`は同Processの信頼した内容Consumer向けの内部Package入口とする。新Session・Store・Lock・汎用認可Frameworkは作らない。primitive入力検査→既存Lock内current完全検査→現在資格／User／Role→初回completed→登録・Role内容範囲・Exposure→許可後pending処置→VC exact Root→登録Binding再照合→Domain固定manifest（最大1 MiB）・Repository ID一致→内部相関値→Lock解放確認の順である。Domain本文取得は解放後に行う。

未認証・未知ID・未登録・Role外・Exposure未設定／空／範囲外は同じ`repository_access_rejected`とし、対象Repository観測0・pending清掃0を保つ。許可後の材料不明では対象観測0、Root・Binding・manifestの欠測／不正／容量超過は固定未取得理由とする。Path・下位例外・資格材料を返さない。PROJECT_CONTEXTはアクセスAuthorityではなく、欠測・不正を内容Ownerの部分観測へ残す。

成功値は`revision`、`repositoryId`、`workspaceId`、`bindingId`、検査済み`manifest`と技術的`root`能力を相関する。技術的Root能力は認可証明・Session・次要求Tokenではなく、保存・cache・Transport応答化を禁止する。Consumerは今回受理した要求の固有lifecycleだけで直ちに消費し、別要求・retryではこの入口へ戻る。型による失効機構や現在権限の永久保証は主張しない。後続のRole／Exposure変更を開始済み要求の取消完了へ読み替えない。本番Consumerの再利用0とDomain搬送の確認が済むまで、resolver局所成立を全体内容認可の完成としない。

確認対象はRFD-IT-013の現在認可・実アクセス部分。誤鍵、未知ID、管理能力のみ、範囲外、pending異常、非exact Root、manifest欠測／不正／ID差／超過、解放不明、Context欠測、次要求の公開解除反映を反証する。署名E2E・本番Consumer・正式191項目評価は未成立のまま保持する。

### 3.4 同じ要求の許可Repository集合

`resolveRepositoryAccessCollection(root, token)`は既存の同じ管理Lock内で現在認証・初回完了を確認し、Role内容範囲とExposureの積集合から登録Repositoryを一度に選ぶ。Repositoryごとに一意な要素とし、許可された全`workspaceIds`を保持する。ID順に並べ、各対象の実Root・Binding・固定manifestを一回だけ検証する。認証前の対象観測・pending清掃は行わず、許可後の清掃・全対象観測・Lock解放が成立してから結果を返す。

成功結果の`managementRevision`は管理設定の改訂であり、Project Context本文の版を意味しない。要素は`repositoryId / workspaceIds / bindingId / manifest / root`だけであり、単数範囲や曖昧な本文revisionを付けない。現在認証と初回完了を確認した許可対象0件だけが成功空集合で、認証・清掃・実体・解放の不成立を空成功や部分成功へ畳まない。内部能力の要求限定使用・保存／cache／Transport公開禁止は3.3と同じである。

観測量は既存16 MiBの完全状態内の登録数に比例する。新しいLockや共有Stateは作らない。RFD-IT-013／019で範囲保持・一意性・各manifest一回観測・次要求再認可・失敗時集合非返却を局所確認する。本番Consumerの性能・lifecycle・本文搬送は別Gateであり、この入口だけで集約Capability完成を主張しない。

## 4. 物理保存の比較と未決条件

[既存Host管理Root](../domain-model/03_Repository_Storage.md#6-crosとの物理分離)を維持する。Package改名で`qual-lab/cros/<trust-domain-id>`を改名せず、秘密をRepositoryへ移さない。

| 候補 | 長所 | 弱点・処置 |
|---|---|---|
| 現行の改訂File積算 | 次改訂名への排他的hard linkと読戻しが既存Adapterにある | 無期限積算、User／Role・交換との一体整合不足。そのまま継承しない |
| 単一現在File（`access-management.json`候補） | 現在値と清掃対象が明瞭。小規模管理情報を一体読取りできる | 置換だけでは競合制御にならない。排他Owner・置換保証・容量条件の確認が必要 |
| 分割File＋同一改訂manifest | 大きい本体を分離できる | 部分出版、複数清掃、旧本体回収が複雑。現要求では優先しない |

単一現在Fileを第一候補とするが、物理保存方式は未採用。既存の改訂File CASを単一Fileへそのまま流用できない。既存保存部品の対象Root・協調Writer条件・故障時の意味を確認し、現在認可／期待改訂照合→出版→読戻し→解放を覆う排他Ownerを確定してから実装する。新Lock Frameworkは作らない。

保存手順候補は、Root検証→選定・適合確認した排他原語を取得→現在改訂・変更前認可再照合→短命pendingへ検査済み次状態を書く→出版→読戻し→排他解放→結果返却とする。pendingは確定前の短命Fileで、Recoveryの耐久正本ではない。既存hard-link CASとDomain保存のKernel排他を比較し、Root一致、同一Process／複数Writer、Owner死亡、取得／解放観測、pending残存、出版後Process喪失、Windows／Linuxの提供意味を確認して一方式だけを採用する。この確認前に既存原語の適合や排他成立を主張しない。具体File名、Process喪失時の所有確認・清掃、atomic replaceの実OS保証はOPEN。File flushから電源断保証を推定せず、Topic／Meetingの通常保存承認をAMへ流用しない。

### 4.1. 既存保存部品の照合結果 — 2026-10-11

単一現在Fileの候補を具体化するため、現Sourceを読取り、現在のPCで通常置換を局所実測した。これは物理保存方式の採用、実装着手条件の成立またはAM全体の検証結果ではない。

| 対象 | 確認できたこと | 適用条件・残件 |
|---|---|---|
| `resolveCrosRuntimeRoots` | Windowsはconfigとstateが同じRoot。Linuxは既定では別RootだがXDG設定により同じRootになり得る。Filesystemを検証しない | 現在状態のOwnerはstateとする候補。文字列解決だけから書込みCapabilityを生成しない |
| `createFilesystemStoreRoot`／Path解決 | 既存DirectoryをCapability化し、対象Pathの既存chainを検証する | Host Rootの初回作成は所有しない。準備前後の検証をAM Adapterへ閉じ、作成後の失敗をEffect 0と表示しない |
| `withFilesystemStoreLock` | 同じRoot・相対Lock Identityの協調Writerについて、同期callback全体をKernel排他へ閉じる | 現在read、認可・期待改訂、write、出版、read-backを同じcallbackに置く。非同期callbackや非協調Writerの保証へ広げない |
| Lock解放・回収 | 操作完了とcleanup不明を別に返す。Owner消失後もLock記録は残り、既存の不存在観測・exact回収が必要 | AM Adapterの次回更新入口から既存回収へ接続する候補。Lockの回復参照を鍵交換Recoveryへ転用しない。close故障等でもAM側の既知出版事実を保持する |
| `readStableBoundedFileSnapshot` | 上限付き読取りと実体同一性の確認を所有する | 書込み・置換・pending清掃の保証には使用しない |
| 旧Credential File Adapter | 改訂Fileへの排他的hard linkとbyte読戻しを行う | 改訂積算と単一現在File置換は別方式。旧試験の成功を新方式の競合・故障保証へ流用しない |

固定Path候補は、解決済みstate Root直下の`access-management.json`、`access-management.pending.json`、`access-management.lock`とする。保存だけのために子Directoryを追加しない。Lock部品が必要時に作る回収義務Fileは同部品が所有し、鍵交換記録と区別する。全Writerが同じ検証済みRootとLock Identityを使用する。Rootの初期準備、非秘密設定と秘密Verifierを含む状態の保護、旧保存先からの移行は別途接続する。

Windows `10.0.26200.0`・C: NTFS・Node `v24.19.0`で、同Directoryの短命Fileを`wx`作成→write→file fsync→close→`renameSync`で既存currentを置換→byte読戻しを100回実測し、全回の一致とpending不存在を確認した。試験はRepository-local `.crdd/tests/`内の自己生成領域だけを使用し、作業領域を回収した。§4.1の単独確認時点では、並行Reader、Process喪失、他Windows版／Filesystem、Linux、Directory entryの耐久性、電源断保証は未確認だった。競合・Process終了・並行読取りの追加局所結果は§4.2に示す。本番接続、他環境、電源断等は引き続き未確認であり、この数値をStore完成やatomicity全体の証明にしない。

§4.1の確認時点での次候補は、協調Writerの競合、旧／新の完全Snapshot読取り、出版前後のProcess喪失とpending照合、既存Lock回収の本番入口接続だった。§4.2の局所確認後も本番入口接続は残る。pendingは年齢で削除せず、基準／次改訂と現在byteの対応を照合し、旧交換の未解決事実を失わない。具体の再入場Schema、公開read中の回収状態の扱い、Linuxでの提供意味が未確定の間は保存Gate未成立を維持する。新Lock／Recovery Frameworkや電源断完全保証を追加しない。

### 4.2. 競合・Process終了・並行読取りの局所確認 — 2026-10-11

§4.1と同じPC・Windows `10.0.26200.0`・C: NTFS・Node `v24.19.0`で、自己生成領域と既存保存部品を使って次を確認した。新しいAM保存Adapter、公開Reader、秘密Store、Dockerには接続していない。

| 場面 | 実際の観測 | 証明しないこと |
|---|---|---|
| AのLock保持中にBが同じ期待改訂0で更新要求 | Bは`filesystem_store_lock_unavailable`、callback呼出し0。Aだけ改訂1を出版 | 全Writerの協調、公平性、同時取得の勝者 |
| A完了後にBが同じ期待改訂0で再要求 | callback内で現在改訂1を読み、改訂競合・write 0 | 初回Lock拒否と改訂競合を同じ理由に畳まない |
| pendingのfile fsync後に子Processが`exit(23)` | 現在改訂0と完全なpending改訂1が残る。再取得結果のexact回復IDから既存のOwner不存在観測・Lock回収が完了 | Lock回収だけではpending処置・状態回復が完成しない |
| rename直後に子Processが`exit(23)` | 現在改訂1、pending不存在。再取得結果のexact回復IDから既存Lock回収が完了 | 強制終了・電源断・Directory entry耐久性 |
| 上記2例の次更新 | 既知probeのbyteと改訂を照合し、前者のpendingだけ処置した後、次更新・読戻し・Lock cleanupが完了 | 本番の再入場・保持・清掃接続 |
| Lock外で`readStableBoundedFileSnapshot`を並行実行 | Writerのrenameが`EPERM`となる反例を2回観測。分類した実行は改訂41まで出版済み。次の置換がEPERMで不成立となり、pendingが残存。Reader成功は旧12回・新66回 | 正常な単独置換から並行Readerとの成立を推定しない。失敗から前41回の出版を取り消さない |
| Readerも同じRoot・Lockの同期callbackへ入れた対照 | Writerは同じcallback内の100置換を完了。Readerは旧2回・新2回、Lock取得不可61回、`recovery_required`1回 | 100版全ての読取り、本番公開readの成立、待機時間・公平性 |

全子Processの終了をjoinし、自己生成作業領域を回収した。試験用pendingの処置を、本番の削除Authorityや状態回復へ昇格しない。通常Writerのcleanup区間でも`recovery_required`を観測し得るため、それだけからOwner死亡・自動回収可能を推定しない。既存のexact ID→Owner不存在Proof→回収を維持し、Lockの回復参照を鍵交換Recoveryへ転用しない。

並行Readerと置換の組合せには実反例があるため、公開readも同じ保存Owner・Root・Lockで短い同期区間へ閉じる方式を候補とする。新しい排他Frameworkや無制限の再試行は追加しない。Lockを使うreadは短命Lock記録等のFilesystem Effectを持つので、AMの内部保存Ownerが取得・解放・不明を処置し、外部へraw Capability・Path・Lock回復Authorityを渡さない。取得不可、回収確認待ち、読取り不明は空集合・未登録・正常成功へ畳まず、現在値を取得できなかった結果として扱う。

この対照は候補選定用であり、公開Readerの結果型・利用側の再取得、認可境界、解放欠測、初回Root準備、本番pending再入場、Linux／他Windows版／Filesystemの接続確認は残る。既存RFD-IT-021等の反証面へ接続するが、Local ItemのNot RunをPassに変更しない。電源断完全保証、取消機構、公平性保証を新たな要求として追加しない。

### 4.3. 保存途中の再入場候補 — 2026-10-11

本節の未実装・未確定は候補時点の履歴である。現在は完全Schema・通常保存・初回correlated baselineのwx作成／読戻し／再入場が§4.6〜4.7で局所接続済み。正式項目評価・本番試験はNot Runで、Root準備・旧入力本番観測・提示／初回限定接続確認／通常接続・Consumerは未接続である。

既存の完全な現在状態がある通常保存について、出版前と出版後を区別する候補を次に固定する。新しいStore、Lock、操作別Directory、Receipt台帳を追加しない。これは保存方式の採用や実装着手条件の成立ではなく、§4.2の実反例を踏まえた具体化である。

| 保存物 | 内容・所有者 | 保持・保護 |
|---|---|---|
| `access-management.json` | AM保存Ownerの現在Snapshot。管理改訂と、その改訂を出版した非秘密の受付操作相関を一体で保持する候補 | 現在正本。未解決初回・交換の論理事実を含む。履歴Snapshotを積算しない |
| `access-management.pending.json` | 同じOwnerが準備した基準改訂・基準byteのSHA-256・次改訂・次byteのSHA-256・同じ受付操作相関・次Snapshotの正確なUTF-8内容 | 一件の短命出版材料。Verifierを含み得るのでcurrentと同じ秘密保護を要求する。生Secretなし。年齢だけで削除しない |
| `access-management.lock` | 既存保存部品の同一Root・Lock Identity | 既存Ownerの取得・解放・exact回収を利用。部品所有の回収義務を鍵交換記録へ混ぜない |

pendingの閉じたSchema、byte表現、上限と保護は実装前に固定する。SHA-256は読み取った正確なUTF-8 byteの照合値で、改訂、受付操作相関、完全Schema検査の代替でもAuthorityでもない。次改訂は基準改訂＋1とし、同じ改訂を別内容で再利用しない。次Snapshotに含む出版操作相関とpendingの相関が一致しなければ停止する。公開結果・ログ・正式EvidenceへSnapshot本文、Verifier、salt、内部Pathを搬送しない。

#### 通常保存の順序

1. 現在の検証済みstate Rootと既存Lockを使用し、全ReaderとWriterを同じ短い同期callbackへ閉じる。認証・現在認可・期待改訂もその中で再照合する。
2. 先行pendingがあれば下表で処置する。未解決のまま上書き、別操作の開始、自動再送をしない。
3. 次状態を完全検査し、pendingを排他的に作成、write、file flush、closeする。次状態のbyteと改訂・操作相関を照合する。
4. 同じDirectory内でcurrentへ置換し、currentの正確なbyteと完全Snapshotを読戻す。置換の要求発行だけを出版確定にしない。
5. pending不存在と所有handle終了、既存Lock解放を確認して返却する。読戻しで出版を確認しても解放が不明なら、既知出版を保持した未完了結果にする。

非協調Writerや管理領域の外部変更を保証対象に含めない。不一致・Root差替え・観測不能は拒否し、Lock内へ置くことだけで全OS・Filesystemの置換保証を成立させない。

#### 再入場の判定

以下は既存の完全検査済みcurrentと、同じRoot内の完全検査済みpendingがある場合だけ適用する。元のLock記録が残る場合は、既存部品でexact IdentityとOwner不存在を確認して回収した後、改めて同じLock下で読み直す。回収成功だけでは状態の出版やpending処置を証明しない。

| 現在の照合結果 | 処置候補 | 禁止する推定 |
|---|---|---|
| currentが基準改訂・基準byteと一致 | 通常7保存操作の保存材料に限定して未出版と分類し、対象pendingだけを削除・不存在確認する。currentの現在状態と、初回・鍵処置等の既存耐久進行記録は保持する。通常管理の元要求Receiptは新設せず、削除後に応答を失った元要求は不明のまま扱う。変更を自動再実行しない | pending一致から鍵未発行や初回再作成可を推定しない。初回・鍵処置由来のpendingはこの自動廃棄対象外 |
| currentが次改訂・次byte・同じ出版操作相関と一致 | 出版済み事実を保持し、読戻し・pending清掃・解放を確認する。元操作の保存結果だけを再観測し、新Effectを発行しない | 保存確認は一度提示の成功も初回限定接続確認も証明しない。通常本人受領は観測外。開始済み処理の取消を推定しない |
| currentがどちらにも一致しない、操作相関が異なる、検査・清掃・解放が不明 | 保持して停止。現在認可を含む新Effectは発行せず、既知出版と未確認範囲を別に返す | 自動merge、rollback、上書き、改訂再利用、空成功、過去Effect 0への丸め |
| current不在でpendingが存在、current検査不能、管理と進行の片側だけ不存在 | 初回へ戻さず、pending廃棄・追加作成なしで停止 | 双方未初期化、旧試行不存在、新UUID・鍵発行可能 |

pendingが存在しないこと自体は、元操作の完了や未試行の証明ではない。current上の改訂・出版相関・確認済み耐久進行記録から分かる事実だけを返す。partial／truncated、余分field、hash不一致、次Snapshot不正、複数材料、link／reparse、Path／Root不一致は、削除・出版・初期化せず観測不能として停止する。

通常管理のpending削除・不存在確認後から応答前にProcessを失った場合、現在状態の取得と元要求完了の再構成を分ける。相関を失った元要求は不明で、現在readから元要求完了・未実行・過去Effect 0を生成しない。既に確認できた出版事実は保持し、後続改訂からその事実を否定しない。遅延出版なしはpending削除だけでなく、旧Ownerの終了確認と同期callback・排他の終了条件を確認した場合だけ主張する。通常管理の永久Receiptや自動再更新を追加しない。

初回・鍵交換ではUUID／鍵Effect前の耐久相関、失効・発行・非秘密結果・提示結果の既知事実をcurrentで保持する。通常保存のbase一致廃棄をこれらへ一般化しない。初回Root準備・最初のcurrent出版、初回／鍵段階ごとのpending処置は未確定で、保存Gateに残す。初回限定接続の確認は提示と別に扱い、通常本人受領は観測しない。

#### 検証・採用の境界

既存RFD-IT-021へ通常保存のbase／next／unknown、Process終了前後、出版後cleanup不明、対象外不変、暗黙再送0を接続する。RFD-IT-024へ初回相関先行、UUID／鍵Effect前停止、current不在＋pending存在、二重作成0を接続する。実装・本番試験は未実行でNot Runを維持する。

通常保存と完全読戻し確認だけでは、電源断直前の失効・交換・Role／Exposure縮小が失われ、古いSchema適合Snapshotから旧鍵や旧アクセス権が再び受理される可能性を除外できない。これは未実測のリスク候補で、今回この現象が発生したという記録ではない。Topic／Meetingの通常保存判断をAMへ流用せず、弱い保証での採用推奨は撤回する。通常6操作にも権限変更が含まれ、単一Snapshotなので「通常CRUDだけ」の採用で鍵・認可の安全性を閉じない。

上段の採用推奨撤回は2026-10-11候補時の記録である。2026-10-12にQual-Labは[REQ-000041の保証範囲](../../../01_Discovery/Definitions/REQ-000041/requirement.md#保存保証の範囲--2026-10-12)として通常保存・読戻し確認までを採用し、電源断による直前更新喪失と旧鍵・旧権限の再受理リスクを明示的に受容した。この保証範囲の人間判断待ちは解消した。電源断後の最新改訂保持や旧鍵・旧権限の復活防止を今回の実装Gateに追加せず、新Recovery・耐久性の追加基盤・電源断試験を作らない。物理電源断以外の突然停止は未評価とする。

通常失効・現在認可、Process喪失時のbase／next／unknown再入場、改訂競合、破損・観測不能時の拒否、秘密非保存、Root／排他境界は維持する。受容したリスクを空成功、自動rollbackまたは旧値復活の正常仕様化へ読み替えない。単一File保存方式そのものの採用、Linux／他Windows版／Filesystem、生Secret非保存・salt／Verifier非公開のSource接続、容量、完全Schema／API、Root初回準備、最初の出版、鍵段階の確定条件と本番Consumerは未成立で、これらの実装Gateは維持する。Windows追加ACL検査・修復・専用Native接続は§4.4の人間判断によりGate外とする。

### 4.4. 保存データと整理単位の具体化候補 — 2026-10-12

以下の候補・未実装表示はSchema／保存実装前の記録であり、最新の局所接続範囲と残件は§4.6〜4.7を優先する。未生成IDの実Schemaはnull補完ではなく判別共用体の段階別fieldで表現する。

本節は既存Sourceとの照合から保存データ・処理順・清掃単位を具体化する。完全Schema、物理保存方式の採用または実装Readyを示さない。§4.1〜4.3の実測・再入場条件と、採用済み通常保存・読戻し保証を保持する。Windows固有の追加保護は[REQ-000041の対象外判断](../../../01_Discovery/Definitions/REQ-000041/requirement.md#windows固有の追加保護の対象外化--2026-10-12)に従い、前段のVerifier保護Gateから追加ACL検査・修復・専用Native接続を除く。

§4.1〜4.4の候補時点で未確定とした容量・内容範囲・Binding・初回／鍵保存順序は§4.5で具体化した。これらの旧OPEN表示は当時の候補履歴である。現在残るのは全判別Unionの機械Schema、公開API対応、状態組合せ検査、保存部品・Consumer実接続、Root／OS出版の実装確認、提示／初回限定接続確認観測と移行実行であり、全体保存Gate未成立は維持する。

#### 保存データの共通境界

| 保存対象 | 具体化する項目・検査 | 保存しないもの |
|---|---|---|
| 現在状態の包絡 | `contract`、`schemaRevision`、単調増加する安全整数`revision`、最後の出版操作の非秘密`operationId`と§3の7集合／状態。未知field、重複ID、参照先不在、改訂再利用を拒否 | 過去改訂の列、通常管理のReceipt一覧、Transport設定、Domain本文 |
| `users`の各要素 | `userId`はNode `randomUUID`によるUUID v4、`username`は表示専用文字列、`role`は固定3値。IDは不変、名前は認証・権限へ使わない | メール、Password、本人確認、複数Role、自己編集設定 |
| `credentials`の各要素 | `credentialId`、既存`userId`、`tokenVersion: 1`、`tokenSalt`、`tokenVerifier`、明示失効状態。Role／内容権限は保存せず現在Userから解決。資格IDを再利用しない | 生Secret、Bearer全文、期限、自動Rotation、Credential別権限 |
| 初回進行 | 元試行・作成userId・確認対象資格と元発行、相関保存・資格記録・Host提示・限定接続・確認保存の事実。既知と未確認を分離し、v2目標Schemaは切替案に従い、実装・実状態移行は未成立 | 試行ごとのFile、Secret、通常Receipt、交換Recoveryの代用、時刻だけの完了判定 |
| 未解決交換 | 元のexact Recovery、固定した失効対象ID集合、既存発行先userId、失効／発行／結果記録／提示結果の個別事実（本人受領は観測外） | 通常発行の不明を交換として格納、実行ログ、生Secret |

UUID版の選定は安定IDの生成方法の具体化であり、Userの意味や認可方式を変えない。`username`の入力制約、Role内容操作語彙、登録Bindingの全field、初回・交換の全判別Unionは完全Schema固定時に照合する。候補項目を`unknown`や余分field透過で仮実装しない。包絡のcontract文字列・schemaRevisionを含む新通信／保存契約は、SourceとConsumer切替時に一体で固定する。

#### 鍵の照合値

2026-10-12の局所候補では`credential/token-material.ts`へ生成・形式検査・照合だけを接続する。固定fixtureの既知vector、旧暗黙既定との一致、明示options、不正形式時のKDF／比較0を技術試験で確認する。保存、資格有効性、User／Role認可、一度提示の成功・初回限定接続確認、Host／Workbench本番接続をこの結果から推定しない。短命の内部生成結果だけが生鍵を持ち、通常公開DTOではない。

旧`cros/access/credential.ts`の方式を再利用候補とする。生成は12byteの資格ID、32byteのランダムSecret、16byteのランダムsalt。saltは32桁hex、Verifierは64桁hexとし、照合前に形式と長さを検査する。scryptは`N=16384`、`r=8`、`p=1`、出力32byte、`maxmem=33554432`を明示指定する候補で、永続SchemaをNodeの暗黙既定値へ依存させない。同長のbyteだけを`timingSafeEqual`で照合し、失敗は認証不成立へ閉じる。新KDFや秘密復元手段は追加しない。固定パラメータと旧方式の一致はSource移管時の比較試験で確認し、未実行のまま互換成立としない。

currentとpendingは共にVerifierを含む保護対象である。公開DTO、診断、ログ、Evidenceへsalt／Verifier／Secretを出さない。発行結果だけが短命の生Secretを所有し、一度の返却後やProcess喪失後に復元・再表示しない。

#### 初回Rootと最初の保存

1. 既存Resolverが導出したHost state Rootだけを候補にし、任意Pathを入力しない。Root不在と観測不能、既存の旧管理データと未初期化を分ける。
2. 明示Host初回設定だけが不足するDirectoryの準備を行う。既存Rootの自動権限修復や削除は行わない。作成済み／保護未確認の事実を保持し、準備後故障をEffect 0と表示しない。
3. 準備後に実体・非link・Root一致を再検証し、既存`createFilesystemStoreRoot`へ渡す。Windows固有のACL検査を開始条件にしない。文字列の解決やDirectory作成だけでCapability成立としない。
4. 全Reader／Writerが同じ`access-management.lock`と既存`withFilesystemStoreLock`を使う。同期区間内で旧管理入力、current、pending、初回進行を照合し、双方未初期化確定と明示開始の場合だけ元試行相関を最初に保存・読戻しする。
5. 相関の読戻し後だけUUID作成・同userIdへの鍵発行へ進む。各段階の記録確定前後の故障を分離する。current不在＋pending存在は§4.3に従い新初期化へ畳まず、再出版・追加UUID・追加鍵を自動実行しない。

最初のcurrentは既存値を置換しない出版が必要で、§4.7でwx排他作成を局所接続した。hard-link部品を新設しない。Root準備時の残存結果、提示／初回限定接続確認／通常接続の後続初回段階は未接続である。

旧Registry Adapterの`wx`／0600とNodeのDirectory modeだけではWindows ACL成立を保証しない。人間判断によりAM専用のWindows追加ACL検査・修復・Native保護接続は行わず、実装Gateから外す。AMは既存HostのOS管理Rootとアクセス制御へ依存するが、それを追加の保護保証とは表示しない。生Secret非保存とVerifier非公開は維持する。新一般ACL FrameworkやCoordinatorへの逆依存は追加せず、現在の実Host Root・権限も変更しない。この判断をPlatform Access、Provider Home、署名鍵等の保護へ一般化しない。

#### 増え続けない保存

| 対象 | 保持・整理 |
|---|---|
| current | 現在User／Role／資格／登録／Exposureと未解決処置だけ。同一Fileを次改訂へ置換し、改訂File列・一般履歴は作らない |
| 初回相関 | 初回は一件だけで、新初期化へ履歴追加しない。未解決中は保持。終了後に残す最小既存状態と整理時点は完全Schemaで固定する |
| 失効資格・終了交換 | 現在拒否と元処置の未解決参照を失わない範囲で次の明示更新時に整理する候補。失効資格の不存在は拒否であり、有効資格の復活ではない。未解決対象・参照中のIDは削除しない |
| pending | §4.3のbase／next／unknown照合後に所有対象だけ回収。年齢・容量・名前だけで削除しない |
| Lock／回収義務 | 既存排他Ownerがexact IdentityとOwner観測で処置。鍵交換記録に統合しない |

容量はSnapshot全体のbyte予算を第一候補とし、User数・資格数等へ根拠のない個別上限を一律増設しない。上限値と読取り・認証の扱いは運用規模と既存bounded Readerへ照合して固定する。未解決事実を容量対策で捨てない。完全Schema・上限・初回／鍵段階の処置・本番接続は残件であり、本節から保存Gate全体成立を主張しない。秘密非保存・非公開とRoot境界は維持するが、Windows追加保護の接続は残件に含めない。

### 4.5. 現在状態・容量・鍵保存の固定方針 — 2026-10-12

本節の「未実装」は契約固定時点の表示である。完全Schema・内部保存Owner・初回相関baseline出版はその後に局所接続した。提示／初回限定接続確認／通常接続・後続段階・本番Consumerは未接続で、保存Gate全体は未成立を維持する。

本節は§4.4の未確定事項を具体化する。内容権限は採用済みのWorkspace範囲を表し、操作単位の新しい権限設定を追加しない。保存・本番Consumerは未実装であり、以下は実装へ渡す契約であって実測結果ではない。

#### 現在状態の閉集合

| 対象 | 固定する内容 | 相関・拒否条件 |
|---|---|---|
| 包絡 | `contract: crdd-access-management/state`、`schemaRevision: 1`、`revision`、`operationId`と§3の7項目 | revisionは1以上の安全整数、次出版は厳密に+1。operationIdは非秘密のUUID v4。未知fieldを拒否 |
| User | `userId`、`username`、`role` | userIdはUUID v4。usernameはstring、UTF-16 code unit長256以下、Unicode code point数1〜128、trim前後が完全一致、Unicode Cc／Csを含まない表示名。入力をtrim・normalizeして採用しない。同名は許可しIDで識別。roleはdeveloper／manager／administratorのみ |
| Role内容範囲 | 固定3Roleそれぞれの`workspaceIds` | 値は`development`／`management`の重複なし集合。Role全3件を保持し、未知Role・未知Workspaceを拒否。管理の11認可要求種別は別の固定判定を使い、この集合から付与しない |
| 登録Repository | `repositoryId`、内部`repositoryRoot`、`bindingId` | repositoryIdはDomainのCanonical Identity、RootはVersion Controlで検証した絶対exact Root。bindingIdは既存のRepository ID＋正規化Root由来の結合値。Rootは公開しない。Context本文・内容Hash・Transport設定を保存しない |
| Exposure | `repositoryId`、`workspaceIds` | 登録済みIDだけ、同じ2Workspace語彙。登録解除では対応Exposureも同一改訂から除去。登録だけで公開せず、登録解除でRepository本体を削除しない |
| Credential | §4.4の資格情報、元発行処置と一度提示結果の非秘密相関。v2目標fieldは次の切替案に従い、Sourceと実状態移行は未成立 | 資格ID・元発行ID・userIdを相関。通常本人受領は観測外で記録しない。通常発行の不明を交換記録へ移さない。旧field集合は§5の現Source比較へ分離 |
| 初回進行 | 単一元試行、作成User、直近Host提示の確認対象資格、Host提示・限定接続・確認保存の個別事実 | 未確認はそのまま保持。保存・読戻し・短命材料清掃／Lock終了がすべて成立した場合だけcompleted／通常Authority。Host交換後Bindingとv2目標Schemaは次の切替案に具体化済み、Source・実状態移行は未成立。名前だけのstageから完了を推定しない |
| 未解決交換 | exact Recovery、操作ID、固定旧資格ID集合、既存発行先userId、失効・新資格保存・提示結果と提示未確認処置の個別事実 | 通常発行・初回・Lockの記録を混入しない。資格状態が失効へ変わっても固定旧IDと資格recordを保持し、未解決中は参照資格を整理しない。本人受領は観測せず、終了済み交換の配列を積算しない |

各集合のIDは一意で、User参照・登録参照を全件検査する。Administratorの初期内容範囲は空、DeveloperはDevelopment、ManagerはDevelopment＋Managementとする。管理権限、AI Profileの管理可否、AI依頼・Task・Git Push・候補採用等を内容Workspaceから暗黙許可しない。これらの既存Ownerによる操作判定を保持し、別の操作別設定を必要とする場合だけ上流判断へ戻す。

Repository利用時には登録したRoot・Repository Identityを再検証し、現在Role範囲、現在Exposure、実アクセスの積として解決する。Bindingは過去のRoot検証を永続保証するものではない。旧CredentialのworkspaceIdsをRoleへ自動変換せず、フロントAIの明示移行対応を必要とする。

#### 最小提示方式へのSchema切替案

次のSource／Consumer一体切替では`schemaRevision: 2`を目標とする。上表のrevision 1と§5の旧Parser形状は比較基準であり、新旧を同時受付する互換Readerは作らない。7項目・容量・通常保存・現在認可の契約は維持し、変更するfieldを次に限定する。

| 対象 | 新形状 | 相関・保持 |
|---|---|---|
| Credential | `delivery`を`presentation: not_attempted / unconfirmed / confirmed`へ変更。他の資格fieldは維持 | 一度提示の結果だけ。通常本人受領を保存しない。資格保存時not_attempted、Surface引渡し前unconfirmed、出力境界への引渡し観測後confirmedを別出版する |
| correlated／user_stored | 現行の段階別fieldを維持 | 未生成IDをnullで補わない |
| credential_stored | `stage / attemptId / userId / initialCredentialId / confirmationCredentialId` | 最初は両資格IDが同値。元初資格は元operationId＝attemptIdの歴史的発行参照。確認対象は同Userの最新有効資格で、提示confirmedを別に検査する |
| completed | `stage / attemptId / initialUserId / initialCredentialId / confirmationCredentialId / connection: confirmed` | 完了時の確認対象IDを同名で保持。旧receipt／normalConnection／deliveryの三重confirmedを廃止。Client応答受領のfieldを作らない |

一度提示は単調に進める。資格保存はnot_attempted。生SecretをSurfaceへ渡す前に、同資格のunconfirmedを耐久出版・読戻し・短命清掃・Lock終了まで確認する。その今回Ownerだけが一回提示し、既存保存からSecretを再取得しない。unconfirmed以後の中断・不明では再表示0、提示結果だけ不明なら既存の明示交換へ案内する。unconfirmedの保存自体が不明なら元発行相関を再観測し、新交換を開始しない。

Hostのconfirmedは、初回／交換用の対話TTY出力へ鍵行の全byteを一回渡し、write callback成功と、その観測までのstream error／取消なしを確認した結果とする。Workbenchは現在administratorの当該要求へ限定した短命HTTP応答の全byte出力finishと、その観測までのerror／取消なしを用いる。Browserは当該応答だけを一度表示し、再表示API・共有結果・永続Storageを作らない。両観測はサービス側の出力境界への引渡しであり、Client受領・DOM描画・人間閲覧・将来の通信成功ではない。実TTY／応答／画面の本番観測は未実装・未検証で、Source固定と実境界確認まで未成立とする。

confirmedを記録する遅延callbackは生Secretをcaptureせず、資格ID・元発行／提示operation相関・期待revision・検証済みRootの非秘密exact Bindingだけを保持する。再取得した既存Lock内で同資格が現在も同じunconfirmed対象かをfresh照合し、失効・交換・別改訂・別要求なら更新0。出力後の保存故障はunconfirmedと既知出力事実を区別して保持し、not_attemptedへ戻さない。これは事前unconfirmedで再表示を防ぐ提示観測の後保存であり、初回接続completedを応答後に保存する経路ではない。

提示状態の保存は、純粋な入力・対象判定を`credential/presentation.ts`、既存Lockと物理出版を`state/file-store.ts`へ分ける。開始成功で返した非秘密presentationOperationIdとrevisionを出力Ownerが保持し、観測後だけconfirmedを要求する。相関自体は出力の証明やAuthorityではない。未解決交換中は単一credential_storedのnewCredentialIdだけを対象とし、初回中はHost・同User・最新確認資格も照合する。prepared／revoked、旧資格・無関係資格、複数交換は拒否する。completedの歴史的確認IDは変更しない。実TTY／HTTPの観測・出力取消・管理認可・生Secretの短命所有は続くConsumer実装で接続する。

Hostの明示交換では、新資格の保存と確認対象ID更新を同改訂で行い、元attempt／user／initialCredentialIdを保持する。新資格のpresentationも上記順序で進める。旧初資格の失効・提示不明を新資格成功で上書きしない。初回未完了中は元初資格・最新確認対象・未解決交換が参照する資格を整理しない。終了後の歴史的参照と失効資格整理は既存条件に従う。

初回途中のSchemaは一administrator・Repository／Exposure 0を維持する。correlated／user_storedは未解決交換0、credential_storedだけ同Userへの単一Host交換を保持できる。preparedでは確認対象を有効な旧対象集合へ、revokedでは失効済み旧対象へ相関し有効資格0、新資格保存段階では新資格IDと確認対象IDを同Snapshotで一致させる。交換なしでは確認対象だけが有効である。失効途中の参照は保存可能な進行事実であって、認証・初回確認・通常Authorityではない。

completedの確認対象は初回接続成功時の歴史IDで、完了後の通常／Host交換では結替えない。元初資格が残る場合は同User・元attemptの発行結合だけを確認し、元の提示不明をconfirmedへ変換しない。確認対象資格が残る場合は同User・presentation confirmedを要求する。両資格の整理後も歴史IDは保持できる。未解決交換0は初回completedを出版する条件であり、completed後の既存鍵交換Snapshotを禁止する条件ではない。

v2の型・Parser、初回資格Writer、AMとMCPの試験fixtureは局所実装へ切替済み。固定8Pathの限定独立レビューPass・全重大度の残指摘0、AM64／MCP68 Case・各静的3軸成功。これは実Host移行・提示Writer・初回確認出版・本番入口の完成ではない。pending包絡は別contractのrevision 1を維持し、nextSnapshotだけをv2 Parserへ通す。

旧v1耐久状態の実在棚卸しと移行はOPEN。フロントAIが保持対象・元発行と未確認を確認し、必要なら既存の明示Host交換を使用する。旧delivery／receipt／normalConnectionから新版confirmedを自動生成せず、Sourceはv2だけを受ける。実状態の移行・秘密値の読取り・Host処置は今回行わない。全判別Union・相関のSource検査と既存試験追従、本番入口が成立するまでSchema切替済みとはしない。

#### 容量と整理の既存条件

- currentのUTF-8 byte上限は16 MiB（16,777,216 byte）。これは既存のdurable stateと同程度の割当制限であり、利用者数・Repository数の製品容量保証ではない。
- pendingはnextSnapshotのJSON objectと固定包絡を保存し、JSON文字列へ二重エンコードしない。nextSnapshot単体にcurrentと同じ上限を適用し、pending全体は17 MiB（17,825,792 byte）を上限とする。包絡に任意本文・ログ・秘密を追加しない。
- いずれもJSON parse前に既存bounded Readerでbyte上限を検査する。超過・破損・観測不能は空状態へ変換せずunavailableとする。
- 更新候補をメモリで構築しSchema・参照・UTF-8容量を検査してから出版する。超過時はその更新の保存・鍵生成・失効等を開始せず、現在状態を維持する。初回Root準備等の既に発行済みEffectまで0とは表示しない。
- 鍵処理は生成前に固定長ID・salt・Verifier等と進行記録の最大増分を予約計算する。未解決記録を書けない状態で失効・発行を先行しない。未解決事実を容量確保のために捨てない。
- 失効資格は未解決初回・交換・発行処置から参照されなくなった後、次の明示更新で整理できる。不存在資格は常に拒否し、資格IDを再利用しない。初回完了後は単一の元試行ID・最初のUser／資格ID・既知終了事実だけを保持する。一般履歴・通常Receipt・改訂File列は作らない。

#### 最初の出版と鍵段階

| 段階 | 保存順序 | Process喪失後の処置 |
|---|---|---|
| 初回の相関 | 同じLock下で未初期化を再照合し、revision 1の完全baseline（包絡、固定3Role初期範囲、空User／資格／登録／Exposure／交換集合、単一initialization元試行）を排他的に新規作成、通常Readerで完全読戻し確認。初回Effectとしては元試行だけを記録する | current不在＋pending存在は停止。既存currentを初回処理で置換しない。相関を確認できるまでUUID・資格生成0。欠損fieldを既定補完しない |
| 最初のUser | 相関確認後にUUIDを生成し、administratorを同じcurrentへ保存・読戻し | currentに記録された同じUserを再観測。追加Userを自動生成しない |
| 通常の資格発行 | 現在認可・対象・期待改訂・容量を先に検査し、ID・Secret・salt・VerifierをProcess内だけで生成。元発行operationIdを含む完全Credentialを一回の次Snapshotで出版・読戻し | 出版前喪失は永続Credential／Secret Effect 0だが元要求結果は不明のまま。出版後喪失は記録済み元発行IDで再観測。新Receipt配列・不完全Credential・自動再発行・交換への自動移行なし |
| 初回の資格発行 | 既に保存したinitialization元試行の下で容量検査し、完全Credentialと元発行ID・初回の資格保存事実を同じ改訂へ出版・読戻し | 既存初回相関を保持し、未記録生成物は復元・再表示しない。同元試行を再観測し、追加資格を自動生成しない |
| 鍵交換 | 固定対象集合・発行先・exact Recoveryを保存→旧資格失効の出版・読戻し→新資格の出版・読戻し | 各確定段階を保持し、未確認段階だけ再観測。通常管理のbase一致pending廃棄を適用しない |
| Secret一度提示 | 資格保存の読戻し・短命材料清掃・Lock終了後だけ、用途限定の短命応答で操作administrator画面またはHost端末へ一度提示。非秘密の提示結果だけ保持 | 本人受領は観測外。Secret復元・再表示・自動再発行をしない。初回は限定接続確認を別に扱い、別明示交換成功で旧Secret受領を確認済みにしない |
| 整理 | 既知出版・旧Owner終了・対象pending清掃・Lock解放を個別確認 | 不明なら同じ相関を保持。年齢・容量だけの削除や自動再実行なし |

初回の排他的作成は既存`wx`を使用し、通常出版は同じLock下のpending＋replaceとする。最初の書込み途中にProcessを失ったpartial currentは破損として停止し、未初期化へ戻さない。新しいhard-link出版部品は追加しない。保存・一度提示の確認を電源断保証や本人受領保証へ昇格しない。初回限定接続確認は別の成立条件とする。

この具体化で容量・内容範囲・Binding・処理順の方針は固定する。全判別Unionの機械Schema、公開APIとの対応、状態組合せ検査、既存Reader／Writerへの実接続と局所試験は次の実装単位で閉じる。Source、実Host Store、ACL、過去Evidenceは本節では変更しない。

### 4.6. 通常保存Adapterの具体化 — 2026-10-12

`state/file-store.ts`は既存Root Capabilityと既存Lockを用いる内部保存部品であり、認証・管理操作・Host初期化の公開入口ではない。通常保存、初回相関、User、初回資格保存は局所接続済み。`createInitialCredential`はcanonicalな同元試行のuser_storedから容量予約後に完全資格を一回生成・保存する。資格の元発行IDはattemptId、出版操作IDは別UUIDとする。生鍵は状態へ含めず、読戻しとLock解放が確認できた新規保存の内部結果だけへ返す。同元試行のcredential_stored再入場は資格IDのみ再観測し、tokenはnull、生成・再表示は0とする。Root作成、旧Store移行、Host提示・初回限定接続確認・確認保存／読戻し／清掃後の通常管理、認証、本番Consumerは未接続である。実Hostの管理状態は変更していない。

| 固定File | 役割・終了条件 |
|---|---|
| `access-management.json` | 完全な現在状態本体。16 MiB上限。改訂Fileを積算しない |
| `access-management.pending.json` | 基準改訂・基準Hash・次改訂・次Hash・元操作ID・処置種別・次Snapshot objectの閉じた包絡。17 MiB上限。出版の読戻しと材料清掃まで保持 |
| `access-management.replace.json` | pendingが所有する一件の短命出版byte。16 MiB上限。排他的作成→write→file flush→close→byte照合→currentへの置換。追加Store・履歴・Authorityではない |
| `access-management.lock` | 全Reader／Writerが共有する既存排他。回収義務は既存部品が所有し、鍵Recoveryと混ぜない |

serializerはObject keyをASCII辞書順、配列順を維持、空白なしJSON＋末尾LF一個のUTF-8とする。nextHashはこの正確byteから算出する。baseHashは実際に読んだcurrentの正確byteから算出する。pending包絡を状態本体へ上書きして照合材料を失う方式は採用しない。

同じRoot・Lockの同期区間内で現在状態を読む。通常更新のcallbackは現在認可を確認して次状態bytesを返す利用側の接続点で、保存部品自体は認可を生成しない。期待改訂＋1と別の操作IDを要求し、初回・資格・未解決交換・既存User IDは保持する。この通常更新入口で鍵や初回段階を変更しない。現在readは内部Snapshotで、Transportへ返すDTOではない。

callbackは同期の認可評価とメモリ内候補構築だけに限定する。Promise、外部I/O、鍵処置、別Store更新、利用者への応答を行わず、callback自身の外部・永続Effectは0とする。これが通常管理のbase一致pendingを破棄できる前提である。本番Consumerの接続Gateでも同条件を照合し、保存部品の型検査だけからEffect 0を推定しない。

| 再入場で観測した状態 | 処置 |
|---|---|
| pendingなし・replaceなし | 検査済みcurrentを読む。更新では現在改訂・候補を同じLock内で検査 |
| 完全pending、current=base、replaceなしまたは完全なnext byte | 通常管理由来で保持条件成立の場合だけreplace→pendingを清掃し不存在確認。元要求は不明のまま、新更新callbackを実行せず再取得を返す |
| 完全pending、current=next・操作ID・Hash一致 | 既知出版を保持し、完全なreplaceがあれば清掃、pending清掃・Lock解放を個別確認。一度提示の成功・初回限定接続確認は証明しない。通常本人受領は観測外 |
| 初回／鍵由来pendingのcurrent=base | 材料を保持して停止。通常更新の自動破棄へ一般化しない |
| replace単独、partial／Hash差、current不在／破損、双方不一致 | 保持停止。新初期化、再出版、自動merge、rollbackを行わない |

Lockのexact回復参照は保存Owner内部だけで扱い、既存Owner不存在観測・回収が確認できた場合だけ一回再取得する。生存Owner・観測不能は停止し、無限Retryしない。最初の保存失敗理由と後続Lock解放不明は別fieldへ保持し、確認済み出版を後続Failureで未保存へ戻さない。材料・Lockが残る失敗では`cleanupConfirmed: false`とし、保存完了と材料回収を混同しない。

局所ITはRFD-IT-021の保存部分へ接続する。通常認可・六操作・公開縦断の全体Passではない。電源断耐久性や非協調Writer対策は新設せず、採用済み保証範囲を維持する。

### 4.7. 初回相関保存の局所接続 — 2026-10-12

初回資格保存接続前の履歴: `initializeAccessManagementState`は既存の検証済みRootだけを受け、同じLock下で元試行の完全baselineを`wx`で排他的に作成し、正確byteと完全Schemaを読戻す。revision 1、operationIdとinitializationのattemptIdは同じ元試行UUID、段階は`correlated`、固定3Role初期範囲と全空集合だけを保存する。Root準備・User UUID生成・鍵・配送・本番Host入口は未接続である。

Lock取得・baseline構築・JSON化より前に、元試行の文字列型とUUID v4形式、明示開始true、観測callbackの関数型を検査する。不正runtime入力はgetter／toJSON・callback・Lock・writeを実行しない。

| 観測・入力 | 局所保存Ownerの処置 |
|---|---|
| 有効元試行・明示開始・current/pending/replace不存在 | Lock内で旧管理状態と進行記録を一回だけ観測し、双方未初期化の場合だけ排他的作成・読戻し |
| currentが同元試行の正確baseline | callback・write・User UUID・鍵Effect 0で既存相関を再読取り。`created: false`で新規作成と分離 |
| 別元試行、他段階／余剰状態、partial current、途中材料併存、欠測・観測不能 | 保持停止。置換・修復・削除・再初期化しない |
| 不正元試行・明示開始なし | callback 0、新規current作成0 |
| 作成要求後の失敗 | 出版未確認を保持。読戻し済み出版後のLock解放不明は既知出版と未完了を分離 |

旧観測callbackは同期read-onlyで、管理観測と進行観測のtupleを返す。Promise、外部／永続Effect、UUID・鍵、別Store更新、利用者応答を行わない。旧入力は同じLockで安定化するか、初回前に書込み不能な所有状態であることを本番Consumer接続Gateで確認する。別Lockで並行更新できる二つの読取りを同時点観測と主張しない。callback throw・不正tupleは作成0で停止する。

同元試行の完全currentはclose後・読戻し前のProcess喪失後にも再観測できる。write途中のpartial currentはそのまま保持停止し、元試行から内容を再生成して修復しない。排他は既存Lockと`wx`で、専用Receipt・履歴・Lock Frameworkを追加しない。内部結果はAuthorityではなく、初回全体完成・資格配送・Host認証を証明しない。

### 4.8 初回管理者の保存部分 — 2026-10-12

内部保存Ownerは`createInitialAdministrator`で保存済みの元試行相関へ最初の管理者を保存する。入力はprimitiveの元試行UUIDと表示名をLock前に検査する。現在byteがrevision1・operationId=attemptId・固定三Role・空の五集合を持つcanonical baselineと完全一致する場合だけ、固定長UUIDを用いた容量予約後にUser IDと別の出版操作IDを生成する。両IDは元試行IDとも相互にも異なる。

同じ既存Lock内で`initialization`種別のpending、短命replace、current置換、正確byte読戻し、材料清掃を行う。通常管理と共通化するのはこの物理保存手順だけであり、通常管理の認可callback・期待改訂・変更許可や初回の段階判定は統合しない。

revision2のcanonical `user_stored`へ同元試行で再入場した場合は保存済みUser IDと表示名を返す。別名の再要求でも名前変更・追加User・追加UUIDを行わない。初回種別のbase材料や部分材料は保持停止し、再出版しない。next一致の出版済み材料だけ清掃して同Userを再観測する。出版事実と清掃／Lock解放の成立は別に返す。

初回資格保存接続前の履歴: 局所試験はRFD-IT-024のUser保存部分に限る。AM全27 Case・静的3軸成功、固定10ファイルの限定独立再レビューPass・全重大度の残指摘0。初回Root準備、旧入力本番観測、鍵発行、配送、認証、本番Host、初回全体の成立を意味しない。

### 通常鍵発行・独立失効の保存接続 — 2026-10-13

純粋な入力・対象・現在認可の判定はcredentialの責務内へ置き、物理保存は既存state/file-storeのLock・current・pending・replace・読戻しを再利用する。通常管理の汎用更新は資格変更を禁止するため転用しない。初回completed・現在administrator・期待改訂・exact既存User／資格結合・未解決交換0を確認してから、既存pending処置と容量予約へ進む。認可・対象・改訂・材料・容量の不成立では乱数／KDF・新発行・新失効0。MCP公開・Host通常発行／独立失効・新Receipt・履歴・Store・Lockは追加しない。

発行はrequest operationIdを資格の元発行Identityとして保存し、Credential IDとは分離する。固定長の増分を容量予約後に一生成し、presentationはnot_attempted、既存資格は完全保持する。保存・読戻し・材料清掃・Lock解放を確認した新規出版だけが短命Secretを内部提示Ownerへ返す。再入場・出版後故障でSecretを復元・再生成せず、元発行Identityに結合した非秘密の現在事実を再観測する。これはWorkbenchでの実提示成立ではなく、提示前のunconfirmed保存と確認後のconfirmed保存は既存提示Ownerが別改訂で行う。

独立失効は未失効のexact Credential IDとuserIdだけを対象に、revokedと状態改訂・受付operationIdだけを更新する。資格自身の元発行Identity・presentation、他資格、User／Role／登録／初回歴史を保持し、自己資格や最後の有効administrator資格の失効へ追加禁止条件を設けない。既失効は同request IDでも固定拒否し、追加出版0。top operationIdには操作種別・対象がないため、ID一致と現在失効だけから元失効要求のcompletedを推定しない。認可済み読取りで示す現在失効は元要求の成功Receiptではない。失効後の遅延提示通知は既存fresh照合で更新0、有効化0とする。通常発行・独立失効は交換Recoveryを作らない。

専用`readCredentialIssuance`は同Processの現在administratorへ、元発行operationIdとuserIdでexactに選んだ現在資格recordだけを投影する。通常管理read四kindやMCP Toolを増やさない。形式検査→同Lock current完全検査→初回completed→現在認証・administrator→対象相関→既存材料処置の順とし、材料処置がnone以外の要求はfact0、次要求でfreshに再照合する。Lock解放確認後だけ改訂・資格ID・User ID・元発行ID・presentation・revokedを返し、salt／Verifier／Secret・内部Path・他資格・Recoveryは返さない。record不在・観測／清掃／解放不明は固定未取得であり、未発行確定・元要求失敗・削除済みを推定しない。revokedは現在事実だけで、元失効要求completedを証明しない。Readerと本番利用側の接続は段階的に検証し、Source追加だけで成立としない。

## 5. 鍵交換の段階と終了

### 四経路の準備候補の責務配置 — 2026-10-13

`credential/key-exchange.ts`の`prepareKeyExchange`は同Lock内の完全状態から、現在入口・Workbench管理者資格・期待改訂・既存発行先・範囲・表示済み旧資格集合・必要な明示確認を照合する。表示内容そのものはConsumerが所有し、ID集合や確認値だけを閲覧・認証の証拠にしない。Workbench指定は追加確認なし、Workbench全員とHost2種は確認必須。Hostは信頼済み内部入口だけで、鍵を要求しない。初回途中は同UserのHost指定だけ、completed後の歴史IDは不変。旧集合0件を拒否せず、現出版・初回・元発行IDの再利用と未解決交換のある新開始を拒否する。

成功は次改訂のprepared候補だけで、資格・初回・登録・公開を変更しない。開始時にはprepared・revoked・credential_stored・提示前unconfirmed・提示後confirmed・未解決record整理の6出版分を確保し、初回途中のHost指定は限定接続後completed出版の1改訂を追加予約する。出版を先行実行する予約ではなく、正常経路が上限で必ず停止する開始を拒否する条件である。保存・失効・乱数生成・提示・Root検証・再入場・record整理を実行せず、Package Rootへ未接続の内部関数である。候補のParser受理を交換本体や四経路本番完成へ昇格しない。次に既存file-store・提示Owner・公開Consumerへ接続する。

### 交換本体の三出版の接続候補 — 2026-10-13

`exchangeCredentials`と`exchangeCredentialsFromHost`は同Process内部Consumer向けにPackage Rootから提供する。資格責務は現在認可・表示集合検査・exact再入場・段階候補を所有し、既存file-storeがLock・完全current・三出版を所有する。開始時の現在Authorityと操作条件を先行材料処置より前に検査するため、拒否Actorは既存pending／replaceを処置しない。一度admitした同Lock要求だけは、自己／全員失効後も旧Bearer再認証なしで進める。admissionは保存せず、次要求では現在別administratorまたは既存信頼Hostを再照合する。WorkbenchはWorkbench起点だけ、Host継続は起点entryを書換えず確認を再適用する。

prepared出版・読戻し・材料清掃確認後だけ固定旧集合を失効し、revokedを別改訂へ保存する。その確定後だけ固定長placeholderで新資格保存の容量を予約し、一回の資格材料生成と完全Parser確認からcredential_storedを別出版する。各成功後はcurrentを読み直す。初回途中のHost指定では新資格とconfirmationCredentialIdを同改訂へ置き、元初資格・試行を保持する。通常6／初回7改訂の予約と途中段階の残り余裕を照合する。

coreのcompletedは資格保存・読戻し・短命材料清掃・Lock解放までの結果であり、提示・record終了ではない。新規生成保存の当該要求だけが短命tokenを返し、stored再入場はtoken null・生成0。未解決recordとpresentation not_attemptedは保持し、提示前unconfirmedと提示観測、確認済みrecord整理または別の明示交換への引継ぎは後続Ownerへ残す。失敗結果は生鍵・Snapshot・内部Pathを含めず、固定firstFailure・secondaryFailure、最後の確認段階、出版・清掃状態を分離する。previous参照を省略した通常新規開始ではprepared耐久確定前の三値をnull／null／not_startedとする。引継ぎ開始では旧recordの回復参照・操作・段階を保持し、新prepared耐久確定後に新recordの三値へ同時切替する。入力operationIdや未確認pendingから耐久Recovery成立を推定しない。

current=nextの既知材料を処置した要求は停止し、次fresh要求だけ保存済み段階から継続する。credential由来current=baseは保持停止し、再出版・廃棄・再生成・新交換をしない。資格生成前の拒否、三出版のprepare／rename／読戻し／清掃故障、主FailureとLock解放不明、実Process喪失・競合は局所試験で検証する。本番Host／Workbench接続・実提示・未解決record整理・正式Local Item全体は未成立で、旧REST撤去の根拠へ流用しない。

### 非秘密の交換状態確認と終了方針 — 2026-10-13

`readKeyExchangeState`と`readKeyExchangeStateFromHost`は、元exact交換参照の現在状態だけを返す内部入口とする。完全current・現在administratorまたは信頼Host・対象相関を同じ既存Lock内で確認してから材料を処置する。材料を処置した要求は事実を返さず、次のfresh要求で再照合する。観測・清掃・Lock解放が不明なら固定未取得とし、不在を終了済みまたは未発行へ読み替えない。初回途中は同UserのHost指定交換だけを観測できる。通常WorkbenchはHost起点のrecordも観測できるが、観測は継続許可ではない。

投影は改訂・元交換参照・操作・起点入口・範囲・発行先・旧資格ID集合・現在段階の閉集合とし、新資格保存段階だけ新資格IDと提示状態を加える。秘密値・salt・Verifier・内部Path・対象外資格を返さず、提示・生成・失効・record除去を行わない。

終了処置は提示confirmedの場合だけ、現在認可・期待改訂・exact record・新資格と全旧失効を再照合し、一出版で当該recordを除去する。これは本人受領の保証ではない。not_attempted／unconfirmedを、秘密破棄の自己申告だけで除去する方針は採用しない。これらは人間の明示する別交換で、既存交換入口へ用途限定の`previousRecoveryId`を渡し、旧stored recordを新prepared recordへ一出版で置換する。新しい旧資格集合には前交換の新資格を必ず含める。指定交換は同発行先、全員交換は既存administratorを発行先とし、現在認可・表示・確認・改訂余裕を再評価する。初回途中は同UserのHost指定だけを許す。参照省略時の既存開始条件は変えない。

Process喪失やtoken nullは物理的な秘密消去の証明ではなく、再取得・再表示をしない論理上の処置だけを表す。新しい状態・破棄証明・Lock・回復台帳を追加しない。Readerの局所実装と終了方針を区別し、終了処理・提示Owner・本番Consumerの実装完了は別途検証する。

別交換の失敗結果は今回の要求operationIdと、最後に耐久確認したrecordの`recoveryId / lastConfirmedOperationId / lastConfirmedStage`を分ける。新prepared確定前は旧recordの三値を保持し、確定後に新recordへ同時切替する。出版前の通常新規要求は三値をnull／null／not_startedとする。これは最後の確認事実で、先行材料処置後の現在状態や今回要求の成功保証ではない。成功・認可前拒否の結果形状は変えない。

引継ぎ後の再送では同new operationの既存段階を優先する。previous参照を指定した再送は、新recordの固定旧集合内にある資格の元operationと参照がexact一致し、その資格が提示未確認でexact一件であることを追加照合する。段階ごとの失効状態は完全Parserへ照合し、別参照・対象外資格・提示confirmed・相関欠測を拒否する。省略時の既存継続条件は変えない。

確認済み整理の内部入口は`finishKeyExchange`と`finishKeyExchangeFromHost`とする。純粋候補は資格責務、認可先行・一出版・主失敗と解放不明の分離は既存保存Ownerへ置く。終了操作は新UUIDとし、初回・現出版・資格発行・元交換との衝突を拒否する。record除去出版後の応答喪失で、次要求のrecord不在をcompletedへ再構成しない。残ったcurrent=next材料の処置は既存保存Owner専用の内部状態Readerで可能だが、公開ActorへそのRoot AuthorityやSnapshotを渡さず、清掃成功を元終了要求の成功保証にしない。未確認recordはこの入口で除去しない。

### Workbench資格管理の非秘密一覧 — 2026-10-13

`readCredentialAdministrationState`は既存のAM保存Ownerが一Lock・一改訂で処理する。形式検査→完全current→現在認証・初回completed・administrator→投影候補→既知材料処置→Lock解放の順とし、材料を処置した要求はSnapshotを返さず次fresh取得へ分ける。観測／清掃／解放不明を空一覧へ変換しない。

返却値はrevision・actorUserId、UserのuserId／username／role、資格のcredentialId／userId／issuanceOperationId／presentation／revoked、既存交換の非秘密相関一件またはnullに限定する。元発行IDからSecretを取得できず、交換nullは現在recordなしという意味だけで、過去完了や未発行の証明ではない。資格材料・Root・内容権限・Exposure・Repository Bindingを含めない。純粋投影は既存credential/management.ts、物理読取りはstate/file-store.tsが所有し、readManagementState四kind・Store・Lock・履歴を増やさない。Workbenchの同Process接続・専用POSTの具体契約は[Workbench詳細§6.1.1](../workbench-server/01_Architecture.md#611-同process管理postの具体契約)に置く。局所注入での実HTTP候補と公開Launcher／実Browser成立を区別し、Reader局所成功だけで上位完成を主張しない。

### Host交換の提示Consumerの責務配置 — 2026-10-13

`credential/present-key-to-terminal.ts`はNode TTYへの一write・callbackと先行故障通知のjoin・自身のListener回収だけを所有する。初回設定と`credential/exchange-from-host.ts`の二つの具体Consumerが内部importし、Package RootやMCPへ共通Writerを公開しない。保存・認可・対象選択を同Writerへ集約しない。Bufferの処置と論理上の短命参照を維持するが、JS stringの物理zeroizeは保証しない。

Host交換compositionは、対象表示と確認を終えた呼出側の所有入力から既存交換保存→提示前unconfirmed→一度出力→提示confirmed→確認済み終了を呼ぶ。交換用と終了用UUIDは別に保持し、各段階の直前確定revisionを次へ渡す。stored再入場のtoken nullは再表示せず、fresh現在観測のconfirmedだけ終了する。未確認は別明示交換を必要とする。保存後取消・出力故障・終了不明では交換元相関・最後の確認段階・出版／清掃・主副Failureを非秘密に保持し、保存済みEffectを取消前へ戻さない。対話CLIの引数、対象選択、影響表示と確認はHost入口が所有し、このcompositionのIT成功だけで実Host TTY／CLI全体成立を主張しない。

Host CLIは`--exchange-user <User UUID>`と`--exchange-all <発行先administrator UUID>`を提供する。現在状態から対象・失効する資格集合を表示し、`yes`の入力後だけ操作UUIDを生成する。確認待ちの間に改訂・Role・資格集合が変わった場合は保存Ownerが拒否し、自動再試行しない。初回途中は同じ初回Userへの指定交換だけを許す。prepared／revokedは元の範囲・発行先・操作UUIDを継続し、stored未確認は明示した別交換へ引き継ぐ。提示確認済みの前記録がある場合は元対象を表示してその記録だけ終了し、今回指定した新交換は未実行と案内する。材料整理を行った観測要求は古いSnapshotから交換せず、再実行を案内する。OSログイン主体をAMの発行先Userと同一視しない。鍵管理はMCPへ公開しない。

### 純粋Schema検査への具体化 — 2026-10-12

#### 現Source比較・移行対象（基準07d21331）

この区分は実装済みParserのfield・組合せと局所試験の比較記録であり、最小提示方式の目標Schemaではない。以下の技術検査・旧field集合はSource変更前の再検証入力として保持する。現行目標の論理事実は§4.5と次の「現行目標と移行義務」が所有する。

機械入力はraw `Uint8Array`とし、16 MiB検査→strict UTF-8 decode→JSON parse→閉集合・参照・段階相関検査の順に処理する。成功値は入力から新しく所有したSnapshotであり、Root実在・Lock・認可・保存・配送の確認ではない。未知fieldを落として受理する変換は行わない。

現Source比較入力（基準`07d21331`）: 初回は`correlated`／`user_stored`／`credential_stored`／`completed`を持ち、資格recordの`delivery`、初回途中の`receipt`／`normalConnection`、completedの3 confirmedを保存する。初回途中は元資格のoperationId＝attemptIdを要求する。この形状は最小提示契約の目標Schemaではなく移行対象であり、別々の受領操作を要求する根拠へ使わない。通常は提示だけで本人受領を記録せず、初回だけexact限定接続の成功を受領・接続確認とする。v2目標形状・初期資格の歴史IDとHost交換後の確認対象Bindingは本書のSchema切替案へ具体化済みし、今回Sourceや保存データは変更しない。

交換は`prepared`／`revoked`／`credential_stored`を保存段階とし、entry（workbench／host）、scope（targeted／all）、recipientUserId、oldCredentialIds、operationIdを固定する。recoveryIdは`access-management.key-exchange.<operationId>`で結合し、参照そのものをAuthorityにしない。newCredentialIdは資格保存後だけ存在する。旧資格は未解決中ずっと現在参照とし、失効段階以後はrevokedを要求する。新資格は発行先・元operationIdへ結合し、配送の未解決はその資格deliveryから読む。交換間で同じ旧対象・元操作・新資格を重複所有しない。Root／実アクセス・現在Authority・段階の遷移可能性は保存Adapterの別検査に残す。

純粋検査はRFD-UT-028へ接続し、既存管理判定・初回観測判定のUTへ流用しない。これは保存Adapter・公開API・初回全体の完成ではない。

交換のpreparedは固定旧ID集合と対象範囲の現在有効資格集合の完全一致を検査する。双方0件も一致として許可し、最後の資格失効後のHost交換を塞がない。revokedは対象範囲の有効資格0、credential_storedは新資格だけが有効であることを検査する。allの発行先は全段階で既存administrator。completed初回の資格recordが現在残る場合はUser・元発行結合とdelivery confirmedを照合し、整理済みなら歴史IDだけを保持する。

#### 現行目標と移行義務

失効前にexact Recovery・旧対象集合・既存発行先を固定し、失効・発行・結果記録を単調に保存する。通常は用途限定・短命なbackend応答から操作administrator画面へ一度提示し、Host交換・初回はHost端末へ一度提示する。対象本人の引渡し・受領は製品外で観測せず、通常Receiptや追加受領操作を作らない。初回だけexact同鍵限定接続の成功を受領・接続確認として、その保存・読戻し・短命材料清掃・Lock終了後にcompletedと通常Authorityへ進む。未確認・失敗・観測不能なら双方0。KDF一致・callback完了・TCP／HTTP到達だけで成功にしない。

移行設計では、旧field集合から目標の論理事実への対応、初回の歴史的資格と直近提示の確認対象Binding、Host明示交換後の安全な結び直し、具体Protocol／Owner／Schemaを閉じる。旧観測値を本人受領や初回接続成功へ自動変換せず、既知の元発行・改訂・相関と未確認を保持する。Source／Test／Consumerを同じ候補で切り替えて再検証する。初回確認から通常Authorityを先行発行せず、新Store・Session・Receipt・Lockや互換Readerは作らない。提示故障から確定発行を取り消さない。

生Secretは保存・再表示しない。発行後のProcess／応答喪失は、次の3分岐で処置する。意味の正本は[確定BHV-000012](../../../05_SPEC/Details/BHV-000012/behavior.md)の「登録解除と発行・受け渡しの確定条件」で、物理保存・公開read・提示結果観測の具体化は未完了である。

| 現在確認できる状態 | 処置 | 保持・禁止条件 |
|---|---|---|
| 発行または結果記録が不明 | Credential IDとは別の非秘密な元発行Identityと既知事実で現在再観測し、新交換を開始しない | 交換由来だけ元のexact Recoveryを保持。通常発行へ交換Recoveryを新設せず、`unresolvedKeyExchanges`へ通常発行不明を格納しない。既知の確定事実を不明へ戻さない |
| 発行・結果記録が確定し、提示／初回限定接続確認だけ未確認 | 「発行済み・受け渡し未確認」と表示し、現在許可されたadministratorが既存の指定／全員交換を明示的な別操作として選ぶ | 秘密再表示・保存・自動再発行なし。新交換は別Operation／別Recovery、各交換内だけ同じexact Recovery。旧事実・元発行Identityを保持 |
| 現在administratorとして接続できない | 既存のログイン済みHost交換入口へ案内する | Workbench認可を迂回せず、Hostへ通常発行・独立失効・追加認証・新Recovery機構を追加しない |

別交換の指定操作は先に発行した鍵を含む対象ユーザーの全旧有効資格を失効し、同じ既存userIdへ新資格を発行して他ユーザーの鍵を保持する。全員操作は先の鍵を含む全旧有効資格を失効し、指定既存administratorへ一資格を発行し、他ユーザーは通常再発行・再配布へ戻る。現在対象集合・認可・4組の事前表示・3組の明示確認を再適用する。遅延した旧応答で失効済み鍵を利用可能と表示しない。新交換成功は旧Secret受領・rollback・開始済み取消完了の証明ではない。

未解決交換は期限・容量だけで除去しない。`unresolvedKeyExchanges`から外す条件は、交換処理の終了と提示未確認への処置を別に確定できること。本人受領は要求・記録せず、別交換の成功を旧Secret受領確認に転用しない。上限到達時は新しいEffect前に停止する。§4.5に従い一般履歴・通常Receiptは保存せず、未解決参照だけを保護する。状態組合せ検査と解消後清掃のSource接続は未成立。実行毎DirectoryやEvidence書庫を作らない。

初回進行記録を`unresolvedKeyExchanges`へ入れない。発行／記録不明は元試行再観測のみ。両者確定後の提示／初回限定接続確認だけ不明に対して選ぶ別交換から交換Recoveryを用いる。初期化・交換・Lock回復の参照を相互転用しない。

## 6. 既存Capabilityと切替

| 現Source／Consumer | 新Owner・切替条件 |
|---|---|
| `cros/access/credential.ts` | AMのUser参照・現在Role認可へ。現Verifier方式は再利用候補、Credential固定権限は廃止 |
| `cros/access/registry-file-adapter.ts`／`recovery-file-adapter.ts` | AM保存Adapter。出版後throw／falseを未保存扱いしない。無期限改訂・操作File積算は引き継がない |
| `cros/configuration/shared-server-file-adapter.ts` | 接続／Exposureの管理正本を照合し、旧configとの二重正本を解消してから切替 |
| `workbench-server/src/credential/administration.ts`／`src/server.ts` | 旧発行・失効・rotate・資格アクセス更新・一覧を操作別APIへ接続。旧rotateを新交換と同一視しない |
| `mcp-server/src/project-context/cros-resolver.ts`／旧HTTP接続 | 現在認証・内容範囲解決をAMへ、集約をDomainへ。旧REST廃止は代替本番接続後 |
| `cros/access/recovery-cli.ts`／`recovery.ts` | 通常Host回復の交換2種と§2.1の初回設定へ分離。旧bootstrap／full reset／追加ガードを新契約へ流用しない |

旧`shared-server.json`のSchema全fieldは次へ対応する。固定旧入力Hashと各移行先の読戻しを相関し、一つのfieldを複数の現在正本へ複製しない。

| 旧field | 移行先Owner・変換／検証 | Consumer・旧撤去Gate |
|---|---|---|
| `contract` | 移行入力Schemaの識別。新Schemaへ値を機械移植しない | フロントAIが旧Schema検査後、新Owner契約で再検査 |
| `revision` | 旧入力改訂として移行相関へ。AM／Transportの新改訂を旧値から暗黙共有しない | 各新正本読戻しと固定入力対応の確認 |
| `public_origin` | Transport設定Owner。HTTPS・Origin意味を維持しAMへ入れない | Workbench／MCP起動Consumer切替・Origin検証後に旧field撤去 |
| `listen_port` | Transport設定Owner。Port値・Listener配置の対応を確認 | 新Listener本番接続・終了保証後に旧field撤去 |
| `repositories` | AM接続登録／Exposureの全件対応。配列をContext本文へ変換しない | 認可済み解決とDomain集約の全Consumer切替後に旧field撤去 |
| `repositories[].repository_root` | AM Bindingへ対応。Version Controlがexact Rootを再検証、DomainがManifest／Contextを検査 | 新BindingとDomain Reader接続・非許可Reader 0確認 |
| `repositories[].workspace_ids` | AM Exposureへ明示対応。User／Role内容権限へ自動転用しない | 現在内容認可・Exposure・実アクセスの別評価確認 |

旧CredentialにはUser ID・表示名がない。フロントAI移行では固定旧入力Hashと全件の明示User対応およびRepository Binding／Exposure対応を確認し、profile・workspaceIds・systemAdminからRole内容権限や管理能力を自動推定しない。対応不能は停止し、人間へ確認する。新状態の参照整合・読戻し・全Consumer切替後に旧管理正本を撤去する。Sourceの旧形式fallbackや旧新二重書込みは作らず、過去Evidenceは変更しない。実データ移行・秘密Storeへの操作は今回行わない。

## 7. 検証と次Gate

RFD-UT-020は固定判定、RFD-IT-021は入力搬送・保存境界、RFD-ST-022は本番Workbench縦断、RFD-UAT-007は理解を確認する。RFD-ST-016／RFD-IT-017／RFD-IT-018では鍵操作の段階別Effect・不明を維持する。部分write、改訂競合、pending残存、出版後読戻し失敗、応答喪失、排他解放欠測を反証例へ接続する。MCP鍵4面0、通常Host回復は交換2のみを負観測として確認する。設計追加でNot RunをPassへ変えない。

Repositoryでは重複登録、未登録Exposure、解除後の孤立Exposure、片側除去だけの完了表示、対象外登録・Exposure／本体変更、解除完了からの開始済み取消完了推定を反証する。鍵では通常発行不明への交換Recovery付与、不明発行からの新交換、確定発行の不明化、別交換と旧Identityの混同、秘密再表示・自動再発行、失効鍵の遅延利用案内、現在認可なしの通常交換を反証する。処置方針の確定からQA実行済みを推定しない。

初回の反証は、正規未試行の不適切拒否、双方確認なしの作成、既存／通常鍵喪失の再初期化、相関確定前Effect、二重UUID・追加鍵、不明発行から新交換、提示／初回限定接続確認混同、Secret保存／再表示、自動登録・公開・内容付与、部分≠全体完了である。Quality Local Item・実行結果への接続は次作業で、今回Passにしない。

現在残件は、Root準備・旧入力本番観測、提示／初回限定接続確認／通常接続・後続初回段階、元発行Identityと提示／初回限定接続確認観測の搬送、認証・現在認可・公開DTO、本番入口と移行実行である。完全Schema・内部保存Owner・通常保存・初回相関baselineの局所接続は§4.6〜4.7を参照する。内容範囲・容量・Binding・保持原則・初回／鍵保存順序は§4.5で具体化済み。担当はQual-Lab、再評価契機は保存・API候補固定時。接続残件は実装Gateを阻害するため将来改善として退避しない。追加の保証や再表示・自動再発行を採用する場合は上流判断へ戻す。

Root準備はFilesystem Effectを持ち、Directory作成だけで未初期化を証明しない。準備後故障の既知Effect・残存を保持する。論理初回順序の具体化から実装Gate成立を推定しない。Quality設計への接続は行ったがNot Runであり、横断モデル・Workbench／MCP詳細・Sourceの本番接続は未成立。

## 鍵の期限なし方針の接続 — 2026-10-11

鍵の期限方針は期限なしとして確定した。保存・公開結果から有効期限や自動更新を新設せず、Verifier照合、明示失効・交換、要求毎の現在認可を別に接続する。未知の保存fieldを無視して期限なしへ変換することや、旧失効資格を再有効化することは許可しない。旧CROS形式からの移行と本番保存接続は未完了。

## Checklist

- [x] 操作別Authority・対象・Effectを既存意味へ対応し、登録と解除を分離した。
- [x] 内部状態と公開read、秘密非保存、現在値と元要求完了を分離した。
- [x] 保存候補を比較し、未確認の排他・出版保証を成立扱いしない。
- [x] 交換の段階・4組表示3組確認・入口別の一度提示を区別した。
- [x] 旧設定の全fieldとCredentialの移行Owner・Consumer切替条件を記した。
- [x] Quality項目と反証面を対応し、Not Runを維持した。
- [x] 登録解除の同時除去と鍵の3分岐を確定上流へ合わせ、処置方針の旧OPENを解消した。保存・接続の成立とは区別する。
- OPEN: 目標Schema・状態組合せ・公開API・提示／初回確認の実装、Consumer接続・実データ移行は§7の現在残件。現在の論理契約と§5のSource比較を分け、旧Schema検査成功を新版の完成根拠にしない。
- OPEN: Consumer本番接続・旧撤去・実境界検証はSource移管後にQual-Labが確認する。候補対応表だけではCapability完成を主張しない。

- 履歴: 更新前固定版の初回内部操作・論理記録候補は限定独立レビュー済み・全重大度0だった。今回へ流用しない。
- OPEN: 今回の最小鍵提示方式の文書差分は限定再レビュー済み（最小鍵提示方式の伝播差分、全重大度0）。具体初回接続・Host交換後Binding・Schema・Quality・Source・API本番接続・実E2Eは未成立。
