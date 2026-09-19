# UX工程のQuality分析

成果物種別: Quality分析（UX観点）
分析Origin: `UX`
状態: Canonical
維持責任者: Qual-Lab

## 1. 目的

UX工程が定義した成立条件を全件処置し、成功の意味、失敗またはRisk、検証義務および統合候補を、後から推測せずQuality Integrationへ渡す。

## 2. 全件Coverage Index

この表はCanonical IDの処置漏れを防ぐ索引であり、意味分析の正本ではない。Source固有の成立条件、失敗、RiskおよびLocal Itemとの関係は第3章で示す。

| Source ID | 成功の意味 | 検証義務 | 統合先の検証目標 | 試験段階 | 試験種別 | 処置状態 |
|---|---|---|---|---|---|---|
| [UX-000001](../../../02_UX/Definitions/UX-000001/ux_definition.md) | 意味レビューへ集中できる事前確認 | 利用者が「意味レビューへ集中できる事前確認」を達成でき、重要な失敗を正常状態と誤認しないことを確認する | [Repositoryと契約移行](../../Definitions/QA-000001/quality_definition.md) | UT／IT／UAT | Contract／Traceability | Mapped |
| [UX-000002](../../../02_UX/Definitions/UX-000002/ux_definition.md) | 委任範囲と権限を理解して任せる | 利用者が「委任範囲と権限を理解して任せる」を達成でき、重要な失敗を正常状態と誤認しないことを確認する | [Project Runtime lifecycle](../../Definitions/QA-000003/quality_definition.md) | IT／ST／UAT | Lifecycle／Fault | Mapped |
| [UX-000003](../../../02_UX/Definitions/UX-000003/ux_definition.md) | 委任中の状態と判断要否を理解する | 利用者が「委任中の状態と判断要否を理解する」を達成でき、重要な失敗を正常状態と誤認しないことを確認する | [Project Runtime lifecycle](../../Definitions/QA-000003/quality_definition.md) | ST／UAT | Lifecycle／Fault | Mapped |
| [UX-000004](../../../02_UX/Definitions/UX-000004/ux_definition.md) | 失敗後の再試行・回復を選ぶ | 利用者が「失敗後の再試行・回復を選ぶ」を達成でき、重要な失敗を正常状態と誤認しないことを確認する | [Project Runtime lifecycle](../../Definitions/QA-000003/quality_definition.md) | IT／ST／UAT | Lifecycle／Fault | Mapped |
| [UX-000005](../../../02_UX/Definitions/UX-000005/ux_definition.md) | 目的と受入条件で節目を委ねる | 利用者が「目的と受入条件で節目を委ねる」を達成でき、重要な失敗を正常状態と誤認しないことを確認する | [Project Runtime lifecycle](../../Definitions/QA-000003/quality_definition.md) | ST／UAT | Lifecycle／Fault | Mapped |
| [UX-000006](../../../02_UX/Definitions/UX-000006/ux_definition.md) | 実行事実を根拠付きで振り返る | 利用者が「実行事実を根拠付きで振り返る」を達成でき、重要な失敗を正常状態と誤認しないことを確認する | [投影と出所](../../Definitions/QA-000004/quality_definition.md) | IT／UAT | Information／State | Mapped |
| [UX-000007](../../../02_UX/Definitions/UX-000007/ux_definition.md) | 内部変更後も成立済み能力を安全に使う | 利用者が「内部変更後も成立済み能力を安全に使う」を達成でき、重要な失敗を正常状態と誤認しないことを確認する | [Repositoryと契約移行](../../Definitions/QA-000001/quality_definition.md) | IT／UAT | Contract／Traceability | Mapped |
| [UX-000008](../../../02_UX/Definitions/UX-000008/ux_definition.md) | 故障した境界と影響範囲を理解する | 利用者が「故障した境界と影響範囲を理解する」を達成でき、重要な失敗を正常状態と誤認しないことを確認する | [外部Runtime境界](../../Definitions/QA-000006/quality_definition.md) | IT／ST／UAT | External Boundary／Fault | Mapped |
| [UX-000009](../../../02_UX/Definitions/UX-000009/ux_definition.md) | プロジェクトの現在地を根拠と不完全性付きで理解する | 利用者が「プロジェクトの現在地を根拠と不完全性付きで理解する」を達成でき、重要な失敗を正常状態と誤認しないことを確認する | [投影と出所](../../Definitions/QA-000004/quality_definition.md) | IT／ST／UAT | Information／State | Mapped |
| [UX-000010](../../../02_UX/Definitions/UX-000010/ux_definition.md) | リポジトリ単独で日常作業を続ける | 利用者が「リポジトリ単独で日常作業を続ける」を達成でき、重要な失敗を正常状態と誤認しないことを確認する | [Repositoryと契約移行](../../Definitions/QA-000001/quality_definition.md)<br>[RepositoryとFederation](../../Definitions/QA-000007/quality_definition.md) | UT／IT／UAT | Contract／Traceability／Identity | Mapped |
| [UX-000011](../../../02_UX/Definitions/UX-000011/ux_definition.md) | プロジェクト・リポジトリ・基点フォルダを区別して対象を選ぶ | 利用者が「プロジェクト・リポジトリ・基点フォルダを区別して対象を選ぶ」を達成でき、重要な失敗を正常状態と誤認しないことを確認する | [RepositoryとFederation](../../Definitions/QA-000007/quality_definition.md) | IT／ST／UAT | Identity／Security | Mapped |
| [UX-000012](../../../02_UX/Definitions/UX-000012/ux_definition.md) | 入口を変えても同じ仕事を続ける | 利用者が「入口を変えても同じ仕事を続ける」を達成でき、重要な失敗を正常状態と誤認しないことを確認する | [外部送信とTransport](../../Definitions/QA-000009/quality_definition.md) | IT／ST／UAT | Transport／Security | Mapped |
| [UX-000013](../../../02_UX/Definitions/UX-000013/ux_definition.md) | 許可された作業領域だけをリモート利用する | 利用者が「許可された作業領域だけをリモート利用する」を達成でき、重要な失敗を正常状態と誤認しないことを確認する | [RepositoryとFederation](../../Definitions/QA-000007/quality_definition.md) | ST／UAT | Identity／Security | Mapped |
| [UX-000014](../../../02_UX/Definitions/UX-000014/ux_definition.md) | Meeting内容を候補化し採否を判断する | 利用者が「Meeting内容を候補化し採否を判断する」を達成でき、重要な失敗を正常状態と誤認しないことを確認する | [候補の昇格](../../Definitions/QA-000005/quality_definition.md) | IT／UAT | Workflow／Authority | Mapped |
| [UX-000015](../../../02_UX/Definitions/UX-000015/ux_definition.md) | 複数プロジェクトを根拠付きで比較する | 利用者が「複数プロジェクトを根拠付きで比較する」を達成でき、重要な失敗を正常状態と誤認しないことを確認する | [投影と出所](../../Definitions/QA-000004/quality_definition.md) | IT／ST／UAT | Information／State | Mapped |
| [UX-000016](../../../02_UX/Definitions/UX-000016/ux_definition.md) | 仕事に必要な標準ツールを迷わず選ぶ | 利用者が「仕事に必要な標準ツールを迷わず選ぶ」を達成でき、重要な失敗を正常状態と誤認しないことを確認する | [Repositoryと契約移行](../../Definitions/QA-000001/quality_definition.md) | IT／UAT | Contract／Traceability | Mapped |
| [UX-000017](../../../02_UX/Definitions/UX-000017/ux_definition.md) | 実行時データを安全に保持・清掃する | 利用者が「実行時データを安全に保持・清掃する」を達成でき、重要な失敗を正常状態と誤認しないことを確認する | [Runtime Data lifecycle](../../Definitions/QA-000008/quality_definition.md) | IT／UAT | State／Recovery | Mapped |
| [UX-000018](../../../02_UX/Definitions/UX-000018/ux_definition.md) | AIモデル構成を安全に更新・選択する | 利用者が「AIモデル構成を安全に更新・選択する」を達成でき、重要な失敗を正常状態と誤認しないことを確認する | [外部Runtime境界](../../Definitions/QA-000006/quality_definition.md) | IT／ST／UAT | External Boundary／Fault | Mapped |
| [UX-000019](../../../02_UX/Definitions/UX-000019/ux_definition.md) | 必要な情報を渡し結果を同じ仕事へ戻す | 利用者が「必要な情報を渡し結果を同じ仕事へ戻す」を達成でき、重要な失敗を正常状態と誤認しないことを確認する | [外部送信とTransport](../../Definitions/QA-000009/quality_definition.md) | ST／UAT | Transport／Security | Mapped |
| [UX-000020](../../../02_UX/Definitions/UX-000020/ux_definition.md) | 利用環境の信頼方針で実行基盤を選ぶ | 利用者が「利用環境の信頼方針で実行基盤を選ぶ」を達成でき、重要な失敗を正常状態と誤認しないことを確認する | [成果物IntegrityとTrust](../../Definitions/QA-000010/quality_definition.md) | UT／IT／ST／UAT | Integrity／Security | Mapped |
| [UX-000021](../../../02_UX/Definitions/UX-000021/ux_definition.md) | 切断後も同じ依頼へ戻る | 利用者が「切断後も同じ依頼へ戻る」を達成でき、重要な失敗を正常状態と誤認しないことを確認する | [Project Runtime lifecycle](../../Definitions/QA-000003/quality_definition.md)<br>[外部送信とTransport](../../Definitions/QA-000009/quality_definition.md) | IT／ST／UAT | Lifecycle／Fault／Transport／Security | Mapped |
| [UX-000022](../../../02_UX/Definitions/UX-000022/ux_definition.md) | 残存資源を安全に回復・清掃する | 利用者が「残存資源を安全に回復・清掃する」を達成でき、重要な失敗を正常状態と誤認しないことを確認する | [Project Runtime lifecycle](../../Definitions/QA-000003/quality_definition.md)<br>[Runtime Data lifecycle](../../Definitions/QA-000008/quality_definition.md) | IT／ST／UAT | Lifecycle／Fault／State／Recovery | Mapped |
| [UX-000023](../../../02_UX/Definitions/UX-000023/ux_definition.md) | 監査・是正・判断を一つの改訂版で閉じる | 利用者が「監査・是正・判断を一つの改訂版で閉じる」を達成でき、重要な失敗を正常状態と誤認しないことを確認する | [変更と品質状態](../../Definitions/QA-000002/quality_definition.md) | IT／ST／UAT | Governance／Traceability | Mapped |
| [UX-000024](../../../02_UX/Definitions/UX-000024/ux_definition.md) | 外部利用の送信・持帰り・昇格を制御する | 利用者が「外部利用の送信・持帰り・昇格を制御する」を達成でき、重要な失敗を正常状態と誤認しないことを確認する | [候補の昇格](../../Definitions/QA-000005/quality_definition.md)<br>[外部送信とTransport](../../Definitions/QA-000009/quality_definition.md) | IT／ST／UAT | Workflow／Authority／Transport／Security | Mapped |
| [UX-000025](../../../02_UX/Definitions/UX-000025/ux_definition.md) | 過去の推論情報と現在値を区別する | 利用者が「過去の推論情報と現在値を区別する」を達成でき、重要な失敗を正常状態と誤認しないことを確認する | [投影と出所](../../Definitions/QA-000004/quality_definition.md) | IT／UAT | Information／State | Mapped |
| [UX-000026](../../../02_UX/Definitions/UX-000026/ux_definition.md) | 試験層と現在の保証範囲を理解して選ぶ | 利用者が「試験層と現在の保証範囲を理解して選ぶ」を達成でき、重要な失敗を正常状態と誤認しないことを確認する | [変更と品質状態](../../Definitions/QA-000002/quality_definition.md) | IT／ST／UAT | Governance／Traceability | Mapped |
| [UX-000027](../../../02_UX/Definitions/UX-000027/ux_definition.md) | 物語と構造から文書の意味を理解する | 読者が確認項目を組み立て直さず、問題から判断まで自然な順で理解できる | [成果物の理解と工程引継ぎ](../../Definitions/QA-000013/quality_definition.md) | IT／ST／UAT | Human Understanding | Mapped |
| [UX-000028](../../../02_UX/Definitions/UX-000028/ux_definition.md) | 工程固有の図から意図を引き継ぐ | 読者が工程固有の図から関係、流れ、状態と引継ぐ意図を理解できる | [成果物の理解と工程引継ぎ](../../Definitions/QA-000013/quality_definition.md) | IT／ST／UAT | Visual Communication／Handoff | Mapped |
| [UX-000029](../../../02_UX/Definitions/UX-000029/ux_definition.md) | 作業・変更・根拠・品質を迷わず辿る | 利用者が「作業・変更・根拠・品質を迷わず辿る」を達成でき、重要な失敗を正常状態と誤認しないことを確認する | [変更と品質状態](../../Definitions/QA-000002/quality_definition.md) | IT／ST／UAT | Governance／Traceability | Mapped |
| [UX-000030](../../../02_UX/Definitions/UX-000030/ux_definition.md) | 公式素材を権利と用途を確認して使う | 利用者が「公式素材を権利と用途を確認して使う」を達成でき、重要な失敗を正常状態と誤認しないことを確認する | [公式AssetのGovernance](../../Definitions/QA-000011/quality_definition.md) | UAT | Governance／Rights Review | Mapped |
| [UX-000031](../../../02_UX/Definitions/UX-000031/ux_definition.md) | 公式の識別と保証を混同せず見分ける | 利用者が「公式の識別と保証を混同せず見分ける」を達成でき、重要な失敗を正常状態と誤認しないことを確認する | [成果物IntegrityとTrust](../../Definitions/QA-000010/quality_definition.md) | UT／IT／ST／UAT | Integrity／Security | Mapped |
| [UX-000032](../../../02_UX/Definitions/UX-000032/ux_definition.md) | 実行事実を安全に記録して結果を確かめる | 記録する側が一度の依頼で記録結果を見分け、重複・上書き・許可外記録を起こさず再観測または次の処置へ進めることを確認する | [実行記録の公開と再利用](../../Definitions/QA-000012/quality_definition.md) | IT／ST／UAT | Persistence／Concurrency／Recovery／Information | Mapped |

## 3. 検証目標への統合

| Source ID | 検証目標 | 保持する固有条件 | 試験段階 | 対応Local Item |
|---|---|---|---|---|
| [UX-000001](../../../02_UX/Definitions/UX-000001/ux_definition.md) | [Repositoryと契約移行](../../Definitions/QA-000001/quality_definition.md) | 同じ対象と条件なら機械的不備と修正箇所を先に理解し、意味レビューへ集中できる。重要場面「機械指摘と意味判断を分ける」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。結果の決定性、対象箇所、理由および意味判断との境界を確認する | UT／IT／UAT | `RCM-01`、`RCM-04`、`RCM-06` |
| [UX-000002](../../../02_UX/Definitions/UX-000002/ux_definition.md) | [Project Runtime lifecycle](../../Definitions/QA-000003/quality_definition.md) | 実行前に誰へ何をどこまで任せるかを理解し、暗黙の範囲拡張なく仕事を委ねられる。候補結果を安心して受け取り、停止・失敗後も入力、取消、回復の選択を人間が保持できる。重要場面「外部作用（Effect）の前の委任境界」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。対象範囲の拡張、未承認決定権限および不明な実行主体を反証する | IT／ST／UAT | `PRL-04`、`PRL-05`、`PRL-10` |
| [UX-000003](../../../02_UX/Definitions/UX-000003/ux_definition.md) | [Project Runtime lifecycle](../../Definitions/QA-000003/quality_definition.md) | 内部ログを読まず、実行中・待機・停止と現在必要な判断を理解できる。現在状態から、同じ処理の再試行、残存状態の回復、同じ目的・節目への再開のどれを選ぶべきか理解できる。現在状態に応じて、待つ、追加情報を入力する、取り消す、回復するのどれを行うかを人間が選べる。重要場面「応答がなく待機か停止かを判断する場面」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。無反応、偽の進捗、AI提供元差の誤表示、停止中の実行表示、および再試行・回復・再開を取り違える案内を反証する | ST／UAT | `PRL-02`、`PRL-04` |
| [UX-000004](../../../02_UX/Definitions/UX-000004/ux_definition.md) | [Project Runtime lifecycle](../../Definitions/QA-000003/quality_definition.md) | 失敗後に状態確認、再試行、回復および清掃を取り違えず、外部作用（Effect）の二重実行を避けて次の行動を選べる。重要場面「同じ外部作用（Effect）を再発行する直前」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。無条件Retry、古い決定権限、AI提供元差の隠蔽および外部作用（Effect）の二重実行を反証する | IT／ST／UAT | `PRL-04`、`PRL-05`、`PRL-02` |
| [UX-000005](../../../02_UX/Definitions/UX-000005/ux_definition.md) | [Project Runtime lifecycle](../../Definitions/QA-000003/quality_definition.md) | 内部タスクを逐次操作せず、目的・受入条件・統合状態から節目の完成と必要な判断を理解できる。節目が停止した場合も、受入条件と現在状態を失わず、同じ目的・節目・判断点へ再開するかを判断できる。重要場面「タスク成功と節目完成を区別する」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。タスク数や部分成功を完成へ畳む表示と、停止後に目的・受入条件・判断点を失った別の節目として再開する挙動を反証する | ST／UAT | `PRL-02`、`PRL-01`、`PRL-10` |
| [UX-000006](../../../02_UX/Definitions/UX-000006/ux_definition.md) | [投影と出所](../../Definitions/QA-000004/quality_definition.md) | 実行主体が異なっても、観測事実・未観測・評価・改善候補を出所と時点付きで区別して振り返れる。重要場面「未観測値を含む実行事実の取得」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。空値の正常化、評価の事実化および出所のない比較を反証する | IT／UAT | `PPR-04`、`PPR-03`、`PPR-08` |
| [UX-000007](../../../02_UX/Definitions/UX-000007/ux_definition.md) | [Repositoryと契約移行](../../Definitions/QA-000001/quality_definition.md) | 責務・契約・接続部の変更後も、維持・変更・廃止された能力を理解し、取り残しのない結果を安全に利用・公開できる。重要場面「変更を完了・公開可能と判断する直前」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。主経路だけの移行、旧契約残存および根拠のない旧処理削除を反証する | IT／UAT | `RCM-04`、`RCM-03`、`RCM-06` |
| [UX-000008](../../../02_UX/Definitions/UX-000008/ux_definition.md) | [外部Runtime境界](../../Definitions/QA-000006/quality_definition.md) | AI実行環境の認証・起動・取消・結果取得・回復のどこに違いがあり、故障時に何が利用可能かを理解できる。重要場面「一つの失敗を全体障害と判断する直前」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。認証・起動・取消・結果取得・回復の違いを同じ失敗へ畳む表示と、利用可能な機能まで停止する判断を反証する | IT／ST／UAT | `ERB-01`、`ERB-05`、`ERB-07` |
| [UX-000009](../../../02_UX/Definitions/UX-000009/ux_definition.md) | [投影と出所](../../Definitions/QA-000004/quality_definition.md) | 物理構成を意識せずプロジェクトの現在地を理解し、欠測・制限・競合・古さと情報源へ戻れる。不足、競合、古さを確認したうえで、次の判断へ進める。重要場面「現在の表示を信じる直前」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。partial、stale、restricted、conflictingおよび未観測値の誤認を反証する | IT／ST／UAT | `PPR-02`、`PPR-05`、`PPR-07` |
| [UX-000010](../../../02_UX/Definitions/UX-000010/ux_definition.md) | [Repositoryと契約移行](../../Definitions/QA-000001/quality_definition.md) | 横断機能、Commit済み状態または特定の履歴実装を前提にせず、現在リポジトリで日常作業を開始・継続できる。重要場面「横断利用へ切り替える判断」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。CROS未設定、未Commitまたは履歴管理の接続部障害による無関係な作業停止を反証する | UT／IT／UAT | `RCM-04`、`RCM-01`、`RCM-06` |
| [UX-000010](../../../02_UX/Definitions/UX-000010/ux_definition.md) | [RepositoryとFederation](../../Definitions/QA-000007/quality_definition.md) | 横断機能、Commit済み状態または特定の履歴実装を前提にせず、現在リポジトリで日常作業を開始・継続できる。重要場面「横断利用へ切り替える判断」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。CROS未設定、未Commitまたは履歴管理の接続部障害による無関係な作業停止を反証する | IT／UAT | `RFD-05`、`RFD-06`、`RFD-07`、`RFD-09` |
| [UX-000011](../../../02_UX/Definitions/UX-000011/ux_definition.md) | [RepositoryとFederation](../../Definitions/QA-000007/quality_definition.md) | 論理プロジェクトを一つに見ながら、参照・実行・回復の対象リポジトリと基点フォルダを取り違えずに選べる。重要場面「外部作用（Effect）対象を確定する直前」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。名前やパスの類似だけから対象識別情報を推定する操作を反証する | IT／ST／UAT | `RFD-04`、`RFD-01`、`RFD-07` |
| [UX-000012](../../../02_UX/Definitions/UX-000012/ux_definition.md) | [外部送信とTransport](../../Definitions/QA-000009/quality_definition.md) | stdio MCPとlocalhost HTTPのどちらでも、同じ入力・権限・状態・結果で仕事を続けられる。失敗時は、失敗した通信方式と外部作用（Effect）が発行されたかを区別して、入口変更や再処置を判断できる。重要場面「入口を切り替えて同じ仕事を開始・継続する場面」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。stdio MCPとlocalhost HTTPで入力・権限判断・状態・結果が変わること、および失敗した通信方式と外部作用の発行有無を識別できない表示を反証する | IT／ST／UAT | `EST-01`、`EST-05`、`EST-07` |
| [UX-000013](../../../02_UX/Definitions/UX-000013/ux_definition.md) | [RepositoryとFederation](../../Definitions/QA-000007/quality_definition.md) | 接続元や接続資格情報が変わっても、現在許可された作業領域だけを利用し、利用不能理由と管理能力を内容閲覧から区別できる。重要場面「利用可能情報を表示する時」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。存在漏えい、一律の追加許可による解錠、古い利用許可範囲および管理能力からの閲覧権限推定を反証する | ST／UAT | `RFD-04`、`RFD-03`、`RFD-07` |
| [UX-000014](../../../02_UX/Definitions/UX-000014/ux_definition.md) | [候補の昇格](../../Definitions/QA-000005/quality_definition.md) | 会話・観察・仮説・候補・決定を区別し、既存Topicとの関係を根拠付きで判断して所有正本へ戻せる。重要場面「候補を採用または却下する場面」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。会話の自動採用と文字列一致だけの統合・分割を反証する | IT／UAT | `CPR-02`、`CPR-01` |
| [UX-000015](../../../02_UX/Definitions/UX-000015/ux_definition.md) | [投影と出所](../../Definitions/QA-000004/quality_definition.md) | 許可されたプロジェクトの重要差を比較し、網羅範囲と根拠を保ったまま必要なプロジェクトだけを掘り下げられる。重要場面「要約から優先判断へ進む直前」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。非開示プロジェクトの存在漏えい、単一Score断定および網羅範囲差の消去を反証する | IT／ST／UAT | `PPR-05`、`PPR-02`、`PPR-07` |
| [UX-000016](../../../02_UX/Definitions/UX-000016/ux_definition.md) | [Repositoryと契約移行](../../Definitions/QA-000001/quality_definition.md) | 現在リポジトリの固定Commitと目的に対応する標準ツール／実行基盤を見つけ、別リリースを手動照合せず安全に選べる。重要場面「発見したツール／実行基盤を起動する直前」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。fresh clone、submodule、版不一致、欠落実行基盤、改ざんManifest、未登録能力の推測表示および一覧からの決定権限発行を反証する | IT／UAT | `RCM-04`、`RCM-05`、`RCM-06`、`RCM-10` |
| [UX-000017](../../../02_UX/Definitions/UX-000017/ux_definition.md) | [Runtime Data lifecycle](../../Definitions/QA-000008/quality_definition.md) | 保存場所の内部構造を推測せず、保持すべき状態と一時物を区別して安全に作業を継続・終了できる。重要場面「永続化または削除の直前」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。用途不明の書込み、名前や時間だけの削除および別リポジトリへの波及を反証する | IT／UAT | `RDL-03`、`RDL-04`、`RDL-06` |
| [UX-000018](../../../02_UX/Definitions/UX-000018/ux_definition.md) | [外部Runtime境界](../../Definitions/QA-000006/quality_definition.md) | 新しいモデルへ追随するとき、コード改修を待たず検証済み構成を更新し、実効選択と再選定理由を理解できる。重要場面「AI提供元で実行する前のモデル確定」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。未知設定の黙示代替、非対応モデルの実行可能表示および無説明選択を反証する | IT／ST／UAT | `ERB-05`、`ERB-04`、`ERB-06`、`ERB-07` |
| [UX-000019](../../../02_UX/Definitions/UX-000019/ux_definition.md) | [外部送信とTransport](../../Definitions/QA-000009/quality_definition.md) | 必要最小限の情報を出所・現行性・許可付きで渡し、相関・完全性付きの結果を同じタスクへ戻せる。重要場面「外部境界へ情報を出す直前」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。全量投入、秘密情報混入、情報捏造、別タスク結果混入およびAgent完了の自動採用を反証する | ST／UAT | `EST-05`、`EST-03`、`EST-08` |
| [UX-000020](../../../02_UX/Definitions/UX-000020/ux_definition.md) | [成果物IntegrityとTrust](../../Definitions/QA-000010/quality_definition.md) | 準拠、改ざん有無、配布者、公式表示および実行許可を区別し、自分の環境の方針で公式版・派生版・組織版を選べる。重要場面「実行を信頼すると判断する場面」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。一つの署名やブランド表示への全保証集約とQual-Lab署名だけの実行資格化を反証する | UT／IT／ST／UAT | `AIT-01`、`AIT-04`、`AIT-05`、`AIT-06` |
| [UX-000021](../../../02_UX/Definitions/UX-000021/ux_definition.md) | [Project Runtime lifecycle](../../Definitions/QA-000003/quality_definition.md) | 応答喪失後に新規実行せず、現在の利用権限で同じ依頼の状態・結果・回復義務へ戻れる。重要場面「再実行するか判断する直前」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。再接続時の外部作用（Effect）の二重実行、古いセッションの決定権限および別依頼への誤結合を反証する | IT／ST | `PRL-04`、`PRL-05` |
| [UX-000021](../../../02_UX/Definitions/UX-000021/ux_definition.md) | [外部送信とTransport](../../Definitions/QA-000009/quality_definition.md) | 応答喪失後に新規実行せず、現在の利用権限で同じ依頼の状態・結果・回復義務へ戻れる。重要場面「再実行するか判断する直前」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。再接続時の外部作用（Effect）の二重実行、古いセッションの決定権限および別依頼への誤結合を反証する | IT／ST／UAT | `EST-05`、`EST-04`、`EST-09` |
| [UX-000022](../../../02_UX/Definitions/UX-000022/ux_definition.md) | [Project Runtime lifecycle](../../Definitions/QA-000003/quality_definition.md) | 失敗後に残存の由来・影響・再入場先を理解し、必要な回復を行って不存在まで確認できる。重要場面「削除または回復を選ぶ場面」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。清掃要求だけの完了表示、別処理の巻込みおよび不明状態での削除を反証する | ST／UAT | `PRL-04`、`PRL-03`、`PRL-02` |
| [UX-000022](../../../02_UX/Definitions/UX-000022/ux_definition.md) | [Runtime Data lifecycle](../../Definitions/QA-000008/quality_definition.md) | 失敗後に残存の由来・影響・再入場先を理解し、必要な回復を行って不存在まで確認できる。重要場面「削除または回復を選ぶ場面」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。清掃要求だけの完了表示、別処理の巻込みおよび不明状態での削除を反証する | IT／ST／UAT | `RDL-02`、`RDL-03`、`RDL-06` |
| [UX-000023](../../../02_UX/Definitions/UX-000023/ux_definition.md) | [変更と品質状態](../../Definitions/QA-000002/quality_definition.md) | 合意した条件、適用先、反証、未処置および現在必要な人間判断を一つの改訂版で理解して収束できる。重要場面「再レビューへ固定候補を渡す直前」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。指摘の小出し適用、解消済み判断の再要求および一部是正の完成表示を反証する | IT／ST／UAT | `CQS-04`、`CQS-01`、`CQS-05`、`CQS-06` |
| [UX-000024](../../../02_UX/Definitions/UX-000024/ux_definition.md) | [候補の昇格](../../Definitions/QA-000005/quality_definition.md) | 外部作用（Effect）の前に送信先・目的・操作・情報分類・許可範囲を理解し、外部情報・反応・依存新版を出典付き候補として扱える。重要場面「外部作用（Effect）の前と結果昇格時」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。接続済み・過去同意からの包括許可、不要情報送信、外部反応・依存新版の要求／因果／方針への自動昇格を反証する | IT／UAT | `CPR-03`、`CPR-01`、`CPR-02` |
| [UX-000024](../../../02_UX/Definitions/UX-000024/ux_definition.md) | [外部送信とTransport](../../Definitions/QA-000009/quality_definition.md) | 外部作用（Effect）の前に送信先・目的・操作・情報分類・許可範囲を理解し、外部情報・反応・依存新版を出典付き候補として扱える。重要場面「外部作用（Effect）の前と結果昇格時」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。接続済み・過去同意からの包括許可、不要情報送信、外部反応・依存新版の要求／因果／方針への自動昇格を反証する | IT／ST／UAT | `EST-05`、`EST-03`、`EST-04`、`EST-06` |
| [UX-000025](../../../02_UX/Definitions/UX-000025/ux_definition.md) | [投影と出所](../../Definitions/QA-000004/quality_definition.md) | 当時の仮説・判断・学びと現在有効な意図を区別し、必要な情報を選べる。重要場面「判断理由をAIへ渡す場面」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。遡及上書き、古い仮説の現在値化および履歴全量の無選択投入を反証する | IT／UAT | `PPR-04`、`PPR-03`、`PPR-09` |
| [UX-000026](../../../02_UX/Definitions/UX-000026/ux_definition.md) | [変更と品質状態](../../Definitions/QA-000002/quality_definition.md) | 各試験層が確認したこと・未確認範囲・時間や費用を理解し、必要な検証と高負荷試験の実行有無を選べる。重要場面「外部境界を結合する各段階」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。一部Passからの全体品質推定、単発成功だけの一連の状態変化保証および未指示の高負荷実行を反証する | IT／ST／UAT | `CQS-04`、`CQS-02`、`CQS-05`、`CQS-07` |
| [UX-000027](../../../02_UX/Definitions/UX-000027/ux_definition.md) | [成果物の理解と工程引継ぎ](../../Definitions/QA-000013/quality_definition.md) | 課題と判断の物語を理解してから、表・図で条件と関係を確認し、次の行動へ進める。重要場面「判断理由と条件を結び付ける場面」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。確認項目順、専門語だけの説明および情報削減による見せかけの可読性を反証する | IT／ST／UAT | `AUH-04`、`AUH-02`、`AUH-01` |
| [UX-000028](../../../02_UX/Definitions/UX-000028/ux_definition.md) | [成果物の理解と工程引継ぎ](../../Definitions/QA-000013/quality_definition.md) | 工程固有の図から全体像・関係・状態差・未接続を理解し、後工程で意図を再発明せずに引き継げる。重要場面「下流義務へ変換する場面」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。図の黙示省略、機械的で読めない記法および図と試験の断絶を反証する | IT／ST／UAT | `AUH-05`、`AUH-03`、`AUH-01` |
| [UX-000029](../../../02_UX/Definitions/UX-000029/ux_definition.md) | [変更と品質状態](../../Definitions/QA-000002/quality_definition.md) | 未完了、変更理由、全影響パス、成立根拠および現在品質を役割の違いとともに辿れる。重要場面「変更の影響漏れを確認する場面」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。責任者の混同、代表パスだけの表示、根拠の遡及上書きおよびGit差分への丸投げを反証する | IT／ST／UAT | `CQS-02`、`CQS-04`、`CQS-05`、`CQS-06` |
| [UX-000030](../../../02_UX/Definitions/UX-000030/ux_definition.md) | [公式AssetのGovernance](../../Definitions/QA-000011/quality_definition.md) | 公式素材の出所・原本・派生物・利用条件を確認し、許可された用途で安心して収載・再利用できる。重要場面「公式用途へ採用する直前」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。見た目からの信頼保証推定、権利不明素材の収載および用途外再配布を反証する | UAT | `OAG-01`、`OAG-04` |
| [UX-000031](../../../02_UX/Definitions/UX-000031/ux_definition.md) | [成果物IntegrityとTrust](../../Definitions/QA-000010/quality_definition.md) | 公式入口や素材を識別でき、同時に署名・準拠・品質・発行元への信頼の根拠は別に確認できる。重要場面「公式表示を信頼判断へ用いる直前」で、視覚的な公式らしさを保証の証明と誤認しない。表示媒体や入口が変わっても、識別用途と保証根拠の境界を維持する。公式／非公式表示、保証根拠の欠落、見た目だけの信頼推定および識別不能な入口を反証する | UT／IT／ST／UAT | `AIT-01`、`AIT-04`、`AIT-05`、`AIT-06` |
| [UX-000032](../../../02_UX/Definitions/UX-000032/ux_definition.md) | [実行記録の公開と再利用](../../Definitions/QA-000012/quality_definition.md) | 作成側が同じ実行、情報源、観測時点、観測状態および記録試行を対応付けて一度だけ依頼する。複数作成側、再送、並行書込みまたは途中失敗でも誤統合せず、結果不明では同じ実行と試行を再観測する。生出力、秘密情報または不要な個人情報を無条件に含めない | IT／ST／UAT | `ERP-01`、`ERP-02`、`ERP-03`、`ERP-04`、`ERP-05`、`ERP-07` |

## 4. 継承した未確認事項の処置

全32件のUX定義が保持する「後続の実利用確認が必要」という未確認事項は、Definition本文に残すだけで完了にしない。次の利用者受入Local Itemへ接続し、実行前は未確認のまま、実行後にだけ利用者成果の成立を評価する。複数の検証目標へまたがるUXは、それぞれの境界で確認する。

| 利用者受入Local Item | 対象UX | 確認する利用者成果 |
|---|---|---|
| `RCM-06` | `UX-000001`、`UX-000007`、`UX-000010`、`UX-000016` | 機械確認、契約移行、単独利用およびTool発見を利用者が理解できる |
| `CQS-06` | `UX-000023`、`UX-000029` | 監査・変更・根拠・現在品質から次の判断を選べる |
| `CQS-07` | `UX-000026` | 試験層、未確認範囲、費用と時間から必要な検証を選べる |
| `PRL-02` | `UX-000003`、`UX-000004`、`UX-000022` | 待機、失敗および残存時に再試行・回復・再開を選べる |
| `PRL-10` | `UX-000002`、`UX-000005` | 委任範囲、Objective受入およびMilestone判断を区別できる |
| `PPR-07` | `UX-000009`、`UX-000015` | 不完全性と根拠を理解して単一・複数Projectを判断できる |
| `PPR-08` | `UX-000006` | 観測事実、未観測および評価候補を区別できる |
| `PPR-09` | `UX-000025` | 現在値、履歴および置換済み情報を区別できる |
| `CPR-02` | `UX-000014`、`UX-000024` | 候補の採用範囲と外部結果の昇格を人間が判断できる |
| `ERB-07` | `UX-000008`、`UX-000018` | 故障境界、影響範囲およびAIモデル選択理由を理解できる |
| `RFD-07` | `UX-000011`、`UX-000013` | Project、Repository、基点フォルダおよび許可範囲を区別できる |
| `RDL-06` | `UX-000017`、`UX-000022` | 実行時データと残存資源の保持・回復・清掃を選べる |
| `EST-07` | `UX-000012` | 入口を変えても同じ仕事を開始・継続できる |
| `EST-08` | `UX-000019` | 送信範囲と帰還結果の再利用可否を判断できる |
| `EST-09` | `UX-000021` | 切断後に新規実行せず同じ依頼へ戻れる |
| `EST-06` | `UX-000024` | 外部送信、拒否、取消および結果処置を判断できる |
| `AIT-06` | `UX-000020`、`UX-000031` | Trust根拠と公式表示を分け、採用・拒否・保留を判断できる |
| `OAG-01` | `UX-000030` | 権利と用途を確認して公式素材の収載を判断できる |
| `ERP-07` | `UX-000032` | 実行記録の出所と欠測を理解して再利用可否を判断できる |
| `AUH-01` | `UX-000027`、`UX-000028` | 成果物の物語と図から意味と工程引継ぎを説明できる |

実利用確認の未実行は、UX定義の不採用やQuality設計不足を意味しない。ただし、実行前に利用者成果を`Passed`へ昇格してはならない。Local Itemで新しい不足を検出した場合は、Quality側で意味を補わず対象UXを再開する。

## 5. 未解決事項

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
