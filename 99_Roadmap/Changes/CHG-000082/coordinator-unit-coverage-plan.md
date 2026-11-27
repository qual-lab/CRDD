# v0.22 単体カバレッジとCoordinator分割の着手前整合

- 対象: `CHG-000082` / D-37〜D-39
- 基準: `codex/feature/v0.22` の `e2df7c74e`
- 状態: 基準測定済み。v0.22では単体カバレッジを記録し、閾値達成とCoordinatorの再配置は対象外とした。以下の移管案は再検討用の履歴。後続の全体回帰は[別の回帰記録](Evidence/261128_fixed-regression.md)で扱う。
- 確認日: 2026-11-28

## 基準測定（D-37）

Windows、Node.js v24.19.0で、各パッケージの既存 `npm run test:coverage` を実行した。結合・システム試験、実Docker、実AIは起動していない。行・分岐・関数はNodeの `all files`、ファイル数の分子は出力に載った `.ts`／`.tsx`、分母は同じ改訂版で追跡している対象拡張子の `src/` 配下（型宣言ファイルは除外）。**率の分母は読み込まれたファイルだけ**で、未ロードの実装は率に含まれない。

| パッケージ | 成功 / 登録 | 失敗 | 対象外 | 計測 / ソース | 行 | 分岐 | 関数 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| access-management | 14 / 14 | 0 | 0 | 17 / 23 | 47.96% | 73.88% | 30.09% |
| ai-adapter | 45 / 45 | 0 | 0 | 20 / 22 | 94.24% | 88.31% | 96.30% |
| checker | 91 / 92 | 1 | 0 | 29 / 33 | 40.53% | 81.47% | 71.53% |
| configuration-model | 6 / 6 | 0 | 0 | 11 / 15 | 42.69% | 92.75% | 18.60% |
| coordinator | 366 / 366 | 0 | 0 | 13 / 14 | 39.84% | 75.78% | 39.23% |
| crdd-server | 45 / 45 | 0 | 0 | 24 / 36 | 46.76% | 82.01% | 54.27% |
| docker-isolation | 43 / 45 | 0 | 2 | 32 / 36 | 35.09% | 86.17% | 39.66% |
| document-model | 197 / 199 | 2 | 0 | 64 / 79 | 86.69% | 88.61% | 87.76% |
| execution-intelligence | 3 / 3 | 0 | 0 | 9 / 10 | 26.79% | 88.89% | 15.79% |
| execution-model | 210 / 210 | 0 | 0 | 27 / 31 | 67.69% | 88.97% | 75.14% |
| executor | 112 / 112 | 0 | 0 | 6 / 7 | 70.73% | 59.66% | 66.06% |
| lock | 1 / 1 | 0 | 0 | 2 / 3 | 30.22% | 72.73% | 37.50% |
| version-control | 2 / 2 | 0 | 0 | 11 / 20 | 31.52% | 97.22% | 2.92% |
| visual-preview | 2 / 2 | 0 | 0 | 3 / 9 | 38.83% | 100.00% | 5.00% |
| workbench-ui | 2 / 2 | 0 | 0 | 1 / 34 | 100.00% | 100.00% | 100.00% |

- 初回合計は1,144件中1,139件成功、3件失敗、2件対象外。パッケージをまたいだカバレッジ率は合算しない。
- Checkerの1件は固定期待リストに `docker-restart-recovery-storage` が未追従。Document Modelの1件は固定公開集合に `recordListQueryConstraints` が未追従。どちらも単独再試験で再現した。基準改訂版の数値を改変しない。
- Document Modelの残る1件は、制限環境で単体試験用のシンボリックリンク作成が `EPERM`。許可された条件で当該1件だけ再試験し成功した。失敗を含む初回集計は上表のままとする。
- Docker Isolationの対象外2件は明示のPython設定が必要なProxy試験。Workbench UIの100%は1/34ファイルの値であり、パッケージ全体の合格ではない。
- `host-recovery:coverage` と旧 `docker-recovery-production:coverage` 由来の `docker-recovery:coverage` を撤去した。既存の非計測の結合入口は残し、単体の計測は共通の `test:coverage` で行う。
- 比較参考として暫定案90/70/80を当てると、読み込まれた範囲で三軸をすべて満たすのは AI Adapter と Workbench UI のみで、後者は1/34。この値はv0.22の合否判定に使わない。将来閾値を検討する際には、対象全体の分母、未ロードの扱い、除外理由から決める。

### 是正後の単体再計測

同じWindows／Node.js条件で、リンク作成を許可して15パッケージの`test:coverage`を再実行した。1,144件中1,142件成功、失敗0件、対象外2件（Docker Isolationの明示設定が必要なPython試験）。パッケージの通常回帰、結合／システム試験の網羅性、実Docker・実AIの成立とは別の記録とする。

| 基準測定から数値が変わったパッケージ | 行 | 分岐 | 関数 |
| --- | ---: | ---: | ---: |
| ai-adapter | 94.07% | 87.82% | 96.30% |
| coordinator | 39.84% | 75.75% | 39.23% |
| document-model | 86.76% | 88.72% | 88.03% |
| execution-model | 67.65% | 88.89% | 75.14% |

上表以外の計測値は基準測定と同じ。対象の製品ソースは変更していないため、数値差を実装の改善・悪化の根拠にしない。v0.22では数値基準を適用しない。

## 移管候補（D-39、v0.22では実施しない）

行番号は基準版の宣言開始位置。各行のヘッダー、関数の実体、専用の型・定数・private補助を同じ先へ移す。下表の範囲が重なる場合は明示した例外が優先。公開名・オーバーロード・戻り値・永続形式・既存の呼出し順序は維持し、公開入口で許す変更は内部import／明示export元の切替だけ。本文抽出型の試験を普通のimportへ全面転換するのは今回の対象外。

### 段階1 — 純粋な判断

移管先は `src/lifecycle/` 基準。1ファイルに1つの責務と対応する単体試験を置く。

| `validation.ts` の宣言範囲 | 移管先 | 関数・型・定数／例外 |
| --- | --- | --- |
| 85、1100–1158、1445–1500、1562–1784 | `input/plain-data.ts` | `ownDataValue`、`ownDataProperty`、`isPlainContainer`、`snapshotJsonValue`、`DataDescriptor`、`PlainArraySnapshot`、`dataDescriptor`、`snapshotPlainRecord`／`Array`。似た拒否規則は統合しない |
| 1785–2037 | `input/json.ts` | `ScanResult`、空白・16進定数、`skipWhitespace`、`scanString`／`Number`／`Array`／`Object`／`Value`、`parseUnambiguousJsonDocument` |
| 1245–1395 | `identity.ts` | `createCoordinatorStableId`、`objectiveQueueId`、`createProjectRecoveryApplicationId`、`hashCoordinatorContent`、`validIdentity`、`validRevision`、`isCoordinatorRecoveryIdentity`、`deriveCoordinatorRepositoryBindingId` |
| 1396–1444 | `process/cancellation.ts` | `executionAbortedGetter`・`readExecutionCancellation`。組込みgetterの捕捉は従来どおりモジュールで一度 |
| 1501–1561 | `workspace/path.ts` | `normalizeRepositoryRelativePath`、`repositoryPathWithin`。純粋なパス判断だけで、Workspaceの実体観測へ依存しない |
| 2038–2706 | `workspace/secret.ts` | 検出用の固定正規表現・集合すべて、`textFrom`から`containsRecognizedSecretMaterial`まで。D-39の関数範囲2111–2706に必要な先行定数も同居 |
| 45–84、111–340、3294–3610 | `recovery/snapshot.ts` | `RECOVERY_START_REASON_CLASS`、`snapshotReadyRecovery`／`snapshotBlockedRecoveryWithExactId`、意味別投影・理由・相関検査、`RawDockerRecoveryProjection`、`MAX_RECOVERY_ID_LENGTH`、`evaluateManagedDockerCleanupEligibility`、専用補助 |
| 341–362 | `task/admission.ts` | `projectCurrentDockerAdmission` |
| 363–652 | `task/result.ts` | `COORDINATOR_TASK_PROVIDER_PREPARATION_REASONS`、公開理由・型・集合、`projectCoordinatorTaskPublicReason`、`snapshotSingleTaskOutcome` |
| 653–837、2772–3048 | `provider/diagnostics.ts` | `ProviderBoundaryDiagnosticNotice`等の診断型、`createTaskStageDiagnostic`／`createCandidateValidationFailureDiagnostic`、Provider／Reviewer／Executor投影と専用定数・補助 |
| 838–1026、3611–3709 | `task/request.ts` | `buildObjectiveTaskRequest`／`buildObjectiveTaskExecutions`、`inspectSingleTaskCommand`、`TASK_STAGE_REQUEST_KEYS`、`snapshotCoordinatorTaskRequest`。型依存のみの関係を実行時importに変えない |
| 1027–1099、1159–1244 | `workspace/result.ts` | `inspectCoordinatorWorkspaceResults`、`inspectWorkspaceResult`。Task結果側から利用、逆参照なし |
| 2707–2771、3710–3945 | `objective/request.ts` | Objective向け文字列・選定補助、要求キー、契約、`inspectCoordinatorObjectiveRequest`・`inspectCallerTaskInputs` |
| 3049–3293 | `task/completion.ts` | `validText`、`optionalIdentity`、`isOpaqueCapability`、`inspectStartedTask`・`inspectCompletionRecord` |
| 3946–4658、5035–終端 | `objective/projection.ts` | 状態カウント、開始候補、進捗、State Queryと投影の整合検査、対応キー |
| 4659–5031 | `objective/result.ts` | `COORDINATOR_PUBLIC_RUNTIME_CONTRACT`、公開終端／拒否キー、`recoverySnapshot`、`publicBlockedSnapshot`、`inspectCoordinatorObjectiveResult`。回復値の内部写しと公開応答を別Ownerとして維持 |
| 5032 の固定値のみ | 既存 `types.ts` | `COORDINATOR_STATE_QUERY_CONTRACT`。`CoordinatorStateQueryResult`が同じリテラルを型として使うため、既存の固定語彙のOwnerへ置く。投影・照会側からのみ参照 |

### 段階2 — 保存境界・Lease・プロセス・Workspace

| `host.ts` の宣言範囲 | 移管先 | 関数・型・定数／例外 |
| --- | --- | --- |
| 72–170 | `storage/contention.ts` | `confirmStorageContinuation`、`waitForStateContention`、`StateContentionResult`、`isCleanStateContention` |
| 171–297、611–1924 | `lease/snapshot.ts` | Writer用Lease参照・更新、取得・解放・Owner喪失、`ActiveLease`、`activeLeases`、物理Lease観測と痕跡照合。物理保存領域は `storage/area.ts` を利用 |
| 298–357 | `host/lock.ts` | `acquireProviderHomeLock`、`acquireHostOperationLock`。長期実行LeaseのMapに混ぜない |
| 358–610 | `process/identity.ts` | PID・生存の三値、`CoordinatorWindowsLeaseOwnerObservation`、回復識別子、プロセス固有ID、汚染フラグ |
| 1925–2564 | `storage/area.ts` | Root・保存先・実行データ領域・Ignore保護・実行知ストアとエラー。1939–1984の `historyRepositoryInput`、`withHistoryRetention` は `storage/history.ts` |
| 2589–3106、3175–3447 | `workspace/borrow.ts` | Workspace借用、Reviewer作業領域、実体読取り、Handoffと結果の投影、`BorrowedBinding`・`borrowed`。2734–2791のGit後始末は段階3の `host/cleanup.ts` へ |
| 5871–6231、6337–終端 | `repository/operation.ts` | `Binding`、`bindings`／`capabilities`、`bindRepositoryOperation`、`currentBinding`、通常／終端の保存受付、`borrowRepositorySource`。Host管理能力の上位 |
| 6232–6336 | `repository/storage.ts` | `borrowCoordinatorRecoveryRepository`、`recoveryStorageInput`、`resolveRecoveryHostRoot`。Host能力を読まない下位 |
| `environment.ts` 1602、1616–1793、1834 | `provider-home/observe.ts` | `readConfiguredLocalAppDataDirectory`、`providerHomesDirectoryCandidate`、`providerHomeMountSourceCandidate`、`providerHomeWindowsAdapterBlocked`、`inspectWindowsProviderHomeCandidate`、`PROVIDER_HOME_ROOT_SEGMENTS`。次の公開投影のJSDocと契約ID・公開用投影は据置 |
| `environment.ts` 1903–2072 | `provider-home/path.ts` | パス文法、上限値、予約名、Case変換の固定Map、関連補助。Provider Home観測だけの下位部品 |

### 段階3 — Host操作・回復

| 基準版の宣言範囲 | 移管先 | 関数・型・定数／例外 |
| --- | --- | --- |
| `host.ts` 3107–3174、3448–3516、4110–4180 | `host/failure.ts` | 作成・公開失敗の三つの識別表、型、生成・分類。表を合体せず能力は返さない |
| `host.ts` 4280、4697–4786 | `input/host-observation.ts` | `isObject`、`ownValue`、`ownString`、`errorCode`、`errorMessage`。Host内部の同じ判断を下位へ移し、他ファイルにある類似関数とは統合しない |
| `host.ts` 3585–3636、4787–4834、4877–5061 | `host/filesystem.ts` | 存在／明示不存在／不明、実体・Directory Snapshot・直列化だけ。能力照合はここへ下げない |
| `host.ts` 2565、3637、3668–3680 | `host/types.ts` | `OperationPaths`、`OperationDirectories`、`HostOperationRecording`、`HostOperationInput`、`HostRecord`の型。Host・Workspace共用型と記録／操作共用型から上位を参照しない |
| `host.ts` 3681–3879 | `host/record.ts` | `HostState`、`HostRecoveryRead`、`readHostGenerationSnapshot`、`freshHost`、`hostRecordingAccess`、`requireHostExecutionCurrent`、`writeHostCheckpoint`、子領域とRoot解決。EMの同じ保存正本を作成・回復が使う |
| `host.ts` 2734–2791、3982–4063 | `host/cleanup.ts` | Git参照の既存回収、`cleanupHostRoot`。現在記録の照合 → Git回収 → pending → 除去 → 不存在 → confirmed／unknown の既存順序 |
| `host.ts` 3517–3679、3880–3900、4064–5764の残り | `host/operation.ts` | 作成・本番/占有Capability、生成・失効、`recordOwnedHostResources`／`readOwnedHostOperation`、実体照合済みの清掃結果。他行で扱う共用型・記録・失敗・値検査・実体観測・回復専用宣言は除外 |
| `host.ts` 3901–3981、4399–4573、5765–5799 | `host/recovery.ts` | 生成済みHost回復の観測・保存・世代取得／解放・管理領域の借用・再入場。元能力の唯一のMapを所有 |
| `host.ts` 5810–5870、3562の固定名 | `host/policy.ts` | `describeFilesystemPolicy`、`credentialEnvironmentNamesPresent`、`CREDENTIAL_ENV_NAMES`。Host能力の管理をしない |
| `environment.ts` 6927–8447 | `recovery/record.ts` | `beginDockerRecovery`〜`recordAttemptCleanup`の実体。範囲直前の `HEX64`、`CREATE_PURPOSES`、`ProductionPlan`、`DurableRecord`、`durableRecords`、Executor結合／取消／保持終了も同居 |
| `environment.ts` 8448–終端 | `task/remediation.ts` | `ReviewFindings`、`reviewRemediations`、許可の登録／一回消費。 `registerReviewFindings` は記録Ownerに残しこちらを呼ぶ |

`execution.ts`の調停本体、`environment.ts`の大きなDoctor・修復・再起動、既存 `dockerRecoveryPreparations` を使う回復準備本体は現段階では動かさない。呼出し側のimportのみ追従する。範囲指定と公開契約の衝突が出たら、まず必要最小の協力宣言だけを移す案と据置案を比較し、段階4の関数をまとめて前倒ししない。

## 共有状態の持ち主

基準のモジュール直下にある表・フラグと、一度だけ捕捉する値を対象にした（関数内の一時Map、ローカル変数は除外）。固定ルール表もOwnerを明示するが、実行状態／Authorityとは区別する。

| 元 | 共有状態・固定表 | 移管後の唯一のOwner |
| --- | --- | --- |
| host | `processCleanupUnknown`、一度だけ生成する `executionProcessInstanceIdentity` | `process/identity.ts` |
| host | `activeLeases` | `lease/snapshot.ts` |
| host | `productionOperationFailures`、`failures`、`ownedOperationDirectoryCreationFailures` | `host/failure.ts` |
| host | `borrowed` | `workspace/borrow.ts` |
| host | `ownedIdentities`、`mountCapabilities`、`operationContextCapabilities`、`operationContextAliases`、`operationManagementCapabilities`、`operationGenerationsByKey`、`operationGenerationByRoot`、`ownedOperationCleanupOutcomes` | `host/operation.ts`。世代の二索引は一緒に維持 |
| host | `hostOperationRecoveryGenerations` | `host/recovery.ts` |
| host | `bindings`、`capabilities` | `repository/operation.ts` |
| validation | `RECOVERY_START_REASON_CLASS`、`coordinatorTaskPublicReasonSet`、`JSON_WHITESPACE` | 順に `recovery/snapshot.ts`、`task/result.ts`、`input/json.ts` |
| validation | `SENSITIVE_BASENAMES`、`SENSITIVE_EXTENSIONS`、`NON_SECRET_ENV_SUFFIXES`、`SOURCE_CODE_EXTENSIONS` | `workspace/secret.ts` |
| validation | `PROVIDER_TURN_OBSERVATION_KEYS`、`REVIEWER_FINDING_DIAGNOSTIC_KEYS`、`REVIEWER_PROJECTION_KEYS` | `provider/diagnostics.ts` |
| validation | `TASK_STAGE_REQUEST_KEYS`、`requestKeySets` | 順に `task/request.ts`、`objective/request.ts` |
| validation | `resultKeys`、`projectionKeys`、`queryKeys`、`OBJECTIVE_RESULT_KEYS`、`PUBLIC_BLOCKED_RESULT_KEYS` | 前3件は `objective/projection.ts`、後2件は `objective/result.ts` |
| environment | `reservedNameSpecialUppercaseMapping`、`CREATE_PURPOSES`、`durableRecords`、`reviewRemediations` | 順に `provider-home/path.ts`、`recovery/record.ts`（2件）、`task/remediation.ts` |
| environment | `doctorOperationInitializationFailures`、`DOCTOR_OPTION_KEYS`、`dockerRecoveryPreparations` | `environment.ts` に据置。既存の隔離設定・診断Reporterの初期化も据置 |

## 依存方向と実装への移行条件

```text
公開入口・execution.ts・environment.ts（段階4の本体は据置）
   → recovery/record.ts → host/recovery.ts、host/operation.ts、repository/operation.ts、provider-home/observe.ts、task/remediation.ts
   → workspace/borrow.ts → repository/operation.ts → host/operation.ts
                                      host/recovery.ts・host/operation.ts
                                                  → host/cleanup.ts → host/record.ts
                                                  → host/filesystem.ts・host/lock.ts
                                      lease/snapshot.ts → storage/area.ts
                                      host/record.ts → repository/storage.ts・storage/area.ts
各層 → 純粋な入力・パス・ID・診断投影へ。逆方向のimportなし。
```

- 行切りだけでは循環する。作成と回復が同じ記録／清掃を呼び、回復側だけに置くと作成からの逆参照になる。共用の記録・清掃を下へ、稼働中能力に依存するRepository結合と借用WorkspaceはHostより上へ分ける。実際の状態や責務への依存を、作業段階の番号とは区別する。
- 直接参照も同じ向きにする。借用Workspace → Host記録・操作と保存領域、Host回復 → Host記録とRepository保存先・保存領域、Host操作 → Host記録と失敗分類、Host清掃 → 実体観測、Host排他 → 保存領域。操作・回復・Workspaceが共有する境界型は `host/types.ts` から参照し、型importの逆辺も作らない。
- 値の投影は `objective/result.ts` → `objective/projection.ts`、`task/result.ts` → `workspace/result.ts` の向きにする。公開入口は能力発行側ではないため、投影や入力検査から逆に参照しない。
- 現行の `types.ts` → `validation.ts` のState Query定数への型逆参照は、定数を既存の共有型・固定語彙Ownerへ移して解く。`objective/projection.ts` と `query.ts` は同じ値を読み、リテラルを複製しない。
- Docker回復記録から `environment.ts` へ戻る辺は、Provider Home観測の依存閉包を先行移管し、Task是正許可も独立させて消す。現在回復の `dockerRecoveryPreparations` と実行中の `durableRecords` は別の能力であり、統合しない。
- `coordinator/tests/` の3旧パスの完全リテラル参照は134ファイル。普通のimport、本文抽出、mock、動的importは重なり、134は本文抽出の確定件数ではない。分割作業では参照した宣言ごとに分類して追従する。特に `tests/support/recovery.ts` は置換する回復記録の本文と、代役が参照するProvider Home観測のURLを別々に更新する。Server／Checkerからのソース参照も利用側として照合する。
- 新ファイルの単体試験（基準のCoordinatorは51ファイル）は、担当ファイルと成立する分岐を1対1で追跡する。公開APIの値・型の集合、実体変更時の拒否、単一Mapと世代、排他取得／解放・CAS・保存順序、取消と観測不能の区別は既存の境界試験でも維持する。結合・システムは合否を確認するが計測しない。網羅を証明する方式はD-38により今回未決。
- 移管を始めた後は各段階で `symbol.json`・台帳・設計書・利用側を同期し、追跡ファイルの未登録0件、Source・型import双方の循環0、公開差分0を確認する。固定候補で静的確認、Portable、実Dockerを除くHost Windows、単体計測、独立レビューを実施する。準拠基準・リリースの監査は今回の候補整理には追加しない。段階4の2ファイルは進行制御・巨大関数の分離を次版へ保留し、未達を合格扱いしない。
