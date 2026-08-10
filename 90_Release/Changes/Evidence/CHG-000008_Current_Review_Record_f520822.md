# CHG-000008 現在の確認状態

対象変更: [CHG-000008](../CHG-000008_Convergent_Remediation_and_Evidence_Identity.md)

## 現在状態

- 対象コミット: `f5208227332ddda9d7ad4bca56e4e543abacf0b0`
- Root Tree: `33d9a8b5d96ec4f3b431dcd165c3fb946ecb751d`
- 基準main: `00e791d4897897c4f49ba0c07d0f7e9d2536df4e`
- 処置進捗: `Self-checked`
- 阻害状態: `None`
- 解消判定: `Resolved`
- CHGの現在状態: `Integrated — Pending Release`
- リリース判断: Qual-Labの人間の決定権限者がv0.14.0の統合とリリース実行を承認。公開実行待ち
- 担当責任者: Qual-Lab
- 更新日: 2026-08-10

固定コミット内のCHGは、固定時点の`Ready for Verification`を履歴として保持する。本記録は、固定後の実行結果と独立確認を統合した現在状態を所有する。固定コミットへ結果を書き戻していない。

## 固定後Evidence

| Evidence | SHA-256 | 結果 |
|---|---|---|
| [検証実行記録](CHG-000008_Verification_Run_Record_f520822.md) | `46FC1610FB8785C784647F0CE9ED235F83C1F8462681F74C814329FDD479435D` | 固定Tree、分離worktree、Checker発見ファイル各83件、実行前後差分・未追跡0 |
| [Checker完全結果](CHG-000008_Checker_Run_f520822.json) | `A061620469F0F04263526478D41407506C00F145D432439B231CDCF3EC0FB029` | Error 0、Warning 0 |
| [エージェント運用・規範独立レビュー](CHG-000008_Agent_Review_f520822.md) | `13BE3F594DC2503AEBCDD46D96482CDC83F29A8654E3F3E01A7657AA1B26ACA9` | `Pass`、未解決Finding 0 |
| [文書監査](CHG-000008_Document_Audit_f520822.md) | `6FE0AEF701C3C3093D5953409DDE296B865274208E917E10369E56CC2D575B55` | `DOC-014-E01`〜`E04`を履歴保持して解消、最終`Pass` |
| [不足／影響・準拠影響監査](CHG-000008_Gap_Conformance_Audit_f520822.md) | `DF8404B6E7C38A26895A5F486D4CCD88392D6B2DDF89CAE99F6DB1C22890B304` | `Pass`、未解決Finding 0 |

## 無効化したEvidence

| Evidence | SHA-256 | 無効化理由 |
|---|---|---|
| [旧検証実行記録](CHG-000008_Verification_Run_Record_f7ff579.md) | `D43547A6AE045832EEF5ADE0A94BFA08153B9E9B3C40D30080B5DED73696AF2D` | 未追跡PPTXがCheckerの発見集合へ入り、固定Tree 83件に対して84件を確認していた |
| [旧Checker完全結果](CHG-000008_Checker_Run_f7ff579.json) | `FF47450115A443C7C95EA5D62E77B4DECDB25AC4338EA22958092C6F2662AE30` | 実行結果の履歴として保持するが、現在の解消判定には使用しない |

コミット前の差分識別値`4408c77e250ba7421cfd7e830246533c7e77aa56`と、固定コミット`04b75dda75ffe1131d53f34a196f4c1e54e8d469`の確認結果も現在判定へ使用しない。前者は生成記録がなく再導出できず、後者は後続文書監査で規範内の競合が見つかったためである。

## Finding履歴と対応関係

| Finding | 元の意味 | 是正 | 再評価結果 |
|---|---|---|---|
| 外部FB Major | v0.14自身の固定後レビュー根拠を再識別できない | Commit／Treeを固定し、完全な機械結果と3系統独立確認を保存 | `Resolved` |
| `DOC-014-E01` | 最小対象同一性の必須項目が同一節内で競合 | Git共通、条件付きGit情報、Git外情報へ分離 | `Resolved` |
| `DOC-014-E02` | 日本語記録に未登録の英語略記が残る | 対象同一性情報と「同じ実行」へ日本語化 | `Resolved` |
| `AG-014-N01` | 日本語文書にbareな`clean`が残る | 「未コミット変更のない通常のGit Commit」へ統一 | `Resolved` |
| `DOC-014-E03` | Checker対象へ対象外PPTXが混入 | 新固定Commitだけの分離worktreeで再実行 | `Resolved` |
| `DOC-014-E04` | Git外成果物にもObserved HEAD等を無条件要求 | Git対象とGit外対象の識別情報を分離 | `Resolved` |

元Findingの意味を別のEvidence Closureへ置き換えず、各是正と再評価結果を対応付けた。

## 統合結果

- 3系統の最終確認は同じ固定コミットと共通Checker Evidenceを使用した
- 未解決Finding: 0件
- 修正によって新たに発生した履歴: 2件（`DOC-014-E01`、`DOC-014-E02`、ともに`Resolved`）
- 修正によって初めて確認可能になった履歴: 0件
- 承認された対象範囲の拡大による履歴: 0件
- 既存レビューの見落とし履歴: 3件（`AG-014-N01`、`DOC-014-E03`、`DOC-014-E04`、すべて`Resolved`）
- 最終固定版に対する新規候補4分類: すべて0件
- `Resolved`はv0.14.0候補と自己適用是正の解消であり、人間によるリリース判断を代替しない

## 未評価範囲と既知の制限

- 元worktreeの未追跡`CRDD_Introduction.pptx`は対象外
- Git-ignoredファイルはCheckerの未確認範囲
- 外部採用先での実移行と準拠表明
- リリース後の再監査往復回数とAI処理コストの改善量
- 人間によるリリース判断

これらを今回の`Pass`へ含めない。新しい運用データまたは適用先の問題から規則変更が必要になった場合は、別の変更契機として扱う。

## リリース記録

- リリースバージョン: `v0.14.0`
- 公開識別子: 注釈付き`v0.14.0`タグを作成予定
- 状態: `Integrated — Pending Release`
- リリース対象: CRDD標準リポジトリのv0.14.0変更、固定後Evidence、Current Review Record
- 対象環境: GitHub上の`qual-lab/CRDD`公開リポジトリ
- 含まれる変更: `CHG-000008`
- 除外: 未追跡の`CRDD_Introduction.pptx`。本リリースの対象コミット、配布物、検証に含めない
- feature → develop: [PR #13](https://github.com/qual-lab/CRDD/pull/13)、統合コミット`6a12c593204c3a1a36f2374975ad04d259580fd3`
- develop → main: [PR #14](https://github.com/qual-lab/CRDD/pull/14)、統合コミット`5558662c01d1dd7170fbb0307119059293cea191`
- リリース前記録 → main: 未実施
- リリース準備状況: 分離worktreeによる全体Checker、3系統独立確認、Current Record終端確認を完了。未解決Finding 0
- 変更影響の伝播: 正本、AI入口、README、CHANGELOG、監査基準、準拠基準、移行案内へ反映済み。未処置の伝播例外なし
- 人間の判断: Qual-Labの人間の決定権限者が2026-08-10に統合とリリース実行を承認
- 既知の制限／残存リスク: 本記録の「未評価範囲と既知の制限」を参照。外部適用結果と実運用効果はリリース阻害条件にしない
- 人間中心品質: プロダクトのUX／IA／UI成果物を変更しないため、プロダクト固有の人間中心品質確認は`Not Applicable`
- 移行／互換性: `breaking`、`migration_required: true`。`CHANGELOG.md`のv0.14.0移行注記に従い、全既存基準版でMigration Completenessを実施し、該当時に`AD-21`／`PL-16`を再評価する
- ロールバック参照: `v0.13.0`タグ。Migration Completenessと人間による有効化が終わるまではv0.13.0の基準版と手順を維持する
- リリース日: 未確定（予定: 2026-08-10）

## 次の処置

本記録をmainへ統合した後、その統合コミットへ注釈付き`v0.14.0`タグを作成してremoteへ公開する。公開識別子とremote参照を確認できるまで`Released`へ進めない。
