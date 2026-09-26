# Project Context

Project ID: `qual-lab.crdd`
Repository ID: `OPEN` — 現行Manifestに存在しない
Repository Role: `crdd-standard`

> この文書はREQ-000038の成立可能性を確認したDiscovery上の試験投影であり、現在投影ではない。正式な現在投影は[`PROJECT_CONTEXT.md`](../../../PROJECT_CONTEXT.md)、固定契約は[進捗管理](../../../15_Progress.md#repository-project-context)を参照する。
>
> このRepository Roleが扱う範囲のCurrent Contextだけを示す。表示されていないContextまたはRepositoryの存在・不存在は、この文書から判断しない。

## 1. 今どうなっているか

### 結論

CRDDはv0.21.0を公開済みで、現在はv0.22.0のDiscoveryを進めている。v0.22の目標Release日は2026-10-03だが、候補Scopeと解決案はまだ確定していない。Project Context Projectionの要求と五つの代表場面は確認済みで、最小Formatを試行している。

| 種別 | 項目 | 現在状態 | Owner Relation |
|---|---|---|---|
| 現在事実 | 公開Baseline | v0.21.0 | Git tag `v0.21.0`、Commit `e9947d4f733c3c46b90ee9f78c70898d1920bae9` |
| 現在事実 | v0.22 | Discovery進行中、目標Release日2026-10-03 | [Roadmap](../../../99_Roadmap/01_Roadmap.md#12-v0220--project運営複数repository) |
| 現在事実 | Project Context | 要求採用、最小Format試行中 | [REQ-000038](../../Definitions/REQ-000038/requirement.md)、[最小Format Draft](project_context_contract_draft.md) |
| 現在事実 | Workbench | 解決案未決 | [EXP-000029](exploration.md)、[Roadmap](../../../99_Roadmap/01_Roadmap.md) |
| 現在事実 | 品質 | v0.21設計はReady、全体Quality Readyは未成立 | [Quality Center](../../../07_Quality/01_Quality_Center.md) |

## 2. 何が危ない、または止まっているか

### 結論

現在の主要Riskはv0.22の日程である。Project Context設計では、詳細を集めすぎてOwner Artifactと二重管理になること、および現行ManifestにRepository IDがないことを解消する必要がある。

| 種別 | 結論 | 影響 | 根拠 |
|---|---|---|---|
| 現在事実 | v0.22の初期日程Riskは高い | 2026-10-03までに現Scopeの全工程を閉じられない可能性がある | [Roadmap](../../../99_Roadmap/01_Roadmap.md#12-v0220--project運営複数repository) |
| 現在事実 | v0.21対象のHybrid 12件、Manual 10件は未観測 | 全体Quality Readyを主張できない | [Quality Center](../../../07_Quality/01_Quality_Center.md) |
| 共有分析 | 五場面の詳細をRootへ複製するとProject Contextが第二の正本になり得る | 更新負担とOwner Artifactとの不一致が増える | [REQ-000038](../../Definitions/REQ-000038/requirement.md)、[最小Format Draft](project_context_contract_draft.md) |
| 共有分析 | Repository IDが未定義では、同一Projectの複数RepositoryをIdentityで区別できない | Federationの入力Identityが成立しない | [Repository Manifest](../../../.crdd/config/repository-manifest.json)、[REQ-000038](../../Definitions/REQ-000038/requirement.md) |

共有分析には独自IDを付けない。継続管理が必要になった場合だけ、CHGその他のOwner Artifactへ昇格する。

## 3. 今、人間が決めることは何か

### 結論

現在ただちに必要な新しい採否判断はない。Project Contextの最小Formatを再確認した後に、Format固定、Workbench採否およびv0.22 Scopeについて人間判断が必要になる。

| 判断 | 判断する人 | 選択肢・影響 | Owner Relation |
|---|---|---|---|
| Project Contextの最小Formatを固定するか | Qual-Lab | 人間可読性、機械可読性および第二正本化の有無を確認して採否を決める | [EXP-000029](exploration.md) |
| Workbenchを採用するか | Qual-Lab | AI、静的ViewおよびWorkbench候補の比較後に決める | [EXP-000029](exploration.md)、[Roadmap](../../../99_Roadmap/01_Roadmap.md) |
| v0.22 Scopeを維持・分離・延期するか | Qual-Lab | Discovery結果、期限、依存および検証費用から決める | [Roadmap](../../../99_Roadmap/01_Roadmap.md#12-v0220--project運営複数repository) |

## 4. なぜこの状態・判断になったか

### 結論

Workbenchを先に作るのではなく、どのConsumerでも同じProject理解へ到達できる交換契約を先に成立させると確認したため、Project Context ProjectionのDiscoveryを優先している。

| 現在の結論 | 理由 | Owner Relation |
|---|---|---|
| Project Context Projectionを第一段階とする | AIや媒体ごとの再探索と回答差を先に解消するため | [EXP-000029](exploration.md)、[REQ-000038](../../Definitions/REQ-000038/requirement.md) |
| Workbenchは未採用 | 設計工程や既存WIPだけでは利用価値を証明しないため | [EXP-000029](exploration.md)、[Roadmap](../../../99_Roadmap/01_Roadmap.md) |
| Deadlineは任意だが開始時に確認する | 未設定と確認漏れを区別し、設定済み期限をRisk分析へ使うため | [EXP-000031](../EXP-000031/exploration.md)、[REQ-000037](../../Definitions/REQ-000037/requirement.md) |
| UI／SPEC Detail契約はv0.21成果物へ伝播済み | v0.22固有設計前に既存Canonical Chainを閉じるため | [CHG-000081](../../../99_Roadmap/Changes/CHG-000081/change.md) |

## 5. 次に何をすべきか

### 保存済みの次候補

| 候補 | 理由・成立条件 | Owner Relation |
|---|---|---|
| 最小Formatの過不足を確認する | Identityと五場面だけで人間・AI・MCPが同じ意味を取得できること | [最小Format Draft](project_context_contract_draft.md) |
| Repository IDを後工程へ引き渡す | Project IDとRepository IDの分離をManifestで表現する必要がある | [REQ-000038](../../Definitions/REQ-000038/requirement.md) |
| 同じ入力で入口候補を比較する | Workbench採用を既存WIPではなく利用価値で判断するため | [EXP-000029](exploration.md) |
