# 旧Domain Model文書の退役案内

状態: 3モデル分離により現行Ownerへ移管。旧Packageの公開契約は提供しない。
最終更新日: 2026-11-12

現在の正本は[実行保存の詳細契約](../execution-model/03_Repository_Storage.md)。旧リンクの到達点だけを維持し、以下の各節は移管先の同じ契約へ接続する。保存先`.crdd/domain-model`はPackage名とは独立して維持する。

## 共通状態保存の配置切替 — 2026-10-28

[移管後の詳細](../execution-model/03_Repository_Storage.md)を参照する。現行の公開集合と検証状態は移管先Ownerの01_Architecture.mdに従う。

### Lock Workerの標準入出力

[移管後の詳細](../execution-model/03_Repository_Storage.md)を参照する。現行の公開集合と検証状態は移管先Ownerの01_Architecture.mdに従う。

### 保存ReaderのFile ID表現

[移管後の詳細](../execution-model/03_Repository_Storage.md)を参照する。現行の公開集合と検証状態は移管先Ownerの01_Architecture.mdに従う。

## 基本設計との関係

[移管後の詳細](../execution-model/03_Repository_Storage.md)を参照する。現行の公開集合と検証状態は移管先Ownerの01_Architecture.mdに従う。

## 詳細成果物の適用判断

[移管後の詳細](../execution-model/03_Repository_Storage.md)を参照する。現行の公開集合と検証状態は移管先Ownerの01_Architecture.mdに従う。

## Engineering Concern評価

[移管後の詳細](../execution-model/03_Repository_Storage.md)を参照する。現行の公開集合と検証状態は移管先Ownerの01_Architecture.mdに従う。

## Qualityへの引渡し

[移管後の詳細](../execution-model/03_Repository_Storage.md)を参照する。現行の公開集合と検証状態は移管先Ownerの01_Architecture.mdに従う。

## 現行実装との照合

[移管後の詳細](../execution-model/03_Repository_Storage.md)を参照する。現行の公開集合と検証状態は移管先Ownerの01_Architecture.mdに従う。

## 1. 目的と設計判断

[移管後の詳細](../execution-model/03_Repository_Storage.md)を参照する。現行の公開集合と検証状態は移管先Ownerの01_Architecture.mdに従う。

## 2. Repository-local構成と切替境界

[移管後の詳細](../execution-model/03_Repository_Storage.md)を参照する。現行の公開集合と検証状態は移管先Ownerの01_Architecture.mdに従う。

<a id="compact-owner-layout"></a>

### Coordinatorへの単一保存統合

[移管後の詳細](../execution-model/03_Repository_Storage.md)を参照する。現行の公開集合と検証状態は移管先Ownerの01_Architecture.mdに従う。

## 3. 各領域の意味

[移管後の詳細](../execution-model/03_Repository_Storage.md)を参照する。現行の公開集合と検証状態は移管先Ownerの01_Architecture.mdに従う。

### 3.1. 保存量を増やし続けないための終了契約

[移管後の詳細](../execution-model/03_Repository_Storage.md)を参照する。現行の公開集合と検証状態は移管先Ownerの01_Architecture.mdに従う。

### 3.1.1. 試験結果の受理と清掃

[移管後の詳細](../execution-model/03_Repository_Storage.md)を参照する。現行の公開集合と検証状態は移管先Ownerの01_Architecture.mdに従う。

### 3.2. Candidateの有限保持

[移管後の詳細](../execution-model/03_Repository_Storage.md)を参照する。現行の公開集合と検証状態は移管先Ownerの01_Architecture.mdに従う。

## 4. `tmp/`の限定用途

[移管後の詳細](../execution-model/03_Repository_Storage.md)を参照する。現行の公開集合と検証状態は移管先Ownerの01_Architecture.mdに従う。

### 4.1. 配置判定

[移管後の詳細](../execution-model/03_Repository_Storage.md)を参照する。現行の公開集合と検証状態は移管先Ownerの01_Architecture.mdに従う。

### 4.2. Operation所有契約

[移管後の詳細](../execution-model/03_Repository_Storage.md)を参照する。現行の公開集合と検証状態は移管先Ownerの01_Architecture.mdに従う。

### 4.3. Owner Process観測の既知制約

[移管後の詳細](../execution-model/03_Repository_Storage.md)を参照する。現行の公開集合と検証状態は移管先Ownerの01_Architecture.mdに従う。

### 4.4. Lifecycle

[移管後の詳細](../execution-model/03_Repository_Storage.md)を参照する。現行の公開集合と検証状態は移管先Ownerの01_Architecture.mdに従う。

### 4.5. Recoveryの所有

[移管後の詳細](../execution-model/03_Repository_Storage.md)を参照する。現行の公開集合と検証状態は移管先Ownerの01_Architecture.mdに従う。

## 5. `config/`とRepository Identity

[移管後の詳細](../execution-model/03_Repository_Storage.md)を参照する。現行の公開集合と検証状態は移管先Ownerの01_Architecture.mdに従う。

## 6. CROSとの物理分離

[移管後の詳細](../execution-model/03_Repository_Storage.md)を参照する。現行の公開集合と検証状態は移管先Ownerの01_Architecture.mdに従う。

## 7. 現行配置からの移行境界

[移管後の詳細](../execution-model/03_Repository_Storage.md)を参照する。現行の公開集合と検証状態は移管先Ownerの01_Architecture.mdに従う。

## 8. Path CapabilityとConsumer Closure

[移管後の詳細](../execution-model/03_Repository_Storage.md)を参照する。現行の公開集合と検証状態は移管先Ownerの01_Architecture.mdに従う。

## 9. 完成条件

[移管後の詳細](../execution-model/03_Repository_Storage.md)を参照する。現行の公開集合と検証状態は移管先Ownerの01_Architecture.mdに従う。

## 保存領域の読取り専用観測

[移管後の詳細](../execution-model/03_Repository_Storage.md)を参照する。現行の公開集合と検証状態は移管先Ownerの01_Architecture.mdに従う。

## 履歴保持期間の設定

[移管後の詳細](../execution-model/03_Repository_Storage.md)を参照する。現行の公開集合と検証状態は移管先Ownerの01_Architecture.mdに従う。

### 設定の配置と管理境界

[移管後の詳細](../execution-model/03_Repository_Storage.md)を参照する。現行の公開集合と検証状態は移管先Ownerの01_Architecture.mdに従う。

## Implementation Structure

[移管後の詳細](../execution-model/03_Repository_Storage.md)を参照する。現行の公開集合と検証状態は移管先Ownerの01_Architecture.mdに従う。

## 上流UI／SPEC Detailとの関係

[移管後の詳細](../execution-model/03_Repository_Storage.md)を参照する。現行の公開集合と検証状態は移管先Ownerの01_Architecture.mdに従う。

## 保存方式の切替確認

[移管後の詳細](../execution-model/03_Repository_Storage.md)を参照する。現行の公開集合と検証状態は移管先Ownerの01_Architecture.mdに従う。

## 検証報告と容量制限付き読取りのOwner

[移管後の詳細](../execution-model/03_Repository_Storage.md)を参照する。現行の公開集合と検証状態は移管先Ownerの01_Architecture.mdに従う。

## Checklist

[移管後の詳細](../execution-model/03_Repository_Storage.md)を参照する。現行の公開集合と検証状態は移管先Ownerの01_Architecture.mdに従う。
