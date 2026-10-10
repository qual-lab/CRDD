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
| `unregisterRepository` | 既存Repository ID・現在登録状態・現在Exposure状態・期待改訂。現在manager／administrator | 同じ受理済み操作・採用改訂で対象登録と対応Exposureを除去し、両方の読戻し確認時だけ完了。他登録・Exposure、対象Repository本体・Product Dataを保持。登録時のBinding再検証を解除条件に転用しない。開始済み操作の取消完了は証明しない |
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

ExposureのRepository IDは既存登録を参照し、重複・孤立参照を拒否する。登録解除では同じ受理済み操作・採用改訂で対象登録と対応Exposureを除去する。事前の別Exposure解除は必須とせず、対象外登録・Exposureと対象Repository本体・Product Dataを保持する。両除去の読戻しを確認した場合だけ完了とし、片側残存・観測不能は完了にしない。両除去が確定しても開始済み操作の終了が未観測なら、その不明を別に保持し、取消成功・過去Effect 0・実資源終了を推定しない。新しい取消処置は追加しない。同一改訂の論理整合は確定方針であり、物理的な原子出版・排他の成立は§4で別途確認する。

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

### 4.1. 既存保存部品の照合結果 — 2026-10-11

単一現在Fileの候補を具体化するため、現Sourceを読取り、現在のPCで通常置換を局所実測した。これは物理保存方式の採用、実装着手条件の成立またはAM全体の検証結果ではない。

| 対象 | 確認できたこと | 適用条件・残件 |
|---|---|---|
| `resolveCrosRuntimeRoots` | Windowsはconfigとstateが同じRoot。Linuxは既定では別RootだがXDG設定により同じRootになり得る。Filesystemを検証しない | 現在状態のOwnerはstateとする候補。文字列解決だけから書込みCapabilityを生成しない |
| `createFilesystemStoreRoot`／Path解決 | 既存DirectoryをCapability化し、対象Pathの既存chainを検証する | Host Rootの初回作成は所有しない。準備前後の検証をAM Adapterへ閉じ、作成後の失敗をEffect 0と表示しない |
| `withFilesystemStoreLock` | 同じRoot・相対Lock Identityの協調Writerについて、同期callback全体をKernel排他へ閉じる | 現在read、認可・期待改訂、write、出版、read-backを同じcallbackに置く。非同期callbackや非協調Writerの保証へ広げない |
| Lock解放・回収 | 操作完了とcleanup不明を別に返す。Owner消失後もLock記録は残り、既存の不存在観測・exact回収が必要 | AM Adapterの次回更新入口から既存回収へ接続する候補。Lockの回復参照を鍵交換Recoveryへ転用しない。close故障等でもAM側の既知出版事実を保持する |
| `readStableBoundedFileSnapshot` | 上限付き読取りと実体同一性の確認を所有する | 書込み・置換・pending清掃の保証には使用しない |
| 旧Credential File Adapter | 改訂Fileへの排他的hard linkとbyte読戻しを行う | 改訂積算と単一現在File置換は別方式。旧試験の成功を新方式の競合・故障保証へ流用しない |

固定Path候補は、解決済みstate Root直下の`access-management.json`、`access-management.pending.json`、`access-management.lock`とする。保存だけのために子Directoryを追加しない。Lock部品が必要時に作る回収義務Fileは同部品が所有し、鍵交換記録と区別する。全Writerが同じ検証済みRootとLock Identityを使用する。Rootの初期準備、非秘密設定と秘密Verifierを含む状態の保護、旧保存先からの移行は別途接続する。

Windows `10.0.26200.0`・C: NTFS・Node `v24.19.0`で、同Directoryの短命Fileを`wx`作成→write→file fsync→close→`renameSync`で既存currentを置換→byte読戻しを100回実測し、全回の一致とpending不存在を確認した。試験はRepository-local `.crdd/tests/`内の自己生成領域だけを使用し、作業領域を回収した。§4.1の単独確認時点では、並行Reader、Process喪失、他Windows版／Filesystem、Linux、Directory entryの耐久性、電源断保証は未確認だった。競合・Process終了・並行読取りの追加局所結果は§4.2に示す。本番接続、他環境、電源断等は引き続き未確認であり、この数値をStore完成やatomicity全体の証明にしない。

§4.1の確認時点での次候補は、協調Writerの競合、旧／新の完全Snapshot読取り、出版前後のProcess喪失とpending照合、既存Lock回収の本番入口接続だった。§4.2の局所確認後も本番入口接続は残る。pendingは年齢で削除せず、基準／次改訂と現在byteの対応を照合し、旧交換の未解決事実を失わない。具体の再入場Schema、公開read中の回収状態の扱い、Linuxでの提供意味が未確定の間は保存Gate未成立を維持する。新Lock／Recovery Frameworkや電源断完全保証を追加しない。

### 4.2. 競合・Process終了・並行読取りの局所確認 — 2026-10-11

§4.1と同じPC・Windows `10.0.26200.0`・C: NTFS・Node `v24.19.0`で、自己生成領域と既存保存部品を使って次を確認した。新しいAM保存Adapter、公開Reader、秘密Store、Dockerには接続していない。

| 場面 | 実際の観測 | 証明しないこと |
|---|---|---|
| AのLock保持中にBが同じ期待改訂0で更新要求 | Bは`filesystem_store_lock_unavailable`、callback呼出し0。Aだけ改訂1を出版 | 全Writerの協調、公平性、同時取得の勝者 |
| A完了後にBが同じ期待改訂0で再要求 | callback内で現在改訂1を読み、改訂競合・write 0 | 初回Lock拒否と改訂競合を同じ理由に畳まない |
| pendingのfile fsync後に子Processが`exit(23)` | 現在改訂0と完全なpending改訂1が残る。再取得結果のexact回復IDから既存のOwner不存在観測・Lock回収が完了 | Lock回収だけではpending処置・状態回復が完成しない |
| rename直後に子Processが`exit(23)` | 現在改訂1、pending不存在。再取得結果のexact回復IDから既存Lock回収が完了 | 強制終了・電源断・Directory entry耐久性 |
| 上記2例の次更新 | 既知probeのbyteと改訂を照合し、前者のpendingだけ処置した後、次更新・読戻し・Lock cleanupが完了 | 本番の再入場・保持・清掃接続 |
| Lock外で`readStableBoundedFileSnapshot`を並行実行 | Writerのrenameが`EPERM`となる反例を2回観測。分類した実行は改訂41まで出版済み。次の置換がEPERMで不成立となり、pendingが残存。Reader成功は旧12回・新66回 | 正常な単独置換から並行Readerとの成立を推定しない。失敗から前41回の出版を取り消さない |
| Readerも同じRoot・Lockの同期callbackへ入れた対照 | Writerは同じcallback内の100置換を完了。Readerは旧2回・新2回、Lock取得不可61回、`recovery_required`1回 | 100版全ての読取り、本番公開readの成立、待機時間・公平性 |

全子Processの終了をjoinし、自己生成作業領域を回収した。試験用pendingの処置を、本番の削除Authorityや状態回復へ昇格しない。通常Writerのcleanup区間でも`recovery_required`を観測し得るため、それだけからOwner死亡・自動回収可能を推定しない。既存のexact ID→Owner不存在Proof→回収を維持し、Lockの回復参照を鍵交換Recoveryへ転用しない。

並行Readerと置換の組合せには実反例があるため、公開readも同じ保存Owner・Root・Lockで短い同期区間へ閉じる方式を候補とする。新しい排他Frameworkや無制限の再試行は追加しない。Lockを使うreadは短命Lock記録等のFilesystem Effectを持つので、AMの内部保存Ownerが取得・解放・不明を処置し、外部へraw Capability・Path・Lock回復Authorityを渡さない。取得不可、回収確認待ち、読取り不明は空集合・未登録・正常成功へ畳まず、現在値を取得できなかった結果として扱う。

この対照は候補選定用であり、公開Readerの結果型・利用側の再取得、認可境界、解放欠測、初回Root準備、本番pending再入場、Linux／他Windows版／Filesystemの接続確認は残る。既存RFD-IT-021等の反証面へ接続するが、Local ItemのNot RunをPassに変更しない。電源断完全保証、取消機構、公平性保証を新たな要求として追加しない。

## 5. 鍵交換の段階と終了

失効前にexact Recovery・旧対象集合・既存発行先を固定し、失効、発行、結果記録を共通段階として単調に保存する。通常WorkbenchはBackend返却・Browser配送、HostはローカルCLIへの返却・表示を別観測し、HostのBrowser配送は非該当とする。具体受領方式はOPENで、受領通知を人間の閲覧やAuthorityの証明にせず、新しい受領必須Gateも作らない。発行確定後の配送故障で発行結果を取り消さない。

生Secretは保存・再表示しない。発行後のProcess／応答喪失は、次の3分岐で処置する。意味の正本は[確定BHV-000012](../../../05_SPEC/Details/BHV-000012/behavior.md)の「登録解除と発行・受け渡しの確定条件」で、物理保存・公開read・配送観測の具体化は未完了である。

| 現在確認できる状態 | 処置 | 保持・禁止条件 |
|---|---|---|
| 発行または結果記録が不明 | Credential IDとは別の非秘密な元発行Identityと既知事実で現在再観測し、新交換を開始しない | 交換由来だけ元のexact Recoveryを保持。通常発行へ交換Recoveryを新設せず、`unresolvedKeyExchanges`へ通常発行不明を格納しない。既知の確定事実を不明へ戻さない |
| 発行・結果記録が確定し、配送／受領だけ未確認 | 「発行済み・受け渡し未確認」と表示し、現在許可されたadministratorが既存の指定／全員交換を明示的な別操作として選ぶ | 秘密再表示・保存・自動再発行なし。新交換は別Operation／別Recovery、各交換内だけ同じexact Recovery。旧事実・元発行Identityを保持 |
| 現在administratorとして接続できない | 既存のログイン済みHost交換入口へ案内する | Workbench認可を迂回せず、Hostへ通常発行・独立失効・追加認証・新Recovery機構を追加しない |

別交換の指定操作は先に発行した鍵を含む対象ユーザーの全旧有効資格を失効し、同じ既存userIdへ新資格を発行して他ユーザーの鍵を保持する。全員操作は先の鍵を含む全旧有効資格を失効し、指定既存administratorへ一資格を発行し、他ユーザーは通常再発行・再配布へ戻る。現在対象集合・認可・4組の事前表示・3組の明示確認を再適用する。遅延した旧応答で失効済み鍵を利用可能と表示しない。新交換成功は旧Secret受領・rollback・開始済み取消完了の証明ではない。

未解決交換は期限・容量だけで除去しない。`unresolvedKeyExchanges`から外す条件は、交換処理の終了と未解決配送の処置を別に確定できること。別交換の成功を旧Secret受領確認に転用しない。上限到達時は新しいEffect前に停止する。通常履歴は必要な非秘密要約だけを有限保持し、未解決参照の保護・解消後清掃・具体上限は保存設計の残件として扱う。実行毎DirectoryやEvidence書庫を作らない。

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

Repositoryでは重複登録、未登録Exposure、解除後の孤立Exposure、片側除去だけの完了表示、対象外登録・Exposure／本体変更、解除完了からの開始済み取消完了推定を反証する。鍵では通常発行不明への交換Recovery付与、不明発行からの新交換、確定発行の不明化、別交換と旧Identityの混同、秘密再表示・自動再発行、失効鍵の遅延利用案内、現在認可なしの通常交換を反証する。処置方針の確定からQA実行済みを推定しない。

実装前の残件は、排他の具体Ownerと実OS出版保証、公開read Schema、元発行Identityと配送／受領観測の具体保存・搬送、内容権限語彙、保持・清掃条件、初回設定と移行対応である。担当はQual-Lab、再評価契機は保存・API候補固定時。登録解除と受け渡し未確認後の処置方針は確定済みだが、これらの物理・接続残件は実装Gateを阻害するため将来改善として退避しない。追加の保証や再表示・自動再発行を採用する場合は上流判断へ戻す。

## Checklist

- [x] 操作別Authority・対象・Effectを既存意味へ対応し、登録と解除を分離した。
- [x] 内部状態と公開read、秘密非保存、現在値と元要求完了を分離した。
- [x] 保存候補を比較し、未確認の排他・出版保証を成立扱いしない。
- [x] 交換の段階・4組表示3組確認・入口別配送を区別した。
- [x] 旧設定の全fieldとCredentialの移行Owner・Consumer切替条件を記した。
- [x] Quality項目と反証面を対応し、Not Runを維持した。
- [x] 登録解除の同時除去と鍵の3分岐を確定上流へ合わせ、処置方針の旧OPENを解消した。保存・接続の成立とは区別する。
- OPEN: 排他・出版・保持清掃・公開Schema・元発行Identity／配送観測の具体保存・実データ対応は§7の残件。Qual-Labが保存／API候補固定時に確認し、未解決の間は実装Gate未成立。
- OPEN: Consumer本番接続・旧撤去・実境界検証はSource移管後にQual-Labが確認する。候補対応表だけではCapability完成を主張しない。
