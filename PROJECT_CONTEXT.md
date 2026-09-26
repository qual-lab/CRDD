# Project Context

Project ID: `qual-lab.crdd`
Repository ID: `qual-lab.crdd-standard`（v0.22で暫定採用）
Repository Role: `crdd-standard`

> この文書は、このRepository Roleが扱う範囲の現在投影である。
> 表示されていないContextまたはRepositoryの存在・不存在は、この文書から判断しない。

## 1. 今どうなっているか

### 結論

CRDDはv0.21.0を公開済みで、v0.22.0のDiscoveryを進めている。v0.22.0の目標Release日は2026-10-03である。Project Contextは五つの代表場面を共通形式で回答する要求を採用し、試験した最小形式をRepository共通入口へ昇格している。

| 種別 | 項目 | 現在状態 | Owner Relation |
|---|---|---|---|
| 現在事実 | 公開Baseline | v0.21.0 | Git tag `v0.21.0`、Commit `e9947d4f733c3c46b90ee9f78c70898d1920bae9` |
| 現在事実 | v0.22.0 | Discovery進行中、目標Release日2026-10-03 | [Roadmap](99_Roadmap/01_Roadmap.md) |
| 現在事実 | Project Context | Repository投影、Manifest v2 Identity照合およびMarkdown／Codex確認が成立。MCP以降の入口比較は未完了 | [REQ-000038](01_Discovery/Definitions/REQ-000038/requirement.md)、[入口比較](01_Discovery/Analysis/EXP-000029/consumer_comparison.md) |
| 現在事実 | 情報入口 | Project ContextをOverviewとし、Topic、Meeting、Roadmap、Quality、DocumentationおよびRuntime Stateを各Ownerから読む能力地図を整理済み | [能力地図](01_Discovery/Analysis/EXP-000029/capability_map.md) |
| 現在事実 | Topic／Meeting操作 | 登録・編集・削除・一覧・取得を要求採用。Relationを持つ誤登録も、影響表示と人間確認後に対象だけを削除する | [REQ-000039](01_Discovery/Definitions/REQ-000039/requirement.md) |
| 現在事実 | Workbench | MCPで扱うProject情報、Attention等の横断投影、およびTree／Diff／Stage／Commit／通常Pushを一つの入口で扱う要求を採用。具体的な画面は未決 | [REQ-000040](01_Discovery/Definitions/REQ-000040/requirement.md)、[能力地図](01_Discovery/Analysis/EXP-000029/capability_map.md) |
| 現在事実 | 品質 | v0.21設計はReady、全体Quality Readyは未成立 | [Quality Center](07_Quality/01_Quality_Center.md) |

## 2. 何が危ない、または止まっているか

### 結論

現在の主要Riskはv0.22.0の日程である。Project ContextではOwner Artifactとの二重管理を避ける必要がある。Manifest v2と公式Repositoryの自己適用には暫定Repository IDを設定したが、正式固定はv0.22の契約固定時に再評価する。

| 種別 | 結論 | 影響 | 根拠 |
|---|---|---|---|
| 現在事実 | v0.22.0の初期日程Riskは高い | 2026-10-03までに現Scopeの全工程を閉じられない可能性がある | [Roadmap](99_Roadmap/01_Roadmap.md) |
| 現在事実 | v0.21対象のHybrid 12件、Manual 10件は未観測 | 全体Quality Readyを主張できない | [Quality Center](07_Quality/01_Quality_Center.md) |
| 共有分析 | 五場面の詳細をRootへ複製すると第二の正本になり得る | 更新負担とOwner Artifactとの不一致が増える | [REQ-000038](01_Discovery/Definitions/REQ-000038/requirement.md)、[進捗契約](15_Progress.md#repository-project-context) |
| 現在事実 | Repository IDは`qual-lab.crdd-standard`を暫定採用 | Manifest v2の自己適用とFederation入力を試せる。正式固定前の変更は移行対象になる | [Manifest v2 Example](template/.crdd/config/repository-manifest.example.json)、[REQ-000038](01_Discovery/Definitions/REQ-000038/requirement.md) |

共有分析には独自IDを付けない。継続管理が必要になった場合だけ、CHGその他のOwner Artifactへ昇格する。

## 3. 今、人間が決めることは何か

### 結論

現在のDiscovery整理を閉じるために必要な人間判断はない。v0.22.0のScopeとWorkbench要求は確認済みである。Repository IDの正式固定とVisual Directionは、各契約の固定時に改めて人間が判断する。

| 判断 | 判断する人 | 選択肢・影響 | Owner Relation |
|---|---|---|---|
| なし（確認済み） | Qual-Lab | v0.22はRepository内＋Project横断＋AI利用構成を扱い、Workbench要求も採用済み。Discovery整理を閉じて次工程へ進める | [Scope探索](01_Discovery/Analysis/EXP-000034/exploration.md)、[REQ-000040](01_Discovery/Definitions/REQ-000040/requirement.md) |
| CRDD標準RepositoryのRepository IDを正式固定するか | Qual-Lab | 現在判断ではない。v0.22では`qual-lab.crdd-standard`を暫定採用し、Project Context契約固定時に維持または変更を判断する | [REQ-000038](01_Discovery/Definitions/REQ-000038/requirement.md)、[Runtime Data Architecture](06_Architecture/Details/runtime-data/01_Architecture.md#5-configとrepository-identity) |
| WorkbenchのVisual Directionをどれにするか | Qual-Lab | 現在判断ではない。Screen InventoryとHero候補を作った後、複数案から採用・組合せ・再探索を判断する | [UI／SPEC Detail探索](01_Discovery/Analysis/EXP-000030/exploration.md) |

## 4. なぜこの状態・判断になったか

### 結論

Workbenchを先に作るのではなく、どのConsumerでも同じProject理解へ到達できる交換契約を先に成立させると確認したため、Project Context Projectionを優先している。

| 現在の結論 | 理由 | Owner Relation |
|---|---|---|
| Project Context Projectionを第一段階とする | AIや媒体ごとの再探索と回答差を先に解消するため | [EXP-000029](01_Discovery/Analysis/EXP-000029/exploration.md)、[REQ-000038](01_Discovery/Definitions/REQ-000038/requirement.md) |
| Workbench要求を採用し、具体画面は未決とする | Project Contextだけでは日常操作とVersion Controlを一つの仕事として扱えない一方、既存WIPから画面を逆算してはならないため | [EXP-000029](01_Discovery/Analysis/EXP-000029/exploration.md)、[REQ-000040](01_Discovery/Definitions/REQ-000040/requirement.md) |
| Deadlineは任意だが開始時に確認する | 未設定と確認漏れを区別し、設定済み期限をRisk分析へ使うため | [EXP-000031](01_Discovery/Analysis/EXP-000031/exploration.md)、[REQ-000037](01_Discovery/Definitions/REQ-000037/requirement.md) |
| UI／SPEC Detail契約はv0.21成果物へ伝播済み | v0.22固有設計前に既存Canonical Chainを閉じるため | [CHG-000081](99_Roadmap/Changes/CHG-000081/change.md) |

## 5. 次に何をすべきか

### 保存済みの次候補

| 候補 | 理由・成立条件 | Owner Relation |
|---|---|---|
| REQ-000037〜041をUX以降へ全数伝播する | 任意期限、Project Context、Topic／Meeting、WorkbenchおよびRemote CROSの利用者成果を設計へ渡すため | [Discovery台帳](01_Discovery/01_Product_Discovery.md) |
| 同じProject ContextをMCPから読める最小境界を評価する | Markdown直接確認だけでなく、構造化Consumerでも意味を変えず取得できることを確認するため | [入口比較](01_Discovery/Analysis/EXP-000029/consumer_comparison.md)、[MCP Architecture](06_Architecture/Details/mcp/01_Architecture.md) |
| Topic／Meetingの共通操作を具体化する | 単一RepositoryとDEV／MGMT分離の両方で、Owner Repositoryを越えず同じ契約を使えるようにするため | [REQ-000039](01_Discovery/Definitions/REQ-000039/requirement.md) |
| WorkbenchのScreen InventoryとHero候補を作る | 採用済み要求を、既存WIPに拘束されずUI／SPEC Detailへ具体化するため | [REQ-000040](01_Discovery/Definitions/REQ-000040/requirement.md)、[EXP-000030](01_Discovery/Analysis/EXP-000030/exploration.md) |
| 次工程Gateでv0.22.0の日程Riskを再評価する | Scopeは確認済みだが、2026-10-03までの残作業と検証費用は工程進行に合わせて更新する必要があるため | [Roadmap](99_Roadmap/01_Roadmap.md)、[REQ-000037](01_Discovery/Definitions/REQ-000037/requirement.md) |

## Checklist

- [x] Project ID、Repository IDおよびRepository Roleを評価した。
- [x] 三つのIdentityがRepository Manifestと一致している。
- [x] 五場面を省略せず、結論を先に示した。
- [x] 現在事実と共有分析を区別した。
- [x] 正本が存在する内容をOwner Relationへ接続した。
- [x] Project Context固有の安定IDを追加していない。
- [x] 項目単位の閲覧権限、観測時刻およびLive運用状態を追加していない。
- [x] 確認済みの該当なし、不明およびOPENを空欄へ畳んでいない。
- [x] Owner Artifactとの競合時はProject Contextを現在値として使わない。
- [x] 保存済みの次候補と対話時の追加提案を区別できる。
- [x] Gateを閉じる前に再投影要否を評価する。
