# CRDD内部ツールの検証設計

状態: 移行中の候補
担当責任者: Qual-Lab
最終更新日: 2026-08-31

## 対象と判定

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
| 実端末・アクセシビリティ | Windows Terminal／PowerShellの日本語、長いID、折返し、拡大、キーボード、一回Enter、拒否・時間切れ・取消・終了後表示を観測 | 人間承認済みの範囲は[UI§4](../04_UI/01_User_Interface.md#4-現行表示の参照と表現方針)。[今回のPowerShellの限定確認](Verification_Results/2026-08-31_Tool_Layout_Verification.md#端末参照媒体と全体試験の再確認)は実施済み。別のWindows Terminal環境、読み上げ、実Task取消等の未評価範囲を保持し、ソース例・静的HTML・固定Fakeで代替しない。外部規格への適合は未主張 |

根拠を記録するときは対象改訂版、実際に使用した入口と環境、期待した認識・操作、実結果、資源／許可への影響を分ける。未測定時間や未確認回数を0へ補正しない。既知差の責任者・再確認契機は[UI未解決事項](../04_UI/01_User_Interface.md#open-issues)、現在品質は[Quality Center](01_Quality_Center.md)へ接続する。

実行手順は[Coordinator作業手順](../19_Workflows/01_Coordinator_Runtime.md)を参照する。実行時は対象改訂版または固定差分、Node版、起動Directory、試験コマンド、結果件数、除外、ログの再識別情報を結果へ残す。現在の品質状態から履歴結果へ辿れるようにし、作業ログそのものをGitへ大量に取り込まない。

取消の結合は、登録済みlistenerからTask Runtime、Controller、本番共通の子Process終了、Host回収・receipt・finalizeまでを接続して確認する。開始・完了結果の本番projectorを試験用の簡略結果で迂回しない。実子孫の終了と模擬Docker資源の回収申告を分け、OSからのCtrl+C配送は直接listener呼出しでは証明しない。

分岐網羅率は試験件数・合否と分離し、追跡対象、ロード済み、同名の重複レコード、未ロード、Native等の対象外を示す。モック由来の重複を単純合算せず、全体率が求められない場合は判定可能な部分集合の分子・分母だけを示す。[完成監査後の追加検証](Verification_Results/2026-08-31_Coordinator_Closure_Verification.md)に測定版と限界を記録し、率だけで未観測の検証義務を解消しない。

公開CLI・正式署名・実Providerの結合は別の検証項目である。移行前の[署名済み4経路と復旧結果](../90_Release/Changes/Evidence/CHG-000015_Signed_E2E_0c3e6d2.md)は履歴として保持し、新配置は[45ea2acの4経路・復旧結果](../90_Release/Changes/Evidence/CHG-000015_Signed_E2E_45ea2ac.md)を固定版の実測根拠とする。通常CLIの入力搬送・候補反映・破棄は[同版の限定実務](../90_Release/Changes/Evidence/CHG-000055_Utility_45ea2ac.md)、Claude実行／Codex確認の是正1往復は[欠陥を仕込んだ限定実測](../90_Release/Changes/Evidence/CHG-000015_Remediation_45ea2ac.md)に接続する。実Provider取消、逆方向の実是正などの未証明範囲は、完成監査で要求と代替根拠を照合し、人間判断なしに完了条件から外さない。未実測という理由だけで一律の追加実測義務を作らず、判断を変える残余不確実性に応じて確認方法を選ぶ。

最終配布では4経路runnerに加え、公開`task --request-stdin --json`へ許可済み固定検証Taskを1件渡す。stdinのUTF-8 JSON搬送から署名package検証、Repository解決、Task実行、signal監視解除、JSONと終了コードまで通し、候補の内容確認・破棄と終了後の資源状態を照合する。4経路runnerはTask関数を直接呼ぶため、この公開入口の正常経路を代替しない。取消・是正は共有部分とProvider固有部分の境界を明示し、未観測部分を実測済みへ読み替えない。
