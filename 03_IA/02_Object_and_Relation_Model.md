# CRDD／CROSの情報オブジェクトと関係

状態: 引き渡し可能（v0.21.0）
担当責任者: Qual-Lab
最終更新日: 2026-09-14

本書は個別IA定義を横断し、利用者が別の対象として見分けるものと、その関係を示す。実装Classや保存表の一覧ではない。

## 1. 中心となる関係

```text
[O: プロジェクト（Project）]
   ├─ --含む--> [O: 節目（Milestone）]
   │                    └─ --含む--> [O: Objective／Task]
   ├─ --構成される--> [O: リポジトリ（Repository）]
   │                              └─ --結合される--> [O: 結合情報（Binding）]
   ├─ --情報源を持つ--> [O: Artifact／Revision]
   └─ --投影される--> [O: 読取り投影（Projection）]
                                  ├─ {state: complete／partial／conflicting／unknown}
                                  └─ --根拠を持つ--> [O: Source／Observed At]

[O: 作業（Task）]
   ├─ --実行される--> [O: 実行主体]
   ├─ --制約される--> [O: 対象範囲／決定権限]
   ├─ --生む--> [O: Result／Candidate]
   └─ --必要とする場合がある--> [O: Decision／Recovery]

[O: 実行基盤]
   ├─ --境界ごとに観測--> [O: 認証／起動／取消／結果取得／回復]
   └─ --状態から判断--> [O: 利用可能能力／利用不能能力／未確認能力]

[O: 現在の仕事]
   └─ --必要な情報を選ぶ--> [O: 判断／仮説／学び]
                                  ├─ --現在有効--> [O: 現在の意図]
                                  ├─ --履歴--> [O: 過去値]
                                  └─ --置換済み--> [O: 置換先]
```

## 2. 横断関係

| 関係 | 意味 | 混同しないもの |
|---|---|---|
| Project―Repository | 一つの論理Projectを一つ以上のRepositoryが支える | Project IDとRepository ID |
| Repository―Binding | 論理Repositoryを検証済みの実在Rootへ結ぶ | 名前・Pathと検証済み結合 |
| Source―Projection | 正本から時点付きの読取り表示を導く | Projectionと正本 |
| Task―Attempt―Result | 同じ依頼と個々の試行・結果を結ぶ | 再接続と新規実行 |
| Effect―Recovery | 外部作用の成立状態と回復義務を結ぶ | 要求発行と作用完了 |
| Meeting―Candidate―Topic | 会話から候補を経て継続論点へ接続する | 会話と採用済み正本 |
| Change―Finding―Evidence | 変更、指摘、是正、確認根拠を同じ改訂版へ結ぶ | Checker合格と全品質合格 |
| Distribution―Trust | 配布物の準拠、完全性、配布者、利用者方針を結ぶ | 公式表示と利用許可 |
| 実行基盤―境界―利用可能能力 | 一部の故障と、その後も続けられる仕事を結ぶ | 一つの境界の故障と実行基盤全体の停止 |
| 過去値―現在の意図―置換先 | 当時の判断と現在有効な情報を結ぶ | 履歴と現在値 |

## 3. 定義への案内

各対象の識別、成立条件、状態、責任、下流義務は[IA定義台帳](01_Information_Architecture.md#3-ia定義台帳)から辿る。本書は定義を置き換えない。

## 4. IA定義への適用

| IA定義 | 処置 | 横断投影での扱い |
|---|---|---|
| [IA-000001](Definitions/IA-000001/ia_definition.md) | 適用 | 「検査対象・条件・指摘」のObject群（検査対象、検査条件、指摘、修正責任）と関係図を横断確認 |
| [IA-000002](Definitions/IA-000002/ia_definition.md) | 適用 | 「目的・節目・Task・受入・判断」のObject群（プロジェクト（Project）、節目（Milestone）、目的（Objective）、作業（Task）ほか）と関係図を横断確認 |
| [IA-000003](Definitions/IA-000003/ia_definition.md) | 適用 | 「実行・失敗・外部作用・回復」のObject群（依頼（Request）、試行（Attempt）、外部作用（Effect）、結果（Result）ほか）と関係図を横断確認 |
| [IA-000004](Definitions/IA-000004/ia_definition.md) | 適用 | 「実行事実・観測・評価」のObject群（実行（Execution）、観測（Observation）、情報源（Source）、評価（Assessment）ほか）と関係図を横断確認 |
| [IA-000005](Definitions/IA-000005/ia_definition.md) | 適用 | 「成立済み能力・契約・利用側・置換根拠」のObject群（利用能力（Capability）、正式契約（Canonical Contract）、利用側（Consumer）、置換先（Replacement）ほか）と関係図を横断確認 |
| [IA-000006](Definitions/IA-000006/ia_definition.md) | 適用 | 「Project・Repository・Binding・読取り投影（Projection）」のObject群（プロジェクト（Project）、リポジトリ（Repository）、結合情報（Binding）、プロジェクト項目ほか）と関係図を横断確認 |
| [IA-000007](Definitions/IA-000007/ia_definition.md) | 適用 | 「手元の情報源と横断情報源」のObject群（手元の情報（Local Context）、手元の作業（Local Work）、リポジトリ横断情報源（Cross-repository Source）、履歴管理能力（Version Control Capability））と関係図を横断確認 |
| [IA-000008](Definitions/IA-000008/ia_definition.md) | 適用 | 「公開受付・通信方式・結果」のObject群（公開依頼（Public Request）、公開契約（Public Contract）、通信手段（Transport）、作用状態（Effect State）ほか）と関係図を横断確認 |
| [IA-000009](Definitions/IA-000009/ia_definition.md) | 適用 | 「接続資格・作業領域・公開範囲」のObject群（接続資格（Connection Credential）、接続中の作業単位（Session）、利用可能領域（Workspace Grant）、作業領域（Workspace）、公開関係（Exposure）、リポジトリ（Repository）、管理能力（System Capability））と関係図を横断確認 |
| [IA-000010](Definitions/IA-000010/ia_definition.md) | 適用 | 「Meeting・Topic・候補・採否」のObject群（会議（Meeting）、会議項目（Meeting Item）、候補（Candidate）、論点（Topic）ほか）と関係図を横断確認 |
| [IA-000011](Definitions/IA-000011/ia_definition.md) | 適用 | 「Tool能力・利用可否・配布根拠」のObject群（利用能力（Capability）、利用可否（Availability）、実行権限（Authority）、配布物（Distribution）ほか）と関係図を横断確認 |
| [IA-000012](Definitions/IA-000012/ia_definition.md) | 適用 | 「実行時データ・保持・清掃」のObject群（実行データの基点（Runtime Root）、実行データ（Data Item）、永続性（Durability）、保持条件（Retention）ほか）と関係図を横断確認 |
| [IA-000013](Definitions/IA-000013/ia_definition.md) | 適用 | 「AIモデル構成・選択・再選定」のObject群（AIモデル（Model）、構成（Configuration）、作業上の役割（Task Role）、利用可否（Availability）ほか）と関係図を横断確認 |
| [IA-000014](Definitions/IA-000014/ia_definition.md) | 適用 | 「受け渡す情報・Task・結果・帰還」のObject群（仕事用情報一式（Context Package）、情報源参照（Source Reference）、選択理由（Selection Reason）、作業（Task）ほか）と関係図を横断確認 |
| [IA-000015](Definitions/IA-000015/ia_definition.md) | 適用 | 「準拠・改ざん有無・配布者・信頼方針」のObject群（準拠（Conformance）、完全性（Integrity）、配布者（Publisher）、信頼方針（Trust Policy）ほか）と関係図を横断確認 |
| [IA-000016](Definitions/IA-000016/ia_definition.md) | 適用 | 「変更・指摘・是正・試験・品質」のObject群（ロードマップ項目（Roadmap Item）、変更（Change）、変更ファイル（Changed File）、改訂版（Revision）ほか）と関係図を横断確認 |
| [IA-000017](Definitions/IA-000017/ia_definition.md) | 適用 | 「外部送信先・目的・分類・同意・候補」のObject群（送信先（Destination）、目的（Purpose）、情報分類（Information Classification）、同意（Consent）ほか）と関係図を横断確認 |
| [IA-000018](Definitions/IA-000018/ia_definition.md) | 適用 | 「物語・構造・図・引き渡す意図」のObject群（物語（Narrative）、構造化した詳細（Structured Detail）、図（Diagram）、図の要素（Diagram Element）ほか）と関係図を横断確認 |
| [IA-000019](Definitions/IA-000019/ia_definition.md) | 適用 | 「公式素材・由来・権利・用途」のObject群（素材（Asset）、由来（Provenance）、権利確認（Rights Statement）、許可用途（Allowed Use）ほか）と関係図を横断確認 |
| [IA-000020](Definitions/IA-000020/ia_definition.md) | 適用 | 「実行基盤の故障箇所と利用可能範囲」のObject群（実行基盤、境界、故障、利用可能能力ほか）と関係図を横断確認 |
| [IA-000021](Definitions/IA-000021/ia_definition.md) | 適用 | 「過去の判断と現在有効な意図」のObject群（推論の背景（Reasoning Context）、過去値（Historical Value）、現在有効な意図（Current Intent）、選択理由（Selection Reason）ほか）と関係図を横断確認 |
| [IA-000022](Definitions/IA-000022/ia_definition.md) | 適用 | 「実行記録の作成・公開状態」のObject群（実行（Execution）、情報源（Source）、観測（Observation）、記録試行（Record Attempt）ほか）と関係図を横断確認 |

### 関係の確認結果

| 確認観点 | 結果 |
|---|---|
| 未処置のIA定義 | なし。22件を上表で一件ずつ処置した。 |
| 孤立Object | 中心関係図へ現れない入力固有Objectも、各定義の「利用場面」で関連する中心Objectと導線へ結ばれている。関係先を持たないObjectを完成扱いしない。 |
| 循環 | 相互参照を処理順序として解釈しない。循環する意味関係がある場合も、起点・判断対象・戻り先を導線文書で別に示す。 |
| 関係の欠落 | Object表だけに存在し関係または利用場面の導線を持たない対象はない。新しい欠落が見つかった場合は個別IA定義を再開する。 |

## 補足分析

なし。個別定義の文章を複製せず、関係と横断パターンだけを投影する。

## Checklist

- [x] 全IA Definitionを一件ずつ処置した
- [x] Object、Identity、Relationを混同していない
- [x] DB、API、Classを情報Objectとして逆輸入していない
- [x] 個別IA Definitionの意味を再定義していない
- [x] 孤立Object、循環、関係の欠落を確認した
- [x] 非該当には理由を記録した
- [x] 補足分析へ必須情報を退避していない
