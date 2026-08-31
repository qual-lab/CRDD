# CRDD参照Toolのアーキテクチャ

Status: Implementation Candidate
Owner: Qual-Lab
Last Updated: 2026-08-31

## 対象・判断・現在状態

CRDD自身が提供するCoordinator Runtime、CheckerおよびWindowsプラットフォームアクセス部を対象とする。目的は、利用者向けの振る舞い、内部の成立方式、実装、検証、反復手順を分け、同じ情報の正本を一意にすることである。上位の[エージェント組織](../04_Agent_Organization.md)や[原則](../01_Principles.md)をTool固有の実装方式へ置き換えない。

今回の配置是正では、実装・テスト・ビルドを`40_Develop`、内部設計を本工程、入力・結果を[振る舞い仕様](../05_SPEC/01_Behavior_Specification.md)、操作順序を[作業手順](../19_Workflows/01_Coordinator_Runtime.md)へ分離する。`tools`を第二ソースや手順索引として残さない。旧入口の互換shimは追加せず、採用側へ配布するChecker本体は`template/tools/crdd-check.ts`を単一の配布正本として維持する。

配置変更後の機械検証と独立レビューの結果は[品質の現在状態](../07_Quality/01_Quality_Center.md)へ集約する。この移管を設計工程全体の完了、Runtimeの新しい実測、署名配布物の成立またはReleaseとみなさない。過去の固定実測は当時版への根拠として保持し、配置変更後の配布Identityと正式E2Eは別に確認する。

## 構成と責務

| 対象 | 所有する責務 | 接続・制限 |
|---|---|---|
| Coordinator | Repository／Revision、実行編成、Authority、隔離候補、結果・回収の調整 | [状態・資源・Lock・回復設計](coordinator/01_Architecture.md)。Providerの自己申告を実行許可にしない |
| Windowsプラットフォームアクセス | TypeScriptだけで閉じないOS観測と限定native操作 | [native境界・資源・回復の設計](platform-access/01_Architecture.md)、[脅威モデル](coordinator/02_Threat_Model.md)。一般PolicyやCLI責務をRustへ移さない |
| Checker | 文書・参照・契約の決定論的確認 | [検査範囲・配布・終了の設計](checker/01_Architecture.md)。private packageが配布正本を参照し、Checker合格を専門レビューや準拠承認にしない |
| 実装規則 | 命名、実装境界、依存、検査母集団 | [コーディング規約](99_Coding_Standards.md)。公開Schemaや固定履歴を命名整理だけで変えない |
| 品質保証 | 品質方針、検証設計、確定結果、現在状態 | [Quality Center](../07_Quality/01_Quality_Center.md)。テストコードと検証義務の正本を中央へ移さない |

Generator等の将来Toolの存在を仮定して空成果物は作らない。新しいToolでは同じ責務分離を適用し、実際の入力・利用者・実行境界から必要な設計を追加する。

## 状態・資源・信頼境界

Coordinatorの中心経路は、固定配布物とRepositoryを検証し、必要なAuthorityを確認し、Executorと独立Reviewerを隔離して実行し、候補と回収条件が成立した場合だけ結果を公開することである。正常OSと認証済みLocal Userを最小信頼境界に含め、Repository、子Process出力、ネットワーク入力や未検証成果物をAuthorityへ昇格しない。

共有・永続資源は取得者、Lock順序、失効、取消後の責務、終了確認を持つ。成功通知だけで資源不存在を推定せず、回復不明は停止・Evidence保持・処置可能なIDの返却へ閉じる。具体的な[実行順序](coordinator/01_Architecture.md#3-主実行シーケンス)、[資源所有](coordinator/01_Architecture.md#4-資源所有)、[Lock](coordinator/01_Architecture.md#5-lock順序と解放窓)、[回収順](coordinator/01_Architecture.md#7-cleanup依存順)、[不変条件](coordinator/01_Architecture.md#8-不変条件)は詳細正本から辿る。

Provider実行の方式はWindows上のDocker Desktop Linux Engineと固定公式CLI、専用認証Home、限定Egressである。API key課金へのfallback、任意外部ツール、直接Provider間spawn、正本への自動commit／push／mergeはこの配置変更で追加しない。将来のLinux／MCP／汎用Adapterは未採用候補であり、既存実装の移動と分ける。

## 検証義務・未確認範囲・引渡し

- 入力・結果・取消・回復の意味を移設前後で保持し、実producerから公開consumerまでの接続を確認する。
- import、package、CLI、CI、型・命名検査、機械可読Trace、固定成果物Path、署名manifestおよび利用案内を同じ最終配置へ揃える。
- 正常・準正常・異常の開発試験を新配置から実行する。固定Fake／契約試験と、実OS／Docker／Provider観測を混同しない。
- 署名済み配布物を必要とする操作は、変更後の固定版と成果物を再検証する。旧版の署名を新配置へ流用せず、開発デバッグに公式鍵を要求しない。
- 公開済みCHG・固定Evidenceは移動・改稿せず、その当時のPathと結果を保持する。
- 未解決の実装・観測範囲は[詳細設計の変更と検証](coordinator/01_Architecture.md#11-変更と検証)と[CHG-000015](../90_Release/Changes/CHG-000015_Coordinator_Runtime_1_0.md#1-結論と現在状態)、配置・命名移行は[CHG-000017](../90_Release/Changes/CHG-000017_Tools_Coding_Standards.md)で追跡する。

担当はQual-LabのRuntime保守と親Coordinator。完成条件を満たさない範囲を将来候補へ送らず、変更後の固定版で独立Architecture／Security、Test／UX、Document／Gap／Impact／Conformanceの結果を統合して人間の採用・Release判断へ渡す。
