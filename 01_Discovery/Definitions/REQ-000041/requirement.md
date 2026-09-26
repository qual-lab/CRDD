# REQ-000041 Role別共有CredentialによるRemote CROS利用

成果物種別: Discovery定義
要求ID: `REQ-000041`
Discoveryでの判断: 要求採用
判断する人: Qual-Lab
探索元: [EXP-000036](../../Analysis/EXP-000036/exploration.md)

## 要求

CROSはUser AccountまたはPrincipalを管理せず、RoleとRoleに紐づく共有CredentialだけでRemote利用範囲を分離できなければならない。

RoleとCredentialは共有CROSへのRemote接続に限定し、利用者がアクセス可能なRepositoryを単体で利用するときにCROS Credential、CROS RoleまたはCROS Server登録を要求してはならない。

v0.22の標準Roleは`Administrator`、`Management`および`Developer`とする。`Administrator`はCROS Systemを管理し、Project内容へのアクセスを自動的に得てはならない。`Management`はManagementとDevelopmentのRepository Context、`Developer`はDevelopmentのRepository Contextへアクセスできなければならない。

AdministratorはRoleに紐づくCredentialを発行し、利用者へ安全な別経路でBearer Secretを渡せなければならない。CROS内にユーザー登録、接続申請または個人別承認Workflowを要求してはならない。

すべてのAdministrator Credentialを失った場合または認可状態全体を信頼できない場合、Server Host上の管理Authorityを持つ人間は、Remote認証へ依存しない対話CLIからCredentialとRole設定を安全な状態へ戻し、一度限りのBootstrap Administrator Credentialを再発行できなければならない。この復旧はRepository内容その他のProduct Dataを削除してはならない。

## 対象と利用状況

共有CROS ServerへWorkbench、ChatGPT、Codexその他のMCP Consumerから接続し、Developer、ManagementまたはAdministratorとして利用する場面を対象とする。利用者はEndpointとCredentialを一度設定し、失効またはローテーションまで同じRoleで再接続できる。RepositoryをCloneまたはCheckoutしてローカルToolだけで利用する場面は、本要求の認証対象ではない。

## 解く問題と望ましい変化

```text
Remote接続には利用範囲の分離が必要
        ↓
個人別User管理を作ると導入・管理が重い
        ↓
Role別共有Credentialを発行・配布する
        ↓
Userを管理せず三つの利用範囲を分離できる
```

## 採用理由と比較

User Account、接続PrincipalおよびCredentialごとの任意Workspace Grantは、個人単位の失効または将来の組合せには有利だが、現在必要な三つの利用範囲に対して管理対象と画面を増やす。Role別共有Credentialは個人監査を行えない短所を持つが、User管理をせずRemote CROSを運用する現在目的に合うため採用する。

## 成立条件

- Credentialは一つのRoleに紐づき、Server側登録からRoleを解決する。
- 同じRoleに複数Credentialを発行でき、ローテーション中に新旧を一時併存できる。
- Credential Secretは十分に長い暗号学的乱数とし、発行時に一度だけ表示する。
- ServerはSecretのDigestだけを保存し、生Secretまたは受信可能な同等値を保存しない。
- 利用側はOS Credential Storeまたは接続先の秘密値管理へ保存し、Repository、`.crdd`、通常設定、Promptまたは会話履歴へ保存しない。
- `Administrator`だけがRoleとCredentialを管理できる。
- `Administrator` RoleだけからManagementまたはDevelopment内容へのアクセスを推定しない。
- `Management`はManagementとDevelopment、`Developer`はDevelopmentのRepository Contextだけへアクセスできる。
- Credentialの失効、有効期限切れ、Role不一致およびRepository非開示を成功へ畳まない。
- User、Principal、氏名、メール、部署、個人別申請またはCredentialと人間の対応をCROSの必須管理対象にしない。
- Repository単体利用ではCROS CredentialまたはRole設定がなくても、既存のFilesystem／Git Accessの範囲で利用できる。
- CROS RoleをRepository内の細粒度ACLとして扱わず、情報境界が必要な内容はRepository分離と既存Accessで保護する。
- Administrator Recoveryでは既存Administrator Credentialを失効し、Role定義、通常CredentialおよびRepository登録を維持してBootstrap Administrator Credentialを再発行できる。
- Full Access Resetでは全Credentialを失効し、標準三Roleを安全な既定値へ戻してBootstrap Administrator Credentialを再発行できる。
- Access RecoveryはServer Host上の対話CLIに限定し、Remote MCP、通常Workbenchまたは既存Credentialだけから実行できない。
- Recovery前に失効対象、Role処置および保持するProduct Dataを表示し、人間の明示確認を得る。
- RecoveryのIdentity、対象範囲、結果および再入場方法を秘密値なしで耐久記録へ残し、途中失敗を成功へ畳まない。

## 失敗・リスク・制約

- 共有Credentialでは個人別の利用者識別、失効および監査ができない。
- Credential漏洩または共有者変更時は新Credentialを配布し、旧Credentialを失効する必要がある。
- Full Access Reset後は、すべての利用側へ新Credentialを再配布する必要がある。
- TLS等の安全な通信方式なしにBearer Secretを送信しない。
- HashまたはDigestそのものを送信Credentialとして使用しない。
- Bearer文字列の自己申告Roleだけで認可しない。
- Credentialを持つことからRepositoryのFilesystem権限または内容の存在を推定しない。
- RepositoryをCloneできる利用者から、同一Repository内のファイルをCROS Roleだけで隠せると主張しない。

## 対象外

- User Account、個人Profile、Password、部署、役職および本人確認。
- 接続申請、Administratorによる個人承認およびSelf-service登録。
- 個人単位の監査、外部IdP、SSOおよびMulti-tenant IAM。
- MCPまたはChat Agentへ新Credential Secretを返すこと。
- Access RecoveryによるRepository、Project Context、CHG、Evidenceその他のProduct Data削除。
- Repository単体利用へのCROS Credential、Role選択またはCROS Server登録の強制。

## 未確認事項と戻り条件

- Role定義とRepository Roleの具体Schema、管理画面およびCLIは後工程で決める。
- 個人単位の失効・追跡が必要になる、Roleの組合せが増えて固定三分類では運用不能になる、または共有Secretの配布負担が許容できない場合はDiscoveryへ戻す。

## 検証意図

三RoleのCredentialを発行・配布・保存してRemote接続し、Roleごとに許可されたSystem管理とRepository Contextだけへ到達できることを確認する。Secret非保存、誤Role、失効、有効期限切れ、漏洩後ローテーション、新旧Credential併存、非開示RepositoryおよびAdministratorの内容非保有を含める。UserまたはPrincipalの登録なしに利用開始でき、通常再接続でRoleを再選択しないことも確認する。さらに、Administrator Credential全喪失と認可状態破損からServerローカルCLIで回復し、対象Credentialだけが失効し、Product Dataが維持され、新しいBootstrap Credentialで通常管理へ再入場できることを確認する。CROS設定が存在しないRepository単体環境でも、ローカル利用が阻害されないことを確認する。

## UXへの引き渡し

| 引渡し先 | 失ってはならない意味 | 下流で決めること |
|---|---|---|
| UX | Repository単体利用ではCredentialなしで作業でき、共有CROS利用時だけAdministratorがRole別Credentialを用意し、利用者は一度登録した後に同じRoleで再接続できること。User登録や接続申請を要求しないこと。管理不能時はServer Hostから通常管理へ戻れること | 単体利用とRemote利用の切替、初回設定、秘密値の一度表示、失効・期限切れ・再配布時の理解、Administrator RecoveryとFull Access Resetの確認・回復 |

## 関係

- 元の探索記録: [EXP-000036](../../Analysis/EXP-000036/exploration.md)
- 変更対象となる既存要求: [REQ-000011](../REQ-000011/requirement.md)。接続認証、実アクセス、部分可視および非開示を維持し、CredentialごとのWorkspace GrantをRole別共有Credentialへ置き換える。
- 関連要求: [REQ-000010](../REQ-000010/requirement.md)、[REQ-000017](../REQ-000017/requirement.md)、[REQ-000020](../REQ-000020/requirement.md)
- 下流工程への正式入力: UXは本要求を現在のRemote認可方式として分析する。REQ-000011と競合する場合は本要求を優先し、不足があればDiscoveryへ差し戻す。

## Checklist

- [x] 要求だけを読んでも、必要な変化を理解できる。
- [x] 探索元と採用判断を一意に辿れる。
- [x] 対象、利用状況、問題および望ましい変化を説明した。
- [x] 特定の画面、実装または技術方式へ不要に固定していない。
- [x] 要求として採用した理由と主要な代替を示した。
- [x] 正常時の成立条件を判定可能な形で示した。
- [x] 不完全・異常・境界時にも守る条件を示した。
- [x] 成立主張を破る反証条件を示した。
- [x] 失敗、リスクおよび制約を評価した。
- [x] 対象外を明示した。
- [x] 未確認事項と人間確認の必要性を評価した。
- [x] 情報不足をAIの推測だけで補っていない。
- [x] 検証意図を、具体的な試験項目を先取りせず説明した。
- [x] UXが探索記録を直接読まず、この定義だけから分析を開始できる。
- [x] 下流工程の結論をDiscoveryへ逆輸入していない。
- N/A: 補足分析を使用していないため — 補足分析へ必須情報を退避していない。
