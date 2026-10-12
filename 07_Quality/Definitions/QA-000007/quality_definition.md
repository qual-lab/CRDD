# QA-000007 リポジトリ境界とFederationの検証定義

成果物種別: Quality定義
Quality ID: `QA-000007`
検証目標: Repository Root、Repository ID、Project ID、Binding、ユーザー・現在Role認可、WorkspaceおよびRepository Exposureを別々の識別と利用範囲で解決すること
主な試験段階: Unit／Integration／System
状態: Canonical
維持責任者: Qual-Lab

## 1. 情報源と網羅条件

| Source ID | Obligation Key | 導出元 | 保持する固有条件 | 試験段階 | 対応Local Item |
| --- | --- | --- | --- | --- |
| [REQ-000009](../../../01_Discovery/Definitions/REQ-000009/requirement.md) | `req-000009.qa-000007` | Requirement Definition（成立条件・失敗・検証意図） | 一プロジェクト一リポジトリと一プロジェクト複数リポジトリを同じ識別情報規則で表せる。リポジトリ名や配置ではなく検証済みBindingからプロジェクト所属と基点フォルダを解決する。同じProject IDでもリポジトリごとの責務とアクセス境界を保持する。単一、複数、移動後基点フォルダ、偽装パス、重複識別情報を与え、Binding解決と拒否を観測する | UT／IT／ST | `RFD-IT-001`、`RFD-ST-004`、`RFD-UT-006` |
| [REQ-000011](../../../01_Discovery/Definitions/REQ-000011/requirement.md) | `req-000011.qa-000007` | Requirement Definition（成立条件・失敗・検証意図） | 接続資格から既存userId、現在Role詳細権限、Exposure、実アクセスを分けて認可する。未許可の存在・名前・件数を開示せず、認可済み集合の部分可視を完全状態へ畳まない。 | IT／ST | `RFD-ST-003`、`RFD-ST-004`、`RFD-IT-013`、`RFD-IT-019` |
| [REQ-000008](../../../01_Discovery/Definitions/REQ-000008/requirement.md) | `req-000008.qa-000007` | Requirement Definition（成立条件・失敗・検証意図） | リポジトリ取得後、別Serverなしで標準ツールとAI作業を開始できる。CROS停止中もリポジトリ内で完結する更新と検証を完了できる。横断入口と手元入口で同じ操作の意味が変わらない。CROS未設定、停止、利用可能の各状態でリポジトリ内代表作業を実行し、依存と結果差を観測する | IT | `RFD-IT-009` |
| [REQ-000017](../../../01_Discovery/Definitions/REQ-000017/requirement.md) | `req-000017.qa-000007` | Requirement Definition（成立条件・失敗・検証意図） | 情報要素ごとに情報源、改訂版、利用範囲を保持する。許可されない、取得不能、競合する情報を推測で補完しない。Packageはタスク目的に必要な最小範囲で、中央の永続正本にならない。単一プロジェクト、複数リポジトリ、複数プロジェクト、部分アクセス、競合を与え、Package内容と欠測、根拠到達を観測する | ST | `RFD-ST-010` |
| [REQ-000020](../../../01_Discovery/Definitions/REQ-000020/requirement.md) | `req-000020.qa-000007` | Requirement Definition（成立条件・失敗・検証意図） | 一リポジトリと複数リポジトリのプロジェクトを同じ結果契約で投影する。読めないリポジトリを不存在または正常と扱わず、開示可能な不足だけを示す。同一責務の複数情報源は探索順で選ばずConflictとして返す。完全、部分アクセス、欠測、重複責務、競合改訂版を組み合わせ、投影と非開示を観測する | ST | `RFD-ST-004` |
| [REQ-000028](../../../01_Discovery/Definitions/REQ-000028/requirement.md) | `req-000028.qa-000007` | Requirement Definition（成立条件・失敗・検証意図） | 各AI入口が同じ共通規範と対象正本へ到達できる。AI固有制約を保持しつつ共通判断を入口で再定義しない。同じ変更で入口ごとの行動差がある場合に理由を追跡できる。複数AI入口から同じ代表作業を開始し、読んだ正本、適用規則、権限境界、差分理由を比較する | IT | `RFD-IT-011` |
| [REQ-000036](../../../01_Discovery/Definitions/REQ-000036/requirement.md) | `req-000036.qa-000007` | Requirement Definition（成立条件・失敗・検証意図） | 本番ツールのGit利用箇所が履歴管理 Port経由になっている。通常の読取り、編集、Communication操作が未Commit状態でも成立する。CommitやTreeが必要なリリース／根拠境界だけ明示的に改訂版を要求する。未Commit、別Branch、Git 接続部置換、リポジトリ境界不明、リリース固定改訂版を用い、各機能と拒否を観測する | UT／IT | `RFD-IT-002`、`RFD-IT-005`、`RFD-UT-006` |
| [REQ-000038](../../../01_Discovery/Definitions/REQ-000038/requirement.md) | `req-000038.qa-000007` | Requirement Definition（成立条件・失敗・検証意図） | Project ID、Repository ID、Repository Roleを分け、Repository Projectionは自らのRole内だけを表す。範囲外Contextを存在開示権限なしに列挙せず、Federationは現在のPrincipalが参照可能なRepositoryだけを対象にする。人間・複数AI・MCP・Workbenchが同じRepository Contextへ到達できることを確認する | IT／ST／UAT | `RFD-IT-011`、`RFD-ST-010`、`RFD-UAT-007` |
| [REQ-000040](../../../01_Discovery/Definitions/REQ-000040/requirement.md) | `req-000040.qa-000007` | Requirement Definition（成立条件・失敗・検証意図） | Project ContextからOwner情報と作業対象へ進み、Tree／Diff／Stage／Commit／通常Pushを扱う。Remote・Branch・送信Commitを確認し、Push拒否・通信断・結果不明を成功や暗黙再送へ畳まない | IT／ST／UAT | `RFD-IT-014`、`RFD-ST-015`、`RFD-UAT-007` |
| [REQ-000041](../../../01_Discovery/Definitions/REQ-000041/requirement.md) | `req-000041.qa-000007` | Requirement Definition（成立条件・失敗・検証意図） | ユーザー登録・表示名、developer／manager Role変更・内容権限、Repository登録・解除・Exposureはmanager／administrator。administrator Role変更・内容権限と鍵3操作はadministratorのみ。固定管理権限を内容設定で変更しない。通常7保存操作はadministrator存在を前提にせず、登録と公開、解除と削除を区別する。UUIDのユーザーと管理用表示名・Roleに資格を結合する。通常発行・独立失効・交換はadministrator固定で同一Process Workbenchだけ。通常Host回復は既存ユーザーへの交換2操作だけ、MCPに鍵操作を公開しない。Secret一度表示、指定／全ユーザー交換、対象・影響の事前表示と条件付き確認、失敗段階分離を確認する。単体利用に資格を要求しない。登録解除は同じ受付操作・採用改訂で登録と対応Exposureを除去し、両読戻しでだけ完了する。発行／結果記録不明は元発行Identityの再観測、確定発行・記録後の受け渡し未確認は現在administratorによる別明示交換、現在administrator認証未接続・喪失だけは既存Host交換とする。通常は操作administratorへ一度提示し、本人受領は観測外・追加確認なし。初回は双方未初期化確認・Host明示開始→元試行確定読戻し→administrator UUIDと同user資格→Host一度提示→同鍵限定接続の確認保存・読戻し・短命清掃／Lock終了→次要求の通常接続とする。途中・観測不能を新初期化へ戻さず、発行／記録不明の再観測と、両確定後の提示／初回接続確認だけ不明に対する別明示Host交換を分ける。 | IT／ST／UAT | `RFD-ST-003`、`RFD-ST-004`、`RFD-IT-013`、`RFD-UAT-007`、`RFD-ST-016`、`RFD-IT-017`、`RFD-IT-018`、`RFD-IT-021`、`RFD-ST-022`<br>初回設定: `RFD-IT-024`、`RFD-IT-025`、`RFD-ST-026`、`RFD-UAT-027` |
| [UX-000010](../../../02_UX/Definitions/UX-000010/ux_definition.md) | `ux-000010.qa-000007` | UX Definition（利用者成果・重要場面・重要な失敗） | 横断機能、Commit済み状態または特定の履歴実装を前提にせず、現在リポジトリで日常作業を開始・継続できる。重要場面「横断利用へ切り替える判断」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。CROS未設定、未Commitまたは履歴管理の接続部障害による無関係な作業停止を反証する | IT／UAT | `RFD-IT-005`、`RFD-UT-006`、`RFD-UAT-007`、`RFD-IT-009` |
| [UX-000011](../../../02_UX/Definitions/UX-000011/ux_definition.md) | `ux-000011.qa-000007` | UX Definition（利用者成果・重要場面・重要な失敗） | 論理プロジェクトを一つに見ながら、参照・実行・回復の対象リポジトリと基点フォルダを取り違えずに選べる。重要場面「外部作用（Effect）対象を確定する直前」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。名前やパスの類似だけから対象識別情報を推定する操作を反証する | IT／ST／UAT | `RFD-ST-004`、`RFD-IT-001`、`RFD-UAT-007` |
| [UX-000013](../../../02_UX/Definitions/UX-000013/ux_definition.md) | `ux-000013.qa-000007` | UX Definition（利用者成果・重要場面・重要な失敗） | 現在ユーザーの固定管理権限と内容利用範囲を区別できる。manager自身の内容範囲は変更前認可による明示更新後、次要求のRole・Exposure・実アクセスで再評価し、管理許可だけで内容取得できると誤認しない。現在の資格・ユーザー・Roleに基づく利用可能範囲を理解し、管理能力と内容閲覧を区別できる。非開示情報、古い権限、表示名からの権限推定を反証する。| ST／UAT | `RFD-ST-003`、`RFD-ST-004`、`RFD-UAT-007`、`RFD-ST-022` |
| [UX-000034](../../../02_UX/Definitions/UX-000034/ux_definition.md) | `ux-000034.qa-000007` | UX Definition（利用者成果・重要場面・重要な失敗） | Projectの状況から作業対象へ進み、差分を選んでCommitし、Remote・Branch・送信Commitを確認して通常Pushする。Workbench以外の経路も維持し、拒否・通信断・結果不明時に既知状態と次行動を理解できる | IT／ST／UAT | `RFD-IT-014`、`RFD-ST-015`、`RFD-UAT-007` |
| [UX-000035](../../../02_UX/Definitions/UX-000035/ux_definition.md) | `ux-000035.qa-000007` | UX Definition（利用者成果・重要場面・重要な失敗） | manager／administratorが通常管理の対象・変更前後・保持情報を理解する。managerはadministratorの表示名のみ変更できる。鍵3操作はadministratorだけと理解し、更新受理と次要求での利用可能性を区別する。管理者が既存ユーザーへの発行・独立失効・交換を区別し、Host操作者は追加認証なしで交換2操作を行える。交換4組の対象・失効範囲・発行先・保持情報を理解し、Hostまたは全ユーザー交換3組だけ明示確認する。既知の発行と後続記録・提示の失敗を混同せずSecretを再表示しない。利用者は登録と公開設定の両解除・本体保持を理解し、解除完了を開始済み操作の取消完了と誤認しない。元発行再観測、発行済み・受け渡し未確認、別明示交換、管理者として接続できない場合のHost案内を区別して次行動を選ぶ。通常は操作administratorへ一度提示し、本人受領は観測外・追加確認なし。初回は双方未初期化確認・Host明示開始→元試行確定読戻し→administrator UUIDと同user資格→Host一度提示→同鍵限定接続の確認保存・読戻し・短命清掃／Lock終了→次要求の通常接続とする。途中・観測不能を新初期化へ戻さず、発行／記録不明の再観測と、両確定後の提示／初回接続確認だけ不明に対する別明示Host交換を分ける。 | IT／ST／UAT | `RFD-ST-003`、`RFD-UAT-007`、`RFD-ST-016`、`RFD-IT-017`、`RFD-IT-018`、`RFD-IT-021`、`RFD-ST-022`<br>初回設定: `RFD-IT-024`、`RFD-IT-025`、`RFD-ST-026`、`RFD-UAT-027` |
| [IA-000006](../../../03_IA/Definitions/IA-000006/ia_definition.md) | `ia-000006.qa-000007` | IA Definition（情報・関係・状態・見つけ方） | 論理Projectを一つに見ながら、情報源、物理Root、不完全性を取り違えず現在地を判断する。UX-000009: complete／partial／開示制限（restricted）／stale／競合あり（conflicting）／不明（unknown）。UX-000011: 確認済み（verified）／未確認（unverified）／曖昧（ambiguous）／利用不能（unavailable）。UX-000015: complete／partial／開示制限（restricted）／stale／競合あり（conflicting） | IT／ST | `RFD-IT-002`、`RFD-IT-001`、`RFD-ST-003` |
| [IA-000023](../../../03_IA/Definitions/IA-000023/ia_definition.md) | `ia-000023.qa-000007` | IA Definition（情報・関係・状態・見つけ方） | Project ID、Repository ID、Repository Roleで投影範囲を定め、Role外Contextを推測表示せず、Principalが参照可能なRepositoryだけをFederationする。人間、AI、MCPおよびWorkbenchが同じRepository Contextを利用する | IT／ST／UAT | `RFD-IT-011`、`RFD-ST-010`、`RFD-UAT-007` |
| [UI-000007](../../../04_UI/Definitions/UI-000007/ui_definition.md) | `ui-000007.qa-000007` | UI Definition（認識・操作・Feedback・失敗表示） | 人間、複数AI、MCPおよびWorkbenchが同じRepository Project Contextを利用し、Consumer固有Storeを作らず、Repository Role外を推測表示しない | IT／ST／UAT | `RFD-IT-011`、`RFD-ST-010`、`RFD-UAT-007` |
| [SPEC-000011](../../../05_SPEC/Definitions/SPEC-000011/spec_definition.md) | `spec-000011.qa-000007` | SPEC Definition（正常・境界・失敗・観測不能・副作用） | 正常: Consumerを変えても同じRepository Project Contextを返す。境界: Repository Role内外とPrincipalの参照可能範囲を分ける。失敗: Consumer固有Store、Role外推測または独自の現在状態を作らない。副作用: Project Contextを読取りで返し正本を変更しない | IT／ST／UAT | `RFD-IT-011`、`RFD-ST-010`、`RFD-UAT-007` |
| [IA-000007](../../../03_IA/Definitions/IA-000007/ia_definition.md) | `ia-000007.qa-000007` | IA Definition（情報・関係・状態・見つけ方） | 一つのRepositoryで日常作業を完了し、必要な時だけ横断情報へ進む。UX-000010: 手元で利用可能（local available）／横断情報源を利用不能（cross-source unavailable）でも継続可能 | IT／ST | `RFD-ST-003`、`RFD-ST-004`、`RFD-IT-009` |
| [IA-000009](../../../03_IA/Definitions/IA-000009/ia_definition.md) | `ia-000009.qa-000007` | IA Definition（情報・関係・状態・見つけ方） | 9 Role分担行の管理許可と可変の内容権限を別情報とする。新規登録の予定Role／名前と、既存ユーザー変更のID／Role前後、Repository登録状態／Exposureを操作別に識別し、資格情報と混同しない。userId、管理用表示名、Role、資格、公開範囲と現在認可を別情報として扱う。管理権限は内容権限を意味しない。交換対象・失効範囲・既存発行先・保持情報と、失効／発行／記録／提示の既知状態を区別し、Secret再表示・非許可情報の存在開示をしない。登録と対応Exposureの両除去、旧処理の終了不明を別情報として保持する。Credential IDと非秘密の元発行Identity、元交換のexact Recoveryと別交換の別Operation／Recovery、発行・記録不明と確定後提示未確認を区別する。通常は操作administratorへ一度提示し、本人受領は観測外・追加確認なし。初回は双方未初期化確認・Host明示開始→元試行確定読戻し→administrator UUIDと同user資格→Host一度提示→同鍵限定接続の確認保存・読戻し・短命清掃／Lock終了→次要求の通常接続とする。途中・観測不能を新初期化へ戻さず、発行／記録不明の再観測と、両確定後の提示／初回接続確認だけ不明に対する別明示Host交換を分ける。 | IT／ST／UAT | `RFD-ST-003`、`RFD-ST-004`、`RFD-ST-016`、`RFD-UAT-007`、`RFD-IT-013`、`RFD-IT-017`、`RFD-IT-018`、`RFD-IT-021`、`RFD-ST-022`<br>初回設定: `RFD-IT-024`、`RFD-IT-025`、`RFD-ST-026`、`RFD-UAT-027` |
| [UI-000006](../../../04_UI/Definitions/UI-000006/ui_definition.md) | `ui-000006.qa-000007` | UI Definition（認識・操作・Feedback・失敗表示） | 普段のRepository作業を保ちながら、対象の取り違えを防げる。UX-000010: 現在リポジトリだけで日常作業を完結する: 横断利用へ切り替える判断: 手元を既定にし横断を任意に保つ: CROS未設定で手元作業まで止まる。UX-000011: プロジェクト・リポジトリ・基点フォルダを区別して対象を確認する: 外部作用（Effect）対象を確定する直前: 各識別情報と物理基点フォルダの結合を明示する: 同名や近いパスを同じ対象と誤認する。UX-000011／IA-000006: 確認済み（verified）／未確認（unverified）／曖昧（ambiguous）／利用不能（unavailable）: Project→Repository→Binding→検証済みRoot。UX-000010／IA-000007: 手元で利用可能（local available）／横断情報源を利用不能（cross-source unavailable）でも継続可能: Repository→手元の正本→作業、必要時だけCROS | IT／ST | `RFD-IT-001`、`RFD-ST-004`、`RFD-ST-003`、`RFD-IT-009` |
| [UI-000008](../../../04_UI/Definitions/UI-000008/ui_definition.md) | `ui-000008.qa-000007` | UI Definition（認識・操作・Feedback・失敗表示） | 通常7保存操作の対象と変更前後、拒否・保存確認・保存後不明を区別して表示する。managerのadministrator表示名変更を許可し、管理許可を内容取得保証へ変えない。鍵操作の入口と確認条件は既存義務を維持する。認証ユーザーの表示名と現在利用範囲、通常Workbenchの鍵3操作とHost交換2操作を区別して表示する。交換4組の対象・影響を事前表示し、3組の確認を区別する。部分失敗を成功や未発行へ丸めず、Secretは一度だけ表示する。MCPに鍵操作を表示・案内しない。両除去読戻しが揃う時だけ解除完了を表示し、片側・観測不能や旧実行の終了不明は完了へ畳まない。発行・記録が確定している時は「発行済み・受け渡し未確認」と表示し、元発行再観測・別明示交換・現在administrator非接続時のHost案内を分ける。失効した鍵の遅延応答を利用可能と表示しない。通常は操作administratorへ一度提示し、本人受領は観測外・追加確認なし。初回は双方未初期化確認・Host明示開始→元試行確定読戻し→administrator UUIDと同user資格→Host一度提示→同鍵限定接続の確認保存・読戻し・短命清掃／Lock終了→次要求の通常接続とする。途中・観測不能を新初期化へ戻さず、発行／記録不明の再観測と、両確定後の提示／初回接続確認だけ不明に対する別明示Host交換を分ける。 | IT／ST／UAT | `RFD-ST-003`、`RFD-ST-004`、`RFD-ST-016`、`RFD-UAT-007`、`RFD-IT-017`、`RFD-IT-018`、`RFD-IT-021`、`RFD-ST-022`<br>初回設定: `RFD-IT-024`、`RFD-IT-025`、`RFD-ST-026`、`RFD-UAT-027` |
| [SPEC-000010](../../../05_SPEC/Definitions/SPEC-000010/spec_definition.md) | `spec-000010.qa-000007` | SPEC Definition（正常・境界・失敗・観測不能・副作用） | 正常: 横断機能やCommit済み状態がなくてもRepository-local作業を開始できる。境界: 検証済みRoot／隣接Root、Binding一意／曖昧を分け、別Repositoryを選ばない。失敗: 名前やPath類似から別Repositoryを選ばず、曖昧時はEffect 0で停止する。観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「対象解決は読取り専用で、Repository・worktree・Git状態を変更しない」と矛盾する結果を返さない。失敗: 名前やPath類似から別Repositoryを選ばず、曖昧時はEffect 0で停止する。副作用: 対象解決は読取り専用で、Repository・worktree・Git状態を変更しない。本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す | IT／ST | `RFD-IT-001`、`RFD-ST-004`、`RFD-IT-002`、`RFD-IT-005`、`RFD-UT-006`、`RFD-IT-009` |
| [SPEC-000031](../../../05_SPEC/Definitions/SPEC-000031/spec_definition.md) | `spec-000031.qa-000007` | SPEC Definition（正常・境界・失敗・観測不能・副作用） | 正常: 選択差分だけをCommitし、確認したRemote・Branch・Commitを通常Pushする。境界: 空変更、Untracked、Conflict、Upstreamなし、Remote差分ありを区別する。失敗: Commit失敗、Push拒否、認証失敗、通信断、結果不明を成功へ畳まず誤対象へ送らない。観測不能: Push結果を確認できなければ自動再送せず、既知状態と再観測先を返す。副作用: Stage領域、Local Commit、Remote BranchへのEffectを別々に観測する | IT／ST | `RFD-IT-014`、`RFD-ST-015` |
| [SPEC-000012](../../../05_SPEC/Definitions/SPEC-000012/spec_definition.md) | `spec-000012.qa-000007` | SPEC Definition（正常・境界・失敗・観測不能・副作用） | 通常7保存操作は操作別入力と変更前現在Roleの固定管理判定から保存・読戻しへ進む。改訂競合、処置前不明、保存後読戻し／応答不明を分け、確定更新の未保存化・暗黙再更新・rollback・鍵交換Recoveryを行わない。通常発行・独立失効・交換のadministrator固定、同一Process Workbench入口、Host交換2操作、MCP鍵操作非公開を分ける。対象と既存ユーザーの結合をEffect前に確認し、交換の旧失効前からexact Recoveryを保持する。失効／発行／記録／提示を独立観測し、確定発行を後続失敗でunknownにしない。不明・認可破損時は修復やBootstrapをせず停止する。登録解除は同じ受付操作・採用改訂で登録と対応Exposureを除去し、両読戻しだけで完了する。片側残存・観測不能は未完了、旧操作の終了は別に保持する。発行／非秘密結果記録不明はCredential IDとは別の元発行Identityで再観測し、通常発行へ交換Recoveryを付与せず新交換0。確定発行・記録後の提示未確認は旧事実を保持し、現在administratorが別Operation／別Recoveryの既存交換を選ぶ。各交換内部だけsame exact Recovery。現在administrator認証未接続・喪失だけ既存Hostへ案内する。通常は操作administratorへ一度提示し、本人受領は観測外・追加確認なし。初回は双方未初期化確認・Host明示開始→元試行確定読戻し→administrator UUIDと同user資格→Host一度提示→同鍵限定接続の確認保存・読戻し・短命清掃／Lock終了→次要求の通常接続とする。途中・観測不能を新初期化へ戻さず、発行／記録不明の再観測と、両確定後の提示／初回接続確認だけ不明に対する別明示Host交換を分ける。 | IT／ST／UAT | `RFD-ST-003`、`RFD-IT-013`、`RFD-ST-016`、`RFD-IT-017`、`RFD-IT-018`、`RFD-UAT-007`、`RFD-IT-021`、`RFD-ST-022`<br>初回設定: `RFD-IT-024`、`RFD-IT-025`、`RFD-ST-026`、`RFD-UAT-027` |
| [ARCH-000009](../../../06_Architecture/Definitions/ARCH-000009/architecture_definition.md) | `arch-000009.qa-000007` | Architecture Definition（責務・境界・状態・故障） | verified／unverified／ambiguous／unavailableを分け、local／cross-sourceの対象範囲を明示する。GitはAdapterの一実装であり、通常作業全体へCommitを要求しない。所有する責務: Repository Root検証、Repository／Project Identity、Binding、選択差分のStage／Commit／確認済み通常Push。所有しない責務: Force Push、Branch作成、Merge、Rebase、Remote設定管理。読取りと変更Effectを分け、Stage、Commit、Remote反映および結果不明を個別に観測する | IT／ST | `RFD-IT-001`、`RFD-ST-004`、`RFD-IT-002`、`RFD-IT-005`、`RFD-UT-006`、`RFD-IT-009`、`RFD-IT-014`、`RFD-ST-015` |
| [ARCH-000013](../../../06_Architecture/Definitions/ARCH-000013/architecture_definition.md) | `arch-000013.qa-000007` | Architecture Definition（責務・境界・状態・故障） | Access Managementは現在Roleの9 Role分担行管理判定と、Role内容権限→Exposure→実アクセスの内容認可を別に所有する。通常7保存操作の入力・保存・読戻しを所有し、Workbenchは結果表示、Domainは認可済み集合の集約を所有する。鍵3操作／Host交換2操作／MCP鍵0は維持する。内容取得では資格→既存userId→現在Role内容権限→Exposure→実アクセスを評価する。Workbench通常鍵3操作、Host交換2操作、MCP鍵操作0を分離する。Domainは認可済み集合だけを集約し、資格・認可判断・交換Recoveryを所有しない。鍵交換はexact Identityと失敗段階を保持し、ユーザー・権限・Repository登録・Product Dataを変更しない。登録解除の受付操作・採用改訂・登録／Exposure両読戻しと旧操作終端を別に相関する。元発行IdentityとCredential ID、通常発行不明と交換Recovery、確定後提示未確認からの別交換を分離し、旧確定事実を保持する。遅延旧応答の失効鍵利用案内、一般認可失敗からHostへの迂回、新交換成功による旧受領・rollback・取消完了の推定を拒否する。通常は操作administratorへ一度提示し、本人受領は観測外・追加確認なし。初回は双方未初期化確認・Host明示開始→元試行確定読戻し→administrator UUIDと同user資格→Host一度提示→同鍵限定接続の確認保存・読戻し・短命清掃／Lock終了→次要求の通常接続とする。途中・観測不能を新初期化へ戻さず、発行／記録不明の再観測と、両確定後の提示／初回接続確認だけ不明に対する別明示Host交換を分ける。 | UT／IT／ST／UAT | `RFD-ST-003`、`RFD-ST-004`、`RFD-IT-013`、`RFD-ST-016`、`RFD-IT-017`、`RFD-IT-018`、`RFD-IT-019`、`RFD-UAT-007`、`RFD-UT-020`、`RFD-IT-021`、`RFD-ST-022`<br>初回設定: `RFD-UT-023`、`RFD-IT-024`、`RFD-IT-025`、`RFD-ST-026`、`RFD-UAT-027` |
### Architecture詳細設計入力

| 詳細設計領域 | 受け取る成立条件 |
| --- | --- |
| [Access Management](../../../06_Architecture/Details/access-management/01_Architecture.md) | 現在認可と鍵管理 |
| [管理API・保存設計候補](../../../06_Architecture/Details/access-management/02_Management_State_and_API.md) | 登録解除両除去・鍵3分岐の論理条件。物理保存・配送観測は未成立 |
| [Domain Model](../../../06_Architecture/Details/domain-model/01_Architecture.md) | 認可済み集合だけの集約 |
| [crdd-domain-library](../../../06_Architecture/Details/domain-model/02_Activity_Context.md) | 検証済みRoot内のregular file／directory観測、Root外・link境界の拒否、観測不能と不存在の分離 |
| [mcp](../../../06_Architecture/Details/mcp-server/01_Architecture.md) | Transport変換、公開Schema、Session、結果搬送 |
| [runtime-data](../../../06_Architecture/Details/domain-model/03_Repository_Storage.md) | Repository-local／OS管理Root、用途、保持、清掃、回復 |
| [version-control](../../../06_Architecture/Details/version-control/01_Architecture.md) | Repository境界、Revision、差し替え可能な履歴管理Adapter |
| [workbench](../../../06_Architecture/Details/workbench-server/01_Architecture.md) | Repository Worktree操作、Local／Remote CROS Modeおよび既存Authorityの利用 |

## 2. 試験段階と外部境界の適用

| 試験段階 | 適用 | 確認する範囲 | 外部境界の到達範囲 | 判断理由 |
| --- | --- | --- | --- | --- |
| UT | Required | Identity、Binding、Grant、Exposureと9 Role分担行×三Roleの純粋判定規則と初回条件・四状態・分岐 | N/A | FilesystemやSession接続前に区別を反証するため |
| IT | Required | Version Control Adapter、Repository Root、Stage／Commit／通常Push、Session、Workspaceと通常7保存操作と初回設定の保存・読戻し・新Process再観測境界 | Related 2 Blocks | Root解決、変更Effectおよび権限伝播を段階的に確認するため |
| ST | Required | Workbenchから確認済み通常Push、Credentialから複数Repository投影、通常管理と初回Hostの実入口から結果・受領・通常接続まで | System/E2E | 利用者操作から外部EffectまでとFederation全体を確認するため |
| UAT | Required | 初回Host設定の達成・四状態と次行動、および利用可能・利用不能なProject範囲を理解する場面 | User Acceptance | 採用済み初回設定の利用者達成・理解を確認するため（他のWorkbench／MCP体験は条件付き） |

### 条件区分の適用

| 条件区分 | 適用 | 対応Local Item | 判断理由 |
| --- | --- | --- | --- |
| 正常 | Required | RFD-IT-001、RFD-ST-003、RFD-IT-005、RFD-IT-017、RFD-ST-022、RFD-IT-024、RFD-ST-026 | 通常の成立経路を独立して確認する。|
| 境界 | Required | RFD-ST-004、RFD-UT-006、RFD-UAT-007、RFD-IT-008、RFD-IT-009、RFD-ST-010、RFD-IT-011、RFD-IT-013、RFD-IT-014、RFD-IT-018、RFD-IT-019、RFD-UT-020、RFD-IT-021、RFD-UT-023、RFD-UAT-027 | 値、Authority、情報、責務または利用者判断の境界を確認する。|
| 準正常 | Required | RFD-ST-016、RFD-IT-017、RFD-IT-021、RFD-IT-025 | 発行／記録不明と確定後提示結果未確認を分け、通常管理は両除去を含む保存確定後の不明を保持する。通常発行・通常管理へ交換Recoveryを付与しない。 |
| 異常 | Required | RFD-IT-002、RFD-IT-012、RFD-UT-020、RFD-IT-021、RFD-UT-023、RFD-IT-025 | 不正入力、故障または拒否経路を通常成功へ畳まない。|
| 回復 | Required | RFD-ST-015、RFD-ST-016、RFD-IT-025 | Push結果不明時の再観測、各鍵交換内のexact Recovery再入場、確定発行・記録後の提示結果未確認から明示する別Operation／別Recovery交換を独立して確認する。|

## 3. 検証項目

| Local ID | 条件区分 | 試験段階 | 試験種別 | 対象／境界 | 外部境界の段階 | 事前状態／入力 | 操作／刺激 | 観測 | Oracle | Evidence | 終了後条件 | 実行形態 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `RFD-IT-001` | 正常 | IT | Repository／Identity | 開始Path→Version Control Adapter→Repository Manifest | Adjacent 1 Block | 通常Root、入れ子worktree、submodule、検証済みmanifestの各fixture | 各開始PathからRepositoryを解決する | RFD-IT-001として、「各開始PathからRepositoryを解決する」前後の開始Path→Version Control Adapter→Repository Manifestについて、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | 開始Pathから最寄りの有効Rootを検証し、Repository／Project／Bindingを区別 | RFD-IT-001、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「開始Pathから最寄りの有効Rootを検証し、Repository／Project／Bindingを区別」および終了後条件「対象外RootへEffect 0」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | 対象外RootへEffect 0 | Automated |
| `RFD-IT-002` | 異常 | IT | Filesystem／Security | Path Observer→Version Control Adapter→Effect Gate | Related 2 Blocks | fake .git、reparse・link、不正中間Root、manifest不一致の各fixture | 各PathからRepository解決とEffectを要求する | RFD-IT-002として、「各PathからRepository解決とEffectを要求する」前後のPath Observer→Version Control Adapter→Effect Gateについて、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | Rootを推定せず理由と判定不能を返す | RFD-IT-002、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「Rootを推定せず理由と判定不能を返す」および終了後条件「Filesystem／Git Effect 0」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | Filesystem／Git Effect 0 | Automated |
| `RFD-ST-003` | 正常 | ST | ユーザー認証／現在認可 | Workbench→Access Management→認可済みRepository | System/E2E | 既存UUIDユーザー、管理用表示名、三Role、資格とExposure、失効・Role変更、単体利用。同じ有効鍵で時刻だけ進める場合、明示失効・交換、Role／詳細権限／Exposure変更を別fixtureとする | 資格で接続し、Role・資格変更後の次要求を比較する。各fixtureで次要求を発行する。時間経過だけのfixtureでは時刻以外の状態を固定し、明示失効・交換・現在権限変更のfixtureでは指定した変更以外を固定する | userId結合、現在Role、認可集合、非開示、入口と応答を観測。自動失効・交換・発行回数と、資格認証結果・内容認可結果を別に観測する | 表示名から権限を作らず現在認可だけを使う。管理権限から内容Accessを作らず、単体利用は資格不要。経過時間だけなら認証可否不変・自動失効／交換／発行0。明示失効・交換後の旧鍵拒否、現在権限変更の次要求反映は別に成立する | 非秘密Identity、認可結果、拒否理由。Secretは記録しない | 未許可read・存在開示0、失効資格の次要求Effect 0。開始済み処理の取消は推定しない | Hybrid |
| `RFD-ST-004` | 境界 | ST | Authorization／Non-disclosure | Credential→userId→現在Role詳細権限→Exposure→実アクセス→Repository投影 | System/E2E | 失効資格、古いRole権限、Exposure外、管理能力だけの主体、実アクセス不能 | 対象Repositoryの解決と内容取得を要求する | 現在資格・ユーザー・Role・Exposure・実アクセス判定、Reader呼出し、拒否情報を観測する | Repositoryの名前・Path・存在を漏らさず拒否。管理権限をContent Accessにしない | RFD-ST-004、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「Repositoryの名前・Path・存在を漏らさず拒否。管理権限をContent Accessにしない」および終了後条件「対象Repository Effect 0」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | 対象Repository Effect 0 | Automated |
| `RFD-IT-005` | 正常 | IT | Adapter／Compatibility | Orchestrator Port→Version Control Adapter | Direct Boundary | Commit済み・未Commitの同値Treeと、同じPortを実装するVersion Control Adapter | 両状態・両Adapterで同じRepository操作を実行する | RFD-IT-005として、「両状態・両Adapterで同じRepository操作を実行する」前後のOrchestrator Port→Version Control Adapterについて、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | Commit SHAだけに依存せず、Port契約の必要情報で成立 | RFD-IT-005、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「Commit SHAだけに依存せず、Port契約の必要情報で成立」および終了後条件「Git固有機能をCoreへ漏らさない」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | Git固有機能をCoreへ漏らさない | Automated |
| `RFD-UT-006` | 境界 | UT | Identity／Revision Policy | Project・Repository・Binding・Grant・Exposure・改訂版要否の判定規則 | N/A | 単一・複数Repository、重複Identity、範囲外Grant、未Exposure、未Commit通常操作、未固定Release／Evidence操作の各入力 | 対象Project、利用可能Repository集合および操作ごとの改訂版要否を判定する | Identity判定、操作種別、改訂版有無、許可範囲および拒否理由を記録する | Identityを混同せず、通常操作は未Commitで成立し、Release／Evidence境界だけ未固定改訂版を拒否する | 入力Identity、操作種別、改訂版状態、判定結果、拒否理由および終了後Effect 0。絶対Pathは保存しない | Filesystem・Session・Repository Effect 0 | Automated |
| `RFD-UAT-007` | 境界 | UAT | 利用範囲／鍵操作理解 | 表示→利用者判断 | User Acceptance | 単一／複数Repository・非開示／不明、9 Role分担行・通常7保存操作・自己内容変更、登録とExposure両解除、片側未完了、両除去／旧実行終了未観測。通常発行・独立失効・交換4組と発行／記録不明・確定後提示結果未確認・管理者非接続。期限なしの有効鍵、失効した旧鍵、鍵は有効だが内容権限なし、漏えいの疑いを含める | 対象・利用範囲・解除と交換の影響、既知／不明を利用者が説明し、元発行再観測・別明示交換・管理者として接続できない場合のHostを選ぶ。期限なし・現在権限・漏えい時の既存明示処置を説明して次の行動を選ぶ | 管理主体・対象・Role前後、受理と次要求の利用可否、解除両除去／本体保持と旧実行の別表示、発行済み・受け渡し未確認、元処理と別交換、4組表示3組確認、利用者理解・誤解・未判断を記録。時間経過と失効／交換、資格有効と内容許可を区別した理解を記録する | Project・Repository・Rootと許可範囲を区別。managerのadministrator名前のみ変更、登録≠公開、解除≠本体削除・旧実行取消。発行／記録不明と確定後提示結果未確認を区別して元発行再観測／別明示交換を選び、現在administrator非接続だけHostを選ぶ。別交換成功を旧Secret受領と誤認しない。理解結果だけで保存・実資源終了を証明しない。期限なしを常時アクセス可能と誤解せず、漏えい時は既存の明示失効・交換を選べる | 対象版・表示・利用者判断。Secretや個人情報本文は保存しない | 許可外Effect 0、Secret再表示0 | Manual |
| `RFD-IT-008` | 境界 | IT | Snapshot／Consistency | Version Control Port→working tree・revision Observer→単一Snapshot | Direct Boundary | 同じRepositoryの固定状態と、観測途中でworking tree／revisionを変更する競合fixture | Snapshotを一回取得し全利用側へ渡す | Snapshot Identity、working tree状態、revision、observed_at、各Consumer受領Identity、途中変更前後の値、一時出力件数を記録する | 一回の観測結果だけを全Consumerが使い、観測途中の変更を同一Snapshotへ混在させない | RFD-IT-008、Snapshot Identity、working tree・revision・observed_at、Consumer受領集合、競合検出、Oracle判定を保存する。絶対Pathは保存しない | 一時出力0、Repository Effect 0 | Automated |
| `RFD-IT-009` | 境界 | IT | Optional CROS／Local Equivalence | Repository-local入口→任意CROS接続→同一Repository契約 | Related 2 Blocks | CROS未設定、停止、利用可能の三状態と、同一Repository・代表作業 | 各状態で同じRepository-local更新と検証を実行する | 入口、CROS状態、入力・結果Contract、Repository差分、外部依存、Effect件数を記録する | CROS未設定・停止でもlocal作業が成立し、利用可能時も操作意味とRepository結果が変わらない | RFD-IT-009、三状態の契約・差分・依存・Effect比較を保存する | CROS停止時のCROS Effect 0、Repository外Effect 0 | Automated |
| `RFD-ST-010` | 境界 | ST | Context Package／Provenance | Repository Projection→Context Package→Consumer | Related 2 Blocks | 単一・複数Repository／Project、部分アクセス、競合、欠測を含む固定Context | 目的限定Packageを生成しConsumerへ渡す | 要素別Source、Revision、Scope、欠測・競合、Package Identity、保持先、Consumer受領内容を記録する | 許可された最小範囲だけを含み、欠測・競合を推測補完せず、Packageを永続正本にしない | RFD-ST-010、要素別provenance、Scope、欠測・競合、Package lifecycle、Oracleを保存する | Consumer終了後Packageを正本として残さず、元正本Effect 0 | Automated |
| `RFD-IT-011` | 境界 | IT | AI Entry／Canonical Resolution | AI入口→共通規範→Canonical Source→行動計画 | Related 2 Blocks | 複数AI入口、同一代表作業、入口固有制約、同一Canonical改訂版 | 各入口から作業計画と適用規則を解決する | 入口Identity、読んだ規範・Canonical Source・Revision、Authority境界、行動差と理由を記録する | 共通判断を入口で再定義せず、差は入口固有制約に根拠を持ち、同じCanonical Sourceへ到達する | RFD-IT-011、入口別規範・Source・Revision・制約・差分理由を保存する | 未承認Effect 0、Canonical Source変更0 | Automated |
| `RFD-IT-012` | 異常 | IT | Repository Observation／Resource Lifecycle | 検証済みRoot→Repository Observation Port→regular file／directory | Direct Boundary | Root内の通常file／directory、Root外Path、symbolic link、junction、読取り不能・観測不能を含む固定fixture | Repository相対Pathのfile／directory観測を要求する | 要求Root／相対Path、entry分類、reason、開始・終了後handle数、一時成果物数を記録する | Root内regular entryだけを観測し、Root外・link／junction／読取り不能・観測不能を区別して拒否し、観測不能を不存在へ畳まない | RFD-IT-012、固定fixture Identity、entry分類、拒否理由、handle／一時成果物件数、Oracle判定および終了後条件を保存する。Secretと絶対Pathは保存しない | 開いたhandle 0、一時成果物0、Repository Effect 0 | Automated |
| `RFD-IT-013` | 境界 | IT | 現在認可／Domain入力 | Credential→userId→現在Role詳細権限→Exposure→実アクセス→Domain | Related 2 Blocks | 失効資格、Role変更、Exposure外、管理権限のみ、読取り不能、許可集合欠落。同じ現在有効鍵で時刻だけ変える場合と、明示失効／交換・Role／詳細権限／Exposure変更を分ける | 要求ごとに許可集合を解決してDomain Readerへ渡す。時刻だけの変更と各管理変更の前後で同じ内容要求を行う | 認可順序、渡した集合、Reader呼出し集合、拒否情報。資格照合結果と内容認可結果、失効・交換・発行呼出し回数を分離する | 現在認可済み集合だけを渡す。未許可の存在・件数・名前を開示せず、集合欠落時に全Registryや旧Grantへfallbackしない。時間だけでは自動失効／交換／発行0、資格照合不変。資格が有効でも現在権限によりReader拒否され得る | 非秘密入力・認可・Reader呼出し・終了後条件 | 未許可Reader 0、Domainによる認可判断・資格操作0 | Automated |
| `RFD-IT-014` | 境界 | IT | Version Control／External Effect | Workbench Application Port→Version Control Port→Git Adapter→Remote | Related 2 Blocks | 検証済みRepository、選択差分、空変更、Untracked、Conflict、Upstreamなし、Remote差分あり、Push拒否のfixture | Stage／Unstage、Commit、確認済み通常Pushを順に要求する | 選択集合、各Effect発行・確認、Commit Identity、Remote・Branch、Push受理／拒否／不明、Process終了を記録する | 選択差分だけをCommitし、確認済み対象だけへ通常Pushする。失敗・不明を成功へ畳まず自動再送しない | 入力Identity、Effect段階、正規化結果、終了後状態、process／handle件数。秘密値と絶対Pathは保存しない | Force Push 0、結果不明時の再送0、process／handle 0 | Automated |
| `RFD-ST-015` | 回復 | ST | Workbench／Push Lifecycle | Workbench操作→Application→Version Control Adapter→Remote→結果表示 | System/E2E | Tree／Diff表示、選択差分、Commit内容、確認済みRemote・Branch・Commitと、成功／拒否／通信断／結果不明の各経路 | 利用者が差分を選びCommitし、送信対象を確認して通常Pushする | UI状態、利用者確認、各Effect、Remote結果、終了後Tree、再観測先を記録する | CommitとRemote反映を区別し、拒否・失敗・不明を表示する。結果不明時は同じ対象を再観測して人間判断へ戻す | 固定したScenario、操作、表示、Effect、Oracle、終了後状態。Credentialや生出力は保存しない | 暗黙再送0、Force Push 0、誤対象Effect 0、残存process 0 | Hybrid |
| `RFD-ST-016` | 回復 | ST | 鍵交換／段階別結果 | 通常Workbench／Host対話CLI→Access Management | System/E2E | 指定／全員交換×通常Workbench／Hostの4組、既存ユーザー・administrator、各段階失敗／Process喪失。不明発行／記録と確定後提示未確認を別scenarioにし、現在管理者認証未接続・喪失、一般認可失敗、非administrator、遅延旧応答、管理Credential認証なしのログイン済みHost操作者による指定／全員交換を与える | 事前表示・条件付き確認・交換と元exact Recoveryへの再入場。元発行／記録不明では再観測だけを行う。確定発行・記録後の提示未確認では現在administratorが既存交換を別操作として明示選択。管理者として接続できない時だけ既存Host交換を選ぶ。Hostは鍵行全byteの実TTY write callback成功と、その時点までのerror／取消なしを観測。Workbenchは当該administrator要求に束縛した応答全byteの実HTTP finishと、その時点までのerror／取消なしを観測する。| 非秘密元発行Identity・Credential ID、元操作／別操作・別Recovery、各交換内の失効前exact結合、失効／発行／記録／提示、表示・確認回数、遅延応答。耐久読戻しと新Processの同じexact Recovery・現在Authorityを別に観測。各Surface観測後の非秘密exact Binding fresh照合とconfirmed別出版。| 4組の対象・失効範囲・既存発行先・保持情報を表示し3組だけ明示確認。指定は先の鍵を含む対象全旧有効資格→同じ既存userIdへ1資格、全員は先の鍵を含む全旧有効資格→指定既存administratorへ1資格・他者は通常再発行／再配布。元発行／記録不明は元Identity再観測・新交換0、交換由来だけ元exact Recovery。確定後提示未確認からの別交換は別Operation／Recoveryで旧事実保持、各交換内部だけsame exact。Secret保存・再表示・自動再発行0。通常Workbenchの非administrator鍵呼出し0。Hostはログイン済みローカル操作者を信頼し、追加Credential認証・OS昇格を要求しない。Host案内は現在administrator認証未接続・喪失時の既存2操作で、一般認可拒否を迂回しない。提示前unconfirmed確定、一回出力、サービス側観測後confirmedを別出版。本人受領は観測外・追加確認なし。遅延旧通知で交換後資格をconfirmedにしない。出力成立はClient受領／DOM描画／人間閲覧ではなく、将来の通信成功も保証しない。| 非秘密元／別Identityとexact Recovery、各Effect・段階別既知／不明、表示・確認・遅延応答、保持情報差分、Oracle。Secret・生応答本文を記録しない | User ID・表示名・Role・詳細権限・登録・Product Data保持。処置前不明はEffect前停止、処置後は既知事実・同じ交換Recovery保持。失効確定／発行不明は未完了。旧資格再有効化・rollback・Bootstrap・破損修復0。失効鍵の遅延利用案内0。別交換成功≠旧Secret受領・元処理rollback・開始済み取消完了。重複発行0 | Hybrid |
| `RFD-IT-017` | 正常 | IT | 通常鍵発行 | 同一Process Workbench→Access Management | Direct Boundary | 現在administrator、既存／不明userId、発行・非秘密結果記録不明、発行／記録確定後の提示結果未確認（本人受領は観測外）、manager／developer、Roleから鍵権限付与の反例 | 通常発行を要求し、各失敗段階の結果を再観測する。発行・記録確定後の提示結果不明は現在administratorの明示選択へ渡し、ここから交換を自動開始しない。資格はpresentation:not_attemptedで保存し、同資格を別改訂のunconfirmedへ出版・読戻し・短命清掃／Lock終了後に限りSurfaceへ渡す。 | 認可、対象userId、Credential IDと別の非秘密元発行Identity、発行・記録・提示、表示・新発行・旧失効・交換Recoveryの回数、対象外情報の前後差分。提示前unconfirmedの出版・読戻し・清掃／Lock終了とSurface出力順、出力後confirmedの別出版、非秘密exact Bindingと遅延通知を観測。not_attemptedとunconfirmedの別改訂・保存順、出力開始の前後。 | 既存ユーザーへ1資格、一度表示。元通常発行で旧失効0・交換Recovery 0。不明対象はEffect前停止。発行／記録不明は元発行Identityと既知事実で再観測し、新交換0・unresolvedKeyExchangesへの通常発行格納0。発行・記録確定後は「発行済み・受け渡し未確認」を保持し、Secret再表示・保存・自動再発行0。非administrator・Role設定からの鍵権限付与は拒否・鍵操作呼出し0。操作administratorへ一度だけ提示・追加受領操作0。サービス側出力境界への全byte引渡し≠Client受領／DOM描画／本人閲覧。unconfirmed以後の再表示0、遅延確認はfresh相関不一致なら更新0。unconfirmed確定前のSurface出力0。出力観測後は非秘密exact Bindingでfresh照合してconfirmedを別改訂へ出版し、失効・交換・別改訂・別要求ならconfirmed更新0。 | 非秘密元発行Identity・Credential IDの別相関、各段階の既知／不明、対象版・Oracle・差分。Secretは記録しない | 他資格・ユーザーID・表示名・Role・詳細権限・登録・Product Data不変。確定発行を後続提示故障でunknownに戻さず、未確認を未受領確定にしない。後続の別明示交換を元通常発行の旧失効0条件と混同しない | Automated |
| `RFD-IT-018` | 境界 | IT | 独立鍵失効 | 同一Process Workbench→Access Management | Direct Boundary | 現在administrator、exact資格IdentityとuserId結合／不明・不一致、他資格、manager／developer、Role設定から鍵権限付与を試みる反例。unconfirmed資格の提示通知遅延中に独立失効。 | 独立失効を要求する。失効後、同じ資格で次の要求を送る。遅延した非秘密提示通知を渡す。 | 対象結合、失効対象、他資格状態、発行・Secret・交換Recovery件数。保持対象情報の処置前後差分を比較する。次要求の拒否とEffect件数。提示確認更新件数と失効保持を別観測。遅延callbackのcaptureが非秘密資格ID・元発行／提示operation・期待改訂・検証済みRootだけで、Secret captureがないことをSource照合する。 | exact資格だけ失効する。不明・不一致はEffect前停止。別資格へ対象を拡張しない。非administratorとRole設定からの鍵権限付与は拒否し鍵操作呼出し・発行・失効0。失効済み資格の次要求は拒否・Effect 0（開始済み処理の取消は保証しない）。遅延通知で失効資格のpresentationをconfirmedへ変えず更新0・有効化0。非秘密Bindingによる同Lock fresh照合は維持し、失効資格や別対象のconfirmed出版0。 | 非秘密対象・結合・失効確認・拒否理由 | 他資格失効0、発行0、Secret 0、交換Recovery 0、userId・username・Role・Role詳細権限・Repository登録・Product Data・他資格不変 | Automated |
| `RFD-IT-019` | 境界 | IT | 認可済みContext集約 | Access Management許可集合→Domain→Workbench／MCP | Related 2 Blocks | 認可済み単一／複数集合、partial、conflict、欠測、集合欠落 | 集合を渡してContext・Portfolioを集約する | 渡した集合、Reader呼出し、Source・Coverage・競合・欠測・結果 | 認可済み集合だけを集約しpartial/conflict/source coverageを保持する。集合欠落は停止。認可・Credential・交換RecoveryをDomainへ移さない | 非秘密集合・出所・観測・拒否。正式Evidenceは新実行で生成 | 未許可read 0、全Registry・旧Grant fallback 0、正本更新0 | Automated |
| `RFD-UT-020` | 境界 | UT | 固定管理権限判定 | 現在Role→9 Role分担行に対応する11認可要求種別の純粋判定 | N/A | 三Role×11認可要求種別（9 Role分担行の対象Role制約を含む）、登録予定Role、既存Role前後、表示名だけ、未知Role／対象 | 許可・拒否・判定不能を判定する | 入力・分岐・判定理由。I/O呼出しのない純粋関数を確認する | managerはadministratorの表示名のみ変更可。administrator Role・内容権限・鍵は不可。固定管理許可を内容設定で変更しない。不明は許可にしない | 非秘密入力・期待値・実判定・Oracle。資格値なし | Filesystem・鍵・Repository Effect 0（純粋実装を確認） | Automated |
| `RFD-IT-021` | 境界 | IT | 通常管理の保存境界 | 通常7保存操作→Access Management→保存・読戻し | Direct Boundary | 登録予定Role／名前、表示名の既存ID／新名、Role変更のID／前後Role、内容権限の対象Role／内容、Registryの対象ID／登録状態／変更、Exposureの対象ID／登録・公開状態／変更。改訂競合・処置前不明・保存後故障。解除対象の現在登録と対応Exposure、同じ受付操作・期待改訂、片側残存・観測不能、両除去済みでも旧操作終了未観測 | 変更前現在認可で操作し、保存・読戻し・次要求を実行する | 変更前認可、受付操作、期待／採用改訂、登録・Exposure各除去と読戻し、保存呼出し、既知更新と不明範囲、対象外差分、再送回数、旧操作終了観測を別に記録 | 通常管理にadministrator存在を要求しない。managerのadministrator Role／内容権限変更は拒否・書込み0。解除は同じ受付操作・採用改訂で登録と対応Exposureの両除去読戻し時だけ完了し、事前の別公開解除や登録時Binding再検証を要求しない。片側・観測不能は未完了。確定更新を未保存にせず、暗黙再送・rollback・鍵交換Recoveryなし | 非秘密対象・改訂・各段階・Oracle・終了後状態。秘密値なし | 他登録・Exposure、対象Repository本体・Product Data・資格を保持。両除去確定≠開始済み取消完了・過去Effect 0・実資源終了。故障は既知更新／不明範囲を保持し再送0。所有handle終了を観測 | Automated |
| `RFD-ST-022` | 正常 | ST | 通常管理の公開縦断 | 実Workbench入口→Access Management→保存・読戻し→結果表示→次要求 | System/E2E | 通常7保存操作、三Role、manager許可操作＋administrator不在／利用不能、自己内容変更。公開中Repositoryの解除、片側除去・読戻し不明、両除去確定／旧実行終了未観測。非採用MCP操作 | 公開入口で変更し、結果表示後に次の内容取得を要求する | 実入口、変更前認可、受付操作・採用改訂、登録／Exposure両除去読戻し・表示、部分結果、次要求の現在Role／Exposure／実アクセス、Readerと書込み、終了後状態 | 変更前管理認可→明示更新→次要求の内容再認可。manager許可管理にadministrator存在を要求しない。解除完了は同一操作・改訂の両除去読戻し時だけ表示。片側／不明は未完了。登録≠公開、解除≠本体削除・開始済み取消完了。旧許可集合を次要求へ再利用しない。模擬AdapterだけでPassにせず非採用MCP Toolは非公開 | 固定版・実入口・非秘密相関・各観測・Oracle。旧Evidence流用なし | 他登録・Exposure／対象Repository本体を保持。拒否時書込み0、解除後の未許可Reader 0、鍵Effect 0、暗黙再送0。解除成功から旧実行・実資源終了を表示せず、所有資源終了は別に実観測 | Hybrid |

| `RFD-UT-023` | 境界 | UT | 初回設定の純粋判定 | 初回条件・状態・分岐（I/Oなしのため外部境界非該当） | N/A | 双方確認済み未初期化＋明示開始、単一File欠落、既存、確認済み途中、読取不能・破損・Lock競合・未解決回復 | 各入力の開始可否と次の処置を判定する | 状態・許可／拒否／判定不能・分岐理由、I/O呼出しなし | 双方未初期化確認と明示開始だけ新規作成許可。既存は拒否、途中は元試行再観測、観測不能は停止。欠落や不明を許可へ畳まない。通常9 Role分担行の判定を流用しない | 非秘密の入力・期待値・分岐・Oracle | UUID／鍵／Filesystem Effect 0を純粋実装で確認。外部状態不存在の証明にはしない | Automated |
| `RFD-IT-024` | 正常 | IT | 初回設定の保存境界 | Access Management→管理状態・進行記録の保存Owner | Direct Boundary | 検証済み既存Host Root、双方未初期化、明示開始・管理用表示名。相関保存／読戻し失敗も比較。Host提示confirmed／未確認、完全discover／不正method・ID・Envelope、旧・失効・別User資格、期待revision／初期・確認資格差、未解決交換、同時要求。 | 排他下で前提再照合→元試行確定・読戻し→UUID作成→同userId資格発行→非秘密結果確定・読戻し。提示前unconfirmed確定→一度出力→提示観測→限定discover完全検査→同Lock fresh相関→completed出版・読戻し・短命清掃／Lock終了→成功応答を順に比較する。資格はpresentation:not_attemptedで保存し、同資格を別改訂のunconfirmedへ出版・読戻し・短命清掃／Lock終了後に限りSurfaceへ渡す。 | 前提再照合、元試行・各段階の順序、保存改訂と読戻し、UUID／資格の結合、各Effect回数、対象外差分。初期資格ID／最新確認対象ID・v2改訂、KDF照合と要求検査の別、応答順、同時要求の出版回数、次要求の現在認証。not_attemptedとunconfirmedの別改訂・保存順、出力開始の前後。 | 元試行相関の確定・読戻しが最初のUUID／鍵Effectに先行。一UUID・administrator一Role・同userId一資格。表示名は認証／権限ではない。相関不明はUUID／鍵Effect前停止、Root準備の既知Effectは別に保持。不正要求は確認Owner呼出し／更新0。提示confirmed・exact有効資格・同attempt／user／期待改訂・未解決交換0を同Lockで確認する。同Bindingだけ一出版・再観測に収束。全保存終了条件前の成功応答0、同要求の通常Authority0、次要求だけfresh通常認証。unconfirmed確定前のSurface出力0。出力観測後は非秘密exact Bindingでfresh照合してconfirmedを別改訂へ出版し、失効・交換・別改訂・別要求ならconfirmed更新0。 | 非秘密相関・改訂・順序・件数・差分。Secret／Verifier／saltをEvidenceへ記録しない | 生Secret保存0、暗黙登録・Exposure・内容付与・Product Data更新0。所有Lock／handle／短命Fileの解放を観測し、観測不能は未確認。電源断保証は対象外。確認清掃で有効資格を削除しない。 | Automated |
| `RFD-IT-025` | 回復 | IT | 初回途中状態の再観測 | 新Host Process→Access Management→保存Owner・既存Host指定交換への引渡し | Adjacent 1 Block | 相関確定後、作成／発行／記録中、提示前unconfirmed出版、提示結果記録、限定接続確認の出版／読戻し／清掃／Lock終了、確定後応答喪失の各Process喪失。取消、二要求／Host交換競合、相関不能も比較 | 各時点でProcess喪失・故障・取消を与え、新Processから同じ元試行と既知／不明を読戻す。発行・記録確定後の提示／限定接続未確認だけ既存指定交換を別明示操作として選ぶ | 元試行と既知／不明、現在ログイン済みHost操作者、作成／発行／記録／提示／限定接続確認、新旧Operation・各交換exact、禁止Effect各件数、資源終端 initialCredentialIdとHost交換後confirmationCredentialId、旧鍵拒否・新鍵確認、遅延通知更新0、保存と応答喪失の別。| 元試行参照は非Authority。現在Hostを再照合し追加Credential認証・OS昇格なし。発行／記録不明は同元試行再観測だけで新交換0。両確定後だけ作成済みadministratorへ別明示指定交換を渡す。旧事実保持、交換内部same exact、元試行と別交換を混同しない。同一Process再呼出しだけで充足しない 保存開始前取消は更新0、開始後は終了を待ち成功応答0。成功出版後の応答喪失はcompleted保持・rollback0、次要求で再観測。Host交換は元attempt／user／初資格履歴を保ち、直近提示の新資格だけを確認対象とする。| 故障点・非秘密元／別Identity・読戻し・各禁止件数・Oracle。秘密値・生応答を記録しない | 別UUID・自動追加鍵・自動再初期化・Secret保存／再取得／再表示0を別観測。合法な別明示交換の新鍵を自動追加鍵と混同しない。所有資源解放を観測し不明なら同じ未解決事実保持、新Recoveryは作らない | Hybrid |
| `RFD-ST-026` | 正常 | ST | 初回Host設定の公開縦断 | 実Host対話入口→Access Management保存→一度提示→実HTTP限定discover→確認確定→次要求の通常認証、Workbench接続操作 | System/E2E | 正規未試行、既存・途中・観測不能、提示未確認・接続不成立、不正discover／Tool要求、保存故障・応答喪失、Host明示交換、WorkbenchとCRDD固有MCP-only接続 | 実Hostで表示名を入力・明示開始し、TTY一度出力と限定discoverを実行する。確認保存・読戻し・清掃／Lock終了が応答に先行し、次要求で通常認証へ進むことを実観測する。実TTYの全byte出力／callback／errorと実HTTPの完全要求／保存／応答を確認する。模擬callback成功で代替しない。| 実入口・元試行・初期／確認資格の非秘密相関、提示前unconfirmedとサービス側出力、確認出版・終了・応答の順、初回完了表示と次通常要求、所有資源終了。実境界でnot_attempted保存→別改訂unconfirmed確定→一回出力→サービス出力成立→fresh照合→別改訂confirmedの順を観測。| Host一度提示、通常の追加受領操作0。Workbenchは初回設定／初回秘密提示をせず接続操作を扱う。完全限定discoverだけ初回確認を許可し、不正／Tool要求は更新0。確認保存終了前の成功応答・通常Authority0。通常Host交換と初回を分離、応答受領・人間閲覧を出力完了から推定しない。模擬Adapter成功だけでPassにしない。Hostは実TTY callback、Workbench接続は実HTTPを観測し、内部成功だけを本番成立にしない。| 固定版・実公開入口・非秘密段階と結果・回数・Oracle。秘密値を記録／添付しない | 暗黙登録・公開・内容付与0、Secret保存／再表示0、所有Process／handle／Lock／短命Fileの解放を個別観測。未接続の具体観測は未評価。未解決事実は保持し成功にしない | Hybrid |
| `RFD-UAT-027` | 境界 | UAT | 初回設定の利用者達成・理解 | 初回Host入口とWorkbench案内→利用者 | User Acceptance | 未初期化・既存・確認済み途中・観測不能、正常達成、発行／記録不明、Host提示未確認・限定接続未確認、接続未成立 | 利用者が表示名入力・明示開始・Host鍵一度表示・接続操作・次要求の通常利用へ進み、各状態で次の行動を選ぶ。コピー後に追加受領ボタンを押す手順を要求しない | 達成結果、状態と次行動の理解、選択理由、表示名／UUID／鍵／Roleの区別、提示と初回限定接続・通常利用の個別理解、未理解範囲 | 正常に初回管理接続へ到達できる。表示名≠認証／Authority、サービス側提示≠本人受領保証、限定接続確認≠同要求の通常操作許可、既存拒否≠途中再観測を理解。初期化繰返し・Secret再表示・自動再発行を期待せず、両確定後だけ別明示指定交換へ進める | 参加条件・固定Scenario・非秘密の選択／理由／達成・Oracle。秘密値・個人情報を複製しない | 理解確認だけで保存・資源終了を証明しない。実処置は現在Host Authorityと同意範囲で行い、未許可Effect0は別観測、未判断を成功にしない | Manual |

### 通常管理の完全な導出対応

状態Schemaの純粋検査は`RFD-UT-028`としてNew導出する。Canonical／MeaningはARCH-000013／`arch-000013.qa-000007`、Source ModelはAccess Management詳細§4.5と「純粋Schema検査への具体化」、Model Itemは完全Snapshot・容量・現在／歴史参照・初回／交換段階相関。管理判定UT-020、観測分類UT-023、保存IT-021／024とは入力・Oracle・観測境界が異なるため分ける。

| Local Item | Condition Class | Test Level | 対象 | 観測境界 | 外部境界段階 | fixture | 刺激 | 観測 | Oracle | 記録 | 終了後条件 | 方法 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `RFD-UT-028` | 異常 | UT | 管理状態の純粋Schema | UTF-8 bytes→完全Snapshot検査 | N/A: I/Oなし | v2完全baseline・初回4変種・presentation三値・初期／確認資格ID相関・交換3段階・参照矛盾・raw byte境界・旧v1／旧receipt等余分field | Package公開parseへUTF-8 bytesを入力 | parsed／invalid・固定理由・状態形状 | 閉集合・ID一意・現在参照・段階相関成立だけparsed。完了初回の履歴ID整理は許可。16 MiB超過をparse前拒否、壊れたUTF-8を拒否。入力を補完・修復しない v1・旧delivery／receipt／normalConnectionを補完受理しない。初期資格の歴史的元発行と確認対象の同User結合を分け、未知presentation・未生成ID・現在参照欠測を拒否。| 非秘密Scenarioと結果のみ | File／鍵／認可Effect 0。parse成功≠保存・配送成立 | Automated |

RFD-UT-028はSource／Test Symbolと試験台帳へ接続する候補で、正式結果はNot Run。全13定義は191項目（QA-000007は28項目）となる。旧190項目の表示は追加前の履歴である。既存IT／ST／UATは未実行を維持する。

| Local Item | Canonical ID／Meaning ID（既存導出キー） | Source Model | Model Item |
| ---| ---| ---| ---|
| RFD-UT-020 | ARCH-000013／arch-000013.qa-000007 | Architecture Definition／Access Management詳細 | 9 Role分担行の管理判定、通常管理と内容認可の分離 |
| RFD-IT-021 | REQ-000041／req-000041.qa-000007、SPEC-000012／spec-000012.qa-000007、ARCH-000013／arch-000013.qa-000007 | Requirement Definition／Behavior Detail／Access Management詳細 | BHV-000012、操作別入力、変更前認可、保存・読戻し、失敗段階 |
| RFD-ST-022 | UI-000008／ui-000008.qa-000007、SPEC-000012／spec-000012.qa-000007、ARCH-000013／arch-000013.qa-000007 | UI Detail／Behavior Detail／Workbench詳細 | SCR-000008、PRT-000008、PRT-000008.spec-000012、BHV-000012、通常管理の公開縦断 |
| RFD-UAT-007（更新） | UX-000013／ux-000013.qa-000007、UX-000035／ux-000035.qa-000007 | UX Definition／UI Detail | 固定分担と操作対象の理解、更新受理と内容利用の区別。理解観測だけで保存成立を証明しない |

UTの外部境界はN/A（I/O前の純粋判定）、ITはDirect Boundary、STはSystem/E2E、UATはUser Acceptance。上流のIA・REQ・UX・UI・SPEC固有条件は情報源表から同じ項目へ統合し、別の重複Local Itemを作らない。

### 初回Host設定の完全な導出対応

今回の目標は[AMの限定接続契約](../../../06_Architecture/Details/access-management/02_Management_State_and_API.md#25-初回限定接続の具体契約)とv2 Schema切替案から導出する。通常の本人受領は観測外、初回だけ同鍵の完全な限定要求と確認保存で接続成立を検証する。以下は既存項目内の反証区分で、新しいLocal Itemではない。旧v1 Parserや旧受領方式の局所成功を新版へ流用しない。

| 反証区分 | 既存項目 | 期待結果・観測 |
| --- | --- | --- |
| 提示前／提示後の故障 | RFD-IT-017、RFD-ST-016 | unconfirmedの出版・読戻し・材料清掃・Lock終了が出力に先行。一回出力後の記録故障も再表示0。サービス出力と本人受領を区別 |
| 遅延提示通知・独立失効 | RFD-IT-018、RFD-ST-016 | 非秘密exact Bindingをfresh照合し、失効・交換・別改訂・別要求なら確認更新0。旧鍵・別鍵の復活0 |
| 完全要求／不正要求 | RFD-IT-024、RFD-ST-026 | 正規server/discoverだけ確認処理へ。不正Header・JSON・Envelope・ID・method、tools/list／callは更新0。KDF一致・HTTP到達だけで成功にしない |
| 保存・取消・競合・応答喪失 | RFD-IT-025、RFD-ST-026 | 保存前取消は更新0、保存開始後は終了を待つ。確認出版・読戻し・短命清掃・Lock終了が応答に先行。応答喪失後もcompletedを保持し、次要求で再観測。同Bindingは一出版、古い候補は更新0 |
| Host交換後の初回確認 | RFD-IT-025、RFD-UT-028 | 元attempt／user／initialCredentialId保持、新confirmationCredentialIdへの同改訂Binding。新提示confirmed後だけ接続可能。旧token拒否、旧提示不明の上書き0 |
| v2形状・初回完了条件 | RFD-UT-028、RFD-IT-024 | presentationと初期／確認資格の相関を完全検査。v1・旧field・余分fieldを補完しない。parse成功だけで保存・提示・接続を証明しない |
| 利用者達成・理解 | RFD-UAT-027、RFD-UAT-007 | 追加受領ボタン不要、通常の引渡しは製品外。初回Host提示・限定接続確認・次要求の通常利用を区別し、途中を完了と誤認しない |

TTY／HTTP／Browserの提示観測、保存・資源終了、ユーザー理解を別Oracleで検証する。正式表示名「発行済み・受け渡し未確認」は製品側の提示結果未確認を示し、対象本人が未受領だったという確定には使わない。Evidenceは非秘密の分類・Identity相関・順序・結果だけとし、Bearer・生Secret・Verifier・salt・Root Path・対象外User情報を残さない。v1実在棚卸しとフロントAI移行は未実施、新Source・本番入口・正式191項目はNot Run。この設計差分の独立レビューは待機中であり、実装Readyを表示しない。

| Local Item | Canonical ID／Meaning ID | Source Model | Model Item・統合理由 |
| ---| ---| ---| ---|
| RFD-UT-023 | ARCH-000013／arch-000013.qa-000007 | Architecture Definition／Access Management詳細 | access-management.host-initialization、初回条件・四状態・純粋分岐。New: 通常管理9 Role分担行とは別判定 |
| RFD-IT-024 | REQ-000041／req-000041.qa-000007、IA-000009／ia-000009.qa-000007、SPEC-000012／spec-000012.qa-000007、ARCH-000013／arch-000013.qa-000007 | Requirement／IA Definition／Behavior Detail／Access Management詳細 | BHV-000012、初回元試行の確定読戻し・UUID・同user資格・結果。New: 既存ユーザーへの通常発行・通常管理保存とは別前提 |
| RFD-IT-025 | REQ-000041／req-000041.qa-000007、IA-000009／ia-000009.qa-000007、SPEC-000012／spec-000012.qa-000007、ARCH-000013／arch-000013.qa-000007 | Requirement／IA Definition／Behavior Detail／Access Management詳細 | BHV-000012、初回3時点Process喪失・新Process再観測・別交換引渡し。New: 初回試行は交換Recoveryではない |
| RFD-ST-026 | UI-000008／ui-000008.qa-000007、SPEC-000012／spec-000012.qa-000007、ARCH-000013／arch-000013.qa-000007 | UI Detail／Behavior Detail／Host・Workbench詳細 | SCR-000008、PRT-000008、PRT-000008.spec-000012、BHV-000012、初回公開縦断。New: 通常管理の実Workbench入口と異なる |
| RFD-UAT-027 | REQ-000041／req-000041.qa-000007、UX-000035／ux-000035.qa-000007、IA-000009／ia-000009.qa-000007、UI-000008／ui-000008.qa-000007 | Requirement／UX／IA／UI Definition・UI Detail | SCR-000008、PRT-000008、初回の達成・理解。New: 通常管理の理解とは別Scenario |

6工程の情報源表と7品質分析から初回5項目とv2 SchemaのUT028へ統合する。完全なCanonical／Meaningの母集団は情報源表のREQ-000041、UX-000035、IA-000009、UI-000008、SPEC-000012、ARCH-000013と各既存qa-000007導出キーであり、上表は主たる観測Ownerを示す。工程固有の情報・体験・表示条件も情報源表から非UTの4項目へ接続する。複数Sourceの同じ意味を重複項目化しない。MCPの初回設定・状態照会非公開は[QA-000009／EST-ST-015](../QA-000009/quality_definition.md)へSame統合し、鍵の正のEffectと公開面の負の確認を分離する。初回5項目・UT028と更新EST-ST-015はNot Run。RFD-UT-023のSource／Test候補接続を除き、具体保存・サービス側提示／初回限定接続観測・Source／Test・実環境・Evidence接続はOPEN。正式評価はNot Runで、定義接続は実行・保証成立を意味しない。

## 二Surface再編の現在認可・鍵境界

最新の[Access Management詳細](../../../06_Architecture/Details/access-management/01_Architecture.md)、[Workbench詳細](../../../06_Architecture/Details/workbench-server/01_Architecture.md)、[MCP詳細](../../../06_Architecture/Details/mcp-server/01_Architecture.md)、[Domain詳細](../../../06_Architecture/Details/domain-model/01_Architecture.md)から導出する。旧CROS詳細は比較用であり、最新契約の正本にしない。

| 検証対象 | Local Item | 責務境界 |
| --- | --- | --- |
| 通常管理の固定判定・保存・公開縦断 | RFD-UT-020、RFD-IT-021、RFD-ST-022、RFD-UAT-007 | 9 Role分担行と通常7保存操作の入力。解除は登録／Exposure両除去を同じ操作・採用改訂へ相関し、本体保持・旧実行取消非証明を別観測。内容認可・鍵操作と分離 |
| 通常発行 | RFD-IT-017 | administrator固定・通常Workbenchのみ。発行／記録不明は元Identity再観測・交換Recovery新設0。確定後提示結果未確認は確定事実を保持して明示選択へ渡す。Host通常発行なし |
| 独立失効 | RFD-IT-018 | exact資格だけ。Host独立失効なし |
| 交換4組と再入場 | RFD-ST-016 | 各交換内exactと確定後提示結果未確認からの別明示交換を分離。現在administrator認証未接続・喪失だけ既存Hostへ。Host追加認証なし・Root検証維持。確認条件を通常発行・独立失効へ拡張しない |
| 認証・現在認可 | RFD-ST-003、RFD-IT-013、RFD-ST-004 | 管理能力と内容Accessを分離し、他ユーザー情報も現在の参照権限で判定 |
| 認可済み集約 | RFD-IT-019 | RFD-ST-010の目的限定Package／Provenanceとは別のOwner接続 |
| MCP鍵操作非公開 | [EST-ST-015](../QA-000009/quality_definition.md) | 鍵管理・鍵Recovery参照／結果照会を一覧・Schema・登録・dispatch全てで非公開。要求Bearer認証は継続 |

Runtime活動ReaderもRFD-IT-013の認可済み集合を使う。未許可入力ではReader零回、Reader故障・結果不正・unknownを空成功へ変換しない。公開HTTPのHost／Origin／TLS条件と非開示はRFD-ST-004、Process全体の終了はQA-000009のEST-ST-013で別に観測する。活動の新Owner接続では、AM資格／Role／管理改訂／BindingをOrchestratorの読取り入力へ渡さず、今回許可されたProject・Repository・検証済みRootだけを搬送する。実状態・履歴Readerへ到達する前の現在認可、異Project／未許可の本文読取り0、本文待機中の失効／公開解除、次要求の再評価を確認する。旧Runtime本人確認の二重適用や任意Rootでの迂回を認可接続として扱わない。Source集合・Git改訂が変更されたCursorを旧認可範囲の探索へ使わず、先頭Pageからの明示再取得へ戻す。実Store読取り・複数Source合成の結果はQA-000004、取消join・入口間同等性はQA-000009と接続し、注入fakeだけでRFD-IT-013全体Passとしない。

### 最新契約の実行状態

通常User／Role管理4操作をRFD-IT-021の一部へ局所接続した。6 Case追加、AM全41 Case・静的3軸成功、固定13ファイルの限定独立再レビューPass・残指摘0。三Role・対象三Roleの36実保存組、UUID前容量拒否、非開示拒否、対象外不変、先行pendingと今回操作・出版後故障、認可前base／next材料保持・巨大入力の早期拒否を確認した。Repository／Exposure管理と公開縦断ST／UATは未接続で、IT021全体と191項目の正式評価はNot Run。以下35 Caseは4操作接続前の認証局所結果である。

RFD-IT-013の資格→User→現在Role投影部分をAM専用`authenticateCredential`入口へ局所接続した。既存保存ITに2 Caseを追加し、AM全35 Case・静的3軸成功、固定13ファイルの限定独立再レビューPass・残指摘0。IT024では保存済み初回資格の認証後もbyte不変・stage不変・配送／受領／通常接続非更新を確認する。IT013のExposure・実アクセス・Domain搬送と公開ST、本番Consumer、正式191項目評価はNot Run。以下の認証主体・現在Role未接続表示はこの部分接続前の履歴であり、内容認可や本番成立へ拡大しない。

RFD-ST-003、RFD-ST-004、RFD-IT-013、RFD-UAT-007、RFD-ST-016、RFD-IT-017〜019、RFD-UT-020、RFD-IT-021、RFD-ST-022は **Not Run**。旧IDのEvidenceは旧契約の履歴であり、新契約のPassへ流用しない。現在はRFD-UT-020／023／028、IT021保存部分、IT024相関・User・初回資格保存部分、IT017／018のNode crypto技術部分のSource／Test Symbolと候補局所実行を接続済み。正式191項目結果／Evidence評価はNot Run。IT017／018の保存・発行確定・失効・認証主体・現在Role・提示・本番入口、上記以外の未接続部分はOPEN。固定管理分担・内容語彙・Schemaの現在契約は各正本に従い、本番Consumer完成を推定しない。Profile管理Roleはmanager／administratorに確定したが、追加区分のSourceとMCP実HTTPは局所候補へ接続済みで、本番Launcher／Workbench搬送は未接続である。新しい権限FrameworkやBootstrap修復は導出しない。

## 4. 評価とEvidence

初回設定ではRFD-UT-023とRFD-IT-024の相関・User・初回資格保存部分のSource／Test Symbol・候補局所実行を接続済み。正式Local Item／Evidence評価はNot Run。IT024のHost提示／初回限定接続／次要求の通常認証／本番Host部分とIT025／ST026／UAT027、Root準備・旧入力本番観測・本番認証ConsumerはOPENであり、部分成功から初回全体完成を推定しない。資格→User→現在Roleの認証主体局所解決（IT013前半）とIT024の初回非更新は候補接続済み。Exposure・実アクセス・Domain搬送はOPEN。

通常管理のPassは各Local Itemが宣言した段階・Oracle・終了後条件で判定する。RFD-UT-020は純粋判定とI/Oなし、RFD-IT-021は変更前認可・同一操作／改訂の両除去保存・読戻し、RFD-ST-022は実公開入口・両除去／部分結果の表示・次要求、RFD-UAT-007は利用者理解を確認する。RFD-IT-017は元発行再観測と確定後提示結果未確認、RFD-ST-016は各交換内exactと別明示交換を確認する。正当な別操作の新資格発行は、元操作の重複発行・自動再発行0と区別する。UT／UATだけから保存成立を証明しない。結果statusだけから書込み0や資源0を推定しない。

Repository集合を対象とする項目のPassは、利用可能なRepository集合と、不在／非開示／判定不能の分類を別に観測した場合だけとする。Evidenceは絶対PathやCredentialを複製せず、検証済みIdentity、現在Role認可／Exposureの判定、拒否理由、失効を相関できる形で保持する。

初回5項目は各項目の段階・Oracle・終了後条件で判定する。下位項目の成功を初回全体完了へ流用しない。

## 追加試験種別の適用

| 種別 | 適用 | 確認する範囲 | 実行許可 | 未実行時の扱い |
| --- | --- | --- | --- | --- |
| RT | Required | 変更した意味と利用側から、再実行する既存Local Itemを選ぶ | Changeの通常検証範囲 | 未選択の範囲を明示し、選択した回帰の結果で評価する |
| PT | N/A | 現在のQuality Contractに性能成立条件がないため非該当 | N/A | 未実行をPassへ読み替えず、明示的なRelease条件でない限り通常監査を停止しない |
| LT | N/A | 現在のQuality Contractに長時間成立条件がないため非該当 | N/A | 未実行をPassへ読み替えず、明示的なRelease条件でない限り通常監査を停止しない |

## UI／SPEC Detailからの観測条件

Source Definition由来の検証義務を維持し、Detailは具体的な観測境界として同じ検証目標へ統合する。

| Detail Source | Source Definition | 追加する観測条件 | 処置 |
| --- | --- | --- | --- |
| [SCR-000006／PRT-000006](../../../04_UI/Details/Areas/project-context/SCR-000006/screen.md) | UI-000006 | 情報、操作、Feedback、状態、失敗、Unknownおよび回復をScreen／Part境界で観測する | Mapped |
| [SCR-000008／PRT-000008](../../../04_UI/Details/Areas/configuration-trust/SCR-000008/screen.md) | UI-000008 | 情報、操作、Feedback、状態、失敗、Unknownおよび回復をScreen／Part境界で観測する。両除去と部分結果、旧処理終了不明、発行・記録不明／発行済み・受け渡し未確認、別明示交換／管理者非接続時Host、遅延失効鍵の表示をScreen／Partで観測する | Mapped |
| [BHV-000010](../../../05_SPEC/Details/BHV-000010/behavior.md) | SPEC-000010 | Trigger、Authority、Validation、State、Effect、Result、FailureおよびRecoveryをBehavior境界で観測する | Mapped |
| [BHV-000031](../../../05_SPEC/Details/BHV-000031/behavior.md) | SPEC-000031 | Tree、差分選択、Stage、Commit、Push確認、Remote結果および再観測をBehavior境界で観測する | Mapped |
| [BHV-000012](../../../05_SPEC/Details/BHV-000012/behavior.md) | SPEC-000012 | Trigger、Authority、Validation、State、Effect、Result、FailureおよびRecoveryをBehavior境界で観測する。同一受付操作・採用改訂の登録／Exposure両除去、元発行Identity再観測、各交換exact／別交換、既知Effectと現在認可をBehavior境界で観測する | Mapped |

担当Interaction Relation: `PRT-000006.spec-000010`、`PRT-000006.spec-000031`、`PRT-000008.spec-000012`

全数Coverageと試験段階の扱いは[UI／SPEC DetailのQuality分析](../../Analysis/Detail/quality_analysis.md)を中央統合投影とし、本定義は上記Relationの検証責務を局所所有する。

## 保存途中再入場候補への接続 — 2026-10-11

[AM保存設計§4.3](../../../06_Architecture/Details/access-management/02_Management_State_and_API.md#43-保存途中の再入場候補--2026-10-11)の反証を既存項目へ接続する。RFD-IT-021は通常7保存操作のbase／next／unknown照合、古いpending・改訂再利用・操作相関不一致、部分材料・link／Root差、出版後読戻し／清掃／解放不明を確認する。出版済み事実と未完了を分離し、対象外不変・暗黙再Effect 0を観測する。RFD-IT-024は初回current不在＋pending存在を未初期化へ畳まないこと、currentの耐久相関読戻しがUUID／鍵Effectに先行すること、二重作成0を確認する。通常保存のpending廃棄を初回・鍵処置へ流用しない。新IDや実行結果を追加せず、190項目・Not Runを維持する。完全Schema、物理Owner、初回・鍵段階の具体処置が未確定の間は試験実装Readyや保存Gate成立を主張しない。

RFD-IT-021ではpending削除・不存在確認後から応答前のProcess喪失と、別操作による後続改訂も比較する。現在状態と元要求不明を分離し、確認済み出版の保持・自動再実行0を観測する。遅延Effectなしには旧Owner終了・排他終了の観測を必要とし、pending削除だけをOracleにしない。古いSchema適合Snapshotだけ残る電源断反例では現在read成功から鍵／認可の安全再開を推定しない。具体方式・保証範囲が未決のため、新しい電源断試験や品質項目を今回追加しない。

## 保存保証の評価範囲 — 2026-10-12

[REQ-000041の人間判断](../../../01_Discovery/Definitions/REQ-000041/requirement.md#保存保証の範囲--2026-10-12)により、電源断後の最新改訂保持と旧鍵・旧権限の再受理防止はv0.22の受入保証に含めない。上段の「保証範囲が未決」は採用前の履歴で、この判断待ちは解消した。電源断試験や新Local Itemは追加しないが、対象外を安全性Passや過去Evidenceによる代替と表示しない。

通常保存・読戻し、Process喪失、改訂競合、破損・観測不能時の拒否、通常稼働中の明示失効と現在認可のOracleは維持する。物理電源断以外の突然停止は未評価。既存190項目・Not Runと保存実装未成立は不変であり、この判断記録を試験結果にしない。

## 保存データ具体化候補への接続 — 2026-10-12

保存データの具体化候補（AM保存設計§4.4）は既存RFD-IT-021／024と鍵境界項目へ渡す。閉じたSchema、重複・孤立参照、旧KDFとの一致、salt／Verifierの公開0、Root作成後故障の既知Effect、初回相関前のUUID／鍵Effect0、失効資格整理後の旧鍵拒否、未解決参照保持を反証する。WindowsのmodeだけからACL保護を推定せず、私有Native処理の存在から本番接続を推定しない。新Local Item・試験結果は追加せず、190項目・Not Runを維持する。

## Windows固有の追加保護の評価範囲 — 2026-10-12

[REQ-000041の人間判断](../../../01_Discovery/Definitions/REQ-000041/requirement.md#windows固有の追加保護の対象外化--2026-10-12)により、AM専用Windows ACL検査・修復・Native保護接続は受入保証から外す。前節の私有Native接続確認を追加の必須試験にしない。対象外をACL安全性Passや実行Evidenceへ変換しない。任意Path・link・Root差の拒否、生Secret非保存、salt／Verifierの公開DTO・log・Evidence流出0、通常認可・破損拒否は既存義務として維持する。既存190項目・Not Runは不変更。他Packageの保護試験は対象外化しない。

## 通常発行・独立失効の保存接続の反証 — 2026-10-13

RFD-IT-017／018では、現在administrator・初回completed・期待改訂・exact対象・未解決交換0と、材料処置・容量予約前の乱数／KDF／新発行／新失効0を直接確認する。発行では既存資格の完全保持、一資格だけの追加、元発行IDと資格IDの分離、not_attempted提示状態、保存・読戻し・清掃・Lock故障時のSecret返却0と自動再発行0を照合する。短命Secret返却だけでWorkbenchの一度提示成立とはしない。

独立失効では、exact一件だけのrevoked変更、他資格・元発行ID・presentation・User／Role／登録の保持、次要求認証拒否、遅延提示通知の更新0を観測する。既失効の同request ID／同対象、同ID／別対象、別ID／同対象、失効出版後の応答喪失を反証し、追加改訂0・元要求completed推定0・現在失効保持を要求する。現在失効の認可済み読取りは成功Receiptではない。新資格・Secret・交換Recovery・履歴の追加0を照合する。これは既存Local Itemの具体化であり、試験実装・正式結果・Workbench本番接続の成立は未確認のままとする。

資格発行事実の専用読取りはRFD-IT-017／018の補助観測へ接続する。元発行IDとUserのexact相関から改訂・資格ID・User ID・元発行ID・提示状態・現在失効だけを投影し、Secret／salt／Verifier・他資格・内部Pathを含めない。現在record不在は未取得で、未発行・元要求失敗・削除を推定しない。提示三状態と失効、初回途中、現在資格失効、非管理者、別User、未知／整理済みrecordを反証する。材料を処置した要求はfact0として次のfresh要求で観測し、先行Actor降格、破損／孤立材料、読取り・清掃・Lock解放不明でも旧事実を返さない。通常管理read四kindとMCP公開面は維持し、この局所観測からWorkbench本番接続・元失効要求completed・正式Local ItemのPassを推定しない。

鍵交換の準備候補はRFD-IT-013／017の局所断面として、四経路の現在資格照合と完全Parserへ接続する。指定旧資格集合・既存発行先・必要な確認・期待改訂、非管理者・未知対象・全員発行先非administrator・表示集合差・歴史ID再利用・既存交換を反証する。初回同UserのHost指定だけと、完了後の旧資格0件のHost開始を区別する。拒否では候補相関・失効・新資格追加0、成功でもprepared候補だけで入力不変とする。実保存・各段階の故障／Process喪失・競合・提示・Host／Workbench本番Consumerは後続接続が必要で、正式Local ItemのPassへ昇格しない。

交換保存の局所接続はRFD-IT-013／017を中心に、四経路の三出版、自己／全員失効後の同要求admission、次要求の現在別管理者／Host、準備未確定Recovery nullを反証する。各段階のprepare・rename・読戻し・清掃とLock故障、容量・生成故障、拒否Actorの材料保持、stored再入場生成0／Secret0、初回新確認Bindingと旧資格0件を照合する。実Processを三出版の前後で終了し、base保持停止とnext処置後のfresh継続を区別する。同ID・別対象・全員／指定の実競合では一採用と敗者生成0を観測する。core保存成功でも未解決recordと未提示は残るため、実提示・record整理・公開Consumer・正式191項目のPassを推定しない。

## Checklist

- [x] Quality ID、検証目標およびSource固有条件を自己完結して示した
- [x] 各Local ItemをRequired Verification Obligationの局所参照と導出元へ接続した
- [x] UT／IT／ST／UATの適用または理由付きN/Aを記録した
- [x] 外部境界の直接、隣接1 block、関連2 blocks、System／E2Eおよび利用者受入を適用判定した
- [x] 正常、境界、準正常、異常および回復をLocal Itemで処置した
- [x] 各Local Itemで観測とOracleを分けた
- [x] 各Local ItemのEvidence要件を示した
- [x] 事前条件、刺激、終了後条件、cleanupおよびRecoveryを必要な範囲で示した
- [x] RT／PT／LTの適用または理由付きN/Aを記録し、PT／LTは人間の明示指定なしに実行しない
- [x] 自動化、手動確認および人間判断の境界を示した
- [x] 現行Source、TestおよびEvidenceとの照合をReality Auditへ分離した

## 鍵生成・照合の局所技術接続 — 2026-10-12

RFD-IT-017／018のNode crypto技術面を`tests/integration/credential/token-material.contract.test.ts`へ接続する。12/32/16byte生成、cros.v1の固定形式、明示scryptと旧暗黙既定の固定vector一致、不正形式時KDF／比較0、誤SecretとRuntime故障の拒否を確認する。新Local ItemやUT020／028への流用は行わない。保存・発行確定・失効・認証主体・現在Role・提示・本番入口は未接続で、正式191項目評価はNot Runを維持する。

## 初回管理者保存の局所接続 — 2026-10-12

RFD-IT-024のUser保存部分を同じstate保存ITへ接続する。canonical相関から二つの異なるUUIDで単一administratorを保存し、同元試行・別名再要求でも追加生成や名前更新を行わない。不正入力・別試行・非canonical相関はUUID件数0と出版0を直接観測する。出版前拒否で清掃済みと、部分材料／Lock解放不明で清掃未確認を分離する。

User経路固有の二Process競合、pending／replace確定とrename後の実Process喪失、出版後Lock解放失敗、同User再入場を確認する。base材料は保持停止、next材料は清掃し保存済みUserを返す。Root準備・旧入力本番観測・鍵・配送・認証・本番Host・初回全体は未成立。191項目・正式評価Not Runを維持し、過去の相関部分だけの表示は以下の履歴として扱う。

## 初回相関保存の局所接続 — 2026-10-12

本節はUser保存接続前の相関部分接続時点の履歴である。現在はUT023とIT024相関・User・初回資格保存部分までSource／Test候補接続済みで、IT024のHost提示／初回限定接続／次要求の通常認証／本番Host部分とIT025／ST026／UAT027はOPEN、正式全項目評価はNot Runを維持する。

RFD-IT-024の相関部分を既存state保存ITへ接続する。明示開始と双方未初期化の一回観測、固定Roleと空集合を持つrevision 1の排他的作成・正確byte読戻し、同元試行再入場で新規write／callback／User／鍵0を確認する。別試行、partial current、pending／replace残存、旧観測の既存・途中・不明・不正・throwは作成せず保持停止する。実子Processのwrite途中／close後readback前の喪失、二Process競合で採用一件、Lock解放不明で既知出版を保持する反証を接続する。

Root準備・User UUID生成・鍵・配送・本番Hostは未接続で、初回全体Passへ昇格しない。191項目・正式評価Not Runを維持する。旧入力の同じ排他または書込み不能は本番Consumer接続時の確認に残す。

## 通常保存Adapterの局所接続 — 2026-10-12

RFD-IT-021の保存部分を`access-management/tests/integration/state/file-store.contract.test.ts`へ接続する。新Local Itemは追加せず、191項目の正式評価はNot Runを維持する。通常認可・六操作・公開縦断までの項目全体Passではない。

反証は改訂競合時callback0、不正候補／容量超過時current不変、pending flush後・replace flush後・rename後の実子Process喪失と新入場、base一致通常材料の破棄後に新更新0、鍵由来baseの保持停止、next一致の既知出版保持、partial／孤立replace／current欠測の保持停止、rename失敗、出版後清掃失敗、主FailureとLock解放不明の分離である。子Process終了をjoinし、自己生成試験Rootの不存在を確認する。実Host・生Secret・Provider・Dockerは使用しない。

初回RFD-IT-024・鍵RFD-IT-017／018の本番保存・認可・提示は未接続のまま、通常保存の破棄規則を一般化しない。追加の短命replaceは一件の出版材料であり、履歴保存や新Recovery Storeではない。

## AM保存具体化の検証接続 — 2026-10-12

共有Profile管理の追加区分は`RFD-UT-020`へ三Roleの固定許可判定、`RFD-IT-013`の資格→既存User→現在Role断面へ現在資格・初回完了・Roleの用途限定解決、`RFD-UAT-007`へ管理表示と鍵管理の違いを接続する。manager／administratorは許可、developerは拒否、失効・初回未完了・管理状態不明ではStoreを呼ばず、観測不能をdeniedへ畳まない。Header認証後のRole変更を次のtools/listとCallへ反映し、非管理者へCatalog存在・内容・件数を開示しない。Profile内容・CRUD・改訂・結果相関はQA-000001の`RCM-IT-005`、Tool公開・実行／取消／清掃は`RCM-IT-010`、旧systemAdmin Consumerから新契約への移行閉包は`RCM-ST-012`を参照する。`RFD-IT-021`／`RFD-ST-022`は通常7 AM保存操作（User4＋Repository3）を対象にし、Profileへ流用しない。資格→現在Role断面の確認からExposure・Domain搬送や本番全体成立を推定しない。固定管理判定の母集合は9 Role分担行・11認可要求種別を目標とし、旧Sourceの10操作試験から追加区分の成立を推定しない。既存191 Local Item・正式Not Runを維持する。RFD-UT-020／RFD-IT-013の当該断面はSource候補へ、RCM-IT-005／010は実HTTPと実Catalogの反証へ接続済みであり、本番Launcher／Workbenchは未接続である。Catalog依存を構成した局所候補ではmanager／administratorが19 Tool、developerが15 Tool、Catalog未構成時は15 Toolとする。

[保存契約§4.5](../../../06_Architecture/Details/access-management/02_Management_State_and_API.md#45-現在状態容量鍵保存の固定方針--2026-10-12)を既存項目へ接続する。項目追加・実行済みへの変更は行わない。

| 既存項目 | 追加する反証・観測 |
|---|---|
| RFD-IT-021 | current 16 MiB／pending 17 MiBの境界・超過、parse前の拒否、容量超過で既存current不変、未知field・重複・孤立参照拒否、Workspaceから管理操作を暗黙付与しない、RootとRepository Identity再検証、解除でExposure同時除去・本体削除0 |
| RFD-IT-024 | 初回排他的作成とrevision 1完全baselineの全項目・3Role初期値・空集合検査、partial currentを未初期化へ戻さない、相関読戻し前のUser／資格Effect 0、User保存後に同じIDを再観測、容量不足時に鍵生成を先行しない |
| RFD-IT-017／RFD-IT-018 | 通常発行の完全Credential＋元発行ID同時出版、出版前Process喪失で永続資格0／元要求不明、出版後同ID再観測、交換対象集合先行、失効・新資格保存・提示の個別確認、秘密非保存／再表示0、未解決参照中の資格整理0、別交換から旧受領を推定しない |

全項目はNot Runを維持する。容量値は割当制限であり製品規模保証ではない。実装時に判別Union・相関不変条件・保存前後の観測を具体試験へ接続し、文書追加や安全な拒否だけから保存全体成立を表示しない。

前節までの内容権限語彙・容量・初回／鍵段階の未確定表示は候補時点の履歴で、現在方針はAM設計§4.5を使う。操作別認可は追加せず内容Workspaceだけを固定する。機械Schema・状態組合せ・公開API・物理保存／本番接続・配送観測・移行実行は未完了。Profile管理等の既存Owner判定をこの範囲から暗黙付与しない。

### 許可集合と実本文の局所搬送

同期本文Reader開始後の取消はopen／close hookで直接反証する。当該本文open1／close1、後続本文0、固定`-32603`、結果fieldなし、暗黙再実行0を期待する。開始前の`-32800`と区別し、EST-IT-014の今回接続は開始前取消だけの部分範囲とする。既存の全体検証義務は変更しない。

先行段階ではProject Context専用MCP Resolverの実HTTP試験を追加した。Header通常認証後の本文待機中にExposureを解除した場合は正常空Portfolio、資格失効の場合は固定内部エラーとし、どちらも旧許可対象の本文open 0を確認した。反復要求では毎回実本文を読み、二件目の本文欠測では全体を固定エラーへ閉じた。初回未完了はHandlerなし、開始前取消は対象読取り0、当時のTool一覧はContext二つだけであった。この段階はRFD-IT-013／019の部分接続の履歴で、現在構成は次段落とする。

現在の`createAccessMcpResolver`はContext二操作、Topic／Meeting十二操作と活動一操作に、Catalog構成時のProfile四操作を加えた局所実HTTP候補へ接続する。RFD-IT-013の部分確認では、現在Role／Exposure／失効の次要求反映、本文待機中の解除／失効からTopic保存0、非許可`-32602`、集合／Root／構成不明`-32603`、manifest Project不一致の登録／更新0、同Project許可集合だけのRelation判定を照合する。実HTTPのTool一覧は条件付き十五／十九操作で、Catalog依存を構成した局所候補ではmanager／administratorが19 Tool、developerが15 Tool、Catalog未構成時は15 Toolとする。全十二操作のRepository ID必須と未知field拒否、Context二操作と活動へIDを追加しないSchemaを確認する。活動では現在認可→実保存Reader→固定結果へ接続し、同Project全出所・実Git改訂、空認可の非開示、公開解除・失効の次要求反映を確認する。鍵は非公開、ProfileはAM現在認可による局所Source・実HTTP候補へ接続済みで、旧CROS／Shared Hostと公開Launcher／Workbenchの本番切替は未完了。正式191項目Not Run、RFD-ST-003全体未Pass、保存開始後rollback非保証を維持する。

RFD-IT-019の部分接続として、現在許可された内部集合のRoot・manifestをDomain固定本文Readerへ一回だけ渡し、manifestのProject ID・Repository ID、Reader本文版、解析Contextの4項目Sourceを既存Portfolioへ搬送する。管理改訂を本文版へ流用しない。administratorの空内容範囲は本文読取り0、本文欠測は固定unavailable・版／Contextなしを確認し、null／missingや部分Portfolioの材料にしない。本番MCP／Workbench、複数本文原子性、正式191項目は未成立である。

活動接続の追加反証では、Root Aへ既存Writerで保存した現在状態とRoot BのEI履歴を同じ実HTTP応答で観測する。両Sourceの実Git改訂、現在Owner、Project／MilestoneとTask件数、Event ID・Repository・時刻・状態・理由を照合する。Aの公開解除後はSourceと現在投影からAを除き、Bの履歴を保持する。全解除は非開示、失効は401である。旧CROS Reader境界では選択集合とのSource exact相関も確認し、入力重複・余剰SourceとEvent・不足Sourceを拒否してID非開示を確認する。順序が異なる同集合は受理する。常時absent／空履歴の限定変異がこの正対照で失敗し、Sourceを完全復元後に成功することを確認する。新保存Schema・Store・Role・回復機構は作らない。

通常Surfaceの認証入口はRFD-IT-013／024の部分接続として、初回途中の有効資格が本人確認では成功しても通常接続では固定拒否になることを確認する。未完了・未知・失効資格ではpending処置・対象Repository観測0、本人投影なしを確認する。初回completedの現在有効資格だけを同改訂の本人へ結合し、状態・清掃・Lock解放不明を成功へ畳まない。MCP Handler・HTTP本番搬送は別に確認し、この保存試験だけでSurface成立を主張しない。

### 同要求の許可集合の検証範囲 — 2026-10-12

RFD-IT-013／019の追加局所確認は、同管理改訂での全許可範囲保持、Repository一意性、各固定manifest一回観測、認証済み空集合、有効資格でも初回未完了なら固定拒否・保存材料不変・能力返却0、次要求の公開解除反映、認証・pending不成立時の対象観測0、実体・解放不明の集合非返却とする。集合の管理改訂を本文の版へ流用しない。本番Consumer・本文集約搬送・性能／lifecycle・全体ST／UAT・正式191項目はこの局所確認だけで成立としない。

### 内容実アクセス解決の局所接続 — 2026-10-12

RFD-IT-013の現在資格→Role内容範囲→Exposure→登録Binding→実Repository観測をAM専用入口へ接続した。既存保存ITに、三Roleと管理能力／内容許可分離、Context欠測、公開解除後の次要求、認可前・pending異常時の対象観測0と許可成功の正対照、Binding改ざんのSchema拒否・byte不変・材料0、manifest欠測／不正／ID差／超過・Git消失、Lock解放不明時の能力非返却を追加した。AM全54 Case・静的3軸成功、固定9ファイルの限定独立再レビューPass・残指摘0。正式191項目評価はNot Run。本番Consumerの要求限定使用・能力cache禁止・Domain搬送と全体STは未接続。技術的Root能力の型自体に失効保証があるとは扱わない。
