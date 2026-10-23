# Coordinatorの公開操作・認証・AI選択の再設計計画

状態: Objective六Sourceへ実装移管済み。直接回帰と独立確認は成功、長い受付／回復結合を継続。新API／CLI／認証／設定は未実装。
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

現行の本番`public-*.ts`は次の三Fileである。名称を含む試験Fileは、この本番Owner整理を理由に機械改名しない。

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

長い全受付・Task連携・取消／回復の連続回帰は実行中で、この表を全体完走結果に拡張しない。初回短回帰では型辺走査がSymbolを一件ずつ返す仕様への追従不足で1件不合格となったが、許可名と型専用制約を維持した是正後の29件を上記の最終結果とする。四添付全体と実境界E2Eの完成ではない。
