# CRDD内部ツールの品質の現在状態

状態: Stable（v0.18.1公開済みBaseline）
担当責任者: Qual-Lab
最終更新日: 2026-09-03

## 結論

現在の公開基準は、Runtime依存閉包を構造是正し、署名前プレチェック、署名済み配布物、採用形態E2E、4経路およびRecoveryを完了したRuntime実行Identity `e290df01…d9d41`と、公式annotated tag `v0.18.1`が指すCommit `14872bd19c3569a4c06752545a6057b2b4aaf3ab`である。branch、作業中Commitまたは本書だけで別の公開基準を作らず、公開状態と最終Identityは公式tagまたは同等の不変なRelease識別子から確認する。[CHG-000056](../90_Release/Changes/CHG-000056_Coordinator_Adoption_Interface_Correction.md)は、単一Platform Access成果物、manifest revision 5、Release Identity／Runtime実行Identity／作業対象Execution Revisionの分離を含む採用入口の是正履歴を保持する。過去候補の実測を公開Identityの成功へ流用しない。

v0.18.0の署名固定版`48515eb`では4経路4/4、固定Workerの復旧7シナリオ、実TaskのSIGINT取消と通常回収を確認した。[対象・時刻・再識別方法・限界](Verification_Results/2026-09-01_Coordinator_Signed_E2E.md#signed-e2e-48515eb)に記録した。v0.18.1の旧署名候補はSource A `a15b997924536dcd306c48a5924ba066627e3fdf`／Tree `ad058d8e768c598937e6cc3261db3cef5980f0ae`とmanifest-only B `371151e9713e4c7e556db883d13af532bc82b3a1`／Tree `076310d110e2ecdadd6484309131f27de0d6860f`である。Runtime実行Identity `f2243b46b8cdde4a09e60efb7bdd61b48f012c4eb418cbdf4222d75306af1aaa`に対する固定配布検証、4経路4/4およびRecovery Matrixは完了したが、署名・検証Runnerの依存閉包を含まないため最終Authority根拠へ流用しない。過去の公開前候補も不採用の履歴として[CHG-000056](../90_Release/Changes/CHG-000056_Coordinator_Adoption_Interface_Correction.md#8-現在状態と残件)に保持する。後継候補では、統合後確認およびRelease判断を署名対象Treeへ自己参照させず、対象タグと結合した公式Release記録で取得する計画だった。この処置は現行`v0.18.1`の公式tagで完了しており、現在のRelease残件ではない。

公開前の確認では、共通Launcherの入口表から署名・4経路・Recovery Runnerの推移的依存を導出した固定候補として、Runtime実行Identity `33cca9b8…2473a`、Source A `ae35bb4`、manifest-only B `423cb51`を使用した。fresh clone／submodule一般Task、4経路4/4およびRecovery 7シナリオは完了したが、独立確認で依存抽出が正規表現に依存し、コメント、bare／absolute／URL moduleおよび選択scriptの子Process targetをFail Closedに閉じていないことを検出した。この候補と`f2243b46…f1aaa`は不採用の未公開履歴として保持し、最終Authority根拠へ流用しない。当時の追加Gateであった字句解析、literal Launcher結合、子Process／Worker target結合、再署名、E2Eおよび独立再確認は、現行Runtime実行Identity `e290df01…d9d41`と公式`v0.18.1` tagで完了している。[対象・結果・限界](Verification_Results/2026-09-01_Coordinator_v0181_Runtime_Identity.md)を参照する。

| 対象 | 現在状態 | 根拠・次の処置 |
|---|---|---|
| v0.19 Project Runtime | 正常縦断2経路、低Risk自己適用、公開件数境界是正および固定改訂版`661de97`の3系統監査は履歴として成立。後続E2E検証器の開始観測と閉集合検証を技術候補`2518ecd`へ是正し、独立再確認はCritical／Major／Minor 0件でPassした。Source A署名前監査も初回Major 2件の是正後にPassした。最終E2E、公開・Releaseは未完了 | 2経路のMCP Objective受理～Milestone受入、うち1経路と別の[自己適用](../90_Release/Changes/Evidence/CHG-000057_Project_Runtime_Self_Application_0acc157.md)で正本採用を確認した。固定改訂版`661de97`の[最終署名前監査](Verification_Results/2026-09-03_Project_Runtime_Final_Pre_Sign_Audit.md)は当該版でPassしたが、後続検証器変更へ流用しない。`2518ecd`はObjectiveごとの別公開Processに加え、OSのProcess起動成功と有効なPID／標準入出力を確認した後の開始通知、通知書込み完了前の失敗・観測不能時のProcess停止、選定と開始の単一順序、および全実行間のOperation ID一意性を実装した。制限Process試験1,579件、Windows実資源Gate 7件、`.ts`へ統一した実子Process fixtureの対象試験8件およびCoordinator全確認が成功した。独立再確認は前回Major 3件の解消と、Provider選定、外部送信Authority、Recovery／adoption、署名IdentityおよびPlatform境界への意図外変更がないことを確認した。[Source A署名前監査](Verification_Results/2026-09-03_Project_Runtime_Source_A_Pre_Sign_Audit.md)はRelease closureと規範の公開伝播に関するMajor 2件を是正し、固定改訂版`1f3f49b`を署名対象候補としてPassした。認証済み公開MCP Clientからの実Provider経路、実Provider実行中取消、実Docker資源のRecovery settlementは最終E2Eまで未完了であり、Project Runtime全体の`Pass`ではない。詳細と次Gateは[CHG-000057](../90_Release/Changes/CHG-000057_Minimum_AI_Native_Project_Runtime.md#8-現在状態と次のgate)を参照 |
| v0.18.1 Coordinator採用入口 | 公開済み。現行署名Identityの採用形態E2E、4経路4/4、固定Recovery Matrix 7シナリオ完了。検証済みDocker Desktop再起動後のTask Recovery公開引数経路は到達不能 | [現行Identityと検証結果](Verification_Results/2026-09-01_Coordinator_v0181_Runtime_Identity.md)、公式tag `v0.18.1`／Commit `14872bd19c3569a4c06752545a6057b2b4aaf3ab`。過去の4/4・7シナリオは有効だが、限定的な公開Recovery不具合と区別する。現行Sourceの入口是正は、到達可能な新しい署名固定版まで公開Baselineへ適用されない |
| 移行前の正式署名E2E | 固定版に限り完了 | [0c3e6d2の結果](../90_Release/Changes/Evidence/CHG-000015_Signed_E2E_0c3e6d2.md)。4経路4/4、復旧7/7、cleanup確認済み |
| 実務自己適用の評価 | Project Runtimeによる限定利用成立、総合的な優位は未確定 | [最新の自己適用](../90_Release/Changes/Evidence/CHG-000057_Project_Runtime_Self_Application_0acc157.md)は、品質文書1件を126.528秒でMilestone受入・正本採用まで完了し、開始後の人間入力、再試行、再計画、手動Recoveryはなかった。人間の実作業時間、AI処理時間、Provider利用量および比較Baselineは未測定。旧Single Task Runtimeの実務結果は[CHG-000055の集約](../90_Release/Changes/CHG-000055_CRDD_Long_Term_Evolution_Roadmap.md#26-実務評価と最終確認への引渡し)へ履歴として保持する |
| 新配置の開発E2E | 対象239件合格 | [対象・条件・限界](Verification_Results/2026-08-31_Tool_Layout_Development_E2E.md)。正式配布や実Providerの証明とは区別する |
| 新配置の機械検証 | CREATE取消競合の追加是正後、Coordinator 1,503/1,503・Checker 208/208成功 | [初回失敗・是正・計測範囲](Verification_Results/2026-08-31_Coordinator_Closure_Verification.md#public-task-cancellation-observation)を参照。Nativeはfresh buildで34成功・2 ignored。過去の分岐網羅率と開発E2Eを今回の新しい計測に数えない |
| 配置移行差分の独立レビュー | Pass | 実装・安全性・試験は指摘0。文書・影響・準拠は初回Conditionalの3件を是正し、限定再レビューで解消・追加指摘0。Runtime全体の完成監査とは区別する |
| 品質3文書の番号付き命名 | 限定確認Pass | 規則・公式・ひな型・参照・移行説明を同期。関連4/4試験と文書・試験の独立確認は指摘0。[対象と結果](Verification_Results/2026-08-31_Tool_Layout_Verification.md#品質文書の固定命名の是正)。移行全体の完了とは区別する |
| 3部品の設計補完と結果表示 | 関連開発E2E 289/289、Checker 207/207成功、限定再確認完了 | [追加確認](Verification_Results/2026-08-31_Tool_Layout_Verification.md#3部品の設計補完結果表示の追加確認)。native・表示・Checker本文の限定再確認で指摘解消。旧配置移行のPassを今回差分へ自動流用していない |
| 最新Runtime全体の独立完成監査 | 3系統の評価終了。試験／利用体験に残った端末条件も追加確認・独立確認で解消 | [完成評価と追加確認](Verification_Results/2026-09-01_Coordinator_Completion_Review.md#windows-terminal-verification)。1,585／208／286試験と署名48515ebの実測を検証義務・変更範囲へ接続。追加実装不足なし。人間の採用・統合・リリース判断は代替しない |
| UX・IA・UIと仕様の接続 | 専門確認、PowerShellとWindows Terminalの限定操作・表示確認、候補内容採用を完了 | [UIと仕様の対応](../04_UI/01_User_Interface.md#ui-spec-mapping)を完成評価で照合。WT-SCOPE-01は追加確認で解消。読み上げと全環境への一般化は未評価のまま保持する |
| 共通起動入口と限定結果保存 | 実装済み、契約・結合試験での確認対象 | 毎回の起動方法を組み立てず同じ配布物の共通入口から起動し、検証画面を閉じた後は保存された開始・結果・完了記録の一致を確認する。[実行手順](../19_Workflows/01_Coordinator_Runtime.md#common-launch-entry)と[検証設計](03_Verification_Design.md#tool-user-experience-verification)を参照。passphrase・確認コード・Provider生出力は保存せず、開始記録だけが残る範囲は結果未確認のまま扱う。この確認だけで正式署名E2E成功や電源断耐性を主張しない |
| v0.18.0移行後の正式署名・実Provider E2E | 固定版48515ebで4経路4/4・復旧7シナリオ・実Task取消完了 | [当時版の結果](Verification_Results/2026-09-01_Coordinator_Signed_E2E.md#signed-e2e-48515eb)。4経路は再試行・是正往復なし。取消は子CLIのexit 2と測定の`verified`を分離し、通常回収・候補未発行・対象資源不存在を確認。v0.18.1や全Provider・全取消時点の保証ではない |
| v0.18.0公開準備時の追加差分（履歴） | 当時の開発確認と独立確認を完了。文書・Checkerの2指摘も独立再確認で解消した | [当時の開発結果と独立確認](Verification_Results/2026-09-01_Coordinator_Completion_Review.md#release-preparation-verification)。Coordinator 1,588/1,588、開発E2E286/286、Checker全所有267/267、Native35成功・2 ignored。初回の制限付き実行失敗と再実行条件を分離した。v0.18.1は本表冒頭と[CHG-000056](../90_Release/Changes/CHG-000056_Coordinator_Adoption_Interface_Correction.md)を参照する |
| v0.18.0統合・リリース | PR #32統合・公開済み | 過去の公開状態として保持する。後継の公開基準は本表冒頭のv0.18.1とする |

旧署名版45ea2acの[是正1往復](../90_Release/Changes/Evidence/CHG-000015_Remediation_45ea2ac.md)と実務1件は、その版の結果として保持し4f10201で再実行したとは扱わない。旧版の実取消失敗と正規Recovery、4f10201でsignalが遅れて通常完了した先行試行、対象Claudeコンテナ1個の`running`観測後に取消と通常回収が成立した試行を分離する。Provider内部の準備完了・処理開始は別途観測していない。今回の公開結果にない`effectStateUnknown`を`false`へ補完せず、対象資源の不存在観測と未出力値を区別する。

## 保持するリスクと追跡

配置漏れは起動失敗だけでなく、検査対象からの脱落や署名対象の不一致を起こし得る。固定Evidenceへの旧リンクを現在のコードへ無条件に読み替えない。実Provider取消・是正など、固定Workerや試験専用adapterでは証明していない範囲を隠さない。

移行の担当と完了条件は[CHG-000017](../90_Release/Changes/CHG-000017_Tools_Coding_Standards.md)、Runtime全体は[CHG-000015](../90_Release/Changes/CHG-000015_Coordinator_Runtime_1_0.md)、工程強化と実務評価は[CHG-000055](../90_Release/Changes/CHG-000055_CRDD_Long_Term_Evolution_Roadmap.md)へ接続する。現在状態の更新だけでそれらを完了へ変更しない。

方針は[品質方針](02_Quality_Strategy.md)、確認項目と限界は[検証設計](03_Verification_Design.md)を参照する。結果は[開発E2E](Verification_Results/2026-08-31_Tool_Layout_Development_E2E.md)と[機械検証・独立レビュー](Verification_Results/2026-08-31_Tool_Layout_Verification.md)から取得できる。
