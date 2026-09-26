# ユーザー管理なしでRemote CROSの利用範囲を分ける

成果物種別: Discovery分析
探索ID: `EXP-000036`
状態: 要求採用
主な情報源・根拠: Remote CROSの利用境界、Credential発行と管理画面に関する人間理解の確認
判断する人: Qual-Lab
記録の性質: v0.22再Discoveryで簡素化したRemote接続モデル
下流の主要CHG: [CHG-000081](../../../99_Roadmap/Changes/CHG-000081/change.md)

> CROSへ人間のアカウント管理を持ち込まない。Roleに紐づく共有Credentialを、安全に配布・保存・失効できる最小構造にする。

## 事前入力の理解確認

AIは当初、Credentialごとに接続主体を作り、接続申請をAdministratorが承認する方式を提案した。人間は、それでは実質的なユーザー登録となり、v0.22には重すぎると指摘した。

対話を通して、現在の意図を次のように確認した。

```text
AdministratorがRoleに紐づくCredentialを発行
        ↓
適切な利用者へBearer Secretを渡す
        ↓
利用者がWorkbench／MCPへ一度登録
        ↓
次回から保存済みCredentialで自動接続
```

管理するのはRoleとCredentialだけであり、User、Principal、接続申請、利用者承認、氏名、メールアドレスおよび人間との対応付けは管理しない。

## 本当の問題

Remote CROSでは、接続できることだけではManagement情報やSystem管理機能を誰へ開示してよいか決まらない。一方、これを解くためにUser Account、個人別Credential、部署、役職または承認Workflowを作ると、CROSがIAM製品になり、導入と管理が重くなる。

必要なのは本人確認ではなく、v0.22で必要な三つの利用範囲を、小さな運用で分離することである。

## Repository単体利用との境界

RoleとCredentialは、共有CROSへRemote接続するときだけ必要とする。利用者がアクセス可能なRepositoryをCloneまたはCheckoutし、そのRepository内でCodex、Claude Code、CLIその他のローカルToolを使う場合、CROS Credential、CROS RoleまたはCROS Serverへの登録を要求しない。

```text
Repository単体利用
  └ Filesystem／Gitの既存Accessで利用
     CROS Credentialなし

Shared／Remote CROS利用
  └ CROS CredentialからRoleを解決
     許可されたRepository Contextだけを投影
```

Repository内のファイルは、Repositoryへアクセスできる時点で閲覧可能である。CROS RoleをRepository内ファイルの暗号化、細粒度ACLまたは閲覧防止へ読み替えない。ManagementとDevelopmentの情報境界が必要な場合はRepositoryを分離し、CROSはRemote Federation時にその既存境界を越えない。

| Role | 主な利用範囲 |
|---|---|
| `Administrator` | Role、Credential、Repository登録その他のCROS System管理。Project内容は自動的に付与しない |
| `Management` | ManagementとDevelopmentのProject Context。見積、体制、契約等を含むManagement Repositoryを参照できる |
| `Developer` | DevelopmentのProject Context。日常的な開発利用の既定Role |

## 採用したCredential方式

Roleごとに一つ以上の共有Credentialを発行できる。Credentialは一つのRoleにだけ紐づき、RoleはServer側で解決する。Bearer文字列へRoleを自己申告させない。

```text
Credential
├ Credential ID
├ Role ID
├ Secret Digest
├ Active / Revoked
├ 発行日時
└ 任意の有効期限
```

利用者へ渡すのはCredential IDと十分に長いランダムなBearer Secretである。Serverは生のSecretを保存せず、受信Secretから計算したDigestを保存済みDigestと定数時間で比較する。Hash値そのものをBearerとして渡さない。

Credentialは発行時に一度だけ表示し、WorkbenchはOS Credential Store、MCP Consumerは接続先が提供する秘密値管理へ保存する。Repository、`.crdd`、Project Context、通常設定、Promptまたは会話履歴へ保存・表示しない。

Role変更や漏洩時は、新Credentialを発行し、利用側の切替後に旧Credentialを失効する。同じRoleへ新旧Credentialを一時的に発行できるため、停止せずローテーションできる。

## Access Recovery

通常の失効・再発行だけでは、すべてのAdministrator Credentialを失った場合、Role設定を誤って管理不能にした場合、またはCredential全体の漏洩が疑われる場合に復旧できない。そのため、Remote認証へ依存しないServerローカル限定のAccess Recoveryを持つ。

| 復旧段階 | 使用場面 | 処置 | 維持するもの |
|---|---|---|---|
| Administrator Recovery | 有効なAdministrator Credentialを失った | 既存Administrator Credentialを失効し、一度限りのBootstrap Administrator Credentialを再発行する | Role定義、通常Credential、Repository登録、Project Context |
| Full Access Reset | Role設定破損、広範な漏洩または認可状態を信頼できない | 全Credentialを失効し、標準三Roleを安全な既定値へ戻し、一度限りのBootstrap Administrator Credentialを再発行する | Repository内容、Project Context、CHG、Evidenceその他のProduct Data |

Access RecoveryはServer Host上の対話CLIからだけ開始し、Remote MCP、通常Workbenchまたは既存Credentialから実行しない。実行前に対象、失効するCredential数、戻すRole設定および保持するRepository Dataを表示し、OS上の管理Authorityを持つ人間の明示確認を必要とする。

復旧処理はServerの認可状態を排他的に更新し、途中失敗を成功へ畳まない。復旧Identity、開始理由、対象範囲、完了状態および再入場方法を秘密値なしで耐久記録へ残す。新しいBootstrap Secretは対話端末へ一度だけ表示し、通常Administrator Credentialを再発行した後に失効する。

## 管理入口

管理能力のOwnerはCROSであり、CLIとWorkbenchは同じ管理能力を利用する。CLIは初期化、Bootstrapおよび回復、Workbenchは通常のRole／Credential管理を担う。通常MCPへ管理Toolを混在させず、秘密値をChat Agentへ返さない。

```text
cros server init
        ↓
Bootstrap Administrator Credentialを一度だけ発行
        ↓
通常のRoleとCredentialを準備
        ↓
Bootstrap Credentialを失効
```

管理不能時は次の経路で戻す。

```text
Server Hostの管理者
        ↓ local interactive CLI
Access Recoveryの範囲を選択
        ↓ 明示確認
対象Credentialを失効／Roleを必要な範囲で復元
        ↓
Bootstrap Administrator Credentialを一度だけ再発行
        ↓
通常Credentialを再構築してBootstrapを失効
```

通常利用者にはAdministratorからEndpointとRoleに対応するCredentialを別経路で渡す。CROS内に申請・承認・ユーザー登録Workflowは作らない。

## 比較した代替

| 方式 | 利点 | 採用しない理由 |
|---|---|---|
| User Accountと個人別Credential | 個人単位の失効・監査ができる | CROSがUser管理と本人確認を所有し、v0.22の管理負担が大きい |
| 接続ごとのPrincipal | Client単位に分離できる | Userではない別IdentityとGrant管理が増え、現在の三分類には過剰 |
| CredentialへWorkspace Grantを個別設定 | 将来の組合せに柔軟 | Credentialごとの設定と管理画面が複雑になり、Role別共有運用の意図に合わない |
| Role別共有Credential | Userを持たず、三つの利用範囲を小さく分離できる | 個人監査ができず、漏洩時は共有者へ再配布が必要 |

Role別共有Credentialの短所は受容する。利用者単位の追跡、個別失効、外部IdP連携が必要になった場合は、v0.22のCredentialをUser Accountへ暗黙変換せず別Discoveryを行う。

## 既存要求への影響

[REQ-000011](../../Definitions/REQ-000011/requirement.md)が採用した`Credential → Workspace Grant → Repository Exposure`のうち、Credentialへ利用範囲を個別設定する部分は現在判断と一致しない。接続認証、Repositoryの実アクセス、部分可視および非開示は維持し、利用範囲の選択は`Credential → Role → Repository Role`へ置き換える。

この変更を[REQ-000041](../../Definitions/REQ-000041/requirement.md)として採用する。既存要求を黙って書き換えず、下流工程ではREQ-000041を現在の認可方式として優先する。

## 現在地と次への引き渡し

Remote接続で誰を管理するか、Credentialをどう発行・保持・照合・失効・回復するか、および三Roleの利用範囲は確認できた。次は、RepositoryがどのRole向けかを宣言する方法、同一Project Federationでの非開示、およびRole別Credentialを使うRemote MCPの失敗・再取得体験をUX以降で具体化する。

User登録、接続申請、個人追跡またはCredentialごとの任意Grantが必要になった場合は、本探索へ機能を足さず別Discoveryへ戻す。

## Checklist

- [x] 情報源と、情報源から確認できる範囲を示した。
- [x] 事前入力からAIが意味を再構成した場合、AIの事前理解、人間の修正および確認後の現在理解を区別した。
- [x] 現在案を変え得る有力な代替または反証を人間と突き合わせるか、該当する案がない理由を示した。
- [x] 人間理解の確認と、要求・方針の採用判断を分けた。
- [x] 人間が抽象的な問題や要求を言語化できることを前提にせず、具体的な出来事、行動、迷い、回避策または比較から問題仮説を引き出した。
- N/A: 発言の少なさ、回答不能または沈黙は観測されず、管理負担と必要な三利用範囲を明示確認できたため — 発言の少なさ、回答不能または沈黙を、同意、問題不存在または要求採用へ読み替えていない。
- [x] 確認できた事実と、そこから導いた解釈・仮説を区別した。
- [x] 解決策ではなく、本質的な問題を説明した。
- [x] 技術名称を除いても、誰が何に困っているか理解できる。
- [x] 影響を受ける人または判断する人を特定した。
- [x] どのような変化を期待するか説明した。
- [x] 原因と解決に関する仮説を、事実として扱っていない。
- [x] 未確認事項と不確実性を明示した。
- [x] 人間による確認または判断が必要かを評価した。
- [x] 情報不足をAIの推測だけで補っていない。
- [x] 失敗、リスク、制約および対象外を評価した。
- [x] 採用、不採用、保留を区別した。
- [x] 次工程が保持すべき問題、変化および条件を示した。
- [x] 情報不足時にDiscoveryへ戻す条件を示した。
- [x] 因果、比較または時系列を図示する必要性を判定し、作成または理由付きN/Aとして処置した。
- N/A: 補足分析を使用していないため — 補足分析へ必須情報を退避していない。
