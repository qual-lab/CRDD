# 構成モデルの責務と設定保存契約

成果物種別: Architecture詳細設計
状態: 内部責務整理の実装・限定検証・独立再レビュー済（全体回帰未実施。検証手順逸脱と観測限界はEvidenceへ別記）
担当責任者: Qual-Lab
最終更新日: 2026-11-12

<a id="model-boundary"></a>
## 1. 責務と依存

構成モデル（configuration-model）はRepository Manifest、AI選択の希望設定、Network Policy、Coordinator／EIの保持設定と、それら自身の読取り・保存を所有する。実行選定結果・Task担当相関・State／History／Recovery判断・認証・CROS Trust Policy・一括Runtime領域管理は所有しない。

文書・実行モデルとの型・実装・再export・deep import・dynamic import・package直接依存は0とする。VC／Lock／Node.jsを直接使い、必要な専門型は正本を参照する。共通保存Package・Facade・Manager・Storeや便利HelperのRoot配布を追加しない。

<a id="public-api"></a>
## 2. 公開入口

`40_Develop/configuration-model/src/index.ts`は明示公開24 Symbol。関数と型・定数を含み、業務操作数ではない。値・Schemaの正本と利用側は[採用設計](../../../99_Roadmap/Changes/CHG-000082/domain-model-three-package-plan.md#9-indextsの移管候補)で追跡する。

公開集合は8関数・2定数・14型である。AI SelectionのChoice・役割別希望設定・Catalog投影・検査・読取り／保存、Manifestの固定File読取り（宣言検査は内部）、Network Policy読取り、Coordinator／EI設定読取りが対象。未接続のTrust宣言検査と型を撤去し、`readRepositoryManifest`／`RepositoryManifestReadResult`へ公開契約を対応付ける。`inspectRepositoryManifest`は外部本番ConsumerがないためRootから公開せず、Manifest読取りと局所試験が内部の宣言検査を利用する。ExecutionSelectionとTask担当組・Hashは[実行モデル](../execution-model/01_Architecture.md#public-api)が所有する。Provider／ModelSelection／ReasoningEffortはAD正本をConsumerが直接参照する。

Sourceは15 Fileとし、`index.ts`、`ai-selection/`・`network-policy/`・`history/`・`manifest/`各領域の`crud.ts`／`validation.ts`／`types.ts`、保存共通部品`storage/store.ts`／`storage/lock.ts`に責務を閉じる。`history/`は履歴本文を保存せず、保持日数設定の読取りと値検査だけを所有する。旧configuration・plain-data・snapshot等の別名Facadeは残さない。

Manifest読取りはVC検証済みRootを受け取り、`ready`では検証済みManifestと復号後の全文のSHA-256、`missing`では真正不存在、`blocked`では内容不正と実体・I/O観測不能を区別する。本文は旧Readerの`Buffer.toString("utf8")`と同じ置換復号を行い、JSON.parseの最終Key採用とBOM拒否を維持する。通常Fileの有効hardlinkを新たに拒否しない。IdentityはWB／MCPが従来比較した復号後全文の一致を表し、同じ本文へ復号される異なる不正byte列には同じ値を返す。正常UTF-8では生byte Hashと一致するが、他設定の生byte Hashを変更するものではない。取得成功は認証・認可・実行Authorityではない。

<a id="consumers"></a>
## 3. Consumerの投影

Consumerが設定とADの結果から実行Inputへ必要fieldを投影する。文書ReaderへはManifest全文でなくprojectId／repositoryId／repositoryRoleだけを渡す。履歴設定はその処理が消費する場面だけ実行Inputへ運び、上位の既存revalidateで現在ready・同値を確認する。通常Queryや非履歴分岐へ設定ガードを追加しない。

構成の検査成功を実行Authority・認証・現在認可へ読み替えない。既知Role・選定元・内容Hash等の相関を別モデルへの型参照で共有せず、受け手が自分のInputを検査する。

<a id="storage"></a>
## 4. 保存とRoot境界

設定は既存`.crdd/config/`に保存し、ai-selection.json・network-policy.json・coordinator.json等の名前、Schema・契約ID・CAS・Lock Identityを変更しない。Manifestの既存正本も配置を維持する。退役したTrust検査の代替Reader・保存形式・互換処理は追加しない。

設定保存はVC検証Rootから自分の固定config所在を内部で求める。Ignore登録・Root／Link／実体・EOF・close確認、現在値Hash／期待Identity・競合拒否、出版後の不明・一時物のCleanup未確認参照を保持する。AiSelectionTemporaryReferenceは保存Result内で維持し、単独Root公開だけを外す。

AMのHost RootはAM自身の初期化・保存・FilesystemStoreRoot型が正本。CROS既定所在もAM内部で扱う。AM Rootと構成の私有Rootを相互交換しない。AI選定のJSON重複Key拒否・data-property・Proxy／accessor検査はAI選定契約へ局所化する。Manifestと保持設定は従来のJSON.parse条件を維持し、厳密JSON検査へ統一しない。他設定とAMの既存保存I/O・JSON条件はこの整理で変更しない。

汎用Area enum、全Runtime Path配布、汎用ensure／FromWorkingDirectory Wrapper、汎用Lock／Snapshot Helperは公開しない。State保存・一時Operation・保護Mount・Lease／EI領域・検証Rootの準備は当該Ownerが直接行う。

<a id="verification"></a>
## 5. 検証と未確認

宣言・設定検査、AI設定CAS、同値／競合／途中変更、部分出版・File変化・Lock／Cleanup失敗を既存試験で確認する。新Schema・自動移行・Quota復活・保護Policy緩和は行わない。

Source移管や型検査を設定保存・全Consumer接続の成立と同一視しない。限定回帰・独立確認は[変更計画](../../../99_Roadmap/Changes/CHG-000082/domain-model-three-package-plan.md)へ記録する。全体回帰・実AI・Docker・過去保持物の操作は今回実施しない。
