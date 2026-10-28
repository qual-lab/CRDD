# Provider単段Executorの詳細設計

成果物種別: Architecture詳細設計
詳細設計領域: executor
状態: Candidate（非AI検証対象）
維持責任者: Qual-Lab

## 基本設計との関係

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
| Security Boundary | Required | 固定DIと私有Mapを維持する | [§3](#3-生涯と証拠) |
| Implementation Structure | Required | 元Ownerと利用側の一実体を保つ | [実装構造](#implementation-structure) |

## Engineering Concern評価

| Concern | Result | Rationale | Evidence／Related ID |
|---|---|---|---|
| Concurrency | PASS | Control・準備と通知は同じRuntimeの私有状態、別Ownerは拒否 | [§3](#3-生涯と証拠) |
| Timing | PASS | 既存Setup／Provider期限・取消猶予を変更せずjoinまで扱う | [§2](#2-sourceと公開入口) |
| Resource Lifecycle | PASS | 技術終了と上位Host清掃を分ける | [§3](#3-生涯と証拠) |
| External Boundary | PASS | 固定DIと元Hostの用途固定操作へ限定する | [§1](#1-責務と依存) |
| Failure／Recovery | PASS | 一次故障・回収と元exact参照を分離保持する | [§3](#3-生涯と証拠) |
| State／Consistency | PASS | 準備消費と元objectの相関を保ち、コピーを受理しない | [§3](#3-生涯と証拠) |
| Observability | PASS | 通知失効・元result・閉形式診断を分ける | [§3](#3-生涯と証拠) |
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
| Variation | Required | Codex／Claudeの既存差を吸収する | Provider差はAI Adapter、共通試行は同じExecutor | Provider別Mapを共用しない | 両Provider反例を維持 | `executor.single-provider-attempt` |
| Common Contract | Required | Taskと助言が同じ開始・取消・終了を利用する | 公開Rootの有限操作 | Task順序を含めない | 全利用側へ同時追従 | `executor.single-provider-attempt` |
| Creation／Selection | Required | 本番と試験のAuthorityを区別する | 固定本番Factoryと隔離候補 | 候補を本番へ昇格しない | 不正開始はEffect前拒否 | `executor.single-provider-attempt` |
| State-dependent Behavior | Required | 開始後だけ取消・終端を同じControlへ結合する | 私有Control Map | コピー・再使用拒否 | 遅延通知と取消を反証 | `executor.single-provider-attempt` |
| Composition／Recursion | N/A | Taskの再帰計画・Queueを持たない | 一段の閉包だけ | 調停はCoordinator | 計画要求は上位へ | `executor.single-provider-attempt` |
| Lifecycle Ownership | Required | 終了前に結果を確定しない | 下位Sessionのjoinと元証拠Map | 通知失効・exact回収 | 不明は義務を保持 | `executor.single-provider-attempt` |
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
├ index.ts                    利用中の有限操作・値型の明示公開
├ attempt/
│ ├ execute.ts                固定の本番構成／分離された試験候補
│ ├ controller.ts             一試行の開始・取消・join・終了相関
│ ├ preparation.ts            Provider別準備Mapと一回消費
│ ├ plan.ts                   計画・Command・入力Hashの純粋構築
│ ├ types.ts                  技術入力・準備値の型
│ ├ isolation.ts              既存Docker Isolationへの薄い接続
│ └ observation.ts            通知・終端の私有Mapと元object照合
└ result/
  ├ normalization.ts          助言・編集・レビューの結果正規化
  └ validation.ts             技術結果・非秘密診断の閉形式検査
```

本番入口`createProviderExecutor(host)`は固定Docker Isolationを構成し、`start`、`cancel`、`verifyProviderSubmissionNotice`、`verifyUnissuedNotice`、`borrowTerminalObservations`、`verifyCleanupOutcome`を返す。`start`は元準備・管理参照と同期の回復引渡しを取り、開始結果の`completion`を同一試行の終了まで待つ。取消要求の返却だけで終了成立とはしない。新しいRequest／Result SchemaやTimeoutは導入しない。

準備入口`createProviderDockerRuntimeAdapterCandidate`は既存の有限Host操作からProvider別の一回準備を構成する。名称のcandidateは既存API名であり、自由なProcess実装を本番へ注入する意味ではない。純粋な計画・正規化・閉形式検査は同じRootから利用する。任意のProcess代役を受ける`createIsolatedDockerProcessControllerCandidate`は本番Authorityを持たず、別のcontrols／観測Mapを使う。

Coordinatorの`execution/provider-executor.ts`は本番Executorを一度だけ生成する固定接続部。旧Controllerには単段Controller実装を残さない。保存・確定・回復の三利用側はこの同じ実体のVerifierを使う。初期化中の相互参照は関数宣言の束縛だけとし、構築中に実行せず、追加Loaderや遅延Registryを置かない。

## 3. 生涯と証拠

1. Hostが選定・同意・入力・実行対象を確定し、準備の元Capabilityを渡す。
2. Executorは一回消費と現在のAuthorityを照合し、Effect前に同じexact回復参照をHostへ同期的に引き渡す。
3. 下位要求を発行し、受理・開始・応答・終了を区別する。過去Effectのunknownを成功又は不存在へ補完しない。
4. Provider通知は登録→元通知を使う同期保存callback→`finally`失効の順。事前boolean化・コピー・async照合は禁止。
5. 取消・遅延応答を同じControlへ結合し、終了待ちと元資源の回収を行う。一次故障を清掃結果で上書きしない。
6. 元result objectと管理参照・操作ID・回復IDが一致した時だけ終端観測を借用する。共通Host清掃と配送完了はCoordinatorが別途確定する。

Map・登録関数・生保存OwnerはRootへ公開しない。Domainへは従来の用途固定同期callbackだけを渡す。Map搬送・二重登録・Domain→Executor依存を作らない。生Provider出力・認証値は保存せず、既存の閉じた診断だけを搬送する。

試験用の組立は製品Hostとは区別する。`scripts/verify-provider-attempt.ts`は明示呼出し時だけ非AI検証を開始し、既存ITも同じ関数を使う。試験の新品Repository-local Rootに限る排他と、Domainの既存確定JSON保存・読戻しを接続し、元通知の同期Gate、コピー・失効の拒否、終端相関を確認する。生成物は全子Process終了後に確認して回収し、確認不能ならexact Rootを報告する。これは試験fixture専用排他とイベントcommitであり、本番共有Home／Host排他、認証、Runtime state Writer又はRecovery保存の成立ではない。製品用Hostや保存Frameworkを新設せず、必要な有限試験構成をscripts／tests内に置ける。

実Homeの事前確認は別の明示入口`scripts/verify-provider-home.ts <provider> <run-id>`とする。固定Provider一値の既存Home metadataをPlatform Accessで観測し、既存と同じProviderHome Pipe名を使って共有排他を一回取得する。保持中の再観測と四Hash一致を要求し、元Lockの解放・終了を確認する。Native・取得・解放の未知は別に保持し、試験checkpointだけを残して停止する。checkpointへHome Path・Hash・SID・ACL・認証内容は保存しない。通常の単独非AI入口からは呼ばず、実行は用途限定の別承認を必要とする。これは事前観測であり、認証状態、AI実行許可、試行全体を覆うHome保持又は本番Host回復の成立ではない。

単段実試験の組立補助`scripts/provider-attempt-host.ts`は、呼出し側が検証・取得した同期Home排他と固定計画を受ける。一回限りの元管理・準備・回復参照、五資源の提出前記録／Receipt、同期通知照合、DIの元清掃結果、元終端だけを同じ新品試験Rootの確定JSON列へ接続する。生存確認は開始・所在借用・保存ごとに行い、技術清掃の明示不存在記録後だけ元排他を一回解放する。失敗時のretry・強制清掃・別回復参照は作らない。同期解放が返すのは既存Coordinatorと同じ解放状態到達であり、Worker最終exitまでのcleanup証明とは区別する。呼出し側の子Process終了確認と残存時のRoot保持が必要である。補助自体はHome観測・排他取得・試験Root作成・同意を代行せず、製品Host保存やHost喪失後の回復機能を提供しない。

## 4. 検証と未実施境界

単段試験の合成指示は、既存`describeAdviceResultSchema()`のJSONとexact許可参照集合を同じPromptへ含める。Codex助言はCLIのSchema引数ではなくPromptで結果契約を伝えるためであり、手書きの別Schemaを正本にしない。表示Prompt・Hash・Packet・実stdinは同じ値へ結合する。技術completedと元終端保存が成立した後に内容検査だけが拒否された場合、既存Normalizerの固定理由を結果reasonへ残す。実行失敗又は元終端保存失敗は内容理由で上書きせず、Envelope欠測は既存の未確認理由へ閉じる。生出力は保存しない。

単段試験HostのReceiptは、本番Coordinatorと同じくDocker stdoutを`trim()`してから64桁の小文字16進IDとして検査・保存する。複数ID・途中改行・不正文字は拒否し、正常な行末を作成失敗へ読み替えない。生応答は保存しない。

単段試験Hostの作成前記録はpurpose・既存計画の予定資源名・所有labelを持つ。これは予定の相関であり、Docker受理・実在・削除許可ではない。正常時の試験Root清掃は、五用途各一件・単一label・終了資源観測との予定名完全一致も要求する。既存の境界終了通知から、同じ操作・Provider・回復参照に一致する一次故障と固定終了boolだけを受け取り、試験結果IPCの`diagnostic`へ載せる。排他解放成功後だけ同じ投影を確定JSONへ保存し、解放拒否・不明後は書かずメモリから搬送する。診断保存失敗で実行結果を変更せず、生本文・例外本文・Home情報は保存しない。通知の受領をWorker exit・子close・清掃成功の証明にしない。

単段実試験CLIは`scripts/verify-provider-real.ts --describe <provider>`と`--run <provider> <run-id>`を分ける。前者は固定合成Context・Model／medium・Image Digestと非共有境界の純粋表示だけを行う。後者は入力・出力TTYと一回の確認コード一致後だけ、nonce結合したIPC子一件を開始する。子はRoot確定の親確認後、既存Home二観測・同期排他・固定助言計画・試験Hostへ接続する。Repository／Workspaceはmountせず、tools／session無効・API Key fallbackなし・Provider一回だけとする。取消・親切断は同Controlへ伝えcompletionをjoinし、親は一つの相関結果と子closeを共同確認する。既存単段期限から導いた試験監督上限を超えた場合は取消し、終了不明・Root保持とし、実行期限を緩和したり強制成功へ変更しない。

親は子close前に試験Rootを清掃・更新しない。Effect前に子が元回復参照を親へ渡し、親の受領確認後だけ開始する。結果搬送を失っても同じ参照を保持する。監督上限では同Controlへ一回取消し、既存取消猶予内でcloseを待つ。close未観測ではRootを更新せず、そのexact Pathと既知参照を報告する。元終端保存・exact回復参照・同期解放・技術清掃・正常closeの共同成立後、初回Root Identity、連番の確定JSONと既知Schema、非link・nlink、全用途Directoryの空を確認して既存削除へ接続する。取消・未知名・partial・内容不整合等では清掃せず、closeを観測した場合だけ当該Rootに非秘密の結果と七日後の再評価時刻を保存する。期限だけで削除しない。子stdout／stderrはdrainするが本文を保存・表示しない。固定Imageの存在・Engineの使用可否と外部送信は別途承認された読取り確認・一回試験で検証し、このCLI実装や代役試験から成立としない。

既存ERB-IT-002／004の反例を維持し、Provider両方の準備一回性、候補Owner交差、通知失効、元結果の相関、正常・取消・開始失敗・清掃不明・Owner喪失を非AIで確認する。Task段階順序はCoordinatorの既存有限試験で確認する。

独立ロードはCoordinator解決を拒否する子Processで実施し、不正開始のEffect零を検査する。これを正常な実Docker／実AI実行の証明にしない。実境界のL3／L5、人間操作、実データ移行は別途許可・検証であり、今回のSource移管から完了としない。結果と適用範囲は[移管計画](../../../99_Roadmap/Changes/CHG-000082/runtime-responsibility-realignment-plan.md)へ記録する。

同じ独立子Processで、既存の隔離候補と実Controller／DI command sessionに合成Plan・有限CommandHandle・Host callbackを接続する。正常終了、wait中の取消とjoin、清掃不明、同期通知保存例外を検査し、元回復参照・一回消費・通知失効・別Owner拒否を確認する。

本番Factoryの配線は、子Process内でDocker Isolation RootのFactory一つだけをModule代役へ替えて別構成で検査する。実公開builderと計画検査・投影を使い、下位へ渡すidentity／構成／stdin／元Ownerと元清掃結果を照合する。代役Runtimeは公開の候補sessionへ有限CommandHandleを渡すもので、本番Docker Runtime内部ではない。Hostから余剰に渡した実行primitiveの利用と外部Process起動は拒否する。両構成ともClaude形式の合成Probeであり、両Providerの実実行、固定Docker Runtime内部、耐久保存、実Process／Container不存在、Host Process喪失時の回収は未検証とする。

## 現行実装との照合

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
