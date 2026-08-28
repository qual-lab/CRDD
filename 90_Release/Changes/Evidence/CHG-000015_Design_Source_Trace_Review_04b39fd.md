# Coordinator Runtime 1.0 設計―実装―検証接続レビュー

対象変更: `CHG-000015`
対象Commit: `04b39fd15ed534fe1550fcd6f82f658243b10dc2`
対象Tree: `fcb0332b028f8a546b34e71cf1633daa7ccf47ff`
実施日: 2026-08-28
状態: `Findings — Remediation Required`

## 1. 結論

Coordinator Runtimeは、個別のSecurity contract、異常系分岐およびcomponent試験を広く持っている。一方、Runtime全体について、設計上のシーケンス、状態、不変条件、資源所有、Lock順序、実装箇所および結合試験を一つの対応関係として辿れる中間設計モデルが不足している。

この不足により、次の状態が生じている。

- 上位正本は、状態遷移、資源所有、正常・失敗・取消・回復および終了後状態の確認を要求している。
- `tools/coordinator/README.md`と`threat-model.md`は具体的な安全条件を詳述しているが、現在実装の単一シーケンス、全資源台帳または状態遷移表ではない。
- 実装は各component内で強い局所契約を持つが、Operation全体のcleanup DAGと耐久状態が複数module、`WeakMap`、boolean、配列、Filesystem pairおよびOS lockへ分散している。
- 試験数と局所網羅は多いが、設計上の状態／遷移を一次キーにした結合試験台帳がなく、実Providerの同一Host Operation内でExecutorからReviewerへ連続するような複合順序の未確認セルを識別しにくい。

したがって、今回の問題は「テストを数件追加する」だけでは閉じない。Runtime固有の実行Architectureとして、設計シーケンス、状態・資源モデル、実装対応および検証対応を正本化し、そのモデルから結合試験を導出する必要がある。

## 2. レビュー境界

### 2.1. 深く照合した経路

- `coordinator task --request-stdin`
- `Front → Coordinator → Executor → Candidate → Independent Reviewer → Result`
- Provider Home Mount Grant、Repository workspace、Provider AuthorityおよびDocker Process Controller
- Host Operation、logical Provider HomeおよびRuntime StateのLock
- Docker Taskの耐久記録、通常cleanupおよび明示Recovery
- Candidateのstaged／published／discard／store recovery
- cancellation、Host generation loss、Process poisonおよび結果公開
- 正式署名一般Task／Route Matrix／Recovery Matrixの試験入口

### 2.2. 隣接経路として境界を確認したもの

- Candidate export／discard／recover-store
- `doctor --recover-isolation`
- Windows専用`doctor --repair-docker-desktop-runtime`
- `activate`、`disable`および`provision`の未実装Effect前停止

Windows Docker Desktop最終復旧は、一般TaskのDocker Task Recoveryとは別の明示Lifecycleとして扱う。Provisioning／activationの未実装候補を、現在の一般Task成立性へ混入させない。

## 3. 正本が要求する設計状態

現在のCRDD正本は、AI入口、外部Runtime、子Process、外部送信、Authority／Capability、永続Effectおよび取消後に残存し得る資源について、少なくとも次を要求している。

- 開始前、保留、完了、失敗、取消、タイムアウト、遅延／重複通知、回収および結果公開までの状態遷移
- 各状態における要求、listener、handle、lock、Capability、AuthorityおよびEffectの所有者
- 同じ物理資源を複数役割で使う場合の所有者、終了条件、競合およびcleanup後条件
- 公開入口から実際のProcess、権限、Directory、環境および取消経路を通る本番同等確認
- 正常、拒否、境界、判定不能および処置件数0の確認
- 設計上の検証義務から検証設計、検証項目、結果および現在品質状態への接続

要求自体は不足していない。主な不足は、これをCoordinator Runtimeの具体的な資源と状態へ投影した成果物である。

## 4. 現在の実行シーケンス

### 4.1. 一般Taskの主経路

```text
Package／Process Poison Gate
  ↓
Task JSON／Repository Object Format preflight
  ↓
Docker Recovery State inventory
  ↓
Operation Directory生成
  ↓
Host Operation Generation Supervisor取得・ready確認
  ↓
Repository／Revision binding
  ↓
External Send Policy解決
  ↓
Executor＋Reviewer Slate preflight
  ↓
Candidate Store preflight／GC
  ↓
初期External Send同意または既存同意から短命Grant発行
  ↓
開始Revisionの隔離Workspace生成
  ↓
Executor Stage
  ├ Provider選定
  ├ Provider Home観測
  ├ Mount Grant issue／再観測／consume
  ├ Task Packet issue
  ├ Provider Authority／Docker Plan準備
  ├ Docker Recovery begin／handoff登録
  ├ Subscription認証Probe
  ├ Provider実行
  └ Docker cleanup／Mount完了／Recovery finalizable
  ↓
Candidate capture
  ↓
Independent Reviewer Stage
  ↓
必要な場合だけ同一Executorへ一回是正 → 同一独立Reviewer再確認
  ↓
Candidate再照合・staged保存
  ↓
全Docker Host-cleanup intent
  ↓
Host Operation cleanup
  ↓
全Docker Host-cleanup receipt／finalize
  ↓
Candidate publish
  ↓
安全な構造化Result公開
```

### 4.2. 通常cleanupの依存順

通常cleanupは単純な`finally`ではなく、次の依存関係を持つ。

```text
Provider child／Docker resource absence
  → Provider Home active mount完了
  → Docker Recovery finalizable
  → 全StageのDocker cleanup投影が完全一致
  → 各Docker TaskのHost cleanup intent
  → Host Operation generation／Directory cleanup
  → 各Docker TaskのHost cleanup receipt
  → 各Docker Task finalize
  → Candidate publishまたはdiscard
  → Result公開
```

このDAGは現在、`coordinator-task-runtime.ts`の分岐、`ControlRecord`および複数のcomponent結果から暗黙に構成されている。独立した型付き状態機械または資源台帳にはなっていない。

## 5. 資源所有とLock順序

| 資源 | 現在の所有者 | 取得／生成 | 通常解放 | 不明時の処置 |
|---|---|---|---|---|
| Host Operation Directory／Generation | Task Runtime＋専用Supervisor Process | Operation作成時 | 全Docker Host cleanup intent後 | exact Host Recovery IDを保持、必要ならProcess poison |
| logical Provider Home lock | Docker Recovery | 各StageのRecovery beginからmount完了まで | Docker不存在＋mount完了後 | Docker Recovery IDを保持 |
| Runtime State global lock | Docker Recovery／inventory | 短いinventory・mutation区間 | 各区間後 | 成功へ投影しない |
| Interactive Console lock／handle | External Send同意Lifecycle | 初期同意が必要な場合 | 入力・取消・reader終了後 | Process再起動または同意回復へ停止 |
| Provider Home Mount Grant | Mount Grant Runtime | Stageごとにissue／consume／activate | Docker cleanup後のcompleteMount | Docker Recoveryへ委譲 |
| Docker container／network／CLI child | Docker Process Controller | submission marker後 | exact ID／name／label／構成照合後 | submission／receipt／Recovery IDを保持 |
| Repository workspace | Repository Workspace Runtime | 外部送信Grant後 | Host Operation cleanup | Host Recoveryへ包含 |
| Candidate revision | Repository Workspace Runtime | Executor後と是正後 | Operation cleanup前はworkspace内 | 不一致なら昇格しない |
| Candidate Store entry | Candidate Store | Reviewer承認後にstaged | cleanup後publish、失敗時discard／recover | Candidate／Store Recovery IDを分離 |
| Task control／Docker handoff | process-local `WeakMap`／配列 | Task／Stage開始時 | completion最終settlement後 | durable IDへ退避できなければunknown |
| SIGINT／SIGTERM listener | CLI cancellation binding | Task started後 | completion後のunbind | 結果を成功へ投影しない |

実効Lock順序は次である。

```text
通常Task:
Host Operation Generation
  → logical Provider Home
    → Runtime State

Host状態を扱う明示Recovery:
Host Operation Generation
  → logical Provider Home
    → Runtime State

Host Effect不存在が証明済みのcleanup-only Recovery:
logical Provider Home
  → Runtime State
```

ただし、native observation、Docker CLIおよびHost Effectの一部では、Windowsのnative runtime競合と長時間Effectを避けるため、取得済みGenerationを一時解放し、Effect後に同じRoot／nonce／Filesystem Identity／binding／inventoryへ再取得する。現在この順序と解放窓は複数関数へ分散しており、Lock rankまたは統一Lease Setとして機械強制されていない。

## 6. 設計―実装―試験の対応評価

| 設計責務 | 主な実装 | 現在の主な試験 | 評価 |
|---|---|---|---|
| 4経路と独立Reviewer | `coordinator-task-runtime.ts`、selection modules | Task contract、signed route contract | 経路選択は強い。正式実Provider連続runは未完了 |
| Host generation lifecycle | execution environment、Supervisor、Task Runtime | contract＋Windows反復Probe | 単体／限定複合は強い。全Task資源との対応表がない |
| Provider Home Mount Grant | mount grant runtime、Provider adapters | component contract | Stage単体は強い。Executor→Reviewer連続資源状態の実境界が弱い |
| Docker process lifecycle | process controller、effect runtime | component contract、Recovery Matrix | timeout／cancel／cleanupを確認。一般Task全体との実結合が限定的 |
| Docker durable Recovery | recovery runtime、journal、state machine | 大規模contract／Filesystem integration | partial bootstrapは強いが、全durable pair利用箇所を同じ母集団で覆っていない |
| Candidate lifecycle | workspace、candidate store | component＋Task contract | staged／publish／discardは強い。実Provider複合失敗との自動結合は限定的 |
| 公開CLIと対話入力 | CLI、console reader、signed runners | contract＋物理Console Probe | 物理境界は実測。人手runへ依存する範囲が大きい |
| 全資源残存0 | Task cleanup、Recovery、signed runner | 個別contract＋一部署名E2E | 一経路で確認。設計状態全セルへの対応はない |

## 7. 指摘事項

### DSR-01 Runtime固有の状態・資源Architectureが正本化されていない — Major

`04_Agent_Organization.md`は上位概念と非規範の一般実行Architectureを所有し、`tools/coordinator`は実装を所有する。その中間に、Coordinator Runtime固有のシーケンス、状態、資源、不変条件、Lock順序および結果公開条件を所有するArchitecture成果物がない。

`README.md`と`threat-model.md`は詳細だが、現在状態、過去Evidence、残件、実装説明および脅威境界が混在する。これらから実装者が単一の状態機械を再構成する必要があり、規模増大時に伝播漏れが起きやすい。

### DSR-02 Operation全体のcleanup DAGが暗黙制御フローである — Major

Task Runtimeのcleanup／finalize／publishは、boolean、配列、`WeakMap`、複数Recovery IDおよびnested Promise chainから合成される。状態の組合せを型または単一reducerで閉じていないため、局所修正時に新しい到達可能状態を見落としやすい。

必要なのは巨大な万能状態機械ではなく、少なくとも次を分けた型付き状態である。

- Task phase
- Stage phase
- Host generation state
- Docker handoff state
- Candidate state
- cleanup eligibility
- result publication eligibility

### DSR-03 Lock順序と一時解放窓が実装規約として機械強制されていない — Major

文書上の順序は明確だが、取得と再取得はTask Runtime、Docker Recovery、kernel-lock controllerおよびHost generation APIへ分散する。Lock rank、現在保持集合、解放窓、再取得後の必須再検証を一つのprimitiveで表現していない。

今回のWindows native crash是正で、Lock解放対象がRuntime StateだけからHost Generation、さらにDocker Effect窓へ段階的に拡張した事実は、この不足を示す。各局所修正は妥当でも、全保持集合を設計から列挙していなかった。

### DSR-04 耐久pairの中間状態母集団が利用箇所ごとに不均一である — Major

`writeCommittedDockerRecoveryJson`はcontentを確定した後にcommit sidecarを確定するため、process終了時にはcontent-only状態が到達可能である。Runtime Stateのbase／base-commit／pointer／moveではこの中間状態を広く分類しているが、全利用箇所へ同じ回復規則が適用されているわけではない。

現時点の実測残存状態は、Host側`active-docker-task-v1.json`のcontentが期待byteで存在し、commit sidecarが存在せず、Host generation Effect前である。これは「第三状態」ではなく、durable pair primitive自体が作る到達可能な準正常中間状態である。しかし現在の明示Recoveryは`docker_task_recovery_commit_missing`で停止し、自動収束規則を持たない。

この状態を安易にcommit済みへ昇格してはならない。設計上、Effect前content-only、Effect後receiptなし、replacement、commit-onlyおよび不一致を分け、各durable pair利用箇所へ全数適用する必要がある。

### DSR-05 結合試験の一次キーが設計状態ではない — Major

試験名と件数は多いが、設計上の状態／遷移IDから、実装点、正常・準正常・異常ケースおよび終了後観測へ辿る台帳がない。結果として、componentの分岐網羅が高くても、次のような複合セルが漏れ得る。

- 同一Host OperationでExecutor cleanup後にReviewerが同じ／別logical Homeを開始する
- 前StageのHost active binding削除直後に次Stageのbinding pair作成が中断する
- 2件以上のDocker handoffとCandidate stagedが同時に存在する
- Host Generation、Home lock、Runtime State lockおよびnative child spawnの複合順序
- 公開CLIの取消、対話、Provider完了およびcleanup通知が同じturnで競合する

### DSR-06 `integration`と呼ぶ試験の実境界が限定的である — Major

`coordinator-claude-delegation.integration.test.ts`は複数componentを接続するが、Operation Directory、実kernel lock、実Filesystem journal、実child Processおよび公開Task入口を使わない。Route Matrixのcontract試験も一般Task runnerをstub化する。実境界を通る全体確認は正式署名runへ偏り、人間入力、Docker状態および実Subscriptionに依存する。

下位Gateには、固定Fake Providerと試験専用Docker／Process adapterを使いながら、公開Task入口、実Operation Directory、実lock、実journal、Executor→Reviewerおよびcleanupを自動で通す再実行可能な結合試験が必要である。HumanはRelease passphraseと、本当に外部Providerを送信する最終実測だけへ縮退させる。

### DSR-07 旧Coordinator facadeと現Task Runtimeの二系統が残る — Moderate

公開CLIと正式Runnerは`coordinator-task-runtime.ts`を使う。一方、`coordinator-runtime.ts`もproduction facade、contractおよびcoverage対象として残るが、公開入口の利用側ではない。旧vertical sliceを現行Architectureの一部と誤認しやすく、試験合格の意味も分散する。

履歴として必要ならEvidenceへ固定し、現行sourceから撤去する。残す場合は、非productionの限定componentであることをファイル、exportおよび試験名から一意にする必要がある。

### DSR-08 下位の固有失敗理由が上位で過度に一般化される — Moderate

Docker Recovery beginの具体的な失敗は、Process Controllerで`docker_process_controller_recovery_unavailable`へ集約される。公開結果から秘密Pathや内部byteを出さないことは正しいが、Effect前のpartial pair、lock競合、binding差およびinventory不成立を安全な閉集合reasonへ分類できないと、運用者は同じ手順を反復し、原因特定が遅れる。

公開reason、内部EvidenceおよびRecovery actionを分離したまま、少なくとも「競合」「到達可能partial」「identity不一致」「unknown」の処置差を保持する必要がある。

## 8. 正常・準正常・異常の検証モデル

### 8.1. 正常

- 4経路それぞれのExecutor→Reviewer→Candidate publish
- Reviewer承認と一回是正後承認
- 初回同意と既存同意再利用
- 同じProvider Homeを別Taskが順番に使用
- 別Provider Homeを並行使用
- 全lock、listener、child、Directory、Docker資源およびRecovery record残存0

### 8.2. 準正常

準正常は、契約上予期された拒否・競合・再試行可能状態であり、未知状態や手動回復と混在させない。

- Provider不適格による別経路選択またはEffect前停止
- External Send拒否／取消
- Provider timeout、nonzero、結果不正だがcleanup確認済み
- Reviewerの`changes_requested`と一回是正
- duplicate cancel／遅延完了通知
- Lock競合だが所有者とcleanupが確認済み
- durable pairのEffect前content-only等、帰属とsuccessorが一意な到達可能中間状態
- Candidate publish失敗後のexact discard

### 8.3. 異常

- Lock解放不明、owner喪失、generation置換
- durable content／commit／intent／receiptの改変、replacement、第三状態
- Docker create送信後・receipt前の曖昧結果
- child Process喪失、親Process消失、cleanup観測不能
- 同一Hostに複数Task残存し依存順が不明
- Candidate、Host、DockerまたはStoreの複数Recovery ID同時残存
- cancellation protocol failureまたはlistener／handle残存不明
- Result公開条件の観測不能

各ケースは、入力だけでなく、開始時資源、発火点、期待するEffect件数、終了時資源、公開結果およびRecovery actionを持つ必要がある。

## 9. 是正方針

1. Coordinator Runtime固有Architectureを`tools/coordinator/architecture/`へ置き、上位概念と実装READMEの間を参照で接続する。CRDDルートの文書番号をReference Runtimeごとに消費しない。
2. Task／Stage／cleanupの状態、資源台帳、Lock順序および不変条件を定義する。
3. 最初の機械可読Traceは、今回の漏れを事前検出できる`resources`、`states`、`transitions`、`invariants`および`verificationBindings`へ限定する。実装symbolの全面形式化や汎用Framework化はDogfooding結果を得るまで行わない。
4. 各状態・遷移から正常・準正常・異常の結合試験を列挙し、検証項目との未接続セルをCheckerで拒否する。
5. durable pair利用箇所を全数列挙し、各中間状態の処置を共通primitiveまたは利用側規則へ固定する。
6. 公開Task入口を使う試験用縦結合Harnessを作り、実OS lock、Filesystem、child ProcessおよびExecutor→Reviewerを自動確認する。
7. 現在残るHost active bindingのpartial pairは、この設計で期待状態を確定してから回復する。
8. 旧Coordinator facadeを撤去または明確に非production化する。
9. 修正後に全機械試験、正式署名Recovery／Route Matrixおよび独立Architecture／Security、Test／UX、Document／Gap／Impact／Conformanceを新固定版で行う。

## 10. 現在の判定

- Runtime完成: `Not Verified`
- 一般Taskの正常1経路: 過去固定版で`Verified`、現在版へ自動流用不可
- Recovery Matrix: 対象Commitの正式署名配布物で`Verified`
- 4経路Route Matrix: `Blocked`
- 現在残るpartial Host binding: `Preserved — Design Decided / Signed Recovery Pending`
- 人間による新しいリスク受容: 現在不要

本レビューは実装者による設計―ソース照合であり、完成後の独立レビューまたは監査を代替しない。

## 11. 是正実装結果（2026-08-28）

- `tools/coordinator/architecture/README.md`へ主実行シーケンス、公開CLIのsignal bindingを含むArchitecture上の10資源、20状態、Lock順序、耐久pair、cleanup依存順、10不変条件および21遷移を固定した。現在の機械可読Task Traceが直接観測する資源は、そのうちCLI signal bindingを除く9資源である。Operation取得中、clean blocked、cleanup確認済みのProcess再起動、exact IDを持つRecovery、IDなしoperator transfer、一回限りで循環しないbounded remediation、Host clean後のRecoveryと別Recovery invocationを分離した。Process再起動はProcess scopeとし、Host cleanup前のclean terminalと、公開済み成功結果・Candidateを保持して同一Processの後続Effectだけを禁止するHost Clean専用遷移を分けた。
- `tools/coordinator/runtime/coordinator-runtime-traceability.json`へ最小機械可読投影を追加し、10検証接続・70の状態別caseへ再構成した。契約投影と実Filesystem／Process観測を区別した。
- Coordinator専用Checkerはexact entity shape、Schema、ID、参照、孤立、risk、operation／invocation terminal遷移、検証境界、遷移×開始状態×区分、期待終了状態、Effect件数、結果状態、資源後条件、Architecture記載およびtest source上のexact test名を検査する。試験実行結果、品質状態または監査Passは主張しない。
- Host active bindingのcontent rename直後へ実process killを注入し、同一Lock内でHost previous世代、全submission不存在、exact base、完全commit済みpointer、active binding完全一致およびactive commit不存在の場合だけ明示Recoveryでrollbackして残存0へ収束することを確認した。
- 同じpartial contentを変更した異常例、期待値の異なるjournal content、完全commit pairでは処置せずEvidenceを保持することを確認した。
- 当時の対象確認は70の状態別caseと、Task／Docker Recovery／Journal／Traceability／公開理由分類を含むCoordinator全1155試験、TypeScript strict typecheck、Lint、Formatter、Trace CheckerおよびRepository全体Checker（error 0、warning 0）を通過した。この1155件は当時の固定候補の履歴値である。

現在の実Host残存は、新しいsource候補から保護Runtime Stateをproduction Authorityとして直接開けないため、更新した正式署名配布物を固定するまで保持する。これをsource checkout、caller supplied Pathまたは手動削除で回避しない。

## 12. Finding処置台帳

担当責任者はQual-Labとする。未解決項目は`CHG-000015`のRelease残件として保持し、公開Task入口の自動縦結合、旧facade整理、公開reason分類または正式署名実測の着手時に再評価する。

| Finding | 現在処置 | 根拠／残件 |
|---|---|---|
| DSR-01 | Applied — independent re-audit pending | Reference Architectureと機械可読Traceを追加し、状態・資源・Lock・Recoveryを分離した。独立再監査のPass前にResolvedとしない |
| DSR-02 | Partially resolved | cleanup依存順、clean blocked、Host clean後Recoveryを明示。全実装symbolとの自動照合は将来候補 |
| DSR-03 | Partially resolved | Lock順、Stageごとのlogical Home lock解放、解放窓後再照合をTraceへ固定。汎用静的解析は追加しない |
| DSR-04 | Applied — independent re-audit pending | partial／committed active bindingを削除する全5経路へcommitted pointerとの共通closureを適用し、missing／partial／replacementの非削除試験を追加。独立再監査と実Hostの署名Recovery待ち |
| DSR-05 | Applied — independent re-audit pending | Runtimeが単調に記録した実状態と遷移差分からCanonical case全fieldを完全一致比較する。Checkerはcaseごとの明示registry、共通assertion接続、transition delta宣言およびbinding内で実際に使う観測資源を要求し、宣言と試験合格そのものを同一視しない |
| DSR-06 | Open | 公開Task入口で実OS lock、Filesystem、child Process、Executor→Reviewerを自動実測する縦結合Harnessが必要 |
| DSR-07 | Open | 旧Coordinator facadeの撤去または明確な非production化をRelease前に判断する |
| DSR-08 | Applied — independent re-audit pending | 内部理由を直接公開せず、exact allowlistで競合、partial、identity差、観測不能およびその他の利用不能へ固定分類する。`active_or_unknown`とLock解放未確認を競合へ縮退せず、caller由来文字列を漏らさない陽性・陰性対照を追加した |

fixture cleanup不備で作られた可能性がある過去Temp領域は、実Runtime資源と混在し得るためglob削除しない。新試験は返却されたexact Host root、marker、親領域だけを`finally`で回収する。過去残骸は保護Runtime参照との照合を持つ別の明示処置として扱う。

## 13. 第一固定候補の独立監査と再是正

第一固定候補Commit `7f0fd5c70ec2e0a586d39e566e65169bf6dcc988`／Tree `72f935422a88df28375a8d4c305ec1962f7d6450`に対する独立Architecture／Security、Test／UXおよびDocument／Gap確認は、Critical 0、Major 3、Minor 3で`Fail`とした。共通原因は、設計上のclosureを一部経路だけへ適用したこと、是正loopを単一Reviewer状態へ戻して循環を許したこと、および検証接続がtest名の存在に留まり遷移の開始状態と資源後条件を拘束していなかったことである。

再是正では、active binding／pointerの直接相互結合を通常完了、通常receipt replay、crash receipt replay、Effect前rollbackおよびfresh crash recoveryの削除前共通関数へ集約した。一回是正を初回経路と別のExecutor／Candidate／Reviewer状態へ分離し、再是正への遷移を持たせなかった。Trace Schema revision 3は検証caseを追加し、operation terminalからの全遷移、Recovery invocationの非terminal開始、遷移に属さない資源観測および遷移×開始状態×区分の欠落を拒否した。

第二固定候補Commit `f6ae23195b1cccdab00dc70fd657faaa6814c192`／Tree `65d18f821a71efc5b333e9a1659346ef82d2e26c`の再監査もCritical 0、Major 3、Minor 2で`Fail`とした。共通原因は、一ケースへ複数開始状態を束ねたため各状態の実scenarioを証明できなかったこと、失敗例を成功遷移の検証として数えたこと、Effect種類と試験assertionの接続が曖昧だったこと、および削除後観測に`existsSync`が残って権限拒否等を不存在へ縮退し得たことである。

Trace Schema revision 4は、case ID、単一`fromState`、`outcome`、実`expectedEndState`、Provider／Host／cleanup別`effectObservations`および観測資源の後条件を必須にした。同じ遷移・開始状態・区分の重複を拒否し、Task terminalの19状態別scenario、正常8遷移、一回是正8遷移、partial pairおよび実Recoveryを37 caseへ接続した。耐久delete primitive、active binding／pointer完了GateおよびHost inventoryは`ENOENT`だけを不存在とし、削除後の観測不能を注入してanchorとRecovery Evidenceが保持されることを確認する。これらは現在`Applied`であり、新しい固定改訂版の独立再監査がPassするまで`Resolved`へ昇格しない。

## 14. 第二固定候補の監査後是正

第二固定候補後の独立監査は、case ID文字列が試験sourceに存在してもCanonical case全体と実挙動が一致する保証にならないこと、Task terminalの開始状態が一部欠けていたこと、Effect観測が累積値にも読めること、契約投影を実Filesystem／Process観測としていたこと、および削除以外の不存在判定に`existsSync`相当の二値化が残っていたことを検出した。

是正後のTraceは`effectObservationScope: transition_delta`を必須とし、Task Runtimeの単調な内部lifecycle observerから開始・終了状態とProvider／Host／cleanupの差分を組み立てる。6検証接続・41 caseはcaseごとの明示registryと共通`assertRuntimeTraceCase`によりCanonical objectへ完全一致し、case ID文字列だけの接続を拒否する。blocked／Recovery terminalはAdmission、Candidate Captured、Reviewer Clean、是正各状態およびHost Cleanを別scenarioとして持つ。Recovery Matrixは`contract_projection`へ戻し、直接Runtime試験が所有しないCLI signalを除いた。Task Traceは全9資源の終了後状態を実fixture ledgerから照合する。

FilesystemのAuthority判定は`ENOENT`だけを不存在とし、権限拒否、共有競合およびI/O失敗を観測不能へ閉じる。Host active binding削除済み・exact committed pointer残存という非対称状態は、別Processで同一identityを再検証してDocker、Mount、Host、pointerおよびRuntime Evidenceの残存0へ収束する。active binding削除後またはHost Root削除後の再観測が不能な場合は完了へ縮退しない。Docker Recovery開始失敗の公開reasonは競合、partial、identity差、観測不能および一般利用不能の固定分類とし、内部Pathやcaller文字列を返さない。

これらの処置は`Applied — independent re-audit pending`である。DSR-06の公開Task入口を使う自動縦結合とDSR-07の旧facade整理は別のRelease残件として維持する。正式署名Recovery／Route Matrix、Runtime完成、統合またはReleaseは、新しい固定改訂版の独立監査と署名実測なしに成立したとみなさない。

## 15. 第三固定候補の独立監査と再是正

第三固定候補Commit `403b9c820cab2ccb7a0db9c6d2b63a52f2dc07e0`／Tree `c881036066148a59b4c5cc2c017bf0fdf736785e`に対するArchitecture／Security、Test／UXおよびDocument／Gap確認は、Critical 0、Major 6、Minor 4で`Fail`とした。複数監査が同じ事項を指摘しており、この件数を相互に独立した10原因とは数えない。共通原因は、実観測objectの一部をCanonical期待値から構成していたこと、terminal observerがTask control失効前だったこと、AdmissionからRecoveryへの到達可能経路と下位`manualRecoveryRequired`の伝播が欠けたこと、公開reasonを部分一致で分類して観測不能を競合へ縮退し得たこと、およびArchitecture上のCLI資源をTask fixtureが直接観測したと表現したことである。

再是正では、Task Runtimeがcontrol失効後に三つのterminal状態を実通知し、observer例外をRuntime制御から分離した。試験は独立fixture ledgerから状態、Effect差分および全9資源の後条件を構成し、caseごとの明示registryでCanonical objectへ完全一致させる。Admission Recovery IDと`manualRecoveryRequired`を結果再包装で失わず、Provider cleanup済み資源を保持中と誤記しない。公開reasonはexact allowlistへ変更し、`active_or_unknown`、Lock解放未確認、監査失敗および観測不能を専用分類へ保つ。fresh Process試験は別PID、Host Root、markerおよびRuntime State残存0を直接確認し、active binding、pointerおよびHost Rootの削除後観測不能をそれぞれ注入する。`RES-CLI-SIGNAL-BINDING`は公開CLI縦結合が成立するまで機械可読Task Traceから除外した。

本節の処置は`Applied — independent re-audit pending`である。機械確認と全試験の完了後に新しい固定改訂版を作り、過去監査結果を流用せず同じ監査集合へ再提示する。

## 16. 第四固定候補の独立監査と再是正

第四固定候補Commit `de7b9086c1841578334d80ed9feafec2edc93dda`／Tree `d9b5260b4f9072c00c83c50fbc46830dd1b6ab43`に対するArchitecture／Security、Test／UXおよびDocument／Gap／Impact確認は、Critical 0、Major 5、Minor 3で`Fail`とした。Conformanceは`Pass / No Impact`である。重複を除いた共通原因は、production Docker inventory producerの`completed + manualRecoveryRequired + ids`形式をTask Admission fixtureが再現していなかったこと、Operation取得途中のHost EffectをAdmissionに含めていたこと、final projection例外時のcontrol失効がfulfilled経路だけだったこと、およびTask control／Interactive Consoleの資源後条件をreceiptではなく状態名から作っていたことである。fresh Process試験の失敗時Host cleanup scopeとThreat Modelの公開理由境界にも伝播漏れがあった。

再是正では、own-data snapshotだけを受理する共有Docker Recovery ProjectorをTask AdmissionとDocker Process Controllerへ接続し、cleanをexact 1形式へ限定した。単一・複数在庫は検証済み全IDを保持し、blocked、lock解放不明、malformed、accessor、Proxyおよび未知理由は全Operation Effect前に固定公開理由で停止する。`STATE-OPERATION-ACQUIRING`を追加して取得成功、cleanup確認済み停止、cleanup不明＋exact Host Recoveryを別caseへ分離した。Task最終化はprojection例外を保守的なtyped blockedへ正規化し、controlを無条件失効してからterminal observerを一回だけ通知する。fixture ledgerはcompletion後の公開取消receiptとExternal Send同意Lifecycleのcleanup結果を使い、状態名だけから不存在を作らない。fresh Process試験は返却されたexact Host root／markerを境界検証後に`finally`で回収する。

同じ原因をCRDD利用側で再発させないため、Architecture、Implementation、Quality AssuranceおよびAgentの既存条項へ、設計要素から実装symbol、正常・準正常・異常の検証、実観測、終了後条件までの接続閉包を追加した。新工程や固定成果物は増やさず、単純な対象は既存成果物から再構成できればよい一方、複数Process、OS資源、外部実行基盤、Authority、永続EffectまたはRecoveryを含む対象は、未接続・未観測を別実行者が検出できる方法へ具体化する。

本節の処置は`Applied — independent re-audit pending`である。更新後の機械確認、全試験および新固定改訂版の同一監査集合がPassするまで、第四固定候補の結果を流用せず、Runtime完成またはReleaseへ昇格しない。

## 17. 第五固定候補の独立監査と再是正

第五固定候補Commit `9260f0ea48e21e450a167df9b9e2964159497cea`／Tree `8d41befdc88e52e9a5c26891102bf62f205b2e11`に対するArchitecture／Security、Test／UXおよびDocument／Gap／Impact／Conformance確認は、Critical 0、Major 5、Minor 3で`Fail`とした。重複を除いた共通原因は、共有Projectorを導入してもproducerのexact SchemaとID／Hash相関を閉じていなかったこと、本番Operation Directory生成の失敗窓をsynthetic fixtureだけで確認していたこと、Canonical caseの登録を実行済みと同一視したこと、fresh Process fixtureのhandoff前失敗時回収、および方法論変更の移行伝播不足である。

再是正では、Docker Recovery Identityを共有primitiveへ集約し、exact形式、Hash、重複、状態と理由の相関およびcleanの唯一shapeをTask AdmissionとDocker Controllerで共用する。producer欠落、`null`、throw、malformed、重複または不一致を全Operation Effect前に固定理由へ閉じ、内部値を公開しない。Operation Directory生成はroot生成前後を含む単一opaque分類primitiveとし、実Filesystem faultでEffect 0またはexact rollbackを確認する。Trace契約試験はCanonical case集合と実行済みassertion集合を完全一致させ、登録だけのcaseを陽性対照で拒否する。fresh Process fixtureはhandoff前failureでも、返却済みRecovery Identityとnonceから導出したexact markerだけを境界確認後に回収する。移行説明は方法論とRuntime固有処置を分離した。

本節の処置は`Applied — independent re-audit pending`である。全1099試験、型、Lint、Formatter、Trace CheckerおよびRepository全体Checker（error 0、warning 0）は現在合格しているが、固定Commitおよび同一監査集合のPassまでは現在の品質状態を`Resolved`へ昇格しない。

## 18. 第六固定候補の独立監査と再是正

第六固定候補Commit `7a6150a`に対するArchitecture／Security、Test／UXおよびDocument／Gap／Impact確認は、Critical 0で`Fail`とした。重複を除いた共通原因は、Operation DirectoryのRoot、初期化markerおよび一時fileを一つのRecovery transactionとして閉じていなかったこと、Filesystem観測不能を二値APIで不存在へ縮退し得たこと、Docker Recovery開始成功形をConsumerがexact Identityへ再結合していなかったこと、ならびに共有Recovery inventoryを使う複数試験が単独合格しても同時実行時の独立性を保証しなかったことである。

再是正では、選定済みnonceとroot名を持つ`initializing` Host Recovery recordをRoot生成前に耐久化した。Root生成前のProcess lossはRoot不存在の確認後にmarkerを回収し、Root生成後かつIdentity確定前のProcess lossは名前一致から所有権を推定せず、exact recordとRootを保持して手動Recoveryへ閉じる。Root、marker、一時fileおよびRecovery recordの削除後観測は`ENOENT`だけを不存在とし、その他の失敗を観測不能としてEvidence保持へ移す。Docker Controllerは成功したbegin結果についてもexact Recovery token、stable Home hashおよびobject capabilityをEffect前に検証する。TraceはCanonical集合、登録集合および実際にassertionを完了した集合を独立して比較する。Recovery結合試験はrun固有TEMP namespaceを所有し、Process-lossのRoot生成前／生成後境界と終了後のexact不存在を実Processで確認する。

同じ原因をCRDD利用側で減らすため、既存のAgent、ImplementationおよびQuality Assurance条項を強化した。cleanup成立は関連資源の閉包、Canonical／登録／実行集合の独立比較、実観測による不存在、共有Directory／Lock／port／named pipe／OS store／Recovery inventoryを使う結合試験のnamespaceまたは直列化までを含む。新しい工程や一律の専用成果物は追加しない。

本節の処置は`Applied — independent re-audit pending`である。現在Sourceの機械確認と全試験を再実行し、新しい固定Commitを同じ監査集合へ提示するまで`Resolved`、Runtime完成またはReleaseへ昇格しない。

## 19. 第七固定候補の独立監査と再是正

第七固定候補Commit `815b0224a24f5b4c0e45d589e4ec2650c853916d`／Tree `1d3108961b8c9f44a8a85d6f75fdcc16977af9c2`に対するArchitecture／Security、Test／UXおよびDocument／Gap／Impact確認は、Critical 0で`Fail`とした。Conformanceは`Pass / No Impact`である。重複を除いた共通原因は、初期化writerのcleanup不明を外側のRoot／marker処置成功で`true`へ戻せたこと、active pointerのHome集合と全Recovery recordのHome集合を同一視したこと、Recovery開始成功unionのdiscriminant／opaque bindingとabort settlementを一つの閉包にしていなかったこと、およびRecovery Trace 2件の実行済み記録がassertion完了前だったことである。

再是正では、initial markerとhost-only temporaryをexclusive openした直後にhandle由来Filesystem Identityを取得し、handle、entry、Identity、cleanup状態およびexact tokenをopaque failure分類へ保持する。Recovery directory、Root、marker、一時fileおよびgenerationのcleanupは資源別結果の論理積として単調に集約し、一件でも不明なら後段成功でcleanへ戻さず、markerとRecovery根拠を保持する。Root／marker削除は捕捉済みIdentityとの一致後だけ行う。同期I/O故障試験はinitial marker、Rootおよびhost-only temporaryのIdentity観測失敗を個別に注入する。

Docker Recovery admissionではactive Home hashを全ID由来hashの重複なし部分集合として扱い、inactive／cleanup中のexact IDを保持する。Process Controller revision 14は成功形をexact `status=ready`、ID、Capabilityだけへ固定し、Runtime-owned durable recordのID、management bindingおよびstable Home bindingをEffect前に再検証する。不正成功形のabortとMount settlementはAuthority／Lease返却だけを担い、durable Recovery inventoryのcleanupを証明しないため、Effect 0のままexact IDを手動Recoveryへ保持する。Recovery Traceの実行集合はCanonical assertion成功後だけ更新する。fresh Process fixtureはhandoff前失敗をproduction Recoveryへ接続し、親fallbackもHost recordのRoot Identityとmarker Identityを照合してから処置する。

本節の処置は`Applied — independent re-audit pending`である。更新SourceはCoordinator全1106試験、TypeScript strict typecheck、Lint、Formatter、Trace Checker、Repository全体Checker（error 0、warning 0）およびdiff checkを通過した。新しい固定Commitおよび同じ監査集合のPassまで`Resolved`、Runtime完成またはReleaseへ昇格しない。

## 20. 第八固定候補の独立監査と再是正

第八固定候補Commit `2964f3bf75443948d8caa80da39722f52d7d9c8e`／Tree `e61b9471143ad91fd8e8193b6f2c0d5d5d083fb9`に対する同一監査集合はCritical 0で`Fail`とした。残った共通原因は、初期markerまたは置換更新の失敗時に現在の耐久bytesではなく予定Hash／旧HashからRecovery IDを返し得たこと、およびRecovery abandonとMount settlementによるAuthority／Lease返却をdurable Recovery inventoryのcleanupへ昇格させたことの2点である。

再是正では、Host Recovery IDを返す前に現在markerを非linkの通常fileとして読み、exact schema、Root名、Filesystem Identityおよび実bytesを安定再読取りし、実bytes Hashからだけtokenを再構成する。初期markerが空、部分的、置換済み、観測不能または一意でない場合は推測IDを返さず、`cleanupConfirmed=false`、手動RecoveryおよびIDなしのoperator transferへ閉じる。rename後に例外が生じても、現在markerが旧recordなら旧token、successor recordならsuccessor token、どちらとも確定できなければ`null`を返す。

Docker Recoveryの不正成功形では、abandonとMount settlementをbest-effortのAuthority／Lease返却として実行するが、durable record、pointer、active bindingおよびinventoryの削除証明には使わない。したがってControllerは常に`cleanupConfirmed=false`、`manualRecoveryRequired=true`とし、構文上正しいRecovery IDを保持する。production結合試験はabandon成功後にもdurable inventoryが残ることを観測する。更新SourceはCoordinator全1108試験、TypeScript strict typecheck、Lint、Formatter、Trace Checker、Repository全体Checker（error 0、warning 0）およびdiff checkを通過した。これらは更新固定版の同じ監査集合による独立再監査がPassするまで`Resolved`へ昇格しない。

第八固定候補の再監査は、外周rollbackがcached initializing tokenを返す分岐、現在読めるが捕捉済みlineageと無関係な置換recordの再信頼、およびIDなしoperator transferをexact Recovery状態へ畳むTraceを検出した。追加是正では、公開するHost Recovery IDを捕捉済み旧marker Identity＋bytesまたは今回のtemporary handle Identity＋successor bytesのどちらかに限定し、外周返却直前にも同じlineageを再検証する。production既定TEMPのnonnull IDは公開loaderへ通し、空、部分、別Identity、観測不能または不存在は`null`へ閉じる。Task terminalはexact IDを持つ`STATE-RECOVERY-REQUIRED`と、actionable IDを持たない`STATE-OPERATOR-TRANSFER-REQUIRED`へ分離し、後者をRecovery invocationへ推測接続しない。更新SourceはCoordinator全1112試験、TypeScript strict typecheck、Lint、Formatter、Trace Checker、Repository全体Checker（error 0、warning 0）およびdiff checkを通過した。これらは更新固定版の独立再監査前にResolvedとしない。

続く再監査は、`processRestartRequired=true`かつcleanup確認済み・Recovery不要の終了をIDなしoperator transferへ畳んでいたこと、ならびにAdmission、Operation Ready、Provider実行中および是正中の一部到達状態がRecovery／operator移送Traceへ接続されていないことを検出した。追加是正では、終了分類をResult、clean block、Process再起動、exact ID Recovery、IDなしoperator transferへ直交分離した。`STATE-PROCESS-RESTART-REQUIRED`はInvocation／Operation双方のterminalとし、Operation Recoveryへ遷移させずfresh Processだけを要求する。Recoveryとoperator移送の開始状態を実到達可能集合へ拡張し、Providerがactiveな4状態の取消protocol違反、AdmissionのIDなし在庫、Operation Readyのexact ID保持、および各clean終了後の最終投影失敗を実scenarioから検証する。現行Traceは20状態、20遷移、8検証接続、60 caseであり、Coordinator全1129試験、TypeScript strict typecheck、Lint、Formatter、Trace Checker、Repository全体Checker（error 0、warning 0）およびdiff checkを通過した。同じ監査集合の独立再監査がPassするまで`Resolved`へ昇格しない。

その固定候補の再監査は、成功結果の分類をProcess poisonより先に確定していたため、同じProcess内の別Operationが進行中Taskの完了前にpoisonされた場合、Candidate公開済みの成功結果が再起動要求を失う水平到達Gapを検出した。追加是正では、cleanup不明／actionable Recovery、Process再起動、成功公開、clean blockの優先順位を直交させた。Process再起動状態をProcess scopeへ変更し、Host cleanup前の11状態からのclean terminalと、Host cleanup後にCandidateと成功結果を保持したterminalを別遷移へ分けた。`status`、manual recovery、process restart、cleanupおよび4種のexact Recovery IDの全直積を純粋分類試験で確認し、共有Process Safety Stateを実際にProvider実行中にpoisonして、当該Taskは成功・Candidate保持、次Effectは禁止、Recovery／operator移送は不要となることを結合した。この時点のTraceは20状態、21遷移、8検証接続、68 caseであり、Coordinator全1137試験、TypeScript strict typecheck、Lint、Formatter、Trace Checker、Repository全体Checkerおよびdiff checkを固定候補前に再確認する。同じ監査集合の独立再監査がPassするまで`Resolved`へ昇格しない。

## 21. producer相関・Operation生成transaction・一般則の再是正

固定候補`6d796cb096cb657f33b6552a58d555e5af779b3b`／Tree `317193f2fceb854f2a95b3759704ba99d1816cd4`への同一監査集合は、耐久precleanup intentの安全predicateとEvidence軸の過大主張是正を解消候補とした一方、Process Controllerの開始返却、callback handoffおよび完了結果のexact shape／Recovery ID相関がknown production consumerへ閉じていないこと、旧facadeのOperation Root生成後Capability初期化失敗がtransaction外であること、ならびに一般則が通常のqueue／progress／checkpoint／EvidenceまでAuthority-bearingへ過剰分類し得ることを検出した。

追加是正では、Docker Process Controller contract revision 17が所有するstart／completion exact projectorを旧facade contract revision 7とTask Runtime contract revision 23へ接続した。started返却IDとcallback IDの一致、cleanup完了時の`recoveryId: null`、cleanup不明時のhandoffと同じexact ID、全discriminant／固定非報告field／資源cleanup相関を検証し、欠落、余分field、不正形式または相関差では成功を公開しない。旧facadeのOperation Root生成からCapability完成までは共有transaction primitiveへ移し、途中失敗をroot回収確認済み、またはexact Host Recoveryを持つ回収不明へ閉じた。CRDD一般則は、別invocation／processで保護Effectの十分な根拠または不可欠なAuthority predicateになる耐久状態だけをAuthority-bearingとし、fresh Authority再結合が必要な通常記録を非該当、分類不能をEffect 0とした。発行条件成立前の非発行、exact発行後の同一Recovery intent保持、retry時の別・拡大Authority非生成も分離した。

現在SourceはCoordinator全1163試験、TypeScript strict typecheck、Lint、Formatter、Trace Checker、Repository全体Checker（356 Markdown、2133 link、error 0、warning 0）およびdiff checkを通過した。旧facadeはline 80.86%、branch 72.03%、function 86.36%、Operation生成transactionはline 85.98%、branch 77.78%、function 71.43%を観測した。本節の直接EvidenceはTask Runtime／旧facadeの契約試験、実Controller出力を使うproducer projector試験および実Host Filesystem Recovery試験であり、public CLI、署名済みpackage、正式署名E2E、実Provider requestまたはnetwork実測を新しく主張しない。更新固定Commitへの同じ監査集合がPassするまで`Resolved`、Runtime完成またはReleaseへ昇格しない。

## 22. Recovery ID取得境界・exact data projection・一般transaction則の再是正

固定候補`8865ef94ec975f0a307a37c97832fa516fc7c07d`／Tree `747fd758b3e25d04b263e087d37e242948095b2e`へのArchitecture／Security、Test／UXおよびDocument／Gap／Impact／Conformance監査は、Critical 0で`Fail`とした。重複を除いた共通原因は、Root生成後の`getHostRecoveryId`を読み取り処理としてtransaction外へ置いたこと、producer-owned ProjectorがRecord全fieldのown data descriptorをsnapshotせず状態相関の否定母集団が不足したこと、ならびにactual producer試験とproduction consumer ingestionの接続を明示できなかったことである。

追加是正では、Operation生成transactionを最初のdurable EffectからRecovery ID取得、Capability初期化および公開結果確定までへ拡張した。旧facade、Task RuntimeおよびDoctorは同じproducerを使用し、ID取得前のcleanup確認済み、cleanup不明、取得後のcleanup不明、正常production Host IDを分離する。ID未取得時は`null`のmanual／operator transfer、取得済み時だけ同じexact IDを保持する。Doctor CLIもcleanup不明を構造化し、偽cleanまたは未分類例外へ縮退しない。

Docker Process Controller contract revision 19はRecord Proxyを拒否し、全keyをown enumerable data descriptorとして一度だけsnapshotする。start／completionはOperation ID、Recovery handoff ID、cleanup資源、manual flag、status、reason、Result、Hash、byte数、取消要求、Subscription認証およびfinalization capabilityを、完了／取消／回収済み停止／cleanup不明の排他的variantとして検査する。actual Controllerの正常、clean blocked、manual blocked、cleanup不明、cancelled、blockedをProjectorへ通し、欠落、余分、rename、accessor、Proxyおよび各actual variantの1-field mutationを拒否する。同じactual出力とmutationを旧facade revision 8とTask Runtime revision 24のconsumer ingestionへ通す。

固定候補`6fdfaf705b432d5de75bc2df587967633f0f47ef`／Tree `47e9c41b40225e6cfd5e99da50fe93acb6148e63`へのSecurity、Test／UX、Document／Gap監査は、前段のMajorを解消候補とした一方、completion相関、Doctorの下位failure union、公開投影試験、およびtransaction規範の発火／非発火境界を新規Findingとした。更新候補では共有Operation creation classifierがDirectory生成とその後の取得・初期化failureを合成し、Doctorはcleanup不明を取得済みexact Host Recovery IDまたは`null`だけを持つ固定reasonへ投影する。JSONと人間表示は同じprojectorを使用し、exit 2、Path／秘密非出力、cleanup確認済みfailureの偽manual非発火を契約試験で確認する。CRDD一般則はArchitectureを正本に、残存資源またはRecovery／Authority義務を残し得る取得だけへ限定し、排他的settlementと理由付き非該当を既存工程契約へ伝播する。新しい汎用Checkerは追加しない。

現在SourceはCoordinator全1171試験、TypeScript strict typecheck、Lint、Formatter、Trace Checker、Repository全体Checker（356 Markdown、2137 link、error 0、warning 0）およびdiff checkを通過した。Operation生成transactionはline 99.11%、branch 84.62%、function 100.00%、Docker Process Controllerはline 95.25%、branch 89.51%、function 100.00%を観測した。直接Evidenceは契約試験、production Host Filesystem、actual Controller producerおよびSource内consumer ingestionであり、public CLIの正式署名package、実Provider request、networkまたは実破損Hostを新しく主張しない。更新固定Commitへの同じ監査集合がPassするまで`Resolved`、Runtime完成またはReleaseへ昇格しない。
