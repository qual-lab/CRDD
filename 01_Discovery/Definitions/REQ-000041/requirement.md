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

ユーザーと業務上のアクセス範囲はmanagerとadministratorが管理し、鍵と管理者資格はadministratorだけが管理する。管理操作の担当Roleは次の固定境界とし、Role詳細権限設定からdeveloperへ管理操作を付与したり、managerへ管理者専用操作を付与したりしない。

| 管理操作 | developer | manager | administrator |
|---|---|---|---|
| ユーザー登録・表示名変更 | 不許可 | 許可 | 許可 |
| developer／managerの割当て・変更 | 不許可 | 許可 | 許可 |
| administratorの付与・解除 | 不許可 | 不許可 | 許可 |
| developer／managerの詳細権限設定 | 不許可 | 許可 | 許可 |
| administratorの詳細権限設定 | 不許可 | 不許可 | 許可 |
| 鍵の発行・独立失効・交換 | 不許可 | 不許可 | 許可 |
| Repository登録・登録解除 | 不許可 | 許可 | 許可 |
| Repository公開範囲設定 | 不許可 | 許可 | 許可 |

managerは業務上のアクセスを決める信頼された管理担当者であり、自身を含むdeveloper／managerの内容範囲を明示的に変更できる。変更前の現在権限で操作を認可し、更新したRole詳細権限・公開範囲と既存の実アクセスを次要求から評価する。管理能力だけで内容を自動公開しない。managerは既存administratorのRole変更（降格を含む）も行えない。

Repository登録は接続対象の登録であり、登録だけで公開・内容アクセスを許可しない。登録解除は登録関係の解除であり、RepositoryやProduct Dataの削除ではない。公開範囲設定は開示範囲の明示変更として分離する。

許可された主体はユーザーIDを作成し、上表の範囲で表示名とRoleを設定・変更できなければならない。そのユーザーのCredential発行・交換は現行administrator専用とする。Bearer Secretは利用者へ安全な別経路で渡す。表示名は管理対象を識別し、Workbenchに現在の認証ユーザーを表示するためだけに使い、ログイン名、本人確認、権限またはRepository開示の根拠にしない。利用者の自己登録、自己編集、接続申請または個人別承認Workflowは追加しない。

鍵の発行・独立失効・交換は、現行administrator Role専用の固定操作とし、Role詳細権限のON／OFF設定に含めない。通常管理は同一ProcessのWorkbenchから実行する。鍵操作は秘密の返却有無にかかわらずMCPへ公開しない。

接続に使う鍵（Credential）の交換は、指定ユーザーの鍵交換と、全員の鍵を無効化して指定管理者の鍵を再発行する2操作とする。管理者が接続できない場合は、Server Hostへログイン済みのローカル操作者を信頼し、人間の明示確認により、Remote認証へ依存しない対話CLIから同じ交換操作を実行できなければならない。専用資格、追加認証、承認コードまたはOS管理者昇格を要求しない。既存のユーザー単位OS管理RootとPath検証を維持し、任意Rootや別OSユーザーの状態へ越境しない。入口の違いを別の鍵交換方式にしない。ユーザーID・表示名・Role・詳細権限・Repository登録・Product Dataは変更しない。

Hostからの回復でも、回復専用ユーザー、特別Role、追加権限または特別なBootstrap Credentialを作らない。全員分を処置する場合の新資格は、指定した既存のadministratorユーザーへ紐づける。対象が不明、既存管理者が存在しない、ユーザー・Role・権限設定が破損している、または現在状態を安全に確認できない場合は、新しい処置を発行せず停止する。鍵交換による認可設定の自動修復は保証しない。初回Server設定の方式はこの変更で廃止しない。

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

以前はUser管理の負担を避けるためRole別共有Credentialを採用した。今回、人間が「誰向けのIDか分かる表示名」とユーザーIDを維持したCredentialリセットを必要とし、最小ユーザー管理へ判断を変更した。共有Credentialだけではこの意図を満たせない。一方、メール・Password・本人確認・申請を持つ一般的なアカウント管理は不要である。Credentialごとの任意Grantは管理の重複を生むため採用せず、詳細権限はRoleが所有する。2026-10-10には、人間が鍵だけの処置を採用し、管理者全員を一律に失効する独立操作と、回復時のRole初期化を廃止した。対象1人と全員の2操作で必要範囲を選べ、Host入口でも処理を増やさないためである。経緯はEXP-000036へ保持する。

## 成立条件

- 認証・認可は`Credential → userId → Role → 現在のRole詳細権限 → Exposure`の順に解決する。
- ユーザーIDはUUIDとして安定させ、表示名変更またはCredentialリセットで変更しない。最小モデルはユーザーに一つのRoleを割り当て、複数RoleやRole継承を先取りしない。
- 表示名はmanagerまたはadministratorが登録・変更する非秘密の表示値であり、表示名の一致・変更から同一ユーザーや権限変更を推定しない。
- Workbenchは認証済みの自身の現在ユーザー名を表示する。非認証の入口へユーザー情報を開示せず、管理権限のない入口へ他ユーザーの一覧・存在・件数を開示しない。
- CredentialリセットはユーザーIDとRoleを保持し、旧Credentialを失効して新Secretを一度だけ発行する。以後の要求で旧Credentialを拒否する。開始済み操作の取消完了は、この失効だけから推定しない。
- Role権限の変更は次の認可から現行設定を使用し、Credentialへ古い権限を固定しない。Credential単位またはユーザー単位の追加権限は持たせない。
- Credential Secretは十分に長い暗号学的乱数とし、発行時に一度だけ表示する。
- ServerはSecretのDigestだけを保存し、生Secretまたは受信可能な同等値を保存しない。
- 利用側はOS Credential Storeまたは接続先の秘密値管理へ保存し、Repository、`.crdd`、通常設定、Promptまたは会話履歴へ保存しない。
- 管理操作は要求節の固定担当Roleで認可する。managerによるadministratorの付与・解除・詳細権限変更と鍵操作、developerによる管理操作を拒否する。Role設定からこの固定境界を迂回できない。
- `administrator`の管理能力からManagementまたはDevelopment内容へのアクセスを推定しない。
- Repository要求はRole詳細権限、Exposureおよび既存の実アクセスを共同で確認し、許可されない内容を読取り・開示しない。
- Credentialの失効、有効期限切れ、Role不一致およびRepository非開示を成功へ畳まない。
- 表示名から自然人の本人確認や個人行動監査の成立を主張しない。氏名、メール、部署および個人別申請を必須管理対象にしない。
- Repository単体利用ではCROS CredentialまたはRole設定がなくても、既存のFilesystem／Git Accessの範囲で利用できる。
- CROS RoleをRepository内の細粒度ACLとして扱わず、情報境界が必要な内容はRepository分離と既存Accessで保護する。
- 指定ユーザーの鍵交換では、userIdで指定した既存ユーザーの旧有効Credentialをすべて失効し、そのユーザーへ新Secretを一度だけ発行する。他ユーザーの資格は維持する。
- 全員の鍵交換では、全ユーザーの旧有効Credentialをすべて失効し、userIdで指定した既存administratorユーザーへ新Secretを一度だけ発行する。その管理者が他ユーザーの資格を通常管理から再発行する。
- 両操作はユーザーID・表示名・Role・詳細権限・Repository登録・Product Dataを保持し、権限を増やさない。Host回復時も同じ保持条件を使う。
- 通常の鍵操作は現行administratorを要求し、Role設定から他Roleへ付与・administratorから剥奪できない。Host回復はログイン済みローカル操作者の対話CLIと明示確認を使い、鍵交換2操作以外へ広げない。Remote MCPや通常WorkbenchからHost入口を代用しない。
- MCPのTool一覧・Schema・dispatchに鍵の発行・独立失効・交換を含めず、未許可呼出しでは鍵操作Effectを発行しない。Secretを返さない失効も対象外とする。
- 処置前に対象ユーザーID・表示名、失効する資格範囲、新資格の発行先および保持する情報を確認する。Host入口と全員の鍵交換では人間の明示確認を得る。
- RecoveryのIdentity、対象範囲、結果および再入場方法を秘密値なしで耐久記録へ残し、途中失敗を成功へ畳まない。
- 失効後の発行失敗・応答喪失では、既知の失効範囲と発行結果の不明を同じRecoveryへ保持する。未失効・rollback・開始済み取消完了を推定せず、Secretを再表示しない。

## 失敗・リスク・制約

- ユーザーIDと表示名は管理者が付けた接続主体の識別であり、実際に操作した自然人の証明ではない。
- Credential漏洩時はリセットし、新Credentialを別経路で配布する必要がある。
- 全員の鍵交換後は、他ユーザーの資格再発行とすべての利用側への再配布が必要で、その間は旧資格で接続できない。
- 鍵交換はユーザー・Role・権限設定の破損を修復しない。破損時は停止し、別の復旧判断へ戻す。
- TLS等の安全な通信方式なしにBearer Secretを送信しない。
- HashまたはDigestそのものを送信Credentialとして使用しない。
- Bearer文字列の自己申告Roleだけで認可しない。
- Credentialを持つことからRepositoryのFilesystem権限または内容の存在を推定しない。
- RepositoryをCloneできる利用者から、同一Repository内のファイルをCROS Roleだけで隠せると主張しない。

## 対象外

- 最小のユーザーID・表示名・Role・Credential紐付けを超えるUser Account、個人Profile、Password、メール、部署、役職および本人確認。
- 接続申請、Administratorによる個人承認およびSelf-service登録。
- 個人行動監査製品、外部IdP、SSOおよびMulti-tenant IAM。管理変更やRecoveryの必要な非秘密安全記録は禁止しない。
- MCPへの鍵発行・独立失効・交換の公開、およびMCPまたはChat Agentへ新Credential Secretを返すこと。
- Access RecoveryによるRepository、Project Context、CHG、Evidenceその他のProduct Data削除。
- Repository単体利用へのCROS Credential、Role選択またはCROS Server登録の強制。

## 未確認事項と戻り条件

- UUIDの版、表示名の構文・正規化・一意性、保存Schema、Role詳細権限の語彙、管理画面とCLIは後工程で決める。
- 既存Credentialの移行または再発行、初回Server設定と最初の管理者の結合は後工程で確定する。緊急回復の発行先は既存ユーザーIDとし、ユーザー情報・Role・権限を変更しないことは採用済みである。Package改名だけを理由に保存Rootを変更しない。
- 複数Role、個別追加権限、本人確認、自己登録または表示以外のユーザー情報が必要になった場合はDiscoveryへ戻す。

## 検証意図

managerまたはadministratorがユーザーID・表示名と許可されたRoleを登録し、administratorがCredentialを発行してRemote接続する。要求節の各操作についてmanager／administratorの許可範囲、developerの拒否、managerによる管理者資格・鍵境界の迂回拒否を確認する。manager自身の内容範囲変更は明示設定と現在認可を通り、登録だけでは公開されず、登録解除でもProduct Dataを削除しないことを確認する。表示名変更でもID・認可が不変で、鍵交換でもID・名前・Role・権限が不変かつ旧Secretが拒否されること、Role詳細権限変更が次の認可へ反映されることを確認する。指定ユーザーと全員の失効範囲、全員交換後の指定管理者への再入場、通常管理とHost入口のAuthority差を別々に確認する。既存管理者不存在・対象不明・認可設定破損では処置前停止する。Secret非保存、偽のユーザー相関、Credential別権限追加、誤Role、期限切れ、非開示Repository、administrator以外による鍵操作と、現在の管理権限を持たない主体による他の管理操作、開始済み取消の誤認および管理者への内容自動付与を反証する。失効後の発行失敗・応答喪失・Process喪失では既知処置と同じRecoveryを保持し、再観測なしに完了やrollbackへ畳まない。Repository単体利用がCredentialなしで成立することも確認する。

## UXへの引き渡し

2026-10-11の担当Role判断を要求節の表から継承する。managerはユーザー・業務アクセス・Repository登録と公開範囲を管理し、administratorは同じ操作に加えて管理者資格と鍵を管理する。登録と公開、登録解除とProduct Data削除を分け、管理者資格・鍵の固定制限を設定変更で迂回させない。画面・操作契約・権限語彙の具体化は下流で行い、旧担当Role判断を今回の判断として使わない。

| 引渡し先 | 失ってはならない意味 | 下流で決めること |
|---|---|---|
| UX | Repository単体利用はCredential不要。表示名は自身と管理対象の表示だけに使う。指定ユーザー交換は対象の旧有効資格すべてを失効して同じユーザーへ新資格を一度発行し、全員交換は全旧有効資格失効と指定既存administratorへの一度発行を行う。ユーザー情報・Role・権限・登録・Product Dataを保持する。通常の鍵操作はadministrator専用固定・設定項目外とし、同一Process Workbenchから実行する。MCPには鍵操作自体を公開しない。Hostはログイン済みローカル操作者の対話CLIから交換2操作だけを実行し、追加認証・専用資格・承認コード・OS管理者昇格を要求せず、既存Root／Path検証を維持する。全4組で対象と影響を事前表示し、Hostまたは全員交換の3組だけ明示確認する。対象不明・管理者不存在・認可設定破損では処置前停止。処置後失敗・応答喪失・Process喪失は既知処置と同じRecoveryを保持する | 対象1人／全員の影響理解、全員交換後の再配布負担、通常／Hostの入口とAuthority差、Secret一度表示、結果不明時の再観測・再入場、単体／Remote切替、管理者登録・表示名／Role変更と初回設定 |

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
