# 実行記録の公開と再利用の検証定義

成果物種別: Quality定義
検証目標: 異なる作成側が実行事実を同じ契約で安全に記録し、取得側が意味を変えず再利用できること
主な試験段階: Unit／Integration／System
状態: Canonical
維持責任者: Qual-Lab

## 1. 情報源と網羅条件

| Source ID | 保持する固有条件 | 対応Local Item |
|---|---|---|
| [REQ-000004](../../../01_Discovery/Definitions/REQ-000004/requirement.md) | タスクの識別情報、実行者、時刻、結果、利用量等の観測事実を相関できる。別実行基盤またはTypeScriptアプリから同じ契約で記録・読取りできる。観測値、推定、改善候補、人間の採用判断を別状態として保つ。複数作成側、再試行、部分記録、並行書込み、途中失敗を与え、事実の同一性、欠測、保存後の比較可能性を観測する。生出力、秘密情報または不要な個人情報を一律収集しない | `ERP-01`、`ERP-02`、`ERP-03`、`ERP-05` |
| [UX-000032](../../../02_UX/Definitions/UX-000032/ux_definition.md) | 作成側が同じ実行、情報源、観測時点、観測状態および記録試行を対応付けて一度だけ依頼する。複数作成側、再送、並行書込みまたは途中失敗でも誤統合せず、結果不明では同じ実行と試行を再観測する。生出力、秘密情報または不要な個人情報を無条件に含めない | `ERP-01`、`ERP-02`、`ERP-03`、`ERP-04`、`ERP-05` |
| [IA-000022](../../../03_IA/Definitions/IA-000022/ia_definition.md) | 実行、情報源、観測、記録試行、公開結果を別対象として結び、prepared／publishing／recorded／not_recorded／unknownを区別する。unknownでは同じExecution IDとAttempt IDを保持して再観測し、許可外内容を診断へ複製しない | `ERP-01`、`ERP-02`、`ERP-03`、`ERP-04`、`ERP-05` |
| [UI-000020](../../../04_UI/Definitions/UI-000020/ui_definition.md) | 記録対象と許可範囲を確認して一度依頼し、recorded／not_recorded／unknownを同じExecution IDとAttempt IDへ結び付ける。unknownでは再発行せず再観測へ進み、秘密情報・生出力・不要な個人情報をFeedbackへ複製しない | `ERP-01`、`ERP-02`、`ERP-03`、`ERP-04`、`ERP-05` |
| [SPEC-000030](../../../05_SPEC/Definitions/SPEC-000030/spec_definition.md) | 正常: 異なる作成側から同じ契約で記録し、取得側が意味を変えず比較できる。境界: 同一再送、複数作成側、並行書込み、部分記録を別Executionや完成記録へ誤統合しない。失敗: 途中失敗または衝突で中間物を完成記録として公開せず、別記録を上書きしない。観測不能: 保存Effect不明をnot_recordedへ丸めず、同じIdentityで再観測可能にする。副作用: 許可された実行記録領域への不変な記録だけで、Task、Provider、評価または他Sourceを変更しない。生Provider出力、秘密情報または不要な個人情報を一律に記録しない | `ERP-01`、`ERP-02`、`ERP-03`、`ERP-04`、`ERP-05` |
| [ARCH-000018](../../../06_Architecture/Definitions/ARCH-000018/architecture_definition.md) | 異なる実行基盤またはTypeScriptアプリから受け取った観測事実をCanonical契約で検査し、並行書込みと途中失敗を安全に扱って不変に公開する。所有する責務: Canonical Event検査、同一性、並行公開、衝突再読取り、Effect不明時の回復参照。所有しない責務: Provider実行、Task状態更新、評価採用、読取りProjection、保存内容からの品質断定。SchemaまたはIdentity不一致と許可外情報はEffect前に拒否する。並行Writerは完成記録を上書きせず、途中失敗では一時物を公開しない。Effect不明では自動再発行せず、同じExecution IdentityとAttemptで再観測する。完了時はWriter handle、lock、一時物が残らない | `ERP-01`、`ERP-02`、`ERP-03`、`ERP-04`、`ERP-05` |
### Architecture詳細設計入力

| 詳細設計領域 | 受け取る成立条件 |
|---|---|
| [execution-intelligence](../../../06_Architecture/Details/execution-intelligence/01_Architecture.md) | Canonical記録、不変公開、並行Writer、実行事実、観測不能、出所と評価候補の分離 |

## 2. 事前条件

Execution Identity、Source Identity、Observed At、観測状態、記録先の許可範囲と記録Attemptを固定する。秘密情報や生Provider出力を試験入力へ無条件に含めない。

## 3. 検証項目

| Local ID | 分類 | 事前状態／入力 | 操作／刺激 | 観測と期待結果 | 終了後条件 | 実行形態 |
| --- | --- | --- | --- | --- | --- | --- |
| `ERP-01` | 正常 | 同義Eventを生成できる二つ以上の実行基盤・TypeScriptアプリと空の記録先 | 各作成側からEventを一件ずつ記録する | 同じSchema、Identity、Source、Observed Atで公開し、取得側が意味を変えず比較できる | Writer handle、lock、一時物0 | Automated |
| `ERP-02` | 境界 | 同じEvent Identityの未記録Event、別Executionの完成記録、同一Rootへ接続した複数Writer | 同一Eventを再送し、複数Writerから同時記録する | 重複事実を作らず、別Executionを上書きしない | Canonical完成記録が一つ | Automated |
| `ERP-03` | 異常 | 別Executionの不変な完成記録、対象Attempt、公開前後の故障注入点 | 部分書込み、公開直前・直後の失敗、collisionを発生させる | 中間物を完成記録にせず、collision後はCanonical記録を再読取りする | 別記録不変、残存は回復義務へ結合 | Automated |
| `ERP-04` | 観測不能 | 保存要求を受理した対象Attemptと、結果搬送・確定観測の故障注入点 | 保存要求後に結果搬送または確定観測を失敗させる | `recorded`／`not_recorded`へ推定せず`unknown`と同じIdentityの再観測先を返す | 自動再発行0 | Automated |
| `ERP-05` | 情報境界 | Secret、生出力、不要な個人情報、許可外Sourceを含む各Event | 各Eventの記録をEffect前の入口へ要求する | 記録Effect前に拒否または許可された最小情報へ限定し、内容を診断へ複製しない | 許可外Store Effect 0 | Automated |

## 4. 評価

各Source固有条件が少なくとも一つのLocal Itemへ到達し、記録要求、Effect、公開確認、取得結果および終了後資源を別々に観測できる場合だけPassとする。

## 5. 根拠と限界

本定義は記録能力を読取りProjectionへ混ぜない。実装済みWriter／Storeの存在はReality Auditで確認し、Canonical設計の根拠へ逆輸入しない。
