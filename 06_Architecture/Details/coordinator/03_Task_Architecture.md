# CoordinatorのTask・Objective管理アーキテクチャ

## 共通定義と実行Admissionの分離 — 2026-10-27

次の公開受付は[Caller Task Graph入力](../domain-model/05_Runtime_Domain.md#caller-task-graph-intake)を目標とする。PlanのTask定義とTask別の既存実行指示・Review条件を厳密に結合し、本文を保存せず同じ受付Hashへ固定する。現在の1＋1包装と共通指示コピーは置換対象で、API・Schema・CLI／MCPの新形式追従は未実装。新しい計画器・自動再送・文書同期は作らない。

ここでいうObjective／Milestoneは[実行内の集約](../domain-model/05_Runtime_Domain.md#document-and-execution-ownership)であり、CRDD文書の目標／Milestone／WBSと自動対応しない。実行Taskの計画分解はCallerが所有する。現行の公開planObjectiveは1 Objective＋1 Taskへの機械変換であり、文書解析やCallerの複数Task搬送の完成を意味しない。文書更新は明示的な依頼範囲に限り、結果から上位文書の進捗・採用を生成しない。

[Runtime Domainの公開操作](../domain-model/05_Runtime_Domain.md#runtime-domain-api)を定義・判断・受付の正本とする。Plan保存は実行受付ではなく、受付も開始ではない。Coordinatorは同じ定義改訂をAdmissionへ渡し、Scheduling・Claimと実行権限の横断調停を所有する。定義変更・対象Hash・CAS・管理実行記録の相関を維持し、Task編集からAttempt／cleanupを変更させない。既存判断記録・根拠ID・局所受入をDomainへ移し、技術完了・Queue／Workspace相関は元Ownerで維持する。非管理完了APIを追加せず、既存受入条件も緩めない。

<a id="task-acceptance-execution-boundary"></a>

## Taskの耐久受付と実行開始の分離 — 2026-10-25

状態: 設計原則は人間採用済み。受付分離と別Process検証Clientの実装・限定実HTTP・関連回帰・独立確認は完了した。同Process検証Clientの過去の期限超過と元ECONNRESETの原因は未確定であり、実AI・全利用側の完成を表示しない。検証Clientの分離は製品のWorker／Queue追加ではなく、[QAの検証構成](../../../07_Quality/Definitions/QA-000003/quality_definition.md#耐久受付と実行開始の分離の検証条件--2026-10-25)として扱う。

Taskの受付（Task Acceptance）は、認可・入力検査済みの要求を同じRequest IDで追跡可能な状態へ耐久保存したことを意味する。実行開始やEffect発行の成立を意味しない。受付保存に失敗した場合はacceptedを返さない。

| 段階 | 既存状態と責務 |
|---|---|
| 耐久受付 | `singleTask.phase=accepted`、Queueはqueued。Request IDを返す前に受付記録を保存し、同じTask Ownerが取消Controllerと継続Promiseを保持する |
| 開始準備 | 受付返却へ実行準備を結合せず、一度イベントループへ戻った後、同じOwnerが既存Leaseを取得しstartingを保存する。新しいReserved状態やQueueは作らない |
| 実行とEffect | Taskの進行表示runningはProvider Effect開始の証明ではない。操作相関、Provider開始通知、外部送信等は既存の技術lifecycle記録で別に観測する |
| 終端・再入場 | 同じTaskの結果・回復参照・Lease解放を既存Writerへ保存する。Process喪失後は保存済みIDから照会・回復し、失われたPromptを復元・再送しない |

HTTP Handlerは耐久受付結果を待ち、実行準備や実行完了は待たない。Browser Formの既存303応答は維持し、Task結果のacceptedと実行成功を混同しない。HTTPの正常応答・Client切断・応答送信失敗はTask Ownerを破棄せず、自動的なTask取消又は再送へ変換しない。明示Cancelだけを同じRequest IDのControllerへ渡す。Ownerのcloseは同じ継続Promiseをabortしてjoinし、結果不明や回復義務を消さない。継続を追跡しないfire-and-forget呼出しにしない。

開始前の取消も既存の開始前停止・終端保存・Lease解放へ通す。受付後・Lease取得前にProcessが終了した場合は、fresh Ownerがaccepted記録を既存の未開始終了経路へ接続する。受付の応答喪失は未受付やEffect 0の証明ではない。現在のAPIは同文の新規依頼と再送を識別するClient受付キーを持たないため、自動再送せず、既存の現在IDの観測・照会へ進む。新しい冪等性台帳や保存形式はこの分離へ追加しない。

検証は既存`PRL-IT-013`とWorkbench境界の`ERB-IT-021`へ接続する。受付前保存失敗、accepted返却と開始準備の順序、直後取消・close、受付後Lease／starting保存失敗、fresh再入場、Client切断・応答喪失、同Ownerの複数受付拒否を分ける。通常の同期保存が他のHTTP要求へ及ぼす影響も実HTTP・実保存の合成試験で確認し、元ECONNRESETの解消又は実AI成功へ一般化しない。

## 公開操作とObjectiveの再設計方針 — 2026-10-24

状態: 六Sourceへの責務分配と本番public-*撤去を実装済み。Objective連続回帰64件は成功し、Workspace／品質受入の後続結合36件も成功。基準Sourceは`5ccdc54a0`であり、以下の目標全体を実装済みとは表示しない。実施段階・利用側・移行は[再設計計画](../../../99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md)が追跡する。共有型を`types.ts`、進行とTask入力変換を`execute.ts`、本番構成を`composition.ts`へ分配した。`plan.ts`は計画検査に限定する。残る公開契約の切替は未完了である。

Objectiveは次の六Sourceを目標とする。要求固有の型・検査は`request.ts`、共有するObjective型・依存契約は型専用`types.ts`、計画の構築・検査は`plan.ts`、進行・Task委譲と実行結果の引渡しは`execute.ts`、再計画判断は`replan.ts`、既存の具体依存と受付接続は`composition.ts`が所有する。実行集合・Objective結果・Workspace結果の検査を計画に同居させない。Task再試行や技術RecoveryをObjectiveへ再実装せず、同名検査の統合は文法・拒否条件の同一性を確認してから行う。

旧受付Fileの全体改名ではなく、実行判断・共有型・Task入力変換を実Ownerへ分配する。`execute.ts`から具体依存組立てへの値逆依存を作らない。型専用の`types.ts`は新しいRuntime初期化や副作用を持たない。

同様に、受入判断は`decision/acceptance.ts`、人間判断とPrincipal観測は`decision/lifecycle.ts`、状態照会は`state/query.ts`へ統合する。Principal・Root・Revision・保存接続と各処理の失敗境界を消さず、公開性を表すFileを別名で再作成しない。

正式APIは[正式API・CLIの責務境界](01_Architecture.md#formal-api-cli)に従う。src/api.tsを正式操作の境界とし、Rootは同じAPIの明示公開だけを持つ。内部Factory・Writer・遷移はRootから除き、Ownerの直接試験と公開操作の結合試験を分ける。

最初のObjective構造単位では、Rootの名前・署名・型／値区分、CLIの動作、保存六Sourceの本文・Schema・CAS・排他・順序を維持する。新API・CLI文法・認証・AI選択設定は後続の契約変更として別に検証する。旧Pathの互換barrelは残さず、直接利用側・検証用閉包・登録を実Ownerへ同時追従する。

## 保存統合B案の採用 — 2026-10-22

Task／Objectiveと単発Executionの保存は[単一保存Lifecycle](04_Task_Detailed_Design.md#unified-storage-lifecycle)へ統合するB案を採用した。業務世代と保存改訂を区別し、技術cleanup・exact回復義務・受領本文は一意な元事実と参照から扱う。Source候補は単一Writerへ接続済みで、固定回帰・最終独立確認は継続中である。旧物理記録の移行済みや実境界全体の完成は主張しない。

## 統合後の名称 — 2026-10-22

現行Packageと公開TypeScript APIはCoordinatorへ統一する。Task／Objectiveの進行とExecutionの単発実行は同Package内の責務であり、独立Orchestrator Packageは残さない。保存更新の実効排他は共通の短期OS Owner一つで、Task実行Lease・Host世代・Provider Home等の別寿命の排他とは分ける。旧公開名の互換aliasは提供しない。

## Cの現在の物理Owner — 実装候補、検証中

本書はTask／Objective・判断・状態管理の設計正本を維持する。実装Packageは旧単発実行と統合した`40_Develop/coordinator`、公開名は`@qual-lab/crdd-coordinator`であり、独立したOrchestrator Packageは撤去した。以下のC前の記述と基準件数は履歴上の範囲を示す。現行のSource Pathは統合後の実体へ接続し、実装の単一性・公開入口・保存・利用側の回帰を完了するまで、C全体の成立を主張しない。

Task側の論理69 Sourceと旧単発実行側の81 Sourceを、同じTree内の別責務として維持する。下記の純粋・業務・保存等の表はTask側の分類である。全150 Sourceの分類試験は、別途Execution71、Runtime CLI4、同意Decision4、技術Storage2も明示列挙し、未分類・重複を拒否する。型専用の`CoordinatorWorkspaceResult`参照だけをExecutionの値契約へ許可し、Executionの実行時閉包を純粋集合へ昇格しない。

<a id="consolidated-source-target"></a>

## 統合後の責務境界とSource構成 — 2026-10-22

単発Executionを吸収してCoordinatorへ統合した。保存統合Bも採用済みであり、現在のSource候補は共通Owner・単一保存へ接続している。二Packageを同じ形へ揃えることやFile数削減を完成条件にしない。移管元保証は[統合計画](../../../99_Roadmap/Changes/CHG-000082/coordinator-consolidation-plan.md)で追跡し、新方式の回帰・独立確認と区別する。

| 最終責務Owner | 所有する判断・処理 | 所有しないもの |
|---|---|---|
| Objective／Task | 目標、計画、Task Graph、予約、Attemptの進行、再試行・再計画、Provider／Model選択戦略 | Provider固有CLI、隔離基盤の技術処置 |
| Execution | 単発AIの開始・取消join・結果返却、元操作・選択Grant・Authority相関、技術回復結果の接続 | 目標やTask Graphの進行、Workspaceの採否 |
| Decision | 人間判断、Acceptance、外部送信同意とGrantの意味・寿命 | Dockerの通信強制、Providerの技術Catalog |
| Workspace | 作業対象と継続寿命、Candidateの明示固定・採否・取込要求 | Git実操作、AI完了だけによる自動Commit／Merge |
| State | 意味上の現在状態、投影、照会 | 物理保存・技術回収の実処置 |
| Storage | 平坦な単一Snapshot、共通Writer・短期Owner・CAS・履歴・耐久受領。Task反映と内部配送待ち解除を同じ更新で確定 | 技術回収の実処置、保存値だけからのAuthority発行 |
| 専門Package | AI AdapterのProvider計画・結果解釈、Docker Isolationの隔離・回収、Platform AccessのOS技術、Version ControlのGit操作 | 上位の業務進行・採否・外部送信同意の代行 |

統合前の二Packageに関する本節の説明は、現在は同一Coordinator内のTask／ObjectiveとExecutionの責務境界として読む。以下の逆依存禁止はExecutionからTask／Objectiveへの依存禁止として適用し、同一Package化を逆依存の許可としない。

```text
coordinator/                  # Cで現Orchestratorを改名した後の目標
├ bin/
│ └ coordinator.ts
└ src/
  ├ cli/
  ├ objective/
  ├ task/
  ├ decision/
  ├ workspace/
  ├ execution/
  ├ state/
  ├ storage/
  └ index.ts
```

現Orchestratorに空の`execution/`、Facade、汎用Port Frameworkを先行作成しない。既存`CoordinatorExecutionPort`等を今回の接続契約として再利用し、最終的な統合では不要なPackage間中継だけを除く。TaskはAttemptを管理し、Executionは解決済みの作業対象で単発実行する。開始通知・取消join・結果正規化を削除条件へ含め、型だけのPortを重複実装と同一視しない。

RecoveryはTaskとしての次の処置、Executionの元結果・資源・回復参照の確定、DI／PAの技術回収を分離する。Host資源はExecutionの許可・相関、DI／PAの技術処置、Storageの耐久参照を一つの巨大Ownerへ集約しない。外部送信同意はCで`external-send/`からDecisionへ直接移管する目標だが、現行の強制Gateと同意Store／Grantを未接続のまま撤去しない。

活動の公開複合Readerは`state/observation.ts`、値契約・検査・Cursorは`state/activity-{types,validation,cursor}.ts`が所有する。現在状態とExecution Intelligenceの分析用実行履歴は独立して観測し、EIをTask進行やRecoveryの状態正本にしない。出所・Cursor・ページングとWorkbench／MCPの共通利用を維持する。保存Binding導出は`state/validation.ts`が所有し、認証・認可IdentityやRoot能力へ昇格しない。Taskと技術実行の状態正本は共通Storageへ統合し、EIまで一つの履歴へ混ぜない。

<a id="c-integration-three-connections"></a>

## C統合の三接続契約

基準`664820ba1`の三接続を照合した。単一Packageにすることと、異なる責務を一関数にすることは区別する。旧CoordinatorのExecution実体を吸収し、Task／Objectiveの進行とExecutionの単発実行を同Package内で直接接続する。これはCの接続設計であり、Source・公開入口・保存の切替成立ではない。

| 接続 | Task／Objectiveに残すもの | Executionに残すもの | 除去又は削減するもの |
|---|---|---|---|
| `execution/controller.ts` → `execution/controller.ts` | Attempt／Operation／判断権限／Revisionの相関、解決済み対象の構造変換、元Control存続中の配送捕捉、上位結果契約 | 開始・完了の値検査、Executor初回通知の結合、取消一回搬送と元完了join、cleanup／回復参照と結果の正規化 | 旧Package Rootを経由する内部import。二つのAttempt実体は役割が異なるため維持 |
| `task/requests.ts` → `execution/controller.ts` / `execution/result.ts` / `execution/operation.ts` | 現在Root・Profile改訂・認可の再確認、助言の固定Snapshot、実行対象・利用側の束縛、Task受付／保存／再入場 | Executor→Reviewerの順序、元Operation／Grant／Packet／Home相関、単一Runtime・Control、取消・回収・終端・配送閉包 | Package間の参照だけを直接接続。引数の並べ替えとconsumer固定を持つclosureは削除しない |
| `task/recovery.ts` → `execution/recovery.ts`／`storage/state.ts` | Task義務・世代・同じAttempt／Operation／Recoveryと、単一Snapshotの耐久受領事実・次処置 | exact技術回収、Host／Home、終端・履歴・固定結果、私有Capabilityと一回性 | 不要な中継と別ACK Writer／後続配送解除段。技術回収と業務受領の意味は混同しない |

Task開始通知と耐久受領は別の事実である。元Controlの結果読取り参照は開始直後・Control除去前に捕捉する。通知・捕捉失敗でも開始済みTaskの完了と取消join・回収を待つ。技術終端・cleanup・実履歴行の確認後、同じSnapshot候補でTask受領と内部配送待ち解除を確定し、readbackとOwner解放を確認する。

Workbench／CLIの一時的な結果返却と、Objectiveの耐久受領ACKは同じ利用方針へ統一しない。`request-composition.ts`内で組み立てるTask依存`startTask`コールバックの第5引数は実行対象、本番`startRuntimeOwnedCoordinatorTask`の第5引数はconsumer・第6引数は実行対象である。単なる関数参照への置換は意味を変えるため不可とする。助言と編集の権限・入力・終了結果も維持する。

上位の`task/dispatch.ts` / `task/types.ts`は具体組立ての同居候補であるが、公開Factory・依存型・専用UT・本番受付が利用しているため、削除確定ではない。既存`CoordinatorTaskRecoveryPort`の注入契約、固定Root／Binding、依存欠測のnull、観測callback例外を結果へ混ぜない動作を維持し、利用側・公開API・試験の追従後にだけFactoryの削除可否を確定する。別名Facadeや新Portは作らない。

通常のControl由来結果読取りと、Process喪失後の耐久記録からの再入場は別入口として維持する。私有MapやCapabilityをID・Pathから復元しない。技術回収だけで受領を補完せず、保存済み応答喪失は同じ候補の再入場で一重確定する。別のACK保存・配送終了段を追加しない。

Cの物理移管時は保存Schema・Writer・呼出し順を凍結してspecifierだけを追従した。その履歴上の制約は保存統合Bの採用範囲で解除済みであり、現在は単一保存Lifecycleが正本である。旧七Sourceの一致は移管元の保証として保持し、現在のbytes一致やB成立の証拠へ流用しない。

保存統合Bの単一性は、公開入口から共通Owner・Writerへの接続と、Task・Operation・受領・履歴・利用側の回帰で確認する。過去の物理移管の記録は[三接続対応](../../../99_Roadmap/Changes/CHG-000082/coordinator-consolidation-plan.md#28-c統合の三接続対応と切替条件)を参照する。

<a id="c-integration-entry-boundary"></a>

## C統合の公開入口・同意の配置 — 設計、Source切替前

統合後のCLIは単一`bin/coordinator.ts`を入口とし、`cli/command.ts`が用途選択、`cli/command.ts`がProject／Taskの実受付を所有する。入力文法、doctor引数、回復表示、Signal取消はそれぞれ`request-input.ts`、`options.ts`、`recovery-report.ts`、`cancellation.ts`へ残す。template固有のProject／Task振分けは本体へ接続してから撤去し、同Process・元stdin・cwd・環境・取消joinを維持する。現在の本番Project／TaskはJSON出力のみであるため、未使用Human表示の旧Candidate案内は検証義務を実JSONへ移して撤去できる。doctorのHuman表示は別責務として維持する。

外部送信の意味・記録・保存・Grant・方針は`decision/external-send-{consent-record,consent-store,grant,policy}.ts`が所有する。端末の技術I/Oと終了確認は`decision/external-send-grant.ts`へ置き、Decisionから既存実体をprivate importする。同意Hash・期限・一回性・元Task相関と同じProcess安全状態を維持する。配置変更で同意Gateを省略したり、私有Grantを再構築したりしない。

Package Rootは外部利用側が必要とする操作・検査・値契約を明示公開し、同Package内部は実Ownerへ直接接続する。現在の実利用集合だけで安定公開義務の不存在を推定しない。試験だけが利用する公開名は、その試験が公開保証と内部実体のどちらを検査するか確認し、移管できたものだけを非公開化する。物理統合の初回候補では未確定の公開名を保持でき、互換Facadeは新設しない。[全数切替表](../../../99_Roadmap/Changes/CHG-000082/coordinator-consolidation-plan.md#29-cの入口公開api同意設定の切替表)が具体名、利用側、設定と保存参照の許可差分を所有する。実装・公開入口の成立は未確認である。

## A段階の状態責務整理（2026-10-21）

実作業基準`1afbc6df4`から、[統合計画](../../../99_Roadmap/Changes/CHG-000082/coordinator-consolidation-plan.md)のAを実施する。今回の対象は旧`state/transitions.ts`の純粋な値契約と状態遷移であり、業務操作の組立て・Task配送・保存基盤の変更は後続単位とする。以下は配置契約であり、回帰・独立レビュー前に移管成立を主張しない。

| 配置 | 所有する責務 |
|---|---|
| `state/types.ts`、`task/types.ts`、`objective/types.ts`、`state/create.ts`、`state/validation.ts` | 型・純粋初期構築・共有検査を所有する。2026-10-27の承認Afterに従い旧modelを分解 |
| `state/types.ts` / `state/projection.ts` | 公開投影型、投影生成、状態間相関・意味の検査 |
| `task/scheduling.ts` | 容量・競合Path・依存から次のTaskを選択 |
| `task/lifecycle.ts` | 予約・handoff・開始・終了・Effect前終了・部分再計画・Task再試行の純粋遷移 |
| `task/recovery.ts` | 回復義務・Owner喪失・再試行可能化の純粋遷移 |
| `task/acceptance.ts` | 通常結果の受領・回復結果の確認の純粋遷移 |
| `task/types.ts` | 回復参照・進行通知・技術回復Portの型 |
| `decision/transition.ts` | 人間判断・Objective／Milestone受入判断の純粋遷移。I/O入口のlifecycle／acceptanceとは依存閉包を分離 |

依存はModel→選択→投影の利用方向とし、Modelから選択・投影・遷移へ逆参照しない。各遷移はModelの値契約を利用するが、Filesystem・Lease・Docker処置を所有しない。共有検査は内部exportとして必要な利用側だけが参照し、Package Rootの公開集合を増やさない。旧Fileは再export中継として残さない。既存の公開Symbol名・型Shape・状態／reason・Contract・永続形式・保存先と、予約保存／開始確定／結果受領／ACKの順序は変更しない。

Workspace再編の現在目標は[作業領域・責務契約](05_Workspace.md)。通常AI入口、Workspace寿命、Task／Queue、コード候補の固定要求・採否、Promotion統制を本領域が所有する。Git・認可・隔離・Domain技術を所有しない。以下のBundle依存・Workspace未識別Queue等は基準実装の移行元であり、新方式の本番接続済みとは扱わない。

### A段階の公開操作と実行結果の配置

状態責務分割に続き、旧`operation-composition.ts`を次の実Ownerへ分配し、旧Fileを撤去した。Aの対象回帰・限定独立レビューは完了したが、実行系全体の統合と全体QAは未完了である。[今回の結果と限界](../../../99_Roadmap/Changes/CHG-000082/coordinator-consolidation-plan.md#7-公開操作結果検査の移管とaの区切り)を参照する。

| 配置 | 所有する責務 |
|---|---|
| `objective/composition.ts` | 公開受付、本番実行依存と開発用構成の組立て |
| `objective/execute.ts` | Objective受付後の検証、単発Task入力変換、進行、結果と回復参照の引渡し |
| `decision/lifecycle.ts` | 人間判断の本番依存組立て・公開実行。判断Storeの六操作は、同じ短期保存Owner内からDomain `decision/crud.ts`の固定候補／投影を呼ぶ |
| `decision/acceptance.ts` | 明示受入判断の認証・Repository検証・保存への接続 |
| `state/query.ts` | 状態照会の認証・現在Snapshot確認・読取りへの接続 |
| `execution/diagnostics.ts` | 直列診断Reporter、二つの既存本番Reporter、失敗・timeout・disposeの終了契約 |
| `state/result.ts` | 公開結果のContractとRuntime Data失敗の純粋な結果投影 |
| `task/types.ts` | Taskの入力・実行・観測・結果・回復の共有型。実行Moduleの二Contractは型専用で参照する |
| `task/dispatch.ts` | 固定Contractと単発結果・Runtime回復参照の相関検査、予約・handoff・開始・保存・結果受領・配送・Queue終了の既存順序 |

Objectiveの開発用構築だけがDecision／Stateの実行関数を一方向に利用し、逆依存は作らない。診断は上位公開操作へ依存せず、本番Reporterは各一つを維持する。既存と同じIdentity検査をModelの内部関数へ統合し、戻り値の型判定注釈だけ補う。結果検査には元のRuntime発行回復ID集合を渡し、単なるDTO形式検査へ縮小しない。旧組立てFileやCapability別barrelは残さず、Rootの公開196宣言、公開引数・結果、永続契約・認証順・同意Hash・取消と回復の順序は変えない。

非公開実装の検証はCoordinator所有試験へ置く。Objectiveの選定搬送は、Producerの入力変換とConsumerの要求検査へ分け、同じ設定由来のExecutor／Reviewer組を照合する。Home利用許可はoperation・provider・Home実体／保護へ限定し、完全選定を保持するModel Grant／Packetとは分離する。モデル側との相関はoperationとproviderで行い、[Home許可の契約](01_Architecture.md#74-provider-homeマウント許可)に従う。公開APIの追加、試験専用の製品中継、純粋な搬送だけによる下位実行成立の主張は行わない。

Workspaceの内部操作は`manageCoordinatorWorkspace`、Taskごとの対象観測は`resolveCoordinatorWorkspaceTaskTarget`、値契約は`CoordinatorWorkspaceRequest`／`CoordinatorWorkspace`としてPackage Rootから公開する。具体保存・Lease・VC接続と、実Provider／Surface・採用取込の未接続は[状態・資源詳細の接続表](04_Task_Detailed_Design.md#workspace接続の実装順序と移管先)に従う。内部のHost Path投影を外部Surfaceへ直接返さない。

成果物種別: Architecture詳細設計
詳細設計領域: coordinator
状態: Candidate

Windows adapterの未使用な`observeContainerHostRecoveryState`と、それだけに依存したcleanup部分保証を撤去する。旧AppDataの全域在庫をOrchestratorへ公開せず、現在Task／回復の本番接続はCoordinatorの固定Repository APIを用いる。正本の`container_host`境界とfixed_image／network／mount／process／cleanupの必要保証は維持する。候補operationの撤去を、必要保証の免除や境界全体の完成へ読み替えない。

## 現在RepositoryのDocker回復接続候補

本番組立ては固定Repositoryを検証したRootをCoordinatorの用途限定公開APIへ渡す。回復と相関解決に旧AppDataの全域探索を使わない。相関解決は現在stateの`recoveryCorrelationId`とexact回復IDを使用し、内部Operation IDへfallbackしない。現在状態全数を正常に読めた場合だけmatched／明示不存在を返し、重複・別consumer・保存途中・読取／排他解放不明は停止する。不存在は元Task成功・Provider未発行の証明ではない。

Docker回復は同じ必須AbortSignalを下位へ渡して完了を待つ。固定診断が`awaiting_delivery`で、exact ID・Docker／Host／排他／履歴確認・配送待ち・操作保持の全条件を満たす場合だけ、上位の技術回収済みへ進む。操作除去・Task回復完了をこの時点でtrueにしない。runtime_processの既存判定とは別に扱う。

待機前にProcess相関ID・Queue・業務世代・対象義務を固定し、待機後に取消とfresh読戻しを検査する。差や観測不能なら次の保存を発行しない。技術終端・cleanup・履歴確認の後、一つのSnapshot CASで受領本文・Task参照・該当配送待ち解除を確定する。readback・Owner解放後にQueue整理とretry条件を再確認し、耐久済み段階を巻き戻さない。新Owner・Lock・回復Frameworkは追加しない。

このSource候補は固定Repository・現在相関・非同期待機・原子受領へ接続している。固定回帰と独立確認で、取消・状態／Queue変更・拒否・保存中断・応答喪失を確認する。実Docker、保持②の再入場と全体E2Eは別の未確認範囲である。

2026-10-14の人間判断により、通常実行は[Coordinatorの実行・追跡・配布の三分離](../coordinator/01_Architecture.md#9-通常実行追跡正式配布の分離)へ接続する。CRDD署名済みRuntimeを一回起動するCapabilityの発行・消費・失効は不要とし、現在の要求認可、Repository／用途、元Task／Attemptと取消・結果・回復の相関を保持する。Commit／Hashを新しい実行Capabilityにしない。旧公開組立てのissuer／revokerと署名専用Port／Adapterは撤去済みであり、以下に残る署名閉包・署名実境界の旧記述は現在の通常実行Gateへ使用しない。未署名固定入口・必要Artifact・現在許可と必要な実Provider境界の本番接続・検証は、現在の未完了条件として維持する。

統合前候補ではOrchestratorの意味・公開操作を同名領域へ移す計画だった。現在の物理的な詳細設計領域は`coordinator`へ統一している。既存Semantic Keyと保存契約のIdentityは、物理配置とは分けて保持する。旧版のCoveredや保存切替の検証結果を、新配置の実装接続・実境界の成立証明には用いない。

段階5Cでは上位Attemptの記録変換を本領域の`src/task/execution-intelligence-adapter.ts`へ移し、公開入口から利用する。認証済みPrincipalと受入判断の一致検査も`src/decision/acceptance-authority-adapter.ts`で所有し、本領域の本番組立ては同じ公開入口を利用する。物理親Directoryは`40_Develop/coordinator`、Package名は`@qual-lab/crdd-coordinator`へ切替済みである。共通実行・通知と全利用側の接続確認は未完了である。下位Coordinatorの共通Operation記録と上位Attempt記録を重複発行しない責務は維持する。

旧State／Queue／Leaseの移行入力Readerは本番へ残さず、移行はフロントAIの明示手順が所有する。現在Readerは不存在・観測不能・Root置換を区別し、既存意図・証拠とexact参照を保全する。保存先は`.crdd/coordinator/state.json`、通常終了要約は同領域の`history.jsonl`、保持設定は`.crdd/config/coordinator.json`へ統一する。保存形式の変更で業務進行・判断・終了条件を緩めない。保持②は移行・清掃の対象にしない。

本番の上位組立ては`src/objective/composition.ts`、`src/decision/lifecycle.ts`、`src/state/query.ts`、公開業務操作は`src/index.ts`、受付と現在保存の接続も`src/objective/composition.ts`が所有する。Principal観測は`src/decision/lifecycle.ts`、Workspace利用・固定・採否は`src/workspace/operations.ts`、保護された判断世代の保存は`src/storage/decision.ts`へ接続する。Coordinatorには同じ業務Sourceを残さず、個別実行・保護Root等の下位能力を呼ぶ。Coordinator Rootによる上位操作の再公開は撤去済みで、MCP配布入口・Workbench状態観測を本領域へ直接接続した。CLI内部の上位呼出しは撤去済みで、全公開利用側と旧実Runtime Rootの処置は後続確認の対象であり、File移管だけを依存方向の最終完成としない。

## 基本設計との関係

業務操作の公開面はPackage Rootの`src/index.ts`へ統一する。Objective受付、判断、受入判断、状態照会の六操作は各用途の`objective/composition.ts`、`decision/lifecycle.ts`、`state/query.ts`から、既存のPrincipal観測は`src/decision/lifecycle.ts`から明示的に公開する。純再exportの業務中継Fileと`./application` subpathは廃止し、MCP配布入口・WorkbenchはRootへ直接接続する。これはSource公開Pathの互換性変更であり、操作名、通信契約、保存形式、Authorityを変更しない。具象組立てはRootを逆参照せず、必要な実体へ依存する。開発用構築関数や診断内部関数を追加公開しない。Coordinator Rootは上位業務操作を再公開しない。CLIと親Directory・保存Root参照は切替済みだが、旧実Runtime Rootの処置と残る実行接続は未完了のため、公開面の接続だけを全移管完成とは扱わない。

現在状態の照会は`state/query.ts`、Task／Queue操作は`task/queue.ts`、長期Leaseは`execution/lease.ts`、閉鎖・退役条件はDomain Modelの`state/transition.ts`、そのI/O編成はCoordinatorの`state/retirement.ts`が所有する。共通物理Writerは`storage/state.ts`、短期保存Ownerは`storage/lock.ts`、終了要約の保存と期限整理は`storage/history.ts`が所有する。同じSnapshotを同じ短期Ownerの下で保存し、各操作は既存トランザクション内でfreshな現在値を判定する。Task回復は`execution/recovery.ts`が元のexact世代・Task・Attempt・Operation・結果を照合する。技術cleanupと耐久受領は異なる意味だが別保存Ownerへ分けない。

上位のProject／Task／Attempt／Revision相関は`src/task/dispatch.ts`と`src/execution/controller.ts`が所有し、本番組立ては`src/objective/composition.ts`が接続する。通常実行の旧署名資格引数・発行・消費と専用Port／Adapterは撤去済みである。現在のTask・用途別許可と相関入力をCoordinatorへ渡し、上位Adapterに下位Authorityの生成・保存を移さない。Git／Artifact追跡は同一性と相関だけに用いる。上位本番組立ての物理移管は確認済みだが、旧資格3 API・専用静的検査・任意署名Toolの再接続と、共通実行・通知の最終検証は未完了である。

人間判断の一回利用秘密値と照合Hashは`src/decision/decision-capability-adapter.ts`が生成する。上位判断の発行・置換・失効契約が利用し、Provider認証やCoordinatorの実行Capabilityへ転用しない。秘密値の保存・公開範囲は既存判断契約を維持する。

受入判断Record・世代相関と判断回復IntentはDomainの`decision/validation.ts`で検査し、記録型は同じDomainの`decision/types.ts`が所有する。統合保存モデルは同じSnapshotへ接続する。未知欄・Identity差・世代連鎖不整合は拒否してbytesを保全する。Host保護判断の別保存・世代チェーンは維持し、通常履歴の期限処理へ混ぜない。

上位Attempt・判断権限・Revisionと単一Taskの対応付けは`src/task/single-task-adapter.ts`が所有する。CoordinatorのTask専用公開入口を呼び、開始時の上位相関を完了待機中に置き換えない。Task開始・取消・完了形状と下位回復参照の検証はCoordinatorが所有する。Coordinator Rootの上位再exportは撤去済みで、共通Task公開面を推移的に読み込む。CLI配送と保存Root参照は切替済みで、全本番利用側と旧実Runtime Rootの処置は継続中であり、この接続だけを全体完成としない。

候補公開・採用の型・契約定数・保存行検査と保存Portは`src/workspace/record.ts`が定義し、操作は`workspace/commands.ts`、物理保存は`storage/state.ts`が所有する。状態値の正規化・内容Hashは`state/validation.ts`が所有し、Storageも同じ関数を使用する。受領方式とTask受領集合の遷移判断は`task/acceptance.ts`が所有する。保存Writerは同じ短期Lock内で最新値を読み直した後に判定し、CAS・出版・読戻し・解放を保持する。値検査だけで保存成功・受領・実適用を主張しない。旧形式移行Readerは本番に残さずフロントAIが移行を扱う。保存統合Bの接続・検証範囲は[詳細設計](04_Task_Detailed_Design.md#unified-storage-lifecycle)と[変更計画](../../../99_Roadmap/Changes/CHG-000082/coordinator-consolidation-plan.md#374-source統合の準備と事実の照合)を参照する。

Taskの時刻・安定識別子とProcess安全操作は既存の実行Adapterへ接続し、技術処理をTask側へ複製しない。`task/dispatch.ts` / `task/types.ts`は固定Repository情報と回復遷移の観測を接続する。技術回収の実処置はExecutionと専門Package、受領の原子確定は共通Storageが所有し、新しい回復機構を作らない。

| Architecture定義 | この領域が具体化する責務 | Relation状態 |
|---|---|---|
| [ARCH-000004](../../Definitions/ARCH-000004/architecture_definition.md) | ObjectiveをTaskへ変換し、実行、判断待ち、取消、RecoveryのProject-level lifecycleを所有する。 | Covered |
| [ARCH-000005](../../Definitions/ARCH-000005/architecture_definition.md) | Task、Queue、Decision、Recoveryの現在状態を根拠付きProject Stateへ投影し、Objective／Milestone Acceptance Decision Port／Recordで明示された受入・差戻し・判断待ちだけを記録する。 | Covered |
| [ARCH-000007](../../Definitions/ARCH-000007/architecture_definition.md) | Execution IntelligenceのReader Portを呼び、読取り専用の実行事実・評価候補を返す。 | Partial |
| [ARCH-000012](../../Definitions/ARCH-000012/architecture_definition.md) | Transport非依存のPublic Application Contractを所有し、MCP等へ同じ意味を提供する。 | Covered |

Relation状態は、この領域が担当する責務断面に対する状態である。複数領域で同じARCH-IDを実現する場合、各領域の断面を合成して基本設計全体を閉じる。

## 詳細成果物の適用判断

| 詳細成果物 | 判定 | 理由 | 正本節／成果物 |
|---|---|---|---|
| Component Model | Required | 純粋な遷移判定と、下位公開APIを呼ぶ業務操作の依存方向を分ける。 | [§3](#3-内部層) |
| Interface Model | Required | Coordinator、保存、実行知、人間判断の担当と閉じた操作結果を固定する。 | [§4](#4-port) |
| Data Flow | Required | ObjectiveからTask状態と公開結果までの意味伝播を示す。 | [§7](#7-公開アプリケーション契約) |
| State Model | Required | Task、Decision、Lease、RecoveryとEffect状態を分ける。 | [§6](#6-状態authority資源) |
| Sequence | Required | 要求、状態更新、Execution Port、結果投影の順序を固定する。 | [§7](#7-公開アプリケーション契約) |
| Failure／Recovery | Required | Effect不明、判断待ち、取消競合、回復待ちを保持する。 | [§6](#6-状態authority資源) |
| Deployment | Required | 独立packageと公開入口、既存CLIからの配送先を示す。 | [§2](#2-package境界) |
| Observability | Required | 公開入口から状態、理由、Recovery Identityを観測できるようにする。 | [§10](#10-完成境界) |
| Security Boundary | Required | CoreがHost AuthorityやProvider Credentialを生成しない。 | [§6](#6-状態authority資源) |
| Implementation Structure | Required | Port具象、状態依存、Task構成、資源Ownerおよび外部実行境界を固定する。 | [§11](#11-implementation-structure) |

`N/A`は未検討を意味しない。対象外にできるArchitecture上の理由を記載する。

## Engineering Concern評価

| Concern | Result | Rationale | Evidence／Related ID |
|---|---|---|---|
| Concurrency | PASS | Project、Queue、Task、DecisionのLock順序とownerGenerationを固定する。 | [正本節](#6-状態authority資源) |
| Timing | PASS | 観測時点、lease期限、取消待機、再接続を分ける。 | [正本節](#6-状態authority資源) |
| Resource Lifecycle | PASS | Task、Attempt、Lease、Queue、Decision、Recovery義務のOwnerを定義する。 | [正本節](#6-状態authority資源) |
| External Boundary | PASS | 実行、保存、実行知を各担当の公開APIから利用し、結果と観測不能を区別する。 | [正本節](#4-port) |
| Failure／Recovery | PASS | Effectなし／済み／不明、判断待ち、取消競合、回復待ちを分ける。 | [正本節](#6-状態authority資源) |
| State／Consistency | PASS | Task、Decision、Lease、Recovery、Objective／Milestone Acceptance DecisionとEffect状態を分ける。 | [§6](#6-状態authority資源) |
| Observability | PASS | 公開入口から状態、理由、Recovery Identityを観測できるようにする。 | [§10](#10-完成境界) |
| Security／Trust | PASS | CoreがHost AuthorityやProvider Credentialを生成しない。 | [§6](#6-状態authority資源) |

結果語彙は次の意味に限定する。

- `PASS`: 詳細設計上の処置と根拠節が揃った状態。実装済み・試験済みを意味しない。
- `N/A`: Architecture上、そのConcern自体が存在しない状態。未検討や後工程送りを意味しない。
- `OPEN`: 未解決の設計事項が残る状態。
- `FAIL`: 必須設計と矛盾する、または必要な設計が未充足の状態。

## Qualityへの引渡し

| 導出キー | 設計項目種別 | 対象 | 正常条件 | 反証する失敗 | 主な試験段階 | 外部境界の段階 | 観測 | 終了後条件 | 未確認 |
|---|---|---|---|---|---|---|---|---|---|
| `orchestrator.task-lifecycle` | State Transition／Failure-Recovery | ObjectiveとTask identity | 許可された状態遷移 | 競合、親喪失、取消、Effect不明 | UT／IT | UT: Direct Boundary<br>IT: Adjacent 1 Block | state、owner、recovery ID | lease／resource 0または義務 | なし |
| `orchestrator.candidate-adoption` | Interface／State Transition／Failure-Recovery | Workspace・固定Commit・取込先HEAD・明示認可 | 現在のGit状態と選択内容を再確認し、VC標準の二親Mergeと既存結果Writerへ接続する。固定・採用・品質受入は別操作とする | 未選択変更の混入、別Commit、Dirty衝突、無認可、保存失敗、Lease残存 | UT／IT | Related 2 Blocks | Workspace ID、Base／Candidate／Merge Commit、現在認可、Git結果、保存結果 | 不明は同じ参照を保持する。Task完了だけでCommit・Merge・Pushしない | 実Provider編集E2E②は未完了・保持中。旧Evidenceを新版の成立根拠へ流用しない |
| `orchestrator.acceptance-decision` | Interface／State Transition | 対象Identity、根拠Revision、Project運営者の明示判断 | 受入・差戻し・判断待ちを別状態で一度記録し、Objective受入済みだけがMilestone判断へ進む | ProjectionからのAuthority生成、SPEC-000006／000007からの到達、Task作成、Provider Effect、下位完了からの上位受入推定、Objective差戻し／判断待ちからのMilestone判断開始 | UT／IT | Direct Boundary | decision type、owner、source revision、effect count | 対象Decision Record一件またはEffect 0。Objective差戻し／判断待ちではMilestone判断Effect 0 | 物理StoreはDevelopmentで選択 |
| `orchestrator.public-application` | Interface／Data Flow | 公開DTOとPort | Transport間で同じ意味 | Schemaずれ、内部Path依存 | UT／IT | Adjacent 1 Block | exact result contract | 内部Effectは所有Portだけ | なし |

## 現行実装との照合

現行Sourceと既存試験は本詳細設計の正式入力ではない。本設計候補を固定した後、成立済み能力を失わないよう`Covered`、`Partial`、`Missing`、`Legacy`または`Implementation Detail`へ分類する。

担当責任者: Qual-Lab
最終更新日: 2026-10-07

Related:
- [責務再編の計画](../../../99_Roadmap/Changes/CHG-000082/Evidence/261007_develop-responsibility-mapping.md)
- [Runtime責務分離](../../../99_Roadmap/Changes/CHG-000063/change.md)
- [MCP Transport](../mcp-server/01_Architecture.md)
- [実行知](../execution-intelligence/01_Architecture.md)
- [Project状態参照とローカルMCP HTTP](../../../99_Roadmap/Changes/CHG-000064/change.md)

## 1. 目的と責務

Orchestratorは、人間が許可したObjectiveをProject-level execution stateへ変換し、Milestone、Objective、Task、判断、統合、受入およびRecoveryのlifecycleを管理する。Coordinatorの公開APIで個別Taskを実行し、MCP ServerやWorkbench ServerへTransport非依存の業務操作を提供する。Provider差はAI Adapter、実行資源はCoordinator、OS原語はPlatform Access、共通実行記録はExecution Intelligenceが担当する。

純粋な状態・遷移判定はI/Oから独立させる。業務操作はCoordinator等の公開APIを直接呼び、Orchestratorが望む通知をCoordinator定義のハンドラーへ登録する。下位が上位型をimportする逆依存、Port注入Framework、汎用Event Busは追加しない。

現在状態、待機中の仕事、採否待ち候補への参照、未確定の結果保存・採用後処理と未解決回復は、一連の仕事のつながりを失わず管理する。新しい受領・既読管理は追加しない。保存の具体契約は[詳細設計の一体保存](04_Task_Detailed_Design.md#compact-runtime-storage)が所有する。保存方式刷新②の成立済み保証を保持して移管し、旧形式の清掃はフロントAIの移行手順で扱う。Runtimeへ恒久的な旧形式Readerを残さない。

Objective／Milestone Acceptance Decision PortはProject運営者の明示判断だけを受け付ける。Project Management Projection、Task完了またはObjective受入から次段階のAuthorityを生成せず、受入判断記録からTask作成やProvider Effectを発行しない。

## 2. Package境界

```text
40_Develop/coordinator/
├ package.json
├ src/
│  ├ index.ts
│  ├ types.ts
│  ├ objective/
│  ├ task/
│  ├ queue/
│  ├ state/
│  ├ decision/
│  └ candidate/
└ tests/
   ├ unit/
   ├ integration/
   ├ system/
   ├ fixtures/
   └ support/
```

`src/index.ts`は業務操作、要求・結果検査、必要な公開型だけをexportする。内部配置は責務別とし、`src`配下は2階層まで、`internal`、`application`、`core`、`ports`等の汎用置場は作らない。型だけのファイルは`types.ts`とする。利用側は内部Pathを参照しない。単独常駐Serverや不要なLauncherは追加しない。

公開契約はOrchestratorと同じLifecycleを持つ間は本packageが所有する。Transport、Telemetry、Providerまたは管理用の便利な型を追加しない。複数Runtimeから独立版として利用する必要性が実証された場合だけ、別package化を再評価する。

## 3. 内部層

### 内部ブロック図

矢印は依存・呼出しを示す。業務操作は下位の公開APIを直接呼ぶ。状態判定自身はI/Oを呼ばず、下位はOrchestratorへ依存しない。

```text
CLI / MCP Server / Workbench Server
                   ↓ 公開入口
              Orchestrator
              ├─ Objective・Task・Queue
              ├─ State・Decision・Candidate
              ├→ 純粋な遷移・相関判定
              ├→ Coordinator → AI Adapter
              ├→ Domain Model：保存・設定部品
              ├→ Platform Access：OS原語
              ├→ Version Control：Revision・採用
              └→ Execution Intelligence：上位Attempt記録
```

各責務Folder内で純粋な判定とI/Oを発行する操作をファイル単位で分ける。図は処理順序や全importの列挙ではない。全Fileの移管は棚卸し表、正確な許可方向は§5に従う。

| 層 | 所有するもの | 所有しないもの |
|---|---|---|
| 公開契約 | Objective／Decision要求、Project結果、読み取り専用投影、closed schema | MCP envelope、CLI option、Provider result、OS Path |
| 業務操作 | Objective受付、Task Graph、実行順、再計画、判断移送、統合、受入、Recoveryの調停 | Provider差、Docker資源制御、下位の内部実装 |
| 純粋な判定 | 状態機械、不変条件、Identity相関、選択・遷移・投影 | I/O、時刻取得、乱数取得、外部待機 |
| 状態保存 | Project StateのSchema・改訂・Queue・判断・未解決参照、保存確定の順序 | 共通Filesystem原語、Coordinatorの実行状態 |
| 下位公開API | 各Ownerが定める必要能力と閉じた結果型 | Orchestratorへの逆依存、fallback、暗黙Authority |

純粋な判定はI/Oを発行しない。業務操作は下位の閉じた結果だけを解釈し、例外、欠落、時刻超過またはProcess終了から成功を推定しない。

## 4. Port

このアンカーは旧文書の参照解決用に保持する。新設計の実体は次の公開操作境界であり、Port Frameworkの実装を要求しない。旧型名の保持と依存方向の保持は別である。

| Port | 必要能力 | 主な実装所有者 |
|---|---|---|
| Execution Port | narrowed Task Authorityで一つのTask Attemptを実行し、exact Identity付き結果を返す | Coordinator公開実行API |
| Task相関と現在許可の確認 | 耐久的な開始準備の後、取消・現在のTask／用途の許可を確認してExecutionへ渡す。別の署名資格を発行せず、署名成功・Commit／Hash一致だけから許可を作らない | OrchestratorのTask Dispatch／Coordinator公開実行API |
| State Port | expected generation付きProject State／Queueの読取り・更新 | Orchestrator状態保存、Domain Model共通保存部品 |
| Objective／Milestone Acceptance Decision Port | 対象Identity、根拠Revision、Project運営者の明示Authorityを検証し、受入・差戻し・判断待ちだけを一度記録する。読取りProjection、Task作成およびProvider Effectとは分離する | Orchestrator判断操作・状態保存 |
| Lease Port | Project Operation、State、Adoptionの取得・settlementを観測する | Platform／Persistence Adapter |
| Workspace操作 | 上位が作業領域を解決し、VCへ明示固定・二親Merge・不要Ref回収を依頼する | 管理と判断はOrchestrator、Git操作はVersion Control。Coordinatorは解決済み実行対象だけを受け取る |
| Decision Port | 一回限りCapabilityの発行、prepare、finalize、失効およびRecovery | Orchestrator判断意味、Platform Access保護保存 |
| Platform Observation Port | Repository Root、principal、owner、Process、cleanup、Recoveryの必要観測 | Platform Adapter |
| Execution Intelligence Query Port | 許可された実行記録を読取り、observed／not_observed／unknown、時間的出所、事実と非Authority評価候補を分けて返す | 実行知Reader Adapter |
| Clock／Identity Port | 契約が必要とする現在時刻、決定論的IDおよび内容Hashを業務操作で取得し、純粋な判定へ値として渡す | Orchestratorの既存Node Runtime利用 |
| Process Safety Port | 現在のProcess世代、cleanup不明時のProcess再利用禁止、exact Recovery Identityの生成および検証を要求する | Host Adapter |
| Task Recovery Port | Owner lossとの相関解決、Task回復、Docker回復受領、検証資源の最終化および非Authority診断を、Repository実装情報を含まないexact Identityで要求する | Coordinator Recovery Adapter |

下位APIは要求、受理、Effect、完了、観測および耐久的確定を区別した結果を返す。未知fieldまたは不明状態を成功・不存在・空集合へ畳まない。Clock／Identityは既存Node Runtimeの時刻・暗号関数を必要箇所で使い、純粋な遷移判定へ値を入力する。時刻だけのためのHost抽象Frameworkを追加しない。

Workspace ID、固定Candidate Commit、取込先HEADは既存SnapshotとGit結果へexactに結合する。旧Bundle／Storeの公開採用APIは撤去し、Workspaceの固定・採用操作だけを利用する。保存済みの結果契約Identityは改名せず維持する。

## 5. 許可する依存

```text
利用側 → Orchestrator公開入口 → 責務別業務操作
                                 ├→ 純粋な状態・入力判定
                                 └→ 下位Ownerの公開API
Coordinator → AI Adapter
Coordinator ─×→ Orchestrator
```

- 純粋な状態・要求・結果判定はNode I/O、Coordinator、MCP、Provider、Platformまたは実行知へ依存しない。
- 業務操作はCoordinator、Domain Model、Platform Access、Version Control、Execution Intelligenceの公開APIへ直接依存できる。用途とAuthorityを限定し、他Ownerの内部Pathへ依存しない。
- CoordinatorはOrchestratorをimport、構成、再exportしない。Orchestrator由来の通知を必要とせず、単体利用を維持する。
- MCP Server、Workbench Server、CLI配送はOrchestratorの公開入口を利用し、業務操作を重複実装しない。
- 複数業務操作にまたがる公開型はOrchestratorが所有し、通知ハンドラー型はCoordinatorが所有する。上位型を下位へ移すだけの逆依存解消は行わない。

この規則は直接importだけでなく推移的依存へ適用する。静的検査はpackage dependency graphを入口から走査し、filenameの文字列一致だけで判定しない。

<a id="detailed-design-contract"></a>

## 6. 状態、Authority、資源

Task、Objective、Milestone、QueueおよびDecisionの状態と遷移は本書が上位の意味を、[詳細設計](04_Task_Detailed_Design.md)がexactなID、不変条件、Lock、Authority、Effectおよび失敗注入点を所有する。[機械可読な設計対応](../../../07_Quality/Registry/coordinator-task-design-traceability.json)は設計正本ではなく、設計とCoordinator実装・試験の対応切れを検出する検証用投影である。物理配置の変更を理由に状態名、成功条件、IdentityまたはRecovery義務を簡略化しない。Project Stateを所有するProcess世代はCoreが乱数や時刻から生成せず、Hostが有効な`ownerGeneration`として明示入力する。Coreは欠落または不正な世代を状態生成前に拒否する。

OrchestratorはAuthorityを生成しない。人間または上位Runtimeから受け取ったProject／Milestone AuthorityをTask単位へ縮小し、Task要求と`authorityBindingId`へ結合してCoordinatorへ渡す。別のRuntime package実行資格は発行しない。耐久Handoff後に取消と現在許可を確認して委譲し、Task Authority、Task内容および許可Pathは既存の縮小Bindingへ結合する。Transport metadata、Provider出力、Project State、実行知EventまたはAdapterの存在からAuthorityを導出しない。

統合結果の基本形は従来のcleanupと手動回復の相関を維持する。外部境界のEffect情報を持つ拡張形では、Effect不明とcleanup未確認を別軸で扱う。Effect不明なら手動回復を必要とし再試行を許可せず、Recovery参照はEffect不明またはcleanup未確認のときだけ許可する。Transportはこの相関を再定義せず、基本形または拡張形をCanonical Inspectorで検査してそのまま搬送する。

業務操作は長時間待機中に短時間Lockを保持しない。下位API呼出し前後でProject generation、Task／attempt／Operation、Authority、取消、RecoveryおよびLeaseを再照合する。cleanupまたはEffectが不明な場合は、該当するProcess・Attemptを再利用せずexact Recovery義務を保持する。回復結果の保存と通常実行の受付は別操作であり、回復APIから新しいProvider依頼を発行しない。

### ブロック状態遷移

詳細な個別状態名と遷移IDは、[詳細設計](04_Task_Detailed_Design.md)から解決する。次表はPackageをまたぐ結合ブロックのLifecycleを示し、個別状態の第二正本にはしない。

| ブロック状態 | 契機／事前条件 | Portとの結合 | 次状態 | 終了後条件 |
|---|---|---|---|---|
| Objective受付 | Project／Milestone Authorityと現行世代 | State／Clock／Identity | Task準備／判断待ち／拒否 | 不正入力ではTask Effect 0 |
| Task準備 | dependencyと縮小Authority成立 | 耐久Handoff／現在許可確認／Execution | 実行中／停止 | 委譲直前に世代・取消を再確認し、取消時はTaskを呼ばない |
| 実行中 | Attempt結果または取消 | Candidate／Observation／Process Safety | 統合準備／Recovery | cleanup不明を通常失敗へ畳まない |
| 判断待ち | 一回限り判断要求 | Decision／Lease | 再計画／取消／Recovery | 待機中に短時間Lockを保持しない |
| 統合準備 | 必要Task結果と候補が相関 | Candidate／State | Accepted Result／停止 | 個別Task成功を統合受入へしない |
| Recovery | exact義務とfresh owner観測 | Task Recovery／Platform Observation | 再入場／手動処置 | Identityを置換せず、旧世代を再利用しない |
| 状態投影 | 読取り専用要求 | read-only State | observed／absent／unknown | Effect 0、unknownをabsentへ畳まない |
| Objective受入判断 | Task根拠とProject運営者の明示判断 | Acceptance Decision | Objective受入済み／Objective差戻し／Objective判断待ち | Task完了だけでは記録せずEffect 0。差戻し／判断待ちは同じObjectiveへ戻り、Milestone判断Effect 0。Task作成／Provider Effect 0 |
| Milestone受入判断 | Objective受入記録とProject運営者の明示判断 | Acceptance Decision | Milestone受入済み／Milestone差戻し／Milestone判断待ち | Objective受入記録がない場合はEffect 0。受入・差戻し・判断待ちを別状態で保持。Task作成／Provider Effect 0 |

<a id="platform-boundary"></a>

### Platform境界

Orchestratorの純粋判定はOS固有のPath、principal、Filesystem保護、Lock、Process、Console、ContainerまたはRecovery機構を所有しない。業務操作は必要な下位公開APIを呼ぶ。Platform AdapterはAuthorityを生成せず、業務操作が与えた閉じた要求だけを観測または限定操作へ変換する。検査母集団はFolder名ではなく次のFile責務で固定する。`src/`相対Pathを示し、波括弧は同じFolder内のFile列挙である。

| 主責務 | File集合 | 境界 |
|---|---|---|
| 純粋判定・値契約（19） | `state/projection.ts`; `state/types.ts`; `decision/types.ts`; `decision/request.ts`; `state/persistence.ts`; `state/create.ts`; `state/validation.ts`; `decision/transition.ts`; `objective/request.ts`; `objective/types.ts`; `objective/plan.ts`; `state/result.ts`; `task/types.ts`; `state/request.ts`; `task/scheduling.ts`; `task/lifecycle.ts`; `task/acceptance.ts`; `task/recovery.ts`; `selection/validation.ts` | 閉じた値検査と純粋遷移。共通保存値の型・codecはDomainを参照し、時刻・乱数・I/Oを取得しない。 |
| 業務操作（9） | `state/retirement.ts`; `state/observation.ts`; `decision/lifecycle.ts`; `decision/acceptance.ts`; `objective/execute.ts`; `objective/replan.ts`; `state/query.ts`; `task/dispatch.ts`; `workspace/record.ts` | 受付・進行・読取り・受理・退役を調停し、保存と技術実行へ委譲する。 |
| 接続・組立て（8） | `state/transaction.ts`; `task/queue.ts`; `objective/composition.ts`; `task/requests.ts`; `workspace/commands.ts`; `workspace/operations.ts`; `selection/resolve.ts`; `state/initialize.ts` | 専門Ownerを既存の保存トランザクションと公開操作へ接続する。 |
| 物理保存（4） | `storage/state.ts`; `storage/history.ts`; `storage/lock.ts`; `storage/decision.ts` | 実行Snapshotの保存封筒・bounded codec・CAS・atomic replace・保存一回証拠・再入場を所有する。AI設定のWriterはDomainへ移管済み。実行Snapshot全体の移管は未完了。 |
| 単発実行・技術接続（15） | `execution/lease.ts`; `execution/controller.ts`; `execution/authority.ts`; `execution/operation.ts`; `execution/result.ts`; `execution/recovery.ts`; `execution/observation.ts`; `execution/diagnostics.ts`; `execution/preparation.ts`; `execution/advice.ts`; `execution/request.ts`; `execution/settlement.ts`; `execution/validation.ts`; `execution/kernel-lock.ts`; `execution/process-safety-state.ts` | 実行・長期Lease・観測・終了と実行中の一回結果結合を所有する。保存型はDomainの`attempt/types.ts`を利用する。 |
| CLI（7） | `cli/command.ts`; `cli/options.ts`; `cli/request.ts`; `cli/authentication.ts`; `cli/doctor.ts`; `cli/recovery-report.ts`; `cli/cancellation.ts` | 引数・入力搬送・取消・出力を所有する。 |
| 区画間の状態整合 | Domain Model `state/transition.ts`・`task/crud.ts` | 復号済み区画の相関・受付・結果受領・閉鎖・退役条件を判断する。実Leaseと履歴は同じ短期Ownerへ束縛した同期観測で確認する。 |
| 外部送信判断（3） | `decision/external-send-consent.ts`; `decision/external-send-grant.ts`; `decision/external-send-policy.ts` | 既存の同意・Policy・一回Grantを保持する。 |
| 公開入口（2） | `index.ts`; `api.ts` | Rootの公開名・型／値区分を維持する。 |

設定・固定選定の共有型と閉形式検査はDomainの`ai-selection/types.ts`・`validation.ts`が所有する。Coordinatorの`selection/validation.ts`は実行時の内容Hash照合を所有する。復元は当時の十項目の閉形式を検査するだけで、現在Catalogによる新規選定・認証・実行許可と区別する。`selection/resolve.ts`は現在Catalogとの技術照合を所有し、状態復元から呼ばない。新Schema・一般CRUD・Writer全面移管は別の実装段階であり、codecの依存分離だけで成立したとは表示しない。

現行Source全数を重複なく照合し、新File・欠測・純粋集合の空集合を拒否する。宣言全体の型専用import／exportは実行時閉包へ数えない。通常宣言のinline type要素は型辺へ分けるが、値要素がなくても型除去後に空import／exportが残るため実行時ロード辺を維持する。型の所有境界は純粋集合内、または他Packageの実在する公開`src/index.ts`に限定し、自Packageの公開entry・業務操作・保存・Adapterへの型依存も純粋集合へ混入させない。Node組込みは型専用でも上表のexact module／symbolだけを許可する。`task/types.ts`からだけ、`execution/result.ts`の`CoordinatorWorkspaceResult`一型と、`task/dispatch.ts`の`COORDINATOR_EXECUTION_CONTRACT / COORDINATOR_SINGLE_TASK_ADAPTER_CONTRACT`二定数の型専用参照をexact集合で許可する。値import、別Symbol、欠測・重複・追加は拒否し、実行時閉包を拡張しない。`task/types.ts`の結果配送型はOrchestratorが受領する三状態と結果参照・終了観測の最小構造を所有し、Coordinator実装の戻り型から逆算しない。Adapterはcastで押し込まず構造適合を型検査する。

`objective/types.ts`は具体依存の署名を共有するため、`execution/controller.ts`の`startRuntimeOwnedCoordinatorTask / cancelRuntimeOwnedCoordinatorTask / captureRuntimeOwnedCoordinatorTaskResultDelivery`、`storage/decision.ts`の`openRuntimeOwnedWindowsProjectDecisionStore`、`task/dispatch.ts`の`recordCoordinatorExecutionEvent`だけを型専用で参照できる。各辺は一つの名前を持つ型専用辺として検査し、値import・別Symbol・別Pathは拒否する。これらの実行値を型Moduleで生成・取得しない。

状態判定のSnapshot検査は既存`state/validation.ts`を利用し、保存APIも再exportする外部Package Rootを純粋閉包へ追加しない。現在のWindows保証選択は`src/execution/diagnostics.ts` / `src/execution/kernel-lock.ts`が所有し、PID生存・Platform観測はPA Rootの`observeProcessLiveness`／`observePlatformFamily`、環境構築はPAの既存用途別APIへ直接接続する。Lease入力・世代結合・Profile選択は上位に保持する。これは移管途中の現接続であり、Coordinator／Orchestratorを環境非依存へ閉じる最終状態とは区別する。未分類の領域を検査から無言で除外せず、部分保証を全Platform対応へ昇格しない。

| 境界 | Coreが要求する保証 | Adapterの責務 |
|---|---|---|
| Principal／Provider Home | 選択ユーザー、固定Home Identity、所有・書込み主体、non-link | 対象OSのidentityと保護を実観測する |
| Filesystem／Repository | Root、Revision、Path、Identity、原子的更新、隔離 | 境界付きPath解決とreadbackを行う |
| Lock／Lease | OS排他、owner generation、生存観測 | 時刻やfile存在だけで奪取しない |
| Process／取消 | argv、環境、Process tree、終了、owner loss | 要求発行と終了観測を区別する |
| Container Host | 固定image、Network、mount、Process、cleanup | Host接続と終了後不存在を観測する |
| Runtime Root／Recovery | OS管理Root、権限、資源Identity、回復後不存在 | exact Recovery Identityの再入場とsettle後を保証する |

対応Platformが必要保証を満たさない場合、別OSのAdapterへfallbackせずEffect 0で停止する。OSのAPI名や実装方式は共通化せず、必要保証と失敗時の意味だけを共通契約にする。

## 7. 公開アプリケーション契約

公開契約はTransportに依存しない次の意味操作を持つ。

- Objectiveを受け付ける。
- 現在の判断要求へ人間の判断を提出する。
- 同じrequest identityの現在結果を再取得する。
- 採用済みのProject Stateを読み取り専用で投影する。

Objectiveは任意の作業分類`workType`と編集担当の明示選択`choice`（Provider／Model／Effort）を受ける。初回だけRepository設定から編集担当・独立レビュー担当の組を固定し、Project rootへ保存する。レビューへ明示選択を継承しない。同じMilestoneへの再受付では、明示された分類・選択を保存値と照合し、不一致はenqueue前に拒否する。省略された項目は保存値を継承し、現在設定やCatalogを読み直さない。旧`requestedProfileId`／Provider自動選択入力は受理しない。入力やMCP metadataからAuthorityを生成しない。

WorkbenchのPromptから変更を作る操作は別のSingle Task操作であり、公開Objectiveと同じ操作には統合しない。Objectiveの入力・保存選定・Taskへの組搬送に加え、Model Grant／Task Packet／PreparedPlan／SingleTask／Operation Identity v2の内部接続を実装した。Home許可はoperation・provider・Homeへ分離済みである。公開利用側のAI選定接続と旧Profile Store撤去は完了し、正式API・CLIも実装候補へ切り替えた。固定全体回帰と最終レビューは変更計画で追跡し、内部接続の限定試験を実AIの完成へ換算しない。

Project State参照は`requestId`、`projectId`および`repositoryRevision`だけを受け取る。状態参照の処理は読取りAPIだけを呼び、書込み、Queue更新、Lease、Task実行または判断Capabilityを構成しない。結果は次を区別する。

```text
observed  現行改訂版へ結合したcanonical投影を取得
absent    対象Projectの状態が存在しないことを観測
unknown   Store、Identityまたは改訂版を現在値として確認不能
```

`absent`から未開始、完了または成功を推定しない。`unknown`を`absent`、空配列またはfalseへ畳まず、既存のRecovery要否と状態参照自身がEffect 0であることを別fieldで返す。公開投影はMilestone、Objective、Taskの集約状態、判断待ち、Recovery要求、品質状態および次の実行上の処置に限定し、進捗率、予定、RiskまたはProject Management判断を追加しない。

各操作は認証済み主体、Project／Repository Binding、request identity、Authority参照および取消を明示入力として受ける。MCP session、CLI process、HTTP connectionまたはWindows user tokenを公開契約自身のAuthorityにしない。

### 7.1. 公開操作と現在のSymbolの移管

次のSymbol名は現在の実装に存在する操作の対応であり、Package改名だけを理由に再命名しない。移管後の入口はOrchestratorの公開indexである。Coordinatorからの再exportは撤去する。

| 操作／現在Symbol | 入力と結果 | 主な利用側 | Authority／Effect |
|---|---|---|---|
| `runObjective`／内部`executeCoordinatorObjective` | 固定Objective、Repository・Revision、縮小Authority、分類・明示選択と保存済み選定組、取消 → 相関検査済み結果 | CLI、MCP Server | 初回選定と継承を区別し、Project Stateを保存する。下位の新選定接続は未完了。Task完了から受入を生成しない。 |
| `runCoordinatorOperation` | Queue・Task・Attempt・Operationの結合 → 各Task結果と未解決義務 | Objective操作 | 待機前のIntent保存、待機後の再検査、下位実行だけ。Provider差を実装しない。 |
| `manageCoordinatorWorkspace`／`executeWorkspaceCommand` | Workspace、Base、選択差分、固定Commit、取込先HEADと現在認可 → Git結果と保存結果 | Workbench Server、許可済みMCP操作 | 固定と採用を別操作にし、採用時は原則二親Merge。自動Commit／採用なし。 |
| `recordCoordinatorAcceptanceDecision` | 対象Objective／Milestone、根拠Revision、人間判断 → 一回の判断記録 | CLI、MCP Server | 受入・差戻し・判断待ちのみ。Task作成0、Provider Effect 0。 |
| `issueCoordinatorHumanDecision`／`submitCoordinatorHumanDecision` | exact判断要求・許可選択肢・一回Capability → 継続状態と適用結果 | 判断操作 | 保護保存とProject Stateの別境界を再照合し、跨る一括確定を主張しない。 |
| `replaceCoordinatorHumanDecision`／`invalidateCoordinatorHumanDecision`／`recoverCoordinatorHumanDecision` | 現在判断・適用世代・exact回復参照 → 置換／失効／回復結果 | 判断操作 | 旧Capabilityと現在適用を検査する。応答喪失から自動再発行しない。 |
| `queryState`／内部`queryCoordinatorState` | request・project・Revision → observed／absent／unknown | CLI、MCP Server、Workbench Server | 読取りのみ。不存在を未開始・成功へ読み替えない。 |

公開入口は上位操作と検査関数を公開し、保存部品やOS補助の内部関数全数をexportしない。開発用依存注入・Fixtureはtestsへ閉じ、本番入口に任意Adapterを差し込むAPIを新設しない。

### 7.2. 通知、取消と保存確定

| 境界 | 必要な順序・観測 | 反証と終了条件 |
|---|---|---|
| Task開始 | Intent・Authority結合保存 → Coordinator呼出し → exact開始通知の検査 → 対応Task状態保存 | Handle返却だけではrunningにしない。状態保存失敗は元の失敗として保持し、実資源の取消・回収を別に観測する。 |
| 登録ハンドラー | Execution所有の通知型をTaskが同じOperation・Attemptへ結合する | 下位は上位の状態型を知らない。ハンドラー完了は耐久保存完了を意味しない。 |
| 遅延・重複 | 現在世代・Operation・通知Identityを再検査し、既処置の通知で二重遷移しない | 旧Attemptの通知で新Attemptを更新しない。不正・観測不能は成功化しない。 |
| 取消 | 要求を記録 → Coordinatorへ通知 → 未使用許可失効・Process停止・資源回収を観測 → 上位状態保存 | cancel要求、Promise解決、Transport切断をcancelledの根拠にしない。保存不明とcleanup不明を別軸に残す。 |
| 親Process喪失 | fresh Owner観測とexact未解決参照で再入場する | PIDや経過時間だけでOwnerを奪取しない。旧Attemptを再実行せず、通常受付は回復確定後に別Identityで行う。 |
| 終了 | 下位の終了観測、Primary Failure、cleanup、上位保存結果を別々に確定する | cleanup失敗で最初の失敗を上書きしない。終了通知だけでQueue・Lease・slotを解放しない。 |

Coordinator内Executionは技術実行、TaskはAttempt進行の事実をExecution Intelligenceへ記録する。同じEventを両側で再発行せず、現在状態・分析履歴・正式Evidenceの目的と保持Ownerを分ける。

上位の`running`は、同じAttemptに結合したProvider接続用実行Processの開始を観測し、その事実を耐久保存した状態とする。下位の開始観測の保証範囲は[Coordinator通知契約](../coordinator/01_Architecture.md#coordinator-task-notification)に従い、AI内部の要求受理を主張しない。登録した上位Operationと下位Runtime Operationを混同せず、初回Executor通知だけで状態を保存する。同じ通知の重複で二重遷移せず、別Identity・旧世代・終端後の通知では現在状態を変更しない。Handle返却後の即時受付確認は実開始通知の代替にしない。正常Fixtureも開始通知を明示し、完了結果だけを上位の実開始根拠にしない。実接続と反証試験は未完了である。

### 7.3. 認可済みRepositoryの活動読取り — 新Owner接続候補

活動取得は実行・判断・回復を開始しない読取り専用の公開能力とする。Access Managementが今回要求の内容認可を行い、利用側の構成が`projectId`、`repositoryId`、既存の検証済みRoot能力だけを短命入力へ射影する。資格、Role、Workspace、管理改訂、AMのBinding IDを活動Ownerへ渡さない。AMのBindingとOrchestrator保存のBindingは別の導出契約であり、同一IDとして流用しない。

Orchestratorは活動観測型、閉じた結果検査、現在状態Query、Execution IntelligenceのEvent投影、横断合成とCursorを所有する。履歴の正本と物理ReaderはExecution Intelligenceに残す。Workbenchの既存実Readerを複製せずこのOwnerへ移管し、WorkbenchとMCPは同じ公開契約のConsumerにする。旧ローカルCLIの本人確認をAM認証へ二重適用せず、上位で認可されたRootを受ける別の読取り専用入口を明示する。これは任意Pathで認証を迂回する入口ではない。各要求でRoot、現在Git改訂、保存RootのBinding、状態と履歴を既存Ownerから再観測する。状態なしは初期化せず、保存・判断Authority・Recovery操作を受け取らない。

| 観測対象 | 合成規則 | 不成立時の処置 |
|---|---|---|
| 対象集合 | 今回認可された同ProjectのRepositoryだけを全件観測する。0件は非開示の取得不能。 | 集合取得・Root・Project照合が不明なら、部分集合へ後退しない。未許可・異Projectを本文Readerへ渡さない。 |
| 現在状態 | 観測済み1件＋他は状態なしなら当該投影、全件状態なしなら状態なし。 | 観測済みが複数なら競合としてunknown。1件でもunknownなら全体unknown。先頭値を採用しない。 |
| 実行履歴 | 全Sourceの履歴観測が成功した場合だけ対象ProjectのEventを合成し、時刻降順→Event ID降順で全体へlimitを適用する。 | 一件でも履歴不明ならeventState=unknown、部分Eventを正常結果として返さない。同一Event IDが複数Sourceに現れる場合も出所競合として止め、暗黙dedupeしない。現在状態と履歴の不成立は独立保持する。 |
| 出所 | `sources`は対象Repositoryを各1件、重複のないRepository ID昇順の配列に固定し、観測できたGit改訂（不明はnull）を保持する。`currentSourceRepositoryId`はstate=observedの単一投影Ownerだけを保持し、各Eventには`repositoryId`を保持する。 | absent／unknownでは現在投影Ownerをnullにする。内部Root・Path・Binding・資格を結果へ含めない。出所情報を認可証明にしない。 |
| 継続位置 | 公開済み時刻・Event IDと、この正規化済み`sources`配列のRepository ID／Git改訂から導出した相関値をCursorへ結合する。次ページも現在認可を再評価する。いずれかのGit改訂がnullなら第一Pageの観測結果は状態契約どおり返すが、`eventContinuation`はnullとし継続Cursorを発行しない。 | Source集合または改訂が変わったCursorは明示拒否し、最初のPageから再取得する。入力Cursorを伴う要求で現在のいずれかのGit改訂が観測不能なら明示拒否する。null同士の一致を改訂不変の根拠にせず、空Pageや先頭Pageへfallbackしない。Cursorに権限・Pathを保持せず、古い集合で探索しない。 |

ページングは現在観測に対する継続であり、履歴全体の固定Snapshot・重複配送保証ではない。通常の新しいEvent追記は既存の時刻／ID境界より後続Pageへ混入させず、保持期間による履歴整理から過去Eventを復元しない。Snapshot保存、Session、Registry、Lockや履歴の複製は追加しない。開始前取消は観測0、開始済みReaderは完了までjoinし、取消後に結果を公開・再実行しない。取消要求を実I/O中断や資源不存在の証明にしない。

Owner型・閉じた検査・実Store Readerは候補実装済み・Owner局所範囲の限定独立レビュー済みである。公開観測に要求projectIdを保持し、observed時の投影Projectと一致させる。継続Cursorは同じProject／正規sourcesの相関と返却Page末尾の時刻／Event IDにexact結合し、未知理由・逆順Event・不整合を拒否する。時刻は文字列順でなくDate.parse後の実時刻降順、同じ実時刻だけEvent ID降順で比較し、並び順・Validator・Cursor境界へ共用する。EI保存文字列は変更しない。利用側も応答Projectと今回要求を比較する。MCP実HTTP、Workbench同等結果、旧全Consumerの追従と正式QAは未完了であり、活動能力の完成や旧CROS活動処理の撤去を主張しない。実行／Docker回復の延期済み大改修は本節へ含めない。

## 8. 構成Root

`template/tools/crdd-coordinator.ts`の既存Project操作のコマンドは保持する。Projectと単一Taskの業務CLIはOrchestratorの受付へ配送し、単一Task実行はそこからCoordinatorの公開Task APIへ接続する。配送だけのためにCoordinatorのlibraryへOrchestrator依存を入れない。MCP ServerはOrchestratorの公開APIを直接利用し、Coordinatorから上位Applicationを取得しない。

業務CLIはsrc/cli/request.tsがstdin・表示・取消を所有し、initializeProject／runObjective／runTaskへ接続する。command.tsは対象→操作を配送し、templateは単一binを一回importする。128KiB・厳格UTF-8・一意JSONはoptions.ts、Signal取消はcancellation.tsを維持する。診断・回復の表示はdoctor.ts、処置は正式APIから実Execution Ownerへ委譲する。旧起動モードの互換配送や自動Direct化は行わない。

```text
配布CLIの薄い配送
  ├ Project操作 → Orchestrator公開API → Coordinator公開API
  └ 単一Task操作 → Orchestrator CLI → Coordinator公開Task API
MCP Server → Orchestrator公開API
Workbench Server → Orchestrator公開API（候補採用・状態参照）
```

Orchestratorが自分の業務操作に必要な下位公開APIを構成する。Transport、外部端末、認可済み利用側の配送は各入口が所有する。Orchestratorを独立常駐Processにする要求はないため、見かけ上のServerやLauncherは追加しない。CLI、MCPの入力・出力と取消契約は移管前後で保持する。

## 9. 移行と検証

移行は下位のDomain Model／AI Adapter／Native公開面、Coordinator公開面、Orchestrator、MCP／Workbench／配布CLI、設定・署名閉包・試験の順に進める。旧Pathを残さず全利用側を切り替え、移行途中のPackageを完成済みと表示しない。フロントAIは旧Runtimeを止め、実資源と未解決参照を確認し、候補・秘密・正式根拠を保全してexact旧形式を清掃する。その後、新形式と新受付世代を初期化・読戻しする。旧キューやOwnerを新世代へ黙って引き継がない。

単体試験は状態とApplication判断、結合試験は各Portと実Adapter、総合試験はCLI／MCP stdioの公開入口を確認する。正常だけでなく、判断待ち、再計画、取消、Port拒否、Identity不一致、cleanup不明、Recovery再入場およびStore障害を含める。試験カタログはOrchestrator変更からCoordinator、MCP、Platform、実行知、traceabilityおよびRuntime実行Identityの利用側を逆向きに選択する。

## 10. 完成境界

Package作成、純粋な判定の試験合格または安全な拒否だけでは再編完了としない。公開APIの実装接続、全利用側、CLI／MCP stdio・HTTP回帰、状態・Authority・Recoveryの意味保持、下位からの逆依存0、内部Path参照0および独立レビューが揃った場合だけ完成とする。詳細設計固定、Source移管、全回帰、未署名固定入口・必要Artifact・現在許可・実Provider境界の通過を別Gateで判定する。

## 11. Implementation Structure

| 観点 | 適用 | 判定理由 | 成立させる構造 | 局所責務・不変条件 | 失敗・変更時の影響 | Qualityへの導出キー |
|---|---|---|---|---|---|---|
| Variation | Required | 公開入口と実行、保存、OS観測の違いが存在する。 | Transport差は各Server、Provider差はAI Adapter、OS差はPlatform Accessへ閉じる。Orchestratorは公開結果を解釈する。 | 純粋な判定は具象Runtime、Transport、OS、保存方式を知らない。 | 個別入口だけがAuthorityや結果意味を変更する。 | `orchestrator.public-application` |
| Common Contract | Required | 複数入口が同じObjective・判断・状態操作を利用する。 | 公開DTOと検査関数、Identity・結果・回復義務を共通化し、同じOrchestrator APIへ配送する。 | 共通契約をPort注入Frameworkの採用理由にしない。 | 新入口だけが異なるAuthority、完了、RetryまたはRecovery意味を持つ。 | `orchestrator.public-application`<br>`orchestrator.task-lifecycle`<br>`orchestrator.acceptance-decision` |
| Creation／Selection | Required | Objective要求の分類・明示選択、Authorityと現在状態の照合が必要である。 | Coordinatorは初回だけRepository設定から役割別選定を固定し、再受付は保存値との相関を検査する。下位のGrant接続は別単位で評価する。 | 任意Adapterを本番から注入せず、読取り操作から実行能力を構成しない。 | 入力が黙って別選定へ畳まれるか、設定再読で既存選定が変わる。 | `orchestrator.public-application` |
| State-dependent Behavior | Required | この観点を成立させる構造と責務が存在するため。 | Task、Decision、Lease、Recovery、Effect状態が許可する遷移をCoreが所有する。 | 下位完了やProjectionから上位Authorityを生成しない。 | 分散した状態分岐が二重実行や受入推定を起こす。 | `orchestrator.task-lifecycle`、`orchestrator.acceptance-decision` |
| Composition／Recursion | Required | この観点を成立させる構造と責務が存在するため。 | Objective、Milestone、Task Graphを明示した親子関係と停止条件で構成する。 | 子の完了を親の受入へ自動昇格せず、循環依存を作らない。 | Graphの部分成立がProject全体の完成へ畳まれる。 | `orchestrator.task-lifecycle`、`orchestrator.acceptance-decision` |
| Lifecycle Ownership | Required | この観点を成立させる構造と責務が存在するため。 | Task、Attempt、Lease、Queue、Decision、Recovery義務をOrchestratorのIdentityへ結ぶ。 | Owner移送、失効またはcleanup確認まで状態を完了にしない。 | LeaseやRecovery義務を失い、同じTaskへ再入場できない。 | `orchestrator.task-lifecycle` |
| External Boundary | Required | 実行、保存、OS、採用の境界が存在する。 | 下位Ownerの公開APIを直接呼び、待機前後で結合・Authority・結果・cleanupを再検査する。 | 下位は上位Authorityを生成せず、通知を上位保存確定へ昇格しない。 | OS／Transport／Provider固有の都合が状態契約を変える。 | `orchestrator.public-application` |

CLIとMCPの具象入口は共通の要求・結果検査と業務操作へ収束させる。ProviderとOSの具象差は各下位Ownerの共通契約で処置し、上位へ重複したAdapter Frameworkを作らない。ObjectiveとMilestoneは異なる階層の受入判断であり、単一の汎用Decision型へ畳まず、共有する不変条件だけを共通契約にする。

## 上流UI／SPEC Detailとの関係

| Detail Source | UI／SPEC Definition | この領域が担当するSCR／PRT／Interaction／BHV | Relation状態 | 未解決Gap／戻し先 |
|---|---|---|---|---|
| [UI／SPEC Detail Architecture Traceability](../../08_UI_SPEC_Detail_Traceability.md) | ARCH-000004、ARCH-000005、ARCH-000007、ARCH-000012のSource Definition | 同Traceability表で上記ARCH-IDへ接続された全Detail ID | Covered | Detailの意味変更はUI／SPECへ、配置責務の変更は該当ARCH定義へ戻す |

担当Interaction Relation: `PRT-000002.spec-000002`、`PRT-000002.spec-000003`、`PRT-000002.spec-000028`、`PRT-000002.spec-000029`、`PRT-000003.spec-000004`、`PRT-000003.spec-000005`、`PRT-000004.spec-000002`、`PRT-000004.spec-000006`、`PRT-000004.spec-000007`、`PRT-000005.spec-000008`、`PRT-000007.spec-000011`、`PRT-000011.spec-000005`、`PRT-000012.spec-000017`

本領域は上記Relationの配置責務を局所所有する。Detailを新しい要求として解釈せず、対応ARCH-IDが所有する配置・境界・状態・観測の制約として実現する。

## 保存方式の切替確認

保存方式刷新②は本番接続・Repository実切替・限定独立レビューを完了した。[変更記録](../../../99_Roadmap/Changes/CHG-000082/Evidence/261005_project-runtime-phase2.md)で追跡する。その結果は既存保存保証の基準として保持するが、今回のOrchestrator移管、全回帰、未署名固定入口・必要Artifact・現在許可・実Provider境界や現版全体の完成を証明しない。

## Checklist

- [x] 関連するARCH-IDと担当する責務断面を明示した
- [x] 10種類の詳細成果物を全数Applicability判定した
- [x] Requiredを実在する節または成果物へ接続した
- [x] N/AにArchitecture上の理由を記録した
- [x] 8種類のEngineering Concernを全数評価した
- [x] PASSを設計済みの意味に限定した
- OPEN: 詳細設計02の保存・状態・全Symbolと通知結果の相関を再編先へ対応する必要がある — Component、Interface、Data／StateおよびSequenceを必要な粒度で具体化した
- [x] Failure／Recovery、ObservabilityおよびSecurity Boundaryを具体化した
- [x] 7種類のImplementation Structure観点を全数Applicability判定した
- [x] 二つ目の具象実装がある責務で、共通契約への昇格または非昇格理由を評価した
- [x] Qualityへ渡す設計項目を局所的な導出キーまたは同等に一意な参照へ接続した
- OPEN: 公開操作・通知・保存・取消の全義務を既存QA項目へ対応する必要がある — Qualityへ対象、正常条件、反証する失敗、観測および終了後条件を渡した
- [x] Human Inputの必要性とOpen／Gapを評価した
- [x] 現行実装との照合をReality Auditとして分離した
- [x] Source構造をCanonical詳細設計へ逆輸入していない
