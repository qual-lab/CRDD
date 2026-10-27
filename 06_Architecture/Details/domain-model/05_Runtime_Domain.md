# Runtime DomainのAPI・単一保存契約

成果物種別: Architecture詳細設計

詳細設計領域: domain-model（Runtime Domain）

状態: Candidate（共有型・値検査のSource移管を開始。保存・公開受付の全面接続と移行は未完了）

維持責任者: Qual-Lab

基準改訂版: `5dae7108436205ecf7804d7898b1aecc2e8ce85b`

本書は承認されたCore独立方針について、APIの入出力・局所状態・共通保存の設計を所有する。[Package境界](01_Architecture.md)、[保存配置](03_Repository_Storage.md)、[現行の棚卸し](../../../99_Roadmap/Changes/CHG-000082/runtime-domain-storage-after.md)を利用し、既存Topic／Meetingの意味を再定義しない。「Candidate」は正式Architecture内の目標設計であり、実装済みやArchitecture Readyを意味しない。

## 1. 責務・依存・成立範囲

| Owner | 所有するもの | 所有しないもの |
|---|---|---|
| Domain | Plan／Objective／Milestone／Taskの定義、判断記録、論理Workspace、Queue・Attemptの値、局所検査・Query／CRUD | Provider起動、Scheduling、現在Authority発行、Git操作、資源不存在の判定 |
| 共通Storage | 同じSnapshotの読書き、CAS、短期排他、確定前File、読戻し、履歴出版の物理順序 | Task成功、現在認可、再実行・回復判断 |
| Coordinator | 共通PlanのAdmission、選択・Claimの横断調停、再試行・回復・結果受入の調停 | Domain定義の第二正本、共通Writer、単一試行の技術実装 |
| Executor | 単一Attempt、取消・期限・Effect・終了・結果と元回復参照の調整 | 独立Queue、Domain Store、Planの再構築、常駐Server |
| 既存専門Package | Access Managementの認証・認可、VCのGit、AI AdapterのCatalog・CLI差、DI／PAの隔離・OS | 他Ownerの状態の複製 |

DomainはCoordinator／Executorを実行値importしない。AI Adapterは既にDomainのplain-dataへ依存するため、逆方向の実行値importも作らない。信頼したHostがCatalog APIから必要な非秘密値を取得して設定検査へ渡す。Catalogの内容・真正性判断をBrowser入力へ委譲しない。

Core起動・CRUDはCoordinatorが読込み不能な構成でも成立させる。未解決Automation区画があっても、その保全可能なCore読取り・編集にDocker確認やProvider認証を追加しない。

<a id="document-and-execution-ownership"></a>
### 1.1 CRDD文書・呼出し側・実行状態の責務

| 対象 | 正本／担当 | 境界 |
|---|---|---|
| Milestone・Roadmap・WBS・正式判断・Evidence | CRDD文書群。人間／フロントAIが既存工程・権限に従って記録・更新 | Runtime状態の複製や自動同期先ではない |
| 文書を読んだ計画・実行Taskへの分解 | Coordinatorを呼ぶフロントAI等のCaller | 小・中規模の目的、対象、受入条件、依存を具体化して渡す。Coordinatorに上位計画の再作成を求めない |
| 渡された実行依頼の定義・状態 | Domainの値契約・局所CRUD・共通保存 | 文書側の業務計画の第二正本を作らない。保存Ownerの移管は文書の決定権限移管ではない |
| 実行・Review・許可範囲内の是正・取消・回復の調整 | Coordinator／Executorと既存の専門Owner | 実行結果を返す。文書Milestoneの達成・正式受入・Releaseを確定しない |
| 結果の解釈・必要な文書反映 | Callerと人間の決定権限者 | 文書処理を委譲するなら、それ自体を明示Taskとして渡す |

CRDD文書とCoordinator状態の自動同期、文書からの自動WBS生成、Runtime受入から文書側の完了を確定する機能は追加しない。文書処理Taskも通常の対象範囲・現在認可・外部送信同意・編集結果確認に従う。Task完了だけで文書の正確性・採用・公開を保証しない。

### 1.2 既存Objective／Milestoneの用途確認

| 現行要素 | Sourceで確認した用途 | CRDD文書側との関係 |
|---|---|---|
| `CoordinatorObjectivePlan` | milestoneAcceptanceCriteria、Objective定義集合、Task定義・依存集合という実行依頼の値 | Roadmap／WBS本文や文書上の版・正式判断を保持するモデルではない |
| `ProjectObjectiveRecord` | 同じObjectiveに属するTaskの状態を集約し、全完了後integration_pending、明示判断でaccepted／returnedへ進む | 実行内のTask群の受入単位。文書の目標達成を自動確定しない |
| `ProjectMilestoneRecord` | 同じ実行計画の上位集約。全Objective受入後integrating、明示受入・判断待ち・回復・取消を保持 | 実行依頼全体の区切り。文書Milestoneと同名でも同一正本ではない |
| `state/create.ts` | CallerのProject／Milestone識別と渡された定義集合からRuntime状態を初期化 | IDの一致だけで文書との対応・現在性・認可を証明しない |
| `objective/execute.ts`の公開構成`planObjective` | 基準版は1 Objective＋1 Task包装。今回のSourceはCallerの明示Planを返し、Task別入力へ結合する | 文書解析・上位計画の生成は行わない。二Taskの非AI本番組立て試験を実施し、実AI成立とは区別する |

今回、これらのSymbol・保存値を機械改名しない。既存の受入・再入場・回復保証を維持して用途を限定する。共有型と局所規則はDomainに置けるが、CRDD文書のMilestone／Roadmap／WBSモデルとして一般化しない。公開受付は分解済み計画を受け取る新形式へ切り替え、入力必須化に伴いObjective受付契約をv2へ改訂する。旧形式の自動補完は行わない。

<a id="runtime-domain-api"></a>
## 2. 共通入力・返却値

以下は実装する型の入出力定義であって、新しい権限発行Frameworkではない。Contextは信頼したHost構成からだけ渡し、HTTP／MCPのJSON入力に含めない。

```ts
type StateVersion = Readonly<{ revision: number; payloadSha256: string }>;
type DefinitionHash = string; // 対象の正規化定義から毎回導くSHA-256。新台帳なし
type DefinitionTarget = Readonly<{ projectId: string; milestoneId: string }>;
type RuntimeContentOperation =
  | "definition.read" | "definition.write" | "decision.read" | "decision.record"
  | "queue.read" | "queue.enqueue" | "runtime.read";
type RuntimeAccess = Readonly<{
  root: VerifiedRepositoryRoot;
  principalId: string;
  revalidate: (operation: RuntimeContentOperation, target: DefinitionTarget) => boolean;
}>;
type RuntimeReadResult<T> =
  | { status: "available"; value: T; version: StateVersion }
  | { status: "absent"; value: null; version: StateVersion | null }
  | { status: "blocked" | "unknown"; value: null; reason: string };
type RuntimeWriteResult<T> =
  | { status: "saved"; value: T; version: StateVersion }
  | { status: "conflict"; value: null; reason: "state_changed" | "definition_changed" }
  | { status: "blocked"; value: null; reason: string }
  | { status: "unknown"; value: null; reason: string;
      publication: "not_published" | "unconfirmed" | "confirmed";
      recoveryReferences: readonly string[] };
```

`VerifiedRepositoryRoot`は既存VCの型を再利用する。Root確認は対象Filesystemの確認であり、操作認可ではない。`RuntimeContentOperation`は下表の読取り・定義編集・判断記録・受付という閉じた操作集合とする。操作名をCallerの自由文字列から生成せず、各Domain APIが固定して既存の内容権限へ対応する。新しいRoleやGrantは追加しない。既存権限との対応を確定できない操作は公開しない。

Contextは認証済み主体・同じRootへ結合する。入口と、短期排他下で対象の最新改訂を得た処置直前に再確認し、読取りは返却前にも確認する。失効・不一致・確認不能では値や対象存在を公開しない。再確認関数は既存の同期認可結合を使い、callback登録・Plugin・新Capability発行を設けない。

- `StateVersion`: 全体保存の競合検出。Entityの業務改訂や受付世代とは別。
- `DefinitionHash`: 同じSnapshot内の対象定義だけを固定する。Project／Milestone・対象種別・IDを含む正規化値から導く。別対象の同じ本文を同一対象と扱わない。
- 両者が必要な変更では両方一致を要求する。全体CASが変われば、対象定義が同じでも競合として返し、自動再適用しない。
- 正常保存は出版・読戻し・排他解放の確認まで。停電耐久性や任意OSの保証は追加しない。
- `blocked`は正本出版前の拒否として扱う。短命File等が残存し得て終了確認不能なら`unknown`と元参照を返す。`unknown/publication:confirmed`も、排他解放等の未確定により全体成功とは異なる。
- 失敗理由は意味別に閉じた型へ具体化し、生Error・秘密値・Host Pathは公開しない。`reason:string`は文書例の省略であり、実装時の任意生文字列返却を許可しない。
- 既存AI Selection等の結果型を、この例に合わせるためだけに変更しない。既存のpublication／cleanup／temporary参照を欠落させない。

## 3. 実行依頼モデルの共通公開操作

`Target`は`DefinitionTarget`、`Expected`は`StateVersion`を表す。以下のPlan／Objective／Milestone／TaskはCallerから渡す実行依頼の定義・観測であり、文書側の業務計画の正本ではない。API名は設計候補で、現在の公開入口へ接続済みとは扱わない。有限のローカル読取り／保存だけを行い、AI・Docker・Git・外部送信を開始しない。各操作はRootの`src/index.ts`から実体を明示公開する。

| API | 入力（Contextに続くrequest） | 成功値／拒否・競合 |
|---|---|---|
| `initializeRuntimeState` | `Target & {expectedAbsence:true}` | 空の共通状態と初回版。現在のstate／pending、未解決参照、旧領域の存在・移行不明があれば拒否。既存初期化の一回出版を再利用し、固定AI選定・Provider認証を要求しない |
| `savePlan` | `Target & { expected:Expected; definition:PlanDefinition; expectedDefinitionHash:DefinitionHash|null }` | 実行依頼の定義集合とHash。初回nullは対象の明示不存在だけ。DAG不正・参照中・改訂差を拒否。CRDD文書を更新しない |
| `queryPlan` | `Target` | `RuntimeReadResult<PlanView>`。同じ実行依頼定義からの投影で、文書のRoadmap／WBSを読んだ結果ではない |
| `createObjective` | `Target & {expected:Expected; definition:ObjectiveDefinition}` | 定義とHash。重複ID・参照不正を拒否 |
| `updateObjective` | `Target & {expected:Expected; objectiveId:string; expectedDefinitionHash:DefinitionHash; definition:ObjectiveDefinition}` | 同じIDの編集可能な完全定義。参照中・ID差・基準差を拒否 |
| `deleteObjective` | `Target & {expected:Expected; objectiveId:string; expectedDefinitionHash:DefinitionHash}` | 削除したID。依存Task・判断・Attempt等の参照があれば拒否。Cascadeなし |
| `queryObjectives` | `Target` | 同じSnapshotからのObjective値・定義Hash集合 |
| `createTask` | `Target & {expected:Expected; definition:TaskDefinition}` | 定義とHash。Objective不存在、重複、循環・不正Path値を拒否 |
| `updateTask` | `Target & {expected:Expected; taskId:string; expectedDefinitionHash:DefinitionHash; definition:TaskDefinition}` | 同じIDの編集可能な完全定義。参照中・依存不正・基準差を拒否 |
| `deleteTask` | `Target & {expected:Expected; taskId:string; expectedDefinitionHash:DefinitionHash}` | 削除したID。逆依存、受付、Attempt、受領・判断・Candidate参照があれば拒否 |
| `queryTasks` | `Target` | 定義・Hashと管理実行の読取り専用投影。技術fieldは編集要求へ含めない |
| `recordDecision` | `Target & {expected:Expected; decisionId:string; target:{kind:"objective"|"milestone"; id:string; definitionHash:DefinitionHash}; decision:"accept"|"return"|"wait"; criterionEvidenceIds:readonly string[]}` | 既存の判断記録と適用結果。対象・現在認可・根拠相関・受入可能状態を照合し、実行再開をしない。同IDは既存記録と照合し、別内容で再適用しない |
| `queryDecisions` | `Target` | 認可対象の判断記録。Capability秘密値は返さない |
| `queryAttempts` | `Target & {taskId:string}` | Attempt ID、Operation／結果／元回復参照と観測出所。再実行・回復なし |
| `queryWorkspaces` | `Target` | 論理WorkspaceとCandidate／統合参照。Git実行なし |
| `enqueueOperation` | `Target & {expected:Expected; requestId:string; definitionHash:DefinitionHash; workspaceId:string|null}` | 同IDの受付記録。既存の受付世代・Hash照合を維持。異なる内容のID再利用を拒否、実行開始なし |
| `queryQueue` | `Target` | 受付状態と観測。Claim／Dispatchなし |
| `queryRuntimeState` | `Target` | Coreの定義・判断とAutomationの許可された投影。次Taskの選択・実行なし |
| `queryExecutionStatus` | `Target & {limit:number; cursor?:string}` | 現行の上限・Cursor・observed／absent／unknownを維持した実行状況。EIの実績分析とは別 |
| `decodeRuntimeDomainSnapshot` | 正規UTF-8 byte列とRepository結合 | 新Schemaの正本・管理実行のメモリ投影・本文Hash、又はnull。旧Schemaを受理しない純粋codec。物理保存や認可成立を示さない |
| `hashRuntimeProjectDefinition` | 検査済みCore Project | 対象IDと計画定義の正規値へ結合するHash。状態・Owner・処置許可は含まない |
| `readRepositoryAiSelection` | 検証済みRootと信頼したHostの非秘密Catalog値 | 現行available／missing／blockedとidentityを維持。Catalogを要求本文から取得しない |
| `saveRepositoryAiSelection` | 既存config・expected identity・認可・信頼したCatalog値の結合 | 現行saved／conflict／blocked／unknownと元参照を維持。state.jsonとの二File同時更新を新設しない |

Query集合は現在Snapshotの有限サイズ制約（16MiB）内を対象とする。新しいページングFramework・Cacheは作らず、既存の実行状況ページングだけを維持する。件数や文字数の既存入力上限は移管時に一覧照合し、Coordinatorの同時実行上限を一般Domain Entity数へ転用しない。

`PlanDefinition`は既存`milestoneAcceptanceCriteria/objectives/tasks`の集合、`ObjectiveDefinition`は`id/acceptanceCriteria`、`TaskDefinition`は`id/objectiveId/dependencies/allowedPaths/conflictKeys`に限る。新たな`planId/goal/title/sourceDocuments`を上記の型に暗黙追加しない。値は不変の通常データへ固定し、未知key、getter／Proxy、不正ID・Path値をEffect前に拒否する。

Plan保存と個別CRUDは同じ定義を変更し、Taskを二重保存しない。人間は既存属性だけで移管する方針を承認した。新しいPlan ID・Task属性・外部完了報告APIを追加しない。Workspace作成・固定・Merge・削除は既存VC APIと現在認可を使う別操作で、`queryWorkspaces`から発行しない。

個別CRUDの途中ではObjective／Taskが空、Task未作成、未割当Objectiveが存在する定義を許す。Taskが存在すればObjective参照・依存先・重複・循環・Path文法・件数上限は必須とする。`savePlan`と管理実行導入は完全定義（Objective／Taskが各1件以上、全ObjectiveへのTask割当）を要求し、実行受付はさらに認可済み外側Path範囲を検査する。Coreの作成途中を実行可能へ補完しない。

<a id="caller-task-graph-intake"></a>
### 3.1 Callerが分解したTask群の公開受付

既存`runObjective`の入力を刷新し、Callerが明示したPlanとTask別実行入力を受け取る。以下の新形式はDomainの検査・Coordinatorの本番組立て・MCP SchemaへSource接続した。CLIと配布入口は同じ要求検査を使用する。別のPlan実行Server・Queue・公開ラッパーは追加しない。Workbenchの既存単発Task入口から新たな計画UIを作らない。MCP＋有限代役の搬送確認と、二Taskの本番組立て・実保存・同ID再入場の非AI試験を、複数Taskの実AI成立へ拡張しない。

```ts
type CallerTaskInput = Readonly<{
  taskId: string;
  objective: string;
  acceptanceCriteria: readonly string[];
  readPaths: readonly string[];
}>;
type PlannedExecutionRequest = ExistingObjectiveRequest & Readonly<{
  plan: PlanDefinition;
  taskInputs: readonly CallerTaskInput[];
}>;
// runObjective(request, cancellationSignal, workingDirectory, authenticationContext)
// の既存入口へ搬送し、既存の結果・取消・回復参照を維持する。
```

`ExistingObjectiveRequest`は現在の受付世代、要求／Project／Milestone ID、Repository Revision、全体objective／acceptanceCriteria、最大allowedPaths／readPaths、実行数・再計画数制限、選定希望、Workspace等の閉じた入力を表す文書上の略記で、新しい再export型ではない。実装では既存型を新形式に変更し、旧入力を自動的に1 Taskへ包む互換経路は残さない。非互換な入力変更としてCLI・MCP・配布入口・全試験を一体で追従させる。

PlanのTask定義は既存の`id/objectiveId/dependencies/allowedPaths/conflictKeys`を維持する。Task別objective／acceptanceCriteria／readPathsは既存の技術実行入力を一回の依頼として搬送する値であり、Task Entityへのgoal／title追加やPromptの永続化ではない。

| 入力の意味 | 唯一の入力元／検査 | 下位への搬送 |
|---|---|---|
| 実行全体の目的・受入 | requestのobjective／acceptanceCriteria。plan.milestoneAcceptanceCriteriaは後者と順序込みで一致 | 実行全体の受付・結果相関。Task指示の欠測補完に使わない |
| Objectiveの集約受入条件 | plan.objectivesの既存定義 | 既存の明示Objective受入に使う。Task別Review条件へコピーしない |
| Task別作業指示・実行／Review条件 | taskInputsのobjective／acceptanceCriteria | 対象TaskのExecutor／Reviewerへだけ渡す。他Taskの本文を不用意に含めない |
| Taskの依存・書込み範囲・競合 | plan.tasksの既存定義 | 依存順・既存Scheduler・変更範囲検証。taskInputsへ重複保存しない |
| Taskの読取り範囲 | taskInputs.readPaths | global readPaths内に限定して読取り投影へ。書込み許可へ転用しない |
| モデル選定・Workspace | 現行と同じ受付時固定のSelectionと対象Workspace | Task別の独自選定・Workspace Registryは追加しない。同じWorkspace内で並行編集しない |

受付前に、Task IDの重複・入力の欠落・余分な入力・未定義Objective・依存先不正・循環を拒否する。plan.tasksとtaskInputsはTask IDで厳密に1対1とし、欠測をglobal objective、他Taskの指示、AI生成で埋めない。

TaskのallowedPathsはglobal書込み範囲、readPathsはglobal読取り範囲へ、それぞれ既存の正規化・包含規則で照合する。単なる文字列prefixでは判定しない。本文に記載したPathや指示は技術的な権限を拡張しない。既存の認可・秘密情報検査・送信同意・DI境界を維持し、許可外は対象TaskのEffect前に停止する。

### 3.2 固定・再入場・変更範囲

- Planと全Task別入力を一度の通常データSnapshotへ固定し、既存受付requestHashへ結合する。object keyは既存の決定論的Serializer、配列はCallerの宣言順を保持する。同じ意味でも並べ替えて再送したものを同IDで自動同一視しない。
- 同IDで本文・Task条件・依存・Pathだけが変わった場合も拒否する。選定・Authority・同意はHash一致から発行せず、既存の別検査を維持する。
- 指示本文は現行と同じProcess内だけに保持する。永続する受付Hashは本文の復元機能ではない。Owner喪失後に同ID同Hashが分かっただけでAIを自動再開しない。
- Objective最大128、Task最大1024、ID最大128文字、作業指示最大16,384文字、受入条件最大128件・各2,048文字、Path集合最大128件・各512文字という既存境界を維持する。CLIは依頼全体128KiB、HTTP等も各Transportの既存総量上限を維持し、Task数に合わせて上限を増やさない。各要素の最大値を同時に満載できる保証ではない。
- 既存`maximumReplans`やReplan関数があるだけで、公開経路で自動再計画が成立しているとは扱わない。Callerが用意していない新Task IDや指示が必要になった場合は、対象Taskを開始せず既存の停止・判断結果へ戻す。先行Taskの成功・失敗・unknown・回復参照を保持し、全体未実行・cleanup済みへ巻き戻さない。既存Replanの適用範囲への影響を実装差分で照合する。
- 旧Schemaの互換読取り・自動変換は製品へ追加しない。新しい通信Contract版とSchemaは全利用側と同じ固定候補で切り替え、フロントAIの移行案内へ接続する。今回はSourceとObjective受付契約をv2へ変更し、既存Runtimeデータの移行・操作は行わない。

| 実装対象 | 必要な変更・保持する保証 |
|---|---|
| DomainのPlan値・validation | DAG・ID・範囲・局所参照検査を再利用。文書計画へ一般化しない |
| Coordinator objective/request.ts・plan.ts | 閉じた新入力と全体量・1対1相関検査。Plan生成・欠測補完なし |
| objective/execute.tsのplanObjective／createTaskExecutions | Callerの固定Planを検査し、Task別入力へ結合。現在の1＋1包装とglobal指示コピーを置換 |
| 保存・受付・再入場 | requestHashへ全入力を含める。既存世代・単一CAS・終端／受領・回復参照を保全。本文Storeなし |
| CLI・MCP・配布入口 | 閉じた入力Schema・公開版・受付／取消／結果の相関を追従。旧形式Fallbackなし |
| Workbench | 現行の単発runTaskとGraph受付を混同しない。Graph入力を使う接続があるか棚卸しし、新しい計画UIを暗黙追加しない |
| 検証 | Task Aの編集→Task Bの試験追加という合成依存GraphをFake Executorで確認。各Task固有指示・条件・Pathが混ざらず、Source文書の自動同期0を確認 |

今回の契約具体化だけで複数Taskの公開受付完成・本番接続・実AI成立を表示しない。Domain値／保存移管と依存順に実装し、旧経路の保証・既存利用側を対応付けるまで撤去しない。

## 4. Entity・局所Lifecycle・不変条件

| Entity | 記録・状態の正本 | 局所操作と保持条件 |
|---|---|---|
| Plan／Objective／Milestone | 既存Project／Milestone内の定義集合・受入基準・判断参照 | 保存は計画内容の確定のみ。Task選択・実行Admissionではない |
| Task | 定義と依存。実行状態はAttemptとの相関から投影 | 定義編集にstarting／running／completed／cleanup／Authority／受領を含めない。参照中の意味変更・削除を拒否 |
| Attempt | 技術結果の非秘密な値と出所・exact参照 | 元unknownは保持。人間報告から管理実行成功・Effect不能・cleanupを生成しない |
| Decision | 既存対象・根拠・判断・適用前後の結合 | 同一判断の適用を二重に行わない。記録されたPrincipalを現在権限にしない |
| Workspace／Candidate | 論理記録、Git観測と固定Commit・統合参照 | AI終了だけで固定／Merge／採用・破棄しない。Git技術はVC |
| Queue | 受付ID・内容Hash・受付世代・対象参照・Claim値 | Domainは局所canClaim／claimの条件を所有。Coordinatorが選択・実行権限と横断整合を確認する |
| AI Selection | configと意味identity。実行固定値とは別 | Schema revision、File identity、保存世代、固定Selectionを混同しない |

管理実行の終端資格と業務受入の資格は別である。既存の判断記録・根拠ID・局所受入条件を維持してDomainへ移し、新しい「非管理の完了報告」機能は追加しない。依存や参照の不存在は最新Snapshotで明示確認し、観測不能を空集合にしない。

### 4.1 既存判断・EvidenceとTaskの接続確認

基準Sourceは`5dae71084`。CRDD文書・判断・Evidenceの記録と、Topic／MeetingのDomain CRUDはCoordinatorを必要としない。以下は、その一般的な記録保存とは別の、管理実行Taskの受入経路を確認したものである。

| 現行接続 | 実際に確認していること | 移管方針 |
|---|---|---|
| `task/lifecycle.ts: settleProjectTask` | running・startPhase、Task／Attempt／Operation／authorityBindingの一致、cleanup・回復義務を照合してTaskを終端化する | 技術観測・真正根拠はExecutor、横断調停はCoordinator。根拠ID登録をTask完了の代わりにしない |
| 同関数のObjective集約 | superseded以外の対象Taskがすべてcompletedならintegration_pendingへ進める。自動acceptはしない | 値の集約規則はDomainへ。元の技術終端条件を緩和しない |
| `decision/transition.ts: applyCoordinatorAcceptanceDecision` | 対象はTaskではなくObjective／Milestone。accept／return／wait、対象世代・状態、根拠IDを照合する。Milestoneは全Objective受入を要求 | 既存の局所受入・状態遷移をDomain decisionへ移す。新しい手動Task完了遷移なし |
| `decision/records.ts`と`decision/acceptance.ts` | decisionId・対象・Repository改訂・期待世代・Principal・criterionEvidenceIdsを記録。prepared→状態更新→finalized、同一判断の再入場・別内容の横取り拒否 | 記録型と局所適用はDomain、物理保存は共通Storage。順序と同ID相関を維持し、別の判断台帳を作らない |
| 同公開受入経路と`workspace/operations.ts: workspacePlanReadyForAcceptance` | 現在Principal／Repository相関、integration_pendingのQueueとOwner解放、DirectのHEAD一致又はIsolatedの同計画採用・Merge記録を再観測する | 実行・Queue／Gitの横断条件はCoordinator／VCの既存Owner。純粋受入関数を公開してこの検査を迂回しない |

`criterionEvidenceIds`は既に判断RecordとObjective／Milestoneへ保存される。確認した経路では識別子の形式・重複・必要件数・対象／再入場相関を検査するが、Evidence本文・Fileの実在、根拠が受入基準を満たす内容か、試験品質の成立までは読み取って検証しない。「根拠IDの結合」と「Evidence検証済み」は異なる。この限界を維持し、自動Evidence評価器・本文の複製・新しい根拠Registryは追加しない。他の文書検査や品質工程の保証まで否定するものではない。

したがって既存の判断・根拠参照の表現は今回の移管に再利用できる。ただし現行の受入可能状態には管理Task終了等の前提があり、Domainへ移すだけで任意のCore Taskを手動完了・受入できるようにはならない。CRDDの既存文書へ作業結果を記録することと、この管理Task状態の書換えを混同しない。

Package Rootの`acceptResult`は既存実装を公開している。一方、今回の`40_Develop`本番Source・`template`の直接参照検索ではMCP／Workbenchから同APIへの直接呼出しは見つからなかった。公開exportの存在だけでUI接続済みとはしない。既存入口の最終接続は移管時の利用側確認で閉じ、新しい報告機能で穴埋めしない。

既存`tests/integration/acceptance-decision.integration.test.ts`の6件は今回すべて成功した。対象・世代・Authority、重複、状態Effect前後の同ID再入場、別判断による横取り拒否のMapベース結合である。実Filesystem保存、Evidence本文の実在確認、MCP／Workbench本番接続、新Packageの成立を実証する結果ではない。

<a id="runtime-domain-storage"></a>
## 5. 単一保存・排他・出版

物理正本は一つ。SourceのReader／Writerは`crdd-domain/runtime-state/v1`を使用し、改訂・変更前Hash・全区画のCASを維持する。移管だけのために二つのstate、二重Writer、独立Queue Fileを作らない。既存の物理データの移行・保存先変更は別のGateであり、このSource切替では操作しない。

旧v5のProjectには固定実行選定・Owner世代等が必須だったため、その型を名前だけ変えてCore初期化に使わない。論理形状は「共通ヘッダー（Repository結合・改訂・前Hash・受付世代）、projects（既存定義・業務判断）、workspaces、queueEntries、実行記録区画、受領、履歴搬送」とする。projectsの定義は一箇所に置き、固定Selection・Owner世代・Attempt／Operation結合・startPhase等は同じSnapshot内の対象IDへ結合した管理実行記録として分離する。Coreのみの初期化はその管理実行記録を要求せず、実行を使う際に既存Admissionで追加する。既存未解決記録の欠落・破損を「未利用」に補完しない。

これは保存Schemaの非互換な分解を伴う。実装前に現行各field→目標key・型・任意性の全数表と新Schema識別子を固定し、フロントAI移行手順へ接続する。API定義や本書の更新だけで現行v5が新Coreを受理すると扱わない。既存fieldの意味・元三値・exact参照・一回性は維持し、旧Reader／二重書込みは追加しない。

### 5.0.1 保存値の分解対応

保存識別子を `crdd-domain/runtime-state/v1` とする。以下の固定契約へSourceのcodec・候補生成・既存Writer・利用側を切り替える。旧v5は拒否し、互換Reader・自動変換を追加しない。保存先・既存実データは今回変更しない。新しいPlan IDや業務状態は追加しない。

| 現行v5のRoot field | 新Root field・型 | 未利用／欠測の扱い・Core更新 |
|---|---|---|
| schema | schema: 上記の固定文字列 | 必須。旧版を自動変換しない |
| revision | revision: 正整数 | 必須。全区画共通CASで一回進める |
| previous | previous: null又は既存revision／payloadSha256 | 初版だけnull。元Hash欠測は拒否 |
| repositoryBinding | repositoryBinding: SHA-256 | 必須。検証済みRootとの結合を維持 |
| repositoryBindingId | repositoryBindingId: 既存ID又はnull | 定義・受付を未初期化の場合だけnull。Core初期化で同じ既存結合を設定 |
| intakeEpoch | intakeEpoch: 既存ID又はnull | Core／受付初期化後は必須。保存改訂と別世代 |
| intakeBindings | intakeBindings: 既存配列 | 空を許す。未知・欠測は不可。一般定義CRUDから変更しない |
| projects | projects: 下表のCore Project配列 | 空を許す。定義の唯一の正本 |
| 新設する参照区画 | managedExecutions: 下表の管理実行配列 | 管理実行未導入だけ空。欠測・不正を空へ補完しない |
| queueEntries | queueEntries: 既存受付配列 | 空を許す。定義CRUDから受付・Claimしない |
| workspaces | workspaces: 既存論理Workspace配列 | 空を許す。Git処置はVC。CRUDから技術結果を生成しない |
| operations | operations: 既存閉形式の技術操作配列 | 空を許す。Core更新では不変、値検査と現在Owner確認を分離 |
| unresolvedRecoveries | unresolvedRecoveries: 既存義務配列 | 空を許す。unknown・元参照を保全、Coreから解消しない |
| pendingDeliveries | pendingDeliveries: 既存配送配列 | 空を許す。受領をCoreから生成しない |
| leaseEvidence | leaseEvidence: 既存証拠配列 | 空を許す。記録削除を排他解放へ換算しない |
| leaseIntents | leaseIntents: 既存途中意図配列 | 空を許す。対象・世代・exact参照を保全 |
| results | results: 既存結果配列 | 空を許す。Git／実行結果を定義入力から生成しない |
| resultReceipts | resultReceipts: 既存受領配列 | 空を許す。既存の一回受領相関を維持 |
| historyPending | historyPending: 既存固定行配列 | 空を許す。出版確認前に削除しない |
| acceptanceDecisions | acceptanceDecisions: 既存判断Envelope配列 | 空を許す。対象・根拠・世代を同じCASで照合 |
| decisionRecoveries | decisionRecoveries: 既存判断回復配列 | 空を許す。元参照と適用不明を保持 |

Projectの分解は次の全数対応とする。

| 現行Project field | 新Owner・保存位置 | 必須性・変更条件 |
|---|---|---|
| contract | projects[].contract: `crdd-domain/project-state/v1` | Core値の契約へ改訂。実行Contractと兼用しない |
| projectId／milestoneId／repositoryRevision | projects[]の同名field | 必須。別対象・別Revisionへ編集しない |
| generation | projects[].generation | 必須。既存対象改訂の比較を維持 |
| decisionApplicationId | projects[].decisionApplicationId | 既存null／IDを維持。判断適用だけが更新 |
| milestone／objectives | projects[]の同名記録 | 既存定義・局所状態・根拠IDを維持。文書計画と自動同期しない |
| tasks[].definition | projects[].tasks[]: ProjectTaskDefinition | 定義はここだけに保存。ID・依存・範囲・競合の既存属性のみ |
| taskExecutionSelections | managedExecutions[].taskExecutionSelections | 管理実行が存在する場合は完全な固定二役選定が必須 |
| ownerGeneration | managedExecutions[].ownerGeneration | 管理実行時に必須。Coreだけの初期化へ偽Ownerを作らない |
| maximumConcurrency | managedExecutions[].maximumConcurrency | 管理実行時に必須。Core Entity数制限と混同しない |
| 対象参照 | managedExecutions[].projectId／milestoneId／definitionHash | 同じprojects[]の対象と定義Hashへ結合。別正本・新IDではない |

現行保存Taskの実行fieldは、同じ管理実行区画の `tasks[]` へ移す。各行は既存Task IDを参照する `taskId` と、`state / attemptId / operationId / authorityBindingId / startPhase / settlement / resultAcceptanceIds / recoveryObligations / candidateId / retryCount / supersededBy` の既存値から成る。`definition`は複製しない。`cleanupConfirmed / recoveryUnresolved / resultAcceptances` は現在も保存投影であり、新Schemaでも元のsettlement・操作・受領から導出して重複保存しない。

管理実行行がないCore Taskには、上記の試行fieldを要求しない。管理実行行が存在すれば既存必須値・相関検査をすべて要求し、欠測を未実行へ直さない。対象定義を参照する受付・試行・判断・Candidateが残る間は、その定義の変更・削除を拒否する。無関係なCore対象の更新は技術区画をexactに保全する。同じ改訂に対するCore更新と技術更新の片方だけがCAS成立し、自動再試行しない。

管理実行の`definitionHash`はProject／Milestone IDと、受入条件・Objective定義・Task定義の正規値から導く。現在の判断状態やOwner世代を定義Hashへ混在させない。管理Task行は定義と同じ宣言順・ID集合を要求し、別Taskの値を順序補正で取り込まない。純粋な新codecはこの参照を同一Snapshot内で検査する。管理用の既存Task DTOへの変換はメモリ上の導出だけであり、旧形式の保存やCore-only対象への架空Owner・Selection生成ではない。

五Contextの `before / candidate / assertOwner / used`、`initializations.publicationIssued` と `historyAttempts.issued / pending` は保存JSONのfieldではなく、一回出版の私有証拠である。旧新Mapの併存・二重登録・公開DTO化を行わず、元Controller／Hostのfresh確認とI/O前の消費を維持する。ここがSourceで閉じるまで、Writer全面移管とはしない。

Host清掃準備の利用側は任意候補Writerを呼ばず、同じ操作Owner・exact回復参照・固定元版だけを渡す。保存入口が元版の同じOperation、`cleanup:not_requested`、`lease:released`を照合し、`cleanup:pending`だけを導出する。利用側は元版だけを保持し、候補を第二のMapへ保存しない。同じ確定候補が現在版なら読取り・解放確認だけで無書込み成功とし、第三の現在版は拒否する。pending再入場は既存Writerが元版・候補・File実体を再照合する。Host清掃Authorityの取得・消費と物理回収は実行Ownerの責務であり、保存から発行しない。この固定用途化は物理WriterのDomain移管の前提整理であり、移管完了ではない。

### 5.1 区画と更新権限

| 区画 | 意味Owner | 保存時の制約 |
|---|---|---|
| projects内の業務定義、判断対象 | Domain | 操作が指定した定義だけ変更。参照する受付／Attempt／判断改訂を同じCASで確認 |
| queueEntries／intakeBindings | Domainの受付・局所Claim、Coordinatorの横断調停 | 受付世代・同ID内容・対象改訂不変。Coreの定義変更で再作成しない |
| workspaces／results | Domain値、VC技術結果、Coordinator調停 | Git結果をCaller JSONだけで確定しない |
| operations／unresolvedRecoveries | Executorの技術観測 | Core更新ではそのまま保全。技術unknownとexact参照を変更しない |
| leaseEvidence／leaseIntents | Coordinator／既存実排他Owner | 保存Lockと実行Leaseを混同せず、記録削除で解放を証明しない |
| resultReceipts／pendingDeliveries | 結果Owner／受領Consumer | 単一の受領・配送参照を保全。Core更新からACKを生成しない |
| acceptanceDecisions／decisionRecoveries | Domain記録／Coordinator横断判断 | 元対象と適用世代、未解決義務を保全 |
| historyPending／history | 保存出版Owner | 元行Hash・時刻・改訂を保ち、移送確定前に元結果を除去しない |

全体相関検査はDomain `state/validation.ts`、局所遷移は各Entityの`crud.ts/validation.ts`、物理保存は`storage/state.ts`へ配置する。StorageからSchedulerやProviderを呼ばない。

### 5.2 一回の更新順序

1. Domain操作がContext・入力・対象範囲・現在認可を確認する。
2. 既存の短期保存Ownerを取得し、Root／実体・現在state／pendingをboundedに再読する。
3. expected全体改訂・Hashと対象定義Hash、受付・参照相関を確認する。競合は再送せず返す。
4. Domain操作が同じ排他内で現在認可を再確認し、局所候補と全体相関を検査する。任意Snapshotを受け付けない。
5. 既存出版手順で候補を書き、既存の確定前記録・atomic replace・読戻しとHash／実体同一性を確認する。
6. 排他解放を確認した後、確定版と結果を返す。発行後の不確実性はunknownと元参照へ結合する。

保存中に外部AI、Docker、Git、長い待機、通知を行わない。認可確認は有限のローカル既存状態確認に限り、ネットワーク認証待機を短期Lockに持ち込まない。Lockの取得／解放／Owner喪失の意味は既存Kernel実装を再利用し、marker削除をOS Lock解放にしない。

保存Fileの16MiB上限・正規UTF-8・固定Schema・未知区画拒否、単一Root、前後実体確認、元Hash、履歴の順序を維持する。一般`committed-json.ts`の256KiB・sidecar方式へ無条件に置き換えない。

### 5.3 一回使用証拠

五Context（authentication_unknown_closure／runtime_repair／current_completion／current_delivery／current_history）とinitializations／historyAttemptsの物理出版順序は保存Ownerへ残す。元Controller／Host・実行Leaseの真正MapはExecutor／Coordinatorの実Ownerが保持する。同じ証拠を二重登録・JSON保存・公開CRUDから再生成しない。

一回消費は既存どおりOwner確認・I/O前。失敗後も未使用へ戻さない。元Ownerの同期assertOwner／revalidateを各I/O前後に維持し、処置前の一回確認だけへ縮めない。通常完了とRecoveryの証拠を相互代用しない。Contextごとの宣言・呼出し・fresh確認を実装候補で照合するまで旧経路は撤去不可。

### 5.4 失敗・再入場・終了条件

| 失敗窓 | 結果と次の処置 |
|---|---|
| 入力／認可／改訂不一致、出版前拒否 | blocked又はconflict。AI・技術Effectを発行しない。作成済み短命物の有無は別確認 |
| Lock取得不能／解放不明 | 確認できた範囲を返す。解放不明を成功とせず、Lock Fileの強制削除なし |
| 書込み前後・replace・読戻し不明 | unknownと元の出版段階・回復参照。空状態や自動再試行へ変換しない |
| 保存確定後の応答喪失 | 同じ対象・受付IDを照会。全CRUDへ新たな厳密冪等性台帳を追加しない。再POST自動実行なし |
| history確定・state未確認 | 同じ行Hash・時刻と既存pendingを再観測。重複append・元参照削除なし |
| Core更新とClaim／回復更新の競合 | 同一CASで一方が競合。古いAutomation区画で上書きしない |
| 未知Schema・不正／観測不能区画 | 拒否。単独Coreのために欠落区画を空で補完しない |

通常履歴は既存30日・設定可能の保持を使い、未解決・pending・必要な受領を期限で除去しない。正式Evidenceの保存とは別とする。今回、Runtime・履歴・保持物の読取り／移行／削除は行わない。

## 6. 配置・移行と利用側

保存先`.crdd/domain-model/{state.json,state.lock,state.pending.json,history.jsonl}`は第一候補であり有効化しない。製品コードは新形式だけ、旧形式移行はフロントAIの確認手順という既存方針を維持する。

移行前に旧新Rootの対応、実Owner非稼働、未解決義務・受付・受領・履歴／pendingの整合、コピー後読戻し、旧新同時更新禁止、有効化と切戻し可能条件を確定する。新側不存在を新品許可にしない。初期化APIも未知の旧領域を自動清掃しない。設定`.crdd/config/ai-selection.json`は既存位置を維持する。

MCP／Workbenchは共通Domainへ直接接続し、Core構成ではCoordinatorの静的loadを必須にしない。単なるoptional引数やdynamic importだけで独立成立としない。実行導入時だけCoordinator／Executorを構成し、未導入と実行故障を区別する。既存助言・編集を無断で削除しない。

## 7. 実装構造・観測

Source配置の候補はDomainのobjective／task／attempt／decision／workspace／queue／ai-selection／stateとstorageである。型はtypes、局所操作はcrud、値検査はvalidation、読取り投影はquery、物理保存はstorageへ置く。Capability内barrel、public-*.ts、汎用Managerを増やさない。

2026-10-27の初回Source移管では、`objective/types.ts`に既存の計画・Objective／Milestone定義と状態記録の六宣言、`task/types.ts`にTask定義を配置した。`objective/validation.ts`は既存Planの閉形式・容量・Path範囲の検査、`repository/path.ts`は既存相対Pathの文字列規則を所有する。Coordinatorの計画受付・状態初期化・再計画・Task利用側はDomain Root APIを参照する。これは値モデルと検査の移管であり、DAG・ID相関の最終検査は引き続きCoordinatorの`state/create.ts`が行う。保存Writer、Core CRUD、分解済みTask群の公開受付は未接続であり、Core単独稼働の成立とは扱わない。

続くSource更新で、Domainの計画検査へID相関・依存循環拒否と`CallerTaskInput`の一対一固定を追加し、Coordinatorの受付Hash二箇所・Task別入力搬送・MCPの閉Schemaを接続した。Objective受付結果は`crdd-coordinator/orchestrator-objective-intake/v2`、MCP Adapter説明はv4。保存SchemaやMCP Protocol版は変更しない。

設定の`ai-selection/types.ts`・`ai-selection/validation.ts`・`storage/ai-selection.ts`はDomainが所有する。技術Catalogの値は信頼したHostがAI Adapterから得て検査・読取り・保存へ明示注入し、HTTP／MCPの要求から受け取らない。Storeは既存1MiB上限・固定Path・CAS・短期排他・出版読戻し・一時物参照を保つ。共通JSON解析も`plain-data/json.ts`へ移し、AI Adapterは同じ関数を利用する。Workbenchの設定入口はDomainへ直接接続する。Coordinatorの実行Snapshot WriterとPlan／Task／Decisionの一般CRUDは引き続き未完了であり、Core全体の単独稼働を完成としない。

共通保存の`storage/state.ts`は、固定五ファイルの読取りと三つの確定前ファイルの排他的作成を所有する。`readRuntimeStateFile`と`createRuntimeStatePendingFile`は同じ取引の実体Map・既存Owner照合を受け、現在境界の確認、nlink、上限、wx、発行前記録、fsync、close、読戻しの既存順序を保持する。ファイル名は実行時にも閉集合検査する。任意Snapshot・認可・状態遷移・CASを受け持つAPIではなく、Context消費、技術状態判断と取引全体の確定は今回まだCoordinatorに残る。新しい保存先・Lock・Registryは追加しない。

`flushRuntimeStateFile`も同じ保存Ownerが提供し、状態pending・履歴pending・履歴正本の三対象だけを受ける。履歴正本は期待実体をopen前に固定し、fstat後にOwnerを照合する。他の二対象はopen前にOwnerを照合し、open後に期待実体を取得する。履歴の二対象だけfsync直前に既存Effect記録を呼び、状態pendingでは作成時の発行記録を利用する。open成功後は例外時もcloseを試み、既存の対象別故障分類を保持する。出版条件、rename、CAS、一回使用証拠、後続読戻しはこの低水準操作へ移さない。

保存途中版の局所再入場規則は、同じDomain保存Ownerの`classifyRuntimeSnapshotReentry`が所有する。元版Hash・次版Hash・Repository結合と初回領域の明示不存在を照合し、出版候補・pending回収候補・拒否だけを返す。観測不能を不存在に変換せず、この分類を状態全体の妥当性、処置Authority、実処置または回収完了の証明には使わない。Coordinator Writerは旧分類関数を保持せずDomain Root APIを同じ呼出し位置で利用する。

続く移管では、判断記録・受入対象／判断入力・保存世代Envelope・回復参照の型を`decision/types.ts`、既存の純粋な閉形式／相関検査を`decision/validation.ts`へ分離した。Coordinatorの判断受付・状態照合・Snapshot codec・保護された判断Storeと試験はDomain Root APIを参照し、旧`coordinator/decision/records.ts`は撤去した。現在Authorityの発行／検証、判断の横断適用、物理保存は移管前のOwnerに残る。判断記録のOwner移管を一般CRUDとWriter全面の成立へ拡張しない。

観測は既存Request／Project／Task／Attempt／Operation／Recovery ID、改訂・Hash、有限失敗分類で相関する。入力本文・回答・Credential・Host Pathを診断へ複製しない。保存成功とTask開始・Provider Effect・cleanup・受領は別の事実とする。

既存単一保存を維持する案を選んだ。二Store化は相関・回復を増やし、巨大Writer丸ごと移管は技術逆依存を残す。登録型のValidator Frameworkは既存の静的Owner分離で不要である。

<a id="runtime-domain-quality"></a>
## 8. Quality引渡し

完全codecの依存閉包では、状態・Task・Workspace・固定選定・修復checkpointの保存型と純粋検査をDomainへ移した。`state/codec.ts`は正規JSON byte表現・UTF-8・既存容量上限・Hash、`state/validation.ts`は単一Snapshot全体の閉形式と参照相関を所有する。技術値の復号は`attempt/validation.ts`・`repair-validation.ts`で行い、実資源観測・現在Ownerの真正証拠・技術遷移の許可は上位の既存Ownerに残す。DomainからCoordinator・AI Adapter・Docker Isolationをimportしない。公開値は実利用に限定し、固定検査集合は利用側から変更できない。

完全codecの初回移管時点では既存v5 Schemaを保持していた。続くSource切替で§5.0.1の新Schemaを既存Reader／Writerへ接続したが、一般CRUD、Domainへの物理Writer全面移管、既存実データ移行、Core単独成立は未完了である。値codecの成功と、物理保存・現在認可・資源不存在・実データ移行は別の成立条件とする。

後続の値境界では、`inspectRuntimePlanDefinition`をCoreの作成途中、`inspectExecutionPlanDefinition`を完全定義、既存`inspectExecutionPlan`を外側Path範囲込みの実行受付へ分離した。`RuntimeProjectDefinition / RuntimeManagedExecution / RuntimeDomainSnapshot`と新形式専用codecを実装し、Rootから新codecと定義Hashを明示公開した。続いて旧codecを撤去し、既存の物理Reader／Writer・Task保存・技術checkpoint・履歴・利用側を新codecへ接続した。管理Taskの更新はCoreだけの兄弟定義と順序を保持し、技術checkpointはCore定義全体を保持する。管理DTOはメモリ投影だけであり、保存正本やCore-onlyへの架空Selection／Ownerではない。一般CRUD・物理Writer全面移管・実データ移行の完了とは区別する。

| 移管した純粋処理 | 現在のOwner | 本番との接続範囲 |
|---|---|---|
| Task更新候補・受領と技術参照の正規化 | `task/crud.ts` | 正規化は既存WriterがDomain Rootから利用する。一般CRUDの永続化APIではない |
| Snapshotの操作・修復・履歴・完了候補と元版比較 | `state/crud.ts` | `prepareCoordinatorState*`等の純粋候補と`validateCoordinatorState*`／出版分類を既存Writerへ提供する。相互参照する候補と比較を同居させ、物理保存・実資源観測・Ownerを含めない |
| 単一保存の改訂・受領不変性・Operation除去相関、閉鎖・退役条件 | `state/transition.ts` | 既存Writerの共通遷移検査と、同じ保存Ownerに束縛したLease不存在・履歴の同期観測による条件検査。内側の受領遷移検査は非公開 |
| 終了履歴の全行codec・期間保持候補 | `state/history.ts` | Domain Rootの`decodeCoordinatorHistoryRows`／`prepareCoordinatorHistoryRetention`。物理File・実排他・現在Ownerの確認は含まず、既存Writerが処置時点で再照合する |
| 修復終了の値条件 | `attempt/validation.ts` | 既存の技術状態検査・Writerから利用する。実資源の観測や処置許可ではない |
| 操作と再起動checkpointの値遷移 | `attempt/validation.ts` | 元の三値・Identity・許可辺を保持する。再起動checkpointとdecoderを同じOwnerへ閉じ、新しいmodule循環を作らない |
| 修復・Session・disposal checkpointの値遷移 | `attempt/repair-validation.ts` | Docker IsolationのMachineとCoordinatorのWriterがDomain Rootを利用する。実Driver・技術処置・処置順の実行は所有しない |
| 保存済み要約からの固定履歴行導出 | `state/validation.ts` | 元内容・行Hashを保持し、物理履歴出版は既存保存Ownerに残る |

上表の移管では関数本文を維持し、履歴行のDecoderだけは同じDomain codecへの旧委譲を直結した。旧Coordinatorの定義・互換re-exportは撤去し、利用側と子Process試験本文もDomain Rootへ接続した。五Context・初期化・一回履歴出版を伴う物理Writerはまだ移管していない。

短期保存時の区画遷移・閉鎖・退役条件もDomain `state/transition.ts`へ実体移管する。Writerが使用する`assertCoordinatorSnapshotTransition`と観測型、Coordinatorの退役処理が使用する四つの既存条件関数をRootから明示公開する。有限の二観測の生成とI/O・現在Owner照合は既存Writer側に残し、同じ短期Owner・元の検査位置で呼ぶ。値又は観測callbackだけを保存Authorityにせず、汎用validator登録・新Map・旧配置の互換Fileは追加しない。これは物理Writer全面移管の前提であり、その完了ではない。

正規byte表現の生成と内容Hashは、保存候補の同一性・CASを検査する利用側向けに`encodeRuntimeStateValue`・`hashRuntimeStateContent`として公開する。生byteの内部復号、文法の正規表現実体、未利用の局所validatorはRoot公開しない。Hash一致を真正性・操作許可・出版成功へ読み替えない。

本節は既存QA項目の追加シナリオであり、新Local Item・新しい総数を発行しない。値検査・設定保存・入口搬送の限定試験は実施したが、表が要求するCore CRUDと単一保存の全体シナリオは未完了。既存Passや文書レビューを新実装全体の成功根拠にしない。

| 導出キー | ARCH-ID | 対象 | 正常条件 | 反証条件 | 観測 | 終了後条件 | 試験段階 | QA Owner | 既存項目 |
|---|---|---|---|---|---|---|---|---|---|
| runtime-domain.core-independent | ARCH-000004 | Domain／MCP／WB | Coordinator読込み不能でもCore CRUD・再読 | 静的import・未導入からAI起動 | module load、実API結果、Effect件数 | 子Process・試験Root終了確認 | IT／ST | QA-000003 | PRL-IT-012、PRL-ST-001 |
| runtime-domain.definition-boundary | ARCH-000004 | 定義／判断API | 対象Hashと全体CAS一致で局所変更 | 参照中変更・技術field・別対象Hash | before／after全区画、拒否理由 | Automation・非対象不変 | UT／IT | QA-000003 | PRL-UT-006、PRL-IT-012 |
| runtime-domain.current-access | ARCH-000004 | 全公開API | 同じ主体・Root・対象で現在認可 | 失効、Rootだけ有効、返却前失効 | 認可呼出し、返却値、書込み発行 | 内容非開示・正本不変 | IT | QA-000003 | PRL-IT-012 |
| runtime-domain.atomic-preservation | ARCH-000011 | 統合state／Queue | 単一CASで相関保存 | CoreとClaim競合、未知区画、stale Automation | 実保存・読戻し・元Hash | 一方だけ確定、unknown／元参照維持 | IT | QA-000008 | RDL-IT-001、RDL-IT-003 |
| runtime-domain.publication | ARCH-000011 | state／pending／history | 出版・読戻し・解放確認 | write／replace／応答／解放喪失 | 実Filesystem・別Process再読 | 同ID相関、重複履歴なし | IT／ST | QA-000008 | RDL-IT-003、RDL-ST-002 |
| runtime-domain.one-use | ARCH-000008 | 五Context・初期化・履歴 | 元Owner・正規順序で一回確定 | 偽造・再使用・Owner失効・種類交差 | 一回消費と各I/O前後確認 | 失敗後も再利用不可 | UT／IT | QA-000003／008 | PRL-UT-006、PRL-IT-013、RDL-IT-003 |
| runtime-domain.selection | ARCH-000004 | AI設定 | Domain検査＋信頼Catalog、固定選定不変 | Catalog偽造・未照合・保存競合 | 結合値・公開結果・呼出し閉包 | AI／Docker発行0 | IT | QA-000003 | PRL-IT-012 |
| runtime-domain.migration-gate | ARCH-000011 | 保存先切替 | 別途承認した手順で照合 | 旧新併存・Owner不明・未解決欠落 | 合成旧新とexact元参照 | 自動削除・有効化0 | IT | QA-000008 | RDL-IT-001、RDL-IT-004 |

各Entityについて、責務・Property・状態・Lifecycle・不変条件・操作・依存・保存・失敗／回復・検証を§1〜8へ対応した。新しい操作の実装時には上表の母集団・試験入口・観測手段を固定し、Source追従やモック成功だけで合格にしない。

<a id="runtime-domain-questions"></a>
## 9. 判断済みの範囲と有効化前の条件

| 判断 | 推奨案 | 影響・代替／保留時 |
|---|---|---|
| Plan ID・Task属性 | 既存Project／Milestone＋定義Hash、既存属性のみで進める案を人間承認済み | 新属性・新IDは今回追加しない。保存Schemaの技術的分解とは別に扱う |
| 既存判断・根拠と受入 | §4.1の既存記録・根拠ID・局所条件をDomainへ移す方針。非管理完了機能の追加案は撤回 | Evidence本文の自動検証・任意Taskの手動完了を新設しない。元の受入前提と利用側未接続は保持 |
| 保存先の切替 | 実装・合成検証後、フロントAI手順と旧新確認を提示する順序を人間承認済み | 実保存先の有効化・保持物操作の許可は別。今回まだ動かさない |

移管を止める新しい業務機能の採否判断は現在ない。Schema全field・現在認可・五Context・Callerが分解済みTask群を渡す公開契約の具体接続を実装前に固定し、既存で未接続の利用側を完成済みとはしない。文書の自動同期や上位計画の再実装を、この差の解消手段にしない。実AI・Docker・保持物の操作許可は本書から発生しない。
