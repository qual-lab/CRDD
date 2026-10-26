# Coordinatorの公開操作・認証・AI選択の再設計計画

状態: Objective・正式API／CLI・Repository AI選択・共通認証の実装、本番Consumer接続、追従漏れの是正と非AI影響回帰を限定完了。実AI・実認証・人間確認・本体設定の実移行は最後に分離する。
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

## 14. 選定の本番接続と保存形式の変更境界

設定Storeの段階Commitは`5ce75c12c`。次は、旧Profile IDが兼務していたモデル選定と実行Policyを分離する。添付の固定五役割から、一般の読取り助言は`advice`、Objective整理・計画は`coordinator`、複数結果の統合は`result_integration`へ一意に対応する。Workbench等の入口名から役割を決めず、Roleを権限にしない。現在、この対応に人間判断は必要ない。

| 現行の所有者・参照 | 新方式の処置 | 保持する条件 |
|---|---|---|
| AI Adapter `provider/plan.ts`とCodex／Claude計画の`exactModelId` | `modelIdentifier / identifierKind`として明示。技術Catalogで新規実行可否を確認 | `opus`をexactへ偽装しない。Model追加・fallbackを同時に採用しない |
| `task/requests.ts`のProfile解決・受付、CLIの旧Store生成 | 選択Repositoryの設定から一度解決し、選定結果を受付へ固定 | 設定不存在・不正は実行前停止。進行中は新設定で再解釈しない |
| `execution/advice.ts`、`execution/preparation.ts`のPacket・送信Grant | 同じ選定tupleを搬送・照合 | 送信同意・一回消費・取消・外部送信範囲を維持 |
| `execution/authority.ts`、`execution/controller.ts`のProfileとHome／Grant結合 | 選定IdentityとProvider Home／操作Identityを区別 | 認証Offeringは既存Provider固定対応、隔離と資源はDocker Isolation、進行はCoordinator。選定だけで実行許可を作らない |
| `state/model.ts`のSingleTask、`storage/model.ts`等の実行Identity | 単一のnested `executionSelection`へ置換する別Schema単位として扱う | 保存Bの構造整理時の凍結を黙って解除しない。変更field・Reader・Writer・回復・フロントAI移行を対応付けてから変更 |
| `execution/recovery.ts`のProfile再利用 | 保存済みtupleをそのまま再観測へ搬送 | 回復時に新設定Store／現在Catalogで過去の選定を解き直さない。unknownとexact回復参照は保持 |
| Workbench設定画面／MCP／Root API | 選択Repositoryの設定へ接続し、旧Profile Consumerがなくなった後に旧Store／公開API撤去 | Workbenchのmanager／administrator認可を維持。MCPへ新しい設定変更Toolを自動追加しない |

保存tupleは`provider / modelIdentifier / identifierKind / reasoningEffort / purpose / catalogIdentity / configIdentity / role / workType / source`の十項目だけとする。raw設定、旧Profile ID、Catalog改訂番号、Tier、認証情報やAuthorityは複製しない。これは今回実行の値であり、認証済み・実行許可済みという意味ではない。

既存`selection/types.ts`は、型と保存用の純粋なclosed codecを同居させる`selection/model.ts`へ置換する。`selection/resolve.ts`は現在Catalogによる新規選定を所有し、codecは現在Catalog・設定Store・I/Oへ依存しない。これにより、保存復元時に過去の選定を現在のカタログへ合わせる誤りを避ける。新しいvalidation層やRegistryは作らない。型群をTask状態Ownerへ丸ごと移すこともしない。

旧ProfileとTierがOffering・operationMode・隔離条件を暗黙に表した判定は、一括削除しない。各拒否条件を上表の既存Ownerへ一対一で接続し、同じ反例がEffect前に拒否されることを確認する。内部認証probeはRepositoryのRole選定と切り離し、Providerの固定技術仕様を使用する。通常実行の選定条件をprobeへ流用しない。

実装は、純粋codec、AI Adapterの識別方式、Packet／Grant、実行調整、保存Schemaと回復、公開利用側、旧Store撤去の順に安全な単位で接続する。Schema切替前には、旧Profileと保存済み実行参照の移行対応をフロントAI向けに確定する。未移行の旧形式は新Readerで受理せず、保持②と歴史Evidenceは移行・清掃対象外とする。

### 保存選定の値モデル — 段階実装

`selection/types.ts`を`selection/model.ts`へ置換し、既存型と`inspectExecutionSelection`を同居させた。十項目の閉形式・primitive値・Hash・役割／用途の相関を検査し、独立して凍結する。現在Catalog・設定Store・I/Oを利用しないため、後のCatalog変更で保存済みalias・Model・Effort・選定元を変えない。現在実行可能かどうかは新規選定の検査と区別する。

保存codec二件を既存の選定Suiteへ加え、内部Store・純粋閉包・利用側を合わせ37件成功、失敗／取消／skip／todo 0（最終確認9,521.2636ms）。静的検査も成功。Catalog外の合成`retired-model / max`は保存codecで値を維持し、新規Resolverでは拒否される。これは当該Modelを採用する操作ではない。Getter／Proxy／暗黙変換のhook実行0と、過剰・不足・相関不正の拒否を確認した。既存保存B六Sourceの本文・Schema、現在State、Packet、実行・回復経路はこの段階では変更していない。Sourceと文書・登録の独立確認は、Suite HeaderとCatalogの検証範囲表示を是正して両者とも残指摘0。新SuiteやQA IDは追加していない。本番接続は後続であり、四添付全体の完了ではない。

合成Repositoryで、読取りだけでは作成0、別Root／Link／hardlink／読取り置換拒否、byte境界とUnicode、重複JSON拒否、期待Hash競合、通常保存と読戻し、保存失敗・公開不明・一時File cleanup不明・既存排他cleanup不明を試験した。試験は外部AI・認証・Docker・保持②を利用しない。本体設定の移行・初期Model採用はこの単位に含めない。

### 共通実行計画の選定形式 — 段階実装

AI Adapterの助言・Task計画は四項目のModel選定を必須とし、技術Catalogの用途・Effort・識別種別を照合する新形式へ切替えた。計画はModel識別子・alias種別・Catalog Identityを返し、CoordinatorのCommand SnapshotとHashも同じ値を保持する。助言Commandの破壊的変更を改訂2として区別し、旧改訂・旧fieldを新形式として受理しない。内部認証probeはModel選定を受け付けず、選定済みモデルの引数を認証確認へ流用しない。

両Providerで結果Schemaを独立したJSON値へ固定し、Getter・Proxy・toJSON・循環・非JSON値を文字列化前に拒否する。保存選定の十項目Hashは現在Catalogを読まず、当時の構成・役割・選定元を値相関に含める。Codexのdevice login引数と固定Offering／Originは認証記述へ追加したが、共通認証Lifecycle・公開CLI・固定Imageでの実確認は後続である。

静的検査はAI AdapterとCoordinatorで成功し、変更影響の局所・結合十二Suiteは117件成功、失敗・取消・skip・todo 0（最終6,358.3815ms）。AI Adapter全回帰は37件成功、失敗・取消・skip・todo 0（5,286.344ms）。通常sandboxの保存試験三件はLink／公開操作の実行制限で失敗したため、同じRepository内の自己生成試験領域に限定した通常Windows実行で局所六件と全回帰を確認した。実行制限を検査条件の緩和で隠していない。初回の局所不合格は、旧試験が技術Catalog外の架空Modelを正常値に使っていた点、probeへModel引数を期待していた点、助言のModelとHome側の既存Profile相関が異なる点を原因別に是正した。未知Model・既存の相関拒否を緩めず、正常fixtureを採用済み技術組へ合わせた。実AI・Docker・実認証・本体設定・現在State・保持②は操作していない。

Sourceと文書の独立確認では、新Schemaの改訂値、結果Schema文字列化前の安全な固定、probe直下の選定／Schema指定拒否、新認証記述のexact値／凍結、Header／Catalogの検証範囲を是正対象とした。新Suite・QA・互換Readerは追加せず、既存試験と登録へ接続して上記の最終候補を再検証した。認証記述の値試験を固定Imageの実ログイン成功へ拡張しない。

この単位は旧Profileを新しい保存選定へ変換する互換APIを追加しない。Task受付・Model Grant・送信Grant・保存Schema・回復、Workbench／MCP／CLIと旧Store撤去の本番切替はまだ未完了であり、一〜五全体の完了とは表示しない。保存SchemaはReader／Writer／回復の同時変更単位まで現行のまま保持する。

## 15. 残る本番切替の実施単位と終了条件

利用者の継続指示に従い、以下を一連の作業として完了させる。段階Commitは完成表示の単位ではない。実AI・実ログイン・人間の画面確認は最後の実境界確認へ集約し、それ以前は合成データと代役による回帰を用いる。実境界の外部送信範囲・回数・資源操作は実施直前に別途確認する。保持中②は全単位の観測・移行・清掃対象から除く。

| 単位 | 本番接続と撤去 | 固定後の必要な確認 |
|---|---|---|
| 選定・保存 | 受付で設定を一回解決し、Task・Objective・Operationへ必要な役割別の値を固定。旧Profile／Tier／改訂番号の選定枝を撤去 | 設定編集後も開始済みTask・再試行・再計画・訂正が同じ値。回復は再選定・本文再送なし |
| 公開利用側 | Workbench設定画面をRepository設定へ、Task入力を分類／明示指定へ移行。MCPの旧Profile CRUDとHost Catalogを撤去 | manager／administrator認可、選択Repository、競合・unknown・待機後認可・取消を維持 |
| 正式入口 | `src/api.ts`へ実在する操作を接続し、Root公開を限定。CLIは対象→操作で統一。公開結果Envelopeは`crdd-coordinator/public-runtime/v2`へ一斉切替 | 未実装stub・旧API互換wrapperなし。CLI／Workbench／MCPの型・受付・終了条件が一致。旧`orchestrator-public-runtime/v1`を拒否し、結果fieldの意味は維持 |
| Provider認証 | Claude専用LifecycleをProvider共通のstatus／loginへ置換。旧専用入口を撤去 | Provider固定通信、専用Home、対話非捕捉、exact回復参照、一次失敗と清掃結果を分離 |
| 最終固定 | Architecture・Quality・設定例・移行手順・Header・登録を現Sourceへ同期 | 外部AIなしの全体回帰、必要なWindows試験、独立レビュー、残参照、Commit／Push |

### 選定の保存比較と再入場

着手前のSource照合で、論理Operationはexecutor・reviewer・訂正の各stageにまたがる一方、Docker Operation Identityはstageごとに保存されることを確認した。受付Processでは同一設定Snapshot由来の役割別選定を固定し、Objectiveは再試行・再計画のためRootへその組を保存する。論理Operationへ同じ組を重複保存せず、各stageの既存Docker Identityへは、その役割・Attemptに対応する単一選定を保存し、読戻し確認後だけProvider Effectへ進む。作業ツリーのv4はObjective保存の基礎変更であり、SingleTask・Operationの旧Profile項目とReader／Writerの全面切替は未完了である。

| 所有する記録 | 旧値 | 新値と保存時点 | 読取り・回復 |
|---|---|---|---|
| Repository設定 | 旧Profile Catalog／Host Catalog | `ai-selection.json`。受付中だけ設定全体を読み、内容Identityを得る | 新規受付時だけ選定。開始済み実行の復元に使わない |
| SingleTask | `profileId / catalogRevision` | 主担当の`executionSelection`十項目。受付CAS前に固定 | 本文は従来どおり非永続。Owner喪失時に未発行stageを再作成しない |
| Objective状態 | 選定保持なし | 同じ`configIdentity`由来のexecutor／独立reviewer選定を初期状態へ固定 | 全Task・再試行・再計画が継承し、現在設定を読み直さない |
| ProjectTask | 旧Task属性から再構築 | Objectiveの選定組への相関を作成・予約時に固定 | 再試行／handoffで元の組へ照合。別の設定組へ差替えない |
| Operation Identity | Provider／Profile等 | 各stageで使う一選定だけをProvider／Container Effect前に保存 | stageの役割・試行番号へ照合し、訂正も元の役割選定を使用。受付の組全体は複製しない |
| Model Grant／Packet | Profile／Tier等 | `operationId / role / taskAttempt / selection Hash`を既存発行Ownerで結合 | 一回消費・更新前後の完全一致を維持。Model選定を権限にしない |
| Home Grant | Profileを含む結合 | `operationId / provider / Home実体`だけへ分離 | Model Grantと独立に必要なHome利用権限を照合 |

保存形式は上記Reader／Writer／相関検査を同時に切り替える別Schema単位で変更する。旧形式のReaderや旧Profileを新しい値へ読み替える実行APIを追加しない。フロントAIは、現在の旧設定・未終了参照を確認し、新形式へ移せない実行値を捏造せず、実行前に停止・処置を説明する。過去Evidenceと保持②を移行しない。

着手前の再照合では、SingleTaskの本文は非永続で、Owner喪失後は元IDの相関・回収と終了だけを行い、未発行stageを再開しないことを確認した。このためSingleTask正本へ二役の組を重ねて保存しない。受付Processでは同じ設定Snapshot由来の二役選定を凍結し、主担当をSingleTaskの一選定と完全一致させる。Model GrantはProcess内の一回消費値であり、その発行前に別の耐久保存を追加しない。Model Grant／Packet／PreparedPlanへ対象stageの完全な選定をexactに搬送する。Home Grantはoperation・provider・Home実体と保護条件だけに限定し、選定側とはoperationとproviderで相関させる。既存の`beginRecovery`がstageの一選定をOperation Identityへ保存・読戻しした後にだけProvider／Container Effectへ進む。保存前のOwner喪失は再発行0、保存後の喪失も現在設定で補完せず回収だけ。明示的な再実行は新Task Identityと新しいSnapshotとして扱う。

Sourceと保存設計の読取り専用再照合は、この保存時点で整合した。現行のHost領域作成とModel GrantはDocker identity生成より先にあるため、あらゆるI/Oより前の保存とは主張しない。Operation identityはexact-keyの`v1`へfieldを追加せず`v2`へ改訂する。Grant後・identity保存前の失敗、読戻し後・Effect前のOwner喪失、role／attempt／Hash差替え、旧版拒否、回復時の設定／Catalog読取り0を反証対象とする。新State／Registry／Lockは不要で、追加の人間判断はない。

Home分離は、Model Grantの全面切替より先に閉じられる独立単位とする。Home Grant本体、Provider Authorityの発行・再検査、Local Personal Authority、Isolation・prelaunch、Task／助言の発行側と診断投影からModel Profileを除去する。Provider固有のOffering・OriginはAI Adapterの`describeProviderAuthentication`だけから得る。旧Model Grant／PacketのProfileは次単位までモデル経路にだけ残し、Home利用許可へ戻さない。同Provider・同Homeでも別OperationのGrant消費・prelaunchを拒否し、拒否後に元Operationだけが一回消費できる反証を必須とする。TTL、fresh観測、失効、保護Hash、取消・回収は維持し、新しい管理状態は追加しない。

Home分離のSourceは段階実装し、権限・Home・Isolation・prelaunchの十一Suiteは114件成功（5,311.06ms）、Task・助言・Provider準備等の直接利用側十二Suiteは354件成功（10,866.0749ms）を確認した。後者の初回は旧Profile結合等の試験追従と先行APIの取り残し七件、制限付きWindowsのLink／保存公開二件で不合格。七件は新契約へ追従し、二件は検査条件を変えず通常Windowsで同じ集合を再実行して成功した。最初の不合格を成功へ読み替えない。旧Model GrantのSuiteは処理を変えず回帰に含めた。Home GrantはProcess-localのままで保存Schema・本体設定・実行記録・保持②を変更していない。

Home分離の限定独立Source確認は残指摘0。文書側の新反証Caseにある境界区分と失効対象の二表現を、QA3のPRL-UT-006と各々の元Operationへ同期し、本文・判定条件を変えず是正した。File Header・Symbolは既存AIT-UT-005を維持してPRL-UT-006を追加し、この成功でQA10の独立Trust未成立を閉じない。是正後のHome Runtime十一件は成功（518.1907ms）、Catalog386件は不整合0、Semanticの局所・CLI結合十一件も成功（3,069.5927ms）。静的検査は成功。これはHome分離だけの限定成立であり、旧Model Grant／Packet／単発受付の切替、全体回帰、実Docker・実AI・実認証は未完了である。

公開Runtimeのv2は正式APIと現行Consumerの一斉切替時に適用し、定数の実体Ownerは`state/result.ts`、正式公開は`api.ts`とする。現在の同文字列は保存Schema・Recovery Identityには含まれないため保存移行を追加しない。v1 alias・dual acceptは作らず、過去Evidenceは変更しない。これは公開契約の改訂であり、結果DTOのfield・status・reasonの意味変更とは分ける。

Home分離を`4872c1cd4`で固定後、Model Grant・Task Packet・PreparedPlan・単発受付・Operation Identityの一括切替へ着手した。Grantは受付時の完全選定とOperation／試行番号を保持し、更新は同じ値だけを再発行する。Task Packetは完全選定Hashと役割・試行番号を照合し、Home側の契約は変更しない。Operation Identityはv2、単発保存の旧Profile二項目撤去により現在State／Project Snapshotはv5へ改訂する。旧形の互換Readerは追加しない。現在は製品Sourceの型検査と、Grant十一件、両Provider準備三十六件、選定各field・stage差替えの追加反証、助言計画／Packet十件が成功した段階。旧試験の移行・利用側・登録・設計・全体回帰・独立レビューは未完了であり、この作業差分はまだ固定しない。実AI・実Docker・実認証・保持②には触れていない。

Schemaは意味を上書きせず、単一現在Stateを`crdd-coordinator/current-state/v5`、Project状態を`crdd-coordinator/project-state/v2`、内部Snapshotを`crdd-coordinator/project-snapshot/v5`へ同時更新する。旧v4以前／旧Profile fieldは本番Readerで受理しない。既存CAS・Writer・Lock・履歴・終端の順序は維持し、Task個別へrootの二役選定を複製しない。初回受付・通常遷移・再計画・再試行・Owner喪失の各例、旧形／相関不正／保存不能の拒否を同じ変更単位で反証する。

### Objective選定・保存の現在確認

受付のworkType／choice、同一設定由来のExecutor／Reviewer組、Objective Rootへの一回保存、同じMilestone内の差替え拒否、省略時の継承と明示値不一致の拒否を接続した。純粋な搬送確認を実Provider起動の成立へ拡張しない。下位の旧Task入力・Model Grant・Home・Operation Identity、単発受付と公開設定画面は未切替であり、Objectiveが作る新Task要求の実行接続は未完了である。

| 確認範囲 | 現在の観測 |
|---|---|
| Objective・保存・選定の局所五Suite | 55件成功。現在Catalogを読まないcodec、旧形拒否、保存値不変、明示要求の搬送 |
| Objective実保存・再入場 | 21件成功、885,413.5841ms。取消・状態変更・回復中断と再入場で本文を再送しない |
| 公開Objective・品質受入 | 10件成功、84,279.5463ms。実Providerは代役で、下位新入力codecの成立証明ではない |
| 利用側 | MCP全102件成功、330,321.0383ms。AI Adapter全37件成功、5,963.4934ms。MCP試験名・Headerのみ新語彙へ追従後、該当21件も成功 |
| 静的・登録・独立確認 | Coordinator／MCP静的検査、Workbench型検査、Catalog386件の値検査が成功。Source／文書の限定再レビュー残指摘0。通常全体回帰は中断・全体結果未確定。後続切替後の最終固定候補で再実行 |

制限付きWindows環境のAI Adapter試験はLink・保存公開の三件で不合格となった。同じ合成Root範囲の通常Windows実行では検査条件を変えず全37件成功した。先行のObjective試験中断は成功へ読み替えず、上表は後の完走結果だけを示す。実AI・実認証・実Docker、本体設定・現在データの移行、保持②の観測・操作は行っていない。

通常全回帰は2026-10-24 05:54:34 JSTに`40_Develop/coordinator`から`npm run test:portable`（session `29777`）で開始し、06:51 JSTに検証順序の変更で中断した。基準HEADは`3d99dae91`、中断前の全作業差分Hashは`16ba4244572f792e356ef52f733d4c67d291033e`。最後の表示済み成功は同Workspaceの七Task直列実行で、進行中Fileは`task-execution.contract.test.ts`。表示範囲に失敗はなかったが、全件結果も終了集計も得ておらず、成功／失敗のどちらにも換算しない。

exact親Process `14948`と自己所有子`44532`の起動時刻・Commandを確認して終了し、双方とその子の不存在を確認した。残った今回の合成Root `project-execution-6YKx3j`は作成時刻・`binding-a / project-a / milestone-a`・Git初期化物だけの内容・リンク不存在を確認し、この一領域だけを清掃して不存在を確認した。共通親・他の試験物・保持②には触れていない。限定基礎の局所根拠を残し、Home→Model Grant→Task→公開利用側の各単位は局所回帰と独立確認を維持する。Source／文書の両確認者と、最終固定候補で通常全回帰を最初から完走する方針を照合した。全体Gateの省略や製品接続完了の表示ではない。

### 共通認証のLifecycle

CLIは`auth status <provider> [--json]`／`auth login <provider>`。対話子のstdoutをJSON-onlyと誤認させないため、loginの`--json`は開始前に拒否する。公式対話と最後の固定結果はhuman向け、statusの`--json`だけを単一JSON応答とする。新しいstdio管理機構は作らない。

認証statusは非対話・network-none・Home読取り専用のprobe一資源へ限定する。loginは既存の限定Proxy・二Network・login／probe Containerの五資源を使う。両Providerで既存のHome排他、要求前`in_flight`／終了確認後`idle`、実IDのReceipt、所有確認後の回収、最終不存在を維持する。statusの未認証と観測不能、loginの認証成功と資源回収成功を別の事実として返す。通常の非0終了を通信成功や認証失効へ一律変換しない。

Provider固有のargv・Offering・Origin・Home変数名はAI Adapter、ContainerとProcess・環境投影はDocker Isolation、Home利用許可・認証判定・exact回復参照はCoordinatorが所有する。認証へRepository追加Allowlistを注入しない。新しいState／Registry／Lock／Runner／回復Frameworkを作らず、既存のClaude専用記録・入口を新しいProvider共通契約へ置換する。旧記録の処置は実認証前にフロントAIが確認し、製品に旧Readerを残さない。

### 共通認証の段階確認と残る本番切替

共通認証の技術構築、Provider-onlyの正式API二操作と共通CLIを接続し、旧Claude専用Script／Launcher分岐を撤去した。状態確認は一資源、ログインは五資源であり、操作を切り替えても単一Home正本を増やさない。Package Root全体の正式API限定とAI選択の本番切替は、この認証単位の完成へ含めない。

最初の独立確認で、Commandのreject後に終了不明を保持せず清掃へ進む枝、Lock取得後の構築例外、任意Signalのaccessor評価、対話stdoutとJSON-onlyの混同を検出した。既存のin-flight／終了不明／解放条件へ接続し、準備失敗の一回解放、組込みAbortSignalの値確認、login --jsonの開始前拒否で是正する。新しい保存・回復機構は追加しない。安定Test／Symbol IDを維持し、Suite Path・責務と実測済みmetadataだけを更新する。

是正後の認証・実Filesystem回復・公開CLI・周辺入出力四Suiteは54件成功、失敗／取消／skip／todo 0（14,379.9389ms）。Docker Isolation通常回帰は300件成功・5件明示対象外（失敗／取消0、23,436.2054ms）。後者は実Docker・明示Python確認の代替ではない。型・format・lint・既存Trace検査とTest Catalog 386件の値検査は成功。独立再確認は別に確定する。

追加したstatus JSONの実CLI契約確認を含むLauncher Suiteも11件成功、失敗／取消／skip／todo 0（13,936.5975ms）。正式APIの有限代役へProvider／Signalを渡し、stdout単一JSON・exit 0・login呼出し0を確認した。実APIのHome観測成功や実認証成立の証明ではない。Source再レビューは残指摘0。文書再レビューの残一件はCLI Headerの`--json`適用範囲だけを一意に修正し、両確認者との整合を完了した。本文言語・安定ID・歴史Evidenceは維持する。

旧認証Scriptの安定SymbolもIDを維持して新APIの認証接続へ配置追従した。現行Semantic RegistryとChecker試験の参照を維持し、このSymbolから正式API全体の保証を推定しない。Sourceの値・処理、通信・保存契約は変更していない。文書確認者と配置・関係の維持を再照合済み。

合成試験は両Providerの操作別構成・非0 unknown・事前取消、不正Signal、要求例外後の後続／清掃／idle／完了保存／Home解放0、元参照でのfresh拒否、構築例外と解放不明を反証した。APIのHome観測成功・実Imageでの認証・人間TTY操作・旧記録の実移行は未実施であり、最後の実境界確認へ残す。実AI②、保持物、実認証、Docker操作、本体設定の作成・変更は行っていない。

Model／Task接続の追加確認では、Task状態機械153件（1,690.1804ms）、Docker EffectとProcess Controllerの合成119件（1,375.0634ms）が成功した。旧fixtureのRole／Profile入力による初回不合格を新形式へ追従し、制限環境のjunction生成拒否は条件を変えず通常Windowsで再確認した。固定選定と異なる事前Slateを外部同意より前に拒否し、Grant更新のProviderと完全選定の相関を検査する。先行の旧fixtureで待機した今回の二組の試験親子Processは、exact引数を確認して終了した。新形式試験の正常完走とは別に中断を記録し、初回結果を成功へ読み替えない。Source・文書の限定独立確認は進行中であり、公開利用側／旧Profile削除／全体回帰は後続である。

Model／Task接続の限定固定候補は、関連17 Suite・405件が成功（8,728.7892ms、失敗・取消・skip・todo 0）、Coordinatorのformat・型・lint・二Trace検査も成功した。Lintの既存info 66件は不合格へ換算しない。独立確認で検出した助言Grantの操作／試行／選定Hash相関不足を是正し、初回と更新の六反例でPacket・Process・Provider Effect 0と元Grant失効を確認した。保存codecは旧current-state v4／v3／v2、identity v1、旧Profile混入と不正attemptを補完せず拒否する。Source・文書の最終限定再確認は全重大度の残指摘0。保存の広域回帰は別途進行中であり、全体回帰・Workbench／MCP／正式APIの移行・旧Profile全面撤去・実AIは未完了として維持する。実設定・保持②・実Docker・実認証には触れていない。

MCPの旧Profile管理四Toolを撤去する単位へ進む。公開Root三API・Tool定義／一覧／dispatch、Host Catalogの起動依存と管理Resolver注入を除去し、新しい設定CRUD Toolを作らない。全Roleの一覧不存在・未知Tool拒否・旧Owner Effect 0を既存Server／HTTP試験へ移す。安定Suite IDは維持してai-selection-boundaryへ配置追従する。要求ごとの認証・Repository内容認可・初回限定接続・通常Transportの取消／終了保証は維持する。フロントAIによる旧Host Catalog実物の処置はまだ行わず、Workbench設定移行も次単位として区別する。

MCP退役境界の固定候補は全101件成功（220,622.1574ms、失敗・取消・skip・todo 0）、format・型・lintも成功した。初回接続試験の旧32件期待は旧四Tool撤去後の28へ追従し、旧名不存在と元の出版・終了Oracleを維持した。現在の通常集合はWorkspace二操作を含むdeveloper18、manager／administrator28であり、現行設計を同期した。Sourceと文書・登録の独立再確認は、15件を内容・活動の部分集合と明記する一意な訂正まで反映して残指摘0。旧Host Catalog実物の移行・Workbench・旧Profile全面撤去・正式API全体・実AIの完成はこの結果に含めない。

保存広域回帰は105件中102件成功・3件失敗で完走（1,129,497.6078ms）。二件は旧Profile肯定fixtureの追従漏れであり、新しい十項目選定とAttemptを与えて関連44件成功（1,581.2108ms）。一件は制限環境のjunction生成EPERMで、同一の不存在・安全拒否条件を通常Windowsで確認して1件成功（8,652.3695ms）。拒否条件を緩めず、初回不合格と是正後の局所結果を分離する。全体固定回帰の代替とはしない。実Docker・実AI・実認証・本体設定・保持②の操作は行っていない。

### Workbench設定・依頼の切替候補

Workbenchは旧Repository／Host Profile管理を撤去し、選択Repositoryの技術Catalogと新設定Reader／CAS Writerへ直接接続する。共有は管理Roleと当該Repositoryのdevelopment認可を両方必要とし、待機後・処置前後・公開前を再確認する。AI依頼は作業分類と任意の明示選択を搬送する。新しい設定MCP Toolや中継Storeは作らない。旧Profile Store本体と正式API全体の縮小は次単位として残す。

設定画面は五役割のProvider／Model／Effort、分類追加・表示名変更・削除、分類別上書きの編集・削除を同じJSON draftへ接続する。詳細JSON入力は併置するが、通常操作でJSON手編集を必須にしない。初回編集は明示操作で開始し、Modelの自動作成・採用は行わない。同一対象の全体再取得で編集や保留要求を初期化せず、対象・Token・管理可否の切替では既存の画面世代を更新する。

初回独立確認のPanel再取得寿命、継承Propertyへの分類解決、用途別HTTP容量不一致を是正した。共通16KiBとStoreの1MiBは維持し、AI設定だけpercent encodingを収容する有界受付へ接続する。実HTTPで24KiB・1MiB・1MiB超過とEnvelope超過の保存0、局所Hookでdraft／保留POST／終了取消、分類constructorの既定・上書きを確認した。過大入力試験の初回待機は成功へ換算せず、今回の親子だけを終了し、exact合成Root一件の不存在まで確認した。

先行通常回帰79件の成功後、是正を含む通常回帰80件も成功（249,412.0927ms、失敗・取消・skip 0）。実Browserの新設定操作・未設定非補完、通常接続、Git操作の各限定Caseは成功し、公開CLI8件と15画面Visualの一件も成功した。Git Caseの初回は試験の10秒窓で実作成要求が未着だったが、別の有界測定で正式HTTP200と作成11,470ms／終了12,633msを確認した。製品のTimeout・拒否・cleanup条件は変更せず、該当試験の観測窓だけ30秒にする。最初のBrowser全体不合格を全体Passへ読み替えない。

固定System集合は24件成功（375,797.3295ms、失敗・取消・skip 0）。実Browserの11場面、公開CLI、15 Logical Screenの表示を確認し、Browser終了最大1,614ms・Process観測最大737ms・子孫終了fallback 0を観測した。Source・文書／Header／登録の限定再レビューは残指摘0。先行変更の試験補助Header不足とQA配列順・退役したMCP責務の登録を本文・判定条件を変えず追従し、Test SourceのQuality Local Item全数Gateも成功した。これはWorkbench切替単位の完了であり、旧Profile本体・正式API／CLI・全体QAの完了ではない。実AI・実認証・人間確認、本体設定移行と保持②の観測・操作は行わない。

### 旧Profile本体の撤去単位

着手前の本番Consumer照合と独立読取り確認で、旧Profile CRUD・Host／Repository Catalog Store・Family／Tier候補探索は退役可能と確認した。実物の旧設定、実行記録と保持②は変更しない。移行はフロントAIが行い、製品は新形式だけを扱う。

| 旧責務 | 新Owner／維持する保証 | 処置と確認 |
|---|---|---|
| Profileの登録・選択・既定fallback | AI Adapterの技術Catalog、CoordinatorのRepository別選定 | 旧CRUD／Store／既定Catalogを撤去。新Catalogの閉形式・不変値、設定CAS、優先順位と旧値拒否を検証 |
| Model ID構文 | 既存Provider validation | 関数本文と結果型を移管し、128文字境界・無変換・不正引数拒否を保持 |
| Family／Tier／経路候補探索 | 受付時に固定する完全選定、既存Authority／preflight | 非接続の候補探索を撤去。元Operation・Role・Attempt・選定Hash、一回消費、失効、独立Reviewer、利用可否を現役契約へ対応付ける |
| Profile表示・管理のConsumer試験 | Workbench選択Repository、MCP旧入口拒否、Coordinator選定→計画 | 旧出力の再現試験を退役し、現在のCapability・公開API不存在を検証。旧SuiteとSourceのRelationを放置しない |

認証・Subscription・Home・外部同意・Network・Docker isolation profileは別責務であり変更しない。技術対応を現在利用可能や実行Authorityへ昇格しない。新しい費用制御・自動Fallback・保存・排他・回復機構は追加しない。Source・利用側・登録・現行設計を一斉追従し、局所回帰・独立レビュー後に固定する。現在、追加の人間判断は必要ない。

旧Profile本体・Store・既定JSON・未接続のFamily／Tier候補探索を撤去し、Model構文検査は既存Provider validationへ本文と型を移管した。退役三Suiteを登録から除き、移管した現役Suiteは安定IDと新Pathを接続した。AI Adapter全22件成功（3,191.7199ms）と静的検査、Coordinatorの固定選定・Grant・可用性・搬送32件、直接結合18件、追加Codex／助言13件が成功した。Workbench直接利用側21件も通常環境で成功（37,600.6773ms）。初回の制限環境ではlocalhost EACCES由来の三件不合格を保持し、Oracleを変えず再確認した。Header全数GateとCatalog383件の値検査は成功。Source・文書／登録の限定独立再確認は、Header・表記追従後の全重大度残指摘0。死んだ未計測カウンタの0 assertを撤去し、実Context観測・Runtime一回／拒否0・元回復参照の確認を維持した。

この単位で設定保存・現在選定・Provider技術対応のOwnerを分離した。通常実行・現行設定・保持②を実操作していない。正式API／CLIの公開縮小・本番Consumer一斉切替・新構成固定全体回帰と最後の実AI／認証／人間確認は別途残る。

### 正式操作・CLIの切替候補

着手前の独立照合により、診断はpassiveでも一時Operation領域とCommand／Git観測を持つため、厳密なEffect 0とは表示しない。修復・再起動・Provider実行を発行しない診断と、明示した隔離試験を区別する。安全な非Authority投影のない`inspectRecovery`は公開しない。内部Root／相関resolverもRoot APIへ出さない。

| 正式操作 | 実体Owner・入力と不変条件 |
|---|---|
| `openTaskSession` | 既存Task受付Owner。検証済みRoot、Project／Principal、現在authorize、consumerの信頼したContextを受け、同じstart／observe／cancel／wait／closeを返す。JSON入力へcallbackやRoot権限を追加しない |
| `runTask` | 同じTask Owner。Sessionを一回開きstart→wait→finally close。一次結果とclose不明を別に保持し再送しない。CLIのSignal登録／解除はCLIへ残す |
| `initializeProject` | 既存Writerへの初期化を状態Ownerへ移す。最寄りRootを検証し既存Binding導出を使う。任意Bindingを公開要求へ追加しない |
| `runObjective / submitDecision / acceptResult / queryState` | 現在の公開操作実体から直接再export。Runtime-owned Principal照合、認可、保存・取消を維持 |
| `executeWorkspace / queryActivity` | 現在のWorkspace操作と認可済みRepository集合のReader。MCP／Workbenchが現在のAM判定を行い、APIで権限を複製しない |
| 設定・Network・認証・能力一覧 | 実Consumerが使う新設定読書き・検査・型、Network読取りと共通認証を明示公開。能力一覧は現実装済み操作だけを表示 |
| 診断・回復・修復・保持 | exact参照と検証済みRootの既存操作へ限定接続。種類別の内部処理・再照合は実行Owner、TTY／JSON／Signal／表示はCLI。汎用dispatcherを追加しない |

公開型・検査は上記要求／結果と本番ConsumerのDTO検査だけに限定する。内部Factory・Port・Writer・純粋遷移をRootから外し、Owner試験は実Ownerを直接読む。公開Envelopeを`crdd-coordinator/public-runtime/v2`へ一斉更新するが、保存Schema・Recovery Identity・DTO fieldの意味は変更しない。旧Envelope・旧CLI aliasは受理せず、移行はフロントAIが案内する。

CLIは`task run / project init / project run / doctor check / doctor isolation / recovery resume / recovery restart-docker / maintenance repair-docker / maintenance retain-repair / auth status|login / capabilities / help`。未接続の候補操作や回復inspectはhelpへ出さない。開発検証は既存scriptsを直接使い、一般CLIのverify入口と起動用途別の別名は廃止する。TTY・機械出力・同意の条件は操作ごとに維持する。

### 正式API・CLIの移行手順と確認範囲

フロントAIは通常実行の前に、呼出し元を以下へ更新する。製品コードへ旧形式Reader・alias・自動再送を追加しない。

| 旧利用 | 新しい利用 | 維持する条件 |
|---|---|---|
| Rootの内部Factory・Writer・遷移 | 正式操作、又は同Package内のOwner試験 | 外部Consumerから保存Writerへ迂回しない |
| `createRepositoryTaskRequests(root, project, principal, authorize, consumer)` | `openTaskSession({rootCapability, projectId, principalId, authorize, consumer})` | ServerがSessionを所有しcloseを待機 |
| 単発CLI自身のstart／wait／close | `runTask(context, command, signal)` | 同一Session、一回実行、一次失敗とclose失敗を分離 |
| `task --request-stdin --json` | `task run --request-stdin --json` | 明示Workspace、機械向け出力、取消join |
| `project --initialize --json` | `project init --json` | 最寄りの検証済みRoot。任意Bindingを注入しない |
| `project --request-stdin --json` | `project run --request-stdin --json` | 同じObjective、認可・保存・受入を維持 |
| `doctor [--isolation]` | `doctor check`／`doctor isolation` | 診断と能動隔離試験を区別 |
| `doctor --recover-isolation <id>` | `recovery resume <id>` | 同じexact参照、他の操作へ付け替えない |
| `doctor --restart-docker-for-recovery <id>` | `recovery restart-docker <id>` | 再起動とTask回復を混同しない |
| `doctor --repair-docker-desktop-runtime` | `maintenance repair-docker` | 明示操作だけ。通常実行から自動修復しない |
| `doctor --retain-docker-runtime-repair <id>` | `maintenance retain-repair <id>` | 既定7日の既存保持契約、技術再操作なし |
| `automation capabilities --json` | `capabilities --json` | 能力説明を実行Authorityにしない |
| `orchestrator-public-runtime/v1` | `public-runtime/v2` | DTO fieldの意味・保存Schemaは変更しない |

上表は呼出し元の移行であり、実物の旧設定・未終了記録の削除を許可しない。旧Host Profileを新しいModelへ推測変換せず、Repositoryの五役割・分類・上書きを人間が確認した値で作る。主Repository設定と保持中の②は今回操作しない。過去の正式Evidence・署名・Hashも変更しない。

実装候補は正式Rootの縮約と本番Consumer追従、旧CLIモード撤去へ接続した。固定結果契約の切替、Signal解除失敗で一次結果・exact参照を保持すること、修復結果の別ID成功を拒否することを外部AIなしで検証する。実AI・実認証・人間操作の確認は最後の独立した承認境界として残す。

### 正式API・CLIの固定候補と局所完了 — 2026-10-24

正式Rootの実行値は39、内部Factory・Writer・状態遷移を非公開にした。Task一回操作と継続Sessionは同じOwnerを使い、修復の別ID返却を元要求の成功へ転用しない。CLI解除不明は元結果・exact参照・下位cleanupを消さず副次失敗として返す。公開結果はv2だけ、保存Schemaと回復IDの意味は変更しない。

| 確認範囲 | 観測した結果と限界 |
|---|---|
| 正式API・CLI・取消・結果相関の六Suite | 59件成功、71,934.0496ms、失敗・取消・skip・todo 0。実CLI、有限API代役と実本文の故障注入を含む。実認証・実Dockerは含めない |
| MCP通常全体／Workbench通常全体 | 101件成功（269,564.0992ms）／80件成功（261,365.2444ms）、失敗・取消・skip・todo 0。実AIは起動しない |
| Windows Process・公開初期化 | 模擬Providerの取消二件と新品合成Repositoryの初期化一件が成功。制限環境で失敗したhardlink拒否Caseも条件不変の通常Windowsで成功 |
| 静的・登録・Header | Coordinatorのformat・型・lint・二Trace検査成功。lintは既存info84件のみ。Test Catalog383件valid、Test SourceのQuality Local Item全数Gate成功 |
| 独立確認 | Sourceと文書・登録の再レビューは全重大度残指摘0。Source／利用側の固定集合SHA-256は`71bed59ab8f8e6bbe1526cc0b160e91da0974d299350da0120b13f0fa00d1bc6`で不変 |

全体診断中に旧CLI呼出し・旧Profile fixtureとWindows制限環境由来の失敗を検出した。旧入力は新形式へ移し、拒否Oracleや保全条件を緩めず局所再確認した。診断中に試験を追従した実行は固定全体回帰の根拠にせず、本候補をCommitで固定して通常全体を確認する。現在文書のOwnerリンク三件とQuality関係の追従漏れも一意に修正した。歴史的CHG／Evidenceの旧リンクはそのまま保持し、Repository文書検査全体の不合格を現行候補のPassへ読み替えない。

この固定候補時点では、固定全体回帰の最終集計、実AI・実認証・人間による端末／画面確認、本体設定の実移行が未実施だった。後続の集計・是正・最終確認は§16を参照する。実AI等は送信内容・回数・試験物・停止条件を最後にまとめて提示してから実施する。

<a id="final-normal-regression"></a>

## 16. 固定全体回帰と追従漏れの是正 — 2026-10-24

基準Commit `9db97f00a`の通常全体回帰を、外部AI・実Dockerなしで最後まで実行した。`npm run test:portable`は1,845件中1,788成功・52失敗・5明示対象外、取消／todo 0、4,611,313.6631ms、Exit 1。この初回結果は不合格として保持する。52件は次の51個別失敗と、それに伴う親Test一件の失敗であり、実装を変更せず現在の入力・Ownerへ追従する。

| 原因群 | 初回失敗数 | 最小処置・保持する検査 |
|---|---:|---|
| Root搬送の旧CLI構成式 | 1 | 正式診断APIの実Root構成式へ接続。別Root・再解決・不正Rootの反例を維持 |
| 共有の旧結果fixture | 28（親一件を含む） | 旧Profileを固定選定・Provider・Attemptへ置換。実保存、元結果、取消・回復・再入場のOracleを維持 |
| Source分類・依存辺の未登録 | 1 | 新入口五Fileの責務を分類。選定の型参照とDomainの同期値検査だけをexact許可し、OS禁止・未知Source・別／余剰Symbol・値依存の拒否を維持 |
| Workspace子Processの旧Root import | 7 | 再入場・別Process採用は実Ownerへ接続。合成Principalを使う四引数の内部契約と、実認証を固定する三引数の正式APIを混同せず、内部操作をRootへ再公開しない |
| 対話入力AST／Node Gateの旧Owner | 2 | 実受付Ownerと正式版判定へ追従。stdin八変異、実Import・実Callの検査を維持 |
| General検証Toolの旧Task入力 | 1 | 既存Resolverで固定二役を作り、選定不能はSource観測・Workspace・Task開始前に拒否。契約改訂29 |
| 結果記録試験の旧CLI構文 | 1 | 独立した正式Recovery検証Scriptへ接続。Producer拒否・保存・Hash・元参照の検査を維持 |
| Packet肯定fixtureのHash欠測／改訂 | 10 | 既存選定Hash関数で値を構築し、改訂21へ追従。Packetの拒否・相関条件を緩めない |
| 単発要求の旧Profile肯定入力 | 1 | 現在の分類入力へ変更し、旧Profile・不正明示選択の拒否を追加 |

実Provider検証Toolも同じ新入力へ接続した。既存Reader／Resolverで二つの検証分類と反対Providerの明示Reviewer上書きを要求し、Toolが設定を自動保存しない。結果改訂13は設定の前後確認を`matched / changed / unavailable`で表し、非一致でも一次結果・取消・回復参照・cleanup観測を消さない。途中変更・ABA検出や、全実行の原子的な設定固定は保証しない。実行前条件と限界の正本は[実行手順](../../../19_Workflows/01_Coordinator_Runtime.md#task実provider検証の実行source)とする。

| 是正後の確認範囲 | 結果 |
|---|---|
| 関連17 Suite | 217件成功・失敗／取消／skip／todo 0、142,459.7342ms。先行216成功／1失敗を上書きせず、最後の依存辺追従後に全17 Suiteを再実行 |
| 実保存・Workspace・回復の影響四Suite | 103件中102成功・1失敗、取消／skip／todo 0、1,660,169.9612ms。残一件は合成Principalの内部契約を正式APIへ誤搬送した試験側の追従漏れ。初回結果を成功へ読み替えない |
| 最後の採用Case・公開Root境界 | 別Processを親と同じ内部Decision Ownerへ接続し、当該Caseと公開Root境界二件の計3件が成功、失敗／取消／skip／todo 0、257,892.2732ms。変更は当該Case内のURLだけであり、先行四Suiteの未変更102成功と分けて保持する |
| Workbench System・Visual | Systemは24件中23成功・Visual明示skip1、308,386.626ms。別実行のVisual一件は成功、69,107.3324ms（15画面・3 Profile・3 Zoom）。二実行を単一runの24成功へ換算しない |
| 静的・設計接続 | format・Source／Test型検査・lint・二Trace検査が成功。既存lint info84件は不変更 |
| Header・登録 | Quality Local Itemへの全Test Source接続Gate成功、Test Catalog383件valid。台帳検査自身は試験を実行しない |
| 現行文書 | Repository文書検査は歴史CHGの旧リンク3,716・旧アンカー5による全体Exit 1、現行文書診断0。歴史Evidenceを改名・書換えしない |
| 独立確認 | 検証Source・Workflow・exact依存辺・名称／Headerを別実行者が読取り確認し、全重大度の残指摘0。最後のOwner接続と最終結果・現在投影の再確認も、Source／文書の両観点で残指摘0 |

今回の是正はToolと試験の追従であり、Coordinator通常実行のSource、MCP本体、配布入口、保存形式・Writer・Lockは固定版から変更していない。WorkbenchはHeader二箇所の旧Profile表示説明だけをAI選択へ訂正し、処理本文は不変である。新しい互換Reader、Registry、Lock、Runner、回復Frameworkは追加していない。先行する探索回帰の中断は成功へ換算せず、exact親子の終了確認後、今回生成した合成Root `.crdd/tmp/crdd-project-durable-JyShnT`と`.crdd/tmp/crdd-project-durable-TgBDEm`だけを内容・非使用確認後に清掃し、不存在を確認した。

保持②の内容、Runtime状態、資源実体の読取り／変更／回収は行っていない。ただし試験Rootの絞込み一覧でDirectory名と更新時刻というFilesystem metadataを一度観測し、その場で利用者へ報告した。内容を開かず以後の対象から除外しており、「メタデータも一切観測していない」とは主張しない。

一〜五の実装・本番接続・非AI検証を限定完了とし、現在の変更で未解消の回帰失敗はない。初回全体及び影響四Suiteの不合格と、是正後の範囲別成功は別々の根拠であり、単一runの全体成功とは表示しない。

実AI・実認証・人間の端末／画面確認と本体設定の実移行は未実施。過去Evidence・保持②を変更せず、フロントAIの移行確認後、送信先・情報範囲・回数・Image・停止条件・今回資源の回収範囲を最後に提示する。正式199項目の全数再評価、既存横断QA不合格、main統合・Releaseの判断は本単位の完成表示へ含めない。

### 承認済み実AI確認の前提停止 — 2026-10-24

利用者は新品の合成Repositoryだけを対象に、Codex／Claudeの読取り専用各一回、Direct／Isolated編集各一Task（通常是正を含めAI起動最大十回）を承認した。固定Image・既存Subscription認証を使い、不明な失敗では再試行しない。Docker再起動、Image取得、APIキーfallback、実ログイン、本体設定移行、保持②の操作は対象外とした。

基準Commitは`e2dc94c743f1695ef17c8684a8983060bf04ca7e`。Engine読取りは成功し、Docker Desktop 4.93.0／Engine 29.8.1を観測した。Source指定のCodex編集・Codex助言・Claude・Proxyの四Imageをexact IDでinspectし、全件の存在とlinux/amd64を確認した。Image取得・更新は行っていない。

最初の正式API `getAuthenticationStatus({provider:"codex"})`一回が、`status: blocked`、`reason: provider_authentication_provider_home_active_or_unknown`、`cleanupConfirmed: true`、`providerEffectIssued: false`を返した（呼出しProcess Exit 1）。Sourceの返却点は、既存Provider HomeのKernel Lock取得失敗であり、認証Plan作成・Container作成より前である。使用中と観測不能を区別できない結果なので、認証切れ・特定Processによる占有・保持②が原因とは断定しない。

停止条件に従い、Claude状態確認、AI依頼、合成Repository作成へ進まず、再試行・Lock解除・記録書換えを行わなかった。今回のAI起動／外部送信は零で、新規試験物の回収対象もない。保持②の内容・Runtime状態・資源実体は調査していない。

Source確認後、今回の確認用起動方法に`node --input-type=module -e`を使用した問題を検出した。既存Worker構築は親の実行オプションを引き継ぐ。認証・Docker・Lock取得を使わず、同じ起動方法から既存TypeScript ModuleをWorkerとして読み込む局所再現では、`ERR_INPUT_TYPE_NOT_ALLOWED`、Worker Exit 1を観測した。したがって今回のblockedを実際のHome競合や認証不備の根拠にせず、確認用起動条件の不備として扱う。最小是正はファイル入口から通常のNode起動を使うことであり、製品のLock・安全条件・回復機構を変更しない。実AI四試験は未実施のまま。認証状態確認の再実行も行わず、正しい起動条件での前提確認を次の実行事項として残す。

### 再承認後の合成実AI確認 — 2026-10-24

利用者の再承認後、基準Commit `742728537`から通常のTypeScriptファイル入口で前提確認した。最初の入口は相対importの階層誤りでAPI読込み前に停止し、参照だけを修正した。Codex／Claudeの正式な認証状態確認は共に`authenticationStatus: confirmed`、`cleanupConfirmed: true`、回復参照なしで成功した。Codexの確認入口は成功値を`authenticated`と誤って期待して非0終了したが、実APIの成功観測は保持し、終了値判定だけを`confirmed`へ訂正した。Codex確認の再実行はしていない。認証・ログイン・製品Source・Lockの仕様変更はない。

新品領域`.crdd/tests/ai-preflight-20261024-74272853/`内に合成Repositoryを作り、正式な設定保存・初期化・`runTask`へ接続した。送信したものは、その合成`PROJECT_CONTEXT.md`一件と「状況・残件・次候補」を尋ねる固定質問だけであり、本体のContextを送っていない。読取り専用の成功条件にTree不変を必須化し、局所Oracleと読取り専用の独立確認を通してから実行した。

| 承認済み試験 | 実際の観測 |
|---|---|
| Codex読取り専用一回 | `gpt-5.6-sol / medium`、`request-f884de81-8f85-43ee-b211-b8d610713ed8`。正式Task結果completed、四分類の助言を受領、一次・副次失敗なし。Provider終了値0、Process tree終了、Container／Network不存在、cleanup成立、回復参照なし、合成Tree不変 |
| Claude読取り専用一回 | `opus / medium`、`request-d5b11e41-b3e4-447f-a7d8-ef568c3483d6`。認証確認後のProvider開始まで到達したが、`start_provider_attached / execution_classification`で終了値1、stdout 835 bytes／stderr 0 bytes。正式結果blocked、一次理由`provider_process_exit_nonzero`、副次失敗なし。Process tree終了、Container／Network不存在、cleanup成立、回復参照なし、合成Tree不変 |
| Direct編集一Task | 未実施。Claude失敗を受け、次のAI起動を停止 |
| Isolated編集一Task・候補固定／Merge | 未実施。同じ停止条件を維持 |

AI起動は計二回で再送なし。認証状態確認をAI起動回数に含めず、外部AIへの推論依頼二回と区別する。Claudeの非0を認証切れ、Quota、通信故障、Model非対応のいずれかへ断定できる根拠はない。通常の技術分類が非0終了を先に返すため、この観測からProvider本文の意味までは判定できず、生出力・秘密値の捕捉や再実行による補完はしていない。原因調査・必要最小限の診断案を次に整理し、診断付きの実AI再送は別の判断とする。

両Taskの呼出しProcess終了後、今回の合成Stateはoperations・unresolvedRecoveries・pendingDeliveries・leaseIntents・workspacesが各零、二QueueはcompletedかつownerGenerationなしを確認した。historyPending二件は通常要約の保存待ちであり、回復待ちや実行中と混同しない。自己生成した合成GitのWorktree登録は自身一件だけ。保持②と本体設定へ触れず、今回領域だけを内容・非使用確認後に回収する。Docker再起動・Image取得・ログイン・APIキーfallbackは行っていない。全体E2EのPassとはしない。

その後、今回Rootの正規Path、祖先及び配下のReparsePoint不存在（File二十三・Directory二十二）を確認し、そのRootだけを削除した。削除後の直接不存在を確認済み。元の失敗・成功の要約は本節へ保持し、実行ごとの書庫は追加しない。

### Claude非0終了の切り分け — 2026-10-24

利用者の調査依頼に従い、再送・認証変更・Docker再起動・保持②操作をせず、現在Sourceと差分、既存試験、合成入力で照合した。`controller.ts`の技術分類は非0の標準出力・標準エラーを`convertProviderError`へ渡しており、本文を渡す前に失っているわけではない。一方、AI AdapterのClaude分岐はJSON標準出力の三subtype（予算・Turn・構造化再試行上限）だけを判定し、それ以外は標準エラーを分類して終了する。Codex側だけに有界な標準出力エラー抽出がある。

合成`type: result / subtype: error_during_execution / is_error: true / errors: [authentication failed]`と空stderrでは汎用`provider_process_exit_nonzero`、同じ説明をstderrへ置くと`provider_authentication_expired`となることを通信なしで再現した。既知`error_max_turns`は従来どおり`provider_turn_limit_exceeded`になる。既存エラー変換Suite一件も成功（118.8982ms）。これは診断上の取りこぼしの根拠であり、前回の実出力がこの形・この理由だったことの証明ではない。

既存固定Claude Imageから、認証・Repositoryマウントなし、network none、非root、読取り専用、Pullなしで`--help`だけを一回実行した。Container実IDは`da8006e6dc2b0fd653272466307fd3300a5ece2be8c8d9424ac3b1fe6464198d`、終了値0。現在計画の主要引数十三種はヘルプに存在した。`--max-turns`は表示されなかったが、[公式CLI資料](https://code.claude.com/docs/en/cli-reference)はこの引数を説明し、全引数がヘルプに表示されるとは限らないと明記する。最新資料を固定2.1.220の実受理証明とはせず、未表示だけから未対応と判定しない。診断Containerは同じ実IDの停止確認後に削除し、exact ID絞込みで不存在を確認した。Image取得・既存資源の変更はない。

実失敗は開始後の終了値1までしか特定できず、過去の835バイトは生出力非保存方針により再解析できない。Model・effort・Turn上限・CLI引数を推測変更しない。最小案は既存AI Adapterのエラー変換内で、上限付き単一JSONの解析可否、許可した`type/subtype/is_error`の分類、既知エラー説明から既存reasonへの変換だけを扱い、本文・未知値・Session ID・認証値を返却／保存しないこと。新しい診断Storeや回復機構は不要である。これは未実装の提案であり、最初に合成入力だけで正常回答・不正／曖昧／過大JSON・未知形の拒否を確認する。実AIの診断付き再送は別途承認後の一回とし、現在の調査でAI起動は零。Source変更は行っていない。

### Claudeエラー変換の最小是正と非AI回帰 — 2026-10-24

利用者の承認に基づき、既存`ai-adapter/src/provider/error.ts`内だけでClaudeの明示的な実行失敗JSONを有界に分類するよう是正した。公開API・返却field・理由の閉集合は変更していない。追加のStore、ログ、Registry、回復、再送、Model／引数変更はない。既存三subtypeと既知stderrの優先を保持し、不正stdoutでも既知stderrの分類を妨げない。分類対象の条件・容量と通常回答の除外は[AI Adapter設計](../../../06_Architecture/Details/ai-adapter/01_Architecture.md#6-failureと回復)、反証は既存QA項目`ERB-UT-032`／`ERB-IT-002`へ接続した。

| 固定候補の確認 | 結果と範囲 |
|---|---|
| AI Adapter全体 | `npm test`成功。24件成功、失敗／取消／skip／todo零、3,840.4133ms。整形・型・Lintも成功 |
| Coordinator関連九ファイル | 306件成功、失敗／取消／skip／todo零、7,000.8276ms。Controller、Claude計画、Task、助言、Provider境界の有限代役を含み、実Docker・実AIは使わない |
| エラー変換の限定Coverage | 三件成功、154.0361ms。`provider/error.ts`の行・分岐・関数は各100%。同Fileの合成反例の到達確認に限り、実Providerや全体網羅性の根拠にはしない |
| Coordinator静的確認 | 整形899File、Source／Test型、Lint、Runtime／Taskの両Trace検査が成功。既存Lint info84件は不変更 |
| 独立レビュー | Source・UT／IT・設計・QAを読取り確認し、全重大度の残指摘零。既存優先・容量境界・本文非公開と利用側搬送の整合を確認 |

今回扱ったのは過去失敗の診断取りこぼしであり、過去のClaude非0終了の実原因を確定したわけではない。生Provider出力を保存せず、実AI再送・Docker／認証操作・保持②の操作は零。局所・影響回帰の限定完了とし、未実施の編集二試験や全体E2EをPassへ変更しない。

### 元作業再開後の非AI回帰 — 2026-10-24

保持②の限定清掃後、利用者の継続指示により、基準Source `98509d5f295eb33fef8b92aca0d76b9bff3ac060`の非AI回帰を再開した。今回の製品Source・設定・判定条件の変更は零。対象は既存の通常回帰と静的検査で、実AI再送・Docker再起動・認証領域操作・新しい回復機構は含めない。保持②の清掃は[別の限定処置](workspace-runtime-inventory.md#retained-edit-trial-disposal)として区別する。

| 確認範囲 | 現在確定した結果・限界 |
|---|---|
| AI Adapter | 静的検査と全二十四件成功、4,236.9034ms。前回の成功とは別の今回実測 |
| Coordinator静的検査 | 整形八百九十九File、Source／Test型、Lint、Runtime／Taskの両Trace成功。既存Lint info八十四件は不変更 |
| Workbench合成HTTP | 制限環境では十二件中十一成功・一失敗。通常Windows環境では全十二件成功、17,352.3117ms。実AI・実Dockerを使わない有限Ownerとloopbackの検証 |
| Windows対象確認 | 通常Windows環境で対象五十一件が成功、失敗・取消・skip零。初回失敗三十三件、Git markerの環境skip一件、関連する正常系十七件を含む。Source・安全条件・Oracleは変更していない |
| Coordinator通常全体 | 既存`test:portable`は1,850件中1,811成功・33失敗・6skip、取消・todo零、11,235,366.0836ms、Exit 1で完走。初回不合格を保持し、別環境の対象成功を足して単一runの全体成功へ換算しない |

長時間の公開Objective Caseは変更なしで169,540.9768ms、単発Task保存Caseも342,990.0871msで成功した。途中で検討した取消通知取り逃がしの仮説は、今回の待機原因として確定していない。推測に基づく試験変更は行わなかった。今回Runnerの停止もIdentity再確認で拒否され、Process停止の実発行は零。通常Windowsで別途確認した公開Objective全十件も成功した。実行結果の書庫は追加せず、今回のSource不変と範囲別結果だけを本節へ記録する。

初回三十三失敗と通常Windowsでの再確認は次の全数対応である。エラーの意味を確認できたものと、環境差だけ確認できたものを分け、権限制約を製品不具合へも、成功へも読み替えない。

| 初回失敗の対象 | 件数 | 観測と同一試験の通常Windows確認 |
|---|---:|---|
| AI選択Store | 2 | hardlink作成EPERMと、その注入不成立による期待値差。二件成功、1,246.5151ms |
| Taskのloose ref境界 | 1 | Junction作成EPERM。一件成功、633.2759ms |
| 送信同意のdangling境界 | 1 | symlink作成EPERM。一件成功、442.7542ms |
| Git読取り・Native ancestor・Coverage | 4 | Host marker rename又はJunction／symlink作成EPERM。四件成功、628.7914ms |
| Repository Operation／Workspace | 18 | Host marker rename EPERM又はGit管理領域Junction作成EPERM。両Suite二十五件成功、50,470.37ms |
| 保存のtmp親alias | 1 | symlink作成EPERM。一件成功、8,430.459ms |
| Windows判断Store | 2 | 初回はblockedで期待値と不一致。通常環境では二件成功、514.8424ms。個別のOS拒否原因は未確定 |
| WorkspaceのBranch残存回収 | 1 | 別Process再入場が90秒の既存期限でETIMEDOUT。通常環境では同じ期限・処理のまま一件成功、67,983.6235ms。遅延の内部原因は未確定 |
| 検証記録の保存先link | 1 | symlink作成EPERM。一件成功、579.9633ms |
| 受動Doctor・Operation作成 | 2 | Host回復namespace初期化拒否。Operation側はterminal_selected_user_unknownを保持。通常環境では二件成功、718.7418ms |

さらに公開Objective全十件（93,301.0522ms）と、初回の環境skipだったGit marker link拒否一件（124.5659ms）を確認した。上表の通常確認四十件にこの十一件を加え、計五十一件である。残る初回五skipは対象確認で実施済みとはせず、実境界の未評価を維持する。通常Windowsでの対象五十一件の再確認には再現失敗がない。初回全体runの三十三失敗・六skipと、ETIMEDOUT一件／Windows判断Store二件の厳密原因未確定は維持する。通常Windowsで全1,850件を一括再実行したとは主張しない。

三文書の限定独立確認では、通常Windowsの対象成功を非AI全体へ広げない表現上の軽微指摘一件を是正し、再確認後は全重大度の残指摘零となった。次はCommit／Pushである。実AIは次節の継続承認で固定した範囲に限り、その固定版で進む。

### 一〜四の継続承認と実AIの固定範囲 — 2026-10-24

利用者は残件一〜四の実施を指示した。開始済み通常回帰の確定、記録・独立確認・Commit／Pushを先行し、その固定版で以下を実施する。実AI前のSource読取り独立照合では、新しいFrameworkやSource変更は不要、追加の人間判断も不要と確認した。

- 読取り再確認はClaude `opus / medium`一回だけ。Codexの読取り成功は再実行しない。新品のRepository-local合成領域の`PROJECT_CONTEXT.md`一件と既存の固定質問だけを送り、本体Context・認証値・秘密値は送らない。
- 読取りが完全成功した場合だけ、既存`verify-workspace-ai.ts`でDirect→Isolated各一Taskへ進む。ExecutorはCodex `gpt-5.5 / medium`、ReviewerはClaude `opus / high`。合成Source・固定指示・差分だけを送り、通常の一回是正を含め各Task最大四起動、読取りを加え最大九起動。余り枠を再試行に使わない。
- 現在の固定Imageを使い、Image取得／更新・APIキーfallback・Docker再起動・本体設定移行は行わない。Docker inventoryが読めない、又は稼働Containerがあれば、実行しない。
- Source／設定の未Commit差分なし、exact Repository／Commit／Context、選択identityと送信／通信Policyが観測可能であることを実行前に確認する。合成設定と既存の送信Policyだけを利用し、認証Homeを手動で読み取らない。
- Claude読取りの非0・unknown・回収不明では編集へ進まない。Direct失敗ではIsolatedを起動しない。再送・再起動・強制清掃はせず、今回のexact結果／回復参照を保持する。正常時だけ、既存OracleのGit・Worktree／Ref・Container／Networkの終了後条件と非使用を確認して自己生成物を回収する。

本節は実施許可と停止条件の記録であり、実行結果ではない。正式199項目の全数評価・全体QA・Release成立を実AIの限定成功から推定しない。

<a id="ai-closure-preparation-blocked"></a>

### 一〜四の実行結果と事前準備停止 — 2026-10-24

一・二は前節の非AI回帰と限定独立確認を終え、`8d1e736e1`でCommit・Pushした。Source・設定は基準版から変更していない。三はその固定版・cleanなWorking Treeから、新品合成Root `.crdd/tests/ai-closure-20261024/readonly`を準備した。直前のEngine 29.8.1応答、稼働Container零、既存四Imageのexact IDとlinux/amd64は確認できた。Image取得・更新・再起動は行っていない。

合成AI選択を保存する正式`saveRepositoryAiSelection`が`blocked`を返し、短命な確認入口の`trial_selection_not_saved`でExit 1となった。Claudeの正式検証Toolをspawnする前であり、今回のAI起動・外部送信は零。四のDirect／Isolatedも起動していない。確認入口が保存結果の`reason`を保持せずstatusだけをassertしたため、今回の結果から個別の拒否原因は確定できない。これは確認入口の診断不足であり、Provider認証不良、Home競合、Docker故障とは断定しない。

再保存・試験再実行をせず、純粋検査とReaderだけで合成設定valid、Repository検証completed、設定領域ready、AI選択missingを確認した。設定内容・境界の現時点の読取り成立は、過去の保存拒否原因の確定や保存成功を意味しない。次の最小診断は、送信を伴わない合成保存確認で閉じた`status/reason`と保存・回収の観測を失わないこと。安全条件を緩めたり、保存・Lock・Recovery機構を追加する根拠はない。

今回Rootは二十四File・二十九Directory、Root及び祖先・子孫にlinkなし、Fileの複数hardlinkなし、Git Worktree登録は自身一件だけだった。Coordinator Runtime状態、設定Lock・回復義務Fileは生成されていない。通常WindowsのCIM照会で当該入口・試験Rootを使うNode Processが零であることも確認した。その後exact親 `.crdd/tests/ai-closure-20261024`だけを削除し、直接不存在を確認した。短命な実行・読取り診断入口も回収し、生Provider出力や実行別Evidenceの書庫は作らない。共有認証Home・他試験物・既存Docker資源は変更していない。

三は事前準備停止、四は前提未成立による未実施として残す。AI再試行で原因を補完せず、全体E2E・実認証・Releaseの成功へ昇格しない。

清掃後の読取りでは稼働Container零、現在のoperations・unresolvedRecoveries・pendingDeliveriesは各零だった。結果と現在投影の二文書について限定独立確認を行い、全重大度の残指摘零を確認した。

<a id="selection-save-preparation-diagnosis"></a>

### 保存拒否の非AI原因確認と最小是正 — 2026-10-24

利用者は外部AIなしの原因調査・最小是正・局所試験を承認し、AI再試行・Docker再起動を対象外とした。基準版`fdacbbadb`から、前回と同じ空template・合成Manifest・非秘密送信設定・新形式AI選択で新品Repositoryを作り、正式保存APIの結果を保持した。返却は`blocked / repository_runtime_data_ignore_registration_blocked`、Readerはmissing、回復ID・Lock残存なしだった。Kernel Lockや認証に到達する前のGit除外登録の拒否である。

`git init --template=`では`.git/info`が作成されない。Version Controlの除外Writerは検証済みinfoDirectoryを要求し、不在ならEffect前に拒否する。Domain Modelがこれを上記の理由へ搬送し、AI選択Storeも同じ拒否を保持する。前回の短命な確認入口にはinfo作成がなく、`.gitignore`の`.crdd/`記述だけではこの前提を満たさなかった。既存`verify-workspace-ai.ts`はinfo／空excludeを明示作成しており、製品の保存・排他の変更は不要である。

是正は検証fixtureの準備だけとした。別の新品合成Repositoryでinfo／空excludeだけを追加すると、同じ保存要求がsaved、Readerがavailable、回復IDなし・Lock残存零となった。自己生成Rootの削除後不存在も確認した。実AIを使う確認入口は再起動しておらず、この局所確認をClaude成功へ読み替えない。

既存のAI選択Store Suiteへ、空templateの未準備時は元reason・setupFailureのEffect未発行／回収確認を保持して`.crdd`を作らず、fixture Ownerの明示準備後だけ保存・読戻し・短命File回収が成立する一件を追加した。手順正本へ同じ準備条件と拒否理由を失わない扱いを追従し、既存QA項目`RCM-IT-005`へ接続した。製品Source・公開API・保存形式・Lock／回復条件・本体設定は不変更で、新しい仕組みや互換層を追加しない。

| 局所確認 | 結果と限界 |
|---|---|
| 原因の合成再現と準備是正 | 未準備blocked、準備済みsaved／available。外部AI・認証情報・Dockerなし |
| 追加した境界Case | 一件成功、538.9157ms。未準備拒否と準備後成立を同じAPIで比較 |
| 静的確認 | 初回は追加試験の整形一件で停止し、整形だけ是正後にcheck成功。Source／Test型、Lint、両Trace成功。既存Lint info84件は不変更 |
| 静的通過後の保存Suite | 十一件成功、失敗・取消・skip・todo零、6,078.5339ms。既存CAS・認可・不正入力・公開／回収失敗も維持 |

初回の診断用Rootは、設定保存が発行されず合成二設定以外のRuntime状態・Lock／回復義務なし、外部Worktreeなし、対象Node Process零、祖先・子孫の非link／Fileのnlink一を確認した。今回の一Root（十九File・二十Directory）だけを削除し、不存在を確認した。準備済み診断RootとSuite fixtureも各所有者が回収した。短命な診断入口は回収し、通常の実行結果書庫は追加しない。

変更分類は検証準備・試験追従であり、製品の意味・決定権限・互換性は変えない。親による事前照合はGit除外登録・領域確保・設定Storeの既存Ownerと、失敗時のEffect／回復搬送を対象にした。独立レビューと文書の直接伝播確認を行い、準拠・Release監査や全体再回帰はこの局所変更へ追加しない。実AI・実認証・Direct／Isolated E2Eは未実施のまま保持する。

五Fileの限定独立レビューは全重大度の残指摘零。原因・元拒否搬送・正常／拒否のOracle・新品fixtureだけの準備・試験物回収と、未実施の実境界を過大表示しないことを確認した。実AI再試行とDocker操作は零である。

<a id="claude-resume-transport-stop"></a>

### Claude確認の再開と通信失敗による停止 — 2026-10-24

利用者は直近の残件再開を指示した。基準Commit`c5b5bc680`・cleanなSourceから、Claude `opus / medium`の読取り確認一回、その完全成功後だけDirect→Isolated各一Taskという既存条件を維持した。送信対象は新品の合成Contextと固定質問だけで、本体Contextを複製していない。前提読取りはEngine 29.8.1応答、稼働Container零、既存四Imageのexact ID・linux/amd64を確認した。

短命入口は前回の一Process内固定方式へGit info／空exclude準備を加えた。保存非成功時のpublication・cleanup・exact回復参照・temporary・setupFailureを落とす実行前指摘一件を修正し、再確認後は全重大度の残指摘零。製品Sourceは変更せず、今回入口から保存を一度行い、初回の合成AI設定保存と前後観測は成立した。正式読取りToolは一回だけ起動し、再試行はしていない。

| 今回の観測 | 結果と限界 |
|---|---|
| 正式Tool | Exit 2、`workbench_verification_transport_failed`。Taskの公開結果はnull、Workbenchのloopback HTTP観測（公開操作のローカル搬送）で結果を得られなかった。Task全体のtimedOutはfalseだが、HTTP固有の期限超過は未判定。closeConfirmed true、closeFailure null。耐久記録のexternalSendはnot_issuedであり、外部Provider送信を意味しない |
| 前後固定 | 本体Source・正式Tool・合成Context／HEAD／Tree・選択設定・通信Policyの観測は不変。`unchanged: true`だが実行成功や回収成立を意味しない |
| Docker終了後比較 | provider_cleanup_unconfirmed。既存資源一覧は保持され、System構成同値。ただし標準Network Identityが変わり、Network一件追加／一件消失を観測。原因・主体は未特定であり、今回の再起動発行やProvider成功へ読み替えない |
| 耐久記録 | 一操作の認証確認Container作成がintent_saved、実ID・Receiptなし。認証確認以外の残り四資源はすべてnot_requested、providerStart not_started／externalSend not_issued。通常Windows照会で今回のNode入口・Tool Processは零 |
| 同IDの正式回収一回 | recoverExecutionがblocked、理由docker_task_recovery_resource_unconfirmed。locksReleased true、Docker／Host cleanup false、history false、taskRecoveryCompleted false。処置成功や資源不存在の証明へ昇格しない |

今回のexact回復参照は`docker-task.29c9921916f3a63170e77179d3145c8627a2b3519d5813b7c9cf2a87d136d9aa.74dae9e4a3f03450c2d84ba663113e1feee11a268209cfd5ca736143a82c1e35.148647bb8aa7e9b15f3a09bfb333a31fd8af8a0c155d55f6d34ae9433f24a154`。現在Host参照は`host.crdd-coordinator-doctor-e5d13853-77aa-4965-a0d5-574ff5facc30.e5d13853-77aa-4965-a0d5-574ff5facc30.049658870236ff0cdaf0c0952bc338001643e6db5df09fabb62407b2f3da11e9`。正式回収後も同じ操作を保持し、phase settling、ownerEffect disabled、認証確認Containerのrequest／observation unknown、Queue recovery_requiredを確認した。未観測の過去要求を現在の資源一覧だけで完了へ変更しない。

合成領域`C:\project\CRDD\.crdd\tests\ai-closure-resume-20261024`には、readonly配下の現行状態と試験物、親の安全な要約`result.json`／`recovery.json`を保持する。生Provider出力・認証値は保存していない。回復参照が未解決のため再帰削除せず、既定七日の2026-10-31に再評価する。期限だけによる自動削除は行わず、同IDの正式処理と非使用・所有実体・終了後条件を確認できるまでは保持する。短命な実行／回収入口は要約記録後に回収する。

三はWorkbench HTTP観測と認証確認作成結果が未確定、四は前提不成立で未実施。耐久記録のexternalSendはnot_issuedのままである。Docker再起動・修復・Image取得・APIキーfallback・追加送信・既存資源削除は行っていない。今回の通信故障の原因調査と、保持した試験物の処置を次の判断対象とし、E2Eの成功を主張しない。

結果記録と現在投影の限定独立確認では、ローカルHTTPと外部送信の区別、未要求四資源の全数表示を是正し、再確認後は全重大度の残指摘零。製品Sourceは固定版から不変更である。

<a id="claude-resume-readonly-diagnosis"></a>

### 再開試験の読取り原因調査 — 2026-10-24

利用者の原因調査指示に従い、AI再送・Docker再起動・回収再実行・保持物削除をせず、現在Sourceと保持状態、Dockerの読取りだけを照合した。変更分類は調査・記録訂正であり、製品の実装・API・安全条件は変更しない。前節の「期限切れではない」という説明は訂正する。`timedOut`はTask側のflagで初期値false。最初のobserve成功後にだけ再計算され、今回の早期HTTP例外では初期falseのままなので、HTTP十五秒期限もTaskの最終状態も除外できない。

| 確度 | 調査で確認したこと |
|---|---|
| 失敗位置の特定 | `client.start`内のPOST又はその結果読取りが失敗すると専用のstart_outcome_unknownへ包む。一方、今回の理由は未包装のtransport_failed、結果nullで、同じ新品Rootに一つのTaskが受付保存されている。このSource分岐と記録の組合せは、受付成功後の最初の`client.observe`によるGET失敗へ絞れる |
| 診断不足の再現 | HTTP helperはheaders段階・十五秒期限発火・既知transportCodeを保持するが、読取りToolのcatchはmessageだけを残す。実Tool本文を有限代役で二回実行し、HTTP期限超過true／ETIMEDOUTと期限超過false／ECONNRESETが、どちらもprimaryFailure同値・Task timedOut false・result null・close一回へ縮約されることを確認した。実失敗がどちらだったかは復元できない |
| 取消との連鎖 | HTTP失敗後はfinallyのhandle.close→WorkbenchのaiRequests.close→Task Ownerのabort／joinへ進む。保持したQueueのsingleTaskはsettled／unknown、理由workbench_ai_provider_effect_after_cancellation_unknown、cleanup falseである。この理由は取消SignalとAdapterのEffect発行フラグが同時に立った分岐に一致する。EffectフラグをAI推論開始と同一視せず、本体Provider not_started／externalSend not_issuedは維持する |
| 回収未確定の理由 | 認証確認Containerの作成意図だけが残り、Receipt／実IDが未記録。正式回収がresource_unconfirmedで停止するのはこの未知結果を成功にしない処置であり、現在一覧に見えないことだけでは過去要求の終了を証明できない |
| Docker側の同時変化 | 現在bridgeの生成時刻は13:12:43 UTC、試験要約作成は13:12:48 UTC。前後でbridge IDが変わったことと整合するが、原因・主体・HTTP失敗との因果は未特定。現在の既定接続とRuntime固定Named Pipeは同じEngine ID・bridge IDを返した。当時の異接続を証明するものではない |

現在稼働中のDesktop／backendの開始時刻は2026-10-21だった。参照候補のHost／VMログの更新時刻は今回の失敗より古く、今回の実原因の根拠に用いない。時刻指定のDocker events読取りは終了せず、事象なしとは判断しなかった。今回開始したexact読取りクライアント一件だけをコマンド一致で終了し、Engineや他Processは停止していない。

保持Queueの元Host参照は`host.crdd-coordinator-doctor-e5d13853-77aa-4965-a0d5-574ff5facc30.e5d13853-77aa-4965-a0d5-574ff5facc30.f8c0c943baff019e4c3d504a0cf0188fbd5b3f4af55beaab6fd736990d097225`。前節の正式回収後の現在Host参照と混同せず、同じDocker回復参照・保持Rootへ結合したまま残す。保持状態は読取りだけで、書換え・削除はしていない。

局所の既存試験は、HTTP診断の秘密非公開と期限／本文清掃の区別二件が成功（761.5387ms）、Effect後の取消を成功へ昇格しない一件が成功（506.3715ms）。実Tool本文の有限代役二例も成功。いずれも外部AI・認証情報・Docker作成を使わず、実際の接続エラーcodeの特定や全体E2Eの成功を示さない。

最小是正候補は読取りToolに限る。既存`projectVerificationTransportFailure`を使ってHTTPの固定分類を保持し、受付済みrequestIdをcatchまで保持して、同じOwnerの取消結果を保存してからcloseする。これは既存Workspace検証Toolが採る処置であり、新しいRunner・Store・Lock・Recoveryは不要である。通信失敗を一次理由として維持し、取消・回収の結果とexact参照を別に残す。HTTP期限延長、Docker再起動、Model変更や回復条件緩和を原因未特定の代替にしない。今回は調査のみで未実装とする。

Source照合・有限再現・結果二文書の限定独立確認では、timedOutの初期値と再計算条件の説明を是正し、再確認後は全重大度の残指摘零。保持Rootの状態更新時刻は調査前と同じ13:14:06 UTCで、今回の診断用短命入口二本は回収済みである。

<a id="readonly-verification-minimal-fix"></a>

### 読取り試験Toolの最小是正 — 2026-10-24

利用者の是正指示に従い、既存のHTTP固定診断と受付IDを読取りToolへ接続した。受付後の観測失敗では同じTask Ownerの取消を一回だけ待ち、同IDの結果・cleanup・exact回復参照を保持してからServerを閉じる。取消欠測・ID不一致・close失敗は副次情報とし、一次HTTP理由を上書きしない。Task期限の既存HTTP取消を発行済みの場合は追加取消せず、受付前・受付結果不明にも推測取消しない。正常経路・期限・製品公開API・保存形式・Docker安全条件は不変更で、新しい管理機構はない。

変更分類は検証Toolの診断・終了処置の局所修正。着手前に既存Workspace試験ToolとTask Ownerの取消契約、HTTP診断の秘密非公開条件を照合した。回帰面は公開HTTP搬送と受付前後・取消・closeの境界であり、ERB-IT-021の既存結合Suiteへ接続した。限定独立レビューとArchitecture直接伝播確認を行い、標準準拠・Release監査や実AI再試験は追加しない。

| 確認 | 結果・限界 |
|---|---|
| 静的検査 | format・Source／Test型・lint成功。既存lint info五件は不変更 |
| 有限失敗経路 | 正常、受付前、受付不明、HTTP期限、切断、取消unknown／例外／別ID、副次失敗、close失敗、Task期限取消の成功／失敗の十二例成功。生本文・資格の非保存と取消最大一回を確認 |
| 結合Suite | 通常Windowsで十三件成功、失敗・取消・skip・todo零、17,969.293ms。制限環境では既存loopback試験一件が受付前に失敗し、実行環境を分けて全件再確認した |

外部AI・認証情報・Docker操作・保持Root操作は行っていない。これは診断欠落と終了結果欠落の是正であり、過去のHTTP原因の復元、未確定Containerの回収、実AI成功を意味しない。

固定六Fileの限定独立レビューはMajor／Moderate／Minorすべて零。受付ID・取消最大一回・同ID結果／回復参照・一次失敗保持・close順序、Architecture／QAへの直接伝播と実境界未証明の区別を確認した。保持state.jsonは13:14:06 UTC・9,122 bytesのままであり、不変観測を実回収の証明には使用しない。

<a id="readonly-trial-recovery-readonly-assessment"></a>

### 最小是正の保存と保持物の読取り再評価 — 2026-10-24

利用者の承認に従い、前節の六FileをCommit `22082c5b9fcdd7b436b4cf4e650ff473bc29a161`として既存作業Branchへpushし、remote追跡先との一致を確認した。その後は、保持中の同じ試験の現在記録・既存回収処理・Docker読取りだけを照合した。変更分類は調査結果の記録であり、Source・終了条件・決定権限を変えない。実行環境のアクセス拒否を資源不存在と扱わず、許可された読取りを通常Windowsで再確認した。

| 照合対象 | 2026-10-24 13:52 UTCまでの観測と判断 |
|---|---|
| Engineと予定資源 | Engine 29.8.1応答。認証確認のexact名`crdd-auth-cf28e3807e42518e`、同名＋所有Label、および今回Label `crdd.coordinator.runtime=cf28e3807e42518e`のContainer一覧は空。exact名のinspectはDaemonのNo such container。今回LabelのNetwork一覧とinternal／egressのexact名一覧も空。これは照会時点の結果であり、遅延要求の将来結果は証明しない |
| Processの限定照会 | CIM読取り成功時、参照可能なCommandLineが今回Root又は実行Identityに一致するNode／Dockerクライアントは零。不可視CommandLine、すべての孤立Process、Daemon内の要求完了まで証明しない |
| 保存記録 | authだけrequest／observation unknown・dockerId／Receiptなし。他四purposeはnot_requested。phase settling、ownerEffect disabled、Provider not_started／外部送信・共有書込みnot_issued、旧領域再利用不可。dockerRestartはnull。stateは13:14:06 UTC・9,122 bytesのまま |
| 通常回収の条件 | DI `discoverSubmittedDockerResource`は名・Label・構成の一致する実IDを発見できる場合だけ識別する。未発見はnullであり、現在回収Ownerはunknownを保持してresource_unconfirmedを返す。現状で同処理を再実行しても閉じられる新しい根拠は得られていないため、回収再実行はしなかった |
| 限定unknown終了の条件 | `coordinatorAuthenticationUnknownCanClose`は同じ回復IDへ結合した再起動のrequest／cleanup confirmedと最終completed／Effect不明false等を要求する。今回はdockerRestart nullで不成立。独立した現在一覧、disabled、Process限定照会だけでこの条件を置換しない |

今回の範囲では、回収完了や安全な削除の成立には到達していない。試験自体は停止済みのまま、同じexact回復参照とRootを保持する。既存経路で進むには同IDに結合した検証付きDocker再起動が追加判断になるが、今回は未承認のため発行しない。再起動を避けるための新しい回復機構・状態書換えは追加しない。既定七日の再評価日2026-10-31は維持し、期限による削除はしない。AI再送・Docker作成／削除／再起動・Host領域清掃・保持物変更は零である。

二文書の限定独立確認はMajor／Moderate／Minorすべて零。現在観測・過去不明・将来の遅延作成を区別し、現行Sourceの終了条件と保持判断が一致することを確認した。調査・記録だけのため実行試験と準拠／Release監査は追加しない。

<a id="readonly-trial-approved-restart-recovery"></a>

### 承認済み再起動と同IDの技術回収 — 2026-10-24

利用者は同じ回復IDの検証付きDocker Desktop再起動一回と今回試験物の正式回収を承認した。基準Sourceは`723b039fe`。既存Workflowと公開CLIを照合し、合成Repository `readonly`を現在Rootとして`recovery restart-docker`、成功確認後だけ同IDの`recovery resume`を各一回実行した。再起動前はEngine 29.8.1応答、稼働Container零、停止済み既存Container一件であり、既存物の削除や旧修復へのfallbackはしなかった。

| 段階 | 実測結果と限界 |
|---|---|
| Docker Desktop再起動 | Exit 0、status completed／reason docker_restart_settled。request confirmed、restartCompleted／cleanupConfirmed／cliCleanupConfirmed true、effectOutcomeUnknown false、一次・停止・起動・清掃失敗null。起動所要時間18,440ms。Task回復完了とは別の結果 |
| 再起動の結合 | requestId `60a24b9f078d25158fd510a716254bb23fbeb803f191c92682e118ce8fdaac23`。前節と同じexact Docker回復IDへ結合し、追加再起動は零 |
| 同IDの正式技術回収 | Exit 0、status recovered／reason docker_task_recovery_completed。Docker／Host cleanup、Lock解放、履歴確定、操作除去、taskRecoveryCompleted、CLI解放はいずれもtrue。deliveryPending／operationRetained false |
| 耐久記録 | history-row/v2のoperation-summary/v4に同IDと再起動confirmed、Host清掃confirmed、Lease releasedを確認。元Provider not_started／externalSend・sharedWrite not_issued／Owner disabled／旧Workspace再利用不可を保持する。元Taskを成功へ変更しない |
| 回収後状態 | state改訂32、operations／unresolvedRecoveries／pendingDeliveries／historyPending／leaseIntents零。Task受付一件はrecovery_required、singleTask settled／unknown／cleanup falseと元Host参照を保持。技術回収と上位受付の終了反映は分ける |
| Docker後観測 | 今回LabelのContainer／Network、認証確認exact名のContainerは空。既存停止Containerの実IDと状態を保持。利用者Network、host／noneの実IDは維持し、標準bridgeの実IDは再起動で変化した。既存資源を削除していない |

技術回収後、上位受付の後処理だけを既存の公開Task Sessionへ一回接続した。exact受付ID `request-331b595d-f327-4d04-b57f-b051d5232357`、同じProject・主体、既存operation／unresolved零とsettledを確認し、startを呼ばずcancelによる保存済み受付の回復を意図した。ただし`openTaskSession`が`orchestrator_task_state_initialization_blocked`で拒否し、cancel本体には到達しなかった。再試行・記録書換えはしていない。読取りの追加照合ではRoot検証・Repository Binding一致・受付世代の存在は確認できたが、内部初期化の拒否分類は公開例外から復元できず、原因未確定として残す。

今回の技術回収は成立したが、上位受付の終了反映は未成立である。合成Rootは削除せず、元試験結果・現行state・履歴とexact参照を保持する。次は外部AIなしで初期化拒否を局所調査する。追加再起動・AI再送・本体設定変更・記録強制削除・新しい回復機構は今回の操作に含めない。保持の再評価日2026-10-31を維持するが、現在の未解決箇所をDocker物理資源の未回収と混同しない。

結果二文書の限定独立レビューでは、正式技術回収と利用者の既存資源非変更を区別する表示一件を是正した。再確認後はMajor／Moderate／Minorすべて零。Source変更がないため実装回帰・準拠／Release監査は追加せず、今回の実観測と未完了範囲の直接整合を確認した。

<a id="readonly-trial-task-initialization-resolution"></a>

### 上位受付の初期化拒否と終了反映 — 2026-10-24

利用者の継続指示に従い、外部AI・Docker再起動なしで初期化拒否を調べた。下位の既存Readerは`orchestrator_snapshot_lock_unavailable`を返した。原因は前節のフロントAIによる一行実行方法だった。`node --input-type=module -e`の`--input-type`がファイル型Workerへ継承され、Worker起動が`ERR_INPUT_TYPE_NOT_ALLOWED`で拒否されるため、保存排他を取得できなかった。製品の保存破損・競合や終了条件の不具合ではない。

同じ保持stateへ既存Readerを使う短命診断で比較した。フラグ付き一行起動はWorker拒否・Reader blocked、通常`.ts`ファイル起動はWorker ready・Reader completed／snapshot_observedだった。両方でstateのSHA-256不変を確認した。診断初版のWorker URL文字列指定誤りは`ERR_WORKER_PATH`で停止したため、`new URL`へ訂正してから比較した。この初版結果を原因の根拠へ使わない。

是正はフロントAIの短命入口を通常ファイル起動へ戻すことだけとし、製品Source・公開API・保存形式・排他・回復条件は変更しなかった。Workflowへ同じ起動条件と短命入口回収を追従した。短命回収入口は実行前レビューで対象状態・exact参照・現在Rootの再評価・close後の結果表示を補強し、再確認後は全重大度指摘零。exact受付ID、Project・主体・operation、settled／unknown／cleanup false、元Host回復参照一件を検査し、startを呼ばず既存Task Sessionの同IDcancelを一回だけ実行した。

| 確認 | 結果・限界 |
|---|---|
| 通常起動での上位受付後処理 | Exit 0、同じrequestId、status unknown／reason orchestrator_task_body_unavailable、cleanupConfirmed true、recoveryIds／secondaryFailures空、closeConfirmed true。回答本文の欠測を成功や空の正常回答へ変更しない |
| 終了後現在状態 | 改訂38でqueue completed、元singleTask settled／unknown、Owner世代null、cleanup true・回復参照なし。operations／unresolved／pending／leaseIntents零 |
| 履歴の確定 | 残るhistoryPending一件を既存transferCoordinatorSnapshotHistoryで一度搬送し、recorded 1／expired 0。failed／cleanup confirmedの終了要約を保持。改訂39でhistoryPendingも零 |
| 清掃前照合 | 合成Root内三十File・三十三Directory、他Worktreeなし、Workspace零、未解決・配送・履歴・排他意図零。祖先・子孫のsymlinkなし、Fileのnlink一、参照可能CommandLine中の今回Root／短命入口に一致するNode・Dockerクライアント零 |

これにより技術回収と上位受付の終了反映が成立した。元の読取り試験は失敗・回答不明のままであり、実AI成功やDirect／Isolated E2E成功は主張しない。今回の処置ではAI送信・Docker操作・本体設定変更・state手動編集・新しい管理機構追加は零。製品Source不変更のため新しい製品回帰は追加せず、実行方法の比較、同ID結果と終了状態、Workflowの直接伝播を確認した。

上記の結果を本節へ記録後、承認済み試験物回収の範囲で合成Rootのresolved絶対Pathをexact一致検査し、そのRootだけを削除して不存在を確認した。今回の短命診断・回収・履歴搬送の三入口も回収した。以前の2026-10-31再評価対象の物理残存は解消しており、未解決のまま期限で削除したものではない。元のHTTP故障と作成結果unknownの履歴・exact回復参照は本変更記録とGit履歴へ保持し、過去の成功へ書き換えない。

Workflow・結果記録・現在投影の三文書は限定独立レビューで全重大度の残指摘零。起動比較の根拠、元結果unknownと現在回収完了の区別、履歴確定後のexact Root清掃と次のAI再確認の別承認を確認した。

<a id="claude-readonly-confirmation-fixture-stop"></a>

### Claude再確認の受付前停止と合成Context是正 — 2026-10-24

利用者はClaude `opus / medium`の読取り一回を承認した。基準`b16b3696b`、新品合成Root `.crdd/tests/claude-readonly-confirmation-20261024/readonly`、合成Context一件と既存固定質問だけを使用し、編集・AI再送・Docker再起動はしない条件とした。Engine 29.8.1、稼働Container零・既存停止一件、現行Claude／Proxyのexact固定Imageのlinux/amd64を確認し、取得・Buildはしていない。Workbench checkも成功し、既存lint info五件は不変更だった。

短命の通常ファイル入口は、保存拒否時の現行union搬送、Root再評価、外部Effect直前のSource固定、単一の非秘密summary・失敗Exit 2指定を実行前確認で是正し、再確認後の残指摘零で正式Toolを一回呼んだ。設定の正式保存は成功したが、Toolは`readonly_verification_preflight_failed`、driverは安全な固定拒否を返した。外側の実行環境が返した終了値は1であり、Nodeのnative終了値は別途捕捉していない。Source上のExit 2指定を実測終了値と混同しない。

原因を外部AIなしで段階別に確認した。Root検証・Revision読取り・Docker inventory・AI設定Readerは成立し、`readWorkbenchProjectSurface`だけが`project_context_table_missing`を返した。今回フロントAIが生成したContextに必須表がなく、Metadata・見出し・本文だけだったことが原因である。正式Toolのこの読取りはTask Session作成・受付・Provider要求より前にあり、今回Rootにもcoordinator stateが存在せずconfigだけであった。AI起動・推論送信・試験Docker資源発行は零であり、Claudeの実行失敗ではない。

製品SourceとReader条件を変えず、合成Contextの各節へ既存fixtureと同じ形式の表だけを追加した。非AIの前提再照合ではsurfaceが同じProject IDを返し、Root・inventory・選定Readerも成立した。正式Tool・AIの再試行はしていない。Workflowへ同じ表形式と、実AI前の非AI表示前提確認を追従した。本体Contextや資格値は送信・複製していない。

結果記録後、今回fixtureはcoordinator状態Directory不存在、自己生成GitのWorktree自身一件だけ、二十七File・三十Directoryのsymlinkなし／File nlink一を確認した。resolved絶対Pathのexact一致を確認して今回Rootだけを削除し、不存在を確認した。短命な実行・非AI診断入口二本も回収した。未解決Runtime状態の強制削除ではない。Claudeの実推論確認は未実施のまま残す。

三文書の限定独立レビューは全重大度の残指摘零。fixtureの前提停止とProvider未起動、外側終了値とnative欠測、非AI前提是正と限定清掃を区別した。製品Source不変更のため製品回帰を追加せず、既存Readerの実前提確認と文書の直接伝播を検証範囲とした。

<a id="claude-readonly-once-diagnostic-result"></a>

### 修正済み前提でのClaude読取り一回と診断結果 — 2026-10-24

利用者の再承認に従い、基準`09681073e`・cleanなSourceから、新品合成Root `.crdd/tests/claude-readonly-once-20261024/readonly`を準備した。必須表、Git info／空exclude、正式AI選択保存、Root再評価、同じProject IDの非AI表示確認を先に通し、Effect直前にもSource HEAD／cleanを再確認した。送信許可は合成Context一件と既存固定質問だけ、Claude `opus / medium`の一回に限定した。通常ファイルの短命入口は独立確認の残指摘零で実行し、正式Toolの呼出しは一回、再試行は零だった。

| 実観測 | 結果・意味と限界 |
|---|---|
| Tool最終結果 | Node native終了値2をShellで別途捕捉。limitedProbePassed false／fullE2eVerified false。受付ID `request-e6d06202-ce4e-4613-83c3-1b0cddeb36fc`、failureStep observe、一次理由workbench_verification_transport_failed |
| HTTP診断 | headers_unobserved、HTTP timedOut false、transportCode ECONNRESET。前回失われた「HTTP期限か切断か」を今回は区別できた。Task timedOut falseとは別の観測であり、接続を切った主体や原因までは特定しない |
| 認証確認作成 | Operation `OP-38642440089871151122961587150122726409`。create_subscription_auth_probe／execution_classification／docker_setup_create_subscription_auth_probe_failed。commandHandleObtained・responseObserved true、Receipt未記録、終了値1・stdout／stderr各0 bytes。これだけでDocker側の拒否原因を断定しない |
| Provider／Effect | ProviderContainer作成・Provider本体開始・完了はいずれも未観測。耐久記録はproviderStart not_started、externalSend／sharedWrite not_issued。認証確認以外の四資源はnot_requested。今回をClaudeの推論非0や実送信成功として扱わない |
| Toolの終了処置 | 同じ受付IDへ取消を一回発行し結果を受領。cancellationFailure／closeFailure null、closeConfirmed true。元のHTTP理由を上書きせず、返却結果unknown／body_unavailable・cleanup falseとexact回復参照を保持できた |
| 副次失敗 | orchestrator_single_task_terminal_identity_conflict、orchestrator_queue_release_settlement_state_mismatch、orchestrator_task_lease_release_unconfirmedを欠落させず保持。表示用のOwner世代nullやleaseIntents零から排他解放の成功を推定しない |
| 資源と前後固定 | provider_cleanup_unconfirmed。既存資源inventory保持・System捕捉構成同値だが、標準bridgeがf8c36a96…から257f1218…へ変化。後者生成は14:57:18.056939622 UTC。今回の再起動発行や、HTTP切断との因果を意味しない。本体Source・合成Context／HEAD／Treeと選択設定は前後不変 |

終了後の同Root state改訂21では一操作がsettling／Owner disabled／旧Workspace再利用不可、認証確認だけrequest／observation unknown・実ID／Receiptなしを保持した。Queueはrecovery_required、singleTask settled／unknown／cleanup false。operationsが残る一方でunresolvedRecoveries一覧・leaseIntents・配送待ちは零であり、配列の件数だけから終了済みにしない。

今回のDocker回復IDは`docker-task.29c9921916f3a63170e77179d3145c8627a2b3519d5813b7c9cf2a87d136d9aa.776fa54649f45e47f6b0673986d25c3963883205ac2c144a3fd34a32f1df9008.ff809c3737cf2973c3cb1b99289f759d8e1ae3f6f3100d9c6ed5bc8273b6c667`。Task返却・Queueの元Host参照は`host.crdd-coordinator-doctor-fc2ca38f-5690-4698-83a9-c523d6ddf93d.fc2ca38f-5690-4698-83a9-c523d6ddf93d.df71aebf523ba254944a8e48edaedc7511179f65bf1c30b1f975320142661879`、現在操作のHost参照は`host.crdd-coordinator-doctor-fc2ca38f-5690-4698-83a9-c523d6ddf93d.fc2ca38f-5690-4698-83a9-c523d6ddf93d.4a8df4db869a015cb523b8ca343881d9f6de093f0c6245f0ce6dbc62cf5dd24a`。世代の異なる参照を混同しない。

終了後の限定Docker読取りではEngine 29.8.1応答、予定auth名`crdd-auth-1b19d805b65b9ae2`と今回Label `crdd.coordinator.runtime=1b19d805b65b9ae2`に一致するContainer／Networkは見つからなかった。現在未発見を過去create終了や遅延作成不能の証明にせず、未知資源の削除・追加の回復実行・再起動は行わなかった。

今回Rootと安全な`result.json`を、同じ回復参照・状態とともに保持する。生Provider本文・資格値は保存していない。既定七日の再評価日は2026-10-31とし、未解決参照を期限で削除しない。次はECONNRESET、認証確認create失敗、副次の終端Identity／Queue処理の関係を外部AIなしで調査する。実AI再送、Docker再起動、Image取得、ログイン、APIキーfallback、保持物削除は今回の後続処置に含めない。Direct／Isolatedは未実施のままである。

短命な今回実行入口は結果保存後に回収し、不存在を確認した。結果二文書の限定独立レビューでは、現在投影の作成処理失敗／実作成unknownとHTTP診断の表現一件を限定し、再確認後は全重大度の残指摘零。Source・保持状態・exact参照は変更していない。

<a id="docker-common-call-comparison"></a>

### 標準Docker呼出しと共通実行経路の比較 — 2026-10-25（日本時間）

利用者の調査指示に従い、実装変更・AI・認証情報・Container作成・再起動なしで調べた。変更分類は原因調査と記録であり、工程契約・権限・保存形式を変えない。技術観点はProcess／環境／固定接続・設定と終了観測、レビュー範囲は調査の確度と次の限定試験の境界とする。標準準拠・Release監査や実AI再試験は追加しない。

Sourceではauth／proxy／providerのcreateはいずれもDIの`planDockerIsolationCommands`、`startCommand`、`startOwnedWindowsProcess`と共通Sessionの待機・分類・Receipt搬送を使う。認証確認だけ別の作成APIではない。用途差はNetwork none・Provider Home readonly・Workspaceなし等の構成である。一方、手動の標準呼出しと比べるとCRDDは固定Docker実行物・Named Pipe・空config・最小環境と所有Process監視を挟むため、その差を比較対象にした。

同じDocker実行物、固定Named Pipe、Repository-localの同じ空専用config、`version --format`のEngine版読取りを三方式で各一回比較した。結果は下表のとおりで、環境値・例外本文は保存していない。

| 方式 | 終了値／Engine版 | 出力・終了観測 |
|---|---|---|
| 標準execFileSync＋通常環境 | 0／29.8.1 | stdout 9 bytes、stderr 0、同期完了 |
| 標準execFileSync＋CRDD最小環境 | 0／29.8.1 | stdout 9 bytes、stderr 0、同期完了 |
| CRDD所有Process＋同じ最小環境 | 0／29.8.1 | stdout 9 bytes、stderr 0、closed true、待機期限未超過 |

読取りでは三方式とも成立した。これはcreate・bind Mount・Host認証領域・同時HTTP観測を通しておらず、最小環境やProcess監視がcreate失敗の原因でないと一般化しない。空stderrの終了値1、HTTP ECONNRESET、bridge再生成の因果は未特定のままである。元の保持Root・状態・回復参照は変更しなかった。

比較に使った自己生成Rootは、空configと安全な結果一件だけであること、配下のReparsePointなし、resolved絶対Pathのexact一致を確認し、記録後にそのRootだけを削除して不存在を確認した。短命な比較入口も回収した。Container／Networkは作成しておらず、保持中の実試験Rootには触れていない。

次の比較候補は、既存固定Python Image `sha256:d67a7b66b989ad6b6d6b10d428dcc5e0bfc3e5f88906e67d490c4d3daac57047`で、専用の空Host領域だけをreadonly Mountし、auth同等のnetwork none／read-only／non-root／cap-drop／no-new-privileges／pids-limit構成の停止Containerを二件順番にcreateする方式である。標準execFileSyncとCRDD所有Processに同じ最小環境・設定・argvを渡す。起動、AI、認証領域、Repository mount、Image取得、独自Network作成は行わない。取得実ID・名前・Label・Image・構成を確認した今回物だけをexact IDで回収する。作成結果不明・構成差・回収失敗では再試行せず根拠を保持する。現時点は提案だけであり、限定試験とその回収の人間承認後に実行する。

結果・次試験案の二文書は限定独立レビューで全重大度の残指摘零。読取り成功の非一般化、保持物非変更、未承認createの非実行、実ID確認後の回収とunknown時の停止を確認した。

<a id="docker-common-create-comparison"></a>

### 承認済み停止Containerのcreate比較 — 2026-10-25（日本時間）

利用者の承認後、既存固定Python Imageのexact ID・linux/amd64・稼働Container零を確認し、新品Root `.crdd/tests/docker-create-compare-20261025`の空Homeと空CLI configだけを使った。通常のTypeScriptファイル入口を構文確認し、実行前独立確認ではHOME環境の読戻し条件一件を追加して、再確認後の残指摘零で一回実行した。製品Sourceと保存・回復契約は変更しなかった。

二方式とも、同じ絶対Docker CLI、Named Pipe、最小環境、空config、固定Image、同じ制限を使用した。名前の方式識別部分以外は同じcreate引数で、network none／read-only／non-root 65534／cap-drop ALL／no-new-privileges／pids 32／HOME固定／専用空領域のreadonly bindを指定した。Containerは逐次一件ずつ、合計二件だけ作り、startは発行していない。

| 方式 | 作成結果 | 構成読戻し・回収 |
|---|---|---|
| 標準execFileSync | 終了0、stdout 65 bytes／stderr 0、実ID `5cea51f93cc845d6dbcced264223011e414763a4f1a42dce90a6726361c9e96b` | 構成一致、削除直前の実ID・Label等の再確認後に非force rm。実ID／予定名の成功一覧が空で不存在確認 |
| CRDD所有Process | 終了0、stdout 65 bytes／stderr 0、closed true・期限未超過、実ID `6012f57c81be822a49fa7a2a0c6eb01bcc4214bbbdd59338c11c295997b95e32` | 同じ構成条件が一致し、同じ回収・不存在確認が成立 |

構成Oracleは実ID・名前・Label・Image・created／非稼働、User・Cmd・HOME一件、network mode、readonly rootfs、非特権・cap-drop・security option・pids、Mount件数・用途・readonly・Propagationと元Sourceを読戻した。共通Labelは`crdd.create-comparison=d8142b85c7460f5f`で、終了後のLabel一覧も空。既存ContainerのID・状態・名前一覧は開始前と同じだった。native終了値0、containersCreated 2／containersStarted 0である。

今回の固定Python・空Mount条件では、作成から回収まで両方式が成立し、Process包装の差による故障は再現しなかった。これを全用途の共通経路の無欠陥証明にせず、Claude Image、実認証Home Mount、同時Workbench HTTP／取消・保存を通す実失敗の原因は未特定とする。統合すべき別の認証専用create経路が見つかったわけではなく、根拠なくProcess監視や安全条件を削除しない。AI・認証情報・Repository Mount・Container起動・独自Network作成・Image取得・再起動・元保持物の処置は零であった。

結果記録後、自己生成Rootのresolved絶対Path一致・ReparsePointなし・二件とも構成／回収／Process close確認済み・空Homeと空configと結果一件だけであることを確認した。そのRootだけを削除して不存在確認し、短命入口も回収した。保持中のClaude試験Rootは清掃対象に含めていない。

結果二文書の限定独立レビューは全重大度の残指摘零。実測の作成・構成・回収と未検証の実Claude条件を分離し、製品Sourceや実回復条件を変更しないことを確認した。

<a id="claude-create-condition-readonly-analysis"></a>

### 実Claude条件差の読取り調査 — 2026-10-25（日本時間）

利用者の継続指示に従い、Source・保持記録・Imageの非秘密metadata・Provider Home Directoryのmetadataだけを調べた。認証File本文、環境の秘密値、既存の回復Ownerを開かず、Container作成・起動・AI・再起動・保持state更新は行っていない。変更分類は原因調査と是正候補の提示であり、実装や安全条件の変更ではない。

| 調査面 | 確認事項と限界 |
|---|---|
| Image差 | 固定Python／Claudeはいずれもlinux/amd64、宣言Volume零。Pythonの既定User・WorkingDirは空でEntrypoint零、Claudeは非空User／WorkingDirとEntrypoint一件。Userはcreate引数で共通化できるが、他のImage条件は先の比較で揃えていない。createだけではEntrypoint自体は実行されず、metadata差を失敗原因へ昇格しない |
| Home所在 | Sourceが導く現在のProviderHomes親とclaude Directoryは存在し、Directory型・ReparsePointなし。File内容や権限変更には触れていない。過去のMount実体一致、Docker側からのアクセス、ACL正常性、認証有効性は未証明 |
| HTTP Owner | Sourceは途中切断だけを要求取消へ結合し、通常例外は固定500へ変換する。明示closeは所有Socketをdestroyするが、Toolのcloseは一次HTTP失敗後であり、これだけで元ECONNRESETの原因とは言えない |
| 同期待ち仮説の限定反例 | 実Workbench HTTP Ownerと有界Clientを使い、合成応答の連続二読取りを、同期待ち零と6.5秒で各一組比較。両方二応答とも200、失敗なし、Server close確認、native終了0。Docker・AIは使っていない。この一条件で切断は再現せず、実保存／排他／HTTP全体の原因除外にはしない |

省電力復帰の遅延仮説も一般的な可能性として確認したが、今回の失敗原因とは特定しなかった。現在設定はWslEngineEnabled trueで、省電力の有効・実発動値は当該設定読取りから確定できない。[Docker公式説明](https://docs.docker.com/desktop/use-desktop/resource-saver/)では、WSLではVM停止でなくEngine pauseであり、復帰遅延はないと区別している。一般VMの3〜10秒復帰説明を、このPCの10秒create期限へ無条件に当てはめない。

一方、`orchestrator_single_task_terminal_identity_conflict`には具体的な搬送欠落がある。`runRepositoryAdvice`の返却と`task/requests.ts`の助言結果はHost参照だけを初回terminal recordへ渡す。後の同Task回復は、`resolveRuntimeOwnedDockerTaskCurrentCorrelations`からexact Docker参照を発見し、未回収なら同参照を結果へ追加する。`updateCoordinatorSingleTask`は既存settled結果にない回復参照の追加を拒否するため、今回の「保存Host一件→回復結果Host＋Docker」の値は同名の拒否条件を満たす。元のQueue・結果とSource分岐が対応する。ただし、Queue解放の二つの副次失敗の全原因や、先行するcreate失敗・ECONNRESETの原因まで解明したとはしない。

最小是正候補は、同じ技術Operationに確定したDocker回復参照を、初回terminal保存までにHost参照とともに利用側へ搬送することである。別Operationの参照追加を禁止する既存terminal検査は緩めず、新しいState・Registry・Recovery機構は作らない。現時点はSource照合による候補であり、変更する場合は同一／別Operation・参照欠測・回復失敗を外部AIなしで反証してから適用する。今回の調査では未実装。

create自体の次の実境界比較候補は、先のCRDD所有Process＋空readonly Homeを保ち、Imageだけを固定Claude `sha256:ddd766072db6e69f55efb11fc3e82b401542cb5583c179f56aac4004f4ea317a`へ切り替える停止Container一件である。認証情報・AI・Container startを含めず、前提・同ID構成確認・回収・unknown停止条件を示して追加承認後に実施する。まだ作成していない。保持中Rootと回復参照は変更せず、HTTP比較用の短命入口だけを回収する。

本節と現在地二文書の限定独立レビューは全重大度の残指摘零。Sourceに一致する搬送欠落、未特定の一次原因、比較の一般化限界、未実装の是正候補および追加承認待ちの試験を区別していることを確認した。

<a id="advice-recovery-reference-handoff-fix"></a>

### 助言の初回回復参照搬送の限定是正 — 2026-10-25（日本時間）

利用者の継続指示に基づき、実装詳細の是正として既存の引渡し経路を修正した。着手前にController、助言Runtime、Task受付、単一WriterとArchitecture／Qualityを照合し、読み取り専用の独立確認で着手可を得た。保存Schema、認可、回収条件、terminal guardと過去Evidenceは維持する。専門観点は回復参照の初回搬送・取消・例外・正式終了のlifecycleと、保存利用側の整合である。準拠基準・リリース判断を変更しないため準拠監査・リリース監査は対象外とし、Source／検証／文書伝播の限定独立レビューを行う。

Controllerは既に同じOperationへのbinding検証後にCapabilityとexact Docker参照をcallbackへ渡していた。助言Runtimeがその既存値を一度だけ捕捉し、既存の私有失敗分類、Repository助言結果、Taskの初回`recoveryIds`へHost参照とともに搬送する。不正引渡し後の再捕捉と二重引渡しでは元の組を上書きしない。正式finalize前の同期例外・取消・完了失敗・清掃不明では参照を残し、Host清掃やabandonだけをDocker終了としない。正式finalize成功後だけ参照を解放する。状態の事後探索、新State、Registry、Lock、Recovery機構とterminal guardの緩和は追加していない。

| 確認 | 今回の観測と限界 |
|---|---|
| 静的検査 | 整形、production／test型、warningを失敗とするlint、Runtime／Task Trace検査が成功。既存lintのinfo 84件は残る |
| 助言Runtime・Repository入口 | 二Suite22件成功。正常、引渡し直後throw／blocked、取消、完了throw、cleanup不明、finalize失敗、二重／別参照、不正後valid、欠測を合成依存で反証した |
| 初回Task実保存 | 新Suite一件成功、レビュー是正後も再実行成功。実Task SessionとWriterでHost／Docker両参照の初回保存、同参照の再保存、別参照追加とOperation差替えの拒否を確認した。Catalog／Symbolに登録し、`PRL-IT-013`等と実Ownerへ接続した |
| 関連回帰 | Task Adapter、Docker Process Controller、開発時観測の三Suite269件成功。実AI・実Docker試験ではない |
| 台帳 | CheckerのCatalog検査は384件でvalid、試験実行・Effectなし |
| 既存の広範な保存Suite | `single-task-state.integration.test.ts`は通常権限と追加権限の双方で無出力待機が続き、今回起動した試験Processだけを終了した。未完了でありPassに算入しない。待機原因は未特定。今回の修正でこの既存Suite全体を確認済みとはしない |
| 試験物 | 中断した今回の合成Root二件はexact Path、ReparsePointなし、Docker操作・回復・配送の記録なしと試験Process終了を確認後に回収し、不存在を確認した。新ITの自己生成Rootも回収済み。既存の別試験物は清掃していない |

保持中の`claude-readonly-once-20261024`のstateは最終更新UTC `2026-10-24T14:57:55.4549934Z`・10,235 bytesで変化していない。AI再送、Docker照会・作成・再起動、認証情報の読取り、保持物や旧記録の書換えは行っていない。今回の是正は初回参照欠落への対処であり、元Container create失敗・ECONNRESETの原因解明や保持試験の回収完了ではない。

Source・検証・文書伝播の限定最終独立レビューは全重大度の残指摘零。初回搬送の是正と未完了の既存Suite、元の一次故障、保持試験の未回収を分離した限定結果として扱う。

<a id="single-task-state-duration-diagnosis"></a>

### 既存単発保存Suiteの長時間実行の切分け — 2026-10-25（日本時間）

利用者の継続指示に基づき、未完了だった`single-task-state.integration.test.ts`へ固定段階名だけの一時表示を入れ、新品の合成Rootで実行した。変更分類は既存試験の原因調査・結果記録であり、製品の意味・公開契約・保存形式・認可・回収条件を変更しない。現在の試験とTask Owner、同期Writer、Native排他、取消通知順を着手前に照合した。読取り専用の独立確認を利用し、準拠・リリース判断へは進まない。

初期Writerの確認は約40秒で通過し、保存Revisionの進行、五回反復、通常取消、権限失効、外部取消、回復と別Session再入場まで順に通過した。診断付きCaseは359,295.604ms、実行全体359,694.6575msで成功した。今回の無出力待機は停止の証拠ではなく、数多くの実Writer・Snapshot・Lease・Native排他を直列に使う約六分のCaseだった。前回の三分前後での中断判断は早すぎた。個々のI/Oの費用内訳は計測しておらず、特定のOS primitiveの故障や改善対象とは断定しない。

疑った取消通知の取りこぼしも現Sourceでは成立しなかった。fake executeの`await started()`後のlistener登録は、`await owner.start()`後の取消より先のmicrotaskで進む。事前取消はexecute前に本番Ownerが停止する。この順序を根拠に製品Source・試験代役の変更、timeout延長、assertion緩和、新しい監視・Lock・Recoveryを行わなかった。

一時段階表示は全撤去し、当該試験Fileが基準Commitと同じであることを差分で確認した。診断付きCaseの成功は切分け根拠であり、一時表示撤去後のSuite全体の確認結果とは分ける。診断Rootは試験の既存cleanupで回収され、不存在を確認した。元のClaude保持Rootは不変更で、AI送信・Docker照会／再起動・認証情報読取りは行っていない。

一時表示撤去後の元Suiteは二件すべて成功、失敗・取消・skip零、終了0で完走した。主Caseは292,366.7035ms、全体292,811.3303ms（約四分五十三秒）。先行の二権限での中断をPassへ読み替えず、この別実行の完走根拠で未確認だったSuiteを閉じる。製品Source、試験代役、assertion、待機期限は変更していない。全製品回帰や元の実Claude故障まで確認した結果ではない。

<a id="claude-image-empty-home-create-comparison"></a>

### 固定Claude Image・空Homeの停止Container比較 — 2026-10-25（日本時間）

利用者は、固定Claude Imageによる停止Container一件の作成・構成確認・今回試験物の回収を明示承認した。Engine停止・Image欠測・結果不明なら停止、追加起動・再試行・Image取得・通信・認証・AI・Repository本文の利用・Docker再起動・既存資源削除は行わない範囲である。実行前に短命入口を読み取り専用の独立確認へ渡し、既存Process Owner、入力・出力・終了観測、exact ID照合と非force回収、失敗時保全を照合して着手可を得た。

先のPython比較と同じCRDD所有Process起動、絶対Docker CLI、固定Engine pipe、空config・Home、最小環境、`pull=never`・network none・root読取り専用・cap drop ALL・no-new-privileges・pids32・user65534を使い、Imageを固定Claude `sha256:ddd766072db6e69f55efb11fc3e82b401542cb5583c179f56aac4004f4ea317a`へ切り替えた。今回のHomeはRepository-local試験領域内の空Directory一件だけを読取り専用Mountした。Containerは作成のみで、Entrypoint・Provider本体を実行していない。

| 観測 | 結果 |
|---|---|
| 作成 | 一回、終了0、stdout 65 bytes・stderr 0 bytes、365ms、Process開始・応答・close確認 |
| 実ID | `15ead546bf2771fda81be06ed38dcea1a71060c6412753788a9965711dea8ff9` |
| 対象 | name `crdd-claude-create-comparison-269d4e1fc6c91e65`、label `crdd.create-image-comparison=269d4e1fc6c91e65` |
| 構成 | 実ID・name・Image・label一致、created・非稼働・pid0、上記制限、空Home一Mountの元Path・readonly、HOME一件一致 |
| Container回収 | 削除直前に同じ構成を再確認し、元実IDで非force削除。実ID／name／labelの各一覧が空、既存Container一覧は実行前後で一致 |

この現在の固定Image・空Home条件ではcreate失敗を再現しなかった。実認証HomeのMount、同時HTTP／取消・保存、過去のEngine状態はこの比較に含めておらず、元create失敗・ECONNRESETの原因特定や、実認証・実AI・保持中試験の回収を主張しない。Runtime／Provider設定・製品Sourceは変更していない。結果JSONは非秘密の構成と終了診断だけで、Provider生出力を取得・保存していない。

上記summary固定後、試験Root `C:\project\CRDD\.crdd\tests\claude-create-image-compare-20261025`のresolved絶対Path・期待四entry・ReparsePointなし・空Homeを再確認した。実行Process終了とContainer回収確認後、このRootだけを削除し不存在を確認した。短命入口も撤去して不存在を確認した。通常保存Suiteの新品Rootも既存cleanupで回収され不存在である。保持中Claude試験のstateはUTC `2026-10-24T14:57:55.4549934Z`・10,235 bytesのまま変化していない。Container回収と試験File回収を別に観測しており、既存の別Rootは清掃対象に含めていない。

今回二節と現在地の限定最終独立レビューは全重大度の残指摘零。長時間試験の完走、Claude Image条件での限定比較、未特定の元故障と保持試験を区別し、個々のI/O費用や任意条件での正常性を断定しないことを確認した。

<a id="http-cancellation-and-backend-startup-diagnosis"></a>

### HTTP観測・取消と当時のbackendログの切分け — 2026-10-25（日本時間）

利用者の継続指示に基づき、保持済みの非秘密結果、現在Source、Docker Desktopの既存hostログを読取りで照合した。製品Source・保持stateを変更せず、認証Home本文も読まず、Docker要求、AI送信、Dockerの起動・再起動・修復を発行していない。変更分類は原因調査・結果記録であり、実装是正や回復条件変更ではない。検証Tool、HTTP Owner、Controller／DI Sessionの取消順と既存記録を着手前に照合し、読取り専用の独立確認を利用した。準拠・リリース判断は対象外とする。

| 調査面 | 確認できたこと | 未確定・一般化しないこと |
|---|---|---|
| 取消順 | `verify-readonly-ai.ts`は受付後のobserve失敗を保持してから同じOwner・Taskを一度cancelし、その結果を待ってcloseする。保持結果もobserveのECONNRESETと取消要求・結果観測を記録している。DI Sessionのcancelは活動中の所有Handleをterminate/joinする | create側の非0終了がHTTP切断より前の原因だったとは確定できない。両者の実時刻を直接比較する記録はない |
| 取消時の終了値 | Dockerを呼ばず、既存所有Process処理で合成の無出力Node子一件を開始・取消・joinした。started／terminated／closed／terminationRequestedがtrue、status1、signal null、stdout／stderr各0 bytes。短命入口は撤去した | 元のDocker CLIも同じ理由で終了した証明ではない。「終了1・空出力」だけでは、Docker Engineによるcreate拒否と所有者取消を区別できない |
| HTTPの有限比較 | 実`createWorkbenchHttpServer`と検証Toolの`requestBounded`を使い、合成GET／GET／POST／GET／GETを比較。通常、POST中6.5秒の同期block、受付観測応答後にsetImmediateで6.5秒blockの三条件は、すべて200／200／303／200／200、handled5、failure null、close成功。接続数は2／3／3 | この配置の非再現だけであり、実保存・Native排他・HTTP全体のraceを否定しない。通常制限下の最初の実行はhandled0・transportCode nullであり、loopbackが利用できる追加権限での比較結果とは分ける |
| Docker backendログ | 既存`com.docker.backend.exe.log`成果物にはUTC14:57:13.227763700のVM開始、13.229912000のEngine開始、19.860731900のEngine稼働が起動遷移として記録されている。Engine開始の完全重複二行は一つの論理イベントとして扱う。既記録bridge Created14:57:18.056939622はその時刻窓内にある | 起動発行者、元requestとのexact相関、HTTP／createとの因果、bridgeの今回要求への所属は未確定。Fileの更新metadataと本文時刻が一致しないため、完全な当時性・provenanceの証明ではなく、ログ成果物内の記録に限定する |

Source上の認証確認createも、先の限定比較と同じ通常Docker `create`である。主な未確認差は実Provider Homeのbind元、認証確認用argv／構成、同時に動く保存・HTTP・取消および当時のEngine状態である。argvはcreateではProviderを実行しないが、実Home条件を空Homeの成功から確認済みとはしない。Image・Process方式の別経路が必要だという根拠も得ていない。

現時点ではSourceの是正、Timeout延長、HTTP再送、接続Policy変更、新しいRecoveryや起動管理を正当化する根拠が足りない。一次HTTP故障と、その後の取消・結果不明・既知の参照搬送欠落を区別する。今回の短命入口二件は全撤去して不存在確認し、loopback Serverと合成子Processも終了確認した。保持Claude stateはUTC `2026-10-24T14:57:55.4549934Z`・10,235 bytesのまま不変更である。元のECONNRESETと実create結果は未確定を維持する。

本節と現在地の限定最終独立レビューは全重大度の残指摘零。HTTP比較の実行権限差、取消形の同型と元因果、ログ内時刻相関と完全な当時性を区別することを確認した。次の実Home Mount比較は別の承認確認として提示し、この結果には含めない。

<a id="claude-real-home-create-comparison"></a>

### 実Claude Homeを指定した停止Container比較 — 2026-10-25（日本時間）

利用者は、実Claude認証Homeの読取り専用Mountを指定した停止Container一件の作成・構成確認・今回資源の回収を明示承認した。変更分類は実行環境の限定診断であり、製品Source・保存形式・認可・回収条件を変更しない。実行前に既存Process起動・終了、固定Image、Host Path境界、Mount表示の照合、結果不明時の保全とexact ID回収を読取り専用の独立確認へ渡し、指摘解消後に限定Passを得た。準拠・リリース判断は対象外とする。

試験のHome bind元は `C:\Users\nakas\AppData\Local\Qual-Lab\CRDD\ProviderHomes\claude`。realpath・Directory型・非Link・dev／inoだけを読み、File本文・Directory内一覧はprobeで読まなかった。Docker ClientのHOME／CONFIGは、これとは別のRepository-localな新品試験領域内の空Directoryにした。対象Homeへ変更・削除要求を発行せず、Container start・認証確認・AI・通信・Image取得・Docker起動／再起動・修復は行っていない。

固定Claude Image `sha256:ddd766072db6e69f55efb11fc3e82b401542cb5583c179f56aac4004f4ea317a`、CRDD所有Process、絶対CLI、固定Engine pipe、pull=never、network none、read-only root、cap drop ALL、no-new-privileges、pids32、user65534を使った。Home一件を`/provider-home`へreadonly／rprivateで指定し、起動しない合成argvのままcreateだけを実行した。認証Homeの内容をProviderへ読ませていない。

| 観測 | 結果 |
|---|---|
| 作成 | 一回、474ms、終了0、stdout 65 bytes・stderr 0 bytes。Process開始・応答・close確認 |
| 実ID | `6155b773cab90b5e840ec7ef16bed377f07e01fd546d82a2ae5b2496894d5e84` |
| 対象 | name `crdd-claude-home-comparison-001bcdde30025328`、label `crdd.real-home-comparison=001bcdde30025328` |
| 構成 | 実ID・name・Image・label一致、created・非稼働・pid0、制限flagsとHOME一件一致。HostConfigはWindows元Path・一Mount・readonly・rprivateを照合。ContainerのMounts表示も一件・bind・宛先・RW false・rprivateを照合し、SourceはWindows exactまたは既知固定Desktop VM正規化表記だけを受理した |
| Container回収 | 削除直前に同じ構成を再確認し、元実IDで非force削除。ID／name／label一覧は空で、既存Container一覧は前後一致 |
| Home | 前後のDirectory所在・dev／ino一致。probeによる本文読取り・変更要求なし。File内容の同一性、Container内からの実読取り、認証有効性は証明していない |

現在の固定Image・実Home指定でも、create失敗は再現しなかった。DockerのMount表示は作成構成の確認であり、Container起動後の実アクセスや認証成功には読み替えない。元のCLI非0終了とHTTP ECONNRESETの因果は未特定である。今回の成功から過去の作成結果unknownを成功へ変更せず、保持中の試験・回復参照は変更しない。Timeout延長・再送・新しい起動／Recovery機構は追加しない。

上記summary固定後、試験Root `C:\project\CRDD\.crdd\tests\claude-real-home-create-20261025`のresolved絶対Path、期待四entry、ReparsePointなし、空Client Homeを再確認した。Container回収・Process終了確認後、このRootだけを削除し不存在を確認した。短命入口も撤去して不存在を確認した。認証Homeは清掃対象に含めていない。保持Claude stateはUTC `2026-10-24T14:57:55.4549934Z`・10,235 bytesのまま不変更である。

本節と現在地の限定最終独立レビューは全重大度の残指摘零。Mountの要求値とContainer表示、Directory実体とFile内容、今回資源の回収と元試験の回収を区別した限定結果として確認した。

<a id="http-real-task-storage-diagnosis"></a>

### 実Task保存を含む合成HTTP受付の切分け — 2026-10-25（日本時間）

継続指示に基づく原因調査として、実Workbench HTTPと既存検証Client、実Coordinator Task受付・Writer・Native排他を新品の合成Repositoryへ接続し、実行部分だけを合成処理へ置き換えた。外部AI・Docker要求・認証Home・保持Claude試験は使わず、製品Source、期限、安全条件、保存形式を変更していない。実行前の独立確認でclose失敗の固定診断とclose後再読を補った。これは検証用入口の補正であり、製品機構の追加ではない。

| 実行・観測 | 結果と限界 |
|---|---|
| 初回fixture | 表示用公式ロゴ不足によりServer開始前に停止。実行呼出し0、close確認。既存ロゴ一Fileだけを合成Rootへ補い、製品処理は変えなかった |
| 実保存付き比較 | 修正版と診断追加後の計三runは、いずれも通常依頼のstart観測で停止。合成executeとrunning保存まで到達し、finallyで合成処理をreleaseしてjoin・closeした。取消HTTP Caseへは未到達であり、通常完了のHTTP往復・取消試験成功とは表示しない |
| 最終runの要求別診断 | GET二回は200・544ms／475ms、start POSTはheaders未受信・16,216msで失敗、その後の読取りGETは200・549ms。start失敗はrequest観測あり、`headers_unobserved`・`timedOut true`・transportCode null。method・固定route・所要時間・statusだけを補足し、Token・form・応答本文・生例外は保存していない |
| Source照合 | HTTP Handlerは`aiRequests.start()`返却後に303を送る。startはenqueue後、即時async処理内でLease取得・starting保存・executeへ進み、合成executeの`operationCreated`／`started`も既存の同期保存を行う。この保存付き受付順序は、今回のPOST期限超過と整合する。個々の保存・Native操作の費用までは測定していない |
| 終了後状態 | 四Rootを個別再読し、operations／unresolvedRecoveries／pendingDeliveries／leaseIntentsは各0。ロゴ不足RootのQueueは0、残り三Rootは各1件settled・Owner世代null・cleanup true・回復参照なし。後者には合成のhistoryPending各1件が残るため、履歴配送完了やState全消去とは扱わない。試験Process不存在も確認した |

今回再現したのは現在の合成条件での**start POST期限超過**である。保持Claude試験はobserve段階の`ECONNRESET`・`timedOut false`であり、失敗段階も分類も異なる。元のHTTP切断／create結果unknownの原因を確定したことにはしない。Timeout延長、HTTP再送、保存保証の緩和、新しいWorker／Recovery機構は実装しない。次の是正判断には、受付前に必要な保存と受付後の開始準備を分けられるか、同じTask・取消・失敗時保存の契約を維持できるかを先に確認する。

清掃対象は自己生成の`C:\project\CRDD\.crdd\tests\http-task-save-o1os3d`、`http-task-save-yYtLux`、`http-task-save-DSftBn`、`http-task-save-tDDAG8`の四Rootだけとする。各Rootのresolved所在、期待する合成File／Git／設定、全子孫のReparsePoint不存在、close・joinと上記State、実行Process不存在を確認済み。保持Claude試験は清掃対象外で、state metadataはUTC `2026-10-24T14:57:55.4549934Z`・10,235 bytesのままである。

上記summary固定後に同じ四Rootの条件を直前再確認し、各Rootを削除して不存在を確認した。一時診断入口も撤去した。失敗記録は本節の要約で維持し、履歴配送成功や元試験の回収へ読み替えない。

本節と現在地の限定最終独立レビューは残指摘零。Client観測の失敗時間とServer完了時間、今回の期限超過と元ECONNRESET、合成処理の終了と未成立のHTTP試験を区別することを確認した。文書差分検査は成功し、製品回帰の追加成功は主張しない。

### 受付と開始準備の費用・順序調査 — 2026-10-25（日本時間）

「調べて」の指示に対し、製品Sourceを変更せず、既存Task Ownerと実Writerの一回の合成計測を行った。HTTP・外部AI・Docker・認証情報は使わない。前回の合成executeは本番より早くoperation／running保存を行う。本番はContext読取り後のWebCrypto Hash待機で一度suspendするため、今回の合成executeだけでcallback保存前に一度`setImmediate`を待ち、その影響を分けた。本番のContext読取り費用、同じmicrotask配置、HTTP往復又は応答期限内の成立を再現したものではない。

| 計測境界 | 結果 |
|---|---|
| 初期化／単独読取り | 1,398ms／170ms。受付開始より前の別計測 |
| 受付開始→execute入場／start返却 | 9,789ms／9,790ms。enqueue、実Lease取得、starting保存等が返却前に実行される |
| yield後のoperation保存／running保存 | 各2,391ms／2,360ms。受付からの完了時点は12,184ms／14,544ms |
| Task終端 | 受付から24,256ms。実行部分は合成であり、Provider所要時間ではない |
| 順序 | execute入場→start返却→execute再開→operation保存→running保存→終端、の全順序をassertで確認 |

この計測runは最終状態検査で停止した。原因は計測器が業務投影`readCoordinatorSnapshot.value`に技術区画の`operations`等もあると誤認したことで、製品のTask失敗とは異なる。元runのblockedは変更せず、同じRootを新規実行せず追読した。公式Task Readerと同revisionの単一state本文を照合し、Task completed／settled・cleanup true・Owner世代null、operations／unresolvedRecoveries／pendingDeliveries／leaseIntents各0、historyPending一件、二回のTask読取り一致と本文前後不変を確認した。履歴配送成功やHTTP取消成立へ読み替えない。

Source上の遅延境界は、`task/requests.ts`のstartが受付保存後に即時async処理を起動し、その最初の実suspendまでLease取得・starting保存を同期実行することにある。`server/routes/ai.ts`はstart返却後に303を送る。各保存は既存Owner下で読取り・検証・保存・読戻し・排他解放を行い、Windows排他にはWorker取得／解放の同期待機も含まれる。ただし今回の計測は各Task境界の合計であり、Native、Lock、Hash、File I/Oそれぞれの寄与率は未測定である。

先行調査の最小是正候補は、**受付記録の保存成功までは待ち、同じTaskの`item.pending`に保持した開始準備へ入る前に一度イベントループへ戻す**ことである。新しいWorker、Queue、State、Lock、Registryは作らず、同じID、取消Signal、pendingのjoin、保存失敗時の保全を維持する。`Promise.resolve`だけのmicrotask化やTimeout延長を代替とせず、修正する場合は既存の実HTTP／実保存による通常完了と受付直後取消、close・Lease解放、保存失敗を確認する。後続の同期処理がHTTPへ及ぼす影響もこの確認で反証する。先行調査時点では調査のみで、製品修正は行っていなかった。元observeのECONNRESET／期限超過なしを説明できたとはしない。

独立確認では、受付保存後・Lease取得前のOwner喪失窓が広がるため、是正前に五条件を固定することを求めた。受付返却が実行／操作保存／runningより先となる正例、yield中の即時cancel、同じpendingをjoinするclose、受付後のLease取得／starting保存失敗、受付直後のfresh再入場で本文を再送しない停止・終了である。取消後に単にreturnしてacceptedを残さず、既存の終端保存経路へ接続する。先行調査時点ではこれらは未検証であり、候補を実装済み・安全性成立とは表示しなかった。

今回の物理試験物は `C:\project\CRDD\.crdd\tests\intake-timing-147opU` 一件だけである。保持Claude試験は読取り・変更・削除の対象に含めない。

結果固定後、このexact Rootのresolved所在・期待四entry・全子孫のReparsePoint不存在、試験Process不存在、終端Queueと技術区画0を直前再確認し、このRootだけを削除して不存在を確認した。一時計測・追読入口二件も撤去した。先行調査時点の製品Sourceは不変更であり、その独立確認は測定の解釈と是正候補の検証条件に限定した。

<a id="task-acceptance-candidate-verification"></a>

### 受付分離候補の実装と検証 — 2026-10-25（継続中）

利用者は受付と実行開始の分離を正式な設計原則として採用し、既存Owner・耐久保存・取消・joinを維持する最小実装と検証を指示した。変更分類はTask lifecycleの非自明な実装・設計変更である。Task ArchitectureとQA-000003へ原則と反証を接続し、Source・限定文書・直接Consumerの独立確認を選択する。準拠基準・Release判断は変更せず、全体準拠／Release監査は対象外とする。初回編集前に同じOwner／pendingの所有、accepted後の取消・close・保存失敗・fresh再入場を照合した。新しいState、Worker、Queue、Lock、Recovery Framework、Timeout変更はない。

Source候補は受付保存・Map登録・取消監視設定後、同じ`item.pending`の先頭でSignalなしの`setImmediate()`を一度待つ四行である。待機後の早期returnは追加せず、開始前取消も既存の終端保存とLease解放へ通す。Browserの303形式と現行API・保存Schemaは変えない。候補は現在未採用であり、完成や元故障解消とは表示しない。

静的検査はCoordinator／Workbenchとも成功。有限の保存故障注入一件（enqueue／Lease／startingの三条件）は成功し、受付前はIDなし拒否、受付後は同IDのblocked／unknownと元保存回復参照を確認した。実Writer・別Process再入場を含む単発Suite三件と初回回復参照搬送一件、計四件は成功した。実受付後・Lease前に子Processを終了し、fresh Ownerから同じaccepted IDを観測・未開始終了し、execute0・Lease意図0を確認した。

同Processの実HTTP／実保存試験は最初のstartで停止した。requestIdは観測できたがheaders未受信・timedOut true・transportCode nullで、試験全体32,164ms。cleanup hookで技術区画0・Queue終端・Lease解放を確認して自己生成Rootを回収した。このCaseで通常HTTP完了・取消・切断まで成功したとはしない。単一yieldで同Process検証Toolの15秒境界も成立するという期待は反証された。製品Sourceをさらに変更せず、試験Clientだけ別Processへ分離したloopback対照を一回行った。これは試験側の原因分離であり、製品へのWorker追加ではない。

別Process対照は一件成功した。固定15秒期限のまま、通常開始POSTは2,847ms、二回目の開始POSTは2,759ms、明示取消POSTは10,115msで各303だった。Taskの通常完了・明示取消とcleanup、受付直後にClient接続を破棄して応答を失った三件目のTask継続、同じIDのrunning→completed再観測、取消Signal非発火、start三回・execute三回・join三回を確認した。技術区画0、三Queue終端とLease意図0を確認して自己生成Rootを回収した。同Process Clientのevent loop競合は有力だが、二run間の環境変動や個々の同期I/O寄与まで固定した因果証明ではない。元のobserve ECONNRESET／期限超過なしの原因は未確定のまま維持する。

関連四Suiteの回帰は十九件成功。上記の実Writer四件・有限故障注入一件・別Process HTTP一件と合わせた限定確認は計二十五件成功、一方、同Process HTTP一件の不合格を残す。成功件数で不合格を相殺せず、全体回帰・実AI・全利用側完成とは表示しない。新しい受付配送gate、Client ACK待ち、追加yield又はTimeout延長は採用しない。受付分離候補の本番Task Sourceは四行だけで、同Processで動く正式検証ToolのClient接続が未完である。次の範囲判断は、Task側の管理を増やさず検証ToolのClientだけを分離するかどうかであり、同期保存全体の非同期化を今回の最小変更へ拡張しない。

固定候補の技術・限定文書・直接Consumer伝播の独立再確認は残指摘零。ただし判定は候補内容の整合確認に限定し、採用Gateは同Process検証Toolの不合格により保留する。失敗Caseを除外・skip・期待失敗化せず保持し、Source候補と試験は未コミットである。

### 検証ToolのHTTP Client分離 — 2026-10-25

上記二十五件成功・一件不合格を受け、人間は検証ToolのHTTP Clientだけを別Processへ分離する方針を採用した。製品CoordinatorへのWorker・Queue追加ではない。耐久受付とExecutionの責務・既存HTTP API・Request ID・15秒期限・同ID取消・Primary Failure／回復参照・自動再送禁止は維持する。同Processの不合格は履歴上の反証として保持し、Tool構成の置換を元故障の解消へ読み替えない。

| 対象 | 現候補の処置 |
|---|---|
| 検証HTTP | 正式Toolの固定子`ai-verification-client.ts`が一要求だけを処理。既存の`requestBounded`を再利用し、POST／GETとWorkspaceの既存HTTP要求を搬送する。対照専用の子Fixtureは削除して正式入口へ集約 |
| 入力・出力 | loopbackの固定Route・用途限定Formだけをstdinで渡し、親環境・Provider資格・Root Capabilityは渡さない。本文は親子のmemory内搬送だけで、診断・Evidenceへ保存しない。閉形式・重複key・出力上限・exitとの相関を検査 |
| 子の終了 | 実close後だけ結果を受理。親event loopの20秒監視で元子へ終了要求一回、続く2秒でclose未確認を独立故障にする。親が同期処理中はTimerとclose callbackも遅れるため、壁時計上限とは主張しない。HTTP15秒・Reader清掃1秒は変更なし |
| 取消・回復 | POST不明後は新規POSTを再送せず一回の現在状態照会だけ。相関できた同IDを保持し、既存Ownerで一回取消・結果／回復参照を保全する。子終了未確認は同Clientの新要求を止める。Clientと既存Server／Task Ownerのclose理由は別fieldで保持 |
| 計測 | Client開始、Server受信、受付保存完了、Server finish、子のheaders／本文完了、初回GETと親close callback処理時刻を区別。新しい常駐Log・永続状態は追加しない |

独立レビューで読取りToolのclose理由上書きと本文完了時刻の不足を検出し、原因別の二field・子`completedAt`・相関反例へ是正した。kill=false後の遅延close成功／close未確認の反例も追加し、修正版の限定再レビューはMajor／Moderate／Minorとも零。静的検査はCoordinatorとWorkbenchで成功した。

修正版の実保存HTTPは一件成功し、三POSTの本文完了は2,947ms／2,875ms／11,679msで15秒内、各GETも15秒内だった。Server受信→耐久受付完了→finish、子の受信→本文完了を別に観測した。最初の二POSTでは子本文完了→親close callback処理に13,803ms／13,771msの差があり、親側の観測遅延として記録する。これだけで同Process期限超過の全原因や元ECONNRESET原因を断定しない。通常完了・明示取消・接続破棄後も同じ三件目のTaskが継続し、start／execute／join各三回、技術区画零・Queue終端・Lease意図零を確認して自己生成Rootを回収した。

通常応答・接続切断・実15秒期限を含むHTTP子試験、Process故障・pipe・出力・frame・終了欠測の有限反例、同IDの結果／回復参照保持と二重close故障の局所試験は成功。Workbenchの通常結合回帰は85件成功、Coordinatorの実保存・受付取消・fresh再入場を含む関連6 Suiteは24件成功、両Packageの静的検査も成功した。制限された実行環境では子からのloopback通信が失敗したため、その結果を製品故障と断定せず保持し、許可されたloopback／子Process実行環境で上記を確認した。独立再レビューは残指摘零である。

変更4文書の検査指摘は零。ただし参照先を展開した範囲には旧リンク312件と変更していないSymbolのQA識別子未定義1件、計313件があり、文書全体の合格とはしない。過去Evidenceは変更しない。自己生成した受付試験Rootの残存は零。外部AI・Docker要求・認証Home・保持中の試験物には触れていない。今回閉じたのは受付分離と検証Toolの通信構成・終了確認であり、同Process期限超過の原因、元ECONNRESET／Container作成unknown、実AI E2E・全体QA・Releaseは未成立のまま区別する。

<a id="pre-ai-readonly-readiness"></a>

### 実AI再開前の非AI・読取り確認 — 2026-10-25

基準`9907eb204`で、既存のHTTP子の通常／切断／15秒期限と、実保存Taskの受付・通常完了・取消・応答喪失後の同ID継続を再確認し、選択した二件は成功した。三POSTの本文完了は3,110ms／2,991ms／10,487msで、今回の合成受付Rootは終了後不存在を確認した。製品Source・API・期限・保存契約の変更はない。

保持②の旧試験Root `.crdd/tests/workspace-real-ai` は不存在。別件の保持中Claude試験Rootは維持され、stateは改訂21・10,235 bytes・最終更新UTC2026-10-24 14:57:55.4549934のままである。Taskはunknown／cleanup false、操作はsettling、認証確認createだけunknown、Owner Effect disabled／Provider not_started／外部送信・共有書込みnot_issuedを保持する。現在のexact Host参照から元のHost Root・markerを既存Readerで照合し、state docker_submission_startedとの一致を確認した。実行環境の一時Pathを使った先行読取りの失敗は、元Host領域の不存在根拠には使わない。元の状態・記録・Host領域は書き換えず、回復・削除は実行していない。

Dockerの読取りはEngine 29.8.1応答・稼働Container零、今回のexact auth名と所有LabelのContainer／Network零だった。通常WindowsのProcess照会も成功し、同じRoot名・試験名・auth名に相関する旧Processは未検出。本体Repositoryの現在状態は改訂129で、操作・未解決回復・配送待ち・Lease意図は各零だった。現在未発見を過去create終了・遅延作成不能・元回収完了へ昇格しない。Provider Homeの排他取得や認証有効性は未評価であり、次回は既存のfresh実行Gateを維持する。

現行SourceのCodex編集・Claude・Proxyの固定三Imageはexact Digestで存在し、各linux/amd64を確認した。Image取得／更新、Container作成・起動・削除、Docker起動／再起動、認証Home内容の読取り、外部AI依頼は行っていない。次の人間判断には、前回Provider本体未開始だったClaudeについて、新品合成Contextと固定質問だけを既存Subscription認証で一回読取り確認する最小案を提示する。Codexの読取り再実行やDirect／Isolated編集二試験をこの判断へ暗黙に含めず、実AI・認証のEffect前に送信範囲・回数・停止／回収条件を再承認する。

<a id="claude-readonly-confirm-result"></a>

### 承認済みClaude読取り一回の再確認結果 — 2026-10-25

利用者はClaude `opus / medium`・既存Subscription認証、新品合成Contextと固定質問だけの一回と今回資源回収を承認した。基準`927476707`のcleanな本体Sourceを変更せず、新品Root `.crdd/tests/claude-readonly-confirm-20261025/readonly`を準備した。Contextは1,095 bytes、SHA-256 `99505f13f046e4f5f0619d74d8edfc5e9cada26e6a839b532df214e810e343da`、合成Git Commitは`1890dd6c4e7525783230326adc5a65318fb9c244`。正式Toolの固定質問を使い、本体Contextや保持中Rootは入力にしない。短命入口の成功条件・安全summary検査不足を実行前レビューで是正し、非AI反例・再レビュー指摘零の後に正式Toolを一回だけ起動した。

| 観測対象 | 結果と限界 |
|---|---|
| Tool／Task | Tool native終了2、limitedProbePassed false／fullE2eVerified false。受付ID `request-d5f89d16-d6b2-4aa4-aba0-1deb5d6daf43`、Operation `OP-22519893614517117207364085943715042269`。再送零 |
| Tool側の一次故障 | observe段階の`workbench_verification_client_process_failed`。HTTP期限・transportCodeはいずれも未分類。元ECONNRESETと同じ原因とはしない |
| Task側の一次故障 | `docker_setup_start_subscription_auth_probe_attached_failed`。認証確認ContainerはIdentity確定後に不存在まで観測。続くstart／attach要求はhandle取得・応答観測あり、終了1・stdout 114 bytes／stderr 0、Receipt未記録。Docker自体の起動失敗か、内部の認証CLI非0かは断定しない |
| Provider／送信 | 技術履歴はproviderStart not_started／externalSend not_issued／sharedWrite not_issued／ownerEffect disabled。Claude推論開始や読取り回答成功には到達していない |
| 同IDの取消・終端 | 取消結果受領・close成立。Taskはblocked、技術一次故障は上記のまま、cleanupConfirmed true／recoveryIds空／secondaryFailures空。HTTP子故障で技術結果を上書きしない |
| 耐久状態 | 改訂25、Queue completed／singleTask settled・blocked／Owner世代null。操作・未解決回復・pendingDeliveries・Lease意図は各零。別のhistoryPendingは一件で、同じ受付IDのoutcome failed／cleanup confirmed／primaryFailure executionを保持する。履歴のHost cleanup confirmed／Lease releasedと現在状態を併せて確認 |
| 資源と不変 | Tool inventoryは既存資源属性・System捕捉構成同値、標準bridgeのID世代差だけを記録。今回の再起動発行や故障の因果を意味しない。freshな全状態Container一覧は開始前の既存一件だけ、稼働零、今回Host Rootは不存在。本体HEAD／Treeと合成Context／Treeは不変 |

今回のDocker履歴参照は`docker-task.29c9921916f3a63170e77179d3145c8627a2b3519d5813b7c9cf2a87d136d9aa.aeb90207d74fba9ba33eb5190aba1d7f032281432c63162cbecd79438e818d42.81b3f2a1efd383abc8960bbe426b3ded9122b0ab9cd264d52a705cb9be12eb31`。未解決義務として返された参照はなく、この値は今回の清掃済み履歴との相関用に保持する。先行保持Rootのunknown参照とは別物であり、先行Root・記録は変更していない。

実行資源の回収は確認済みだが、失敗調査と未配送履歴の保全のため、今回合成Rootと安全な結果は保持する。Task返却の未解決recoveryIds・secondaryFailuresは空だが、清掃済み履歴のDocker相関参照とhistoryPending一件は保持する。34 File・71,152 bytesの時点で、生Provider本文・認証値・114 bytesのstdout本文・stderr本文は保存していない。既定七日として2026-11-01までに、既存OwnerでhistoryPendingの配送・保持を確認したうえで再評価・清掃判断へ戻し、無期限のEvidence書庫にしない。再試行、Codex、Direct／Isolated編集、Docker再起動・修復・Image取得・既存資源削除は行わない。次は、HTTP子故障と認証確認start／attachの非0を外部AIなしで切り分ける判断へ戻す。今回の結果を実AI E2EのPassへ変更しない。

<a id="readonly-failure-diagnostics"></a>

### 読取り確認失敗の非AI切分けと最小診断 — 2026-10-25

基準`8ae4753fd`の記録と実装を照合した。認証確認はContainer作成ではなくstart／attachの非0終了で停止し、既存認証分類より前の拒否だった。HTTPの固定理由はProcess／pipe／警告／終了／frameの複数故障をまとめており、元通信切断の実証ではない。正常frame・終了0に合成stderr警告だけを追加すると同じ固定理由になることを非AIで再現したが、元実行で警告が出たとは断定しない。保存していない本文を後から復元せず、認証不成立・Docker故障・HTTP期限超過のいずれにも推定確定しない。

| 対象 | 最小是正と保持する境界 |
|---|---|
| 認証確認 | 一次失敗へ任意の認証出力三値を追加。終了0／非0の応答があり、出力上限・Signal・終了値欠測を除外した場合だけ既存AI Adapterで分類する。非0はconfirmedでも拒否し、次Commandで診断を消去する |
| 保存・利用側 | 現在状態、操作履歴、実Provider検証Toolの任意fieldと閉形式を一致させる。認証用途・段階・応答・終了値・三値の不正相関を拒否し、欠測を否定へ補完しない。保存Schema版、回復参照、清掃条件は不変更 |
| HTTP子 | 最初の固定故障段階、終了値、固定Signal分類、stderrバイト数、終了要求の有無だけを既存例外へ追加。警告拒否、15秒HTTP期限、20秒親監視・2秒終了確認、同ID取消は維持し、要求を終了確認へ昇格しない |
| 正本と検証 | Architecture二文書と既存QA-000003／QA-000006のERB-IT-021／ERB-IT-002へ接続。新しい管理状態、Registry、Lock、Recovery、常駐Logは追加しない |

Coordinatorの影響三Suiteは是正後158件すべて成功した。認証の非0三値、終了0の未認証・不明、本体開始前停止、次Commandへの非残留、警告付き正規認証の成功、状態値検査・操作履歴のJSON往復、検証Processによる診断搬送と不正反例を確認した。HTTP子の四件も成功し、通常・切断・15秒期限、警告付き終了0の拒否、閉形式診断、同ID結果・回復参照の保持を確認した。途中の検証Tool試験ではkey順序の追従不足一件を検出・是正しており、その最初の不合格を成功へ読み替えない。独立レビューは検証Tool追従・終了0分岐Oracle・QA伝播・見出し階層を是正後、残指摘零となった。

別途実行したWindows保存試験は、今回の診断追加箇所より前にある試験内の旧CLI `doctor --recover-isolation` が終了64となり、期待2と不一致で停止した。現行CLIへの試験追従は別残件として保持し、この試験やWindows保存全体を合格とはしない。今回の修正で元の実Claude故障が解消したとは主張しない。AI再送、実Docker操作、認証Home内容の読取り・変更、保持中二Rootの操作は行っていない。

Workbench通常結合回帰は86件・失敗零で完走した。両Packageの整形・型・lint・Coordinatorの二Trace検査も成功した（既存のlint情報表示はWorkbench五件／横断八十四件）。文書Checkerは変更したArchitecture／QA四文書の指摘零だが、参照展開先はbroken-anchor五件、broken-link 3,362件、未定義QA識別子一件の計3,368件で不合格。先行の狭い参照範囲313件と母集団が異なるため、差分増加数や今回新設の指摘とは扱わない。今回の限定実装・検証を全体QA、実AI E2E、原事例の原因特定やRelease可能の主張へ拡張しない。

<a id="windows-state-cli-followup"></a>

### Windows保存・再入場試験の追従 — 2026-10-25

基準`39249cdc3`で残ったWindows試験の不合格を、試験一Fileだけの変更で是正した。製品Source、保存形式、回復判定、Root照合と既存の拒否・状態不変Oracleは変更していない。

| 原因 | 試験側の最小追従 |
|---|---|
| 廃止済み`doctor --recover-isolation`が終了64 | 現行`recovery resume`へ切替。旧文法を拒否する製品条件は維持 |
| 循環importで回収代役の登録前に元回復Moduleが評価され、代役の呼出しが零 | 初期化中だけ既存Module mockで回復呼出しを拒否。Host／Probeの処置代役を登録してからguardを復元し、実CLI・実回復Owner・実ReaderとRoot Resolverへ接続 |
| 実Host完了関数を切り出す試験の`hashExecutionSelection` import漏れが安全拒否へ閉じた | 製品と同じ既存関数をimport。照合の固定値化・再実装はしない |

修正版のWindows保存・pending再入場一件は222,285msで最後まで成功し、CLI関連二Suiteの十九件も成功した。CLIの七対象・拒否例、元state bytes不変、処置代役の呼出し件数、保存・再入場の既存Oracleを維持する。整形・lint・試験型検査・diffcheckは成功し、独立レビューの残指摘は零。途中二回の不合格を合格へ変更せず、修正版の今回結果と区別する。

自己生成した`coordinator-state-*`試験領域は終了後不存在を確認した。保持中の先行Claude stateは10,235 bytes、今回Claude stateは3,576 bytesで更新時刻も不変。実Docker・認証・外部AI・保持物の操作は行っていない。今回閉じたのは試験追従の残件であり、元Claude故障原因、文書参照展開先3,368指摘、全体QA・実AI E2Eは未成立のまま維持する。

<a id="claude-readonly-auth-diagnostic-result"></a>

### 追加診断付きClaude読取り一回の結果 — 2026-10-25

利用者承認に基づき、基準`cea8c97ac15474c31cff7d74edccab4d39fcb71e`から新品合成Root `.crdd/tests/claude-readonly-diagnostic-20261025/readonly`を準備し、正式検証Toolを一回だけ実行した。Claude `opus / medium`・既存Subscriptionと固定質問、合成Context 1,095 bytesだけを入力とした。Context SHA-256は`99505f13f046e4f5f0619d74d8edfc5e9cada26e6a839b532df214e810e343da`、合成Commitは`4de5f8f78b671c92d8070838046dd25fc97c7885`。短命入口の同ID相関検査を実行前に補い、非AI反例と独立確認の残指摘零を経て発行した。製品Sourceは変更していない。

| 観測対象 | 今回の結果と限界 |
|---|---|
| 正式結果 | Tool終了2、Task blocked、`limitedProbePassed: false`／`fullE2eVerified: false`。受付ID `request-63271903-84b4-4f71-9832-be74b5b12174`、Operation `OP-238157120154329491792768084036772902122`。自動再送零 |
| 技術一次故障 | `docker_setup_start_subscription_auth_probe_attached_failed`。handle取得・応答観測あり、終了1、stdout 114 bytes／stderr 0。段階は`execution_classification`、Receipt未記録 |
| 追加診断 | `authenticationStatus: unconfirmed`。既存AI Adapterが正規の`loggedIn: false`だけに返す分類であり、認証確認CLIが未ログインを報告したことを確認。認証期限切れ、Host側の未ログイン、Container内で認証情報を利用できない理由のいずれかまでは確定しない |
| HTTP・取消 | transportFailure／Tool一次故障／failureStepはnull、timedOut false、取消要求なし。今回HTTP故障は観測していないが、先行故障の原因解消とはしない |
| 実行・終了 | 技術履歴はProvider not_started、外部送信・共有書込みnot_issued、Owner Effect disabled、Host cleanup confirmed、Lease released。Task cleanupConfirmed true、recoveryIds・secondaryFailures空、Tool closeConfirmed true |
| 耐久状態 | 改訂25。Queue completed／singleTask settled・blocked、Owner世代null。操作・未解決回復・pendingDeliveries・Lease意図は各零。historyPending一件は同じ受付IDのfailed／cleanup confirmed／primaryFailure executionを保持。Queue完了をTask成功や履歴配送済みへ読み替えない |
| 資源・不変 | Toolは既存資源属性・System構成同値、標準NetworkのID世代差だけを記録。終了後のfreshな全状態Container一覧は開始前の既存一件だけ、稼働零。再起動は発行せず、Network差の原因・発行者も断定しない。本体Commit／Tree、合成Context／Tree・選択設定は不変 |

履歴のDocker相関参照は`docker-task.29c9921916f3a63170e77179d3145c8627a2b3519d5813b7c9cf2a87d136d9aa.f57a7856fce68396f878ad4218e2b098fafc653d976c4b7a3d7d65b7094a7ff8.1cd9d56917024b33c0fb5a22c0e3f6de868bced366ff4fa18721139d50bee924`。未解決回復義務として返された値ではなく、清掃済み履歴との相関用に保持する。先行二Rootのstateはそれぞれ10,235 bytes／UTC2026-10-24T14:57:55.4549934Z、3,576 bytes／UTC2026-10-24T17:37:16.4704843Zのままで、変更していない。

今回Rootは失敗調査と未配送履歴の保全のため保持し、既定七日として2026-11-01までに既存Ownerで配送・保持を確認して清掃判断へ戻す。安全な要約とバイト数だけを残し、認証値・Provider生出力・stdout／stderr本文は保存しない。今回の一回承認は消費済み。追加AI、Codex、編集二試験、ログイン・認証変更、Docker再起動・修復・取得、既存資源削除は実行しない。次に検討できるのは認証利用経路の非AI調査であり、この結果だけから再ログインや新しい回復機構を追加しない。

<a id="claude-authentication-path-investigation"></a>

### 認証利用経路の非AI調査 — 2026-10-25

基準`c7d1c975c`で実装・既存試験と専用Homeのmetadataを照合した。今回の変更分類は原因調査と記録更新であり、製品Source・認証・保存契約は変更しない。新規設計の採用や準拠表明は行わず、実装・セキュリティ境界の照合と限定独立レビューを対象とする。外部検索へは一般的なClaude認証・設定語だけを送り、Repository内容、Path、試験ID、資格情報は送らない。

| 観点 | 確認した事実 | 未確認の境界 |
|---|---|---|
| Home配置 | PAの固定配置は選択UserのLocal AppData配下`Qual-Lab/CRDD/ProviderHomes/claude`。その直下に`.claude.json`、子`.claude`に`.credentials.json`が存在 | 名前・通常Fileのmetadataだけを読み、本文・Token・期限・Accountは読んでいない。存在を有効認証へ昇格しない |
| 共通構成 | 正式認証のstatusとTask前probeは同じ固定Imageと専用Homeを利用する構成。`HOME=/provider-home`、Home read-only、user 65534、network none、`auth status --json` | 今回は新Containerを作らず、実Mountからの読取り可否・CLI内部の保存解釈は再実測していない |
| 環境差 | 正式認証statusはAI Adapterの更新・telemetry等の抑止五環境値も注入する。Task前probeはClaudeの追加Home変数がないため空の追加環境で、共通HOMEだけをDIが設定する。両方とも`CLAUDE_CONFIG_DIR`を指定しない | この環境差が今回の`loggedIn: false`を生んだ根拠はない。差の発見だけを理由にSourceを変更しない |
| 固定Policy | Image内のmanaged settingsは`forceLoginMethod: claudeai`。Task設定は実行時のTool制限用であり、probe引数には追加されない | 固定Image内部や認証ファイルを改変せず、Account／Offeringの実成立は未確認 |
| 非AI試験 | 認証LifecycleとClaude準備の既存二Suite、計38件が成功。専用Home以外をmountしない構成、認証判定、非0拒否、取消・回収の代役境界を確認 | 模擬Processの成功を実認証・Docker実境界の成立へ換算しない |

[Claude公式認証資料](https://code.claude.com/docs/en/authentication#credential-management)ではLinuxの既定資格配置を`~/.claude/.credentials.json`とし、`CLAUDE_CONFIG_DIR`設定時だけ配置を変更する。今回の構成と観測した相対配置に明白な不一致はない。同資料はログイン期限・更新不能等も再認証要因として説明するが、参照時点の資料は固定CLI 2.1.220そのものの実測ではなく、今回の期限切れを証明しない。

現時点で製品修正を正当化する原因は未確定。次の最小比較候補は、既存の正式`auth status claude --json`を一回だけ使い、Task前probeと同じHome・Imageに対する判定を比較すること。通信なし・Home読取り専用・認証値非表示を維持し、今回作成した一Containerだけを正式Ownerで回収する。AI再送・login・更新通信・Docker再起動・Image取得・先行保持物の変更は含めない。実Homeを使うContainerの追加実行は本調査では行っておらず、実行範囲の人間確認へ戻す。正式statusも未認証なら環境差だけに原因を求めず、成功した場合だけ差の限定比較を検討する。

<a id="claude-formal-authentication-status-result"></a>

### 承認済み正式認証status一回の結果 — 2026-10-25

利用者承認に基づき、基準`baef9a500d8a7ab8a5f5614d48f0ad87aa91de54`から既存CLI `auth status claude --json`を一回だけ実行した。開始前にEngine 29.8.1、固定Claude Image `sha256:ddd766072db6e69f55efb11fc3e82b401542cb5583c179f56aac4004f4ea317a`の存在、稼働Container零を読取り確認した。新Tool、製品Source変更、AI依頼、login、通信、Image取得、Docker Engineの起動・再起動命令はない。

| 観測対象 | 結果と限界 |
|---|---|
| 正式API結果 | `status: blocked`、`reason: provider_authentication_start_probe_attached_failed`、`authenticationConfirmed: false`、`authenticationStatus: unknown`。Repository／Workspace未Mount、humanInteractive false、資格・Host Path・Provider生出力の公開なし |
| 発行範囲 | status専用の一Container作成・start／attachと正式回収。`providerEffectIssued: true`は認証用Docker操作を発行した意味であり、AI推論・外部送信を示さない |
| 終了・回収 | `cleanupConfirmed: true`、`recoveryId: null`、`manualRecoveryRequired: false`、`effectStateUnknown: false`。終了後のfreshな全状態Container一覧は開始前の既存一件`b185985108c6c901b179d0ca3214eac0ea2ef0e32de271526ddc606c6aea1764`だけ、稼働零。既存資源の削除なし |
| 比較の限界 | 正式認証Ownerは非0終了を認証出力分類より前に拒否するため、今回のCLI内部の認証三値は分からない。先行Taskの`unconfirmed`と今回の`unknown`を矛盾や認証状態変化とはしない。どちらもstart／attach後の失敗だが、同一出力・同一原因とは未確定 |

この一回承認は消費済み。再実行せず、認証Home・先行保持Root・記録を変更しない。環境抑止値を持つ正式statusも停止したため、Task前probeの環境差だけを原因とする根拠は得られなかった。次の最小是正候補は、正式認証Ownerにも先行Taskと同様の非秘密な診断分類を搬送することだが、本試験の承認だけから実装・追加試験・再ログインへ拡張しない。回収成功を認証成功・実AI E2E成功へ読み替えない。

<a id="authentication-status-negative-result-fix"></a>

### statusの正規未ログイン受理の最小是正 — 2026-10-25

利用者の是正指示に基づき、基準`50b8f4d7a`から正式認証Ownerのstatusだけを変更した。終了0／1で起動失敗・Signalがなく、既存AI Adapterが正規未ログインと判定した結果を利用する。終了1の例外受理には空stderrも要求する。既存の終了・取消・回収・保存・Lock解放がすべて成立した場合だけ、`status: completed`／`authenticationStatus: unconfirmed`／`authenticationConfirmed: false`／`reason: provider_authentication_unconfirmed`を返す。CLIは既存のcompleted判定により終了0となるが、認証済みという意味ではない。API Shape・Schema・保存形式、loginの非0拒否、Task実行許可、実行中管理・回復処理は変更しない。未ログインから期限切れを推定しない。

既存の認証Lifecycle Suiteへ十三条件を追加し、終了0／1の正規否定、他の非0・欠測、不正／重複JSON、非空stderr、Signal・起動失敗、終了不明、回収不明、取消、loginを区別した。非0の認証肯定を拒否する両Providerの既存反例も維持する。回収不明では同じexact回復参照が残り、生出力・資格値は公開しない。独立レビューで非空stderrの受理漏れを検出し、空stderrへ限定・反例追加後に再確認した。Architecture認証節と既存QA-000006／ERB-UT-016を追従した。

修正版の影響五Suite（認証、Claude準備、認証回復、CLI、Process Controller）は167件すべて成功した。型・整形・lint・diffcheckも成功。初回はRepository Root起動により既存試験のpackage CWD前提が外れ、167件中一件が`C:\.crdd`へのmkdir拒否となった。権限緩和・試験Source変更はせず、正式package CWDで全五Suiteを再実行して成功確認した。最初の不合格を成功へ書き換えない。実Docker・実認証・外部AI・保持物の操作は行わず、修正版の実status・再ログイン、全体QA・E2Eは未実施のまま維持する。

限定独立再レビューは残指摘零。四文書を指定した文書Checkerは参照先展開により旧CHGのbroken-linkと既存Symbolの未定義QA参照等を含み不合格だった。今回の167件成功を文書検査全体や全体QAの成功へ拡張しない。生ログの書庫は追加せず、この限定結果と既存の横断残件を分けて保持する。

<a id="provider-authentication-status-unification"></a>

### Codex／Claudeのstatus共通化 — 2026-10-25

利用者指示に基づき、基準`e3e236736`から両Providerの正規未ログインを既存`ProviderAuthenticationResult`の同じ三値・理由へ揃えた。Codexの`Not logged in`を未認証へ変換し、出力改行・出力先と既存の固定read-only alias警告だけの組合せをAI Adapterで検査する。Claudeの`loggedIn:false`に対する空stderr条件も同じOwnerへ移し、Coordinatorの一律空stderr条件を撤去した。未知stderr・混在出力は引き続き確認不能とする。新API、Schema、保存、Lock、回復・常駐処理は追加しない。loginの非0、Task実行許可、Process終了・取消・回収・保存・Lock解放の条件は維持する。

既存Lifecycleの十三条件を両Providerへ適用し、純粋変換は正規通知・改行・既知警告・未知stderr・重複／混在・別認証方式・NUL等の十八入力とOffering不一致を確認する。独立レビューで未認証のstdout受理根拠がないことを検出し、Codexの正規否定はstdoutが空・stderrの固定文面だけへ限定した。認証肯定の既存受理条件は変更しない。新しい試験物の書庫は作らず、旧保持物・資格本文・Docker・外部AI・実認証は操作しない。過去の失敗を成功へ変更せず、修正版の実status、期限・Tokenの有効性、全体E2E成立は未確認のまま保持する。

[公式CLI資料](https://learn.chatgpt.com/docs/developer-commands?surface=cli)は`login status`の認証情報存在時の終了0を説明する。独立確認では採用Executor版の[固定Source](https://raw.githubusercontent.com/openai/codex/ff29a44391deccde0aba0f8390337d7f3c319ea4/codex-rs/cli/src/login.rs)と助言版の[固定Source](https://raw.githubusercontent.com/openai/codex/ff6aec96948b70d94983af2641a6b67c94faeff5/codex-rs/cli/src/login.rs)を照合し、資格なし分岐のstderr `Not logged in`／exit1と、別の確認エラー分岐を確認した。このSource照合を実Image・実認証の再実測へ代用しない。今回のOpenAI Docs手順は公式資料の範囲確認に用い、API keyの取得やProviderへの試験要求には使っていない。

是正後の固定候補でCoordinator影響五Suiteは168件・失敗零で完走し、AI Adapter全24件も成功した。両Packageの型検査、変更三Sourceの整形・lint、diffcheckは成功。独立レビューのSource指摘は是正済みで、結果確定前の表示指摘も是正後候補の終端結果と照合した。前節の文書Checker横断残件は今回再実行・解消しておらず、全体QAや実認証E2EのPassとはしない。

<a id="claude-readonly-after-reauth-result"></a>

### 再認証後の同条件Claude読取り一回 — 2026-10-25

利用者の依頼により正式`auth login claude`を外部対話端末で行い、完了後の正式statusは`completed / confirmed / authenticationConfirmed:true / cleanupConfirmed:true`だった。login記録のsettled／idleをstatus前に確認し、記録された三Container・二Networkの実IDはfresh一覧に不存在、status用Containerも終了後不存在を確認した。既存停止Container一件は維持し、AI依頼・再起動・秘密値の取得はこの認証確認へ含めない。

続く利用者承認に基づき、基準`ae6f206016d58446171ac81aafca0b406a6dce7a`から新品 `.crdd/tests/claude-readonly-reauth-20261025/readonly`を準備した。旧短命入口との差はRootと基準Commitだけで、実行前独立確認の残指摘零。合成Contextは前回と同じ1,095 bytes、SHA-256 `99505f13f046e4f5f0619d74d8edfc5e9cada26e6a839b532df214e810e343da`、選択設定Hash `67a183f123d63236e08641724274347ce1ce5d61156d62fdb3a08cb1e3bfaf40`。合成Commitは`d91c59e59417220384d1663c57a3db24997a905c`。Claude opus／medium、同じ正式Tool・固定質問を一回だけ発行した。

| 観測対象 | 今回の結果と限界 |
|---|---|
| 正式結果 | Tool native終了2、Task blocked／`workbench_ai_claude_turn_count_invalid`。受付ID `request-bd0f12d4-d162-461a-92ab-5efb6062c4ed`、Operation `OP-215556412717598397064112506976425970712`。limitedProbePassed／fullE2eVerifiedはfalse |
| 一次故障 | `start_provider_attached`のhandle取得・応答観測あり。終了0、stdout 6,010 bytes／stderr 0。正規化段階`provider_result_normalization`で停止し、認証確認失敗やContainer作成unknownではない |
| 拒否条件の照合 | AI Adapterの`extractClaude`は成功Envelopeを確認後、`num_turns`が欠測・非整数・1未満・2超のいずれかなら同理由を返す。起動Planも`--max-turns 2`。実値は保存しておらず、今回どの条件か、CLIの数え方との不一致かは未確定。二ターン超過だったとは断定しない |
| HTTP・取消 | Tool一次故障・transportFailure・failureStepはnull、timedOut false、取消要求なし。closeConfirmed true。先行HTTP故障の原因解明とはしない |
| 回収・耐久状態 | Task cleanupConfirmed true、recoveryIds・secondaryFailures空。現在改訂35、操作・未解決回復・pendingDeliveriesは零。Queue completed／singleTask settled・blocked。historyPending一件は保全。履歴のHost cleanup confirmed／Lease releasedと一時Host候補の不存在を確認 |
| 事実の粒度 | 履歴のproviderStart／externalSend／sharedWriteはunknownのままであり、結果拒否後に肯定値へ書き換えない。CLI応答・成功Envelope・終了0の観測と、記録の開始fact不明を分ける |
| 資源・入力不変 | freshな全状態Container一覧は開始前の既存一件だけ、稼働零。Network一覧もbridge／host／none／既存jarvis_defaultだけ。Toolは既存資源属性・System構成同値と標準bridge世代差を記録したが、再起動命令は発行しておらず原因・発行者を推定しない。本体HEAD／Tree、合成Context／Tree・選択設定は不変 |

今回の履歴相関参照は`docker-task.29c9921916f3a63170e77179d3145c8627a2b3519d5813b7c9cf2a87d136d9aa.082d8138c9a34e3d8a8441d4dfc60b911e95c18bf81ff1cd35337c1903e81b26.999b17ad517e6205a5821c0e3a7a9256b7b317532b0b8be5cb5be06c34773861`。清掃済み履歴の相関用であり、返却された未解決義務ではない。先行三Rootのstateは10,235／3,576／3,577 bytesと各更新時刻が不変。今回Rootは失敗調査と未配送履歴一件の保全のため2026-11-01までの既定七日を再評価期限として保持し、既存Ownerによる配送・保持確認後に清掃判断へ戻す。回収済み実行資源と保持中の試験記録を区別する。

失敗後の再試行・上限変更・認証変更・Docker再起動・Image取得・既存資源削除は行わない。既存の助言抽出→Controller→固定理由・cleanup搬送の合成一件は成功し、同理由が欠測でも発生することを確認した。生Provider出力・資格値・回答本文は保存しない。今回完了したのは承認一回の発行、失敗分類、実行資源回収と原因境界の照合であり、読取り試験成功・全体E2E成功ではない。

結果・履歴・現在状態の安全fieldと二文書を照合した限定独立レビューは残指摘零。文書diffcheckも成功した。

<a id="workspace-edit-preflight-timeout-result"></a>

### 実AI編集前の非AI事前確認停止と今回資源の回収 — 2026-10-25

利用者はDirect→Isolated各一Task、Codex gpt-5.5／medium編集・Claude opus／highレビュー、通常四・既存の一回是正を含む最大八起動、合成内容だけの送信、今回試験物の回収を承認した。Sourceは`e460a8d09c3706e453099817e1cb0c38aeb34c26`・cleanに固定し、実AI前の正式`verify-workspace-ai.ts --preflight`を一回行った。既存Root `.crdd/tests/workspace-real-ai`は開始前不存在で、新品として作成した。製品Sourceは変更しない。独立確認によりSource観測だけではGit HEAD／文書を含むcleanを証明しない点を追加Gateとし、文書転記は実行終了後へ延期した。実AI前の事前確認が不合格だったため、`--external-send-confirmed`は発行しない。

| 観測対象 | 結果・限界 |
|---|---|
| Engine／Image事前読取り | Engine 29.8.1、稼働Container零、既存停止Container `b185985108c6c901b179d0ca3214eac0ea2ef0e32de271526ddc606c6aea1764`のみ。固定Codex編集／Claude／Proxyの三Imageは現行Digest・linux/amd64に一致。取得・更新・Docker起動／再起動なし |
| 非AI事前確認 | Tool native終了2、preflightOnly true、fullE2eVerified false、sourceUnchanged true。DirectはlimitedProbePassed true、10bytesのDIRECT_OK改行・Hash一致、Dirty／Stage／未追跡保全、close/runtime/workspace cleanを確認。Direct合成Base `d4572aa26b5e04817ca16926d9286f5ffeb214d2` |
| Isolated失敗 | prepare段階の`workbench_verification_transport_failed`、headers_unobserved／timedOut true／transportCode null。HTTP子の要求期限は既存15秒。closeConfirmed true、runtimeClean／workspaceCleanはfalseで、試験器はfixtureを削除しなかった。AI0の事前確認でも失敗し、Provider認証・AI実行・Docker作成の失敗とはしない |
| 作成成立の照合 | 状態改訂10にWorkspace `f8c58e95-fc05-41c2-8746-6ddead129007`が一件、generation2／ready、candidate／pending／holdUntil null。Base／HEAD `3d4fa528d118e83161c17ad2c4d7de490753f992`、同UUIDのworktree登録・専用branch・directoryあり、dirty／locked／prunable false。作成は成立しHTTP応答を受領できなかった区間に絞れるが、遅延の根本原因・受信／応答各時点は未計測であり断定しない |
| 実行Effect | preflightはAI start分岐へ入らず外部AI起動0・送信0。Docker観測のadded／removed Container・Networkはすべて空、既存資源・System構成は同値。provider_cleanup_unconfirmedは試験器の一般分類であり、実AI／Docker資源残存の証明ではない |
| 既存API回収 | 直前にRoot／Manifest・同Project／queue-a／UUID・generation・HEAD・非使用状態・CleanなGit観測を再確認。既存`executeWorkspace`のdiscardを一回だけ、discardChanges falseで発行。completed／workspace null、manualRecoveryRequired false、recoveryId・release／adoption解放失敗はnull |
| 回収後 | 状態改訂17、workspaces／operations／unresolvedRecoveries／pendingDeliveries／leaseIntents零、queue-a cancelled・workspace参照null、未使用合成queue-b queued。fresh Git登録は合成主Treeだけ、専用branchとworktree directoryの不存在を個別確認。回収APIは再発行していない |
| 残る記録 | 短命回収入口は回収後historyPendingも零としたOracleで停止したが、実際は終了要約が一件生成されていた。これを回収APIの失敗やWorktree残存へ読み替えない。既存maintainCoordinatorSnapshotの一回呼出しはorchestrator_snapshot_lock_unavailableでblocked、状態改訂17・履歴待ち一件を保持。細因未確定、再試行・手動書換え・Lock解除はしない |

補助の非AI HTTP Suiteは制限環境で14件中12成功・2失敗（HTTP搬送）だった。loopbackを許可した通常Windows実行では同14件すべて成功し、前の不合格は履歴として保持する。この条件差で正式preflightのTimeout原因を確定せず、補助Suite成功を事前確認・編集E2E成功へ流用しない。

今回の実AI編集E2Eは未実施であり、事前確認・AI依頼の再試行も行わない。回収処置による製品Source変更はなく、本体HEADは`e460a8d09c3706e453099817e1cb0c38aeb34c26`のままである。短命入口は履歴assertで停止し、予定したpost-Source観測には到達していない。停止後の独立読取りで、文書更新前のworking tree cleanを確認したが、これはToolによるpost-cleanup Source一致又は回収処置全体の完了証明ではない。この結果記録時点の変更は二文書だけである。旧保持物、既存Docker資源、認証領域は不変更。今回のWorktree／専用Branchは回収済みだが、合成Rootと安全な結果は終了要約確定・失敗調査のため2026-11-01まで保全し、既存Ownerで履歴確定・非使用を確認して清掃判断へ戻す。新しいQueue・Lock・回復機構、Timeout延長は追加しない。次の最小調査は、非AIのWorkspace create境界で受付・Git／状態確定・HTTP応答送信のどこが遅延したかを既存診断で分離できるかの確認であり、実AI再送やDocker再起動を含めない。

<a id="repository-capability-and-model-baseline"></a>

### Repository設定の現行名称と次のModel基準（2026-10-25）

Repository Manifestの既存Capability宣言だけを現行Ownerへ追従する。`orchestrator`は統合先の`coordinator`へ重複を除いて集約し、`mcp`は`mcp-server`、`runtime-data`は`domain-model`とする。Capability宣言はPackage全件の一覧でも操作許可でもなく、未宣言Packageを一括追加しない。Repository／Project ID・外部送信Policyは不変更。

人間が指定した次のModel基準は、Codex `gpt-6.1-sol`／medium、Claude `claude-opus-5-5`／mediumである。公式の識別子は[OpenAI公式Model文書](https://developers.openai.com/api/docs/models/gpt-6.1-sol)と[Anthropic公式Model文書](https://platform.claude.com/docs/en/models/opus-5-5/overview)で照合した。これを固定CLIでの動作確認又は外部送信承認とは扱わない。

以下はImage更新承認前の調査記録である。当時は本体Repositoryの`.crdd/config/ai-selection.json`が未作成で、技術Catalogに上記二識別子がなく、Codex編集計画に`gpt-5.5`固定条件が残っていた。旧条件の送信承認は新Modelへ流用せず、更新後の現在結果は[Image更新結果](#provider-image-update-20261025)を参照する。

#### 固定CLIの互換性照合と更新判断待ち

今回の経路は、非秘密のRepository設定と管理対象CLI依存の変更である。編集前に、AI Adapterの技術Catalog／Provider計画、Coordinatorの選択検査・保存、Docker Isolationの固定資産を照合した。外部AI、認証、Docker資源、保存済み選定・保持物のlifecycleは変更しない。Source変更前の確認に留め、準拠基準・リリース判断を変更しないため全体準拠監査は行わず、調査結果の限定独立レビューを行う。Image更新は人間判断まで停止する。

| 経路 | 現行の固定CLI | 確認結果 | 最小の次処置 |
|---|---|---|---|
| Codex助言 | 0.159.2 | Modelは既存`--model`と推論強度引数へ渡せる。現行の公式CLI資料はGPT-6.1 Solの指定を案内するが、当該固定Image・アカウントでの実応答は未確認 | 新ModelのCatalog登録と既存助言計画の非AI試験。助言Imageを更新する必要性は現時点で未立証 |
| Codex編集・レビュー | 0.149.1 | CRDD計画がgpt-5.5固定で、選定Modelとの不一致を拒否する。TaskではCode Mode／Hostを無効にしており、助言用0.159.2 Imageへの単純な差替えが同じ保証で成立するとは未確認 | 固定CLIの更新候補と既存CLI引数・結果Protocol・隔離の整合を確認し、必要なTask Imageを更新する。固定条件だけを外して対応済みにはしない |
| Claude全用途 | 2.1.220 | [公式Model設定](https://code.claude.com/docs/en/model-config)がOpus 5.5に2.1.280以降を要求するため、現行Imageは要求版未達。現在の`opus` aliasをOpus 5.5の固定選択とは扱えない | 2.1.280以降の具体版を固定し、既存Build入口でCLI Imageを更新する必要がある |

Codexの[公式CLI資料](https://learn.chatgpt.com/docs/cli/reference)は現行Modelの指定方法を示すが、旧0.149.1の最低対応版や固定Imageでの実行成功を証明するものではない。Claudeは公式最低版と現行の固定資産値の比較による不一致であり、AI再送を原因確認に使わない。

Image更新を含む前進には、公式配布物の取得・既存Buildでの新Digest作成・固定資産の切替が必要になる。新Registry、互換fallback、独自CLIは作らない。旧Imageは削除せず、新Imageの版・引数・構造化結果・隔離条件を認証情報／外部AIなしで確認した後、Catalog・Provider計画・Repository選択設定を同じ変更で整合させる。実AIでのModel利用可否・認証・結果の確認は別承認とし、今回の依頼から自動送信しない。

<a id="provider-image-update-20261025"></a>

#### 最新公式CLIへのImage更新と設定の結果 — 2026-10-25

利用者の「Codex、Claudeとも最新版にImage変更する」承認を受け、公式配布物の取得・Build・非AI検証までを実施した。基準HEADは`e460a8d09c3706e453099817e1cb0c38aeb34c26`。AI送信・認証情報の使用・Docker再起動／修復・既存資源削除は対象外とした。変更経路は管理対象依存と実行計画・非秘密設定の更新で、Architecture・QA・直接Consumerを照合し、限定独立レビューを実施した。準拠基準・公開・Releaseの変更や全体準拠監査は行わない。

| 用途 | 公式CLI版 | 固定した新Image Digest |
|---|---|---|
| Codex Task | 0.164.0 | `sha256:832019e696c493a5393032b9020cf9898d29b23381634fddcc808ae6832aa4a4` |
| Codex助言 | 0.164.0 | `sha256:112a73d8576b6aa3e04db76b5fee98a0f5636f5ca539ef039aa555ccd9b76de3` |
| Claude全用途 | 2.1.310 | `sha256:612433b71c4af3dfb135c00daad64f0ef897f86e0251b4da558715fdfde9c51f` |

Codexの[公式Release](https://github.com/openai/codex/releases/tag/rust-v0.164.0)は安定版で、Tagの対象Commitは`6aaac694803004a63c6f393d153c96d22521a6b9`。ArchiveのRelease Digestと展開したCLI／Code Mode Host／bwrapのSigstoreを照合した。初回はtarballをbinary用Bundleへ渡して不一致になったが、対象の誤りを訂正し、各binaryの検証は三件とも成功した。Claudeは[公式Manifest](https://downloads.claude.ai/claude-code-releases/2.1.310/manifest.json)と取得binaryのHash・容量を照合した。Build入力の正本はDocker Isolationの`images/build-inputs.json`とし、Codex二用途で同じ公式binary情報を重複保持しない。

[Codex固定TagのModel定義](https://github.com/openai/codex/blob/rust-v0.164.0/codex-rs/models-manager/models.json)に従い、`gpt-6.1-sol`はCode Modeと公式Hostを有効にする。選定されたModel・種別・Effort・用途の一致を検査し、旧Modelへの置換はしない。新ModelをCodex Reviewerに使う場合はTool制限の実証が未了のため`codex_task_reviewer_code_mode_not_verified`で停止する。通常の独立Reviewerは指定どおりClaudeである。既存gpt-5.6のTask非対応理由はHost不存在ではなく、現RuntimeでTask未検証へ訂正し、用途を拡張しない。

Build入口は`prepare-codex-image.ts`へ統合し、用途を`task`／`advice`から明示選択する。共通の三binaryと用途別Recipeを検証し、Taskだけ三Schemaを追加する。安定Symbol IDは旧値を維持し、Pathだけ追従した。旧Image・過去Evidence・保存済みの選定・保持中のE2E Rootは変更しない。

| 検証対象 | 観測結果・限界 |
|---|---|
| 版・構成 | 新ImageのCLI版・help・既存引数を認証なしで確認。Claude exact Model／mediumは引数拒否でなく認証要求まで到達した。認証・Model応答の成功ではない |
| Codex構成 | 新Task計画は構成読取りを通過した。認証なし・Network noneのため接続不能となり、局所期限で終了・回収した。接続の試行自体がなかったとは主張しない |
| Tool制限 | 新版ではunified_exec=false指定でも機能一覧がtrueとなる。固定SourceのShellTool gateと助言のshell_tool=falseを照合した。機能一覧のfalseやHost helpからTool実行不能を推定しない |
| 実合成隔離 | 新Task Imageで通常作業領域に書込みでき、合成Provider Homeの読取り・書込みは拒否され内容は不変。非root・読取り専用Root・Network none・終了値0を観測。Hostはhelp起動・終了だけを確認し、RPC／実Tool動作は未確認 |
| 失敗後処理 | create前失敗はRootを確認後清掃。create／inspect不明は未検証IDや名前で削除せず、専用Rootと理由を7日保持する。四故障枝を非Docker試験で反証し、実試験はexact ID回収・不存在確認後にRootを清掃した |
| 回帰 | AI Adapter全25件、Docker Isolation通常300件成功・明示5件skip、Coordinator影響七Suite197件、追加の選定・Build等五Suite27件が成功。重複母集団は加算しない。新Sandbox二件、Domain保存Consumer四件・Version Control Consumer十二件も成功。三Packageの型検査成功 |
| 設定 | 初回不存在を確認後、承認済みRepository設定を配置し、公開Readerでavailableを確認。五役割ともexact Model／medium、同じ設定Identity `b8ed7743b00b844e71040bbd3694660ee1b47cadf826334d80fb57ed82c51093`、Catalog Identity `5e1d3387ad7fcfe61a6f2521291c2ed118fe0091f9db2aea63e1cd7aa067ed2c`を読戻した。既存設定保存APIの成功実測とは区別する |

新たなRegistry・Lock・Recovery機構は追加していない。今回のContainerは回収済みで、既存停止Container `b185985108c6c901b179d0ca3214eac0ea2ef0e32de271526ddc606c6aea1764`は保持した。今回の結果は新Image・引数・合成隔離・純粋選定の限定成立であり、新Modelの実AI応答、Host RPC、Direct／Isolated編集E2E、全体QAまたはRelease成立ではない。次の実AI確認には新Model・送信内容・回数の承認が必要である。

設定・実装・QA・結果文書の限定最終レビューは残指摘零。変更Source／JSONの整形・lint、diffcheckも成功した。今回の取得・Build用Root二件（`provider-cli-update-20261025`、`codex-task-image-oU6Ner`）は、Repository-local tmp配下の実体・リンク不存在・非参照とContainerの終了後一覧を確認し、計33 Fileを清掃して両Rootの直接不存在を確認した。正式Build入力の版・Hashと新Imageは保持し、既存のE2E保持Rootには触れていない。

<a id="new-model-ai-e2e-approval-20261025"></a>

### 新Model読取りとDirect／Isolated編集E2Eの承認範囲 — 2026-10-25

利用者は、新ImageによるCodex `gpt-6.1-sol / medium`・Claude `claude-opus-5-5 / medium`の合成Context読取り各一回と、Direct→Isolated各一Taskの編集・独立レビューを承認した。通常六起動、各編集Taskの既存一回是正・再レビューを含め最大十起動とし、余り枠を失敗再試行へ使わない。送信は合成Context・固定指示・合成Sourceと差分だけで、本体Context・Source・資格値を含めない。既存Subscription認証・固定Imageを使い、再起動・修復・Image取得・再ログイン・APIキーfallbackは行わない。

新品Rootは`.crdd/tests/new-model-ai-20261025/`、非AI事前確認は`preflight/`、実編集は`edit/`、読取りはProvider別の新品合成Repositoryに限定する。旧`workspace-real-ai`等の保持物は操作しない。今回のContainer・Network・専用Branch／Worktreeと試験Fileだけを、元Identityと終了状態の確認後に回収する。不明時は同じ回復参照とRootを保持し、七日以内に再評価する。

検証Toolの旧Model指定と固定Rootだけを追従し、製品のHTTP・Task・Timeout・取消・保存・回収は変更しない。初回対象回帰の一件は新要求に対する代役応答の旧Model残りによる相関拒否であり、代役も新選定へ追従する。検査条件は緩めない。着手前照合と独立差分確認では阻害指摘なし。非AI事前確認が両方式で完全成功しない場合はAIを送信せず停止する。前回Isolated準備Timeoutの未解明を成功扱いにしない。読取り二件が完全成功した場合だけ実編集へ進み、各段階の失敗・不明では再試行せず今回試験物の安全な回収だけを行う。

この承認は合成Repository内の明示Candidate固定・二親Mergeも含むが、本体Repositoryの採用・統合・Releaseは含まない。結果は実測後に評価し、現時点では実AI確認・編集E2Eとも未実施である。

#### 新品非AI事前確認の停止結果

Tool差分の型・整形・lint・diffcheck、外部AIなしのHTTP／取消／回収十八件と独立レビュー残指摘零を確認し、Sourceを`6305826448e15247e4de2e48dc97c9a49f70379e`・cleanへ固定した。新品`new-model-ai-20261025/preflight/`で`--preflight`を一回だけ実行し、失敗したため読取り二件と実AI編集二Taskは開始していない。AI起動・送信は零、再試行はない。

| 対象 | 観測した事実・限界 |
|---|---|
| Direct | limitedProbePassed／既存Dirty・Stage・未追跡保全／runtimeClean／workspaceClean／closeConfirmedはtrue。合成出力10 bytes・SHA-256 `e1bb2575c4a773a34f573f110b27d8bfb90c31c0be7dfad40de503d29862b2de` |
| Isolated | 合成出力12 bytes・SHA-256 `81780b079048a55298de4abcdf8e407d902b760fa80cbac251efa40b3817fe6e`を確認後、`workbench_verification_transport_failed / headers_unobserved / timedOut=true`で停止。Tool段階名はprepareであり、詳細なClient時系列は記録していない |
| 成立したGit操作 | Workspace `4f55ea10-d6bf-42aa-9eb4-24d1828fd0a8`。Base `19d2d60e3767bce4b92c9a10a54a6279cc463c31`、固定Candidate `601376f758327de25eb12e1766d5eac9c5e04d86`、Merge `f7ea8af7ef289e0729f25861859c7b5a70336e0b`。Git直接観測で第1親Base・第2親Candidateを確認。状態FileのCandidateはmerged／adopted。Toolはadopt応答後のcandidateCommit／mergeCommit記録に未到達であり、Source順序とGit／状態からadopt要求のHTTP応答をToolが観測できない区間へ絞れる。応答送信済みとは推定せず、待機区間の細因・Event Loop占有等は未特定 |
| 終了 | 両OwnerのcloseConfirmedとSource再観測不変はtrue。Docker比較は追加・削除Container／Networkなし、既存一覧・構成同値。ただしWorkspace未回収のためTool全体は不合格、fixtureRootsRemoved=false。終了後fresh一覧も既存停止Container一件のみ |
| 正式回収 | 同じWorkspace ID／Commitで公開executeWorkspaceのget→close-candidate→discardを試みたが、最初のgetが`workspace_state_unavailable`で停止した。既存Readerの追加読取りは`orchestrator_snapshot_lock_unavailable`。close-candidate／discardの処置は未発行で、Worktreeと二Refは残る。原因未特定のLockを解除・削除せず、Stateを手編集しない |
| 保持 | 今回Rootは調査と正式回収の再入場用に保持し、2026-11-01までに再評価。物理Fileの改訂はDirect 4、Isolated 27だが、正式Readerがblockedのため、File内の待ち零から回収完了を推定しない。旧保持Root・既存Docker資源・本体設定は変更しない |

今回の不合格は新Modelの拒否やAI実行失敗ではなく、実AI前の合成Workspace操作・HTTP結果搬送の境界である。新モデル確認・実AI編集E2Eは未実施のまま。次の是正候補はadopt応答の15秒期限と正式ReaderのLock取得不成立の非AI切り分けであり、Timeout延長、新Worker／Queue／Lock／Recovery機構の追加、AI再送、再起動には進まない。

#### HTTP期限とLock起動方式の非AI切り分け — 2026-10-25

利用者指示に基づき、製品・検証ToolのSourceを変更せず調査した。元の保持Rootは読取りだけとし、AI再送・Docker起動／再起動・保持物削除は行っていない。今回の診断用コードはRepository-local tmp、非AI再現は別の新品`tests/http-lock-diagnosis-20261025/`に限定した。

| 対象 | 実測・原因の確度 |
|---|---|
| Lock取得失敗 | 通常File起動では同じ固定Workerの取得・解放・exit 0が成立し、元保持Rootの正式Readerも約213msでcompleted。一方、前回と同じ`node --input-type=module -e`ではWorkerが親execArgvを継承して`ERR_INPUT_TYPE_NOT_ALLOWED / exit 1 / state 0`。正式Readerは約5,040ms後にlock_unavailable。Worker起動方式の不適合を再現した。Atomics同期待機中にerror callbackを処理できないため固定理由へ畳まれる点は、起動失敗そのものと区別する。残存Lockの証拠ではない |
| HTTP期限超過 | 別新品の一回の非AI再現で、既存executeWorkspace同期区間はcreate 10,879ms、get 1,408ms、inspect 1,633ms、freeze 11,306ms、candidate-diff 655ms、adopt 18,796ms。adopt内の同期子Processは24回・計1,471msで、残りの時間内訳は未特定。adoptが検証Client固定15秒を超え、merged後のheaders_unobservedを再現した。通信障害・単独Gitコマンド遅延とは断定しない |

切り分け時点の最小是正案は、(1)診断・回収を通常File起動へ固定し、Lock機構は変更しない、(2)検証Tool内部のexact `/workspace/action` はget等を含む全操作でHTTP60秒・親65秒、AI受付・取消の `/ai-request/action` とAI状態観測を含むWorkbench viewの `/api/workbench-view?route=%2F` はHTTP15秒・親20秒を維持する、(3)既存の操作名・時刻observerで待機区間を確認する、の三点であった。任意Timeout API、新Worker、Queue、Lock、Registry、Recovery機構は作らない。60秒は有限待機上限であり他Repositoryの成功保証ではない。切り分け時点では未採用・未実装だったが、その後利用者が限定是正と非AI試験を承認した。Toolだけの是正候補で、期限超過、一回abort、子終了、late frame／close、同ID観測・再送零の局所四件と対象十八件回帰は成功した。母集団は重複するため加算しない。実loopbackでもWorkspaceの16秒応答成功と通常Routeの15秒拒否を確認した。型・変更Sourceの整形／lint・diffcheckも成功。初回追加assertはTimer生成前拒否と即時失敗後の解除を残存Timerと混同したため、設定履歴の確認へ訂正した。製品条件は緩めていない。

診断の新品Workspaceは通常Fileから既存close-candidate／discardで正式回収し、Worktree・専用Refの不存在と実体・非使用を確認後、診断Rootを清掃して直接不存在を確認した。元保持RootのDirect／Isolatedのstate.jsonは比較前後のSHA-256が一致し、元保持物の回収は発行していない。独立確認でも上記の原因と限定案は整合している。

#### 限定是正後の新品非AI確認

Source `bc7b89ee991610aa4cb6b5a85b7a6b1f15e049ac`・clean固定後、新品`.crdd/tests/workspace-timeout-fix-20261025/preflight/`で既存Toolの非AI事前確認を一回実施した。短命入口はRoot定数だけを差替え、相対importを元Source位置の絶対URLへ機械的に解決し、`40_Develop`配下であることを確認した。実行分岐は`--preflight`だけで、AI・認証情報・Docker資源作成は使用しない。

- 終了0、Direct／Isolated両方のlimitedProbePassed・runtimeClean・workspaceClean・closeConfirmedはtrue。Directの既存Dirty／Stage／未追跡保全も成功した。
- IsolatedのBaseは`a026cbbfc5f2a1bc11b6ba6fc7181400bc9f278e`、固定Candidateは`0eb31dfcf68babaa30e252810f66009d0ec51fab`、二親Mergeは`983b4dfb34638ff725df2e0a79d5e8f663216ffd`。明示固定・差分照合・採用・Candidate終了・Worktree／専用Ref回収の既存Oracleを全て通過した。
- HTTPの開始から本文完了まではcreate 15,643ms、freeze 15,517ms、adopt 27,091ms、close-candidate 17,559ms、discard 18,197ms。旧15秒を超える操作が複数あっても、各操作60秒の有限上限内で応答を受領した。一回の実測を性能上限へ一般化しない。
- Docker比較はverified／observed_inventory_unchanged、追加・削除Container／Network零。fixtureRootsRemoved=true、fixtureCleanupFailures空、Source再観測不変。fullE2eVerified=falseを維持する。
- 元保持Root二件のstate.jsonは実行前後のSHA-256が一致し、回収・削除・Lock解除は発行していない。新Modelの実AI確認・編集E2E、AI再送・Docker再起動も実施していない。
- 今回残った結果File一件と短命入口二件は、上記要約の記録後に実体・非alias・既知File集合を確認し、今回のtests／tmp二Rootだけを清掃して直接不存在を確認した。実測ごとの書庫は追加しない。

Source・Architecture・QA・結果記録の最終独立確認は残指摘零。限定した非AI保証の確認であり、実AI・旧保持物回収・全体E2E・Releaseの成立ではない。

<a id="claude-readonly-turn-acceptance-result"></a>

### 回数比較撤去後のClaude読取り一回 — 2026-10-25

利用者の「進めて」に基づき、基準Source `1861c09aaeb06e722c73837e53f2edf156a30ddf`と新品 `.crdd/tests/claude-readonly-turn-acceptance-20261025/readonly`で、同じ正式読取りTool・Claude opus／medium・固定質問を一回だけ実行した。前回の一回入口との差はRoot名と固定Source HEADのみで、自己試験・準備と実行前独立確認は成功／残指摘零。合成Contextは1,095 bytes、SHA-256 `99505f13f046e4f5f0619d74d8edfc5e9cada26e6a839b532df214e810e343da`、選択設定Hash `67a183f123d63236e08641724274347ce1ce5d61156d62fdb3a08cb1e3bfaf40`で前回と一致。合成Commitは`ae94ea33f678c20fc29a8a21ea35259518459b5c`。

| 観測対象 | 結果と限界 |
|---|---|
| 結果 | Tool native終了0、signal／toolError／summaryFailureなし。受付`request-6d250442-5506-4717-a59b-f1e25dca0cdf`、Task／executionともcompleted、reason／primaryFailure null、limitedProbePassed true／fullE2eVerified false |
| 搬送・回収 | 同じ受付IDで結果返却、HTTP transportFailureなし、timedOut false、取消なし、closeConfirmed true、cleanupConfirmed true、recoveryIds／secondaryFailures空 |
| 公開結果の最小観測 | facts 6、sharedAnalysis 2、additionalInferences 3、nextOptions 1。本文は保存しない。今回成功時の具体的num_turnsも保存していないため、先行実測と同じ3だったとは主張しない |
| 入力・資源 | 本体HEAD／Tree・合成Context／Tree・選択設定は不変。fresh全状態Container一覧は既存停止Container `b185985108c6c901b179d0ca3214eac0ea2ef0e32de271526ddc606c6aea1764`一件のみ、稼働零。Networkはbridge／host／none／既存jarvis_defaultのみ。既存資源保持・System構成同値と標準bridge世代差はTool観測のまま記録し、世代差の原因・発行者を推定しない |
| 状態・履歴 | Operation `OP-212115393044223846441989557713456969367`。改訂35、operations／unresolvedRecoveries／pendingDeliveries／leaseIntents零。Queue completed、historyPending一件。履歴primaryFailure null、Host cleanup confirmed、Lease released、ownerEffect disabled。providerStart／externalSend／sharedWriteの保存factはunknownを維持し、成功から逆算して書き換えない |
| 終了後記録整理 | 今回Rootだけに既存`maintainCoordinatorSnapshot`を一回呼んだが、`orchestrator_snapshot_lock_unavailable`でblocked。状態は改訂35・履歴待ち一件のままであり、記録整理完了とはしない。Owner取得不成立の細因は未特定。手動書換え・Lock解除・強制削除・新しい回復機構は行わない |

生Provider出力・資格値・回答本文は保存せず、追加AI再送・Docker Engineの起動／再起動命令・Image取得・既存資源削除・旧保持物変更はない。今回の実行資源は回収済みだが、合成Rootは履歴確定と再評価に必要な記録として2026-11-01まで保全する。既存Ownerで履歴確定を確認し、非使用と自己生成物だけであることを再確認して清掃判断へ戻す。今回成立したのは同条件一回の読取り・結果搬送・実行資源回収であり、任意入力・全Provider・編集E2E・全体QA・Releaseの成立へ一般化しない。次の実AI編集には独立した送信範囲・回数の確認が必要である。

結果・状態・履歴の安全fieldと二文書を照合した限定独立レビューは残指摘零、文書diffcheckも成功した。

<a id="provider-turn-limit-result-separation"></a>

### CLI実行制限と結果受理の分離 — 2026-10-25

利用者採用方針に基づき、基準`c859f2de7`から結果受理の回数比較を撤去する。変更分類はProvider結果契約の是正であり、Architecture・QA・AI Adapter・Coordinatorの公開契約と利用側を対象とする。起動引数、隔離、認証、送信許可、Timeout・取消・回収の意味は変更しない。過去Evidenceと保持Rootの再評価条件も変更しない。文書・実装・契約試験の限定独立レビューを行い、規範準拠・公開・Releaseの変更や全体監査は対象にしない。今回必要な人間の方針判断は採用済みである。

調査では[公式実行ループ](https://code.claude.com/docs/en/agent-sdk/agent-loop)がmaxTurnsをtool-use round tripsとして説明し、[構造化出力](https://code.claude.com/docs/en/agent-sdk/structured-outputs)が内部StructuredOutputと再検査を説明することを確認した。[公開Issue #1795](https://github.com/anthropics/claude-code-action/issues/1795)は結果num_turnsとCLI上限の単純比較による正常結果拒否を報告するが、2.1.259の利用者報告であり、採用2.1.220の内部処理の直接証明ではない。今回の実測値3と正常終了から、CRDD側比較の誤拒否を是正する。CLIが内部で何を三回数えたかは未確定のままとする。Codexは[公式非対話実行](https://learn.chatgpt.com/docs/non-interactive-mode)と[CLI一覧](https://learn.chatgpt.com/docs/cli/reference)を確認し、同等の公開ターン上限を前提にしない。

| 対象 | 変更・維持する契約 |
|---|---|
| Claude三用途 | 助言・Task両役割・boolean Probeのnum_turnsは正の安全整数として検査する。要求値との大小比較なし。3・17・最大安全整数を受理し、0・負数・小数・非数・安全整数超過は拒否 |
| 起動制限 | 助言／ProbeのCLI上限2と、作業量によるTask要求値・計画上限16を維持。定数は`CLAUDE_TASK_MAXIMUM_TURNS`へ改名し、結果受理上限とは呼ばない |
| 共通入力API | `ProviderResultInput`から`resultAcceptanceMaximumTurns`を削除。全利用側を新形式へ移行し、互換中継を追加しない |
| Task観測 | Provider・役割・requestedMaximumTurns・providerReportedTurnsだけを保持。resultAcceptanceMaximumTurns／requestedTurnTargetExceededを撤去し、異なる単位の大小判定を作らない |
| 契約改訂 | Claude計画18、boolean Probe結果2、Task構造化結果20、Coordinator Task Runtime37。Root export、契約記述と試験を同期 |
| 成功・失敗 | Process正常終了・成功Envelope・回答Schema等の既存条件を維持。CLI上限到達・再試行枯渇等の失敗を成功にしない。Codexのturn.completed一件／失敗イベントなしは一依頼終端の検査として維持 |
| 保存・過去記録 | 旧数値3の拒否診断は当時の事実として既存Validator／履歴／Toolで読めるまま保持し、書換えない。旧上限比較の固定理由は履歴等の読取り許容に残るが、新Producerは発行しない。旧結果観測の移行を製品互換処理へ追加せず、必要時はフロントAIの移行対象として区別する |

着手前照合で契約記述・改訂・exportの同時追従を追加した。初回AI Adapterは改名後の公開一覧順序だけが不合格となり追従した。初回影響回帰には旧上限assertの追従漏れと、制限環境のWindows Junction作成EPERMがあり、旧結果を成功へ変更しない。追従・通常Windowsでの影響五Suite295件は成功、公開Runtime契約の是正後固定候補でも拡大十Suite410件が成功した（母集団が重なるため加算しない）。AI Adapter全24件と旧一次失敗の状態／履歴契約一件も成功。独立レビューの公開Runtime契約追従漏れ一件とHeader・試験名の旧説明一件を是正し、同候補の回帰終端と再照合した。結果文書に残った旧時点の説明も歴史記録と明示し、限定最終再確認は全重大度の残指摘零。両Packageの型検査、変更14 TypeScriptの整形・lintとdiffcheckも成功した。実AI・実Docker・資格・保持物は操作しておらず、実測E2E成功は未確認のままである。

<a id="claude-turn-count-diagnostic-once-result"></a>

### 診断付きClaude読取り一回の結果 — 2026-10-25

利用者承認に基づき、固定Source `38b9c345b939db2a6118453d61e622b1a905b4d9`、新品 `.crdd/tests/claude-readonly-turn-diagnostic-20261025/readonly`で正式読取りToolを一回だけ実行した。前回入口との差はRoot名と固定HEADだけで、自己試験・実行前独立レビューは成功／残指摘零。合成Contextは1,095 bytes・SHA-256 `99505f13f046e4f5f0619d74d8edfc5e9cada26e6a839b532df214e810e343da`、選択設定Hash `67a183f123d63236e08641724274347ce1ce5d61156d62fdb3a08cb1e3bfaf40`で前回と同一。合成Commitは`94046bc1e13bd3a8e448937e08a32041bb33c3ec`。Claude opus／mediumと固定質問も維持した。

| 対象 | 観測結果と限界 |
|---|---|
| 結果 | Tool native終了2、Task blocked／`workbench_ai_claude_turn_count_invalid`。受付`request-0915826e-efac-49d6-9d6d-4bd972864567`、Operation `OP-200837671078576366410207982605797171955`。limitedProbePassed／fullE2eVerifiedはfalse |
| 一次失敗 | `start_provider_attached`、`provider_result_normalization`。handle取得・応答観測あり、終了0、stdout 6,795 bytes／stderr 0、receiptRecorded false。追加診断は`valueType:number / numberText:"3"` |
| 直接原因 | 成功Envelopeの数値3を、既存の1〜2整数条件が拒否した。起動Planの`--max-turns 2`との意味の差・数え方・CLI側原因は未確定。前回の実値へ遡及して3だったと補完せず、受理上限も変更しない |
| 通信・終了 | timedOut false、transportFailure／Tool一次故障null、取消なし、closeConfirmed true。本体HEAD／Tree・合成Context／Tree・選択設定は不変 |
| 回収 | cleanupConfirmed true、recoveryIds／secondaryFailures空。状態改訂35、operations／unresolvedRecoveries／pendingDeliveries／leaseIntents零、historyPending一件。履歴Host cleanup confirmed／Lease released／ownerEffect disabled。providerStart／externalSend／sharedWriteはunknownを維持 |
| fresh資源照合 | 全状態Container一覧は開始前の既存停止Container `b185985108c6c901b179d0ca3214eac0ea2ef0e32de271526ddc606c6aea1764`一件だけ。Networkはbridge／host／none／既存jarvis_defaultだけ。Toolは既存資源保持・System構成同値と標準bridge世代差を報告し、再起動は発行していない。世代差の発行者・原因は推定しない |

生Provider出力・回答本文・資格値は保存しない。再試行・Docker Engineの起動／再起動命令・設定変更・旧保持物の操作は行っていない。今回Rootは失敗調査と未配送履歴一件の保全のため保持し、2026-11-01までに既存Ownerで配送・保持を確認して清掃判断へ戻す。今回の一回発行・失敗分類・実行資源回収の完了であり、助言成功・全体E2E成功ではない。次候補は採用CLIにおけるTurn数の意味と固定Plan／正規化条件の非AI照合であり、上限緩和・AI再送は含めない。

<a id="claude-observation-http-diagnosis-20261025"></a>

### Claude状態GET遅延の非AI切り分け — 2026-10-25

基準 `b51725dcd` の既存結果とSourceを調査した。今回の対象は原因調査と最小案であり、製品実装・HTTP期限・Task Lifecycleは変更しない。AI再送、Docker操作、保持三領域の操作は行わない。

| 確認対象 | 結果・限界 |
|---|---|
| 前回の直接失敗 | HTTP子が状態GETのheadersを15秒以内に観測できなかった。Task／実行completed・cleanup確認済みとは別の検証通信失敗。Server受信／finish／Owner観測時点がないため、元の遅延区間は復元できない |
| 調査時点のSource | `verify-readonly-ai.ts`は既存Clientの任意timing observerを接続していなかった。Client.observeはAI専用照会でなくWorkbench全体のGET。ServerはTask観測後にTopic／Meeting・Tree・選択設定・Network等も組み立てる。Session内に要求がある通常observeは認可後にmemory snapshotを返し、Docker完了を待つ処理ではない |
| 通信子の既存試験 | 四件成功。通常・切断・15秒拒否、結果frame／実close、同ID保持を確認。元の実AI失敗の原因証明ではない |
| 合成Workbench計測 | AI start禁止・有限Task代役と実Git改訂／選択Readerで一回計測。Server GET受信→finishは645／543／520／515ms、子の開始→本文完了は669／567／543／536ms、観測内読取り約25〜33ms。通常GETが常に15秒超となる仮説は再現せず。実AIの同期準備・終了・保存競合は再現していない |
| 試験前提と清掃 | 初期fixtureの保存初期化・Git除外登録・Context必須表不足を順に補った。いずれもHTTP試験成立前の停止であり、製品故障や試験成功へ丸めない。今回自己生成Rootだけを清掃し、計測後Server終了とRoot不存在を確認。保持物は不変 |

根本原因は未確定。候補はServer側の実行準備・終了等の同期占有、Ownerの認可／保存読取り、画面構築後段、応答搬送境界である。認証期限、Claude固有不具合、Container作成失敗または15秒不足とは断定しない。

最小案は検証Tool内の有限計測接続だけとした。既存Client時計へ固定の処理段階と要求番号を添え、initial／start前後／observe／cancelの同一路GETを区別する。Server受信／finishは当該listener・port・pathに限定し、Owner.observeの意味・認可・取消・closeを変えない局所wrapperで開始／終了だけ測る。生URL、本文、Token、Provider出力は記録せず、観測例外で結果を変えず、finallyで購読を解除する。子開始→Server受信、受信→Owner観測終了、観測終了→finish、finish→子headersを分け、遅延Ownerを確定後にだけ該当処理の是正を提案する。HTTP15秒維持、新Worker／Queue／Lock／Cache／Recovery／自動再送なし。独立レビューで要求相関不足の指摘を案へ反映した。調査時点では未実装だったが、その後利用者が次の限定実装を承認した。元の遅延解消は主張しない。

#### 最小計測接続の実装

`scripts/ai-verification-timing.ts`を読取り検証Toolの内部部品として追加し、既存Client時計、対象loopback port／固定pathだけのNode HTTP診断通知、同じOwner.observeの局所wrapperを接続した。診断の各配列は最大512件、超過はdropped、欠測はnull。Client／Serverの番号は独立した観測順であり、番号一致だけで同一要求を証明しない。新しい永続State・Log・製品APIは追加しない。

独立レビューの購読解除順序と出力契約の二指摘を是正した。Client closeのfinallyで購読を解除してから既存Server／Owner closeを別try/catchで必ず試みる。Server close保留中の通知・拒否でも診断は増えず、元のcloseFailureを保持する。Architecture／QAへ取得時点snapshot、相関と欠測、上限、閉じた型を反映し、正式mainのsummaryと不正値で検査する。既存短命launcherのstrict parserは新しい`httpTiming`を拒否するため、再利用する場合はこの閉じた形へ追従が必要であり、過去parserを無修正で使わない。互換aliasは作らない。

型・Package全体の整形／lint確認は成功（変更外のinfo五件は残存）。初回対象回帰二十件は成功し、レビュー是正後の固定対象回帰は二十二件すべて成功した。母集団が重なるため加算しない。最終独立レビューは残指摘零。実loopbackの正常・15秒Timeout、閉じたsummaryの不正値、解除後通知・Server close保留／拒否、元HTTP故障・同ID取消・実保存受付と応答喪失後継続を確認した。初回の型検査で試験用Promise.withResolversが設定対象lib外だったため通常Promiseへ置換し、FormatterのWindows書込み拒否は未適用を維持して再整形・再検査した。実AI・Docker操作・保持物の処置は行っておらず、既存15秒期限とTask Lifecycleは不変。計測接続ができたことを元Claude遅延の原因確定・解消とは扱わない。

<a id="claude-observation-timing-once"></a>

#### 計測付きClaude一回の実測

利用者の再確認承認により、固定Source `b114c08f67989272316a7a62b3f5bdf1e6382d87`、固定Claude Image `sha256:612433b71c4af3dfb135c00daad64f0ef897f86e0251b4da558715fdfde9c51f`、Claude Opus 5.5／mediumで正式読取りToolを一回実行した。送信は前回同一の合成Context 848 bytes／SHA-256 `4299bae2e2fffb7ebd929cb6d5a789b232ff364d943cf7b1a228ad9b7f15f6f0`と固定質問だけ。合成Commitは`7a61ee88e7fe48561003f0faa5a3bff910564c28`。一回入口は旧tmp／旧結果への依存を撤去し、自己試験Process内で旧ファイル読取り・importを拒否しても検査成功することを確認した。実行前独立レビューの残指摘零。拒否用preloadは自己試験専用で、正式Tool子には注入しない。

| 対象 | 今回の観測 |
|---|---|
| 結果 | Tool終了2、limitedProbePassed／fullE2eVerified false。受付`request-dc5a3328-1f03-44a9-bff2-39be481b3d9c`、Task／実行blocked、一次理由`provider_process_exit_nonzero`。生出力・回答本文・資格値は保存しない |
| 検証側の最初の失敗 | observeで`workbench_verification_client_process_failed`、子Process段階deadline、exit欠測、SIGTERM、stderr 0 bytes、終了要求あり。HTTPのheaders_unobserved／15秒Timeoutではなく、親側20秒監視による終了分類。欠測をHTTP故障へ補完しない |
| 記録できた通信 | Client／Server各14件、Owner観測11件、dropped 0、購読解除済み。14件中GET13件は開始→本文完了約0.57〜0.95秒で全て200相当の正式Client検査を通過。Owner観測は約26〜69ms、Server GET受信→finish約0.54〜0.91秒。最後の失敗要求には有効な子frameと対応Server受信の記録がないため、子の起動／HTTP発行前・Server到達前・frame搬送前のどこかは特定できない |
| 親側観測の遅延 | start POSTの子本文完了→親close処理に8,332ms、観測GETにも4,226ms／2,211msの差を記録。親Processでのcallback処理遅延を実測したが、最後の子期限超過やProvider非0の原因・因果順まで断定しない |
| 取消・終了 | 同じIDへの取消要求一回・結果観測あり、clientCloseFailure／closeFailureなし、closeConfirmed／cleanupConfirmed true、回復参照・二次失敗空。本体HEAD／Tree、合成Context／Tree、選択設定と六入力Hash不変 |
| 資源 | fresh一覧は既存停止Container一件のみ、試験専用Container／Network残存零。標準bridgeのID世代差あり、既存資源保持・構成同値を確認。再起動を発行しておらず、世代差の原因・発行者は未確定 |

失敗後の自動再送・別Provider試験・編集E2E・Docker再起動は行わない。前回のGET15秒故障が解消したとは扱わず、今回観測できたGETは遅くなく、別の子監視期限で停止したことを区別する。次候補は外部AIなしで子Processの発行・起動・stdin・結果frame・親callbackの境界と、既存Provider非0診断の搬送を照合すること。Timeout延長、新Worker／Queue／Lock／Recoveryは根拠なしに追加しない。

今回Root `.crdd/tests/claude-readonly-timing-20261025/readonly-claude` は既存maintenance後、operations／unresolvedRecoveries／pendingDeliveries／historyPending／leaseIntents／workspaces零、自身以外のWorktree・専用Ref零、参照可能な試験Process零、canonical Path一致・reparse零を確認した。空状態ではなく、prepareWorkspaceSurface由来の未実行合成queue二件（queued）とTask一件（ready）は残るが、実行Owner・Operation・Workspace・結果参照はなく、fixture全体の廃棄対象とする。これを製品Taskの完了・取消成功へ換算しない。保持中三領域は不変。安全な結果JSONは親にありRoot清掃対象から除外し、2026-11-01までに非AI調査と保持要否を再評価する。短命入口の`readonly.mjs`／`report.mjs`／自己試験専用`deny-old.mjs`／今回回収確認用`cleanup.mjs`の四Fileと空になった今回tmp directoryも、処理完了後の清掃対象とする。

独立確認後、同じ状態・未実行fixture・Git参照・Process・canonical／reparse条件を直前に再照合し、今回leaf Rootを削除して不存在を確認した。非使用の短命四Fileもexact一覧を再確認して削除し、空の今回tmp directoryまで不存在を確認した。兄弟結果JSONと親Directory、既存保持三領域は維持した。今回の再送零・失敗分類・安全回収の成立であり、読取り成功・全体E2E成功ではない。

<a id="verification-client-input-deadline-diagnosis"></a>

#### 検証子の入力搬送と親監視期限の非AI調査

基準`cede6c6a`で、外部AI・Docker・保持物を使わず、独立Processの合成HTTP Serverと正式`requestInChild`を比較した。製品Sourceは変更していない。親の意図的な22秒停止は診断用の反例であり、元実AIで同じ長さ・箇所の停止が発生した証明ではない。

| 条件 | 観測 |
|---|---|
| 通常 | HTTP200、子終了0、終了要求零。HTTP開始→本文完了21ms |
| stdin.end返却直後に親を22秒停止 | 子のspawn／stdin finish／close通知の親側処理が遅延し、親再開直後に20秒期限callbackが発火。終了要求一回・SIGTERM・stderr零・Server受信零・有効frameなし。今回実AIの子監視失敗と同じ分類を再現 |
| 子の結果data通知後に親を22秒停止 | HTTP21ms、子は正常終了済み。期限callbackのkillはfalse、その後exit0／close0を確認し既存契約どおりHTTP200を受理。親遅延を一律に失敗へ変える実装ではない |
| stdin読取り時刻の補助観測 | 子のreadFileSync(0)開始はspawn返却の約206ms後、読取り完了通知なし。親停止約22秒後にkill true、入力finish／closeの親側観測はその後。子の同期入力読取りが完了せずHTTPへ進まない状態を確認。kernel上のbyte／EOF位置までは観測していない |
| 標準IPCの一件入力へ置き換えた合成比較 | 同じ親22秒停止中でも、子はHTTPを23msで完了。Server受信→finish 2ms、子終了0、親再開後のkill false・close0でHTTP200を受理。HTTP15秒・親20秒・close2秒と既存frame／終了判定は維持 |

stdin.endの返却は、子が入力全文・終端を読み終えた事実ではない。親の同期占有が検証入力の進行を止め、その間にwall-clock期限を超え、親再開時に監視が子を停止する経路を再現した。元実AIで親を占有した具体処理、Provider非0との因果、以前のHTTP15秒故障は未確定のまま。先行の補助preload試行はWindows絶対Pathのimport指定不備で子が起動時に終了したため根拠から除外し、file URL修正後の補助観測だけを採用した。

最小是正候補は、既存`ai-verification-client.ts`への入力だけをNode標準IPCの一件搬送へ変更すること。追加Worker／Runtime child／入力File／Queue／Lockは作らない。親の256KiB事前検査、子のUTF-8容量再検査・曖昧JSON拒否・閉じたshape・loopback／固定route検査は維持する。親は一つのstringだけsendし、throw・callback error・channel欠測／早期disconnectを既存pipe故障へ接続する。sendのfalseはbackpressureであり即失敗にしない。子は一件受領後にchannelを切断し、型不正・parse失敗・HTTP失敗を含め自然終了を妨げない。未到達は既存監視で終了し、stdout frame・stderr上限・exit0/2・late close・kill false・一次失敗・同ID取消・回復参照・HTTP15/60秒・親20/65秒・close2秒は変更しない。Token／Formをargv・env・logへ移さない。

実装前の反証対象はsend例外／callback失敗／未到達／非string／過大／曖昧JSON／二件目／子早期終了／未切断／親停止／late close。旧stdin故障の検証責務を消さず、新transportの故障へ意味対応させる。独立確認で再現の事実・未確定範囲と、この条件付きIPC案の整合を確認した。今回は調査と候補比較までで、製品未適用。独立Serverでの成立を、本番Workbench Serverの15秒応答保証や実AI成功へ拡張しない。

各診断の合成Serverは終了0、使用子Processの終了を確認した。今回短命四File（diagnose.mjs／server.mjs／input-clock.mjs／ipc-client.ts）と空の `.crdd/tmp/client-deadline-diagnosis-20261025/` は非使用・exact Path・reparse不在・内容一致を直前確認して清掃し、四FileとDirectoryの不存在を確認した。元の実AI結果JSONと既存保持三領域は対象外。

<a id="verification-client-ipc-implementation"></a>

#### 検証Tool限定のIPC入力是正と非AI検証

基準`05634a322`から、利用者が承認した検証Tool側だけを変更した。既存HTTP子への入力をstdin／EOFからNode標準IPCの一件のJSON stringへ切り替えた。CoordinatorのTask受付・実行Owner・HTTP契約は変更せず、追加Runtime child／Worker／Queue／Lock／入力File／fallbackは作らない。先行調査の「未適用」はその時点の事実として維持する。

親は256KiBの事前検査後に一回だけ送信し、送信例外・callback error・channel欠測・送信前disconnectを既存pipe失敗へ接続する。send falseはbackpressureとして扱い、再送しない。送信成功や送信後disconnectを子の受領・HTTP成功へ読み替えず、有効な結果frameとexit／close又は既存期限で判定する。終了後の遅延callbackは一次結果を上書きしない。子は最初の一件を受けてchannelを切断し、string型・UTF-8 byte上限・曖昧JSON・閉じたshape・loopback／固定routeを再検査する。stdinはignore、stdout／stderrは既存pipeとし、資格値やFormをargv・env・File・logへ移さない。

HTTP15/60秒、親20/65秒、close2秒、kill最大一回、stderr／frame容量、late close、取消・一次失敗・同ID回復参照は維持する。旧stdin失敗の試験責務はIPC送信失敗へ移し、未到達、channel欠測、二件目、早期disconnect、型・容量・JSON不正、HTTP失敗、backpressure、終了後callbackを反証した。独立した合成Serverは試験fixtureだけに置き、正式Client送信直後に親を22秒停止しても子のHTTP完了・正常終了を確認した。試験子・Serverの終了を確認し、新たな永続試験領域は作成していない。

| 確認範囲 | 結果と限界 |
|---|---|
| 静的確認 | Workbenchの整形95 File・TypeScript・lint成功。変更外の既存info五件は維持 |
| 固定差分の対象回帰 | Client契約・時刻診断・実保存受付の三Suite、25件成功・失敗零。先行局所六件と重複するため加算しない |
| Lifecycle | 通常完了・取消・応答喪失後の同ID継続、子の不正入力と異常終了、親停止、既存期限と有限終了確認を検証。Task成功と検証通信成功を分離 |
| 独立確認 | Source・Architecture・QAの残る必須指摘零。条件だった固定差分不変と三Suiteの終端成功も確認 |
| 未実施・未確定 | 実AI再送・Docker操作・保持物操作なし。元実AIの親占有処理、Provider非0との因果、以前のHTTP15秒故障は未確定。実AI読取り・編集・全体E2Eの成功は主張しない |

Architecture DetailとQA-000006へ入力搬送・失敗分類・終了条件を反映した。次の実AI確認には別途一回の送信承認が必要であり、今回の非AI成功から自動再送しない。

<a id="claude-ipc-readonly-once-result"></a>

#### IPC是正後のClaude読取り一回 — 2026-10-25

利用者の明示承認により、固定Source `32ddb51a22e4dfbbaf7cac4ff3d68f1134560064`、既存Claude Image `sha256:612433b71c4af3dfb135c00daad64f0ef897f86e0251b4da558715fdfde9c51f`、Claude Opus 5.5／mediumで正式読取りToolを一回だけ実行した。送信内容は前回と同じ合成Context848 bytes／SHA-256 `4299bae2e2fffb7ebd929cb6d5a789b232ff364d943cf7b1a228ad9b7f15f6f0`と正式Toolの固定質問だけ。本体Source・秘密情報を送らず、既存Subscription経路を使用する。新品合成Rootは `.crdd/tests/claude-ipc-once-20261025/readonly-claude`、合成Commit `4b7f7a38e405d2381878733b60bd2b973172a21a`。

実装・契約変更ではなく、承認済み実境界の限定検証として扱った。短命入口の事前レビューで結果のnested検査不足・成功条件不足・最外失敗記録不足を検出し、外部Effect前に是正した。既存の閉じた結果検査を現在のモデル・有限時計へ追従し、Source／入力／fixture不変と実終了を成功条件へ接続した。送信例外・結果保存失敗の固定診断とRoot保持を自己試験し、独立再確認の残指摘零の後にだけ実行した。製品Source・期限・Task Owner・再送禁止は変更しない。今回は限定結果と回収の独立確認を行い、準拠基準やReleaseを変更しないため全体準拠監査は追加しない。

| 対象 | 観測結果と限界 |
|---|---|
| 結果 | 正式Tool終了2、signalなし、close確認済み。受付`request-a9c79dcd-2ec3-42a4-a5fe-d67e10d3b124`。limitedProbePassed／fullE2eVerified false。Tool stderrは1,388 bytesの件数だけを保持し、本文は保存しない |
| 検証側の最初の失敗 | observeの`workbench_verification_transport_failed`／headers_unobserved／timedOut true。今回はHTTP15秒Timeoutであり、先行の子Process20秒deadline分類とは異なる |
| 最後のGET | Client開始→Server受信18,592ms、Client期限確定15,007ms、Server受信→finish658ms、Owner観測46ms。Client期限確定（要求処理終了）→親close処理4,247ms。Server受信がClient期限より遅い事実を確認したが、送信から受信までの具体的な占有処理・OS／通信待機は未特定。受信前遅延をOwnerの保存遅延へ読み替えない |
| 有限時計 | Client／Server各15件、Owner12件、dropped零、購読解除済み。POST本文完了→親close処理にも8,209msの差を観測。独立ordinalを一律に同一要求番号とせず、最後の固定逐次GETの時点・経路と件数を照合した |
| Task一次失敗 | status／executionStatus blocked、reason／primaryFailureはprovider_process_exit_nonzero。履歴のpurpose start_provider_attached／stage execution_classification、handle取得・応答観測あり、receipt記録なし、exceptionCodeなし。command終了1、stdout 1,411 bytes／stderr零。本文は読取り・保存せず、この情報だけで認証失敗やCLI内部原因、HTTP取消との因果順を断定しない |
| 取消・終了 | 同ID取消一回と結果観測あり、取消・Client close・Owner／Server close失敗なし、closeConfirmed／cleanupConfirmed true、回復参照・二次失敗空 |
| 資源 | 終了後Containerは既存停止一件のみ。試験専用Container／Network残存零。標準bridgeだけID世代差、既存資源保持・構成同値を確認。再起動命令は発行せず、世代差の原因・発行者は未確定 |
| 不変条件 | 本体HEAD／Tree、合成Contextを含む六入力Hash、合成Tree不変。再送・別Provider・編集E2E・Image更新・Docker再起動・既存保持三領域の操作なし |

既存maintenanceはcompleted／orchestrator_terminal_records_retired。保存Ownerによる再読取りでoperations／unresolvedRecoveries／pendingDeliveries／historyPending／leaseIntents／workspaces零、自身だけのGit Worktree、専用Ref零、reparse零、Tree cleanを確認した。今回Root参照の対象Processは零。別にprepareWorkspaceSurfaceが作成した未実行baselineとしてqueue-a／queue-b二件がqueued（generation1、ownerGeneration／workspaceId／resultReference null）、task-a一件がready／startPhase none／retry0で残る。Projectのowner-aはfixtureの固定初期値であり、実行Ownerの生存証明ではない。TaskのattemptId／authorityBindingId／candidateId／operationId／supersededByはnull、回復義務・受理参照は空、結果・受領・判断・判断回復・Lease根拠は零、受付Bindingは合成二Queueだけである。今回の読取りRequestや実行Owner・Operation・Workspace・結果・回復・配送・履歴待ちとの結合はなく、これらをTask完了・取消成功へ換算せずfixture全体の廃棄対象とする。削除直前に同値を再確認し、不明・別値なら停止する。合成Rootの不要fixtureを確認後清掃し、兄弟の安全な結果JSONだけ2026-11-01まで保持する。未解明の原因や失敗を成功へ書き換えず、追加AI試験は行わない。次候補は外部AIなしでServer受信前の親側占有とProvider終了1の既存診断搬送を切り分けることであり、期限延長・Worker／Queue／Recovery追加は行わない。

独立確認で清掃前の未実行baseline説明と、失敗GETを本文受領と読める表現を是正し、残指摘零となった。同じ保存OwnerのGate・exact canonical leaf・全配下reparse零・対象Process零を削除直前に再確認し、今回leaf Rootだけを削除して不存在を確認した。兄弟結果JSON・親・既存保持三領域は不変。自己生成した短命入口readonly.ts／厳格結果検査report.ts／清掃確認cleanup.tsもexact一覧・非使用・境界を確認して削除し、空の `.crdd/tmp/claude-ipc-once-20261025/` まで不存在を確認した。今回の失敗分類と回収成立の記録であり、読取り成功・編集E2E成功ではない。

<a id="http-receive-non-ai-diagnosis"></a>

#### Server受信前遅延とProvider非0の非AI切り分け

基準`8c6db46a2`から、製品Source・契約を変更せず、既存の実保存HTTP結合試験と新品合成保存fixtureを使って同期処理を有限計測した。外部AI・Docker照会／操作・認証情報・既存保持物は使用しない。実装変更ではなく原因調査と最小案の評価であり、固定理由・Authority・準拠基準を変更する監査は追加せず、数値・因果の限界と安全境界の独立反証を実施する。

| 確認 | 結果と限界 |
|---|---|
| 静的確認 | Workbench整形95 File・型・lint成功（既存info五件は不変）。AI Adapter整形27 File・型・lint成功 |
| 非AIの既存HTTP結合試験 | 正式Task Owner・実Writer・公開HTTPで通常完了・取消・応答喪失後の同ID継続を二回成功。実行部分だけ合成、AI／Dockerなし。同じ一項目の計測条件違いであり二項目分のcoverageとは扱わない |
| 初回計測 | spawnSync／execFileSync／Atomics.waitの時間とStack、CPU標本を観測。試験約104.4秒、event loop遅延最大約20.6秒。Stack生成等の計測影響があるため素の性能値として採用しない |
| Stack取得なしの二回目 | 試験約84.1秒、event loop遅延最大約15.8秒。計測対象Process全体でrealpathSync.native 370,565回／累計35,650ms、openSync 35,258回／20,946ms、lstatSync 406,136回／6,541ms。Atomics.wait最大73ms、spawnSync最大204ms、fsyncSync最大15ms。monkeypatch・inspectorの費用、module読込み等も含み、各計測はinclusiveに重複し得るため時間を加算しない。元実AIの費用割合・正確な回数や18.592秒の原因へ一般化しない |
| 読取りだけの対照 | 本体Root検証三回は各7〜10ms、非秘密AI選択の読取り各19〜20ms。Task・状態保存・Docker・外部AIは起動しない |
| 保存だけの限定計測 | 新品合成Rootで既存prepareWorkspaceSurface（初期状態作成と二Queue保存）は10,031ms、Ownerでの観測まで10,347ms。realpath 44,141回、open 4,389回を観測。128 openごとの有界Stack標本は主にGit layoutの読取りとoperationのstorage revalidateへ接続した。計測器を外した同じ構成では7,093ms、観測まで7,264ms。計測器自身の影響があることも確認 |
| Provider固定分類 | AI Adapterの純粋な既存エラー分類三件は成功。既知のClaude失敗subtype・説明だけを固定理由へ変換し、未知形・不正・容量超過・未認識説明は一般の非0理由に閉じる。元の1,411 bytesを保存していないため、分類漏れ・認証・Model／CLI起因・取消との因果は再構成不能。生出力の再取得やAI再送は行わない |

Sourceでは、`version-control/src/repository/revision.ts`のobserveRepositoryStorageIdentityが、CapabilityからのRoot再解決、before／afterのlayout観測、末尾のRoot再解決を別々に行う。Root解決自体もlayout全体を観測するため一回のIdentity観測に複数の完全探索がある。さらに`coordinator/src/execution/operation.ts`のborrowRuntimeOwnedCoordinatorStorageRepository().revalidateが同観測後にRootを再解決し、保存OwnerのassertLive／借用／I/O境界から反復する。標本ではlayout.tsのreadStableFileBytes→HEAD／config／exclude読取り→Root／Identity再観測へ接続した。

したがって、単一の長時間Lock待ちだけではなく、**本番保存経路の重複した同期実体観測が有力な費用候補**である。ただしevent loop最大値だけでは連続占有関数を特定できず、元実AIの各phaseの実測がないため「18.6秒の原因を特定した」「テストだけの問題」とは扱わない。HTTP後の処理が短いこととも両立する。

最小修正候補は、**一回のrepository.revalidate()内部**で同じfresh観測を作る際の重複Root／layout探索だけをVersion Control側で統合すること。Capabilityのexact Root、before／afterのlayout、logical／instance Identityの照合は保つ。Coordinatorにcacheを作らず、公開結果や保存形式を変えない構成を第一候補とする。別々のrevalidate呼出し、Lock取得前後、書込み前、atomic replace／readback後、解放・cleanup等のfresh確認を跨いだ再利用はしない。global cache・await／phase越え再利用・排他省略・Timeout延長・Worker／Queue／Recovery追加は対象外。

実装前には、現行と候補を同じ反例で比較する。観測途中のRoot／commonDir／worktree種別／realpath差、reparse、不正Capability、観測不能、pre確認後から書込み前の変化、書込み後からreadback前の変化、Lock失効を現行同様に拒否し、正常・blocked結果とEffect前停止を維持する。計測器なしの固定fixtureでも探索削減と所要時間を別確認する。現時点は提案であり製品Source是正済み・元故障原因確定とは表示しない。

保存限定fixtureの初回準備は空の.git/info/exclude未作成によってEffect前にblockedとなり、根拠から除外した。同じ自己生成Rootが.gitだけであることを確認し、既存fixtureと同じ空excludeを補った計測と、計測器なしの新品対照だけを採用した。両HTTP fixtureは既存t.afterでOwner／Server／Client終了、義務・Lease終端を確認してRoot不存在、保存限定fixtureも六義務零・未実行固定Queue・自身だけのWorktree／専用Ref零・reparse零を確認してRoot不存在となった。

短命診断は `.crdd/tmp/http-receive-diagnosis-20261025/` の三Scriptと四つの非秘密集計JSONだけに限定する。既存保持物や前回実AI結果JSONは不変。候補との比較入力として2026-11-01まで保持し、是正比較完了又は同日までに再評価して確認後清掃する。Source本文・HTTP本文・資格・コマンド引数は集計へ保存しない。保持を実AI再送や新たなRuntime管理の許可にしない。

<a id="storage-revalidation-consolidation"></a>

#### 保存再検証内の重複探索統合 — 2026-10-25

利用者の継続指示により、基準`46dfaf776`からVersion Controlの一回の保存Identity観測内だけを整理した。変更分類は安全境界を維持する内部Refactor。Version Control／CoordinatorのArchitecture、QA-000007、直接利用側を着手前に照合し、読取り専用の独立確認でRoot確認とGit配置取得を同じfresh探索へまとめる条件を確定した。新しい公開API・保存Schema・Cache・Worker・Queue・Lock・Recoveryは追加しない。準拠基準・外部公開・Releaseは変更しないため全体準拠監査は追加せず、Source・安全境界・文書伝播の独立レビューと対象回帰を行う。

| 対象 | 処置と維持する条件 |
|---|---|
| Version Control内部観測 | 私有WeakMapの発行済みCapability、絶対Directory、実Path、Git配置を一回の探索で照合する。新しい補助関数はPackage Rootの`index.ts`へ公開しない |
| 保存Identity | 同じ呼出しの前後にfresh観測を二回行い、Root・Git種別・論理／物理Identityを比較する。従来の四探索を二探索へ統合し、観測不能はnullのまま返す |
| Coordinator保存借用 | 同じCapabilityに対する余分なRoot再探索だけを除去し、一回の`revalidate`を五探索から二探索にする。別のI/O段階の確認・Owner・Lock・書込み・読戻しは変更しない |
| 反証と終了条件 | Root／commonDir差替え、種別変更、junction、観測不能、不正Capabilityを拒否し、元の実体へ戻した後の再観測を確認する。正常・Linked Worktree、呼出しごとのfresh確認、公開結果の不変も照合する |

Version Control全回帰71件、Coordinator保存借用・現在状態・Lock／pending・履歴の五Suite90件、Workbench HTTP検証Tool三Suite25件はすべて成功、失敗・skip零。正常／取消／応答喪失後の同ID継続、Owner喪失、Lock競合、書込み・読戻し失敗、履歴再入場と拒否条件を維持した。追加した反例の局所再実行は全回帰と重複するため加算しない。Version Control／Coordinator／Workbenchの整形・型・lintは成功し、Coordinator既存info84件・Workbench既存info五件は不変。Source・Architecture・QAの独立レビューは処理上の指摘零、Headerの境界条件をpreconditionへ置いた軽微指摘一件を適切なtagへ是正した。

計測器なし・他回帰終了後の同じ新品合成fixtureでは、初期化と二Queue保存は4,920ms／3,675ms、Owner読取りまで5,025ms／3,793msだった。変更前は7,093ms／7,264ms。実行ごとのぶれがあり、標準benchmarkや任意Repositoryでの速度保証にはしない。保存fixtureは各回、六義務零・未実行二Queue・自身だけのWorktree／専用Ref零・reparse零を確認して清掃・不存在確認済み。探索回数や性能改善だけを安全性の根拠にはしない。

元実AIの18.592秒とClaude終了1の原因確定・解決、実AI E2E成功は主張しない。外部AI・Docker照会／操作・資格読取り・既存保持物の操作は行っていない。次はこの限定是正を固定し、実AI再確認の送信範囲・回数について別途人間判断を得る。

Header是正後の最終独立確認は限定Pass。比較完了後、短命診断七ファイルのexact一覧、今回回帰三Rootの空領域又はNode compile cacheだけであること、canonical境界・全配下reparse零・対象Node Process非使用を再確認した。診断Directoryと回帰三Rootを清掃し、各不存在を確認済み。実AI結果や既存保持三領域は不変。計測器や試験生成物をGitへ追加せず、本節の限定結果と再実行可能な契約試験を残す。

<a id="claude-improved-source-once-20261026"></a>

#### 改善SourceでのClaude読取り一回 — 2026-10-26

利用者から、前回はClaudeの支払い不調で停止していた可能性と、改善後Sourceでの実AI確認依頼があった。支払い状況の履歴は取得せず仮説として分離した。固定Source `886f5ed3e6d87e2ee53ae737df22e5e9adacee00`、既存Image `sha256:612433b71c4af3dfb135c00daad64f0ef897f86e0251b4da558715fdfde9c51f`、Claude Opus 5.5／medium、既存Subscription経路で正式読取りToolを一回だけ実行した。

前回848 bytesの合成本文は清掃済みのため、今回は既存HTTP結合試験と同じ形式の合成Context744 bytes（SHA-256 `d634da8deaac149b0fb8b70808508eb8293f00f48a337e912938faf6a798c749`）と正式Toolの固定質問だけを送信した。この入力差を実行前に案内し、完全同一入力の比較とはしない。本体Source・実Context・資格値は送信しない。新品Rootは `.crdd/tests/claude-improved-once-20261025/readonly`、合成Commit `9aeb870d56d6385beae95e0c72831ae77dbfd0a8`。Root名の日付は準備開始日であり、結果確定日は2026-10-26。

| 確認対象 | 観測結果と限界 |
|---|---|
| 正式ToolとTask | Tool終了0／signalなし／実close確認。受付`request-5dacd36e-08ba-439f-acac-4e39fa1286dc`、Task・実行ともcompleted、reason／primaryFailure null、limitedProbePassed true。fullE2eVerified false |
| 応答 | facts二件・sharedAnalysis二件・additionalInferences一件・nextOptions一件。本文・生Provider出力・stderr本文は保存せず、stderrは1,114 bytesの件数だけ保持 |
| 通信・有限時計 | HTTP失敗・Timeout・取消なし、closeConfirmed true。Client二十件・Server二十件・Owner十七件、dropped零・購読解除済み。Client開始から完了まで最大11,961ms、Owner観測最大52ms。今回15秒内で成立した事実であり、恒常的な性能保証ではない |
| 回収 | cleanupConfirmed true、回復参照・副次失敗空。終了後一覧は既存停止Container一件だけ。既存資源保持・System構成同値。標準bridgeのID世代差各一件は既存比較契約に従い別記し、再起動発行やその原因を推定しない |
| 不変と対象外 | 本体Commit／Tree、合成Tree、五入力Hash不変。AI再送・別Provider・編集E2E・Image更新・Docker再起動・既存保持物操作なし |

短命入口だけを独立確認し、未知field保存とProcess終了確認、時計・資源の相関、kill失敗診断を実AI前に是正した。標準Networkの構成同値ID世代差を禁止する案は既存契約の反例へ照合して撤回し、従来の許容と拒否を維持した。閉形式・成功条件・異常終了・保存失敗の非AI反例後、一回の発行guardを使用した。製品Source・契約・期限の変更ではなく実境界の限定検証のため、全体準拠監査は追加せず、入力・結果・回収条件の独立確認を行う。

今回の成功により、現在のSource・設定・アカウント条件でClaude読取りが成立した。ただし、過去の支払い不調を裏付ける診断はなく、前回終了1の原因やSource改善・アカウント状態それぞれの寄与は特定できない。過去の失敗を成功へ書き換えず、Direct／Isolated実AI編集E2Eも未実施のまま残す。

終了後の既存履歴保守はcompleted／orchestrator_terminal_records_retired。同じ保存Ownerによる観測でoperations／unresolvedRecoveries／pendingDeliveries／historyPending／leaseIntents／workspacesと結果・受領・判断・判断回復・Lease根拠は零。未実行fixtureの二Queue（queued・Owner／Workspace／結果参照null）とTask一件（ready／startPhase none／retry零、Attempt／Authority／Candidate／Operation／superseded参照null、回復・受理参照空）だけを残す。これらを実行成功の証拠とせず、今回合成Root全体の廃棄対象とする。Gitは自身のWorktreeだけ、専用Ref零、Tree clean、reparse零を確認した。削除直前にも同値・exact Root・非使用を確認し、不明又は差があれば保持する。安全な結果JSONは兄弟に分離し、2026-11-02までに保持要否を再評価する。

結果・文書の独立確認は整合、清掃Gateの保守結果・二Queue／受付Binding集合・世代の検査不足は是正し、blocked／重複／世代差の非AI反例を確認した。直前の同Owner再観測、全配下reparse零と対象Process零、exact leaf境界を再確認し、今回合成Rootだけを清掃して不存在を確認済み。短命入口五Fileと空tmp directory、準備・発行guard二Fileもexact一覧・非使用確認後に清掃した。兄弟の安全な`result.json`だけを期限付き保持し、既存保持物は不変。

<a id="workspace-edit-e2e-20261026"></a>

#### Direct／Isolated編集E2E再開の試験入口整備 — 2026-10-26

利用者の継続指示により、次は新品合成RepositoryでDirect→Isolated各一Taskを確認する。Codex `gpt-6.1-sol / medium`で`source.txt`一行だけを編集し、Claude `claude-opus-5-5 / medium`でレビューする。既存Taskの限定是正一回と再レビューを含めAI起動は最大八回とし、Task全体の再送・失敗後再試行へ余り枠を使わない。送信は合成Context・固定編集指示・合成Sourceと差分だけ。既存固定Image／Subscription認証を使用し、本体Source／実Context／秘密値、Image取得・更新、Docker起動・再起動・修復、再ログイン、APIキーfallback、旧保持物操作は対象外。

旧試験先との衝突を避け、正式Toolの新品Rootを `.crdd/tests/workspace-ai-20261026/{preflight,edit}/` に切り替えた。まず外部AIなしで両方式の公開操作・既存Dirty／Stage／未追跡保全・候補固定・二親Merge・Worktree／Ref回収を一回確認し、全条件成功時だけ実AI編集を一回実行する。Direct失敗時はIsolatedを開始しない。

変更分類は検証Toolの限定修正であり、製品Task・HTTP期限・保存形式・認証・Image・公開APIは変更しない。清掃前に既存履歴保守と保存Ownerへ接続し、六義務・結果／受領／判断／Lease根拠の零、固定Queue／受付Binding／Task baseline、方式別Git状態、Owner解放を確認する。Rootと全配下のcanonical／reparse検査は履歴保守Effect前と削除直前に行い、削除先は固定のdirect／isolatedだけから導出する。未知・重複・欠測・観測不能ではRootを保持する。新しい管理台帳・Lock・回復機構は追加しない。

着手前の責務・lifecycle照合と独立レビューで、清掃検証順序と診断modeへのPath依存を是正し、最終再レビューの残指摘零。HTTP検証三Suite二十六件成功後、是正で変わったTool二項目を最終Sourceで再実行して成功した（重複加算しない）。型・整形・lint成功、既存info五件は不変。初回の整形書込みはWindows制約で停止したが同じ二Fileを通常実行環境で整形し、検査警告は新規any／non-null assertionを除去して解消した。非AIpreflight・実AI・実境界E2Eの結果とは区別する。Sourceをcommitしてclean固定した後にだけ非AIpreflightへ進む。

固定Source `dff1fce85`で新品非AIpreflightを一回実行した。Directは出力10 bytes・既存Dirty／Stage／未追跡保全、Isolatedは出力12 bytes・明示固定・二親Merge・Candidate終了・Worktree／専用Ref回収まで成功した。Candidateは`b2d1188cae5bd2c319bec99e9be378709735b1b1`、Mergeは`4023a1a7ebb7de2bbe0938cc9694140728ca3ee3`。runtimeClean／workspaceClean／closeConfirmedは両方式true、Docker inventory不変、Source不変。ただしIsolated清掃Gateはfalseとなり、Toolは非0終了・fixtureRootsRemoved false。Direct Rootだけ清掃済み、Isolated Rootは保持した。これをpreflight全体又は実AI編集E2Eの成功へ換算しない。AI起動・送信は零、再試行・再起動・旧保持物操作なし。

停止後の読取りで、Isolatedはoperations／unresolvedRecoveries／pendingDeliveries／leaseIntents／workspaces零、historyPending一件、results二件、leaseEvidence十二件だった。Gitは自身のWorktreeだけ、専用Ref零、Tree clean。破棄済みWorkspaceのexact IDは`dddc620d-b230-446c-b0fb-53964618085e`、履歴待ちのidは`workspace-dddc620d-b230-446c-b0fb-53964618085e`、cleanup confirmed。Queue-aはgeneration12／cancelled、Queue-bはgeneration1／queuedで、Owner／Workspace／結果参照はnull。Task-aは未実行のready／startPhase none／retry零、実行・回復・受理参照なし。

Source照合で少なくとも二点を確認した。第一に、`writeCoordinatorWorkspaceRecord`はWorkspace記録削除時に`workspace-${workspaceId}`の履歴待ちを作るが、`maintainCoordinatorSnapshot`の退役判定はQueue又は単独採用結果だけに照合しており、今回のWorkspace履歴行を退役できない。第二に、追加した試験清掃Gateは両方式へ開始前の二Queue baselineを要求しており、Isolatedの正常破棄でQueue-aがcancelledへ進む実lifecycleを反映できていない。当時は前者を保存処理の未接続、後者を検証Toolの期待状態不一致として分離した。results二件・leaseEvidence十二件も零Oracleを満たさないが、今回GateはhistoryPendingで先に停止したため、Gate停止時点では正常な方式別終了記録か追加の退役未接続かは未分類だった。Queue-aはcancelledでもTask-aはreadyであり、既存のQueue終了判定を満たさない。各Identity・Queue・Workspaceの相関と期待する保持・退役条件を既存Ownerで確認するまで最小是正を確定しない方針とした。今回の記録を強制書換え・削除したり、Gateを緩めたりして通過させない。

保持先は `.crdd/tests/workspace-ai-20261026/preflight/isolated/` と兄弟`result.json`。2026-11-02までに既存Ownerで再評価し、未解決記録を期限だけで削除しない。非AIpreflight全条件成功の前提が成立しないため実AI編集は開始せず停止する。次は実際の破棄後状態を反例として、履歴行に加えresults／leaseEvidenceの期待保持・退役条件を分類した後に局所試験と最小是正案を確定する。

##### 保持状態の分類と試験Toolの限定是正

続く利用者指示により、保持物を読取りだけで分類した。results二件は、同じWorkspace／操作ID／候補Commitへ結合した`workspace-candidate`のadoptedと`workspace-candidate-close`のadopted／refAbsent true／cleanupFailure nullである。Merge Commitも既存Gitと一致する。leaseEvidence十二件はproject-operation五組とcanonical-adoption一組で、各Repository／Project／Queue／Owner世代／PIDへ結合したacquired→releasedの六組。実Lease親Directoryは空だった。これらは履歴搬送待ちや実資源ではなく、進行中Projectが保持する採用・終了の意味記録であり、件数零を清掃条件にしたToolの期待が誤っていた。

既存の`transferCoordinatorSnapshotHistory`は、任意の終了要約を同じ保存Ownerで履歴へ確定・読戻しした後、historyPendingだけを除去し、Queue／Project／結果等を保持する。これに対し`maintainCoordinatorSnapshot`は、終了済みQueueや通常採用結果の退役処理であり、今回のTask-ready Projectを退役しないこと自体は不具合ではない。前段の「履歴行の退役未接続」という観察を、製品機能の欠落とは確定せず、試験Toolが用途の異なる既存APIを使っていた接続不一致として具体化した。

製品Source・Schema・公開API・Lock・Recoveryは変更せず、Toolだけを既存の履歴搬送へ接続した。最初の状態書込み前に真正Ownerで今回の方式別状態をexact照合する。Isolatedでは履歴行一件、採用／終了結果二件、Lease六組、Queue-a cancelled／generation12・Queue-b queued／generation1、未実行Taskを検査し、Git二親・Tree・Worktree／Ref・実Lease不存在又は空と相関させる。転送はrecorded一件／expired零を要求し、freshな後読取りでhistoryPending零と結果・Lease・Queueの不変を確認する。Directの初期fixtureとは分け、未知・追加・欠測・相関不一致・観測不能は処置しない。今回の非AI破棄後状態に限定した確認であり、実AI終了時の追加記録へ未検証のまま一般化しない。

局所反例と静的確認は成功、HTTP検証三Suite二十六件および既存の履歴二段確定試験一件も成功した。未知履歴・余分／欠測結果・Workspace差・Lease重複／不一致・実Lease非空／観測不能・期限退役・転送後記録消失・Git親差を拒否する。独立レビューは残指摘零。初回局所不合格はVM外の空配列とVM内の空配列のprototype差であり、実Directory読取りの件数零という同じOracleへ表現を修正した。型検査の試験配列要素undefinedも明示assertで解消した。実AI送信・Docker操作・保持物の書換え／削除はこのSource検証段階では行っていない。固定Commit後、今回Isolated Rootだけに同じexact Gateを再適用し、既存履歴搬送と清掃可否を別処置として確認する。

##### 今回保持領域への適用と清掃 — 2026-10-26

固定Commit `b089fd2b31db1bd2cc89e3299b21504c4e662644`・追跡差分零を確認し、Tool本文が同CommitのGit blobと一致することを照合した。短命入口から同じ非公開Gateだけを同一Realmで呼び、ToolのmainやAI入口は実行しなかった。対象は今回の `workspace-ai-20261026/preflight/isolated` 一件に固定し、元結果と既知のWorkspace ID・Base・Candidate・Merge Commitを照合した。

Gateは `eligible: true / fixture_closed_and_unreferenced`。既存Ownerによる終了要約一件の履歴確定・読戻し後にhistoryPending零、採用結果二件・Lease六組・Queueの不変、実Lease空、専用Worktree／Refなしを確認した。Node終了後、別の削除処理でexact absolute Root・全配下reparse零・参照中Node Process零を再確認し、当該合成Rootだけを削除して不存在を確認した。結果・Leaseの意味記録を零に書き換える処置はしていない。元の失敗 `preflight/result.json` は書き換えず保持する。短命入口と空の専用Directoryも処置後に回収し、不存在を確認した。結果記録の限定独立レビューは残指摘零。

実AI送信・Docker操作・旧保持三領域の操作は零。今回の後処理成功を元の不合格試験や新品の全事前確認・実AI編集E2Eの成功へ遡及しない。次は新品の非AI事前確認から再開し、その成功後に許可範囲を照合して実AI編集へ進む。

<a id="workspace-preflight-fixed-20261026"></a>

##### 修正済みToolによる新品の非AI事前確認 — 2026-10-26

固定Source `8a9b855788583b7f54a234a5e98888c0d407c4eb`・追跡差分零で、正式Toolを `--preflight` により一回実行した。前回結果だけが残る親Directoryをexact確認し、旧`result.json`を同じ試験Root内の`preflight-before-history-fix.json`へ移動、SHA-256不変を確認してから新品を作成した。旧保持三領域は操作しない。

Tool終了零。Direct／IsolatedともlimitedProbePassed、closeConfirmed、runtimeClean、workspaceCleanがtrue。Directの既存Dirty／Stage／未追跡保全、Isolatedの候補固定・二親Merge・Tree一致・候補終了・Workspace破棄を確認した。Merge `d0f897359a3fb26ff2d214de6ed2ffd5b027a3e5`、Candidate `ad3d4f6bc8e69cb8050094857455a79cfc0acd59`。方式別清掃Gateは両方eligible、fixtureRootsRemoved true、fixtureCleanupFailures空。前後Docker一覧・構成と実行Sourceは不変であり、AI・認証・Docker資源作成／削除・再起動は行っていない。

安全な結果JSONだけ `.crdd/tests/workspace-ai-20261026/preflight/result.json` に保持し、元失敗結果とともに2026-11-02までに保持要否を再評価する。非AI事前確認の成立であり、fullE2eVerified false、実AI編集は未実施。実AI分岐は追加のsingleTask受付・結果・Lease記録を残すため、非AIbaseline専用の現在Gateをそのまま一般化せず、既存の終了記録保守との接続を次に照合する。新しい保存・回復機構は追加しない。

##### 実AI終了状態に対する試験Toolの清掃接続

実AI開始前の独立照合で、非AI専用Gateが追加の単発Task Queueを必ず拒否することを確認した。実AIが成功しても清掃不合格になる既知のTool不一致を残して送信せず、製品Source・保存形式・Task／HTTP期限は変更しない限定是正とした。

Toolは公開Task結果と同じrequestIdの単発Queue・受付Binding・completed終了要約・取得と解放が対応するproject-operation Leaseだけを追加照合する。公開結果と保存記録がcompleted／cleanup確認済み・回復参照空であること、実Lease空・Git終了条件・境界を先に検査し、既存`maintainCoordinatorSnapshot`へ一回接続して退役一件を要求する。メモリ上の比較用投影だけからTask由来の記録を分離し、実保存記録を直接書換えない。fresh読取りでTask記録だけが退役し、元Queue・Project・Workspace採用結果・Lease・Workspace履歴が不変であることを確認した後、既存履歴搬送へ進む。取消・blocked・不明・余分／欠測記録・保守拒否・予期しない退役数・搬送後消失は清掃不可とし、新しい回復機構や自動再送は設けない。

非AI反例にDirect／Isolatedの完了Task、phase／status／cleanup／回復参照／request差、履歴欠測、Lease欠測・重複、余分Queue／Binding、保守blocked・退役零／二件、退役後Task残存・Workspace結果消失を追加した。既存の実保存付きHTTP試験では、合成実行三件の終了後に本番の保守処理で三件が退役し、Queue／Binding／履歴待ち／Lease意図・根拠が零になることを確認した。生出力・認証情報は保存せず、実AI成功の根拠とは扱わない。

最終Sourceの対象HTTP三Suite二十六件は成功、整形・型・lint確認も成功した（既存info五件のみ）。独立レビューの保守blocked反例不足は追加試験で是正し、最終再確認は残指摘零。新規実AI送信・Docker操作・旧保持物操作はこの是正段階では行っていない。

<a id="workspace-edit-consent-stop-20261026"></a>

##### 実AI開始前の同意入口拒否 — 2026-10-26

対象回帰・独立再確認後の固定Source `ddee28f85`・追跡差分零で、承認済み合成範囲の正式Toolを `--external-send-confirmed` により一回実行した。Direct受付 `request-dcdd9bb7-244c-4bc1-b7ce-3f4ccdbd9b8d` は `blocked / coordinator_task_external_send_confirmation_unavailable`、executionStatus blocked、cleanupConfirmed true、recoveryIds／secondaryFailures空。実行結果がcompletedでないためToolは`edit_task_not_completed`を一次検証失敗とし、Isolatedを開始しなかった。Provider失敗やContainer作成失敗と解釈しない。

製品の初回外部送信Grantは、再利用可能な同意がなければ通常のConsole確認を必須にする。今回のTool引数は試験開始の許可確認であり、この初回同意の代替ではない。非対話の起動環境でその確認入口がunavailableを返した。下位のConsole Lock取得とConsole接続のどちらでunavailableとなったかは追加診断なしでは断定せず、CLI版・認証期限・Provider支払いを原因とはしない。次の最小手順は通常の対話端末で同意を入力することとし、確認Guardの解除や自動同意は行わない。失敗後の再実行はしていない。

Tool結果ではDirectのcloseConfirmed／runtimeClean／workspaceClean true、Docker一覧・構成と実行Source不変、追加／削除Container・Network零。読取り再確認ではoperations／unresolvedRecoveries／pendingDeliveries／leaseIntents／workspaces／results零、単発受付はsettled／blocked、historyPending一件、leaseEvidence二件、物理Lease親は空。Gitは自身のWorktreeだけで、既存の合成Dirty／Stage／未追跡三ファイルだけが残り、source.txtの変更はない。正常完了専用の清掃Gateをblockedへ拡張して消さず、`.crdd/tests/workspace-ai-20261026/edit/direct` と兄弟`result.json`を保持する。2026-11-02までに既存Ownerで失敗記録の確定・清掃を再評価し、期限だけでは削除しない。fullE2eVerified false、試験領域の清掃未完了。旧保持三領域・Image・認証・Docker再起動は操作しない。

<a id="workspace-terminal-edit-stop-20261026"></a>

##### 対話同意後の合成Direct停止 — 2026-10-26

利用者の一回再実行承認と端末内入力により、固定HEAD `c21475bbf7f737b599a0c9faa377a3924f686860`、正式Toolの新品Rootだけを `workspace-ai-terminal-20261026` へ変えた短命入口で実行した。full HEAD・clean・Tool本文blob一致、Root置換一箇所、相対importの元Tool位置基準解決、TTY必須を自己確認・独立確認した。stdin／stdoutのredirect、自動コード入力、確認Guard解除は行わず、通常端末で利用者が同意した。モデル・合成送信範囲・回数上限は前段承認を維持する。

Direct受付 `request-3d051d2f-d398-4696-89fe-a2249b66d79c` はstatus／executionStatus unknown、reason／primaryFailure `docker_process_controller_recovery_unavailable`、cleanupConfirmed false、recoveryIds四件、secondaryFailures空。Toolの一次検証失敗は`edit_task_not_completed`、failureStep verify_result、transportFailure null。closeConfirmed true、runtimeClean false、workspaceClean true、fixtureRootsRemoved false、fullE2eVerified false。Isolatedは開始せず、Task再送も行わなかった。今回の入力をAI未送信とは主張せず、実Providerの成否も確定しない。

保存状態にはCodex executor／Claude independent_reviewerのtaskAttempt零が各一件あり、各五資源のrequest identified・作成dockerId・observation absentが揃っている。しかし二操作はphase executing／primaryFailure null、execution観測unknown・ownerEffect disabled、Host cleanup not_requestedで残り、単発Queueはsettled／recovery_required、Task unknown・回復参照四件だった。operations二件、leaseIntents／配送／未解決Recovery配列は零でも、これを終了義務不存在へ読み替えない。元結果JSON内の四exact回復参照と二操作の参照は変更しない。標準bridge IDのadded／removed各一件を観測し、既存資源保持・構成同値、Container added／removed零、実行Source不変を確認した。標準bridge世代差の原因・発行者は未確定で、再起動命令は発行していない。

終了後の既存Readerによる読取り診断では`completed / coordinator_state_read_confirmed / lockReleased true`、同じ入場Inspectorは`available / coordinator_current_admission_available / lockReleased true`。そのため現在も継続するContainer作成不能や認証切れとは断定せず、失敗時の入場読取り・解放・上位Guardのどこが拒否したかは未確定とする。読み取り診断は回復・新規Effect・記録変更を行っていない。

今回Node Processの終了を確認した。短命の起動・診断三Fileと空の専用tmp Directoryは回収し、不存在確認済み。`.crdd/tests/workspace-ai-terminal-20261026/edit/direct` と兄弟`result.json`は回収未確認として保持し、2026-11-02までに既存Ownerで再評価する。未解決中は期限だけで消さない。前回同意入口拒否Rootと旧保持三領域は不変。次は外部AIなしで失敗境界と一次理由の保持を切り分け、必要な最小是正案を確定する。追加AI送信・Docker再起動・強制削除は行わない。

##### 外部AIなしの原因調査と説明訂正

利用者の調査指示により、保存状態とSourceだけを照合した。初回の`projectCurrentDockerAdmission`はHost操作生成より前に一度だけ通る。今回の二Docker操作はrecoveryCorrelationIdが同じ受付のoperationIdに一致し、Host参照も同じであるため、初回入場拒否とは両立しない。前回の「入場拒否」という説明を訂正する。同じ公開理由はControllerのProcess開始時に`beginRecovery`失敗を変換する三分岐からも返り、今回の停止は後続のDocker回復開始／結果投影へ絞られる。三本目のDocker回復参照は保存中二操作と一致せず、どのProvider・試行・内部条件で失敗したかは現在の記録だけでは確定できない。

`execution/recovery.ts`の`safeRecoveryReason`は`docker_task_`又は`host_recovery_`だけを受け付ける。一方、`beginProductionRecovery`は`docker_recovery_provider_home_lock_unavailable`、`docker_recovery_runtime_state_conflict`、`docker_recovery_operation_binding_invalid`等を発生させるため、これらは`docker_recovery_initialization_failed_closed`へ潰れる。保存失敗の`coordinator_state_…`も同様である。このfallbackは公開分類表にもなく、`publicDockerRecoveryStartReason`で更に`docker_process_controller_recovery_unavailable`へ潰れる。

正式Sourceから値変換関数だけを取り出した短命な非AI確認で、Home排他・状態競合・操作結合・終了処理結合・保存の五合成理由が同じ二段変換になることを再現した。既知の`docker_task_runtime_state_unavailable`は既存の観測不能分類を維持し、任意の例外本文はfallbackへ拒否されることも確認した。これは診断情報消失の再現であり、五候補のいずれかが今回の実原因だったという証明ではない。終了後の入場Reader正常を、失敗時の不存在証明へ使わない。

二操作のLeaseはともにreleasedだった。個別資源のabsenceと、phase executing／execution unknown／host.cleanup not_requestedは矛盾しない。Taskが保持必要と判断すると、ControllerはHost清掃意図・Host回収・Docker最終確定へ進まないためである。Lease解放やContainer／Network不存在だけからHost回収完了へ丸めず、四参照と元結果を保持する。

最小是正案は、公開の成功・失敗判定や清掃条件を変えず、回復開始時の固定・非秘密な失敗段階を既存の一次失敗診断へ接続すること。Provider／役割／試行と、取得済みの場合だけ同じexact回復参照へ結合し、ID取得前はnullを維持する。任意Error本文・Path・Capability・Provider生出力は残さず、新しいLog基盤・回復機構・再送は作らない。各失敗段階を注入した非AI試験で、公開結果・Effect・清掃判定不変と診断相関を検証してから、実境界確認の要否を判断する。この調査では製品Sourceの是正、AI再送、Docker照会／再起動、回復・削除は実施していない。読み取り専用の独立反証も上記の特定範囲と限界に一致した。

#### 固定段階の限定診断と非AI検証

上記最小案を実装した。回復開始Ownerは固定段階と取得済みの場合だけのexact参照を一回受動通知し、ControllerがHome結合と返却IDを照合する。公開Task結果・現在状態／履歴Schema・清掃条件・期限は変更しない。検証Toolだけが最大16件・一書込み4096 bytesの既知通知を取得し、既存の安全な結果JSONへ保存する。任意本文・Path・Provider生出力を記録しない。操作Identityの全照合とTask相関だけの `task_only` を分け、欠測等を成功にしない。元stderrへの復元不能では終了確認を拒否し同Processで再設置しない。

非AI回帰はCoordinator四Suite168件、Workbench四Suite31件が成功した。開始全段階、通知例外と元結果不変、偽参照、別操作、分割／連結／超過、実子Process搬送、stderr復元不能を含む。最初の制限環境ではWindows子Process終了二件とローカルHTTP試験が失敗したが、同じSource・期限の通常実行環境では全成功した。新規通知のParser検査で検出した許可keyの並び不一致は検査を緩めず是正した。両Packageの整形・型検査・lint・Coordinator設計接続検査は成功（既知infoのみ）。ArchitectureとQA-000006へ限定範囲と未保証を反映した。

独立レビューで検出した耐久Operationの事前相関除外とstderr復元代入の無反映を是正した。同じ回復IDに別Taskの耐久記録がある反例と、復元setterの例外／無反映を含む局所五件・静的確認を再実行し成功、最終限定再レビューの残指摘は零。これは診断搬送の確認であり、保持中試験の内部原因特定・回収・実AI編集E2E成功ではない。AI再送、Docker照会／再起動、回復実行、保持物操作は実施していない。過去の結果JSONも変更しない。

<a id="workspace-diagnostic-edit-stop-20261026"></a>

### 診断追加版の一回実測と停止

利用者承認により固定HEAD `e2223c180fdc4a545fb6e4f0162fee399139dfc6`、同じ合成送信内容・新Model・既存固定Imageで正式Toolを一回実行した。full HEAD・clean・Tool本文blob・TTY・新品Rootを照合し、変更は短命入口の試験Root一箇所と相対importの元位置解決だけ。入口の独立確認は残指摘零、通常送信同意の自動入力なし。開始前のEngineは応答し、固定Image三件と既存停止Container一件を読取り確認した。

Direct受付 `request-3b465438-cfa7-4ed1-9002-b2dad024c378` はunknown、一次理由 `docker_process_controller_recovery_unavailable`、cleanupConfirmed falseで停止。HTTP故障はnull、closeConfirmed true。追加診断はCodex executor／taskAttempt 1、段階 `operation_start_save`、同Task相関 `operation-cf4994bb-1824-4010-9d6e-e17ec9380b9e` を保持した。回復参照はTask結果の四参照に含まれるが、その試行の耐久操作が存在しないため `task_only` であり、完全な操作帰属確定ではない。任意例外本文・Provider生出力は保存しない。

同じTaskの耐久操作は初回Codex／Claude各一件で、各五資源はidentified／absent、Lease released。限定是正試行の開始記録保存で停止したことは観測できたが、Writerの保存拒否、候補生成・遷移拒否、読戻し・排他解放のどれかまでは未確定。`storage/settlement-store.ts`の開始保存と`storage/model.ts`の候補・遷移検査を次の非AI調査対象とする。現時点でDockerのContainer作成故障や認証切れへ断定しない。

独立読取り確認も上記の限定結論に一致した。まず開始保存の呼出し境界で既存返却のstatus・固定reason分類・保存確認・排他解放・Effect有無とthrowを区別し、候補生成系の場合だけmodel層へ進む。今回の段階だけでprepare／validateの拒否へ限定しない。新たな診断拡張・Source是正はまだ行っていない。

Isolatedは未開始、再試行・Docker再起動・Image更新・旧保持物操作なし。今回前後のContainer／Network追加・削除は零、既存資源保持・構成同値・Source不変。これをHost終了や回収完了へ読み替えない。安全な結果は `.crdd/tests/workspace-ai-diagnostic-20261026/edit/result.json`、合成Rootは同じ親の`direct`に四exact回復参照とともに保持する。2026-11-02までに既存Ownerで再評価し、期限だけで削除しない。今回Node Process零を確認後、短命の起動二ファイルと空の専用tmp Directoryを清掃し、不存在を確認した。

#### 外部AIなしの開始保存調査

実装上の不整合を純粋関数で再現した。`recordRuntimeOwnedDockerProviderSubmission`は要求前にproviderStart／externalSend／sharedWriteをunknownへ進める。一方、正常復帰のcheckpointはLease解放とownerEffect disabledを保存するだけで、三値を維持する。同じHomeの次Operationを追加する`validateCoordinatorStateTransition`は、旧操作の三値のどれかがunknownなら拒否する。別Homeはこの比較対象外である。

実保持状態からCodex初回操作を有効な最小Snapshotへメモリ内で移し、同Host・同operationIdのattempt1追加を本番候補生成関数で確認した。元状態のunknown三値では拒否、三値をstarted／issued／possibleとした合成反例だけ受理、各一値をunknownへ残した三例はいずれも拒否。五例とも入力Snapshotは有効で、元ファイルのbytes不変を確認した。最初の試験器はIdentity終端改行と凍結値のclone不足で停止し、その試験器だけを修正した後の五例である。製品Source・保持記録は変更していない。

構造的な確定接続の不足は独立読取り確認でも支持された。今回のattempt1保存停止と一致する有力原因だが、当時のWriter返却理由・内部branchは未観測であり、このGuardが唯一の実拒否行だったとまでは断定しない。

最小案は、元attemptの真正な観測が生きている終了・清掃処理で、三値を各々の証拠から同じ回復参照へ既存Writerで確定すること。Process開始だけで送信発行や書込み可能性を推定しない。観測欠測・保存失敗・排他解放不明はunknownを維持し、Guardを緩めない。新State・Lock・回復機構は不要と見込むが、各証拠との接続は実装前に照合する。旧保持状態を新Sourceから遡及補完しない。AI再送・Docker操作・回復・削除・実装変更は未実施。短命の純粋試験器だけを実行終了後に清掃した。

#### 三値の確定根拠の追加調査と提案訂正

前段の「真正観測を既存Writerへ確定接続するだけ」という最小案は、その観測が既に揃うことを前提としていた。実SourceとArchitectureを照合した結果、この前提は成立しない。`session.ts`のexecutionStartedは`process/start.ts`のDocker子Processのspawn観測であり、Provider内部の開始・外部送信・共有書込みを個別に証明しない。完了出力や回収も同じである。`01_Architecture.md`の要求前checkpoint契約は、これらを三値の既知化根拠としないことを明記している。したがって、三値の推測補完や現在の意味のままの一括既知化は行わない。

既存の同Host継続試験の正例はnot_started／not_issued／not_issuedの未実行形だった。unknownの拒否試験はあるが、実行済みの通常継続が成立する正例ではない。これは検査漏れだけでなく、「過去Effectの発生が未確定」と「現在の旧実行資源が終端済み」を同じ継続拒否条件へ混ぜた契約上の不整合である。

次の検討は、過去のunknownを保持しつつ、同じTask・同じHostの通常継続だけを既存の真正技術終端に基づいて許可できるかである。旧Process終了、Container／Network不存在、Mount終了、Home排他解放、旧OwnerのEffect不能、対象Identity一致と旧記録不変を省略しない。別Task／別Host／Owner喪失後の回復へ一般化せず、保存値だけから処置Authorityを生成しない。既存の拒否契約とその試験を変更する判断なので、現時点では候補であり未実装。Provider内部の通信・書込み監視Frameworkを新設して三値を埋める案は、今回の簡素化目的に対して非推奨とする。AI・Docker・保持物の操作は行っていない。

追加で既存の限定是正経路を確認した。Controllerは同じ生存Owner内でReviewer完了・changes_requested・findingsありを確認し、閉じたReviewer結果から作る短命remediation CapabilityをExecutor attempt1の準備時に一回消費する。Owner喪失後にこのCapabilityや未発行stageを復元しない。通常限定是正と結果不明の自動再送は既存経路で区別できるため、新たな耐久Reviewer判断やRegistryを追加する必要はない。

変更候補は、この既存の一回限定是正の真正な接続と技術終端が共同成立する同Owner内継続だけ、過去unknownをHome再利用条件と分離すること。`taskAttempt === 1`だけで許可せず、既存のPacket／PreparedPlanと生存Ownerの相関を開始保存まで保つ。再編集後のReviewer attempt1も同じHomeへ戻るため、Executorだけの例外で閉じず、再レビューまでの既存制御鎖を対象に照合する必要がある。偽Capability・再利用・別Task／Host・Owner喪失・結果不明・資源や義務残存は従来どおり拒否する。これは既存の拒否契約を変更する候補であり、未採用・未実装である。

#### 三判断分離の採用と最小実装

利用者は、Effect履歴・旧実行の安全性・新試行の実行許可を別判断とする方針を採用した。着手前のSource再照合では、開始保存の本番呼出しが回復開始一箇所であり、その前に既存のPreparedPlan一回消費・Revision・Provider Authority・Packet・送信許可が検査されることを確認した。Writerにも新しいAuthority Contextを重ねる案は不要な防御重複として不採用とし、永続State・Registry・Lock・Writer引数・公開DTOを追加しない。

値モデルでは、既存の同Host通常技術終端条件をすべて維持し、その条件が成立する旧操作だけ三値のunknownを過去履歴として分離した。同operationに加えrecoveryCorrelationId一致も確認する。旧Identity・三値・保存Schemaは変えず、別Host・別Task・通常Recoveryでの三値参照は維持する。実行制御側ではchanges_requested後に既存の非消費Candidate検査を再利用し、Workspaceと前結果の差があれば是正前に停止する。最終レビュー後の既存検査も残す。

新しい非AI結合は、本番Task制御から本番の純粋保存値検査へ接続し、Providerと物理Writerは代役である。unknown三値・identified／absent資源を持つCodex→Claude→Codex→Claudeを通し、Lease・Owner・資源・義務・Task・相関・Host差では次Provider代役Effect零、Workspace差は是正前停止を確認した。値モデルでは三値の八組合せと旧操作完全不変を確認し、従来の技術終端条件の負例は維持した。これは実Writer全体や実AI E2Eの成立証明ではない。

初回回帰では必須のNode module mockフラグ不足と、追加された是正前検査が既存の最終検査用故障注入を早く発火させる追従漏れを分離した。起動条件を正式条件へ訂正し、故障時点を指定できる試験局所counterを追加した。最終レビュー後故障を意図する基底二ケースだけ時点二へ追従し、新しい是正前差の反例は既定の時点一を維持する。是正後の非AI通常回帰七Suite291件と静的・設計接続検査は成功、独立レビューと試験追従再確認は残指摘零。

正式条件のWindows専用22件は9成功・13失敗で完走し、不合格として保持する。失敗はOwner再入場Suiteに集中した。開始・保存監視が旧recovery Moduleを対象にしており、本体を監視設定前に同じqueryで先読みしていた接続不一致を、現在のHost提出Ownerであるcontrollerへの監視へ追従した。また、正常Owner三件は試験用に抽出したHost終了関数の依存`hashExecutionSelection`が試験Moduleに未importで、関数内のcatchによりhost_completion_invalidへ閉じていたため、試験側importを追従した。製品Source・期待する拒否結果・終了条件は変更しない。

追従後のOwner再入場13件は560,272msで全成功した。旧Owner終了五境界、認証create通常例外五段階、正常Owner一回・保持あり一回・同Home二回の三形で、既存の拒否Oracle、元記録保全、Home解放、Host清掃、結果保存まで確認した。最終候補の非AI通常291件も再実行して全成功し、型・整形・lint・Trace検査と限定独立確認は成功／残指摘零。Windowsの先行成功9件と合わせて今回の対象313件は確認済みだが、単一runの全体回帰成功ではなく、実Docker・実AI E2Eの証明でもない。失敗した自己生成試験Rootは強制清掃せず、既存の実AI保持物とは区別して保持する。

今回の二回の不合格実行が残した自己生成Rootは、Repository内`.crdd/tests/`直下の次の25件である。各Rootの状態記録とHost参照は書き換えず保持し、2026-11-02までに非使用・由来・終了義務を確認して清掃判断へ戻す。期限だけで削除しない。修正版の新品試験はこれらを再利用しない。

| 発生した実行 | Root名（すべて`.crdd/tests/`直下） |
| --- | --- |
| mockフラグ不足の初回 | `abandon-owner-nffJWy`、`abandon-owner-MFR593`、`abandon-owner-GoMEe5`、`abandon-owner-xDfyIT`、`abandon-owner-MStyS6`、`auth-create-failure-ZHZkt1`、`auth-create-failure-73GDS8`、`auth-create-failure-Prmqfz`、`auth-create-failure-lOvLtP`、`auth-create-failure-qlBEtZ`、`normal-owner-OvzcEM`、`normal-owner-VTOHzU` |
| 正式フラグで接続不一致を確認した実行 | `abandon-owner-uGFuxx`、`abandon-owner-e291Uf`、`abandon-owner-AKHSIV`、`abandon-owner-Phbu57`、`abandon-owner-YQmXET`、`auth-create-failure-M0AqqR`、`auth-create-failure-yt86aV`、`auth-create-failure-E0kUcm`、`auth-create-failure-WN80bg`、`auth-create-failure-z1x1fG`、`normal-owner-NSWRsM`、`normal-owner-XrstZ0`、`normal-owner-tuOXxu` |

Architecture DetailとQAへ原則・Owner・検証義務を反映した。実AI再送・Docker操作・保持物変更は行っていない。今回の是正を過去のE2E成功や、保持中の四回復参照の終了へ遡及しない。

<a id="settlement-io-yield-20261026"></a>

### 成功受領後のI/O制御返却 — 限定実装・非AI対象回帰完了

利用者の継続指示に基づき、十五秒期限を変えず同期受領の連結待機だけを縮小する。着手前に、各receipt成功時には既存Writer排他が解放済みであり、Host／Home技術処置も終了済みであることを照合した。独立確認の条件を反映し、成功receipt後にだけNode標準setImmediateをawaitする。失敗時のretain＋blocked、finalize・handoff・Host再観測、取消完了待機の順序は変更しない。新Queue・Worker・timer期限・Lock・回復Stateは追加しない。

実Controllerの通常／途中取消／receipt拒否を局所反例とし、callback時の受領件数・Provider起動件数・全終端を検査する。三Stage実Writer試験ではServer受信後の初回保存→I/O返却→HTTP finish→後続保存を測る。単純loopback応答の測定であり、前回実AI原因・Workbench全画面・単一receiptの最大遅延の保証ではない。初回型検査では試験の既存getter名と取消unionの絞込みを追従し、修正後静的検査・Traceは成功した。この時点では、局所・回帰・最終レビューは未確定だった。外部AI・実Docker・過去保持物は操作しない。

最終候補の局所二件（Controller三反例を含む一件・三Stage実Writer／HTTP一件）は成功、Coordinator対象323件・Workbench対象四Suite35件は全件成功した。既存Windows実Writer三形（一回・一回の自己生成保持fixture・二回）も再実行して全件成功し、三回形と合わせて四形を現候補で確認した。今回生成の試験物は既存の各cleanupで回収し、過去保持物には再入場しない。両Packageの静的検査・Trace、差分空白検査は成功。限定独立レビューでSource／試験の指摘は零、文書Minor二件（全Stageへの適用と前候補測定の時制）を是正した。

現候補の三receiptは5,951／6,262／5,651 ms、finalizeは各0 ms（時計分解能内）。Server受信1793007218010、初回receipt終了1793007223966、Server finish1793007223970、次receipt開始1793007223975となり、初回成功後にHTTPへ制御を返したことを確認した。子Clientは開始1793007217994、ヘッダー1793007223972、本文完了1793007223974で通信5,980 ms。親のclose観測は1793007235897（開始から17,903 ms）で、子の通信完了時刻と同一視しない。十五秒は通信期限のまま、既存の親Process終了確認期限も変更していない。制御返却前の13,671 msとは別runで負荷も異なり、一般的な性能改善率へ換算しない。単一同期保存の最大時間・親側待機の全面解消・前回実AI原因・編集E2E成功は未保証のままである。

<a id="settlement-finalization-reuse-20261026"></a>

### 終了確定の二重保存是正と非AI確認 — 限定実装・対象回帰完了

利用者は同Ownerの確定済み結果再利用、非AI複数Stage・並行HTTP・局所回帰を承認した。AI再送・実Docker・保持物操作は対象外。変更分類は既存終了処理の限定是正で、Source・直接利用側の独立レビューとArchitecture／QAの直接追従を行い、規範・Release変更ではないため全体準拠／Release監査は追加しない。着手前確認ではcompletedだけを使用し、blocked／欠測の再入場・transient退役・durable保持・全Writer条件を維持することを照合した。並行照会は子Client起動だけでなくServer到達を先に確認するとの独立指摘を計画へ反映した。

受領関数が既に終了driverを実行するため、全受領後のfinalizeによる再保存は先行Stageの古いSnapshotを再使用していた。実宣言とWriter拒否述語のメモリ再現で単一Stage成功・三Stage先頭拒否を確認したが、当時の拒否行を直接記録したものではない。最終確定関数は同じ私有Ownerの既存settlementResultがcompletedの場合だけ再利用する。新State・Lock・Cache・Registryは追加せず、受領契約、Writer、Schema、十五秒期限を変更しない。

既存実Writer／Host試験へ三回形を追加し、本番と同じ全受領→全確定へ変更した。同時に単純loopback Server・既存子HTTP Clientで、Server受信後の同期保存と応答の順序を有限時計で確認する。これは実DockerやWorkbench全画面Routeの実証ではない。初回型検査は試験内の循環推論一件で停止し明示型へ追従、続くLintは新規non-null assertion六件を拒否したため実在assertion／ローカル参照へ修正した。修正後Coordinator静的確認・Traceは成功（既存info八十四件）。この時点では、局所・回帰・最終独立レビューは未確定だった。

確定結果は、局所三件成功、Coordinator対象三百二十二件成功、既存Windows実Writer三形（一回・一回の自己生成保持fixture・二回）成功、Workbench四Suite三十五件成功。局所三件には新規のWindows三回形を含み、既存三形と合わせて実Writer四形を確認した。各試験は今回自己生成した領域を既存cleanupで回収し、実Docker・認証・過去保持物を使用しない。両Packageの型／整形／LintとCoordinator Traceは成功（既存infoはCoordinator八十四件・Workbench五件）、限定Source／試験／文書の独立再レビューは残指摘零。これらを単一runの全製品QA又は実AI編集E2Eへ換算しない。

三回形の受領時間は4,555／4,587／4,480 ms、最終確定は各0 ms（ミリ秒時計の分解能内）。Server受信時刻1792998206199、Client開始1792998206178、ヘッダー受領1792998219847、本文完了1792998219849で、Client観測は13,671 msだった。十五秒内に完了したが余裕は小さい。三回形は全件確定成功、最終確定前後のstate／history Byte不変、元Capability退役と複製拒否を確認した。blockedの再入場・durable配送待ち保持・driver非再実行も局所反例で確認した。HTTP十五秒Timeoutの唯一原因・性能余裕・実AI再試験成功は未証明で、同期保存による待機余地は残る。期限延長・新Route・Worker・追加待機Gateは実装せず、今回の許可範囲内に未処置のレビュー指摘はない。

<a id="workspace-candidate-diagnostic-once-result-20261026"></a>

### 候補診断付き合成編集の一回実測 — 2026-10-26

利用者承認に基づき、固定HEAD `482e20736b74680b606a76a20e8808dba3754d10`、新品`.crdd/tests/workspace-ai-candidate-diagnostic-20261026/`で正式Toolを一回実行した。変更分類は既存Capabilityの限定実境界検証。Source・上流契約・Releaseを変更せず、起動前の独立確認と結果の限定確認を行い、全体準拠／Release監査は追加しない。短命入口はHEAD・clean・Tool blob一致、Root定数一箇所の変更と相対importの元位置解決、非AI事前確認成功、通常同意のTTYを検査した。Engine正常・固定Image三件存在・既存停止Container一件だけを開始前に読取り確認し、起動／再起動・Image取得更新は行っていない。

非AI事前確認はDirect／Isolatedの両方でlimitedProbePassed／closeConfirmed／runtimeClean／workspaceClean true、fixtureRootsRemoved true、SourceとDocker一覧・構成不変で終了0。実AIは同じ合成Context・編集指示、Codex `gpt-6.1-sol / medium`・Claude `claude-opus-5-5 / medium`を使用した。通常四起動・既存の限定是正と再レビューを含め最大八起動の枠を維持し、失敗後再送には使わない。

Direct受付`request-bed933b3-e70e-4606-90ff-85cbfa4f52d6`は状態観測のHTTPヘッダー未観測で15秒Timeoutとなり、Toolが同じTaskへ取消要求を発行した。Tool一次失敗は`workbench_verification_transport_failed`、段階observe、分類headers_unobserved。取消後に観測したTaskはunknown、公開reasonは`orchestrator_task_body_unavailable`、一次失敗は`coordinator_task_docker_recovery_finalization_unconfirmed`、cleanupConfirmed true、回復参照・副次失敗は空だった。Isolatedは未開始、Tool終了2、fullE2eVerified false。再試行しない。HTTP待機の根本原因とTask終了確定不成立の内部原因は、今回の結果だけでは一意に確定しない。

回復開始診断・候補検査診断はそれぞれcaptured／event零／closed trueで、候補拒否分岐は観測されていない。履歴三件は同じ操作`OP-311010843947136282006477860000012706102`・Task相関`operation-f7ba5599-5fcd-4c16-8b79-7c9331575706`に属し、二件のprovider_operation_completedと一件のprovider_operation_cancelledを持つ。各Host清掃はconfirmed、Owner Effectはdisabled。完了二件のproviderStart／externalSend／sharedWriteはunknownを維持し、履歴だけからProvider内部Effect成立やStage役割を推定しない。取消履歴の三値はnot_started／not_issued／not_issuedだった。

今回Rootの状態再観測ではoperations／unresolvedRecoveries／pendingDeliveries／leaseIntents／workspaces／resultsは零、queue三件・historyPending一件・leaseEvidence四件だった。対象受付はsettled／unknown、終了要約はfailed／cleanup confirmed。合成source.txtの期待変更はなく、Git差分は元のdirty／stage／未追跡三ファイルだけで、内容とStage対象は保全されている。今回Root・操作ID・既知PIDに一致するNodeは後観測で零。ToolのruntimeClean／workspaceClean／closeConfirmedはtrueだが、Task unknownを全体成功やRoot廃棄可能へ読み替えない。

Docker後一覧は元の停止Container一件だけで、試験Container・専用Networkは残っていない。標準bridgeのIdentity変更は観測されたが、構成同値と既存利用者資源保全は確認されており、変更主体・原因や再起動実施を推定しない。Source不変。正常完了専用の清掃Gateはunknownへ拡張せず、`edit/direct`と兄弟`edit/result.json`を保持し、2026-11-02までに同じ受付・既存Ownerで保持要否と安全な清掃条件を再評価する。期限だけでは消さない。生出力は保存せず、過去保持物・認証領域・既存Dockerデータは操作しない。短命入口二件は外部端末終了後の非使用・exact範囲確認を経て回収する。

結果・状態・履歴と二文書の限定独立確認は残指摘零だった。試験用Node終了後、今回専用端末のIdentityと子Process不存在を照合して端末を終了し、短命入口二件の既知集合・非使用・exact Root・非reparseを再確認した。今回tmp内の二Fileと空の専用Directoryだけを清掃し、不存在確認済み。合成Root・結果・履歴は保持し、実行資源の終了確認を試験全体成功へ換算しない。

<a id="candidate-validation-minimal-diagnostic"></a>

#### 候補拒否の最小診断是正 — 限定実装・非AI対象回帰完了

利用者承認により、候補取得拒否と申告Path不一致を既存の受動Lifecycleへ通知する。変更分類は診断搬送の限定実装であり、Architecture DetailとQA-000006へ検証義務を接続する。着手前の独立確認で、event名をcapture失敗だけに限定しない名称へ修正し、現在操作の完全帰属と履歴・Taskだけの帰属を分け、stderr取得器を二重化しない方針を確定した。Source／直接利用側と対象文書の独立確認を実施し、準拠基準・Releaseを変更しないため全体準拠／Release監査は追加しない。

既存の実行観測検査を`execution/result.ts`へ共用化し、初回／是正の共通候補拒否だけ固定分類・件数・Path一致・非秘密実行観測を通知する。Task DTO／耐久Schema／拒否理由／Authority／cleanupは不変。検証Toolの既存取得器を`workspace-task-diagnostic.ts`へ改名し、一設置で二診断を取得する。bounded履歴Readerと既存Decoderを使用するが、履歴からProvider・役割・試行を復元しない。AI再送・実Docker操作・保持物の読取り／変更は行わない。

初回のcollector局所8件は7成功・1失敗で、既存のSource本文抽出試験が新しい履歴読取りまでを取り出して依存を欠いたことが原因だった。操作Identityの抽出範囲をそのループだけへ追従し、履歴の限定投影は別の合成境界として確認した。修正後8件とTask拒否診断の局所一件は成功。両Packageの型・整形・lintとCoordinator Trace検査は成功。最終回帰・独立レビュー前であり、完成や実AI原因確定とはしない。

初回の対象回帰はCoordinator九Suite322件・Workbench四Suite34件すべて成功した。独立レビューの履歴相関指摘に対し、検査済み回復IDを投影へ加え、同一操作・Taskの異なるStage履歴は許容し、同ID重複は拒否するよう是正した。併せて両診断frameを既存の曖昧性拒否Parserへ接続し、event完全一致を検査した。Header二箇所も追従した。是正後の局所九件・Workbench静的確認は成功。最終回帰と再レビューは別に確定する。

最終結果はWorkbench四Suite35件が全件成功。Coordinator対象九Suite322件は上記結果を維持し、その後のCoordinator変更はHeaderコメントだけで、静的確認・Trace検査を再実行して成功した。両Packageの静的確認は成功（既存infoはCoordinator84件・Workbench5件）。限定独立再レビューは残指摘零、差分空白検査も成功した。レビュー是正後の複数Stage履歴・同ID重複拒否・曖昧JSON拒否を含む。Windows専用実境界、実AI、Docker実境界は今回実行せず、全体E2Eや過去失敗の一意原因確定とはしない。診断は次の許可された実行でのみ取得可能であり、過去記録へ補完しない。今回の依頼範囲内に未処置指摘・人間判断はない。

<a id="workspace-continuation-edit-stop-20261026"></a>

### 三判断分離後の合成編集一回と候補検査停止 — 2026-10-26

利用者承認により固定HEAD `a5afae98e042cc7eac9be16548e9882643254539`、既存固定Image、同じ合成送信内容で正式Toolを一回実行した。新品Rootは`.crdd/tests/workspace-ai-continuation-20261026/`。短命入口はfull HEAD・clean・Tool blobを検査し、正式ToolのRoot一箇所と相対importの元位置解決だけを変更した。通常送信同意の自動入力やredirectは行わず、TTYを必須とした。開始前独立確認は残指摘零。

先に非AI事前確認を実行し、Direct／Isolatedの既存変更保全、候補固定・二親Merge、終了・清掃が成功した。両方式のlimitedProbePassed／closeConfirmed／runtimeClean／workspaceClean、fixtureRootsRemoved、sourceUnchangedはtrue、清掃失敗は空、Docker一覧・構成は不変で、AI起動零だった。結果は同Rootの`preflight/result.json`に保持する。

実AIのDirectは`request-b5e555b3-beaf-431d-88c9-ef691f88726f`、`blocked / coordinator_task_candidate_revision_invalid`で停止した。Codex Executor attempt0のStageはcompletedを返し、その後の候補取得・申告整合の共通Gateで拒否された。過去三値はunknownを維持し、Provider内部開始・外部送信・共有書込みの成立を推定しない。Claude Review・限定是正・再Review・Isolatedは未開始。合成`source.txt`は`BASE`の一行のままで、期待する`DIRECT_OK`への変更はない。Git上は元のdirty／stage／未追跡三ファイルだけだった。候補取得自体の不成立と、Provider正規化結果の状態／changedPaths不一致のどの条件だったかは今回の有限診断に含まれず、CLIが編集しなかった理由やMount故障とは断定しない。生出力は保存・追加取得しない。

HTTP transportFailureはnull、回復開始診断は捕捉済み・event零。TaskのcleanupConfirmedとcloseConfirmedはtrue、回復参照・副次失敗は空。実保存の操作履歴一件はprovider_operation_completed／Host清掃確認済み／Home解放済みで、現在のoperations／unresolvedRecoveries／pendingDeliveries／leaseIntentsは零だった。後読取りでも試験Node零、Containerは元の停止一件だけだった。標準bridgeのIdentity変更は記録され、構成同値・既存利用者資源保全は確認されたが、発生主体・原因は未特定であり、Docker再起動を実施したとは扱わない。Sourceは不変。Toolは終了2、fullE2eVerified falseであり、前回の限定是正開始問題の実AI反復も未評価のままである。

blocked結果のため正常完了専用の清掃Gateは適用せず、`edit/result.json`と`edit/direct`を保持した。Queue三件・historyPending一件・Lease根拠二件が残り、合成Rootの清掃完了とはしない。2026-11-02までに同じ受付参照・既存Ownerで保持要否と清掃条件を再評価し、期限だけでは削除しない。旧保持Root・記録・認証領域は操作せず、AI再送・Image更新・Docker再起動・修復も行わない。

試験Node不存在とexact Rootの通常File二件だけであることを再確認後、今回の短命起動File二件と空の専用tmp Directoryを清掃し、不存在を確認した。結果・状態・履歴・合成Treeは変更しない。結果とSource相関の独立確認で、Stage completedをProvider内部Effect成立へ読み替えない表現へ是正した。

<a id="new-model-ai-once-results-20261025"></a>

### 新Model読取り各一回と編集停止 — 2026-10-25

利用者の1〜3対応承認により、固定Source `59cd8ec3d068d33c2acd05a3f3f5acfec34ccb97`、既存固定Image、合成Contextだけで正式読取りToolを各一回実行した。実行前の閉じた結果検査・有限子Process管理・入力前後照合を独立確認し、残指摘零。生Provider出力・回答本文・認証情報は保存しない。

| 対象 | 観測結果 |
|---|---|
| Codex | `gpt-6.1-sol`／medium、受付 `request-c2e05fb2-bcf5-4f46-b8df-5d9f134b3a47`。Tool終了0、Task／実行completed、limitedProbePassed true。Context 847 bytes／SHA-256 `6d76125e412f646539c8570d324309e3610c467f39c6b2be51e2a51854bc270e` |
| Claude | `claude-opus-5-5`／medium、受付 `request-21109a57-fd8b-49f1-b646-3fb87d0d1e08`。Tool終了2、Task／実行completedだが、observeで `workbench_verification_transport_failed`／`headers_unobserved`／transport timedOut true。取消要求・結果観測あり。limitedProbePassed false。Context 848 bytes／SHA-256 `4299bae2e2fffb7ebd929cb6d5a789b232ff364d943cf7b1a228ad9b7f15f6f0` |
| 共通終了条件 | cleanupConfirmed／closeConfirmed true、回復参照・二次失敗空。本体HEAD／Tree、合成Context／Tree、選択設定・六入力Hash不変。Task成功と検証通信成功を混同しない |
| Docker | 既存停止Container一件保持、試験専用Container／Network残存零。Codex実測では標準bridge ID世代差（added／removed各一件）を検出したが既存資源保持・構成同値を確認。Claudeでは一覧不変。再起動命令は発行せず、bridge世代差の原因・発行者は未確定 |
| 編集E2E | 読取り両方成功の前提を満たさないため未実施。AI起動は合計二回、再送零。Direct／Isolated、候補固定・Mergeを新Model実AIで確認したとは扱わない。fullE2eVerified false |

保持中 `.crdd/tests/new-model-ai-20261025/preflight/isolated` のWorkspace `4f55ea10-d6bf-42aa-9eb4-24d1828fd0a8` は、固定Candidate `601376f758327de25eb12e1766d5eac9c5e04d86` のmerged状態を再確認し、既存close-candidate（adopted）・discardで終了した。処理成功を旧試験全体の成功へ遡及しない。今回の未解明通信Timeoutは次の非AI調査対象とし、AI再試行・Docker再起動・未知記録の強制削除は行わない。

#### 保持物の正式整理と残存

既存の履歴maintenanceを各試験Rootで実行し、返却statusだけでなく保存Ownerによる実状態を再確認した。削除対象は以下の `.crdd/tests/` 相対Path九件に固定し、canonical absolute Path一致・全配下reparse零・参照可能な試験Process零、operations／unresolvedRecoveries／pendingDeliveries／historyPending／leaseIntents／workspaces零、自身以外のGit Worktree・専用Ref零を確認した。独立再確認の残指摘零の後、一件ずつ削除して直後の不存在を確認した。親Directoryと今回の安全な結果JSONは対象外。

- `new-model-ai-20261025/preflight/direct`
- `new-model-ai-20261025/readonly-codex`
- `new-model-ai-20261025/readonly-claude`
- `workspace-real-ai/direct`
- `claude-readonly-turn-acceptance-20261025/readonly`
- `claude-readonly-turn-diagnostic-20261025/readonly`
- `claude-readonly-reauth-20261025/readonly`
- `claude-readonly-confirm-20261025/readonly`
- `claude-readonly-diagnostic-20261025/readonly`

次の三領域は清掃未完了であり、回収完了としない。2026-11-01までに既存Ownerで再評価する。未解決記録を期限だけで消さず、今回新しい回復機構は追加しない。

| 保持する試験領域 | 現在の理由 |
|---|---|
| `new-model-ai-20261025/preflight/isolated` | Workspace／専用Worktree／Refは正式回収済み。他の五義務は零だがhistoryPending一件が残る。maintenanceのcompleted返却を全記録確定へ読み替えない |
| `workspace-real-ai/isolated` | operations／recoveries／deliveries／leaseIntents／workspaces零、追加Worktree／Ref零だがhistoryPending一件が残る |
| `claude-readonly-once-20261024/readonly` | 元のexact Docker回復参照で既存recoverExecutionを一度実行し、`blocked / docker_task_recovery_resource_unconfirmed`。cleanup未確認のため元unknownと参照を保持。再起動・強制削除なし |

保持するexact回復参照は `docker-task.29c9921916f3a63170e77179d3145c8627a2b3519d5813b7c9cf2a87d136d9aa.776fa54649f45e47f6b0673986d25c3963883205ac2c144a3fd34a32f1df9008.ff809c3737cf2973c3cb1b99289f759d8e1ae3f6f3100d9c6ed5bc8273b6c667`。削除可否の観測と正式回復以外の製品Source変更はなく、追加AI試験・Docker再起動・Image更新・新しいLock／Recoveryは行わなかった。

<a id="claude-turn-count-minimal-diagnostic"></a>

### Claude助言Turn数の最小診断と非AI検証 — 2026-10-25

利用者指示に基づき、基準`f266e6edb`から既存の一次失敗へ任意の`turnCountDiagnostic`を追加した。AI Adapterが成功EnvelopeのTurn数拒否時だけ、`valueType`（missing／null／boolean／number／string／array／object）と`numberText`（有限数値をStringで正規化した表記又はnull）を抽出し、Controller・現在状態・履歴・実Provider検証Toolへ同じ値を搬送する。数値表記は最大32文字・canonical・有限・受理範囲外を検査する。非数値は実値を複製せず、欠落はmissingで区別する。既存状態encoderが整数限定のため小数は数値表記で保持し、共通encoderや保存Schema版は変更しない。

診断は`start_provider_attached`／`provider_result_normalization`／`workbench_ai_claude_turn_count_invalid`／同じ応答の終了0へ相関させる。次Commandの局所診断は消去し、既に固定した一次失敗は後続cleanupで上書きしない。新しい監視・State・Log・回復機構は作らず、1〜2整数の受理条件・CLI引数・認証・実行許可・取消・回収判定は変更しない。過去の記録欠測は補完せず、今回の診断追加から先行実値を復元したとは扱わない。

検証は、欠落と各JSON型、0／3／小数、別の拒否理由への非残留、任意文字列・Object本文の非流出を実Controllerから確認した。状態の実Validator・履歴JSON往復、検証Toolの実子Processでも、正常値と余分field・不正型・非canonical数値表記・有効範囲1〜2・用途／段階／理由／応答相関違反を照合した。初回局所三件は状態encoderの小数拒否で一件不合格、数値表記への是正後はTool fixtureの旧数値型一件を追従した。修正版の局所三件は全成功。影響回帰はController／Tool二Suite156件、状態契約一件、AI Adapter全24件が成功した。局所三件のうち二件は156件と重なるため加算しない。

Architecture二文書と既存QA-000006／ERB-IT-002・003へ反映した。実AI再送・Docker操作・認証情報読取り・保持物の変更は行っていない。次の実測には新しい一回の送信判断が必要であり、先行試験や全体E2Eを成功へ変更しない。
