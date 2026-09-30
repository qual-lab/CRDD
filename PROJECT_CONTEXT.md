# Project Context

Project ID: `qual-lab.crdd`
Repository ID: `qual-lab.crdd-standard`（v0.22で暫定採用）
Repository Role: `crdd-standard`

> この文書は、このRepository Roleが扱う範囲の現在投影である。
> 表示されていないContextまたはRepositoryの存在・不存在は、この文書から判断しない。

## 1. 今どうなっているか

### 結論

CRDDはv0.21.0を公開済みで、v0.22.0の実装・検証を進めている。v0.22.0の目標Release日は2026-10-03である。Project Contextは五つの代表場面を共通形式で回答する要求を採用し、試験した最小形式をRepository共通入口へ昇格している。署名候補のProject Runtime公開MCP実Provider E2Eは通常二経路・取消・exact Recovery・最終資源回収まで合格した。Workbench、必要な四経路および残る品質項目の確認を継続しており、全体合格とRelease判断は未成立である。

| 種別 | 項目 | 現在状態 | Owner Relation |
|---|---|---|---|
| 現在事実 | 公開Baseline | v0.21.0 | Git tag `v0.21.0`、Commit `e9947d4f733c3c46b90ee9f78c70898d1920bae9` |
| 現在事実 | v0.22.0 | 実装・検証進行中、目標Release日2026-10-03 | [Roadmap](99_Roadmap/01_Roadmap.md)、[CHG-000082](99_Roadmap/Changes/CHG-000082/change.md) |
| 現在事実 | Project Context | Repository投影、Manifest v2 Identity照合、Markdown／Codex確認、Repository単体MCPおよびCROS Credentialで絞ったRemote Project Context MCPが成立 | [REQ-000038](01_Discovery/Definitions/REQ-000038/requirement.md)、[Repository MCP検証](99_Roadmap/Changes/CHG-000082/Evidence/260927-2014_phase4-project-context-mcp.md)、[Remote MCP検証](99_Roadmap/Changes/CHG-000082/Evidence/260927-2029_phase4-remote-project-context-mcp.md) |
| 現在事実 | 情報入口 | Project ContextをOverviewとし、Topic、Meeting、Roadmap、Quality、DocumentationおよびRuntime Stateを各Ownerから読む能力地図を整理済み | [能力地図](01_Discovery/Analysis/EXP-000029/capability_map.md) |
| 現在事実 | Topic／Meeting操作 | Repository CRUD Coreと共通Applicationが成立し、WorkbenchおよびRepository単体MCPから登録・編集・Cursor一覧・取得・Relation影響付き削除を同じ契約で利用できる。同一Repository内ではOutcome表とAction移管表を同時更新し、全Outcome処置後だけMeetingを閉じられる。Remote CROSではRequestごとにCredential／Grant／Exposure／Bindingを再検証し、Workbenchが許可済みPortfolio Sourceを明示選択して同じ操作をMCP経由で行える。別RepositoryのRelationは同じSessionで許可された一意なOwnerへ遷移できるが、Relationを別Repository書込みAuthorityにはしない | [REQ-000039](01_Discovery/Definitions/REQ-000039/requirement.md)、[Remote Workbench検証](99_Roadmap/Changes/CHG-000082/Evidence/260928-0325_phase5-remote-workbench-topic-meeting.md) |
| 現在事実 | Workbench | Phase 4 Gateを通過しProduction Closureを進行中。表示基盤はReact＋Viteの純粋なClient-side Renderingへ移行し、全画面DOMのOwnerをBrowser Reactへ一本化した。Node Serverは固定Document Shell、JSON Read Model、認証・Authority、Repository Effectおよび固定Asset配信だけを所有し、SSR、Hydration、Raw HTML FragmentまたはDOM再読取りを行わない。JSONはCredential verifier、Remote接続Bearer、Private Key、Host Pathおよび永続Authorityを含まず、Process限定Action TokenとCredential操作直後の一回表示Tokenだけを用途限定Fieldで扱う。Current Release／Quality Projection、起点Section付きOwner Relation検索、Runtime ActivityのEvent／Remote投影、Topic／Meeting Collection／Detail／同一・Repository間Relation遷移／実在CHGへのTopic昇格、Remote CROSでの明示Repository選択とMCP読書き、Repository Tree／DiffおよびProject Portfolioの検索・20件単位継続読込・Source別五場面を構造化画面へ接続し、現在はCovered 13件、AI関連Partial 2件、Missing 0件である。CSR移行後の型・Lint・Build、統合試験19件および15画面のProduction DOMをDesktop／Tablet／Mobileと100%／200%／400%の27条件で実Browser再観測済みである。Visual Runnerは必須画面TargetのReact commit後に画像確定を待つ。終了要求直前に所有Process TreeをOS固有のexactな世代Identityで固定し、正常終了猶予後も残る子ProcessだけをGraphの深い順に限定処置する。Lifecycle局所ITでFallback実発行、最終Tree 0、Identity不一致／未検証時のEffect 0およびcleanup前段失敗後の後続段実行・Error集約を確認し、Production Workbenchの27条件も終了処理最大1589ms・Tree観測最大668ms・Fallback 0回で全件成功した。独立レビュー、文書監査およびGap／Impact監査はFinding 0で完了した。AI依頼は読取り助言／変更候補を明示し、Coordinator Mode Routerが別Executorへの配送・観測・取消と根拠参照付き結果の実行時検証を保持する。Repository単体Production CLIは検証済みRootの`PROJECT_CONTEXT.md`を内容Hash付き専用Task PacketへEffect 0で固定し、採用済みCatalogの同一改訂から選択ProfileのAdapter、Model、Reasoningを解決する。一依頼の外部送信確認、Provider別固定Adapter、Repository非共有Command Plan、Provider出力抽出、Executor Core、一回消費Packet、`workbench_advice` Docker Modeおよび変更候補Executorまで成立した。変更候補はStoreから再読取りしたMetadataの確認、操作ごとの明示確認、Project Runtime Lease、Revision・dirty・Scope再観測、Receiptと耐久記録を通る別操作で採用または破棄できる。採用してもCommit／Pushは行わない。Shared Serverは固定OS設定、検証済みRepository／Workspace Exposure、REST／MCP同一HTTPS Origin、外部TLS終端契約、Host限定Credential回復および終了後資源0まで成立した。未完了は実Provider E2EとAI関連2画面のClosureである | [CHG-000082](99_Roadmap/Changes/CHG-000082/change.md)、[純粋CSR移行](99_Roadmap/Changes/CHG-000082/Evidence/260928-1745_phase5-workbench-pure-csr.md)、[Shared Server運用境界](99_Roadmap/Changes/CHG-000082/Evidence/260928-1114_phase5-shared-server-production-boundary.md) |
| 現在事実 | 品質 | v0.22対象46 Local Itemのうち11件を観測済み、起動時Tool制限を含む35件を未観測として保持。全体Quality Readyは未成立 | [Quality Center](07_Quality/01_Quality_Center.md) |

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

Workbenchの新モデル移行では、起動時のTool許可集合を固定する最小Adapterの追加が承認された。助言用の操作禁止を維持し、局所反証と独立レビュー後に再署名・実Provider E2Eへ進む。6.1 Sol標準／6 Luna軽量用途へのモデル方針も承認済みである。現在の実装継続に追加の人間判断は不要であり、この承認をRelease承認とは扱わない。Repository IDの正式固定は、Project Context契約の固定時に改めて人間が判断する。

| 判断 | 判断する人 | 選択肢・影響 | Owner Relation |
|---|---|---|---|
| なし（最小起動Adapter追加を承認済み） | Qual-Lab | 専用実行物の構築・配布・保守を含めて実装を継続する。禁止Toolの実行前拒否、局所反証、独立レビュー、再署名と実Provider E2Eが未完了であり、承認だけから利用可能またはRelease可能とは表示しない | [CHG-000082](99_Roadmap/Changes/CHG-000082/change.md)、[移行の着手前確認](99_Roadmap/Changes/CHG-000082/Evidence/260930-1853_codex-model-host-migration-preflight.md) |
| なし（確認済み） | Qual-Lab | v0.22はRepository内＋Project横断＋AI利用構成を扱い、Workbench要求も採用済み。Discovery整理を閉じて次工程へ進める | [Scope探索](01_Discovery/Analysis/EXP-000034/exploration.md)、[REQ-000040](01_Discovery/Definitions/REQ-000040/requirement.md) |
| CRDD標準RepositoryのRepository IDを正式固定するか | Qual-Lab | 現在判断ではない。v0.22では`qual-lab.crdd-standard`を暫定採用し、Project Context契約固定時に維持または変更を判断する | [REQ-000038](01_Discovery/Definitions/REQ-000038/requirement.md)、[Runtime Data Architecture](06_Architecture/Details/runtime-data/01_Architecture.md#5-configとrepository-identity) |
| なし（確認済み） | Qual-Lab | WorkbenchはDirection Aを採用し、公式CRDDロゴとNoto Sans CJK系Fontを使う | [Visual Baseline](04_UI/Details/Visual/workbench-hero/visual-baseline.md)、[CHG-000081](99_Roadmap/Changes/CHG-000081/change.md) |

## 4. なぜこの状態・判断になったか

### 結論

Workbenchを先に作るのではなく、どのConsumerでも同じProject理解へ到達できる交換契約を先に成立させると確認したため、Project Context Projectionを優先している。

| 現在の結論 | 理由 | Owner Relation |
|---|---|---|
| Project Context Projectionを第一段階とする | AIや媒体ごとの再探索と回答差を先に解消するため | [EXP-000029](01_Discovery/Analysis/EXP-000029/exploration.md)、[REQ-000038](01_Discovery/Definitions/REQ-000038/requirement.md) |
| WorkbenchはDirection Aと15 Screen ArchitectureからProduction化する | Project Contextだけでは日常操作とVersion Controlを一つの仕事として扱えず、Screen Inventory、Hero探索、Secondary展開と人間判断を経て具体化したため | [UI Detail](04_UI/Details/01_UI_Detail.md)、[CHG-000081](99_Roadmap/Changes/CHG-000081/change.md)、[CHG-000082](99_Roadmap/Changes/CHG-000082/change.md) |
| Deadlineは任意だが開始時に確認する | 未設定と確認漏れを区別し、設定済み期限をRisk分析へ使うため | [EXP-000031](01_Discovery/Analysis/EXP-000031/exploration.md)、[REQ-000037](01_Discovery/Definitions/REQ-000037/requirement.md) |
| UI／SPEC Detail契約はv0.21成果物へ伝播済み | v0.22固有設計前に既存Canonical Chainを閉じるため | [CHG-000081](99_Roadmap/Changes/CHG-000081/change.md) |

## 5. 次に何をすべきか

### 保存済みの次候補

| 候補 | 理由・成立条件 | Owner Relation |
|---|---|---|
| 残る品質項目を設計・実装・実測へ照合する | REQ-000037〜041の設計伝播を完了した後も、Relationだけを成立Evidenceとして扱わず、各検証義務を実際の観測へ接続する必要があるため | [Quality Center](07_Quality/01_Quality_Center.md)、[Discovery台帳](01_Discovery/01_Product_Discovery.md) |
| Workbenchの実Provider E2Eと残る画面Closureを行う | 15画面の実Browser Visual Gate、読取り助言／変更候補のProduction Runtimeおよび候補の別採否操作は成立した。残るAI関連Partial 2画面を実Codex／Claudeと最終Production Closureで再評価するため | [CHG-000082](99_Roadmap/Changes/CHG-000082/change.md)、[実Browser Visual Gate](99_Roadmap/Changes/CHG-000082/Evidence/260928-1028_phase5-workbench-actual-browser-visual.md) |
| 次工程Gateでv0.22.0の日程Riskを再評価する | Scopeは確認済みだが、2026-10-03までの残作業と検証費用は工程進行に合わせて更新する必要があるため | [Roadmap](99_Roadmap/01_Roadmap.md)、[REQ-000037](01_Discovery/Definitions/REQ-000037/requirement.md) |
| 現状の全体検証後にWorkbenchのUX／IAを見直す | 人間が表示スペース、情報の見せ方および作業導線の深掘り不足を懸念している。まず現状の局所試験・必要な署名E2E・全回帰・独立レビューを一区切りとし、その後に認識合わせを行う。機械検証の合格を使いやすさの成立へ読み替えない | [検証と見直しの順序](99_Roadmap/Changes/CHG-000082/change.md#現在の検証と次のworkbench見直しの順序) |

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
