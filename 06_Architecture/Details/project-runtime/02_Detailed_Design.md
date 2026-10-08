# Orchestratorの状態・資源詳細設計

状態: 設計候補
担当責任者: Qual-Lab
最終更新日: 2026-10-08

## Related

- [Orchestratorアーキテクチャ](01_Architecture.md)
- [責務再編の計画](../../../99_Roadmap/Changes/CHG-000082/Evidence/261007_develop-responsibility-mapping.md)
- [Project Runtime責務分離](../../../99_Roadmap/Changes/CHG-000063/change.md)
- [検証設計](../../../07_Quality/03_Verification_Design.md)

<a id="historical-design-reference"></a>

### 過去版の参照

本書は現在の設計だけを更新する。v0.19.0時点の詳細設計と当時の件数は、現行文書へ上書きせず、`Git tag v0.19.0:06_Architecture/Details/coordinator/03_Project_Runtime_Design.md`で参照する。現在の件数と契約は本書および機械可読な設計対応から取得し、過去版の件数を現在値として利用しない。

## 1. 目的と所有範囲

本書はProject Runtimeの現在有効なInterface、永続Record、資源、Lock、Authority、Effect、状態遷移、不変条件および失敗注入点を所有する。版ごとの旧設計文書は現行Treeへ累積せず、当時の内容は対応するGit tagで保持する。

[上位アーキテクチャ](01_Architecture.md)は責務、依存方向、公開APIと通知、Platform境界を所有する。[機械可読な設計対応](../../../07_Quality/Registry/project-runtime-design-traceability.json)は本書を再定義せず、設計と実装・試験の対応切れを検出する検証用投影である。現行Symbol・旧実装Pathの対応表は移管前の基準であり、新配置の成立済み根拠ではない。Interface、Record、遷移とSemantic KeyはFolder改名だけで再採番しない。

<a id="detailed-design-contract"></a>
## 2. Interface

| ID | 所有者 | 実装状態 | 実装段階 |
|---|---|---|---|
| `IF-PROJECT-CORE` | `project_runtime_core` | `partial` | `durable_foundation_through_integration` |
| `IF-SINGLE-TASK` | `single_task_adapter` | `partial` | `responsibility_separation_and_single_task_flow` |
| `IF-STATE-STORE` | `project_state_store` | `partial` | `durable_foundation` |
| `IF-QUEUE` | `durable_operation_queue` | `partial` | `durable_foundation` |
| `IF-SCHEDULER` | `project_scheduler` | `partial` | `multi_task_execution` |
| `IF-INTEGRATION` | `integration_owner` | `partial` | `integration_and_adoption` |
| `IF-TRANSPORT` | `transport_adapter` | `partial` | `single_task_flow` |
| `IF-DECISION` | `human_decision_controller` | `partial` | `human_decision_flow` |
| `IF-PLATFORM` | `platform_adapter` | `partial` | `responsibility_separation` |

### 再編後の実装担当

上表の所有者値は論理的な役割である。実装Packageと混同せず、次の担当へ対応する。既存IDを下位APIの実装型へ移すだけの逆依存は作らない。

| Interface | 新しい実装担当 | 保存・呼出し境界 |
|---|---|---|
| `IF-PROJECT-CORE`、`IF-QUEUE`、`IF-SCHEDULER` | Orchestrator | 純粋な選択・遷移と、業務操作による状態保存を分ける。 |
| `IF-SINGLE-TASK` | Coordinator公開API | Orchestratorが縮小したTaskを渡す。Provider差はAI Adapter、実資源終了はCoordinatorが観測する。 |
| `IF-STATE-STORE` | Orchestrator | Project Schema、現在状態、受付世代、Queue、判断と未解決参照を所有する。共通保存原語はDomain Model、OS排他はPlatform Accessを利用する。 |
| `IF-INTEGRATION` | Orchestrator | 候補本体とMetadataはCoordinatorから読取り、Integration Record、明示採用、ReceiptとRevision検査はOrchestratorが所有する。 |
| `IF-TRANSPORT` | MCP Server、Workbench Server、薄い配布CLI | 同じOrchestrator公開要求・結果検査を利用する。Coordinator libraryから上位操作を再exportしない。 |
| `IF-DECISION` | Orchestrator | 判断の意味と適用世代を所有する。保護保存原語はPlatform Access、非秘密の現在適用は状態Snapshotへ保存する。 |
| `IF-PLATFORM` | Platform Access、Coordinator | OS原語はNative、実行・回復意味はCoordinator、上位再入場と判断相関はOrchestrator。Nativeへ業務状態を移さない。 |

Coordinatorの開始・終了通知を受けるだけでは、`REC-TASK-ATTEMPT`やQueueの保存確定は成立しない。Orchestratorが通知Identityと現在世代を検査し、状態保存を読戻しした後だけ上位状態を投影する。取消とPrimary Failure／cleanupの扱いは[公開操作の通知契約](01_Architecture.md#72-通知取消と保存確定)へ接続する。

### 2.1. 既存候補の採用境界

`IF-INTEGRATION`は[候補採用の引渡し契約](01_Architecture.md#qualityへの引渡し)に従い、Candidate Storeから同じ候補を再読取りし、明示採用AuthorityとAdoption Lease、現在Revision、dirty Pathおよび許可Scopeを確認してから正本へ反映する。候補IdentityをIntegration Recordへ完全に保持し、採用Receiptの耐久記録とLease解放を確認する。拒否時は正本Effect 0、settlement不明時は同じRecovery義務を保持し、採用によるCommit／Pushは発行しない。候補生成と候補採用を同じ成功状態へ畳まない。

## 3. 永続Record

| ID | 所有Interface | 資源 | 耐久化の意味 | 必須意味 |
|---|---|---|---|---|
| `REC-PROJECT-STATE` | `IF-STATE-STORE` | `RES-PROJECT-STATE` | `generation_state` | — |
| `REC-QUEUE-ENTRY` | `IF-QUEUE` | `RES-PROJECT-QUEUE` | `before_effect_intent` | — |
| `REC-PROJECT-LEASE` | `IF-QUEUE` | `RES-PROJECT-OPERATION-LEASE` | `before_effect_intent` | — |
| `REC-TASK-ATTEMPT` | `IF-PROJECT-CORE` | `RES-SINGLE-TASK-BINDING` | `before_effect_intent` | `attempt_operation_authority_binding`<br>`start_phase_reserved_handoff_prepared_running_or_settled`<br>`typed_recovery_obligations_host_docker_candidate_or_candidate_store`<br>`per_obligation_phase_required_recovering_settled_or_docker_acknowledged`<br>`docker_acknowledgement_exact_project_logical_operation_repository_result_and_first_generation_binding`<br>`unresolved_recovery_without_synthetic_identity` |
| `REC-INTEGRATION` | `IF-INTEGRATION` | `RES-INTEGRATION-WORKSPACE` | `after_effect_result` | — |
| `REC-ADOPTION` | `IF-INTEGRATION` | `RES-ADOPTION-LEASE` | `after_effect_receipt` | — |
| `REC-HUMAN-DECISION` | `IF-DECISION` | `RES-PENDING-DECISION` | `generation_state` | `decision_project_milestone_generation_revision`<br>`selected_user_principal`<br>`continuation_record_id`<br>`decision_application_generation`<br>`decision_lifecycle_state` |
| `REC-DECISION-CONTINUATION` | `IF-DECISION` | `RES-DECISION-CONTINUATION` | `before_effect_intent` | `continuation_hash`<br>`selected_user_principal`<br>`decision_project_milestone_generation_revision`<br>`continuation_expiry`<br>`continuation_consumed_or_invalidated_state`<br>`replacement_request_identity`<br>`decision_application_id`<br>`expected_project_generation`<br>`new_project_generation`<br>`application_disposition_issued_prepared_finalized_recovery_invalidated_or_expired` |
| `REC-DECISION-RECOVERY-INTENT` | `IF-PLATFORM` | `RES-DECISION-RECOVERY-INTENT` | `before_effect_intent` | `exact_continuation_record_identity`<br>`last_confirmed_disposition`<br>`decision_application_id`<br>`expected_project_generation`<br>`new_project_generation`<br>`unknown_observation_boundary`<br>`recovery_identity`<br>`recovery_disposition_required_or_settled` |
| `REC-DOCKER-RECOVERY-ACKNOWLEDGEMENT` | `IF-STATE-STORE` | `RES-DOCKER-RECOVERY-ACKNOWLEDGEMENT` | `after_effect_receipt` | `exact_docker_recovery_identity`<br>`repository_binding_and_fixed_result_identity`<br>`project_task_attempt_logical_operation_binding`<br>`first_acceptance_generation_preserved`<br>`project_acknowledged_readback_precedes_producer_delivery_release`<br>`absence_is_not_acknowledgement` |

<a id="compact-runtime-storage"></a>

### 結果受理の新しい本文と切替境界

Orchestratorの耐久受理は、Repository、Project、Milestone、Task、Attempt、論理操作、回復参照、初回受理世代、Repository結合Hash、結果ID、固定利用側の十一項目で表す。実装上の項目名は`repositoryBindingId / projectId / milestoneId / taskId / attemptId / operationId / recoveryId / settlementGeneration / repositoryBinding / resultId / consumer`であり、`consumer`は`project_runtime`だけとする。Path、AppData Rootの四Hash、旧領収書本体のHash／実体Identityを受理本文へ含めない。

`decodeProjectResultAcceptance`は閉じた形式を検査し、結果受理Readerは同じ検査に加え、固定したRepository／Task／Attempt／論理操作／回復参照と現在保存状態を照合する。初回受理世代はその後の保存世代へ書き換えず、現在保存世代を越える受理は拒否する。形式成立だけで耐久保存、下位受理、資源清掃または仕事全体の成功を主張しない。

新Reader、core遷移、現在状態保存decoder、Applicationの本文生成は新形式へ接続した。core遷移は生の本文を先に読まず、検査済みの固定本文だけでTask探索・照合・保存を行う。保存decoderはProject・節目・Task・現在世代と結合する。再実行準備で現在TaskのAttempt／操作IDが解除されても、過去の受理本文と初回世代は保持する。

通常Taskの本番Sourceは、元Control捕捉、Coordinatorの固定結果参照、上位保存、固定Readerのfresh読戻し、下位受理・終了整理へ接続する。回復後の結果受領は、本番組立てが固定したRoot・Repository結合と上位のexact世代・Task・Attempt・settled義務を確認し、Coordinatorの現在状態から五項目の結果参照だけを取得する。受領保存後は十一項目の正規ACKと保存済みacknowledged義務の全項目一致を確認し、八項目で結合した固定Readerから終了限定Writerへ接続する。下位の保存確認と排他解放がともに成立した場合だけ終了を返す。旧AppData領収書へfallbackしない。

この結果受領・終了接続は保存済み終端だけを扱い、残存資源の回収、別Processでのpending再構成、実Docker一体確認の成立を意味しない。これらが未接続・未検証の間は新Process回復全体を完成と表示しない。古い物理記録の移行・清掃はフロントAIの移行手順で扱う。

中断後の配送再入場では、保存途中と整理後を分ける。通常Readerは保存途中を拒否し続け、終了限定の準備だけが同じRoot・既存排他内で現在本文と保存候補を安定読取りする。保存候補は固定上位Readerから導出した同じ受理候補、受理済み現在版から導出した同じ整理候補、またはその同じ現在版への完全一致だけを受理する。改訂番号や対象IDだけの一致、別操作の変更、上位ACK不明、別の候補では本文を保持して停止する。

下位整理後に上位確定が中断した場合、元Taskを再実行しない。固定上位ACKと現在Rootを照合し、同じ排他内で対象の操作・回復・配送参照の明示不存在、既存履歴のexact回復IDと結果要約Hash、終端・Host清掃・Lease解放・Owner無効を再確認する。安定再読取りと排他解放が成立した場合だけ「配送残件の不存在」を観測できる。履歴には資源配列がないため、資源回収・過去のProducer ACK保存・Task成功の証明へ転用せず、過去のunknownも維持する。保存途中のファイルが残る場合はこの不存在経路を成功にしない。

以上の中断後再入場は実装・検証待ちである。通常履歴が整理され相関行を取得できない場合は、この方法では終了を確定できない。任意期間後の再開保証は未成立であり、保持契約との整合を5Cの残件として扱う。新しい台帳や終了領収書を追加して自動的に解決したことにしない。

通常終了の結果受領は、回復義務とは分けて既存Task内の必須`resultAcceptances`配列へ保存する。初期Taskと新Attempt・回復後ready・Owner喪失・再計画／置換では空配列を明示し、旧Attemptの受領を新しい実行へ引き継がない。通常受領は清掃済みの`completed / failed / cancelled`、`startPhase: settled`、未解決回復なしを要求し、ACKからこれらを補完しない。開始前停止で結果がない場合は空配列を維持する。

`recordProjectTaskResultAcceptances`は未保存の次世代終端候補へ全結果を一括固定する。終端とACKで世代を二度進めず、同じSnapshot候補を既存Writerで一度保存する。Project・節目・Task・Attempt・上位操作、Repository結合・回復参照・初回世代を照合し、重複、同じ対象の本文変更、未来世代、通常受領と回復ACKの混在を拒否する。同じ本文の再入場は初回世代を保持する。Snapshotの閉じたTask項目集合は新配列を必須とし、旧形式の欠落を補完しない。

固定Readerは通常の清掃済み終端＋新配列と、既存の回復ACKを明示的に分けて読む。同じ対象が双方へある場合は優先順位で選ばず拒否する。保存確認と排他解放の後にfresh読戻しを行う条件は維持する。有限履歴は既存の終了要約だけを持ち、Task受領本文を履歴へ複製しない。旧保存形式の物理移行はフロントAIが扱い、Runtimeへ互換補完を追加しない。

本番組立ての`startTask`戻り直後、await前に元Controlから配送閉包を捕捉する。内部通知は同じAttemptの局所変数へ一回だけ受領し、公開Task結果やStateへ関数・Capabilityを混ぜない。捕捉・通知の失敗でも元Taskの完了・取消・清掃を待ち、Effect前拒否へ読み替えない。結果参照の五項目は上位の論理操作とRepository結合、回復ID一意性へ照合する。Reader構築には八項目の固定結合だけを渡し、十一項目の受領本文を丸ごと渡さない。

通常の清掃済み終端では、全結果読取り後に終端＋ACK集合を同じ次世代候補へ保存し、保存・排他解放を確認してから固定Readerで各結果を受理・整理する。部分整理後に全結果を再読取りしない。保存不明や部分整理失敗では下位pendingと上位の保存済みACKを保持し、元Taskのoutcome・一次失敗を変えず新しいProvider要求を発行しない。この呼出し終了後の新Process再入場は未接続であり、局所閉包の保持だけから回復可能と表示しない。

結果0件の`not_required`は、元Taskの許可された終端、Host清掃、旧操作なし、handoffとfinalizationがともに0件の場合に限る「配送不要」であり、Provider Effectなしの証明ではない。Effect前拒否は既存の拒否分類で別に判定する。下位清掃不明は通常ACKへ通さず、既存のexact回復参照を維持する。

### 3.1. 現在状態の一体保存と有限履歴

責務再編後は、Repository Rootを検証した`.crdd/orchestrator/`内の共通4ファイルへ、現在の仕事を一体保存する。現行の`.crdd/project-runtime/`は②で切替済みの基準配置であり、今回の新Owner名への実切替は未完了である。②の旧E2E記録清掃と公開初期化の結果は[変更記録](../../../99_Roadmap/Changes/CHG-000082/Evidence/261005_project-runtime-phase2.md#29-repositoryの実切替結果)で追跡する。上表のRecordは論理責務として維持し、ファイル統合や改名によって判断Authorityや仕事全体の一括確定を追加保証しない。

| ファイル | 所有する内容・終了条件 |
|---|---|
| `state.json` | 現在のProject状態、Queue、進行中Attempt、採否待ち候補への参照、未確定の結果保存・採用後処理、判断待ち、未解決回復、履歴への未確定搬送。既存操作・参照・回復の処置と終了要約の保存を確認した項目は除く。 |
| `state.lock` | 保存更新の短期排他に結合する固定入口。ファイル存在、PID、時刻だけを排他成立・Owner死亡の根拠にしない。 |
| `state.pending.json` | 同じ排他Ownerが確定前に作る短命な保存候補。確定後に除き、中断残存は同じIdentityの再入場で処置する。 |
| `history.jsonl` | 時刻、終了Identity、結論、最初の失敗と後続の回収結果の要約。現在状態、Authority、採否待ち・未解決処置の正本にはしない。 |

大きな候補本体は`.crdd/candidates/`、再生成できる一時物は`.crdd/tmp/<operation-id>/work/`へ分離する。新しい`staging/`、`logs/`、`project-runtime/work/`は作らない。保護方法が異なる判断継続・秘密・署名鍵はこのJSONへ移さず、既存Platform境界を維持する。

| 境界 | 保存・再入場の設計条件 |
|---|---|
| 更新競合 | Snapshot全体の改訂番号とProject／Queueごとのgenerationを区別する。期待世代を再検査し、排他Ownerだけが保存候補を公開する。Queue選択から更新へ移る内部呼出しで自己再取得しない。 |
| 保存確定 | 正規Root、閉じたSchema、内容Hash、期待世代を検証する。同じDirectory内の置換、書込み確定、read-back、異常終了時の残存をWindows実境界で確認するまで、原子的・耐久的確定を実装済みとしない。 |
| 外部待機 | 短期保存排他をProvider待機中に保持しない。長期Operation Leaseとその終了確認は別責務として維持する。 |
| 結果保存・採用後処理 | integration Recordは候補の耐久公開、adoption Receiptは実適用結果、Queue.resultReferenceは既存の結果参照として維持する。保存成功を利用者の受領・既読へ読み替えず、取得・受領確認の新しいPortを追加しない。参照中・採否待ち・回復待ちは残し、適用後に記録が失敗した場合も適用済み事実と未確定保存を保持する。記録不存在を再適用許可にしない。 |
| 終了と履歴 | 終了要約をstateへ保持し、同じ終了Identityで履歴へ搬送・確認してから現在項目を除く。中断時は重複を識別して再入場する。履歴障害だけで無関係な新規仕事を永久停止させない。 |
| 履歴保持 | 通常履歴は直近30日を保持し、起動・更新時に30日より古い要約を除く。件数・合計Byteの削除上限は設けない。期限外の行も含めて全行を逐次検証し、途中行、未来時刻・時計逆行、循環失敗を処置する。履歴から仕事やAuthorityを再実行しない。 |
| 別Port間の中断 | State、Queue、結果、保護Decisionへの呼出しの間で停止できる。物理一体化だけで全更新のall-old／all-newを主張せず、同じ仕事Identityで未完了処置へ戻る。 |
| 旧形式からの切替 | 新形態へ刷新し、旧保存形式のRuntime内変換・Fallback・旧Writerを残さない。切替時はフロントAIが旧入口の停止、現在資源・参照の確認、必要成果物の保全と用途別Rootの清掃を行う。旧仕事を新Snapshotへ自動継承せず、新しい受付世代で初期化する。 |

新版の保存契約は閉じたSnapshot v2 Schema、Root・Binding結合、期待世代による競合拒否と現在の未解決処置の保全である。本番Reader／Writerはv2だけを受理し、Hashが正しい旧v1 Envelopeでも読取り・再初期化を拒否して元bytesを保全する。旧形式の連続世代を永続互換契約として維持せず、旧不変条件IDをそのまま新版の成立根拠へ読み替えない。

新版Schema、実効排他とRootの結合、Windows保存確定、結果保存・採用後処理は本番Compositionへ接続する。終了Identityは履歴確定後に退役し、通常履歴は30日保持とする。Qualityには競合、中断、再送、参照中・未解決の結果の削除、採用後の記録失敗による重複適用、旧Writer再入場、履歴循環と終了後残存を反証対象として渡す。接続の存在を独立レビュー合格や実Provider E2E合格の代替にしない。

今回の変更は既存運用の保存統合であり、受領・既読管理の新機能を追加しない。保存後も利用者が結果を読んでいないという理由だけで、終了項目を現在状態へ残し続けない。

再編後の保持設定は`.crdd/config/orchestrator.json`、配布例は`template/.crdd/config/orchestrator.example.json`、Schemaは`template/tools/schemas/orchestrator-config-schema.json`とする。`schemaRevision: 1 / historyRetentionDays`の意味、不存在時だけ30日、不正時の整理停止、非秘密設定の明示Git allowlistを維持する。旧project-runtime設定の確認・値引継ぎ・清掃はフロントAIが行い、新Runtimeは旧名を探索しない。名前の切替だけで現在Snapshotを新受付世代へ無断コピーしない。

| 新版の論理区画 | 保持する既存の意味 |
|---|---|
| 保存情報 | 閉じたSchema、Repository結合、Snapshot改訂番号、内容Hash。各Recordのgenerationとは区別する。 |
| 受付 | 現在の受付世代と進行Queueの結合。新Request発行時の世代を搬送する。刷新前のRequestを新規仕事として再受付しない。 |
| Project・Queue | 既存State・Queueの全Property。Task、Attempt、判断待ち、回復義務、requestHash、ownerGeneration、resultReferenceを省略しない。 |
| Lease記録 | 取得Identity、Owner世代、取得・解放途中とOwner喪失の既存証拠。OS排他handle自体や保護されたDecisionは保存しない。 |
| 統合・採用記録 | kind、Identity、Repository／Project／Milestone／Queue結合、内容Hash、既存value。既存結果の意味を保存整理で変更しない。 |
| 未完了後処理 | 既存回復・終了確認・履歴への未確定搬送。完了状態名だけで削除しない。 |

新版Leaseは取得意図、取得確定、解放途中、Owner喪失回収をRepository・Project・Queue・Owner世代・Owner Processへ結合する。取得途中で停止した場合に架空の取得成功を追加せず、取得結果未確定と現在の回収完了を分ける。Fileの存在だけでOwnerの稼働を、解放証拠だけで現在の実資源不存在を推定しない。

切替時の旧記録整理はフロントAIの移行手順が所有する。旧Coordinator／Project Runtime／Docker処理を停止し、実資源、未採用候補、結果・判断の未完了参照を確認してから、検証済み用途別Rootの旧記録・一時物を回収する。認証、署名鍵、送信同意、保護された有効判断、候補本体と正式Evidenceを世代記録の清掃へ混ぜない。使用中・参照中・由来不明は一括削除せず、未処置を具体的に返す。Runtimeへ汎用移行・旧履歴再生の仕組みを追加しない。

保存統合と長期実行排他は責務を分ける。短期保存排他は固定`state.lock`とRepositoryへ結合したOS排他を使用する。長期Leaseの短命な実体は`.crdd/tmp/project-runtime-leases/`へ置き、取得意図を保存してから実体を作り、実体Identityと取得証拠を保存する。解放時も意図保存、物理解放の確認、終了証拠とQueueの確定を順序付ける。短期保存排他を保持したままProvider完了を待たない。旧`project-runtime/work/locks/`へ本番処理を戻さない。

`history.jsonl`の先頭行は閉じた保存情報、以降は終了要約とする。保存情報は契約名、改訂番号、Repository結合Hash、変更前の全体Hash、要約行のHash、UTC保存時刻を持つ。要約は終了Identity、UTC終了時刻、終了分類、一次失敗分類、回収結果だけを保持する。自由記述の診断本文や秘密値は保存しない。全行を検証し、ちょうど30日前の行は残し、それより古い行だけを除く。時計逆行・未来時刻・途中行を期限切れとして削除しない。

短命な`history.pending.jsonl`は同じDirectory内の置換候補であり、履歴世代を蓄積しない。同じRoot排他下で、現在の全体Hashが候補と一致すれば候補の回収だけを行い、変更前Hashと一致すれば同じ候補の保存を再開する。不一致・破損は上書きせず保持する。確定後はread-backと短命Fileの不存在を確認する。履歴確定後だけ終了記録を除く。

部分codecは検証専用であり、本番の`state.json`として使用しない。本番は全区画を持つv2 Schemaを検証する。ID重複、孤立Queue、不正State／Queue、Root・Binding差、Hash不一致、未知fieldと未知版を拒否する。入力と返却値にはUTF-8で16MiBの上限を適用する。

短期保存排他は、検証済みRepository Rootのnative realpathをWindowsのcase差を正規化してHash化し、Project Runtime専用のNamed Pipeへ結合する。Worker取得・保持確認・解放処理を再利用し、Candidate／Provider／Dockerの名前空間は変更しない。`assertLive()`で保持を確認し、`release()`がfalseなら解放未確認とする。File保存の確認をOS電源断時の耐久性保証へ読み替えない。

#### 統合保存入口の接続

`writeProjectRuntimeSnapshot`は、部分codecとは別の統合保存契約を使用する。本番は判断区画を含む`crdd-coordinator/project-runtime-snapshot/v2`に固定し、v1試行からの暗黙拡張や旧DirectoryへのFallbackを行わない。

| 区画 | 固定する値 |
|---|---|
| 保存情報 | schema、schemaRevision、repositoryRootHash、repositoryBindingId、snapshotRevision。 |
| 受付 | intakeEpochと、全QueueごとのintakeBindings（queueId／epoch）。既存Queueを現在世代へ付け替えない。 |
| 既存現在値 | projects、queueEntries。各RecordのgenerationとQueueのIdentityを維持する。 |
| 実行権の記録 | leaseEvidence、leaseIntents。取得途中／物理排他取得後／解放未確定のphaseを分け、同Ownerに併存する途中記録を省略しない。 |
| 結果と終了処理 | results、historyPending。結果は既存kind・Identity・結合・内容Hashを検証し、終了要約は履歴と同じ値契約を使う。 |

保存Envelopeはpayload、contentHash、baseRevision、baseHashの閉集合とする。baseRevisionは候補のsnapshotRevisionの一つ前、baseHashは変更前File全体のHashである。初回はbaseRevision=0／baseHash=null。候補Hashは検証済みpendingの全bytesから導出する。`state.pending.json`と確定後の`state.json`は同じEnvelopeであり、短命File内の内容を変換せず置換する。

残存pendingがあれば新規更新より先に再検証する。現在値がbaseHash・baseRevisionと一致すれば同候補のFile確定を再要求して置換する。現在値が候補全bytes・候補改訂と一致すれば現在Fileの確定を再要求し、pendingだけを回収する。不一致、部分File、Root差は保全して停止する。新規保存は固定pendingの作成・fsync・読戻し、置換、現在値の読戻しとpending不存在確認の順とする。fsync要求の成功をWindows電源断時の耐久性保証へ読み替えない。

保存入口は、未解決Queue、Lease途中、参照中結果と未搬送要約の除去を拒否する。`maintainProjectRuntimeSnapshot`は、Task終了・回収、判断終了、採用後処理および実Lease不存在を確認し、同じ終了Identityの要約を履歴へ確定した後だけQueue・受付結合と不要な終了記録を除く。同じ更新で受付世代を切り替え、退役済み依頼の再実行を拒否する。最新Projectと参照中結果は保持する。適用後の記録失敗は回復・後処理状態を保持し、Record不存在から採用を再実行しない。未整理Queueが残るProjectのMilestone置換を拒否し、旧仕事を孤立させない。

`readProjectRuntimeSnapshot`は内部保存の読取り入口であり、利用者向け結果取得・受領機能ではない。取得済みRootと親Directoryを順に検証し、領域を作成せず真正不存在だけをnullとして返す。固定pendingが存在する場合は保全停止し、この入口から確定・回収しない。正規File、単一link、安定した上限付き読取り、UTF-8、全区画・Hash・Root・Bindingを確認する。破損・alias・途中消失・観測不能から旧形式へFallbackしない。短期排他の解放確認後だけ成功を返す。本番State読取りはこのv2入口へ接続する。

保存の内部処置は取得済みOwnerを受け取り、自ら排他を再取得・解放しない。外側の入口が取得と解放確認を担当し、読取り・操作固有更新・保存を同じOwnerへ接続する。OwnerはJSONや呼出し元指定Hashから復元しない。本番CompositionはState／Queue・Lease・結果・受入判断・判断回復の新版Portを一組で使用する。

Project状態更新は入力・上限・期待世代を取得前に検証し、同じOwner内で現在値の読取り、世代比較、受付結合の再検査、更新と保存を行う。Snapshot不存在から自動初期化しない。Project不在だけは期待世代0で追加し、既存Projectは現在世代一致時だけ置換する。他Project・Queue・受付結合・Lease・結果・未搬送履歴を保持する。未整理QueueがあるProjectのMilestone置換は拒否する。pendingは保全停止し、保存専用入口の再入場で処置する。

#### 独立採用の終了と参照保護

通常Queueの終了記録はProject・Milestone・Queueの結合で照合する。採用Leaseの固定名`canonical`を通常QueueのIDと同一視しない。一般保存と固定pending再入場にも同じ除去条件を適用し、現在値だけでなく保存候補が新しく追加する成果根拠の参照も保護する。

通常Queueを持たない成功採用は、完全なReceipt、未参照、未解決処置なし、終了証拠と現在の実Lease不存在を確認して整理する。同Projectの別Receiptが残る間は、共有する終了証拠を保持する。

採用Applicationが実際の採用呼出し前にRevision／Scope不一致を検出し、取得Leaseの解放まで確認した場合だけ、`adoption`結果を`status: rejected`として保存する。固定理由、実取得`ownerGeneration`、`effectIssued: false`、`cleanupConfirmed: true`を閉じた値として持ち、成功Receiptを作らない。結果IdentityはそのOwner世代へ結合する。保存停止・例外では正式な未確定結果を返し、証拠を保持する。

この拒否結果も、exact Ownerの取得・終了証拠、現在の実資源不存在、未参照を照合し、失敗の終了要約を履歴へ確定してから対応証拠だけを除く。採用発行後、未知Effect、解放未確認、別世代の証拠だけでは整理しない。Candidate本体、最新Project、署名・認証や保護された判断は変更しない。

#### 操作と保存の接続範囲

`createProjectRuntimeSnapshotPersistencePorts`はState／Queueの8操作とLeaseの4操作を新版保存へ接続する。構築だけで初期化・保存・旧形式Fallbackを行わず、Request発行時の受付世代と依頼結合を固定する。本番の内部操作は`createCurrentProjectRuntimePersistencePorts`から検証済みv2世代を使い、外部Requestの世代を補完するために使わない。Operation回復は要求したProject／Queueへ結合し、Adoption回復はcanonical採用Leaseへ結合する。停止理由とexact回復参照を保持する。

受付世代の本番接続では、認証・Repository・Revisionを確認した既存の状態取得入口から世代を返し、新Requestの発行側が値を固定する。CLIとMCPの受信時には現在世代へ補完・付替えしない。Projectが不在でも有効な現在Snapshotがあれば世代を取得できるが、Snapshot不存在・未確定・破損・観測不能では値を生成せず、状態取得へ初期化Effectを加えない。Workbenchは現状Objective発行者ではなく、新しい発行機能をこの保存刷新へ追加しない。

最初のState作成前と、同じ短期Owner内の保存時に受付結合を照合する。新規Queueは現在世代一致、退役前の既存Queueは保存済み受付結合・依頼内容Hash・Project・Milestone等の一致、退役済みまたは不存在の旧Queueは旧世代拒否をそれぞれ処置する。検査後の世代変更も保存前に再照合する。本番Objective入口はRequestの`intakeEpoch`と依頼結合をFactoryへ渡し、受信時に現在世代を補完しない。受付世代を人間のAuthority、発行時刻の暗号的証明または悪意ある改変の防止とは扱わない。

| 操作群 | 統合先で維持する契約 | 現在の接続状態 |
|---|---|---|
| State／Queueの8操作 | 世代比較、同依頼再送、優先順位、使用中の割込み禁止、exact回復参照。 | 本番Objective・判断・受入・統合Compositionが新版Factoryを使用する。 |
| Leaseの4操作 | 取得途中の耐久記録、実排他、解放確認、Owner喪失の再観測。 | 本番Factoryが短期保存排他と長期実行Leaseを分離して使用する。 |
| integration／adoption結果の保存 | 同Identity・同内容再送、採用後保存失敗から再適用しない。 | 本番統合とWorkbench独立採用がv2結果Portを使用する。 |
| 受入判断の作成・読取り・比較交換 | preparedの第1世代とfinalizedの第2世代、作成一回限り、期待値の完全一致。 | 本番受入入口がv2判断Storeを使用する。旧二世代をRuntime内で移行しない。 |
| 判断回復の作成・読取り・比較交換 | exact回復Identity、期待値完全一致、途中状態保全。 | 本番判断入口がv2回復Storeを使用する。旧連鎖を再構築しない。 |
| 未搬送終了要約の履歴への搬送 | 全内容一致再送、履歴確定後だけ現在値から除去、30日保持。 | Objective・判断・受入・Workbench採用の終了処置が整理入口を使用する。 |

Lease解放後にQueueの所有解除だけが中断した場合、再入場は既存の終了確定操作へ接続する。観測した受付世代、Queue世代、Owner、exact終了証拠、未解決取得意図の不存在と実排他不存在を再照合し、統合待ち等の終了意図・結果参照を保持して所有だけを解除する。実行中のOwner喪失を`recovery_required`へ移す処置とは区別し、終了証拠欠落・結合不一致・観測不能では保存を保全して停止する。過去の解放要求発行や物理排他の不存在だけから正式終了を推定しない。

受入判断と判断回復を加える保存形式は`crdd-coordinator/project-runtime-snapshot/v2`として区別する。v1試行の値に欄を暗黙追加せず、未知版、不正v2、未確定保存から旧DirectoryへFallbackしない。`acceptanceDecisions`は記録ごとに第1世代と、存在する場合だけ第2世代を保持し、第2世代単独を許さない。`decisionRecoveries`は記録ごとの現在値・保存世代を保持する。新形式の比較交換は同じ排他内の完全な期待値照合とSnapshot確定で行う。旧形式はフロントAIの切替手順で整理し、Runtime内で旧連鎖を再構築しない。

両欄はRepository内の非秘密の処理記録であり、保護された判断AuthorityやCapabilityを複製しない。履歴へ移す場合も、保護記録の参照、Project適用、Queue、回復と後処理が解消する前に除去しない。退役受付世代によって過去判断の作成や再適用が復活しないことを確認する。

新版Leaseの物理排他は`.crdd/tmp/project-runtime-leases/`の短命なDirectoryとして保持し、現在状態の正本は`state.json`のintentと証拠へ統合する。取得意図を確定して短期保存排他を解放した後に物理排他を取り、同Ownerの取得記録を再照合して取得証拠を確定する。解放も意図確定、物理解放、不存在確認、終了証拠確定の順とし、短期保存排他を実行中や外部待機へ持ち越さない。Directoryの実体Identityは取得後に照合し、別の実体へ置換された場合は処置しない。物理取得後・証拠保存前の不明な窓は成功へ丸めず、exactな未解決取得として保持する。JSON上のintent除去は終了証拠と現在の物理不存在を照合した専用終了処置に限り、一般保存で未解決義務を消さない。

v2の実体結合は取得したDirectoryのdevice、inode、birthtimeMsをJSON配列順でHash化した`physicalIdentity`とする。取得前のintentではnull、取得後・解放意図では照合済みHashを持つ。これはOSが返した属性に基づく置換検知であり、AuthorityやWindows電源断保証ではない。opaque Leaseの利用時は親Directoryも正規実体として再確認する。未終了の取得証拠には同Ownerの`lock_owned`意図を要求する。終了証拠なしにintentを除いた保存候補を受理せず、終了証拠がある場合も同じ物理排他の不存在を保存確定前・pending再入場時に確認する。

物理取得前には、取得意図を保存した時点のRepository実体を同じ属性とnative realpathで再確認し、親を確認してから子を作成する。意図保存の途中失敗や保存後のOwner解放未確認は、同じexact回復参照を返す。競合・入力拒否などEffect前の停止へ、存在しない回復義務を追加しない。解放意図の保存が未確認となったopaque Leaseは以後の実行に使用しない。

履歴搬送は実発行された同じOwnerを借用し、偽造値や解放済みOwnerを拒否する。借用本体は取得・解放せず、外側が全結果の解放確認を担当する。一回の搬送では評価時刻を固定し、要約IDと全内容を照合する。期限内の要約はexact行の保存とread-back、期限超過の要約は30日契約による期限処置を区別する。履歴確定後に現在状態の保存が失敗しても、同じ要約から再送し、二重行を増やさない。一般保存と固定pending再入場の双方で、未搬送要約の除去には同内容の履歴行または検証済み期限処置を要求する。これは終了要約の搬送だけであり、Queue、Project、結果、判断、回復義務、候補本体の退役・削除を許可しない。

新版Owner喪失処置は、同一取得意図・Queue・Repository実体を読み、短期排他を解放してから既存のProcess観測へ渡す。PIDとOwner世代が一致した`absent`だけを受理し、再取得後に対象の全内容とRoot実体を再照合する。無関係な区画の更新は保持し、観測の間に対象が変わった場合は処置しない。`recovery_pending`を確定してから、正規の親と同じ実体Identityを持つ空の排他Directoryだけを解放し、不存在を確認して終了証拠を保存する。回収意図の保存後、物理解放後、終了保存中断後も同じ回復参照から再入場する。

取得証拠がある場合は`recovered_after_owner_loss`へ結合する。取得証拠がない場合は`acquisition_unknown_closed`として過去の不明と現在の回収を分ける。取得前の同Owner内で実排他不存在を確認した唯一の`acquisition_reserved`があり、旧Ownerのexact不存在、現在の空の正規Directoryと同一実体を確認できる場合だけ、物理Identityを回復意図へ保存してから回収する。不明・非空・別取得との重複・実体差は停止する。取得成功やTask成功を捏造しない。Queue Ownerが結合済みなら`recovery_required / owner_loss`へ移し、未結合ならqueuedを保持する。採用Leaseの回収を再適用許可にしない。

## 4. 資源と終了条件

| ID | 所有者 | 範囲／保存境界 | 終了条件 |
|---|---|---|---|
| `RES-PROJECT-QUEUE` | `durable_operation_queue` | `—` | `terminal_record_retained_or_policy_deletion_observed` |
| `RES-PROJECT-OPERATION-LEASE` | `parent_coordinator` | `one_operation_per_repository_binding` | `all_child_tasks_reconciled_and_os_exclusion_release_observed` |
| `RES-PROJECT-STATE` | `project_state_store` | `—` | `expected_generation_atomic_replace_observed` |
| `RES-SCHEDULER-SLOT` | `project_scheduler` | `—` | `task_process_absent_and_cleanup_confirmed` |
| `RES-CONFLICT-RESERVATION` | `project_scheduler` | `—` | `effect_candidate_and_recovery_impact_reconciled` |
| `RES-SINGLE-TASK-BINDING` | `project_runtime` | `—` | `exact_operation_settled_to_result_cleanup_or_recovery` |
| `RES-INTEGRATION-WORKSPACE` | `integration_owner` | `—` | `candidate_adopted_or_discarded_and_workspace_cleanup_observed` |
| `RES-ADOPTION-LEASE` | `integration_owner` | `—` | `adoption_receipt_and_repository_revision_observed` |
| `RES-CANCELLATION-CONTROLLER` | `parent_coordinator` | `—` | `all_target_tasks_terminated_cleaned_and_projected` |
| `RES-PROJECT-RECOVERY-EVIDENCE` | `issuing_runtime` | `—` | `exact_recovery_completed_and_resource_absence_observed` |
| `RES-DOCKER-RECOVERY-ACKNOWLEDGEMENT` | `project_state_store` | `repository_local_orchestrator_current_state` | `exact_result_durable_acceptance_read_back_and_producer_pending_delivery_released` |
| `RES-PENDING-DECISION` | `human_decision_controller` | `—` | `accepted_stale_superseded_or_cancelled_record_durable` |
| `RES-DECISION-CONTINUATION` | `human_decision_controller_via_platform_adapter` | `os_managed_runtime_protected_root_outside_repository` | `hash_finalized_invalidated_expired_or_recovery_obligation_settled_and_raw_capability_absent_from_runtime_owned_surfaces` |
| `RES-DECISION-RECOVERY-INTENT` | `platform_adapter_recovery_store` | `separate_verified_runtime_owned_recovery_store` | `exact_recovery_join_settled_and_intent_settlement_read_back` |

## 5. Lock

| ID | 所有者 | 順序 | 入れ子可能 | 外部待機中の保持 |
|---|---|---:|---|---|
| `LOCK-QUEUE-MUTATION` | `durable_operation_queue` | 1 | — | `false` |
| `LOCK-PROJECT-OPERATION` | `parent_coordinator` | 2 | `LOCK-PROJECT-STATE`<br>`LOCK-ADOPTION` | `true` |
| `LOCK-PROJECT-STATE` | `project_state_store` | 3 | — | `false` |
| `LOCK-ADOPTION` | `integration_owner` | 4 | — | `false` |

## 6. Authority

| ID | 所有者 | 範囲／発行 | 終了条件 |
|---|---|---|---|
| `AUTH-MILESTONE` | `authenticated_human_via_parent_coordinator` | `one_project_one_repository_one_milestone_and_declared_limits` | `milestone_terminal_or_authority_revoked` |
| `AUTH-TASK` | `project_runtime` | `strict_subset_of_milestone_for_one_task_attempt`<br>`binding_derived_from_current_project_milestone_objective_task_attempt_and_repository_revision; execution_authorization_is_separate_and_issued_after_durable_attempt_reservation_immediately_before_effect` | `attempt_settled_or_superseded_or_revoked` |
| `AUTH-SINGLE-TASK-OPERATION` | `single_task_adapter` | `one_exact_single_task_operation_and_candidate_boundary` | `operation_cleanup_or_exact_recovery_obligation_observed` |
| `AUTH-INTEGRATION` | `integration_owner` | `fixed_task_result_set_and_acceptance_criteria_without_canonical_write` | `integration_candidate_fixed_or_discarded` |
| `AUTH-ADOPTION` | `authenticated_human_via_parent_coordinator` | `fixed_candidate_fixed_paths_and_fresh_canonical_revision` | `adoption_receipt_or_no_effect_rejection_observed` |
| `AUTH-RECOVERY` | `issuing_runtime` | `exact_operation_resource_and_recovery_identity_only` | `exact_recovery_completed_or_human_transfer_recorded` |
| `AUTH-HUMAN-DECISION` | `parent_coordinator_verifying_selected_user_and_runtime_owned_continuation` | `exact_pending_decision_project_milestone_generation_revision_allowed_option_and_single_use_continuation` | `protected_finalized_or_exact_recovery_obligation_durable_or_runtime_owned_stale_superseded_cancelled_project_terminal_or_expired; invalid_input_preserves_existing_capability` |

## 7. Effect

| ID | 所有者 | Effect境界 | 成立観測 |
|---|---|---|---|
| `EFFECT-QUEUE-STATE` | `durable_operation_queue` | `repository_local_queue_record_mutation` | `generation_hash_and_atomic_replace_observed` |
| `EFFECT-PROJECT-STATE` | `project_state_store` | `repository_local_project_state_mutation` | `expected_generation_and_atomic_replace_observed` |
| `EFFECT-SINGLE-TASK` | `single_task_adapter` | `provider_process_container_and_candidate_operation` | `exact_operation_result_cleanup_or_recovery_identity` |
| `EFFECT-INTEGRATION-CANDIDATE` | `integration_owner` | `isolated_workspace_and_candidate_generation` | `candidate_hash_conflict_and_workspace_cleanup` |
| `EFFECT-CANONICAL-ADOPTION` | `integration_owner` | `canonical_repository_path_mutation` | `fresh_base_revision_changed_paths_receipt_and_post_revision` |
| `EFFECT-RECOVERY` | `issuing_runtime` | `exact_residual_resource_reconciliation` | `recovery_receipt_and_resource_absence` |
| `EFFECT-DECISION-STATE` | `human_decision_controller` | `one_repository_local_atomic_decision_and_milestone_project_state_generation_application` | `expected_generation atomic_replace and project_state_readback show decision_and_milestone_all_old_or_all_new` |
| `EFFECT-DECISION-CONTINUATION` | `platform_adapter_for_human_decision_controller` | `os_managed_runtime_protected_continuation_record_cas_mutation` | `selected_user_protection application_id expected_and_new_generation disposition and atomic_update_readback` |
| `EFFECT-DECISION-RECOVERY-INTENT` | `platform_adapter_recovery_store` | `separate_runtime_owned_exact_decision_recovery_intent_mutation` | `recovery_identity unknown_boundary last_confirmed_disposition and atomic_update_readback` |

## 8. 状態機械と遷移

状態名だけで完了、cleanup、Authority失効またはEffect不存在を推定しない。各遷移は対応する資源、不変条件および検証項目が成立した場合だけ有効とする。

### `SM-TASK`

- 状態: `planned`<br>`waiting_dependency`<br>`ready`<br>`starting`<br>`running`<br>`cleanup_pending`<br>`completed`<br>`failed`<br>`cancelled`<br>`recovery_required`<br>`superseded`
- 終端状態: `completed`<br>`cancelled`<br>`superseded`

| 遷移ID | From | To | 資源 | 不変条件 | 検証 |
|---|---|---|---|---|---|
| `TRANS-TASK-PLAN-WAIT` | `planned` | `waiting_dependency` | — | `INV-REVALIDATE-AFTER-WAIT` | `PR-N-03` |
| `TRANS-TASK-PLAN-READY` | `planned`<br>`waiting_dependency` | `ready` | — | `INV-REVALIDATE-AFTER-WAIT`<br>`INV-MAX-FIVE-CLEANUP-AWARE` | `PR-N-02`<br>`PR-N-03`<br>`PR-Q-01`<br>`PR-A-01` |
| `TRANS-TASK-READY-STARTING` | `ready` | `starting` | `RES-SCHEDULER-SLOT`<br>`RES-CONFLICT-RESERVATION`<br>`RES-SINGLE-TASK-BINDING` | `INV-DURABLE-BEFORE-TASK-EFFECT`<br>`INV-EXACT-RESULT-IDENTITY` | `PR-N-02`<br>`PR-A-02`<br>`PR-A-04` |
| `TRANS-TASK-STARTING-RUNNING` | `starting` | `running` | `RES-SINGLE-TASK-BINDING` | `INV-NARROWED-AUTHORITY`<br>`INV-REVALIDATE-AFTER-WAIT`<br>`INV-DURABLE-BEFORE-TASK-EFFECT` | `PR-N-01`<br>`PR-A-03`<br>`PR-A-04` |
| `TRANS-TASK-ACTIVE-CLEANUP` | `starting`<br>`running` | `cleanup_pending` | `RES-SCHEDULER-SLOT`<br>`RES-CONFLICT-RESERVATION`<br>`RES-SINGLE-TASK-BINDING` | `INV-MAX-FIVE-CLEANUP-AWARE`<br>`INV-UNKNOWN-PRESERVES-RECOVERY` | `PR-Q-04`<br>`PR-A-05` |
| `TRANS-TASK-CLEANUP-COMPLETED` | `cleanup_pending` | `completed` | `RES-SINGLE-TASK-BINDING` | `INV-TASK-COMPLETE-NOT-ACCEPTED`<br>`INV-EXACT-RESULT-IDENTITY` | `PR-N-01`<br>`PR-I-01` |
| `TRANS-TASK-ACTIVE-FAILED` | `starting`<br>`running`<br>`cleanup_pending` | `failed` | `RES-SINGLE-TASK-BINDING` | `INV-UNKNOWN-PRESERVES-RECOVERY` | `PR-Q-02`<br>`PR-A-03` |
| `TRANS-TASK-FAILED-SUPERSEDED` | `failed` | `superseded` | — | `INV-OLD-IDENTITY-IMMUTABLE` | `PR-Q-02` |
| `TRANS-TASK-ACTIVE-CANCELLED` | `planned`<br>`waiting_dependency`<br>`ready`<br>`starting`<br>`running`<br>`cleanup_pending`<br>`failed` | `cancelled` | `RES-CANCELLATION-CONTROLLER` | `INV-CANCEL-AFTER-CLEANUP` | `PR-Q-04` |
| `TRANS-TASK-ACTIVE-RECOVERY` | `starting`<br>`running`<br>`cleanup_pending`<br>`failed` | `recovery_required` | `RES-PROJECT-RECOVERY-EVIDENCE` | `INV-UNKNOWN-PRESERVES-RECOVERY` | `PR-A-04`<br>`PR-A-05` |
| `TRANS-TASK-RECOVERY-SETTLED` | `recovery_required` | `ready` | `RES-PROJECT-RECOVERY-EVIDENCE`<br>`RES-DOCKER-RECOVERY-ACKNOWLEDGEMENT` | `INV-RECOVERY-SETTLED-BEFORE-RESUME`<br>`INV-EXACT-RESULT-IDENTITY` | `PR-A-04`<br>`PR-A-05` |

### `SM-OBJECTIVE`

- 状態: `planned`<br>`executing`<br>`integration_pending`<br>`accepted`<br>`blocked`<br>`cancelled`
- 終端状態: `accepted`<br>`cancelled`

| 遷移ID | From | To | 資源 | 不変条件 | 検証 |
|---|---|---|---|---|---|
| `TRANS-OBJECTIVE-PLAN-EXECUTE` | `planned`<br>`blocked` | `executing` | — | `INV-NARROWED-AUTHORITY` | `PR-N-03`<br>`PR-Q-02` |
| `TRANS-OBJECTIVE-EXECUTE-INTEGRATE` | `executing` | `integration_pending` | `RES-INTEGRATION-WORKSPACE` | `INV-TASK-COMPLETE-NOT-ACCEPTED` | `PR-I-01` |
| `TRANS-OBJECTIVE-INTEGRATE-ACCEPT` | `integration_pending` | `accepted` | `RES-INTEGRATION-WORKSPACE` | `INV-INTEGRATE-BEFORE-ADOPTION` | `PR-I-02` |
| `TRANS-OBJECTIVE-ACTIVE-BLOCK` | `planned`<br>`executing`<br>`integration_pending` | `blocked` | — | `INV-NO-SUCCESS-FROM-UNKNOWN` | `PR-H-01`<br>`PR-I-01` |
| `TRANS-OBJECTIVE-ACTIVE-CANCEL` | `planned`<br>`executing`<br>`integration_pending`<br>`blocked` | `cancelled` | `RES-CANCELLATION-CONTROLLER` | `INV-CANCEL-AFTER-CLEANUP` | `PR-Q-04` |

### `SM-MILESTONE`

- 状態: `planned`<br>`executing`<br>`integrating`<br>`human_decision_required`<br>`recovery_required`<br>`accepted`<br>`cancelled`
- 終端状態: `accepted`<br>`cancelled`

| 遷移ID | From | To | 資源 | 不変条件 | 検証 |
|---|---|---|---|---|---|
| `TRANS-MILESTONE-PLAN-EXECUTE` | `planned` | `executing` | `RES-PROJECT-OPERATION-LEASE` | `INV-NARROWED-AUTHORITY`<br>`INV-EXACT-RESULT-IDENTITY`<br>`INV-PLATFORM-NO-FALLBACK`<br>`INV-TRANSPORT-NO-AUTHORITY` | `PR-N-01`<br>`PR-A-07` |
| `TRANS-MILESTONE-DECISION-ACCEPTED-EXECUTE` | `human_decision_required` | `executing` | `RES-PENDING-DECISION`<br>`RES-DECISION-CONTINUATION`<br>`RES-PROJECT-OPERATION-LEASE` | `INV-DECISION-BINDING-CURRENT`<br>`INV-DECISION-RECEIPT-BEFORE-RESUME`<br>`INV-DECISION-ATOMIC-APPLICATION`<br>`INV-REVALIDATE-AFTER-WAIT` | `PR-H-02`<br>`PR-Q-06` |
| `TRANS-MILESTONE-RECOVERY-SETTLED-EXECUTE` | `recovery_required` | `executing` | `RES-PROJECT-RECOVERY-EVIDENCE`<br>`RES-DOCKER-RECOVERY-ACKNOWLEDGEMENT`<br>`RES-PROJECT-OPERATION-LEASE` | `INV-RECOVERY-SETTLED-BEFORE-RESUME`<br>`INV-REVALIDATE-AFTER-WAIT` | `PR-A-04`<br>`PR-A-05`<br>`PR-A-06` |
| `TRANS-MILESTONE-EXECUTE-INTEGRATE` | `executing` | `integrating` | `RES-INTEGRATION-WORKSPACE` | `INV-TASK-COMPLETE-NOT-ACCEPTED` | `PR-I-01` |
| `TRANS-MILESTONE-INTEGRATE-ACCEPT` | `integrating` | `accepted` | `RES-INTEGRATION-WORKSPACE`<br>`RES-ADOPTION-LEASE` | `INV-INTEGRATE-BEFORE-ADOPTION`<br>`INV-CANONICAL-EFFECT-SERIALIZED`<br>`INV-LEASE-RELEASE-UNKNOWN-BLOCKS-REUSE` | `PR-I-02`<br>`PR-D-A-01` |
| `TRANS-MILESTONE-ACTIVE-HUMAN` | `executing`<br>`integrating` | `human_decision_required` | — | `INV-NO-SUCCESS-FROM-UNKNOWN` | `PR-H-01` |
| `TRANS-MILESTONE-ACTIVE-RECOVERY` | `executing`<br>`integrating`<br>`human_decision_required` | `recovery_required` | `RES-PROJECT-RECOVERY-EVIDENCE` | `INV-UNKNOWN-PRESERVES-RECOVERY` | `PR-A-04`<br>`PR-A-05` |
| `TRANS-MILESTONE-ACTIVE-CANCEL` | `planned`<br>`executing`<br>`integrating`<br>`human_decision_required`<br>`recovery_required` | `cancelled` | `RES-CANCELLATION-CONTROLLER` | `INV-CANCEL-AFTER-CLEANUP` | `PR-Q-04` |

### `SM-QUEUE`

- 状態: `queued`<br>`leased`<br>`running`<br>`waiting_foreground`<br>`integration_pending`<br>`replan_required`<br>`human_decision_required`<br>`recovery_required`<br>`completed`<br>`cancelled`
- 終端状態: `completed`<br>`cancelled`

| 遷移ID | From | To | 資源 | 不変条件 | 検証 |
|---|---|---|---|---|---|
| `TRANS-QUEUE-ENQUEUE-LEASE` | `queued` | `leased` | `RES-PROJECT-QUEUE`<br>`RES-PROJECT-OPERATION-LEASE` | `INV-DURABLE-BEFORE-TASK-EFFECT`<br>`INV-INTERACTIVE-PRIORITY-NO-PREEMPTION`<br>`INV-DURABLE-RECORD-CLOSED`<br>`INV-QUEUE-OWNER-IS-LIVE-LEASE`<br>`INV-LEASE-ACQUISITION-RECOVERABLE` | `PR-D-N-01`<br>`PR-D-Q-01`<br>`PR-Q-03`<br>`PR-Q-05`<br>`PR-A-04`<br>`PR-A-06` |
| `TRANS-QUEUE-DECISION-ACCEPTED-REPLAN` | `human_decision_required` | `replan_required` | `RES-PENDING-DECISION`<br>`RES-DECISION-CONTINUATION`<br>`RES-PROJECT-QUEUE` | `INV-DECISION-BINDING-CURRENT`<br>`INV-DECISION-RECEIPT-BEFORE-RESUME`<br>`INV-DECISION-APPLICATION-FINALIZED-BEFORE-QUEUE` | `PR-H-02`<br>`PR-Q-06` |
| `TRANS-QUEUE-REPLAN-QUEUED` | `replan_required` | `queued` | `RES-PROJECT-QUEUE` | `INV-REVALIDATE-AFTER-WAIT` | `PR-Q-02`<br>`PR-Q-06` |
| `TRANS-QUEUE-WAITING-QUEUED` | `waiting_foreground` | `queued` | `RES-PROJECT-QUEUE` | `INV-INTERACTIVE-PRIORITY-NO-PREEMPTION`<br>`INV-REVALIDATE-AFTER-WAIT` | `PR-Q-05` |
| `TRANS-QUEUE-RECOVERY-SETTLED-QUEUED` | `recovery_required` | `queued` | `RES-PROJECT-RECOVERY-EVIDENCE`<br>`RES-DOCKER-RECOVERY-ACKNOWLEDGEMENT` | `INV-RECOVERY-SETTLED-BEFORE-RESUME`<br>`INV-REVALIDATE-AFTER-WAIT` | `PR-A-04`<br>`PR-A-05`<br>`PR-A-06` |
| `TRANS-QUEUE-LEASE-RUN` | `leased` | `running` | `RES-PROJECT-OPERATION-LEASE` | `INV-REVALIDATE-AFTER-WAIT`<br>`INV-NO-LOCK-ACROSS-EXTERNAL-WAIT`<br>`INV-QUEUE-OWNER-IS-LIVE-LEASE`<br>`INV-LEASE-RELEASE-UNKNOWN-BLOCKS-REUSE` | `PR-D-Q-01`<br>`PR-D-A-01`<br>`PR-N-01`<br>`PR-A-06` |
| `TRANS-QUEUE-RUN-INTEGRATE` | `running` | `integration_pending` | `RES-INTEGRATION-WORKSPACE`<br>`RES-PROJECT-OPERATION-LEASE` | `INV-INTEGRATE-BEFORE-ADOPTION`<br>`INV-QUEUE-OWNER-CLEARED-AFTER-LEASE-SETTLEMENT` | `PR-I-01`<br>`PR-D-A-01` |
| `TRANS-QUEUE-INTEGRATE-COMPLETE` | `integration_pending` | `completed` | `RES-PROJECT-OPERATION-LEASE` | `INV-CANONICAL-EFFECT-SERIALIZED`<br>`INV-QUEUE-OWNER-CLEARED-AFTER-LEASE-SETTLEMENT` | `PR-I-02`<br>`PR-D-A-01` |
| `TRANS-QUEUE-QUEUED-FOREGROUND` | `queued` | `waiting_foreground` | `RES-PROJECT-QUEUE` | `INV-INTERACTIVE-PRIORITY-NO-PREEMPTION` | `PR-Q-05` |
| `TRANS-QUEUE-ACTIVE-REPLAN` | `leased`<br>`running`<br>`integration_pending` | `replan_required` | `RES-PROJECT-QUEUE` | `INV-NARROWED-AUTHORITY` | `PR-Q-02` |
| `TRANS-QUEUE-ACTIVE-HUMAN` | `leased`<br>`running`<br>`integration_pending`<br>`replan_required` | `human_decision_required` | `RES-PROJECT-QUEUE` | `INV-NO-SUCCESS-FROM-UNKNOWN` | `PR-H-01` |
| `TRANS-QUEUE-ACTIVE-RECOVERY` | `leased`<br>`running`<br>`integration_pending`<br>`replan_required`<br>`human_decision_required` | `recovery_required` | `RES-PROJECT-RECOVERY-EVIDENCE` | `INV-UNKNOWN-PRESERVES-RECOVERY` | `PR-A-04`<br>`PR-A-05`<br>`PR-A-06` |
| `TRANS-QUEUE-ACTIVE-CANCEL` | `queued`<br>`leased`<br>`running`<br>`waiting_foreground`<br>`integration_pending`<br>`replan_required`<br>`human_decision_required`<br>`recovery_required` | `cancelled` | `RES-CANCELLATION-CONTROLLER` | `INV-CANCEL-AFTER-CLEANUP` | `PR-Q-04` |

### `SM-DECISION`

- 状態: `pending`<br>`accepted`<br>`stale`<br>`superseded`<br>`cancelled`
- 終端状態: `accepted`<br>`stale`<br>`superseded`<br>`cancelled`

| 遷移ID | From | To | 資源 | 不変条件 | 検証 |
|---|---|---|---|---|---|
| `TRANS-DECISION-PENDING-ACCEPTED` | `pending` | `accepted` | `RES-PENDING-DECISION`<br>`RES-DECISION-CONTINUATION`<br>`RES-PROJECT-STATE` | `INV-DECISION-BINDING-CURRENT`<br>`INV-MCP-NO-HUMAN-AUTHORITY`<br>`INV-DECISION-ATOMIC-APPLICATION` | `PR-H-02`<br>`PR-Q-06` |
| `TRANS-DECISION-PENDING-STALE` | `pending` | `stale` | `RES-PENDING-DECISION`<br>`RES-DECISION-CONTINUATION` | `INV-DECISION-BINDING-CURRENT` | `PR-Q-06` |
| `TRANS-DECISION-PENDING-SUPERSEDED` | `pending` | `superseded` | `RES-PENDING-DECISION`<br>`RES-DECISION-CONTINUATION` | `INV-DECISION-BINDING-CURRENT` | `PR-Q-06` |
| `TRANS-DECISION-PENDING-CANCELLED` | `pending` | `cancelled` | `RES-PENDING-DECISION`<br>`RES-DECISION-CONTINUATION` | `INV-DECISION-BINDING-CURRENT` | `PR-Q-06` |

### `SM-DECISION-CONTINUATION`

- 状態: `absent`<br>`issued`<br>`prepared`<br>`finalized`<br>`recovery_required`<br>`invalidated`<br>`expired`
- 終端状態: `finalized`<br>`invalidated`<br>`expired`

| 遷移ID | From | To | 資源 | 不変条件 | 検証 |
|---|---|---|---|---|---|
| `TRANS-CONTINUATION-ABSENT-ISSUED` | `absent` | `issued` | `RES-DECISION-CONTINUATION` | `INV-DECISION-CONTINUATION-PROTOCOL`<br>`INV-DECISION-CAPABILITY-ISSUED-BEFORE-RETURN` | `PR-H-02`<br>`PR-Q-06` |
| `TRANS-CONTINUATION-ISSUED-PREPARED` | `issued` | `prepared` | `RES-DECISION-CONTINUATION` | `INV-DECISION-BINDING-CURRENT`<br>`INV-DECISION-CONTINUATION-PROTOCOL` | `PR-H-02`<br>`PR-Q-06` |
| `TRANS-CONTINUATION-PREPARED-FINALIZED` | `prepared` | `finalized` | `RES-DECISION-CONTINUATION`<br>`RES-PROJECT-STATE` | `INV-DECISION-CONTINUATION-PROTOCOL`<br>`INV-DECISION-ATOMIC-APPLICATION` | `PR-H-02`<br>`PR-Q-06` |
| `TRANS-CONTINUATION-PROJECT-UNKNOWN-RECOVERY` | `prepared` | `recovery_required` | `RES-DECISION-CONTINUATION`<br>`RES-PROJECT-STATE`<br>`RES-DECISION-RECOVERY-INTENT` | `INV-DECISION-CONTINUATION-PROTOCOL`<br>`INV-UNKNOWN-PRESERVES-RECOVERY`<br>`INV-DECISION-SEPARATE-RECOVERY-INTENT` | `PR-H-02`<br>`PR-Q-06`<br>`PR-A-05` |
| `TRANS-CONTINUATION-ISSUED-INVALIDATED` | `issued` | `invalidated` | `RES-DECISION-CONTINUATION` | `INV-DECISION-CONTINUATION-PROTOCOL` | `PR-H-02`<br>`PR-Q-06` |
| `TRANS-CONTINUATION-PREPARED-UNAPPLIED-INVALIDATED` | `prepared` | `invalidated` | `RES-DECISION-CONTINUATION`<br>`RES-PROJECT-STATE` | `INV-DECISION-CONTINUATION-PROTOCOL`<br>`INV-DECISION-PREPARED-INVALIDATION-READBACK` | `PR-H-02`<br>`PR-Q-06` |
| `TRANS-CONTINUATION-RECOVERY-FINALIZED` | `recovery_required` | `finalized` | `RES-DECISION-CONTINUATION`<br>`RES-PROJECT-STATE`<br>`RES-PROJECT-RECOVERY-EVIDENCE` | `INV-DECISION-CONTINUATION-PROTOCOL`<br>`INV-DECISION-RECOVERY-SETTLEMENT` | `PR-H-02`<br>`PR-Q-06`<br>`PR-A-05` |
| `TRANS-CONTINUATION-RECOVERY-INVALIDATED` | `recovery_required` | `invalidated` | `RES-DECISION-CONTINUATION`<br>`RES-PROJECT-STATE`<br>`RES-PROJECT-RECOVERY-EVIDENCE` | `INV-DECISION-CONTINUATION-PROTOCOL`<br>`INV-DECISION-RECOVERY-SETTLEMENT` | `PR-H-02`<br>`PR-Q-06`<br>`PR-A-05` |
| `TRANS-CONTINUATION-PROTECTED-RECOVERY-ISSUED-INVALIDATED` | `issued` | `invalidated` | `RES-DECISION-CONTINUATION`<br>`RES-DECISION-RECOVERY-INTENT` | `INV-DECISION-CONTINUATION-PROTOCOL`<br>`INV-DECISION-SEPARATE-RECOVERY-INTENT` | `PR-H-02`<br>`PR-Q-06`<br>`PR-A-05` |
| `TRANS-CONTINUATION-PROTECTED-RECOVERY-PREPARED-REQUIRED` | `prepared` | `recovery_required` | `RES-DECISION-CONTINUATION`<br>`RES-PROJECT-STATE`<br>`RES-DECISION-RECOVERY-INTENT` | `INV-DECISION-CONTINUATION-PROTOCOL`<br>`INV-DECISION-SEPARATE-RECOVERY-INTENT`<br>`INV-UNKNOWN-PRESERVES-RECOVERY` | `PR-H-02`<br>`PR-Q-06`<br>`PR-A-05` |
| `TRANS-CONTINUATION-ISSUED-EXPIRED` | `issued` | `expired` | `RES-DECISION-CONTINUATION` | `INV-DECISION-CONTINUATION-PROTOCOL` | `PR-H-02`<br>`PR-Q-06` |

### `SM-DECISION-RECOVERY-INTENT`

- 状態: `absent`<br>`required`<br>`settled`
- 終端状態: `settled`

| 遷移ID | From | To | 資源 | 不変条件 | 検証 |
|---|---|---|---|---|---|
| `TRANS-DECISION-RECOVERY-ABSENT-REQUIRED` | `absent` | `required` | `RES-DECISION-RECOVERY-INTENT` | `INV-DECISION-SEPARATE-RECOVERY-INTENT`<br>`INV-UNKNOWN-PRESERVES-RECOVERY` | `PR-H-02`<br>`PR-Q-06`<br>`PR-A-05` |
| `TRANS-DECISION-RECOVERY-REQUIRED-SETTLED` | `required` | `settled` | `RES-DECISION-RECOVERY-INTENT`<br>`RES-DECISION-CONTINUATION`<br>`RES-PROJECT-STATE` | `INV-DECISION-SEPARATE-RECOVERY-INTENT`<br>`INV-DECISION-RECOVERY-SETTLEMENT` | `PR-H-02`<br>`PR-Q-06`<br>`PR-A-05` |

## 9. 遷移と保証の対応

| ID | 遷移 | Lock | Authority | Effect | 順序 | 検証 |
|---|---|---|---|---|---|---|
| `BIND-TASK-PLAN-WAIT` | `TRANS-TASK-PLAN-WAIT` | `LOCK-PROJECT-STATE` | `AUTH-TASK` | `EFFECT-PROJECT-STATE` | `expected generation state update` | `PR-N-03` |
| `BIND-TASK-PLAN-READY` | `TRANS-TASK-PLAN-READY` | `LOCK-PROJECT-STATE` | `AUTH-TASK` | `EFFECT-PROJECT-STATE` | `dependency conflict and capacity revalidation precede state update` | `PR-N-02`<br>`PR-N-03`<br>`PR-Q-01`<br>`PR-A-01` |
| `BIND-TASK-READY-STARTING` | `TRANS-TASK-READY-STARTING` | `LOCK-PROJECT-STATE` | `AUTH-TASK` | `EFFECT-PROJECT-STATE` | `slot conflict reservation and task intent become durable in one generation` | `PR-N-02`<br>`PR-A-02` |
| `BIND-TASK-STARTING-RUNNING` | `TRANS-TASK-STARTING-RUNNING` | `LOCK-PROJECT-OPERATION` | `AUTH-TASK`<br>`AUTH-SINGLE-TASK-OPERATION` | `EFFECT-SINGLE-TASK`<br>`EFFECT-PROJECT-STATE` | `project state lock is released and all identities are revalidated before single task effect` | `PR-N-01`<br>`PR-A-03` |
| `BIND-TASK-ACTIVE-CLEANUP` | `TRANS-TASK-ACTIVE-CLEANUP` | `LOCK-PROJECT-STATE` | `AUTH-TASK` | `EFFECT-PROJECT-STATE` | `task settlement observation precedes cleanup pending projection` | `PR-Q-04`<br>`PR-A-05` |
| `BIND-TASK-CLEANUP-COMPLETED` | `TRANS-TASK-CLEANUP-COMPLETED` | `LOCK-PROJECT-STATE` | `AUTH-TASK` | `EFFECT-PROJECT-STATE` | `exact cleanup observation precedes completed projection` | `PR-N-01`<br>`PR-I-01` |
| `BIND-TASK-ACTIVE-FAILED` | `TRANS-TASK-ACTIVE-FAILED` | `LOCK-PROJECT-STATE` | `AUTH-TASK` | `EFFECT-PROJECT-STATE` | `known failure and current generation precede failed projection` | `PR-Q-02`<br>`PR-A-03` |
| `BIND-TASK-FAILED-SUPERSEDED` | `TRANS-TASK-FAILED-SUPERSEDED` | `LOCK-PROJECT-STATE` | `AUTH-TASK` | `EFFECT-PROJECT-STATE` | `old identity remains immutable before successor linkage` | `PR-Q-02` |
| `BIND-TASK-ACTIVE-CANCELLED` | `TRANS-TASK-ACTIVE-CANCELLED` | `LOCK-PROJECT-OPERATION`<br>`LOCK-PROJECT-STATE` | `AUTH-TASK`<br>`AUTH-SINGLE-TASK-OPERATION` | `EFFECT-SINGLE-TASK`<br>`EFFECT-PROJECT-STATE` | `cancellation request precedes termination cleanup and final state projection` | `PR-Q-04` |
| `BIND-TASK-ACTIVE-RECOVERY` | `TRANS-TASK-ACTIVE-RECOVERY` | `LOCK-PROJECT-STATE` | `AUTH-RECOVERY` | `EFFECT-PROJECT-STATE` | `unknown settlement is durably projected without issuing recovery effect` | `PR-A-04`<br>`PR-A-05` |
| `BIND-TASK-RECOVERY-SETTLED` | `TRANS-TASK-RECOVERY-SETTLED` | `LOCK-PROJECT-STATE` | `AUTH-RECOVERY` | `EFFECT-PROJECT-STATE` | `docker completion and absence receipt precedes project settled readback; runtime-state-lock serialized exact tombstone create and receipt removal precede project acknowledged readback; journaled tombstone removal and queue recovery settlement precede fresh retry projection; non-docker obligations require settled` | `PR-A-04`<br>`PR-A-05` |
| `BIND-OBJECTIVE-PLAN-EXECUTE` | `TRANS-OBJECTIVE-PLAN-EXECUTE` | `LOCK-PROJECT-STATE` | `AUTH-MILESTONE` | `EFFECT-PROJECT-STATE` | `objective authority and current generation precede execution state` | `PR-N-03`<br>`PR-Q-02` |
| `BIND-OBJECTIVE-EXECUTE-INTEGRATE` | `TRANS-OBJECTIVE-EXECUTE-INTEGRATE` | `LOCK-PROJECT-OPERATION`<br>`LOCK-PROJECT-STATE` | `AUTH-MILESTONE`<br>`AUTH-INTEGRATION` | `EFFECT-INTEGRATION-CANDIDATE`<br>`EFFECT-PROJECT-STATE` | `all task cleanup precedes isolated integration and integration pending projection` | `PR-I-01` |
| `BIND-OBJECTIVE-INTEGRATE-ACCEPT` | `TRANS-OBJECTIVE-INTEGRATE-ACCEPT` | `LOCK-PROJECT-STATE` | `AUTH-INTEGRATION` | `EFFECT-PROJECT-STATE` | `acceptance evidence and fixed integration result precede accepted projection` | `PR-I-02` |
| `BIND-OBJECTIVE-ACTIVE-BLOCK` | `TRANS-OBJECTIVE-ACTIVE-BLOCK` | `LOCK-PROJECT-STATE` | `AUTH-MILESTONE` | `EFFECT-PROJECT-STATE` | `unknown or conflict remains explicit before blocked projection` | `PR-H-01`<br>`PR-I-01` |
| `BIND-OBJECTIVE-ACTIVE-CANCEL` | `TRANS-OBJECTIVE-ACTIVE-CANCEL` | `LOCK-PROJECT-OPERATION`<br>`LOCK-PROJECT-STATE` | `AUTH-MILESTONE`<br>`AUTH-SINGLE-TASK-OPERATION` | `EFFECT-SINGLE-TASK`<br>`EFFECT-PROJECT-STATE` | `all target task cancellation cleanup precedes objective cancellation projection` | `PR-Q-04` |
| `BIND-MILESTONE-PLAN-EXECUTE` | `TRANS-MILESTONE-PLAN-EXECUTE` | `LOCK-PROJECT-OPERATION`<br>`LOCK-PROJECT-STATE` | `AUTH-MILESTONE` | `EFFECT-PROJECT-STATE` | `platform binding revision and authority validation precede execution state` | `PR-N-01`<br>`PR-A-07` |
| `BIND-MILESTONE-DECISION-ACCEPTED-EXECUTE` | `TRANS-MILESTONE-DECISION-ACCEPTED-EXECUTE` | `LOCK-PROJECT-OPERATION`<br>`LOCK-PROJECT-STATE` | `AUTH-MILESTONE`<br>`AUTH-HUMAN-DECISION` | `EFFECT-DECISION-STATE` | `logical milestone projection in the same project state atomic replace as decision acceptance; standalone issue forbidden` | `PR-H-02`<br>`PR-Q-06` |
| `BIND-MILESTONE-RECOVERY-SETTLED-EXECUTE` | `TRANS-MILESTONE-RECOVERY-SETTLED-EXECUTE` | `LOCK-PROJECT-STATE` | `AUTH-MILESTONE`<br>`AUTH-RECOVERY` | `EFFECT-PROJECT-STATE` | `every non-docker obligation settled and every docker obligation durably acknowledged with temporary tombstone garbage collected before queue settlement and execution state in the same state generation as the fresh task retry` | `PR-A-04`<br>`PR-A-05`<br>`PR-A-06` |
| `BIND-MILESTONE-EXECUTE-INTEGRATE` | `TRANS-MILESTONE-EXECUTE-INTEGRATE` | `LOCK-PROJECT-OPERATION`<br>`LOCK-PROJECT-STATE` | `AUTH-MILESTONE`<br>`AUTH-INTEGRATION` | `EFFECT-INTEGRATION-CANDIDATE`<br>`EFFECT-PROJECT-STATE` | `all objectives accepted before isolated milestone integration` | `PR-I-01` |
| `BIND-MILESTONE-INTEGRATE-ACCEPT` | `TRANS-MILESTONE-INTEGRATE-ACCEPT` | `LOCK-PROJECT-OPERATION`<br>`LOCK-ADOPTION`<br>`LOCK-PROJECT-STATE` | `AUTH-INTEGRATION`<br>`AUTH-ADOPTION`<br>`AUTH-MILESTONE` | `EFFECT-CANONICAL-ADOPTION`<br>`EFFECT-PROJECT-STATE` | `fixed candidate fresh canonical revision and adoption receipt precede accepted projection` | `PR-A-06`<br>`PR-I-02` |
| `BIND-MILESTONE-ACTIVE-HUMAN` | `TRANS-MILESTONE-ACTIVE-HUMAN` | `LOCK-PROJECT-STATE` | `AUTH-MILESTONE` | `EFFECT-PROJECT-STATE` | `decision need and impact are durable before human transfer` | `PR-H-01` |
| `BIND-MILESTONE-ACTIVE-RECOVERY` | `TRANS-MILESTONE-ACTIVE-RECOVERY` | `LOCK-PROJECT-STATE` | `AUTH-RECOVERY` | `EFFECT-PROJECT-STATE` | `unknown resource evidence is durable without normal resume` | `PR-A-04`<br>`PR-A-05` |
| `BIND-MILESTONE-ACTIVE-CANCEL` | `TRANS-MILESTONE-ACTIVE-CANCEL` | `LOCK-PROJECT-OPERATION`<br>`LOCK-PROJECT-STATE` | `AUTH-MILESTONE`<br>`AUTH-SINGLE-TASK-OPERATION` | `EFFECT-SINGLE-TASK`<br>`EFFECT-PROJECT-STATE` | `all task cancellation cleanup and recovery reconciliation precede milestone cancellation` | `PR-Q-04` |
| `BIND-QUEUE-ENQUEUE-LEASE` | `TRANS-QUEUE-ENQUEUE-LEASE` | `LOCK-QUEUE-MUTATION`<br>`LOCK-PROJECT-OPERATION` | `AUTH-MILESTONE` | `EFFECT-QUEUE-STATE` | `queue intent is durable before operation lease and locks are not held together` | `PR-D-N-01`<br>`PR-D-Q-01`<br>`PR-Q-03`<br>`PR-Q-05`<br>`PR-A-06` |
| `BIND-QUEUE-DECISION-ACCEPTED-REPLAN` | `TRANS-QUEUE-DECISION-ACCEPTED-REPLAN` | `LOCK-QUEUE-MUTATION` | `AUTH-MILESTONE` | `EFFECT-QUEUE-STATE` | `fresh read only protected finalized observation and matching project application generation precede the durable replan_required generation; no lease is issued on this transition` | `PR-H-02`<br>`PR-Q-06` |
| `BIND-QUEUE-REPLAN-QUEUED` | `TRANS-QUEUE-REPLAN-QUEUED` | `LOCK-QUEUE-MUTATION` | `AUTH-MILESTONE` | `EFFECT-QUEUE-STATE` | `bounded replanning is durably complete before the queue returns to queued for a fresh selection` | `PR-Q-02`<br>`PR-Q-06` |
| `BIND-QUEUE-WAITING-QUEUED` | `TRANS-QUEUE-WAITING-QUEUED` | `LOCK-QUEUE-MUTATION` | `AUTH-MILESTONE` | `EFFECT-QUEUE-STATE` | `a fresh binding-wide scan confirms no foreground owner before the scheduled queue returns to queued` | `PR-Q-05` |
| `BIND-QUEUE-RECOVERY-SETTLED-QUEUED` | `TRANS-QUEUE-RECOVERY-SETTLED-QUEUED` | `LOCK-QUEUE-MUTATION` | `AUTH-RECOVERY` | `EFFECT-RECOVERY`<br>`EFFECT-QUEUE-STATE` | `runtime uses durable exact recovery identity; docker receipt and absence project settled exact acknowledgement project acknowledged and acknowledgement garbage collection precede queue settlement; a later ordinary selection revalidates before lease` | `PR-A-04`<br>`PR-A-05`<br>`PR-A-06` |
| `BIND-QUEUE-LEASE-RUN` | `TRANS-QUEUE-LEASE-RUN` | `LOCK-QUEUE-MUTATION`<br>`LOCK-PROJECT-OPERATION` | `AUTH-MILESTONE` | `EFFECT-QUEUE-STATE` | `lease identity is revalidated before running projection` | `PR-N-01`<br>`PR-A-06` |
| `BIND-QUEUE-RUN-INTEGRATE` | `TRANS-QUEUE-RUN-INTEGRATE` | `LOCK-QUEUE-MUTATION`<br>`LOCK-PROJECT-OPERATION` | `AUTH-INTEGRATION` | `EFFECT-INTEGRATION-CANDIDATE`<br>`EFFECT-QUEUE-STATE` | `all task cleanup precedes integration and queue projection` | `PR-I-01` |
| `BIND-QUEUE-INTEGRATE-COMPLETE` | `TRANS-QUEUE-INTEGRATE-COMPLETE` | `LOCK-QUEUE-MUTATION`<br>`LOCK-PROJECT-OPERATION` | `AUTH-MILESTONE` | `EFFECT-QUEUE-STATE` | `milestone terminal state and all resource release observations precede queue completion` | `PR-I-02` |
| `BIND-QUEUE-QUEUED-FOREGROUND` | `TRANS-QUEUE-QUEUED-FOREGROUND` | `LOCK-QUEUE-MUTATION` | `AUTH-MILESTONE` | `EFFECT-QUEUE-STATE` | `interactive priority delays only unstarted scheduled entry` | `PR-Q-05` |
| `BIND-QUEUE-ACTIVE-REPLAN` | `TRANS-QUEUE-ACTIVE-REPLAN` | `LOCK-QUEUE-MUTATION`<br>`LOCK-PROJECT-OPERATION` | `AUTH-MILESTONE` | `EFFECT-QUEUE-STATE` | `settled task impact and bounded replan need precede queue projection` | `PR-Q-02` |
| `BIND-QUEUE-ACTIVE-HUMAN` | `TRANS-QUEUE-ACTIVE-HUMAN` | `LOCK-QUEUE-MUTATION`<br>`LOCK-PROJECT-OPERATION` | `AUTH-MILESTONE` | `EFFECT-QUEUE-STATE` | `decision need is durable and operation remains owned` | `PR-H-01` |
| `BIND-QUEUE-ACTIVE-RECOVERY` | `TRANS-QUEUE-ACTIVE-RECOVERY` | `LOCK-QUEUE-MUTATION`<br>`LOCK-PROJECT-OPERATION` | `AUTH-RECOVERY` | `EFFECT-QUEUE-STATE` | `exact recovery evidence is durable without recovery effect or lease release` | `PR-A-04`<br>`PR-A-05`<br>`PR-A-06` |
| `BIND-QUEUE-ACTIVE-CANCEL` | `TRANS-QUEUE-ACTIVE-CANCEL` | `LOCK-QUEUE-MUTATION`<br>`LOCK-PROJECT-OPERATION` | `AUTH-MILESTONE`<br>`AUTH-SINGLE-TASK-OPERATION` | `EFFECT-SINGLE-TASK`<br>`EFFECT-QUEUE-STATE` | `all target cancellation cleanup and resource reconciliation precede queue cancellation` | `PR-Q-04` |
| `BIND-DECISION-PENDING-ACCEPTED` | `TRANS-DECISION-PENDING-ACCEPTED` | `LOCK-PROJECT-OPERATION`<br>`LOCK-PROJECT-STATE` | `AUTH-MILESTONE`<br>`AUTH-HUMAN-DECISION` | `EFFECT-DECISION-STATE` | `protected continuation consume intent precedes one expected generation atomic decision and milestone project state replace then readback; queue lease is a later idempotent transition` | `PR-H-02`<br>`PR-Q-06` |
| `BIND-DECISION-PENDING-STALE` | `TRANS-DECISION-PENDING-STALE` | `LOCK-PROJECT-STATE` | `AUTH-MILESTONE` | `EFFECT-DECISION-STATE` | `parent observed project generation change precedes runtime owned stale transition` | `PR-Q-06` |
| `BIND-DECISION-PENDING-SUPERSEDED` | `TRANS-DECISION-PENDING-SUPERSEDED` | `LOCK-PROJECT-STATE` | `AUTH-MILESTONE` | `EFFECT-DECISION-STATE` | `parent issued replacement decision before runtime owned superseded transition` | `PR-Q-06` |
| `BIND-DECISION-PENDING-CANCELLED` | `TRANS-DECISION-PENDING-CANCELLED` | `LOCK-PROJECT-STATE` | `AUTH-MILESTONE` | `EFFECT-DECISION-STATE` | `milestone cancellation precedes runtime owned decision cancellation` | `PR-Q-06` |
| `BIND-CONTINUATION-ABSENT-ISSUED` | `TRANS-CONTINUATION-ABSENT-ISSUED` | `LOCK-PROJECT-OPERATION` | `AUTH-MILESTONE` | `EFFECT-DECISION-CONTINUATION` | `unique pending decision or replacement request identity precedes protected create CAS and fresh readback; raw capability is returned to the client only after issued readback and duplicate request reuses the same issued record` | `PR-H-02`<br>`PR-Q-06` |
| `BIND-CONTINUATION-ISSUED-PREPARED` | `TRANS-CONTINUATION-ISSUED-PREPARED` | `LOCK-PROJECT-OPERATION` | `AUTH-HUMAN-DECISION` | `EFFECT-DECISION-CONTINUATION` | `validated exact submission precedes protected CAS from issued to prepared and protected readback precedes project state effect` | `PR-H-02`<br>`PR-Q-06` |
| `BIND-CONTINUATION-PREPARED-FINALIZED` | `TRANS-CONTINUATION-PREPARED-FINALIZED` | `LOCK-PROJECT-OPERATION` | `AUTH-HUMAN-DECISION` | `EFFECT-DECISION-CONTINUATION` | `fresh project state readback with matching application id and new generation precedes protected CAS from prepared to finalized and protected readback` | `PR-H-02`<br>`PR-Q-06` |
| `BIND-CONTINUATION-PROJECT-UNKNOWN-RECOVERY` | `TRANS-CONTINUATION-PROJECT-UNKNOWN-RECOVERY` | `LOCK-PROJECT-OPERATION` | `AUTH-RECOVERY` | `EFFECT-DECISION-CONTINUATION` | `when project observation alone is unknown a separate recovery intent required readback already exists before protected prepared to recovery_required CAS and readback; protected unknown never claims this transition` | `PR-H-02`<br>`PR-Q-06`<br>`PR-A-05` |
| `BIND-CONTINUATION-ISSUED-INVALIDATED` | `TRANS-CONTINUATION-ISSUED-INVALIDATED` | `LOCK-PROJECT-OPERATION` | `AUTH-MILESTONE` | `EFFECT-DECISION-CONTINUATION` | `runtime owned stale superseded cancelled terminal or explicit replacement cause precedes issued record invalidation CAS and readback` | `PR-H-02`<br>`PR-Q-06` |
| `BIND-CONTINUATION-PREPARED-UNAPPLIED-INVALIDATED` | `TRANS-CONTINUATION-PREPARED-UNAPPLIED-INVALIDATED` | `LOCK-PROJECT-OPERATION` | `AUTH-MILESTONE` | `EFFECT-DECISION-CONTINUATION` | `fresh project state readback proves expected old generation and application absent before prepared record invalidation CAS and readback; matching new generation must finalize instead` | `PR-H-02`<br>`PR-Q-06` |
| `BIND-CONTINUATION-RECOVERY-FINALIZED` | `TRANS-CONTINUATION-RECOVERY-FINALIZED` | `LOCK-PROJECT-OPERATION` | `AUTH-RECOVERY` | `EFFECT-DECISION-CONTINUATION` | `exact recovery fresh readback proves matching new project generation and application id before protected recovery to finalized CAS and readback` | `PR-H-02`<br>`PR-Q-06`<br>`PR-A-05` |
| `BIND-CONTINUATION-RECOVERY-INVALIDATED` | `TRANS-CONTINUATION-RECOVERY-INVALIDATED` | `LOCK-PROJECT-OPERATION` | `AUTH-RECOVERY` | `EFFECT-DECISION-CONTINUATION` | `exact recovery fresh readback proves expected old project generation and application absent before protected recovery to invalidated CAS and readback` | `PR-H-02`<br>`PR-Q-06`<br>`PR-A-05` |
| `BIND-CONTINUATION-PROTECTED-RECOVERY-ISSUED-INVALIDATED` | `TRANS-CONTINUATION-PROTECTED-RECOVERY-ISSUED-INVALIDATED` | `LOCK-PROJECT-OPERATION` | `AUTH-RECOVERY` | `EFFECT-DECISION-CONTINUATION` | `independent recovery intent required readback and fresh issued observation with no project application precede protected issued to invalidated CAS and readback` | `PR-H-02`<br>`PR-Q-06`<br>`PR-A-05` |
| `BIND-CONTINUATION-PROTECTED-RECOVERY-PREPARED-REQUIRED` | `TRANS-CONTINUATION-PROTECTED-RECOVERY-PREPARED-REQUIRED` | `LOCK-PROJECT-OPERATION` | `AUTH-RECOVERY` | `EFFECT-DECISION-CONTINUATION` | `independent recovery intent required readback and fresh prepared observation precede protected prepared to recovery_required CAS and readback; exact project reconciliation follows through recovery transitions` | `PR-H-02`<br>`PR-Q-06`<br>`PR-A-05` |
| `BIND-CONTINUATION-ISSUED-EXPIRED` | `TRANS-CONTINUATION-ISSUED-EXPIRED` | `LOCK-PROJECT-OPERATION` | `AUTH-MILESTONE` | `EFFECT-DECISION-CONTINUATION` | `runtime observed finite expiry precedes protected expiry CAS and readback` | `PR-H-02`<br>`PR-Q-06` |
| `BIND-DECISION-RECOVERY-ABSENT-REQUIRED` | `TRANS-DECISION-RECOVERY-ABSENT-REQUIRED` | `LOCK-PROJECT-OPERATION` | `AUTH-RECOVERY` | `EFFECT-DECISION-RECOVERY-INTENT` | `project-only unknown or protected observation or CAS readback unknown first creates and reads back one exact independent recovery intent; protected unknown then stops without claiming a continuation transition; unavailable recovery store requires manual recovery effect unknown and process reuse forbidden` | `PR-H-02`<br>`PR-Q-06`<br>`PR-A-05` |
| `BIND-DECISION-RECOVERY-REQUIRED-SETTLED` | `TRANS-DECISION-RECOVERY-REQUIRED-SETTLED` | `LOCK-PROJECT-OPERATION` | `AUTH-RECOVERY` | `EFFECT-DECISION-RECOVERY-INTENT` | `independent intent joins fresh protected and project observations; any required continuation transition settles and reads back first and intent settlement CAS and readback completes last` | `PR-H-02`<br>`PR-Q-06`<br>`PR-A-05` |

## 10. 不変条件

| ID | 必須意味 |
|---|---|
| `INV-DURABLE-BEFORE-TASK-EFFECT` | `Task attempt and non-secret authority binding become reserved before operation creation; exact operation identity becomes handoff_prepared before Single Task effect; running is recorded only from the adapter start observation` |
| `INV-MAX-FIVE-CLEANUP-AWARE` | `Starting running and cleanup-unknown tasks occupy at most five capacity slots` |
| `INV-REVALIDATE-AFTER-WAIT` | `Generation identity authority cancellation and conflicts are revalidated after every wait` |
| `INV-NO-LOCK-ACROSS-EXTERNAL-WAIT` | `Queue state and adoption mutation locks are not held across provider process transport or human waits` |
| `INV-NARROWED-AUTHORITY` | `Project Runtime derives the task authority binding from the current project milestone revision objective task and retry generation; the coordinator adapter receives only the resulting task-scoped request and cannot supply or widen that binding` |
| `INV-TASK-COMPLETE-NOT-ACCEPTED` | `Task completion never implies objective or milestone acceptance` |
| `INV-CANONICAL-CANDIDATE-IDENTITY` | `Candidate Storeが発行した正規Candidate IdentityはIntegration Record、公開結果、採用要求およびReceiptで欠落・短縮・再採番されず、ConsumerはCanonical Contractより狭い局所制限を課さない` |
| `INV-EXACT-RESULT-IDENTITY` | `Generation task attempt operation authority revision and storable recovery identities plus status effect cleanup recovery and process restart correlations must match before projection; runtime process recovery identity is issued only by the parent runtime and accepted only for its process instance task attempt and operation; known rejection before delegation replans with no effect, while unknown handoff after delegation or any non-settled result after observed effect start poisons the process, creates the bound runtime process obligation, and remains externally unresolved unless an exact external recovery closure exists` |
| `INV-INTEGRATE-BEFORE-ADOPTION` | `Objective and milestone evidence and cross-task integration precede canonical adoption` |
| `INV-UNKNOWN-PRESERVES-RECOVERY` | `Unknown cleanup or effect state preserves evidence and exact recovery identity` |
| `INV-NO-SUCCESS-FROM-UNKNOWN` | `Missing stale or conflicting evidence is not normalized to success` |
| `INV-CANCEL-AFTER-CLEANUP` | `Cancellation completes only after any freshly issued unused task authority is revoked and every target whose provider command received a successful OS spawn acknowledgement with valid process and stream ownership then emitted one durably accepted lifecycle notice for the exact objective role provider and globally unique operation terminates cleanup completes and project state is projected; handle return provider selection or controller start is not provider process-start evidence and uncertain acknowledgement notice delivery or revocation preserves failure or recovery` |
| `INV-OLD-IDENTITY-IMMUTABLE` | `Superseded task identity remains immutable and links to a new successor` |
| `INV-PLATFORM-NO-FALLBACK` | `Unknown or unsupported platform stops without fallback or effect` |
| `INV-TRANSPORT-NO-AUTHORITY` | `CLI MCP and future transports do not create project authority or success; Integration result fields recovery identities and correlations are validated by the Core-owned canonical contract rather than redefined by MCP; MCP emits only method-specific exact-contract recursively closed descriptor-safe DTOs and rejects nested unknown fields cross-method shapes outer-to-nested project or milestone mismatch status effect cleanup manual-recovery process-restart recovery-obligation correlation failures duplicate or invalid recovery identities unreachable milestone and objective or task count combinations and outer-objective contradictions with acceptance cancellation human-decision or recovery; resolved history is not promoted to current blockage and transport does not guess schedule versus wait without the task graph` |
| `INV-CANONICAL-EFFECT-SERIALIZED` | `Canonical repository adoption is serialized and fresh revision checked` |
| `INV-INTERACTIVE-PRIORITY-NO-PREEMPTION` | `Queue priority applies only to unowned entries; after the repository binding lease is acquired a fresh queue selection must still match before claim; a leased or running owner prevents every second operation lease, parks later scheduled work, and never erases active obligations` |
| `INV-DURABLE-RECORD-CLOSED` | `Durable state and queue records have an exact schema filename bound generation and contiguous immutable generation history` |
| `INV-QUEUE-OWNER-IS-LIVE-LEASE` | `Queue owner generation is derived only from a runtime issued live lease bound to the exact repository binding and queue; one binding has at most one operation owner` |
| `INV-LEASE-RELEASE-UNKNOWN-BLOCKS-REUSE` | `Every post-acquire exit attempts physical release; lease release intent is durable before lock removal and unresolved exact evidence blocks reacquisition` |
| `INV-LEASE-ACQUISITION-RECOVERABLE` | `An atomically published acquisition marker bound to lease kind source queue owner generation process and deterministic recovery identity precedes the physical lock; a second exact marker proves lock ownership; project operation and canonical adoption pre-owner failures reach fresh complete rollback, exact common recovery with all markers and lock absent, or unchanged manual recovery obligation` |
| `INV-QUEUE-OWNER-CLEARED-AFTER-LEASE-SETTLEMENT` | `Queue owner is cleared only after fresh lock absence exact released evidence and release-marker absence` |
| `INV-RECOVERY-SETTLED-BEFORE-RESUME` | `Recovery resumes only after every typed per-task obligation retains exact identity through required recovering and settled and each Docker obligation additionally reaches acknowledged; Docker ordering is completion receipt and resource absence then project settled readback then runtime-state-lock serialized exact tombstone create and receipt removal then project acknowledged readback bound to repository project milestone task attempt operation settlement generation runtime root four hashes and receipt committed pair then journaled tombstone removal then queue settlement; absence or recovery id alone grants no acknowledgement or deletion authority; interrupted committed-pair creation and removal resume only the exact incomplete effect; temporary tombstones are garbage collected after project acknowledgement without LRU or time deletion so sequential recovery does not exhaust the finite cap; unknown remains manual and recovery precedes fresh generation revision and conflict validation` |
| `INV-DECISION-BINDING-CURRENT` | `Human decision applies only to the exact current decision project milestone generation revision and allowed option` |
| `INV-MCP-NO-HUMAN-AUTHORITY` | `MCP metadata session provider identity and comment never create Human Authority` |
| `INV-DECISION-RECEIPT-BEFORE-RESUME` | `Milestone and queue resume only once from an exact accepted decision receipt and fresh project generation` |
| `INV-DECISION-ATOMIC-APPLICATION` | `Protected continuation record is prepared before one atomic decision and milestone project state replace then reconciled and finalized without claiming cross root atomicity` |
| `INV-DECISION-APPLICATION-FINALIZED-BEFORE-QUEUE` | `Queue lease occurs only after fresh protected continuation finalized observation and matching project state application id and generation readback` |
| `INV-DECISION-CONTINUATION-PROTOCOL` | `Only Platform Adapter owned protected CAS creates issued and transitions issued to prepared and prepared to finalized; invalid input leaves the record unchanged; project-only unknown may enter protected recovery after independent intent readback while protected-root unknown records only independent recovery intent and claims no protected transition` |
| `INV-DECISION-CAPABILITY-ISSUED-BEFORE-RETURN` | `Raw capability is returned only after unique protected issued record create and fresh readback; duplicate issuance request reuses the same record and replacement first invalidates the old hash` |
| `INV-DECISION-PREPARED-INVALIDATION-READBACK` | `Prepared continuation invalidates only after fresh project state proves the expected old generation and application id absent; matching new generation finalizes and unknown recovers` |
| `INV-DECISION-RECOVERY-SETTLEMENT` | `Recovery settles matching new project generation to continuation finalized and verified old unapplied to continuation invalidated; exact absent with raw not returned or exact expired with project unapplied safely settles no-effect; unknown or conflict preserves the observable continuation state and keeps the independent recovery intent required` |
| `INV-DECISION-SEPARATE-RECOVERY-INTENT` | `Protected observation unknown never claims a protected transition and uses a separate verified recovery store; if that store is unknown manual recovery and process reuse prohibition remain` |

## 11. 失敗注入

| ID | 対象遷移 | 期待結果 | 検証 |
|---|---|---|---|
| `FAIL-QUEUE-WRITE` | `TRANS-QUEUE-ENQUEUE-LEASE` | `no_task_or_provider_effect_and_no_state_reset` | `PR-D-A-01`<br>`PR-A-06` |
| `FAIL-LEASE-ACQUISITION` | `TRANS-QUEUE-ENQUEUE-LEASE` | `marker_write_flush_rename_readback_lock_ownership_evidence_release_intent_and_pre_owner_failures_reach_fresh_total_absence_exact_common_recovery_or_unchanged_manual_recovery_with_deterministic_identity` | `PR-A-04`<br>`PR-D-A-01` |
| `FAIL-LEASE-OWNER-LOSS` | `TRANS-QUEUE-LEASE-RUN`<br>`TRANS-MILESTONE-ACTIVE-RECOVERY` | `reserved task returns ready with effect zero; handoff_prepared task requires exact matched recovery or explicit complete absence; running task requires exact matched recovery; all post-acquire exits attempt physical release and exact queue owner reconciliation or retain every typed recovery obligation` | `PR-A-04`<br>`PR-A-06` |
| `FAIL-STATE-GENERATION` | `TRANS-TASK-ACTIVE-FAILED` | `no_cross_task_projection` | `PR-A-03` |
| `FAIL-DUPLICATE-REQUEST` | `TRANS-QUEUE-ENQUEUE-LEASE` | `same_request_reuses_project_operation_distinct_tasks_may_run_and_same_task_attempt_effect_is_not_reissued` | `PR-D-Q-01`<br>`PR-Q-03` |
| `FAIL-CAPACITY-RACE` | `TRANS-TASK-READY-STARTING` | `sixth_task_effect_zero` | `PR-A-02` |
| `FAIL-TASK-RESULT-IDENTITY` | `TRANS-TASK-ACTIVE-FAILED` | `identity schema correlation unstorable recovery unknown recovery kind or flat-to-typed mismatch is not success; no synthetic recovery identity is minted; unresolved recovery and process restart are preserved in the project result` | `PR-A-03` |
| `FAIL-CANCEL-DURING-START` | `TRANS-TASK-ACTIVE-CANCELLED` | `synchronous_or_asynchronous_spawn_failure_emits_no_start_notice_and_closes_fail_closed_or_post_spawn_acknowledgement_exact_ordered_notice_write_receipt_termination_and_cleanup_are_tracked` | `PR-Q-04` |
| `FAIL-CLEANUP-UNKNOWN` | `TRANS-TASK-ACTIVE-RECOVERY` | `slot_and_conflict_not_released` | `PR-A-05` |
| `FAIL-INTEGRATION-CONFLICT` | `TRANS-OBJECTIVE-ACTIVE-BLOCK`<br>`TRANS-MILESTONE-ACTIVE-HUMAN` | `no_acceptance_and_candidate_isolated` | `PR-I-01` |
| `FAIL-ADOPTION-REVISION` | `TRANS-QUEUE-ACTIVE-REPLAN`<br>`TRANS-QUEUE-ACTIVE-HUMAN` | `canonical_effect_zero` | `PR-A-06` |
| `FAIL-TRANSPORT-DISCONNECT` | `TRANS-TASK-ACTIVE-CANCELLED` | `cancel_request_separate_from_durable_completion` | `PR-Q-04` |
| `FAIL-PLATFORM-UNAVAILABLE` | `TRANS-MILESTONE-PLAN-EXECUTE` | `no_fallback_and_effect_zero` | `PR-A-07` |
| `FAIL-DECISION-STALE` | `TRANS-DECISION-PENDING-ACCEPTED` | `invalid_submit_causes_no_decision_transition_project_change_task_effect_or_authority_generation` | `PR-Q-06`<br>`PR-H-02` |
| `FAIL-DECISION-ATOMIC-APPLICATION` | `TRANS-CONTINUATION-ISSUED-PREPARED`<br>`TRANS-DECISION-PENDING-ACCEPTED`<br>`TRANS-MILESTONE-DECISION-ACCEPTED-EXECUTE`<br>`TRANS-CONTINUATION-PREPARED-FINALIZED`<br>`TRANS-CONTINUATION-PROJECT-UNKNOWN-RECOVERY`<br>`TRANS-DECISION-RECOVERY-ABSENT-REQUIRED`<br>`TRANS-QUEUE-DECISION-ACCEPTED-REPLAN` | `protected issued_to_prepared CAS and readback precede project_write_flush_readback; matching application_id_and_generations precede prepared_to_finalized CAS and readback; project_only_unknown may update protected recovery after independent intent while protected_unknown records only independent recovery intent; decision_and_milestone all_old_or_all_new; queue fresh_observes_finalized and task_effect_at_most_once` | `PR-Q-06`<br>`PR-H-02` |
| `FAIL-DECISION-CONTINUATION` | `TRANS-CONTINUATION-ABSENT-ISSUED`<br>`TRANS-CONTINUATION-ISSUED-PREPARED`<br>`TRANS-CONTINUATION-PREPARED-FINALIZED`<br>`TRANS-CONTINUATION-PROJECT-UNKNOWN-RECOVERY`<br>`TRANS-CONTINUATION-ISSUED-INVALIDATED`<br>`TRANS-CONTINUATION-PREPARED-UNAPPLIED-INVALIDATED`<br>`TRANS-CONTINUATION-RECOVERY-FINALIZED`<br>`TRANS-CONTINUATION-RECOVERY-INVALIDATED`<br>`TRANS-CONTINUATION-PROTECTED-RECOVERY-ISSUED-INVALIDATED`<br>`TRANS-CONTINUATION-PROTECTED-RECOVERY-PREPARED-REQUIRED`<br>`TRANS-CONTINUATION-ISSUED-EXPIRED`<br>`TRANS-DECISION-RECOVERY-ABSENT-REQUIRED`<br>`TRANS-DECISION-RECOVERY-REQUIRED-SETTLED` | `protected_create_failure returns no raw capability; duplicate pending decision or replacement request reuses one issued record; response_loss does not auto_replace; invalid_submit_preserves_legitimate_capability; initial create unknown settles exact absent without effect or invalidates fresh issued; expiry unknown settles fresh expired or invalidates fresh issued; fresh prepared enters exact protected recovery; project_only_unknown persists independent intent then protected recovery; protected_unknown never claims unobserved transition and persists exact independent intent; recovery joins fresh roots then settles continuation before intent; unavailable intent store returns manual_recovery effect_unknown process_reuse_forbidden; no duplicate authority effect or raw capability persistence` | `PR-Q-06`<br>`PR-H-02` |

## 12. 実装・検証への接続

実装接続と検証接続は機械可読な設計対応で管理する。この表は現在の対応集合を人間が確認するための投影であり、Pathや試験の存在だけをCapability成立の根拠にしない。

### 実装接続

| ID | Interface | 状態 | 段階 | Path |
|---|---|---|---|---|
| `IMPL-PROJECT-STATE-CANDIDATE` | `IF-PROJECT-CORE`<br>`IF-SCHEDULER`<br>`IF-INTEGRATION` | `partial` | `responsibility_separation` | `40_Develop/orchestrator/src/core/project-runtime-state.ts`<br>`40_Develop/orchestrator/tests/unit/project-runtime-state.contract.test.ts` |
| `IMPL-PUBLIC-OBJECTIVE-INTAKE-CANDIDATE` | `IF-PROJECT-CORE`<br>`IF-QUEUE`<br>`IF-TRANSPORT` | `partial` | `public_objective_intake` | `40_Develop/orchestrator/src/public-contract/objective-request.ts`<br>`40_Develop/orchestrator/src/application/project-runtime-objective-intake.ts`<br>`40_Develop/orchestrator/src/application/project-runtime-objective-application.ts`<br>`40_Develop/orchestrator/tests/unit/public-contract.contract.test.ts`<br>`40_Develop/orchestrator/tests/unit/objective-intake.contract.test.ts`<br>`40_Develop/coordinator/bin/coordinator.ts`<br>`40_Develop/orchestrator/src/task/objective-intake.ts`<br>`40_Develop/orchestrator/src/task/composition-root.ts`<br>`40_Develop/coordinator/src/task/coordinator-task-runtime.ts`<br>`40_Develop/coordinator/scripts/project-runtime-real-provider-contract.ts`<br>`40_Develop/coordinator/scripts/verify-project-runtime-real-providers.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-objective-intake.contract.test.ts`<br>`40_Develop/coordinator/tests/system/project-runtime-real-provider-verification-script.contract.test.ts` |
| `IMPL-MCP-ADAPTER-CANDIDATE` | `IF-TRANSPORT`<br>`IF-PROJECT-CORE`<br>`IF-DECISION` | `partial` | `responsibility_separation` | `40_Develop/orchestrator/src/public-contract/objective-request.ts`<br>`40_Develop/orchestrator/src/public-contract/decision-request.ts`<br>`40_Develop/orchestrator/src/public-contract/integration-result.ts`<br>`40_Develop/orchestrator/src/public-contract/runtime-result.ts`<br>`40_Develop/orchestrator/tests/unit/public-contract.contract.test.ts`<br>`40_Develop/mcp-server/src/index.ts`<br>`40_Develop/mcp-server/src/adapters/project-runtime-adapter.ts`<br>`40_Develop/mcp-server/src/transports/stdio-transport.ts`<br>`40_Develop/mcp-server/tests/unit/project-runtime-adapter.contract.test.ts`<br>`40_Develop/mcp-server/tests/system/stdio-transport.integration.test.ts` |
| `IMPL-RESPONSIBILITY-SEPARATION-CANDIDATE` | `IF-SINGLE-TASK`<br>`IF-PLATFORM`<br>`IF-INTEGRATION`<br>`IF-DECISION` | `partial` | `responsibility_separation` | `40_Develop/orchestrator/src/ports/candidate-port.ts`<br>`40_Develop/orchestrator/src/ports/decision-port.ts`<br>`40_Develop/orchestrator/src/ports/execution-port.ts`<br>`40_Develop/orchestrator/src/ports/execution-observation-port.ts`<br>`40_Develop/orchestrator/src/ports/platform-contract.ts`<br>`40_Develop/orchestrator/tests/unit/execution-observation-port.contract.test.ts`<br>`40_Develop/orchestrator/tests/unit/platform-contract.contract.test.ts`<br>`40_Develop/orchestrator/tests/unit/public-contract.contract.test.ts`<br>`40_Develop/orchestrator/src/task/candidate-integration-adapter.ts`<br>`40_Develop/orchestrator/src/storage/protected-decision-store.ts`<br>`40_Develop/orchestrator/src/task/windows-platform-adapter.ts`<br>`40_Develop/orchestrator/src/task/single-task-adapter.ts`<br>`40_Develop/orchestrator/src/task/execution-intelligence-adapter.ts`<br>`40_Develop/coordinator/tests/unit/project-runtime-windows-platform-adapter.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-candidate-integration-adapter.integration.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-windows-decision-store.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-single-task-adapter.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-platform-independence.contract.test.ts` |
| `IMPL-DURABLE-FOUNDATION-CANDIDATE` | `IF-STATE-STORE`<br>`IF-QUEUE` | `partial` | `durable_foundation` | `40_Develop/orchestrator/src/core/project-runtime-queue.ts`<br>`40_Develop/orchestrator/src/ports/lease-port.ts`<br>`40_Develop/orchestrator/src/ports/port-result.ts`<br>`40_Develop/orchestrator/src/ports/state-port.ts`<br>`40_Develop/orchestrator/src/storage/current-state-store.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-durable-foundation.contract.test.ts` |
| `IMPL-PROJECT-EXECUTION-CANDIDATE` | `IF-PROJECT-CORE`<br>`IF-SCHEDULER`<br>`IF-INTEGRATION`<br>`IF-TRANSPORT` | `partial` | `responsibility_separation` | `40_Develop/orchestrator/src/application/project-runtime-execution.ts`<br>`40_Develop/orchestrator/src/ports/clock-identity-port.ts`<br>`40_Develop/orchestrator/src/ports/process-safety-port.ts`<br>`40_Develop/orchestrator/src/ports/execution-authorization-port.ts`<br>`40_Develop/coordinator/src/host-runtime/runtime-process-safety-state.ts`<br>`40_Develop/orchestrator/src/task/execution-host-adapter.ts`<br>`40_Develop/orchestrator/src/task/execution-authorization-adapter.ts`<br>`40_Develop/coordinator/tests/unit/project-runtime-execution-host-adapter.contract.test.ts`<br>`40_Develop/coordinator/tests/unit/project-runtime-execution-authorization-adapter.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-execution.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/runtime-process-safety-state.contract.test.ts` |
| `IMPL-REPLANNING-CANDIDATE` | `IF-PROJECT-CORE`<br>`IF-SCHEDULER` | `partial` | `responsibility_separation` | `40_Develop/orchestrator/src/application/project-runtime-replanning.ts`<br>`40_Develop/orchestrator/src/ports/state-port.ts`<br>`40_Develop/orchestrator/src/storage/current-state-store.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-replanning-and-decision.contract.test.ts` |
| `IMPL-HUMAN-DECISION-CANDIDATE` | `IF-DECISION` | `partial` | `responsibility_separation` | `40_Develop/orchestrator/src/application/project-runtime-human-decision.ts`<br>`40_Develop/orchestrator/src/public-contract/decision-request.ts`<br>`40_Develop/orchestrator/src/ports/decision-capability-port.ts`<br>`40_Develop/orchestrator/src/ports/decision-port.ts`<br>`40_Develop/orchestrator/tests/unit/public-contract.contract.test.ts`<br>`40_Develop/orchestrator/src/decision/decision-capability-adapter.ts`<br>`40_Develop/orchestrator/src/storage/protected-decision-store.ts`<br>`40_Develop/orchestrator/src/storage/current-state-store.ts`<br>`40_Develop/coordinator/tests/unit/project-runtime-decision-capability-adapter.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-replanning-and-decision.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-windows-decision-store.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-decision-recovery-store.contract.test.ts` |
| `IMPL-INTEGRATION-CANDIDATE` | `IF-INTEGRATION`<br>`IF-PROJECT-CORE` | `partial` | `responsibility_separation` | `40_Develop/orchestrator/src/application/project-runtime-integration.ts`<br>`40_Develop/orchestrator/src/ports/integration-record-port.ts`<br>`40_Develop/orchestrator/src/public-contract/integration-result.ts`<br>`40_Develop/orchestrator/tests/unit/integration-application.contract.test.ts`<br>`40_Develop/orchestrator/tests/unit/public-contract.contract.test.ts`<br>`40_Develop/orchestrator/src/storage/current-state-store.ts`<br>`40_Develop/orchestrator/src/task/candidate-integration-adapter.ts`<br>`40_Develop/orchestrator/src/task/composition-root.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-integration-record-adapter.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-integration.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-candidate-integration-adapter.integration.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-composition-root.integration.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-full-flow.integration.test.ts` |

### 検証接続

| ID | 種別 | 状態 | 試験Path |
|---|---|---|---|
| `PR-D-N-01` | `normal` | `partial` | `40_Develop/coordinator/tests/integration/project-runtime-durable-foundation.contract.test.ts` |
| `PR-D-Q-01` | `quasi_normal` | `partial` | `40_Develop/coordinator/tests/integration/project-runtime-durable-foundation.contract.test.ts` |
| `PR-D-A-01` | `abnormal` | `partial` | `40_Develop/coordinator/tests/integration/project-runtime-durable-foundation.contract.test.ts` |
| `PR-N-01` | `normal` | `partial` | `40_Develop/mcp-server/tests/unit/project-runtime-adapter.contract.test.ts`<br>`40_Develop/mcp-server/tests/system/stdio-transport.integration.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-execution.contract.test.ts` |
| `PR-N-02` | `normal` | `partial` | `40_Develop/orchestrator/tests/unit/project-runtime-state.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-execution.contract.test.ts` |
| `PR-N-03` | `normal` | `partial` | `40_Develop/orchestrator/tests/unit/project-runtime-state.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-execution.contract.test.ts` |
| `PR-Q-01` | `quasi_normal` | `partial` | `40_Develop/orchestrator/tests/unit/project-runtime-state.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-execution.contract.test.ts` |
| `PR-Q-02` | `quasi_normal` | `partial` | `40_Develop/coordinator/tests/integration/project-runtime-replanning-and-decision.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-full-flow.integration.test.ts` |
| `PR-Q-03` | `quasi_normal` | `partial` | `40_Develop/mcp-server/tests/unit/project-runtime-adapter.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-durable-foundation.contract.test.ts` |
| `PR-Q-04` | `quasi_normal` | `partial` | `40_Develop/mcp-server/tests/system/stdio-transport.integration.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-execution.contract.test.ts`<br>`40_Develop/coordinator/tests/system/project-runtime-real-provider-verification-script.contract.test.ts` |
| `PR-Q-05` | `quasi_normal` | `partial` | `40_Develop/coordinator/tests/integration/project-runtime-queue-priority.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-objective-intake.contract.test.ts` |
| `PR-Q-06` | `quasi_normal` | `partial` | `40_Develop/coordinator/tests/integration/project-runtime-replanning-and-decision.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-windows-decision-store.contract.test.ts`<br>`40_Develop/mcp-server/tests/unit/project-runtime-adapter.contract.test.ts` |
| `PR-H-01` | `human_decision` | `partial` | `40_Develop/orchestrator/tests/unit/project-runtime-state.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-replanning-and-decision.contract.test.ts` |
| `PR-H-02` | `human_decision` | `partial` | `40_Develop/coordinator/tests/integration/project-runtime-replanning-and-decision.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-windows-decision-store.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-decision-recovery-store.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-full-flow.integration.test.ts` |
| `PR-A-01` | `abnormal` | `partial` | `40_Develop/orchestrator/tests/unit/project-runtime-state.contract.test.ts` |
| `PR-A-02` | `abnormal` | `partial` | `40_Develop/orchestrator/tests/unit/project-runtime-state.contract.test.ts` |
| `PR-A-03` | `abnormal` | `partial` | `40_Develop/orchestrator/tests/unit/project-runtime-state.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-execution.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/runtime-process-safety-state.contract.test.ts` |
| `PR-A-04` | `abnormal` | `partial` | `40_Develop/coordinator/tests/integration/project-runtime-durable-foundation.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-execution.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-objective-intake.contract.test.ts`<br>`40_Develop/coordinator/tests/system/project-runtime-real-provider-verification-script.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/docker-recovery-journal.integration.test.ts`<br>`40_Develop/coordinator/tests/integration/docker-recovery-runtime.contract.test.ts` |
| `PR-A-05` | `abnormal` | `partial` | `40_Develop/orchestrator/tests/unit/project-runtime-state.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-execution.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-objective-intake.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/docker-recovery-runtime.contract.test.ts` |
| `PR-A-06` | `abnormal` | `partial` | `40_Develop/coordinator/tests/integration/project-runtime-durable-foundation.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-integration.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-candidate-integration-adapter.integration.test.ts`<br>`40_Develop/mcp-server/tests/unit/project-runtime-adapter.contract.test.ts` |
| `PR-A-07` | `abnormal` | `partial` | `40_Develop/orchestrator/tests/unit/platform-contract.contract.test.ts`<br>`40_Develop/coordinator/tests/unit/project-runtime-windows-platform-adapter.contract.test.ts` |
| `PR-I-01` | `integration` | `partial` | `40_Develop/orchestrator/tests/unit/project-runtime-state.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-integration-record-adapter.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-integration.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-candidate-integration-adapter.integration.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-full-flow.integration.test.ts` |
| `PR-I-02` | `integration` | `partial` | `40_Develop/orchestrator/tests/unit/project-runtime-state.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-integration.contract.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-candidate-integration-adapter.integration.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-composition-root.integration.test.ts`<br>`40_Develop/coordinator/tests/integration/project-runtime-full-flow.integration.test.ts`<br>`40_Develop/mcp-server/tests/unit/project-runtime-adapter.contract.test.ts` |

## 13. 完了条件

- 上位アーキテクチャ、本書、機械対応、実装および試験のIDが相互に解決できる。
- Interface、Record、資源、Lock、Authority、Effect、状態遷移、不変条件および失敗注入点に孤立がない。
- 実装済み、部分接続、未実装を区別し、部分成立を上位Capability完成へ読み替えない。

## 14. 機械生成する意味要素

次の表はSemantic IR Pilotの入力である。表から抽出できない意味を生成器やAIが補完しない。Semantic Keyと種別はPilot用であり、[Semantic Coverage基盤](../semantic-coverage/02_Semantic_IR_and_Relation_Design.md)の評価後に固定する。

| Semantic Key | 種別 | 要求する意味 | Architecture定義 | 検証要否 | 根拠節 | N/A理由 |
|---|---|---|---|---|---|---|
| `project-runtime.objective-task-lifecycle` | `lifecycle` | ObjectiveをTaskへ分解し、依存、実行、統合、受入、取消、判断待ちおよび回復をProject-levelの状態として管理する。 | `ARCH-000004` | `Required` | `## 8. 状態機械と遷移` | — |
| `project-runtime.project-state-projection` | `projection` | Task、Queue、Decision、Recovery、ObjectiveおよびMilestoneの状態を、根拠と観測不能を保持したProject Stateへ投影する。 | `ARCH-000005` | `Required` | `## 10. 不変条件` | — |
| `project-runtime.acceptance-decision-authority` | `authority` | Objective／Milestoneの受入、差戻し、判断待ちをProject運営者の明示判断として記録し、下位完了やProjectionから受入Authorityを生成しない。 | `ARCH-000005` | `Required` | `## 6. Authority` | — |
| `project-runtime.task-authority-narrowing` | `authority` | Project／Milestone／Objective／Task／Attempt／Repository RevisionからTask Authorityを狭め、Coordinatorへ渡した後に拡大させない。 | `ARCH-000004` | `Required` | `## 6. Authority` | — |
| `project-runtime.durable-before-effect` | `persistence` | Task Effectまたは判断適用の前に、Intent、Authority結合、Operation Identityおよび必要なRecovery情報を耐久化する。 | `ARCH-000004` | `Required` | `## 3. 永続Record` | — |
| `project-runtime.queue-lease-lifecycle` | `resource` | Queue、Project Operation Lease、Scheduler Slotおよび競合予約のOwnerと終了条件を固定し、cleanup不明の資源を再利用しない。 | `ARCH-000004` | `Required` | `## 4. 資源と終了条件` | — |
| `project-runtime.recovery-obligation` | `recovery` | Effectまたはcleanupが不明なTask／Decisionをexact Recovery Identityへ結び、同じ義務の解消または人間移送まで保持する。 | `ARCH-000004` | `Required` | `## 11. 失敗注入` | — |
| `project-runtime.transport-neutral-application-contract` | `boundary` | CLI、MCPその他のTransportがProject Authorityや成功意味を新設せず、Core所有の公開Application Contractを同じ意味で提供する。 | `ARCH-000012` | `Required` | `## 2. Interface` | — |
| `project-runtime.execution-intelligence-read-model` | `projection` | Execution Intelligenceを読取り専用Portとして利用し、実行事実と評価候補をProjectのAuthorityや受入判断へ変換しない。 | `ARCH-000007` | `Required` | `## 2. Interface` | — |
| `project-runtime.candidate-adoption` | `authority` | 同一候補の再読取り、明示採用Authority、Leaseと現在Revision／dirty Scopeの確認を通じて正本へ採用し、Receiptを耐久記録する。拒否時は正本Effect 0、settlement不明時は同じRecovery義務を保持し、Commit／Pushを伴わない。 | `ARCH-000004` | `Required` | `### 2.1. 既存候補の採用境界` | — |
- 正常・準正常・異常および実境界の検証が、対象CapabilityのLifecycleを閉じる。
- 現行設計の変更時は本書を更新し、旧版の別文書を現行Treeへ追加しない。

## Checklist

- [x] OrchestratorのRecord・資源・遷移・回復不変条件を本書と全ファイル対応、下位Task・通知・保存をCoordinator詳細とQA-000003／006へ対応した。Source移管・本番接続・実境界は未完了であり、以下の保存方式刷新②の評価結果を責務再編全体の完了へ流用しない。
- [x] 旧連続世代の保証と新版Snapshotの目標を区別し、旧不変条件の意味を変更していない。
- [x] 物理統合と仕事全体の一括確定を区別し、別Port間の中断、Leaseと保護Decisionの境界を維持した。
- [x] 保存、採用後処理、終了、履歴と移行の反証対象を明示した。
- [x] 新版Schema、Root結合、保存確定・再入場、退役後の旧受付拒否と公開初期化を実装・局所試験へ接続した。
- [x] 受付・終了整理・本番接続の追加反例とArchitecture／QualityのSource／Contract独立確認を完了し、旧実記録の清掃・新形式初期化を確認した。
- 保存方式刷新②は、本番切替・全Portable結果処置・試験前提是正後35件・Architecture／Quality最終独立レビューを完了した。全製品E2Eや品質項目全体の未完了は②と分離する。[完了根拠](../../../99_Roadmap/Changes/CHG-000082/Evidence/261005_project-runtime-phase2.md#36-②の完了判定)。
