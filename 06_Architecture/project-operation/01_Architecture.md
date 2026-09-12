# Project Operation Contextのアーキテクチャ

状態: Candidate（v0.21.0）
担当責任者: Qual-Lab
最終更新日: 2026-09-12
関連変更: [CHG-000067](../../90_Release/Changes/CHG-000067_Project_Operation_Context.md)

## 1. 対象と結論

Project Operation Contextは、案件の安定情報、継続論点、時点付き活動および既存CRDD正本を、Project運営に必要な読取り専用Viewへ接続する意味モデルである。Project Management Projectionを正本、更新StoreまたはWorkbench専用Databaseにしない。

```text
                 Project
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
   Commercial     Topics      Meetings
                      │           │
                      └─────┬─────┘
                            ▼
                 Project Management
                     Projection
                            │
                      ┌─────┴─────┐
                      ▼           ▼
                    Human       AI／MCP

CRDD Context ──→ Communication ──→ External Audience
                                            │
                                            ▼
                                        Observation
                                            │
                     Topic／Discovery／UX等へ候補として還流
```

矢印は参照または候補の受渡しを示し、Authorityの継承を示さない。Projectionから正本への更新は、対象正本が所有する専用Commandまたは変更候補を経由する。

## 2. IdentityとRepository Relation

```text
Project ID
  │
  ├─ Repository ID: repository-a
  │    ├─ Context Responsibility: project
  │    ├─ Context Responsibility: topics
  │    └─ Binding ID: canonical checkout
  │
  ├─ Repository ID: repository-b
  │    ├─ Context Responsibility: meetings
  │    └─ Binding ID: restricted checkout
  │
  └─ Repository ID: repository-c
       ├─ Context Responsibility: commercial
       ├─ Context Responsibility: communication
       └─ Binding ID: communication checkout
```

| Identity | 所有する意味 | 所有しない意味 |
|---|---|---|
| Project ID | 継続する案件、製品開発または目的集合の論理Identity | Repository Path、clone、実行許可、Organization Authority |
| Repository ID | Projectに属する一つの論理Repository | 単一の責務役割、実在Path、worktree、Credential、書込み許可 |
| Context Responsibility | Repositoryが正本として所有すると宣言する責務領域の集合 | 他RepositoryのAuthority、Relation先の内容、Tool実行Capability |
| Repository Binding ID | Repository IDと検証済みRoot／worktreeの実行時結合 | Project全体のAuthority、別Bindingの代替権限 |
| Artifact ID | Topic、Meeting、CHG等の所有正本内Identity | Relation先のAuthorityまたは現在性 |

v0.21のRepository ManifestはProject IDとRepository IDを別fieldとして保持する。同じProject IDに異なるRepository IDを関連付けられるが、同じRepository IDに複数の書込み可能Bindingがある場合は自動選択しない。Relation解決とOperation Authorizationを分離し、CROSは対象Binding、Principal、Policy、Revisionおよび操作AuthorityをRepositoryごとに再検証する。

Repository-local `.crdd`は、そのRepositoryの設定・状態・Evidence・一時物だけを保持する。Project IDが同じ別Repositoryの情報を、代表Repositoryの`.crdd`へ集約しない。

### 2.1. 責務領域の任意分割

Repositoryは単一の`Role`へ固定せず、所有するContext Responsibilityを複数宣言できる。Project、Commercial、Topics、Meetings、Communicationまたは工程領域は、同一Repositoryに同居しても、領域ごとに別Repositoryへ分離してもよい。

```text
Logical Project: PRJ-001
  │
  ├─ Repository A
  │    ├ Project
  │    ├ Discovery／UX／IA／UI／SPEC
  │    └ Development／Quality／Release
  │
  ├─ Repository B
  │    └ Topics
  │
  ├─ Repository C
  │    └ Meetings
  │
  └─ Repository D
       ├ Commercial
       └ Communication
```

| 規則 | 結果 |
|---|---|
| 一つのRepositoryが複数領域を所有する | 宣言した領域を同じBindingから読み取れる |
| 一つの領域を別Repositoryへ分離する | 同じProject ID、異なるRepository IDおよび責務宣言で接続する |
| Repositoryに対象領域がない | 空Directoryを作らず、その責務を宣言しない |
| 同じProject内で複数Repositoryが同じ責務をCanonical Ownerとして宣言する | 明示した分割規則がなければ`conflicting`として扱い、自動選択しない |
| 同じ責務を分割所有する必要がある | Artifact IDのnamespace、partitionまたは対象範囲を別契約で明示する。Pathや検索順で所有者を決めない |

Repository Manifestの既存`capabilities`はTool／Runtime Capabilityを表す。Context Responsibilityと混同せず、v0.21のSchemaでは別fieldとして表現する。CROSは責務宣言だけでRepositoryを信頼せず、検証済みBindingとTrust Policyの許可範囲を交差させる。


Repository名またはDirectory名は人間向け表示であり、Project IDまたはRepository IDの代用にしない。`PRJ-001-MGMT`、`PRJ-001-DEV`等の命名は利用者向けの例として使用できるが、CROSは名前のprefix／suffixからProject Relation、責務またはAuthorityを推定しない。


## 3. Repository分離とアクセス境界

Repository分離は、Git Hosting、Filesystem ACL、OS Principal、Credential Provider等の外部所有境界がRepository単位の読取りを実際に拒否できる場合に、情報アクセス境界として使用できる。CROS内の表示制御だけで同じOS Userが読めるRepositoryを隠しても、機密性の境界にはならない。

```text
                         Project ID: PRJ-001
                                  │
                    Relationのみ。Authorityは非継承
                ┌─────────────────┴─────────────────┐
                ▼                                   ▼
       Repository: MGMT                    Repository: DEV
       Project／Commercial                 Topics／Meetings
                │                                   │
       <<Git／OS Access Boundary>>         <<Git／OS Access Boundary>>
                │                                   │
        PM Principal: available             PM Principal: available
        Dev Principal: restricted           Dev Principal: available
```

| 状態 | 意味 | 内容の扱い |
|---|---|---|
| `available` | 検証済みBindingがあり、現在のPrincipalとPolicyで必要な読取りが許可された | 許可された範囲だけ投影する |
| `credential_required` | 外部所有の認証／Credential Activationを行えば利用可能になり得るが、現在のCapabilityがない | 内容を読まず、認証入口の有無だけを許可範囲で示す |
| `restricted` | Repositoryの存在またはRelationは許可範囲で確認できるが、現在のPrincipalには内容の読取り権限がない | 禁止されたfield、件数、Artifact IDまたは要約を返さない |
| `unavailable` | 登録済みだがBinding、Host、Networkまたは外部Serviceを現在利用できない | 認可拒否と混同せず、取得不能として保持する |
| `unknown` | 存在、Binding、認証または観測結果を安全に確定できない | `restricted`や不存在へ推定せず、後続Effectを止める |

Workbenchの`Unlock`表示は、Git Hosting、OS Credential Storeまたは認証Providerが所有する認証処理へのAdapterである。CROSは共通パスワードの照合、独自Credential Store、独自暗号化、Password RecoveryまたはRole Directoryを実装しない。認証Providerが発行したPrincipal／Sessionに限定された不透明なCredential参照またはCapabilityを受け取り、対象Repository、操作、期限および取消へ結合する。

既に同じLocal UserがRepository内容を読める状態では、Workbench上の再入力は誤操作防止または再確認には使えるが、情報アクセス制御とは表示しない。強い分離が必要な場合は、Repository Hosting権限、別OS Principal、Filesystem ACL、暗号化Volume等、対象環境が所有する境界を使用する。

### 3.1. 共通情報と縮約Projection

別Repositoryへ正本本文を無条件に複製しない。現在のPrincipalがSource Repositoryを読める場合は、CROSが実行時にSource-aware Projectionを構成する。

Source Repositoryを読めない利用者へ縮約情報を渡す場合、それは単なるCacheではなく、情報分類、公開対象、作成Authority、Source Revision、更新条件、保持および撤回を持つ別の公開成果物である。元Repositoryへのアクセス権がないことを理由に、CROSが自動で要約、匿名化または複製してはならない。

## 4. 責務境界

| 領域 | 所有する問い | 所有する情報 | 所有しない情報 |
|---|---|---|---|
| Project | この案件は何か | Summary、Scope、Stakeholder、Organization、Governance、大枠Schedule | CHG、品質状態、実行状態、Topic、Meeting、Commercial詳細 |
| Commercial | どの商取引条件で成立させるか | 採用先が必要とする見積・契約・採算等の正本または参照 | Project全体、実行Authority、v0.21共通の完全会計Schema |
| Topics | 今何を継続して議論・解決するか | Topic、現在状態、関係、昇格先、終了理由 | Meeting本文、CHG本文、Requirement本文、外部公開結果 |
| Meetings | 特定時点に誰と何を確認したか | 時間境界、参加主体、Source、関連Topic、確認Decision、更新正本、残った問い | 継続論点の現在状態、生Transcriptの無条件正本化 |
| Communication | 何を外部へどう伝え、何を観測したか | 受け手、主張、表現、媒体、公開状態、外部反応候補 | 内部Meeting、Project正本、外部反応からのRequirement自動確定 |
| Projection | Project運営上、現在何を判断すべきか | 各正本から導出した現在View、Source、取得時点、欠測・競合 | 独立した正本、直接更新可能なProject状態、Authority |

Commercialはv0.21で責務、Project Relation、可視性および分離可能性だけを共通契約にする。内容Schema、保持期間および法務・会計上のAuthorityは採用先の責務とし、CRDD共通Schemaを先に作らない。Commercialの分離は代表例であり、Topics、Meetings、Communicationその他の責務領域も同じRepository分離契約を使用する。

## 5. 媒体ではなく目的による分類

| 入力例 | 主目的 | 解決先 |
|---|---|---|
| Teams会議で内部設計を確認 | 時点付きのContext形成 | Meeting |
| Slackで数日にわたり未解決論点を追跡 | 継続的Attention | Topic |
| Teamsから顧客へReleaseを案内 | 外部への伝達・公開 | Communication |
| 顧客会議で課題候補を観察 | Meeting SourceとObservation候補 | MeetingからDiscovery／Topic候補へ接続 |
| 外部記事への反応 | 公開結果の観測 | Communicationから責務領域への候補還流 |

Connectorは入力Adapterであり、Slack、Teams、Meet、Zoom、Email等の名称から意味領域を確定しない。目的、受け手、時間境界、継続性、公開状態および決定権限が不足する場合は、自動分類または昇格を行わない。

## 6. TopicとMeetingのLifecycle

### Topic

```text
Candidate
   │ 根拠・継続追跡価値・所有Projectを確認
   ▼
 Open ───────────────┐
   │                  │ 情報不足・外部待ち
   │                  ▼
   │               Waiting
   │                  │ 再評価
   ├──────────────────┘
   │
   ├─→ Promoted ──→ Discovery／Decision／CHG／Roadmap／Work
   │
   └─→ Closed     ──→ 終了理由と残存影響を保持
```

| 遷移 | 必要条件 | 禁止事項 |
|---|---|---|
| Candidate → Open | 既存正本へ一意に還元できず、継続追跡価値とProject Relationが確認できる | 会話中に言及されたことだけで作成しない |
| Open ↔ Waiting | 待機理由、確認先、再評価契機を保持する | 情報不足をClosedまたは正常へ畳まない |
| Open → Promoted | 昇格先、移した意味、残るTopic責務およびAuthorityを確認する | Topic本文を別正本へ無条件複製しない |
| Open／Waiting → Closed | 終了理由、未解決影響、関連正本を確認する | 表示上消えたことを終了とみなさない |

### Meeting

```text
Source／予定
     │ 時間境界と対象Projectを確認
     ▼
  Recorded
     │
     ├─→ Topic Candidate
     ├─→ Decision Candidate
     ├─→ Context Update Candidate
     └─→ No Promotion
```

Meeting Recordは時点付き記録であり、後から判明した現在状態で当時の内容を上書きしない。誤りは訂正履歴または後続記録で扱う。生Transcript、録音またはConnector payloadはSource／Evidenceであり、Meeting Recordそのものと同一視しない。

## 7. Project Management Projection

```text
Canonical Sources
├ 20_Project
├ 21_Commercial（利用可能性またはRestrictedのみの場合がある）
├ 22_Topics
├ 23_Meetings
├ Discovery／UX／IA／UI／SPEC／Architecture
├ Quality／Verification
├ CHG／Release
├ Roadmap
├ Git
└ Runtime／Execution
          │
          ▼
   Source-aware Resolver
          │
          ▼
 Project Management Projection
├ Current Milestone／Readiness
├ Active／Waiting／Blocked
├ Decision Required
├ Open Topic／Recent Meeting
├ Quality／Recovery
├ Source／Observed At
└ Missing／Restricted／Conflicting／Stale
```

| 原則 | 契約 |
|---|---|
| Read Model | Projectionは再計算可能な派生Viewであり、正本として更新しない |
| Source-aware | 各Propertyに所有正本、対象Revisionまたは取得時点へ戻れる根拠を持つ |
| 欠測保持 | `missing`、`restricted`、`conflicting`および`stale`を空値、正常または0へ畳まない |
| 非集約Authority | 複数Repositoryを読めても、書込み、Credential、Recoveryまたは人間判断Authorityを統合しない |
| 分離した尺度 | 進捗、品質、判断待ち、Risk、RecoveryおよびRelease Readinessを単一Scoreへ畳まない |
| 操作境界 | UI／MCP操作は所有正本へのCommandまたはCandidateを生成し、Projectionを直接変更しない |

## 8. 任意Repository構造

```text
Repository
├ 20_Project/       案件の安定情報を扱う場合
├ 21_Commercial/    商務情報をこのRepositoryで扱う場合
├ 22_Topics/        継続論点を扱う場合
├ 23_Meetings/      時点付き活動を扱う場合
└ 80_Communication/ 外部コミュニケーションを扱う場合
```

各領域は利用可能な標準責務であり、連続工程、必須のDirectory集合または包含関係ではない。使用する場合だけ固定入口と責務契約に従い、使用しない場合は空Directoryまたは空成果物を作らない。別Repositoryへ分離した場合もPathで意味を推定せず、Project ID、Repository ID、Artifact Relationおよび検証済みBindingで接続する。

`20_Project`をProjectの代表Repositoryへ必ず置く規則にはしない。Projectの安定情報を所有するRepositoryだけが`project`責務を宣言し、Commercial、Topics、MeetingsまたはCommunication専用Repositoryは、Repository ManifestだけでProject Relationを示してよい。

## 9. Component境界

```text
Human／AI／CLI／MCP
          │
          ▼
 Public Project Operation Contract
          │
          ▼
 Project Operation Application
├ Identity／Relation Resolver
├ Topic／Meeting Lifecycle
├ Projection Builder
└ Command／Candidate Router
          │
          ├─→ Repository Read Ports
          ├─→ Owner-specific Command Ports
          └─→ CROS Repository Router

Infrastructure Adapters
├ Filesystem／Git
├ Runtime Data
├ MCP／HTTP
└ Future Workbench
```

Project Operation CoreはFilesystem Path、MCP DTO、Workbench表示形式または特定Project管理Toolへ依存しない。CROS Repository RouterはRelation解決を担当できるが、正本更新やProject横断Authorityを所有しない。

## 10. 実装前の検証義務

- 同一RepositoryにProject、Topic、Meetingが同居する構成を投影できる。
- 同じProject IDに異なるRepository IDが属する構成を投影できる。
- Commercial、Topics、MeetingsまたはCommunicationのいずれかを独立Repositoryへ分離できる。
- 一つのRepositoryが複数のContext Responsibilityを所有できる。
- 分離RepositoryがRestrictedでも、内容を漏らさず可視性状態を表現できる。
- `credential_required`、`restricted`、`unavailable`および`unknown`を区別し、表示上のUnlockをAuthorityとして扱わない。
- 読取り不能なRepositoryのArtifact ID、件数、要約または存在を許可範囲外へ漏らさない。
- 同じOS Userが読めるRepositoryに対するCROS内ロックを、強い情報アクセス境界として表示しない。
- 縮約Projectionを別Repositoryへ保存する場合、情報分類、作成Authority、Source Revision、更新・保持・撤回条件がない自動複製を拒否する。
- 同じ責務の無宣言な重複所有を`conflicting`として扱い、検索順で正本を選ばない。
- 同じRepository IDの競合Binding、Project Relation不一致、stale Revisionまたは観測不能でEffect 0になる。
- Topic昇格後も元Topicの履歴と昇格先を追跡でき、第二正本を作らない。
- Meeting Sourceのサービス名だけでは分類・昇格しない。
- Projectionの表示または操作からAuthorityを生成せず、所有正本のCommandへ戻る。
- 使用しない任意領域をCheckerが欠落として拒否しない。

## 11. 未確定事項

| 項目 | 現在の扱い | 確定契機 |
|---|---|---|
| Repository IDの具体形式 | Project IDと別の安定Identityを要求する | Runtime Data Schemaと移行設計 |
| 各Top-levelの固定入口名 | 一領域一入口、空成果物禁止まで固定 | Documentation／Template設計 |
| Commercialの内容Schema | 共通化しない | 代表利用とアクセス要件が得られた時 |
| Projectionの公開field | 意味と欠測状態だけ固定 | SPECと代表View設計 |
| 認証Adapter | CROS独自Password Gateは作らず、外部Credential ProviderへのPortだけを候補にする | MCP／Workbenchの認証設計 |
| Workbench | Projection利用側に限定 | v0.21基盤成立後の別判断 |
