# 旧Domain Model Packageの退役案内

状態: Retired（v0.22 Feature）
最終更新日: 2026-11-17

旧Package・公開入口・互換Facadeは撤去し、次の3モデルへ分離した。本書は現在の担当への案内であり、旧設計本文・旧見出しの転送一覧は保持しない。

| 現在の担当 | 正本 |
|---|---|
| 文書・成果物・活動・Semantic | [文書モデル](../document-model/01_Architecture.md) |
| 実行定義・State・判断・History・回復 | [実行モデル](../execution-model/01_Architecture.md) |
| Manifest・希望選定・Network・保持設定 | [構成モデル](../configuration-model/01_Architecture.md) |

型を含む3モデル間の直接依存を作らず、Consumerが必要な値を受け渡す。旧保存PathをPackage名だけで変更・移行せず、各保存担当の現在契約に従う。

当時の設計・分離判断・検証はGit履歴と[既存変更計画](../../../99_Roadmap/Changes/CHG-000082/domain-model-three-package-plan.md)で追跡する。旧結果を現在の全体品質へ流用しない。
