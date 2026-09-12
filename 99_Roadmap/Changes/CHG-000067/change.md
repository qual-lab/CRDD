# 変更トレース: Project Operation Context

変更ID: `CHG-000067`
状態: `In Progress`
担当責任者: Qual-Lab
対象版: `v0.21.0`
変更分類: `feature`
最終更新日: 2026-09-12

## 1. 結論と現在状態

Project Management Projection、Topic／Project AttentionおよびMeeting／Context Promotionを、一つのProject Operation Contextとして設計・実装する。Project、Commercial、Topic、MeetingおよびCommunicationは物理階層ではなく責務と安定Identityで接続し、同一Repositoryへの同居と別Repositoryへの分離を可能にする。

```text
Project Operation Context
├ Identity
├ Responsibility
├ Lifecycle
├ Relation
├ Read-only Projection
└ Optional Repository Structure
```

| 項目 | 現在状態 |
|---|---|
| Project／Repository／Binding Identity | 設計中 |
| 責務・Authority・Relation | 設計中 |
| Topic／Meeting Lifecycle | 設計中 |
| Project Management Projection | 設計中 |
| 任意Top-level構造 | 設計中 |
| 仕様・ひな型・Checker・試験 | 未着手 |

## 2. 契機と人間が決定した範囲

2026-09-12の利用者対話で、次を決定した。

- `Project ID`と`Repository ID`を分け、一つの論理Projectが複数Repositoryを持てるようにする。
- `20_Project`は案件の安定情報だけを所有し、CHG、Quality、Roadmap、Git、実行状態、Topic、MeetingまたはCommercialを複製しない。
- Project Management Projectionは読取り専用の派生Viewであり、正本または独立Project管理Databaseにしない。
- Project、Commercial、Topics、MeetingsおよびCommunicationを別責務とし、安定IDとRelationで接続する。
- Commercialだけを特別扱いせず、Project、Topics、Meetings、Communicationその他の大きな責務領域も、同一Repositoryへの同居と領域単位の別Repository分離を選べるようにする。
- Repositoryを単一Roleへ固定せず、所有するContext Responsibilityの集合を宣言する。既存のTool／Runtime Capabilityとは別fieldで扱う。
- Meeting、TopicおよびCommunicationは使用サービスではなく目的と意味で分類する。
- `20_Project`、`21_Commercial`、`22_Topics`および`23_Meetings`は、使用するRepositoryだけに置く任意領域とする。
- CommercialはProjectとの分離境界だけをv0.21で固定し、会計・請求・税・通貨等の完全Schemaを作らない。
- 情報アクセス差はRepository分離、既存Git／OSの権限およびShared CROS ServerのWorkspace Exposureで表現し、CROSを独自IAM、Password Storeまたは暗号化製品にしない。
- Workbench等のUnlock操作は外部所有の認証処理への入口に限定し、同じOS Userが読める内容の表示ロックを強い情報境界とみなさない。
- Source Repositoryを読めない利用者向けの縮約Projectionは、自動要約や複製ではなく、明示的に許可された公開成果物として扱う。
- Project Operation Contextを一つの変更単位として設計し、実装と試験は責務単位で分ける。
- CROS Coreへ`general／privileged／administrator`の固定Role階層を設けず、`system_admin: true`のConnection Credentialによる管理RequestがCredentialごとの`workspace_ids[]`を設定する。
- `system_admin`、Content Access、既存の開示制約、Task Roleおよび人間の決定権限を別軸に保つ。
- Chat AgentとCoding Agentは同じCRDD正本から解決したAgent Operating Contextを参照し、会話全文のPrompt転記ではなく構造化Contextと判断要求でHandoffする。
- MCP接続済みであることを、CRDD規則の認識、準拠、Repository AccessまたはEffect Authorityの根拠にしない。
- v0.21へ採用済みのProject Operation／CROS Capabilityは、既知の次版全面Refactorを前提とする中間構造で正式化せず、現在宣言した利用形態を満たす最小責務を利用者入口から実境界・利用側まで閉じる。
- 内部のSpike、垂直Sliceおよび段階的結合試験は維持し、部分成立を公開CapabilityまたはRelease可能と表示しない。

## 3. 既存契約からの発展

v0.19は一つのProjectを一つの明示Binding済みRepositoryへ結合した。CHG-000066はRepository-local `.crdd`のManifestへProject IDを置き、同じProject IDの複数書込みBindingを安全側で拒否した。v0.21の複数Repository Projectでは、Repositoryの論理Identityと実在するclone／worktreeのBindingを分ける。

```text
v0.19／CHG-000066
Project ID ──→ Repository Binding

v0.21
Project ID
  └─ Repository ID
       └─ Repository Binding ID
```

| 保持する保証 | 変更する意味 |
|---|---|
| Repository-local `.crdd`にはそのRepositoryの情報だけを置く | 同じProject IDを持つ複数の異なるRepository IDを許容する |
| Directory探索だけでProject／Repositoryを登録しない | Repository ManifestにRepository IDを追加する |
| 同じ論理Repositoryの複数書込みBindingを自動選択しない | 重複判定をProject ID単独からRepository IDとBindingへ移す |
| Binding、Authority、Credential、RecoveryをProject間で暗黙継承しない | CROSはProject Relationを読み取っても個別RepositoryのAuthorityを再検証する |

既存のProject IDをそのままRepository IDへ複製する移行を既定にしない。既存Repositoryの論理ProjectとRepository Identity、同じProjectへ属する他Repositoryの有無、およびBinding競合を確認できる移行入力を先に定める。

## 4. 対象範囲

| 対象 | 変更内容 |
|---|---|
| Discovery | Project運営、Topic、Meeting、Commercial境界とWorkbenchが解決する利用者課題、対象者、代替および採用条件を固定する |
| UX | Developer、PM、Managementごとの目的、Journey、欠測／Restricted時の理解と回復、およびRepository構造を過剰に意識させない体験原則を固定する |
| IA | Entity、Identity、Relation、所有責任および情報導線を固定する |
| Documentation | 任意Top-level領域、固定入口および非該当時の空成果物禁止を固定する |
| Architecture | Projection、Resolver、Repository接続、読取り・更新PortおよびAuthority境界を設計する |
| UI | Project／Portfolio、Source Coverage、Topic／Meeting／判断待ち、正本導線、Credential状態および定型操作の表示・Feedback・回復を固定する |
| UI／SPEC対応 | UI上の各表示・操作・状態を、Topic／Meeting／Projection／CROS公開契約の入力、結果、失敗およびEffectへ全数対応させる |
| SPEC | Topic／Meeting／Projection／Workbench操作の入力、状態、結果、失敗およびEffectを定義する |
| Runtime Data | Project／Repository／Binding IdentityのSchemaと移行を追加する |
| Implementation | 共通Core、Resolver、Projectionおよび必要な公開Interfaceを実装する |
| Quality | 単一Repository、複数Repository、分離Repository、Restricted Commercialおよび誤Bindingを検証する |
| Template／Checker | 使用時の標準入口を配布し、未使用時の空Directoryを要求しない |
| Repository Manifest／CROS | Context Responsibilityの複数宣言、重複所有の競合検出および領域単位のRepository解決を追加する |
| Shared Server接続境界 | RequestごとにBearer TokenをConnection Credentialへ照合し、`workspace_ids[]`、`system_admin`、失効およびRepository Policyを検証する。生TokenをRepository、`.crdd`またはlogへ保存しない |
| Agent Operating Context／Handoff | Taskごとの適用規則、Context、Capability、Decision境界、判断要求および再開契約をRevision付きで投影する |
| CROS Workbench | Project／Portfolio、Source Coverage、Topic／Meeting／判断待ちおよび正本導線を既存公開契約から表示し、少なくとも一つの定型操作を既存Command／Candidate入口へ渡す最小実装を行う |

### 4.1. CROS Workbenchの工程Gate

WorkbenchはUI要求または既存Architectureだけから実装へ着手しない。強化された工程別図面処置契約を使い、次の順で各工程の入口、基本図の処置、出口条件および次工程への義務を固定する。

```text
Discovery
「誰の何を解決し、何を目指さないか」
    ↓
UX
「立場ごとに何を理解・判断・回復できるか」
    ↓
IA
「どの情報、関係、Identity、導線を見せるか」
    ├───────────────────────┐
    ▼                       ▼
UI                         SPEC
「画面・領域・状態・操作」   「入力・振る舞い・結果・失敗・Effect」
    │                       │
    └───────────┬───────────┘
                ▼
        UI／SPEC対応レビュー
        「表示・操作とSystem契約の全数対応」
                ↓
Architecture
「どのOwner、Port、Store、Transport、Authorityで成立させるか」
    ↓
Implementation
「固定済み契約をどう実装するか」
    ↓
Verification
「利用者成果から外部境界まで何を反証したか」
```

UIとSPECは直列化せず、共有する対応契約を介して並行に具体化し、Architectureへ進む前に対応レビューで合流する。後工程で上位の意図、情報責務、表示結果または操作意味の不足を検出した場合は、その場のAdapter、UI専用Storeまたは例外で補わず、所有する工程へ戻して以降の対応を再確認する。各工程の図を作成した事実だけで通過せず、現行図、参照、理由付き非該当または作成不能が処置され、次工程の義務と未解決事項が追跡できることを出口条件とする。

## 5. 目指さないこと

- JIRA、Notion、会計SystemまたはGit Clientの再実装。
- Workbench専用のProject正本、状態Storeまたは独自更新ロジック。
- CROS独自のUser Directory、Role管理、共通Password照合、汎用認証Provider、MFA、SSO、Refresh TokenまたはPassword Recovery。Token HashとWorkspace集合を持つ最小Credential Registryはこの対象外に含めない。
- WBS、Risk、Issue、Forecastまたは進捗率を単一のCanonical Entityへ統合すること。
- Commercialの見積、契約、原価、売上、粗利、請求、税または通貨の完全Schema。
- Service名だけによるMeeting、TopicまたはCommunicationの自動分類。
- Project Relationだけから別Repositoryへの読取り・書込みAuthorityを生成すること。
- 使用しないRepositoryへの`20_Project`、`21_Commercial`、`22_Topics`または`23_Meetings`の作成。

## 6. 完成条件

- [ ] Project ID、Repository ID、Repository Binding IDの意味と移行が一意である。
- [ ] Project、Commercial、Topic、Meeting、Communicationの所有情報と非所有情報が一意である。
- [ ] TopicとMeetingの正常、準正常、異常、昇格、終了および再開条件を追跡できる。
- [ ] Projectionが正本を複製せず、欠測、Restricted、ConflictingおよびStaleを正常値へ畳まない。
- [ ] Projection上の操作が所有正本への候補または専用Commandへ解決され、Projectionを直接更新しない。
- [ ] 同一Repository、同一Projectの複数Repository、およびCommercial／Communication分離Repositoryを扱える。
- [ ] Commercial、Topics、Meetings、Communicationその他の責務領域を任意のRepository境界で同居または分離できる。
- [ ] RepositoryのContext ResponsibilityとTool／Runtime Capabilityを混同せず、同一責務の競合Ownerを自動選択しない。
- [ ] RelationからAuthority、Credential、Recoveryまたは外部送信許可を生成しない。
- [ ] `system_admin: true`のCredentialだけがCredentialごとのWorkspace集合を設定でき、管理可否からContent Accessを生成しない。
- [ ] Credential発行、Workspace集合設定、RequestごとのToken照合および失効を別の操作として扱える。
- [ ] Repository分離による情報境界と、表示上のロック／再確認を区別する。
- [ ] Repositoryごとの`available`、`credential_required`、`restricted`、`unavailable`および`unknown`を内容漏えいなしに投影できる。
- [ ] 縮約Projectionの公開が、元Repositoryへのアクセス不能を迂回する自動複製にならない。
- [ ] Chat AgentとCoding Agentが同じCRDD正本から解決したAgent Operating Contextを参照し、構造化Handoffで判断待ちと再開を追跡できる。
- [ ] MCP接続、Agent RoleまたはHandoff受領から未保有Authorityを生成しない。
- [ ] CROS Coreへ独立した情報分類制度、汎用Policy EngineまたはGlobal Operation Permission Registryを追加せず、既存Constraintは利用範囲を狭める方向にだけ適用する。
- [ ] Content Access、Capability固有のOperation Authorityおよび`system_admin`を分離する。
- [ ] 最小Workbenchが実際のCROS／Project Operation公開契約からProject ViewとSource Coverageを表示し、既存Command／Candidate入口への定型操作を縦断できる。
- [ ] Workbenchが第二正本、独自状態Store、直接Filesystem更新または独自Authority判定を持たない。
- [ ] WorkbenchがDiscovery、UX、IA、並行するUI／SPEC、UI／SPEC対応レビュー、Architecture、ImplementationおよびVerificationを正規経路で通り、各工程の基本図処置、出口条件、未解決事項および次工程への義務を追跡できる。
- [ ] 現在宣言した利用形態ごとに、Meaning Contract、実装、利用側移行、契約試験、実境界検証、E2EおよびEvidenceが接続する。
- [ ] 既知の次版全面置換を成立条件とする暫定Owner、Identity、Authorityまたは公開Contractを残さない。
- [ ] ひな型、Checkerおよび試験が任意領域の使用／非使用を区別する。
- [ ] 独立レビュー、Repository全体Checker、回帰および必要な実境界試験が成立する。

## 7. 正本と利用側

| 種別 | 参照 |
|---|---|
| Discovery | [Runtime／CROS Product Candidates](../../../01_Discovery/02_Runtime_and_CROS_Product_Candidates.md#2-project-operationproject-management-projection) |
| IA | [CRDD内部Toolの情報構造](../../../03_IA/01_Information_Architecture.md) |
| Architecture | [Project Operation Contextのアーキテクチャ](../../../06_Architecture/project-operation/01_Architecture.md) |
| CROS利用境界 | [CROS Federationと利用境界](../../../06_Architecture/cros/01_Architecture.md) |
| Runtime Data基準 | [Runtime Dataの目標Architecture](../../../06_Architecture/runtime-data/02_Target_Architecture.md) |
| Communication | [CRDD外部コミュニケーション](../../../17_Communication.md) |
| Roadmap | [v0.21未完了作業](../../01_Roadmap.md#11-v0210--project運営信頼複数repository) |

## 8. 次のGate

Identity、責務、Lifecycle、Relation、ProjectionおよびRepository構造を設計正本へ固定し、既存Project Runtime／Runtime Data／Communicationとの契約差を全数照合する。その後にSPEC、ひな型、Checkerおよび実装へ進む。
