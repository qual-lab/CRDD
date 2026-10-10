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

最新の固定8管理操作は基本設計・横断モデルへ限定伝播・契約／品質の独立レビュー済み・残指摘0。前鍵管理契約の限定Passは履歴であり、最新分担のPassへ流用しない。Access Management／Workbench／MCPの3詳細へ最新分担を候補伝播し、限定独立レビュー済み・残指摘0。Quality・Source・具体API／保存・本番接続は未完了。Architecture Ready・QA Handoff・実装／実E2E成立は主張しない。 旧crosは比較資料であり、他ARCHの状態は再評価しない。

| 詳細設計領域 | 対応Architecture定義 | 責務 | 状態 |
|---|---|---|---|
| [access-management](Details/access-management/01_Architecture.md) | ARCH-000013 | 最小ユーザー・Role・資格と交換相関の意味、現在認可、接続／公開範囲。Host交換2操作は同契約下のCLI入口。Domain内容・Transportを所有しない | Candidate／Partial。保存Schema・具体API・表示／受領方式OPEN |
| [ai-adapter](./Details/ai-adapter/01_Architecture.md) | ARCH-000004、ARCH-000010、ARCH-000015 | AI AdapterのCatalog・Profile管理、Provider別計画・出力変換と実行Authorityの分離 | Candidate |
| [artifact-signing](Details/artifact-signing/01_Architecture.md) | ARCH-000014 | 配布物の完全性、鍵Capability、Publisher証明 | Canonical |
| [checker](Details/checker/01_Architecture.md) | ARCH-000001、ARCH-000002 | 決定論的構造検査と契約移行時の機械的集合検査 | Canonical |
| [coordinator](Details/coordinator/01_Architecture.md) | ARCH-000004、ARCH-000008、ARCH-000010、ARCH-000014、ARCH-000015 | 単体・上位利用共通のTask公開API、実行Authority、AI Adapter接続、資源回収、通知と結果搬送 | Candidate |
| [contract-migration](Details/contract-migration/01_Architecture.md) | ARCH-000002 | Canonical Contract変更時の全Consumer・派生物・公開／Release／Recovery経路の閉包 | Canonical |
| [domain-model](./Details/domain-model/01_Architecture.md) | ARCH-000001、ARCH-000002、ARCH-000005、ARCH-000006、ARCH-000008、ARCH-000009、ARCH-000011、ARCH-000013、ARCH-000016 | Domain Modelの用途別公開入口、共通意味、活動CRUD、投影と保存部品。Runtime状態・Git確定・公開は所有しない | Candidate |
| [cros](Details/cros/01_Architecture.md) | ARCH-000005、ARCH-000006、ARCH-000009、ARCH-000010、ARCH-000013、ARCH-000015、ARCH-000016 | 置換前比較資料。認証・認可はAccess Managementへ、Context等は実Ownerへ移管する。旧本文のCoveredを新契約へ流用しない | Legacy比較／置換未完了 |
| [execution-intelligence](Details/execution-intelligence/01_Architecture.md) | ARCH-000007、ARCH-000016、ARCH-000018 | 実行記録のCanonical記録、不変公開、読取りProjectionと時間的出所。書込みと読取りを別責務として接続 | Canonical |
| [mcp-server](./Details/mcp-server/01_Architecture.md) | ARCH-000005、ARCH-000012、ARCH-000013、ARCH-000015 | MCP ServerとしてMachine向け公開Transportを所有し、Orchestrator／Domain Model／CROSの公開契約へ接続する。Shared Host全体や受入判断Authorityは所有しない | Candidate |
| [official-asset-governance](Details/official-asset-governance/01_Architecture.md) | ARCH-000017 | 公式素材の出所、権利、用途、判断、収載状態 | Canonical |
| [platform-access](Details/platform-access/01_Architecture.md) | ARCH-000004、ARCH-000008、ARCH-000011 | OS／Process／Container境界、実在するEffectと資源Lifecycle | Canonical |
| [活動Context（domain-model）](./Details/domain-model/02_Activity_Context.md) | ARCH-000005、ARCH-000006、ARCH-000016 | Domain Modelが実装する活動Contextの意味・状態・正本保存と現在投影。受入判断書込みは所有しない | Candidate |
| [orchestrator](Details/orchestrator/01_Architecture.md) | ARCH-000004、ARCH-000005、ARCH-000007、ARCH-000012 | OrchestratorのProject実行、状態投影、明示受入判断、実行事実読取り、公開APIと通知・取消契約 | Candidate |
| [quality-change-control](Details/quality-change-control/01_Architecture.md) | ARCH-000003 | 固定改訂版に対する変更・監査・試験結果と品質状態の統合 | Canonical |
| [Repository保存（domain-model）](./Details/domain-model/03_Repository_Storage.md) | ARCH-000009、ARCH-000011、ARCH-000013、ARCH-000016 | Repository-local／OS管理領域の配置、保持、Identity、清掃 | Canonical |
| [runtime-trust](Details/runtime-trust/01_Architecture.md) | ARCH-000014 | 準拠、完全性、Publisher、品質と利用者所有Trust Policyの独立評価 | Canonical |
| [semantic-coverage](Details/semantic-coverage/01_Architecture.md) | ARCH-000008 | Architecture上の意味と実装・Quality・Test Symbolの決定論的な接続、Coverage生成およびBundle公開 | Canonical |
| [verification-runner](Details/verification-runner/01_Architecture.md) | ARCH-000003 | Test Catalog、変更影響からの試験選択、段階実行、Authority確認および結果集約 | Canonical |
| [visual-preview](Details/visual-preview/01_Architecture.md) | ARCH-000003 | Repository内Visual成果物のlocalhost限定・読取り専用Preview | Canonical |
| [version-control](Details/version-control/01_Architecture.md) | ARCH-000002、ARCH-000009、ARCH-000014、ARCH-000016 | Repository Root、履歴境界、Binding、完全性入力、差替可能なPort | Canonical |
| [workbench-server](./Details/workbench-server/01_Architecture.md) | ARCH-000005、ARCH-000006、ARCH-000009、ARCH-000010、ARCH-000012、ARCH-000013、ARCH-000015、ARCH-000016、ARCH-000017 | Project運営、Repository作業、AI依頼および接続設定を既存公開契約から表示・操作するLocal Web Surface | Candidate |

## 3. Architecture定義の閉包

| Architecture定義 | 基本設計 | 接続する詳細設計領域 |
|---|---|---|
| ARCH-000001 | [機械検査と文書検査](Definitions/ARCH-000001/architecture_definition.md) | checker、crdd-domain-library |
| ARCH-000002 | [契約移行と利用側閉包](Definitions/ARCH-000002/architecture_definition.md) | contract-migration、checker、version-control、crdd-domain-library |
| ARCH-000003 | [変更・監査・試験・品質の閉包](Definitions/ARCH-000003/architecture_definition.md) | quality-change-control、verification-runner、visual-preview |
| ARCH-000004 | [Project実行](Definitions/ARCH-000004/architecture_definition.md) | orchestrator、coordinator、platform-access、ai-runtime |
| ARCH-000005 | [Project・Portfolio状態投影と受入判断記録](Definitions/ARCH-000005/architecture_definition.md) | orchestrator、project-operation、crdd-domain-library、cros、mcp、workbench |
| ARCH-000006 | [Topic・Meeting Lifecycleと正本への引渡し](Definitions/ARCH-000006/architecture_definition.md) | project-operation、crdd-domain-library、cros、workbench |
| ARCH-000007 | [実行事実と評価候補の取得](Definitions/ARCH-000007/architecture_definition.md) | execution-intelligence、orchestrator |
| ARCH-000008 | [実行境界の診断](Definitions/ARCH-000008/architecture_definition.md) | coordinator、platform-access、crdd-domain-library、semantic-coverage |
| ARCH-000009 | [Repository境界とBinding](Definitions/ARCH-000009/architecture_definition.md) | version-control、runtime-data、cros、crdd-domain-library、workbench |
| ARCH-000010 | [Tool CapabilityとAIモデル構成](Definitions/ARCH-000010/architecture_definition.md) | ai-runtime、coordinator、cros、workbench |
| ARCH-000011 | [Runtime Dataの配置・保持・清掃](Definitions/ARCH-000011/architecture_definition.md) | runtime-data、platform-access、crdd-domain-library |
| ARCH-000012 | [公開Transportの意味同一性](Definitions/ARCH-000012/architecture_definition.md) | mcp、orchestrator、workbench |
| ARCH-000013 | [接続主体・Role権限・資格とRepository Federation](Definitions/ARCH-000013/architecture_definition.md) | access-management（意味Owner、Host交換2操作のCLI契約）、domain-model（認可済みContext集約・中立な共通Root／保存部品）、workbench-server（通常鍵3操作）、mcp-server（全鍵操作非公開の境界）。Candidate／Partialで、新断面Details・具体API／保存は未完了。旧crosは比較資料 |
| ARCH-000014 | [Runtime Artifactの信頼評価](Definitions/ARCH-000014/architecture_definition.md) | runtime-trust、artifact-signing、coordinator、version-control |
| ARCH-000015 | [外部送信・結果帰還・候補採用](Definitions/ARCH-000015/architecture_definition.md) | coordinator、ai-runtime、cros、mcp、workbench |
| ARCH-000016 | [過去情報と現在有効な意図](Definitions/ARCH-000016/architecture_definition.md) | project-operation、crdd-domain-library、execution-intelligence、cros、runtime-data、version-control、workbench |
| ARCH-000017 | [公式素材の権利・用途確認](Definitions/ARCH-000017/architecture_definition.md) | official-asset-governance、workbench |
| ARCH-000018 | [実行事実の記録](Definitions/ARCH-000018/architecture_definition.md) | execution-intelligence |

Architecture定義と詳細設計領域は同じIdentityではない。新しい詳細領域を作る場合は本表と個別領域のRelationを同じ変更で更新し、どのARCH-IDも未接続または暗黙接続にしない。

## 4. Qualityへの引渡し

ARCH-000013では、Access Managementの資格Lifecycleと認可の意味、Domain Modelの認可済みContext集約・中立な保存部品、Workbenchの通常鍵操作、MCPの鍵操作非公開を分けて検証する。Domainの保存部品へ資格の発行／失効判断を移さず、Host CLIを新Serverや新Frameworkにしない。MCPは鍵操作のConsumerではない。固定8分担はARCH-000013を正本とする。管理認可と内容認可、登録／公開／実アクセス、解除／削除を区別し、AM／Workbench／MCPの3詳細本文は候補伝播・限定独立レビュー済み・残指摘0である。配置候補から許可や実装成立を生成しない。

QualityはARCH-IDだけでなく、対応する詳細設計領域のComponent、Interface、Data／State Flow、Failure、Resource、配置および観測方法を入力にする。個別領域の`OPEN`または`FAIL`は未確認範囲として保持し、全体Passへ畳まない。

ARCH-000005では、orchestratorがObjective／Milestone Acceptance Decision Port／Recordを所有し、project-operation、cros、mcpは読取り投影だけを所有する。Qualityは、ProjectionからのAuthority生成、SPEC-000006／SPEC-000007からの判断Port到達、判断記録からのTask作成／Provider Effect、および下位完了からの上位受入推定を反証する。

## 5. Reality Audit境界

`Details/*/01_Architecture.md`だけがCanonicalな詳細設計を所有する。`*_Reality_Audit.md`は、基準版Capability、現行Source、既存試験、過去Architectureまたは物理Directoryとの後段照合であり、ARCH-IDを具体化するCanonical詳細設計ではない。Canonical詳細設計を固定した後、Reality Auditで実装を`Covered`、`Partial`、`Missing`、`Legacy`または`Implementation Detail`へ分類する。
