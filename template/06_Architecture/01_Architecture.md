# アーキテクチャ（Architecture）

工程規則: `00_CRDD/27_Architecture.md`
維持責任者: （記入）
基本決定権限: （記入）
項目別例外Authority: `N/A: 基本決定権限と異なる項目がない`、または`項目: 決定主体／参照`を記入

本書は`06_Architecture`の固定入口であり、リンクだけの索引ではない。工程全体の対象範囲、網羅状態、主要な結論と判断、検証義務、未解決事項、次工程への義務を本文から直接理解できるようにする。案件規模に合わせてファイルを増減するのではなく、対象範囲とリスクに応じて各節の詳しさを調整する。図、技術規則または外部成果物を分ける場合も、本書から決定権限、改訂版、現在状態へ到達できるようにし、詳細内容を複製しない。

個別分析と責務定義が揃った後、Qualityが検証単位を導けるよう、`02`から`06`の横断モデルを作成する。続いてARCH-IDを`07_Detail_Architecture_Map.md`で一つ以上の詳細設計領域へ接続し、`Details/`で実装可能な粒度へ具体化する。横断モデルと詳細設計は個別定義の代替ではない。現行Sourceと既存試験は正式入力にせず、Canonical詳細設計を固定した後のReality Auditで照合する。

正式入力はCanonicalなUI Definition、SPEC Definition、および適用するUI Detail／SPEC Detailである。`Analysis/UI-*/architecture_analysis.md`と`Analysis/SPEC-*/architecture_analysis.md`でDefinitionを別々に全数分析し、責務単位の`Definitions/<responsibility>/architecture_definition.md`へ統合する。DetailはScreen、Part、InteractionおよびDetailed Behaviorを実行構造へ配置する制約として接続し、Definition不足を補う要求源にしない。REQ、UX、IA、現行Architecture、WIPおよび実装で入力不足を補わない。上流は由来確認、現行構造は成立済み能力との照合にだけ使用する。

部品、依存、契約、Authority、Effect、状態遷移および失敗は、Component Matrix、テキスト図、状態表またはFailure Matrixを優先する。図の意味記法と凡例は工程規則へ従い、視覚的な配置や日本語ラベルを損なわない。以下の説明文は記入項目の案内であり、文章形式を要求しない。

## 基本図の処置

各行を`作成`、`既存参照`、`非該当`、`作成不能`のいずれかへ処置し、空欄のままにしない。`既存参照`は該当する図への一意な参照を持つ。`非該当`と`作成不能`は理由、影響および再評価契機を記載する。図の記法、適用条件および正本境界は工程規則に従う。

| 基本図 | 対象 | 目的 | 処置 | 現行図／一意な参照／理由 | 投影元改訂版 | 現在状態 | 未確認範囲 | 次の処置・再評価契機 |
|---|---|---|---|---|---|---|---|---|
| 全体／内部ブロック図 | | | | | | | | |
| 状態遷移表／状態遷移図 | | | | | | | | |
| ブロック間シーケンス図 | | | | | | | | |
| クラス／型関係図 | | | | | | | | |
| データフロー図（DFD） | | | | | | | | |
| エンティティ関係図（ER図） | | | | | | | | |
| スキーマ責務図（Schema Responsibility Map） | | | | | | | | |

## Architecture横断モデル

| 成果物 | 所有する内容 | Qualityへの主な引渡し | 現在状態 | 未確認範囲 |
|---|---|---|---|---|
| [Component／責務モデル](02_Component_and_Responsibility_Model.md) | Component、責務、状態Owner、所有禁止、主要Port | UT／Component検証 | | |
| [境界／Interfaceモデル](03_Boundary_and_Interface_Model.md) | Component間、外部System、Platform、Trust境界 | IT／契約／外部境界検証 | | |
| [Runtime／Data Flowモデル](04_Runtime_and_Data_Flow_Model.md) | Data、State、Identity、Authorityの流れ | 状態／整合性／情報流検証 | | |
| [故障／回復／耐障害モデル](05_Failure_Recovery_and_Resilience_Model.md) | 故障、取消、Retry、Recovery、cleanup、終了条件 | 故障／回復／残存検証 | | |
| [配置／実行モデル](06_Deployment_and_Execution_Model.md) | Process、Runtime、実行単位、並行性、Resource | 実行環境／Timing／Resource検証 | | |

## 対象範囲と現在状態

| 項目 | 記載内容 |
|---|---|
| 対象 | |
| 対象改訂版 | |
| 情報源となるUI、振る舞い仕様、品質条件 | |
| 成果物参照 | |
| 網羅状態 | |
| 未解決事項 | |

## 正式入力と分析網羅

| 入力種別 | 対象数 | 分析済み | 未分析 | 状態 |
|---|---:|---:|---:|---|
| UI定義 | | | | |
| SPEC定義 | | | | |
| UI Detail | | | | |
| SPEC Detail | | | | |

| Architecture定義 | 所有する責務 | 主な入力UI | 主な入力SPEC | 現行構造との照合 |
|---|---|---|---|---|
| [ARCH-XXXXXX 責務名](Definitions/ARCH-XXXXXX/architecture_definition.md) | | | | |

## Architecture詳細設計

| 成果物 | 所有する内容 | 状態 |
|---|---|---|
| [詳細設計の対応表](07_Detail_Architecture_Map.md) | ARCH-IDと詳細設計領域のRelation、領域閉包、Qualityへの引渡し | Candidate |
| [`Details/`](Details/) | 実装可能な構造、境界、Flow、Failure、Resource、配置および観測 | Candidate |

## システム境界と責務

システムコンテキスト、信頼境界、ドメイン、部品、外部依存関係、各責務を記載または参照する。

## データ、状態、インターフェース

データ所有関係、正式な情報源、状態、順序、並行性、インターフェース、統合、失敗、回復を記載する。

## 品質、運用、保護策

性能、処理能力、可観測性、障害回復、セキュリティ、プライバシー、AI境界、インフラストラクチャ、運用条件を記載する。

## 互換性、移行、ロールバック

互換性の維持範囲、移行順序、データ変換、展開、切戻し、再実行条件を記載する。

## 実装規則と検証可能性

コーディング・依存関係・構成・環境規則、必要なログ、指標、制御点、テスト容易性、検証義務と検証観点を記載する。

検証義務の正本は本工程に残し、`07_Quality/03_Verification_Design.md`から参照する。

## 判断、未解決事項、実装への引き渡し

| 項目 | 記載内容 |
|---|---|
| 人間による判断と判断理由 | |
| 代替案、トレードオフ、根拠 | |
| 未解決事項と追跡先 | |
| 実装へ渡す制約と義務 | |
| 工程移行レビュー結果、専門観点、確認者、能力根拠、指摘事項の処置 | |
