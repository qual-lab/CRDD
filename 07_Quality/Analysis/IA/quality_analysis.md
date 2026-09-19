# IA工程のQuality分析

成果物種別: Quality分析（IA観点）
分析Origin: `IA`
状態: Canonical
維持責任者: Qual-Lab

## 1. 目的

IA工程が定義した成立条件を全件処置し、成功の意味、失敗またはRisk、検証義務および統合候補を、後から推測せずQuality Integrationへ渡す。

## 2. 全件Coverage Index

この表はCanonical IDの処置漏れを防ぐ索引であり、意味分析の正本ではない。Source固有の成立条件、失敗、RiskおよびLocal Itemとの関係は第3章で示す。

| Source ID | 成功の意味 | 検証義務 | 統合先の検証目標 | 試験段階 | 試験種別 | 処置状態 |
|---|---|---|---|---|---|---|
| [IA-000001](../../../03_IA/Definitions/IA-000001/ia_definition.md) | 検査対象・条件・指摘 | 「検査対象・条件・指摘」に必要な対象・状態・関係・導線を識別し追跡できることを確認する | [Repositoryと契約移行](../../Definitions/QA-000001/quality_definition.md) | UT | Contract／Traceability | Mapped |
| [IA-000002](../../../03_IA/Definitions/IA-000002/ia_definition.md) | 目的・節目・Task・受入・判断 | 「目的・節目・Task・受入・判断」に必要な対象・状態・関係・導線を識別し追跡できることを確認する | [Project Runtime lifecycle](../../Definitions/QA-000003/quality_definition.md) | ST／UAT | Lifecycle／Fault | Mapped |
| [IA-000003](../../../03_IA/Definitions/IA-000003/ia_definition.md) | 実行・失敗・外部作用・回復 | 「実行・失敗・外部作用・回復」に必要な対象・状態・関係・導線を識別し追跡できることを確認する | [Project Runtime lifecycle](../../Definitions/QA-000003/quality_definition.md)<br>[外部Runtime境界](../../Definitions/QA-000006/quality_definition.md) | IT／ST | Lifecycle／Fault／External Boundary | Mapped |
| [IA-000004](../../../03_IA/Definitions/IA-000004/ia_definition.md) | 実行事実・観測・評価 | 「実行事実・観測・評価」に必要な対象・状態・関係・導線を識別し追跡できることを確認する | [投影と出所](../../Definitions/QA-000004/quality_definition.md) | IT／UAT | Information／State | Mapped |
| [IA-000005](../../../03_IA/Definitions/IA-000005/ia_definition.md) | 成立済み能力・契約・利用側・置換根拠 | 「成立済み能力・契約・利用側・置換根拠」に必要な対象・状態・関係・導線を識別し追跡できることを確認する | [Repositoryと契約移行](../../Definitions/QA-000001/quality_definition.md) | IT | Contract／Traceability | Mapped |
| [IA-000006](../../../03_IA/Definitions/IA-000006/ia_definition.md) | Project・Repository・Binding・読取り投影（Projection） | 「Project・Repository・Binding・読取り投影（Projection）」に必要な対象・状態・関係・導線を識別し追跡できることを確認する | [投影と出所](../../Definitions/QA-000004/quality_definition.md)<br>[RepositoryとFederation](../../Definitions/QA-000007/quality_definition.md) | IT／ST／UAT | Information／State／Identity／Security | Mapped |
| [IA-000007](../../../03_IA/Definitions/IA-000007/ia_definition.md) | 手元の情報源と横断情報源 | 「手元の情報源と横断情報源」に必要な対象・状態・関係・導線を識別し追跡できることを確認する | [RepositoryとFederation](../../Definitions/QA-000007/quality_definition.md) | IT／ST | Identity／Security | Mapped |
| [IA-000008](../../../03_IA/Definitions/IA-000008/ia_definition.md) | 公開受付・通信方式・結果 | 「公開受付・通信方式・結果」に必要な対象・状態・関係・導線を識別し追跡できることを確認する | [外部送信とTransport](../../Definitions/QA-000009/quality_definition.md) | IT／ST／UAT | Transport／Security | Mapped |
| [IA-000009](../../../03_IA/Definitions/IA-000009/ia_definition.md) | 接続資格・作業領域・公開範囲 | 「接続資格・作業領域・公開範囲」に必要な対象・状態・関係・導線を識別し追跡できることを確認する | [RepositoryとFederation](../../Definitions/QA-000007/quality_definition.md) | ST | Identity／Security | Mapped |
| [IA-000010](../../../03_IA/Definitions/IA-000010/ia_definition.md) | Meeting・Topic・候補・採否 | 「Meeting・Topic・候補・採否」に必要な対象・状態・関係・導線を識別し追跡できることを確認する | [候補の昇格](../../Definitions/QA-000005/quality_definition.md) | IT | Workflow／Authority | Mapped |
| [IA-000011](../../../03_IA/Definitions/IA-000011/ia_definition.md) | Tool能力・利用可否・配布根拠 | 「Tool能力・利用可否・配布根拠」に必要な対象・状態・関係・導線を識別し追跡できることを確認する | [Repositoryと契約移行](../../Definitions/QA-000001/quality_definition.md) | IT | Contract／Traceability | Mapped |
| [IA-000012](../../../03_IA/Definitions/IA-000012/ia_definition.md) | 実行時データ・保持・清掃 | 「実行時データ・保持・清掃」に必要な対象・状態・関係・導線を識別し追跡できることを確認する | [Runtime Data lifecycle](../../Definitions/QA-000008/quality_definition.md) | IT／ST | State／Recovery | Mapped |
| [IA-000013](../../../03_IA/Definitions/IA-000013/ia_definition.md) | AIモデル構成・選択・再選定 | 「AIモデル構成・選択・再選定」に必要な対象・状態・関係・導線を識別し追跡できることを確認する | [外部Runtime境界](../../Definitions/QA-000006/quality_definition.md) | IT／ST | External Boundary／Fault | Mapped |
| [IA-000014](../../../03_IA/Definitions/IA-000014/ia_definition.md) | 受け渡す情報・Task・結果・帰還 | 「受け渡す情報・Task・結果・帰還」に必要な対象・状態・関係・導線を識別し追跡できることを確認する | [外部送信とTransport](../../Definitions/QA-000009/quality_definition.md) | IT／ST／UAT | Transport／Security | Mapped |
| [IA-000015](../../../03_IA/Definitions/IA-000015/ia_definition.md) | 準拠・改ざん有無・配布者・信頼方針 | 「準拠・改ざん有無・配布者・信頼方針」に必要な対象・状態・関係・導線を識別し追跡できることを確認する | [成果物IntegrityとTrust](../../Definitions/QA-000010/quality_definition.md) | UT／IT／ST／UAT | Integrity／Security | Mapped |
| [IA-000016](../../../03_IA/Definitions/IA-000016/ia_definition.md) | 変更・指摘・是正・試験・品質 | 「変更・指摘・是正・試験・品質」に必要な対象・状態・関係・導線を識別し追跡できることを確認する | [変更と品質状態](../../Definitions/QA-000002/quality_definition.md) | IT／ST／UAT | Governance／Traceability | Mapped |
| [IA-000017](../../../03_IA/Definitions/IA-000017/ia_definition.md) | 外部送信先・目的・分類・同意・候補 | 「外部送信先・目的・分類・同意・候補」に必要な対象・状態・関係・導線を識別し追跡できることを確認する | [候補の昇格](../../Definitions/QA-000005/quality_definition.md)<br>[外部送信とTransport](../../Definitions/QA-000009/quality_definition.md) | IT／ST／UAT | Workflow／Authority／Transport／Security | Mapped |
| [IA-000018](../../../03_IA/Definitions/IA-000018/ia_definition.md) | 物語・構造・図・引き渡す意図 | 物語、構造、図、凡例、根拠、引き渡す意図を別対象として識別し、概要から根拠と次工程へ辿れる | [成果物の理解と工程引継ぎ](../../Definitions/QA-000013/quality_definition.md) | IT／ST | Information／Handoff | Mapped |
| [IA-000019](../../../03_IA/Definitions/IA-000019/ia_definition.md) | 公式素材・由来・権利・用途 | 「公式素材・由来・権利・用途」に必要な対象・状態・関係・導線を識別し追跡できることを確認する | [公式AssetのGovernance](../../Definitions/QA-000011/quality_definition.md) | ST／UAT | Governance／Rights Review | Mapped |
| [IA-000020](../../../03_IA/Definitions/IA-000020/ia_definition.md) | 実行基盤の故障箇所と利用可能範囲 | 「実行基盤の故障箇所と利用可能範囲」に必要な対象・状態・関係・導線を識別し追跡できることを確認する | [外部Runtime境界](../../Definitions/QA-000006/quality_definition.md) | IT | External Boundary／Fault | Mapped |
| [IA-000021](../../../03_IA/Definitions/IA-000021/ia_definition.md) | 過去の判断と現在有効な意図 | 「過去の判断と現在有効な意図」に必要な対象・状態・関係・導線を識別し追跡できることを確認する | [変更と品質状態](../../Definitions/QA-000002/quality_definition.md)<br>[投影と出所](../../Definitions/QA-000004/quality_definition.md) | IT／ST／UAT | Governance／Traceability／Information／State | Mapped |
| [IA-000022](../../../03_IA/Definitions/IA-000022/ia_definition.md) | 実行記録の作成・公開状態 | 実行、情報源、観測、記録試行、公開結果と回復先を区別し、結果不明を未記録へ畳まず追跡できることを確認する | [実行記録の公開と再利用](../../Definitions/QA-000012/quality_definition.md) | IT／ST | Persistence／State／Recovery | Mapped |

## 3. 検証目標への統合

| Source ID | 検証目標 | 保持する固有条件 | 試験段階 | 対応Local Item |
|---|---|---|---|---|
| [IA-000001](../../../03_IA/Definitions/IA-000001/ia_definition.md) | [Repositoryと契約移行](../../Definitions/QA-000001/quality_definition.md) | 機械的不備を意味判断から分け、修正すべき場所と責任を理解する。UX-000001: 検査前／不備あり／機械確認済み。意味判断は別状態 | UT | `RCM-01`、`RCM-02` |
| [IA-000002](../../../03_IA/Definitions/IA-000002/ia_definition.md) | [Project Runtime lifecycle](../../Definitions/QA-000003/quality_definition.md) | 内部Taskを逐次操作せず、何をどこまで誰へ任せ、何をもって受け入れるか理解する。UX-000002: 準備中／許可待ち／実行中／停止。権限発行前後を分ける。UX-000003: 開始可能（ready）／実行中（running）／入力・判断待ち（waiting）／停止（blocked）／完了（completed）／失敗（failed）。UX-000005: Task完了／Objective受入／Milestone受入を別にする | ST／UAT | `PRL-01`、`PRL-02`、`PRL-04` |
| [IA-000003](../../../03_IA/Definitions/IA-000003/ia_definition.md) | [Project Runtime lifecycle](../../Definitions/QA-000003/quality_definition.md) | 失敗後に再接続、再試行、回復、清掃を取り違えず、二重作用を避ける。UX-000003: 開始可能（ready）／実行中（running）／入力・判断待ち（waiting）／停止（blocked）／完了（completed）／失敗（failed）。UX-000004: 失敗後の作用なし／作用済み／不明、回復要／不要。UX-000021: 進行中（active）／切断（disconnected）／結果取得可能（result_available）／回復必要（recovery_required）／確定済み（settled）。UX-000022: 存在（present）／不存在（absent）／不明（unknown）、回復可能（recoverable）／清掃可能（cleanup_eligible） | ST | `PRL-04`、`PRL-01`、`PRL-03` |
| [IA-000003](../../../03_IA/Definitions/IA-000003/ia_definition.md) | [外部Runtime境界](../../Definitions/QA-000006/quality_definition.md) | 失敗後に再接続、再試行、回復、清掃を取り違えず、二重作用を避ける。UX-000003: 開始可能（ready）／実行中（running）／入力・判断待ち（waiting）／停止（blocked）／完了（completed）／失敗（failed）。UX-000004: 失敗後の作用なし／作用済み／不明、回復要／不要。UX-000021: 進行中（active）／切断（disconnected）／結果取得可能（result_available）／回復必要（recovery_required）／確定済み（settled）。UX-000022: 存在（present）／不存在（absent）／不明（unknown）、回復可能（recoverable）／清掃可能（cleanup_eligible） | IT | `ERB-04`、`ERB-01`、`ERB-02` |
| [IA-000004](../../../03_IA/Definitions/IA-000004/ia_definition.md) | [投影と出所](../../Definitions/QA-000004/quality_definition.md) | 観測できた事実、未観測、評価、改善候補を出所と時点付きで振り返る。UX-000006: 観測済み（observed）／未観測（not_observed）／不明（unknown）。評価は事実と別 | IT／UAT | `PPR-03`、`PPR-01`、`PPR-08` |
| [IA-000005](../../../03_IA/Definitions/IA-000005/ia_definition.md) | [Repositoryと契約移行](../../Definitions/QA-000001/quality_definition.md) | 責務移動後も何が維持・変更・廃止されたかを利用側まで理解する。UX-000007: 維持／変更／廃止／未確認 | IT | `RCM-03`、`RCM-05` |
| [IA-000006](../../../03_IA/Definitions/IA-000006/ia_definition.md) | [投影と出所](../../Definitions/QA-000004/quality_definition.md) | 論理Projectを一つに見ながら、情報源、物理Root、不完全性を取り違えず現在地を判断する。UX-000009: complete／partial／開示制限（restricted）／stale／競合あり（conflicting）／不明（unknown）。UX-000011: 確認済み（verified）／未確認（unverified）／曖昧（ambiguous）／利用不能（unavailable）。UX-000015: complete／partial／開示制限（restricted）／stale／競合あり（conflicting） | IT／UAT | `PPR-02`、`PPR-03`、`PPR-01`、`PPR-07` |
| [IA-000006](../../../03_IA/Definitions/IA-000006/ia_definition.md) | [RepositoryとFederation](../../Definitions/QA-000007/quality_definition.md) | 論理Projectを一つに見ながら、情報源、物理Root、不完全性を取り違えず現在地を判断する。UX-000009: complete／partial／開示制限（restricted）／stale／競合あり（conflicting）／不明（unknown）。UX-000011: 確認済み（verified）／未確認（unverified）／曖昧（ambiguous）／利用不能（unavailable）。UX-000015: complete／partial／開示制限（restricted）／stale／競合あり（conflicting） | IT／ST | `RFD-02`、`RFD-01`、`RFD-03` |
| [IA-000007](../../../03_IA/Definitions/IA-000007/ia_definition.md) | [RepositoryとFederation](../../Definitions/QA-000007/quality_definition.md) | 一つのRepositoryで日常作業を完了し、必要な時だけ横断情報へ進む。UX-000010: 手元で利用可能（local available）／横断情報源を利用不能（cross-source unavailable）でも継続可能 | IT／ST | `RFD-03`、`RFD-04`、`RFD-09` |
| [IA-000008](../../../03_IA/Definitions/IA-000008/ia_definition.md) | [外部送信とTransport](../../Definitions/QA-000009/quality_definition.md) | 入口を変えても同じ要求、権限判断、状態、結果へ到達する。UX-000012: 受付前／受付済み／作用前失敗／作用後失敗／結果あり | IT／ST／UAT | `EST-05`、`EST-01`、`EST-07` |
| [IA-000009](../../../03_IA/Definitions/IA-000009/ia_definition.md) | [RepositoryとFederation](../../Definitions/QA-000007/quality_definition.md) | 現在の接続で許可された作業領域とRepositoryだけを利用し、管理能力と内容閲覧を混同しない。UX-000013: 利用可能（available）／接続資格が必要（credential_required）／開示制限（restricted）／利用不能（unavailable）／不明（unknown） | ST | `RFD-03`、`RFD-04` |
| [IA-000010](../../../03_IA/Definitions/IA-000010/ia_definition.md) | [候補の昇格](../../Definitions/QA-000005/quality_definition.md) | 会話を自動採用せず、候補を既存論点と比較して所有正本へ戻す。UX-000014: 観測済み（observed）／候補（candidate）／採用（adopted）／却下（rejected）。会話と正本を分ける | IT | `CPR-01`、`CPR-04` |
| [IA-000011](../../../03_IA/Definitions/IA-000011/ia_definition.md) | [Repositoryと契約移行](../../Definitions/QA-000001/quality_definition.md) | Repositoryの仕事に必要な標準Toolを、版と根拠を取り違えず選ぶ。UX-000016: 利用可能（available）／利用不能（unavailable）／未確認（unverified）／停止（blocked） | IT | `RCM-02`、`RCM-10` |
| [IA-000012](../../../03_IA/Definitions/IA-000012/ia_definition.md) | [Runtime Data lifecycle](../../Definitions/QA-000008/quality_definition.md) | 保存場所の内部構造を推測せず、保持すべき状態、一時物、回復義務を安全に扱う。UX-000017: 一時（temporary）／保持必要（durable）／回復必要（recovery_required）／清掃可能（eligible_for_cleanup）／不明（unknown）。UX-000022: 存在（present）／不存在（absent）／不明（unknown）、回復可能（recoverable）／清掃可能（cleanup_eligible） | IT／ST | `RDL-02`、`RDL-03`、`RDL-01` |
| [IA-000013](../../../03_IA/Definitions/IA-000013/ia_definition.md) | [外部Runtime境界](../../Definitions/QA-000006/quality_definition.md) | コード改修なしに検証済み構成を更新し、実効選択と理由を理解する。UX-000018: 有効（valid）／無効（invalid）／利用可能（available）／利用不能（unavailable）／選択済み（selected） | IT／ST | `ERB-04`、`ERB-05`、`ERB-06` |
| [IA-000014](../../../03_IA/Definitions/IA-000014/ia_definition.md) | [外部送信とTransport](../../Definitions/QA-000009/quality_definition.md) | 必要最小の情報を出所付きで渡し、同じ仕事へ結果と未決事項を戻す。UX-000019: 準備済み（prepared）／送信済み（sent）／受領済み（received）／返却済み（returned）／停止（blocked）。UX-000021: 進行中（active）／切断（disconnected）／結果取得可能（result_available）／回復必要（recovery_required）／確定済み（settled）。UX-000024: 未許可（not_authorized）／許可済み（authorized）／送信済み（sent）／返却済み（returned）／候補（candidate）／採用（adopted） | IT／ST／UAT | `EST-03`、`EST-01`、`EST-04`、`EST-06`、`EST-08`、`EST-09` |
| [IA-000015](../../../03_IA/Definitions/IA-000015/ia_definition.md) | [成果物IntegrityとTrust](../../Definitions/QA-000010/quality_definition.md) | 公式表示だけに頼らず、異なる根拠を分けて実行基盤を信頼するか決める。UX-000020: 確認済み（verified）／未確認（unverified）／信頼済み（trusted）／非信頼（not_trusted）を別軸にする。UX-000031: 識別済み（identified）／確認済み（verified）／信頼済み（trusted）／品質確認済み（quality_assured）を別軸にする | UT／IT／ST／UAT | `AIT-03`、`AIT-04`、`AIT-05`、`AIT-06` |
| [IA-000016](../../../03_IA/Definitions/IA-000016/ia_definition.md) | [変更と品質状態](../../Definitions/QA-000002/quality_definition.md) | 作業の意図、変更対象、指摘、是正、検証、現在品質を一つの改訂版で辿る。UX-000023: 固定済み（fixed）／レビュー中（under_review）／是正必要（changes_required）／確認済み（verified）／判断必要（decision_required）。UX-000026: 計画済み（planned）／未実行（not_executed）／合格（passed）／失敗（failed）／停止（blocked）／非該当（not_applicable）。UX-000029: 計画済み（planned）／進行中（in_progress）／確認済み（verified）／公開済み（released）と品質状態を別にする | IT／ST／UAT | `CQS-01`、`CQS-02`、`CQS-04`、`CQS-05`、`CQS-06`、`CQS-07` |
| [IA-000017](../../../03_IA/Definitions/IA-000017/ia_definition.md) | [候補の昇格](../../Definitions/QA-000005/quality_definition.md) | 外部へ何をなぜ渡すかを判断し、戻った結果を自動採用しない。UX-000024: 未許可（not_authorized）／許可済み（authorized）／送信済み（sent）／返却済み（returned）／候補（candidate）／採用（adopted） | IT | `CPR-01`、`CPR-04` |
| [IA-000017](../../../03_IA/Definitions/IA-000017/ia_definition.md) | [外部送信とTransport](../../Definitions/QA-000009/quality_definition.md) | 外部へ何をなぜ渡すかを判断し、戻った結果を自動採用しない。UX-000024: 未許可（not_authorized）／許可済み（authorized）／送信済み（sent）／返却済み（returned）／候補（candidate）／採用（adopted） | ST／UAT | `EST-03`、`EST-05`、`EST-06` |
| [IA-000018](../../../03_IA/Definitions/IA-000018/ia_definition.md) | [成果物の理解と工程引継ぎ](../../Definitions/QA-000013/quality_definition.md) | 人が問題から判断まで理解し、工程固有の図と構造から次工程へ意図を渡す。UX-000027: 下書き（draft）／レビュー済み（reviewed）／現在有効（current）／履歴（historical）を必要時に区別。UX-000028: 作成済み（created）／参照（referenced）／理由付き非該当（not_applicable with reason） | IT／ST | `AUH-03`、`AUH-05` |
| [IA-000019](../../../03_IA/Definitions/IA-000019/ia_definition.md) | [公式AssetのGovernance](../../Definitions/QA-000011/quality_definition.md) | 公式素材を、見た目ではなく由来・権利・許可用途を確認して利用する。UX-000030: 候補（candidate）／採用済み（approved）／開示制限（restricted）／取下げ済み（withdrawn） | ST／UAT | `OAG-01`、`OAG-03` |
| [IA-000020](../../../03_IA/Definitions/IA-000020/ia_definition.md) | [外部Runtime境界](../../Definitions/QA-000006/quality_definition.md) | 実行基盤の一部が故障したとき、故障した境界と影響を受ける能力を見分け、利用できる範囲まで一律に停止しない。UX-000008: 各境界の利用可能（available）／停止（blocked）／不明（unknown）。全体停止と分ける | IT | `ERB-04`、`ERB-02` |
| [IA-000021](../../../03_IA/Definitions/IA-000021/ia_definition.md) | [変更と品質状態](../../Definitions/QA-000002/quality_definition.md) | 過去の仮説・判断・学びと現在有効な意図を区別し、古い前提を現在値として利用せず、いま必要な情報を選ぶ。UX-000025: 現在有効（current）／履歴（historical）／置換済み（superseded）／不明（unknown） | IT／ST／UAT | `CQS-01`、`CQS-02`、`CQS-05`、`CQS-06` |
| [IA-000021](../../../03_IA/Definitions/IA-000021/ia_definition.md) | [投影と出所](../../Definitions/QA-000004/quality_definition.md) | 過去の仮説・判断・学びと現在有効な意図を区別し、古い前提を現在値として利用せず、いま必要な情報を選ぶ。UX-000025: 現在有効（current）／履歴（historical）／置換済み（superseded）／不明（unknown） | IT／ST／UAT | `PPR-01`、`PPR-03`、`PPR-05`、`PPR-09` |
| [IA-000022](../../../03_IA/Definitions/IA-000022/ia_definition.md) | [実行記録の公開と再利用](../../Definitions/QA-000012/quality_definition.md) | 実行、情報源、観測、記録試行、公開結果を別対象として結び、prepared／publishing／recorded／not_recorded／unknownを区別する。unknownでは同じExecution IDとAttempt IDを保持して再観測し、許可外内容を診断へ複製しない | IT／ST | `ERP-01`、`ERP-02`、`ERP-03`、`ERP-04`、`ERP-05` |

## 4. 未解決事項

現在のCanonical集合は全件処置済み。誤った対応を除いた意味レビュー母集団は187対応行である。上流定義から合否を組み立てられない場合はQuality側で補完せず、該当工程を再開する。

## Checklist

- [x] 対象工程の全Canonical IDを一件以上処置した
- [x] 各Source固有の成功、境界、失敗、Riskおよび観測不能を分析した
- [x] 表題や共通定型句ではなくSource固有の検証義務を記録した
- [x] 意味の近い義務を統合してもSource固有条件を失っていない
- [x] 各Sourceと検証目標、試験段階およびLocal Itemを接続した
- [x] 上流の未確認事項をUAT、OPEN義務または上流再開へ処置した
- [x] 現行Source、TestまたはEvidenceから検証義務を逆算していない
- [x] 未解決事項、判断者および再評価契機を明示した
