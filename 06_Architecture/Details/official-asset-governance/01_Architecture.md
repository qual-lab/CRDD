# 公式素材管理Packageの退役案内

状態: Retired（v0.22 Feature）
最終更新日: 2026-11-17

専用の素材判断・保存・収載照合Packageは廃止した。本書は現在の担当への案内であり、現行詳細設計ではない。旧素材モデル・状態遷移・保存API・比較用本文は保持せず、代替台帳も新設しない。

| 保持する責務 | 現在の担当と正本 |
|---|---|
| 承認済み素材の表示・導線 | [Workbench](../workbench-server/01_Architecture.md)。表示担当の接続はPartialであり、権利記録機能の完成ではない |
| 由来・権利・許可用途・判断者の記録義務 | [ARCH-000017](../../Definitions/ARCH-000017/architecture_definition.md)。記録機能は未接続として保持する |
| 権利・用途確認と公開判断 | 素材の判断権限者。[Communication](../../../17_Communication.md)と[Release](../../../13_Release.md)に従う |

Package撤去は、素材の権利確認不要・用途制限の解除・公開許可を意味しない。既存の権利記録を削除・移行せず、旧試験のPassから現在の記録機能や公開準備完了を推定しない。

当時の廃止判断は[既存変更記録](../../../99_Roadmap/Changes/CHG-000082/second-stage-plan.md#検査検証packageの縮小--2026-10-19の途中見直し)、設計・検証はGit履歴で追跡する。
