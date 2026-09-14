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

Discoveryで採用した36要求は、2026-09-14の独立レビューで見つかった要求固有の物語、Journey／Blueprintの意味接続、New／Same判断および工程境界の不備を反映し、Visual-firstの6章構成で個別に再分析した。下表の31件は、追加したUX-ID発行基準で再判定し、Capability、Information、Quality、Validationまたは下流の実現要素を独立UXから除いて統合したCanonical候補集合である。新しい固定候補への独立再レビューを通るまでCanonical確定済みとは扱わず、IAへ移行しない。

| 要求 | 個別分析 | 現在のUX処置 |
|---|---|---|
| `REQ-000001` | [決定論的なRepository事前確認](Analysis/REQ-000001/ux_analysis.md) | 要求別再分析済み・独立再レビュー待ち |
| `REQ-000002` | [複数AI実行の範囲・権限・回復](Analysis/REQ-000002/ux_analysis.md) | 要求別再分析済み・独立再レビュー待ち |
| `REQ-000003` | [Objectiveから統合までのProject Lifecycle](Analysis/REQ-000003/ux_analysis.md) | 要求別再分析済み・独立再レビュー待ち |
| `REQ-000004` | [実行事実の再利用可能な記録](Analysis/REQ-000004/ux_analysis.md) | 要求別再分析済み・独立再レビュー待ち |
| `REQ-000005` | [Runtime責務と依存方向の分離](Analysis/REQ-000005/ux_analysis.md) | 要求別再分析済み・独立再レビュー待ち |
| `REQ-000006` | [Local MCP Transport間の意味統一](Analysis/REQ-000006/ux_analysis.md) | 要求別再分析済み・独立再レビュー待ち |
| `REQ-000007` | [出典と不完全性を保つProject View](Analysis/REQ-000007/ux_analysis.md) | 要求別再分析済み・独立再レビュー待ち |
| `REQ-000008` | [CROSなしで成立するRepository作業](Analysis/REQ-000008/ux_analysis.md) | 要求別再分析済み・独立再レビュー待ち |
| `REQ-000009` | [Project・Repository・Root Identity分離](Analysis/REQ-000009/ux_analysis.md) | 要求別再分析済み・独立再レビュー待ち |
| `REQ-000010` | [Workbench・MCP・CLIの公開契約共有](Analysis/REQ-000010/ux_analysis.md) | 要求別再分析済み・独立再レビュー待ち |
| `REQ-000011` | [Remote接続のWorkspace限定](Analysis/REQ-000011/ux_analysis.md) | 要求別再分析済み・独立再レビュー待ち |
| `REQ-000012` | [Meetingから候補を経た正本更新](Analysis/REQ-000012/ux_analysis.md) | 要求別再分析済み・独立再レビュー待ち |
| `REQ-000013` | [根拠と不完全性を保つPortfolio](Analysis/REQ-000013/ux_analysis.md) | 要求別再分析済み・独立再レビュー待ち |
| `REQ-000014` | [Repository Tool能力の明示Registry](Analysis/REQ-000014/ux_analysis.md) | 要求別再分析済み・独立再レビュー待ち |
| `REQ-000015` | [Runtime Data Rootの所有と用途](Analysis/REQ-000015/ux_analysis.md) | 要求別再分析済み・独立再レビュー待ち |
| `REQ-000016` | [AIモデルProfileの検証可能な外部構成](Analysis/REQ-000016/ux_analysis.md) | 要求別再分析済み・独立再レビュー待ち |
| `REQ-000017` | [出所付きContext Packageの解決](Analysis/REQ-000017/ux_analysis.md) | 要求別再分析済み・独立再レビュー待ち |
| `REQ-000018` | [Runtime Trust要素の分離](Analysis/REQ-000018/ux_analysis.md) | 要求別再分析済み・独立再レビュー待ち |
| `REQ-000019` | [契約移行時のConsumer閉包](Analysis/REQ-000019/ux_analysis.md) | 要求別再分析済み・独立再レビュー待ち |
| `REQ-000020` | [欠測・競合を保つRepository Federation](Analysis/REQ-000020/ux_analysis.md) | 要求別再分析済み・独立再レビュー待ち |
| `REQ-000021` | [Remote要求結果の同一Identity再取得](Analysis/REQ-000021/ux_analysis.md) | 要求別再分析済み・独立再レビュー待ち |
| `REQ-000022` | [Runtime Dataの保持・清掃・回復](Analysis/REQ-000022/ux_analysis.md) | 要求別再分析済み・独立再レビュー待ち |
| `REQ-000023` | [異なるAI Runtime LifecycleのAdapter分離](Analysis/REQ-000023/ux_analysis.md) | 要求別再分析済み・独立再レビュー待ち |
| `REQ-000024` | [境界を越えるTask結果の帰還](Analysis/REQ-000024/ux_analysis.md) | 要求別再分析済み・独立再レビュー待ち |
| `REQ-000025` | [Deployment Ownerが所有するTrust Policy](Analysis/REQ-000025/ux_analysis.md) | 要求別再分析済み・独立再レビュー待ち |
| `REQ-000026` | [判断・監査・是正の収束可能な閉包](Analysis/REQ-000026/ux_analysis.md) | 要求別再分析済み・独立再レビュー待ち |
| `REQ-000027` | [外部Contextの送信・昇格境界](Analysis/REQ-000027/ux_analysis.md) | 要求別再分析済み・独立再レビュー待ち |
| `REQ-000028` | [AI入口と共通正本の分離](Analysis/REQ-000028/ux_analysis.md) | 要求別再分析済み・独立再レビュー待ち |
| `REQ-000029` | [推論Contextの履歴・現行性・選択](Analysis/REQ-000029/ux_analysis.md) | 要求別再分析済み・独立再レビュー待ち |
| `REQ-000030` | [段階的実境界試験と回帰選択](Analysis/REQ-000030/ux_analysis.md) | 要求別再分析済み・独立再レビュー待ち |
| `REQ-000031` | [人の理解順と構造を両立する成果物](Analysis/REQ-000031/ux_analysis.md) | 要求別再分析済み・独立再レビュー待ち |
| `REQ-000032` | [工程固有の基本図と意図引き渡し](Analysis/REQ-000032/ux_analysis.md) | 要求別再分析済み・独立再レビュー待ち |
| `REQ-000033` | [Work LifecycleとEvidence所有の分離](Analysis/REQ-000033/ux_analysis.md) | 要求別再分析済み・独立再レビュー待ち |
| `REQ-000034` | [Repository固定Commitから使える標準Tool](Analysis/REQ-000034/ux_analysis.md) | 要求別再分析済み・独立再レビュー待ち |
| `REQ-000035` | [公式視覚素材の権利・用途・追跡](Analysis/REQ-000035/ux_analysis.md) | 要求別再分析済み・独立再レビュー待ち |
| `REQ-000036` | [差し替え可能なVersion Control境界](Analysis/REQ-000036/ux_analysis.md) | 要求別再分析済み・独立再レビュー待ち |

### 2.2. Discovery要求からUX成果への統合対応

全36要求について、利用者Goal、Outcome、重要場面、失敗条件および品質期待を要求ごとに再分析した。31件のUX成果候補とのNew／Same関係も、利用者が得る最終状態と主な失敗条件を基準に各`Analysis/REQ-*/ux_analysis.md`へ理由付きで記録した。要求とUXは多対多であり、Canonicalな現在定義は各`Definitions/UX-*/experience.md`が所有する。新しい固定候補への独立再レビューで候補の統合・分割・名称およびRelationの妥当性を再確認する。

| UX成果 | Discovery要求候補 | 利用者成果 | Journey／Blueprint | 検証意図 | IAへの義務 |
|---|---|---|---|---|---|
| [UX-000001](Definitions/UX-000001/experience.md) 意味レビューへ集中できる事前確認 | `REQ-000001` | 同じ対象と条件なら機械的不備と修正箇所を先に理解し、意味レビューへ集中できる | 標準変更Journey | 結果の決定性、対象箇所、理由および意味判断との境界を確認する | 対象、検査条件、Finding、Location、Responsibilityを関連付ける |
| [UX-000002](Definitions/UX-000002/experience.md) 委任範囲と権限を理解して任せる | `REQ-000002`／`REQ-000003` | 実行前に誰へ何をどこまで任せるかを理解し、暗黙の範囲拡張なく仕事を委ねられる | Milestone委任Journey | Scope拡張、未承認Authorityおよび不明な実行主体を反証する | Objective、Scope、Actor、Authorityを分ける |
| [UX-000003](Definitions/UX-000003/experience.md) 委任中の状態と判断要否を理解する | `REQ-000002`／`REQ-000003` | 内部logを読まず、実行中・待機・停止と現在必要な判断を理解できる | Project／Runtime Journey | 無反応、偽の進捗、Provider差の誤表示および停止中の実行表示を反証する | Task State、Provider State、Decision、Next Actionを関連付ける |
| [UX-000004](Definitions/UX-000004/experience.md) 失敗後の再試行・回復を選ぶ | `REQ-000002`／`REQ-000003`／`REQ-000021`／`REQ-000024` | 失敗後に状態確認、再試行、回復および清掃を取り違えず、二重Effectを避けて次の行動を選べる | Runtime／Remote回復Journey | 無条件Retry、古いAuthority、Provider差の隠蔽および二重Effectを反証する | Failure、Effect State、Recovery、Retryを分ける |
| [UX-000005](Definitions/UX-000005/experience.md) 目的と受入条件でMilestoneを委ねる | `REQ-000003` | 内部Taskを逐次操作せず、目的・受入条件・統合状態からMilestoneの完成と必要な判断を理解できる | Milestone委任Journey | Task数や部分成功を完成へ畳む表示を反証する | Objective、Acceptance、Milestone、Task、Integration、Qualityを関連付ける |
| [UX-000006](Definitions/UX-000006/experience.md) 実行事実を根拠付きで振り返る | `REQ-000004` | 実行主体が異なっても、観測事実・未観測・評価・改善候補を出所と時点付きで区別して振り返れる | Runtime運用Journey | 空値の正常化、評価の事実化および出所のない比較を反証する | Execution、Observation State、Source、Assessment、Candidateを分ける |
| [UX-000007](Definitions/UX-000007/experience.md) 内部変更後も成立済み能力を安全に使う | `REQ-000005`／`REQ-000019`／`REQ-000023` | 責務・契約・Adapterの変更後も、維持・変更・廃止された能力を理解し、取り残しのない結果を安全に利用・公開できる | 標準変更Journey | 主経路だけの移行、旧契約残存および根拠のない旧処理削除を反証する | Previous Capability、Public Contract、Consumer、Replacement、Evidenceを結ぶ |
| [UX-000008](Definitions/UX-000008/experience.md) 故障した境界と影響範囲を理解する | `REQ-000005`／`REQ-000006`／`REQ-000023` | 接続・認証・実行・結果搬送またはProvider境界のどこで止まり、何が利用可能かを理解できる | Runtime／Remote Journey | 一律の失敗表示、無関係な能力停止および全体成功表示を反証する | Failure Origin、Boundary、Affected Capability、Deliveryを関連付ける |
| [UX-000009](Definitions/UX-000009/experience.md) Projectの現在地を根拠と不完全性付きで理解する | `REQ-000007`／`REQ-000009`／`REQ-000020` | 物理構成を意識せずProjectの現在地を理解し、欠測・制限・競合・古さとSourceへ戻れる | Project／Portfolio Journey | partial、stale、restricted、conflictingおよび未観測値の誤認を反証する | Project、Property、Source、Revision、Observed At、Coverageを関連付ける |
| [UX-000010](Definitions/UX-000010/experience.md) Repository単独で日常作業を続ける | `REQ-000008`／`REQ-000036` | 横断機能、Commit済み状態または特定の履歴実装を前提にせず、現在Repositoryで日常作業を開始・継続できる | Developer Local Journey | CROS未設定、未CommitまたはVersion Control Adapter障害による無関係な作業停止を反証する | Local Context、Routine Operation、Version Control Capabilityを分ける |
| [UX-000011](Definitions/UX-000011/experience.md) Project・Repository・Rootを区別して対象を選ぶ | `REQ-000009`／`REQ-000020`／`REQ-000024` | 論理Projectを一つに見ながら、参照・実行・回復の対象RepositoryとRootを取り違えずに選べる | Project Journey | 名前やPathの類似だけから対象Identityを推定する操作を反証する | Project、Repository、Root、Bindingを分ける |
| [UX-000012](Definitions/UX-000012/experience.md) 入口を変えても同じ仕事を続ける | `REQ-000006`／`REQ-000010`／`REQ-000028` | Workbench、MCP、CLIまたはAIの入口を変えても、同じ正本・適用規則・入力・権限・状態・結果を用いて仕事を続けられる | 共同Service Blueprint | 入口固有の第二正本、適用規則、業務状態、Authority判断または結果差を反証する | Canonical Source、Application Result、Public Contract、Transport Projectionを分ける |
| [UX-000013](Definitions/UX-000013/experience.md) 許可されたWorkspaceだけをRemote利用する | `REQ-000011` | 接続元やCredentialが変わっても、現在許可されたWorkspaceだけを利用し、利用不能理由と管理能力を内容閲覧から区別できる | Remote利用Journey | 存在漏えい、一律Unlock、古いGrantおよび管理能力からの閲覧権限推定を反証する | Credential、Session、Workspace Grant、System Capability、Disclosureを分ける |
| [UX-000014](Definitions/UX-000014/experience.md) Meeting内容を候補化し採否を判断する | `REQ-000012` | 会話・観察・仮説・候補・決定を区別し、既存Topicとの関係を根拠付きで判断して所有正本へ戻せる | Topic／Meeting Journey | 会話の自動採用と文字列一致だけの統合・分割を反証する | Meeting Item、Candidate、Topic Relation、Decision、Ownerを結ぶ |
| [UX-000015](Definitions/UX-000015/experience.md) 複数Projectを根拠付きで比較する | `REQ-000013` | 許可されたProjectの重要差を比較し、Coverageと根拠を保ったまま必要なProjectだけを掘り下げられる | Management Portfolio Journey | 非開示Projectの存在漏えい、単一Score断定およびCoverage差の消去を反証する | Project Summary、Coverage、Observed At、Disclosureを分ける |
| [UX-000016](Definitions/UX-000016/experience.md) 仕事に必要な標準Toolを迷わず選ぶ | `REQ-000014`／`REQ-000034` | 現在Repositoryの固定Commitと目的に対応する標準Tool／Runtimeを見つけ、別Releaseを手動照合せず安全に選べる | Local／Runtime導入Journey | 版不一致、欠落Runtime、改ざんManifest、未登録能力の推測表示および一覧からのAuthority発行を反証する | Capability、Availability、Authority、Repository Commit、Distribution、Manifest、Runtime Bindingを分ける |
| [UX-000017](Definitions/UX-000017/experience.md) Runtime Dataを安全に保持・清掃する | `REQ-000015`／`REQ-000022` | 保存場所の内部構造を推測せず、保持すべき状態と一時物を区別して安全に作業を継続・終了できる | Runtime運用Journey | 用途不明の書込み、名前や時間だけの削除および別Repositoryへの波及を反証する | Data Owner、Root、Durability、Retention、Cleanupを関連付ける |
| [UX-000018](Definitions/UX-000018/experience.md) AIモデル構成を安全に更新・選択する | `REQ-000016` | 新しいモデルへ追随するとき、コード改修を待たず検証済み構成を更新し、実効選択と再選定理由を理解できる | Runtime導入・運用Journey | 未知設定の黙示代替、非対応モデルの実行可能表示および無説明選択を反証する | Model Profile、Availability、Selection、Reason、Fallback Conditionを結ぶ |
| [UX-000019](Definitions/UX-000019/experience.md) 必要なContextを渡し結果を同じ仕事へ戻す | `REQ-000017`／`REQ-000024`／`REQ-000027` | 必要最小限のContextを出所・現行性・許可付きで渡し、相関・完全性付きの結果を同じTaskへ戻せる | 対話と構築の往復Journey | 全量投入、Secret混入、Context捏造、別Task結果混入およびAgent完了の自動採用を反証する | Context Package、Source、Task、Result、Evidence、Handoff、Decisionを関連付ける |
| [UX-000020](Definitions/UX-000020/experience.md) 利用環境の信頼方針でRuntimeを選ぶ | `REQ-000018`／`REQ-000025` | 準拠、改ざん有無、Publisher、公式表示および実行許可を区別し、自分の環境の方針で公式版・Fork・組織版を選べる | Runtime導入Journey | 一つの署名やブランド表示への全保証集約とQual-Lab署名だけの実行資格化を反証する | Conformance、Integrity、Publisher、Policy、Deploymentを分ける |
| [UX-000021](Definitions/UX-000021/experience.md) 切断後も同じRequestへ戻る | `REQ-000021`／`REQ-000024` | 応答喪失後に新規実行せず、現在のAccessで同じRequestの状態・結果・回復義務へ戻れる | Remote再接続Journey | 再接続時の二重Effect、古いSession Authorityおよび別Requestへの誤結合を反証する | Request Identity、Session、Current Access、Result、Recoveryを結ぶ |
| [UX-000022](Definitions/UX-000022/experience.md) 残存資源を安全に回復・清掃する | `REQ-000022` | 失敗後に残存の由来・影響・再入場先を理解し、必要な回復を行って不存在まで確認できる | Runtime回復Journey | 清掃要求だけの完了表示、別Operationの巻込みおよび不明状態での削除を反証する | Residue、Recovery Identity、Disposition、Absence Evidenceを結ぶ |
| [UX-000023](Definitions/UX-000023/experience.md) 監査・是正・判断を一つの改訂版で閉じる | `REQ-000026` | 合意した条件、適用先、反証、未処置および現在必要な人間判断を一つの改訂版で理解して収束できる | 標準変更Journey | 指摘の小出し適用、解消済み判断の再要求および一部是正の完成表示を反証する | Finding、Remediation、Verification、Decision Request、Current Revisionを結ぶ |
| [UX-000024](Definitions/UX-000024/experience.md) 外部利用の送信・持帰り・昇格を制御する | `REQ-000027` | 外部Effect前に送信境界を理解し、外部情報・反応・依存新版を出典付き候補として扱える | 外部Context Journey | 包括許可、不要情報送信、外部反応・依存新版の要求／因果／Policyへの自動昇格を反証する | Destination、Purpose、Classification、Consent、Source、Candidate、Promotionを結ぶ |
| [UX-000025](Definitions/UX-000025/experience.md) 過去の推論Contextと現在値を区別する | `REQ-000029` | 当時の仮説・判断・学びと現在有効なIntentを区別し、必要なContextを選べる | 文書・Context Journey | 遡及上書き、古いHypothesisの現在値化および履歴全量の無選択投入を反証する | Historical Context、Current Intent、Selection Basisを分ける |
| [UX-000026](Definitions/UX-000026/experience.md) 試験層と現在の保証範囲を理解して選ぶ | `REQ-000030` | 各試験層が確認したこと・未確認範囲・時間や費用を理解し、必要な検証と高負荷試験の実行有無を選べる | 検証Journey | 一部Passからの全体品質推定、単発成功だけのLifecycle保証および未指示の高負荷実行を反証する | Test Layer、Scope、Lifecycle Evidence、Authority、Not Executed Stateを結ぶ |
| [UX-000027](Definitions/UX-000027/experience.md) 物語と構造から文書の意味を理解する | `REQ-000031` | 課題と判断の物語を理解してから、表・図で条件と関係を確認し、次の行動へ進める | 文書Journey | Checklist順、専門語だけの説明および情報削減による見せかけの可読性を反証する | Narrative、Structured Detail、Decision、Evidenceを結ぶ |
| [UX-000028](Definitions/UX-000028/experience.md) 工程固有の図から意図を引き継ぐ | `REQ-000032` | 工程固有の図から全体像・関係・状態差・未接続を理解し、後工程で意図を再発明せずに引き継げる | 文書・工程移行Journey | 図の黙示省略、機械的で読めない記法および図と試験の断絶を反証する | Diagram Element、Source Meaning、Handoff Obligationを結ぶ |
| [UX-000029](Definitions/UX-000029/experience.md) Work・Change・Evidence・Qualityを迷わず辿る | `REQ-000033` | 未完了、変更理由、全影響Path、成立根拠および現在品質を役割の違いとともに辿れる | 標準変更Journey | Owner混同、代表Pathだけの表示、Evidenceの遡及上書きおよびGit差分への丸投げを反証する | Work、Change、Affected Path、Evidence、Observed Revision、Qualityを分ける |
| [UX-000030](Definitions/UX-000030/experience.md) 公式素材を権利と用途を確認して使う | `REQ-000035` | 公式素材の出所・原本・派生物・利用条件を確認し、許可された用途で安心して収載・再利用できる | Communication／導入Journey | 見た目からのTrust保証推定、権利不明素材の収載および用途外再配布を反証する | Asset、Provenance、Rights、Usageを結ぶ |
| [UX-000031](Definitions/UX-000031/experience.md) 公式の識別と保証を混同せず見分ける | `REQ-000035` | CRDDの公式入口や素材を見分けながら、表示だけを署名・準拠・品質・Publisher Trustの証明と誤認せず利用できる | 公式入口利用Journey | 見た目だけのTrust推定、保証根拠の欠落および公式／非公式入口の識別不能を反証する | Official Identification、Publisher、Signature、Conformance、Quality Claimを分ける |

### 2.3. UX成果の横断構造

31件を個別機能の一覧として読ませず、利用者が達成したいことと失敗時に守る体験で横断した。次の単位は、Journey、Blueprintおよび品質期待を読み解くための上位のまとまりであり、Canonical UX成果を置き換えない。

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
| 各要求をどうUXへ変換したか | [要求別UX分析](Analysis/) |
| 各UX成果の現在定義 | [UX成果定義](Definitions/) |

## 基本図の処置

| 基本図 | 対象 | 目的 | 処置 | 現行図／一意な参照／理由 | 投影元改訂版 | 現在状態 | 未確認範囲 | 次の処置・再評価契機 |
|---|---|---|---|---|---|---|---|---|
| 利用者Journey | CRDD／CROS利用者 | 仕事の起点から理解、判断、継続までの時間軸 | 作成 | [Experience Map](03_Experience_Map.md) | v0.21 Candidate | 要求別再分析済み | Workbench比較効果と実利用者の行動 | 個別REQとの対応を独立再レビューする |
| 重要場面・失敗／回復体験図 | Product全体と各UX成果 | 誤認、損失、回復および品質期待の発生点 | 作成 | [体験品質期待](05_Quality_Expectations.md#3-flow上の重要場面)と各要求分析 | v0.21 Candidate | 要求別再分析済み | 各UX成果固有のFailureと実利用時の認知 | 6章構成の個別分析との全数接続を独立再レビューする |
| Service Blueprint | CRDD／CROS共同利用 | 利用者接点、公開契約、提供責務、根拠および回復の接続 | 作成 | [Service Blueprint](04_Service_Blueprint.md) | v0.21 Candidate | 要求別再分析済み | Journey／REQごとの実際の包含関係 | 区間参照の全数照合結果を独立再レビューする |

## 4. 現在状態と次工程への引き渡し

| 項目 | 現在状態 |
|---|---|
| Discovery要求 | 36件すべてに個別UX分析がある |
| UX成果候補 | 31件。技術語を外しても独立した利用者成果として成立するかを再判定し、独立再レビューで欠落していた閲覧者成果を追加した |
| Product横断成果物 | Persona、Experience Map、Service Blueprint、体験品質期待へ責務分離済み |
| 独立レビュー | 固定Commit `e010e5c6`の再レビューで閲覧者Personaは解消し、意味伝播にも新規指摘なし。残ったMajor 1のshortcut reference／脚注による正式入力迂回を、CommonMark Link記法の閉集合として是正中 |
| IA移行 | 不可。Checker・契約試験と新しい固定候補の独立再レビューPassが必要 |

IAへは、確定したUX成果とPersona、Source／Coverage／Freshness等の情報需要、重要場面および品質期待を渡す。UIへは利用者が状態、不足、判断待ちおよび根拠を誤認しない表現意図を渡す。SPECへは失敗・回復・応答・完了の体験品質を検証可能な条件へする義務を渡す。API、Process、Port、Adapter、Credential構造または状態列挙はUXで確定せず、下流が本UXを満たす代替を比較する。

次工程の[情報構造](../03_IA/01_Information_Architecture.md)と[UI](../04_UI/01_User_Interface.md)は照合先であり、承認済み引き渡しではない。v0.21のProject Operation／Workbenchは[CHG-000067](../99_Roadmap/Changes/CHG-000067/change.md)へ接続する。
