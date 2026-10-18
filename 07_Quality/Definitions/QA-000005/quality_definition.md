# QA-000005 候補と正本への引き渡しの検証定義

## 複数Task計画の旧Bundle撤去に必要な確認（2026-10-18、外部AIなしの接続確認済み・全面撤去未完了）

[採用済みの計画集約方針](../../../06_Architecture/Details/orchestrator/03_Workspace.md#複数task計画のworkspace集約2026-10-18採用済み切替未完了)から、既存の`CPR-IT-001`／004／006へ次を接続する。単発Workspace又は合成Gitの成功を、計画全体の置換成功へ流用しない。

- 同じWorkspaceの二Taskが、依存関係の有無にかかわらず順番に開始され、後続が前の変更を読み、Task完了時のCommit・Merge・旧Bundle生成が0である。
- Directでは既存dirty／stage／未追跡fileを保全し、Git採用を必須とせず既存の明示品質受入へ進む。Isolatedでは選択した候補の明示固定・別採用を経ても、品質受入までは全体完成と表示しない。
- 初回と別Process再入場で、同じQueue・Workspace・結果参照・待ち状態を保持する。初回変更観測の欠測をTask再送又は旧Store fallbackの根拠にしない。
- Isolatedの明示Merge後、別Process再入場でも、元計画Revisionと既存採用記録・現在HEADを照合して品質受入へ進める。採用前、別HEAD、記録欠測は公開判断Ownerで拒否し、候補Ref終了だけを採用根拠にしない。DirectへこのGit条件を適用しない。
- 取消、共有Treeとの競合、結果保存失敗、Lease解放失敗では元失敗・同じ回復参照を維持する。旧`adoptResult`による自動採用要求はEffect前に拒否し、必要な明示操作を示す。
- 本番利用側と旧保存領域・未解決参照を確認し、内容保全と置換接続を終えたものだけを除去する。旧候補の成功Evidence、Context候補判断、品質受入Decisionを一括削除しない。
- 通常CLIを含む上位の受付でWorkspace指定を解決し、Coordinatorへ選択済みの実行対象を搬送する。Coordinator側にWorkspace ID照会・台帳読取り・Direct／Isolated選択・上位Package依存を追加しない。未指定・別対象・観測不能はAI開始前に停止し、別Tree又は旧Bundleへfallbackしない。
- 上位の解決後でも、Repository境界・Git管理領域・link／実体・Revision・Mount材料の必要な再確認を維持する。成功・取消・開始前拒否・回収不明で元対象との相関を落とさず、Coordinatorの清掃は自己所有の実行資源・一時投影だけとし、借用Tree・Branch・候補Refを削除しない。

過去のMerge失敗から同操作で再入場した場合も、一次失敗を消さず、採用確定・Ref終了後に元計画へ品質受入できることを確認する。Commit IDは40又は64桁とし、中間長、別Queue・Project、記録欠測と別HEADを有限Snapshotでも拒否する。別Process試験は通常のNode起動で既存Workerを利用し、標準入力専用の実行形式を子Workerへ継承させない。

本節は検証義務の具体化であり、全体Passの記録ではない。実結果と有限代役／実Git／実AIの成立範囲は既存変更記録から追跡する。

## 旧AI経路置換の検証条件（2026-10-18、検証中）

再入場の反証は、同Ownerのunknown回収後の再観測、回復待機中の二重開始、Task clean後のLease終了保存失敗、正式回収後の上位保存失敗、Server再構成後の元ID観測・取消を含む。元実行のstatus／reasonと本文欠測を分け、保存／Leaseの副次失敗参照を保持する。終了履歴の別ID・consumer差・上位相関差・旧要約・欠測・重複・現在操作残存では終了を表示しない。これらの設計条件は実行済み結果とは区別する。

Workspace Taskの完了を旧Bundle候補の生成・採用へ流さず、既存の`CPR-IT-001`／004／006で変更確認→明示固定→別採用を検証する。以下は[置換契約](../../../06_Architecture/Details/orchestrator/03_Workspace.md#旧workbench-ai経路の置換契約2026-10-18移行中)から導く設計条件であり、実行済み結果ではない。

- 単体と同Host共有の公開入口から、対象Repository／Workspace、明示Profile、送信同意と依頼種別を本番Dispatcherの入力まで照合する。助言は固定Context一件の読取り専用構成を観測し、空の許可Pathだけで保証しない。
- Task完了、結果配送の受領、Workspace終了だけでは候補固定・Commit・Merge・Promotion・旧Bundle統合が発行されないことを確認する。
- 根拠参照付きの四分類と、Task／Attempt／Workspaceの同一性を公開結果まで確認する。不正結果・欠測・生Provider出力を正常な助言へ変換しない。
- 実Writerを用い、Prompt・投影・回答本文が要求、計画、採用基準、Event、履歴へ別名で保存されないことを確認する。Process喪失後は本文欠測を明示し、自動再送0と、同IDでの回収・失敗確認が本文欠測から独立することを観測する。
- 二重開始、応答喪失、古いRepositoryへの遅延応答、取消と完了の競合、保存拒否、清掃不明、結果配送不明を有限Provider代役と実保存・HTTPで確認する。実Browserでは誤った結果の採用0・自動再送0を確認する。

有限代役・実Git・実Writerの結合結果は、実Provider／Docker実境界・人間UAT・実データ移行の成功と区別する。旧経路のSource撤去は代替能力の接続と必要検証が成立した後だけ行う。

## 候補固定・採用・名前の追加検証条件（2026-10-18）

単発受付の追加反証は既存`CPR-IT-004`／010／012で、反復助言・編集、既存実Leaseの未取得拒否と取得不明、元ID再入場、本文喪失、一次失敗と保存／解放失敗、回復後の元status／reason保持、履歴一件、二重開始拒否、取消join中の失効、共有の二主体・二Repository分離を確認する。`ERB-UT-023`では助言の実Operation通知保存拒否をProvider前で止め、作成済みHostの清掃不明時にも同exact参照を維持する。有限依存・実Writer・実HTTPの成立を実Provider／実Docker全体の成功へ拡張しない。

公開接続では`CPR-IT-001`／004／006へ、両入口からの変更確認→選択固定→別採用→明示終了、現在世代／HEAD／Blob不一致時の新Effect 0、外部の参照解放Booleanを用いない非使用確認、応答喪失・保存後失敗後の同対象再入場を追加する。MCPのFront AI代行を許容するが、Task完了から自動固定／採用0を維持する。公開結合は実Git・実Writerを観測し、内部APIの成功や型検査で代替しない。

[Workspace詳細](../../../06_Architecture/Details/orchestrator/03_Workspace.md#採用git統合の採用方針2026-10-18実装未完了)の採用済み方針に対し、既存Local Itemへ次を追加する。設計条件であり実行結果ではない。

| Local Item | 追加するOracle・観測 |
|---|---|
| `CPR-UT-009` | UUIDと表示名を区別する。名前なし・同名・改名でも対象照合を変えず、固定時のWorkspace名／Candidate名を後から書き換えない。改行・制御文字・上限超過の名前をMessageへ流さない |
| `CPR-IT-001` | 明示Baseと確認済み選択内容、Candidate Commit、Task／判断参照を結合する。既存staged・未選択dirty・採用対象外の過去Commitの混入0、固定後差分の取得、固定と採用の別操作を実Gitと実保存で観測する |
| `CPR-IT-004` | Task終了・Workspace終了・固定成功だけではMerge／Promotion0。採用直前の現在認可・取込先HEAD・候補同一性・選択範囲・dirtyを再確認し、不一致では発行0。Git成功を品質成立と表示しない |
| `CPR-IT-006` | Git成功後の結果保存失敗とLease解放失敗を別に保持する。同操作の別Process再入場で二重Commit／Merge0、対象Commitと実親関係の読戻し、既存変更保全、採用後の残差確認と資源回収を観測する。Candidate RefをWorkspace寿命と分離し、採用後／不採用後の参照・保持・非使用確認、参照中の削除0、Ref変更の削除0、削除途中失敗の同Ref・期待Commit再入場、Workspace継続と他Ref不変を確認する |
| `CPR-UAT-002`／`CPR-UAT-003`／`CPR-UAT-007` | 名前付きWorkspaceと固定Candidate、Merge、Promotion、Quality Gateを人間が区別できる。Merge Messageから出所を辿れ、理由／Evidenceは既存所有成果物へ接続する。名前なしでも対象を誤認しない |

上記追加断面はPackage API・実Git／保存の部分確認と、未確認の公開入口・UATを区別する。[現在の部分実測と残件](../../../99_Roadmap/Changes/CHG-000082/workspace-runtime-inventory.md#採用git統合のsource接続と実git確認)を参照し、古いBundle方式の成功や文書検査を新方式のPassへ流用しない。Local Item全体の成立は本段階だけでは判定しない。

## Workspace方式の追加検証条件（2026-10-17）

[Workspace詳細](../../../06_Architecture/Details/orchestrator/03_Workspace.md)の`orchestrator.workspace-code-candidate`（ARCH-000015）をコード変更候補に限って追加する。`CPR-UT-009`はRepository・Workspace・固定Commit・レビュー・正本Revisionの相関、`CPR-IT-001`はGit成果と必要なTask／判断参照の保持、`CPR-IT-004`／006は権限・採用排他・変更後差分・適用後記録失敗・再入場時二重適用拒否を確認する。`CPR-UAT-002`／003／007はDirect編集、候補固定、Merge、Promotionの違いと明示判断を評価する。旧項目の候補生成時の正本Effect 0と採用時Commit／Push 0は旧Bundle／Context採用の対象へ維持する。Directの許可された編集、別Branchへの候補固定Commit、明示Merge／Promotionは別Effectとして新しいfixture・Oracleを確定するまで実行しない。Git方式へ旧Oracleを無条件適用せず、逆に通常CRUD・Topic／Meetingの提案をGit候補へ強制変換しない。旧Store撤去前に内容・許可Path・情報分類・期限・未解決参照の保全を確認する。

本節の初回定義時点はすべてNot Runであり、既存Local Itemの元結果・旧方式のEvidenceを新方式へ継承しない。以後のPackage接続・実Gitの部分結果は冒頭の現在結果参照で区別し、未確認の公開ST・利用者UATやLocal Item全体をPassへ更新しない。詳細Schema・操作許可・dirty／Commit処理に未決がある対象は該当実装前に停止する。条件区分は正常・境界・準正常・異常・回復を扱い、UTの値判定、ITの実保存／実Git／実Mount、公開ST、利用者UATを相互代替しない。

成果物種別: Quality定義
Quality ID: `QA-000005`
検証目標: 観測した情報を候補として隔離し、人間の採否後だけ所有正本へ引き渡すこと
主な試験段階: Integration／System／User Acceptance
状態: Canonical
維持責任者: Qual-Lab

MCPのCPR-IT-012局所試験では、公開全12 Toolの完全入力検査・開始前取消をRepository解決より前へ接続する。不正入力／開始前取消はResolver 0回、正規入力は1回、Resolver内取消はDomain操作0を確認する。nullの既存Invalid paramsと解決例外の固定Internal errorを分離する。AMの現在認可・manifest Project拘束を使う実HTTP構成では12操作、foreign登録／更新の保存0、Role／Exposure／失効の次要求反映、Root欠測の全体停止を照合する。既存直接CRUDと保存後故障分類は維持し、公開Launcher／Workbench本番切替・保存開始後取消の完了保証は未成立として分離する。

一覧条件ではDomain既存の純粋検査を共用し、状態・sort・Relation・日付・種別固有条件・Cursor構造とQuery結合の不正もResolver 0回で拒否する。Resolverが既知のDomain一覧エラーと同じ文字列をthrowしてもInternal errorとし、解決後のDomain一覧入力エラーだけ既存Invalid params分類を維持する。

## 1. 情報源と網羅条件

共有Browserの既存Topic／Meeting Formは`CPR-ST-005`へ接続する。Main／Detailからの一回送信、指定Repository維持、確認付き削除後の同Repository一覧遷移、Topic昇格、二件のOutcomeの早期Close拒否・未選択false一件・全件処置後Closeを観測する。保存後GET故障は既知保存と現在内容未確認を分け、Detail旧本文／Formを非表示にしてGETだけで再取得する。blocked＋GET故障は保存済み通知へ丸めず、保存応答保留中の対象切替ではSignal取消・遅延応答採用0・POST再送0を確認する。自己生成Rootと本番Bundleの局所反例であり、Git／本文入口・公開Launcher・同Local Item全体と正式191項目の完成へ拡張しない。

Workbenchの同Host内容POSTでは、`CPR-IT-010`へ指定RepositoryのTopic／Meeting登録・期待改訂付き更新・競合・確認付き削除・同Project Relationを、`CPR-IT-012`へ閉Form、scalar重複・未知field・非許可ID、Body待機後の現在認可と公開前C2を接続する。両種別の昇格／Outcome処置も既存Domain条件を維持する。保存後の認可故障・応答喪失・取消では、確認済み処置を未保存へ畳まず成功本文と再配送を抑止する。Backend局所成功をBrowser操作、Git／本文、公開Launcher、同Local Item全体の完成へ拡張しない。

`CPR-IT-010`のRelation確認は、認可済み同Project集合の構造検査、両種別からTopic／Meeting／CHGへの0／1／複数Owner解決、既存Owner値の非流用と探索例外の全体停止へ接続する。不整合時は操作呼出し0、Relation以外はSource操作参照を保持し、通常CRUDは実Repositoryへ到達する。これは認可自体・AM本番Resolver・全公開操作母集合の完成根拠ではない。

CPR-IT-010／011では、期待Projectを指定したTopic／Meeting両種別の正常保存と、foreign本文の登録・更新・取得・一覧・削除・昇格・Outcome拒否を実Filesystemで照合する。incoming Relation由来のforeign本文も固定例外へ閉じ、内容とPathを公開しない。期待値不正はRoot観測前、保存契約注入との併用は生成前拒否。これはDomain拘束の局所検証であり、AM認可から本番Consumerへの搬送成立ではない。

| Source ID | Obligation Key | 導出元 | 保持する固有条件 | 試験段階 | 対応Local Item |
|---|---|---|---|---|
| [REQ-000012](../../../01_Discovery/Definitions/REQ-000012/requirement.md) | `req-000012.qa-000005` | Requirement Definition（成立条件・失敗・検証意図） | Meetingの時点記録を保ったまま候補を抽出できる。既存Topicへの統合、新規Topic、正式正本更新、不採用を人間が区別できる。採用後は所有正本を更新し、候補や投影を第二正本にしない。既存Topicと重複する候補、新規論点、決定候補、不採用候補を処理し、時点記録、判断、正本反映を観測する | IT／ST | `CPR-IT-001`、`CPR-IT-004`、`CPR-ST-005` |
| [REQ-000027](../../../01_Discovery/Definitions/REQ-000027/requirement.md) | `req-000027.qa-000005` | Requirement Definition（成立条件・失敗・検証意図） | 外部作用（Effect）の前に送信先、目的、操作、情報分類、許可範囲を確定する。外部内容を指示、決定権限、要求、因果へ自動昇格せず出典付き観察として戻す。新しい要求や方針変更は人間採用判断を経て所有正本へ反映する。許可／不許可情報、外部指示、矛盾情報、公開反応、依存更新を与え、外部送信による作用と内部昇格を観測する | UAT | `CPR-UAT-002`、`CPR-UAT-003` |
| [REQ-000039](../../../01_Discovery/Definitions/REQ-000039/requirement.md) | `req-000039.qa-000005` | Requirement Definition（成立条件・失敗・検証意図） | TopicとMeetingの一通りの操作、Meeting候補の全件処置、Actionの追跡先移管、正当な履歴と誤登録削除を区別する。削除前に参照影響・失われる内容・復旧可能性を示し、明示確認後もDangling Relationや暗黙の連鎖削除を残さない | IT／ST／UAT | `CPR-IT-006`、`CPR-IT-008`、`CPR-ST-005`、`CPR-UAT-007` |
| [UX-000014](../../../02_UX/Definitions/UX-000014/ux_definition.md) | `ux-000014.qa-000005` | UX Definition（利用者成果・重要場面・重要な失敗） | 会話・観察・仮説・候補・決定を区別し、既存Topicとの関係を根拠付きで判断して所有正本へ戻せる。重要場面「候補を採用または却下する場面」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。会話の自動採用と文字列一致だけの統合・分割を反証する | IT／UAT | `CPR-UAT-002`、`CPR-IT-001` |
| [UX-000024](../../../02_UX/Definitions/UX-000024/ux_definition.md) | `ux-000024.qa-000005` | UX Definition（利用者成果・重要場面・重要な失敗） | 外部作用（Effect）の前に送信先・目的・操作・情報分類・許可範囲を理解し、外部情報・反応・依存新版を出典付き候補として扱える。重要場面「外部作用（Effect）の前と結果昇格時」で、避ける失敗を利用者が正常状態や完了として誤認しない。入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。接続済み・過去同意からの包括許可、不要情報送信、外部反応・依存新版の要求／因果／方針への自動昇格を反証する | IT／UAT | `CPR-UAT-003`、`CPR-IT-001`、`CPR-UAT-002` |
| [UX-000033](../../../02_UX/Definitions/UX-000033/ux_definition.md) | `ux-000033.qa-000005` | UX Definition（利用者成果・重要場面・重要な失敗） | TopicとMeetingを登録・編集・取得・一覧・終了・訂正でき、Meeting候補を全件処置して未完了Actionを追跡先へ渡せる。誤登録削除の直前に損失・Relation・復旧可能性を理解し、正当な履歴や関連対象を失わない | IT／ST／UAT | `CPR-IT-006`、`CPR-IT-008`、`CPR-ST-005`、`CPR-UAT-007` |
| [IA-000010](../../../03_IA/Definitions/IA-000010/ia_definition.md) | `ia-000010.qa-000005` | IA Definition（情報・関係・状態・見つけ方） | 会話を自動採用せず、候補を既存論点と比較して所有正本へ戻す。UX-000014: 観測済み（observed）／候補（candidate）／採用（adopted）／却下（rejected）。会話と正本を分ける | IT | `CPR-IT-001`、`CPR-IT-004` |
| [IA-000017](../../../03_IA/Definitions/IA-000017/ia_definition.md) | `ia-000017.qa-000005` | IA Definition（情報・関係・状態・見つけ方） | 外部へ何をなぜ渡すかを判断し、戻った結果を自動採用しない。UX-000024: 未許可（not_authorized）／許可済み（authorized）／送信済み（sent）／返却済み（returned）／候補（candidate）／採用（adopted） | IT | `CPR-IT-001`、`CPR-IT-004` |
| [UI-000009](../../../04_UI/Definitions/UI-000009/ui_definition.md) | `ui-000009.qa-000005` | UI Definition（認識・操作・Feedback・失敗表示） | TopicとMeetingの登録・編集・取得・一覧・終了・訂正、Outcome処置、Action移管および誤登録削除を一つのLifecycleとして理解・操作できる。削除影響、Relation整合、正当な履歴と時点記録を区別する | IT／ST／UAT | `CPR-IT-001`、`CPR-IT-008`、`CPR-UAT-002`、`CPR-IT-004`、`CPR-ST-005`、`CPR-UAT-007` |
| [UI-000016](../../../04_UI/Definitions/UI-000016/ui_definition.md) | `ui-000016.qa-000005` | UI Definition（認識・操作・Feedback・失敗表示） | 外部へ渡す範囲を理解し、戻った候補を採用前に判断できる。UX-000024: 送信範囲と内部へ戻す際の昇格条件を理解する: 外部作用（Effect）の前と結果昇格時: 同意・投影・採用を分離する: 接続済みを包括許可とし、外部反応や依存新版を要求・因果・方針へ自動昇格する。UX-000024／IA-000014: 未許可（not_authorized）／許可済み（authorized）／送信済み（sent）／返却済み（returned）／候補（candidate）／採用（adopted）: 送信候補→境界確認→送信する最小情報→送信→出所付き結果→採否。UX-000024／IA-000017: 未許可（not_authorized）／許可済み（authorized）／送信済み（sent）／返却済み（returned）／候補（candidate）／採用（adopted）: 送信候補→境界確認→送信する最小情報→送信→出所付き結果→採否 | IT／UAT | `CPR-IT-001`、`CPR-IT-004`、`CPR-UAT-003` |
| [SPEC-000013](../../../05_SPEC/Definitions/SPEC-000013/spec_definition.md) | `spec-000013.qa-000005` | SPEC Definition（正常・境界・失敗・観測不能・副作用） | Topic／MeetingのCRUD、Outcome全件処置、Action移管、終了・撤回・訂正・削除を区別する。部分成功とRelation不整合を隠さず、確認なしの物理削除、暗黙の連鎖削除、時点記録の上書きを行わない | IT／ST／UAT | `CPR-IT-006`、`CPR-IT-008`、`CPR-ST-005`、`CPR-UAT-007`、`CPR-IT-010`、`CPR-IT-011`、`CPR-IT-012` |
| [SPEC-000027](../../../05_SPEC/Definitions/SPEC-000027/spec_definition.md) | `spec-000027.qa-000005` | SPEC Definition（正常・境界・失敗・観測不能・副作用） | 正常: 採否と反映先を辿れ、却下・保留では所有正本を変更しない。境界: 採用／却下／保留、対象改訂版一致／不一致を分け、採用時以外は所有正本を変更しない。失敗: 結果受領や送信許可を候補採用Authorityへ流用しない。観測不能: 不明を正常・不存在・完了へ丸めず、実際の副作用「採用時だけ所有正本を更新する。却下・保留では正本Effect 0」と矛盾する結果を返さない。失敗: 結果受領や送信許可を候補採用Authorityへ流用しない。副作用: 採用時だけ所有正本を更新する。却下・保留では正本Effect 0。本SPEC固有の回復経路は設けず、失敗理由と安全な戻り先を返す | IT／UAT | `CPR-UAT-003`、`CPR-IT-001`、`CPR-IT-004` |
| [ARCH-000006](../../../06_Architecture/Definitions/ARCH-000006/architecture_definition.md) | `arch-000006.qa-000005` | Architecture Definition（責務・境界・状態・故障） | Topic／MeetingのIdentity・改訂版・Relation・Lifecycle、Outcome処置、Action追跡先、安全な物理削除を同じ整合境界で所有する。候補採否、所有正本更新、物理削除のAuthorityを分け、正当な履歴を削除しない | IT／ST／UAT | `CPR-IT-001`、`CPR-IT-004`、`CPR-IT-008`、`CPR-UAT-003`、`CPR-ST-005`、`CPR-UAT-007`、`CPR-IT-010`、`CPR-IT-011`、`CPR-IT-012` |
| [ARCH-000015](../../../06_Architecture/Definitions/ARCH-000015/architecture_definition.md) | `arch-000015.qa-000005` | Architecture Definition（責務・境界・状態・故障） | not_authorized→authorized→sent→returned→candidate→adoptedを別AuthorityとEffectにし、送信、受領、採用を相互流用しない。所有する責務: 目的限定の送信同意、最小化送信、同じ依頼への結果帰還、候補隔離、採否。所有しない責務: 送信同意からの結果採用、外部AIへの決定権限移譲、所有正本の無断更新。主な外部境界: 外部AI／API／MCP、Candidate Store、所有正本、人間判断。SPEC-000021: 期限切れ・範囲変更・不明な同意ではEffect 0で停止する。Effect: 許可範囲の外部送信Effectを発行し、送信時の依頼識別情報と同意範囲を結果へ結合する。SPEC-000026: 送信時の識別情報へ結合できない結果は採用可能な候補へしない。Effect: 受領した結果を元Taskへ結合し、未信頼候補として返す。Provider Effectを再発行しない。SPEC-000027: 結果受領や送信許可を候補採用Authorityへ流用しない。Effect: 採用時だけ所有正本を更新する。却下・保留では正本Effect 0。入力SPECが固有Recoveryを定義しない場合、Architectureから追加しない。結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める | IT／UAT | `CPR-IT-001`、`CPR-IT-004`、`CPR-UAT-002` |
### Architecture詳細設計入力

| 詳細設計領域 | 受け取る成立条件 |
|---|---|
| [coordinator](../../../06_Architecture/Details/coordinator/01_Architecture.md) | 実行編成、Authority、外部Effect、候補、回収・回復 |
| [mcp](../../../06_Architecture/Details/mcp-server/01_Architecture.md) | Transport変換、公開Schema、Session、結果搬送 |
| [project-operation](../../../06_Architecture/Details/domain-model/02_Activity_Context.md) | Project運営状態、Meeting／Topic候補、正本への引渡し |
| [orchestrator](../../../06_Architecture/Details/orchestrator/01_Architecture.md) | 公開済み候補の明示採用、Lease、Revision／Scope再観測、Receiptおよび回復義務 |
| [workbench](../../../06_Architecture/Details/workbench-server/01_Architecture.md) | Topic／Meeting操作、候補採否、競合・部分成功・結果不明からの再入場 |

## 2. 成立の流れ

```text
[観測／外部結果]
       ↓ 出所と同じ依頼を保持
[隔離された候補]
       ↓
[人間の採用／却下]
   ┌────┴────┐
   ↓               ↓
[所有正本]     [候補の破棄／保留]
```

## 3. 試験段階と外部境界の適用

| 試験段階 | 適用 | 確認する範囲 | 外部境界の到達範囲 | 判断理由 |
| --- | --- | --- | --- | --- |
| UT | Conditional | 候補状態、採否判定、Revision／Scope再照合およびLease settlementのApplication規則 | Direct Boundary | 採用Applicationを独立実装する場合にFake Portとの直接境界を確認するため |
| IT | Required | 観測結果、Candidate Store、正本Writerの境界 | Related 2 Blocks | 候補隔離と正本Effect 0を共同確認するため |
| ST | Required | 観測から候補作成、採否、正本反映まで | System/E2E | 一部のStore成功だけで昇格成立にしないため |
| UAT | Required | 人間が採用・却下・保留を選び結果を理解する場面 | User Acceptance | 採否は人間の決定権限を含むため |

### 条件区分の適用

| 条件区分 | 適用 | 対応Local Item | 判断理由 |
|---|---|---|---|
| 正常 | Required | CPR-IT-001、CPR-IT-008、CPR-IT-010、CPR-UAT-002、CPR-ST-005 | 通常の成立経路を独立して確認する。 |
| 境界 | Required | CPR-UT-009、CPR-IT-006、CPR-UAT-007 | 値、Authority、情報、責務または利用者判断の境界を確認する。 |
| 準正常 | Required | CPR-UAT-003 | 継続可能な分岐、保留、観測不能または診断状態を成功へ畳まない。 |
| 異常 | Required | CPR-IT-004、CPR-IT-011、CPR-IT-012 | 不正入力、故障または拒否経路を通常成功へ畳まない。 |
| 回復 | N/A | - | 失敗後の再入場または回復義務を持たない。 |

## 4. 検証項目

| Local ID | 条件区分 | 試験段階 | 試験種別 | 対象／境界 | 外部境界の段階 | 事前状態／入力 | 操作／刺激 | 観測 | Oracle | Evidence | 終了後条件 | 実行形態 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `CPR-IT-001` | 正常 | IT | Contract／Persistence | 観測結果→Candidate Store | Direct Boundary | 出所・対象改訂版・依頼Identityを持つMeeting Itemまたは外部処理結果 | 正本を変更せず候補を作成する | CPR-IT-001として、「正本を変更せず候補を作成する」前後の観測結果→Candidate Storeについて、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | 出所、対象改訂版、同じ依頼、候補Identityを保持 | CPR-IT-001、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「出所、対象改訂版、同じ依頼、候補Identityを保持」および終了後条件「正本Effect 0」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | 正本Effect 0 | Automated |
| `CPR-UAT-002` | 正常 | UAT | Acceptance／Authority | 候補表示→人間判断→正本Writer | User Acceptance | 未採用候補、対象Ownerと範囲、採用権限を持つ決定権限者 | 決定権限者が採用範囲を選び正本反映を許可する | CPR-UAT-002として、利用者の選択、判断理由、参照した根拠、理解できなかった項目および未判断範囲を記録する | 対象Ownerと範囲を再確認し、採用した内容だけ正本へ反映 | CPR-UAT-002、固定した参加条件と入力、利用者の選択・理由・参照根拠、未判断範囲、Oracle判定「対象Ownerと範囲を再確認し、採用した内容だけ正本へ反映」および終了後条件「候補と採用結果を相関」を保存する | 候補と採用結果を相関 | Hybrid |
| `CPR-UAT-003` | 準正常 | UAT | Acceptance／Decision | 候補表示→人間判断 | User Acceptance | 未採用候補と、却下または保留の理由・再評価条件 | 決定権限者が却下または保留を選ぶ | CPR-UAT-003として、利用者の選択、判断理由、参照した根拠、理解できなかった項目および未判断範囲を記録する | 正本を変更せず、理由と再評価条件を必要範囲で保持 | CPR-UAT-003、固定した参加条件と入力、利用者の選択・理由・参照根拠、未判断範囲、Oracle判定「正本を変更せず、理由と再評価条件を必要範囲で保持」および終了後条件「正本Effect 0」を保存する | 正本Effect 0 | Hybrid |
| `CPR-IT-004` | 異常 | IT | Security／Authority | Candidate Store→Authority Gate→正本Writer | Related 2 Blocks | 権限なし自動採用、出所不明、別依頼結果、Owner不明の各反例 | 各反例から正本反映を要求する | CPR-IT-004として、「各反例から正本反映を要求する」前後のCandidate Store→Authority Gate→正本Writerについて、Identity、phase／state遷移、結果field、Effect発行回数、資源残存数および失敗理由を記録する | 採用を拒否し、候補の隔離と原の正本を保持 | CPR-IT-004、固定した改訂版・環境・入力Identity、phase／state遷移、結果field、Effect／資源件数、Oracle判定「採用を拒否し、候補の隔離と原の正本を保持」および終了後条件「追加送信・正本Effect 0」を保存する。Secret、鍵bytes、passphrase、生Provider出力および絶対Pathは保存しない | 追加送信・正本Effect 0 | Automated |
| `CPR-ST-005` | 正常 | ST | Topic／Meeting Lifecycle | Workbench／MCP→Application→Topic・Meeting Store→Relation→所有正本 | System/E2E | TopicとMeetingの登録・編集・取得・一覧、処置済み／未処置Outcome、未完了Action、誤登録と参照Relation | CRUD、Outcome処置、Meeting Close、候補採否、訂正および削除確認を順に行う | 本文、改訂版、Outcome、Action追跡先、Relation、候補採否、削除影響、各Effectと終了後状態を記録する | Topic現在状態とMeeting時点記録を保ち、全Outcome処置後だけCloseする。採用分だけ所有正本へ一度反映し、確認なしの連鎖削除とdangling relationを生じない | 固定Scenario、操作、改訂版、Relation、判断、Effect、Oracle、終了後状態。生Transcriptと絶対Pathは保存しない | 未処置Outcome 0、重複反映0、dangling relation 0、対象外削除0 | Hybrid |
| `CPR-IT-006` | 境界 | IT | Context Adoption Boundary | Workbench→Candidate Store→Orchestrator Adoption Lease→所有正本 | Related 2 Blocks | 採用、破棄、保留、確認なし、別Candidate ID、競合Revision、dirty Scope競合、許可外Pathおよび媒体名だけが同じ候補 | Storeから候補を再読取りし、操作ごとの明示確認を渡して採用または破棄する。採用時はLease取得後に現在Revision、dirty PathおよびScopeを再観測する | Candidate Identity、安全な確認Metadata、明示判断、Lease、現在Revision、dirty Path、許可Scope、Receipt、正本Effect、Commit／Push Effectおよび終了後Leaseを記録する | 同じCandidate IDへの明示採用だけが許可範囲を一度反映し、Receiptを残す。破棄・保留・確認なし・Identity不一致・Revision／Scope競合では正本Effect 0とする。採用操作はCommit／Pushを発行しない | Candidate、確認Metadata、判断、Lease、Revision、dirty Path、Scope、Receipt、Effect、拒否理由およびOracle判定を保存する。Candidate本文、絶対Pathおよび秘密値は保存しない | Lease 0または同じRecovery義務。未採用正本Effect 0、Commit 0、Push 0 | Automated |
| `CPR-UAT-007` | 境界 | UAT | Acceptance／Context Promotion | 候補→利用者判断→所有正本 | User Acceptance | Topic／Meeting／Communication候補と根拠、競合・不明候補 | 利用者が採用先と採否を判断する | 判断、理由、理解できない項目、保留範囲を記録する | 利用者が候補の意味と所有先を理解して採否を選べる | 参加条件、候補、判断、理由 | 判断前の正本Effect 0 | Manual |
| `CPR-IT-008` | 正常 | IT | Record Contract／Read Model | Topic・Meeting Markdown→Project Operation Reader→Workbench／MCP | Direct Boundary | 正常Topic、未処置Outcomeを持つMeeting、全Outcome処置済みMeeting、Identity・状態・改訂・Outcome不正の反例 | 固定Markdownを一覧・詳細Read Modelへ変換する | Identity、状態、改訂、要約、開催日時、未処置Outcome件数および拒否理由を記録する | Topic現在状態とMeeting時点記録を分け、closed Meetingのpending Outcomeを拒否し、不正Recordを完全一覧へ混ぜない | 固定入力、Reader結果、拒否理由、Oracleおよび正本Effect 0 | Topic／Meeting正本Effect 0 | Automated |
| `CPR-UT-009` | 境界 | UT | Candidate Adoption Application | Orchestrator Candidate Adoption Application→Candidate／Lease／Integration Record Port | Direct Boundary | 明示確認の有無、同一／別Candidate ID、基準／現在Revision、clean／dirty Scope、許可内／許可外Path、採用成功／失敗、記録成功／失敗およびLease解放成功／失敗 | Fake Portで既存候補の採用Applicationを一回実行する | Authority判定、候補再観測、Lease取得・解放、Revision、dirty Path、Scope、採用Effect、ReceiptおよびRecovery結果を記録する | 確認済み同一候補かつRevision・Scope一致時だけ一回採用する。確認なし・Identity不一致・競合・許可外Pathでは採用Effect 0とし、記録またはLease settlement不明では同じRecovery義務を返す | CPR-UT-009、固定入力分類、Port呼出し順、Effect件数、Receipt、Lease settlement、Recovery結果およびOracle判定を保存する。Candidate本文、絶対Pathおよび秘密値は保存しない | 成功時Lease 0・Receipt一件。拒否時正本Effect 0。settlement不明時は同じRecovery義務 | Automated |
| `CPR-IT-010` | 正常 | IT | Record Operation／Lifecycle・認可済み集合のRelation | Topic／Meeting公開操作→Repository保存→登録・改訂・Relation・読取り | Direct Boundary | 正常Record、改訂競合、対象不存在、未処置／処置済みOutcome、同Project集合とSource不在・重複・異Project、Owner0／1／複数・既存Owner値・探索例外 | 公開CRUD、一覧・検索、Topic昇格とOutcome処置を同じRepositoryで実行する。両種別からTopic／Meeting／CHG Relationを解決し、集合不整合と探索例外を入力する | 保存呼出し、本文・改訂・状態・結果、Source要求ID、各candidateへのexact種別・ID、操作呼出し数と非Relation操作参照を照合する | 成功操作だけ実改訂へ対応付け、競合・変換不正は保存前拒否。集合不整合は読取り0、0／複数OwnerではOwner IDなし、一意時だけOwner ID、探索例外は部分結果なし。書込み参照はSource維持。認可自体・AM本番Resolver・全公開操作母集合完成は証明しない | 固定入力、公開結果、保存と実Record相関、candidate別搬送記録と不整合時操作0。絶対Pathは保存しない | 対象外変更0、Commit／Push 0。試験Root回収、Relation判定で保存Effectなし | Automated |
| `CPR-IT-011` | 異常 | IT | Record Operation／Failure Boundary | Topic／Meeting登録・更新・昇格／Outcome処置→Repository保存・読戻し・cleanup→失敗搬送 | Direct Boundary | 変換不正、更新前／実更新後例外、rename失敗、短命FileとLock cleanupの失敗・不存在、保存後読取り故障／欠落／bytes・ID・改訂・Project ID差 | 既存保存契約または標準Filesystem APIへ対象限定の故障を注入する | 呼出し件数、実Record改訂・本文、一次例外Identity、cause chain、cleanup例外と試行順、残存物、同一読取りsnapshotとLock保持を観測する | 変換不正は更新0回。一次失敗をcleanupで上書きせず、保存済み事実を入力不正・Effect 0へ偽装しない。close失敗でもunlinkを試み、ENOENT以外の回収失敗を保持する | 固定故障点、改訂、例外Identity／構造と残存物のOracle。実OS cleanup全体の証明とはしない | 対象外変更0、Commit／Push 0。注入復元後に実Handleと試験Rootを回収する | Automated |
| `CPR-IT-012` | 異常 | IT | Record Operation／Public Failure | MCP／Workbench→Domain操作→内部故障の公開応答 | Direct Boundary | Schema不正、一覧の既知意味拒否、未知内部例外、実更新後の例外 | 公開入口へ固定入力と保存故障を渡す | 入力拒否と内部エラー、呼出し件数、保存済み改訂と公開情報を照合する | Schema拒否は配送0回。既知一覧拒否だけを入力不正として保持し、書込み例外は入力拒否へ戻さない。内部故障は固定本文で返し、秘密値・Pathを公開しない | Protocol code／HTTP status、配送件数、保存済み改訂、固定本文のOracle。内部エラーからrollback・Effect 0・cleanupを推定しない | 対象外変更0、Commit／Push 0、自己生成試験Root回収 | Automated |

上記三項目の主要導出元は`ARCH-000006`の[Domain Model詳細設計§9.1](../../../06_Architecture/Details/domain-model/01_Architecture.md#91-状態保存と呼出し順)と`SPEC-000013`のLifecycle・部分成功条件である。012の公開応答は[MCP詳細設計§6](../../../06_Architecture/Details/mcp-server/01_Architecture.md#6-正常準正常異常)で具体化する。`CPR-IT-008`はReader専用のまま維持し、更新試験の成功を正本Effect 0の成立根拠へ流用しない。

## Semantic Coverage Pilot

この表はQuality Local Itemが検証する設計上の意味だけを正方向で宣言する。逆方向の一覧は生成し、本文の類似表現から推測しない。

| Local ID | Semantic Key |
|---|---|
| `CPR-IT-001` | `coordinator.candidate-review-boundary` |
| `CPR-IT-006` | `orchestrator.candidate-adoption` |
| `CPR-UT-009` | `orchestrator.candidate-adoption` |

## 5. 評価とEvidence

`CPR-IT-012`はMCP AdapterとWorkbench Local POSTの局所検証へ接続する。MCPの保存後故障は実更新を行った注入例外で確認し、実OS故障の再現と同一視しない。Workbenchは自己生成の空Topic保存先を通常fileへ置換し、配送前400と保存開始時500、固定本文、file bytes不変、無関係なhealth応答、Listener終了と試験Root不存在を別々に観測する。Remote要求失敗、Workbench保存後故障・投影再読取り、実OS保存確定・cleanup全体は未評価で、項目全体Passとはしない。公開応答の具体化は[Workbench詳細設計§8](../../../06_Architecture/Details/workbench-server/01_Architecture.md#8-failureとrecovery)にも接続する。

`CPR-IT-010`は部分検証である。`topic-meeting-operations.contract.test.ts`の既存7件は種別固定登録・取得・一覧・Cursor・検索・Relation・昇格・Outcome処置と保存前拒否を担当する。MCP正常3件とWorkbenchのTopic CRUD・Meeting Outcomeケースを同項目へ接続し、Topicの通常update、改訂競合、確認なし／確認付きdeleteと改訂・状態を観測する。Repository Suiteの正常2件も010へ接続する。Meeting CRUD等を含む全操作母集合の網羅判定は残り、010全体Passとはしない。`CPR-IT-011`はRepository契約の例外搬送と同期Filesystem APIへの限定注入を確認する。一次失敗のみ、undefined例外、Lock close／unlink併発、短命File unlink失敗／ENOENT、入れ子故障、実保存後cleanup失敗を実改訂・残存物へ照合する。部分write・writeとclose／unlinkの併発・write成功後close失敗・openのEEXISTは、Topic／Meetingの登録・更新ごとに確認する。rename／読戻し未到達、正本bytes・改訂保持、所有descriptor回収、他者File保全と一次失敗Identityを共同で観測する。close注入は実close後の故障報告であり、実OS close失敗時の回収成立を証明しない。親linkと実Process競合は未評価で、実OSの保存確定・Lock回収全体を保証しない。読戻しは以下の限定確認へ接続し、電源断耐久性は人間判断により今回の対象外とする。

Repository保存の読戻しは、Topic／Meetingそれぞれのcreate／updateで、rename後の一回のraw bytes取得と同じsnapshotからの解析をLock保持中に行う。010の一致時成功と、011の欠落・読取り例外・解析例外・bytes／ID／改訂／Project ID差・読取り一次失敗＋Lock cleanup失敗を区別する。不正UTF-8 bytesが正規の置換文字と同じ文字列へ復号される反例も含める。保存後失敗時に実bytes・改訂を残して内部例外を返すこと、短命FileがなくLock残存がcleanup結果へ対応することを観測する。注入は実OS故障の証明ではなく、親差替え・実Process競合・電源断保証や項目全体Passへ拡張しない。

Repository正常CRUDは、両種別の登録・重複登録拒否・一覧・取得・更新・古い改訂拒否・確認なし削除拒否・確認付き削除を同じ自己生成Rootで照合する。保存本文と改訂、拒否時Effect 0、削除後のRecord親・Lock不存在と一覧からの消失を確認する。Meetingを先に削除してTopicへの既存Relationを解消し、Relation条件を迂回しない。試験Rootは検証済みRepository-local `.crdd/tests`から作成し回収する。この確認はRepositoryの通常経路を補うもので、公開操作全母集合・協調Writer実Process競合・異常死回復の成立根拠ではない。

協調Writer競合は同じ`CPR-IT-010`の別ケースで確認する。両種別について第一子Processの実Lock取得を通知後、第二子Processの同改訂更新を実行する。第二子の正常close・改訂競合結果・Effect 0と、第一子の保留・正本bytes／改訂不変・Lock存在を確認してから解放する。第一子の正常close・更新結果・改訂2と正本一致、Lockと短命File不存在、親Processによる改訂3更新を照合する。待機とjoinは期限付きとし、所有子の終了を確認できない場合はRootを削除せず一次失敗とcleanup失敗を分けて返す。取得順を固定した協調Writerの範囲であり、同時open勝者選択・異常死回復・非協調親差替え・電源断保証を含めない。

公開CRUDの種別固定ケースでは、Topic／Meetingそれぞれの公開操作集合から通常update・古い改訂拒否・削除前確認・確認なし／確認付きdeleteも実行する。公開結果と実本文bytes・改訂・拒否Effect 0・削除後get／list・Record親／Lock不存在を共同確認する。誤種別の登録／取得拒否、反対種別の専用操作非公開は同じケースに保持する。新しい公開APIや保存方式は追加せず、通常CRUDの接続確認と検索・昇格・Outcome等の別ケースを区別する。

候補生成の成功を正本反映の成功にしない。Evidenceは候補の出所、人間判断、対象Owner、実際の反映範囲、却下／失敗時のEffect 0を別々に記録する。

静的な親link拒否は`CPR-IT-011`の追加確認へ接続する。両種別のRoot／種別親／Record親にあるjunction・dangling link・通常File、CHG参照の三親、EACCESとENOENT、mkdirのEEXIST後linkを反証する。Root拒否、CRUD・一覧・削除前確認・CHG参照の拒否と正本bytes・sentinel保持、Lock不存在を観測する。読戻しの不存在注入はexistsSyncのfalseではなくlstatのENOENTへ接続し、原Oracleを維持する。上記未評価の親link保証は非協調Processの同時差替えを含む保証であり、この静的拒否から成立を主張しない。

## 追加試験種別の適用

| 種別 | 適用 | 確認する範囲 | 実行許可 | 未実行時の扱い |
|---|---|---|---|---|
| RT | Required | 変更した意味と利用側から、再実行する既存Local Itemを選ぶ | Changeの通常検証範囲 | 未選択の範囲を明示し、選択した回帰の結果で評価する |
| PT | N/A | 現在のQuality Contractに性能成立条件がないため非該当 | N/A | 未実行をPassへ読み替えず、明示的なRelease条件でない限り通常監査を停止しない |
| LT | N/A | 現在のQuality Contractに長時間成立条件がないため非該当 | N/A | 未実行をPassへ読み替えず、明示的なRelease条件でない限り通常監査を停止しない |


## UI／SPEC Detailからの観測条件

Source Definition由来の検証義務を維持し、Detailは具体的な観測境界として同じ検証目標へ統合する。

| Detail Source | Source Definition | 追加する観測条件 | 処置 |
|---|---|---|---|
| [SCR-000009／PRT-000009](../../../04_UI/Details/Areas/project-context/SCR-000009/screen.md) | UI-000009 | 情報、操作、Feedback、状態、失敗、Unknownおよび回復をScreen／Part境界で観測する | Mapped |
| [SCR-000016／PRT-000016](../../../04_UI/Details/Areas/operation/SCR-000016/screen.md) | UI-000016 | 情報、操作、Feedback、状態、失敗、Unknownおよび回復をScreen／Part境界で観測する | Mapped |
| [BHV-000013](../../../05_SPEC/Details/BHV-000013/behavior.md) | SPEC-000013 | Trigger、Authority、Validation、State、Effect、Result、FailureおよびRecoveryをBehavior境界で観測する | Mapped |
| [BHV-000027](../../../05_SPEC/Details/BHV-000027/behavior.md) | SPEC-000027 | Trigger、Authority、Validation、State、Effect、Result、FailureおよびRecoveryをBehavior境界で観測する | Mapped |

担当Interaction Relation: `PRT-000009.spec-000013`、`PRT-000016.spec-000027`

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
