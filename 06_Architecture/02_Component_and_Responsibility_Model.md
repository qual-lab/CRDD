# Component／責務モデル

Status: Candidate (v0.22 responsibility reorganization)
Owner: Qual-Lab
Last Updated: 2026-10-07

## 1. この成果物が所有すること

18件のArchitecture定義を、共同してシステムを成立させるComponentと責務の関係として統合する。個別契約の詳細は各[Architecture定義](01_Architecture.md#architecture定義台帳)が正本であり、本書はComponent間の関係、状態Owner、所有禁止およびQualityが検証単位を選ぶためのまとまりを所有する。

## 2. 全体ブロック図

```text
                        利用者／Chat Agent／Coding Agent
                                      │
                   ┌──────────────────┼──────────────────┐
                   ▼                  ▼                  ▼
          ┌ 公開入口 ───────┐ ┌ 利用範囲 ──────┐ ┌ 利用能力 ──────┐
          │ MCP／CLI搬送    │ │ Session／      │ │ Tool発見／     │
          │ 意味を変えない  │ │ Workspace解決  │ │ Model構成      │
          └────────┬────────┘ └────────┬───────┘ └────────┬───────┘
                   └──────────────────┼──────────────────┘
                                      ▼
                         ┌ Project Application ──────────┐
                         │ Project実行／判断待ち／取消   │
                         │ Recovery／結果                │
                         └───────────┬───────────────────┘
                                     │
                    ┌────────────────┼─────────────────┐
                    ▼                ▼                 ▼
            ┌ 状態投影 ────┐ ┌ 実行境界 ─────┐ ┌ 運用Context ───┐
            │ Project／    │ │ 実行事実取得  │ │ Meeting候補    │
            │ Portfolio    │ │ 境界診断      │ │ 正本への引渡し │
            └──────┬───────┘ └───────┬────────┘ └───────┬────────┘
                   └─────────────────┼──────────────────┘
                                     ▼
                     ┌ Repository／Runtime基盤 ─────────┐
                     │ Binding／Runtime Data Lifecycle  │
                     └──────────────────────────────────┘

   横断して守る責務
   ├─ Artifact Trust                 ├─ 外部情報Lifecycle
   ├─ 時点と出所                     ├─ 公式素材の権利
   ├─ 契約移行と利用側閉包           ├─ 変更・品質閉包
   └─ 機械検査と文書検査
```

箱は同じ状態Ownerと責務境界を持つ論理Component、矢印は許可された要求または情報の流れを表す。横断責務は上位Controllerではなく、対象Componentが公開した契約と根拠を固有Authorityを増やさず評価する。

## 3. Component責務表

| Component | 含むArchitecture定義 | 状態Owner | 所有すること | 所有しないこと |
|---|---|---|---|---|
| 公開入口 | [公開Transportの意味同一性](Definitions/ARCH-000012/architecture_definition.md) | MCP／CLI Transport Adapter | decode／encode、接続、Application Contractへの搬送 | 業務意味、Provider実行、Authority追加 |
| 利用範囲 | [Workspace利用範囲とRepository Federation](Definitions/ARCH-000013/architecture_definition.md) | CROS Session／Workspace Resolver | Role別Credential Lifecycle、Session Grant、Exposure、Source-aware Federation、Host Access Recovery | User Account・個人別Role割当、Repository内部ACL |
| 利用能力 | [Tool CapabilityとAIモデル構成](Definitions/ARCH-000010/architecture_definition.md) | Capability Registry、Model Configuration Resolver | Tool候補、構成検証、選択理由 | Tool実行、利用可能性の捏造 |
| Project Application | [Project実行](Definitions/ARCH-000004/architecture_definition.md) | Orchestrator | Objective／Task、判断待ち、取消、Recovery、結果 | Provider選定、Transport、OS操作、人間判断 |
| Project状態投影／受入判断記録 | [Project・Portfolio状態投影と受入判断記録](Definitions/ARCH-000005/architecture_definition.md) | Project Management Projection<br>Objective／Milestone Acceptance Decision Record | 投影: 正本を変えない現在状態・比較View<br>判断記録: Project運営者が明示したObjective／Milestoneの受入・差戻し・判断待ちの限定記録 | 投影: 受入判断の記録、その他の正本更新、優先順位の自動決定<br>判断記録: Task作成、Provider Effect、下位完了からの上位受入推定、読取りProjectionからのAuthority生成 |
| 実行観測 | [実行事実と評価候補の取得](Definitions/ARCH-000007/architecture_definition.md)<br>[実行境界の診断](Definitions/ARCH-000008/architecture_definition.md)<br>[実行事実の記録](Definitions/ARCH-000018/architecture_definition.md) | 実行記録Writer／Store、読取りProjection、Platform Access診断Port | Canonical記録、不変公開、欠測を保つ事実取得、境界別診断 | Task更新、Provider実行、修復、評価採用 |
| 運用Context | [Topic・Meeting Lifecycleと正本への引渡し](Definitions/ARCH-000006/architecture_definition.md) | Project Operation Context | Topic／Meeting CRUD、Outcome処置、Action移管、Relation整合、安全な削除 | Meeting本文の意味決定、自動採用、正当な履歴の物理削除 |
| Repository／Runtime基盤 | [Repository境界とBinding](Definitions/ARCH-000009/architecture_definition.md)<br>[Runtime Dataの配置・保持・清掃](Definitions/ARCH-000011/architecture_definition.md) | Binding Resolver、Runtime Data Contract | Root／Identity／Binding、配置・保持・清掃 | Tool選択、任意Path書込み、由来不明残存の削除 |
| Trust | [Runtime Artifactの信頼評価](Definitions/ARCH-000014/architecture_definition.md)<br>[公式素材の権利・用途確認](Definitions/ARCH-000017/architecture_definition.md) | Runtime Trust Evaluator、素材収載判断 | 完全性・Publisher・利用者Policy・権利記録 | 利用者に代わる信頼判断、法的判断自動化 |
| 外部情報 | [外部送信・結果帰還・候補採用](Definitions/ARCH-000015/architecture_definition.md) | External Information Boundary | 送信同意、最小化、相関、候補隔離、採否 | 送信同意からの採用権限生成 |
| 時点と出所 | [過去情報と現在有効な意図](Definitions/ARCH-000016/architecture_definition.md) | Context Provenance Resolver | 出所、時点、対象改訂版、有効性分類 | 履歴からの現在方針採用 |
| 変更・品質 | [契約移行と利用側閉包](Definitions/ARCH-000002/architecture_definition.md)<br>[変更・監査・試験・品質の閉包](Definitions/ARCH-000003/architecture_definition.md) | Consumer Closure契約、Quality Center | 利用側集合、同じ改訂版の是正・Evidence・Gate統合 | 各Consumer処理、リスク受容、Release判断 |
| 検査 | [機械検査と文書検査](Definitions/ARCH-000001/architecture_definition.md) | Checker CoreとCRDD現行Profile | 決定論的検査、意味レビューへの案内 | 意味採否、独立レビュー、工程移行判断 |

## 4. 依存方向

```text
利用者入口
  Workbench Server ／ MCP Server ／ 運用CLI
      │               │
      │ 編成要求      └── 認可済みCROS能力・Domain API
      ▼
  Orchestrator
      │ Coordinator公開APIを直接呼出し
      ▼
  Coordinator ◀── 単体実行の入口
      │ Provider固有契約
      ▼
  AI Adapter

用途を限定して利用する基盤
  Domain Model          意味・CRUD・Root観測・保存・設定
  Version Control       Root／Revision検証・明示Git操作
  Platform Access       OS固有のProcess／Filesystem保証
  Execution Intelligence 実行観測の記録・読取り

禁止: Coordinator → Orchestratorのimport
禁止: Domain CRUD → Git Commit／Pushの自動発行
禁止: 評価・読取り → 業務Authorityの新規発行
```

意味を定義するCoreはAdapter、OS、外部Providerまたは特定Transportを参照しない。Applicationは必要な公開APIを直接呼び出せる。両者を混同して、Applicationの呼出しまで逆向きのPort注入へ変更しない。Adapterは交換契約を実装できるが、Coreの意味契約を再定義しない。

### v0.22で採用する実装Ownerと直接依存

次の表は上記の論理責務を実装Ownerへ割り当てる。18 ARCH-IDの統合・増設や、一つのPackageへの全業務状態の集約を意味しない。Sourceの移管は未実施であり、詳細APIと配置は段階3、実装は段階5で確定・検証する。

| 実装Owner | 担当する論理責務 | 境界・所有禁止 |
|---|---|---|
| `workbench-server` | Browserの表示API、純粋CSR用データ、利用者操作と明示確認 | Browser向けRESTは維持する。独立したCROS REST／Gatewayを所有しない。 |
| `mcp-server` | Machine向け搬送、Repository単体stdio／localhost HTTP、認可された共有CROS操作 | SPEC-000011の入力範囲を無断拡張しない。共有認可はARCH-000013との共同契約である。 |
| `orchestrator` | Objective／Taskの編成、状態、判断記録、候補採用、再入場 | 人間の採否判断を自動生成しない。Provider実行・Docker資源のOwnerではない。 |
| `coordinator` | 単一の実行・Review・取消、Docker資源、候補本体の隔離・読取り・破棄 | 単体利用できる。Orchestratorをimportせず、上位状態・候補採用を所有しない。 |
| `ai-adapter` | Profile解決・管理、Provider別CLI／入力／出力／認証差 | 実行Authority、Docker資源、共通実行履歴Writerを所有しない。 |
| `domain-model` | Artifact／Context／Topic／Meeting／品質変更の意味とCRUD、Repository観測・保存・設定の共通部品 | 業務状態のOwnerは各用途に残す。CRUDからGit Commit／PushやProvider Effectを発行しない。 |
| `execution-intelligence` | 実行記録の保存・読取り・評価候補 | Coordinatorの実行観測とOrchestratorのAttempt観測を区別する。Event内容の不変性を永久保持と解釈しない。 |
| `version-control` | Root／Revisionの検証と明示されたGit操作 | Domainの保存をCommitへ自動変換しない。 |
| `platform-access` | OS固有のProcess・Filesystem・ACL・Protocol保証 | Nodeで成立する共通処理やCoordinatorの業務状態を移管しない。 |

実行の直接依存は `orchestrator → coordinator公開API → ai-adapter` とする。OrchestratorはCoordinatorが定義した通知関数を登録し、Coordinatorが実行事実を通知する。通知は上位状態の更新完了や資源回収完了そのものではなく、各Ownerが確定した結果へ接続する。新しいEvent Bus、DIまたは汎用Port Frameworkは追加しない。

Workbench／MCPは必要な内部Capabilityを利用する。同一ProcessのCROS利用は認可を維持した直接呼出し、別Processは同じHostでもMCPを利用する。Shared Serverは配置形態であり、第三の公開Runtimeではない。CROS REST／Gatewayの既存能力は移管・検証後に撤去し、名前の削除だけを置換完了としない。

## 5. QAへ渡す検証単位

| 検証候補 | 主な対象 | 反証すること | 適する粒度候補 |
|---|---|---|---|
| Component内部契約 | 状態Owner、判定、変換、不変条件 | 隣接責務やAuthorityの混入 | UT／Component |
| Port契約 | Coreと外部実装の交換値 | Canonical値の再解釈、unknownの正常化 | Contract／IT |
| 横断評価 | Trust、Provenance、Closure、Quality | 評価から業務Authorityが生えること | Component／IT |
| Public Application | TransportからOrchestrator | Transportごとの意味差、未接続操作 | IT／ST |
| Repository／Runtime基盤 | Root、Binding、Data Lifecycle | 別Root書込み、残存誤削除 | 実境界IT |

Qualityはこの表を試験ID台帳として使わず、各検証設計で対象ARCH定義、境界、状態および終了条件へ接続する。

## Checklist

- [x] 18 ARCH-IDの意味を維持し、論理責務と実装Ownerを区別した。
- [x] OrchestratorからCoordinatorへの直接依存とCoordinator単体利用を明示した。
- [x] Provider差、実行Authority、業務状態、記録Writerを分離した。
- [x] Browser RESTの維持とCROS REST／Gatewayの撤去目標を区別した。
- [ ] OPEN: 詳細API・全利用側への伝播は段階3、固定設計の独立レビューは段階4で確認する。Source移管・実境界成立は未評価である。
