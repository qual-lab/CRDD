# 境界／Interfaceモデル

Workspace新方式の情報境界は[DI共通隔離方針](Details/docker-isolation/01_Architecture.md#workspace-isolation-policy)へ接続する。開発用`.env`の読取りリスクを受容し、本番Secretは通常開発環境へ置かない。Direct／Candidateで同じ安全原則を使うが、用途別RW・Git／内部状態書込み禁止・認証保護・外部送信同意を維持する。全秘密fileの隠蔽や独自Secret管理は要求しない。

Workspace再編では[対象と権限の契約](Details/coordinator/05_Workspace.md#2-方式識別所有境界)を適用する。RepositoryとWorkspaceを相関し、既存の内容領域workspaceId(s)はcontentAreaId(s)へ意味を維持して改名する。閲覧許可をWorkspace操作許可へ転用しない。Workbench／MCPは専門APIへ直接接続する対等な入口で、通常AI実行はCoordinator内Task／Objectiveへ搬送する。具体API・保存Schemaは未決であり、既存通信の変更は未実施。

Status: Candidate (v0.22 responsibility reorganization)
Owner: Qual-Lab
Last Updated: 2026-10-11

旧固定版の履歴: 固定8管理分担、登録解除・通常鍵3分岐の前回限定レビューは履歴として保持する。今回は承認済み初回Host設定をARCH-000013とAccess Management詳細から横断モデル・Workbench／MCP詳細へ候補伝播する。今回の固定12文書は契約・品質の限定独立再レビュー済み・全重大度の残指摘0で、前回Passを流用していない。Quality・Source・具体API／物理保存・本番接続は未完了。Architecture Ready・QA Handoff・実装／実E2E成立は主張しない。

現在の鍵提示は用途限定・短命な同一Process backend→Workbench応答またはHost端末に限定する。一般MCP／DTO・一覧・履歴・Log・Evidenceへ秘密を公開しない。初回限定接続は通常AuthorityやMCP鍵Toolの例外ではない。今回境界差分は限定再レビュー済み（最小鍵提示方式の伝播差分、全重大度0）。

旧Coordinator独立Trust Evaluatorは2026-10-23の人間承認で廃止した。上流の独立評価・公式識別の意味と安定IDは維持するが、代替の本番評価器はなく、当該実装関係は未接続である。通常実行のGateへ追加せず、旧専用試験を現版の成立根拠へ流用しない。

## 1. この成果物が所有すること

Component間、外部System、Platform、Repository、Trust境界と、境界を越えるIdentity、State、Authority、Dataの意味を統合する。物理API名やfieldは実装・Schemaが所有し、本書は交換契約と越えてはならない意味境界を所有する。

## 2. 境界表

| 境界 | 呼出し側 | 受け側 | 越えるもの | 越えないもの | 不明時 |
|---|---|---|---|---|---|
| Public Transport | Human／Agent／Client | Public Application Contract | 検証済み入力、相関Identity、構造化結果 | Transport固有のAuthority、内部Path | Effect前に拒否 |
| 接続認可・Repository公開範囲 | 接続主体／認証Context | Access Management | Credentialに結合したuserId、現行Role詳細権限、Repository Exposure、実アクセス | Credentialに固定した旧権限、未許可Repositoryの名前・存在・件数・内容 | 観測不能を許可や不存在へ丸めない |
| 認可済みContext集約 | Access Managementで許可された要求 | Domain Model | 認可済みRepository集合、Source、Coverage | Credential／Grantの解釈、管理権限からの内容閲覧 | 不完全性を保持し未許可Sourceを補完しない |
| ユーザー・Role内容・Repository登録・公開範囲管理 | ARCH-000013の9 Role分担行で許可された現行Role | Access Management | 操作別の予定Role／対象ID／前後Role／対象Role／登録・公開状態と明示変更 | 内容自動付与、固定分担の設定委譲、一般IAM、個別追加権限、許可外情報 | 対象・現在管理認可・必要状態不明は新Effect前停止 |
| 新規資格発行 | 同一Process Workbenchの現行administrator | Access Management | 既存対象userId、固定の鍵操作権限、発行結果 | 旧資格失効、Roleによる鍵権限ON／OFF、Host／MCPからの操作、交換Recoveryの生成 | 発行の既知結果と観測不能を分ける |
| 独立失効 | 同一Process Workbenchの現行administrator | Access Management | 対象資格Identityと既存userIdへの結合、固定の鍵操作権限、失効結果 | 対象以外の資格失効、新発行・Secret・交換再入場、Host／MCPからの操作 | 失効の既知結果と観測不能を分ける |
| 鍵交換 | 同一Process Workbenchの現行administrator、またはHostのログイン済みローカル操作者 | Access Management | 指定ユーザー／全員の2操作、対象／既存発行先、旧失効前に結合した同じRecovery参照 | Role初期化、認可破損修復、秘密再表示、Task取消の保証、MCP公開 | 処置前停止と失効後の部分結果を分離 |
| Project Execution | Application Contract | Coordinator内Task／Objective | Objective、Task操作、Human Input、取消 | Provider選択、OS操作 | 同じTaskを保持して停止 |
| Project Projection | 許可されたProject Source | Project Management Projection Port | Source、Currentness、Coverage、状態 | 正本変更Authority、受入判断Authority | unknown／partialのまま返す |
| Acceptance Decision | Project運営者の明示判断 | Objective／Milestone Acceptance Decision Port | 対象Identity、受入／差戻し／判断待ち | Task作成、Provider Effect、下位完了からの上位受入推定 | Effect 0で判断待ちを保持 |
| Execution Port | Coordinator内Task／Objective | Coordinator内Execution Adapter | exact Task、Capability、取消要求、結果 | Project状態の所有権 | Effect不明ならRecovery |
| Repository Binding | Runtime／Tool | Version Control Port | 開始Path、検証済みRoot、Repository Identity | commit必須性、別Root Authority | Effect 0 |
| Runtime Data | 各Runtime Component | Runtime Data Contract | Owner、用途、耐久性、Retention、Cleanup条件 | 任意Path、由来不明削除 | 保持して人間判断 |
| External Information | 内部候補 | 外部Provider／外部結果 | 許可済み最小情報、Request Identity、未信頼結果 | Secret、採用Authority | 送信0／候補隔離 |
| Platform | Port | OS／Process／Container／Filesystem | 必要Capability、要求、観測、終了結果 | handle取得だけの成功主張 | unknownで停止 |
| Trust／Rights | Artifact／素材候補 | Evaluator／決定権限者 | 出所、Hash、Publisher、用途、確認 | 利用者判断の自動代替 | 未承認 |

## 3. 型とPortの関係

```text
┌─ Transport Input ──────────────────────┐
│ encoded request / connection context   │
└──────────────────┬─────────────────────┘
                   │ decode・検証
                   ▼
┌─ Public Application Contract ──────────┐
│ Objective / Command / Query             │
│ Result / Stop Reason / Recovery Ref     │
└──────────────────┬─────────────────────┘
                   │ 意味を保持
                   ▼
┌─ Coordinator内Task／Objective ───────────────────────────────┐
│ Project／Task状態・判断待ち・上位再入場・限定受入判断記録     │
└───────┬─────────────────────────────┬────────────────────────┘
        │ 同Package内Execution呼出し          │ 上位状態の保存／照会
        ▼                            ▼
  Coordinator内Execution           Domain API／Store
  実行・Review・取消・資源終了      各Ownerの意味を維持
        │                            ▲
        │ Provider固有契約           │ 明示判断だけを記録
        ▼                            │
  AI Adapter                      Project運営者

Executionが定義する通知関数をTask／Objectiveが登録する。
下位の通知から上位判断・状態確定・cleanup成立を推定しない。
```

`implements`は交換契約の実装候補を示すが、Adapter名や既存FolderをCanonical Componentの根拠にしない。図は現行の責務境界を示し、実装Ownerは単一Coordinatorである。Task／Objectiveが同PackageのExecutionを直接呼び出し、Executionが定義する通知関数を登録する。ExecutionからTask／Objectiveへの逆依存や、上位が所有するPort型を下位へ注入するFrameworkは追加しない。

### 公開SurfaceとCROS境界

| 経路 | 境界を受け持つOwner | 維持する条件 |
|---|---|---|
| Browser → Workbench Server | Workbench表示API | Browser向けREST、認証・入力検証、Process限定操作確認を維持する。 |
| Workbench Server → 同一ProcessのCROS | Access Managementの認可とDomain Modelの認可済み集約 | Transportを省略してもCredential失効・現行Role詳細権限・Exposure・実アクセスを要求ごとに確認する。通常の鍵発行・独立失効・交換はこの入口の現行administratorだけが利用する固定操作。 |
| Workbench Server → 別ProcessのCROS | MCP Server | 同一Hostでも別ProcessならMCP経路とする。ただし鍵操作は一覧・Schema・登録・dispatchのすべてに置かない。独立CROS REST／Gatewayは撤去する。 |
| AI／Machine → MCP Server | MCP搬送とAccess Managementの認可 | MCPはAI専用ではない。Repository単体stdio／localhost HTTPの契約と共有CROS認可契約を区別する。Domainは認可済み集合だけを受ける。Secret有無を問わず鍵操作の一覧・Schema・登録・dispatchは公開しない。 |
| Host対話CLI → 鍵交換 | Access Management | ログイン済みローカル操作者を信頼し、交換2操作だけを呼ぶ。追加認証・専用資格・承認コード・OS管理者昇格なし。既存Root／Path検証を維持し、通常発行・独立失効は提供しない。 |
| Repository単体利用 | 検証済みRepository Rootと各能力 | CROS設定・Credentialを機械的に要求しない。Rootが不明ならEffect前に停止する。 |

共有配置はWorkbench／MCPと内部Capabilityの配置形態であり、新しい公開Serverや自動Repository Deployを追加しない。Remote境界で認可・現在状態が不明な場合は操作を停止し、未許可Sourceの存在・Identityを開示しない。撤去対象が現在提供する操作・認可・終了保証を新経路へ対応付けるまで、置換済みと表示しない。

### 管理と鍵交換の公開境界

固定管理認可は現行RoleとARCH-000013の9 Role分担行から判定し、Role内容設定から派生させない。manager／administratorはユーザー登録・表示名変更、developer／managerのRole変更・内容設定、Repository登録・登録解除・Exposureを管理する。administratorの付与・解除・降格・詳細権限と鍵操作はadministrator専用。managerはadministratorの表示名だけ変更可。manager自身も変更前の現在管理認可→明示的なRole内容設定／Exposure更新→次要求の現行Role・Exposure・実アクセス再評価の順に処置する。更新受理≠内容取得、管理≠内容自動付与、登録≠公開、登録解除≠Repository／Product Data削除を維持する。通常の鍵3操作は同一Process Workbenchだけが呼び、RoleのON／OFF設定を設けない。通常Host回復の対話CLIはログイン済みローカル操作者を信頼して同じ交換2操作だけを呼ぶ。初回Host設定は別の明示開始契約とする。既存Root／Path検証を維持し、追加認証や通常発行・独立失効を設けない。

交換の全4組（2操作×2入口）で対象ID・表示名・失効範囲・発行先・保持情報を事前表示し、Host入口または全員交換の3組だけ明示確認する。通常入口の指定ユーザー交換へ追加確認を要求しない。対象不明・必要な既存administrator不存在・認可破損・必要状態の安全な観測不能では新Effect前に停止する。Hostを第三の回復操作や特別ユーザーとして扱わない。

自身の認証済み表示は許可し、非認証のユーザー情報と現在他ユーザー参照を許可されていない主体への他ユーザー一覧・存在・件数は返さない。参照許可と固定の鍵操作権限は別であり、管理能力だけでRepository内容閲覧を許可しない。生Secretは発行／交換後に一度返す経路だけに置き、ログ・保存・Evidence・会話へ複製しない。MCPは独立失効を含む全鍵操作を公開しない。Workbench／Host CLIの入口分担は採用済みであり、具体API・画面・提示方式・初回限定接続確認方式は詳細設計とSource接続待ちである。

| 結果境界 | 搬送先でも保持する条件 |
|---|---|
| 登録解除 | 同じ受理済み操作・採用改訂の登録と対応Exposureの両読戻しを完了条件とする。対象外・Repository本体を保持し、開始済み取消を証明しない |
| 発行または記録不明 | Credential IDとは別の非秘密な元発行Identityと既知事実で元処理を再観測。通常発行に交換Recoveryなし、交換由来だけ元exact。新交換を開始しない |
| 発行・記録確定後の提示・引渡し（初回は同鍵接続確認）未確認 | 「発行済み・受け渡し未確認」とし、現在administratorによる明示的な別Operation／Recoveryの交換へ接続。各交換内部のexact相関は維持する |
| 現在administrator非接続 | 既存Host交換2操作だけへ案内し、MCP鍵処置や一般認可の迂回を追加しない |

秘密の保存・再表示・自動再発行および遅延旧応答による失効鍵の利用可能表示を禁止する。

### 初回Host設定の境界

| 境界 | 入力・許可条件 | 結果・禁止事項 |
|---|---|---|
| Host対話入口 → Access Management | 検証済み既存管理Root、管理状態と進行記録の双方未初期化確認、管理用表示名、ログイン済み操作者の明示開始 | 最初のadministrator UUIDユーザーと同userIdの鍵。相関を耐久確定・読戻しする前にUUID／鍵Effectを発行しない |
| Access Management → Host | 非秘密の試行・作成・発行・記録・Host提示・初回限定接続確認の個別事実、一度だけのSecret配送 | 初回試行参照をCredential／交換Recovery／Lock回復へ読み替えない。Secretをログへ保存・再表示しない |
| Workbench → 利用者 | 許可された確認済み情報の状態説明、Host操作の案内 | 初期化を実行しない。未観測を未初期化へ畳まない |
| MCP → 外部Client | 初期化の一覧・Schema・登録・dispatch・状態照会を全て非公開 | 未認証Clientへユーザー存在・試行Identityを漏らさない。認証済みでも初期化Toolを追加しない |

[管理状態・内部操作候補](Details/access-management/02_Management_State_and_API.md)を参照する。ここから新しい公開API・CLI引数・Root・認証機構は生成しない。

## 4. 主要なブロック間シーケンス

### Task受付から完了または回復まで

```text
利用者        Transport       Coordinator Task／Objective   Coordinator Execution   Runtime Data
  │               │                 │                    │                  │
  │ Objective     │                 │                    │                  │
  ├──────────────>│ decode/validate │                    │                  │
  │               ├────────────────>│ Taskを受付         │                  │
  │               │                 ├── intent保存 ────────────────────────>│
  │               │                 ├─ exact Task ──────>│                  │
  │               │                 │                    ├─ 実行Effect       │
  │               │                 │                    ├─ 結果/unknown ───>│
  │               │                 │<──── 結果／停止理由／Recovery ────────┤
  │               │<────────────────┤ 状態を確定         │                  │
  │<──────────────┤ 構造化結果      │                    │                  │
```

### 外部送信と候補採用

```text
内部候補  →  同意範囲確認  →  最小化送信  →  外部結果
   │              │                              │
   │              └ invalid / unknown → Effect 0 │
   │                                             ▼
   └──────── 元Request Identity照合 ← 未信頼候補として帰還
                                  │
                     exact ───────┴────── missing / ambiguous
                       │                          │
                  人間の採否                   隔離
```

## 5. Schema責務

| 情報 | Canonical Owner | Writer | Reader | 所有禁止 |
|---|---|---|---|---|
| Project／Task状態 | Coordinator内Task／Objective | Coordinator内Task／Objective | Projection、Transport | Adapterによる状態生成 |
| Objective／Milestone受入判断 | Objective／Milestone Acceptance Decision Record | Acceptance Decision Port | Coordinator内Task／Objective、Projection | Projectionからの書込み、Task作成、Provider Effect、下位完了からの推定 |
| Public Result | Public Application Contract | Coordinator内Task／Objectiveの結果変換 | Transport、Client | Transport固有意味の追加 |
| ユーザー・Role内容・Repository登録・Exposure | Access Management | 9 Role分担行で現在許可された主体 | 現在管理認可／内容認可を別判定 | 鍵操作による変更、登録からの公開、管理からの内容取得、解除によるProduct Data削除、固定分担の設定委譲 |
| 資格Lifecycle | Access Management | 同一Process Workbenchの固定administratorによる通常鍵3操作、Hostの交換2操作だけ | 現在認可 | Credentialの旧権限固定、鍵交換によるuserId・表示名・Role・詳細権限・Repository登録・Product Dataの変更 |
| 要求毎の認可済みRepository集合 | Access Managementの認可Query | 非該当（現在状態から要求毎に解決） | Domain Model | 永続Grant化、旧権限固定、DomainによるCredential／Grant解釈と権限再生成 |
| 新規資格発行・独立失効の結果 | Access Management | 固定administratorの操作 | 許可されたWorkbench結果表示 | 新規発行による旧資格失効、独立失効による新発行・Secret・交換再入場の生成 |
| 鍵交換の非秘密状態 | Access Management | 旧失効前から同じexact Recoveryへ結合した交換Operation | 現在状態と入口ごとの現在Authorityを再確認した再入場、許可された結果表示 | Secret保存、記録からのAuthority復元、発行不明の成功化、MCP鍵操作公開 |
| Repository Binding | Binding Resolver | 検証済みVersion Control Port | Runtime、Tool | Path文字列からの再構成 |
| Runtime Data Metadata | Runtime Data Contract | 各Ownerの限定Writer | Recovery、Cleanup | Tool固有Top-levelの無秩序追加 |
| 実行事実読取りProjection | 既存の実行事実Source | 現在責務の外側 | 実行記録読取りProjection | Projectionによる事実生成・保存、既存事実の再解釈 |
| External Candidate | External Information Boundary | Result Receiver | Human Decision、所有正本Adapter | 送信同意からの自動採用 |
| Trust Evaluation | 旧Runtime Trust Evaluator（廃止・代替未接続） | 旧Evaluator（歴史比較） | 現行の独立評価Consumerは未接続。通常Runtime Gateへ追加しない | Qual-Lab署名だけの一括信頼 |
| Quality State | Quality Center | 各検証結果の統合 | Release判断、Human | 単一試験からの全体Pass |

## 6. Qualityへの引渡し

- 登録解除の片側残存・観測不能から完了を生成しないこと、両除去完了から開始済み取消を推定しないことを反証する。
- 元発行IdentityとCredential ID、元処理の再観測と明示した別交換を境界越しにも区別し、現在認可なしの通常交換・秘密再表示・失効鍵の遅延表示を反証する。

交換の旧失効・新発行・結果記録・提示結果（本人受領は観測外）は別の観測事実とする。後続の提示・引渡し未確認だけで確定済み発行結果を不明へ戻さず、確定していない結果を成功・rollbackへ丸めない。新規発行と独立失効へ交換Recoveryを付けない。物理Schemaや新Storeは本モデルで決定しない。

- 各境界で発行、受理、Effect、完了、観測、耐久確定を別々に反証する。
- CanonicalなPath、Identity、StateをConsumerが再解釈しないことを確認する。
- 外部境界は最小Probeだけでなく、入力から終了後状態までのLifecycleを段階的に結合確認する。
- Transport parityは同じApplication Contractへ同じ意味が届くことを確認し、同じ文字列だけを比較しない。
- restricted、unknown、not_observed、blockedを成功や不存在へ畳まない。
- 現行Role変更・失効が後続要求へ反映され、三可視境界と管理／内容閲覧の分離がすべての入口で維持されることを確認する。
- 固定administrator以外の通常鍵操作、通常Host回復の新規発行／独立失効、MCPの鍵操作一覧・Schema・登録・dispatchを拒否し、追加Host認証を要求しないことを確認する。
- 新規発行の旧失効0、独立失効の新発行・Secret・交換再入場0、交換の旧失効前exact Recovery結合を別々に観測する。
- 発行対象userIdと独立失効対象資格を区別し、資格取り違え・同じユーザーの別資格までの失効範囲拡大・鍵交換による保持情報変更を反証する。
- 鍵交換2操作×2入口の事前表示・3組だけの明示確認、処置前停止、失効後不明の同じRecovery搬送、記録・提示結果（本人受領は観測外）の事実分離を確認する。
- Project Management Projectionから受入判断の書込みAuthorityが生じず、SPEC-000006／SPEC-000007がAcceptance Decision Portへ到達できないことを確認する。
- Acceptance Decision PortはSPEC-000002の明示判断だけを記録し、Task作成・Provider Effect・下位完了からの上位受入推定を行わないことを確認する。

## Checklist

- [x] 交換値、Authority、状態Ownerと実装の直接依存を区別した。
- [x] 同一Processの内部呼出しと別ProcessのMCP境界でも認可を維持した。
- [x] SPEC-000011のstdio／localhost HTTPを共有Remote契約へ読み替えていない。
- [x] Browser向けRESTと廃止するCROS REST／Gatewayを区別した。
- [x] 9 Role分担行と内容認可、Host交換2操作・MCP鍵非公開を分けた。
- [ ] OPEN: 各公開操作・Callback・取消・終了後条件の詳細対応は段階3、固定設計の独立レビューは段階4で確認する。
