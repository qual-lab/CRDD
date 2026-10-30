# AI Adapter詳細設計

成果物種別: Architecture詳細設計
詳細設計領域: ai-adapter
状態: Candidate
維持責任者: Qual-Lab

## 技術カタログとRepository別AI選択の分離方針 — 2026-10-24

### 指定Modelと最新版CLIへの接続 — 2026-10-25

今回の指定ModelはCodex `gpt-6.1-sol`、Claude `claude-opus-5-5`、推論強度mediumとする。技術Catalogは両exact識別子を既存のadvice／task用途へ登録し、役割別の既定値はRepositoryの`ai-selection.json`が所有する。対応組の宣言は実アカウントでの利用成功・認証・送信同意の証明ではない。取得・Build・非AI検証の現在結果は[実施計画](../../../99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md#repository-capability-and-model-baseline)で区別する。

Codex Task計画はCatalog照合済みの`modelSelection`四値を受け取り、Provider・exact識別方式・Model・EffortとTask入力を再照合する。旧Modelへ補完せず、同じModelを`--model`と`exactModel`へ搬送する。GPT-6.1 Solは公式固定版の定義でCode Mode必須のため、既存の公式Hostを使用し、in-process fallbackを無効化する。Taskの承認・Workspace書込み範囲・コマンド経由のネットワーク通信禁止・multi-agent無効は維持する。GPT-6.1 Solのreviewerも通常のTask計画へ接続する。Code Modeの全Tool不使用証明を追加の起動条件にせず、既存Docker隔離・レビューWorkspaceのread-only Mount・CLIのread-only sandboxと無承認実行拒否・認証領域の保護・通信制御・取消と回収を維持する。ツール利用の指示・CLI設定・実行観測を隔離保証と混同せず、許可Mount内の読取りまでDockerが禁止するとは扱わない。標準設定の独立レビュー担当はClaudeであり、未知の役割別fallbackを作らない。

Codex計画契約は改訂17、現行JSONLの診断値は`fixed_cli_jsonl_v0_164_0`とする。保存済み旧診断`fixed_cli_jsonl_v0_149_1`の読取りは当時値を保持し、新Model実行の許可へ昇格しない。CLI／Hostの配置とImageの固定はDocker Isolationが所有し、AI AdapterへDocker依存を追加しない。

Task JSONLの非秘密実行観測には、完了Itemのerror型件数`itemErrorCount`と、そのmessage文字列がCode Modeの固定表記に一致した件数`itemErrorCodeModeCount`を含める。固定CLIはWarning／ConfigWarningもerror型へ変換するため、これらは実行故障の件数とは限らない。後者は文字列分類であり原因確定ではない。総件数との差は未分類を含み、零からTool未使用やエラー不存在を推定しない。本文・Path・Commandは返さず、従来のEnvelope・Schema・採否条件は変更しない。

`itemErrorKnownWarningTextCount`は固定0.164.0の開発中機能警告・モデルCode Mode対応警告の全文定型に一致したitem数を示す。可変部分は機能key集合・設定Path・Model識別子だけとし、4096文字以内の単一行を検査する。元通知種別はJSONLで失われるため、同じ文面の通常ErrorItemと区別せず、Warning由来・非故障・成功を表さない。総数・Code Mode件数・語句分類・未分類件数から減算せず共同保持する。未知本文は一致零とし、新fieldが存在しない旧記録は欠測のまま維持する。件数は0〜itemErrorCountだけを受理する。

内部error messageの語句観測は`itemErrorHostMentionCount`、`itemErrorSpawnMentionCount`、`itemErrorProtocolMentionCount`、`itemErrorConnectionMentionCount`、`itemErrorToolMentionCount`、`itemErrorPermissionMentionCount`、`itemErrorMissingPathMentionCount`、`itemErrorTimeoutMentionCount`で区別する。各値は該当語句を含むerror item数で、同じitemの複数語句は重複計上する。いずれの語句にも一致しないitemとmessage欠測は`itemErrorUnclassifiedCount`に含める。単にCode Modeを言及するだけでは分類済みとしない。これらは原因・発生点を確定するcodeではなく、実行許可・採否・清掃成立へ利用しない。本文はメモリ内でだけ処理し、任意Path・Command・秘密値を保存しない。各件数は0〜itemErrorCount、総数上限4096。旧観測に九fieldがない場合は欠測を維持し、部分集合や零補完を受理しない。

Codexの非秘密実行観測の検査は`codex/observation.ts`の内部`inspectCodexExecutionObservation(raw: unknown)`が所有する。固定field、数値、mention相関、本文非公開を検査し、凍結観測又はnullを返す。既存`provider/input.ts`の通常データ捕捉を再利用し、現行形・warning欠測形・mention欠測形・旧transport形の読取りを欠測補完せず維持する。Provider解析は生成直後に内部検査を一回通し、不成立時は既存の不正結果へ閉じる。通常RootにはInspectorを公開せず、公開Parserの返却型からExecutorのCompletionResult、Coordinatorの段階結果まで検査済み観測型を伝播させる。同Processの製品利用側は再検査しない。検証ツールの未信頼JSON受入だけが、既存の`./testing`入口から内部Inspectorを利用する。この検査はProvider固有の診断値の受理だけで、実行許可・原因確定・回収成立を意味しない。

AI AdapterはProvider固有の操作、認証方式、技術対応、入力計画と出力変換を所有する。Repository別の役割既定値・作業分類・明示選択と保存はCoordinatorが所有する。旧Profile Catalog、Host／Repository Profile Store、Family／Tierによる自動選定は撤去対象であり、新形式の互換Readerとして残さない。

技術カタログ（Model Catalog）の正本は`src/catalog/model-catalog.json`。`getAiModelCatalog`が深い不変値と内容Identityを返し、`resolveAiModelSelection`がProvider・Model・用途・Effortを照合する。役割、Tier、推奨Model、既定Effort、現在の認証状態を含まない。`opus`はaliasのまま保持し、未観測の実Model版へ変換しない。

Repository設定は[Coordinator設計](../coordinator/01_Architecture.md)と[実施計画](../../../99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md)が所有する。未設定を同梱の旧Profileで補完しない。旧設定・未終了参照の実移行はフロントAIが行い、過去Evidenceと保持②を変更しない。今回のSource整理・合成確認を実AI・実認証・全体E2Eの完成へ換算しない。

### 共通実行計画の新しい選定境界

`planProviderExecution`は助言とTaskで`modelSelection`四項目（`provider / modelIdentifier / identifierKind / reasoningEffort`）を受け、用途・Effort・識別方式を技術Catalogへ照合する。同じ選定とCatalog Identityを計画へ保持し、未知Modelや別Providerへfallbackしない。認証probeにはRepositoryのModel選定を渡さない。

助言Command契約は改訂2。旧`exactModelId`入力は受理しない。結果Schemaは通常のJSON値として独立固定し、Getter・Proxy・toJSON・循環・非JSON値を拒否する。Packet・Grant・操作／Role／Attempt／選定Hashの相関、取消・回収はCoordinatorのOwnerへ残す。

## Docker配置とProvider操作の分離 — 2026-10-19

公式CLIは未改造で利用する。特定配布物の取得元・Hash・Container内配置・固定Image・Dockerfile・SeccompはDocker Isolationが所有し、AI AdapterはDockerに依存しない。`distribution.ts`、旧助言専用Build／Patch／Host差替えを再導入しない。

信頼した構成側は`ProviderExecutionLocations`でCLI Path・作業位置・Provider Home・Schema／設定位置を渡せる。外部要求やCatalogへ任意Pathを追加しない。配置未指定時のCLI名・相対位置は記述にすぎず、実行許可ではない。

Coordinatorは準備時とEffect直前で同じ配置を用いて計画を再照合する。DIはImage同一性・Mount・Network・Seccomp・技術的回収を所有する。Model選定、署名、Hash、CLI版一致のどれも認証・送信同意・実行Authorityの代替にしない。新Registry・Store・Lock・配布Frameworkは追加しない。

## 基本設計との関係

| 正本 | 担当する責務 | 関係状態 |
|---|---|---|
| [ARCH-000010](../../Definitions/ARCH-000010/architecture_definition.md) | 技術Catalog、明示された技術選定、Provider利用可否の値評価 | Covered |
| [ARCH-000004](../../Definitions/ARCH-000004/architecture_definition.md) | Coordinatorから計画・結果変換を利用する境界。業務進行は引き取らない | Covered |
| [ARCH-000015](../../Definitions/ARCH-000015/architecture_definition.md) | 助言・編集・レビューのProvider差と共通結果の接続 | Covered |

[Workspaceの責務](../coordinator/05_Workspace.md#3-packageの責務と依存方向)に従い、Workspace寿命・Queue・Git採用を所有しない。開発用`.env`の読取り可能性の受容と、Provider認証Home・AM鍵・本番Secretの保護は区別する。Cloud Secret取得・自動注入を追加しない。

## 詳細成果物の適用判断

| 詳細成果物 | 判定 | 理由 | 正本節／成果物 |
|---|---|---|---|
| Component Model | Required | 技術Catalog・Provider差・上位Ownerを分離する | [構成要素](#2-構成要素と意味) |
| Interface Model | Required | 公開APIと返却値を型で区別する | [公開入口](#3-公開入口と依存方向) |
| Data Flow | Required | 固定選定・計画・結果の搬送を示す | [依存方向](#3-公開入口と依存方向) |
| State Model | Required | 局所値・不変Catalogと上位実行状態を区別する | [状態とLifecycle](#5-状態とlifecycle) |
| Sequence | Required | 初期化・変換と外部実行の前後関係を定める | [状態とLifecycle](#5-状態とlifecycle) |
| Failure／Recovery | Required | 拒否・unknownと上位回復を分ける | [失敗と回復](#6-failureと回復) |
| Deployment | Required | 同梱JSONとDI所有の実行配置を分ける | [Source配置](#7-provider差の公開契約と実行境界) |
| Observability | Required | 型付き結果と非公開生出力を区別する | [拒否境界](#4-schemaと拒否境界) |
| Security Boundary | Required | 任意実行入口・秘密値・Authorityを所有しない | [拒否境界](#4-schemaと拒否境界) |
| Implementation Structure | Required | 二Provider具象と共通契約を評価する | [実装構造](#implementation-structure) |

## Engineering Concern評価

| Concern | Result | Rationale | Evidence／Related ID |
|---|---|---|---|
| Concurrency | PASS | 不変Catalogと呼出し局所値だけを扱い、新しい排他を持たない | [状態とLifecycle](#5-状態とlifecycle) |
| Timing | PASS | 渡された観測時点の利用可否と技術登録を区別する | [拒否境界](#4-schemaと拒否境界) |
| Resource Lifecycle | PASS | 同期変換の返却で完了し、Process・Home・Docker資源を作らない | [状態とLifecycle](#5-状態とlifecycle) |
| External Boundary | PASS | 同梱JSON loaderと未信頼CLI出力を検査する。CLI自身を起動しない | [失敗と回復](#6-failureと回復) |
| State／Consistency | PASS | Catalog Identityと明示Model・用途・Effort・識別方式を保持する | [拒否境界](#4-schemaと拒否境界) |
| Failure／Recovery | PASS | 固定拒否とunknownを保持し、上位の再試行・回収を代行しない | [失敗と回復](#6-failureと回復) |
| Observability | PASS | 型付き結果・固定理由だけを返し、生出力を公開しない | [拒否境界](#4-schemaと拒否境界) |
| Security／Trust | PASS | 設定・観測・計画を実行Authorityへ昇格しない | [実行境界](#72-実行取消失敗の接続) |

`PASS`: 詳細設計上、必須条件と反証が閉じている。`N/A`: Architecture上、そのConcern自体が存在しない。`OPEN`: 未解決の設計事項を保持する。`FAIL`: 必須設計と矛盾する。

以上は設計上の処置であり、実Provider・実Process・実Docker成立の判定ではない。

## 2. 構成要素と意味

| 構成要素 | 所有する内容 | 所有しない内容 |
|---|---|---|
| 技術Catalog | Provider、Model識別子、exact／alias、対応用途・Effort、互換理由 | Role・Tier・推奨・Repository設定 |
| Provider計画 | 用途別CLI引数、固定環境の意味、入力Schema | 起動許可・Docker資源 |
| 認証記述・結果 | status／login方式、Offering・Origin、構造化結果分類 | Home所在・保護・Lock・回復 |
| 結果変換・課金方針 | 用途別解析、固定失敗理由、Subscription限定の記述 | 品質採否・課金Authority・自動fallback |

## 3. 公開入口と依存方向

`src/index.ts`だけをPackage公開集約とし、実体Ownerから明示exportする。Capability内barrel・互換Wrapper・万能dispatcherは作らない。

```text
AI Adapter 技術Catalog → CoordinatorのRepository選定
                              ↓ 固定した選定
                        AI Adapter Provider計画
                              ↓
                        Coordinatorの実行調整 → Docker Isolation
                              ↑ CLI出力
                        AI Adapter 結果変換
```

WorkbenchはCoordinatorの設定Reader／CAS Writerを使い、AMが共有管理の認可を担当する。MCPは旧Profile四管理Toolを提供しない。AI AdapterはRepository／Host設定の保存・Role判定・管理通信を行わない。Domain Model・Coordinatorへは、型参照や再exportを含め依存しない。

Provider・Effort・技術Model選定・Turn診断の宣言は既存`provider/types.ts`が所有する。Repository設定の役割・分類・選定元・内容IdentityはDomain／上位Ownerが保持し、技術値の宣言をDomainの保存型から逆輸入しない。既存の型名・値域と保存形式は変えない。

Provider入力は内部の`provider/input.ts`で通常Object／Arrayを捕捉し、応答JSONは`provider/json.ts`で重複key・不正文法・余剰文字を拒否する。Catalog検査からProvider計画へ循環しない純粋Moduleに閉じ、保存機能や共通ライブラリを新設しない。Domainの保存入力検査とは適用境界を分け、AI Adapterの入力検査からDomainを呼ばない。汎用JSON解析は内部に隠し、上位の一般JSON読取りはDomainの既存APIを使う。

Provider応答の共通内容正規化は`provider/task-result.ts`（編集・レビュー）と`provider/advice-result.ts`（助言・許可参照・Schema）が所有する。公開の`inspectTaskResultContent`、`parseAdviceResult`、`describeAdviceResultSchema`と結果型をExecutor／Coordinatorが使用する。Envelope抽出の`parseProviderResult`と内容検査を混同せず、既存の拒否順序・理由・返却shapeを維持する。是正許可の発行はCoordinatorに残す。

Domainにあった同じ内容検査は保存処理から利用されていなかったため、元試験とともにAI Adapterへ一実体移管し、Domainの旧ファイル・公開APIは撤去する。正規値・欠測・余剰・動的Property・不正所見・許可外参照と全拒否理由を元契約へ照合する。SchemaのJSON bytesと既存Command Hashも同一とし、Domainの保存Schema・Writer・遷移は変更しない。

## 4. Schemaと拒否境界

<a id="ai-adapter-public-api-refactor"></a>

### 採用済みの公開API再編方針 — 2026-10-19

| 公開API | 戻り値・責務 |
|---|---|
| `getAiModelCatalog` | `AiModelCatalogSnapshot`。不変本文と内容Identity |
| `resolveAiModelSelection` | `AiModelSelectionResult`。resolved／blocked、補完なし |
| `planProviderExecution` | `ProviderExecutionPlanResult`。Provider・用途に対応する計画又は拒否 |
| `evaluateProviderTaskScope` | `ProviderTaskScopeResult`。ClaudeのTurn見積りとCodex非適用を区別 |
| `parseProviderResult` | `ProviderResultParseResult`。用途別解析値又は固定拒否 |
| `convertProviderError` | `ProviderError`。既存の非正常終了入力をProviderと固定理由へ変換 |
| `describeProviderExecution` | `ProviderExecutionDefinition`。対応する操作の記述。配布Identityなし |
| `evaluateProviderAvailability` | `ProviderAvailability`。available／unavailable／unknown／preflight_required |
| `validateProviderModelId` | `ProviderModelIdValidationResult`。128文字以内の既存構文を無変換検査 |
| `prepareProviderEnvironment` | `ProviderEnvironmentResult`。禁止名・型・NULを検査し元順序の値組を返す |
| `describeProviderAuthentication` | `ProviderAuthenticationDefinition`。操作別CLI・Offering・Origin |
| `evaluateProviderAuthentication` | `ProviderAuthenticationResult`。Codex／Claudeの正規出力を同じ確認済み・未認証・確認不能へ変換。出力先と既知警告の検査もここで所有する |
| `describeProviderBillingPolicy` | `ProviderBillingPolicy`。Subscription限定の方針記述 |
| `parseUnambiguousJsonDocument` | 重複key・不正文法・BOM・末尾データを拒否する解析 |
| 既存boolean Probe解析・契約定数、`projectCodexExecutionBoundary` | 現診断Consumerの用途限定操作。Task／助言完成の証明ではない |

通常の失敗を空値や例外だけで返さず状態で絞れる結果にする。一方、固定定義・変換値まで万能Resultへ統一しない。内部Catalog ValidatorはRootから公開せず、同梱初期化が利用する。旧Profile CRUD・Store・型・自動Family／Tier解決は公開しない。

| 拒否境界 | 必須条件 |
|---|---|
| Catalog | exactな閉形式、Provider＋Modelの一意性、非空かつ重複なしの用途・Effort |
| 未信頼値 | Getter／Proxy等を評価せず所有Snapshotへ固定。未知field・任意引数・秘密値を受理しない |
| Model | 識別子・用途・Effortを補正しない。aliasを未観測exact版にしない |
| 環境 | 禁止名全数・非文字列・NULを拒否し、値の一回取得と入力順序を維持 |
| 利用可否 | Capability・認証・Quota・配布・方針の五軸を保持。unknownをavailableへ丸めない |
| 結果 | 生出力を公開せず、解析成功を実終了・cleanup・品質採用と扱わない |

## 5. 状態とLifecycle

| 段階 | Ownerと終了条件 |
|---|---|
| Module初期化 | AI Adapterが同梱JSONを一回検証。欠落・構文不正・Schema不正は起動停止。空値／旧値へfallbackしない |
| 技術選定・計画・解析 | AI Adapterの同期局所値。返却で完了し、状態Store・保留要求・資源を残さない |
| Repository設定編集 | Coordinator設定Store。競合・保存確定不能・明示再取得は[設定設計](../coordinator/01_Architecture.md)の責務 |
| Task受付・開始済み選定 | Coordinator。役割・設定Identity・選定Hash・操作・Attemptを結合し、回復時に再選定しない |
| Process実行・取消・回収 | CoordinatorとDocker Isolation。開始・結果・終了・資源不存在を別々に観測 |

AI AdapterへTask State、Consumer ACK、Recovery Registry、認証Home Lockを追加しない。技術Catalog更新は開始済みTaskの保存選定を書き換えない。

実行量の制限と結果の受理を分離する。Claudeの`--max-turns`はCLI実行上限として維持するが、結果の`num_turns`とは同一単位とみなさず、助言・Task・boolean Probeのいずれも要求上限との比較で拒否しない。報告回数は正の安全整数の観測情報として扱う。CLIが上限到達又は構造化出力再試行失敗を返せば成功にせず、正常終了・成功Envelope・回答Schema等の既存検査を維持する。Codexへ独自のターン上限を追加せず、`turn.completed`一件と失敗イベント不存在は一依頼の終端契約として維持する。既存Timeout・容量制限・取消・回収は変更しない。

`parseProviderResult`のClaude助言Turn metadata不正には任意の`ProviderTurnCountDiagnostic`を付ける。有無は`valueType: missing`等の固定型名で、有限数値は`numberText`の正規化済み数値表記で返す。数値以外の入力本文は返さない。成功Envelopeの型・正の安全整数検査が失敗した場合だけ付加し、成功、別の拒否理由、Codex又はTaskへ診断を流用しない。過去の上限比較による拒否診断は当時の観測として保持し、現行の判定根拠へ流用しない。

## 6. Failureと回復

| 失敗 | AI Adapterの結果 | 次の責務 |
|---|---|---|
| 同梱JSON不正 | Module初期化停止 | Source／配布構成を修正。自動再取得なし |
| 未登録・用途／Effort不対応 | 固定理由付きblocked | 上位が明示設定を確認。別Modelへ自動切替しない |
| 未観測・認証／Quota不成立 | unknown・unavailable又はpreflight_required | 既存Observer／認証Owner。技術対応を現在可用としない |
| 不正出力・非0 | 型付き拒否・変換結果 | 上位がPrimary Failureとcleanup結果を分離 |
| 取消・終了不明 | AI Adapter単独では判定しない | 元Operationの既存取消・回復を維持 |

認証の記述やエラー分類だけから再試行・Docker再起動・回収・Authorityを発行しない。

Claudeの非0終了では、NULなし・UTF-8 64KiB以下の曖昧でない単一`result` JSONだけを解釈する。既存の予算・Turn・構造化再試行上限の三subtypeを優先し、次に既存stderr分類（NULなし・8KiB以下）を維持する。stderrで理由を特定できない場合だけ、`error_during_execution`かつ`is_error: true`の`errors`を既存理由へ変換する。説明は一〜128件の非空文字列、各8KiB以下・NULなし、改行結合後も8KiB以下に限る。不正stdoutは分類材料にせず、既知stderrの判定を妨げない。通常回答・未知subtype・`result`本文・未知fieldはエラー説明として使わない。解析例外はstdoutの解釈不能へ閉じる。本文は呼出し内の短命な値に限り、公開／保存するのは従来のProviderと固定理由だけである。

## 7. Provider差の公開契約と実行境界

### Source構造レビュー後の配置（2026-10-19）

```text
src/
├ index.ts
├ catalog/          types.ts / resolve.ts / validation.ts / model-catalog.json
├ provider/         types.ts / plan.ts / result.ts / task-result.ts / advice-result.ts / error.ts / validation.ts / input.ts / json.ts
├ authentication/   plan.ts / result.ts / policy.ts
├ billing/          policy.ts
├ codex/            plan.ts / result.ts / observation.ts と内部固定Schema
└ claude/           plan.ts / result.ts と内部固定設定
tests/
├ unit/             Source責務に対応する値検査
└ integration/      Catalog読込み・選定Consumer→Provider計画
```

Profile・storage Folder、Host Catalog、既定Profile JSONは持たない。内部JSONは実装と一緒に改訂するデータであり、利用者設定ではない。Provider別の固定Schema／設定の本文とContainer内位置は今回変更しない。

#### Provider配布記述とDocker技術構成の境界

配布取得・BuildのSupply Chain確認と固定ImageはDIの責務。通常実行でのImage同一性と隔離を、AI AdapterのCatalog Identityへ置き換えない。`codexAdviceProviderInitRequired`のOwnerもDIであり、AI AdapterはDocker Desktop／Linuxの差を知らない。

### 7.1. 責務別配置と公開操作

技術Catalogの検索は`catalog/resolve.ts`、検証は`catalog/validation.ts`。Providerの構文・五軸可用性・固定環境は`provider/validation.ts`に同居する。呼出し元Package名やRoleごとに同じ処理を分割しない。

共通計画は`advice / task / probe`とProviderを入力時に照合する。Task内のexecutor／reviewer、助言のTool／Repository非共有、Probe診断を区別する。Claude Model／Effort付加は共通計画内で行い、準備時とEffect直前で同じ生成を使う。

Codex構成診断は`projectCodexExecutionBoundary`がpayload argvだけを受ける。上限256件をdescriptor取得前に確認し、`approve_for_me`優先、exactな`approval_policy="never"`、最初の分離形`--sandbox`を固定分類へ投影する。不正はother／implicitへ閉じ、生引数や実行許可を公開しない。Claudeのnot_applicableと通知相関はCoordinatorが所有する。

### 7.2. 実行・取消・失敗の接続

| 境界 | 維持する条件 |
|---|---|
| 助言 | stdin搬送、Repository／Workspace非共有、Tool・Session永続化・API key fallback禁止 |
| 編集・レビュー | 役割・作業量・選定を固定し、書込み範囲とレビュー判定を混同しない |
| 認証 | Provider固定Origin。login／executionの条件差とforcedLoginMethodの照合を維持。秘密入力は捕捉しない |
| 結果 | Taskと助言で異なる容量・Record条件・拒否順を保持。共通Task Schemaと品質判断は上位 |
| 取消・資源 | 上位が同じOperationのProcess終了・資源回収を確認。変換完了をcleanup完了にしない |

Codexの16KiBとClaudeの0.10はboolean Probe normalizerの固定契約であり、課金やProcess終了の保証ではない。Claudeの起動上限2は返却回数の上限検査に使わない。Codex容量はUTF-8 bytesで16,383／16,384を受理、16,385を拒否する。Claudeの容量へ同じ値を推測適用しない。

### 7.3. QA導出と残る照合

導出キーは安定参照として維持し、旧名から旧処理の残存を推定しない。検証義務の現在Ownerを次表に明示する。旧Profile Storeの成功を新StoreのEvidenceへ流用しない。

## Qualityへの引渡し

| 導出キー | 設計項目種別 | 対象 | 正常条件 | 反証する失敗 | 主な試験段階 | 外部境界の段階 | 観測 | 終了後条件 | 未確認 |
|---|---|---|---|---|---|---|---|---|---|
| `ai-runtime.catalog-validation` | Schema／Validation | AI Adapter技術Catalog | 閉形式・用途・Effortの一意な対応 | 未知field、重複、Getter／Proxy、破損JSON | UT | N/A | RCM-UT-001／002の固定入力と拒否理由 | Hook・Provider Effect 0 | 実Provider対応は別評価 |
| `ai-runtime.profile-resolution` | Interface／Data | 技術選定とCoordinator選定Consumer | 無変換、alias保持、同じIdentity | 未設定・非対応・別用途を補完 | UT／IT | Direct Boundary | RCM-UT-001／RCM-IT-005の選定と搬送結果 | 勝手な再選定・実行0 | 実Provider注入 |
| `ai-runtime.availability` | State／Validation | Provider五軸の値評価 | unknown・preflightを区別 | 未観測をavailableへ丸める | UT | N/A | QA-000010のAIT-UT-005に対応する純粋値と理由 | Authority・Provider Effect 0 | 実Host・認証Observerは上位Ownerで別評価 |
| `ai-runtime.catalog-adoption` | State／Consistency | Coordinator Repository設定Store | 同じSnapshot、CASと認可を保持 | 競合、Link、観測不能、公開後の不明 | IT | Direct Boundary | RCM-IT-005／010の保存・応答・現在認可 | 暗黙再保存0、旧Store Effect 0 | 実設定移行 |
| `ai-runtime.profile-administration` | Interface／Security | Workbench設定とMCP旧Tool拒否 | 管理Roleと選択Repository認可、新公開入口 | 旧Tool受理、無認可保存、応答喪失から再送 | IT／ST | Direct Boundary／System/E2E | RCM-IT-010／RCM-ST-012の全Role・Consumer集合・公開結果 | 旧設定操作Effect 0、所有処理終了 | 実Credential・人間操作 |
| `coord.provider-attempt` | Interface／Validation | 用途別構造化結果 | 唯一のexact結果だけを受理 | 曖昧JSON、不足Envelope、上限逸脱 | UT | N/A | ERB-UT-032の容量・解析値・固定理由 | 生出力非公開、Process起動0 | 実CLI・終了・cleanupは既存IT／ST |
| `coord.provider-selection` | Policy／Data | Subscription限定方針と固定選定搬送 | 設定と実行Authorityを分離 | 有料APIへのfallback、設定単独Authority | UT | N/A | ERB-UT-033の固定方針記述 | Provider・課金・Filesystem Effect 0 | 実認証・実課金の防止は上位実行境界で別評価 |

## 現行実装との照合

技術Catalog・Provider計画・結果・認証記述、新選定搬送とWorkbench／MCP移行を段階接続した。旧Profile本体は撤去し、限定回帰と独立確認を完了した。正式API／CLIは候補実装済みで、固定回帰と独立確認を進めている。実AI・実認証・人間UAT、旧データの実移行、全体QAは別の残件である。実測結果は[CHG計画](../../../99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md)を正本とし、ここへ実行ごとの結果を蓄積しない。

## Implementation Structure

| 観点 | 適用 | 判定理由 | 成立させる構造 | 局所責務・不変条件 | 失敗・変更時の影響 | Qualityへの導出キー |
|---|---|---|---|---|---|---|
| Variation | Required | Codex／Claude二具象がある | 共通計画・解析からProvider具象へ接続 | 仮想Provider Pluginを増やさない | Provider別の計画／解析拒否 | `coord.provider-attempt` |
| Common Contract | Required | 同じ用途・Provider軸で利用する | Provider・用途で絞る型 | Taskと助言の受理条件を混ぜない | 用途差の誤受理 | `ai-runtime.profile-resolution` |
| Creation／Selection | Required | 同梱技術値を一回検証する | 不変Catalogと明示選定 | 役割別設定・保存はCoordinator | 未設定・未対応は拒否 | `ai-runtime.catalog-validation` |
| State-dependent Behavior | Required | 利用可否の値状態を返す | 五軸の純粋判定 | 現在状態Storeを作らない | unknownの成功化を拒否 | `ai-runtime.availability` |
| Composition／Recursion | Required | 共通処理と二具象を合成する | 具象は共通型を参照し実行時循環なし | 再帰Framework不要 | 循環・重複解析を防ぐ | `coord.provider-attempt` |
| Lifecycle Ownership | Required | 同期変換と外部実行の寿命が異なる | 返却で局所変換完了、上位が資源回収 | ACK・Home Lock・Recoveryを持たない | 変換成功をcleanupへ換算しない | `coord.provider-attempt` |
| External Boundary | Required | 同梱JSONと未信頼出力を受ける | 閉形式loaderと用途別解析 | 実Effectは上位Owner | 不正JSON・上限・秘密値を拒否 | `ai-runtime.catalog-validation` |

現在の設計に追加の人間判断はない。実AI・実認証・実Docker・人間確認は別の検証と承認境界へ残し、設計上のPASSと区別する。

### 結果内容の型の正本

編集・レビューの検査済み内容型は`TaskResult`、助言は`AdviceResult`として本Packageが所有する。`TaskResult`は既存の`inspectTaskResultContent`の実返却内容から導出し、Providerの実行観測、清掃状態、レビュー所見の内部搬送本文、次試行の許可を含めない。Executorはこれらを内容型へ拡張せず、実行結果の外側で扱う。内容検査条件・理由文字列・容量制限は変更しない。

公開`parseProviderResult`はtask／advice／probeに応じ、Envelope抽出と内容検査までを一回の呼出しで完了する。入力はtaskの役割・推論強度・作業量、adviceの許可参照を区別する。返却はconfirmed＋型付きnormalizedResult又はblocked＋固定reason＋nullであり、Provider実行観測・Turn観測・レビュー所見は内容の外側へ分離する。Envelopeだけの抽出`extractProviderResult`はRoot非公開とし、その搬送契約を直接検査する他Packageの試験と限定診断は明示した`./testing`（`scripts/ai-adapter-test.ts`）だけを利用する。製品Sourceからこの試験入口を使用しない。Task／Adviceの個別合成処理をExecutorに再定義しない。

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
