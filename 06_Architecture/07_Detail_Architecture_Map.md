# Architecture詳細設計の対応表

成果物種別: Architecture詳細設計の統合投影
状態: Candidate（ARCH-000013初回Host設定の伝播断面）
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

旧固定版の履歴: 固定8管理分担、登録解除・通常鍵3分岐の前回限定レビューは履歴として保持する。今回は承認済み初回Host設定をARCH-000013とAccess Management詳細から横断モデル・Workbench／MCP詳細へ候補伝播する。今回の固定12文書は契約・品質の限定独立再レビュー済み・全重大度の残指摘0で、前回Passを流用していない。Quality・Source・具体API／物理保存・本番接続は未完了。Architecture Ready・QA Handoff・実装／実E2E成立は主張しない。旧crosは比較資料であり、他ARCHの状態は再評価しない。

現在の最小提示方式はAM詳細01の意味・順序、02の保存・確認対象Binding候補、Workbenchの短命提示、MCPの鍵非公開境界へ対応する。既存Details Relationを維持し、通常Receiptや新領域を追加しない。今回対応差分は限定再レビュー済み（最小鍵提示方式の伝播差分、全重大度0）、Source・Quality・本番接続は未完了。

| 詳細設計領域 | 対応Architecture定義 | 責務 | 状態 |
|---|---|---|---|
| [access-management](Details/access-management/01_Architecture.md) | ARCH-000013 | 最小ユーザー・Role・資格と交換相関の意味、現在認可、接続／公開範囲。初回Host設定の状態・元試行・個別事実を所有し、通常Host交換2操作とは別の明示CLI入口。Domain内容・Transportを所有しない | Candidate／Partial。初回State／SequenceはAM詳細01、内部操作候補と進行記録は02へ対応。登録解除・通常鍵3分岐を維持。物理保存Schema・具体API・表示／提示方式・初回限定接続確認方式OPEN |
| [ai-adapter](./Details/ai-adapter/01_Architecture.md) | ARCH-000004、ARCH-000010、ARCH-000015 | AI AdapterのCatalog・Profile管理、Provider別計画・出力変換と実行Authorityの分離 | Candidate |
| [artifact-signing](Details/artifact-signing/01_Architecture.md) | ARCH-000014 | 配布物の完全性、鍵Capability、Publisher証明 | Canonical |
| [checker](Details/checker/01_Architecture.md) | ARCH-000001、ARCH-000002 | 決定論的構造検査と契約移行時の機械的集合検査 | Canonical |
| [coordinator](Details/coordinator/01_Architecture.md) | ARCH-000004、ARCH-000008、ARCH-000010、ARCH-000014、ARCH-000015 | 単体・上位利用共通のTask公開API、実行Authority、AI Adapter接続、資源回収、通知と結果搬送 | Candidate |
| [contract-migration](Details/contract-migration/01_Architecture.md) | ARCH-000002 | Canonical Contract変更時の全Consumer・派生物・公開／Release／Recovery経路の閉包 | Canonical |
| [domain-model](./Details/domain-model/01_Architecture.md) | ARCH-000001、ARCH-000002、ARCH-000005、ARCH-000006、ARCH-000008、ARCH-000009、ARCH-000011、ARCH-000013、ARCH-000016 | Domain Modelの用途別公開入口、共通意味、活動CRUD、投影と保存部品。Runtime状態・Git確定・公開は所有しない | Candidate |
| [cros（旧比較資料）](Details/cros/01_Architecture.md) | ARCH-000005、ARCH-000006、ARCH-000009、ARCH-000010、ARCH-000013、ARCH-000015、ARCH-000016 | 旧Packageは撤去済み。認証・認可はAccess Management、ContextはDomain、活動・Profileは専門Ownerが所有する。旧本文のCoveredを新版へ流用しない | Historical Comparison／全体検証は未完了 |
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
| ARCH-000013 | [接続主体・Role権限・資格とRepository Federation](Definitions/ARCH-000013/architecture_definition.md) | access-management（意味Owner、初回Host設定と通常Host交換2操作を分離したCLI契約）、domain-model（認可済みContext集約・中立な共通Root／保存部品）、workbench-server（通常鍵3操作、初回は案内のみ）、mcp-server（全鍵操作・初期化状態照会の非公開境界）。Candidate／Partialで、新断面Details・具体API／保存は未完了。旧crosは比較資料 |
| ARCH-000014 | [Runtime Artifactの信頼評価](Definitions/ARCH-000014/architecture_definition.md) | runtime-trust、artifact-signing、coordinator、version-control |
| ARCH-000015 | [外部送信・結果帰還・候補採用](Definitions/ARCH-000015/architecture_definition.md) | coordinator、ai-runtime、cros、mcp、workbench |
| ARCH-000016 | [過去情報と現在有効な意図](Definitions/ARCH-000016/architecture_definition.md) | project-operation、crdd-domain-library、execution-intelligence、cros、runtime-data、version-control、workbench |
| ARCH-000017 | [公式素材の権利・用途確認](Definitions/ARCH-000017/architecture_definition.md) | official-asset-governance、workbench |
| ARCH-000018 | [実行事実の記録](Definitions/ARCH-000018/architecture_definition.md) | execution-intelligence |

Architecture定義と詳細設計領域は同じIdentityではない。新しい詳細領域を作る場合は本表と個別領域のRelationを同じ変更で更新し、どのARCH-IDも未接続または暗黙接続にしない。

## 4. Qualityへの引渡し

ARCH-000013では、Access Managementの資格Lifecycleと認可の意味、Domain Modelの認可済みContext集約・中立な保存部品、Workbenchの通常鍵操作、MCPの鍵操作非公開を分けて検証する。Domainの保存部品へ資格の発行／失効判断を移さず、Host CLIを新Serverや新Frameworkにしない。MCPは鍵操作のConsumerではない。9 Role分担行はARCH-000013を正本とする。管理認可と内容認可、登録／公開／実アクセス、解除／削除を区別し、固定8分担・登録解除・通常鍵3分岐に対する前回のAM／Workbench／MCP詳細レビューは残指摘0で、履歴として保持する。登録解除・鍵3分岐の前回横断レビューは履歴であり、旧初回Host設定候補の限定レビューも当時の固定版に限る。今回の最小鍵提示断面は限定再レビュー済み（最小鍵提示方式の伝播差分、全重大度0）である。[管理API・保存設計](Details/access-management/02_Management_State_and_API.md)から両除去読戻し、元発行IdentityとCredential IDの分離、元処理再観測と別交換、失効鍵の遅延応答拒否を導出する。登録解除・別交換の完了から開始済み取消や旧Secret受領を生成しない。配置候補から許可や実装成立を生成しない。

QualityはARCH-IDだけでなく、対応する詳細設計領域のComponent、Interface、Data／State Flow、Failure、Resource、配置および観測方法を入力にする。個別領域の`OPEN`または`FAIL`は未確認範囲として保持し、全体Passへ畳まない。

ARCH-000005では、orchestratorがObjective／Milestone Acceptance Decision Port／Recordを所有し、project-operation、cros、mcpは読取り投影だけを所有する。Qualityは、ProjectionからのAuthority生成、SPEC-000006／SPEC-000007からの判断Port到達、判断記録からのTask作成／Provider Effect、および下位完了からの上位受入推定を反証する。

### 初回Host設定の検証接続候補

Access Managementの元試行確定前UUID／鍵Effect 0、双方未初期化確認、既存拒否、途中再観測、発行／記録不明と確定後受け渡し不明の分離をQualityへ渡す。Workbenchは案内のみ、MCPは初期化と状態照会の負境界のみを確認する。Domain Modelは初回状態・Credential・Grantの意味Ownerではない。具体API、物理保存、提示方式・初回限定接続確認方式、Source、本番Consumer、実境界検証が未接続の間はCandidate／Partialを維持する。

## 5. Reality Audit境界

`Details/*/01_Architecture.md`だけがCanonicalな詳細設計を所有する。`*_Reality_Audit.md`は、基準版Capability、現行Source、既存試験、過去Architectureまたは物理Directoryとの後段照合であり、ARCH-IDを具体化するCanonical詳細設計ではない。Canonical詳細設計を固定した後、Reality Auditで実装を`Covered`、`Partial`、`Missing`、`Legacy`または`Implementation Detail`へ分類する。
