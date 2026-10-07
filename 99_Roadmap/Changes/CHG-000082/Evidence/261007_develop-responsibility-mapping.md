# Develop責務・依存関係の対応案

成果物種別: 変更計画・現行調査
状態: Draft（Architecture採用・実装移管は未完了）
対象変更: [CHG-000082](../change.md)
基準改訂版: `76d2c03603922512fa128a60f81b615073dc3a73`
維持責任者・採用決定権限: Qual-Lab

## 1. 結論と境界

トップフォルダは責務領域を表し、実行形態と責務分類を別軸で明示する。現行の名前・Package数を固定前提にせず、統合・用途別サブモジュール化・名称補正を比較する。全体をapplications/services等へ移すこと、常駐するものをすべて製品Applicationと扱うこと、新Packageを分類だけのために作ることは推奨しない。2026-10-07の人間の追加指定に基づく全体Before／After案を§10以降に示す。

現在の重点は、WorkbenchのAI実行組立て、Project Runtimeの本番接続、CROS RESTとMCPのShared Server組立てである。ファイル名からOwnerを決めず、公開入口化だけで足りる箇所と意味・実装の移管が必要な箇所を分ける。最新の整理方針はworkbench-server、mcp-server、domain-model、orchestrator、ai-adapterを責務で分け、実行の主従とコード依存をOrchestrator → Coordinator → AI Adapterへ揃えることである。共通Domain三領域の統合とNative内部整理を含め、詳細と決定状態は§10以降に示す。実装移管は未完了である。

本表は現行Sourceを新しい正解として採用するものではない。既存Architectureと人間が採用したCapabilityを基準に、現行構造との差を処置する計画である。Layerは実行Processや配布単位を決める規則ではなく、責務分類として用いる。Serviceは同じProcess内の関数呼出しでも成立し、専用子Processを要求しない。

## 2. 変更経路と着手前確認

| 項目 | 処置 |
|---|---|
| 現在の作業 | 読取り調査と対応案の記録。Source、公開API、保存形式、Authorityは変更しない。 |
| 後続の変更分類 | 複数Subsystemの責務・公開境界・利用側へ影響する再編。単なる配置変更とは区別する。 |
| 正本 | [Architecture](../../../06_Architecture/01_Architecture.md)、各Details、[Coding Standards](../../../06_Architecture/99_Coding_Standards.md)。本案で正本を置換しない。 |
| 着手前整合確認 | 親が既存正本と公開入口を照合し、読み取り専用確認者が重点三境界を確認した。Draftの方向は整合。完成後独立レビューではない。 |
| 後続の独立確認 | 責務・依存・Capability保持の独立レビュー、文書／直接伝播確認、不足／影響監査。固定候補と対象集合を確定して実施する。 |
| 今行わない確認 | Source不変のため回帰・実E2E・署名を実行しない。工程契約・準拠基準自体は変更しないため、準拠監査を自動追加しない。 |
| 人間判断 | v0.22内での整理方針は承認済み。Shared Serverを第三の製品入口として固定せず、共有配置として扱う再評価方針を§18に記録する。REST／Gatewayの具体的撤去は要求・利用側・成立済み能力を照合して判断する。 |

## 3. 全18領域の一次対応

分類は主責務を表す候補であり、一領域に複数性質が存在してよい。状態の意味を所有することと保存場所を解決することを分ける。

| 現行領域 | 主な分類案／実行形態 | 所有する意味・状態 | 予定処置 |
|---|---|---|---|
| workbench | 製品Application／Server＋Browser | 表示、画面要求、Connection。AI実行Authorityは生成しない。 | AI組立ての公開入口化。画面向け変換の移管候補を評価する。 |
| mcp | 製品Application／stdio・HTTP待受け | Protocol、Request、Session・Transport lifecycle | Protocol Ownerを維持。Shared Server組立てを区別する。 |
| coordinator | Service／Task単位実行 | AI実行、Provider、候補、取消・実行資源 | 汎用実行を保持。Project本体の接続とUI固有処理を分離評価する。 |
| project-runtime | Service／呼出し単位 | Objective、Task、Decision、Acceptance、進行と再入場 | 状態・進行Ownerを維持し、本番接続のOwnerを具体化する。 |
| cros | 横断Service＋通信Adapter／呼出し・HTTP | Repository集合、Credential、Exposure、権限内Federation | 横断意味と通信・Gateway組立てを区別する。 |
| project-operation | Domain API／呼出し | Topic、Meeting操作とOwner Artifactからの投影 | 現状維持候補。Project Contextを第二の正本にしない。 |
| execution-intelligence | Domain API＋分析／呼出し | 実行記録、欠測、非Authorityな評価候補 | 記録・照会・分析を維持。実行制御を移管しない。 |
| ai-runtime | 構成Domain API＋Library／呼出し | Profile Catalog、採用Revision、解決結果 | 単なるProvider実行Libraryではない。構成管理と解決を保持する。 |
| runtime-data | 保存境界Library／呼出し | Root、保存先、用途別配置・保持契約 | 業務状態の遷移を引き取らない。Owner別Storeと区別する。 |
| version-control | Library／呼出し・Git Process | Git観測・操作の境界 | 現状維持候補。Git永続状態はGitのOwnerである。 |
| crdd-domain-library | Library／呼出し | Artifact、Relation、Symbol等の共通契約 | 現状維持候補。Project進行を追加しない。 |
| platform-access | Native基盤／限定子Process | OS観測・限定操作のprotocolと資源 | 保護実行物・固定子入口を維持し、呼出し側の意味を引き取らない。 |
| artifact-signing | 署名Library／呼出し | 署名対象・鍵利用・署名結果の契約 | Release Tooling利用とRuntime検証を区別。名前だけで一括移管しない。 |
| official-asset-governance | 開発・公開Tooling候補／呼出し | 素材の権利・用途確認 | 現状維持候補。製品Runtime利用の必要性を利用側から確認する。 |
| checker | Tooling／単発 | 機械検査規則と結果 | 現状維持候補。Domain LibraryのConsumerとして扱う。 |
| semantic-coverage | Tooling／単発 | 意味Coverageの生成Projection | 設計・実装・試験を正本として維持する。 |
| verification-runner | Tooling／単発・試験子Process | 試験選択・実行・未実施結果 | 現状維持候補。Quality／Release判断を引き取らない。 |
| visual-preview | Tooling／一時HTTP待受け | Visual確認用配信・Browser観測 | 常駐することを理由に製品Applicationへ変更しない。 |

## 4. 現行の直接依存

`40_Develop`内のTypeScript相対参照をSource／bin等、scripts、testsへ分けた一次抽出である。表はSource／bin等の領域間参照を示す。型参照と値参照をまだ分離しておらず、呼出し・Effectの発生を意味しない。Dynamic importの非literal、固定子入口、Native protocol、Tool入口、設定・配布閉包までの全依存Graphではない。

| 利用側 | 現行の直接依存先 |
|---|---|
| workbench | ai-runtime、coordinator、cros、execution-intelligence、mcp、project-operation、project-runtime、version-control |
| mcp | ai-runtime、cros、project-operation、project-runtime |
| coordinator | ai-runtime、execution-intelligence、project-runtime、runtime-data、version-control |
| cros | ai-runtime、project-operation、project-runtime、runtime-data、version-control |
| ai-runtime | runtime-data |
| execution-intelligence | runtime-data、version-control |
| runtime-data | version-control |
| checker | crdd-domain-library、runtime-data、version-control |
| crdd-domain-library | version-control |
| official-asset-governance | crdd-domain-library |
| semantic-coverage | crdd-domain-library、version-control |
| verification-runner | version-control |
| visual-preview | runtime-data、version-control |
| artifact-signing、platform-access、project-operation、project-runtime、version-control | この抽出方法では他領域のTypeScript相対参照なし。外部Effectや外部依存の不存在を意味しない。 |

Coordinator scriptsにはartifact-signing、mcp等への参照がある。開発用検証の参照を製品Runtimeの逆依存と混同しない。一方、薄い`template/tools/crdd-mcp.ts`はCoordinator公開入口でProject操作を組み立てており、実装移管時にはこの配布側接続も追従対象にする。

## 5. WorkbenchとCoordinatorの対応

対象はCoordinatorの`src/workbench-ai`全14Fileと、Workbenchの`bin/workbench.ts`の内部8File参照である。WorkBench Source全体が内部参照しているとは主張しない。

| 現行のまとまり | 目標Owner／処置 | 保持するもの |
|---|---|---|
| bin/workbench.tsのProvider実行・候補Executor組立て | まずCoordinatorの用途限定公開組立て入口を利用する。内部8Fileの再公開だけでなく、利用側が必要な操作契約へ絞る。 | Codex／Claude助言・候補、Profile固定、実行許可、取消と終了後確認 |
| workbench-ai-request-application.ts | 汎用依頼の開始・観測・取消OwnerとしてCoordinator維持候補。UI名だけで移動しない。 | Process内依頼状態、取消Signal、秘密非永続化 |
| workbench-ai-repository-composition.ts | 固定Project Contextの読取り・画面向け要求変換と、実行・送信保証を分割評価。前者はWorkbench移管候補、後者はCoordinator。 | 許可参照、Profile改訂、Task Packet、送信同意、境界外拒否 |
| workbench-candidate-application.ts | Candidate本体操作はCoordinator、表示・要求変換はWorkbench。Owner境界で分割評価する。 | 未採用候補、採否Authority、削除・回復結果 |
| advice-task／execution-plan／runtime-packet／resultの4File | 実行契約と画面固有投影を照合。契約Ownerに合わせて維持または限定分割。 | 実行意図、結果の事実・分析・推論の区別 |
| dispatch／provider-adapter／provider-executor／provider-command／provider-output／production-runtime／change-candidate-runtimeの7File | §15の最新方針で再分類する。Provider固有処理はai-adapter、共通実行・隔離・資源回収はCoordinatorへ分ける。File丸ごとの維持・移管を名前だけで決めない。 | Provider構成、結果正規化、候補隔離、資源回収 |

初期比較の最小代替は公開組立て入口化だけであった。2026-10-07、人間はProvider固有処理をai-adapterへ分離する方針を了承したため、現在の予定は公開入口化だけではない。汎用依頼状態までAdapterへ移さず、公開入口を作るだけでSourceの責務混在全体が解消したとも扱わない。

## 6. Project Runtime接続19Fileの対応

| 現行のまとまり | 目標Owner／処置 |
|---|---|
| project-runtime-durable-foundation／history／acceptance-decision-store／decision-recovery-store／integration-record-adapterの5File | Project Runtimeの状態・保存Adapterへ移管候補。Runtime Dataへ業務状態を移さない。共有Lock・保存primitiveは既存Ownerを照合し、複製しない。 |
| project-runtime-objective-intake.ts | Objective受付・進行はOrchestrator側。Provider実行接続はCoordinatorが提供する公開実行APIの呼出しへ分ける。 |
| project-runtime-composition-root.ts | 状態照会、Decision、Acceptance、候補統合、Docker回復、Windows保存を分割判定。Projectの本番組立てをCoordinatorの公開操作として恒久所有しない。 |
| project-runtime-public-adapter.ts | Client Principal観測を呼出し側の認証・Platform境界と照合。Projectの状態意味へOS認証を混ぜない。具体的配置は要確認。 |
| acceptance-authority／decision-capability／execution-authorizationの3Adapter | Project判断の契約と、実行Authorityの発行・消費を区別。名称だけでAuthority Ownerを移管しない。 |
| execution-host／single-task／task-recovery／candidate-integration／docker-project-recovery-settlementの5File | Coordinator固有実行・候補・Docker部分は維持候補。進行状態のsettlementはOrchestrator側。Coordinatorの公開実行・取消・通知契約を利用し、Coordinator本体からOrchestratorへの参照を作らない。 |
| windows-decision-store／windows-platform-adapterの2File | Project保存・Platform AdapterはProject Runtime移管候補。Coordinator由来の保護保存・Kernel Lock依存を先に照合し、移動だけで解消しない。 |
| execution-intelligence-adapter.ts | Project実行イベント→Execution Intelligenceの接続としてProject側移管候補。Coordinator実資源観測は実行側に保持する。 |

以前の「Project Runtime本体はCoordinatorをimportせず、Project側Portへ実行Adapterを注入する」案は、2026-10-07の人間との確認により置き換える。OrchestratorはCoordinatorの公開APIを直接importして呼び出し、必要なイベントハンドラーを登録する。Coordinatorは渡された関数を呼ぶが、Orchestratorをimportしない。別のPort層、汎用Event Bus、新永続State、新Lock Frameworkを追加しない。

既存Coordinator CLIのProject操作は能力として保持するが、上位の受付・組立てと下位Coordinator実行を区別して再配置する。旧呼出し元を保持するためにCoordinator本体へOrchestrator逆依存を残さない。既存commandの振分け先と起動入口の移管方法は、全Consumerの対応付け時に確定する。

## 7. CROS、MCP、Shared Serverの対応

| 現行箇所 | 目標責務／処置 |
|---|---|
| cros/runtime、project-federation、Credential・Registry群 | CROS横断Serviceとして維持。Repository正本・Project進行を引き取らない。 |
| cros/remote-transport.ts | REST Server、Client、Federation／Profile接続が同一Fileにある。通信と意味処理を分割評価し、CROS内の用途別Moduleとして残せるかを先に確認する。 |
| mcp/adapters、protocol、transports | MCP要求変換・Protocol・Transportとして維持。CROSの意味やProject進行を再定義しない。 |
| mcp/composition/cros-project-context-application.ts | CROS Service→MCP操作のAdapterとして維持候補。 |
| mcp/composition/cros-shared-server.ts | REST＋MCP＋Gatewayの三Listenerを同一Originへ合成するApplication組立て責務。MCP protocol本体と分ける。物理Ownerは未確定。 |

Shared ServerをCROSへ丸ごと移すと、現行MCP→CROSにCROS→MCPを追加し得る。初期案では専用Application Package等も比較したが、最新の再評価方針は§18の二系統の公開入口と共有配置への縮小である。既存Compositionを独立製品として移管・固定せず、REST／Gatewayが必要な具体的利用側と要求を先に照合する。

## 8. 保持するCapabilityと検証への接続

| 境界 | 保持対象 | 必要な確認 |
|---|---|---|
| Workbench AI | Codex／Claude助言、変更候補、観測・取消、Candidate操作、Profile固定、秘密非表示 | 公開入口の契約、実構成の局所試験、取消・異常・回収、必要な署名付きProvider E2E |
| Project Runtime（Orchestrator候補） | Objective→Task、状態照会、Decision、Acceptance、候補統合、再入場、state/history、Windows安全保存、実行知接続 | Coordinator公開API・通知契約、別呼出し再入場、保存失敗、Authority搬送、既存実Provider経路 |
| Shared Server | 同一OriginのREST／MCP、Bearer認可、Exposure、固定Route、Origin、部分起動失敗・終了時回収 | 実HTTP両経路、非認可・境界外、Listener／Socket／Request終了後観測 |

これは必要確認の一覧で、現在の実行結果ではない。過去のEvidenceは対象版・範囲を保持し、新配置や新Ownerの成功根拠へ自動流用しない。既知Graph停止、Docker回復縮小の本番未接続、公式CLI実境界未確認を本再編で解消済みと表示しない。

## 9. 実施順序と未確定事項

1. 本対応案と公開入口・状態Ownerを確認し、Shared Server配置を具体化する。
2. 現行Capabilityの過去Evidence、全Consumer、型／値／子Process／Native／配布閉包を照合し、ファイル・関数単位の移管表を固定する。
3. Architecture DetailsとQuality検証義務を先に更新し、独立確認を通す。
4. Workbench公開接続→Project Runtime接続→Shared Server組立ての順で、各変更の依存を確認して実装する。単なる移動と意味変更を分ける。
5. 静的確認、局所反例、影響回帰、固定候補の独立レビュー・伝播監査を完了し、必要な署名・実E2Eへ戻る。

OPEN: Shared Server縮小に伴うREST／Gatewayの利用側移管、Project Runtime保存からCoordinator共有primitiveを利用する境界、依頼・結果型の最終Ownerは未確定。全Consumerと実行閉包を照合した後に判断する。これらが決まるまで該当Sourceの撤去・移管を開始しない。

## 10. Package境界と親フォルダ名のBefore／After案

人間は、Domain Library、Project Operation、Runtime Dataの親フォルダ統合・責務別サブモジュール化、および親フォルダ名全体の再評価を了承した。以下は計画上の採用方針と残る候補を区別する表であり、改名・実装移管の完了またはArchitecture正本更新済みを意味しない。

| 現行 | 推奨する親フォルダ候補 | 処置・理由 |
|---|---|---|
| crdd-domain-library ＋ project-operation ＋ runtime-data | domain-model | 2026-10-07、人間が三領域の親フォルダ統合と§11の責務別構成を了承した。旧Package名を内部にそのまま並べず、モデル・解析・CRUD・保存共通部品を再分類する。用途別公開入口と状態Ownerを維持する。 |
| ai-runtime | ai-adapter内のProfile管理Module | 人間は独立ai-profile親フォルダを作らずai-adapterへ統合する方針を指定した。Catalog管理・保存・選択・解決・利用可能性投影とProvider接続は内部Moduleで分ける。 |
| Coordinator内のProvider固有実装 | ai-adapter | 人間が分離方針を了承した。AI固有のコマンド・入力・出力・エラー・認証手順差を吸収する。Coordinator共通実行・Docker資源管理は移さない。 |
| mcp | mcp-server | stdio／HTTPで待ち受ける製品入口を明示する。通信Adapter・要求型も含む。Shared Server全体のOwnerと同一視しない。 |
| workbench | workbench-server | 人間が指定した名称。常駐入口を示す。Browser UIも同じPackageへ含み、Server／Browserの責務は内部で分ける。 |
| coordinator | coordinator | AIの単発実行を編成する既存概念と一致。AI ProfileやProject進行を所有する意味へ広げない。 |
| project-runtime | orchestrator | 2026-10-07、人間が最終Folder名をorchestratorとして確定した。目標からTaskを進め、順序・判断待ち・再開を管理する上位実行調整役。Coordinatorとの主従関係は§14による。実装移管は未完了。 |
| cros | cros | 複数Repositoryを横断する採用済み製品概念を維持。Registryだけを指す名前へ狭めない。 |
| execution-intelligence | execution-intelligence | 記録と根拠付き評価を表す採用済み概念を維持。実行制御と区別する。 |
| version-control | version-control | Git実装と差替え可能なVersion Control境界を表す。 |
| platform-access | platform-access | 一つのNative Packageと実行物を維持し、process／filesystem／docker-desktop／protocolの責務で内部を整理する。§17参照。 |
| artifact-signing | artifact-signing | 意味非依存の署名部品としての責務を表す。Coordinator専用品へ改名しない。 |
| official-asset-governance | official-asset-governance | 公式素材の権利・用途管理であり、汎用Artifact解析とは別の判断責務を持つ。 |
| checker | checker | 機械検査の利用目的が明確。DomainモデルのOwnerにはしない。 |
| semantic-coverage | semantic-coverage | 設計・実装・試験の意味Coverage生成を表す。 |
| verification-runner | verification-runner | 試験の選択・実行を表す。製品Taskの実行と混同しない。 |
| visual-preview | visual-preview | Visual確認に限定する。一般Web Serverや検証Frameworkへ広げない。 |

この案では三Package統合で二つ減り、ai-runtimeをProvider固有処理と合わせてai-adapterへ再編するため、18Packageから16Packageとなる。件数削減は目的・完成条件ではない。Shared Server専用Packageは現在の目標案に追加しない。各Packageがprivate、同じNode.js基準、同じRepository内で配布されていることは統合可能性の根拠の一部であり、それだけで独立境界不要と証明しない。

### 推奨案の物理構造

```text
40_Develop/
├ workbench-server/           Browser UIも同じPackageに含む
├ mcp-server/                 通信Adapterを含む常駐MCP入口
├ coordinator/
├ orchestrator/               人間が確定した名称。実装移管は未完了
├ cros/
├ domain-model/               三領域統合。下記の責務別サブモジュール
├ ai-adapter/                 Profile管理とAI固有差の吸収を内部で分離
├ execution-intelligence/
├ version-control/
├ platform-access/
├ artifact-signing/
├ official-asset-governance/
├ checker/
├ semantic-coverage/
├ verification-runner/
└ visual-preview/
```

Application／Service／Domain API／Library／Toolingは設計上の分類として残し、物理的な親Directoryを追加しない。名前の候補が確定しても、ARCH-ID、QA Local Item、Topic／MTG ID、protocol、CLI、設定keyを命名変更へ便乗して改変しない。

## 11. 統合するDomain Modelのサブモジュール案

| サブモジュール候補 | 現行Owner・内容 | 統合後の責務境界 |
|---|---|---|
| artifact | Domain LibraryのArtifact Model、Markdown解析、Schema、Relation Graph | 共通構造の解析・検証。Topic状態・Project受入判断を生成しない。 |
| reality-traceability | Domain LibraryのSymbol、Annotation、Graph | Source／Test観測・Relation。Project進行を所有しない。 |
| quality-change-control | Domain Libraryの品質候補固定、確認集合、Gate統合、再入場 | 品質の判定モデル。Quality Centerの表示用解析と混同しない。 |
| project-context | Project OperationのProject／Release／Quality Projection ReaderとSource投影 | 正本から現在値を読む・投影する。新しいRisk／Decision正本を作らない。 |
| topic | Project OperationのTopicモデル、Repository、Application | Topicの登録・編集・削除・一覧・取得、Relation、CHG昇格。 |
| meeting | Project OperationのMeetingモデル、Repository、Application | Meetingの登録・編集・削除・一覧・取得、Outcome処置とAction移管。Topicとの連携契約を保持する。 |
| 候補採否モデル（配置要確認） | project-operation.tsのCandidate／採否部分 | Owner Artifactへの候補採否。Coordinatorが持つCode Candidate本体・Storeとは区別する。 |
| storage | Domain Libraryの保存Root・排他・Owner不存在確認、Runtime Dataの一時保存共通部品 | 安全な保存、Lock、短命ファイルの確定・清掃。Coordinator／Orchestratorの実行状態の意味や回復方針は引き取らない。 |
| repository | Domain LibraryのRepository観測、Runtime DataのRepository Manifest・Root・配置解決 | Repository識別・読取り・保存範囲。Gitによる検証はversion-controlを利用し、逆依存を作らない。 |
| configuration | Runtime Dataのツール設定読取り・検証 | 設定の構造と読取りを共通化する。各ツールの設定意味・採用判断・状態Ownerは変更しない。 |
| outcome.ts | Domain Libraryの中立な処理結果 | 共通結果だけを表す。Checker FindingやRelease判断を共通型へ混ぜない。 |

上表は意味の対応であり、File名の最終移管表ではない。候補採否部分を単独Packageにする理由は現時点でない。Domain Model内部のサブモジュール間依存を許す場合も、下位の解析・観測から上位のTopic ApplicationやStoreへ依存させない。

公開面は用途別入口を維持する。Checkerはartifact、Semantic Coverageはartifact／reality-traceability、CROS・MCP・Workbenchは必要なproject-context／topic／meetingを使う。合併後のroot index.tsへすべての実装を集め、利用側をroot importへ寄せない。package exportsの宣言だけでは相対Pathによる越境を防げないため、実際のimport集合と公開境界の契約試験も追従する。src配下は過剰な階層化を避け、既存Coding Standardsの深さ制約へ照合する。

Domain Modelは意味・解析・操作をまとめるPackageであり、型定義だけの置場でも、Process内にすべてのProject状態を保持するSingletonでもない。現在のTopic／Meeting正本、Quality／Release正本、Repository Root、現在状態・履歴・候補の保存Ownerを統合Package名から変更しない。

## 12. 比較した代替と未確定事項

| 代替 | 利点 | 残る問題／現在の推奨 |
|---|---|---|
| 現行三Packageを維持し名称・境界だけ明示 | 変更面が小さい。下位共通部品を独立利用しやすい。 | 意味の近い解析・Project運営・保存契約の配置が分散する。人間が示した統合意図を満たさないため、比較対象として保持する。 |
| domain-modelへ統合し用途別入口を維持 | Package境界を減らし、共通構造と固有意味の関係を一か所で説明できる。 | 共通利用側が業務Storeを巻き込む危険がある。用途別importを維持する条件で推奨する。 |
| 統合に加えて新しい共通基盤Packageを作る | 純粋DomainとFilesystem基盤を物理分離できる。 | 現在の独立配布・利用理由の確認が不足し、Package追加と移行面が増える。今回は採用しない。 |

初期案のproject-domain、後続のcontext案は最新の推奨名としない。人間の指摘に基づきproject接頭辞を分類理由にせず、domain-modelを最新提案名とした。project-runtimeの代替として提示したworkflowも推奨しない。現在はOrchestratorとして責務とCoordinatorとの主従関係を説明する。

以前の読み取り専用追加整合確認は、統合＋用途別入口維持、当時のai-profile候補、通信Adapterを含むmcp-serverの説明を対象とした。下位primitiveの即時抽出とruntime-storageへの範囲縮小は推奨しないという結果を保持する。その確認を最新のOrchestrator直接依存・通知契約の独立確認へ流用しない。これは実装・完成レビューではない。

OPEN: 候補採否モデルのサブモジュール配置、Shared Server縮小時の利用側対応、各公開契約と全File移管表は未確定。workbench-server、mcp-server、orchestratorの名称、domain-modelへの三領域統合、Profile管理を含むai-adapterへの再編は人間了承済みであり、未決の方針に含めない。必要な判断後にSource／tests／package名／公開入口／配布・署名閉包／Symbol Path／Architecture Details／利用Workflow・Tool・設定参照の全移管表を固定する。安定IDと履歴Evidenceの当時のPathは改名しない。

## 13. 次のGate

Before／After案の方向と最終名称を人間が確認した後、§9の順序へ進む。新たな依存や共通primitive移管を導入する場合は着手前照合を更新する。現在の試験結果を別Package構成へ流用して完成を主張しない。

統合の受入条件は、既存公開能力が対応付きで維持され、用途別入口から必要なModuleだけを利用でき、依存循環がなく、Topic／MTG操作・Projection解析・Artifact／Graph・品質Gate・Symbol観測・Root／Lockの既存保証が新構成で確認されることである。単に新FolderができたことやPackage数が減ったことを完了としない。

## 14. OrchestratorとCoordinatorの主従・公開契約

2026-10-07、人間は「Orchestratorが必要とする実行契約をCoordinatorに用意し、Orchestratorが呼び出し、イベントハンドラーを登録して通知を受ける」方式を指定した。実行時の主従とコードの直接依存を同じ方向へ揃える。

```text
Coordinator単体の利用
  → 公開実行API → AI実行・Review → 結果

Orchestratorからの利用
  ├ 公開実行・取消APIを呼ぶ
  └ 進捗・完了等のイベントハンドラーを登録する
             ↓
         Coordinator
             ├ 個々のAI実行・Review・取消を管理する
             └ 登録されたハンドラーへ通知する
```

| 所有者 | 公開・所有する責務 | 所有しないもの |
|---|---|---|
| Orchestrator | 目標、Task順序、Queue、判断待ち、進行状態、再開方針。Coordinator公開APIの呼出しと通知の利用。 | Provider固有実行、Docker資源制御、Coordinator内部実装。 |
| Coordinator | 単発AI実行、Review、取消、実行Identity、実行結果・進捗通知、登録解除と通知lifecycle。単体利用可能。 | Orchestratorの目標・Queue・業務判断・再開方針。Orchestrator実装へのimport。 |

ハンドラーを呼ぶことは、CoordinatorからOrchestratorのPackageを参照することではない。イベントの型と登録・解除APIはCoordinatorが公開し、Orchestratorは自分の関数を登録する。Coordinatorは登録された関数を呼ぶだけで、上位の具象型や状態を知らない。抽象化の見栄えだけを理由に別Port Package、Event Bus、専用Processまたは新しいAdapter階層を追加しない。

公開契約の具体化では、実行要求・結果・取消・登録解除を対応させ、正常・失敗・取消・遅延通知・ハンドラー例外と終了後処置を確認する。通知を受けただけで実行成功や資源回収を推定せず、結果とcleanupの事実を保持する。ハンドラー例外の処置、最終結果の返却方法、通知順序・終端後通知の扱いは未設計であり、実装前にCoordinatorの既存契約と照合して固定する。新規保証が既に実装済みとは主張しない。

CoordinatorからOrchestratorへの現行参照を消す際は、Project操作のCLI・MCP・本番組立て等の上位利用側を移管表へ含める。単体Coordinator利用とOrchestrator経由利用の両方を検証し、既存Capabilityを失わずに依存を整理する。

## 15. AI固有差と実行記録の分担

2026-10-07、人間はAI固有実装をCoordinatorから分離し、ai-adapterへ閉じる方針を了承した。CoordinatorからなくすのはCodex／Claude専用実装であり、Coordinator自身の共通実行管理ではない。

| 担当 | 責務 | 所有しないもの |
|---|---|---|
| ai-adapter内のProfile管理 | Provider・Model・推論強度・用途のCatalog、管理・保存・選択・解決、利用可能性の投影 | Provider実行、認証秘密、実行Authority |
| ai-adapter内のProvider接続 | Provider固有コマンド生成、入力変換、出力解析、エラー正規化、認証手順差、利用量等の観測の共通形式化 | Task順序、Docker全体の資源管理、実行履歴の独自保存 |
| coordinator | 共通Adapterを用いた実行・Review・開始・取消・終了・隔離・資源回収。個別実行の記録接続 | Provider固有出力形式、Orchestratorの進行状態 |
| orchestrator | 目標・複数Taskの順序、判断待ち、再開、全体進行の記録接続 | AI固有コマンド、個別Processの回収 |
| execution-intelligence | 共通実行記録の保存・読取り・集計、欠測を保った評価候補 | Provider制御、実行許可、採用判断 |

```text
Orchestrator → Coordinator → AI Adapter
                    ├→ AI Adapter内のProfile選択・解決
                    └→ Execution Intelligence（個別実行記録）
Orchestrator ─────────→ Execution Intelligence（全体進行記録）
```

AI Adapterは共通結果・エラー・利用量等を返し、Execution Intelligenceへ直接履歴を書かない。Coordinatorが自身の開始・取消・回収観測と合わせて記録する。取得できない情報は未観測のまま渡す。Orchestratorの全体進行記録と同じ個別実行事実を二重に計上しないよう、記録Identity・粒度を実装前に照合する。

Provider固有の終了方法はAdapterが表現し、実際の停止・終了確認・回収はCoordinatorが管理する。AI AdapterからCoordinatorへの逆importを作らない。新しいAIの追加は原則AdapterとProfile設定で対応できる境界を目指すが、新しい必要保証がある場合までCoordinator不変を保証しない。

現行の記録接続はCoordinator内の`src/project-runtime/execution-intelligence-adapter.ts`と本番組立てにある。上表は目標分担であり、記録接続の分離が実装済みとは表示しない。

## 16. Repository契約とGit操作の分担

Domain ModelのCRUD・ファイル保存と、Gitによる確定・公開を分ける。データモデルが編集のたびにCommit／Pushする構造にしない。

| 担当 | 直接利用の目的・範囲 |
|---|---|
| domain-modelのartifact／topic／meeting等 | モデル・内容検証・CRUD。Git操作を業務モデルへ混ぜない。 |
| domain-modelのrepository接続 | Repository識別・保存範囲・Root確認。Gitによる検証・取得が必要な処理に限りversion-controlを利用する。 |
| version-control | Git固有のRoot検証、Revision、差分、固定Snapshot、Commit／Push等の明示操作。domain-modelへ逆依存しない。 |
| Workbench Server | ツリー・差分・ステージ状態の読取り、明示的なGit操作の受付。BrowserがGitを直接実行しない。 |
| Orchestrator | 作業進行に伴う基準版確認、承認条件に従った候補適用・確定。 |
| Coordinator | AI実行に必要な固定版・Snapshot確認。CRUDごとの自動Commitはしない。 |
| Checker | 検査対象Repository・Revision・変更範囲・固定版の確認。Git機能の利用を維持する。 |
| Execution Intelligence | 記録先Repositoryの検証・保存範囲の利用。現在のversion-control参照はRoot検証と型利用が主で、履歴分析・Pushを意味しない。 |

表示のための読取りは公開APIを直接利用できる。一方、Orchestratorが所有する候補採用をWorkbenchが別経路で適用せず、Workbench → Orchestrator → version-controlとする。Commit／Pushをどの入口へ公開するかは既存採用能力とAuthorityへ照合し、本計画を新操作の実装許可にしない。

検証済みRootの共通契約をdomain-modelへ無条件に移す案は採用しない。version-control自身が使う技術的検証結果まで移すと逆依存を作るためである。技術的Root検証結果はversion-controlに保持し、domain-modelがRepositoryの意味・保存範囲へ接続する。新しい共通型Packageは追加しない。Execution Intelligenceの直接Git依存を薄くする場合も、型だけを移して実処理の依存を隠さず、Root検証の接続まで対応付ける。

## 17. Platform Accessの調査結果と限定整理

現行は汎用OS操作の全集ではなく、Coordinator向けWindows Native補助実装である。通常のFilesystem・Path・Process・Docker CLI操作はNode／TypeScriptで扱い、必要な保証をNodeだけでは得にくい操作をRustへ委譲する。

| 現行のまとまり | 調査した責務 | 予定処置 |
|---|---|---|
| windows_owned_child.rs | Windows Job、子Process開始・終了・取消、Handle回収 | processとして整理。共通実行方針はCoordinator側に保持する。 |
| windows.rs／windows_directory.rs | 主体・ACL・Directory実体・Provider Home等のOS観測 | OS共通観測と用途固有の検査を見分ける。Provider固有選択はAI Adapter側との対応を確認する。 |
| docker_repair.rs／docker_authenticode.rs | Docker実行物の署名・Identity検査、Process観測、停止・起動の限定命令 | docker-desktopとして整理。復旧全体の判断をNativeへ追加しない。 |
| windows_terminal.rs | 回復の終端記録に関する保存・読取り・世代・保護・namespace検査 | 画面端末と誤解する名称を見直す。Windows保存操作とCoordinator専用記録検査を内部Moduleで識別する。 |
| protocol.rs／terminal_protocol.rs／host_namespace_protocol.rs／main.rs | TypeScriptとの固定要求・応答、入力検査、振分け | protocolと入口を整理。Protocol自体はOS固有機能ではなく接続契約である。 |

読取り調査時、windows_terminal.rsは8,413行、windows.rsは2,350行、docker_repair.rsは2,031行であった。試験とHeaderを含む行数であり、行数だけから不要・過剰と判定しない。

```text
platform-access/
└ src/
   ├ process/          Job・Process・終了後確認
   ├ filesystem/       Directory・ACL・安全な保存
   ├ docker-desktop/   Docker固有観測・限定操作
   ├ protocol/         要求・応答・用途別検査
   └ main.rs           固定入口
```

上記は責務別配置候補であり、Rust Module名・最終File名は移管表で確定する。一つのNative Package・実行物を維持し、新Frameworkや別Packageを作らない。公開入口・Protocol・署名対象の契約を維持し、Source配置が署名入力へ影響する場合は必要な再検証を行う。

### 保存処理と記録検査を分ける意味

WindowsのファイルOpen・ACL検査・書込み・確定・Handle終了と、Coordinator専用記録の形式・保存先・世代の検査を、内部File／Module上で見分けられるようにする。後者を直ちにTypeScriptへ移したり、汎用保存基盤へ置換したりする必要はない。誤対象への書込みを防ぐNative側の用途限定検査は維持する。Coordinatorが記録の意味・保存指示を所有することと、Nativeが要求を再検査することは両立する。

### NodeとNativeの使い分け

通常のPath構築・絶対化・リンク解決・属性確認はNodeの標準機能で扱う。Path文字列の正規化を実体同一性の証明にせず、一律の大文字小文字変換にも依存しない。Handleへ対象を結合した操作やWindows固有ACL・Jobの保証が必要な箇所だけNativeを利用する。すべてのPath処理へNative検査を追加しない。

Platform Accessを多数の上位Moduleが直接操作する構成にしない。Coordinatorや必要な保存Adapterが限定したNative要求を発行し、上位には共通結果を返す。今回の整理だけで既存の復旧縮小・本番切替・実E2Eが完了したとは扱わない。

## 18. Shared Server／CROS公開入口の再整理案

状態: Draft。対象: v0.22 Architecture Closure。2026-10-07の人間の提案を再評価方針として記録する。現行実装が要求から逸脱したという原因仮説や、RESTが不要という結論は未検証であり、Sourceの存在だけから採否を決めない。

### 結論・目標構成

主要な公開入口は、人間向けWorkbench ServerとAI／Machine向けMCP Serverの二系統とする方向で再評価する。Shared Serverを独立Product・Subsystem・第三のServer Runtimeとして追加せず、Workbench／MCP／CROS能力／Repository群を共有Hostへ配置する運用形態として扱う。

```text
Local PC または Linux等の共有Host
├ Workbench Server ← Human
├ MCP Server       ← AI／Machine Client
│       │
│       └── 同じ内部Capabilityを利用
├ CROS（Repository横断能力）
├ Orchestrator／Coordinator等
└ CRDD Repository群
```

| 区分 | 役割 | 今回追加しない責務 |
|---|---|---|
| Workbench Server | 人間の確認・操作入口。Browser表示とServerの内部APIを保持する。 | CROS専用外部REST製品の代替を無条件に主張しない。 |
| MCP Server | AI／MachineのProtocol入口。Machine Clientによる利用に毎回AIを介在させない。 | REST／Gatewayを含む共有Host全体のOwnerにしない。 |
| CROS | Registry、Credential／Exposure、権限内Context Federation等の横断能力。 | Server、REST、Shared Hostと同一視しない。横断分析・推薦の将来候補を今回の実装許可にしない。 |
| 共有配置 | Local構成をLinux等の共有Hostへ置く配置・運用。必要性に応じてDocker、TLS、Reverse Proxy、Supervisorを用いる。 | 自動Deploy、Repository Clone／Update管理、Backup、新公開API、独立Runtime。 |

CRDDのRepository単体利用と、CROSの複数Repository横断利用を区別する。共有配置をDomain Architectureへ混ぜず、Linux／Docker／Cloud／Localの違いだけで内部能力を重複実装しない。

### 現行との差と検討対象

現行の`mcp/src/composition/cros-shared-server.ts`は、CROS REST、MCP、loopback Gatewayの三Listenerを組み立て、TLS終端後の同一Origin経路へ接続している。これは実装上の事実である。一方「元の要求は二入口だけだった」「内部RESTがなくても全採用能力を維持できる」は、上流正本と過去の採用・検証結果への照合対象である。

| 現行 | 目標候補／処置 |
|---|---|
| CROS専用REST入口 | 内部利用だけならCapability直接呼出しへ置換候補。MCPで代替できない実Consumerがあるか確認する。 |
| 汎用Gateway相当のRouting | 第三Surfaceが不要なら撤去候補。必要な認証・Origin・HTTP共通処理は各Serverまたは配置基盤へ対応付ける。 |
| 三ListenerのSame-Origin Composition | 同一Originの必要理由を確認し、不要な合成・中継・Lifecycleを縮小する。 |
| MCP配下の共有Host組立て | MCP自身の起動・終了へ限定する候補。WorkbenchまでMCPの子Ownerにしない。 |
| REST経由のWorkbench内部利用 | 同一実行環境では内部Capability直接呼出しを優先候補とする。Remote接続の既存能力は別途対応付ける。 |

二系統という分類はWorkbench内部のJSON APIや静的Asset配信を禁止する意味ではない。またSame-Originを一律廃止する意味でもない。Browserの接続・認証・Origin要件と、REST＋MCPを同一Gatewayへ合成する必要性を分けて評価する。共有Host配置による認証・TLS・Exposure要件も撤去理由にはしない。

### 追加公開入口の判断基準

Workbench／MCPでは満たせない具体的Consumer Requirementが確認された場合だけ、RESTその他の公開入口を検討する。「将来便利」「RESTの方が軽量」だけでは追加しない。MCP非対応System連携、Webhook、外部SDK、一般公開API、大量・高頻度通信等は探索例であり、必要性・性能・適合性を確認済みとは扱わない。

### 撤去判断前の全数照合

| 確認対象 | 判断に必要な根拠 |
|---|---|
| 1. REST Consumer | 呼出し元、公開Route、設定、Remote Client、試験・配布入口の全利用側。 |
| 2. REST固有要求 | 対応するREQ／UI／SPEC／ARCHと、MCP・内部呼出しで代替できない条件。 |
| 3. Gateway責務 | Routing、認証、Origin、Body制限等の現在のOwnerと代替先。 |
| 4. Same-Origin | 必要なBrowser／Client条件、非適用例、配置条件。 |
| 5. 共有固有State／Lifecycle | 起動、部分失敗、Request／Socket／Listener終了と保存Stateの有無。 |
| 6. MCPのHost所有 | MCPだけのLifecycleと他入口のLifecycleを分けられるか。 |
| 7. 直接Capability利用 | 同一Process／Remote配置ごとの接続、認証・Exposure・Repository選択。 |
| 8. 成立済みCapability | 過去Evidence、置換Owner・実装、利用側、必要な実境界検証。 |

削除候補にする条件と実際に削除できる条件を分ける。具体的Consumer・要求を確認できないものは候補とするが、情報不足を不存在証明にしない。特に既存のRemote Context、Topic／Meeting CRUD、Profile管理、Bearer認可、Exposure、明示Repository選択、取消・終了後回収を置換経路へ対応付ける。未対応の採用能力がある間はREST／Gatewayを撤去済み・代替済みとしない。

次の作業はこの八観点の調査と内部File対応表であり、新Server・Deploy Toolの実装ではない。成立済み要求を二入口＋内部能力で維持できる場合に限り、余分なComposition・Transport・Lifecycleを削除する方針を具体化する。Architecture／Quality正本、設定、Workflow、公開入口、署名閉包と試験へ伝播し、独立確認を経てSourceの撤去へ進む。

## 19. Shared Server八観点のSource照合と配置対応案

2026-10-07の読取り調査。対象はCROS Remote Transport、MCP Shared Composition／認証接続、Workbench Remote呼出し、配布入口と代表試験である。試験Sourceを確認したが、この調査では試験を実行していない。全Subsystem全Fileの確定移管表ではない。

### 結論

RESTには現在の実Consumerがあるため、未使用物として即削除できない。一方、確認した上流要求は同じCapabilityへの到達・Remote認可を要求しており、RESTとGatewayの三Listener構成を固定する根拠は今回の定義照合では確認できなかった。目標は能力を減らさず、RESTで提供している能力をMCPまたは同一Hostの内部呼出しへ移すことである。

| 現行Remote能力 | Workbenchの接続 | MCPの現行対応／不足 | 縮小時の処置候補 |
|---|---|---|---|
| Portfolio／Project Context | readRemotePortfolioによるREST GET | CROS MCP Compositionは同じcreatePortfolioProjectionを利用し、Project Context一覧・取得へ渡す。 | WorkbenchのPortfolio読取りをMCPへ接続し、表示・部分可視・選択Identityの互換を検証する。 |
| Topic／Meeting CRUD | remote-topic-meeting.tsからMCPを呼ぶ。 | Credential／Exposureで許可されたRepositoryのApplicationをRequestごとに解決する。 | 既存MCP経路を維持。同一Host内部呼出しも同じ認可境界を通す。 |
| Runtime Activity | readRemoteRuntimeActivityによるREST GET | 調査したCROS MCP CompositionにはruntimeActivityReader依存がない。 | 既存の観測・Cursor・件数制限・欠測をMCPで提供する接続が必要。単なるRoute削除は不可。 |
| AI Profile一覧・更新 | readRemoteAiProfileCatalog／executeRemoteAiProfileMutationによるREST GET／POST | 調査したMCP Application依存にはProfile管理がない。 | ai-adapter内の共通Profile管理へMCP Adapterを接続。systemAdmin検査と秘密非開示を維持。 |

根拠: `cros/src/remote-transport.ts`の/v1/portfolio、/v1/ai-profiles、/v1/projects/<project-id>/runtime-activity、`workbench/src/workbench-server.ts`の対応呼出し、`mcp/src/composition/cros-project-context-application.ts`のprojectContext／topicMeetingRepositoryResolver接続。MCPが既に全Remote能力を代替できるとは主張しない。

### 八観点の判定

| 観点 | 今回分かったこと | 判定・残る確認 |
|---|---|---|
| 1. REST Consumer | Workbench ServerがPortfolio・Activity・Profile管理を使う。Topic／MeetingはMCPを使う。 | 実Consumerあり。内部利用に必要な能力とTransportを分離する。外部Consumer全数は公開案内・履歴まで後続照合。 |
| 2. REST固有要求 | REQ-000040はWorkbenchとMCPが同じApplication Capabilityを利用する要求、REQ-000041とARCH-000013はRemote認証・利用範囲・Access Recoveryを規定する。 | 調査した定義からREST固定の必要性は未確認。利用側をMCPへ置換する方向。不存在の全域証明ではない。 |
| 3. Gateway責務 | 固定Route中継、Forwarded情報／Origin検査、Body制限、Proxy Request管理、health応答。 | Domain能力ではない。必要な制約をMCP HTTP／配置のTLS境界へ対応付け、Proxy自体は撤去候補。 |
| 4. Same-Origin | RESTとMCPを同一HTTPS Originへ束ねる現行契約・試験がある。確認したWorkbench Remote通信はServer側fetchである。 | このRemote経路のためだけにBrowser Same-Originを要求する理由は未確認。Workbench自身のBrowser／Server契約は別に維持する。 |
| 5. State／Lifecycle | CompositionはListener・Socket・Proxy Request・close PromiseをProcess内で所有する。 | 調査したCompositionに独立した永続State保存はない。記録・Credential Storeの不存在を意味しない。必要な終了保証はMCP Listenerへ移す。 |
| 6. MCPのHost所有 | Shared CompositionがCROS REST、MCP、Gatewayの三Listenerと部分起動失敗・終了を管理する。 | REST／Proxy撤去後はMCP自身のLifecycleへ限定する候補。Workbench起動・終了を子Ownerとして取り込まない。 |
| 7. 直接Capability利用 | Portfolio生成とTopic／MeetingはMCP CompositionでCROS内部Capabilityを利用済み。 | 同一Host直接呼出しは可能。別HostのWorkbenchにはNetwork接続が必要で、すべてをローカル関数呼出しへ置換しない。 |
| 8. 成立済み能力 | REST／MCP同一Origin、固定運用設定起動・終了、Bearer Portfolio、Activity、systemAdmin Profile管理に代表試験がある。 | Transport固有試験と能力保証を分離し、能力の新経路試験を先に用意する。今回再実行・全Evidence照合は未実施。 |

配布入口の注意: `template/tools/crdd-cros-server.ts`はShared CompositionへpublicOrigin、port、registry、exposure、Topic／Meeting Resolverを渡すが、aiProfileAdministrationとruntimeActivityReaderは渡していない。したがってREST実装と局所試験の存在だけから、この配布入口でProfile／Activityの本番接続が成立済みとは扱わない。新MCP入口では宣言済み能力の接続範囲を明示的に閉じる。

代表試験: `mcp/tests/integration/cros-shared-server.integration.test.ts`、`mcp/tests/system/cros-shared-server-entry.integration.test.ts`、`mcp/tests/system/cros-projection-non-disclosure.contract.test.ts`、`cros/tests/integration/remote-transport.contract.test.ts`、`cros/tests/integration/shared-server-config-file-adapter.contract.test.ts`。過去のPassは新構成へ流用しない。

### File単位の一次配置対応

| 現行File・まとまり | 目標Owner／予定処置 | 保持条件 |
|---|---|---|
| cros/src/remote-transport.ts | 分割。Portfolio・認可済みActivity等の意味はCROS、Profile操作はai-adapterを利用するCROS認可接続、HTTP要求・応答はmcp-server側へ。旧REST Server／Clientは代替成立後に撤去候補。 | Credential、Exposure、非開示、Cursor、結果検査を落とさない。共通処理をRESTとMCPへ二重実装しない。 |
| mcp/src/composition/cros-project-context-application.ts | mcp-server内のCROS能力接続として維持・拡張候補。 | RequestごとのCredential／Exposure再検証。Context／Topic／MeetingとActivity／ProfileのAuthorityを分ける。 |
| mcp/src/composition/cros-shared-server.ts | 三Listener組立て・Proxyは撤去候補。必要なMCP起動、部分失敗処置、終了保証はMCP Serverの既存Transportへ対応付ける。 | TLS配置・Origin・取消・Socket／Request終了を消さない。File名変更だけで不要構成を残さない。 |
| mcp/src/transports/streamable-http-transport.ts | mcp-serverのHTTP Transportとして維持。 | CROS固有の業務判断をTransportへ埋め込まない。 |
| workbench/src/remote-topic-meeting.ts | workbench-serverのRemote MCP Client接続として維持候補。共通接続処理の抽出要否は反復の実態で判断。 | Repository明示選択、Relation認可、秘密非公開。汎用Gatewayを新設しない。 |
| workbench/src/workbench-server.tsのREST呼出し部分 | workbench-server内でMCP呼出しへ置換候補。同一Host構成では認可済み内部呼出しも比較。 | 画面Read ModelをCROSへ移さず、Remote切断・欠測・表示の意味を維持。 |
| cros/src/shared-server-config-file-adapter.ts | CROSのRegistry／Exposure／Repository Binding構成と、MCP配置設定を分離して再配置候補。 | CROS専用構成はCROSが所有。設定Fileの最終名称・場所・Front AI移行は未確定。 |
| template/tools/crdd-cros-server.ts | mcp-serverの正式起動入口への置換・整理候補。 | 薄い入口、全能力の接続、OS管理CROS RootとRepository単体利用を維持。 |
| template/tools/cros-shared-server-config-example.json | 見える設定例として、新しいCROS構成／MCP配置契約へ更新候補。 | 実Fileを維持する人間指定を保持。不要確定前に削除しない。 |
| cros/src/index.ts／mcp/src/index.ts、利用側・関連試験 | 公開exportと全importを追従。REST固有試験は新経路への能力対応後に整理。 | 名前だけを変えて旧公開面を残すか、新配置の成功と誤表示しない。 |

OPEN: 全外部Consumer・過去採用Evidence、Activityの具体的本番Reader、Profile管理の新MCP操作契約、設定の最終配置、全File／関数対応は未確定。独立レビュー・Source変更前にこれらを埋める。現在は再編調査の一段階であり、全親フォルダ内部整理の完了ではない。

## 20. Workbenchの表示APIとCROS接続の区別

2026-10-07の追加確認。REST撤去候補はWorkbench ServerからRemote CROSへのIntegration経路であり、BrowserからWorkbench Serverへの表示・操作APIではない。MCPはAI専用ではなく、Remote CRDD／CROS能力のMachine向け公開境界として扱う。Workbench Server自身もRemote側から見ればMachine Clientである。

| 経路 | 方針 | 注意点 |
|---|---|---|
| Browser → Workbench Server | 表示・操作用APIとして維持 | Browser認証、操作Authority、Origin、画面Read Modelを維持する。APIが存在することを第三の独立製品Surfaceとは数えない。 |
| Workbench Server → 同一ProcessのCROS | 共通の認可済みCapabilityを直接呼ぶ | Transportの省略をCredential／Scope／Exposure検証の省略にしない。 |
| Workbench Server → 別Process／Remote CROS | MCPによる接続へ置換候補 | 同一Hostであっても別Processなら関数を直接呼べない。Remote結果の検査・取消・接続失敗も保持する。 |
| 外部Machine／AI → CROS | MCP Serverから同じ内部Capabilityを利用 | AIを毎回介在させない。MCP非対応Consumerの新要求は別途評価する。 |
| Workbench Server → CROS REST | 必要な能力を上記経路へ対応付けた後の撤去候補 | Portfolio／Activity／Profile管理の現行利用を置換するまで削除しない。 |
| 第三のCROS REST／汎用Gateway | 現時点の目標構成には追加しない | 全外部Consumerの未確認を「存在しない」と言い換えない。§19の残る照合を完了する。 |

```text
Local・同一Process
Browser → Workbench API → 認可済みCROS Capability

Remote・別Process
Browser → Workbench API → MCP Client → MCP Server
                                         ↓
                              同じ認可済みCROS Capability

AI／Machine Client ─────────→ MCP Server
```

共通化するのはAuthorization／Scope／能力の意味と結果契約であり、Transportは同一実装に強制しない。Workbench側の共通呼出し入口が必要なら、既存のLocal接続とMCP接続を選ぶ薄いModuleで足りるかを確認する。別Port Package、Remote接続Framework、Event Bus、新Stateを分類のためだけに追加しない。「Port」は呼出し境界を説明する語であり、新しい依存逆転層の採用を意味しない。

Remote Workbench接続は現行Source・試験にあるため、特殊ケースであることだけを理由に削除しない。一方Shared配置の標準形はWorkbench／MCP／CROS／Repository群を同じHostへ置く候補とし、同一Processにするかは配置・運用の判断として分ける。LocalとRemoteの両方を必ず常時起動する構成や、自動Remote Fallbackを追加しない。

後続のArchitecture正本更新ではMCPのMachine向け境界、Workbenchの表示API、CROSの共通認可済みCapabilityと接続方式を明示する。本節は目標設計の補強であり、既存CROS認可処理がすでに一つの共通公開入口へ集約済みとは主張しない。

## 21. REST／Gateway廃止の移管単位と実装前Gate

2026-10-07、人間は「縮小」ではなくREST／Gatewayをなくす目標を明示した。§18〜20の撤去候補は、現在の採用された目標ではCROS専用REST Server／Clientと三Listener Gatewayの廃止である。ただしCapability移管・新経路検証が完了する前に削除しない。過去実装を保持する比較案と、現在の目標を混同しない。

### 完成時に残す構成

```text
Browser → Workbench Serverの表示・操作API
                       ├→ 同一Processの認可済みCROS能力
                       └→ MCP Client → Remote MCP Server → CROS能力
AI／Machine Client ─────────────────→ MCP Server → CROS能力

共有配置: Workbench Server／MCP Server／CROS／Repository群
外部TLS終端等: Deploymentの責務。CRDD固有Gatewayは作らない。
```

MCP Serverだけを公開する共有起動とWorkbench起動を分け、MCPがWorkbench全体を所有しない。Repository単体stdio／localhost MCPも維持し、CROS構成の存在を単体利用の必須条件にしない。

### 移管単位の具体案

以下の新File名は配置案であり、実装済みPathではない。責務ごとの入口を作るためにすべてを新Fileへ増殖させることはせず、既存Fileへの合流が自然な場合はそちらを選ぶ。

| 一次キー: 現行File／関数 | 処置・配置先案 | 廃止・保持する内容 |
|---|---|---|
| cros/src/remote-transport.ts のCrosExposureSnapshot | cros/src/repository-exposure.tsへ移管候補 | Exposureの共通型を廃止Transportから切り離す。ConfigとMCPが同じ型を利用する。 |
| 同FileのCrosRuntimeActivityReader／観測型・検査 | cros/src/runtime-activity.tsへ移管候補 | 認可済みRepository集合、Cursor、20件既定／50件上限、欠測、未信頼結果検査を保持。Source Eventの記録Ownerは移さない。 |
| 同FileのstartCrosRemoteTransport | REST専用Listenerとして廃止 | Credential／Session／Exposure検査とPortfolio生成は共通CROS公開能力へ接続。HTTP HandlerをそのままDomainへ移さない。 |
| 同FileのreadRemotePortfolio／readRemoteRuntimeActivity／readRemoteAiProfileCatalog／executeRemoteAiProfileMutation等 | Workbench ServerのMCP Client接続へ置換 | CROSのREST Clientと/v1 Routeを廃止。新通信結果の意味・検査は保持し、通信用ClientをCROS Domainへ混ぜない。 |
| mcp/src/adapters/application-adapter.ts | mcp-server側の既存合成入口へActivity／Profile Adapterを接続 | tools/listと実Routingを対応させる。非管理者にProfile管理能力を渡さない。 |
| mcp/src/protocolとadapters | runtime-activity、ai-profile用の局所契約を追加する案 | 既存Local Item・要求へ対応する操作のみ。Tool名、入力、成功・欠測・拒否・取消結果は設計Gateで確定。 |
| mcp/src/composition/cros-project-context-application.ts | CROSの各能力を同じRequest認可へ接続するCompositionに改名・拡張候補 | Portfolio／Context／Topic／Meetingを維持しActivity／Profileを接続。単なるContext名へ全用途を押し込めない。 |
| mcp/src/composition/cros-shared-server.ts | 廃止 | REST Listener、Proxy Request、三Listener合成、Gateway healthを廃止。MCP自身の起動・終了は既存Transportを利用。 |
| cros/src/shared-server-config-file-adapter.ts | cros/src/repository-registry-config.tsへRepository／Workspace／Exposure部分を移管候補 | Repository Root、Context Identity、重複・Binding検証を保持。publicOrigin／portはMCP Server配置設定へ分離。 |
| template/tools/crdd-cros-server.ts | 独立Server入口を廃止し、crdd-mcp.tsの共有CROS能力接続へ置換 | 組立て本体はmcp-serverの正式bin／src。toolsは薄い入口とし、CROS Domainに新Server binを作らない。 |
| template/tools/cros-shared-server-config-example.json | CROS構成とMCP配置の見える設定例へ置換 | 現在のJSONを新内容の正本にしない。新名称・配置は設計Gateで固定し、旧設定清掃はFront AI手順へ接続。 |
| workbench/src/remote-topic-meeting.ts／workbench-server.ts | Remote MCP接続を共通化できる最小箇所へ整理 | 既存Topic／Meeting、明示Repository選択、View Modelを保持。巨大なRemote Frameworkや自動Fallbackは追加しない。 |

### 設定と配布・文書の対応

| 現行の設定・接続 | 目標での処置 |
|---|---|
| shared-server.jsonのrepositories／workspace_ids／revision | CROSのRepository公開構成として保持。Credential Registryと混ぜない。CROS固有のOS管理Rootは既存契約を照合し、今回の名前変更だけでRepositoryへ移さない。 |
| public_origin／listen_port | MCP Serverの配置構成へ移す。TLS秘密鍵は通常構成へ入れない。Root・固定名・Schemaの最終案は未確定。 |
| WorkbenchのbaseUrl／mcpBaseUrl | CROS REST Endpointを廃止し、明示したMCP接続先へ統一する案。CredentialはProcess内で扱い、Browser Read ModelやURLへ混ぜない。 |
| CROS／MCP公開index、Checkerの命名試験、Version ControlのConsumer Closure試験 | 旧File／export／入口の参照を新構成へ追従。検査を弱めて削除を通さない。 |
| template/AGENTS.md、19_Workflows/04_MCP_Server.md | Shared Server三Listenerの起動手順を、MCP共有配置とWorkbenchの別起動へ置換。通常単体入口とHost限定Access Recoveryは維持。 |
| CROS／MCP／Runtime Data／WorkbenchのArchitecture Details、Quality Definitions | 能力Owner・新接続・撤去対象と検証義務を更新。過去Evidenceの当時のPath・結果は改変しない。 |
| package graph、配布・署名閉包、Symbol Relation | 廃止Source／設定／入口の参照と新接続を全数照合。今回の名称案だけで再署名・E2E成功を主張しない。 |

旧構成の実行時Fallback・互換Serverは追加しない。既存設定・入口の移行と清掃は、Front AIが変更前の利用状況・未解決参照を確認して処置する手順へ明記する。Credential、正式Evidence、Repository内容を旧Gatewayの生成物と一緒に削除しない。

### 新経路で保持する保証と反証

| 保証 | 必須反証・観測 |
|---|---|
| 認証と内容Accessの分離 | 無効／失効Credential、systemAdminだが内容Grantなし、Exposure変更、対象Repository不明を区別。拒否時に非開示Contextを漏らさない。 |
| Portfolio／Topic／Meeting互換 | Partial／Unavailable、Repository選択、Relation越境、Cursor／一覧、削除・昇格を同じ意味で扱う。 |
| Activity | Reader未接続、破損・欠測・不正Cursor／limitを成功へ畳まない。Reader接続を本番入口で確認する。 |
| Profile管理 | 管理権限なし、古いRevision、無効Profile、削除条件、設定保存失敗。AI Adapterの実Storeへ本番接続する。 |
| Transport／配置 | MCP localhostと共有TLS配置を区別し、Origin・Body上限・認証・切断・遅延完了・取消を確認。 |
| 終了 | MCP Listener・Request・Socketの終了を実観測。旧Proxy不存在とServer終了を、成功結果だけから推定しない。 |

追加調査で、既存MCP HTTPは127.0.0.1 bindを固定し、allowedOriginsをlocalhost系へ限定していることを確認した。したがって三Listener Gatewayを削除して既存MCPをそのまま公開すればよいとは言えない。外部TLS終端から固定loopback MCPへ接続する配置とOrigin・Host検証を先に設計し、CRDD固有Proxyを増設せず必要な保証を閉じる。既存の安全なlocalhost利用を緩めて共有配置を実現しない。

### Gateと現在状態

1. 設計Gate: CROS共通認可能力、Activity／Profile MCP契約、設定・入口、TLS／Origin配置、全移管表を固定しArchitecture／Qualityへ反映する。
2. 独立確認Gate: 現行Capability・過去Evidenceと新経路の対応、廃止対象、利用側、保存・認可・終了保証を確認する。現段階の読取り調査を独立Passにしない。
3. 実装Gate: 同一ProcessとRemote MCPの接続を成立させ、局所反例・影響回帰を確認後、旧REST／Gatewayと専用入口を撤去する。
4. 完成Gate: 廃止参照0、能力接続の全数確認、正式入口の実境界試験、必要な独立再レビュー・伝播監査を完了する。

現在は移管案の具体化までである。Tool名・設定契約・本番Activity Reader・共通認可公開API・過去Evidence全数照合はOPEN。次はこれらの正本設計と照合を行い、親フォルダ内部の全File棚卸しへ接続する。Source撤去、設定変更、署名、Docker操作、実E2Eは実行していない。

## 22. 公開能力・設定・本番接続の具体化案

この節はCommit `3389345e`で記録した案の次段階であり、Source実装前の契約候補である。新しい要求を追加する目的ではなく、旧RESTが提供していた能力と既存採用能力を二入口へ接続する。

### CROS共通呼出し境界

LocalとMCPは同じCROS公開能力を呼び、Requestごとの認証・利用範囲検証を共通化する。公開能力は認証済みAccess Contextと現在のExposureから対象を解決する。入力のRepository IDやsystemAdmin flagだけでアクセスを許可しない。Raw Tokenは接続境界で検証し、Source投影・結果・ログへ返さない。

| 能力 | 入力・結果の責務 | 具象の接続先 |
|---|---|---|
| Project一覧・Context取得 | 許可されたPortfolio、Project別Context、不完全性・Owner Relation | 既存CROS Federation＋domain-model/project-context |
| Topic／Meeting操作 | 明示Repository、CRUD・Relation・Outcome・昇格と結果 | domain-model/topic／meeting。現行MCP経路の認可保証を保持。 |
| Runtime Activity取得 | Project、Cursor、limit、Source別公開可能な現在状態・Event・欠測 | Orchestrator公開状態Query＋Execution Intelligence公開記録。CROSが許可Repositoryだけを渡す。 |
| AI Profile管理 | 管理能力、採用Revision、一覧・作成・更新・削除、保存結果 | ai-adapter内のProfile管理とCROS Owner Store。systemAdminから内容Accessを作らない。 |

能力ごとの関数・結果を用い、すべてを任意commandの汎用executeへまとめない。共通認可は既存Credential／Session／Exposure処理の合流を優先し、新たな権限Frameworkや永続Session DBを作らない。取消と待機後の結果・保存Effectは既存能力の意味を引き継ぎ、取消されたという通知だけで書込みEffect 0を主張しない。

### MCP操作の候補

| 操作候補 | 入力 | 適用・保持条件 |
|---|---|---|
| 既存crdd.list_projects／crdd.get_project_context | 既存Schemaを維持 | Portfolio表示に必要な結果の対応を確認。新Portfolio Toolを重複追加しない。 |
| 既存Topic／Meeting Tool群 | 既存Repository指定・操作Schema | Domain統合後も同じ能力へ接続。Transportの都合で安定IDを変えない。 |
| crdd.get_runtime_activity（新名称候補） | projectId、任意cursor、limit（既定20・最大50） | Project Context、Runtime State Query、Event一覧の意味を区別し、欠測・継続読込を保持。 |
| crdd.list_ai_profiles（新名称候補） | 一覧用入力 | CROS管理能力で検証。Token・Credential verifier・Host Pathは返さない。 |
| crdd.create_ai_profile／crdd.update_ai_profile／crdd.delete_ai_profile（新名称候補） | Profile操作、expectedRevision、必要な削除確認 | 既存Administrationの操作と確認条件を正確に搬送。任意Provider・実行Path・CLI引数の登録機能へ広げない。 |

Tool名はここでは提案値であり、既存Protocol値を無断変更しない。新操作はtools/list、Routing、入力検査、結果検査、Role別可視性とAuthorityの全対応を固定してから追加する。既存Profile Mutationを一つの汎用更新Toolへする案と上表を比較し、既存操作の意味と利用側可読性を保つ最小契約を選ぶ。

### 設定の分担案

| 設定単位 | 内容 | 保持場所・移行の境界 |
|---|---|---|
| CROS構成（cros.json候補） | revision、Repository RootとWorkspace公開範囲。検証後にRegistry／Exposureを生成する。 | 既存OS管理CROS Config Rootを基本とする。Repositoryに他Repositoryの管理構成を埋め込まない。Credential Storeとは別。 |
| MCP Server配置（mcp-server.json候補） | listenPort、共有配置のpublicOrigin、許可Origin等の必要なHTTP配置値 | 同じ共有Hostの運用Config Rootが候補。Repository単体stdio／localhost利用にこのFileを必須化しない。 |
| Workbench Remote接続 | 明示MCP Endpoint、接続・切断、CredentialのProcess内扱い | REST baseUrlとmcpBaseUrlの二重管理を廃止。自動接続先推定・Fallbackはしない。 |
| 配布する設定例 | CROS構成例、MCP配置例を見えるJSONとして提供 | template/toolsの現行規則へ照合し、実Fileを維持する。例はRuntime実設定ではない。 |

二Fileに分ける理由はCROSの公開Repository構成とMCPのHTTP配置のOwner・変更理由が異なるためであり、機能ごとの小Fileを大量に追加するためではない。最終名、JSON key、Rootと読取り順はArchitecture更新時に確定する。Front AIは旧shared-server.jsonを読んで非秘密構成を分け、Credential／Root検証・参照を確認して旧Fileを清掃する。Sourceに旧Schema読取りFallbackを作らない。

### TLS・Origin接続の最小案

共有Hostでは外部のTLS終端が/mcpだけを固定loopback MCP Listenerへ転送する構成を第一候補とする。REST RouteとCRDD固有Gatewayを置かない。Server間Machine ClientはBrowser Originを必須にはしないが、Origin付きRequestは現在の許可Originへ照合する。Forwarded値を無条件に信用せず、TLS終端で上書きされる配置条件とMCP側のHost／Origin検証を対応付ける。既定localhost Modeは現在の制限を維持する。

これはReverse Proxy製品選択、TLS鍵管理、自動Linux Deployまたは任意Network公開の実装許可ではない。外部TLS配置と実Hostの受入条件を確定できなければ共有起動の成立を主張しない。

### 本番接続で検出した欠落とOwner

現行非試験Sourceを調査すると、CrosRuntimeActivityReaderは型・依存・呼出しだけで、専用の本番具象Readerを確認できなかった。Workbenchのruntime-activity.tsにはRepository状態QueryとExecution Intelligence読取りがあるが、画面View Model・Git公開観測も同Fileに含む。そのままCROSへimportするとCROS → Workbenchの逆依存を作るため採用しない。

| 対象 | 是正案 | 確認方法 |
|---|---|---|
| Activity本番Reader | Orchestrator状態とExecution Intelligence記録の公開Queryを用いる具象接続をCROS能力組立てへ用意。Workbench表示変換はWorkbenchに残す。 | 正式MCP起動入口から実Repositoryの状態・記録を読み、欠測とCursor継続を確認する。 |
| Profile本番Store | 既存CROS Owner Profile Store／Administrationをai-adapterへ移管しMCPの管理能力へ接続。 | 正式入口から管理者のCRUDと非管理者拒否、Revision競合・保存失敗を確認する。 |
| 認可共通化 | Portfolio／Topic／Meeting／ActivityのRepository解決と、ProfileのsystemAdmin判定を適切に共有する。 | 同一ProcessとMCPで同じRole・Exposure条件を与え、非開示・拒否が一致することを確認する。 |
| 起動・終了 | MCP自身の一ListenerとRequest／Socket lifecycleへ必要な保証を対応付ける。 | 部分初期化失敗、切断・取消・終了要求、待機後の資源状態を観測する。 |

現在、人間の追加判断が必要な事項を新たに確定してはいない。上記は既存目的に沿った具体案であり、未確定Schema・TLS配置・操作名称は正本設計と独立確認で処置する。実装着手前には複数Ownerの着手前整合確認を更新し、旧能力の過去Evidenceとの全数対応を完了する。

## 23. 責務再編を完了させる計画

計画対象: CHG-000082内のv0.22責務再編・Architecture Closure。計画基準: Commit `3389345e`と、その後の§22の契約具体化案。状態: 計画作成済み、正本反映・Source移管未着手。本節の段階番号は既存CHG Phase番号を置換せず、今回の作業順を示す。

### 完了の意味と範囲

今回の完了は、了承された責務構成がArchitecture・Quality・Source・Test・設定・配布入口へ一致して伝播し、既存採用能力と必要な実境界の成立を確認できた状態とする。単なる移動完了、型検査Pass、旧経路の安全な拒否から全体完了を推定しない。完了後に人間がPR／統合／Releaseを判断できる状態へ渡すが、本計画だけでそれらの実行許可を推定しない。

対象は全18現行領域の内部配置照合と、16親フォルダを目標とする採用済み再編である。動かす必要がない領域は「維持＋理由」を対応表へ残し、件数を減らすために変更しない。主な変更は次のとおり。

- Domain Library／Project Operation／Runtime Dataをdomain-modelへ統合し、責務別Moduleへ整理する。
- ai-runtimeのProfile管理とCoordinator内のProvider固有実装をai-adapterへまとめる。
- Orchestrator → Coordinator → AI Adapterの依存と単体Coordinator利用を成立させる。
- Workbench／MCPをServer名称へ揃え、Browser APIを維持しCROS REST／Gateway／専用Shared Server入口を廃止する。
- Platform Accessは既存Native検査と実行物境界を保ち、名称・内部Moduleを整理する。
- Execution Intelligence、Version Controlと各呼出し側の責務・公開依存を整理する。

新しいAI機能、User Account、Trust Policy Framework、Event Bus、汎用Recovery Framework、Repository自動Deploy、Backup、汎用REST／Gatewayは対象外。Workbench UX／IAの新たな追込みも別の目的であり、今回の接続維持と画面非破損確認に混ぜない。

### 段階・成果物・通過条件

| 順序 | 作業 | 成果物・担当Owner | 次へ進む条件 |
|---|---|---|---|
| 1. 基準能力と影響範囲の固定 | 全18領域の公開能力、利用側、過去Evidence、現在Gapを棚卸し。全Fileを維持／改名／移動／分割／統合／廃止へ処置する。 | 本計画の対応表とCHG現在範囲。Fileを一次キーにし、分割時はSymbol／関数まで指定する。 | 採用能力に移管先または維持理由がある。未知Consumer・必須Gateに影響する未処置Gapを識別できる。 |
| 2. ARCH基本設計の更新 | ARCH Definitionsの責務・境界・主要Component・依存・Handoffを照合更新。REQ／UX／IA／UI／SPECへは不一致箇所だけ戻る。 | 06_Architecture/Definitionsと必要なAnalysis／Relation。 | 合意した責務・二入口・CROS共有配置の意味が正本へ反映。単なるFolder変更でARCH-IDを新設しない。 |
| 3. Details・配置・Qualityの具体化 | 各領域の公開API、内部File配置、保存Owner、起動・終了・取消、MCP操作、設定、Front AI移行を固定する。 | Architecture Details、Coding Standardsの必要差分、Quality Analysis／Definitions、Workflow・設定例の更新計画。 | 全File／Consumer対応、実装順、必須評価Checklist、失敗・欠測・後条件の検証義務が揃う。Sourceを先に正解にしない。 |
| 4. 設計の独立確認 | 固定設計を責務・依存／Capability保持、文書・直接伝播、不足・影響の観点で確認する。 | 独立レビューと適用監査、統合した是正表。 | 必須確認を全件完了し、是正後の固定版がPass。未処置事項を「担当あり」だけでPassにしない。 |
| 5. 依存順の実装・局所検証 | 下記の順序で本体・公開入口・試験・設定・Symbol・配布閉包を同時に移管する。 | 40_Develop、薄いtemplate/tools入口、関連正本。 | 各まとまりで型・整形・Lint・構造／Trace検査、正常・境界・失敗・取消の局所試験が成功。旧経路を残す互換Frameworkを作らない。 |
| 6. 全体回帰・現実照合・独立再レビュー | Portable／Host試験を分けて実行し、新構成の能力・Relation・公開入口・保存・終了条件を監査する。 | Quality／Reality Audit現在投影、必要な正式結果要約。 | 対象全回帰、Checker、宣言能力の本番接続、固定Source独立レビュー・必要監査がPass。実環境未評価は識別し、全体Passへ畳まない。 |
| 7. 固定候補の署名・実E2E | 署名前提を先に検査し、人間の外部端末で必要なCoordinator閉包だけ署名。最終候補の実経路を確認する。 | 署名Manifest、実境界結果とQualityのEvidence接続。 | 必須実E2Eと回収後条件が成立。失敗は一次原因を保持し、同じ不明状態で全E2Eを繰返さない。 |
| 8. 完了処置 | 旧参照・未接続・現在Gapの処置、文書・Reality Audit・CHG現在地、Front AI移行手順を確定する。 | CHGの完了判定、正本・品質現在値、変更Summary。 | 必須Gate未達0。残存事項は現在の採用範囲と影響を明示。人間の判断前に統合・Release済みと表示しない。 |

段階1〜3は内部棚卸しを並行してよいが、基本設計→詳細設計→検証義務の依存を維持する。全Fileの完了表は同じ文書内で更新し、実行ごとの巨大なEvidence書庫を増やさない。

### 実装順序

| 順序 | まとまり | 先行条件・保持する能力 |
|---|---|---|
| A | domain-model統合、Version Control公開境界の必要整理 | Root検証・Lock・設定・Artifact・Symbol・Topic／Meetingの意味を保持。基盤を先に作りConsumer移管へ接続する。 |
| B | ai-adapter（ProfileとProvider接続）、Platform Access内部整理 | Coordinator逆importなし。Codex／Claudeの実行入力・結果・認証・取消差、Native検査・Protocolを維持。独立可能な配置変更だけ先行できる。 |
| C | Coordinator共通実行、Orchestrator移管、実行記録 | 単体／上位経由の両経路、公開通知、取消・回収、state／history・Queue・判断・候補採否を接続。既存Docker回復縮小の残件をここへ対応付ける。 |
| D | CROS共通能力、MCP Server本番接続・共有配置 | Activity Reader／Profile Store、Role・Exposure、MCP HTTP／TLS配置、全能力一覧を接続。現行REST能力の置換を先に成立させる。 |
| E | Workbench ServerのLocal／Remote接続、REST／Gateway撤去 | 表示API・純粋CSR・画面意味を維持し、MCP経路と同一Process経路を確認後に旧実装・設定・入口を廃止する。 |
| F | 残る領域・全Consumer・配布側の締め | Checker、Semantic Coverage、Signing、Runner、Visual Preview、素材管理等を対応表どおり更新または維持。旧Package名・Path参照、型／値／子Process／設定／署名入力を全照合する。 |

途中のCommitは、局所確認と整合した設計・Source・試験を含む安全なまとまりで行う。中間Commitの存在を全体完成としない。Pushは人間の指定に従い、PR統合・Releaseは別の判断とする。

### 最終実境界の確認集合

- Coordinator単体の採用済みCodex／Claude実行・Review経路、必要な組合せ、取消・回収。
- OrchestratorのObjective→Task、状態照会、判断、候補生成・採否・再入場と、Coordinator接続。
- Workbenchの助言／候補、Local／RemoteのContext・Topic／Meeting・Activity・Profile操作、Role別拒否と秘密非開示。
- MCPのRepository単体stdio／HTTPと共有CROS接続、TLS／Origin／Exposure、切断・終了後の資源状態。
- 影響する実Windows Native保存・Process・ACL境界、署名閉包と公式CLIの実利用。
- Workbenchの構成・Asset・表示に影響した範囲の実Browser確認。全Visual Profileの再評価要否は変更した意味と既存義務から決め、コード移動だけで新画面を作らない。

対象経路を段階1で現在のQuality Local Itemと採用能力へ全数対応付け、固定集合として扱う。Provider送信は現在有効な許可境界を確認し、不足する承認だけ人間へ求める。Pass取得のためにモデル・Provider・Timeout・回復機構を場当たり的に変更しない。Linux配置が採用能力の必須実境界なら、その実環境確認が必要でありWindows試験で代替済みとしない。利用環境・Authority不足は明示して判断へ戻す。

### 既存Gap・失敗時の扱い

現在CHGに残るSnapshot本番Writer、Host終端接続、旧保存撤去、限定unknown終了、Graph停止、専用反例試験等を段階1で採用範囲と照合し、今回のOwner・試験へ対応付ける。既知Gapを名称変更で消さず、現在の必須義務と無関係な将来候補も自動吸収しない。Reality Auditの件数は再実行結果から更新し、未実行の旧数値を新構成の現在値にしない。

失敗時は最初の失敗境界を局所再現してから是正し、その意味から影響回帰を導出する。新しいState／Authority／保存場所／Consumerを追加する是正は設計へ戻し、必要な着手前照合と独立確認をやり直す。単なる反復でGateを増やさず、過去unknownの消去や未実施をPassにすることで収束させない。

完了計画に新しい日程を捏造しない。既存v0.22目標日2026-10-03は経過しており、現在の期限リスクを保持する。段階1〜3の対応量と実環境条件が確定した時点で所要見通しを提示する。現在の次の着手点は段階1の全File／Capability対応と、段階2のArchitecture正本照合である。

## 24. 段階1の基準母集団と着手前確認 — 2026-10-07

段階1は進行中である。基準Commit `463dd4a1ffd86e8bf5c58bb37a92e2ba11984621`の全18領域・830Fileを[ファイル棚卸し](261007_develop-file-inventory.md)へ固定した。各行は処置案であり、本文・関数単位の確認後に確定する。相対importで取得した312関係・173利用側は型／値、動的起動、設定・Manifest等の全Consumer集合を意味しない。

### 着手前整合確認

変更分類は責務・公開境界・保存・配布・移行をまたぐ非自明な再編である。Architecture、Quality、Coding Standards、Workflowと実装利用側を照合する。必要な確認は責務／依存とCapability保持の独立レビュー、文書・直接伝播監査、不足／影響監査である。準拠基準自体の変更は現時点で含まず、準拠監査を一律追加しない。Filesystem書込み範囲は現在Repositoryのみ。外部送信・Docker操作・署名・Releaseは今回の棚卸しでは行わない。

読み取り専用確認者は段階1の範囲を妥当としたが、完成後独立レビューPassではない。次の指摘を棚卸しへ取り込む。

| 確認対象 | 確認した現在の根拠 | 保持・追加する処置 |
|---|---|---|
| 回帰Runnerの分類 | verification-runnerのtest-catalogとregression-runner | Owner union、正規表現、changedPath分類、実行Root、engine、Host集合を新16領域へ接続する。importだけを更新して試験脱落を起こさない。 |
| Coordinator公開入口 | coordinator/src/index.tsは現在Project Runtime操作中心 | 単体実行、上位利用、bin、配布入口、private importを別に照合する。公開API追加だけを旧逆依存撤去済みとしない。 |
| CROS管理者回復 | credential-access-recovery本体・保存Adapter・CLI | administrator_recovery／full_access_reset、Host限定判断、stale計画、保存・記録失敗をREST撤去に巻き込まない。 |
| CROS契約能力 | runtime、tool-registryの公開Export | Context Package、Handoff／再開、Repository操作、AI計画、登録Toolを維持または理由付き内部限定へ処置する。試験Consumerしか確認できないものを本番接続済みとしない。 |
| 低頻度利用側 | 署名準備・対話署名・Manifest・Promotion・Graph・Trace・Nativeのscripts | 固定閉包、新Owner／Path、取消・再入場まで対応させる。通常実行だけで署名経路を閉じない。 |
| 過去四経路と回復 | [正式結果要約](261006_release-test-retention-phase4.md) | 四経路履歴、送信確認Timeout、模擬Provider回復と実Provider取消を分ける。欠ける署名Identityを推測補完しない。 |
| 現在品質の分母 | [Quality Center](../../../../07_Quality/01_Quality_Center.md) | 設計177 Local Item、移管46中13観測／33未観測、全体算定OPENを維持。過去176項目・Symbol616等を現在値として流用しない。 |

### 履歴から保持する保証と限界

- [Shared運用根拠](260928-1114_phase5-shared-server-production-boundary.md)はloopback、模擬TLS Header契約、Origin拒否と終了後資源までである。Internet／LAN、証明書運用、特定Reverse Proxy、Linux実配置を確認した根拠ではない。
- [Remote Context MCP根拠](260927-2029_phase4-remote-project-context-mcp.md)はProject Runtime Toolを意図的に公開しない構成を確認している。Activity／Profile追加時も許可Tool一覧、管理権限と内容Accessの分離、Requestごとの失効／Exposure再観測を保持する。
- PROJECT_CONTEXTの旧投影を現在Sourceの成立証明にしない。各Owner Evidenceの対象版・観測限界から現構成への適用を再評価する。

### 既存Gapの引継ぎ

| 残件 | 今回のOwner／順序 | 閉じるための根拠 |
|---|---|---|
| Snapshot本番Writerと最新現在状態保存 | Coordinator、C | 実Producerから保存・読戻し・再入場への接続。codec単体Passで代替しない。 |
| Host終端と旧保存撤去 | Coordinator／Platform Access、B・C | 本番経路から終端条件を作り、現在状態への反映と旧保存非使用を観測する。 |
| 限定unknown終了とDocker回復縮小 | Coordinator、C | 過去unknownを消さず、現在実資源・旧Owner再入場抑止と限定処置を検証する。汎用Recoveryを追加しない。 |
| 専用反例二件 | domain-model保存／Coordinator、A・C | 別Ownerの最初の候補ではEffect 0・領域なし、公開前保存失敗＋Lock解放失敗では最初のretry拒否をそれぞれ観測する。 |
| 全体Graph停止 | Coordinator／全Consumer、F・6 | 未結合子Processと必要な閉包を実接続へ照合し、Graph検査を再実行する。 |
| 公式CLI切替後の認証・取消 | AI Adapter／Coordinator、B・C・7 | 未改造公式実行物の実認証・取消・回収を確認する。旧専用Buildの結果を流用しない。 |
| V6署名・TTY・実子Process | Signing／Coordinator／Platform Access、F・7 | 前提一致した固定候補から外部対話端末・昇格・清掃まで確認する。 |
| Workbench候補・Reviewerの未完了 | Workbench Server／Orchestrator／Coordinator、C・E・7 | 採用済み候補操作・Reviewer経路の必要な実E2Eと最終状態を確認する。 |
| Activity／Profile本番未接続と共有MCP | CROS／MCP Server、D・E | 正式入口からReader／Storeへ到達し、Role・Exposure・Origin・取消・終了を確認する。 |

現在、人間の追加判断が必要な事項は確認していない。段階1の残りは、全Fileの本文・関数責務、非import利用側、能力と過去Evidenceの対応、必須実経路とQuality Local Itemの固定である。分母固定だけを段階1完了としてコミットしない。

## Checklist

- [x] 全18領域を一次対応表へ処置した。
- [x] 常駐性、責務、保存場所、意味Owner、Package境界を区別した。
- [x] Source／bin、scripts、testsの直接参照を分けた。
- [x] Workbench AI14FileとProject Runtime接続19Fileを対応させた。
- [x] 公開入口化だけの最小代替と、循環依存の反例を確認した。
- [x] 読取り専用着手前確認の結果を計画へ反映した。
- [x] 全18領域のPackage境界と親フォルダ名を再評価し、統合・改名・維持を区別した。
- [x] 統合後の用途別公開入口、技術基盤、保存Ownerと依存拡大の反例を説明した。
- [x] 追加の読み取り専用確認を反映し、新Package追加を分類だけで採用していない。
- [x] 最新の名称指定・名称候補・改名保留を区別し、旧推奨名と旧Port注入方針を置き換えた。
- [x] Orchestrator → Coordinatorの直接依存、単体利用、公開APIと登録ハンドラーによる通知の責務を記録した。
- [x] AI固有差をai-adapterへ分離し、Profile管理・共通実行・実行記録のOwnerを区別した。
- [x] 三領域のdomain-model統合と責務別構成を反映し、runtime-dataを共通置場として残さない。
- [x] CRUD・保存とGit確定・公開を分け、Root型移管による逆依存を避ける方針を記録した。
- [x] Nativeは既存検査を維持した内部整理とし、保存汎用化や即時移管を必須にしていない。
- [x] Profile管理をai-adapter内部へ統合する最新指定を反映した。
- [x] Shared Serverを共有配置として再評価し、二入口の目標とREST／Gateway撤去前の八観点を明記した。
- [x] Workbench内部API、Remote能力、認証・Origin・Lifecycleの保証を二入口化で消さない条件を記録した。
- [x] Shared周辺八観点のSource照合を記録し、実REST ConsumerとMCP未接続能力を識別した。
- [x] Shared周辺の一次File対応表と、配布入口におけるProfile／Activity未接続を記録した。
- [x] Browser表示APIとServer間Integrationを区別し、同一Process直接呼出し／別Process MCPの共通認可境界を記録した。
- [x] REST／Gatewayの廃止目標、関数単位の移管案、設定・配布・文書の対応と完成Gateを記録した。
- [x] 既存MCPのlocalhost制限を確認し、Gateway削除だけでは共有TLS配置が完成しないことを明示した。
- [x] 共通CROS能力、MCP操作候補、ツール単位設定と本番Reader／Storeの接続案を具体化した。
- [x] Activityの画面実装をCROSへそのまま移す逆依存を避け、調査で本番Readerを確認できなかった範囲を明記した。
- [x] 基本設計からSource・署名E2E・完了までの成果物、依存順、通過条件と現在Gapの扱いを計画した。
- [x] 未確定Owner・実行依存の未調査範囲をOPENとして明示した。
- [x] N/A: 本作業はDraft計画の記録のみ。Source回帰・署名・実E2Eは実行していない。
- [ ] OPEN: ファイル／関数単位の確定移管表、全Consumerと過去Capability Evidenceの照合は後続作業である。
- [ ] OPEN: Architecture採用・完成後独立レビューは未実施。Draft整合確認を完成レビューとして扱わない。
