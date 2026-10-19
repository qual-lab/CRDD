# Docker隔離の詳細設計

## Provider実行物の配置所有 — 2026-10-19

`execution/provider-assets.ts`は、Codex／Claudeの固定Image、公式実行物の版・Hash・配置、設定とSeccompの同一性を所有する。AI Adapterの旧`distribution.ts`から移し、過去の署名・認証・送信の「検証済み」定数は引き取らない。返却値は現在の構成記述であり、実Imageの存在・同一性・認証・実行許可の証明ではない。

| 公開API | 入出力と境界 |
|---|---|
| `describeDockerProviderAssets(provider)` | 現在の固定資産記述。TaskとCodex助言の異なるImage・実行物を保持し、Image取得・更新・起動を行わない |
| `describeDockerProviderExecutionLocations(provider, purpose)` | CLIの実行位置・作業位置・Home・Schema／設定位置だけを不変値として返す。AI Adapterの型へ依存せず、Image・Mount・Authorityを含まない |

Coordinatorが同じ配置でCLI計画を準備時とEffect直前に再生成し、既存Image・Seccomp・Packet Hashへ結合する。助言CommandのImage・非共有条件はCoordinator側の技術契約であり、AI AdapterのCLI契約には含めない。AI AdapterからDIへの逆依存、新Registry、永続State、Lock、配布Frameworkは追加しない。設定・Schema本文、実Image・バイナリ・Hash、認証Homeと既存回復参照は変更しない。

今回の移管はSourceと構成結合の回帰対象であり、実Docker／実AIの再実行や保持中の②試験物の処置は含まない。

新Workspace方式への接続は[借用・終了契約](../orchestrator/03_Workspace.md#5-状態競合終了条件)を目標とする。DIは上位が検証・許可した作業対象だけを借用し、実行資源を回収する。継続Workspace／Branchを削除・resetせず、上位Task・採否を知らない。Direct／Candidateの共通方針は本書の採用済み契約に従うが、具体的Mount・書込み保護の本番接続は未完了で、現完成範囲には含めない。以下の実装・検証完了は基準のDI技術分離に限り、新方式の実Mount／取消／成果保全はNot Run。

成果物種別: Architecture詳細設計
詳細設計領域: docker-isolation
状態: 実装・検証完了（本Package範囲。v0.22全体の完成・採用判断とは別）
担当責任者: Qual-Lab
最終更新日: 2026-10-17

## 基本設計との関係

| Architecture定義 | 担当する責務断面 | Relation状態 |
|---|---|---|
| [ARCH-000004](../../Definitions/ARCH-000004/architecture_definition.md) | 許可済み実行の隔離環境開始、待機、取消、終了、所有資源回収 | Partial |
| [ARCH-000008](../../Definitions/ARCH-000008/architecture_definition.md) | 要求、開始、Process結果、一次失敗、資源観測、清掃後条件の区別 | Partial |

新Workspace方式の実Mount／取消／成果保全、実Provider全経路、残る上位Consumerは未完了である。既存の局所実装・検証を基本設計全体のCoveredへ読み替えない。

## 詳細成果物の適用判断

| 詳細成果物 | 判定 | 理由 | 正本節／成果物 |
|---|---|---|---|
| Component Model | Required | DIと上位Owner、Platform Access、Docker Engineの責務を分離する | [§1](#1-責務と変更境界) |
| Interface Model | Required | 許可済み入力、固定command、技術結果と上位通知を分ける | [§2](#2-入力と公開api) |
| Data Flow | Required | 元操作相関、要求、実ID、結果、清掃観測を同じ流れで保持する | [§2](#2-入力と公開api) |
| State Model | Required | pending、実行中、結果不明、清掃不明、終了を区別する | [§3](#3-状態順序失敗) |
| Sequence | Required | 許可、保存、要求、観測、通知、回収の順を保持する | [§6](#6-通知と上位状態の接続) |
| Failure／Recovery | Required | 一次失敗、清掃失敗、親Process喪失、再入場を分ける | [§3](#3-状態順序失敗) |
| Deployment | Required | Host、Container、Network、固定Mount、認証Homeを区別する | [§4](#4-配置保存実行環境) |
| Observability | Required | 実ID、Handle、Process終端、資源不存在を別々に観測する | [§5](#5-qualityへの引渡しと完成条件) |
| Security Boundary | Required | Repository外、Git、内部状態、認証、秘密の境界を保持する | [共通隔離方針](#workspace-isolation-policy) |
| Implementation Structure | Required | 下表で共通契約と具象差を評価する | [Implementation Structure](#implementation-structure) |

## Engineering Concern評価

| Concern | Result | Rationale | Evidence／Related ID |
|---|---|---|---|
| Concurrency | OPEN | Lock、所有Process、同一回復Identityは既存契約にあるが、新Workspace方式の並行借用・終了は本番未接続 | [§3](#3-状態順序失敗) |
| Timing | OPEN | 取消、遅延通知、Process終端を区別するが、新方式の全待機境界は未実証 | [§6](#6-通知と上位状態の接続) |
| Resource Lifecycle | OPEN | 実ID回収と不存在観測は局所成立したが、新Mountと全Consumerの終了後条件は未完了 | [§5](#5-qualityへの引渡しと完成条件) |
| External Boundary | OPEN | Docker／Process境界は実測済みだが、実Provider全体と新Workspace本番接続は未評価 | [現在の接続状況](#現在の接続状況) |
| State／Consistency | OPEN | 既知状態と観測不能を分けるが、上位Workspace状態との全相関は接続中 | [§3](#3-状態順序失敗) |
| Failure／Recovery | OPEN | 一次失敗保持、清掃不明、親喪失を扱うが、追加二領域の実障害Continuationは未実証 | [現在の接続状況](#現在の接続状況) |
| Observability | OPEN | 実ID・名前・Labelと終了後不存在を観測するが、全本番Consumerの観測閉包は未完了 | [§5](#5-qualityへの引渡しと完成条件) |
| Security／Trust | OPEN | 共通隔離方針と固定Path保護は採用済みだが、新方式の実Mountと秘密境界は本番未接続 | [共通隔離方針](#workspace-isolation-policy) |

`PASS`: 詳細設計上、必須条件と反証が閉じている。`N/A`: Architecture上、そのConcern自体が存在しない。`OPEN`: 未解決の設計事項を保持する。`FAIL`: 必須設計と矛盾する。

## Qualityへの引渡し

| 導出キー | 設計項目種別 | 対象 | 正常条件 | 反証する失敗 | 主な試験段階 | 外部境界の段階 | 観測 | 終了後条件 | 未確認 |
|---|---|---|---|---|---|---|---|---|---|
| `docker-isolation.lifecycle` | Resource／Lifecycle | 許可済みDocker／Processと所有資源 | 元操作相関、固定構成、実ID、終端を同じ操作で確認する | 要求受理＝Effect成立、取消要求＝終了、名前だけで削除、観測不能＝不存在 | IT／ST | Direct Boundary／System/E2E | Process、Container、Network、Mount、Label、Imageの実観測 | 所有Handle終端と実ID・名前の不存在 | 新Workspace方式の実Mount／取消／成果保全、全Provider経路 |
| `docker-isolation.failure-recovery` | Failure／Recovery | 結果不明、清掃不明、親Process喪失、再入場 | 一次失敗と清掃結果を分離し同じexact回復Identityで再観測する | 不明の成功化、別Identity生成、他Owner資源の削除、履歴値だけの不存在推定 | IT／ST | Direct Boundary／System/E2E | 保存済み相関、現在資源、一次・二次結果 | 未解決参照保持または正式回収完了 | 追加二領域の実障害Continuation |
| `docker-isolation.security-boundary` | Security／Trust | 作業Tree、Git、内部状態、認証Home、秘密 | 許可対象だけをMountし保護対象をROまたは非公開にする | Repository外書込み、保護Path変更、秘密の明示複製、別名経路の未検査許可 | IT／ST／UAT | System/E2E／User Acceptance | 実Mount、Path実体、書込み結果、Host側不変 | 試験物回収、保護対象不変 | 新方式の本番Mount、実Provider、利用者確認 |

## 現行実装との照合

Docker Isolation Packageの既存技術境界、実ID回収、限定故障・回復、公開CLI取消等は局所実装・実測済みである。一方、新Workspace方式の実Mount／取消／成果保全、全Provider経路と全Consumer閉包は未完了であるため、上表のRelationとConcernは`Partial`／`OPEN`を維持する。過去署名Evidenceや単一runの結果を現行全体の成立へ流用しない。

## Implementation Structure

| 観点 | 適用 | 判定理由 | 成立させる構造 | 局所責務・不変条件 | 失敗・変更時の影響 | Qualityへの導出キー |
|---|---|---|---|---|---|---|
| Variation | Required | DirectとCandidate、複数Provider形状がある | 共通隔離方針＋用途別計画 | 方式差で保護境界を弱めない | 別方式だけの越境 | `docker-isolation.security-boundary` |
| Common Contract | Required | 全入口で同じ資源・失敗・回収意味を使う | Package Rootの技術契約 | 上位がDocker argvを再定義しない | Consumer間の終了差 | `docker-isolation.lifecycle` |
| Creation／Selection | Required | 許可済み対象・構成だけを開始する | 固定入力検査と計画 | 入力不正・開始前取消でEffect 0 | 誤対象・余剰資源 | `docker-isolation.lifecycle` |
| State-dependent Behavior | Required | pending／実行／不明／清掃を区別する | 技術状態と回復Identity | 観測不能を成功・不存在へ畳まない | 二重要求・誤回収 | `docker-isolation.failure-recovery` |
| Composition／Recursion | Required | Coordinator／Orchestratorと下位技術境界を合成する | 通知と用途限定projection | 下位は上位判断を所有しない | Authority逆流 | `docker-isolation.lifecycle` |
| Lifecycle Ownership | Required | Process・stream・Container等にOwnerがある | 所有Handleと実IDの追跡 | 他Owner資源を削除しない | Leak・誤削除 | `docker-isolation.failure-recovery` |
| External Boundary | OPEN | Docker／OS／Provider実境界を使う | 固定CLI・実Process・実資源観測 | 全Providerと新Workspace方式は未完了 | 局所成功の全体化 | `docker-isolation.security-boundary` |

<a id="workspace-isolation-policy"></a>

## Workspace方式の共通隔離方針（採用済み・借用実行接続中）

DirectとCandidateは同じDocker隔離方針（Docker Isolation Policy）を使う。作業対象が現在Treeか独立Worktreeかという差を、別の秘密管理・隔離Frameworkへ分岐させない。助言等の読取り専用と変更実行のRW条件は、用途に従って区別する。

| 対象 | 採用した扱い・責任境界 |
|---|---|
| ローカル開発用`.env` | 配置を許容し、Coding AIが読める可能性を人間が受容する。AIが読んだ内容がProviderへ送られ得る残存リスクもある。公開情報への分類変更や、CRDDが値をPrompt・Task Packet・通常logへ明示複製する許可ではない |
| 本番Secret | Gitおよび通常のローカル開発環境に置かず、GitHub・GCP・AWSの既存Secret管理を使う。Git管理外に置くだけで満たしたとしない。Cloud接続・秘密取得・AIへの自動投入機能は今回追加しない |
| 開発用Credential | 本番アクセス権を与えず、被害を限定できる権限と有効期限を既存の資格管理側で設定する。具体的な権限・期限は環境の運用責任者が確認する前提。DIが値からCloud権限・期限を自動検証／強制したとはしない |
| 残す技術境界 | 未許可Repository外のHost書込み、`.git`と実Git管理領域への書込み、`.crdd`内部状態への書込みを禁止する。Provider専用認証Home・Access Managementの鍵は開発用`.env`とは別区分で、既存保護と現在認可を維持する |
| 共通化するもの | 両方式のHost／Git／内部状態／認証境界と資源の開始・終了・取消・清掃。共通方針の採用を共通実装・全Consumer接続済みの証拠にしない |
| 追加しないもの | CRDD独自Secret Manager、ファイル単位ACL、動的Mount許可Framework。開発用`.env`を隠すための個別Mount列挙は新方式の必須条件にしない |

`.env`という名前だけで内容を開発専用・安全と判定しない。本番資格やProvider認証用秘密を開発用`.env`へ混ぜることは許容範囲外である。情報分類と既存の外部送信同意は維持し、「AIが読める可能性の受容」を無関係な送信先への包括同意にしない。CRDDによる既知秘密の明示収集・出力防止と、Coding AIが共有Treeから開発情報を読む可能性を分ける。

Candidateへローカル`.env`や資格を自動複製／注入しない。共通方針は同じファイル集合・書込み権限を要求せず、固定Baseからclean Worktreeを作る既存の採用判断を維持する。ファイルの別名から開発情報が読めること自体を新たなFail条件にしない一方、別名経由のGit／内部状態書込み等の必要境界は未実証のまま保持する。

本節は2026-10-17の人間判断を正本化した目標契約である。以前の一律秘密隠蔽案と合成試験は[変更計画の履歴](../../../99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#9-開発情報と共通隔離方針の変更2026-10-17)として維持する。Sourceの既知秘密拒否・候補投影・Provider保護は、採用した区分と利用側を照合してから切り替え、文書変更だけで撤去しない。新方針の実装・実境界はNot Run。

### 固定Path書込み境界の限定確認

本番の借用入口でも、作業Tree、空のGit placeholder、空の内部状態placeholderの三本を計画する。Reviewerだけ作業TreeをROとし、保護二本は両役割ROで固定する。回収期待値は元placeholder Sourceを保存して照合し、Mount欠落・余剰・RW化・Source差では構成一致としない。新しいMount台帳・Lock・回復方式は追加しない。実Providerの新方式E2Eは未実施である。

2026-10-17の承認済み合成試験では、作業TreeのRW bindと、`.git`の型に合う空placeholder・`.crdd`空DirectoryのRO bindという三Mountで、Directory型とポインタfile型の固定Path書込み境界が成立した。通常Sourceの書込みと開発dummy.envの読取りを確認し、保護Pathの書込み・rename・unlinkは拒否、Host保護対象不変と試験物回収を確認した。[実行版・条件・限界](../../../99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#固定path書込み境界の承認済み限定結果2026-10-17)を参照する。

これは共通構成の採用候補であり、製品Sourceは未対応である。Secret完全隠蔽、あらゆるlink経路、任意Repositoryの保護や実Provider全体の成立を保証しない。実Git管理領域が別名で露出する場合や、保護Path不存在時の扱いを今回の成功から補完せず、本番接続前の適用条件とする。新しいACL・動的Mount管理・Recovery機構は追加しない。

### 現在の接続状況

2026-10-17の完成監査では、Task・Workbench助言・診断・修復・再起動・CLI回復は本PackageのRoot APIへ接続し、旧Coordinatorの`docker-desktop`／`docker-execution`／`runtime`は撤去済み。通常実行のCRDD署名前提も撤去済みであり、過去の署名Evidenceは新経路の証明に使わない。再認証の技術構築と上位の旧Docker環境profileは同監査で是正し、Source限定再レビューは両観点指摘0。§5の検査と実境界を現在計画へ照合し、本Packageの実装・検証を完了した。

上位の真正Owner／Writer／CLI、保持receipt・履歴保護・終了整理とfresh Taskへの接続は実装・局所検証済み。各技術部品の検証と実境界の成立は区別し、現在の判定は本節と§5の完成条件で行う。実境界で未実証の条件を完了へ読み替えない。

| 実境界 | 現在の根拠と限界 |
|---|---|
| 隔離・実ID回収 | 五資源の構成、実IDでの回収と不存在を確認。全Provider経路の成功ではない |
| 限定作成不明 | 認証確認用createの故障注入から同IDの正式終了を確認。汎用unknownへ一般化しない |
| 修復と退避物 | 新世代起動・Engine readyを確認。Windows自動disposalは拒否され、承認済みWSL保守後に同IDを正式終了。追加二領域の実障害Continuationは未実証 |
| 公開CLI取消 | executor実開始・稼働後の実Ctrl+C、回収・cancelled履歴・現在待ち0を確認 |
| 公開CLI親喪失 | executor完了後のreviewer準備中に親CLIだけを終了。Receipt保存再入場と両元IDの正式回収・現在待ち0を確認。executor実行中の親喪失とは区別する |
| 公式CLI実物 | 固定Image通常入口の版・三Hashと隔離・回収を確認。再Build・Host機能・全E2Eの証明ではない |

最新Sourceの通常全回帰は1,926件中1,912成功・9失敗・対象外5で終了した。失敗は試験VMの本番predicate接続漏れであり、試験一Fileだけの是正後24件成功・静的検査成功・両独立レビュー指摘0。未変更母集団と対象再検証を対応付けた現行評価は1,921成功・対象外5・未解消失敗0で、単一run全件成功とは扱わない。DI通常337件、実Host Process7件、認証隣接30件、状態回収の実Windows42件と上表の実境界を§5へ照合した。実測の詳細・元失敗・適用限界は[現在計画](../../../99_Roadmap/Changes/CHG-000082/second-stage-plan.md)を正本とする。

## 1. 責務と変更境界

<a id="ui-spec-detail-placement"></a>

### UI／SPEC Detailの配置分担

中央の[UI／SPEC Detail Architecture Traceability](../../08_UI_SPEC_Detail_Traceability.md)に対し、本領域はARCH-000004／ARCH-000008の次の8関係の技術担当だけを持つ。ARCH-ID・Owner Mode・UI／BHVの意味・QA義務は変更しない。

担当Interaction Relation: `PRT-000002.spec-000002`、`PRT-000002.spec-000003`、`PRT-000002.spec-000028`、`PRT-000003.spec-000004`、`PRT-000003.spec-000005`、`PRT-000005.spec-000009`、`PRT-000011.spec-000005`、`PRT-000012.spec-000017`

| 関係 | DIの技術担当 | 上位に残す責務・禁止する読み替え |
|---|---|---|
| PRT-000002.spec-000002／BHV-000002 | 受理後の別状態から呼ばれる隔離実行 | 受理自体はTask作成のみ。受理からProvider Effectを発行しない |
| PRT-000002.spec-000003／BHV-000003 | 既存の技術観測・通知を状態の根拠として返す | 状態照会は読取り。照会ごとに新Probeを発行しない |
| PRT-000002.spec-000028／BHV-000028 | 検証済み対象の技術取消、Process／Container終端、所有資源の回収・不存在／不明の観測 | Task／試行／世代／Authority検査、取消一回の編成、状態・Recovery保存、競合結果と利用者結果は上位へ残す |
| PRT-000003.spec-000004／BHV-000004 | 次行動分類に使う既存の実行・回復観測 | 分類判断は上位。分類から回復Effectを発行しない |
| PRT-000003.spec-000005／BHV-000005 | 許可されたDocker／Processの回収・終了後観測 | 対象・Authority・保存・保持判断は上位。一般Filesystem清掃を引き取らない |
| PRT-000005.spec-000009／BHV-000009 | 許可済み技術Probe・故障境界観測 | 診断許可から修復／再起動Authorityを生成しない |
| PRT-000011.spec-000005／BHV-000005 | 共同清掃のDocker／Process担当と終了後観測 | 実行時データの保持・削除判断と保存OwnerはARCH-000011側に残す |
| PRT-000012.spec-000017／BHV-000017 | 同じTaskに相関する実行通知・終了／回収事実 | 引継ぎ・現在Grant・結果取得・再発行は上位。結果再取得時のDocker操作を必須にしない |

対応するSCR／PRTは000002・000003・000005・000011・000012、BHVは000002・000003・000004・000005・000009・000017・000028。SCR-000011自体の保存意味は移さず、共同Relationだけへ参加する。取消28では技術取消・終端・所有資源観測だけを担当し、判断返却29は判断記録と再開可能通知まででProvider作用を開始しないため担当外である。この表は配置対応であり実境界の成立証拠ではない。以降の技術契約はこの担当範囲で適用する。

現行Sourceの依存方向は、同Packageのsrc、Node組込みModuleとPlatform AccessのRoot公開入口に限定する。上位Packageへのtype-only参照も逆依存として扱い、PA内部へのdeep importを置かない。通常の配置回帰は`tests/integration/package-boundary.contract.test.ts`が現src全数と反例で確認し、必要な技術入口四件は実Root exportへ接続する。これは署名・実行許可の検査ではない。試験の限定構文や未評価範囲はQA-000006を正本とし、旧署名graphの完全解析を再実装しない。

Proxy Containerの固定包装と認証Home環境は既存`execution/command-plan.ts`が所有する。九操作の構築と保存済みProxy包装の照合は同じ22引数のprivate構築を利用し、投影はcreate_proxy一件・二env・固定option・末尾image／payloadなしを全文照合してprofile/tokenだけを返す。上位は元Providerとの意味相関を検査し、Docker argvを走査しない。認証HomeはProvider metadataの環境名または明示不使用だけから固定生成する。元正常九argv・Hashは維持する。

同じFileの`dockerIsolationResourceIdentityIsValid`は、五資源名・所有Label・二Image digestの文法と五名の重複だけを判定する。planner自身と上位の計画・開始・初期Identityの三利用側が、非秘密の八項目を明示投影して共用する。文法が正常でもTask・Provider・Home・Authority・Packet・元commandの意味相関は上位が別途検査する。既存回復の再入場・Receipt照合・清掃・配送へ新しい条件を追加せず、文法成功を所有権・存在・削除許可へ昇格しない。

固定Seccomp Artifactの実体照合は既存`execution/command-plan.ts`の非公開Resolverが所有する。上位は適用要否とProvider metadataの期待Hash／bytesだけを渡し、固定Host Pathを取得・搬送しない。DIは同じ固定実物のfile・非link・native realpath・容量・読取り前後dev／ino／size／mtime・本文Hashを照合し、Docker optionを構築する。例外・不一致・欠測と旧Path入力は計画不成立とし、nullを適用外へ補完しない。初回計画・発行前の再計画は固定実物を再観測し、import時の先行観測・Cache・新しいAuthorityは追加しない。開始済みの元Contextの清掃は同じplan identityとOwnerを照合し、Seccompの再読取りを清掃条件にしない。

Task回復の本番技術組立は既存`cleanup/recovery-executor.ts`の`createDockerTaskRecoveryExecutor`が所有する。Coordinatorからは既存管理領域と同期の現在Owner確認だけを受け、低位入力を明示構築して固定CLI検証・最小環境を結合する。CLI snapshotはmodule共有の元寿命を維持し、初回観測成功後は別Executor・close後も同実体を再確認する。構築時には短命configの既存Filesystem処置だけを行い、環境は各要求時、CLIはその後に取得・再確認する。環境不明とCLI不明の理由を分け、再検証失敗から再観測へfallbackしない。低位factoryはDIの直接技術試験に維持するが、上位はそのCLI／環境注入を使用しない。Owner・config再照合・元executor／closeの順序と回収結果は変更しない。

ProbeのImage、Name、Label、保存用Engine識別と技術profileは既存`execution/probe-command.ts`の`describeDockerProbeResource`から投影する。作成argv、inspect期待値、上位の既存回復記録はこの同じ記述を参照し、上位がWindows／Desktopの固定値を再定義しない。記録Schema・保存field・Hash／Token形式は変更しない。この記述の取得は実資源の存在や実行・回収の許可ではない。

Attach試験用の三シナリオと観測待機は製品Coordinatorから撤去し、既存DIの実Process試験が直接所有する。ready・overflow・終端要求一回・元closeのOracleを維持し、上位のSTや実Docker取消の成立へ昇格しない。

Probeの本番固定bindingは既存`execution/probe-runtime.ts`が所有する。生成順は対応platform確認→CLI snapshot観測→上位の同期management読取り一回→固定env領域生成とし、CLI観測失敗と上位Mount読取り失敗を同じ理由へ畳まない。読取りcallbackは返却後保持せず、上位Host型や保存処理をDIへ持ち込まない。Promise・不正な所在では環境領域を作らず停止する。bindingは同操作のsnapshotと環境だけをclosure所有し、fresh CLI検証は生成時でなく各要求直前に維持する。通常・四故障・取消・稼働残存・fresh回復のすべてで、途中再生成せず同じbindingを用いる。回復時は上位の世代取得とrecord／Root／child検証後に生成し、Host相関と最終公開は上位が所有する。

Probeのinspect構成と三つのbind mountの実体照合は、DIの`execution/probe-configuration.ts`が所有する。上位は同じProbeのid／probeId、必須profile、workspace／providerHome／tmpの三PathをDIの純粋describeへ渡し、期待構成を投影する。現行profileは一候補、旧record採用一箇所の明示`legacy_recovery`だけ固定六候補を選ぶ。欠測・空・未知profileへ候補集合を補完しない。構成判定は投影済み候補へのmembershipを照合し、上位の6領域全体、Host能力、保存Ownerを受け取らない。固定Image／Name／Label、pids64、三RW mount等の現行条件を維持する。Filesystemは各mountで観測側→期待側の順に各一回realpathを読み、例外はfalse、Windowsはen-US小文字、他OSは完全一致とする。これは実資源の包括的な安全性や新しいAuthorityを与える処理ではない。

診断Probeの作成IDと三軸（実ID・名前・Label）の不存在応答は、DIの`execution/probe-result.ts`が純粋分類する。作成は既存条件どおりerrorなし・終了値0・完全64桁IDだけをconfirmedとし、三軸不存在は各応答が成功・UTF-8 64KiB以内・不正／重複IDなしで、すべて空の場合だけconfirmedとする。失敗・欠測・残存を空集合へ補完しない。上位は分類値を使っても、Host遷移・保存確定・世代排他・Authorityを下位へ移さず、現在Taskの異なる隔離構成へProbeを偽装しない。移管で分類条件を強化・緩和しない。

診断Probeの現在構成観測と限定回収は`execution/probe-container.ts`が所有する。構成一致時はRunningの肯定事実だけを返し、falseを停止・不存在と解釈しない。回収は過去の観測を再利用せず、同じ呼出しで構成再確認→完全実IDの削除→実ID・名前・Labelの三軸不存在を順次確認する。不存在だけの観測は削除を発行しない。上位は私有Container参照を照合し、成功時だけ元のCLI・Host・Root・実IDに結合した私有不存在参照を登録する。下位の戻り値を外部から再投入する入口や新しいAuthority管理機構は設けない。作成・start・attach・取消全体と旧回復記録の移行は、この観測・回収単位の完成とは別に確認する。

停止前拒否の診断は、既存Machineが実際に得た判定から固定の`stopFailure`を返す。初回の信頼確認、Client Process、Desktop Process、backend、Engine、Container不存在、境界失効、停止要求、停止待機、最終停止観測、例外を区別する。追加の観測や再試行は発行せず、既存の短絡順序・期限・要求数を維持する。停止成功・停止未実施・起動側失敗ではnullとし、次のstop開始時に前回値を破棄する。Runtime返却とsettled通知へ同じ値を搬送し、cleanup不明でも停止失敗の詳細を消さない。これは非Authorityの診断であり、既存reason／primaryFailure、耐久checkpoint、回復可否、終了条件は変更しない。Sourceと反証の完了前は実装済みと扱わない。

修復準備の`ownerBindingSha256`は、同じNative Mutexに用いる選択利用者のprincipal identity hashである。Task／旧修復記録の認証Session等を含む`localUserBindingHash`とは別計算で、同値を要求しない。現在の相関取得をWriter Authorityへ昇格せず、修復Identityの新fieldと真正Ownerへの接続を別に確認する。

Docker Isolationは、Docker資源、所有子ProcessとDocker実行環境の技術Ownerである。通常隔離に加え、診断と、上位が許可した実行環境の停止・開始・限定修復の実処理を所有する。Containerを復元して継続するのではなく、所有資源の終端状態を確認し、上位が新しい実行を開始できる状態へ戻す。独立Server、CLI、履歴Store、共有Registry、Lock Frameworkは設けない。

助言Imageの`--init`適用条件は、AI Adapterから既存`execution/command-plan.ts`の`codexAdviceProviderInitRequired`へ移管した。`workbench_advice`と現行／保持対象旧Imageのexact二Digestだけを受理する。通常Task、Claude、未知・空・欠測Digestへ条件を拡張しない。上位の計画・Effect直前照合・元Recoveryの期待構成は同じDI公開関数を利用する。現在のAI配布記述との一致は利用側試験で確認し、DIからAI Adapterへの依存は作らない。返却値だけではInitの実観測、Process終端や回収成功を意味しない。新しいState・Registry・Lock・回復経路は追加しない。

### 起動失敗の診断

起動側は固定`startFailure`で、停止未確認、起動前の初回信頼・Client Process・Desktop Process・Engine・backend・最終信頼、境界失効、起動要求拒否、Ready信頼拒否、既存待機期限、例外を区別する。各startで初期化し、成功・起動未実施はnullとする。停止済み再観測の順・短絡・回数と既存期限は変えず、診断用の追加観測や再試行を行わない。Runtime返却・settled通知・上位の結果・手動試験器へ同じ非秘密値を搬送する。`stopFailure`、一次失敗、Effect不明、資源回収、処置許可を上書きしない。詳細位置は耐久checkpointへ追加せず、既存の再起動失敗理由の履歴保全と区別する。起動前拒否または評価例外は起動要求未発行のままで、起動要求直前以降の例外はEffect不明を維持する。

### Probe起動・取消の集約契約

固定六profileのpayloadと期限は`execution/probe-runtime.ts`だけが所有する。作成計画は既存の固定command plannerへ委譲し、inspect／回収の期待構成も同じprofileから純粋投影する。Coordinatorの私有Container Identityは必須profileを保持し、通常・四故障・取消・稼働残存は現行profileを明示する。旧recordの採用箇所だけは`legacy_recovery`を明示し、固定六候補を使う。profile欠測・空・未知をlegacyやnormalへ補完しない。永続recordのSchemaは変更しない。上位の試験用三中継は撤去済みとし、固定argvはDI planner、本番のprofile・Probe ID・三Path・binding搬送は既存上位Caller試験で確認する。構成投影そのものは観測成功・実行Authorityではない。

固定取消は`runDockerProbeCancellation`が、保存後のattach前、ready後、候補成立後の三地点で同期の三Path読取りと固定構成inspectを行う。各読取りは初回Pathと一致させ、欠測・Promise・accessor・Proxy・差替えは前進停止とする。readyとcompletionの待機、SIGTERM要求は各5秒、猶予計測にはtimeout／overflow時の必要なjoin時間を含める。期限後の遅延肯定で結果を巻き戻さない。一次失敗、最終理由、post構成確認、attach終端観測と実終端要求数を分離して返す。joinの例外・不明は最終技術理由を上書きするが、上位の既知Container補償回収を妨げない。上位は二保存・同ID・Host清掃を維持し、候補・post確認・attach終端・Host清掃がすべて成立した場合だけ公開verifiedにする。稼働残存開始は同じ技術群でfresh構成→固定start一回10秒→fresh構成かつRunning肯定を行い、成功時の自動回収はしない。これらは一般の外部取消APIではなく固定診断の移管であり、実Container取消と実稼働回収の成立は別に検証する。

完了まで待つ固定診断のCLI要求・profile別期限・実時計測は`execution/probe-runtime.ts`、捕捉結果の純粋分類は既存`execution/probe-result.ts`が所有する。CLI再確認を含む要求直前から要求完了までを計測し、生stdout／stderr／例外本文を上位へ返さない。隔離判定とlifecycle候補の条件は別に保つ。前者の既存条件にSignal拒否やstderr空を黙って追加せず、後者で終了envelope、各64KiBと整数0〜30000msを評価する。上位は閉じた事実を公開fieldへ投影し、私有相関・回収・Host清掃の確認後だけ既存の最終評価へ進める。これらの値分類や同期要求の成功は、実取消・実回収・DI集約全体の完成ではない。

固定診断のEngine確認、作成、作成後の実行と取消はDIの一つの技術群へ集約する。上位の前後二保存を跨ぐ自動pipelineや、操作ごとの薄い公開wrapperを追加しない。

| 段階 | DIの責務 | Coordinatorに残す責務 |
|---|---|---|
| 実行前 | 既存version要求とerrorなし・終了値0・trim後linuxの判定 | 拒否時にHost submission／createを開始しない |
| 作成前 | 固定profileとpayload・timeoutの閉じた対応 | Host submissionと実ID未確定の回復記録を保存する |
| 作成 | 固定構成のcreate一回と完全実IDの応答分類 | unknownを同じ回復参照へ保持し、推測ID・再create・startを行わない |
| 作成後 | ID保存前にstartを自動発行しない | exact IDを相関し、ID入り記録の保存を確認する |
| 実行 | fresh構成確認、完了まで待つ実行または意図的な残存開始、技術結果・実時計測 | profile選択、既存公開lifecycleの解釈、保存とHost相関 |
| 取消 | attach取得からready・Running肯定・SIGTERM・完了・必要な終端joinまでを所有する | await間の現在mount／Owner読取りを既存の狭い確認として提供する |
| 回収 | 既知exact資源の限定回収と観測結果 | 私有相関、Host清掃、公開結果と耐久保存 |

取消await間の確認は、既存の三Path／現在性の読取りだけとする。Writer、Store、Host token、任意処置を下位へ渡さない。確認不能または例外後は新たなstart・SIGTERM等の前進Effectを発行しないが、取得済みの同じ所有handleの終端・joinや、既知exact Containerの補償回収は継続する。close不明を正常完了にしない。技術返却値では元実行失敗と回収結果を分離し、公開reasonの現行優先順は移管を理由に変更しない。

旧回復記録がprofileを保持しない場合の固定payload全候補は、旧回復経路に限定してDI内部で照合する。通常経路へ任意source／timeoutを公開しない。実行中残存の作成は成功時に自動回収せず、旧回復経路はcreate・start・attachを行わない。実取消・実行中Container回収の成立は合成試験だけから主張しない。実装、上位の二保存と要求列の反証、必要な実境界が成立するまでは、この契約を実装済みとして扱わない。

| 基本設計 | 具体化する断面 |
|---|---|
| [ARCH-000004](../../Definitions/ARCH-000004/architecture_definition.md) | 隔離環境の開始・待機・取消・終了と所有資源の回収 |
| [ARCH-000008](../../Definitions/ARCH-000008/architecture_definition.md) | 要求、開始、Process結果、一次失敗、資源観測を区別した診断 |

| Owner | 所有する内容 | 下位へ渡す内容 |
|---|---|---|
| Coordinator | Task／助言、選定、送信許可、Provider Home利用許可、回復記録との相関 | 検証済み技術計画、既存Ownerに結合した所在・環境・資源Receipt |
| AI Adapter | 公式CLIの起動記述とProvider出力の解釈 | コマンド・stdinの記述。モデル／役割の意味は渡さない |
| Docker Isolation | Dockerコマンドの実発行、所有Process、Container／Network構成の観測と回収 | 開始・終了・出力制限・清掃の観測事実 |
| Orchestrator | Task／Attempt、Queue、耐久受領、再試行・採否判断 | Coordinatorの公開APIを利用。下位資源Stateは複製しない |

実行環境への運用介入を許可する判断と、その正本状態・相関は上位に残す。Docker Desktop／WSL等の実処理と技術観測は下位内部へ移し、Coordinator／OrchestratorはOSやDocker配置形態を選択・判定しない。公開Surfaceのユーザー資格、Role、ExposureはAccess Managementへ残す。

## 2. 入力と公開API

認証用の公開`createDockerAuthenticationRuntimeFactory()`は、既存`execution/authentication-command-runtime.ts`が固定CLI snapshot、最小環境、System32の実Directoryを構成する。上位の認証dependencies生成時に一回呼び、従来の初回観測時点・例外経路とsnapshot寿命を維持する。同Factoryは元技術planだけからRuntimeを作り、各execute前に最初のsnapshotを再検証する。不正plan・観測不明・再検証失敗から新snapshotへのfallbackやProcess開始を行わない。元計画との結合、対話非捕捉、確認済み削除commandの一回使用とProcess回収は既存Runtimeが所有する。注入可能な`createDockerAuthenticationRuntimeUsing`は内部試験だけが参照し、Rootへ再公開しない。上位汎用環境の旧`docker_cli`／`docker_desktop_repair_helper`選択は撤去し、Host／保存用の一般環境をDocker技術へ兼用しない。

### Desktop修復の内部Host操作

保存前の技術準備では、同じNative子の初期RとArtifact再確認Vの後、Repair06専用Hで同じ選択利用者のHashを取得する。NativeがMutex名へ使った捕捉値と同じ値を返し、Nodeは元子・command順序と有界frameへ結合する。これは非Authorityの相関であり、保存Ownerや実処置許可の代用ではない。旧RuntimeState Rootから利用者を逆算しない。上位への本番準備通知と保存専用Ownerは接続済みだが、Hの取得だけで全体完成としない。

技術checkpointの純粋契約は`desktop/repair-checkpoint.ts`が所有する。Rootは型、厳格decoder、局所遷移validator、九処置の純粋終端predicateだけを公開し、処置を実行しない。固定九処置を意図保存・発行観測・結果観測に分け、初回／起動失敗世代／補助領域の期待実体とsource／retainedの四状態を持つ。生Path、任意用途、Provider／Home、署名履歴、人間の保持判断は持たない。上位は同じ保存モデルの修復variantにこのDTOを保持するが、DIのkey・遷移を再実装しない。unknown・確定結果・保持済み実体を巻き戻さず、前処置の結果不明のまま後続Effect用の意図を受理しない。現在cleanupと最初のcleanup失敗は別に保持する。codec単独の成立は実Writer・同Session保持・OS処置・実修復の証明ではない。現在はDI内部固定wrapperから全Machineへ接続済みで、最下位を模擬する接続試験と各技術境界の個別根拠で確認した。真正上位Owner／Writer／CLIは接続済み。実境界の成立と未実証範囲は冒頭の現在表へ限定する。

既存Native helperは、選択利用者のIdentity hashへ結合した同じGlobal MutexをRepair／Restartのコマンドループ全期間で保持する。新しい共有Lockを追加せず、同じ選択利用者に属する協調的CRDD helper間の競合拒否を再利用する。別利用者を含むHost全体、手動Docker／WSL操作や他実装との排他ではない。Nodeの`assertLive()`はhelper子の生存・未解放・pipe writableの確認であり、Kernel Mutex所有やDirectory renameとの原子性を直接証明しない。全Machineでは一回取得した同じSessionを最終の技術Effectとその結果checkpointまで保持し、その後release／abortをjoinしてcleanup結果を上位の別checkpoint／終端判定へ保存する。喪失・Protocol不明の後は追加Effectを発行せず、release不明をcleanup不明として残す。fresh取得だけから過去Effectの結果を確定しない。この既存機構の再利用を、新しいHost排他の成立主張にしない。

公式停止は既存`desktop/native-process.ts`の取得済みsession、固定Docker backend停止は`desktop/backend-state.ts`、Directory退避は`desktop/runtime-directory.ts`が所有する。四操作はDI内部のprivate処理へ閉じ、Coordinatorからのdeep importは撤去済み。個別Host操作をRoot公開集合へ追加しない。WSL停止単独公開の保留は維持する。全修復Machineは下位が所有し、上位は意図保存・排他・境界／取消確認と結果保存・ledgerを維持する。

初回run退避はlocalAppData・操作ID・期待Identity、Continuation退避はさらに`failed_launch_run`／`secrets_engine`の固定用途だけを受ける。下位が固定source／targetを導出し、任意Path間の移動や削除を提供しない。Windows・正規絶対Path・32桁操作ID・三値Identityを確認し、Proxy／Accessor・余分keyを実行前に拒否する。元実体一致と退避先不存在をrename直前に再確認し、親実体の保持、rename後の退避先一致と元の明示不存在を要求する。同じ利用者の敵対的なPath差替えを原子的に排除する保証は追加しない。

初回runでは元実体一致を先に要求し、同Identityの退避先既存だけを未発行retainedと分類する。Continuationでは同Identityの退避先既存でもunknownを保持する。観測不能・rename例外を不存在や成功へ丸めない。公式停止のコマンド終了とbackend停止のProcess結果はEngine停止・資源不存在・保存確定や修復完了を意味しない。退避操作自体は削除しない。後続回収は次節の別契約とし、旧署名／履歴Storeを下位へ移植しない。

<a id="修復後の退避物回収採用済み実装未完了"></a>

### 修復後の退避物回収

通常は修復成功後の不要な退避物を使い捨てる。Docker Isolationは固定三用途の物理回収を所有し、Coordinatorは同じ修復操作への意図・観測保存と終了整理を所有する。Image・Volume・Provider Home・認証領域、任意Hostフォルダ、新しい再起動は対象外である。新Store・Registry・Lock・汎用回収Frameworkを追加しない。

元の修復checkpointは退避した事実の正本として保持する。後から削除しても、確定した退避実体・九処置・`stale=retained`・一次失敗を上書きしない。既存`cleanup`はNative子と観測資源の回収であり、退避物の削除確認へ読み替えない。後続処置の保存・履歴・引渡しは[Coordinator詳細](../coordinator/01_Architecture.md#repair-directory-disposition)に従う。

| 境界 | 必要な確認・処置 |
|---|---|
| 対象固定 | 同じ修復nonce・Owner・Scopeから既存三退避先だけを導出する。生Path・任意basenameを公開入力にしない。期待実体は元checkpointを参照し、別の正本へ複製しない。 |
| 発行前 | 元修復の成功・技術終端、現在Owner、同じArtifact・LocalAppData・Scopeを照合する。用途別の回収意図が保存・読戻し・排他解放まで確認されてから物理処置へ進む。 |
| 非使用と対象実体 | 旧世代の停止、現在sourceの別実体、固定Scopeと退避先の期待実体を共同確認する。Engine ready・rename成功・lock観測のnullだけから非使用を推定しない。OS全handle不存在や敵対的な同利用者の差替え排除を追加保証にしない。 |
| 削除対象型 | 非reparseの通常file（linkCount=1）、非reparseのDirectory、既知tag `0x80000023`の非Directory AF_UNIX端点だけを候補にする。未知tag、symlink／junction／mount等、属性矛盾、hardlink、不明実体、範囲超過は新規削除0。子は有界列挙し各実体を同じ手順で確認する。無条件の再帰削除は使わない。製品Driverは公開compositionまで接続済み。真正Writer・物理回収・後続終了整理は接続済み。ただしWindows実物での自動削除成立は未実証であり、今回の失敗と保守処置を区別する。 |
| 処置と終端 | 対象・親の直前実体を再確認し、対象だけを回収する。fresh観測で対象の明示不存在、親と現在sourceの保全を確認する。不明・部分成功は用途別に残し、成功へ畳まない。 |
| 中断再入場 | 同じexact ID・保存意図・固定対象で再観測する。不在なら不存在確認だけを進め、過去の削除発行を捏造しない。同名別実体や観測不能では削除せず、取消・Owner喪失後の追加処置を止める。 |

固定targetがWindows Nativeの明示不存在とNodeのENOENTで一致する場合は、削除要求を発行せず、親のNode／Native実体と現在Ownerを前後確認して現在不存在だけを返す。この無処置経路は、別Pathの現在sourceを観測・正規化せず、source保全や削除成功を主張しない。targetが存在する場合のsource正規Path・実体・非alias・処置前後保全条件は維持する。片方だけの不存在、観測不能、親差、Owner不明は不存在へ補完しない。

| 代表例 | 期待する結果 |
|---|---|
| 通常回収の条件がすべて成立 | 意図保存→対象回収→不存在確認→後続結果確定→上位終了整理。元修復結果は不変。 |
| 調査用保持を判断したが引渡し未成立 | 削除しない。保持判断だけでは終了整理・fresh Taskを許可しない。 |
| 実体不一致・別Scope・非使用または観測情報不足 | 削除0で停止する。不明を不存在や非該当へ変換しない。 |
| 一部回収後の失敗、または削除後の保存失敗 | 確認済み事実を保持し、同IDで残対象と保存を再確認する。別実体の削除・完了済み処置の再発行は禁止する。 |

調査用の明示保持は既定7日とし、期限は判断時刻から算出する。期限到来は削除・延長の判断時点であり、自動削除許可ではない。対象・期限・利用者管理責任の引渡し成立を、保持判断だけから推定しない。通常回収と期限付き引渡しは既存上位Ownerへ接続し、実境界でのWindows自動回収未成立と区別する。

明示保持の照合情報は、追加Hashではなく既存Node実体の`dev/ino/birthtimeNs`を用途別に直接比較する。`observeDockerRuntimeRepairRetention`は元nonce／H／Scope、終端checkpoint、取消と同期の現在確認だけを受け、固定Artifact・KnownFolder・元Scopeを照合して三退避先を二読取りする。元retained presentは対応処置がsaved／issued／confirmedで、expected・元retained・fresh二回の実体が一致する場合だけ実体の独立コピーを返す。元retained absentは対応処置がnot_issued／not_requiredで、fresh二回もabsentの場合だけ用途内nullを返す。この場合expectedは元source実体を表し得るためnullに限定しない。新しいlive sourceの存在は保持先との照合を妨げない。

返却全体のnullは観測不成立、三用途内のnullは正規に保持対象なしという別の意味である。各読取り前後のOwner・取消・Artifact・Scope不明、元保持物の消失、別実体、用途交換、不完全な三用途は全体拒否とする。新Repair Native Session・保存・削除・再起動を行わず、結果は削除Authorityではない。明示保持に限り、この非秘密metadataを既存一行履歴へ投影する例外を認める。生Path・Owner・Scopeは投影しない。後日は現在KnownFolderとnonceから下位で固定先を導出し、実体を直接再照合する。照合不能は元対象の不存在を意味しない。

上位の保持receiptは判断時刻・exact7日後の再判断期限・三用途照合情報を同じ操作と履歴一行へ固定する。receiptの存在は明示CLIによる利用者管理への引渡し意思を表し、追加の責任者Registryを作らない。履歴は少なくとも期限前の期間整理から保護し、保存・読戻し・排他解放・履歴確認・終了整理の共同成立後だけRuntimeの追跡を終える。旧既出版値へreceiptを補完しない。この読取りから上位receipt保存・CLI説明・履歴保護・終了・fresh Taskへの接続は実装・局所確認済みである。

#### Windows実体観測と回収の分担

内部回収DriverはRoot込み256 entry・Root深さ0から最大8段へ限定し、全preflightが成立してから一件ずつ処置する。削除直前には処置経路の祖先DirectoryだけについてNative実体と直下の期待残存名を再確認する。集合差・中間Directory差替え・観測不能は追加要求を停止し、Nativeの明示不存在後だけ同呼出しの残存集合から除く。Root外の親内容や未走査別枝の全域変化を原子的に保証する仕組みではない。

公開composition `disposeDockerRuntimeRepairDirectory`は、元checkpointの全九処置終端、Engine ready、Host safe、元Native cleanup confirmedと退避ありを実decoderで確認する。元nonce・H・保存Scopeを一度捕捉し、fresh固定Artifact・KnownFolder・Local親から同じScopeを再導出する。元Hは相関材料であり、現在の処置許可ではない。新しいRepair Native Sessionは取得せず、元修復Machineへdispose能力を追加しない。Artifactと現在Owner／保存意図の同期確認は、Driverの待機後・処置前にも適用する。委譲前拒否は未発行、委譲後の想定外例外は要求不明として返し、未発行へ戻さない。単一entry観測の既存Native Processは使用する。

この入口は今回の要求事実と現在不存在を返すだけで、上位Writerの保存や終了整理を確定しない。用途別意図の保存・読戻し・排他解放は現在確認callbackの前提であり、保存代役の成功を真正保存の成立根拠にはしない。上位は進捗保存失敗後に次用途へ進まず、過去のrequest unknownを現在のissued／not_issuedで置換しない。

Windowsの曖昧componentは固定Native入口が拒否し、Driverは全entryのpresent観測を要求する。同じ名検査を別実装として複製しない。今回の物理要求到達はsyscall直前にのみ`issued`とし、事前拒否を発行済みへ変換しない。同期確認の真正Promiseは拒否を処理して停止し、thenableは実行しない。内部Driver・固定factoryと、保存意図・旧OwnerのEffect不能・Session・後続結果・上位終了の本番接続を確認済みである。実物の削除結果は冒頭表の限界を維持する。

Platform Accessは単一entryの属性・reparse tag・実体・linkCountを、非追従handleから読取り専用で観測する。内容読取り、削除、ACL変更、処置許可は提供しない。Docker Isolationは既存三target、保存済み実体、Owner／Scope、非使用条件と有界な列挙を所有し、fresh観測後にNodeの単発unlink／空Directoryのrmdirを使う。Repair Sessionへ可変Path Protocolやnonce／Scope導出を重複実装せず、Native tree削除や新Lockを追加しない。

一要求一Native Process・exact絶対Path一件・固定応答一件を、固定Artifactの前後確認と正常終了へ結合する。専用の要求nonceは追加しない。Native実体のvolume serial／file index／creation FILETIMEと、Node実体のdev／ino／birthtimeNsは別単位のまま各々前後比較し、未実証の変換で同値と扱わない。Native handleの明示close成功後だけ応答を確定する。FILE_NOT_FOUND／PATH_NOT_FOUND以外の失敗、frame欠測・余剰・stderr・非0終了は観測不能である。対象不存在の採用には親／Rootの現在確認も必要であり、親消失を対象不存在へ丸めない。

2026-10-17の自己生成Host試験では、異常終了した試験子のAF_UNIX端点が残り、raw tag `0x80000023`、Node Direntのlink=true、lstatのEACCESを観測した。Node unlink後の明示不存在と専用試験Root不存在を確認した。正常closeでは端点自体が消え、sandbox内のbindは拒否されたため、これらを残存端点の削除成功とは数えない。この実測は方式選択の根拠に限り、製品Driver・保存前後・三用途全体・実Docker修復の成立根拠ではない。

回収進捗の純粋値は、元修復とは別の`DockerRuntimeRepairDisposalCheckpoint`とし、同じ`desktop/repair-checkpoint.ts`が所有する。Rootは型・decoder・一用途遷移validator・値上終端predicateだけを公開する。保存先や新しい管理機構を追加しない。

| 固定三用途それぞれのfield | 値と意味 |
|---|---|
| `intent` | `not_saved / saved`。回収意図の保存段階。値だけで実保存を証明しない。 |
| `request` | `not_issued / issued / unknown`。過去の要求履歴。`issued`と`unknown`は相互変換・未発行への巻戻しをしない。 |
| `absence` | `unobserved / confirmed_absent / unknown`。不存在の観測。unknownからfresh確認へ進めるが、未観測へ戻さない。 |

合法tupleは未保存・未発行・未観測の1形と、保存済みの9形の計10形である。初回意図保存は`saved / not_issued / unobserved`だけへ進み、発行や不存在確認と飛び越して同時確定しない。validatorは更新用途を明示し、他二用途を全文保持する。不存在確認後はその用途のtuple全体を固定する。完全同値は値検査で許すが、専用Writerではno-op／Effect 0とし改訂を増やさない。

値上終端は三用途すべての`saved / confirmed_absent`を要求し、requestのunknownは残す。過去の`absence=unknown`だけで将来の要求を永久に拒否しない。一方、実Driverは要求前のfreshなexact実体・Scope・非使用・Owner確認を必須とし、現在確認が不明なら要求0とする。実観測、保存・読戻し・解放確認と物理処置は本番接続済みだが、純粋値の成立だけを回収完成やTask入場許可へ変換しない。

<a id="修復machineの本番接続契約実装未完了"></a>

### 修復Machineの本番接続契約

操作全体のScopeは、domain `crdd/docker-desktop-repair-scope/v1`、protocol `CRDDDR06`、64桁nonce、同じNative取得の実H、固定Artifact SHA-256、OS KnownFolderのcanonical LocalAppData Pathと安定実体、そこから導出した固定対象Pathの順で結合する。固定domain・NUL・UTF-8 payloadのbyte長UInt32LE・固定field順JSONをHash入力とし、文字数や曖昧連結を使わない。Directory名用の32桁IDは別domain `crdd/docker-desktop-repair-directory/v1`とnonceの同じencodingから下位で導出する。nonceの先頭をそのまま切り出したり、上位から任意IDを追加指定しない。

Scope準備はLocalAppDataのlstat／realpath／再lstatが一致した場合だけ進む。可変なDocker親、run、退避先、secretsの現在実体はScope材料にせず、各actionで照合する。Docker親不存在はScope準備の失敗ではない。一度捕捉したcanonical Localと固定targetsを凍結し、Scopeと実Adapterで共有する。生PathをRoot結果へ出さず、Hashだけを所有・許可の証明にしない。初回はresume期待値なしで実取得から相関を生成し、freshでは保存済みowner／scopeとの完全一致を要求する。

`createDockerDesktopRepairDirectoryAccess`は同じ準備材料からScopeを一度捕捉し、そのtargetsを観測・lock確認・退避のclosureへ閉じ込める。各呼出しで安定LocalのScopeを再確認しても、実操作対象は元targetsを使い、再観測で得た別対象へ差し替えない。三用途以外、期待実体不正、Local差替え・観測不能ではrenameしない。初回の同実体退避先は未発行retained、継続の先既存はunknownという既存分類と、rename前後の親・元・先の照合を維持する。現在は内部技術APIとして、同じNative子・Scope・実Operationsへの固定wrapper接続まで確認済みである。最下位を模擬する接続試験と各技術境界の個別根拠を組み合わせ、真正上位Owner／Writer／CLIは接続済みで、実境界の成立・限界は冒頭表で別評価する。

Native取得の既存R→V→Hを重複実行しない。開始取消、不正相関、cleanup pending／unknown、cleanup失敗、保存済み未確定意図・未確定issued・unknownがあるfreshはNative取得前に停止する（初回の未保存・未発行・未観測slotは含めない）。取得待ち取消では遅れて得た同じ子を回収してから返す。未確認checkpoint、取消、Native喪失、Effect／protocol不明ではabort＋join、確認済み非終端観測または正常技術終端だけrelease可能とする。closeは同じPromise一回に結合し、cleanup unknownを`helper_cleanup_unknown`、cleanup confirmedかつprotocol failedを`helper_protocol_failed`として保持する。Native喪失を利用者取消へ読み替えず、一次失敗と回収失敗を分離する。このruntime接続はDI内部固定wrapperへ実装・接続済みである。真正上位Owner／Writer／CLIは接続済みだが、内部接続試験だけで実境界や全体完成を表示しない。

修復は、既存の一つのNative補助子を取得してから、通常処置・起動失敗後の限定継続・補助子回収までを下位の一呼出しで所有する。上位へOS、Host Path、Native Sessionを公開せず、操作相関、取消、現在許可、保存済み技術checkpointと用途固定の保存確認だけを受ける。

| 境界 | 必要な保証 |
|---|---|
| 準備 | 固定Artifact、同じ補助子のV／H、固定OS所在と対象実体を確認する。`ownerBindingSha256`と固定ScopeのHashは相関値で、許可ではない。準備資源の部分取得失敗も同じ呼出しで回収する。 |
| 初回保存 | `onPrepared`へ不変の準備事実を一回通知する。同期の厳密なtrueだけを受理し、上位の保存確認・状態Lock解放が成立する前に九処置を発行しない。 |
| 実処置 | 各Effect直前に現在許可、取消、同じ補助子と実体を再確認する。意図を同期`onCheckpoint`で保存してから発行し、結果も次版へ保存する。Promise／thenable、例外、falseでは後続Effectを止め、同一呼出し内で失敗した通知を再利用しない。呼出し間の再入・並行実行の拒否は、外側runtimeの同じSession Ownerへ接続する。 |
| 再入場 | 保存済みexact操作・主体相関・Scopeと三用途Directoryの実体を再照合する。九slotのunknownを再発行許可にしない。保存途中では技術Effectを発行せず、上位が同じ合法pendingの確定を確認してから続ける。 |
| 終了 | 最終技術checkpointはcleanup未確定・最終outcome未確定のまま保存する。同じ子のrelease／abortとstdioをjoinし、cleanup・一次失敗を分けた最終値を返す。上位はこの返却から別版を保存し、失敗した通知callbackを再利用しない。 |
| 喪失・取消 | 新しい技術Effectは0。同じ呼出しの生存する保存Ownerが記録できる場合だけ、単調なunknown・cleanup・一次失敗を記録する。Native失効を保存Ownerの失効と同一視しない。 |

通知は直列・同期の閉じたDTOとし、下位は上位Storeを呼ばない。最終返却後はcallbackを呼ばない。通知・保存の失敗を技術処理の再実行で解消せず、現在のexact参照と一次失敗を返す。正常五処置、failed-launch追加四処置、三Directory、保持判断・履歴・返却までの接続と新しい検証が揃うまでは、旧実装を置換済みとは扱わない。

cleanupは当該Sessionの技術資源回収を集約する。Native補助子とEngine観測のいずれかがunknownなら最終候補もunknownとする。Native固有のcleanup／protocolはlifecycle結果へ別に残す。既存cleanupFailureがある場合はそれを保全し、同呼出しの新失敗は観測資源の`observation_cleanup_unknown`、次にNative cleanup／protocol理由の固定優先順位で選ぶ。これは時間順の最初の失敗を保証する調停機構ではない。観測close不明は実Adapterでsticky保持して即時停止し、以後の技術Effectは0、通常Machine観測でcleanupを書換えない。runtimeは同Adapterの局所失敗Readerから値を捕捉し、abort／join後の未保存最終候補へだけ反映する。補助子の正常終了で観測失敗を消さず、観測回収理由がある候補のcleanup confirmedをcodecで拒否する。

通常checkpointの巻戻しは禁止するが、cleanな未終端修復のfresh再入場だけは、固定のSession開始候補で`confirmed → pending`を許す。候補は下位が生成し、cleanup以外の九処置・三実体・観測・失敗を全文保持する。既存cleanupがpending／unknown、cleanup失敗あり、または修復outcome確定済みの場合、新しい補助子の取得成功で過去の回収を補完しない。この準備候補の保存拒否では取得した子をabort／joinし、新技術Effectは発行しない。新しい永続Session世代や履歴Storeは作らない。

処置前の`canIssueEffect`（取消・現在許可・技術境界）と、処置後の`canRecordCheckpoint`（同じ保存Owner・Scopeの生存）を分ける。取消後も既発生事実は記録できるが、新しい処置は発行しない。発行後は`issued/unobserved`と確定結果の二段で保存し、最初の保存が失敗した場合は同じcallbackを再利用せず、耐久元版から合法な`unknown/unknown`を返す。未発行確定や不要へ戻さない。

fresh呼出しで既存の`saved/not_issued/unobserved`へ遭遇しても、未発行を証明したことにはならない。発行可能なのは同じ呼出しが意図保存を確認した直後だけとし、freshの未確定意図・issued未確定・unknownでは再発行しない。既存unknownから後続の技術観測・通知・処置へ進まない。前提観測不能は処置不要と区別する。Engine readyでは未使用slotを明示不要にし、九slotの未評価を残して回復成功としない。

内部のEngine待機は`awaitEngine(stage, checkpoint)`とし、初回起動後と限定継続再起動後を明示する。返値は元待機分類`state`と、初回だけの非永続`continuation`を分ける。初回の`startup_timeout`単独では追加四処置へ進まない。初回起動・元世代退避がconfirmed、旧退避実体一致、新runが別世代、run／secrets両lock、Processがabsentまたはverified、現在Engineがknownまたはtransientという完全fresh条件を実Adapterが照合した場合だけ、同じ呼出し内で継続停止へ進める。生Engineのtransientをknownへ変えず、待機stateはstartup_timeout、保存Engineはunknownのままとする。追加停止後の退避前には、Engine knownとProcess absent、両lock・対象実体・先行結果をfresh確認する。再起動後の待機ではcontinuation非nullを拒否する。完全fresh判定は保存値・終端根拠・fresh再入場許可へ再利用しない。実Adapterの完全fresh判定はDI内部固定wrapperへ接続済みで、最下位を模擬する接続試験と各技術境界の個別根拠で確認した。真正Coordinator Owner／Writer／CLIは接続済み。実境界の成立と未実証範囲は冒頭の現在表へ限定する。

起動失敗世代の固定は、内部`observe(checkpoint, phase)`の必須二用途`current`／`failed_launch`で分離する。通常観測はfailed／auxiliaryの期待Identityを新規設定しない。初回timeoutと完全継続値が成立し、追加四処置が未発行の場合だけ、両世代を一つの候補へ固定する。両sourceが期待実体としてpresent、両retainedがabsent、二実体と旧primaryが相互に別実体であることを要求し、primary・engine unknown・処置・cleanupその他を維持する。欠測・別世代・相関不明・保存拒否では停止意図と追加Effectを発行しない。実codec・遷移検査と同期保存成功が、停止意図と発行に先行する。保存後取消・Owner喪失でも新Effectは0とする。実Adapterによる同じ実体の再照合はDI内部固定wrapperへ接続済みである。保存後crashからの部分継続は内部接続・限定独立確認済みであり、下段の同exact部分継続契約に従う。この限定停止を最終完成とは扱わず、真正上位保存Owner／CLIと実Docker E2Eも別に確認する。

固定本番組立ては内部`runDockerRuntimeRepairSession(value)`が所有する。Native取得側と同じPackage内部の配布Rootを共用し、入力検査成功後のacquire内でだけPAのArtifact候補を一回捕捉する。同じ凍結descriptorをRepair Native取得へ渡し、取得した同Session・H、既存nonce、固定KnownFolder、同Artifact SHAからDirectory Accessを一回作る。その後Artifact・現在許可・Scopeを再確認して実Operationsを組み立てる。入力拒否・開始前取消では下位観測0、取得後の準備拒否は同じ子のabort／joinを待つ。`Using`はこの内部接続の試験境界であり、固定入口とその入力型だけをRoot APIへ公開し、Using・配布Root・個別Host処置は非公開を維持する。真正Coordinator Owner／Writer／CLIとfresh部分継続の最終確認は、内部組立ての成立とは別に確認する。

### 同exact修復の部分継続契約

部分継続は新しい回復機構ではなく、同じcheckpointの確定済みprefixを再発行しない再入場とする。failed／auxiliaryの期待実体は両方未固定または両方固定だけを認め、固定時は旧primaryを含む三実体の相互分離、通常五処置の終端、初回退避・起動confirmed、primaryの退避実体一致、安全性確認を要求する。追加四処置は確定済みの連続prefixと未保存・未発行・未観測のsuffixに限り、gap・片側固定・未確定意図・unknownは新Effect前に停止する。freshでは初回timeout markerやfailed_launch固定観測を再取得せず、保存済み期待実体をcurrent観測で同じ固定対象へ再照合する。未退避は元一致＋先不存在、退避confirmed後は先一致と、次Effectが残る間の元Path明示不存在を必要とする。再起動confirmed後の同名新世代は、保存した三実体と異なることを確認し、旧実体を上書きしない。再起動confirmed後はHost処置を再発行せず、必要なら継続再起動後のEngine待機だけを行う。初回起動confirmed・pair未固定の再入場は初回待機へ戻り、同呼出しの完全fresh条件が成立した場合だけ新pairを固定する。観測・保存拒否・取消・Owner喪失後の新Effect0と、既発行事実の保持は既存契約を維持する。

修復の実技術接続はDI内部`desktop/repair-operations.ts`へ置く。同じNative Session、捕捉済みDirectory Access、内部取消と現在許可を固定し、固定Engine／Backend観測・終了・起動・三用途退避だけへ接続する。技術前提は読取り専用であり、Machineの二回確認とは別にexecute直前でもArtifact／Scope／生存と操作固有条件を再確認する。発行後の取消で取得済み発行事実を捨てない。Engineのcleanup不明は局所sticky値へ記録して直ちに停止し、純粋Readerで外側runtimeへ返す。同期OS要求は既存の有界時間で戻るもので、即時取消可能とは主張しない。通常観測で旧primaryの退避後に新世代runを観測しても、旧primaryへ新世代を上書きしない。保存済みの旧元不存在は過去の確認値として維持し、現在Path不存在の主張へ使わず、処置直前のPath／Identity照合はDirectory Accessで別に行う。試験差替えはDI内部に限り、RootへSession・Path・argv・技術callbackを公開しない。実Adapterの本番入口接続と全体成立は、Source・試験・利用側の接続確認後に判定する。

起動待機のreadyだけを保存済み成功へ変換しない。実Machineは同じ現在観測を再取得し、Engine ready、Process verified、run present、保持済み実体一致、現在許可・Artifact・Scopeの継続成立を確認してからreadyを通知する。Directoryは再照合まで同じ実体であることを要求し、旧実体とは異なる二つの新世代間の差替えも拒否する。再起動confirmedのfreshで既にreadyの場合はHost処置・待機を再発行しない。この内部実装は部分継続・最終観測の接続試験と契約・品質の限定独立確認が成功している。真正上位保存Owner／CLIは接続済みだが、内部成立を実境界や全体完成へ拡張しない。

### 隔離用の静的資産

`runtime/`はClaude／Codex／Codex助言／通信プロキシのDockerfile、Codex seccomp、プロキシ実装の6資産を所有する。Provider設定と結果Schemaの5資産はAI Adapterの`runtime/`が所有する。固定Task検証textはCoordinatorの`tests/fixtures/`に属し、通常実行の配布集合へ試験Directory全体を追加しない。通常配布は両Packageの固定11Pathを含め、任意の`runtime/**`を探索・採用しない。

Dockerfileの所在はビルドcontextを意味しない。ビルド時は検証済み公式CLIと各Ownerの設定を、Dockerfileが宣言するbasename・mode・Container内Pathを維持して明示的に組み合わせる。Codexは`codex`・`bwrap`と3結果Schema、Claudeは`claude`と2設定、助言は`codex`・`codex-code-mode-host`、通信プロキシは同DirectoryのPython実装を入力とする。Provider版と取得元の正本はAI Adapterに残し、配置変更だけでImage digestや資産Hashを更新しない。seccompの物理取得は既存の単一Resolverが所有し、AI Adapterの宣言Pathと一致することを確認する。

Desktop修復の読取り技術処理は、`desktop/runtime-directory.ts`と既存`desktop/engine-state.ts`が所有する。上位修復は検証済み境界のDirectoryだけを渡して固定FS観測を呼び、前後の親実体と64件以内のentry集合が一致し、既知のopen拒否が少なくとも一つある場合だけロック識別子を受ける。非Windowsは下位入口でFS操作0のまま拒否する。open後のclose失敗は既知の拒否コードであっても観測不能とし、再closeしない。`null`は不存在・解放済みを意味しない。依存差替え入口はPackage内部試験に閉じ、Root公開は本番FS接続だけとする。

Engine待機のRoot入口は既定180秒・間隔1秒に固定し、読取り観測・取消判定・取消通知だけを受ける。`ready`・`unknown`は直ちに返し、既知の未起動・起動途中だけ再観測する。取消後の追加観測は行わないが、競合させたsleep timer自体の取消完了までは保証しない。時計・sleep・期限差替えはPackage内部試験用とする。上位が持つ観測cleanup不明のsticky保持、一次理由、記録順序は変更しない。WSL停止は単独公開せず、後続の修復Machine移管まで既存private処理を維持する。

Desktop修復のEngine読取りは内部`observeDockerDesktopRepairEngine()`へ固定する。旧RuntimeState／AppDataの構成領域を要求せず、既存のno-config環境・固定Linux endpoint・出所前後検査を用い、修復用途の4KiB／5秒・Timeout分類を維持する。明示構成付き修復の既存入口とは共通の固定観測処理を使い、Runtime用途の16KiB分類を変更しない。内部prepareには同じNative生涯のsignalと現在確認closureを渡す。発行前の現在確認は新Effectだけを止め、発行後の取得済み結果やunknownの単調記録を捨てない。

現在回収の技術期待値は`planDockerRecoveryResourceExpectations`へ集約する。入力は五資源名、Label、二Image digestとWorkspace／read-only／Initの三booleanだけとし、Provider判定、認証値、Host Path、現在State、実IDやWriterを受け取らない。Container先行の五用途順、認証のnone接続、Proxyの内部のみ／内部＋外部の候補順と既存全fieldを保持する。上位はAI Adapterの判断をbooleanへ確定し、返却purposeと現在資源を一意に結合する。不正入力は部分計画を返さず拒否し、新しいboolean相関制約は加えない。公開入力は固定11個のown data propertyを一度捕捉し、Proxy・accessor・継承必須値・余分key・非primitiveを入力処理の実行前に拒否する。この抽出のSource・局所回帰・限定独立確認は成立したが、通常入口・Task全体・実Docker再起動の成立を含まない。

実ID回収の固定optionsは、構成照合後・削除要求直前の同期生存確認を受けられる。現在Recovery Ownerを使う上位接続はこの確認を必ず結合し、下位は厳密なtrue以外・例外・Promise／thenableを削除0として拒否する。観測だけの呼出しでは評価せず、任意Effect callback、State／Lock操作または新しいAuthorityへ一般化しない。旧利用側の本番切替が未完了の間は、未接続箇所を完成扱いにしない。

Package Rootの`src/index.ts`から必要な操作と型だけを明示exportする。Capability内barrel、上位Packageへのimport、Provider専用入口は作らない。

現在操作用の回収接続は借用管理Directory内へ`docker-recovery-config-`接頭辞の一意短命子を作り、既存三資源操作とcloseだけを提供する。作成直前の同期Owner確認、親と自作子の実体、空状態を照合する。既存同接頭辞の残存はfile／linkも含め96件まで数えるが、採用・変更・削除しない。自作Identityを取得できなかった途中失敗は清掃不明として同じHost Rootへ残す。closeはOwner失効後も捕捉済み親・子実体だけを再確認し、空の自作子を非再帰で削除して明示不存在を確認する。別試行や隣接物へ削除を広げず、二度目closeは追加Effect 0。同一Local Userを信頼する既存境界の現在観測であり、敵対的な同一UserによるPath使用中の差替えを原子的に排除する保証は追加しない。

技術入力は、操作相関、Container／Network名、実Image digest、期待構成、限定stdinと検証済みProvider起動記述とする。Docker argv全体・任意環境・任意Mountは公開入力にしない。閉じたpurposeから、Network、read-only、cap-drop、no-new-privileges、pids、User、Mount modeと出力上限を下位Ownerが構築・再検査する。Provider argv／環境の記述は上限付きpayloadとしてContainer内へ搬送するだけで、モデル・役割等の値が含まれても、その意味や許可を下位が所有・判定しない。

Task Packet、モデル選定、送信同意、User Credential、業務結果は所有しない。上位は同じ生涯の計画を検証し、下位も資源名・構成・コマンド所属・入力上限をEffect前に照合する。単なる文字列Pathを所有許可へ昇格しない。

固定資源名と乱数値の検査は既存`execution/command-plan.ts`が所有する。実行namespaceは`codex`／`claude`の既存閉集合とし、上位で照合した不透明な64桁小文字hex Identityとsuffixから五資源名・labelを生成する。通常suffixは8byteのhexであり、単独helperの63文字防御境界は維持するが、長いsuffixをDocker commandの許可形へ拡張しない。乱数源と8byte→32byteの呼出順は上位Ownerに残し、DIは同じcallbackのBuffer型・長さ検査とhex化だけを担当する。新しい乱数源、Provider選択、所有証明または削除許可は作らない。

既存Ownerから借用するcallbackは、①専門Ownerが所有する実行能力のfresh観測、②検証済みoperation workspace／Host・Home leaseの借用と生存観測、③既存保存Ownerが検査済みの再入場projection、④既存結果／Receiptの用途限定照合、の閉集合へ限定する。Docker固有の実行物・環境・OS構成の観測は下位内部へ集約する。任意処理、上位State／Store／Repository参照、Lock acquire／release、Task／Authority操作は下位へ渡さない。観測callback自体はDocker Effectを発行せず、下位が各実処理直前の呼出し順序を所有する。例外・観測不能では新Effect前に停止し、既に発行済みなら一次失敗と残存観測を保持する。下位から上位への事実通知は§6の別方向の接続であり、保存・許可の委譲callbackと混同しない。

| 操作 | 結果と意味 |
|---|---|
| 開始 | 所有Handleを返す。Handle取得はDocker作成成立・Provider開始ではない |
| 開始観測・待機 | 有界待機。開始通知、終了Status、出力超過と観測不能を区別する |
| 取消・終了待機 | 所有Process treeと終了補助Processのcloseを確認する。取消要求だけを終了にしない |
| 診断attach | 入力は構成確認済みの実Container IDと固定ready prefix。下位が固定Engineのstart --attachを組み立て、ready・一次失敗・元子close・終端補助子closeを分ける。64KiB出力上限と共通Process Ownerを使用する |
| Windows子のtree終端 | 所有元子を既存Platform Accessの用途固定入口へ渡す。固定taskkill・OS所在・補助ProcessはPlatform Access、元Docker CLI子のstdioとclose・一度発行は本Packageが所有する。共通期限内で元子と補助子双方のcloseを確認し、補助成功だけをDocker資源清掃成功へ代用しない |
| 同期診断 | version、固定Python Probeのcreate、実IDのinspect／start／SIGTERM／remove、ID／固定名／Labelの不存在照合を閉じた用途から構築する。固定Probeの技術選択とDocker観測結果の技術分類は下位。回復記録・3Mountの利用許可・診断実施の業務判断は上位に維持し、共通結果を元Operationの業務状態へ相関する。新しい任意Script／argv Executorは公開しない |
| 対話stdio | 対話許可は上位で判断する。下位のinherit方式は出力を捕捉せず、非対話callback／stdin搬送と同時指定しない。対話結果の意味・認証Authorityを下位へ移さない |
| 認証用技術計画 | 上位が公式CLIのlogin／status起動記述、専用Home、固定配布・Proxyを選択し、下位が五資源と固定操作列を構築する。Workspaceは受け取らず、HOME／Proxy等の隔離設定の上書きとgetter入力を拒否する。生成Commandの元object相関は技術照合であり、Home利用Authorityや認証成功を生成しない |
| 認証Process | 元Commandだけを固定Engineへ発行する。上位の許可生存を開始前・実行中に観測し、喪失・非対話期限・出力超過で共通tree終端へ接続する。一次理由とprocessCompletionConfirmedを分け、未確認なら上位がin_flightを保持し後続操作・完了記録・Home解放を拒否する。新しい下位回復Stateは作らない |
| 認証作成Receipt | create stdoutの実IDと直後の単一inspectを結合し、同digest Imageの既定Entrypoint／Cmd／Env／WorkingDirを含む認証構成を照合する。NetworkはDriver／Scope／Internal、Containerは実ID・名前・Label・Image・User・隔離条件・Network・Home bind・tmpfsを評価する。Proxy秘密値は耐久化せず固定形式と一意keyを検査する。結果が不明ならReceiptを返さず、上位の既存in_flight記録を保持する |
| 認証資源清掃 | 保存Ownerの五資源Receiptを同じ元Planへ結合し、実ID指定inspectとImage既定構成の確認後だけ元removal操作を一回実行する。未作成Receiptは名前の不存在だけを観測し、発見した資源を削除しない。ID不存在だけから同名資源の不存在を推定せず、事後に実IDと名前を確認する。Proxyは接続前の内部Networkだけ／接続後の内部＋外向Networkだけの二形状へ限定する。再入場時の一時token差は秘密値保存なしで形式・一意keyを評価する |

診断・認証のDocker CLIと実行方式は下位内部で選ぶ。汎用の実行能力検証が必要な場合は、下位が選んだ同じ候補を既存専門Ownerへfresh照合し、その同一候補だけを実行する。上位の業務Adapterが候補Path・Engine・作業場所を組み立てたり、別のexecutable fieldと検証対象を組み合わせたりしない。認証Runtimeは生成時の元Planへ結合し、別Planの元Commandも拒否する。相関は同Processの元objectだけで行い、公開IDや永続Registryを作らない。認証清掃の観測・削除・不存在確認も、上位の既存exact Recovery記録で各開始前in_flight、Process終了確認後idleとする。清掃の終了不明／例外では後続0・完了保存0・Home解放0を維持し、fresh再入場で未終了操作を再発行しない。実ID／完全構成清掃への接続は、完成前に反証する残件である。
| 資源観測・清掃 | 記録された実Docker ID、名前、Label、Image、Networkと隔離構成を照合して処置し、実IDと名前の不存在を再観測する |
| 清掃結果照合 | 同じRuntime・操作・計画が返した結果だけを終端根拠にする。コピーした成功値は受理しない |
| 再入場 | fresh ProcessではCoordinatorが既存保存・Lock・exact回復Identityを検査した用途限定projectionを受け、現在実資源を再観測する。同Processの元結果照合とは分離し、下位で新しい回復記録や処置Authorityを発行しない |

## 3. 状態・順序・失敗

検証済み入力 → 要求発行 → Process開始観測 → 結果／一次失敗 → 所有Process終端 → exact資源回収 → 清掃観測 → 利用側へ返却、の順序を基本とする。完了・取消の競合では、元のProcess完了と清掃観測を待つ。遅延通知で処置を再発行しない。

| 条件 | 必須処置 |
|---|---|
| 入力不正・開始前取消 | 新しいDocker／Provider Effectを発行しない |
| 作成要求の結果不明 | 同じ操作相関と既存回復Identityを保持。不存在・成功へ補完しない |
| 結果正常・清掃不明 | 正常結果と清掃不明を別に返し、資源回収済みと表示しない |
| 一次失敗・清掃失敗 | 一次失敗を上書きせず、清掃結果を別の事実として保持する |
| 親Process喪失 | 元Processのobject参照は再利用しない。既存耐久recordを上位が検証し、同じexact回復Identityに結合した技術projectionで現在資源を再観測する。履歴値だけで不存在・削除許可を生成せず、下位はrecordを読書きしない |
| 他Owner資源・構成不一致 | 削除しない。名前・Labelだけを削除根拠にしない |
| 現在観測不能 | 不明として停止。空集合やfalseへ畳んで安全を主張しない |

Consumerの表示・任意保存は資源回収の終了条件に入れない。Candidateと必要な失敗根拠の保存は各Ownerが担当する。Orchestratorの耐久ACKもDocker資源回収とは独立する。

修復のNative生涯所有は`desktop/repair-runtime.ts`へ置く。取得待ちの取消でも遅れて取得した同じ子を回収し、その終了待機前に返却しない。取消とNative喪失は最初の停止理由を固定し、後着事象を一次理由へ上書きしない。正常終了はrelease、取消・失敗・未確定処置はabortを一回だけ選択し、実行値とcleanup／protocolを分離する。終了後は購読解除と終了gateで通知を無効化する。この所有部品単独は上位保存の成立を代替しない。現在はDI内部固定wrapperから同じNative子・Scope・実Adapter・Machineへ接続済みで、最下位を模擬する接続試験と各技術境界の個別根拠で確認した。技術依存差替えと個別Host処置は非公開を維持し、真正上位Owner／Writer／CLIは接続済み。実境界の成立と未実証範囲は冒頭の現在表へ限定する。

同Moduleの内部接続は、取得前に初回／fresh入力を捕捉・復号し、freshのcleanup未確認、失敗記録、unknownと保存済み未確定意図を拒否する。取得後は同じHとScopeを照合し、準備のawait前後、準備通知直前・直後に取消・生存・現在許可を再確認する。`onPrepared`の厳密な同期trueを一回受理してから実Machineへ進み、拒否時はMachine未開始を明示して同じ子をabort／joinする。最後のMachine結果は不変更とし、join結果のcleanupだけを反映した最終checkpoint候補は`finalCheckpointConfirmed:false`で返す。Root・Revision・未終端・真正Ownerの確認は上位Ownerの責務であり、Hashやこの内部接続では代替しない。Using単独の検証では技術Adapterを模擬して内部通知契約を確認する。固定wrapperの組立て試験は実Operations・Machineへ接続し、差し替えたDirectory factoryのScope出力の搬送を確認する。実factoryのScope導出・実Filesystem要求は別の個別試験で確認し、組立て試験が実factoryを一体実行した根拠とはしない。真正上位Owner／Writer／CLI、実Docker E2Eの完成とは区別する。

## 4. 配置・保存・実行環境

### 通常RuntimeからCRDD署名を分離する

2026-10-14の人間判断により、CRDD独自署名Manifest・署名Runtime Capability・巨大な配布閉包を隔離実行の必須条件にしない。現在の境界は[Coordinatorの三分離](../coordinator/01_Architecture.md#9-通常実行追跡正式配布の分離)を使用する。下位は署名から実行許可を発行せず、Commit／Hashも相関・同一性確認に限定する。必要なCLI・Image・設定の検査、固定操作、現在の用途限定binding、取消・実ID清掃・観測不能時の停止は維持する。Docker CLIの既存Publisher／Authenticode確認は別の出所確認であり、CRDD独自署名撤去をその一括撤去へ広げない。

通常Sourceと起動GuardのCRDD署名前提は撤去済み。必要なArtifactの観測は専門Owner、任意の正式配布検査はRelease／QA Ownerへ分け、旧署名検査から通常実行Capabilityを発行する接続を残さない。過去の署名E2Eは移管前の比較基準であり、未署名の新実行経路の証明ではない。

### 環境依存を上位へ公開しない

上位の発行前checkpointにある`unknown`は耐久保存した要求意図であり、下位のHost要求発行とは別の事実である。下位観測の`request`は補助資源取得中の失敗・取消では`not_issued`を維持し、実Native停止／起動要求の試行直前にだけ`unknown`、実受付後に`issued`、完了後に`confirmed`へ進む。下位の未発行観測だけで上位の保存済み意図を巻き戻さない。入力はProxy・Accessor・閉集合外FieldをEffect前に拒否し、own data propertyから一回だけ捕捉する。

固定再起動入口`restartDockerRuntime`は要求ID、取消、現在許可の同期boolean確認、発行前unknownの保存・読戻し確認と同期通知だけを受ける。保存確認後にだけ補助資源を取得し、固定停止・開始と回収を同じ操作で閉じる。補助Processの準備完了を要求受理へ読み替えず、Nativeの停止受理または開始受理が観測された時だけ一回の`request_accepted`通知を発行する。終端通知は最終技術観測と同じ不変値を持ち、配送評価だけを返却で別に保持する。既知async関数は確認・通知へ使用せず、非boolean確認、非undefined通知、Promise・thenable、throwでは新処置を止める。上位のRoot公開接続とfresh Writer接続を完成条件に含め、途中のprivate Source参照を完成形へ固定しない。

再起動結果は、一次失敗（`primaryFailure`）と片付け失敗（`cleanupFailure`）を別に保持する。両fieldは固定理由またはnullであり、一次成功後の片付け失敗に架空の一次失敗を付けない。片付け未実施を片付け失敗へ変換せず、Context再使用や開始前拒否は一次理由だけを返す。両方が失敗した場合、既存の最終`reason`は片付け理由のまま、最初の一次理由を消さない。片付け成功後の結果確定失敗は一次理由へ記録し、片付け失敗と混同しない。helperや排他の後続解放も、保持済みの失敗分類を消さない。任意例外本文や接頭辞だけが一致する文字列は公開せず、未知の失敗を固定分類へ変換する。

Desktop停止・起動・待機・補助Process回収は、取得からreleaseまで一つの下位固定操作へ閉じる。Coordinatorは[再起動要求の現在状態契約](../coordinator/01_Architecture.md#再起動要求の現在状態と下位の短命状態)に従い、既存exact操作の単一要求記録と現在の許可／Scope確認だけを所有する。下位は生Session、停止／起動の個別phase、任意argvやOS処置callbackを上位へ公開しない。要求発行直前の耐久checkpointが不成立ならHost要求0とし、同じ稼働Ownerの受付／完了通知、取消と補助資源回収を区別する。fresh再入場は過去の要求を再発行せず、現在観測を過去成功へ変換しない。この契約は移管先の完成条件であり、上位Caller／Writerは接続済みだが、接続だけを実境界・Package完成の根拠にしない。

Engine観測の実処理は`desktop/engine-state.ts`へ置く。公開入口は再起動用途の`observeDockerRuntimeEngine()`と、上位が検証した構成領域を受ける修復用途の`observeDockerRepairEngine(configurationRoot)`だけとする。前者はconfigなし・16,384 bytes、後者は同一Rootのconfig／Home・4,096 bytesを固定し、5秒の観測期限、Publisher・前後同一性、既存の状態分類を維持する。修復用途のTimeoutは一時的な未起動として保持し、pipe不存在と観測不能・close不明を区別する。公開結果は共通状態と観測資源のcleanupだけで、生出力・Process・pipe・Pathを返さない。上位は操作ごとのclosureでcleanup不明を保持し、以後の観測0と最終blockedを保証する。元のexact IDとNative helper固有cleanup値は変更しない。再試行・待機は既存運用の責務であり、観測だけから修復や再起動の完了を主張しない。旧修復判定seamは既存試験依存の整理対象で、新しい本番観測の根拠にしない。

Docker実行物の固定Trust条件は既存`execution/cli-trust.ts`へ集約する。`describeDockerRuntimeArtifactTrustContract()`は固定条件と既存Native ProtocolのPolicy Hashだけを返し、実体検証成功・実行許可・CRDD署名資格を発行しない。上位の記録が保持するHashは操作の相関値であり、上位でDocker出所条件を再定義しない。操作をまたぐDocker更新は許容し、操作中のPublisher・Identity・Hash固定は維持する。

`desktop/backend-state.ts`はWindows／WSLの固定一覧操作と厳密分類を内部所有する。上位Root APIの`observeDockerRuntimeBackendState()`は入力を取らず、`stopped`／`running`／`unknown`だけを返す。未対応・観測不能はunknownとし、一時点の一覧からEngine全停止、Process不存在、再起動完了を推定しない。Quality導出キー`docker-isolation.backend-state`の純粋分類は`ERB-UT-034`、実取得と上位運用は既存IT／STへ接続する。

Coordinator／Orchestratorは、実行・取消・回収・診断・許可済み運用介入を環境共通の固定APIで依頼する。Linux／Windows／Docker Desktopの選択、固定CLI所在、Engine endpoint、System32、WSL、Process treeの終了手段、Host socketの技術判定は下位内部で所有する。上位の入力型・結果型・通知型に、OS選択field、Desktop専用phase、Windows実行物Pathを要求しない。環境別の実処理を上位callbackへ逆流させない。

下位は環境を判別し、検証済みの内部実装だけを使用する。現時点の成立済み実環境はWindows／Docker Desktopであり、APIを中立化したことをLinux対応の成立根拠にしない。未対応環境は共通の未対応結果で新Effect前に停止し、未知のbackendや未検証コマンドへfallbackしない。新しいPlugin／Adapter Frameworkを作らず、実在する実装と必要な内部選択だけに限定する。

子Process環境の共通OS観測はPlatform Accessを利用する。Docker用の`DOCKER_CONFIG`／`HOME`／`USERPROFILE`／`DOCKER_CLI_HINTS`の固定構成とDesktop明示修復専用の`SYSTEMDRIVE`付与は本Packageが所有する。任意keyや親ambient環境の追加は受け付けない。Docker CLIの固定実体・前後Identity／Hash・Docker Inc Publisherの検査も本Packageへ置き、固定PowerShell初期化環境だけをPlatform Accessから取得する。使い捨てProcessの技術処理と用途の許可を混同せず、新しい汎用Authenticode Frameworkは作らない。

通常実行の公開`createDockerIsolationRuntime`は、上位Ownerから作業所在の借用と作成Receiptの読取りだけをown data propertyで受ける。CLI初回観測・同操作内の再確認、最小環境、OS、configとProcess実装は本Packageが固定し、上位による差替えを受けない。Proxy・Accessor・未知field・技術依存の持込みは観測callbackを呼ぶ前に拒否し、既存platform指定の拒否理由を維持する。初回CLI観測不明と同一性再確認不明を既存の別理由へ保ち、環境生成失敗はCLI理由へ変換しない。内部Candidateの差替えは局所試験だけに限定し、公開Rootへ再exportしない。非秘密のCLI／Engine／環境／終端方式の説明もDIの固定投影とし、上位は同値を転送する。

必要なNative成果物の同一性確認、Host Root認可は既存専門Ownerに維持する。任意の正式配布署名はReleaseの責務であり、通常実行のCapabilityにしない。下位が借用する検査はその用途限定・環境中立の接続とし、CoordinatorがDockerのPublisher、pipe、WSL名等を解釈する接続にはしない。診断詳細として環境名や人間向けの具体的介入案内を返せるが、上位の制御分岐は共通の結果区分と許可済み操作だけを使用する。

上位が保存・chain・fence・Authority・履歴の正本Ownerであることと、Desktop固有の旧Schemaを現在の制御へ残すことは同義ではない。現在の入力・結果・通知・状態判断は環境中立のprojectionだけを用い、Docker固有phaseの技術解釈は下位へ閉じる。旧Desktop Schema／namespaceは移行元の根拠に限定し、現在phaseや実行許可へ流用しない。既存の人間指示に従い、旧形式の移行・清掃はフロントAIが確認して行い、Runtimeへ互換Reader・二重Schema・移行Frameworkを追加しない。過去の正式Evidence・署名・Hashは変更しない。未移行・相関不明の現状態は新Effect前に停止し、新Schemaの具体化・利用側・exact Identity・移行入力と停止条件を固定候補前に照合する。

実装は[40_Develop/docker-isolation](../../../40_Develop/docker-isolation)へ置く。既存のWindows Docker CLIの信頼観測、固定Engine、最小環境、shell禁止、出力上限、所有Process tree終端の保証を維持する。固定Path・Authenticode・同一実体Identityと環境は各spawn直前に既存Ownerへ再照合し、観測後の差替え・不明ではEffect前停止とする。初回のboolean／Hash／raw Pathを以後の実行許可へ流用しない。未検証OSへ自動fallbackしない。

Package自身は永続State、Repository-local一時Root、新しい排他を新設しない。上位Coordinatorが既存Ownerで検査／借用した用途限定projection・workspace binding・生存観測・元結果だけを§2の閉じたcallbackで受ける。下位は現在State／回復recordを読書きせず、上位のRepository／Home保存Lockを取得／解放せず、借用元Capabilityから新しいAuthorityを生成しない。既存Native helperが所有する技術操作用Mutexの取得・保持・回収は、上記の選択利用者単位の限定契約に従う。既存の検証済みbinding配下にある実行専用Docker CLI configの作成・実体照合・回収は技術Ownerの対象とし、Root作成・上位記録操作とは区別する。意味のあるEvidenceと通常診断の保持Ownerは変更しない。任意正式配布の署名を行う場合だけ、その配布対象と新Packageの対応を照合する。旧Source位置に依存する固定検査は必要Artifact観測・任意配布・旧比較へ分け、通常Runtimeの署名閉包を維持する理由にしない。

## 5. Qualityへの引渡しと完成条件

純粋な修復checkpointの終端判定は、厳格復号後に九処置の結果がすべて確認済み／明示不要であることだけを判定する。Engine・現在安全性・清掃・人間判断の総合判定や実操作の許可ではない。清掃は未要求→保留／確認／不明、保留→確認／不明、不明→確認だけの前進を許し、確認後は固定する。最初の清掃失敗は不明または後着確認と併存し、清掃未要求へ戻して消さない。

既存のCoordinator隔離・取消・回復義務を移管後の実Ownerへ接続する。移管を理由にLocal Itemを重複新設せず、既存義務、Test Symbol、実観測の対応を更新する。

| 検証面 | 観測と終了後条件 |
|---|---|
| 正常・入力境界 | 開始前拒否、固定引数、限定入力、正常終了。対象外Effect 0 |
| Process境界 | 実子Process開始・取消・出力超過・spawn失敗・補助Process終了。所有Handle／stream終端 |
| Docker境界 | 実Container／Network作成・構成・実ID回収・不存在。外部AI依頼なし |
| 失敗・回復 | 作成結果不明、部分Receipt、清掃不明、親喪失、同じIdentity再入場。一次失敗保持・不明の維持 |
| 本番利用側 | Coordinator Task、Workbench助言、CLI回復、診断、配布閉包から新Ownerへ到達。旧重複Ownerなし |

静的検査、移管先回帰、影響Consumer結合、実Docker局所確認、固定候補の技術・品質独立レビューが成立してからPackage完了を判定する。局所移管・モック試験・安全な拒否だけでは完成としない。実Provider全E2Eと後続のCoordinator／Orchestrator再編は別の未完了範囲として維持する。

追加の完成条件は、Coordinator／OrchestratorのDocker制御経路にOS／Desktop別の分岐・専用型・コマンド・Path・実処理が残らず、全本番利用側が下位Rootの共通契約に接続していることである。上位の正本保存、AI許可、Task／Attempt判断を下位へ移して行数だけを減らさない。§6の通知・結果と実観測の相関、必要な上位状態更新・伝播までを確認する。

## 6. 通知と上位状態の接続

### 九目的の実行単位と上位確認の分離

同じRuntimeの一回限りの実行単位（Session）が、固定九purpose、raw Handle、開始観測、待機、取消、終端と清掃を所有する。開始APIは不透明な`cancel`と`completion`を先に返し、実処理は返却後のmicrotaskで開始する。生成中のhook発火は0とする。終了後の取消・重複取消で新しい要求を発行せず、同じHandleのterminate/joinと清掃を各一回へまとめる。新しいStore、Registry、Lock、通知Queueは作らない。

| 同期接続 | 上位が判断・保存する内容 | 下位の扱い |
|---|---|---|
| command許可 | 現在の実行制約 | 明示trueだけで続行。再入取消を再確認 |
| CREATE前保存 | 元回復相関の要求予定 | 保存拒否後の要求0 |
| 未発行保存 | 保存後・発行前取消の事実 | 保存結果を保持し次要求0 |
| 実行要求前保存 | AI本体の要求予定 | 保存拒否後の起動0 |
| Receipt保存 | CREATEが返したexact ID | CREATE中取消でも成功Receiptを先に保存 |
| 完了観測受理 | 認証・AI出力の意味 | 拒否後の残purpose 0。意味・業務理由は上位所有 |

同期接続のfalse、throw、Promise返却は区別して閉じる。受理Gateは下位にAuthorityを発行する機構ではなく、上位の拒否を伝える有限接続である。下位の技術失敗・hook名・受理結果と、上位の業務理由を分離する。

最初の技術失敗は清掃前に同期の失敗通知で上位へ渡し、上位開始保存の遅い失敗や後続清掃で上書きしない。開始通知と失敗通知は保存Promiseを待つ接続ではない。通知の例外・非同期返却は配送未確認として保持し、その後の通知を再発行せず、技術資源の終端・清掃を継続する。

Providerの元waitは開始観測成功直後の同じ同期stackで一回登録し、成功・拒否を即時に閉じたsettlementへ結合する。通知破損時はSessionの終端確認がtrueなら同じwait終端を消費する。終端false／例外なら300秒waitを追加で待たず既存清掃へ進み、未解決観測は元RuntimeのHandle所有へ残す。後着settlementから通知・保存・結果更新・再終端を発行せず、未解決を不存在や清掃成功へ補完しない。Sessionの直接終端一回と、既存Runtime清掃による同Handleの終端再確認を区別する。

Process開始factの通知は同期であり、上位のReporter／Task開始保存Promiseを返さない。DIはその保存確認を待たず、Process完了・取消・清掃を継続する。Provider待機300秒はDIが`started=true`を確認した直後から起算する。旧実装の「上位開始確認await後に300秒」とは異なり、等価移管とは扱わない。setup待機10秒、開始観測／取消猶予5秒の数値は維持する。

上位開始保存が永久保留しても、DI側の期限・取消・自然終了と清掃は進む。上位の最終公開は保存確認のsettleも待つため、技術資源が終了しても公開結果が保留する場合がある。上位保存へ暗黙の新期限を追加しない。遅いfalse／throwは同じ不透明cancelへ一度だけ接続し、DI終了後なら新Effect 0で返す。清掃結果は同Runtimeの元結果と照合済み観測をそのまま上位へ搬送し、上位で成功形を再構成しない。

試験用Candidateは`productionAuthority:false`を固定し、本番FactoryのCLI／Process／Filesystem primitiveを差替え可能にしない。Candidate表示だけから注入primitiveのEffect 0や本番の清掃真正性を推定しない。上位の元Runtime／元計画／両Ownerの照合は維持する。

診断入力は全descriptor取得前にcommands上限9、create argv上限420へ制限する。420は固定包装164（最大64環境変数・全optional構成）と既存payload上限256から導く現planner限定値であり、汎用Docker parserの上限ではない。包装の分離値が欠けた形や次optionを値にした形は拒否し、image以後のpayloadへこの判定を適用しない。descriptor集合の必須keyと各valueはown propertyで確認し、継承された値を実入力へ採用しない。

実行前の構成診断では、`execution/command-plan.ts`の`projectDockerExecutionBoundary`がexactな`create_provider`一件を選び、固定包装optionのarityを先頭から消費して最初の位置引数を計画のimage digestへ照合する。外側からread-only・非root user・workdirの三値だけを投影し、以後の引数は解釈せず凍結コピーとして私有呼出しへ渡す。payload内の同名flagや同digestは外側の設定へ数えない。不正shape・欠測・重複・未対応包装はnullであり、上位のfalse投影は確認不能を閉じた診断値へ写すだけで、設定不存在・隔離成立・処置許可を証明しない。生argvを通知・ログ・永続値へ追加しない。

下位は技術的な実行状態を持ち、上位はAI実行またはTask／Attemptの意味上の状態を持つ。Coordinatorは用途限定の通知callbackを登録し、元Operationへ相関して自身の正本状態を更新する。必要な事実だけを自身の公開契約でOrchestratorへ伝播する。下位は受信者のPackage、Task構造、正本Store、上位のイベント名を知らない。

| 方向・段階 | 搬送する内容 | 搬送・推定しない内容 |
|---|---|---|
| 上位→開始前 | 許可された技術操作、元操作相関、検査済み用途限定binding、取消 | 未検査の任意argv、OS選択、上位Store操作、Taskの採否判断 |
| 下位→要求／開始 | 元操作相関、要求発行・受理・Process開始等の実観測、観測された実資源ID | Handle取得からの作成成立推定、AIの業務開始・成功、次Taskの開始許可 |
| 下位→結果／失敗 | 同じ操作の技術結果、一次失敗、観測不能、出力制限、所有Process終端 | Provider生出力の業務解釈、秘密値、上位の承認・再試行指示 |
| 下位→清掃終了 | 構成照合、実IDと名前の現在不存在、清掃未確認、同じ回復相関 | 取消要求だけからの終了、過去unknownの成功化、Consumer保存済みの推定 |
| Coordinator→Orchestrator | 許可された元Task／Attemptに相関した共通の事実・結果 | Docker生操作、OS別手順、下位callbackへの直接接続 |

通知とawait返却を独立した二つの正本にしない。同じ不変の技術観測を通知と最終結果へ接続し、操作相関と実際の発生順を保持する。特に終端観測は通知と最終結果の元Operation・順序・内容を一致させる。途中通知をすべて最終結果へ複製する新履歴は作らない。観測時刻は観測した段階の値であり、時刻だけで完了・所有・因果を推定しない。遅延・重複通知は上位の完了状態を戻したり処置を再発行したりしない。取消後も実資源の終端・清掃結果を保持し、購読解除だけをProcess終了と扱わない。

通知callbackは同期・直列に呼び出し、Promiseを受け付けない。型上のvoidだけで非同期関数を排除したと扱わず、undefined以外の戻り値／thenableを配送不成立として反証する。例外または不正戻り値の後は以後のcallback呼出しを止めるが、所有資源の終端・清掃と最終技術結果の確定は継続する。一次失敗や清掃事実を配送失敗で上書きしない。全通知試行の同期終了後に最終結果を一度返し、その前に登録参照を破棄する。返却後のcallback呼出しは0とする。

配送の確認／不明は技術結果・cleanupと別に返す。同期returnの成功はcallback呼出し完了だけを意味し、上位の耐久保存やOrchestrator受領成立を証明しない。callbackが上位状態を部分更新してからthrowした場合も既知Effectを巻き戻さず、上位は未確定保存と配送不成立を区別して自身の進行を止め、元相関を保持する。Consumerの任意保存・表示・耐久ACKをDocker cleanup完了条件へ含めない。新しいevent bus、永続通知Queue、Store、Lock、再送・配送Recovery Frameworkは追加しない。

Process喪失では通知が欠け得るため、通知受領だけを回復の唯一の根拠にしない。Effect前の上位exact相関と既存保存、同じIDでのfreshな下位資源観測を使用する。現在の実資源不存在を確認できない場合は不明を保持し、履歴のphaseや未着通知から不存在を補完しない。

| 代表例 | 必須処置・反証 |
|---|---|
| 発火 | 許可済みの実行／取消／清掃／診断／運用介入で下位が技術処理し、観測を通知する |
| 非発火 | AI選定・人間承認・Task進行・正本保存・上位通知の選択は下位が行わない |
| 境界 | 現在許可・bindingの生存を技術Effect前に照合。上位は通知を元Identityへ結合してから状態更新する |
| 不明 | 要求受理後のProcess喪失、観測不能、callback例外、未対応環境では成功・不存在を捏造しない |

検証は開始前拒否、部分Effect、取消、遅延・重複、callback例外・不正戻り値、通知欠測、親喪失、同ID再入場、清掃後不存在と上位の進行停止を対象にする。同時callback 0、例外後callback 0、最終返却後callback 0、登録参照0、部分更新後throwでも一次結果・cleanup不変を観測する。通知購読の存在や内部モックだけで、公開利用側まで成立したと判定しない。

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
