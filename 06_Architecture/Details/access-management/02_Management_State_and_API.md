# 管理APIと現在状態の保存設計

成果物種別: Architecture詳細設計
詳細設計領域: access-management
状態: Candidate（API・物理保存の比較案。実装着手条件は未成立）
維持責任者: Qual-Lab

## 1. 対象と保持条件

[責務・意味・処理境界](01_Architecture.md)を具体化する。担当Role、鍵操作の入口、交換の意味は変更しない。固定8管理分担は内容権限設定から生成しない。管理能力から内容閲覧を許可しない。通常管理のMCP Toolを新規採用せず、鍵操作はMCPの一覧・Schema・登録・dispatchの全てで非公開とし、応答へSecretを含めない。

今回比較するのは、公開読取り、操作別更新、同一改訂の保存単位、出版後故障、移行である。汎用IAM、Receipt Store、Lock Framework、共有Recovery、Docker操作は対象外。候補API名やFile名はSourceへ実装済みという意味ではない。

## 2. 操作別API候補

以下はAccess Management内部の関数契約候補であり、HTTP RouteやMCP Tool名ではない。公開はPackage Rootの`src/index.ts`だけを入口とし、再export専用の中間Fileを増やさない。

| 操作候補 | 入力・判定 | 結果・利用側 |
|---|---|---|
| `authenticateCredential` | Bearerと現在管理改訂。既存User・現在Role・資格状態を同じ改訂から解決 | 要求内の主体。Token・Verifierを返さない。Workbench／MCPの認証入口 |
| `readCurrentAccess` | 認証主体と現在改訂 | 自己表示名・Role・認可済み範囲。管理能力と内容範囲を分離 |
| `readManagementState` | 現在の管理認可と必要な対象 | 許可されたUser／Role／接続／公開の投影だけ。全内部Snapshotは返さない |
| `registerUser` | 予定Role・表示名・期待改訂。managerはdeveloper／managerだけ、administratorは三Role | 新User ID・改訂・読戻し。資格発行0、自己登録なし |
| `updateUserName` | 既存userId・新表示名・期待改訂。manager／administrator。administrator対象も許可 | 名前だけ変更。User ID・Role・資格を保持 |
| `changeUserRole` | 変更前・変更後Roleを含む対象と期待改訂 | developer／manager間はmanager／administrator。administratorへの変更・administratorの変更はadministratorのみ |
| `updateRoleContentAccess` | 対象Role・明示内容範囲・期待改訂 | administrator内容設定はadministratorのみ。他Roleはmanager／administrator。固定管理能力は変更しない |
| `registerRepository` | 対象ID・検証済みBinding・現在未登録・期待改訂。現在manager／administrator | 接続登録だけ。登録≠公開 |
| `unregisterRepository` | 既存Repository ID・現在登録状態・現在Exposure状態・期待改訂。現在manager／administrator | 登録解除だけ。Product Data削除0。登録時のBinding再検証を解除条件に転用しない。Exposure残存時の処置は下記OPEN |
| `updateExposure` | 既存登録ID・現在登録／公開状態・変更範囲・期待改訂。manager／administrator | 内容認可・実アクセスとは独立した現在公開設定 |
| `issueCredential` | 現在administrator・既存userId・期待改訂 | 同一Process Workbenchのみ。新資格と一度のSecret。旧資格失効0 |
| `revokeCredential` | 現在administrator・exact Credential IDと既存userIdの結合・期待改訂 | 同一Process Workbenchのみ。対象だけ失効、対象外失効0・新発行0・Secret0・交換Recovery0 |
| `exchangeCredentials` | 現在administrator・期待改訂。指定Userの全旧有効資格、または自身を含む全員の全旧有効資格 | 指定は同じ既存userId、全員は指定既存administratorへ一資格を発行。同じRecoveryを保持。通常指定は事前表示のみ、通常全員は表示＋明示確認 |
| `exchangeCredentialsFromHost` | ログイン済みHost対話入口・期待改訂。指定User／全員交換の2種、双方表示＋明示確認 | 指定は対象全旧有効資格→同じ既存userId、全員は全旧有効資格→指定既存administratorへ一資格。同じRecovery。追加認証・OS昇格・回復専用Userなし |
| `readKeyExchangeState` | 現在Authorityと同じexact Recovery参照 | 非秘密の段階・既知結果。参照自体をAuthorityにせず、MCPには公開しない |

更新は操作・対象・期待改訂を受け、結果には状態、最初の失敗段階、期待／採用改訂、既知Effect、読戻し、解放結果を相関させる。`completed`／`blocked`／`unknown`は結果候補値で、具体Schemaは未固定。出版後故障は`blocked`や`unknown`でも既知Effectを保持し、Effect 0やRollbackへ戻さない。詳細権限語彙、資格期限、Profile管理Roleは別途OPENとする。

交換4組とも対象ID・表示名・失効範囲・発行先・保持情報を事前表示し、通常全員・Host指定・Host全員の3組だけ明示確認する。User ID・表示名・Role・Role内容権限・Repository登録・Product Dataは保持する。

## 3. 内部状態と公開読取り

| 内部論理情報 | 同一管理改訂で保持する内容 |
|---|---|
| `users` | UUID、表示名、一つのRole |
| `roleContentAccess` | Role別の明示内容権限。固定管理分担を保存設定にしない |
| `credentials` | Credential ID、既存userId、Verifier・salt・状態。生Secretなし |
| `registeredRepositories` | 接続先Binding。Context本文・Portfolio結果はDomain Modelが所有 |
| `exposure` | 現在の公開範囲。登録一覧から暗黙生成しない |
| `unresolvedKeyExchanges` | exact Recovery、旧資格集合、既存発行先、段階と既知結果。非秘密 |

これらは内部候補キーであり、新たな正本Entityや汎用Registryではない。User・Role・資格の参照整合と交換結果を一つの採用改訂に結合する。遷移は期待改訂→次改訂で保存し、同じ改訂を異なる状態で上書きしない。

ExposureのRepository IDは既存登録を参照し、重複・孤立参照を拒否する。解除時にExposureが残る場合の具体処置はOPENである。暗黙Exposure削除、孤立Exposure確定、Product Data削除は認めず、処置が確定するまで該当解除の実装Gateは未成立・新Effect 0で停止とする。事前Exposure解除を必須とする新操作条件は自己採用しない。確認先は上流のRepository登録／Exposure Owner（Qual-Lab）、再評価契機は解除API・保存Schema固定前、影響は該当解除処理を実装できないこと。

公開readではVerifier・salt・Secret・内部Pathを除く。自己表示、権限内の他User参照、非認証拒否を別条件として検査する。破損・観測不能を空集合や「未登録」に畳まない。内容要求は現在Role・Exposure・実アクセスから解決し、Domain Modelへ許可済みRepository集合だけを渡す。

通常管理で応答が失われた場合、現在readの再取得を案内し、自動再更新は行わない。後続改訂があれば現在値だけで元要求の成功を証明できないため、「現在値取得」と「元要求完了」を区別し、相関不能は不明のまま保持する。通常管理用の新Receipt Storeは作らない。

## 4. 物理保存の比較と未決条件

[既存Host管理Root](../domain-model/03_Repository_Storage.md#6-crosとの物理分離)を維持する。Package改名で`qual-lab/cros/<trust-domain-id>`を改名せず、秘密をRepositoryへ移さない。

| 候補 | 長所 | 弱点・処置 |
|---|---|---|
| 現行の改訂File積算 | 次改訂名への排他的hard linkと読戻しが既存Adapterにある | 無期限積算、User／Role・交換との一体整合不足。そのまま継承しない |
| 単一現在File（`access-management.json`候補） | 現在値と清掃対象が明瞭。小規模管理情報を一体読取りできる | 置換だけでは競合制御にならない。排他Owner・置換保証・容量条件の確認が必要 |
| 分割File＋同一改訂manifest | 大きい本体を分離できる | 部分出版、複数清掃、旧本体回収が複雑。現要求では優先しない |

単一現在Fileを第一候補とするが、物理保存方式は未採用。既存の改訂File CASを単一Fileへそのまま流用できない。既存保存部品の対象Root・協調Writer条件・故障時の意味を確認し、現在認可／期待改訂照合→出版→読戻し→解放を覆う排他Ownerを確定してから実装する。新Lock Frameworkは作らない。

保存手順候補は、Root検証→選定・適合確認した排他原語を取得→現在改訂・変更前認可再照合→短命pendingへ検査済み次状態を書く→出版→読戻し→排他解放→結果返却とする。pendingは確定前の短命Fileで、Recoveryの耐久正本ではない。既存hard-link CASとDomain保存のKernel排他を比較し、Root一致、同一Process／複数Writer、Owner死亡、取得／解放観測、pending残存、出版後Process喪失、Windows／Linuxの提供意味を確認して一方式だけを採用する。この確認前に既存原語の適合や排他成立を主張しない。具体File名、Process喪失時の所有確認・清掃、atomic replaceの実OS保証はOPEN。File flushから電源断保証を推定せず、Topic／Meetingの通常保存承認をAMへ流用しない。

## 5. 鍵交換の段階と終了

失効前にexact Recovery・旧対象集合・既存発行先を固定し、失効、発行、結果記録を共通段階として単調に保存する。通常WorkbenchはBackend返却・Browser配送、HostはローカルCLIへの返却・表示を別観測し、HostのBrowser配送は非該当とする。具体受領方式はOPENで、受領通知を人間の閲覧やAuthorityの証明にせず、新しい受領必須Gateも作らない。発行確定後の配送故障で発行結果を取り消さない。

生Secretは保存しないため、発行後のProcess／応答喪失では再表示・復元ができない場合がある。受領不明から暗黙再発行しない。現在Authorityによる再観測と明示的な次処置を設計で確定するまで、この故障経路はOPENである。

未解決交換は期限・容量だけで除去しない。`unresolvedKeyExchanges`から外す条件は、交換処理の終了と未解決配送の処置を別に確定できること。上限到達時は新しいEffect前に停止する。通常履歴は必要な非秘密要約だけを有限保持し、未解決参照の保護・解消後清掃・具体上限は保存設計の残件として扱う。実行毎DirectoryやEvidence書庫を作らない。

## 6. 既存Capabilityと切替

| 現Source／Consumer | 新Owner・切替条件 |
|---|---|
| `cros/access/credential.ts` | AMのUser参照・現在Role認可へ。現Verifier方式は再利用候補、Credential固定権限は廃止 |
| `cros/access/registry-file-adapter.ts`／`recovery-file-adapter.ts` | AM保存Adapter。出版後throw／falseを未保存扱いしない。無期限改訂・操作File積算は引き継がない |
| `cros/configuration/shared-server-file-adapter.ts` | 接続／Exposureの管理正本を照合し、旧configとの二重正本を解消してから切替 |
| `workbench-server/src/credential/administration.ts`／`src/server.ts` | 旧発行・失効・rotate・資格アクセス更新・一覧を操作別APIへ接続。旧rotateを新交換と同一視しない |
| `mcp-server/src/project-context/cros-resolver.ts`／旧HTTP接続 | 現在認証・内容範囲解決をAMへ、集約をDomainへ。旧REST廃止は代替本番接続後 |
| `cros/access/recovery-cli.ts`／`recovery.ts` | Host交換2種へ。旧bootstrap／full reset／追加ガードを新契約へ流用しない |

旧`shared-server.json`のSchema全fieldは次へ対応する。固定旧入力Hashと各移行先の読戻しを相関し、一つのfieldを複数の現在正本へ複製しない。

| 旧field | 移行先Owner・変換／検証 | Consumer・旧撤去Gate |
|---|---|---|
| `contract` | 移行入力Schemaの識別。新Schemaへ値を機械移植しない | フロントAIが旧Schema検査後、新Owner契約で再検査 |
| `revision` | 旧入力改訂として移行相関へ。AM／Transportの新改訂を旧値から暗黙共有しない | 各新正本読戻しと固定入力対応の確認 |
| `public_origin` | Transport設定Owner。HTTPS・Origin意味を維持しAMへ入れない | Workbench／MCP起動Consumer切替・Origin検証後に旧field撤去 |
| `listen_port` | Transport設定Owner。Port値・Listener配置の対応を確認 | 新Listener本番接続・終了保証後に旧field撤去 |
| `repositories` | AM接続登録／Exposureの全件対応。配列をContext本文へ変換しない | 認可済み解決とDomain集約の全Consumer切替後に旧field撤去 |
| `repositories[].repository_root` | AM Bindingへ対応。Version Controlがexact Rootを再検証、DomainがManifest／Contextを検査 | 新BindingとDomain Reader接続・非許可Reader 0確認 |
| `repositories[].workspace_ids` | AM Exposureへ明示対応。User／Role内容権限へ自動転用しない | 現在内容認可・Exposure・実アクセスの別評価確認 |

旧CredentialにはUser ID・表示名がない。フロントAI移行では固定旧入力Hashと全件の明示User対応およびRepository Binding／Exposure対応を確認し、profile・workspaceIds・systemAdminからRole内容権限や管理能力を自動推定しない。対応不能は停止し、人間へ確認する。新状態の参照整合・読戻し・全Consumer切替後に旧管理正本を撤去する。Sourceの旧形式fallbackや旧新二重書込みは作らず、過去Evidenceは変更しない。実データ移行・秘密Storeへの操作は今回行わない。

## 7. 検証と次Gate

RFD-UT-020は固定判定、RFD-IT-021は入力搬送・保存境界、RFD-ST-022は本番Workbench縦断、RFD-UAT-007は理解を確認する。RFD-ST-016／RFD-IT-017／RFD-IT-018では鍵操作の段階別Effect・不明を維持する。部分write、改訂競合、pending残存、出版後読戻し失敗、応答喪失、排他解放欠測を反証例へ接続する。MCP鍵4面0、Host交換2のみを負観測として確認する。設計追加でNot RunをPassへ変えない。

Repositoryでは重複登録、未登録Exposure、解除後の孤立Exposureを反証する。Exposure残存解除の具体Oracleは上流処置の確定後に導出し、未採用の事前解除必須条件をTestで固定しない。

実装前の残件は、排他の具体Ownerと実OS出版保証、公開read Schema、内容権限語彙、保持・清掃条件、Secret受領不明後の具体処置、初回設定と移行対応である。担当はQual-Lab、再評価契機は保存・API候補固定時。これらは実装Gateを阻害するため、将来改善として退避しない。追加の保証や再表示・自動再発行を採用する場合は上流判断へ戻す。

## Checklist

- [x] 操作別Authority・対象・Effectを既存意味へ対応し、登録と解除を分離した。
- [x] 内部状態と公開read、秘密非保存、現在値と元要求完了を分離した。
- [x] 保存候補を比較し、未確認の排他・出版保証を成立扱いしない。
- [x] 交換の段階・4組表示3組確認・入口別配送を区別した。
- [x] 旧設定の全fieldとCredentialの移行Owner・Consumer切替条件を記した。
- [x] Quality項目と反証面を対応し、Not Runを維持した。
- OPEN: 排他・出版・保持清掃・公開Schema・受領不明処置・実データ対応は§7の残件。Qual-Labが保存／API候補固定時に確認し、未解決の間は実装Gate未成立。
- OPEN: Exposure残存時の登録解除処置は§3の条件で上流Ownerへ確認する。解除API・保存Schema固定前に解決するまで該当解除を実装しない。
- OPEN: Consumer本番接続・旧撤去・実境界検証はSource移管後にQual-Labが確認する。候補対応表だけではCapability完成を主張しない。
