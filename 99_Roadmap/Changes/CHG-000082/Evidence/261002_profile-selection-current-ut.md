# Profile選択の現行UTとRole反例の補強

成果物種別: 品質検証・変更記録
変更ID: `CHG-000082`
基準Commit: `25ae4cb5071577c16afc98c5d6097c03b22afdb6`
基準Tree: `8eee4112b12f8b518dc170904be744df30759f4f`
記録日: 2026-10-02
維持責任者: Qual-Lab

## 結論

Profile選択の既存試験で、Role不一致の反例が許可されないRole名だけを使っていた。Executor専用Profileへ正当なRole `independent_reviewer`を指定する反例を追加し、不正Role `reviewer`の拒否も保持した。Source本体、Catalog、Authorityと期待する拒否結果は変更していない。

Formatter、型二構成、Lintの後、既存六UT fileの60件がPass、Fail／Skip／Cancel／Todoは0。ただし[PRL-UT-014の定義](../../../../07_Quality/Definitions/QA-000003/quality_definition.md#4-検証項目)全体の合格ではない。Transport別入力からCore Operation、公開結果までの同等性は今回未確認であり、[176件の固定照合](261002_quality-item-reconciliation.md)で残した旧108件の現在適用、品質全体OPEN、Host方式判断待ちと新実Task停止を変更しない。

## 経路と着手前確認

親は現在の検証義務、Coding Standards、packageの既存選択試験集合、Sourceと試験を照合した。別の読取り専用確認者が六UT本体とImport時初期化、実操作への到達条件、Role反例と禁止範囲を確認し、最小試験修正を条件として着手可とした。後述の完成後確認とは分ける。

試験修正は[provider-model-profile-runtime.contract.test.ts](../../../../40_Develop/coordinator/tests/unit/provider-model-profile-runtime.contract.test.ts)の既存Case内の一assert追加だけ。正常Executor対照、正当Role不一致、不正Role拒否を分ける。新ID、Source変更、Catalog採用、実Authority発行や旧署名候補の更新を行わない。

修正前はRole文字列のShape拒否がProfileとRoleの組合せ拒否に見えていた。現在のSourceは組合せを既に確認しており、今回検出したのは実装欠落ではなく反例の不足である。許可集合にある値同士の不一致を区別する既存の検証規律を適用するため、新しいRule、TemplateまたはChecker例外は追加しない。

## 観測範囲と残る条件

| 意味 | 今回の根拠 | 限界 |
|---|---|---|
| 明示／自動Profile、未知ID、Provider／Role不一致 | 実Resolverと固定Memory Catalogへのassert。正当Roleと不正Roleの拒否を分離。 | 合成Profileの成功を実Catalog採用・Provider利用可能へ昇格しない。 |
| Route CandidateへのID保持・選定規則 | 既存Route／Model Selection UT。 | Transport入口を直接呼んだ確認ではない。 |
| Selection Grantの一回消費・Planへの結合 | 既存Memory Fixtureと実局所実装。 | FixtureのAuthority発行は本番Authorityではない。MountやProvider操作は実行しない。 |
| Transport別入力、Core正規化、公開結果と入口間の意味同等性 | 今回未確認。 | PRL-UT-014全体を現在適用済みへ変更しない。 |
| 実Provider、Host回復と終了後資源 | 今回対象外。 | 実Task停止・回復方式と操作の別承認を維持する。 |

六fileは複数のLocal Itemを所有し、60件をPRL-UT-014だけの試験件数や合格義務数へ換算しない。既定Catalogの旧Model値は[移行方針](260930-1853_codex-model-host-migration-preflight.md)に従って保持する。Catalogの解決可能性はHostでの利用可能性ではない。

## 実行再識別

| 項目 | 固定した根拠 |
|---|---|
| 実行区間 | UTC `2026-10-02T08:29:18.206Z`〜`2026-10-02T08:29:20.721Z`。六UTの所要時間807.4324ms。 |
| 実行物 | 絶対PathのNode `v24.19.0`、TypeScript Native compiler `7.0.2`、Biome Native binary `2.5.6`。選択binaryとwrapperのHashを入力へ含め、実行はNative binaryへ直接接続した。 |
| 入力 | 1,882 regular fileの順序付きPath／Hash集合を前後照合し一致。Git管理された全Subsystemのsrc／bin／scripts／testsのTS／TSX／JSON、設定・lockfile、installed型宣言とpackage情報、六試験、正本と検証器を実行コードの選択条件で再構成できる。集合SHA-256は`328870e2957452adb080376738f08835cdca51dbbae625a8ad4a3c43258a2a22`。重要14fileの個別Hashは原記録へ保持。 |
| Git／環境 | HEAD／Tree、実行前後のdirty集合が不変。試験の未コミット差分は実行前に存在し、そのHashを使用した。NODE_OPTIONS、NODE_PATH、BIOME_BINARY、NODE_V8_COVERAGEは親で未設定を確認し、子でも空値へ固定した。Coverageの外部書込みは要求しない。 |
| 正式原記録 | Repository-local `.crdd/verification/chg-000082-prl014-profile-current-261002/run-final.json`、SHA-256 `d81d122734073490a69ac7aebfe74c68a31c48ba81165b451298990d8928371e`。全実行コード、command、cwd、開始／終了、Exit、結合せず個別に取得したstdout／stderr文字列、Git観測、集合集計・Hashと重要fileの個別Hashを保持。生byte列とは主張しない。 |
| 記録の再取得 | 最初の全入力出力は取得上限で途切れたため正式根拠にしない。集合Hashと重要fileの個別Hashを持つ有界記録へ変更し、型宣言・環境と試験Source変更の明示を加えた新実行を正式根拠とする。試験内容は再実行間で変更していない。 |
| 保持・無効化 | Phase 5結論固定まで原記録を保持し、未解決参照を確認せず削除しない。入力・依存・検証器の変更または原記録喪失時は再実行する。今回の結果を署名済みRuntimeの実境界Evidenceへ転用しない。 |

すべてのcommandは`40_Develop/coordinator`をcwdとする。実際の絶対Path・引数配列と出力は原記録が保持する。

| 順 | command | 結果 |
|---|---|---|
| 1 | Biome `format`、選択六試験、書換えなし | Exit 0。 |
| 2 | TypeScript `-p tsconfig.strict.json` | Exit 0、noEmit。 |
| 3 | TypeScript `-p tsconfig.tests.json` | Exit 0、noEmit。 |
| 4 | Biome `lint`、選択六試験、`--error-on-warnings` | Exit 0。 |
| 5 | Node `--test --test-concurrency=1`、選択六試験 | Exit 0、60／60 Pass、0 Skip。 |

選択六試験は既存packageの`delegation-route-selection:coverage`集合と同じであり、今回はCoverage率を測定・主張しない。対象は`provider-eligibility-runtime`、`provider-model-profile-runtime`、`delegation-route-selection`、`delegation-selection-grant-runtime`、`claude-docker-runtime-adapter`、`provider-model-selection-runtime`の各`tests/unit/*.contract.test.ts`。

## 確認と禁止範囲

完成後は同じ試験差分、本文とCHG結果参照および原記録へ、技術・反例、文書・追跡、品質・判断境界の三観点を固定する。Source本体・規範・署名・配布の実行集合は不変のため、全回帰、再署名、Provider／Docker E2E、準拠監査とRelease判断をこの局所結果の確認へ追加しない。後続で必要なGateの免除ではない。

Project Context・Quality Centerの再投影は不要と評価した。Current状態、完成主張、件数、リスクと判断待ちは変わらず、局所進行はCHGの結果参照から追跡する。実Task、新Root処置、Windows再起動と旧署名候補は変更しない。

## 独立確認の結果

作成担当と別の確認者が、同じ固定三対象へ技術・反例、文書・追跡、品質・判断境界の三観点を完了し、すべて限定Pass、Finding 0となった。試験のSHA-256は`4e24fd89946e2813856562dd4c1d582186d9688a1dedfa6bf62d9a1e498b696d`、CHG本文は`e65cddfd8d9a8af39f8105cc0faea676ed12228f07dfb1b53b7f8ee7cd87ff32`、この結果追記前の本文は`38fce6f95fa87646f334ef3e9111f5ee35a42134648a28b6a057c829a5e11db0`で、確認の開始・終了時に一致した。正式原記録のHashも上記と一致し不変だった。

確認者は1,882入力を読取り専用で再構成し、集合Hashと重要14fileの個別Hashを照合した。全入力pairの過去復元を保証する記録ではなく、入力変更時は再実行する限界を確認した。試験は再実行せず、実Provider、Host処置、Transport同等性、PRL-UT-014全体と品質全体の成立は確認対象外である。

全確認完了後、この節とChecklist該当一行だけを結果として書き戻した。確認者は結果だけの追記を整合済みとした。追記前Hashを現在本文Hashまたは実行時Hashへ読み替えず、試験、CHG本文、原記録、残るOPEN、品質件数と承認状態は変更しない。

## Checklist

- [x] 正当Roleの不一致と不正RoleのShape拒否を分けた。
- [x] 既存Caseの正常対照と拒否期待を保持し、SourceとCatalogを変更しない。
- [x] Formatter・型・Lintの成功後に局所UTを実行した。
- [x] 固定入力、実行物、環境と実行前後の不変を記録した。
- [x] Memory Authorityと実Authority、局所Passと全Local Itemの完成を分けた。
- [x] 同じ固定候補への技術・文書・品質／判断境界の独立確認を完了し、限定Pass、Finding 0を記録した。
- [ ] OPEN: PRL-UT-014のTransport同等性、旧108項目の現在適用、全体品質と実回復は未完了。
