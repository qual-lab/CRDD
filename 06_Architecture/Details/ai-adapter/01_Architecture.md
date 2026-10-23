# AI Adapter詳細設計

成果物種別: Architecture詳細設計
詳細設計領域: ai-adapter
状態: Candidate
維持責任者: Qual-Lab

## 技術カタログとRepository別AI選択の分離方針 — 2026-10-24

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

| 正本 | 担当する責務 |
|---|---|
| [ARCH-000010](../../Definitions/ARCH-000010/architecture_definition.md) | 技術Catalog、明示された技術選定、Provider利用可否の値評価 |
| [ARCH-000004](../../Definitions/ARCH-000004/architecture_definition.md) | Coordinatorから計画・結果変換を利用する境界。業務進行は引き取らない |
| [ARCH-000015](../../Definitions/ARCH-000015/architecture_definition.md) | 助言・編集・レビューのProvider差と共通結果の接続 |

[Workspaceの責務](../coordinator/05_Workspace.md#3-packageの責務と依存方向)に従い、Workspace寿命・Queue・Git採用を所有しない。開発用`.env`の読取り可能性の受容と、Provider認証Home・AM鍵・本番Secretの保護は区別する。Cloud Secret取得・自動注入を追加しない。

## 詳細成果物の適用判断

| 成果物 | 判断と正本節 |
|---|---|
| Component／Interface／Data Flow | 必要。第2・3・7節の技術Catalog→選定Consumer→計画・結果 |
| State／Sequence | 必要。第5節のModule初期化・同期変換と上位の実行寿命の分離 |
| Failure／Recovery／Observability | 必要。第6節とQualityへの引渡し。拒否と未観測を区別 |
| Deployment | 必要。第7節の同梱データとDI所有配置。Host設定Storeなし |
| Security Boundary | 必要。第4節。秘密値・任意実行入口・Authorityの非所有 |
| Implementation Structure | 必要。末尾の適用評価 |

## Engineering Concern評価

| 観点 | 設計上の処置 |
|---|---|
| 同時実行 | 不変Catalogと呼出し局所値だけ。新しい排他なし |
| 時間 | 現在の利用可否は渡された観測時点の評価。技術登録と区別 |
| 資源寿命 | 計画・解析は同期処理。Process・Home・Docker資源を作らない |
| 外部境界 | 同梱JSON loaderと上位から渡すCLI出力。AI Adapter自身はCLIを起動しない |
| 状態整合 | Catalog Identity、明示Model・Effort・用途・識別方式を保持 |
| 失敗・回復 | 固定拒否・unknownを保持。再試行・清掃を自動発行しない |
| 観測 | 型付き結果と固定理由。生出力・Path・秘密値を公開しない |
| セキュリティ | 設定・観測の値を実行Authorityへ昇格しない |

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

WorkbenchはCoordinatorの設定Reader／CAS Writerを使い、AMが共有管理の認可を担当する。MCPは旧Profile四管理Toolを提供しない。AI AdapterはRepository／Host設定の保存・Role判定・管理通信を行わない。Domain ModelのPlain Data検査へ直接依存し、Coordinatorの内部へ逆importしない。

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
| `evaluateProviderAuthentication` | `ProviderAuthenticationResult`。確認済み・未認証・確認不能 |
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

## 6. Failureと回復

| 失敗 | AI Adapterの結果 | 次の責務 |
|---|---|---|
| 同梱JSON不正 | Module初期化停止 | Source／配布構成を修正。自動再取得なし |
| 未登録・用途／Effort不対応 | 固定理由付きblocked | 上位が明示設定を確認。別Modelへ自動切替しない |
| 未観測・認証／Quota不成立 | unknown・unavailable又はpreflight_required | 既存Observer／認証Owner。技術対応を現在可用としない |
| 不正出力・非0 | 型付き拒否・変換結果 | 上位がPrimary Failureとcleanup結果を分離 |
| 取消・終了不明 | AI Adapter単独では判定しない | 元Operationの既存取消・回復を維持 |

認証の記述やエラー分類だけから再試行・Docker再起動・回収・Authorityを発行しない。

## 7. Provider差の公開契約と実行境界

### Source構造レビュー後の配置（2026-10-19）

```text
src/
├ index.ts
├ catalog/          types.ts / resolve.ts / validation.ts / model-catalog.json
├ provider/         types.ts / plan.ts / result.ts / error.ts / validation.ts / json.ts
├ authentication/   plan.ts / result.ts / policy.ts
├ billing/          policy.ts
├ codex/            plan.ts / result.ts と内部固定Schema
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

Codexの16KiBとClaudeの2 turns／0.10はboolean Probe normalizerの固定契約であり、課金やProcess終了の保証ではない。Codex容量はUTF-8 bytesで16,383／16,384を受理、16,385を拒否する。Claudeの容量へ同じ値を推測適用しない。

### 7.3. QA導出と残る照合

導出キーは安定参照として維持し、旧名から旧処理の残存を推定しない。検証義務の現在Ownerを次表に明示する。旧Profile Storeの成功を新StoreのEvidenceへ流用しない。

## Qualityへの引渡し

| 導出キー | 現在の対象・正常条件 | 反証と観測・終了後条件 |
|---|---|---|
| `ai-runtime.catalog-validation` | AI Adapterの技術Catalog閉形式 | 未知field・重複・Getter／Proxy拒否、hook 0、Provider Effect 0。RCM-UT-001/002 |
| `ai-runtime.profile-resolution` | 技術選定とCoordinatorの役割・分類・明示指定 | 無変換・alias保持・同じIdentity、未設定／非対応拒否。RCM-UT-001／RCM-IT-005 |
| `ai-runtime.availability` | Provider五軸と上位の現在観測 | unknownとpreflightを成功へ畳まない。AIT-UT-005。実Hostは別評価 |
| `ai-runtime.catalog-adoption` | CoordinatorのRepository設定Storeへ移管 | CAS競合、Link・観測不能、公開後故障と再送0。RCM-IT-005/010の現Owner試験 |
| `ai-runtime.profile-administration` | Workbenchの選択Repository設定、MCP旧Tool拒否 | 現在管理Roleとdevelopment認可、応答不明・fresh GET・取消、旧Store Effect 0。RCM-IT-010/ST-012 |
| `coord.provider-attempt` | 用途別構造化結果 | 曖昧JSON・不足Envelope・上限逸脱拒否、生出力非公開。ERB-UT-032。実CLI・終了・cleanupはIT/ST |
| `coord.provider-selection` | Subscription限定の方針と固定選定搬送 | 設定単独Authority・有料API fallback拒否。ERB-UT-033／PRL-UT-006 |

## 現行実装との照合

技術Catalog・Provider計画・結果・認証記述、新選定搬送とWorkbench／MCP移行を段階接続した。旧Profile本体撤去は現在の変更単位であり、Source／試験／登録／現行文書の回帰と独立レビュー後に固定する。正式API／CLI全体、実AI・実認証・人間UAT、旧データの実移行、全体QAは別の残件である。実測結果は[CHG計画](../../../99_Roadmap/Changes/CHG-000082/coordinator-interface-redesign-plan.md)を正本とし、ここへ実行ごとの結果を蓄積しない。

## Implementation Structure

| 観点 | 判断 |
|---|---|
| Variation | Codex／Claude二具象を共通計画・解析へ接続。仮想ProviderのPlugin機構なし |
| Common Contract | Provider・用途で型を絞る。Taskと助言の受理条件は混ぜない |
| Creation／Selection | 不変技術Catalogを一回検証。役割別選択・保存はCoordinator |
| State-dependent Behavior | 値の状態を返すだけ。現在状態Storeなし |
| Composition／Recursion | 共通→具象の実行時依存。具象は共通型のみ参照し実行時循環なし |
| Lifecycle Ownership | 同期変換と外部実行・回復を分離 |
| External Boundary | JSON loader・未信頼CLI出力を閉形式へ固定し、実効果は上位へ残す |

## Checklist

- 必要な構成・境界・寿命・失敗・観測・実装構造を現在Ownerへ接続した。
- 移管前のCapabilityと試験はCHGの対応表へ接続し、未評価を完成へ畳まない。
- 新Framework・互換Store・排他・監視・回復機構を追加しない。
- Source整理の成功、実境界確認、正式QAとRelease判断を分離する。
