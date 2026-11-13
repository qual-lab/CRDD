# Domain Modelの3パッケージ分離案

状態: 実装・利用側追従・限定検証・独立再レビュー済（全体回帰未実施。統合判断とは別）
基準改訂版: `a7618c6d0fdade66fab1f81f24de714e21822f08`
対象: `40_Develop/domain-model`と本番・試験・Script・配布ひな型の利用側
更新日: 2026-11-12

## 実行モデル内部責務の追加整理候補 — 2026-11-12

状態: 今回範囲限定完了。Source・試験・台帳・文書の独立レビュー必須残指摘0。Root helper24件の最小化と全体回帰は未完。

基準`38d51403f`。本番未接続となったTemporary OperationをRootから隠すだけでなく、約1,600行の実装・孤立型・Map・専用試験／fixtureを代替なしで退役した。最後の本番Callerは署名準備で、a04ecb703における署名経路一式の撤去後に再接続されていない。共有I/O・通常保存／回復・過去保持物は対象外とし、過去記録の互換再開・清掃は作らない。

共通Record取得は受理条件の比較後、既存snapshotRuntimeStateRecordへ一正本化した。旧snapshotPlainRecordの別名Wrapperは残していない。配列二種・descriptor直結の条件差は今回変更していない。State単一Snapshotの全区画を作る候補は、名前だけでAttemptへ移さずStateの跨モデル責務として残す。局所Owner移動の候補表は調査結果であり、値依存循環の解消済みを意味しない。

修復の公開Input／ResultとRoot公開縮小を利用側・試験・設計へ対応付け、固定候補の独立レビューを完了した。関係八型設定と限定検証は成功、Ownerの13親・45子の58件も正常終了し、各fixtureの終了hookに例外報告はなかった。Source・試験・台帳・文書の必須残指摘は0で、今回範囲の限定完了とする。外部Coordinator試験が必要とする24 helperはRoot限定Guardを維持して残すため、公開最小化完了とはしない。各集合の重複・先行結果と未実施範囲はEvidenceで区別する。全体回帰・実AI／Docker・過去保持物の操作は対象外。

## 実行モデル内部整理の追加区切り — 2026-11-12

基準は`c878b9798`。Sourceを53から24ファイルへ統合し、7モデルのcrud／validation／typesとstorage/store／lock、Rootに責務を揃える。旧Source Pathの互換接続は作らない。機密検査はCoordinatorの送信境界へ移し、その7値だけRoot公開から外す。この区切りのRootは364項目（279値・85型）だった。追加の公開縮減は当該区切りでは判断せず、後続の内部責務整理候補で扱う。

初期の構造移管では旧宣言663個の本文を新Ownerへ対応付け、実衝突する私有名と内部import／exportを追従した。構造変更の補助比較であり、動作同等や全境界の成立証明ではない。後続の反証で見つけた期待保持日数の引数搬送漏れ2箇所は別に是正し、既存の現在性検査へ値を届ける。Stateの短命Mapと一回使用Protocolはstate/crudへ一括保持する。通常終了・回復・修復の保存Schema、CAS、排他、Identity、既存保持設定の再観測とFailure情報は維持する。

試験の私有import・Source抽出・Module Mockを実Ownerへ追従し、試験内だけの保存閉包でも各Sourceを一度だけ組み立てる。32既存EM Suiteの初回結果と是正影響subsetの再実行を分離して記録し、最終32 Suite一括再走とは扱わない。利用側の限定対照、型・整形・lint、台帳関係の確認は成功した。独立レビューの責務説明1件は文書を是正して再確認済み、残指摘0。全体回帰・実AI／Docker・過去保持物は操作していない。

## 構成モデル内部整理の追加区切り — 2026-11-12

3分離後の構成モデルを4領域（AI選定・Network Policy・保持設定・Manifest）と保存に再配置する。Sourceは`index.ts`、各領域の`crud.ts`／`validation.ts`／`types.ts`、`storage/store.ts`／`storage/lock.ts`の15 Fileとする。以下の§8／§9は3分離時点の対応表・公開候補として保持し、今回の現在構成は[構成モデル詳細](../../../06_Architecture/Details/configuration-model/01_Architecture.md)を正本とする。

未接続の`inspectCrosTrustPolicy`／`CrosTrustPolicy`を撤去し、固定Manifestの完成読取り`readRepositoryManifest`と結果型を公開する。外部本番利用のない`inspectRepositoryManifest`はRootから外し内部検査として維持する。公開総数は8関数・2定数・14型の24 Symbolとなるが、数合わせを目的としない。Root依存、形式・Schema、固定所在、JSON条件、Lock／CAS、部分Effectと回復参照を変更せず、旧PathのWrapper・別Package・代替Trust機構を追加しない。

Manifestは旧ReaderのUTF-8置換復号とJSON.parse条件、有効hardlinkの受理を維持する。IdentityはWB／MCPの旧全文比較と同じ復号後本文のSHA-256とし、同本文へ復号される異byte列を変更扱いしない。AI選定の厳密JSON・descriptor検査はAI専用であり、Manifest／保持設定へ一律に適用しない。他設定の生byte Hash・CAS・安全条件は変更しない。

試験のdeep参照・Module Mock・Source抽出と、EM／VCの保存Consumer閉包、Co実体IDの対照、Symbol／Catalog／正式QAを新Ownerへ追従する。基準の限定検証Evidenceは当時の記録として保持し、今回の新結果は同Evidenceの追加区切りへ記録する。予定の限定確認76件・関係11型設定と独立再レビューを完了した。予定外試験の誤起動と回収観測の限界は同Evidenceへ分離し、今回の成立を全体QA・統合・Releaseへ拡大しない。全体回帰・実AI／Docker・過去保持物は操作していない。

以下の初回分離の配置表・Root候補コードは、基準版a7618c6d0での対応案を比較記録として保持する。後続の構成／実行モデル整理で廃止・統合したSource名と公開集合を、現行APIの正本へ読み替えない。現在の構成は各モデルのArchitecture・実Root・固定期待契約試験、および上記の後続区切りを参照する。

## 1. 結論と変更境界

文書モデル（document-model）、実行モデル（execution-model）、構成モデル（configuration-model）を独立した3 Packageへ分ける。**3モデル間の直接依存は0**とする。実装importだけでなく、型import、再export、他モデル型のextends／Pick、deep import、dynamic import、package依存も禁止する。複数モデルの結合はCoordinator／Workbench／MCP等の既存Consumerが担当する。

旧domain-modelの互換Facade、第4の共通Package、Manager／Registry／Store、汎用Runner／設定Reader注入は作らない。相互依存をCallbackで隠すことも採用しない。

合意した境界に従ってSource・package設定・利用側を分離した。保存物は移行・操作していない。公開InputとConsumerの接続は下記のとおり変更する候補だが、保存Path・Schema・契約ID・CAS・Lock Identity・安全判定・失敗情報・Effect順序は変更しない。

| Owner | 所有する意味 | 所有しない意味 |
|---|---|---|
| document-model | 成果物構造、文書解析・診断、Topic／Meeting、Project Context、Semantic、Reality、試験Catalog | 設定Reader、Task実行状態、認証、Recovery許可 |
| execution-model | Objective／Task／Attempt／Queue／Workspace、Blocker／提案回答、State・History・回復記録、確定済み実行入力 | 設定の探索・選定、Docker操作、Provider解析、主体解決 |
| configuration-model | 設定・宣言の値、検査、読取り／保存、設定自身の固定配置 | 他モデルの型、実行State、一括Runtime領域管理、汎用保存Helperの配布 |

変更分類はPackage境界・利用側Inputの設計是正。現行Sourceと既存保存契約を着手前に照合した。今回は設計の責務・依存・利用側閉包を独立確認し、規格の準拠基準やリリース判断は変更しない。実装・移行の監査や全体回帰は実施しない。

## 2. 依存と受け渡し

- 各モデルは必要なVC／共通Lock／Node.jsを直接使用する。実行モデルの既存DI／AD技術結果型参照は維持する。
- 文書・実行・構成モデルの間には、型を含めて矢印を置かない。
- Consumerだけが複数モデルをimportし、取得結果を受け手Ownerの要求へ明示的に投影する。
- 各モデルは受け取る値を自分の境界で検査する。「構成モデルで検査済みだから無条件受理」としない。
- 値の受け渡しはAuthorityの追加・再発行ではない。既存のPrincipal・実行許可・保存相関はそのまま保持する。
- 自Package Rootへの逆importも撤去し、内部の実Ownerを直接参照する。

| Consumerで取得する情報 | 受け手へ渡す情報 | 受け手がしないこと |
|---|---|---|
| 構成モデルのRepositoryManifest | 文書モデルへprojectId／repositoryId／repositoryRoleの3期待値 | Manifest型のimport、設定File読取り |
| 構成モデルのAiSelectionConfig＋ADの解決結果 | 実行モデルへ具体技術選定と当時の相関値 | Config Schemaのimport、設定再選定 |
| 構成モデルの保持設定 | 実行保存InputへhistoryRetentionDays | readCoordinatorConfig呼出し、設定不正時の独自default |
| AMが確定した主体 | 各モデルへ既存の要求主体・認可Context | AM再認証、OS主体による勝手な置換 |
| VCが検証したRepository | そのまま各Ownerの完成操作へ | 他モデルからRoot Capabilityを借りる、任意PathをAuthority扱いする |

### 文書の期待Identity

`readRepositoryProjectContext(root, expectedIdentity)`の第2引数は文書モデル自身の要求とする。新しい共通型は作らず、既存`RepositoryProjectContext`の3 fieldを使う。

```ts
// document-model内だけで完結する引数型の案
expectedIdentity: Pick<
  RepositoryProjectContext,
  "projectId" | "repositoryId" | "repositoryRole"
>
```

ConsumerがManifestから3値を明示的に渡す。現行の三Identity完全一致、文書実体確認、内容改訂の意味は維持し、Manifest全文・Trust・権限を文書モデルへ渡さない。

### 確定済み実行入力

`ExecutionSelection`とその検査・Hash、`TaskExecutionSelections`と組合せ検査は実行モデルが正本となる。`ExecutionSelection`はADの`ModelSelection`を基礎とし、catalogIdentity／configIdentity／role／workType／sourceを自分の実行入力として定義する。roleを構成モデルの`AiSelectionRole`への参照にしない。

構成モデルには`AiSelectionChoice`・役割別希望設定だけを残す。Coordinatorの既存選定処理がConfigとADの結果を使い、実行モデルのInputへ各fieldを投影する。Hashの正規化順序・当時の選定元・Taskの担当相関・保存JSONは不変更とする。

Objectiveの明示choiceは既存`CoordinatorObjectiveRequest`の3 fieldの局所要求として定義する。構成モデルの型import／型別名にはせず、実行モデル内部で型・非空・文字形式・data-property条件を検査する。新しい共有Choice型やRoot aliasは作らない。上位Consumerが設定Choiceを使うことは許すが、モデル同士は参照しない。

## 3. 保持設定と既存の再検証

単なる「保持日数を一度渡す」だけでは既存保証を維持できない。現行は`runtime-store.ts`の6箇所と`runtime-history.ts`の4箇所で設定を読み、出版・flush前後にも現在readyで同じ日数かを確認している。

基底のRuntimeAccess／RuntimeExecutionStorageAccessと通常Queryは変更しない。保持日数を消費する操作・分岐だけ、既存Inputとの交差型等で実行モデル自身の保持日数を受け取る。混合分岐では履歴処理に入るまで日数の存在・妥当性を要求しない。上位のRecovery入口で設定不正を一律拒否しない。

上位Consumerが既存revalidateへ「現在設定がreadyで渡した日数と同じ」を結合するのも、履歴確認を要求された呼出しに限定する。通常の認可／Repository再検証で設定Readerを呼ばない。履歴を扱うInput側だけ、既存revalidateの任意の最終引数に期待保持日数を指定できる契約へ拡張する候補とし、通常呼出しは従来引数のまま、元の10箇所の設定確認だけ期待日数を渡す。例えば業務用は通常revalidate(operation,target)、履歴境界だけrevalidate(operation,target,expectedHistoryRetentionDays)とする。Root／終端用も通常呼出しと履歴確認呼出しを同じ原則で区別する。基底型を全操作共通の設定Contextへ変えない。

実行モデルは設定Reader・構成モデル型・設定本文を受け取らない。新しいgetConfig Callback／Provider／Registryや別のCallback fieldは作らない。

| 現Input・経路 | 是正候補 |
|---|---|
| RuntimeExecutionStorageAccess.observeRepositoryの結果 | 履歴を消費する保存操作側だけ保持日数と履歴確認可能な既存再検証を要求。基底と通常観測は不変更 |
| RuntimeSettlementStorageAccess | 終端の履歴処理を行う操作側だけ同じ拡張。単なる終端実体照合へ設定要件を加えない |
| 業務RuntimeAccess | 履歴を処置する操作側だけ交差Inputを使う。通常Queryは既存Input・再検証のまま |
| VC Repository単体のRecovery読取り／修復出版再入場 | 履歴を扱う必要がある場合だけ、実行モデル自身のroot・保持日数・既存再検証を持つ要求へ拡張する。非履歴分岐は設定未取得でも従来どおり。汎用Context Packageや新Authorityは作らない |
| maintainCoordinatorSnapshotRecords／transferCoordinatorSnapshotHistoryRecords | 実際の履歴保守に必要な要求を受け、既存OwnerのRepository束縛へ値を結合する。新Mapを追加しない |

要求型は既存の保存Inputに隣接して定義し、関数の引数契約から参照する。型の統一だけを目的とした新しい公開Context階層は作らない。設定を消費する分岐では、日数未取得／不正や同期再検証のthrow／false／Promise等を既存の停止条件どおり処理する。未消費分岐では設定に関する検査も拒否も発火させない。

保持設定を消費する処置では、その処置前の設定取得不成立で当該Effectを発行せず、再検証不成立でも現行のEffect有無・未確認・回復参照を維持する。ただし、設定取得失敗を非履歴Query／Recovery全体の停止へ広げない。設定不存在時30日と明示30日を新たに区別したり、Config Hash・設定世代一致を追加したりしない。この設計は既存の現在性確認を上位へ戻すものであり、新しい常時設定ガードではない。

## 4. 共通Helperは各実Ownerへ閉じる

共通している実装があることと、共通のドメインOwnerがあることを同一視しない。Model Rootを便利関数配布口にせず、必要な境界処理だけを実際の入力／保存Ownerへ局所化する。Helper File全文の3コピー、汎用Adapterの再建、新ライブラリの導入はしない。

| 現Helperと実Consumer | 分離後 |
|---|---|
| root-and-lock：AM初期化・Store・Lock、構成のAI設定保存 | AMは自身のRoot型・初期化・保存接続を正本化。構成はconfig保存内でNode／Lockへ直接接続。generic3関数をModel RootやAM Rootへ移し替えない |
| file-snapshot：AM、実行State、AI／Network設定、Co CLI、WB検証Script | 各Ownerの内部Readerへ必要な実体・EOF・close確認を局所化。StableFileIdentityの汎用Root公開は撤去 |
| plain-data snapshot：実行要求・保存、AI設定、Co／WB／MCP入口 | 各Ownerの閉Schemaに必要な検査として保持。getter／Proxy／過剰field拒否を削らない |
| 重複Key拒否JSON：AI設定、Co CLI／送信設定、WB HTTP／IPC／診断 | 保存ReaderまたはTransportの既存入力処理内へ。JSON.parseだけで同等とせず、重複Key拒否を維持 |
| outcome.ts | 文書診断専用なので文書モデル。全モデル共通結果へ拡張しない |
| secret-validation.ts | 実行入力・Workspace投影のPolicyとして実行モデル。設定モデルへ置かない |

AMの`FilesystemStoreRoot`はAM自身のRootから必要な型として公開する候補とし、MCP／WorkbenchはAM正本を参照する。構成モデルから再exportしない。AM既存の初期化・完成操作でRootを取得し、generic Factoryの新公開は追加しない。現在AM本番19 File、MCP3 File、Workbench11 Fileの型搬送が追従対象である。

局所化では必要な小規模処理が複数Ownerに残り得る。これを理由に同一保存Protocolや正規化を変えず、既存の境界試験を各Ownerに対応付ける。分離のための検査緩和・Quota復活・新しい保護Policyは認めない。

## 5. 配置とFilesystem操作のOwner

各OwnerがVCの検証済みRootから自分の固定配置を内部で求める。他モデルから全Path集合を取得したり、Parent Pathを逆算してAuthorityを拡張したりしない。所在・実体・前後同一性・Ignore登録の失敗情報は保持する。

| 固定配置・処理 | Owner |
|---|---|
| .crdd/configの設定Fileとその保存 | configuration-model内部 |
| .crdd/domain-modelのState／履歴、実行保存用tmp | execution-model内部 |
| 文書のTopic／Meeting、Semanticの出力 | document-model内部 |
| CoordinatorのLease／Workspace／EI Store接続／Image準備／保護Mount／検証領域 | 既存Coordinatorの当該処理内 |
| AMのHost管理RootとCROS配置 | AMの既存initialization/root.ts内 |
| Workbench／MCPの保存接続、検証Script | 既存の当該Owner内 |
| Executor／Visual Previewの試験領域 | 当該検証Owner内 |

`resolveCrosRuntimeRoots`／`CrosRootInput`の実本番ConsumerはAM初期化だけである。環境探索・Filesystem Effectを持たないPath計算なのでAM内部へ移す。構成モデルのCrosTrustPolicy宣言検査とは別に扱う。

一括のRuntimePath／Area enum／汎用ensure／FromWorkingDirectory WrapperはModel Rootから撤去する。Working DirectoryからRepositoryを確定する必要があるConsumerはVCを直接利用し、その後に当該Ownerの完成操作を呼ぶ。新しい汎用Path APIは追加しない。

実行Stateの`createCoordinatorRuntimeDataArea`と`assertRuntimeStateInitializationBoundary`は同じ実行保存Owner内へ一緒に移す（実装では既存storage/ensure-area.tsへ保持し、形式だけのinitialization.tsは新設しない）。本番外部Consumerがないため前者もRoot候補から外す。旧coordinator領域の明示不存在、親実体の前後一致、排他的作成と空の新規領域確認を保持する。実行一時OperationのRoot束縛も同じ実行保存Ownerに置き、作成・再開・根拠昇格・世代・Receipt・Hash・Lock・Effect順序を変えない。

### 領域確保失敗の公開契約

`RepositoryRuntimeDataAreaBlockedError`は単純なHelperではない。現CoordinatorのObjective／Decision／Queryがinstanceofで捕捉し、Effect不明・cleanup・回復参照を公開結果へ投影している。そのため**実行モデルの既存失敗契約としてRoot公開を維持**し、宣言をstorage/runtime-result.tsへ置く候補とする。Constructorの型は実行モデル自身の失敗payloadで定義し、他モデルensure関数のReturnTypeを参照しない。

構成保存はこのクラスをimportせず、既存の設定保存Resultで失敗を返す。Coordinator自身のEI／Lease等の領域失敗はそのOwner内で処理する。上位Consumerの既存投影を追従し、単なる未実施や一般Errorへ情報を潰さない。型・公開数削減だけを目的に、新しい例外階層や共通失敗Managerを作らない。

## 6. Afterと利用側の変更

```text
40_Develop/
├─ document-model/src/
│  ├─ index.ts
│  ├─ artifact/、activity/、topic/、meeting/
│  ├─ project-context/、semantic/、reality-traceability/
│  ├─ test-catalog/、quality-change-control/
│  ├─ repository/       # 文書観測だけ
│  ├─ storage/          # 文書保存だけ
│  └─ outcome.ts
├─ execution-model/src/
│  ├─ index.ts
│  ├─ objective/、task/、attempt/、decision/
│  ├─ state/、workspace/、identity/
│  ├─ repository/path.ts
│  ├─ plain-data/       # 実行入力の局所検査
│  └─ storage/          # State／履歴／一時操作／初期化と内部I/O
└─ configuration-model/src/
   ├─ index.ts
   ├─ ai-selection/     # 設定希望値だけ
   ├─ configuration/    # 宣言・期間・固定config所在
   └─ storage/          # 設定保存と内部I/O
```

JSON／data-property検査を置くためだけの共通フォルダやFacadeは必須にしない。上のBlock内で実際の責務へ隣接させる。

| Consumer | 変更 |
|---|---|
| Coordinatorの選定処理 | Config＋ADを取得し、実行Inputへfield投影。設定型をEMへ運ばない |
| Coordinatorの通常保存・終端・業務CRUD・Recovery・履歴保守 | 保持日数を消費する操作・分岐だけEM要求へ搬送し、履歴確認呼出しに限定して既存revalidateへ設定現在性を結合。通常Query／非履歴分岐を止めず、Root単体経路も取り残さない |
| Workbench／MCP | 各モデルを別々に利用。画面／API用の結合と入力投影を既存Consumer内で行う |
| AM | Host RootとCROS所在・StoreRoot型を自Ownerへ。Manifest／Trust設定は構成、文書Identity照合は文書へ3値投影 |
| Checker | 文書モデルを利用。Manifestの設定Path定数／値は構成から得るが、モデル同士は接続しない |
| Co CLI／WB HTTP・IPC／MCP | JSON／data-property／File読取りは自分の既存入力処理へ局所化 |
| Script／試験／coverage／品質台帳／template | importだけでなく旧Path列挙、namespace／dynamic import、Source抽出、Fixtureを追従 |

## 7. 保存と検証の成立条件

保存先`.crdd/domain-model`等はPackage名とは独立した現行Identityとして維持する。Schema、契約ID、改訂、Path、Principal、Lock Identity／世代、履歴保持、回復条件、実行取消やCleanupを変更しない。AppData側Decision Store、旧形式Reader、自動移行は追加しない。

| 維持対象 | 必要な確認 |
|---|---|
| 文書解析・Relation・Topic／Meeting・Semantic | 文書Ownerの既存契約／実保存試験、Manifest三値投影の一致／不一致 |
| Task／Attempt／Blocker／State／History／CAS | 実行Ownerの既存単体・保存・再入場・Consumer結合 |
| AI設定・Manifest／Trust・Network設定 | 構成Ownerの既存検査／保存／競合／失敗試験 |
| 保持設定 | 元の10再検証位置に対応する枝の初回不正・途中不正化・日数変更・同値・Effectと回復参照、および設定不正でも通常Query／非履歴Recoveryが新たに停止しない対照 |
| 局所化したI/O・入力検査 | 別Root／Link／File置換、Windows File ID表現、EOF／close失敗、重複Key／getter／Proxy拒否 |
| 領域失敗投影 | 元例外／Resultから理由・Effect不明・cleanup・回復参照が失われないこと |
| 依存ゼロ | Sourceと型の全import、再export、dynamic import、package設定、生成宣言のモデル間参照が0 |

基準版の既存試験を新OwnerとConsumerに対応付ける。今回の設計確認を、移管後の実装・型検査・試験成立の根拠にはしない。AM表示名と判断待ち制約は保留する。全体回帰・実AI・実Docker・過去保持物の操作は実施しない。

## 8. 全Source移管表

基準版137 Sourceを全数対応する。混在Sourceを役割別に分けるため、移管後のFile数が137になるとは限らない。

| 現Source（domain-model/src配下） | Owner／処置 |
|---|---|
| `index.ts` | 廃止（3つのRootへ置換） |
| `outcome.ts` | document |
| `activity/federate-relations.ts` | document |
| `activity/operations.ts` | document |
| `activity/types.ts` | document |
| `ai-selection/types.ts` | 分割：設定のAiSelection*→configuration／ExecutionSelection・TaskExecutionSelections→execution／AD再公開→正本直接参照 |
| `ai-selection/validation.ts` | 分割：設定Choice・Config検査→configuration／実行選定検査・Hash・Task組検査→execution。Objectiveのchoice境界はexecution内部で所有 |
| `artifact/activity-table.ts` | document |
| `artifact/anchors.ts` | document |
| `artifact/architecture-details.ts` | document |
| `artifact/architecture-relations.ts` | document |
| `artifact/architecture.ts` | document |
| `artifact/change.ts` | document |
| `artifact/checklist.ts` | document |
| `artifact/discovery.ts` | document |
| `artifact/document-header.ts` | document |
| `artifact/graph.ts` | document |
| `artifact/ia.ts` | document |
| `artifact/identity.ts` | document |
| `artifact/inspect.ts` | document |
| `artifact/links.ts` | document |
| `artifact/markdown.ts` | document |
| `artifact/parse-markdown.ts` | document |
| `artifact/phase-checklists.ts` | document |
| `artifact/phase-diagrams.ts` | document |
| `artifact/quality-analysis.ts` | document |
| `artifact/quality-definition.ts` | document |
| `artifact/quality-readiness.ts` | document |
| `artifact/quality-relations.ts` | document |
| `artifact/quality-state.ts` | document |
| `artifact/quality-templates.ts` | document |
| `artifact/release.ts` | document |
| `artifact/spec-correspondence.ts` | document |
| `artifact/spec-details.ts` | document |
| `artifact/spec.ts` | document |
| `artifact/types.ts` | document |
| `artifact/ui.ts` | document |
| `artifact/ux-handoff.ts` | document |
| `artifact/ux-inputs.ts` | document |
| `artifact/ux.ts` | document |
| `artifact/validate-schema.ts` | document |
| `artifact/verification-tables.ts` | document |
| `attempt/crud.ts` | execution |
| `attempt/lease.ts` | execution |
| `attempt/repair-types.ts` | execution |
| `attempt/repair-validation.ts` | execution |
| `attempt/settlement.ts` | execution |
| `attempt/types.ts` | execution |
| `attempt/validation.ts` | execution |
| `configuration/network-policy.ts` | configuration |
| `configuration/read-tool-config.ts` | configuration |
| `configuration/storage-paths.ts` | 分割：設定2定数・config固定所在→configuration内部／実行State・tmp→execution内部／tests等→既存の検証Owner |
| `configuration/types.ts` | configuration |
| `configuration/validate-declarations.ts` | configuration |
| `decision/crud.ts` | execution |
| `decision/operations.ts` | execution |
| `decision/request.ts` | execution |
| `decision/types.ts` | execution |
| `identity/validation.ts` | execution |
| `meeting/create-operations.ts` | document |
| `meeting/markdown.ts` | document |
| `meeting/types.ts` | document |
| `objective/crud.ts` | execution |
| `objective/request.ts` | execution |
| `objective/types.ts` | execution |
| `objective/validation.ts` | execution |
| `plain-data/json.ts` | 分割：設定JSON→configuration内部／CLI・HTTP・IPC→Co／WB等の既存入力Owner内部。Model汎用公開は撤去 |
| `plain-data/secret-validation.ts` | execution |
| `plain-data/snapshot.ts` | 分割：configuration／executionの入力検査とCo／WB／MCPの各入口へ、必要なdata-property検査だけ局所化 |
| `project-context/candidate-decision.ts` | document |
| `project-context/inspect.ts` | document |
| `project-context/parse-context.ts` | document |
| `project-context/parse-quality.ts` | document |
| `project-context/parse-release.ts` | document |
| `project-context/portfolio.ts` | document |
| `project-context/read-context.ts` | document |
| `project-context/source-projection.ts` | document |
| `project-context/types.ts` | document |
| `quality-change-control/gate.ts` | document |
| `reality-traceability/annotations.ts` | document |
| `reality-traceability/catalog.ts` | document |
| `reality-traceability/discover.ts` | document |
| `reality-traceability/graph.ts` | document |
| `reality-traceability/issue.ts` | document |
| `reality-traceability/manifest.ts` | document |
| `reality-traceability/validate-manifest.ts` | document |
| `repository/create-observer.ts` | document |
| `repository/filesystem-observer.ts` | document |
| `repository/observe-symbols.ts` | document |
| `repository/path.ts` | execution |
| `repository/require-storage-area.ts` | 分割：実行保存の公開失敗契約はexecution/runtime-resultへ／requireReadyは各固定保存Owner内部。CM由来型参照を除去 |
| `repository/resolve-storage-paths.ts` | 分割：設定固定Pathはconfiguration内部／State・一時操作はexecution内部／CROS配置はAM内部／他領域は既存の利用Owner内部。一括Path公開は撤去 |
| `repository/types.ts` | 分割：文書観測5型→document／実行保存観測→execution内部／設定観測→configuration内部／CROS入力→AM内部／VC別名→撤去 |
| `semantic/coverage.ts` | document |
| `semantic/ir.ts` | document |
| `semantic/publish.ts` | document |
| `semantic/relations.ts` | document |
| `state/activity.ts` | execution |
| `state/codec.ts` | execution |
| `state/crud.ts` | execution |
| `state/history.ts` | execution |
| `state/projection-types.ts` | execution |
| `state/projection.ts` | execution |
| `state/query.ts` | execution |
| `state/transition.ts` | execution |
| `state/types.ts` | execution |
| `state/validation.ts` | execution |
| `storage/ai-selection.ts` | configuration |
| `storage/ensure-area.ts` | 分割：config確保→configuration内部／State初期化・tmp→execution内部／保護Mount・Lease・EI等→Co等の既存Owner内部。汎用Model公開は撤去 |
| `storage/file-snapshot.ts` | 分割：EM／CM／AM各保存とCo CLI／WB検証の内部読取りへ必要部分を局所化。公開共有Helperは撤去 |
| `storage/network-policy.ts` | configuration |
| `storage/root-and-lock.ts` | 分割：config保存はconfiguration内部／AM StoreのRoot・排他接続とRoot型はAM正本。generic3関数のRoot公開は撤去 |
| `storage/runtime-history.ts` | execution |
| `storage/runtime-kernel-lock.ts` | execution |
| `storage/runtime-lock.ts` | execution |
| `storage/runtime-repository.ts` | execution |
| `storage/runtime-result.ts` | execution |
| `storage/runtime-store.ts` | execution |
| `storage/semantic-store.ts` | document |
| `storage/state.ts` | execution |
| `storage/temporary-operation.ts` | execution |
| `storage/topic-meeting-store.ts` | document |
| `storage/types.ts` | execution |
| `task/crud.ts` | execution |
| `task/queue.ts` | execution |
| `task/types.ts` | execution |
| `task/validation.ts` | execution |
| `test-catalog/inspect.ts` | document |
| `test-catalog/plan.ts` | document |
| `topic/create-operations.ts` | document |
| `topic/markdown.ts` | document |
| `topic/types.ts` | document |
| `workspace/command.ts` | execution |
| `workspace/crud.ts` | execution |
| `workspace/result.ts` | execution |
| `workspace/types.ts` | execution |
| `workspace/validation.ts` | execution |

## 9. index.tsの移管候補

分離前の基準Rootは721 Symbol（値480・型241）。以下は文書294、実行371、構成25の総690 Symbolである。値には定数・検査・例外クラスも含むため、操作関数の数ではない。実装時の全Consumer型検査で確定する候補であり、公開最小化完了とは主張しない。

3モデル間の再exportは0。Rootから除いた31 Symbolの処置を次節へ記す。Root候補に出ない内部型を、他モデルの型として再exportしない。

### document-model/src/index.ts

```ts
export {
  federateTopicMeetingRelations,
  type TopicMeetingRelationSource,
} from "./activity/federate-relations.ts";
export {
  validateTopicMeetingListInput,
} from "./activity/operations.ts";
export type {
  MeetingOutcomeCommandResult,
  MeetingOutcomeTarget,
  ProjectOperationRecord,
  ProjectOperationRecordKind,
  TopicMeetingAccess,
  TopicMeetingDocument,
  TopicMeetingListQuery,
  TopicMeetingListResult,
  TopicMeetingPage,
  TopicMeetingRelation,
  TopicMeetingRepository,
  TopicMeetingWriteResult,
  TopicPromotionCommandResult,
} from "./activity/types.ts";
export {
  omitMarkdownFencedCode,
  parseMarkdownAnchors,
} from "./artifact/anchors.ts";
export {
  type ArchitectureBodyModel,
  type ArchitectureCrossModelIndex,
  inspectArchitectureAnalysis,
  inspectArchitectureCrossModel,
  inspectArchitectureCrossModelIndex,
  inspectArchitectureDefinition,
  inspectArchitectureDetailTemplate,
} from "./artifact/architecture.ts";
export {
  type ArchitectureDetailCoverageRequest,
  type ArchitectureDetailMapModel,
  type ArchitectureDetailModel,
  inspectArchitectureDetail,
  inspectArchitectureDetailCoverage,
  inspectArchitectureDetailMap,
} from "./artifact/architecture-details.ts";
export {
  type ArchitectureAnalysisCoverageRequest,
  type ArchitectureRegistryModel,
  type ArchitectureRelationsRequest,
  inspectArchitectureAnalysisCoverage,
  inspectArchitectureComponentCoverage,
  inspectArchitectureRegistryCoverage,
  inspectArchitectureRelations,
  parseArchitectureRegistry,
} from "./artifact/architecture-relations.ts";
export {
  inspectChangeDocument,
  isChangeNavigationInvalid,
  isChangeTemplateInvalid,
  parseChangeTraceHeader,
} from "./artifact/change.ts";
export {
  inspectEvaluatedChecklist,
  inspectTemplateChecklist,
} from "./artifact/checklist.ts";
export {
  inspectDiscoveryAnalysis,
  inspectDiscoveryDefinition,
  parseAdoptedDiscoveryRequirements,
} from "./artifact/discovery.ts";
export {
  inspectRelatedOrder,
  parseCanonicalReleaseHeader,
} from "./artifact/document-header.ts";
export {
  type ArtifactGraph,
  type ArtifactGraphResult,
  type BuildArtifactGraphRequest,
  buildArtifactGraph,
} from "./artifact/graph.ts";
export {
  type IaAnalysisModel,
  type IaDefinitionModel,
  type IaIndexModel,
  inspectIaAnalysis,
  inspectIaAnalysisCoverage,
  inspectIaCrossProjection,
  inspectIaDefinition,
  inspectIaIndexCoverage,
  inspectIaRelations,
  parseIaIndex,
} from "./artifact/ia.ts";
export {
  inspectDiscoveryIdentityLinks,
  inspectStableIdentityDefinitions,
  inspectStableIdentityOwnership,
  parseStableIdentityOccurrences,
} from "./artifact/identity.ts";
export {
  inspectArtifactSources,
} from "./artifact/inspect.ts";
export {
  parseMarkdownLinkReference,
  parseMarkdownLinkTargets,
} from "./artifact/links.ts";
export {
  isMarkdownTableSeparator,
  omitMarkdownCommentsAndFencedCode,
  omitMarkdownCommentsOutsideFencedCode,
  parseMarkdownFences,
  parseMarkdownTableRow,
  readCanonicalDocumentHeader,
} from "./artifact/markdown.ts";
export {
  parseMarkdownArtifact,
} from "./artifact/parse-markdown.ts";
export {
  createPhaseChecklistItems,
} from "./artifact/phase-checklists.ts";
export {
  inspectPhaseDiagramTemplates,
  phaseDiagramTemplatePaths,
} from "./artifact/phase-diagrams.ts";
export {
  inspectQualityAnalysis,
  inspectQualityCrossModelGoals,
  inspectQualityDetailUnits,
  parseQualityCoverageSections,
} from "./artifact/quality-analysis.ts";
export {
  inspectQualityDefinition,
  inspectQualityLocalItemOwnership,
  type QualityDefinitionModel,
  type QualityLocalItemOwnershipModel,
} from "./artifact/quality-definition.ts";
export {
  hasQualityOpenChecklist,
  inspectQualityCenterState,
  inspectQualityRealityState,
} from "./artifact/quality-readiness.ts";
export {
  inspectQualityDefinitionRelations,
  inspectQualityGoalLocalRelations,
  inspectQualityLocalItemRelations,
  isQualityLocalItemCountInvalid,
  parseQualityDetailHandoff,
} from "./artifact/quality-relations.ts";
export {
  inspectQualityDesignStates,
} from "./artifact/quality-state.ts";
export {
  isQualityAnalysisTemplateInvalid,
  isQualityIntegrationTemplateInvalid,
  isQualityVerificationResultTemplateInvalid,
} from "./artifact/quality-templates.ts";
export {
  inspectCanonicalDocumentVersions,
  inspectChangelogRelease,
  inspectStableCanonicalDocuments,
  inspectStableChangelog,
  inspectStableReadme,
  inspectStableReleaseHeader,
  parseCandidateVersionHeader,
  parseReadmeVersion,
} from "./artifact/release.ts";
export {
  inspectSpecAnalysis,
  inspectSpecAnalysisCoverage,
  inspectSpecCoverage,
  inspectSpecDefinition,
  inspectSpecDefinitionCoverage,
  inspectUiSpecRelations,
  parseSpecIndex,
  parseUiSpecPairs,
  type SpecAnalysisModel,
  type SpecDefinitionModel,
  type SpecIndexModel,
} from "./artifact/spec.ts";
export {
  inspectSpecCorrespondence,
  inspectSpecCorrespondencePairEvidence,
  parseSpecCorrespondencePair,
  parseSpecCorrespondenceRevision,
  type SpecCorrespondencePair,
} from "./artifact/spec-correspondence.ts";
export {
  inspectSpecDetailCorrespondence,
  inspectSpecDetailDownstream,
  inspectSpecDetailIndex,
  parseSpecDetailAreaOwnership,
  parseSpecDetailCentralTrace,
  parseSpecDetailDefinitionOwnership,
  parseSpecScreenRelations,
  parseUiDetailBindings,
  type SpecDetailAreaOwnership,
  type SpecDetailCentralTrace,
  type SpecDetailDefinitionOwnership,
  type SpecDetailDownstreamRequest,
} from "./artifact/spec-details.ts";
export type {
  ArtifactModel,
  ArtifactRelation,
  ArtifactSection,
  ArtifactSource,
  ChecklistFailure,
  ChecklistResult,
  MarkdownFence,
  MarkdownFenceLine,
  MarkdownLinkReference,
  SourceLocation,
  UxFormalInputTarget,
} from "./artifact/types.ts";
export {
  inspectUiAnalysis,
  inspectUiAnalysisCoverage,
  inspectUiDefinition,
  inspectUiDetail,
  inspectUiIndexCoverage,
  inspectUiRelations,
  parseUiIndex,
  type UiIndexModel,
  type UiRelationsModel,
} from "./artifact/ui.ts";
export {
  inspectUxAnalysis,
  inspectUxDefinition,
  inspectUxFormalInput,
  inspectUxRelations,
  isUxProjectionIncomplete,
  parseUxIndex,
  parseUxJourneyRelations,
  type UxAnalysisModel,
  type UxFormalInputObservation,
  type UxIndexModel,
} from "./artifact/ux.ts";
export {
  isUxHandoffTargetSetExact,
  isUxRootHandoffValid,
} from "./artifact/ux-handoff.ts";
export {
  parseUxFormalInputTargets,
} from "./artifact/ux-inputs.ts";
export {
  type ArtifactSchema,
  type ArtifactSchemaValidationResult,
  validateArtifactSchema,
} from "./artifact/validate-schema.ts";
export {
  inspectBranchCoverageTable,
  inspectRemediationTable,
} from "./artifact/verification-tables.ts";
export {
  createMeetingOperations,
} from "./meeting/create-operations.ts";
export {
  applyMeetingOutcomeTreatment,
  parseMeetingMarkdown,
} from "./meeting/markdown.ts";
export type {
  MeetingOperations,
  MeetingOutcomeDisposition,
  MeetingOutcomeTreatment,
  MeetingRecord,
  MeetingState,
} from "./meeting/types.ts";
export {
  type DomainIssue,
  type DomainLocation,
  type DomainOutcome,
  type DomainStatus,
  validateDomainOutcome,
} from "./outcome.ts";
export {
  applyProjectOperationCandidateDecision,
} from "./project-context/candidate-decision.ts";
export {
  isProjectContextManifestIdentityInvalid,
  isProjectContextProjectionInvalid,
} from "./project-context/inspect.ts";
export {
  parseRepositoryProjectContextMarkdown,
} from "./project-context/parse-context.ts";
export {
  parseRepositoryQualityProjectionMarkdown,
} from "./project-context/parse-quality.ts";
export {
  parseRepositoryReleaseProjectionMarkdown,
} from "./project-context/parse-release.ts";
export {
  createPortfolioProjection,
  type FederatedProjectProjection,
  type FederatedProjectSource,
  type PortfolioProjection,
  type ProjectContextSource,
} from "./project-context/portfolio.ts";
export {
  readRepositoryProjectContext,
} from "./project-context/read-context.ts";
export {
  projectProjectOperationSources,
} from "./project-context/source-projection.ts";
export type {
  ProjectOperationCandidate,
  ProjectOperationCandidateDecision,
  ProjectOperationCandidateDecisionResult,
  ProjectOperationProjection,
  ProjectOperationProjectionItem,
  ProjectOperationSource,
  ProjectOperationSourceState,
  RepositoryProjectContext,
  RepositoryProjectContextReadResult,
  RepositoryProjectContextScene,
  RepositoryProjectContextSceneKey,
  RepositoryProjectContextTable,
  RepositoryQualityProjection,
  RepositoryReleaseDependency,
  RepositoryReleaseProjection,
  RepositoryReleaseScope,
} from "./project-context/types.ts";
export {
  type FixedQualityCandidate,
  fixQualityCandidate,
  type IntegratedQualityGate,
  integrateQualityGate,
  type QualityCheckResult,
  type QualityCheckStatus,
  reenterQualityReview,
} from "./quality-change-control/gate.ts";
export {
  inspectRealityTestCatalog,
} from "./reality-traceability/catalog.ts";
export {
  discoverRealitySymbols,
  type RealitySymbolDiscoveryRequest,
  type RealitySymbolDiscoveryResult,
  type RealitySymbolDiscoverySource,
} from "./reality-traceability/discover.ts";
export {
  createRealitySymbolGraph,
  type RealitySymbolGraph,
  type RealitySymbolNode,
} from "./reality-traceability/graph.ts";
export {
  type LoadedRealitySymbolManifest,
  type RealitySymbol,
  type RealitySymbolKind,
  type RealitySymbolManifest,
  realitySymbolKinds,
} from "./reality-traceability/manifest.ts";
export {
  validateRealitySymbolManifest,
} from "./reality-traceability/validate-manifest.ts";
export {
  createFilesystemRepositoryObservationPort,
} from "./repository/create-observer.ts";
export {
  observeRealitySymbolRepository,
  type RealityRepositoryObservationIssue,
  type RealitySymbolRepositoryObservation,
} from "./repository/observe-symbols.ts";
export type {
  RepositoryDirectoryEntry,
  RepositoryDirectoryObservation,
  RepositoryEntryKind,
  RepositoryFileObservation,
  RepositoryObservationPort,
} from "./repository/types.ts";
export {
  createSemanticBundle,
  createSemanticCoverageGraph,
  type SemanticBundleContent,
  type SemanticCoverageBundle,
  type SemanticCoverageGraph,
  type SemanticCoverageProjection,
} from "./semantic/coverage.ts";
export {
  compileSemanticIr,
  type SemanticIr,
  type SemanticIrMeaning,
  type SemanticSourceDocument,
} from "./semantic/ir.ts";
export {
  type PublishSemanticCoverageRequest,
  type PublishSemanticCoverageResult,
  publishSemanticCoverage,
} from "./semantic/publish.ts";
export {
  compileQualitySemanticRelations,
  type QualitySemanticRelation,
} from "./semantic/relations.ts";
export {
  createFilesystemSemanticBundlePublisher,
  type SemanticBundlePublisher,
  type SemanticBundlePublishReceipt,
  type SemanticBundlePublishRequest,
} from "./storage/semantic-store.ts";
export {
  discoverRepositoryTestFiles,
  inspectResourceIntensiveTestAuthority,
  inspectTestCatalog,
  loadTestCatalog,
  type ResourceIntensiveTestAuthority,
  selectRegressionStaticOwners,
  selectRegressionTests,
  type TestCatalog,
  type TestCatalogEntry,
  type TestLevel,
  testLevels,
} from "./test-catalog/inspect.ts";
export {
  aggregateRegressionStageResults,
  buildRegressionStagePlan,
  normalizeExplicitChangedPaths,
  type RegressionAggregateResult,
  type RegressionExecutionStep,
  type RegressionPlanEntry,
  type RegressionStage,
  type RegressionStagePlan,
  type RegressionStageResult,
  regressionStageOrder,
} from "./test-catalog/plan.ts";
export {
  createTopicOperations,
} from "./topic/create-operations.ts";
export {
  applyTopicPromotion,
  parseTopicMarkdown,
} from "./topic/markdown.ts";
export type {
  TopicOperations,
  TopicPromotion,
  TopicRecord,
  TopicState,
} from "./topic/types.ts";
```

### execution-model/src/index.ts

```ts
export type {
  TaskExecutionSelections,
} from "./task/types.ts";
export {
  inspectTaskExecutionSelections,
} from "./task/validation.ts";
export {
  applyCoordinatorResourceCleanup,
  applyCoordinatorResourceEvent,
} from "./attempt/crud.ts";
export {
  prepareCoordinatorLeaseAcquisitionConfirmation,
  prepareCoordinatorLeaseAcquisitionReservation,
  prepareCoordinatorLeaseRecoveryReservation,
  prepareCoordinatorLeaseRecoverySettlement,
  prepareCoordinatorLeaseReleaseIntent,
  prepareCoordinatorLeaseReleaseSettlement,
  prepareCoordinatorReleasedLeaseReconciliation,
  projectCoordinatorLeaseAcquisitionOwner,
  projectCoordinatorLeaseOwnerLossState,
} from "./attempt/lease.ts";
export type {
  DockerRuntimeRepairCheckpoint,
  DockerRuntimeRepairDisposalCheckpoint,
  DockerRuntimeRepairRetentionTargets,
} from "./attempt/repair-types.ts";
export {
  decodeDockerRuntimeRepairCheckpoint,
  decodeDockerRuntimeRepairDisposalCheckpoint,
  decodeDockerRuntimeRepairRetentionTargets,
  dockerRuntimeRepairCheckpointIsSettled,
  dockerRuntimeRepairDisposalIsSettled,
  prepareDockerRuntimeRepairSessionCheckpoint,
  RUNTIME_REPAIR_ACTIONS,
  RUNTIME_REPAIR_DIRECTORIES,
  validateDockerRuntimeRepairCheckpointTransition,
} from "./attempt/repair-validation.ts";
export {
  captureRuntimeOwnedCoordinatorSettlementInputs,
  completeRuntimeOwnedCoordinatorSettlement,
  prepareRuntimeOwnedCoordinatorSettlement,
  publishRuntimeOwnedCoordinatorHistory,
  readRuntimeOwnedCoordinatorSettlementResult,
  registerRuntimeOwnedCoordinatorSettlementResultDeliveries,
  settleRuntimeOwnedCoordinatorResult,
  writeRuntimeOwnedCoordinatorHistoryCheckpoint,
} from "./attempt/settlement.ts";
export type {
  CoordinatorRepairRetentionReceipt,
  CoordinatorResourceBook,
  CoordinatorStateOperation,
  CoordinatorStateRepairOperation,
  CoordinatorStateTaskOperation,
  DockerRestartCheckpoint,
  TurnCountDiagnostic,
} from "./attempt/types.ts";
export {
  coordinatorAuthenticationClosureEvidence,
  coordinatorAuthenticationUnknownCanClose,
  coordinatorOperationNonce,
  coordinatorRepairCanComplete,
  coordinatorRepairCanSummarize,
  coordinatorRepairHistoryLineBytes,
  coordinatorRepairRetentionMatchesCheckpoint,
  coordinatorRepairSummaryBytes,
  coordinatorTaskResourcesAreSettled,
  createDockerRestartRequestId,
  decodeDockerRestartCheckpoint,
  dockerProcessControllerPublicCompletionReasons,
  isDockerRestartCheckpointSettled,
  PROVIDER_ADVICE_OUTPUT_REASONS,
  parseDockerTaskRecoveryId,
  parseHostRecoveryToken,
  purposeResource,
  validateCoordinatorResourceBook,
  validateCoordinatorResourceBookTransition,
  validateHostRecoveryTransitionLineage,
  validCoordinatorOutcome,
  validCoordinatorPrimaryFailure,
  validCoordinatorRepairOperation,
  validCoordinatorRepairRetentionReceipt,
  validCoordinatorRepairSummary,
} from "./attempt/validation.ts";
export {
  COORDINATOR_HUMAN_DECISION_CONTRACT,
  type CoordinatorDecisionRequest,
  type CoordinatorDecisionResult,
  inspectCoordinatorDecisionRequest,
  inspectCoordinatorDecisionResult,
} from "./decision/request.ts";
export type {
  CoordinatorAcceptanceDecision,
  CoordinatorAcceptanceDecisionInput,
  CoordinatorAcceptanceTarget,
  Decision,
  DecisionAnswer,
  DecisionRequest,
} from "./decision/types.ts";
export {
  createLocalPrincipalId,
  isPrincipalId,
} from "./identity/validation.ts";
export {
  COORDINATOR_OBJECTIVE_INTAKE_CONTRACT,
  type CoordinatorObjectiveRequest,
  inspectCoordinatorObjectiveRequest,
} from "./objective/request.ts";
export type {
  CoordinatorObjectivePlan,
  ProjectMilestoneRecord,
  ProjectMilestoneState,
  ProjectObjectiveDefinition,
  ProjectObjectiveRecord,
  ProjectObjectiveState,
} from "./objective/types.ts";
export {
  type ExecutionPlanScope,
  inspectCallerTaskInputs,
  inspectExecutionPlan,
} from "./objective/validation.ts";
export {
  containsRecognizedSecretMaterial,
  containsRecognizedSecretScope,
  containsRecognizedSecretText,
  describeSecretMaterialPolicyContract,
  isRecognizedSecretBearingPath,
  SECRET_MATERIAL_POLICY_CONTRACT,
  SECRET_MATERIAL_POLICY_CONTRACT_REVISION,
} from "./plain-data/secret-validation.ts";
export {
  normalizeRepositoryRelativePath,
} from "./repository/path.ts";
export {
  compareActivityEventPositions,
  decodeActivityCursor,
  deriveActivitySourceCorrelation,
  encodeActivityCursor,
  inspectRuntimeActivityObservation,
  parseRuntimeActivityObservation,
} from "./state/activity.ts";
export {
  encodeRuntimeStateValue,
  hashRuntimeStateContent,
} from "./state/codec.ts";
export {
  classifyCoordinatorRepairPublication,
  classifyCoordinatorResourcePublication,
  prepareCoordinatorAuthenticationUnknownClosureSnapshot,
  prepareCoordinatorRecoveredHistoryPublication,
  prepareCoordinatorRepairHistoryLine,
  prepareCoordinatorRepairHistoryPublication,
  prepareCoordinatorRepairHistorySnapshot,
  prepareCoordinatorRepairHistorySummary,
  prepareCoordinatorStateCleanupSnapshot,
  prepareCoordinatorStateCompletionSnapshot,
  prepareCoordinatorStateHistorySnapshot,
  prepareCoordinatorStateHostSnapshot,
  prepareCoordinatorStateLifecycleSnapshot,
  prepareCoordinatorStateOperationSnapshot,
  prepareCoordinatorStateReferencesSnapshot,
  prepareCoordinatorStateRepairCheckpointSnapshot,
  prepareCoordinatorStateRepairCompletionSnapshot,
  prepareCoordinatorStateRepairDisposalDecisionSnapshot,
  prepareCoordinatorStateRepairDisposalProgressSnapshot,
  prepareCoordinatorStateRepairRetentionHandoffSnapshot,
  prepareCoordinatorStateRepairSessionSnapshot,
  prepareCoordinatorStateRepairSnapshot,
  prepareCoordinatorStateResourceSnapshot,
  prepareCoordinatorStateRestartSnapshot,
  prepareCoordinatorStateResultDeliverySnapshot,
  projectCoordinatorCurrentState,
  projectCoordinatorQueueProjectState,
  validateCoordinatorStateRepairDisposalTransition,
  validateCoordinatorStateRepairRetentionHandoffTransition,
  validateCoordinatorStateRepairSessionTransition,
  validateCoordinatorStateTransition,
} from "./state/crud.ts";
export {
  decodeCoordinatorHistoryRows,
  prepareCoordinatorHistoryPending,
  prepareCoordinatorHistoryRetention,
  prepareCoordinatorHistoryTransfer,
  prepareCoordinatorTerminalRecordRetirement,
} from "./state/history.ts";
export {
  COORDINATOR_PUBLIC_RUNTIME_CONTRACT,
  inspectCoordinatorProjection,
  inspectCoordinatorStateQueryResult,
  isCoordinatorObjectiveProjectionCorrelationValid,
  isCoordinatorProjectionSemanticallyValid,
  PROJECT_OBJECTIVE_STATES,
  PROJECT_TASK_STATES,
} from "./state/projection.ts";
export type {
  ActivityRepository,
  ActivitySource,
  CoordinatorProjection,
  CoordinatorStateQuery,
  CoordinatorStateQueryResult,
  RuntimeActivityEvent,
  RuntimeActivityObservation,
  RuntimeActivityRequest,
} from "./state/projection-types.ts";
export {
  COORDINATOR_STATE_QUERY_CONTRACT,
  inspectCoordinatorStateQuery,
} from "./state/query.ts";
export {
  assertCoordinatorSnapshotTransition,
  type CoordinatorSnapshotObservations,
  coordinatorAdoptionWasRejected,
  coordinatorQueueIsClosed,
  coordinatorRejectedAdoptionEvidenceCanRetire,
  coordinatorSnapshotIntakeMatches,
  coordinatorStandaloneAdoptionIsClosed,
  validateCoordinatorUnifiedTransition,
} from "./state/transition.ts";
export type {
  CoordinatorLeaseKind,
  CoordinatorSnapshot,
  CoordinatorState,
  CoordinatorStateSnapshot,
  CoordinatorStoredTask,
  CoordinatorTaskSettlementFact,
  CoordinatorUnifiedSnapshot,
  HistoryRow,
  LeaseEvidenceContent,
  LeaseEvidenceEnvelope,
  LeaseKind,
  RuntimeAccess,
  RuntimeDomainSnapshot,
  RuntimeManagedExecution,
  RuntimeProjectDefinition,
  RuntimeReadResult,
  RuntimeStateEnvelope,
  RuntimeWriteResult,
  StateVersion,
} from "./state/types.ts";
export {
  COORDINATOR_DURABLE_FOUNDATION_CONTRACT,
  COORDINATOR_PROJECT_SNAPSHOT_SCHEMA,
  COORDINATOR_STATE_CONTRACT,
  COORDINATOR_STATE_SCHEMA,
  coordinatorHistoryLineBytes,
  coordinatorOperationSummaryBytes,
  decodeRuntimeDomainSnapshot,
  hashRuntimeProjectDefinition,
  hashRuntimeStateValueText,
  hasRuntimeStateKeys,
  hasRuntimeStateRecordKeys,
  historyRow,
  isRuntimeStateObject,
  isSha256Hex,
  leaseAcquisitionRecoveryId,
  leaseIdentity,
  prepareCoordinatorStateHistoryLine,
  projectCoordinatorTaskSettlement,
  snapshotRuntimeStateArray,
  snapshotRuntimeStateRecord,
  validCoordinatorSnapshot,
  validCoordinatorTaskState,
  validId,
  validLeaseEvidence,
  validResultReference,
} from "./state/validation.ts";
export type {
  RuntimeExecutionStorageAccess,
  RuntimeSettlementStorageAccess,
} from "./storage/runtime-repository.ts";
export {
  advanceRuntimeOwnedCoordinatorRecoveryHistory,
  advanceRuntimeOwnedCoordinatorRepairHistory,
  answerDecision,
  applyDecision,
  checkpointRuntimeOwnedCoordinatorCleanup,
  checkpointRuntimeOwnedCoordinatorHost,
  checkpointRuntimeOwnedCoordinatorLifecycle,
  checkpointRuntimeOwnedCoordinatorReferences,
  checkpointRuntimeOwnedCoordinatorResource,
  checkpointRuntimeOwnedCoordinatorResourceNotIssued,
  checkpointRuntimeOwnedCoordinatorRestart,
  cleanupRuntimeOwnedCoordinatorStateMarker,
  closeCoordinatorUnstartedTaskQueue,
  closeDecision,
  completeRuntimeOwnedCoordinatorCurrentRecovery,
  completeRuntimeOwnedCoordinatorRepair,
  confirmCoordinatorLeaseAcquisition,
  createCoordinatorQueueEntry,
  createCoordinatorSingleTaskQueue,
  createObjective,
  createTask,
  deleteObjective,
  deleteTask,
  initializeCoordinatorSnapshot,
  initializeRuntimeState,
  maintainCoordinatorSnapshotRecords,
  observeRuntimeOwnedTransientTaskCompletion,
  queryDecisions,
  queryObjectives,
  queryPlan,
  queryQueue,
  queryRuntimeState,
  queryTasks,
  queryWorkspaces,
  readCoordinatorCurrentState,
  readCoordinatorExecutionState,
  readCoordinatorLeaseAcquisitionOwner,
  readCoordinatorLeaseOwnerLoss,
  readCoordinatorQueueEntry,
  readCoordinatorQueueProject,
  readCoordinatorSnapshotIntakeEpoch,
  readCoordinatorTaskIntakeState,
  readCoordinatorWorkspaceState,
  readDecision,
  readRuntimeOwnedCoordinatorAdmissionSnapshot,
  readRuntimeOwnedCoordinatorCurrentCompletionSnapshot,
  readRuntimeOwnedCoordinatorCurrentDeliverySnapshot,
  readRuntimeOwnedCoordinatorCurrentHistorySnapshot,
  readRuntimeOwnedCoordinatorHostCleanupRecoverySnapshot,
  readRuntimeOwnedCoordinatorRecoveryResult,
  readRuntimeOwnedCoordinatorRecoverySnapshot,
  readRuntimeOwnedCoordinatorRepairCompletionSnapshot,
  readRuntimeOwnedCoordinatorRepairHistorySnapshot,
  readRuntimeOwnedCoordinatorResourceBook,
  readRuntimeOwnedCoordinatorResourcePublicationSnapshot,
  readRuntimeOwnedCoordinatorStateSnapshot,
  reconcileCoordinatorReleasedLease,
  recordDecision,
  registerRuntimeOwnedCoordinatorRecoveryResultDelivery,
  requestDecision,
  reserveCoordinatorLeaseAcquisition,
  reserveCoordinatorLeaseRecovery,
  resumeRuntimeOwnedCoordinatorRepairPublication,
  resumeRuntimeOwnedCoordinatorResourcePublication,
  saveCoordinatorIntegrationRecord,
  saveCoordinatorLeaseReleaseIntent,
  saveCoordinatorManagedProject,
  saveCoordinatorWorkspaceRecord,
  savePlan,
  saveRuntimeOwnedCoordinatorHostCleanupPreparation,
  saveRuntimeOwnedCoordinatorOperationStart,
  selectCoordinatorQueueEntry,
  settleCoordinatorLeaseRecovery,
  settleCoordinatorLeaseRelease,
  settleCoordinatorQueueLeaseRelease,
  settleCoordinatorQueueRecovery,
  transferCoordinatorSnapshotHistoryRecords,
  updateCoordinatorQueueEntry,
  updateCoordinatorSingleTaskQueue,
  updateObjective,
  updateTask,
  verifyCoordinatorQueueIntake,
  writeRuntimeOwnedCoordinatorAuthenticationUnknownClosure,
  writeRuntimeOwnedCoordinatorRecoveredHostCleanup,
  writeRuntimeOwnedCoordinatorRecoveryCheckpoint,
  writeRuntimeOwnedCoordinatorRecoveryTerminal,
  writeRuntimeOwnedCoordinatorRepairSnapshot,
  writeRuntimeOwnedCoordinatorRestartCheckpoint,
} from "./storage/runtime-store.ts";
export {
  classifyRuntimeSnapshotReentry,
  createRuntimeStatePendingFile,
  flushRuntimeStateFile,
  type RuntimeStateFileName,
  type RuntimeStatePendingFileName,
  readRuntimeStateFile,
} from "./storage/state.ts";
export {
  createTemporaryOperation,
  resumeTemporaryOperation,
  settleTemporaryOperation,
  verifyTemporaryOperationEvidencePromotion,
} from "./storage/temporary-operation.ts";
export type {
  TemporaryEvidencePromotionReceipt,
  TemporaryOperationCapability,
  TemporaryOperationRecoveryReference,
} from "./storage/types.ts";
export {
  hasProjectTaskResultAcceptanceConflict,
  normalizeCoordinatorTaskProjects,
  prepareCoordinatorUnifiedTaskSections,
  prepareCoordinatorUnifiedTaskSnapshot,
  projectCoordinatorTaskSnapshot,
} from "./task/crud.ts";
export {
  inspectCoordinatorQueueIntake,
  prepareCoordinatorQueueEntryCreation,
  prepareCoordinatorQueueLeaseReleaseSettlement,
  prepareCoordinatorQueueOperationUpdate,
  prepareCoordinatorQueueRecoverySettlement,
  prepareCoordinatorQueueSelection,
  prepareCoordinatorSingleTaskQueueCreation,
  prepareCoordinatorSingleTaskQueueUpdate,
  prepareCoordinatorUnstartedTaskQueueClosure,
  projectCoordinatorQueueEntry,
} from "./task/queue.ts";
export type {
  CallerTaskInput,
  CoordinatorQueueEnqueueInput,
  ProjectDockerRecoveryAcknowledgement,
  ProjectQueueEntry,
  ProjectQueueState,
  ProjectResultAcceptance,
  ProjectTaskDefinition,
  ProjectTaskRecord,
  ProjectTaskRecoveryKind,
  ProjectTaskRecoveryObligation,
  ProjectTaskResultFact,
  ProjectTaskStartPhase,
  ProjectTaskState,
  SingleTaskRecord,
} from "./task/types.ts";
export {
  coordinatorConsumerCompletionPolicy,
  decodeProjectResultAcceptance,
  inspectSingleTaskRecord,
  validCoordinatorState,
  validQueueEntry,
} from "./task/validation.ts";
export {
  inspectWorkspaceCommand,
  type WorkspaceCommand,
} from "./workspace/command.ts";
export {
  prepareCoordinatorIntegrationRecordCreation,
  prepareCoordinatorWorkspaceRecordUpdate,
} from "./workspace/crud.ts";
export {
  inspectCoordinatorWorkspaceResults,
  snapshotCoordinatorWorkspaceResult,
} from "./workspace/result.ts";
export type {
  CoordinatorResultRecord,
  CoordinatorWorkspace,
  CoordinatorWorkspaceCandidate,
  CoordinatorWorkspaceResult,
  RepositoryWorktreeResult,
  WorkspaceCandidateRequest,
  WorkspaceCandidateResult,
} from "./workspace/types.ts";
export {
  COORDINATOR_INTEGRATION_CONTRACT,
  isWorkspaceCommitId,
  validCoordinatorResultRecord,
  validCoordinatorWorkspace,
  validWorkspaceCandidateRequest,
  validWorkspaceDisplayName,
} from "./workspace/validation.ts";
export type { ExecutionSelection } from "./task/types.ts";
export {
  hashExecutionSelection,
  inspectExecutionSelection,
} from "./task/validation.ts";
export {
  RepositoryRuntimeDataAreaBlockedError,
} from "./storage/runtime-result.ts";
```

### configuration-model/src/index.ts

```ts
export {
  inspectAiSelectionChoice,
  validateAiSelectionConfig,
} from "./ai-selection/validation.ts";
export {
  readRepositoryAiSelection,
  saveRepositoryAiSelection,
} from "./storage/ai-selection.ts";
export { readNetworkPolicy } from "./storage/network-policy.ts";
export {
  readCoordinatorConfig,
  readExecutionIntelligenceConfig,
} from "./configuration/read-tool-config.ts";
export {
  inspectCrosTrustPolicy,
  inspectRepositoryManifest,
} from "./configuration/validate-declarations.ts";
export {
  EXTERNAL_SEND_POLICY_RELATIVE_PATH,
  REPOSITORY_MANIFEST_RELATIVE_PATH,
} from "./configuration/storage-paths.ts";
export type {
  AiSelectionCatalog,
  AiSelectionChoice,
  AiSelectionConfig,
  AiSelectionRole,
  AiSelectionSnapshot,
} from "./ai-selection/types.ts";
export type { AiSelectionConfigResult } from "./ai-selection/validation.ts";
export type {
  AiSelectionReadResult,
  AiSelectionSaveResult,
} from "./storage/ai-selection.ts";
export type { NetworkPolicy } from "./configuration/network-policy.ts";
export type { NetworkPolicyReadResult } from "./storage/network-policy.ts";
export type {
  CrosTrustPolicy,
  RepositoryManifest,
  ToolRuntimeConfig,
  ToolRuntimeConfigResult,
} from "./configuration/types.ts";
```

## 10. 旧Rootから外す31 Symbolの追従

単にexportを隠すのではなく、下表の実Ownerと利用側を同時に変更する。Rootから外れても、保存Result内の未確認情報や正本Schema値を削除しない。

| Symbol | 処置 |
|---|---|
| `ModelSelection` | AD正本をConsumerが直接参照 |
| `Provider` | AD正本をConsumerが直接参照 |
| `ReasoningEffort` | AD正本をConsumerが直接参照 |
| `TESTS_RELATIVE_PATH` | 現Coの検証記録Script内の固定配置へ |
| `CROS_DIRECTORY_ID` | CROSのPath計算に必要な形式条件はAM初期化内部、宣言検査に必要なものは構成内部 |
| `CROS_TRUST_POLICY_SCHEMA` | 構成モデルの宣言検査内部。保存Schema値は不変更 |
| `REPOSITORY_MANIFEST_SCHEMA` | 構成モデルのManifest検査内部。保存Schema値は不変更 |
| `parseUnambiguousJsonDocument` | 設定Reader／Co CLI／WB HTTP・IPCの各入力Owner内部 |
| `snapshotPlainArray` | 実行／設定／Co／WB／MCPの各入力Owner内部 |
| `snapshotPlainRecord` | 実行／設定／Co／WB／MCPの各入力Owner内部 |
| `requireReadyRepositoryRuntimeDataArea` | 各固定保存Owner内部。未知・部分Effectを未実施へ畳まない |
| `observeRepositoryRuntimeDataArea` | 設定／実行保存／Co Lease／EI接続等の各固定対象観測へ |
| `resolveCrosRuntimeRoots` | 実本番ConsumerであるAM initialization/root.ts内部 |
| `resolveRepositoryRuntimeDataPaths` | 全Path集合の配布は撤去。各保存OwnerがVC Rootから自分の固定所在だけ構成 |
| `resolveRepositoryRuntimeDataPathsFromWorkingDirectory` | 本番利用なし。撤去。必要なConsumerはVCでRoot確定後にOwner完成操作へ |
| `CrosRootInput` | AMの既存Host初期化内部。CM型にしない |
| `RepositoryRootCapability` | VCのRepositoryを直接参照。別名再公開は撤去 |
| `RepositoryRuntimeArea` | 汎用Area enum公開撤去。各固定対象の内部契約へ |
| `RepositoryRuntimeDataAreaObservation` | 各保存Ownerの固定対象観測へ局所化。必要な公開結果のfieldを省略しない |
| `AiSelectionTemporaryReference` | AiSelectionSaveResultの未確認参照として保持。単独Root再exportだけ撤去 |
| `checkRepositoryRuntimeDataProtectionDirectory` | Co execution/operation.tsの保護Mount準備内部へ |
| `createCoordinatorRuntimeDataArea` | 実行モデルstorage/ensure-area.ts内部。本番外部Consumerなし |
| `ensureRepositoryRuntimeDataArea` | 各固定保存Ownerの準備＋VC Ignore登録に接続 |
| `ensureRepositoryRuntimeDataAreaFromWorkingDirectory` | Co Lease／Visual Preview等の既存Owner内へ。汎用Wrapperは撤去 |
| `readStableFileSnapshot` | 各保存／入力Owner内部の対象File読取りへ |
| `StableFileIdentity` | 各Owner内部の必要なIdentity定義へ。型が公開Result内で必要な場合は当該Resultから参照 |
| `sameStableFileIdentity` | 各Owner内部の実体比較へ |
| `createFilesystemStoreRoot` | AMの既存初期化と構成の設定保存内部へ。generic Factoryの再公開はしない |
| `FilesystemStoreRoot` | AMが正本として公開する必要型へ。構成は独立した私有Rootを使用 |
| `resolveFilesystemStorePath` | AM／構成それぞれの固定Store内部へ |
| `withFilesystemStoreLock` | AM／構成の既存保存処理から共通Lockへ直接接続 |

AMと構成のopaque Rootは別の私有保存対象であり、相互交換しない。AMのRoot型はMCP／WorkbenchまでAM正本で搬送し、構成保存はRepository Capabilityから自己のconfig境界を内部で確定する。既存の物理Lock Path・Hash namespace・Owner／Generation・回復参照は局所化を理由に変えない。

## 11. 設計確認と実装へのGate

今回の設計是正では、従来案の「実行→構成」「文書→構成」と共通保存Helperの構成Root配布を撤回する。前版の独立レビュー結果は、この変更後の依存0・Input変更の成立根拠へ流用しない。

実装着手前には、Source137件・Root721件と本案の各Owner／31除外処置を照合する。特に、Root単体のRecovery要求、10箇所の設定再読取り、AM Root型の搬送、例外のinstanceof投影、namespace／dynamic import／Sourceパス文字列を対象に含める。

限定検証の計画は次のとおり。今回の設計編集では実行しない。

1. 各モデル／全Consumerの型検査と、モデル間import・再export・package依存・生成型参照0の確認。
2. 文書3期待値、Config→AD→実行入力の投影、保持設定の初回拒否／途中変更／同値／再入場の契約試験。
3. Owner局所化したI/Oと入力検査の正常／異常、State／History／CAS、AM Root・Lock、元例外の失敗情報投影。
4. 既存Repository-local試験・Consumer結合・台帳とSource一覧の同期、および固定候補の独立レビュー。

まだ実装・package分離・型検査・回帰・保存移行の成立を示さない。実AI・Docker・全体回帰・過去保持物の操作はしない。

## 12. 今回の設計確認結果

読取り専用の独立レビューで、保持設定を基底Inputへ一律要求すると通常Query／非履歴Recoveryへ新しい停止条件が生じる指摘を受けた。Section3・6・7へ適用範囲と対照試験を反映し、更新候補を再レビューした。設計候補の必須残指摘は0件。

Source移管表137件、Root候補294／371／25の総690件・重複0、旧Rootから外す31件の全処置を確認した。実装時はCallbackへ期待日数の引数を渡した事実だけで再検証成立とせず、各本番Consumerが実際に現在値と比較することを元の10確認位置に対応する設定変更の負例で確認する。

上記は実装着手前の設計確認時点の結果である。後続の製品Source・試験の変更と検証は次節の実装状況へ記録する。上記は設計の確認結果で、移管後の型検査・限定回帰や全体成立の結果ではない。

## 13. 実装状況

3パッケージのSource・package設定・公開入口と、利用側のimport／Input搬送を切り替えた。旧domain-modelの追跡対象Source・試験・package設定・Symbol台帳は撤去し、互換Facadeは設けていない。各モデル間の型・実装・再export・package依存は0である。

設定の固定config保存、実行State／tmp、文書保存、AM Root、Co／WB／MCP／検証Scriptの入力・I/Oを各Ownerへ閉じた。初期化の内部処理は実行モデルの既存ensure-area.tsに保持する。Snapshot・History・CAS、保存先、Lock Identity、失敗と回復参照の意味は変更しない。

公開は文書294／実行371／構成25の計690 Symbol。試験台帳は411件へ追従し、正式QAとの対応を照合した。限定回帰の途中で検出した旧Fixture接続・旧容量期待・実際のI/Oに届かない故障注入も是正している。

検証結果・失敗の切分け・独立レビューの状態は[今回の検証記録](Evidence/261112_model-package-split-verification.md)を参照する。全体回帰・実AI・Docker・過去保持物の操作は実施していない。実装の区切りをCHG全体完了やリリース可能へ拡大しない。

## 14. 実行モデルの完成操作への再編 — 2026-11-12

基準は`639730463`。人間が採用した65関数案を、既存267公開物の削減・利用側接続・内部責務移管と一体で実装する。先行の24 Source整理と267項目への縮減結果は基準Capabilityの根拠であり、今回の変更後の成立証拠へ流用しない。現在は実装中であり、65入口・限定回帰・独立レビュー完了をまだ主張しない。

| 編集単位 | Ownerと処置 | 保持条件・確認 |
|---|---|---|
| 公開要求・表示契約 | Objective要求、判断操作要求／応答、状態照会／投影、WorkspaceCommand、活動一覧をCoordinatorの既存Ownerへ移管 | EMからCoordinatorへの実装・型依存0。保存モデルと保存用契約値はEM内部に保持 |
| 開始・終了 | 既存開始保存へ元の終端相関準備を接続し、入力固定は完成終了操作へ統合 | 開始保存済みでも準備失敗ならHost開始禁止。同じexact回復参照と保存Effectを返す。入力受理と保存確定を分け、元結果参照の再入場を維持 |
| Checkpoint・回復 | 用途固定の更新をlive／回復別の完成入口へ統合 | 必須情報を持つ判別入力。任意Snapshot・Optional集合を公開しない。Host事前検査→Authority消費→保存の順序を維持 |
| Queue・Lease | Queueの受付／更新、Leaseの取得／解放／回復へ同じモデル内の保存を集約 | 保存前Intentと物理処置後の観測を別入力とし、物理Lock・Process観測はCoordinatorに残す。元版・Owner・Generation・IDを保持 |
| Reader・履歴 | 用途固定の観測と完了操作へ内部段階を閉じる | live／回復／ACK前fresh読取りの権限差、不存在・pending不存在・unknownを区別。履歴件数・余剰行・相関の独立Oracleを維持 |
| 命名・Helper | EM内のCoordinator／Runtime由来識別子を意味に応じて改名し、不要なRoot公開を撤去 | 宣言元と全Consumerを同時変更。旧名Wrapper、別名再export、テストのdeep import迂回を作らない。Arrayは利用側の引数・失敗理由を照合 |

変更分類はPackage公開契約と内部責務の非自明な再編である。既存Architecture・QA・台帳・Co／Workbench／MCP／Script／試験を影響母集団とし、実装・利用側・保存安全性の独立レビューと文書／影響確認を実施する。準拠基準・決定権限・Releaseを変更しないため、準拠監査とRelease操作は対象外。着手前の読取り専用整合確認は着手可で、追加人間判断はない。

保存Schema・Path・field・contract値・Lock／Hash namespace・reason・IPC・既存の安全条件を変更しない。DI・AD等の下位Packageの正本名は改名しない。CMのSave追加は本範囲へ含めない。新しいManager・Registry・Store・Runner・共通Package・互換Facadeを追加しない。

試験は変更したモデル操作とConsumerの限定集合を先に固定して実施する。成功、拒否、初回保存後の準備失敗、保存不明、旧版・別Owner、途中例外、履歴未確認、受領待ちとfresh読取りを既存の反証へ対応付ける。試験一時物は既存Repository-local自己生成Rootだけとし、終了hookで同実体を回収する。全体回帰・実AI・Docker・過去保持物の走査・操作は禁止する。

### 14.1 要求・表示と開始／終了の接続状況

Objective要求、判断操作要求／結果、状態照会／投影、WorkspaceCommandと活動処理をCoordinatorの既存Ownerへ移管した。モデル側に上位要求型やCoordinator依存を残さず、移管した入力検査のUTも既存のCoordinator試験へ移した。保存モデル・保存Schema・contract文字列・Path・Hash namespace・reason・IPCは維持する。EMに必要なモデル検査としてinspectDecisionを公開し、保存codec／履歴投影を上位の判断検査に流用しない。

開始記録の保存後に既存の終端Context準備を接続した。準備が失敗・例外でもstartSavedと元exact参照・発行済みEffectを返し、Host要求へ進まない。旧Coordinator execution/settlement.tsは撤去し、既存persistence.tsが元観測を搬送する。終端保存用Repositoryの非列挙purpose/rootをspreadで落とす不整合を検出し、既知fieldを明示搬送する形で是正した。

終了入力の固定はcompleteOperation内部へ閉じた。inputAcceptedは保存確定とは別の結果であり、受理後のReader・Snapshot取得・符号化例外でも、同じ元結果をCoordinatorが保持して再入場できる。独立レビューで検出した受理後例外の搬送欠落を是正し、同参照の再入場とコピー拒否を有限試験で確認した。WriterのI/O例外・発行事実保持は既存契約を使用する。開始統合のレビューでは後続準備Readerの解放不明が先行Writerの成功へ隠れる指摘も検出し、両段階の解放確認と元reasonを統合結果へ反映するよう是正した。準備例外は解放不明とし、Source再レビューの必須残指摘は0件である。後続の未実装範囲の成立を意味しない。

現Rootは232公開物（165値・67型）であり、最終65関数案の完了ではない。Checkpoint・Queue・Leaseの集約、Reader／履歴の内部化と全公開物の最終削減、残る利用側・台帳の全照合は継続中。既存のRoot-only Guardは維持し、テスト用Facadeを追加していない。

今回の限定結果は、移管先／モデル側8試験Fileの47件（追加の判断モデル検査後、開始／終了・遷移を含む9 File・58件で再確認）、終了保存結合4件、Coordinator本番Owner再入場の指定1件、現在状態保存とpending再入場の指定群2件、公開・依存境界の指定3件が成功。集合は重複し得るため合算しない。現在状態の結合試験は最初に上記搬送不整合で失敗し、是正後の再実行で成功した。準備Readerの解放不明是正後も、終了保存結合4件と現在状態結合の指定群2件（約167秒）の成功を再確認した。全体回帰や実AI／Dockerの成功へ読み替えない。EM・Coordinator・AM・MCP・Workbenchの型検査も成功しているが、後続編集後は影響範囲を再確認する。

追加した「正常Owner1回」の限定ケースでは、旧DI内部名への故障注入、CoordinatorがHome排他を持つ旧前提、未Intent資源の未発行成功期待、旧cleanupOutcome入力、selectionHash欠測、抽出宣言の依存欠測を検出した。現在のExecutor入口、実共通Lockの取得・競合・解放結果、既存Cleanup通知とHost Module全体の再読込みへ試験だけを接続した。手書きSource閉包・global一時key・旧清掃証明代役は撤去し、不正cap・別plan・元版不変の反証は維持した。本番DI・Executor・ADは変更していない。Sourceレビューの必須残指摘は0件。Module全体を使う最終版の指定ケース1件も成功した（約124秒）。保持あり・複数回形や実Executor E2Eの成功へ拡大しない。

成功した試験は終了hookで自己生成物を回収する。一方、追加ケースの途中失敗には既存の安全条件でRootを保全した実行があり、全試験物の回収完了とは扱わない。由来を名前や時刻だけで推測して削除せず、今回の未回収試験物も残件として保持する。過去保持物の走査・処置はしていない。

### 14.2 Checkpoint・Lease・Queueと回復Readerの統合状況

live Checkpointの旧6入口は既存saveOperationCheckpointへ集約した。kind/valueを閉じたown-dataとして捕捉し、元Owner・操作ID・referencesの非対象pendingDeliveries保全と既存CASを維持する。回復Checkpoint、Host事前検査、正式未発行の元Controller照合は別の権限条件として維持しており、この集約だけで回復系全入口の最終整理を完了したとは扱わない。

Leaseの旧9入口はacquireLease／releaseLease／recoverLease／readLease、Queueの旧7入口はcreateQueue／updateQueueへ実処理を集約し、旧関数宣言を撤去した。各kindの必須tupleを型で対応付け、Intent保存・物理処置・結果観測の順とLock内の現在RootへのCallback結合を維持する。独立レビューでtuple自体の未捕捉を検出したため、既存snapshotStateArrayでProxy・Getter・独自iterator等を実行せず固定し、元の最小／最大arityを検査するよう是正した。追加の公開16kind負対照と既存候補試験を確認し、再レビューの必須指摘は解消している。

回復Readerの旧8入口はreadRecoveryStateの固定取得範囲へ集約した。通常、入場、資源出版、Host清掃、実行／修復履歴、実行／修復終了、配送の元ID検査とreadStateSnapshot引数は同じで、fresh読取りを使い回さない。live Owner ReaderとACK前結果Readerは権限差のある既存入口を維持する。保存Snapshot生成Helperはまだ一部の外部試験が使用しており、内部化・最終公開IFの残件である。

汎用Helper4件はRootから外し、Coordinatorは既存input/snapshot.tsを利用する。外部参照のない既定内部化対象の型21件もRoot再exportだけを撤去し、宣言・戻り値field・保存形式は保持した。モデル自身の試験は宣言元、外部試験はRoot限定のままである。この段階のRootは189項目（135値・54型）。後続の現行集合は§14.3で区別し、65関数案の全完了を主張しない。

限定検証ではRoot・依存境界／Lease／Queueの指定4 Fileで26件、Coordinatorの単発入力／結果投影3件が成功した。回復・修復接続の指定2 FileはVM内外のprototype比較を是正後、57件の全再実行が成功した。EM Reader／回収Writerの指定4件、終了保存の結合4件（約77秒）、Coordinator現在状態の保存とpending再入場の指定群2件（約225秒）も成功した。旧関数名と最終宣言位置を前提にした試験Source抽出は現在Sourceへ追従した。EM・Co・AM・MCP・Workbench・DI・Executorの型検査を確認した。集合の重複を合算せず、全体回帰へ拡大しない。

今回の失敗試行で保全された試験Rootは、実行時のexact所在と実体の対応を再確定できないものが残る。既知の試験名・PID・prefix・時刻だけを削除根拠にせず、走査や推測削除は行っていない。新たな記録機構や自動清掃を追加せず、この未回収を完成条件の残件として保持する。全体回帰・実AI・Docker・過去保持物は操作していない。

追加で、結果受領の保存不変条件の検証をEMへ移し、当該HelperのRoot公開を撤去した。Coordinatorの実受領処理の正常／再送／拒否試験は保持する。移管編集がテスト本体全体を除いていた指摘を独立レビューで受け、元の本体を復元し、モデルHelperの5検査だけを移管した。復元後のCo試験24件とEMの指定4件が成功した。現在Path正規化はCoordinatorの既存同一実装へ接続し、Project定義Hashの結合Oracleは全定義fieldと末尾LFを明示してNode SHA256で照合する。末尾LF欠測の試験期待を是正後、指定replan結合1件が成功した。変更試験の登録名を基準版と静的照合し、欠落として見えた3件は先行移管先のCo既存試験に同名で存在することを確認した。追加独立レビューの必須指摘は解消している。

### 14.3 回収保存の統合と外部試験の接続変更（限定検証中）

回収中の途中更新・再起動・終端・Host清掃確定は、既存の`saveRecoveryCheckpoint`へ実処理を統合した。旧三宣言は撤去し、新しい互換Wrapperは作らない。`RecoveryCheckpointRequest`は用途別に必要な証拠を必須にする。Host清掃では`assertAbsentOwner`とReaderのexact出版候補、その他では元の同期Owner確認を維持する。終端の通常→履歴→配送Readerの順序と、前Readerの解放確認、元版全文一致、保持設定の再検証を変えない。live Host準備と正式未発行の証拠は別の完成操作に残す。独立レビューで必須指摘なし。

外部試験から内部の保存遷移検査・投影・分類・候補生成への依存を撤去した。EM内部の純粋検査は宣言元で維持する。Coordinatorでは公開保存・読取り操作、現役のResource値操作と、対象外全文・改訂・元Hashを明記した独立期待DTOへ接続する。メモリWriter代役は実Writer検証と区別する。修復結果試験は自己生成Rootの実Filesystem／共通Lockを使い、初回の実Git観測後だけ固定Revisionの試験代役へ接続する。Root／Git配置は毎回実観測し、HEAD変更検出は既存の実Git試験へ残す。技術処置と応答故障は有限代役であり、解放不明の応答から実Lock解放失敗を証明したとは扱わない。

現Rootは157項目（102値・55型）。外部fixture専用の保存候補Helperに続き、履歴要約とHost更新の生成HelperもRootから内部化した。初回Identityの検査・回復ID導出と初期Host判定は既存Readerへ内包したが、候補Helperの外部fixture依存が残る。実受領の復号、Host系統照合、認証資源の検査、実E2Eの遷移Oracleも、利用側からの吸収可否を引き続き評価する。本番利用があることだけを最小公開の根拠にはしない。コード接続済みと限定検証の完了は区別する。

限定検証では、統合後のCo回収・再起動接続51件、EM回収Writerの指定3件、EM修復・境界の38件、再起動とHost観測の11件、Task保存の指定3件、修復Ownerの指定12件、現在状態・pendingの指定群2件が成功した。集合の重複を合算しない。修復結果の指定ケース（3 Root）は成功し、同File内の故障matrixと利用側の追加限定確認は継続中。7 Packageの型検査は成功したが、限定検証全完了・全体回帰成功とは表示しない。

新しい正常終了試験は既存の終了hookで自己生成Rootを回収した。一方、中断試行や先行失敗でexact所在・元実体との対応を再確定できないRootは未回収である。prefix・時刻・PIDだけで推測削除せず保全し、過去保持物の走査・処置は行わない。全体回帰・実AI・Dockerは未実施。

### 14.4 本番の検査・候補生成の内包化（限定検証中）

技術・利用側影響・文書の独立確認を行い、旧3値契約の説明残存を是正した。限定文書Checkerは、詳細設計台帳・Qualityの対応集合・旧PA anchor・旧Native trace参照等に18件の指摘を返した。今回の局所修正でこれらを解消したとは扱わず、横断追従の未確認・未是正として区別する。

0byte fixture是正後、保持済み再入場の指定1件と、成功・保持・取消後のexact履歴確定の指定1件も正常終了した。それぞれ既存終了hookに回収例外はなく、実Writer・Readerを通した観測と有限DI代役の境界を維持した。先行File matrix全体の再実行や、未確認の全領域成功とは区別する。

履歴要約の重複検査は既存の修復履歴Readerへ、Host清掃前の候補検査は既存の操作Readerへ内包した。`prepareRepairHistorySummary`・`prepareStateHostSnapshot`はRootから撤去し、EM内部の宣言と反証試験は維持する。Host清掃前Readerは次Snapshotや新しいAuthorityを返さず、同じ元版の準備成立事実だけを返す。Coordinatorの一回許可消費を検査より先へ動かさない。清掃確定後はWriterの確定改訂・Hashとfresh Readerのexact対象・Host token・清掃結果を照合する。

既存限定matrixでは、試験用marker除去が応答だけの代役だったこと、保持保存の故障注入が旧checkpoint種別に接続されていたこと、終了Writer内部の読取りを外側Readerの回数に含めていたことを検出した。正常marker処理は公開完成操作へ接続し、保持故障はretention_handoffへ、Reader注入は実際の前後二回へ是正した。保持済み再入場の失敗は、試験が履歴不存在を0byte Fileで表現していたため、製品の通常実体検査で拒否されていた。自己生成exact履歴Fileだけを通常File・非Link・nlink確認後に不存在へ戻し、ENOENT以外を再throwするfixtureへ是正した。Reader前後の停止、保持保存故障、保持済み再入場の各指定試験は成功した。File全体の再実行や全体回帰の完了とは表示しない。

今回の限定範囲でモデル・Root境界・遷移35件、Coordinator回収・再起動接続51件、Host準備保存と本番Owner再入場の指定各1件、Task実保存の指定2件、未出版pendingの指定4件が成功した。7 Packageの型検査、変更Sourceの整形・Lint、差分の空白確認も成功した。重複集合を合算せず、全体回帰・実AI・Docker・過去保持物は操作していない。初回Identity候補と保存codec等の残るRoot公開は、単なる存続確定にせず既存操作へ吸収できる範囲を継続整理する。

### 14.5 開始Identity・初期Host条件と汎用Hashの整理

開始前Identity検査と回復ID導出は、既存の`readOperationStateStage(kind: "operation_start")`へ内包した。閉じたown-data捕捉、同じ操作Owner・Repository結合、初期候補検査と最終再検証だけを行い、StateReader・Lock・Writer・Directory初期化へ進まない。結果はkind・status・operationIdentityの共同成立で事前検査済みの非Authority相関だけを表し、Stateは返さない。Home観測Capabilityを消費する前の検査位置と、開始保存時の再検査を維持した。

開始診断の既存試験は、開始とIdentity組立ての両本番本文へ接続した。Reader拒否・取得範囲の相違・Identity事実欠測では、Home観測・観測Capability消費・保存・Host要求が全て0となることを確認する。必須のモデル検査自体はEM側で別Owner・不正Identity・Getter不実行・最終失効とStateReader到達0を反証し、有限代役だけをモデル検査の成功根拠にはしない。

初期Hostのモデル条件は`state/validation.ts`の非公開判定へ移し、実Hostのhost_only・exact tokenはCoordinatorへ残した。固定範囲`initial_host`と既存host_cleanup Readerだけ、返却Snapshotと同じ版のexact一操作を評価する。通常current読取りで全操作を再導出せず、追加I/O・保存・Authorityを作らない。Coは成功・値あり・解放確認・元本文一致の後だけ不変のID一覧を使う。モデルの全文差分・再起動・参照残存の反証一式はEMの既存runtime-transitions試験へ移し、合法負例30件・比較省略／再起動guard変異・依存欠測を維持した。Coの実Host結合と状態／token差の反証は残す。

`hashStateText`はRootから外し、外部のLease実体Hash計算をNode.js標準へ直接接続した。UTF-8、入力文字列・要素順序、二重Hashを維持し、Leaseの取得・解放・回復方式は変えない。現Rootは157項目（102値・55型）。`prepareStateOperationSnapshot`の本番Co参照は0だが外部fixtureの候補生成依存が残る。保存codecの元本文・候補解釈、一般入力捕捉、Workbench検証scriptの全履歴読取りも既存接続が残るため、Root最小化や全codec内部化の完了とはしない。正規符号化を単なるJSON.stringifyへ置換せず、深いimportや互換Facadeも増やさない。

限定確認は、モデル・公開境界・Lease候補25件、Host準備／開始前Readerの指定1件、開始診断3件、Co回収・再起動接続51件、本番Ownerメモリ再入場1件、実Task保存の指定1件、長期wx Leaseの指定2件、Owner終了state_savedからの別Process実Host回復の指定1件が成功した。集合を合算せず、実Git／Filesystem／wxと有限技術代役の境界を維持する。技術・利用側影響の独立レビューに必須残指摘なし。全体回帰・実AI・Docker・過去保持物は操作せず、既存の横断Checker18指摘と先行未回収物を解消したとは扱わない。

### 14.6 初回候補Helperの外部試験依存撤去

`prepareStateOperationSnapshot`はRootから撤去した。実Rootを使う合成Operation登録・Host出版切断fixture・CLI切断fixtureは、公開`saveOperationStart`の実Writerへ接続する。開始保存・保存確認・Lock解放・exact回復ID、fresh本文の改訂・元Hash・対象外区画の不変を共同確認する。初回保存の期待値は明示DTOとし、同じ製品候補関数との自己比較をやめた。Contextの有限callbackは技術清掃成功を返さず、Host／Docker成立の根拠にはしない。

通常継続の試験は、8軸（正常・Lease・Owner・資源・未解決義務・Task・相関・Host）と両Providerの四段階を維持し、自己生成Git Rootで初期化→fresh Reader→実開始Writerへ接続した。拒否時は未保存・保存未確認・耐久Effectなし・Lock解放・元本文不変とCoordinatorの次Provider Effect停止を観測する。正常時はReaderの改訂・exact操作・過去unknownの三値と旧操作全文の保全を確認する。修復中の開始拒否も、既知active版を実保存先へ置き、同じ公開Writerの拒否後に既知completed版へ戻す。

純粋なHost観測・再起動組立て試験は既存の有限入力fixtureを共用する。このfixtureは無引数の固定DTO・固定Hash期待値であり、任意Identityの候補生成や内部検査への間接接続は持たない。EM自身の候補反証は宣言元へ接続する。公開境界Guardは直接／間接の内部依存を引き続き拒否する。現Rootは156項目（101値・55型）。保存codec・入力捕捉・Workbench検証scriptの全履歴読取りは残件であり、公開最小化全体の完了とはしない。

限定確認は、公開境界・codec・遷移の指定3 Fileで25件、修復モデル・終了要約の指定2 Fileで21件、Host観測・再起動組立て16件、Objective回復の指定1親、通常継続の指定1親、現在状態保存とpending再入場の指定1親・1子、正常Owner1回の指定1親が成功した。集合を合算しない。変更16 Sourceの整形・Lint（警告0、情報18件）、EM／Coordinatorの型検査、HEADとの差分の空白検査を確認した。既存の試験項目・ファイル単位の台帳対応を維持し、新項目や件数を発行しない。独立レビューの文書残件1件は現行残件説明の更新で是正した。全体回帰・実AI・Docker・過去保持物は操作していない。先行の横断Checker18指摘と未回収物を解消したとは扱わない。

### 14.7 回復Ownerによる保存本文の再decode撤去

Coordinatorの回復記録は、元本文と同じ版の検査済みSnapshotを保持する。初回は元版一致確認後のfresh Reader値とし、資源出版の再入場後も出版後の値を使う。一般Checkpoint・認証不明終了・Host清掃確定の各保存後は、Writerの保存確認・改訂・Hashとfresh Readerの正常・Lock解放を確認した後だけ、元本文と保持Snapshotを同期して更新する。Snapshotは既存codecで再帰的に凍結された値を使い、新しい複製・検査・Owner管理やI/Oを追加しない。Restart専用記録は今回変更しない。

本番Coordinatorの`decodeStateSnapshot`直接参照3件を撤去した。Host条件・consumer判定は同じ保持Snapshotのexact IDとkindから取得する。元bytes／CAS・現在Owner確認・保存失敗後の停止は維持する。外部試験のdecoder依存と、元本文の正規符号化・入力捕捉・全履歴取得は残っているため、Root公開156項目とcodec最小化全体は未完了のままである。

限定試験では、回収接続の指定Fileで32件、元入力による本番Owner再入場の指定1親、Owner終了state_savedから別Processの実Host回復の指定1親が成功した。回収接続では一般保存後・認証不明終了後の拒否／古い読戻し／改訂差／Hash差／解放不明を反証し、本文と保持Snapshotの片側更新を拒否する。Host清掃の既存26故障条件にも両者の正規byte一致を追加した。consumerの別ID・別kind・先頭の別操作も反証する。既存試験項目・ファイル単位の台帳対応を維持し、技術・利用側影響・文書の独立レビューに必須残指摘はない。Coordinator型検査、変更4 Sourceの整形・Lint（警告0、情報4件）とHEAD差分の空白検査を確認した。全体回帰・実AI・Docker・過去保持物は操作せず、先行の横断Checker指摘と未回収物を解消したとは扱わない。

### 14.8 入力捕捉と保存codecの分離

公開受入要求、認証の資源Intent／Receipt、通常資源のIntent／Receipt、Host checkpointの6呼出しを、Coordinatorの既存`snapshotJsonValue`へ接続した。保存用codecの文字列化→再解析を入力コピーとして使わない。局所のunknown型assertionを実行時検査の成立へ読み替えず、Getter・Proxy・symbol・不正数・深度等の拒否、非列挙data propertyと特殊keyの保持、参照分離を維持する。保存本文の正規符号化・Hash・同一性比較と公開結果は変更しない。新しいHelper・Facade・Root公開は追加しない。

直接試験ではnull prototype・__proto__／constructor・整数風key・非列挙data・共有子objectの独立コピー・-0・安全整数・配列subclass・別realm配列・深度32／33・循環・不正型を対照にした。各入口でも捕捉拒否を後続境界へ接続し、認証では資源値操作とWriter、通常通知とHost checkpointではWriter、公開受入ではFile read／write／Root所在取得への到達0を確認する。

試験代役の単純JSON比較が正規比較と異なること、別realmの合成Host値が本番入力捕捉で拒否されることを検出した。Host checkpointの比較は既存正規codecへ接続し、再起動準備の有限組立ては同realmの閉包で評価するよう是正した。本番入力捕捉をJSON再解析で迂回せず、同じhelperを直接使う。既存の試験Owner・台帳項目は維持する。

限定確認は、入力捕捉・認証記録・現在回収・再起動準備の指定4 Fileで64件、別ProcessのOwner終了state_savedからの実Host回復の指定1親が成功した。公開受入の正常実Stateケースと入力拒否ケースは、同じFileの再実行で2件とも成功した。Coordinator型検査、変更11 Sourceの整形・Lint（警告0、情報8件）、HEAD差分の空白検査を確認した。技術・利用側影響・文書の独立レビューに必須残指摘はない。Root156項目のままであり、外部試験のdecoder依存、保存正規符号化・比較、全履歴Readerの整理は残る。全体回帰・実AI・Docker・過去保持物は操作せず、既報の横断Checker指摘と先行未回収物を解消したとは扱わない。

### 14.9 全履歴取得の既存Readerへの接続

`readRecoveryState(root, { kind: "history" })`を追加し、通常Stateと同じ短期保存Lock内で履歴を全行検査する。新しい公開関数・型名・Storeは作らない。初期化済みStateと安定した履歴Fileを同じ観測へ結合し、最終実体・存在有無・Lock解放まで確認する。真正不存在は不変の空配列、読取り拒否・不正行・部分行・重複・0byte・未知物・pending・実体変化・解放不明は`historyRows:null`と値なしの停止で区別する。通常currentには追加履歴I/Oを発行せず、全履歴Queryにも保持設定読取りやAuthorityを追加しない。

Workbench検証scriptの診断は、同じReader一回の成功・State値・解放・履歴値の共同成立後だけ現在相関と全履歴を採用する。無関係な正常行も落とさず、診断途中の例外では従来どおり相関と一覧をクリアする。Fileを直接読む専用helperは唯一の利用が消えたためSourceごと撤去し、Symbol台帳の該当項目も削除した。旧File読取りとdecoderを代役にしていた既存診断試験も、検査済み履歴応答と現行のループへ接続した。

限定確認は、全履歴Queryの指定1親・13子で14件、既存Readerの指定2親、Root境界の5件、Workbench診断の指定1親と既存相関判定の指定1親が成功した。履歴の無関係な複数行、末尾破損・LF欠測・不正UTF-8・重複・0byte・pending・Directory、読取り中の出現・消失・置換・I/O失敗を反証する。Linkとhardlinkの実作成は環境の権限制約で実行できなかったため、今回は種別・nlinkのメタデータ故障注入として区別する。解放不明も既存保存Source fixtureの注入であり、実Lock故障を観測したとは扱わない。今回の自己生成Rootは既存hookで回収し、過去保持物には触れていない。

EM・Coordinator・Workbenchの型検査、変更7 Sourceの整形・Lint（警告・情報0件）とHEAD差分の空白検査を確認した。技術・利用側影響・文書の独立レビューに必須残指摘はない。Rootは156項目のままで、外部試験のState／履歴decoder依存と、保存正規符号化・比較の利用整理は残る。全体回帰・実AI・Dockerは実行せず、既報の横断Checker指摘と先行未回収物を解消したとは扱わない。

### 14.10 外部履歴decoder利用と純粋モデル試験の分離

Coordinator現在状態試験の純粋な一次失敗／Command観測の親ケースを、EMの既存runtime-codec unit試験へ移した。現行の`validPrimaryFailure`と内部の履歴decoderを直接使い、旧名を参照するVM閉包と縮減enum代役を撤去した。正負の入力と履歴往復の確認は保持し、PRL-UT-006の既存項目と、実際に検査する既存attempt／history Symbolへの対応を追加した。新しい項目ID・Source・検査用Facadeは作らない。

実保存側では、通常完了と修復結果の履歴確認を公開全履歴Readerへ接続する。consumer・相関の変異は履歴としては正規であり得るためReaderの全件取得を認め、exact操作の終了観測で拒否する。旧形式・重複・空File・不正な再起動欄はReaderが値なしで拒否する。各変異後のState全文不変と、新しいpending等の保存物がないことを確認し、試験で取得した元履歴だけへ戻す。

この段階で履歴decoderを直接使うCoordinator試験は5 Fileから3 Fileへ減った。残るcurrent-host-transition-worker、docker-recovery-owner-reentry、runtime-repair-ownerと、State decoder・正規符号化／比較の利用整理は継続対象であり、Root156項目の最小化完了とはしない。製品Source・公開契約・保存形式は今回変更していない。

限定確認は、移管先EM codecの10件、Root境界5件、認証unknownの指定2親、現在状態保存とpending再入場の指定1親・1子、修復終了接続の指定1親が成功した。修復回収接続と修復失敗履歴接続の指定2親も成功した（約410秒・572秒）。今回の指定ケースはいずれも終了hookの回収例外なく完了した。EM／Coordinator型検査、変更3 Sourceの整形・Lint（警告0、情報6件）、追加した既存Symbolへの検証対応2件とHEAD差分の空白検査を確認した。技術・利用側影響・文書の独立レビューに必須残指摘はない。全体回帰・実AI・Docker・過去保持物は操作せず、既報の横断Checker指摘と先行未回収物を解消したとは扱わない。

### 14.11 正常Owner結合試験の実履歴Readerへの接続

`docker-recovery-owner-reentry.contract.test.ts`の履歴decoder呼出し5箇所を撤去した。修復直後の単一行を公開全履歴Readerから取得し、exact回復ID・生行・時刻・Node.jsによるlineHash／summaryHashを照合して試験の基準値とする。後続Taskの各段階では同じ実履歴Fileと引数の一致、Readerの成功・State値・Lock解放・履歴値、State／履歴本文の前後不変を確認し、元行の全field・件数・raw prefixを比較する。新しい保存Owner、検査Facade、任意File読取りAPIは追加しない。

引数だけを変えた時刻・重複の負例は、実Fileとの不一致を拒否する対照へ明確化した。実保存履歴の構文不正・重複をReaderが拒否する検証は、既存EM Reader試験が所有する。同じ責務の終端decoder再検査は既存helperに統合した。製品Source・公開契約・保存形式・安全条件は変更しない。履歴decoderの外部依存は残る2 Fileへ減ったが、State decoderと正規符号化／比較も継続対象であり、Root156項目の最小化完了とはしない。

Coordinator試験の型検査、変更Sourceの整形・Lint（警告0、既存情報2件）、HEAD差分の空白検査を確認した。限定回帰は正常Owner1回の保持なし・あり2親を一度実行し、2件とも成功した（約121秒・135秒）。両ケースの既存終了hookに回収例外はない。固定Sourceと文書の独立レビューに必須残指摘はない。全体回帰・実AI・Docker・過去保持物は操作せず、先行未回収物や既報Checker指摘の解消とは扱わない。

### 14.12 Host遷移子fixtureの履歴decoder撤去

`current-host-transition-worker.ts`の履歴decoder呼出し4箇所と専用namespace importを撤去した。確認済み履歴は`execution_history`の検査済み`historyFile.bytes`と実Fileを比較し、単一LF行・exact ID・既存全文HashとState前後不変を保つ。引渡し失敗からの回復後は全履歴Readerの成功・値・解放を共同確認する。故障注入前に配置する45日前の無関係行も、実Fileへの配置後に同Readerで一件・元行・IDと本文不変を確認する。pending中の別操作行は検査済み元行の識別子だけの既知変異とし、通常Queryにpendingを許す例外や任意bytesを読む代役は追加しない。欠測・別行でのexact再入場拒否とState／pending／markerの不変は維持する。

旧行・現行行・整合した別IDの形式成立と、nonceだけを変えたID不整合の拒否をEMの既存runtime-codec試験へ追加した。既存PRL-UT-006とERB-IT-014で追跡し、新しい試験API・QA ID・保存形式は作らない。初回の限定Host試験3件は子fixture実行前の初期State読取りで停止し、親試験の空初期値に現行必須`decisions`・`blockers`が欠けていたことを確認した。当該初期値だけを補い、製品Readerの検査は変更しない。

EM codec11件と子fixtureの静的接続・資源Oracle確認2件、EM／Coordinator試験型検査、変更Sourceの整形・Lint、HEAD差分の空白検査を確認した。Hostの指定3親を同じ選択範囲で再実行し、history_checkpoint_pendingは成功（約64秒）、history_confirm_pendingは終端保存の確認不成立、handoff_failureは既存の孫Process60秒期限超過で失敗した。成功や限定回帰完了とは扱わない。今回の清掃未確認Rootは`C:\project\CRDD\.crdd\tests\current-host-transition-18936-2AGTlR`と`C:\project\CRDD\.crdd\tests\current-host-transition-18936-wamhnG`で、実体・参照・終了状態を確認できておらず保全し、今回削除しない。

history_confirm_pendingでは、準備処理は保持設定付きの履歴Readerを使う一方、終端Writerへの再入場入力には保持日数がなく、未確認履歴のpublish確認で拒否される搬送漏れを特定した。Coordinator finalizerは、同じ保存Snapshotのexact docker_taskに未確認履歴がある場合だけ既存`withHistoryRetention`を接続する。履歴なし・確認済み・他操作の場合の追加設定読取りは0とし、Owner・Host不存在・一回性・元版の照合は変えない。既存finalizer試験のOwner shapeを追従し、同じ保存前本文と本番の設定接続本文で6条件（未確認、初回不正、途中変更、確認済み、他操作、履歴なし）を反証した。指定2親は成功し、Co試験型検査・変更Sourceの整形・Lint（警告0、既存情報2件）も確認した。実pendingの指定1親は最終改訂版で成功した（約102秒、既存終了hookの回収例外なし）。追加の設定接続正本へのSymbol対応を既存試験項目へ追従した。固定Sourceの独立レビューに必須残指摘はない。handoff_failureの期限超過は別件として未是正のまま保持し、全指定ケース成功とは扱わない。

履歴decoder外部依存はruntime-repair-ownerの1 File、Rootは156項目のままであり、公開最小化完了とはしない。全体回帰・実AI・Docker・過去保持物は操作していない。

### 14.13 修復Owner履歴取得とRoot履歴decoderの内部化

最後の外部利用であるruntime-repair-ownerの13呼出しを撤去した。実保存済み履歴は全履歴Readerの成功・State値・解放・履歴値を共同確認し、元の行数・本文・exact ID・廃棄／保持結果を残す。旧保持行や別操作行は実File配置後の全履歴Readerで形式成立を確認し、専用完了Readerで対象相関を別に拒否する。history rename中断後のpendingは専用repair_history Readerのpublish段階と検査済みpending bytesを使い、単一LF行・exact ID・保存済みlineHash・State／pending／marker不変を確認する。通常Queryにpendingを許す例外を追加しない。切断材料の無関係な旧Task行は、publisherがpendingを解消した後に公開Queryで実保存行を確認し、純粋形式検査はEMが所有する。

外部からの履歴decoder呼出しと追加deep importがないことを確認し、RootのdecodeHistoryRowsを撤去した。EM自身の関連4試験のimportは内部正本へ追従し、固定公開期待値も更新した。decoderの本体・保存形式・安全条件・公開関数の追加はない。Rootは155項目（100値・55型）で、State decoderと保存正規符号化／比較の外部利用は継続整理対象とする。既存ERB-IT-014・RCM-UT-014・PRL-UT-006等の試験項目で追跡し、新しいQA IDや検査Facadeは作らない。

EMの公開境界・修復モデル・判断・State遷移の指定4単体Fileは53件成功した。EM／Coordinator／Workbench型検査、変更7 Sourceの整形・Lint（警告0、既存情報7件）、HEAD差分の空白検査を確認した。Coordinatorの指定3親は、completion exact対象（約97秒、10子）とIdentity／Session出版（約44秒、2子）が成功した。保持fresh出版はnone・stateの2子が成功し、history子の新規marker読取りだけがENOENTで失敗した（指定集合全体は約421秒、18項目中16成功・子と親の2失敗）。history pendingのpublish段階ではstate.lockが必須ではないため、試験側はENOENTだけを明示不存在として前後不変を確認し、存在時は同じbytesを比較する形へ是正した。Readerの条件や製品処理は変えず、読取り不能を不存在へ畳まない。最終改訂版では保持親を選択し、Node.jsの選択仕様により同親のnone・state・historyの3子も再確認した。親と3子の4項目がすべて成功した（約287秒）。指定範囲外の親や全Fileは再実行していない。既存終了hookの回収例外はない。固定Sourceと文書の独立レビューに必須残指摘はなく、marker是正後の独立再レビューも必須残指摘0で完了した。

handoff_failureの調査では、試験子のerror／signal assertionが受領済みstdout・stderrを失敗説明に含めていないことを確認し、既存status assertionと同じ出力を添えるよう補った。Process起動、既存60／120秒期限、出力生成、保存、安全判定は変えない。子本文の構文接続指定1親・型検査・整形・Lintは成功し、診断差分の独立レビューにも必須残指摘はない。実handoffは他の試験が完了してから指定1親を単独で一度再実行し、成功した（約61秒、既存終了hookの回収例外なし）。起動条件や既存の子60秒／親90秒期限は変更していない。今回の成功は前回の期限超過の原因特定・再発防止を意味せず、試験時間の変動要因は未確定として残す。先行の清掃未確認2 Rootは操作せず、解消済みとしない。全体回帰・実AI・Docker・過去保持物は操作していない。

### 14.14 検査済み保存原文のReader所有と利用側のJSON再生成撤去

State保存Readerの成功valueへ`sourceText`を追加した。Snapshotと本文Hashを検査した同じ`observed.bytes`を、既存の最終実体照合後にUTF-8文字列として返す。pending候補・別読取り・再符号化から作らず、decoder自体へ原文保持を追加しない。成功valueの凍結と拒否時のvalueなし、現在Owner・Lock解放・未知状態の停止を維持する。追加I/O・Root関数・公開型名・Authorityは作らないが、本文文字列分のメモリは保持する。これは暗号化・復号ではなく、検査済みJSON原文の受渡しである。

Coordinator回復処理のSnapshot再符号化16箇所を`Buffer.from(value.sourceText, "utf8")`へ置換した。元本文の全文比較、Writer before入力、改訂・Hash・解放照合、同じ成功valueからのbefore／snapshot同時更新は維持する。Host／再起動／Directory／資源の値比較は今回変更せず、比較用encoderとState decoderはRootに残る。公開数は155項目のままで、全公開物の最小化完了とはしない。変更利用側に原文のログ・HTTP応答への丸ごと搬送は追加しない。

有限Reader代役の旧返却shapeが追加fieldを欠き、正常経路まで拒否されることを初回限定試験で確認した。同じ試験内の既知の元本文・現行の符号化方式から原文fieldを付加し、stale・Hash違い・解放不明・Owner喪失などの負例を維持した。代役で実Reader・実排他の成立を主張せず、旧shapeへのfallbackは作らない。

限定確認は、EM全履歴Readerの指定1親・13子14項目（非ASCII・引用符・バックスラッシュ・末尾LF・元bytesとHash・凍結・拒否時値なし）、Co現在回収／再起動準備の指定2 File54項目、認証保存順の指定1親が成功した。実Host正常Owner1回の指定1親（約132秒）と本番Owner再入場の指定1親も成功し、今回の実保存試験に終了hookの回収例外はない。EM／Coordinator／Workbench型検査、変更9 Sourceの整形・Lint（警告0、既存情報5件）、HEAD差分の空白検査を確認した。固定Sourceの独立レビューに必須残指摘はない。全体回帰・実AI・Docker・過去保持物は操作せず、先行保全2 Rootと試験時間変動の未確定を解消済みとはしない。

### 14.15 本番の保存用encoder依存撤去と外部State decoder試験の分離

Coordinator本番に残る資源・Host・再起動・Directoryの4つの値比較を、両辺の既存`snapshotJsonValue`捕捉後の`isDeepStrictEqual`へ置換した。キー挿入順、null prototypeと通常Object、非列挙own field、配列subclass・別realm配列、共有参照、負のゼロの従来同値を維持し、配列順・値型・field欠測／追加は非同値とする。Proxy・accessor・symbol・toJSON・疎配列・余剰field・循環・深度超過・非安全整数は片辺だけでも比較前に拒否し、未知コードを実行しない。保存原文・Hash・CAS比較は今回変更しない。新しい比較Helper・公開API・互換経路は作らず、Coordinator本番のState decoder／保存用encoderへの直接依存はともに0となった。

外部decoder利用3 Fileも整理した。Host観測の純粋試験は既存EM fixtureが検査済みの固定Operationを再利用し、保存本文の検査を再実装しない。EM fixtureの戻り値へ既に取得済みのoperationを追加するだけで、外部用の汎用decoder代役は作らない。現在入場試験は実Fileを公開Readerで確認する。Task結果fixtureは配置後と配送後に別々のfresh Readerを使い、成功・値あり・解放・原文一致とexact対象を照合する。State decoderの外部利用は16 Fileから13 Fileへ減った。Rootの155項目とencoder／decoder公開は外部試験の追従が残るため維持し、公開最小化完了とはしない。

初回の指定6 Fileでは4件の追従不足を検出した。比較関数の有限依存接続、Host期待値を本番と同じrealmで構築する閉包、現在入場試験の旧Source期待Pathを是正し、製品の型・拒否・保存条件は緩めていない。未使用の模擬Root引数も明示した。最終の限定6 File72項目、EM公開境界5項目、Task通常結果受領の指定1親（約64秒）が成功した。Directory三用途回収と保存不明の指定1親も成功した（約290秒）。Task受領・Directory回収の両指定親で既存終了hookに回収例外はない。Co／EM／Workbench型検査、変更13 Sourceの整形・Lint（警告0、既存情報9件）、HEAD差分の空白検査を確認し、固定Sourceの独立レビューに必須残指摘はない。既存のQA／Symbol項目で追跡し、新しい試験項目IDは追加しない。全体回帰・実AI・Docker・過去保持物は操作せず、先行保全2 Rootや試験時間変動の未確定を解消済みとはしない。

### 14.16 外部State decoderの子fixture・再計画試験利用の撤去

current-host-transition-workerの履歴確認後・配送後の2呼出しを、同じ真正Rootの公開Readerへ接続した。成功・値・解放、元Fileのbytes・HashとsourceText一致、読取り前後の本文不変を共同確認し、既存の対象Operationと履歴／配送状態のassertは維持する。unused model namespaceを撤去し、保存途中を通常Readerへ通す例外は追加しない。

snapshot-recovery-ownerの初回取得も、取得済み真正capの公開Readerへ接続した。元本文・Hash・exact回復ID・operationIdを保持し、後続の同版照合は保存原文を使う。評価閉包のunused encoder／decoder依存を撤去し、現在の本番比較処理が使うNode比較を接続した。汎用の外部decoder代役や深いimportは追加しない。

部分再計画の1親では、before・兄弟定義配置後・出版後を同じcapのfresh Readerで確認する。定義Hash不整合・Task順序不整合の2負例は今回の自己生成state.jsonへ配置し、Readerの拒否・値なし・解放・注入本文不変を確認する。各finallyで確認済みpublishedBytesだけに戻し、復元後のfresh Reader成功・原文一致を経て古世代Writer拒否の検査へ進む。任意byte列の純粋codec検査ではなく、実保存に対する公開Reader拒否の試験としてヘッダーも追従した。

初回の再計画指定親は、Git初期化だけでHEADがないfixtureに対して回復Readerがowner_invalidで停止した。保存Readerが要求する固定Revisionを満たすため、当該親だけに固定User・署名無効・hook無効の空Commit準備を追加した。他の親・保存Schema・Binding計算・Reader条件は変更していない。是正後の再計画指定1親（約46秒）、通常Host遷移の指定1親（約99秒）、子本文構文の指定1親、認証unknown coordinator_cliの指定1親（約93秒）が成功した。今回の既存終了hookに回収例外はない。

State decoder外部利用は13 Fileから10 Fileへ減った。Root155項目とencoder／decoder公開の撤去完了は主張しない。Co型検査、変更3 Sourceの整形・Lint（警告0、既存情報1件）、HEAD差分の空白検査と、固定Source・追加試験前提の独立レビューを確認した。既存PRL-IT-005・ERB-IT-014等で追跡し、新しいQA IDは作らない。全体回帰・実AI・Docker・過去保持物は操作せず、先行保全2 Rootや時間変動の未確定を解消済みとはしない。

### 14.17 外部State codec依存とRoot二公開の撤去

残るState decoderと保存用encoderの外部直接利用を撤去し、Rootの`decodeStateSnapshot`／`encodeStateValue`を内部化した。公開集合は153項目（98値・55型）。保存形式・Hash・Schema・期限・安全判定は変更しない。EM自身の値検査試験は宣言元を使い、外部試験を内部importや汎用decoder代役へ迂回させない。

Coordinator試験の固定JSON生成は既存の`canonicalJson`へ接続した。これは既知の有限入力の生成だけであり、Schema検査や権限確認を行う契約ではない。共有資源fixtureは固定objectの宣言順を正規順へ揃えた通常JSON生成とし、内部codecの間接利用を撤去した。実保存を読む箇所は公開Readerの成功・値・Lock解放と元本文の照合へ接続する。過去版・未出版候補・有限Reader代役は、既知fixture本文の局所投影・raw SHA-256・exact bytesを使用し、実Reader／Writerの成立証明とは区別する。

純粋な値検査と上位の保存・回復拒否は責務を分ける。保持引渡しの合法checkpoint差分と遷移拒否は既存ERB-UT-036の`legal_source_change_before_oracle`、複数Repairの保存は既存runtime-repair-storageが所有する。Coordinator側の公開Writer拒否・Effect 0・非対象保持・故障到達は維持する。改訂・元Hash・本文・保存後のfresh読取りを照合する条件は削らない。

独立レビューで初回未作成をReader成功へ限定する誤り、Source評価の比較関数注入漏れ、有限ReaderのHash欠測、Git HEAD前提と署名／hook抑止の不足を検出して是正した。未出版fixtureを通常Readerへ通す例外は作らず、当該試験では明示配置した本文とpending除去の事実だけを確認する。製品ReaderやWriterの拒否条件は変更しない。

限定確認は、EMの公開境界・codec・遷移27件、ERB-UT-036の指定1親、Coordinator指定6 File72件、Task通常継続1親、通常Owner／再入場2親、修復回収1親、現在状態保存／pending再入場の1親1子、子fixture接続1親が成功した。Leaseの指定3親は初回2成功・1失敗で、追加した不適切な通常Reader要求を撤去後、当該1親が成功した（約168秒）。新規自己生成物は各既存終了hookの範囲で回収し、回収例外は報告されていない。

EM・Coordinator・Workbench・MCPの型検査、変更44 Sourceの整形・Lint（警告0）、HEAD差分の空白検査を確認した。独立レビューの必須指摘は是正・再確認済み。40_DevelopのEM外Source／試験に両codec名の直接参照は0、内部へ到達する試験FacadeもRoot限定Guardで拒否する。今回の三残件は完了とするが、全体回帰や公開集合全体の最小性をこの局所結果から主張しない。全体回帰・実AI・Docker・過去保持物は操作していない。先行保全2 Root、既報横断Checker指摘、過去試験の時間変動は今回の解消対象ではない。

### 14.18 未参照型・試験専用型のRoot公開整理

外部のstatic／dynamic import、namespace参照と型参照を照合し、外部で型名を使わない16型と、外部試験だけが型名を使う1型のRoot公開を撤去した。今回の基準は先行153項目、変更後は136項目（98値・38型）である。新しい公開名は追加せず、実体を持つ98値の集合は基準と一致する。

| 対象 | Rootから内部化した型 |
|---|---|
| 操作・回復 | `OperationCheckpointRequest`、`RecoveryReadRequest`、`RepairDisposalCheckpoint`、`RepairRetentionTargets`、`TurnCountDiagnostic` |
| 判断・Objective | `DecisionAnswer`、`ProjectObjectiveState` |
| 保存 | `ExecutionModelReadResult`、`ExecutionModelSaveResult`、`Snapshot` |
| Lease | `LeaseAcquisitionRequest`、`LeaseReadRequest`、`LeaseRecoveryRequest`、`LeaseReleaseRequest` |
| Queue | `QueueCreateRequest`、`QueueUpdateRequest` |
| 外部試験のみ | `RecoveryCheckpointRequest` |

内部で使用する型宣言と、公開関数の引数・戻り値の型は維持した。外部4試験FileのRequest注釈は`Parameters<typeof import(EMRoot).saveRecoveryCheckpoint>[3]`へ接続し、別のRequest型・Facade・`unknown`化を追加していない。EM自身の試験は各宣言元のtype importを使う。Rootの固定型集合を同じ17項目分だけ更新し、既存の公開集合・内部境界・3モデル直接依存禁止の試験を維持する。各QA／Symbolは既存項目を使用し、新しいIDは発行しない。

`queryDecisions`／`queryExecutionState`／`queryQueue`／`queryWorkspaces`は今回は維持した。本番未接続という利用実績と、認可付き・対象限定の照会機能を提供するかという判断は分ける。Rootの型名削減を理由に、照会対象・認可・保存・回復条件を変更しない。実装関数、Schema、保存先、CAS／Lock、期限、失敗理由と回復参照は不変更とする。

現在投影のPROJECT_CONTEXTとEM設計を136項目へ同期し、先行267項目の実績や153項目段階の履歴と区別した。古い「外部試験の保存codec追従が残る」という現在説明も是正し、候補表に残すdecoderは内部契約と明示した。全公開物の最小性や全体回帰完了は主張しない。

限定確認は、今回の型参照追従先EMの指定8 File55件、Coの指定2 File54件が成功した。EM／Co試験／Workbench／MCPの型4設定、変更14 Sourceの整形・Lint（警告0）とHEAD差分の空白検査を確認した。Source・利用側・現在説明の独立レビューに必須残指摘はない。型だけの変更に対して長時間のHost試験や保存故障試験の全再実行は行わず、既存の実境界Evidenceを今回再実行したとは扱わない。全体回帰・実AI・Docker・過去保持物は操作していない。既報のChecker指摘、先行保全物と試験時間変動は別残件として維持する。

### 14.19 モデル別CRUDとState複合取得の分離

モデル単体のCRUDと、複数モデルを同じ保存版で扱う取得を分離した。旧`readExecutionOverview`とWorkspace側`readWorkspaceState`はStateの`readState(repository, binding, scope)`へ統合し、元の実装・Root公開・互換Wrapperを撤去した。`scope`は`execution`又は`workspace`の固定二範囲だけとし、元の返却fieldを実際に構築する。任意field・投影callback・全技術Snapshot・新Store／Registry／公開型は追加していない。未知・欠測scopeは既存Readerへ進む前に`orchestrator_state_read_scope_invalid`で拒否する。

Task側`readQueueProject`もStateの既存`readProjectExecutionState`へ接続し、重複するProject投影を削除した。正常対象・明示不存在・Schema不正の扱いを維持し、有効Schemaの不正IDをSchema不正とする旧誤分類だけ、既存の`orchestrator_state_identity_invalid`へ揃えた。SchemaとIDが両方不正の場合はSchema不正を優先する。取得値を更新候補にせず、保存・認可・回復条件を緩めない。

Coordinatorの通常状態表示は、同じ一回の`execution`取得結果からProjectと受付世代を既存の表示生成へ渡す。Projectを別Portで再読取りしない。Git Revision不一致時にWorkspace採用可否を確認する経路では、その前後のfresh取得を維持する。Workspace操作は`workspace`範囲を同版で取得し、排他取得前後や保存後に必要な再確認は削っていない。一般照会4関数は対象限定・認可契約が異なるため今回は維持した。

Rootは134項目（96値・38型）。削除3入口・追加1入口であり、内部型Mappingは固定二範囲の対応だけを表す。Sourceとtemplateの旧3入口・重複Project投影への実参照は0。Project ContextとEM設計を現在の責務・公開集合へ同期し、先行136項目等の履歴と区別する。既存QA／SymbolのPRL-IT-005・PRL-UT-007・PPR-UT-006と各Sourceへの対応を確認した。新しい試験IDや台帳の架空項目は追加しない。

限定確認は、公開境界・Project／Queue投影・偽Root拒否・Co状態照会・Workspace採用判定の指定6 File28件が成功した。追加した複合取得2親では固定field集合・技術区画非公開・未知scopeのI/O 0・下位失敗の同一性と、実Repositoryの初期不存在→初期化→破損拒否を確認した。固定Queue CRUDの指定1親、Workspaceの選択観測／時計例外の指定2親も実保存へ接続して成功した。Co追加試験は通常一回と採用確認前後の二回取得、同版のProject世代と受付世代、対象不存在と読取り不明を有限代役で区別し、実Gitの採用成立を主張しない。

EM／Co試験／Workbench／MCPの型4設定、変更22 Sourceの整形・Lint（警告0）、HEAD差分の空白検査を確認した。Sourceの独立レビューに必須残指摘はない。今回の自己生成Rootは既存hookの回収範囲で終了し、過去保持物には触れていない。全体回帰・実AI・Docker・過去のHost境界試験の再実行は行っていない。先行Checker指摘・保全物・試験時間変動を解消したとは扱わない。

コミット前に同じ固定候補のSource・template利用先と文書を再確認し、独立レビューに追加の必須指摘はない。公開境界／Project・Queue投影12件、Co同版照会1親、複合取得2親を再実行して成功した。先の型4設定にAM／DI／Executorを加えた関係7設定も成功し、22 SourceのLintと差分空白を再確認した。これらを全体回帰の代用とはせず、保留した品質課題・過去保持物は変更していない。


### 14.20 補助公開の撤去と受付Writer統合

対象はEM RootのvalidId・hashExecutionSelection・validWorkspaceDisplayName・validWorkspaceCandidateRequestと、その全利用側。値文法は既存のCo入力OwnerとEM内部保存検査へ分け、Hash生成は既存Co selection/resolveへ移した。Hashの正規化順序・SHA-256・保存値を維持し、Executorの固定検証fixtureは自身の既知入力からNode標準で同じHashを作る。製品のCoordinator依存は追加しない。EM自身の内部検査試験は宣言元へ接続し、Hash byte反証はCoの既存選定試験へ移管した。既存QA/SymbolのRCM-UT-001・PRL-UT-007・RFD-UT-030・CPR-UT-009を使用し、新しい項目や中継Facadeは追加しない。

Workspaceのコマンドは実際の名前・相対File Path・選択・CHG・UUID・Commit幅を入力境界で検査する。ダミーCandidateによるPath検査を廃止し、保存受理後のrequestをGitへ渡す。Git接続の同一モデル再検査は削除し、VC自身の技術入力・内容・実体検査は維持する。汎用Integration本文には必要なIdentityとCommit照合を残し、Workspaceモデル検査済みと誤認しない。

残る3つのうちverifyQueueIntakeは、同じ判定を新State保存／既存Queue受付のWriter内へ集約し、本体・Root公開・Co委譲入口を撤去した。処理は保存前に停止し、Owner喪失回復へ進まない。明示未保存の受付拒否は従来のreason・no_effect・cleanupConfirmedを維持し、保存／排他解放不明はunknownとして保持する。validateResourceBookはCo所有の認証回復ファイル、validateResourceBookTransitionはQAイベント列という独立境界で必要なため維持。EM Writerへ単純統合できたとは主張しない。保存Schema・Path・Lease・CAS・認可・DI照合・期限は不変更。

Rootは129項目（91値・38型）。限定回帰・独立レビューの結果は下記へ追記する。全体回帰・実AI・Docker・過去保持物の操作は行わない。現在の変更を全公開物の最小化完了、全体QA完了、統合又はReleaseと扱わない。


限定確認では、EMの公開境界・Workspace内部検査・Queue／保存改訂・結果受領の指定5 File19件、Coの選定／Workspace入力の指定2 File14件が成功した。旧Hashの固定byte、Property順変更、未知field拒否、型変換非実行、Path・UUID・Commit幅・重複選択を確認した。受付／退役／公開実行の指定3親と、実GitのWorkspace固定・採用・回収／再入場の指定4親も成功した。これらを重複なしの40件として扱い、途中の再実行は加算しない。新State未保存拒否のreason・manualRecoveryRequired・recoveryIdと、既存State受付拒否のcleanupConfirmedを追加assertし、その指定2親だけを最終再実行して成功した。

Executorの非AI単独検証スクリプトは成功し、externalAiIssued:false・dockerIssued:falseを返した。EM・Co本番／試験・Executor・Workbench・MCPの型6設定、変更40 TS Sourceの整形・Lint（警告0、既存情報18件）と差分空白を確認した。Symbolは既存Workspace入力試験からcommandsへの検証接続を追記し、QA項目は新設していない。最初の静的確認で見つけた旧import／不要import・型追従漏れ・配置を是正し、独立レビューで検出したmode暗黙変換と受付結果の相関も是正した。Source・試験・文書の再レビューに必須残指摘はない。

実GitケースのGit不存在確認に由来するstderrと、公開実行試験のEI記録競合診断は出たが、試験結果を成功へ読み替えたのではなく各既存Oracleの終了コード0を確認した。自己生成試験領域は既存cleanup hookで終了し、観測した今回のWorkspace／公開実行Rootも不存在を確認した。過去保持物の回収は行っていない。全体回帰と実AI／Dockerは未実施。先行Checker指摘・保全物・試験時間変動は別残件とする。


### 14.21 利用側別配送ACKの撤去（実装中）

承認範囲はconsumer別transient/durable方針、配送待ち、独立受領・ACKモデルを撤去し、Taskの終端更新と関連Operationの整理を同じWriterで確定すること。保存Schema更新を含む。旧永続データは自動補完・変換せず拒否し、移行はフロントAIの別作業とする。前段14.20の未コミット変更を保持する。

着手前照合では、単純に全Operationを技術回収後に即削除するとTask保存前の中断で相関を失うと確認した。現在SnapshotのStoredTask.settlement.recoveryIdsと元Operation/Attempt相関を使用し、Task関連OperationはTask保存でのみ整理する。単発は関連Task不存在・技術終端・実履歴確認後に既存Completion Writerで整理する。新しいmode・Receipt・ACK Store・Facadeは作らない。保存成功と呼出し元への表示成功は分ける。

確認対象は、正常Taskの同時更新、技術終端未確認の保持、Task保存失敗・解放不明の保全、同ID別Attemptの拒否、回復後同時整理、単発終了と再観測、未知/旧Schemaの拒否。Writerの実履歴行照合はReceipt追加ではなく今回除去するOperationへ接続する。履歴confirmedだけから実Fileの存在を推定しない。Operation未保存除去、Cleanup不明の成功化、Provider自動再送、旧Reader、過去保持物の操作は禁止する。

Source・利用側・試験/QA接続・Architectureを更新し、限定回帰と作成担当から分離した独立レビューを行う。規則・決定権限・Releaseを変更しないため標準準拠/Release監査は対象外。全体回帰・実AI・Dockerは実行しない。以下は実装中の計画であり、成立済みCapability・完成・統合判断として扱わない。

実装途中の確認では、Taskに結合したOperationを既存Task Writerの同じ候補で除去する接続と、Taskに結合しない単発Operationの既存Completion Writerへの接続を分離した。更新していないProjectのOperationを別Project保存に巻き込まないよう、現在のProject改訂との対応を確認する。回復義務の`settled`だけでCleanupを補完せず、技術終了・履歴・未解決参照の条件を維持する。

今回の途中結果として、EMの公開境界・保存codec・Task検査の指定3 File16件、Coの状態遷移・回復Adapterの指定2 File29件、およびCoordinator経由のTask正常終端保存1件が成功した。旧ACK前提のfixtureは、削除済みfieldを補完せず、旧fieldを含む保存形式の拒否又は技術終端の検証へ変更している。これらは今回の全Consumerの型検査・限定回帰・独立レビュー完了を示さない。先行14.20の検証結果も、今回のSchema・終端変更の検証へ流用しない。

残作業は、旧配送専用試験の意味の置換、故障・回復・再入場試験の追従、現行Architecture・Symbol・QAの更新、限定回帰と固定候補の独立レビューである。特に`runtime-settlement`と`runtime-transitions`の大きな既存試験に旧ACK呼出しが残っており、Package全体の型検査はまだ成立していない。互換関数を復活させて通さず、実履歴・原子的終端・未確認時保持の検証へ接続する。

読取り専用の中間確認では、回復後の正規retryでAttempt／Operation IDをnullへ戻す更新まで新しい相関検査が拒否する反例を検出した。確定済みの同じ回復義務を保持する場合を、新たなsettled生成と分けて是正した。既存retryの状態・ID解放・retryCount増加・元Cleanup確認・義務集合維持を条件とし、IDの任意付替えは引き続き拒否する。codecの既存限定試験へ正規retryと任意付替えの対照を追加して成功した。実Storeで回復・同時整理・retryまで接続する検証と最終再レビューは未完了である。

Coordinator経由のTask終端保存は、正常・0件・取消・保存前失敗・保存後応答喪失・履歴欠測／重複／不一致／未確認の指定9ケースが成功した。Operationを先に消さず、不成立の場合はTaskと技術参照を保全し、保存成立後の応答喪失は保存失敗と区別している。今回作成した`project-execution-*`の試験Rootは終了hookで回収され、実行後の同prefixの最新残存が今回実行以前の物であることを確認した。既存保持物には処置していない。大集合ケース・その他の旧試験追従・全Consumerの静的確認・文書台帳・最終独立レビューは引き続き残作業である。

### 14.22 検査系の公開と値Ownerの整理（実装中）

承認範囲は`inspect`等の検査公開を、利用側の責務と照合して完成操作へ統合すること。名称変更・空Wrapper・深いimportへの置換では完了としない。先行14.20と14.21の未コミット差分を保持する。現行の検査規則、保存形式、認可と回復条件は、この公開整理を理由に緩めない。

最初の編集単位は、EM内で使用されない`WorkspaceResult`と`inspectWorkspaceResult`をCoordinatorの既存`workspace/record.ts`へ移すこと、および`validateResourceBookTransition`の外部利用とRoot公開要否の再確認である。前者の閉形式・getter／Proxy拒否・相対Path・欠測・変更相関・参照分離を維持し、大集合の値検査試験も新Ownerへ移す。試験用保存代役は公開された資源更新操作の検査済み結果を受け取るようにし、内部遷移検査を重ねて呼ばない。モデル自身の内部検査・試験は維持する。

続く`inspectDecision`、`inspectSingleTaskRecord`、`inspectExecutionPlan`、`inspectExecutionSelection`、`inspectTaskExecutionSelections`は、保存モデルの検査とCoordinatorの受付・選定・返却値の検査を分ける。単に全規則をCoordinatorへコピーして第二の正本を作らず、既存CRUDが返す検査済み値の再検査を減らす。未保存の外部入力はReaderの結果とは扱わず、Effect前の検査を省略しない。

限定回帰は変更した意味に対応する値検査・本番接続・公開境界・型と文書台帳を対象にする。固定候補で独立レビューを行う。全体回帰・実AI・Docker・過去保持物の操作、標準規則・決定権限・Releaseの変更は対象外。移管だけの途中状態や先行試験成功を全公開整理の完了とは表示しない。

検査Owner整理の第一単位では、Workspace結果型と検査をCoへ移し、単発記録の検査をQueue Writer内へ集約した。Coの返却値は保存済みsingleTaskへ接続し、未保存の用途結果はCoの既存受付処理で検査する。仮のPrincipal／Taskを生成する検査は撤去した。純粋な単発保存値の負例はEMの既存UTへ移し、Workspace観測の大集合・参照分離はCoの既存境界試験で維持する。

独立レビューで、資源遷移検査の動的import Consumer（executor/scripts/verify-provider-real.ts）の見落とし、移管後の型辺の契約試験漏れ、Workbenchの内部deep importを検出した。資源遷移検査は公開を維持し、既存の保存済みQA列の独立検査へ接続する。型辺は新Ownerのexactなtype-only WorkspaceResultへ差替え、旧Owner・値import・別Symbol・重複の拒否は維持する。Workbenchは既存Co Rootの型importへ統合する。新公開口・Facade・互換Readerを追加しない。これらの是正後に同範囲を再レビューする。

第一単位の再レビューでは上記3指摘の是正を確認し、同範囲の追加必須指摘は0だった。Rootから外したのはinspectWorkspaceResult・inspectSingleTaskRecordの2関数とWorkspaceResult型で、先行ACK変更を含む現在のRootは119項目（84値・35型）となる。検査名だけを置換した公開Wrapperや、外部からのEM内部importは追加していない。動的importを含むConsumerの照合不足は、当該検証スクリプトの限定型検査でも補い、Root公開数のみから不要と判定しない。

今回の限定確認は、EMの公開境界・Task検査・Workspaceモデル検査とCoの用途結果検査の4 File13件、CoのWorkspace観測・単発Adapterの指定2件、型辺の指定2件、反復受付・更新・取消・回復を含む実Store単発の指定1親が成功した（重複なし18件）。実Store親は約316秒で終了した。Co本番strict、指定試験型、EM指定試験型、Workbench型とverify-provider-real.tsの限定型検査を確認した。後者のScriptは型検査のみで、実AI・Dockerは起動していない。指定変更SourceのLintは警告0、差分空白検査も成功した。今回作成したsingle-task-stateのRootは終了hookで回収され、実行後に観測した同prefixの最新残存は今回以前の物だった。過去保持物は処置していない。

残る4つのinspectは、利用実績だけではRoot公開の必要性を確定できない。再確認では、保存済みReader値・同一Resolver出力・捕捉済み要求の反復検査と、未保存Plan・raw選定・Process境界を越える完全Decisionの受付検査が混在していた。前者は既存完成操作の返却値の受け渡しへ集約できる。後者は現在の入力・返却契約の帰結であり、Root削除だけでは閉じない。Decisionの必要投影、保存済みPlan参照、正規選定の受付境界を整理したうえで削減可否を確定する。現在の4公開を最小構成として固定せず、規則コピー・検査目的の先行保存・二重照会・空Wrapperは追加しない。第一単位の成立を全公開物の最小性、先行ACK撤去又は全体回帰完了とは扱わない。

### 14.23 旧ACK試験の追従と終端保存の反証（実装中）

旧試験の受領API・受領fixtureを、技術終端とTask保存の直接確認へ更新する。Objective再入場では、回復未開始・技術終端後・Task保存後の停止点を区別する。診断rendererと上位受付に残っていたdeliveryPendingの項目も撤去し、terminal_confirmedの共同条件と「技術回収済み・Task保存待ち」の表示へ揃えた。新しい受領Store・互換入口・代替ACKは作らない。

追従中に、未解決参照があるTaskの同版再保存でOperation除去を試みる経路、Task相関の付替え、参照中の履歴行が期限整理される経路を是正した。独立確認で見つかったTask省略による単独Completionへの迂回も拒否した。有効な別Taskへの置換候補を先に値検査してから更新拒否を確認し、無効な空配列だけで反証したとは扱わない。単独Operationは終了後に除去され、Task関連はTask保存まで保持される現行契約へ試験を接続する。

EMの状態遷移11件、現在回復の全field照合とrendererの指定2件、真正Ownerの終了保存・再入場の指定1件は成功した。EM全試験型とCo試験型も成功した。Owner試験ではblocked結果の再入場を維持し、既に確認済みの終了結果を再保存しないことを確認する。旧ACK試験の全追従・実Store再入場の再確認・台帳と最終レビューは継続中であり、先行成功を今回の全成立へ流用しない。全体回帰・実AI・Docker・過去保持物は操作しない。

続く限定確認では、current-recovery-resourcesの指定File全32件と、外部Effect不明後のexact回復から一度だけretryする実保存の指定1件が成功した。前記の同File指定ケースは32件へ含め、重複加算しない。旧「耐久受領準備ガード」と「配送登録」の2試験は廃止した段階の試験として退役させ、前者の現在境界拒否はObjectiveのexact技術終端試験・Task原子保存の相関負例・既存保存故障9ケースへ対応付ける。後者は新しい登録段階を代替新設しない。公開組立ての試験はconsumer名の分岐ではなく、実WriterのOperation保持／単独除去と技術・保存の共同条件を検証する。この時点で残したHost子Process fixtureの旧登録呼出しは、後続§14.24で追従する。

実保存の段階間取消では、技術終端を記録した直後でも最終Task保存前はOperationが保持されることを確認した。上位の停止3枝で公開結果の回復参照が欠落していたため、同じrecoveredDockerのexact IDと種別を返すよう是正した。これは新しいACKや回復判断を追加せず、保持中の実体と返却参照の相関を維持する修正である。取消・拒否・State改訂・Queue改訂の4条件、混在Recoveryと回復未開始からの再入場は成功済み。技術終端直後の取消も約43秒の限定再実行で成功し、保存されたsettled義務・物理Operation残存・同じ公開回復IDを確認した。今回のintake試験Rootは登録済みhookで回収され、実行後の同prefix最新残存は今回以前の物である。過去保持物は処置していない。

### 14.24 Host fixtureのACK追従と検査済み選定の搬送（継続中）

Host fixtureの旧配送四故障モードとrecover_delivery子入口を退役した。履歴六故障・Host清掃・Completion保存故障・fresh Process再入場は維持する。Task未結合の利用側相関二形も単独Operationとして整理し、consumer名だけで保持しない。元Receipt・発行状態・不存在checkpointは、除去前の最後の実保存Bookから観測する。新しい受領状態、互換API、製品Hookは追加しない。

初回限定実行はfixture内の変数名重複で子がEffect前停止した。修正後に構文・子入口既定拒否等の局所五件が成功した。今回の三Root（current-host-transition-10656の7CDGea／EIQ27l／b2aqhZ）は、合成Docker前提の既存Host回復Ownerで回収し、各Rootの不存在まで確認した。次のhistory_confirm_pending失敗は合成履歴に旧Schemaが残っていたためで、新Schemaへ追従後に同条件が成功した。その失敗Root（current-host-transition-34616-8g3AE0）は全Host／markerの不存在を確認して回収した。古い保持物の一括削除や移行はしていない。

単独回復の実保存で、Task関連確認の通常ReaderへOwner専用target引数を渡す誤接続を検出した。Root単位の結合にはoperationIdがないため、真正な回復でも拒否されていた。関連確認だけ既存の通常履歴Readerへ接続し、以降のexact ID・Task相関・履歴・Owner・単独Completionの再結合は維持する。独立確認で権限検査の緩和ではないことを確認し、identifiedの実保存が成功した。通常noneと履歴確認出版前中断も成功している。これらは合成Docker結果を使うHost／Filesystem試験であり、実Docker境界の成立ではない。

旧結果領収書だけを読むdocker-recovery-settlement試験は退役し、現在のexact技術終端／Task原子保存の反証へ対応付けた。Source台帳とVCの既知Consumer確認、Co設計・品質Registryも追従する。廃止済みACK Record／Resource二IDは現行台帳から除き、既存Task／回復Evidenceに必要な相関と保存条件を残す。EMの修復phase・現Operation参照中の履歴保護も現契約へ追従し、該当二File26件が成功した。Co設計追跡Checkerとその11試験、Runtime追跡Checkerも成功した。

検査の第一単位は、ObjectiveからTaskへの構築・現在状態投影で受付／保存済み選定を再検査せず搬送し、Task受付内の二重捕捉を一回へ減らすこと。独立確認でWriter返却値の凍結不足を見つけ、既存WriterのvalidState直後にJSON由来の二選定と組を一度だけ凍結した。値規則・保存byte・認可は不変更。局所四File30件と実StoreのPR-D-N-01一件で同参照搬送・三箇所の凍結・再送返却の不変性を確認し、同単位の再レビューに必須残指摘はない。Rootの残る四inspect公開を最小構成として確定したわけではなく、未保存入力と完全モデル搬送の受付契約整理は残る。全体回帰・実AI・Docker・過去保持物は操作しない。

最後に、EMの正常終端・履歴・単独終了の大きい実保存親一件が約51秒、Coの現在状態保存・pending再入場の親と子一件が約195秒で成功した。後者に残った正常checkpointの旧deliveries空配列を撤去し、旧fieldを含む負例は拒否のまま維持した。EM側では確認済み履歴と同じ時刻のcheckpointを用い、固定行一致検査を緩めていない。初回失敗・調査用の一時fixture診断は最終Sourceへ残していない。

identified初回失敗のRoot（current-host-transition-404-ch65t5）も全Host／markerの不存在とRoot境界を確認して回収した。現在のCo設計・品質Registryに残っていた旧ACK肯定要件は全文置換し、独立再確認で当該文書指摘の残件はなくなった。旧Source／試験へのSymbol・Test Catalog参照も撤去した。全体回帰や実AI／Docker試験の成功を主張せず、先行の大きい未コミット変更全体の完了又は公開物の最小性へ拡張しない。

Test Catalogの局所検査・計画二File27件も成功し、削除済み二Pathと旧SymbolのSource・QA・Architecture内参照は0件だった。最終台帳差分の独立確認にも必須残指摘はない。EM型、Co本番／試験型と差分空白確認は成功した。今回のHost Rootは回収済みで、同prefixの最新残存は今回以前の物だった。未保存Plan・外部選定・搬送された完全Decisionの受付契約に基づく四inspectの公開整理は、次の変更単位として残す。

### 14.25 同一受付内の選定再検査の削減（継続中）

助言Packet発行は、入口で捕捉した選定をProvider・役割・用途の相関とPacket Hashへ再利用する。単独callerのvalidInputは発行処理へ統合し、同じ選定の再捕捉を撤去した。技術投影と選定Hashの既存受付は別途維持し、一回検査だけで全経路を置換済みとは扱わない。単発Task記録も、同一の選定を三回検査せず、一度の検査結果を役割判定と返却へ使用する。値規則、保存形式、認可、Effect順序は変更しない。

残るinspectDecisionは、完全なDecisionモデルがCoordinatorのProcess応答で搬送されるための受付検査である。Root名だけを隠す、完全モデル検査をCoordinatorへ複製する、検査目的で再照会する方式は採用しない。操作応答の必要投影へ絞る案も独立確認したが、人間判断により完全記録を維持する。直接のCoordinator操作はEMの検査済み成功値をそのまま返し、unknownな搬送結果の受付だけでモデル検査を行う。受付では検査関数の戻り値を捨てず、その独立捕捉済みDecisionを返す。質問・回答者・日時・理由・適用結果は減らさず、Contract版や保存形式も変更しない。

この変更単位の限定試験はPacket五件、単発Task二件、MCP受付二十三件の計三十件が成功した。完全応答の深い一致、元入力からの分離と検査済み判断の凍結、選定単体は有効でも外側modeと役割が異なる場合の拒否を確認する。EM・Co本番／試験・MCPの型検査と変更SourceのLintも成功した。外部Process・実Git・実Storeを新たに起動する試験はこの単位に含めず、全体回帰・実AI・Docker・過去保持物は操作していない。

最終局所候補の独立レビューに必須残指摘はない。完全記録、未知結果の受付検査、ID・履歴・Effect・回復の相関維持を確認した。先行の大きい差分全体又は残る四inspect公開の最小性まで完了したとは扱わない。

### 14.26 Coordinatorの受付と内部搬送の分離（継続中）

人間判断により、EMのRoot名を先に削るのではなく、Coordinatorの重複受付・内部搬送を先に整理する。実装上、未保存Planとraw選定の受付は保存より前に必要であり、保存内部化だけで三inspectを外せるという先行案は成立していなかった。検査目的の先行保存、現在Catalogでの過去選定の再解決、別名Wrapper、モデル規則のコピーは追加しない。

第一単位では、公開Objective入口で捕捉済みのrequestをprivateな既存実行本体へ渡す。raw受付のrunCoordinatorObjectiveも同じ本体へ接続し、本番経路の二度目の要求捕捉を撤去した。計画照合もrequest全体を捕捉し直さず、依存Callbackの未知Planと捕捉済み許可Pathだけを検査する。取消Signal・Principal・Binding・依存Planの検査、EI記録・保存・実行の順序は維持する。新しいRunner、Authority又は保存段階は作らない。

二役割Resolverは同じ捕捉済み設定とworkTypeから生成した二成功値を不変の組へ収める。組を再検査する段階と、その段階にしか存在しなかったai_selection_pair_invalidの返却型候補を撤去した。一方の失敗は元の拒否結果を維持し、Reviewerへ明示choiceは渡さない。助言PlanとTask Packetも同じ受付内の選定再捕捉を減らし、最初の捕捉値を返却とHashへ渡す。Hashの独立した未知入力受付は維持する。

純粋三File十六件、助言四File十九件、実保存前のBinding／Plan拒否二件が成功した。要求・Principal・Signalの拒否、未知field・Getter・Proxy、許可Path、元設定変更からの分離と凍結を確認する。Co本番／試験型、変更SourceのLintも成功し、当該Source単位の独立レビューに必須残指摘はない。依存Callbackの値と真の外部受付はなお検査対象であり、三inspectのRoot撤去や全体回帰の完了は表示しない。全体回帰・実AI・Docker・過去保持物は操作していない。

追加で、公開構成からTask終了・明示受入・再入場を通す合成実行の指定一件が約128秒で成功した。成功した限定検証は計三十八件であり、件数を全Consumerの完成根拠へ拡大しない。同試験では同一要求再入場時のEI記録にrecord_identity_conflictの拒否診断も出たが、試験の合否と区別し、EIの挙動変更はこの単位へ追加しない。今回の試験Rootは既存の終了hookで回収する契約で、過去保持物の移行・処置は行っていない。追従文書の独立確認にも必須残指摘はない。

### 14.27 Task受付から選定Grantへの確定値搬送（継続中）

Task制御の四Stageに、既存要求受付のaccepted返却値から推論した局所型を使用する。未検証値を型変換で通さず、担当選定の取り出しは捕捉済みの凍結組を直接使用する。controllerのinspectTaskExecutionSelections依存を撤去した。Grant更新の左右は未知値として個別検査を維持し、操作ID・Provider・試行番号と正規化済み内容を比較する。内容比較のためだけのHash生成と、それに伴う選定再捕捉を撤去した。保存Hashは変更しない。

技術投影も、正規Grantの一回消費値又はPacket受付の捕捉値だけを受ける型へ狭めた。元Hash照合・操作結合・Capabilityの一回性・鮮度は維持する。Grant発行・preflightの未知入力受付、Provider利用可否の現在観測、外部要求の拒否はこの変更で削除していない。新しいWrapper・Registry・状態・保存段階は追加しない。

指定Task制御四件と、Grant／Packet／Provider接続三File三十九件の計四十三件が成功した。受付で捕捉した組とGrant要求の同参照、凍結、キー順差の同値、Model／設定Identity差・未知field・nullのProvider開始前拒否を確認する。Co本番／試験型とSourceのLintは成功し、既存試験内のuseTemplate情報一件は警告・失敗ではないため無関係な書換えをしない。当該Source単位の独立レビューに必須残指摘はない。三inspectのRoot公開はなお残り、この局所改善を全受付整理・Root最小化・全体回帰の完了とは扱わない。全体回帰・実AI・Docker・過去保持物は操作していない。

続いて、Grant更新で比較済みreplacementを通常発行へ生のまま渡し、再捕捉していた経路を撤去した。通常発行と更新は、捕捉済み選定を受けるprivateな既存発行本体へ接続する。発行本体は利用可否・技術適合・Hash・時刻・ID重複とMap登録の実体を持ち、単なる別名Wrapperではない。通常発行の管理確認から操作確認・捕捉の順序、更新時の元Grant・鮮度・Hash・試行・操作確認は維持する。新規の状態、Owner、公開API又は保存段階は増やさない。

更新時の操作確認Callbackが生replacementを別Providerへ変更しても、比較した同じ選定・元Hashを発行することを反証試験へ追加した。発行・更新の操作確認回数は一回ずつで、新Grant成功後の旧Grant失効・新Grant一回消費を確認する。別操作・確認例外・利用不可・ID生成失敗では元Grantの消費が引き続き可能である。最終版で同じ三File三十九件と指定Task四件を再実行し成功した。前記四十三件との重複加算はしない。Co本番／試験型、警告0のLint、当該追加Sourceの独立レビューも成功し、無関係な既存useTemplate情報二件は書き換えていない。

文書最終確認では、成功後の旧Grant除去という説明を有効な元Grantの置換へ限定した。無効・期限切れの元Grantを従来どおり退役する処理は維持しており、更新失敗時の有効Grant保持とは区別する。コードの条件変更は行っていない。限定条件の独立再確認にも必須残指摘はない。

### 14.28 保存取得とLease識別値のOwner統合（継続中）

`readSnapshotIntakeEpoch`の専用実装・Root公開を撤去し、既存`readState`の固定`intake`範囲へ統合した。返却は受付世代だけとし、元の出版確認用読取りモード、明示不存在、破損拒否、短期排他と解放不明を維持する。通常の`execution`／`workspace`読取りへ出版marker許容を広げない。CoのPort単独構成はこの取得を一度だけ呼び、未初期化を暗黙初期化しない。Operationの段階取得`readOperationStateStage`は本文を変えず、保存内部から`attempt/crud.ts`へ移した。Root名・返却・処置順は不変更で、旧所在地のWrapperは残さない。

Leaseの意味入力を受ける既存`acquireLease`のIntent保存が、閉じたOwner入力・対象・種別を確認し、正本のIdentity・回復ID・Intentを生成する。保存前の既存通知へexact回復IDを渡し、保存不明時にも同じ参照を保持する。Coは成功値のIdentityとIntentを使って元の物理Lock取得・確認へ進む。Owner喪失の既存照会も同じIdentityと回復IDを返し、Queue解放の不存在観測へ同じIdentityを渡す。二つの生成HelperのRoot公開とCo側再計算を撤去した。保存Schema・Path・排他Scope・回復Protocolと通知順は不変更で、新しい保存段階・Store・Managerは追加しない。Rootは116項目（81値・35型）となった。

今回の限定検証は、保存取得・公開境界・故障fixtureの各指定試験、Lease候補と公開境界の二File十四件、実保存の区画検査一件、CoのPort取得一件、公開Objective再入場／不正Queue二件、Lease取得・解放途中／統合結果保存二件が成功した。二File十四件の再実行や先行公開境界試験を重複加算しない。新しいOwner入力のGetter・余剰field・PID不正でcallback零、正常時の不存在→Root→保存前通知、生成Intent一致を確認する。EM型、Co本番／試験型、変更Sourceの整形とLintは成功し、既存の情報レベル八件は製品の失敗・警告と扱わない。独立Source確認に必須残指摘はない。全体回帰・実AI・Docker・過去保持物は操作していない。

残る公開物の処置は次のとおり。単なるRoot非公開化で完了にしない。

| 集合 | 現在の必要性と次の処置 |
|---|---|
| Plan／選定の三inspect | 未保存Plan・外部選定は保存前に必要。保存内検査だけでは代替できず、検査目的の先行保存・Coへの検査コピー・別名Wrapperは採用しない。受付／内部搬送の重複は先行単位で削減したが、この三公開の撤去は未完了 |
| 完全Decisionのinspect | 人間判断により完全記録搬送を維持。直接APIは検査済み成功値を返し、未知のProcess搬送結果だけ同じモデル検査を使う |
| 資源Book更新・遷移検査 | Coの独立認証記録・Home横断記録と実記録イベント列のQAが使用する。Operation保存だけへの押込みは架空Operation又は先行保存を必要とするため行わない |
| 資源・修復のsettled判定／再起動ID | 既存の保存・段階取得結果へ、対象版に結合した次操作可否を返す統合候補。Effect前分岐を保存後検査へ遅らせない。今回未変更 |
| Host／Task回復ID解析・系譜検査 | Operation保存前の対象Root・nonce・排他選定で使用する。既存の生成側から確定値を搬送する経路の全対応が必要で、保存Readerだけに置換しない |
| Principal・状態定数・完了理由集合 | 入口での主体受付、空状態投影、Co結果とEM履歴の同一語彙に実利用がある。コピーによる正本二重化を避け、今回維持 |
| 出版marker回収 | 修復再入場と終端の二地点で、個別の処置／不存在／保存保全／解放結果を確認する完成操作。保存Helperという名前だけで削除せず、修復操作の結果契約と再入場順序を一体で見直す。今回維持 |

この単位の限定成功を、残る公開物全撤去・Root最小化又は先行の大きい未コミット差分全体の完了へ拡張しない。

### 14.29 修復Checkpointの保存結果への判定統合（継続中）

`saveRepairState`の成功valueに、返す`operation.checkpoint`を既存のEM検査で判定した`checkpointSettled`を追加した。通常Writer成功と同値の再観測成功を揃え、失敗・確認不明・解放不明では従来どおりvalueを返さない。Coは既存の成功条件がすべて成立した後だけ、対象・元版・判定を同時更新する。最終Checkpoint保存直後にその判定を使い、保存失敗後の過去のtrueを使用しない。Engine・Host安全性・Cleanup・Lifecycle失敗の個別条件は維持する。八処置の値上の終端は修復全体の成功ではない。

`isRepairCheckpointSettled`のRoot公開とCo本番の呼出しを撤去した。EM内部の検査とDIの技術実装は不変更。Co試験は保存成功ごとに、返却判定と既存DI技術検査の同値性を確認する。Rootは115項目（80値・35型）で、公開型・保存Schema・新Store・Wrapper・追加I/Oは増やしていない。既存Suite内の試験追従であり、Source／Test台帳のFile集合とTrace IDは変更しない。

EMの修復値・公開境界二File十八件、no-op異常入力／技術・保存対照二件、実保存の専用Owner一件は成功した。no-opの未確認Reader・Owner失効ではvalue:null、正常は同対象のtrue、初回実保存はfalseを確認する。EM型・Co本番／試験型、変更Sourceの整形・Lintは成功し、既存の情報レベル九件は警告・失敗としない。当該Sourceの独立レビューに必須残指摘はない。Coの指定三試験（28ケース）は約31.5分で成功し、既存の終了hookと不存在確認に例外はなかった。この結果は本節のCheckpoint統合段階だけに対応し、後続の観測結果統合へ流用しない。全体回帰・実AI・Docker・過去保持物は操作していない。

廃棄判定は、既存の再入場で全用途の不存在確認済み・新保存なしとなる経路があるため、今回の保存結果だけで置換しない。出版marker回収も修復再入場と終了の各必要事実を確認する完成操作として維持しており、単なる非公開化や別名Wrapperは追加しない。これらと資源判定の残る統合は未完了である。

### 14.30 残る操作判定とState出版の責務統合（修正候補・検証前）

人間指示により、機能ごとに回帰を挟まず、本番Source・利用側・試験コード・文書の追従を先にまとめる。先行実行中だった§14.29の試験は一回で終了し、その後の回帰はまだ起動していない。現在の修正候補の型検査は通過しているが、最終の限定回帰・独立レビューは未実施であり、本節全体の完成を表示しない。

| 修正対象 | 反映内容 | 不変更の境界 |
|---|---|---|
| 資源終端・再起動終端・認証不明の閉鎖条件 | 正常Readerの`value.operationStates`に、返す同じSnapshot内の操作参照と既存判定を結合。Co本番の三検査呼出しとRoot公開を撤去 | Effect前のfresh確認、Host／Home／Lease・履歴の独立条件、モデル内部の検査 |
| 修復廃棄の終端条件 | Readerと`saveRepairState`成功valueへ判定を投影。保存なしの再入場も同じReaderから取得し、対象・版と一緒に更新。Root検査を撤去 | 三用途の個別不存在、廃棄記録欠測はfalse、保持／not_applicableとの区別 |
| 出版markerの完了 | 実装をstorageからStateへ移し、`completeStatePublication`として公開。旧名・旧所在地・互換Wrapperを撤去 | 呼出し順・前後実体照合・本文保全・処置／不存在／解放の個別結果・失敗理由 |
| 試験・利用側 | Model内部の純粋検査は宣言元へ、外部利用は完成操作の同版観測へ接続。Coの有限Reader代役は既知段階の期待DTOを供給 | Root限定Guard、実資源と有限代役の区別、故障注入のOracle |

操作観測は取得結果だけの不変な値であり、保存Schema・新しいStore・Registry・Manager・Authorityは追加しない。判別Unionの各項目は同じ操作への参照を持つ。CoはID一致だけで別版の値を混ぜず、保持Snapshotの更新時には観測も同時更新する。再起動Scopeの構築でも、必要な操作の同参照観測が欠けていれば停止し、未知をScope外へ除外しない。元の保存本文・CAS・物理排他・技術Effectの順序は変更しない。

Rootは111項目（76値・35型）。既存Source／Suite内の処置で、File集合・Trace IDを新設していない。旧helperの外部import、旧marker名と旧Root公開の残存はSource走査で確認する。対象の整形・型・Lintと差分確認は修正時の整合確認であり、動作回帰・独立最終レビューとは別に扱う。全体回帰・実AI・Docker・過去保持物は操作しない。

### 14.31 validation由来18公開の全件処置

Rootの所在だけで必要性を判定せず、全18件を利用側とEffect前の責務へ対応付けた。処置は実装Owner移管七件、既存Readerへの統合によるRoot撤去二件、現在の受付契約として維持九件である。Rootは109項目（74値・35型）、validation由来は九件となった。公開最小性や現候補の動作検証完了は主張しない。

| 処置 | 対象 | 具体的な対応 |
|---|---|---|
| 完成操作のOwner移管 | applyResourceEvent、applyResourceCleanup | 本体をattempt/crudへ移し、旧再export・Wrapperを残さない。State候補は同じ純粋更新を使用 |
| 完成操作のOwner移管 | createLocalPrincipalId | 本体をstate/crudへ移し、形式検査は同じ構築規則を参照。prefixは内部の値契約として共有 |
| 値契約の正本化 | OBJECTIVE_STATES、TASK_STATES、PROJECT_STATE_CONTRACT、dockerProcessControllerPublicCompletionReasons | モデル別typesへ移管。Objective／Taskの状態型も同じ不変列挙から定義し、値のコピーを減らす |
| Root撤去 | createDockerRestartRequestId | 既存の排他取得後Readerをrestart_preparationへ置換。exact対象とScopeから同版の要求IDを導出し、prepared返却・私有準備へ搬送。追加I/O・保存なし |
| Root撤去 | validateHostRecoveryTransitionLineage | 検査済みpending lineageをoperationStatesへ投影。新しい意図は既存Writerと保存後fresh Readerを経てから技術処置に使用。実Hostの照合は維持 |
| 入力受付として維持 | inspectDecision、inspectExecutionPlan、inspectExecutionSelection、inspectTaskExecutionSelections、isPrincipalId | 完全モデル搬送又は未保存入力の拒否に必要。先行保存・再選定・Co規則コピーで置換しない |
| 保存前相関として維持 | parseDockerTaskRecoveryId、parseHostRecoveryToken | 失敗診断・Operation未作成・Host-onlyでも元相関を確認するため、保存Readerだけへ押し込まない |
| 独立記録受付として維持 | validateResourceBook、validateResourceBookTransition | Home横断の独立認証記録Readerと、IPC後の動的QAに実責務がある。更新Producerの成功だけで搬送後の連続性を代替しない |

純粋更新・主体構築を呼ぶ内部検査は保存・外部Effectを発行しない。循環する既存Module群では移管対象は関数宣言であり、移管した値定数は型Owner側で独立初期化する。新しいManager・Registry・Store・互換Facadeは作らない。保存形式・IPC・Hash Envelope・物理排他・Timeout・安全条件は変更しない。未要求の準備値と、正常読取り後の準備不成立は区別し、Readerのcompletedだけで再起動へ進まない。

利用側と試験コードも追従した。Coにあった純粋Host lineage二試験はEMの既存restart-checkpoint Suiteへ統合し、旧Co Suite・Symbol登録を撤去した。既存Trace IDを維持し、新Suiteや互換試験Adapterは追加しない。ID期待値はCoの既存試験補助にある固定Envelopeのfixture構築へ接続し、製品の入力検査のコピーとは分離する。新Readerの同参照・Scope違い・別ID・Getter・余剰field・不正Scopeの反証を既存Suiteへ追加した。

着手前の独立読取り確認と最終独立レビューを区別した。Source・利用側・試験コード・台帳・文書を先にまとめ、その後に下記の限定検証を行った。全体回帰・実AI・Docker・過去保持物は操作していない。

### 14.32 最終の漏れ確認と限定検証

独立レビュー二系統で、削除済みCo unit Suiteへのpackage script参照一件を検出し、そのPathだけを撤去した。coverage閾値と他対象は変更せず、再確認で解消した。

限定回帰の初回ではEM一件・Co五件が失敗した。EMは認証回収の受付条件と回収不要の事実を混同した期待値、Coはplanned Bookを一律未終端とした有限Reader代役が原因だった。製品判定を変更せず、EMは正本の判定との同値を確認し、Coは既知Book参照だけを肯定事実へ結合した。未知BookとモデルReader拒否は否定のまま保持する。変更範囲の警告全件確認で、旧受領field負例が候補へfieldを渡していない追従漏れも検出した。退役fieldを明示した候補の拒否・元bytes保全へ是正し、旧ACKの機能復活は行っていない。

| 検証 | 結果と境界 |
|---|---|
| EM公開境界・資源Book・再起動Checkpoint・状態遷移の四Suite | 32件成功。実Module読込みと新Reader、相関、異常入力を確認 |
| Co Host Identity・Host観測・再起動準備順序の三Suite | 22件成功。有限代役を用い、実Docker／実Host修復は実行しない |
| EM複合Stateの実保存Reader一件 | 成功。今回の自己生成Repositoryで不存在・同版・破損を確認 |
| Co通常Task終端・退役受領field拒否一件 | 成功。今回の自己生成Repositoryで保存・拒否・元bytes保全を確認 |
| Co Platform非依存の責務分類・純粋import閉包 | 六件成功。最終走査で検出した旧二Sourceと未登録五Source、Decision受付の限定依存を現行責務へ追従 |
| EM／Co型検査、変更TS／JSONの整形・警告検査 | 成功。全体回帰の代替ではない |
| Co実行資源・Task設計の追跡検査 | ともにaccepted |

限定回帰は計62件成功。先行段階の結果を現候補全体の回帰成功へ読み替えない。Root109項目・validation由来九件は理由付きで残しており、全検査公開の撤去や最小性の証明を完了とは表示しない。全体回帰と実境界E2E、別途追跡中の残件は未実施・保留のまま維持する。
