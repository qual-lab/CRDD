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
| [IA-000002](../../../03_IA/Definitions/IA-000002/ia_definition.md) | 目的・節目・Task・受入・判断 | 「目的・節目・Task・受入・判断」に必要な対象・状態・関係・導線を識別し追跡できることを確認する | [Orchestrator lifecycle](../../Definitions/QA-000003/quality_definition.md) | ST／UAT | Lifecycle／Fault | Mapped |
| [IA-000003](../../../03_IA/Definitions/IA-000003/ia_definition.md) | 実行・失敗・外部作用・回復 | 「実行・失敗・外部作用・回復」に必要な対象・状態・関係・導線を識別し追跡できることを確認する | [Orchestrator lifecycle](../../Definitions/QA-000003/quality_definition.md)<br>[外部Runtime境界](../../Definitions/QA-000006/quality_definition.md) | IT／ST | Lifecycle／Fault／External Boundary | Mapped |
| [IA-000004](../../../03_IA/Definitions/IA-000004/ia_definition.md) | 実行事実・観測・評価 | 「実行事実・観測・評価」に必要な対象・状態・関係・導線を識別し追跡できることを確認する | [投影と出所](../../Definitions/QA-000004/quality_definition.md) | IT／UAT | Information／State | Mapped |
| [IA-000005](../../../03_IA/Definitions/IA-000005/ia_definition.md) | 成立済み能力・契約・利用側・置換根拠 | 「成立済み能力・契約・利用側・置換根拠」に必要な対象・状態・関係・導線を識別し追跡できることを確認する | [Repositoryと契約移行](../../Definitions/QA-000001/quality_definition.md) | IT | Contract／Traceability | Mapped |
| [IA-000006](../../../03_IA/Definitions/IA-000006/ia_definition.md) | Project・Repository・Binding・読取り投影（Projection） | 「Project・Repository・Binding・読取り投影（Projection）」に必要な対象・状態・関係・導線を識別し追跡できることを確認する | [投影と出所](../../Definitions/QA-000004/quality_definition.md)<br>[RepositoryとFederation](../../Definitions/QA-000007/quality_definition.md) | IT／ST／UAT | Information／State／Identity／Security | Mapped |
| [IA-000007](../../../03_IA/Definitions/IA-000007/ia_definition.md) | 手元の情報源と横断情報源 | 「手元の情報源と横断情報源」に必要な対象・状態・関係・導線を識別し追跡できることを確認する | [RepositoryとFederation](../../Definitions/QA-000007/quality_definition.md) | IT／ST | Identity／Security | Mapped |
| [IA-000008](../../../03_IA/Definitions/IA-000008/ia_definition.md) | 公開受付・通信方式・結果 | 「公開受付・通信方式・結果」に必要な対象・状態・関係・導線を識別し追跡できることを確認する | [外部送信とTransport](../../Definitions/QA-000009/quality_definition.md) | IT／ST／UAT | Transport／Security | Mapped |
| [IA-000009](../../../03_IA/Definitions/IA-000009/ia_definition.md) | ユーザー・Role権限・接続資格・Repository範囲・Access Recovery | 固定8操作の管理許可と可変の内容権限を別情報とする。新規登録の予定Role／名前と、既存ユーザー変更のID／Role前後、Repository登録状態／Exposureを操作別に識別し、資格情報と混同しない。userId、管理用表示名、Role、資格、公開範囲と現在認可を別情報として扱う。管理権限は内容権限を意味しない。交換対象・失効範囲・既存発行先・保持情報と、失効／発行／記録／搬送／受領の既知状態を区別し、Secret再表示・非許可情報の存在開示をしない。登録関係と対応Exposure、各除去の読戻し、対象外／本体保持および旧処理終了状態を別情報として扱う。元発行IdentityはCredential IDとも別交換Operation／Recoveryとも区別する。発行／非秘密記録不明、確定発行・記録と配送／受領だけ未確認、現在管理者認証の未接続／喪失を別状態とし、既知事実を保持する。通常発行に交換Recoveryを設けず、交換由来だけ元exactを持つ。明示的な別交換には先の資格を含む現在対象集合を示し、失効後の遅延応答を利用可能鍵として分類しない。別交換成功と旧受領・rollback・取消完了を別情報とする。初回追加義務: 初回設定前の非秘密の試行情報と、作成後のUUIDユーザー・Role・鍵の紐付けを区別する。表示名は表示用であり認証・権限ではない。試行、発行、記録、受け渡し、受領、通常管理接続の関係と現在状態を保持する。 | [RepositoryとFederation](../../Definitions/QA-000007/quality_definition.md) | IT／ST／UAT | Identity／Security | Mapped — Not Run（初回4項目への定義接続、実行未完了） |
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
| [IA-000023](../../../03_IA/Definitions/IA-000023/ia_definition.md) | 標準Project Context | 五つの観点、現在事実、共有分析、期限状態、不完全性およびOwner Relationを固定Markdownから同じ意味で再構成できることを確認する | [投影と出所](../../Definitions/QA-000004/quality_definition.md)<br>[RepositoryとFederation](../../Definitions/QA-000007/quality_definition.md)<br>[成果物の理解と工程引継ぎ](../../Definitions/QA-000013/quality_definition.md) | IT／ST／UAT | Information／State／Identity／Security／Handoff | Mapped |

## 3. 検証目標への統合

| Source ID | Obligation Key | 導出元 | 検証目標 | 保持する固有条件 | 試験段階 | 外部境界の段階 | 対応Local Item |
|---|---|---|---|---|---|---|---|
| [IA-000001](../../../03_IA/Definitions/IA-000001/ia_definition.md) | `ia-000001.qa-000001` | IA Definition（情報・関係・状態・見つけ方） | [Repositoryと契約移行](../../Definitions/QA-000001/quality_definition.md) | 機械的不備を意味判断から分け、修正すべき場所と責任を理解する。UX-000001: 検査前／不備あり／機械確認済み。意味判断は別状態 | UT | UT: N/A | `RCM-UT-001`、`RCM-UT-002` |
| [IA-000002](../../../03_IA/Definitions/IA-000002/ia_definition.md) | `ia-000002.qa-000003` | IA Definition（情報・関係・状態・見つけ方） | [Orchestrator lifecycle](../../Definitions/QA-000003/quality_definition.md) | 内部Taskを逐次操作せず、何をどこまで誰へ任せ、何をもって受け入れるか理解する。UX-000002: 準備中／許可待ち／実行中／停止。権限発行前後を分ける。UX-000003: 開始可能（ready）／実行中（running）／入力・判断待ち（waiting）／停止（blocked）／完了（completed）／失敗（failed）。UX-000005: Task完了／Objective受入／Milestone受入を別にする | ST／UAT | ST: System/E2E<br>UAT: User Acceptance | `PRL-ST-001`、`PRL-UAT-002`、`PRL-ST-004` |
| [IA-000003](../../../03_IA/Definitions/IA-000003/ia_definition.md) | `ia-000003.qa-000003` | IA Definition（情報・関係・状態・見つけ方） | [Orchestrator lifecycle](../../Definitions/QA-000003/quality_definition.md) | 失敗後に再接続、再試行、回復、清掃を取り違えず、二重作用を避ける。UX-000003: 開始可能（ready）／実行中（running）／入力・判断待ち（waiting）／停止（blocked）／完了（completed）／失敗（failed）。UX-000004: 失敗後の作用なし／作用済み／不明、回復要／不要。UX-000021: 進行中（active）／切断（disconnected）／結果取得可能（result_available）／回復必要（recovery_required）／確定済み（settled）。UX-000022: 存在（present）／不存在（absent）／不明（unknown）、回復可能（recoverable）／清掃可能（cleanup_eligible） | ST | ST: System/E2E | `PRL-ST-004`、`PRL-ST-001`、`PRL-ST-003` |
| [IA-000003](../../../03_IA/Definitions/IA-000003/ia_definition.md) | `ia-000003.qa-000006` | IA Definition（情報・関係・状態・見つけ方） | [外部Runtime境界](../../Definitions/QA-000006/quality_definition.md) | 失敗後に再接続、再試行、回復、清掃を取り違えず、二重作用を避ける。UX-000003: 開始可能（ready）／実行中（running）／入力・判断待ち（waiting）／停止（blocked）／完了（completed）／失敗（failed）。UX-000004: 失敗後の作用なし／作用済み／不明、回復要／不要。UX-000021: 進行中（active）／切断（disconnected）／結果取得可能（result_available）／回復必要（recovery_required）／確定済み（settled）。UX-000022: 存在（present）／不存在（absent）／不明（unknown）、回復可能（recoverable）／清掃可能（cleanup_eligible） | IT | IT: Direct Boundary | `ERB-IT-004`、`ERB-IT-001`、`ERB-IT-002` |
| [IA-000004](../../../03_IA/Definitions/IA-000004/ia_definition.md) | `ia-000004.qa-000004` | IA Definition（情報・関係・状態・見つけ方） | [投影と出所](../../Definitions/QA-000004/quality_definition.md) | 観測できた事実、未観測、評価、改善候補を出所と時点付きで振り返る。UX-000006: 観測済み（observed）／未観測（not_observed）／不明（unknown）。評価は事実と別 | IT／UAT | IT: Direct Boundary<br>UAT: User Acceptance | `PPR-IT-003`、`PPR-IT-001`、`PPR-UAT-008` |
| [IA-000005](../../../03_IA/Definitions/IA-000005/ia_definition.md) | `ia-000005.qa-000001` | IA Definition（情報・関係・状態・見つけ方） | [Repositoryと契約移行](../../Definitions/QA-000001/quality_definition.md) | 責務移動後も何が維持・変更・廃止されたかを利用側まで理解する。UX-000007: 維持／変更／廃止／未確認 | IT | IT: Direct Boundary | `RCM-IT-003`、`RCM-IT-005` |
| [IA-000006](../../../03_IA/Definitions/IA-000006/ia_definition.md) | `ia-000006.qa-000004` | IA Definition（情報・関係・状態・見つけ方） | [投影と出所](../../Definitions/QA-000004/quality_definition.md) | 論理Projectを一つに見ながら、情報源、物理Root、不完全性を取り違えず現在地を判断する。UX-000009: complete／partial／開示制限（restricted）／stale／競合あり（conflicting）／不明（unknown）。UX-000011: 確認済み（verified）／未確認（unverified）／曖昧（ambiguous）／利用不能（unavailable）。UX-000015: complete／partial／開示制限（restricted）／stale／競合あり（conflicting） | IT／UAT | IT: Direct Boundary<br>UAT: User Acceptance | `PPR-IT-002`、`PPR-IT-003`、`PPR-IT-001`、`PPR-UAT-007` |
| [IA-000006](../../../03_IA/Definitions/IA-000006/ia_definition.md) | `ia-000006.qa-000007` | IA Definition（情報・関係・状態・見つけ方） | [RepositoryとFederation](../../Definitions/QA-000007/quality_definition.md) | 論理Projectを一つに見ながら、情報源、物理Root、不完全性を取り違えず現在地を判断する。UX-000009: complete／partial／開示制限（restricted）／stale／競合あり（conflicting）／不明（unknown）。UX-000011: 確認済み（verified）／未確認（unverified）／曖昧（ambiguous）／利用不能（unavailable）。UX-000015: complete／partial／開示制限（restricted）／stale／競合あり（conflicting） | IT／ST | IT: Direct Boundary<br>ST: System/E2E | `RFD-IT-002`、`RFD-IT-001`、`RFD-ST-003` |
| [IA-000007](../../../03_IA/Definitions/IA-000007/ia_definition.md) | `ia-000007.qa-000007` | IA Definition（情報・関係・状態・見つけ方） | [RepositoryとFederation](../../Definitions/QA-000007/quality_definition.md) | 一つのRepositoryで日常作業を完了し、必要な時だけ横断情報へ進む。UX-000010: 手元で利用可能（local available）／横断情報源を利用不能（cross-source unavailable）でも継続可能 | IT／ST | IT: Direct Boundary<br>ST: System/E2E | `RFD-ST-003`、`RFD-ST-004`、`RFD-IT-009` |
| [IA-000008](../../../03_IA/Definitions/IA-000008/ia_definition.md) | `ia-000008.qa-000009` | IA Definition（情報・関係・状態・見つけ方） | [外部送信とTransport](../../Definitions/QA-000009/quality_definition.md) | 入口を変えても同じ要求、権限判断、状態、結果へ到達する。UX-000012: 受付前／受付済み／作用前失敗／作用後失敗／結果あり | IT／ST／UAT | IT: Direct Boundary<br>ST: System/E2E<br>UAT: User Acceptance | `EST-ST-005`、`EST-IT-001`、`EST-UAT-007` |
| [IA-000009](../../../03_IA/Definitions/IA-000009/ia_definition.md) | `ia-000009.qa-000007` | IA Definition（情報・関係・状態・見つけ方） | [RepositoryとFederation](../../Definitions/QA-000007/quality_definition.md) | 固定8操作の管理許可と可変の内容権限を別情報とする。新規登録の予定Role／名前と、既存ユーザー変更のID／Role前後、Repository登録状態／Exposureを操作別に識別し、資格情報と混同しない。userId、管理用表示名、Role、資格、公開範囲と現在認可を別情報として扱う。管理権限は内容権限を意味しない。交換対象・失効範囲・既存発行先・保持情報と、失効／発行／記録／搬送／受領の既知状態を区別し、Secret再表示・非許可情報の存在開示をしない。登録関係と対応Exposure、各除去の読戻し、対象外／本体保持および旧処理終了状態を別情報として扱う。元発行IdentityはCredential IDとも別交換Operation／Recoveryとも区別する。発行／非秘密記録不明、確定発行・記録と配送／受領だけ未確認、現在管理者認証の未接続／喪失を別状態とし、既知事実を保持する。通常発行に交換Recoveryを設けず、交換由来だけ元exactを持つ。明示的な別交換には先の資格を含む現在対象集合を示し、失効後の遅延応答を利用可能鍵として分類しない。別交換成功と旧受領・rollback・取消完了を別情報とする。初回追加義務: 初回設定前の非秘密の試行情報と、作成後のUUIDユーザー・Role・鍵の紐付けを区別する。表示名は表示用であり認証・権限ではない。試行、発行、記録、受け渡し、受領、通常管理接続の関係と現在状態を保持する。管理状態と進行中初回記録の両方が未初期化と確認できた場合だけ開始する。欠落一件、読取り不能、破損、Lock使用中、既存ユーザー、部分状態、確認不能を未初期化へ畳まない。発行／記録不明では元試行だけ再観測し、発行・記録確定後の受け渡しまたは受領不明では作成済み管理者の既存Host指定交換へ別の明示操作として渡す。秘密再表示・自動再発行・自動再初期化を行わない。初回設定とその状態照会をMCPの一覧・Schema・登録・dispatchへ出さず、遠隔Workbenchも実行しない。追加認証、Repository登録・公開、内容権限の暗黙付与を追加しない。 | IT／ST／UAT | IT: Related 2 Blocks<br>ST: System/E2E<br>UAT: User Acceptance |`RFD-ST-003`、`RFD-ST-004`、`RFD-ST-016`、`RFD-UAT-007`、`RFD-IT-013`、`RFD-IT-017`、`RFD-IT-018`、`RFD-IT-021`、`RFD-ST-022`<br>初回設定: `RFD-IT-024`、`RFD-IT-025`、`RFD-ST-026`、`RFD-UAT-027` |
| [IA-000010](../../../03_IA/Definitions/IA-000010/ia_definition.md) | `ia-000010.qa-000005` | IA Definition（情報・関係・状態・見つけ方） | [候補の昇格](../../Definitions/QA-000005/quality_definition.md) | 会話を自動採用せず、候補を既存論点と比較して所有正本へ戻す。UX-000014: 観測済み（observed）／候補（candidate）／採用（adopted）／却下（rejected）。会話と正本を分ける | IT | IT: Direct Boundary | `CPR-IT-001`、`CPR-IT-004` |
| [IA-000011](../../../03_IA/Definitions/IA-000011/ia_definition.md) | `ia-000011.qa-000001` | IA Definition（情報・関係・状態・見つけ方） | [Repositoryと契約移行](../../Definitions/QA-000001/quality_definition.md) | Repositoryの仕事に必要な標準Toolを、版と根拠を取り違えず選ぶ。UX-000016: 利用可能（available）／利用不能（unavailable）／未確認（unverified）／停止（blocked） | IT | IT: Direct Boundary | `RCM-UT-002`、`RCM-IT-010` |
| [IA-000012](../../../03_IA/Definitions/IA-000012/ia_definition.md) | `ia-000012.qa-000008` | IA Definition（情報・関係・状態・見つけ方） | [Runtime Data lifecycle](../../Definitions/QA-000008/quality_definition.md) | 保存場所の内部構造を推測せず、保持すべき状態、一時物、回復義務を安全に扱う。UX-000017: 一時（temporary）／保持必要（durable）／回復必要（recovery_required）／清掃可能（eligible_for_cleanup）／不明（unknown）。UX-000022: 存在（present）／不存在（absent）／不明（unknown）、回復可能（recoverable）／清掃可能（cleanup_eligible） | IT／ST | IT: Direct Boundary<br>ST: System/E2E | `RDL-ST-002`、`RDL-IT-003`、`RDL-IT-001` |
| [IA-000013](../../../03_IA/Definitions/IA-000013/ia_definition.md) | `ia-000013.qa-000006` | IA Definition（情報・関係・状態・見つけ方） | [外部Runtime境界](../../Definitions/QA-000006/quality_definition.md) | コード改修なしに検証済み構成を更新し、実効選択と理由を理解する。UX-000018: 有効（valid）／無効（invalid）／利用可能（available）／利用不能（unavailable）／選択済み（selected） | IT／ST | IT: Direct Boundary<br>ST: System/E2E | `ERB-IT-004`、`ERB-ST-005`、`ERB-IT-006` |
| [IA-000014](../../../03_IA/Definitions/IA-000014/ia_definition.md) | `ia-000014.qa-000009` | IA Definition（情報・関係・状態・見つけ方） | [外部送信とTransport](../../Definitions/QA-000009/quality_definition.md) | 必要最小の情報を出所付きで渡し、同じ仕事へ結果と未決事項を戻す。UX-000019: 準備済み（prepared）／送信済み（sent）／受領済み（received）／返却済み（returned）／停止（blocked）。UX-000021: 進行中（active）／切断（disconnected）／結果取得可能（result_available）／回復必要（recovery_required）／確定済み（settled）。UX-000024: 未許可（not_authorized）／許可済み（authorized）／送信済み（sent）／返却済み（returned）／候補（candidate）／採用（adopted） | IT／ST／UAT | IT: Direct Boundary<br>ST: System/E2E<br>UAT: User Acceptance | `EST-ST-003`、`EST-IT-001`、`EST-IT-004`、`EST-UAT-006`、`EST-UAT-008`、`EST-UAT-009` |
| [IA-000015](../../../03_IA/Definitions/IA-000015/ia_definition.md) | `ia-000015.qa-000010` | IA Definition（情報・関係・状態・見つけ方） | [成果物IntegrityとTrust](../../Definitions/QA-000010/quality_definition.md) | 公式表示だけに頼らず、異なる根拠を分けて実行基盤を信頼するか決める。UX-000020: 確認済み（verified）／未確認（unverified）／信頼済み（trusted）／非信頼（not_trusted）を別軸にする。UX-000031: 識別済み（identified）／確認済み（verified）／信頼済み（trusted）／品質確認済み（quality_assured）を別軸にする | UT／IT／ST／UAT | UT: N/A<br>IT: Direct Boundary<br>ST: System/E2E<br>UAT: User Acceptance | `AIT-IT-003`、`AIT-ST-004`、`AIT-UT-005`、`AIT-UAT-006` |
| [IA-000016](../../../03_IA/Definitions/IA-000016/ia_definition.md) | `ia-000016.qa-000002` | IA Definition（情報・関係・状態・見つけ方） | [変更と品質状態](../../Definitions/QA-000002/quality_definition.md) | 作業の意図、変更対象、指摘、是正、検証、現在品質を一つの改訂版で辿る。UX-000023: 固定済み（fixed）／レビュー中（under_review）／是正必要（changes_required）／確認済み（verified）／判断必要（decision_required）。UX-000026: 計画済み（planned）／未実行（not_executed）／合格（passed）／失敗（failed）／停止（blocked）／非該当（not_applicable）。UX-000029: 計画済み（planned）／進行中（in_progress）／確認済み（verified）／公開済み（released）と品質状態を別にする | IT／ST／UAT | IT: Direct Boundary<br>ST: System/E2E<br>UAT: User Acceptance | `CQS-IT-001`、`CQS-IT-002`、`CQS-IT-004`、`CQS-ST-005`、`CQS-UAT-006`、`CQS-UAT-007` |
| [IA-000017](../../../03_IA/Definitions/IA-000017/ia_definition.md) | `ia-000017.qa-000005` | IA Definition（情報・関係・状態・見つけ方） | [候補の昇格](../../Definitions/QA-000005/quality_definition.md) | 外部へ何をなぜ渡すかを判断し、戻った結果を自動採用しない。UX-000024: 未許可（not_authorized）／許可済み（authorized）／送信済み（sent）／返却済み（returned）／候補（candidate）／採用（adopted） | IT | IT: Direct Boundary | `CPR-IT-001`、`CPR-IT-004` |
| [IA-000017](../../../03_IA/Definitions/IA-000017/ia_definition.md) | `ia-000017.qa-000009` | IA Definition（情報・関係・状態・見つけ方） | [外部送信とTransport](../../Definitions/QA-000009/quality_definition.md) | 外部へ何をなぜ渡すかを判断し、戻った結果を自動採用しない。UX-000024: 未許可（not_authorized）／許可済み（authorized）／送信済み（sent）／返却済み（returned）／候補（candidate）／採用（adopted） | ST／UAT | ST: System/E2E<br>UAT: User Acceptance | `EST-ST-003`、`EST-ST-005`、`EST-UAT-006` |
| [IA-000018](../../../03_IA/Definitions/IA-000018/ia_definition.md) | `ia-000018.qa-000013` | IA Definition（情報・関係・状態・見つけ方） | [成果物の理解と工程引継ぎ](../../Definitions/QA-000013/quality_definition.md) | 人が問題から判断まで理解し、工程固有の図と構造から次工程へ意図を渡す。UX-000027: 下書き（draft）／レビュー済み（reviewed）／現在有効（current）／履歴（historical）を必要時に区別。UX-000028: 作成済み（created）／参照（referenced）／理由付き非該当（not_applicable with reason） | IT／ST | IT: Direct Boundary<br>ST: System/E2E | `AUH-IT-003`、`AUH-ST-005` |
| [IA-000019](../../../03_IA/Definitions/IA-000019/ia_definition.md) | `ia-000019.qa-000011` | IA Definition（情報・関係・状態・見つけ方） | [公式AssetのGovernance](../../Definitions/QA-000011/quality_definition.md) | 公式素材を、見た目ではなく由来・権利・許可用途を確認して利用する。UX-000030: 候補（candidate）／採用済み（approved）／開示制限（restricted）／取下げ済み（withdrawn） | ST／UAT | ST: System/E2E<br>UAT: User Acceptance | `OAG-UAT-001`、`OAG-ST-003` |
| [IA-000020](../../../03_IA/Definitions/IA-000020/ia_definition.md) | `ia-000020.qa-000006` | IA Definition（情報・関係・状態・見つけ方） | [外部Runtime境界](../../Definitions/QA-000006/quality_definition.md) | 実行基盤の一部が故障したとき、故障した境界と影響を受ける能力を見分け、利用できる範囲まで一律に停止しない。UX-000008: 各境界の利用可能（available）／停止（blocked）／不明（unknown）。全体停止と分ける | IT | IT: Direct Boundary | `ERB-IT-004`、`ERB-IT-002` |
| [IA-000021](../../../03_IA/Definitions/IA-000021/ia_definition.md) | `ia-000021.qa-000002` | IA Definition（情報・関係・状態・見つけ方） | [変更と品質状態](../../Definitions/QA-000002/quality_definition.md) | 過去の仮説・判断・学びと現在有効な意図を区別し、古い前提を現在値として利用せず、いま必要な情報を選ぶ。UX-000025: 現在有効（current）／履歴（historical）／置換済み（superseded）／不明（unknown） | IT／ST／UAT | IT: Direct Boundary<br>ST: System/E2E<br>UAT: User Acceptance | `CQS-IT-001`、`CQS-IT-002`、`CQS-ST-005`、`CQS-UAT-006` |
| [IA-000021](../../../03_IA/Definitions/IA-000021/ia_definition.md) | `ia-000021.qa-000004` | IA Definition（情報・関係・状態・見つけ方） | [投影と出所](../../Definitions/QA-000004/quality_definition.md) | 過去の仮説・判断・学びと現在有効な意図を区別し、古い前提を現在値として利用せず、いま必要な情報を選ぶ。UX-000025: 現在有効（current）／履歴（historical）／置換済み（superseded）／不明（unknown） | IT／ST／UAT | IT: Direct Boundary<br>ST: System/E2E<br>UAT: User Acceptance | `PPR-IT-001`、`PPR-IT-003`、`PPR-ST-005`、`PPR-UAT-009` |
| [IA-000022](../../../03_IA/Definitions/IA-000022/ia_definition.md) | `ia-000022.qa-000012` | IA Definition（情報・関係・状態・見つけ方） | [実行記録の公開と再利用](../../Definitions/QA-000012/quality_definition.md) | 実行、情報源、観測、記録試行、公開結果を別対象として結び、prepared／publishing／recorded／not_recorded／unknownを区別する。unknownでは同じExecution IDとAttempt IDを保持して再観測し、許可外内容を診断へ複製しない | IT／ST | IT: Direct Boundary<br>ST: System/E2E | `ERP-IT-001`、`ERP-IT-002`、`ERP-IT-003`、`ERP-ST-004`、`ERP-IT-005` |
| [IA-000023](../../../03_IA/Definitions/IA-000023/ia_definition.md) | `ia-000023.qa-000004` | IA Definition（情報・関係・状態・見つけ方） | [投影と出所](../../Definitions/QA-000004/quality_definition.md) | 固定Project Contextから五つの観点を一つの回答として再構成し、現在事実、共有分析、追加推論、期限状態、Owner Relationおよび不完全性を区別する。Project Context固有ID、項目別観測時点およびLive状態を持たず、正本変更の未反映を競合として扱う | IT／UAT | IT: Direct Boundary<br>UAT: User Acceptance | `PPR-IT-019`、`PPR-UAT-020` |
| [IA-000023](../../../03_IA/Definitions/IA-000023/ia_definition.md) | `ia-000023.qa-000007` | IA Definition（情報・関係・状態・見つけ方） | [RepositoryとFederation](../../Definitions/QA-000007/quality_definition.md) | Project ID、Repository ID、Repository Roleで投影範囲を定め、Role外Contextを推測表示せず、Principalが参照可能なRepositoryだけをFederationする。人間、AI、MCPおよびWorkbenchが同じRepository Contextを利用する | IT／ST／UAT | IT: Direct Boundary<br>ST: System/E2E<br>UAT: User Acceptance | `RFD-IT-011`、`RFD-ST-010`、`RFD-UAT-007` |
| [IA-000023](../../../03_IA/Definitions/IA-000023/ia_definition.md) | `ia-000023.qa-000013` | IA Definition（情報・関係・状態・見つけ方） | [成果物の理解と工程引継ぎ](../../Definitions/QA-000013/quality_definition.md) | 人間可読かつ機械可読な固定Markdownだけから、異なる利用者・AIが五つの観点、根拠、不完全性および次の判断を同じ意味で説明できる。結論を先に示し、詳細はOwner Relationへ辿れる | IT／ST／UAT | IT: Direct Boundary<br>ST: System/E2E<br>UAT: User Acceptance | `AUH-IT-002`、`AUH-ST-006`、`AUH-UAT-001` |

## 4. 必要義務と定義済み項目の差分

| 区分 | 件数 | 対象 | 処置 |
|---|---:|---|---|
| Required - Defined | 0（今回追加義務） | IA-000009の初回設定に関する複合義務 | 初回4項目へ定義接続。既存全体の意味監査・実行Passではない |
| Defined - Required | 0（既存集合） | 既存定義済み項目 | 初回義務は定義接続済み。既存集合の0やNot Runを新義務の充足へ流用しない |
| 試験段階Coverage | 定義接続済み／Not Run | 初回追加義務 | IT／ST／UAT、ARCHだけUTを同段階の初回項目へ接続。外部境界と実測は別に評価 |
| Relation未接続 | 0（今回追加義務） | 初回追加義務 | Source・QA定義・初回4項目とEST-ST-015へ接続。Source／Test・実行は未完了 |

## 5. 未解決事項

既存Canonical集合の分析は処置済みで、初回追加義務も定義接続済みだが、Source／Test・実行は未完了。誤った対応を除いた意味レビュー母集団は198対応行である。上流定義から合否を組み立てられない場合はQuality側で補完せず、該当工程を再開する。

## 鍵の期限なし方針の接続 — 2026-10-11

期限なし方針の現在導出（2026-10-11）: IA-000009から、資格の有効／失効／不明と現在の内容利用可否を別の情報軸にし、発行時刻を有効期限へ読み替えない。既存QA-000007／RFD-UAT-007／RFD-ST-003へ統合し、新Local ItemやUTを追加しない。更新項目の正式評価はNot Run、Source・Store・本番資格接続と新Evidenceは未成立。

## Checklist

- [x] 対象工程の全Canonical IDを一件以上処置した
- [x] 各Source固有の成功、境界、失敗、Riskおよび観測不能を分析した
- [x] 表題や共通定型句ではなくSource固有の検証義務を記録した
- [x] 意味の近い義務を統合してもSource固有条件を失っていない
- [x] 各Sourceと検証目標、試験段階およびLocal Itemを接続した — 初回義務は今回定義接続。実行Passとは別
- [x] 必要検証義務を既存Local ItemやTestから逆算していない
- [x] Required／Definedの集合差、Level不一致およびRelation不明を評価した
- [x] 上流の未確認事項をUAT、OPEN義務または上流再開へ処置した
- [x] 現行Source、TestまたはEvidenceから検証義務を逆算していない
- [x] 未解決事項、判断者および再評価契機を明示した


## 前段の初回Host設定の追加導出 — 2026-10-11

以下の未定義OPENは分析段階の履歴。現在の定義接続は次節と主表を参照する。初回分析の限定Passを今回の定義レビューへ流用しない。

IA-000009の現在の正本から、初回設定の義務を追加導出する。これは通常鍵管理とは別の義務である。既存185 Local Itemは定義済み集合の件数であり、初回設定の充足件数ではない。未定義の義務はOPENであり、定義済み項目の実行状態であるNot Runへ置き換えない。

| 観点 | 必要な確認 | 引渡し先・現在状態 |
|---|---|---|
| 工程固有の成立 | 初回設定前の非秘密の試行情報と、作成後のUUIDユーザー・Role・鍵の紐付けを区別する。表示名は表示用であり認証・権限ではない。試行、発行、記録、受け渡し、受領、通常管理接続の関係と現在状態を保持する。 | QA-000007候補／Definition・Local Item未接続OPEN |
| 正常・境界・準正常・異常・回復 | 管理状態と進行中初回記録の両方が未初期化と確認できた場合だけ開始する。欠落一件、読取り不能、破損、Lock使用中、既存ユーザー、部分状態、確認不能を未初期化へ畳まない。発行／記録不明では元試行だけ再観測し、発行・記録確定後の受け渡しまたは受領不明では作成済み管理者の既存Host指定交換へ別の明示操作として渡す。秘密再表示・自動再発行・自動再初期化を行わない。 | QA-000007候補／通常Host交換二操作への条件付き引渡し。初回設定を第三の回復操作にしない |
| 公開・権限境界 | 初回設定とその状態照会をMCPの一覧・Schema・登録・dispatchへ出さず、遠隔Workbenchも実行しない。追加認証、Repository登録・公開、内容権限の暗黙付与を追加しない。 | QA-000009候補／MCP負境界と状態照会非公開はDefinition・Local Item未接続OPEN |
| 試験段階 | ITは工程固有の情報・結果と処理境界、STは公開入口の成立と非公開境界、UATは利用者の理解・達成。UTを全Sourceへ機械追加しない。 | 必要段階の導出候補。Same／New／Mergeと項目数は次段階で確定 |
| 対象外・未評価 | 新しいStore・認可Framework、秘密の複製、暗黙登録・公開・内容付与を要求しない。初回Sourceに性能要求がないためPT／LTはN/A。Root準備の既知Filesystem EffectをEffect 0と表示しない | API・保存方式・Source／Test・実行・新Evidenceは未完了 |

差分はこのSourceに由来する1複合義務として数える。担当はQual-Lab、再評価契機は次段階のQA-000007／QA-000009定義更新。従来のLocal Item／Testから新義務を逆算せず、既存項目に同じ保証があるかを確認してから統合・分割・追加を決める。今回の分析は契約・品質の限定独立再レビュー済み、全重大度の残指摘0。初回義務の定義・実行や全体Quality Readyを示さない。

## 前回の鍵管理・認可契約の限定再導出 — 2026-10-11

以下の限定レビュー結果は初回Host設定の追加前の通常管理義務に限る。初回追加義務のDefinition接続・実行・完成の根拠にはしない。

上記の対象SourceからQA-000007へ義務を再導出した。MCP一覧・Schema・登録・dispatchの鍵操作非公開はQA-000009／EST-ST-015が所有する。通常発行・独立失効・交換を混同せず、交換4組の事前表示と3組だけの確認を維持する。新規・変更Local ItemはNot Runであり、旧Evidenceを新契約のPassへ流用しない。固定8操作の担当Roleは採用済みであり、今回の通常管理義務を再導出した。内容権限の具体語彙、具体API・Schema・Store、Source／Test／実行接続はOPEN。Profile管理のRoleは別途OPEN。

最新追加判断の検証義務は、上記の工程固有条件からQA-000007／RFD-IT-021（登録解除の保存・両読戻し）、RFD-ST-022（現在認可から結果表示まで）、RFD-IT-017／RFD-ST-016（元発行不明と別交換の相関）、RFD-UAT-007（結果と次の行動の理解）へ接続する。Architectureの純粋判定だけRFD-UT-020を維持し、全SourceへUTを追加しない。MCPではQA-000009／EST-IT-010が非鍵結果搬送、EST-ST-015が鍵操作・鍵回復参照を含む一覧／Schema／登録／dispatch非公開の負境界を所有する。185 Local Itemを増やさず、更新項目はNot Run・今回の契約・品質限定独立レビュー済み・残指摘0。RFD-UT-020だけSource／Test Symbol接続済みで、候補試験の局所実行は成功した。正式Local Item結果／Evidence評価はNot Runで、他ItemのSource／Test／実行／新Evidence接続とQuality全体完成は未成立。


## 初回Host設定のLocal Item接続 — 2026-10-11

| 引渡し先 | 定義接続 | 状態・限界 |
|---|---|---|
| QA-000007 | `RFD-IT-024`、`RFD-IT-025`、`RFD-ST-026`、`RFD-UAT-027` | Not Run。工程固有条件を保持し、ARCH以外へUTを追加しない |
| QA-000009 | EST-ST-015 | 初回設定と状態照会のMCP四面非公開をSame統合、Not Run |

前段の未接続差分は定義接続の範囲だけ解消した。Local Itemの具体的な刺激・観測・Oracle・終了後条件は各QA定義が所有する。初回4項目は既存通常管理項目の流用ではなく、同じ意味を工程ごとに重複発行しない。物理保存・受領・清掃の具体観測、Source／Test・実行・新EvidenceはOPEN。今回13文書の定義接続は契約・品質の限定独立レビュー済み・残指摘0であり、実装や全体品質の成立ではない。
