# CRDD／CROSの利用体験

状態: Candidate（v0.21.0、Released Baseline: v0.20.1）
担当責任者: Qual-Lab
最終更新日: 2026-09-14
工程規則: [UX](../22_UX.md)

## 1. Product Experience Intent

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

### 根拠、対象、対象外

利用者が内部の署名、資源管理、エージェント間の情報搬送を毎回操作せず、依頼、必要な判断、成果物の受入へ集中できることを目指す。安全に止まれるだけでなく、止まった理由と次に必要な行動が分かることも体験の成立条件とする。

本UXの主入力は、[Discoveryの統合判断](../01_Discovery/01_Product_Discovery.md#current-discovery-decisions)で採用した36件の要求である。Workbench／MCPだけでなく、CRDD標準の作成・保守、Runtimeの実行・配布・回復、外部Context、文書、検証およびVersion Controlを利用者体験として読み直す。§3.1で要求ごとのExperience Change、ペルソナ、体験区間、責任境界および品質期待を、§3.2～§3.5でCanonical UX成果への横断統合を示す。

<a id="workbench-mcp-ux-outcomes"></a>

## 2. UX成果とCoverage

WorkbenchとMCPは同じ利用者へ同じ形を強制する入口ではない。利用者が置かれた状況に適した入口を選びながら、同じProject、Source、状態、判断境界および結果へ到達できることをUX成果とする。

### 2.1. REQごとのUX分析

Discoveryで採用した36要求には個別分析がある。2026-09-14の独立レビューで、要求固有の物語、Journey／Blueprintの意味接続、New／Same判断および工程境界にMajorの不備が見つかったため、現在はVisual-firstの6章構成で再分析している。下表の68件は再統合前の候補集合であり、独立レビューを通るまでCanonical確定済みとは扱わない。

| 要求 | 個別分析 | 現在のUX処置 |
|---|---|---|
| `REQ-000001` | [決定論的なRepository事前確認](Requirements/REQ-000001/user_experience.md) | UX意味再分析中 |
| `REQ-000002` | [複数AI実行の範囲・権限・回復](Requirements/REQ-000002/user_experience.md) | UX意味再分析中 |
| `REQ-000003` | [Objectiveから統合までのProject Lifecycle](Requirements/REQ-000003/user_experience.md) | UX意味再分析中 |
| `REQ-000004` | [実行事実の再利用可能な記録](Requirements/REQ-000004/user_experience.md) | UX意味再分析中 |
| `REQ-000005` | [Runtime責務と依存方向の分離](Requirements/REQ-000005/user_experience.md) | UX意味再分析中 |
| `REQ-000006` | [Local MCP Transport間の意味統一](Requirements/REQ-000006/user_experience.md) | UX意味再分析中 |
| `REQ-000007` | [出典と不完全性を保つProject View](Requirements/REQ-000007/user_experience.md) | UX意味再分析中 |
| `REQ-000008` | [CROSなしで成立するRepository作業](Requirements/REQ-000008/user_experience.md) | UX意味再分析中 |
| `REQ-000009` | [Project・Repository・Root Identity分離](Requirements/REQ-000009/user_experience.md) | UX意味再分析中 |
| `REQ-000010` | [Workbench・MCP・CLIの公開契約共有](Requirements/REQ-000010/user_experience.md) | UX意味再分析中 |
| `REQ-000011` | [Remote接続のWorkspace限定](Requirements/REQ-000011/user_experience.md) | UX意味再分析中 |
| `REQ-000012` | [Meetingから候補を経た正本更新](Requirements/REQ-000012/user_experience.md) | UX意味再分析中 |
| `REQ-000013` | [根拠と不完全性を保つPortfolio](Requirements/REQ-000013/user_experience.md) | UX意味再分析中 |
| `REQ-000014` | [Repository Tool能力の明示Registry](Requirements/REQ-000014/user_experience.md) | UX意味再分析中 |
| `REQ-000015` | [Runtime Data Rootの所有と用途](Requirements/REQ-000015/user_experience.md) | UX意味再分析中 |
| `REQ-000016` | [AIモデルProfileの検証可能な外部構成](Requirements/REQ-000016/user_experience.md) | UX意味再分析中 |
| `REQ-000017` | [出所付きContext Packageの解決](Requirements/REQ-000017/user_experience.md) | UX意味再分析中 |
| `REQ-000018` | [Runtime Trust要素の分離](Requirements/REQ-000018/user_experience.md) | UX意味再分析中 |
| `REQ-000019` | [契約移行時のConsumer閉包](Requirements/REQ-000019/user_experience.md) | UX意味再分析中 |
| `REQ-000020` | [欠測・競合を保つRepository Federation](Requirements/REQ-000020/user_experience.md) | UX意味再分析中 |
| `REQ-000021` | [Remote要求結果の同一Identity再取得](Requirements/REQ-000021/user_experience.md) | UX意味再分析中 |
| `REQ-000022` | [Runtime Dataの保持・清掃・回復](Requirements/REQ-000022/user_experience.md) | UX意味再分析中 |
| `REQ-000023` | [異なるAI Runtime LifecycleのAdapter分離](Requirements/REQ-000023/user_experience.md) | UX意味再分析中 |
| `REQ-000024` | [境界を越えるTask結果の帰還](Requirements/REQ-000024/user_experience.md) | UX意味再分析中 |
| `REQ-000025` | [Deployment Ownerが所有するTrust Policy](Requirements/REQ-000025/user_experience.md) | UX意味再分析中 |
| `REQ-000026` | [判断・監査・是正の収束可能な閉包](Requirements/REQ-000026/user_experience.md) | UX意味再分析中 |
| `REQ-000027` | [外部Contextの送信・昇格境界](Requirements/REQ-000027/user_experience.md) | UX意味再分析中 |
| `REQ-000028` | [AI入口と共通正本の分離](Requirements/REQ-000028/user_experience.md) | UX意味再分析中 |
| `REQ-000029` | [推論Contextの履歴・現行性・選択](Requirements/REQ-000029/user_experience.md) | UX意味再分析中 |
| `REQ-000030` | [段階的実境界試験と回帰選択](Requirements/REQ-000030/user_experience.md) | UX意味再分析中 |
| `REQ-000031` | [人の理解順と構造を両立する成果物](Requirements/REQ-000031/user_experience.md) | UX意味再分析中 |
| `REQ-000032` | [工程固有の基本図と意図引き渡し](Requirements/REQ-000032/user_experience.md) | UX意味再分析中 |
| `REQ-000033` | [Work LifecycleとEvidence所有の分離](Requirements/REQ-000033/user_experience.md) | UX意味再分析中 |
| `REQ-000034` | [Repository固定Commitから使える標準Tool](Requirements/REQ-000034/user_experience.md) | UX意味再分析中 |
| `REQ-000035` | [公式視覚素材の権利・用途・追跡](Requirements/REQ-000035/user_experience.md) | UX意味再分析中 |
| `REQ-000036` | [差し替え可能なVersion Control境界](Requirements/REQ-000036/user_experience.md) | UX意味再分析中 |

### 2.2. Discovery要求からUX成果への統合対応

全36要求から68件のUX成果候補を抽出したが、独立レビューで一部の粒度とSame／New判断に不整合が見つかった。利用者Goal、Outcome、重要場面、失敗条件および品質期待を要求ごとに再分析し、候補の統合・分割・名称を再判定する。要求とUXは多対多であり、同じ成果へ複数要求を接続する理由は各`user_experience.md`にも残す。

| UX成果 | Discovery要求候補 | 利用者成果 | Journey／Blueprint | 検証意図 | IAへの義務 |
|---|---|---|---|---|---|
| `UX-000001@1` Repository単独利用 | `REQ-000008`: Repository単独作業はCROS／Workbenchなしでも成立する | Developerが現在Repositoryだけで日常作業を開始・完結でき、必要時だけ横断利用へ進める | [DeveloperのLocal Journey](03_Experience_Map.md#2-主要journey)、Blueprintの「Contextを選ぶ」 | 横断機能未設定でも開始・完了できることを比較する | Local Sourceを既定にし、横断Sourceの不足と切替を別状態にする |
| `UX-000002@1` 根拠付きProject View | `REQ-000007`／`REQ-000009`／`REQ-000020`: 出典と不完全性を保ち、Project・Repository・Rootを分けてFederationする | 物理Repositoryを意識せず現在地を理解しながら、何が分かり何が不足・競合・古いかを確認して正本へ戻れる | Project Operator／PM Journey、[重要場面](05_Quality_Expectations.md#3-flow上の重要場面) | partial、stale、conflictingをcompleteへ畳む反例と、Identity混同を拒否する | Project、Repository、Root、Property、Source／Revision／Observed At／Coverageを関連付ける |
| `UX-000003@1` 薄いWorkbench | `REQ-000010`: Workbenchは公開Application Contractだけを使う薄いSurfaceとする | Workbench、AI、CLIから同じ意味と結果へ到達し、Surface固有の状態を覚えなくてよい | [共同Service Blueprint](04_Service_Blueprint.md#1-共同service-blueprint) | UI専用正本、Filesystem直接更新、独自Authority判断がないことを確認する | 公開結果と表示・操作入口を分け、正本Ownerを保持する |
| `UX-000004@1` 所有正本へ戻る候補操作 | `REQ-000012`: Topic／Meeting操作は候補または所有正本のCommandへ戻す | 試案、比較、採用、正本反映を区別し、適切な決定権限者へ判断を戻せる | Blueprintの「判断・候補操作」、重要場面のCandidate | 投影の直接更新とMeetingからの自動採用を拒否する | Candidate、Decision、所有Command、反映結果を別の情報状態にする |
| `UX-000005@1` 最小Portfolio比較 | `REQ-000013`: Portfolioは読み取り専用かつSource-awareな最小投影に限る | Managementが許可されたProjectだけを比較し、注意事項から根拠と不足へ段階的に進める | ManagementのPortfolio Journey | 非開示Projectの存在を漏らさず、不完全性を識別できるか確認する | Project比較、観測時点、Coverage、根拠導線を分ける |
| `UX-000006@1` Workbench比較価値 | `REQ-000007`／`REQ-000010`の有効性を比較する | 同じ課題で判断対象、出典、欠測へより少ない再探索と迷いで到達できる | [代替利用の比較](05_Quality_Expectations.md#5-妥当性確認と下流への引き渡し) | 同一条件で到達、根拠確認、欠測認識、迷い・再探索を比較する | 比較対象で共通利用できるProject／Source／課題の単位を保つ |
| `UX-000007@1` Workspace限定Remote利用 | `REQ-000011`: Remote接続のWorkspace限定 | 接続元が変わっても、現在Credentialに許可されたWorkspaceだけを利用でき、利用不能範囲を推測で補わない | Remote利用場面、重要場面・失敗／回復 | Workspace Grant縮小、失効、再接続時の表示と停止を確認する | Credential、Session、Workspace、利用可能Sourceを区別する |
| `UX-000008@1` 同一要求への再接続 | `REQ-000021`: Remote要求結果の同一Identity再取得 | 応答喪失後に新規実行せず、同じ要求の状態・結果・回復義務へ戻れる | Remote利用場面、重要場面・失敗／回復 | Timeout、切断、再接続で二重Effectを起こさないことを確認する | Request Identity、現在状態、結果、再取得、Recoveryを関連付ける |
| `UX-000009@1` Milestoneを委ねる | `REQ-000003`: Objectiveから統合までのProject Lifecycle | 人間が内部Taskを逐次操作せず、Milestoneの成立状態と必要な判断だけを理解して進行を委ねられる | [Milestoneを委ねる利用体験](04_Service_Blueprint.md#4-milestone委任)、Project Operator／PM Journey | Task数や進捗率ではなく、受入・統合・品質・判断状態を区別できるか確認する | Objective、Milestone、Task、Integration、Quality、Decisionを関連付ける |
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

### 2.3. UX成果の横断構造

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

### 2.4. 利用者・状況別の成果

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

### 2.5. 共通体験原則

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

## 3. 詳細成果物への案内

| 読みたいこと | 所有成果物 |
|---|---|
| 誰が、どの利用Contextで使うか | [利用者像](02_Personas.md) |
| 利用者の仕事と判断が全体でどう流れるか | [Experience Map](03_Experience_Map.md) |
| その体験を誰・何がどう支えるか | [Service Blueprint](04_Service_Blueprint.md) |
| 体験として守る品質と重要場面 | [体験品質期待](05_Quality_Expectations.md) |
| 各要求をどうUXへ変換したか | [要求別UX分析](Requirements/) |

## 基本図の処置

| 基本図 | 対象 | 目的 | 処置 | 現行図／一意な参照／理由 | 投影元改訂版 | 現在状態 | 未確認範囲 | 次の処置・再評価契機 |
|---|---|---|---|---|---|---|---|---|
| 利用者Journey | CRDD／CROS利用者 | 仕事の起点から理解、判断、継続までの時間軸 | 作成 | [Experience Map](03_Experience_Map.md) | v0.21 Candidate | 再分析中 | Workbench比較効果と実利用者の行動 | 個別REQとの対応を閉じて再レビューする |
| 重要場面・失敗／回復体験図 | Product全体と各UX成果 | 誤認、損失、回復および品質期待の発生点 | 作成 | [体験品質期待](05_Quality_Expectations.md#3-flow上の重要場面)と各要求分析 | v0.21 Candidate | 再分析中 | 各UX成果固有のFailureと実利用時の認知 | 6章構成の個別分析で全数接続する |
| Service Blueprint | CRDD／CROS共同利用 | 利用者接点、公開契約、提供責務、根拠および回復の接続 | 作成 | [Service Blueprint](04_Service_Blueprint.md) | v0.21 Candidate | 再分析中 | Journey／REQごとの実際の包含関係 | 区間参照を全数照合して再レビューする |

## 4. 現在状態と次工程への引き渡し

| 項目 | 現在状態 |
|---|---|
| Discovery要求 | 36件すべてに個別UX分析がある |
| UX成果候補 | 68件。独立レビューで意味再統合が必要と判定され、確定前 |
| Product横断成果物 | Persona、Experience Map、Service Blueprint、体験品質期待へ責務分離済み |
| 独立レビュー | 2026-09-14のレビューでMajor 4、Moderate 2、Minor 1。是正中 |
| IA移行 | 不可。要求固有の物語、Journey／Blueprint接続、New／Same判断および工程境界の再レビューPassが必要 |

IAへは、確定したUX成果とPersona、Source／Coverage／Freshness等の情報需要、重要場面および品質期待を渡す。UIへは利用者が状態、不足、判断待ちおよび根拠を誤認しない表現意図を渡す。SPECへは失敗・回復・応答・完了の体験品質を検証可能な条件へする義務を渡す。API、Process、Port、Adapter、Credential構造または状態列挙はUXで確定せず、下流が本UXを満たす代替を比較する。

次工程の[情報構造](../03_IA/01_Information_Architecture.md)と[UI](../04_UI/01_User_Interface.md)は照合先であり、承認済み引き渡しではない。v0.21のProject Operation／Workbenchは[CHG-000067](../99_Roadmap/Changes/CHG-000067/change.md)へ接続する。
