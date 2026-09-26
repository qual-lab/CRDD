# Project情報入口の能力地図

成果物種別: Discovery分析の補足資料
探索ID: `EXP-000029`
対象: Project Context、Project Runtime State、Topic、Meeting、MCP、Workbench

## 1. 結論

Project ContextだけをMCPやWorkbenchへ表示しても、Projectの仕事全体は扱えない。Project Contextは「今どうなっているか」を五場面で理解する概要入口とし、Topic、Meeting、Roadmap、Quality、文書および実行中Runtimeは、それぞれの所有正本から詳細を取得する独立した読取り能力として接続する。

```text
Project Context
「Project全体の現在地を短時間で理解する」
        │
        ├─→ Roadmap／Version／Milestone
        ├─→ Topic
        ├─→ Meeting
        ├─→ Decision／Action
        ├─→ Quality／Gap／Evidence
        ├─→ Documentation
        └─→ Project Runtime State

Project Contextは概要とOwner Relationを持つ。
詳細本文、履歴、実行中状態は各Ownerが持つ。
```

MCPは同じ能力をAIへ公開する境界、Workbenchは人間がそれらを理解・比較・操作する入口である。どちらも独自のProject正本を作らない。

## 2. 利用者が行いたい仕事

| 利用場面 | 利用者が知りたいこと／行いたいこと | 主な情報Owner | Project Contextだけで足りるか |
|---|---|---|---|
| Project概要 | 今どこまで進み、何が危なく、何を決め、次に何をするか | Project Contextと参照先Owner | 概要確認には足りる |
| 計画確認 | 現行Version、節目、Scope、期限、依存、次のRelease | Roadmap、CHG、Release | 足りない。要約とRelationだけを持つ |
| Topic追跡 | 継続論点の現在状態、経緯、関係、昇格先、終了理由 | Topic | 足りない。Open Topic等の要約だけを持てる |
| Meeting確認 | いつ、誰と、何を確認し、何が決まり、何が残ったか | Meeting | 足りない。直近Meeting等の要約だけを持てる |
| 判断・Action | 誰が何を決めるか、何をいつ実行するか | Decision、Topic、Meeting、CHG等 | 足りない。現在の判断待ちだけを投影する |
| 品質確認 | 何を保証でき、何が未観測で、どの根拠があるか | Quality、Evidence | 足りない。現在品質と主要Gapだけを投影する |
| 文書探索 | どの正本を読めばよいか、関係する説明は何か | 各工程成果物 | 足りない。主要Relationだけを持つ |
| 実行状況確認 | Objective／Task／Milestoneが現在どう動いているか | Project Runtime | 対象外。Repository変更なしに変化するLive状態である |
| Repository横断 | どのRepositoryが何を担当し、何が見えないか | Manifest、各Project Context、CROS | 単一Repository投影だけでは足りない |

## 3. 読取り能力と操作能力

読取りと状態変更を同じ公開操作へ混ぜない。現時点では、次の分類を設計候補とする。

| 対象 | 読取り能力 | 操作能力の候補 | 現在の判断 |
|---|---|---|---|
| Project Context | Repositoryの固定Projectionを読む | N/A: Project Contextを直接編集する業務操作は持たない | MCP Resource候補 |
| Project Runtime State | 実行中Runtimeの現在状態を問い合わせる | Objective開始、判断送信 | 既存状態取得名を`crdd.get_project_runtime_state`へ明確化する。移行契約はArchitectureで決める |
| Topic | 一覧、詳細、Relation、現在状態を読む | 登録、編集、削除、終了、正式成果物への昇格候補 | 登録・編集・削除・一覧・取得を完成候補へ含め、削除の意味とAuthorityをDiscoveryで確認する |
| Meeting | 一覧、詳細、参加主体、Decision／Action／Topic候補を読む | 登録、編集、削除、訂正、候補化、Owner Artifactへの反映候補 | 登録・編集・削除・一覧・取得を完成候補へ含め、時点記録を壊さない訂正・撤回境界を確認する |
| Roadmap／Quality／Documentation | 一覧、詳細、Relationを読む | 各Ownerが許可する更新 | Project Context固有APIへ複製しない |

ここでいうMCP Resource／Toolは解決方式の有力候補であり、URI、引数、返却Schemaおよび書込みToolの採用をDiscoveryだけで確定しない。ただし、`crdd.get_project_state`という名称をProject Contextへ転用しない。Project全体の投影とProject Runtimeの実行状態を名前でも区別する。

## 4. TopicとMeetingの関係

TopicとMeetingは、片方をもう片方へ畳まない。

```text
Meeting
特定時点に確認したこと
    │
    ├─ Decision Candidate ─→ 判断Owner
    ├─ Action Candidate ───→ Actionを所有する成果物
    ├─ Topic Candidate ────→ Topic
    └─ Artifact Update ────→ REQ／CHG／Quality等

Topic
時間を越えて追跡する論点
    │
    ├─ Related Meetings
    ├─ Current State
    ├─ Relations
    ├─ Promoted Artifact
    └─ Closure Reason
```

MCPとWorkbenchは、Meeting本文をTopicの現在状態として扱わず、Topicの現在状態を過去Meetingへ上書きしない。利用者はTopicから関連Meetingへ、Meetingから関連Topicへ往復できる必要がある。

## 5. Workbenchが扱う情報範囲

WorkbenchはProject Context Viewerにも、MCP Resource／Toolの一覧画面にも限定しない。同じ正本とApplication Capabilityを利用しながら、人間が状況を把握し、判断し、次の仕事へ進むための横断投影を追加する。現時点の情報範囲候補は次のとおりである。

```text
Workbench
├ Project Overview
│  └ Project Contextの五場面
├ Roadmap／Version／Milestone
├ Topics
├ Meetings
├ Decisions／Actions
├ Quality／Gap／Evidence
├ Documentation／Owner Relations
├ Current Execution
│  └ Project Runtime State
├ Repositories／Coverage
├ Version Control
│  ├ Repository／Branch／HEAD
│  ├ Staged／Unstaged／Untracked／Conflict
│  ├ File Treeと変更状態
│  ├ File Diff／Staged Diff
│  └ Stage／Unstage／Commit／Push等の許可された操作
│
├ 横断Attention
│  ├ 停止・期限・判断待ち
│  ├ 未処理候補・未完了Action
│  └ 品質不足・関係競合
├ 関係と経緯
│  ├ Topic ↔ Meeting ↔ Decision ↔ CHG
│  ├ 時系列
│  └ 影響・依存
├ 比較と変化
│  ├ Version／Milestone間の差
│  ├ Repository／Project間のCoverage
│  └ 前回確認後の重要な変化
└ 次の仕事
   ├ 根拠へ進む
   ├ 判断・候補を処置する
   └ 許可された定型操作を実行する
```

この一覧は画面構成ではない。一つの画面へ集約することも、同じ順番でNavigationを作ることも要求しない。UX／IAで利用者の目的と情報関係を整理し、UI DetailでLogical Screen、Flow、PartおよびVisual Directionへ具体化する。

### Workbench固有の追加投影

Workbenchが追加する情報は、新しい事実の正本ではなく、複数の情報を人間の判断へ合わせてまとめた投影である。

| 層 | 内容 | 例 | Owner／保持境界 |
|---|---|---|---|
| 正本情報 | 各Ownerが持つ事実と状態 | Topic本文、Meeting記録、Roadmap、Quality | 各Owner Artifact |
| 共通Projection | Consumer間で意味を共有する現在投影 | Project Context、一覧、詳細、Runtime State | 共通Application Capability |
| Workbench横断Projection | 複数情報を一つの判断場面へまとめる | Attention、関連Timeline、Coverage比較、重要な変化 | 元のOwner Relationを保持し、Workbench固有正本にしない |
| Version Control現在状態 | 現在の作業ツリー、差分、Stage、Conflict | 簡易SourceTree、File Diff、Staged／Unstaged | Version Control Adapter。Project Contextや業務正本へ複製しない |
| 対話時の推論 | 現在情報からAIが追加する説明・提案 | 次に確認すべきTopic、日程Riskへの選択肢 | 保存済み事実・共有分析と分け、無言で正本化しない |
| UI状態 | 利用者の一時的な表示・操作状態 | 選択、Filter、展開、並び順 | Workbench内。Projectの事実として扱わない |

MCPの公開操作数とWorkbenchの表示量を一致させる必要はない。Workbenchは複数の読取り能力を組み合わせたProjectionを一度に表示できる。一方、Workbenchだけが正本の意味、状態語彙、Authorityまたは更新規則を所有してはならない。横断ProjectionがAIからも有用で、安定した意味を持つと確認できた場合は、Workbench固有処理へ閉じず、共通Application CapabilityまたはMCPの読取りProjectionへ昇格する。

### Version Control View

Workbenchは、MCPで扱うProject情報に加えて、現在の作業ツリーを簡易Git Clientのように確認・操作できる必要がある。ただしGit CommitやSHAをProject、Topic、Meetingその他の業務Identityの代わりにせず、未Commit状態も正常な作業状態として表示する。

```text
Version Control Adapter
        ↓
Repository／Branch／HEAD
        ↓
Current Worktree
├ Staged
├ Unstaged
├ Untracked
└ Conflict
        ↓
File Tree／Diff
Stage／Unstage／Commit／Push
        ↓
Workbench
```

Git CLIやGit固有出力をWorkbenchのDomain Contractへ直接露出しない。Repository観測、Diff、Stage／Unstage、CommitおよびPushはVersion Control境界を通し、将来同等機能へ差し替えられるようにする。Commit済みでなければTopic、Meeting、Project Contextまたは通常の文書操作が成立しない設計にしない。

初期のPushは、現在Branchに設定済みのUpstreamへ送る通常Pushに限定する。実行前にRemote、Branchおよび送信対象Commitを表示し、人間の明示確認後にだけ外部Effectを発行する。Force Push、暗黙のUpstream作成、認証情報の保存または表示、Branch作成、MergeおよびRebaseは初期範囲へ含めない。認証は既存のVersion Control環境とCredential境界を利用し、Workbench独自の秘密値Storeを作らない。

Discardは未Commit変更を失い得るため、通常の一括操作として提供しない。後工程で採用する場合も、対象差分、復旧可能性および失う内容を示した個別の明示確認を必須とする。

## 6. 設計と実装の順番

```text
Discovery
利用場面・Owner・境界を確定
        ↓ Gate 1
単一Repositoryの読取り契約
Project Context／Topic／Meeting等の意味を固定
        ↓ Gate 2
MCP公開契約
Resource／Tool、Identity、Authority、Failureを定義
        ↓ Gate 3
UI／SPEC Detail
Workbench全体のScreen Inventory、Flow、Hero、BHV対応
        ↓ Gate 4
単一Repository Dogfood
Markdown／AI／MCP／Workbenchの意味一致を確認
        ↓ Gate 5
CROS Federation
Principalが利用可能なRepositoryだけを統合
        ↓ Gate 6
複数Repository Workbench
Coverage、競合、利用不能を保ったProject Viewを確認
```

MCPとWorkbenchは別々のProject Modelを作らない。ただし、MCP実装の完了をWorkbench設計開始の絶対条件にはしない。UX／IAと公開能力の境界が固定されれば、UI／SPEC Detailは並行して具体化できる。Dogfoodでは実際のMCPまたは同じApplication Capabilityへ接続し、画面だけのMock成立をProduct成立へ読み替えない。

## 7. 下流で具体化・実証する事項

| 項目 | Discoveryで確認した境界 | 次の確認先 |
|---|---|---|
| Topic一覧と詳細の情報構造 | Topicは継続判断が必要な論点であり、現在状態、関係、経緯、根拠および次の処置へ進める | UX／IA／UI Detail |
| Meeting一覧と詳細の情報構造 | Meetingは時点記録であり、Outcome処置、Decision、Action、TopicおよびOwner Artifactへの接続を失わない | UX／IA／UI Detail |
| Topic／Meetingの削除と書込みAuthority | Relationを持つ誤登録も人間確認後に削除できるが、連鎖削除やDangling Relationを残さない | [REQ-000039](../../Definitions/REQ-000039/requirement.md)、SPEC／Architecture |
| Project Runtime Stateの旧公開名の利用実態 | Project ContextとProject Runtime Stateを別能力として扱う | Reality Audit／移行設計 |
| Workbenchで常時見せる情報と必要時だけ見せる情報 | WorkbenchをProject Context Viewerまたは汎用Dashboardへ限定しない | UX／IA／UI Detail |
| Workbench固有の横断Projection | Attention、関係・経緯、比較・変化および次の仕事をOwner Relation付きで投影する | UX／Dogfood |
| Version Control操作範囲 | 閲覧、Stage／Unstage、Commitおよび確認付き通常Pushを初期範囲とし、破壊的操作は含めない | SPEC／Architecture |
| Workbench固有価値 | Chat Agent＋MCPだけで十分という反証を維持する | Dogfood比較 |

## Checklist

- [x] Project ContextとProject Runtime Stateを別の能力として扱った。
- [x] TopicとMeetingを独立したOwnerおよびLifecycleとして扱った。
- [x] 読取り能力と状態変更能力を区別した。
- [x] MCP Resource／Toolの候補と、未確定の公開Schemaを区別した。
- [x] WorkbenchをProject Context Viewerへ限定していない。
- [x] WorkbenchをMCP操作の一覧画面へ限定していない。
- [x] Workbenchの横断Projectionと新しい正本を区別した。
- [x] Gitの現在状態をProject Contextや業務正本へ混ぜていない。
- [x] Version Controlを差し替え可能な外部境界として扱った。
- [x] Pushの送信先、確認、秘密値およびForce Push境界を評価した。
- [x] Workbenchの情報範囲と画面構成を混同していない。
- [x] 単一Repositoryの成立を複数Repository Federationより先に確認する順番を示した。
- [x] 既存WIPまたは現在の実装を要求の正解として扱っていない。
- [x] Topic／Meetingの代表利用場面、登録境界、Meeting Close、Repository所有および書込み・削除境界を人間と確認し、詳細な情報構造を後工程へ渡した。
- OPEN: Workbench固有価値はDogfood前であり、Chat Agent＋MCPで代替できる可能性が残るため — 同じ利用場面で比較する。
