# CRDD内部ツールの検証設計

状態: Candidate（v0.19.0、Released Baseline: v0.18.1）
担当責任者: Qual-Lab
最終更新日: 2026-09-02

## 対象と判定

### 署名配布物の期限契約

TypeScript署名Core・署名CLI・Platform Access・配布loaderとpackage Gateを一つの確認範囲とする。署名鍵は試験用を使い、開発検証に公式鍵やProvider送信を要求しない。

| 判定対象 | 正常・準正常・異常の確認 | 保持する終了条件 |
|---|---|---|
| 現行revision 5 | `expiresAt: null`の期限なし、UTC期限付き、Coordinator本体、共通Launcherの署名・4経路・Recovery入口と推移的な静的依存、Policy、単一Platform Access成果物、発行後の複数日時、開始前拒否、期限ちょうどと期限後 | revision 5と現行manifest署名domainだけを受理し、nullの場合だけ時間上限を除く。入口表とIdentity seedの不一致、非正規specifier、集合外依存および未束縛の動的importを拒否する |
| 旧revision 2／3 | 旧payload、削除済みfield、旧manifest署名domain | 現行Runtimeは互換読取りやfallbackを行わず拒否する。公開済みv0.18.0成果物の履歴を無効化する意味ではない |
| Schemaと署名 | 欠落・undefined・空文字・文字列null・不正日時・未知revision・envelope/payload不一致、期限改変、旧manifest署名domainの混入 | 改変でAuthorityを発行しない。package content rootの`CRDD\0PLATFORM-PROVISIONER-PACKAGE-CONTENT\0V2\0`は別契約として維持する |
| 署名CLIと事前検査 | --no-expiry、--expires-at、両方・未指定・重複・不正指定 | 不正指定で秘密入力・署名・配置を発火しない |
| ManifestのA→B昇格 | stagingの署名済みbyte、Source AのCommit／Tree、Runtime実行集合、Policy、Native成果物、現在HEAD、固定配置先 | 不透明なbyte列の排他的昇格だけを許可し、署名からCommit Bまでの手動text変換を経路から除く |
| TypeScript／Rust接続 | 同じ署名payloadの正常・異常ベクトルを両検証器へ渡す | canonical byte、domain、成果物結合を一致させる |
| 既存の期限所有者 | Grant、同意、候補、準備記録の期限・取消の既存試験 | 期限なしmanifestから別の権限を延長しない |

新しいRuntime実行Identityを含む正式配布の最終固定では、revision 5の署名manifest、閉じたRuntime実行集合、Policyおよび単一Platform Access成果物を照合し、4経路・復旧7シナリオ・公開task入口の正常経路を検証する。署名時のSource Commit／Treeは出所根拠として保持するが、現在CheckoutのRepository Tree全体をRuntime Authorityへ使用しない。公式tagを新しいclean cloneまたはsubmodule相当のworktreeで検証し、Runtime実行集合、Policy、Git同梱成果物のbyte・Hash・PE profileおよびmanifestのRuntime実行Identityが一致することを確認する。TaskではCRDD Release Identity、Runtime実行Identityおよび作業対象RepositoryのExecution Revisionを分け、開始前後に同じExecution Commit／Treeを観測し、Candidateの`baseCommit`／`baseTree`が作業対象Revisionへ一致することを確認する。独自ZIPを作成・展開せず、GitHubの自動Source archiveもRuntime配布契約の検証対象にしない。旧実測は対象版を維持し、Runtime実行Identityの一致を確認せず新規版の成功へ読み替えない。

この閉じた実行集合には、共通Launcherの正本が選ぶ署名・4経路・Recovery入口と、そこから静的に到達する`script`依存を含める。入口表とIdentity seedは同じ正本から導出し、未選択の開発補助scriptは含めない。非正規specifier、集合外依存、未束縛の動的importまたは選択依存の欠落を負例として確認する。

| Git同梱配布の経路 | 期待結果 | 終了後条件 |
|---|---|---|
| 正常 | 公式tagのclean clone／submoduleで、manifest、閉じたRuntime実行集合、Policy、単一成果物HashとRuntime実行Identityが一致。Task前後の作業対象Execution Revisionが同一で、Candidate baseもそのRevisionへ一致 | 別取得なしでRuntime入口へ到達でき、Authorityは後続Gateまで未発行 |
| 準正常 | non-zero固定publisher digestを宣言したPEで、追加DLL集合とAuthenticodeが一致。Manifest昇格では既存配置先、開始後のsource変化、別候補のstaging、またはSource AでないHEADをEffect前に拒否する | manifest-onlyへfallbackせず追加防御を維持。安全な拒否を昇格成功へ数えない |
| 異常 | manifest欠落・改変、親Commit差、manifest以外のB差分、成果物欠落・Hash差、atomic link前後のProcess消失、link直前のsource／Root／親Directory／file置換、同byte別Identity、二Processの同時link、昇格後検査失敗、Candidateの`baseCommit`／`baseTree`が期待する作業対象Execution Revisionと異なる（配布AまたはBの誤使用を含む）、Task中に作業対象Commit／Treeが変わる | 最終Pathへ0 byteまたは部分byteを公開しない。`sourceのみ`、`同一file objectの二名`、明示破棄後の`destinationのみ`だけを再入場可能とし、別Identity、内容変化または観測不能を自動削除しない。link競合の敗者は自身のEffect 0と他候補非削除を保持する。staging名の破棄を公開Effectへ混ぜず、所有Rootを確認する別処置へ渡す。cleanup未確認ならCommitせず停止する。Candidateを回収し、Provider Effectまたは成功結果を追加発行せずfail closed。Task後のRevision変化と観測不能は、開始時Identity不一致とは別の結果として保持する |
| 判定不能 | shallow／不完全Git履歴、配布Rootまたは作業対象Root／Revision不明、reparse／link、Task後のExecution Revision読取り不成立 | 配布Identityや作業対象の不変性を推定せずEffect 0または状態不明として停止 |

親RepositoryでCRDDをsubmoduleとして利用する経路では、作業対象Commitから`.crdd/external-send-policy.json`を読む明示投影も結合確認する。対象外のgitlinkが同じTreeに存在しても明示fileをexact bytesで読めること、gitlink自身またはその配下を選択した場合は拒否すること、読取り投影なしの全体展開はgitlinkを拒否することを同じ契約試験で確認する。限定file読取りの成功から、submodule内容またはCommit全体の展開を許可済みと推定しない。

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

Docker create応答喪失の回復では、空照会だけで収束しない負例を維持する。正例は、Task submissionより後に始まった署名済みDocker Desktop復旧履歴、Process世代を切る確認済みEffect、Engine ready、安全状態、Evidence保持、明示終了、対象名と所有labelの二軸不存在、およびTask側へ耐久化した再起動境界receiptをすべて要求する。旧manifestの履歴受理が現在のRuntime AuthorityまたはCapabilityを発行しないこと、順序・署名・Policy・保護Root・復旧record・不存在の改変や欠落でEffect 0となることも確認する。

共通起動入口は[起動契約試験](../40_Develop/coordinator/tests/coordinator-launch.contract.test.ts)で、採用Repository向け一般Taskの第一級入口と固定引数、対話TTY成立／redirect拒否、署名stdin非TTY拒否、自動処理の明示選択、実CLIのhelp、起動Directory差、未加工argv・stdin byte・同一PID・終了コード、対象import前拒否とimport後例外を確認する。削除済みの永続有効化・無効化・準備commandがhelp、parserまたは実装へ再出現せず、`capabilities --json`が現行Profileを正確に返すことも確認する。stdout redirect時に内部の安全Gateが拒否する試験だけで、正常に起動できる品質を確認したとはしない。実端末の可視性・一回入力・終了後表示、および署名配布からの実E2Eは別に記録する。

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

Codex等の制限ProcessでWindowsの子孫Process終了を発行できない場合は、`test:restricted-process`で実Windows Process Gate以外の全母集団を確認し、`test:windows-process`を通常のローカルユーザーProcessで確認する。前者だけを全体合格とせず、後者は安定prefixと契約試験でexact 7件へ固定する。制限Processで同じ7件を一般失敗として反復した回数を品質の追加Evidenceにせず、両Gateの合計、各実行環境および終了観測を同じ固定候補へ結合する。通常の`test`は7件を含む完全母集団を維持する。

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

### Fake ProviderによるLifecycle検証の範囲

呼出し元が作る合成観測候補による状態遷移、timeout、cancel、出力上限またはProcess tree不存在のclaimを、Fake Process実行、実Provider認証、Egress、Subscription条件、Operation Authority、CapabilityまたはRelease成立へ流用しない。

動的Fake Provider Lifecycleの観測は、Repository所有の固定Docker Adapterが同じrunで観測した固定image、結果正規化、Container／Process tree不存在およびcleanupに限定する。plain object、Provider出力または合成claimから観測来歴を再構成せず、診断用Docker／一時Filesystem Effectと実Provider／Network／Operation Effectを分離する。Fake限定観測を、実Provider readiness、OAuth、quota、Authority、Capability、GateまたはRelease成立へ流用しない。

通常診断の同期Process境界は実行中cancelを処理できず、timeoutをcancelと読み替えない。固定Fake専用の非同期取消検証では、固定signalの受領、Fake Container内Process終了、Host側Docker CLI attach Processのclose、Container不存在およびHost cleanupを同じrunで確認する。異常経路のHost側Processは一つの所有境界で終了要求をexact 1回に制限し、close不明をContainer cleanupで代用しない。この検証を、通常診断、任意signal、実ProviderまたはOperationの取消Capabilityへ流用しない。

分岐網羅率は試験件数・合否と分離し、追跡対象、ロード済み、同名の重複レコード、未ロード、Native等の対象外を示す。モック由来の重複を単純合算せず、全体率が求められない場合は判定可能な部分集合の分子・分母だけを示す。[完成監査後の追加検証](Verification_Results/2026-08-31_Coordinator_Closure_Verification.md)に測定版と限界を記録し、率だけで未観測の検証義務を解消しない。

公開CLI・正式署名・実Providerの結合は別の検証項目である。移行前後の署名済み4経路・復旧、通常CLIの入力搬送・候補反映・破棄、実Providerによる是正、実Task取消は、それぞれ測定版と観測手段を特定して評価する。版ごとの結果と現在の適用可否は[品質の現在状態](01_Quality_Center.md)へ接続し、過去の失敗・事後回復と是正後の再実測を区別する。固定設計の合否条件へ後続の測定結果を書き戻さない。逆方向の実是正などの未証明範囲は、完成監査で要求と代替根拠を照合し、人間判断なしに完了条件から外さない。未実測という理由だけで一律の追加実測義務を作らず、判断を変える残余不確実性に応じて確認方法を選ぶ。

最終配布では4経路runnerに加え、公開`task --request-stdin --json`へ許可済み固定検証Taskを1件渡す。stdinのUTF-8 JSON搬送から署名package検証、Repository解決、Task実行、signal監視解除、JSONと終了コードまで通し、候補の内容確認・破棄と終了後の資源状態を照合する。4経路runnerはTask関数を直接呼ぶため、この公開入口の正常経路を代替しない。取消・是正は共有部分とProvider固有部分の境界を明示し、未観測部分を実測済みへ読み替えない。
<a id="project-runtime-verification"></a>

## Project Runtimeの検証設計

Project Runtimeの詳細なInterface、永続Record、状態、資源、Lock、Authority、Effectおよび失敗注入点は[Project Runtime詳細設計](../06_Architecture/coordinator/03_Project_Runtime_Design.md)が所有し、[機械可読な設計対応](../40_Develop/coordinator/runtime/project-runtime-design-traceability.json)が各遷移から検証項目までの参照閉包を固定する。本書はその各検証項目の目的、入力、期待結果および合否を所有する。

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
| Platform境界 | Project Runtime CoreがPlatform Contractだけを使用し、Windows Adapterで現在保証を保持 | 未実装Platformは候補として保持するだけでRuntimeへ接続しない | Adapter不在、Platform不明、保証未成立で別PlatformへfallbackせずEffect 0 |

MCPの薄い縦断経路、単一Objectiveの複数Task、最大5並列、5未満の選択、Dependency待ち、競合拒否、部分再計画、人間判断、統合失敗、取消、Parent喪失およびcleanup不明を本番同等入口へ段階的に接続する。CRDD v0.19自身の自己適用では、Time to Accepted Result、Human Active Time、AI Processing Time、Queue Waiting、Integration Cost、Conflict、Retry、Remediation、Replanning、Human Escalation、Provider利用および後工程Findingを観測する。さらに、レビュー、独立レビュー、監査、再レビュー／再監査、検証時間、完了までの検証反復、根拠量、指摘事項および是正回数を、取得可能で比較に有効な範囲で記録する。並列化の有用性を個別合格数で代替せず、保証活動の削減だけを成功としない。

固定開発版の実Provider E2Eでは、開発SessionのSource／Native／Repository Identity、期限、Task数、CLI呼出し上限を確認する一方、それ自体の重複した対話確認を要求しない。実際のProvider Effectは通常の初期外部送信許可を必ず通り、同じ永続境界では既存許可を再利用する。許可なし、境界変更、失効、取消または観測不能では、送信前の確認またはEffect 0へ閉じることを確認する。開発Sessionの成立、固定入力または試験用Capabilityから外部送信AuthorityやRelease Authorityが発行されないことも反証例で確認する。

最終署名E2Eでは、MCP関数の同一Process呼出しを公開Processの成立根拠にしない。署名配布Rootの`coordinator mcp --stdio`を実子Processとして起動し、認証済みの意味結果、Codex／Claude実行経路、親stdinの終了、子Processのjoin、正本採用および終了後資源を同じrunで確認する。実Provider取消は、Provider選定を公開Processのstderr上の構造化eventで観測した後に親stdinを閉じ、意味結果の`cancelled`、cleanup、手動Recovery、正本不変および子Process終了を確認する。通常完了後のDocker回復状態がcleanであることはRecovery settlementの実行証明ではない。実Docker Recoveryを発生させてexactな義務のsettlementまで観測できない場合は、正常・取消の合格と分けて未評価を保持する。

Providerのturn制限は、作業量から決めるCLI指定値と、Runtimeが結果を受理する絶対上限を別に確認する。CLI指定値以下、指定値を超えるが絶対上限以下、絶対上限超過、上限到達エラー、turn数不正をそれぞれ固定fixtureで検証する。CLI指定値を超えた成功応答を上限遵守とは記録せず、Runtime所有のtimeout、出力量およびProcess停止が実効的な強制境界であることを保持する。実Provider E2Eでは、Provider別の指定値超過を安全停止または採用結果と区別して観測し、単発成功からProviderの制限遵守を推定しない。

Docker create結果不明を検証済みDesktop再起動後に収束させる経路は、Help表示だけでなく公開引数ParserとDispatcherを通して実到達できることを確認する。`--repair-release-root`は修復IDを発行した署名済み配布Rootであり、Docker Taskの生成元ではないことをHelp、Parser、Dispatcher、修復履歴検証および結合試験で同じ意味に固定する。生成元Release Rootは新旧manifest配置のexact一方だけを受理し、両配置併存、欠落、不正byteまたは由来不一致を拒否する。履歴検証を現在の実行Authorityへ流用せず、対象Taskより後の修復順序、exact Task Recovery ID、修復ID、二軸不存在および耐久化後の再入場までを一つの結合試験で確認する。旧`--from-release`は曖昧な互換入口として残さず、Effect前に未知引数として拒否する。

再ログオンをまたぐ回復では、安定した選択ユーザーIdentityとログオンSession Identityを別の試験軸にする。同じ安定Identityかつ異なるSessionでは、通常の生存中Authorityを拒否し、明示的な順序付き引継ぎ後だけ現在SessionのfreshなLock・Root・Policy観測から回復を許可する。安定Identity、Root Identity／保護、Policy、Runtime実行IdentityまたはRecovery IDが異なる場合は、引継ぎ記録も変更Effectも発行しない。終了済み旧修復のEffect 0採用・終了、未終了段階ごとの安全な再開／観測収束／同一ID停止、Task Recoveryの同一ID再入場、再起動Fenceの非成立をそれぞれ確認する。

Docker Desktop修復履歴のRuntime利用側は、履歴なしの初回adoption、現在Sessionでの冪等再入場、旧Sessionからのexact 1件のhandoff、および終了済み履歴のread-only再入場を、同じ実Store・実Filesystem fixtureで順序付きに確認する。分類は`不正 → 履歴なし → 終了済み → 現在Session → 旧Session`を固定し、Session結合booleanとIdentityの矛盾を拒否する。Store返値はOperation、origin、directory、stale対象、run identity、stage、sequence、前Record hashおよびledgerを不変fieldとして比較し、初回adoptionとhandoffで許可する履歴差分だけをallowlistとする。書込み済みRecordの返値検証失敗、helper取得・cleanup不明および境界変化ではHost Effect 0、同じIDの保持、既存byte・残存物・呼出回数の非改変を確認し、rollbackを期待しない。

修復履歴のadoption、session handoffおよびclosureは同じ回復可能な公開処理を使用する。正常な初回公開に加え、準備fileだけ、公開targetと同一fileの準備残存、同じbyteだが別fileの準備残存、部分file、非通常file、未知名、競合する公開結果および観測不能を固定する。読取り専用inventoryが残存を削除せず非成功に保つことと、現在Authorityと期待byteを持つ対象限定persistだけが同一fileの残存を収束することを分けて確認する。公開成功はPlatform固有の確定確認、freshなtargetのexact byteおよび準備fileの明示的不在を共通の最終判定で確認した場合だけ成立する。POSIXではfileとDirectoryの`fsync`、Windowsでは同じ呼出し中のDirectory Identity不変と最終形状を確認する。WindowsではProcess crashまたは再ログオン後に安全に再分類できることを保証し、Directory metadataの電源断耐久性は主張しない。各故障ではDocker／Provider／既存修復へのEffect 0、元記録とRecovery IDの不変、別候補の非削除および外側Lock／helperの解放を確認し、解放不明を成功にしない。

引継ぎ連鎖は、正常な複数Sessionに加えて、自己参照、循環、分岐、番号飛び、部分書込み、競合、改変、8件成立後の9件目拒否を含める。Release軸では上昇または同一Identityの同番号だけを許し、将来Release、降格、同番号の別Identityおよび混在連鎖を拒否する。元記録不変と全Lock解放を終了条件にする。Docker Taskの再ログオン回復、修復履歴の再ログオンおよび修復履歴の公開途中再入場は、機械Trace上で別々の専用試験へ直接接続する。

保証コストの比較では、開始・終了条件、対象改訂版、品質条件、観測できた項目および未測定項目を示す。レビュー数、監査数または根拠量が少ない方式を自動的に優れているとせず、採用可能な結果までの総時間・総処理、人間負荷、後工程指摘および残存リスクと合わせて評価する。計画した変更経路と実際の経路に差がある場合は、差の理由、追加または削除した検証および有効だった検証を、対象CHGまたは品質根拠から追跡できることも確認する。

設計と実装の対応確認では、少なくとも次の意味経路を固定する。

| ID | 分類 | 入力・事前状態 | 期待する主な観測 |
|---|---|---|---|
| PR-N-01 | 正常 | MCPからTask exact 1件 | CLIと同じCore結果、Adapter固有Authority 0、cleanup確認 |
| PR-N-02 | 正常 | 独立Task 7件、上限5 | 同時`starting/running/cleanup_pending`が5以下、枠解放後に残りを開始 |
| PR-N-03 | 正常 | Dependency chainと独立Taskの混在 | 先行受入前に依存Taskを開始せず、安全な部分だけ並行 |
| PR-D-N-01 | 正常 | 検証済みRepository Bindingと完全なProject State／Queue入力 | 世代1から連続する不変Recordをflush・rename・exact readbackし、再読取り結果が入力と一致 |
| PR-Q-01 | 準正常 | 共有Pathまたは意味前提が競合 | 空き枠があっても競合Taskを待機し、非競合Taskだけ開始 |
| PR-Q-02 | 準正常 | 局所失敗、Scope内で代替可能。失敗Taskが依存されない場合と、生存する後続Taskから依存される場合を分ける | 前者は旧Taskを`superseded`として保持し、後継完了後にObjective／Milestone受入まで到達する。進捗は`completed + superseded`を終端として数える。後者は依存を暗黙に付け替えず、State／Queue／Provider Effectを変更せず停止する |
| PR-Q-03 | 準正常 | 同じ認証済み主体・Project／Milestone・MCP request identityの初回開始、再送、切断後再接続 | Operation二重発行0、最新Project State・pending decision・終端結果を返却。別主体、別Project／Milestone、別requestは同じOperationとして開示しない |
| PR-Q-04 | 準正常 | 一部Taskの取消。Task Authority発行直前、発行直後かつ未使用、Single Task開始後およびTransport切断を個別に注入 | 発行前はAuthority 0。発行直後は同じ発行元が未使用Capabilityを失効し、失効不明ならRecoveryを保持する。開始後はsignalだけで完了せず、終了・cleanup・State反映後に枠と競合予約を解放する |
| PR-Q-05 | 準正常 | スケジュール要求と対話要求が同時に未開始、選択とclaimの間に対話要求が到着、または対話Operationが`leased / running`になった後にスケジュール要求が到着 | 未開始要求間では対話要求を選びスケジュール要求を耐久Queueで待機する。候補選択後にRepository Binding単位Leaseを得た呼出し側はQueueをfreshに再走査し、最優先候補が変わっていればclaimせずEffect 0で解放する。実行中Ownerがある時系列では二つ目のLease・Task・Provider Effectを発行せず、後着スケジュール要求を`waiting_foreground`へ保持する。Repository Binding単位の別Process同時取得でも所有者はexactに一つとする。実行中Operationの終端化、Lease解放およびowner settlement後にRevision・容量・Dependency・Conflictを再確認し、同じ既存許可境界なら追加承認なしで安全に再開する。v0.19は同一Binding内を直列化し、Project間並列を合格主張に含めない |
| PR-Q-06 | 準正常 | 古い世代、置換済み／取消済みdecision ID、許可外選択肢、未認証、別主体／別decision、期限切れ／消費済みCapability、Repository側Record改変、保護Root identity／Protection差、未知field、上限超過・制御文字・認識済みSecretを含むcommentを`crdd.submit_decision`へ送信。`prepared`前後、Project State書込み／readback、`finalized`前後、Queue更新前後、応答喪失、明示置換と再送も注入する | 無効入力では正規Capability不変で正当主体の期限内再試行が一度だけ成立。両Rootのapplication ID・expected／new世代・dispositionから再適用／未適用／finalize／Recoveryを一意に選び、不明時Queue／Lease／Task Effect 0。DecisionとMilestoneはともに旧かともに新、Queueはfinalized前Lease 0、LeaseとTask Effectは最大1回。「未受理」「判断受理済み・安全に再開待ち」「再開権を確保」を区別し、実Taskがrunningになった後だけ「実行再開」と表示する。置換は旧hash失効後に新1件だけ。raw値の保存／反射0を確認する |
| PR-D-Q-01 | 準正常 | 同じrequestの再送、世代競合、同一Projectの別Queueからの採用、実Leaseと異なる／解放済み／偽造したowner | 同一requestだけを再利用し、Queue所有者はRuntime発行済みで現在有効な不透明Leaseから導出する。正本採用はProject単位で直列化し、拒否された遷移は新世代を作らない |
| PR-H-01 | 人間判断 | Scope、受入、重大Riskまたは費用上限の変更が必要 | 未許可Task開始0、判断理由・選択肢・影響・保持資源を一括表示 |
| PR-H-02 | 人間判断 | 現在のdecision ID、Project／Milestone、世代、改訂版、許可選択肢、選択ユーザーのOS principalおよびRuntime発行の一回限り・期限付き継続Capabilityを送信。保護Rootへの初回作成・readback・Client返却、`prepared`、Project適用、fresh readback、`finalized`、Project側だけの観測不能、初回作成・prepare・finalize・失効・期限更新それぞれのCAS未成立／成立後応答喪失／readback不明、独立Recovery Store不明、Process喪失、Recovery settlement、応答喪失後の明示置換を注入する | Capability hashとapplication ID／expected・new世代をRepository外の検証済み保護Rootへ作成・readbackした後だけraw値をClientへ返し、同じ発行requestで二重作成しない。Decision／Milestoneを一つのProject State世代で成立させ、両Root照合・finalize後だけQueueを一度Leaseする。Project側だけが不明なら独立した回復意図を先に耐久化して保護RecordをRecoveryへ進め、保護Root自体が不明ならその遷移を主張せず別Recovery Storeだけへexactな回復意図を残す。Recovery Storeも不明なら手動回復・Effect不明・Process再利用禁止。Recoveryは回復意図・保護Root・Project Stateをfreshに結合し、matching newをfinalized、verified old/unappliedをinvalidatedへ収束する。初回作成後のexactなabsent＋raw未返却＋Project未適用、および期限更新後のexactなexpired＋Project未適用はEffect 0で安全にsettleし、freshなissuedはinvalidated、freshなpreparedはrecovery_requiredから既存照合へ接続する。必要な継続Record更新のreadback後だけ回復意図をsettleする。不明・競合では回復意図をrequiredに保持する。再起動・応答喪失・重複submitでも二重Lease／Task Effectを作らず、置換では旧tokenを先に失効して新tokenだけが一度成立。別主体拒否後も正規tokenは期限内に使用できる |
| PR-A-01 | 異常 | cycle、欠落DependencyまたはBinding不明 | Single Task呼出し0、Provider Effect 0、構造化された停止理由 |
| PR-A-02 | 異常 | 6件目を同時開始させる競合注入 | 6件目Effect 0、上限違反を成功へ補正しない |
| PR-A-03 | 異常 | Task結果のcontract、世代、attempt、Operation／Authority binding、Revision、必須／余剰field、結果field相関、保存不能・型不明なRecovery ID、平坦なID群と型付き回復義務が不一致、下位委譲後のhandoff不明、またはEffect開始後の`no_effect / unknown`結果 | 別Taskへの適用0。委譲前の既知拒否だけをEffect 0で再計画する。委譲後の観測不能またはEffect開始後の非`settled`結果は同じProcessを再利用せず、Runtime Process義務だけから外部Effect解決を推定しない。exactな外部回復閉包がなければ`recoveryUnresolved`を保持し、fresh Processでも通常再入場しない |
| PR-A-04 | 異常 | Lease取得中Markerの作成途中、物理Lock／Lock所有Marker／証跡／解放Markerの各境界、Queue owner結合前、`starting / reserved`、`starting / handoff_prepared`、`running`、Authority発行前／開始後のParent喪失、Queueだけ・回復義務の`recovering`だけ・Stateだけを更新した直後、および`recovery_required`からの再開要求。複数種別の回復義務と`maximumReplans: 0`も含める | 新規Task開始0。全資源のfreshな不存在を確認できた同期失敗だけを巻戻し済みとし、それ以外は検証済みの回復義務を保持する。不完全Markerと所有不明Lockは変更せず手動回復へ閉じる。`reserved`はEffect 0で`ready`へ戻す。`handoff_prepared`はOperation相関のexact一致または明示的な不存在に限ってRecoveryまたは`ready`へ進める。`running`はexact一致だけをRecoveryへ進め、不存在をEffect 0へ読み替えない。再開ではClient指定値をAuthorityにせず、Project StateのTask別・種別別Recovery Identity、各義務の`required / recovering / settled`およびQueueの非Authorityな適用IDを照合する。全回復完了、対象資源不存在、専用Queue settlement、全義務settledのfresh retry State、owner不存在、世代／Revision／容量／Dependency／Conflictの再確認後だけ新しいLeaseとTask Authorityを許可する。途中更新後は未完了の種別だけを再開してRecovery Effectを重複発行せず、再計画上限を回復義務へ適用しない |
| PR-A-05 | 異常 | cleanupまたはLock解放観測不明 | 枠を空きと推定せず、Milestone成功0、exact Recovery情報を保持し、通常実行へ直接戻さない |
| PR-A-06 | 異常 | Queue owner喪失、stale file、Runtime外の直接編集または採用直前Revision変化 | 時刻やfile存在だけでLeaseを奪取せず、新規Effect／自動上書き0、再計画・判断・Recoveryを一意に分類 |
| PR-A-07 | 異常 | Platform不明、Adapter不在または対象Platformの保証未成立 | 別PlatformへfallbackせずProject／Task／Provider Effect 0で停止し、未対応を成功へ補正しない |
| PR-D-A-01 | 異常 | Recordのhash破損、hashを再計算した不完全Schema、filenameと世代の不一致・欠落・一時file残存、Lease解放記録の失敗 | 破損を初期値へ戻さず停止する。Lock解放前に回復Markerを耐久化し、解放証跡が確定しない間は同じLeaseを再取得させない。意味上有効な同一ユーザー改変をhashだけで検出できるとは主張しない |
| PR-I-01 | 統合 | 全Task completedだがObjective確認前または成果物Conflictあり | [Project状態契約試験](../40_Develop/coordinator/tests/project-runtime-state.contract.test.ts)と[統合契約試験](../40_Develop/coordinator/tests/project-runtime-integration.contract.test.ts)でObjectiveを`integration_pending`に保ち、Conflictを判断要求へ移してMilestone成功へ補正しない |
| PR-I-02 | 統合 | 全Objective受入、Milestone条件成立 | [統合契約試験](../40_Develop/coordinator/tests/project-runtime-integration.contract.test.ts)でTask候補、受入条件ごとのEvidence、明示採用Authorityおよびfresh Revisionを要求し、ObjectiveとMilestoneを世代更新で受け入れる。[全体結合試験](../40_Develop/coordinator/tests/project-runtime-full-flow.integration.test.ts)で公開Objective入口からAccepted Resultまでを確認する。[公開Runtime構成の結合試験](../40_Develop/coordinator/tests/project-runtime-public-runtime.integration.test.ts)で、Task実行と同じCandidate Store境界が統合へ渡り、別の未検証Storeへ暗黙に切り替わらないことを確認する |

単体試験はGraph検証、Task／Objective／Milestoneの状態分離、受入条件ごとのEvidence、世代比較、容量計算およびAuthority縮小を確認する。結合試験はProject State Store、Scheduler、Single Task Runtime、取消、RecoveryおよびIntegrationの接続を確認する。E2EはMCP／CLIの公開入口から同じ意味契約へ到達し、正常、準正常、異常の代表経路でProcess構成、入力搬送、終了後資源および人間表示まで観測する。モックのTask完了だけから実Process不存在、cleanup、Authority非発行またはEffect 0を推定しない。

排他の結合確認では別Processを同じBarrierから同時に起動し、異なるProject／Queueでも同一Repository BindingのProject Operation Leaseをexactに一つだけ取得できることを確認する。v0.19は同じBinding内を一つずつ処理し、Project間並列は未提供とする。Task Authorityは予約後の各attempt直前に発行されること、7 Taskの2 waveで7個のfresh Authorityとなること、および開始前取消では発行0となることを確認する。

[耐久基盤の契約試験](../40_Develop/coordinator/tests/project-runtime-durable-foundation.contract.test.ts)は、`PR-D-N-01`、`PR-D-Q-01`、`PR-D-A-01`として、Project Stateの正常保存・再読取り・古い世代・破損または意味不正なRecord、Envelopeの余剰／欠落field・未知Record種別、filenameと世代の不一致・世代欠落・一時file／未知file残存、保存byte上限の境界、Queue全世代のProject／Queue identity結合・再送・identity衝突・拒否時の世代不変、実LeaseとQueue ownerの結合、所有中Queueの全離脱経路、同一Project内の正本採用排他、二重取得、正常解放後の再取得、および解放証跡失敗後の回復Markerと再取得拒否を確認する。別ProcessをQueue owner結合前に終了させる実Filesystem fixtureでは、Project Operationと正本採用の両Leaseについて取得中Markerが新規取得を止め、exactなowner不存在、Lock所有Marker、取得／解放／owner喪失証跡を照合して全Marker・Lock不存在と別Queueからの再取得へ収束することを確認する。Project OperationではQueue回復世代のreadbackまで取得中Markerを残し、その直後に停止した同形状態を再処理して世代を重複更新せずMarkerを除去する。取得中Markerをatomic renameした直後のreadback失敗も故障注入し、初回結果から同じ決定論的な回復IDを返し、残存Markerを自動削除せず、後続回復へ接続することを確認する。同じ境界で個別Pathの観測をアクセス拒否にし、`ENOENT`以外を不存在または巻戻し済みへ縮退しないことも確認する。解放Marker作成後・Queue owner結合前の停止、不完全な一時file、不正Markerおよび既存Lockも、完全巻戻しへ誤分類せず決定論的な回復IDを返す。不正または所有不明な資源は自動削除しない。Repository-localな実Filesystemと別Process終了fixtureによりowner喪失後の回収Coreも確認するが、Platform Adapterによる実OS owner不存在観測、公開入口Recovery、電源断、実際の正本採用Effectおよび保護された外部anchorによる改変検出は未評価である。この部分試験を`PR-A-04`～`PR-A-06`全体、耐久基盤全体またはProject Runtime全体の成立へ読み替えない。

[Project実行契約試験](../40_Develop/coordinator/tests/project-runtime-execution.contract.test.ts)は、耐久State／Queue／Leaseから既存Single Task AdapterへTask exact 1件を渡す正常経路、同一Queue再実行のEffect 0、独立Task 7件で同時実行最大5、Dependency、親子Pathと意味競合、契約／attempt／Operation／Authority binding／Revisionが一致しない結果、余剰・欠落field、保存不能なRecovery ID、結果field間の矛盾、Process再起動義務、cleanup不明、同期throwおよび開始前取消を確認する。加えて、Binding単位Lease取得後のfresh選択が変わった場合のclaim 0と、Task Authority発行とSingle Task開始の間に取消された未使用Capabilityの失効を確認する。Queue観測をEffect後に壊す故障注入では、共通終了処理が物理Leaseを解放し、exactな解放証跡から後続reconcileがQueue ownerを消せることを確認する。耐久基盤試験は別ProcessでLease取得後に終了させ、取得済みowner evidenceとQueue ownerを照合し、別Queue／別種別／不正filenameまたは内容の証跡を拒否し、Lock回収、exactな解放またはowner喪失証跡、Marker除去の後にだけQueue ownerを消すCore、終端Queueの解放settlement再開、owner生存または観測不明時の奪取0も確認する。これにより`PR-N-01`～`PR-N-03`、`PR-Q-01`、`PR-Q-04`、`PR-Q-05`、`PR-A-03`～`PR-A-05`の中核契約は部分成立した。ただし認証済みMCP Client、実Providerを伴う取消、親Process喪失、電源断および実Docker Recovery settlementの公開Process E2Eは未評価であり、該当項目全体またはProject Runtime全体の`Pass`へ読み替えない。

[Project Runtimeの意味経路試験](../40_Develop/coordinator/tests/project-runtime-full-flow.integration.test.ts)は、[公開Objective入口の契約試験](../40_Develop/coordinator/tests/project-runtime-objective-intake.contract.test.ts)、[Queue優先試験](../40_Develop/coordinator/tests/project-runtime-queue-priority.contract.test.ts)、[再計画・判断契約試験](../40_Develop/coordinator/tests/project-runtime-replanning-and-decision.contract.test.ts)および[統合契約試験](../40_Develop/coordinator/tests/project-runtime-integration.contract.test.ts)と合わせ、公開Objective入口から失敗、同一計画のfresh attemptまたは部分再計画、人間判断移送、Task候補、統合候補、Conflict停止、明示採用およびMilestone受入までを確認する。公開入力、Planner結果とTask実行集合の余剰field、getter、ProxyまたはScope拡張はProject Effect前に拒否する。追加の[Windows判断Store試験](../40_Develop/coordinator/tests/project-runtime-windows-decision-store.contract.test.ts)は不変CAS世代列と改変拒否、[判断Recovery Store試験](../40_Develop/coordinator/tests/project-runtime-decision-recovery-store.contract.test.ts)は独立Recovery Intentの耐久化とCAS settlement、[再計画・判断契約試験](../40_Develop/coordinator/tests/project-runtime-replanning-and-decision.contract.test.ts)は明示置換、Project終端を含む失効、prepared後の再照合を確認する。[MCP stdio試験](../40_Develop/coordinator/tests/mcp-project-runtime-stdio.integration.test.ts)はbounded入力と親EOF、[実Candidate統合試験](../40_Develop/coordinator/tests/project-runtime-candidate-integration-adapter.integration.test.ts)はCandidate Storeからの統合・明示採用、[公開Runtime構成の結合試験](../40_Develop/coordinator/tests/project-runtime-public-runtime.integration.test.ts)はTask生成から統合まで同じStore境界を使用することを確認する。固定開発版の実Provider E2Eでは、現在Sourceが実行制御を所有し、Candidate Storeだけを検証済み署名配布から注入する。これを現在SourceのRelease Authority成立へ読み替えず、別Storeへの暗黙切替、一般的なmock Candidateまたは未検証Storeで代替しない。Taskが安全に停止した場合は、Provider出力を保存せず、Provider、閉じた理由、cleanup、再起動・手動回復および候補／回復情報の有無だけを同じ実測結果へ保持する。ただし認証済みMCP Client、切断後の実cleanup、電源断、実Clientを含む全Recovery settlementは未評価であり、Project Runtime全体の`Pass`へ読み替えない。

署名後の実回復E2Eは、通常・取消の後で回復状態がcleanであることだけを確認しない。署名済み公開MCP Processから実Provider開始を観測した後に親Process treeを停止し、同一Objectiveをfreshな公開MCP Processへ再送する。Runtimeが耐久状態へ書込み・readbackした`required → recovering → settled → acknowledged`、確認資源の有限終了、Queue settlementおよびfresh retryを、同じProject／Milestone／Queue／Task／Operation／Recovery Identityへ結合した順序付き診断として観測する。診断の書込み完了または有限の失敗収束を待ち、書込み要求だけを観測成立にしない。最終応答のMilestone受入、子Process join、正本不変およびDocker Runtime Stateのcleanがすべて成立した場合だけ`recoverySettlementExercised`を真にする。段階欠落、順序違反、Identity不一致、Process tree停止未確認、fresh再入場未完了またはcleanだけの観測は失敗とする。診断は非Authorityな検証投影であり、ClientからRecovery IDや回復権限を入力させない。

Coordinator責務分離では、Project Runtime CoreからWindows固有moduleへの新規直接依存がないこと、Platform Adapter requestが閉集合であること、AdapterがAuthorityを生成しないこと、未実装PlatformがWindowsへfallbackしないことを契約試験で確認する。既存Windows処理をAdapterの背後へ移す場合は、移行前後でPrincipal／Provider Home、Filesystem、Lock、Process、ContainerおよびRecoveryの同じ保証と異常経路を再確認する。MCPはTransportとPlatformの組合せごとに入力搬送、切断、取消、重複requestおよびcleanupを確認する。Linux／macOSのBuild、配布およびE2Eはv0.19の合格条件へ含めず、対応済みとも表示しない。

機械可読な設計対応は、一つの状態遷移をexactに一つの`BIND-*`へ結ぶ。通常状態更新、取消、Recovery、Integrationおよび正本採用を一つのAuthority／Effect和集合へまとめた入力、取消遷移からSingle Task取消Effectが欠落した入力、通常遷移へRecovery Effectを混入した入力、Effect前IntentとEffect後Receiptの時間関係を逆転した入力を負例として拒否する。

前段の試験記録は時系列で読む。Project実行契約試験単体で未評価だった公開Objective入口、owner観測、対話Lane、再計画および統合の候補経路を、後続の意味経路試験で部分接続した。意味経路試験に残した未評価範囲が現在のGateである。

公開Objective入口のRecovery契約試験は、初回Task結果のexact Recovery IDをProject Stateへ、同じTask集合の非Authorityな適用IDをQueueへ耐久化し、ClientからRecovery Authorityを受け取らず、同じ要求の再入場時だけ発行Runtimeへ回復を依頼する。Docker回復は、回復完了Receiptと資源不存在、Project義務の`settled`、exact Tombstoneの作成・readback、Receipt committed pairのjournal付き除去・readback、Repository Binding／Project／Milestone／Task／attempt／Operation／settlement世代／Runtime Rootの4 hash／Receipt pairのhashとidentityを結合したProject義務の`acknowledged` atomic replace・readback、Tombstoneのjournal付き除去・readback、Queue settlement、fresh retryの順をすべて確認する。Queueが既に`queued`かつ`exact_recovery_settled`で再入場しても、未完了のProject acknowledgementとRuntime確認資源の回収を省略しない。各committed pairの作成・除去中断、内容・Identity不一致、観測不能では成功へ畳まず、同じ対象の未完了側だけを再開する。上限64を1件越える65件の連続回復でも確認資源が累積しないこと、除去済みの旧Receipt committed pairを物理的に再投入しても旧attempt／Operationが現在Project bindingと一致せず削除Authorityを得ないこと、および`maximumReplans: 0`でもRecovery settlementを省略しないことを確認する。State契約試験はAuthority発行前のowner喪失をEffect 0で`ready`へ戻し、開始済みTaskだけをexact Recoveryへ結合する。Docker Recovery契約試験はProject Operation IDから同じ耐久Docker Recovery IDを解決する。MCP Adapter試験は認証済みprincipalを意味入口と判断入口へ同一値で渡すことを、stdio試験はTransport cleanupが成功しても意味結果のcleanup不明・手動回復要を成功へ畳まないことを確認する。これらは契約・Process内結合の成立であり、実Docker資源を伴う公開Process E2Eの代替ではない。

MCP投影は列挙値と件数型だけでなく、Milestone状態、Objective／Task件数、最大128件のObjective別Task状態集計、Work Progress、Quality、人間判断要否、Recovery要否およびNext Actionの相関をCoreと同じ純粋規則で検証する。集約件数だけが一致する一方でObjectiveへのTask割当が成立しない反証例を拒否し、Objective別集計の総和が全体集計と一致することを確認する。Project入力と同じObjective 128件、Task 1,024件の上限を公開結果でも強制し、Task 1,025件、最大安全整数、および複数Objectiveの合計超過を例外または件数比例の割当なしで拒否する。Recovery中の`recover`、判断中の`human_decision`、統合中の検証Action、受入済みの`complete`を崩す反証例も拒否する。一方、Dependency Graphを持たないTransportでは`schedule_task`と`wait_for_task`の一方を推測せず、両方をCoreが選び得る通常Actionとして受理する。

Docker完了Receiptの確認試験は、freshなProject Stateのsettled義務に加え、現在Runtime Rootのidentity・protection・local user・bindingの4 hashとReceiptを照合する。別Root、改変、Receiptと確認済みTombstoneの両方がない状態を成功へ畳まず、Tombstoneの作成・readback後だけReceiptを除去し、Project側の`acknowledged` readbackとTombstone除去まで終えた同じBindingの再入場だけを既処理として扱う。Runtime内部のReceipt identityはSHA-256ではなく、committed pairを指す非空・256文字以下の不透明なfile identityとして検証し、Project側の拡張確認情報から内部回収契約へ渡すfieldはexactな3項目へ再構成する。

<a id="reasoning-context-verification"></a>

## 推論コンテキストの検証設計

v0.19の推論コンテキストは、文書量や項目充足率ではなく、判断を再現・変更・検証するときの有用性と負荷を評価する。既存成果物を用いた代表2経路を固定し、同じ対象について推論コンテキストがある場合と成果物だけの場合の変更判断、伝播漏れ、後工程Findingおよび説明可能性を比較する。

| ID | 経路 | 入力・変化 | 期待する主な観測 |
|---|---|---|---|
| RC-N-01 | 認知推論 | 認知意図、必要な根拠／情報、UX、IA、UIが接続した代表対象を変更 | 上位意図を保持し、必要な情報を欠落させず、変更理由を逆方向に追跡できる |
| RC-Q-01 | 認知推論 | 対象に必要な要素だけを保持し、一部の共通推論要素を省略 | 判断を再現できる範囲で省略を許し、固定Templateの欠落として失敗させない |
| RC-A-01 | 認知推論 | 根拠／情報を除き、視覚強調だけで目標認知状態を成立させる候補 | 情報欠落を検出し、内面または単一行動指標から成立を推定しない |
| RC-N-02 | 選択推論 | 複数の機会候補から対象、位置づけ、Product Bet、Requirementへ接続 | 対象固有の比較観点、根拠、代替、トレードオフおよび人間判断を追跡できる |
| RC-Q-02 | 選択推論 | 固定Scoreを使わず、判断を変える比較観点だけを選ぶ | 比較の理由と対象外を説明でき、項目数や点数を合否へ使わない |
| RC-A-02 | 選択推論 | Communication上の位置づけがDiscoveryの対象・価値を上書きする候補 | 第二正本化を拒否し、責務競合を人間判断へ戻す |
| RC-I-01 | 学び | 観測結果が仮説を支持、反証または判定不能にする | EvidenceとInterpretationを分け、元のIntentを消さずにHypothesis／Learningを更新できる |
| RC-C-01 | Communication発火 | 比較を必要とする新しい外部説明で、成果物だけでは必要な根拠を再構成できない | 根拠付きの認知意図を発火し、必要な根拠／情報、現在有効な意図、観測方法と対象改訂版へ接続する |
| RC-C-02 | Communication非発火 | 誤字訂正、一意な表現変換、既存の事実通知または公開済み記録だけを更新する | 認知状態、専用成果物または市場・採用探索を追加しない |
| RC-C-03 | Communication判定情報不足 | 認知変化を意図する可能性はあるが、受け手、根拠または決定権限が不明 | AIで内面や理由を補完せず、不足情報、確認先、再開条件を示して未承認の外部行為を停止する |
| RC-C-04 | Communication履歴 | 当初仮説を新しい観測が反証し、現在有効な意図を更新する | 当時の仮説・意図を残し、新しい観測、更新後の仮説、現在有効な意図とAIへ投影した改訂版を区別する |
| RC-C-05 | 説得・配信リスク | 広告、推薦、個別化または再接触が対象者の脆弱性や情報格差でリスクを変える | 固定分類を作らず、表示の識別可能性、重要条件、選択・拒否・訂正、不利益と必要な専門判断へ接続する |
| RC-C-06 | 責務分離 | 価格反応または継続反応から商業性・価値実現を判断する候補 | Communicationは観測と還流に限定し、商業性はDiscovery／戦略、価値実現はUX／仕様／運用等の責務正本へ戻す |
| RC-C-07 | Communication発火境界 | 承認済み事実を指定済み受け手へ不変送信する場合、新しい受け手の比較・判断向けに根拠を伴って再構成する場合、受け手・意図・根拠が不明な場合を比較 | 不変送信は非発火、成果物だけでは構成理由を再現できない再構成は発火、不明時はAIで補わず判定情報不足として扱う |

自己適用では、推論コンテキストの追加前後で、AIが上位意図を破壊した変更候補、工程間伝播漏れ、同一Findingの再発、判断説明に必要な追加質問、記録量および再利用回数を観測する。改善が確認できない、またはTemplate維持費用が判断価値を上回る場合は、必須化せず粒度・配置・適用条件を見直す。内部推論全文、利用者の内面、秘密情報または根拠のない心理属性を検証入力として収集しない。
