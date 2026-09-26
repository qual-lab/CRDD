# 10月3日までにv0.22として何を成立させるか

成果物種別: Discovery分析
探索ID: `EXP-000034`
状態: Scope確認済み
主な情報源・根拠: v0.22の目標リリース日、v0.22 Roadmap、Project Context／Topic／Meeting／Workbenchの再Discovery
判断する人: Qual-Lab
記録の性質: v0.22のScopeと日程リスクを決めるための探索
下流の主要CHG: [CHG-000081](../../../99_Roadmap/Changes/CHG-000081/change.md)

> 候補機能を減らすこと自体を目的にしない。利用者が一つの仕事を最後まで行える完成形と、期限内に必要な設計・実装・検証を一致させる。

## 事前入力から理解したこと

v0.22で最初に実現したい価値は、次の順であると理解した。

```text
どのAIでも、同じProjectの現在地を同じ品質で説明できる
        ↓
人間はMarkdownを直接読んでも同じ内容を確認できる
        ↓
MCPとWorkbenchも同じ情報と操作を利用できる
        ↓
複数Repositoryを、正本を中央へ移さず一つのProjectとして読める
        ↓
Front AIが、事実・共有分析・今回の推論を分けて
状況説明と次の一手を提示できる
```

Project Context、Topic／Meetingの共通操作およびWorkbenchは、この価値を実現する入口として要求採用済みである。既存WIPは要求の根拠ではなく、Canonicalな設計が成立した後の比較対象とする。

一方、Roadmapには、Portfolio、CROS Federation、Remote MCP、利用者所有のTrust Policy、Repository Capability Registry、AI Runtime設定および自律Operation実証もv0.22候補として残っている。これらをすべて同じReleaseで閉じるかは、現在の対話ではまだ確認していない。

## 今回解く問題

問題は候補が多いことだけではない。目標日が`2026-10-03`である一方、候補ごとに「このReleaseの利用者成果に不可欠か」「安全に後続へ分離できるか」が整理されていないことである。

Scopeを先に固定しない場合、次が起き得る。

- 一部の機能が動くだけで、Projectの状況理解から次の仕事まで完了できない。
- Remote接続や自律Operationの安全境界を急いで弱める。
- Workbenchの画面だけが増え、共通Application Capabilityが閉じない。
- 日程超過を避けるため、独立レビューまたは実境界検証を省く。
- 既存WIPが存在する機能だけを優先し、本来の問題からScopeが逆算される。

## 利用者成果から見た三つのまとまり

現在の候補は、技術部品ではなく利用者が完了したい仕事で三つに分けられる。

| まとまり | 利用者ができるようになること | 主な候補 | 単独で閉じられるか |
|---|---|---|---|
| Repository内の仕事 | 一つのRepositoryで現在地を理解し、Topic／Meetingを扱い、差分を確認して共有する | Project Context、Topic／Meeting、Local MCP、Workbench、Version Control | 閉じられる。ただし複数Repository価値は未成立 |
| Project横断の仕事 | 同じLogical Projectに属する複数Repositoryを、開示可能な範囲で一つのProjectとして理解する | Federation、Workspace Grant、Repository Exposure、Portfolio、Remote MCP、必要なTrust／Capability解決 | 一体で閉じる必要がある。接続だけ、認証だけ、一覧だけでは完成しない |
| AI利用構成 | 検証済みのAI提供元について、利用可能なモデル、Profile、役割割当およびCLI配置を中核改修なしで更新する | AI Runtime Registry、モデルProfile外部構成 | Project横断利用と一緒に閉じる。未知の実行基盤や任意実行は含めない |
| 実行の自動化 | 許可済みOperationを、人間の逐次指示なしに開始・継続する | 自律Operationの意味契約と参照実証 | 上三つから分離可能。採用する場合はAuthority・停止・回復まで必要 |

## 比較するScope案

| 案 | v0.22で閉じる範囲 | 得られる価値 | 主な短所・Risk |
|---|---|---|---|
| A. Repository内の仕事だけ | Repository内の仕事 | 最初の価値を最短で実証し、WorkbenchのDesign Processへ集中できる | 複数RepositoryとRemote CROSという当初のv0.22到達点を満たさない |
| B. Repository内＋Project横断 | Repository内とProject横断の仕事 | Management／Development等を分けたRepositoryを一つのProjectとして扱う構想まで閉じる | 10月3日までの設計・実装・認証・実境界E2Eが非常に密になる |
| B+. B＋AI利用構成 | BとAI Runtime設定 | Project横断ContextをCodex／Claude等の検証済み構成から使い、モデル更新を中核改修から分離できる | 設定Schema、利用可能性、Trust、失敗表示および移行の検証が追加される |
| C. 自律Operationまで含む | B+と実行の自動化 | 現行v0.22候補を一度に満たす | 日程優先でAuthority・停止・回復の部分成立を完成扱いするRiskが最も高い |

人間理解の確認により、**B+をv0.22のProduct Scopeとし、「実行の自動化」は後続版へ分離すること**を確認した。

理由は、複数RepositoryをRepository境界で分け、CROSが権限内でLogical Projectへ束ね、そのContextを検証済みのCodex／Claude等の構成から利用することが、これまで人間が明示した将来像の中心だからである。一方、自律Operationは、そのContextを読んで人間の依頼へ応答することとは独立して採否・検証できる。

ただし、Bは10月3日までの日程Riskが高い。人間が期限を優先する場合はAへ縮小し、Bを後続Versionへ移す方が完成条件を守りやすい。期限を目標値として維持し、完成条件を優先して日程を見直せる場合はBを維持できる。

## 反証と代替

### 「既存WIPがあるので全部間に合う」

既存WIPはReality Auditの比較対象であり、要求から再導出した設計、共通契約、権限境界および検証が成立する証拠ではない。WIP量だけではC案の成立根拠にならない。

### 「Project Contextだけあれば複数RepositoryもAIが読める」

同じ端末で人間が複数Repositoryを明示して読ませる限定利用は可能である。しかし、Repository Identity、開示境界、競合、不足および利用者ごとの参照範囲を共通に扱うにはFederationが必要になる。

### 「Remote MCPだけ先に公開する」

Network到達性だけを先に作っても、Workspace Grant、Repository Exposure、開示境界、応答喪失後の再取得およびTrustが閉じなければ、安全なProject横断利用にはならない。

## 人間によるScope判断

Qual-Labは、v0.22で次の範囲までを一つの完成形として扱うと判断した。

```text
Repository内の仕事
        +
Project横断の仕事
        +
AI利用構成
        ↓
v0.22の完成範囲
```

したがって、Project Context、Topic／Meeting、Workbench、Version Control、Federation、Workspace Grant、Repository Exposure、Portfolio、Remote MCP、これらの成立に必要なTrust／Capability解決、およびAI Runtime Registry／モデルProfile外部構成をv0.22で扱う。

AI Runtime設定と自律Operationは別々の能力である。AI Runtime設定とは、既存の検証済みAI提供元との接続部について、モデル名、Profile、役割への割当およびCLI配置を中核改修なしで更新する能力であり、v0.22へ含める。未知の実行基盤を設定だけで任意実行する能力ではない。自律Operationは、許可済みの仕事を人間の逐次指示なしに開始・継続する別能力であり、後続へ分離する。

## 現在地と次への引き渡し

採用したB+の範囲は、後続の個別探索と既存要求の再確認によりUXへ引き渡せる状態になった。同一ProjectのRepository Federationと複数Projectの読み取り専用Portfolioは[EXP-000035](../EXP-000035/exploration.md)、Remote CROSの最小認可は[EXP-000036](../EXP-000036/exploration.md)、Capability解決は[EXP-000025](../EXP-000025/exploration.md)、AI Runtime Profileは[EXP-000026](../EXP-000026/exploration.md)が所有する。本格Trust Policy管理はv0.22から外し、既存の信頼要素分離、署名検証およびRemote接続に必要な安全条件だけを維持する。

自律Operationは「不要」とせず、v0.23の再Discovery対象としてRoadmapへ分離した。期限のために完成条件、Authority境界、独立レビューまたは実境界検証を弱める場合、またはB+を一体で閉じられない場合は、本探索へ戻す。

## Checklist

- [x] 情報源と、情報源から確認できる範囲を示した。
- [x] 事前入力からAIが意味を再構成した場合、AIの事前理解、人間の修正および確認後の現在理解を区別した。
- [x] 現在案を変え得る有力な代替または反証を人間と突き合わせるか、該当する案がない理由を示した。
- [x] 人間理解の確認と、要求・方針の採用判断を分けた。
- [x] 人間が抽象的な問題や要求を言語化できることを前提にせず、具体的な出来事、行動、迷い、回避策または比較から問題仮説を引き出した。
- N/A: 発言の少なさ、回答不能または沈黙は観測されず、明示されたScope判断を用いたため — 発言の少なさ、回答不能または沈黙を、同意、問題不存在または要求採用へ読み替えていない。
- [x] 確認できた事実と、そこから導いた解釈・仮説を区別した。
- [x] 解決策ではなく、本質的な問題を説明した。
- [x] 技術名称を除いても、誰が何に困っているか理解できる。
- [x] 影響を受ける人または判断する人を特定した。
- [x] どのような変化を期待するか説明した。
- [x] 原因と解決に関する仮説を、事実として扱っていない。
- [x] 未確認事項と不確実性を明示した。
- [x] 人間による確認または判断が必要かを評価した。
- [x] 情報不足をAIの推測だけで補っていない。
- [x] 失敗、リスク、制約および対象外を評価した。
- [x] 採用、不採用、保留を区別した。
- [x] 次工程が保持すべき問題、変化および条件を示した。
- [x] 情報不足時にDiscoveryへ戻す条件を示した。
- [x] 因果、比較または時系列を図示する必要性を判定し、作成または理由付きN/Aとして処置した。
- N/A: 補足分析を使用していないため — 補足分析へ必須情報を退避していない。
