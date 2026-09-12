# 変更トレース: v0.20.1 リリース状態伝播

変更ID: `CHG-000069`
状態: `Ready for Release Handoff`
担当責任者: Qual-Lab
対象版: `v0.20.1`
収載対象: `v0.20.1`
変更分類: `corrective`
最終更新日: 2026-09-12

## 1. 結論

v0.20.0は、署名済み4経路E2E、Recovery Matrixおよび最終監査を完了して2026-09-11に公式tagへ収載した。一方、候補から公開済み状態へ移す機械的な文書遷移を実行しないまま統合・tag作成へ進んだため、公開tag内の正本、README、CHANGELOG、Quality Center、Tool文書、CHGおよびRoadmapに候補表示が残った。

v0.20.1は、この公開状態の利用側伝播漏れを正し、Stableな最終候補に候補表示が残る状態をCheckerで拒否する。変更対象はRelease Identity、文書、Checkerおよびその契約試験であり、Runtime実行集合、署名manifest、Native成果物、PolicyおよびSchemaは変更しない。

## 2. 原因と構造是正

| 項目 | v0.20.0で起きたこと | v0.20.1の是正 |
|---|---|---|
| 状態遷移 | Commit Cの許可Pathと遷移内容は記述したが、実行完了を統合前Gateにしなかった | Stable化後の全利用側閉包を通常Checkerで検査する |
| 利用側集合 | 手書きのexact Path一覧に依存し、CHG-000065等の取り残しがあった | 現行Markdownの先頭表示から候補残存を自動導出する |
| 公開案内 | READMEと英日CHANGELOGを個別に確認した | 正本版、README版、英日の日付付きRelease見出しを相関検査する |
| 変更トレース | CHGの公開状態がRelease判断待ちのまま残った | v0.20.0対象CHGを公式tagと公開日へ接続する |
| Roadmap | 完了したv0.20作業が未完了登録簿に残った | 完了根拠へ移し、v0.21以降だけを残す |

## 3. 完成条件

- 全CRDD正本が`Version: v0.20.1`かつ`Status: Stable`である。
- 現行Markdownの先頭表示にv0.20.1の`Candidate`が残らない。
- READMEがv0.20.1を候補表現なしで示す。
- CHANGELOGの英日両区分がv0.20.1とv0.20.0の公開日を示す。
- v0.20.0対象CHGが`Released`と公式tagへ接続される。
- Roadmapに完了済みv0.20作業が残らない。
- Runtime実行Identityがv0.20.0から変わらないことを差分分類で確認する。

`Ready for Release Handoff`は変更内容とリリースメタデータが統合へ渡せることを示し、公開済みを意味しない。v0.20.1の公開状態は、この変更を含むCommitを公式`v0.20.1` tagが参照した場合だけ成立する。

## 4. 変更しない範囲

- Runtime code、Native成果物、Policy、Schemaおよび署名manifest
- v0.20.0の公式tag、Commitおよび署名済みEvidence
- v0.20.0で成立したCapabilityと未評価範囲
- v0.21以降の機能範囲、順序および採否

## 5. 検証

Repository全体Checker、Checker契約試験、FormatterおよびGit差分検査を実行する。Runtime実行集合が不変であるため、再署名、Provider E2EおよびRecovery Matrixは再実行しない。
