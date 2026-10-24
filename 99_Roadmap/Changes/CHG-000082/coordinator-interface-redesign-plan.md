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
