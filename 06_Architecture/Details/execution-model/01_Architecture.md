# 実行モデルの責務と単一保存契約

成果物種別: Architecture詳細設計
状態: 内部構成整理の限定完了（利用側・試験・台帳・文書の追従、限定検証、独立再レビュー済。全体回帰・統合判断とは別）
担当責任者: Qual-Lab
最終更新日: 2026-11-12

<a id="model-boundary"></a>
## 1. 責務と依存

実行モデル（execution-model）はObjective／Task／Attempt／Queue／Workspace、Blocker・提案回答、State／History、回復記録と局所遷移・保存を所有する。Scheduling・再試行判断はCoordinator、単一技術実行はExecutor、Provider計画・解析はAI Adapter、Docker実体はDIが所有する。

3モデル間の実装・型・再export・deep import・dynamic import・package直接依存は0とする。実行モデルは設定を探索・再選定せず、構成モデルのReaderや型を受け取らない。必要なVC／Lock／Node.jsと既存AD／DI技術結果型は正本を直接使用する。旧domain-modelの互換Facadeを残さない。

<a id="public-api"></a>
## 2. 公開入口と確定入力

`40_Develop/execution-model/src/index.ts`は明示公開364 Symbol（値279・型85）を持つ。定数・純粋候補・検査・例外も含み、364個の業務操作を意味しない。現在の公開集合は実Rootと固定期待値の契約試験を正本とし、[当初分離時の対応案](../../../99_Roadmap/Changes/CHG-000082/domain-model-three-package-plan.md#9-indextsの移管候補)とは区別する。

ExecutionSelection、inspectExecutionSelection、hashExecutionSelection、TaskExecutionSelectionsと担当組の検査は実行Ownerに置く。ADのModelSelectionを基礎に当時のcatalogIdentity／configIdentity／role／workType／sourceを固定する。CoordinatorがConfigとADの解決結果を明示投影し、実行モデルは役割・選定相関・形式を自身の境界で検査する。Hashの正規化順序・保存JSON・設定取得時の意味は変更しない。

<a id="consumers"></a>
### 内部の24ファイル構成

`index.ts`と、objective／task／attempt／decision／workspace／state／historyの各`crud.ts`・`validation.ts`・`types.ts`、`storage/store.ts`・`storage/lock.ts`で構成する。各crudは完成保存操作、validationは局所候補・検査、typesは契約を所有する。

固定所在、共通File読取り／書込み、一時保存資源のI/Oは`storage/store.ts`、共通の排他取得・保持・解放と保存Ownerは`storage/lock.ts`が所有する。State固有のCAS・出版／回復と、短命Mapに結合したEffect順序は`state/crud.ts`が所有し、共通保存primitiveへ接続する。出版・回復では同File自身がrename／unlink等も発行するため、全物理I/Oをstoreへ集約したとは扱わない。Stateの短命Mapと一回使用Protocolは一体で置き、重複実体や中継だけのWrapperを作らない。

旧repository／identity／plain-dataのSource分散と旧PathのWrapperは残さない。機密検査の7値公開は撤去し、AIへの送信境界を所有するCoordinatorのinput/secret-validationへ移す。他のRoot公開は今回追加削減せず、保存先・Schema・Hash・Lock Identity・CAS・現在性確認・失敗／回復相関は不変更とする。

## 3. 保持設定と利用側

基底RuntimeAccess／RuntimeExecutionStorageAccessと通常Queryは不変更。保持日数を消費する保存操作・履歴処理分岐だけ、既存Inputに履歴保持日数を加える。非履歴Query／Recovery入口を設定不正で一律停止しない。

上位Consumerは履歴確認を求められた既存revalidate呼出しに限り、現在設定がreadyで期待保持日数と同じことを結合する。履歴Input側の既存revalidateは任意の最終引数expectedHistoryRetentionDaysを受け、通常呼出しは従来引数のまま設定Readerを呼ばない。元runtime-storeの6箇所・runtime-historyの4箇所の当該枝・Effect順序へ対応付ける。Root単体のRecovery・修復出版再入場と履歴保守も取り残さない。

履歴と配送の一回保存Ownerも任意の期待保持日数を元repository.revalidateへ転送し、active・Map同一性・used・元Owner照合と日数の途中変更拒否を両立する。通常の引数なし再検証へ設定読取りを追加しない。

新しい設定Callback field・Context階層・Reader注入は作らない。追加引数を渡しただけでは比較成立とせず、本番Consumerの現在性確認と途中設定変更の負例で検証する。設定不存在時30日と明示30日を新たに区別せず、Config Hashや世代一致も追加しない。

<a id="storage"></a>
## 4. 保存・初期化・回復

保存先は既存`.crdd/domain-model/`のstate.json・history.jsonl等を維持する。Package名と保存Identityは別であり、Schema・契約ID・Lock Path／Hash namespace・CAS・Principal・回復参照・履歴保持条件を変更しない。自動移行・旧形式Reader・過去保持物の操作は追加しない。

State／Task／Queue／Decision／回復義務は既存の単一SnapshotとWriterで扱う。History確認前に必要な判断記録を退役させず、未確認・部分Effect・配送・回復相関を落とさない。既存Blocker 1:N提案回答、未適用・解消・中止を維持する。

初期化作成と旧coordinator領域の不存在確認はstorage/store.ts内部へ一緒に置く。真正不存在、親実体の前後一致、排他的作成、空の新規領域を維持し、一般ensureで既存領域を新品としない。一時操作の作成・再開・根拠昇格も同じOwnerに置き、VC検証Root直下の固定所在と実体・世代・Receipt・Hash・Lock・Effect順序を保持する。

領域確保の失敗は既存RepositoryRuntimeDataAreaBlockedErrorを実行失敗契約として公開し、Coのinstanceof投影へ接続する。単なる一般Errorや未実施に変換せず、Effect不明・Cleanup・元回復参照を保持する。宣言はstorage/store.tsで所有し、他モデルのReturnTypeへ依存しない。

局所I/O・EOF・close・Getter／Proxy拒否は各入力／保存Ownerへ必要分を置く。共通Helper全文の複製や第4Packageは作らない。詳細な局所遷移・出版の契約は[API・単一保存](05_Runtime_Domain.md)を参照する。保持設定・Owner配置の新しい境界は本書を正本とする。

<a id="verification"></a>
## 5. 検証と未確認

公開集合、3モデル直接依存0、全Consumer型、State／History／CAS／Lock、初期化・途中失敗・回復・Receipt／相関を既存試験へ対応付ける。保持設定の初回不成立・途中変更・同値と、設定不正でも非履歴処理を止めない対照を含む。

型・Source移管だけで保存や再入場の成立を主張しない。限定回帰と独立確認は[変更計画](../../../99_Roadmap/Changes/CHG-000082/domain-model-three-package-plan.md)へ記録する。全体回帰・実AI・Docker・過去保持物の操作は今回実施しない。
