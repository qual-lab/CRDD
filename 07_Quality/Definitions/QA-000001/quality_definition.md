# QA-000001 リポジトリ検査と契約移行の検証定義

成果物種別: Quality定義
Quality ID: `QA-000001`
検証目標: 機械検査の責務と、契約移行後の全利用側の閉包を確認する
主な試験段階: Unit／Integration／User Acceptance
状態: Canonical
維持責任者: Qual-Lab

## 1. 情報源と網羅条件

| Source ID | Obligation Key | 導出元 | 保持する固有条件 | 試験段階 | 対応Local Item |
|---|---|---|---|---|
| [REQ-000001](../../../01_Discovery/Definitions/REQ-000001/requirement.md) | `req-000001.qa-000001` | Requirement Definition（成立条件・失敗・検証意図） | Gitが管理する対象からリンク、ID、配置等の機械判定可能な不備を再現可能に検出する。正常な階層構造やリポジトリ境界を誤って拒否せず、未確認範囲を未確認として返す。Checker成功だけでは意味レビュー、監査または準拠をPassと表示しない。既知の正常構造、リンク切れ、ID重複、gitlinkまたは境界不明を与え、結果の決定性、誤拒否、未確認表示を観測する | UT | `RCM-UT-002`、`RCM-UT-001` |
| [REQ-000005](../../../01_Discovery/Definitions/REQ-000005/requirement.md) | `req-000005.qa-000001` | Requirement Definition（成立条件・失敗・検証意図） | プロジェクト管理、実行編成、通信方式、観測、Platform境界の責任者を一意に説明できる。Project RuntimeからCoordinator実装詳細への依存をPortで反転する。各部品の公開入口以外を利用側が参照せず、単独利用時の契約を確認できる。依存Graph、公開import、package単独試験、代表利用側を確認し、内部パス参照や逆向き依存を反証する | IT | `RCM-IT-009` |
| [REQ-000014](../../../01_Discovery/Definitions/REQ-000014/requirement.md) | `req-000014.qa-000001` | Requirement Definition（成立条件・失敗・検証意図） | ツールごとに識別情報、入力、結果、外部作用（Effect）、取消、清掃条件を登録一覧から確認できる。登録済み、公開済み、Host利用可能、処理許可済みを別状態で返す。Human CLI、MCP、Coordinatorが同じ能力定義と実装を利用する。代表ツールを複数入口から実行し、不登録、非公開、Host不可、不許可、取消、清掃を観測する | IT | `RCM-IT-010` |
| [REQ-000019](../../../01_Discovery/Definitions/REQ-000019/requirement.md) | `req-000019.qa-000001` | Requirement Definition（成立条件・失敗・検証意図） | 変更した意味の作成側、利用側、派生物、公開・署名・回復・リリース経路を列挙する。各利用側が現在有効なパス、識別情報、Stateを再解釈せず利用する。旧API、旧パス語彙、宣言漏れ、実装未接続を固定候補前に検出する。利用側一件を意図的に旧境界へ残す、宣言だけ追加する、現在有効な値を再解釈する反例でChecker、契約試験、縦断試験を観測する | IT | `RCM-IT-005`、`RCM-IT-003` |
| [REQ-000034](../../../01_Discovery/Definitions/REQ-000034/requirement.md) | `req-000034.qa-000001` | Requirement Definition（成立条件・失敗・検証意図） | clone／submodule取得した固定Commitから標準入口を発見できる。同梱Manifestと実行基盤が対象Commit／配布集合へ整合する。別リリースの手動DownloadやVersion推測なしに代表ツールを起動できる。fresh clone、submodule、版不一致、欠落実行基盤、改ざんManifestを用い、発見、拒否、代表起動を観測する | IT／UAT | `RCM-IT-003`、`RCM-IT-005`、`RCM-UAT-006` |
| [UX-000001](../../../02_UX/Definitions/UX-000001/ux_definition.md) | `ux-000001.qa-000001` | UX Definition（利用者成果・重要場面・重要な失敗） | 同じ対象と条件なら機械的不備と修正箇所を先に理解し、意味レビューへ集中できる。重要場面「機械指摘と意味判断を分ける」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。結果の決定性、対象箇所、理由および意味判断との境界を確認する | UT／IT／UAT | `RCM-UT-001`、`RCM-IT-004`、`RCM-UAT-006` |
| [UX-000007](../../../02_UX/Definitions/UX-000007/ux_definition.md) | `ux-000007.qa-000001` | UX Definition（利用者成果・重要場面・重要な失敗） | 責務・契約・接続部の変更後も、維持・変更・廃止された能力を理解し、取り残しのない結果を安全に利用・公開できる。重要場面「変更を完了・公開可能と判断する直前」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。主経路だけの移行、旧契約残存および根拠のない旧処理削除を反証する | IT／UAT | `RCM-IT-004`、`RCM-IT-003`、`RCM-UAT-006` |
| [UX-000010](../../../02_UX/Definitions/UX-000010/ux_definition.md) | `ux-000010.qa-000001` | UX Definition（利用者成果・重要場面・重要な失敗） | 横断機能、Commit済み状態または特定の履歴実装を前提にせず、現在リポジトリで日常作業を開始・継続できる。重要場面「横断利用へ切り替える判断」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。CROS未設定、未Commitまたは履歴管理の接続部障害による無関係な作業停止を反証する | UT／IT／UAT | `RCM-IT-004`、`RCM-UT-001`、`RCM-UAT-006` |
| [UX-000016](../../../02_UX/Definitions/UX-000016/ux_definition.md) | `ux-000016.qa-000001` | UX Definition（利用者成果・重要場面・重要な失敗） | 現在リポジトリの固定Commitと目的に対応する標準ツール／実行基盤を見つけ、別リリースを手動照合せず安全に選べる。重要場面「発見したツール／実行基盤を起動する直前」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。fresh clone、submodule、版不一致、欠落実行基盤、改ざんManifest、未登録能力の推測表示および一覧からの決定権限発行を反証する | IT／UAT | `RCM-IT-004`、`RCM-IT-005`、`RCM-UAT-006`、`RCM-IT-010` |
| [IA-000001](../../../03_IA/Definitions/IA-000001/ia_definition.md) | `ia-000001.qa-000001` | IA Definition（情報・関係・状態・見つけ方） | 機械的不備を意味判断から分け、修正すべき場所と責任を理解する。UX-000001: 検査前／不備あり／機械確認済み。意味判断は別状態 | UT | `RCM-UT-001`、`RCM-UT-002` |
| [IA-000005](../../../03_IA/Definitions/IA-000005/ia_definition.md) | `ia-000005.qa-000001` | IA Definition（情報・関係・状態・見つけ方） | 責務移動後も何が維持・変更・廃止されたかを利用側まで理解する。UX-000007: 維持／変更／廃止／未確認 | IT | `RCM-IT-003`、`RCM-IT-005` |
| [IA-000011](../../../03_IA/Definitions/IA-000011/ia_definition.md) | `ia-000011.qa-000001` | IA Definition（情報・関係・状態・見つけ方） | Repositoryの仕事に必要な標準Toolを、版と根拠を取り違えず選ぶ。UX-000016: 利用可能（available）／利用不能（unavailable）／未確認（unverified）／停止（blocked） | IT | `RCM-UT-002`、`RCM-IT-010` |
| [UI-000001](../../../04_UI/Definitions/UI-000001/ui_definition.md) | `ui-000001.qa-000001` | UI Definition（認識・操作・Feedback・失敗表示） | 機械的な不備と意味判断を分け、直すべき場所へ進める。UX-000001: 意味レビュー前に機械判定できる不備を落とす: 機械指摘と意味判断を分ける: 同じ入力へ同じ指摘と修正可能な場所を返す: 検査範囲や理由が分からない。UX-000001／IA-000001: 検査前／不備あり／機械確認済み。意味判断は別状態: 対象→指摘→場所→所有成果物 | UT | `RCM-UT-002`、`RCM-UT-001` |
| [UI-000006](../../../04_UI/Definitions/UI-000006/ui_definition.md) | `ui-000006.qa-000001` | UI Definition（認識・操作・Feedback・失敗表示） | 普段のRepository作業を保ちながら、対象の取り違えを防げる。UX-000010: 現在リポジトリだけで日常作業を完結する: 横断利用へ切り替える判断: 手元を既定にし横断を任意に保つ: CROS未設定で手元作業まで止まる。UX-000011: プロジェクト・リポジトリ・基点フォルダを区別して対象を確認する: 外部作用（Effect）対象を確定する直前: 各識別情報と物理基点フォルダの結合を明示する: 同名や近いパスを同じ対象と誤認する。UX-000011／IA-000006: 確認済み（verified）／未確認（unverified）／曖昧（ambiguous）／利用不能（unavailable）: Project→Repository→Binding→検証済みRoot。UX-000010／IA-000007: 手元で利用可能（local available）／横断情報源を利用不能（cross-source unavailable）でも継続可能: Repository→手元の正本→作業、必要時だけCROS | UT／IT | `RCM-UT-002`、`RCM-UT-001`、`RCM-IT-003` |
| [UI-000010](../../../04_UI/Definitions/UI-000010/ui_definition.md) | `ui-000010.qa-000001` | UI Definition（認識・操作・Feedback・失敗表示） | 仕事に合うToolとAIモデルを根拠付きで選び、安全に変更できる。UX-000016: 固定Commitに対応するツール／実行基盤と利用可能性を知る: 発見したツール／実行基盤を起動する直前: Commit・配布集合・Manifest・実行基盤の対応を検証する: 版不一致・欠落実行基盤・改ざんManifestを対応版と誤認する。UX-000018: AIモデル選択を検証可能な構成として更新する: AI提供元で実行する前のモデル確定: 構成変更を検証し実効選択を観測可能にする: 未知または非対応のモデルを実行可能と表示する。UX-000016／IA-000011: 利用可能（available）／利用不能（unavailable）／未確認（unverified）／停止（blocked）: 仕事→必要能力→登録Tool→配布根拠→起動。UX-000018／IA-000013: 有効（valid）／無効（invalid）／利用可能（available）／利用不能（unavailable）／選択済み（selected）: 設定→検証→利用可能候補→選択→理由・再選定条件 | UT／IT | `RCM-IT-005`、`RCM-UT-002`、`RCM-UT-001`、`RCM-IT-010` |
| [UI-000014](../../../04_UI/Definitions/UI-000014/ui_definition.md) | `ui-000014.qa-000001` | UI Definition（認識・操作・Feedback・失敗表示） | 内部変更後も以前の能力がどこで保たれたか確認できる。UX-000007: 維持・変更・廃止された能力と利用側を確認する: 変更を完了・公開可能と判断する直前: 旧能力・全利用側・置換根拠を閉じる: 主経路だけ移行し副次利用側を取り残す。UX-000007／IA-000005: 維持／変更／廃止／未確認: 変更→能力→全利用側→置換→反証根拠 | UT／IT | `RCM-IT-004`、`RCM-UT-002` |
| [SPEC-000001](../../../05_SPEC/Definitions/SPEC-000001/spec_definition.md) | `spec-000001.qa-000001` | SPEC Definition（正常・境界・失敗・観測不能・副作用） | 正常: 同一入力では同じ検査結果を返し、機械的不備と人間の意味判断を混同しない。境界: 検査対象内／対象外、検査可能／検査不能を分け、対象外を変更しない。失敗: 入力不備、対象不明、検査不能を成功へ畳まず、変更を発生させない。観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「Repository内容を変更しない読取り検査」と矛盾する結果を返さない。失敗: 入力不備、対象不明、検査不能を成功へ畳まず、変更を発生させない。副作用: Repository内容を変更しない読取り検査。本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す | UT | `RCM-UT-001`、`RCM-UT-002` |
| [SPEC-000014](../../../05_SPEC/Definitions/SPEC-000014/spec_definition.md) | `spec-000014.qa-000001` | SPEC Definition（正常・境界・失敗・観測不能・副作用） | 正常: 未登録能力を推測せず、版不一致や欠落を明示する。境界: 登録済み／未登録能力、改訂版一致／不一致を分け、候補提示から実行Authorityを発行しない。失敗: Tool一覧の閲覧だけで実行Authorityを発行しない。観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「読取り専用で候補を返し、Toolまたは配布物を実行・変更しない」と矛盾する結果を返さない。失敗: Tool一覧の閲覧だけで実行Authorityを発行しない。副作用: 読取り専用で候補を返し、Toolまたは配布物を実行・変更しない。本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す | UT／IT | `RCM-UT-002`、`RCM-UT-001`、`RCM-IT-010` |
| [SPEC-000019](../../../05_SPEC/Definitions/SPEC-000019/spec_definition.md) | `spec-000019.qa-000001` | SPEC Definition（正常・境界・失敗・観測不能・副作用） | 正常: 宣言集合と実ソースから導いた利用側集合が一致するまで移行完了にしない。境界: 宣言Consumer／導出Consumer、移行済み／未移行を分け、未確認Consumerを閉包済みにしない。失敗: 代表経路だけのPassや旧処理の推測削除を許さない。観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「検査は読取り専用。Consumer集合不一致では旧処理削除やRelease Effectを許さない」と矛盾する結果を返さない。失敗: 代表経路だけのPassや旧処理の推測削除を許さない。副作用: 検査は読取り専用。Consumer集合不一致では旧処理削除やRelease Effectを許さない。本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す | UT／IT | `RCM-IT-004`、`RCM-UT-002`、`RCM-IT-005` |
| [ARCH-000001](../../../06_Architecture/Definitions/ARCH-000001/architecture_definition.md) | `arch-000001.qa-000001` | Architecture Definition（責務・境界・状態・故障） | 機械で確定できる不備だけをCheckerが返し、解釈を要する内容は対象と改訂版を保ったまま意味レビューへ渡す。文書の読みやすさや図の意味を、見出しの存在だけから合格としない。所有する責務: 決定論的なRepository検査、文書構造検査、意味レビューへの案内。所有しない責務: 意味の採否、独立レビュー、工程移行・Release判断。主な外部境界: Repository正本、Checker利用者、独立レビュー。SPEC-000001: 入力不備、対象不明、検査不能を成功へ畳まず、変更を発生させない。Effect: Repository内容を変更しない読取り検査。SPEC-000023: Checklistの並びを章構成へ強制せず、必要図の無言欠落を許さない。Effect: 読取り検査だけを行い、文書内容や工程状態を自動変更しない。入力SPECが固有Recoveryを定義しない場合、Architectureから追加しない。結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める | UT／IT | `RCM-UT-001`、`RCM-UT-002`、`RCM-IT-005` |
| [ARCH-000002](../../../06_Architecture/Definitions/ARCH-000002/architecture_definition.md) | `arch-000002.qa-000001` | Architecture Definition（責務・境界・状態・故障） | 変更ファイルではなく移動した意味契約から利用側集合を導出し、宣言集合と実ソース集合を比較する。CanonicalなPath・Identity・StateをConsumer側で再解釈させない。所有する責務: 責務移動時の旧Owner、新Owner、Producer、全Consumer、派生物、署名・Release経路の閉包。所有しない責務: 各Consumerの業務処理、移行完了の人間判断。主な外部境界: 変更正本、実ソース、公開入口、配布・署名経路。SPEC-000019: 代表経路だけのPassや旧処理の推測削除を許さない。Effect: 検査は読取り専用。Consumer集合不一致では旧処理削除やRelease Effectを許さない。入力SPECが固有Recoveryを定義しない場合、Architectureから追加しない。結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める | IT | `RCM-IT-005`、`RCM-IT-003`、`RCM-IT-004` |
| [ARCH-000010](../../../06_Architecture/Definitions/ARCH-000010/architecture_definition.md) | `arch-000010.qa-000001` | Architecture Definition（責務・境界・状態・故障） | Toolのavailable／unavailable／unverified／blockedと、モデル構成のvalid／invalid／selectedを分ける。コード埋込みのモデル一覧ではなく検証済み外部構成から選ぶ。所有する責務: Repositoryに適合するTool能力の発見、AIモデル構成の検証・選択理由。所有しない責務: Tool実行、Provider利用可能性の捏造、Repository Binding。主な外部境界: Repository設定、Tool Package、Provider Preflight。SPEC-000014: Tool一覧の閲覧だけで実行Authorityを発行しない。Effect: 読取り専用で候補を返し、Toolまたは配布物を実行・変更しない。SPEC-000015: 未知モデルや不正構成を暗黙fallbackせず、構成変更を実行許可にしない。Effect: 採用時だけ構成を保存する。選択はProvider実行Effectを発行しない。入力SPECが固有Recoveryを定義しない場合、Architectureから追加しない。結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める | UT／IT | `RCM-UT-002`、`RCM-UT-001`、`RCM-IT-005`、`RCM-IT-010` |
### Architecture詳細設計入力

| 詳細設計領域 | 受け取る成立条件 |
|---|---|
| [checker](../../../06_Architecture/Details/checker/01_Architecture.md) | 決定論的検査、必要図とRelationの機械確認、未確認の分離、意味判断の非所有 |
| [contract-migration](../../../06_Architecture/Details/contract-migration/01_Architecture.md) | Producer、全Consumer、派生物、署名・Release経路の閉包 |
| [crdd-domain-library](../../../06_Architecture/Details/crdd-domain-library/01_Architecture.md) | Capability別公開入口、禁止依存、Domain IssueとChecker Findingの分離、既知Consumerの閉包 |
| [version-control](../../../06_Architecture/Details/version-control/01_Architecture.md) | Repository境界、Revision、差し替え可能な履歴管理Adapter |

## 2. 情報源と網羅条件

| 情報源 | 確認する成立条件 | 検証項目 |
|---|---|---|
| [ARCH-000001](../../../06_Architecture/Definitions/ARCH-000001/architecture_definition.md) | 機械判定と意味判断の分離、同一入力への決定性 | `RCM-UT-001`、`RCM-UT-002` |
| [ARCH-000002](../../../06_Architecture/Definitions/ARCH-000002/architecture_definition.md) | 旧／新Owner、Producer、全Consumer、派生物、公開／Release／Recovery経路の閉包 | `RCM-IT-003`、`RCM-IT-004`、`RCM-IT-005` |
| [Quality Integration](../../04_Quality_Integration.md) | 全157 Canonical定義、5横断モデル、15 Canonical詳細設計領域と1 Candidate詳細設計領域から導いた検証範囲 | 全項目 |

## 3. 試験段階と外部境界の適用

| 試験段階 | 適用 | 確認する範囲 | 外部境界の到達範囲 | 判断理由 |
| --- | --- | --- | --- | --- |
| UT | Required | Checkerの決定論的判定、Path・IdentityのCanonical変換 | N/A | RepositoryやConsumerを接続する前に局所規則を反証するため |
| IT | Required | Producer、Consumer、公開・署名・Release・Recovery経路 | Related 2 Blocks | 主経路だけでなく副次Consumerの取り残しを検出するため |
| ST | Conditional | 移行後の公開Capability全体 | System/E2E | 契約移行が実利用経路を変える場合に必要 |
| UAT | Required | 固定改訂版に対応する標準Toolを利用者が選ぶ場面 | User Acceptance | 手動取得や版推測なしに対応Toolを利用できる成果を確認するため |

## 4. 共通事前条件

- 同じ固定改訂版の宣言集合と実Sourceを使う。
- 集合は同じ手書き一覧から二重生成せず、独立に導出する。
- Checkerは読取りだけで、検査対象を変更しない。

### 条件区分の適用

| 条件区分 | 適用 | 対応Local Item | 判断理由 |
|---|---|---|---|
| 正常 | Required | RCM-UT-001、RCM-IT-003、RCM-IT-015 | 通常の成立経路を独立して確認する。 |
| 境界 | Required | RCM-UAT-006、RCM-IT-008、RCM-IT-009、RCM-IT-010、RCM-ST-012、RCM-IT-013、RCM-UT-014、RCM-UT-016 | 値、Authority、情報、責務または利用者判断の境界を確認する。 |
| 準正常 | N/A | - | 継続可能な分岐または保留状態を持たない。 |
| 異常 | Required | RCM-UT-002、RCM-IT-004、RCM-IT-005、RCM-IT-007、RCM-IT-011 | 不正入力、故障または拒否経路を通常成功へ畳まない。 |
| 回復 | N/A | - | 失敗後の再入場または回復義務を持たない。 |

## 5. 検証項目

| Local ID | 条件区分 | 試験段階 | 試験種別 | 対象／境界 | 外部境界の段階 | 事前状態／入力 | 操作／刺激 | 観測 | Oracle | Evidence | 終了後条件 | 実行形態 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `RCM-UT-001` | 正常 | UT | Determinism／Checker | Checker Core。外部実行境界なし | N/A | 同一Root・Profile・対象の固定fixtureと空のRepository差分 | 同じ検査を二回実行する | RCM-UT-001として、「同じ検査を二回実行する」前後のChecker Core。外部実行境界なしについて、入力差分、判定結果、欠落・重複・不一致および理由codeを記録する | 構造化結果と順序が一致し、意味の採否は返さない | RCM-UT-001、固定入力「同一Root・Profile・対象の固定fixtureと空のRepository差分」、観測した差分と理由code、Oracle判定「構造化結果と順序が一致し、意味の採否は返さない」および終了後条件「Repository Effect 0」を保存する | Repository Effect 0 | Automated |
| `RCM-UT-002` | 異常 | UT | Boundary／Unknown | Checker Coreと入力fixture。外部実行境界なし | N/A | 読取不能、対象不明、Profile不一致、形式だけ整う各fixture | 各fixtureを検査する | RCM-UT-002として、「各fixtureを検査する」前後のChecker Coreと入力fixture。外部実行境界なしについて、入力差分、判定結果、欠落・重複・不一致および理由codeを記録する | 理由と位置を返し、未確認をPassへ丸めない | RCM-UT-002、固定入力「読取不能、対象不明、Profile不一致、形式だけ整う各fixture」、観測した差分と理由code、Oracle判定「理由と位置を返し、未確認をPassへ丸めない」および終了後条件「Repository Effect 0」を保存する | Repository Effect 0 | Automated |
| `RCM-IT-003` | 正常 | IT | Migration／Consumer Closure | Producer→Consumer→公開・署名・Release・Recovery | Related 2 Blocks | 旧Owner・新Owner、Producer、全Consumer、派生物、公開・署名・Release・Recovery経路を含む移行fixture | 責務移動後の固定fixtureを検査する | RCM-IT-003として、「責務移動後の固定fixtureを検査する」前後のProducer→Consumer→公開・署名・Release・Recoveryについて、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | 旧／新Owner、Producer、全Consumer、派生物、公開／署名／Release／Recovery経路が同じ契約へ到達 | RCM-IT-003、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「旧／新Owner、Producer、全Consumer、派生物、公開／署名／Release／Recovery経路が同じ契約へ到達」および終了後条件「旧利用経路なし」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | 旧利用経路なし | Automated |
| `RCM-IT-004` | 異常 | IT | Regression／Consumer Closure | 旧Consumer→新Contract→完成Gate | Related 2 Blocks | 一部Consumerだけ旧契約を参照する移行fixtureと成立済み旧能力 | Consumer閉包検査を実行する | RCM-IT-004として、「Consumer閉包検査を実行する」前後の旧Consumer→新Contract→完成Gateについて、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | 宣言集合と導出集合の差分を検出し、移行完了にしない | RCM-IT-004、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「宣言集合と導出集合の差分を検出し、移行完了にしない」および終了後条件「旧能力を削除しない」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | 旧能力を削除しない | Automated |
| `RCM-IT-005` | 異常 | IT | Contract／Canonical Value | Producer→Consumer | Direct Boundary | Canonical Path・Identity・Stateと、それを別基準で再解釈するConsumer fixture | Producer出力をConsumer契約試験へ渡す | RCM-IT-005として、「Producer出力をConsumer契約試験へ渡す」前後のProducer→Consumerについて、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | 利用側契約試験が意味差を理由付きで検出 | RCM-IT-005、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「利用側契約試験が意味差を理由付きで検出」および終了後条件「公開／署名／Release Effect 0」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | 公開／署名／Release Effect 0 | Automated |
| `RCM-UAT-006` | 境界 | UAT | Acceptance／Tool Discovery | 固定改訂版のRepository→標準Tool利用者 | User Acceptance | fresh clone、submodule、版不一致、欠落実行基盤、改ざんManifestを含むRepository | 利用者が別版の手動取得や版推測をせず標準入口を発見し、起動可否を判断する | RCM-UAT-006として、利用者の選択、判断理由、参照した根拠、理解できなかった項目および未判断範囲を記録する | 対応するToolと実行基盤を根拠付きで選び、不一致・欠落・改ざん時は安全に停止できる | RCM-UAT-006、固定した参加条件と入力、利用者の選択・理由・参照根拠、未判断範囲、Oracle判定「対応するToolと実行基盤を根拠付きで選び、不一致・欠落・改ざん時は安全に停止できる」および終了後条件「不一致Tool／Runtime Effect 0」を保存する | 不一致Tool／Runtime Effect 0 | Manual |
| `RCM-IT-007` | 異常 | IT | Runner／Resource Lifecycle | 開発試験runner→子Process→fixture | Adjacent 1 Block | 完了、timeout、取消、子Process終了遅延、fixture残存を個別注入できる固定試験 | 各終了経路で試験runnerを実行する | 親run Identity、開始した子Process Identity集合、要求した終了操作、実際のsignal、終了期限、期限後の残存Process集合、fixture分類と残存集合を記録する | 完了、timeout、取消を区別し、全子Processとfixtureの最終状態をIdentity単位で説明できる | RCM-IT-007、親runと子Process Identity集合、要求・実signal、期限、残存Process集合、fixture分類・残存集合、Oracle判定および終了後条件を保存する。Secret、絶対Pathおよび生出力は保存しない | 全子Processの終了を確認し、残存fixtureは未確認として報告 | Automated |
| `RCM-IT-008` | 境界 | IT | Distribution Entry／Equivalence | Repository入口・Package入口→同一Checker Core／Profile | Direct Boundary | 同じ固定fixture、同じProfile、Repository入口と配布Package入口 | 二つの公開入口から検査を実行する | 実行した入口、Core／Profile Identity、finding集合Hashと順序、終了code、Repository Effect件数を入口別に記録する | 入口が異なっても同じCoreとProfileを用い、finding集合・順序・終了codeが一致する | RCM-IT-008、固定fixture、両入口のCore／Profile Identity、finding集合Hash・順序、終了codeおよびRepository Effect件数を保存する | 子Process・一時成果物0、Repository Effect 0 | Automated |
| `RCM-IT-009` | 境界 | IT | Dependency／Package Boundary | launcher→検証済みCRDD基準版Root→実装正本→package依存Graph→Capability別公開export→代表利用側 | Related 2 Blocks | 正常なCRDD開発Rootと署名済み採用基準版Root、Project自身の`40_Develop`、別Version、Manifest欠落、配布物改変、同名Directoryだけの配置、launcher単独、link介在のfixture、許可された依存方向、正本が定めるCapability別の完全export allowlist、実Sourceのexport集合、未宣言export、内部Path import、巨大Barrel、package単独fixture、代表利用側 | launcher実Pathからexact候補Rootを一つだけ導出し、開発時はVersion Control RootとRepository Manifest、採用時は署名済みRelease Manifestと配布全体Identityを検証する。代替Pathを探索せず、両正常経路の実装解決、Graph検査、公開export集合の完全一致、公開import解決、package単独試験と代表利用側試験を実行する | launcher実Path、候補Root、実行形態、Manifest契約とIdentity、Version、Content Root、解決した実装入口、package Identity、依存edge、宣言・実export集合差分、import種別、Barrel範囲、単独試験結果、利用側結果、拒否理由を記録する | 開発経路と採用経路が各Identity検証後に同じ公開APIへ到達する。Project側、別Version、Marker／Manifest欠落、改変、類似配置、launcher単独およびlink介在は代替候補へfallbackせずEffect 0で拒否する。宣言exportと実exportが完全一致し、未宣言export・逆向き依存・deep import・巨大Barrelを拒否する | RCM-IT-009、両正常経路と全拒否fixtureのRoot解決結果、Manifest／Identity検証、fallback不在、依存Graph、宣言・実export集合と差分、Barrel範囲、package単独・利用側結果、Oracle判定を保存する | package外Effect 0、一時成果物0 | Automated |
| `RCM-IT-010` | 境界 | IT | Tool Registry／Lifecycle | Tool登録→公開→Host可用性→許可→実行・取消・清掃 | Related 2 Blocks | 登録済み／未登録、公開／非公開、Host可用／不可、許可／不許可、取消・清掃fixture | Human CLI、MCP、Coordinatorから同じTool能力を照会し、代表実行を要求する | Tool Identity、各状態軸、共有実装Identity、入口別結果、取消結果、残存資源集合を記録する | 各状態を混同せず、許可時だけ同じ実装を使い、不許可時Effect 0、取消後資源0とする | RCM-IT-010、状態軸、共有実装Identity、入口別結果、Effect・資源件数を保存する | 未許可Effect 0、取消・清掃後資源0 | Automated |
| `RCM-IT-011` | 異常 | IT | Domain Result／Adapter Contract | Domain Outcome／Issue→Checker Adapter→Checker Finding | Direct Boundary | complete、partial、invalid、unobservableのOutcome、`complete + issue`の不正組合せ、全必須Issue field、未知kind、禁止fieldを含む固定fixture | Domain結果をChecker Adapterへ渡しFindingと全体状態へ変換する | Domainのstatus、result有無、issue件数、kind、targetIdentity、location、reason、detailsと、変換後code、severity、rule、message、未検査範囲、exit codeを対で記録する | Domain必須fieldを欠落させず、`complete + issue`を不正契約として拒否し、partial／invalid／unobservableをcompleteへ昇格せず、DomainへChecker固有fieldを持ち込まない | RCM-IT-011、固定Outcome／Issue fixture、`complete + issue`拒否、変換前後field対応、未知kind拒否、禁止field不在、Oracle判定および終了後条件を保存する | Repository Effect 0、一時成果物0 | Automated |

| `RCM-ST-012` | 境界 | ST | Migration／System Closure | 変更元→全Consumer→公開・署名・Release・Recovery | System/E2E | 固定Snapshot、移行対象、宣言済みConsumer集合と旧契約反例 | 同じSnapshotで全Consumerを移行し公開入口まで実行する | Consumer集合、使用契約、公開結果、未移行対象、Snapshot Identityを記録する | 宣言集合と実観測集合が一致し、旧契約ConsumerとSnapshot混在が0である | Snapshot、Consumer集合、各入口結果、未移行件数、判定 | 旧契約利用0、未処置Consumer 0、別Snapshot混入0 | Hybrid |
| `RCM-IT-013` | 境界 | IT | Dependency Direction | CRDD Domain Libraryのimport関係 | N/A | Domain、Application、Infrastructure、CheckerのSource Graph | 禁止方向のimportを含むGraphを検査する | Package間import edgeと禁止edgeを記録する | DomainからChecker／CLIへのedgeが0である | Source Graph、禁止edge、判定 | Source変更0 | Automated |
| `RCM-UT-014` | 境界 | UT | Public Surface | Packageの公開`index.ts`と利用側import | N/A | 宣言済みexport allowlist、deep importと未宣言export反例 | 公開面と利用側importを比較する | export集合、import集合、差分を記録する | 利用側が宣言済み公開面だけを使用する | export／import集合、差分、判定 | Source変更0 | Automated |
| `RCM-IT-015` | 正常 | IT | Source Layout | Package Rootと`src`配下の責務配置 | N/A | 許可構造、Root直下Source、汎用`internal`、Owner不明配置 | Directory責務とSource配置を検査する | Directory、Source、Owner、違反理由を記録する | Sourceが責務Directoryに属し、禁止配置が0である | Directory一覧、違反Path、判定 | Source変更0 | Automated |
| `RCM-UT-016` | 境界 | UT | Domain Result | Domain Outcome／IssueとSurface Adapter | N/A | complete、partial、invalid、unobservableの固定Domain結果 | 各結果をAdapterへ渡し公開結果へ変換する | Domain結果、Adapter結果、severity／code／exitのOwnerを記録する | DomainがSurface固有値を所有せず全Domain状態が欠落なく変換される | 入出力、Owner、変換結果、判定 | Source変更0 | Automated |

## 6. 評価と根拠

Passは、集合の完全一致、全Consumerごとの契約試験、旧契約の不在検査およびEffect 0を同じ固定改訂版で確認した場合だけとする。Evidenceは対象改訂版、導出方法、集合Hash、差分、Local IDごとの結果と未確認範囲を保持する。

## 7. 自動化と実装の対応

自動化対応はCanonicalな本定義を固定した後、現行Checker試験と契約移行の利用側試験をReality Auditで照合する。試験ファイルの存在だけでImplementedとしない。

## 追加試験種別の適用

| 種別 | 適用 | 確認する範囲 | 実行許可 | 未実行時の扱い |
|---|---|---|---|---|
| RT | Required | 変更した意味と利用側から、再実行する既存Local Itemを選ぶ | Changeの通常検証範囲 | 未選択の範囲を明示し、選択した回帰の結果で評価する |
| PT | N/A | 現在のQuality Contractに性能成立条件がないため非該当 | N/A | 未実行をPassへ読み替えず、明示的なRelease条件でない限り通常監査を停止しない |
| LT | N/A | 現在のQuality Contractに長時間成立条件がないため非該当 | N/A | 未実行をPassへ読み替えず、明示的なRelease条件でない限り通常監査を停止しない |

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
