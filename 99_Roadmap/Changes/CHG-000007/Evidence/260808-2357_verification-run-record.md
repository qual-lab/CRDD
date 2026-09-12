# CHG-000007 固定後検証実行記録

対象変更: [CHG-000007](../CHG-000007_Multi_Location_Remediation.md)

## 対象の同一性

- 対象コミット: `5143e38b026bed1de346a3c40834ce0b42bb5819`
- ブランチ: `feature/remediation-coverage`
- Gitツリーマニフェストのダイジェスト: `2cc3cf4ebfe83d975b58fbf14a69fb1848c7e097`
- 実行環境: Windows / PowerShell
- Node.js: `v22.18.0`
- 実行主体: CRDD保守タスクの親エージェント `/root`
- 実行許可と対象固定: Qual-Labの人間の決定権限者が提示した是正方針に基づき、親エージェントが固定コミットを作成した
- 結果確認: [エージェント運用独立レビュー](CHG-000007_Agent_Review_5143e38.md)、[文書監査](CHG-000007_Document_Audit_5143e38.md)、[不足・影響／準拠影響監査](CHG-000007_Gap_Conformance_Audit_5143e38.md)

本記録と出力ファイルは対象コミットの固定後に作成した。対象コミットへ書き戻していない。

## Checker実行

- コマンド: `node template/tools/crdd_check.mjs --json --summary`
- 実行時刻（UTC）: `2026-08-08T14:44:28.399Z`
- 所要時間: `397 ms`
- Exit Code: `0`
- Checker SHA-256: `D8C1710E133B69C2D6967AE708F26D9CF220A7E41C41322361210E68C872402B`
- 完全な標準出力: [Checker Result](CHG-000007_Checker_Run_5143e38.json)
- 出力SHA-256: `F274BBA32AD25717243BD56B88C79FB5F0029DF7E740878D196537F128D2ACBF`
- 標準エラー: なし
- 結果: 56 Markdown、1,223ローカルリンク、444アンカー、24版管理文書、11是正行を確認。Error 0、Warning 0

## 回帰試験と網羅率

- コマンド: `node --test --experimental-test-coverage --test-reporter=tap --test-reporter-destination=90_Release/Changes/Evidence/CHG-000007_Test_Run_5143e38.tap tools/crdd_check.test.mjs`
- 開始時刻（UTC）: `2026-08-08T14:44:37.6882550Z`
- 終了時刻（UTC）: `2026-08-08T14:45:06.5358514Z`
- Exit Code: `0`
- 試験定義SHA-256: `65A274EF4EF93FFB9C503D08F6C87EC890D6F937D52E7510CCD695A0D66C68DC`
- 完全なTAP結果: [Test Result](CHG-000007_Test_Run_5143e38.tap)
- 出力SHA-256: `183989FF47F576B93D6B2BA556DB586DB6C92222E61CD035926B6A2DD8130ED5`
- 標準エラー: なし
- 結果: 111件中111件合格。Checker本体は行100%、分岐100%、関数96.84%

## 証明できない範囲

- 機械確認は規範の意味、判断の妥当性、専門品質および人間のリリース判断を代替しない
- 適用先試行のRaw Evidenceは本リポジトリから参照できず、この実行では再計算していない
- 未追跡の`CRDD_Introduction.pptx`は対象コミットに含まれず、本検証の対象外である
