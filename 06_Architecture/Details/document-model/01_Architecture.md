# 文書モデルの責務と公開契約

成果物種別: Architecture詳細設計
状態: 実装・限定検証・独立再レビュー済（全体回帰未実施。統合判断とは別）
担当責任者: Qual-Lab
最終更新日: 2026-11-12

<a id="model-boundary"></a>
## 1. 責務と依存

文書モデル（document-model）はCRDD成果物・Markdown構造・Relation・Project Context・Topic／Meeting・Semantic・Reality・試験Catalogと、それらの保存を所有する。実行State、設定Reader、認証、AI／Docker実行、Recovery許可は所有しない。

文書・実行・構成の3モデルは、型・再export・deep import・dynamic import・package依存を含め相互の直接依存を持たない。既存Consumerが各Ownerの完成操作を呼び、必要な値だけを明示投影する。共通Facade・第4Package・汎用Storeを作らない。VC・共通Lock・Node.jsは必要なOwnerが直接使用する。

<a id="public-api"></a>
## 2. 公開入口とSource

`40_Develop/document-model/src/index.ts`は明示公開294 Symbol（値162・型132）を持つ。値には定数・Parser・検査を含み、294個の操作を意味しない。公開集合は[採用設計](../../../99_Roadmap/Changes/CHG-000082/domain-model-three-package-plan.md#9-indextsの移管候補)と固定期待値の契約試験で追跡する。

| Source | 所有する契約 |
|---|---|
| artifact/、outcome.ts | 文書解析・構造・診断・Relation・Schema |
| activity/、topic/、meeting/ | 活動正本のCRUD・一覧・Relation・処置 |
| project-context/ | 正本文書の3期待Identity照合、Source・Portfolio投影 |
| semantic/、reality-traceability/ | IR・Coverage・Symbol宣言と観測 |
| test-catalog/、quality-change-control/ | 試験構造・選択と品質確認結果の純粋モデル |
| repository/、storage/ | 文書観測、Topic／Meeting・Semantic保存 |

品質確認結果の純粋モデルを配置したことから、Checker本番の新Gateや受入権限を生成しない。Semantic公開の既存Publisher契約は維持し、HookをRootへ公開しない。

<a id="consumers"></a>
## 3. 利用側の投影

Checkerは文書構造を検査し、Workbench／MCPは活動操作・表示を利用する。AM／Coordinator等が構成モデルのManifestを取得した場合、`readRepositoryProjectContext(repository, expectedIdentity)`へprojectId／repositoryId／repositoryRoleの3値だけを明示投影する。第2引数は文書モデル自身の`RepositoryProjectContext`から取った3 fieldであり、Manifest型や設定全体を受け取らない。

三Identityの完全一致、本文実体確認、内容改訂、不明・不一致の区別は維持する。文書読取りから認証・認可・Task許可を生成せず、複数モデルの画面結合は既存Consumerが行う。

<a id="storage"></a>
## 4. 保存と終了条件

Topicは22_Topics、Meetingは23_Meetingsの既存正本、Project ContextはPROJECT_CONTEXT.md、Semanticは既存指定成果物を使用する。Package分離でSchema・Path・ID・Lock Identity・改訂・同一Repository内の出版順序を変更しない。

固定Path、Traversal・Link拒否、実体照合、期待改訂、Relation確認、原子的置換と失敗分類を各文書Ownerに保持する。Node.js標準操作と共通Lockへ既存保存処理から接続し、汎用保存Helperを別モデルから借りない。

活動の詳細は[活動Context](02_Activity_Context.md)、実行Stateは[実行モデル](../execution-model/01_Architecture.md#storage)、設定保存は[構成モデル](../configuration-model/01_Architecture.md#storage)を参照する。

<a id="verification"></a>
## 5. 検証と未確認

公開集合・文書解析・三Identity・活動CRUD・Semantic出版・Repository境界と異常系を既存試験へ対応付ける。試験Rootは検証済みRepository直下の今回専用.crdd/testsへ限定し、同実体の清掃と不存在を確認する。

移管後の限定回帰・独立レビュー結果は[変更計画](../../../99_Roadmap/Changes/CHG-000082/domain-model-three-package-plan.md)で更新する。Source配置や単独型検査をもって全Consumer接続・同等保証・全体完成としない。全体回帰・実AI・Docker・過去保持物の操作は今回実施しない。
