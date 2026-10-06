# 実行知の保存刷新と採用先フィードバックの還元

成果物種別: 変更計画・着手前整合確認
変更ID: `CHG-000082`
状態: ③の保存・観測刷新と直接利用側の独立確認を完了。対象外と残存は完了判定を参照。
担当責任者: Qual-Lab
最終更新日: 2026-10-06

## 1. 結論と許可範囲

保存整理③を、実行知（Execution Intelligence）の保存刷新と一般Operationの観測契約の補強として進める。人間は、旧形式の移行をフロントAIへ委ね、新形式へ刷新すること、採用先のフィードバックをRoadmapへ登録し、実行知に関わる項目を今回対応することを指定した。

今回の対象はCRDD標準Repositoryだけである。還元元の編集、外部Provider要求、Docker操作、署名、Release判断は含まない。還元元の局所実証は一般的な成立証明へ昇格しない。

情報源は `C:\project\CRDD-Communication\01_Discovery\03_CRDD_Editorial_Feedback.md`（2026-10-04更新、SHA-256 `7bedb21f3f8808de4f72045c820c9981740ce0ccefabf2c1f6b220819fe9afb2`）。本文の30項目を棚卸しした。情報源の状態は候補であり、本対話の指定と区別する。

## 2. 還元候補の全数処置

下表の番号は情報源の節番号であり、新しい安定IDではない。「後続評価」は実装採用や対象版予約ではない。担当責任者はQual-Labとし、該当工程の再開または採用先の追加実証を再評価契機とする。

| 番号 | 保持する意味 | 今回の処置／正本候補 |
|---|---|---|
| 1 | 会話を判断・理由・制約へ変換する | 後続評価。Documentation／Agentの既存規則との差分を確認する。 |
| 2 | 曖昧な範囲を最大展開しない | 後続評価。Agent／Discoveryの既存範囲確認へ照合する。 |
| 3 | 成果物の成熟度を混同しない | 後続評価。Documentation／Communication。固定状態軸を一律追加しない。 |
| 4 | 外部表現の強度を根拠より高めない | 後続評価。Communication／Documentation。 |
| 5 | 未評価観点を含む完成を主張しない | 後続評価。Quality／Communicationの既存完成契約との差分を確認する。 |
| 6 | 意味モデル・Schema・Compiler・投影・試験を一体で扱う | 後続評価。Communicationの参照実装を汎用性確認前に移植しない。 |
| 7 | 声の役割と切替を構造化する | 後続評価。Communication。複数成果物・ロケールで実証する。 |
| 8 | 章間の問い・役割・前提を接続する | 後続評価。Documentation／Communication。物語形式を全成果物へ要求しない。 |
| 9 | 作業中に一般化可能な還元候補を捕捉する | 後続評価。Maintenance／Discovery。候補登録と採用を分ける。 |
| 10 | 根拠への慎重さと結論の曖昧さを分ける | 後続評価。Documentation／Communication。 |
| 11 | 内部計画を公開上の約束へ変えない | 後続評価。Communication。 |
| 12 | 基本的な対処後にも残る問題を探索する | 後続評価。Discovery／Communication。 |
| 13 | 発見を製品の実際の仕組みへ接続する | 後続評価。Communication。未実装構想と提供能力を分ける。 |
| 14 | 意味の充足と完成物の再現を分ける | 後続評価。Communication／Quality。 |
| 15 | 長い説明の全体像と現在地を示す | 後続評価。Documentation／Communication。 |
| 16 | 図・画像を意味を持つ媒体別投影として扱う | 後続評価。Communication／UI。固定画像の再現と生成能力を分ける。 |
| 17 | 候補応答と編集還流を契約化する | 部分対象。補正・評価を別Executionと親参照へ接続する。自動編集分類・標準への自動還元は対象外。 |
| 18 | 非公開の執筆計画を本文へ転記しない | 後続評価。Communicationの情報境界。 |
| 19 | 追加主張の申告を採用許可にしない | 後続評価。Communication／Quality。 |
| 20 | 文体・物語を進行として指示する | 後続評価。Communication。 |
| 21 | 固定完成物の再現と新規生成能力を分ける | 後続評価。Communication／Quality。90%という局所目標を標準へそのまま持ち込まない。 |
| 22 | SchemaのOwner・Writer・Reader・試験を接続する | 部分対象。実行知の契約地図を更新する。全SubsystemのSchema Checkerは後続評価。 |
| 23 | 安全化した診断を利用側で失わない | 今回対象。閉じた停止段階・原因分類と取得済み使用量を実行記録へ保持する。Operation直接診断は実行知から独立する。 |
| 24 | 任意Capabilityの非採用に再評価契機を残す | 今回はRoadmap登録。Communicationへの実行知接続は還元先側の別判断・別変更。標準の採否規則は後続評価。 |
| 25 | Profile名でなく実際の割当を固定する | 今回対象。役割、Provider、Model、推論量、Profile／Revision、個別上書きと親Executionの観測契約。特定Modelを固定しない。 |
| 26 | GitをRuntime内部の成立条件にしない | 後続評価。Architecture／Maintenance。検証済みRepository境界を捨てる意味ではない。 |
| 27 | 人間へ統合済み成果物を渡す | 後続評価。Agent／UI／Communication。 |
| 28 | 未網羅分岐をUT／IT／ST・単純化・未確認へ全数処置する | 部分対象。今回の保存・観測変更の反証例へ適用する。全工程の規範・Checker強化は後続評価。 |
| 29 | 外部Effect試験が承認入口を迂回しない | 後続評価。Quality／Architecture。今回は外部Effectを発行しない。 |
| 30 | 使用中APIの公式契約を送受信・利用側へ接続する | 部分対象。診断の段階と使用量の欠測を一般観測として保持する。API実装・公式仕様照合・実Provider確認は別作業。 |

## 3. 着手前整合確認

基準改訂版は `538d69886061a85f97ecfaf37bb6f0d239e55c47`。変更分類は保存契約の刷新と観測契約の拡張であり、旧保存形式の互換Readerを作らない。Architecture／Qualityの読取り専用確認を一括統合してから初回編集する。

| 対象 | 保持する保証／処置 |
|---|---|
| Architecture | ARCH-000007／000016／000018の記録・時系列・不変公開責務を維持する。 |
| Coordinator Producer | Task記録を維持し、実測しないProfile・Model・使用量は明示的な未観測にする。Schema追加から実測接続を主張しない。 |
| 一般Operation Producer | Task IDを捏造せず、OperationとExecutionで記録できる公開契約を追加する。 |
| Store | exact Repository Root、競合排除、同内容の再入場、異内容拒否、確定確認と未確定の分離。 |
| Workbench Reader | Taskと一般Operationを区別する。欠測・使用量・失敗を空値や成功へ畳まない。 |
| Quality | 旧26件等の過去Evidenceは基準Capabilityの根拠であり、新契約の検証結果ではない。 |
| 移行 | フロントAIが旧処理停止・必要情報保全・新版検証・旧領域清掃を行う。Runtimeによる旧形式変換、Fallback、二重書込みは作らない。 |

設計・品質の独立レビュー、文書監査、利用側・移行の不足／影響確認を実施する。準拠基準を変更しない範囲では準拠監査を一律追加しない。外部Provider・Docker・署名E2Eは観測Storeの局所確認へ代用せず、実行しない。

## 4. 新保存構成

```text
<verified-repository-root>/.crdd/execution-intelligence/
├ history.jsonl
├ history.lock
└ history.pending.jsonl
```

`history.jsonl`は1行1実行記録であり、件数要約だけではない。`history.lock`はRepository内の履歴全体を排他し、操作別Lockによる同一履歴の更新競合を避ける。`history.pending.jsonl`は完成Snapshotをflushして保存確定する短命なファイルである。残存時は確定・未確定を確認し、名前や経過時間だけで削除しない。`state.json`、操作別Directory、`staging/`、`work/`は追加しない。

旧`.crdd/execution/`はRuntimeから読み取らない。旧記録の移行・削除はフロントAIが参照、使用中状態、必要Evidenceを確認した別操作であり、今回の実装だけで旧物理残存を消さない。

2026-10-06、人間は③の通常履歴の30日自動整理を承認した。続けて両Toolの期間設定を指定し、設定をGit管理する非秘密のTool別ファイルへ分ける判断を行った。現在の採用配置は`.crdd/config/project-runtime.json`と`.crdd/config/execution-intelligence.json`である。各Toolは自分の設定だけを読み、未設定は各30日、不正・読取り不能は当該Toolの整理を停止する。当初案の共通`history-retention.json`は採用しない。期間抽出と物理削除を分け、正式Evidence、未解決義務、回収未確認記録は通常履歴の期限で削除しない。旧形式の物理削除は別の移行確認操作である。

## 5. 観測契約と対象外

v2の共通Event内で`task_attempt_settled`と`operation_settled`を区別する。Taskでは既存のexact Identityを維持し、一般OperationではProject／Operation／Executionと観測付き親参照を使用する。補正・Model変更を旧実行の上書きにしない。

実績割当は既存の役割・Provider・ModelにProfile ID／Revision、推論量、上書きの観測状態を接続する。未取得を設定値や既定Profileから推定しない。診断は許可した閉じた段階・分類・識別値だけを保持し、生の本文、自由文message、Header一式、認証情報を受理しない。許可していないProvider診断値は原文保存でなく欠測へ処置する。

HTTP失敗、拒否、打切り、JSON解析、Schema検査、対象一致、意味検査を分ける。取得済み使用量は失敗時にも保持し、費用の欠測を無課金へ変えない。Operation単体の現在停止理由は元Runtimeが所有し、実行知の利用不能で直接診断を失わない。

対象外: Communication Runtimeへの接続実装、Header解析、従量API／自動Fallback、費用推定、品質の自動採用、新DB、常設ログService、全Subsystem Schema基盤、全工程coverage規範の変更。

## 6. 必須検証と完了条件

- Task／一般Operationの受理・拒否・未観測、旧v1・未知field・Accessor／Proxyの拒否。
- Profile上書き、実績不明、親Execution、混合集計とTask専用Consumer。
- HTTP429、応答後拒否と取得済みusage、部分usage、取得済み0、費用欠測、安全診断の保存・読取り。
- 不正診断へ秘密sentinelを入れた拒否例。拒否情報をディスクや投影へ複製しない。
- 同一Identity同内容／異内容、複数Process更新、短い書込み、flush／公開／再読取り／cleanup故障、部分JSONL。
- exact Root、境界失効、symlink、不正type。ReaderのEffect 0。
- 期間境界、期間外と削除の区別、結果の対象範囲。物理保持は人間判断後に別途反証する。
- 公開RecorderからStore／集計／利用側まで確認し、未接続Producerを観測済みと表示しない。

Formatter、型検査、Lintを通してから試験する。試験成功、独立レビュー、移行手順、現行利用側の接続が揃うまで③を完了としない。今回の検証を全製品E2E、Communication実Provider確認またはRelease可能状態へ拡張しない。

## Tool別設定整理の限定確認

2026-10-06、設定整理だけを固定差分として独立レビューし、未解決指摘0件で限定Passを得た。基準HEADは`538d69886061a85f97ecfaf37bb6f0d239e55c47`、設定Readerのblobは`a9cbd3f1587ee4637e7a87d26c5f35849efa87b5`。対象はTool別設定Reader・直接利用側、Schema・例、配置の正本・運用手順、AI入口およびGit追跡境界である。

| 確認 | 結果と範囲 |
|---|---|
| 静的確認後の設定試験 | 1／1成功。未知項目、不正値、不存在既定、alias、観測不能、相互非干渉。 |
| Project Runtime履歴試験 | 10／10成功。設定変更と過去の期限根拠を区別する。 |
| Execution Intelligence Store試験 | 36／36成功。自Tool不正で停止、他Tool不正は非干渉。 |
| Git管理 | 2設定と配布例は再包含、Runtime状態と未知設定は除外。親Directoryの除外も解除する必要を確認した。 |
| 設定例とSchema | JSON解析、必須項目・30日既定の一致を確認した。CROS例は旧JSONと運用手順のJSONが同一。 |
| Formatter範囲 | 実装Packageの静的検査は成功。配布JSONへの個別実行は既存Biome対象外により0件であり、Formatter成功と表示しない。 |

この限定Passを③全体、実Provider E2E、既知のRuntime Data Path閉包不整合の解消、採用・統合またはReleaseへ拡張しない。現在、設定整理について追加の人間判断は必要ない。

その後、人間はCROS設定例を独立した可視ファイルで保持する方針を指定した。`template/tools/cros-shared-server-config-example.json`を元の内容で復元し、MCP運用手順からリンクする方式へ変更した。文書内の重複JSONは除去し、配置の正本も更新した。これは上表の文書内集約を置き換える現在の採用方針であり、実設定の読取りPath・形式・Authorityは変更しない。先の独立レビューをこの後続編集のレビュー結果へ流用しない。

## 実履歴の移行確認 — 2026-10-06

旧`.crdd/execution/`の33件をフロントAIがv2へ変換し、公開Writerで新JSONLへ保存した。ID・内容の読戻し一致33件、旧原本の不変33件を確認した。原本集合のSHA-256は`37df67ec86a9b657ea61d174c02b1304489244e5c133c4383f549392816faee4`である。

最初の移行呼出しでは、呼出し側が成功状態を`recorded`と誤認し、1件の正常保存後に停止した。公開契約の`completed`へ呼出し判定を訂正して再入場し、既存1件は冪等確認、残る32件は保存した。Writerの成功条件を変更したものではない。

10件の回収未確認・未解決状態は保護対象として保持する。過去のunknownを成功へ変更せず、旧原本は削除していない。新Runtimeは旧形式を参照せず、旧領域へ追加保存しない。旧物理残存の清掃完了、実Provider確認、③全体の独立レビューPassをこの移行結果から主張しない。

## 回帰確認と現在の限界 — 2026-10-06

| 対象 | 結果 | 意味と限界 |
|---|---|---|
| Execution Intelligence | 静的確認後、全71件成功 | 新形式・保持・診断・混合集計・並行公開を含む。 |
| Workbench | 静的確認後、全33件成功 | 実行知の利用側と画面投影。実Providerを使った全E2Eではない。 |
| Coordinator公開構成／Full Flow | 静的確認後、関連13件成功 | 公開構成から実行知の保存・読取りまでを確認。 |
| Runtime Data関連 | 静的確認後、12件中11件成功 | 読取り観測・Tool別設定は成功。Consumer閉包の1件は下記6指摘で失敗。 |

並行試験の初回失敗はfixtureのRoot検証拒否であった。拒否時に結果を返す診断と全child終了後の失敗伝播を追加した。公開Runtime Data APIで保存領域・ignore設定を先に確定し、未作成historyへの並行初回公開を試験する。正常保存・冪等性・競合拒否の条件を弱めず、Ownerの検証を緩めたりretryで隠したりしていない。未初期化Rootの並行bootstrap成功を本試験から主張しない。

Runtime Dataの既知閉包指摘は`project-runtime-durable-foundation.ts`、`project-runtime-history.ts`、`project-runtime-integration-record-adapter.ts`のraw-root／root-literal各1件、計6件である。基準HEADにも同じ直接Path構築があり、今回の新保存境界の指摘とは区別する。試験は失敗のまま維持し、Runtime Data全体のPassや②を含む全域是正を主張しない。この残存が③の完了を妨げるかは独立確認で判断する。

## 独立レビューの初回結果と是正方針 — 2026-10-06

固定差分SHA-256 `f05a2c68a39318365c130dee3db41cc7eb2f4bf83efbecd04cb7e9243bff0d21`をArchitecture／Qualityと文書／Gap影響の二監査へ渡し、全結果終了後に統合した。初回は要是正であり、Passではない。統合案は両監査へ再提示し、修正前の整合を確認した。

| 指摘 | 是正方針 | 変えてはならない条件 |
|---|---|---|
| 診断enumのObject変換 | primitive型を先に確認し、変換hookを呼ばず許可集合へ照合する。 | 許可値拡大、自由文保存、拒否入力の複製をしない。 |
| 公開後不一致を無変更扱い | pending完成byteを公開前検証し、公開後読戻し不一致はunknownと同Event相関を保持する。 | retryで隠さず、旧履歴保全と終了後回収条件を維持する。 |
| 命名14件・試験Header不足 | 対象識別子のみ意味を保って改名し、対応Local ItemのHeaderを残す。 | Checkerを弱めず、正式machine valueと公開fieldを変えない。 |
| 配置図の旧構造 | Runtime Dataの現行treeを履歴・Lock・pendingへ揃える。 | 他Ownerの構成と固定履歴を変更しない。 |
| 概念状態とAPI結果の混同 | 設計のrecordedとAPIのcompletedを区別して説明する。 | 成功literal・回復条件を変更しない。 |

追加共通Checkerは1172 Markdown、18493リンク、2336アンカーを確認し、error／warningとも0だった。一方、別のtools-naming契約は19件中17件成功、上記命名・Header不足で2件失敗した。構造Checker成功を意味妥当性やSource規約の全Passへ拡張しない。是正後は同じ二監査を新固定候補へ実行し直す。

## 是正後の確認 — 2026-10-06

診断の5enumに加え、同根のEvent種別・終端状態・Effect状態もprimitive型を変換なしで検査する。56入力shapeの反証でhook呼出0と拒否を確認した。保存側はpending完成byteをrename前に照合し、公開後不一致をunknownとして同Eventの相関参照をcleanup失敗後にも保持する。短い書込み、公開前後の異内容とcleanup失敗を既存履歴付きで反証した。

統合候補のExecution Intelligenceは整形・型・Lint後に全82件成功した。Coordinatorの全Source整形・型・Lint、構成Graphと二つのTraceability検査も成功した。Runtime Dataの命名・Header是正後、関連8件は成功した。命名14指摘と試験Headerの全数是正後、tools-naming契約全19件が成功した。文書のtreeとAPI結果説明は修正済みである。最新Readerで実履歴33件・全時刻・回収未確認10件の保持を再確認した。

初回Passを流用せず、この是正候補を同じ二監査で再確認するまで③の完了を宣言しない。

## ③の完了判定 — 2026-10-06

是正後の固定差分SHA-256 `4a897523ee2dd4cc09d08abef1bd8ac5040bda69dd6defe9c96810e8f9afb92a`について、Architecture／Qualityと文書／Gap影響の両再レビューがPass、未解決必須指摘0件となった。Architecture／Quality確認者は値契約22件を独立再実行し全成功した。是正後のCoordinator公開構成／Full Flow関連13件も再実行し全成功した。

③の保存・観測契約、直接利用側、Tool別保持設定と新形式への切替を完了とする。旧原本33件は保全し、回収未確認10件の過去状態を保持する。旧領域の物理清掃、既知Runtime Data閉包6指摘、採用先の未接続Producer、署名・実Provider E2E、統合・Releaseは本完了に含めない。現在、③を閉じるための追加の人間判断はない。

## 移行済み旧領域の清掃 — 2026-10-06

人間の「清掃を終わらせて」の指示に基づき、`C:\project\CRDD\.crdd\execution`だけを削除した。操作前に33原本の集合Hashを再照合し、全33件の新EventとのID・内容一致、旧Pathを参照するProcess0、link・未知File・未移行情報なしを確認した。未解決10件は新JSONLに保存済みであるため、未解決情報の削除ではなく移行済み重複物の清掃である。

旧JSON33ファイル・Directory67件（対象Rootを含む）の削除後、旧Rootの不存在を確認した。新公開Readerは33件・全時刻・回収未確認10件を返し、内容保持を確認した。新履歴、他OwnerのRuntime状態、候補、認証、署名、正式Evidenceは削除していない。上記の「旧原本保全・清掃未実施」は清掃前の確認状態であり、現在の清掃状態は本節を使用する。既知Path閉包6指摘と署名E2E等の対象外は継続して残す。

## 既知Path閉包6指摘の是正 — 2026-10-06

人間は基準版から残った6指摘の是正を指定した。対象はCoordinatorの`project-runtime-durable-foundation.ts`、`project-runtime-history.ts`、`project-runtime-integration-record-adapter.ts`であり、各Fileのraw-root／root-literal各1分類、計6指摘である。同じCHG内の保存境界接続是正として扱い、③初回完了時の未解消記録を過去状態として保持する。

着手前に共通Ownerと読取り専用確認者で9用途群を照合した。Pathは公開された名前付き投影から取得し、Writer初期化はensure、Reader・Lease確認・清掃・旧入力観測はobserveを使用する。OS短期排他はVCS Rootだけを検証し、Runtime Areaの作成を新しい前提にしない。ready／真正不存在／型・link不正／観測不能・途中置換を分ける。Read Effect 0、Lease物理Identity、ownerGeneration、exact回復ID、marker順序、世代codec、旧入力HashとmigrationCommitted:falseは変更しない。

Checker免除、literal分割、private Rootや親Directoryの逆算、新Framework、Runtime旧形式互換の拡張は行わない。静的確認の後にRuntime Data閉包、履歴・旧結果・保存基盤・Lease回帰と独立Architecture／Qualityレビューを行う。Docker・Provider操作と再署名は対象外である。現在は実装・検証中であり、6指摘解消をまだ確定しない。

実設定の可視化指示に基づき、`.crdd/config/project-runtime.json`と`.crdd/config/execution-intelligence.json`を作成した。どちらもschemaRevision 1・historyRetentionDays 30であり、各公開Readerが`source: "file"`として受理することと、Git allowlistによる追跡対象であることを確認した。ファイルなしの既定値利用から、同じ期間を明示する実ファイル利用へ変更したものである。

### 検証と完了判定

初回固定差分SHA-256 `8b18837575b7be45cb73cc43f19f44e9ffcb77ac27bbcf5a5aede95d9f0cdab9`では、保存基盤59件中58件が成功し、1件失敗した。独立Architecture／QualityレビューのDFR-001は、取得後Root変更の故障注入が旧API名に依存し、新入口への変更後に発火しない点を指摘した。全結果終了後に同じ観測点への接続名だけを修正し、注入発火、blocked、元Root／別Rootへの保存0の判定は維持した。ProductionとCheckerを追加変更していない。

新固定差分SHA-256 `67bb73e55a8c80005a9370f2ad0d94eff12ae8e4f6aad7c3e5a4b78a27a9c006`で、整形・型・Lint、構成・Traceability検査が成功した。保存基盤全59件、履歴・旧結果・公開構成の直接利用側32件、Runtime Data全38件（利用側閉包を含む）、命名・Header全19件が成功した。各集合の失敗・skip・取消は0である。共通Checkerは1172 Markdown、18495リンク、2341アンカーを確認し、error／warningとも0だった。

独立Architecture／Quality再レビューは新候補Hash、Production不変と故障注入・判定維持を確認し、Pass、未解決必須指摘0件となった。既知Path閉包6指摘は解消とする。過去の未解消・初回失敗記録は保持する。今回の完了を署名、実Provider E2E、全製品品質、統合承認またはReleaseへ拡張しない。公開規範を変更しない限定接続是正のため準拠基準監査は追加せず、必要な独立Architecture／Quality確認と構造・閉包検査を実施した。現在、追加の人間判断は必要ない。

## Checklist

- [x] 30候補を全数処置し、今回対象と後続評価を区別した。
- [x] 情報源の候補状態、Hash、読取り境界と人間指定を区別した。
- [x] Architecture／Quality着手前整合確認を統合した。
- [x] 一般OperationにTask Identityを捏造しない。
- [x] Operation直接診断と実行知の横断観測を分離した。
- [x] 移行をフロントAIの責務とし、旧形式のRuntime互換を作らない。
- [x] 通常履歴の30日自動整理と双方の設定変更を人間判断へ接続した。実装・反証の完了とは区別する。
- [x] 実装・直接利用側試験・新形式切替と同じ監査集合の独立再レビューを完了した。未評価の範囲は完了判定から除外して明示した。
- [x] 既知Path閉包6指摘を公開Owner入口で是正し、反証・全直接回帰・独立再レビューで確認した。
