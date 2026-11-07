# 共通Lockの技術設計

成果物種別: Architecture詳細設計
詳細設計領域: lock
状態: Candidate（協調する単一Hostの契約。全体QA・実運用切替の成立とは分ける）
Owner: Qual-Lab
Last Updated: 2026-11-07

## 基本設計との関係

| Architecture定義 | この領域が具体化する責務 | Relation状態 |
|---|---|---|
| [ARCH-000004](../../Definitions/ARCH-000004/architecture_definition.md) | 実行資源を使うOwnerが指定したScopeの技術排他。Task判断・取消・業務状態は所有しない | Covered |
| [ARCH-000006](../../Definitions/ARCH-000006/architecture_definition.md) | Topic／Meetingの改訂確認から保存・削除までの排他機構。Lifecycleと採否はDomainに残す | Covered |
| [ARCH-000008](../../Definitions/ARCH-000008/architecture_definition.md) | 取得拒否、初期化残存、descriptor終了不明、解放不明の区別 | Covered |
| [ARCH-000011](../../Definitions/ARCH-000011/architecture_definition.md) | Owner確定済みDirectory内のLock Fileの短命保持とCrash残存 | Covered |
| [ARCH-000013](../../Definitions/ARCH-000013/architecture_definition.md) | AMの保存区間の排他機構。認証・認可は発行しない | Covered |
| [ARCH-000018](../../Definitions/ARCH-000018/architecture_definition.md) | EI履歴の並行出版を直列化する排他機構。Event保存と再送判断はEIに残す | Covered |

Coveredは上記の局所責務の設計接続を表す。各ARCH全体の完成や試験合格を表さない。Repositoryの発見・Binding、Artifact Trust、送信・候補採用の責務は本領域へ移さない。

## 詳細成果物の適用判断

| 詳細成果物 | 判定 | 理由 | 正本節／成果物 |
|---|---|---|---|
| Component Model | Required | Lock PrimitiveとScopeを決めるOwnerを分ける | [責務](#責務と公開契約) |
| Interface Model | Required | 取得結果と保持handleの終了契約を区別する | [公開契約](#責務と公開契約) |
| Data Flow | Required | 指定対象から元取得参照、保持と解放結果へ相関を保つ | [状態と順序](#状態と順序) |
| State Model | Required | 未取得、取得済み、残存、終了不明を分ける | [状態と順序](#状態と順序) |
| Sequence | Required | wx、初期化、close、照合、削除、事後観測の順を固定する | [状態と順序](#状態と順序) |
| Failure／Recovery | Required | Crash・初期化・close・実体差を成功へ補完しない | [失敗と回復](#失敗と回復) |
| Deployment | Required | 単一Host・ローカルFilesystem・全Consumer同時切替を限定する | [運用制約](#信頼境界と運用制約) |
| Observability | Required | 原因、元参照、descriptor終了とFile残存を別々に返す | [状態と順序](#状態と順序) |
| Security Boundary | Required | 協調前提と非協調置換の保証対象外を明示する | [信頼境界](#信頼境界と運用制約) |
| Implementation Structure | Required | 共通取得・所有照合・解放と各Ownerの保存を分ける | [実装構造](#implementation-structure) |

## Engineering Concern評価

| Concern | Result | Rationale | Evidence／Related ID |
|---|---|---|---|
| Concurrency | PASS | 同一Pathのwx競合は一方だけ取得し、正規Callerは保持中に置換しない | [運用制約](#信頼境界と運用制約) |
| Timing | PASS | PID・経過時間を自動奪取に使わない。外部待機を含む保持区間はOwnerが決める | [保護対象](#接続する保護対象) |
| Resource Lifecycle | PASS | descriptorと元Fileの終了を分け、close不明時は削除しない | [失敗と回復](#失敗と回復) |
| External Boundary | PASS | Filesystem要求の発行と不存在確認を区別する | [状態と順序](#状態と順序) |
| State／Consistency | PASS | Lock保持と業務CAS・保存確定を相互代替しない | [責務](#責務と公開契約) |
| Failure／Recovery | PASS | 不明時は保全し、全関係Process停止下の明示処置に限定する | [失敗と回復](#失敗と回復) |
| Observability | PASS | 元世代参照とcleanupConfirmed／descriptorClosedを保持する | [状態と順序](#状態と順序) |
| Security／Trust | PASS | 任意Path清掃・自動回復・認可の発行を提供しない | [信頼境界](#信頼境界と運用制約) |

- `PASS`: 詳細設計上の処置が記載された状態。実装・実境界・全体QAのPassではない。
- `N/A`: Architecture上、そのConcern自体が存在しない状態。
- `OPEN`: 未解決の設計事項がある状態。
- `FAIL`: 必須設計と矛盾する状態。

## 責務と公開契約

`acquireLock({ directory, name, identity })`は、Ownerが確定した既存Directory内の固定Fileをwx作成する。Directory探索・作成、PID生存判断、残存削除、Recovery実施判断は行わない。公開型は`LockRequest`、`LockReference`、`Lock`、`LockResult`。参照は非Authorityで、取得前のOwner／Generationと取得後のFile／親Directoryの実Identityを結ぶ。

取得結果は非取得と初期化失敗を区別する。新規File作成後に書込み・同期・closeが失敗した場合、同じ取得参照、File残存、descriptor終了確認を返す。Fileが空でも自動回復しない。CurrentStateと共有Home／Runtime状態の利用側は取得結果をnullへ畳まず、既存の失敗結果・手動回復表示へ投影する。公開結果には生PathやRecordを追加せず、CurrentStateは既知の場合だけ取得世代へ結合した非Authority参照を返す。marker処置でも取得の元理由を保持する。

取得失敗では業務処理を開始せず、同じScopeは残存Fileによって再取得を拒否する。descriptor終了不明を正常解放へ変えず、自動再試行やFile削除をしない。これだけを理由にWorkbench／MCP全体を終了する新機構は設けない。Coordinatorの既存停止方針は各Ownerの責務として保持する。明示回復では、失敗した取得元を含む全関係Processを停止する。

`lock.assertLive()`と一回限りの`lock.release()`は、Lock Identity・Owner・GenerationのRecord、保持descriptor、PathのFile実体と親Directoryを照合する。不一致・不明なら削除しない。close失敗も削除せず、正常解放後の正当な次世代を再削除しない。

## 接続する保護対象

| 保護対象 | 所在・IdentityのOwner | wxの所在 |
|---|---|---|
| Domain汎用Store／AM | 各Store Owner | 検証済みStoreの固定Lock。現行値の確認から保存・読戻しと終了処置まで |
| CurrentState Reader／Writer／Recovery | Domain Model | Repository直下`.crdd/current-state.<binding>.lock`。Readerの一貫観測、Writerの元版検査から保存・読戻しまでの短期区間 |
| Provider Home | Native観測により上位が確定した所在・安定Home Binding | 既存ProviderHomes親Directoryの`provider-home.<binding>.lock`。Repository横断で共通。Home使用前から技術終了条件の確認まで、不明なら解放成功にしない |
| 共有Runtime状態／Decision | Coordinator | 既存RuntimeState内の`docker-state.lock`。既存の状態遷移の読取りから確定・終了確認まで。Repository・Home別名には分割しない |
| Host操作世代 | Coordinator | 対象Rootの親Directoryの`host-operation.<generation-binding>.lock`。子Root清掃後まで保持 |
| EI履歴Writer | Execution Intelligence | 既存履歴Directoryの`history.lock`。pending検査から保存・pending終了処置まで保持 |
| Topic／Meeting | Domain Model | 既存種別Rootの`.TOPIC-xxxxxx.lock`／`.MTG-xxxxxx.lock`。改訂確認から保存／削除・読戻しまで保持 |
| 一時Operation | Domain Model | 既存`.operations/<operationId>.lock`。再入場の最初の変更前から公開・読戻しまで、終端では文書・資源回収まで保持 |

EI、Topic／Meeting、一時Operationも同じ`acquireLock`を利用する。別のFile排他方式・PID判定・自動奪取を持たない。各OwnerにはScope、保持区間、保存・世代・一次失敗と終了不明の合成だけを残す。固定名は旧所在を維持するため大文字と先頭dotも許すが、単一basename、長さ、`.lock`終端、`..`・区切り文字拒否は維持する。

一時Operationの業務文書のstaging／hardlink公開は保存処理として残す。Lock専用のstaging、active／released文書、hardlink公開、PID不在による自動削除は撤去する。Lock解放だけが失敗した場合、資源回収済みを巻き戻して資源や業務文書を再生成しない。同じOperation参照でLock残存を示し、停止下の明示処置後に直接不存在を確認する。

旧Pipe／Worker／Supervisor取得API、子起動・ready往復・喪失Promiseは撤去する。代わりの監視Promiseや自動回復は作らない。Hostの通常取消とDI Completionは維持し、Effect前・待機後に上位が保持を確認する。待機中の能動的喪失通知は提供しない。File保持が不明ならHost破壊的清掃へ進まず、回復記録を保全する。

## Source構成

| Source | 責務 |
|---|---|
| `src/index.ts` | 上記1関数と4型の公開 |
| `src/types.ts` | 入力、取得参照、保持handle、取得結果 |
| `src/operations.ts` | wx取得、元世代の保持確認、一回解放 |

## 状態と順序

| 段階 | 処理と観測 | 次段階／終了条件 |
|---|---|---|
| 未取得 | 入力・既存Directory・canonical Pathを検査し、Ownerと取得Generationを用意 | 拒否では業務処理へ渡さない。Directoryを新設しない |
| 取得要求 | 固定Pathをwx作成しdescriptorとFile Identityを取得 | EEXISTは非取得。新規作成後の失敗は同じ参照へ残存を結ぶ |
| 初期化 | 非秘密Recordを書込み、fsync、元実体と親を再照合 | 完全に成立した場合だけacquiredを返す |
| 保持 | descriptorを所有しassertLiveでRecord・File・親の一致を観測 | 生存監視は行わない。保持不明を業務続行の根拠にしない |
| 解放 | 一回だけ元実体を確認しclose、再照合、元Path削除、事後観測 | 元File不存在、または異なる正当な次世代を確認した場合だけtrue。次世代は削除しない |
| 失敗・Crash | 初期化残存、close不明、差替え、解放不明を保全 | 通常再取得は拒否。停止下明示回復は別の操作でありreleaseの再送ではない |

取得結果の参照は対象照合用の非Authorityである。Path・PID・Generation単独から削除許可や業務上の実行許可を生成しない。releaseのbooleanはLockだけの終了結果であり、Task・保存・Docker回収成功ではない。

## 失敗と回復

| 失敗地点 | 結果・保持 | 禁止する補完 |
|---|---|---|
| 入力不正・作成前観測不能 | 非取得の固定理由。確認できない参照を推測しない | 不明を不存在として新規作成しない |
| EEXIST | lock_existsで停止。既存bytesは保全 | 自動待機・時刻/PIDによるstale判定・奪取なし |
| wx後の書込み／sync／初期照合失敗 | lock_initialization_failed、同じ取得参照、残存とdescriptor終了の個別結果 | 空Fileを安全な不存在へ読み替えない |
| close失敗 | 元Fileは削除せずfalse／descriptor終了不明を保持 | 未知descriptorを再closeしない |
| 元File・Record・親の不一致 | 保持を肯定せず、解放時もPathを削除しない | 同名の別世代を自己資源として扱わない |
| 削除失敗・事後観測不能 | release=false。Ownerが業務結果と別に回復必要を保持 | 削除要求の成功を不存在確認へ読み替えない |
| Crash残存 | 再取得はEEXIST。全利用者停止と再起動抑止下で対象・元世代・実体を確認する | Owner PID不在だけで回復許可を生成しない |

## Implementation Structure

| 観点 | 適用 | 判定理由 | 成立させる構造 | 局所責務・不変条件 | 失敗・変更時の影響 | Qualityへの導出キー |
|---|---|---|---|---|---|---|
| Variation | N/A | OS別・VCS別の差替えは提供しない | 固定wx実装 | 単一Host・ローカルFilesystem限定 | 新環境採用時は保証から再評価 | N/A |
| Common Contract | Required | 複数Ownerが同じ排他を利用する | LockRequest／LockResult／Lock | 保存SchemaとScopeは各Owner | 取得結果の搬送を全Consumerで確認 | `lock.cooperative-file-lifecycle` |
| Creation／Selection | N/A | Directory・Scope選択を上位へ残す | Owner確定値を受け取る | 自動探索・Registryなし | 新ScopeはOwnerで保持区間を評価 | N/A |
| State-dependent Behavior | Required | 取得・保持・解放を区別する | 短命handle内の状態 | 一回解放、終了後の旧世代操作拒否 | 原因・残存の相関を保持 | `lock.cooperative-file-lifecycle` |
| Composition／Recursion | N/A | 複数Lockの合成・順序管理を提供しない | 一対象ごとの取得 | 複合保存やTask調停を所有しない | 複数Scopeの順序はOwnerが確認 | N/A |
| Lifecycle Ownership | Required | Fileとdescriptorを所有する | 元参照・保持descriptor・終了確認 | 不明なら保全、回復は停止下だけ | Crash後は運用停止を要する | `lock.cooperative-file-lifecycle` |
| External Boundary | Required | Filesystemとの実境界がある | wx・実体照合・close・削除観測 | 非協調置換を保証しない | 境界変更は実Process回帰が必要 | `lock.cooperative-file-lifecycle` |

## Qualityへの引渡し

| 導出キー | 設計項目種別 | 対象 | 正常条件 | 反証する失敗 | 主な試験段階 | 外部境界の段階 | 観測 | 終了後条件 | 未確認 |
|---|---|---|---|---|---|---|---|---|---|
| `lock.cooperative-file-lifecycle` | Interface／Sequence／Resource | 一対象の協調wx取得・保持・解放 | 一Ownerだけが取得し元世代を一回解放 | 二重取得、別世代削除、初期化・close不明の成功補完、自動奪取 | IT | Direct Boundary | 実Process競合・終了、File/親Identity、元bytes、descriptorと解放結果 | 通常は元File不存在、異常は同じ参照と残存を保持。自己生成fixtureのみ回収 | 実運用の全利用者停止下切替、非協調Process、共有Filesystemは成立未評価／対象外 |

既存QA-000006のERB-IT-003へ接続する。Scope・CAS・業務結果の組合せは各Ownerの既存検証項目に残し、このPrimitiveの成功から全8保護対象の業務完成を推定しない。実AI・Docker・既存Home・過去保持物は試験対象に含めない。

## 現行実装との照合

Source接続と過去の検証結果は[変更トレース](../../../99_Roadmap/Changes/CHG-000082/lock-boundary-design.md#16-整理後候補の全体回帰--2026-11-07)で照合する。共通Lock14件と利用側回帰は確認済みだが、実運用の一括切替・全体QA・Release判断を代替しない。設計のCoveredやConcern PASSを実装試験の評価へ転記しない。

## 信頼境界と運用制約

全Consumer・Recovery・清掃Toolが共通の協調プロトコルを守り、保持中に置換・奪取しないことが前提である。wxは作成の排他性を提供するが、最終所有確認とPath指定削除は原子的な条件付き操作ではない。非協調Processによる最終照合後の置換は保証しない。正規Recoveryは全関係Processを停止し、再起動も防止した状態に限定する。通常処理から残存を消すAPIは提供しない。

単一Host・ローカルFilesystemの保証であり、ネットワーク共有・複数Hostへ拡張しない。Crash後は残存Fileにより処理を拒否する。PIDや時刻を削除許可へ昇格しない。保存CAS、Home排他の取得区間、Effect前記録とDIの終了確認は各Ownerに残す。

旧方式と新方式の間では相互排他が成立しないため、実利用での切替は全利用者停止下で一括実施する。この変更作業で既存Process・過去保持物の停止、回収、移行、有効化を実施したとは扱わない。手順は[Runtime Workflow](../../../19_Workflows/01_Coordinator_Runtime.md#wx-lock-stopped-recovery)、基準Capabilityと検証履歴は[変更トレース](../../../99_Roadmap/Changes/CHG-000082/lock-boundary-design.md)が所有する。

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
