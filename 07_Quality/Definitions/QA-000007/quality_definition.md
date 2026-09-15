# QA-000007 リポジトリ境界とFederationの検証定義

成果物種別: Quality定義
Quality ID: `QA-000007`
検証目標: Repository Root、Repository ID、Project ID、Binding、Session Grant、WorkspaceおよびRepository Exposureを別々の識別と利用範囲で解決すること
主な試験段階: Unit／Integration／System
状態: Canonical
維持責任者: Qual-Lab

## 1. 情報源と網羅条件

| Source ID | 保持する固有条件 | 試験段階 | 対応Local Item |
|---|---|---|---|
| [REQ-000009](../../../01_Discovery/Definitions/REQ-000009/requirement.md) | 一プロジェクト一リポジトリと一プロジェクト複数リポジトリを同じ識別情報規則で表せる。リポジトリ名や配置ではなく検証済みBindingからプロジェクト所属と基点フォルダを解決する。同じProject IDでもリポジトリごとの責務とアクセス境界を保持する。単一、複数、移動後基点フォルダ、偽装パス、重複識別情報を与え、Binding解決と拒否を観測する | UT／IT／ST | `RFD-01`、`RFD-04`、`RFD-06` |
| [REQ-000011](../../../01_Discovery/Definitions/REQ-000011/requirement.md) | 接続認証、接続単位 作業領域 Grant、リポジトリ Exposure、実アクセスを段階別に検証する。許可範囲だけを返し、非開示リポジトリの存在、名前、件数を漏らさない。一部だけ読めるプロジェクトを完全状態へ畳まず利用可能な範囲を返す。認証失敗、作業領域範囲外、Exposureなし、アクセス不能、部分可視を与え、各境界の拒否と情報非開示を観測する | ST | `RFD-04`、`RFD-03` |
| [REQ-000017](../../../01_Discovery/Definitions/REQ-000017/requirement.md) | 情報要素ごとに情報源、改訂版、利用範囲を保持する。許可されない、取得不能、競合する情報を推測で補完しない。Packageはタスク目的に必要な最小範囲で、中央の永続正本にならない。単一プロジェクト、複数リポジトリ、複数プロジェクト、部分アクセス、競合を与え、Package内容と欠測、根拠到達を観測する | ST | `RFD-03`、`RFD-04` |
| [REQ-000020](../../../01_Discovery/Definitions/REQ-000020/requirement.md) | 一リポジトリと複数リポジトリのプロジェクトを同じ結果契約で投影する。読めないリポジトリを不存在または正常と扱わず、開示可能な不足だけを示す。同一責務の複数情報源は探索順で選ばずConflictとして返す。完全、部分アクセス、欠測、重複責務、競合改訂版を組み合わせ、投影と非開示を観測する | IT／ST | `RFD-04`、`RFD-05` |
| [REQ-000028](../../../01_Discovery/Definitions/REQ-000028/requirement.md) | 各AI入口が同じ共通規範と対象正本へ到達できる。AI固有制約を保持しつつ共通判断を入口で再定義しない。同じ変更で入口ごとの行動差がある場合に理由を追跡できる。複数AI入口から同じ代表作業を開始し、読んだ正本、適用規則、権限境界、差分理由を比較する | IT／ST | `RFD-04`、`RFD-01` |
| [UX-000011](../../../02_UX/Definitions/UX-000011/ux_definition.md) | 論理プロジェクトを一つに見ながら、参照・実行・回復の対象リポジトリと基点フォルダを取り違えずに選べる。重要場面「外部作用（Effect）対象を確定する直前」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。名前やパスの類似だけから対象識別情報を推定する操作を反証する | IT／ST | `RFD-04`、`RFD-01` |
| [UX-000013](../../../02_UX/Definitions/UX-000013/ux_definition.md) | 接続元や接続資格情報が変わっても、現在許可された作業領域だけを利用し、利用不能理由と管理能力を内容閲覧から区別できる。重要場面「利用可能情報を表示する時」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。存在漏えい、一律の追加許可による解錠、古い利用許可範囲および管理能力からの閲覧権限推定を反証する | ST | `RFD-04`、`RFD-03` |
| [IA-000006](../../../03_IA/Definitions/IA-000006/ia_definition.md) | 論理Projectを一つに見ながら、情報源、物理Root、不完全性を取り違えず現在地を判断する。UX-000009: complete／partial／開示制限（restricted）／stale／競合あり（conflicting）／不明（unknown）。UX-000011: 確認済み（verified）／未確認（unverified）／曖昧（ambiguous）／利用不能（unavailable）。UX-000015: complete／partial／開示制限（restricted）／stale／競合あり（conflicting） | IT／ST | `RFD-02`、`RFD-01`、`RFD-03` |
| [IA-000007](../../../03_IA/Definitions/IA-000007/ia_definition.md) | 一つのRepositoryで日常作業を完了し、必要な時だけ横断情報へ進む。UX-000010: 手元で利用可能（local available）／横断情報源を利用不能（cross-source unavailable）でも継続可能 | ST | `RFD-03`、`RFD-04` |
| [IA-000009](../../../03_IA/Definitions/IA-000009/ia_definition.md) | 現在の接続で許可された作業領域とRepositoryだけを利用し、管理能力と内容閲覧を混同しない。UX-000013: 利用可能（available）／接続資格が必要（credential_required）／開示制限（restricted）／利用不能（unavailable）／不明（unknown） | ST | `RFD-03`、`RFD-04` |
| [UI-000006](../../../04_UI/Definitions/UI-000006/ui_definition.md) | 普段のRepository作業を保ちながら、対象の取り違えを防げる。UX-000010: 現在リポジトリだけで日常作業を完結する: 横断利用へ切り替える判断: 手元を既定にし横断を任意に保つ: CROS未設定で手元作業まで止まる。UX-000011: プロジェクト・リポジトリ・基点フォルダを区別して対象を確認する: 外部作用（Effect）対象を確定する直前: 各識別情報と物理基点フォルダの結合を明示する: 同名や近いパスを同じ対象と誤認する。UX-000011／IA-000006: 確認済み（verified）／未確認（unverified）／曖昧（ambiguous）／利用不能（unavailable）: Project→Repository→Binding→検証済みRoot。UX-000010／IA-000007: 手元で利用可能（local available）／横断情報源を利用不能（cross-source unavailable）でも継続可能: Repository→手元の正本→作業、必要時だけCROS | IT／ST | `RFD-01`、`RFD-04`、`RFD-03` |
| [UI-000008](../../../04_UI/Definitions/UI-000008/ui_definition.md) | 接続資格で許可されたWorkspaceだけを利用できる。UX-000013: 許可された作業領域だけへ接続する: 利用可能情報を表示する時: 現在の利用許可範囲（Grant）だけを開示し不足を補完しない: 利用不能なリポジトリの存在や内容を推測表示する。UX-000013／IA-000009: 利用可能（available）／接続資格が必要（credential_required）／開示制限（restricted）／利用不能（unavailable）／不明（unknown）: 接続→接続単位→許可された作業領域→公開されたリポジトリ→情報源 | IT／ST | `RFD-03`、`RFD-04`、`RFD-02` |
| [SPEC-000010](../../../05_SPEC/Definitions/SPEC-000010/spec_definition.md) | 正常: 横断機能やCommit済み状態がなくてもRepository-local作業を開始できる。境界: 検証済みRoot／隣接Root、Binding一意／曖昧を分け、別Repositoryを選ばない。失敗: 名前やPath類似から別Repositoryを選ばず、曖昧時はEffect 0で停止する。観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「対象解決は読取り専用で、Repository・worktree・Git状態を変更しない」と矛盾する結果を返さない。失敗: 名前やPath類似から別Repositoryを選ばず、曖昧時はEffect 0で停止する。副作用: 対象解決は読取り専用で、Repository・worktree・Git状態を変更しない。本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す | IT／ST | `RFD-01`、`RFD-04`、`RFD-02` |
| [SPEC-000012](../../../05_SPEC/Definitions/SPEC-000012/spec_definition.md) | 正常: System管理能力と内容閲覧権限を別に判定する。境界: 有効／期限切れCredential、Exposureあり／なしを分け、非開示対象の存在を返さない。失敗: 未許可対象の存在を漏らさず、古いGrantや一律Unlockを受理しない。観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「認証済みSessionとGrantを作成・更新する。未Exposure Repositoryへ読取りEffect 0」と矛盾する結果を返さない。失敗: 未許可対象の存在を漏らさず、古いGrantや一律Unlockを受理しない。副作用: 認証済みSessionとGrantを作成・更新する。未Exposure Repositoryへ読取りEffect 0。本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す | IT／ST | `RFD-03`、`RFD-04`、`RFD-02` |
| [ARCH-000009](../../../06_Architecture/Definitions/ARCH-000009/architecture_definition.md) | verified／unverified／ambiguous／unavailableを分け、local／cross-sourceの対象範囲を明示する。GitはAdapterの一実装であり、未Commitを理由に通常利用を拒否しない。所有する責務: 開始PathからのRepository Root検証、Repository／Project Identity、実行対象Binding。所有しない責務: Git commitを成立条件にすること、Tool選択、Runtime Data清掃。主な外部境界: Version Control、Filesystem、Repository Manifest。SPEC-000010: 名前やPath類似から別Repositoryを選ばず、曖昧時はEffect 0で停止する。Effect: 対象解決は読取り専用で、Repository・worktree・Git状態を変更しない。入力SPECが固有Recoveryを定義しない場合、Architectureから追加しない。結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める | IT／ST | `RFD-01`、`RFD-04`、`RFD-02` |
| [ARCH-000013](../../../06_Architecture/Definitions/ARCH-000013/architecture_definition.md) | credential_required／restricted／unavailable／unknownを区別し、Credential→Session→Workspace Grant→Exposure→Repositoryの順で利用範囲を決める。所有する責務: CredentialからのSession Grant、Workspace、Repository Exposure、Source-aware Federation。所有しない責務: User Role階層、Repository内部ACL、System AdminからContent Accessの推定。主な外部境界: Remote Client、Credential Store、複数Repository。SPEC-000012: 未許可対象の存在を漏らさず、古いGrantや一律Unlockを受理しない。Effect: 認証済みSessionとGrantを作成・更新する。未Exposure Repositoryへ読取りEffect 0。入力SPECが固有Recoveryを定義しない場合、Architectureから追加しない。結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める | IT／ST | `RFD-04`、`RFD-03`、`RFD-01` |
### Architecture詳細設計入力

| 詳細設計領域 | 受け取る成立条件 |
|---|---|
| [cros](../../../06_Architecture/Details/cros/01_Architecture.md) | Repository横断解決、Grant、投影、外部接続、候補処置 |
| [mcp](../../../06_Architecture/Details/mcp/01_Architecture.md) | Transport変換、公開Schema、Session、結果搬送 |
| [runtime-data](../../../06_Architecture/Details/runtime-data/01_Architecture.md) | Repository-local／OS管理Root、用途、保持、清掃、回復 |
| [version-control](../../../06_Architecture/Details/version-control/01_Architecture.md) | Repository境界、Revision、差し替え可能な履歴管理Adapter |

## 2. 試験段階と外部境界の適用

| 試験段階 | 適用 | 確認する範囲 | 外部境界の到達範囲 | 判断理由 |
| --- | --- | --- | --- | --- |
| UT | Required | Identity、Binding、Grant、Exposureの判定規則 | N/A | FilesystemやSession接続前に区別を反証するため |
| IT | Required | Version Control Adapter、Repository Root、Session、Workspace境界 | Related 2 Blocks | Root解決と権限伝播を段階的に確認するため |
| ST | Required | Credentialから複数Repository投影まで | System/E2E | Federation全体で非開示と正しい解決を確認するため |
| UAT | Conditional | 利用者が利用可能・利用不能なProject範囲を理解する場面 | User Acceptance | Workbench／MCP体験を評価する場合に必要 |

## 3. 検証項目

| Local ID | 分類 | 試験段階 | 試験種別 | 対象／境界 | 外部境界の段階 | 事前状態／入力 | 操作／刺激 | 観測と期待結果 | 終了後条件 | 実行形態 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `RFD-01` | 正常 | IT | Repository／Identity | 開始Path→Version Control Adapter→Repository Manifest | Adjacent 1 Block | 通常Root、入れ子worktree、submodule、検証済みmanifestの各fixture | 各開始PathからRepositoryを解決する | 開始Pathから最寄りの有効Rootを検証し、Repository／Project／Bindingを区別 | 対象外RootへEffect 0 | Automated |
| `RFD-02` | 異常 | IT | Filesystem／Security | Path Observer→Version Control Adapter→Effect Gate | Related 2 Blocks | fake .git、reparse・link、不正中間Root、manifest不一致の各fixture | 各PathからRepository解決とEffectを要求する | Rootを推定せず理由と判定不能を返す | Filesystem／Git Effect 0 | Automated |
| `RFD-03` | 正常 | ST | Authentication／Session | Credential→Session Grant→Workspace→Repository | System/E2E | Workspace集合を持つCredentialと、WorkspaceへExposure済みのRepository | 認証してSessionを開始し切断する | 認証後にSession Grantを発行し、許可されたRepositoryだけ解決 | 切断後にSession Grant失効 | Automated |
| `RFD-04` | 情報境界 | ST | Authorization／Non-disclosure | Session→Workspace→Exposure→Repository Projection | System/E2E | Grant外Workspace、古いExposure、管理Capabilityだけを持つSession | 対象Repositoryの解決と内容取得を要求する | Repositoryの名前・Path・存在を漏らさず拒否。管理権限をContent Accessにしない | 対象Repository Effect 0 | Automated |
| `RFD-05` | 差替性 | IT | Adapter／Compatibility | Project Runtime Port→Version Control Adapter | Direct Boundary | Commit済み・未Commitの同値Treeと、同じPortを実装するVersion Control Adapter | 両状態・両Adapterで同じRepository操作を実行する | Commit SHAだけに依存せず、Port契約の必要情報で成立 | Git固有機能をCoreへ漏らさない | Automated |
| `RFD-06` | 境界 | UT | Identity／Policy | Project・Repository・Binding・Grant・Exposureの判定規則 | N/A | 単一・複数Repository、重複Identity、範囲外Grant、未Exposureの各入力 | 対象Projectと利用可能Repository集合を判定する | Identityを混同せず、許可外対象を結果集合へ含めない | Filesystem・Session・Repository Effect 0 | Automated |

## 4. 評価とEvidence

Passは、利用可能なRepository集合と、不在／非開示／判定不能の分類を別に観測した場合だけとする。Evidenceは絶対PathやCredentialを複製せず、検証済みIdentity、Grant／Exposureの判定、拒否理由、失効を相関できる形で保持する。

## 追加試験種別の適用

| 種別 | 適用 | 確認する範囲 | 実行許可 | 未実行時の扱い |
|---|---|---|---|---|
| RT | Required | 変更した意味と利用側から、再実行する既存Local Itemを選ぶ | Changeの通常検証範囲 | 未選択の範囲を明示し、選択した回帰の結果で評価する |
| PT | N/A | 現在のQuality Contractに性能成立条件がないため非該当 | N/A | 未実行をPassへ読み替えず、明示的なRelease条件でない限り通常監査を停止しない |
| LT | N/A | 現在のQuality Contractに長時間成立条件がないため非該当 | N/A | 未実行をPassへ読み替えず、明示的なRelease条件でない限り通常監査を停止しない |
