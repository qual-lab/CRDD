# CRDD内部ツールの検証設計

状態: 配置移行の検証完了・期限なし配布契約の追加検証中
担当責任者: Qual-Lab
最終更新日: 2026-09-01

## 対象と判定

### 署名配布物の期限契約

TypeScript署名Core・署名CLI・Native Supervisor・配布loaderとpackage Gateを一つの確認範囲とする。署名鍵は試験用を使い、開発検証に公式鍵やProvider送信を要求しない。

| 判定対象 | 正常・準正常・異常の確認 | 保持する終了条件 |
|---|---|---|
| revision 2期限付き | 期限内、開始前、期限ちょうど、期限後、null拒否 | 旧V2署名byteと意味を維持 |
| revision 3 | nullで発行後の複数日時、開始前拒否、UTC期限付きの境界 | nullの場合だけ時間上限を除く |
| Schemaと署名 | 欠落・undefined・空文字・文字列null・不正日時・未知revision・envelope/payload不一致、期限改変、V2/V3混同 | 改変でAuthorityを発行しない |
| 署名CLIと事前検査 | --no-expiry、--expires-at、両方・未指定・重複・不正指定 | 不正指定で秘密入力・署名・配置を発火しない |
| TypeScript／Rust接続 | 同じ署名payloadの正常・異常ベクトルを両検証器へ渡す | canonical byte、domain、成果物結合を一致させる |
| 既存の期限所有者 | Grant、同意、候補、準備記録の期限・取消の既存試験 | 期限なしmanifestから別の権限を延長しない |

新しいNativeを含む正式配布の最終固定では、署名manifestとGit Tree・2成果物を照合し、4経路・復旧7シナリオ・公開task入口の正常経路を検証する。Commit AへSource・文書・試験・2成果物を固定し、そのTreeを署名したmanifestだけをCommit Bで追加する。公式tagのCommit Bを新しいclean cloneまたはsubmodule相当のworktreeで検証し、Commit Bの親が署名対象Commit Aであること、AからBへの差分がmanifestだけであること、Git同梱成果物のbyte・Hash・PE profileが一致することを確認する。独自ZIPを作成・展開せず、GitHubの自動Source archiveもRuntime配布契約の検証対象にしない。旧48515ebの実測、物理Ctrl+C、端末表示と実務評価は対象版を維持し、変更の影響を照合せず新規版の成功へ読み替えない。

| Git同梱配布の経路 | 期待結果 | 終了後条件 |
|---|---|---|
| 正常 | 公式tagのclean clone／submodule、manifest-only PE、署名対象親Commitとexact Tree、2成果物Hashが一致 | 別取得なしでRuntime入口へ到達でき、Authorityは後続Gateまで未発行 |
| 準正常 | non-zero固定publisher digestを宣言したPEで、追加DLL集合とAuthenticodeが一致 | manifest-onlyへfallbackせず追加防御を維持 |
| 異常 | manifest欠落・改変、親Commit差、manifest以外のB差分、成果物欠落・Hash差、未知または余剰PE import、宣言済みAuthenticode不成立 | Provider／Provisioning Effect 0でfail closed |
| 判定不能 | shallow／不完全Git履歴、RootまたはRevision不明、reparse／link、読取り不成立 | 配布Identityを推定せずEffect 0で停止 |

対象は[仕様](../05_SPEC/01_Behavior_Specification.md)と[設計](../06_Architecture/01_Architecture.md)が所有する現行内部ツールである。今回の配置変更は[CHG-000017](../90_Release/Changes/CHG-000017_Tools_Coding_Standards.md)、Runtimeの完成条件は[CHG-000015](../90_Release/Changes/CHG-000015_Coordinator_Runtime_1_0.md)で追跡する。以下は検証義務の複製ではなく、その確認方法の対応表である。

| 確認する不確実性 | 観測・検証方法 | 合格に含めないこと |
|---|---|---|
| 移動した実装や試験が検査から漏れていないか | [命名・所有集合試験](../40_Develop/checker/tools-naming.contract.test.ts)で3つのTypeScript projectと実ファイル集合、Rust sourceを照合。0件・欠落・余剰・linkを負例に含める | 新Rootを検査しないために違反0になった結果 |
| 旧配置への実行依存が残らないか | packageで型・全試験・開発E2Eを実行。分割したPath文字列、CLI、manifest、固定Task、改行設定も確認 | 単純な文字列置換だけの完了申告 |
| Taskの結果と実資源の終了が一致するか | [実子Process結合試験](../40_Develop/coordinator/tests/coordinator-task-process.integration.test.ts)で正常、exit失敗、取消、close観測不明、Host cleanup拒否を同じTaskへ接続 | この試験専用adapterを正式署名CLI・Docker・認証・実Providerの証明とすること |
| 回収より先に成功を返さないか | 子Process close、所有Filesystem、Capability、Recovery ID、listenerの終了後状態を観測。不明時は通常完了を拒否 | Promise完了だけによる回収確認 |
| 設計の状態・資源・試験の対応が残るか | [機械可読対応](../40_Develop/coordinator/runtime/coordinator-runtime-traceability.json)と検査スクリプトで実装・試験参照を確認 | 構造的な参照一致だけによる意味網羅の主張 |
| 過去の根拠を改変・誤読していないか | 既存固定Evidenceのbyteを保持し、当時版と現在の後継を区別する。通常リンクと履歴参照をそれぞれ検査 | 旧版の成功を現版のPassへ流用すること |
| 仕様と操作手順が一致するか | 手順の入力、事前条件、停止、取消、結果と仕様を独立照合。公開コマンドの負例と実際の入力搬送を試験 | CLIがあることだけで通常利用可能と説明すること |

## 実行と記録

### Checker・Windows内部部品の検証接続

| 対象と設計上の主張 | 確認する正常・準正常・異常 | 既存の実装・試験と限界 |
|---|---|---|
| Checkerの範囲と報告 | 明示Root／省略、全体／限定／一段展開、Git／fallback、指摘・未確認、0／1／2 | [Checker設計](../06_Architecture/checker/01_Architecture.md#7-設計から試験への接続)から配布本体・契約試験へ辿る。指摘0を意味品質や全体確認へ一般化しない |
| Checkerの境界 | Root外、link、Gitlink、固定履歴の改変・後継欠落 | 配布本体の境界検査とfault injectionを照合。通常Checkerと一時fixtureを作る試験runnerは別の資源所有者 |
| native観測・初期化 | 正しい要求、不正長／flag／nonce、主体・保護・実体の不一致、初期化後失敗 | [native設計](../06_Architecture/platform-access/01_Architecture.md#7-検証への接続)からRustとTS Adapterの両側へ接続。観測候補を実行許可にしない |
| native修復・準備 | helper終了／stdio終了、Job空、一時Registry復元、不明時の停止 | 通常試験、ignored試験、実OS実測を別記する。Rust試験合格をDocker復旧や署名Worker実測へ流用しない |
| native失敗の利用者への到達 | 上位結果に作成可能性・回収不明・再起動／回復要否が残ること | Adapter→Coordinator→公開表示の接続を確認。binaryの単体応答だけでは表示成立としない |

最新実行と独立確認が終わるまで、この対応表だけで各部品を完了にしない。

<a id="tool-user-experience-verification"></a>

### 利用体験・操作・表示と仕様の接続

[検証結果保存の契約試験](../40_Develop/coordinator/tests/verification-result-record.contract.test.ts)は、実FSと実子Processで正常保存、停止結果の保存、callback例外、開始／終了保存失敗、flush失敗、途中終了、同時run、不正Git境界、link／Directory置換、容量・配列・byte上限、秘密風の値・getter・proxy拒否を確認する。公開Recovery入口の未署名停止も保存へ接続する。これらは実Provider成功、電源断耐性、敵対的な同一ユーザーへの耐性を証明しない。

共通起動入口は[起動契約試験](../40_Develop/coordinator/tests/coordinator-launch.contract.test.ts)で、対話TTY成立／redirect拒否、署名stdin非TTY拒否、自動処理の明示選択、実CLIのhelp、起動Directory差、未加工argv・stdin byte・同一PID・終了コード、対象import前拒否とimport後例外を確認する。stdout redirect時に内部の安全Gateが拒否する試験だけで、正常に起動できる品質を確認したとはしない。実端末の可視性・一回入力・終了後表示、および署名配布からの実E2Eは別に記録する。

義務の所有者は[UX](../02_UX/01_User_Experience.md#4-制御信頼検証義務)、[IA](../03_IA/01_Information_Architecture.md#5-検証義務と未解決事項)、[UI](../04_UI/01_User_Interface.md#5-アクセシビリティ利用品質の義務)および[仕様](../05_SPEC/01_Behavior_Specification.md#user-interface-contract)。以下は確認方法であり、義務や合否条件を再定義しない。

| 確認対象 | 正常・準正常・異常の確認方法 | 根拠と未確認範囲 |
|---|---|---|
| 目的から操作への導線 | 採用判断、通常依頼、Checker、復旧、開発署名を各利用者が取り違えず辿れるか確認 | 文書・専門レビューを行う。初見利用者による理解・所要時間は未測定 |
| 初回同意と再利用 | 初回承認、既存境界再利用、変更、失効、拒否、時間切れ、読取不能を区別 | [同意契約試験](../40_Develop/coordinator/tests/external-send-consent-runtime.contract.test.ts)と公開入力経路。実端末での表示認識・一回Enterは別確認 |
| 結果と安全状態の表示 | 実producer→公開結果→人間表示を接続し、候補あり／なし、複数ID、IDなし回収不明、再起動のみ、optional値欠落を確認 | [表示試験](../40_Develop/coordinator/tests/command-report.contract.test.ts)と[限定再確認](Verification_Results/2026-08-31_Tool_Layout_Verification.md#3部品の設計補完結果表示の追加確認)で欠落値を「未確認」とする是正を確認済み。実端末の可読性は別に残り、文字列の存在検査だけでは完了しない |
| 取消と終了 | 正常終了、単一／重複signal、遅延完了、listener解除失敗を再現し終了後条件を観測 | [取消試験](../40_Develop/coordinator/tests/task-cli-cancellation.contract.test.ts)、[実Process結合](../40_Develop/coordinator/tests/coordinator-task-process.integration.test.ts)。実端末閉鎖や実Provider取消とは分ける |
| 候補の処置 | 正常export／discard、期限、Revision差、重複処置、不明状態を検証 | [候補Store試験](../40_Develop/coordinator/tests/candidate-bundle-store.contract.test.ts)。候補生成を人間受入・採用の証明にしない |
| Checker表示 | 全体／限定、指摘あり／なし、未確認、JSON配列／summary報告を照合 | [契約試験](../40_Develop/checker/crdd-check.contract.test.ts)。全体Checker実行結果と人間の理解を分ける |
| 実端末・アクセシビリティ | Windows Terminal／PowerShellの日本語、長いID、折返し、拡大、キーボード、一回Enter、拒否・時間切れ・取消・終了後表示を観測 | 人間承認済みの範囲は[UI§4](../04_UI/01_User_Interface.md#4-現行表示の参照と表現方針)。[PowerShellの限定確認](Verification_Results/2026-08-31_Tool_Layout_Verification.md#端末参照媒体と全体試験の再確認)と、実Task取消の到達・通常回収・事後回復を分ける。版ごとの結果と別端末・読み上げ等の未評価範囲は[品質の現在状態](01_Quality_Center.md)へ接続する。ソース例・静的HTML・固定Fakeで代替せず、外部規格への適合は未主張 |

根拠を記録するときは対象改訂版、実際に使用した入口と環境、期待した認識・操作、実結果、資源／許可への影響を分ける。未測定時間や未確認回数を0へ補正しない。既知差の責任者・再確認契機は[UI未解決事項](../04_UI/01_User_Interface.md#open-issues)、現在品質は[Quality Center](01_Quality_Center.md)へ接続する。

実行手順は[Coordinator作業手順](../19_Workflows/01_Coordinator_Runtime.md)を参照する。実行時は対象改訂版または固定差分、Node版、起動Directory、試験コマンド、結果件数、除外、ログの再識別情報を結果へ残す。現在の品質状態から履歴結果へ辿れるようにし、作業ログそのものをGitへ大量に取り込まない。

取消の結合は、登録済みlistenerからTask Runtime、Controller、本番共通の子Process終了、Host回収・receipt・finalizeまでを接続して確認する。開始・完了結果の本番projectorを試験用の簡略結果で迂回しない。実子孫の終了と模擬Docker資源の回収申告を分け、OSからのCtrl+C配送は直接listener呼出しでは証明しない。

### 固定RevisionのGit object読取り

Repository／Revisionと明示した読取り範囲を保持する[設計上の責務](../06_Architecture/coordinator/01_Architecture.md)を、[Git object読取りの結合試験](../40_Develop/coordinator/tests/git-object-reader.integration.test.ts)へ接続する。試験用Gitが生成したpackだけを置いた領域から公開読取り関数へ渡し、現在Repositoryの圧縮状況やloose objectへのfallbackに依存しない。

| 場面 | 観測する条件 |
|---|---|
| 通常object、後方offset参照の差分、object ID参照の差分 | 対象blob自身の格納形式とbase参照を検査し、Commit／Tree、完全な内容・hash・mode、明示Pathだけの再構成を確認する。生成引数だけで対象形式成立としない |
| index／packの外側checksum破損 | 正常な対照と一変数の変異を区別し、有効な読取り結果へ昇格しないことを確認する |
| 差分本文の長さ・copy・参照・復元後object IDの不整合 | 外側checksumを整合させた変異を使い、形式検査と対象処理への到達を合わせて確認する。公開関数の`null`だけから内側の拒否箇所を推定しない |

Git CLIは開発試験の生成・検査に限って使用し、本番readerの外部Git実行を追加しない。今回の生成環境はWindowsのGit 2.54.0であり、他OSでは未検証としてskipする。対象環境内で格納形式を生成できない場合は前提不成立として失敗させ、skipや別形式への暗黙置換で合格にしない。生成元・pack-only領域・workspace・Git用HOMEはRepository直下の試験領域へ限定し、生成途中の失敗を含め回収する。

### Lockの未到達条件と公開結果

[Lock契約試験](../40_Develop/coordinator/tests/candidate-store-kernel-lock.contract.test.ts)では、公開入力の拒否をfactory非呼出しまで確認し、Supervisorの各段階の送信例外と失敗通知listenerの例外を、既存の非同期喪失・回収確認／不明とは別条件として照合する。内部例外を捕捉したことだけでなく、権限非発行、単一finalizer、後続observerへの通知および公開結果を確認する。Windows測定で未到達の非Windows分岐、到達不能候補、未確認の競合は別評価とし、試験追加だけで全分岐を評価済みにしない。

### 読取りと権限再確認の境界

入力時の拒否と、取得・利用の間に前提が変わった場合を分ける。以下の故障注入は対象Pathまたは取得済みdescriptorに限定し、注入が実際に届いたこと、後始末、および正常な対照を確認する。OS上で自然発生した競合の実測や未知Secretの不存在証明には読み替えない。

| 境界 | 確認方法と終了後条件 |
|---|---|
| 署名情報・配布物の安定読取り | manifest-loaderとrelease-identityの契約試験で、短読取り、open後の実体差、読取り後の変更、Path側の実体差を別々に注入。候補hash／権限の非発行、対象descriptorのclose、元byte保持、注入解除後の正常読取りを確認 |
| 初回同意の取得・保存・取消 | consent-runtimeの契約試験でLock後の主体・保護・実体の再観測失敗と解放例外を各操作へ接続。再観測失敗前の記録不変と、変更済みだが解放不明な場合を区別 |
| Provider権限の発行・消費とMount有効化 | provider-authority-runtimeの契約試験で再検証拒否と5種類のbinding差を発行前／消費前に注入。権限非発行・消費拒否・元Capability再利用不可を確認。provider-home-mount-grant-runtimeではconsume後の期限到達／Source失効を有効化前に作り、active権限非発行と次Grantの正常利用を確認 |
| 結果記録のread-back | verification-result-recordの契約試験で短読取り・内容差・Path実体差を注入。対象close、開始記録の保持、完了記録の非発行、保存失敗の公開結果を確認 |
| 実行後の候補Filesystem | workspaceの公開captureで階層・単一file容量・junctionの拒否を確認。元Repositoryのbyteとworkspace Identityを保持。他の総量上限・全OSの競合は別評価 |
| 隔離設定 | doctorの契約試験で実行Image、User、起動内容、権限、Mount等の成立軸を独立に崩し拒否を確認。危険なDocker設定を実環境へ適用する試験とは分離 |
| trace検査CLI | native-runtime-traceの契約試験で実子Processへ合成traceを渡し、受理0・検査不成立2・引数／読取り拒否1を確認。後者はstdoutを空にし、stderrは固定理由だけでPath・stackを出さない。合成入力の試験をETW収集や通信非発火の実測へ拡張しない |

### Docker CLIの結果と終了観測

[設計上の所有契約](../06_Architecture/coordinator/01_Architecture.md#docker-cliの結果と子プロセスの所有)を、[子プロセス結合試験](../40_Develop/coordinator/tests/docker-owned-process.integration.test.ts)と[Docker操作の契約試験](../40_Develop/coordinator/tests/docker-effect-runtime.contract.test.ts)へ接続する。

| 場面 | 観測する条件 |
|---|---|
| 正常終了、早期`error`後の遅延`close` | 結果を返す時点と子の終了時点を分け、`close`前に所有集合から外れないこと |
| PIDなし、標準入出力欠落、入力の同期例外・非同期error、終了要求失敗 | 生成済みの子の所有を失わず、上限付きの終了観測へ到達すること。`close`未観測を回収成功としないこと |
| 回収中のinspect／removeが生成した子 | receipt有無の両経路で、追加された子も終了確認の対象となること。未終了・未確認の子がある間は設定領域を削除せず、実行コンテキストを保持すること |

固定故障注入の結果を公開結果の利用側へ接続し、失敗結果、回収確認、既存の回復情報、設定領域の保持／削除が矛盾しないことを確認する。既存の正常系も再確認し、注入した通知を実OS障害の再現証明とは扱わない。実行結果と未評価範囲は現在の品質状態へ記録し、この設計へ合格実績を書き戻さない。開発試験は公式署名や実Providerを要求せず、変更後の正式配布の確認は最終固定時の影響評価へ接続する。

分岐網羅率は試験件数・合否と分離し、追跡対象、ロード済み、同名の重複レコード、未ロード、Native等の対象外を示す。モック由来の重複を単純合算せず、全体率が求められない場合は判定可能な部分集合の分子・分母だけを示す。[完成監査後の追加検証](Verification_Results/2026-08-31_Coordinator_Closure_Verification.md)に測定版と限界を記録し、率だけで未観測の検証義務を解消しない。

公開CLI・正式署名・実Providerの結合は別の検証項目である。移行前後の署名済み4経路・復旧、通常CLIの入力搬送・候補反映・破棄、実Providerによる是正、実Task取消は、それぞれ測定版と観測手段を特定して評価する。版ごとの結果と現在の適用可否は[品質の現在状態](01_Quality_Center.md)へ接続し、過去の失敗・事後回復と是正後の再実測を区別する。固定設計の合否条件へ後続の測定結果を書き戻さない。逆方向の実是正などの未証明範囲は、完成監査で要求と代替根拠を照合し、人間判断なしに完了条件から外さない。未実測という理由だけで一律の追加実測義務を作らず、判断を変える残余不確実性に応じて確認方法を選ぶ。

最終配布では4経路runnerに加え、公開`task --request-stdin --json`へ許可済み固定検証Taskを1件渡す。stdinのUTF-8 JSON搬送から署名package検証、Repository解決、Task実行、signal監視解除、JSONと終了コードまで通し、候補の内容確認・破棄と終了後の資源状態を照合する。4経路runnerはTask関数を直接呼ぶため、この公開入口の正常経路を代替しない。取消・是正は共有部分とProvider固有部分の境界を明示し、未観測部分を実測済みへ読み替えない。
<a id="project-runtime-verification"></a>

## Project Runtimeの検証設計

v0.19は、個別Task試験の合計ではなく、Project／Milestone入力から統合受入までの意味経路を検証する。設計、実装、試験の対応は、Project階層、Task状態、遷移、所有資源、Scheduler判断、再計画、判断移送および統合受入を対象にする。

| 確認対象 | 正常 | 準正常・境界 | 異常・判定不能 |
|---|---|---|---|
| Objective Intake | 明示Project／Milestoneを既存Bindingへ接続 | CLIとMCPが同じ意味結果 | Identity・Authority・Revision不明ではTask 0件で停止 |
| Task Graph | 独立TaskとDependency順序を守る | Task総数が5超でもRunningは最大5、枠解放で次を開始 | cycle、欠落dependency、共有競合不明では対象Taskを開始しない |
| Scheduling | 安全に独立なTaskだけ並行実行 | 依存・資源により1～4並列を選ぶ | 6件目、同じLock／変更範囲の競合、古いReady判定を拒否 |
| Replanning | 局所失敗を影響範囲内で再計画 | 計画維持と部分再計画を区別 | Scope・Authority・受入変更は人間判断へ移送 |
| Integration | Task結果を統合しObjective／Milestone受入を確認 | 個別PassでもIntegration Pendingを保持 | conflict、欠落Artifact、受入不成立を成功へ補正しない |
| Lifecycle | 完了・取消後に全子Taskと資源を回収 | 一部停止、親喪失、回復後再開 | cleanup不明、Identity競合、Recovery不成立では通常成功を返さない |
| Project State | 実状態と進捗・品質・次行動が一致 | 未観測値と保留を明示 | 推定率、古い状態、個別Task PassからMilestone完了を生成しない |

MCPの薄い縦断経路、単一Objectiveの複数Task、最大5並列、5未満の選択、Dependency待ち、競合拒否、部分再計画、人間判断、統合失敗、取消、Parent喪失およびcleanup不明を本番同等入口へ段階的に接続する。CRDD v0.19自身の自己適用では、Time to Accepted Result、Human Active Time、AI Processing Time、Queue Waiting、Integration Cost、Conflict、Retry、Remediation、Replanning、Human Escalation、Provider利用および後工程Findingを観測し、並列化の有用性を個別合格数で代替しない。
