# Provider単段Executorの詳細設計

成果物種別: Architecture詳細設計
詳細設計領域: executor
状態: Candidate（非AI検証対象）
維持責任者: Qual-Lab

## 基本設計との関係

`scripts/task-summary-observation.ts`は合成診断だけのModule観測であり、製品公開APIではない。専用新品Node Processでconsumer import前に元normalizerを包み、同じ引数・同じreturn object／例外を維持する。最初のCodex executorのsummary候補一件だけをメモリで保持し、外側の単一Task終了・段階順序・資源回収結果を照合後、人間承認した端末へ一回表示する。元関数にはTask／Attempt IDがないため、観測seam単独のexact identity証明とはしない。表示前のbyte上限・制御文字・Path・認識済みSecret検査の不成立は非表示へ閉じ、元結果と採否・回収を変更しない。本文はLog／File／APIに保存せず、端末scrollback残存は人間の限定受容を必要とする。復元はmock解除だけでなく専用Process終了まで確認する。計測付きの結果を通常Source無計測E2E成立へ算入しない。

表示前には結果記録成功と試験物の処置結果の相関も確認する。Task・実行資源の回収と試験フォルダの物理削除は区別し、既存Gateが故障証拠を保持する場合も、その保持判断を変更しない。

| Architecture定義 | この領域が具体化する責務 | Relation状態 |
|---|---|---|
| [ARCH-000008](../../Definitions/ARCH-000008/architecture_definition.md) | Provider単段のProcess・取消・終了と元回復証拠 | Covered |
| [ARCH-000015](../../Definitions/ARCH-000015/architecture_definition.md) | 準備一回消費・結果正規化。Taskの順序判断は上位へ残す | Covered |

## 詳細成果物の適用判断

| 詳細成果物 | 判定 | 理由 | 正本節／成果物 |
|---|---|---|---|
| Component Model | Required | 上位調停と単段実行を分離する | [§1](#1-責務と依存) |
| Interface Model | Required | 開始・取消・元証拠の有限操作を固定する | [§2](#2-sourceと公開入口) |
| Data Flow | Required | 準備から元結果・上位保存へ相関を保つ | [§3](#3-生涯と証拠) |
| State Model | Required | 準備・開始・取消中・終了を混同しない | [§3](#3-生涯と証拠) |
| Sequence | Required | 回復引渡しをEffect前に確定する | [§3](#3-生涯と証拠) |
| Failure／Recovery | Required | unknownと元Identityを保持する | [§3](#3-生涯と証拠) |
| Deployment | Required | Libraryだけで、Serverや保存Rootを追加しない | [§1](#1-責務と依存) |
| Observability | Required | 同期通知と元結果を別々に照合する | [§3](#3-生涯と証拠) |
| Security Boundary | Required | 固定DI・既存Owner・同期保存を維持する | [§3](#3-生涯と証拠) |
| Implementation Structure | Required | 元Ownerと利用側の一実体を保つ | [実装構造](#implementation-structure) |

## Engineering Concern評価

| Concern | Result | Rationale | Evidence／Related ID |
|---|---|---|---|
| Concurrency | PASS | Controlと準備は同じRuntimeの私有状態、別Ownerは拒否 | [§3](#3-生涯と証拠) |
| Timing | PASS | 既存Setup／Provider期限・取消猶予を変更せずjoinまで扱う | [§2](#2-sourceと公開入口) |
| Resource Lifecycle | PASS | 技術終了と上位Host清掃を分ける | [§3](#3-生涯と証拠) |
| External Boundary | PASS | 固定DIと元Hostの用途固定操作へ限定する | [§1](#1-責務と依存) |
| Failure／Recovery | PASS | 一次故障・回収と元exact参照を分離保持する | [§3](#3-生涯と証拠) |
| State／Consistency | PASS | 準備消費と操作・回復参照の相関を保つ | [§3](#3-生涯と証拠) |
| Observability | PASS | 同期保存・終端結果・閉形式診断を分ける | [§3](#3-生涯と証拠) |
| Security／Trust | PASS | 本番Factoryに任意CLI／Process実装を注入しない | [§2](#2-sourceと公開入口) |

- `PASS`: 詳細設計上の処置が定義された状態。実装・実境界の成功ではない。
- `N/A`: Architecture上、そのConcern自体が存在しない状態。未検討を意味しない。
- `OPEN`: 未解決の設計事項が残る状態。
- `FAIL`: 必須設計と矛盾する又は必要な処置が未充足の状態。

## Qualityへの引渡し

| 導出キー | 設計項目種別 | 対象 | 正常条件 | 反証する失敗 | 主な試験段階 | 外部境界の段階 | 観測 | 終了後条件 | 未確認 |
|---|---|---|---|---|---|---|---|---|---|
| `executor.single-provider-attempt` | Boundary／Resource Lifecycle | 一段のProvider試行と上位への証拠搬送 | 元準備一回消費、同期保存、同Controlのjoin、元結果照合 | 別Owner・コピー・失効・開始失敗・取消・終了不明・保存拒否 | IT | Direct Boundary／Adjacent 1 Block | 元参照・呼出し数・閉形式結果・exact回復参照。要求・受理・開始・終了・回収を分離 | 資源終了の実観測又は未解決義務。Task完了と同一視しない | 新Packageの実Docker／実AIは未実施 |

## Implementation Structure

| 観点 | 適用 | 判定理由 | 成立させる構造 | 局所責務・不変条件 | 失敗・変更時の影響 | Qualityへの導出キー |
|---|---|---|---|---|---|---|
| Variation | Required | Codex／Claudeの既存差を吸収する | Provider差はAI Adapter、共通試行は同じExecutor | Provider差を固定構成へ反映する | 両Provider反例を維持 | `executor.single-provider-attempt` |
| Common Contract | Required | Taskと助言が同じ開始・取消・終了を利用する | 公開Rootの有限操作 | Task順序を含めない | 全利用側へ同時追従 | `executor.single-provider-attempt` |
| Creation／Selection | Required | 本番と試験のAuthorityを区別する | 固定本番Factoryと隔離候補 | 候補を本番へ昇格しない | 不正開始はEffect前拒否 | `executor.single-provider-attempt` |
| State-dependent Behavior | Required | 開始後だけ取消・終端を同じControlへ結合する | 私有Control Map | コピー・再使用拒否 | 遅延通知と取消を反証 | `executor.single-provider-attempt` |
| Composition／Recursion | N/A | Taskの再帰計画・Queueを持たない | 一段の閉包だけ | 調停はCoordinator | 計画要求は上位へ | `executor.single-provider-attempt` |
| Lifecycle Ownership | Required | 終了前に結果を確定しない | 下位Sessionのjoinと既存操作記録 | 同期保存・exact回収 | 不明は義務を保持 | `executor.single-provider-attempt` |
| External Boundary | Required | Provider／DI／Host保存の境界がある | 元参照と用途固定callback | 先行boolean化禁止 | 生出力非保存・相関保全 | `executor.single-provider-attempt` |

## 1. 責務と依存

ExecutorはProvider一段を一試行として、準備値の一回消費、開始、取消、終了待ち、結果正規化、技術資源の回収と元証拠の照合を所有する。編集→レビュー→限定是正→再レビューの順序、Task／Queue、Workspace、共通Host作業領域の清掃、耐久的な現在状態と配送は所有しない。

| 所有者 | 担当 | 接続先 |
|---|---|---|
| Domain Model | 定義・局所CRUD・共通保存 | Executor／Coordinatorへ依存しない |
| Coordinator | 選定・送信同意・Task進行・Host保存と回復 | DomainとExecutorの公開Root |
| Executor | 一回のProvider試行・取消・終了証拠 | AI Adapterの計画／結果変換、Docker Isolationの固定実行 |
| Docker Isolation | Docker CLI・資源・Process・回収の技術処置 | 既存Platform Access |

単独Core利用ではCoordinatorもExecutorもロード不要。Executorはbin・Server・Queue・保存正本・追加Lockを持たない。Hostの有限保存操作は既存の相関・Authorityを使用し、新しい管理機構へ一般化しない。

## 2. Sourceと公開入口

```text
executor/src/
├ index.ts                    有限公開APIと共有型の明示export
├ attempt/
│ ├ preparation.ts            固定構成・callback結合・一回準備と入力構築
│ ├ validation.ts             用途限定入力・許可参照・技術選定の捕捉と検査
│ ├ execute.ts                一試行の開始・取消・join・結果通知のOwner
│ ├ isolation.ts              Docker構成・固定Command検査・資源清掃後の終了接続
│ ├ observation.ts            非秘密診断の投影と受動的callback通知
│ └ types.ts                  試行入力・Host操作・準備値の型
└ result/
  ├ types.ts                  公開・共有結果型と非秘密診断型
  ├ attempt.ts                開始拒否・一試行の最終結果の組立て
  ├ task.ts                   AI Adapterの解析・内容検査と実行観測の結合
  ├ advice.ts                 AI Adapterの助言解析・内容検査への接続
  └ validation.ts             回復応答・技術結果・共通文字列の閉形式検査
```

本番入口`createExecutor(host)`は固定Docker Isolationを構成し、`start`、`cancel`、`verifyCleanupOutcome`を返す。`start`は元準備・管理参照と同期の回復引渡しを取り、開始結果の`completion`を同一試行の終了まで待つ。取消要求の返却だけで終了成立とはしない。新しいRequest／Result SchemaやTimeoutは導入しない。

準備入口`createAttemptPreparation`は既存の有限Host操作からProvider別の準備Ownerを構成し、共通の`prepare(AttemptInput)`、cancel、consumeを返す。入力のpurposeはtask／advice／probeを区別し、それぞれの元Packet参照だけを受ける。Factory呼出しだけでは準備・実行しない。任意のProcess代役を受ける`createExecutorTestCandidate`は本番Authorityを持たず、別のControl状態を使う。Package外の結合試験が必要とする試験入口は明示公開するが、Command計画構築・内部検査・内部Key一覧を試験の都合だけで通常Rootへ公開しない。

Coordinatorの`execution/provider-executor.ts`は本番Executorを一度だけ生成する固定接続部。旧Controllerには単段Controller実装を残さない。要求前保存は固定Host callbackへ直接接続し、終端材料は既存の操作記録へ渡す。Domainの既存終了保存Contextはその記録を読み取り、Executorへ逆照会しない。初期化中の相互参照は関数宣言の束縛だけとし、構築中に実行せず、追加Loaderや遅延Registryを置かない。

### 内部整理の境界

`preparation.ts`は一試行の入力構築・構成・一回消費を所有し、Taskの計画を作らない。`execute.ts`が唯一の生涯Ownerとして開始・取消・終了待ちを管理する。`isolation.ts`の終了接続は、下位Sessionが清掃を終えた後に既存の不存在保存→Mount終了→回復終了を行う。正常SessionのDocker清掃を二重実行しない。開始前故障の限定清掃は引き続き同じ実行Ownerが呼ぶ。

Task／Adviceとも同じstartとcompletionを使い、`AttemptResult`の`normalizedResult`を型付き`AttemptContent`として返す。実行時の編集・レビュー内容はAI Adapterの`provider/task-result.ts`、助言の内容モデル・Schema・許可参照検査は`provider/advice-result.ts`が唯一所有する。Domainにあった旧実体・公開APIは撤去し、保存Schema・Writer・遷移は変更しない。Executorの`result/task.ts`／`result/advice.ts`は共通Provider解析と内容検査を結合する内部処理であり、次試行許可を発行しない。入力の許可参照集合は準備時に複製・固定し、試行Identityへ含める。結果の用途別内容は保ち、同じfieldへ無理に平坦化しない。

限定是正証拠の発行・一回消費はCoordinatorの`execution/preparation.ts`だけが所有する。Executorは初回レビューの検査済み所見を固定Host callbackへ内部搬送し、Hostが返した許可だけをTask結果へ付加する。callback欠測・拒否・例外でも検査済みレビュー内容を失敗へ改ざんせず、許可を付けない。Coordinatorは許可なしでは次試行へ進まない。二回目レビューから新しい是正許可を発行しない。所見本文を通常結果や保存診断へ追加せず、新しいMapや公開の発行入口をExecutorへ作らない。

Docker用助言Commandの結合とHashはDocker Isolationの`execution/binding.ts`が所有する。同意前の入力固定と実行時照合は同じHash形式を使用する。公開・共有結果型は`result/types.ts`から明示し、共通byte上限・文字列検査は既存`validation.ts`内に置く。barrelや互換転送ファイルは追加しない。

Provider固有のEnvelope抽出はTask／AdviceともAI Adapterの`parseProviderResult()`へ委譲する。Executorは同じAI Adapterの内容検査で編集Path・レビュー所見・助言の許可参照を検査し、その値と実行観測を結合する。共通化のためだけのNormalizer入口や汎用変換Frameworkは追加しない。

Executorの製品Sourceと公開RootはDomain Modelを参照しない。選定設定・Catalog世代・選定理由を含む完全選定の検査とHash算出は上位が所有する。下位へ渡す選定はProvider、Model識別子、識別種別、推論強度、用途、役割の六項目と照合用`selectionHash`だけに限定する。Hashは不透明な相関値でありAuthorityでも完全選定の検証でもない。準備時と開始時にModel・Task／Advice Packet・Commandの相関を検査し、六項目とHashをProcess内の試行Identityへ含める。このIdentityを保存Schemaの変更や過去記録の移行として扱わない。

`attempt/validation.ts`は上記六項目と用途限定入力・許可参照だけを捕捉し、Proxy、accessor、特殊prototype、余剰、欠測、疎配列を拒否する。汎用の公開Snapshot APIは作らない。技術完了理由の発行集合は`result/validation.ts`が所有し、Domainの保存受理集合とは独立した契約としてexact一致を試験する。理由・拒否順序・保存形式は変えない。試験Harnessが合成記録を上位Ownerとして保存することと、Executor製品自身の永続化を区別する。

Probeも同じAI Adapter解析入口を使用し、ExecutorへCodex／Claudeの解析分岐を持たせない。認証解析は同じCommand観測から一回行い、後続の認証Gateはその確認結果を使用する。Offeringの正本はAI Adapterの認証記述であり、ExecutorにProvider別の定数判断を複製しない。

### 正規構築と開始直前照合

準備・開始とも`resolveProviderExecution`で同じ有限なProvider仕様要求を構成し、AI Adapterの正規計画を使用する。DockerのImage・Proxy・Mount・認証環境・Seccomp構成はDocker Isolationの`bindProviderCommand`一箇所へ集約する。Executorの準備側に別のDocker構成Object組立を残さない。

初回は既存乱数Ownerが一回生成したProxy Tokenをcreate入力として渡す。再照合はverify入力で元九CommandからTokenを観測し、同じ正規構成から再生成した用途・順序・全argvを完全照合する。両方式の混在・Token欠測・不正値は拒否する。resolverは乱数、Registry又は保存を所有しない。DIへ渡すのは有限技術値だけで、Operation・Packet・Authority・Recovery・本文を渡さない。

開始時は`resolveValidatedPlan`が選定・Packet・Mountの意味相関を先に確認し、一回の構築結果をそのまま下位へ渡す。Boolean検査後に同じ構成を再構築しない。全Tokenを一括変更したコピーの排除は構成比較単体ではなく、既存の私有準備Map・元管理参照・一回消費が担う。Revision／Authority再確認・Recovery引渡し・submission先行保存・取消join・清掃後公開は維持する。

回復開始理由はHost境界の有限投影としてExecutorに残すが、現行の開始・在庫・Lock解放契約が使う7理由だけを対象にする。Producer・Reader契約にない旧保存方式の理由は未知値として既存unavailableへ閉じる。Domainは安定したAttempt理由と保存合法性を所有し、Coordinator固有のraw理由表をDomainへ移さない。理由投影で元結果・exact Recovery ID・manual回復条件は変えない。

`consumer`の既存値は表示の振分けではなく、選定・回復・終了証拠のIdentityへ結合されるため維持する。通知原本の照会API三つは撤去する。開始・取消・下位清掃検証、拒否理由と結果fieldの意味は維持する。助言結果には形式識別名・版番号を要求せず、呼出し用途と内容Schemaで検査する。製品コードへ旧照会APIや旧形式IDの互換層を置かない。

| 公開API群 | 所有者 | 役割 |
|---|---|---|
| `createExecutor`、`ExecutorHost`、`Executor` | attempt | 単段開始、同じControlの取消、下位清掃結果の確認 |
| `createAttemptPreparation`、`PreparationHost`、`AttemptPreparation` | attempt | 準備Ownerの構成と一回使用。Task進行を管理しない |
| `AttemptPreparationResult`、`PreparedAttempt` | attempt/types.ts | 成功・拒否のunionとprepared成功部分を区別する |
| `AttemptStartResult`、`AttemptResult` | result/types.ts | 開始結果と清掃後の最終結果。実装のReturnTypeから導出する |
| `ProcessStartedNotice`、`AttemptDiagnosticNotice` | attempt/observation.ts | 実Provider Process開始と非秘密診断。受付開始と混同しない |
| `AttemptInput` | attempt/types.ts | Task／Advice／Probe共通の公開準備入力 |
| `AttemptContent`、`TaskResult`、`AdviceResult` | result/types.ts | 同じ終了結果に載せる用途別の型付き内容 |
| Task／Advice結果の正規化 | 内部のみ | 利用側が中間検査を組み立てる公開入口は持たない |
| 技術結果・診断・回復参照の検査と投影 | result/validation.ts | 閉形式の結果を公開する。状態を進めない |

#### 形式名と内部公開の境界

- `ADVICE_INPUT_CONTRACT`／`ADVICE_RESULT_CONTRACT`とそれぞれの版番号定数はRoot非公開とし、Executor内の形式タグを廃止する。AdvicePacketは同じ操作・選定・Prompt・Hash・非共有条件を保持するが、contract／contractRevisionを要求しない。Coordinatorが私有PacketのHash形式として保持する識別情報はCoordinatorだけが所有し、Executorの実行条件にしない。
- 助言結果はstatusと四区分・本文・根拠参照を検査する。AIに形式名・版番号を応答させず、必要な形は既存`describeAdviceResultSchema()`から取得する。余分field・重複Key・曖昧JSON・容量超過・許可参照外・空参照の拒否は維持する。Taskへ形式タグ検査を追加して対称化しない。
- 旧タグ付き応答を新Schemaとして互換受理する層は追加しない。新しい実行のPromptとSchemaを同時に切り替え、過去の結果・Evidence・保持物は書換えない。実AIの再送は別承認とする。
- `ATTEMPT_OBSERVATION_KEYS`、内部Command・内部準備型・`ownDataValue`・完全計画検査はRoot非公開。検査の項目集合はvalidationの私有値とし、利用側へは必要な検査関数と結果型を渡す。
- `TaskPacket`／`AdvicePacket`は固定準備Hostの内部搬送型とし、Rootから個別公開しない。Host実装側は必要なら公開`PreparationHost`のcallback型から返却契約を導出し、私有Moduleを直接importしない。`AdviceResultItem`はAI Adapter所有の内容項目型であり、Executorから再公開しない。Task／Adviceの一試行内容型は`TaskResult`／`AdviceResult`として同じ群へ置く。
- `normalizeTaskResult`、`normalizeAdviceResult`、`describeAdviceResultSchema`、`consumeTaskRemediation`、`hashAdviceCommand`、`bindAdviceCommand`はExecutor Rootから公開しない。内容Schemaが必要な利用側はAI Adapter、Docker構成が必要な利用側はDocker Isolationの正規入口を利用する。
- 試験用公開は`createExecutorTestCandidate`、`createPreparationFailure`、`bindIsolationRuntime`、`describeIsolationContract`。現在のPackage外結合試験へ必要な接続だけを残し、本番Authorityや自由な本番Process注入を許可しない。

製品CLIは追加しない。scriptsは有限検証専用で、ライブラリのRoot APIを置き換えない。

## 3. 生涯と証拠

1. Hostが選定・同意・入力・実行対象を確定し、準備の元Capabilityを渡す。
2. Executorは一回消費と現在のAuthorityを照合し、Effect前に同じexact回復参照をHostへ同期的に引き渡す。
3. 下位要求を発行し、受理・開始・応答・終了を区別する。過去Effectのunknownを成功又は不存在へ補完しない。
4. 要求前は固定Hostの同期保存callbackを直接呼び、exact trueを確認してからEffectへ進む。保存拒否・例外は要求を発行せず停止する。未発行確定は同じ操作Ownerと用途を渡し、Domainの専用Writerが短期排他内で`intent_saved`を再確認する。
5. 取消・遅延応答を同じControlへ結合し、終了待ちと元資源の回収を行う。一次故障を清掃結果で上書きしない。
6. 最終結果の組立て→Home解放の現在確認→固定終端callbackの順で、同じ操作・回復参照の既存記録へ結果と観測を渡す。初回値は固定し、異なる終端材料の差替えを拒否する。callback例外・欠測はHostの終了保存を成立させないが、技術結果や清掃事実を改ざんしない。共通Host清掃と配送完了はCoordinatorが別途確定する。

通知の原本・コピー・失効を管理するMapと照会APIは持たない。外部の任意値を内部通知として受ける公開入口も設けない。本番Host型はsubmission・notIssued・terminalの三callbackを必須とする。Controlと準備の一回消費、下位清掃結果の実体検証は別責務として維持する。生保存OwnerをRootへ公開せず、Domain→Executor依存を作らない。生Provider出力・認証値は保存せず、既存の閉じた診断だけを搬送する。

試験用の組立は製品Hostとは区別する。`scripts/verify-provider-attempt.ts`は明示呼出し時だけ非AI検証を開始し、既存ITも同じ関数を使う。試験の新品Repository-local Rootに限る排他と、Domainの既存確定JSON保存・読戻しを接続し、要求前の同期保存Gate、元Owner、終端callbackの相関を確認する。生成物は全子Process終了後に確認して回収し、確認不能ならexact Rootを報告する。これは試験fixture専用排他とイベントcommitであり、本番共有Home／Host排他、認証、Runtime state Writer又はRecovery保存の成立ではない。製品用Hostや保存Frameworkを新設せず、必要な有限試験構成をscripts／tests内に置ける。

実Homeの事前確認は別の明示入口`scripts/verify-provider-home.ts <provider> <run-id>`とする。固定Provider一値の既存Home metadataをPlatform Accessで観測し、既存と同じProviderHome Pipe名を使って共有排他を一回取得する。保持中の再観測と四Hash一致を要求し、元Lockの解放・終了を確認する。Native・取得・解放の未知は別に保持し、試験checkpointだけを残して停止する。checkpointへHome Path・Hash・SID・ACL・認証内容は保存しない。通常の単独非AI入口からは呼ばず、実行は用途限定の別承認を必要とする。これは事前観測であり、認証状態、AI実行許可、試行全体を覆うHome保持又は本番Host回復の成立ではない。

単段実試験の組立補助`scripts/provider-attempt-host.ts`は、呼出し側が検証・取得した同期Home排他と固定計画を受ける。一回限りの元管理・準備・回復参照、五資源の提出前記録／Receipt、同期保存確認、DIの元清掃結果、元終端だけを同じ新品試験Rootの確定JSON列へ接続する。生存確認は開始・所在借用・保存ごとに行い、技術清掃の明示不存在記録後だけ元排他を一回解放する。失敗時のretry・強制清掃・別回復参照は作らない。同期解放が返すのは既存Coordinatorと同じ解放状態到達であり、Worker最終exitまでのcleanup証明とは区別する。呼出し側の子Process終了確認と残存時のRoot保持が必要である。補助自体はHome観測・排他取得・試験Root作成・同意を代行せず、製品Host保存やHost喪失後の回復機能を提供しない。

## 4. 検証と未実施境界

単段試験の合成指示は、既存`describeAdviceResultSchema()`のJSONとexact許可参照集合を同じPromptへ含める。Codex助言はCLIのSchema引数ではなくPromptで結果契約を伝えるためであり、手書きの別Schemaを正本にしない。表示Prompt・Hash・Packet・実stdinは同じ値へ結合する。技術completedと元終端保存が成立した後に内容検査だけが拒否された場合、既存Normalizerの固定理由を結果reasonへ残す。実行失敗又は元終端保存失敗は内容理由で上書きせず、Envelope欠測は既存の未確認理由へ閉じる。生出力は保存しない。

単段試験HostのReceiptは、本番Coordinatorと同じくDocker stdoutを`trim()`してから64桁の小文字16進IDとして検査・保存する。複数ID・途中改行・不正文字は拒否し、正常な行末を作成失敗へ読み替えない。生応答は保存しない。

試験所有`tmp/`の清掃は、Providerの生成物名やFile内容に依存させない。元Root・確定イベント・実行終了・資源回収・Home解放・子Process終了が共同成立した場合だけ、今回Rootの`tmp/`内の通常FileとDirectoryを対象にする。Fileは非link・単一link、Directoryも非link、全対象はlexical Pathとrealpathが一致することを要求する。本文やHashは取得せず、全treeの実体・Fileのsize／mtime／mode・各Directoryの子一覧を削除前に棚卸しする。メモリ使用を有限にするため逐次列挙でFile／Directory合計10,000 entry以内とし、超過は削除前に停止する。File容量・階層・名前の独自制限は追加しない。

tmpは内側から通常unlink／rmdirで回収し、各削除直前に元Root、tmp、全祖先の実体・残るべき子一覧と対象metadataを再照合する。tmp全体の清掃が終わるまで作業領域・確定イベント・managementは削除しない。初回棚卸し不成立では削除零、開始後の同時変更・Filesystem故障ではその対象の処置前に停止し、先行したtmp削除を取り消さず、残存Rootと結果を保持して未完了を返す。OS上の任意の同時改変に対する原子的削除保証は主張しない。新Lock・監視・Recovery・再帰force削除は追加せず、製品領域、OS tmp、過去保持Rootには適用しない。work・management・確定記録の既存の限定契約は維持する。

単段試験Hostの作成前記録はpurpose・既存計画の予定資源名・所有labelを持つ。これは予定の相関であり、Docker受理・実在・削除許可ではない。正常時の試験Root清掃は、五用途各一件・単一label・終了資源観測との予定名完全一致も要求する。既存の境界終了通知から、同じ操作・Provider・回復参照に一致する一次故障と固定終了boolだけを受け取り、試験結果IPCの`diagnostic`へ載せる。排他解放成功後だけ同じ投影を確定JSONへ保存し、解放拒否・不明後は書かずメモリから搬送する。診断保存失敗で実行結果を変更せず、生本文・例外本文・Home情報は保存しない。通知の受領をWorker exit・子close・清掃成功の証明にしない。

単段実試験CLIは`scripts/verify-provider-real.ts --describe <provider>`と`--run <provider> <run-id>`を分ける。前者は固定合成Context・Model／medium・Image Digestと非共有境界の純粋表示だけを行う。後者は会話等で用途・送信内容・モデル・回数・回収範囲について事前の人間承認を取得した実行者が明示的に呼び出す。端末の有無や確認コード入力は要求せず、nonce結合したIPC子一件を開始する。承認の永続台帳・自動判定・別の確認Frameworkは追加しない。子はRoot確定の親確認後、既存Home二観測・同期排他・固定助言計画・試験Hostへ接続する。Repository／Workspaceはmountせず、tools／session無効・API Key fallbackなし・Provider一回だけとする。取消・親切断は同Controlへ伝えcompletionをjoinし、親は一つの相関結果と子closeを共同確認する。既存単段期限から導いた試験監督上限を超えた場合は取消し、終了不明・Root保持とし、実行期限を緩和したり強制成功へ変更しない。

親は子close前に試験Rootを清掃・更新しない。Effect前に子が元回復参照を親へ渡し、親の受領確認後だけ開始する。結果搬送を失っても同じ参照を保持する。監督上限では同Controlへ一回取消し、既存取消猶予内でcloseを待つ。close未観測ではRootを更新せず、そのexact Pathと既知参照を報告する。元終端保存・exact回復参照・同期解放・技術清掃・正常closeの共同成立後、初回Root Identity、連番の確定JSONと既知Schema、非link・nlink、tmpの所有範囲とwork／managementの個別条件を確認して既存削除へ接続する。期待と異なる終端・tmp外の未知名・partial・内容不整合等では清掃せず、closeを観測した場合だけ当該Rootに非秘密の結果と七日後の再評価時刻を保存する。期限だけで削除しない。子stdout／stderrはdrainするが本文を保存・表示しない。固定Imageの存在・Engineの使用可否と外部送信は別途承認された読取り確認・一回試験で検証し、このCLI実装や代役試験から成立としない。

既存ERB-IT-002／004の反例を維持し、Provider両方の準備一回性、候補Owner交差、固定callback接続、元結果の相関、正常・取消・開始失敗・清掃不明・Owner喪失を非AIで確認する。Task段階順序はCoordinatorの既存有限試験で確認する。

独立ロードはCoordinator解決を拒否する子Processで実施し、不正開始のEffect零を検査する。これを正常な実Docker／実AI実行の証明にしない。実境界のL3／L5、人間操作、実データ移行は別途許可・検証であり、今回のSource移管から完了としない。結果と適用範囲は[移管計画](../../../99_Roadmap/Changes/CHG-000082/runtime-responsibility-realignment-plan.md)へ記録する。

同じ独立子Processで、既存の隔離候補と実Controller／DI command sessionに合成Plan・有限CommandHandle・Host callbackを接続する。正常終了、wait中の取消とjoin、清掃不明、同期通知保存例外を検査し、元回復参照・一回消費・固定callback接続・別Owner拒否を確認する。

本番Factoryの配線は、子Process内でDocker Isolation RootのFactory一つだけをModule代役へ替えて別構成で検査する。実公開builderと計画検査・投影を使い、下位へ渡すidentity／構成／stdin／元Ownerと元清掃結果を照合する。代役Runtimeは公開の候補sessionへ有限CommandHandleを渡すもので、本番Docker Runtime内部ではない。Hostから余剰に渡した実行primitiveの利用と外部Process起動は拒否する。両構成をCodex／Claude形式の合成Probeで確認する。固定Docker Runtime内部、実Process／Container不存在、Host Process喪失時の回収はこの模擬試験の対象外とする。実境界の既存結果はCHGの対象版付き記録を参照し、本体等価の配置変更を再送の理由にしない。

## 現行実装との照合

### 単段編集・レビュー・取消の検証候補

検証CLIの有限modeは`advice`（省略時）、`edit`、`review`、`cancel`である。製品APIとTaskの順序管理は変更しない。既存の一子監督・同期Home排他・提出前記録・Receipt・元回復参照・終了保存・close後の限定清掃を共有し、合成Taskの記述・構築・物理検査だけを`scripts/task-trial.ts`へ置く。試験結果契約はv2とし、内容確認は`contentConfirmed`へ統一する。過去v1の記録を読む互換Readerや保持物移行は追加しない。

編集は新品Root内の`work/source.txt`だけを`BASE`から`EDITED_OK`（各末尾LF）へ変更する。保護用の空`.git`・`.crdd`は既存の三Mount構成で読取り専用とする。レビューは同じ検査済みbytesと差分を固定の読取り投影として標準入力で受け、ファイル読取り・ツール利用を指示しない。各試行は新品Rootを使うため、これは内容Hashで相関する単段確認であり、物理Workspaceの引渡し又はCoordinatorの順序制御の検証ではない。

取消は同じ操作・Provider・役割の開始通知を受け、同じControlへ一回要求しcompletionをjoinする。開始観測・取消要求の受理と終了観測・`cancelled`終端・元回復参照・清掃・Home解放・保存・子closeを共同確認する。`completed`を取消成功に読み替えない。取消後のFileが既知の二値以外、未知File／Directory、link、nlink差、実体変更、部分保存又は観測不能なら保持する。正常時も親の子close後に、元RootとDirectoryの実体・既知Fileの内容と単一linkを再照合し、通常unlinkと内側からの空Directory削除だけを行う。

人間の判断によりCodex GPT-6.1 Sol reviewerの暫定拒否を撤去し、通常のAI Adapter／Executor APIへ接続する。検証用Source置換ローダーとその専用試験は廃止する。既存のProvider・mode・Model・Effort・Packet・Mount相関、nonce・spec Hash・一回消費・回復参照・終了確認を維持し、不正な入力・余剰引数は開始前停止する。

元回復参照の発行前に準備が拒否された場合も、有限の理由と終了結果をIPCで保持する。これは回復参照null・blocked・fixture未確定・実行結果／終端／技術清掃未成立の閉条件に限定する。回復ACKを既に発行・受領した操作へ適用せず、同じexact参照の一致は引き続き必須とする。準備拒否を回収完了へ変換せず、子close後に既知記録を保持して個別に処置する。

Code Modeの全Tool不使用又は全ファイル非読取りの証明は追加の完成条件にしない。観測できるCommand／FileChange件数は診断情報であり、件数だけで実行を拒否・成功化しない。レビュー用workのbytes／Identity不変、正規レビュー結果、元終了保存・清掃・解放を共同確認する。既存のread-only Mount／sandboxと認証領域の保護・通信制御・隔離を維持し、許可Mount内の読取りをDockerが禁止するとは扱わない。新しいRunner、Queue、Registry、Lock又は永続許可台帳は設けない。

元の単段実装を上記Sourceへ移管した。計画・入力・取消・失敗結果の意味を変えず、Coordinatorの順序管理と保存を用途固定接続へ残す。非AI回帰と独立確認の結果は[移管計画](../../../99_Roadmap/Changes/CHG-000082/runtime-responsibility-realignment-plan.md)を正本とし、本書の設計評価とは区別する。実AI／Docker成立、実データ移行、全体QA／Releaseは本書から主張しない。

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
