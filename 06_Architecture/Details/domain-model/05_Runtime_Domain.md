# 旧実行・単一保存設計の退役案内

状態: Retired（v0.22 Feature）
最終更新日: 2026-11-17

現在の正本は[実行モデルの責務・完成操作](../execution-model/01_Architecture.md)と[保存・回復契約](../execution-model/01_Architecture.md#storage)である。旧API一覧・ACK・Temporary Operation・転送見出し一覧は保持しない。

文書モデルと構成モデルを直接参照せず、必要な値はConsumerが渡す。技術実行・取消はExecutor／DI、Taskの実行調停はCoordinator、保存・同版整合は実行モデルの現在契約に従う。保存先・Schema・CAS・回復相関をこの整理では変更しない。

当時の設計・検証はGit履歴と[既存変更計画](../../../99_Roadmap/Changes/CHG-000082/domain-model-three-package-plan.md)で追跡する。旧結果を現在の実装・全体回帰・実データ移行の成立へ流用しない。
