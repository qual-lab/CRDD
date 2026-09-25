# QA-000009 外部送信と公開Transportの検証定義

成果物種別: Quality定義
Quality ID: `QA-000009`
検証目標: 入口に依存せず同じApplication Contractを搬送し、許可された目的と最小情報だけを外部へ送り、結果を同じ依頼へ戻すこと
主な試験段階: Integration／System／User Acceptance
状態: Canonical
維持責任者: Qual-Lab

## 1. 情報源と網羅条件

| Source ID | Obligation Key | 導出元 | 保持する固有条件 | 試験段階 | 対応Local Item |
|---|---|---|---|---|
| [REQ-000006](../../../01_Discovery/Definitions/REQ-000006/requirement.md) | `req-000006.qa-000009` | Requirement Definition（成立条件・失敗・検証意図） | stdioとlocalhost HTTPが同じ入力を同じアプリケーション契約（Application Contract）へ渡す。正常、入力不正、判断待ち、回復要求、取消を同じ結果意味で返す。通信方式終了後に実行基盤状態や外部作用（Effect）が入口差で分岐しない。どの通信方式で失敗したかと、外部作用（Effect）が発行されたかを区別して確認できる。同一依頼を両通信方式で実行し、成功、拒否、取消、回復結果と実行基盤側外部作用（Effect）を比較する | IT／ST／UAT | `EST-IT-001`、`EST-IT-002`、`EST-ST-005`、`EST-UAT-007` |
| [REQ-000010](../../../01_Discovery/Definitions/REQ-000010/requirement.md) | `req-000010.qa-000009` | Requirement Definition（成立条件・失敗・検証意図） | TS API、CLI、MCP、Workbenchの代表操作が同じ公開契約へ接続する。入口ごとに同じ決定権限、欠測、取消、結果意味を保持する。更新はWorkbench等の独自Storeでなく所有正本へ反映される。同じ正常、拒否、部分結果、取消を複数入口から実行し、構造結果と正本外部作用（Effect）を比較する | IT／UAT | `EST-IT-010`、`EST-UAT-007` |
| [REQ-000017](../../../01_Discovery/Definitions/REQ-000017/requirement.md) | `req-000017.qa-000009` | Requirement Definition（成立条件・失敗・検証意図） | 情報要素ごとに情報源、改訂版、利用範囲を保持する。許可されない、取得不能、競合する情報を推測で補完しない。Packageはタスク目的に必要な最小範囲で、中央の永続正本にならない。単一プロジェクト、複数リポジトリ、複数プロジェクト、部分アクセス、競合を与え、Package内容と欠測、根拠到達を観測する | IT／ST／UAT | `EST-ST-003`、`EST-IT-004`、`EST-UAT-008` |
| [REQ-000021](../../../01_Discovery/Definitions/REQ-000021/requirement.md) | `req-000021.qa-000009` | Requirement Definition（成立条件・失敗・検証意図） | 依頼受理時に再取得可能な安定識別情報を返す。応答喪失後も同じ識別情報から現在状態と確定結果を取得する。再照会が元外部作用（Effect）を再発行せず、権限と情報開示を再検証する。要求前切断、受理後切断、外部作用（Effect）後応答喪失、再照会、別接続資格情報照会を行い、重複外部作用（Effect）と情報開示を観測する | IT／ST／UAT | `EST-ST-005`、`EST-IT-004`、`EST-UAT-009` |
| [REQ-000024](../../../01_Discovery/Definitions/REQ-000024/requirement.md) | `req-000024.qa-000009` | Requirement Definition（成立条件・失敗・検証意図） | 委譲前にタスクの識別情報、対象リポジトリ、許可範囲、期待結果、帰還先を固定する。実行結果に作成側、対象改訂版、変更、根拠を結び付ける。帰還時に決定権限を再確認し、元タスクまたは所有正本以外へ反映しない。正常帰還、結果拒否、帰還先消失、改訂版競合、部分結果、再送を行い、相関と外部作用（Effect）を観測する | ST／UAT | `EST-ST-003`、`EST-ST-011`、`EST-UAT-006` |
| [REQ-000027](../../../01_Discovery/Definitions/REQ-000027/requirement.md) | `req-000027.qa-000009` | Requirement Definition（成立条件・失敗・検証意図） | 外部作用（Effect）の前に送信先、目的、操作、情報分類、許可範囲を確定する。外部内容を指示、決定権限、要求、因果へ自動昇格せず出典付き観察として戻す。新しい要求や方針変更は人間採用判断を経て所有正本へ反映する。許可／不許可情報、外部指示、矛盾情報、公開反応、依存更新を与え、外部送信による作用と内部昇格を観測する | IT／ST／UAT | `EST-IT-004`、`EST-ST-003`、`EST-UAT-006` |
| [UX-000012](../../../02_UX/Definitions/UX-000012/ux_definition.md) | `ux-000012.qa-000009` | UX Definition（利用者成果・重要場面・重要な失敗） | stdio MCPとlocalhost HTTPのどちらでも、同じ入力・権限・状態・結果で仕事を続けられる。失敗時は、失敗した通信方式と外部作用（Effect）が発行されたかを区別して、入口変更や再処置を判断できる。重要場面「入口を切り替えて同じ仕事を開始・継続する場面」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。stdio MCPとlocalhost HTTPで入力・権限判断・状態・結果が変わること、および失敗した通信方式と外部作用の発行有無を識別できない表示を反証する | IT／ST／UAT | `EST-IT-001`、`EST-ST-005`、`EST-UAT-007` |
| [UX-000019](../../../02_UX/Definitions/UX-000019/ux_definition.md) | `ux-000019.qa-000009` | UX Definition（利用者成果・重要場面・重要な失敗） | 必要最小限の情報を出所・現行性・許可付きで渡し、相関・完全性付きの結果を同じタスクへ戻せる。重要場面「外部境界へ情報を出す直前」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。全量投入、秘密情報混入、情報捏造、別タスク結果混入およびAgent完了の自動採用を反証する | ST／UAT | `EST-ST-005`、`EST-ST-003`、`EST-UAT-008` |
| [UX-000021](../../../02_UX/Definitions/UX-000021/ux_definition.md) | `ux-000021.qa-000009` | UX Definition（利用者成果・重要場面・重要な失敗） | 応答喪失後に新規実行せず、現在の利用権限で同じ依頼の状態・結果・回復義務へ戻れる。重要場面「再実行するか判断する直前」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。再接続時の外部作用（Effect）の二重実行、古いセッションの決定権限および別依頼への誤結合を反証する | IT／ST／UAT | `EST-ST-005`、`EST-IT-004`、`EST-UAT-009` |
| [UX-000024](../../../02_UX/Definitions/UX-000024/ux_definition.md) | `ux-000024.qa-000009` | UX Definition（利用者成果・重要場面・重要な失敗） | 外部作用（Effect）の前に送信先・目的・操作・情報分類・許可範囲を理解し、外部情報・反応・依存新版を出典付き候補として扱える。重要場面「外部作用（Effect）の前と結果昇格時」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。接続済み・過去同意からの包括許可、不要情報送信、外部反応・依存新版の要求／因果／方針への自動昇格を反証する | IT／ST／UAT | `EST-ST-005`、`EST-ST-003`、`EST-IT-004`、`EST-UAT-006` |
| [IA-000008](../../../03_IA/Definitions/IA-000008/ia_definition.md) | `ia-000008.qa-000009` | IA Definition（情報・関係・状態・見つけ方） | 入口を変えても同じ要求、権限判断、状態、結果へ到達する。UX-000012: 受付前／受付済み／作用前失敗／作用後失敗／結果あり | IT／ST／UAT | `EST-ST-005`、`EST-IT-001`、`EST-UAT-007` |
| [IA-000014](../../../03_IA/Definitions/IA-000014/ia_definition.md) | `ia-000014.qa-000009` | IA Definition（情報・関係・状態・見つけ方） | 必要最小の情報を出所付きで渡し、同じ仕事へ結果と未決事項を戻す。UX-000019: 準備済み（prepared）／送信済み（sent）／受領済み（received）／返却済み（returned）／停止（blocked）。UX-000021: 進行中（active）／切断（disconnected）／結果取得可能（result_available）／回復必要（recovery_required）／確定済み（settled）。UX-000024: 未許可（not_authorized）／許可済み（authorized）／送信済み（sent）／返却済み（returned）／候補（candidate）／採用（adopted） | IT／ST／UAT | `EST-ST-003`、`EST-IT-001`、`EST-IT-004`、`EST-UAT-006`、`EST-UAT-008`、`EST-UAT-009` |
| [IA-000017](../../../03_IA/Definitions/IA-000017/ia_definition.md) | `ia-000017.qa-000009` | IA Definition（情報・関係・状態・見つけ方） | 外部へ何をなぜ渡すかを判断し、戻った結果を自動採用しない。UX-000024: 未許可（not_authorized）／許可済み（authorized）／送信済み（sent）／返却済み（returned）／候補（candidate）／採用（adopted） | ST／UAT | `EST-ST-003`、`EST-ST-005`、`EST-UAT-006` |
| [UI-000007](../../../04_UI/Definitions/UI-000007/ui_definition.md) | `ui-000007.qa-000009` | UI Definition（認識・操作・Feedback・失敗表示） | CLI、MCP、Workbenchの入口を変えても同じ依頼と結果を扱える。UX-000012: 通信方式を変えても同じ公開契約・入力・権限判断で操作する: 入口を切り替えて同じ仕事を開始・継続する場面: 公開契約・入力・権限判断・状態・結果を通信方式間で一致させる: 通信方式によって入力・権限判断・状態・結果の意味が変わる。UX-000012／IA-000008: 受付前／受付済み／作用前失敗／作用後失敗／結果あり: 入口→同じ公開要求→Runtime→同じ結果 | IT／ST／UAT | `EST-IT-001`、`EST-ST-003`、`EST-UAT-007` |
| [UI-000012](../../../04_UI/Definitions/UI-000012/ui_definition.md) | `ui-000012.qa-000009` | UI Definition（認識・操作・Feedback・失敗表示） | 必要な情報を限定して渡し、切断後も同じ仕事へ戻れる。UX-000019: 必要な情報だけを出所付きで渡す: 外部境界へ情報を出す直前: 情報源・改訂版・選択理由を保持する: 全量投入・秘密情報混入・古い仮説の現在値化。UX-000021: 切断後に同じ依頼へ戻る: 再実行するか判断する直前: 同一識別情報の照会を再実行より先に示す: Timeoutを未実行とみなし新規外部作用（Effect）を起こす。UX-000019／IA-000014: 準備済み（prepared）／送信済み（sent）／受領済み（received）／返却済み（returned）／停止（blocked）: 情報源→選択→仕事用情報一式（Context Package）→Task→結果（Result）→元の仕事。UX-000021／IA-000014: 進行中（active）／切断（disconnected）／結果取得可能（result_available）／回復必要（recovery_required）／確定済み（settled）: 再接続→同じ依頼（Request）→現在権限→状態・結果→回復義務。UX-000021／IA-000003: 進行中（active）／切断（disconnected）／結果取得可能（result_available）／回復必要（recovery_required）／確定済み（settled）: 再接続→同じ依頼（Request）→現在権限→状態・結果→回復義務 | IT／ST／UAT | `EST-IT-004`、`EST-ST-003`、`EST-ST-005`、`EST-UAT-008`、`EST-UAT-009` |
| [UI-000016](../../../04_UI/Definitions/UI-000016/ui_definition.md) | `ui-000016.qa-000009` | UI Definition（認識・操作・Feedback・失敗表示） | 外部へ渡す範囲を理解し、戻った候補を採用前に判断できる。UX-000024: 送信範囲と内部へ戻す際の昇格条件を理解する: 外部作用（Effect）の前と結果昇格時: 同意・投影・採用を分離する: 接続済みを包括許可とし、外部反応や依存新版を要求・因果・方針へ自動昇格する。UX-000024／IA-000014: 未許可（not_authorized）／許可済み（authorized）／送信済み（sent）／返却済み（returned）／候補（candidate）／採用（adopted）: 送信候補→境界確認→送信する最小情報→送信→出所付き結果→採否。UX-000024／IA-000017: 未許可（not_authorized）／許可済み（authorized）／送信済み（sent）／返却済み（returned）／候補（candidate）／採用（adopted）: 送信候補→境界確認→送信する最小情報→送信→出所付き結果→採否 | IT／ST／UAT | `EST-IT-004`、`EST-ST-003`、`EST-UAT-006` |
| [SPEC-000011](../../../05_SPEC/Definitions/SPEC-000011/spec_definition.md) | `spec-000011.qa-000009` | SPEC Definition（正常・境界・失敗・観測不能・副作用） | 正常: 入口の違いでAuthorityや結果の意味が変わらない。境界: 対応Transport／未対応Transport、同義入力／不正入力を分け、入口固有値で意味を変えない。失敗: Transport固有値を意味契約へ混入せず、未対応入口を成立済みと表示しない。観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「Transport自体は意味を変更しない。下流Effectは同じApplication契約で制御する」と矛盾する結果を返さない。失敗: Transport固有値を意味契約へ混入せず、未対応入口を成立済みと表示しない。副作用: Transport自体は意味を変更しない。下流Effectは同じApplication契約で制御する。本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す | IT／ST／UAT | `EST-IT-001`、`EST-IT-002`、`EST-ST-005`、`EST-UAT-007` |
| [SPEC-000017](../../../05_SPEC/Definitions/SPEC-000017/spec_definition.md) | `spec-000017.qa-000009` | SPEC Definition（正常・境界・失敗・観測不能・副作用） | 正常: 情報搬送と実行、結果生成と結果帰還を別状態として返す。境界: Request Identity一致／不一致、接続中／切断、結果あり／未取得を分け、別依頼を再発行しない。失敗: 応答喪失を未実行とみなさず、別依頼として再発行しない。観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「許可時だけ情報搬送または結果取得を行う。応答喪失後はProvider Effectを再発行しない」と矛盾する結果を返さない。失敗: 応答喪失を未実行とみなさず、別依頼として再発行しない。副作用: 許可時だけ情報搬送または結果取得を行う。応答喪失後はProvider Effectを再発行しない。応答喪失またはEffect不明では同じ識別情報で再確認し、終了後確認まで回復義務を保持する | IT／ST／UAT | `EST-ST-005`、`EST-IT-004`、`EST-ST-003`、`EST-UAT-009` |
| [SPEC-000021](../../../05_SPEC/Definitions/SPEC-000021/spec_definition.md) | `spec-000021.qa-000009` | SPEC Definition（正常・境界・失敗・観測不能・副作用） | 正常: 送信前検査と送信Effectを区別し、利用した同意範囲を結果へ結合する。境界: 同意範囲内／範囲外、有効／期限切れ／不明を分け、範囲外では送信Effectを発行しない。失敗: 期限切れ・範囲変更・不明な同意ではEffect 0で停止する。観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「許可範囲の外部送信Effectを発行し、送信時の依頼識別情報と同意範囲を結果へ結合する」と矛盾する結果を返さない。失敗: 期限切れ・範囲変更・不明な同意ではEffect 0で停止する。副作用: 許可範囲の外部送信Effectを発行し、送信時の依頼識別情報と同意範囲を結果へ結合する。本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す | IT／ST／UAT | `EST-ST-005`、`EST-IT-004`、`EST-ST-003`、`EST-UAT-006` |
| [SPEC-000026](../../../05_SPEC/Definitions/SPEC-000026/spec_definition.md) | `spec-000026.qa-000009` | SPEC Definition（正常・境界・失敗・観測不能・副作用） | 正常: 結果受領と候補採用を分け、元の依頼と出所に結合した未信頼候補を返す。境界: 依頼Identity一致／欠落／曖昧を分け、結合不能な応答を採用可能候補へしない。失敗: 送信時の識別情報へ結合できない結果は採用可能な候補へしない。観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「受領した結果を元Taskへ結合し、未信頼候補として返す。Provider Effectを再発行しない」と矛盾する結果を返さない。失敗: 送信時の識別情報へ結合できない結果は採用可能な候補へしない。副作用: 受領した結果を元Taskへ結合し、未信頼候補として返す。Provider Effectを再発行しない。本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す | IT／ST／UAT | `EST-IT-004`、`EST-ST-005`、`EST-ST-003`、`EST-UAT-006` |
| [ARCH-000012](../../../06_Architecture/Definitions/ARCH-000012/architecture_definition.md) | `arch-000012.qa-000009` | Architecture Definition（責務・境界・状態・故障） | 受付前／受付済／Effect前後の失敗／結果ありを入口間で同じ意味に保つ。Transport固有Schemaを公開意味契約として再定義しない。所有する責務: decode／encode、接続Lifecycle、公開Application Contractへの搬送。所有しない責務: Project Runtimeの意味契約、Authority追加、Provider実行。主な外部境界: CLI、MCP stdio、localhost HTTP、将来のWorkbench。SPEC-000011: Transport固有値を意味契約へ混入せず、未対応入口を成立済みと表示しない。Effect: Transport自体は意味を変更しない。下流Effectは同じApplication契約で制御する。入力SPECが固有Recoveryを定義しない場合、Architectureから追加しない。結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める | IT／UAT | `EST-IT-001`、`EST-IT-002`、`EST-IT-004`、`EST-UAT-007` |
| [ARCH-000015](../../../06_Architecture/Definitions/ARCH-000015/architecture_definition.md) | `arch-000015.qa-000009` | Architecture Definition（責務・境界・状態・故障） | not_authorized→authorized→sent→returned→candidate→adoptedを別AuthorityとEffectにし、送信、受領、採用を相互流用しない。所有する責務: 目的限定の送信同意、最小化送信、同じ依頼への結果帰還、候補隔離、採否。所有しない責務: 送信同意からの結果採用、外部AIへの決定権限移譲、所有正本の無断更新。主な外部境界: 外部AI／API／MCP、Candidate Store、所有正本、人間判断。SPEC-000021: 期限切れ・範囲変更・不明な同意ではEffect 0で停止する。Effect: 許可範囲の外部送信Effectを発行し、送信時の依頼識別情報と同意範囲を結果へ結合する。SPEC-000026: 送信時の識別情報へ結合できない結果は採用可能な候補へしない。Effect: 受領した結果を元Taskへ結合し、未信頼候補として返す。Provider Effectを再発行しない。SPEC-000027: 結果受領や送信許可を候補採用Authorityへ流用しない。Effect: 採用時だけ所有正本を更新する。却下・保留では正本Effect 0。入力SPECが固有Recoveryを定義しない場合、Architectureから追加しない。結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める | IT／ST／UAT | `EST-ST-003`、`EST-IT-004`、`EST-IT-001`、`EST-UAT-006` |
### Architecture詳細設計入力

| 詳細設計領域 | 受け取る成立条件 |
|---|---|
| [coordinator](../../../06_Architecture/Details/coordinator/01_Architecture.md) | 実行編成、Authority、外部Effect、候補、回収・回復 |
| [cros](../../../06_Architecture/Details/cros/01_Architecture.md) | Repository横断解決、Grant、投影、外部接続、候補処置 |
| [mcp](../../../06_Architecture/Details/mcp/01_Architecture.md) | Transport変換、公開Schema、Session、結果搬送 |
| [project-runtime](../../../06_Architecture/Details/project-runtime/01_Architecture.md) | Objective、Task、判断、取消、回復、公開結果 |

## 2. 試験段階と外部境界の適用

| 試験段階 | 適用 | 確認する範囲 | 外部境界の到達範囲 | 判断理由 |
| --- | --- | --- | --- | --- |
| UT | Conditional | Schema変換、Policy判定、相関の純粋規則 | N/A | Transport起動前に局所判断を反証できる場合に必要 |
| IT | Required | CLI／MCP Adapter、Application Contract、Provider境界 | Related 2 Blocks | 搬送差、切断、許可、結果帰還を局所化するため |
| ST | Required | 公開入口から外部送信、結果帰還、終了後まで | System/E2E | 実Providerを含む利用経路の完成を確認するため |
| UAT | Required | 利用者が送信範囲と結果を理解して判断する場面 | User Acceptance | 同意範囲と帰還結果を理解して送信・停止を選べる利用者成果を確認するため |

### 条件区分の適用

| 条件区分 | 適用 | 対応Local Item | 判断理由 |
|---|---|---|---|
| 正常 | Required | EST-IT-001、EST-ST-003 | 通常の成立経路を独立して確認する。 |
| 境界 | Required | EST-IT-004、EST-UAT-006、EST-UAT-007、EST-UAT-008、EST-UAT-009、EST-IT-010、EST-ST-011 | 値、Authority、情報、責務または利用者判断の境界を確認する。 |
| 準正常 | N/A | - | 継続可能な分岐または保留状態を持たない。 |
| 異常 | Required | EST-IT-002、EST-ST-012 | 不正入力、故障または拒否経路を通常成功へ畳まない。 |
| 回復 | Required | EST-ST-005 | 失敗・取消後に同じIdentityと義務で安全に再入場できることを確認する。 |

## 3. 検証項目

| Local ID | 条件区分 | 試験段階 | 試験種別 | 対象／境界 | 外部境界の段階 | 事前状態／入力 | 操作／刺激 | 観測 | Oracle | Evidence | 終了後条件 | 実行形態 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `EST-IT-001` | 正常 | IT | Transport Contract | CLI／MCP Adapter→Application Contract | Direct Boundary | 同義Application入力とCLI・MCP stdio・MCP HTTPの各入口 | 各Transportから同じ要求を送り結果を比較する | EST-IT-001として、「各Transportから同じ要求を送り結果を比較する」前後のCLI／MCP Adapter→Application Contractについて、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | decode後のApplication入力とencode前の結果が同一で、Transport固有のAuthorityを発行しない | EST-IT-001、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「decode後のApplication入力とencode前の結果が同一で、Transport固有のAuthorityを発行しない」および終了後条件「入口ごとのProcess／streamが終了」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | 入口ごとのProcess／streamが終了 | Automated |
| `EST-IT-002` | 異常 | IT | Contract／Fault | Transport stream→Adapter→Application入口 | Adjacent 1 Block | Schema差、必須field欠落、stderr混入、切断後遅延結果の各反例 | 各Transportへ反例を入力する | EST-IT-002として、「各Transportへ反例を入力する」前後のTransport stream→Adapter→Application入口について、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | 意味差を拒否し、重複実行やstdout汚染を発生させない | EST-IT-002、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「意味差を拒否し、重複実行やstdout汚染を発生させない」および終了後条件「追加Application Effect 0」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | 追加Application Effect 0 | Automated |
| `EST-ST-003` | 正常 | ST | External Send／Scenario | 公開入口→同意Gate→Provider→結果帰還 | System/E2E | 送信先・目的・情報分類・同意・Request Identityが明示された要求 | 許可範囲内の外部送信を一回実行する | EST-ST-003として、「許可範囲内の外部送信を一回実行する」前後の公開入口→同意Gate→Provider→結果帰還について、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | 許可範囲の最小情報だけを送り、同じRequest Identityへ結果を戻す | EST-ST-003、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「許可範囲の最小情報だけを送り、同じRequest Identityへ結果を戻す」および終了後条件「同意の使用範囲と送信結果を相関」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | 同意の使用範囲と送信結果を相関 | Automated |
| `EST-IT-004` | 境界 | IT | Security／Authorization | Application要求→Policy→Provider Adapter | Related 2 Blocks | Secret、目的外情報、失効・取消済み同意、別依頼結果の各入力 | 各入力でProvider Effectを要求する | EST-IT-004として、「各入力でProvider Effectを要求する」前後のApplication要求→Policy→Provider Adapterについて、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | Provider Effect前に停止し、対象の存在や内容を漏らさない | EST-IT-004、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「Provider Effect前に停止し、対象の存在や内容を漏らさない」および終了後条件「Provider／正本Effect 0」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | Provider／正本Effect 0 | Automated |
| `EST-ST-005` | 回復 | ST | Partial Failure／Recovery | 公開入口→Provider→候補・回復→利用側結果 | System/E2E | 送信受理済みRequestと、切断・部分結果・帰還失敗の注入点 | 受理後の各故障を発生させる | EST-ST-005として、「受理後の各故障を発生させる」前後の公開入口→Provider→候補・回復→利用側結果について、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | Effect不明、部分成功、帰還失敗を別状態で返し、生結果を自動採用しない | EST-ST-005、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「Effect不明、部分成功、帰還失敗を別状態で返し、生結果を自動採用しない」および終了後条件「候補または回復義務を保持」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | 候補または回復義務を保持 | Automated |
| `EST-UAT-006` | 境界 | UAT | Acceptance／Consent | 送信内容・同意Gate・帰還結果→利用者 | User Acceptance | 送信先、目的、情報分類、同意範囲、失敗・部分結果を含む依頼 | 利用者が送信・拒否・取消・結果処置を判断する | EST-UAT-006として、利用者の選択、判断理由、参照した根拠、理解できなかった項目および未判断範囲を記録する | 何をどこへ送るかと結果状態を理解し、許可外送信を要求されない | EST-UAT-006、固定した参加条件と入力、利用者の選択・理由・参照根拠、未判断範囲、Oracle判定「何をどこへ送るかと結果状態を理解し、許可外送信を要求されない」および終了後条件「未許可Provider Effect 0」を保存する | 未許可Provider Effect 0 | Manual |
| `EST-UAT-007` | 境界 | UAT | Acceptance／Entry Equivalence | CLI・MCP stdio・MCP HTTP・Workbench入口→同じ仕事 | User Acceptance | 同じ依頼、入力、権限、状態、結果を扱う複数入口と、入口固有の失敗 | 利用者が入口を切り替えて同じ仕事を開始・継続する | EST-UAT-007として、利用者の選択、判断理由、参照した根拠、理解できなかった項目および未判断範囲を記録する | 入口が変わっても要求・権限判断・状態・結果の意味が変わらず、失敗境界を識別できる | EST-UAT-007、固定した参加条件と入力、利用者の選択・理由・参照根拠、未判断範囲、Oracle判定「入口が変わっても要求・権限判断・状態・結果の意味が変わらず、失敗境界を識別できる」および終了後条件「重複Application／Provider Effect 0」を保存する | 重複Application／Provider Effect 0 | Manual |
| `EST-UAT-008` | 境界 | UAT | Acceptance／Context Scope | 送信する仕事用情報一式と帰還結果→利用者 | User Acceptance | 情報源、改訂版、利用範囲、欠測・競合を持つ最小情報一式と帰還結果 | 利用者が送信範囲と結果の再利用可否を判断する | EST-UAT-008として、利用者の選択、判断理由、参照した根拠、理解できなかった項目および未判断範囲を記録する | 全量投入や推測補完をせず、出所・現行性・不足を理解して同じ仕事へ戻せる | EST-UAT-008、固定した参加条件と入力、利用者の選択・理由・参照根拠、未判断範囲、Oracle判定「全量投入や推測補完をせず、出所・現行性・不足を理解して同じ仕事へ戻せる」および終了後条件「未許可情報送信・正本Effect 0」を保存する | 未許可情報送信・正本Effect 0 | Manual |
| `EST-UAT-009` | 境界 | UAT | Acceptance／Reconnect | 切断した依頼・同一識別情報・現在権限→利用者 | User Acceptance | 要求前切断、受理後切断、Effect後応答喪失、結果取得可能、回復必要の各状態 | 利用者が再実行・再照会・回復を選ぶ | EST-UAT-009として、利用者の選択、判断理由、参照した根拠、理解できなかった項目および未判断範囲を記録する | 新規実行より同一依頼の状態確認を先に選び、別依頼や古い権限へ誤結合しない | EST-UAT-009、固定した参加条件と入力、利用者の選択・理由・参照根拠、未判断範囲、Oracle判定「新規実行より同一依頼の状態確認を先に選び、別依頼や古い権限へ誤結合しない」および終了後条件「重複Provider Effect 0、未解消回復義務を保持」を保存する | 重複Provider Effect 0、未解消回復義務を保持 | Manual |
| `EST-IT-010` | 境界 | IT | Surface Contract／Effect Equivalence | TS API・CLI・MCP・Workbench→同一Application Contract→正本 | Related 2 Blocks | 正常、拒否、部分結果、取消の同一固定入力と四入口 | 各入口から同じ操作を実行する | 入口Identity、Application Contract、構造結果、Authority判定、取消結果、正本差分、Effect件数を記録する | 全入口が同じ契約と共有実装を使い、結果意味と正本更新が一致し、独自Storeを作らない | EST-IT-010、入口別契約・結果・差分・Effect比較、Oracleを保存する | 入口固有Store 0、取消後残存資源0 | Automated |
| `EST-ST-011` | 境界 | ST | Result Return／Correlation | 委譲実行→結果搬送→元Task・所有正本 | Related 2 Blocks | 正常帰還、拒否、帰還先消失、Revision競合、部分結果、再送を含む固定Task | 各結果を帰還先へ搬送し反映可否を判定する | Task・Request Identity、作成側、対象Revision、変更集合、Evidence参照、帰還先、Authority、Effect件数を相関する | 正常時だけ作成側・Revision・変更・Evidenceを保って元Task／正本へ帰還し、競合・再送を重複反映しない | EST-ST-011、全相関Identity、変更集合Hash、Evidence参照、判定理由、Effect件数を保存する | 拒否・競合・再送時の重複Effect 0 | Automated |
| `EST-ST-012` | 異常 | ST | Stdio Transport Scenario | MCP stdio入口→Application→応答stream | System/E2E | UTF-8分割、EOF、取消競合、正常frameを含むProcess入力 | 実Process境界でframeを送受信する | byte列、frame、Application結果、取消・終了状態を記録する | framingを保ち分割・EOF・取消競合を成功応答へ畳まない | 入出力byte分類、結果、終了状態、判定 | handle／listener／child残存0 | Automated |

## 4. 評価とEvidence

生Provider出力をEvidenceへ複製しない。相関Identity、送信先分類、同意の適用可否、外部Effectの段階、搬送結果、公開結果、終了後資源を、機密を含まず同じrunで追跡できること。

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
| [SCR-000007／PRT-000007](../../../04_UI/Details/Areas/operation/SCR-000007/screen.md) | UI-000007 | 情報、操作、Feedback、状態、失敗、Unknownおよび回復をScreen／Part境界で観測する | Mapped |
| [SCR-000012／PRT-000012](../../../04_UI/Details/Areas/operation/SCR-000012/screen.md) | UI-000012 | 情報、操作、Feedback、状態、失敗、Unknownおよび回復をScreen／Part境界で観測する | Mapped |
| [SCR-000016／PRT-000016](../../../04_UI/Details/Areas/operation/SCR-000016/screen.md) | UI-000016 | 情報、操作、Feedback、状態、失敗、Unknownおよび回復をScreen／Part境界で観測する | Mapped |
| [BHV-000011](../../../05_SPEC/Details/BHV-000011/behavior.md) | SPEC-000011 | Trigger、Authority、Validation、State、Effect、Result、FailureおよびRecoveryをBehavior境界で観測する | Mapped |
| [BHV-000017](../../../05_SPEC/Details/BHV-000017/behavior.md) | SPEC-000017 | Trigger、Authority、Validation、State、Effect、Result、FailureおよびRecoveryをBehavior境界で観測する | Mapped |
| [BHV-000021](../../../05_SPEC/Details/BHV-000021/behavior.md) | SPEC-000021 | Trigger、Authority、Validation、State、Effect、Result、FailureおよびRecoveryをBehavior境界で観測する | Mapped |
| [BHV-000026](../../../05_SPEC/Details/BHV-000026/behavior.md) | SPEC-000026 | Trigger、Authority、Validation、State、Effect、Result、FailureおよびRecoveryをBehavior境界で観測する | Mapped |

担当Interaction Relation: `PRT-000007.spec-000011`、`PRT-000012.spec-000017`、`PRT-000016.spec-000021`、`PRT-000016.spec-000026`

全数Coverageと試験段階の扱いは[UI／SPEC DetailのQuality分析](../../Analysis/Detail/quality_analysis.md)を中央統合投影とし、本定義は上記Relationの検証責務を局所所有する。

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
