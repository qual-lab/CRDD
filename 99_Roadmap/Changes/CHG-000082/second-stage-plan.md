# 第二段階：責務・状態所有・実行境界の再編計画

成果物種別: 変更計画
状態: In Progress（1〜8を継続。未決Architecture候補は未採用）
対象変更: [CHG-000082](change.md)
基準改訂版: `98cab6e3278a61684c557a6499cfb602e2d19111`
維持責任者・採用決定権限: Qual-Lab
最終更新日: 2026-10-09

## 1. 結論と実行境界

### AM保存保証の採用 — 2026-10-12

基準Commitは`7ef32ef8`。Qual-Labは通常保存・読戻し確認までを採用し、電源断直前の更新喪失により失効済み鍵・交換前の鍵・縮小前のRole／Exposure／Repository範囲が再受理され得るリスクを受容した。気付かれなければ明示処置まで続き得る。未実測の可能性であり、物理電源断以外の突然停止は未評価。保証の正本は[REQ-000041](../../../01_Discovery/Definitions/REQ-000041/requirement.md#保存保証の範囲--2026-10-12)とする。

変更分類は人間が採用した保証範囲・リスク受容の直接伝播。REQ、AM詳細01・02、QA-000007、本計画、PROJECT_CONTEXTの6文書に限定する。着手前の読取り専用契約確認は着手可。通常失効・認可・破損拒否・Process喪失・改訂競合を弱めず、新回復機構・耐久性の追加基盤・電源断試験は作らない。Source、実Store、秘密値、旧Evidenceは不変更。Schema・保護・容量・初回Root・鍵段階・本番接続の実装Gateは維持する。

固定6文書に契約・品質の独立レビュー、参照・直接影響・差分・既存190項目とNot Runの確認を行った。初回の要求内保証範囲と旧判断記録の時点表示の2指摘を統合是正し、限定再レビューは両方Pass・全重大度の残指摘0。ローカル参照先欠落0、差分確認成功、190項目・Not Run不変。標準規則・Sourceを変更しないため準拠監査・Package回帰・署名Provider E2Eは対象外。保証範囲の採用を保存実装成立へ読み替えない。現在、追加の人間判断は不要。

### 保存途中の再入場候補 — 2026-10-11

以下は2026-10-11固定時点の履歴である。保証範囲の人間判断待ちは上段2026-10-12の判断により解消済みで、現在の判断待ちを表さない。

基準Commitは`8847169a`。変更分類はAM保存設計の具体化。固定範囲はAM詳細02、QA-000007、本計画、PROJECT_CONTEXTの4文書で、編集一次キーは保存物・出版順序・base／next／unknown判定・初回非適用・既存品質項目への接続・現在の判断である。親照合と読取り専用契約確認で着手可。再入場は既存の完全currentがある通常保存に限定し、初回相関・鍵Effect・current不在を自動処置へ一般化しない。既存Root・Kernel Lockとexact回収を利用し、新Store・Lock・Receipt台帳・履歴Directoryを作らない。Source・実Host管理Root・秘密・Docker・過去Evidenceは不変更。

単一現在Fileと短命pending、同じ同期排他区間の現在認可・競合・出版・読戻し、既知出版とcleanup不明の別観測を具体化する。契約・品質独立レビュー、文書参照・直接影響・既存IDとNot Run・差分を確認する。実装や標準規則を変えないためPackage回帰・準拠監査・署名Provider E2Eは今回対象外。固定4文書の契約・品質限定再レビューは両方Pass、全重大度の残指摘0。190項目・Not Run不変、差分確認成功。これは候補記録の整合結果で、保存保証の採用や実装Readyではない。初回レビューで電源断直前更新の喪失による旧鍵／旧権限再受理の未確認リスクを検出し、弱い保証での採用推奨を撤回した。通常管理のReceipt非目標を維持し、pending削除後の応答喪失は元要求不明と現在状態を分離する。既知出版を不明に戻さず、旧Owner終了・排他終了から遅延Effectなしを評価する。鍵／認可の電源断後の安全再開・保証範囲・残存リスクは人間判断待ちで、通常6操作の候補をその承認へ読み替えない。Schema、容量、Verifier保護、初回Root準備・最初の出版・鍵段階のpending処置、本番Consumerは未完了で実装Gateを維持する。

### 鍵の期限なしの設計・品質伝播 — 2026-10-11

基準Commitは`b259e51b`。変更分類は採用済み要求の直接伝播。UX-000035／IA-000009／UI-000008／SPEC-000012／ARCH-000013の分析・定義と関連状態投影、SCR-000008／BHV-000012、Access Management詳細01／02、7工程品質分析・QA-000007・Quality Center／Integration、本計画・PROJECT_CONTEXTを対象とする。着手前の親照合と読取り専用品質確認で着手可・追加人間判断なし。編集一次キーは接続鍵の期限なし、資格状態、時間経過と明示失効・現在認可の別、表示・刺激・観測・Oracle・現在OPENである。

現在有効な既存／新規鍵は時間だけで失効・交換せず、明示失効・交換後の旧鍵は拒否し、Role／詳細権限／Exposure変更は次要求へ反映する。形式不正・無効・観測不能の拒否も保持する。失効済みの再有効化と、旧CROS保存形式の移行完了は推定しない。同意、Lease、判断用Capability、Candidate・履歴保持の期限、旧Evidence・旧Source／Schema／Hashは不変更。対応表の旧引用2行は採用前履歴と明示して保持する。新Local Item・UT・Timer・更新Workerを作らず、既存RFD-ST-003／RFD-IT-013／RFD-UAT-007へ観測を統合する。

必須確認は契約・品質独立レビュー、文書・直接影響・期限対象分類・既存ID／段階／件数・参照・差分確認。標準規則・Source・Store・実行境界は不変更なので、準拠監査・Package回帰・署名／Docker／Provider E2Eは対象外。固定32文書の契約・品質限定独立再レビューは両方Pass、全重大度の残指摘0。初回レビューの対照条件・現在表示・空白と、再レビューで判明した履歴状態上書きを統合是正し、旧基準Commit・正式入力・限定結果を保持した。190項目ID・Not Run不変、差分確認成功。設計・品質の伝播から保存Gate、鍵発行・配送・公開入口・実E2E・全体Readyの成立を推定しない。

### 鍵の有効期限の採用記録 — 2026-10-11

基準Commitは`d9e0b3d9`。人間は鍵の期限なしを採用した。要求正本REQ-000041と探索履歴EXP-000036、本計画・PROJECT_CONTEXTの4文書へ判断を記録する。変更分類は未決運用方針の確定。親の着手前照合では、期限による自動失効なし、明示失効・交換後の旧鍵拒否、現在Role・公開範囲の要求毎確認、資格や状態が不明な場合の拒否を保持することを確認した。期限なしを無条件のアクセス許可にしない。

独立契約レビュー、文書・参照・直接影響・差分確認を行う。標準規則・Source・Store・実行境界を変更しないため、準拠監査・Package回帰・Docker／Provider E2Eは今回は対象外。既存の過去判断とEvidenceは当時の記録として保持する。UX／IA／UI／SPEC／Architecture／Qualityの期限切れ状態・未決表示への伝播は後続とし、全伝播済みや鍵発行実装Readyを主張しない。保存Gate・実保存・Host入口・発行と配送の未成立は維持する。固定4文書の限定独立再レビューはPass、全重大度の残指摘0。要求内の対象母集団・検証意図・UX引き渡しを同期し、差分確認成功。判断記録の完了としてコミットし、下流伝播と実装の未完了は維持する。

### 初回Host設定の横断モデル・Surface詳細伝播 — 2026-10-11

基準Commitは`fe648037`。正式入力はARCH-000013・Access Management詳細01／02。固定範囲はArchitecture横断01〜08、Workbench／MCP詳細、本計画・PROJECT_CONTEXTの12文書。変更分類は承認済み設計候補の直接伝播。編集一次キーは所有者、初回と通常Host回復の分離、4状態・処理順、非秘密元試行相関、個別事実、失敗分岐、案内／非公開境界、Quality引渡し・現在状態。

着手前の読取り専用契約確認は着手可。発火は既存Root検証・双方未初期化確認・Host明示開始、非発火は既存管理状態・通常鍵喪失、境界は確認済み途中、情報不足は新作成停止と元試行が確認できる場合だけ再観測。Workbenchは初回案内だけ、MCPは初期化一覧・Schema・登録・dispatch・状態照会非公開。元試行の発行／記録不明と確定後の配送／受領だけ不明を分離する。

固定12文書へ契約・品質独立レビューと文書・参照・直接影響・差分確認を実施し、両結果完了後に統合是正する。初回レビューの統合4原因（実行単位表の欠落、Workbench既存担当の狭義化、旧レビュー時点の競合、句点後空白）を両確認者へ再提示・方針整合後に是正した。限定再レビューは両方Pass・全重大度の残指摘0。参照254件欠落0、非対象79行一致、差分確認成功。レビュー後は結果・状態だけ同期した。既存3行だけPartialを維持し、他19 UI・29 BHV・31 Relation、固定8分担、通常Host回復2操作、過去Evidenceを変更しない。新ID・公開API・CLI引数・Store・Framework・Sourceは追加しない。標準規則・Source非変更のため準拠監査・Package回帰・Docker／Provider E2Eは対象外。Quality・物理保存・本番公開入口・実E2E・全体Readyは未完了。追加の人間判断は不要、資格期限は回答待ちを維持する。

### 初回Host設定の基本設計・AM詳細伝播 — 2026-10-11

基準Commitは`ad15d5cf`。正式入力はUI／SPEC独立Architecture分析、配置制約はSCR-000008／BHV-000012。固定範囲はARCH-000013、AM詳細01・02、本計画・PROJECT_CONTEXTの5文書。変更分類は採用済み意味の設計具体化・直接伝播。編集一次キーはOwner、入口、4状態・Sequence、非秘密元試行相関、個別事実、失敗分岐、内部操作候補、検証引渡しと完了境界。

着手前契約確認は着手可。相関確定前UUID／鍵Effect0、短命pendingと耐久進行記録の分離、Root準備の既知Effect保持を計画へ統合した。発火は双方未初期化確認＋Host明示開始、非発火は既存・通常鍵喪失、境界は確認済み途中、情報不足はRoot／観測／排他等不明の新作成停止。初期化・交換・Lock回復を混同しない。単一current／pending／lockは物理候補のまま、別Store・Framework・新安定ID・Source・旧Evidenceを変更しない。

固定5文書に契約・品質独立レビュー、参照・文書・直接影響・差分確認を実施し、両結果完了後に統合是正する。固定候補の契約・品質レビューは同一Minor1原因（Checklist2箇所のOPEN表記）を統合・方針整合後に是正し、両限定再確認はPass・全重大度の残指摘0。参照78件欠落0、差分確認成功。レビュー後は結果・状態のみ同期した。横断モデル・Workbench／MCP詳細・Quality・Source・保存方式採用・本番接続・実E2Eは未完了。標準規則・Source非変更のため準拠監査・Package回帰・Docker／Provider E2Eは今回対象外。追加の人間判断は不要、資格期限は回答待ちを維持する。

### 初回Host設定のArchitecture入力分析 — 2026-10-11

基準Commitは`a2f4fe01`。UI-000008とSPEC-000012それぞれ自身のDefinitionだけから独立分析する。固定範囲は両Architecture分析・本計画・PROJECT_CONTEXTの4文書。変更分類は採用判断の下流直接伝播。編集一次キーは初回開始、4状態、ユーザー成立前のOwner、個別事実、元試行と別交換の分離、負契約と検証意図。新ID・API・保存Schema・File・Lock・Source・一般Recovery・過去Evidenceは変更しない。

着手前の読取り専用契約確認は着手可。通常Host回復2操作への限定、初回の所有状態、3つの失敗経路、負契約、現在の未追従範囲を計画へ統合した。発火は双方未初期化確定とHost明示開始、非発火は既存状態／通常鍵喪失、境界は確認済み途中試行、情報不足は別Root・破損・読取不能等の新Effect前停止。元試行の発行／記録不明では再観測だけ、発行・記録確定後の配送／受領だけ不明では作成済みadministratorへの既存Host指定交換を別明示操作とする。

固定4文書に契約・品質の独立レビューと参照・文書・直接影響・差分確認を行い、両結果完了後に統合是正する。標準規則・Source・実行境界を変更しないため準拠監査・Package回帰・Docker／Provider E2Eは今回対象外。固定候補の契約・品質限定独立レビューは両方Pass・全重大度の残指摘0。参照61件欠落0、差分確認成功。レビュー後は結果と状態だけ同期した。ARCH-000013の基本設計・横断投影・Details・Quality・Source・具体保存・本番接続は初回設定に未追従で、前段Passを工程Readyへ流用しない。現在、追加の人間判断は不要。資格期限の回答待ちを維持する。

### 初回Host設定のUI／SPEC Detail伝播 — 2026-10-11

基準Commitは`6a458972`。正式入力はUI-000008／SPEC-000012の初回設定。SCR-000008、BHV-000012、configuration-trust Area、UI Detail01、Workbench画面構成の追補13、SPEC Detail01、Detail対応02、本計画・PROJECT_CONTEXTの9文書に限定する。変更分類は採用済み判断の下流詳細化・直接伝播。編集一次キーは入口・入力、4状態、個別結果、元試行相関、通常回復との分離、検証意図と引渡し。同じSCR／PRT／Interaction／BHVの操作種別とし、新ID・API・Store・Source・旧Evidenceを追加・変更しない。

着手前の契約確認は着手可。配送と受領、初期化試行と交換Recovery、Detailed Behavior表の各観点の初回負契約を分離する指摘を計画へ統合した。発火は双方未初期化確定とHost明示開始、非発火は既存管理状態・通常鍵喪失、境界は確認済み途中、情報不足は読取り不能等の新Effect前停止。未試行から試行／UUIDを推定せず、双方確認後の新作成を拒否しない。作成済み・発行済みを未初期化へ戻さず、発行／記録不明は元試行再観測だけ、発行・記録確定で配送または受領だけ不明なら作成済みadministratorへの既存Host指定交換を別明示操作とする。

固定9文書に契約・品質の独立レビュー、リンク・文書・直接伝播・ID・差分確認を行い、両結果完了後に統合是正する。標準規則・実行境界を変更しないため準拠監査・Package回帰・Docker／Provider E2Eは今回対象外。旧31 Relation・旧Gate・通常管理8分担・通常Host回復2操作は維持する。具体表示・Visual・Architecture／Quality／Source・正式QA・実E2E・全体Readyは未完了。現在、追加の人間判断は不要。資格期限は回答待ちを維持する。

現在結果：初回の契約・品質レビューを完了し、現在投影の旧Pass競合、Architecture／Quality引渡し不足、BHV表の文境界、観点数表記の4原因を統合した。両確認者へ是正方針を再提示して整合確認後に是正し、再レビューの書式1原因6箇所も解消した。最終限定再レビューは両観点ともPass・全重大度の残指摘0。参照391件欠落0、未変更31 Relation・旧Hash・Workbench旧Gate本文不変、差分確認成功。レビュー後は結果と状態だけ同期した。Architecture／Quality／Source・実画面・正式QA・実E2E・全体Readyは未成立で、次はArchitectureへ伝播する。

### 初回Host設定のUI／SPEC伝播 — 2026-10-11

基準Commitは`a0766d28`。固定範囲はUX-000035／IA-000009のUI・SPEC分析4文書、UI-000008／SPEC-000012、UI横断01・02・03・05、SPEC横断01・06、本計画・PROJECT_CONTEXTの14文書。各分析は自身の正式入力だけを利用し、Definitionで統合する。編集一次キーは初回開始・4状態・部分結果・権限・負例・後続引渡し。通常Host回復2操作、MCP鍵操作非公開、内容自動付与なしを維持する。新ID・Object・Schema・Source・保存先・期限・旧Evidenceは不変更。

着手前契約確認は着手可。候補の契約・品質独立レビューを両方完了してから結果を統合・是正する。参照・直接影響・差分確認を行う。標準規則・実行境界を変更しないため準拠監査・Package回帰・Docker／Provider E2Eは今回対象外。Detail以降・全体Ready・実装完成は未主張。

現在結果：初回の契約・品質レビューを完了し、正規の未試行と観測不能の混同、一次変換表の同期不足、途中再入場の二重作成防止義務、レビュー入力Hashの4原因を統合・方針整合後に是正した。中断した再レビューを再開し、書式1原因（6箇所）も是正した。最終限定再レビューは両観点とも全重大度の残指摘0。契約側の直接読取りが環境側で失敗したため、親が現物から取得した該当本文・差分範囲・Hashの固定読取り投影を用いて独立判定し、品質側の現物確認と区別した。参照761件欠落0、過去対応区画不変、差分確認成功。レビュー後は結果・状態のみ同期し、Detail・Architecture／Quality／Source・正式QA・実E2E・全体Readyは未完了。次はDetail・Architectureへの伝播である。

### 初回Host設定のIA伝播 — 2026-10-11

基準Commitは`50f93594`。正式入力はUX-000035だけとし、そのIA分析・IA-000009定義・横断01〜04・本計画・PROJECT_CONTEXTの8文書に限定する。新IA ID・情報Objectを作らず、既存管理能力の開始条件・初期化状態・確認済み初回試行の非秘密相関から、成立したadministratorユーザー・初資格・Secret表示境界へ結ぶ。未作成段階の情報を資格属性だけに閉じず、初回試行を交換Recoveryへ統合しない。

編集一次キーは初回の情報関係、導線、状態・可視性・時間関係、責任、検証意図、後続引渡しとその投影である。未初期化確定時の一度作成・一度受領、既存状態の初期化拒否、未試行／観測不能の試行推定0・新作成0、確認済み途中の同試行再観測、発行記録不明と確定発行配送不明の分離を代表照合する。内容自動付与0・MCP／自動起動0・通常Host回復2操作は保持する。具体Path・Schema・API・Source・期限・旧Evidence・UX13分析は不変更。

着手前の契約確認は着手可・追加の人間判断なし。固定8文書の契約・品質独立レビューを統合し、正式表・関係図・引渡しへの同期不足、既存交換の停止／Recovery条件の初回への混入、表見出し・書式を是正した。最終限定再レビューは両観点とも全重大度の残指摘0。ローカル参照168件欠落0、差分確認成功。標準規則・Source・実行境界を変更しないため準拠監査・Package回帰・Provider／Docker E2Eは今回非該当。UI／SPEC以降・Source・正式QA実行・本番接続・全体Readyは未完了で、次はUI／SPECへの伝播である。

### 初回Host設定のUX伝播 — 2026-10-11

基準Commitは`4cf405d8`。正式入力はREQ-000041の採用済み初回設定。REQ分析・UX-000035・UX横断5文書・本計画・PROJECT_CONTEXTの9文書に限定する。既存の利用範囲を用意・維持・回復する成果の開始条件としてSame統合し、新IDは追加しない。Host明示開始、未初期化確定、表示名、最初のadministrator UUID、鍵一度受領と通常管理への移行を、重要場面・失敗・必要情報・責任・検証意図・IA引渡しへ接続する。

初回設定と通常Host回復の交換2操作を分離する。既存・途中・破損・観測不能を未初期化にせず、作成済みユーザー／発行／記録／受け渡しを別事実として保持する。発行・記録不明は元試行再観測、確定発行後の受け渡し不明だけ既存Host指定交換へ進む。Repository登録・公開・内容アクセスを自動付与しない。資格期限は未決を維持する。

着手前の読取り専用契約確認は着手可、追加の人間判断なし。固定9文書に契約・品質の独立レビューと文書・参照・直接伝播・差分確認を実施し、全結果統合後に是正する。候補は独立レビュー待ち。Source／実行境界／準拠規則を変更しないためPackage回帰、Provider／Docker E2E、準拠監査は今回非該当。IA以降、具体保存・入口・本番接続・正式QA実行・全体Readyは未完了である。

限定結果：固定9文書の契約・品質レビューを4原因へ統合し、観測不能と確認済み途中試行の分離、主要成果への初回利用開始の同期、体験マップの列責務、現在表示・書式を是正した。最終再確認は両観点とも全重大度の残指摘0。対象分析・定義の連続空行0件、参照先360件欠落0、差分確認成功。後続は結果と状態だけ同期した。IA以降・Source・正式QA・実E2E・全体Readyは未完了で、次はIAへの伝播である。

### 初回Host設定の要求反映 — 2026-10-11

基準Commitは`cddd333c`。人間が承認した最小初回設定をREQ-000041の正本とEXP-000036の判断履歴へ反映する。変更分類は採用判断の要求具体化で、固定範囲はこの2文書・本計画・PROJECT_CONTEXTの4文書。親の正本照合と読取り専用契約確認で、通常管理・Host回復との分離、既存Root、秘密非保存、表示名の非Authority、未初期化／途中／既存／不明の境界を照合した。編集一次キーは初回設定の要求・成立条件・失敗・検証意図・UX引渡しとその履歴・現在投影である。

| 代表例 | 期待する処置 |
|---|---|
| 正しいHost Rootで管理状態と途中記録の双方が未初期化と確定 | 明示設定で表示名入力→最初のadministrator UUID作成→同ユーザーの鍵一度表示 |
| 既存管理状態があり、管理鍵だけを失った | 初期化せず既存Host交換2操作を使う |
| ユーザー作成後や資格発行後に中断 | 既知事実と元試行の非秘密相関を保持。確定発行・受け渡し不明なら既存Host指定交換、発行・記録不明なら元試行の再観測 |
| Root不明、破損、読取不能、排他・回収確認待ち | 未初期化と判断せず、新しいEffectを発行しない |

固定4文書へ契約・品質の独立レビュー、文書参照・直接影響確認を行う。標準規則・Source・実環境を変更しないため準拠監査・全回帰・署名E2Eは対象外。UX→IA→UI／SPEC→Architecture／Details→Quality→Sourceへの伝播と具体保存・相関・入口は未完了。新Schema・秘密操作・初期化Source・既存データ移行・過去Evidenceは変更しない。資格期限の回答待ちも維持し、要求の採用を実装Gate成立へ読み替えない。

限定結果：固定4文書の契約・品質独立レビューを統合し、記録日付と現在投影の2箇所を是正した。最終再確認は両観点とも全重大度の残指摘0。相対参照70件は欠落0、差分空白検査は成功。要求反映の限定結果であり、下流伝播・実装・実境界・全体完成の根拠ではない。

### AM固定管理判定の局所実装 — 2026-10-11

基準Commitは`cafdad6c`。変更分類は確定済み固定管理分担のSource具体化。親・契約・品質の読取り専用着手前確認で、保存Gateに依存しない純粋部分だけを先行することを照合した。編集一次キーは新Packageの固定判定、Root公開、対応UT・Symbol・Catalog・この設計接続である。8分担を10具体操作へ分け、三Role×全操作と対象Roleの全組合せを検査する。新ACL、Host操作、認証、保存、鍵発行、内容権限初期値、公開read、旧Consumerは変更しない。既存CROSの代替本番接続は未成立のまま維持する。

新Packageの固定依存は現行CROSと同じ版・Integrityを保持し、外部取得なしでpackage-lockを作成した。既存CROSに導入済みのBiome／TypeScriptを検証用だけに使用し、型検査は既存CROS導入済みの同版tscを使用し、検証コマンドで同版Node型Rootを指定した。新Packageのtsconfig／package／SourceにCROS Path依存は追加していない。新Packageの実行コードにCROS依存はない。format・type・lintは成功、公開Root経由の4 UT Caseは成功（基本分担30判定、Role対象54判定、未知・欠落・余分field、accessor／Proxy非実行・入力不変）。RFD-UT-020に対応する候補試験の局所成功であり、正式Local Item結果／Evidence評価はNot Run。この局所結果は純粋判定の対象範囲だけで、IT／ST・保存・資格・本番接続の根拠ではない。固定20ファイルの契約／品質限定独立レビューを5原因へ統合是正し、最終再レビューは両観点とも全重大度の残指摘0。Source公開集合、検証環境の記録、Header観測範囲、局所実行と正式Not Run、現在投影の限定を揃えた。余計なRuntime exportの一時注入では対応Caseの失敗を観測し、除去後4 Case成功を確認した。V8 Coverageは対象Source2ファイルのline／branch／function各100%。相対リンク913件は欠落0、差分空白検査は成功した。これらは今回の純粋判定候補の限定結果である。標準規則・外部Runtimeを変えないため全回帰・署名E2E・準拠監査は今回対象外。文書・関係・実装影響と独立レビューで固定候補を確認する。

人間はこの作業中、初回Host明示初期化で表示名を受け、最初のadministratorをUUIDで作成し、そのユーザーの鍵を一度表示する最小構成を承認した。通常Host回復は既存ユーザー交換2操作だけで、初期化を回復の抜け道へ転用しない。これは後続のREQ／UX以降へ伝播する判断で、今回の純粋関数へ初期化・Host主体を追加していない。初回設定Source・実データ操作は未着手、資格期限の回答待ちも維持する。

### AM公開読取りの具体化 — 2026-10-11

基準Commitは`190f12c3`。AM詳細02§3.1、本計画、PROJECT_CONTEXTを固定範囲とする。変更分類は採用済み情報境界の詳細設計候補。編集一次キーは公開read結果と操作別投影で、親・契約・品質の読取り専用着手前確認を行った。自己Identity、固定管理能力、内容権限、Exposureによる許可集合を分け、実アクセスを現在管理改訂の保証へ混ぜない。解放不明ではSnapshotを公開せず、既知読取事実を内部保持する候補を選ぶ。新Receipt、Lock、共有State、秘密Store操作、Source、過去Evidenceは変更しない。

文書・直接影響確認と契約／品質の限定独立レビューを実施した。操作候補が対象非依存のAuthorityに見える1原因を統合是正し、対象制約・現在再認可・MCP非投影を明示した。両限定再レビューは全重大度の残指摘0、ローカル参照58件の欠落0、差分空白検査成功。標準規則・実行系を変更しないため、準拠監査・全回帰・署名実E2Eは今回対象外。既存QAの反証面へ接続し、Not Runを維持する。詳細権限語彙、接続表示、鍵相関・保持、初回設定・移行、資格期限と本番接続は未完了。この限定結果はAPI・保存全体の完成ではない。

### AM保存境界の反証と読取り排他候補 — 2026-10-11

基準Commitは`719a835f`。AM02§4.2、本計画、PROJECT_CONTEXTの3文書を固定範囲とする。変更分類は保存詳細の候補選定用局所確認。親と契約・品質の読取り専用着手前確認を行い、Lock競合と改訂競合の分離、再取得結果からのexact回復ID、Reader例外の分類を確認手順へ反映した。Source本番・秘密Store・Docker・過去Evidenceを変更しない。文書・直接影響確認と契約／品質の限定独立レビューを行う。標準の準拠基準や外部Provider境界を変えないため、準拠監査・実Provider E2Eは今回対象外。

同じPCのWindows 10.0.26200.0／C: NTFS／Node v24.19.0で、A保持中のB callback 0拒否、A後の古改訂要求write 0、pending fsync後／rename後のexit(23)と既存exact Lock回収・次更新を確認した。一方、非排他Readerとの並行置換はEPERMを2回観測し、分類実行は41回出版後の次の置換が不成立となりpendingが残存した。Readerも同じ既存Lockへ閉じた対照は100出版成功だが、旧／新各2回の読取りとbusy61・recovery_required1を別に保持する。全子join・自己生成work回収済み。実測は本番AM保存・公開read・状態回復・他環境の証明ではない。

編集一次キーはAM02§4.2と今回の計画・現在投影。同じLockを使うreadは短命Filesystem Effectを持つことを明示し、結果型・認可・解放不明・再取得の本番接続は未完了とする。契約・品質の限定独立レビューで、共通の前段確認時点と観測の狭義化の2原因を統合是正し、両再レビューは全重大度の残指摘0。ローカル参照57件は欠落0、差分空白検査成功。probe script・空子Directoryも回収済み。鍵期限の判断待ちを迂回せず、公開Schema・元発行相関・保持清掃・初回設定の残件は維持する。

### AM保存部品の適合確認 — 2026-10-11

基準Commitは`2b4f56b2`。変更分類は保存詳細の具体化前の技術調査。固定範囲はAM詳細02の§4.1、本計画、PROJECT_CONTEXTの3文書。親と契約・品質の読取り専用確認で既存Root／Lock／読取り部品を照合した。新しいFramework、権限、秘密保存先、Source本番接続、過去Evidenceは変更しない。文書・参照・直接影響確認と契約／品質の限定独立レビューを行い、標準準拠基準を変えないため準拠監査、Docker／Provider境界を触らないため実E2Eは今回対象外とする。

既存Lockは同じRoot／Lockを使う同期協調Writerの候補として適合するが、CROS Root解決は文字列のみで、安全な初回準備を別に接続する必要がある。現在状態・pending・Lockをstate Root直下へ置く候補とし、保存専用の子Directoryを追加しない。Lock回収と鍵交換Recoveryを区別し、既知出版がclose／解放故障で失われない搬送を残件とする。

Windows 10.0.26200.0・C: NTFS・Node v24.19.0で同Directoryの通常置換・byte読戻し100回は一致し、自己生成作業領域を回収した。前段§4.1の確認時点では、並行読取り、Process喪失、他Windows版／Filesystem、Linux、電源断耐久は未確認だった。追加局所結果は§4.2に記録し、本番接続・他環境の未確認は維持する。単一File採用・実装Gate成立・Quality Passへ広げない。鍵期限の運用判断は人間へ確認中であり、未回答を既定値の採用と扱わない。

編集の一次キーはAM02の§4.1と本計画・現在投影の今回節。契約・品質の限定独立レビューで、重複する環境限定とLinux Root説明の計2件を統合是正し、両再レビューは全重大度の残指摘0。3文書のローカル参照56件は欠落0、差分空白検査は成功。Source移管前に公開Schema、元発行相関、配送観測、保持清掃、初回設定の残件を閉じる。限定レビュー完了を物理保存の実装Gate成立へ拡張しない。

### 登録解除・鍵受け渡し判断のQuality全伝播 — 2026-10-11

基準Commitは`c4cd0fd3`。固定範囲はQualityの7工程分析、QA-000007／QA-000009、Quality Center、本計画、PROJECT_CONTEXTの12文書。変更分類は採用済み判断の検証義務への伝播。親による正本照合と契約・品質の読取り専用着手前確認は着手可で、追加の人間判断は不要。Source・Test・過去Evidenceは変更しない。

既存RFD-IT-021／ST-022に同一受付操作・採用改訂の登録／Exposure両除去読戻し、片側／不明拒否、他設定・本体保持、旧実行取消非証明を接続する。RFD-IT-017は元発行Identity再観測と通常発行Recovery新設0、RFD-ST-016は各交換内exactと確定後の別明示交換、RFD-UAT-007は3分岐の理解を確認する。EST-IT-010は非鍵搬送同値、EST-ST-015は鍵Recovery参照も含むMCP4面非公開に限定する。新しいLocal IDを作らず185項目・Not Runを維持する。

編集の一次キーはSource ID／既存Local ID／現在状態節とし、観測・Oracle・終了後条件まで対応させる。片側除去、両除去済みでも旧処理終了未観測、通常発行不明、確定発行後配送不明、別交換と元操作の混同、遅延失効鍵応答を反証する。正当な別操作の新発行を元操作の重複発行0と混同しない。

固定12文書の契約・品質独立レビュー、文書参照・直接伝播・差分確認を実施する。標準規則・Source・実環境・準拠表明を変更しないため、準拠監査・全回帰・Docker／Provider E2Eは今回対象外。固定12文書は契約・品質限定独立レビュー済み、是正後は全重大度の残指摘0。通常WorkbenchとHostのOracle区別、入力文の区切り、現在投影の時点競合を統合是正した。ローカル参照945件の欠落0、Local Item一意185件、差分空白検査成功。結果・状態の同期だけを行い、更新項目Not Runを維持する。物理保存・公開read・元発行Identity／配送観測の具体保存・保持清掃・Source移管・本番接続は未完了で、この更新を実装Gate成立としない。

### 登録解除・鍵受け渡し判断のArchitecture全伝播 — 2026-10-11

基準Commitは`9b278dad`。固定範囲は入力分析2件、ARCH-000013、横断01〜08、Access Management／Workbench／MCP詳細01の3件、本計画とPROJECT_CONTEXTの計16文書。確定UI-000008／SPEC-000012を独立入力として、登録解除の両除去読戻し・対象外保持・取消非証明と、元発行再観測／確定後の別明示交換／現在administrator非接続時の既存Hostを、各Ownerの責務断面へ伝播する。AM詳細02は前段確定入力として変更しない。

変更分類は採用済み判断の設計伝播。契約・品質の読取り専用着手前確認は双方着手可で、現在追加の人間判断は不要。片側除去、両除去済み・旧処理終了未観測、通常発行不明、発行・記録確定後の受け渡し不明、遅延した失効鍵応答を反証対象とする。通常発行のIdentityとCredential IDを区別し、各交換内部のexact相関と別明示交換の別Operationを混同しない。

固定16文書の契約・品質独立レビュー、文書参照・直接影響・差分確認を行う。新ID・API・Schema・Store・Lock・Source・秘密操作を追加せず、他ARCH・31 Relation・旧Ready・過去Evidenceを維持する。標準規則・Source・実環境を変更しないため、準拠監査・全回帰・Docker／Provider E2Eは今回対象外。現在は伝播候補・契約・品質の限定独立レビュー済み・残指摘0であり、Quality・Source・物理保存・公開read・配送観測・保持清掃・本番接続は未完了である。

限定確認結果：契約レビューは残指摘0、品質レビューの現在投影同期漏れ1件を統合是正し、両限定再レビューはPass・全重大度の残指摘0。16文書のローカル参照259件は欠落0、差分空白検査成功。非対象の対応行、旧Ready、過去Evidence、AM詳細02、Sourceは未変更。レビュー後は今回の状態・結果記録だけを同期した。

### 管理API・保存設計の旧OPEN更新 — 2026-10-11

基準Commitは`b7f86571`。確定REQ-000041／BHV-000012に合わせ、AM詳細02の登録解除・鍵受け渡し未確認の処置判断を更新する。本計画とPROJECT_CONTEXTを含む3文書が今回の固定範囲。変更分類は採用済み判断の詳細設計への伝播で、契約・品質の読取り専用着手前確認は双方着手可。新しい人間判断は不要。登録／Exposure片側残存、両除去済みでも旧処理終了未観測、通常発行不明、確定発行で受け渡しだけ未確認、管理認証喪失を照合し、元Identity・各交換exact Recovery・別明示交換の分離を保持する。

契約・品質の限定独立レビューと文書参照・差分確認を行った。新Schema・保存方式・Lock・Source・秘密操作・過去Evidenceは変更しないため、全回帰・準拠監査・Docker／Provider E2Eは対象外。ARCH-000013・入力分析・横断モデル・AM詳細01・Surface詳細・QAへの全伝播は後続であり、この3文書の更新をArchitecture全体完了にしない。物理保存・公開read・配送観測・保持清掃・本番接続のOPENは維持する。固定3文書の限定独立レビューは契約・品質ともPass、全重大度の残指摘0。文書参照54件の欠落0、差分空白検査成功。レビュー後は結果・現在状態だけを同期した。

### 登録解除と鍵の受け渡し未確認のDetail伝播 — 2026-10-11

基準Commitは`14546497`。確定UI-000008／SPEC-000012からSCR-000008／BHV-000012へ詳細化し、Area・Workbench候補§13・Detail入口／対応・Definition対応の下流状態・本計画・PROJECT_CONTEXTの10文書へ伝播する。独立レビューで検出した現在投影の状態漏れに対し、UI概要4文書・SPEC概要1文書の状態だけを追加同期し、15文書へ固定範囲を拡張する。編集は、対象2 Detailの操作・状態・Flow・検証義務の置換、5詳細投影の追従、上位対応と現在状態の同期に分ける。発行／記録不明、確定発行・受け渡し未確認、管理認証喪失の3分岐、登録と対応Exposureの同時除去と取消非証明を全利用側へ接続する。

変更分類は採用済み判断の詳細化。契約・品質の着手前整合確認は統合済みで、追加の人間判断は不要。旧31 Relation・旧Gate・Definition本文／Hash・過去Evidenceを変更しない。新ID／API／Schema／Store／Recovery／取消処置／Visual実装を追加しない。固定15文書へ契約・品質独立レビューと文書参照・直接影響確認を行う。Source・標準規則・実環境を変更しないため全回帰・準拠監査・Docker／Provider E2Eは対象外。今回のDetail候補は契約／品質限定独立再レビュー済み（残指摘0）、Architecture／Quality／Source・実画面・全体Readyは未成立である。

限定結果：契約・品質の独立レビューを3原因へ統合し、現在投影の状態漏れ・Coverage重複・句点後空白を是正した。固定15文書の再レビューは両観点ともPass、全重大度の残指摘0。参照1,055件の欠落0、差分空白検査成功。未変更31 Relation、Workbench旧§1〜12、Definition本文・Hashを保持した。レビュー後は今回の状態と結果記録だけを同期し、過去の計画段階の判定は変更しない。次はArchitecture／AM詳細への追加判断伝播である。

### 登録解除と鍵の受け渡し未確認のUI／SPEC伝播 — 2026-10-11

基準Commitは`562f5aaf`。UI7文書・SPEC5文書・本計画とPROJECT_CONTEXTの計14文書を固定範囲とする。正式入力は確定UX／IAで、観点別分析を独立させ、UI-000008／SPEC-000012で統合する。登録と対応Exposureの同時除去、他対象・本体保持、元発行／記録不明の再観測と確定発行・受け渡しだけ未確認の別明示交換を、表示・動作条件・検証意図・現行1組対応へ伝播する。

変更分類は採用済み判断の工程伝播。契約・品質の着手前整合確認を統合し、同時除去完了／片側残存、発行確定・未確定／受け渡し未確認、現在認可喪失の代表例を正本へ照合した。今回の契約・品質独立レビューと文書参照・直接影響を確認する。標準規則・Source・実環境を変更しないため準拠監査・全回帰・Docker／Provider E2Eは対象外。一般SPECモデルは今回固有の契約Ownerでないため変更せず、旧32組・Hash・引用・Passを保持する。Detail／Architecture／Quality／Sourceは次段として未伝播を維持する。新ID／一般Recovery／Schema／Store／画面配置を追加せず、現在追加の人間判断は不要。今回の契約・品質独立レビューを統合是正し、限定再レビューは両観点ともPass・全重大度の残指摘0。14文書の参照747件の欠落0、差分空白検査成功。旧32組の対応本文・Hash・引用は不変で、Source・Detail・QAは未変更である。

### 登録解除と鍵の受け渡し未確認のIA伝播 — 2026-10-11

基準Commitは`db8b64e2`。確定UX-000035を正式入力としてIA分析・IA-000009・横断4文書へSame統合する。登録状態と公開設定の同時解除・他対象と本体保持、発行／結果記録／配送／受領確認、元発行Identityと各交換内exact Recovery／別明示交換のIdentity、状態別の次行動を既存Objectの属性・関係として具体化する。新Object・安定ID・一般Recovery・Secret保存・自動再発行は追加しない。

変更分類は採用済みUXの情報構造への伝播。着手前の契約整合確認を統合し、固定8文書の契約・品質独立レビュー、文書参照・直接影響を確認した。標準規則・Source・実環境を変更しないため準拠監査・全回帰・Docker／Provider E2Eは対象外。UI／SPEC以降・QA実行・Sourceは追加判断未伝播で、旧限定Passを今回へ流用していない。現在、追加の人間判断は不要である。

今回の限定確認結果：契約・品質の独立レビューを一括統合して是正し、再レビュー後の残指摘は全重大度0。元発行の確認情報は既存資格の属性へ統合し、変換表とCanonical対象表を同期した。発行・記録不明と受け渡しだけ未確認を下流への引継ぎでも区別した。参照160件の欠落0、差分空白検査成功。これは今回のIA伝播範囲の結果であり、下流・実装・実環境・全体品質の成立は主張しない。

### 登録解除と鍵の受け渡し未確認のUX伝播 — 2026-10-11

基準Commitは`913d0ea5`。REQ-000041を正式入力として分析・UX-000035・横断5文書へSame統合する。利用者成果と既存IDを維持し、登録解除後のCROSアクセス停止と本体保持、発行／記録不明と受け渡し未確認の区別、明示新交換と元処理の再観測、管理鍵喪失時の既存Host案内を引き渡す。新しい回復機構・Secret保存・自動再発行は追加しない。

変更分類は採用済み要求のUX具体化。着手前の契約整合確認を統合し、固定候補の契約・品質独立レビューと文書参照・直接影響を確認した。標準規則・Source・実環境を変更しないため準拠監査・全回帰・Docker／Provider E2Eは対象外。IA以降・QA実行・Sourceは未伝播で、旧限定Passを今回へ流用しない。現在、追加の人間判断は不要である。

限定確認結果：契約・品質の独立レビューと是正後の再レビューは最終ともにPass、全重大度の残指摘0。体験章の配置、図の3分岐、各交換内と別交換のIdentity、横断表の列責務、文境界空白の5件を統合是正した。9文書の参照先348件は欠落0、差分空白確認は成功。UXへの限定伝播までの結果であり、IA以降・QA実行・Source・本番接続・UX全体Readyの成立ではない。

### 登録解除と鍵の受け渡し未確認の判断 — 2026-10-11

人間は、登録解除時に対象の公開設定も同時に除去することと、発行・結果記録確定後の受け渡し未確認には秘密再表示・自動再発行をせず既存交換を明示再実行することを採用した。意味の正本は[REQ-000041](../../../01_Discovery/Definitions/REQ-000041/requirement.md#発行済みの鍵を受け取れなかった場合)。Repository／Product Dataは削除せず、現在認可・事前表示・既存確認条件を保持する。

基準Commitは`50230c49`。今回はREQ・本計画・PROJECT_CONTEXTの3文書で採用判断を固定する。契約・品質の着手前確認を行い、固定候補の独立レビュー、文書参照・直接影響を確認する。標準規則・Source・実環境を変更しないため準拠監査・全回帰・Docker／Provider E2Eは対象外。新しい鍵発行やHost操作も行わない。

後続の正式順序はREQ→UX-000035の分析／定義→IA-000009の分析／定義→UI-000008／SPEC-000012→SCR-000008／BHV-000012→ARCH-000013／AM詳細→QA-000007とする。既存IDを維持し、横断投影・検証義務・本番Consumerまでの伝播を確認する。AM詳細02の旧OPENは直ちに実装Readyへ変更せず、確定上流から順に更新する。これらの下流は今回未伝播で、先の限定レビューを最新判断のPassへ流用しない。

旧発行／結果記録が確定し、配送／受領だけ不明の場合に限り、新しい明示交換を別Operation／別Recoveryとして開始する。旧事実と旧exact Identityは保持し、先の資格を現在状態から失効集合へ結合する。発行自体・結果記録不明は元の発行Identityと既知事実で現在再観測し、交換由来だけは元exact Recoveryを保持する。通常発行へ交換Recoveryを新設せず、新交換でUnknownを消さない。現在administratorとして接続できない場合は既存Host入口を使う。一般Recovery、秘密再表示、追加認証、未承認の自動再試行は追加しない。

限定確認結果：固定3文書の契約・品質独立レビューは最終ともにPass、全重大度の残指摘0。指定／全員の交換範囲、通常発行Identityと交換exact Recovery、確定／不明の保持、検証意図、旧候補の時点表示を統合是正した。参照先56件は欠落0、差分空白確認は成功。要求への採用判断固定までの結果であり、下流伝播・QA実行・Source・本番接続・Handoff／Readyは未成立。

### 管理API・保存設計の具体化 — 2026-10-11

基準Commitは`a604f323`。固定4文書（AM詳細01・新詳細02・本計画・PROJECT_CONTEXT）で[具体化候補](../../../06_Architecture/Details/access-management/02_Management_State_and_API.md)を整理する。変更分類は採用済み境界の設計具体化。契約・品質の着手前確認を統合し、操作別API・内部と公開readの分離・保存方式比較・出版後故障・一度限りのSecret・全件明示移行を対象とする。固定候補の契約／品質独立レビュー、文書参照と直接伝播を確認する。標準規則・Source・実環境を変更しないため、準拠監査・全回帰・Provider／Docker E2Eは今回実行しない。

単一現在Fileを第一候補とするが、既存改訂Fileの排他的出版をそのまま流用できない。排他Owner、出版保証、保持清掃、公開Schema、Secret受領不明後の処置は実装Gateを阻害する未決として保持する。通常保存＋読戻しのTopic／Meeting判断をAMへ流用しない。追加の人間判断は現段階では不要だが、実データ移行のUser対応や保証拡張では確認する。Source移管・秘密Store操作・鍵発行・旧データ削除は行わない。レビュー結果は固定候補確認後に記録し、候補整理を実装Readyへ読み替えない。

限定確認結果：契約・品質の独立レビューは最終ともにPass、全重大度の残指摘0。操作別前提、旧設定全fieldのOwner対応、排他の未採用条件、登録とExposureの参照整合、入口別配送、評価済みOPENを統合是正した。登録解除時のExposure残存処置は上流未決として維持する。4文書の参照先57件は欠落0、差分空白確認は成功。Source・試験・Checker・実環境は今回未実行／未変更で、既存Not Runと実装Gate未成立を維持する。

第一段階の名称・物理配置整理を基準とし、第二段階は責務、状態所有、公開操作、本番利用側を整理する。Package単位で段階的に実装・検証するが、上位と下位の契約は実装前に一括照合する。Packageの実装完了と、上位Capability全体の成立を区別する。

現行CRDDの工程順序を維持する。既存REQ／UX／IA／UI／SPECの意味を確認し、変更が必要な箇所だけ所有工程へ戻す。その後Architecture基本設計・詳細設計、Qualityの検証義務・検証設計を更新し、実装・検証へ進む。添付の概念図を理由に工程順序を変更しない。

| 項目 | 今回の扱い |
|---|---|
| 人間の許可 | 第二段階の計画作成に続き、2026-10-09に計画Commit後の1〜5着手、続いて1〜8の完了までの継続を許可。CROS Package維持判断は同日の後続判断で見直し、Access Managementへの責務再編を進める。移管の具体Ownerは§11で照合し、未決候補を一括採用したとは扱わない |
| 変更分類 | 非自明な責務再編。公開入口・保存契約・安全境界を変更する箇所は破壊的変更として個別に影響を提示する |
| 変更意図 | 既存採用Capabilityを保持し、重複状態・不要中継・過剰管理を削り、構造を説明可能にする |
| 書込み範囲 | 現在のCRDD Repository。外部Runtime、認証領域、別Repositoryの変更は本計画だけでは許可しない |
| 対象外 | 新しいAI機能、汎用Recovery／Lock Framework、Event Bus、共有実行Registry、先行したLinux配備、氏名・メール・Password・登録申請・IdPを持つ汎用User Account。UUID・表示専用名・Role・Credential紐付けの最小管理は§11で採用済み、正式伝播中 |
| 歴史的Evidence | 当時の名称・署名・Hash・内容を保持。新構成の成立根拠には流用しない |
| 旧形式の移行 | フロントAIの確認・清掃手順が所有する。本番Sourceへ旧形式互換Readerを追加しない。未解決資源・参照を名前だけで消さない |
| v1.0との関係 | 添付は方向性であり、全候補をv0.22必須へ昇格しない。Release範囲・期限は別の人間判断 |

## 2. 着手前の照合と最初のGate

現行の[責務対応資料](Evidence/261007_develop-responsibility-mapping.md)、Orchestrator詳細設計、Package集合・直接importを確認した。現行設計にはCoordinator単体利用、Coordinatorの耐久記録・受領確認、Host排他への上位依存が残り、添付の目標と単なる配置変更以上の差がある。現行CROS HTTP、MCPのShared Host組立て、WorkbenchのPackage内部参照も移管対象の候補である。

現行Source全体・動的入口・配布閉包の全数照合はまだ行っていない。次の対応表を固定するまで削除・置換を開始しない。

| 固定するもの | 必要な内容 |
|---|---|
| 成立済みCapability | 公開操作、利用形態、正常・失敗・取消、過去の成立根拠と現在の限界 |
| 契約と利用側 | 公開API、CLI、MCP、Workbench、scripts、設定、保存値、Symbol、試験、配布・署名閉包 |
| 状態・資源の所有 | Task／Attempt／Queue、結果、Candidate、認証Home、Process、Container、Network、Lock、Recoveryの現在Ownerと移管先 |
| 各Fileの処置 | 維持／移動／統合／分割／廃止／判断待ち。分割では対象Symbolまで特定する |
| 既知不足 | 第一段階の責務混在12件、Native試験のSource分類、4試験SuiteとscriptsのSymbol接続、手動端末Probe、旧Recovery APIの型不整合、持ち越した5C |

旧5Cは免除せず、新しいOwner・必要保証・検証へ対応付ける。ただし旧方式の追加是正を先に完成させてから捨てる進め方は採らない。新契約で不要となる項目には理由を残し、旧Gateを新構成の合格へ読み替えない。

この段階の成果は、責務のBefore／After、依存方向、保持する保証、廃止候補の利用側影響、未決判断である。ArchitectureとQualityの独立確認後、人間が必要な変更を判断し、実装順を固定する。

## 3. Packageの推奨対応順

全16現行親Folderを対象に、変更不要も理由付きで処置する。`docker-isolation`は新設候補であり、採用前に作成しない。

2026-10-09の人間判断により、当初案の実行系6〜8を公開入口9〜11の後へ移す。大改修に先立ちCROS／MCP／Workbenchを整理するため、改訂後は公開入口を6〜8、実行系を9〜11とする。実行系の要求・結果・取消の目標契約は順序0で照合するが、その実装を前倒ししない。

前半の公開入口整理では現行の実行APIと安全境界を維持し、UI／Protocolの責務を実行内部から分離する。後半の差し替えに備えるためだけの中継Frameworkや二重実装は作らない。未成立の実行機能は未成立のまま示し、公開入口の限定完了と実行系を含む全体完成を区別する。公開入口を閉じるために実行系の変更が不可欠と判明した場合は、その依存を示して順序を再判断し、黙って大改修を前倒ししない。

| 順序 | 主対象Package | 主な作業・閉じる範囲 | この順序の理由 |
|---|---|---|---|
| 0 | 全体のArchitecture／Quality | 前節の対応表と上位・下位の要求／結果／取消／状態Ownerを固定する。Docker分離、単体Coordinator入口等の判断を得る | 下位を先に作り、後から上位の都合で契約を作り直すことを避ける |
| 1 | `version-control` | Repository／Revision／Git操作／採用時の短い書込み境界を整理。Layout観測とExclude更新を分離 | Domain保存と候補採用の基盤。worktree採用を前提にしない |
| 2 | `domain-model` | 意味・CRUD・保存の責務を整理。Topic／Meeting、投影と候補判断、型集合の混在を処置。改訂競合・必要な短時間排他・atomic公開を評価 | 上位が保存方式を重複実装しないため。DomainからGit Commit／Pushを発行しない |
| 3 | `execution-intelligence` | 実行事実・要約と評価候補を分離。時刻、欠測、保持設定と最小Event契約を確認 | 実行系再編に先立ち、記録する事実と記録Ownerを決める。実行制御を持たせない |
| 4 | `ai-adapter` | ProfileとProvider固有要求・CLI引数・結果変換・エラーを整理。公式CLIを未改造で使う | CoordinatorからProvider差を外す。AdapterからTask進行や履歴保存を発行しない |
| 5 | `platform-access` | 実行系が本当に必要とするOS保証と呼出し側を全数照合。必要Native部品だけ整理し、Nodeで同じ保証を満たせる部分は置換候補にする | Docker／Processの設計前にOS保証を確認。Package廃止やRust全面置換は事前決定しない |
| 6 | 現行`cros` → `access-management`／`domain-model`等 | 認証・認可・管理回復と接続RegistryをAccess Managementへ再編し、Context集約・通信・実行判断を分離する。全Source・公開API・利用側の対応とArchitecture／Qualityを固定してから移管する | CROSを全体システム概念とPackage名に分ける。単純改名で現行責務全部をAccess Managementへ吸収せず、旧Package撤去は全責務と利用側の接続後とする |
| 7 | `mcp-server` | Machine向け公開契約とstdio／HTTP lifecycleを閉じる。Shared Host所有と配布入口の巨大組立てを整理 | CROSの責務整理を受けて公開入口を整理。実行内部は現行契約を維持し、単一RepositoryとCROSで操作Schemaを不用意に分岐させない |
| 8 | `workbench-server` | 本番組立てをbinからSourceへ移し、Browser API／Local呼出し／Remote MCPを接続。変更通知・編集中入力保護を具体化 | 公開入口の責務整理を実行系大改修より先に閉じる。UX／IA・Visualの人間確認とBackend整理を区別する |
| 9 | `docker-isolation`候補／現行Coordinatorの隔離処理 | 採用した境界で隔離実行・取消・観測・清掃・必要最小の再入場を移す。使い捨て資源、一次失敗と清掃結果の分離を実環境で確認 | 後半の大改修では最初に資源Ownerを閉じる。Coordinator／Orchestratorの業務状態を持たせない |
| 10 | `coordinator` | AI Adapterと隔離APIを利用する実行・Executor／Reviewer・進捗・取消・結果返却へ集約。重複永続状態とConsumer保存依存を削る | 下位の終了条件が成立してからAI実行を組み立てる。下位から上位をimportしない |
| 11 | `orchestrator` | Task／Attempt／Queue・実行順・判断待ち・耐久結果を一つのOwnerへ集約。採用した本番入口を接続し、整理済み公開入口の利用側を追従する | Coordinatorの実結果を上位状態へ接続する。内部モックだけで本番完了にしない |
| 12 | `artifact-signing` | 最終実行閉包と必要な署名保証に合わせ、Release Tooling／Runtime検査の境界を整理 | Source移管ごとの反復署名を避ける。ただし実行系設計に影響する保証は順序0で先に判断する |
| 13 | `official-asset-governance` | 保存と認可・判断実行の混在を処置。比較交換・確定単位を保つ | 実行系と独立して閉じられる。今回も第三の中継層を追加しない |
| 14 | `semantic-coverage` → `checker` → `verification-runner` → `visual-preview` | Compiler／結果変換、Rule／CLI、Catalog／許可／回帰選択等を整理。新所有者の検査と実行Profileを完成させる | 全体の最終契約へ合わせる。移管中に必要な検査追従は各順序で先に実施し、ここまで放置しない |
| 15 | 全体 | 全回帰、Reality Audit、独立レビュー、必要な実Provider・署名E2E、移行・公開文書・現在状態を更新 | 全Package単体の合格だけから全体完成を推定しない |

## 4. 大改修する実行系の切り方

後半の実行系では実装順を下位から、要求設計を上位から行う。改訂後の段階9〜11を一度に全置換しない。前半で整理した公開入口へのAPI追従は各Package変更に含め、最終実境界は新構成で再確認する。

| 段階 | 閉じる内容 | 次へ進む確認 |
|---|---|---|
| 隔離境界 | 使用資源、入力、開始・終了、取消、Process終了、清掃、親喪失時に残る資源と最小処置 | Provider依頼なしの実Docker局所試験で、成功・開始失敗・取消・終了観測不能を区別できる |
| Coordinator実行 | Profile解決済み要求、公式CLI、Executor／Reviewer、進捗通知、最終結果。一次失敗を清掃結果で上書きしない | 下位の実結果を用いた結合試験と固定Taskの局所実Provider確認。表示・任意保存を清掃条件へ入れない |
| Orchestrator進行 | 受付、Queue、Task／Attempt、結果の耐久保存、人間判断、再開 | 本番入口から正常・取消・中断再入場・候補採否・競合を確認し、共有状態の重複がない |
| 公開利用側 | CLI／Workbench／MCPの実行経路と表示・操作 | 同じ公開Capabilityと認可を使い、単体試験成功を公開全体の完成へ昇格しない |

Dockerは隔離を維持し、Containerの継続利用を回復目標にしない。資源を安全に処置し、新しいAttemptを開始できることを目標とする。過去のunknownを成功へ変更せず、現在の資源不存在と再実行可能性を別に評価する。成立が立証された限定ケースだけを閉じ、汎用強制削除や共有Recovery管理へ拡張しない。

Consumerの結果保存はそのOwnerが担当する。Orchestratorの耐久受領と、Dockerの資源回収を分離する。応答文章とCandidate本体も区別し、意味のある候補・失敗根拠だけ必要なOwnerで保全する。

## 5. Packageごとの完了・Commit条件

主対象は一Packageとするが、API変更に伴う直接利用側、試験、設定・配布入口、Architecture／Quality／Symbolの追従は同じ変更に含める。Folderを厳密に一つに限定して壊れた呼出し側を残さない。一時的な汎用Adapterや旧方式互換Frameworkを増やさず、必要な連動切替は同じCommitへまとめる。

1. 該当する正本と公開契約、保持する保証、変更しない範囲を確認する。
2. 必要なArchitecture／Quality更新と人間判断を先に済ませる。
3. Source・試験・直接利用側・Schema・Symbol・設定・入口を更新する。
4. Formatter・型・Lint・静的契約、Package回帰、影響利用側の結合試験を実行する。
5. 外部資源Ownerを変更した段階では、その局所実境界を先に確認する。全E2Eを最初の影響分析にしない。
6. 固定差分を独立レビューし、対象内指摘を是正・再確認する。
7. 現在状態・対応表・CHGを更新し、完了したPackage単位でCommitする。Pushは人間が許可した運用範囲に従う。

Packageの限定完了は未検証の全体をPassと表示しない。既知の基準版不整合は切り離して記録するが、今回の変更が使う契約の不整合は先に解消する。削除前には代替先と利用側の接続、新しい根拠を照合する。

## 6. 判断が必要な地点

| 判断 | 提示する根拠 | 判断時点 |
|---|---|---|
| Coordinator単独の本番入口を廃止するか | 現行CLI／Workbench／MCP／scriptsのConsumer一覧、Orchestrator経由の代替、失う操作 | 順序0、公開入口変更前 |
| `docker-isolation`を独立Packageにするか | 現行File・資源Owner・AI Adapterとの依存、独立試験の実益、Package内Module案との比較 | 順序0、抽出前 |
| worktreeか現行隔離Snapshotか | Canonical保護、候補採用・競合、共有Git metadataとMount境界、運用費用 | 順序1〜2の設計。採用まで新方式を作らない |
| 署名・Native保証をどこまで削るか | 現在守る保証、具体的Consumer、Node／既存隔離による代替と残存Risk | 順序0で設計制約、順序5・12で具体的削除判断 |
| CROS Package維持か廃止か | 必要なRegistry／認可／RoutingのOwnerと、移管で増える依存・中継 | 2026-10-09の維持判断は後続の人間判断で見直し。認証・認可を`access-management`へ再編し、その他責務を実Ownerへ移した後に旧`cros`を撤去する。専用REST／Gateway／Shared Host廃止方針は維持する |
| Workbenchの利用導線・表示・Visual | 現行UX／IAとの比較、Screen Inventory／Flow、代表画面と代替 | 順序8の接続維持後、画面再設計前 |

これらを一括質問せず、必要な根拠が揃った地点で推奨と影響を提示して止める。単なる内部File移動へ追加判断を要求しない。

## 7. レビュー・監査と収束

現在は1〜5へ着手しているが、未決Architecture候補の採用・全Sourceの監査・全体の実境界試験を完了したとは扱わない。順序0の全体照合は継続し、既存設計に整合する限定内部整理から進める。未決契約の削除・置換は照合と判断前に行わない。各Packageでは変更した責務に対する独立レビューと、必要な文書・不足影響監査を選ぶ。準拠基準自体を変更する場合だけ準拠監査を追加する。Communication／市場探索は公開訴求を変更しない段階には追加しない。

最終確認は変更した意味から全回帰面を導出する。正式Evidenceは判断に必要な結論・対象版・条件・根拠参照へ集約し、実行ごとの巨大ログをCHGへ保存しない。通常履歴・一時物の保持と、正式Evidenceの保持を分ける。

収束条件は、採用済みCapabilityの全対象にOwner・利用側・検証が対応し、重複状態と不要中継の処置が説明でき、未決の必須条件を将来へ隠していないことである。理想構造の完成や試験量の最大化を目的にしない。

## 8. 1〜5の着手結果 — 2026-10-09

計画Commitは`459d598d`。現行設計・Source・直接利用側から処置を具体化し、未決の実行系改修は前倒ししていない。

| 順序 | 現在の処置 | 次の確認 |
|---|---|---|
| 1 Version Control | 除外設定更新を既存`git/local-ignore-adapter.ts`へ移し、Layoutは観測・共通再検証へ限定した。公開API、128KiB上限、関数本体、結果型、Lock・更新順序を維持。限定独立レビュー指摘0 | この限定移管は確認済み。worktree方式変更・採用境界の設計変更は未採用で、別途比較する |
| 2 Domain Model | 共通活動操作・型を`activity/operations.ts`／`activity/types.ts`へ移管。一時保存型は`storage/types.ts`へ限定し、投影と候補判断を同じContext領域の別Fileへ分離。限定独立レビュー指摘0 | 本体・型・公開集合一致、Package回帰106件とCROS／MCP／Workbench型接続を確認。全体Checkerの未変更Coordinator指摘は別残件として保持する |
| 3 Execution Intelligence | 改善提案を`evaluation/improvement-candidates.ts`へ移管し、事実Eventの検査・Summaryを一方向に利用する。公開API・提案本文・結果値不変、限定独立レビュー指摘0 | 基準・変更後各82件のPackage回帰、公開入口契約、Orchestrator／Workbench型接続を確認。保存方式や採用Authorityは変更しない |
| 4 AI Adapter | Provider認証Probeの出力判定・非正常終了分類をAI Adapterへ移し、Coordinatorの引数再検証を既存Provider記述へ接続。限定独立レビュー指摘0 | Package回帰13件、Controller／Effect結合126件を確認。隔離資産の移管は後半のDocker Owner確定まで先行させず、署名・実Provider境界の未評価を保持する |
| 5 Platform Access | OS保証と実利用側を照合。Namespace初期化・親chainと対象観測を分離し、公開Protocol・権限・終了条件は維持 | 通常Native回帰と限定独立レビューで確認する。実OS専用fixture、Docker Desktop部品の撤去・Native廃止・再署名は局所整理の完了に含めず、後半実行系の判断へ対応付ける |

### Version Controlの限定確認

- 基準Package回帰46件全件Pass。移管後に所有者分離の契約試験を追加し、最終47件全件Pass、Skip／Failとも0。
- Formatter、型検査、LintはPass。通常／linked worktree、七つの更新失敗段階、実Process競合、再入場、公開Symbol・Consumer閉包の既存試験を維持した。
- 移動したブロックを基準`98cab6e3`と機械比較し、Owner名の説明・末尾改行以外は一致。関数本体・結果形式の変更なし。
- 着手前の独立確認と変更後の限定独立レビューを実施。指摘0。既存両Fileと試験SuiteのSymbol登録は変更不要。
- 実Git試験の一時RootはRepository内`.crdd/tests/stage2-version-control`へ限定。Docker／Provider依頼、認証領域変更、署名・Release操作は行っていない。
- これは除外更新Owner移管の成立根拠であり、第二段階全体の完了・新方式Candidate採用・署名配布の成立根拠ではない。

### Domain Modelの限定確認

- 活動操作の実体は一つのまま保持。Topic／Meetingの種別固定操作、保存実装、Cursor、改訂競合、削除確認、昇格・Outcome処置は変更していない。
- 読取り投影は`project-context/source-projection.ts`、候補採否判断は`project-context/candidate-decision.ts`が所有する。判断条件・結果値・保存形式は不変。新しい公開Symbolや中継層は追加していない。
- 基準版と変更後のPackage回帰は各106件全件Pass、Skip／Failとも0。Formatter、型検査、Lint、CROS／MCP Server／Workbench Serverの型検査はPass。
- 移管した関数本文、活動型・一時保存三型、Rootの公開Symbol集合を基準Commitと機械比較し一致した。直接参照、Symbol登録、Architectureの配置、Checkerの公開Path集合を追従した。
- 着手前整合確認と変更後の限定独立レビューを実施し、指摘0。全体Checkerの公開入口検査はPassだが、未変更CoordinatorのNative試験Header・型分類・Test Symbol登録で二つの検査が失敗した。全体Passとは扱わず、後半の実行系整理へ残す。
- Docker、外部Provider、署名・配布、保存Lifecycleの変更は対象外。候補判断関数の移動を正本Effectの実行検証とは扱わない。

### Execution Intelligenceの限定確認

- 改善提案を既存の評価領域へ分離し、記録・検査・要約は既存Ownerに保持した。新抽象、Provider呼出し、採用権限、自動変更は追加していない。
- 提案関数本文とRoot公開Symbol集合を基準版と機械比較し一致。不正Eventの拒否、欠測、根拠Event ID、契約文字列、`proposal`、Authority非付与は不変。
- 基準・変更後各82件のPackage回帰は全件Pass。Formatter、型、Lint、Orchestrator／Workbenchの型検査はPass。Checkerの公開入口・依存方向・階層の限定3検査はPass。
- Architecture、Symbol、新Ownerを検証する既存二Suite、直接参照、Checker期待集合を追従。着手前確認と変更後の限定独立レビューは指摘0。
- 全体Checkerの未変更Coordinator指摘と、後半の実行系・署名実E2Eは残る。局所結果から全体完成を主張しない。

### AI Adapterの限定確認

- 認証Probeの判定は`profile/subscription-status.ts`、非正常終了分類は`output/provider-error.ts`が所有する。Process・取消・回収・実行AuthorityはCoordinatorに保持する。
- 基準`57495b94`の旧関数本文と、移管後の二関数本文を独立レビューで機械比較し一致した。Offering、厳密認証と対話認証の別契約、分類順序・上限・理由値は変更していない。
- 引数再検証では既存の認証記述とClaude引数Builderを利用する。引数順序、助言経路の例外、Docker設定は不変。公開入口、Symbol、Controller試験の実装参照、Checker期待集合、Architectureを追従した。
- AI Adapterの書式・型・Lint・回帰13件はPass。Controller／Effect結合試験126件はPass、Skip 0。変更SourceのLintとCoordinatorのSource型検査はPass。Coordinatorの試験型検査は未変更二Fileの既知18件で失敗し、全体Passとは扱わない。
- 固定差分の限定独立レビューは指摘0。実Provider／Docker起動、認証操作、署名・配布は行っておらず、これらの実境界成立の証拠ではない。

### Platform Accessの保証・利用側照合

| 保証の所有範囲 | 現行利用側 | 今回の処置・Nodeへの置換評価 |
|---|---|---|
| RootのIdentity・アクセス観測 | CoordinatorのPlatform Access境界とRoot契約。検証済み実起動に未接続の入口は未接続のまま保持 | `root_observation`／`protection`を維持。NodeのPath文字列・stat・accessは同handleのWindows権限照合と同じ保証ではない。未接続を不要の根拠にしない |
| Provider Home／Candidate Store／Runtime Stateの保護 | `provider/home-windows-adapter.ts`、`platform-access/protected-root-windows-adapter.ts` | `protected_root`／`principal`／`protection`を維持。固定Known Folder、利用者SID、非Reparse、同handle Identity・DACL、限定初期化を環境変数や通常File APIで代替しない |
| System Directoryと最小子Process環境 | `host-execution/windows-directory-bootstrap.ts`と子Process環境構成 | `windows_directory`を維持。OS取得値と環境変数の文字列を同一視しない |
| Host Namespaceと終端記録 | `host-execution/terminal-windows-adapter.ts`とcaller checkpoint | Namespaceの三実体・保護・初期化を`host_namespace`、十一／十二対象の読取り・再照合・終了を`terminal_target`、容量・予約・保存・読戻しを`host_record`へ分離。保存区間の排他・receiptは同じ同期Ownerへ保持し、追加Frameworkを作らない |
| 固定Docker Desktop・署名Publisher・所有子Process | `docker-desktop/repair-native-process.ts`と既存修復・再起動入口 | WinVerifyTrust、Process実体、suspended→Job→resume、終了確認を維持。Node spawn・hashだけへの置換は同じ保証の根拠がない。修復削減は後半の実行系へ接続する |
| 固定Protocolと結果搬送 | Native `main.rs`／`protocol`、上記TS Adapter | Rust側の未信頼入力検査とTS側の未信頼応答検査は異なる境界。片側だけ成功することを理由に重複として削除しない |

上表は現在利用する保証とOwnerの照合であり、新しい保証の採用・実OS検証の完了ではない。Nodeへ移せる純粋なcodec・hashだけを抽出するための新APIは追加しない。必要性のない移管は依存と検証費用を増やすためである。

### Platform Accessの限定確認

- 対象観測の530行を`filesystem/terminal_target.rs`へ移管し、基準`9f6fd8c2`とブロック全体の機械比較で一致した。公開範囲、八／九handleの保持・逆順close、十一／十二実体の別契約、部分取得・元失敗と終了不明は不変。
- Rust直接利用側は`host_record`へ保持し、既存fixtureの名前・実行条件を変更しない。Native公開入口、wire、TS Adapter、Docker修復処理は変更していない。
- Architecture、Symbolと既存試験の実体参照、Module宣言、Coverageの明示Source集合を追従した。Coverage集合の存在しない旧`provider_home.rs`参照は現行`protected_root.rs`へ訂正した。
- 基準・移管後の通常Native回帰は各44単体＋6CLIがPass、23件は明示ignored。Cargo書式確認・Clippy（warning拒否）はPass。ignoredの実OS専用fixture、計測Coverage、署名・実Dockerは今回実行していない。
- 新Sourceは既存Native検証入口の再帰Source閉包へ含まれる。現行署名済み実行物を新Treeの検証証拠へ流用せず、後半で新しいBuild Identity・配布閉包・必要な署名境界を確認する。
- 限定独立レビューの文書図1件を是正し、Namespaceの直接dispatchと対象／記録要求を実装に合わせて分けた。是正後の未解決指摘0。実装上の保証漏れ・本体変更は検出していない。

## 9. CROS／MCP／Workbenchの移管前照合 — 2026-10-09

本節はPackage維持判断変更前の照合・実測履歴である。維持判断と以下の実施順は§11で見直された。現在のOwner方針と再開Gateは§11を優先し、本節の維持前提を現在の実装許可へ流用しない。過去の判断・観測・検証結果自体は変更しない。

### 結論と判断境界

CROSの登録・Credential・認可・横断投影は独立した責務として、2026-10-09の人間判断で独立Package維持を承認した。CROS専用REST／Gateway／Shared Hostは廃止対象であり、BrowserとWorkbench Server間のPresentation APIは維持する。以下の対応をArchitecture／Qualityと利用側へ具体化してから実装する。未決の実行系構成をこの判断から採用しない。

着手前の読取り専用確認により、現行利用側、移管先の不足、保持保証と依存順を照合した。これは段階6の独立完成レビューや実装許可ではない。変更経路は既存CHG内の責務再編であり、実装時はArchitecture／Quality、直接利用側と配布入口の不足影響・文書確認、固定差分の独立レビューを行う。準拠基準・公開訴求・Release判断は変更しないため、準拠監査・市場探索・署名実E2Eをこの棚卸しへ追加しない。

### 現行利用側と移管案

| 現行入口・利用側 | 移管先・処置案 | 保持する成立条件と現在の不足 |
|---|---|---|
| Workbench Server→`readRemotePortfolio`→CROS REST | 既存MCPの`crdd.list_projects`／`crdd.get_project_context`へ切替 | 一覧はProject ID・状態・Source数のみで、完全なPortfolioではない。個別取得との整合、許可Source、五場面、欠測・競合を保持する読取り手順を設計する。接続済みとは扱わない |
| Workbench Server→`readRemoteAiProfileCatalog`／`executeRemoteAiProfileMutation`→CROS REST | Profile参照・管理をMCPの専門Adapterへ接続してから切替 | 現行MCPには未接続。systemAdmin限定、expectedRevision競合、削除確認、理由・現在Snapshotを保持する。管理権限からProject本文アクセスを生成しない |
| Workbench Server→`readRemoteRuntimeActivity`→CROS REST | Runtime活動の読取りをMCPへ接続してから切替 | 現行MCPには未接続。要求ごとの現在Credential・Exposure、許可Repository集合、cursor、limit（既定20・1〜50）、`observed/absent/unknown`、Event欠測・継続を保持する。欠測を空一覧の正常状態へ畳まない |
| Workbench Server→Topic／Meeting MCP Adapter | 既存MCP操作を維持 | 明示Repository、改訂競合、確認付き削除、Relationの非開示を保持。共通通信処理を整理する場合も汎用接続Frameworkを追加しない |
| CROS `connection/http.ts`内の型とReader契約 | 認可・横断投影の実責務Ownerへ移す | Exposure Snapshotに加えRuntime observation／event／readerも対象。MCP resolver、設定Reader、Workbenchの直接利用側を同じ切替へ含める |
| MCP `shared-host/server.ts`のREST・MCP・Gateway三Listener組立て | Shared Host／Gatewayを撤去し、MCP自身のHTTP lifecycleへ集約 | Origin、TLS終端、mirror header、Bearer、payload制限、切断・停止時の取消／join、Listener／Socket回収を維持する。Local呼出しはTransportを省いても認可を省かない |
| `/.well-known/cros-health`、Shared Server起動・設定・運用入口 | 旧入口を撤去し、必要な受付観測をMCP自身へ対応付ける | Transport受付は認証、Project参照、Provider正常、実行能力の成立を証明しない。旧URLの利用側、公開Launcher、設定、試験・運用手順の全数照合は未完了 |
| Credential発行・回復 | 既存Local管理入口に保持 | 秘密の発行能力をMCPへ新設しない。MCPは認証済み要求を認可へ接続する |
| Browser→Workbench API | 維持 | Server→CROS RESTの廃止と混同しない。表示導線・Visualの再設計は別の人間確認へ戻す |

### 現行Ownerと本番未接続の区別

読取り専用の移管前確認を完了し、次の三能力を旧RESTから新Ownerへ対応付けた。下表は実装前の処置であり、新MCP接続の完成根拠ではない。

| 能力 | 意味・操作の現行Owner | 保持する試験と移管時の不足 |
|---|---|---|
| Portfolio | CROS `federation/project.ts`の`createPortfolioProjection`／`resolveAuthorizedRepositories` | CROSの許可Source・無効Bearer非開示、MCPのWorkspace限定搬送、WorkbenchのCoverage・失効後Current表示拒否を保持。一覧と個別取得の間で別Snapshotを混入させない読取り契約が必要 |
| AI Profile管理 | AI Adapter `catalog/types.ts`と`profile/administration.ts`の`createAiProfileCatalogAdministration`。CROSは管理可否を判定する | AI Adapterの競合・確認付き削除Oracle、CROSの非管理者403・Catalog非開示、Workbenchの管理者限定表示を保持。MCP Schema／route／Resolverは未接続。本番CROS LauncherもAdministrationを注入していない |
| Runtime活動 | 現行CROS `connection/http.ts`の観測・Event・Reader契約。実状態はOrchestratorが所有する | CROSのReader入力を許可Repositoryに限定するOracleと非開示Project拒否、WorkbenchのRemote活動表示を保持。型・読取り契約をTransportから分離する。MCPと本番CROS LauncherのReader注入は未接続 |

現行の主なOracleはCROS `remote-transport.contract.test.ts`、MCP `cros-project-context-mcp.integration.test.ts`、Workbench `workbench-server.contract.test.ts`およびAI AdapterのCatalog／Administration試験にある。REST試験の成功だけでは管理操作全体を網羅しない。`template/tools/crdd-cros-server.ts`はRegistry・Exposure・Topic／Meetingだけを組み立て、設定型にもAdministration／Runtime Readerがない。したがって、本番未接続を単なるTransport移動で解消済みと扱わない。Credential発行・回復は既存Local管理入口に保持する。

### 削除までの依存順

1. 承認済みCROS PackageをOwnerとして、共通契約と保持する認可・結果意味をArchitecture／Qualityで固定する。Exposure・Runtime観測／Reader型をHTTP Transportから分離し、Root export・設定Reader・MCP Resolver・Workbenchの直接利用側を追従する。
2. 未接続のProfile管理・Runtime活動をMCPへ接続し、正常、拒否、競合、欠測、取消と終了後状態を確認する。本番Launcherの依存注入も閉じる。現行`crdd-cros-server.ts`と設定型は両能力を注入しておらず、optional Portとfixture成功を本番成立へ読み替えない。
3. WorkbenchのREST利用四入口をMCPへ切替え、既存Topic／MeetingとBrowser APIを維持する。
4. 代替接続・試験・設定・公開入口・Symbolを照合した後、CROS REST／Shared Host／Gatewayを撤去する。旧通信実装を互換Readerとして残さず、導入側移行はフロントAI手順へ接続する。

REST試験は機械的に削除せず、認可、管理、ページング、結果検証、取消・終了のOracleを新Ownerの試験へ対応付ける。未対応Capabilityがある間は旧処理を置換済みと表示しない。Docker／Coordinator／Orchestrator大改修は前倒ししない。

### 段階6の型所有者分離 — 着手前照合

後続の共通認可接続は、既存認証関数を置換せず、HTTPとMCPに重複する認証後のSnapshot／Session／許可Repository集合だけをCROS `access/resolve.ts`へ集約する。着手前確認で認証順序とSession失敗の入口別処置を照合した。Contentでは各認証一回・Snapshot一回、ProfileとContent POSTではSnapshot零回を維持する。Reader故障を認証失敗へ丸めず、管理権限だけでContentを開示しない。Rootへ新関数一つを意図的に公開するが、新Tool、Store、Authority、Frameworkは追加しない。既存HTTP／MCP回帰、観測回数と失敗反例、実装・品質独立レビューで確認する。検証完了は未確認である。

共通化候補のCROS33件とMCP51件は成功したが、独立レビューは両観点で同じMinor1件を検出した。Readerを裸で渡すと従来のReceiverを失うため、HTTP二箇所・MCP一箇所だけを元入力への呼出しclosureへ訂正する。全結果統合と是正方針照合後、両入口の既存試験へ通常method Readerと観測回数のOracleを追加した。認証順序、失敗結果、公開集合、Authorityは変更せず、修正後候補で回帰と再レビューを行う。

是正後の固定候補はCROS33件、MCP51件、Workbench33件と各静的確認・Workbench BuildがPass、Fail／Skip／取消0。MCPに存在しないformat scriptを指定した初回確認は失敗して試験へ到達せず、既存Biomeで対象二Fileを整形して静的確認から再実行した。九Pathの限定再レビューは実装・品質とも指摘0。認証後Scopeの共通Owner接続を限定完了とし、段階6〜8のTool登録・本番接続・旧REST撤去は継続する。実Provider／Docker／署名操作は行っていない。

基準Commitは`3b3827a5`。既存HTTP内の四公開型だけを移す。認可Snapshotは`access/types.ts`、Runtime活動のEvent／観測／Readerは詳細設計§6.1と同じ`activity/types.ts`が所有する。Portfolioを扱う`federation`へ活動型を混在させない。HTTP lifecycle Handle、実関数、Validator、認可分岐、公開Symbol集合と型shapeは維持する。設定ReaderとRoot exportを同時に切替え、MCP Resolver／Shared Host／非開示試験、WorkbenchとCROS試験は既存Root参照で追従する。代表登録は`cros.public-api`と`cros.remote-transport`からの型依存閉包として照合し、毎Fileの新登録や新中継は作らない。

着手前の読取り専用確認で型Ownerと全直接利用側を照合した。新しい状態・資源・Authority・Effect・取消経路は導入せず、既存HTTP回帰とCROS／MCP／Workbench静的確認を使う。公開型本文一致・公開集合保持・代表登録到達を確認し、固定差分を独立レビューへ渡す。新MCP接続・本番Launcher・旧REST撤去は後続に保持し、今回の型分離を段階6全体の完成としない。準拠基準・外部公開訴求を変更しないため、準拠監査・市場探索・署名実E2Eは今回非該当である。

移管前CROS回帰は33件Pass。移管後は四型の宣言本文とRoot公開80 Symbolの集合一致、CROS／MCP／Workbenchの書式・型・Lint成功を確認した。初回静的確認の未使用importを除去後、CROS全回帰は32件Pass・1件Failとなったが、失敗は既存Config試験の準備中の`git init`異常終了であり、Config操作の拒否Oracleへ到達していない。同じ固定Sourceの局所再実行は1件Pass。これを無言で全Passへ補正せず、全回帰を再確認する。新型FileはRootの明示exportとHTTPのtype importへ直接接続し、代表Symbolから未到達の型として扱わない。

同じ固定Sourceでの最終回帰はCROS全33件、MCP全51件、Workbench全33件がPass、Fail／Skip／取消0で終了した。各静的確認とWorkbench BuildもPass。最初の試験準備中の異常終了は原因未確定のまま保持し、最終成功をその原因解消の証明にはしない。固定七Pathの実装・品質の独立レビューは双方指摘0。型所有者分離を限定完了とし、新MCP Tool、本番Launcher接続、旧REST撤去および段階6全体の完成は主張しない。

### 基準回帰の確認

- CROS Packageの静的確認と回帰33件はPass、Skip／Fail 0。これは現行RESTを含む基準結果であり、新MCP接続の結果ではない。
- MCP Packageは初回50件中1件が旧改名Path二箇所のENOENTで失敗した。試験の参照を現行`transport/stdio.ts`／`transport/streamable-http.ts`へ訂正後、静的確認と50件がPass、Skip／Fail 0。ProtocolがError envelopeを所有するassertionと対象数は不変である。
- 上記実行対象はHEAD `d25f4851`とMCP試験の二Path訂正。実行結果はTool出力から確認し、再実行は各Packageの`npm test`を使用する。外部Provider・Docker・認証・署名操作は行っていない。巨大ログの複製は作らない。
- Workbenchの基準回帰は33件中31件Pass・2件Fail。Node依存閉包の旧入口Pathと、現行Vite Build結果に未追従の追跡Bundleを検出した。入口・Server・Browser参照を現行配置へ訂正し、Bundleを再生成した。再BuildのSHA-256は`ffcecf344cbc6559b07e0a94a1d5615c08b34208fe0d4d865b7e5f2609f0d3ef`で一致。静的確認・対象二試験に続き、是正後の全回帰33件もPass、Skip／Fail 0。Browser実操作・Visual評価・実Provider成立を示す結果ではない。
- MCP試験・Workbench依存試験・生成Bundle・本節の固定差分を限定独立レビューし、指摘0。試験参照更新の意味と保持条件、Bundle Hash／Index Blobの一致を確認した。独立確認者はBuild・試験を再実行しておらず、実行結果は親のTool出力から確認した。Repository内の専用試験一時Rootは終了後にcacheだけであることを確認して回収する。

Related:
- [現行の責務対応と第一段階結果](Evidence/261007_develop-responsibility-mapping.md)
- [Orchestrator詳細設計](../../../06_Architecture/Details/orchestrator/01_Architecture.md)
- [コーディング規約](../../../06_Architecture/99_Coding_Standards.md)
- [変更管理](../../../19_Maintenance.md)

## 10. 段階1〜5の全体照合と是正対象 — 2026-10-09

### Profile管理のMCP接続 — 着手前照合

基準は`b5733c6e`。既存CROS RESTの管理権限判定と操作別Mutation検査をCROS `profile/administration.ts`へ移し、AI Adapterの既存Catalog管理・保存・改訂競合は再利用する。MCPの一覧・作成・更新・削除を同時登録し、現在systemAdminでない主体へ管理ToolとCatalogを開示しない。管理RequestはContent Exposureを読まないよう、既存ResolverのContent Scopeを必要な操作で一回だけ解決する。既存Profileの構造ValidatorはAI Adapterから再利用できる入口にし、MCPでRole／Model語彙を別定義しない。未知入力拒否、非管理dispatch零回、改訂競合、未確認削除、保存後故障・取消の非再送を確認する。同期採用済み変更は応答取消で巻き戻さない。RESTと本番Launcher／Workbenchの代替接続・撤去は後続であり、新Store・DTO・Lock・Recoveryを作らない。関連Package回帰と実装・品質の独立レビューを行う。実Provider・Docker・署名はこの接続に不要で実行しない。

Profile四ToolとCROSの認可接続を実装し、管理者／Developerの一覧全件対照、非管理Catalog読取り0、Content読取り0、正常CRUD、期待改訂競合、未確認削除、未知入力、事前取消と採用後故障／取消の非再Mutationを確認した。初回試験はメモリRegistryの初期改訂1を0と誤認して失敗したため試験入力を訂正した。AI Adapter既存試験は新公開SymbolとDomain共通Validator依存のfixture追従漏れ2件を検出し、公開集合とfixtureの検証済み依存先だけを同期した。旧Storeの初期改訂0やRuntime契約は変更していない。

独立レビューは結果の相関不足Major1と、Helper Trace・非管理読取りの否定観測・Resolver HeaderのMinor3を返した。全結果と是正方針を両観点へ統合し、AI Adapterの既存Profile管理責務で操作／理由／改訂／対象Profileを共同検査する。成功は期待改訂+1とexact対象反映または削除後不存在、拒否は操作・理由固有の存在条件と改訂を満たす場合だけ公開する。Proxy／accessor非実行と所有済みCatalogを維持し、追加snapshot／executeは呼ばない。矛盾した成功・拒否、元値の後続変更を反証した。MCP全56件、AI Adapter全29件、CROS全33件と書式・型・LintはPass、Fail／Skip／取消0。Workbench全33件とBuildは相関是正前候補でPassしており、是正後の利用側回帰と独立再レビューは未完了である。本番Launcher・耐久Store Remote接続・失効全母集合・入口比較・旧REST撤去はこの局所結果で閉じない。

是正後Workbench全33件、Build・書式・型・LintもPass、Fail／Skip／取消0で終了した。実装再レビュー指摘0と品質Minor1（拒否反例二つの原因混在）を統合し、二Snapshotの改訂だけを一致させ、操作不一致と対象不存在を独立して反証した。Source・正常Case・QA IDは不変。最終静的確認、局所3件とMCP全56件はPass、両観点の限定再確認も指摘0。Profile管理のMCP Adapter接続を限定完了とする。CROS／MCPの公開Launcher構成、WorkbenchのRemote切替、Credential非秘密管理、設定分離と旧REST／Shared Host撤去は未完了である。巨大実行ログは保存せず、再実行可能なPackage試験と対象差分へ根拠を集約する。

### 非秘密Credential管理のMCP接続 — 着手前照合

この着手前案は後続の人間判断（§11）により停止した。Source編集・試験追加は未実施であり、旧CROS Owner前提の確認を移管後の実装許可・完成根拠へ流用しない。三操作の保持義務は新Owner計画へ引き継ぐ。

基準Commitは`2f398f0a`。変更分類は承認済み二Surface再編内の既存能力接続である。MCP詳細設計§3.3の一覧・Grant変更・失効を既存CROS関数へ一回だけ直接委譲する。Request Resolverが現在Credentialを認証し、systemAdminの場合だけ三Toolを公開する。管理操作はContent Exposureを読まず、Profile名から管理権限を生成しない。発行・rotation・Host回復、Registry保存形式、Content認可、旧REST、公開Launcherは変更しない。追加State／Lock／任意結果Portや結果防御Frameworkは作らない。

正常管理、非管理者非開示、自己demote／失効の次Request反映、未知対象、不正field／型／Proxy／accessor、publish競合・例外、処置前取消と採用後取消を確認する。取消・応答故障で保存を巻き戻さず、追加inspect・publish・自動再試行を行わない。発火例は現在systemAdmin、非発火例は有効Developer、境界例は自己権限変更、判定不能例はRegistry例外であり、それぞれ三操作公開、Tool非公開、次Request反映、内部故障非開示へ閉じる。

着手前の実装・品質確認では、既存Owner再利用と三Toolの閉じた入力へ整合を確認する。Credential操作全体はQA-000007の`RFD-ST-003`、局所HTTP認可接続は`RFD-IT-013`、入力・故障・取消はQA-000009の`EST-IT-002`へ対応する。IT結果をST全体の成立へ流用せず、Local／Remote本番Launcher、耐久Store、Workbench移管と秘密発行は未完了として維持する。固定差分の実装・品質の独立レビューと直接文書伝播を行い、準拠基準・公開訴求・Release判断は変更しないため準拠監査・市場探索・署名実E2Eは行わない。

### Runtime活動の共通OwnerとMCP接続 — 着手前照合

次の固定候補は、既存HTTPの活動検査をCROS `activity/validate.ts`へ、許可Project選択・Reader呼出し・結果検査を`activity/read.ts`へ移す。新MCP `crdd.get_runtime_activity`は設計済みprojectId／cursor／limit契約だけを搬送し、一覧とRoutingを同時接続する。現在Requestで解決した許可集合だけをReaderへ渡し、非許可はReader零回、Reader不在・故障・不正結果を空成功にしない。既存Readerは取消Signalを持たないためPromise競争を追加せず、取消前は呼ばず、開始後はReader完了をjoinしてから取消応答へ戻す。Reader自体の中断・実Provider取消を保証しない。新State／Frameworkを作らず、旧REST・本番Launcher・Workbench切替は代替接続完了まで維持する。Source境界の既存回帰、新Toolの入力／結果／非開示／待機取消反例と独立レビューで確認する。

活動Toolの初回回帰は51件Pass・2件Failで、任意cursor／limitを必須扱いした入力Snapshotを検出した。既存plain-data取得と明示した許可field検査へ是正し、試験コードの型指摘も訂正した。独立レビューはReader由来Objectの検査後変更・Proxyによる余剰情報透過と、取消joinを入力拒否義務へ混在させた問題を検出した。CROSに新Frameworkを作らず既存Domain Modelのplain-data SnapshotとOrchestratorのProjection copyを利用し、所有済みの固定結果だけを公開する。Proxy／accessor非実行、primitive語彙、nested余剰値、元Object変更の非透過を反証する。取消joinは導出元付き`EST-IT-014`へ分離し、HeaderとSymbolへ接続した。初回Lintの非null断言一件と、再レビューの表空行・Event Header二点も限定是正した。

最終Runtime候補のCROS全33件、MCP全53件、Workbench全33件と各書式・型・Lint、Workbench BuildはPass、Fail／Skip／取消0。両独立再レビューは指摘0で、元結果の暗黙文字列化と検査後透過を許容していない。全体Checkerは既知と同じ3,038件で未合格であり、この局所成功で解消しない。公開Launcher、Workbench本番MCP接続、Profile管理四Tool、旧REST撤去、実Reader取消・公開Process終端と実Providerは未完了である。実Provider、Docker起動、秘密鍵・署名操作は行っていない。

限定移管と局所回帰は成立しているが、Package全体の完了は未確定である。二つの読取り専用確認を統合し、以下を全数追跡する。CROSの採否待ちを理由に独立した是正を停止せず、後半の実行系大改修も前倒ししない。

| 対象 | 不足と最小処置 | 保持する条件・確認方法 | 現在状態 |
|---|---|---|---|
| Domain ModelのTopic／Meeting保存 | rename後のLock解放失敗を上位の入力不正・Effect 0へ丸める経路を除く。保存Ownerから一次失敗とcleanup結果を分離して搬送する | 正常CRUD・Revision・Relationは不変。rename後close／unlink故障と実ファイル・公開結果の相関を局所試験する。汎用Recovery Frameworkを追加しない | 一次失敗／cleanup分離、MCP／Workbenchの誤変換、部分write・一回読戻し・静的親link拒否は局所是正済み。実Process競合等の保存全体保証は次行で未完了を維持 |
| Topic／Meetingの保存境界 | 親Directoryのlink経由を拒否し、保存確定・読戻しの観測を接続する | Root外書込み禁止、保存形式・ID・認可Ownerは不変。親link・途中置換・読戻し失敗・実Process競合を反証する | 通常保存後の一回読戻し、部分write失敗、静的親link拒否と取得順固定の協調Writer実Process競合は確認済み。非協調Processの親差替え防止は判断待ち。電源断耐久性は人間判断により今回対象外 |
| Version Control公開入口 | 跨Packageの実体Path importを既存Root exportへ接続し、閉包試験へ禁止例を追加する | 新API・中継Fileは作らない。署名閉包のPath文字列とimportを区別する | 既知Consumer集合の接続・閉包確認は完了。固定47件と独立レビュー指摘0。Coordinator配布Suiteの試験側旧Path追従も133件・独立レビュー指摘0で確認済み。Coordinator全Package完成ではない |
| 現在の設計・Header | Domainの廃止済み入口、AI Adapterの旧配置参照、純粋計画のEffect記載、EI WriterのEffect・排他記載を実体へ合わせる | 関数本文・公開結果・Authorityは不変。書式・型・Lintと限定独立確認を行う | 訂正済み。限定独立確認は指摘0 |
| AI Adapter純粋試験3Suite | Codex／Claudeの構造化結果とBilling試験を実装Ownerへ移し、Symbol／Catalog／回帰入口を接続する | 14 caseの拒否例・Oracleを保持する。Coordinator結合試験は一括移管しない | 移管済み。14 case本文・Oracle不変、Package回帰27件と関連Consumer34件を確認 |
| 上記3SuiteのQA対応 | 現在のRCM-UT-016／AIT-UT-005はProvider結果／Billingの検証意味と一致しない。Canonicalから該当義務を再照合する | 物理移動を理由にQAの意味を改変しない。正しいLocal Itemへの接続を確定してから全体Passを評価する | ERB-UT-032／033へ訂正。移管と追加容量試験の限定独立レビューは指摘0。Codexの16KiB実入力境界を観測し、28件の回帰はPass |
| Topic／Meeting操作試験のQA対応 | Reader専用のCPR-IT-008へ更新試験が混在していた。保存操作はCPR-IT-010、保存例外はCPR-IT-011、公開故障応答はCPR-IT-012へ分離する | Readerの正本Effect 0は維持し、詳細設計§9.1・SPEC-000013、Suite Header、SymbolとCatalogを接続する | QA接続を訂正し、両種別のRepository／公開CRUDと協調Writer競合を確認済み。公開面の全操作母集合、Remote故障・投影再読取り・実OS cleanup全体の未評価は保持する |
| Source／Symbol閉包 | 単純Path照合の候補を、代表入口への集約登録と個別責務の方針へ照合する | Path差を直ちに欠落と断定しない。実体・公開helperの対応で判定する | 現行TS候補10FileとJSON設定1Fileを再集計し、全候補に代表実装・内部補助・配布設定の処置を照合。下記対応を参照。個別条件の試験網羅や全Package完成を意味しない |

実OS fixture、Coverage計測、新Build／署名閉包、実Provider・Docker、ST／UATと人間受入は未評価として後続の実境界確認へ接続する。局所回帰や安全な拒否を上位保証の完成へ昇格しない。過去Evidenceは当時の条件のまま保持する。

今回の参照・Header訂正後、Domain Model 106件、Execution Intelligence 82件、AI Adapter 13件、Workbench Server 33件、Version ControlのConsumer閉包12件は全件Pass、Skip／Fail 0。五Packageの書式・型・LintはPass。既知Consumer集合へ実利用側2件を追加し、厳密集合比較は維持した。限定独立レビューは指摘0。これらは上表の未是正の保存保証・QA対応を満たす根拠ではない。実Provider依頼、Docker操作、認証・署名・Release操作は行っていない。

### 保存例外の局所是正と全体Checker再確認

MCP公開応答の次段階では、明示Schema拒否と保存境界の内部故障を分離する。ID書式・Revision・limit・states件数の公開Schemaを前検査へ同期し、Query／CursorはDomainの既知一覧拒否3理由だけをlist呼出しに限定して対応付ける。書込みで同じ理由の例外が出ても内部故障とし、例外本文・秘密値・Pathを公開しない。既存MCP操作3件はReader項目008から010へ、新故障試験は012へ接続する。Workbench、Remote失敗、投影再読取りと実OS cleanupは未評価として後続へ保持する。

独立レビューで参照IDと不正Markdownの拒否が内部故障へ変わる反例を確認し、固定参照ID Schemaと既存Domain Parserの配送前検証を追加した。owner／none参照と正常結果は不変。QA導出表・条件表、File／共用Helperの012接続も同期する。MCP回帰51件と書式・型・LintはPass、最終追加反例の局所4件もPass。保存後の例外は実更新済みRevisionを保持した注入で検証しており、実OS故障・rollback・cleanupの保証へ昇格しない。

是正後のSource・品質／文書の独立確認は残指摘0。最終Header更新後も書式・型・Lintと局所4件はPass。全体Checkerは3025件で未合格（前回3026件から今回SuiteのCatalog Owner不一致1件を解消）。変更したMCP詳細設計、QA定義、試験Pathそのものの新指摘はないが、CHG本文から旧MCP試験Pathへの既知broken-linkは残る。未完了のWorkbench応答・保存Owner保証・横断移管整合を後続で閉じる。

### Workbenchの保存故障応答

入力評価後、Local操作／Remote要求の直前にだけ配送段階を記録する。前段拒否は既存400、配送以降の内部故障は固定500へ分離し、正常blocked結果の303は維持する。自己生成の空Topic保存先を通常fileへ変え、入力不正と保存開始時故障を対比する。通常Topic CRUDへ改訂競合・削除確認の反例も接続する。Listenerの終了は新しいTCP接続で確認し、HTTP keep-aliveの既存接続切断とは分ける。試験Root回収は観測assertionが失敗してもfinallyで実行する。

この局所処置はRemote故障、Workbench保存後故障・投影再読取り、実OS保存確定・cleanup全体の完成ではない。Workbench全回帰33件、局所2件、書式・型・LintはPass。Sourceと品質／文書の独立レビューは指摘0。全体Checkerは3024件で未合格であり、今回SuiteのCatalog Owner不一致1件を解消した。Workbenchの別Suiteに残る既知Owner不一致3件は未是正として区別する。実Provider、Docker、署名、実Browser操作の検証根拠にはしない。

### Topic／Meeting保存Ownerの失敗分離

既存同期Lockと短命Fileの形式を維持し、一次処理とcleanupの失敗を標準AggregateErrorで分離する。close失敗でもunlinkを試み、rename失敗後の短命Fileはexact unlinkのENOENTだけを不存在として扱う。新Recovery／Kernel Lock Frameworkは導入しない。Repository SuiteをReader用008から正常010・故障011へ訂正し、旧Reader Oracleは維持する。独立レビュー2指摘は試験所属RepositoryへのRoot固定と分析の失敗構造記述へ是正し、再レビューは両方指摘0。訂正前の全回帰108件と、訂正後の局所3件・書式・型・LintのPassを区別する。最終全体Checkerは3024件で未合格、今回の変更Pathへの指摘0。親link、読戻し、write自体の部分失敗、耐久性、実Process競合は未完了であり、保存全体完成とは表示しない。注入closeは実Handleを閉じた後の失敗報告で、実OS close失敗時のHandle回収を証明しない。実Provider・Docker・認証・署名・公開操作は行っていない。

### 改名後の試験Owner追従

MCP 9件・Workbench 3件のCatalog Ownerだけを現行Packageへ訂正した。全14登録についてSymbol所属、実Pathと実File存在を照合し、JSON解析・差分確認はPass、限定独立確認は指摘0。ID、Oracle、実行環境と必須性は不変で、実試験やCROS REST／Sharedの廃止判断を代替しない。

### 保存保証の未決判断

2026-10-09の人間判断: Topic／Meetingの保存完了は通常の保存＋内容・ID・改訂の読戻し一致までとする。電源断耐久性は今回の保証へ含めない。非協調Processの親Directory差替え防止の範囲は別の判断待ちであり、この決定から免除しない。

通常の保存完了＋読戻し確認の範囲は上記判断で確定した。静的link拒否＋協調Writer競合と非協調Processの親Directory差替え防止を分け、後者の必要範囲のみ人間へ確認中である。既存Path部品の事前／事後確認だけで競合置換防止・Root外Effect 0を主張しない。未回答を高い保証の採用や保証の免除へ読み替えず、独立した移管・試験整合を継続する。

Topic昇格・Meeting Outcome処置のcatchを純粋Markdown変換だけへ限定した。既存Repository契約へ更新前／実更新後の例外を注入し、両公開操作から同じ例外が伝播すること、実更新後のRevisionと状態を保持することを確認した。不正変換はblocked・既存理由・Effect 0と更新0回を別に確認した。新fault試験はVCS Rootを検証し、Repository-local `.crdd/tests`の非link親と自己生成領域だけを使用する。

固定候補のDomain Model回帰107件、書式・型・LintはPass。実装・品質／文書の二つの独立レビューは是正後指摘0。QAの010は部分検証であり、保存Ownerの一次失敗／cleanup、読戻し、親link、MCP／Workbenchの内部故障応答は未完了のまま保持する。

全体Checkerは未合格。2026-10-09の実行では3026件（broken-link 3002、broken-anchor 5、Catalog Owner不一致14、verifies対象欠落3、Project Context契約1、UI／SPEC Detail下流Coverage 1）を検出した。今回更新したDomain詳細設計、QA-000005、Detail分析、Domain Symbolと操作試験Pathへの指摘は0だが、これを全体完成の根拠にはしない。現在文書・Registryの移管不整合と、変更禁止の過去Evidenceに残る当時の参照を区別して後続処置を決める。

### AI Adapter純粋試験と品質接続の移管

Claude結果9件、Codex結果3件、課金方針2件を実装Ownerの試験Directoryへ移管した。コメント・import移設を除く本文・Oracleは基準Commit `5c33ba70`と完全一致し、Runtime Source、安定Symbol／Catalog IDと過去Evidenceは変更していない。ARCH-000004／000015の結果解釈からERB-UT-032、ARCH-000010と既存Subscription方針からERB-UT-033へ導出し、旧Domain Outcome／Trust軸への誤接続を解消した。

独立レビュー3指摘はcoverage入口の旧Path、15 Headerの外部境界表記、容量契約値と実拒否観測の混同を是正し、再レビューは両観点とも指摘0。AI Adapterの書式・型・Lintと27件、Coordinator関連Consumerの限定strict型・書式・Lintと34件はPass、Skip／Fail 0。Coordinator全体checkは既存Checker試験の整形1件で停止、全体型検査は既知Recovery二Fileの18件で未合格。実Provider・Docker・認証・署名・費用・取消／cleanup・16KiB実逸脱拒否の成立をこの移管結果から主張しない。coverage入口の6試験Pathは実在を確認し、未実行の他試験をPassへ計上しない。

### Sourceと代表Symbolの候補照合

四Packageの`src/`とManifest Pathを再比較し、TS候補10FileとJSON設定1Fileを確認した。以前の8件を固定母集団にせず、現行実体を基準に再集計した。各HeaderのARCH、公開入口、内部importとTestの`verifies`を読取り専用で照合し、次の処置を確定した。個別File登録を増やすだけの変更は行わない。

| Package／候補Path | 現在の登録・担当範囲 | 処置 |
|---|---|---|
| Version Control `repository/revision.ts` | `version-control.public-api`のRoot明示exportと登録済みGit Revision Adapterへ接続 | Revision観測・Format検査を代表範囲として維持 |
| Domain Model `artifact/graph.ts`、`artifact/validate-schema.ts`、`artifact/parse-markdown.ts` | `crdd-domain-library.artifact-entry`とARCH-000008の`crdd-domain-library.source.src.index`。公開境界試験は双方を参照し実操作を検証 | 各実体をRootの代表範囲として維持 |
| Domain Model `reality-traceability/discover.ts` | `crdd-domain-library.reality-traceability-entry`からRoot公開。公開境界試験へ接続 | Discoveryを代表範囲として維持 |
| Domain Model `reality-traceability/issue.ts`、`reality-traceability/annotations.ts` | 登録済みGraph／Manifest検査とDiscoveryが使用する非公開の共通処理 | 内部補助として代表登録を維持 |
| Execution Intelligence `input/plain-data-snapshot.ts` | 登録済みEvent・評価・Store・投影・時刻由来分類が使用する入力防御 | 内部補助として維持。新公開Symbolは作らない |
| AI Adapter `profile/types.ts` | 登録済みProfile実行照合・Eligibilityが利用し、Rootが実行Identity型を公開 | 型契約の代表範囲として維持 |
| AI Adapter `codex/advice-distribution.ts` | Root公開と登録済み助言Commandが固定配布Identity・初期化条件を利用 | Command代表の担当範囲として維持 |
| AI Adapter `catalog/default-ai-profile-catalog.json` | 登録済みCatalog Resolverが静的import。詳細設計§5の配布設定・Schema・署名閉包対象 | TS Sourceではなく配布設定として維持 |

この照合で個別登録の実欠落は検出していない。到達・担当範囲の確認を、全正常・拒否・故障条件の試験済みや配布・署名の実検証済みへ昇格しない。安定ID、Source、公開集合と正方向Relationは変更していない。

### Codex容量境界の実入力確認

既存normalizerは変更せず、単一exact JSONへ有効なASCII空白を加えた16,383／16,384／16,385 bytesの入力を渡す。上限以下の受理と超過拒否、正規化値、生出力非公開を確認した。追加後のAI Adapter全28件と書式・型・LintはPass、Skip／Fail 0。移管14 Caseの当時の限界は保持し、追加試験を新しい成立根拠として区別する。Claudeの容量契約、実Process出力制限、費用・取消・cleanupの成立には流用しない。

Source対応表と容量試験・正本追従の固定5Fileは独立した二観点の確認で指摘0。全体Checkerは3,041件で未合格（broken-link 3,032、broken-anchor 4、Project Context契約1、verifies対象欠落3、UI／SPEC Detail下流Coverage 1）。今回の更新5Pathへの指摘は0で、過去CHGの旧試験Path参照は当時のEvidenceとして改名しない。verifies欠落3件はCoordinatorの旧Runtime Data Resolver参照であり、現在のDomain保存責務への対応を別途照合する。

### 通常保存後の読戻し確認

登録・更新のrename後、既存Record Lockを保持したまま保存先を一回読み直す。同じ読取りから得たUTF-8 bytes、ID、改訂とProject IDを保存予定値へ照合し、欠落・読取り失敗・解析失敗・不一致は完了として返さない。保存済み正本の自動rollback、読戻し再試行、新しいLock／Recoveryは追加しない。人間が採用した通常保存＋読戻しの範囲に限定し、電源断耐久性は保証しない。

Topic／Meetingと登録／更新の4経路について、正常と9故障分類の40組合せを一つの契約試験へ接続した。実bytes・改訂の保持、一次失敗とcleanup併発、Lock保持、読取り回数、不正UTF-8とmock復元・試験Root回収を確認する。既存close故障注入は所有Lock descriptorだけへ限定し、読戻しで使うFilesystem内部descriptorと混同しない。Domain Model全109件、MCP全51件、Workbench全33件と各Packageの書式・型・LintはPass、Skip／Fail 0。これは実Provider・Docker・実Browser・実OS故障や保存全体保証の完成根拠ではない。

独立レビューのSource指摘0と品質Minor2件を統合し、Meeting helperの正常／異常TraceとQA011の登録・更新対象範囲だけを訂正した。実装・40組合せ・assertion・ID・Oracleは不変で、両観点の限定再レビューは指摘0。訂正後の書式・型・Lintと局所4CaseもPass。親link、write自体の部分失敗、実Process競合と非協調Processの親差替え範囲は引き続き未完了として扱う。

### 旧Runtime Data検証参照の是正

Coordinatorの三Suiteに残る旧Resolver参照を、実際の試験本文とOracleに基づいて処置する。鍵生成Suiteは保存領域をfixture準備に使うだけで保存保証を検証しないため、当該関係を削除する。Orchestrator Compositionと開発Provider測定Suiteは、実生成したDomainの停止Errorから理由・Effect・cleanup・retry・回復参照を保持する公開投影を検証するため、`domain-model.runtime-area-result`へ接続する。Reader／Writerへ機械置換せず、Source、試験本文、QA ID、他の関係と過去Evidenceは変更しない。静的確認と独立レビューが完了するまで、是正済みの検証結果とは扱わない。

JSON解析・差分確認と旧参照0／新参照2の照合はPass。固定差分の実装・品質の独立レビューは双方指摘0。全体Checkerは3,038件で未合格だが、検証参照対象の欠落3件は解消した。残る内訳はbroken-link 3,032、broken-anchor 4、Project Context契約1、UI／SPEC Detail下流Coverage 1。試験本文とRuntimeは不変で、このMetadata是正のための実Provider・鍵生成・署名試験は実行していない。

### 保存途中の部分書込み失敗

短命Fileを排他的openで所有確定してから同じdescriptorへ書込み、close確認後だけrenameする。open失敗は他者Fileに触れず、write・close・rename失敗では所有する短命Fileだけを回収する。一次失敗、undefined例外、close／unlink併発を既存AggregateErrorへ保持し、新Recovery・Lock・再試行は追加しない。24組合せの反証を既存QA011へ接続する。親link、実Process競合、実OS close失敗と電源断耐久性はこの是正の成立根拠に含めない。実測・独立レビューは未完了である。

実測結果: Domain Modelの書式・型・Lintと全110件、MCPの同静的確認と全51件、WorkbenchのBuild・同静的確認と全33件はPass、Skip／Fail 0。最初の追加試験はEEXIST注入の内部open再帰で失敗したため、他者Fileの準備を注入外のdescriptorで行うよう訂正し、静的確認から全回帰を再実行した。Runtimeの不足を注入の修正で隠したものではない。独立Sourceレビュー指摘0と品質Minor1を統合し、Detail分析表への直接伝播だけを是正した。両観点の再確認は指摘0。既存の40読戻し組合せと正常・rename故障Oracleは維持した。今回の処置で保存全体や1〜8全体を完了とは扱わない。

### 静的な保存先親linkの拒否

既存Adapter内のDirectory観測をCRUD・一覧・CHG参照へ接続し、recursive mkdirを一階層作成へ置換する。Root・種別親・Record親のlink／junction・通常Fileを拒否し、ENOENTだけをmissingとする。Lock・短命File・rename・削除・cleanupの前に該当chainを確認し、新Lock・Recovery・公開Capabilityは作らない。観測直後の非協調Process置換はこの変更では防止せず、必要範囲の人間判断待ちを維持する。固定候補の回帰・独立確認は未完了である。

1〜5の再照合では、Version ControlのRoot公開入口への全Consumer追従が実未完了と判明した。代表3件の是正を全Consumer完成へ拡張せず、この親link処置後に実importと配布閉包のPath文字列を分類して全利用側を接続する。Domainの協調Writer実Process競合も残る。Execution IntelligenceとAI Adapterの追加必須Source是正は今回特定しておらず、Platformの実OS専用fixture・新Build／署名は後半の実境界に対応付ける。CROS Packageの採否待ちは段階6実装の停止条件であり、他の独立した残件を止める理由にはしない。

固定候補の実測結果: Domain Model全112件、MCP全51件、Workbench全33件と各Packageの書式・型・Lint、Workbench BuildはPass、Fail／Skip 0。実装と品質の独立レビューは双方指摘0。初回局所試験では既存published故障試験のcause不存在assertionが一度失敗したが、以降の局所・全回帰では再現せず、原因未確定として保持する。新fixtureのDirectory改名後junction作成はWindowsでEBUSYとなったため、初期状態から静的linkを置くfixtureへ訂正した。Productionの再試行やOracle緩和は行っていない。この結果は非協調Processの差替え防止、実OS close故障、電源断耐久性、実Provider／Docker／署名の根拠ではない。

### Version Control全利用側の公開入口接続 — 着手前照合

変更分類は既存公開契約への内部接続是正とする。基準はCommit `6ace24bb`。読取り専用確認で、本番／scriptsの40FileとTemplate入口1Fileの実importは既存Root exportだけへ切替可能と確認した。関数本文、Git引数・結果、公開Symbol集合、鍵・署名Authority、過去Evidenceは変更しない。署名scriptの二SymbolをRootへ移すため、保護import検査の対応表だけを同時追従する。実行primitive・実体Sourceの観測Path文字列は別責務であり置換しない。

試験側のdeep importは15File。Root非公開Symbolを直接検証する三Suiteは内部Adapter試験として維持し、残る公開契約の利用をRootへ接続する。新APIや公開中継は作らない。Consumer閉包試験はPackage外の実importを全数走査し、deep import、動的import、Namespace、再exportを未使用に畳まない反例へ補強する。用途別集合の厳密照合は維持する。Rootの静的依存閉包拡大は保護経路の静的契約と影響Packageの型・回帰で確認し、実署名・配布成立は未評価として分ける。

必須確認は実装と品質／伝播の独立レビュー、Consumer閉包・保護署名経路の契約試験、影響Packageの静的確認と関連回帰。規則自体・準拠基準・公開Surfaceを変更しないため、この接続是正に新しい準拠監査や実Provider／Docker／署名は要求しない。新しい公開APIが必要、関数本文や署名保証を変更する必要が判明した場合は実装を止め再整理する。

本番／scripts／Templateの41Fileと公開契約を使う12試験FileをRootへ接続した。初回独立レビューで検出した生成子Processの6参照とOrchestrator mockの2参照も接続した。閉包Helperは局所トークン走査でコメント・文字列と宣言を区別し、同一行、コメント付き宣言、backtickのliteral動的importも拒否する。任意計算specifierや任意生成Sourceの完全解決は保証しない。既知子Process六経路とmockの旧参照は既存Caseで個別照合し、内部Adapter三Suiteの非公開Symbolと実体観測Pathは保持した。

固定候補のVersion Control全47件と書式・型・LintはPass。入口変更後のExecution Intelligence全82件、AI Adapter全28件、Visual Preview全10件、Workbench全33件と各静的確認、Workbench BuildはPass。Orchestratorの静的確認と回復接続mockの1件もPass。Coordinatorの上位受理Reader試験は、初回のmodule mock用起動flag不足と、以前の移管で残った廃止済みStorage／Task二Pathを訂正して1件Pass。Host Windows保存scenarioはこの実行から除外しており、六子Process経路の実環境成立とは扱わない。

Coordinator全体checkは既知Checker整形1件で停止し、型検査も既知Recovery二Fileの18件で未合格。LintはExit 0（参考情報54件）。署名保護flowの局所三件は1件Pass・2件Failで、`compilePlatformProvisionerManifestPayloadCandidate`の保護import対応不足を検出した。現在入力と、基準版のVC二importだけ新表へ正規化した比較入力は同じ理由で停止する。この比較は基準版全体の実試験ではなく、今回の入口変更以外にも不足が存在する切り分けである。既存署名保証を緩めず、未解消として後続へ保持する。初回レビュー結果を最終版へ流用せず、修正後の独立再レビューは未完了とする。実Provider、Docker操作、秘密鍵・実署名・公開は行っていない。

57Fileの再レビューは品質指摘0、実装側にテンプレート式内literal動的importの見落とし1件が残った。両観点で是正方針を照合し、閉包Helperだけをテンプレート本文と式へ分けた局所走査に変更した。nested式・object式内のimport拒否と、本文・エスケープ・式内文字列／コメントの非発火を既存Caseへ追加する。正規表現本文のbacktickを誤認した初回回帰は45件Pass・2件Failであり、正規表現literalと除算の対照を追加して再実行する。Source全構文を解決する汎用parserではなく、任意計算specifier・任意生成Sourceの保証は追加しない。Runtime、公開集合、利用側Path、保護map、QA IDは不変。静的確認と最終回帰・修正後再レビューの結果は完了後に別記する。

是正後のVersion Controlは書式・型・Lintと全47件Pass、Fail／Skip 0。新しい固定候補の独立再レビューへ渡す。他Packageの結果は各入力が不変の範囲に限って保持し、Coordinator全体静的・署名経路・Host Windows六経路の残件は解消扱いにしない。

固定57Fileの最終独立再レビューは実装・品質とも指摘0。Version Control公開入口への今回の利用側接続是正は限定範囲で完了とする。段階1〜5全体の完了ではない。次の署名局所是正は、現行`manifest-trust.ts`に存在する二Symbolに対し、保護import表が廃止済み`trust-core.ts`を要求する第一段階改名の追従漏れである。現行Sourceを確認し、署名保証を維持した別の固定候補として処置する。

### 署名保護import表の改名追従 — 着手前照合

基準Commitは`9b99331f`。変更分類は第一段階改名の接続漏れ是正であり、保護表のimport元だけを現行`manifest-trust.ts`へ同期する。二Symbolの必須性、同名decoy・alias・欠落・重複・事前Effectの拒否、署名入力とAuthorityは維持する。正常Source受理、旧Pathへ戻した入力の拒否、既存保護flow反例を確認する。実鍵・署名・Docker・Providerは使わず、Source契約試験と静的確認、実装／品質の限定独立レビューで確認する。新しい保証や許可集合の拡大が必要なら停止し、単純なPath同期へ混ぜない。

保護import表の一Pathを同期し、既存Caseへ旧Path拒否の反例を追加した。変更二Sourceの書式・Lint、production strict型検査はPass。署名保護flow局所三件は3件Pass、Fail／Skip 0。関連Suite全体は実行中で、独立レビューとともに完了未確認。既知Recovery試験の型不足やCoordinator全体静的の未合格は解消主張に含めない。

限定した三Fileの独立レビューは実装・品質とも指摘0。関連Suite全体の実行結果は引き続き確認中であり、局所3件の成功を全体へ拡張しない。

関連Suite全体はExit 1で終了した。今回対象の署名保護三件は全件成功したが、別Caseに残る旧`host-runtime`／`docker-runtime`とOrchestrator `src/core`等の参照でENOENTを検出し、意図した拒否phaseの不一致も残った。全SuiteをPassとは扱わず、試験側移管漏れとその他停止原因を分類して後続是正する。局所三件と独立レビュー指摘0を根拠に、保護import表の改名追従だけを限定完了とする。実署名・配布・Coordinator全体完成ではない。

### Topic／Meetingの正常CRUDと協調Writer競合 — 着手前照合

変更対象は既存`CPR-IT-010`の正常CRUD網羅と保存排他の実Process観測で、保存Runtimeは変更しない。Topic／Meeting双方の登録・一覧・取得・更新・期待改訂拒否・確認なし削除拒否・確認付き削除を実bytesと改訂へ接続する。新しいfixtureは検証済みRepository-local `.crdd/tests`へ限定し、mock・子Processを回収してRoot不存在を確認する。既存Relation付き削除・変換・Outcome・昇格の試験を保持し、Repository CRUDだけで公開操作全体の完成を主張しない。

実Process競合は第一子がexact既存Lockを実openした後に自己生成readyを発行し、第二子の更新拒否と終了・正本不変を確認してから第一子を解放する。spawn直後にerror／closeを観測し、保留・joinには期限を設ける。fixtureがdescriptorを返す前に失敗した場合は自身で回収する。finallyでは所有子のclose確認後だけRootを回収し、join不能やcleanup併発を一次失敗で隠さない。通常の協調Writer更新を対象とし、異常死回復、同時open勝者選択、非協調親差替え、電源断保証へ拡張しない。新Lock、Recovery、公開APIや共有Stateは作らない。

正常CRUDの既存Caseを両種別の全操作へ補強し、Repository-local fixtureへ切り替えた。Domain Model全112件と書式・型・LintはPass、Fail／Skip 0。保存Runtimeは不変で、協調Writer実Process競合はこのCaseでは未実装・未確認。QA-000005へ通常経路の追加観測と限界を直接接続し、限定独立レビューへ渡す。

両独立レビューは同一原因のMinor1を返した。古改訂入力が保存済み本文と同じでは誤保存を検出できないため、有効な異bytes候補を渡し、拒否直後の正本bytesと改訂保持を両種別でassertする。全結果統合と両観点の是正方針照合後に限定修正し、Runtime・QA ID・正常更新・Relation解消と削除Oracleは保持する。

Oracle修正後は書式・型・LintとRepository Suite全7件Pass、Fail／Skip 0。先の112件全回帰の対象と、この修正後局所再実行の対象を区別する。その他Package入力・Runtimeは不変で、固定候補の限定再レビューで是正解消を確認する。

修正後の限定再レビューは両観点とも指摘0で、Repository正常CRUDの補強は確認済み。協調Writer実Process競合と公開操作母集合の網羅は引き続き残件である。

### 配布閉包試験の旧Path追従 — 着手前照合

基準Commitは`0b2b49a6`。関連Suite全体で発見した試験側の参照漏れを処置する。`host-runtime`は`host-execution`、kernel-lock・子entrypoint・Lock supervisorは現行Fileへ、`docker-runtime`は`docker-execution`のowned-process／command-effectsへ、CLI lifecycleは現行非internal Fileへ対応させる。Orchestratorのintegration-resultと未使用sibling fixtureは現行candidate Folderへ置く。架空攻撃File名、状態・reason、役割IDと既存拒否Oracleは維持し、廃止Folderをわざわざ作って試験を通さない。

実行能力伝播反例の局所再現では、dispatchの正本を置換できず、意図した変異が未発火であった。現行Sourceと空白だけが異なるfrom／toを同期し、既存の変異発火assertion・拒否phaseを保持する。Runtime・公開API・Authorityは変更しない。Source対応と静的確認、速い伝播反例、実fixture利用側を確認した後に関連Suite全体を再実行する。実装と品質の限定独立レビューを行い、別の契約不足があればPath同期へ混ぜず分類する。実Provider・Docker・実鍵・実署名は使わない。

旧Path同期後の伝播反例・内部lifecycle反例は局所2件Pass。固定候補の実装・品質レビューは同じ原因のMinor2件を返した。攻撃側と許可対照の相対importが実fixtureへ接続していないため、それぞれ実Docker Process OwnerとCoordinator子入口へ同期する。duplicate_path置換には書込み直後の発火assertionを追加する。両結果を統合してから限定是正し、Runtime・許可集合・既存拒否理由とcandidate対照は維持する。修正前候補の全Suiteは是正前に停止したため、完走・全体Passの根拠には使用しない。是正後は該当3ケースを先に確認し、新しい固定候補で再レビューと全Suiteを行う。

是正後の書式・Lint、差分空白確認はPass。duplicate_pathの変異発火と拒否、実Ownerを指すsibling importの直接拒否、実Coordinator wrapperを指す許可対照を含む該当3ケースは3件Pass、Fail／Skip 0。局所成功は配布Suite全体や実署名の成立ではなく、全Suiteと修正後独立再レビューは未完了である。

配布閉包試験の修正後独立再レビューは両観点とも指摘0。全Suiteは引き続き実行中で、終了前に全体Passへ更新しない。

修正後の配布Filesystem Suiteは全133件Pass、Fail／Skip 0で終了した。実行入力のRuntime Sourceは不変で、実鍵・実署名・Provider・Docker操作は行っていない。今回の試験側移管追従は独立レビュー指摘0と全Suite結果により限定完了とする。Coordinator全Packageの型・既知Recovery・Host実環境の未評価を、この結果で解消しない。

### Topic／Meeting協調Writerの実Process確認

既存の着手前条件を具体化し、固定ESM eval Sourceと固定import先、所有Root内の入力・結果Fileで実子Processを起動する。通常入口とevalで異なるargv位置は`slice(1)`へ固定した。第一子のexact Lock open後にreadyを発行し、第二子のcloseと拒否tuple、第一子保留と正本保持を確認してからreleaseする。子のclose、保存結果、改訂2／3、Lock・短命File不存在を共同確認する。Runtime・公開API・Lock形式は不変で、新Frameworkは作らない。

初回局所試験はfixtureのRepository子Root作成漏れで失敗した。実Operation開始前の不足であり、自己生成の空Rootを確認して回収した。Root作成とRepository構築をcleanup対象のtry内へ移し、書式・型・Lintと局所1件はPass。最終Oracleへstatus／reasonと後続更新後の短命File不存在を追加して全回帰・独立レビューへ渡す。取得順を固定した協調Writer以外の保証を追加しない。

追加後のDomain Model全113件と書式・型・LintはPass、Fail／Skip 0。実装・品質の独立レビューは同じMinor1件を返した。子hookがdescriptorを返す前の一次失敗にclose失敗が併発すると上書きするため、closeを一度だけ別tryへ置き、AggregateErrorのcauseに元失敗を保持する。両結果統合後に試験fixtureだけを是正し、Runtime・Lock形式・取得順・正常Oracleは維持する。実OS close失敗の回収保証へ拡張しない。

fixture是正後の書式・型・Lintと局所競合1件はPass、Fail／Skip 0。全113件は是正前候補の結果として区別し、修正後の限定再レビューへ渡す。実OS close失敗注入・非協調Writer・異常死は今回の確認対象外である。

是正後の実装・品質再レビューは両観点とも指摘0。取得順を固定した協調Writerの競合・正本保持・Lock解放・後続更新再利用の確認は限定完了とする。公開操作全母集合と非協調親差替えの未決範囲は解消主張に含めない。自己生成domain-writer Rootの残存0を確認した。

### Topic／Meeting公開CRUDの接続 — 着手前照合

基準Commitは`0b5ae212`。Repository正常CRUDと公開種別固定の既存Caseを照合すると、公開Topic／Meeting面からの通常update・改訂競合・確認なし／確認付きdeleteが未観測である。既存`CPR-IT-010`の同Caseを両公開操作へ拡張し、本文bytes・改訂・拒否Effect 0・削除後の取得／一覧と実体不存在を確認する。種別誤用・専用操作の非公開・既存検索／Relation／昇格／OutcomeのOracleは保持し、正本種別を生成時に固定するRuntimeは変更しない。新fixture Rootは検証済みRepository-local `.crdd/tests`へ限定し、finally回収を観測する。これは通常CRUDの公開接続であり、全公開操作母集合・実OS故障・非協調Writerの完成主張ではない。静的確認、局所とPackage回帰、実装・品質の限定独立レビューを行う。

初回確認は削除前確認の返却値に存在しないexistsを期待したため、型確認と局所試験が失敗した。実契約のrecord／relationPathsへ照合を訂正し、書式・型・Lintの成功後に局所1件を再実行してPass、Fail／Skip 0。Runtimeは不変で、自己生成Rootはfinallyで回収した。Package回帰と限定独立レビューは未完了である。

補強後のDomain全113件と書式・型・LintはPass、Fail／Skip 0。限定レビューは品質指摘0、実装Minor1件で、競合・確認なし削除・確認付き削除のstatusが未観測だった。全結果統合後、既存reason／Effectとblocked／blocked／completedを共同確認する3assertの追加を両観点へ照合して是正した。Runtime・入力・正本bytes・QA IDは不変。最終局所確認と限定再レビューの結果を別記する。

status相関追加後の書式・型・Lintと公開CRUD局所1件はPass、Fail／Skip 0。先の全113件と最終局所の対象を区別し、限定再レビューへ渡す。domain-public-crud Rootの残存0を確認した。

是正後の実装・品質の限定再レビューは両観点とも指摘0。status・reason・Effectと実bytes／改訂の相関を確認し、Runtime・入力・QA IDは不変である。通常公開CRUDの補強を限定完了とし、全公開操作母集合や非協調Process・実OS故障の未確認範囲は保持する。

最終status相関候補で`domain-model`の`npm test`を再実行し、書式・型・Lintと全113件がPass、Fail／Skip／取消0で終了した。これは今回の公開CRUD補強と既存Package回帰の結果であり、上記対象外の保証や実Provider・Docker・署名E2Eの成立を示さない。

## 11. Access Managementへの再編 — 2026-10-09の途中見直し

### 結論と変更境界

人間は独立`cros` Package維持の先の判断を変更し、認証・認可・権限管理を`access-management`へ再編する方向を提示した。CROSはRepository群と専門Capabilityが連携して成立する全体システムの概念とし、一Packageの名称と同一視しない。Package数削減ではなく、名前・配置から責務を予測できる構造を目的とする。本節はSource照合と移管計画であり、正式Architectureの反映・新Packageの実装・旧Packageの廃止は未完了である。

基準は`2f398f0a`。直前の非秘密Credential MCP接続は計画のみで停止し、Sourceへ追加していない。既に接続したProfile／活動MCPの現行能力を保持し、新Ownerへの追従と新しい検証を行う。旧維持判断と旧基準の独立レビューは履歴として残し、新構成の採用・完成判定へ流用しない。1〜5の確認済み範囲は撤回せず、Domainへの移管影響がある公開集合・型・Consumerだけを再確認する。段階9〜11の実行系大改修は前倒ししない。

### 現行全Fileと移管候補

現行`cros/src`の18 TS Fileと`bin/cros.ts`を列挙し、公開入口、実import、主要関数と利用側を照合した。候補先は現行命名規約に従い、`src/<責務>/<file>.ts`までとする。子index・再export専用File、新しい空Folderは追加しない。以下の候補名は移管前のArchitecture／Quality照合で固定し、機械的な名前変更だけを完成としない。

| 現行Path（`40_Develop/cros/`起点） | 現在の実責務 | 処置・新Owner候補 | 保持するもの／追加確認 |
|---|---|---|---|
| `src/access/credential.ts` | Credential発行・認証・一覧・Grant変更・失効・rotation | `access-management/src/credential/operations.ts` | 明示Grant、管理とContentの分離、非秘密Metadata、inspect／publish競合。秘密発行はHost／Local限定 |
| `src/access/registry-file-adapter.ts` | Credential Registryの不変Revision保存 | `access-management/src/credential/file-store.ts` | 完全Snapshot検査、競合、現在OS Rootと保護条件。不必要な保存方式変更はしない |
| `src/access/recovery.ts` | 管理資格喪失時の計画・対象再照合・限定回復 | `access-management/src/recovery/operations.ts` | 同一回復Identity、管理者確認、Content Grant非発行。Docker回復や汎用Recoveryへ統合しない |
| `src/access/recovery-file-adapter.ts` | 回復prepare／settleの不変記録 | `access-management/src/recovery/file-store.ts` | 現行保存先・排他作成・flush／読戻し。履歴保持の変更は今回の改名へ混ぜない |
| `src/access/recovery-cli.ts` | Hostの対話回復操作 | `access-management/src/recovery/cli.ts` | 人間確認・秘密の一回表示・Remote非公開 |
| `bin/cros.ts` | 回復mode／OS Root入力・端末I/O | `access-management/bin/access-management.ts` | Package同名の主要入口。一つのbin。OS領域変更なし。公開コマンド名・環境名の移行は別に対応付ける |
| `src/access/resolve.ts` | 認証済みAccess→同一Exposure Snapshot→許可集合 | `access-management/src/access/resolve.ts` | Request一回観測、現在Credential、systemAdminからContent非生成 |
| `src/access/types.ts` | ExposureとRepositoryの同一観測型 | `access-management/src/access/types.ts` | DomainのContext型と認可Snapshotを混同しない。Domain→Access Management依存を作らない |
| `src/access/session-context.ts`（Credential／Session／Exposure／Repository解決） | Credential SnapshotとSession、Binding／改訂を使う認可 | `access-management/src/access/session.ts`／`resolve.ts`／`types.ts`へ責務分離 | 型と関数名を実責務へ合わせる。RepositoryのDomain情報と認可用Bindingを分け、必要な型だけRoot公開 |
| 同File（ContextItem／ContextPackage／createContextPackage） | 目的・Source・改訂・欠測を持つContext集約 | `domain-model/src/project-context/package.ts`候補 | restrictedの非開示は保持。認可判断をDomainへ移さず、認可済み情報だけ受ける |
| 同File（Handoff／resume、局所操作、AI行動計画） | Task相関・Authority照合、疑似局所更新、共通計画投影 | REVIEW。Context値はDomain候補、Task再開判断はOrchestrator候補、疑似操作は削除候補 | 現在は固有契約試験のみの利用を確認。ARCH-000009／015の義務と現行実Ownerへ照合してから処置。試験専用という理由だけでは削除しない |
| `src/federation/project.ts`（resolveAuthorizedRepositories） | Grant／Exposure／改訂の認可フィルタ | `access-management/src/access/resolve.ts` | 認可済みRepository集合を返す。Portfolio生成は行わない |
| 同File（createPortfolioProjection・3公開型） | Context Identity照合、Project集約、欠測・競合の投影 | `domain-model/src/project-context/portfolio.ts` | DomainはCredential／Sessionを入力にせず、認可済みDomain情報を入力にする。MCP／WorkbenchのPortfolio型も新Ownerへ追従 |
| `src/profile/administration.ts`（resolve） | systemAdminによるAI Profile管理可否 | `access-management/src/access/administration.ts`候補 | AI AdapterのCatalog管理実体を再実装しない。Content観測不要・非管理非開示 |
| 同File（parseMutation） | 閉じたMutation入力の検査 | AI Adapterの既存Profile管理責務へ統合候補 | operation／Revision／Profile語彙はAI Adapter、Transport envelopeはMCP。認可Packageへ業務入力Schemaを残さない |
| `src/activity/read.ts` | 許可集合のProject選択、Reader待機・結果検査 | 分離候補。対象認可はAccess Management、観測・結果契約はOrchestrator | 任意Repository探索禁止、unknown／欠測、Reader joinと取消限界を保持。Orchestratorの内部大改修はしない |
| `src/activity/types.ts` | Orchestrator投影・Runtime Event・Reader入力型 | Orchestratorの既存活動公開領域へ統合候補 | Repository型依存をDomainの非認可情報へ限定。実行事実の正本をExecution Intelligenceへ勝手に変更しない |
| `src/activity/validate.ts` | Orchestrator状態相関と活動応答の閉包検査 | Orchestratorの既存公開投影Validatorへ統合候補 | MCP／Workbenchで共有。Access Managementへ上位Task意味検査を持たせない |
| `src/configuration/shared-server-file-adapter.ts` | Origin／Port、接続設定、Root検証、Context解析、Exposure、Topic／Meeting生成が混在 | SPLIT。接続・Exposure設定はAccess Management、ContextはDomain、Listener設定と本番組立てはMCP／Workbench | 設定の存在によるMode切替禁止。現在Binding／Context改訂検査を維持し、単体から兄弟Repoを探索しない |
| `src/connection/http.ts` | CROS REST ServerとRemote Client、入力stream・応答変換 | 代替MCPと本番Consumer成立後DELETE | Browser↔Workbench RESTは対象外。認可・競合・活動欠測・終了保証は新経路で実証 |
| `src/tool/registry.ts` | Tool実装一覧、公開可否、取消・結果分類 | REVIEW。MCP等の実登録先に統合または未使用中継を削除 | 現行本番Consumerは検索で見つからず自Package試験のみ。Tool登録契約とARCH-000010／012を先に照合し、新汎用Registryは作らない |
| `src/surface/operation.ts` | 汎用Ownerへのinspect／apply、Surface転送、委譲結果相関 | REVIEW。固有意味を持つ実Ownerへ統合またはDELETE | 本番Consumerは検索で見つからず自Package試験のみ。Handoff／Result義務を消さず、値の投影とTask採用判断を分ける |
| `src/index.ts` | 上記責務全体の明示公開 | 全移管後DELETE。新Ownerの`src/index.ts`から必要Symbolだけ公開 | 同型DTOや互換barrelを追加しない。未対応の公開契約を消さない |

### 保存正本の実照合

現行RootはDomainの`repository/resolve-storage-paths.ts`にある`resolveCrosRuntimeRoots`で決まり、Windowsでは`<LOCALAPPDATA>/<publisher>/cros/<trustDomainId>/`、Linuxでは既存XDG config／stateの同じ三segmentを用いる。Credentialはstate直下の`credential-registry/registry-<revision>.json`、管理回復は`credential-access-recovery/`、接続設定はconfig直下の`shared-server.json`から読む。これはSource上の配置規則の確認であり、利用者の実秘密Fileを読んだ結果ではない。

現行には独立したRepository Connection Registry保存Adapterが見当たらず、`shared-server.json`のrepositories／workspaceIdsを読んでBindingとExposureを構成している。「Registry」という名称だけから新Storeを作らない。接続設定のOwnerをAccess Managementへ定め、HTTP設定と分ける際にも既存Host Rootと秘密の保護を維持する。将来の設定File名変更はFrontend AIの明示移行へ接続し、Sourceへ旧互換Readerを追加しない。Package改名を理由に`cros`というOS Path segment、Token version、秘密Verifier、保存改訂を変更しない。

共有Rootは複数Ownerが利用するCROS全体の配置契約であり、Access Management固有の内容所有へ集約しない。現時点の物理Providerは`domain-model/src/repository/resolve-storage-paths.ts`であるが、それをDomainの意味Owner確定と扱わない。現在の配置とPath Identityを維持し、将来のProvider変更またはOwner別Rootへの移行は、全Consumer・保存Path・保護・移行を対応付けた別判断とする。Access ManagementがAI Profile内容を所有する構造や、AI AdapterからAccess Managementへの保存依存を作らない。

| 保存内容 | 現行Path（既存Root起点） | 内容Owner／利用側 | 今回の処置 |
|---|---|---|---|
| Credential Registry | state内`credential-registry/` | Access Management候補 | Path・秘密保護・不変Revisionを維持 |
| 管理回復記録 | state内`credential-access-recovery/` | Access Management候補 | Path・限定回復契約を維持 |
| 接続・公開・Listener設定 | config内`shared-server.json` | Access Management／MCP／Workbenchへ責務分離候補 | 内容分離とFile移行を対応付け、Rootは変更しない |
| AI Profile Catalog | config内`ai-profile-catalog/` | AI Adapterの`profile/store.ts` | 内容・Schema・保存先を維持。管理可否だけAccess Management |

### 利用側・検証の移管母集合

| 利用側／成果物 | 必要な処置 |
|---|---|
| MCP `project-context/adapter.ts`とResolver | Portfolio型・生成はDomain、Credential／ScopeはAccess Management。Requestごとの認可を必ず経由 |
| MCP Profile／Runtime活動Adapter | Profile入力はAI Adapter、管理可否はAccess Management、活動型・検査は実Ownerへ接続 |
| Workbench `server.ts`／`credential/administration.ts`／`browser/client-model.ts` | Local認可と非秘密管理をAccess Managementへ、表示型はDomainへ、Remote ClientはMCPへ切替。Browser REST維持 |
| `template/tools/crdd-cros-server.ts`とMCP Shared Host | 新MCP正式入口・設定・Reader注入とWorkbench代替を確認後に撤去。旧起動能力を先に消さない |
| CROSの12試験File、MCP／WorkbenchのCROS結合・System試験 | 検証義務のOwnerと観測境界で移管・補強する。過去結果を新配置へ流用せず、新しい対象で実行 |
| Checker命名、Version Control Consumer閉包、Coordinator配布閉包 | package名・SourcePrefix・公開集合・実依存に追従。配布のためだけにAccess Management全体を署名閉包へ追加しない |
| 共有Rootの全利用側 | DomainのRoot公開API・契約試験、AI AdapterのProfile Store・保存試験、CROSのCredential／Recovery／設定試験、MCPのShared Server入口試験を照合。移管後の新候補でPath Identityと保護条件を再検証 |
| Package metadata／build契約 | `package.json`のname・exports・bin・scripts、`tsconfig.json`、`symbol.json`を新Ownerへ対応付ける。`package-lock.json`は採用Package graphとmanifestから再生成する派生物であり、独立正本・手編集対象としない。旧名の実利用と歴史記録を区別し、全接続・bin案内・検証成立後だけ旧Packageを撤去 |
| Domain公開Trust Policy契約 | `inspectCrosTrustPolicy`／`CrosTrustPolicy`／`CROS_TRUST_POLICY_SCHEMA`は既存宣言Validatorとして現状維持し、Domain試験・Architecture・公開集合・履歴を照合する。改名／廃止は別判断。新しい運用必須Policy、Coordinator Authorityへの統合、Schema変更は行わない |
| Architecture／Quality／symbol／Template設定／案内／Project Context | 現行Owner・導出元・新API・配置と一致させる。過去Evidenceは変更しない |

以下は現行12試験Fileの全数対応である。Pathは`40_Develop/cros/tests/`起点、各名称には`.contract.test.ts`が付く。現Traceは正式QA適合判定ではなく照合入力であり、QA ID・本文・Oracle・過去結果はこの計画更新で変更しない。一Fileを一Ownerへ強制せず、複合責務は分割候補とする。保持Oracleは新Ownerで再実行し、過去Passや自己Package試験だけを代替能力の成立・削除根拠にしない。

| 現行試験File | 現Trace | 対象責務 | 移管・分割・代替候補 | 保持Oracle／未決 |
|---|---|---|---|---|
| `integration/connection-credential` | RFD-IT-013 | Credential・要求認可 | Access Managementへ移管 | 明示Grant、失効、秘密非保持、管理とContent分離。公開MCP／Workbench結合は別確認 |
| `integration/credential-access-recovery-file-adapter` | RFD-IT-013 | 管理回復の保存・再入場 | Access Management回復へ移管 | 人間確認、同一Identity、Registry確定、秘密非保持、再入場 |
| `integration/credential-registry-file-adapter` | RFD-IT-013 | Registry保存 | Access Management保存へ移管 | OS Root、別Adapter読戻し、Revision競合、保存保護 |
| `integration/local-operation-ai-plan` | RFD-IT-009／RFD-IT-011 | 局所操作・AI計画・Handoff | REVIEW。Domain／Orchestratorの実Ownerへ分割または代替 | availability、局所同等性、AI入口制約。疑似操作のCanonical義務・本番代替は未確定 |
| `integration/project-federation` | PPR-IT-002 | 認可集合・Portfolio | Access Management認可／Domain投影へ分割 | 許可集合外非読取り、欠測、Identity不一致、競合 |
| `integration/remote-transport` | PPR-IT-002／RFD-IT-013 | Remote認可・情報非開示 | MCPの実経路で代替後に旧REST試験撤去 | Request毎認可、Workspace非開示、Registry改訂、Token非報告。代替本番検証は未完了 |
| `integration/shared-server-config-file-adapter` | PPR-IT-002／RFD-IT-013 | Host設定・Root・Context・Exposure | Access Management／Domain／MCP設定へ分割 | 不正Root・Context拒否、Binding、Grant不一致、現在Path Identity |
| `integration/surface-contract` | EST-IT-010 | Surface間Owner・結果・取消 | REVIEW。実Owner・本番Surface試験へ代替 | 同一Owner、Authority、Effect、取消、結果相関。抽象FixtureだけでServer成立を主張しない |
| `integration/tool-registry` | RCM-IT-010 | 登録・公開・実装接続 | REVIEW。実登録先へ統合または代替 | 公開可否、Host availability、Authority、取消、cleanup。新汎用Registryは追加しない |
| `system/context-handoff` | ERB-ST-013／RFD-ST-010 | Context引渡し・再入場 | REVIEW。Domain値／Orchestrator判断へ分割 | Source・対象Identity、改訂、Authority、必要Context、再入場。値関数から本番ST成立を推定しない |
| `system/result-return` | EST-ST-011 | 結果引渡し・再実行制御 | REVIEW。実Orchestratorの結果受領へ対応 | createdBy、改訂、差分、Evidence、返却先、Authority、replay。新汎用DTOは作らない |
| `system/session-access` | RFD-ST-003／RFD-ST-004 | Session・Exposure・公開操作 | Access Managementへ移管しMCP／Workbench実Surfaceを補強 | Session終了、失効、Workspace／Repository認可、非開示。新Surface接続の検証は未完了 |

Tool Registry等の本番未使用判定は、今回のTS Source検索による確認であり、動的参照・設定・公開案内・Git履歴・過去VerificationとCanonical義務を含む削除Gateは未完了である。

### 実施順・再開Gate

1. 本表の未決候補をSource・Canonical義務・過去Capabilityから確定し、基本／詳細ArchitectureとQAを新Ownerへ対応付ける。必要な人間判断だけを提示する。
2. Credential・認可・限定Access Recovery・接続設定をAccess Managementへ移す。DomainのPortfolio／Context処理を分け、Root明示公開・型依存・試験を同時追従する。
3. 業務入力・活動投影・Tool／Surface／Handoffの残存責務を既存Ownerへ統合または削除する。段階9〜11の大改修が不可欠なものは依存を示し、段階6〜8の完成へ隠さない。
4. MCP／WorkbenchのLocal・Remote本番Consumer、単体／CROS Mode、設定と公開入口を接続する。認可前読取り0、非開示、改訂競合、処置前／後取消、終了後状態を新経路で確認する。
5. 全責務・公開集合・利用側・代替実測が閉じた後、旧REST／Gateway／Shared Hostと`cros`Packageを撤去する。全回帰・独立レビュー・Reality Auditと現在投影を更新する。

実装前整合確認と固定候補前照合を新Ownerでやり直す。独立した実装・品質観点で本計画を確認し、全結果を統合して是正する。保存Path・Token・Grantの意味を変える必要が判明した場合は改名へ混ぜず影響と人間判断へ戻す。新IAM Platform、氏名・メール・Password・登録申請・IdPを持つ汎用User Account、汎用Registry／Lock／Gateway／互換Serverは対象外。最小ユーザー管理は後述の現在採用判断に従い正式伝播する。現時点で全1〜8の完成・Release可能は主張しない。

### 正式Architecture着手前の照合結果

本節の照合表・二案は追加Input採用前の履歴である。現在の採用範囲は[現在の採用判断](#現在の採用判断)とREQ-000041を優先する。表の判断待ちを現在の停止条件として扱わない。

基準Commit `fd7ae93a`でArchitectureと品質の読み取り専用確認を完了した。これは移管後の独立レビューや完成判定ではない。全結果を統合すると、Package名の変更とは別に、認可方式の正本間矛盾が存在する。以下を処置するまで、認可方式を固定したSource移管と旧Owner撤去は開始しない。

| 照合事項 | 確認した差・必要な処置 | 現在状態 |
|---|---|---|
| 認可方式 | REQ-000041は固定三RoleとRole別共有Credentialを採用し、Credentialごとの任意Workspace Grantを不採用としている。UX-000013／035、IA-000009、UI-000008、SPEC-000012はこの意味を継承する。一方、CROS詳細設計§2・保存／保守契約・現行`credential.ts`は固定名をCredential Profileとし、明示Workspace集合と管理可否を実効権限としている。現在Sourceを根拠に上流を改変せず、同一CHG内でQual-Labの判断を確認する | 判断待ち。今回のPackage再編承認は認可方式変更の承認ではない |
| 専門Capabilityの詳細設計 | `Details/access-management/01_Architecture.md`を認証・要求認可・Credential保存・限定Host回復・接続設定の設計Ownerとする。`Details/cros/01_Architecture.md`はシステム連携の設計として残し、同じSchemaや認可規則を再定義しない | 設計反映未実施。永続Userを追加しないという条件は追加Input前の前提。新IAM Platform・汎用User Account・永続Sessionは対象外を維持し、最小の耐久User IdentityとRole／Credential紐付けは後述の追加Inputの認識確認待ち |
| 直接伝播の範囲 | ARCH-000013、Architecture入口・Component／Interface／Data Flow／Detail Map／Traceability、Domain保存契約、MCP／Workbench／AI Adapter詳細設計を照合する。CROS詳細設計のIdentity、設定、Credential、登録、完了条件、回復、実装構造も対象とし、一部のOwner表だけで閉じない | 移管候補表を入力とし、意味と保存契約を維持して反映する。過去Evidenceは不変 |
| 設定と保存Root | 接続・公開設定は`access-management.json`、Transport設定は`mcp-server.json`へ分離する候補。前者は接続Repository RootとWorkspace集合、後者はOrigin／Port等を所有する。旧`shared-server.json`からの移行はフロントAIの手順とする。既存OS Root・秘密Store・AI Profile Storeは変更しない | 内容と正本を設計で確定してから実装。新Registry Store・旧互換Readerは作らない |
| 品質の導出元 | QA-000001／004／007／009に加え、QA-000006のERB-ST-013もContext引渡しと実再開の区別へ追従する。既存Local Itemを保持し、Portfolio値生成、要求認可、活動値の検査、実行停止／再開の観測を別の保証として扱う | QA更新未実施。値関数や自己Package試験を本番Surface・実取消・再開の完成根拠にしない |

以下は、ユーザー・Role・Credential分離の追加Inputを受ける前に提示した二案である。現在の選択肢をこの二案へ限定せず、後述の追加Inputを優先して認識確認する。両案ともユーザー登録なし、Bearer Secretの別経路配布、管理権限から内容閲覧権限を推定しないことを維持する。

| 案 | 利用者・管理者への影響 | 必要な処置 |
|---|---|---|
| 採用済み固定三Roleを維持 | DeveloperはDevelopment、ManagementはDevelopmentとManagement、Administratorは管理のみ。Credential単位の任意の範囲設定を通常管理へ増やさない | 上流は維持。詳細設計・Source・QAを採用済みの三範囲へ一致させ、保存済み設定への影響を確認する |
| 現行の明示Grant方式を採用 | 固定三Profile名は選択・表示の補助で、CredentialごとにWorkspace集合と管理可否を設定できる。柔軟だが管理対象が増える | REQ-000041の不採用判断を人間が変更し、UX→IA→UI／SPEC→ARCH→QAへ正式伝播する。Sourceが存在するだけでは採用しない |

人間への推奨は、現在の軽量運用意図と既存要求に従い固定三Roleを維持する案である。ただしこの推奨を採用判断と扱わない。回答前は上流の権限意味、Token・Verifier・保存改訂、認可Source、秘密値、実Host設定を変更しない。設計Ownerの候補整理は継続可能だが、新Ownerの完成や旧Packageの廃止を表示しない。

この照合結果・二案と現在投影の三文書差分は、Architectureと品質の限定独立レビューで双方指摘0。差分空白確認も成功した。確認対象は判断待ちの記録であり、認可方式の採用、正式Architectureの移管、Source・QA完成または回帰成功を示さない。

### Tool／Surface中継の責務照合

認可方式の判断待ちと独立して、基準Commit `fd7ae93a`の二Sourceと三試験、公開型の利用、ARCH-000010／015、QA-000001／009を読み取りで照合した。`40_Develop`と`template`のTS／JSONにおける関数・公開型の参照は、定義・Root export・自Package試験だけだった。これは現在の静的な利用集合の観測であり、外部Consumerや任意の動的参照の不存在証明ではない。Git履歴には第一段階改名とv0.21の境界検証変更が存在するため、過去試験を不要扱いせず、変更・削除前に当時の保証範囲を確認する。

| 現行Source／試験 | 実際に成立する範囲 | 移管・撤去の処置候補と保持する義務 |
|---|---|---|
| `cros/src/tool/registry.ts`／`integration/tool-registry` | Callerが与えた登録配列の状態照会と実装関数呼出し。登録一覧は試験内で組み立てており、Repositoryの実Tool発見や公開Server登録とは未接続 | Access Managementへ移さない。能力発見はARCH-000010、要求ごとの認可はAccess Management、実登録と起動は各公開入口・実行Ownerへ分ける。RCM-IT-010の状態軸・未許可Effect 0・取消と回収を実能力で置換確認後、未使用の汎用実行Registryを撤去する候補。新Registry Packageは作らない |
| `cros/src/surface/operation.ts`の共通操作Handler／`integration/surface-contract` | Callerが与えた同期Ownerを呼ぶ。試験は四つのSurface名に対し別々のメモリOwnerを作り、同じ結果を比較する。本番CLI・HTTP・MCP・Workbench接続や外部取消資源の観測ではない | 汎用Handlerを別Packageへ横流ししない。Topic／Meeting、Profile、活動等の既存業務APIと本番AdapterをEST-IT-010へ接続して同等性を確認する。文字列のSurface名や固定残存件数から実入口・cleanupの成立を推定しない。代替確認後の削除候補とする |
| 同Fileの`settleDelegatedResult`／`system/result-return` | Task・Request・Authority・Revision・既処置集合・complete値を同期判定する。`effectCount: 1`は返却値で、実Task保存・Candidate反映・既処置集合更新を発行しない。試験は`producerId`、変更Hash、Evidenceの保存先への搬送を観測していない | 結果受領・Taskへの結合はARCH-000015が定める既存Coordinator／Orchestratorへ対応付ける。EST-ST-011の実帰還・相関保持・再送による重複Effect 0を観測するまで、この値判定を本番ST成立としない。単純な型移管や同名関数追加で新しい結果受領Ownerを増やさない |

Domain Modelの`configuration/read-tool-config.ts`は保持期間設定のReaderであり、名称にToolを含むだけで能力Registryの代替にしない。Orchestratorの`candidate/integration-result.ts`は既存の結果Schema検査を所有するが、上記委譲結果と同じSchemaではないため機械的な統合やDTOの複製をしない。実接続を追跡して保持保証を対応付ける。これらの照合でSource・QA・過去Evidenceは変更しておらず、新しい回帰成功・削除許可・段階6〜8完了を主張しない。

### 追加Input — ユーザー・Role・Credentialの分離

#### 現在の採用判断

2026-10-09、人間は最小ユーザー管理をv0.22へ採用した。ユーザーは`userId`（UUID）、管理者が設定・変更する`username`、Roleを持ち、Credentialをユーザーへ紐づける。表示名は管理対象の識別とWorkbenchの現在認証ユーザー表示だけに使用し、認証・本人確認・認可の根拠にしない。標準Roleは`developer`／`manager`／`administrator`、詳細権限はRoleに置く。リセットはユーザーIDとRoleを保ち旧Credentialを拒否する。氏名・メール・Password・申請・自己編集・SSO／IdP・一般IAMへ拡張しない。

初回の正式伝播としてEXP-000036に旧判断履歴と採用変更を分離し、REQ-000041を現在モデルへ更新した。Discovery入口も追従した。これで採用範囲の認識確認待ちは解消したが、UX／IA／UI／SPEC／BHV／SCR／ARCH／QA、Source、保存Schema、既存設定移行、回帰は未追従である。先の認可方式照合表と二案は変更前の診断・提案履歴であり、現行方式として採用しない。認可Source移管は新要求の下流設計を固定してから行う。

上流7文書の固定差分はArchitecture・品質の限定独立レビューで5指摘を統合是正し、両観点の再レビューで残指摘0。REQ-000011本文も現行認可境界へ揃え、旧Phase 4 Passを履歴へ限定した。差分空白確認は成功した。これはDiscovery更新の確認であり、下流伝播・Source・保存移行・実境界試験の完成証明ではない。

UXの直接伝播はREQ-000011／041の分析、UX-000013／035の定義、工程横断の5文書へ反映した。既存UX IDを維持し、自身表示・非認証非開示・非管理者の他ユーザー非開示、通常リセットとHost回復の分離、Role詳細権限を保持した。9文書の固定差分をArchitecture・品質で独立確認し、指摘を統合是正した後、両観点の最終限定レビューは残指摘0。差分空白確認も成功した。これは今回のUX変更範囲の確認であり、全UX完成、実装やE2E成功ではない。次はIAへ正式伝播し、UI／SPEC、詳細設計、Architecture、Qualityと実装へ順に接続する。

UUID版、表示名の構文・正規化・一意性、Role権限語彙、既存Credentialの移行／再発行、Bootstrapとの結合と緊急Recoveryの最小ユーザー情報処置は後工程で確定する。既存OS Root・秘密保護・単体利用のCredential不要・管理権限から内容権限を推定しない意味・Product Data保持は維持する。開始済み操作の取消をリセットの成功から推定しない。Source・実秘密Store・保存Schema・過去Evidenceは初回上流編集では変更しない。

IAの直接伝播はUX-000013／035の2分析、IA-000009の1定義と横断4文書へ反映した。UXのUUID継承制約と公開／実アクセスの正式入力も補い、固定9文書をArchitecture・品質で独立確認した。UUIDの正式入力、回復2種の属性と引き渡し漏れを統合是正し、両観点の最終限定レビューは残指摘0。21分析Objectから16Canonical Objectへの対応と既存IA ID、通常リセット／Host回復、三可視境界を維持した。差分空白確認は成功した。これは今回の文書伝播だけの確認であり、全IA、UI／SPEC、Source・保存Schema・移行・回帰・E2Eの完成ではない。次はUI／SPECへ正式伝播する。

UI／SPECの直接伝播は各UX-000013／035・IA-000009の3分析とUI-000008／SPEC-000012の定義、計8文書へ反映した。認可・情報非開示とReset／Host RecoveryのEffect・Lifecycleを含むArchitecture・品質の独立レビューを実行し、独立資格失効とProcess喪失後の回復情報保持の2指摘を統合是正した。最終限定レビューは両観点で残指摘0。差分空白・ローカルリンク先を確認した。これはDefinition直接伝播のみであり、UI／SPEC Details・横断投影・対応レビュー・Architecture／Quality／Source・保存Schema・移行・E2Eは未追従。入口と旧対応記録の完成表示を再確認待ちへ更新し、旧引用を最新完成証明にしない。次はSCR-000008／BHV-000012と横断投影へ接続する。

#### 鍵交換の途中見直し — 2026-10-10

人間は鍵だけの処置を採用し、操作を指定ユーザー交換と全員交換の2つへ統合した。要求正本はREQ-000041、理解確認・比較理由はEXP-000036が所有する。通常管理とHost回復はAuthority・入口を分けるが処置は共通。ユーザーID・表示名・Role・権限設定・Repository登録・Product Dataは保持し、回復専用ユーザー・追加権限・特別Bootstrapを作らない。全員交換は指定した既存administratorへ新資格を発行する。旧Role初期化と認可設定破損の自動回復保証は廃止し、破損・対象不明・管理者不存在では処置前停止する。初回Server設定の方式は今回変更しない。

変更分類は採用済みCapabilityの破壊的な回復意味変更。同じCHGのAccess Management再編意図で、基準はCommit `15b7ce3e`。今回の編集母集団はEXP-000036、REQ-000041、REQ-000041のUX分析、UX-000035、計画、現在投影の6文書。Authority・秘密保護・失効範囲と部分失敗の着手前整合確認を実施し、独立レビュー、文書整合と限定伝播監査で固定候補を確認する。CRDD規範と準拠基準は変更しないため準拠監査は行わず、Source未変更のため実E2Eは行わない。名前変更／単体利用は鍵交換非発火、対象資格紛失は指定交換、全漏洩は全員交換、管理者全資格喪失はHostから既存管理者を指定し、状態不明はEffect前停止する。

旧要求の回復2種を保持したIA／UI／SPEC、SCR-000008／BHV-000012、横断投影、Architecture／Quality／Source・保存Schema・移行はこの判断に未追従。前の限定Passは前の固定版だけの結果であり、新判断の完成証明へ流用しない。Source・実秘密Store・旧Evidenceを変更せず、要求→UX→IA→UI／SPEC→Detailの順に再伝播する。

今回6文書の固定候補は、Authority・回復意味と品質・検証義務の両観点で独立確認した。旧「通常リセット対Host回復」の別処置表現と、Process喪失条件のUX引き渡し不足を統合是正し、両観点の限定再レビューは残指摘0。差分空白とローカルリンク先の確認は成功した。これは要求・UXの今回変更範囲だけの結果で、IA以降の伝播、Source・保存移行・実回復・E2Eの成立ではない。

#### 鍵交換2操作のIA伝播 — 2026-10-10

基準版はCommit `8fc444e5`。正式入力UX-000035からIA分析、IA-000009、IAルート4投影へ操作範囲と入口・Authorityの別軸、既存ユーザーへの発行、情報保持、処置前停止、途中失敗後の同じRecoveryと再観測を伝播する。計画と現在投影を含む8文書を今回の編集母集団とする。IA-IDとObject数、三可視境界、Role・公開・実アクセスの別判定、単体利用非依存は維持する。

変更分類は採用済み回復意味の下流伝播。着手前整合確認で正式UXとの一致を確認した。対象1人／全員、通常／Host、管理者不存在・状態不明・認可設定破損、失効確定／発行不明を代表例として照合する。固定候補の独立レビューはAuthority・IA契約と品質・検証義務の2観点、文書整合・限定伝播を対象とする。規範・準拠基準・Sourceは変更せず、準拠監査・実E2Eは今回実施しない。現在、追加の人間判断は不要である。

固定8文書を両観点で独立確認し、限定Pass・残指摘0を得た。差分空白検査とローカルリンク先確認も成功した。IA分析・定義・横断投影まで新判断へ追従したが、全IA完成の判定ではない。UI／SPEC以降は未追従であり、旧レビュー結果を新判断の成立根拠にしない。次はUI／SPECの分析・定義へ伝播する。

#### 鍵交換2操作のUI／SPEC直接伝播 — 2026-10-10

基準版はCommit `29c276f2`。正式UX-000035とIA-000009を各工程で独立分析し、UI-000008とSPEC-000012へ統合する。対象は4分析・2定義・各工程入口の状態表示・計画・現在投影の10文書。旧回復種別・Role初期化・未決Bootstrap結合を現行契約から撤去し、2操作の失効集合・既存発行先と2入口のAuthorityを別軸で保持する。独立失効・三可視境界・Role／公開／実アクセス・単体利用非依存は変更しない。

変更分類は採用済み回復意味の下流伝播。着手前整合確認を行い、全員交換で自身旧資格も失効する影響、情報保持、処置前停止、失効確定／発行不明、応答・Process喪失後の同じRecoveryと再観測を代表反例として確認する。UIは認識・操作・Feedback、SPECは条件・Effect・結果・失敗の責務で更新する。固定候補はAuthority・契約と品質・検証義務の2観点で独立レビューし、文書整合・限定伝播を確認する。規範・準拠基準・Source未変更のため準拠監査・実E2Eは行わない。現在、追加の人間判断は不要。

初回固定候補は品質観点が残指摘0、契約観点が中程度1指摘であり、全体Passではなかった。UIの導線が明示確認を全鍵交換へ拡張していたため、両観点で是正方針を照合し、事前情報表示を維持したまま「Host入口または全員交換のみ」明示確認へ限定した。修正後固定10文書は両観点の限定独立レビューで残指摘0・Pass。差分の空白検査と変更文書のローカルリンク先存在確認も成功した。Detail・横断投影・UI／SPEC対応レビュー、Architecture／Quality／Source・保存Schema・移行・実証は未追従であり、次は画面詳細・BHVと横断投影へ伝播する。旧Passは当時の固定版の結果であり、新判断の成立根拠にしない。

#### 鍵交換2操作のDetail伝播 — 2026-10-10

基準Commitは`9184bb22`。採用済みUI-000008／SPEC-000012を既存SCR-000008／PRT-000008／BHV-000012へ具体化する。変更分類は同一CHGの契約変更の直接伝播で、追加の人間判断はない。書込み範囲は現在Repositoryだけ。新ID、Store／Schema、Role権限、Authority、管理画面／CLI分担、Source・旧Evidenceは変更しない。

編集単位はD1 Screen、D2 Behavior、D3 Area Guide、D4 UI Detail一覧、D5 SPEC Detail一覧、D6 Detail対応、D7〜8 UI／SPEC工程Rootの状態、D9本計画、D10 PROJECT_CONTEXT。D1〜2は現行Definitionから独立に具体化し、D3〜6は両者の接続と現在状態を投影する。着手前整合確認では契約専門観点が着手可とし、旧Role別鍵・Workspace Grant・権限再構成・Bootstrap再入場を撤去する範囲へ限定した。単体利用、通常管理、独立失効と初回Server設定方式は維持する。

代表例は2操作×2入口の4組すべてを照合した。事前情報表示は全4組、明示確認はHost入口または全員交換の3組のみ。対象不明・管理者不存在・必要状態を安全に確認不能・認可破損は新Effect前停止。失効後の発行失敗・応答／Process喪失は既知失効と発行不明を同じ回復へ保持し、現在再観測なしの完了／rollback／旧鍵有効／取消完了を禁止する。既存20 SCR／20 PRT／30 BHV／32 Relationは増やさない。

必須確認集合は契約観点と品質観点の限定独立レビュー、文書の差分・リンク確認と限定伝播確認。標準RuleやSourceを変更しないため準拠監査・実E2Eはこの段階では対象外。Definition対応32組の旧引用・Hashは歴史記録として維持し、現行Definition対応レビューとWorkbench候補の横断投影は後続で更新する。Architecture／Quality／Source・保存Schema・移行・実証も未追従であり、Detailの限定対応から工程Exit・v0.22完成を推定しない。

初回固定10文書は契約観点が残指摘0、品質観点が軽微1指摘（CQ-DETAIL-Q01）。Screenの共通completed表示が鍵交換だけの失効・発行結果を他操作へ適用していたため、両観点で是正方針を照合し、表示する意味セルだけを操作別の確定結果へ限定した。独立失効は発行なし、名前変更は鍵処置なしでも当該操作完了となり、失効確定／発行不明はcompletedへ丸めない。修正後固定10文書は両観点の限定独立再レビューで残指摘0・Pass。差分空白検査とローカルリンク先存在確認も成功（不存在0、アンカー全数検証ではない）。次はDefinition対応レビューとWorkbench候補横断投影、続いてArchitecture／Qualityへの伝播。既存Visual BaselineとArea原則の適用は保持するが、具体的な管理画面／CLI分担・Layout・CMPは未固定のまま明示する。

#### 鍵交換2操作の横断投影・Definition対応 — 2026-10-10

基準Commitは`69f8d463`。変更単位は表示面、操作・状態、UI引き渡し、Workbench画面候補の追補、UI-000008／SPEC-000012の現行1組の対応、本計画とPROJECT_CONTEXTの7文書。複数正本にまたがる契約伝播として読み取り専用の着手前整合確認を行い、着手阻害0・追加人間判断なし。旧32組のHash・引用・Pass、WorkbenchのG1〜G5と旧判断は履歴として維持し、現行区画を追加する。画面／CLI分担、Layout、権限、Source、Schema、旧Evidenceは変更しない。

確認母集団は2操作×2入口の4組、独立失効、通常のユーザー／Role管理、接続と三可視境界。全組の事前表示、Hostまたは全員交換だけ明示確認、処置前停止、失効後の発行失敗・応答／Process喪失の既知失効／発行不明、同じRecovery・現在再観測、Secret非再表示と取消非証明を照合する。Definition対応とDetail対応を別判定にし、実画面評価・UI工程Exit・Architecture／Quality／Sourceは未完了のまま保持する。

必須確認集合は契約・品質の限定独立レビューと文書差分・リンク・履歴保持確認。標準Rule・実装・外部Runtimeを変更しないため準拠監査・実E2Eは今回は実施しない。旧Passを新改訂版へ流用しない。

初回固定7文書は契約観点が中程度1、品質観点が軽微2で限定Fail。追補挿入による旧Checklistの分断と、引き渡し／対応文書の現在状態競合を統合し、両確認者と是正方針を照合した。追補本文を変えず旧Checklist全項目の後へ移動し、Detail限定確認済み・現行Definition対応と横断投影は再レビュー待ち・後工程未完了へ現況語を同期した。関連する工程Root2文書とDetail入口3文書の現況語も同期し、固定母集団は12文書へ拡張した。正本Definition・2Hash、旧32組の引用／結果、旧Gate・Checklist、Sourceは不変。修正後12文書は限定再レビュー待ち。

最終限定確認では、現況語同期の末尾OPEN3行の漏れを同じ原因の是正として修正し、両確認者が固定12文書を再確認した。契約・品質とも全重大度の残指摘0・限定Pass。差分空白検査成功、ローカルリンク先不存在0。旧32組のレビュー対象・引用区画と旧Workbench Checklistは基準版との完全一致を確認した。Definition2Hashも不変。結果状態だけを限定独立レビュー済みへ同期し、工程Exit・実装・E2E・v0.22完成は主張しない。次はArchitecture／Qualityへの伝播であり、管理画面／CLI分担と実画面評価の未確認は保持する。

#### 鍵交換2操作のArchitecture分析・責務定義伝播 — 2026-10-10

基準Commitは`ab4aa215`。変更分類は採用済みUI-000008／SPEC-000012への既存Architectureの是正伝播であり、UI工程Exit後の通常Handoffではない。各自身Definitionを独立分析し既存ARCH-000013へ統合する。UI意味、権限、初回設定、単体利用、REST撤去範囲、Source・秘密File・Schema・旧Evidenceは変更しない。人間の追加採用判断は不要で、公開入口・画面／CLI分担・期限・保存確定方式は未確定のまま保持する。

着手前の読み取り専用確認により、Architecture横断のComponent表も直接Consumerとして同時更新する必要を確認した。固定範囲は2分析、ARCH-000013、Component責務表、Architecture入口、本計画、PROJECT_CONTEXTの7文書。旧User無し・Role別資格・固定Workspace Grant・Bootstrap回復の意味を現行最小ユーザーと現行Role認可・鍵交換2操作へ更新し、Access Managementと認可済みDomain集約の境界を明示する。新Framework／Store／APIは作らない。

確認する母集団は通常管理・接続／自身表示・3可視境界、2操作×2入口、独立失効、処置前停止と処置後の発行失敗・応答／Process喪失、同じRecovery・現在再観測・Authority非復元・秘密非再表示・取消非証明。既存発行入口限定と新2操作の対応はDetails／Source照合待ちとし、Remote MCPの秘密発行公開やCLI固定を先取りしない。

必須確認集合は契約・品質の限定独立レビュー、差分・リンクと直接伝播確認。標準Rule・Source・外部Runtimeを変更しないため準拠監査、全テスト、実E2Eはこの段階では実施しない。旧Remote MCPのBearer・非開示・単体・Listener終了Evidenceは歴史比較として参照し、新方式のPassへ流用しない。他の既存資格／回復能力は次段で全Source／試験／Evidenceを対応付け、未照合を置換済みとしない。

7文書は限定独立レビュー済み。初回レビューで主要図の旧責務表示と子節番号の不整合を検出し、統合方針を両確認者へ照合して是正した。契約・品質の限定再レビューはともに残指摘0。差分空白確認とローカルリンク先確認も成功した。03〜08横断モデル、CROS／MCP／Workbench等のDetails、Quality・保存Schema・移行・Source・実境界は未追従。基本定義から全体Readyや実装可能状態を主張しない。

#### 鍵交換2操作のArchitecture横断モデル伝播 — 2026-10-10

基準Commitは`46e9ca95`。採用済みARCH-000013を03境界、04データフロー、05故障回復、06配置の4モデルへ是正伝播する。着手前整合確認は親と読み取り専用の契約確認者で行い、操作／入口の別軸、現在認可とDomain集約、処置前停止と失効後不明、Secret非耐久化を照合した。追加の人間判断は不要。日本語の操作・表示を基本とし、既存正式名とIDは必要な箇所で維持する。

編集の一次単位は境界・状態・失敗・配置の責務とし、全4モデルへ対象別に処置する。通常管理と独立失効、鍵交換2操作×2入口、現行Role、同名／改名、三可視境界、情報保持、失効確定／発行不明／結果受領、同じRecoveryの現在再観測を反映する。発火例はHostまたは全員交換の確認、非発火例は通常入口の指定ユーザー交換に追加確認なし、境界例は管理権限と内容閲覧の分離、情報不足例は必要状態不明で新Effect前停止。秘密発行の具体入口、画面／CLI、保存確定方式は決めない。ER局所ラベルは概念関係の表示であり保存Schemaを発行しない。

最初の固定範囲案は4モデルと入口・計画・PROJECT_CONTEXTの7文書だったが、現在状態を参照するComponent表とARCH-000013も状態表示だけ同期し、固定候補を9文書とする。07／08はaccess-managementのDetailsと配置を同時に接続する次段へ残す。未作成の詳細設計への架空リンクや、旧Coveredから新配置成立の推定をしない。

必須確認集合は契約・品質の限定独立レビュー、文書のリンク・用語・差分確認と、03〜06および現況参照の直接伝播確認。準拠規則・Source・外部Runtimeは変えないため準拠監査、全回帰、実E2Eはこの段階では実施しない。過去Evidence、Source、保存Root、Schema、新Store／Registry／Lock／Framework、Docker／Orchestrator／Coordinatorの実行系は変更禁止。現在は9文書を作成済み・限定独立レビュー済みであり、UI Exit、Architecture Ready、QA Handoff、詳細設計・実装完成を主張しない。 初回の契約確認で管理状態と派生認可集合の混在、図案内の漏れを検出し、品質確認の重複指摘と合わせ2件へ統合した。両確認者へ是正方針を照合し、2箇所を最小修正した後の限定再レビューは両観点とも残指摘0。ローカルリンク先の欠落0、差分空白確認成功。Source・過去Evidence・UI／SPEC正本2Hashは不変。

#### 旧CROSの移管前Source照合 — 2026-10-10

基準Commitは`2b5b1b76`。[移管対応表](source-owner-map.md)で18 srcと1 binの19入力を全数処置し、混在FileをSymbol群で分解した。対応表は移管分析でありArchitectureの第二正本ではない。Credential固定Grant・一資格rotation・Bootstrap新Identityは新ユーザー／Role／鍵交換契約に非互換で、単純移動できない。Portfolioの認可選択と純粋集約を分離し、活動・Profile・設定・Transportを実責務へ照合する。Tool／Surface／Handoff等は本番Consumer未観測として削除未決を保持する。

編集母集団は対応表、本計画、PROJECT_CONTEXT、旧CROS Details冒頭の現況表示の4文書。着手前の契約専門確認で着手可。旧根拠の対象版と成立能力を保持し、Source・秘密Store・Root・Schema・過去Evidence・実行系は変更しない。変更分類は既存CHGの移管前影響調査。契約と品質の限定独立レビュー、文書・直接伝播確認を実施した。規範・準拠基準・Sourceは変更しないため準拠監査・全回帰・実E2Eは対象外。3指摘を統合是正し、両観点の限定再レビューは残指摘0。現在は対応表作成済み・限定独立レビュー済み。Details／QA更新・Owner移管・置換実装・本番接続・旧削除・新契約成立は未完了。現在、追加の人間判断は不要。

#### Access Management詳細の意味具体化 — 2026-10-10

基準Commitは`dcebc3c0`。正式ARCH-000013、SCR-000008／PRT-000008.spec-000012、BHV-000012から[Access Management詳細](../../../06_Architecture/Details/access-management/01_Architecture.md)をCandidateとして具体化する。編集単位は新Details、07の本領域／ARCH13対応、旧cros冒頭参照、ARCH13現況、本計画、PROJECT_CONTEXTの6文書。着手前契約確認は着手可。新Detailsは意味・Owner・情報関係・要求毎認可・通常管理・独立失効・2操作×2入口・同じ回復と部分失敗・秘密境界・品質導出を所有する。

保存Schema、UUID版・名前制約、Role権限語彙、資格期限、具体API／入口、書込み確定・再入場・保持清掃はOPEN。既存Root・Verifier・競合拒否・不変publishは保持候補として照合するが、新保存の完成を主張しない。Source・秘密Store・旧Evidence・Domain詳細・初回Bootstrapは変更しない。移管対応表を設計の第二正本にしない。

変更分類は採用済み契約の詳細設計伝播。固定候補の必須確認は契約と品質の限定独立レビュー、文書・直接伝播確認。規範・準拠基準・Sourceは変更せず、準拠監査・全回帰・実E2Eは今回対象外。現在は作成済み・両観点の限定独立レビュー済み。07は本領域の部分接続だけで、08、Domain集約、MCP／Workbench新Details、Quality／Source・移行・新実境界は未完了。現在、追加の人間判断は不要。OPENを閉じる具体化が上流意味・Authority・秘密公開・保証範囲を変える場合は人間へ戻す。

初回確認の指摘は3件へ統合した。発行・結果記録の確定を配送／受領喪失で不明へ戻さず、故障処置と品質反証を別観測へ訂正した。現在投影の部分接続状態とChecklistのOPEN表示も同期した。両確認者との是正方針照合後、固定6文書の限定再レビューは契約・品質とも全重大度の残指摘0。Source・API・Schema・上流意味・旧Evidenceは不変であり、保存・公開入口等のOPENとCandidate／Partialを維持する。

#### 鍵管理の固定・ローカル入口・MCP非公開 — 2026-10-10

人間は後続対話で、鍵の発行・失効・交換をadministrator専用の固定操作とし、RoleのON／OFF設定を不要とした。通常の鍵操作は同一Process Workbenchから呼ぶ。Hostの回復CLIはログイン済みローカル操作者を信頼し、追加認証・専用資格・承認コード・OS管理者昇格を設けない。対象・影響の事前表示と既存確認は残す。Host入口は鍵交換2操作だけで、通常管理や独立失効を追加しない。既存Root・Path検証は維持する。

鍵発行・独立失効・交換は、Secretを返すか否かを問わずMCPへ公開しない。Tool一覧、Schema、登録、dispatchに含めない。生Secret非保存・一度表示、保持情報・同じ回復・部分結果は維持する。前案の6群すべて可変という判断と発行権限OFFの未決論点は、この判断で置き換えた。残るユーザー管理、Role設定、Repository登録、公開範囲管理の可変性は今回確定しない。

基準Commitは`ba578309`。変更分類は要求判断と公開・認可境界の変更。EXP-000036、REQ-000041、ARCH-000013、AM詳細、本計画、PROJECT_CONTEXTの6文書へ限定反映する。着手前契約確認は着手可・追加人間判断不要。固定候補の必須確認は契約と品質の独立レビュー、差分・文書・限定伝播確認。準拠規則・Sourceは変えないため準拠監査・全回帰・実E2Eは今回対象外。UX・IA・UI・SPEC・SCR／BHV・Architecture分析／横断モデル・07／08・Quality・Sourceへの再伝播は未完了で、前判断のPassを流用しない。実秘密Store・保存Schema・API・過去Evidenceは未変更。

限定独立レビューは契約・品質の両観点を完了した。初回の固有指摘3件（残る4管理群の未確定境界、UX引渡しの旧入口条件、現在状態への旧Pass表示）を統合是正し、同じ6文書の再レビューは両観点とも残指摘0。差分空白とローカルリンク先の存在確認も成功した。これは6文書の限定反映の完了であり、下流再伝播、Source、保存・公開API、実境界、全体Readyは未完了である。

#### 最新鍵管理判断のUX再伝播 — 2026-10-10

基準Commitは`5d9008e4`。REQ-000041だけを正式入力として、同REQのUX分析、UX-000035、UX横断5文書と本計画・PROJECT_CONTEXTの9文書へ限定伝播する。着手前契約確認は着手可。UX-000013は既存の現行権限に基づく非開示条件で追従できるため変更不要。既存の利用者成果・IDは維持し、鍵の固定administrator、Workbench通常入口、追加認証なしのHost交換2操作、MCP鍵操作非公開、4組表示・3組確認と他4管理群未確定を伝える。全入口同値は公開された操作範囲に限定する。

必須確認は固定候補の契約・品質独立レビューと、文書・リンク・差分・限定伝播確認。Source・QA・IA以降・標準規則・ひな型・過去Evidenceは変更しない。規則・実行系を変更しないため準拠監査・全回帰・実E2Eは対象外。現在は限定独立レビュー済み・残指摘0で、UX全体Ready・実装成立を主張しない。追加人間判断は不要。

#### UX再伝播の限定確認結果 — 2026-10-10

今回9文書の契約・品質限定レビューは両観点とも残指摘0。Checker確認で、UX-000035の状態と確認結果を別行へ分離し、REQ-000041分析の比較対象IDと統合理由を既存規則に適合させた。この局所2修正も両観点の再確認で追加指摘0。既存ID・成果・採用意味・Checker規則は変更していない。

全体Checker（`node 40_Develop/checker/bin/checker.ts --root . --json --summary`）は初回3,060件、形式是正後3,058件のerror、warning 0、Exit 1。対象はMarkdown 1,179ファイルで、全体Passではない。変更9文書に残る指摘はPROJECT_CONTEXTの`project-context-projection-contract-invalid`のみで、判定入力のIdentity・五場面見出し・Checklistは基準版と同じ。今回のUX契約レビューと、全体の既存機械不整合を分離する。完全JSON出力は通常検証の一時結果として保存せず、上記コマンドで再取得する。ローカルリンク先不存在0・差分空白確認成功。IA以降・Quality・Source・実境界は未伝播・未成立である。

#### 最新鍵管理判断のIA再伝播 — 2026-10-10

基準Commitは`bba2f8d6`。正式UX-000035から同UXのIA分析とIA-000009、横断4文書へ限定伝播し、UX-000013のIA分析は正式UXが持つ現行権限による可視性・責任表現へ補正する。本計画・PROJECT_CONTEXTを含む9文書が対象。既存ID・Objectと意味上の関係を維持し、鍵操作の固定administrator、Workbench通常入口、MCP鍵操作非公開、ログイン済みHost操作者の交換2操作、追加認証なし、既存Root／Path、4組表示・3組確認、他4管理群OPENを分ける。着手前の契約確認は着手可・追加人間判断不要。

固定候補の必須確認は契約・品質の独立レビュー、文書・リンク・差分と限定伝播確認。両観点とも再レビュー済み・残指摘0。UI／SPEC以降、Quality成果物、Source、標準規則、ひな型、過去Evidenceは変更しない。規則と実行系を変更しないため準拠監査・全回帰・実E2Eは今回対象外。以前の限定Passは最新判断の根拠に流用せず、全IA Ready・実装成立を主張しない。

固有指摘3件（入力元と統合後条件の混同、管理能力図の固定／可変関係、誤記）を一括是正した。Source Identity／Relationの21行を実分析へ全数一致させ、固定説明文とRecovery図のObject名を既存契約へ適合させた。契約・品質の再レビューはともに残指摘0。全体Checkerは初回3,058件、局所形式是正後3,056件error・warning 0・Exit 1で全体Passではない。変更9文書に残る指摘は基準版から判定入力不変のPROJECT_CONTEXTだけ。実行コマンドは前節と同じで、巨大結果は保存しない。ローカルリンク先不存在0、差分空白確認成功。IA以降の全体完成・Source・実境界は未成立。

#### 最新鍵管理判断のUI／SPEC定義再伝播 — 2026-10-10

基準Commitは`a7ec88aa`。UX-000013／UX-000035／IA-000009をそれぞれ独立した正式入力としてUI／SPECの6分析、UI-000008／SPEC-000012、UI横断4文書、SPEC入口・現行対応区画、本計画・PROJECT_CONTEXTの16文書へ限定伝播する。UX13分析へ他入力の鍵条件を逆輸入せず、Definitionで初めて統合する。旧32組のHash・引用・レビュー記録、既存ID、過去Evidenceは維持する。

着手前契約確認は着手可・追加人間判断不要。発行・独立失効・交換の結果を分け、固定administrator、Workbench通常入口、MCP鍵操作非公開、Hostログイン済み操作者の交換2操作、追加認証なし、既存Root／Path、4組表示・3組確認、他4管理群OPENを保持する。固定候補の契約・品質独立レビュー、対応照合、文書・リンク・差分・Checkerを必須確認とする。現在は限定独立レビュー済み・残指摘0。

SCR／BHV、Area、Workbench候補、Visual、Architecture／Quality／Sourceは次段で再伝播し、前判断のPassは最新判断へ流用しない。標準規則・ひな型・実秘密Store・Sourceは変更しないため、準拠監査・全回帰・実E2Eは今回対象外。UI／SPEC工程全体Ready・実装成立は未主張。

UI／SPEC定義再伝播の限定確認結果: 契約・品質の独立レビューは是正後ともにPass、残指摘0。現在状態と更新前固定版の履歴を分離し、OPENの箇条書きと履歴参照を修復した。差分空白・ローカルリンク確認は問題なし。全体CheckerはExit 1で、対象文書の既存構造・集合改訂版・Checklist判定等の16指摘が残るため、Checker Passを主張しない。旧32組のHash・引用・過去Passは保持し、最新1組の限定レビューと区別する。次はSCR／BHV・Area・Workbench候補へ伝播する。

#### 最新鍵管理判断のUI／SPEC詳細再伝播 — 2026-10-10

基準Commitは`3b7168f8`。UI-000008からSCR-000008内のPRT-000008全節、Area Guide、UI Detail入口・Workbench Screen Architecture追補へ、SPEC-000012からBHV-000012・SPEC Detail入口へ独立して具体化し、Detail対応の1 Relationを照合する。当初9文書に上位入口4文書と2Definitionの現在状態同期を加え、計画とPROJECT_CONTEXTを含む15文書を対象とする。新規発行・独立失効・交換を分離し、通常鍵操作の固定administrator・同一Process Workbench、MCP鍵操作非公開、Hostログイン済み操作者の対話交換2操作・追加認証なし・既存Root／Path、4組表示・3組確認、他4管理群OPENを保持する。

着手前整合確認は着手可・追加人間判断不要。専門観点の計画確認からPRT全節、MCP全体と鍵操作の区別、発行／独立失効／交換の結果差を照合対象へ含めた。固定15文書の契約・品質の限定独立再レビューはともに残指摘0。上流入力外の技術境界、上位文書の現況競合、AreaのOPEN処置不足を統合是正した。差分空白確認とローカルリンク先存在確認は成功（不存在0）、未変更31 Relationは基準版と一致。結果だけの状態同期後、2Definitionの現況更新に伴うHashを現行1組対応へ同期する。全体Checkerはerror 3,056件・warning 0・Exit 1、変更15文書の指摘は13件で未通過。限定レビュー結果をChecker全体Passへ読み替えず、全体判定の是正は後続へ残す。巨大結果は保存しない。旧Gate・Visual・未変更31 Relation・過去Evidenceを改変／最新Pass化しない。標準・ひな型・Source・Schema・実秘密Storeは変更せず、準拠監査・全回帰・実E2Eは対象外。Architecture／Quality／Sourceと実画面は後続未完了で、全体Readyを主張しない。

#### 最新鍵管理判断のArchitecture分析再伝播 — 2026-10-10

基準Commit `93cfba7b`。UI-000008／SPEC-000012の独立Architecture分析、ARCH-000013の直接同期、本計画とPROJECT_CONTEXTの5文書を対象とする。鍵3操作の固定administrator・同一Process Workbench、MCP鍵操作非公開、Hostログイン済み操作者の交換2操作だけ・追加認証なし、4組表示・3組確認、参照許可と鍵操作の区別、他4管理群OPENを保持する。新規発行・独立失効へ交換Recoveryを付与せず、交換の相関は旧失効前から同じIDへ結合する。採用済み入口と具体表示・案内の未確認を分離する。

着手前専門確認は着手可。ARCH-000013の旧管理認可・可視境界・入口分担も同期対象へ含めた。固定5文書の契約・品質独立レビューは状態表示の競合1件を共通原因として検出した。前固定版のPassと今回候補を分離し、統合是正後の両観点の限定再レビューは残指摘0。差分空白確認成功、ローカルリンク先不存在0。全体Checkerはerror 3,056件・warning 0・Exit 1で未通過。今回5文書内はPROJECT_CONTEXTの既知指摘1件のみであり、限定レビューを全体Passへ読み替えない。結果の巨大出力は保存しない。旧Evidence・Source・Schema・秘密Store・保存Root・標準・ひな型は変更していない。03〜08横断モデル・新Owner Details・Quality・本番接続は後続未完了とする。実行系・準拠規則を変えないため実E2E・Source全回帰・準拠監査は今回は対象外。現在、追加の人間判断は不要。工程Ready・実装成立・全体Passを主張しない。

#### 最新鍵管理判断のArchitecture境界再伝播 — 2026-10-11

基準Commitは`bcc51f72`。03境界モデルへ最新判断を再伝播し、01入口・02責務表・ARCH-000013の追従状態、本計画とPROJECT_CONTEXTの6文書を同期する。着手前の読み取り専用契約確認は着手可・追加人間判断不要。変更分類は採用済み意味の設計伝播と現在投影の同期。通常鍵操作とMCP一般経路を分け、固定administratorの同一Process Workbench、追加認証なしのHost対話CLI交換2操作だけ、MCP鍵操作の一覧・Schema・登録・dispatch非公開を保持する。他4管理群の担当Role・可変性はOPENとし、現在参照許可と鍵操作権限を混同しない。

新規発行・独立失効・交換を別境界・別結果として扱う。交換Recoveryは旧失効前から同じexact IDに結合し、失効・発行・結果記録・搬送・受領を分離する。発火例はWorkbench鍵3操作とHost交換2操作、非発火例はMCP鍵操作とHost発行・独立失効。通常入口の指定ユーザー交換だけ追加確認なし、残る3組は明示確認とする。対象不明・必要な既存administrator不存在・認可破損・安全な観測不能は新Effect前停止として照合する。

固定6文書の必須確認は契約・品質の限定独立レビューと、文書・リンク・差分・直接伝播確認。共通原因の2指摘（発行／独立失効の対象Identity、管理情報／資格のWriter範囲）を統合是正し、同じ6文書の契約・品質限定再レビューはともに残指摘0。04〜08、新Owner Details、Quality、Source、物理API／Schema／Store、保存Root、旧Evidence、標準・ひな型を変更しない。実行系や準拠規則を変更しないため、Source全回帰・実E2E・準拠監査は今回は対象外。全体Ready・実装成立・本番接続を主張しない。

境界再伝播の限定確認結果: 差分空白確認成功、6文書のローカルリンク102件を確認して不存在0。全体Checkerはerror 3,056件・warning 0・Exit 1で未通過。今回6文書の残指摘は基準版から保持するPROJECT_CONTEXTの契約指摘1件のみで、限定独立レビューを全体Passへ読み替えない。実行コマンドは既出の`node 40_Develop/checker/bin/checker.ts --root . --json --summary`。巨大出力は保存せず、次は04〜08と新Owner Detailsへ最新判断を伝播する。

#### 最新鍵管理判断のArchitecture横断モデル・対応表再伝播 — 2026-10-11

基準Commitは`77d86943`。04状態／データフロー、05故障、06配置の鍵断面、07詳細対応表のARCH-000013、08のSCR-000008／BHV-000012／`PRT-000008.spec-000012`の3行を更新する。01／02／03／ARCH-000013の案内、本計画とPROJECT_CONTEXTの同期を含む11文書が対象。着手前の読み取り専用契約確認は着手可・追加人間判断不要。変更分類は採用済み意味の設計伝播と現在投影の同期である。

新規発行・独立失効・交換の3操作を分け、対象資格のexact Identity、旧失効前の同じRecovery結合、失効・発行・記録・搬送・受領の別事実を反映する。確定発行を後続の記録・配送／受領失敗だけで不明へ戻さない。通常鍵操作は同一Process Workbenchの固定administrator、Hostは信頼したログイン済み操作者の対話CLI交換2操作だけで追加認証なし、MCPの全鍵操作は一覧・Schema・登録・dispatch非公開。他4管理群の操作主体・可変性はOPEN。4組表示・3組確認、保持情報と現在参照許可による非開示を維持する。

07／08はAccess Managementの意味Owner、Domain Modelの認可済みContext集約・中立なRoot／保存部品、Workbenchの通常鍵操作Surface、MCPの鍵操作非公開境界を分ける。08対象3行はPartialとし、新Owner Details・具体API／保存・本番接続の未完了を保持する。残り19 UI行・29 BHV行・31 Relation行、既存ID／Relationは変更しない。Docker／Task／一般Recovery、Source、Quality、物理Schema／API／Store、保存Root、旧Evidence、標準・ひな型は変更しない。

固定11文書の必須確認は契約・品質の限定独立レビュー、文書・差分・リンク・対象外Relation不変とChecker確認。共通原因の2指摘（発行／独立失効の処置前停止、操作別結果Ownerと交換限定Recovery）を05だけで統合是正し、固定11文書の契約・品質限定再レビューはともに残指摘0。新しい実行系・準拠規則を変更しないためSource全回帰・実E2E・準拠監査は今回は対象外。新Owner Details以降と全体Ready・QA Handoff・実装成立は未完了である。

横断モデル・対応表再伝播の限定確認結果: 差分空白確認成功、ローカルリンク210件の不存在0。08の対象外79対応行（19 UI・29 BHV・31 Relation）は基準版と完全一致、全82行と既存Identity／Relationを維持した。是正後の全体Checkerはerror 3,056件・warning 0・Exit 1で未通過。今回11文書にはPROJECT_CONTEXTと08の既知契約指摘2件が残る。限定レビューを全体Coverage・Quality Readyへ読み替えず、新Owner Details・Quality・Sourceへの伝播で後続処置する。巨大実行結果は保存せず、既出のCheckerコマンドで再取得する。

#### 最新鍵管理判断のMCP詳細再伝播 — 2026-10-11

基準Commitは`4248f3bd`。MCP詳細、本計画、PROJECT_CONTEXTの3文書を初回候補とし、節名変更の直接参照を持つ旧CROS比較詳細とWorkbench詳細を加えた5文書を対象とする。両Detailsは当該参照段落とWorkbench直前の同じ鍵行だけを同期し、全面追従を主張しない。採用済み意味の設計伝播と現在投影の同期で、着手前の読み取り専用契約確認は着手可・追加人間判断不要。旧非秘密資格一覧・個別Grant変更・独立失効Tool候補を撤回し、MCPの鍵操作は一覧・Schema・登録・dispatch非公開とする。通常鍵3操作は同一Process Workbenchの固定administrator、Hostは追加認証なしの対話交換2操作だけ、初回Bootstrapと既存Root／Path検証は不変。

MCP要求のCredential認証は存続し、Access Managementが現在userId／Role・Exposure・Binding・実アクセスを評価する。Domainは認可済み集合の意味解析・集約だけを担当する。Profile／Activityの既存非鍵能力と型名は移管比較入力として維持し、旧systemAdmin・資格固定Grantを新Canonicalへ採用しない。他4管理群と新Role割当・具体型はOPEN。鍵断面の担当RelationはPartial、他Relationは今回再評価せず、旧Evidenceも不変である。

発火例は非秘密一覧・失効を含む鍵Tool公開要求、非発火例はMCPのBearer認証と認可済み非鍵能力。別Process WorkbenchもMCPでは鍵操作不能とする。管理群のRole・具体API・保存・本番接続不明はOPENのまま保持する。変更意味からMCP全登録閉包・直接Call拒否・鍵Owner呼出し0と認証継続のIT／ST観測をQualityへ渡すが、QA Local Item・Source・実境界は未更新である。

必須確認は固定5文書の契約・品質限定独立レビュー、差分・ローカルリンク確認。初回3文書のレビュー結果を全数統合し、旧Host全喪失語1箇所と直接参照2箇所・近傍の同じ旧鍵行を是正した。両レビューへ統合是正方針を再提示して整合を確認し、固定5文書の限定再レビューは両観点とも全重大度の残指摘0。差分空白確認成功、ローカルリンク77件の不存在0、旧アンカー参照0、MCP localhost Transport lifecycleは基準版と一致した。全体Checkerはerror 3,056件・warning 0・Exit 1で、今回5文書内はPROJECT_CONTEXTの既知指摘1件だけである。巨大結果は保存せず、限定Passを全体Passへ読み替えない。実行系・標準・秘密Store・Schema・Transport lifecycle／TLS／Originは変更しないため、Source全回帰・実E2E・準拠監査は今回は対象外。Workbench／Domain詳細、Quality、Source、本番接続は後続未完了。全体Ready・実装成立を主張しない。

#### Workbench／Domain詳細の新Owner境界再伝播 — 2026-10-11

基準Commitは`0f5b7765`。Workbench・Domain詳細と01／02／ARCH-000013／07／08の現在状態、計画・PROJECT_CONTEXTの9文書を対象とする。着手前の読み取り専用契約確認は着手可・追加人間判断不要。通常鍵操作の同一Process administrator固定、MCP全鍵操作非公開、Host交換2操作だけを維持する。交換4組表示／3組確認を通常発行・独立失効へ転用しない。Domainは認可済み集合の意味集約と中立なRoot／保存部品だけを所有し、認可状態・資格Secret・交換Recoveryを引き取らない。

固定候補の契約・品質独立レビューで固有3件（現行設計の旧認可語、交換の保持範囲、Domain末尾のRelation欠落）を検出し、全結果を統合した。冒頭の旧Quality観測表は全セルを履歴として保持し、現在導出と混在させない方針を両レビューへ再提示して是正した。限定再レビュー結果は次段落に記録する。具体API・物理Schema・保存・受領方式、Quality導出、Source・本番接続はOPEN。旧Evidence・Visual・UI／SPEC Identity・対象外Relation・既存Root／保存保証・初回構築は変更しない。Sourceや準拠規則を変えないため全Source回帰・実E2E・準拠監査は今回は対象外。差分・リンク・対象外不変とCheckerを確認し、限定設計伝播を全体Readyへ読み替えない。

限定確認結果: 意味上の固有3件と表構造の1件を是正し、固定9文書の契約・品質限定再レビューはともに全重大度の残指摘0。ローカルリンク229件の不存在0、08の全82対応行は基準版と一致。Workbenchの旧Quality観測8行とReality13行は全セル不変。差分空白確認成功。全体Checkerはerror 3,056件・warning 0・Exit 1で未通過。対象内はPROJECT_CONTEXTと08の既知契約指摘2件で、後続Quality／投影整合で処置する。巨大出力は保存しない。境界の設計候補伝播だけの限定完了であり、具体API・保存・受領方式、Quality・Source・本番接続・全体Readyは未完了。現在、この限定作業について追加の人間判断は不要。

#### 最新鍵管理・現在認可のQuality再導出 — 2026-10-11

基準Commitは`b6682e6b`。QA-000007／QA-000009、REQ（000011・000041）／UX（000013・000035）／IA-000009／UI-000008／SPEC-000012／ARCH-000013、SCR-000008／PRT-000008・BHV-000012・RelationとAM／Workbench／MCP／Domain詳細を入力母集団とする。着手前整合確認で検証責務の分離を補強し、追加人間判断なしで着手した。初回9文書の必須契約・品質レビューを全数統合し、表配置・適用と導出接続・現行認可・固定管理者負例・保持情報・交換再入場・到達範囲を是正した。統合方針は両確認者と整合済み、限定再レビューと4セル追従の最終確認は全重大度の残指摘0。

最新鍵管理・現在認可・認可済みDomain集約のQuality再導出は、QA-000007／QA-000009と7工程分析の固定9文書で契約・品質の限定独立レビューを完了し、全重大度の残指摘0。新規4項目（RFD-IT-017通常発行、018独立失効、019認可済み集約、EST-ST-015 MCP鍵操作非公開）と既存更新項目はNot Runである。旧Evidenceは旧契約の歴史的証跡として維持し、新契約のPassに流用しない。Test Symbol・実行・新Evidence、具体API・Schema・Store、他4管理群の担当Role／可変性、Source移管・本番接続は未完了。全体Quality Ready・Release可能を主張しない。

差分空白確認は成功。初回変更9文書のリンク872件は不存在0、Checker全体は既知error 3,056・warning 0・Exit 1で未通過。Source・設定・秘密・旧Evidenceは変更せず、実回帰・Provider／Docker実E2E・準拠監査は今回の文書設計対応では実行しない。後続は具体API・保存・受領契約と移管Source／Testへの接続であり、設計Passを実行Passにしない。

#### 業務管理と管理者資格・鍵の分担 — 2026-10-11

Qual-Labは、managerを業務上のアクセスを決める信頼された管理担当者とし、administratorを鍵と管理者資格の管理担当者とする分担を採用した。正式な操作別担当Roleは[REQ-000041](../../../01_Discovery/Definitions/REQ-000041/requirement.md#要求)が所有する。manager自身の内容範囲も明示設定で変更可能とする一方、管理者資格の付与・解除・変更と鍵3操作はadministrator専用である。登録だけで公開せず、登録解除はProduct Dataを削除しない。Role設定による固定境界の迂回は許可しない。

変更分類は人間が採用した権限分担の要求への反映。基準Commitは`d6fc1844`。今回の編集対象はREQ-000041・本計画・PROJECT_CONTEXTの3文書だけとし、下流への伝播完了や実装成立を主張しない。着手前の読み取り専用契約確認は着手可・追加判断不要。表の全操作、manager自身の明示変更、administratorの降格拒否、登録と公開の分離を代表例として照合する。標準規則・Source・設定・秘密Store・旧Evidence・既存Host交換2操作・MCP鍵非公開は変更しない。ユーザー削除、委任Framework、承認Workflowは追加しない。

固定3文書の独立契約レビューと差分確認を行う。影響伝播は未完了としてUX→IA→UI／SPEC→Architecture→Quality→Sourceへ追跡する。旧4管理群OPENは履歴として保持し、今回の正式担当Roleへ置き換える。具体API・Schema・保存・初回設定・本番接続は未完了のままで、以前の限定Passを新判断の根拠に流用しない。Sourceを変更しないため実回帰・Docker／Provider E2Eは今回実行せず、CRDD準拠規則を変えないため準拠監査も対象外とする。

限定確認結果: 上流3文書の独立契約レビューで現在投影の旧OPEN残存1件を検出・是正し、同じ3文書の限定再レビューは全重大度で残指摘0。差分空白確認成功、ローカル参照45件の不存在0。Source・秘密・旧Evidenceは不変。これは担当Role判断の上流反映だけの確認であり、下流伝播・実装・Quality・実境界は未完了である。

#### 権限分担のUX伝播 — 2026-10-11

基準Commitは`d6fc1844`と、その後に採用済み判断を反映・限定独立レビューした上流3文書の作業差分。正式入力はREQ-000041だけとする。分析・UX-000035・横断5文書に業務管理と管理者資格・鍵の分担を伝播し、本計画とPROJECT_CONTEXTを同期する。既存UX-000035へのSame統合とし、UX-000013は現在Role／Exposure／実アクセスの成果が不変のため変更不要とした。新UX・権限語彙・画面・API・Schema・保存方式を追加しない。

着手前の契約・品質確認はともに着手可。manager自身の明示範囲変更、変更前の現在権限と次要求反映、administratorの降格を含む変更拒否、developer管理拒否、登録≠公開、解除≠Product Data削除を、担い手・Same比較・導線・責任境界・失敗・品質期待・引渡し・検証意図へ接続する。鍵MCP非公開、Workbench通常鍵管理、Host交換2操作、名前非Authority、三可視境界、単体非依存、既存Recovery条件は保持する。

固定9文書の契約・品質独立レビューと文書／リンク／差分確認を行い、全結果統合後に是正する。IA以降・QA Local Item・Source・本番接続・実境界は未完了。以前のPass・旧Evidenceを新判断へ流用しない。Source・実行境界・準拠規則を変更しないため、実回帰・Provider／Docker E2E・準拠監査は今回対象外とする。

限定確認結果：契約・品質の独立レビューは最終ともにPass、残指摘0。初回4件と再確認2件を統合是正し、担い手の冒頭説明、資格喪失条件、鍵3操作の検証・引渡し、登録・登録解除、旧確認結果の履歴限定、交換ごとの発行先を明確にした。既存UX IDとSame判断は不変、差分確認は成功した。Checkerはerrors 3,056・warnings 0で未通過であり、対象内のPROJECT_CONTEXT形式指摘も残る。この限定結果を全体の機械検査Pass・QA実行・Source実装・本番接続・Release可能の根拠にしない。次はIA以降へ最新分担を伝播する。

<a id="quality-role-propagation"></a>

## 最新権限分担のQuality伝播 — 2026-10-11

基準Commitは `14b51821`。採用済み固定8操作と通常6操作をQA-000007／009、7工程分析、Quality Center、本計画、PROJECT_CONTEXTの12文書へ伝播する。変更分類は採用済み要求の検証設計・現在投影更新。着手前の契約・品質の読み取り専用確認は両方着手可・追加人間判断不要。固定管理許可と可変内容権限、managerのadministrator表示名のみ変更、管理許可≠内容取得、登録≠公開、解除≠削除、通常管理にはadministrator存在を要求しない条件を維持する。

| 検証責務 | 処置 | 段階／観測境界 |
|---|---|---|
| 固定8操作×三Roleの純粋判定 | RFD-UT-020追加 | UT／外部境界N/A |
| 通常6操作の入力・変更前認可・保存・読戻し | RFD-IT-021追加 | IT／Direct Boundary |
| Workbench公開入口から結果表示・次要求まで | RFD-ST-022追加 | ST／System/E2E |
| 利用者による分担・対象・受理と利用可否の理解 | RFD-UAT-007更新 | UAT／User Acceptance |
| 採用済み非鍵入口の搬送同値、非採用入口非公開 | EST-IT-010更新 | IT／Related 2 Blocks |

鍵操作のRFD-ST-016／IT-017／IT-018、内容認可のST-003／004／IT-013、Domain集約IT-019、MCP鍵非公開EST-ST-015の責務は保持する。新規・更新項目はNot Run。各Sourceの固有条件、段階、Local Itemを全7分析へ接続する。現在のLocal Itemは定義内ID重複排除で182→185件、QA-000007は19→22件。旧Evidence・ID・Source・Test・秘密・保存Rootは変更しない。

固定12文書を契約・品質の独立レビューへ渡し、全結果を統合してから是正する。文書・直接伝播・参照・表構造の確認を行う。実装・標準規則を変えないためPackage実回帰・Docker／Provider E2E・準拠監査は対象外。Quality Integration全体の一覧追従、具体API・保存・Source・Test・実境界は後続であり、全Quality統合完了・Quality Ready・Release可能は主張しない。Profile管理Roleは別途OPEN。現在、人間による追加判断は不要。

限定確認結果：契約・品質の初回指摘を統合して7点を是正し、再確認の表現1箇所も処置した。最終は両観点とも限定Pass・全重大度の残指摘0。ローカル参照938件は欠落0、185 Local Itemの再集計とQA7検証表13列の連続性を確認。差分空白確認成功。Checkerはerrors 3,056・warnings 0・exit 1で全体未通過。レビュー後は結果と待ち状態のみ同期する。新規・更新項目Not Run、具体API・保存・Source・Test・本番接続・全Quality統合とReady未成立は維持する。次は具体的な公開API・保存契約の設計照合であり、旧Evidenceを改変せず、不要なFrameworkやRecoveryを増やさない。

<a id="architecture-role-detail-propagation"></a>

#### 権限分担のArchitecture詳細伝播 — 2026-10-11

基準Commitは`8a50c3c0`。AM／Workbench／MCPの3詳細だけへ採用済みARCH-000013の固定8管理分担を具体化し、ARCH-000013・横断01〜08の9文書は現在状態だけ同期する。本計画・PROJECT_CONTEXTを含む固定14文書を対象とする。着手前の読み取り専用契約・品質確認はいずれも着手可・追加人間判断不要。変更分類は採用済み意味の詳細設計への直接伝播で、新しい権限・一般IAM・Frameworkは追加しない。

編集の一次単位は認可・操作別入力・処置・結果・非公開の責務である。AMの固定管理認可とRole内容設定、通常6操作、managerのadministrator名前だけ変更、変更前認可→明示更新→次要求の内容評価、登録≠公開／解除≠削除、通常管理と鍵処置の固有条件を分ける。WBは入力・表示、MCPは非鍵要求搬送だけを具体化し、鍵の一覧・Schema・登録・dispatch非公開を維持する。Profile管理Role・具体API／Schema・保存・本番接続はOPEN。通常管理の保存後不明を未保存・rollback・Effect0へ丸めず交換Recoveryを追加しない。

固定14文書の契約・品質独立レビューと文書・直接伝播・参照・差分確認を実施する。代表照合は固定8分担×三Role、操作別対象、manager正常管理に管理者存在不要、Host追加認証なし、自己内容変更の時間順、通常失効の対象限定、内容・登録・公開・削除の別意味である。Quality導出キー・安定ID・07／08のPartial・他Relation・歴史Evidenceを維持する。Source・実行境界・準拠規則を変えないためPackage回帰、Provider／Docker E2E、準拠監査は対象外。候補反映・限定独立レビュー済み・残指摘0であり、全体Ready・Release可能は主張しない。

限定確認結果：初回は契約Minor 1・品質Pass 0。全結果と是正方針を一括統合し、AM詳細の未確定範囲を示す2箇所を内容権限の具体語彙へ限定した。最終は契約・品質とも限定Pass・全重大度の残指摘0。ローカル参照245件は欠落0、差分確認成功。Checkerはerrors 3,056・warnings 0・exit 1で全体未通過。レビュー後は限定結果の状態のみ同期する。次はQualityへの最新分担伝播で、Source・本番接続・全体Readyの未完了を維持する。

<a id="architecture-role-model-propagation"></a>

#### 権限分担のArchitecture基本設計・横断伝播 — 2026-10-11

基準Commitは`2e5462bf`。正式意味入力はUI-000008／SPEC-000012のArchitecture分析2件、SCR／BHVは配置制約の照合に限定する。ARCH-000013と横断01〜08の9設計文書、本計画とPROJECT_CONTEXTの計11文書を固定対象とする。採用済み分担の直接伝播で、契約・品質の着手前確認はともに着手可・追加人間判断不要。Details・Quality・Source・設定・過去Evidence・他ARCH-ID・非対象Relationは変更しない。

ARCH-000013を固定8分担の統合正本とし、横断はComponent所有、交換境界、操作別入力・時間順、失敗、実行単位、Detail対応の固有断面へ投影する。変更前の現在管理認可→明示更新→次要求の内容再評価、管理≠内容、登録≠公開、解除≠削除を維持する。通常管理と鍵処置の停止条件を分け、manager正常管理にadministrator存在条件、Hostに追加資格認証を要求しない。Role内容設定による固定管理分担の再委譲を設けない。

固定11文書の契約・品質独立レビュー、文書・直接伝播・参照・差分確認を行う。代表照合は8操作×三Roleの許可／拒否／不明、managerのadministrator名前のみ変更、developer管理拒否≠自身利用拒否、操作別対象、自己内容変更の時間順、登録／公開／取得と解除／削除、鍵3操作の過剰Effect反証。旧鍵契約Passは履歴であり、今回候補は独立レビュー待ち。実行境界・Source・準拠規則を変更しないためPackage回帰・Provider／Docker E2E・準拠監査は対象外。07／08のPartialと非対象行を維持し、Architecture詳細・Quality・Source・本番接続・全体Readyは未完了。

限定確認結果：初回は契約Moderate 1・Minor 1、品質Pass・残指摘0。全結果と是正方針を一括統合し、表示名の旧設定主体表現1件・文境界空白2件を是正した。最終は契約・品質とも限定Pass・全重大度の残指摘0。ローカル参照212件は欠落0、差分確認成功。Checkerはerrors 3,056・warnings 0・exit 1で全体未通過。レビュー後は限定結果の状態のみ同期する。ARCH-ID・非対象RelationとPartialを維持し、旧Evidenceは不変。次はAccess Management／Workbench／MCP等のArchitecture詳細へ最新分担を伝播する。Quality・Source・本番接続・全体Readyの未完了は維持する。

<a id="architecture-role-analysis-propagation"></a>

#### 権限分担のArchitecture入力分析伝播 — 2026-10-11

基準Commitは`ea99450f`。UI-000008／SPEC-000012のArchitecture分析2件を、それぞれ自身のDefinitionだけから更新する。本計画・PROJECT_CONTEXTの状態同期を含む固定4文書が今回の範囲である。変更分類は採用済み分担の直接伝播。契約・品質の着手前整合確認はともに着手可、追加人間判断は不要。ARCH-000013・横断モデル・Architecture詳細・Quality・Source・設定・過去Evidenceは変更しない。

固定8管理操作を現行Roleから判定し、Role内容設定と分離する。UI分析は対象認識・操作・Feedback、SPEC分析は操作別入力・処置前認可・Effect・結果へ接続する。managerのadministrator表示名変更は許可、管理者付与・解除・降格・詳細権限・鍵は拒否。新規登録は予定Role、既存Role変更は前後Role、内容設定は対象Role、Repository管理は登録／公開状態を用いる。manager自身の変更前認可→明示更新→次要求で現行Role・Exposure・実アクセス再評価、管理≠内容、登録≠公開、解除≠削除を保持する。

固定4文書の契約・品質独立レビュー、文書・直接伝播・リンク・差分確認を行う。代表例は8操作×三Roleの許可／拒否、administrator名前のみ変更、登録予定Roleと既存前後Role、自己範囲変更の時間順、対象／現在認可不明の新Effect前停止である。既存鍵3操作・Host／MCP・秘密・交換専用Recoveryを保持し、developer管理拒否を自身表示・許可内利用拒否へ広げない。新API・Schema・一般IAM・Recoveryは追加しない。Source・実行境界・準拠規則を変更しないため、Package回帰・Provider／Docker E2E・準拠監査は対象外。固定候補提出時は限定独立レビュー待ちであった。分析2件の確認をArchitecture全体Ready・実装・QA実行の成立へ読み替えない。

限定確認結果：初回の契約Moderate 1・品質Minor 1を一括統合し、両確認者へ是正方針を再提示して整合した。通常管理と鍵処置の停止条件、PROJECT_CONTEXTの部分伝播表示を是正。最終再レビューは両観点とも限定Pass・全重大度の残指摘0。ローカル参照49件は欠落0、差分確認は成功。Checkerはerrors 3,056・warnings 0・exit 1で全体未通過。レビュー後は限定結果と状態のみ同期する。ARCH-000013・横断モデル・Architecture詳細・Quality・Source以降は最新分担へ未追従であり、次はARCH-000013と横断モデルへ伝播する。

<a id="ui-spec-role-detail-propagation"></a>

#### 権限分担のUI／SPEC詳細伝播 — 2026-10-11

基準Commitは`e3df322d`。正式入力は限定独立レビュー済みUI-000008／SPEC-000012。SCR-000008、BHV-000012、configuration-trust Area、Workbench画面体系の現行§13、UI／SPEC詳細対応、詳細入口2文書、本計画とPROJECT_CONTEXTの固定9文書を対象とする。契約本文・Hashが固定されたDefinition、旧G1〜G5、非対象31 Relation、過去Evidence、新ID・Visual候補・Architecture／Quality・Source・設定・秘密Storeは変更しない。

変更分類は採用済み分担の詳細化・直接伝播。親照合と契約／品質の着手前確認を統合し、詳細入口の状態追従2文書を補強した。初回編集前確認は両観点で着手可・追加人間判断不要。固定8操作をUI操作表とBHVのInput・Authority／Validation・Effect・Outputへ接続する。登録予定Roleと既存変更前後Role、表示名だけの変更、Role内容設定、Repository登録／公開状態を分ける。managerによるadministrator表示名変更は許可するが、administrator付与・解除・降格・詳細権限・鍵は拒否する。developer管理拒否を自身表示・許可内利用の拒否へ拡張しない。

manager自身の範囲変更は変更前の現行固定管理認可→明示内容更新→次要求のRole・Exposure・実アクセス再評価とする。更新受理≠取得成立、管理≠内容自動付与、登録≠公開、解除≠Repository／Product Data削除を保持する。現在認可・対象・必要状態不明は新Effect前停止。鍵3操作のWorkbench／Host／MCP境界、4組事前表示・3組明示確認、既存交換専用Recoveryは不変で、新IAM・一般Recoveryを追加しない。

固定9文書へ契約・品質独立レビュー、文書・リンク・直接伝播・ID・差分確認を行い、両結果を統合してから是正する。代表例は8操作の各Role許可／拒否、managerのadministrator名前のみ変更、登録予定Role、Role変更前後、manager自己内容変更の時間順、対象／現在認可不明、鍵操作の範囲外Effect非発行である。Source・実行境界・準拠規則を変更しないため、Package回帰・Provider／Docker E2E・準拠監査は今回対象外。固定候補提出時はレビュー待ちであった。詳細設計の限定確認を実画面・保存・認可実装・QA実行・本番接続・全体Readyへ読み替えない。

初回固定9文書の結果は契約Moderate 3・Minor 1、品質限定Pass・残指摘0。全結果を統合し、両確認者へ是正方針を再提示して整合した。Repository操作のTrigger列挙、鍵失敗の保持条件の適用範囲、最新8操作のArchitecture／Quality引渡し未伝播範囲、空行を是正した。9文書のローカル参照373件は欠落0、旧G1〜G5本文・非対象31 Relationは不変。Checkerはerrors 3,056・warnings 0・exit 1で全体未通過。新固定候補の再レビューと最終局所確認は契約・品質とも限定Pass・全重大度の残指摘0。最後のSPEC詳細入口のArchitecture／Quality責務分離も確認済みである。確認後は固定9文書の限定結果・状態だけを同期した。旧結果を最新候補のPassへ流用せず、実画面・本番認可・QA実行・Source・実E2E・全体Readyは未成立のまま保持する。次はArchitectureへ最新分担を伝播する。

<a id="ui-spec-role-propagation"></a>

#### 権限分担のUI／SPEC定義伝播 — 2026-10-11

基準Commitは`9ecad6ea`。正式入力はUX-000013／UX-000035／IA-000009。UX35／IA9のUI分析・SPEC分析4文書、UI-000008／SPEC-000012定義、UI横断01／02／03／05、SPEC横断01／06、本計画とPROJECT_CONTEXTの固定14文書を扱う。UX13分析・ID集合・Detail／Visual・Architecture／Quality・Source・設定・秘密Store・過去Evidenceは不変更。SPEC横断02〜05は担当Roleの旧規則を持たない一般モデルであり、今回意味を追加せず参照先の定義で精緻化する。

変更分類は採用済み分担の下流詳細化・直接伝播。着手前の契約／品質確認を統合し、UIの正式引渡しを対象に補強した。各分析は正式入力一件から独立導出し、定義で統合する。8操作固定分担、managerの管理者表示名変更と管理者Role変更の別、自己範囲の変更前認可→明示更新→次要求反映、登録≠公開・解除≠削除を操作・事前条件・結果・拒否・検証意図へ接続する。固定管理能力をRole内容設定から派生させず、設定による管理委譲を追加しない。鍵3操作・MCP鍵0・Host交換2・4表示3確認・既存Recovery境界は維持する。

代表照合はmanager業務管理許可、administrator表示名変更許可、managerの管理者付与／解除／降格／詳細権限／鍵拒否、developer管理拒否、対象／現在認可不明の新Effect前停止。UI表示だけで認可を代替せず、内容範囲更新受理を取得可能・開始済み取消へ拡張しない。対応レビューは現行1組を8観点で確認し、旧32組・Hash・引用・Passは履歴として維持する。

固定候補の契約／品質独立レビュー、文書・直接伝播・リンク・ID・差分確認を行う。全必須レビュー結果を統合してから是正する。標準規則・実行境界・Sourceを変更しないため準拠監査、Package回帰、Provider／Docker実E2Eは今回対象外。固定候補提出時は作成者照合済み・独立レビュー待ちであった。Detail以降・QA実行・Source・本番接続・全体Readyは未完了。現在追加の人間判断は不要。

限定結果：契約／品質独立レビューの統合6指摘と再レビューの表現1指摘を是正し、最終は両観点とも限定Pass・全重大度の残指摘0。Host回復の発火条件、鍵3操作の結果差、新規登録と既存変更の前提差、過剰Effectの反証、現行／履歴の区分、レビュー入力Hashを精緻化した。最終状態同期前に確認した16文書の参照先832件は欠落0、旧32組の対応本文と旧Hashは不変、新ID・Source変更なし。Checkerはerrors 3,056・warnings 0・exit 1で全体未通過。レビュー後は状態と結果記録のみ同期し、UX35定義ヘッダー・UX概要の2箇所もUI／SPEC定義限定確認済み／Detail以降未伝播へ追従した。レビュー入力と状態同期後のDefinition Hashは現行対応へ別記した。Detail・Visual・Architecture／Quality・Source・本番接続・全体Readyは未完了。次はSCR／BHV・Area・Workbench候補の詳細伝播である。

#### 権限分担のIA伝播 — 2026-10-11

基準Commitは`c04ccd69`。正式入力は限定レビュー済みUX-000035であり、UX-000013の利用成果・分析は不変。UX35のIA分析、IA-000009定義、IA横断4文書、本計画とPROJECT_CONTEXTの固定8文書に限定する。変更分類は採用済み権限分担の下流詳細化・直接伝播。新しいIA ID・Object・API・Schema・Source・秘密Store・旧Evidenceは変更しない。

着手前の契約・品質確認はともに着手可。既存IA9へSame統合し、Source欄のUX13意味を保持してUX35由来の固定担当Roleを精緻化する。8操作の許可／拒否、manager自身の変更前認可・明示範囲更新・次要求反映、administrator表示名変更と管理者資格変更の分離、登録≠公開・解除≠削除をObject属性・関係・導線・可視性・時間関係・検証意図・引渡しへ接続する。鍵3操作の結果差、Host交換2操作、MCP鍵0、既存Recovery境界は不変。判定情報不足は許可へ畳まない。

代表照合はmanagerの業務更新を許可、managerのadministrator降格・developer管理を拒否、administrator表示名だけの変更を許可、現在権限・対象不明は停止。固定候補の契約／品質独立レビュー、文書・直接伝播・リンク・ID・差分確認を行い、全結果統合後に是正する。標準規則と実行境界を変更しないため準拠監査・実回帰・Provider／Docker E2Eは今回対象外。UI／SPEC以降・QA実行・Source移管・本番接続・全体Readyは未完了。現在追加の人間判断は不要。

限定確認結果：固定8文書の契約・品質独立レビューは最終ともにPass、全重大度の残指摘0。固定管理能力をRole詳細権限から派生させない図、一次IAモデルの鍵3操作結果、横断投影の文境界を統合是正した。参照先152件は欠落0、既存ID集合は不変、差分確認は成功。Checkerはerrors 3,056・warnings 0・exit 1で全体未通過（対象内PROJECT_CONTEXTの形式指摘を含む）。レビュー後は結果記録と状態同期だけを行い、上流UXの未伝播表示2箇所もIA限定確認済み／UI・SPEC以降未伝播へ直接追従した。これは契約本文の再変更でも全体Readyでもない。実回帰・実E2Eは未実行、QA実行・Source・本番接続は未完了。次はUI／SPECへの伝播である。

#### 管理権限の初期割当 — 2026-10-10（6群表全体が旧提案の履歴）

以下は現在の割当契約ではない。鍵3操作は後続判断でadministrator専用固定へ置換し、他管理群は2026-10-11の業務管理と管理者資格・鍵の分担で確定した。当時の未確定表示を現在判断として使わない。

人間は、管理操作を以下の6群として個別設定し、初期状態ではadministratorだけへ許可する案を承認した。後からRole設定を変更できる。ユーザー／Credential単位の追加権限とRole継承は追加しない。

| 管理操作群 | administrator初期値 | manager初期値 | developer初期値 |
|---|---|---|---|
| ユーザー登録・表示名／Role変更 | 許可 | 不許可 | 不許可 |
| Role詳細権限変更 | 許可 | 不許可 | 不許可 |
| 資格発行・独立失効 | 許可 | 不許可 | 不許可 |
| 指定ユーザー／全員の鍵交換（通常入口） | 許可 | 不許可 | 不許可 |
| Repository登録管理 | 許可 | 不許可 | 不許可 |
| Repository公開範囲管理 | 許可 | 不許可 | 不許可 |

既存内容範囲の初期値（developer=Development、manager=Development＋Management、administrator=内容なし＋System管理）はREQ-000041の採用意味を保持する。管理と内容閲覧を分離し、Hostの鍵交換はOS Authorityとして上表の外に置く。Task・AI依頼・Git Push・受入判断をこの6群へ含めない。現在Roleの変更前権限と期待改訂で変更要求を認可し、変更結果を次要求から使う。機械キー・Schema・保存・公開API・Sourceは未変更である。

当時の着手前確認では、administratorから資格発行権限を外せる設定と全員交換後の再発行との境界を未確定とした。これは後続判断で鍵操作を固定契約としたため、現在の判断待ちではない。仮説だけを理由に権限保護の追加ガードや回復機構を作らない。

変更分類は採用済み管理権限の詳細化と未決境界の記録。基準Commitは`ba578309`。今回の追記は判断履歴であり、AM詳細の第二正本ではない。正式REQ・UX以降の設計・品質・Sourceへの伝播は未着手。新しい認可Framework、共有State、Lock、秘密Store、旧Evidence変更は行わない。後続では契約・品質の限定独立レビューと直接伝播を確認し、標準規則・実行系を変更しない段階では全回帰・実E2Eを完成根拠として要求しない。

#### 採用前のInput整理（履歴）

以下の未確定表示は追加Inputを受けた時点の記録であり、現在の採用範囲は上記を優先する。

人間は、接続主体、`developer`／`manager`／`administrator`のRole、およびRoleに対する詳細権限設定を分ける構造を希望した。さらにユーザーの独立IDとCredentialの紐付け、Credentialのリセットを提示した。これは既存の「ユーザー管理なし・Role別共有Credential」とも、現行Sourceの「Credential単位の明示Grant」とも異なる方向であり、Package改名だけの変更として扱わない。先の固定三Role維持というAI推奨を、この新Inputの採用判断へ流用しない。

| 項目 | 人間から確認できた方向 | AIの具体化候補／未確定事項 |
|---|---|---|
| 接続主体 | Credentialとは独立したユーザーIDにCredentialを紐付ける | 非秘密の`userId`をUUIDとする。UUIDの具体版、表示名、発行・無効化の操作は未確定 |
| Roleと権限 | ユーザーのRoleとRoleに対する詳細権限設定を分ける | Repository／Workspace／操作範囲と管理能力をRole設定へ置き、Credential単位で任意の追加権限を作らない案。権限語彙・一ユーザーに割り当てるRole数は未確定 |
| Role識別名 | 人間は`developer`／`manager`／`administrator`を提示した | 既存`management`から`manager`への正式識別子変更と保存移行は未実施。名前の置換だけで権限意味を変更しない |
| Credentialリセット | ユーザーへの紐付けを持ち、リセット可能にする | ユーザーID・Roleを保持し、旧Credentialを失効して新しい秘密値を発行する。旧Credentialの以後の接続を拒否する案。既存の進行中操作の取消を自動的に保証せず、開始済みEffect・再認可の境界は設計で照合する |
| 管理規模 | 詳細な登録Workflowは今回のInputでは要求されていない | 最小構成はユーザーID・Role・Credential紐付けのみとし、氏名・メール・Password・登録申請・外部IdPを追加しない提案。v0.22に含める最小範囲について認識確認待ち |

担当責任者・採用判断者はQual-Lab。このInputは同じCHGのAccess Management再編へ接続し、新しいCHGやIAM Frameworkを作らない。正式採用時はREQ-000041のUser／Principal管理対象外と任意Grant不採用判断を確認して、UX／IA／UI／SPEC／ARCH／QAへ伝播する。既存CredentialをUUIDユーザーへ機械的に移すか、再発行するかは保存・秘密保護の影響を確認して決める。実秘密値を調査資料・Git・Project Contextへ複製しない。Source、秘密Store、保存Schema、Roleの意味、過去Evidenceはこの記録更新では変更していない。


#### 初回Host設定のQuality分析伝播 — 2026-10-11

基準Commitは`4933f9d4`。採用済み初回設定をREQ／UX／IA／UI／SPEC／ARCH／Detailの7品質分析へ伝播し、本計画・PROJECT_CONTEXTと合わせた固定9文書を扱う。変更分類は採用済み設計からの検証義務導出・直接伝播。着手前契約確認は着手可、追加の人間判断なし。

REQ〜ARCHは対象Source各1複合義務、Detailは3処置行として未接続差分を明示する。これは必要Local Item数ではない。正の成立・保存・回復はQA-000007、MCPの四面と状態照会非公開はQA-000009へ引渡す候補。ARCHだけ初回純粋判定のUT Required候補を保持し、固定8管理操作のRFD-UT-020を流用しない。既存185項目の件数・過去限定Passと新義務の充足を区別する。未定義をNot Runや差分0へ畳まない。

初回編集前に両方の未初期化確認、既存管理状態の拒否、観測不能、部分発行、受け渡し／受領不明、同じ元試行の再観測と別の明示交換を照合した。秘密・Store・Root・旧Evidence・Source・新ID・QA Definitionは不変更。固定9文書の契約／品質独立レビュー、文書・直接影響・参照・差分確認を実行する。標準規則・実行境界を変更しないため準拠監査・実回帰・Provider／Docker E2Eは対象外。レビュー完了後に結果を同期してPhase単位でコミットする。契約・品質の限定独立再レビューは両方Pass、全重大度の残指摘0。四状態表記、Process喪失時の新Process再観測、UTと外部境界の別軸、追加文の空白を統合是正した。参照先849件欠落0、非対象の対応表439行不変、差分確認成功。結果・状態だけを同期し、初回義務の定義・実行・全体Readyは未成立を維持する。次はQA-000007／QA-000009でSame／New／Mergeを評価し、DefinitionとLocal Itemを確定する。


#### 初回Host設定の検証項目定義 — 2026-10-11

基準Commitは`d4fc6f86`。QA-000007／QA-000009、7工程分析、Quality Center／Integration、本計画・PROJECT_CONTEXTの固定13文書を扱う。変更分類は採用済み義務の検証設計と直接伝播。着手前の品質確認は着手可、追加人間判断なし。初回5項目をNew、MCP非公開はEST-ST-015へSame統合する。純粋判定／保存直接境界／新Process再観測と別交換引渡し／実Host縦断／利用者達成は独立に計画・結果記録でき、通常管理の前提・入口と異なるため分ける。新しいQA-ID・API・Store・Source・秘密Root・旧Evidenceは変更しない。

UTはARCH由来だけ、ITは相関確定前Effect0と既知Root準備Effectの別、3時点Process喪失・同元試行新Process読戻し・現在Host再照合・両確定後だけ別明示交換、STは一度配送／受領／通常接続を個別観測、UATは四状態・次行動・正常達成を確認する。MCPの4面と状態照会0・Bearer継続はQA-000009が所有する。旧未定義Gapは定義接続だけ解消し、新規・更新項目Not Runと実装／実行未完了を維持する。

必須確認は契約・品質独立レビュー、文書・直接影響・全数対応・ID／段階／参照・件数確認。標準規則と実行境界を変更しないため準拠監査・実回帰・Provider／Docker E2Eは今回対象外。実装Gateは保存・配送観測等の具体化を残す。全結果統合後に是正し再レビュー、結果同期後にPhaseコミットする。今回13文書の契約・品質限定独立再レビューは両方Pass、全重大度の残指摘0。工程別接続数、前段と今回の結果時点、段階別判定、公開MCPからの初回Owner／状態Reader呼出し観測を是正した。全13定義190項目、QA-000007は27項目、差分確認成功。新規・更新項目Not Run、Source／Test・保存・受領・清掃・本番接続・新Evidenceは未完了を維持する。次は保存・公開入口の具体化とSource／Test実接続である。

#### 初回Host状態の純粋判定実装 — 2026-10-11

基準Commitは`cd18eb0b`。保存Gateと資格期限が未確定のため、初回Hostの実保存・鍵発行・入口実装は先行しない。当初範囲はAMの純粋判定SourceとUT、公開Root、既存公開集合Oracle、Package試験入口、Symbol、AM詳細02、本計画・現在投影の9File。品質レビューで試験台帳登録と現在投影の漏れを検出し、既存台帳・QA-000007・Center・Integration・ARCH／Detail分析の6Fileを直接是正へ追加して固定15Fileへ拡張した。変更分類は採用済み四状態・開始条件の実装詳細化。Current Repository onlyで、Host管理Root・秘密・Docker・Provider・旧Evidence・旧CROSの実処理は不変更。

着手前整合確認は必要とし、親の正本照合と読取り専用品質確認で着手可・追加人間判断なし。編集一次キーは観測分類→四状態／開始条件／次処置、ARCH-000013→RFD-UT-023→Source／Testの接続である。管理未初期化＋進行試行不存在＋明示開始だけ開始候補、同元試行の確認済み途中は再観測、既存は拒否、片側欠落・不明・矛盾は停止。`same_attempt`の分類は呼出側の照合済み入力で、本関数から保存・Identity・Host Authorityを証明しない。進行試行と完了履歴を分け、未実装の保存Ownerを置換済みとしない。

構造評価: Variationは四状態、Common Contractは単一同期関数、Creation／Selectionは返却値のみ、State-dependent Behaviorは入力分類に閉じる。Composition／RecursionはN/A: 外部処理を合成・再帰しない。Lifecycle OwnershipとExternal BoundaryはN/A: Handle・共有状態・I/Oを取得しない。ConcurrencyはN/A: 共有状態なし。TimingはN/A: 時刻・期限を判定しない。Failure／Observabilityは未知分類を停止結果として保持する。Securityは結果を実行Authorityにしない。実装知識の上位還元はN/A: 新しい保証は追加せず、既存の四状態を技術的入力分類へ対応した。

必須確認はAM Packageのformat・type・lint・全UTと、契約／品質の限定独立レビュー、文書・直接影響・Symbol参照・差分確認。標準準拠規則は不変更のため準拠監査は対象外。I/O・実処置は未接続のためHost実試験・署名・Docker／Provider E2Eは実行せず、必要な後続Gateへ残す。Node v24.19.0でローカルキャッシュから固定開発依存を配置し、静的3軸と7 UT（既存4＋初回3）は成功。初回には24組合せを含む。正式Local Item評価はNot Run、保存・資格・Host入口・本番Consumer・全体Readyは未成立。固定15Fileの契約・品質限定独立再レビューは両方Pass、全重大度の残指摘0。台帳の登録漏れと現在投影の矛盾を是正した。試験台帳は当該ID・Path各1件で実在、差分確認成功。結果状態だけを同期し、この実装単位をコミットする。
