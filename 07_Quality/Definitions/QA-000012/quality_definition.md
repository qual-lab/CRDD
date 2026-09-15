# QA-000012 実行記録の公開と再利用の検証定義

成果物種別: Quality定義
Quality ID: `QA-000012`
検証目標: 異なる作成側が実行事実を同じ契約で安全に記録し、取得側が意味を変えず再利用できること
主な試験段階: Unit／Integration／System／User Acceptance
状態: Canonical
維持責任者: Qual-Lab

## 1. 情報源と網羅条件

| Source ID | 保持する固有条件 | 試験段階 | 対応Local Item |
|---|---|---|---|
| [REQ-000004](../../../01_Discovery/Definitions/REQ-000004/requirement.md) | タスクの識別情報、実行者、時刻、結果、利用量等の観測事実を相関できる。別実行基盤またはTypeScriptアプリから同じ契約で記録・読取りできる。観測値、推定、改善候補、人間の採用判断を別状態として保つ。複数作成側、再試行、部分記録、並行書込み、途中失敗を与え、事実の同一性、欠測、保存後の比較可能性を観測する。生出力、秘密情報または不要な個人情報を一律収集しない | IT／UAT | `ERP-01`、`ERP-02`、`ERP-03`、`ERP-05`、`ERP-07` |
| [UX-000032](../../../02_UX/Definitions/UX-000032/ux_definition.md) | 作成側が同じ実行、情報源、観測時点、観測状態および記録試行を対応付けて一度だけ依頼する。複数作成側、再送、並行書込みまたは途中失敗でも誤統合せず、結果不明では同じ実行と試行を再観測する。生出力、秘密情報または不要な個人情報を無条件に含めない | IT／ST／UAT | `ERP-01`、`ERP-02`、`ERP-03`、`ERP-04`、`ERP-05`、`ERP-07` |
| [IA-000022](../../../03_IA/Definitions/IA-000022/ia_definition.md) | 実行、情報源、観測、記録試行、公開結果を別対象として結び、prepared／publishing／recorded／not_recorded／unknownを区別する。unknownでは同じExecution IDとAttempt IDを保持して再観測し、許可外内容を診断へ複製しない | IT／ST | `ERP-01`、`ERP-02`、`ERP-03`、`ERP-04`、`ERP-05` |
| [UI-000020](../../../04_UI/Definitions/UI-000020/ui_definition.md) | 記録対象と許可範囲を確認して一度依頼し、recorded／not_recorded／unknownを同じExecution IDとAttempt IDへ結び付ける。unknownでは再発行せず再観測へ進み、秘密情報・生出力・不要な個人情報をFeedbackへ複製しない | IT／ST／UAT | `ERP-01`、`ERP-02`、`ERP-03`、`ERP-04`、`ERP-05`、`ERP-07` |
| [SPEC-000030](../../../05_SPEC/Definitions/SPEC-000030/spec_definition.md) | 正常: 異なる作成側から同じ契約で記録し、取得側が意味を変えず比較できる。境界: 同一再送、複数作成側、並行書込み、部分記録を別Executionや完成記録へ誤統合しない。失敗: 途中失敗または衝突で中間物を完成記録として公開せず、別記録を上書きしない。観測不能: 保存Effect不明をnot_recordedへ丸めず、同じIdentityで再観測可能にする。副作用: 許可された実行記録領域への不変な記録だけで、Task、Provider、評価または他Sourceを変更しない。生Provider出力、秘密情報または不要な個人情報を一律に記録しない | IT／ST | `ERP-01`、`ERP-02`、`ERP-03`、`ERP-04`、`ERP-05` |
| [ARCH-000018](../../../06_Architecture/Definitions/ARCH-000018/architecture_definition.md) | 異なる実行基盤またはTypeScriptアプリから受け取った観測事実をCanonical契約で検査し、並行書込みと途中失敗を安全に扱って不変に公開する。所有する責務: Canonical Event検査、同一性、並行公開、衝突再読取り、Effect不明時の回復参照。所有しない責務: Provider実行、Task状態更新、評価採用、読取りProjection、保存内容からの品質断定。SchemaまたはIdentity不一致と許可外情報はEffect前に拒否する。並行Writerは完成記録を上書きせず、途中失敗では一時物を公開しない。Effect不明では自動再発行せず、同じExecution IdentityとAttemptで再観測する。完了時はWriter handle、lock、一時物が残らない | UT／IT／ST | `ERP-01`、`ERP-02`、`ERP-03`、`ERP-04`、`ERP-05`、`ERP-06` |
### Architecture詳細設計入力

| 詳細設計領域 | 受け取る成立条件 |
|---|---|
| [execution-intelligence](../../../06_Architecture/Details/execution-intelligence/01_Architecture.md) | Canonical記録、不変公開、並行Writer、実行事実、観測不能、出所と評価候補の分離 |

## 2. 事前条件

Execution Identity、Source Identity、Observed At、観測状態、記録先の許可範囲と記録Attemptを固定する。秘密情報や生Provider出力を試験入力へ無条件に含めない。

## 3. 試験段階と外部境界の適用

| 試験段階 | 適用 | 確認する範囲 | 外部境界の到達範囲 | 判断理由 |
| --- | --- | --- | --- | --- |
| UT | Required | Event生成、Identity、入力拒否、不変条件 | N/A | Writer接続前に純粋なCanonical Contractを反証するため |
| IT | Required | Producer、Writer、Store、ReaderとFilesystem境界 | Related 2 Blocks | 並行Writer、公開、再読取り、失敗残存を段階的に確認するため |
| ST | Required | 複数実行基盤から記録・取得・再利用まで | System/E2E | 一つのWriter成功を公開能力全体へ一般化しないため |
| UAT | Required | 外部アプリ利用者が記録を理解し再利用する場面 | User Acceptance | 記録の出所・欠測・時点を理解して再利用できる利用者成果を確認するため |

## 4. 検証項目

| Local ID | 分類 | 試験段階 | 試験種別 | 対象／境界 | 外部境界の段階 | 事前状態／入力 | 操作／刺激 | 観測と期待結果 | 終了後条件 | 実行形態 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `ERP-01` | 正常 | IT | Contract／Persistence | Producer→Writer→Store→Reader | Related 2 Blocks | 同義Eventを生成できる二つ以上の実行基盤・TypeScriptアプリと空の記録先 | 各作成側からEventを一件ずつ記録する | 同じSchema、Identity、Source、Observed Atで公開し、取得側が意味を変えず比較できる | Writer handle、lock、一時物0 | Automated |
| `ERP-02` | 境界 | IT | Concurrency／Idempotency | 複数Writer→同一Store | Direct Boundary | 同じEvent Identityの未記録Event、別Executionの完成記録、同一Rootへ接続した複数Writer | 同一Eventを再送し、複数Writerから同時記録する | 重複事実を作らず、別Executionを上書きしない | Canonical完成記録が一つ | Automated |
| `ERP-03` | 異常 | IT | Fault Injection／Recovery | Writer→Filesystem publish→Reader | Adjacent 1 Block | 別Executionの不変な完成記録、対象Attempt、公開前後の故障注入点 | 部分書込み、公開直前・直後の失敗、collisionを発生させる | 中間物を完成記録にせず、collision後はCanonical記録を再読取りする | 別記録不変、残存は回復義務へ結合 | Automated |
| `ERP-04` | 観測不能 | ST | Recovery／Unknown Effect | Producer→Writer→公開結果→再観測入口 | System/E2E | 保存要求を受理した対象Attemptと、結果搬送・確定観測の故障注入点 | 保存要求後に結果搬送または確定観測を失敗させる | `recorded`／`not_recorded`へ推定せず`unknown`と同じIdentityの再観測先を返す | 自動再発行0 | Automated |
| `ERP-05` | 情報境界 | IT | Security／Data Minimization | Event入口→Policy→Store | Adjacent 1 Block | Secret、生出力、不要な個人情報、許可外Sourceを含む各Event | 各Eventの記録をEffect前の入口へ要求する | 記録Effect前に拒否または許可された最小情報へ限定し、内容を診断へ複製しない | 許可外Store Effect 0 | Automated |
| `ERP-06` | 境界 | UT | Contract／Identity | Canonical Eventの検査・Identity生成規則 | N/A | 正常Eventと、Schema不一致、Identity不足、許可外分類の各入力 | 保存処理へ渡す前に入力を検査する | 正常値だけをCanonical化し、不正値を理由別に拒否する | Writer・Filesystem Effect 0 | Automated |
| `ERP-07` | 利用者判断 | UAT | Acceptance／Provenance | 公開記録→外部アプリ利用者 | User Acceptance | 異なる実行基盤の記録、欠測、観測不能、異なる観測時点 | 利用者が記録を比較し再利用可否を判断する | 事実・未観測・評価候補と出所を区別し、再探索なしに根拠へ戻れる | 記録・対象Task・Provider Effect 0 | Manual |

## 5. 評価

各Source固有条件が少なくとも一つのLocal Itemへ到達し、記録要求、Effect、公開確認、取得結果および終了後資源を別々に観測できる場合だけPassとする。

## 6. 根拠と限界

本定義は記録能力を読取りProjectionへ混ぜない。実装済みWriter／Storeの存在はReality Auditで確認し、Canonical設計の根拠へ逆輸入しない。

## 追加試験種別の適用

| 種別 | 適用 | 確認する範囲 | 実行許可 | 未実行時の扱い |
|---|---|---|---|---|
| RT | Required | 変更した意味と利用側から、再実行する既存Local Itemを選ぶ | Changeの通常検証範囲 | 未選択の範囲を明示し、選択した回帰の結果で評価する |
| PT | Conditional | 対象、負荷上限、費用／Credit上限、中止条件および清掃条件を事前に固定した場合だけ設計する | Human Explicit Authorization | 未実行をPassへ読み替えず、明示的なRelease条件でない限り通常監査を停止しない |
| LT | Conditional | 対象、継続時間、資源／費用上限、中止条件および清掃条件を事前に固定した場合だけ設計する | Human Explicit Authorization | 未実行をPassへ読み替えず、明示的なRelease条件でない限り通常監査を停止しない |
