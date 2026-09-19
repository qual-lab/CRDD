# QA-000004 読取り投影と時間的出所の検証定義

成果物種別: Quality定義
Quality ID: `QA-000004`
検証目標: 読取り投影が出所、観測時点、対象改訂版、欠測および評価候補を失わず返すこと
主な試験段階: Unit／Integration／System／User Acceptance
状態: Canonical
維持責任者: Qual-Lab

## 1. 情報源と網羅条件

| Source ID | 保持する固有条件 | 試験段階 | 対応Local Item |
|---|---|---|---|
| [REQ-000004](../../../01_Discovery/Definitions/REQ-000004/requirement.md) | タスクの識別情報、実行者、時刻、結果、利用量等の観測事実を相関できる。別実行基盤またはTypeScriptアプリから同じ契約で記録・読取りできる。観測値、推定、改善候補、人間の採用判断を別状態として保つ。複数作成側、再試行、部分記録、並行書込み、途中失敗を与え、事実の同一性、欠測、保存後の比較可能性を観測する | IT／UAT | `PPR-04`、`PPR-03`、`PPR-08` |
| [REQ-000007](../../../01_Discovery/Definitions/REQ-000007/requirement.md) | 各表示項目から情報源、改訂版または観測時点へ到達できる。missing、restricted、stale、conflictingを正常値や空値へ丸めない。プロジェクト全体の表示は読取り専用で、変更操作は所有正本へ戻る。完全、欠測、制限、古い、競合する情報源を投影し、利用者が不足を識別して根拠または判断対象へ進めるか観測する | UT／IT／ST／UAT | `PPR-02`、`PPR-05`、`PPR-01`、`PPR-06`、`PPR-07` |
| [REQ-000013](../../../01_Discovery/Definitions/REQ-000013/requirement.md) | 許可されたプロジェクトだけを比較対象に含める。プロジェクトごとの情報源、情報の新しさ、網羅範囲、Conflictを比較時にも保持する。一覧の判断から根拠プロジェクトまたは正本へ到達できる。完全、部分可視、古い、競合する複数プロジェクトを並べ、差と不足の理解、根拠到達、誤判断を観測する | IT／UAT | `PPR-02`、`PPR-01`、`PPR-07` |
| [REQ-000020](../../../01_Discovery/Definitions/REQ-000020/requirement.md) | 一リポジトリと複数リポジトリのプロジェクトを同じ結果契約で投影する。読めないリポジトリを不存在または正常と扱わず、開示可能な不足だけを示す。同一責務の複数情報源は探索順で選ばずConflictとして返す。完全、部分アクセス、欠測、重複責務、競合改訂版を組み合わせ、投影と非開示を観測する | IT／ST／UAT | `PPR-02`、`PPR-05`、`PPR-07` |
| [REQ-000029](../../../01_Discovery/Definitions/REQ-000029/requirement.md) | 当時の根拠、候補、判断、保持条件を後から追跡できる。新観測を過去判断の上書きにせず、現在有効な情報と区別する。AIへ対象変更に必要な意図と根拠だけを競合・不足付きで投影する。過去判断の変更、競合意図、欠測根拠、廃止案の再提案を用い、履歴と現在値、選択情報を観測する | IT／ST／UAT | `PPR-05`、`PPR-01`、`PPR-09` |
| [UX-000006](../../../02_UX/Definitions/UX-000006/ux_definition.md) | 実行主体が異なっても、観測事実・未観測・評価・改善候補を出所と時点付きで区別して振り返れる。重要場面「未観測値を含む実行事実の取得」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。空値の正常化、評価の事実化および出所のない比較を反証する | IT／UAT | `PPR-04`、`PPR-03`、`PPR-08` |
| [UX-000009](../../../02_UX/Definitions/UX-000009/ux_definition.md) | 物理構成を意識せずプロジェクトの現在地を理解し、欠測・制限・競合・古さと情報源へ戻れる。不足、競合、古さを確認したうえで、次の判断へ進める。重要場面「現在の表示を信じる直前」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。partial、stale、restricted、conflictingおよび未観測値の誤認を反証する | IT／ST／UAT | `PPR-02`、`PPR-05`、`PPR-07` |
| [UX-000015](../../../02_UX/Definitions/UX-000015/ux_definition.md) | 許可されたプロジェクトの重要差を比較し、網羅範囲と根拠を保ったまま必要なプロジェクトだけを掘り下げられる。重要場面「要約から優先判断へ進む直前」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。非開示プロジェクトの存在漏えい、単一Score断定および網羅範囲差の消去を反証する | IT／ST／UAT | `PPR-05`、`PPR-02`、`PPR-07` |
| [UX-000025](../../../02_UX/Definitions/UX-000025/ux_definition.md) | 当時の仮説・判断・学びと現在有効な意図を区別し、必要な情報を選べる。重要場面「判断理由をAIへ渡す場面」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。遡及上書き、古い仮説の現在値化および履歴全量の無選択投入を反証する | IT／UAT | `PPR-04`、`PPR-03`、`PPR-09` |
| [IA-000004](../../../03_IA/Definitions/IA-000004/ia_definition.md) | 観測できた事実、未観測、評価、改善候補を出所と時点付きで振り返る。UX-000006: 観測済み（observed）／未観測（not_observed）／不明（unknown）。評価は事実と別 | IT／UAT | `PPR-03`、`PPR-01`、`PPR-08` |
| [IA-000006](../../../03_IA/Definitions/IA-000006/ia_definition.md) | 論理Projectを一つに見ながら、情報源、物理Root、不完全性を取り違えず現在地を判断する。UX-000009: complete／partial／開示制限（restricted）／stale／競合あり（conflicting）／不明（unknown）。UX-000011: 確認済み（verified）／未確認（unverified）／曖昧（ambiguous）／利用不能（unavailable）。UX-000015: complete／partial／開示制限（restricted）／stale／競合あり（conflicting） | IT／UAT | `PPR-02`、`PPR-03`、`PPR-01`、`PPR-07` |
| [IA-000021](../../../03_IA/Definitions/IA-000021/ia_definition.md) | 過去の仮説・判断・学びと現在有効な意図を区別し、古い前提を現在値として利用せず、いま必要な情報を選ぶ。UX-000025: 現在有効（current）／履歴（historical）／置換済み（superseded）／不明（unknown） | IT／ST／UAT | `PPR-01`、`PPR-03`、`PPR-05`、`PPR-09` |
| [UI-000004](../../../04_UI/Definitions/UI-000004/ui_definition.md) | 単一または複数Projectの現在地を根拠と不完全性付きで判断できる。UX-000005: 目的と受入条件で節目を委ねる: タスク成功と節目完成を区別する: 統合・品質・判断待ちを分けて示す: タスク件数を完成と誤認する。UX-000009: プロジェクトの現在地を根拠と不完全性付きで理解する: 現在の表示を信じる直前: 根拠、不完全性、観測時点を同時に示す: 欠測や古い値を完全な現在値と誤認する。UX-000015: 複数プロジェクトを根拠付きで比較する: 要約から優先判断へ進む直前: 比較値から根拠・古さ・不足へ戻れる: 単一Scoreや欠測した集計で健全性を断定する。UX-000005／IA-000002: Task完了／Objective受入／Milestone受入を別にする: Milestone→目的と受入条件→Task根拠→受入判断。UX-000009／IA-000006: complete／partial／開示制限（restricted）／stale／競合あり（conflicting）／不明（unknown）: プロジェクト→現在投影→不足・競合→情報源→次の判断。UX-000015／IA-000006: complete／partial／開示制限（restricted）／stale／競合あり（conflicting）: Portfolio→差→対象範囲（Coverage）→Project→情報源（Source） | IT／UAT | `PPR-02`、`PPR-03`、`PPR-01`、`PPR-07` |
| [UI-000005](../../../04_UI/Definitions/UI-000005/ui_definition.md) | 実際に起きたことと故障箇所を根拠から切り分けられる。UX-000006: 実行事実を出所と観測時点付きで比較する: 記録済み／未記録／記録結果不明を含む実行事実の取得: 出所・時点・観測状態と記録状態を保持する: 未観測や記録結果不明を0、正常または未記録へ畳む。UX-000008: 故障した境界と影響する能力を特定する: 一つの失敗を全体障害と判断する直前: 失敗した場所・影響範囲・利用可能性を分ける: 一律の失敗表示で無関係な能力まで停止する。UX-000006／IA-000004: 記録済み（recorded）／未記録（not_recorded）／記録結果不明（unknown）、観測済み（observed）／未観測（not_observed）／不明（unknown）。評価は事実と別: 実行→記録状態→観測→根拠→評価→改善候補。UX-000008／IA-000020: 各境界の利用可能（available）／停止（blocked）／不明（unknown）。全体停止と分ける: 故障→境界→影響する能力→継続可能範囲→回復 | IT／UAT | `PPR-03`、`PPR-01`、`PPR-08` |
| [UI-000017](../../../04_UI/Definitions/UI-000017/ui_definition.md) | 過去の推論や判断と現在有効な意図を混同せず選べる。UX-000025: 当時の仮説と現在有効な意図を区別する: 判断理由をAIへ渡す場面: 現行性・選択範囲・使用改訂版を追跡する: 履歴を上書きし競合する理由を勝手に統合する。UX-000025／IA-000021: 現在有効（current）／履歴（historical）／置換済み（superseded）／不明（unknown）: 現在の仕事→選択した情報→根拠→過去値比較 | IT／UAT | `PPR-01`、`PPR-03`、`PPR-09` |
| [SPEC-000006](../../../05_SPEC/Definitions/SPEC-000006/spec_definition.md) | 正常: 部分成功を完成へ畳まず、Source・Coverage・Freshnessへ戻れる。境界: Project一致／不一致、完全／欠測／古い／競合を分け、別Projectの情報を混ぜない。失敗: 競合・欠測・開示制限を正常値で補完しない。観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「読取り投影だけを返し、Project正本を変更しない」と矛盾する結果を返さない。失敗: 競合・欠測・開示制限を正常値で補完しない。副作用: 読取り投影だけを返し、Project正本を変更しない。本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す | IT／ST／UAT | `PPR-02`、`PPR-05`、`PPR-03`、`PPR-07` |
| [SPEC-000007](../../../05_SPEC/Definitions/SPEC-000007/spec_definition.md) | 正常: 比較不能な項目を単一Scoreへ丸めず、掘り下げ可能な根拠を示す。境界: 閲覧可能／非開示、Coverage同等／相違を分け、非開示Projectの存在を漏らさない。失敗: 非開示Projectの存在を漏らさず、異なるCoverageを同等と扱わない。観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「読取り投影だけを返し、非開示Projectを探索・変更しない」と矛盾する結果を返さない。失敗: 非開示Projectの存在を漏らさず、異なるCoverageを同等と扱わない。副作用: 読取り投影だけを返し、非開示Projectを探索・変更しない。本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す | IT／ST／UAT | `PPR-05`、`PPR-02`、`PPR-07` |
| [SPEC-000008](../../../05_SPEC/Definitions/SPEC-000008/spec_definition.md) | 正常: 評価から元の観測へ戻れ、異なる実行主体の記録を意味を変えずに比較できる。境界: 観測済み／未観測／不明、事実／評価を分け、欠測を正常値へ補完しない。失敗: 欠測を正常値へ補完せず、評価を観測事実として返さない。観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「読取り専用。実行記録、対象Task、Providerを変更しない」と矛盾する結果を返さない。失敗: 欠測を正常値へ補完せず、評価を観測事実として返さない。副作用: 読取り専用。実行記録、対象Task、Providerを変更しない。本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す | IT／UAT | `PPR-03`、`PPR-04`、`PPR-08` |
| [SPEC-000022](../../../05_SPEC/Definitions/SPEC-000022/spec_definition.md) | 正常: Gitで再現できる状態を重複永続化せず、現在値と履歴を区別する。境界: 現在有効／置換済み／失効／不明を分け、過去情報を現在意図へ自動昇格しない。失敗: 古い判断を現在方針へ自動昇格せず、Commit SHAだけを成立条件にしない。観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「読取り解決だけを行い、Gitで再現可能な状態を重複保存・変更しない」と矛盾する結果を返さない。失敗: 古い判断を現在方針へ自動昇格せず、Commit SHAだけを成立条件にしない。副作用: 読取り解決だけを行い、Gitで再現可能な状態を重複保存・変更しない。本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す | IT／ST／UAT | `PPR-02`、`PPR-05`、`PPR-09` |
| [ARCH-000005](../../../06_Architecture/Definitions/ARCH-000005/architecture_definition.md) | Task完了、Objective受入、Milestone受入を分け、complete／partial／restricted／stale／conflicting／unknownを項目ごとに保つ。Portfolio比較でも不足を一つの健康度へ隠さない。所有する責務: Project／Milestone／Objective／Task状態と複数Project比較の読取り投影。所有しない責務: 受入判断記録、正本更新、Meeting候補採用、優先順位の自動決定。主な外部境界: Project正本、Quality／Roadmap等の正本、Workbench／MCP。SPEC-000006／SPEC-000007は読取りPortだけを使用し、判断Authority、Acceptance Decision Port、Task作成またはProvider Effectへ到達しない | UT／IT／ST／UAT | `PPR-06`、`PPR-02`、`PPR-01`、`PPR-05`、`PPR-07` |
| [ARCH-000007](../../../06_Architecture/Definitions/ARCH-000007/architecture_definition.md) | 利用可能な実行記録だけを読取り、observed／not_observed／unknownを区別して、事実と評価候補を別結果として返す。記録生成・保存方式は所有しない。所有する責務: 利用可能な実行記録の解決、欠測を保つ読取り集約、非Authority評価候補。所有しない責務: 実行記録の生成・永続化、Task状態の更新、Provider実行、評価の自動採用、故障修復。主な外部境界: 既存の実行記録Source、読取りPort、利用側。SPEC-000008: 欠測を正常値へ補完せず、評価を観測事実として返さない。Effect: 読取り専用。実行記録、対象Task、Providerを変更しない。入力SPECが固有Recoveryを定義しない場合、Architectureから追加しない。結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める | IT／UAT | `PPR-01`、`PPR-04`、`PPR-03`、`PPR-08` |
| [ARCH-000016](../../../06_Architecture/Definitions/ARCH-000016/architecture_definition.md) | 過去情報を消さず、現在有効な意図と区別する。Gitで再現できる全量Inventoryを永続化せず、必要なサマリーと参照Hashを保持する。所有する責務: 情報の出所、発生時点、対象改訂版、current／historical／superseded／unknownの解決。所有しない責務: 履歴参照からの現在方針採用、内容の正しさの自動判断。主な外部境界: Git履歴、Communication、Decision、現在正本。SPEC-000022: 古い判断を現在方針へ自動昇格せず、Commit SHAだけを成立条件にしない。Effect: 読取り解決だけを行い、Gitで再現可能な状態を重複保存・変更しない。入力SPECが固有Recoveryを定義しない場合、Architectureから追加しない。結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める | IT／UAT | `PPR-01`、`PPR-02`、`PPR-03`、`PPR-09` |
### Architecture詳細設計入力

| 詳細設計領域 | 受け取る成立条件 |
|---|---|
| [cros](../../../06_Architecture/Details/cros/01_Architecture.md) | Repository横断解決、Grant、投影、外部接続、候補処置 |
| [execution-intelligence](../../../06_Architecture/Details/execution-intelligence/01_Architecture.md) | Canonical記録、不変公開、並行Writer、実行事実、観測不能、出所と評価候補の分離 |
| [mcp](../../../06_Architecture/Details/mcp/01_Architecture.md) | Transport変換、公開Schema、Session、結果搬送 |
| [project-operation](../../../06_Architecture/Details/project-operation/01_Architecture.md) | Project運営状態、Meeting／Topic候補、正本への引渡し |
| [project-runtime](../../../06_Architecture/Details/project-runtime/01_Architecture.md) | Objective、Task、判断、取消、回復、公開結果 |
| [runtime-data](../../../06_Architecture/Details/runtime-data/01_Architecture.md) | Repository-local／OS管理Root、用途、保持、清掃、回復 |
| [version-control](../../../06_Architecture/Details/version-control/01_Architecture.md) | Repository境界、Revision、差し替え可能な履歴管理Adapter |

## 2. 試験段階と外部境界の適用

| 試験段階 | 適用 | 確認する範囲 | 外部境界の到達範囲 | 判断理由 |
| --- | --- | --- | --- | --- |
| UT | Required | 欠測、現行性、競合、可視性の判定規則 | N/A | Source接続前に意味変換を反証するため |
| IT | Required | Source Reader、Projector、Grant Filterの結合 | Related 2 Blocks | 出所・状態・制限の伝播を局所化するため |
| ST | Required | 複数Sourceから公開Project Viewまで | System/E2E | 部分成功を完全な現在状態へ畳まないことを確認するため |
| UAT | Required | 利用者が不完全性と根拠を理解して判断する場面 | User Acceptance | Project Viewの欠測・制限・古さ・競合を理解できる利用者成果を確認するため |

### 状態区分の適用

| 状態区分 | 適用 | 対応Local Item | 判断理由 |
|---|---|---|---|
| 正常 | Required | PPR-01 | 完全な投影を確認する |
| 準正常／境界 | Required | PPR-02、PPR-05、PPR-06、PPR-07、PPR-08、PPR-09、PPR-10 | partial、非開示、競合、Clock差、利用者判断を保持する |
| 異常 | Required | PPR-03 | 古い値や別Sourceの混入を拒否する |
| 判定不能 | Required | PPR-04 | 未観測値を既知へ丸めない |

## 3. 検証項目

| Local ID | 分類 | 試験段階 | 試験種別 | 対象／境界 | 外部境界の段階 | 事前状態／入力 | 操作／刺激 | 観測 | Oracle | Evidence | 終了後条件 | 実行形態 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `PPR-01` | 正常 | IT | Data Flow／Provenance | 複数Source Reader→Projector | Adjacent 1 Block | current・historical・observedの値とSource・Revision・Observed At | 複数Sourceから同じProject Viewを生成する | PPR-01として、「複数Sourceから同じProject Viewを生成する」前後の複数Source Reader→Projectorについて、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | 項目ごとにSource、Revision、Observed At、現行性を返す | PPR-01、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「項目ごとにSource、Revision、Observed At、現行性を返す」および終了後条件「未解消状態と残存Effect／資源を評価へ引き渡す」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | 未解消状態と残存Effect／資源を評価へ引き渡す | Automated |
| `PPR-02` | 準正常 | IT | Partial State／Consistency | 部分Source→Projector | Direct Boundary | missing・restricted・stale・conflictingを含む部分的なSource集合 | 部分SourceからProject Viewを生成する | PPR-02として、「部分SourceからProject Viewを生成する」前後の部分Source→Projectorについて、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | 不完全性を個別に保ち、完全なProject状態にしない | PPR-02、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「不完全性を個別に保ち、完全なProject状態にしない」および終了後条件「未解消状態と残存Effect／資源を評価へ引き渡す」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | 未解消状態と残存Effect／資源を評価へ引き渡す | Automated |
| `PPR-03` | 異常 | IT | Identity／Correlation | Event Source→Projector | Direct Boundary | 別Attempt・別ProjectのEventと観測時点不明の記録 | 対象ProjectのProjectionへ混在させる | PPR-03として、「対象ProjectのProjectionへ混在させる」前後のEvent Source→Projectorについて、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | 相関せずunknownまたは対象外とし、時点を推定しない | PPR-03、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「相関せずunknownまたは対象外とし、時点を推定しない」および終了後条件「未解消状態と残存Effect／資源を評価へ引き渡す」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | 未解消状態と残存Effect／資源を評価へ引き渡す | Automated |
| `PPR-04` | 異常 | IT | Classification／Consistency | 事実Store・Candidate Store→Projector | Adjacent 1 Block | 同じ対象に関する事実Eventと未採用の評価候補 | 同一入力集合からProjectionを生成する | PPR-04として、「同一入力集合からProjectionを生成する」前後の事実Store・Candidate Store→Projectorについて、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | 事実と評価を別field／別状態で返し、候補を確定事実にしない | PPR-04、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「事実と評価を別field／別状態で返し、候補を確定事実にしない」および終了後条件「未解消状態と残存Effect／資源を評価へ引き渡す」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | 未解消状態と残存Effect／資源を評価へ引き渡す | Automated |
| `PPR-05` | 情報境界 | ST | Security／Projection | 複数Repository Source→Grant Filter→公開View | System/E2E | 利用者Grant外のrestricted Sourceを含むProjectと許可内Source | 制限付き利用者としてProjectionを要求する | PPR-05として、「制限付き利用者としてProjectionを要求する」前後の複数Repository Source→Grant Filter→公開Viewについて、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | 値だけでなくSourceの存在自体を漏らさない | PPR-05、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「値だけでなくSourceの存在自体を漏らさない」および終了後条件「未解消状態と残存Effect／資源を評価へ引き渡す」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | 未解消状態と残存Effect／資源を評価へ引き渡す | Hybrid |
| `PPR-06` | 境界 | UT | Projection Semantics／Classification | 欠測・現行性・競合・可視性の判定規則 | N/A | complete、missing、restricted、stale、conflicting、unknownの各入力 | 各状態をProject Viewの項目へ変換する | PPR-06として、「各状態をProject Viewの項目へ変換する」前後の欠測・現行性・競合・可視性の判定規則について、入力差分、判定結果、欠落・重複・不一致および理由codeを記録する | 不完全性を空値・正常値・現在値へ畳まず、出所と時点を保つ | PPR-06、固定入力「complete、missing、restricted、stale、conflicting、unknownの各入力」、観測した差分と理由code、Oracle判定「不完全性を空値・正常値・現在値へ畳まず、出所と時点を保つ」および終了後条件「Source読取り・正本更新Effect 0」を保存する | Source読取り・正本更新Effect 0 | Automated |
| `PPR-07` | 利用者判断 | UAT | Acceptance／Comprehension | Project View→利用者判断 | User Acceptance | complete、partial、restricted、stale、conflicting、unknownを含む単一・複数Project View | 利用者が現在地、比較可能性、次の確認先を判断する | PPR-07として、利用者の選択、判断理由、参照した根拠、理解できなかった項目および未判断範囲を記録する | 不完全性と根拠を理解し、欠測を正常値として判断しない | PPR-07、固定した参加条件と入力、利用者の選択・理由・参照根拠、未判断範囲、Oracle判定「不完全性と根拠を理解し、欠測を正常値として判断しない」および終了後条件「Project正本・非開示Source Effect 0」を保存する | Project正本・非開示Source Effect 0 | Manual |
| `PPR-08` | 利用者判断 | UAT | Acceptance／Observation | 実行事実・未観測・評価候補→利用者判断 | User Acceptance | 出所・観測時点付きの観測済み、未観測、不明、評価候補を含む実行記録 | 利用者が事実の比較と評価候補の採否を判断する | PPR-08として、利用者の選択、判断理由、参照した根拠、理解できなかった項目および未判断範囲を記録する | 未観測を0や正常へ丸めず、事実と評価候補を区別して根拠へ戻れる | PPR-08、固定した参加条件と入力、利用者の選択・理由・参照根拠、未判断範囲、Oracle判定「未観測を0や正常へ丸めず、事実と評価候補を区別して根拠へ戻れる」および終了後条件「実行記録・対象Task・Provider Effect 0」を保存する | 実行記録・対象Task・Provider Effect 0 | Manual |
| `PPR-09` | 利用者判断 | UAT | Acceptance／History | 現在情報・履歴・置換済み情報→利用者判断 | User Acceptance | current、historical、superseded、unknownと、異なる発生時点・根拠を含む情報 | 利用者が現在の仕事へ使う情報と参照だけに使う履歴を選ぶ | PPR-09として、利用者の選択、判断理由、参照した根拠、理解できなかった項目および未判断範囲を記録する | 古い仮説や判断を現在値へ昇格せず、選択理由と根拠を説明できる | PPR-09、固定した参加条件と入力、利用者の選択・理由・参照根拠、未判断範囲、Oracle判定「古い仮説や判断を現在値へ昇格せず、選択理由と根拠を説明できる」および終了後条件「履歴・現在正本Effect 0」を保存する | 履歴・現在正本Effect 0 | Manual |
| `PPR-10` | 境界 | IT | Timing／Provenance | Clock Source→実行記録→Projector | Related 2 Blocks | 同一対象・異なるSource Revisionに、進行、遅延、逆行、欠落したObserved Atを与える固定入力 | Clock差と到着順を変えて現在値・履歴・unknownを投影する | PPR-10として、Source Revision、Clock種別、Observed At、到着順、算出した現行性、理由codeおよび正本Effect件数を記録する | Clock差や到着順だけで古い記録を現在値へ昇格せず、比較不能はunknownと理由付きで返す | PPR-10、固定したClock条件・Source Revision・Observed At・到着順、投影結果、理由code、Oracle判定および終了後の正本Effect 0を保存する。Hostの絶対Pathと不要な時刻情報は保存しない | 入力記録不変、正本Effect 0 | Automated |

## Semantic Coverage Pilot

この表はQuality Local Itemが検証する設計上の意味だけを正方向で宣言する。逆方向の一覧は生成し、本文の類似表現から推測しない。

| Local ID | Semantic Key |
|---|---|
| `PPR-01` | `project-runtime.project-state-projection` |
| `PPR-08` | `project-runtime.execution-intelligence-read-model` |

## 4. 評価と終了後条件

Passは、各項目の値とその出所／不完全性が同じ相関で返り、読取りがSourceや正本を書き換えず、利用側が欠測を現在値と誤認しない根拠がある場合とする。表示の理解性はSystem Verificationで別に確認する。

## 追加試験種別の適用

| 種別 | 適用 | 確認する範囲 | 実行許可 | 未実行時の扱い |
|---|---|---|---|---|
| RT | Required | 変更した意味と利用側から、再実行する既存Local Itemを選ぶ | Changeの通常検証範囲 | 未選択の範囲を明示し、選択した回帰の結果で評価する |
| PT | N/A | 現在のQuality Contractに性能成立条件がないため非該当 | N/A | 未実行をPassへ読み替えず、明示的なRelease条件でない限り通常監査を停止しない |
| LT | N/A | 現在のQuality Contractに長時間成立条件がないため非該当 | N/A | 未実行をPassへ読み替えず、明示的なRelease条件でない限り通常監査を停止しない |


## Checklist

- [x] Quality ID、検証目標およびSource固有条件を自己完結して示した
- [x] UT／IT／ST／UATの適用または理由付きN/Aを記録した
- [x] 外部境界の直接、隣接1 block、関連2 blocks、System／E2Eおよび利用者受入を適用判定した
- [x] 正常、境界、失敗および観測不能をLocal Itemで処置した
- [x] 各Local Itemで観測とOracleを分けた
- [x] 各Local ItemのEvidence要件を示した
- [x] 事前条件、刺激、終了後条件、cleanupおよびRecoveryを必要な範囲で示した
- [x] RT／PT／LTの適用または理由付きN/Aを記録し、PT／LTは人間の明示指定なしに実行しない
- [x] 自動化、手動確認および人間判断の境界を示した
- [x] 現行Source、TestおよびEvidenceとの照合をReality Auditへ分離した
