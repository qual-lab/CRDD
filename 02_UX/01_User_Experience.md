# CRDD／CROSの利用体験

状態: Candidate（v0.21.0、Released Baseline: v0.20.1）
担当責任者: Qual-Lab
最終更新日: 2026-09-14
工程規則: [UX](../22_UX.md)

## 1. 何を良くしたいのか

CRDDを使う人が本当に知りたいのは、内部のDirectoryやRuntimeの構造ではない。「今どうなっているか」「自分は何を判断すべきか」「次に何が起きるか」を、必要な根拠とともに理解できることを目指す。

現在は、単純な状況確認でもChat Agent、Coding Agent、Git Client、Repository内の文書や実行logを行き来し、利用者自身がProjectの現在地を組み立て直す場面がある。横断機能を使うために、普段のRepository作業まで複雑にすることも避けたい。

そこで、日常の開発は対象Repositoryのまま続け、Project全体を見たいときだけCROS／MCP、短時間で確認・比較・定型操作をしたいときだけWorkbenchを使う体験を作る。標準を保守・配布する人、Runtimeを導入・回復する人、外部Contextを扱う人も、内部実装を推測せず、現在状態、根拠、許可範囲および次の安全な行動を理解できるようにする。入口が違っても、同じ正本、同じ公開契約、同じ判断境界へ到達する。

| 現在起き得ること | 目指す体験 |
|---|---|
| 状態を知るために複数の文書・log・会話を辿る | Projectの現在地、欠測、判断待ち、次の行動を一つの入口から理解する |
| Chat AgentとCoding Agentの間を人間が転記する | 構造化したContextと同じTask Identityで往復する |
| 横断機能のために日常のRepository作業まで変える | Local作業は単独で成立し、必要なときだけ横断する |
| 接続できたことを、内容の完全性や実行許可と誤認する | 接続、閲覧、候補作成、採用、Effectを明確に分ける |
| 応答喪失時に新しい依頼としてやり直す | 同じRequest Identityの状態・結果・回復義務へ戻る |

### 1.1. 根拠、対象、対象外

利用者が内部の署名、資源管理、エージェント間の情報搬送を毎回操作せず、依頼、必要な判断、成果物の受入へ集中できることを目指す。安全に止まれるだけでなく、止まった理由と次に必要な行動が分かることも体験の成立条件とする。

本UXの主入力は、[Discoveryの統合判断](../01_Discovery/01_Product_Discovery.md#current-discovery-decisions)で採用した36件の要求である。Workbench／MCPだけでなく、CRDD標準の作成・保守、Runtimeの実行・配布・回復、外部Context、文書、検証およびVersion Controlを利用者体験として読み直す。§3.1で要求ごとのExperience Change、ペルソナ、体験区間、責任境界および品質期待を、§3.2～§3.5でCanonical UX成果への横断統合を示す。

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
| CRDD作成者・保守者 | 現在の課題、変更、成立条件および影響先 | 意図を工程へ引き渡し、変更・検証・公開を収束させる | 要求、利用側、証拠または残存不確実性を確認する必要がある |
| Runtime導入・運用者 | 配布物、設定、信頼条件、実行状態および回復義務 | 導入、更新、停止理由の理解、安全な回復・清掃を行う | Authority、Effectまたは現在状態を確認できない |
| 外部Contextの所有者 | 送信候補、送信先、利用目的、帰還結果 | 許可範囲を判断し、結果を候補として受け取る | 情報分類、許可または出所が不明 |

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

### 3.1. REQごとのUX分析

Discoveryで採用した36要求を一つずつ分析し、Experience Changeを先頭に、利用者または運用者の想定、利用前後、体験区間、Supporting Modelの処置、責任境界、重要場面、体験品質期待、妥当性確認および下流義務を外在化した。全体横断後は68件のCanonical UX成果へ接続し、同じ成果を共有する要求では個別分析にもSame判断の理由と、その要求が補う成立条件を残した。

| 要求 | 個別分析 | 現在のUX処置 |
|---|---|---|
| `REQ-000001` | [決定論的なRepository事前確認](Requirements/REQ-000001/user_experience.md) | UX成果統合済み・独立レビュー待ち |
| `REQ-000002` | [複数AI実行の範囲・権限・回復](Requirements/REQ-000002/user_experience.md) | UX成果統合済み・独立レビュー待ち |
| `REQ-000003` | [Objectiveから統合までのProject Lifecycle](Requirements/REQ-000003/user_experience.md) | UX成果統合済み・独立レビュー待ち |
| `REQ-000004` | [実行事実の再利用可能な記録](Requirements/REQ-000004/user_experience.md) | UX成果統合済み・独立レビュー待ち |
| `REQ-000005` | [Runtime責務と依存方向の分離](Requirements/REQ-000005/user_experience.md) | UX成果統合済み・独立レビュー待ち |
| `REQ-000006` | [Local MCP Transport間の意味統一](Requirements/REQ-000006/user_experience.md) | UX成果統合済み・独立レビュー待ち |
| `REQ-000007` | [出典と不完全性を保つProject View](Requirements/REQ-000007/user_experience.md) | UX成果統合済み・独立レビュー待ち |
| `REQ-000008` | [CROSなしで成立するRepository作業](Requirements/REQ-000008/user_experience.md) | UX成果統合済み・独立レビュー待ち |
| `REQ-000009` | [Project・Repository・Root Identity分離](Requirements/REQ-000009/user_experience.md) | UX成果統合済み・独立レビュー待ち |
| `REQ-000010` | [Workbench・MCP・CLIの公開契約共有](Requirements/REQ-000010/user_experience.md) | UX成果統合済み・独立レビュー待ち |
| `REQ-000011` | [Remote接続のWorkspace限定](Requirements/REQ-000011/user_experience.md) | UX成果統合済み・独立レビュー待ち |
| `REQ-000012` | [Meetingから候補を経た正本更新](Requirements/REQ-000012/user_experience.md) | UX成果統合済み・独立レビュー待ち |
| `REQ-000013` | [根拠と不完全性を保つPortfolio](Requirements/REQ-000013/user_experience.md) | UX成果統合済み・独立レビュー待ち |
| `REQ-000014` | [Repository Tool能力の明示Registry](Requirements/REQ-000014/user_experience.md) | UX成果統合済み・独立レビュー待ち |
| `REQ-000015` | [Runtime Data Rootの所有と用途](Requirements/REQ-000015/user_experience.md) | UX成果統合済み・独立レビュー待ち |
| `REQ-000016` | [AIモデルProfileの検証可能な外部構成](Requirements/REQ-000016/user_experience.md) | UX成果統合済み・独立レビュー待ち |
| `REQ-000017` | [出所付きContext Packageの解決](Requirements/REQ-000017/user_experience.md) | UX成果統合済み・独立レビュー待ち |
| `REQ-000018` | [Runtime Trust要素の分離](Requirements/REQ-000018/user_experience.md) | UX成果統合済み・独立レビュー待ち |
| `REQ-000019` | [契約移行時のConsumer閉包](Requirements/REQ-000019/user_experience.md) | UX成果統合済み・独立レビュー待ち |
| `REQ-000020` | [欠測・競合を保つRepository Federation](Requirements/REQ-000020/user_experience.md) | UX成果統合済み・独立レビュー待ち |
| `REQ-000021` | [Remote要求結果の同一Identity再取得](Requirements/REQ-000021/user_experience.md) | UX成果統合済み・独立レビュー待ち |
| `REQ-000022` | [Runtime Dataの保持・清掃・回復](Requirements/REQ-000022/user_experience.md) | UX成果統合済み・独立レビュー待ち |
| `REQ-000023` | [異なるAI Runtime LifecycleのAdapter分離](Requirements/REQ-000023/user_experience.md) | UX成果統合済み・独立レビュー待ち |
| `REQ-000024` | [境界を越えるTask結果の帰還](Requirements/REQ-000024/user_experience.md) | UX成果統合済み・独立レビュー待ち |
| `REQ-000025` | [Deployment Ownerが所有するTrust Policy](Requirements/REQ-000025/user_experience.md) | UX成果統合済み・独立レビュー待ち |
| `REQ-000026` | [判断・監査・是正の収束可能な閉包](Requirements/REQ-000026/user_experience.md) | UX成果統合済み・独立レビュー待ち |
| `REQ-000027` | [外部Contextの送信・昇格境界](Requirements/REQ-000027/user_experience.md) | UX成果統合済み・独立レビュー待ち |
| `REQ-000028` | [AI入口と共通正本の分離](Requirements/REQ-000028/user_experience.md) | UX成果統合済み・独立レビュー待ち |
| `REQ-000029` | [推論Contextの履歴・現行性・選択](Requirements/REQ-000029/user_experience.md) | UX成果統合済み・独立レビュー待ち |
| `REQ-000030` | [段階的実境界試験と回帰選択](Requirements/REQ-000030/user_experience.md) | UX成果統合済み・独立レビュー待ち |
| `REQ-000031` | [人の理解順と構造を両立する成果物](Requirements/REQ-000031/user_experience.md) | UX成果統合済み・独立レビュー待ち |
| `REQ-000032` | [工程固有の基本図と意図引き渡し](Requirements/REQ-000032/user_experience.md) | UX成果統合済み・独立レビュー待ち |
| `REQ-000033` | [Work LifecycleとEvidence所有の分離](Requirements/REQ-000033/user_experience.md) | UX成果統合済み・独立レビュー待ち |
| `REQ-000034` | [Repository固定Commitから使える標準Tool](Requirements/REQ-000034/user_experience.md) | UX成果統合済み・独立レビュー待ち |
| `REQ-000035` | [公式視覚素材の権利・用途・追跡](Requirements/REQ-000035/user_experience.md) | UX成果統合済み・独立レビュー待ち |
| `REQ-000036` | [差し替え可能なVersion Control境界](Requirements/REQ-000036/user_experience.md) | UX成果統合済み・独立レビュー待ち |

### 3.2. Discovery要求からUX成果への統合対応

全36要求を、利用者目標、観察可能な利用前後、重要場面、失敗条件、品質期待および下流義務が独立して変化・検証できる単位へ分解した。既存10件の意味は保持し、過度に粗かった成果を追加分割した結果、CanonicalなUX成果は68件となった。要求との関係は多対多であり、同じ成果へ複数要求を接続した理由は各`user_experience.md`にも記録する。

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
| `UX-000011@1` 決定論的な事前確認 | `REQ-000001` | 同じ対象と条件なら、意味レビュー前に同じ機械的不備を確認できる | 標準変更Journey | 同じ入力の結果差と非決定的な探索を反証する | 対象、検査条件、結果を関連付ける |
| `UX-000012@1` 行動可能な機械指摘 | `REQ-000001` | 対象箇所と直せる理由を理解し、意味判断との境界を誤認しない | 標準変更Journey | Path不明、理由不明、意味監査の合格表示を拒否する | Finding、Location、Responsibilityを分ける |
| `UX-000013@1` 委任範囲と権限の理解 | `REQ-000002`／`REQ-000003` | 実行前に何を誰へどこまで任せるか理解できる | Milestone委任、Runtime Blueprint | 暗黙のScope拡張とAuthority生成を拒否する | Objective、Scope、Actor、Authorityを分ける |
| `UX-000014@1` 委任中の実行状態理解 | `REQ-000002`／`REQ-000003` | 内部logを読まず、実行中・待機・停止と判断要否を理解できる | Project Journey、Milestone委任 | 無反応、偽の進捗、停止中の実行表示を反証する | Task State、Decision、Next Actionを関連付ける |
| `UX-000015@1` 再試行と回復の選択 | `REQ-000002`／`REQ-000003`／`REQ-000021`／`REQ-000022`／`REQ-000024` | 失敗後に新規実行、状態確認、回復、清掃を取り違えない | Remote／Runtime回復Journey | 無条件Retryと二重Effectを反証する | Failure、Effect State、Recoveryを分ける |
| `UX-000016@1` Objectiveと受入条件の委任 | `REQ-000003` | Task列ではなく、達成したい目的と受入条件を仕事の入口にできる | Milestone委任 | 内部分解を利用者入力へ要求する経路を拒否する | Objective、Acceptance、Milestoneを関連付ける |
| `UX-000017@1` 部分成功と完成の区別 | `REQ-000003` | 個別Task成功と統合済みMilestone完成を取り違えず判断できる | Milestone委任 | Task件数から完成を推定する表示を拒否する | Task Result、Integration、Qualityを分ける |
| `UX-000018@1` 実行事実の出所追跡 | `REQ-000004` | 実行主体が異なっても観測時点と出所付きの事実を比較できる | Runtime運用Journey | 出所・時点のない値を拒否する | Execution、Observation、Sourceを関連付ける |
| `UX-000019@1` 未観測値の保持 | `REQ-000004`／`REQ-000007`／`REQ-000020` | 未観測、欠測、0、正常を取り違えず理解できる | Project View、Execution Intelligence | 空値を0や正常へ畳む反例を確認する | Observation StateとValueを分ける |
| `UX-000020@1` 事実・評価・改善候補の区別 | `REQ-000004` | 実行事実と後から行った評価・推定・改善提案を区別できる | Runtime運用Journey | 評価を観測事実として表示する経路を拒否する | Observation、Assessment、Candidateを分ける |
| `UX-000021@1` 内部変更後の公開体験維持 | `REQ-000005`／`REQ-000019`／`REQ-000023`／`REQ-000036` | 責務分離やAdapter差し替え後も同じ公開Capabilityを使える | 標準変更Journey | 内部Path変更による公開入口の退行を反証する | Public ContractとOwnerを分ける |
| `UX-000022@1` 故障範囲の理解 | `REQ-000005`／`REQ-000006`／`REQ-000023`／`REQ-000036` | 一部の入口・Adapter・外部境界の故障を全体故障と誤認しない | Runtime運用Journey | 無関係なCapability停止と全体成功表示を拒否する | Failure OriginとAffected Capabilityを関連付ける |
| `UX-000023@1` 移行後の成立済み能力維持 | `REQ-000005`／`REQ-000019` | 置換後も前版で使えた能力が維持・変更・廃止のどれか分かる | 標準変更Journey | 根拠のない旧処理削除を反証する | Previous Capability、Replacement、Evidenceを結ぶ |
| `UX-000024@1` Transport間の意味同値 | `REQ-000006`／`REQ-000010` | stdio、HTTP、CLI等で同じ入力・権限が同じ意味の結果になる | 共同Blueprint | Transport固有の業務状態や結果差を反証する | Public ResultとTransport Projectionを分ける |
| `UX-000025@1` 接続失敗と処理失敗の区別 | `REQ-000006`／`REQ-000010`／`REQ-000011` | 接続、認証、Runtime処理、結果搬送のどこで止まったか理解できる | Remote Journey | 一律の失敗表示を拒否する | Transport、Access、Execution、Deliveryを分ける |
| `UX-000026@1` Sourceと現行性への到達 | `REQ-000007`／`REQ-000013`／`REQ-000020` | 要約からSource、Revision、観測時点へ戻れる | Project／Portfolio Journey | 出典のない現在値を反証する | Property、Source、Revision、Observed Atを結ぶ |
| `UX-000027@1` 欠測・制限・競合の理解 | `REQ-000007`／`REQ-000013`／`REQ-000020` | 分かった範囲と判断できない範囲を同時に理解できる | 重要場面 | partial、restricted、stale、conflictingの混同を拒否する | CoverageとSource Stateを分ける |
| `UX-000028@1` 必要時だけの横断移行 | `REQ-000008` | Localで不足する理由を理解した時だけCROSへ進める | Developer Journey | 横断機能の強制と無断探索を拒否する | Local ContextとFederated Contextを分ける |
| `UX-000029@1` Project・Repository・Rootの対象確認 | `REQ-000009`／`REQ-000020`／`REQ-000024` | 論理Projectを一つに見ながら、操作対象のRepositoryとRootを取り違えない | Project Journey | 名前一致からIdentityを推定する操作を拒否する | Project、Repository、Root、Bindingを分ける |
| `UX-000030@1` Surface間の公開結果共有 | `REQ-000010`／`REQ-000028` | Workbench、AI、CLIが同じCanonical状態と結果を利用する | 共同Blueprint | Surface固有の第二結果を拒否する | Application Resultと各Projectionを分ける |
| `UX-000031@1` Credential不足と利用不能の区別 | `REQ-000011` | 別Credentialが必要、権限不足、一時障害、存在非開示を区別できる | Remote Journey | 鍵表示や一律Unlockを拒否する | Credential、Access State、Disclosureを分ける |
| `UX-000032@1` System管理能力とContent閲覧の分離 | `REQ-000011`／`REQ-000025` | 管理操作ができても未許可Contentを読めないことを理解できる | Remote／Trust Journey | 管理者Roleから閲覧権限を推定する経路を拒否する | System CapabilityとWorkspace Grantを分ける |
| `UX-000033@1` Meeting内容の意味分類 | `REQ-000012` | Transcript、観察、仮説、候補、決定を取り違えず確認できる | Topic／Meeting体験 | 会話を採用済み判断へ直結する経路を拒否する | Meeting Item TypeとSourceを分ける |
| `UX-000034@1` Topicの継続・新規判断 | `REQ-000012` | 既存TopicとのSame／Newを根拠付きで判断できる | Topic／Meeting体験 | 文字列一致だけの統合・分割を拒否する | Topic Candidate、Relation、Rationaleを結ぶ |
| `UX-000035@1` 許可範囲のPortfolio比較 | `REQ-000013` | 開示可能なProjectだけを、Coverage差を保って比較できる | Portfolio Journey | 非開示Projectの存在漏えいと単一Score断定を拒否する | Project Summary、Coverage、Disclosureを分ける |
| `UX-000036@1` Repository Tool能力の発見 | `REQ-000014` | 現在Repositoryで利用できる標準Toolと入口を確認できる | Local Journey | 未登録能力の推測表示を拒否する | Capability RegistryとLauncherを結ぶ |
| `UX-000037@1` 能力表示とEffect権限の区別 | `REQ-000014` | Toolが見えることと、その操作を実行できることを取り違えない | Local／外部Tool Journey | 一覧取得からAuthorityを発行する経路を拒否する | Capability、Availability、Authorityを分ける |
| `UX-000038@1` Runtime Data配置の理解 | `REQ-000015` | 何がどのRootへ何の目的で保存されるか理解できる | Runtime運用Journey | 用途不明の直下Fileと隠れたRepository外書込みを拒否する | Data Owner、Root、Purposeを結ぶ |
| `UX-000039@1` Durable・TemporaryのLifecycle理解 | `REQ-000015`／`REQ-000022` | 保持すべき記録と再生成可能な一時物を区別し、清掃条件を理解できる | Runtime回復Journey | 名前や経過時間だけの削除を拒否する | Durability、Retention、Cleanupを分ける |
| `UX-000040@1` AIモデル構成の妥当性理解 | `REQ-000016` | 選択Profileが有効か、未対応か、設定誤りかを実行前に理解できる | Runtime導入Journey | 未知設定の黙示代替を拒否する | Model Profile、Adapter Capability、Validationを結ぶ |
| `UX-000041@1` AIモデル選択と再選定理由 | `REQ-000016` | 実効モデル、選択理由および再選定条件を確認できる | Runtime運用Journey | コード埋込みの無説明選択を拒否する | Selection、Reason、Fallback Conditionを結ぶ |
| `UX-000042@1` 現在必要なContextの選択 | `REQ-000017`／`REQ-000029` | 対象変更に必要なIntent、Decision、Evidence、現行Hypothesisだけを受け取れる | Context往復Journey | 全量投入と古いContextの無印利用を拒否する | Context PackageとSelection Basisを結ぶ |
| `UX-000043@1` Context不足・競合時の非捏造 | `REQ-000017`／`REQ-000020`／`REQ-000029` | 不足や競合をAIの推測で埋めず、判断不能範囲を理解できる | Context／Project Journey | 暗黙統合と理由生成を拒否する | Conflict、Missing、Decision Ownerを分ける |
| `UX-000044@1` Secretと不要情報を含めないContext | `REQ-000017`／`REQ-000027` | 外部またはAIへ渡すContextが許可範囲の必要最小限だと確認できる | 外部Context Journey | Secret、会話全文、無関係Sourceの搬送を拒否する | Classification、Purpose、Projectionを結ぶ |
| `UX-000045@1` Runtime Trust要素の個別理解 | `REQ-000018`／`REQ-000025`／`REQ-000035` | 準拠、Integrity、Publisher、実行許可、公式表示を別々に判断できる | Runtime導入Journey | 一つのTrust表示やブランド表示への集約を拒否する | Conformance、Integrity、Publisher、Policyを分ける |
| `UX-000046@1` Deployment Owner所有のTrust Policy | `REQ-000018`／`REQ-000025` | 公式版、Fork、組織版、Local開発版の信頼条件を環境所有者が選べる | Runtime導入Journey | Qual-Lab署名だけを実行資格にする経路を拒否する | Publisher、Key、Policy、Deploymentを結ぶ |
| `UX-000047@1` 契約移行のConsumer閉包理解 | `REQ-000019` | 主経路だけでなく署名・Release・Recovery等の移行状態を確認できる | 標準変更Journey | 旧Contractを残したまま完成表示する経路を拒否する | Contract、Consumer、Migration Evidenceを結ぶ |
| `UX-000048@1` 再接続時のAccess再検証 | `REQ-000021` | 同じRequestへ戻る際も現在Credentialと開示範囲で結果を得る | Remote Journey | 古いSession Authorityの継続を拒否する | Request、Session、Current Accessを結ぶ |
| `UX-000049@1` 残存資源と清掃完了の理解 | `REQ-000022` | 残存の由来、影響、exactな再入場先および不存在確認を理解できる | Runtime回復Journey | 清掃要求の発行だけを完了とする表示を拒否する | Residue、Recovery Identity、Absence Evidenceを結ぶ |
| `UX-000050@1` Provider固有Lifecycleの正確な表示 | `REQ-000023` | Providerごとの利用可能性、停止、取消、回復差を理解できる | Runtime運用Journey | 設定可能を実行可能と表示する経路を拒否する | Provider CapabilityとLifecycle Stateを分ける |
| `UX-000051@1` Task結果の相関と完全性 | `REQ-000024` | Result、Evidence、未確認、Risk、帰還状態を同じTaskとして確認できる | Context往復Journey | 別Task／Revision混入とAgent完了＝採用表示を拒否する | Task、Result、Evidence、Deliveryを結ぶ |
| `UX-000052@1` 監査・是正の閉包理解 | `REQ-000026` | 合意した全条件、適用先、反証結果および未処置を一つの改訂版で確認できる | 標準変更Journey | 監査回数や一部是正を進捗・完成とする表示を拒否する | Finding、Remediation、Verificationを結ぶ |
| `UX-000053@1` 現在必要な人間判断の提示 | `REQ-000026` | 解消済み事項を除き、今決める内容、影響、推奨、保留時の扱いを理解できる | 判断待ち | Findingの丸投げと重複判断要求を拒否する | Decision RequestとCurrent Revisionを結ぶ |
| `UX-000054@1` 外部送信範囲と同意の理解 | `REQ-000027` | 送信先、目的、操作、情報分類および許可範囲をEffect前に理解できる | 外部Context Journey | 接続済み・過去同意から包括許可を推定する経路を拒否する | Destination、Purpose、Classification、Consentを結ぶ |
| `UX-000055@1` AI入口から同じ正本への到達 | `REQ-000028` | Chat AgentとCoding Agentが同じCRDD正本と判断境界を使う | 対話と構築Journey | 入口文書の第二正本化と参照不能時の推測を拒否する | Agent EntryとCanonical Sourceを結ぶ |
| `UX-000056@1` 推論Contextの履歴と現在値 | `REQ-000029` | 当時の仮説・判断・学びと現在有効なIntentを区別できる | 文書・Context Journey | 遡及上書きと古いHypothesisの現在値化を拒否する | HistoricalとCurrent Reasoningを分ける |
| `UX-000057@1` 試験層と現在の保証範囲の理解 | `REQ-000030` | UT、IT、ST、UAT、RT等で何を確認し何が未確認か理解できる | 文書・検証Journey | 試験件数や一部Passから全体品質を推定する表示を拒否する | Test Layer、Scope、Evidence Stateを結ぶ |
| `UX-000058@1` 外部境界Lifecycleの段階検証 | `REQ-000030` | 最終E2E前に開始、利用、失敗、取消、回復、清掃の成立範囲を把握できる | 検証Journey | 単発成功だけの結合完了を拒否する | Block、Lifecycle、Integration Evidenceを結ぶ |
| `UX-000059@1` 高負荷試験の明示的な実行選択 | `REQ-000030` | PT／LTの時間・費用影響を理解し、実行有無を明示的に選べる | 検証Journey | 未指示の高負荷実行と未実施による一律監査停止を拒否する | Test Plan、Authority、Not Executed Stateを結ぶ |
| `UX-000060@1` 物語と構造を両立する文書理解 | `REQ-000031` | 課題と判断の物語を理解してから、表・図で条件と関係を確認できる | 文書Journey | Checklist順、専門語だけ、情報削減による見せかけの可読性を拒否する | Narrative、Structured Detail、Evidenceを結ぶ |
| `UX-000061@1` 基本図による意図引き渡し | `REQ-000032` | 工程固有の図から全体像、未接続、状態差および下流確認対象を理解できる | 文書Journey | 図の黙示省略、機械的で読めない記法、図と試験の断絶を拒否する | Diagram ElementとHandoff Obligationを結ぶ |
| `UX-000062@1` Work・Change・Evidence・Qualityの役割別Navigation | `REQ-000033` | 未完了、変更理由、成立根拠、現在品質を迷わず辿れる | 標準変更Journey | 同じ説明の複製とOwner混同を拒否する | Work Lifecycle EntityとOwnerを分ける |
| `UX-000063@1` CHGからの全影響Path確認 | `REQ-000033` | 一つの変更が実際に触れた全ファイルを変更理由とともに確認できる | 標準変更Journey | 代表ファイルだけの表示とGit差分への丸投げを拒否する | ChangeとAffected Pathを結ぶ |
| `UX-000064@1` 過去Evidenceの不変な参照 | `REQ-000033` | 過去の観測結果を当時の対象Revisionのまま確認できる | 文書・検証Journey | 現在Inventoryで過去Evidenceを上書きする経路を拒否する | Evidence、Observed Revision、Current Stateを分ける |
| `UX-000065@1` Repositoryに対応するTool利用 | `REQ-000034` | 現在Repositoryと対応する標準Toolを手動Version照合なしで使える | Local Journey | Repository外の任意Tool暗黙採用を拒否する | Repository BindingとTool Distributionを結ぶ |
| `UX-000066@1` 開発実行と署名済み実行の区別 | `REQ-000034` | 反復用の開発実行と公式Runtime Authorityを混同せず選べる | Runtime導入Journey | 開発候補を正式配布として表示する経路を拒否する | Execution Mode、Identity、Authorityを分ける |
| `UX-000067@1` 公式視覚素材の出所・権利・用途理解 | `REQ-000035` | 公式識別用途、原本、派生物、利用条件を確認して再利用できる | Communication／導入体験 | 見た目からTrust保証を推定し、権利不明素材を収載する経路を拒否する | Asset、Provenance、Rights、Usageを結ぶ |
| `UX-000068@1` Version Control非依存の日常作業 | `REQ-000036`／`REQ-000034`／`REQ-000008` | 未Commit状態や差し替え可能な履歴実装でも、通常の読取り・編集を続けられる | Local Journey | Commit SHA依存とAdapter故障による無関係操作停止を拒否する | Routine OperationとVersion Control Capabilityを分ける |

### 3.3. UX成果の横断構造

68件を個別機能の一覧として読ませず、利用者が達成したいことと失敗時に守る体験で横断した。次の単位は、Journey、Blueprintおよび品質期待を読み解くための上位のまとまりであり、Canonical UX成果を置き換えない。

| 横断成果 | 関係する要求 | 利用者が得る体験 | 統合先 |
|---|---|---|---|
| 迷わず開始できる | `REQ-000001`、`REQ-000008`、`REQ-000014`、`REQ-000034`、`REQ-000036` | 対象Root、使えるTool、入口および現在状態が分かり、Commitの有無や内部Pathを推測せず開始できる | Local Journey、標準保守Journey、共通品質期待 |
| 安全に仕事を委ねられる | `REQ-000002`、`REQ-000003`、`REQ-000005`、`REQ-000019`、`REQ-000023` | 実行者、範囲、判断点および責務境界を理解し、内部編成を逐次操作せず任せられる | Project Journey、Milestone委任、Blueprint |
| 実行を観測し改善できる | `REQ-000004`、`REQ-000016`、`REQ-000030` | 実行事実、選択された構成、失敗地点および再検証範囲を比較できる | Runtime運用Journey、検証Journey、品質期待 |
| 不完全なProjectを正しく理解できる | `REQ-000007`、`REQ-000009`、`REQ-000013`、`REQ-000020` | Project／Repository／Rootを混同せず、欠測、競合、古さ、出典を保ったViewから判断できる | Project／Portfolio Journey、重要場面 |
| 入口が変わっても意味が変わらない | `REQ-000006`、`REQ-000010`、`REQ-000028` | Workbench、MCP、CLI、AIのどこからでも同じ状態、停止理由および結果へ到達できる | 共同Blueprint、非AI外部Tool Journey |
| Contextと結果を安全に往復できる | `REQ-000017`、`REQ-000024`、`REQ-000027`、`REQ-000029` | 必要なContextだけを出所・現行性・許可付きで渡し、結果を同じTaskの候補として受け取れる | 対話と構築のJourney、外部Context Journey |
| Remoteでも同じ仕事へ戻れる | `REQ-000011`、`REQ-000021` | 現在Credentialの範囲を理解し、切断後も二重実行せず同じRequestへ戻れる | Remote Journey、重要場面 |
| 停止後を利用者へ押し付けない | `REQ-000015`、`REQ-000022` | Runtime Dataの所有、保持、残存、清掃および回復義務が分かる | Runtime運用Journey、失敗・回復、品質期待 |
| 信頼の判断を利用者が所有できる | `REQ-000018`、`REQ-000025` | 準拠、改ざん有無、Publisherおよび実行許可を混同せず、Deployment Ownerが方針を選べる | 導入・更新Journey、制御・信頼 |
| 判断と変更を収束させられる | `REQ-000012`、`REQ-000026`、`REQ-000033` | Topic／Meeting／候補／変更／Evidenceの役割を混同せず、残る判断と次のGateが分かる | 標準保守Journey、候補操作、Blueprint |
| 意図を人とAIへ劣化なく渡せる | `REQ-000031`、`REQ-000032` | 読む順序、基本図、状態、関係および下流義務から、後工程で意図を再構成できる | 文書・検証Journey、品質期待 |
| 公式素材を安心して利用できる | `REQ-000035` | 権利確認、用途および正本を辿り、無断模倣や不明な再配布を避けられる | 導入・Communication体験、信頼表示 |

### 3.4. 利用者・状況別の成果

| 利用者・状況 | 現在の困りごと／失敗仮説 | 利用後に得たい状態 | 価値が成立しない条件 |
|---|---|---|---|
| Developerが一つのRepositoryで作業 | 横断機能のためにServer、Workspaceまたは他Repositoryを意識させられる | 現在Repositoryだけで日常作業を完結し、必要時だけProject全体へ進める | Local作業の開始手順、入力または認知負荷が増える |
| Project Operatorが現在地を確認 | 状態、品質、判断待ち、根拠を複数文書とlogから再構成する | 欠測と観測時点を含むProject Viewから、今の判断と正本へ戻れる | 投影を信じるために結局すべてのlogを読み直す |
| PMが複数Repositoryを横断 | Repositoryごとの状態を手で統合し、不足Sourceを見落とし得る | 一つの論理Projectとして確認しつつ、不足・制限・競合を識別できる | 不完全なViewを完全状態と誤認する、または物理構成の理解が前提になる |
| Managementが複数Projectを比較 | 集計された結論から根拠、現行性、未確認範囲へ戻れない | 最小比較から注意事項と根拠Projectへ段階的に進める | 単一Scoreだけで健全性や優先順位を確定して見せる |
| Chat／Coding Agentへ質問・依頼 | 全Context投入、会話転記、利用Source不明が起き得る | 必要なContextだけがRevision付きで搬送され、結果のSource表明を確認できる | AI内部の利用を証明済みと見せる、または不足Contextを推測する |
| Remote ClientがShared CROSを利用 | 接続、Content Access、Effect Authorityおよび応答喪失を区別できない | 接続先、開示範囲、要求状態、次の安全な操作を理解できる | 接続成功を実行許可と誤認する、または再試行でEffectが重複する |
| 非AIの外部Tool／自動化 | 人間向け画面またはAI出力を解析して定型処理する | 同じ構造化結果と相関Identityを直接利用できる | MCPを不要なLocal処理へ強制する、または任意Commandを公開する |
| CRDD作成者・保守者が変更を収束 | 課題、要求、変更ファイル、利用側、試験および監査結果を手で再構成する | 変更の意図、影響先、成立条件、証拠、残るGateを同じ変更へ結び付けられる | Checker合格や一部E2Eだけを全体完成と誤認する |
| Runtime導入・運用者が更新・回復 | 配布元、構成変更、Effect発生、残存資源および回復可否が区別できない | 信頼条件、現在状態、停止理由、exactな再入場先および清掃結果が分かる | 更新を一律拒否する、または不明状態で再実行・削除する |
| 外部Context所有者が送信を判断 | 会話やRepository全体が送られる範囲と、返る結果の扱いが分からない | 送信先、目的、最小情報、決定権限を確認し、帰還結果を候補として扱える | 接続済みを包括許可とみなし、結果を自動採用する |
| 文書・検証の利用者が意図を追跡 | 長文や工程別成果物から、課題、選択理由、状態遷移、検証範囲を再構成する | 人間が理解する順序と構造化情報から、次工程の義務と未確認を識別できる | テンプレート項目は埋まっているが、判断の物語と反証が分からない |

### 3.5. 共通体験原則

- **入口より意味を安定させる。** Workbench、AI＋MCP、CLI／TS APIで、同じ状態を成功、失敗または判断待ちへ別解釈しない。
- **LocalをRemoteの都合で複雑にしない。** 一つのRepositoryで足りる作業にCROS Server、Credential切替またはFederation理解を要求しない。
- **全体像と不完全性を同時に示す。** 要約を簡単にしても、欠測、制限、競合、古い観測を消さない。
- **結論から正本へ戻れる。** Project／Portfolio ViewはSource、Revisionおよび所有成果物への導線を失わない。
- **人間の判断点だけを前面に出す。** 内部Task、Lock、TransportまたはAgent間搬送を通常操作にしない。
- **接続、閲覧、候補作成、採用、Effectを分ける。** 一つが成立しても次のAuthorityが成立したとは表示しない。
- **再接続を新規実行にしない。** 応答喪失時は同じRequestの状態確認を先に示し、再実行を既定にしない。
- **選べない選択肢を見せない。** 存在開示不可のSource、利用不能なCredentialまたは未登録Capabilityを推測表示しない。
- **安全な停止を行動可能にする。** 拒否だけで終えず、発生地点、Effect状態、保持物、次に許される操作および判断主体を示す。
- **内部変更を利用者の意味変更にしない。** 責務分離、Adapter化、Transport変更またはVersion Control実装の差し替え後も、公開結果と成立済みCapabilityを保つ。
- **品質を後工程で突然発明しない。** 速さ、可用性、信頼性、安全性、鮮度、回復可能性、可読性および追跡可能性を、利用者が期待する体験として下流へ渡す。

<a id="workbench-mcp-role-journeys"></a>

## 4. 利用者別Journey

<a id="ux-journey-developer-local"></a>

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

<a id="ux-journey-project-operation"></a>

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

<a id="ux-journey-management-portfolio"></a>

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

<a id="ux-journey-remote-recovery"></a>

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

<a id="ux-journey-external-tool"></a>

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

<a id="ux-journey-standard-maintenance"></a>

### 4.6. CRDD標準を変更・公開するJourney

```text
((S: 課題または改善候補を確認))
  │
  ▼
[U: 探索した課題・仮説・要求と現在の正本を照合]
  │
  ▼
[T: 変更する意味 + 影響する利用側 + 保持する成立条件]
  │
  ├── 情報不足 ──> [R: 不足根拠と判断主体を示して保留]
  │
  └── 着手可能 ──> [S: 変更、段階検証、候補固定]
                         │
                         ▼
                  [T: 変更ファイル + Evidence + 残るGate]
                         │
                         ├── 未成立 ─> [R: 原因に効く是正へ戻る]
                         └── 成立 ──> [U: 採用・公開を判断]
```

保守者は、変更したファイル数やChecker合格だけでなく、何の成立条件を変え、どのConsumer、署名、公開、回復経路まで確認したかを理解できる必要がある。監査の指摘を一件ずつ当てる作業ではなく、同じ原因と意味境界を持つ指摘をまとめ、修正後の確認範囲と残る不確実性を判断できるようにする。

<a id="ux-journey-runtime-lifecycle"></a>

### 4.7. Runtimeを導入・更新・回復するJourney

```text
((S: Runtimeを導入または更新))
  │
  ▼
[T: 配布元 + Integrity + Conformance + Trust Policy]
  │
  ├── 信頼条件を満たさない ─> [R: Effect 0と選択可能な処置]
  │
  └── 利用可能 ──────────> [U: 許可範囲で実行]
                                  │
                                  ├── 正常終了 ─> [T: 結果 + cleanup]
                                  └── 不明／残存 ─> [R: exact Identity + 禁止操作]
                                                           │
                                                           ▼
                                                    [S: 同じ義務へ再入場]
```

環境や依存Toolの更新をVersion差だけで一律拒否せず、実際に必要な能力と危険な変化を検査する。一方、Effectや残存資源を観測できない場合は正常へ丸めず、利用者が新規実行、回復、清掃のどれを選べるかを明確にする。秘密鍵や内部Protocolを通常利用者へ要求しない。

<a id="ux-journey-external-context"></a>

### 4.8. 外部Contextを送信し結果を受け取るJourney

```text
((S: 外部AI／Toolの利用候補))
  │
  ▼
[U: 送信先 + 目的 + 操作 + 情報分類を確認]
  │
  ├── 許可不明 ─> [R: 送信せず決定権限者へ戻す]
  │
  └── 許可済み ─> [S: 必要最小のContext Packageを構成]
                          │
                          ▼
                   [T: 出所・Revision付きで送信]
                          │
                          ▼
                   [T: 同じTaskへ結果を帰還]
                          │
                          └──> [U: 候補として確認・採否判断]
```

外部結果は指示や正本へ自動昇格しない。利用者は、何をどこへ何のために渡したか、どのContextを結果へ提供したか、結果がどのTaskへ帰ったかを追跡できる。AIの内部使用や未知Secretの不存在まで証明したようには表示しない。

<a id="ux-journey-context-handoff"></a>

### 4.9. 文書と検証から意図を受け取るJourney

```text
((S: 次工程またはレビューを開始))
  │
  ▼
[U: 課題の物語と現在の判断を読む]
  │
  ▼
[T: 要求 + 基本図 + 状態 + 関係 + 未確認範囲]
  │
  ├── 意図を再構成できない ─> [R: 所有工程へ不足を返す]
  │
  └── 引継ぎ可能 ─────────> [S: 工程固有の成果へ具体化]
                                   │
                                   ▼
                            [T: 反証可能な検証義務]
```

読み手へ規則や表の解読を先に要求しない。課題、仮説、判断および目指す体験を理解してから、構造化した条件・関係・図・Evidenceへ進めるようにする。図を作れない場合も空欄や黙示的省略にせず、理由、未確認範囲および次の再評価契機を残す。

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

### 6.1. CRDD利用Lifecycleの横断Blueprint

Workbench／MCPの利用場面だけでなく、標準の採用から変更・実行・検証・回復までを同じ体験境界で接続する。

| 責務 | 導入・開始 | 意図を渡す | 実行・変更 | 状態を理解する | 判断・採用 | 失敗・更新後に戻る |
|---|---|---|---|---|---|---|
| 利用者 | 対象Repository、Tool、配布元を選ぶ | 課題、目標、範囲、期待品質を伝える | 通常は内部編成を操作せず任せる | 結果、根拠、不完全性、次の行動を確認する | 候補、変更、公開または保留を判断する | 同じTask、変更または回復義務へ戻る |
| 人間可読成果物 | なぜ必要かと対象者を説明する | 要求、仮説、基本図、判断を下流へ渡す | 現在設計と変更理由を分けて保持する | 状態、影響先、Evidence、未確認を示す | 決定権限と残るGateを示す | 失敗知を次の設計・試験へ戻す |
| AI／Tool入口 | 利用可能な能力と制限を示す | 入力を意味変更せず公開契約へ渡す | 許可されたCapabilityだけを呼ぶ | 構造化結果と相関Identityを返す | 判断を代行せず適切なOwnerへ返す | 現在Authorityを再検証し、重複Effectを防ぐ |
| Runtime／Adapter | Root、構成、Trust、依存能力を検査する | Canonical Contractへ正規化する | lifecycleと外部境界を所有する | 要求、受理、Effect、完了、観測を区別する | Candidate、正本変更、公開を分ける | exact Identity、残存、cleanup、再入場を保持する |
| Quality／Release | 必要な試験層と未実施条件を示す | 成立条件を反証可能な検証義務へ変換する | 変更意味から対象試験を選ぶ | 確認済み、失敗、未確認を分ける | 完成主張とEvidenceを照合する | 原因に効く再検証を選び、無差別な全反復を避ける |

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

性能、可用性、信頼性、安全性、鮮度、回復可能性は、後工程が数値や実装方式だけで作る条件ではない。利用者が仕事を続け、止まり、判断し、再開する際に期待する体験品質として、UXから次の形で渡す。

| 体験品質 | 利用者が期待する状態 | UX上の失敗 | 下流で具体化するもの |
|---|---|---|---|
| 予測可能性 | 開始前に対象、範囲、主なEffectおよび停止条件が分かる | 実行後に初めて必要条件や対象違いが分かる | Preflight、状態、Error、Acceptance |
| 応答性 | 入力待ち、処理中、長時間処理および停止を区別できる | 無反応、偽の進捗、入力画面の見失い | 応答時間目標、進捗観測、取消 |
| 可用性 | 利用不能時も理由、影響範囲および代替・再開条件が分かる | 空結果や成功表示へ畳む | Availability、Degraded Mode、運用導線 |
| 信頼性 | 同じ入力・意味契約から入口によらず整合した結果を得る | Transport、Adapterまたは内部Refactorで意味が変わる | Contract、整合性、回帰条件 |
| 安全性・制御可能性 | 接続、閲覧、候補、採用、Effectの権限を理解し選べる | 過剰な一律拒否、または接続からAuthorityを推定する | Authorization、Trust Policy、Effect Gate |
| 現行性・完全性 | 観測時点、Source、Coverage、競合および未確認を判断できる | 古い値、欠測または競合を完全な現在値として示す | Freshness、Coverage、Conflict表現 |
| 回復可能性 | 失敗後に同じ対象へ戻り、禁止操作と残る義務が分かる | 無条件Retry、二重Effect、由来不明な清掃 | Identity、Retention、Cleanup、Recovery |
| 追跡可能性 | 課題、要求、判断、変更、Evidenceおよび結果を辿れる | Pathや内部記憶だけに依存し、影響先を再構成できない | Relation、Metadata、変更・Evidence契約 |
| 可読性 | 初見の人が課題の物語を理解してから構造化詳細へ進める | Checklistを埋めただけで、なぜその結論か分からない | 情報構造、基本図、用語、Accessibility |
| 維持可能性 | 内部部品を差し替えても日常操作と公開意味が保たれる | 利用者が内部Path、Git Commitまたは特定実装を操作する | Port、Adapter、移行、Consumer Closure |

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
| Discovery要求のUX分析 | `Complete for Scope` | 採用した36件をExperience Change、ペルソナ、体験区間、Supporting Model処置、責任境界、品質期待、妥当性確認および下流義務まで個別分析した |
| UX成果IDの統合 | `Complete for Scope` | 36件を横断比較し、既存10件の意味を保持しながら68件へ分割・統合した。各要求にもNew／Same判断と理由を記録した |
| 役割別Journey | `Complete for Scope` | Developer、Project／Portfolio、Remote、外部Tool、標準保守、Runtime運用、外部Context、文書・検証をIA／UI／SPECで具体化する |
| 重要場面・失敗／回復 | `Complete for Scope` | Project Viewに加え、Runtime残存、外部送信、契約移行および検証不成立を実境界で反証する |
| Service Blueprint、支援・共有／引継ぎ、時間役割・代替投影 | `Complete for Scope` | Workbench／MCPとCRDD利用Lifecycleを接続した。各Owner、Port、Transportの実装方式はArchitectureが所有する |
| 体験品質期待 | `Complete for Scope` | 数値目標、測定方法および実装方式はSPEC、Architecture、Qualityで具体化する |
| 制御・適応の必要性 | `Complete for Scope` | 固定規則、利用者選択、組織方針、Runtime構成、保留の候補をIA以降で評価する |
| 認知意図・体験表現意図 | `Complete for Scope` | 利用者評価で理解と誤認を観測する |
| Workbenchの比較価値 | `Unproven` | AI＋MCP、静的Report、Workbenchを同じ代表課題で比較する |
| UX文書 | `Complete for Scope` | 36要求のVisual Summary付き個別分析、68 UX成果との多対多Relation、物語、Journey、重要場面、Blueprint処置、品質期待および下流義務を記録した |
| UX全体 | `Independent Review Pending` | 全数・双方向の機械確認と独立レビュー後にIA移行を判断する |

IAへは、Project／Repository／Sourceの段階的な見せ方、PropertyごとのSource／Revision／Observed At、Coverage、Current／Historical、判断待ち、Candidate、Credential切替可能性、Request状態、Tool能力、変更・Evidence関係および正本導線を渡す。UIとSPECへは、状態・重要度・次操作を色や位置だけへ依存させないこと、接続／閲覧／Candidate／採用／Effectを区別すること、応答喪失時に同一Request確認を第一導線とすることを渡す。ArchitectureとQualityへは、§10の体験品質を実装境界、測定条件、段階試験および反証へ具体化する義務を渡す。

未確認のWorkbench比較効果はIA設計を止めないが、UI機能拡張またはWorkbench優位の外部主張には使わない。Remote Transport方式、公開Capabilityの最終OwnerおよびSchemaはUXで決めず、後続工程で本UX成果を満たす代替を比較する。

## 14. 現在状態と引渡し

本書は既存実装と人間の要求から再構成した候補であり、過去の工程移行承認を遡及して作らない。2026-09-13、人間の決定権限者は独立レビューPass後の[統合したDiscovery判断](../01_Discovery/01_Product_Discovery.md#current-discovery-decisions)を確認し、v0.21のUX工程への移行を承認した。2026-09-14、採用した36要求すべてをVisual Summary付きの個別UXとして分析し、利用者成果を68件へ分解・統合した。新しいIDの意味、多対多Relation、Same理由および個別体験分析は現在版の独立レビュー対象である。

既存Tool UXでは、導入、依頼、待機、結果、取消・復旧、Checker、開発・配布の責務を§7へ整理し、v0.19 Project Runtimeの委任体験を§8へ保持した。未取得情報の表示、意味説明、候補操作は実装と限定再確認を終え、PowerShellでは入力・日本語表示・折返し・拡大を限定確認した。実Task取消は是正後の署名版4f10201で通常回収まで観測し、今回差分の限定独立確認済みである。説明未登録の理由、別の端末環境、支援技術は[UIの未解決事項](../04_UI/01_User_Interface.md#open-issues)へ接続し、既存Tool全体の工程網羅状態は`Blocked`を維持する。§7と§8はv0.21共同UXが保持する継承入力であり、共同UXの完成判定には含めない。

2026-09-13の独立レビューは、当時の12要求を対象にしたWorkbench／MCP共同UXについてCritical／Major／Moderate 0でPassした。その結果は、36要求へ範囲を広げた現在版のレビュー結果として流用しない。現在は、個別分析、68 UX成果への統合、追加Journey、CRDD利用LifecycleのBlueprint、体験品質期待および下流義務まで完成し、`Independent Review Pending`である。現在版の機械確認と独立レビューが終わるまで、IAへ移行可能とは表示しない。

次工程の[情報構造](../03_IA/01_Information_Architecture.md)と[UI](../04_UI/01_User_Interface.md)は、この候補の照合先であって承認済み引渡しではない。既知差の所有者・再確認条件は[UIの未解決事項](../04_UI/01_User_Interface.md#open-issues)、v0.21のProject Operation／Workbenchは[CHG-000067](../99_Roadmap/Changes/CHG-000067/change.md)へ接続する。Qual-Labが本UXの内容、未確認範囲および独立レビューを確認してIA移行を判断する。

## 15. 基本図の処置

| 基本図 | 対象 | 目的 | 処置 | 現行図／一意な参照／理由 | 投影元改訂版 | 現在状態 | 未確認範囲 | 次の処置・再評価契機 |
|---|---|---|---|---|---|---|---|---|
| 利用者Journey | CRDD内部Tool利用者、Project参加者 | 導入から依頼、判断、回復までの体験順序 | 作成 | [利用者別Journey](#workbench-mcp-role-journeys) | v0.21 Candidate | 候補 | Workbench比較効果と外部利用者の行動 | 自己適用と利用者評価で更新する |
| 重要場面・失敗／回復体験図 | Project ViewとSource Coverage | 不完全な投影から誤った判断へ進まず、根拠または回復接点へ戻る場面の可視化 | 作成 | [重要場面と失敗・回復](#workbench-mcp-critical-recovery) | v0.21 Candidate | 候補 | 実利用時の認知と操作 | Remote接続、Candidateおよび権限変化は同節の表と役割別Journeyで補い、UI／SPECと実境界検証へ接続する |
| Service Blueprint | Workbench／MCP共同利用とCRDD利用Lifecycle | 利用者、成果物、Surface、公開契約、Runtime、Quality、Sourceの責務整合 | 作成 | [共同Service Blueprint](#workbench-mcp-service-blueprint)と[CRDD利用Lifecycleの横断Blueprint](#61-crdd利用lifecycleの横断blueprint) | v0.21 Candidate | 候補 | 実装後の待機・支援・運用負担 | IA、UI／SPEC、ArchitectureおよびQualityへ引き渡す |
