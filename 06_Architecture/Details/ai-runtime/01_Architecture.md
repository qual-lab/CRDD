# AI Runtime Profile詳細設計

成果物種別: Architecture詳細設計
詳細設計領域: ai-runtime
状態: Candidate
維持責任者: Qual-Lab

## 基本設計との関係

AI Runtime Profileは、外部AIを選ぶためのAdapter、ModelおよびProfileの構成契約を一か所で検証し、Coordinator、CROS、Workbench等の利用側へ同じ意味で渡す。Provider実行、認証情報、任意実行Path、任意CLI引数および実行Authorityは所有しない。

| Architecture定義 | この領域が具体化する責務 | Relation状態 |
|---|---|---|
| [ARCH-000010](../../Definitions/ARCH-000010/architecture_definition.md) | Profile Catalogの閉じたSchema、決定論的な解決、利用可能性の四軸評価 | Covered |

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
CROS Server設定 ──────┼─→ 設定Adapter ─→ AI Runtime Profile Catalog
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
- AI RuntimeのCatalog検証・解決Coreは検証済みSnapshotを入力にする純粋なDomain境界である。File Adapterは固定Rootへの保存だけを所有し、採用AuthorityまたはProvider Effectを発行しない。
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
| Provider Execution | Coordinator／Provider Adapter | AI Runtimeの責務外 |

永続Snapshotが一件もない正常なOwner Storeは、Schema検証済みの既定Catalogを`revision 0`として返す。これは採用済みFileの代替ではなく、最初の採用で`expectedRevision: 0`を照合し、成功時にだけ`revision 1`を公開するための初期Snapshotである。Coordinatorは同じSnapshotからProfileを解決し、Profile ID、Adapter、Model、ReasoningおよびCatalog RevisionをExecution Planまで変更せず搬送する。DirectoryまたはSnapshotを観測できない場合、Revision列が不連続な場合、Envelope／Schemaが破損している場合は例外で停止し、`revision 0`へ縮退しない。

既定Catalogの設定本文は`40_Develop/ai-runtime/src/default-ai-profile-catalog.json`が所有する。同梱JSONはOwner別の採用済みSnapshotではなく、初期値を定める配布設定である。Catalog Coreは静的JSON importで読み込み、通常のCatalog Validatorで検証した深い不変Snapshotだけを公開する。欠落、JSON構文破損またはSchema不正では初期化を停止し、埋込み旧値や空Catalogへ戻らない。署名RuntimeがCatalog Coreを消費する場合は、このexact JSONも静的依存として内容Identityと配布閉包へ含める。利用者が採用したOwner Snapshotは同梱初期値の変更だけでは上書きしない。

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

## Qualityへの引渡し

| 導出キー | 設計項目種別 | 対象 | 正常条件 | 反証する失敗 | 主な試験段階 | 外部境界の段階 | 観測 | 終了後条件 | 未確認 |
|---|---|---|---|---|---|---|---|---|---|
| `ai-runtime.catalog-validation` | Component／Security | 未信頼Candidate→Catalog Validator | 閉じたSchemaと参照整合を満たす | 秘密値、任意実行入口、未知Propertyの受理 | UT | N/A: Process内純粋検証 | 検証結果、拒否理由 | Provider Effect 0 | なし |
| `ai-runtime.profile-resolution` | Selection／Interface | Catalog→Workbench選択→Coordinator Dispatch Input | 同じSnapshot内で選択Profile IDをAdapter、Model、Reasoningへ一意解決し、Catalog Revisionとともに送信境界までexactに保持する | 曖昧解決、暗黙Fallback、Consumer再解釈、非Coordinator Profileの読取り助言利用 | UT／IT | Direct Boundary | Catalog Revision、Profile ID、Adapter、Model、Reasoning、役割 | Consumer間Profile Identity一致、Provider Effect前の不一致拒否 | 一回限り送信Authorityと実Provider E2E |
| `ai-runtime.availability` | State／Observability | 実行環境観測→Availability Projection | 四軸を保って状態を投影する | unknownをavailableへ畳む | UT／IT | Direct Boundary | 四軸、status、reason | 実行Authority 0 | 実Host Observer |
| `ai-runtime.catalog-adoption` | Lifecycle／Consistency | Owner別Candidate→不変Snapshot | Owner別の不変Snapshotだけを現在値として利用する | Candidate直接実行、競合上書き、Repository／CROS混在 | IT | Direct Boundary | Revision、Snapshot、Owner Root | 競合Effect 0、Provider Effect 0 | なし |
| `ai-runtime.profile-administration` | Application／Authority | Workbench管理操作→Repository／CROS Store | 登録済みAdapter／Modelだけで作成・更新し確認済みProfileだけを削除する | 任意Adapter追加、未確認削除、古いRevision上書き、非管理Credentialへの開示 | UT／IT | Direct Boundary | Command、結果理由、Revision、Snapshot、systemAdmin | 拒否時Catalog Effect 0、Provider Effect 0、非管理開示0 | なし |

## 現行実装との照合

| 対象 | 現在状態 | 分類 | 次の処置 |
|---|---|---|---|
| `40_Develop/ai-runtime` | Catalog Schema、既定Catalog、解決、Availability、Owner別File Adapterを所有 | Covered | Consumer追加時も同じ公開入口を使う |
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
| Composition／Recursion | N/A | Profileは循環・再帰構造を持たず、Adapterへの一段参照で成立する。 | N/A: 閉じた一段参照 | ProfileからProfileを参照しない。 | 階層化要求が生じた場合だけ再評価する。 | `ai-runtime.catalog-validation` |
| Lifecycle Ownership | Required | SnapshotとAvailability観測のOwner・終了条件が異なる。 | Owner別Store＋Consumer局所観測 | StoreがProvider Processを所有しない。 | 耐久方式変更は回復と移行へ波及する。 | `ai-runtime.catalog-adoption`<br>`ai-runtime.availability` |
| External Boundary | Required | Filesystem、Provider Adapter、Coordinator、Workbenchへ接続する。 | 境界別Port／Adapter | 一境界の成功を別境界の実行可能性へ流用しない。 | 新Provider追加時はSchema・Authority・E2Eへ波及する。 | `ai-runtime.catalog-validation`<br>`ai-runtime.profile-resolution` |

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
