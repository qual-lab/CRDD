# QA-000003 Project実行と回復の検証定義

成果物種別: Quality定義
Quality ID: `QA-000003`
検証目標: Objectiveの受付からTask実行、判断、取消、回復、結果および終了後資源までを一つのLifecycleとして確認する
主な試験段階: Unit／Integration／System／User Acceptance
状態: Canonical
維持責任者: Qual-Lab

## 1. 情報源と網羅条件

| Source ID | 保持する固有条件 | 試験段階 | 対応Local Item |
|---|---|---|---|
| [REQ-000002](../../../01_Discovery/Definitions/REQ-000002/requirement.md) | 外部作用（Effect）の前に範囲、送信許可、実行者と確認者が確定する。成功、失敗、取消の各終了経路で候補、プロセス、Docker等の資源状態を追跡できる。残存資源または回復義務を正常終了へ畳まず同じ実行識別情報で再入場できる。正常完了、外部送信拒否、実行途中取消、確認失敗、清掃不能を通し、各段階の決定権限、結果、残存、回復対象の識別情報を観測する | ST | `PRL-04`、`PRL-03` |
| [REQ-000003](../../../01_Discovery/Definitions/REQ-000003/requirement.md) | 目的から導いたタスクと関係、節目を同じプロジェクトの識別情報で追跡する。目的、受入条件、人間へ戻す判断点から、委ねる範囲と節目の完了条件を説明できる。判断待ちや競合を成功へ丸めず、人間判断を同じ一連の状態変化へ戻す。全タスクの成功だけでなく、統合結果と受入条件が成立した時だけ上位達成を表示する。中断や失敗の後は、記録された同じ目的・節目・判断点から、再試行・回復・再開のどれを行うか区別できる。分岐タスク、部分成功、競合、判断待ち、再計画、統合拒否、停止後再開を与え、上位状態と再入場点を観測する | UT／ST／UAT | `PRL-04`、`PRL-02`、`PRL-06` |
| [REQ-000022](../../../01_Discovery/Definitions/REQ-000022/requirement.md) | 作成時に責任者、用途、保持、清掃、回復条件を記録する。成功、失敗、取消の全終了経路で残存と削除可否を判定する。参照中、由来不明、観測不能、回復途中を削除せず明示状態で返す。全終了経路、プロセス crash、清掃再入場、参照中、由来不明、期限超過を作り、残存、回復、最終不存在を観測する | ST | `PRL-04`、`PRL-03` |
| [UX-000002](../../../02_UX/Definitions/UX-000002/ux_definition.md) | 実行前に誰へ何をどこまで任せるかを理解し、暗黙の範囲拡張なく仕事を委ねられる。候補結果を安心して受け取り、停止・失敗後も入力、取消、回復の選択を人間が保持できる。重要場面「外部作用（Effect）の前の委任境界」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。対象範囲の拡張、未承認決定権限および不明な実行主体を反証する | IT／ST／UAT | `PRL-04`、`PRL-05`、`PRL-10` |
| [UX-000003](../../../02_UX/Definitions/UX-000003/ux_definition.md) | 内部ログを読まず、実行中・待機・停止と現在必要な判断を理解できる。現在状態から、同じ処理の再試行、残存状態の回復、同じ目的・節目への再開のどれを選ぶべきか理解できる。現在状態に応じて、待つ、追加情報を入力する、取り消す、回復するのどれを行うかを人間が選べる。重要場面「応答がなく待機か停止かを判断する場面」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。無反応、偽の進捗、AI提供元差の誤表示、停止中の実行表示、および再試行・回復・再開を取り違える案内を反証する | ST／UAT | `PRL-02`、`PRL-04` |
| [UX-000004](../../../02_UX/Definitions/UX-000004/ux_definition.md) | 失敗後に状態確認、再試行、回復および清掃を取り違えず、外部作用（Effect）の二重実行を避けて次の行動を選べる。重要場面「同じ外部作用（Effect）を再発行する直前」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。無条件Retry、古い決定権限、AI提供元差の隠蔽および外部作用（Effect）の二重実行を反証する | IT／ST／UAT | `PRL-04`、`PRL-05`、`PRL-02` |
| [UX-000005](../../../02_UX/Definitions/UX-000005/ux_definition.md) | 内部タスクを逐次操作せず、目的・受入条件・統合状態から節目の完成と必要な判断を理解できる。節目が停止した場合も、受入条件と現在状態を失わず、同じ目的・節目・判断点へ再開するかを判断できる。重要場面「タスク成功と節目完成を区別する」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。タスク数や部分成功を完成へ畳む表示と、停止後に目的・受入条件・判断点を失った別の節目として再開する挙動を反証する | ST／UAT | `PRL-02`、`PRL-01`、`PRL-10` |
| [UX-000021](../../../02_UX/Definitions/UX-000021/ux_definition.md) | 応答喪失後に新規実行せず、現在の利用権限で同じ依頼の状態・結果・回復義務へ戻れる。重要場面「再実行するか判断する直前」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。再接続時の外部作用（Effect）の二重実行、古いセッションの決定権限および別依頼への誤結合を反証する | IT／ST | `PRL-04`、`PRL-05` |
| [UX-000022](../../../02_UX/Definitions/UX-000022/ux_definition.md) | 失敗後に残存の由来・影響・再入場先を理解し、必要な回復を行って不存在まで確認できる。重要場面「削除または回復を選ぶ場面」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。清掃要求だけの完了表示、別処理の巻込みおよび不明状態での削除を反証する | ST／UAT | `PRL-04`、`PRL-03`、`PRL-02` |
| [IA-000002](../../../03_IA/Definitions/IA-000002/ia_definition.md) | 内部Taskを逐次操作せず、何をどこまで誰へ任せ、何をもって受け入れるか理解する。UX-000002: 準備中／許可待ち／実行中／停止。権限発行前後を分ける。UX-000003: 開始可能（ready）／実行中（running）／入力・判断待ち（waiting）／停止（blocked）／完了（completed）／失敗（failed）。UX-000005: Task完了／Objective受入／Milestone受入を別にする | ST／UAT | `PRL-01`、`PRL-02`、`PRL-04` |
| [IA-000003](../../../03_IA/Definitions/IA-000003/ia_definition.md) | 失敗後に再接続、再試行、回復、清掃を取り違えず、二重作用を避ける。UX-000003: 開始可能（ready）／実行中（running）／入力・判断待ち（waiting）／停止（blocked）／完了（completed）／失敗（failed）。UX-000004: 失敗後の作用なし／作用済み／不明、回復要／不要。UX-000021: 進行中（active）／切断（disconnected）／結果取得可能（result_available）／回復必要（recovery_required）／確定済み（settled）。UX-000022: 存在（present）／不存在（absent）／不明（unknown）、回復可能（recoverable）／清掃可能（cleanup_eligible） | ST | `PRL-04`、`PRL-01`、`PRL-03` |
| [UI-000002](../../../04_UI/Definitions/UI-000002/ui_definition.md) | 任せた範囲と進行状態を理解し、必要な時だけ判断する。UX-000002: 複数AIへ任せる範囲と権限を理解する: 外部作用（Effect）の前の委任境界: 委任状態・停止理由・回復先を行動可能に示す: 暗黙の範囲拡張や回復不能。UX-000003: 現在の実行状態と必要な判断を確認する: 応答がなく待機か停止かを判断する場面: 観測時点・停止理由・必要な判断を行動可能に示す: 古い観測や一律表示を進捗・完了と誤認する。UX-000002／IA-000002: 準備中／許可待ち／実行中／停止。権限発行前後を分ける: 目的→範囲と担い手→許可→実行。UX-000003／IA-000002: 開始可能（ready）／実行中（running）／入力・判断待ち（waiting）／停止（blocked）／完了（completed）／失敗（failed）: Task→現在状態→判断要否→待機・入力・取消・回復。UX-000003／IA-000003: 開始可能（ready）／実行中（running）／入力・判断待ち（waiting）／停止（blocked）／完了（completed）／失敗（failed）: Task→現在状態→判断要否→待機・入力・取消・回復 | IT／ST／UAT | `PRL-05`、`PRL-02`、`PRL-01` |
| [UI-000003](../../../04_UI/Definitions/UI-000003/ui_definition.md) | 失敗後に同じ作用を重複させず、安全な回復方法を選べる。UX-000004: 再試行・回復・清掃の違いを理解する: 同じ外部作用（Effect）を再発行する直前: 外部作用（Effect）状態・回復対象の識別情報・終了条件を示す: 結果不明の処理を新規実行して外部作用（Effect）の二重実行を起こす。UX-000022: 残存資源の由来・保持・清掃・回復を理解する: 削除または回復を選ぶ場面: 残存・観測不能・不存在を区別する: 名前や経過時間だけで由来不明物を削除する。UX-000004／IA-000003: 失敗後の作用なし／作用済み／不明、回復要／不要: 失敗→作用状態→同じ依頼の結果→回復処置または再試行。UX-000022／IA-000003: 存在（present）／不存在（absent）／不明（unknown）、回復可能（recoverable）／清掃可能（cleanup_eligible）: 停止→残存観測→同一の回復対象識別子→回復処置・清掃→不存在確認→義務解消。UX-000022／IA-000012: 存在（present）／不存在（absent）／不明（unknown）、回復可能（recoverable）／清掃可能（cleanup_eligible）: 停止→残存観測→同一の回復対象識別子→回復・清掃→不存在確認 | IT／ST | `PRL-04`、`PRL-03`、`PRL-05` |
| [UI-000012](../../../04_UI/Definitions/UI-000012/ui_definition.md) | 必要な情報を限定して渡し、切断後も同じ仕事へ戻れる。UX-000019: 必要な情報だけを出所付きで渡す: 外部境界へ情報を出す直前: 情報源・改訂版・選択理由を保持する: 全量投入・秘密情報混入・古い仮説の現在値化。UX-000021: 切断後に同じ依頼へ戻る: 再実行するか判断する直前: 同一識別情報の照会を再実行より先に示す: Timeoutを未実行とみなし新規外部作用（Effect）を起こす。UX-000019／IA-000014: 準備済み（prepared）／送信済み（sent）／受領済み（received）／返却済み（returned）／停止（blocked）: 情報源→選択→仕事用情報一式（Context Package）→Task→結果（Result）→元の仕事。UX-000021／IA-000014: 進行中（active）／切断（disconnected）／結果取得可能（result_available）／回復必要（recovery_required）／確定済み（settled）: 再接続→同じ依頼（Request）→現在権限→状態・結果→回復義務。UX-000021／IA-000003: 進行中（active）／切断（disconnected）／結果取得可能（result_available）／回復必要（recovery_required）／確定済み（settled）: 再接続→同じ依頼（Request）→現在権限→状態・結果→回復義務 | ST／UAT | `PRL-04`、`PRL-01`、`PRL-02` |
| [SPEC-000002](../../../05_SPEC/Definitions/SPEC-000002/spec_definition.md) | 正常: 受理結果から実行対象・未委任判断・完了条件を一意に確認できる。境界: 委任範囲内／範囲外、判断主体一致／不一致を分け、未委任範囲を受理しない。失敗: 不足・競合・未承認範囲はEffect前に停止し、暗黙に補完しない。観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「受理前はEffect 0。受理後はTask作成だけを許し、Provider Effectは別状態とする」と矛盾する結果を返さない。失敗: 不足・競合・未承認範囲はEffect前に停止し、暗黙に補完しない。副作用: 受理前はEffect 0。受理後はTask作成だけを許し、Provider Effectは別状態とする。本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す | IT／ST | `PRL-04`、`PRL-01`、`PRL-05` |
| [SPEC-000003](../../../05_SPEC/Definitions/SPEC-000003/spec_definition.md) | 正常: ready・running・waiting・blocked・completed・failedを観測根拠付きで区別する。境界: Task識別情報一致／不一致、観測済み／観測不能を分け、別Taskの状態を返さない。失敗: 観測不能や古い状態を進行中・完了へ推定しない。観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「読取り専用。TaskやProvider Processを変更しない」と矛盾する結果を返さない。失敗: 観測不能や古い状態を進行中・完了へ推定しない。副作用: 読取り専用。TaskやProvider Processを変更しない。本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す | IT／ST | `PRL-03`、`PRL-01`、`PRL-05` |
| [SPEC-000004](../../../05_SPEC/Definitions/SPEC-000004/spec_definition.md) | 正常: 作用不明時は新規実行せず、同じ回復対象の識別情報と許可された次の行動を返す。境界: Effectなし／成立済み／不明、回復Identity一致／曖昧を分け、不明時に再実行しない。失敗: 古い権限、曖昧な識別情報、作用不明では再発行を拒否する。観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「本SPECは次の行動を分類する。実際の回復Effectは別のCapability取得後に限る」と矛盾する結果を返さない。失敗: 古い権限、曖昧な識別情報、作用不明では再発行を拒否する。副作用: 本SPECは次の行動を分類する。実際の回復Effectは別のCapability取得後に限る。本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す | IT／ST | `PRL-04`、`PRL-05`、`PRL-01` |
| [SPEC-000005](../../../05_SPEC/Definitions/SPEC-000005/spec_definition.md) | 正常: 処置の発行だけで完了せず、終了後確認によって義務を解消する。境界: 対象Root／隣接Root、由来確定／不明、終了後確認済み／未確認を分ける。失敗: 由来不明、参照中、観測不能は削除せず、義務を保持する。観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「対象残存へのFilesystem Effectを発行する。対象外PathとProvider Effectは0」と矛盾する結果を返さない。失敗: 由来不明、参照中、観測不能は削除せず、義務を保持する。副作用: 対象残存へのFilesystem Effectを発行する。対象外PathとProvider Effectは0。応答喪失またはEffect不明では同じ識別情報で再確認し、終了後確認まで回復義務を保持する | ST | `PRL-04`、`PRL-03` |
| [SPEC-000017](../../../05_SPEC/Definitions/SPEC-000017/spec_definition.md) | 正常: 情報搬送と実行、結果生成と結果帰還を別状態として返す。境界: Request Identity一致／不一致、接続中／切断、結果あり／未取得を分け、別依頼を再発行しない。失敗: 応答喪失を未実行とみなさず、別依頼として再発行しない。観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「許可時だけ情報搬送または結果取得を行う。応答喪失後はProvider Effectを再発行しない」と矛盾する結果を返さない。失敗: 応答喪失を未実行とみなさず、別依頼として再発行しない。副作用: 許可時だけ情報搬送または結果取得を行う。応答喪失後はProvider Effectを再発行しない。応答喪失またはEffect不明では同じ識別情報で再確認し、終了後確認まで回復義務を保持する | ST | `PRL-04`、`PRL-01`、`PRL-03` |
| [SPEC-000028](../../../05_SPEC/Definitions/SPEC-000028/spec_definition.md) | 正常: exactなTaskへの取消要求後、Process終了と終了後資源を観測し、取消完了を返す。境界: Task／試行／世代／取消権限の一致と不一致を分け、別対象へ取消を発行しない。失敗: 要求受理だけを終了とみなさず、終了観測不能時は結果不明と回復義務を保持する。観測不能: 不明を取消完了へ丸めず、取消の重複発行と新規Provider作用を0に保つ。失敗: 対象Identity不一致、古い世代、権限不一致、既に確定した結果または作用状態不明では、取消を新規発行しない。副作用: 検証済みの対象Taskと試行に限り、取消要求を一度だけ発行する。Providerの新規実行、別Taskの変更または正本更新は行わない。終了を確認できない場合は同じRecovery Identityへ未解消義務を結び、取消要求を再発行せず回復または再確認へ戻す | ST | `PRL-03`、`PRL-04`、`PRL-01` |
| [SPEC-000029](../../../05_SPEC/Definitions/SPEC-000029/spec_definition.md) | 正常: exactな判断点へ許可された判断を記録し、同じTaskを再開可能にする。境界: Task／判断点／世代／決定権限の一致と不一致を分け、別対象へ判断を適用しない。失敗: 許可外入力や古い判断をEffect 0で拒否し、判断待ち状態を保持する。観測不能: 判断記録済みか不明な時に重複記録または新規Task作成を行わない。失敗: 古い世代、別Task、別判断点、許可外の選択肢、権限不一致または既に処置済みの判断はEffect 0で拒否する。副作用: 検証済みの判断点へ判断または入力を一度記録し、同じTaskへ再開可能通知を一度だけ渡す。新しいTaskや試行は自動作成しない。記録後に再開結果を観測できない場合は、判断を重複記録せず同じTaskの状態照会または回復へ戻す | IT／ST／UAT | `PRL-02`、`PRL-04`、`PRL-05` |
| [ARCH-000004](../../../06_Architecture/Definitions/ARCH-000004/architecture_definition.md) | 委任、状態照会、再試行／回復選別、清掃、引継ぎを同じRequest／Task／Recovery Identityへ結ぶ。ただし受付、実行、Recovery、清掃は独立した状態機械と終了条件を持つ。所有する責務: Objective／Task受付、Project-level状態、判断待ち、取消、Recovery義務、再入場、結果。所有しない責務: Provider選定、OS操作、Transport、人間の採用判断。主な外部境界: Coordinator Execution Port、状態Store、人間判断。SPEC-000002: 不足・競合・未承認範囲はEffect前に停止し、暗黙に補完しない。Effect: 受理前はEffect 0。受理後はTask作成だけを許し、Provider Effectは別状態とする。SPEC-000003: 観測不能や古い状態を進行中・完了へ推定しない。Effect: 読取り専用。TaskやProvider Processを変更しない。SPEC-000004: 古い権限、曖昧な識別情報、作用不明では再発行を拒否する。Effect: 本SPECは次の行動を分類する。実際の回復Effectは別のCapability取得後に限る。SPEC-000005: 由来不明、参照中、観測不能は削除せず、義務を保持する。Effect: 対象残存へのFilesystem Effectを発行する。対象外PathとProvider Effectは0。SPEC-000017: 応答喪失を未実行とみなさず、別依頼として再発行しない。Effect: 許可時だけ情報搬送または結果取得を行う。応答喪失後はProvider Effectを再発行しない。SPEC-000028: 取消要求の受理を終了とみなさず、競合完了と終了観測不能を区別する。Effect: exactなTask／Attemptへ取消を一度だけ発行し、新規Provider実行は0。SPEC-000029: 古い世代、別判断点、重複または競合を成功へ丸めない。Effect: 判断を一度記録して同じTaskへ再開可能通知を渡し、新規Task／Attemptは作らない。入力SPECが固有Recoveryを定義しない場合、Architectureから追加しない。結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める | ST | `PRL-04`、`PRL-01`、`PRL-03` |
| [ARCH-000005](../../../06_Architecture/Definitions/ARCH-000005/architecture_definition.md) | Objective／Milestoneの受入、差戻し、判断待ちを、検証済みProject・対象・世代・判断Authorityへ一度だけ記録する。読取り投影、Task完了、Provider結果または下位状態から上位受入を推定しない。所有する責務: Acceptance Decision Port、Decision Record、競合・重複・古い世代の拒否。所有しない責務: Task作成、Provider Effect、Projection生成、受入結果の自動決定。主な外部境界: Project運営者、Project Runtime、受入判断Store。SPEC-000002だけが限定した記録Effectへ到達し、SPEC-000006／SPEC-000007の読取り要求からは到達できない | UT／IT／ST／UAT | `PRL-07`、`PRL-08`、`PRL-09`、`PRL-10` |
### Architecture詳細設計入力

| 詳細設計領域 | 受け取る成立条件 |
|---|---|
| [coordinator](../../../06_Architecture/Details/coordinator/01_Architecture.md) | 実行編成、Authority、外部Effect、候補、回収・回復 |
| [platform-access](../../../06_Architecture/Details/platform-access/01_Architecture.md) | OS資源、Process Effect、観測、cleanup、回復 |
| [project-runtime](../../../06_Architecture/Details/project-runtime/01_Architecture.md) | Objective、Task、Objective／Milestone受入判断、Task内判断、取消、回復、公開結果 |

## 2. Lifecycle

```text
[受付]
   ↓
[実行権限と対象を固定]
   ↓
[実行] → [判断待ち] → [判断返却]
   │
   ├→ [取消] → [全資源の終了観測]
   └→ [失敗分類] → [exact Recovery Identity] → [再入場] → [settlement]
   ↓
[結果]
   ↓
[資源不存在または未解決の回復義務]
```

## 3. 試験段階と外部境界の適用

| 試験段階 | 適用 | 確認する範囲 | 外部境界の到達範囲 | 判断理由 |
| --- | --- | --- | --- | --- |
| UT | Required | 状態遷移、Identity、取消・回復判定 | N/A | 外部Effect前に状態機械を反証するため |
| IT | Required | Project Runtime、Execution Port、Controller、Storeの直接・隣接結合 | Related 2 Blocks | 受付・判断・取消・回復を原因層で局所化するため |
| ST | Required | 公開入口から実行・結果・回復・全資源終了まで | System/E2E | Lifecycle全体の完成を確認するため |
| UAT | Required | 利用者が判断待ち、取消、回復結果を理解して選ぶ場面 | User Acceptance | 人間の判断権限と利用者成果を含むため |

### 状態区分の適用

| 状態区分 | 適用 | 対応Local Item | 判断理由 |
|---|---|---|---|
| 正常 | Required | PRL-01、PRL-09 | 通常実行と受入判断を確認する |
| 準正常／境界 | Required | PRL-02、PRL-03、PRL-06、PRL-07、PRL-10、PRL-11、PRL-12 | 待機、判断待ち、取消、再開、利用者判断、資源競合およびTransport差を区別する |
| 異常 | Required | PRL-08 | 競合する完了通知を拒否する |
| 判定不能 | Required | PRL-04、PRL-05 | Effectや残存状態が不明な場合に回復義務を保持する |

## 4. 検証項目

| Local ID | 分類 | 試験段階 | 試験種別 | 対象／境界 | 外部境界の段階 | 事前状態／入力 | 操作／刺激 | 観測 | Oracle | Evidence | 終了後条件 | 実行形態 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `PRL-01` | 正常 | ST | Scenario／Lifecycle | 公開入口→Project Runtime→Execution→受入 | System/E2E | 単一Objective、明示範囲・受入条件、未開始Task、終了後資源Observer | 公開入口からTaskを開始し受入まで進める | PRL-01として、「公開入口からTaskを開始し受入まで進める」前後の公開入口→Project Runtime→Execution→受入について、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | 同じProject／Task Identityで受付、実行、結果、受入が相関 | PRL-01、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「同じProject／Task Identityで受付、実行、結果、受入が相関」および終了後条件「子Process、Lock、一時領域なし」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | 子Process、Lock、一時領域なし | Automated |
| `PRL-02` | 準正常 | UAT | Decision／Resume | 公開入口→判断待ち→人間判断→同一Task再開 | User Acceptance | 人間判断が必要な実行中Task、判断待ち状態、再開用Identity | 判断待ちまで進め、人間判断を返して再開する | PRL-02として、利用者の選択、判断理由、参照した根拠、理解できなかった項目および未判断範囲を記録する | 自動継続せず判断待ちと必要情報を返し、判断返却後だけ再開 | PRL-02、固定した参加条件と入力、利用者の選択・理由・参照根拠、未判断範囲、Oracle判定「自動継続せず判断待ちと必要情報を返し、判断返却後だけ再開」および終了後条件「一度だけsettle」を保存する | 一度だけsettle | Hybrid |
| `PRL-03` | 準正常 | ST | Cancellation／Cleanup | 公開入口→Runtime→Provider・Process→資源Observer | System/E2E | 実行中Task、取消Authority、Provider・Process・資源Observer | 公開入口から取消を要求する | PRL-03として、「公開入口から取消を要求する」前後の公開入口→Runtime→Provider・Process→資源Observerについて、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | 取消要求、Provider／Process終了、結果、cleanupを別々に観測 | PRL-03、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「取消要求、Provider／Process終了、結果、cleanupを別々に観測」および終了後条件「未終了資源がある間は成功にしない」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | 未終了資源がある間は成功にしない | Automated |
| `PRL-04` | 異常 | ST | Recovery／Fault Injection | 公開入口→Runtime→耐久Store→回復再入場 | System/E2E | Effect成立が不明になる故障点、同じTask・Recovery Identityの耐久Store | 故障を発生させ、公開入口から同じIdentityで再入場する | PRL-04として、「故障を発生させ、公開入口から同じIdentityで再入場する」前後の公開入口→Runtime→耐久Store→回復再入場について、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | 自動再試行せずexact Recovery Identityを最初の失敗結果から耐久記録、再入場、settlementまで保持 | PRL-04、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「自動再試行せずexact Recovery Identityを最初の失敗結果から耐久記録、再入場、settlementまで保持」および終了後条件「回復義務がsettleするまで通常完了にしない」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | 回復義務がsettleするまで通常完了にしない | Automated |
| `PRL-05` | 異常 | IT | Contract／Authorization | Task State→Authority Gate→Runtime | Related 2 Blocks | 別Task状態、変更済み範囲・Authority、cleanup要求だけの各反例 | 各反例で再開または完了を要求する | PRL-05として、「各反例で再開または完了を要求する」前後のTask State→Authority Gate→Runtimeについて、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | 別Identity混入、範囲拡張、未確認cleanupを理由別に拒否 | PRL-05、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「別Identity混入、範囲拡張、未確認cleanupを理由別に拒否」および終了後条件「追加Effect 0」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | 追加Effect 0 | Automated |
| `PRL-06` | 境界 | UT | State Machine／Authority | Task状態遷移とAuthority判定 | N/A | 正常遷移、判断待ち、競合完了、古い世代、別Task Identityの各入力 | 状態更新、再開、取消、完了をそれぞれ要求する | PRL-06として、「状態更新、再開、取消、完了をそれぞれ要求する」前後のTask状態遷移とAuthority判定について、入力差分、判定結果、欠落・重複・不一致および理由codeを記録する | 許可した遷移だけを返し、不正遷移を理由別に拒否する | PRL-06、固定入力「正常遷移、判断待ち、競合完了、古い世代、別Task Identityの各入力」、観測した差分と理由code、Oracle判定「許可した遷移だけを返し、不正遷移を理由別に拒否する」および終了後条件「Provider・Process・Store Effect 0」を保存する | Provider・Process・Store Effect 0 | Automated |
| `PRL-07` | 境界 | UT | Acceptance State Machine | Objective／Milestone Acceptance Decision状態遷移 | N/A | Task完了、Objective受入／差戻し／判断待ち、Milestone受入／差戻し／判断待ち | 各状態から次の受入判断を要求する | PRL-07として、「各状態から次の受入判断を要求する」前後のObjective／Milestone Acceptance Decision状態遷移について、入力差分、判定結果、欠落・重複・不一致および理由codeを記録する | 受入・差戻し・判断待ちを別状態で返し、Objective受入済みだけがMilestone判断待ちへ進む | PRL-07、固定入力「Task完了、Objective受入／差戻し／判断待ち、Milestone受入／差戻し／判断待ち」、観測した差分と理由code、Oracle判定「受入・差戻し・判断待ちを別状態で返し、Objective受入済みだけがMilestone判断待ちへ進む」および終了後条件「不正遷移ではDecision Record、Task、Provider Effect 0」を保存する | 不正遷移ではDecision Record、Task、Provider Effect 0 | Automated |
| `PRL-08` | 異常 | IT | Contract／Authorization | Projection／SPEC入力→Acceptance Decision Port→Decision Store | Direct Boundary | SPEC-000006／000007、Projection由来入力、別対象、古い世代、重複判断、権限不一致と、SPEC-000002の明示判断 | 各入力でObjective／Milestone判断記録を要求する | PRL-08として、「各入力でObjective／Milestone判断記録を要求する」前後のProjection／SPEC入力→Acceptance Decision Port→Decision Storeについて、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | SPEC-000002のexactな対象・世代・Authorityだけを一度記録し、その他を理由別にEffect 0で拒否する | PRL-08、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「SPEC-000002のexactな対象・世代・Authorityだけを一度記録し、その他を理由別にEffect 0で拒否する」および終了後条件「成功時は対象Decision Record一件だけ。Task作成／Provider Effect 0」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | 成功時は対象Decision Record一件だけ。Task作成／Provider Effect 0 | Automated |
| `PRL-09` | 正常 | ST | Scenario／Acceptance Decision | 公開入口→Project Runtime→Acceptance Decision Store→状態投影 | System/E2E | Task根拠、受入条件、Objective／Milestone Identity、Project運営者Authority、Effect Observer | Objectiveを受け入れた後にMilestoneを受入・差戻し・判断待ちへ分岐する | PRL-09として、「Objectiveを受け入れた後にMilestoneを受入・差戻し・判断待ちへ分岐する」前後の公開入口→Project Runtime→Acceptance Decision Store→状態投影について、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | 同じProject／対象Identityで各判断が一度記録され、投影は記録結果を読取るだけでAuthorityを生成しない | PRL-09、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「同じProject／対象Identityで各判断が一度記録され、投影は記録結果を読取るだけでAuthorityを生成しない」および終了後条件「Decision Record以外の正本更新、Task作成、Provider Effect 0」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | Decision Record以外の正本更新、Task作成、Provider Effect 0 | Automated |
| `PRL-10` | 利用者判断 | UAT | Acceptance／Non-inference | Project運営者→Objective判断→Milestone判断 | User Acceptance | Task完了、Objective差戻し、Objective判断待ち、Objective受入済みの各Project View | 利用者がObjective／Milestoneの次の判断を選ぶ | PRL-10として、利用者の選択、判断理由、参照した根拠、理解できなかった項目および未判断範囲を記録する | Task完了だけではObjective受入にならず、Objective差戻し／判断待ちではMilestone判断へ進めず、Objective受入済みでだけMilestone判断を選べる | PRL-10、固定した参加条件と入力、利用者の選択・理由・参照根拠、未判断範囲、Oracle判定「Task完了だけではObjective受入にならず、Objective差戻し／判断待ちではMilestone判断へ進めず、Objective受入済みでだけMilestone判断を選べる」および終了後条件「利用者の明示判断前はDecision Record、Task、Provider Effect 0」を保存する | 利用者の明示判断前はDecision Record、Task、Provider Effect 0 | Manual |
| `PRL-11` | 境界 | IT | Resource Lifecycle／Concurrency | Queue→Project Operation Lease→Scheduler Slot→Task開始 | Related 2 Blocks | 同じProjectの競合予約、期限切れLease、cleanup不明Leaseおよび利用可能Slot | 予約、更新、解放および再利用を要求する | Queue Item、Lease、Slot、TaskのIdentity、Owner、世代、状態遷移、解放確認およびEffect件数を記録する | 同じOwner・世代だけがLeaseを更新・解放でき、cleanup不明または期限切れを安全確認なしに再利用しない | PRL-11、各資源Identity、Owner・世代、状態遷移、解放確認、競合理由、Effect件数およびOracle判定を保存する | 正常完了時はLease／Slot残存0。観測不能時は再利用せず回復義務を保持する | Automated |
| `PRL-12` | 境界 | IT | Application Contract／Transport | CLI・MCP Adapter→Project Runtime Application Port→Core | Related 2 Blocks | 同一のProject Authority、入力、Core結果と、Authority追加・成功意味変更・field欠落を含むTransport反例 | CLIとMCPから同じApplication Operationを要求する | Adapter入力、Core入力、Authority差分、Core結果、公開結果、Effect件数および拒否理由をTransport間で比較する | TransportはAuthority、成功条件または回復意味を新設せず、同じCore Contractを保つ | PRL-12、Transport別入力・結果、Authority差分、Effect件数、拒否理由およびOracle判定を保存する | 正常時は同じCore Effect一件。反例ではCore Effect 0 | Automated |

## Semantic Coverage Pilot

この表はQuality Local Itemが検証する設計上の意味だけを正方向で宣言する。逆方向の一覧は生成し、本文の類似表現から推測しない。

| Local ID | Semantic Key |
|---|---|
| `PRL-01` | `coordinator.objective-lifecycle`<br>`project-runtime.objective-task-lifecycle` |
| `PRL-03` | `coordinator.cleanup-before-result` |
| `PRL-04` | `coordinator.recovery-obligation`<br>`project-runtime.durable-before-effect`<br>`project-runtime.recovery-obligation` |
| `PRL-05` | `coordinator.provider-effect-authority`<br>`project-runtime.task-authority-narrowing` |
| `PRL-07` | `project-runtime.acceptance-decision-authority` |
| `PRL-11` | `project-runtime.queue-lease-lifecycle` |
| `PRL-12` | `project-runtime.transport-neutral-application-contract` |

## 5. 評価とEvidence

Lifecycleの一部を直接関数で呼ぶ試験は原因層の根拠とする。公開CapabilityのPassには、本番と同じCompositionから事前状態を作り、公開結果、全資源の終了または回復義務までを同じrunで観測する。EvidenceはIdentity、状態遷移、Effectの有無、回復参照、終了後資源を分けて保持する。

## 6. 実行制限

PT／LTは人間が上限、費用／Credit、中止条件、cleanupおよび対象環境を明示した場合だけ実行する。未許可はEffect 0とし、必須の性能／長時間要求がない限り通常の監査だけを停止しない。

## 追加試験種別の適用

| 種別 | 適用 | 確認する範囲 | 実行許可 | 未実行時の扱い |
|---|---|---|---|---|
| RT | Required | 変更した意味と利用側から、再実行する既存Local Itemを選ぶ | Changeの通常検証範囲 | 未選択の範囲を明示し、選択した回帰の結果で評価する |
| PT | Conditional | 対象、負荷上限、費用／Credit上限、中止条件および清掃条件を事前に固定した場合だけ設計する | Human Explicit Authorization | 未実行をPassへ読み替えず、明示的なRelease条件でない限り通常監査を停止しない |
| LT | Conditional | 対象、継続時間、資源／費用上限、中止条件および清掃条件を事前に固定した場合だけ設計する | Human Explicit Authorization | 未実行をPassへ読み替えず、明示的なRelease条件でない限り通常監査を停止しない |


## Checklist

- [x] Quality ID、検証目標およびSource固有条件を自己完結して示した
- [x] UT／IT／ST／UATの適用または理由付きN/Aを記録した
- [x] 外部境界の直接、隣接1 block、関連2 blocks、System／E2Eおよび利用者受入を適用判定した
- [x] 正常、境界、失敗および観測不能をLocal Itemで処置した
- [x] 各Local Itemで観測とOracleを分けた
- [x] 各Local ItemのEvidence要件を示した
- [x] 事前条件、刺激、終了後条件、cleanupおよびRecoveryを必要な範囲で示した
- [x] RT／PT／LTの適用または理由付きN/Aを記録し、PT／LTは人間の明示指定なしに実行しない
- [x] 自動化、手動確認および人間判断の境界を示した
- [x] 現行Source、TestおよびEvidenceとの照合をReality Auditへ分離した
