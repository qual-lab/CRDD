# QA-000006 外部実行境界の検証定義

成果物種別: Quality定義
Quality ID: `QA-000006`
検証目標: OS、Process、Container、外部CLIおよびAI Runtimeの意味を推測せず、要求から終了後状態までを段階別に確認する
主な試験段階: Integration／System
状態: Canonical
維持責任者: Qual-Lab

## 1. 情報源と網羅条件

| Source ID | 保持する固有条件 | 試験段階 | 対応Local Item |
|---|---|---|---|
| [REQ-000002](../../../01_Discovery/Definitions/REQ-000002/requirement.md) | 外部作用（Effect）の前に範囲、送信許可、実行者と確認者が確定する。成功、失敗、取消の各終了経路で候補、プロセス、Docker等の資源状態を追跡できる。残存資源または回復義務を正常終了へ畳まず同じ実行識別情報で再入場できる。正常完了、外部送信拒否、実行途中取消、確認失敗、清掃不能を通し、各段階の決定権限、結果、残存、回復対象の識別情報を観測する | IT | `ERB-04`、`ERB-03` |
| [REQ-000005](../../../01_Discovery/Definitions/REQ-000005/requirement.md) | プロジェクト管理、実行編成、通信方式、観測、Platform境界の責任者を一意に説明できる。Project RuntimeからCoordinator実装詳細への依存をPortで反転する。各部品の公開入口以外を利用側が参照せず、単独利用時の契約を確認できる。依存Graph、公開import、package単独試験、代表利用側を確認し、内部パス参照や逆向き依存を反証する | IT／ST | `ERB-01`、`ERB-05` |
| [REQ-000011](../../../01_Discovery/Definitions/REQ-000011/requirement.md) | 接続認証、接続単位 作業領域 Grant、リポジトリ Exposure、実アクセスを段階別に検証する。許可範囲だけを返し、非開示リポジトリの存在、名前、件数を漏らさない。一部だけ読めるプロジェクトを完全状態へ畳まず利用可能な範囲を返す。認証失敗、作業領域範囲外、Exposureなし、アクセス不能、部分可視を与え、各境界の拒否と情報非開示を観測する | IT | `ERB-04`、`ERB-02` |
| [REQ-000016](../../../01_Discovery/Definitions/REQ-000016/requirement.md) | モデル、設定内容、役割割当、CLI配置をSchemaと接続部対応で検証する。登録、Host可用、認証、処理許可を別々に判定する。構成変更後も既存接続部の起動、取消、結果意味が変わらない。既存モデル追加、設定内容変更、CLI移動、未知モデル、Host不可、認証不足を与え、外部変更の前の選択と拒否を観測する | IT | `ERB-01`、`ERB-04` |
| [REQ-000023](../../../01_Discovery/Definitions/REQ-000023/requirement.md) | 新実行基盤と既存接続部の認証、起動、取消、結果、回復Semanticsを比較する。差がある場合は設定Aliasでなく専用接続部と機能 契約を持つ。実環境で開始から終了後清掃までを段階的に検証する。既存接続部互換と非互換実行基盤を用意し、構成受理、接続部選択、取消、結果、回復、清掃を観測する | IT／ST | `ERB-05`、`ERB-01` |
| [REQ-000030](../../../01_Discovery/Definitions/REQ-000030/requirement.md) | 各試験段階の責務と重複しない完成主張を定義する。外部境界は正常系から取消、清掃、回復まで実環境で観測する。変更意味から成立済み機能と回帰対象を選び、最終E2Eを最初の結合にしない。局所、外部単体、一連の状態変化、隣接1～2 Block、公開入口の順に故障を注入し、発見段階と診断可能性を観測する | IT | `ERB-04`、`ERB-02` |
| [UX-000008](../../../02_UX/Definitions/UX-000008/ux_definition.md) | AI実行環境の認証・起動・取消・結果取得・回復のどこに違いがあり、故障時に何が利用可能かを理解できる。重要場面「一つの失敗を全体障害と判断する直前」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。認証・起動・取消・結果取得・回復の違いを同じ失敗へ畳む表示と、利用可能な機能まで停止する判断を反証する | IT／ST | `ERB-01`、`ERB-05` |
| [UX-000018](../../../02_UX/Definitions/UX-000018/ux_definition.md) | 新しいモデルへ追随するとき、コード改修を待たず検証済み構成を更新し、実効選択と再選定理由を理解できる。重要場面「AI提供元で実行する前のモデル確定」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。未知設定の黙示代替、非対応モデルの実行可能表示および無説明選択を反証する | IT／ST | `ERB-05`、`ERB-04` |
| [IA-000003](../../../03_IA/Definitions/IA-000003/ia_definition.md) | 失敗後に再接続、再試行、回復、清掃を取り違えず、二重作用を避ける。UX-000003: 開始可能（ready）／実行中（running）／入力・判断待ち（waiting）／停止（blocked）／完了（completed）／失敗（failed）。UX-000004: 失敗後の作用なし／作用済み／不明、回復要／不要。UX-000021: 進行中（active）／切断（disconnected）／結果取得可能（result_available）／回復必要（recovery_required）／確定済み（settled）。UX-000022: 存在（present）／不存在（absent）／不明（unknown）、回復可能（recoverable）／清掃可能（cleanup_eligible） | IT | `ERB-04`、`ERB-01`、`ERB-02` |
| [IA-000011](../../../03_IA/Definitions/IA-000011/ia_definition.md) | Repositoryの仕事に必要な標準Toolを、版と根拠を取り違えず選ぶ。UX-000016: 利用可能（available）／利用不能（unavailable）／未確認（unverified）／停止（blocked） | IT | `ERB-04`、`ERB-02` |
| [IA-000013](../../../03_IA/Definitions/IA-000013/ia_definition.md) | コード改修なしに検証済み構成を更新し、実効選択と理由を理解する。UX-000018: 有効（valid）／無効（invalid）／利用可能（available）／利用不能（unavailable）／選択済み（selected） | IT／ST | `ERB-04`、`ERB-05` |
| [IA-000020](../../../03_IA/Definitions/IA-000020/ia_definition.md) | 実行基盤の一部が故障したとき、故障した境界と影響を受ける能力を見分け、利用できる範囲まで一律に停止しない。UX-000008: 各境界の利用可能（available）／停止（blocked）／不明（unknown）。全体停止と分ける | IT | `ERB-04`、`ERB-02` |
| [UI-000005](../../../04_UI/Definitions/UI-000005/ui_definition.md) | 実際に起きたことと故障箇所を根拠から切り分けられる。UX-000006: 実行事実を出所と観測時点付きで比較する: 記録済み／未記録／記録結果不明を含む実行事実の取得: 出所・時点・観測状態と記録状態を保持する: 未観測や記録結果不明を0、正常または未記録へ畳む。UX-000008: 故障した境界と影響する能力を特定する: 一つの失敗を全体障害と判断する直前: 失敗した場所・影響範囲・利用可能性を分ける: 一律の失敗表示で無関係な能力まで停止する。UX-000006／IA-000004: 記録済み（recorded）／未記録（not_recorded）／記録結果不明（unknown）、観測済み（observed）／未観測（not_observed）／不明（unknown）。評価は事実と別: 実行→記録状態→観測→根拠→評価→改善候補。UX-000008／IA-000020: 各境界の利用可能（available）／停止（blocked）／不明（unknown）。全体停止と分ける: 故障→境界→影響する能力→継続可能範囲→回復 | IT／ST | `ERB-04`、`ERB-05` |
| [UI-000010](../../../04_UI/Definitions/UI-000010/ui_definition.md) | 仕事に合うToolとAIモデルを根拠付きで選び、安全に変更できる。UX-000016: 固定Commitに対応するツール／実行基盤と利用可能性を知る: 発見したツール／実行基盤を起動する直前: Commit・配布集合・Manifest・実行基盤の対応を検証する: 版不一致・欠落実行基盤・改ざんManifestを対応版と誤認する。UX-000018: AIモデル選択を検証可能な構成として更新する: AI提供元で実行する前のモデル確定: 構成変更を検証し実効選択を観測可能にする: 未知または非対応のモデルを実行可能と表示する。UX-000016／IA-000011: 利用可能（available）／利用不能（unavailable）／未確認（unverified）／停止（blocked）: 仕事→必要能力→登録Tool→配布根拠→起動。UX-000018／IA-000013: 有効（valid）／無効（invalid）／利用可能（available）／利用不能（unavailable）／選択済み（selected）: 設定→検証→利用可能候補→選択→理由・再選定条件 | IT | `ERB-04`、`ERB-01` |
| [SPEC-000009](../../../05_SPEC/Definitions/SPEC-000009/spec_definition.md) | 正常: 原因未確定と確定済みを分け、Providerごとの差を保持する。境界: 診断対象内／対象外、原因確定／未確定を分け、診断から修復Effectを発行しない。失敗: 一つの失敗から全機能停止や原因を断定しない。観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「許可された小規模Probeだけを実行し、Provider仕事や修復Effectを発行しない」と矛盾する結果を返さない。失敗: 一つの失敗から全機能停止や原因を断定しない。副作用: 許可された小規模Probeだけを実行し、Provider仕事や修復Effectを発行しない。本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す | IT／ST | `ERB-04`、`ERB-05` |
| [SPEC-000015](../../../05_SPEC/Definitions/SPEC-000015/spec_definition.md) | 正常: コード変更なしで構成を更新でき、選択理由と適用範囲を確認できる。境界: 許可値／未知値、利用可能／利用不能を分け、不正構成を暗黙fallbackしない。失敗: 未知モデルや不正構成を暗黙fallbackせず、構成変更を実行許可にしない。観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「採用時だけ構成を保存する。選択はProvider実行Effectを発行しない」と矛盾する結果を返さない。失敗: 未知モデルや不正構成を暗黙fallbackせず、構成変更を実行許可にしない。副作用: 採用時だけ構成を保存する。選択はProvider実行Effectを発行しない。本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す | IT／ST | `ERB-04`、`ERB-05` |
| [ARCH-000008](../../../06_Architecture/Definitions/ARCH-000008/architecture_definition.md) | 境界ごとのavailable／blocked／unknownと相関IDを返し、診断成功をTask成功へ読み替えない。観測手段に許可された最小Probeだけを使う。所有する責務: 外部境界ごとの到達、受理、開始、結果搬送、終了状態の観測。所有しない責務: Provider Task、Docker修復、再起動、結果採用。主な外部境界: OS Process、Docker、Network、外部CLI。SPEC-000009: 一つの失敗から全機能停止や原因を断定しない。Effect: 許可された小規模Probeだけを実行し、Provider仕事や修復Effectを発行しない。入力SPECが固有Recoveryを定義しない場合、Architectureから追加しない。結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める | IT／ST | `ERB-04`、`ERB-01`、`ERB-05` |
| [ARCH-000010](../../../06_Architecture/Definitions/ARCH-000010/architecture_definition.md) | Toolのavailable／unavailable／unverified／blockedと、モデル構成のvalid／invalid／selectedを分ける。コード埋込みのモデル一覧ではなく検証済み外部構成から選ぶ。所有する責務: Repositoryに適合するTool能力の発見、AIモデル構成の検証・選択理由。所有しない責務: Tool実行、Provider利用可能性の捏造、Repository Binding。主な外部境界: Repository設定、Tool Package、Provider Preflight。SPEC-000014: Tool一覧の閲覧だけで実行Authorityを発行しない。Effect: 読取り専用で候補を返し、Toolまたは配布物を実行・変更しない。SPEC-000015: 未知モデルや不正構成を暗黙fallbackせず、構成変更を実行許可にしない。Effect: 採用時だけ構成を保存する。選択はProvider実行Effectを発行しない。入力SPECが固有Recoveryを定義しない場合、Architectureから追加しない。結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める | IT／ST | `ERB-04`、`ERB-05`、`ERB-03` |
### Architecture詳細設計入力

| 詳細設計領域 | 受け取る成立条件 |
|---|---|
| [coordinator](../../../06_Architecture/Details/coordinator/01_Architecture.md) | 実行編成、Authority、外部Effect、候補、回収・回復 |
| [cros](../../../06_Architecture/Details/cros/01_Architecture.md) | Repository横断解決、Grant、投影、外部接続、候補処置 |
| [platform-access](../../../06_Architecture/Details/platform-access/01_Architecture.md) | OS資源、Process Effect、観測、cleanup、回復 |

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

## 4. 検証項目

| Local ID | 分類 | 試験段階 | 試験種別 | 対象／境界 | 外部境界の段階 | 事前状態／入力 | 操作／刺激 | 観測と期待結果 | 終了後条件 | 実行形態 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `ERB-01` | 正常 | IT | External Contract／Lifecycle | Adapter→実CLI・Process・Container | Direct Boundary | 固定CLI・Process・Container、相関ID、終了後資源Observer | 外部実行を開始し完了まで観測する | 構成、要求、受理、開始、結果、完了を同じrunで相関 | すべての所有資源の終了を独立観測 | Automated |
| `ERB-02` | 境界 | IT | Fault Injection／Lifecycle | Controller→stdio・signal・close→資源Observer | Adjacent 1 Block | 起動・搬送・取消・closeの各境界へ故障を注入できる固定Task | handle取得後、write後、kill要求後にそれぞれ失敗させる | 前段階の成功を後段階の成功にせず、原因段階を返す | 終了不明をcleanup成功にしない | Automated |
| `ERB-03` | 異常 | IT | Cancellation／Recovery | Task Runtime→Controller→外部Runtime→Recovery | Related 2 Blocks | 実行中Task、取消Authority、重複・遅延通知と部分結果の注入点 | timeout、cancel、重複通知、遅延close、部分結果を順に発生させる | 状態遷移、結果搬送、Effect、回収を独立に評価 | 残存する場合は回復義務を保持 | Automated |
| `ERB-04` | 判定不能 | IT | Unknown State／Safety | Observer→Effect Gate | Direct Boundary | 実行可能性、現存Processまたは終了後不存在を観測できない環境 | 観測不能なまま状態判定と次のEffectを要求する | available／absent／doneへ丸めず、安全な停止と診断情報を返す | 追加外部Effect 0 | Automated |
| `ERB-05` | 診断 | ST | Observability／Scenario | 公開入口→外部Runtime→結果・終了後診断 | System/E2E | 同一固定Taskの正常例と各故障例、機密を除く相関ログ契約 | 全例を実行し、段階別診断を収集する | 入力／構成から終了後までの段階、理由、相関を記録 | Path、Credential、Secret、生Provider出力を含まない | Automated |

## 5. 段階的結合と評価

固定Fakeによる状態遷移、実CLI／Processとの直接境界、関連1〜2 block、必要な公開入口STの順で確認する。低い層のPassを実AI Provider、実Network、課金、公開Capabilityの成立に流用しない。

PT／LTは人間が明示した上限と停止／cleanup条件をrunnerが強制できる場合だけ実行する。

## 追加試験種別の適用

| 種別 | 適用 | 確認する範囲 | 実行許可 | 未実行時の扱い |
|---|---|---|---|---|
| RT | Required | 変更した意味と利用側から、再実行する既存Local Itemを選ぶ | Changeの通常検証範囲 | 未選択の範囲を明示し、選択した回帰の結果で評価する |
| PT | Conditional | 対象、負荷上限、費用／Credit上限、中止条件および清掃条件を事前に固定した場合だけ設計する | Human Explicit Authorization | 未実行をPassへ読み替えず、明示的なRelease条件でない限り通常監査を停止しない |
| LT | Conditional | 対象、継続時間、資源／費用上限、中止条件および清掃条件を事前に固定した場合だけ設計する | Human Explicit Authorization | 未実行をPassへ読み替えず、明示的なRelease条件でない限り通常監査を停止しない |
