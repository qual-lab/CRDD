# REQ-000041 最小ユーザー識別とRole権限によるRemote CROS利用

成果物種別: Discovery定義
要求ID: `REQ-000041`
Discoveryでの判断: 要求採用
判断する人: Qual-Lab
探索元: [EXP-000036](../../Analysis/EXP-000036/exploration.md)

## 要求

CROSは、ユーザーの識別情報（User Identity）、Roleとその詳細権限、ユーザーへ紐づくCredentialを分離し、Remote利用範囲を軽量に管理できなければならない。ユーザーは安定した`userId`（UUID）、管理者が設定する表示名（`username`）、Roleを持つ。Credentialはユーザーへ紐づき、権限を独自に追加しない。

RoleとCredentialは共有CROSへのRemote接続に限定し、利用者がアクセス可能なRepositoryを単体で利用するときにCROS Credential、CROS RoleまたはCROS Server登録を要求してはならない。

v0.22の標準Role識別子は`administrator`、`manager`および`developer`とする。Roleに対してRepository／Workspaceの利用範囲と管理操作の詳細権限を設定する。安全な初期範囲は、`administrator`がSystem管理、`manager`がManagementとDevelopment、`developer`がDevelopmentである。管理権限だけからProject内容へのアクセスを自動的に付与してはならない。

管理者はユーザーIDを作成し、表示名とRoleを設定・変更し、そのユーザーのCredentialを発行・リセットできなければならない。Bearer Secretは利用者へ安全な別経路で渡す。表示名は管理対象を識別し、Workbenchに現在の認証ユーザーを表示するためだけに使い、ログイン名、本人確認、権限またはRepository開示の根拠にしない。利用者の自己登録、自己編集、接続申請または個人別承認Workflowは追加しない。

`administrator` Roleを持つユーザーに紐づく有効なCredentialをすべて失った場合または認可状態全体を信頼できない場合、Server Host上の管理Authorityを持つ人間は、Remote認証へ依存しない対話CLIからCredentialとRole設定を安全な状態へ戻し、一度限りのBootstrap Credentialを再発行できなければならない。Bootstrapは通常ユーザーのCredentialと同一視せず、管理へ再入場するための限定的な回復Authorityとする。ユーザーIDとの結合は後工程で確定する。この復旧はRepository内容その他のProduct Dataを削除してはならない。

## 対象と利用状況

共有CROSへWorkbenchその他のMCP Consumerから接続する場面を対象とする。管理者は誰へ発行したCredentialかを表示名で確認でき、利用者はEndpointとCredentialを一度設定した後、失効またはリセットまで再接続できる。RepositoryをCloneまたはCheckoutしてローカルToolだけで利用する場面は、本要求の認証対象ではない。

## 解く問題と望ましい変化

```text
Remote接続には利用範囲の分離が必要
        ↓
共有Credentialだけでは誰向けに発行したか分からない
        ↓
安定ユーザーIDと管理者用表示名を最小限に持つ
        ↓
ユーザーのRoleから詳細権限を解決し、Credentialを交換できる
```

## 採用理由と比較

以前はUser管理の負担を避けるためRole別共有Credentialを採用した。今回、人間が「誰向けのIDか分かる表示名」とユーザーIDを維持したCredentialリセットを必要とし、最小ユーザー管理へ判断を変更した。共有Credentialだけではこの意図を満たせない。一方、メール・Password・本人確認・申請を持つ一般的なアカウント管理は不要である。Credentialごとの任意Grantは管理の重複を生むため採用せず、詳細権限はRoleが所有する。経緯はEXP-000036へ保持する。

## 成立条件

- 認証・認可は`Credential → userId → Role → 現在のRole詳細権限 → Exposure`の順に解決する。
- ユーザーIDはUUIDとして安定させ、表示名変更またはCredentialリセットで変更しない。最小モデルはユーザーに一つのRoleを割り当て、複数RoleやRole継承を先取りしない。
- 表示名は管理者が登録・変更する非秘密の表示値であり、表示名の一致・変更から同一ユーザーや権限変更を推定しない。
- Workbenchは認証済みの自身の現在ユーザー名を表示する。非認証の入口へユーザー情報を開示せず、管理権限のない入口へ他ユーザーの一覧・存在・件数を開示しない。
- CredentialリセットはユーザーIDとRoleを保持し、旧Credentialを失効して新Secretを一度だけ発行する。以後の要求で旧Credentialを拒否する。開始済み操作の取消完了は、この失効だけから推定しない。
- Role権限の変更は次の認可から現行設定を使用し、Credentialへ古い権限を固定しない。Credential単位またはユーザー単位の追加権限は持たせない。
- Credential Secretは十分に長い暗号学的乱数とし、発行時に一度だけ表示する。
- ServerはSecretのDigestだけを保存し、生Secretまたは受信可能な同等値を保存しない。
- 利用側はOS Credential Storeまたは接続先の秘密値管理へ保存し、Repository、`.crdd`、通常設定、Promptまたは会話履歴へ保存しない。
- 管理を許可された`administrator`だけがユーザー、Role詳細権限およびCredentialを管理できる。
- `administrator`の管理能力からManagementまたはDevelopment内容へのアクセスを推定しない。
- Repository要求はRole詳細権限、Exposureおよび既存の実アクセスを共同で確認し、許可されない内容を読取り・開示しない。
- Credentialの失効、有効期限切れ、Role不一致およびRepository非開示を成功へ畳まない。
- 表示名から自然人の本人確認や個人行動監査の成立を主張しない。氏名、メール、部署および個人別申請を必須管理対象にしない。
- Repository単体利用ではCROS CredentialまたはRole設定がなくても、既存のFilesystem／Git Accessの範囲で利用できる。
- CROS RoleをRepository内の細粒度ACLとして扱わず、情報境界が必要な内容はRepository分離と既存Accessで保護する。
- Administrator Recoveryでは`administrator` Roleを持つユーザーに紐づく既存Credentialを失効し、Role定義、通常CredentialおよびRepository登録を維持してBootstrap Credentialを再発行できる。緊急時の最小ユーザー情報の具体的処置は後工程で確定する。
- Full Access Resetでは全Credentialを失効し、標準三Roleを安全な既定値へ戻してBootstrap Credentialを再発行できる。通常ユーザーへのCredentialリセットと同一の処置として扱わない。
- Access RecoveryはServer Host上の対話CLIに限定し、Remote MCP、通常Workbenchまたは既存Credentialだけから実行できない。
- Recovery前に失効対象、Role処置および保持するProduct Dataを表示し、人間の明示確認を得る。
- RecoveryのIdentity、対象範囲、結果および再入場方法を秘密値なしで耐久記録へ残し、途中失敗を成功へ畳まない。

## 失敗・リスク・制約

- ユーザーIDと表示名は管理者が付けた接続主体の識別であり、実際に操作した自然人の証明ではない。
- Credential漏洩時はリセットし、新Credentialを別経路で配布する必要がある。
- Full Access Reset後は、すべての利用側へ新Credentialを再配布する必要がある。
- TLS等の安全な通信方式なしにBearer Secretを送信しない。
- HashまたはDigestそのものを送信Credentialとして使用しない。
- Bearer文字列の自己申告Roleだけで認可しない。
- Credentialを持つことからRepositoryのFilesystem権限または内容の存在を推定しない。
- RepositoryをCloneできる利用者から、同一Repository内のファイルをCROS Roleだけで隠せると主張しない。

## 対象外

- 最小のユーザーID・表示名・Role・Credential紐付けを超えるUser Account、個人Profile、Password、メール、部署、役職および本人確認。
- 接続申請、Administratorによる個人承認およびSelf-service登録。
- 個人行動監査製品、外部IdP、SSOおよびMulti-tenant IAM。管理変更やRecoveryの必要な非秘密安全記録は禁止しない。
- MCPまたはChat Agentへ新Credential Secretを返すこと。
- Access RecoveryによるRepository、Project Context、CHG、Evidenceその他のProduct Data削除。
- Repository単体利用へのCROS Credential、Role選択またはCROS Server登録の強制。

## 未確認事項と戻り条件

- UUIDの版、表示名の構文・正規化・一意性、保存Schema、Role詳細権限の語彙、管理画面とCLIは後工程で決める。
- 既存Credentialの移行または再発行、BootstrapとユーザーIDの結合、緊急Recovery時の最小ユーザー情報の処置は後工程で確定する。Package改名だけを理由に保存Rootを変更しない。
- 複数Role、個別追加権限、本人確認、自己登録または表示以外のユーザー情報が必要になった場合はDiscoveryへ戻す。

## 検証意図

管理者がユーザーID・表示名・Roleを登録し、Credentialを発行してRemote接続する。表示名変更でもID・認可が不変で、CredentialリセットでもID・Roleが不変かつ旧Secretが拒否されること、Role詳細権限変更が次の認可へ反映されることを確認する。Secret非保存、偽のユーザー相関、Credential別権限追加、誤Role、失効、期限切れ、非開示Repository、非管理者による管理操作および管理者への内容自動付与を反証する。Workbenchの現在ユーザー表示と管理対象の識別も確認する。通常リセットとHost限定緊急Recoveryを区別し、管理Credential全喪失と認可状態破損から復旧でき、Product Dataを保持することを確認する。Repository単体利用がCredentialなしで成立することも確認する。

## UXへの引き渡し

| 引渡し先 | 失ってはならない意味 | 下流で決めること |
|---|---|---|
| UX | Repository単体利用はCredential不要。Remote利用は管理者が最小ユーザー情報とCredentialを用意し、利用者は一度設定して再接続する。表示名は現在の認証者と管理対象を示すだけで、本人確認ではない。リセットでユーザーIDとRoleを保ち、旧Secretを拒否する。管理不能時はHostから回復できる | 単体／Remote切替、管理者の登録・表示名／Role変更、現在ユーザー表示、初回設定、Secret一度表示、リセット・権限変更の影響理解、通常リセットとHost Recoveryの区別 |

## 関係

- 元の探索記録: [EXP-000036](../../Analysis/EXP-000036/exploration.md)
- 変更対象となる既存要求: [REQ-000011](../REQ-000011/requirement.md)。接続認証、実アクセス、部分可視および非開示を維持し、CredentialごとのWorkspace GrantをユーザーのRole詳細権限へ置き換える。
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
