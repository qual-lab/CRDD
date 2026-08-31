# 内部ツール配置移行の検証と独立レビュー

実行日: 2026-08-31
対象: 工程別配置への移行差分と直接影響先
判定: 機械検証合格。独立文書監査の軽微3件は限定再レビューで解消確認済み。配置移行差分の独立レビューはPass。

## 結論と対象

実装・試験・ビルドを`40_Develop`へ移し、仕様・設計・品質・反復手順を各工程へ分けた差分を確認した。配置移行前の正式署名E2Eを、新配置の実測には流用していない。Runtime全体の完成、正式配布、統合、リリースはこの記録の判定対象外である。

基準HEADは`d108d5c702dcddbf8e5a29a0ac9da83de5a6a1a9`。初回独立レビューの対象は、その上の未コミット・stage済み差分であり、`git diff --cached --binary HEAD`のSHA-256は`c56d059cab4f85ca6a4a2cf3528a1195097be342aa3e75391eee145dddfd327b`。確認時に作業ツリーとindexは一致していた。基準HEADだけを試験・レビュー対象とみなさない。

文書是正は初回レビュー後に行った。以下の機械試験は文書是正前の実行であり、文書是正後に全試験を再実行したという記録ではない。実装・試験・設定に追加差分がないことをindexとの照合で確認し、変更した文書は全体Checkerと限定再レビューで別に確認する。

## 機械検証

Windows、Node.js 24.19.0、固定されたローカル依存を使用した。試験Processの`TEMP`／`TMP`は検証済みRepository直下の`.crdd/test-tmp`へ限定した。新しい依存の取得、公式鍵入力、署名、Provider送信、Docker修復は行っていない。

| 確認 | 結果 | 対象・再実行方法 |
|---|---|---|
| Coordinator全試験 | 1,410/1,410、失敗0、108,396.7089 ms | `40_Develop/coordinator`で`node --test ./tests/*.test.ts`。実装・試験は文書是正後も不変 |
| Checker全試験 | 207/207、失敗・取消・skip 0、173,865.6239 ms | `40_Develop/checker`で`node ./test-runner.ts`。13案内の限定置換検証も含む |
| 新配置の開発E2E | 239/239 | [対象の集合ハッシュ・条件・限界](2026-08-31_Tool_Layout_Development_E2E.md)を参照。Coordinator全試験との重複を加算しない |
| Rustプラットフォームアクセス | 上位試験33成功・2 ignored、終了コード0 | 固定toolchainで`cargo test --frozen --offline --all-features --target x86_64-pc-windows-msvc`。下記の再構築条件を使用 |
| Coordinator型・静的確認 | 終了コード0 | `tsc -p tsconfig.strict.json`、`tsc -p tsconfig.tests.json`、`biome lint ../.. --error-on-warnings`、`biome format ../..`。自動修正なし |
| 初回レビュー前の全体文書Checker | エラー0・警告0 | rootで`node 40_Develop/checker/crdd-check.ts --json --summary`。固定履歴24/24、旧対象の物理残存0・index残存0 |

Rustでは移設した既存キャッシュに旧絶対Pathが残り、CLI試験がPath不存在で一度失敗した。この失敗は合格件数へ含めない。`40_Develop/platform-access/target/`内の新しい実行専用Directoryを`CARGO_TARGET_DIR`へ指定し、固定toolchain `1.94.1-x86_64-pc-windows-msvc`でオフライン再構築して成功した。既存キャッシュや署名配布物は削除していない。[再実行手順](../../19_Workflows/01_Coordinator_Runtime.md)へ同条件を反映した。

ignoredの内訳は、CurrentUser Registryを書き換える`lowbox_registry_effect_restores_exact_prestate`と、親試験が別Processで起動する`launcher_child_context_probe`である。前者は未実施。後者の子実行は成功したが、上位33件へ二重加算していない。

### ローカルログの再識別

ログは`.crdd/test-tmp`に非追跡で保持する。以下は取得時のSHA-256であり、永続保管や公開配布を保証するものではない。

| ファイル名 | SHA-256 |
|---|---|
| `coordinator-layout-final.tap` | `3b4a8ae946017c5b135a1bab3fe5492877824c2b05ff16500b0256aac6cb6181` |
| `checker-layout-navigation-final.tap` | `e12180e9df35ebe511ba7ca465593726d2549596e68f51980b3dc3e6904ce951` |
| `platform-layout-fresh.log` | `633349e0f341baf54220181955d28d31f23c1f532cbae2ff7e27092ccf659f47` |
| `layout-final-repository-check.json` | `9f10db7f32d3037a99aa62440b6f238771e35327978b89dc34096dd3d2504394` |

Checker実装SHA-256は`7f4ed71bd5789f606265d6729f10e31e03c3e75d68b3add1bea89369405d14f5`、契約試験は`d7cf7b10b183fd620141ae059297ff47b79064db252044a8fa8571e2597f4994`。文書是正でこの2件は変更していない。

## 独立レビューと是正

初回集合は実装担当と分離した2名へ同じ固定差分と共通Checker結果を渡し、全結果が揃うまで編集しなかった。

| 観点・確認者 | 初回結果 | 確認済み範囲と限界 |
|---|---|---|
| Architecture／Security・Test／UX、`layout_code_review` | Pass、必須是正0 | package・署名検査の接続、旧facade参照、固定履歴／限定案内の正負例、実子Process試験の観測と模擬境界。Runtime全体の再監査ではない |
| Document／Gap／Impact／Conformance、`layout_document_review` | Conditional、Critical／Major 0・Minor 3 | 旧本文の移管、現在案内、時点、責務、準拠への影響。下記3件は是正後の限定再レビューで解消確認済み |

3件の是正方針は両確認者へ一括提示し、競合なしを確認してから適用した。

| 指摘 | 原因・是正対象 | 保持した範囲 |
|---|---|---|
| DOC-01 | リンク以外の現行Path・表示名・責務表への伝播漏れ。CONTRIBUTING、Discovery、Agent Organization、CHG-000015／000017／000054、Roadmapを新配置と責務へ同期 | CHG54の当時の分離結果は履歴として残す。過去Pathの全置換はしない |
| DOC-02 | 旧実測の「現在版」が仕様・脅威モデルへ残存。1経路実測を4経路実測より前の経緯と区別し、現在状態をQuality Centerへ接続 | 旧監査Identity、当時結果、Hardened未接続、実Provider取消・是正の未証明、固定Evidence |
| DOC-03 | 旧READMEの目的別案内の移管漏れ。root README英日から仕様・手順・品質・設計へ短い案内を追加 | 候補版・未Release、通常利用者の署名鍵不要、Provider情報境界 |

是正後の限定再レビューはPass、DOC-01／02／03は解消確認済み、追加指摘0件だった。確認者は全stage差分SHA-256 `3d8e8520a65cd5e36ce22705c567f80ec4527002a63c0f8f29e76699944f0af7`と、その時点の本記録SHA-256 `6fb153fda23df04f2f797e08fca61eabe0fa0faea852f11a097037935ed514de`を照合した。本段落はその確認後の結果追記である。共通の是正後全体Checkerもエラー0・警告0（377 Markdown、2,448リンク、固定履歴24/24、旧対象の物理・index残存0）。実装・試験不変を確認し、実装側のPass適用範囲を維持した。編集しただけで解消とせず、限定再確認の結果を現在状態へ反映した。

## 設計文書の名称・責務整理の確認

2026-08-31、同じ未リリースCHG-000017で3部品の設計文書を`01_Architecture.md`、Coordinatorの脅威モデルを`02_Threat_Model.md`へ改名した。Coordinatorの移行履歴、現行条件、開発手順への参照を分け、現行文書とRunner・設計対応表・履歴台帳の後継参照を同期した。品質文書の固定構成、固定Evidence、旧Identity、権限・Provider処理は変更しない。

| 確認 | 実結果 | 確認できない範囲 |
|---|---|---|
| 設計対応表・一般Task・4経路Runnerの契約試験 | 57/57成功、失敗・skip 0 | 実Provider、正式署名、実端末は未実行 |
| Checkerの履歴・台帳関連契約試験 | 13/13成功、失敗・skip 0 | Checker全試験の再実行ではない |
| 設計対応表の検査 | accepted。資源9、状態20、遷移21、不変条件10、検証接続10 | 接続の検査であり実資源の新しい実測ではない |
| 全体リンク・履歴確認 | 初回のDiscovery旧Path参照1件を修正後、10:35:25Zの全体確認で383文書・2,597リンク・848アンカー、エラー0・警告0、固定履歴24/24 | Git無視対象は未確認。独立確認後の記録更新にも全体確認を行う |

文書側・実装側の独立確認は同じ軽微な指摘1件（DOC-NAME-01）を返した。節移動で署名条件のアンカーだけが開発実測の前に残っていたため、アンカー名・本文・Workflowを変えず署名条件節の直前へ戻した。両担当の全結果と修正案を統合してから是正し、着地点の限定再確認へ渡した。今回変更したコード／JSONの4ファイルは個別のBiome Lint／Formatも成功した。

Node v24.19.0、対象Rootは`C:\project\CRDD`。子Processの一時物は既存のRepository-local `.crdd/test-tmp`へ限定した。既存staged移行を保持し、Git無視対象、OS設定、Docker、秘密鍵、正式配布物へ変更を加えていない。対象はHEAD `d108d5c702dcddbf8e5a29a0ac9da83de5a6a1a9`から続く未コミット移行差分であり、限定独立確認は本節の名称・責務・参照変更を対象とする。

文書・実装の両担当は、是正後の設計SHA-256 `c37aeb0e68acc648703c46a8315dec413076d3dc2430834c50e1073eedd172f4`と着地点・本文を再照合し、DOC-NAME-01の解消および今回の限定範囲のPassを確認した。新規指摘はない。是正後の全体Checker（10:37:37Z）も上表と同じ件数でエラー0・警告0、固定履歴24/24だった。本段落は確認後の結果追記であり、実Provider、正式署名、Runtime全体、UX工程またはReleaseの完了を宣言しない。

## 品質文書の固定命名の是正

先行する設計文書改名の後、人間が品質規則自体の変更を承認した。公式と配布ひな型の品質3文書を番号付きへ揃え、品質規則・Overview・Skill例・配布AI入口・各工程ひな型・現行参照・Checker fixture・v0.18の英日移行説明を同期した。対象と移行・競合時の停止・切戻しは[同じCHGの移行節](../../90_Release/Changes/CHG-000017_Tools_Coding_Standards.md#quality-document-naming)に記録する。日付付き結果名と結果ひな型は変えていない。

保守用契約試験は、固定構成の順序・責務表、公式とひな型のファイル実在・旧名不存在、配布AI入口を照合する。旧名、片側欠落、旧名残存、順序不一致、責務表不一致、AI入口の追従漏れの負例も同じ検査へ渡す。配布Checker本体の判定を追加せず、任意名の品質文書に対する既存の内容検査を維持する。

新試験の非null assertionと整形指摘を是正後、関連4試験は4/4成功、型検査・警告を失敗にするLint・Formatterも成功した。全体Checker（2026-08-31T10:45:24.007Z）は383文書・2,602リンク・853アンカー、固定履歴24/24確認、エラー0・警告0だった。

この結果を共通入力として、文書・影響・準拠と試験の2担当が固定した命名差分を独立確認し、双方Pass・指摘0。旧名の残存が移行説明・過去公開記録・拒否試験だけであること、規則・公式・ひな型の一致、PL-16の責務維持、移行・切戻しを確認した。対象は基準HEAD `d108d5c702dcddbf8e5a29a0ac9da83de5a6a1a9`から続く未コミット移行のうち、本節の命名是正と関連試験・移行説明に限る。本段落は確認後の記録追記であり、正式署名、実Provider、Docker、OS設定への操作や、Runtime全体・UX工程・Releaseの完了を示さない。

## 検証義務の評価と残件

### 3部品の設計補完・結果表示の追加確認

2026-08-31、同じ未リリースCHG内で、Checker／platform-accessの設計、Checker手順、共通UX／IA／UI／SPEC／検証設計への接続と、Coordinatorの人間向け結果表示を追加確認した。対象は`d108d5c702dcddbf8e5a29a0ac9da83de5a6a1a9`から続く未コミットの配置移行差分であり、正式署名済み配布物ではない。

| 確認 | 実結果 | 限界 |
|---|---|---|
| 結果表示・取消投影・実子Process接続 | 28/28成功 | 正常、非ゼロ終了、取消、close不明、回収拒否を表示まで接続。実Provider・Docker・実端末ではない |
| 開発E2Eと表示・取消・公開CLIの関連集合 | 初回288/289、旧英語表示assertion是正後289/289成功 | `development-e2e:verify`の9ファイルに表示・取消・CLI引数の3ファイルを加えた集合。再試行で機能を緩めていない |
| Checker全契約試験 | 207/207成功、skip 0 | `40_Develop/checker/test-runner.ts`を実行。通常Checkerの意味監査や実中断観測とは別 |
| TypeScript型・設定されたLint／Format | strict・testsの両型検査と変更6ファイルのLint／Format成功 | 追加診断の`biome check`は既存import順のassist指摘3件を返した。packageの検査はlint／formatを分離しており、この結果をcheck全体成功とは記載しない |
| 全体Checker | 09:55:09Zの実行で383文書、2,589リンク、844アンカー、エラー0・警告0、固定履歴24/24 | Git無視対象は未確認。後続の記録更新後にも全体確認を行う |

Node v24.19.0、Repository Rootは`C:\project\CRDD`。開発E2Eは`40_Develop/coordinator`、Checker試験は`40_Develop/checker`から実行し、子Processの`TEMP`／`TMP`だけを検証したRepository-local `.crdd/test-tmp`へ指定した。OS全体の環境、公式Release鍵、Provider認証、実Provider・Dockerは操作していない。

独立確認はChecker文書・工程接続、native設計・安全境界、表示実装・実producerと試験の3担当で同じ差分を確認した。初回は軽微な4件。参照調査の必須引数、歴史台帳の事前検証順、Docker protocolの定義元、旧表示を期待したCLI試験を是正した。全結果を集約し、各担当へ方針を戻して競合なしを確認してから編集した。Checkerの再確認では、相対Pathの例を受理条件へ過剰限定した1点を追加是正し、Root内の絶対Pathも受理する実装と整合させた。これは修正による表現の過剰限定であり、新機能要求ではない。

native・表示・Checker本文の限定再確認は完了し、指摘は解消確認済み。結果記録の重複挿入も除去し、一つの節へ集約した。実端末、UI参照媒体の適用、支援技術、正式署名E2E、Runtime全体の完成監査、工程移行・Release判断は未完了のまま維持する。

新配置からの機械確認、履歴保持、限定案内の拒否条件は対象範囲で成立した。過去CHG6文書13案内の変更は人間の明示承認に限定し、当時本文の固定Identityは変更していない。固定Evidence5文書9リンクは原文不変のまま旧Git内容と現在の後継を区別して検証した。

一方、配置移行後の正式配布・実Provider E2E、Runtime全体の完成監査、実Provider取消・是正の未証明範囲は未完了。UX／IA／UIのTool工程全体整備も本移管だけで完了とはしない。確認者が今回評価していない範囲へPassを拡張しない。

担当はQual-Labと親Coordinator。配置・工程整備は[CHG-000017](../../90_Release/Changes/CHG-000017_Tools_Coding_Standards.md#9-内部ツールの工程別配置への移行)、Runtime完成は[CHG-000015](../../90_Release/Changes/CHG-000015_Coordinator_Runtime_1_0.md)、後続順序は[Roadmap](../../99_Roadmap/01_Product_Roadmap.md#tool-development-layout-follow-up)で追跡する。リリース判断は未実施である。
