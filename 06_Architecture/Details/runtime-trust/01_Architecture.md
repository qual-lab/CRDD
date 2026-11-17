# 旧Trust評価器の退役案内

状態: Retired（v0.22 Feature）
最終更新日: 2026-11-17

Coordinator内の旧独立Trust評価器は廃止した。代替の本番評価器は未接続である。本書は退役案内であり、旧Evaluator・Policy・評価フロー・比較用本文は保持しない。

| 区別する責務 | 現在の正本と未達 |
|---|---|
| 実行の現在境界・観測事実 | [Coordinator](../coordinator/01_Architecture.md)。独立Trust評価器の代替ではない |
| Git／Objectの技術的な内容同一性 | [Version Control](../version-control/01_Architecture.md)。Publisher証明・品質・実行許可とは区別する |
| 準拠・完全性・Publisher・品質・利用者Trustの上位義務 | [ARCH-000014](../../Definitions/ARCH-000014/architecture_definition.md)。未接続をMissing／OPENとして保持する |
| 利用者判断と公開判断 | 利用者・配置担当・Releaseの決定権限者。[Release](../../../13_Release.md)を参照する |

一軸の成功を全体Trustへまとめず、利用者の判断を代行しない。通常実行へ新しいGateを追加せず、旧専用試験を現版の成立根拠へ流用しない。

廃止と未接続の判断は[既存変更記録](../../../99_Roadmap/Changes/CHG-000082/coordinator-consolidation-plan.md)に、当時の設計・検証はGit履歴に残る。退役を上位義務の完了・免除と扱わない。
