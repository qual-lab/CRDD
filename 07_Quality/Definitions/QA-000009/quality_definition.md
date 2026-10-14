# QA-000009 外部送信と公開Transportの検証定義

成果物種別: Quality定義
Quality ID: `QA-000009`
検証目標: 入口に依存せず同じApplication Contractを搬送し、許可された目的と最小情報だけを外部へ送り、結果を同じ依頼へ戻すこと
主な試験段階: Integration／System／User Acceptance
状態: Canonical
維持責任者: Qual-Lab

## 1. 情報源と網羅条件

共有Git操作の直接接続候補は`RFD-IT-014`／`EST-IT-002`／`EST-IT-010`へ接続する。自己生成二Repositoryとlocal bare Remoteで、選択先だけのStage／Unstage／Commit、現在公開先・Branch・Revisionと明示確認を伴う通常Push、一回処置と要求専用結果を確認する。重複・余剰・越境・非許可対象・確認欠落・古いRevision・任意Remoteは配送0とし、処置後失効は固定未確認通知、blockedの発行済みEffectとOwner unknownは保持する。注入したProcess errorの試験を実timeoutやProcess tree不存在の証明にしない。実行中切断・Browser操作・公開CLIと正式項目全体の成立は別途確認する。

選択成果物の本文リンク候補では、`RFD-IT-024`／`EST-IT-002`／`EST-IT-010`／`EST-IT-014`へ実HTTP試験を接続する。同名CHG・Owner成果物を二Repositoryに配置し、選択Root・閉入力・Catalog許可・実Path境界・読取り前後の512 KiB上限・公開前の現在認可を確認する。不正入力で本文read 0と正常正対照を区別し、読取り開始後の切断ではReaderをjoinして成功本文0を確認する。`EST-ST-013`の限定Browser確認では原文の文字列表示、出所と要求URLの相関、履歴移動、旧応答拒否、再読込後の資格なし再接続を扱う。これらは公開Launcher・全Transport終端・正式項目全体の成立を代替しない。

| Source ID | Obligation Key | 導出元 | 保持する固有条件 | 試験段階 | 対応Local Item |
|---|---|---|---|---|
| [REQ-000006](../../../01_Discovery/Definitions/REQ-000006/requirement.md) | `req-000006.qa-000009` | Requirement Definition（成立条件・失敗・検証意図） | stdioとlocalhost HTTPが同じ入力を同じアプリケーション契約（Application Contract）へ渡す。正常、入力不正、判断待ち、回復要求、取消を同じ結果意味で返す。通信方式終了後に実行基盤状態や外部作用（Effect）が入口差で分岐しない。どの通信方式で失敗したかと、外部作用（Effect）が発行されたかを区別して確認できる。同一依頼を両通信方式で実行し、成功、拒否、取消、回復結果と実行基盤側外部作用（Effect）を比較する | IT／ST／UAT | `EST-IT-001`、`EST-IT-002`、`EST-ST-005`、`EST-UAT-007`、`EST-IT-014` |
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
| [ARCH-000012](../../../06_Architecture/Definitions/ARCH-000012/architecture_definition.md) | `arch-000012.qa-000009` | Architecture Definition（責務・境界・状態・故障） | 受付前／受付済／Effect前後の失敗／結果ありを入口間で同じ意味に保つ。Transport固有Schemaを公開意味契約として再定義しない。所有する責務: decode／encode、接続Lifecycle、公開Application Contractへの搬送。所有しない責務: Orchestratorの意味契約、Authority追加、Provider実行。主な外部境界: CLI、MCP stdio、localhost HTTP、将来のWorkbench。SPEC-000011: Transport固有値を意味契約へ混入せず、未対応入口を成立済みと表示しない。Effect: Transport自体は意味を変更しない。下流Effectは同じApplication契約で制御する。入力SPECが固有Recoveryを定義しない場合、Architectureから追加しない。結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める | IT／UAT | `EST-IT-001`、`EST-IT-002`、`EST-IT-004`、`EST-UAT-007`、`EST-IT-014` |
| [ARCH-000015](../../../06_Architecture/Definitions/ARCH-000015/architecture_definition.md) | `arch-000015.qa-000009` | Architecture Definition（責務・境界・状態・故障） | not_authorized→authorized→sent→returned→candidate→adoptedを別AuthorityとEffectにし、送信、受領、採用を相互流用しない。所有する責務: 目的限定の送信同意、最小化送信、同じ依頼への結果帰還、候補隔離、採否。所有しない責務: 送信同意からの結果採用、外部AIへの決定権限移譲、所有正本の無断更新。主な外部境界: 外部AI／API／MCP、Candidate Store、所有正本、人間判断。SPEC-000021: 期限切れ・範囲変更・不明な同意ではEffect 0で停止する。Effect: 許可範囲の外部送信Effectを発行し、送信時の依頼識別情報と同意範囲を結果へ結合する。SPEC-000026: 送信時の識別情報へ結合できない結果は採用可能な候補へしない。Effect: 受領した結果を元Taskへ結合し、未信頼候補として返す。Provider Effectを再発行しない。SPEC-000027: 結果受領や送信許可を候補採用Authorityへ流用しない。Effect: 採用時だけ所有正本を更新する。却下・保留では正本Effect 0。入力SPECが固有Recoveryを定義しない場合、Architectureから追加しない。結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める | IT／ST／UAT | `EST-ST-003`、`EST-IT-004`、`EST-IT-001`、`EST-UAT-006` |
| [ARCH-000013](../../../06_Architecture/Definitions/ARCH-000013/architecture_definition.md) | `arch-000013.qa-000009` | Architecture Definition（公開境界） | MCPの全鍵操作と初期化開始・状態照会を一覧・Schema・登録・dispatchから除外。初回資格には完全な非秘密server/discoverだけを許し、通常Toolを渡さない。不正要求の初回確認Owner呼出し0、正規要求だけexact 1回。保存と次通常接続の正の成立はQA-000007が所有する | ST | `EST-ST-015` |

### Architecture詳細設計入力

| 詳細設計領域 | 受け取る成立条件 |
|---|---|
| [coordinator](../../../06_Architecture/Details/coordinator/01_Architecture.md) | 実行編成、Authority、外部Effect、候補、回収・回復 |
| [cros](../../../06_Architecture/Details/cros/01_Architecture.md) | Repository横断解決、Grant、投影、外部接続、候補処置 |
| [mcp](../../../06_Architecture/Details/mcp-server/01_Architecture.md) | Transport変換、公開Schema、Session、結果搬送 |
| [orchestrator](../../../06_Architecture/Details/orchestrator/01_Architecture.md) | Objective、Task、判断、取消、回復、公開結果 |
| [workbench](../../../06_Architecture/Details/workbench-server/01_Architecture.md) | Repository単体／Local CROS／Remote CROSの入口差とAI依頼の外部送信境界 |

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
| 境界 | Required | EST-ST-015、EST-IT-004、EST-UAT-006、EST-UAT-007、EST-UAT-008、EST-UAT-009、EST-IT-010、EST-ST-011、EST-IT-014 | 値、Authority、情報、責務または利用者判断の境界を確認する。 |
| 準正常 | N/A | - | 継続可能な分岐または保留状態を持たない。 |
| 異常 | Required | EST-IT-002、EST-ST-012、EST-ST-013 | 不正入力、故障または拒否経路を通常成功へ畳まない。 |
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
| `EST-IT-010` | 境界 | IT | Surface Contract／Effect Equivalence | TS API・CLI・MCP・Workbench→同一Application Contract→正本 | Related 2 Blocks | 採用済みの対応非鍵入口、同一固定入力の正常・拒否・部分結果・取消、非採用入口。登録解除の両除去／片側残存／読戻し不明、両除去済みで旧実行終了未観測 | 採用済みの対応入口から同じ非鍵管理操作を実行し、明示的非対応入口の非公開を確認する | 入口Identity、操作別対象、変更前現在Roleの固定管理判定、受付操作・採用改訂、登録／Exposure両除去読戻しと不明段階、構造結果、Authority判定、取消結果を別に記録。正本差分・Effect件数を比較する | 採用済み対応非鍵入口が同じ契約と共有実装を使い、結果意味と正本更新が一致し独自Storeを作らない。解除完了は同一操作・改訂の両除去読戻しだけ。部分結果・旧実行終了不明を保持し、解除成功を取消完了へ変換しない。鍵3分岐／Host交換を入口同値の対象に混ぜない | EST-IT-010、入口別契約・結果・差分・Effect比較、Oracleを保存する | 非採用Toolの一覧・Schema・登録・dispatch 0、入口固有Store 0、暗黙再送0、取消後の所有資源残存0を実観測（結果statusから推定しない）。観測不能は0でなく未確認 | Automated |
| `EST-ST-011` | 境界 | ST | Result Return／Correlation | 委譲実行→結果搬送→元Task・所有正本 | Related 2 Blocks | 正常帰還、拒否、帰還先消失、Revision競合、部分結果、再送を含む固定Task | 各結果を帰還先へ搬送し反映可否を判定する | Task・Request Identity、作成側、対象Revision、変更集合、Evidence参照、帰還先、Authority、Effect件数を相関する | 正常時だけ作成側・Revision・変更・Evidenceを保って元Task／正本へ帰還し、競合・再送を重複反映しない | EST-ST-011、全相関Identity、変更集合Hash、Evidence参照、判定理由、Effect件数を保存する | 拒否・競合・再送時の重複Effect 0 | Automated |
| `EST-ST-012` | 異常 | ST | Stdio Transport Scenario | MCP stdio入口→Application→応答stream | System/E2E | UTF-8分割、EOF、取消競合、正常frameを含むProcess入力 | 実Process境界でframeを送受信する | byte列、frame、Application結果、取消・終了状態を記録する | framingを保ち分割・EOF・取消競合を成功応答へ畳まない | 入出力byte分類、結果、終了状態、判定 | handle／listener／child残存0 | Automated |
| `EST-ST-013` | 異常 | ST | HTTP公開Process終了 | Workbench MCP Client→TLS終端／MCP HTTP公開入口→Application→Listener／Socket／Signal | System/E2E | 固定公開Launcher、正常TLS配置、Content-Length途中、slow body、idle keep-alive、Application実行中、重複Signal、close／join観測不能の各条件 | 実公開ProcessへHTTP要求を送り、各段階で終了を要求する。正常TLSと偽装Headerの試験は別scenarioにする | 受付停止、取消、Application join、body reader／handler／socket／listener終了、Signal登録解除、全Registry件数と最終終了結果を同じProcessへ相関する | 全所有資源の終端確認後だけ終了成功。未知を0へ畳まず、誤Host／Origin／偽装Forwarded HeaderではApplication Effect 0。終了中の新規受付0、同一依頼の再送0 | 固定候補・実TLS構成Identity、scenario、公開結果、各Registryと終了観測、未確認条件を保存する。Token・本文・生出力は保存しない | 全所有資源不存在、または正確な未解決義務保持。観測不能・取消未完了・close失敗を終了成功にしない | Automated |
| `EST-IT-014` | 境界 | IT | Runtime活動の取消・待機終了 | MCP Adapter→Orchestrator活動Reader | Direct Boundary | 開始前に取消済みの要求、解放まで保留する非取消Reader | 開始前取消と開始後取消を別々に送り、開始後はReaderを解放する | Reader呼出し回数、開始・完了、応答保留、取消結果 | 開始前はReader零回。開始後は完了までjoinしてから取消応答を返し、再実行しない。Signal確認をReader中断の証明にしない | 固定入力、開始／完了順序、呼出し回数と取消結果を記録する。実Provider・実資源終端の成立は主張しない | 開始済みReader Promiseをjoinし、保留gateを解放する | Automated |
| `EST-ST-015` | 境界 | ST | MCP鍵操作非公開 | 公開MCP Launcher→鍵操作のtools/list・Schema・登録・dispatch四面、および公開HTTP入口→Origin／Endpoint／Header／容量／完全JSON→Envelope／ID／method／params／_meta→限定server/discover Handler→AM確認 | System/E2E | 現在administratorを含む資格、発行・独立失効・交換・資格一覧、元発行再観測・鍵Recovery参照／結果照会の要求、確定発行提示結果未確認の各状態、通常内容読取り。初回設定・初回状態照会、未初期化／既存／確認済み途中／観測不能も与える。初回提示済み資格の完全server/discoverと、不正Header／body／Envelope／ID／method、tools/list／callを比較する。 | 公開一覧・Schema・登録を確認し、鍵管理と鍵Recovery参照・結果照会を直接要求する。通常Bearer要求認証も比較する。初回設定・状態照会も直接要求する。初回限定接続と通常認証後の要求を別に実行する。 | 公開操作集合、dispatch経路、鍵操作呼出し・Secret・Effect件数、公開MCP経路からの初回設定Owner・公開初回状態照会Readerの呼出し件数、Bearer認証と非鍵操作結果。初期化開始Owner・公開初回状態照会Reader・初回確認Ownerを別カウントにし、確認出版と通常Authorityを観測する。通常Tool Handler呼出し0と内部fresh状態読取りを区別する。 | Secret有無によらず全鍵操作・鍵Recovery参照／結果照会・初期化開始・状態照会は4面非公開、鍵Owner・初期化開始Owner・公開初回状態照会Reader呼出し0。完全検査済みの初回server/discoverだけ確認Ownerをexact 1回呼び非秘密応答を返す。不正／Tool要求は確認Owner・更新0。同discover要求の通常Authority0、次要求だけfresh通常認証。通常Bearer認証と非鍵操作を維持する。同じdiscover要求の通常Tool Handler呼出し0。confirmInitialConnection内部のfresh状態読取りは必要であり、この禁止へ含めない。 | 固定版、非秘密入力分類、公開集合、拒否・認証・Effect結果。資格値は記録しない | 鍵Effect0・Secret返却0・隠れた鍵／初期化開始／状態照会route0。初回確認の保存・応答順はQA-000007と相関し、限定discoverを初期化や通常Tool公開の例外にしない。 | Automated |

`EST-IT-014`の導出元は`REQ-000006`の入口間で同じ取消意味を保持する条件、`ARCH-000012`の接続Lifecycleと[MCP詳細のRuntime活動取消契約](../../../06_Architecture/Details/mcp-server/01_Architecture.md)である。入力拒否の`EST-IT-002`と、実公開Process終端の`EST-ST-013`を代替しない。

活動の新Owner接続では、`EST-IT-002`で未知field・不正Cursor・Source相関不正を拒否し、`EST-IT-014`で実Reader開始前の呼出し0、開始後のjoin・取消応答・再実行0を確認する。`EST-IT-010`では同じOrchestrator公開観測をWorkbenchの直接Owner経路と独立MCP Surfaceから取得し、競合・欠測・出所・全体ページングを比較する。Readerの待機を取消できない場合もPromise競争で放棄しない。Workbench直接Owner接続は局所Sourceと実HTTP反例で評価する。同期活動読取り前の切断では履歴読取り0、読取り中の切断では対象二Rootを各一回読んでjoinし、Serverの成功本文0と次要求の正常取得を確認する。既存通信待機をReader前後へ適用し、強制途中取消や全公開Launcherの完成を主張しない。旧CROSの合成Reader試験は移管後の本番成立根拠に流用しない。


EST-ST-015は最新MCP詳細の鍵管理・初回設定・状態照会非公開から導出する。初回設定も同じ公開面の負境界のためSame統合し、新しい重複項目を作らない。鍵権限・発行／失効／交換のEffectはQA-000007が所有し、本項目は既存四面非公開に加え、完全HTTP／Protocol検査後の限定discoverと確認Ownerの正規1回／不正0を検証する。確認内部のfresh読取りは公開状態照会ではない。EST-IT-010とEST-ST-015は最新契約についてNot Run。旧結果は新契約の合格根拠にしない。

通常7保存操作の固定分担・保存・読戻しはQA-000007／RFD-UT-020・RFD-IT-021・RFD-ST-022が所有し、EST-IT-010は搬送同値だけを検証する。MCP Tool／CLI／APIをこのQuality更新で新規採用しない。非採用経路は非公開を確認する。鍵3操作のMCP非公開とHost交換2操作は同値比較の対象外。Profile管理は現在manager／administratorに確定済みで、内容・Catalog更新の検証はQA-000001が所有する。

## 二Surface再編の追加観測条件

導出元は[MCP詳細の公開Transportと終了契約](../../../06_Architecture/Details/mcp-server/01_Architecture.md)、[Access Managementの現在認可](../../../06_Architecture/Details/access-management/01_Architecture.md)、[Workbench接続](../../../06_Architecture/Details/workbench-server/01_Architecture.md)である。以下は既存義務の具体化と新しいHTTP終端義務であり、Source移管前の実測を新構成のPassへ流用しない。

| Local Item | 入力・反証 | 観測と終了後条件 |
|---|---|---|
| `EST-IT-001/002` | 正常TLS終端、誤Host／Origin、偽装Forwarded Header、認証不正、Exposure改訂変更、body途中、slow body、idle接続、終了競合 | 認証・Origin・Header処置を実Application呼出しと相関する。拒否時Effect 0。読取り不能を空成功へ変えず、終了時reader／socket残存と未確認を区別する。実TLS配置と模擬Headerを別Evidenceにする。 |
| `EST-IT-010` | 同一Activity／Profile要求をWorkbenchの直接Owner経路と独立MCP Surfaceから処理。cursor／limit、expectedRevision、認可失効、保存後応答喪失 | 同じ入力、意味結果、欠測、現在認可と保存Effectを比較する。Transport変更で新Authorityを作らず、応答喪失による自動再送・二重保存0。一方のSurfaceだけの成功で他方の成立を主張しない。 |
| `EST-ST-013` | body受信中・idle keep-alive・Application実行中の終了、重複Signal、close／join不明 | 受付停止→取消→join→Listener／Socket回収→Signal解除を公開Processから確認する。各Registryの空を実観測し、未知を不存在へ変更しない。stdioの`EST-ST-012`とは別に判定する。 |

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

## 非鍵管理の通信接続の検証具体化候補 — 2026-10-13

対象は[独立MCP詳細§3.3.1](../../../06_Architecture/Details/mcp-server/01_Architecture.md#331-非鍵管理toolの具体化候補)とWorkbenchの直接AM接続を分ける。Workbenchは全配置で四read＋七保存（登録含む）、独立MCPは四read＋六保存（登録なし）。WorkbenchからMCPを呼ぶ契約は持たない。鍵・Host・初回操作は非公開、Profile四Toolと内容操作は既存契約を保持する。新Local Itemを追加せず、正式評価はNot Run。

| 既存項目 | 接続する観測とOracle |
|---|---|
| EST-IT-002 | 採用Tool名の全数・非衝突、tools/listとdispatchの同集合、操作別閉Schema、必須／未知／重複field・型・境界値。不正入力後のAM呼出し0。Bearer・管理Rootの引数0、Path／Binding／秘密の応答0 |
| EST-IT-010 | 独立したWorkbench直接AMとMCP Surfaceが同じAM結果・既知publication・cleanup・最初の失敗分類を保持し、入口固有Store・認可判定0。四readの各改訂と既存filterを保ち、改訂混在を同一Snapshotへ合成しない。認可／観測不明や出力上限超過を部分／空成功にしない |
| EST-ST-013 | 実HTTPの開始前取消はAM呼出し0、開始後は同期処理の終了待ちと応答抑止。保存後切断／出力失敗の自動再送0、次要求でfresh状態観測。Server終了後の所有Listener／Request／Socket終了を確認 |

現在manager／administratorの管理Tool追加とdeveloper追加0を実HTTPで確認し、Role変更／失効後の次list／callを反証する。AM Rootと要求Bearerを持たないstdio／Local依存では追加0・fallback0。独立MCPは登録非公開に固定し、採用Toolの閉集合を実際の構成と照合する。Workbenchの管理操作数からMCP Tool数を推定しない。RFD-IT-021／ST-022は管理・保存・表示の意味Ownerであり、この通信検査だけから七保存や利用者理解の成立を主張しない。

非鍵管理候補のEST-IT-010では、MCP結果Unionの全field／literalと固定理由mappingを閉検査し、未知reasonはstorage_unavailableへ、publication／observedRevision／cleanupConfirmedは不変とする。先行pending処置はprevious_materials_unavailable、新出版準備はprepare_failed。出版成功後のLock終了不明がprimaryFailureへ到達する場合はrelease_unknown、既知失敗に付随する非公開secondaryは捏造しない。EST-IT-002ではdeveloperの通常認証／用途解決を許容しつつ、四管理read／七保存API呼出しと管理Tool／情報開示0をlistとcall双方で確認する。管理状態Root／Bindingは常に入力外、応答Path／Bindingは0。Repository登録の対象Root入力はWorkbenchだけに許可し、MCPの登録field／Toolは0とする。

通常本人Tool crdd.get_current_accessはEST-IT-002／010で三Role、初回非提供、空閉入力、不正入力と事前取消のread0、要求毎fresh本人、失効／Role変更、Root／資格／他User／managementOperations非公開を確認する。Workbench直接AMと独立MCPの同じAM投影・管理共通六操作の同値、MCP登録非提供、拒否／不明の非成功化、保存後切断と自動再送0を同項目へ接続する。公開Process終了・Listener／Request／Socket終端はEST-ST-013の別義務として維持し、局所Handler試験だけで成立としない。

### Workbench Browser接続の反証範囲 — 2026-10-13

同Host Topic／Meetingの内容POST候補は、`EST-IT-002`／`EST-IT-010`で閉Form・Body搬送後の現在認可・選択Root・同Project集合と一回配送を確認する。正常／Domain blockedは200の要求専用結果、配送前拒否は400、配送後の例外またはC2不成立は503の固定未確認通知、取消は成功本文0とする。これは旧Standalone／Remoteの303・固定500とは別分岐であり、既知処置を未保存へ畳まず、Root・対象本文を拒否応答へ含めない。局所実HTTPでは保存後の公開解除・鍵失効・例外・実切断、同Project sibling解除、処置一回・既知Effect保持・fresh読取り再Mutation 0を確認した。取消の固定待機は根拠にせず、ServerResponseのcloseと成功本文0を相関し、正常正対照では成功本文1を確認する。昇格の正常／不存在／競合と、Outcome未処置時Close拒否／全件処置後Closeも局所確認した。是正後の限定再レビュー、Browser、Git／本文、公開起動と正式項目全体は未成立として保持する。

同Originの既知リンク／GET検索／popstateは`EST-ST-013`で本番Bundle→Model API→同React Root更新を確認する。移動後の資格Header、明示Repository選択の保持、遅延表示の世代不一致拒否、POST／外部／別タブの非横取りを区別する。pagehide／pageshowの合成通知でRoot解放と資格なし再開を反証する場合、実Browser cacheの保存復元確認とは表示しない。未公開Repositoryへの移動で認証だけ維持できても、内容選択の成立へ流用しない。

選択内容GETは`RFD-IT-024`／`EST-IT-002`／`EST-IT-010`で、今回AM許可集合と明示Repository／Context／manifestの相関、無資格・非登録・Exposure解除の内容拒否、起動Rootへのfallback 0を確認する。本文取得中の選択Exposure・資格失効、同Project sibling解除、Binding／manifest差では、公開直前の管理改訂と正規化全集合再確認によって内容・Relation・Git・Portfolioの部分公開0を確認する。集合の同値な順序変更は許容し、重複Repository IDの正逆／同値入力では認証・Root open／read 0を観測する。`aiProfiles: null`は未取得であり、不正Objectや欠測を補完せず、単体Catalogの維持と共有AI入力の無効化を別々に検査する。実Browserの三つの自己生成Repository間移動は`EST-ST-013`の限定範囲として、選択維持・遅延応答不採用・未接続保存の無効表示と区別する。内容POST・本文リンク・共有TLS・公開CLIと正式項目全体の成立を、このGET結果から推定しない。

通常管理の直接接続では`EST-IT-010`でStandalone／CROSの同じAM API・結果・実保存を比較し、MCP Listener／Clientを使わない。Workbenchの登録は両配置で現在管理Roleに限り許可し、登録だけで公開0、降格後の管理拒否、閉入力・非秘密結果、保存後の応答不明・再送0を維持する。MCP自身の登録非公開は別Surfaceの義務であり、Workbenchの登録拒否へ転用しない。

`EST-IT-002`へ同Origin資格搬送の閉検査を接続する。別Origin・Caller指定Authorization・事前取消では送信0、鍵切替・切断後の遅延応答は採用0、16 MiB超過はReader取消・解放、再送0を観測する。接続POSTは200の閉JSONだけで本人・内容・鍵を返さず、303をmanual fetchで成功確認する実装は反例とする。合成fetch／streamの成功を実BrowserやAM認可の成立へ流用しない。

`EST-ST-013`の実Browser範囲では、本番Bundleから専用POST・次GETへ接続し、本人・Role・表示をBrowser間で混同しないこと、入力・Storage・URLに鍵を残さないこと、切断・再読込後の未認証状態を確認する。鍵管理と接続の局所実Browser8件は成功し、所有Browser／Listener／Directoryの清掃も確認した。共有公開配置・全内容操作・Browser間の全能力非混同は未確認であり、正式EST-ST-013全体の結果をPassへ変更しない。

開始後取消は`EST-IT-002`の別反例として、fetch待機中と本文Reader待機中を確認する。同じSignalを搬送し、abort後は固定失敗・Reader lock解放・各fetch一回・再送0を観測する。非取消の通信失敗を取消へ捏造しない。局所Transport終了を保存rollbackや外部Effect終了の証明へ流用しない。

## 旧CROS試作品の撤去と検証義務 — 2026-10-14

旧`surface/operation.ts`の四Surface名を付けたメモリOwnerと結果帰還の純値Oracleは、本番SurfaceやTask保存・処置集合更新・Evidence搬送を行わないため撤去した。EST-IT-010は現在のWorkbench直接Ownerと独立MCPの部分接続を保持するが、全採用入口の同値確認はOPEN。EST-ST-011はCoordinator／Orchestratorの実帰還境界としてOPEN・正式Not Runを保持し、5Cの承認済み持越しと区別する。旧試験の削除をQA ID廃止・Pass・代替完了へ読み替えない。過去Evidenceは不変更で、当時SourceはGit Commit `378d93cb6ffb0cc7c9561e0572d62bdd656f3312` の`40_Develop/cros/src/surface/operation.ts`と専用試験から再構成する。

## Checklist

Runtime活動の入力・結果拒否は`EST-IT-002`、現在Role認可と非開示は`RFD-IT-013`、取消と待機終了は`EST-IT-014`で確認する。開始前取消のReader零回、開始後取消の読取りjoin・応答保留・join後取消を別々に観測する。非取消Readerに対するSignal確認だけをReader中断や外部資源不存在の証明へ昇格しない。同Host Workbenchの直接経路では、同Projectの許可全Rootを既存Orchestrator Readerへ渡し、二つの実EI履歴25件の20件＋続き5件、別Project除外、Cursor不正の先頭戻り0、現在状態と履歴不明の独立、初期化0を確認する。活動取得後のAM全集合不一致はMain全体の拒否とし、Reader故障だけのunknown表示と区別する。Server終了・切断の実Transport利用側は`EST-ST-013`で別途確認する。

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
