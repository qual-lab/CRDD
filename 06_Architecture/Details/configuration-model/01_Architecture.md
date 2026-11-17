# 構成モデルの責務と設定保存契約

成果物種別: Architecture詳細設計
詳細設計領域: configuration-model

## 基本設計との関係

| Architecture定義 | この領域が具体化する責務 | Relation状態 |
|---|---|---|
| [ARCH-000004](../../Definitions/ARCH-000004/architecture_definition.md) | 実行前のProvider・Model・Effortの希望を検査し、最終選定はCoordinatorに残す | Covered |
| [ARCH-000009](../../Definitions/ARCH-000009/architecture_definition.md) | ManifestのProject・Repository・Roleを検査し期待Identity照合へ投影する | Covered |
| [ARCH-000011](../../Definitions/ARCH-000011/architecture_definition.md) | 設定自身の固定所在と保持日数を扱い、実行State・資源清掃は所有しない | Covered |
| [ARCH-000013](../../Definitions/ARCH-000013/architecture_definition.md) | 登録対象の宣言Identityを上位へ渡し、認証・認可はAMに残す | Covered |
| [ARCH-000016](../../Definitions/ARCH-000016/architecture_definition.md) | 設定本文の内容同一性と現在Snapshotを扱い、過去選択を現在許可にしない | Covered |

Coveredは局所責務の設計接続を表し、ARCH全体や実動作の合格ではない。

## 詳細成果物の適用判断

| 詳細成果物 | 判定 | 理由 | 正本節／成果物 |
|---|---|---|---|
| Component Model | Required | 責務Ownerと禁止依存を固定する | [現行契約](#model-boundary) |
| Interface Model | Required | 完成操作と部分結果を区別する | [現行契約](#public-api) |
| Data Flow | Required | 受付から結果までの搬送を明示する | [現行契約](#consumers) |
| State Model | Required | 現在版・候補・未確認を区別する | [現行契約](#storage) |
| Sequence | Required | 検査・保存・終了の順を維持する | [現行契約](#storage) |
| Failure／Recovery | Required | 拒否・部分成立・不明と再入場を区別する | [現行契約](#storage) |
| Deployment | Required | Repository内所在とConsumer配置を固定する | [現行契約](#storage) |
| Observability | Required | 理由・出典と未評価を失わない | [現行契約](#verification) |
| Security Boundary | Required | 受付と認可を別Ownerにする | [現行契約](#consumers) |
| Implementation Structure | Required | 意味Ownerと保存部品を分離する | [現行契約](#implementation-structure) |

## Engineering Concern評価

| Concern | Result | Rationale | Evidence／Related ID |
|---|---|---|---|
| Concurrency | PASS | 改訂・期待Identity・共通Lockを別の保証として維持する | [既存の設計処置](#storage) |
| Timing | PASS | 受付・現在観測・保存の時点と上位の許可を混同しない | [既存の設計処置](#consumers) |
| Resource Lifecycle | PASS | 自分のLock・一時物・descriptorの終了と残存を結果に保持する | [既存の設計処置](#storage) |
| External Boundary | PASS | VC・Filesystemの不存在と観測不能を区別する | [既存の設計処置](#storage) |
| State／Consistency | PASS | 局所値の受付とモデル横断・上位判断の成立を区別する | [既存の設計処置](#model-boundary) |
| Failure／Recovery | PASS | 不明を補完せず、自動再試行・移行・未知物削除を追加しない | [既存の設計処置](#storage) |
| Observability | PASS | 内容モデル・理由・Issueと保存のEffect／終了相関を保持する | [既存の設計処置](#public-api) |
| Security／Trust | PASS | 受付成功を現在認可・外部実行Authorityへ昇格しない | [既存の設計処置](#consumers) |

- `PASS`: 詳細設計上の処置を記載した状態。試験・実境界・全体QAの合格ではない。
- `N/A`: Architecture上、そのConcern自体が存在しない状態。
- `OPEN`: 未解決の設計事項がある状態。
- `FAIL`: 必須設計と矛盾する状態。

## Implementation Structure

| 観点 | 適用 | 判定理由 | 成立させる構造 | 局所責務・不変条件 | 失敗・変更時の影響 | Qualityへの導出キー |
|---|---|---|---|---|---|---|
| Variation | Required | モデル種別で受付条件が異なる | 型・規則の宣言Ownerごとに局所化 | 一律Readerや差替えFrameworkへ統合しない | 変更時は対応する結果・利用側・失敗回帰を再照合 | `configuration-model.configuration-contracts` |
| Common Contract | Required | 完成操作の結果相関を維持する | Rootから宣言元を直接公開 | 3モデル共通の結果Facadeは作らない | 変更時は対応する結果・利用側・失敗回帰を再照合 | `configuration-model.package-boundary` |
| Creation／Selection | Required | 固定対象と入力種別を照合する | 明示した入力から対象を構成 | 上位の認可・実行先を選ばない | 変更時は対応する結果・利用側・失敗回帰を再照合 | `configuration-model.configuration-contracts` |
| State-dependent Behavior | Required | 現在版により受理できる更新が異なる | 局所遷移と改訂照合 | 読取り成功を保存・実行許可にしない | 変更時は対応する結果・利用側・失敗回帰を再照合 | `configuration-model.configuration-contracts` |
| Composition／Recursion | Required | 複数の値と整合条件を組み合わせる | 既存の完成操作内で必要な値だけを合成 | 他モデルを直接参照しない | 変更時は対応する結果・利用側・失敗回帰を再照合 | `configuration-model.configuration-contracts` |
| Lifecycle Ownership | Required | 自分の保存資源を所有する | Lockと一時物の終了処置 | 未知・不明時の保全を維持する | 変更時は対応する結果・利用側・失敗回帰を再照合 | `configuration-model.configuration-storage` |
| External Boundary | Required | Filesystem・VC・共通Lockを利用する | 専門Ownerの技術契約へ接続 | 外部事実をモデルだけから捏造しない | 変更時は対応する結果・利用側・失敗回帰を再照合 | `configuration-model.configuration-storage` |

## 入力・状態・保存境界の接続

希望値を受付し、固定設定を観測し、期待IdentityとCASを照合して保存結果を返す。実行選定・認可はConsumerに残す。 不正入力・競合は後続Effectを開始せず、Effect後の不明は元の相関と残存を保持する。通常の読取りを暗黙更新へ変換せず、現在の保存形式・公開集合・期限・安全判定は変更しない。
状態: 内部責務整理の実装・限定検証・独立再レビュー済（全体回帰未実施。検証手順逸脱と観測限界はEvidenceへ別記）
担当責任者: Qual-Lab
最終更新日: 2026-11-15

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

<a id="ui-spec-detail-placement"></a>
## 上流UI／SPEC Detailの局所分担

[UI／SPEC Detail Architecture Traceability](../../08_UI_SPEC_Detail_Traceability.md)のARCH-000009について、Repository Manifestの固定File読取りと宣言値の検査を担当する。

担当Interaction Relation: `PRT-000006.spec-000010`

上位はVCが検証したRepositoryをManifest読取りへ渡し、結果のprojectId／repositoryId／repositoryRoleだけを文書モデルのContext照合へ投影する。構成モデルは文書モデル・実行モデルを参照せず、Contextの解析、実行対象の選定、Git操作、認証・認可を行わない。設定読取りの成立を対象へのAuthorityや全Binding成立へ読み替えない。旧Domain Modelの共通Root機能を汎用Readerとして復活させず、Git差分選択・Commit・Pushも担当しない。

<a id="verification"></a>
## 5. 検証と未確認

宣言・設定検査、AI設定CAS、同値／競合／途中変更、部分出版・File変化・Lock／Cleanup失敗を既存試験で確認する。新Schema・自動移行・Quota復活・保護Policy緩和は行わない。

Source移管や型検査を設定保存・全Consumer接続の成立と同一視しない。限定回帰・独立確認は[変更計画](../../../99_Roadmap/Changes/CHG-000082/domain-model-three-package-plan.md)へ記録する。全体回帰・実AI・Docker・過去保持物の操作は今回実施しない。

## Qualityへの引渡し

| 導出キー | 設計項目種別 | 対象 | 正常条件 | 反証する失敗 | 主な試験段階 | 外部境界の段階 | 観測 | 終了後条件 | 未確認 |
|---|---|---|---|---|---|---|---|---|---|
| `configuration-model.package-boundary` | Interface／State／Failure | 公開24項目・モデル間直接依存0 | 既存の完成操作・Owner・結果相関を保持 | 未知公開・逆依存・Owner不明Helper | UT | N/A | RCM-UT-014の公開集合・import・禁止依存 | 純粋受付はEffect 0、保存は元対象の確定または未確認を保持 | 全体回帰・実AI・Docker・旧保持物の移行は未実施。上位義務の完了とは別 |
| `configuration-model.configuration-contracts` | Interface／State／Failure | Manifest・AI希望・Network・保持設定の受付 | 既存の完成操作・Owner・結果相関を保持 | 既知値の混同、未設定の暗黙補完、不正結果の成功化 | UT | N/A | RCM-UT-002のManifest／希望設定の正常対照・不正入力・独立捕捉 | 純粋受付はEffect 0、保存は元対象の確定または未確認を保持 | 全体回帰・実AI・Docker・旧保持物の移行は未実施。上位義務の完了とは別 |
| `configuration-model.configuration-storage` | Interface／State／Failure | 固定config所在の観測・保存・競合拒否 | 既存の完成操作・Owner・結果相関を保持 | 実体変化・CAS差・部分出版・終了不明 | IT | Direct Boundary | RDL-IT-001は固定配置・非作成Reader、RCM-IT-005はAI選定CAS・部分出版・回収不明 | Readerは保存Effect 0。保存は元対象の確定または部分出版・終了不明を保持 | 全体回帰・実AI・Docker・旧保持物の移行は未実施。上位義務の完了とは別 |

## 現行実装との照合
上記導出キーは現在の責務と既存試験の接続であり、今回の試験実施結果ではない。実装・限定検証と変更経緯は[既存変更計画](../../../99_Roadmap/Changes/CHG-000082/domain-model-three-package-plan.md)で追跡する。旧Domainの一括公開・共通Helper・結果の四状態を3モデルへ複製しない。配布launcherとReleaseの全Consumer閉包は上位Ownerの未完了義務として保持する。

## Checklist

- [x] 関連するARCH-IDと担当する責務断面を明示した
- [x] 10種類の詳細成果物を全数Applicability判定した
- [x] Requiredを実在する節または成果物へ接続した
- [x] N/AにArchitecture上の理由を記録した
- [x] 8種類のEngineering Concernを全数評価した
- [x] PASSを設計済みの意味に限定した
- [x] Component、Interface、Data／StateおよびSequenceを必要な粒度で具体化した
- [x] Failure／Recovery、ObservabilityおよびSecurity Boundaryを具体化した
- [x] 7種類のImplementation Structure観点を全数Applicability判定した
- [x] 二つ目の具象実装がある責務で、共通契約への昇格または非昇格理由を評価した
- [x] Qualityへ渡す設計項目を局所的な導出キーまたは同等に一意な参照へ接続した
- [x] Qualityへ対象、正常条件、反証する失敗、観測および終了後条件を渡した
- [x] Human Inputの必要性とOpen／Gapを評価した
- [x] 現行実装との照合をReality Auditとして分離した
- [x] Source構造をCanonical詳細設計へ逆輸入していない
