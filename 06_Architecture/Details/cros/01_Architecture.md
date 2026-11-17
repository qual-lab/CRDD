# 旧CROS設計の退役案内

状態: Retired（v0.22 Feature）
最終更新日: 2026-11-17

旧CROS Packageは撤去した。本書は現在の担当への案内であり、現行詳細設計ではない。旧API・Schema・状態遷移・比較用設計の本文は保持しない。

| 旧責務 | 現在の担当と正本 |
|---|---|
| 認証・現在認可・User／Role・Credential・Repository登録 | [Access Management](../access-management/01_Architecture.md)、[管理状態とAPI](../access-management/02_Management_State_and_API.md) |
| 文書・Topic／Meeting・活動Contextの意味と保存 | [文書モデル](../document-model/01_Architecture.md)、[活動Context](../document-model/02_Activity_Context.md) |
| 実行の調停と結果搬送 | [Coordinator](../coordinator/01_Architecture.md)、[Taskの実行](../coordinator/03_Task_Architecture.md) |
| 公開Transportと画面 | [MCP Server](../mcp-server/01_Architecture.md)、[Workbench](../workbench-server/01_Architecture.md) |

旧CROSの認証・連合Authorityを文書モデルへ移さず、各担当の現在契約を使う。旧試験のPassから、新経路の全Consumer・共有Server・実Transportの完成を推定しない。未接続・Partial／OPENは各正本に保持する。

当時の設計・移管判断・検証はGit履歴と[既存変更記録](../../../99_Roadmap/Changes/CHG-000082/second-stage-plan.md)で追跡する。退役を上位義務の完了・免除や、新しい公開許可と扱わない。
