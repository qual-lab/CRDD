# 旧Path棚卸しの退役案内

状態: Retired（v0.22 Feature）
最終更新日: 2026-11-17

旧版で観測したPath・件数・容量・残存量の本文は、本書の現在値として保持しない。当時の固定観測はGit履歴で追跡し、現在の実体・不存在・移行完了の証拠へ流用しない。

| 現在の保存対象 | 正本 |
|---|---|
| 設定 | [構成モデル](../configuration-model/01_Architecture.md#storage) |
| 活動・Semantic | [文書モデル](../document-model/01_Architecture.md#storage) |
| State・History・回復 | [実行モデル](../execution-model/01_Architecture.md#storage) |
| 共有Host状態・Home利用 | [Coordinator](../coordinator/01_Architecture.md) |

過去の棚卸しと保持整理の判断は[既存変更記録](../../../99_Roadmap/Changes/CHG-000082/Evidence/261006_release-test-retention-phase4.md)で追跡する。新しいFilesystem棚卸し・過去保持物の削除・自動移行は実施せず、未知状態を不存在や清掃可能へ読み替えない。
