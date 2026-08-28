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

- `tools/coordinator/architecture/README.md`へ主実行シーケンス、Architecture上の10資源、Task Traceが直接観測する9資源、17状態、Lock順序、耐久pair、cleanup依存順、9不変条件および17遷移を固定した。clean blocked、一回限りで循環しないbounded remediation、Host clean後のRecoveryと別Recovery invocationを分離した。
- `tools/coordinator/runtime/coordinator-runtime-traceability.json`へ最小機械可読投影を追加し、6検証接続・41の状態別caseへ再構成した。契約投影と実Filesystem／Process観測を区別した。
- Coordinator専用Checkerはexact entity shape、Schema、ID、参照、孤立、risk、operation／invocation terminal遷移、検証境界、遷移×開始状態×区分、期待終了状態、Effect件数、結果状態、資源後条件、Architecture記載およびtest source上のexact test名を検査する。試験実行結果、品質状態または監査Passは主張しない。
- Host active bindingのcontent rename直後へ実process killを注入し、同一Lock内でHost previous世代、全submission不存在、exact base、完全commit済みpointer、active binding完全一致およびactive commit不存在の場合だけ明示Recoveryでrollbackして残存0へ収束することを確認した。
- 同じpartial contentを変更した異常例、期待値の異なるjournal content、完全commit pairでは処置せずEvidenceを保持することを確認した。
- 最新対象確認はTask／Docker Recovery／Journal／Traceability／公開理由分類を含むCoordinator全1085試験、TypeScript strict typecheck、Lint、Formatter、Trace CheckerおよびRepository全体Checker（error 0、warning 0）を対象とする。独立再監査へ渡す固定改訂版で結果を確定する。

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
