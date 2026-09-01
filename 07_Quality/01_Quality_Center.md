# CRDD内部ツールの品質の現在状態

状態: In Progress（v0.18.1再検証中）
担当責任者: Qual-Lab
最終更新日: 2026-09-01

## 結論

本書の内容とReleaseメタデータはv0.18.1の再検証中候補であり、Stableまたは公開済みではない。branch、Commitまたは本書だけでは公開済み基準にならず、公開状態と最終Identityは公式タグまたは同等の不変なRelease識別子から確認する。[CHG-000056](../90_Release/Changes/CHG-000056_Coordinator_Adoption_Interface_Correction.md)は、単一Platform Access成果物、manifest revision 5、Release Identity／Runtime実行Identity／作業対象Execution Revisionの分離を含む採用入口の是正を追跡する。過去候補の実測を別Identityの成功へ流用しない。

v0.18.0の署名固定版`48515eb`では4経路4/4、固定Workerの復旧7シナリオ、実TaskのSIGINT取消と通常回収を確認した。[対象・時刻・再識別方法・限界](Verification_Results/2026-09-01_Coordinator_Signed_E2E.md#signed-e2e-48515eb)に記録した。v0.18.1の旧署名候補はSource A `a15b997924536dcd306c48a5924ba066627e3fdf`／Tree `ad058d8e768c598937e6cc3261db3cef5980f0ae`とmanifest-only B `371151e9713e4c7e556db883d13af532bc82b3a1`／Tree `076310d110e2ecdadd6484309131f27de0d6860f`である。Runtime実行Identity `f2243b46b8cdde4a09e60efb7bdd61b48f012c4eb418cbdf4222d75306af1aaa`に対する固定配布検証、4経路4/4およびRecovery Matrixは完了したが、署名・検証Runnerの依存閉包を含まないため最終Authority根拠へ流用しない。過去の公開前候補も不採用の履歴として[CHG-000056](../90_Release/Changes/CHG-000056_Coordinator_Adoption_Interface_Correction.md#8-現在状態と残件)に保持する。新しい固定候補の統合後確認およびRelease判断は、署名対象Treeへ自己参照させず、対象タグと結合した公式Release記録で取得可能にする。

最終監査は、現候補のRuntime実行Identityが共通Launcherから到達する署名・4経路・Recovery Runnerの依存を含まないことを検出した。`f2243b46…f1aaa`とその4経路・Recovery結果は不採用の未公開履歴として保持し、最終Authority根拠へ流用しない。Launcher入口表から導出する新しい閉包Identity、fresh clone／submodule一般Task、4経路、Recoveryおよび独立確認を再実行する。

| 対象 | 現在状態 | 根拠・次の処置 |
|---|---|---|
| v0.18.1 Coordinator採用入口 | In Progress。旧Runtime実行Identityの4経路4/4とRecovery Matrixは履歴として保持し、Launcher配下の署名・検証依存を含む新Identityを再検証中 | [CHG-000056](../90_Release/Changes/CHG-000056_Coordinator_Adoption_Interface_Correction.md#8-現在状態と残件)。新Source A／manifest-only B、fresh clone／submodule、4経路、Recovery、独立確認およびRelease判断を同じ固定候補へ結合する |
| 移行前の正式署名E2E | 固定版に限り完了 | [0c3e6d2の結果](../90_Release/Changes/Evidence/CHG-000015_Signed_E2E_0c3e6d2.md)。4経路4/4、復旧7/7、cleanup確認済み |
| 実務自己適用の評価 | 限定利用成立、総合的な優位は未確定 | [最新の実務1件](../90_Release/Changes/Evidence/CHG-000055_Utility_45ea2ac.md)はRuntime約111秒、親の反映・検証まで約206秒。[集約評価](../90_Release/Changes/CHG-000055_CRDD_Long_Term_Evolution_Roadmap.md#26-実務評価と最終確認への引渡し)で人間の実作業時間、最終受入、利用量の未測定を区別する |
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
| v0.18.0統合・リリース | PR #32統合・公開済み | 過去の公開状態として保持する。v0.18.1は別の固定候補、PR、最終main Identity、タグおよびRelease判断で追跡する |

旧署名版45ea2acの[是正1往復](../90_Release/Changes/Evidence/CHG-000015_Remediation_45ea2ac.md)と実務1件は、その版の結果として保持し4f10201で再実行したとは扱わない。旧版の実取消失敗と正規Recovery、4f10201でsignalが遅れて通常完了した先行試行、対象Claudeコンテナ1個の`running`観測後に取消と通常回収が成立した試行を分離する。Provider内部の準備完了・処理開始は別途観測していない。今回の公開結果にない`effectStateUnknown`を`false`へ補完せず、対象資源の不存在観測と未出力値を区別する。

## 保持するリスクと追跡

配置漏れは起動失敗だけでなく、検査対象からの脱落や署名対象の不一致を起こし得る。固定Evidenceへの旧リンクを現在のコードへ無条件に読み替えない。実Provider取消・是正など、固定Workerや試験専用adapterでは証明していない範囲を隠さない。

移行の担当と完了条件は[CHG-000017](../90_Release/Changes/CHG-000017_Tools_Coding_Standards.md)、Runtime全体は[CHG-000015](../90_Release/Changes/CHG-000015_Coordinator_Runtime_1_0.md)、工程強化と実務評価は[CHG-000055](../90_Release/Changes/CHG-000055_CRDD_Long_Term_Evolution_Roadmap.md)へ接続する。現在状態の更新だけでそれらを完了へ変更しない。

方針は[品質方針](02_Quality_Strategy.md)、確認項目と限界は[検証設計](03_Verification_Design.md)を参照する。結果は[開発E2E](Verification_Results/2026-08-31_Tool_Layout_Development_E2E.md)と[機械検証・独立レビュー](Verification_Results/2026-08-31_Tool_Layout_Verification.md)から取得できる。
