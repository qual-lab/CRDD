# 公開ObjectiveのProfile搬送漏れと試験登録の是正

成果物種別: 変更の設計・検証記録
変更ID: `CHG-000082`
基準Commit: `b72ef1632c7fc685b88c5fdb0c82ef8a19f44450`
記録日: 2026-10-02
維持責任者: Qual-Lab

## 結論

公開Objectiveの入力検査が明示Profile IDを拒否し、Coordinator Taskを作る処理もIDを搬送していなかった。既存のProfile選択意味を接続するため、任意の`requestedProfileId`を公開入力へ追加した。公開Source契約の実差分であり、「契約無変更」とは扱わない。Authority、成功、Recoveryおよびモデル選択Policyの意味は変更しない。

静的確認と局所117件は合格した。試験一覧との照合で、先行追加したHost残存候補判定UTの未登録も検出して是正した。**PRL-UT-014全体、PRL-IT-012、全入口の実行、実Provider、実Recoveryおよび全体品質は未成立のまま。** 新しい実Taskの停止とWindows再起動方式の判断待ちは維持する。

## 変更経路と着手前確認

| 項目 | 確認・処置 |
|---|---|
| 分類・意図 | 同じ未リリースCHGの実装接続Gap是正。既存品質定義が要求する明示Profile搬送を接続する。 |
| 根拠 | [QA-000003／PRL-UT-014・PRL-IT-012](../../../../07_Quality/Definitions/QA-000003/quality_definition.md)、[AI Runtime詳細設計§3](../../../../06_Architecture/Details/ai-runtime/01_Architecture.md#3-公開入口と依存方向)、SPEC-000011、ARCH-000012。 |
| 着手前整合確認 | 親の正本照合と別の読取り専用確認者が技術、工程境界、品質／影響を確認し、計画修正付き着手可とした。公開契約差分の明記、Workbenchとの操作区別、局所結果の限界を計画へ反映した。 |
| 書込み範囲 | 現在Repositoryのみ。`.crdd`は非秘密の検証記録としてGit管理外へ保持する。 |
| 不変範囲 | 認証、取消、Authority、公開結果、Catalog／Model、既存Resolver／Route／Grant、Executor限定指定、旧署名候補、品質件数およびHost停止。 |
| 必須確認 | 同じ固定差分への技術独立レビュー、文書監査、品質／不足影響確認。 |
| 今回行わない確認 | 実Provider・実CLI／stdio／HTTP・実Host Recovery・全回帰・再署名は停止Gateのため未実施。局所結果で代替しない。準拠基準とRelease判断を変えないため準拠監査を追加しない。 |
| 人間判断 | この既存意味の搬送是正に新しい採用判断は不要。旧形式非使用の方式採否、実再起動、実削除は別の判断として保持する。 |

## 接続と変更一覧

| 編集 | 対象 | 処置 |
|---|---|---|
| PFT-01 | [Objective入力](../../../../40_Develop/project-runtime/src/public-contract/objective-request.ts) | 三つの任意項目を全八組合せで検査。Profile形式を検査しexactに固定。明示undefinedを拒否し、省略時は生成しない。 |
| PFT-02 | [MCP公開Schema](../../../../40_Develop/mcp/src/protocol/project-runtime-protocol.ts) | Objectiveだけの任意項目として公開し、required集合と未知field拒否を維持。 |
| PFT-03 | [Task構成処理](../../../../40_Develop/coordinator/src/composition/project-runtime-composition-root.ts) | 検証済みObjectiveからTaskへIDをexactに搬送する。選択・Authorityを新設しない。 |
| PFT-04 | [公開入力UT](../../../../40_Develop/project-runtime/tests/unit/public-contract.contract.test.ts) | 全八組合せ、不正型／形式、未知field、Accessor／Proxy非実行、Snapshot不変性。 |
| PFT-05 | [MCP UT](../../../../40_Develop/mcp/tests/unit/project-runtime-adapter.contract.test.ts) | 公開Schema、Profile／Provider四組合せの注入Core入力、認証・Core呼出し前の不正拒否。 |
| PFT-06 | [Task搬送UT](../../../../40_Develop/coordinator/tests/unit/project-runtime-profile-transport.contract.test.ts) | 八組合せ×二Front Providerを実Task入力検査へ接続。省略、配列複製、権限非追加を確認。 |
| PFT-07 | [Project Runtime詳細設計](../../../../06_Architecture/Details/project-runtime/01_Architecture.md#7-公開アプリケーション契約) | 入力契約、責務境界と別操作の扱いを明記。 |
| PFT-08 | [Symbol Manifest](../../../../40_Develop/coordinator/symbol.json) | 新UTと既存Host候補Policy／UTを実在するARCH／QA Local Item／実装Symbolへ接続。 |
| PFT-09 | [試験カタログ](../../../../07_Quality/Registry/test-catalog.json) | 新UTと先行Host候補UTを通常回帰へ登録。Local Itemの成立結果は変更しない。 |
| PFT-10 | [CHG本文](../change.md)と本記録 | Finding、処置、限定結果、未確認範囲を同じCHGに保持。 |

| 既存利用側 | 処置・限界 |
|---|---|
| CLI stdin→公開Composition | 同じObjective Inspectorと構成処理を利用するためfield搬送が追従する。実CLI起動は未確認。 |
| MCP stdio／HTTP→Adapter→公開Composition | [配布入口](../../../../template/tools/crdd-mcp.ts)は同じ公開関数へ入力を渡す。入口Sourceは変更不要。Adapterへの注入Core captureは実Application全体の証明ではない。 |
| Workbench変更候補 | Prompt→Single Taskの別操作。既存の明示Profile経路を維持し、公開Objectiveと統合しない。 |
| Resolver／Route／Grant | 形式受理と登録／適合性を区別する。未知ID・Provider不一致・有効Role不一致・exact ID不一致の既存UTを再実行。Reviewer非伝播は既存SourceのExecutor限定処理を維持し、今回の実Provider観測とは扱わない。 |
| Queue／再入場 | 既存Applicationは所有Snapshot全体をrequestHash入力へ含めるためProfileも識別に含まれる。専用Profile再入場の実境界確認は未実施。 |
| 配布・署名 | Runtime Source差分があるため旧署名候補を新Sourceの証明として使わない。旧候補と過去Evidenceは変更せず、必要な将来再署名へ接続する。 |

## 実行結果

| 確認 | 現在結果 | 限界 |
|---|---|---|
| Formatter→型→Lint | 合格。変更六TS、Project Runtime／MCP／Verification Runnerの型、Coordinator strict／testsを順に確認。 | JSON二件は既存Biome対象外。実在カタログ検査とSymbol規則で別に検査。 |
| 局所試験 | 117／117合格、Fail／Cancel／Skip／Todoすべて0、4185.5589ms。 | 13試験fileの混合母集団であり、117件のPRL-UT-014義務を意味しない。 |
| カタログ照合 | 未登録の先行Host候補UTを検出した初回は失敗。登録後の最終実行は実在試験と登録試験の全数照合を含め合格。 | 新しい実Host清掃や人間承認を発行しない。 |
| Symbol規則 | 実Checkerの`realitySymbolGraphRule`を現在Rootへ実行しFinding 0。 | Relation検査であり実装・検証義務の成立証明ではない。 |
| 既存三静的契約検査 | Capability Graph／Runtime Traceability／Project Runtime Design Traceabilityがaccepted。 | 現在の新入口の実Provider成立へ拡張しない。 |
| Repository Checker | Error 1／Warning 0。既知の`stable-release-tag-identity-mismatch`のみ。 | v0.21公開tagとv0.22作業HEADの差。全体Passではなく、tagを変更しない。 |
| 差分空白検査 | `git diff --check`合格。 | 意味の独立確認とは別。 |
| 固定差分の独立確認 | 技術・文書・品質／不足影響の三観点が限定Pass、Finding 0。 | 公開入力、Schema／注入Core capture、純粋builder、登録／Traceと局所根拠に限定する。実入口・実Recovery・全体品質へ広げない。 |

初回のカタログ不一致を合格結果で上書きせず、`.crdd/verification/chg-000082-objective-profile-transport-261002/run-inventory.json`へ保持した。補助実行のCLI path誤指定、Node eval起動形式および独自Graph抽出の誤りは成立根拠に用いず、実入口・実Checker規則へ戻して確認した。失敗した補助操作でProvider／Docker／Host処置は開始していない。

### 最終局所実行の再識別

| 項目 | 記録 |
|---|---|
| 基準 | HEAD `b72ef1632c7fc685b88c5fdb0c82ef8a19f44450`、Tree `3720b721e03215c3ed304694cf362e7fb6c5d7b9`と本記録追加前の実差分。 |
| 実行区間 | UTC `2026-10-02T08:49:15.541Z`〜`2026-10-02T08:49:23.860Z`。各commandの実行区間も保存。 |
| 環境 | Windows、Node v24.19.0、TypeScript 7.0.2、Biome 2.5.6。固定したNative実行物とwrapperのHashを保持。NODE_OPTIONS／NODE_PATH等の追加なし。 |
| 入力 | 1,887 regular fileの開始・終了Hash集合digestが一致: `95a3d0cc0e6d2502a26f577945a75964c0ca4e0d6ac4cb0b4b6e187ef04ee72f`。全Subsystemの追跡TS／TSX／JSON、package／lock／tsconfig、実試験、固定Tool・型宣言、Coding Standards、QA-000003、Coordinator SymbolとCatalogを含む。選択コードを完全記録へ保存。 |
| 完全記録 | `.crdd/verification/chg-000082-objective-profile-transport-261002/run-final.json`、SHA-256 `8cd1b56780295fa45d1107639d343c706f9f812d6949b2db3a809b2ec918fe68`。実command、cwd、開始・完了、stdout／stderr、Exit、前後digestと主要Path Hash、runner codeを保存。 |
| 書換え確認 | HEAD／Tree、入力Hash集合、Index／Worktree差分と未追跡集合が実行前後で一致。本記録を実行時入力へ遡及しない。 |
| 保持・無効化 | Phase 5の結論固定まで原記録を保持。失った場合または入力・検証器が変わった場合は、再実行まで現在の適用根拠に使わない。必要な非秘密根拠を正式Evidenceへ移す前に廃棄しない。 |

完全記録の入力一覧は選択コードと集合digest、主要Path Hashで再構成する。全fileの個別Hash一覧を保存したとは主張しない。Symbol規則の補助記録は同じDirectoryの`current-symbol-graph.json`に保持し、最終局所試験または全体品質の記録へ混ぜない。

### 固定差分の独立確認結果

作成担当と別の確認者が、上記の基準Commitからの固定11fileを読取り専用で完成後確認した。着手前確認を流用せず、技術独立レビュー、文書監査、品質・不足影響の全三観点を完了し、限定Pass、Finding 0、確信度は高とした。対象11fileと原記録の開始・終了Hash、およびHEADは一致した。本記録の確認時SHA-256は`68d88a421249c6c3ddf0a82759891bdabb1b33fa7e5225c6afa3f2c5a8410098`、原記録は上記の`8cd1b56780295fa45d1107639d343c706f9f812d6949b2db3a809b2ec918fe68`である。

確認者は1,887件の現在入力を読取りだけで再構成し、集合digestの一致を確認した。試験カタログ266件と実在試験266件の集合差・ID／Path重複は0、18 Symbol Manifestの596 Symbol IDの重複も0で、追加の検証参照は解決した。これらを試験の実行・検証義務の成立と同一視しない。

限定結果は公開入力、MCP Schema／注入Core capture、純粋builder、登録／Traceと局所根拠だけを対象とする。PRL-UT-014全体、PRL-IT-012、実CLI／stdio／HTTP、専用Profile再入場、実Provider／Recovery、過去の結果の現在適用、全体Quality、再署名およびReleaseは未成立のまま。この節、結果表の該当行とChecklist一行だけが全確認完了後の結果書戻しであり、確認者と整合済みである。確認時Hashを現在Hashへ置き換えず、実行時入力、Source、Catalog、Symbol、品質件数、署名、承認状態および停止Gateは変更していない。

## 追加の実Catalog接続確認

基準Commit `2d76f55d4f57b9a21aa4470977d68c66fe7e99c9`で、先行試験の明示Profile→Selection Grantが差替えResolverを使っていることを確認した。これは先行117件の合格を取り消す結果ではないが、実Catalogと実Resolverの接続確認を代替できない。既存`PRL-UT-014`の観測範囲を補うため、同じ試験fileへ一件追加した。Production Source、Catalog、モデル採用、Authority、Quality集計、署名候補およびHost停止は変更しない。

### 経路と事前照合

変更分類は既存検証設計に対する局所試験の補強である。親がQA-000003、実Resolver、経路選択、Grant、既定JSON Catalog、Coding Standardsと先行Evidenceを照合した。公開契約、適用条件または正本の品質条件は追加しないため、Template移行・準拠監査は非該当。技術、文書および品質／直接影響の三観点を、同じ固定三file差分へ独立確認する。実Task、公開Transport、Provider、Host回収、全回帰、再署名は行わず、旧形式非使用方式の採否と実再起動・削除の別承認を保持する。

編集は、既存[Profile試験](../../../../40_Develop/coordinator/tests/unit/provider-model-profile-runtime.contract.test.ts)への実Resolver接続、[Symbol Manifest](../../../../40_Develop/coordinator/symbol.json)のGrant実装参照追加、本節の記録に限定する。既存Catalogには同じ試験fileが登録済みで、新しい試験file・Local Item・Canonical IDは作らない。既存Sourceの責務や選択Policyを試験都合で変更しない。

### 観測範囲と結果

| 項目 | 確認結果・限界 |
|---|---|
| 実接続 | 既定JSON Catalog→実Profile Resolver→実Route選択→隔離したGrant storeの発行・一回消費。Operation確認、利用可否、時計と乱数だけがメモリ内fixtureであり、本番Operation Authority・利用可否の実観測ではない。 |
| 有限入力 | 二Front Provider×二Executor Providerについて、自動／明示適合／未知ID／Provider不一致／tier不一致を確認。CodexのCoordinator専用ProfileをExecutorへ使う役割不一致を二Frontから追加し、計22組合せ。既定Claude Profileは全役割を許すため、存在しないClaude役割不一致を捏造しない。 |
| 肯定・反証 | 適合結果のProfile／ModelをCatalogと照合し、消費後の二回目を拒否。不適合時はProfile、Control／Use Capabilityがnullで発行なし。全経路でProvider Authority／Effect許可なし、Catalog不変。これは実外部Effectの観測ではない。 |
| 静的確認・局所試験 | Formatter→五型構成→Lintが成功し、13fileの118／118件合格、Fail／Cancel／Skip／Todo 0、4244.483ms。22組合せは一Test Case内の入力母集団であり、22 Local Itemの完了を意味しない。 |
| 実行固定 | UTC `2026-10-02T09:11:55.446Z`〜`2026-10-02T09:12:01.867Z`。先行と同じ選択規則の1,887 regular fileの前後digestは`8276ad71d7bb7ea328b8b2011dc4d8cc30676a79ad2293749550de29a6910a7b`で一致。HEAD、Tree、Index／Worktree状態も前後一致。 |
| 原記録 | `.crdd/verification/chg-000082-catalog-grant-261002/run-final.json`、SHA-256 `9eb893ca02a7388dedcc9ac7d893a7c7937ec556c6a6e28ea5cb6cd46fd284b3`。実command、cwd、Tool版／実行物Hash、前後snapshot digest、主要入力Hash、stdout／stderr、終了codeを保持。`runner-final.mjs`に選択・実行方法を保存。保持・無効化は前節と同じ。 |
| 未成立 | PRL-UT-014全体、PRL-IT-012、公開CLI／stdio／HTTP、Reviewerへの実搬送、Profile再入場、実Provider／Host回収、全体品質とReleaseは未成立のまま。 |

初回失敗は試験fixtureの利用可否理由を契約外の`fixture_only`としたことにより、実Catalogへ到達する前に拒否された。局所診断で理由を特定し、既存の許可語彙`ready`へ試験fixtureだけを修正した。先行の同Provider委譲が原因という暫定説明は確定原因としない。失敗記録`run-first.json`を保持し、製品側の拒否条件を緩和していない。

一度、実行結果の取得がTool応答で途切れた。該当検証Processが存在しないことを読み取り確認してから再実行し、そのlive sessionの結果を取得した。結果を取得できなかった実行を成立根拠に用いず、Processの不在を試験合格へ読み替えない。

独立確認はこの結果追記前には未完了だった。本節の追加を先行11fileのPassへ遡及していない。

### 追加接続の独立確認結果

作成担当と別の確認者が、同じ固定三fileに対する技術、文書、品質／直接影響の全三観点を完了した。いずれも限定Pass、Finding 0、確信度は高。確認時Hashは試験`463c0817ee876e520eb905af81195f52eff2a5b0a22c2f7702a1ab89aeea115b`、Symbol `ff59ef52c254594059aaaa6a91ea5496e6758e07fa03060228d656aa205ef2ca`、本記録`0c39a37d79e31b63b742c95afd0eab7a072afa6f984ae632c08fd78e3c94c341`で、開始・終了が一致した。基準HEADと原記録Hashも固定版と一致した。確認者は1,887入力を読み取りで再構成し、上記digestと一致した。実行・編集や過去のPass流用は行っていない。

親が実Checkerの`realitySymbolGraphRule`を別途読み取り実行し、UTC `2026-10-02T09:13:26.352Z`〜`2026-10-02T09:13:26.682Z`にFinding 0を取得した。方法を含む補助記録は同じDirectoryの`current-symbol-graph.json`、SHA-256 `907e5114027be65417d4a3bf93d811718b690d89aa5c8d55fe458f97591aa207`。Relationの機械確認であり、実試験、Repository全体Checkerまたは検証義務のPassではない。

本結果節とChecklist一行だけを、全確認終了後に書き戻した。結果のみの書戻しは確認者と整合済みであり、確認時Hashを現在Hashへ置き換えない。実行時入力、旧117件とその監査、Source／Catalog、品質件数、署名、承認とHost停止は不変。PRL-UT-014全体、PRL-IT-012と前表の未成立範囲を閉じない。

## Checklist

- [x] 公開Source契約への任意項目追加と既存意味の搬送是正を区別した。
- [x] 操作ごとの利用側を照合し、Workbenchの別操作を統合していない。
- [x] 正常、省略、不正、未知、Accessor／Proxyの反例を処置した。
- [x] 実在試験と登録試験の不足を是正し、Symbol Traceを実在Ownerへ接続した。
- [x] Formatter・型・Lintを試験より前に実行した。
- [x] 固定入力と実行記録を保持し、旧結果へHashを遡及していない。
- [x] 固定11fileの技術・文書・品質／不足影響の全必須独立確認を完了し、限定Pass、Finding 0と未成立範囲を記録した。
- [x] 実Catalog接続の追加三fileを独立した固定版で三観点から確認し、局所118件と限定Passを記録した。全体義務、実TaskおよびHost回収へ昇格していない。
- [ ] OPEN: 実入口、専用Profile再入場、実Provider、全回帰、再署名と全体Qualityは未確認。Host停止Gate成立後に対象改訂版を固定して確認する。
