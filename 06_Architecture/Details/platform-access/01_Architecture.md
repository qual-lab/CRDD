# Platform Accessの退役案内

状態: Retired（v0.22 Feature）
最終更新日: 2026-11-17

`platform-access`の製品Source・公開API・Rust crate・Native配布物は撤去した。この文書は現在の移管先への案内であり、現行の詳細設計ではない。退役した設計本文は保持しない。当時の設計はGit履歴と既存の変更記録で追跡する。

| 旧責務 | 現在のOwnerと正本 |
|---|---|
| Runtime State・Provider Home | [Coordinator設計](../coordinator/01_Architecture.md)。既存Node.js処理によるPath・実体確認、共通Lockと保存順序を利用する |
| Docker所在・子Process環境・Docker Desktop操作 | [Docker Isolation設計](../docker-isolation/01_Architecture.md)。上位から渡す初期設定と既存Node.js処理・公式CLIを利用する |
| 共通排他 | [Lock設計](../lock/01_Architecture.md)。各Ownerが保護対象と回復判断を所有する |
| 共通LCOV解析 | Coordinatorの既存`tests/support/coverage.ts`へ統合。PA専用の集計・Native計測は撤去した |
| Native成果物の同一性・専用資格 | 対象成果物とともに撤去。代替Native実装や互換入口は設けない |

SID・厳密DACL・祖先Handleによる保護と同等の保証は主張しない。PA撤去はLinux／macOS対応、全体回帰、実境界検証またはRelease成立を意味しない。過去の永続記録・回復ID・保持物はこの文書変更では操作しない。

撤去と保証変更の経緯は[既存の変更記録](../../../99_Roadmap/Changes/CHG-000082/platform-access-source-structure.md)を参照する。
