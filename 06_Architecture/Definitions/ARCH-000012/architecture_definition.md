# 公開Transportの意味同一性のArchitecture定義

成果物種別: Architecture定義
Architecture ID: `ARCH-000012`
状態: Canonical
維持責任者: Qual-Lab

## 1. 責務と境界

受付前／受付済／Effect前後の失敗／結果ありを入口間で同じ意味に保つ。Transport固有Schemaを公開意味契約として再定義しない。

| 区分 | 内容 |
|---|---|
| 状態Owner | 意味状態は専門Package。CRDD ServerのHTTP・MCPと運用CLIは搬送だけを所有する |
| 所有する責務 | decode／encode、接続Lifecycle、公開Application Contractへの搬送 |
| 所有しない責務 | Orchestratorの意味契約、Authority追加、Provider実行 |
| 主な外部境界 | CLI、MCP stdio、localhost HTTP、Workbench表示API |

SPEC-000011のstdio／localhost HTTPという正式入力を維持する。共有Remote MCPの認可・Exposure・TLS／OriginはARCH-000013との共同成立条件として扱い、localhostの意味を無断でRemote全域へ拡張しない。CRDD ServerのHTTPとMCPは対等な公開入口で、各専門Packageの既存APIを利用する。Workbench UIは配置先ServerのHTTP入口だけへ接続し、NodeのHTTP実装からMCPへの実行時依存は持たない。独立CROS REST／Gatewayの代替を追加せず、HTTPおよびMCPの既存用途と認可境界を保つ。

## 2. UI観点の入力

| UI分析 | 守る利用者向けの約束 |
|---|---|
| [UI-000007](../../Analysis/UI-000007/architecture_analysis.md) | 入口をまたぐ共通依頼・結果 |

## 3. SPEC観点の入力

| SPEC分析 | 守る振る舞い契約 |
|---|---|
| [SPEC-000011](../../Analysis/SPEC-000011/architecture_analysis.md) | 複数入口で同じ依頼・結果契約を保つ |

## 4. 両観点の統合判断

入力ごとのState Owner、Authority、Effect、失敗およびLifecycleを次表で分ける。同じ責務に統合しても、読取り、分類、書込み、外部Effectまたは再接続を相互流用しない。

| 入力 | 観点 | State Owner | Authority | Effect／非該当 | Failure Boundary | Lifecycle |
|---|---|---|---|---|---|---|
| UI-000007 | UI | MCP／CLI Transport Adapter | UI契約はAuthorityを発行しない。利用者操作: 依頼する／結果を受け取る／別入口で続ける。 | UI契約はEffectを定義しない | 通信方式によって入力・権限判断・状態・結果の意味が変わる | 受付前／受付済み／作用前失敗／作用後失敗／結果あり / 入口→同じ公開要求→Runtime→同じ結果 /  |
| SPEC-000011 | SPEC | MCP／CLI Transport Adapter | 呼出し元の既存Authorityだけを搬送する。TransportはAuthorityを追加しない | Transport自体は意味を変更しない。下流Effectは同じApplication契約で制御する。 | Transport固有値を意味契約へ混入せず、未対応入口を成立済みと表示しない。 | [stdio／localhost HTTP入力] -> [同じApplication Request]  -> [同じ状態／結果／失敗分類] |

## 5. 構造と依存方向

```text
[Architecture Responsibility]
├─ UI-000007 (UI)
   受付前／受付済み／作用前失敗／作用後失敗／結果あり / 入口→同じ公開要求→Runtime→同じ結果 / 
└─ SPEC-000011 (SPEC)
   [stdio／localhost HTTP入力] -> [同じApplication Request]  -> [同じ状態／結果／失敗分類]
```

各入力はSibling contractであり、前の入力のAuthority、EffectまたはLifecycleを暗黙に継承しない。UI契約は利用者へ認識・操作・Feedbackを提供するが、AuthorityやEffectを発行しない。

### CRDD Server共通入口の公開契約

HTTPとMCPは同じCRDD機能への別の公開入口とする。共通接続だけをCRDD Serverが所有し、認証・認可と業務規則・保存の正本は既存パッケージに残す。先行接続中の起動方式と公開経路は、既存の[Workbench](../../Details/workbench-server/01_Architecture.md)と[MCP](../../Details/mcp-server/01_Architecture.md)の契約を維持する。

`service/` は通信形式に依存しない機能別の接続を担当する。同じ操作はHTTPとMCPから同じ実装に接続し、機能を両方へ一律に公開することまでは要求しない。HTTP応答の構築と型はServerが持ち、Workbench固有の受信・表示前検査は `workbench-ui` が持つ。

製品のコマンド起動は [`bin/crdd-server.ts`](../../../40_Develop/crdd-server/bin/crdd-server.ts) が受け付ける。パッケージのルートに共通処理を再公開しない。MCP固有の公開入口は [`./mcp`](../../../40_Develop/crdd-server/src/transport/mcp-server.ts) とし、実行系Toolは明示された構成でMCPの同じ受付から利用する。実行Toolの内部処理を直接インポートするための公開入口は設けない。

サーバーのSourceは `src/<責務>/<ファイル>` までとする。[共通操作の入口](../../../40_Develop/crdd-server/src/service/entry.ts) は、両通信方式で使う実行・実行定義・認可済みプロジェクト一覧を既存Ownerへ直接つなぐ。起動組立ては `app.ts`、HTTP受付とWorkbench静的配信は `transport/api-server.ts`、開発用のOpenAPIとSwagger UIは `transport/api-document.ts` が所有する。実行系のHTTPメソッドとPathはExpress登録とOpenAPIで共用し、入力検査は生成しない。MCP固有の認証・搬送・Tool受付も `transport/` に置く。Workbenchが受信する応答の検査からServerの起動や保存処理へ実行依存しない。通信方式に固有の認可・取消・応答は各入口に残す。公開Subpathには物理配置を露出しない。

| 共通の内部操作 | 利用側と結果 |
|---|---|
| `inspectServerPublicOrigin` | 起動時の非秘密な公開Originを検査する。未指定はなし、不正は既存入口ごとの固定拒否。 |
| `readServerConnectionConfiguration` | 起動Repositoryの固定設定ファイルだけを読み取る。明示不存在と境界不正・観測不能を区別する。 |
| `resolveTopicMeetingAccess` | 要求時の許可集合と指定Repositoryから、同じProjectの既存Topic／Meeting操作を構成する。新しい認可を発行せず、操作の構成時に保存しない。 |

共通操作は次の単位で対応させる。画面向けの集約とプロトコル固有の入力形式は入口で扱い、サービス側へ同じ操作を別名で作らない。

| 操作単位 | HTTP受付 | MCP受付 | 共通接続の所有者 |
|---|---|---|---|
| 実行定義 | `GET/POST /api/execution/definition` | 定義取得・管理 | `service/execution.ts` |
| 実行 | 実行状態の取得、Objective起動、判断提出（`/api/execution/` 配下） | 同じ三操作 | `service/execution.ts` |
| 実行アクティビティ | `GET /api/workbench/view` の `executionActivity` | `crdd.get_execution_activity` | `service/execution.ts` とCoordinator |
| Project | 認可済み一覧・個別文脈を含むビュー | Project一覧・文脈取得 | `service/project.ts` とDocument Model |
| Workspace | `POST /api/workspace` | Workspace取得・管理 | `service/workspace.ts` とCoordinator |
| Topic／Meeting | `POST /api/records`（種別と操作を要求で区別） | Topic・Meetingの個別Tool | `service/topic.ts`／`service/meeting.ts` とDocument Model |
| アクセス管理 | `GET/POST /api/access` | 現在権限・非鍵管理 | `service/access.ts` とAM |

HTTPのAI依頼とAI選定はそれぞれ `/api/ai-request`、`/api/ai-selection` でGET／POSTを分ける。鍵提示やGit作業ツリー操作はHTTPの既存用途に残し、MCPには一律に公開しない。フォームとTool引数の検査は各受付に置く。

画面応答の契約識別子は `crdd/workbench/view/v1` とし、Projectの表示データは `projectData`、記録操作の結果は `recordActionResult`、実行の進行と履歴は `executionActivity` を使用する。活動の継続位置は `activityCursor` で指定する。画面ビューは既存どおり未知のクエリー項目を解釈しない。旧カーソル名を送っても継続位置にはならない。改名前の入口やJSON形式に対する互換受付は設けない。保存形式・認可・取消の意味は変更しない。

設定領域の実体観測とHTTP／MCPの内部受付は公開しない。既存MCPランチャーは上記MCP入口に接続する。HTTPの起動・読取り操作は正式な [`./api`](../../../40_Develop/crdd-server/src/app.ts) を使う。Workbenchの表示前検査は [UIの応答検査](../../../40_Develop/workbench-ui/src/client/api/response.ts) が所有し、Serverの `./browser` 公開は設けない。ReactとViteは `workbench-ui` が所有し、Serverは生成済みBundleのみ固定URLで配信する。

配布入口は [crdd-server](../../../template/tools/crdd-server.ts) に一本化する。既定と `--shared` は `./api` の `startCrddServer` から一つの `127.0.0.1` 待受へHTTP API・Workbench・MCPを接続する。生の要求Pathが `/mcp` と一致した場合だけ、MCPの既存Origin・Bearer・公式SDK受付へ流す。単体は既存固定Bearer、共有はAMの現在資格を使う。共有の公開Originは両方未指定または同じHTTPS Originの場合だけ起動する。他のInterfaceを直接bindしない。

`--mcp-stdio` は単体でHTTP APIとWorkbenchを維持し、MCPを標準入出力にだけ接続する。標準出力はProtocol専用で、診断は標準エラーへ送る。stdin EOF・出力故障・終了シグナルでは進行中要求を既存契約に従って止め、同ProcessのHTTP待受も閉じる。共有とstdioは併用しない。各モードの利用手順と引数の一覧は[利用手順](../../../19_Workflows/04_MCP_Server.md)が所有する。

[開発確認](../../../19_Workflows/04_MCP_Server.md#開発確認)では、単体localhost起動で明示した場合だけHTTPのOpenAPIとSwagger UIを公開する。通常・統合起動は既存の公開面を維持し、仕様書は実行・認可の正本にならない。固定Pathと同一Originの資産だけを返し、Swagger UIに操作送信・外部検証・資格保持を許可しない。MCP Inspectorは外部開発クライアントであり、製品の実行依存には含めない。

## 6. データ・状態・Interface

入力が共有するIdentityとDataの関係は、このArchitecture責務が管理する。ただしState Owner、AuthorityおよびEffectは入力単位で分け、責務全体へ一律に拡張しない。

| 入力 | State Owner | Authority | Effect／非該当 |
|---|---|---|---|
| UI-000007 | MCP／CLI Transport Adapter | UI契約はAuthorityを発行しない。利用者操作: 依頼する／結果を受け取る／別入口で続ける。 | UI契約はEffectを定義しない |
| SPEC-000011 | MCP／CLI Transport Adapter | 呼出し元の既存Authorityだけを搬送する。TransportはAuthorityを追加しない | Transport自体は意味を変更しない。下流Effectは同じApplication契約で制御する。 |

公開Interfaceは入力IDと対応する契約を保持し、別入力のAuthority、EffectまたはLifecycleを暗黙に継承しない。

## 7. 失敗・回復・観測

- UI-000007: 通信方式によって入力・権限判断・状態・結果の意味が変わる Effect: UI契約はEffectを定義しない
- SPEC-000011: Transport固有値を意味契約へ混入せず、未対応入口を成立済みと表示しない。 Effect: Transport自体は意味を変更しない。下流Effectは同じApplication契約で制御する。

- 入力が固有Recoveryを定義しない場合、Architectureから追加しない。
- 結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める。

## 8. 品質・保護・運用

| 入力 | 保護する失敗境界 | 検証意図 |
|---|---|---|
| UI-000007 | 通信方式によって入力・権限判断・状態・結果の意味が変わる | 正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。 |
| SPEC-000011 | Transport固有値を意味契約へ混入せず、未対応入口を成立済みと表示しない。 | 正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。 |

共通品質を理由に、入力固有の失敗、非該当Effectまたは終了条件を一つの成功状態へまとめない。

### 未確認事項・人間判断・戻り条件

| 入力 | 継承する未確認事項 | 判断者 | 現在判定 | 再評価契機 |
|---|---|---|---|---|
| UI-000007 | REQ-000006: 開発者が「stdioとHTTPで同じ意味の操作を行う」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000010: プロジェクト運営者／PMが「入口が違っても同じプロジェクト操作を行う」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000028: 開発者が「入口が違っても同じCRDD正本と判断境界を使う」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | 開発者を代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。 |
| SPEC-000011 | REQ-000006: 開発者が「stdioとHTTPで同じ意味の操作を行う」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000010: プロジェクト運営者／PMが「入口が違っても同じプロジェクト操作を行う」を行う際の判断基準、許容負担、利用環境および失敗後の選択／REQ-000028: 開発者が「入口が違っても同じCRDD正本と判断境界を使う」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | 開発者を代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。 |

Architecture固有の追加人間判断はない。これは入力の未確認事項を解消済みとする意味ではない。入力の利用者成果、振る舞い、Authority、Effectまたは失敗境界を変える必要が生じた場合は、その意味を所有するUI／SPEC工程へ戻す。

### 4.1 UI／SPEC Detailの配置制約

Detailは第2・3節のDefinition入力を置き換えず、その意味を実現する配置・操作・状態・観測の具体的制約として扱う。

| Detail Source | Source Definition | SCR／PRT／Interaction／BHV | Relation／N:N | Coverage | 未解決Gap／戻し先 |
|---|---|---|---|---|---|
| [SCR-000007／PRT-000007](../../../04_UI/Details/Areas/operation/SCR-000007/screen.md) | UI-000007 | Screen／Partの配置、情報優先度、操作、FeedbackおよびState | Source UIとの直接Relation | Covered | v0.22固有LayoutはUI Detailへ戻す |
| [BHV-000011](../../../05_SPEC/Details/BHV-000011/behavior.md) | SPEC-000011 | Trigger、Authority、Validation、State、Effect、Result、FailureおよびRecovery | Source SPECとの直接Relation | Covered | Behavior意味の変更はSPEC Detailへ戻す |

担当Interaction Relation: `PRT-000007.spec-000011`

全体の逆引きと詳細設計領域への配置は[UI／SPEC Detail Architecture Traceability](../../08_UI_SPEC_Detail_Traceability.md)を中央統合投影とし、本定義は上記RelationのArchitecture責務を局所所有する。

## 9. 互換性・移行・成立済み能力

| 基準版Capability | 旧Owner／現行照合先 | 新Owner | 保持状態 | Evidence | Gap／移行 |
|---|---|---|---|---|---|
| v0.20.1のMCP stdio／localhost HTTP | MCP stdio／Streamable HTTP Adapter | MCP／CLI Transport Adapter | 保持・拡張 | [mcp:system:stdio](../../../07_Quality/Registry/test-catalog.json)、[mcp:system:streamable-http](../../../07_Quality/Registry/test-catalog.json) | Workbench／Remote MCPは未実装 |

現行設計はこの比較だけに使い、UI／SPECにない望ましい意味を補わない。新規責務は基準版能力や実装Evidenceが存在するように表示しない。

## 10. 実装と検証への引き渡し

- 実装は「decode／encode、接続Lifecycle、公開Application Contractへの搬送」を所有するCoreと、外部境界を扱うPort／Adapterを分ける。
- 接続→decode→Application呼出し→encode→切断／終了観測を段階的な結合試験で確認する。
- Transport別Schema差、stderr混入、切断後の重複実行、閉じた結果fieldの欠落を理由別に反証する。
- Application固有Recoveryは所有しない。再取得可能な参照を意味変更せず搬送する。

## 11. 情報源と現行照合

正式入力は第2・3節のArchitecture分析だけである。次は成立済み能力とGapを照合するためにだけ参照する。

- [現行照合先](../../Details/mcp-server/01_Architecture.md)
- [現行照合先](../../Details/coordinator/03_Task_Architecture.md)

## Checklist

- [x] UI分析とSPEC分析だけを正式入力として統合した
- [x] UI ContractとSPEC Contractを入力別に保持した
- [x] 独立したArchitecture Responsibilityを説明できる
- [x] 所有する責務、所有しない責務およびBoundaryを明示した
- [x] Major Component、Interfaceおよび依存方向を明示した
- [x] Data／State Ownershipを明示した
- [x] Authority、EffectおよびLifecycleを入力別に評価した
- [x] Failure Boundary、Recovery責任および観測を明示した
- [x] Security／TrustとQuality Constraintを評価した
- [x] Human Inputの必要性とOpen／Gapを評価した
- OPEN: 基本責務と検証意図は提示済み。新Ownerの詳細API・利用側対応は段階3で確認する — DetailsへのHandoffを明示した
- [x] Qualityへ渡すVerification Intentを明示した
- [x] 現行Sourceや実装構造から意味を逆輸入していない
- [x] 上流の観測可能な振る舞いをArchitectureで変更していない
