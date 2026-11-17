# 成果物署名Packageの退役案内

状態: Retired（v0.22 Feature）
最終更新日: 2026-11-17

専用の成果物署名Packageは代替なしで廃止した。本書は退役案内であり、現行詳細設計ではない。旧鍵参照・秘密入力・署名認可・署名API・結果検証の本文は保持しない。

| 区別する責務 | 現在の正本 |
|---|---|
| 実行前の現在認可・必要Artifactの技術境界 | [Coordinator](../coordinator/01_Architecture.md) |
| GitのObject・Revision・内容同一性 | [Version Control](../version-control/01_Architecture.md) |
| Credentialの発行・失効 | [Access Management](../access-management/01_Architecture.md)。旧署名鍵と同じ契約にはしない |
| 配布・Publisher・公開判断の上位義務 | [ARCH-000014](../../Definitions/ARCH-000014/architecture_definition.md)、[Release](../../../13_Release.md) |

標準暗号の既存利用、Credential、Git／Artifactの内容同一性は別責務であり、本Packageの復活を要求しない。将来の配布署名・Publisher証明を実装済みとせず、Hashだけで真正性・Trust・実行許可を発行しない。未接続義務は未達のまま保持する。

廃止判断は[既存変更記録](../../../99_Roadmap/Changes/CHG-000082/second-stage-plan.md#検査検証packageの縮小--2026-10-19の途中見直し)、当時の設計・検証はGit履歴で追跡する。旧専用試験のPassを現在方式へ転記しない。
