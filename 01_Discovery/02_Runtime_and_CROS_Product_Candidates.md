# Runtime／CROS Product Candidates

Status: Discovery Candidate Context
Owner: Qual-Lab
Last Updated: 2026-09-13
Related:
- [CRDD標準自身の課題探索・要求形成](01_CRDD_Product_Discovery.md)
- [Product Roadmap](../99_Roadmap/01_Roadmap.md)
- [自律Operation](../05_Autonomous_Operation.md)

---

> 本書は、v0.21以降に検証するRuntime／CROS候補の利用者課題、価値、採用境界を所有する。版、状態、次のGateはRoadmapが所有し、確定したSchema、Path、実装順序またはArchitectureを先取りしない。

## 1. 候補の関係

```text
CRDDの正本
    ↓
Project運営の投影・Attention・Communication昇格
    ↓
Repository／Tool／Runtime Dataの構造化
    ↓
CROSによる複数RepositoryのContext解決
    ↓
認証・認可されたRemote MCPと限定Operation

横断基盤:
  利用者所有Trust Policy
  AI Runtime Registry
  構造化されたTS API／CLI／Result
```

## 2. Project Operation／Project Management Projection

Project Operation Contextは、Project、Commercial、Topic、Meetingおよび既存CRDD正本を、Project運営に必要なViewへ接続する候補である。JIRA、Notion、Excel WBS等をCRDD内へ再実装せず、Projectionを正本、更新StoreまたはWorkbench専用Databaseにしない。

```text
CRDDの正本
  ↓
Project Management Projection
  ├ WBS／Milestone／Dependency
  ├ Kanban／Progress／Blocker
  ├ Risk／Issue／Active Topic
  ├ Decision Required／Recent Meeting
  └ Forecast／Release Readiness／AI Summary
```

| 観点 | 保持する境界 |
|---|---|
| 正本 | ViewごとにProject Stateを複製しない。操作は正本の変更候補を作り、Context照合とAuthorityを経て更新・再投影する |
| Identity | Project ID、Repository ID、Repository Binding IDを分け、一つの論理Projectへ複数Repositoryを接続できるようにする |
| 推定 | Task完了率、AI推定または単一表示だけでProject健全性、進捗、予測またはRelease可能性を確定しない |
| WBS | Project WBSとChange WBSを同じ関係から異なる深さで表示し、WBS自体をCanonical Entityにしない |
| Property | ID、状態、Owner、Priority、Milestone、Dependency、完了条件、進捗根拠を全成果物へ一律複製せず、所有正本を先に定める |
| 欠測 | `missing`、`restricted`、`conflicting`および`stale`を空値、正常または0へ畳まない |
| 操作 | Projectionを直接更新せず、対象正本が所有するCommandまたは変更候補へ戻す |
| 未確定 | WBS、Risk、Issue、Dashboard専用の正本Directoryを先に作らない |

採否判断では、既存文書から投影できる範囲、追加Propertyの正本、Dependencyによる順序導出、複数AIとの共用、外部PM Toolなしで不足する情報、およびViewから正本へ戻すAuthorityを代表ケースで検証する。

<a id="v021-project-operation-discovery"></a>

### 2.1. v0.21 Project Operation／Workbench Discovery

#### 起点と根拠の強さ

事前の設計対話は、解決策候補と利用仮説を具体化する有力な入力である。ただし、利用者全般の行動を観測した証拠またはWorkbenchの有効性を示す実測としては扱わない。現時点の根拠を次のように分ける。

| 種別 | 確認できたこと | 根拠・限界 |
|---|---|---|
| 観測 | CRDDの自己適用では、停止後の追加確認、親による補正および複数成果物の探索が発生した | [CHG-000055](../99_Roadmap/Changes/CHG-000055/change.md)に記録された実行事象。主にCRDD保守者一名の運用であり一般化しない |
| 観測 | v0.20は実行中Task、停止理由、判断待ち、Recovery義務等を同じ意味から読むProject State投影を成立させた | [v0.20 Project Stateの読み取り専用投影](01_CRDD_Product_Discovery.md#13-v020-project-stateの読み取り専用投影)。Project運営全体やWorkbenchの価値は未検証 |
| 構造測定 | 固定改訂版`92d4fe0fd9aa`にはMarkdown 441件、Change 33件、Change配下Evidence 319件があり、状態や根拠が複数正本へ分散する | Repository inventoryによる局所測定。件数だけでは探索時間、誤判断またはWorkbench必要性を証明しない |
| 人間判断 | Repository単独作業を維持し、Project横断時だけCROS／Workbenchを使う方向と、最小Workbenchをv0.21で試す範囲が採用された | 採用範囲を定めるAuthorityであり、利用価値の成立証拠ではない |
| 仮説 | PMは複数Repositoryの欠測や古さを見落とし得る。Managementは根拠付きPortfolioを必要とし得る | 外部PM／Managementによる利用観測はない。代表利用者仮説として検証する |
| 仮説 | MeetingからTopic／Decision候補へ進む定型導線は転記漏れと状態混同を減らす | 実Meeting運用との比較は未実施 |
| 仮説 | 内部TaskやAgent Logを追う必要が、進行、品質および判断待ちの理解を難しくする | [利用者体験](../02_UX/01_User_Experience.md#7-立場に応じてprojectへ入る利用体験)にある設計仮説。観測済みの操作から認知上の因果を確定しない |

#### 対象者、状況および対象外

| 優先 | 対象者・状況 | 現在の代替 | 確認する課題 | 期待結果候補 |
|---|---|---|---|---|
| 1 | CRDD保守者／Project Operatorが現在地と次の判断を確認する | Markdown、Git、Agent対話、Checker結果を個別に辿る | 状態・品質・判断・根拠の探索負担と、古い情報の混入 | 出典と観測時点を保った一つのProject Viewから正本へ戻れる |
| 2 | Developerが一つのRepositoryで作業する | 対象RepositoryとCoding Agent | 横断機能のために日常作業が複雑化しないか | CROSの内部構造を知らず、現在のRepository中心作業を継続できる |
| 3 | PMが一つの論理Projectを複数Repository越しに確認する | Repositoryごとの文書、会議記録、Roadmap、品質を手作業で照合 | 欠測・Restricted・Stale・Conflictを完全状態と誤認しないか | Source Coverage付きViewから判断対象と所有正本へ辿れる |
| 4 | Managementが複数Projectを比較する | PMの集計、表計算、口頭報告 | 要約だけで根拠と未確認範囲を失わないか | 許可された範囲だけの読み取り専用Portfolioから根拠Projectへ進める |
| 5 | Meeting後に継続論点を整理する担当者 | 議事録から正本へ手作業で転記 | 時点付き記録、継続論点、採用済み判断が混ざらないか | 候補作成、確認、採用、再投影を区別できる |

優先1をv0.21の自己適用対象とする。優先3～5は代表シナリオとして契約を壊さない範囲で確認するが、単一の自己適用から一般的なPM／Management需要を確定しない。個人評価、従業員監視、精密な進捗率、人事・会計管理およびRepository権限を迂回する要約は対象外とする。

#### 課題・根拠・機会

<a id="project-operation-problem-evidence-opportunity"></a>

| Metadata | 内容 |
|---|---|
| 対象 | v0.21 Project Operation／Workbench候補 |
| 目的 | 観測、課題および解決機会を混同せず、比較対象を確認する |
| 根拠 | 固定改訂版`92d4fe0fd9aa`、CHG-000055、v0.20 Project State、2026-09-13の人間判断 |
| 現在状態 | `Candidate` |
| 略語 | なし |
| 未確認 | 外部PM／Management需要、認知負担の因果、各代替の実測効果 |

```text
┌────────────────────────────────────────────────────────────┐
│ 観測                                                       │
│ 正本、実行状態、品質、判断、履歴が異なる場所に存在する     │
└─────────────────────────┬──────────────────────────────────┘
                          ▼
┌────────────────────────────────────────────────────────────┐
│ 課題                                                       │
│ 現在地を組み立てる負担と、欠測・古さを見落とす危険がある   │
└───────────────┬──────────────────────────────┬─────────────┘
                │                              │
                ▼                              ▼
     ┌────────────────────┐        ┌────────────────────────┐
     │ 機会A              │        │ 機会B                  │
     │ 正本を構造化して   │        │ Source Coverage付きの │
     │ AI／MCPから直接読む│        │ 薄い人間向け投影      │
     └──────────┬─────────┘        └───────────┬────────────┘
                └──────────────┬───────────────┘
                               ▼
                    比較実測で必要性を判断
```

機会Aと機会Bは排他的ではない。Workbenchを作ること自体を課題または要求にせず、既存のAI／MCPだけで成果が得られる場合は、その経路を保持する。

#### Actor別の現行作業

<a id="project-operation-actor-process"></a>

| Metadata | 内容 |
|---|---|
| 対象 | CRDD保守者／Project Operatorの現在地確認 |
| 目的 | 現行の活動、受け渡し、追加確認および戻りを示す |
| 根拠 | CHG-000055と固定改訂版`92d4fe0fd9aa`時点のRepository構造 |
| 現在状態 | `Current` |
| 略語 | なし |
| 未確認 | 複数Repository利用時の追加工程、役割別の差、所要時間 |

```text
時間: 上から下

<<A1: Project Operator>>     <<A2: Repository／CRDD>>       <<A3: AI／Tool>>
            │                            │                           │
 [P1: 現在地を質問] ────── 質問 ───────────────────────────> [P2: 探索を開始]
            │                            │                           │
            │                [P3: 複数正本を提示] <── 探索要求 ─────┤
            │                            └── 正本 + 改訂版 ────────> [P4: 状態を再構成]
            │                            │                           │
            │                            │                 {D1: 根拠は十分?}
            │                            │                    │No        │Yes
            │                            │                    v          v
 [P6: 情報・判断を提供] <── 不足内容 ─────────────── [!X1: 追加質問]  [P8: 結果を提示]
            └── 追加情報 ────────────────────────────────> [P4: 状態を再構成]へ戻る
            │                            │                               │
 [P5: 出典・現行性を確認] <── 状態 + 出典 ─────────────────────────────┘
            │                            │
 {D2: 追加情報が必要?}                   │
      │Yes         │No                  │
      v             v                   │
 [P6: 情報・判断を提供]   [P7: 判断対象へ進む]
      └── 追加情報 ──────────────────────────────────────> [P4: 状態を再構成]へ戻る
```

複数Repositoryでは、各Repositoryの利用可否と改訂版確認が同じ探索の前段に増える。現在の処理時間、待機時間、再探索回数および誤判断率は未測定であり、Value Stream上の数値を補完しない。

#### 業務範囲と入出力

<a id="project-operation-sipoc"></a>

| Metadata | 内容 |
|---|---|
| 対象 | Project／Portfolio確認とMeeting後候補整理の境界 |
| 目的 | Supplier、Input、Process、Output、Customerと範囲外を固定する |
| 根拠 | 固定改訂版`92d4fe0fd9aa`と2026-09-13の採用判断 |
| 現在状態 | `Candidate` |
| 略語 | SIPOC = Supplier／Input／Process／Output／Customer |
| 未確認 | 実利用時の入力不足、外部Tool連携、役割別Output差 |

| Supplier | Input | Process Scope | Output | Customer |
|---|---|---|---|---|
| Repositoryの各正本、Runtime、Quality、Git | 現在状態、関係、Source Revision、利用可能性 | Projectを選ぶ → Sourceを解決する → 不完全性を保って投影する → 判断対象または正本へ案内する | Source-aware Project View、判断待ち、正本導線 | Project Operator、Developer、PM |
| 複数Projectの許可済み投影 | Projectごとの限定状態とSource Coverage | Project集合を解決する → 比較可能な最小状態へ投影する → 根拠Projectへ案内する | 読み取り専用Portfolio View | Portfolioを確認する担当者 |
| Meeting記録と既存Topic／Decision | 時点付き記録、関連Identity、未確定候補 | 候補を抽出する → 既存Contextと照合する → 人間確認へ渡す | Topic／Decision更新候補または非昇格結果 | Meeting参加者、成果物所有者 |

範囲外は、正本の直接更新、Repository Accessの付与、Project健全性の自動確定、会議内容の自動採用および一般的なProject管理Databaseである。

#### 処理・待機・手戻りの測定枠

<a id="project-operation-value-stream"></a>

| Metadata | 内容 |
|---|---|
| 対象 | CRDD保守者／Project Operatorの現在地確認 |
| 目的 | 処理、待機、再探索および手戻りの測定位置を固定する |
| 根拠 | CHG-000055と固定改訂版`92d4fe0fd9aa`時点の現行作業 |
| 現在状態 | `Current`の処理に対する測定枠 |
| 略語 | `P` = Activity、`D` = Decision、`X` = Rework／Exception |
| 未確認 | 処理時間、待機時間、Queue、再探索回数、誤判断率、比較Baseline |

```text
((S: 現在地確認を開始))
  │
  ▼
[P1: 対象Projectを特定] ── 処理時間: unknown ──>
  │
  ▼
[P2: Sourceを列挙・利用可否を確認]
  │  ... Queue／再認証待ち: unknown ...>
  ▼
[P3: 状態と根拠を再構成] ── 処理時間: unknown ──>
  │
  ▼
{D1: 欠測・競合・古さを判断できる?}
  ├── No ──> [!X1: 追加探索／確認待ち]
  │                    │  手戻り回数・待機時間: unknown
  │                    └── 追加Source ──> [P2]
  │
  └── Yes ──> [P4: 判断対象または正本へ到達]
                       │
                       ▼
              ((E: 判断／候補操作へ引渡し))
```

自己適用では、A（AI／MCP）、B（静的Report）およびC（薄いWorkbench）について、少なくとも判断対象への到達可否、出典確認の成否、欠測の識別、再探索回数および操作迷いを同じ代表課題で比較する。経過時間は環境差が大きいため単独の採否指標にせず、人間の実作業時間とAI／Tool処理時間を分ける。

#### As-Is／To-Be候補

<a id="project-operation-as-is-to-be"></a>

| Metadata | 内容 |
|---|---|
| 対象 | Project Operation／Workbench候補 |
| 目的 | 現行作業と候補状態の保持・追加・除去を比較する |
| 根拠 | 現行はCHG-000055と固定改訂版`92d4fe0fd9aa`、候補は2026-09-13の採用判断 |
| 現在状態 | As-Is = `Current`、To-Be = `Candidate` |
| 略語 | なし |
| 未確認 | 候補状態による利用者成果、実Clientの操作、複数Repositoryでの効果 |

```text
As-Is
質問
  ↓
Repository／文書／実行結果を個別探索
  ↓
人間またはAIが現在状態を都度再構成
  ↓
出典・欠測・現行性を追加確認
  ↓
判断または操作

To-Be候補
質問またはProject選択
  ↓
同じ公開契約からProject Viewを解決
  ↓
状態 + Source Coverage + 観測時点を同時表示
  ↓
正本または既存Command／Candidate入口へ移動
  ↓
更新後に再投影
```

保持するものは、Repository単独作業、正本の所有権、AIへの直接質問および明示Authorityである。追加候補はSource-awareな投影と定型導線、除去候補は人間による情報コピーとWorkbench専用状態である。

#### 解決策候補の比較

| 候補 | 構造上の評価 | 未実測の評価 | 確信度 | v0.21判断 |
|---|---|---|---|---|
| A. ChatGPT／Coding Agent＋MCPだけを使う | 同じ公開契約を使えば正本を複製しない | 操作Cost、欠測理解、横断利用の有効性 | 中 | 比較基準として維持 |
| B. 静的なProject Report／Indexを生成する | 生成時点とSourceを保持できるが、派生物の現行性管理が増える | 日常導入Cost、再生成頻度 | 中 | 代替として実測対象 |
| C. 既存正本を解決する薄いWorkbench | 専用Storeを持たず、Source Coverageを同じ結果から表示できる | 理解時間、操作迷い、維持Cost | 中 | v0.21の限定実装として採用 |
| D. 独立Project管理Databaseを作る | 既存CRDD正本と競合するOwnerを新設する | 横断管理の便益 | 高 | 不採用 |
| E. 各Repositoryの要約を中央へ複製する | Source Revision、撤回およびAccess境界の同期責務が増える | 要約の利用価値 | 高 | 不採用 |

Cの採用はAを廃止する判断ではない。表の「構造上の評価」は現在の契約から導いた設計判断、「未実測の評価」は自己適用で確認する仮説である。CはA／Bより、現在地理解、欠測認識および正本到達を実測上改善でき、かつ専用状態や権限迂回を作らない場合だけ拡張する。Aが同等以上の成果を低い運用Costで達成する場合はWorkbench機能を増やさず、Bが同等の成果をより単純に達成する場合は常設UIを必要最小限へ縮小する。

#### 要求候補と検証意図

| 要求候補 | 人間判断 | 検証意図 |
|---|---|---|
| Repository単独作業はCROS／Workbenchなしでも成立する | 採用済み | 横断機能の未設定が既存Repository作業を停止させない |
| Project ViewはPropertyごとのSource、改訂版／観測時点、欠測状態を保持する | 採用済み | 部分情報を完全状態へ畳む反例を拒否する |
| Workbenchは公開Application Contractだけを使う薄いSurfaceとする | 採用済み | UI専用Store、Filesystem直接更新、独自Authority判断が0である |
| Topic／Meeting操作は候補または所有正本のCommandへ戻す | 採用済み | 投影の直接更新と、Meetingからの自動採用を拒否する |
| Portfolioは読み取り専用かつSource-awareな最小投影に限る | 採用済み・価値未検証 | RestrictedなProjectの存在・件数・内容を漏らさず、不完全性を表示する |
| WorkbenchがA／Bより利用者成果を改善する | 検証待ち | 同じ代表課題で、判断対象到達、出典確認、欠測認識、迷い・再探索を比較する |

新しい安定`REQ-*`は、本Discoveryで既存採用判断を別Identityへ複製しない。上表をCHG-000067の採用範囲と完成条件へ対応付け、UX以降で利用者成果と契約を具体化する。

#### 第1次探索の状態

| 項目 | 状態 | 未確認範囲・次の処置 |
|---|---|---|
| 起点、来歴、事実／仮説分離 | `Complete for Scope` | 外部利用者一般への妥当性は主張しない |
| 対象者・利用状況 | `Complete for Scope` | PM／Managementは代表仮説。自己適用後に再評価する |
| 課題・機会・代替比較 | `Complete for Scope` | A／B／Cの比較測定値はVerificationで取得する |
| 要求候補・対象外・検証意図 | `Complete for Scope` | UXで利用者成果、IAで情報責務、UI／SPECで表示・操作を具体化する |
| 業務Process View | `Complete for Scope` | 対象・目的・根拠・状態・未確認範囲付きでSIPOC、Actor別Process、As-Is／To-Be、測定枠を作成。時間値は実測時に更新する |
| Project Operation／Workbenchの第1次探索 | `Complete for Scope` | Project運営上の課題、代替および薄いWorkbenchの反証条件まで確認した |
| Workbench／MCP共同利用体系 | `Complete for Scope` | 次節で現行実装、利用者入口、公開能力、Remote接続および再接続まで探索し、独立レビューPass |
| Discovery全体 | `Complete for Scope` | Workbench／MCP共同探索の人間理解確認とUX移行は2026-09-13に完了 |

<a id="v021-workbench-mcp-joint-discovery"></a>

### 2.2. Workbench／MCP共同Discovery

#### 探索の問いと現行Evidence

本節は、Workbenchを単独の画面候補として評価せず、MCPを含む複数の入口が同じProject Operation／CROS能力を利用する体系として再探索する。事前対話と下流の候補設計は有力な解決策仮説として参照するが、利用価値、公開能力の十分性またはRemote運用の成立証拠にはしない。

| 問い | 現在確認できること | 未確認 |
|---|---|---|
| 誰が何のために使うか | Repository内作業、Project横断確認、人間判断、正本到達という異なるJobがある | 外部利用者の頻度、優先順位、支払意思 |
| 既存MCPで足りるか | 実装済みはObjective実行、判断送信、単一Project State取得の3操作 | Project発見、Source Coverage、Portfolio、Topic／Meeting候補およびCapability操作 |
| Workbenchが必要か | 人間向けに状態、欠測、出典および定型操作を同時に見せる仮説がある | ChatGPT／Coding Agent＋MCPや静的Reportに対する実測上の優位 |
| Remote MCPとは何か | 現行HTTPは`127.0.0.1`限定でBearer tokenを使う | 別Hostからの暗号化接続、Credential、Workspace Grant、切断後の継続 |
| 同じ契約を共用できるか | MCPはProject Runtime公開契約へ搬送するTransportとして分離済み | Workbench／CROSに必要な新能力のOwnerと全Consumer Closure |

この棚卸しは2026-09-13時点の[`project-runtime-protocol.ts`](../40_Develop/mcp/src/protocol/project-runtime-protocol.ts)、[公開MCP Launcher](../template/tools/crdd-mcp.ts)、[MCP Transport Architecture](../06_Architecture/mcp/01_Architecture.md)および[MCP Server Workflow](../19_Workflows/04_MCP_Server.md)を照合した。候補文書に存在する設計を、現行Capabilityへ数えない。

#### 人間理解の確認

2026-09-13、人間の決定権限者は、既存ContextをAIが再構成して文書化できたことと、人間の問題認識まで一致したことが同一視されていたというProcess上の不足を示した。同時に、次の理解を現在FeatureのDiscovery入力として明示したため、Discovery全体を作り直さず、この確認結果をUXへ渡す。

| 確認対象 | 人間が明示した理解 | 後続への反映 |
|---|---|---|
| Workbenchの主課題 | CRDD／CROSの状態確認や定型操作のために、複数ToolまたはRepositoryを直接辿る負担を減らす | UXで確認・定型操作の体験を比較し、Git表示や個別機能をDiscoveryで固定しない |
| Remote MCPの主目的 | Remote接続自体ではなく、複数Repositoryへ分散したProject Contextへ利用者が安全に到達する | UXでProject単位の利用と欠測・Access・応答喪失を扱い、Transport方式はArchitectureへ渡す |
| Repository単独利用 | Developerの日常作業は単一Repository中心を維持し、CROS／Workbenchは主にProject横断・確認用途へ追加する | Local利用へServer、WorkspaceまたはFederation理解を要求しない |
| 工程境界 | DiscoveryはWhy／Problem／Need／Goal、UXは利用者がどう仕事できるかを所有する | Flow、操作、Navigationおよび画面構成をDiscoveryへ逆流させない |

この人間理解の確認は、要求候補の採用、Workbenchの比較価値成立またはUX工程移行レビューを代替しない。今後、AIが重要な課題、必要性、成果または対象外を新たに再構成した場合は、現在理解を人間へ返して差を確認する。

#### 方向性の評価

| 方向 | 判定 | 理由・必要な補正 |
|---|---|---|
| Workbenchを薄い人間向けSurfaceにする | 維持 | 第二正本、独自AuthorityおよびUI専用業務ロジックを避けられる。利用価値は比較実測まで未成立 |
| MCPをAI／外部Tool向けTransportにする | 維持 | MCP固有SchemaにProjectの意味を所有させず、stdio／HTTP以外の入口とも共用できる |
| Workbenchも常にMCP経由にする | 不採用 | Local Workbenchは同一ProcessのTS API／公開Application Contractを直接利用できる。Remote時だけTransport Adapterを選ぶ |
| MCPのTool追加を先に決める | 不採用 | 利用者Jobから公開Application Capabilityを固定し、そのConsumerとしてMCP Toolを投影する |
| Remote MCPをlocalhost HTTPのbind変更で作る | 不採用 | 暗号化、Credential、Workspace Grant、情報最小化、切断／再取得を含む別の利用境界である |
| Project／Portfolio情報を中央Storeへ複製する | 不採用 | Repository正本、改訂版、撤回およびAccess境界と競合する。CROSはSource-awareな派生投影を作る |

方向性は「一つのProject Operation／CROS公開Application Contractを、Local API、CLI、MCPおよびWorkbenchから利用する」で維持する。ただし、WorkbenchとMCPは同一Componentではなく、同じ意味契約を異なる利用者へ投影する別Consumerである。

#### 利用者と入口

| Actor／利用状況 | 既定入口 | 必要な結果 | 避ける負担 |
|---|---|---|---|
| Developerが一つのRepositoryで作業 | Repository＋Coding Agent／CLI | 現在RepositoryのContextと実行結果 | CROS Server、WorkspaceまたはPortfolioの設定を必須にしない |
| Project OperatorがLocalで現在地を確認 | Personal CROS＋Local WorkbenchまたはChat Agent＋stdio／localhost MCP | Project View、Source Coverage、判断待ち、正本導線 | 内部Task logと複数正本の手動照合 |
| PMが複数Repositoryを横断 | Personal／Shared CROS＋WorkbenchまたはMCP | 許可されたProject全体と不足Source | Repositoryごとの開き直しと完全状態の誤認 |
| Managementが複数Projectを比較 | Shared CROS＋WorkbenchまたはMCP | 根拠へ戻れる最小Portfolio | Restricted情報の漏えいと根拠のない要約 |
| Chat Agentが質問へ回答 | MCP | Taskに必要な限定ProjectionとSource Revision | 全Repository／全会話の投入 |
| 非AIの外部Tool／自動化が定型処理する | TS API／CLI、Remoteの場合だけMCP | 登録済みCapabilityの構造化結果と相関Identity | 任意Shell、画面解析、AI応答の再解釈 |
| CROS管理者がShared接続を構成 | 管理用CLI／限定管理Surface | Credential、Workspace Exposure、失効結果 | Content AccessとSystem管理権限の混同 |

管理者がServerを構成できることと、Management／Commercial Contextを読めることは別である。Workbenchの`Unlock`は別Credentialによる再接続の入口であり、Password入力自体をRepository Access Authorityへしない。

非AIの外部Toolは、AI推論を必要としない定型読取りまたは登録済みCapability呼出しを指す。同一HostでTS API／CLIを利用できる場合はMCPを要求せず、別Hostから共通Transportが必要な場合だけRemote MCPのConsumerとなる。汎用Plugin FrameworkまたはCaller由来の任意Commandは対象外とする。

#### Workbench／MCP共同利用の業務範囲

<a id="workbench-mcp-sipoc"></a>

| Metadata | 内容 |
|---|---|
| 対象 | Local／RemoteのWorkbench、AIおよび外部ToolからProject Operation／CROSを利用するProcess |
| 目的 | Client入力、Transport、公開Application Contract、Source Repositoryおよび結果の境界を固定する |
| 根拠 | 2026-09-13時点の現行MCP実装、採用済みv0.21範囲および本節の利用者Job |
| 現在状態 | 行ごとに`Current`と`Candidate`を分離する |
| 略語 | SIPOC = Supplier／Input／Process／Output／Customer |
| 未確認 | Remote接続の実測、外部利用者の入力不足、Workbenchの比較効果 |

| 状態 | Supplier | Input | Process Scope | Output | Customer |
|---|---|---|---|---|---|
| `Current` | Local Repository、Project Runtime | Repository Binding、Objective／Decision／State要求 | stdio／localhost MCP → 現行公開契約で検証 → 実行／単一Project State投影 → 結果を返す | 現行3操作の構造化結果 | Developer、Project Operator、Local AI |
| `Candidate` | Local Repository、Project Operation／CROS | Project選択、Source-awareな読取り／候補要求 | Local TS API／拡張公開契約 → Source解決 → Project View／候補操作 | Source／Revision／Coverage付き結果、次の操作 | Local Workbench、AI、外部Tool |
| `Candidate` | Remote Client、Connection Credential | Request Identity、限定要求、Credential | 暗号化接続 → Requestごとの認証 → Workspace／Exposure照合 → 拡張公開契約へ搬送 | 開示可能な結果、Coverage、再取得参照または区別不能な拒否 | PM、Management、Remote Workbench／AI／外部Tool |
| `Candidate` | 検証済みRepository群、Runtime State | Project／Repository Relation、正本、観測時点 | Sourceを解決 → 欠測・制限・競合を分類 → 必要最小Projectionを構成 | Project／Portfolio View、候補、判断待ち | 許可された人間・AI・自動化 |

範囲外は、Credential発行だけによるEffect Authority、Repository権限の迂回、全Context投入、MCP固有のProject正本、Workbench専用更新Store、Internet一般公開および任意Remote Commandである。

#### Remote MCPのActor別候補Process

<a id="workbench-mcp-actor-process"></a>

| Metadata | 内容 |
|---|---|
| 対象 | 別HostのClientがShared CROSから限定Projectionまたは登録済み操作を利用する候補Process |
| 目的 | 接続、認証、Source解決、Application呼出し、結果搬送、切断および再取得を分ける |
| 根拠 | 現行localhost MCP lifecycle、v0.21のShared CROS候補および応答喪失時の二重Effect禁止 |
| 現在状態 | `Candidate` |
| 略語 | なし |
| 未確認 | Remote Transport実装、Network failure、Credential失効および結果再取得の実測 |

```text
時間: 上から下

<<A1: Remote Client>>   <<A2: MCP Transport>>   <<A3: CROS／Application>>   <<A4: Source／Runtime>>
          │                       │                         │                         │
 [P1: 接続要求] ────────────────> [P2: 暗号化接続とRequest認証]          │                         │
          │                       │        │Reject               │                         │
          │ <── 区別不能な拒否 ───┘        └── Auth Context ────> [P3: Workspace／Exposure照合]
          │                       │                                  │Reject                 │
          │ <──────── 開示可能な限定結果または区別不能な拒否 ───────┘                       │
          │                       │                                  └── Source要求 ───────> [P4: 正本を取得]
          │                       │                                              Source + Revision │
          │                       │                         [P5: Coverageを保って公開契約を実行] <──┘
          │                       │ <──────── 結果 + Request Identity ───────────┤
          │ <── 結果搬送 ────────┤                         │                         │
          │                       │                         │                         │
          │       {D1: 応答を受領できた?}                   │                         │
          │          │Yes                 │No              │                         │
          │          v                    v                │                         │
 [P6: 利用／表示]       [!X1: 現在Credentialで同一Requestを再取得] ───> [P7: Access再照合]
          │                                                        │
          │ <── 開示可能な既存結果／unknown／拒否 ──────────────────┘
```

再取得はRequest Identityだけでは成立しない。現在のCredential、Workspace GrantおよびRepository Exposureを再検証し、元要求後に権限が縮小した場合は、現在開示できる範囲へ縮約するか区別不能に拒否する。元の完全結果を返してはならない。

#### Workbench／MCP共同利用のAs-Is／To-Be

<a id="workbench-mcp-as-is-to-be"></a>

| Metadata | 内容 |
|---|---|
| 対象 | Local利用と別HostからのProject横断利用 |
| 目的 | 現行成立範囲とv0.21候補を混同しない |
| 根拠 | 現行MCP公開入口、Project Stateおよびv0.21採用範囲 |
| 現在状態 | `Current`／`Candidate`比較 |
| 略語 | なし |
| 未確認 | Remote接続とWorkbenchの利用者成果 |

```text
As-Is（現行）
Local Client
  ├─ stdio MCP
  └─ 127.0.0.1 HTTP
        ↓
Objective／Decision／単一Project State
        ↓
Remote Client、Project発見、Portfolio、Source Coverageは未成立

To-Be候補（v0.21）
Local Workbench ── TS API ───────────────┐
Local AI ─────── stdio／localhost MCP ───┼→ 同じ公開Application Contract
Remote Client ── 暗号化Remote MCP ──────┘
                                                ↓
                 Project／Repository解決 + Coverage + 限定操作
                                                ↓
                   正本、判断、候補または同一Requestの結果へ到達
```

To-Be候補はRemote Serverの常設、耐久QueueまたはWorkbenchの有効性を証明しない。Local利用をRemote構成へ強制せず、同じ公開意味をConsumerごとに適切な入口から使う。

#### Surface、契約およびTransportの関係

| Metadata | 内容 |
|---|---|
| 対象 | Workbench、AI、CLI／CIおよびRemote Clientから公開Application Contractまでの責務関係 |
| 目的 | Surface、Transport、意味契約および実行Ownerを同一Componentへ集約しない |
| 根拠 | 現行MCP責務分離、採用済みWorkbench方針および本節の利用者Job |
| 現在状態 | 現行図と候補図を分離する |
| 略語 | TS API = TypeScript API、MCP = Model Context Protocol |
| 未確認 | 公開Capabilityの最終Owner、Remote Transport、Workbench実装方式 |

```text
[Current: v0.20.1]

<<Local MCP Client>>
  ├─ stdio ───────────────┐
  └─ 127.0.0.1 HTTP ──────┤
                           ▼
               [MCP Transport／Adapter]
                 現行分離package
                           │
                           ▼
            [Project Runtime Public Contract]
            Objective／Decision／Project State
                           │
                           ▼
                [Coordinator Adapter／Runtime]
```

```text
[Candidate: v0.21]

<<Local Workbench>> ── TS API ───────────────┐
<<Local AI>> ───── stdio／localhost MCP ──────┤
<<CLI／CI／外部Tool>> ── CLI／TS API ─────────┤
<<Remote Workbench／AI／外部Tool>>             │
          └── 暗号化Remote MCP ───────────────┤
                                               ▼
        [Project Operation／CROS Public Application Contract]
             現行3操作を保持 + 候補Capabilityを追加
                                               │
                                               ▼
       [Project／Repository解決・Projection・Command／Candidate]
                                               │
                                               ▼
                    [Coordinator／Repository Tool]
```

Local WorkbenchにServer起動を要求しない。Remote WorkbenchがMCPを使う場合も、UI専用APIまたはMCP内だけのProject状態を作らない。Transportが変わっても同じ入力Identity、Source Coverage、状態分類、Authorityおよび結果を維持する。

#### 必要な公開Capability

次表はMCP Tool名または画面を先に固定するものではない。利用者Jobを成立させる公開Application Capabilityと、現行実装との差を示す。

| Capability | 主なConsumer | 現在 | v0.21で確認する最小結果 |
|---|---|---|---|
| Objective実行 | AI／CLI | 実装済み | 既存意味を維持し、CROS接続だけでAuthorityを増やさない |
| 人間判断の送信 | AI／Workbench | 実装済み | 現在有効な判断、世代、主体および一回限りの継続権限を維持する |
| 単一Project State取得 | AI／Workbench | 実装済み | Project Operation投影と意味を重複定義しない |
| 利用可能Project／Repository Sourceの解決 | AI／Workbench | 未実装 | 許可範囲、改訂版、欠測、制限、競合および観測時点を返す |
| Project View取得 | AI／Workbench | 未実装 | 状態、Topic／Meeting／判断待ちと各PropertyのSourceを返す |
| Portfolio View取得 | AI／Workbench | 未実装 | 許可されたProjectの最小比較と不完全性だけを返す |
| Topic／Meeting候補の作成・採否入口 | Workbench／AI | 未実装 | Candidateと正本更新を分け、人間Authorityなしに昇格しない |
| Repository Capabilityの列挙・実行 | Workbench／AI／外部Tool／CLI | 未実装 | 登録済み能力、必要Authority、構造化結果を返し、任意Shellを受けない |
| Request結果の再取得 | Remote Consumer | 未実装 | 切断後も同一Request Identityから結果または不明状態を取得する |

`Project View`と既存`Project State`の統合または分離はIA／Architectureで決める。Discoveryでは、同じ意味を二つのcanonical Schemaへ重複させないことを要求する。

#### Context選択とAIへの投影

MCP接続を全Context投入の許可にしない。AIへ渡す対象は質問または操作に必要な最小Projectionとし、次を結果に保持する。

| 必須情報 | 目的 |
|---|---|
| Project／Repository／Source Identity | どの正本を読んだか追跡する |
| Revision／Observed At | 現行性と再現性を区別する |
| Coverage | 存在開示が許可された範囲で`available`、`credential_required`、`restricted`、`unavailable`、`conflicting`、`unknown`を完全状態へ畳まない。存在非開示のSourceは個別状態へ列挙しない |
| Resolved Context | Resolverが要求に対して選択したContextを追跡する |
| Delivered Context | MCP／AdapterがAIへ実際に搬送したContextを追跡する |
| Reported Source Use | AIが結果中で明示したSourceを自己申告として追跡する。内部使用の証明にはしない |
| Applicable Rules／Decision Boundary | 接続やAgent Roleから未所有Authorityを生成しない |

相互に競合するSourceをAIが自動統合せず、古いHypothesisまたはUnavailableな領域を現在値として補完しない。質問に不要なCommercial、Meeting本文、Provider出力またはExecution logを機械的に全投入しない。モデル内部で実際に何を使用したかは未観測であり、内部推論全文、Chain of ThoughtまたはProvider非公開logを取得して補完しない。

#### Remote MCPの意味境界

v0.21のRemote MCPは「別HostのClientが、明示起動されたShared CROS Serverへ認証・暗号化された接続を行う」能力とする。Internet一般公開、常設Service、耐久Queue、Multi-tenant SaaSまたはRemote Host上の任意Command実行は含めない。

| 境界 | 必要条件 | 失敗時 |
|---|---|---|
| Network | TLSを終端する接続または同等に保護されたPrivate Tunnelを通す。平文BearerをLAN／Internetへ送らない | Application呼出し0 |
| Authentication | Requestごとに現在有効なConnection Credentialを検証する | 未認証時はRepositoryの存在や名称を漏らさず拒否 |
| Content Access | CredentialのWorkspace GrantとRepository Exposureを交差する | 不許可SourceをProjectionへ混ぜない |
| System Administration | `system_admin`をContent Accessと分ける | 管理操作可否から内容閲覧を許可しない |
| Effect Authority | Objective／Candidate／Decisionごとの既存Authorityを別に検証する | 接続成功だけでEffectを発行しない |
| Disconnect／Retry | Request Identity、受理、Effect、結果搬送を区別する | 二重実行せず、結果再取得またはRecoveryへ接続 |

TLS終端方式、Tunnel製品、Credential保存先およびProcess配布方式はArchitecture／Workflowで決める。Discoveryでは、異なるHost、盗聴されない接続、RequestごとのCredential検証、Workspace限定、切断後の非二重実行を代表成立条件とする。

#### 正常、部分成立および失敗

| 状況 | 利用者へ返す状態 | 禁止する補正 |
|---|---|---|
| すべての必要Sourceを取得 | `complete`とSource一覧 | 出典を省略した要約だけを返す |
| 一部Repositoryを取得不能 | `partial`と開示可能なCoverage | 完全なProject状態と表示する |
| 存在開示済みのSourceに別Credentialが必要 | `credential_required`とCredential切替／再接続導線 | 未検証Credentialへ内容を返す |
| Sourceの存在開示が未許可 | ID、名称、件数を含まない区別不能な拒否 | `credential_required`、Repository名または件数から存在を推測させる |
| Credentialが失効またはWorkspace外 | 現在のAccess Contextで区別不能な拒否 | 過去のSessionまたはRequestからAccessを継承する |
| Sourceが競合 | `conflicting`と許可された候補 | AIが勝手に一つへ統合する |
| Remote requestの応答喪失 | 現在のCredentialとWorkspace／Exposureを再検証したうえで、`unknown`または開示可能な同一Requestの再取得導線 | Request IDだけで結果を返す、新しいEffect要求として自動再送する |
| Workbenchの表示更新失敗 | 前回値のRevision／観測時点とStale表示 | 古い値を現在値として表示する |
| Candidate操作 | Candidate Identityと採否待ち | 画面操作だけで正本へ直接反映する |

#### 選択肢と段階的な検証

| 利用形態 | v0.21での位置づけ | 反証すること |
|---|---|---|
| Local TS API＋Workbench | 最小Workbenchの第一候補 | MCP Serverなしで同じApplication Contractと結果を使える |
| stdio／localhost MCP＋AI | 現行比較基準 | Workbenchなしでも同じ代表Jobを完了できる範囲を測る |
| 静的Report | 軽量代替 | 現行性管理を増やさず必要な判断へ到達できるか測る |
| Remote MCP＋Shared CROS | v0.21の限定Remote代表 | 異なるHost、認証、暗号化、Workspace限定、切断／再取得を縦断する |
| 常設Linux Server／耐久Queue | v0.22 | v0.21の完成条件へ混ぜない |
| Hosted Multi-tenant Workbench | 対象外 | 要求・Authority・運用実績なしに先行実装しない |

検証は「画面が表示された」「MCP tools/listが返った」では完了しない。同じ代表課題をAI／MCP、静的Report、Workbenchで実施し、次を比較する。

- 必要な判断対象へ到達できたか。
- Resolverが選択しAIへ搬送したSourceとRevisionを追跡でき、AIが結果中で表明したSourceと矛盾しないか。AI内部の実使用は未観測として維持したか。
- 欠測、Restricted、ConflictおよびStaleを認識できたか。
- 再探索、追加質問および操作迷いが減ったか。
- 定型操作がcanonicalなCommand／Candidate入口を通ったか。
- UI、MCPまたは接続が新しいAuthorityや第二正本を作らなかったか。
- Remote切断後に二重Effectなく同じ結果へ戻れたか。

#### Discovery出口

| 項目 | 状態 | 次のGate |
|---|---|---|
| 現行Capabilityと候補設計の分離 | `Complete for Scope` | IA／Architectureで公開CapabilityのOwnerを固定する |
| Actor、Jobおよび入口 | `Candidate` | UXで代表Journeyと優先順位を反証する |
| Workbench／MCPの責務分離 | `Candidate` | IA、UI／SPECおよびArchitectureでConsumer Closureを固定する |
| Remote MCPの意味境界 | `Candidate` | Threat、UX、SPEC、Architectureおよび実境界試験へ接続する |
| Workbenchの価値 | `Unproven` | AI／MCP、静的Report、薄いWorkbenchを同一課題で比較する |
| Discovery全体 | `Complete for Scope` | 独立レビューPass。人間理解の確認とUX工程への移行は2026-09-13に完了。Workbenchの比較価値はVerificationまで未確認 |

### Project、CommercialおよびRepositoryの責務

| 概念 | 候補責務 | 境界 |
|---|---|---|
| Project | 案件のSummary、Scope、Stakeholder、Organization、Governanceおよび大枠Schedule | 案件に関係するすべての正本を集約しない |
| Commercial | Projectを成立させる商取引条件 | Projectと別責務・別Repositoryにできることだけを先に固定し、完全な会計Schemaを作らない |
| Repository | Projectの一部を所有する論理Repository | Projectと同一Identityにせず、実在するclone／worktreeとも分ける。単一Roleへ固定せず複数の責務領域を所有できる |
| Binding | Repositoryと検証済みRoot／worktreeの実行時結合 | 別RepositoryまたはProject全体のAuthorityを持たない |

`20_Project`、`21_Commercial`、`22_Topics`および`23_Meetings`は、採用する場合の標準責務領域候補とする。使用しないRepositoryへ空成果物を要求せず、番号を直列工程として扱わない。

Commercialは分離の代表例であり、Topics、Meetings、Communicationまたは工程領域も同じProject IDと異なるRepository IDで別Repositoryへ分離できる。Repositoryが所有するContext ResponsibilityはTool／Runtime Capabilityと分けて宣言し、同じ責務の競合Ownerを検索順で自動選択しない。

Repository分離を情報アクセス境界にする場合は、Git Hosting、Filesystem ACL、OS UserまたはShared CROS ServerのWorkspace Exposureが実際の読取り拒否を所有する。CROS内の共通Password Gateや表示ロックだけを機密性の根拠にせず、Shared Serverは現在のConnection Credentialに結合したWorkspace集合だけをRepository単位の限定Capabilityとして利用する。別Repositoryを読めない利用者へ縮約情報を渡す場合は、情報分類と作成Authorityを持つ公開成果物として別に判断し、権限不足を自動要約で迂回しない。

## 3. Topic／Project AttentionとMeeting

| 概念 | 役割 | 作らない条件・昇格条件 |
|---|---|---|
| Topic | Conversation上のAttentionが移動しても失ってはいけない関心事を一時保持する | 既存単位へ一意に還元でき、複数Contextを束ねず継続追跡価値もなければ作らない。整理後はDiscovery、Decision、CHG、Roadmap、Work等へ分解・昇格または閉じる |
| Risk／Issue | Topic内で将来事象と顕在化済み問題を区別し、必要な横断Viewへ投影する | 独立した第二正本を先に作らない |
| Meeting | 時間境界を持つContext形成Activity | 生Transcriptを正本化せず、議論したTopic、確認したDecision、更新した正本、残った問い、Sourceを保持する |
| Message Theme | Communication内の意味クラスタ | MeetingやProject Attentionと同一視しない |

Meeting、TopicおよびCommunicationは使用サービスでなく目的で分類する。同じTeamsでも、内部Context形成はMeeting、継続論点はTopic、外部への案内はCommunicationになり得る。Connectorは入力Adapterであり、媒体名から意味またはAuthorityを生成しない。

外部会話から抽出した候補は、既存Context照合と人間のAuthorityなしに正本へ昇格しない。現在の設計境界は[Project Operation Contextのアーキテクチャ](../06_Architecture/project-operation/01_Architecture.md)で具体化する。

## 4. Repository Tool／Capability Registry

CRDD採用Repositoryが持つBuild、Test、Preview、Asset同期、Data変換、Migration、Validation、Code Generation等を、MCP専用CommandではなくRepository所有のCapabilityとして明示登録する候補である。

```text
Tool exists
  ≠ Capability registered
  ≠ MCP exposed
  ≠ Execution authorized
```

| 観点 | 候補境界 |
|---|---|
| 配置 | `tools/<capability-name>/`程度の浅い配置を推奨できるが、階層数を規範化しない |
| 解決 | Directory名や実行可能fileの存在から能力を推定せず、Git管理されたRepository-local設定から安定ID、Entry、Runtime、由来、公開先、Authority、Human Gateを解決する |
| 共通利用 | MCP、Coordinator、CROS、Scheduler、CI、QualまたはHuman CLIが同じCapability Runtimeを利用できる形を候補とする |
| 実行 | Caller由来の任意Shellを受けず、Working Directory、Environment／Credential、Effect、Timeout、取消、出力量、cleanup、結果接続を閉じる |
| 状態 | Tool実装と定義はGit管理し、`.crdd`はRuntime生成状態、Cache、実行知等に限定する |
| Federation | CROSのCatalogを各Repositoryの正本へ昇格させず、Capabilityを別Repositoryへ自動継承しない |

具体的な設定Path、Schema、Root Manifestの要否は、実装要求と安全境界を確認してArchitectureで決める。

## 5. `.crdd` Runtime Data ContractとCRDD／CROS構造化基盤

Workbenchは新しい正本や独自Runtimeを持たず、構造化されたCRDD／CROSを人間向けに投影・操作する薄い作業台とする。v0.21では設計候補の保持だけで終えず、Projectを選択し、現在状態・Source Coverage・Topic／Meeting／判断待ちを確認し、正本または既存Toolの操作入口へ進める最小実装までを採用範囲とする。

```text
CRDD／CROS
├─ Repository Contract
├─ .crdd Runtime Data Contract
├─ Tool TS API／CLI
├─ Structured Result
├─ Identity／Status
└─ MCP Contract
        │
        ├─ AI
        ├─ CLI／CI
        ├─ MCP
        └─ CROS Workbench
```

| 境界 | v0.21の方針 |
|---|---|
| Repository | CHG、Topic、Roadmap、工程成果物、Decision、Verification、Release、昇格済みCommunicationから必要なIdentity、状態、関係、Lifecycle、Sourceを推測なしで取得できる範囲を探る |
| `.crdd` | Root、Git管理／Runtime-only、耐久／一時、Owner、保持、清掃、Recoveryを分ける。正式構成は全書込みPathの棚卸し後に決める |
| Tool | `TS API → CLI／MCP／UI`の依存方向と構造化結果を基本とし、UIだけの業務ロジックや別実装を作らない |
| Workbench | Project／Portfolio、Source Coverage、Topic／Meeting／判断待ち、実行状態および正本への導線を表示する。定型操作は既存TS API／CLI／MCPへ渡し、Workbench専用の更新処理を持たない |

WorkbenchはSourceTreeや高度なGit操作を再実装しない。閲覧・比較・状態確認・定型操作を担い、調査・判断支援はAI、実行・統合・Runtime管理はCROS、Context・Knowledge・Decisionの正本はCRDDが所有する。v0.21の最小実装は、実際のCROS／Project Operation公開契約から取得した構造化結果を表示し、欠測・制限・競合・観測時点を失わず、少なくとも一つの既存Command／Candidate入口を同じ契約で呼び出すところまでを縦断する。画面Framework、装飾、高度なGit操作、独自検索Indexおよび汎用Dashboard Builderは完成条件に含めない。

`.crdd`の正式なDirectory Taxonomyは、全書込みPathのOwner、Purpose、Schema、Git管理、耐久性、Read／Write、保持、清掃およびRecoveryを棚卸しして決める。現行の棚卸しは[Runtime Dataの現行Path棚卸し](../06_Architecture/runtime-data/01_Current_Path_Inventory.md)、採用候補となる全体構造と`tmp/`の限定用途は[Runtime Dataの目標Architecture](../06_Architecture/runtime-data/02_Target_Architecture.md)で追跡する。Architectureの候補を、Consumer移行と検証なしに現行Runtime契約へ昇格しない。

## 6. AI Runtime Registry／モデルProfile外部構成

AIモデル名、Reasoning強度、Role割当およびCLI配置をCoordinator Coreへ埋め込まず、更新頻度の異なる設定とAdapterへ分ける候補である。

```text
Role／Task requirement
  ↓
Runtime ID／Profile selection
  ↓
AI Runtime Registry
  ↓
registered Adapter
  ↓
Provider CLI
```

| 観点 | 候補境界 |
|---|---|
| Registry | 安定Runtime ID、Adapter種別、検証可能なCommand Identity、利用可否、対応Profile、Role割当を保持する |
| 設定変更 | 既存Adapter内のモデル追加、Profile変更、Role割当、CLI配置変更は設定で完結させる |
| Adapter追加 | 起動、入出力、取消、失敗分類または認証観測が異なるRuntimeだけに要求する |
| Authority | 登録済み、Hostで利用可能、認証済み、Operationで許可済みを同一視しない |
| 安全 | 設定に秘密を保存せず、任意Executableや任意引数を構成しない |
| 実行知 | Runtime ID、Profile、Adapter、選択・fallback理由、時間、Turn、失敗、利用量を秘密情報と分けて記録する |

動的Plugin探索、Remote Plugin配布、未知CLIの設定だけによる追加、費用だけの自動最適化、Self-hosted／API Provider対応は初期完成条件に含めない。

## 7. CROS発展境界

CROSは複数ProjectのCRDD Contextを横断解決し、外部へ安定Interfaceとして提供し、Agent実行結果を該当Repositoryへ還流するRuntime／Federation層の候補である。既存の[協働プロジェクト実行モデル](01_CRDD_Product_Discovery.md#cros-collaborative-project-execution-model)を上位の正本とする。

```text
Human／Qual／外部AI・Tool
          ↕ MCP／HTTP
CROS
  ├ Project Registry／Repository Binding
  ├ Context Resolver／Context Package
  ├ Multi-Repository Federation
  ├ Task Session／Human Decision Wait・Resume
  ├ Execution Policy／Agent Organization
  └ 派生Index／Provenance／Audit
          ↕ Repository Contract
各ProjectのCRDD正本
```

| 所有する | 所有しない |
|---|---|
| Contextの解決・連合、実行Session、結果還流、派生Index | Product Requirement、ProjectのWhy、人間の重要判断、外部Toolの表示状態、各Projectの正本 |

外部Interfaceは細粒度Storage操作ではなく、`project context`、`portfolio context`、`release context`等の利用目的を一回で満たす粒度を候補とする。明示値、決定論的算出値、推定値の出典を追跡可能にする。

複数Projectの読み取り専用Portfolio投影は、対象Projectの選択・Routing、Project単位のContext・Authority・Runtime State・Recovery分離までを上限とする。未認証の一般Internet公開、Remote常設実行、Project間の自動最適化、Organization横断Effect Authorityは別の完成条件で扱う。

PersonalとShared Serverは異なるProject Modelを作らず、利用可能なRepository集合の決定方法だけを分ける。Personalは検証済みLocal Binding、Shared ServerはServer Repository Pool、明示Workspace Exposureおよび現在のConnection Credentialに記録した`workspace_ids[]`を交差させる。Server Credentialが読めること、Filesystem上に存在することまたはProject Relationを、MCP利用者の閲覧Authorityへ昇格しない。

`general < privileged < administrator`の固定Role階層は、管理権限とContent Accessを混同しやすいためCoreへ採用しない。v0.21のShared ServerはBearer TokenをRequestごとにConnection Credentialへ照合し、`workspace_ids[]`と`system_admin`を別軸で解決する。Principal、User Directory、汎用認証Adapterまたは永続認証Sessionを作らない。詳細は[CROS Federationと利用境界](../06_Architecture/cros/01_Architecture.md)で扱う。

Workspace集合は、`system_admin: true`を持つ現在のConnection Credentialによる管理Requestが、対象Credentialの発行または更新時に`workspace_ids[]`として設定する。`system_admin`、情報分類、Task Roleまたは人間の決定権限をWorkspace集合へ混在させず、管理可否からContent Accessを生成しない。

CROSは、対話を主に担うChat AgentとRepository上の構築を主に担うCoding Agentが、同じCRDD正本から解決したAgent Operating Contextを参照し、構造化Handoffで往復できる上位接続を候補とする。MCP接続済みであることをCRDD規則の認識と同一視せず、CRDD全文や会話全文を毎回転送しない。Taskに適用される規則、昇格済みContext、Objective、未決事項、Decision AuthorityおよびEffect境界をRevision付きで解決し、判断結果を所有正本へ記録して同じTask Identityへ戻す。

## 8. 採否時に確認する共通事項

- 正本を複製せず、候補が解く利用者課題と観測可能な価値を示せるか。
- 明示値、推定値、欠測、不明および人間判断を区別できるか。
- Repository、Project、Organization間のAuthorityと情報分類を越境しないか。
- TS API、CLI、MCP、UIが同じ意味契約を再利用できるか。
- 具体的なSchema、Path、実装順序をDiscoveryだけで確定していないか。
- v0.20で成立したRuntime実行Identity、Capability Provenance、署名、RecoveryおよびProvider Home保護を弱めないか。
