# CRDD／CROSの利用体験

状態: Candidate（v0.21.0、Released Baseline: v0.20.1）
担当責任者: Qual-Lab
最終更新日: 2026-09-13
工程規則: [UX](../22_UX.md)

## 1. 何を良くしたいのか

CRDDを使う人が本当に知りたいのは、内部のDirectoryやRuntimeの構造ではない。「今どうなっているか」「自分は何を判断すべきか」「次に何が起きるか」を、必要な根拠とともに理解できることを目指す。

現在は、単純な状況確認でもChat Agent、Coding Agent、Git Client、Repository内の文書や実行logを行き来し、利用者自身がProjectの現在地を組み立て直す場面がある。横断機能を使うために、普段のRepository作業まで複雑にすることも避けたい。

そこで、日常の開発は対象Repositoryのまま続け、Project全体を見たいときだけCROS／MCP、短時間で確認・比較・定型操作をしたいときだけWorkbenchを使う体験を作る。入口が違っても、同じ正本、同じ公開契約、同じ判断境界へ到達する。

| 現在起き得ること | 目指す体験 |
|---|---|
| 状態を知るために複数の文書・log・会話を辿る | Projectの現在地、欠測、判断待ち、次の行動を一つの入口から理解する |
| Chat AgentとCoding Agentの間を人間が転記する | 構造化したContextと同じTask Identityで往復する |
| 横断機能のために日常のRepository作業まで変える | Local作業は単独で成立し、必要なときだけ横断する |
| 接続できたことを、内容の完全性や実行許可と誤認する | 接続、閲覧、候補作成、採用、Effectを明確に分ける |
| 応答喪失時に新しい依頼としてやり直す | 同じRequest Identityの状態・結果・回復義務へ戻る |

### 1.1. 根拠、対象、対象外

利用者が内部の署名、資源管理、エージェント間の情報搬送を毎回操作せず、依頼、必要な判断、成果物の受入へ集中できることを目指す。安全に止まれるだけでなく、止まった理由と次に必要な行動が分かることも体験の成立条件とする。

v0.21共同UXの主入力は、[Discoveryの統合判断](../01_Discovery/01_Product_Discovery.md#current-discovery-decisions)と、そこからUXへ引き渡された12件の要求である。要求の探索元は、[Project Runtime](../01_Discovery/Explorations/EXP-000008_Project_Runtime/exploration.md)、[Project状態理解](../01_Discovery/Explorations/EXP-000007_Project_State_Understanding/exploration.md)、[Repository単独作業](../01_Discovery/Explorations/EXP-000019_Repository_Local_Work/exploration.md)、[Repository横断Project Context](../01_Discovery/Explorations/EXP-000020_Cross_Repository_Project_Context/exploration.md)、[人とAIの入口](../01_Discovery/Explorations/EXP-000021_Human_and_AI_Entry_Points/exploration.md)、[Remote Project Context](../01_Discovery/Explorations/EXP-000022_Remote_Project_Context/exploration.md)、[TopicとMeetingの継続](../01_Discovery/Explorations/EXP-000023_Topic_and_Meeting_Continuity/exploration.md)、[Portfolio可視性](../01_Discovery/Explorations/EXP-000024_Portfolio_Visibility/exploration.md)および[Project間Context交換](../01_Discovery/Explorations/EXP-000027_Cross_Project_Context_Exchange/exploration.md)である。§3.1で要求からUX成果への全数対応を示す。

### 1.2. 既存Toolから継承する制約の根拠

[Runtime責務分離の探索](../01_Discovery/Explorations/EXP-000014_Runtime_Responsibility_Separation/exploration.md)と[実行知の探索](../01_Discovery/Explorations/EXP-000013_Execution_Intelligence/exploration.md)は、v0.21共同UXそのものの成立根拠ではなく、既存Toolから継承する体験制約の根拠として使う。人間から報告された確認画面の不表示、二重Enter、タイムアウト、反復署名・承認、成功と回収の混同は失敗仮説であり、頻度や一般利用者全体への影響をこの保守対話だけから推定しない。詳細な継承契約は§7と§8に置く。

| 既存Toolの利用者と場面 | 継承する成果 | 対象と制約 |
|---|---|---|
| CRDDを採用する人 | 標準だけを使うか、Runtimeも使うか判断できる | Runtime導入をCRDD利用の必須条件にしない |
| 作業を依頼する人 | 許可した範囲で採用可能な候補を受け取る | 既存Subscriptionを使う。候補生成を自動統合とみなさない |
| フロントAI・自動化の呼出し元 | 対象、入力、結果、停止を機械的に区別できる | 人間の判断・Authorityを代行して拡張しない |
| 復旧を担当するローカル利用者 | 対象を取り違えず、残存状態と対処範囲を理解する | 不明状態を無条件の再試行・清掃へ変えない |
| 標準を保守する人・CI | Checkerの指摘と未確認範囲を読み、対象文書を直せる | 機械検査を意味監査や準拠認定とみなさない |
| Runtimeを開発・配布する人 | 開発反復と公式署名を分けて検証できる | 一般利用者へRelease秘密鍵を要求しない。native補助は内部部品 |

## 2. 立場に応じた利用の物語

v0.21候補では、利用者へCRDDの全DirectoryまたはRepository Federationを最初に理解させない。通常は自分が作業するRepositoryから開始し、Project全体または複数Projectの判断が必要な場合だけCROSの横断Projectionへ移る。

```text
Developer
   │ 対象Repositoryで日常作業
   ▼
Local AI／CLI

PM
   │ Project全体を横断確認
   ▼
CROS／MCP ──→ Project Projection

Management
   │ 複数Projectの要点を確認
   ▼
Portfolio Projection
```

| 利用者 | 最初に見える単位 | 主な行動 | 詳細へ進む条件 |
|---|---|---|---|
| Developer | 現在のRepositoryと、そのRepositoryが所有するContext | 実装、Topic／Meeting確認、CHG、品質確認 | 別Repositoryの根拠またはProject全体判断が必要 |
| PM | 一つの論理Project | Milestone、Topic、Meeting、品質、Commercial可視性および判断待ちを確認 | Source、Repository状態または個別成果物を調べる必要がある |
| Management | PortfolioとProject要約 | At Risk、Attention、主要判断、Milestone等を比較する | 対象Projectの要因と根拠を確認する必要がある |

Developer、PMおよびManagementは体験と情報粒度を検討するための利用者像であり、CROSが所有する固定Roleまたは権限Groupではない。実際の可視範囲と操作可能範囲は、Personalでは検証済みLocal Binding、Shared Serverでは現在のConnection Credentialに結合したWorkspace集合に加え、Repositoryごとの既存Constraint、開示制約およびOperation Authorityから決まる。同じ利用者でも接続先やRepositoryにより異なる投影になり得る。

Developerが単一RepositoryからAIを利用する場合、AIは同じProject IDを持つ兄弟Repositoryを推測探索しない。そのRepository内の正本と許可された外部参照だけを使い、利用できないProject Contextを補完または推測しない。

PMがCROSを利用する場合、複数Repositoryの物理構成を主表示にせず、一つのProjectとして現在状態を投影する。Repository、Binding、Git Revisionおよび取得経路は根拠または診断として段階的に表示し、欠測、競合、古い観測およびアクセス制限を完全なProject Viewへ畳まない。

Management向けPortfolioはProject正本を中央へ複製せず、許可された読み取り専用Projectionを集約する。単一ScoreだけでProject健全性や優先順位を確定せず、重要な判断、品質、進捗、Commercial可視性および観測時点へ辿れるようにする。

### 2.1. 利用不能ContextとUnlock

| Canonical状態 | 利用者への表示 | 許可する操作 |
|---|---|---|
| `available` | 利用可能なContextと観測時点 | 閲覧、許可範囲のCommand／Candidate作成 |
| `credential_required`かつ存在開示可能 | `別の接続Credentialが必要`または鍵表示 | Client側で別の有効なConnection Credentialを選んで再接続する |
| `restricted`かつ存在開示可能 | `現在の権限では利用できません` | 権限申請等の外部導線が明示されている場合だけ案内 |
| 存在開示不可 | 対象名、件数、状態を表示しない | なし |
| `unavailable` | 一時的に取得できないことと観測時点 | 安全な再取得または状態確認。権限不足とは表示しない |
| `unknown` | 完全な回答を構成できないこと | 推測せず、確認先または不足範囲を示す |

`Unlock`は`credential_required`に対する外部認証入口の表示名である。CROSが共通Passwordを照合する操作ではなく、`restricted`や存在開示不可の対象へ表示しない。認証後も取得できたRepositoryとfieldだけを追加投影し、以前の不完全な回答を根拠なく完全扱いしない。

### 2.2. Topic／Meetingの日常操作

Meeting RecordからTopic更新、新規Topic、DecisionまたはContext更新の候補を作れる。ボタンや自然言語要求は候補化の入口であり、対象正本への採用Authorityではない。

Topicの経緯表示は、関連Meeting、調査、Decision、CHGおよび現在状態を時間順に辿れるようにする。生Transcriptの全文、アクセス不能なMeetingまたは別Repositoryの内容を、経緯を埋めるために複製・推測しない。

### 2.3. 対話と構築を往復する体験

利用者をChat AgentとCoding Agentの情報転記係にしない。対話で合意した内容は昇格済みContext、Objective、Acceptanceおよび判断境界として引き渡し、構築中に不足が見つかった場合は、未決事項、根拠、必要な判断主体および再開条件を同じTaskへ戻す。

```text
Human／Customer
      ↕ 対話・判断
Chat Agent
      ↕ 構造化Handoff
    CROS
      ↕ Operating Context／Resume
Coding Agent
      ↕
Repository
```

| 場面 | 利用者へ示すもの | 利用者へ要求しないもの |
|---|---|---|
| 構築開始 | 承認済み目標、利用Context、適用規則、実行境界 | Chat全文のコピー、CRDD全文の選択 |
| 判断待ち | 何が不足し、誰の何の判断で再開できるか | Agent内部ログの解読、Agent間の質問転記 |
| 判断後の再開 | 同じTaskへDecisionが反映されたことと再評価結果 | Objectiveや経緯の再入力 |

MCP接続済み、Agentが応答した、またはHandoffを受信しただけで、CRDDに従っている、必要Contextが揃った、もしくはEffectが許可されたと表示しない。詳細な意味契約は[CROS Federationと利用境界](../06_Architecture/cros/01_Architecture.md#8-agent-operating-contextとhandoff)を正本とする。

<a id="workbench-mcp-ux-outcomes"></a>

## 3. 利用者に届ける成果

WorkbenchとMCPは同じ利用者へ同じ形を強制する入口ではない。利用者が置かれた状況に適した入口を選びながら、同じProject、Source、状態、判断境界および結果へ到達できることをUX成果とする。

### 3.1. Discovery要求候補からUX成果への対応

次の10件は、[DiscoveryからUXへ渡した内容](../01_Discovery/01_Product_Discovery.md#current-discovery-decisions)を利用者成果へ変換した安定コンテキストである。各成果の改訂版は`@1`、状態は`Candidate`であり、UX工程移行の承認前に採用済みと扱わない。

| UX成果 | Discovery要求候補 | 利用者成果 | Journey／Blueprint | 検証意図 | IAへの義務 |
|---|---|---|---|---|---|
| `UX-000001@1` Repository単独利用 | `REQ-000008`: Repository単独作業はCROS／Workbenchなしでも成立する | Developerが現在Repositoryだけで日常作業を開始・完結でき、必要時だけ横断利用へ進める | [DeveloperのLocal Journey](#workbench-mcp-role-journeys)、Blueprintの「Contextを選ぶ」 | 横断機能未設定でも開始・完了できることを比較する | Local Sourceを既定にし、横断Sourceの不足と切替を別状態にする |
| `UX-000002@1` 根拠付きProject View | `REQ-000007`／`REQ-000009`／`REQ-000020`: 出典と不完全性を保ち、Project・Repository・Rootを分けてFederationする | 物理Repositoryを意識せず現在地を理解しながら、何が分かり何が不足・競合・古いかを確認して正本へ戻れる | Project Operator／PM Journey、[重要場面](#workbench-mcp-critical-recovery) | partial、stale、conflictingをcompleteへ畳む反例と、Identity混同を拒否する | Project、Repository、Root、Property、Source／Revision／Observed At／Coverageを関連付ける |
| `UX-000003@1` 薄いWorkbench | `REQ-000010`: Workbenchは公開Application Contractだけを使う薄いSurfaceとする | Workbench、AI、CLIから同じ意味と結果へ到達し、Surface固有の状態を覚えなくてよい | [共同Service Blueprint](#workbench-mcp-service-blueprint) | UI専用正本、Filesystem直接更新、独自Authority判断がないことを確認する | 公開結果と表示・操作入口を分け、正本Ownerを保持する |
| `UX-000004@1` 所有正本へ戻る候補操作 | `REQ-000012`: Topic／Meeting操作は候補または所有正本のCommandへ戻す | 試案、比較、採用、正本反映を区別し、適切な決定権限者へ判断を戻せる | Blueprintの「判断・候補操作」、重要場面のCandidate | 投影の直接更新とMeetingからの自動採用を拒否する | Candidate、Decision、所有Command、反映結果を別の情報状態にする |
| `UX-000005@1` 最小Portfolio比較 | `REQ-000013`: Portfolioは読み取り専用かつSource-awareな最小投影に限る | Managementが許可されたProjectだけを比較し、注意事項から根拠と不足へ段階的に進める | ManagementのPortfolio Journey | 非開示Projectの存在を漏らさず、不完全性を識別できるか確認する | Project比較、観測時点、Coverage、根拠導線を分ける |
| `UX-000006@1` Workbench比較価値 | `REQ-000007`／`REQ-000010`の有効性を比較する | 同じ課題で判断対象、出典、欠測へより少ない再探索と迷いで到達できる | [代替利用の比較](#workbench-comparison-verification) | 同一条件で到達、根拠確認、欠測認識、迷い・再探索を比較する | 比較対象で共通利用できるProject／Source／課題の単位を保つ |
| `UX-000007@1` Workspace限定Remote利用 | `REQ-000011`: Remote接続のWorkspace限定 | 接続元が変わっても、現在Credentialに許可されたWorkspaceだけを利用でき、利用不能範囲を推測で補わない | Remote利用場面、重要場面・失敗／回復 | Workspace Grant縮小、失効、再接続時の表示と停止を確認する | Credential、Session、Workspace、利用可能Sourceを区別する |
| `UX-000008@1` 同一要求への再接続 | `REQ-000021`: Remote要求結果の同一Identity再取得 | 応答喪失後に新規実行せず、同じ要求の状態・結果・回復義務へ戻れる | Remote利用場面、重要場面・失敗／回復 | Timeout、切断、再接続で二重Effectを起こさないことを確認する | Request Identity、現在状態、結果、再取得、Recoveryを関連付ける |
| `UX-000009@1` Milestoneを委ねる | `REQ-000003`: Objectiveから統合までのProject Lifecycle | 人間が内部Taskを逐次操作せず、Milestoneの成立状態と必要な判断だけを理解して進行を委ねられる | [Milestoneを委ねる利用体験](#milestone-delegation-experience)、Project Operator／PM Journey | Task数や進捗率ではなく、受入・統合・品質・判断状態を区別できるか確認する | Objective、Milestone、Task、Integration、Quality、Decisionを関連付ける |
| `UX-000010@1` 出所付きContextと結果の往復 | `REQ-000017`／`REQ-000024`: 出所付きContext Packageの解決と境界を越えるTask結果の帰還 | Chat AgentとCoding Agentの間を人間が転記せず、使ったContextと生成結果を同じTaskへ戻せる | 対話と構築を往復する体験、非AI外部Tool Journey | 全Context投入、出所喪失、別Taskへの結果混入を拒否する | Context Package、Source、Task、Result、Handoff、Decisionを関連付ける |

### 3.2. 利用者・状況別の成果

| 利用者・状況 | 現在の困りごと／失敗仮説 | 利用後に得たい状態 | 価値が成立しない条件 |
|---|---|---|---|
| Developerが一つのRepositoryで作業 | 横断機能のためにServer、Workspaceまたは他Repositoryを意識させられる | 現在Repositoryだけで日常作業を完結し、必要時だけProject全体へ進める | Local作業の開始手順、入力または認知負荷が増える |
| Project Operatorが現在地を確認 | 状態、品質、判断待ち、根拠を複数文書とlogから再構成する | 欠測と観測時点を含むProject Viewから、今の判断と正本へ戻れる | 投影を信じるために結局すべてのlogを読み直す |
| PMが複数Repositoryを横断 | Repositoryごとの状態を手で統合し、不足Sourceを見落とし得る | 一つの論理Projectとして確認しつつ、不足・制限・競合を識別できる | 不完全なViewを完全状態と誤認する、または物理構成の理解が前提になる |
| Managementが複数Projectを比較 | 集計された結論から根拠、現行性、未確認範囲へ戻れない | 最小比較から注意事項と根拠Projectへ段階的に進める | 単一Scoreだけで健全性や優先順位を確定して見せる |
| Chat／Coding Agentへ質問・依頼 | 全Context投入、会話転記、利用Source不明が起き得る | 必要なContextだけがRevision付きで搬送され、結果のSource表明を確認できる | AI内部の利用を証明済みと見せる、または不足Contextを推測する |
| Remote ClientがShared CROSを利用 | 接続、Content Access、Effect Authorityおよび応答喪失を区別できない | 接続先、開示範囲、要求状態、次の安全な操作を理解できる | 接続成功を実行許可と誤認する、または再試行でEffectが重複する |
| 非AIの外部Tool／自動化 | 人間向け画面またはAI出力を解析して定型処理する | 同じ構造化結果と相関Identityを直接利用できる | MCPを不要なLocal処理へ強制する、または任意Commandを公開する |

### 3.3. 共通体験原則

- **入口より意味を安定させる。** Workbench、AI＋MCP、CLI／TS APIで、同じ状態を成功、失敗または判断待ちへ別解釈しない。
- **LocalをRemoteの都合で複雑にしない。** 一つのRepositoryで足りる作業にCROS Server、Credential切替またはFederation理解を要求しない。
- **全体像と不完全性を同時に示す。** 要約を簡単にしても、欠測、制限、競合、古い観測を消さない。
- **結論から正本へ戻れる。** Project／Portfolio ViewはSource、Revisionおよび所有成果物への導線を失わない。
- **人間の判断点だけを前面に出す。** 内部Task、Lock、TransportまたはAgent間搬送を通常操作にしない。
- **接続、閲覧、候補作成、採用、Effectを分ける。** 一つが成立しても次のAuthorityが成立したとは表示しない。
- **再接続を新規実行にしない。** 応答喪失時は同じRequestの状態確認を先に示し、再実行を既定にしない。
- **選べない選択肢を見せない。** 存在開示不可のSource、利用不能なCredentialまたは未登録Capabilityを推測表示しない。

<a id="workbench-mcp-role-journeys"></a>

## 4. 利用者別Journey

### 4.1. DeveloperのLocal Journey

```text
((S: 対象Repositoryで作業開始))
  │
  ▼
[U: AI／CLIへ現在Repositoryの仕事を依頼]
  │
  ▼
[T: Repository内Contextと現在状態を利用]
  │
  ├── Repository内で完結 ──> [U: 結果を確認] ──> ((E: 日常作業を継続))
  │
  └── 別Sourceが必要 ──────> [R: Project横断が必要な理由と不足範囲を提示]
                                  │
                                  └── 利用者が選択した場合だけCROSへ進む
```

Developerへ兄弟Repository、Management ContextまたはCROS設定を自動探索・要求しない。横断が必要な場合は、何が不足し、現在Repositoryだけでは何を判断できないかを説明してから入口を切り替える。

### 4.2. Project Operator／PMのProject Journey

```text
((S: Projectの現在地を確認))
  │
  ▼
[U: Projectを選ぶ／質問する]
  │
  ▼
[T: 状態 + 判断待ち + Source Coverage + 観測時点]
  │
  ├── 十分 ──────> [U: 判断対象または次の作業を確認]
  │                       │
  │                       └──> [T: 正本／既存Command／Candidate入口]
  │
  ├── Source不足 ─> [R: unavailable／unknownと再取得条件]
  │
  ├── 別Credential ─> [R: 存在開示済みの場合だけ接続切替]
  │
  └── Conflict ───> [R: 競合Sourceを示し、自動統合しない]
```

Projectの要約を見せることより、利用者が「何を判断でき、何はまだ判断できないか」を理解できることを優先する。Repository Pathや内部IDは主表示にせず、根拠確認または診断時に段階的に示す。

### 4.3. ManagementのPortfolio Journey

```text
((S: 複数Projectの注意事項を確認))
  │
  ▼
[T: 許可されたProjectの最小比較 + 観測時点]
  │
  ▼
{U: 詳細判断が必要?}
  ├── No ──> ((E: 状況把握を完了))
  └── Yes ─> [T: 対象Projectの要因・根拠・不足範囲へ進む]
                  │
                  └──> [U: Project Ownerへ判断または確認を返す]
```

PortfolioはProject間の自動優先順位、Capacity配分または投資判断を行わない。アクセスできないProjectの存在、件数または状態を比較表から推測できる形にしない。

### 4.4. Remote利用と応答喪失のJourney

```text
((S: Shared CROSへ接続))
  │
  ▼
[T: 接続先と現在利用できるWorkspaceを確認]
  │
  ▼
[U: 限定要求を送る]
  │
  ├── 応答あり ─────> [T: 結果 + Source + Request状態]
  │
  └── 応答なし ─────> [R: 新規実行ではなく同じRequestの確認を案内]
                              │
                              ▼
                    [S: 現在のCredentialとAccessを再検証]
                              │
                              ├── 開示可能 ─> [T: 既存結果またはunknown]
                              └── 開示不可 ─> [T: 区別不能な拒否]
```

利用者へ「再試行してみてください」だけを返さない。要求が受理されたか、Effectが発生したか、結果だけ失われたかを区別できない場合は、その不確実性と安全な確認経路を示す。

### 4.5. 非AI外部ToolのJourney

```text
((S: 定型の読取りまたは登録済みCapabilityを使う))
  │
  ▼
[T: LocalではTS API／CLI、別HostではMCPを選ぶ]
  │
  ▼
[S: 登録済みCapabilityと必要Authorityを照合]
  │
  ├── 利用可能 ──> [T: 構造化結果 + 相関Identity] ──> ((E: 呼出し元が処理を継続))
  │
  └── 拒否／不明 ─> [R: 理由、Effect状態、同じIdentityでの再取得条件]
```

外部Toolへ人間向け画面またはAI応答の解析を要求しない。Localで成立する処理へMCPを強制せず、Remoteでも任意Shellを公開しない。再入場時は新しい要求として推測せず、公開結果が示す相関Identityと現在のAuthorityを再照合する。

<a id="workbench-mcp-critical-recovery"></a>

## 5. 重要場面と失敗・回復

```text
[U: Projectの状況を知りたい]
      │
      ▼
[T: Project Viewを受け取る]
      │
      ├── Coverage complete ──> [U: 根拠を確認して判断]
      │
      ├── partial／stale ─────> [R: 不足Sourceと観測時点を確認]
      │
      ├── conflicting ────────> [R: 競合を保持し、所有者へ確認]
      │
      └── credential_required ─> [R: 開示済みSourceだけ接続を切替]

--------------------------- 可視境界 ---------------------------
                              │
                              ▼
                [S: SourceとAccessをRequestごとに再確認]
                              │
                [S: Projectionを正本へ書き戻さない]
                              │
                [S: Candidateと採用Authorityを分離]
```

| 重要場面 | 利用者が理解すべきこと | 回復接点 | 避ける体験 |
|---|---|---|---|
| 初回Local利用 | 現在Repositoryだけで開始できる | 必要時だけ横断利用を提案 | 最初にServer構築やFederation設定を要求する |
| Project Viewが部分的 | 何が取得でき、何が不足するか | Source再取得、正本確認、適切なCredentialへの接続 | 欠測を空・正常・0件へ畳む |
| Sourceが競合 | どのSourceが競合し、誰が解決するか | 所有正本または判断主体へ戻る | AIがもっともらしい一つへ統合する |
| 別Credentialが必要 | 対象の存在開示は許可済みで、現在接続だけが不足する | Client側のCredential切替と再接続 | 共通Password、RoleまたはUnlock表示からAuthorityを生成する |
| 存在開示不可 | 利用者が知り得ない対象は結果へ現れない | なし | Repository名、件数、鍵表示から存在を漏らす |
| Candidateを作成 | まだ正本へ採用されていない | 内容比較、人間判断、所有Command | クリックやAI提案だけで採用済みと表示する |
| Remote応答喪失 | 要求・Effect・結果搬送のどこまで成立したか不明 | 同じRequestの状態確認 | 新規Requestとして自動再送する |
| 古いViewを再表示 | Revisionと観測時点が古い | 明示更新または正本へ戻る | 前回値を現在値として無印表示する |

<a id="workbench-mcp-service-blueprint"></a>

## 6. 共同Service Blueprint

列は画面や機能ではなく、利用者が目的を達成する時間順のStepを表す。

| 責務 | Contextを選ぶ | 接続・利用範囲を確認する | 現在地を理解する | 根拠を調べる | 判断・候補操作を行う | 失敗後に戻る |
|---|---|---|---|---|---|---|
| 利用者 | Repository、ProjectまたはPortfolioから目的に合う単位を選ぶ | 接続先と利用可能範囲を確認する | 状態、注意、判断待ち、不足を読む | Source、Revision、経緯へ進む | 判断、Candidate作成または既存Commandを選ぶ | 同じRequest、Sourceまたは判断対象へ戻る |
| 利用者接点 | Local AI／CLI、Workbench、Remote AI | Local／Sharedの区別、開示可能なWorkspace | Project／Portfolio View、Source Coverage | 正本導線、時系列、競合Source | 判断要求、Candidate、構造化結果 | Stale、partial、unknown、再接続／再取得導線 |
| Chat／Coding Agent | Taskに必要な単位を提案する | 未許可Contextを要求・推測しない | 搬送されたContextから回答し、不足を示す | Source表明を返すが内部使用証明とはしない | 人間Authorityを必要な判断へ戻す | 会話全文やObjectiveの再入力を要求しない |
| Workbench | 選択肢を人間向けに投影する | Credential切替可能な既知範囲だけを示す | 同じ公開結果を視覚的に比較可能にする | 結論から正本へ案内する | 既存Application／Command／Candidate入口へ渡す | UI専用状態で成功へ補正しない |
| MCP／Adapter | 要求を意味変更せず搬送する | 認証結果とRequestを結合する | 公開結果を閉じたSchemaで返す | 選択・搬送したSourceを相関する | 接続をEffect Authorityへしない | 同一Requestの再取得で現在Accessを再確認する |
| Project Operation／CROS | Project、Repository、Sourceを解決する | Workspace、Exposure、既存Constraintを照合する | 欠測・制限・競合・古さを保持して投影する | 正本OwnerとRelationを解決する | Candidateと正本更新、判断と実行を分ける | 二重Effectを防ぎ、unknownをRecoveryへ接続する |
| Repository／Runtime | 検証済みBindingと現在Revisionを提供する | 実際のAccess／Authorityを所有する | canonicalな状態と根拠を返す | 正本と履歴を保持する | 専用CommandだけがEffectを発行する | 終了状態、残存義務、再入場条件を返す |
| 情報・引継ぎ | Project／Repository Identity | Credential、Workspace、Request Access Context | PropertyごとのSource、Revision、Observed At | Relation、Evidence、Current／Historical | Decision／Candidate／Operation Identity | 同じRequest Identity、現在Access、Recovery参照 |
| 支援・共有／引継ぎ | 選択できないContextは理由と支援先を示す | 接続・開示の不足を次の担当へ安全に渡す | ViewのSource Coverageを共有する | 正本参照と競合を意味変更せず渡す | Candidateと未完了判断を採用済みに変えず渡す | 失敗地点、保持された情報、禁止操作、再入場条件を引き継ぐ |
| 時間役割・代替投影 | 一時的な選択と耐久的なProject Identityを分ける | Session中のAccessと継続するRepository Exposureを分ける | 同じ対象のProject／Portfolio／Repository Viewを現在の観測へ結合する | CurrentとHistoricalを区別し、別Viewでも同じSourceへ戻す | 一時Candidateと耐久的な正本変更を分ける | 古い投影を現在値にせず、再取得で同じ対象へ戻す |

## 7. 既存Toolから継承する利用体験

起動時に利用者やフロントAIがShell、文字コード、入出力の転送を毎回組み立てない。繰り返し使う操作は[共通起動入口](../19_Workflows/01_Coordinator_Runtime.md#common-launch-entry)へ固定する。安全に拒否するだけでなく、端末の接続誤りを人間への入力要求より前に説明し、通常操作と自動処理を取り違えず開始できることを確認する。端末ウィンドウの作成・表示保持は呼出し元が所有し、起動入口だけで画面の可視性を保証したとはしない。

次の表は画面一覧ではなく、依頼から終了までを時間順に表したサービスブループリントである。通常利用と、途中で止まる分岐を同じ依頼へ結び付ける。

| 責務 | 導入を判断する | 利用境界を設定する | 依頼する | 実行を待つ・必要なら取消す | 結果を判断する | 停止後に回復する |
|---|---|---|---|---|---|---|
| 利用者の行動 | 能力・制限・必要環境を読む | 対象RepositoryとProvider境界を確認し、公式認証を行う | 目的・受入条件・読取／変更範囲を伝える | 通常は別の仕事をする。取消が必要なら要求する | 差分と検証結果を確認し、採用または破棄を判断する | 残存と識別情報を確認し、許可された復旧だけを行う |
| 利用者に見える応答 | 利用条件と未保証範囲 | 設定対象・影響・拒否方法。秘密入力は専用入口 | 対象と範囲。情報不足なら不足項目 | 実行者・選定理由。入力待ちと処理待ちを区別 | 作業結果、候補、期限、回収・再起動の要否 | 通常再試行できない理由、正確なIDまたは担当者への引渡し |
| フロントAIの責務 | Runtimeが不要なら使わない | 既存許可を確認するが新しい同意を捏造しない | 要求を具体化し、秘密を除外した読取り投影を指定する | 同じ境界の再承認を反復しない。進捗を捏造しない | 機械結果を解釈し、未確認事項を人間へ返す | IDや成功を推測せず、停止理由を保持する |
| Runtimeの責務 | 配布・環境・対象を検査 | 有効な同意と毎回の実行許可を分離 | Revision・範囲・Authorityを検査 | 隔離実行、独立確認、取消・回収を所有 | 検証した候補と終了状態を公開 | exactな回復条件を検査。不明なら停止 |
| 情報と引継ぎ | README→仕様・品質状態 | Repository、選択ユーザー、Policy | 同じ依頼と開始Revision | 同じOperation。待機後も許可・Identityを再確認 | Candidateと対象Revision。完了≠採用 | Recovery IDと所有資源。元の依頼との関係を保持 |
| 失敗時の体験 | 導入不能を通常利用可能と表示しない | 不表示・拒否・期限切れ・認証不足なら未実行と区別 | 入力不正やRepository違いを実行前に説明 | timeout・取消・親Process消失を成功へ変えない | 不正候補・期限切れ・回収不明を採用可能としない | 清掃不能を「完了」とせず、残る影響を説明 |

Checkerの流れは「対象と範囲を選ぶ→検査を実行→指摘／未確認を読む→責務を持つ文書を修正→再検査」。指摘0でも検査範囲外は残る。開発者の流れは「固定候補を作る→秘密不要の開発検証→収束した候補の公式署名・実測→配布判断」。一般利用者の通常実行と混ぜない。

<a id="milestone-delegation-experience"></a>
<a id="6-milestoneを委ねる利用体験"></a>

## 8. Milestoneを委ねる利用体験

本節はv0.19.0で公開したProject Runtimeの利用体験を定義する。公開範囲は、認証済みのCLI／MCP入口から一つのProjectとMilestoneを扱う現在の契約に限る。

v0.19では、人間がTaskを一件ずつ分解・起動・監視する体験から、対象ProjectとMilestone、保持する意図、受入条件および判断権限を示し、Project Runtimeへ進行を委ねる体験へ拡張する。人間が内部Taskの切替や空いた実行枠ごとに承認を繰り返すことを正常経路にしない。

この体験の認知意図（Cognitive Intent）は次である。現在状態は、[v0.18の実務自己適用で観測した人間による進行追跡・反復操作](../99_Roadmap/Changes/CHG-000055/change.md#26-実務評価と最終確認への引渡し)を根拠にした設計仮説として、「内部TaskやAgent Logを追わないと、何が進み、何を判断すべきか分からない」と置く。全利用者について実証済みの事実とはしない。主な障壁は実行状態・品質・判断待ちの混在と内部情報の過多、目標状態は「Milestoneがどこまで成立し、次にRuntimeが何を行い、人間が今判断すべき事項があるかを理解できる」とする。必要な根拠／情報は、Objectiveの受入状態、Task内訳、Dependency、Critical Path、Blocker、Risk、Human Decision、Integration State、Quality StateおよびNext Actionである。意図する判断／行動は、判断不要なら作業をRuntimeへ委ね続け、必要な場合だけ提示された選択肢から判断することである。

利用者は、現在のMilestone、Objective、完了／実行中／依存待ちのTask、Critical Path、Blocker、Risk、Human Decision、Qualityおよび次の行動を、Worker Logを読まずに理解できる必要がある。推定Progressや未観測の残時間を事実として表示せず、進捗と成立品質を分ける。

RuntimeはTask失敗だけで人間へ戻さず、計画維持、影響部分の再計画、人間判断が必要な変更を分ける。人間へ戻す場合は、発生事象、現在Planを維持できない理由、影響するObjective／Milestone、選択肢、推奨、保留時の扱いを一つの判断単位として示す。Scope変更、Authority不足、価値判断またはRisk受容を内部再計画へ隠さない。

MCPで判断を返す場合も、人間は内部TaskやLockを操作しない。現在の判断要求に表示された選択肢を選び、必要な場合だけコメントを添える。古い画面や別Milestoneの判断を送った場合は安全に拒否され、現在有効な判断要求へ戻れる。MCP接続やProviderの存在だけで人間の判断済みとは扱わない。

判断送信後の表示は、Project Stateへの適用前を「未受理」、DecisionとMilestoneがProject Stateへ適用済みでQueueがまだLeaseされていない正当な中間状態を「判断受理済み・安全に再開待ち」、QueueのLease後を「再開権を確保」と区別する。実Taskが`running`へ進んだ後だけ「実行再開」と表示する。中間状態を失敗や未受理へ戻して見せず、QueueのLease前に再開済みと表示しない。利用者へ内部の保護RecordやLock操作を要求せず、Runtimeが再照合と安全な再開を継続する。

接続が切れた場合、利用者は同じObjective要求を同じrequest identityで再送できる。Runtimeは作業を重複起動せず、最新の進捗、現在の判断要求または終端結果を返す。一般Project検索はv0.19へ追加せず、別Projectや別requestの状態を推測して表示しない。判断用の継続CapabilityはClientが内部保持し、人間へ確認コードの転記を求めない。Capabilityが期限切れ・消費済み・別主体の場合は新しい判断を適用せず、現在状態と再接続に必要な処置を示す。別主体や誤入力で正当利用者のCapabilityを失効させない。Capability応答を受け取れなかった場合は、Clientが同じObjective接続内で明示的に置換を要求し、Runtimeが旧Capabilityの失効を確認してから新しい1件だけを返す。判断送信後に応答が失われても、再送によってMilestoneやTaskを二重に開始しない。

対話中の作業とスケジュール実行が同じProjectへ到着した場合、利用者へ競合解消を丸投げせず、対話中の作業を優先してスケジュール作業を待機させる。安全に独立した読取りや隔離候補の作成は継続できるが、正本への採用は一つずつ行い、待機中、実行中、再計画待ちを区別して示す。待機Taskごとの再承認は要求せず、Scope変更、基準Revisionの意味変更または解決不能な競合だけを人間へ返す。

この体験の成功は、並列数ではなく、採用可能な統合結果までの時間、人間の実作業時間、不要な確認と反復、統合時の競合および品質で評価する。MCP、CLIその他の入口は同じ意味と停止条件を投影し、Transportごとに別のProject Modelを持たない。

## 9. 体験原則と代替の比較

### Checkerと内部部品で異なる体験

Checker利用者は、対象Rootを明示し、全体か限定かを選び、指摘と未確認を読んで文書を直す。通常は同意コードもProvider認証も不要である。exit 0でも警告や未確認が残るため、「検査が終了した」と「必要な品質確認が済んだ」を読み分けられることを求める。操作は[Checker手順](../19_Workflows/02_Checker.md)へつなぐ。

platform-accessは独立した利用者画面を持たないが、利用者への影響がないわけではない。観測拒否ならTask開始可否へ、初期化失敗なら作成可能性と回収へ、修復失敗なら通常再試行の停止へ伝わる。利用者にbinary protocolを解読させず、[内部部品の利用契約](../05_SPEC/01_Behavior_Specification.md#platform-access-contract)に従って上位の診断・結果・復旧へ投影する。

望む認識は「誰に何を任せたか分かり、必要な地点だけ自分が判断できる」。避けるのは、読めない内部コードの羅列、無反応、完了したか分からない状態、過剰な確認による見せかけの安全性である。親しみやすさのために危険・不明・未完了を隠さない。

| 比較した構造 | 評価と今回の扱い |
|---|---|
| すべてを人間がCLIで指示し毎回確認する | 制御対象は見えるが、人間に構文・内部状態・情報運搬を要求する。承認済みの軽量利用方針に合わない |
| フロントAIが依頼を整え、境界内をRuntimeが実行する | 採用済みの方向。必要な判断と通常処理を分けられる。ただし表示と呼出し元の解釈が正しく接続される必要がある |
| すべてを無確認で実行する | 許可外の送信・破壊的効果・統合まで拡張するため、保持するAuthority境界と両立しない |

新しい設定を増やす前に、既存の境界再利用、固定の安全規則、呼出し元による案内で足りるかを確認する。モデル・推論量の選定理由は説明できるようにするが、内部の全検査を人間に読み切らせることを目標にしない。

<a id="4-制御信頼検証義務"></a>

## 10. 制御・信頼・検証義務

以下はUXが所有する成果条件であり、実装済み・実測済みという宣言ではない。検証方法は[検証設計](../07_Quality/03_Verification_Design.md#tool-user-experience-verification)へ接続する。

- 初回導入と通常実行を区別し、一般利用者はRelease鍵を入力・保持しない。
- 許可した同一境界では不要な再承認を要求しない。境界変更や失効時は変更点と必要な判断を理解できる。
- 入力待ち、実行中、取消処理中、終了、判定不能を混同しない。時間・進捗率は観測できたものだけを示す。
- 候補の生成、独立確認、人間による受入、正本への反映を区別する。
- 失敗・回復では「次の操作」「まだ行ってはならない操作」「人間に残る負担」を理解できる。
- 認証は公式Providerの入口を使う。ソースの読取り範囲を限定し、秘密をプロンプト・ログへ直接渡さない。
- 同じ課題の反復確認、二重入力、余分な端末操作を測る。時間短縮や利用量分散の優位を試験件数だけで主張しない。

## 11. 認知意図と体験表現意図

### 11.1. 認知意図

| 要素 | 内容 | 根拠・状態 |
|---|---|---|
| 利用者目標 | 今のProjectで何が起き、何を判断でき、次にどこへ進むかを理解する | Discoveryから継承 |
| 現在状態 | 複数正本、Repository、実行状態および判断待ちを利用者またはAIが再構成している | CRDD自己適用の観測。一般利用者への頻度は未確認 |
| 主な障壁 | 情報の分散、欠測の不可視化、内部状態の過多、接続とAuthorityの混同 | 根拠付き仮説 |
| 必要な認知変化 | 「全体が分かった」ではなく「分かった範囲と、まだ判断できない範囲が分かった」へ変える | 候補 |
| 必要な根拠／情報 | Source Identity、Revision、Observed At、Coverage、判断待ち、Current／Historical、次の安全な操作 | IAへの義務 |
| 目標状態 | 利用者が内部TaskやRepository構造を覚えず、根拠と不完全性を確認して判断できる | 検証待ち |
| 意図する行動 | 判断不要なら作業を継続し、必要時だけ正本、Credential切替、Candidate確認または人間判断へ進む | 検証待ち |

Resolverが選択したContext、AIへ搬送したContext、AIが結果中で報告したSourceおよびモデル内部の使用を区別する。UX上も「AIが確認した」「AIが使用した」と断定せず、「この回答へ提供したSource」「AIが参照元として示したSource」と表示できる意味をIA／UIへ渡す。

### 11.2. 体験表現意図

| 場面 | 望む印象 | 避ける印象 | 下流への義務 |
|---|---|---|---|
| Project／Portfolioの概観 | 落ち着いて現在地を把握でき、根拠へ降りられる | すべて正常に見える装飾、断定的な自動Score | 状態とCoverageを同じ視覚優先度で認識可能にする |
| 判断待ち | 自分が判断すべき理由と影響が分かる | 内部IDや技術エラーの羅列、急かす表現 | 事象、理由、影響、選択肢、推奨、保留時の扱いを一単位にする |
| Restricted／Unavailable | 取得不能と権限不足を混同せず、開示可能な次操作が分かる | 鍵表示だけ、存在漏えい、推測による補完 | 状態ごとに異なる説明と操作可能性を保つ |
| Candidate操作 | 試案と採用済み成果物を明確に区別できる | ボタンを押しただけで正本が変わったように見える | Candidate状態、比較、Authority、反映結果を段階表示する |
| Remote応答喪失 | 何が不明で、重複させず何を確認するか分かる | 無反応、成功表示、無条件のRetry | Request Identityを保持した状態確認を第一導線にする |

固定した色、Layout、UI Component、Frameworkまたはブランド表現は本工程で決めない。親しみやすさを理由に、危険、不明、Restrictedまたは未完了の強度を弱めない。

### 11.3. 制御と適応の必要性

具体的な値、保存方式または権限Roleは後続工程で決める。UXでは、誰が何をなぜ調整する必要があり、どの処置候補へ渡すかを固定する。

| 調整対象 | 調整主体 | 必要な理由 | 処置候補 | 変更・撤回・リセット | 採用しない場合の影響 | 下流Owner |
|---|---|---|---|---|---|---|
| Local／横断入口の選択 | 利用者 | 日常作業へ不要なServer理解を持ち込まない | 利用者選択 | Taskまたは目的の変化時に切替可能 | Local作業の開始負荷、または必要Source不足 | IA／UI |
| 表示するProject／Source範囲 | Organization／Repository Owner | 開示可能範囲と論理Projectの構成が環境で異なる | 組織方針 | Exposure変更・撤回後に再評価 | 存在漏えい、または必要Projectの欠測 | Architecture／SPEC |
| Projectionの粒度と既定View | 利用者／Project Owner | Developer、PM、Managementで必要な比較単位が異なる | 利用者選択または組織方針 | 既定値を変更・リセット可能にする必要性を下流で評価 | 情報過多、根拠喪失、単一Scoreへの誤認 | IA／UI |
| Remote接続と結果保持 | Runtime Owner | Network、Credential、応答喪失時の継続条件が異なる | Runtime構成 | 失効・再接続・同一Request再取得を可能にする必要 | 重複Effect、結果喪失、古いAccessの継続 | Architecture／SPEC |
| Candidateから採用への進行 | 成果物の決定権限者 | 成果物種別ごとに所有Commandと判断主体が異なる | 固定規則 | 採用前は撤回・再生成でき、採用後は所有正本の変更契約へ戻す | 試案の自動採用、または判断不能な停滞 | IA／SPEC |
| Workbench機能の拡張 | Product Owner | 比較価値が未実証で、Surface肥大化を避ける | 保留 | 比較検証後に採否を再評価 | 未実証機能の維持Cost、または必要操作の不足 | Verification／Roadmap |

<a id="workbench-comparison-verification"></a>

## 12. 代替利用と成功・失敗の確認

Workbenchの採用済み範囲は最小実装を比較可能にすることであり、Workbenchが常に優位という結論ではない。同じ代表課題を次の入口で比較する。

| 比較対象 | 利用者が行うこと | 保持する共通条件 |
|---|---|---|
| AI＋stdio／localhost MCP | 自然言語で現在地を質問し、必要なら正本を辿る | 同じProject、Source集合、現在Revision、判断課題 |
| 静的Report | 生成済みのProject情報から判断対象と根拠を探す | 生成時点とStale条件を明示する |
| 薄いLocal Workbench | Project Viewから不足、判断待ち、根拠、定型操作へ進む | 同じ公開Application結果を使う |
| Remote MCP＋Shared CROS | 別Hostから同じ課題を実行し、応答喪失後に戻る | 現在Credential、Workspace、同一Request Identityを使う |

| 観点 | 成立の兆候 | 失敗・反証 |
|---|---|---|
| 目標完了 | 必要な判断対象または正本へ到達できる | 表示・回答を得ても何を判断すべきか分からない |
| 不完全性の理解 | 欠測、制限、競合、古さを正しく識別できる | partialをcomplete、unavailableをrestrictedと誤認する |
| 根拠追跡 | SourceとRevisionへ戻れる | 出典のない要約または古いSourceを現在値として使う |
| 認知・操作負荷 | 再探索、追加質問、記憶、転記、操作迷いが比較対象より減る | Workbench理解のためにCRDD内部構造を追加で覚える |
| Authority理解 | 接続、閲覧、候補、採用、Effectの違いを誤認しない | UnlockやMCP接続を実行許可と扱う |
| 回復 | 応答喪失後に二重Effectなく同じ要求へ戻れる | 新規実行、結果喪失または権限縮小後の情報漏えい |
| Accessibility | Keyboard、拡大、折返し、支援技術でも状態と次操作を理解できる | 色、Hover、狭い表示または専門語だけに意味を依存する |
| 維持Cost | UI専用正本、独自状態、重複契約を増やさない | Workbench更新のたびにProjectの意味を別実装する |

時間だけを成功指標にせず、人間の実作業時間とAI／Tool処理時間を分ける。クリック数、画面表示、MCP応答、AIの自己評価または試験件数だけから理解成立を推定しない。外部PM／Management需要と一般化可能性は、自己適用だけでは確定しない。

## 13. 網羅状態と次工程への義務

| UX責務 | 状態 | 未確認範囲・次の処置 |
|---|---|---|
| 起点、対象者、解決策から独立した成果 | `Complete for Scope` | 外部利用者の頻度と優先度は実利用で再評価する |
| Developer／Operator／PM／Management／Remote／外部Toolの利用状況 | `Complete for Scope` | 固定Roleや権限Groupへ変換しない |
| Discovery要求候補とUX成果の全数対応 | `Complete for Scope` | UXへ引き渡された12件を`UX-000001@1`～`UX-000010@1`へ全数対応した。後続工程で新しい要求を発見した場合は差分を再評価する |
| 役割別Journey | `Complete for Scope` | IA／UI／SPECで情報・状態・操作へ具体化する |
| 重要場面・失敗／回復 | `Complete for Scope` | Remote応答喪失、Credential失効、権限縮小を実境界で反証する |
| Service Blueprint、支援・共有／引継ぎ、時間役割・代替投影 | `Complete for Scope` | 各Owner、Port、Transportの実装方式はArchitectureが所有する |
| 制御・適応の必要性 | `Complete for Scope` | 固定規則、利用者選択、組織方針、Runtime構成、保留の候補をIA以降で評価する |
| 認知意図・体験表現意図 | `Complete for Scope` | 利用者評価で理解と誤認を観測する |
| Workbenchの比較価値 | `Unproven` | AI＋MCP、静的Report、Workbenchを同じ代表課題で比較する |
| UX全体 | `Ready for IA Decision` | 人間が理解する順序への再構成、12要求の全数対応および独立レビューを完了した。Qual-Labが内容と未確認範囲を確認してIA移行を判断する |

IAへは、Project／Repository／Sourceの段階的な見せ方、PropertyごとのSource／Revision／Observed At、Coverage、Current／Historical、判断待ち、Candidate、Credential切替可能性、Request状態および正本導線を渡す。UIとSPECへは、状態・重要度・次操作を色や位置だけへ依存させないこと、接続／閲覧／Candidate／採用／Effectを区別すること、応答喪失時に同一Request確認を第一導線とすることを渡す。

未確認のWorkbench比較効果はIA設計を止めないが、UI機能拡張またはWorkbench優位の外部主張には使わない。Remote Transport方式、公開Capabilityの最終OwnerおよびSchemaはUXで決めず、後続工程で本UX成果を満たす代替を比較する。

## 14. 現在状態と引渡し

本書は既存実装と人間の要求から再構成した候補であり、過去の工程移行承認を遡及して作らない。2026-09-13、人間の決定権限者は独立レビューPass後の[統合したDiscovery判断](../01_Discovery/01_Product_Discovery.md#current-discovery-decisions)を確認し、v0.21のUX工程への移行を承認した。新しい安定IDや要求を自己決定せず、今回の追跡には文書とアンカーを用いる。

既存Tool UXでは、導入、依頼、待機、結果、取消・復旧、Checker、開発・配布の責務を§7へ整理し、v0.19 Project Runtimeの委任体験を§8へ保持した。未取得情報の表示、意味説明、候補操作は実装と限定再確認を終え、PowerShellでは入力・日本語表示・折返し・拡大を限定確認した。実Task取消は是正後の署名版4f10201で通常回収まで観測し、今回差分の限定独立確認済みである。説明未登録の理由、別の端末環境、支援技術は[UIの未解決事項](../04_UI/01_User_Interface.md#open-issues)へ接続し、既存Tool全体の工程網羅状態は`Blocked`を維持する。§7と§8はv0.21共同UXが保持する継承入力であり、共同UXの完成判定には含めない。

v0.21 Workbench／MCP共同UXは、§1～§6および§9～§13で、Discoveryから利用者成果、Journey、失敗・回復、提供責務、制御・適応および検証意図までを人間が理解する順序へ再構成した。2026-09-13の独立レビューはCritical／Major／Moderate 0でPassした。既存Toolの限定実測を共同UXの成立根拠へ流用せず、現在状態は`Ready for IA Decision`とし、Qual-Labが内容と未確認範囲を確認してIAへの引渡し可否を決める。

次工程の[情報構造](../03_IA/01_Information_Architecture.md)と[UI](../04_UI/01_User_Interface.md)は、この候補の照合先であって承認済み引渡しではない。既知差の所有者・再確認条件は[UIの未解決事項](../04_UI/01_User_Interface.md#open-issues)、v0.21のProject Operation／Workbenchは[CHG-000067](../99_Roadmap/Changes/CHG-000067/change.md)へ接続する。Qual-Labが本UXの内容、未確認範囲および独立レビューを確認してIA移行を判断する。

## 15. 基本図の処置

| 基本図 | 対象 | 目的 | 処置 | 現行図／一意な参照／理由 | 投影元改訂版 | 現在状態 | 未確認範囲 | 次の処置・再評価契機 |
|---|---|---|---|---|---|---|---|---|
| 利用者Journey | CRDD内部Tool利用者、Project参加者 | 導入から依頼、判断、回復までの体験順序 | 作成 | [役割別Journey](#workbench-mcp-role-journeys) | v0.21 Candidate | 候補 | Workbench比較効果と外部利用者の行動 | 自己適用と利用者評価で更新する |
| 重要場面・失敗／回復体験図 | Project ViewとSource Coverage | 不完全な投影から誤った判断へ進まず、根拠または回復接点へ戻る場面の可視化 | 作成 | [重要場面と失敗・回復](#workbench-mcp-critical-recovery) | v0.21 Candidate | 候補 | 実利用時の認知と操作 | Remote接続、Candidateおよび権限変化は同節の表と役割別Journeyで補い、UI／SPECと実境界検証へ接続する |
| Service Blueprint | Workbench／MCP共同利用の端から端 | 利用者、Surface、公開契約、CROS、Sourceの責務整合 | 作成 | [Workbench／MCP共同Service Blueprint](#workbench-mcp-service-blueprint) | v0.21 Candidate | 候補 | 実装後の待機・支援・運用負担 | IA、UI／SPECおよびArchitectureへ引き渡す |
