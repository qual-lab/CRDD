# 旧Domain Model Packageの退役案内

状態: 3モデル分離の実装追従中。旧Package・互換Facadeは残さない。
最終更新日: 2026-11-12

| 現在のOwner | 正本 |
|---|---|
| 文書モデル | [責務・公開契約](../document-model/01_Architecture.md)、[活動Context](../document-model/02_Activity_Context.md) |
| 実行モデル | [責務・保存](../execution-model/01_Architecture.md)、[詳細API](../execution-model/05_Runtime_Domain.md) |
| 構成モデル | [責務・設定保存](../configuration-model/01_Architecture.md) |

型を含む3モデルの直接依存は0とし、Consumerが必要な値だけを投影する。新しい共通Package・Manager・Registry・汎用Storeを作らない。既存保存Path`.crdd/domain-model`・Schema・Lock・CAS・失敗／回復情報は変更しない。限定確認の結果は[変更計画](../../../99_Roadmap/Changes/CHG-000082/domain-model-three-package-plan.md)で追跡する。今回、全体回帰・実AI・Docker・過去保持物の操作は実施しない。

以下は旧リンクを現Ownerへ誘導するための到達点であり、旧公開IFの提供や第二の設計正本ではない。

## 内部宣言・検索・観測量の追加整理 — 2026-11-12

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

## 判断・阻害条件・履歴の統合 — 実装中

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

### 既知の問題による進行制限と読取り

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

## 終了記録の改訂番号 — 2026-11-11

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

## Coordinator試験からの保存規則分離 — 2026-11-11

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

## DI通知と保存受理の試験Owner — 2026-11-11

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

## Desktop修復記録のIdentity — 2026-11-10

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

## Workspace保存とGit技術契約の境界 — 2026-11-06

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

## Runtime Domainの設計正本 — 2026-10-27

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

### Repository追加通信設定の読取り — 2026-10-21

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

### 共通文書の表・Header・版・Identity — 2026-10-20

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

### Quality状態・分析・統合の本文契約 — 2026-10-20

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

### Quality Definition本文とLocal ID所有 — 2026-10-20（限定移管）

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

### Architecture分析・定義本文 — 2026-10-20（限定移管済み）

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

### UI／SPEC定義対応の根拠と固定改訂 — 2026-10-20（限定移管済み）

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

### UI／SPEC Detail本文の対応モデル — 2026-10-20（限定移管済み）

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

### SPEC分析・登録表・定義の本文モデル — 2026-10-20（限定移管済み）

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

### Discovery分析・定義本文と採用要求解析 — 2026-10-20（限定移管済み）

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

### UX入口・投影・分析・定義の本文検査 — 2026-10-20（限定移管済み）

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

### 変更文書の構造と案内集合 — 2026-10-20（移管済み）

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

### Reality用試験登録対応の検査 — 2026-10-20（移管済み）

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

### UI本文と関係の移管契約 — 2026-10-20（移管済み）

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

### IA本文と関係の移管契約 — 2026-10-20（移管済み）

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

### 成果物集合とUX引渡しの検査 — 2026-10-20

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

### 工程Checklist期待項目の所有 — 2026-10-20

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

### Project Context本文検査 — 2026-10-20

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

### 行とコードFence構造の解析 — 2026-10-20

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

### 工程ひな型の基本図処置契約 — 2026-10-19

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

### 可視Checklistの構造検査 — 2026-10-19

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

### 品質設計成果物の状態検査 — 2026-10-19

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

### UX正式入力の参照候補解析 — 2026-10-19

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

### 共通リンク参照解析の移管 — 2026-10-19

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

### 可視本文・表・先頭Headerの移管 — 2026-10-19

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

### Markdown Anchor解析の移管 — 2026-10-19

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

### 試験台帳・計画モデルの移管 — 2026-10-19

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

### Semanticの移管 — 2026-10-19

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

### 目的限定Contextの未接続範囲 — 2026-10-13

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

### 認可済み集合内のRelation解決 — 2026-10-12

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

### Topic／Meeting本文のProject拘束 — 2026-10-12

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

## 基本設計との関係

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

## 1. 責務と非目標

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

### 1.1 この設計が所有すること

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

### 1.2 非目標

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

## 2. ComponentとSource配置

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

## 3. 公開入口と依存方向

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

### 3.1 許可する方向

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

### 3.2 禁止する方向

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

### 3.3 Rootから公開する責務別契約

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

## 4. Data Flow

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

### 4.1. 認可済みContext／Portfolioの集約

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

## 5. 結果と失敗の境界

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

## 6. 配布と開発の境界

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

## 7. Consumer Closure

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

### 7.1 Consumer契約

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

### 7.2 Closure条件

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

## 8. Security境界

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

## 9. 統合後の公開操作と保存Owner

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

### 9.1. 状態保存と呼出し順

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

### 9.2. 移管確認と反証

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

### 9.3. 旧公開集合の移管先と検証義務

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

## 詳細成果物の適用判断

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

## Engineering Concern評価

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

## Qualityへの引渡し

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

## 現行実装との照合

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

## Implementation Structure

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

## 上流UI／SPEC Detailとの関係

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

## 保存処理の技術排他

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。

## Checklist

[文書](../document-model/01_Architecture.md)・[実行](../execution-model/01_Architecture.md)・[構成](../configuration-model/01_Architecture.md)の該当責務を参照する。
