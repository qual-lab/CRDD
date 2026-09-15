# Component／責務モデル

Status: Candidate (v0.21.0)
Owner: Qual-Lab
Last Updated: 2026-09-15

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
| 利用範囲 | [Workspace利用範囲とRepository Federation](Definitions/ARCH-000013/architecture_definition.md) | CROS Session／Workspace Resolver | CredentialからSession Grant、Exposure、Source-aware Federation | User Role階層、Repository内部ACL |
| 利用能力 | [Tool CapabilityとAIモデル構成](Definitions/ARCH-000010/architecture_definition.md) | Capability Registry、Model Configuration Resolver | Tool候補、構成検証、選択理由 | Tool実行、利用可能性の捏造 |
| Project Application | [Project実行](Definitions/ARCH-000004/architecture_definition.md) | Project Runtime | Objective／Task、判断待ち、取消、Recovery、結果 | Provider選定、Transport、OS操作、人間判断 |
| 状態投影 | [Project・Portfolio状態投影](Definitions/ARCH-000005/architecture_definition.md) | Project Management Projection | 正本を変えない現在状態・比較View | 正本更新、優先順位の自動決定 |
| 実行観測 | [実行事実と評価候補の取得](Definitions/ARCH-000007/architecture_definition.md)<br>[実行境界の診断](Definitions/ARCH-000008/architecture_definition.md)<br>[実行事実の記録](Definitions/ARCH-000018/architecture_definition.md) | 実行記録Writer／Store、読取りProjection、Platform Access診断Port | Canonical記録、不変公開、欠測を保つ事実取得、境界別診断 | Task更新、Provider実行、修復、評価採用 |
| 運用Context | [Meeting候補と正本への引渡し](Definitions/ARCH-000006/architecture_definition.md) | Project Operation Context | 候補作成、出所、採否Lifecycle | Meeting本文の意味決定、自動採用 |
| Repository／Runtime基盤 | [Repository境界とBinding](Definitions/ARCH-000009/architecture_definition.md)<br>[Runtime Dataの配置・保持・清掃](Definitions/ARCH-000011/architecture_definition.md) | Binding Resolver、Runtime Data Contract | Root／Identity／Binding、配置・保持・清掃 | Tool選択、任意Path書込み、由来不明残存の削除 |
| Trust | [Runtime Artifactの信頼評価](Definitions/ARCH-000014/architecture_definition.md)<br>[公式素材の権利・用途確認](Definitions/ARCH-000017/architecture_definition.md) | Runtime Trust Evaluator、素材収載判断 | 完全性・Publisher・利用者Policy・権利記録 | 利用者に代わる信頼判断、法的判断自動化 |
| 外部情報 | [外部送信・結果帰還・候補採用](Definitions/ARCH-000015/architecture_definition.md) | External Information Boundary | 送信同意、最小化、相関、候補隔離、採否 | 送信同意からの採用権限生成 |
| 時点と出所 | [過去情報と現在有効な意図](Definitions/ARCH-000016/architecture_definition.md) | Context Provenance Resolver | 出所、時点、対象改訂版、有効性分類 | 履歴からの現在方針採用 |
| 変更・品質 | [契約移行と利用側閉包](Definitions/ARCH-000002/architecture_definition.md)<br>[変更・監査・試験・品質の閉包](Definitions/ARCH-000003/architecture_definition.md) | Consumer Closure契約、Quality Center | 利用側集合、同じ改訂版の是正・Evidence・Gate統合 | 各Consumer処理、リスク受容、Release判断 |
| 検査 | [機械検査と文書検査](Definitions/ARCH-000001/architecture_definition.md) | Checker CoreとCRDD現行Profile | 決定論的検査、意味レビューへの案内 | 意味採否、独立レビュー、工程移行判断 |

## 4. 依存方向

```text
Transport Adapter ────────┐
Workspace Resolver ───────┼──> Public Application Contract
Capability Resolver ──────┘                │
                                           ▼
                                     Project Runtime
                                           │
                 ┌─────────────────────────┼────────────────────────┐
                 ▼                         ▼                        ▼
          Read Projection             Execution Port         Context Promotion Port
                 │                         │                        │
                 └─────────────────────────┼────────────────────────┘
                                           ▼
                              Repository／Runtime Ports

横断評価Component <── 公開された状態・根拠・Identity
横断評価Component ──X──> 業務Authorityの新規発行
```

CoreはAdapter、OS、外部Providerまたは特定Transportを参照しない。AdapterはPortを実装できるが、Coreの意味契約を再定義しない。

## 5. QAへ渡す検証単位

| 検証候補 | 主な対象 | 反証すること | 適する粒度候補 |
|---|---|---|---|
| Component内部契約 | 状態Owner、判定、変換、不変条件 | 隣接責務やAuthorityの混入 | UT／Component |
| Port契約 | Coreと外部実装の交換値 | Canonical値の再解釈、unknownの正常化 | Contract／IT |
| 横断評価 | Trust、Provenance、Closure、Quality | 評価から業務Authorityが生えること | Component／IT |
| Public Application | TransportからProject Runtime | Transportごとの意味差、未接続操作 | IT／ST |
| Repository／Runtime基盤 | Root、Binding、Data Lifecycle | 別Root書込み、残存誤削除 | 実境界IT |

Qualityはこの表を試験ID台帳として使わず、各検証設計で対象ARCH定義、境界、状態および終了条件へ接続する。
