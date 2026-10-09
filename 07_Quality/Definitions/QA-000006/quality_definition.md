# QA-000006 外部実行境界の検証定義

成果物種別: Quality定義
Quality ID: `QA-000006`
検証目標: OS、Process、Container、外部CLIおよびAI Runtimeの意味を推測せず、要求から終了後状態までを段階別に確認する
主な試験段階: Integration／System
状態: Canonical
維持責任者: Qual-Lab

## 1. 情報源と網羅条件

| Source ID | Obligation Key | 導出元 | 保持する固有条件 | 試験段階 | 対応Local Item |
|---|---|---|---|---|
| [REQ-000002](../../../01_Discovery/Definitions/REQ-000002/requirement.md) | `req-000002.qa-000006` | Requirement Definition（成立条件・失敗・検証意図） | 外部作用（Effect）の前に範囲、送信許可、実行者と確認者が確定する。成功、失敗、取消の各終了経路で候補、プロセス、Docker等の資源状態を追跡できる。残存資源または回復義務を正常終了へ畳まず同じ実行識別情報で再入場できる。正常完了、外部送信拒否、実行途中取消、確認失敗、清掃不能を通し、各段階の決定権限、結果、残存、回復対象の識別情報を観測する | IT | `ERB-IT-004`、`ERB-IT-003` |
| [REQ-000005](../../../01_Discovery/Definitions/REQ-000005/requirement.md) | `req-000005.qa-000006` | Requirement Definition（成立条件・失敗・検証意図） | プロジェクト管理、実行編成、通信方式、観測、Platform境界の責任者を一意に説明できる。仕事管理から実行編成への依存は公開入口に限定し、下位から上位の実装への逆依存を持たない。各部品の公開入口以外を利用側が参照せず、単独利用時の契約を確認できる。依存Graph、公開import、package単独試験、代表利用側を確認し、内部パス参照や逆向き依存を反証する | IT／ST | `ERB-IT-001`、`ERB-ST-005` |
| [REQ-000016](../../../01_Discovery/Definitions/REQ-000016/requirement.md) | `req-000016.qa-000006` | Requirement Definition（成立条件・失敗・検証意図） | モデル、設定内容、役割割当、CLI配置をSchemaと接続部対応で検証する。登録、Host可用、認証、処理許可を別々に判定する。構成変更後も既存接続部の起動、取消、結果意味が変わらない。既存モデル追加、設定内容変更、CLI移動、未知モデル、Host不可、認証不足を与え、外部変更の前の選択と拒否を観測する | IT | `ERB-IT-001`、`ERB-IT-004`、`ERB-IT-006` |
| [REQ-000023](../../../01_Discovery/Definitions/REQ-000023/requirement.md) | `req-000023.qa-000006` | Requirement Definition（成立条件・失敗・検証意図） | 新実行基盤と既存接続部の認証、起動、取消、結果、回復Semanticsを比較する。差がある場合は設定Aliasでなく専用接続部と機能 契約を持つ。実環境で開始から終了後清掃までを段階的に検証する。既存接続部互換と非互換実行基盤を用意し、構成受理、接続部選択、取消、結果、回復、清掃を観測する | IT／ST | `ERB-ST-005`、`ERB-IT-001` |
| [REQ-000030](../../../01_Discovery/Definitions/REQ-000030/requirement.md) | `req-000030.qa-000006` | Requirement Definition（成立条件・失敗・検証意図） | 各試験段階の責務と重複しない完成主張を定義する。外部境界は正常系から取消、清掃、回復まで実環境で観測する。変更意味から成立済み機能と回帰対象を選び、最終E2Eを最初の結合にしない。局所、外部単体、一連の状態変化、隣接1～2 Block、公開入口の順に故障を注入し、発見段階と診断可能性を観測する | IT | `ERB-IT-004`、`ERB-IT-002` |
| [UX-000008](../../../02_UX/Definitions/UX-000008/ux_definition.md) | `ux-000008.qa-000006` | UX Definition（利用者成果・重要場面・重要な失敗） | AI実行環境の認証・起動・取消・結果取得・回復のどこに違いがあり、故障時に何が利用可能かを理解できる。重要場面「一つの失敗を全体障害と判断する直前」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。認証・起動・取消・結果取得・回復の違いを同じ失敗へ畳む表示と、利用可能な機能まで停止する判断を反証する | IT／ST／UAT | `ERB-IT-001`、`ERB-ST-005`、`ERB-UAT-007` |
| [UX-000018](../../../02_UX/Definitions/UX-000018/ux_definition.md) | `ux-000018.qa-000006` | UX Definition（利用者成果・重要場面・重要な失敗） | 新しいモデルへ追随するとき、コード改修を待たず検証済み構成を更新し、実効選択と再選定理由を理解できる。重要場面「AI提供元で実行する前のモデル確定」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。未知設定の黙示代替、非対応モデルの実行可能表示および無説明選択を反証する | IT／ST／UAT | `ERB-ST-005`、`ERB-IT-004`、`ERB-IT-006`、`ERB-UAT-007` |
| [IA-000003](../../../03_IA/Definitions/IA-000003/ia_definition.md) | `ia-000003.qa-000006` | IA Definition（情報・関係・状態・見つけ方） | 失敗後に再接続、再試行、回復、清掃を取り違えず、二重作用を避ける。UX-000003: 開始可能（ready）／実行中（running）／入力・判断待ち（waiting）／停止（blocked）／完了（completed）／失敗（failed）。UX-000004: 失敗後の作用なし／作用済み／不明、回復要／不要。UX-000021: 進行中（active）／切断（disconnected）／結果取得可能（result_available）／回復必要（recovery_required）／確定済み（settled）。UX-000022: 存在（present）／不存在（absent）／不明（unknown）、回復可能（recoverable）／清掃可能（cleanup_eligible） | IT | `ERB-IT-004`、`ERB-IT-001`、`ERB-IT-002` |
| [IA-000013](../../../03_IA/Definitions/IA-000013/ia_definition.md) | `ia-000013.qa-000006` | IA Definition（情報・関係・状態・見つけ方） | コード改修なしに検証済み構成を更新し、実効選択と理由を理解する。UX-000018: 有効（valid）／無効（invalid）／利用可能（available）／利用不能（unavailable）／選択済み（selected） | IT／ST | `ERB-IT-004`、`ERB-ST-005`、`ERB-IT-006` |
| [IA-000020](../../../03_IA/Definitions/IA-000020/ia_definition.md) | `ia-000020.qa-000006` | IA Definition（情報・関係・状態・見つけ方） | 実行基盤の一部が故障したとき、故障した境界と影響を受ける能力を見分け、利用できる範囲まで一律に停止しない。UX-000008: 各境界の利用可能（available）／停止（blocked）／不明（unknown）。全体停止と分ける | IT | `ERB-IT-004`、`ERB-IT-002` |
| [UI-000005](../../../04_UI/Definitions/UI-000005/ui_definition.md) | `ui-000005.qa-000006` | UI Definition（認識・操作・Feedback・失敗表示） | 実際に起きたことと故障箇所を根拠から切り分けられる。UX-000006: 実行事実を出所と観測時点付きで比較する: 記録済み／未記録／記録結果不明を含む実行事実の取得: 出所・時点・観測状態と記録状態を保持する: 未観測や記録結果不明を0、正常または未記録へ畳む。UX-000008: 故障した境界と影響する能力を特定する: 一つの失敗を全体障害と判断する直前: 失敗した場所・影響範囲・利用可能性を分ける: 一律の失敗表示で無関係な能力まで停止する。UX-000006／IA-000004: 記録済み（recorded）／未記録（not_recorded）／記録結果不明（unknown）、観測済み（observed）／未観測（not_observed）／不明（unknown）。評価は事実と別: 実行→記録状態→観測→根拠→評価→改善候補。UX-000008／IA-000020: 各境界の利用可能（available）／停止（blocked）／不明（unknown）。全体停止と分ける: 故障→境界→影響する能力→継続可能範囲→回復 | IT／ST | `ERB-IT-004`、`ERB-ST-005` |
| [UI-000010](../../../04_UI/Definitions/UI-000010/ui_definition.md) | `ui-000010.qa-000006` | UI Definition（認識・操作・Feedback・失敗表示） | 仕事に合うToolとAIモデルを根拠付きで選び、安全に変更できる。UX-000016: 固定Commitに対応するツール／実行基盤と利用可能性を知る: 発見したツール／実行基盤を起動する直前: Commit・配布集合・Manifest・実行基盤の対応を検証する: 版不一致・欠落実行基盤・改ざんManifestを対応版と誤認する。UX-000018: AIモデル選択を検証可能な構成として更新する: AI提供元で実行する前のモデル確定: 構成変更を検証し実効選択を観測可能にする: 未知または非対応のモデルを実行可能と表示する。UX-000016／IA-000011: 利用可能（available）／利用不能（unavailable）／未確認（unverified）／停止（blocked）: 仕事→必要能力→登録Tool→配布根拠→起動。UX-000018／IA-000013: 有効（valid）／無効（invalid）／利用可能（available）／利用不能（unavailable）／選択済み（selected）: 設定→検証→利用可能候補→選択→理由・再選定条件 | IT | `ERB-IT-004`、`ERB-IT-001`、`ERB-IT-006` |
| [SPEC-000009](../../../05_SPEC/Definitions/SPEC-000009/spec_definition.md) | `spec-000009.qa-000006` | SPEC Definition（正常・境界・失敗・観測不能・副作用） | 正常: 原因未確定と確定済みを分け、Providerごとの差を保持する。境界: 診断対象内／対象外、原因確定／未確定を分け、診断から修復Effectを発行しない。失敗: 一つの失敗から全機能停止や原因を断定しない。観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「許可された小規模Probeだけを実行し、Provider仕事や修復Effectを発行しない」と矛盾する結果を返さない。失敗: 一つの失敗から全機能停止や原因を断定しない。副作用: 許可された小規模Probeだけを実行し、Provider仕事や修復Effectを発行しない。本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す | IT／ST | `ERB-IT-004`、`ERB-ST-005` |
| [SPEC-000015](../../../05_SPEC/Definitions/SPEC-000015/spec_definition.md) | `spec-000015.qa-000006` | SPEC Definition（正常・境界・失敗・観測不能・副作用） | 正常: コード変更なしで構成を更新でき、選択理由と適用範囲を確認できる。境界: 許可値／未知値、利用可能／利用不能を分け、不正構成を暗黙fallbackしない。失敗: 未知モデルや不正構成を暗黙fallbackせず、構成変更を実行許可にしない。観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「採用時だけ構成を保存する。選択はProvider実行Effectを発行しない」と矛盾する結果を返さない。失敗: 未知モデルや不正構成を暗黙fallbackせず、構成変更を実行許可にしない。副作用: 採用時だけ構成を保存する。選択はProvider実行Effectを発行しない。本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す | IT／ST | `ERB-IT-004`、`ERB-ST-005`、`ERB-IT-006` |
| [ARCH-000008](../../../06_Architecture/Definitions/ARCH-000008/architecture_definition.md) | `arch-000008.qa-000006` | Architecture Definition（責務・境界・状態・故障） | 境界ごとのavailable／blocked／unknownと相関IDを返し、診断成功をTask成功へ読み替えない。観測手段に許可された最小Probeだけを使う。所有する責務: 外部境界ごとの到達、受理、開始、結果搬送、終了状態の観測。所有しない責務: Provider Task、Docker修復、再起動、結果採用。主な外部境界: OS Process、Docker、Network、外部CLI。SPEC-000009: 一つの失敗から全機能停止や原因を断定しない。Effect: 許可された小規模Probeだけを実行し、Provider仕事や修復Effectを発行しない。入力SPECが固有Recoveryを定義しない場合、Architectureから追加しない。結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める | IT／ST | `ERB-IT-004`、`ERB-IT-001`、`ERB-ST-005` |
| [ARCH-000010](../../../06_Architecture/Definitions/ARCH-000010/architecture_definition.md) | `arch-000010.qa-000006` | Architecture Definition（責務・境界・状態・故障） | Toolのavailable／unavailable／unverified／blockedと、モデル構成のvalid／invalid／selectedを分ける。コード埋込みのモデル一覧ではなく検証済み外部構成から選ぶ。所有する責務: Repositoryに適合するTool能力の発見、AIモデル構成の検証・選択理由。所有しない責務: Tool実行、Provider利用可能性の捏造、Repository Binding。主な外部境界: Repository設定、Tool Package、Provider Preflight。SPEC-000014: Tool一覧の閲覧だけで実行Authorityを発行しない。Effect: 読取り専用で候補を返し、Toolまたは配布物を実行・変更しない。SPEC-000015: 未知モデルや不正構成を暗黙fallbackせず、構成変更を実行許可にしない。Effect: 採用時だけ構成を保存する。選択はProvider実行Effectを発行しない。入力SPECが固有Recoveryを定義しない場合、Architectureから追加しない。結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める | UT／IT／ST | `ERB-UT-016`、`ERB-IT-017`、`ERB-IT-004`、`ERB-ST-005`、`ERB-IT-003`、`ERB-IT-006`、`ERB-UT-033` |
| [ARCH-000004](../../../06_Architecture/Definitions/ARCH-000004/architecture_definition.md) | `arch-000004.qa-000006` | Architecture Definition／詳細設計（Provider結果境界） | Provider固有出力の解釈をAI Adapterへ分離し、正規化だけをTask・実行・回収の完成へ昇格しない | UT／IT | `ERB-UT-032`、`ERB-IT-001`、`ERB-IT-002` |
| [ARCH-000015](../../../06_Architecture/Definitions/ARCH-000015/architecture_definition.md) | `arch-000015.qa-000006` | Architecture Definition／詳細設計（結果と公開境界） | 曖昧な構造化結果を拒否し、生Provider出力を公開しない。共通結果判定とProvider固有解析を分ける | UT | `ERB-UT-032` |

### Architecture詳細設計入力

Provider差の純粋検証は、`ARCH-000004`／`ARCH-000015`の結果変換と`ARCH-000010`のProfile構成境界を、AI Adapter詳細設計§7の公開契約へ具体化して導出する。`ERB-UT-032`は既存ITの実CLI終了を、`ERB-UT-033`は実課金防止を証明しない。課金方針はCoordinator詳細設計§7のAPI key fallback／追加購入非対応を引き継ぎ、未実装の有料APIを新機能として採用しない。

| 詳細設計領域 | 受け取る成立条件 |
|---|---|
| [coordinator](../../../06_Architecture/Details/coordinator/01_Architecture.md) | 実行編成、Authority、外部Effect、候補、回収・回復。7.5.1の未改造公式CLI・Docker隔離は`ERB-IT-031`で配布と公開起動を確認する。通知と最終結果は`ERB-UT-023`、同11節を含む公開CLIの取消・親Process喪失は`ERB-ST-030`で確認する。旧内部改造の024～029は現行の要求集合から外す。 |
| [ai-adapter](../../../06_Architecture/Details/ai-adapter/01_Architecture.md#73-qa導出と残る照合) | Provider構造化結果の純粋解析・正規化／拒否を`ERB-UT-032`、Subscription限定の方針記述を`ERB-UT-033`へ接続する。実CLI、課金、Process、取消、cleanupは別の義務である。 |
| [cros](../../../06_Architecture/Details/cros/01_Architecture.md) | Repository横断解決、Grant、投影、外部接続、候補処置 |
| [platform-access](../../../06_Architecture/Details/platform-access/01_Architecture.md) | OS資源、Process Effect、観測、cleanup、回復 |
| [verification-runner](../../../06_Architecture/Details/verification-runner/01_Architecture.md) | 外部境界試験の段階適用、子Process結果および観測不能時の停止 |
| [visual-preview](../../../06_Architecture/Details/visual-preview/01_Architecture.md) | Repository内Visual Root、localhost HTTP、読取り専用配信およびListener清掃 |
| [workbench](../../../06_Architecture/Details/workbench-server/01_Architecture.md) | Production localhost Server、Browser UI、公式ロゴ、実Visual Profileおよび終了後資源 |

## 2. Lifecycle全体

```text
[入力／構成]
      ↓
[要求] ≠ [受理]
      ↓
[開始] ≠ [完了通知]
      ↓
[外部Effect] ≠ [結果搬送／観測]
      ↓
[子Process・Container・handle・Mountの終了]
```

## 3. 試験段階と外部境界の適用

| 試験段階 | 適用 | 確認する範囲 | 外部境界の到達範囲 | 判断理由 |
| --- | --- | --- | --- | --- |
| UT | Conditional | 状態遷移、理由分類、相関の純粋規則 | N/A | 外部Effectを発生させず最小判断を反証できる場合に必要 |
| IT | Required | Adapterと実CLI／Process／Containerの直接境界から関連2 blockまで | Related 2 Blocks | 起動だけでなく搬送、取消、回収、終了後を局所化するため |
| ST | Required | 公開入口から実Runtime結果と全資源終了まで | System/E2E | 局所境界の成功を利用者経路全体へ一般化しないため |
| UAT | Conditional | 外部Runtime停止・回復を利用者が判断する場面 | User Acceptance | 人間判断が公開操作に含まれる場合に必要 |

### 条件区分の適用

| 条件区分 | 適用 | 対応Local Item | 判断理由 |
|---|---|---|---|
| 正常 | Required | ERB-IT-001、ERB-UT-016、ERB-IT-031、ERB-UT-033 | 通常の成立経路と固定課金方針の記述を独立して確認する。 |
| 境界 | Required | ERB-IT-006、ERB-UAT-007、ERB-IT-008、ERB-IT-010、ERB-ST-015、ERB-IT-018、ERB-ST-019、ERB-IT-020、ERB-IT-021、ERB-ST-022、ERB-UT-023 | 値、Authority、情報、責務、localhost配信範囲、Browser lifecycle、Workbench Production Shell、AI依頼種別、公式助言のDocker隔離、実Browser観測または利用者判断の境界を確認する。故障注入ERB-IT-002は異常へ分類する。 |
| 準正常 | Required | ERB-IT-004、ERB-ST-005 | 継続可能な分岐、保留、観測不能または診断状態を成功へ畳まない。 |
| 異常 | Required | ERB-IT-002、ERB-UT-032 | 起動・搬送・終了の失敗と不正Provider構造化入力の拒否を区別して確認する。親Process喪失は回復項目ERB-ST-030でも独立scenarioとして処置する。 |
| 回復 | Required | ERB-IT-003、ERB-ST-009、ERB-ST-011、ERB-IT-012、ERB-ST-013、ERB-IT-014、ERB-IT-017、ERB-ST-030 | 失敗・取消後に同じIdentityと義務で安全に再入場できることを確認する。 |

## 4. 検証項目

公式CLI移行では、旧内部改造に対する`ERB-IT-024`～`ERB-IT-029`を現行の必須集合から除外する。旧6項目の詳細は基準Commit `823cb32deaa0e21a28aad73942ab5a05a9aa0950`の本定義で追跡し、現行の検証項目表には残さない。IDを別の意味に再利用せず、過去の成功を新方式の成功へ流用しない。公式CLI内部のTool登録禁止とJS能力不存在は現行CRDDの保証対象ではない。

新方式の公開配布・起動は`ERB-IT-031`、有限な通知分類と唯一の最終結果は既存`ERB-UT-023`、取消・喪失と終了後資源は既存`ERB-ST-030`が所有する。署名・実Provider E2Eおよび実取消の再観測が未完了の間、全体Passを表示しない。


| Local ID | 条件区分 | 試験段階 | 試験種別 | 対象／境界 | 外部境界の段階 | 事前状態／入力 | 操作／刺激 | 観測 | Oracle | Evidence | 終了後条件 | 実行形態 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `ERB-UT-032` | 異常 | UT | Provider構造化結果／純粋変換 | 未信頼JSON・Codex／Claude Envelope→AI Adapter | N/A | 単一正常結果、重複key・末尾データ・不足Envelope・容量契約値、およびTurn／cost上限の反例 | Provider正規化と共通JSON解析を固定値で実行する | 正規化値、blocked分類、固定契約field、生出力非公開を観測する | 唯一のexact結果だけを受理し、不正入力を部分公開せず、生出力を返さない。固定上限を実課金・Process終了保証へ昇格しない | 固定入力分類、返却値、拒否と契約fieldの判定。生Provider出力・秘密値は保存しない | 実Provider／Filesystem Effect 0、Process起動0 | Automated |
| `ERB-UT-033` | 正常 | UT | Subscription課金方針／純粋記述 | AI Adapter課金方針公開操作→固定記述 | N/A | 既存Subscription限定方針と未実装有料APIの前提条件 | 方針記述を取得してfieldと条件を照合する | 暗黙fallback・追加購入・設定単独Authorityの否定と未実装条件を観測する | Subscription限定、API key fallbackと追加購入非対応を維持し、利用者設定だけで実行Authorityを発行しない。将来条件は未実装の記述である | 固定field・条件、非発行と判定。実課金防止の証明にはしない | 実Provider／課金／Filesystem Effect 0 | Automated |
| `ERB-IT-031` | 正常 | IT | 公式配布／公開起動 | Coordinator固定配布→Docker→公式Codex CLI／Host | Related 2 Blocks | 検証済み公式CLI・同版Host・既存bwrap、固定DockerfileとImage、認証情報なし | 配置用Imageを作成し、network none・非root・read-onlyのコンテナで版表示と実行物Hashを確認する | 公式版、三実行物Hash、実Image Digest、終了コード、起動Warning、コンテナ終了後状態 | 未改造公式0.159.2と固定Hashが一致する。CLI Source BuildとPatchを必要とせず起動する。Warningを消去せず、実助言・取消・署名成立とは区別する | 固定配布Identity、版、Hash、局所起動と終了後判定の要約。実行ごとの大きな書庫を作らない | Provider依頼0、認証情報使用0、試験コンテナ不存在を確認する | Automated |
| `ERB-ST-030` | 回復 | ST | 公開CLI取消／親Process喪失 | 本番同等CLI入口→固定Host→Process Tree／Container／Network | System/E2E | 詳細設計7.5.1・11、本番同等の搬送・権限・環境、実行中Cell、対象の外にあるObserver、exact資源Identity | 公開取消とCLI親Process喪失を別scenarioで実行する | 取消伝播、公開結果、Host終了、全所有資源の閉包、必要時のexact回復参照 | 両scenarioを個別評価する。清掃完了と観測不能による停止・回復義務保持を分け、安全な停止を清掃完了やCapability完成へ読み替えない | scenario別の実行Identity、公開結果、資源観測、exact回復義務、固定配布・環境・入力Hash | 全所有資源0または同じexact回復義務保持。新Provider要求・永続Dockerデータ削除0 | Automated |
| `ERB-IT-001` | 正常 | IT | External Contract／Lifecycle | Adapter→実CLI・Process・Container | Direct Boundary | 固定CLI・Process・Container、相関ID、終了後資源Observer | 外部実行を開始し完了まで観測する | ERB-IT-001として、「外部実行を開始し完了まで観測する」前後のAdapter→実CLI・Process・Containerについて、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | 構成、要求、受理、開始、結果、完了を同じrunで相関 | ERB-IT-001、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「構成、要求、受理、開始、結果、完了を同じrunで相関」および終了後条件「すべての所有資源の終了を独立観測」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | すべての所有資源の終了を独立観測 | Automated |
| `ERB-IT-002` | 異常 | IT | Fault Injection／Lifecycle | Controller→stdio・signal・close→資源Observer | Adjacent 1 Block | 起動・搬送・取消・closeの各境界へ故障を注入できる固定Task | handle取得後、write後、kill要求後にそれぞれ失敗させる | ERB-IT-002として、「handle取得後、write後、kill要求後にそれぞれ失敗させる」前後のController→stdio・signal・close→資源Observerについて、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | 前段階の成功を後段階の成功にせず、原因段階を返す | ERB-IT-002、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「前段階の成功を後段階の成功にせず、原因段階を返す」および終了後条件「終了不明をcleanup成功にしない」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | 終了不明をcleanup成功にしない | Automated |
| `ERB-IT-003` | 回復 | IT | Cancellation／Recovery | Task Runtime→Controller→外部Runtime→Recovery | Related 2 Blocks | 実行中Task、取消Authority、重複・遅延通知と部分結果の注入点 | timeout、cancel、重複通知、遅延close、部分結果を順に発生させる | ERB-IT-003として、「timeout、cancel、重複通知、遅延close、部分結果を順に発生させる」前後のTask Runtime→Controller→外部Runtime→Recoveryについて、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | 状態遷移、結果搬送、Effect、回収を独立に評価 | ERB-IT-003、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「状態遷移、結果搬送、Effect、回収を独立に評価」および終了後条件「残存する場合は回復義務を保持」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | 残存する場合は回復義務を保持 | Automated |
| `ERB-IT-004` | 準正常 | IT | Unknown State／Safety | Observer→Effect Gate | Direct Boundary | 実行可能性、現存Processまたは終了後不存在を観測できない環境 | 観測不能なまま状態判定と次のEffectを要求する | ERB-IT-004として、「観測不能なまま状態判定と次のEffectを要求する」前後のObserver→Effect Gateについて、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | available／absent／doneへ丸めず、安全な停止と診断情報を返す | ERB-IT-004、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「available／absent／doneへ丸めず、安全な停止と診断情報を返す」および終了後条件「追加外部Effect 0」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | 追加外部Effect 0 | Automated |
| `ERB-ST-005` | 準正常 | ST | Observability／Scenario | 公開入口→外部Runtime→結果・終了後診断 | System/E2E | 同一固定Taskの正常例と各故障例、機密を除く相関ログ契約 | 全例を実行し、段階別診断を収集する | ERB-ST-005として、「全例を実行し、段階別診断を収集する」前後の公開入口→外部Runtime→結果・終了後診断について、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | 入力／構成から終了後までの段階、理由、相関を記録 | ERB-ST-005、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「入力／構成から終了後までの段階、理由、相関を記録」および終了後条件「Path、Credential、Secret、生Provider出力を含まない」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | Path、Credential、Secret、生Provider出力を含まない | Automated |
| `ERB-IT-006` | 境界 | IT | Configuration／Selection | AIモデル構成→Schema検証→利用可能性確認→選択結果 | Related 2 Blocks | 許可値、未知値、Schema違反、利用不能モデル、採用前候補、採用済み構成を含む固定入力 | 構成を検証し、選択と採用を別操作として要求する | 構成Revision、Schema判定、Provider利用可能性、実効モデル、選択理由、再選定条件、構成保存回数、Provider Effect回数を入力別に記録する | 未知・不正・利用不能を暗黙fallbackせず、実効モデル、選択理由、再選定条件を返す | ERB-IT-006、構成Revision、Schema判定、Provider利用可能性、実効モデル、選択理由、再選定条件、保存回数、Provider Effect回数およびOracle判定を保存する。Secret、生Provider出力および絶対Pathは保存しない | 採用時だけ構成を一回保存し、選択だけではProvider Effect 0 | Automated |
| `ERB-UAT-007` | 境界 | UAT | Acceptance／Diagnosis | 外部Runtimeの状態・構成・影響範囲→利用者判断 | User Acceptance | 正常、部分故障、利用不能、未知構成を含む診断結果 | 利用者が継続、再選択、停止または回復を判断する | 表示された状態、選択理由、不完全性および利用者判断を記録する | 故障境界と影響範囲を理解し、未知状態を正常として継続せず、AIモデル構成を根拠付きで選べる | ERB-UAT-007の診断結果、利用者判断、選択根拠および終了後状態 | 判断前に新しいProvider Effect 0 | Manual |
| `ERB-IT-008` | 境界 | IT | Provider Home／Preflight | Provider Home設定→Directory検証→Process Gate | Direct Boundary | 正常Home、欠落、file、link／reparse、別Repository、権限不足の各fixture | Provider起動前にHomeを検証する | 入力Home分類、解決結果、検証理由、Provider Process Effect回数を記録する | 正常な所有Directoryだけを受理し、不正・不明時は理由付きで停止する | ERB-IT-008、Home分類、検証結果・理由、Provider Process Effect回数およびOracle判定を保存する。絶対Pathは保存しない | 不正・不明時のProvider Process Effect 0 | Automated |
| `ERB-ST-009` | 回復 | ST | Docker Repair／Recovery | 修復Identity→既知Runtime領域の段階退避→Docker restart→Engine readiness | System/E2E | exact Repair ID、`Docker/run`と`docker-secrets-engine`の既知2領域、停止中またはハングしたDocker、初回起動失敗、Engine readiness Observer、単一Probe Timeout、全体起動期限、署名版更新 | 同じRepair IDで各領域を順序付きに退避し、再起動・確認を継続する。初回起動が期限超過し、既知2領域のlockとProcess集合を確認できる場合は、単一Probe Timeoutを停止済みと誤認せず、同じInvocation内でContinuationへ移る | Repair ID、領域別Identity、各Effectの意図と結果、再起動試行、Engine readiness、継続Gateの条件別理由、同一実行内で計測できた起動所要時間の参考値、再入場回数を記録する | 未完了Effectを再発行せず、個別socketを削除しない。期限満了後に既知2領域のexact lockとProcess集合が揃う場合は、Process停止を一回だけ行い、その後にEngine既知停止とProcess不在をfresh確認してから段階修復する。2領域の退避と新世代確認が揃いEngine readyになった後だけ完了する | ERB-ST-009、Repair ID、領域別Identity Hash、追記記録chain、Effect確認、Engine readiness、継続Gateの条件別理由、起動所要時間または未計測、同一Invocation継続または再入場の結果、残る回復義務を保存する | native helper残存0。停止後もEngineまたはProcessが未確認、部分退避、観測不能、intent後中断では自動継続せず同じRepair IDの回復義務を保持する | Hybrid |
| `ERB-IT-010` | 境界 | IT | CROS Handoff／Continuation | Source Runtime→Handoff記録→Destination Runtime | Related 2 Blocks | 正常Contextに加え、Task／Project Identity不一致、Revision不一致、必須Context欠落、Authority追加、再構成不能Contextの各固定入力 | 各ContextでHandoffを発行し別Runtimeから再入場する | Handoff Identity、Task／Project Identity、Revision、必須Context充足、Authority差分、Effect件数、拒否理由、再入場結果を両Runtimeで相関する | 正常時はIdentityとRevisionを保持する。不完全・不一致・Authority拡大時は推測補完も完了扱いもせず、同じHandoff Identityで不足を返す | ERB-IT-010、両Runtimeの相関Identity、Revision、必須Context判定、Authority差分、Effect件数、拒否理由、再入場結果を保存する | 正常時は送信元の所有資源0・重複Effect 0。拒否時はDestination Effect 0 | Automated |
| `ERB-ST-011` | 回復 | ST | Docker Session Handoff／Recovery | repair・restart→handoff chain→別Session／Runtime→closure | System/E2E | repair／restart／handoff Identity、Source／Destination Session Identity、Runtime Execution Identity、origin・adoption・tip・closure、Host資源観測、引継ぎ前Sessionが作成したContinuationと、同一SessionでのRelease更新、別Session混入・Identity不一致・循環・分岐・番号飛び・上限超過・記録欠落・chain外Continuation・現在境界未結合・旧Effect再発行要求 | 正常chain、同一SessionのRelease更新と各反例で別Runtimeへの継続を要求し、旧Continuationを現在Releaseから読取り・追記する | chain全要素と順序、各Identity、現在の検証済み実行境界、Continuationの発行元と追記元、Effect件数、Engine／Host資源、exact回復義務、拒否理由を記録する | 正常時だけ検証済みchain内の旧Continuationを受理し、同一Sessionの更新では検証済み現在Releaseを末尾Authorityとして次段階を追記する。不正chain、chain外tuple、現在境界未結合はEffect 0、旧Host Effectを再発行せず、不明時は同じIdentityで回復義務を保持する | ERB-ST-011、chain、Continuation Identity、現在Release、追記境界、Effect件数、Engine／Host状態、回復義務、拒否理由、Oracleを保存する | 不正・不明時Host Effect 0。正常完了時は旧Session所有資源0 | Hybrid |

### ERB-ST-009の段階的な外部境界確認

| 段階 | 確認対象 | 主な反証 |
|---|---|---|
| 1. 領域単体 | `Docker/run`と`docker-secrets-engine`を別々に観測し、exact Identityと既知lockを確認する | 一方だけ確認、再帰探索、未知error、観測中の内容変化 |
| 2. Effect単体 | 期限超過時にProcessが残る場合は停止意図を先に耐久化して一回だけ停止する。停止後にEngine既知停止とProcess不在をfresh確認する。各退避の意図も先に耐久化し、Effect直前にsource／lock Identity、target不存在およびHost静止状態を再確認してから同一親へrenameし、結果を記録する | 単一Probe Timeoutの停止済み扱い、停止intent後中断、停止部分成功、rename後settlement前中断、個別socket削除、別Directory退避、観測後のDocker再起動、Identity差替え |
| 3. 領域間結合 | 失敗起動世代とSecrets Engineを同じRepair IDで順序付きに退避し、各Effect前に先行退避結果とHost停止状態を再確認する | 一領域の成功を全体成功へ昇格、別Repair IDへの逃避、旧Effect再発行、一領域退避後のProcess再出現 |
| 4. 再起動結合 | 両領域の退避後に再起動を一回だけ発行する。confirmed後の既知未起動と単一Probe Timeoutは180秒の全体期限内で読取り再観測する | 起動結果不明時の再発行、片側未完了での起動、単一Probe Timeoutでの即時停止、取消・Trust変化・一般エラーの再試行 |
| 5. 回復全体 | Engine、Process、新しい2領域、退避2領域、3 Effectのconfirmed settlementおよびnative helper終了を確認し、同一実行内で計測できた起動所要時間を参考値として保存する | Engineだけの成功、いずれかの新旧世代欠落、部分回復、全体期限超過、未確認Effect、資源残存、再入場時の起動時間推測 |
| 6. 版更新・再入場 | 旧署名の原記録を変更せず、現在Releaseへexactに結合した追記記録で同じRepair IDを継続し、回復済み表示とcloseの両方で全記録を再検証する | 旧記録の上書き、別Release記録の受理、改変・部分記録でのclose、現在Authorityへの流用、intent済みEffectの二重発行 |

各段階の局所試験がPassしても次段階の成立を推定しない。局所契約試験では、最初のEffect前からDockerが稼働している場合、一領域退避後にDockerが再出現する場合、Secrets Engineの新世代が欠ける場合、旧stale Evidenceが不存在・元Operationとexact一致・別Identity・観測不能である場合、追記記録が改変・部分成立・別Release結合である場合も反証する。現行署名版が新規作成した修復と旧署名版から採用した修復の双方について、初回起動失敗後に同じRepair IDの段階処置へ入ることを局所契約試験で確認する。実機STでは、初回起動失敗から版更新、2領域退避、一回の再起動、終了後観測、保持済み旧stale Evidenceを削除しない明示close、新しいRepair IDによる現世代修復および再入場までを一つのlifecycleとして確認する。

| `ERB-IT-012` | 回復 | IT | Docker Repair Handoff | Coordinator→Repair Record→Platform Adapter | Related 2 Blocks | exact Repair Identity、旧Effect記録、署名検証済みorigin／adoption／handoff chain、同一Sessionで更新した現在Release、旧Continuation、fresh観測、手組みOperation、chain外tuple、現在境界未結合、別Session反例 | Record Storeが検証したchainと現在実行境界から旧Continuationの発行元を導出し、既存Repairを現在境界で継続可能なPlatform要求へ変換する | Repair Identity、Authority順序、同一SessionでのRelease更新、Continuationの発行元と追記元、fresh状態、Effect要求、拒否理由を記録する | Record Storeの検証結果だけをAuthorityとし、同一SessionのRelease更新では検証済み現在境界を末尾Authorityに加える。旧Effectを再発行せず同じRepair義務を現在境界から追記し、手組み・chain外・未結合はEffect 0で拒否する | Identity、chain、現在Release、Continuation sequence、追記tuple、状態、要求、Effect件数、判定 | 重複Effect 0、別Repair 0、未検証Authority 0 | Automated |
| `ERB-ST-013` | 回復 | ST | CROS Handoff Scenario | Source Runtime→Handoff→Destination Runtime | System/E2E | 同じContext Identity／Revision、切断、Destination拒否、Authority差 | SourceからDestinationへContextを移送し再開する | 両Runtime状態、Identity、Revision、Authority差、結果を記録する | 未確認Context補完やAuthority昇格なしに同じIdentityで再開する | Source／Destination状態、結果、判定 | Source二重実行0 | Automated |
| `ERB-IT-014` | 回復 | IT | Docker Repair／Restart Boundary | Recovery Inventory／Platform Adapter→Docker Desktop／Engine Observer | Related 2 Blocks | stale socket、Engine停止、restart受理、ready未確認、複数Recovery、Inventory追加・欠落・置換、Host／Home Scope競合 | 修復または検証付き再起動を要求し、複数件では全Host・全Home・Runtime Stateを決定順で固定してEngine状態を観測する | Recovery一覧、Host／Home Scope、Lock順、socket処置、restart要求、Engine観測、対象Recoveryの終了状態を記録する | 全ScopeとInventoryのfresh再確認前、またはEngine readyのfresh観測前に完了を返さず、再起動後は選択したexact Recoveryだけを収束させる | 入力、Inventory差、Scope、Lock順、要求、観測、対象別終了状態、判定 | 未確認時は回復義務保持、未選択Recovery変更0 | Automated |
| `ERB-ST-015` | 境界 | ST | Boundary Progression | 局所Gate→直接境界→Lifecycle→公開入口 | System/E2E | 段階別結果と下位未Pass／未実行反例 | 下位Gate成立時だけ次の境界を実行する | 各段階の開始条件、結果、未開始理由を記録する | 下位未成立のまま上位境界を開始せず公開入口まで順序を保つ | 段階結果、実行順、判定 | 禁止上位Effect 0 | Automated |
| `ERB-UT-016` | 正常 | UT | Authentication／Lifecycle Contract | Claude再認証Plan→Provider Home排他→耐久Intent／Command世代→認証Probe→exact cleanup | N/A | 固定Provider Home Identity、正常・途中失敗・観測不能・競合・既存Intentの各固定入力 | 再認証Lifecycleを依存差替え境界で実行する | mount、実行順、秘密入力非表示案内、内部Proxy alias／port、Probe、資源不存在、`idle`／`in_flight`、回復Identity、後発Effect件数を記録する | Repository／Workspace／API keyを接続せず、秘密入力をCRDDが反響せず非表示・一回入力を事前案内し、内部Proxy接続が実装の固定待受port `8080`と一致し、Probeと全資源不存在が揃った場合だけ完了する。不存在時の空stdoutと`[]`は明示stderrとの組合せだけ受理する。別port、任意stdout、競合、観測不能、旧Command in-flightでは追加Effect 0または安全な失敗として同じ回復Identityを保持する | ERB-UT-016、固定入力、実行順、固定Proxy port、結果理由、Command世代、回復Identity、Effect件数および終了後資源状態を保存する。Path、Credential、Secret、生Provider出力は保存しない | 正常時は所有資源不存在かつ耐久記録settled。未確認時は同じ回復Identityを保持 | Automated |
| `ERB-IT-017` | 回復 | IT | Authentication／Durable Recovery | 子Process→Provider Home Kernel Lock→耐久Intent／Command世代→fresh Process再入場 | Direct Boundary | 固定Provider Home Identity、active Intent、`idle`または`in_flight`、所有資源、不意のProcess終了 | Lockとactive Intentを持つProcessを終了し、fresh Processで同じ再認証を開始する | Process終了、Lock再取得、Recovery ID、Command世代、資源所有権、Intent状態、後続Effect順序を記録する | `idle`では所有資源不存在の確認後だけ再入場してsettledへ閉じる。`in_flight`では旧Command終了を推定せずDocker Effect 0で同じRecovery IDを保持する | ERB-IT-017、固定Identity、子終了、Lock再取得、Intent／Command世代遷移、Docker Effect列、Oracleおよび終了後状態を保存する。Path、Credential、Secret、生Provider出力は保存しない | idle回復後は所有Docker資源0、耐久記録settled、Kernel Lock解放確認。in-flightではactive記録と手動回復義務を保持 | Automated |
| `ERB-IT-018` | 境界 | IT | Local HTTP／Read-only Preview | Repository内Visual Root→localhost HTTP Listener→Browser相当Consumer | Direct Boundary | LinkでないRepository相対Root、HTML／CSS、Directory、Traversal、Encode済みSeparator、Junction、不許可Methodおよびclose | Previewを一時Portで開始し、GET／HEAD／Healthと拒否入力を要求して終了する | Bind Address、Status、Header、本文、拒否結果、Health、close後Connectionを記録する | `127.0.0.1`だけへBindし、通常FileのGET／HEADだけを返す。Path越境、Link、Directory、書込みMethodを拒否し、内部Absolute Pathを公開しない | ERB-IT-018、固定Fixture分類、Request分類、Status、Security Header、read-only判定、close後Connection拒否およびOracle判定を保存する。Absolute PathとFile内容全量は保存しない | Repository書込み0、Listener 0、Connection 0 | Automated |
| `ERB-ST-019` | 境界 | ST | Actual Browser Zoom／Visual Gate | Repository内Visual成果物→localhost Preview→専用Chrome Profile→Rendered DOM観測 | System/E2E | SHA-256で固定した公開CLIから検証器までの実行閉包、全HTML・CSS・画像、Browser版、100%／200%／400%、1280×960 Window、文字12px下限、操作対象32px下限、画像読込、横OverflowおよびFocus順 | 条件ごとに専用ProfileでChromeを起動し、実Zoom反映後のRendered DOMと終了後資源を観測する | 指定倍率、DPR、実効Viewport、Scroll幅、最小文字、最小操作対象、正の`tabindex`、画像総数・成功・失敗、正常終了受理、実終了経路（normal／sigterm／sigkill／unknown）、Process Tree、DevTools、Profile、Preview Listenerを記録する | 全画面・全倍率で実Zoomと画像読込が成立し、表示不適合が0件である。Listenerは接続拒否だけを不存在とし、timeout・分類不能・資源残存または終了経路unknownをPassにしない | ERB-ST-019、観測時HEAD、入力Manifest、Browser版、対象一覧、倍率、Window寸法、集約測定値、Oracleおよび資源別終了後状態を保存する。DOM本文、Absolute Path、Profile Path、PIDおよびDevTools Endpointは保存しない | Browser Process Tree 0、DevTools Listener 0、専用Profile 0、Preview Listener 0、Repository書込み0 | Hybrid |
| `ERB-IT-020` | 境界 | IT | Browser Lifecycle Observation | localhost Listener／所有Browser Process→終了後観測 | Direct Boundary | 応答しないが接続を受理するListener、close後の接続拒否、不正Port、遅延正常終了するProcess、Signalまで残るProcess、親終了後も残る子Process、同じPIDと異なる世代Identity、未検証Identity、順不同の親・子・孫、および前段cleanup失敗 | TCP接続状態と所有Process終了を局所境界で観測する。終了要求直前にTreeを再取得し、正常終了期限後だけexactな世代Identityを再確認してGraphの深い順にFallback Signalを発行する。cleanup段へ失敗を注入する | present／absent／unknown、normal／sigterm／sigkill／unknown、子孫Fallback有無、Signal順、Tree不存在、cleanup実行順および集約Errorを相互に区別して記録する | 接続拒否だけを不存在とし、timeout・分類不能をunknownへ保つ。親終了後に残る子Processへ限定Fallbackを実発行して最終0件を確認する。同じPIDでも世代Identity不一致または安全なIdentity未確認ならSignal Effect 0とする。残存Processは孫→子→親の順に処置し、一段のcleanup失敗後も後続清掃を各一回試行して全Errorを集約する | ERB-IT-020、Listener三値反例、遅延正常終了、SIGTERM fallback、残存子Process fallback、世代Identity不一致／未検証Effect 0、深度順、cleanup失敗後の後続段実行、Error集約、Oracleおよび終了後状態を保存する。Port、PIDおよび実行Pathは保存しない | Test Listener 0、所有Child Process 0 | Automated |
| `ERB-IT-021` | 境界 | IT | Workbench Production Shell | Repository／Remote CROS→Workbench Server→Browser相当Consumer | Direct Boundary | 検証済みRepository Root、公式Logo、固定Route、許可済みPortfolio、明示選択Repository、Project検索・状態・Cursor、Topic／Meeting Query・Relation・昇格入力、Repository Tree／Diff Query、Orchestrator現在状態、Execution Event、Remote Credential／Exposure、AI Profile、AI依頼種別、根拠参照付きAI結果、変更候補の安全な確認MetadataとCandidate ID、採用／破棄／保留、確認有無、HEAD、Allowlist外Path、不許可Methodおよびclose | Workbenchを一時Portで開始し、Shell、CSS、Logo、Health、Portfolio検索・状態絞込み・継続読込・Project Detail、Repository未選択時のTopic／Meeting非表示、選択RepositoryのRemote Topic／Meeting一覧・Detail・更新・Owner Repository付きRelation遷移、Repository単体のTopic／Meeting絞込み・実在CHGへのTopic昇格、Repository Tree遅延展開・File Diff、Runtime Activity継続読込、AI依頼の読取り助言／変更候補と項目別根拠参照、変更候補の確認・採用・破棄・保留、別Candidate IDと確認なしの拒否、Remote接続・失効および拒否入力を要求して終了する | Bind Address、Status、Header、Brand Asset、Shell内状態、Portfolio表示Project・Source状態・Query拘束Cursor・Source別五場面・欠測表示、選択Repository、Topic／Meeting Query保持・Detail Revision・Relation存在状態・Owner Repository・遷移先・更新先・昇格後状態、Tree Directory・Cursor・変更区分・Prepared／Working Patch・切詰め、Project限定Event順序・Cursor、AI Applicationへ渡したProfile ID・依頼種別・結果区分・根拠参照表示、変更候補のCandidate ID・確認Metadata・選択Action・確認有無・採否結果、Remote Readerへ渡したRepository集合、失効後表示、拒否結果、Healthおよびclose後Connectionを記録する | `127.0.0.1`だけへBindし、Direction A Shellと承認済み公式Logoを固定Routeで返す。Portfolioは許可済みProjectだけを安定順序で検索・状態絞込みし、検索条件へ拘束したCursorで最大20件ずつ読む。別条件Cursorを拒否し、選択ProjectはRepository Sourceごとの五場面を表示してmissingを完全状態へ畳まない。Topic／MeetingはQuery条件に一致するCanonical Recordだけを安定順序とQuery拘束Cursorで表示し、Detailは同じRevisionのCanonical Markdownへ戻れる。Remoteでは現在PortfolioのRepositoryを明示選択するまでTopic／Meetingを表示せず、選択RepositoryだけをMCPへ渡す。Grant外ID、取得失敗または未選択をLocal Repositoryの結果で補完せず、別RepositoryのRelationはMCPが返したOwner Repositoryへ明示切替する。Repository単体では実在Topic／Meeting／CHGだけを固定Routeへ接続し、欠落Relationをリンク化せず、任意Pathを受けない。Topic昇格は実在CHGと期待改訂を確認し、状態・Relation・終了表を一つの次版へ更新する。Repository TreeはDirectory単位で遅延展開し、選択FileのPrepared／Working差分を分離する。越境Path、別Directory Cursorおよび未追跡File内容の暗黙読取りを拒否する。Runtime EventはProject限定・上限付き・新しい順で読み、観測不能を0件へ畳まない。AI依頼はProfile IDと読取り助言／変更候補をApplicationへexactに渡し、各結果項目の本文と一件以上の根拠参照を同じ区分へ表示する。読取り助言を変更候補へ読み替えない。変更候補はStoreから再読取りした同じCandidate IDと安全な確認Metadataだけを表示し、採用・破棄ごとの明示確認を必須にする。別Candidate ID、確認なし、競合RevisionまたはScope不一致を拒否し、保留ではEffect 0とする。採用操作はCommit／Pushを発行しない。RemoteではGrant外RepositoryをReaderへ渡さず、失効後に直前の現在状態またはEventを表示しない。任意Repository Pathと書込みMethodを拒否する | ERB-IT-021、固定Route分類、Status、Security Header、Brand Asset読込、Portfolio Query・Cursor・Project Detail・Source欠測、選択Repository、Topic／Meeting Query・Detail・更新先・Relation Owner・遷移先・Topic昇格、Repository Tree／Diff、Runtime Event Page、AI Profile ID・依頼種別・結果区分・根拠参照表示、変更候補のCandidate ID・確認Metadata・Action・確認有無・採否結果、Remote Grant、Local fallback 0、未接続／観測不能表示、拒否結果、close後Connection拒否およびOracle判定を保存する。Prompt、AI結果本文、Candidate本文、Absolute Path、File内容全量、Logo bytes、Tokenおよび生Event内容は保存しない | 未選択／Grant外Repository Effect 0、Local fallback 0、Listener 0、Connection 0、Credential永続保持0、確認前AI候補採用0、Commit 0、Push 0 | Automated |
| `ERB-ST-022` | 境界 | ST | Workbench Actual Browser／Visual Gate | Workbench Production Server→専用Browser Profile→Rendered DOM観測 | System/E2E | 固定したProduction Source、公式Logo、Desktop／Tablet／Mobile、100%／200%／400%、文字下限、操作対象下限、画像読込、Overflow、Focus順、Browser正常終了猶予および所有子Process残存 | Production Serverを起動し、各Profileと倍率で主要Screenを実Browser表示する。必須画面TargetのReact commit後に画像集合を取得して確定を有限時間待ち、終了時は終了直前Tree取得、正常終了、exactな世代Identity限定Fallback、最終不存在確認を順に行う | Browser版、Profile、倍率、実効Viewport、Scroll幅、最小文字、最小操作対象、画像成功・失敗、Focus順、未接続状態、終了経路、子Process fallback有無、終了処理・Tree観測所要時間および全資源終了を記録する | 公式LogoとDirection Aの情報階層がReactで表示され、Server Shell、未接続、描画途中または画像読込み途中を成功扱いせず、評価した不適合を隠さない。PIDだけで別Processを終了せず、正常終了猶予後も残る同一世代Identityだけを限定処置し、最終不存在を確認する。人間が許容したProfile不適合は理由と範囲をEvidenceへ残す | ERB-ST-022、固定Revision、対象Profile、倍率、集約測定値、Brand Asset結果、許容判断、終了経路、fallback有無、終了所要時間、Oracleおよび資源別終了後状態を保存する。DOM本文、Absolute Path、PIDおよびProfile Pathは保存しない | Browser Process Tree 0、専用Profile 0、Workbench Listener 0、Repository書込み0 | Hybrid |
| `ERB-UT-023` | 境界 | UT | AI Request Mode Router／Advice Task／Send Dispatch／Result Parser | Workbench AI Application入力→一依頼の外部送信確認→内容Hash付き許可済み読取り投影→Coordinator Mode Router→専用Dispatch→依頼種別別Executor→許可済み参照へ拘束した結果正規化 | N/A | 読取り助言、変更候補、既定CatalogのRevision 0、負数・小数の不正Revision、不正種別、余分なKey、送信未確認、Effect前取消、Effect後取消競合、Provider例外、cleanup不明、未知Request ID、投影Hash不一致、秘密Prompt、越境参照、Repository Operation結合不能、Mount Grant発行時観測と消費直前fresh観測、再観測不能、初回Selection失効失敗、不正な再Selection、Selection意味差、根拠参照なし・投影外参照・重複Key・複数JSON・過大値を含む不正入力／結果 | 固定投影、検証済みProfile、Catalog Revision、Fake Provider Adapter、Fake Executorおよび生結果文字列を注入し、Execution Plan、Task Packet生成、Repository Operation結合、Authority消費、初回Selection、Mount Grant発行、Provider Home再観測、Grant消費、旧Selection失効、Effect直前Selection再発行、Packet発行、Recovery登録、Process開始、観測、取消、Grant失効、Operation cleanup、単一JSON正規化および不正結果の帰還を要求する。Repository StoreからConsumerまでのRevision 0搬送は`RCM-IT-005`で補完する | 選択Executor、Profile ID、Provider、Catalog Revision、依頼種別、送信確認、投影Hash、Task Hash、許可済み参照、Request ID、Repository結合、発行用観測Capabilityと消費用fresh観測Capabilityの分離、Grant失効件数、Grant消費件数、初回／再発行Selection、Packet／Recovery／Processの発行件数、Effect件数、cleanup件数、Process poison件数、状態、理由、結果区分、項目別根拠参照および生出力非公開を記録する | Revision 0は検証済み既定Catalogの初期Snapshotとしてexactに保持し、負数・小数は実行計画前に拒否する。読取り助言Operationを元Repository Identityへ結合できなければSelectionを発行しない。この結合からProvider Mount、Path搬送または任意読取りAuthorityを生成しない。初回SelectionをProvider／ProfileのMount照合前に発行し、Mount Grant消費後に失効する。同じ入力からEffect直前に再発行し、Provider、Profile、Model、推論強度、速度および選定理由が初回と完全一致する場合だけPacketへ進む。発行済みSelectionは意味検証前からcleanup対象として保持する。不正な再Selectionまたは意味差では新旧Selectionを失効し、Packet／Process／Provider Effectを0、Operation cleanupを1とする。初回Selection失効が再試行後も不成立なら、Operation cleanup成功だけを全体cleanup成功へ畳まずProcessをpoisonする。Mount Grant発行に使った一回限りの観測Capabilityを消費時に再利用しない。fresh再観測が不成立なら、未消費Mount Grantと初回Selectionを各1回失効し、Grant消費、Packet、Recovery、ProcessおよびProvider Effectを0、Operation cleanupを1、Process poisonを0にする。送信確認は同じTask Hash、Catalog Revision、Profile ID、Providerへ結合して一回だけ消費し、未確認・Effect前取消ではProvider Effect 0、Effect後取消・Provider例外・cleanup不明では自動再送0かつunknownとする。読取り助言と変更候補を別Executorへ一回だけ配送し、取消後の遅延完了でcancelledを上書きせず、未知Identityへ架空ProfileまたはModeを返さない。各結果項目は本文と一件以上の許可済み根拠参照を持ち、曖昧JSONや不正結果を部分公開しない | ERB-UT-023、固定入力分類、Catalog Revision境界、投影完全性、Task Packet、Repository Operation結合、Authority Scope、Grant発行用観測と消費用fresh観測、初回／再発行Selection、選択Executor、公開Snapshot、不正結果分類、許可済み参照集合、Grant失効・消費、Packet、Recovery、Process、Provider Effect、cleanupおよびProcess poisonの件数とOracle判定を保存する。Prompt、投影本文、Repository Path、AI結果本文および生Provider出力は保存しない | Fake Provider以外の外部Effect 0、Repository結合不能時のSelection 0、再観測不能時の未消費Mount Grant失効1、初回Selection失効1、Grant消費0、Packet発行0、Recovery登録0、Process開始0、Provider Effect 0、Operation cleanup 1、Process poison 0、不正再Selection時の新旧Selection失効2、初回Selection失効継続失敗時のcleanup未確認とProcess poison、Filesystem Effect 0、候補生成0、候補採用0、自動再送0、取消後状態上書き0、不正結果の部分表示0、生Provider出力公開0 | Automated |

`ERB-UT-023`では、Workbenchの明示AI実行をSelection不要の`none`へ畳まない。`beneficial`／`explicit_user_delegation`、明示Provider／Profile、Coordinator役割およびOperation Identityを要求fieldとして検査する。Productionが生成した初回・再発行要求を実Selection Runtimeへ直接渡し、旧Grant失効、新Grant消費およびProvider準備境界まで確認する。Mockが発行済み結果を返すことだけをProduction契約成立の根拠にしない。

`ERB-UT-023`の助言初期化失敗では、下位作成境界の清掃確認true／false、分類のない例外および取得済み参照あり／なしを分ける。Operation未返却だけで清掃未確認へ読み替えず、既知trueは維持、false／未知は停止とする。初回Runtime結果の私有分類、元結果Objectへの結合、copy後の非結合、公開JSONへの参照非漏えい、Provider開始0およびpoison要否を観測する。これは現在Process内の初回結果までの契約であり、後段投影・Request Owner・fresh Process再入場、実資源不存在または実清掃成功の証明にはしない。

`ERB-IT-021`のNode実行閉包ケースでは、Workbench CLI入口とRuntime value import／re-export／literal dynamic import Graphを固定入力とし、type-only参照を実行依存へ数えず再帰走査する。到達Source、外部module specifier、`.tsx`および`client/`到達を観測し、Serverへ到達する一方でBrowser描画Module、`.tsx`、`client/`および`react`／`react/*`への到達が0であることをOracleとする。Evidenceには固定Tree、入口、到達Source集合Hash、外部module集合、除外したtype-only宣言数、禁止到達件数およびOracle判定を保存し、Source本文と絶対Pathは保存しない。

`ERB-IT-021`のBrowser Bundle配布閉包ケースでは、再編後の`40_Develop/workbench-server/dist/client/assets/workbench-client.js`を固定Pathとし、次の段階を分けて確認する。BundleはWorkbench配布物の入力であり、Coordinatorの署名実行閉包へ無条件に含めない。以下は新配置に対する検証計画である。旧配置でのBuild成功は過去の根拠として保持するが、新配置の成功へ流用しない。

| 段階 | 条件・操作 | 観測 | Oracle | 現在状態 |
|---|---|---|---|---|
| 1. Build／Git追跡 | Vite Buildを実行し、固定Pathの生成物とGit追跡集合を確認する | Build結果、固定Pathの存在、`git ls-files`の収載、追跡Bundle差分 | Build成功、固定Pathが通常Fileとして存在し、同じPathがGit追跡対象であり、再Build後に意図しない差分がない | OPEN — 新配置への移管後に確認 |
| 2. Source Commit収載 | 固定候補CommitのTreeを確認する | Commit、Tree、固定PathのBlob | 固定Pathが配布元のSource Commitへ収載されている | OPEN — 移管Commit後に確認 |
| 3. Workbench配布物収載 | 固定Source Commitから提供するWorkbench配布集合を確認する | Source Commit、固定Path、Asset Hash、配布集合 | 配布集合にSource Commitと同一の固定Bundleが存在し、起動時Buildや未追跡追加を必要としない | OPEN — 新配布集合で確認 |
| 4. 配布Runtime直接起動 | Build Toolchainを持ち込まず、Workbench配布入口を起動する | Runtime import Graph、HTTP起動、Shell／Asset応答、終了後Listener | Node RuntimeがReact／Viteへ依存せず、固定Bundleを配信して直接起動でき、終了後Listenerが残らない | OPEN — 新配布入口の直接起動で確認 |

Evidenceには各段階のCommit／Tree、固定Path、Asset Hash、Git追跡判定、Runtime外部module集合、HTTP応答、終了後状態およびOracle判定を保存する。Source本文、絶対PathおよびBundle本文全量は保存しない。前段Passから後段成立を推定せず、旧署名候補を新しい配布閉包の根拠へ流用しない。

初回起動期限後にDocker Processが残存する実環境反例では、`ERB-ST-009`は停止前のEngine Probe TimeoutをEngine停止と同一視せず、既知2領域のexact lockとProcess集合を継続入口で確認する。同じRepair ID内で停止意図を耐久化し、停止Effectを一回だけ発行して、Engine既知停止とProcess不存在をfreshに確認した後にだけ二領域退避へ進む。既に不存在なら停止Effectは`not_issued`で閉じる。Engine状態不明、部分停止、観測不能、取消またはIdentity不一致ではrenameと再起動を0件にし、条件別理由と同じ回復義務を保持する。旧形式の3 Effect継続記録は、成立済み段階を再発行せず現行の4 Effectモデルへ読取り投影できることも検証する。

`ERB-ST-022`の機械観測部分は、[Phase 5 Workbench実Browser Visual Gate](../../../99_Roadmap/Changes/CHG-000082/Evidence/260928-1028_phase5-workbench-actual-browser-visual.md)で15画面、3表示Profile、3 Zoomの27条件を不適合0・許容例外0で完了し、[純粋CSR移行](../../../99_Roadmap/Changes/CHG-000082/Evidence/260928-1745_phase5-workbench-pure-csr.md)で全画面DOMのBrowser React所有への移行後も同じ27条件を再観測した。人間UAT、実Provider E2EまたはShared Server配置の成立へは読み替えない。

公式CLI移行では内部改造024～029の成立を現行保証として要求しない。公開配布と起動は031、通知分類は023、公開取消・親喪失と終了後資源は030で確認する。公式設定だけを操作不存在の証明にせず、Docker境界の観測と実Provider E2Eを別々に保持する。

## Semantic Coverage Pilot

この表はQuality Local Itemが検証する設計上の意味だけを正方向で宣言する。逆方向の一覧は生成し、本文の類似表現から推測しない。

| Local ID | Semantic Key |
|---|---|
| `ERB-ST-005` | `coordinator.external-boundary-diagnostics` |
| `ERB-IT-006` | `coordinator.provider-selection-boundary` |

## 5. 段階的結合と評価

固定Fakeによる状態遷移、実CLI／Processとの直接境界、関連1〜2 block、必要な公開入口STの順で確認する。低い層のPassを実AI Provider、実Network、課金、公開Capabilityの成立に流用しない。

PT／LTは人間が明示した上限と停止／cleanup条件をrunnerが強制できる場合だけ実行する。

## 追加試験種別の適用

| 種別 | 適用 | 確認する範囲 | 実行許可 | 未実行時の扱い |
|---|---|---|---|---|
| RT | Required | 変更した意味と利用側から、再実行する既存Local Itemを選ぶ | Changeの通常検証範囲 | 未選択の範囲を明示し、選択した回帰の結果で評価する |
| PT | Conditional | 対象、負荷上限、費用／Credit上限、中止条件および清掃条件を事前に固定した場合だけ設計する | Human Explicit Authorization | 未実行をPassへ読み替えず、明示的なRelease条件でない限り通常監査を停止しない |
| LT | Conditional | 対象、継続時間、資源／費用上限、中止条件および清掃条件を事前に固定した場合だけ設計する | Human Explicit Authorization | 未実行をPassへ読み替えず、明示的なRelease条件でない限り通常監査を停止しない |


## UI／SPEC Detailからの観測条件

Source Definition由来の検証義務を維持し、Detailは具体的な観測境界として同じ検証目標へ統合する。

| Detail Source | Source Definition | 追加する観測条件 | 処置 |
|---|---|---|---|
| [SCR-000005／PRT-000005](../../../04_UI/Details/Areas/operation/SCR-000005/screen.md) | UI-000005 | 情報、操作、Feedback、状態、失敗、Unknownおよび回復をScreen／Part境界で観測する | Mapped |
| [SCR-000010／PRT-000010](../../../04_UI/Details/Areas/configuration-trust/SCR-000010/screen.md) | UI-000010 | 情報、操作、Feedback、状態、失敗、Unknownおよび回復をScreen／Part境界で観測する | Mapped |
| [BHV-000009](../../../05_SPEC/Details/BHV-000009/behavior.md) | SPEC-000009 | Trigger、Authority、Validation、State、Effect、Result、FailureおよびRecoveryをBehavior境界で観測する | Mapped |
| [BHV-000015](../../../05_SPEC/Details/BHV-000015/behavior.md) | SPEC-000015 | Trigger、Authority、Validation、State、Effect、Result、FailureおよびRecoveryをBehavior境界で観測する | Mapped |

担当Interaction Relation: `PRT-000005.spec-000009`、`PRT-000010.spec-000015`

全数Coverageと試験段階の扱いは[UI／SPEC DetailのQuality分析](../../Analysis/Detail/quality_analysis.md)を中央統合投影とし、本定義は上記Relationの検証責務を局所所有する。

## Host残存の限定回復に追加する観測条件

[Coordinator詳細設計§11](../../../06_Architecture/Details/coordinator/01_Architecture.md#元の回復参照を確定できないhost残存の保守候補)の限定経路は未完成である。内部PolicyのUTとは分け、次の既存検証義務に観測条件を追加する。記載だけでは実施済みまたはCoveredとしない。

| Local Item | 追加する反証・観測 | 終了後条件／現在状態 |
|---|---|---|
| `ERB-IT-001` | 選択ユーザー・Root・marker・全六childのexact結合、処置前のfresh再確認、限定削除と直接不存在観測。 | 全対象の明示不存在と全handle／observer／Lock解放を別々に確認する。OPEN: 実処置未接続。 |
| `ERB-IT-002` | Identity差替え、非空child、未知child、別状態、Docker結合、使用中、初期化中および承認不一致。 | 処置前の拒否ではFilesystem／Provider Effect 0。OPEN: 実境界の拒否未観測。 |
| `ERB-IT-003` | 部分清掃後のProcess喪失と同一対象への再入場。新しいfresh承認と保護済みlineageを検証し、既に処置済みの対象を別物へ置換しない。 | 発行済みEffect、残存対象、回復義務を保持する。OPEN: 保護済み再入場未接続。 |
| `ERB-IT-004` | 旧形式のproducer／consumer観測が不完全、Lockだけ取得可能、markerだけ存在、非使用・不存在観測不能。 | unknownを非使用・不存在へ畳まず、追加Effect 0で停止する。OPEN: 実観測未接続。 |
| `ERB-ST-030` | 将来の正式入口で、同じ実残存クラスを安全なfixtureとして発生させ、対象提示→承認→fresh確認→処置→最終観測を相関する。 | 新Provider依頼とDocker永続データ削除0。全資源不存在またはexactな回復義務を保持する。OPEN: 公開入口未接続。 |
| `ERB-UAT-007` | 元Taskの回復権限と新しい限定保守承認の違い、実在対象と対象外、拒否時の理由を利用者が理解できるか確認する。 | 承認だけを実行・清掃完了へ表示しない。OPEN: 利用者確認未実施。 |

Coordinator所有範囲で終了・排他・清掃を閉じる設計では、上表の既存Local Itemへ次を追加する。Windows再起動やDockerの空一覧を合格条件の代替にしない。

| Local Item | 所有範囲方式の追加観測／反証 |
|---|---|
| `ERB-IT-001` | 作成前の利用抑止から、所有処理の実終了、同じ対象の排他、処置と不存在確認、全Lock／handle解放までの順序を観測する。現在は未接続。 |
| `ERB-IT-002` | 初期化中、診断・通常回収の競合、取消後の遅延取得、所有子Process残存、対象外Processの巻込みを別に反証する。処置前に拒否し、既存の他Operationへ停止・削除を発行しない。 |
| `ERB-IT-003` | 親Process喪失、利用抑止または排他喪失、部分処置後の再入場を確認する。前回の非使用結果を再入場時のfresh観測に流用しない。 |
| `ERB-IT-004` | 新しいLock導入後も旧形式を使える旧版／複製Runtime／別入口の未確認があれば停止する。Process名・件数0、空Root、Docker資源なしまたはhandle取得だけを非使用根拠としない。 |
| `ERB-ST-030` | 公開入口へ接続する段階で、上記の取得・診断・通常回収・保守の母集団が同じ所有境界へ接続しているか確認する。OS全体の再起動や全Docker処理停止を暗黙に要求しない。 |
| `ERB-UAT-007` | Coordinator所有の対象だけを提示し、元Taskとの対応が不明でも出所不明の任意フォルダと混同させない。実停止や削除には別の対象・影響確認が必要と理解できるか確認する。 |

### 終端記録の保存・再入場で追加する反証

対象一式の私有Readerは[Platformの読取り契約](../../../06_Architecture/Details/platform-access/01_Architecture.md#対象一式の私有読取り接続)に従う。`ERB-IT-001`でnamespace三実体＋Root／marker／固定六childの十一実体、元marker全bytes／EOF／前後長とHash、独立Known照合、新八handleの逆順終了を確認する。`ERB-IT-002`で全位置の各五field・属性、全pair重複、種別／reparse、名前と利用者・Hash差、八取得位置の欠落、markerの0／65536／65537bytesを反証する。`ERB-IT-003`で途中取得・読取失敗とclose不明の併発、元理由・位置・取得数・個別終了保持、追加保存停止を確認する。実OS刺激と合成終了モデル、現在観測と独立期待値、対象Reader終了と外側guard／Process終了を分ける。既存8KiB記録Readerへの影響は同じ改訂版の実保存回帰で確認する。現在観測は原子的Snapshot、空状態・未知child不存在、非使用、`host_only`意味、正式承認または清掃成功を保証しない。Local Item数・全体観測数・品質状態は維持し、属性なしcodec、初期化、全legacy互換、公開Protocolと実残存処置は別の未成立条件として追跡する。

固定保存境界の私有観測では、`ERB-IT-001`にOS所在候補と独立fixture親の一致、三実体・二ACL・選択利用者の結合、保持後verifyと個別終了を接続する。`ERB-IT-002`で三位置の各五field、重複実体、利用者Hash、recovery／terminalそれぞれの欠落・file／reparse・ACL、返却長とUTF-16を反証する。`ERB-IT-003`ではToken部分取得、途中openとclose不明の併発、元理由・各個別終了の単調保持と追加保存停止を確認する。純値検査、実体試験、実OS故障は別に記録し、未観測の位置を合格へ畳まない。一般利用者Profileが必要な実体試験は制限Token環境で受理条件を弱めず、固定Ownerの通常利用者実行と分ける。Local Item数・観測済み件数・全体品質状態は変更しない。

[Coordinator詳細設計の候補契約](../../../06_Architecture/Details/coordinator/01_Architecture.md#終端記録の保存再入場の候補契約)について、通常清掃と元参照不明の限定保守を別producerとして確認する。次は検証設計の追加であり、実施済み結果ではない。

Nativeの共通排他では、`ERB-IT-001`の同threadでの取得・fresh保護・同期区間・release／close、`ERB-IT-002`の再帰取得、別thread／別Process競合、属性・日時差による別排他への逃避、descriptor不一致・同名別object・有限timeout、`ERB-IT-003`のabandoned所有取得と保存拒否・終了不明の単調保持を分けて観測する。実OS反証と注入した失敗は区別する。これらの排他区間だけでは容量計数・全producer・公開入口・旧対象の非使用は成立しない。Local Item数と観測済み件数は変更しない。

処置許可直前のAtomic判定について、判定前に別threadが終端不明を確定した場合はcallback0と取得済み所有のrelease／closeを確認する。判定後の不明は既許可処置の取消にしない。取得／処置Errとrelease／close不明の同時発生では、元の固定理由・終端理由・発行receiptを共同保持する。cfg(test)の順序制御と合成終端失敗を、実OS故障発生の証明へ昇格しない。

容量と保存の一体接続では、`ERB-IT-001`でMutex内の列挙→完全計数／全観測終了→予約→stage→公開照合→writer終了→Mutex終了の順序と正常終端後の再計数を確認する。`ERB-IT-002`で同参照既存、未知名、Directory／reparse、公開0byte、過大file、保護・共有拒否、途中列挙不明、上限・overflowを反証する。0byte stageと同実体の併存二名は物理名別に計数する。`ERB-IT-003`では各終了不明と公開失敗の組合せ、同参照・部分receipt・元原因の共同保持、追加保存停止を確認する。純境界Helperを実保存本体でも使い、少数の実列挙・保存と1024entry／8MiBの純判定を分ける。大規模物理列挙、合成close故障、unwind、非参加producer・別session・公開consumerの未観測を合格へ畳まず、Local Item数・観測数は変更しない。

| Local Item | 刺激・観測 | Oracle／終了後条件 |
|---|---|---|
| `ERB-IT-001` | 固定保存境界、Windows所有者／アクセス制御、処理中の差替え防止、完全書込み・flush・no-replace公開・両名の同一実体／bytes確認を実境界で観測する。 | 呼出し成功やmode値を保護・確定の代替にしない。stageを直接不存在へ収束してからRoot処置へ進む。未確認は追加Root／marker処置0。 |
| `ERB-IT-002` | 公開先EEXIST、保護不明、別Identity／bytes、未知entry、8KiB・1024entry・8MiBの各境界、stage二名の計数と並行受付を別に与える。 | 既存対象上書き0、別参照再発行0、容量超過0。既存参照読取りは可能だが、新記録を要する回復Effectは上限を迂回しない。候補値は実装固定前に再確認する。 |
| `ERB-IT-003` | 最初の記録Effect前、stage途中、flush後、公開直後、read-back後、stage除去後、Root部分処置後、marker消失後、lease終端不明でProcess喪失／取消を与える。 | callerの耐久接続から同じ参照へ再入場できる。stageのみ／同一実体二名／公開先のみ／不一致を区別し、fresh権限・対象・非使用・排他なしには追加処置しない。Power lossをこの結果へ含めない。 |
| `ERB-IT-004` | 通常producerの元exact関係と、保守producerのsnapshot／保守選択Identityを取り違える。旧Token／旧nonce復元、別leaseだけによる非使用主張を反証する。 | 記録からAuthority発行0、元Task再開0。元参照不明を新しい自動回復許可へ畳まない。 |
| `ERB-IT-003` | Root・marker・leaseの共同終端後に、Evidence引渡し失敗、Receipt不一致、参照中、記録清掃の部分成功／観測不能を与える。 | 引渡し先の実bytes・Identity確認前は原記録削除0。清掃不明は同じ管理対象へ残し、元Task再開や清掃記録の再帰生成0。原記録／stageの直接不存在と管理用資源の終端を確認する。 |
| `ERB-ST-030` | 全利用側移行後、公開入口の失敗結果から耐久参照、再入場、共同終端、Evidence引渡しへ追跡する。 | marker消失後も許可された利用側へ同じ非Authority参照を返す。境界外には対象の存在・参照を開示しない。内部試験だけで公開経路の成立を宣言しない。 |

現在は全行OPENである。実装上の発生点と観測手段を固定してから実境界へ接続する。局所のSchema／順序試験は`PRL-UT-006`が所有し、ここで求める保護・Filesystem・Process喪失・公開入口の成立を代替しない。

`host-terminal-caller-checkpoint.integration.test.ts`は上記のうちRepository-local caller保存だけを自己生成Git Rootで確認する。完全bytesの保存・同参照fresh Process読取り・反復保存、異なるbytesの衝突、独立binding差、部分stage保持、未知inventory、1023物理entryからの2entry予約拒否、同一／別Processのnamed pipe競合、取得前／取得中取消、所有Process終了後の再取得を対象とする。固定Windows実環境profileへ分離し、portableでのskipをPassに数えない。Native固定namespace・ACL・共通容量、caller保存途中の全故障点、Power loss、実残存三件、公開入口とEvidence移管／管理清掃はこの試験から成立を主張しない。

準備Ownerの接続では、同じ試験で検証済みRoot、閉じた入力、三結合Hash、取消済みSignalと固定実行Contextの前提拒否を確認する。取得済み参照の保持、Native起動・caller保存前の停止、Accessor非実行、caller記録Directoryの直接不存在を観測する。この確認は前提拒否だけを証明する。実NativeのCurrent／Known観測から完全intent・caller保存までの正常経路、二呼出し間／保存待機中の変更、保存後取消、搬送例外のEffect不明保持は、実経路の接続確認で別に照合する。準備済み表示を非使用、人間承認、Native公開保存、清掃またはLocal Item全義務成立へ読み替えない。

Native保存接続のCaseは、未保存・正常caller・独立binding差・取消・canonical破損を自己生成Repositoryで評価する。正常callerだけがfresh読取り後にAdapterの固定実行Context検査へ達し、無効ContextでProcess／記録Effect 0を保持する。専用保存CLIのCaseは不正要求・観測mode混用・余分argvを実childで拒否し、receiptなし・取得0を確認する。これらは取得前拒否の根拠であり、実Native正常保存・実三件への適用を証明しない。

`PRL-UT-006`の保存搬送Caseは、十一Known値・本文・nonce・同参照の要求形状、応答の完全性と上限、計数・公開・Mutex／writer／外側closeの共同成立、および部分保存receiptの保持を合成入力で確認する。Native保存区間の実target差替え、実close故障、返却喪失、正常保存と同参照再入場は接続確認で別に観測する。Source接続や拒否試験を全RecoveryのPassにしない。

同じLocal Itemの読戻し搬送Caseは、Prepared／Publishedの現在観測、同bytesの別実体を過去Identityへ昇格しないこと、対象未試行、nonce・同参照・完全形状の拒否、およびReader／外側close不明時の部分結果保持を合成入力で確認する。`ERB-IT-001`の専用CLI拒否Caseは不正要求・保存mode混用・余分argvを実childで拒否し、記録取得・対象取得・変更なしを観測する。caller結合Caseは完全文書・独立bindings・前後再確認と未検証実行Contextの拒否を確認する。正常なNative読戻し、Root消失後の実再入場、非使用・承認・限定清掃は経路全体の実境界確認へ残し、これらの局所結果から観測済み件数や全Recoveryの合格を更新しない。

`windows::terminal::tests::terminal_publication_fixture`は、[Native内部保存部品](../../../06_Architecture/Details/platform-access/01_Architecture.md#host終端記録の内部保存部品)の現在のpublish本体を自己生成したRepository-local対象で通す限定ITである。`ERB-IT-001`の完全write／flush、同writer保持中の非置換rename、stage直接不存在、public実体・ACL・全bytesと個別close、`ERB-IT-002`の既存先衝突・前後不変、重複要求拒否、8192／8193bytesと保持中変更拒否を対象にする。通常のcargo testからはignoredとし、専用Ownerが固定cwd、入力とbinary Hash、freshなfixture不存在を確認して一回だけ実行する。新run・新閉packetへ部分receiptと個別closeを搬送し、自己生成三fileと空Directoryの非再帰清掃・直接不存在を別に確認する。途中失敗では追加清掃せず保持して停止する。

このfixtureはNativeのopaqueな非秘密bytesの保存を検証し、上位Schema、元Task Authority、非使用、caller耐久性、容量、固定OS namespace、Process喪失／再入場、旧二名の移行、close後不変性または署名Runtime／公開入口を検証したことにはしない。stage不存在は観測時点の事実であり、後続の新規作成禁止にしない。旧r1／r2／r3のhardlink結果は履歴として保持し、新rename結果へ付け替えない。未観測は保持し、この登録からLocal Item全体やQuality件数を観測済みへ更新しない。

初回の保存・公開fixtureは失敗し、全Oracleは未成立である。専用の読取り診断は残った三fileの現在Identity・ACL・全bytesと明示closeだけを確認した。続く第一stageの保持診断は、write-open、DELETE-open、removeと非置換renameの四要求がerror32で拒否されたこと、および診断handleの明示closeを確認した。公開名側の保持中拒否、既存先衝突、過大入力の作成前拒否、四file清掃と初回失敗原因はこの診断から推定しない。結果は[限定保守の検証記録](../../../99_Roadmap/Changes/CHG-000082/Evidence/261002_host-orphan-recovery-design.md#保存試験r1の停止と診断)に接続し、全保存・公開fixtureをOPENのまま保持する。

構造化したr2の全局所試験では、公開名のDELETE access取得を拒否できない反例を検出した。予想外handleは明示closeされ、削除・改名・清掃は未発行だった。失敗段階、個別close、清掃発行数、現在の残存を保持し、総合closeを成功へ補完していない。公開名の保護を是正・実証するまで、保存部品全体のPass、既存三Rootの清掃および実Task再開へ進めない。

公開名の追加read guardで是正したr3は、同一Processの自己生成対象で両名の四拒否、既存先非置換、入力境界、個別closeと限定清掃後の直接不存在を局所確認した。r3の実行時は自己確認結果として記録した。同じ固定候補の限定独立確認結果は検証記録に接続し、Local Item全義務の成立とは区別する。guard取得前の候補公開を連続した名前保護へ昇格せず、取得不能・差替え・消失は同じreceiptに残してRoot／marker処置0とする。別Process、取得前の競合、caller再入場、stageの連続保護付き除去および本番接続はこの結果に含めない。Local Item全義務と品質件数は未観測を維持する。

既存三件に対する実処置承認は未取得であり、試験fixtureを理由にその領域を削除しない。Local Item数と観測済み件数はこの設計追加では変更しない。

`windows::terminal::tests::terminal_cold_observation_fixture`は、準備済みreaderと公開済みwriterを持つ別Workerの意図的Process終了後、親が同じ既知参照・五field／属性・ACL・全bytesをfreshに照合する限定ITである。期待exit 71／72とexact Process／Job終端を共同条件にし、timeout後の回収成功を期待終了へ読み替えない。二名、両不存在、内容・Identity不一致とDirectoryを拒否し、reader保持中のwrite／delete／remove／rename拒否、今回checked-closeと自己生成四file・二Directoryの非再帰清掃後不存在を別観測にする。

このfixtureは`ERB-IT-001`／`ERB-IT-002`と、`ERB-IT-003`の「意図的終了後の既知完全記録の再読取り」という限定区間だけを扱う。cfg(test)のwriter再取得は本番APIではない。metadata不明とclose結果の単調保持は、実readerが使う局所判定関数への合成入力で確認し、実OS故障とは別fieldにする。ACL異常、reparse、OS metadata失敗、実CloseHandle失敗、突然crash、rename途中、caller耐久再入場、初期化途中、署名Runtime／公開入口と実残存三件は未観測のまま保持する。Local Item全体、品質件数と停止Gateは更新しない。

`windows::terminal::tests::terminal_current_candidate_fixture`は、新しい自己生成対象で私有の現在候補readerを通す限定ITである。`ERB-IT-001`のprepared／publicの現在照合・保持中変更拒否・今回close、`ERB-IT-002`の二名／両不存在／内容／Directory／参照／byte容量拒否、`ERB-IT-003`の「同bytesの別実体を過去の元実体にしない」という区間だけを扱う。同じfixture名を再利用せず、固定Ownerがcwd・実入力・新binary Hash・fresh不存在を確認して一回実行する。

現在候補は旧Identityを入力しない。試験では独立した作成時IdentityをOracleだけに使い、同bytesの新実体を現在候補で観測しても、旧Identityのstrict readerが拒否することを確認する。意図した自己生成fileの改名・再作成は刺激として個別記録し、保持中の予想外変更と区別する。全Oracle・全closeの後だけfreshに照合した自作六fileと空二Directoryを非再帰清掃し、直接不存在を確認する。失敗／不明では追加清掃しない。

これは同一Processの現在観測とopaque bytes相関だけである。正規Schema／producer／対象binding、元file連続性、過去receipt、caller耐久再入場、別Process、ACL異常／reparse／OS観測故障／実close失敗、容量予約、Authority、実残存三件または全Recoveryを検証済みにしない。Local Item数・観測件数・停止Gateは維持する。File Relationの既存001／002／003と新Case／HelperのTrace和集合を別に照合する。

`ERB-IT-001`のNative CLI確認へ、専用`--host-terminal-observe`の不正要求、余分argv、標準modeとの混用拒否を接続する。専用不正入力は実exit 2・phase 1・取得0・stderrなしを観測する。この拒否試験は、正常な十一実体観測、署名配布物、回復Ownerの実呼出し、清掃または全Recoveryを証明しない。

`windows::terminal::tests::terminal_generation_exclusion_and_release`は、`ERB-IT-001`の実Windows排他境界を限定確認する。freshな自己生成UUIDだけを使い、同世代の重複取得拒否、別世代の独立取得、同handleの選択利用者／SYSTEM二ACE保護と解放後の再取得、全所有handleの明示closeを観測する。Filesystem、実残存、DockerとProviderへ接続しない。既存Node／Supervisorとの相互運用は次の専用Caseへ分離する。当初Processの終了、旧領域の非使用、最終処置の連続排他、署名Runtimeと回復経路全体は別の未成立条件であり、この局所確認からLocal Item全体やQuality集計を完了にしない。

`windows::terminal::tests::terminal_generation_node_interoperation`は、`ERB-IT-001`のNativeと同期Node Worker／非同期Supervisorの相互運用を確認する。Nodeの既存production Lockを[専用fixture](../../../40_Develop/coordinator/tests/fixtures/host-terminal-generation-worker.ts)から呼び、両経路でNative保持中のNode拒否、Native解放後のNode取得・解放、Node保持中のNative拒否、Nodeの明示解放・実Process終了後のNative再取得を順に観測する。Supervisorは本番の取得関数・往復確認・exit確認付き解放を使い、独自の代替Lockへ切り替えない。固定Node実行物のHash、通常のfile起動、最小環境、fresh UUIDと固定応答を使い、未知応答・終了失敗・解放不明を成功へ補完しない。fixtureはNative試験の支援資源であり、Node runnerの独立した検証項目へ数えない。

この試験はSupervisorの異常終了・IPC故障、旧版consumerの再入場抑止、親Process喪失、実close故障、OS保存namespace、旧三件の非使用、最終処置の連続保持および公開Recoveryを検証したことにはしない。Local Item数・全体の観測済み件数・停止Gateは維持する。

`windows::terminal::tests::terminal_disposition_fixture`は、`ERB-IT-001`／`ERB-IT-002`のOS意味を実測するcfg(test)の限定試験である。固定Repository-localの自己生成親・Root・六child・markerだけを使い、親guardとfreshな同世代排他を保持して、通常`FileDispositionInfo`の要求受理、対象handle明示close、直接不存在を区別する。非空childの拒否と、互換readerが残るmarkerを不存在にしない反例を含む。Root不存在→marker不存在→世代解放の順を確認し、成功時だけ自作の空親を非再帰清掃する。途中失敗では取得handleの終了を試し、自作物を保持する。通常cargo testからはignoredとし、固定cwd・run指定・fresh不存在を確認したOwnerだけが実行する。

この実測はAPIの適用可能性の確認であり、本番の最終処置、未知child全数照合、旧三件の非使用・削除、固定OS namespace初期化、承認Owner、署名Runtimeまたは公開Recoveryを成立済みにしない。必要なLocal Item数、品質集計と停止Gateは維持する。

### 既知7バイトfileの同handle観測

`ERB-IT-001`で、検証・保持したworkspaceと祖先から固定`fixture.txt`をshareREADで開き、同handleのdisk種別・非Directory／非reparse・リンク数1・7bytes・全bytes／EOF・固定Hash・前後Identityを確認する。Known再照合、観測失敗後の初回close、親guard終了と自作対象の直接不存在を別々に観測する。`ERB-IT-002`で欠落、Known実体差、7bytes内の異内容、6／8bytes、hardlink、既存write／delete handleとの共有競合、Directoryとreparseへの代替を反証する。reparse作成不能の場合は理由と未観測を残し、拒否済みにしない。

`windows::terminal::tests::terminal_known_file_fixture`は固定cwd・run・freshなRepository-local自己生成対象に限定した局所ITである。通常のcargo testではignoredとし、明示Ownerが一回実行する。互換readerが存在しても観測が成功する反例を含め、その成功を非使用証明にしない。保持fileのReaderを終了した後の値は、将来の清掃まで連続保持した根拠ではない。十二実体共同観測と専用Protocolは次の対象一式のCaseで別に確認し、保存・読戻し、旧三Rootの非使用、fresh承認、最終処置・公開Recoveryの義務は未成立のまま残す。

`windows::terminal::tests::terminal_target_fixture`の既知file区間で、九対象handleの同時保持、十二実体Current／namespace-Knownの専用応答、独立した全十二対象Knownの共同照合と個別closeを観測する。十二位置の六field、選択利用者、marker Hash、file長・リンク数・Hashの77差替えは、位置・元理由・九対象closeを保持して拒否する。file内容差と欠落も位置11で拒否する。Knownの比較は対象handle終了前に行い、読取り成功・全closeを未知entry不存在、非使用、保存済み、最終清掃の連続保持へ昇格しない。対象一式の自作物だけを清掃し、現在不存在を別に確認する。通常cargo testでのignoredと、固定Ownerによる実行を区別する。正常なCoordinator→Native搬送、R3保存／読戻し／caller接続、実残存回収と署名RuntimeはこのCaseの対象外である。

`ERB-IT-001`の専用CLI拒否Caseでは、十二実体の保存／読戻しmodeへ旧frame、欠落frame、逆modeおよび余分argvを実Processで渡す。正形状でも独立本文Hashが不一致なら、OS namespace取得前に同参照・nonceを保持して停止し、保存receiptなし・全資源取得0を返す。新しい`CRDDKW03`／`CRDDKB03`と内包`CRDDKR03`、実exit・child joinを確認する。これは拒否経路の実搬送であり、正常な固定OS保存、Root／file消失後の正常読戻し、caller再入場、署名Runtimeまたは全Recoveryの成立根拠ではない。

`ERB-IT-001`／`ERB-IT-002`／`ERB-IT-003`には既知file専用caller記録の実Filesystemと共通leaseの確認を接続する。自己生成Repositoryだけで、十二実体・file条件・完全正規bytesの保存とfresh読戻し、一致再入場の追加記録Effect 0、同参照別内容・旧形式の拒否、取消前の管理／記録Effect 0、lease終了とstage不存在を確認する。専用Native接続の前後で同じcaller bytesを再検証し、未検証実行ContextではProcess Effect 0で同参照を保持する。これらはRepository-local callerの確認であり、保護された固定OS保存、正常Native搬送、返却喪失後の本番再入場、旧三件の非使用・清掃、全Recoveryの成立とは区別する。

専用候補の準備bodyから、実際の自己生成Repositoryのcaller保存へ接続する結合確認を`ERB-IT-001`／`ERB-IT-002`／`ERB-IT-003`の限定範囲へ含める。検証済みRepository Rootと実Runtime Data resolver・正規codec・既存保存Ownerを使用し、同参照のfresh読戻し、一致再入場の追加記録Effect 0、lease終了とstage不存在を確認する。Native観測だけを合成値へ置き換えるため、正常Native観測・固定OS保存と公開Recoveryはこの確認の対象外として保持する。

実境界の保存場所確認では、本番と同じ固定環境でWindows一時領域を解決し、元対象の親実体と同じ境界へ結合できることを要求する。親Processの通常環境で成功しても、本番用環境での解決成功へ読み替えない。環境値の空指定、別場所への解決、取得不能、固定子Directory欠落を拒否例に含め、書込み・ACL修復・別場所へのfallbackを発行しない。OS保存場所の作成・変更は、exact Root、用途、所有者、保持・回復と人間承認を別に確定してから実行する。

今回の実所在確認では、同じ固定Native・frameを通常環境、旧一般Native環境、新Host専用環境で読み取り専用に比較する。所在取得、取得したToken／Directory／対象handleと個別終了を共同で評価し、診断の停止理由を正常保存の結果へ読み替えない。新環境が通常環境と同じ親へ達しても、保存子Directory欠落、旧対象の非使用、初期化許可と正常Native保存は別の未成立事項として保持する。未署名の開発実行物による診断を署名Runtimeの検証へ昇格しない。

共有管理先の保護付き作成は`ERB-IT-003`の限定観測へ含める。作成前に同Tokenの選択利用者・独立親実体・全非reparse chainを確認し、固定Recovery／Terminalだけを作成時からprotected二ACEで作る。適合済み再利用は追加作成0、不適合ACL・同名fileは修復0で拒否する。作成競合後のfresh照合、部分作成・型／ACL拒否とchild close失敗の共同保持、親guard終了を観測する。既存ACL移行は通常作成と別に、開始抑止・終了・変更前後のchild Identity／bytes／保護・旧exact回復の維持を検証する。新Mutexや作成成功だけを非使用または移行許可にしない。

`windows::terminal::host_namespace_creation_tests::host_namespace_creation_fixture`は、固定Repository-localの自己生成r2だけで新規作成、無変更再利用、既存不適合と同名fileの拒否、明示closeと終了後不存在を確認する専用実Windows Caseである。通常cargo testではignoredとし、固定cwd・run・通常選択利用者・先行静的検査を確認したOwnerが直接起動する。制限環境の選択利用者不明は拒否のまま保持し、保護条件を緩めない。作成競合・OS API／close故障刺激、通常producer、署名搬送、既存共有ACL移行と全Recoveryは別の未観測条件である。局所成功をLocal Item全体のPassへ自動昇格しない。[今回の範囲と原記録](../../../99_Roadmap/Changes/CHG-000082/Evidence/261002_host-orphan-recovery-design.md#保護付き作成部品の局所確認--2026-10-04)へ接続する。

通常producerの保護付き作成は、署名Nativeの親観測→独立期待値付き初期化→Root／marker生成の順序を処置する。`ERB-IT-003`の追加局所Caseは、`host-recovery-namespace.integration.test.ts`で現在の本体を使った署名拒否・mode相関・部分処置・transport不明・通常入口の順序を、Native専用r3で本体の作成・再利用・親／利用者差・不適合拒否と個別終了を確認する。専用CLIの不正要求は実Processで取得前拒否を確認する。既存の明示親付き負例は下位primitiveを変更しておらず、署名拒否を元Oracleの代わりにしない。これは局所観測であり、署名付き正常保存、ACL移行、作成競合とAPI／close故障、全Recoveryは未観測のままとする。[接続と限界](../../../99_Roadmap/Changes/CHG-000082/Evidence/261002_host-orphan-recovery-design.md#通常作成入口と専用搬送の接続--2026-10-04)に従い、Local Itemの全体Passや件数を変更しない。


## Docker回復・現在状態縮小の検証補強

### 切替前の検証義務と現在設計の区別

Coordinator詳細の[旧方式の処置表](../../../06_Architecture/Details/coordinator/01_Architecture.md#正常復帰後の検証付き再起動)に従い、旧Release間の引継ぎ専用`ERB-ST-011`／`ERB-IT-012`は移行元の検証履歴として扱う。上の基準項目表はSource切替前の対応を識別するため保持しているが、新Runtimeで同じhandoff chainを再実装・再検証する義務ではない。段階5の撤去前に、以下の現在方式へ実接続と全利用側を対応させ、現行集合・統合表・生成物を一括確定する。旧項目を別の意味へ再利用しない。

| 維持する保証 | 現在方式のLocal Item | 固定候補で確認する反証 |
|---|---|---|
| 同じ操作・回復Identityでの保存と再入場、一次失敗と清掃の分離 | `ERB-IT-003`、`ERB-IT-004` | 別Attempt、元版喪失、観測不能、結果未受理、後続失敗による一次失敗の上書き |
| 必要な人間介入に限定したDocker再起動 | `ERB-IT-014` | 終了済みClaude参照と未解決Codex参照の混在、別の稼働Owner、対象追加・置換、排他不能、要求結果不明、起動未確認 |
| 明示的に選択したHost障害修復の安全条件 | `ERB-ST-009`、`ERB-IT-014` | Task回復からの暗黙修復、個別socket削除、観測不能、未確定Effect再発行。旧Releaseへの引継ぎ成功は現在方式のOracleにしない。 |
| 公開入口から回収・限定終了・新しい試行へ到達 | `ERB-ST-030` | 旧Workspace再利用、Provider開始後／送信不明への限定終了適用、遅延Create、親Process喪失、終了後残存、再送・採用・Commit／Pushの暗黙発行 |

実行形態、結果とEvidenceは各項目の契約を維持する。履歴の退避だけ、旧Reader削除だけ、新規正常実行だけを移行完了またはRecovery成功としない。現在Sourceに旧方式が残るため、上の二項目を現行集計から除外する処置はSource・全Consumer・実証の対応が固定された後に行う。これは旧互換を新Runtimeへ残す指示ではない。

本節は[Coordinatorの現在状態Snapshot](../../../06_Architecture/Details/coordinator/01_Architecture.md#現在状態snapshotの構造)から既存Local Itemへ導出する。新しい試験IDを目的なく増やさず、以下のscenarioを同じ検証義務の中で個別に判定する。設計の追加を試験合格や本番接続済みと表示しない。

保存再入場の純粋な分類は、[QA-000003](../QA-000003/quality_definition.md)の`PRL-UT-006`で、元版／次版のexact bytes Hash、Repository結合、初回Root条件、明示不存在／観測不能、previous相関、非安全整数・overflowを確認する。返却は非Authorityの処置候補であり、全Snapshot検証、File保存・回収、Root観測、Docker回復の成立は以下の結合・総合義務で別に確認する。

| Local Item | 入力・反証scenario | 観測・Oracle | 終了後条件 |
|---|---|---|---|
| `ERB-IT-003` | Coordinator設定不存在、正の期間指定、0・負数・小数・overflow、不正Schema、読取り不能、期間前後の通常履歴と未解決参照、終了要約の保存失敗・読戻し失敗。 | 不存在だけ既定30日。期間整理は通常履歴に限り、不正設定・観測不能では削除0。必要な要約の保存確認前にstateを除去しない。 | 未解決義務・未受理結果・Candidate・認証情報・正式Evidenceの削除0。要約再確認によるProvider再実行0。 |
| `ERB-IT-003` | 正常終了、取消中清掃、一次失敗後の清掃失敗、Process終了後の結果未受理。 | 一次失敗が不変で、cleanupと最終結果を別に保持する。結果受理前にoperationを除去しない。 | 未受理なら同じ結果を保持。清掃不明なら同じexact回復義務を保持。 |
| `ERB-IT-003` | 元版pending、次版exact一致、同版別内容、元内容Hash差、別Owner、置換後のread-back失敗、初回previous null、正規Snapshot不存在かつprevious非null。 | 許可された同一更新だけ再入場し、既成立の更新は追加更新0。不一致・未知は上書き0。 | pending解決または同じ参照で停止。履歴からAuthority／state復元0。 |
| `ERB-IT-003` | 結果保存後／Consumer受理前、ack保存後／元記録削除前、最終清掃失敗。 | 結果IdentityとConsumerが一致し、重複受理でも旧Task・Provider依頼を再活性化しない。 | 受理済み項目だけ回収。未解決義務はhistory整理から除外。 |
| `ERB-IT-003` | 要求前保存拒否、Effect後保存失敗、保存成功／排他解放失敗、外部応答待機中の別Writer、回収観測後のrevision競合、fresh Processでの同一pending再入場。 | 要求前はEffect 0。既発行Effectを未発行へ巻き戻さない。保存排他中にHost／Home／Runtime排他・通知・上位保存・外部応答を待たない。現在Rootと元版を再照合し、旧Process Capabilityを復元しない。 | 短期排他の解放を独立観測。未確定なら同じ回復参照保持、無条件再送0、別操作の記録更新0。 |
| `ERB-IT-004` | 回復参照先不存在、別Attempt、Identity差、重複参照、複製Repository、移動Root。 | Snapshotを操作Authorityとして受理せず、現在のRoot／Owner／資源へ再結合できなければ拒否する。 | 外部Effect 0、別対象削除0、既知参照保持。 |
| `ERB-IT-014` | 清掃済み旧参照＋未解決参照、対象追加・欠落・置換、現在稼働Owner、排他取得不能。 | 終了済み参照と現在の稼働を別に扱う。現在対象の閉集合・非稼働・全排他を確認する前に再起動しない。 | 競合時は再起動Effect 0。未選択Recovery変更0。 |
| `ERB-IT-003`／`ERB-IT-014` | 認証Probe create unknown、遅延create、旧Ownerの遅延start、現在不存在、観測不能、共有書込みMount。 | 限定終了の全条件を個別に確認する。未知を不存在にせず、Provider開始後や送信不明へ一般化しない。 | 成立時も過去unknown維持・旧領域再利用0。未成立なら同じ参照で停止。 |
| `ERB-ST-030` | 公開Task／Workbench助言の通常終了、取消、親Process喪失と新しい試行。 | 本番同等の保存・結果搬送・資源観測を組み合わせ、正常な新試行が旧Workspaceを利用しないことを確認する。 | 全所有資源不存在またはexact義務保持。再送・採用・Commit・Pushの暗黙発行0。 |
| `ERB-UAT-007` | 自動回収成功と、再認証／Docker再起動が必要な停止。 | 普段意識しない内部File承認を要求せず、必要な具体操作と影響だけを説明する。 | 人間判断前の新Provider Effect 0。安全な拒否を全体完成へ表示しない。 |

機械確認はSnapshotのshape、参照整合、revision／内容相関と固定purposeを扱う。意味上の限定終了、遅延要求と旧Owner停止の実保証はArchitecture／Qualityの独立確認および実境界の観測で扱う。Mockの返値だけでは実資源不存在や遅延create無害化を証明しない。

PT／LT適用判断: 専用の大規模負荷実行はN/A。今回の変更は容量・履歴が増えても現在の受付や回復へ干渉しないことを結合試験で確認する。Snapshot本文の有限上限はArchitectureへ具体化したが、本番受付制限と履歴設定は未接続なので最終容量境界はOPENであり、接続後に再評価する。専用PT／LTの実行は人間指定なしに開始しない。

OPEN: 新SnapshotへのSource接続、限定終了の実境界反証、各scenarioの実行とEvidenceは未実施。本節の追加だけでLocal ItemをPassへ変更しない。

### 利用形態別の受領条件と資源回収

2026-10-08の採用判断に基づき、`ERB-IT-003`の結果受理前の除去拒否は、固定本番利用形態に必要な受領条件へ適用する。全利用側に耐久Storeを要求しない。過去の実行結果とLocal Item件数は変更せず、次を現在の検証義務として扱う。

| 刺激・状態 | 必要な観測とOracle |
|---|---|
| CLI／Workbenchの通常返却と未閲覧 | 同じ結果を既存返却境界へ引き渡し、UI閲覧や任意保存を待たず資源回収を完了する。候補保全は別に確認する。 |
| Orchestratorの耐久ACK欠落 | cleanup確認は保持するが配送完了にせず、同じ結果のpendingを保持する。Provider再実行・資源復元0。 |
| Orchestratorのtransient降格、Consumer登録欠落 | 本番の固定利用形態と一致せず拒否する。空集合だけを単体利用の根拠にしない。 |
| 別Consumer／操作／結果ACK、任意Hash | 受理を反映せず元相関を保持する。保存Owner内部の確認を任意入力で代替しない。 |
| 一時返却失敗、返却後のProcess喪失 | 返却成功や回答再取得を推定せず、Provider再実行0。真正cleanupとCandidate／一次失敗の保全を維持する。 |
| Candidate公開不明、資源終端不明 | transientを理由に保全や回復義務を解除しない。現在不明を同じ相関で保持する。 |
| 耐久配送待ちで履歴期限到達 | 通常履歴保持とpending配送を分け、未受領結果を期限だけで消さない。既確認の資源を復元しない。 |

OPEN: 固定受領方式の値判定はSourceへ接続したが、本番組立て・耐久ACK・一時返却・終了整理の一体切替は未完了。本節の反例を実行するまでLocal Item全体をPassへ変更しない。

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
