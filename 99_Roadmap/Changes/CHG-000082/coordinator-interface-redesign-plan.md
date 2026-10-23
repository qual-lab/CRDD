# Coordinatorの公開操作・認証・AI選択の再設計計画

状態: Objective六Sourceと本番`public-*`撤去、技術CatalogとAI選択の値検査・選定を実装済み。限定回帰・独立確認を終え、長い結合回帰と設定保存接続を継続。正式API／CLI／共通認証／新設定の本番切替は未完了。
更新日: 2026-10-24
基準版: `5ccdc54a0998113d757c0eebce3ae8f06bfa932d`
変更: CHG-000082の責務整理を継続する。新しいCHG・実行Registryは追加しない。

## 1. 入力と今回の決定

利用者が提示した四文書を設計入力とする。添付の調査基準`865879e7`は現行基準より前であり、宣言名・配置・利用側を現行Sourceへ照合する。

| 設計入力 | 取り込む内容 |
|---|---|
| `CRDD_Coordinator_CLI_Public_API_Review.md` | 正式APIの`src/api.ts`、Root公開縮小、対象→操作のCLI、CLI／MCP／Workbenchの共通操作 |
| AI Model Catalog／Project AI Selection再設計 | AI Adapterの技術カタログとRepositoryの選択設定の分離、固定5役割、利用者定義の作業分類、明示指定→分類別上書き→役割既定値、Workbench編集 |
| Provider認証CLI・Public API統一設計案 | `auth status/login <provider>`、共通APIとProvider固有の技術手順の分離 |
| Coordinator Objective構造再設計・実装指示 | Objective六Source、計画／実行／依存組立ての分離、処理順と保存契約の維持 |

入力のSHA-256は順に`5c9e75ef3c68cf2b9cc76138f3871d9dc327ebc77dcc9514d82fdb54ca5c71b3`、`899758f7a46a4ced1f3db0c1eba4753f7b2cf836618a7b0882e5c811c767348b`、`e24e9659e984dc063c83a670c5d388ed1a31803b4f6608b418e0b612f71b178e`、`afc6b74a3680f3851f7ef3d8e5b03aa5af743430b5996500c3e030baf9ad57f2`。大量の入力本文や試験結果をEvidenceへ複製しない。

利用者の追加指示により、`public-*.ts`は公開性を理由に温存せず、実処理を適切なOwnerへ移し撤去する。名前だけを`api.ts`等へ変更する処置では完了しない。

添付間の差は以下で解決する。

- 認証構文は個別案の`auth claude`でなく、認証専用案の`auth status/login <provider>`へ統一する。
- 利用者の2026-10-24回答により、旧設定はフロントAIが移行し、製品は新形式だけを扱う。旧Profileの互換Reader・alias・二重Storeを新設しない。過去Evidenceと保持中②の試験物をこの移行へ巻き込まない。
- 添付のモデルIDは構造例であり、初期カタログや既定選択へそのまま採用しない。技術対応と利用者の選択を分け、利用不能・未知・曖昧な設定を別モデルへ暗黙置換しない。
- 独立Orchestratorは既に撤去済み。添付のOrchestrator担当は現CoordinatorのObjective／Task担当として読み替える。
- Objectiveの構造移管では保存六Sourceを本文凍結し、必要な同一Symbolのimport先だけ追従する。AI選択の実行参照を変える後続段階は別に保存影響を提示し、構造移管へ混ぜない。

## 2. 経路・不変範囲・停止条件

Objective内の構造整理と、公開API／CLI・設定Schema・認証Capabilityの変更を区別する。後者は利用側へ影響する破壊的変更を含む。現在のv0.22作業ブランチで実装と検証を行い、main統合・版確定・リリースは含めない。

着手前整合確認は親による現行正本・Source・直接利用側の照合と、読み取り専用確認者によるArchitecture／移行／品質観点の確認を実施した。Objective構造単位は着手可。他の単位は操作ごとの具体契約・利用側を固定してから実装する。

正本はCoordinator Architecture 01／03／04、AI Adapter Architecture、Workbench／MCPの公開接続、該当Quality Definition、コーディング規約。独立Source／契約レビュー、文書・登録照合、不足／影響確認を必要な変更単位で行う。CRDDの準拠基準を変更する依頼ではないため準拠監査を一律追加しない。公開／リリース監査は実施しない。

維持するものは、入力上限・拒否理由・認証／認可・外部送信同意、取消join・Owner喪失・同じ回復参照・再入場、未知状態とcleanup相関、利用者の明示採否とGit操作境界である。同じ状態や判断をAPIと内部Ownerで二重管理しない。

書込みは現在Repository内だけ。②のAI再試行・保持物の観測／操作、実AI・実認証・Docker起動／再起動／修復／実通信は行わない。必要な実境界確認は使用Image・入力・Effect・回収範囲を示し、別途承認を得る。Codex認証仕様は既存の固定CLIと公式情報から確認し、実ログインで推測しない。

保存形式・権限・外部送信・初期モデルの選択等、現在の判断で一意にならない事項は影響と推奨を示す。旧Schemaや不明な状態を独自の回復機構で救済せず、移行条件を満たさなければその範囲を停止する。

## 3. 現行の棚卸し

基準版のCoordinatorは56 Source、Root公開は217項目で、`.`と`./cli`がPackage公開入口である。217は維持目標ではなく、公開縮小時の利用側欠測を検出する基準集合とする。

基準版の本番`public-*.ts`は次の三Fileだった。移管結果は§9／10で追跡する。名称を含む試験Fileは、この本番Owner整理を理由に機械改名しない。

| 現Owner | 実処理 | 移管方針 |
|---|---|---|
| `objective/public-operation.ts` | 主体・Root確認、依存組立て、Objective受付・実行、Task要求生成、開発用組立て | 共有型は`objective/types.ts`、実行と結果処理は`execute.ts`、要求構築は実行からTaskへの接続Owner、具体依存組立ては`composition.ts`。旧File撤去 |
| `decision/public-operation.ts` | 受入判断、人間判断、現在Principalの観測、各保存接続 | 受入の実処理は既存`acceptance.ts`、判断の実処理は既存`lifecycle.ts`。Principal観測と具体保存接続は利用側を確認して必要最小限の既存Ownerへ配置。旧File撤去 |
| `state/public-query.ts` | Root・Revision・Principal確認、保存読取り、状態照会 | 既存`state/query.ts`の状態照会へ統合。純粋な状態計算と認可済み保存読取りの依存境界を保持し、旧File撤去 |

Rootの純粋遷移・内部Factory・Writer・短命Capabilityは、それぞれ本番Consumerの有無と同等の正式操作への置換を確認して非公開化する。試験だけの都合でRootへ残さず、逆にRoot公開削減のために必要な試験を削除しない。

## 4. 実施順と終了条件

| 段階 | 対象 | 終了条件 |
|---|---|---|
| 1 | Objectiveの構造 | 六Sourceへ移管。公開操作・署名・理由実値を維持し、型／計画／結果／具体依存のOwnerを説明できる。単なるFile改名にしない |
| 2 | 正式APIと残る`public-*` | 操作・Request／Result・認証Context・取消を確定。`api.ts`は安定操作境界、Rootはその明示公開のみ。既存OwnerからAPIへの逆依存や不要Wrapperを残さない |
| 3 | CLIと利用側 | 対象→操作の構文へ変更し、CLI／MCP／Workbenchを共通操作へ接続。候補操作は現物の文法を照合し、未実装操作をhelpへ出さない。旧一般CLIの開発検証入口はscriptsへ戻す |
| 4 | 共通Provider認証 | AI Adapterは手順定義、Coordinatorは実行調整、DI／PAは技術処理。両Providerのstatus／login、拒否・取消・終了・秘密非公開・回復を確認。未対応を成功にしない |
| 5 | 技術カタログとRepository AI選択 | `.crdd/config/ai-selection.json`一正本、固定5役割、利用者定義分類、三段階優先順、選択固定、Workbench取得／編集と既存管理権限。旧Storeは移行完了後に撤去 |
| 6 | 固定回帰・独立確認 | 公開・配布・主利用・失敗／取消／回復・観測・移行を閉じ、Arch／QA／Source／Symbol／Catalog／template／案内を一致させる。実境界未確認と既知QA残件を別記 |

認証・設定の契約は段階2で予約するが、未実装関数の成功stubや常時拒否APIを完成品として公開しない。初回Objective移管では新APIと217項目の縮小を同じ差分へ混在させない。

## 5. Objectiveの宣言単位の割当

```text
coordinator/src/objective/
├ types.ts          同じObjective処理が共有する型・依存契約のみ
├ request.ts        要求固有の型と閉検査・正規化
├ plan.ts           計画の構築・検査、計画契約定数
├ execute.ts        受付後の進行、Task委譲、実行集合、結果・回復の引渡し
├ replan.ts         再計画の検査・判断。Task再試行は既存Taskへ委譲
└ composition.ts    既存実処理を使う具体依存と受付接続
```

- `CoordinatorObjectivePlan`、実行・受付依存契約、再計画の共有型は`types.ts`。要求固有型は`request.ts`を基本とし、型という理由だけの全集積をしない。
- `createCoordinatorTaskExecutionSet / createCoordinatorObjectiveResult / inspectCoordinatorWorkspaceResults`は計画検査でなく実行・結果のOwnerへ移す。関連する局所検査も依存閉包単位で扱う。
- `buildObjectiveTaskRequest`は要求の実行用途変換として配置し、AI Adapterの技術計画と混同しない。
- `runCoordinatorObjective`の進行判断と具体Store／Port組立てを区別する。`composition.ts`へ旧File全体を改名して終わらせず、逆に`execute.ts`から`composition.ts`へ値逆依存を作らない。
- `validId / validText / inspectStrings`は文法・長さ・空集合・順序の差を比較してから共通化する。同名だけで拒否条件を共通化しない。
- 開発用Candidateは現実の利用側を維持するために必要な範囲で内部に残すが、Rootや正式APIへ試験用Factoryを増やさない。

## 6. 利用側・試験と移行

| 母集団 | 予定処置・反証 |
|---|---|
| CLI／MCP／Workbench本番 | 同じ正式操作へ接続。Request／Result、認証主体、取消と送信同意を保持し、内部deep importへ逃がさない |
| Objective／Task／Decision／State試験 | 受付・重複拒否・一連実行・部分再計画・Owner喪失・再入場・応答喪失・取消・品質受入の現在Oracleを保持 |
| Version Control／Domain Modelの利用側閉包 | 移管先と意味を追従し、欠測・余剰・迂回を拒否する。母集団を縮めて合格にしない |
| Checker・Symbol・Test Catalog・Task Traceability | 公開Module集合、実Pathと安定Symbol／検証関係を同じ改訂へ追従 |
| template・scripts・README／Workflow・現行Architecture／QA | CLIと新設定、移行順・停止／復旧を追従。過去Evidenceは改変しない |
| 旧設定・Profile参照・保存済み実行参照 | フロントAIの事前棚卸しと明示移行。新旧正本を並行稼働させず、既存実行のModel／Effort／Identityを黙って変えない |

AI選択の発火例は登録済み役割・分類・対応Model／Effort。分類別上書きなしは役割既定値へ、明示指定ありはそれを優先する。未知役割／分類、不正Override、非対応Model／Effortは拒否し、観測不能は不明のまま停止する。更新競合は上書きせず、実行開始後の設定変更は進行中Attemptへ適用しない。

認証は正しいProvider・既存Home・明示loginでのみ実行し、status結果だけをlogin完了にしない。事前取消、Home不明、誤Provider、非TTY、終了不明・cleanup不明では既存の停止・同じ回復参照を維持する。API Keyや別課金のfallbackはない。

## 7. 現在地

四添付・現行正本・本番`public-*`三File・RootとCLIを照合した。着手前の読み取り専用確認と計画・Architecture／QAの限定独立確認を完了し、残指摘0。旧形式Readerなしは利用者回答で確定した。全体の実装・回帰・完成後レビューは未完了。前の構造整理の成功記録は基準の成立範囲として利用し、新しいCLI・認証・選択設定の検証結果に流用しない。

## 8. Objective初期移管の確認 — 2026-10-24

共有する`CoordinatorObjectivePlan / CoordinatorObjectiveExecutionDependencies`二型を型専用`objective/types.ts`へ移した。要求固有型は`request.ts`に維持する。計画以外の三関数`createCoordinatorTaskExecutionSet / createCoordinatorObjectiveResult / inspectCoordinatorWorkspaceResults`は`execute.ts`へ移し、`plan.ts`を計画検査の純粋依存閉包へ限定した。移管三関数と共有利用する既存`validId`の本文、計画検査の本文は型除去後に基準版とexact一致する。

Rootの217名と型／値区分は不変。内部受付・UT・公開Root・Symbol・純粋Source分類・Checkerの公開Module集合を実Ownerへ追従した。保存六Sourceの差分は0であり、新しいWriter・状態・中継や実行注入口はない。

| 確認 | 結果と限界 |
|---|---|
| Coordinator静的検査 | `npm run check`成功。整形・型・lint・Runtime／Task Traceabilityを確認し、既存lint情報64件を維持 |
| 直接影響の四Suite | `task-platform-independence / public-owner-boundary / objective/plan / public-contract`を既存Module mocksと直列実行で確認。最終28成功、失敗・取消・skip・todo各0、25,589.9137ms、Exit 0 |
| 独立Source確認 | 型Headerの旧Owner説明一指摘を是正し、追加の三関数移管・依存・Root・登録を含む再確認は残指摘0 |

この結果は初期移管の限定確認であり、Objective全体の六Source再編完了ではない。残る共有依存型・受付／依存組立ての分離、`public-operation.ts`撤去、回復・Owner喪失を含む本体回帰とBehavior／Flow Reviewを継続する。新API・CLI・認証・選択設定を実装済みと扱わない。実AI・実Docker・実認証と保持物の観測／操作は行っていない。

## 9. Objective六Sourceへの分配 — 2026-10-24

旧Objective受付Fileを撤去し、既存の処理を次のOwnerへ分配した。進行と本番構成を混ぜた全体改名ではない。

| Owner | 移管した責務 |
|---|---|
| `types.ts` | 公開実行・開発用構成・受付の依存型と再計画の共有三型。すべて型専用依存 |
| `execute.ts` | 公開受付後の検証と進行、既存受付Lifecycle、ObjectiveからTask実行入力への変換、局所Identity／Binding検査 |
| `composition.ts` | 一つの本番依存構成、公開実行の呼出し、既存の開発用構成 |
| `request.ts / plan.ts / replan.ts` | 要求検査／計画検査／再計画判断。Task入力の方針付与は要求検査へ混入させない |

既存の`validId / blocked`と本文・結果が一致する局所処理は既存実装を共有した。移管関数は本文一致、内部export以外の公開217名・型／値区分は不変。保存六Sourceと過去Evidenceの差分は0。値依存の逆流・新しいWriter／State／Lock／中継はない。

| 確認 | 観測結果・限界 |
|---|---|
| 静的・登録 | Coordinator `npm run check`成功。整形・型・lint・Runtime／Task登録を確認。既存lint情報64件は不変 |
| 短い直接回帰 | 公開境界・純粋依存・Objective UT・公開契約の29件成功、失敗／取消／skip／todo 0、28,065.8994ms |
| 受付・再入場と診断 | `public-operation.integration` 10件成功、失敗／取消／skip／todo 0、290,220.2365ms |
| 利用側閉包 | Version Control 12件、Domain Model 4件が成功。Domain検査の廃止済み受入専用File・旧結果File参照も、同じ現在Ownerの検査へ修正 |
| 独立確認 | Sourceの関数本文・公開契約・動作不変は指摘0。文書の件数・型専用辺・現在Ownerの二原因を是正し、再確認は残指摘0 |

全受付・Task連携・取消／回復の連続回帰は64件成功、失敗／取消／skip／todo 0、2,207,100.0006ms、Exit 0で完走した。Objective受付、実行集合、Owner喪失、耐久中断後のexact再入場、公開受付、入力契約を確認した。外部AI・実Docker・実認証の試験ではない。初回短回帰では型辺走査がSymbolを一件ずつ返す仕様への追従不足で1件不合格となったが、許可名と型専用制約を維持した是正後の29件を上記の最終結果とする。四添付全体と実境界E2Eの完成ではない。

## 10. 判断・照会の本番`public-*`撤去 — 2026-10-24

基準`7a75d6995`から、受入判断二関数を`decision/acceptance.ts`、人間判断二関数とPrincipal観測を`decision/lifecycle.ts`、状態照会二関数を`state/query.ts`へ統合した。旧二Fileを撤去し、本番Coordinator Sourceに`public-*.ts`は残らない。内部の判断・照会計算と、認証・Root・Revision・Store確認は別関数のままであり、公開という理由の中継を作っていない。

Sourceは55 File。純粋集合18と業務操作8は不変で、Adapter集合だけ6から4へ減った。値逆依存・自己importを残さず、Rootの217名・署名・型／値区分、保存六Source、過去Evidenceは不変。公開API自体の縮小は後続であり、File撤去を正式API切替完了にしない。

| 確認 | 観測結果・限界 |
|---|---|
| 静的・登録 | Coordinator `npm run check`成功。既存lint情報64件を維持 |
| 公開境界・依存・入力契約 | 実行した三Suiteで24件成功、失敗／取消／skip／todo 0、26,289.6363ms |
| 利用側閉包 | Version Control 12件、Domain Model 4件成功。Identity観測を使わないLifecycleをそのConsumer集合へ追加しないよう実Symbolで照合 |
| Source独立確認 | 移管七関数と既存関数の本文一致、公開・保存・値依存を確認し指摘0 |
| 文書・登録独立確認 | 現Owner説明一件を是正。55 Fileの和集合、純粋集合・業務集合不変、Registry／Symbol実在、旧Path現在参照0を確認 |

受入判断・公開受付・Workspace・品質受入の四Suiteは36件成功、失敗／取消／skip／todo 0、3,272,949.5515ms、Exit 0で完走した。Workspace内の直列Task、固定・採否・二親Merge・Ref回収、保存失敗後の別Process再入場、元理由と回復参照の維持、Objective受入後のMilestone明示三判断と改ざん拒否を確認した。先行Objective連続回帰64件とは別の実行集合であり、QA正式項目数に合算しない。実AI・実Docker・実認証・保持②の観測／操作は行っていない。

## 11. 後続の具体化で確認した境界

### 正式API

- `openTaskSession`は既存の開始・観測・取消・待機・closeの同一実装を公開する。Workbenchは複数HTTP要求をまたいで使用するため、単発`runTask`だけへ置換しない。新しいMapや取消機構は作らない。
- `runTask`をCLIの一回実行へ用いる場合も、同じSessionを開始・待機・finally closeする既存Ownerへ委譲する。認可・回復・本文保存をAPIで再実装しない。
- Project初期化のRoot／Binding導出、回復のexact対象確認と種類別処理は既存の実Ownerへ置く。`api.ts`にWriter、Authority生成や汎用Dispatcherを持たせない。
- 現Rootの明示受入操作は既存Capabilityとして照合し、直接Consumer不在だけを根拠に品質受入への到達性を削除しない。最終公開集合は実利用側とSPEC-000002／QA-000003の義務を照合する。

正式Task APIの最終切替は、技術カタログとRepository別選択の本番接続後に行う。現行`AiProfileCatalogStore`は保存・採用まで持つため、そのまま正式Session入力へ露出させると直後の刷新で再変更又は互換層が必要になる。将来の入力を推測したPortも追加しない。Task以外の既存操作の整理は独立して進められるが、Rootを`api.ts`だけへ縮小するのは、実際の最小Task入力と全利用側接続を確認した後とする。

読み取り専用の要求・実Owner再照合により、`acceptResult`、`runTask`、`openTaskSession`の維持に追加の人間判断は不要と確認した。受入操作はSPEC-000002とQA-000003の明示品質判断を維持し、既存`decision/acceptance.ts`へ委譲する。単発CLIと複数HTTP要求にまたがるWorkbenchは同じ既存Sessionを利用する。新しいMap、Authority、Lock又はRecoveryを作る判断ではない。

### AI選択設定

- AI Adapterの技術カタログ、CoordinatorのRepository別設定、Task／Attemptへ固定した具体選定を別の責務とする。旧Host／Repository Profile Storeを技術カタログの第二正本として残さない。
- 選定順序は明示指定、役割と作業分類のexact上書き、役割既定値。設定不存在、不正、未知分類、非対応Model／Effortは補完せず停止する。例示Modelを既定として採用しない。
- 保存・Grant・Task Packet・回復は同じ具体Provider／Model／Effort、選定元、技術カタログと選択設定の内容Identityへ結合する。Profile IDだけの置換では閉じない。開始済み実行を新設定で再解釈しない。
- Workbenchは既存の認証・選択Repository・manager／administrator権限を維持して、そのRepositoryの設定だけを編集する。CROS Host設定へのfallbackはない。MCPに設定変更Toolを自動追加しない。
- 任意の作業分類追加を維持し、独立した件数・表示名文字数の製品制限は追加しない。設定File全体の技術的byte境界をReader／Writerで一致させ、既存のbounded snapshotとRoot・親・File Identity確認を利用する。既存HTTP一要求の上限をRepository全体の件数制限とは扱わない。
- 更新CASは既存のFilesystem排他の中で現在の内容Hashを再読し、期待Hash照合、短命Fileへの保存、不可分置換、読戻しを行う用途限定処理とする。create-onceの`committed-json`を削除してから再作成する方式は採らない。汎用Store Framework・Registry・監視は追加しない。
- フロントAIが旧Snapshotと再入場対象参照をexactに解決し、書換え・読戻しを確認してから切り替える。不足・曖昧な旧参照では移行停止。保持②と歴史Evidenceは対象外で、製品に旧Readerを残さない。

技術カタログはProviderとModel識別子の一意な組ごとに、`identifierKind`（`exact`又は`alias`）、対応Effort、対応する実行用途、既知の互換理由だけを保持する。役割・Tier・既定Effort・現在のログイン状態は混入させない。対応用途は役割表から推測せず、既存の計画契約と検証済み条件の共通範囲から宣言する。

| 既存の技術根拠から引き継ぐ組 | 識別子の意味 | 対応用途 | 対応Effort | 留意点 |
|---|---|---|---|---|
| Codex / `gpt-5.6-sol` | exact | `advice` | `low / medium / high` | Taskのcode-mode制約が既知。Taskへ暗黙転用しない |
| Codex / `gpt-5.5` | exact | `task` | `low / medium / high` | 現行固定Taskの対応。助言対応を引数生成だけから推定しない |
| Claude / `opus` | alias | `advice / task` | `low / medium / high` | 未観測の解決後Model版をexactとして保存しない |

旧Adapterの許可候補に存在するだけの`gpt-6-astra`、及び現在計画契約に対応根拠のない`xhigh / max`を、新しい選択可能集合へ自動移行しない。これは別Modelへのfallbackではなく、未確認構成の実行前拒否である。新Modelの採用・固定実行物での対応確認は最後の判断／実境界確認へ分離する。

互換理由は可否の補足であり、理由文字列からfallback先を決めない。旧Profileの`gpt_5_6_code_mode_only_host_unavailable_in_fixed_linux_runtime`は`gpt-5.5`自体の性質ではないため、`gpt-5.6-sol`のTask非対応理由へ対応付ける。用途とEffortは初版では独立配列の直積とし、実例のない用途別Matrixを追加しない。

上表のProvider／Model／Effort／用途の組を技術正本一つで検査し、計画生成とEffect直前で同じ組を確認する。旧Descriptor内のModel値を別正本として残さず、移行中の比較Oracleと最終の導出元を区別する。新設定の保存・実行・回復は`modelIdentifier / identifierKind`を結合し、Provider aliasを`exactModelId`と呼んで再現性を過大主張しない。

### Codex認証の仕様確認

OpenAI Docsの[認証手順](https://learn.chatgpt.com/docs/auth)と[CLI引数](https://learn.chatgpt.com/docs/developer-commands?surface=cli)を2026-10-24に確認した。Headless向けの`login --device-auth`と`login status`は公式仕様に存在する。ただし現在の固定Image内CLIでの対応・Home・stdio・終了確認は別の検証であり、公式文書だけでその実測を代替しない。API Key／Credentialコピーのfallbackは採用しない。端末の一回コード・Tokenを診断や記録へ複製しない。

## 12. 新形式の値検査・選定の段階実装 — 2026-10-24

`eaf366a25`の構造単位の次に、新しい技術CatalogとRepository別AI選択の値処理を実装した。AI Adapterは既存の`catalog/{types,validation,resolve}.ts`と内部`model-catalog.json`へ配置し、公開追加は`getAiModelCatalog / resolveAiModelSelection`の二操作だけ。Coordinatorは`selection/types.ts`と`selection/resolve.ts`で五役割・任意分類・上書きを検証する。新Package・Registry・保存State・排他・実行許可は追加していない。

Modelの用途・Effort・識別方式は§11の確認済み集合だけを継承する。旧Profileで混在していた希望設定から用途を機械変換しない。設定は全体を検証した後、明示指定→分類上書き→役割既定値で選び、技術Catalogと設定本文のIdentityを返却値へ固定する。未知分類は明示選択があっても拒否する。役割・分類は権限ではなく、`opus`はaliasのまま記録する。

| 確認 | 観測結果と限界 |
|---|---|
| AI Adapter通常回帰 | 静的検査成功、37件成功・失敗／取消／skip／todo 0、5,503.3905ms。初回の試験複製に新JSONと値依存の追従漏れ一件を是正した。Windows Link等の実行制限による三件は、同じRepository内試験だけを通常権限で確認して成功。拒否条件は緩和していない |
| Coordinator静的・直接回帰 | 静的検査成功（既存lint情報64件）。新選定三件と既存の型／純粋閉包六件が全九件成功、614.2561ms。Domain Model／Version Controlの利用側閉包16件も成功 |
| 技術Catalog独立Source確認 | 未知field・重複・Proxy／Getter拒否、深い不変化、内容Hashと選定の相関、alias維持、Catalog注入不可、Authority非発行、旧関数本文不変を確認し指摘0 |
| Repository選定独立Source確認 | 優先順位、不正明示値のfallbackなし、全設定検査、未知分類拒否、継承Propertyを参照しない辞書照合、正規化Hash・不変結果を確認し指摘0 |
| 文書・登録の独立確認 | 新Source／Suiteの登録、採用済み三組の固定Oracle、Test Catalogの意味追従を是正。是正の重複適用も除去し、新候補の再確認は両確認者とも残指摘0。Symbol全ID重複0、実Source57＝登録Path一意57。Test Catalogは385件valid、実行開始なし／Effectなし |

本節の結果は値処理完了時点の記録であり、本番切替の完了ではない。後続の内部Store実装は§13を参照する。旧Profile本番Consumerを新設定の並行正本として維持する方針ではなく、保存・Task／Grant／回復・Workbench／MCP／CLIを新形式へ接続後に撤去する。この値処理完了時点では新設定Fileの作成・移行・本体実行設定の変更は行っていない。設定Storeのbyte境界・Root・既存排他・CAS・原子的保存・読戻し、開始済み選定の耐久固定、公開入口の切替と全体回帰は残る。人間の実認証・新Model採用・実AI試験は最後に分離する。②と保持物は操作していない。

## 13. Repository設定Storeの段階実装と検証境界

用途限定の保存をCoordinatorの`storage/ai-selection.ts`へ置く。Domain Modelは既存の検証済みRoot・安定読取り・排他だけを提供し、AI選択の意味を引き取らない。保存B六Sourceの本文・Schema・CAS・順序は変更しない。設定は`.crdd/config/ai-selection.json`一つであり、世代別のSnapshot列や新しいRegistryを作らない。

Readerは領域を作成しない。Writerの初回作成だけ、最初の管理認可成功後に既存`ensureRepositoryRuntimeDataArea(root, "config")`を利用する。独自mkdirやGit Ignore編集は持たず、既存APIの拒否・不明は停止する。書込みではFileのfsyncを行うがDirectory fsyncや電源断・Process crash後の耐久確定は主張しない。

| 段階 | 所有者・成立条件 | 失敗時 |
|---|---|---|
| 読取り | 発行済みRepository Root、親chain・実Path・通常File・単一Link・読取り前後の同一性。全体1MiBまでを安定読取りし、厳密UTF-8・JSON重複拒否・新Schemaを検査 | 真正不存在、内容不正、容量超過、観測不能を区別。旧ProfileやHost設定へfallbackしない |
| 書込み受付 | 同じRoot、閉じた`expectedIdentity / config`、同じbyte上限、現在の管理認可。期待Identityはnull又は正規化本文SHA-256 | 不正要求・認可未確認では公開Effect 0 |
| 排他・CAS | 既存Filesystem Store排他を同じ`ai-selection.lock`に利用し、現在設定を再読して期待Identityを比較 | 競合は上書きしない。既存排他の観測不能・回復参照はそのまま保持する |
| 準備・公開 | 同階層の短命UUID Fileへ排他的に作成・書込み・close。Root・現在Hash・認可を再確認し、旧正本を削除せずrenameで置換 | 不明をsavedにせず、自動再保存・旧値への自動Rollbackをしない |
| 読戻し・終了 | 同じReaderで期待する設定Identityと一致し、一時Fileと既存排他のcleanupを確認 | 公開確定不能とcleanup不明を区別する。同じ既存回復ID又は今回の短命Fileの非Authority参照を返す |

成功は公開・読戻し・cleanupが全て確認できた場合だけとする。短命Fileは今回作成した実Identityに一致するものだけを回収し、由来不明や置換後のFileを削除しない。設定Fileと通常の応答以外の新State・履歴列・監視・Recovery Frameworkは作らない。File単位の原子的置換は通常保存の意味であり、電源断の耐久保証ではない。

短命Fileの回収が不明なら、非正本・非Authorityである相対名と観測済み実Identity、公開前／公開確定不能／読戻し確定後の区別を、既存フロントAI／運用手順へ引き渡す。自動再送・自動発見・新しい清掃APIは設けない。介入では同じ検証済みRoot、親chain、非正本名、通常File、単一Link、exact Identityを再確認した一件だけを対象とし、不一致・不存在・観測不能を清掃完了へ畳まない。応答喪失・Process crashで参照も失われた場合に必ず回収可能、無人で残存0、という追加保証は置かない。作成時Identity自体が観測不能ならその不足も明示し、削除根拠を補完しない。残存は通常Reader・AI実行から参照しない。

読戻し後に管理認可が失効した場合は保存前の拒否と区別し、保存Effect成立後の非成功・本文非公開結果へする。既存排他のoperation完了後cleanup不明も成功へ変換せず、元のreasonと回復Identityを保持する。未認可時の作成0と、認可後の準備File作成・設定公開・回収を異なる事実として扱う。

このCASは同じ既存排他に参加するWriter間を直列化する。手編集は引き続き可能だが、排他に参加しないEditorが最終Hash確認とrenameの間に同時書込みすることまで、OS横断で原子的に拒否できるとは主張しない。手編集との直前差は再読Hashで検出し、同時編集を保護するための新しい常駐監視・Lock Frameworkは追加しない。

### 合成Repositoryでの段階確認結果

設定Store十件と、既存の選定・純粋閉包・Domain／Version Control利用側を合わせて35件成功、失敗・取消・skip・todo 0（最終確認9,847.0299ms）。静的検査も成功し、既存Lint情報64件は変更していない。Test Catalogは386件validで、Catalog検査自体の試験開始・Effectはない。初回の利用側検査三件は、型専用Consumerと値Consumerの登録を分け、領域確保失敗の元fieldを明示保持して是正した。検査条件の例外は追加していない。

| 反証した条件 | 実際の観測 |
|---|---|
| 受付・読取り | 未認可・不正閉形式・不正期待Hash・Getter／Proxyは作成0。偽Root、旧形式、重複JSON、不正UTF-8を拒否 |
| 容量・File実体 | Unicodeを含む1MiB丁度を保存・読戻しし、1byte超過を拒否。Symlink／hardlink・読取り中の置換を拒否 |
| 通常保存・認可 | 初回保存、整形によらない内容CAS、競合保全、更新後読戻しを確認。公開前失効では正本なし、公開後失効では本文なしunknown |
| 保存・回収故障 | temp作成、rename、公開後読取り、temp削除、Lock回収を個別故障。temp置換・hardlink化では対象を削除せず、通常Readerも代用しない |
| 複合故障 | temp削除不明にLock close失敗を重ね、Lock回収成功／不明の両方で同じtemp参照・公開段階を保持。後者は同じLock回復IDも保持 |
| 下位失敗の搬送 | 領域確保APIを元契約の有限代役にし、Effect・cleanup・retry・exact回復参照等の全fieldが失われないことを確認。実Ignore障害の再現とは扱わない |

独立確認では、temp回収不明の後にLock終了が失敗すると参照を失う一件を検出した。新記録を作らず、関数内の公開段階とtemp観測を最後まで保持する最小是正を行い、上記複合故障で反証した。是正後候補のSource・文書／登録の独立再確認は両者とも残指摘0。参照はRepository Rootから直接解決できる`.crdd/config/<temp>`へ統一し、実Identity・削除条件を維持した。Symbol全IDの重複0、新Source58の登録欠測0、Manifest検査complete／issues 0も確認した。

本番管理画面・Access Management認可への接続、Task／Grant／回復への選定固定は未完了。手動temp介入そのもの、Process crash・応答喪失後の回収は未実証であり、無人で残存0を保証しない。通常Store試験のdescriptor close故障は実close後に失敗観測を注入する代役で、OSで実際に閉じられないHandleを生成した証明ではない。本体設定の初期化・移行、実AI・認証・Docker・保持②は操作していない。

合成Repositoryで、読取りだけでは作成0、別Root／Link／hardlink／読取り置換拒否、byte境界とUnicode、重複JSON拒否、期待Hash競合、通常保存と読戻し、保存失敗・公開不明・一時File cleanup不明・既存排他cleanup不明を試験した。試験は外部AI・認証・Docker・保持②を利用しない。本体設定の移行・初期Model採用はこの単位に含めない。
