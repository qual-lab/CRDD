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
| [REQ-000005](../../../01_Discovery/Definitions/REQ-000005/requirement.md) | `req-000005.qa-000006` | Requirement Definition（成立条件・失敗・検証意図） | プロジェクト管理、実行編成、通信方式、観測、Platform境界の責任者を一意に説明できる。Project RuntimeからCoordinator実装詳細への依存をPortで反転する。各部品の公開入口以外を利用側が参照せず、単独利用時の契約を確認できる。依存Graph、公開import、package単独試験、代表利用側を確認し、内部パス参照や逆向き依存を反証する | IT／ST | `ERB-IT-001`、`ERB-ST-005` |
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
| [ARCH-000010](../../../06_Architecture/Definitions/ARCH-000010/architecture_definition.md) | `arch-000010.qa-000006` | Architecture Definition（責務・境界・状態・故障） | Toolのavailable／unavailable／unverified／blockedと、モデル構成のvalid／invalid／selectedを分ける。コード埋込みのモデル一覧ではなく検証済み外部構成から選ぶ。所有する責務: Repositoryに適合するTool能力の発見、AIモデル構成の検証・選択理由。所有しない責務: Tool実行、Provider利用可能性の捏造、Repository Binding。主な外部境界: Repository設定、Tool Package、Provider Preflight。SPEC-000014: Tool一覧の閲覧だけで実行Authorityを発行しない。Effect: 読取り専用で候補を返し、Toolまたは配布物を実行・変更しない。SPEC-000015: 未知モデルや不正構成を暗黙fallbackせず、構成変更を実行許可にしない。Effect: 採用時だけ構成を保存する。選択はProvider実行Effectを発行しない。入力SPECが固有Recoveryを定義しない場合、Architectureから追加しない。結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める | IT／ST | `ERB-IT-004`、`ERB-ST-005`、`ERB-IT-003`、`ERB-IT-006` |
### Architecture詳細設計入力

| 詳細設計領域 | 受け取る成立条件 |
|---|---|
| [coordinator](../../../06_Architecture/Details/coordinator/01_Architecture.md) | 実行編成、Authority、外部Effect、候補、回収・回復 |
| [cros](../../../06_Architecture/Details/cros/01_Architecture.md) | Repository横断解決、Grant、投影、外部接続、候補処置 |
| [platform-access](../../../06_Architecture/Details/platform-access/01_Architecture.md) | OS資源、Process Effect、観測、cleanup、回復 |
| [verification-runner](../../../06_Architecture/Details/verification-runner/01_Architecture.md) | 外部境界試験の段階適用、子Process結果および観測不能時の停止 |

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
| 正常 | Required | ERB-IT-001 | 通常の成立経路を独立して確認する。 |
| 境界 | Required | ERB-IT-002、ERB-IT-006、ERB-UAT-007、ERB-IT-008、ERB-IT-010、ERB-ST-015 | 値、Authority、情報、責務または利用者判断の境界を確認する。 |
| 準正常 | Required | ERB-IT-004、ERB-ST-005 | 継続可能な分岐、保留、観測不能または診断状態を成功へ畳まない。 |
| 異常 | N/A | - | 独立した異常条件を持たない。 |
| 回復 | Required | ERB-IT-003、ERB-ST-009、ERB-ST-011、ERB-IT-012、ERB-ST-013、ERB-IT-014 | 失敗・取消後に同じIdentityと義務で安全に再入場できることを確認する。 |

## 4. 検証項目

| Local ID | 条件区分 | 試験段階 | 試験種別 | 対象／境界 | 外部境界の段階 | 事前状態／入力 | 操作／刺激 | 観測 | Oracle | Evidence | 終了後条件 | 実行形態 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `ERB-IT-001` | 正常 | IT | External Contract／Lifecycle | Adapter→実CLI・Process・Container | Direct Boundary | 固定CLI・Process・Container、相関ID、終了後資源Observer | 外部実行を開始し完了まで観測する | ERB-IT-001として、「外部実行を開始し完了まで観測する」前後のAdapter→実CLI・Process・Containerについて、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | 構成、要求、受理、開始、結果、完了を同じrunで相関 | ERB-IT-001、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「構成、要求、受理、開始、結果、完了を同じrunで相関」および終了後条件「すべての所有資源の終了を独立観測」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | すべての所有資源の終了を独立観測 | Automated |
| `ERB-IT-002` | 境界 | IT | Fault Injection／Lifecycle | Controller→stdio・signal・close→資源Observer | Adjacent 1 Block | 起動・搬送・取消・closeの各境界へ故障を注入できる固定Task | handle取得後、write後、kill要求後にそれぞれ失敗させる | ERB-IT-002として、「handle取得後、write後、kill要求後にそれぞれ失敗させる」前後のController→stdio・signal・close→資源Observerについて、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | 前段階の成功を後段階の成功にせず、原因段階を返す | ERB-IT-002、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「前段階の成功を後段階の成功にせず、原因段階を返す」および終了後条件「終了不明をcleanup成功にしない」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | 終了不明をcleanup成功にしない | Automated |
| `ERB-IT-003` | 回復 | IT | Cancellation／Recovery | Task Runtime→Controller→外部Runtime→Recovery | Related 2 Blocks | 実行中Task、取消Authority、重複・遅延通知と部分結果の注入点 | timeout、cancel、重複通知、遅延close、部分結果を順に発生させる | ERB-IT-003として、「timeout、cancel、重複通知、遅延close、部分結果を順に発生させる」前後のTask Runtime→Controller→外部Runtime→Recoveryについて、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | 状態遷移、結果搬送、Effect、回収を独立に評価 | ERB-IT-003、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「状態遷移、結果搬送、Effect、回収を独立に評価」および終了後条件「残存する場合は回復義務を保持」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | 残存する場合は回復義務を保持 | Automated |
| `ERB-IT-004` | 準正常 | IT | Unknown State／Safety | Observer→Effect Gate | Direct Boundary | 実行可能性、現存Processまたは終了後不存在を観測できない環境 | 観測不能なまま状態判定と次のEffectを要求する | ERB-IT-004として、「観測不能なまま状態判定と次のEffectを要求する」前後のObserver→Effect Gateについて、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | available／absent／doneへ丸めず、安全な停止と診断情報を返す | ERB-IT-004、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「available／absent／doneへ丸めず、安全な停止と診断情報を返す」および終了後条件「追加外部Effect 0」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | 追加外部Effect 0 | Automated |
| `ERB-ST-005` | 準正常 | ST | Observability／Scenario | 公開入口→外部Runtime→結果・終了後診断 | System/E2E | 同一固定Taskの正常例と各故障例、機密を除く相関ログ契約 | 全例を実行し、段階別診断を収集する | ERB-ST-005として、「全例を実行し、段階別診断を収集する」前後の公開入口→外部Runtime→結果・終了後診断について、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | 入力／構成から終了後までの段階、理由、相関を記録 | ERB-ST-005、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「入力／構成から終了後までの段階、理由、相関を記録」および終了後条件「Path、Credential、Secret、生Provider出力を含まない」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | Path、Credential、Secret、生Provider出力を含まない | Automated |
| `ERB-IT-006` | 境界 | IT | Configuration／Selection | AIモデル構成→Schema検証→利用可能性確認→選択結果 | Related 2 Blocks | 許可値、未知値、Schema違反、利用不能モデル、採用前候補、採用済み構成を含む固定入力 | 構成を検証し、選択と採用を別操作として要求する | 構成Revision、Schema判定、Provider利用可能性、実効モデル、選択理由、再選定条件、構成保存回数、Provider Effect回数を入力別に記録する | 未知・不正・利用不能を暗黙fallbackせず、実効モデル、選択理由、再選定条件を返す | ERB-IT-006、構成Revision、Schema判定、Provider利用可能性、実効モデル、選択理由、再選定条件、保存回数、Provider Effect回数およびOracle判定を保存する。Secret、生Provider出力および絶対Pathは保存しない | 採用時だけ構成を一回保存し、選択だけではProvider Effect 0 | Automated |
| `ERB-UAT-007` | 境界 | UAT | Acceptance／Diagnosis | 外部Runtimeの状態・構成・影響範囲→利用者判断 | User Acceptance | 正常、部分故障、利用不能、未知構成を含む診断結果 | 利用者が継続、再選択、停止または回復を判断する | 表示された状態、選択理由、不完全性および利用者判断を記録する | 故障境界と影響範囲を理解し、未知状態を正常として継続せず、AIモデル構成を根拠付きで選べる | ERB-UAT-007の診断結果、利用者判断、選択根拠および終了後状態 | 判断前に新しいProvider Effect 0 | Manual |
| `ERB-IT-008` | 境界 | IT | Provider Home／Preflight | Provider Home設定→Directory検証→Process Gate | Direct Boundary | 正常Home、欠落、file、link／reparse、別Repository、権限不足の各fixture | Provider起動前にHomeを検証する | 入力Home分類、解決結果、検証理由、Provider Process Effect回数を記録する | 正常な所有Directoryだけを受理し、不正・不明時は理由付きで停止する | ERB-IT-008、Home分類、検証結果・理由、Provider Process Effect回数およびOracle判定を保存する。絶対Pathは保存しない | 不正・不明時のProvider Process Effect 0 | Automated |
| `ERB-ST-009` | 回復 | ST | Docker Repair／Recovery | 修復Identity→既知Runtime領域の段階退避→Docker restart→Engine readiness | System/E2E | exact Repair ID、`Docker/run`と`docker-secrets-engine`の既知2領域、停止中Docker、初回起動失敗、Engine readiness Observer、署名版更新 | 同じRepair IDで各領域を順序付きに退避し、再起動・確認を継続する | Repair ID、領域別Identity、各Effectの意図と結果、再起動試行、Engine readiness、再入場回数を記録する | 未完了Effectを再発行せず、個別socketを削除せず、2領域の退避と新世代確認が揃いEngine readyになった後だけ完了する | ERB-ST-009、Repair ID、領域別Identity Hash、追記記録chain、Effect確認、Engine readiness、再入場結果、残る回復義務を保存する | native helper残存0。部分退避、観測不能、intent後中断では同じRepair IDの回復義務を保持する | Hybrid |
| `ERB-IT-010` | 境界 | IT | CROS Handoff／Continuation | Source Runtime→Handoff記録→Destination Runtime | Related 2 Blocks | 正常Contextに加え、Task／Project Identity不一致、Revision不一致、必須Context欠落、Authority追加、再構成不能Contextの各固定入力 | 各ContextでHandoffを発行し別Runtimeから再入場する | Handoff Identity、Task／Project Identity、Revision、必須Context充足、Authority差分、Effect件数、拒否理由、再入場結果を両Runtimeで相関する | 正常時はIdentityとRevisionを保持する。不完全・不一致・Authority拡大時は推測補完も完了扱いもせず、同じHandoff Identityで不足を返す | ERB-IT-010、両Runtimeの相関Identity、Revision、必須Context判定、Authority差分、Effect件数、拒否理由、再入場結果を保存する | 正常時は送信元の所有資源0・重複Effect 0。拒否時はDestination Effect 0 | Automated |
| `ERB-ST-011` | 回復 | ST | Docker Session Handoff／Recovery | repair・restart→handoff chain→別Session／Runtime→closure | System/E2E | repair／restart／handoff Identity、Source／Destination Session Identity、Runtime Execution Identity、origin・adoption・tip・closure、Host資源観測と、別Session混入・Identity不一致・循環・分岐・番号飛び・上限超過・記録欠落・旧Effect再発行要求 | 正常chainと各反例で別Session／Runtimeへの継続を要求する | chain全要素と順序、各Identity、Effect件数、Engine／Host資源、exact回復義務、拒否理由を記録する | 正常時だけ同じ義務を順序付きで継続する。不正chainはEffect 0、旧Host Effectを再発行せず、不明時は同じIdentityで回復義務を保持する | ERB-ST-011、chain、Identity、Effect件数、Engine／Host状態、回復義務、拒否理由、Oracleを保存する | 不正・不明時Host Effect 0。正常完了時は旧Session所有資源0 | Hybrid |

### ERB-ST-009の段階的な外部境界確認

| 段階 | 確認対象 | 主な反証 |
|---|---|---|
| 1. 領域単体 | `Docker/run`と`docker-secrets-engine`を別々に観測し、exact Identityと既知lockを確認する | 一方だけ確認、再帰探索、未知error、観測中の内容変化 |
| 2. Effect単体 | 各退避の意図を先に耐久化し、Effect直前にもEngine停止、Process不在、source／lock Identity、target不存在をfreshに再確認してから同一親へrenameし、結果を記録する | intent後中断、rename後settlement前中断、個別socket削除、別Directory退避、観測後のDocker再起動、Identity差替え |
| 3. 領域間結合 | 失敗起動世代とSecrets Engineを同じRepair IDで順序付きに退避し、各Effect前に先行退避結果とHost停止状態を再確認する | 一領域の成功を全体成功へ昇格、別Repair IDへの逃避、旧Effect再発行、一領域退避後のProcess再出現 |
| 4. 再起動結合 | 両領域の退避後に再起動を一回だけ発行する | 起動結果不明時の再発行、片側未完了での起動 |
| 5. 回復全体 | Engine、Process、新しい2領域、退避2領域、3 Effectのconfirmed settlementおよびnative helper終了を確認する | Engineだけの成功、いずれかの新旧世代欠落、部分回復、未確認Effect、資源残存 |
| 6. 版更新・再入場 | 旧署名の原記録を変更せず、現在Releaseへexactに結合した追記記録で同じRepair IDを継続し、回復済み表示とcloseの両方で全記録を再検証する | 旧記録の上書き、別Release記録の受理、改変・部分記録でのclose、現在Authorityへの流用、intent済みEffectの二重発行 |

各段階の局所試験がPassしても次段階の成立を推定しない。局所契約試験では、最初のEffect前からDockerが稼働している場合、一領域退避後にDockerが再出現する場合、Secrets Engineの新世代が欠ける場合、追記記録が改変・部分成立・別Release結合である場合も反証する。実機STでは、初回起動失敗から版更新、2領域退避、一回の再起動、終了後観測、明示closeおよび同じRepair IDへの再入場までを一つのlifecycleとして確認する。

| `ERB-IT-012` | 回復 | IT | Docker Repair Handoff | Coordinator→Repair Record→Platform Adapter | Related 2 Blocks | exact Repair Identity、旧Effect記録、fresh観測、別Session反例 | 既存Repairを継続可能なPlatform要求へ変換する | Repair Identity、fresh状態、Effect要求、拒否理由を記録する | 旧Effectを再発行せず同じRepair義務だけを搬送する | Identity、状態、要求、Effect件数、判定 | 重複Effect 0、別Repair 0 | Automated |
| `ERB-ST-013` | 回復 | ST | CROS Handoff Scenario | Source Runtime→Handoff→Destination Runtime | System/E2E | 同じContext Identity／Revision、切断、Destination拒否、Authority差 | SourceからDestinationへContextを移送し再開する | 両Runtime状態、Identity、Revision、Authority差、結果を記録する | 未確認Context補完やAuthority昇格なしに同じIdentityで再開する | Source／Destination状態、結果、判定 | Source二重実行0 | Automated |
| `ERB-IT-014` | 回復 | IT | Docker Repair Boundary | Platform Adapter→Docker Desktop／Engine Observer | Related 2 Blocks | stale socket、Engine停止、restart受理、ready未確認 | 修復要求を発行しEngine状態を観測する | socket処置、restart要求、Engine観測、終了状態を記録する | Engine readyのfresh観測前に完了を返さない | 入力、要求、観測、終了状態、判定 | 未確認時は回復義務保持 | Automated |
| `ERB-ST-015` | 境界 | ST | Boundary Progression | 局所Gate→直接境界→Lifecycle→公開入口 | System/E2E | 段階別結果と下位未Pass／未実行反例 | 下位Gate成立時だけ次の境界を実行する | 各段階の開始条件、結果、未開始理由を記録する | 下位未成立のまま上位境界を開始せず公開入口まで順序を保つ | 段階結果、実行順、判定 | 禁止上位Effect 0 | Automated |

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
