# Coordinator Reference Runtime Architecture

Status: Implementation Candidate

## 1. 文書責務

本書は、エージェント組織（Agent Organization）を実証するCoordinator Reference Runtimeの実行Architecture正本である。Runtime固有の実行シーケンス、状態、資源所有、Lock順序、回復および結果公開条件を所有する。

上位概念、費用原則、独立レビュー、決定権限および人間との境界は[`04_Agent_Organization.md`](../../../04_Agent_Organization.md)を正本とする。構築、利用、コマンドおよび運用案内は[`tools/coordinator/README.md`](../README.md)、実装は[`src`](../src)、検証は[`tests`](../tests)を参照する。本書はCRDD全体または別Runtimeへこの実装方式を要求しない。

機械可読な接続投影は[`coordinator-runtime-traceability.json`](../runtime/coordinator-runtime-traceability.json)を用いる。JSONは本書の意味を置き換えず、宣言した状態、資源、遷移、不変条件および検証接続の孤立・欠落を検出するための投影である。

## 2. 公開実行境界

現在の実行可能な中心経路は、正式署名配布物から開始するLocal Personal一般Taskである。

```text
Human / Front Agent
  ↓ bounded task request
Coordinator Task Runtime
  ↓ selected Executor
Provider Adapter / Docker Process Controller
  ↓ isolated local Candidate
Independent Reviewer
  ↓ approved exact Candidate
Coordinator cleanup / Result integration
  ↓
Human
```

Provider同士を直接spawnさせない。Provider出力、Runtime内部Path、Credentialおよび未検証Candidateを結果へ直接公開しない。Canonical Repositoryへのcommit、push、merge、tag、Releaseまたは公開Effectを許可しない。

Candidate管理、Docker Task明示RecoveryおよびWindows Docker Desktop最終復旧は別の公開Lifecycleである。`activate`、`disable`および`provision`の未実装Effect前停止を一般Taskの成立経路へ混入させない。

## 3. 主実行シーケンス

| 段階 | 状態ID | 主な処置 | 次へ進む条件 |
|---|---|---|---|
| 受付 | `STATE-ADMISSION` | Package、Process poison、Task byte、Repository形式を確認 | 全preflight成立 |
| Operation準備 | `STATE-OPERATION-READY` | Docker Recovery inventory、Operation Root、Host generation、Repository／Revisionを固定 | Host Supervisor readyと同一generation再確認 |
| 実行許可 | `STATE-TASK-AUTHORIZED` | Policy、Slate、Candidate Store、External Send Grant、Workspaceを確定 | Authority、Revision、Scopeが一致 |
| Executor完了 | `STATE-EXECUTOR-CLEAN` | Provider Home、Mount Grant、Task Packet、Docker Recovery、Executor、cleanupを実行 | Docker不存在、mount完了、finalizable handoff |
| Candidate固定 | `STATE-CANDIDATE-CAPTURED` | 実差分、許可Path、開始RevisionからCandidateを固定 | Executor申告と実差分一致 |
| Reviewer完了 | `STATE-REVIEWER-CLEAN` | 独立ContextでReviewerを実行しcleanup | approvedまたは一回是正へ限定 |
| 是正許可 | `STATE-REMEDIATION-AUTHORIZED` | 同じExecutorへbounded findingだけを返す | 一回だけ再実行し同じReviewerへ戻る |
| 是正Executor完了 | `STATE-REMEDIATION-EXECUTOR-CLEAN` | 一回限りの同一Executor是正とStage cleanup | 再Candidateを固定 |
| 是正Candidate固定 | `STATE-REMEDIATION-CANDIDATE-CAPTURED` | 是正後の実差分からCandidateを固定 | 同じReviewerへ一回だけ返す |
| 是正Reviewer完了 | `STATE-REMEDIATION-REVIEWER-CLEAN` | 同じ独立Reviewerが是正後Candidateを再評価 | 承認時だけ保存。再是正へ戻らない |
| Candidate保存 | `STATE-CANDIDATE-STAGED` | 再照合したCandidateを一時Storeへstaged保存 | exact Recovery ID取得 |
| Host回収 | `STATE-HOST-CLEAN` | 全Docker Host-cleanup intent、Operation cleanup、receipt、finalize | Host／Docker未解決0 |
| 結果公開 | `STATE-RESULT-PUBLISHED` | Candidateをpublishし安全な構造化結果を返す | cleanupとCandidate再検証済み |
| 安全な停止 | `STATE-BLOCKED-CLEAN` | Resultを公開せず、所有資源不存在とRecovery不要を確認 | Operation終了 |
| 回復待ち | `STATE-RECOVERY-REQUIRED` | exact Recovery IDとEvidenceを保持して停止 | 明示Recoveryの成立 |
| 回復完了 | `STATE-RECOVERED` | 所有資源不存在と耐久Evidence残存0を確認 | 新しいOperationから再評価 |

`invocationTerminal`は現在のCLI／Task呼出しが終了すること、`operationTerminal`は当該Operationに後続処置が残らないことを表す。`STATE-RECOVERY-REQUIRED`は現在の呼出しではterminalだがOperationとしては未完了であり、別の明示Recovery invocationだけが`STATE-RECOVERED`へ進める。

## 4. 資源所有

| 資源ID | 資源 | 所有者 | 所有期間 | 終了後条件 |
|---|---|---|---|---|
| `RES-HOST-GENERATION` | Host Operation Rootとgeneration | Task Runtime＋Supervisor Process | Operation作成からHost cleanupまで | Supervisor release確認、Root不存在またはexact Recovery保持 |
| `RES-LOGICAL-HOME-LOCK` | logical Provider Home kernel lock | Docker Recovery Runtime | 各Executor／Reviewer Stageまたは明示Recoveryのmutation区間 | Stageごとにrelease確認。不明時だけRecovery責務へ移送 |
| `RES-RUNTIME-STATE-LOCK` | Runtime State global kernel lock | inventory／mutation実行者 | 短い再観測・更新区間 | release確認 |
| `RES-INTERACTIVE-CONSOLE` | console lock、reader、handle | External Send同意Lifecycle | 初期同意の表示から入力・取消・reader終了まで | handle／reader／lock回収確認 |
| `RES-MOUNT-GRANT` | Provider Home Mount Grant／active mount | Mount Grant Runtime | StageのissueからDocker cleanupまで | completeまたはRecoveryへ移譲 |
| `RES-DOCKER-OWNED` | container、network、Docker CLI child | Docker Process Controller | submissionからexact不存在確認まで | IDとnameの不存在確認 |
| `RES-OPERATION-WORKSPACE` | 隔離WorkspaceとOperation Directory | Repository／Task Runtime | materializeからHost cleanupまで | Root不存在またはHost Recovery保持 |
| `RES-CANDIDATE-ENTRY` | staged／published Candidate | Candidate Store | Reviewer承認後から期限、exportまたはdiscardまで | entry不存在またはStore Recovery保持 |
| `RES-TASK-CONTROL` | Task control、Docker handoff、cancel state | Task Runtime process | startからcompletion最終settlementまで | control失効、durable Recoveryへ必要情報移譲 |
| `RES-CLI-SIGNAL-BINDING` | SIGINT／SIGTERM listener | CLI | Task startedからcompletion後unbindまで | listener解除確認 |

## 5. Lock順序と解放窓

通常TaskとHost状態を扱う明示Recoveryは、次の順序を守る。

```text
RES-HOST-GENERATION
  → RES-LOGICAL-HOME-LOCK
    → RES-RUNTIME-STATE-LOCK
```

Host Effect不存在をfresh Evidenceから確認済みのcleanup-only Recoveryだけは、`RES-LOGICAL-HOME-LOCK → RES-RUNTIME-STATE-LOCK`で残骸を処置できる。

Runtime State lockを保持したまま、native observation、Docker CLIまたは長時間Host Effectを実行しない。Windows native resource境界で必要な場合はHost generationも一時解放する。解放窓では新しいAuthorityを発行せず、再取得後かつ最初の後続Effect前に次を全て再確認する。

- Host Rootとnonce
- Runtime State Root IdentityとProtection
- selected-user／logical Home binding
- Filesystem Identity
- 対象Recovery ID、base、journalおよび全inventory

一つでも不一致、取得不能または解放不明なら`STATE-RECOVERY-REQUIRED`へ進み、成功を公開しない。

## 6. 耐久状態

耐久JSONはcontent fileとcommit sidecarのpairである。content確定とsidecar確定の間にProcessが終了できるため、次を別状態として扱う。

| 状態 | 分類 | 処置 |
|---|---|---|
| contentもcommitも不存在 | 未開始または処置済み | 周辺EvidenceとEffect発行履歴を確認 |
| content＋commitが完全一致 | committed | 通常遷移候補 |
| exact contentだけ存在 | `STATE-DURABLE-PAIR-PARTIAL-PRE-EFFECT` | Effect前でsuccessorが一意な利用側だけ、期待値・Host世代・Effect非発行・commit不存在を再確認して決定論的rollback。その他は回復待ち |
| commitだけ存在 | 異常 | Evidence保持、処置0 |
| content／commit不一致 | 異常 | Evidence保持、処置0 |
| replacement／link／unknown entry | 異常 | Evidence保持、処置0 |

Host側`active-docker-task-v1.json`のcontent-only状態は、同期的なcommit sidecar確定より前、かつHost generation Effectより前の到達可能中間状態である。明示Recoveryは、同一Lock内でHostがprevious世代、全submission不存在、baseが完全一致し、committed pointerのschema／stable Home／operation name／Recovery ID／base hashが完全一致し、active bindingのschema／Recovery ID／base hash／operation nonceが完全一致し、active commit sidecarが不存在の場合だけ当該contentをrollbackする。通常完了、通常receipt replay、crash receipt replay、Effect前rollbackおよびfresh crash recoveryの全削除経路は、同じactive binding／pointer閉包を削除前に検証する。active bindingが存在するのにpointerが欠落・partial・置換、不一致または観測不能なら、どちらも削除せず`STATE-RECOVERY-REQUIRED`を維持する。active bindingが既に不存在でexact committed pointerだけが残る非対称状態は、pointerの完全一致を確認して再開できる。

## 7. cleanup依存順

```text
Provider child／Docker resource absence
  → RES-MOUNT-GRANT完了
  → Docker handoff finalizable
  → 全Stageのcleanup projection一致
  → Host cleanup intent
  → RES-OPERATION-WORKSPACE／RES-HOST-GENERATION回収
  → Host cleanup receipt
  → Docker Recovery finalize
  → RES-CANDIDATE-ENTRY publishまたはdiscard
  → STATE-RESULT-PUBLISHED
```

途中の一件が不明でも、後続の成功から前段の回収を推定しない。複数Stage、複数Docker handoff、CandidateおよびStore Recovery IDを件数で丸めず、現在も処置可能な全IDを保持する。

## 8. 不変条件

| 不変条件ID | 条件 |
|---|---|
| `INV-NO-PROVIDER-EFFECT-BEFORE-AUTHORITY` | Repository、Policy、Scope、Grant、RevisionおよびRecovery記録成立前にProvider Effectを発行しない |
| `INV-LOCK-ORDER-AND-REVALIDATION` | Lock順序を守り、解放窓後は同一identityと全inventoryを後続Effect前に再確認する |
| `INV-DURABLE-BEFORE-EFFECT` | 外部またはHost Effectの前に、再構成に必要なintent／submissionをcommit済みにする |
| `INV-STAGE-CLEAN-BEFORE-HANDOFF` | Executor／Reviewerの結果を次Stageへ渡す前に、そのStageのchildとDocker cleanupを確認する |
| `INV-CANDIDATE-EXACT-AND-NONCANONICAL` | Candidateは開始Revisionと許可Pathへ固定し、Canonical Repositoryへ直接適用しない |
| `INV-BOUNDED-REMEDIATION` | Reviewer findingは一回だけ同じExecutorへ返し、同じReviewerが再評価する |
| `INV-RESULT-AFTER-CLEANUP` | Host、Docker、Mount、Candidateおよびsignal cleanup確認後だけ成功結果を公開する |
| `INV-CLEAN-BLOCK-HAS-NO-RECOVERY` | 安全なblockedは所有資源不存在かつactionable Recovery ID 0の場合だけ成立する |
| `INV-UNKNOWN-PRESERVES-RECOVERY` | 状態またはcleanupが不明ならEvidenceと全actionable Recovery IDを保持して停止する |

## 9. 正常・準正常・異常

| 区分 | 代表条件 | 期待結果 |
|---|---|---|
| 正常 | 4経路、承認、必要なら一回是正、全cleanup | Candidate公開、Recovery ID 0、残存資源0 |
| 準正常 | 明示拒否、Provider timeout／nonzero／結果不正、duplicate cancel、Lock競合、Effect前の一意なpartial pair | 安全なblockedまたは決定論的回復。未知状態へ誤昇格しない |
| 異常 | lock解放不明、generation置換、pair不一致、create結果曖昧、親Process消失、cleanup不明、複数Recovery競合 | Result非公開、Evidence保持、exact Recoveryまたはoperator移送 |

各高リスク遷移は、その遷移に適用可能と宣言した正常・準正常・異常区分の検証接続を機械可読Traceで持つ。検証ケースは遷移ID、開始状態、期待終了状態、Effect件数、結果状態および資源後条件を宣言し、遷移×開始状態×区分をCheckerが照合する。テスト名の存在だけ、非該当区分の形式的な水増し、試験件数またはcoverage率だけを状態母集団の網羅根拠にしない。

## 10. 遷移一覧

| 遷移ID | From | To | 主な意味 |
|---|---|---|---|
| `TRANS-ADMISSION-TO-OPERATION` | `STATE-ADMISSION` | `STATE-OPERATION-READY` | Effect前preflightとHost generation確立 |
| `TRANS-OPERATION-TO-AUTHORIZED` | `STATE-OPERATION-READY` | `STATE-TASK-AUTHORIZED` | Policy、Slate、同意、Workspace確立 |
| `TRANS-AUTHORIZED-TO-EXECUTOR-CLEAN` | `STATE-TASK-AUTHORIZED` | `STATE-EXECUTOR-CLEAN` | Executor StageとStage cleanup |
| `TRANS-EXECUTOR-TO-CANDIDATE` | `STATE-EXECUTOR-CLEAN` | `STATE-CANDIDATE-CAPTURED` | 実差分からCandidate固定 |
| `TRANS-CANDIDATE-TO-REVIEWER-CLEAN` | `STATE-CANDIDATE-CAPTURED` | `STATE-REVIEWER-CLEAN` | 独立ReviewerとStage cleanup |
| `TRANS-REVIEWER-TO-REMEDIATION` | `STATE-REVIEWER-CLEAN` | `STATE-REMEDIATION-AUTHORIZED` | bounded findingを同じExecutorへ一回だけ返す |
| `TRANS-REMEDIATION-AUTHORIZED-TO-EXECUTOR-CLEAN` | `STATE-REMEDIATION-AUTHORIZED` | `STATE-REMEDIATION-EXECUTOR-CLEAN` | 一回限りの是正ExecutorとStage cleanup |
| `TRANS-REMEDIATION-EXECUTOR-TO-CANDIDATE` | `STATE-REMEDIATION-EXECUTOR-CLEAN` | `STATE-REMEDIATION-CANDIDATE-CAPTURED` | 是正後Candidate固定 |
| `TRANS-REMEDIATION-CANDIDATE-TO-REVIEWER-CLEAN` | `STATE-REMEDIATION-CANDIDATE-CAPTURED` | `STATE-REMEDIATION-REVIEWER-CLEAN` | 同じReviewerによる一回限りの再評価 |
| `TRANS-REVIEWER-TO-STAGED` | `STATE-REVIEWER-CLEAN` | `STATE-CANDIDATE-STAGED` | 承認Candidateの一時保存 |
| `TRANS-REMEDIATION-REVIEWER-TO-STAGED` | `STATE-REMEDIATION-REVIEWER-CLEAN` | `STATE-CANDIDATE-STAGED` | 是正後に承認されたCandidateの一時保存。再是正経路なし |
| `TRANS-STAGED-TO-HOST-CLEAN` | `STATE-CANDIDATE-STAGED` | `STATE-HOST-CLEAN` | Host／Docker finalize |
| `TRANS-HOST-CLEAN-TO-RESULT` | `STATE-HOST-CLEAN` | `STATE-RESULT-PUBLISHED` | Candidate publishと結果公開 |
| `TRANS-ACTIVE-TO-BLOCKED-CLEAN` | active state | `STATE-BLOCKED-CLEAN` | cleanup確認済みでRecovery不要の安全な停止 |
| `TRANS-ACTIVE-TO-RECOVERY` | active state | `STATE-RECOVERY-REQUIRED` | 取消、失敗、Process lossまたはunknownの保持 |
| `TRANS-PARTIAL-PAIR-TO-RECOVERY` | `STATE-DURABLE-PAIR-PARTIAL-PRE-EFFECT` | `STATE-RECOVERY-REQUIRED` | 未設計のEffect前partialを保持して停止 |
| `TRANS-RECOVERY-TO-RECOVERED` | `STATE-RECOVERY-REQUIRED` | `STATE-RECOVERED` | exact資源回収とEvidence残存0 |

機械可読Traceの`verificationBoundaryByBinding`は、試験が契約投影だけを検査する`contract_projection`か、実Filesystem／実Processを観測する`actual_filesystem_process`かを区別する。将来の公開CLIおよび署名済みE2Eはそれぞれ`public_cli`、`signed_e2e`として追加し、fixtureの自己申告を物理観測済みと表現しない。

## 11. 変更と検証

状態、遷移、資源、Lock、Recoveryまたは結果公開条件を変更する場合、同じ変更で次を更新する。

1. 本書
2. 機械可読Trace
3. 実装
4. 正常・準正常・異常の検証
5. 現在品質状態とCHG Evidence

具体的なRuntimeで得た学びは、同Runtimeだけの条件なら本書へ残す。別RuntimeまたはCRDD全体にも適用でき、実証で有効性を確認した原則だけを、決定権限を持つ上位正本へ別途昇格させる。
