# 保存方式刷新②の現実照合

成果物種別: 品質照合・変更記録
変更ID: `CHG-000082`
記録日: 2026-10-06
基準Commit: `c097598a3c2355931cdbcb8480c20510eac7ee01`と件数予算の承認済み是正候補
維持責任者: Qual-Lab

## 結論

②の保存切替に関係する設計、Source、試験、Relationと検証記録を照合した。保存の本番接続・初期化・局所反証は成立している。検証項目全体の現在Pass件数は今回確定していない。署名依存と残るE2E・個別義務は未完了であり、Quality Readyや②全体Passへ昇格しない。

## 再集計

| 対象 | 一意件数 | 意味・限界 |
|---|---:|---|
| QA定義 | 13 | 現行Definitionsを全件集計した。 |
| Local Item | 176 | 正本の検証項目。試験Case数ではない。 |
| 試験Relationあり | 132 | 全symbol manifestから実在Local Itemへの接続を確認。実行・Passではない。 |
| Relationなし | 44 | 接続がない現在集合。全てが自動Test不足とは限らない。 |
| Symbol | 616 | ID重複0。未定義Local Itemへの参照0。 |
| ARCH対象／Relation | 18／448 | 一意な対象と正方向Relationの組。 |
| QA対象／Relation | 13／303 | 同上。 |
| Local Item対象／Relation | 132／361 | 同じ項目への複数接続を項目数へ重複算入しない。 |
| Meaning対象／implements | 17／41 | Symbol側の意味参照。IRの全意味件数とは別。 |
| verifies対象／Relation | 318／632 | 対象Symbolと試験接続。Passの主張ではない。 |

全176項目の個別Evidence再監査は未実施。旧108件の観測主張を現在へ自動転用しない。移管46件の13観測参照・33未観測は既存Ownerの記録として維持し、今回の再集計だけで観測済みを増やさない。

## 意味モデルの再生成

既存のSemantic Coverage CompilerでCoordinator／Project RuntimeのCanonical表、Quality Relationと現行symbol manifestから`semantic-coverage-pilot.json`を再生成した。生成Finding 0。現在はCoordinator8意味、Project Runtime10意味、計18意味である。16意味は実装・自動試験の両Relationあり、1意味は実装・試験未接続、1意味は実装接続あり・手動確認待ちである。

| 未完了の意味 | 現在状態 | 変更しない判断 |
|---|---|---|
| coordinator.runtime-trust-consumption | 実装／試験未観測 | 署名検証部品の存在をRuntime Trust全体へ拡張しない。採用Scopeとの対応は既存Ownerへ戻す。 |
| project-runtime.execution-intelligence-read-model | 実装Relationあり、PPR-UAT-008は手動確認待ち | Unit TestをUAT成立へ昇格しない。 |

旧17意味・15両Relationの値は過去の生成版に限定する。現在の18意味を新しい品質項目18件の合格と解釈しない。

## ②の検証義務との対応

| Local Item | 今回の根拠 | 現在判定 | 未完了の全体条件 |
|---|---|---|---|
| PRL-IT-005 | 保存・Candidate・Authority境界、完全Identity保持と結果Adapterの局所反例 | 一部観測 | 別Task、範囲／Authority変更、cleanup未確認を含む全義務の現在版適用を完了したとは扱わない。 |
| PRL-IT-012 | 公開初期化、受付世代、v2保存Port、CLI／MCPの搬送 | 一部観測 | UI／CLI／MCPの同一意味、Authority差分、Executor限定Profile搬送、Reviewer誤伝播拒否までを今回37件だけで全Passへ変更しない。 |
| AIT-IT-002 | 配布Identityの全9試験。2048／2049／4096件受理、4097件・64MiB超過拒否、既存改変・Tree・同一handleの反例 | 局所実行済み | 固定配布物、署名とproduction Operation／doctorまでの成立は別に確認する。 |

## 実行結果と版の区別

| 実行集合 | 結果 | 適用範囲 |
|---|---:|---|
| Checker全試験 | 377／377 | 命名・構造・Relationの検査。品質項目377件のPassではない。 |
| 公開入口関連 | 37／37 | ②候補の受付、結果Adapter、Composition、一連の処理、受入判断。 |
| Windows Host | 36／36 | 固定候補の保存・処理境界。Portable除外から成功を推定しない。 |
| 配布package契約 | 128／128 | 命名・固定Graph是正後の再実行。685.303秒。修正途中版の失敗と分ける。 |
| 配布Identity契約 | 9／9 | 件数予算改訂と容量反例是正後。5.534秒。Source／試験型・Formatter・Lint・既存3設計対応検査もPass。 |

②の詳細実行記録は[保存方式刷新の検証記録](261005_project-runtime-phase2.md#31-命名是正後の現候補)へ接続する。各集合の重複を足して全体試験数やLocal Item合格数を作らない。PT／LTは人間が実行指定していないため実施しない。

## 残るGate

件数上限4096への限定採用は人間承認済み。64MiB、Root／alias拒否、同一handle、exact Tree、署名とAuthorityの条件は維持した。新固定Commitから配布物を生成し、正式preflight、署名、production Operation／doctorを再確認する。秘密入力は外部端末に限定する。

全体の旧観測値の個別適用、必要なWorkbench／Provider E2E、未実施のManual／Hybrid義務は残る。旧記録の明示リセットは通常Recovery成功ではない。③、Release、Provider追加送信やDocker再起動へこの照合から進まない。

## Checklist

- [x] 正本の項目数、Relation数、試験数とPassを区別した。
- [x] 旧版の集計と現在の再生成を分けた。
- [x] 未定義参照・重複と全数集合を確認した。
- [x] 不足を推測で補わず、全体OPENと現在の局所成立を分けた。
- [ ] OPEN: 署名候補とproduction初期化のGateが未完了。新固定候補の確認後に再評価する。
- [ ] OPEN: 全176項目の個別Evidence現在適用は未完了。局所試験から全体Passへ変更しない。
