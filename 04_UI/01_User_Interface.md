# CRDD内部ツールの操作・表示

状態: 既存実装から再構成した設計候補・工程移行未承認
担当責任者: Qual-Lab
最終更新日: 2026-08-31
工程規則: [UI](../25_UI.md)、[UIと仕様の対応レビュー](../24_UI_Behavior_Specification.md)

## 1. 対象と読み方

[利用体験](../02_UX/01_User_Experience.md)と[情報構造](../03_IA/01_Information_Architecture.md)から、現行のコマンドライン（CLI）に必要な入力・認識・フィードバック・回復を整理する。新しいGUIやTUIを設計した文書ではない。

以下の「現行」は[公開CLI](../40_Develop/coordinator/bin/coordinator.ts)、[結果表示](../40_Develop/coordinator/src/core/command-report.ts)、[対話入力](../40_Develop/coordinator/src/core/interactive-console.ts)、[配布Checker](../template/tools/crdd-check.ts)のソースを照合した内容である。実端末で見た結果、UX成立、人間の採用とは区別する。「要求」は既存の人間判断・上位設計から求める状態、「既知差」は今回未解消の差を示す。

## 2. 操作接点と表示構造

| 接点 | 入力・操作 | 表示と次の行動 | 現在の限界 |
|---|---|---|---|
| 案内・診断 | `help`、`doctor`、検証対象とオプション | 準備不足、利用可能性、理由を読み、対応する手順へ戻る | コマンドの列挙には未接続候補も含む。構文があるだけで実行可能としない |
| 初期外部送信設定 | 初回に表示された対象・境界を読み、確認値を入力または拒否 | 許可した境界と現在の依頼を区別。再利用時は同じ入力を要求しない | 端末を取得できない、時間切れ、読取り失敗は停止。確認値をログや保存済み値から自動入力しない |
| 一般依頼 | `task --request-stdin`へ構造化入力。人間の対話入力とは別経路 | 選定した実行者・確認者と理由、最終結果。JSONでは機械キーを保持 | 人間表示は固定した日本語説明を使い、説明未登録の理由は推測せず機械結果の確認へ案内。入力待ちと処理待ちは実端末確認が必要 |
| 候補の確認・処置 | `candidate export`／`candidate discard`とexact ID | 候補ID、期限、処置結果を確認。採用は別判断 | exportを正本への反映、`completed`を人間受入と表示しない |
| 取消 | 実行中のCLIへ`SIGINT`／`SIGTERM`。通常端末ではCtrl+Cが候補 | 取消要求の後も終了・回収結果を待つ | キーの受渡しは端末依存。ウィンドウを閉じたことを取消完了としない |
| 回復・再起動 | exact回復IDと専用入口。再起動要求は別項目 | 通常再実行禁止、残存・ID、操作可能者、次の手順 | IDがない不明状態は担当者へ引渡す。汎用的な「再試行」ボタン相当の案内はしない |
| Checker | 対象と`--json`／`--summary`／限定範囲 | 指摘、件数、対象、未確認範囲を確認して所有文書を修正 | 通常JSONは指摘配列、summaryは集計報告。指摘0だけで全範囲確認済みとしない |
| 開発・配布担当 | 開発検証、固定候補の署名・正式実測 | 開発結果と配布成立を分離。署名失敗時はその段階を示す | Release鍵入力は公式配布担当のみ。通常Taskや一般利用者の準備へ混ぜない |

内部native補助は独立した利用者画面を持たず、観測・停止をRuntimeへ返す部品である。その失敗が診断・停止・回復表示へ届くことを対象に含め、内部バイナリを直接操作する手順は追加しない。

## 3. 状態の認識と操作条件

[共通起動入口](../40_Develop/coordinator/bin/launch.ts)は、端末表示が必要な操作で出力が転送されている場合、実処理へ接続する前に「画面へ表示できる端末から直接起動してください」と表示する。この停止は同意拒否、Provider失敗、資源回収不明とは別である。引数や例外stackを説明へ転記しない。対象入口への接続後に予期しない例外が発生した場合は、実行状態・回収未確認を表示し、成功やEffect 0を推定しない。ウィンドウを勝手に作る、閉じる、確認コードを記録する処理は追加しない。

4経路・復旧検証では「最終結果を保存しました」とRepository相対の記録Directoryをstderrへ表示し、構造化結果のstdoutは維持する。開始保存失敗は検証未開始、終了保存失敗は元の実行結果を保持すべき状態として説明する。画面を閉じたことをユーザーの失敗とせず、保存済み要約を確認する。開始記録だけなら結果未確認とし、自動再実行を案内しない。

| 状態 | 利用者が認識すべきこと | 操作と禁止する誤解 |
|---|---|---|
| 未開始・入力不正 | 何が不足しているか、実行開始したか | 入力を是正。空の結果を成功としない |
| 同意待ち | 今、人間の入力が必要であることと期限 | 内容を確認し承認または拒否。期限後の入力を次回許可に使わない |
| 実行中・確認中 | 誰が何を担当しているか | 待つ、または取消。経過時間を残時間・進捗率へ変換しない |
| 取消要求済み | 取消完了とは限らないこと | 回収結果まで待つ。重複要求を新しい処理にしない |
| 完了・候補あり | 検証済み候補、期限、未採用であること | 確認・export・discard。commitや公開済みとしない |
| 停止・回収確認済み | 作業の不成立と資源回収の成立は別であること | 理由に応じて是正。自動再試行の許可へ読み替えない |
| 回収不明 | 残存を否定できず、通常実行を止める必要 | exact情報を保持し専用復旧へ。ID欠落を残存0としない |
| 再起動必要 | 同一Runtime Processを再利用できないこと | 再起動の後も残る回復義務は別途処置 |
| 期限切れ・境界変更 | 古い同意や候補を再利用できないこと | 現在の境界を再確認。不明なら操作しない |

通常結果、回収状態、Process再利用可否は直交する。正常・準正常・異常の全組合せを表示例の数だけで網羅したとは扱わず、実producerのvariantと公開投影を[検証設計](../07_Quality/03_Verification_Design.md#tool-user-experience-verification)で照合する。

## 4. 現行表示の参照と表現方針

次は`renderSafeHumanCommandReport`へ取消制御失敗、回収確認済み、再起動必要の公開値を与えた場合の出力例である。ファイル操作発行は未取得とする。表示試験の対象であり、実Provider・実端末の実測ではない。

```text
Coordinator：依頼の実行 — 停止
取消の制御に不整合がありました。資源回収とProcess再起動の情報を確認してください。
診断コード: coordinator_task_cancellation_protocol_failed_cleanup_confirmed
ファイル操作の発行: 未確認
資源回収: 確認済み
手動回復の必要性: なし
Process再起動の必要性: あり
次の操作: 現在のProcessを再利用せず、Coordinator Runtimeを再起動してください。回復義務は再起動だけでは解消しません。
```

未取得のbooleanは「なし」へ補正しない。結果の完了、回収、再起動、回復IDを別々に表示し、再起動・回復案内を候補操作より先に置く。停止・回収不明・再起動必要のTaskでは、候補IDを保持しても即時export／discardを案内しない。期限の不正値も表示例外にせず未確認とする。未登録の操作・状態・理由をそのまま端末へ出さず、固定した説明へ閉じる。機械向けJSONの意味や実行許可は変更しない。

現行CLIの文字サイズ、配色、折返し、ウィンドウ形状は端末が管理する。本書では製品固有のテーマ、装飾画像、モーションを新設しない。状態は色だけに依存させず、結果→理由→次行動→追跡情報の意味上の優先順位を維持する。秘密や生Provider出力を、分かりやすさのために表示へ戻してはならない。

行単位の対話CLIには、[デザインシステム参照実装](../25_UI.md#design-system-reference)の端末向け媒体を適用する。2026-08-31の人間判断により、HTMLを別に作るのでなく、現行writer／readerを使う再実行可能な端末表示・操作例で確認する。これは媒体選択であり、UI責務を`Not Applicable`にする判断ではない。ソース例や文字列試験を実端末の見た目・操作確認、支援技術確認の代替完了とは扱わない。

今回の確認対象は、Windows Terminal／PowerShellでの日本語表示、キーボード入力、一回のEnter、長いIDの折返し、文字拡大、拒否・時間切れ・取消・終了後表示とする。OS・端末・Shell・Nodeの実行版、実際に使用した起動経路、確認した項目と未確認項目を結果へ記録する。これは上記の人間判断に基づく限定的な利用品質確認であり、外部アクセシビリティ規格の適合表明ではない。読み上げは未評価として明示し、支援技術を利用できるとの主張は行わない。必要性や対象環境が変わった場合はQual-LabのRuntime保守が範囲を再評価する。

入力の参照は[端末確認プログラム](../40_Develop/coordinator/tests/fixtures/terminal-interaction-probe.ts)と[実行方法](../19_Workflows/01_Coordinator_Runtime.md#terminal-interaction-check)から再現する。[契約試験](../40_Develop/coordinator/tests/terminal-interaction-probe.contract.test.ts)は入力一致・不一致・時間切れ・取消・回収不明を区別する。参照が使うのは現行の端末writer／readerだけで、実行許可やProviderへの送信は行わない。この確認だけでは初期同意の全文表示、Task取消、回復操作、長い実結果の表示を確認したことにはならず、各公開入口の検証を別に保持する。

## 5. アクセシビリティ・利用品質の義務

- 対話開始を認識でき、キーボードで確認・拒否できる。正しい入力の確定に余分なEnterを要求しない。
- 文字化け、折返し、長いID、低コントラストで重要条件や次操作が読めなくならない。
- 入力待ちの端末が見えないまま時間切れにならないことを確認する。時間切れや読取り失敗では許可を発行しない。
- 秘密入力は秘匿し、非秘密入力と混ぜない。秘密を入力保持・ログによって復元可能にしない。
- 実行結果が読める前にウィンドウが閉じないことを公開起動経路ごとに確認する。ホスト端末の所有とRuntimeの所有を分ける。
- 対象とするアクセシビリティプロファイルに従い、読み上げ順序、拡大・折返し、色非依存、対話／非対話の環境差のうち適用する観点を確認する。今回承認された範囲と未評価環境は§4に示す。WCAG等の適合は本書で宣言せず、未評価の読み上げ対応を利用可能と扱わない。

<a id="ui-spec-mapping"></a>

## 6. UIと振る舞い仕様の対応

操作単位ごとに認識・入力・表示と実行契約を照合する。第三の仕様正本や新しい対応IDは作らない。以下の実装・試験参照は存在と接続の根拠であり、各義務が最新実測で合格したという宣言ではない。

| 操作単位 | UIが所有する確認 | SPECが所有する条件・結果 | 実装・試験の接続 |
|---|---|---|---|
| 診断・導入判断 | 通常利用可能と構文候補を識別 | [診断・有効化候補・回復](../05_SPEC/01_Behavior_Specification.md#診断有効化候補回復の公開境界) | [公開CLI](../40_Develop/coordinator/bin/coordinator.ts)、[診断試験](../40_Develop/coordinator/tests/doctor.contract.test.ts) |
| 初回同意・再利用・失効 | 対象、期限、変更点、入力要否が分かる | [公開Task](../05_SPEC/01_Behavior_Specification.md#公開taskの入力結果取消) | [同意Runtime](../40_Develop/coordinator/src/security/external-send-consent-runtime.ts)、[同意試験](../40_Develop/coordinator/tests/external-send-consent-runtime.contract.test.ts) |
| Task入力・選定・待機 | 不正入力と処理中を分離、担当と理由 | [公開Task](../05_SPEC/01_Behavior_Specification.md#公開taskの入力結果取消) | [公開CLI](../40_Develop/coordinator/bin/coordinator.ts)、[引数試験](../40_Develop/coordinator/tests/cli-options.contract.test.ts) |
| 候補の公開・export・discard | 候補ID、期限、未採用、次操作 | [利用者接点の境界](../05_SPEC/01_Behavior_Specification.md#user-interface-contract) | [候補Store試験](../40_Develop/coordinator/tests/candidate-bundle-store.contract.test.ts)、[表示試験](../40_Develop/coordinator/tests/command-report.contract.test.ts) |
| 取消・遅延終了 | 要求と完了を区別し最終結果まで待つ | [公開Task](../05_SPEC/01_Behavior_Specification.md#公開taskの入力結果取消) | [取消接続](../40_Develop/coordinator/src/core/task-cli-cancellation.ts)、[取消試験](../40_Develop/coordinator/tests/task-cli-cancellation.contract.test.ts) |
| 回復・Process再起動 | 複数ID、IDなし不明、再起動を欠落させない | [利用者接点の境界](../05_SPEC/01_Behavior_Specification.md#user-interface-contract) | [結果表示](../40_Develop/coordinator/src/core/command-report.ts)、[回復CLI結合試験](../40_Develop/coordinator/tests/coordinator-docker-recovery-cli.integration.test.ts) |
| Checker実行 | 指摘・範囲・未確認を読み分ける。引数エラーでは手順へ戻る | [Checker契約](../05_SPEC/01_Behavior_Specification.md#checker-contract) | [配布本体](../template/tools/crdd-check.ts)、[契約試験](../40_Develop/checker/crdd-check.contract.test.ts)、[操作手順](../19_Workflows/02_Checker.md) |
| Windows内部部品の結果 | binary応答ではなく、上位の診断・回収・再起動表示として影響を理解する | [内部部品契約](../05_SPEC/01_Behavior_Specification.md#platform-access-contract) | [nativeとAdapterの分担・試験](../06_Architecture/platform-access/01_Architecture.md#6-呼出し元との分担)。部品単体の成功を利用者のTask完了にしない |
| 開発検証・公式署名 | 入力する人・目的・失敗段階を識別 | [実行基盤](../05_SPEC/01_Behavior_Specification.md#runtime-10の実行基盤)と[発行手順](../19_Workflows/01_Coordinator_Runtime.md) | 開発検証結果と正式署名結果を[品質状態](../07_Quality/01_Quality_Center.md)で分離 |

<a id="open-issues"></a>

## 7. 既知差・未確認事項と完了判定

以下の呼び名は本節内の追跡用であり、新しいCRDD安定コンテキストIDではない。担当責任者はすべてQual-LabのRuntime保守。文書へ記録しただけでは解消としない。

| 事項 | 根拠と影響 | 次の処置・再確認契機 |
|---|---|---|
| 表示の意味説明 | 日本語説明、未知値の固定表示、成功した候補操作と停止の分離は実装・限定再確認済み | [限定確認の結果](../07_Quality/Verification_Results/2026-08-31_Tool_Layout_Verification.md#3部品の設計補完結果表示の追加確認)と下記のPowerShellでの表示例の実測を参照。説明未登録の理由は機械結果を担当者が確認し、全理由の翻訳完了とはしない |
| 未取得値と候補操作の表示 | 三値表示、回復・再起動優先、停止時の候補操作抑止、全回復ID保持は実装・関連試験・限定再確認済み | 表示・取消投影・実子Process接続の28試験と上記の限定確認を根拠とする。表示例の実端末確認は下記へ接続し、すべての状態・環境を実測済みとはしない |
| 入力・起動の実体験 | 時間切れ・入力待ち取消・空入力拒否、別runの123456読取り、654321不一致を観測。人間は表示例の折返し・拡大後も読めたと回答。案内は現在の操作だけに是正 | [実端末の初回結果](../07_Quality/Verification_Results/2026-08-31_Tool_Layout_Verification.md#実端末の初回結果)でrunごとの成否と限界を保持。今回のPowerShell環境の限定確認として完了。一括runの合格や通常Taskの取消へ読み替えない |
| 実Taskの取消と回復 | 署名版48515ebで実端末Ctrl+C入力1回から通常回収まで観測。独立確認済み | [実測の順序と限界](../07_Quality/Verification_Results/2026-09-01_Coordinator_Signed_E2E.md#signed-e2e-48515eb)へ接続。旧4f10201等の結果は各版の履歴として保持。全取消タイミングの成立へ一般化しない |
| CLI参照媒体の適用 | 人間が承認した端末参照で入力・表示の限定実測を取得し、UI／SPECの専門確認へ接続済み | [完成評価と追加確認](../07_Quality/Verification_Results/2026-09-01_Coordinator_Completion_Review.md#windows-terminal-verification)を参照。人間の内容採用・工程移行とは区別する |
| 支援技術・環境 | PowerShell 5.1に加えWindows Terminal 1.24.11911.0でも4入力シナリオ、日本語・長いIDの折返し・拡大表示を限定確認 | 上記追加確認で初期幅120列を観測。変更後の列数・拡大率は未取得。読み上げと全環境の対応は未評価であり、対象変更時にQual-LabのRuntime保守が再評価 |
| 詳細設計の読み解き | SPEC・実行設計・脅威モデルの責務分離と再構成、設計文書の改名、設計・実装・試験の横断整合を完成評価で確認 | [完成評価](../07_Quality/Verification_Results/2026-09-01_Coordinator_Completion_Review.md#completion-assessment-147fb29)と[CHGの処置](../90_Release/Changes/CHG-000017_Tools_Coding_Standards.md#tool-experience-design)で追跡。全読者の理解度を実測したとはしない |

UIとSPECの共同レビュー、UI専門品質、対象端末の限定確認は完了し、WT-SCOPE-01は追加実測・独立確認で解消した。その後、Qual-Labが[候補内容・移行方針を採用](../90_Release/Changes/CHG-000014_V018_Architecture_Candidate_Integration.md#candidate-adoption-20260901)し、PRへの引渡しを承認した。表示の「読めた」という観測と、その後の採用判断を区別する。全アクセシビリティ対応、Stable化、main統合またはリリースは承認・実証済みとしない。
