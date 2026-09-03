# Project Runtime詳細設計

状態: Project Runtime Candidate（v0.19.0、設計固定・部分実装、公開前）
担当責任者: Qual-Lab
最終更新日: 2026-09-02

Related:
- [Coordinator参照アーキテクチャ](01_Architecture.md#project-runtime-reference-architecture)
- [脅威モデル](02_Threat_Model.md)
- [振る舞い仕様](../../05_SPEC/01_Behavior_Specification.md#project-runtime-contract)
- [検証設計](../../07_Quality/03_Verification_Design.md#project-runtime-verification)
- [CHG-000057](../../90_Release/Changes/CHG-000057_Minimum_AI_Native_Project_Runtime.md)

## 1. 目的と適用範囲

本書は、v0.19 Project Runtimeの実装と照合する詳細設計である。[参照アーキテクチャ](01_Architecture.md#project-runtime-reference-architecture)が所有する上位責務、状態の意味およびPlatform境界を変更せず、Interface、永続Record、資源、Lock、Authority、Effect、失敗注入点および検証への接続を実装可能な粒度へ具体化する。

対象は、明示Binding済みの単一Project／単一Repository、人間起点の一つのMilestone、任意数のTask、最大同時実行5、既存Single Task Runtimeの再利用、およびCLI／MCPの同一意味入口である。複数Project、複数Repository、常設自律運転、ScheduleからのObjective生成、Linux／macOS実装、未制限Worker PoolおよびMilestone受入のAIへの移譲は対象外とする。

## 2. ComponentとInterface

| ID | Component | 入力 | 結果 | 所有しないもの |
|---|---|---|---|---|
| `IF-PROJECT-CORE` | Project Runtime Core | 検証済みProject Binding、Milestone要求、Milestone Authority、現在世代 | Objective／Task Graph、状態更新命令、再計画または判断移送 | OS機構、Transport session、Provider実行、正本採用の暗黙決定 |
| `IF-SINGLE-TASK` | Single Task Adapter | Task Authority、Task Packet、固定Repository Revision、attempt ID、取消Signal | exact Operation／Candidate／Recovery Identityを持つ構造化Task結果 | Project状態、後続Task生成、Objective／Milestone受入 |
| `IF-STATE-STORE` | Project State Store | expected generation付きの閉じた更新 | 新世代または競合／破損／観測不能 | Scheduler判断、Authority生成、外部Effect |
| `IF-QUEUE` | Durable Operation Queue | 検証済みObjective要求、起点Lane、Binding、基準Revision | queue ID、現在状態、owner generation、再開条件 | Objective生成、Scope拡張、実行中Operationの横取り |
| `IF-SCHEDULER` | Task Graph／Scheduler | immutableな状態Snapshot、現在の容量・Conflict・Provider条件 | 現在世代で開始候補となるTask ID集合 | Task Effect、永続更新、古い`ready`の再利用 |
| `IF-INTEGRATION` | Integration／Adoption | 終端済みTask結果、受入条件、固定候補、現在Revision | Objective／Milestoneの受入Evidence、統合候補、Conflictまたは判断要求 | Task Passからの成功生成、暗黙の正本上書き、Risk受容 |
| `IF-TRANSPORT` | CLI／MCP Adapter | Transport固有Envelopeと取消通知 | 同一Project要求へのdecode、同一Project結果のencode | Project Model、Authority、Repository操作、成功条件 |
| `IF-DECISION` | Human Decision Controller | `decisionId`、Project／Milestone／世代／改訂版、選択肢、検証済み任意コメント、認証済み人間主体 | 受理、stale入力拒否、superseded入力拒否、取消済み入力拒否またはAuthority拒否 | MCP client identityからのAuthority生成、古い判断の適用、判断内容の補完 |
| `IF-PLATFORM` | Platform Contract | Coreが発行した閉じた観測・操作要求 | Principal、Filesystem、Lock、Process、Container、cleanup、Recoveryの観測結果 | Project意味、Scope、Authority、受入判断 |

すべての更新Interfaceは、成功、競合、入力拒否、観測不能を閉じた結果で返す。例外、`undefined`、時刻超過またはProcess終了だけから成功や資源不存在を推定しない。CoreはInterfaceの返却値に含まれないAuthorityまたはIdentityを再構成しない。

## 3. Project要求と結果

### 3.1 Milestone要求

Milestone要求は少なくとも次へ結合する。

- `projectId`、`repositoryBindingId`、`repositoryRevision`
- `milestoneId`、目的、受入条件、保持する意図、変更禁止範囲
- 読取りPath、変更Path、共有資源・判断前提のConflict key
- Provider送信境界、許可Provider、費用・呼出し・時間上限
- 最大同時実行数1～5、再計画回数上限、取消条件
- request identity、起点`interactive | scheduled`、発行主体

入力不足、Binding差、Revision差、Authority不明または上限不正では、Queueへの拒否Record以外のTask／Provider／Repository Effectを発行しない。スケジュール起点は、別の許可済み入口が作った同じ要求を搬送するだけであり、目的・Scope・Authorityを作らない。

`crdd.run_objective`の初回受付はrequest identityを認証済み主体とProject Operationへ結合する。同じ認証済み主体・Project・Milestone・request identityによる再送は新しいOperationを作らず、最新Project State、現在の判断要求または終端結果を返す。これはv0.19の切断後再接続経路であり、任意Projectを検索するAPIではない。別主体、別Project／Milestone、別request identityまたは継続証拠不一致は同じOperationとして扱わない。MCP Adapterは認証結果を検証後に破棄せず、この意味入口まで同じprincipal identityを渡す。

### 3.2 Project結果

公開結果は、Milestone状態、Work Progress、Quality、Human Decision、Integration、cleanup、Recovery、Next Actionを分離する。`accepted`は受入EvidenceとCross-task整合が揃った場合だけ返す。取消要求済み、Task完了済み、全Task終了、Integration完了、資源回収済みは別々に表現する。

## 4. 永続Record

Repository-local `.crdd/project-runtime/`はRuntime状態の既定RootでありGit管理しない。各Recordはschema名、schema revision、Project／Repository Binding、作成世代、更新世代、content hashを持ち、symlink／junction／reparse境界を拒否したRepository Rootから解決する。書込みは同一Filesystem上の一時file作成、flush、閉じる、atomic replace、Directory entry観測の順で行う。どの段階が不明かを保持し、破損Recordを初期値へ置換しない。

| ID | Record | 必須の意味 | Effectとの時間関係 | 更新条件 |
|---|---|---|---|---|
| `REC-PROJECT-STATE` | Project State | Project／Milestone／Objective／Task、generation、Authority参照、attempt、Operation／Candidate／Recovery Identity、Integration、判断、cleanup | `generation_state` | `IF-STATE-STORE`によるexpected generation一致時だけ |
| `REC-QUEUE-ENTRY` | Operation Queue entry | queue ID、request hash、起点Lane、基準Revision、Scope hash、状態、owner generation、再開条件、結果参照 | `before_effect_intent` | Queue短時間Lock下の世代付き更新だけ |
| `REC-PROJECT-LEASE` | Project Operation lease evidence | Repository Binding、Project、queue ID、owner process identity、owner generation、OS排他観測 | `before_effect_intent` | OS排他の取得・解放観測と一体で更新 |
| `REC-TASK-ATTEMPT` | Task attempt binding | Task ID、attempt ID、Project generation、非秘密のTask Authority binding ID、Single Task Operation Identity、開始・settlement状態、種別付き回復義務。Docker義務の`acknowledged`にはProject／Milestone／Task／attempt／Operation／Recovery、settlement世代、Runtime Rootの4 hash、Receipt committed pairのhash／identityを保持する | `before_effect_intent` | Provider Effect前に開始意図を耐久化し、契約、attempt、Operation、Authority binding、Revisionが一致する閉じた結果だけでsettle。Docker回復では`settled`後にexactな確認情報をProject Stateへ`acknowledged`としてatomic replace・readbackする |
| `REC-INTEGRATION` | Integration candidate | 基準Revision、Task candidate集合、受入Evidence、Conflict、workspace identity、採用状態 | `after_effect_result` | 全Task側cleanup後、Integration ownerだけが更新 |
| `REC-ADOPTION` | Canonical adoption receipt | adoption ID、候補hash、基準／直前Revision、対象Path、採用Effect、終了後Revision、cleanup | `after_effect_receipt` | 正本採用Leaseと直前再検証後だけ発行 |
| `REC-HUMAN-DECISION` | Human Decision | decision ID、Project／Milestone、発行世代・改訂版、選択肢、現在状態、選択結果、認証主体参照、非Authorityの継続Record ID、判断適用世代。raw CapabilityとCapability hash、raw commentは保持しない | `generation_state` | `IF-DECISION`が現在の判断要求とAuthorityを照合した世代付き更新、またはParentがProject lifecycleの変化を観測した更新だけ |
| `REC-DECISION-CONTINUATION` | Human Decision | Capability hash、選択ユーザー、decision／Project／Milestone／世代／改訂版、期限、消費・失効状態、置換request identity、decision application ID、expected／new Project世代、`issued / prepared / finalized / recovery_required / invalidated / expired` disposition。Repository内には置かない。Project State適用済みは保護Recordの独立状態にせず、Project Stateのapplication IDと世代のreadbackとして観測する | `before_effect_intent` | Platform Adapterが検証したOS管理・Runtime保護Rootでのみ原子的に更新 |
| `REC-DECISION-RECOVERY-INTENT` | Platform Adapter | exactな継続Record identity、最後に確認できたdisposition、application ID、expected／new Project世代、観測不能になった境界、Recovery identity、required／settled状態。継続Capability Recordとは別の検証済みRuntime所有Recovery Storeに置く | `before_effect_intent` | 保護Rootの観測またはCAS readbackが不明なとき、通常結果を返す前に原子的に作成・readbackする。Recovery Storeも不明なら状態を捏造せず手動回復・Effect不明・Process再利用禁止とする |
| `REC-DOCKER-RECOVERY-ACKNOWLEDGEMENT` | Platform Adapter | exact Docker Recovery ID、現在のRuntime State Rootを表すidentity・protection・local user・bindingの4 hash、完了Receipt committed pairのhash／identityを持つ一時Tombstone。Projectの判断履歴ではなく、Receipt除去からProject確認済み状態のreadbackまでの再入場を閉じる有限資源 | `after_effect_receipt` | freshなProject Stateが同じTask／attempt／Operation／世代の`settled`義務を保持し、完了Receiptと現在Rootが一致するときだけ同じRuntime State Lock下で作成・readbackする。Project Stateの`acknowledged` readback後だけjournal付きで除去し、不在だけから確認済みを推定しない |

Effect前に必要なIntentと、Effect後にのみ成立するResult／Receiptを同じBooleanへ正規化しない。`REC-TASK-ATTEMPT`をEffect後Receiptとして扱うこと、および`REC-ADOPTION`をEffect前Intentとして扱うことはCheckerで拒否する。

RecordはCredential本文、Providerのraw出力、秘密値または外部送信未許可の内容を保持しない。Evidenceは内容を必要最小化し、参照先、hash、観測主体、観測時点および適用する受入条件を保持する。

## 5. 状態機械

Task、Objective、MilestoneのCanonicalな状態と意味は[状態の責務分離](01_Architecture.md#141-状態の責務分離)に従う。Queueは次を独立に持つ。

```text
queued
  → leased → running → integration_pending → completed
  → waiting_foreground → queued → leased
  → replan_required → queued | human_decision_required
  → human_decision_required → replan_required → queued → leased
  → recovery_required → queued → leased | cancelled
  → cancelled
```

Queue `completed`はProject Operationの終了と所有資源の解放確認を意味し、Milestone `accepted`と同義ではない。Task `completed`からObjective `integration_pending`、Objective `accepted`からMilestone `integrating`への遷移は別世代とし、同じtransactionで連鎖成功させない。遷移の全閉集合は[機械可読な設計対応](../../40_Develop/coordinator/runtime/project-runtime-design-traceability.json)を正とする。

Queueの優先順位は未所有の要求間だけで評価する。`leased`または`running`のQueueが一つでも存在する間は、後着したQueueへ二つ目のOperation Leaseを発行しない。後着したスケジュール要求は`waiting_foreground`へ耐久化し、対話要求を含むその他の後着要求もEffect 0で待機する。候補を選んだ呼出し側は、Repository Binding単位のOperation Leaseを取得した後、同じ耐久Queueをfreshに再走査し、現在の最優先候補と自身のQueueが一致した場合だけQueue ownerをclaimする。選択と取得の間に対話要求が到着した場合、先行していたスケジュール呼出し側はEffect 0でLeaseを解放する。実行中Operationの終端化、物理Leaseの解放および所有者settlementが確認された後にだけ、待機要求を現在のRevision、容量、DependencyおよびConflictへ再照合して選択する。優先順位を、実行中Operationの横取り、同一Project Stateへの二重実行、またはowner喪失の推測回復に使用しない。

Queueの終端状態は処理結果の耐久化を表し、Leaseの解放完了とは別に扱う。所有中のQueueを終端状態へ進めても`ownerGeneration`を直ちに消さず、同じLeaseのLock不存在、解放証跡、回復Marker不存在をfreshに確認した専用settlementだけが所有者を消す。途中でProcessが失われた場合、実行中のQueueは`recovery_required`へ進め、既に耐久化された終端状態は保持したまま資源だけをsettleする。状態名や解放APIの戻り値だけからcleanup成立を推定しない。

Lease証跡はprefixや内容の一部だけで探索しない。Repository Binding、Project、Lease種別、Queue、owner generation、owner process、disposition、世代およびdisposition別のexact filenameを一体で照合する。未知・重複・別Queue・別種別・内容とfilenameの不一致があればQueue ownerを消さず、手動回復へ停止する。Lease取得後の全終了経路は共通の所有終了処理を通り、可能ならQueueへ回復意図を耐久化してから物理Leaseを解放し、freshな証跡でQueue ownerをsettleする。QueueまたはStateの更新が観測不能でも物理解放を試み、解放証跡から後続Processが一意にreconcileできる状態を残す。取得済みLeaseを呼出し不能なProcess内資源として残したまま結果を返さない。

`recovery_required`から通常実行へ直接戻さない。Client入力ではなくProject StateがTaskごとに保持する回復義務の閉集合を用いる。各義務は種別（Host、Docker、Candidate、Candidate Store、Runtime Process）、exact Recovery Identityおよび`required → recovering → settled`の適用段階を持つ。Docker義務だけは、回復ReceiptをProject Stateへ結合した`acknowledged`まで進めてから通常再開できる。発行Runtimeは、対応する種別の回復処理だけへexact IDを渡し、回復完了と対象資源不存在を確認してから一件ずつsettleする。Runtime ProcessのIDはParent RuntimeだけがProcess Instance、attemptおよびOperationへ結合して発行し、下位Adapterが自己申告した同種IDは採用しない。未知種別、平坦なIDと型付き義務の不一致、複数候補または回復Identityを確定できない結果を、合成IDや別種別の回復処理へ補正しない。QueueはRecovery Authorityにならない安定した適用IDだけを保持し、Task ID、種別およびexact Recovery Identityの閉集合から同じ適用を照合する。

Docker回復は、(1) 回復完了と資源不存在を耐久Receiptへ記録、(2) Project義務を`settled`としてatomic replace・readback、(3) 同じRuntime State Lock下でexact Tombstoneを作成・readback、(4) Receiptをjournal付きで除去・readback、(5) Project義務をReceipt committed pairとRuntime Rootの4 hashへ結合した`acknowledged`としてatomic replace・readback、(6) Tombstoneをjournal付きで除去・readback、(7) Queueの回復適用をsettle、(8) fresh retry、の順で進める。Tombstone作成またはReceipt／Tombstone除去の片側だけでProcessが失われても、committed pairのjournalから同じ内容・同じ対象の未完了処置だけを再開する。Receipt不在は、同じProject義務にexactな`acknowledged`情報が残る場合だけ既処理の根拠にできる。Tombstone不在、Recovery IDだけ、時刻または件数上限を削除Authorityにしない。確認資源の作成・再入場・除去・件数判定は同じRuntime State Lockで直列化する。Project側の確認済み情報は次のattempt／Operationがsettleすると旧義務とともに置換され、除去済みの旧Receipt committed pairを物理的に再投入しても、旧attempt／Operationは現在のTask bindingと一致せず削除Authorityを得ない。この有限終了により、上限64を1件越える65件の連続回復でもTombstone上限へ累積停止しない。

全義務が上記の終了条件を満たした後だけ、専用Queue遷移と同じProject State世代で旧attemptをfresh retryへ置換する。Queue更新後、個別義務の開始後またはsettlement後、State更新後に中断しても、耐久化した適用段階から未完了側だけを再開し、Recovery Effectを重複発行しない。Recovery settlementは再計画回数の消費と分離し、`maximumReplans`が0でも既存資源を回収して通常再入場できる。その後にowner、Repository Revision、容量、DependencyおよびConflictをfreshに再検証して、新しいLeaseを取得する。新しいTask状態としての`recovery_settled`は作らない。未解決、Identity不一致または観測不能では通常実行へ進めず、人間へ移送し、Task／Provider／正本Effectを発行しない。

人間判断は`pending → accepted`を正常経路とする。入力を受け取っただけの中間状態は作らず、現在のdecision ID、Project／Milestone、世代、改訂版、許可選択肢および認証済み人間主体をすべて照合できた場合だけ一度受理する。古い・置換済み・取消済み・許可外の入力はEffect 0で拒否し、現在の`pending` Recordを変更しない。`stale`、`superseded`、`cancelled`は、Parentが現在Project世代の変化、置換判断の発行またはMilestone取消を独立に観測した場合だけRuntime-owned lifecycleとして記録する。`accepted`だけが専用遷移を介してProject Stateの再計画または再開へ接続できる。

Repository外の継続Capability Recordは、Project Stateとは別の`SM-DECISION-CONTINUATION`で所有する。正常経路は`absent → issued → prepared → finalized`である。初回発行または置換では、一意な判断要求／置換request identityに対する`absent → issued`をPlatform Adapterが保護Rootへ作成・readbackできた後だけraw CapabilityをClientへ返し、同じ発行requestの再送は同じRecordを返す。`issued → prepared`は検証済み入力の消費意図を保護RootへCAS更新・readbackしたことを示し、まだ消費確定ではない。Project StateのDecision／Milestoneを一括適用してapplication IDとnew世代をreadbackできた後だけ、`prepared → finalized`をCAS更新・readbackして消費を確定する。

Project Stateだけが観測不能になり、継続Capabilityの保護Rootを引き続き検証・更新できる場合は、先に別のRuntime所有Recovery Storeへexactな回復意図を作成・readbackし、その後に保護Recordを`prepared → recovery_required`へCAS更新・readbackする。保護Rootの読取り、CAS応答またはreadback自体が観測不能なら、そのRootの状態遷移を成立したと主張しない。代わりに`SM-DECISION-RECOVERY-INTENT`の`absent → required`だけを、保護Rootとは別に検証したRecovery Storeへ耐久化する。Recovery Storeも観測不能なら状態を捏造せず、手動回復必須、Effect状態不明、現在Processの再利用禁止として停止する。

未適用の`issued`は置換・Project lifecycleにより`invalidated`、有限期限の到来により`expired`へ進める。`prepared`はProject Stateがexpected旧世代かつapplication未適用とfreshに確認できた場合だけ`invalidated`へ進め、matching new世代なら`finalized`、Project側だけが不明なら上記の回復経路へ進める。exact Recoveryは、独立した回復意図、継続Capabilityの保護RootおよびProject Stateをfreshに結合する。matching new世代なら継続Recordを`finalized`、verified old/unappliedなら`invalidated`へ先に収束させる。初回作成の応答・readback喪失後にRecordがexactに`absent`、raw未返却、Project未適用と確認できた場合は継続遷移なしで安全に収束する。期限更新の応答・readback喪失後に`expired`かつProject未適用を確認した場合も同様に収束する。freshな`issued`はRecovery Authorityで`invalidated`、freshな`prepared`は`recovery_required`へ進めて既存のProject照合経路へ接続する。必要な継続Record更新のreadback後にだけ独立した回復意図を`settled`へ更新する。不明・競合なら観測できた継続状態を変えず回復意図を`required`に保持し、Queue、Lease、Task Effectを発行しない。無効な送信だけでは状態を変えない。

任意コメントはAuthority、選択肢、Scopeまたは判断理由を補完しない非信頼注記である。省略可能、正しいUTF-8で最大1024 byte、C0制御文字とDELを含まない単一行だけを受理する。未知field、上限超過、制御文字または認識済みSecretを含む入力はEffect 0で拒否する。raw commentはProvider、Task Packet、ログ、永続Recordまたは通常結果へ転送・保存・反射しない。

Runtime Process回復義務は、Authority取消結果を観測できない、下位実行へ委譲した後のhandoff結果を観測できない、またはEffect開始後の結果が`settled`と検証できない同一Processを再利用しないための内部義務である。Parent Runtimeが現在のProcess Instance、Task、Task attemptおよびOperationから一意なIDを発行し、当該Taskへ発行した同じIDだけを耐久状態へ受理する。そのProcessではsettleせず、再入場時にIDのattempt／Operation bindingを再検証し、埋め込まれたProcess Instanceと異なるfreshなRuntime Processだけがsettleする。下位Adapterの申告、別Task・別attempt／OperationのIDまたは改変されたIDをProcess再起動の証拠へ昇格しない。下位実行へ委譲する前にAuthority発行失敗や取消として確定した拒否はEffect 0の再計画へ閉じ、存在しないProcess回復義務を作らない。委譲後に開始観測または結果が失われた場合、Runtime Process義務だけでは外部Effectの不存在や回復を証明しないため、外部Recoveryのexactな閉包がない限り`recoveryUnresolved`を保持し、fresh Processへ変わったことだけで通常再入場しない。Host、CandidateおよびCandidate Storeの自動回復Handlerはv0.19の公開受付へ未接続であり、該当義務をDockerへ誤送信せず、種別とexact IDを欠落なく返して手動処置へ閉じる。

Docker完了Receiptの確認資源は、永久履歴やLRU Cacheではない。freshな現在Runtime Rootの4 hash、Receipt committed pairおよびProject側のexact bindingを結合する。Project Stateの`acknowledged` readback後にTombstoneを必ず回収し、作成・削除の各中断点から再入場できる。件数上限到達時に古いものを推測削除せず、未終了資源として停止する。

## 6. 資源、Lock、所有

| 資源ID | 所有者 | 取得前提 | 終了後条件 |
|---|---|---|---|
| `RES-PROJECT-QUEUE` | Queue Store | Bindingとrequest hash検証 | 終端Record保持または保持Policyに基づく削除を観測 |
| `RES-PROJECT-OPERATION-LEASE` | Parent Coordinator | queue選択後、Repository Binding単位のOS排他とowner generation一致 | 全子Task照合後にOS排他解放とRecord更新を観測 |
| `RES-PROJECT-STATE` | State Store | Project Operation leaseのexact owner | expected generationによるatomic replace完了 |
| `RES-SCHEDULER-SLOT` | Scheduler | 現在世代、Dependency、Conflict、容量を再検証 | Task Process不存在とcleanupを確認 |
| `RES-CONFLICT-RESERVATION` | Scheduler | Task開始予約と同じ世代更新 | Effect／Candidate／Recovery影響の解消を確認 |
| `RES-SINGLE-TASK-BINDING` | Parent Coordinator | `REC-TASK-ATTEMPT`耐久化済み | exact Operationの結果、cleanupまたはRecoveryへsettle |
| `RES-INTEGRATION-WORKSPACE` | Integration owner | 対象Task終端・cleanup済み | 候補採用／破棄とWorkspace cleanupを観測 |
| `RES-ADOPTION-LEASE` | Integration owner | Operation lease保持、Integration候補固定 | 採用receiptと正本Revision観測後に解放 |
| `RES-CANCELLATION-CONTROLLER` | Parent Coordinator | 対象Taskとattemptを固定 | 全対象の終了・cleanup・状態反映を観測 |
| `RES-PROJECT-RECOVERY-EVIDENCE` | 発行Runtime | exact未終端資源を観測 | 同じIdentityの回復完了と資源不存在を観測 |
| `RES-DOCKER-RECOVERY-ACKNOWLEDGEMENT` | Platform Adapter | exactな完了Receipt、現在Runtime Root、Project側の`settled`義務をfreshに照合 | 同じ確認情報をProject Stateへ`acknowledged`としてreadbackした後、Tombstoneのjournal付き除去と不存在を観測。旧Receiptの再投入は受理しない |
| `RES-PENDING-DECISION` | Human Decision Controller | 判断要求をProject世代へ固定 | accepted、stale、supersededまたはcancelledを耐久化 |
| `RES-DECISION-CONTINUATION` | Platform Adapterを介したHuman Decision Controller | Repository外のOS管理・Runtime保護Rootについて、選択ユーザー、固定Volume、非reparse chain、Owner／Protection、atomic updateを観測してから、hashをdecision ID、Project／Milestone、世代、改訂版、選択ユーザー、期限へ結合。Repository側は非AuthorityのRecord IDとdecision application IDだけを持つ | `issued → prepared`、Project State適用・readback、`prepared → finalized`を照合してacceptedを一度消費。Queueは保護Rootの`finalized`をfreshに読取り観測する。stale／superseded／cancelled／Project終端／期限切れで失効し、Runtime所有面からraw値が存在しないことを確認。無効入力だけでは既存Capabilityを変更しない。Project側だけが不明で、独立した回復意図の`required` readback後に保護Rootを更新できる場合だけ`recovery_required`へ進める。保護Root自体が不明なら同Rootの遷移を主張しない |
| `RES-DECISION-RECOVERY-INTENT` | Platform Adapterの独立Recovery Store | 継続Capability保護Rootと別にidentity・Protection・atomic updateを検証できるRuntime所有Root | exact Recoveryがintent、保護Root、Project Stateをfreshに照合する。必要な継続Recordをfinalized／invalidatedへ収束するか、raw未返却・Project未適用のabsentまたはProject未適用のexpiredをEffect 0として確認した後、intentのsettled更新・readbackを行う。Recovery Storeも不明なら手動回復・Effect不明・Process再利用禁止を保持 |

Lock IDと順序は次で固定する。

1. `LOCK-QUEUE-MUTATION`はenqueue、Lane選択またはQueue状態更新の短時間だけ取得し、他のProject Lockと同時保持しない。
2. `LOCK-PROJECT-OPERATION`はRepository Binding単位で一つだけ取得できる。異なるQueueまたはProjectから同時に取得を試みても、OS排他によってexactに一つだけを所有者とし、他方はEffect 0で待機または拒否する。v0.19は同じRepository Binding内のOperationを直列化し、Project間並列は主張しない。
3. `LOCK-PROJECT-OPERATION`は選択済みQueue entryに対して取得し、Parent Coordinatorの生存期間を所有する。
4. `LOCK-PROJECT-STATE`は`LOCK-PROJECT-OPERATION`保持中の短時間transactionだけ取得する。
5. Single Task Runtimeの内部Lockは`LOCK-PROJECT-STATE`解放後に取得する。Project側は内部Lock順序へ介入しない。
6. `LOCK-ADOPTION`は全対象Taskのcleanup後、`LOCK-PROJECT-STATE`を保持していない状態で取得する。取得後に正本Revision、dirty state、候補基準Revision、変更Path、Conflictをfreshに再確認する。

`LOCK-QUEUE-MUTATION`、`LOCK-PROJECT-STATE`または`LOCK-ADOPTION`を保持したまま、Provider、Docker、子Process、MCP response、Human Decisionまたは長時間Integrationを待たない。Lock解放不明、owner generation差または再取得後の世代差では新規Effectを止める。

## 7. AuthorityとEffect順序

Milestone AuthorityはParent CoordinatorだけがTask Authorityへ縮小できる。Task AuthorityはProject、Milestone、Objective、Task、attempt、Repository Revision、読取り／変更Path、Provider境界、予算および期限へ結合する。Task Graph作成時には先行発行せず、Task開始予約を耐久化した後、各attemptの外部Effect直前にfreshな一回限りのAuthorityを発行する。待機、排他競合または開始前取消では発行しない。発行とSingle Task開始の間に取消を観測した場合は、発行元が同じCapabilityを失効してから取消完了を返す。失効を確認できなければ未使用と推定せずRecoveryへ閉じる。Queue record、Progress、Provider出力、MCP client info、Task結果または時刻はAuthorityを生成・拡張しない。

| Authority ID | 所有者 | 許可する範囲 | 終端条件 |
|---|---|---|---|
| `AUTH-MILESTONE` | 認証済み人間から委任されたParent Coordinator | 単一Project／Repository／Milestoneと宣言済み上限 | Milestone終端または取消 |
| `AUTH-TASK` | Parent Coordinator | Milestone Authorityの厳密な部分集合である単一Task attempt | attemptのsettle、`superseded`または取消 |
| `AUTH-SINGLE-TASK-OPERATION` | Single Task Adapter | exactなOperation、候補およびRecovery境界 | cleanupまたはexact Recovery義務の確定 |
| `AUTH-INTEGRATION` | Integration owner | 固定Task結果集合と受入条件。正本書込みは含まない | Integration候補の固定または破棄 |
| `AUTH-ADOPTION` | 認証済み人間から委任されたParent Coordinator | 固定候補、固定Path、freshな正本Revision | 採用receiptまたはEffect 0の拒否 |
| `AUTH-RECOVERY` | Recoveryを発行したRuntime | exactなOperation、資源、Recovery Identity | exact回復完了または人間への移送 |
| `AUTH-HUMAN-DECISION` | 認証済み人間からの判断入力を検証するParent Coordinator | exactなpending decision ID、Project／Milestone、現在世代・改訂版、許可選択肢、選択ユーザーおよび未消費・期限内の継続Capability | 保護Recordの`finalized`またはexact Recovery義務の耐久化、Runtime-ownedなstale／superseded／cancelled、Project終端または期限切れ。Project Stateのaccepted投影だけではAuthority lifecycleを終えない。無効入力はAuthorityを生成せず、既存Capabilityも変更しない |

| Effect ID | 所有者 | Effect境界 | 終了後の観測 |
|---|---|---|---|
| `EFFECT-QUEUE-STATE` | Durable Operation Queue | Repository-local Queue Record | generation、hash、atomic replace |
| `EFFECT-PROJECT-STATE` | Project State Store | Repository-local Project State | expected generationとatomic replace |
| `EFFECT-SINGLE-TASK` | Single Task Adapter | Provider、Process、Container、候補Operation | exact結果、cleanupまたはRecovery Identity |
| `EFFECT-INTEGRATION-CANDIDATE` | Integration owner | 隔離Workspaceと統合候補 | 候補hash、Conflict、Workspace cleanup |
| `EFFECT-CANONICAL-ADOPTION` | Integration owner | 正本Repositoryの許可Path | 基準Revision、変更Path、receipt、終了後Revision |
| `EFFECT-RECOVERY` | Recoveryを発行したRuntime | exactな残存資源の照合・回収 | Recovery receiptと資源不存在 |
| `EFFECT-DECISION-STATE` | Human Decision Controller | 判断受理とMilestone再開を一つにしたRepository-local Project State世代更新 | expected generation、atomic replaceとProject State readbackによりDecisionとMilestoneがともに旧状態またはともに新状態であること |
| `EFFECT-DECISION-CONTINUATION` | Human Decision Controllerを代行するPlatform Adapter | Repository外のOS管理・Runtime保護Rootにある継続Capability RecordのCAS更新 | 選択ユーザー、Protection、application ID、expected／new世代、dispositionおよびatomic updateのreadback。QueueはこのEffectを発行せず`finalized`をfreshに読取り観測する |
| `EFFECT-DECISION-RECOVERY-INTENT` | Platform Adapterの独立Recovery Store | exactな判断Recovery intentの作成・settled更新 | Recovery identity、観測不能境界、最後に確認したdisposition、atomic updateとreadback。継続Capability保護Rootの更新成功を代替しない |

各状態遷移を、保持または取得するLock、使用するAuthority、発行し得るEffect、順序および検証へ結ぶexactな閉集合は、機械可読な`BIND-*`対応で固定する。一つの`BIND-*`は一つの遷移だけを所有し、取消、Recovery、通常状態更新または採用のAuthority／Effectを和集合化しない。状態遷移が対応を持たない、複数対応へ重複する、またはLock／Authority／Effectが孤立する場合、設計Checkerは設計候補を拒否する。

Effect順序は次で固定する。

1. Request／Binding／Authorityを検証する。
2. `REC-QUEUE-ENTRY`を耐久化する。
3. Queue選択後、Lease種別、元Queue、owner generation・Process・回復IDを結んだ取得中Markerを一意な準備fileへwrite、flush、close、exact readbackした後、同一Filesystemの排他的hard linkで最終Pathへ完全なbytesとして公開する。別Processが準備中または最終Pathを所有する場合、後着の取得経路は内容を回復残存と推定せず、取得不可、手動回復不要、Effect 0で停止する。取得経路は既存Markerからowner喪失を推定しない。Process消失後のfreshな専用reconciliationだけがownerの不存在とMarker identityを確認し、完全な準備file、公開済みMarkerおよび旧実装の一時fileを同じexact Recoveryへ接続する。不完全・不正・複数の候補または観測不能は自動削除しない。その後に物理Lockを作り、Lock作成に成功した同じownerであることを示すMarkerと取得証跡を順に耐久化する。Queue ownerへ結合する前に停止しても、Project Operationと正本採用の両Leaseを共通回復プロトコルで識別する。Project Operationでは回復結果をQueueの新世代へ書いてreadbackするまで取得中Markerを保持し、最後に除去する。正本採用の回復IDはQueueではなくRepository BindingとProjectへ結ぶ。Lock所有Markerがない既存Lock、不正MarkerまたはIdentity不一致は自動削除せず、決定論的な回復IDを伴う手動回復へ閉じる。
4. Graph、Conflict、容量を検証し、`REC-TASK-ATTEMPT`と`starting / reserved`を同じ状態世代へ耐久化する。この時点ではOperation IDを持たず、外部Effectは0である。
5. State Lockを解放し、開始直前にRevision、owner generation、Task Authorityと取消状態を再確認する。委譲対象のOperation IDを得たら、外部Effect前に`starting / handoff_prepared`として耐久化する。
6. `IF-SINGLE-TASK`へEffectを委譲し、実際の開始通知を受けた場合だけ`running`へ進める。
7. exact attempt／Operation結果とcleanup／Recoveryを再確認してProject Stateへ反映する。
8. 必要なIntegrationを隔離Workspaceで行う。
9. 正本採用Authorityがある場合だけAdoption leaseを取得し、freshな正本観測後に採用する。
10. 全資源の終端観測後にQueueとProject Operation leaseを終端する。

Single Task結果はfield単位の型とIdentityだけでなく、状態、Effect、cleanup、手動回復、Process再起動、平坦なRecovery ID群および型付き回復義務の相関を検証する。`completed`は`settled`、cleanup確認済み、手動回復なし、Process再起動なし、Recovery IDなしの場合だけ成立する。Effect不明またはcleanup未確認は手動回復を伴う。Effect開始後に永続Stateが受理できないID、型を確定できないID、結果例外または相関矛盾を受けた場合は、下位結果を採用せず、Parent Runtimeが当該Task・attempt・Operationへ結合したRuntime Process回復義務を発行してProcess再利用禁止へ閉じる。Effect開始前の同じ失敗はEffect 0の再計画として扱う。`processRestartRequired`、全回復義務および未解決状態はProject結果まで保持し、後続Taskを同じProcessで開始しない。

人間判断の受理では、Repository外のCapability RecordとRepository内Project Stateの物理的な一括更新を仮定しない。Runtimeは一意なdecision application ID、expected／new Project世代および入力hashを、Platform Adapterの専用Effectで保護Rootの`issued`から`prepared`へCAS更新・readbackする。次に`TRANS-DECISION-PENDING-ACCEPTED`をrootとし、Milestoneの専用遷移を同じProject State atomic replaceの論理投影として、Decision accepted、Milestone executing、application IDおよびcontinuation Record IDを一括適用する。fresh readbackでapplication IDとnew世代を確認した後、Platform Adapterの専用Effectで保護Recordを`prepared`から`finalized`へCAS更新・readbackしてCapability消費を確定する。Milestone投影を単独発行してはならない。

Process喪失後は両Rootを照合する。保護Recordが`prepared`でProject Stateがexpected世代なら、同じapplication IDだけを再適用するか安全に未適用へ戻す。Project Stateがnew世代とapplication IDを持つなら、保護Recordを`finalized`へ進める。Project Stateだけが不明で保護Rootを更新できる場合は、独立Recovery Storeの`absent → required`とreadbackを先に成立させ、その後だけ保護Recordを`recovery_required`へ進める。保護Rootの読取り、CAS応答またはreadback自体が不明なら、同じ`absent → required`だけを独立Recovery Storeへ成立させ、保護Recordの遷移を主張しない。独立Recovery Storeも不明なら状態を増やさず、手動回復必須、Effect状態不明、Process再利用禁止として停止する。いずれもProject、Queue、Lease、Task Effectは0とする。Queueは`finalized`とProject Stateのapplication ID／new世代一致をfreshに確認した後、`LOCK-QUEUE-MUTATION`を短時間取得してQueue状態を更新し、解放後にProject Operation leaseへ進む。判断受理後・Queue lease前に停止しても「判断受理済み・再開待ち」を保持し、再起動後に同じ世代からLeaseを最大1回だけ成立させる。

`prepared`後の取消、置換、staleまたは期限到来は、保護Recordだけを失効させない。freshなProject Stateがexpected旧世代でapplication ID未適用なら`prepared → invalidated`、matching new世代なら`prepared → finalized`とする。Recoveryからの収束も同じ判定を用い、matching new世代を`finalized`、verified old/unappliedを`invalidated`へ進める。readback不明または競合ではRecoveryを保持し、通常再開または別Capability発行へ進まない。

4より前、または5の再確認失敗後にはProvider Effectを発行しない。9の前には正本Repository Effectを発行しない。Effect発行後にsettlementが不明な場合は同じintentとIdentityをRecoveryへ保持し、別attemptを作って再発行しない。

## 8. 失敗注入と期待結果

| ID | 注入点 | 期待結果 | 主な検証 |
|---|---|---|---|
| `FAIL-QUEUE-WRITE` | Queue一時file／replace／Directory観測 | Task 0、Provider Effect 0、破損を初期化しない | `PR-A-06` |
| `FAIL-LEASE-ACQUISITION` | 取得中Markerの排他的作成／write／flush／close／readback、Marker後の物理Lock、Lock所有Marker、取得証跡、解放MarkerまたはQueue owner結合前の失敗／Process喪失 | 同時取得による最終Pathの排他競合は取得不可として停止する。全資源のfreshな不存在を確認できた同期失敗だけを巻戻し済みとする。それ以外は決定論的な回復IDを保持する。不完全Marker、旧一時file、所有不明Lockまたは不一致は自動変更せず手動回復へ閉じ、exactなMarker、Lock所有、証跡、解放意図およびowner不存在を照合できる場合だけ共通回復で全Marker・Lock不存在と再取得可能へ収束する | `PR-A-04`、`PR-D-A-01` |
| `FAIL-LEASE-OWNER-LOSS` | Operation lease取得後のParent喪失、Queue／State更新または結果settlementの観測不能 | 新Task開始0。`starting / reserved`はEffect 0で`ready`へ戻す。`starting / handoff_prepared`はOperation相関を完全走査し、exact一致または明示的な不存在を確認できた場合だけRecoveryまたは`ready`へ進める。`running`はexact Recovery Identityとの一致がある場合だけRecoveryへ進め、不存在をEffect 0へ読み替えない。StateとQueueのどちらか一方だけが更新済みでも、後続Processは耐久化された個別義務の段階から未完了側だけを再開する。欠落・重複・不一致では推測せず手動回復へ閉じる | `PR-A-04`、`PR-A-06` |
| `FAIL-STATE-GENERATION` | 外部処理後の世代差 | 結果混入0、Evidence保持、再計画／判断／Recovery | `PR-A-03` |
| `FAIL-DUPLICATE-REQUEST` | 同じrequest identityの再送 | Operation二重発行0、現在状態を返す | `PR-Q-03` |
| `FAIL-CAPACITY-RACE` | 6件目を同時開始 | 6件目Task Effect 0 | `PR-A-02` |
| `FAIL-TASK-RESULT-IDENTITY` | 別attempt／Operation／Authority／Revision、保存不能・型不明なRecovery ID、平坦なID群と型付き義務の不一致、またはstatus／Effect／cleanup／手動回復／Process再起動の矛盾 | 現在Taskへ成功反映0。Effect開始前はEffect 0で再計画する。Effect開始後は下位のRecovery Identityを合成せず、Parent Runtimeが当該Taskへ結合したRuntime Process回復義務を発行し、Process再利用禁止と回復情報をProject結果へ保持 | `PR-A-03` |
| `FAIL-CANCEL-DURING-START` | `starting`耐久化後、Task Authority発行の直前・直後またはEffect前後の取消 | 発行前なら非発行、発行直後で未使用なら同じ発行元が失効を確認し、失効不明ならEffect不明のRecoveryへ閉じる。Effect開始後は終了・cleanupまで追跡する | `PR-Q-04`、`PR-A-04` |
| `FAIL-CLEANUP-UNKNOWN` | Task結果後の資源観測不能 | slot／Conflictを解放せず`recovery_required` | `PR-Q-02`、`PR-A-04` |
| `FAIL-INTEGRATION-CONFLICT` | 全Task完了後の成果物／判断競合 | Objective／Milestone受入0、候補隔離 | `PR-I-01` |
| `FAIL-ADOPTION-REVISION` | 採用Lease取得後の正本Revision差 | 正本Effect 0、再計画または人間判断 | `PR-A-06` |
| `FAIL-TRANSPORT-DISCONNECT` | MCP／CLI接続切断 | 取消要求とOperation終端を分離し、結果を耐久化 | `PR-Q-04` |
| `FAIL-PLATFORM-UNAVAILABLE` | Platform不明／Adapter不在 | fallbackせずEffect 0 | `PR-A-07` |
| `FAIL-DECISION-STALE` | 古い世代、置換済みdecision ID、許可外選択肢、不正commentまたは未認証入力を`crdd.submit_decision`へ送る | Decision Record・Project変更・Task Effect・Authority生成0、現在の判断要求を返す | `PR-Q-06`、`PR-H-02` |
| `FAIL-DECISION-ATOMIC-APPLICATION` | `prepared`前後、Project State書込み／flush／readback、`finalized`前後、Queue更新前後またはProcess喪失 | application IDとexpected／new世代から再適用・確定・未適用またはRecoveryを一意に選ぶ。DecisionとMilestoneはともに旧かともに新。Queueは`finalized`前にLeaseせず、再送を含めLeaseとTask Effectは最大1回 | `PR-Q-06`、`PR-H-02` |
| `FAIL-DECISION-CONTINUATION` | 保護Root／hash保存失敗、Client返却喪失、別主体／別decision、replay、期限切れ、明示置換の競合、`prepared`後／Project適用後／`finalized`前のProcess喪失 | 無効入力は正規Capabilityを不変にし、正規主体は期限内に一度だけ再試行可能。application IDと両側世代を照合し、不明ならQueue／Task Effect 0でRecovery。raw Capability保存0。応答喪失時は旧hash失効receipt後に新しい1件だけを発行 | `PR-Q-06`、`PR-H-02` |

正常、準正常、異常および判定情報不足の組合せは、[検証設計](../../07_Quality/03_Verification_Design.md#project-runtime-verification)の`PR-*`を用いる。判定情報不足では、近い正常状態、空配列、cleanup済みまたは新しいRecovery IDを捏造しない。

## 9. PlatformとTransport

Project Runtime Coreは`IF-PLATFORM`と`IF-TRANSPORT`だけへ依存する。Windows Adapterはv0.19の実装対象である。Linux／macOS Adapterは未実装であり、空stubまたはWindows fallbackを追加しない。MCP stdio／将来HTTPとWindows／Linux／macOSは直交する組合せであり、CoreのProject Model、Authority、状態および受入意味を変えない。

v0.19で公開するMCPの意味入口は`crdd.run_objective`と`crdd.submit_decision`だけとする。前者は承認済みProject／Milestone境界内のObjectiveを開始し、同じrequest identityの再送では新規Effectを出さず最新状態を返す。後者は現在の判断要求へ認証済み人間の選択を結合する。人間主体の根拠は、`run_objective`受付時にRuntimeが観測した選択ユーザーのOS principalと既存Milestone Authorityである。判断要求の発行時にRuntimeは暗号学的に推測困難なopaqueの継続Capabilityを生成し、raw値は応答でClientへ一度だけ返す。Runtime側はraw値を保持せず、そのhashをdecision ID、Project／Milestone、世代、改訂版、選択ユーザー、発行時刻、有限の期限および消費状態へ結合し、Repository外のOS管理・Runtime保護Rootへ先に耐久化する。Platform Adapterは選択ユーザー、固定Volume、非reparse chain、Owner／Protectionおよびatomic updateを観測し、不明・不一致・改変ではEffect 0にする。Repository側はAuthorityにならないopaque Record IDだけを持つ。期限の具体値は実装契約で固定し、無期限Capabilityを許可しない。`submit_decision`はOS principal、Capability hashおよび全bindingを再確認し、Project State更新前に保護Recordへ一度だけ消費意図を`prepared`として記録する。Capabilityの消費確定はProject Stateのfresh readbackと両Root照合後の`finalized`であり、`prepared`だけを消費済みとは扱わない。Capabilityは人間が手入力する確認コードではなくClientが不透明値として保持し、Repository、Provider、Task Packet、ログまたはMCP metadataから再構成しない。accepted、stale、superseded、cancelled、Project終端または期限切れで失効する。別主体、別decision、欠落または不正入力はEffect 0で拒否するが、正規Capabilityの状態を変えず、正当主体は期限内に再試行できる。応答喪失でClientがraw値を受領できなかった場合、同じ認証主体は同じ`run_objective` request identityに明示的な置換意図と一意な置換request identityを添えて再送できる。Runtimeはraw未受領を自動推定せず、旧hashの失効を耐久化・readbackした後だけ新しいCapabilityを1件発行し、同じ置換requestの再送を冪等に扱う。旧・新を同時に有効化せず、置換できない場合はMilestoneを判断待ちのまま保持して次の処置を返す。内部Task、Scheduler、再計画、統合、Lock、Recovery操作をMCP toolとして直接公開しない。`crdd.get_project_state`はv0.20以降の保留候補であり、v0.19の完成条件や公開契約へ含めない。

MCPの公開結果は、操作別のexact contractと閉じたData Transfer Object（DTO）から新しく構成する。最上位だけでなく、Projection、件数、判断、Recovery IDおよび型付き回復義務の全入れ子を、通常Object・既知field・型・上限・相関まで再帰的に検証する。外側ObjectiveとProjectionのProject／Milestone、statusとEffect、cleanupと手動回復、Process再起動とRuntime Process義務、Integration停止時のcleanupと手動回復を双方向に照合する。さらに、Milestone状態とObjective／Task件数が実際の状態機械から到達可能な組合せか、外側Objective結果とProjectionの回復・判断・取消・受入状態が同時に成立し得るかを確認する。集約件数だけではObjectiveごとの到達可能性を証明できないため、公開Projectionは最大128件のObjective別Task状態集計を持ち、Objective IDの一意性、Objective状態と同じObjectiveに属するTask状態、全体集計との一致をCoreとAdapterの両方で検証する。公開ProjectionもProject入力と同じObjective 128件、Task 1,024件の上限を固定長の算術検証で強制し、件数に比例する一時配列を生成しない。全Task Graphや内部Task identityは公開しない。`accepted`とblocked／recovery件数、`completed`と未解消の回復／人間判断、外側`cancelled`と非取消Milestone等を拒否する一方、解消済み履歴を現在の阻害状態と誤認しない。Task Graphが投影されない場合は`schedule_task`と`wait_for_task`の両方を許容し、一方を推測しない。未知field、accessor、Proxy、別操作のcontract／field、別ProjectのProjection、または`completed`とRecovery義務の併存等の矛盾を内部結果から公開面へ透過しない。公開変換に失敗した結果は成功へ縮退せず、Provider、Taskまたは正本Effectを追加せずに閉じる。

対応を主張する各組合せは、入力framing、UTF-8 byte、request identity、切断、取消、Process owner喪失、Filesystem保護、Lock、cleanupおよびRecoveryを実入口で検証する。CoreがPlatform非依存であることだけをLinux／macOS対応の証拠にしない。

## 10. 実装と検証への接続

現時点で実在する実装候補は、Project状態の純粋契約、共通Objective入口と二つの意味操作だけを持つMCP Adapter、責務分離段階のPlatform契約・Windows Platform Adapter・Single Task Adapter、耐久基盤のProject State Store・Operation Queue・Project Operation Lease・正本採用Lease、Project実行所有者、再計画、人間判断および統合である。Project実行所有者はQueueをLeaseしてから、Taskを`starting / reserved`、Operation ID確定後に`starting / handoff_prepared`としてEffect前に世代付きで耐久化し、Single Task Adapterの開始通知後だけ`running`へ進める。結果はattemptとRepository Revisionへ照合し、最大5件、Dependency、Path／意味競合を現在のProject Stateから再選択する。cleanup不明、結果Identity不一致または観測不能はProject StateとQueueを`recovery_required`へ進め、Taskの枠と競合予約を保持する。部分再計画は依存されていない失敗Taskだけを同じObjective内の後継へ置換し、旧Taskを`superseded`の履歴として保持する。生存するTaskが失敗Taskへ依存する場合は依存を暗黙に付け替えずEffect 0で停止する。Objectiveの完了判定と進捗では`completed`と`superseded`を終端として数えるが、受入Evidenceは後継を含む現在の実行結果から別途要求する。正常なTask完了はQueueを`integration_pending`へ進めるだけで、統合契約がEvidenceを確認するまでObjectiveまたはMilestoneを受け入れない。

耐久基盤はRepository-local `.crdd/project-runtime/`に世代ごとの不変Recordを作成し、完全Schema、filenameと世代の一致、世代連続性、file flush、同一Filesystem上のrename、exact readback、短時間変更Lock、Runtime発行済み不透明LeaseとのQueue owner結合およびstale Lockの自動奪取禁止を実装する。正本採用LeaseはRepository BindingとProjectを共有範囲とし、別Queueからも同じProjectの採用を並行させない。Lease解放前に回復Markerを耐久化し、解放証跡とMarker除去を確認できなければ再取得を止める。Project実行所有者が失われた場合は、耐久Queue、Lease evidenceおよびLockを照合し、Platformが同じowner processの不存在を確定した場合だけQueueを`recovery_required`へ進めてLockを回収する。生存、不明、Identity不一致では奪取しない。Windows Platform Adapterによるowner processの生存・不存在・観測不能を公開Objective入口へ接続し、対話Lane優先、同一計画の再試行、部分再計画、人間判断移送、Task候補の耐久状態への受渡し、統合候補、Conflict停止、明示採用および受入の正常経路を部分接続した。判断記録は既存のWindows Runtime State保護Rootとkernel lockを再利用し、raw Capabilityを保存せず、世代連続・前世代hash結合・committed pair・fresh readbackを満たす不変Record列として保持する。判断Capabilityの明示置換、stale／superseded／cancelled／Project終端／期限切れ時の失効、および保護RootとProject Stateをfreshに結合する独立Recovery Intent Storeも契約試験へ接続した。MCP stdio Processは128 KiB以下のJSON Linesだけを順次処理し、親入力終了時に進行中Objectiveへ取消を通知する。実Candidate Store Adapterは同じbase commit／tree／manifestの候補だけを統合し、Path競合、fresh Revisionおよびbase内容を照合して、明示された`adoptResult`がある場合だけRepositoryへ原子的に適用する。署名固定版の実Provider正常縦断では2経路がMilestone受入へ到達し、そのうちClaude Executor／Codex Reviewer経路で正本採用を確認した。別の自己適用1件でも正本採用まで成立した。認証済みMCP Client、実取消、電源断後の公開入口Recoveryおよび全Recovery settlementは未成立である。それ以外は設計上のownerと実装段階を固定し、実装済みとして扱わない。Project Runtime CoreのPlatform非依存はCore閉集合の推移的import走査を行う契約試験で機械強制する。Platform境界は、境界ごとの操作名が一致するだけでは成立せず、本書の保証母集団をすべて満たした場合だけ解決できる。部分抽出した操作は候補として試験できるが、未実装保証を残す境界を対応済みとしてProject Effectへ渡さない。

| Interface | 現在の接続 | 実装段階 | 主な検証 |
|---|---|---|---|
| `IF-PROJECT-CORE` | 純粋状態契約、耐久Project実行所有者、再計画、人間判断移送、統合候補および受入を部分接続 | 単一・複数Task実行～統合・採用 | `PR-N-01`～`PR-N-03`、`PR-Q-01`、`PR-Q-04`、`PR-Q-06`、`PR-A-03`～`PR-A-06`、`PR-I-01`、`PR-I-02` |
| `IF-SINGLE-TASK` | Single Task AdapterをProject実行所有者から呼出し可能。attempt結合、取消転送、閉結果正規化を所有し、Task要求スキーマはv0.18 Runtimeが所有 | 単一・複数Task実行 | 既存Single Task回帰、`PR-N-01` |
| `IF-STATE-STORE` | 世代付き不変Record、exact readback、世代競合、破損時Fail Closed、Effect前の`reserved / handoff_prepared`、開始後の`running`、型付き回復義務と個別settlementを部分接続。OS保護anchorは未接続 | 単一・複数Task実行～Recovery | `PR-D-N-01`、`PR-D-A-01`、`PR-A-03`、`PR-A-04`、`PR-A-05` |
| `IF-QUEUE` | enqueue、再送再利用、世代更新、短時間変更Lock、Runtime発行Leaseとのowner結合、Project Operation Lease、Project単位の正本採用Lease、解放不明Marker、対話Lane優先、Project実行の`queued → leased → running → integration_pending / recovery_required / replan_required / human_decision_required / cancelled`を部分接続。Windows owner観測と型付きRecovery再入場を公開Objective入口へ接続したが、実資源を伴う全Recoveryと電源断の公開Process E2Eは未成立 | 単一・複数Task実行～Recovery | `PR-D-Q-01`、`PR-D-A-01`、`PR-Q-04`、`PR-A-04`、`PR-A-05` |
| `IF-SCHEDULER` | Project実行所有者へ最大5件、Dependency、Path／意味競合、cleanup予約、対話Lane優先、同一計画のfresh attemptおよび部分再計画を接続。Provider条件は未接続 | 複数Task実行～再計画 | `PR-N-02`、`PR-N-03`、`PR-Q-01`、`PR-A-02`、`PR-A-05` |
| `IF-INTEGRATION` | 耐久Task候補IDから実Candidate Storeの内容を読み、同じbaseの候補を統合する。Path競合時の判断移送、明示Authority下の採用Lease、fresh Revision／Scope／base内容照合、失敗時rollback、Objective／Milestone Evidence受入を部分接続。公開Project Runtimeは、Task生成と統合が同じRuntime実行Identityに属するCandidate Store境界を使う。固定開発版の実測では、未署名の開発SourceへRelease Authorityを与えず、検証済み署名配布のCandidate Storeを依存注入して同じ候補を読み書きする | 統合・採用 | `PR-I-01`、`PR-I-02`、`PR-A-06` |
| `IF-TRANSPORT` | CLIのObjective入口と、`crdd.run_objective`／`crdd.submit_decision`だけを同じ意味契約へ写すMCP Adapter、およびbounded JSON Lines／親EOF取消を持つstdio Processを部分接続。認証済みClientからの本番同等E2Eは未確認 | Objective Intake～人間判断接続 | `PR-N-01`、`PR-Q-03`、`PR-Q-04`、`PR-Q-06` |
| `IF-DECISION` | 一回限りCapabilityのhash保持、主体・Project・Milestone・Queue・世代・改訂版・選択肢・期限の結合、Windows Runtime保護Root上の不変世代列、prepare／Project readback／finalize、明示置換、Project終端を含む失効および独立Recovery Intent Storeを部分接続。実Clientと電源断を含む全Recovery settlementは未確認 | 人間判断接続～Recovery | `PR-Q-06`、`PR-H-02`、`PR-A-05` |
| `IF-PLATFORM` | Platform契約とWindows Adapter候補を接続済み。Principal／Provider HomeおよびProject Operationのowner生存・不存在観測は必要保証を満たす。Repository Root解決、子Process環境導出、Container Host回復状態観測、Runtime Root保護は部分抽出であり、各境界の残る保証が揃うまで全体をFail Closedにする。Resolverは検証済み関数参照だけを凍結する | Coordinator／Platform責務分離～公開Objective Intake | 既存Windows回帰、owner観測契約、`PR-A-07`。未実装PlatformはEffect 0 |

### 10.1 状態機械と遷移ID

人間向け設計と機械可読な設計対応が同じ対象を指すよう、状態機械、遷移および遷移ごとの対応IDを次で固定する。状態名の並びは遷移順序を意味せず、許可された遷移は後続表だけを正とする。

| 状態機械ID | 対象 | 終端状態 |
|---|---|---|
| `SM-TASK` | Task attemptの実行・cleanup・失敗・取消・回復 | `completed`、`cancelled`、`superseded` |
| `SM-OBJECTIVE` | Task結果の意味統合と受入 | `accepted`、`cancelled` |
| `SM-MILESTONE` | Milestone全体の統合・判断・回復・受入 | `accepted`、`cancelled` |
| `SM-QUEUE` | Project Operationの待機・所有・実行・終端 | `completed`、`cancelled` |
| `SM-DECISION` | 人間判断要求の現在性・受理・Runtime-owned失効 | `accepted`、`stale`、`superseded`、`cancelled` |

| 遷移ID | 対応ID | 状態機械 | 遷移 |
|---|---|---|---|
| `TRANS-TASK-PLAN-WAIT` | `BIND-TASK-PLAN-WAIT` | `SM-TASK` | `planned → waiting_dependency` |
| `TRANS-TASK-PLAN-READY` | `BIND-TASK-PLAN-READY` | `SM-TASK` | `planned / waiting_dependency → ready` |
| `TRANS-TASK-READY-STARTING` | `BIND-TASK-READY-STARTING` | `SM-TASK` | `ready → starting` |
| `TRANS-TASK-STARTING-RUNNING` | `BIND-TASK-STARTING-RUNNING` | `SM-TASK` | `starting → running` |
| `TRANS-TASK-ACTIVE-CLEANUP` | `BIND-TASK-ACTIVE-CLEANUP` | `SM-TASK` | `starting / running → cleanup_pending` |
| `TRANS-TASK-CLEANUP-COMPLETED` | `BIND-TASK-CLEANUP-COMPLETED` | `SM-TASK` | `cleanup_pending → completed` |
| `TRANS-TASK-ACTIVE-FAILED` | `BIND-TASK-ACTIVE-FAILED` | `SM-TASK` | `starting / running / cleanup_pending → failed` |
| `TRANS-TASK-FAILED-SUPERSEDED` | `BIND-TASK-FAILED-SUPERSEDED` | `SM-TASK` | `failed → superseded` |
| `TRANS-TASK-ACTIVE-CANCELLED` | `BIND-TASK-ACTIVE-CANCELLED` | `SM-TASK` | active state → cancelled |
| `TRANS-TASK-ACTIVE-RECOVERY` | `BIND-TASK-ACTIVE-RECOVERY` | `SM-TASK` | active state → recovery_required |
| `TRANS-TASK-RECOVERY-SETTLED` | `BIND-TASK-RECOVERY-SETTLED` | `SM-TASK` | `recovery_required → ready` |
| `TRANS-OBJECTIVE-PLAN-EXECUTE` | `BIND-OBJECTIVE-PLAN-EXECUTE` | `SM-OBJECTIVE` | `planned / blocked → executing` |
| `TRANS-OBJECTIVE-EXECUTE-INTEGRATE` | `BIND-OBJECTIVE-EXECUTE-INTEGRATE` | `SM-OBJECTIVE` | `executing → integration_pending` |
| `TRANS-OBJECTIVE-INTEGRATE-ACCEPT` | `BIND-OBJECTIVE-INTEGRATE-ACCEPT` | `SM-OBJECTIVE` | `integration_pending → accepted` |
| `TRANS-OBJECTIVE-ACTIVE-BLOCK` | `BIND-OBJECTIVE-ACTIVE-BLOCK` | `SM-OBJECTIVE` | active state → blocked |
| `TRANS-OBJECTIVE-ACTIVE-CANCEL` | `BIND-OBJECTIVE-ACTIVE-CANCEL` | `SM-OBJECTIVE` | active state → cancelled |
| `TRANS-MILESTONE-PLAN-EXECUTE` | `BIND-MILESTONE-PLAN-EXECUTE` | `SM-MILESTONE` | `planned → executing` |
| `TRANS-MILESTONE-DECISION-ACCEPTED-EXECUTE` | `BIND-MILESTONE-DECISION-ACCEPTED-EXECUTE` | `SM-MILESTONE` | `human_decision_required → executing` |
| `TRANS-MILESTONE-RECOVERY-SETTLED-EXECUTE` | `BIND-MILESTONE-RECOVERY-SETTLED-EXECUTE` | `SM-MILESTONE` | `recovery_required → executing` |
| `TRANS-MILESTONE-EXECUTE-INTEGRATE` | `BIND-MILESTONE-EXECUTE-INTEGRATE` | `SM-MILESTONE` | `executing → integrating` |
| `TRANS-MILESTONE-INTEGRATE-ACCEPT` | `BIND-MILESTONE-INTEGRATE-ACCEPT` | `SM-MILESTONE` | `integrating → accepted` |
| `TRANS-MILESTONE-ACTIVE-HUMAN` | `BIND-MILESTONE-ACTIVE-HUMAN` | `SM-MILESTONE` | active state → human_decision_required |
| `TRANS-MILESTONE-ACTIVE-RECOVERY` | `BIND-MILESTONE-ACTIVE-RECOVERY` | `SM-MILESTONE` | active state → recovery_required |
| `TRANS-MILESTONE-ACTIVE-CANCEL` | `BIND-MILESTONE-ACTIVE-CANCEL` | `SM-MILESTONE` | active state → cancelled |
| `TRANS-QUEUE-ENQUEUE-LEASE` | `BIND-QUEUE-ENQUEUE-LEASE` | `SM-QUEUE` | `queued → leased` |
| `TRANS-QUEUE-DECISION-ACCEPTED-REPLAN` | `BIND-QUEUE-DECISION-ACCEPTED-REPLAN` | `SM-QUEUE` | `human_decision_required → replan_required` |
| `TRANS-QUEUE-REPLAN-QUEUED` | `BIND-QUEUE-REPLAN-QUEUED` | `SM-QUEUE` | `replan_required → queued` |
| `TRANS-QUEUE-WAITING-QUEUED` | `BIND-QUEUE-WAITING-QUEUED` | `SM-QUEUE` | `waiting_foreground → queued` |
| `TRANS-QUEUE-RECOVERY-SETTLED-QUEUED` | `BIND-QUEUE-RECOVERY-SETTLED-QUEUED` | `SM-QUEUE` | `recovery_required → queued` |
| `TRANS-QUEUE-LEASE-RUN` | `BIND-QUEUE-LEASE-RUN` | `SM-QUEUE` | `leased → running` |
| `TRANS-QUEUE-RUN-INTEGRATE` | `BIND-QUEUE-RUN-INTEGRATE` | `SM-QUEUE` | `running → integration_pending` |
| `TRANS-QUEUE-INTEGRATE-COMPLETE` | `BIND-QUEUE-INTEGRATE-COMPLETE` | `SM-QUEUE` | `integration_pending → completed` |
| `TRANS-QUEUE-QUEUED-FOREGROUND` | `BIND-QUEUE-QUEUED-FOREGROUND` | `SM-QUEUE` | `queued → waiting_foreground` |
| `TRANS-QUEUE-ACTIVE-REPLAN` | `BIND-QUEUE-ACTIVE-REPLAN` | `SM-QUEUE` | active state → replan_required |
| `TRANS-QUEUE-ACTIVE-HUMAN` | `BIND-QUEUE-ACTIVE-HUMAN` | `SM-QUEUE` | active state → human_decision_required |
| `TRANS-QUEUE-ACTIVE-RECOVERY` | `BIND-QUEUE-ACTIVE-RECOVERY` | `SM-QUEUE` | active state → recovery_required |
| `TRANS-QUEUE-ACTIVE-CANCEL` | `BIND-QUEUE-ACTIVE-CANCEL` | `SM-QUEUE` | active state → cancelled |
| `TRANS-DECISION-PENDING-ACCEPTED` | `BIND-DECISION-PENDING-ACCEPTED` | `SM-DECISION` | `pending → accepted` |
| `TRANS-DECISION-PENDING-STALE` | `BIND-DECISION-PENDING-STALE` | `SM-DECISION` | Parentが世代変化を観測した`pending → stale` |
| `TRANS-DECISION-PENDING-SUPERSEDED` | `BIND-DECISION-PENDING-SUPERSEDED` | `SM-DECISION` | Parentが置換判断を発行した`pending → superseded` |
| `TRANS-DECISION-PENDING-CANCELLED` | `BIND-DECISION-PENDING-CANCELLED` | `SM-DECISION` | Milestone取消後の`pending → cancelled` |
| `TRANS-CONTINUATION-ABSENT-ISSUED` | `BIND-CONTINUATION-ABSENT-ISSUED` | `SM-DECISION-CONTINUATION` | 保護Recordの`absent → issued`作成・readback後だけraw値を返す |
| `TRANS-CONTINUATION-ISSUED-PREPARED` | `BIND-CONTINUATION-ISSUED-PREPARED` | `SM-DECISION-CONTINUATION` | 検証済み入力の`issued → prepared`と保護Root readback |
| `TRANS-CONTINUATION-PREPARED-FINALIZED` | `BIND-CONTINUATION-PREPARED-FINALIZED` | `SM-DECISION-CONTINUATION` | Project State readback後の`prepared → finalized`と保護Root readback |
| `TRANS-CONTINUATION-PROJECT-UNKNOWN-RECOVERY` | `BIND-CONTINUATION-PROJECT-UNKNOWN-RECOVERY` | `SM-DECISION-CONTINUATION` | Project側だけが観測不能で、先行する独立回復意図の`required` readback後に保護Root更新を確認できた`prepared → recovery_required` |
| `TRANS-CONTINUATION-ISSUED-INVALIDATED` | `BIND-CONTINUATION-ISSUED-INVALIDATED` | `SM-DECISION-CONTINUATION` | Runtime-ownedな失効・明示置換による`issued → invalidated` |
| `TRANS-CONTINUATION-PREPARED-UNAPPLIED-INVALIDATED` | `BIND-CONTINUATION-PREPARED-UNAPPLIED-INVALIDATED` | `SM-DECISION-CONTINUATION` | freshなProject旧世代・未適用確認後の`prepared → invalidated` |
| `TRANS-CONTINUATION-RECOVERY-FINALIZED` | `BIND-CONTINUATION-RECOVERY-FINALIZED` | `SM-DECISION-CONTINUATION` | matching new世代確認後の`recovery_required → finalized` |
| `TRANS-CONTINUATION-RECOVERY-INVALIDATED` | `BIND-CONTINUATION-RECOVERY-INVALIDATED` | `SM-DECISION-CONTINUATION` | verified old/unapplied確認後の`recovery_required → invalidated` |
| `TRANS-CONTINUATION-PROTECTED-RECOVERY-ISSUED-INVALIDATED` | `BIND-CONTINUATION-PROTECTED-RECOVERY-ISSUED-INVALIDATED` | `SM-DECISION-CONTINUATION` | 初回作成・期限更新の応答喪失後にfreshな`issued`を確認し、独立回復意図のreadback後に`invalidated`へ収束 |
| `TRANS-CONTINUATION-PROTECTED-RECOVERY-PREPARED-REQUIRED` | `BIND-CONTINUATION-PROTECTED-RECOVERY-PREPARED-REQUIRED` | `SM-DECISION-CONTINUATION` | 保護更新の応答喪失後にfreshな`prepared`を確認し、独立回復意図のreadback後に`recovery_required`へ接続 |
| `TRANS-CONTINUATION-ISSUED-EXPIRED` | `BIND-CONTINUATION-ISSUED-EXPIRED` | `SM-DECISION-CONTINUATION` | 有限期限観測後の`issued → expired` |
| `TRANS-DECISION-RECOVERY-ABSENT-REQUIRED` | `BIND-DECISION-RECOVERY-ABSENT-REQUIRED` | `SM-DECISION-RECOVERY-INTENT` | Project側だけの観測不能または保護Rootの観測不能で、別のRecovery Storeへexactな`absent → required`を先に耐久化。保護Root不明時はその遷移を主張しない |
| `TRANS-DECISION-RECOVERY-REQUIRED-SETTLED` | `BIND-DECISION-RECOVERY-REQUIRED-SETTLED` | `SM-DECISION-RECOVERY-INTENT` | 両RootとProject Stateのfresh照合、継続Record収束・readback後の`required → settled` |

### 10.2 不変条件と実装接続ID

| 不変条件ID | 人間向けの意味 |
|---|---|
| `INV-DURABLE-BEFORE-TASK-EFFECT` | Task Effectより前にattempt意図、Operationおよび非秘密のAuthority bindingを耐久化する |
| `INV-MAX-FIVE-CLEANUP-AWARE` | cleanup不明を含む占有Taskは最大5件とする |
| `INV-REVALIDATE-AFTER-WAIT` | 待機後は世代・Identity・Authority・取消・競合を再確認する |
| `INV-NO-LOCK-ACROSS-EXTERNAL-WAIT` | 外部待機中に短時間変更Lockを保持しない |
| `INV-NARROWED-AUTHORITY` | Task AuthorityはParent Coordinatorだけが縮小生成する |
| `INV-TASK-COMPLETE-NOT-ACCEPTED` | Task完了をObjective／Milestone受入へ読み替えない |
| `INV-EXACT-RESULT-IDENTITY` | 世代・Task・attempt・Operation・候補・Recovery Identityを照合する。Runtime Process回復IDはParent RuntimeだけがProcess Instance・Task・attempt・Operationへ結合して発行する。下位実行への委譲後にhandoff結果が不明、またはEffect開始後の結果が`settled`でない場合は同じProcessを再利用せず、Runtime Process義務だけから外部Effect解決を推定しない |
| `INV-INTEGRATE-BEFORE-ADOPTION` | 意味統合と受入確認を正本採用より先に行う |
| `INV-UNKNOWN-PRESERVES-RECOVERY` | cleanup／Effect不明時はRecovery義務を保持する |
| `INV-NO-SUCCESS-FROM-UNKNOWN` | 欠落・古い・競合する根拠を成功へ補正しない |
| `INV-CANCEL-AFTER-CLEANUP` | 取消完了は、未使用の新規Task Authorityがあれば失効を確認し、開始済み対象の終了・cleanup・状態反映を確認した後だけ成立する |
| `INV-OLD-IDENTITY-IMMUTABLE` | 置換前Taskを上書きせず後継へ接続する |
| `INV-PLATFORM-NO-FALLBACK` | 未対応Platformで別実装へ暗黙fallbackしない |
| `INV-TRANSPORT-NO-AUTHORITY` | TransportはProject Authorityや成功を生成しない。MCP結果は操作別のexact contract、外側と入れ子の対象Identity、到達可能なMilestone／件数の組合せ、および外側Objective結果と進捗・品質・人間判断・回復・取消・次操作の意味相関を同じCore投影規則で満たす再帰的に閉じたdescriptor-safe DTOだけを公開する。Objective 128件、Task 1,024件の上限を固定長の算術検証で強制し、件数に比例する一時配列を生成しない。解消済み履歴を現在状態へ昇格せず、Dependency Graphなしに`schedule_task`と`wait_for_task`の一方を推測しない |
| `INV-CANONICAL-EFFECT-SERIALIZED` | 正本採用を直列化し直前Revisionを確認する |
| `INV-INTERACTIVE-PRIORITY-NO-PREEMPTION` | 対話優先は未開始要求だけを待機させ、Binding単位Lease取得後のfresh選択と一致したQueueだけをclaimする |
| `INV-DURABLE-RECORD-CLOSED` | 耐久State／Queue Recordは完全Schema、filename結合世代および連続する不変世代を持つ |
| `INV-QUEUE-OWNER-IS-LIVE-LEASE` | Queue ownerは同じRepository／Project／QueueへRuntimeが発行した現在有効なLeaseからだけ導出する |
| `INV-LEASE-RELEASE-UNKNOWN-BLOCKS-REUSE` | Lease解放意図をLock除去より先に耐久化し、解放証跡不明の間は再取得を止める |
| `INV-LEASE-ACQUISITION-RECOVERABLE` | 物理Lockより先に取得中Markerを耐久化し、Lease返却前またはQueue owner結合前の失敗をfreshな完全巻戻し、またはexactなowner・回復IDを持つ回復義務のどちらかへ閉じる |
| `INV-QUEUE-OWNER-CLEARED-AFTER-LEASE-SETTLEMENT` | Queueの終端結果とLease解放を二段階で耐久化し、Lock不存在、解放証跡、Marker不存在をfreshに確認した後だけownerを消す |
| `INV-RECOVERY-SETTLED-BEFORE-RESUME` | Taskごとの種別付きexact Recovery Identity、各義務の`required / recovering / settled`、Docker義務の`acknowledged`、Queueの非Authorityな適用IDを照合し、全回復完了と確認資源の有限終了後だけ通常実行へ戻す。Dockerは完了Receipt、Project `settled`、Tombstone、Receipt除去、Project `acknowledged`、Tombstone除去、Queue settlementの順を守る。確認情報はRepository Binding、Project、Milestone、Task、attempt、Operation、settlement世代、Runtime Rootの4 hash、Receipt committed pairへ結合し、Recovery IDまたは不存在だけを削除・成功Authorityにしない。各committed pairの片側更新、個別義務または確認資源の途中から再入場しても完了済みEffectを再発行せず、再計画上限や件数上限を回復義務の放棄に用いない |
| `INV-DECISION-BINDING-CURRENT` | 人間判断を現在の対象・世代・選択肢だけへ適用する |
| `INV-MCP-NO-HUMAN-AUTHORITY` | MCP metadataやSessionからHuman Authorityを生成しない |
| `INV-DECISION-RECEIPT-BEFORE-RESUME` | exactな受理済み判断とfreshなProject世代の後に一度だけ再開する |
| `INV-DECISION-ATOMIC-APPLICATION` | 保護RecordをpreparedにしてからDecision／Milestoneを同じProject State世代へ適用し、両Root照合後にfinalizedとする。Root間の原子性を仮定しない |
| `INV-DECISION-APPLICATION-FINALIZED-BEFORE-QUEUE` | decision application ID、Project世代、保護Record dispositionの整合・finalized確認後だけQueueをLeaseする |
| `INV-DECISION-CONTINUATION-PROTOCOL` | Platform Adapterだけが保護RecordをCAS更新する。Project側だけが不明なら独立した回復意図のreadback後に保護RecordをRecoveryへ進め、保護Root自体が不明なら同Rootの遷移を主張せず別Recovery Storeだけへ回復意図を残す。無効入力では既存Recordを変えない |
| `INV-DECISION-CAPABILITY-ISSUED-BEFORE-RETURN` | 保護Recordの一意な作成・readback後だけraw CapabilityをClientへ返し、同じ発行requestで二重作成しない |
| `INV-DECISION-PREPARED-INVALIDATION-READBACK` | `prepared`はfreshなProject旧世代・未適用を確認した場合だけ失効し、matching new世代はfinalize、不明はRecoveryとする |
| `INV-DECISION-RECOVERY-SETTLEMENT` | Recoveryはmatching new世代をfinalized、verified old/unappliedをinvalidatedへ収束する。raw未返却・Project未適用のexactなabsent、およびProject未適用のexactなexpiredはEffect 0で安全に収束する。不明・競合では観測できた継続状態を変えず独立回復意図をrequiredに保持する |
| `INV-DECISION-SEPARATE-RECOVERY-INTENT` | 保護Root自体が観測不能な場合は同じRootの遷移を捏造せず、別の検証済みRecovery Storeへexactな回復意図を残す。そこも不明なら手動回復・Effect不明・Process再利用禁止とする |

| 実装接続ID | 対象 | 現在状態 |
|---|---|---|
| `IMPL-PROJECT-STATE-CANDIDATE` | `IF-PROJECT-CORE`、`IF-SCHEDULER`、`IF-INTEGRATION` | 部分接続・設計確認中 |
| `IMPL-PUBLIC-OBJECTIVE-INTAKE-CANDIDATE` | `IF-PROJECT-CORE`、`IF-QUEUE`、`IF-TRANSPORT` | CLIとbounded MCP stdio Processから共通Objective入口へ部分接続。署名固定版の実Provider正常2経路は確認済み。認証済み実MCP Clientと残る異常E2Eは未確認 |
| `IMPL-MCP-ADAPTER-CANDIDATE` | `IF-TRANSPORT`、`IF-PROJECT-CORE`、`IF-DECISION` | `run_objective`と`submit_decision`を同じProject意味契約へ写し、bounded stdio Processへ部分接続 |
| `IMPL-RESPONSIBILITY-SEPARATION-CANDIDATE` | `IF-SINGLE-TASK`、`IF-PLATFORM` | 部分接続・実装確認中 |
| `IMPL-DURABLE-FOUNDATION-CANDIDATE` | `IF-STATE-STORE`、`IF-QUEUE` | 部分接続・実装確認中 |
| `IMPL-PROJECT-EXECUTION-CANDIDATE` | `IF-PROJECT-CORE`、`IF-SCHEDULER`、`IF-INTEGRATION`、`IF-TRANSPORT` | 単一・複数Task実行、候補IDの耐久状態への受渡しを部分接続 |
| `IMPL-REPLANNING-CANDIDATE` | `IF-PROJECT-CORE`、`IF-SCHEDULER` | 同一計画のfresh attempt、部分再計画、人間判断移送と上限を部分接続 |
| `IMPL-HUMAN-DECISION-CANDIDATE` | `IF-DECISION` | 一回限りCapabilityのhash保持、主体・世代・改訂版結合、Windows保護Rootの不変世代列、prepare／Project readback／finalize、明示置換、Project終端を含む失効および独立Recovery Intent Storeを部分接続。実Clientと電源断を含む全Recovery settlementは未確認 |
| `IMPL-INTEGRATION-CANDIDATE` | `IF-INTEGRATION`、`IF-PROJECT-CORE` | 実Candidate StoreのTask候補から統合候補、Conflict停止、fresh base照合、明示採用とrollback、Objective／Milestone受入を部分接続。公開Runtimeの構成点でCandidate Store境界を固定し、固定開発版では検証済み署名配布のStoreだけを注入可能にした。固定2経路のうち1経路と自己適用1件で正本採用まで成立。任意Task、全経路および残る異常E2Eは未確認 |

[機械可読な設計対応](../../40_Develop/coordinator/runtime/project-runtime-design-traceability.json)は、Interface、Record、資源、Lock、Authority、Effect、状態機械、遷移との`BIND-*`対応、不変条件、失敗注入点、実装接続および検証接続の参照切れと孤立を検出する。設計本文または検証項目と一致しない場合は設計完了扱いしない。

## 11. Project Runtime設計の完了条件

Project Runtimeの実装前設計は、次をすべて満たした固定改訂版で完了する。

- Discovery、UX、IA、UI、SPEC、Architecture、詳細設計およびVerificationでProject階層、状態、受入、人間境界が一致する。
- 全Interface、永続Record、資源、Lock、Authority、Effect、Failure注入点にowner、終了後条件および検証先がある。
- 実装済み、部分接続、未実装を区別し、後段の実装成功を設計完了へ流用しない。
- 機械可読な設計対応の決定論的Checkerと契約試験が合格する。
- Repository全体Checker、Architecture／Securityレビュー、文書Scope／Gap／Impact確認で未処置の必須事項がない。

設計完了は後続実装、MCP公開、Linux／macOS対応、Risk受容またはv0.19 Releaseを意味しない。
