# AI Adapter詳細設計

成果物種別: Architecture詳細設計
詳細設計領域: ai-adapter
状態: Candidate
維持責任者: Qual-Lab

## 基本設計との関係

AI Adapterは、Adapter、Model、Profileの構成契約とProvider固有の起動・認証方式・結果変換を所有する。実装は旧`ai-runtime`とCoordinator内のProvider固有差を`ai-adapter`へ統合する。任意実行Path・任意CLI引数・秘密値をCatalogへ持たず、実行Authorityの発行、Docker／Processの所有、外部送信許可と共通の回収判定はCoordinatorに残す。

Profile管理、Provider計画・CLI固有引数・認証方式・構造化結果のSourceは`ai-adapter`へ接続済みである。Coordinatorには、AI Adapter記述とMount・Egress・選定Identity・実行Capabilityを結ぶ共通実行組立てが残り、段階5Cで統合する。Source移管の局所成立と、再編後の署名・実Provider境界の未評価を区別する。再編の進捗と検証結果は[CHG-000082の移管計画](../../../99_Roadmap/Changes/CHG-000082/Evidence/261007_develop-responsibility-mapping.md)で追跡する。

| Architecture定義 | この領域が具体化する責務 | Relation状態 |
|---|---|---|
| [ARCH-000010](../../Definitions/ARCH-000010/architecture_definition.md) | Profile Catalogの閉じたSchema、決定論的な解決、利用可能性の四軸評価 | Covered |
| [ARCH-000004](../../Definitions/ARCH-000004/architecture_definition.md) | Provider固有の計画と構造化結果を共通実行契約へ接続する。実行・回収AuthorityはCoordinatorに残す。 | Partial |
| [ARCH-000015](../../Definitions/ARCH-000015/architecture_definition.md) | Workbench助言・変更候補のProvider差を共通入口へ変換し、生出力と共通判断を分離する。 | Partial |

## 詳細成果物の適用判断

| 詳細成果物 | 判定 | 理由 | 正本節／成果物 |
|---|---|---|---|
| Component Model | Required | Catalog、Store、限定管理ApplicationおよびConsumerの責務を分ける。 | [構成要素と意味](#2-構成要素と意味) |
| Interface Model | Required | Repository／CROS設定、ConsumerおよびProvider実行との境界を固定する。 | [公開入口と依存方向](#3-公開入口と依存方向) |
| Data Flow | Required | Candidateから採用済みSnapshot、解決結果、表示までを区別する。 | [公開入口と依存方向](#3-公開入口と依存方向) |
| State Model | Required | Candidate、Adopted、Resolved、Availabilityを区別する。 | [状態とLifecycle](#5-状態とlifecycle) |
| Sequence | Required | 検証、Revision照合、Snapshot公開、Consumer利用を順序化する。 | [公開入口と依存方向](#3-公開入口と依存方向) |
| Failure／Recovery | Required | Schema不正、競合、未解決、未観測およびProvider失敗を分ける。 | [Failureと回復](#6-failureと回復) |
| Deployment | Required | Repository config RootとCROS OS管理config Rootを別Ownerに固定する。 | [公開入口と依存方向](#3-公開入口と依存方向) |
| Observability | Required | Revision、解決Identity、四軸AvailabilityおよびProvider Effect 0を観測する。 | [Qualityへの引渡し](#qualityへの引渡し) |
| Security Boundary | Required | Secret、任意Path、任意引数および実行AuthorityをCatalog外にする。 | [Schemaと拒否境界](#4-schemaと拒否境界) |
| Implementation Structure | Required | 共通Catalog契約とOwner別Store／Consumer Variationを評価する。 | [Implementation Structure](#implementation-structure) |

## Engineering Concern評価

| Concern | Result | Rationale | Evidence／Related ID |
|---|---|---|---|
| Concurrency | PASS | expectedRevisionで同時更新の上書きを拒否する。 | [状態とLifecycle](#5-状態とlifecycle) |
| Timing | PASS | Availabilityは観測時の四軸を保持し、未観測を成功へ畳まない。 | [Schemaと拒否境界](#4-schemaと拒否境界) |
| Resource Lifecycle | PASS | Snapshot FileはOwner別Storeが生成・公開し、Provider資源を所有しない。 | [公開入口と依存方向](#3-公開入口と依存方向) |
| External Boundary | PASS | Repository、CROS、Coordinator、WorkbenchおよびProviderを別境界にする。 | [公開入口と依存方向](#3-公開入口と依存方向) |
| State／Consistency | PASS | Candidate、採用済みSnapshot、Revisionおよび解決結果を分ける。 | [状態とLifecycle](#5-状態とlifecycle) |
| Failure／Recovery | PASS | 拒否時Effect 0と、再検証・再観測の戻り先を定義する。 | [Failureと回復](#6-failureと回復) |
| Observability | PASS | Revision、Profile ID、Availability理由およびProvider Effect 0を観測する。 | [Qualityへの引渡し](#qualityへの引渡し) |
| Security／Trust | PASS | Credentialや実行Authorityを設定値から生成せず、未知Propertyを拒否する。 | [Schemaと拒否境界](#4-schemaと拒否境界) |

- `PASS`: 詳細設計上の処置と根拠節が揃った状態。実Provider接続済みを意味しない。
- `N/A`: Architecture上、そのConcern自体が存在しない状態であり、未評価を意味しない。
- `OPEN`: 未解決の設計事項が残る状態。
- `FAIL`: 必須設計と矛盾する、または必要な設計が未充足の状態。

## 2. 構成要素と意味

```text
AI Profile Catalog
├ Adapter Definition
│  ├ Provider
│  ├ 許可Model
│  └ 利用可能な認証方式
├ Profile Definition
│  ├ 安定Profile ID
│  ├ Adapter／Model
│  ├ 選択Role／Tier
│  └ 既定Reasoning
└ Availability Observation
   ├ Adapter登録
   ├ Host利用可能性
   ├ 認証状態
   └ 実行Authority
```

AdapterはProvider固有の起動、認証、取消、結果および回復の意味を表す。ModelはAdapterが許可する実Modelである。Profileは利用目的と選択条件をAdapter／Modelへ結ぶ。Claude Codeのような実行環境と`gpt-6-astra`のようなModelを同一概念へ畳まない。

## 3. 公開入口と依存方向

```text
Repository-local設定 ─┐
CROS設定 ────────────┼─→ 設定Adapter ─→ AI AdapterのProfile Catalog
                      │                    ├ 検証
                      │                    ├ 一意解決
                      │                    └ 利用可能性評価
                      │                         │
                      └─────────────────────────┼──────────────┐
                                                ▼              ▼
                                            Coordinator     Workbench
                                            選択Consumer    表示Consumer
```

- Repository単体とCROS Serverは同じCatalog Schemaを使うが、保存場所、採用AuthorityおよびLifecycleは各設定Adapterが所有する。Repository単体は`.crdd/config/ai-profile-catalog/`、CROSはOS管理config Rootの`ai-profile-catalog/`へ別の不変Snapshot列を持つ。
- AI AdapterのCatalog検証・解決Coreは検証済みSnapshotを入力にする純粋な境界である。File Adapterは固定Rootへの保存だけを所有し、採用AuthorityまたはProvider Effectを発行しない。Provider計画・変換の公開面は[§7](#7-provider差の公開契約と実行境界)に分ける。
- CoordinatorはProfile ID、AdapterおよびModelを再定義せず、Workbench等で明示選択されたProfile IDをTask Request、Route Candidate、Selection Grantへexactに搬送する。明示IDとProvider／Role／Tierが一致しない場合はProvider Effect前に拒否する。
- WorkbenchはProfile設定と利用可能性を表示するが、未観測を利用可能へ畳まず、一覧表示から実行Authorityを生成しない。Repository単体とRemote CROSでは、登録済みAdapter／Modelだけを使うProfileの作成・更新・確認付き削除を、それぞれのOwner Storeへ接続する。CROS管理は`systemAdmin`を持つ認証済み接続だけへ公開し、Content Workspace Grantとは分離する。

## 4. Schemaと拒否境界

| 観点 | 必須の処置 | 拒否する例 |
|---|---|---|
| 閉じたSchema | 未知Propertyを拒否する | `apiKey`、`executablePath`、任意`args` |
| Adapter参照 | 登録済みAdapterだけを参照する | 存在しないAdapter ID |
| Model参照 | Adapterの許可Modelだけを参照する | 未登録Model、Provider不一致 |
| 一意解決 | 同じ選択条件から一件だけ解決する | 同じRole／Tier／Familyの重複Profile |
| 安定Identity | Profile IDを重複させない | 同じProfile IDの再利用 |
| Availability | 四軸を独立評価する | 未観測を`available`または`unavailable`へ丸める |

秘密値、Provider Home、Host PathおよびCredentialはCatalogへ保存しない。認証済みかの観測結果と、認証に使う秘密情報を分ける。

## 5. 状態とLifecycle

| 状態 | Owner | 終了条件 |
|---|---|---|
| Catalog Candidate | RepositoryまたはCROS設定Adapter | 検証拒否、取消、採用 |
| Adopted Catalog Snapshot | 各設定Owner | 次改訂版の採用または利用終了 |
| Resolved Profile | AI Runtime | 呼出し完了 |
| Availability Observation | 実行環境Observer | 再観測またはSession終了 |
| Provider Command／Result Translation | AI Adapter | 計画・変換の完了。Process起動・回収の完了ではない |
| Provider Execution | Coordinator | 実行結果、Process終了と資源回収を別々に観測し、同じOperationをsettleする |

永続Snapshotが一件もない正常なOwner Storeは、Schema検証済みの既定Catalogを`revision 0`として返す。これは採用済みFileの代替ではなく、最初の採用で`expectedRevision: 0`を照合し、成功時にだけ`revision 1`を公開するための初期Snapshotである。Coordinatorは同じSnapshotからProfileを解決し、Profile ID、Adapter、Model、ReasoningおよびCatalog RevisionをExecution Planまで変更せず搬送する。DirectoryまたはSnapshotを観測できない場合、Revision列が不連続な場合、Envelope／Schemaが破損している場合は例外で停止し、`revision 0`へ縮退しない。

既定Catalogの設定本文は統合後の`40_Develop/ai-adapter/src/catalog/default-ai-profile-catalog.json`へ置く。同梱JSONはOwner別の採用済みSnapshotではなく、初期値を定める配布設定である。Catalog Coreは静的JSON importで読み込み、通常のCatalog Validatorで検証した深い不変Snapshotだけを公開する。欠落、JSON構文破損またはSchema不正では初期化を停止し、埋込み旧値や空Catalogへ戻らない。署名RuntimeがCatalog Coreを消費する場合は、このexact JSONも静的依存として内容Identityと配布閉包へ含める。利用者が採用したOwner Snapshotは同梱初期値の変更だけでは上書きしない。

現在の実装は既定Catalog、閉じた検証、一意解決、利用可能性評価、Owner別の耐久Snapshot採用、Repository／CROS WorkbenchのProfile限定管理、Coordinator互換解決、Workbench表示およびWorkbench AI依頼Portまで成立している。Workbenchが選んだProfile IDは、同じCatalog SnapshotのAdapter、Model、ReasoningとCatalog Revisionへ解決され、読取り助言のTask HashおよびProviderとともに一回送信境界までexactに保持される。CROSでは`systemAdmin`を持たないCredentialへCatalogの内容・件数を開示しない。Production Compositionは専用Dispatch、Provider別の固定Adapter選択、Repository非共有の読取り助言専用Execution Plan、固定配布物へ接続するProvider Command Plan、Provider出力抽出およびLifecycle判定を行うExecutor Coreまで接続した。Executor Coreから署名Runtimeへ渡す入力は、Operation、Profile、Task／Projection Hash、PromptおよびCommand Hashを結合した一回消費Packetへ固定し、再利用、別Owner消費、取消後利用および共有境界の拡張を拒否する。Codex／Claude Adapter、Docker Effect、Process ControllerおよびRecoveryは`workbench_advice`を独立Modeとして受理し、Provider HomeとOperation一時領域だけを共有し、助言Promptをstdinだけへ渡し、Provider Envelopeを助言JSONへ縮約してcleanup後に返す。Coordinatorの署名済みRuntimeは実行時に到達する`catalog.ts`／`types.ts`だけをCatalog Coreとして消費し、Store／管理Surfaceを暗黙に署名閉包へ含めない。Production CompositionはOperation生成、Model Selection、Mount Grant、Packet発行およびProcess Controllerまで成立済みである。未確認は今回の是正を含む署名済み配布物の再固定・直接起動と実Provider E2Eであり、局所Mode成立を実Provider利用可能とは表示しない。

## 6. Failureと回復

| Failure | 結果 | 回復 |
|---|---|---|
| Schema不正／未知Property | Effect 0で拒否 | Candidateを修正し再検証 |
| Adapter／Model不一致 | Effect 0で拒否 | 登録済み構成へ戻す |
| 解決結果0件／複数件 | 暗黙Fallbackせず未解決 | 選択条件またはCatalogを修正 |
| Store／Snapshot観測不能・破損 | 例外で停止し、既定CatalogまたはRevision 0へ縮退しない | Owner Storeを復旧し同じ入口から再観測 |
| Host／認証／Authority未観測 | `unknown` | 対応Ownerが再観測 |
| 一軸でも利用不可 | `unavailable` | 失敗軸を解消後に再観測 |
| 採用後のProvider失敗 | Provider境界の結果として保持 | Coordinatorの回復契約へ渡す |
| Profile削除の確認なし | Effect 0で拒否 | 対象Profileを確認して再要求 |

## 7. Provider差の公開契約と実行境界

### 7.1. 責務別配置と公開操作

```text
40_Develop/ai-adapter/src/
├ index.ts             共通のProfile・計画・結果契約
├ catalog/             Catalog検証、一意解決、既定JSON
├ profile/             Owner別設定Store、登録・編集・削除
├ advice/              助言CLI計画・Provider出力変換。共通結果Schemaは呼出し側から受け取る
├ output/              曖昧でないJSON解析とTask EnvelopeのProvider差変換
├ codex/               公式Codexの計画・認証方式・出力変換
└ claude/              Claude Codeの計画・認証方式・出力変換
```

DirectoryはProviderまたは具体責務を表し、`internal/`、`application/`、`runtime/`等の中間階層を増やさない。標準公開入口は`src/index.ts`一つとし、以下のCatalog、Profile管理、Provider計画・変換、出力解析の操作を実体Sourceから明示exportする。子Directoryに公開集約Fileを置かない。Rootは管理Storeの生成関数も公開するが、importだけでOwner設定を読取り・変更したりProviderを起動したりしない。静的依存閉包にはRootが到達する管理Moduleも含まれ得る。Coordinatorの署名では実際の静的閉包とCatalog JSONを検証し、Named importだけから管理Module不存在を主張しない。

| 公開操作／既存Symbol | Ownerと入口 | 入力／出力 | Authority／Effectと禁止事項 |
|---|---|---|---|
| `validateAiProfileCatalog`、`resolveAiProfile`、`resolveAiProfileById`、`evaluateAiProfileAvailability` | Rootから`catalog/resolve.ts` | 明示Snapshot・条件・独立した観測軸／検証・一意解決・利用可能性 | 純粋処理。unknownを実行可能へ補正せず、Authorityを発行しない |
| `createAiProfileCatalogRegistry`、`createAiProfileCatalogAdministration`、Owner別Store生成 | Rootから`profile/registry.ts`、`administration.ts`、`store.ts` | 期待Revision、登録済みAdapter／Model、明示管理操作／採用Snapshot・競合拒否 | 許可Ownerの設定だけ保存。CROS管理権限とContent Accessを分離し、秘密や任意実行入口を受理しない |
| `planCodexReadOnlyProbe`、`planCodexIsolatedTask` | Rootから`codex/execution-plan.ts` | Mode、Role、effort等の固定入力／固定公式CLIの起動計画 | 外部Effectなし。計画はcandidateであり、起動・外部送信・Mount Authorityを含まない |
| `planClaudeReadOnlyProbe`、`planClaudeIsolatedTask`、`planClaudeTaskTurnBudget`、`buildClaudeExecutionArguments` | Rootから`claude/execution-plan.ts` | Mode、Role、Task予算、照合済みModel・effort／固定CLI計画・Turn予算・完成argv | 外部Effectなし。Model受理と選定IdentityはCoordinator、Claude固有オプションと固定argv順序はAI Adapter。Turn完了とProcess終了・資源不存在を同一視しない |
| `normalizeCodexStructuredResult`、`normalizeClaudeStructuredResult` | Rootから各Providerの`structured-result.ts` | 対応固定CLIの出力Envelope／共通の構造化入力または拒否 | 生出力を公開しない。候補採否・共通Task判定・是正Capabilityの発行はCoordinator |
| `describeProviderBillingPolicyContract`と課金方針定数 | Rootから`profile/billing-policy.ts` | 引数なし／Subscription限定の不変な方針記述 | 既存CoordinatorのAPI key課金fallback・追加購入非対応を記述する。Quota不足、構成選択や利用者設定から有料APIへの切替・実行Authorityを発行しない。将来の明示Profile、exact Provider／Account、専用Credential、予算、操作Authorityの5条件は未実装機能の要件記述であり、現実の課金防止やRuntime許可の証明ではない。 |
| `parseUnambiguousJsonDocument` | Rootから`output/`の実体Source | 未信頼JSON文字列／構造化値または拒否 | 重複key、不正文法、BOM、末尾データを拒否する純粋解析。Codex・Claude・助言から共有し、Provider固有入口を経由しない |
| `extractProviderTaskEnvelope` | Rootから`output/`の実体Source | Provider、Role、受理Turn上限、CLI出力／構造化入力・固定拒否理由・本文非公開の実行観測 | Codex JSONL、Claude Result・Turns・Usageの解釈だけを所有する。共通Schema、Reviewer判断、Remediation Capability、実Process終了・cleanup判定はCoordinator |
| `isProviderSubscriptionAuthenticationConfirmed` | Rootから`profile/subscription-status.ts` | Provider、期待Offering、認証Probeの出力／固定条件の一致 | Process終了、出力量、取消はCoordinatorが評価する。対話認証とは判定契約を分け、出力の分類だけから実行Authorityを発行しない |
| `classifyProviderNonzeroExit` | Rootから`output/provider-error.ts` | Providerと非正常終了出力／共通失敗理由 | 構造化エラーと限定診断を既存の順序で分類し、生出力を返さない。終了・取消・資源回収の判定はCoordinatorが所有する |
| `evaluateProviderEligibility` | `index.ts`から`profile/eligibility.ts`へ接続 | Capability、認証、Quota、公式配布、Policyの五軸観測／利用可能性候補 | 観測取得はCoordinatorが所有する。欠落・不正・未観測を確認済みへ補正せず、実行直前確認の候補を認証成立・実行Authorityへ昇格しない |
| `providerProfileSupportsExecution`、`providerProfileMatchesExecutionIdentity` | 共通入口から`profile/execution-identity.ts`へ接続 | 解決済みProfile、呼出し側の必要Role、明示実行Identity／Subscription条件とexact一致の真偽 | 純粋な既存条件の照合。Task対応、Catalog改訂・Hash・Prompt検査、実行条件、Executor呼出しと取消・回収はCoordinator。真偽値を認証成立や送信Authorityとしない |
| `normalizeProviderExactModelId`、`prepareProviderFixedEnvironment` | 共通入口から`profile/execution-identity.ts`、`profile/environment.ts`へ接続 | Model文字列、Providerと固定CLI環境／構文一致値・順序付き環境組またはnull | Provider禁止名と値を一回取得して検査する。Docker引数化、Proxy値、Mount、Prepared Capability、取消・回収はCoordinator。構文一致を提供Modelや実行権限の成立としない |
| `planWorkbenchAiAdviceProviderCommand` | 共通入口から対応Providerの計画関数へ直接分岐 | exact Profile Identity／Provider別の助言コマンド計画 | Promptはstdin用。任意argv、API-key・有料APIへのFallbackを追加しない |
| `extractWorkbenchAiAdviceProviderOutput` | 共通入口から対応Providerの変換関数へ直接分岐 | Provider、固定CLI stdout／助言JSONまたは閉じた拒否理由 | Providerの通知分類・Envelope差だけを処理。共通助言Schema・開示範囲・採用判断はCoordinator |
| Provider認証方式・Probe計画・Provider固有終了解釈 | 各Providerの用途限定公開入口 | Codexのlogin status／CODEX_HOME、Claudeのlogin／status・固定認証環境、Provider別禁止環境変数／固定記述と分類 | 秘密値は既存専用Homeに残す。実Home観測、対話Process、Docker、Lock・回復記録はCoordinator／Native。記述自体を認証確認済みとしない |

Contract文字列、改訂値、理由値、固定CLI配布IdentityはFolder改名だけで変更しない。計画・変換が混在する既存Fileは責務単位で分割し、共通Packet／GrantをProvider側へ移さない。新Providerを予測したPlugin Registryや動的実行Frameworkは作らず、現在のCodex／Claudeの二つ目の具象から共通契約を固定する。

Codex／Claude計画が利用する共通Record入力防御は、[Domain ModelのPlain Data公開契約](../domain-model/01_Architecture.md#33-rootから公開する責務別契約)へ直接依存する。Coordinator内の実装を逆importせず、Provider側にもコピーしない。共通防御はRecord／Arrayの浅い検査と所有Snapshot化だけを所有し、Profile Store、Authority、Process・Docker・回復へ依存しない。既存の返却値と負例を維持し、Provider入力の個別契約と共通防御を混同しない。

### 7.2. 実行・取消・失敗の接続

| 境界 | AI Adapter | Coordinator／利用側 |
|---|---|---|
| 入力 | exact Catalog Revision、Profile、Model、Roleから計画を作り、不一致を拒否 | 同じ解決Identityを依頼、選定、Packetと実行へ搬送する |
| 認証 | 認証方式とProvider固有のProbe・結果分類 | 専用Homeを実観測。秘密値をPrompt・設定・ログへ複製せず、未認証時だけ具体的な再認証を案内 |
| 起動 | 固定公式CLI、argv、出力契約を提示するだけ | 外部送信、実行・Mount許可、Docker／Processを取得・所有する |
| 結果 | Provider通知、完了Envelopeと一意な構造化本文を分離 | 共通Schema、申告と候補実体、Review結果、cleanupを独立に判定する |
| 取消・遅延 | Provider固有の終了・取消通知を分類。通知だけで実Process停止を主張しない | 同じOperationでProcess tree終了、Container／Network不存在を観測。遅延・重複通知から新Effectや二重結果を発行しない |
| 失敗・再入場 | 最初のProvider失敗理由を保持。別Model／Providerへ黙ってFallbackしない | Primary Failureとcleanup／Secondary Failureを分ける。再入場・限定unknown終了はCoordinatorの責務 |
| 履歴 | 共通履歴を直接書かない | Coordinatorが下位実行事実、Orchestratorが上位Attempt事実をExecution Intelligenceへ渡す |

公式CLIは未改造の配布物を使う。旧助言専用Build、Source Patch、Host差替えの再構築経路は移管しない。固定CLIの要求・完了・出力契約を確認し、Docker隔離とCRDD側の計画・結果境界で責務を閉じる。

### 7.3. QA導出と残る照合

既存`ai-runtime.*`の五導出キーはProfile意味の参照として保持する。Provider計画・出力変換はCoordinatorの既存`coord.provider-selection`、`coord.provider-attempt`から担当断面を分離して対応させる。導出キーの改名・QA-IDの追加をFolder変更だけで行わない。

Provider構造化結果の純粋解析・拒否は`ERB-UT-032`、Subscription限定の課金方針記述は`ERB-UT-033`へ導出する。前者は単一exact結果、重複key・不正文法・不足Envelope・Codex容量境界とTurn／cost反例・生出力非公開を観測し、後者は固定方針fieldと設定だけでは実行Authorityを発行しないことを観測する。Codexの16KiB、Claudeの2 turns／0.10はnormalizerの固定契約値であり、Providerの費用・終了・課金防止を保証する値ではない。Codexの容量はUTF-8 bytesで判定し、16,383／16,384 bytesは受理、16,385 bytesは拒否する境界を実入力で確認する。この値をClaudeの容量契約へ適用しない。既存UT016再認証、UT023助言統合、IT／STの実CLI・資源終了義務は代替しない。旧Domain Outcome／Trust軸のLocal Itemを今回の純粋UTへ流用しない。

必要な反証は、曖昧Profile、Snapshot不一致、未知／不正Provider出力、CLI非ゼロ、出力不足、取消前後の遅延通知、認証未観測、cleanup不明である。計画関数の成功からProvider Effect、取消完了、資源不存在や実E2E Passを推定しない。

| 分割する操作・型 | 実利用側と再編後の接続 | 既存の検証義務と担当断面 |
|---|---|---|
| Codex／Claudeのread-only probe・isolated task計画 | Coordinatorの`docker-execution/provider-execution-plan.ts`と`command-effects.ts`がAI Adapterの各Provider公開入口を利用する。二Provider Docker Adapterの`buildPlan`を含め、Container名・Network・Mount・PreparedPlanの所有はCoordinatorに残す。 | `ERB-IT-001/006`で実CLI契約と固定入力・Profile・計画拒否、`ERB-ST-005/030`で公開結果・取消・回収を確認する。Codex公式配布だけの追加確認は`ERB-IT-031`とし、Claude起動の根拠へ流用しない。 |
| `planClaudeTaskTurnBudget`、Provider別構造化出力変換 | Claude Docker Adapter、Coordinatorの`provider/task-structured-result.ts`、`docker-execution/process-controller.ts`から各Provider公開入口を利用する。共通Executor／Reviewer Schemaと是正判断はCoordinatorに残す。 | `ERB-IT-001/002`で曖昧・不足・不正Envelopeと失敗分類、`ERB-ST-005/030`で実Processの終了・取消・回収を確認する。助言の通知分類は別に`ERB-UT-023`へ対応する。Turn終了だけをProcess終了にしない。 |
| `planWorkbenchAiAdviceProviderCommand`、`extractWorkbenchAiAdviceProviderOutput` | Workbench助言実行計画、Docker Effect Runtime、Docker Process Controllerから共通計画・変換入口を利用する。Workbench ServerからProvider内部Fileをimportしない。 | `ERB-UT-023`の助言入力・結果拒否、`ERB-IT-031`の実CLI、`ERB-ST-030`の実終了条件へ分ける。Providerエラーをtool操作へ誤分類しないが、不正結果を部分公開しない。 |
| `createClaudeSubscriptionAuthenticationPlan`のlogin／status argvと`probeConfirmed` | AI Adapterは純粋なCLI・方式・結果分類を返す。`authenticate-claude-subscription.ts`はCoordinatorの認証実行を呼び、Home・Docker・Lock・cleanup・回復記録を保持する。 | `ERB-UT-016`で再認証計画と結果分類、`ERB-IT-008/017`でHome・fresh Process再入場・回収を確認する。秘密コードと認証出力は固定Task、Catalog、診断へ複製しない。 |
| Catalog検証・Profile解決・Availabilityおよび全公開Profile型 | Profile型は`catalog/types.ts`と`profile/types.ts`が所有し、AI AdapterのRootから明示公開する。Coordinator、CROS、Workbench Server、MCP Serverは公開型と入口へ依存する。 | `ai-runtime.catalog-validation`→`RCM-UT-001/002`、`profile-resolution`→`RCM-UT-001/RCM-IT-005`、`availability`→`RCM-UT-001/RCM-IT-010`を保持する。 |
| Catalog Registry／Administration、Repository／CROS Store生成 | Rootから`profile/registry.ts`、`administration.ts`、`store.ts`へ移し、Owner別Storeを維持する。Workbench管理・CROS管理は同じ意味操作を認可後に利用し、実行計画からStoreを暗黙に開かない。 | `ai-runtime.catalog-adoption`→`RCM-IT-005/010`、`profile-administration`→`RCM-UT-002/RCM-IT-005`。再編後の全Consumer一致は`RCM-ST-012`で別に確認する。 |

認証計画の公開型から実Runtime Capability、Mount source、秘密値を除く。二Provider Docker Adapterの`prepare`／`cancel`／`consumePreparedPlan`、Authority StoreとHome観測はCoordinator所有とし、同名APIをAI Adapterへ複製しない。署名対象は実際の静的依存閉包とCatalog JSONに基づく。Root経由で到達するProfile管理Moduleを含む場合も、操作の実行AuthorityやOwner別のRuntime設定を署名によって発行しない。固定公式CLIは配布Identityと検証方法を保持し、旧改造CLIのSource・Patch・Buildを再導入しない。

Provider公開操作、認証計画と実Home観測の分割、実Consumer、静的JSON・CLI配布Identityの閉包条件とQA義務は本節と全ファイル対応へ固定した。OPEN: Source移管、新公開入口の本番接続、固定CLIの新構成での局所・実境界試験は段階5〜7で確認する。

## Qualityへの引渡し

| 導出キー | 設計項目種別 | 対象 | 正常条件 | 反証する失敗 | 主な試験段階 | 外部境界の段階 | 観測 | 終了後条件 | 未確認 |
|---|---|---|---|---|---|---|---|---|---|
| `ai-runtime.catalog-validation` | Component／Security | 未信頼Candidate→Catalog Validator | 閉じたSchemaと参照整合を満たす | 秘密値、任意実行入口、未知Propertyの受理 | UT | N/A: Process内純粋検証 | 検証結果、拒否理由 | Provider Effect 0 | なし |
| `ai-runtime.profile-resolution` | Selection／Interface | Catalog→Workbench選択→Coordinator Dispatch Input | 同じSnapshot内で選択Profile IDをAdapter、Model、Reasoningへ一意解決し、Catalog Revisionとともに送信境界までexactに保持する | 曖昧解決、暗黙Fallback、Consumer再解釈、非Coordinator Profileの読取り助言利用 | UT／IT | Direct Boundary | Catalog Revision、Profile ID、Adapter、Model、Reasoning、役割 | Consumer間Profile Identity一致、Provider Effect前の不一致拒否 | 一回限り送信Authorityと実Provider E2E |
| `ai-runtime.availability` | State／Observability | 実行環境観測→Availability Projection | 四軸を保って状態を投影する | unknownをavailableへ畳む | UT／IT | Direct Boundary | 四軸、status、reason | 実行Authority 0 | 実Host Observer |
| `ai-runtime.catalog-adoption` | Lifecycle／Consistency | Owner別Candidate→不変Snapshot | Owner別の不変Snapshotだけを現在値として利用する | Candidate直接実行、競合上書き、Repository／CROS混在 | IT | Direct Boundary | Revision、Snapshot、Owner Root | 競合Effect 0、Provider Effect 0 | なし |
| `ai-runtime.profile-administration` | Application／Authority | Workbench管理操作→Repository／CROS Store | 登録済みAdapter／Modelだけで作成・更新し確認済みProfileだけを削除する | 任意Adapter追加、未確認削除、古いRevision上書き、非管理Credentialへの開示 | UT／IT | Direct Boundary | Command、結果理由、Revision、Snapshot、systemAdmin | 拒否時Catalog Effect 0、Provider Effect 0、非管理開示0 | なし |
| `coord.provider-attempt` | Interface／Result | Provider構造化結果の純粋解析・正規化 | 唯一のexact結果だけを受理し、生出力を公開しない | 曖昧JSON、不足Envelope、余分な値、既存上限逸脱の受理 | UT | N/A: Process内純粋変換 | 正規化値、拒否状態、固定契約field。`ERB-UT-032`へ接続 | 実Provider／Filesystem Effect 0 | 実CLI・終了・cleanupは既存IT／STで別評価 |
| `coord.provider-selection` | Policy／Authority | Subscription限定の課金方針記述 | 暗黙有料API切替・追加購入・設定単独Authorityを否定する | 方針記述を実課金防止や未実装APIの許可へ昇格する | UT | N/A: Process内純粋記述 | 固定方針、未実装条件とAuthority非発行。`ERB-UT-033`へ接続 | 実Provider／課金Effect 0 | 現実の課金・認証・実行条件は別評価 |

## 現行実装との照合

| 対象 | 現在状態 | 分類 | 次の処置 |
|---|---|---|---|
| `40_Develop/ai-adapter` | Catalog Schema、既定Catalog、解決、Availability、Owner別File Adapterを所有 | Covered | Consumer追加時も同じ公開入口を使う |
| Coordinator Profile解決 | Repository Ownerの採用済みCatalog Snapshotを依頼ごとに一回観測し、選択IDを同じSnapshotのAdapter、Model、Reasoningへ解決してCatalog Revisionとともに読取り助言Dispatchへ渡す。未登録または非Coordinator ProfileはDispatch前に拒否する | Covered | 再署名した候補の直接起動と実Provider E2Eで同じIdentityの搬送を確認する |
| Workbench読取り助言Dispatch | 一依頼の明示確認をTask Hash、Catalog Revision、Profile ID、Providerへ結合して一回消費し、取消、Effect、cleanup、結果Schemaを分離して判定する。Provider Adapterはexact ProfileをCodex／Claudeの一方へだけ渡し、Execution PlanとProvider Command Planでstdin搬送、Repository／Tool／Session非共有およびfallback禁止を固定する。Executor CoreはProvider固有出力を助言JSONだけへ抽出し、Tool Eventやcleanup不明を拒否する | Covered | 是正後の候補を再署名・直接起動し、Codex／Claudeの実Provider E2Eを閉じる |
| Workbench AI Profiles | 設定と四軸の未観測状態を表示し、Repository OwnerとCROS Ownerを分離したProfile限定管理を接続 | Partial | 実Observerを接続する |
| Repository／CROS設定 | 同一SchemaをOwner別の不変Snapshot列へ保存。RepositoryはLocal Store、CROSは`systemAdmin`限定Remote管理入口へ接続 | Covered | 実Provider注入時もOwnerを混合しない |

## Implementation Structure

| 観点 | 適用 | 判定理由 | 成立させる構造 | 局所責務・不変条件 | 失敗・変更時の影響 | Qualityへの導出キー |
|---|---|---|---|---|---|---|
| Variation | Required | Repository OwnerとCROS Ownerで保存Rootと採用Authorityが異なる。 | 共通Store Port＋Owner別File Adapter | Catalog意味をOwnerごとに変更しない。 | Owner追加時は保存・Authority・移行を再評価する。 | `ai-runtime.catalog-adoption` |
| Common Contract | Required | Coordinator、Workbench、CROSが同じProfile意味を使う。 | 閉じたCatalog Schemaと公開API | ConsumerがProfile IDやAvailabilityを再定義しない。 | Schema変更は全ConsumerとSnapshot移行へ波及する。 | `ai-runtime.catalog-validation`<br>`ai-runtime.profile-resolution` |
| Creation／Selection | Required | Profile作成・更新・削除と実行時選択を分ける。 | Profile限定管理Application＋Resolver | 設定採用をProvider実行Authorityにしない。 | 選択条件変更は一意性とConsumerへ波及する。 | `ai-runtime.profile-administration`<br>`ai-runtime.profile-resolution` |
| State-dependent Behavior | Required | Candidate、Adopted、Resolved、Availabilityで許可操作が異なる。 | Revision付きSnapshot＋Availability Projection | unknown時に実行可能と表示しない。 | 状態追加は表示と拒否契約へ波及する。 | `ai-runtime.catalog-adoption`<br>`ai-runtime.availability` |
| Composition／Recursion | Required | Catalog解決、Provider計画・Envelope変換を共通入力・結果へ合成する。再帰は使用しない。 | CatalogとProvider別公開入口の固定合成。 | ProfileからProfileを参照せず、局所変換の成功を実行・回収完了と扱わない。 | Provider／Envelope追加は共通結果、署名閉包、利用側と反証試験へ波及する。 | `ai-runtime.catalog-validation`<br>`ai-runtime.profile-resolution` |
| Lifecycle Ownership | Required | SnapshotとAvailability観測のOwner・終了条件が異なる。 | Owner別Store＋Consumer局所観測 | StoreがProvider Processを所有しない。 | 耐久方式変更は回復と移行へ波及する。 | `ai-runtime.catalog-adoption`<br>`ai-runtime.availability` |
| External Boundary | Required | Filesystem、Provider Adapter、Coordinator、Workbenchへ接続する。 | 境界別Port／Adapter | 一境界の成功を別境界の実行可能性へ流用しない。 | 新Provider追加時はSchema・Authority・E2Eへ波及する。 | `ai-runtime.catalog-validation`<br>`ai-runtime.profile-resolution` |

Checklist評価根拠: §7の公開操作・Provider分割・実Consumer対応により、Component、Interface、Data／StateおよびSequenceを具体化した。本番接続は未評価である。 §7.3の既存導出キー・Provider反証とLocal Item対応により、Qualityへ対象・観測・終了後条件を渡した。Codex配布とClaude認証の確認範囲を混同していない。

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
