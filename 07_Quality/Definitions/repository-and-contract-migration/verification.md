# リポジトリ検査と契約移行の検証定義

成果物種別: Quality定義
検証目標: 機械検査の責務と、契約移行後の全利用側の閉包を確認する
主な試験段階: Integration
状態: Canonical
維持責任者: Qual-Lab

## 1. 情報源と網羅条件

| Source ID | 保持する固有条件 | 対応Local Item |
|---|---|---|
| [REQ-000001](../../../01_Discovery/Definitions/REQ-000001/requirement.md) | Gitが管理する対象からリンク、ID、配置等の機械判定可能な不備を再現可能に検出する。正常な階層構造やリポジトリ境界を誤って拒否せず、未確認範囲を未確認として返す。Checker成功だけでは意味レビュー、監査または準拠をPassと表示しない。既知の正常構造、リンク切れ、ID重複、gitlinkまたは境界不明を与え、結果の決定性、誤拒否、未確認表示を観測する | `RCM-02`、`RCM-01` |
| [REQ-000005](../../../01_Discovery/Definitions/REQ-000005/requirement.md) | プロジェクト管理、実行編成、通信方式、観測、Platform境界の責任者を一意に説明できる。Project RuntimeからCoordinator実装詳細への依存をPortで反転する。各部品の公開入口以外を利用側が参照せず、単独利用時の契約を確認できる。依存Graph、公開import、package単独試験、代表利用側を確認し、内部パス参照や逆向き依存を反証する | `RCM-05`、`RCM-01` |
| [REQ-000008](../../../01_Discovery/Definitions/REQ-000008/requirement.md) | リポジトリ取得後、別Serverなしで標準ツールとAI作業を開始できる。CROS停止中もリポジトリ内で完結する更新と検証を完了できる。横断入口と手元入口で同じ操作の意味が変わらない。CROS未設定、停止、利用可能の各状態でリポジトリ内代表作業を実行し、依存と結果差を観測する | `RCM-01`、`RCM-03` |
| [REQ-000014](../../../01_Discovery/Definitions/REQ-000014/requirement.md) | ツールごとに識別情報、入力、結果、外部作用（Effect）、取消、清掃条件を登録一覧から確認できる。登録済み、公開済み、Host利用可能、処理許可済みを別状態で返す。Human CLI、MCP、Coordinatorが同じ能力定義と実装を利用する。代表ツールを複数入口から実行し、不登録、非公開、Host不可、不許可、取消、清掃を観測する | `RCM-05`、`RCM-01` |
| [REQ-000019](../../../01_Discovery/Definitions/REQ-000019/requirement.md) | 変更した意味の作成側、利用側、派生物、公開・署名・回復・リリース経路を列挙する。各利用側が現在有効なパス、識別情報、Stateを再解釈せず利用する。旧API、旧パス語彙、宣言漏れ、実装未接続を固定候補前に検出する。利用側一件を意図的に旧境界へ残す、宣言だけ追加する、現在有効な値を再解釈する反例でChecker、契約試験、縦断試験を観測する | `RCM-05`、`RCM-03` |
| [REQ-000034](../../../01_Discovery/Definitions/REQ-000034/requirement.md) | clone／submodule取得した固定Commitから標準入口を発見できる。同梱Manifestと実行基盤が対象Commit／配布集合へ整合する。別リリースの手動DownloadやVersion推測なしに代表ツールを起動できる。fresh clone、submodule、版不一致、欠落実行基盤、改ざんManifestを用い、発見、拒否、代表起動を観測する | `RCM-03`、`RCM-05` |
| [REQ-000036](../../../01_Discovery/Definitions/REQ-000036/requirement.md) | 本番ツールのGit利用箇所が履歴管理 Port経由になっている。通常の読取り、編集、Communication操作が未Commit状態でも成立する。CommitやTreeが必要なリリース／根拠境界だけ明示的に改訂版を要求する。未Commit、別Branch、Git 接続部置換、リポジトリ境界不明、リリース固定改訂版を用い、各機能と拒否を観測する | `RCM-05`、`RCM-02` |
| [UX-000001](../../../02_UX/Definitions/UX-000001/ux_definition.md) | 同じ対象と条件なら機械的不備と修正箇所を先に理解し、意味レビューへ集中できる。重要場面「機械指摘と意味判断を分ける」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。結果の決定性、対象箇所、理由および意味判断との境界を確認する | `RCM-01`、`RCM-04` |
| [UX-000007](../../../02_UX/Definitions/UX-000007/ux_definition.md) | 責務・契約・接続部の変更後も、維持・変更・廃止された能力を理解し、取り残しのない結果を安全に利用・公開できる。重要場面「変更を完了・公開可能と判断する直前」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。主経路だけの移行、旧契約残存および根拠のない旧処理削除を反証する | `RCM-04`、`RCM-03` |
| [UX-000010](../../../02_UX/Definitions/UX-000010/ux_definition.md) | 横断機能、Commit済み状態または特定の履歴実装を前提にせず、現在リポジトリで日常作業を開始・継続できる。重要場面「横断利用へ切り替える判断」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。CROS未設定、未Commitまたは履歴管理の接続部障害による無関係な作業停止を反証する | `RCM-04`、`RCM-01` |
| [UX-000016](../../../02_UX/Definitions/UX-000016/ux_definition.md) | 現在リポジトリの固定Commitと目的に対応する標準ツール／実行基盤を見つけ、別リリースを手動照合せず安全に選べる。重要場面「発見したツール／実行基盤を起動する直前」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。fresh clone、submodule、版不一致、欠落実行基盤、改ざんManifest、未登録能力の推測表示および一覧からの決定権限発行を反証する | `RCM-04`、`RCM-05` |
| [IA-000001](../../../03_IA/Definitions/IA-000001/ia_definition.md) | 機械的不備を意味判断から分け、修正すべき場所と責任を理解する。UX-000001: 検査前／不備あり／機械確認済み。意味判断は別状態 | `RCM-01`、`RCM-02` |
| [IA-000005](../../../03_IA/Definitions/IA-000005/ia_definition.md) | 責務移動後も何が維持・変更・廃止されたかを利用側まで理解する。UX-000007: 維持／変更／廃止／未確認 | `RCM-03`、`RCM-05` |
| [IA-000011](../../../03_IA/Definitions/IA-000011/ia_definition.md) | Repositoryの仕事に必要な標準Toolを、版と根拠を取り違えず選ぶ。UX-000016: 利用可能（available）／利用不能（unavailable）／未確認（unverified）／停止（blocked） | `RCM-02`、`RCM-01` |
| [UI-000001](../../../04_UI/Definitions/UI-000001/ui_definition.md) | 機械的な不備と意味判断を分け、直すべき場所へ進める。UX-000001: 意味レビュー前に機械判定できる不備を落とす: 機械指摘と意味判断を分ける: 同じ入力へ同じ指摘と修正可能な場所を返す: 検査範囲や理由が分からない。UX-000001／IA-000001: 検査前／不備あり／機械確認済み。意味判断は別状態: 対象→指摘→場所→所有成果物 | `RCM-02`、`RCM-01` |
| [UI-000006](../../../04_UI/Definitions/UI-000006/ui_definition.md) | 普段のRepository作業を保ちながら、対象の取り違えを防げる。UX-000010: 現在リポジトリだけで日常作業を完結する: 横断利用へ切り替える判断: 手元を既定にし横断を任意に保つ: CROS未設定で手元作業まで止まる。UX-000011: プロジェクト・リポジトリ・基点フォルダを区別して対象を確認する: 外部作用（Effect）対象を確定する直前: 各識別情報と物理基点フォルダの結合を明示する: 同名や近いパスを同じ対象と誤認する。UX-000011／IA-000006: 確認済み（verified）／未確認（unverified）／曖昧（ambiguous）／利用不能（unavailable）: Project→Repository→Binding→検証済みRoot。UX-000010／IA-000007: 手元で利用可能（local available）／横断情報源を利用不能（cross-source unavailable）でも継続可能: Repository→手元の正本→作業、必要時だけCROS | `RCM-02`、`RCM-01`、`RCM-03` |
| [UI-000010](../../../04_UI/Definitions/UI-000010/ui_definition.md) | 仕事に合うToolとAIモデルを根拠付きで選び、安全に変更できる。UX-000016: 固定Commitに対応するツール／実行基盤と利用可能性を知る: 発見したツール／実行基盤を起動する直前: Commit・配布集合・Manifest・実行基盤の対応を検証する: 版不一致・欠落実行基盤・改ざんManifestを対応版と誤認する。UX-000018: AIモデル選択を検証可能な構成として更新する: AI提供元で実行する前のモデル確定: 構成変更を検証し実効選択を観測可能にする: 未知または非対応のモデルを実行可能と表示する。UX-000016／IA-000011: 利用可能（available）／利用不能（unavailable）／未確認（unverified）／停止（blocked）: 仕事→必要能力→登録Tool→配布根拠→起動。UX-000018／IA-000013: 有効（valid）／無効（invalid）／利用可能（available）／利用不能（unavailable）／選択済み（selected）: 設定→検証→利用可能候補→選択→理由・再選定条件 | `RCM-05`、`RCM-02`、`RCM-01` |
| [UI-000014](../../../04_UI/Definitions/UI-000014/ui_definition.md) | 内部変更後も以前の能力がどこで保たれたか確認できる。UX-000007: 維持・変更・廃止された能力と利用側を確認する: 変更を完了・公開可能と判断する直前: 旧能力・全利用側・置換根拠を閉じる: 主経路だけ移行し副次利用側を取り残す。UX-000007／IA-000005: 維持／変更／廃止／未確認: 変更→能力→全利用側→置換→反証根拠 | `RCM-04`、`RCM-02` |
| [SPEC-000001](../../../05_SPEC/Definitions/SPEC-000001/spec_definition.md) | 正常: 同一入力では同じ検査結果を返し、機械的不備と人間の意味判断を混同しない。境界: 検査対象内／対象外、検査可能／検査不能を分け、対象外を変更しない。失敗: 入力不備、対象不明、検査不能を成功へ畳まず、変更を発生させない。観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「Repository内容を変更しない読取り検査」と矛盾する結果を返さない。失敗: 入力不備、対象不明、検査不能を成功へ畳まず、変更を発生させない。副作用: Repository内容を変更しない読取り検査。本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す | `RCM-01`、`RCM-02` |
| [SPEC-000014](../../../05_SPEC/Definitions/SPEC-000014/spec_definition.md) | 正常: 未登録能力を推測せず、版不一致や欠落を明示する。境界: 登録済み／未登録能力、改訂版一致／不一致を分け、候補提示から実行Authorityを発行しない。失敗: Tool一覧の閲覧だけで実行Authorityを発行しない。観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「読取り専用で候補を返し、Toolまたは配布物を実行・変更しない」と矛盾する結果を返さない。失敗: Tool一覧の閲覧だけで実行Authorityを発行しない。副作用: 読取り専用で候補を返し、Toolまたは配布物を実行・変更しない。本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す | `RCM-02`、`RCM-01` |
| [SPEC-000019](../../../05_SPEC/Definitions/SPEC-000019/spec_definition.md) | 正常: 宣言集合と実ソースから導いた利用側集合が一致するまで移行完了にしない。境界: 宣言Consumer／導出Consumer、移行済み／未移行を分け、未確認Consumerを閉包済みにしない。失敗: 代表経路だけのPassや旧処理の推測削除を許さない。観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「検査は読取り専用。Consumer集合不一致では旧処理削除やRelease Effectを許さない」と矛盾する結果を返さない。失敗: 代表経路だけのPassや旧処理の推測削除を許さない。副作用: 検査は読取り専用。Consumer集合不一致では旧処理削除やRelease Effectを許さない。本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す | `RCM-04`、`RCM-02`、`RCM-05` |
| [ARCH-000001](../../../06_Architecture/Definitions/ARCH-000001/architecture_definition.md) | 機械で確定できる不備だけをCheckerが返し、解釈を要する内容は対象と改訂版を保ったまま意味レビューへ渡す。文書の読みやすさや図の意味を、見出しの存在だけから合格としない。所有する責務: 決定論的なRepository検査、文書構造検査、意味レビューへの案内。所有しない責務: 意味の採否、独立レビュー、工程移行・Release判断。主な外部境界: Repository正本、Checker利用者、独立レビュー。SPEC-000001: 入力不備、対象不明、検査不能を成功へ畳まず、変更を発生させない。Effect: Repository内容を変更しない読取り検査。SPEC-000023: Checklistの並びを章構成へ強制せず、必要図の無言欠落を許さない。Effect: 読取り検査だけを行い、文書内容や工程状態を自動変更しない。入力SPECが固有Recoveryを定義しない場合、Architectureから追加しない。結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める | `RCM-01`、`RCM-02`、`RCM-05` |
| [ARCH-000002](../../../06_Architecture/Definitions/ARCH-000002/architecture_definition.md) | 変更ファイルではなく移動した意味契約から利用側集合を導出し、宣言集合と実ソース集合を比較する。CanonicalなPath・Identity・StateをConsumer側で再解釈させない。所有する責務: 責務移動時の旧Owner、新Owner、Producer、全Consumer、派生物、署名・Release経路の閉包。所有しない責務: 各Consumerの業務処理、移行完了の人間判断。主な外部境界: 変更正本、実ソース、公開入口、配布・署名経路。SPEC-000019: 代表経路だけのPassや旧処理の推測削除を許さない。Effect: 検査は読取り専用。Consumer集合不一致では旧処理削除やRelease Effectを許さない。入力SPECが固有Recoveryを定義しない場合、Architectureから追加しない。結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める | `RCM-05`、`RCM-03`、`RCM-04` |
| [ARCH-000010](../../../06_Architecture/Definitions/ARCH-000010/architecture_definition.md) | Toolのavailable／unavailable／unverified／blockedと、モデル構成のvalid／invalid／selectedを分ける。コード埋込みのモデル一覧ではなく検証済み外部構成から選ぶ。所有する責務: Repositoryに適合するTool能力の発見、AIモデル構成の検証・選択理由。所有しない責務: Tool実行、Provider利用可能性の捏造、Repository Binding。主な外部境界: Repository設定、Tool Package、Provider Preflight。SPEC-000014: Tool一覧の閲覧だけで実行Authorityを発行しない。Effect: 読取り専用で候補を返し、Toolまたは配布物を実行・変更しない。SPEC-000015: 未知モデルや不正構成を暗黙fallbackせず、構成変更を実行許可にしない。Effect: 採用時だけ構成を保存する。選択はProvider実行Effectを発行しない。入力SPECが固有Recoveryを定義しない場合、Architectureから追加しない。結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める | `RCM-02`、`RCM-01`、`RCM-05` |
### Architecture詳細設計入力

| 詳細設計領域 | 受け取る成立条件 |
|---|---|
| [checker](../../../06_Architecture/Details/checker/01_Architecture.md) | 決定論的検査、必要図とRelationの機械確認、未確認の分離、意味判断の非所有 |
| [contract-migration](../../../06_Architecture/Details/contract-migration/01_Architecture.md) | Producer、全Consumer、派生物、署名・Release経路の閉包 |
| [version-control](../../../06_Architecture/Details/version-control/01_Architecture.md) | Repository境界、Revision、差し替え可能な履歴管理Adapter |

## 2. 情報源と網羅条件

| 情報源 | 確認する成立条件 | 検証項目 |
|---|---|---|
| [ARCH-000001](../../../06_Architecture/Definitions/ARCH-000001/architecture_definition.md) | 機械判定と意味判断の分離、同一入力への決定性 | `RCM-01`、`RCM-02` |
| [ARCH-000002](../../../06_Architecture/Definitions/ARCH-000002/architecture_definition.md) | 旧／新Owner、Producer、全Consumer、派生物、公開／Release／Recovery経路の閉包 | `RCM-03`〜`RCM-05` |
| [Quality分析](../../Analysis/canonical-definition-mapping/quality_analysis.md) | 全157 Canonical定義、5横断モデル、15詳細設計領域から導いた検証範囲 | 全項目 |

## 3. 共通事前条件

- 同じ固定改訂版の宣言集合と実Sourceを使う。
- 集合は同じ手書き一覧から二重生成せず、独立に導出する。
- Checkerは読取りだけで、検査対象を変更しない。

## 4. 検証項目

| Local ID | 分類 | 事前状態／入力 | 操作／刺激 | 観測と期待結果 | 終了後条件 | 実行形態 |
| --- | --- | --- | --- | --- | --- | --- |
| `RCM-01` | 正常 | 同一Root・Profile・対象の固定fixtureと空のRepository差分 | 同じ検査を二回実行する | 構造化結果と順序が一致し、意味の採否は返さない | Repository Effect 0 | Automated |
| `RCM-02` | 異常 | 読取不能、対象不明、Profile不一致、形式だけ整う各fixture | 各fixtureを検査する | 理由と位置を返し、未確認をPassへ丸めない | Repository Effect 0 | Automated |
| `RCM-03` | 正常 | 旧Owner・新Owner、Producer、全Consumer、派生物、公開・署名・Release・Recovery経路を含む移行fixture | 責務移動後の固定fixtureを検査する | 旧／新Owner、Producer、全Consumer、派生物、公開／署名／Release／Recovery経路が同じ契約へ到達 | 旧利用経路なし | Automated |
| `RCM-04` | 異常 | 一部Consumerだけ旧契約を参照する移行fixtureと成立済み旧能力 | Consumer閉包検査を実行する | 宣言集合と導出集合の差分を検出し、移行完了にしない | 旧能力を削除しない | Automated |
| `RCM-05` | 異常 | Canonical Path・Identity・Stateと、それを別基準で再解釈するConsumer fixture | Producer出力をConsumer契約試験へ渡す | 利用側契約試験が意味差を理由付きで検出 | 公開／署名／Release Effect 0 | Automated |

## 5. 評価と根拠

Passは、集合の完全一致、全Consumerごとの契約試験、旧契約の不在検査およびEffect 0を同じ固定改訂版で確認した場合だけとする。Evidenceは対象改訂版、導出方法、集合Hash、差分、Local IDごとの結果と未確認範囲を保持する。

## 6. 自動化と実装の対応

自動化対応はCanonicalな本定義を固定した後、現行Checker試験と契約移行の利用側試験をReality Auditで照合する。試験ファイルの存在だけでImplementedとしない。
