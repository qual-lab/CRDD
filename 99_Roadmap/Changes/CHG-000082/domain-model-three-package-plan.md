# Domain Modelの3パッケージ分離案

状態: 実装・利用側追従・限定検証・独立再レビュー済（全体回帰未実施。統合判断とは別）
基準改訂版: `a7618c6d0fdade66fab1f81f24de714e21822f08`
対象: `40_Develop/domain-model`と本番・試験・Script・配布ひな型の利用側
更新日: 2026-11-12

## 構成モデル内部整理の追加区切り — 2026-11-12

3分離後の構成モデルを4領域（AI選定・Network Policy・保持設定・Manifest）と保存に再配置する。Sourceは`index.ts`、各領域の`crud.ts`／`validation.ts`／`types.ts`、`storage/store.ts`／`storage/lock.ts`の15 Fileとする。以下の§8／§9は3分離時点の対応表・公開候補として保持し、今回の現在構成は[構成モデル詳細](../../../06_Architecture/Details/configuration-model/01_Architecture.md)を正本とする。

未接続の`inspectCrosTrustPolicy`／`CrosTrustPolicy`を撤去し、固定Manifestの完成読取り`readRepositoryManifest`と結果型を公開する。外部本番利用のない`inspectRepositoryManifest`はRootから外し内部検査として維持する。公開総数は8関数・2定数・14型の24 Symbolとなるが、数合わせを目的としない。Root依存、形式・Schema、固定所在、JSON条件、Lock／CAS、部分Effectと回復参照を変更せず、旧PathのWrapper・別Package・代替Trust機構を追加しない。

Manifestは旧ReaderのUTF-8置換復号とJSON.parse条件、有効hardlinkの受理を維持する。IdentityはWB／MCPの旧全文比較と同じ復号後本文のSHA-256とし、同本文へ復号される異byte列を変更扱いしない。AI選定の厳密JSON・descriptor検査はAI専用であり、Manifest／保持設定へ一律に適用しない。他設定の生byte Hash・CAS・安全条件は変更しない。

試験のdeep参照・Module Mock・Source抽出と、EM／VCの保存Consumer閉包、Co実体IDの対照、Symbol／Catalog／正式QAを新Ownerへ追従する。基準の限定検証Evidenceは当時の記録として保持し、今回の新結果は同Evidenceの追加区切りへ記録する。予定の限定確認76件・関係11型設定と独立再レビューを完了した。予定外試験の誤起動と回収観測の限界は同Evidenceへ分離し、今回の成立を全体QA・統合・Releaseへ拡大しない。全体回帰・実AI／Docker・過去保持物は操作していない。

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
