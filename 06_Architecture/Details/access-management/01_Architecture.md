# ユーザー・資格・認可の詳細設計

## Source構造の再編 — 2026-10-19

添付のSource Structure Reviewとその後の人間判断を適用する。以下は内部配置と公開APIの再編であり、Role分担、保存Schema v2、Host管理Root、同一Lock内の現在認証・期待改訂・保存・読戻し、鍵の一度提示、MCP非公開の鍵操作を変更しない。実Host ST／人間UATの残件をこのRefactorの回帰成功へ読み替えない。

```text
src/
├ index.ts                         専門操作と公開結果型だけを明示公開
├ user/{types,crud,status}.ts       ユーザー登録・表示名変更・有効状態取得
├ role/{types,assign}.ts            固定Role・Userと内容権限の割当
├ permission/{types,validation}.ts  共通の権限語彙・内容範囲の入力検査
├ authorization/{current,management}.ts
│                                  現在認可・管理対象別の非秘密投影
├ repository/{types,register,exposure,binding,resolve}.ts
│                                  接続登録・公開範囲・実体と認可済み集合
├ credential/{types,authentication,crud,exchange,presentation,token}.ts
│                                  認証・発行失効・交換・一度表示
├ initialization/{execution,connection,state,root}.ts
│                                  初回設定・限定接続・状態・Host Root
├ cli/command.ts                   引数・対話・表示と処理の振分け
└ storage/{types,parse,store,lock}.ts
                                   完全保存型・Schema・物理保存・既存排他
bin/access-management.ts           Process入口と取消通知
```

`repository/resolve.ts`はRepository固有の現在認可・公開範囲・実Rootを照合し、単体または集合を返す。添付案の`authorization/repository.ts`は作らない。`authorization/management.ts`は管理権限判定と対象別の非秘密な結果を所有し、User／Repositoryの変更そのものを引き取らない。AI Profile管理の小さな認可判定はここへ統合する。

Core一般CRUDへの`resolveRuntimeContentAccess(root, token, repositoryId, signal)`も`repository/resolve.ts`が所有する。通常本人とdevelopment内容権限を同じ管理改訂で取得し、主体・資格・Repository・公開範囲・Binding・Manifest・真正Root・Projectを要求内Contextへ結合する。定義の読取り／編集と既存記録の読取りだけを許し、`decision.record`と`queue.enqueue`は認可再読前に拒否する。現在認可の失効・改訂差・実体不明・取消・例外はfalse又はnullであり、Rootの技術確認だけを認可へ昇格しない。Context・Tokenの永続化や要求間cache、新Role・Grant・Lockは追加しない。MCP／Workbenchはこの同じ公開APIを利用する。

Contextの初回は一つの既存Lock内で現在状態読取り・KDFによる資格照合・通常接続判定・内容範囲・pending処置・Repository実体観測を行う。要求内closureへ保持するのは非秘密actor・現在改訂・確認したraw byteの既存SHA-256・Repository相関だけで、完全SnapshotやVerifierを複製しない。再確認は毎回同じLock下で現在byteと改訂の完全一致、通常接続・内容範囲、pending、Root／Manifest／Bindingのfresh観測と解放確認を行う。同一要求内でこの全条件が維持された場合だけKDFの同じ計算を繰り返さない。状態が変われば新しい許可へ追従せず拒否し、別要求は再びKDFを行う。Hash単独を認可とせず、長期cache・TTL・認証結果Map・新しい証拠Frameworkは作らない。

### 公開と内部利用の区別

公開動詞はコーディング規約に従い、権限評価を`evaluate…Permission`、既存属性・状態の変更を`update*`へ揃える。`evaluateAiProfileManagementPermission`は現在資格の認証を伴う評価であり、渡されたRoleだけを評価する`evaluateManagementPermission`とI/O・入力が異なる。名前の統一を理由に両者の認証・Lock境界を統合しない。`updateCredentialPresentationState`は出来事の追記ではなく、同じ資格の提示状態を更新する内部Consumer用APIである。

`updateUserRole`への改名はPackage API、Workbenchの管理operation、MCPの`crdd.update_user_role`へ同時反映する。未Releaseの旧操作名`crdd.change_user_role`・旧`changeUserRole`は互換受理せず、Clientは現在のTool一覧を再取得する。要求field・保存Schema・Role権限・失効・交換動作は不変更。過去Evidenceは当時の名前のまま維持する。

| 公開する能力 | 所有Source | 主な利用側 |
|---|---|---|
| User登録・表示名変更 | user/crud | Workbench／MCP |
| ユーザー有効状態取得 | user/status | Package API。既存ユーザー管理の可視範囲内だけ。新しいMCP／HTTP入口は追加しない |
| UserのRole変更・Role内容範囲割当 | role/assign | Workbench／MCP |
| 接続登録・解除・公開設定 | repository/register・exposure | 登録はWorkbenchだけ。解除・公開は既存の公開範囲を維持 |
| 現在権限・管理情報取得・Profile管理認可 | authorization/current・management | Workbench／MCP |
| 認可済みRepository単体・集合の解決 | repository/resolve | Workbench／MCPからDomain処理へ渡す前 |
| 通常認証・鍵発行失効・交換・提示結果 | credential各操作 | 鍵管理はWorkbench／信頼Hostだけ。MCPへ追加しない |
| 初回設定・限定接続・既存Root確認 | initialization各操作 | Host CLI／既存Surface接続 |

保存完全Snapshot、汎用状態更新、Parser、鍵材料生成・Verifier照合、初回の個別保存段階とCLI受付はPackage内部と試験から直接利用する。Root公開から外すことを保存機能の撤去と扱わない。秘密の生成・照合をTransportへ移管しない。

通常管理7操作と本人／管理読取りは、公開入口で既存の非秘密投影を一回だけ適用し、利用側へ型付き結果を直接返す。`projectManagementOperationResult`等は内部の共用変換として維持するがRootから公開しない。Workbench／MCPは再投影しない。公開status・reason・対象別field・主失敗・出版／清掃結果は従来のSurface結果と同じにし、内部の自由理由やBindingを追加しない。内部保存結果を検証する試験だけが同じFileの`save*`／`read*State`等を直接利用する。

| Root公開API | 返すもの／用途 |
|---|---|
| `registerUser`、`updateUserName`、`updateUserRole`、`updateRoleContentAccess` | 非秘密の`ManagementOperationOutcome`。拒否と保存後不明を分離 |
| `readUserStatus` | `UserStatusResult`。completedはrevision・userId・enabled、unavailableは固定理由のみ |
| `registerRepository`、`unregisterRepository`、`updateExposure` | 同じ公開管理結果。登録≠公開を維持 |
| `readCurrentAccess`、`readManagementState` | `CurrentAccessOutcome`／`ManagementReadOutcome`。種類外情報・内部Bindingを除外 |
| `evaluateManagementPermission`、`evaluateAiProfileManagementPermission` | 固定Role分担と現在のProfile管理可否 |
| `resolveRepositoryAccess`、`resolveRepositoryAccessCollection`、`sameAccessCollection` | 信頼したBackend向けの認可済み実Root・集合とその同一性。外部DTOではない |
| `authenticateNormalConnection`、`resolveConnectionAuthentication`、`confirmInitialConnection` | 通常認証と初回限定接続を区別した既存結果 |
| `issueCredential`、`revokeCredential`、`readCredentialIssuance`、`readCredentialAdministrationState`、`updateCredentialPresentationState` | administratorの鍵操作と非秘密状態。生成成功時だけ一度提示用の秘密を保持 |
| `exchangeCredentials`、`exchangeCredentialsFromHost`、`finishKeyExchange`、`finishKeyExchangeFromHost`、`readKeyExchangeState`、`readKeyExchangeStateFromHost` | Workbench／信頼Hostのexact交換処理・終了・再観測。MCPへ公開しない |
| `initializeFromHost`、`readHostInitializationState`、`resolveHostRootInput`、`readExistingHostRoot`、`prepareHostInitializationRoot` | 明示初回設定と通常Root検証を分離したHost接続 |

これは未ReleaseのPackage内部APIの破壊的整理を含むため、旧内部SymbolのRoot importを利用側・試験で同時に変更する。通信／保存Schemaの移行とは区別し、互換aliasを新設しない。Source移管の回帰結果と初回実Host／人間UATの未完了は別に追跡する。

### ユーザー有効状態の取得

`readUserStatus(root, token, userId)`はユーザーが有効か無効かを返す独立したAPIとする。鍵の状態を公開するAPIではなく、将来判定方法が変わってもユーザー有効状態という契約を維持する。現在は、検査済み現在値に対象ユーザーの非失効鍵が1件以上ある場合だけ`enabled:true`、0件なら`enabled:false`とする。鍵の提示確認・Role内容権限・Exposureを有効判定へ混ぜず、新しいユーザー停止状態や保存fieldは追加しない。

同じ既存Lock・改訂で現在認証とユーザー管理の可視集合を照合し、対象存在を確認してから状態を導出する。既存のユーザー一覧と同じ閲覧範囲を使用し、独立した権限設定は追加しない。対象不在・非認可・初回未完了・Schema／読取り不明・pending清掃／Lock解放不明は、対象情報のない`unavailable`とし、無効へ変換しない。有効状態は認証成功・操作許可・後続要求での有効性を保証しない。保存Schema、既存一覧DTO、鍵処置、認証経路、MCP／HTTP入口は不変更。

### 保存境界と移管時の反証

`storage/lock.ts`は既存の`locked`と固定Lock名を所有し、取得・同じ回復参照による回収・解放結果をDomainの既存排他部品へ接続する。`storage/store.ts`は現在値読取り、pending照合、出版・読戻し・清掃を所有し、必要な排他を`lock.ts`から直接利用する。各操作も`lock.ts`を直接利用し、その一回のLock内で現在認証・期待改訂・対象検査を行う。`lock.ts`は保存本体に依存せず、内部の結果型だけを共有する。公開readの後に別Lockでupdateする構造へ分解せず、新Store・Lock・取引Frameworkを作らない。Bindingは純粋なHash導出に留め、`store → parse → binding`から業務操作へ戻る依存を作らない。Package Rootの公開API、保存形式、Lock名と取得・回復・解放条件は変更しない。

反証は、非認可入力、Role変更・失効の次要求反映、改訂競合、pendingと現在値の不一致、出版後読戻し・清掃・Lock解放不明、同じ交換参照による再入場、登録と公開の分離を既存試験で再確認する。`workspaceIds`は現行の内容範囲を表す保存・通信fieldであり、作業Workspaceではない。内部名だけを内容範囲へ改め、Schema・wire値を今回の配置変更で黙って変更しない。

この節は現行Source構造のOwnerであり、後続本文の旧Pathや接続前の候補記述を現行Treeとして利用しない。過去Evidenceは変更しない。

[Workspace対象と内容領域の分離](../coordinator/05_Workspace.md#2-方式識別所有境界)を適用する。既存development／managementのworkspaceId(s)はcontentAreaId(s)へ改名する設計対象で、意味・権限を新Workspaceへ自動転用しない。共有接続の操作ごとに現在のRepository／内容範囲と要求操作を評価し、対象IDだけで許可しない。具体的Workspace操作の認可要求・Schema・Consumer切替は未決であり、一般IAMや新しい権限Frameworkは追加しない。

成果物種別: Architecture詳細設計
詳細設計領域: access-management
状態: Candidate（Source再編・利用側回帰・限定独立レビュー完了。実Host ST／人間UAT・正式191項目の全体評価は未完了）
維持責任者: Qual-Lab

管理API・内部状態・物理保存方式の比較・移行・出版後故障の具体化候補は[管理APIと現在状態の保存設計](02_Management_State_and_API.md)が所有する。本文は責務と意味・処理境界を所有し、具体化候補から実装Readyや保存保証の成立を推定しない。

内容操作は[MCP詳細の現在認可構成](../mcp-server/01_Architecture.md#現在認可による内容操作の新owner接続--2026-10-12)とWorkbenchの専門API直接接続へ実装済み。AMは要求時の現在許可集合と実Root／manifestを返し、内容CRUDと同ProjectのRelation判定はDomainが担当する。旧CROS／RESTは撤去済みだが、実Host ST／人間UATと最終Gateを未確認のままAM全体完成としない。本文の候補時点の未実装・未成立表示は接続前の履歴であり、現在の接続状態は本冒頭と現在の検証結果を優先する。

## 基本設計との関係

| 正式入力 | 担当する断面 | Relation状態 |
|---|---|---|
| [ARCH-000013](../../Definitions/ARCH-000013/architecture_definition.md) | 最小ユーザー・Role・資格管理、現在認可、接続／公開情報、限定鍵交換、初回Host設定 | Partial |
| [SCR-000008](../../../04_UI/Details/Areas/configuration-trust/SCR-000008/screen.md)／`PRT-000008.spec-000012` | 対象と影響、4組の事前表示、3組だけの明示確認、一度表示、発行不明の再観測と受け渡し未確認後の別交換への導線 | Partial |
| [BHV-000012](../../../05_SPEC/Details/BHV-000012/behavior.md) | 要求毎認可、管理・失効・交換、Effect前拒否、部分失敗、現在再観測 | Partial |

UIは見え方・操作、SPECは成立条件、本文は実装Owner・情報・順序と失敗境界を所有する。3関係はいずれもPartialである。保存・公開入口・v2 Schema・API・Browser提示・公開HTTPの候補接続と局所確認はあるが、実Host縦断、実状態移行、人間UATおよび正式全体評価は未確認である。意味を変更する場合は上流へ戻す。候補設計の存在からArchitecture Ready、QA Handoff、Source移管・E2E成立を主張しない。

## 1. Componentと責務

### Host保存先の通常読取りと初回準備

以下の通常Launcher接続は候補実装済みである。共用API・MCP／Workbench公開Process・HTTPの局所試験は実施済みだが、実Hostからの初回縦断と人間UAT、最終Gateは未完了である。

Host環境から固定Publisher・Application・Trust Domainの配置入力を選ぶ処理はアクセス管理が共用する。通常Launcherは`readExistingHostRoot`で既存Directoryと親chainの非Link・realpath・実体Identityを検証するだけで、mkdir・初期化・鍵発行を行わない。不存在または観測不能はRootなしとして起動を拒否し、未初期化の正常状態とは区別する。

`prepareHostInitializationRoot`による不足Directoryの作成は明示的なHost初回設定だけが使用する。Rootの検証成功は保存内容の正規性、初回設定完了、通常認証または認可の成立ではない。各利用側は既存保存Ownerから現在の管理状態を読み、破損・旧形式・未解決出版等を成功へ読み替えない。保存場所とSecret保護条件は変更しない。

| 責務 | 所有すること | 所有しないこと |
|---|---|---|
| ユーザー／Role管理 | 安定userId、表示専用名、一ユーザー一Role、Role詳細権限の現在値 | 一般IAM、本人確認、メール、Password、自己登録／編集、複数Role、個別追加権限 |
| 資格管理 | userIdへの紐付け、Verifier、状態、発行・照合・独立失効 | 生Secret保存、Credentialへの固定権限・個別override、既存Secretの再表示 |
| 認可・接続解決 | 現行Roleの固定9管理分担とRole内容設定を分け、Exposure・実アクセスを別評価し許可済み集合を構成 | Context内容の意味解析、Portfolio集約、Git操作、Task Authority発行 |
| 鍵交換 | 同じRecoveryで失効範囲・既存発行先・結果・部分失敗を相関 | Role初期化、認可設定修復、回復専用ユーザー／Bootstrap、Task取消 |
| 初回設定 | ユーザー成立前の管理状態・元試行相関、最初のadministratorと資格の個別結果 | 通常回復の代替、再初期化修復、Remote／自動開始、汎用Recovery |
| 保存Adapter | 既存OS管理Rootで非秘密管理情報とVerifierを検査・確定し、競合を拒否 | Repositoryへの秘密移動、新しい共有State／Lock Framework、Transport lifecycle |

Workbench／MCP／Host入口は入力と表示・配送を担当し、認可判定はAccess Managementを迂回しない。Domain Modelは認可済みRepository集合を受けてContextを処理する。現在はAMの`RepositoryAccessCollectionResult`で要求専用の許可集合と技術的Rootを返し、ConsumerがDomainの中立Sourceへ変換する。Credential／Role／Grant解釈をDomainへ移さず、Repository content所有をAMへ移さない。AI Profile内容はAI Adapter、活動事実はOrchestrator／Execution Intelligenceに残す。

Package Rootの`src/index.ts`から明示公開し、Capability内barrelは作らない。責務Folderはユーザー／Role、資格、認可、接続、回復の実操作を表すよう選ぶが、具体的File集合は保存・API設計後に固定する。src二階層、binの主入口はPackage名を基本とする既存Coding Standardsに従い、入口数・CLI引数はここで追加しない。

## 2. データ関係と保存保証

以下は論理情報の一覧であり、JSON Schema・File名・新しいRegistry数ではない。

| 情報 | Identity／関係 | 必須の整合条件 |
|---|---|---|
| ユーザー | userId（UUID）、username、Role | 名前は表示だけ。同名・改名でIDやAuthorityを変えない。Roleはdeveloper／manager／administratorの一つ |
| Role詳細権限 | Role→内容の許可操作・利用範囲 | 現在値を内容要求毎に参照。固定9管理分担は設定対象外でON／OFF・再委譲なし。管理権限から内容閲覧を生成しない。内容権限の具体語彙・Schemaは未確定 |
| 資格 | Credential ID→既存userId、Verifier、現在状態 | ユーザー・Roleとの参照整合。生Secretを含めない。期限なしで、時間経過だけの自動失効・交換なし。失効済み資格を再有効化しない |
| 接続／公開情報 | 検証済みRepository Binding、Exposure、改訂 | Rootの技術的検証はVersion Control、意味解析はDomain。対象IDはAuthorityではない |
| 鍵交換相関 | 同じRecovery ID、種別、入口、対象、既存発行先、対象旧資格集合、既知失効、発行結果／不明、結果改訂 | 非秘密。現在Stateを再観測するための根拠であり、操作許可を復元しない |
| 初回相関 | 確認済み元試行、成立したUUID／資格、元発行処置、結果記録・Host提示・同鍵の限定接続確認と保存改訂 | 非秘密・非Authority。初回だけ接続成功を受領・接続確認とする。未作成IDを推定せず、交換Recovery／Lock回復ID・短命pendingと分離 |
| Request Context | 現要求の認証主体、現在Roleと許可集合、観測改訂 | 要求内の派生値。永続Sessionや第二の権限Storeを作らない |

保存Ownerは既存ユーザー／Host側管理領域を維持する。[保存配置契約](../domain-model/03_Repository_Storage.md#6-crosとの物理分離)と既存Root resolverを使い、Package改名でRootを変えない。非秘密設定を秘密Storeの代わりにせず、生SecretをGit、Repository-local `.crdd`、Prompt、ログ、Evidenceへ保存しない。

保存に必要な保証は、関連ユーザー・Role・資格の整合読取り、期待改訂の競合拒否、失効／発行／回復相関の確定と読戻しである。旧不変Revision publishとVerifier照合は再利用候補だが、新Schema、書込み単位、Process喪失時にも部分結果を失わない確定方法、保持上限と清掃は未設計。これらが決まるまで実装Readyにしない。無期限蓄積、複数Writer用の新Lock Framework、電源断完全保証を今回採用しない。

## 3. 要求毎の認証・認可

Profile管理の固定許可はmanager／administratorとし、developerは拒否する。既存の通常接続認証から得た同改訂の現在Roleを純粋判定し、用途限定の許可／拒否／観測不能を返す。現在値を各一覧・操作で取り直し、Header時点や前要求の許可を共有しない。Catalogの内容・保存・改訂はAI Adapterが所有し、AM LockをCatalog操作へ持ち越さない。認可後のRole変更は次操作から反映し、別Owner間の保存原子性を保証しない。新Lock・Session・認可Frameworkは追加しない。現在のSourceはこの追加区分へ未接続である。

| 順序 | 処理 | 拒否・不明時 |
|---|---|---|
| 1 | 生資格を許可された入力境界から受取り、現在Verifier／失効を検査 | 認証不成立。User情報・資格状態を開示しない |
| 2 | 紐付く既存userIdと現在Roleを整合した改訂から解決 | 破損・観測不能を許可へ丸めず停止 |
| 3 | 管理要求はARCH-000013の9 Role分担行、内容要求は現行Role内容設定を評価 | 管理拒否を自身表示・許可内容の拒否へ広げない。Role内容設定から管理権限を生成しない |
| 4 | 内容操作なら現在Exposure・Binding・実アクセスを別評価 | 非許可Sourceの存在・名前・件数を結果へ追加しない |
| 5 | 許可済み集合をDomain等の実Ownerへ渡し、許可範囲の結果を返す | 一部未観測を全体成功へ畳まない |

この資格認証の順序は通常要求のもので、信頼したHost交換入口と初回Host設定へ追加資格認証を要求しない。初回に既存ユーザー／administrator資格認証を要求しない。

次要求では現在値を読み直し、前RequestやCredential発行時のRole権限を再利用しない。一Requestへ矛盾する改訂の管理情報を混ぜない。受理済み処理はその開始時Authorityと固有lifecycleに従い、資格失効だけをTask取消・既発行Effectの消失としない。

## 4. 通常管理と独立失効

| 操作 | 前提・Effect | 終了と非目標 |
|---|---|---|
| ユーザー登録 | 予定Role・表示名、現在管理認可と期待改訂。managerはdeveloper／managerのみ、administratorは三Roleを登録可能 | 新userIdを生成し予定情報だけ保存・読戻し。新規対象に既存ID・変更前Roleを要求せず、資格は発行しない |
| 表示名変更 | 既存対象userId・新表示名、現在manager／administratorの認可と期待改訂。administratorの名前もmanagerが変更可能 | 表示名だけ保存・読戻し。userId・Role・Credentialを保持 |
| 既存Role変更 | 既存対象userId・変更前／後Role、現在管理認可と期待改訂。managerは前後ともdeveloper／managerのみ | 割当てRoleを保存・読戻し。administratorの付与・解除・降格はadministratorだけ。次要求で現行Roleを再評価 |
| Role内容設定 | 対象Role・変更内容、現在管理認可と期待改訂。developer／managerの内容設定はmanager／administrator、administrator内容設定はadministratorのみ | 内容設定だけ保存・読戻し。固定管理分担のON／OFF・再委譲を受理しない |
| Repository登録・登録解除 | 対象Repository ID・現在登録／Exposure状態・変更内容、現在manager／administratorの認可と期待改訂。登録時は検証済みBindingを確認し、登録時の再検証を解除条件に転用しない | 登録は接続登録だけを保存・読戻し、登録≠公開。解除は同じ受理済み操作・採用改訂で対象登録と対応Exposureを除去し、両読戻し確認時だけ完了。対象外登録・Exposure、Repository本体・Product Dataを保持。開始済み操作の取消完了・過去Effect0・実資源終了は証明しない |
| Exposure設定 | 対象Repository ID・現在登録／公開状態・変更内容、現在manager／administratorの認可と期待改訂 | 公開範囲だけ保存・読戻し。管理権限・更新受理から内容取得を生成しない |
| 資格発行 | 現行administrator、既存userId、整合状態。Verifierと紐付けを保存 | 同一Process Workbenchの操作administrator画面へ用途限定・短命な応答で新Secretを一度提示する。追加受領操作なし、対象本人受領は製品外で観測しない。MCP・Host回復の操作にしない |
| 独立失効 | 現行administrator、exact Credential IDと既存userIdの結合・期待改訂。指定資格の失効だけを確定 | 対象外失効0、新発行0、Secret0、交換Recovery0、次要求拒否。MCP・Host回復の操作にしない。旧要求取消完了の証明ではない |

管理認可の正本は[ARCH-000013の9 Role分担行](../../Definitions/ARCH-000013/architecture_definition.md#4-両観点の統合判断)で、Role内容設定では変更できない。developerはこの管理操作を行えない。managerの正常管理にadministrator存在を条件として追加しない。manager自身の内容範囲変更も、変更前の現在管理認可→明示的なRole内容設定／Exposure更新→次要求の現行Role・Exposure・実アクセス再評価の順とする。更新受理は内容取得の成功ではない。

自身表示は認証済み利用者へ許可する。非認証User情報0、他ユーザー参照の現行管理権限を持たない入口への他User一覧・存在・件数0を維持する。管理一覧にVerifier、salt、生Secretを載せない。通常管理はRole情報を変更し得るが、次節の鍵交換は変更しない。

### 4.1 初回Host設定のStateとSequence

ログイン済みHost操作者の明示開始だけをAuthorityとする。管理用表示名は識別補助で、最初のadministrator UUIDを作成し同userIdへ資格を発行する。MCP／Remote Workbench／自動起動、追加認証・承認コード・OS昇格を入口にしない。通常管理9分担・Host鍵回復2操作とは別である。

| 状態・契機 | 前提・処置・Effect | 次状態・失敗・終了後観測 |
|---|---|---|
| 正規未試行から明示開始 | 既存Host Root／Pathを検証し、管理状態と進行記録の双方未初期化を同じ保存Ownerの排他下で再照合。非秘密な元試行相関を耐久確定・読戻し | 相関確定後だけUUID／鍵Effectへ進む。開始前の試行／UUIDを推定しない。双方確認済みの新作成を拒否しない |
| 確認済み試行から作成・発行 | 最初のadministrator UUIDを作成し同userIdの資格を発行。作成・発行・非秘密結果記録を別事実で確定・読戻し | 作成済み・発行済みを未初期化へ戻さない。発行／記録不明は元試行再観測だけ。別UUID・追加鍵・新交換・自動再初期化0 |
| 発行・記録確定から提示 | Host端末へSecretを一度提示する。生Secretは保存しない | 提示結果を非秘密の元試行と資格へ相関し、再表示・自動再発行しない。提示だけを初回完了にしない |
| 同鍵の初回限定接続 | 元試行・同userId・直近にHost提示したexact有効資格に限定し、接続成功を受領・接続確認とする | 通常管理・内容参照・鍵操作Authorityは0。KDF一致・callback完了・TCP／HTTP到達だけを接続成功にしない。Owner・完全Protocolは保存設計§2.5に具体化。Source・本番接続は未成立 |
| 確認結果の確定 | 同じ初回試行の接続確認を保存・読戻しし、短命pending／材料・Lockの終了を確認する | 全条件成立後だけ初回completedと通常Authorityへ進む。未確認・失敗・観測不能なら両方0。清掃は有効資格の削除ではない |
| 既存状態・通常鍵喪失 | 初期化拒否。鍵喪失は既存Host交換へ | 管理者不存在・Role破損を初期化で修復しない |
| 観測不能・境界不正 | 別Root、読取不能、破損、Lock使用中、未解決回復、部分状態不明では新作成停止 | 単一File不在・Root作成を未初期化証明にしない。Root準備の既知Effectを初期化Effect0で隠さない |
| 発行・記録確定、提示／限定接続確認だけ不明 | 作成済みadministratorへの既存Host指定交換を別明示操作として選択可能 | 元事実を保持、交換内部だけsame exact Recovery。秘密再取得・再表示・自動再発行0。元初資格と直近確認対象を保存設計の別IDへ結合する。本番保存は未成立。別交換成功を旧受領・rollback・取消完了としない |

状態遷移の投影：

```text
双方未初期化確認＋Host明示開始
  → 元試行相関確定 → UUID作成 → 同userId資格発行 → 結果記録
  → Host一度提示 → exact同鍵の初回限定接続成功
  → 確認の保存・読戻し・短命材料清掃／Lock終了 → 初回completed／通常Authority
確認済み途中＋発行／記録不明 → 元試行再観測（新Effectなし）
発行・記録確定＋提示／限定接続確認だけ不明 → 別の既存Host指定交換
確認のいずれか失敗／未確認／観測不能 → 初回completed0／通常Authority0
既存／観測不能 → 新初期化停止（未初期化へ戻さない）
```

ブロック間の順序：

```text
Host対話入口 → AM: 明示開始・表示名（追加Credential認証なし）
AM → 保存Owner: Root・現在状態・進行記録確認、元試行相関確定
保存Owner → AM: 読戻し・個別確定事実（不明は保持）
AM → 保存Owner: 最初のUUID・資格Verifier・非秘密結果
AM → Host対話入口: 許可された結果、一度限りSecret
Host対話入口 → AM: 非秘密の一度提示結果
MCP／Workbenchの限定接続入口 → AM: 完全検査済み要求と同鍵接続の相関
AM → 保存Owner: 確認結果の保存・読戻しと短命材料／Lock終了確認
AM → 通常利用側: すべて確認後だけ初回完了と現在認証への接続
```

ユーザー成立前の管理状態・元試行相関はAMが所有し、成立後にUUID／資格へ結ぶ。初回試行参照は非Authorityで、Credential ID・交換Recovery・Lock回復と分離する。Repository登録・Exposure・内容権限の自動付与とProduct Data変更は0。内部操作と論理記録の候補は[保存設計§2.1](02_Management_State_and_API.md#21-初回host設定の内部操作候補)へ渡す。Root準備・物理Schema・確定方法・保持清掃・本番接続は未完了で、論理順序から保存保証を推定しない。

初回接続の具体契約は[保存設計§2.5](02_Management_State_and_API.md#25-初回限定接続の具体契約)を正本とする。接続成功は、直近Host提示資格による完全な限定要求をサービスが受理し、その確認を保存・読戻し・短命材料清掃・Lock終了まで確定したことを表す。クライアントによる応答受領保証ではない。成功応答は確定後だけ返し、同要求では通常操作を実行しない。元の初資格とHost交換後の確認対象は別IDとして保持する。これは設計の具体化であり、本番接続・Quality実行の成立ではない。

## 5. 鍵交換のSequence・State

### 5.1 操作と入口の4組

全組で対象ID・表示名・失効範囲・発行先・保持情報をEffect前に提示する。保持情報はuserId、username、Role、Role詳細権限、Repository登録、Product Dataである。

| 入口×操作 | Authority | 失効範囲 | 新資格の発行先 | 明示確認 |
|---|---|---|---|---|
| 通常×指定ユーザー | 現行administrator | 対象既存userIdの全旧有効資格。他ユーザーを保持 | 同じ既存userId | 追加Gateなし。事前提示は必須 |
| 通常×全員 | 現行administrator | 自身を含む全ユーザーの全旧有効資格 | 指定既存administrator userId | 必須 |
| Host×指定ユーザー | ログイン済みローカル操作者 | 対象既存userIdの全旧有効資格。他ユーザーを保持 | 同じ既存userId | 必須 |
| Host×全員 | ログイン済みローカル操作者 | 全ユーザーの全旧有効資格 | 指定既存administrator userId | 必須 |

通常の資格発行・独立失効・鍵交換は現行administrator専用の固定契約で、Role設定のON／OFF項目ではない。他Roleへの付与やadministratorからの剥奪を設定として受理しない。Hostはログイン済みローカル操作者を信頼する入口で、専用資格・追加認証・承認コード・OS管理者昇格を要求しない。通常Host鍵回復は鍵交換2操作だけを扱い、通常管理や独立失効へ広げない。全員交換後、他ユーザーの再発行／配布は管理者の通常管理で行う。初回設定は§4.1の別契約で、回復として再実行しない。

### 5.2 処理順と完了条件

| 段階 | 成立条件・観測 | 次へ進めない場合 |
|---|---|---|
| 準備・事前確認 | 現在Authority、対象、必要な既存管理者、状態、期待改訂を確認。必要な3組の明示確認 | 操作に必要な対象・発行先が不明／不存在、安全に観測不能・認可破損・確認拒否は新Effect前停止。全員交換の指定既存administrator条件をHost指定ユーザー交換へ転用しない |
| 相関確立 | 対象旧資格集合と既存発行先を同じRecoveryへ非秘密で耐久確定し、読戻す | 相関保存不能なら失効を発行しない。これ自体は失効成功ではない |
| 旧資格失効 | 競合を再照合し、選択集合の失効を確定。対象外資格と保持情報の不変を観測 | 確定／不明を同じRecoveryに残し、新Recoveryでやり直さない |
| 新資格発行 | 既存発行先へ新Verifier／資格Identityを確定。失効結果とは別に観測 | 失効確定でも発行失敗／不明ならcompletedではない |
| 結果確定 | 失効範囲・発行結果・結果改訂を同じRecoveryへ非秘密で確定 | 記録・読戻し不明を完了へ丸めない |
| 結果配送 | 許可された入口へ結果と一度限りのSecretを返す | 発行・結果記録が確定済みなら「発行済み・受け渡し未確認」とし、確定を保持する。未確定発行の再観測と、確定後に明示選択する別交換を§6で分ける。Secret保存・再表示・自動再発行なし |

資格状態（有効／失効／不明）と、回復の確認待ち／進行中／blocked／completedを混同しない。交換のcompletedは必要な失効と発行の確定で判定し、入口への提示結果とは別に保持する。通常の対象本人引渡し・受領は観測外であり、交換の終了条件にしない。UIには既知結果と未確定範囲を分けて返す。永久resetting／rotating資格状態は追加しない。

## 6. Failure・再入場

| 故障・反例 | 処置・再入場 | 禁止する推定 |
|---|---|---|
| 通常管理の現在認可・操作固有対象／状態が不明、競合・破損 | 新Effect0で停止。操作に必要な現在値を読み直す。manager正常管理にadministrator存在を要求しない | 管理拒否から自身表示拒否、管理から内容付与、登録から公開、解除からデータ削除 |
| 通常管理の保存後に読戻し／応答が不明 | 更新・読戻し・配送の既知事実を分け、現在の対象と改訂を再観測。暗黙再更新を行わない。具体再取得APIはOPEN | 未保存、rollback、Effect0、完了の推定、交換Recoveryの付与 |
| 鍵処置前の操作固有条件不足・競合・破損 | 新鍵Effect0で停止。発行は既存userId、独立失効は資格-userId結合、交換は対象集合・必要な既存発行先を再確認 | Role初期化、設定修復、特別ユーザー生成、Hostへの追加資格認証 |
| 失効publish結果不明 | 同じRecoveryと現在資格状態から確定範囲を観測。相関不能なら停止 | 未失効／全失効への丸め、自動新規交換 |
| 失効確定後の発行失敗 | 同じRecoveryで失効結果と発行状態を保持し、現在状態・Authorityを再確認 | rollback、旧鍵の再有効化、正常完了 |
| 発行または非秘密結果記録が不明・Process喪失 | Credential IDとは別の非秘密な元発行Identityと既知事実で現在再観測し、新交換を開始しない。交換由来だけ元のexact Recoveryを保持。通常発行には交換Recoveryを新設しない | 確定事実の不明化、Secret再取得・再表示、記録からAuthority復元、重複発行、通常発行不明の`unresolvedKeyExchanges`への格納 |
| 発行・結果記録確定後の応答／配送喪失、または提示結果観測後の受領不明 | 「発行済み・受け渡し未確認」と表示し、既知の発行・記録と元発行Identityを保持。現在許可されたadministratorが既存の指定／全員交換を明示的な別Operation／別Recoveryとして選択する | 確定発行の不明化、Secret保存・再表示、自動再発行、受領不明を確定未受領へ丸めること、別交換成功からの旧受領・rollback・取消完了推定 |
| 現在administratorとして接続できない | 既存のログイン済みHost交換2操作へ案内し、その現在対象・条件・確認を再適用する | Workbench認可迂回、Hostへの通常発行・独立失効・追加認証・新Recovery機構の追加 |
| 全員交換で呼出し管理者自身が失効 | 開始済み処理の結果確定と新規再入場を分ける。再入場は新しい現在Authorityが必要 | 旧管理資格やRecovery参照による再認可 |

別交換の指定操作は、先に発行した鍵を含む対象ユーザーの全旧有効資格を失効し、同じ既存userIdへ新資格を発行して他ユーザーを保持する。全員操作は先の鍵を含む全旧有効資格を失効し、指定既存administratorへ一資格を発行し、他ユーザーは通常再発行・再配布へ戻る。各交換内では旧資格失効前から同じexact Recoveryを保持し、別交換の結果を旧処理の受領・rollback・取消完了へ転用しない。遅延した旧応答で失効済み鍵を利用可能と表示しない。

回復参照・結果照会は許可された利用側だけへ返す。参照自体に認可能力を持たせない。Host再入場はローカル入口で対象・現在状態を再確認し、記録を処理許可へ昇格しない。3分岐の処置方針は確定済みである。元発行Identity・公開read・提示結果観測の具体保存／搬送と保持・清掃は[保存設計](02_Management_State_and_API.md)のOPENとして残し、汎用回復Frameworkを作らない。

## 7. 配置・秘密・観測境界

単体／CROSは起動時明示選択。単体は検証済み起動Repository一つ、資格不要。CROSだけが既存Host管理領域を使用する。同一Process Workbenchは内部認可呼出し、別ProcessはMCP。Listener、TLS／Origin、接続・取消・joinは各Transport Ownerに残す。CROS REST／Gatewayは代替本番接続後に撤去し、Browser↔Workbench RESTは維持する。

生Secretは生成・一度提示の短命値。Verifier以外を耐久保存せず、資格一覧・履歴・復旧結果から復元しない。通常の資格発行・独立失効・鍵交換は同一Process Workbench BackendからAccess Managementを直接呼ぶ。通常提示は用途限定・短命な応答で操作administratorの画面へ、Host交換・初回はHost端末へ搬送する。対象本人への引渡し・受領は製品外で観測せず、追加受領ボタンや通常Receiptを設けない。一般MCP／DTO・一覧・履歴・Log・Evidenceへの生Secret公開は0。MCPには全鍵操作のTool・Schema・登録・dispatchを持たせない。初回の論理接続方式は保存設計§2.5に具体化済み。具体API・画面／CLI入力・提示観測の実装／実境界・移行・本番接続は未成立。

観測は要求の種別・入口・許可済み対象、非秘密Identity、観測改訂、失効／発行／配送の個別結果、同じRecovery、処置時刻を相関可能にする。秘密値、Verifier、salt、任意Host Path、許可外User／RepositoryのIdentity・件数を公開しない。時刻だけを保存確定・失効成立の証明にせず、記録の正確なSchemaと保持期間は保存設計で閉じる。運用ログと正式Evidenceを混在させない。

## Qualityへの引渡し

各項目は正常・境界・準正常・異常・回復を評価し、N/Aは理由をQualityに残す。Local Itemの採番・試験・Evidence適用はQuality Ownerに委ね、次表からPassを生成しない。

| 導出キー | 設計項目種別 | 対象 | 正常条件 | 反証する失敗 | 主な試験段階 | 外部境界の段階 | 観測 | 終了後条件 | 未確認 |
|---|---|---|---|---|---|---|---|---|---|
| `access-management.current-authorization` | Authority／State | §2〜3のユーザー・Role・資格 | 9 Role分担行×三Roleを現在値で判定する | 旧権限固定、同名Identity混同、override、Role内容設定による管理付与・再委譲 | UT／IT／ST | Direct Boundary | 認証・認可・改訂の相関 | 許可外Effect 0、Request値解放 | 内容権限の具体語彙・Schema |
| `access-management.visibility` | Security／Visibility | §3〜4の三可視境界・Repository非開示 | 自身表示と許可範囲だけを返す | 非認証User情報、非許可主体への他User存在・件数、管理から内容の推定 | IT／ST／UAT | System/E2E／User Acceptance | 公開入口結果と対象Owner呼出し | 許可外情報0 | 具体表示・本番接続 |
| `access-management.management-and-revoke` | Effect／Consistency | §4の通常管理・独立失効 | 対象だけを保存・読戻しし次要求で再評価する | 登録＝公開、解除片側だけの完了、対象外／本体変更、取消完了推定、新発行推定 | UT／IT／ST | Direct Boundary | 登録／Exposure両除去と独立失効の相関 | 対象外と本体保持、終了未観測は別事実 | 保存単位 |
| `access-management.key-exchange-scope` | Sequence／Authority | §5の4組 | 対象集合・既存発行先・必要な3組確認を確定する | 対象不明、管理者なし、破損、不適切確認からの開始 | UT／IT／ST／UAT | System/E2E／User Acceptance | 事前表示、対象資格集合、新旧照合 | 保持情報不変 | 具体入口と保存確定 |
| `access-management.partial-recovery` | Failure／Recovery | §5〜6の相関・Process喪失 | 元発行Identityと交換内exact Recoveryで現在を再観測する | 通常発行へのRecovery付与、不明からの新交換、Credential ID混同、rollback・重複発行 | IT／ST | Direct Boundary／System/E2E | 故障後の耐久読戻し・新Process再観測 | 既知／不明と旧元Identityを保持 | atomicity・元Identityの保存／再観測方式 |
| `access-management.host-initialization` | State／Lifecycle | §4.1の初回状態・限定接続 | Host提示、同鍵限定接続、確認保存・読戻し、短命清掃、Lock終了の順で確定する | 各段階の失敗・未確認・観測不能からの完了表示・通常Authority発行 | UT／IT／ST／UAT | Direct Boundary／System/E2E／User Acceptance | 元試行／user／確認資格／発行処置相関 | 秘密保存・再表示0、有効資格を清掃しない | 提示観測・移行・保存／清掃実装・本番接続 |
| `access-management.secret-delivery` | Security／Resource | §5〜7の用途限定短命提示 | 通常administrator画面またはHost端末へ一度提示する | Secret保存・再表示・一般MCP／DTO公開・自動再発行、本人受領推定 | IT／ST | Direct Boundary／System/E2E | 発行・記録・提示結果を別観測 | 提示後の短命値解放 | 入力・提示結果の保存／搬送・清掃 |

導出キーは領域内参照で、新しい安定IDではない。試験段階と外部境界段階は別軸。全体の履歴や旧試験成功をこの契約の新Evidenceへ流用しない。

## 詳細成果物の適用判断

| 詳細成果物 | 判定 | 理由 | 正本節／成果物 |
|---|---|---|---|
| Component Model | Required | 状態Ownerと非目標を分離する | [§1](#1-componentと責務) |
| Interface Model | Required | 現在認可・管理・入口Authority・結果を区別する | [§3](#3-要求毎の認証認可) |
| Data Flow | Required | Identity・改訂・相関・保存の関係を定める | [§2](#2-データ関係と保存保証) |
| State Model | Required | 資格・回復・個別結果とOPENな物理確定を区別する | [§5](#5-鍵交換のsequencestate) |
| Sequence | Required | 相関、失効、発行、記録、提示を分離する | [§5](#5-鍵交換のsequencestate) |
| Failure／Recovery | Required | 同じIdentity、現在Authority、禁止推定を保持する | [§6](#6-failure再入場) |
| Deployment | Required | 単体／CROS、同一／別Process、OS Rootを分離する | [§7](#7-配置秘密観測境界) |
| Observability | Required | 非秘密相関・改訂・時刻と結果軸を定義する | [§7](#7-配置秘密観測境界) |
| Security Boundary | Required | 三可視境界、管理と内容、Secret、Hostを分離する | [§7](#7-配置秘密観測境界) |
| Implementation Structure | Required | 下表で全7観点を評価する | [Implementation Structure](#implementation-structure) |

## Engineering Concern評価

| Concern | Result | Rationale | Evidence／Related ID |
|---|---|---|---|
| Concurrency | OPEN | 同Lock・期待改訂・同Binding再観測は具体化済みだが、Writerと本番要求の競合・解放確認が残る | [保存設計§2.5](02_Management_State_and_API.md#25-初回限定接続の具体契約) |
| Timing | OPEN | 時間経過だけで自動失効・交換しないが、本番要求での現在認可反映は全体未確認 | [§3](#3-要求毎の認証認可) |
| Resource Lifecycle | OPEN | 短命Secret・材料清掃は具体化済みだが、TTY／HTTP／画面の本番終了と残存観測が残る | [§7](#7-配置秘密観測境界) |
| External Boundary | OPEN | 論理配置は具体化済みだが、公開入口・OS保存・提示の実境界が未完了 | [§7](#7-配置秘密観測境界) |
| State／Consistency | OPEN | v2目標形状は具体化済みだが、完全Parser・鍵処置・実状態移行の相関確認が残る | [保存設計§5](02_Management_State_and_API.md#5-鍵交換の段階と終了) |
| Failure／Recovery | OPEN | 三分岐と応答喪失は具体化済みだが、元発行再観測・公開read・故障後再入場の本番接続が残る | [§6](#6-failure再入場) |
| Observability | OPEN | サービス側出力とClient受領非保証を区別したが、公開DTOと実境界の相関観測が残る | [§7](#7-配置秘密観測境界) |
| Security／Trust | OPEN | 保護条件と初回の通常Authority非発行を固定したが、本番提示の要求結合が残る | [§3](#3-要求毎の認証認可) |

`PASS`: 詳細設計上、必須条件と反証が閉じている。`N/A`: Architecture上、そのConcern自体が存在しない。`OPEN`: 未解決の設計事項を保持する。`FAIL`: 必須設計と矛盾する。

結果語彙は詳細設計ひな型に従い、OPENは現在の不足を示す。旧設計や試験のPassで埋めず、設計未完成のまま実装Readyとしない。

## Implementation Structure

| 観点 | 適用 | 判定理由 | 成立させる構造 | 局所責務・不変条件 | 失敗・変更時の影響 | Qualityへの導出キー |
|---|---|---|---|---|---|---|
| Variation | Required | 2操作と2入口がある | §5の4組 | 入口差で失効意味を変えない | 確認条件・範囲の混同 | `access-management.key-exchange-scope` |
| Common Contract | Required | Surface間で同じ認可・交換意味を使う | AMの現在値・結果軸 | Surfaceごとに複製しない | Consumer間の結果差 | `access-management.current-authorization` |
| Creation／Selection | Required | 前提成立後だけ対象・処置を選ぶ | §3〜5と初回元試行 | 未初期化確認前Effect 0 | 重複作成・誤対象 | `access-management.key-exchange-scope` |
| State-dependent Behavior | OPEN | 論理状態は具体化済み、物理再入場は未完了 | §5〜6の段階状態 | 既知／不明を維持 | 不明の成功化 | `access-management.partial-recovery` |
| Composition／Recursion | Required | 現在認可とDomain結果を合成する | 許可集合→Domain | 再帰処理は要求しない | 部分取得・非開示違反 | `access-management.visibility` |
| Lifecycle Ownership | OPEN | 短命値・相関Ownerは明示済み | §2／7のOwner分離 | 有効資格を清掃しない | 秘密・材料残存 | `access-management.secret-delivery` |
| External Boundary | OPEN | Host／Surface／OS保存を分離した | §7の境界 | 具体I/Oと終了条件は未確定 | 本番境界での誤完了 | `access-management.secret-delivery` |

既存通常管理とHostが同じ鍵交換意味を利用するため共通操作へ寄せるが、Authorityは統合しない。一般Strategy／Router／IAM Frameworkは不要。二つ目の具象が増えた場合は同じ責務か確認し、追加前に既存契約の利用側へ照合する。

## 現行実装との照合

保存・Host CLI・Workbench／MCP公開入口は局所Sourceへ接続済みだが、実Host縦断、実状態移行、正式191項目、人間UAT、AM全体の評価は未完了である。局所試験や旧EvidenceをArchitecture Readyへ流用せず、冒頭のCandidate状態と各OPENを維持する。

## 10. 旧能力の引継ぎと残る設計Gate

| 旧能力・比較入力 | 新Owner | 引継ぎ条件 |
|---|---|---|
| Verifier照合・生Secret非保存 | AM資格管理 | 現在ユーザー／Role・新Schemaで保持。旧固定Grantを持ち込まない |
| Root resolver・完全Snapshot検査・競合拒否・不変publish | 既存Root部品＋AM保存Adapter | Rootを維持し、新Schema／書込み単位／故障確定を反証。不変Snapshot列の無期限蓄積を採用しない |
| prepare／settleと同じRecovery | AM鍵交換 | 失効確定・発行不明・Process喪失を保全し、回復用Bootstrapを廃止し、§4.1の初回設定とは分離 |
| 認可済みPortfolio・非開示・単体資格不要 | AM許可集合→Domain Model→Surface | Domain詳細と本番Consumerを接続、新Evidenceを作る |

[移管対応表](../../../99_Roadmap/Changes/CHG-000082/source-owner-map.md)は比較／移行入力に限定する。旧CROS全公開export、Host bin、MCP、Workbench、配布入口・設定・symbol・試験の閉包が揃うまで旧処理を置換済みとしない。旧EvidenceのHash・内容は変更しない。

| OPEN | 確認先・再評価契機 | 閉じるまでの制約 |
|---|---|---|
| UUID版・表示名制約、内容権限の具体語彙、Verifier適用 | AMデータ／認可設計、必要なら上流Owner。Schema固定前 | 新ユーザー保存・権限初期値をSourceへ実装しない |
| 物理Schema・同一Root内配置・書込み確定・再入場・保持清掃 | AM保存設計、既存保存Owner。Source移管前 | 既知部分結果を失う方式、無期限蓄積、新Lock Frameworkを採用しない |
| 公開API・秘密配送・採用済み画面／CLI入口の具体入力・表示と提示結果の確認 | AM／UI／MCP／Workbench Owner。公開入口実装前 | Remote秘密公開、新CLI入力、受領成功の推定をしない |
| Domain集約・混合型分割・全ConsumerとQuality伝播 | Domain／Surface／Quality Owner。旧CROS撤去前 | 旧処理の削除・新契約全体完成を主張しない |

現在の意味具体化に追加の人間判断はない。OPENを閉じる際、上流意味、Authority、公開秘密境界、保証範囲の変更が必要なら人間へ戻す。

## 保存保証の採用 — 2026-10-12

保証範囲と電源断時の残存リスクは[REQ-000041](../../../01_Discovery/Definitions/REQ-000041/requirement.md#保存保証の範囲--2026-10-12)の人間判断に従う。通常保存・読戻し確認までとし、通常失効・現在認可・破損拒否を弱めない。具体保存と残る実装Gateは[保存設計§4.3](02_Management_State_and_API.md#43-保存途中の再入場候補--2026-10-11)が所有する。この採用は保存実装や本番接続の成立ではない。

保存、内容権限の具体語彙、公開入口、Domain詳細、Quality、Source・新実境界は未完了である。旧鍵管理判断および固定8分担・登録解除・鍵3分岐の限定レビューは当時の範囲だけに適用する。今回の最小鍵提示方式は候補伝播済み・限定再レビュー済み（最小鍵提示方式の伝播差分、全重大度0）だが、旧初回設定の限定Passは履歴である。接続Owner・Protocol・Host交換後Binding・保存Schema、Quality・Source・本番接続・実境界は未成立である。

| 現行対応表 | 担当Source Definition | 担当Detail | 状態 | 戻し先 |
|---|---|---|---|---|
| [UI／SPEC Detail Architecture Traceability](../../08_UI_SPEC_Detail_Traceability.md) | ARCH-000013 | SCR-000008／PRT-000008／BHV-000012 | Partial | 意味変更はUI-000008／SPEC-000012へ、配置変更はARCH-000013へ戻す |

担当Interaction Relation: `PRT-000008.spec-000012`

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
