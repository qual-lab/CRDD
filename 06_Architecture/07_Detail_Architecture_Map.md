# Architecture詳細設計の対応表

成果物種別: Architecture詳細設計の統合投影
状態: Canonical
維持責任者: Qual-Lab

## 1. 目的

本書はArchitecture定義（基本設計）と詳細設計領域の多対多Relationを示す。個別領域の設計を再定義せず、全Architecture定義が実装可能な詳細へ接続されているか、どの領域をQualityが読むかを一覧化する。

```text
UI／SPEC
   ↓
Analysis
   ↓
Definitions／ARCH-ID（基本設計）
   ↓ 多対多Relation
Details／設計領域（詳細設計）
   ↓
Quality／Development
```

## 2. 詳細設計領域

| 詳細設計領域 | 対応Architecture定義 | 責務 | 状態 |
|---|---|---|---|
| [artifact-signing](Details/artifact-signing/01_Architecture.md) | ARCH-000014 | 配布物の完全性、鍵Capability、Publisher証明 | Canonical |
| [checker](Details/checker/01_Architecture.md) | ARCH-000001、ARCH-000002 | 決定論的構造検査と契約移行時の機械的集合検査 | Canonical |
| [coordinator](Details/coordinator/01_Architecture.md) | ARCH-000004、ARCH-000008、ARCH-000010、ARCH-000014、ARCH-000015 | 実行編成、Provider境界、モデル選定、信頼済み実行、外部情報搬送 | Canonical |
| [contract-migration](Details/contract-migration/01_Architecture.md) | ARCH-000002 | Canonical Contract変更時の全Consumer・派生物・公開／Release／Recovery経路の閉包 | Canonical |
| [crdd-domain-library](Details/crdd-domain-library/01_Architecture.md) | ARCH-000001、ARCH-000002、ARCH-000008、ARCH-000009 | Checker固有処理、CRDD共通Domain、Repository／Version Control基盤の責務境界と公開入口 | Candidate |
| [cros](Details/cros/01_Architecture.md) | ARCH-000005、ARCH-000006、ARCH-000009、ARCH-000010、ARCH-000013、ARCH-000015、ARCH-000016 | 複数Repositoryの利用範囲、読取り専用Context投影、候補搬送、時間的出所。受入判断書込みは所有しない | Canonical |
| [execution-intelligence](Details/execution-intelligence/01_Architecture.md) | ARCH-000007、ARCH-000016、ARCH-000018 | 実行記録のCanonical記録、不変公開、読取りProjectionと時間的出所。書込みと読取りを別責務として接続 | Canonical |
| [mcp](Details/mcp/01_Architecture.md) | ARCH-000005、ARCH-000012、ARCH-000013、ARCH-000015 | 公開Transport、Project読取り投影、Workspace範囲、外部情報境界。受入判断Authorityを生成しない | Canonical |
| [official-asset-governance](Details/official-asset-governance/01_Architecture.md) | ARCH-000017 | 公式素材の出所、権利、用途、判断、収載状態 | Canonical |
| [platform-access](Details/platform-access/01_Architecture.md) | ARCH-000004、ARCH-000008、ARCH-000011 | OS／Process／Container境界、実在するEffectと資源Lifecycle | Canonical |
| [project-operation](Details/project-operation/01_Architecture.md) | ARCH-000005、ARCH-000006、ARCH-000016 | Project運営情報、Meeting候補、現在と履歴の読取り投影。受入判断書込みは所有しない | Canonical |
| [project-runtime](Details/project-runtime/01_Architecture.md) | ARCH-000004、ARCH-000005、ARCH-000007、ARCH-000012 | Project実行、状態投影、Objective／Milestone Acceptance Decision Port／Record、実行事実読取り、公開Application Contract | Canonical |
| [quality-change-control](Details/quality-change-control/01_Architecture.md) | ARCH-000003 | 固定改訂版に対する変更・監査・試験結果と品質状態の統合 | Canonical |
| [runtime-data](Details/runtime-data/01_Architecture.md) | ARCH-000009、ARCH-000011、ARCH-000013、ARCH-000016 | Repository-local／OS管理領域の配置、保持、Identity、清掃 | Canonical |
| [runtime-trust](Details/runtime-trust/01_Architecture.md) | ARCH-000014 | 準拠、完全性、Publisher、品質と利用者所有Trust Policyの独立評価 | Canonical |
| [semantic-coverage](Details/semantic-coverage/01_Architecture.md) | ARCH-000008 | Architecture上の意味と実装・Quality・Test Symbolの決定論的な接続、Coverage生成およびBundle公開 | Canonical |
| [verification-runner](Details/verification-runner/01_Architecture.md) | ARCH-000003 | Test Catalog、変更影響からの試験選択、段階実行、Authority確認および結果集約 | Canonical |
| [version-control](Details/version-control/01_Architecture.md) | ARCH-000002、ARCH-000009、ARCH-000014、ARCH-000016 | Repository Root、履歴境界、Binding、完全性入力、差替可能なPort | Canonical |

## 3. Architecture定義の閉包

| Architecture定義 | 基本設計 | 接続する詳細設計領域 |
|---|---|---|
| ARCH-000001 | [機械検査と文書検査](Definitions/ARCH-000001/architecture_definition.md) | checker、crdd-domain-library |
| ARCH-000002 | [契約移行と利用側閉包](Definitions/ARCH-000002/architecture_definition.md) | contract-migration、checker、version-control、crdd-domain-library |
| ARCH-000003 | [変更・監査・試験・品質の閉包](Definitions/ARCH-000003/architecture_definition.md) | quality-change-control、verification-runner |
| ARCH-000004 | [Project実行](Definitions/ARCH-000004/architecture_definition.md) | project-runtime、coordinator、platform-access |
| ARCH-000005 | [Project・Portfolio状態投影と受入判断記録](Definitions/ARCH-000005/architecture_definition.md) | project-runtime、project-operation、cros、mcp |
| ARCH-000006 | [Meeting候補と正本への引渡し](Definitions/ARCH-000006/architecture_definition.md) | project-operation、cros |
| ARCH-000007 | [実行事実と評価候補の取得](Definitions/ARCH-000007/architecture_definition.md) | execution-intelligence、project-runtime |
| ARCH-000008 | [実行境界の診断](Definitions/ARCH-000008/architecture_definition.md) | coordinator、platform-access、crdd-domain-library、semantic-coverage |
| ARCH-000009 | [Repository境界とBinding](Definitions/ARCH-000009/architecture_definition.md) | version-control、runtime-data、cros、crdd-domain-library |
| ARCH-000010 | [Tool CapabilityとAIモデル構成](Definitions/ARCH-000010/architecture_definition.md) | coordinator、cros |
| ARCH-000011 | [Runtime Dataの配置・保持・清掃](Definitions/ARCH-000011/architecture_definition.md) | runtime-data、platform-access |
| ARCH-000012 | [公開Transportの意味同一性](Definitions/ARCH-000012/architecture_definition.md) | mcp、project-runtime |
| ARCH-000013 | [Workspace利用範囲とRepository Federation](Definitions/ARCH-000013/architecture_definition.md) | cros、mcp、runtime-data |
| ARCH-000014 | [Runtime Artifactの信頼評価](Definitions/ARCH-000014/architecture_definition.md) | runtime-trust、artifact-signing、coordinator、version-control |
| ARCH-000015 | [外部送信・結果帰還・候補採用](Definitions/ARCH-000015/architecture_definition.md) | coordinator、cros、mcp |
| ARCH-000016 | [過去情報と現在有効な意図](Definitions/ARCH-000016/architecture_definition.md) | project-operation、execution-intelligence、cros、runtime-data、version-control |
| ARCH-000017 | [公式素材の権利・用途確認](Definitions/ARCH-000017/architecture_definition.md) | official-asset-governance |
| ARCH-000018 | [実行事実の記録](Definitions/ARCH-000018/architecture_definition.md) | execution-intelligence |

Architecture定義と詳細設計領域は同じIdentityではない。新しい詳細領域を作る場合は本表と個別領域のRelationを同じ変更で更新し、どのARCH-IDも未接続または暗黙接続にしない。

## 4. Qualityへの引渡し

QualityはARCH-IDだけでなく、対応する詳細設計領域のComponent、Interface、Data／State Flow、Failure、Resource、配置および観測方法を入力にする。個別領域の`OPEN`または`FAIL`は未確認範囲として保持し、全体Passへ畳まない。

ARCH-000005では、project-runtimeがObjective／Milestone Acceptance Decision Port／Recordを所有し、project-operation、cros、mcpは読取り投影だけを所有する。Qualityは、ProjectionからのAuthority生成、SPEC-000006／SPEC-000007からの判断Port到達、判断記録からのTask作成／Provider Effect、および下位完了からの上位受入推定を反証する。

## 5. Reality Audit境界

`Details/*/01_Architecture.md`だけがCanonicalな詳細設計を所有する。`*_Reality_Audit.md`は、基準版Capability、現行Source、既存試験、過去Architectureまたは物理Directoryとの後段照合であり、ARCH-IDを具体化するCanonical詳細設計ではない。Canonical詳細設計を固定した後、Reality Auditで実装を`Covered`、`Partial`、`Missing`、`Legacy`または`Implementation Detail`へ分類する。
