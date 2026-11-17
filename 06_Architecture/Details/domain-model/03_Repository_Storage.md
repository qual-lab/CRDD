# 旧共通保存設計の退役案内

状態: Retired（v0.22 Feature）
最終更新日: 2026-11-17

旧Domainの共通保存設計本文と転送見出し一覧は保持しない。現在は各モデルが自身の保存を所有し、3モデル共通の保存PackageやFacadeを作らない。

| 保存対象 | 現在の正本 |
|---|---|
| State・History・判断・回復 | [実行モデル](../execution-model/01_Architecture.md#storage) |
| 設定・Manifest | [構成モデル](../configuration-model/01_Architecture.md#storage) |
| 活動・Semantic | [文書モデル](../document-model/01_Architecture.md#storage) |
| 共有Host状態・Provider Homeの利用調停 | [Coordinator](../coordinator/01_Architecture.md) |
| 認証・管理Store | [Access Management](../access-management/01_Architecture.md) |

保存Path・Schema・Lock・CAS・回復相関の変更や、既存保持物の移行・回収をこの文書整理から許可しない。当時の配置設計・検証はGit履歴と[既存変更計画](../../../99_Roadmap/Changes/CHG-000082/domain-model-three-package-plan.md)で追跡する。
