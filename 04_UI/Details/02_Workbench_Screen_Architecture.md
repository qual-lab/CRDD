# Workbench Screen Architecture

成果物種別: UI Detail — Screen Architecture
対象Product: CROS Workbench
状態: Draft — G1 Passed／G2以降OPEN
維持責任者: Qual-Lab

## 1. 結論

Workbenchは、Projectの現在地を起点に、判断、正本、AIとの対話、Topic／Meeting、Repositoryの作業差分および接続設定へ進む仕事の入口とする。Project Contextだけを並べるDashboardにも、MCP Toolの一覧にも、簡易Git Clientだけにも限定しない。

G1では、対象範囲を15のLogical Screenへ分けた。登録・編集・削除、Commit・Push等の操作は、独立した利用者目的を持たない限り別Screenへ増殖させず、対象Screen内のInteraction、Stateまたは確認Flowとして後続で具体化する。

```text
Portfolio／前回のProject
        ↓
Project Workspace
        ├─ Project Plan
        ├─ Topics ──────→ Topic Detail
        ├─ Meetings ────→ Meeting Detail ─→ Topic Detail
        ├─ Quality
        ├─ Documentation
        ├─ Runtime Activity
        ├─ AIへの依頼
        └─ Repository Worktree

Global Configuration
        ├─ Connection Setup
        ├─ Access Administration
        └─ AI Profiles
```

## 2. 対象範囲と判断単位

| 対象 | G1で保持する意味 | G1で決めないこと |
|---|---|---|
| Project Context | 五場面、根拠、不完全性、Owner Relationから仕事を開始する | Card配置、色、Typography |
| Project横断 | Federation済みProjectの現在状態を、権限内で比較する | 非開示Repositoryの存在推測 |
| Topic／Meeting | 一覧、詳細、登録、編集、終了、訂正、影響確認付き削除へ進む | API、保存方式、Dialog外観 |
| AIへの依頼 | Project Contextを付けて既存AI Runtimeへ質問・作業を依頼し、事実、保存済み共有分析、その場の追加推論を分けて確認する | Panel／独立画面の選択、最終Composition |
| Repository作業 | Tree、Diff、Stage、Commit、確認付き通常Pushを一つの流れで扱う | Force Push、Merge、Rebase、Discard |
| 接続・管理 | Role別Credential、接続先、通常管理およびCLI限定Recoveryへの導線を分ける | User Account管理、Remote Recovery操作 |
| AI Profile | 仕事Profile、Provider Adapter、Modelおよび推論設定を区別する | Provider固有秘密値の表示・保存方式 |

## 3. UI Area

| UI Area | 目的 | 主な利用者 | 含むScreen |
|---|---|---|---|
| Portfolio | 複数Projectの差、注意、観測範囲から確認対象を選ぶ | PM、Management | 画面候補01 |
| Project Work | 一つのProjectの現在地、根拠、判断、正本および次の仕事を扱う | Developer、PM、Management | 画面候補02〜11 |
| Repository Work | Project上の意味と現在の作業差分を結び、共有可能な状態へ進める | Developer、Project Operator | 画面候補12 |
| Configuration | CROS接続、Role別CredentialおよびAI Profileを安全に維持する | Developer、Administrator | 画面候補13〜15 |

AreaごとのComposition、Information Density、Visual Hierarchy、Interaction、Accessibilityおよび避ける表現はG4の人間判断後に`area.md`へ固定する。G1ではScreen境界とFlowだけを決め、Visual Directionを先取りしない。

## 4. Screen Inventory

| 候補 | Logical Screen | Area | 利用者の目的 | 入口 | 終了条件 | 主なUI Definition |
|---|---|---|---|---|---|---|
| 画面候補01 | Project Portfolio | Portfolio | 複数Projectの差、Attention、観測範囲を比較し、確認するProjectを選ぶ | Workbench起動、Project切替 | 対象Projectを選択した、または比較判断を終えた | UI-000004、UI-000008 |
| 画面候補02 | Project Workspace | Project Work | 五場面をまとめて理解し、次に確認・判断・実行する仕事を選ぶ | Project選択、Repository単体起動 | 詳細ScreenまたはOwner Artifactへ進んだ、もしくは現状確認を終えた | UI-000004、UI-000006、UI-000007 |
| 画面候補03 | Project Plan | Project Work | Version、Milestone、Scope、期限、依存、判断待ちを理解する | Project Workspace、Owner Relation | 計画上の次行動か判断対象を選んだ | UI-000004、UI-000015 |
| 画面候補04 | Topic List | Project Work | 継続して扱うTopicを状態、Attention、関係から発見・登録する | Project Workspace、Meeting候補 | Topicを選択・登録した、または一覧確認を終えた | UI-000009 |
| 画面候補05 | Topic Detail | Project Work | Topicの現在状態、経緯、関係、Ownerおよび次の処置を理解・更新する | Topic List、Meeting Detail、Relation | 更新・終了・影響確認付き削除・Owner Artifactへの昇格を終えた、または戻った | UI-000009、UI-000017 |
| 画面候補06 | Meeting List | Project Work | Meetingを時点、処置残り、関連Topicから発見・登録する | Project Workspace | Meetingを選択・登録した、または一覧確認を終えた | UI-000009 |
| 画面候補07 | Meeting Detail | Project Work | Meeting記録、Decision／Action／Topic候補と未処置Outcomeを確認・訂正する | Meeting List、Topic Relation | Outcomeを処置しMeetingを閉じた、Topicへ移した、訂正・影響確認付き削除を終えた、または戻った | UI-000009、UI-000017 |
| 画面候補08 | Quality and Evidence | Project Work | 現在保証できること、Gap、未観測、根拠および次Gateを理解する | Project Workspace、Project Plan | 根拠、是正対象または次Gateを選んだ | UI-000014、UI-000015、UI-000020 |
| 画面候補09 | Documentation and Relations | Project Work | 正本、関係、経緯および現在有効な意図を見つける | Project Workspace、各Relation | 対象正本を開いた、関係を辿った、または戻った | UI-000017、UI-000018、UI-000019 |
| 画面候補10 | Runtime Activity | Project Work | 実行中Objective／Taskの状態、判断待ち、失敗および回復先を確認する | Project Workspace、AIへの依頼 | 判断を返した、回復へ進んだ、または監視を終えた | UI-000002、UI-000003、UI-000005、UI-000020 |
| 画面候補11 | AIへの依頼 | Project Work | Project Contextと選択中の正本を基にCodexやClaude Code等へ質問・作業を依頼し、事実・共有分析・追加推論を区別して次へ進む | Project Workspace、各Detail、選択Context | 根拠を開いた、提案を判断した、正式成果物へ反映した、または現在Sessionを終えた | UI-000007、UI-000010、UI-000012、UI-000016 |
| 画面候補12 | Repository Worktree | Repository Work | Treeと差分を理解し、Stage／Unstage／Commit／通常Pushまで安全に進める | Project Workspace、Topic／Meeting／AIへの依頼 | CommitまたはPush結果を確認した、作業差分を残して戻った | UI-000006、UI-000015 |
| 画面候補13 | Connection Setup | Configuration | CROS Endpointと渡されたRole別Credentialを登録し、許可範囲で接続する | 初回接続、接続切れ、接続先切替 | 接続した、再入力が必要と分かった、またはRepository単体利用へ戻った | UI-000008 |
| 画面候補14 | Access Administration | Configuration | Role別Credentialを発行・失効・ローテーションし、回復が必要な状態を判断する | Administrator用Navigation | 通常管理を完了した、またはCLI限定Recoveryの案内へ移った | UI-000008、UI-000015 |
| 画面候補15 | AI Profiles | Configuration | 仕事Profile、Provider、Model、推論設定および利用可否を理解・選択する | AIへの依頼、設定 | Profileを選択・保存した、または利用不能理由を理解した | UI-000010、UI-000013 |

### 4.1 大量情報を扱う表示面

| 画面候補 | 増加する対象 | G1で固定する表示責務 | 必須UI状態 | SPEC Detailへ渡すBehavior |
|---|---|---|---|---|
| 01 Project Portfolio | Project | 検索、状態・Attentionによる絞り込み、並び順、Cursorによる継続読込 | 初回読込、追加読込、空、部分成功、失敗 | 取得上限、Continuation、Sort／Filter固定、Federation部分成功、非開示件数の扱い |
| 04 Topic List | Topic | 検索、状態・Owner・Relationによる絞り込み、並び順、Cursorによる継続読込 | 初回読込、追加読込、空、競合、失敗 | 取得上限、Continuation、更新・削除時の再配置、同一Topic重複防止 |
| 06 Meeting List | Meeting | 期間・未処置Outcome・Relationによる絞り込み、新しい順、Cursorによる継続読込 | 初回読込、追加読込、空、競合、失敗 | 取得上限、Continuation、時点境界、更新・削除時の整合 |
| 08 Quality and Evidence | QA Local Item、Evidence、Gap | 検証目標・段階・状態によるGroup表示、Group単位の展開と継続読込 | 初回読込、追加読込、未実施、未観測、部分成功、失敗 | Group単位取得、Continuation、状態語彙、Evidence非開示、部分観測 |
| 09 Documentation and Relations | Artifact、Relation、履歴 | 検索を入口とし、Relationを段階展開する。全Graphを初期描画しない | 初回読込、追加展開、結果なし、循環、部分成功、失敗 | 検索上限、Relation Cursor、循環検出、権限境界、欠落Relation |
| 10 Runtime Activity | Objective、Task、Event | 実行中を優先し、完了履歴は新しい順で継続読込 | 初回読込、更新中、追加読込、空、接続切れ、観測不能 | 取得上限、Continuation、再接続、Event重複・欠落、Currentness |
| 12 Repository Worktree | Directory、File、Diff | Directoryを遅延展開し、表示行を仮想化する。DiffはFile・Chunk単位で読み込む | 初回読込、展開中、Diff読込、空、変更、競合、観測不能 | Tree Cursor、内容上限、Diff Chunk、作業中変更、Symlink／Boundary、部分失敗 |
| 14 Access Administration | Credential記録 | Role・状態による絞り込み、発行Secretと管理一覧を分離、必要時だけ継続読込 | 初回読込、追加読込、空、失効中、結果不明、失敗 | 取得上限、Continuation、Secret非再表示、ローテーション中の整合 |

Project Workspace、Project Plan、Topic Detail、Meeting Detail、AIへの依頼、Connection SetupおよびAI Profilesも内部に履歴や候補一覧を持ち得る。ただし現時点では独立した大量Collectionを所有せず、Owner Artifactまたは上表の一覧へ移動する。実際のDogfoodで長大な埋込み一覧が必要になった場合は、Screenを増やす前に情報OwnerとNavigationを再評価する。

UIは全件取得を要求しない。具体的な件数上限、Cursor形式、Snapshot整合、追加読込中の更新、権限外項目の件数開示および部分失敗のSystem Contractは、正式ID発行後のSPEC Detailで定義する。

## 5. Global Navigation Flow

```text
[Workbenchを開く]
       │
       ├─ 前回Projectを利用可能 ───────────────┐
       │                                       v
       ├─ 複数Projectを比較する ─→ [画面候補01 Portfolio]
       │                                       │ select
       └─ Repository単体で開始 ────────────────┘
                                               v
                                  [画面候補02 Project Workspace]
                                      │  │  │  │  │
                ┌─────────────────────┘  │  │  │  └──────────────┐
                v                        v  v  v                 v
          Project Plan               Topic Meeting          Repository Worktree
                │                        │  │                    │
                ├─ Quality／Evidence     │  └─ Meeting Detail ──┤
                ├─ Documentation        └──── Topic Detail <────┘
                ├─ Runtime Activity
                └─ AIへの依頼

どのDetailからも:
  Project Workspaceへ戻る
  Owner Artifactを開く
  現在の対象を保ったままAIへの依頼へ渡す
```

## 6. Topic／Meeting Flow

```text
[Project Workspace]
       │
       ├─ Topics ─→ [Topic List] ─→ [Topic Detail]
       │                 │ create        │ edit／close／promote
       │                 └───────────────┘
       │                                  │ delete
       │                                  v
       │                         [影響・Relation・復旧可能性を確認]
       │                                  ├─ cancel → Topic Detail
       │                                  └─ confirm → 結果を同じContextで表示
       │
       └─ Meetings → [Meeting List] → [Meeting Detail]
                         │ create            │ outcome
                         └───────────────────┤
                                             ├─ Meeting内で完結 → close
                                             ├─ 継続が必要 → Topicへ移す → Topic Detail
                                             └─ 訂正／delete → 影響確認 → 結果表示

失敗・競合・部分成功:
  入力と対象Identityを保持
  成功した処置と未処置を分ける
  安全な再試行、再読込または取消へ戻す
```

MeetingのActionが未完了でも、継続責任をTopicまたは別のOwner Artifactへ移しRelationを残した場合はMeetingを閉じられる。未処置ActionをMeetingの外へ移さず、完了したように見せない。

## 7. Repository Work Flow

```text
[Project Workspace／Topic／Meeting／AIへの依頼]
       │ current Repository context
       v
[画面候補12 Repository Worktree]
       │
       ├─ Tree／Staged／Unstaged／Untracked／Conflictを確認
       ├─ Fileを選択 → Diff／Staged Diffを確認
       ├─ Stage／Unstage → 同じ差分Contextへ戻る
       └─ Commit候補を確認
              ├─ validation failure → 入力と差分を保持
              └─ Commit成功 → Commit結果を確認
                                │
                                └─ Pushを選択
                                      ↓
                              Remote／Branch／Commitを確認
                                  ├─ cancel → Commit結果
                                  ├─ reject／unknown → 状態を推測せず回復案内
                                  └─ success → 送信結果と残る差分を表示
```

Force Push、暗黙のUpstream作成、Branch作成、Merge、Rebaseおよび通常のDiscardはG1対象外である。Project情報の閲覧とTopic／Meeting操作は未Commit状態でも利用できる。

## 8. AIへの依頼Flow

```text
[任意のScreen]
       │ 選択中Project／Owner Artifact／差分を明示して渡す
       v
[画面候補11 AIへの依頼]
       │
       ├─ 確認済み事実
       ├─ 保存済み共有分析
       └─ 今回の追加推論・提案
              │
              ├─ 根拠を開く → Owner Artifact／Detail Screen
              ├─ 提案を採用候補へ → Topic／Meeting／CHG等のOwnerへ
              ├─ Repository作業へ → Repository Worktree
              └─ Profile変更へ → AI Profiles → 元のContextへ戻る

Provider失敗／利用不能:
  事実や保存済み分析を失敗扱いへ畳まない
  未送信・送信済み・結果不明を区別
  再試行、別Profile、元のScreenへ戻る導線を示す
```

Workbenchが所有するのは、選択中Contextを既存AI Runtimeへ渡す依頼面と現在Sessionの表示である。Codex、Claude Code等のProvider側会話履歴をWorkbenchの正本へ複製しない。継続して共有すべき結果だけを、利用者の判断を経てTopic、Meeting、CHG、DecisionまたはProject Contextを所有する成果物へ反映する。

画面候補11は独立Screenへの確定を意味しない。G2では、Project Workspace内の常設Panel、必要時に開くSide Panel、複雑な依頼向けの独立表示および外部AIを開くContext付き入口を比較する。

## 9. Connection／Administration Flow

```text
[Remote CROSを利用]
       ↓
[画面候補13 Connection Setup]
       ├─ Endpoint＋Credentialを登録 → 接続確認 → Projectへ
       ├─ credential_required → 再入力案内
       ├─ restricted／unavailable／unknown → 開示可能範囲だけ説明
       └─ Repository単体利用 → CROS CredentialなしでProjectへ

[Administrator]
       ↓
[画面候補14 Access Administration]
       ├─ Role別Credentialを一度だけ発行
       ├─ 新Credential発行 → 利用側切替 → 旧Credential失効
       ├─ 対象Credential失効
       └─ 全Administrator喪失／認可破損
              ↓
          Workbench内で復旧操作しない
              ↓
          ServerローカルCLI Recoveryの対象・影響・再入場を案内
```

## 10. 共通の失敗・戻る・回復契約

| 状況 | 表示する意味 | 保持するもの | 戻る／回復 |
|---|---|---|---|
| Owner情報が欠ける | 現在状態を完全には判断できない | Project、対象Relation、確認済み範囲 | Owner Artifact、再投影、元Screen |
| Access制限 | 現在のRoleでは利用できない、または存在開示できない | 開示を許可された情報だけ | Project選択、Connection Setup |
| 競合 | 保存時点から対象が変化した | 入力、対象Identity、比較可能な差分 | 再読込、差分確認、取消 |
| 書込みの一部成功 | 成功済みと未処置が混在する | 個別結果、Relation、再試行可能性 | 未処置だけ再試行、Owner確認 |
| Version Control観測不能 | Tree／Diffの現在値を断定できない | Project Contextと業務正本 | Repository再観測、外部Git Client |
| 外部Effect結果不明 | Push等の結果を成功・失敗へ推測できない | 要求対象、送信先、相関情報 | 状態再確認、既存Credential境界の支援 |
| AI Provider失敗 | AI回答を得られない | 確認済み事実、共有分析、利用者入力 | 再試行、別Profile、元Screen |

全Screenは、少なくともProject Workspaceまたは開始元へ戻れる。失敗画面を行き止まりにせず、結果不明を失敗として再実行させない。

## 11. G1 Gate評価

| Gate条件 | 判定 | Evidence／理由 |
|---|---|---|
| 対象範囲のLogical Screenを全件列挙した | PASS | §4の15 Screen |
| 各Screenの利用者目的、入口、終了条件を示した | PASS | §4 |
| 正常な主要Flowを示した | PASS | §5〜§9 |
| 分岐と戻る経路を示した | PASS | §5〜§9 |
| 失敗、競合、部分成功、結果不明からの回復を示した | PASS | §6〜§10 |
| Repository単体とRemote CROSの入口差を示した | PASS | §9 |
| Role外の情報を推測表示しない | PASS | §9〜§10 |
| 大量化し得る一覧・Tree・履歴を識別し、全件取得・全件描画を前提にしていない | PASS | §4.1 |
| 具体的な取得・整合・権限・部分失敗契約をSPEC Detailへ分離した | PASS | §4.1 |
| Hero、Composition、Visual Directionを先取りしていない | PASS | §2〜§3 |

G1を通過する。G2は未着手であり、Hero Screen、Visual Direction、Visual Baseline、Secondary Screen、PatternおよびCMPを確定してはならない。G2以降が通過するまで、Workbench固有UI DetailをSPEC Detail、ArchitectureまたはQualityへ通常引き渡ししない。

## 12. 未確認事項・戻り条件

| 項目 | 現在状態 | Owner | 影響 | 戻り条件／再評価契機 |
|---|---|---|---|---|
| Project WorkspaceとAIへの依頼面の分離 | OPEN | Qual-Lab | Hero候補、常設Panel、独立表示および外部AI入口の判断に影響 | G2で同一Screen、Side Panel、独立表示およびContext付き外部入口を比較する |
| Project Plan、Quality、Documentationの独立Screen粒度 | OPEN | Qual-Lab | Navigation深度と情報密度に影響 | HeroおよびSecondary Screenの具体化で一つのScreen内Sectionが適切と分かった時 |
| Topic／MeetingのListとDetail分離 | OPEN | Topic／Meeting利用者、Qual-Lab | 日常操作回数に影響 | Prototypeで一覧内編集の方が意味と安全性を保てると確認した時 |
| Access AdministrationのWorkbench範囲 | OPEN | CROS Administrator、Qual-Lab | 通常管理とCLI境界に影響 | Credential配布負担と通常管理のDogfood時 |

これらはG1のScreen候補を固定実装へ昇格する前にG2〜G5で検証する。利用者成果、Owner、Authorityまたは情報境界が誤っていると判明した場合はUI Detail内で調整せず、該当するUI／UX／IAへ戻す。

## Checklist

- [x] G1: v0.22で採用済みのWorkbench対象範囲をScreen Inventoryへ処置した
- [x] G1: Logical ScreenをRoute、Tab、DialogまたはFigma Frameだけで定義していない
- [x] G1: 各Screenの利用者目的、入口および終了条件を示した
- [x] G1: 正常Flow、分岐、戻る、失敗および回復を示した
- [x] G1: Topic／Meetingの登録・編集・終了・訂正・削除をFlow上で処置した
- [x] G1: RepositoryのTree／Diff／Stage／Commit／確認付き通常PushをFlow上で処置した
- [x] G1: Project Context、AI追加推論およびVersion Control状態を別のOwnerとして扱った
- [x] G1: Repository単体利用とRole別Credentialを使うRemote CROS利用を分けた
- [x] G1: Role外情報と非開示Repositoryを推測表示していない
- [x] G1: 失敗、競合、部分成功および結果不明を成功へ畳んでいない
- [x] G1: Recoveryを行き止まりや無条件再実行にしていない
- [x] G1: 大量化し得る一覧・Tree・履歴を全件評価し、全件取得・全件描画を暗黙の前提にしていない
- [x] G1: 検索・絞り込み・並び順・継続読込・遅延展開・仮想表示・内容分割の適用を処置した
- [x] G1: 取得上限、Continuation、整合、権限境界および部分失敗をSPEC Detailへ引き渡した
- [x] G1: Visual Direction、Heroの採用、PatternまたはCMPを先取りしていない
- OPEN: G2でHero候補を比較し、人間が代表性と偏りを確認する必要があるため — G2: G1通過後にHero候補を比較し、代表性と偏りを記録した
- OPEN: G3はG2後に実行するため — G3: Heroについて2案以上のRendered View、Intent、Trade-offおよび保持するUX／IAを比較した
- OPEN: G4はVisual案比較後の人間判断であるため — G4: AI提案と人間の方向性判断を分け、採用理由と再探索条件を記録した
- [x] G5: 採用DirectionをTopic Detail、Repository Worktree、Project Portfolioへ展開してからPatternを評価した
- [x] G5: CMP候補を個別評価し、早期昇格を避ける理由と再評価条件を記録した
- [x] 未通過Gateより後の成果物をCanonical、完了または下流引き渡し可能と表示していない
