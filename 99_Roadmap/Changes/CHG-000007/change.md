# 変更トレース: 複数箇所の是正適用

変更トレースID: `CHG-000007`
状態: `Ready for Verification`
担当責任者: Qual-Lab
最終更新日: 2026-08-08

正本規則: [変更](../../../12_Change.md)

## 契機 / 起点

監査とレビューは、初回走査、水平探索、共通原因の整理、境界付き修正提案まで成熟した。一方、修正担当が合意済み方針を適用するとき、一つの指摘に含まれる複数の影響箇所を暗黙に扱い、参照、ひな型、ガイド、例示、同義表現等の一部が再監査まで残る事象があった。

問題は監査種別の不足ではなく、合意した修正方針に対して、どの箇所まで処置すれば適用完了かを修正前に固定し、修正後に全数照合する契約が不足していることである。

## 保持する意図

- 合意済み修正の適用漏れを再監査前に減らす
- 監査が確定した根本原因、期待する状態、水平探索を再利用し、意味監査を重複しない
- 修正件数だけでなく、分母の根拠と対象別処置へ辿れるようにする
- 単一の局所修正を重い運用へ変えない
- 特定AI、固定ツール、固定ファイル形式へ依存しない

## 対象外 / 変更してはならないこと

- 新しい監査、承認段階、恒久成果物、専用ファイル、安定コンテキストIDを追加しない
- 修正担当へ監査の意味評価を最初からやり直させない
- 件数または割合だけを修正完了の証明にしない
- 母集団を確定できない意味探索へ推測値を置かない
- 既存の初回レビュー網羅性、境界付き修正提案、監査間是正方針レビューを複製しない

## 変更分類と移行

- 変更分類: `breaking`
- 理由: AIがレビューまたは監査の指摘を修正して再レビューへ渡すまでの必須行動とAgentic Delivery基準`AD-21`に加え、品質保証の固定後根拠とProduct Lifecycle基準`PL-16`の判定根拠を変更する
- リリースレベル: `MINOR`
- 対象バージョン: `v0.13.0`
- `migration_required`: `true`
- 移行対象: すべての既存基準版採用は移行完了の条件の対象。AIを使用してレビューまたは監査の指摘を修正する採用プロジェクトはAI入口または同等手順と`AD-21`を再評価する。品質保証を使用する採用プロジェクトは、現在状態へ使う根拠、今後生成する根拠、その生成手順について`PL-16`を再評価する

移行では、複数箇所へ及ぶ是正で対象一覧と対象別処置を照合できるかを確認する。同等の規律がなければAI入口または作業手順を新しい正本へ接続し、`AD-21`を再評価する。品質保証を使用する場合は、固定本文と固定後の現在記録の分離、および現在へ使う新しい根拠の識別・再現情報を確認し、`PL-16`を再評価する。完了済みで現在状態へ使わない過去根拠、プロダクト成果物、フォルダ、安定コンテキストID、完了済みレビュー、過去の変更トレースの一律書換えは要求しない。

## 着手前整合確認

結果: `着手可`

確認した対象:

- 正本: `10_Agent.md`、`19_Maintenance.md`
- 直接接続: `00_Overview.md`、`51_Document_Audit.md`、`52_Conformance_Audit.md`、`53_Gap_Impact_Audit.md`
- AI入口: Root／Templateの`AGENTS.md`
- 人間向け案内: `README.md`
- 版と移行: `CHANGELOG.md`、本変更トレース、正本文書の版表示

統合方針:

- 複数箇所へ及ぶ是正対象の列挙と照合を、既存の是正手順内の行為規則として追加する
- 一つの指摘または原因が複数箇所へ及ぶ場合に、修正前の対象一覧と修正後の対象別照合を要求する
- 有限母集団では件数と処置、有限にできない探索では方法、範囲、未確認範囲、限界を示す
- 単一の明らかな局所修正は簡潔に扱う
- 固定のスキーマキーは追加せず、三つの是正状態軸を補助的な正式用語として登録し、既存の`Bounded Remediation Proposal`と`Cross-Audit Remediation Reconciliation`の境界を維持する

## 変更対象

- [概要](../../../00_Overview.md): 横断経路へ複数箇所の是正手順の案内を追加
- [エージェント](../../../10_Agent.md): 母集団、対象別処置、修正前境界、再監査前セルフチェックを追加
- [用語集](../../../02_Terminology.md): 三つの是正状態軸と既存状態体系との境界を追加
- [品質保証](../../../16_Quality_Assurance.md): 固定本文と固定後の現在記録、新しい根拠の識別・再現情報を追加
- [保守](../../../19_Maintenance.md): 指摘と編集の対応に加えて、影響箇所と処置結果の対応を追加
- [文書監査](../../../51_Document_Audit.md): 文書上の水平探索候補が対象一覧へ含まれることを確認
- [準拠監査](../../../52_Conformance_Audit.md): `AD-21`へ是正対象の列挙と照合を追加
- [不足／影響監査](../../../53_Gap_Impact_Audit.md): 工程・正本横断の影響候補が対象一覧へ含まれることを確認
- Root／Templateの`AGENTS.md`: 採用側と標準保守側のAI入口へ実行規則を接続
- `README.md`: 人間向けの短い説明と移行案内を追加
- `CHANGELOG.md`: v0.12.0からv0.13.0の純粋差分と移行注記を追加

更新不要:

- `11_Skill.md`: 是正対象一覧と照合は親エージェントの責務であり、スキル状態を増やさない
- 工程文書`21`〜`29`: 工程固有の入口、変換、出口、専門品質条件を変更しない
- Checker以外の固定ツール: 意味上の影響母集団と処置妥当性は決定論的に判定しない
- `CLAUDE.md`とCopilot指示: `AGENTS.md`を正本入口として参照し、規則を複製しない

## 是正対象一覧

母集団の根拠: 適用先の効果測定から得た早期完了の根本原因と、同じ固定改訂版に対する3独立監査が返した指摘を統合した。重複を除く指摘は、状態軸の用語登録、`PL-16`と変更分類、CHGの自己適用、試行根拠、非有限母集団、Checkerの表認識、Checkerの状態矛盾、再監査集計の4分類、品質保証文書のロケール表現の9件である。これらが作用する11変更群と直接参照を処置母集団とする。

上流判断は、人間の決定権限者による「適用と解消を分離し、4補強点を加えてv0.13.0候補を改訂する」という指示である。主な利用側は、親エージェント、独立確認者、品質保証記録、準拠監査、採用側AI入口、任意Checker、公開する移行案内である。受入条件は、9件の統合指摘を11変更群へ適用し、機械確認と同じ固定改訂版の独立再監査で通常ゲートを停止する未解決指摘がないこととする。

| 対象 | 処置 | 処置進捗 | 阻害状態 | 解消判定 | 受入条件 | 判定方法 | 根拠 | 独立再レビュー | 現在状態への反映 |
|---|---|---|---|---|---|---|---|---|---|
| 用語集 | 修正 | Self-checked | None | Open | 3状態軸と既存状態の境界が一意 | 用語登録規則との照合 | `02_Terminology.md` | 固定改訂版の再監査待ち | 固定後Review Recordへ接続予定 |
| エージェント正本 | 修正 | Self-checked | None | Open | 母集団、3軸、解消条件、新規指摘分類が成立 | 代表ケースと水平検索 | `10_Agent.md` | 固定改訂版の再レビュー待ち | 固定後Review Recordへ接続予定 |
| 品質保証正本 | 修正 | Self-checked | None | Open | 固定前後の所有と新しい根拠要件が明瞭 | `PL-16`との照合 | `16_Quality_Assurance.md` | 固定改訂版の再監査待ち | 固定後Review Recordへ接続予定 |
| 保守正本 | 修正 | Self-checked | None | Open | 影響箇所と処置結果を編集計画へ接続 | 正本間照合 | `19_Maintenance.md` | 固定改訂版の再監査待ち | 固定後Review Recordへ接続予定 |
| 文書／不足・影響監査 | 修正 | Self-checked | None | Open | 水平探索、縮約、現在状態を監査可能 | 監査契約との照合 | `51_Document_Audit.md`、`53_Gap_Impact_Audit.md` | 固定改訂版の再監査待ち | 固定後Review Recordへ接続予定 |
| 準拠監査 | 修正 | Self-checked | None | Open | `AD-21`と`PL-16`が正本変更を反映 | 基準・必要根拠・移行の照合 | `52_Conformance_Audit.md` | 固定改訂版の再監査待ち | 固定後Review Recordへ接続予定 |
| Root／Template AI入口 | 修正 | Self-checked | None | Open | 親エージェントが同じ解消条件を使用 | 正本参照と日英境界の照合 | `AGENTS.md`、`template/AGENTS.md` | 固定改訂版の再レビュー待ち | 固定後Review Recordへ接続予定 |
| README／概要 | 修正 | Self-checked | None | Open | 人間向け説明と変更経路が正本に一致 | 公開要約との照合 | `README.md`、`00_Overview.md` | 固定改訂版の再監査待ち | 固定後Review Recordへ接続予定 |
| Checker／回帰試験 | 修正 | Self-checked | None | Open | GFM表、列不足、状態矛盾、早期解消を検出 | 111回帰試験と網羅率 | Checker結果、回帰試験結果 | 固定改訂版のコード再レビュー待ち | 固定後Review Recordへ接続予定 |
| 版／変更履歴／移行 | 修正 | Self-checked | None | Open | v0.13.0純粋差分、breaking、`AD-21`／`PL-16`移行が一致 | 英日差分と保守規則の照合 | `CHANGELOG.md` | 固定改訂版の再監査待ち | 固定後Review Recordへ接続予定 |
| 変更トレース／試行根拠 | 修正 | Self-checked | None | Open | 履歴と現在状態を分離し、試行数値へ辿れる | 本表、Evidence、状態欄の照合 | 本CHG、試行報告 | 固定改訂版の再監査待ち | 固定後Review Recordへ接続予定 |

## 検証計画

- CRDD全体Checkerによるリンク、アンカー、版、構造の確認
- エージェント運用の独立レビューによる責務境界、軽量性、既存レビューとの重複確認
- 文書監査による正本配置、参照、重複、用語、可読性、版の確認
- 不足／影響監査による採用側、AI入口、監査経路、工程への影響確認
- 準拠影響確認による`AD-21`、変更分類、移行要否の確認

## 実際の影響 / 逸脱

- 単独レビュー／監査と複数監査の双方で、親エージェントが合意済みの水平探索から具体的な是正対象を列挙し、対象別の処置を照合する規則を追加した
- 当初案の固有スキーマキーと名称は正式用語登録条件と競合したため削除し、固定形式を持たない行為規則へ修正した
- 全既存基準版更新に必要な移行完了条件と、AI入口の更新および`AD-21`再評価が必要になる条件を分離した
- 文書監査と不足／影響監査は既存の再提示確認を拡張しただけで、新しい監査種別や承認を追加していない
- 中核基準、`PL-01`、工程文書、スキル状態には本変更だけを理由とする規範変更がない。`PL-16`の判定根拠は変更した
- 品質保証では、固定本文と固定後の現在状態・根拠の所有境界を明確にした
- Checkerには、認識可能な是正表の状態値、早期解消、阻害情報の欠落を検出する軽量確認を追加した
- 実験基準コミット`cb510e6261fd44775d843c6e40fa7f737fb7a158`を適用先で試行した結果、対象列挙は修正漏れと未評価範囲の発見に有効だったが、適用と解消の境界、契約母集団、固定後根拠、現在状態への反映が不足していた
- 試行の対象同一性、集計値、情報源、再現上の限界は[適用先試行報告](./Evidence/260808-2335_adopter-trial-report.md)へ記録した
- そのため、処置進捗、阻害状態、解消判定の分離、`Resolved`条件、母集団縮約の説明責任、固定前内容と固定後根拠の分離、機械確認可能な早期完了の検出を追加するため本CHGを再開した

## 正本コンテキストの更新

- `10_Agent.md`を、複数箇所へ及ぶ是正対象の列挙、対象別処置、有限／非有限母集団、停止条件、再監査前照合の正本とした
- `19_Maintenance.md`の編集計画を、指摘と編集の対応だけでなく、影響箇所と処置結果の対応へ接続した
- `51_Document_Audit.md`と`53_Gap_Impact_Audit.md`へ、各監査が水平探索した候補と是正対象一覧の対応確認を追加した
- `52_Conformance_Audit.md`の`AD-21`へ、複数箇所の対象列挙と処置結果の照合を追加した
- `16_Quality_Assurance.md`へ、固定本文と固定後の根拠・現在状態の所有境界、新しい根拠の最小識別情報を追加した
- 当時の`template/tools/crdd_check.ts`へ任意の是正表に対する軽量確認を追加し、当時の`tools/crdd_check.test.ts`で正常、早期解消、阻害情報不足を回帰確認した。現在の配布正本は[`template/tools/crdd-check.ts`](../../../template/tools/crdd-check.ts)、現在の試験移設先は[`40_Develop/checker/tests/integration/crdd-check.contract.test.ts`](../../../40_Develop/checker/tests/integration/crdd-check.contract.test.ts)
- Root／Templateの`AGENTS.md`、概要、README、CHANGELOGへ同じ責務境界を反映した

## 検証結果

- 初回の全体Checker: 55 Markdown、1,211ローカルリンク、437アンカー、24版管理文書を確認し、Error 0／Warning 0
- 初回のエージェント運用独立レビュー: `Pass`、指摘0件
- 初回の文書監査: `Fail`。固有キーと正式用語方針の競合、実質更新した正本の日付、公開要約の処置粒度の3件を指摘
- 初回の不足／影響・準拠影響レビュー: `Fail`。単独レビューへの適用範囲、固有キーと正式用語方針の競合、移行完了条件とプロファイル再評価境界の3件を指摘
- 重複を統合した5件の修正方針を全対象へ適用し、固有名称と固有キーの残存0件、実質更新した6正本の日付、英日要約の5処置、移行境界を照合した
- 修正後の全体Checker: 55 Markdown、1,211ローカルリンク、437アンカー、24版管理文書を確認し、Error 0／Warning 0
- 修正後のエージェント運用独立レビュー: `Pass`、指摘0件
- 修正後の文書再監査: `Pass`。初回3件はすべて解消し、新規指摘0件
- 修正後の不足／影響・準拠影響レビュー: `Pass`。初回3件はすべて解消し、新規指摘0件
- 前回候補の再監査時点の未解決指摘事項: 0件
- 適用先の効果測定: 同一R28固定版に対する10件の独立レビュー／監査はすべて`Fail`。R27の根本原因8件は8件とも再発した
- 一方、28処置への事前分解により、修正漏れ、未評価、新規見落としを具体的に発見できた。統合したR29是正方針は10確認者すべて`Accept with Conditions`、`Reject` 0、直接競合0。R28の104 Pathは変更していない
- 効果測定の結論: 部分的に有効。対象列挙は有効だが、`Applied`と`Resolved`を分け、受入条件、合否判定方法、固定後の新しい根拠、独立再レビュー、現在状態への伝播まで確認しなければ早期完了を防げない
- 上記の適用先指摘は本CHGの再開理由であり、v0.13.0改訂候補では処置を適用した。固定後の実行記録と独立確認記録をリポジトリ内へ保持していないため、11対象の解消判定は`Open`とする
- 改訂候補のChecker回帰試験: 111件すべて合格。Checker本体は行100%、分岐100%を確認した
- 改訂候補の全体Checker: 56 Markdown、1,223ローカルリンク、444アンカー、24版管理文書、是正表11行を確認し、Error 0／Warning 0
- これまでの会話上の最終独立再確認は、固定対象、確認者、能力根拠、使用基準、確認範囲、未評価範囲および完全結果をリポジトリ内から再構成できないため、解消根拠へ使用しない

## 既知制限 / 残存リスク

- 対象別の照合は、初回レビューまたは監査が影響箇所を漏れなく発見したことまでは証明しない
- 効果は最初の水平探索、利用可能なコンテキスト、確認者の能力、AIの指示追従に依存する
- 実プロジェクトで再監査回数または処理コストがどの程度減るかは未計測
- 適用先試行のRaw Evidenceは本リポジトリから参照できず、提供された集計値を第三者が再計算することはできない

## 後続対応 / ロードマップ

- Qual-Labの人間の決定権限者は、正式タグを増やさず、featureブランチの確定コミットを適用先で固定してリリース前検証を行うと判断した。実験基準コミット`cb510e6261fd44775d843c6e40fa7f737fb7a158`の試行は完了した
- 担当責任者: Qual-Lab
- 次の処置: 本状態をコミットして固定改訂版とし、Checker／回帰試験の実行記録と3系統の独立確認記録を固定後Evidenceとして取得する
- 確認観点: 複数箇所の修正漏れ、再監査の往復、単一箇所の軽微修正への負荷、対象一覧作成の過剰負荷
- 完了条件: 正式リリースを妨げる破綻がないことを人間の決定権限者が確認する。削減率の定量保証は正式リリースの必須条件にしない
- 再評価条件: 試行で規範の意味、軽量性、AI入口または準拠基準へ影響する問題が見つかった場合は、本CHGを更新して必要な正本と監査を再開する
- 正式リリース後に新しい運用データが得られた場合は、本変更の未完了作業として再開せず、新しい根拠を伴う別の変更契機として評価する

## リリース

- 対象バージョン: `v0.13.0`
- 収録リリース: 未確定
- 現在の処置: `Ready for Verification`
- 統合: 未確定
- 公開識別子: 未確定

### 影響ファイル

<details>
<summary>全ファイルを表示</summary>

- [`.gitattributes`](<../../../.gitattributes>)
- [`.github/pull_request_template.md`](<../../../.github/pull_request_template.md>)
- [`00_Overview.md`](<../../../00_Overview.md>)
- `01_Discovery/01_CRDD_Product_Discovery.md`（削除または旧Path）
- [`01_Principles.md`](<../../../01_Principles.md>)
- [`02_Terminology.md`](<../../../02_Terminology.md>)
- [`02_UX/01_User_Experience.md`](<../../../02_UX/01_User_Experience.md>)
- [`03_Documentation.md`](<../../../03_Documentation.md>)
- [`03_IA/01_Information_Architecture.md`](<../../../03_IA/01_Information_Architecture.md>)
- [`04_Agent_Organization.md`](<../../../04_Agent_Organization.md>)
- [`04_UI/01_User_Interface.md`](<../../../04_UI/01_User_Interface.md>)
- [`05_SPEC/01_Behavior_Specification.md`](<../../../05_SPEC/01_Behavior_Specification.md>)
- [`06_Architecture/01_Architecture.md`](<../../../06_Architecture/01_Architecture.md>)
- [`06_Architecture/99_Coding_Standards.md`](<../../../06_Architecture/99_Coding_Standards.md>)
- [`06_Architecture/Details/checker/01_Architecture.md`](<../../../06_Architecture/Details/checker/01_Architecture.md>)
- [`06_Architecture/Details/coordinator/01_Architecture.md`](<../../../06_Architecture/Details/coordinator/01_Architecture.md>)
- [`06_Architecture/Details/coordinator/02_Threat_Model.md`](<../../../06_Architecture/Details/coordinator/02_Threat_Model.md>)
- [`06_Architecture/Details/platform-access/01_Architecture.md`](<../../../06_Architecture/Details/platform-access/01_Architecture.md>)
- [`07_Quality/01_Quality_Center.md`](<../../../07_Quality/01_Quality_Center.md>)
- [`07_Quality/02_Quality_Strategy.md`](<../../../07_Quality/02_Quality_Strategy.md>)
- [`07_Quality/03_Verification_Design.md`](<../../../07_Quality/03_Verification_Design.md>)
- [`07_Quality/Registry/test-catalog.json`](<../../../07_Quality/Registry/test-catalog.json>)
- `07_Quality/Verification_Results/2026-08-31_Tool_Layout_Development_E2E.md`（削除または旧Path）
- `07_Quality/Verification_Results/2026-08-31_Tool_Layout_Verification.md`（削除または旧Path）
- `07_Quality/Verification_Results/2026-09-01_Coordinator_Completion_Review.md`（削除または旧Path）
- [`10_Agent.md`](<../../../10_Agent.md>)
- [`11_Skill.md`](<../../../11_Skill.md>)
- [`12_Change.md`](<../../../12_Change.md>)
- [`13_Release.md`](<../../../13_Release.md>)
- [`14_Workflow.md`](<../../../14_Workflow.md>)
- [`15_Progress.md`](<../../../15_Progress.md>)
- [`16_Quality_Assurance.md`](<../../../16_Quality_Assurance.md>)
- [`19_Maintenance.md`](<../../../19_Maintenance.md>)
- [`19_Workflows/01_Coordinator_Runtime.md`](<../../../19_Workflows/01_Coordinator_Runtime.md>)
- [`19_Workflows/02_Checker.md`](<../../../19_Workflows/02_Checker.md>)
- [`21_Discovery.md`](<../../../21_Discovery.md>)
- [`22_UX.md`](<../../../22_UX.md>)
- [`23_IA.md`](<../../../23_IA.md>)
- [`24_UI_Behavior_Specification.md`](<../../../24_UI_Behavior_Specification.md>)
- [`25_UI.md`](<../../../25_UI.md>)
- [`26_Behavior_Specification.md`](<../../../26_Behavior_Specification.md>)
- [`27_Architecture.md`](<../../../27_Architecture.md>)
- [`28_Implementation.md`](<../../../28_Implementation.md>)
- [`29_Verification.md`](<../../../29_Verification.md>)
- [`40_Develop/checker/.gitignore`](<../../../40_Develop/checker/.gitignore>)
- `40_Develop/checker/crdd-check.contract.test.ts`（削除または旧Path）
- [`40_Develop/checker/bin/crdd-check.ts`](<../../../40_Develop/checker/bin/crdd-check.ts>)
- [`40_Develop/checker/tests/support/fault-injector.ts`](<../../../40_Develop/checker/tests/support/fault-injector.ts>)
- [`40_Develop/checker/package-lock.json`](<../../../40_Develop/checker/package-lock.json>)
- [`40_Develop/checker/package.json`](<../../../40_Develop/checker/package.json>)
- [`40_Develop/verification-runner/bin/regression-runner.ts`](<../../../40_Develop/verification-runner/bin/regression-runner.ts>)
- [`40_Develop/verification-runner/src/catalog/test-catalog.ts`](<../../../40_Develop/verification-runner/src/catalog/test-catalog.ts>)
- [`40_Develop/checker/tests/support/test-discovery.ts`](<../../../40_Develop/checker/tests/support/test-discovery.ts>)
- [`40_Develop/checker/tests/test-runner.ts`](<../../../40_Develop/checker/tests/test-runner.ts>)
- [`40_Develop/checker/tests/integration/crdd-check.contract.test.ts`](<../../../40_Develop/checker/tests/integration/crdd-check.contract.test.ts>)
- [`40_Develop/verification-runner/tests/integration/regression-runner.contract.test.ts`](<../../../40_Develop/verification-runner/tests/integration/regression-runner.contract.test.ts>)
- [`40_Develop/checker/tests/integration/tools-naming.contract.test.ts`](<../../../40_Develop/checker/tests/integration/tools-naming.contract.test.ts>)
- [`40_Develop/verification-runner/tests/unit/test-catalog.contract.test.ts`](<../../../40_Develop/verification-runner/tests/unit/test-catalog.contract.test.ts>)
- `40_Develop/checker/tools-naming.contract.test.ts`（削除または旧Path）
- [`40_Develop/checker/tsconfig.json`](<../../../40_Develop/checker/tsconfig.json>)
- [`40_Develop/coordinator/.gitignore`](<../../../40_Develop/coordinator/.gitignore>)
- [`40_Develop/coordinator/bin/coordinator.ts`](<../../../40_Develop/coordinator/bin/coordinator.ts>)
- [`40_Develop/coordinator/package-lock.json`](<../../../40_Develop/coordinator/package-lock.json>)
- [`40_Develop/coordinator/package.json`](<../../../40_Develop/coordinator/package.json>)
- `40_Develop/coordinator/policies/windows-docker-desktop-4.41.2.policy`（削除または旧Path）
- [`40_Develop/coordinator/runtime/claude-managed-settings.json`](<../../../40_Develop/coordinator/runtime/claude-managed-settings.json>)
- [`40_Develop/coordinator/runtime/claude-provider.Dockerfile`](<../../../40_Develop/coordinator/runtime/claude-provider.Dockerfile>)
- [`40_Develop/coordinator/runtime/claude-task-settings.json`](<../../../40_Develop/coordinator/runtime/claude-task-settings.json>)
- [`40_Develop/coordinator/runtime/codex-executor-result-schema.json`](<../../../40_Develop/coordinator/runtime/codex-executor-result-schema.json>)
- [`40_Develop/coordinator/runtime/codex-provider.Dockerfile`](<../../../40_Develop/coordinator/runtime/codex-provider.Dockerfile>)
- [`40_Develop/coordinator/runtime/codex-result-schema.json`](<../../../40_Develop/coordinator/runtime/codex-result-schema.json>)
- [`40_Develop/coordinator/runtime/codex-reviewer-result-schema.json`](<../../../40_Develop/coordinator/runtime/codex-reviewer-result-schema.json>)
- `40_Develop/coordinator/runtime/coordinator-runtime-traceability.json`（削除または旧Path）
- [`40_Develop/coordinator/runtime/general-task-verification.txt`](<../../../40_Develop/coordinator/runtime/general-task-verification.txt>)
- `40_Develop/coordinator/runtime/project-runtime-design-traceability.json`（削除または旧Path）
- [`40_Develop/coordinator/runtime/provider-egress-proxy.Dockerfile`](<../../../40_Develop/coordinator/runtime/provider-egress-proxy.Dockerfile>)
- [`40_Develop/coordinator/runtime/provider-egress-proxy.py`](<../../../40_Develop/coordinator/runtime/provider-egress-proxy.py>)
- `40_Develop/coordinator/scripts/build-native-bootstrap.ts`（削除または旧Path）
- [`40_Develop/coordinator/scripts/check-dynamic-fake-provider-coverage.ts`](<../../../40_Develop/coordinator/scripts/check-dynamic-fake-provider-coverage.ts>)
- `40_Develop/coordinator/scripts/check-native-bootstrap-pe.ts`（削除または旧Path）
- [`40_Develop/coordinator/scripts/check-native-runtime-trace.ts`](<../../../40_Develop/coordinator/scripts/check-native-runtime-trace.ts>)
- [`40_Develop/coordinator/scripts/check-platform-access-coverage.ts`](<../../../40_Develop/coordinator/scripts/check-platform-access-coverage.ts>)
- [`40_Develop/coordinator/scripts/check-platform-access-ts-coverage.ts`](<../../../40_Develop/coordinator/scripts/check-platform-access-ts-coverage.ts>)
- [`40_Develop/coordinator/scripts/check-project-runtime-design-traceability.ts`](<../../../40_Develop/coordinator/scripts/check-project-runtime-design-traceability.ts>)
- [`40_Develop/coordinator/scripts/check-provider-authority-coverage.ts`](<../../../40_Develop/coordinator/scripts/check-provider-authority-coverage.ts>)
- [`40_Develop/coordinator/scripts/check-provider-home-coverage.ts`](<../../../40_Develop/coordinator/scripts/check-provider-home-coverage.ts>)
- [`40_Develop/coordinator/scripts/check-runtime-traceability.ts`](<../../../40_Develop/coordinator/scripts/check-runtime-traceability.ts>)
- [`40_Develop/coordinator/scripts/generate-release-key.ts`](<../../../40_Develop/coordinator/scripts/generate-release-key.ts>)
- [`40_Develop/coordinator/scripts/measure-development-providers.ts`](<../../../40_Develop/coordinator/scripts/measure-development-providers.ts>)
- [`40_Develop/coordinator/scripts/platform-access-coverage-path.ts`](<../../../40_Develop/coordinator/scripts/platform-access-coverage-path.ts>)
- [`40_Develop/coordinator/scripts/project-runtime-real-provider-contract.ts`](<../../../40_Develop/coordinator/scripts/project-runtime-real-provider-contract.ts>)
- [`40_Develop/coordinator/scripts/promote-release-manifest.ts`](<../../../40_Develop/coordinator/scripts/promote-release-manifest.ts>)
- [`40_Develop/coordinator/scripts/release-staging-manifest.ts`](<../../../40_Develop/coordinator/scripts/release-staging-manifest.ts>)
- [`40_Develop/coordinator/scripts/revoke-external-send-consent.ts`](<../../../40_Develop/coordinator/scripts/revoke-external-send-consent.ts>)
- [`40_Develop/coordinator/scripts/sign-release-manifest.ts`](<../../../40_Develop/coordinator/scripts/sign-release-manifest.ts>)
- [`40_Develop/coordinator/scripts/verify-dynamic-fake-provider-cancellation.ts`](<../../../40_Develop/coordinator/scripts/verify-dynamic-fake-provider-cancellation.ts>)
- [`40_Develop/coordinator/scripts/verify-dynamic-fake-provider-failures.ts`](<../../../40_Develop/coordinator/scripts/verify-dynamic-fake-provider-failures.ts>)
- [`40_Develop/coordinator/scripts/verify-project-runtime-real-providers.ts`](<../../../40_Develop/coordinator/scripts/verify-project-runtime-real-providers.ts>)
- [`40_Develop/coordinator/scripts/verify-signed-general-task.ts`](<../../../40_Develop/coordinator/scripts/verify-signed-general-task.ts>)
- [`40_Develop/coordinator/scripts/verify-signed-recovery-matrix.ts`](<../../../40_Develop/coordinator/scripts/verify-signed-recovery-matrix.ts>)
- [`40_Develop/coordinator/scripts/verify-signed-route-matrix.ts`](<../../../40_Develop/coordinator/scripts/verify-signed-route-matrix.ts>)
- [`40_Develop/coordinator/src/core/cli-options.ts`](<../../../40_Develop/coordinator/src/core/cli-options.ts>)
- [`40_Develop/coordinator/src/core/command-report.ts`](<../../../40_Develop/coordinator/src/core/command-report.ts>)
- [`40_Develop/coordinator/src/core/development-execution-timing.ts`](<../../../40_Develop/coordinator/src/core/development-execution-timing.ts>)
- [`40_Develop/coordinator/src/core/docker-cleanup-eligibility.ts`](<../../../40_Develop/coordinator/src/core/docker-cleanup-eligibility.ts>)
- [`40_Develop/coordinator/src/core/docker-desktop-repair-doctor-dispatch.ts`](<../../../40_Develop/coordinator/src/core/docker-desktop-repair-doctor-dispatch.ts>)
- [`40_Develop/coordinator/src/core/docker-recovery-command-report.ts`](<../../../40_Develop/coordinator/src/core/docker-recovery-command-report.ts>)
- [`40_Develop/coordinator/src/core/doctor.ts`](<../../../40_Develop/coordinator/src/core/doctor.ts>)
- [`40_Develop/coordinator/src/core/host-generation-loss-transition.ts`](<../../../40_Develop/coordinator/src/core/host-generation-loss-transition.ts>)
- [`40_Develop/coordinator/src/core/interactive-console-reader.ts`](<../../../40_Develop/coordinator/src/core/interactive-console-reader.ts>)
- [`40_Develop/coordinator/src/core/interactive-console.ts`](<../../../40_Develop/coordinator/src/core/interactive-console.ts>)
- [`40_Develop/coordinator/src/core/node-runtime-version.ts`](<../../../40_Develop/coordinator/src/core/node-runtime-version.ts>)
- [`40_Develop/coordinator/src/core/project-runtime-design-traceability.ts`](<../../../40_Develop/coordinator/src/core/project-runtime-design-traceability.ts>)
- [`40_Develop/coordinator/src/core/runtime-process-safety-state.ts`](<../../../40_Develop/coordinator/src/core/runtime-process-safety-state.ts>)
- [`40_Develop/coordinator/src/core/runtime-traceability.ts`](<../../../40_Develop/coordinator/src/core/runtime-traceability.ts>)
- [`40_Develop/coordinator/src/core/task-cli-cancellation.ts`](<../../../40_Develop/coordinator/src/core/task-cli-cancellation.ts>)
- [`40_Develop/coordinator/src/core/windows-child-environment.ts`](<../../../40_Develop/coordinator/src/core/windows-child-environment.ts>)
- [`40_Develop/coordinator/src/security/authority-file-bundle.ts`](<../../../40_Develop/coordinator/src/security/authority-file-bundle.ts>)
- [`40_Develop/coordinator/src/security/authority-grant-verifier.ts`](<../../../40_Develop/coordinator/src/security/authority-grant-verifier.ts>)
- [`40_Develop/coordinator/src/security/authority-prelaunch-verifier.ts`](<../../../40_Develop/coordinator/src/security/authority-prelaunch-verifier.ts>)
- `40_Develop/coordinator/src/security/authority-root-locator.ts`（削除または旧Path）
- [`40_Develop/coordinator/src/security/authority-root-path-lexical.ts`](<../../../40_Develop/coordinator/src/security/authority-root-path-lexical.ts>)
- `40_Develop/coordinator/src/security/authority-root-profile.ts`（削除または旧Path）
- [`40_Develop/coordinator/src/security/authority-trust-loader.ts`](<../../../40_Develop/coordinator/src/security/authority-trust-loader.ts>)
- [`40_Develop/coordinator/src/security/bounded-file-snapshot.ts`](<../../../40_Develop/coordinator/src/security/bounded-file-snapshot.ts>)
- [`40_Develop/coordinator/src/security/candidate-bundle-store.ts`](<../../../40_Develop/coordinator/src/security/candidate-bundle-store.ts>)
- [`40_Develop/coordinator/src/security/candidate-store-kernel-lock.ts`](<../../../40_Develop/coordinator/src/security/candidate-store-kernel-lock.ts>)
- [`40_Develop/coordinator/src/security/candidate-store-lock-worker.ts`](<../../../40_Develop/coordinator/src/security/candidate-store-lock-worker.ts>)
- [`40_Develop/coordinator/src/security/candidate-store-windows-adapter.ts`](<../../../40_Develop/coordinator/src/security/candidate-store-windows-adapter.ts>)
- [`40_Develop/coordinator/src/security/claude-docker-runtime-adapter.ts`](<../../../40_Develop/coordinator/src/security/claude-docker-runtime-adapter.ts>)
- [`40_Develop/coordinator/src/security/claude-execution-plan.ts`](<../../../40_Develop/coordinator/src/security/claude-execution-plan.ts>)
- [`40_Develop/coordinator/src/security/claude-structured-result.ts`](<../../../40_Develop/coordinator/src/security/claude-structured-result.ts>)
- [`40_Develop/coordinator/src/security/codex-docker-runtime-adapter.ts`](<../../../40_Develop/coordinator/src/security/codex-docker-runtime-adapter.ts>)
- [`40_Develop/coordinator/src/security/codex-execution-plan.ts`](<../../../40_Develop/coordinator/src/security/codex-execution-plan.ts>)
- [`40_Develop/coordinator/src/security/codex-structured-result.ts`](<../../../40_Develop/coordinator/src/security/codex-structured-result.ts>)
- [`40_Develop/coordinator/src/security/coordinator-operation-creation-internal.ts`](<../../../40_Develop/coordinator/src/security/coordinator-operation-creation-internal.ts>)
- [`40_Develop/coordinator/src/security/coordinator-task-request.ts`](<../../../40_Develop/coordinator/src/security/coordinator-task-request.ts>)
- [`40_Develop/coordinator/src/security/coordinator-task-runtime.ts`](<../../../40_Develop/coordinator/src/security/coordinator-task-runtime.ts>)
- [`40_Develop/coordinator/src/security/delegation-route-selection.ts`](<../../../40_Develop/coordinator/src/security/delegation-route-selection.ts>)
- [`40_Develop/coordinator/src/security/delegation-selection-grant-runtime.ts`](<../../../40_Develop/coordinator/src/security/delegation-selection-grant-runtime.ts>)
- [`40_Develop/coordinator/src/security/development-measurement-constraints.ts`](<../../../40_Develop/coordinator/src/security/development-measurement-constraints.ts>)
- [`40_Develop/coordinator/src/security/development-measurement-session.ts`](<../../../40_Develop/coordinator/src/security/development-measurement-session.ts>)
- [`40_Develop/coordinator/src/security/docker-desktop-repair-native-process.ts`](<../../../40_Develop/coordinator/src/security/docker-desktop-repair-native-process.ts>)
- `40_Develop/coordinator/src/security/docker-desktop-repair-policy.ts`（削除または旧Path）
- [`40_Develop/coordinator/src/security/docker-desktop-repair-record-store.ts`](<../../../40_Develop/coordinator/src/security/docker-desktop-repair-record-store.ts>)
- [`40_Develop/coordinator/src/security/docker-desktop-runtime-repair.ts`](<../../../40_Develop/coordinator/src/security/docker-desktop-runtime-repair.ts>)
- [`40_Develop/coordinator/src/security/docker-effect-runtime.ts`](<../../../40_Develop/coordinator/src/security/docker-effect-runtime.ts>)
- [`40_Develop/coordinator/src/security/docker-host-transition-state.ts`](<../../../40_Develop/coordinator/src/security/docker-host-transition-state.ts>)
- [`40_Develop/coordinator/src/security/docker-isolation.ts`](<../../../40_Develop/coordinator/src/security/docker-isolation.ts>)
- [`40_Develop/coordinator/src/security/docker-owned-process.ts`](<../../../40_Develop/coordinator/src/security/docker-owned-process.ts>)
- [`40_Develop/coordinator/src/security/docker-process-controller.ts`](<../../../40_Develop/coordinator/src/security/docker-process-controller.ts>)
- [`40_Develop/coordinator/src/security/docker-recovery-identity.ts`](<../../../40_Develop/coordinator/src/security/docker-recovery-identity.ts>)
- [`40_Develop/coordinator/src/security/docker-recovery-journal.ts`](<../../../40_Develop/coordinator/src/security/docker-recovery-journal.ts>)
- [`40_Develop/coordinator/src/security/docker-recovery-lock-controller.ts`](<../../../40_Develop/coordinator/src/security/docker-recovery-lock-controller.ts>)
- [`40_Develop/coordinator/src/security/docker-recovery-public-projection.ts`](<../../../40_Develop/coordinator/src/security/docker-recovery-public-projection.ts>)
- [`40_Develop/coordinator/src/security/docker-recovery-runtime-internal.ts`](<../../../40_Develop/coordinator/src/security/docker-recovery-runtime-internal.ts>)
- [`40_Develop/coordinator/src/security/docker-recovery-runtime.ts`](<../../../40_Develop/coordinator/src/security/docker-recovery-runtime.ts>)
- [`40_Develop/coordinator/src/security/docker-recovery-state-machine.ts`](<../../../40_Develop/coordinator/src/security/docker-recovery-state-machine.ts>)
- [`40_Develop/coordinator/src/security/docker-runtime-state-binding.ts`](<../../../40_Develop/coordinator/src/security/docker-runtime-state-binding.ts>)
- [`40_Develop/coordinator/src/security/egress-proxy-policy.ts`](<../../../40_Develop/coordinator/src/security/egress-proxy-policy.ts>)
- `40_Develop/coordinator/src/security/enrollment-certificate-renewal.ts`（削除または旧Path）
- [`40_Develop/coordinator/src/security/execution-environment.ts`](<../../../40_Develop/coordinator/src/security/execution-environment.ts>)
- [`40_Develop/coordinator/src/security/external-send-consent-record.ts`](<../../../40_Develop/coordinator/src/security/external-send-consent-record.ts>)
- [`40_Develop/coordinator/src/security/external-send-consent-runtime.ts`](<../../../40_Develop/coordinator/src/security/external-send-consent-runtime.ts>)
- [`40_Develop/coordinator/src/security/external-send-grant-runtime.ts`](<../../../40_Develop/coordinator/src/security/external-send-grant-runtime.ts>)
- [`40_Develop/coordinator/src/security/external-send-policy-runtime.ts`](<../../../40_Develop/coordinator/src/security/external-send-policy-runtime.ts>)
- `40_Develop/coordinator/src/security/git-local-exclude.ts`（削除または旧Path）
- `40_Develop/coordinator/src/security/git-object-reader.ts`（削除または旧Path）
- [`40_Develop/coordinator/src/security/host-operation-lock-supervisor.ts`](<../../../40_Develop/coordinator/src/security/host-operation-lock-supervisor.ts>)
- [`40_Develop/coordinator/src/security/host-recovery-record.ts`](<../../../40_Develop/coordinator/src/security/host-recovery-record.ts>)
- `40_Develop/coordinator/src/security/initial-enrollment-pure-core.ts`（削除または旧Path）
- `40_Develop/coordinator/src/security/initial-enrollment-runtime-state.ts`（削除または旧Path）
- [`40_Develop/coordinator/src/security/local-personal-authority-runtime.ts`](<../../../40_Develop/coordinator/src/security/local-personal-authority-runtime.ts>)
- `40_Develop/coordinator/src/security/mcp-project-runtime-adapter.ts`（削除または旧Path）
- `40_Develop/coordinator/src/security/mcp-project-runtime-stdio.ts`（削除または旧Path）
- `40_Develop/coordinator/src/security/native-bootstrap-pe-inspector.ts`（削除または旧Path）
- `40_Develop/coordinator/src/security/native-provision-supervisor-release.ts`（削除または旧Path）
- [`40_Develop/coordinator/src/security/native-runtime-trace.ts`](<../../../40_Develop/coordinator/src/security/native-runtime-trace.ts>)
- `40_Develop/coordinator/src/security/offline-enrollment-bundle-pure-core.ts`（削除または旧Path）
- [`40_Develop/coordinator/src/security/plain-data-snapshot.ts`](<../../../40_Develop/coordinator/src/security/plain-data-snapshot.ts>)
- [`40_Develop/coordinator/src/security/platform-access-adapter.ts`](<../../../40_Develop/coordinator/src/security/platform-access-adapter.ts>)
- [`40_Develop/coordinator/src/security/platform-access-release.ts`](<../../../40_Develop/coordinator/src/security/platform-access-release.ts>)
- [`40_Develop/coordinator/src/security/platform-key-storage-policy.ts`](<../../../40_Develop/coordinator/src/security/platform-key-storage-policy.ts>)
- `40_Develop/coordinator/src/security/platform-provisioner-active-pointer-store.ts`（削除または旧Path）
- `40_Develop/coordinator/src/security/platform-provisioner-active-pointer.ts`（削除または旧Path）
- `40_Develop/coordinator/src/security/platform-provisioner-effect.ts`（削除または旧Path）
- `40_Develop/coordinator/src/security/platform-provisioner-install-layout.ts`（削除または旧Path）
- [`40_Develop/coordinator/src/security/platform-provisioner-manifest-loader.ts`](<../../../40_Develop/coordinator/src/security/platform-provisioner-manifest-loader.ts>)
- [`40_Develop/coordinator/src/security/platform-provisioner-package-filesystem.ts`](<../../../40_Develop/coordinator/src/security/platform-provisioner-package-filesystem.ts>)
- [`40_Develop/coordinator/src/security/platform-provisioner-package-gate.ts`](<../../../40_Develop/coordinator/src/security/platform-provisioner-package-gate.ts>)
- [`40_Develop/coordinator/src/security/platform-provisioner-policy-identity.ts`](<../../../40_Develop/coordinator/src/security/platform-provisioner-policy-identity.ts>)
- `40_Develop/coordinator/src/security/platform-provisioner-pre-active-one-shot.ts`（削除または旧Path）
- [`40_Develop/coordinator/src/security/platform-provisioner-release-identity.ts`](<../../../40_Develop/coordinator/src/security/platform-provisioner-release-identity.ts>)
- [`40_Develop/coordinator/src/security/platform-provisioner-release-trust.ts`](<../../../40_Develop/coordinator/src/security/platform-provisioner-release-trust.ts>)
- [`40_Develop/coordinator/src/security/platform-provisioner-trust-core.ts`](<../../../40_Develop/coordinator/src/security/platform-provisioner-trust-core.ts>)
- `40_Develop/coordinator/src/security/platform-provisioner-windows-dacl.ts`（削除または旧Path）
- [`40_Develop/coordinator/src/security/project-runtime-candidate-integration-adapter.ts`](<../../../40_Develop/coordinator/src/security/project-runtime-candidate-integration-adapter.ts>)
- [`40_Develop/coordinator/src/security/project-runtime-durable-foundation.ts`](<../../../40_Develop/coordinator/src/security/project-runtime-durable-foundation.ts>)
- `40_Develop/coordinator/src/security/project-runtime-execution.ts`（削除または旧Path）
- `40_Develop/coordinator/src/security/project-runtime-human-decision.ts`（削除または旧Path）
- [`40_Develop/coordinator/src/security/project-runtime-objective-intake.ts`](<../../../40_Develop/coordinator/src/security/project-runtime-objective-intake.ts>)
- `40_Develop/coordinator/src/security/project-runtime-objective-request.ts`（削除または旧Path）
- `40_Develop/coordinator/src/security/project-runtime-public-runtime.ts`（削除または旧Path）
- `40_Develop/coordinator/src/security/project-runtime-replanning.ts`（削除または旧Path）
- [`40_Develop/coordinator/src/security/project-runtime-single-task-adapter.ts`](<../../../40_Develop/coordinator/src/security/project-runtime-single-task-adapter.ts>)
- `40_Develop/coordinator/src/security/project-runtime-state.ts`（削除または旧Path）
- [`40_Develop/coordinator/src/security/project-runtime-windows-decision-store.ts`](<../../../40_Develop/coordinator/src/security/project-runtime-windows-decision-store.ts>)
- [`40_Develop/coordinator/src/security/provider-authority-runtime.ts`](<../../../40_Develop/coordinator/src/security/provider-authority-runtime.ts>)
- [`40_Develop/coordinator/src/security/provider-billing-policy.ts`](<../../../40_Develop/coordinator/src/security/provider-billing-policy.ts>)
- [`40_Develop/coordinator/src/security/provider-eligibility-runtime.ts`](<../../../40_Develop/coordinator/src/security/provider-eligibility-runtime.ts>)
- [`40_Develop/coordinator/src/security/provider-home-mount-grant-runtime.ts`](<../../../40_Develop/coordinator/src/security/provider-home-mount-grant-runtime.ts>)
- [`40_Develop/coordinator/src/security/provider-home-mount-grant.ts`](<../../../40_Develop/coordinator/src/security/provider-home-mount-grant.ts>)
- [`40_Develop/coordinator/src/security/provider-home-observation.ts`](<../../../40_Develop/coordinator/src/security/provider-home-observation.ts>)
- [`40_Develop/coordinator/src/security/provider-home-windows-adapter.ts`](<../../../40_Develop/coordinator/src/security/provider-home-windows-adapter.ts>)
- [`40_Develop/coordinator/src/security/provider-home.ts`](<../../../40_Develop/coordinator/src/security/provider-home.ts>)
- [`40_Develop/coordinator/src/security/provider-isolation-profile.ts`](<../../../40_Develop/coordinator/src/security/provider-isolation-profile.ts>)
- [`40_Develop/coordinator/src/security/provider-lifecycle.ts`](<../../../40_Develop/coordinator/src/security/provider-lifecycle.ts>)
- [`40_Develop/coordinator/src/security/provider-model-profile-runtime.ts`](<../../../40_Develop/coordinator/src/security/provider-model-profile-runtime.ts>)
- [`40_Develop/coordinator/src/security/provider-model-selection-runtime.ts`](<../../../40_Develop/coordinator/src/security/provider-model-selection-runtime.ts>)
- [`40_Develop/coordinator/src/security/provider-task-packet-runtime.ts`](<../../../40_Develop/coordinator/src/security/provider-task-packet-runtime.ts>)
- [`40_Develop/coordinator/src/security/provider-task-structured-result.ts`](<../../../40_Develop/coordinator/src/security/provider-task-structured-result.ts>)
- `40_Develop/coordinator/src/security/provisioning-ca-pure-core.ts`（削除または旧Path）
- `40_Develop/coordinator/src/security/provisioning-record-enrollment-binding.ts`（削除または旧Path）
- `40_Develop/coordinator/src/security/provisioning-record-pure-core.ts`（削除または旧Path）
- `40_Develop/coordinator/src/security/provisioning-record-store.ts`（削除または旧Path）
- [`40_Develop/coordinator/src/security/provisioning-signature-primitives.ts`](<../../../40_Develop/coordinator/src/security/provisioning-signature-primitives.ts>)
- `40_Develop/coordinator/src/security/provisioning-trust-artifact-store.ts`（削除または旧Path）
- `40_Develop/coordinator/src/security/provisioning-trust-floor-store.ts`（削除または旧Path）
- `40_Develop/coordinator/src/security/provisioning-trust-floor.ts`（削除または旧Path）
- [`40_Develop/coordinator/src/security/release-identity-grammar.ts`](<../../../40_Develop/coordinator/src/security/release-identity-grammar.ts>)
- `40_Develop/coordinator/src/security/repository-git-layout-internal.ts`（削除または旧Path）
- `40_Develop/coordinator/src/security/repository-git-layout.ts`（削除または旧Path）
- [`40_Develop/coordinator/src/security/repository-operation-runtime.ts`](<../../../40_Develop/coordinator/src/security/repository-operation-runtime.ts>)
- `40_Develop/coordinator/src/security/repository-root-resolution.ts`（削除または旧Path）
- [`40_Develop/coordinator/src/security/repository-workspace-runtime.ts`](<../../../40_Develop/coordinator/src/security/repository-workspace-runtime.ts>)
- [`40_Develop/coordinator/src/security/root-observation.ts`](<../../../40_Develop/coordinator/src/security/root-observation.ts>)
- [`40_Develop/coordinator/src/security/root-protection-policy.ts`](<../../../40_Develop/coordinator/src/security/root-protection-policy.ts>)
- `40_Develop/coordinator/src/security/runtime-activation-identity.ts`（削除または旧Path）
- `40_Develop/coordinator/src/security/runtime-activation-locator-binding-contract.ts`（削除または旧Path）
- `40_Develop/coordinator/src/security/runtime-activation-locator-binding.ts`（削除または旧Path）
- `40_Develop/coordinator/src/security/runtime-activation-record.ts`（削除または旧Path）
- `40_Develop/coordinator/src/security/runtime-activation-transition.ts`（削除または旧Path）
- `40_Develop/coordinator/src/security/runtime-root-path-identity.ts`（削除または旧Path）
- `40_Develop/coordinator/src/security/runtime-root-profile.ts`（削除または旧Path）
- [`40_Develop/coordinator/src/security/secret-material-policy.ts`](<../../../40_Develop/coordinator/src/security/secret-material-policy.ts>)
- [`40_Develop/coordinator/src/security/signed-runner-safety-observation.ts`](<../../../40_Develop/coordinator/src/security/signed-runner-safety-observation.ts>)
- `40_Develop/coordinator/tests/authority-file-bundle.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/authority-grant-verifier.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/authority-prelaunch-verifier.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/authority-root-locator.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/authority-root-path-lexical.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/authority-root-profile.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/authority-trust-loader.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/bounded-file-snapshot.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/candidate-bundle-store.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/candidate-store-kernel-lock.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/candidate-store-windows-adapter.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/claude-docker-runtime-adapter.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/claude-execution-plan.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/claude-structured-result.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/cli-options.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/codex-docker-runtime-adapter.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/codex-execution-plan.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/codex-structured-result.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/command-report.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/coordinator-claude-delegation.integration.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/coordinator-docker-recovery-cli.integration.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/coordinator-operation-creation-internal.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/coordinator-task-process.integration.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/coordinator-task-runtime.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/delegation-route-selection.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/delegation-selection-grant-runtime.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/development-execution-timing.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/development-measurement-constraints.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/development-measurement-session.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/development-native-observation.integration.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/development-provider-measurement.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/docker-cleanup-eligibility.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/docker-desktop-repair-policy.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/docker-desktop-repair-record-store.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/docker-desktop-runtime-repair.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/docker-effect-runtime.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/docker-host-transition-state.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/docker-process-controller.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/docker-recovery-journal.integration.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/docker-recovery-lock-controller.integration.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/docker-recovery-public-projection.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/docker-recovery-runtime.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/docker-recovery-state-machine.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/docker-runtime-state-binding.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/doctor.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/dynamic-fake-provider-cancellation-verification.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/dynamic-fake-provider-coverage.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/dynamic-fake-provider-failure-verification.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/egress-proxy-policy.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/enrollment-certificate-renewal.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/external-send-consent-docker-recovery.integration.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/external-send-consent-revocation.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/external-send-consent-runtime.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/external-send-grant-runtime.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/external-send-policy-runtime.contract.test.ts`（削除または旧Path）
- [`40_Develop/coordinator/tests/fixtures/candidate-store-lock-owner.ts`](<../../../40_Develop/coordinator/tests/fixtures/candidate-store-lock-owner.ts>)
- [`40_Develop/coordinator/tests/fixtures/docker-auth-probe-inspect-none.json`](<../../../40_Develop/coordinator/tests/fixtures/docker-auth-probe-inspect-none.json>)
- [`40_Develop/coordinator/tests/fixtures/docker-recovery-lock-owner.ts`](<../../../40_Develop/coordinator/tests/fixtures/docker-recovery-lock-owner.ts>)
- [`40_Develop/coordinator/tests/fixtures/interactive-console-lock-liveness.ts`](<../../../40_Develop/coordinator/tests/fixtures/interactive-console-lock-liveness.ts>)
- [`40_Develop/coordinator/tests/fixtures/interactive-console-owned-reader-process.ts`](<../../../40_Develop/coordinator/tests/fixtures/interactive-console-owned-reader-process.ts>)
- [`40_Develop/coordinator/tests/fixtures/interactive-console-parent.ts`](<../../../40_Develop/coordinator/tests/fixtures/interactive-console-parent.ts>)
- [`40_Develop/coordinator/tests/fixtures/project-runtime-public-process-probe.ts`](<../../../40_Develop/coordinator/tests/fixtures/project-runtime-public-process-probe.ts>)
- [`40_Develop/coordinator/tests/fixtures/recovery-cleanup-probe.ts`](<../../../40_Develop/coordinator/tests/fixtures/recovery-cleanup-probe.ts>)
- [`40_Develop/coordinator/tests/fixtures/repair-history-publication-race-worker.ts`](<../../../40_Develop/coordinator/tests/fixtures/repair-history-publication-race-worker.ts>)
- [`40_Develop/coordinator/tests/fixtures/runtime-process-poison-boundary.ts`](<../../../40_Develop/coordinator/tests/fixtures/runtime-process-poison-boundary.ts>)
- [`40_Develop/coordinator/tests/fixtures/signed-general-poison-probe.ts`](<../../../40_Develop/coordinator/tests/fixtures/signed-general-poison-probe.ts>)
- [`40_Develop/coordinator/tests/fixtures/signed-route-poison-probe.ts`](<../../../40_Develop/coordinator/tests/fixtures/signed-route-poison-probe.ts>)
- [`40_Develop/coordinator/tests/fixtures/task-cli-cancellation-strict-probe.ts`](<../../../40_Develop/coordinator/tests/fixtures/task-cli-cancellation-strict-probe.ts>)
- [`40_Develop/coordinator/tests/fixtures/windows-native-helper-environment-unavailable.ts`](<../../../40_Develop/coordinator/tests/fixtures/windows-native-helper-environment-unavailable.ts>)
- [`40_Develop/coordinator/tests/fixtures/windows-native-helper-profile-fault.ts`](<../../../40_Develop/coordinator/tests/fixtures/windows-native-helper-profile-fault.ts>)
- `40_Develop/coordinator/tests/generate-release-key.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/git-local-exclude.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/git-object-reader.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/git-object-reader.integration.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/host-generation-loss-transition.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/initial-enrollment-pure-core.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/initial-enrollment-runtime-state.contract.test.ts`（削除または旧Path）
- [`40_Develop/coordinator/tests/integration/bounded-file-snapshot.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/bounded-file-snapshot.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/candidate-bundle-store.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/candidate-bundle-store.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/candidate-store-kernel-lock.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/candidate-store-kernel-lock.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/claude-execution-plan.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/claude-execution-plan.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/cli-options.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/cli-options.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/codex-execution-plan.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/codex-execution-plan.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/coordinator-claude-delegation.integration.test.ts`](<../../../40_Develop/coordinator/tests/integration/coordinator-claude-delegation.integration.test.ts>)
- [`40_Develop/coordinator/tests/integration/coordinator-task-process.integration.test.ts`](<../../../40_Develop/coordinator/tests/integration/coordinator-task-process.integration.test.ts>)
- [`40_Develop/coordinator/tests/integration/coordinator-task-runtime.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/coordinator-task-runtime.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/development-execution-timing.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/development-execution-timing.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/development-native-observation.integration.test.ts`](<../../../40_Develop/coordinator/tests/integration/development-native-observation.integration.test.ts>)
- [`40_Develop/coordinator/tests/integration/docker-desktop-repair-history-publication.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/docker-desktop-repair-history-publication.contract.test.ts>)
- `40_Develop/coordinator/tests/integration/docker-desktop-repair-policy.contract.test.ts`（削除または旧Path）
- [`40_Develop/coordinator/tests/integration/docker-desktop-repair-record-store.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/docker-desktop-repair-record-store.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/docker-desktop-runtime-repair.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/docker-desktop-runtime-repair.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/docker-effect-runtime.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/docker-effect-runtime.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/docker-owned-process.integration.test.ts`](<../../../40_Develop/coordinator/tests/integration/docker-owned-process.integration.test.ts>)
- [`40_Develop/coordinator/tests/integration/docker-process-controller.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/docker-process-controller.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/docker-recovery-journal.integration.test.ts`](<../../../40_Develop/coordinator/tests/integration/docker-recovery-journal.integration.test.ts>)
- [`40_Develop/coordinator/tests/integration/docker-recovery-lock-controller.integration.test.ts`](<../../../40_Develop/coordinator/tests/integration/docker-recovery-lock-controller.integration.test.ts>)
- [`40_Develop/coordinator/tests/integration/docker-recovery-runtime.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/docker-recovery-runtime.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/external-send-consent-docker-recovery.integration.test.ts`](<../../../40_Develop/coordinator/tests/integration/external-send-consent-docker-recovery.integration.test.ts>)
- [`40_Develop/coordinator/tests/integration/external-send-consent-revocation.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/external-send-consent-revocation.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/external-send-consent-runtime.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/external-send-consent-runtime.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/external-send-policy-runtime.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/external-send-policy-runtime.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/generate-release-key.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/generate-release-key.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/git-object-reader.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/git-object-reader.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/git-object-reader.integration.test.ts`](<../../../40_Develop/coordinator/tests/integration/git-object-reader.integration.test.ts>)
- [`40_Develop/coordinator/tests/integration/native-runtime-trace.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/native-runtime-trace.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/platform-access-coverage.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/platform-access-coverage.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/platform-access-release.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/platform-access-release.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/platform-access-ts-coverage.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/platform-access-ts-coverage.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/platform-provisioner-manifest-loader.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/platform-provisioner-manifest-loader.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/platform-provisioner-package-filesystem.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/platform-provisioner-package-filesystem.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/platform-provisioner-release-identity.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/platform-provisioner-release-identity.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/project-runtime-candidate-integration-adapter.integration.test.ts`](<../../../40_Develop/coordinator/tests/integration/project-runtime-candidate-integration-adapter.integration.test.ts>)
- [`40_Develop/coordinator/tests/integration/project-runtime-decision-recovery-store.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/project-runtime-decision-recovery-store.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/project-runtime-design-traceability.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/project-runtime-design-traceability.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/project-runtime-durable-foundation.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/project-runtime-durable-foundation.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/project-runtime-execution.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/project-runtime-execution.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/project-runtime-full-flow.integration.test.ts`](<../../../40_Develop/coordinator/tests/integration/project-runtime-full-flow.integration.test.ts>)
- [`40_Develop/coordinator/tests/integration/project-runtime-integration.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/project-runtime-integration.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/project-runtime-objective-intake.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/project-runtime-objective-intake.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/project-runtime-platform-independence.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/project-runtime-platform-independence.contract.test.ts>)
- `40_Develop/coordinator/tests/integration/project-runtime-public-runtime.integration.test.ts`（削除または旧Path）
- [`40_Develop/coordinator/tests/integration/project-runtime-queue-priority.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/project-runtime-queue-priority.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/project-runtime-replanning-and-decision.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/project-runtime-replanning-and-decision.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/project-runtime-single-task-adapter.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/project-runtime-single-task-adapter.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/project-runtime-windows-decision-store.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/project-runtime-windows-decision-store.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/provider-authority-coverage.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/provider-authority-coverage.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/release-manifest-promotion.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/release-manifest-promotion.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/repository-git-layout.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/repository-git-layout.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/repository-operation-runtime.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/repository-operation-runtime.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/repository-root-resolution.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/repository-root-resolution.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/repository-workspace-runtime.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/repository-workspace-runtime.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/runtime-process-safety-state.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/runtime-process-safety-state.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/runtime-traceability.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/runtime-traceability.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/sign-release-manifest.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/sign-release-manifest.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/task-cli-cancellation.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/task-cli-cancellation.contract.test.ts>)
- [`40_Develop/coordinator/tests/integration/test-execution-profile.contract.test.ts`](<../../../40_Develop/coordinator/tests/integration/test-execution-profile.contract.test.ts>)
- `40_Develop/coordinator/tests/interaction-boundary-regression.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/local-personal-authority-runtime.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/native-bootstrap-build.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/native-bootstrap-pe-fixture.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/native-bootstrap-pe-inspector.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/native-bootstrap-pe-runner.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/native-provision-supervisor-release.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/native-runtime-trace.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/node-runtime-version.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/offline-enrollment-bundle-pure-core.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/plain-data-snapshot.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/platform-access-adapter.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/platform-access-coverage.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/platform-access-release.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/platform-access-ts-coverage.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/platform-key-storage-policy.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/platform-provisioner-active-pointer-store.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/platform-provisioner-active-pointer.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/platform-provisioner-effect.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/platform-provisioner-install-layout.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/platform-provisioner-manifest-loader.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/platform-provisioner-package-filesystem.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/platform-provisioner-package-gate.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/platform-provisioner-policy-identity.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/platform-provisioner-pre-active-one-shot.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/platform-provisioner-release-identity.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/platform-provisioner-release-trust.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/platform-provisioner-trust-core.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/platform-provisioner-windows-dacl.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/provider-authority-coverage.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/provider-authority-runtime.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/provider-billing-policy.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/provider-eligibility-runtime.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/provider-home-coverage.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/provider-home-mount-grant-runtime.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/provider-home-mount-grant.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/provider-home-observation.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/provider-home.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/provider-isolation-profile.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/provider-lifecycle.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/provider-model-profile-runtime.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/provider-model-selection-runtime.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/provider-task-packet-runtime.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/provider-task-structured-result.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/provisioning-ca-pure-core.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/provisioning-record-enrollment-binding.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/provisioning-record-pure-core.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/provisioning-record-store.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/provisioning-signature-primitives.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/provisioning-trust-artifact-store.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/provisioning-trust-floor-store.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/provisioning-trust-floor.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/release-identity-grammar.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/repository-git-layout.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/repository-operation-runtime.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/repository-root-resolution.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/repository-workspace-runtime.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/root-observation.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/root-protection-policy.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/runtime-activation-locator-binding.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/runtime-activation-record.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/runtime-activation-transition.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/runtime-process-safety-state.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/runtime-root-path-identity.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/runtime-root-profile.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/runtime-trace-case.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/runtime-trace-case.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/runtime-traceability.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/secret-material-policy.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/sign-release-manifest.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/signed-general-task-verification.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/signed-recovery-matrix-verification.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/signed-route-matrix-verification.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/signed-runner-safety-observation.contract.test.ts`（削除または旧Path）
- [`40_Develop/coordinator/tests/support/helpers/docker-desktop-repair-history-publication-testing.ts`](<../../../40_Develop/coordinator/tests/support/helpers/docker-desktop-repair-history-publication-testing.ts>)
- [`40_Develop/coordinator/tests/support/runtime-trace-case.ts`](<../../../40_Develop/coordinator/tests/support/runtime-trace-case.ts>)
- [`40_Develop/coordinator/tests/support/test-support.ts`](<../../../40_Develop/coordinator/tests/support/test-support.ts>)
- [`40_Develop/coordinator/tests/system/coordinator-docker-recovery-cli.integration.test.ts`](<../../../40_Develop/coordinator/tests/system/coordinator-docker-recovery-cli.integration.test.ts>)
- [`40_Develop/coordinator/tests/system/coordinator-launch.contract.test.ts`](<../../../40_Develop/coordinator/tests/system/coordinator-launch.contract.test.ts>)
- [`40_Develop/coordinator/tests/system/dynamic-fake-provider-cancellation-verification.contract.test.ts`](<../../../40_Develop/coordinator/tests/system/dynamic-fake-provider-cancellation-verification.contract.test.ts>)
- [`40_Develop/coordinator/tests/system/dynamic-fake-provider-failure-verification.contract.test.ts`](<../../../40_Develop/coordinator/tests/system/dynamic-fake-provider-failure-verification.contract.test.ts>)
- [`40_Develop/coordinator/tests/system/interaction-boundary-regression.contract.test.ts`](<../../../40_Develop/coordinator/tests/system/interaction-boundary-regression.contract.test.ts>)
- `40_Develop/coordinator/tests/system/mcp-project-runtime-stdio.integration.test.ts`（削除または旧Path）
- [`40_Develop/coordinator/tests/system/project-runtime-real-provider-verification-script.contract.test.ts`](<../../../40_Develop/coordinator/tests/system/project-runtime-real-provider-verification-script.contract.test.ts>)
- [`40_Develop/coordinator/tests/system/signed-general-task-verification.contract.test.ts`](<../../../40_Develop/coordinator/tests/system/signed-general-task-verification.contract.test.ts>)
- [`40_Develop/coordinator/tests/system/signed-recovery-matrix-verification.contract.test.ts`](<../../../40_Develop/coordinator/tests/system/signed-recovery-matrix-verification.contract.test.ts>)
- [`40_Develop/coordinator/tests/system/signed-route-matrix-verification.contract.test.ts`](<../../../40_Develop/coordinator/tests/system/signed-route-matrix-verification.contract.test.ts>)
- [`40_Develop/coordinator/tests/system/terminal-interaction-probe.contract.test.ts`](<../../../40_Develop/coordinator/tests/system/terminal-interaction-probe.contract.test.ts>)
- [`40_Develop/coordinator/tests/system/verification-result-record.contract.test.ts`](<../../../40_Develop/coordinator/tests/system/verification-result-record.contract.test.ts>)
- `40_Develop/coordinator/tests/task-cli-cancellation.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/test-support.ts`（削除または旧Path）
- [`40_Develop/coordinator/tests/unit/authority-file-bundle.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/authority-file-bundle.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/authority-grant-verifier.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/authority-grant-verifier.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/authority-prelaunch-verifier.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/authority-prelaunch-verifier.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/authority-root-path-lexical.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/authority-root-path-lexical.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/authority-trust-loader.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/authority-trust-loader.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/candidate-store-windows-adapter.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/candidate-store-windows-adapter.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/claude-docker-runtime-adapter.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/claude-docker-runtime-adapter.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/claude-structured-result.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/claude-structured-result.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/codex-docker-runtime-adapter.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/codex-docker-runtime-adapter.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/codex-structured-result.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/codex-structured-result.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/command-report.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/command-report.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/coordinator-operation-creation-internal.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/coordinator-operation-creation-internal.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/delegation-route-selection.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/delegation-route-selection.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/delegation-selection-grant-runtime.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/delegation-selection-grant-runtime.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/development-measurement-constraints.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/development-measurement-constraints.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/development-measurement-session.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/development-measurement-session.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/development-provider-measurement.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/development-provider-measurement.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/docker-cleanup-eligibility.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/docker-cleanup-eligibility.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/docker-host-transition-state.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/docker-host-transition-state.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/docker-recovery-public-projection.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/docker-recovery-public-projection.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/docker-recovery-state-machine.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/docker-recovery-state-machine.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/docker-runtime-state-binding.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/docker-runtime-state-binding.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/doctor.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/doctor.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/dynamic-fake-provider-coverage.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/dynamic-fake-provider-coverage.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/egress-proxy-policy.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/egress-proxy-policy.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/external-send-grant-runtime.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/external-send-grant-runtime.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/host-generation-loss-transition.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/host-generation-loss-transition.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/local-personal-authority-runtime.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/local-personal-authority-runtime.contract.test.ts>)
- `40_Develop/coordinator/tests/unit/mcp-project-runtime-adapter.contract.test.ts`（削除または旧Path）
- [`40_Develop/coordinator/tests/unit/node-runtime-version.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/node-runtime-version.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/plain-data-snapshot.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/plain-data-snapshot.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/platform-access-adapter.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/platform-access-adapter.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/platform-key-storage-policy.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/platform-key-storage-policy.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/platform-provisioner-package-gate.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/platform-provisioner-package-gate.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/platform-provisioner-policy-identity.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/platform-provisioner-policy-identity.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/platform-provisioner-release-trust.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/platform-provisioner-release-trust.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/platform-provisioner-trust-core.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/platform-provisioner-trust-core.contract.test.ts>)
- `40_Develop/coordinator/tests/unit/project-runtime-platform-contract.contract.test.ts`（削除または旧Path）
- `40_Develop/coordinator/tests/unit/project-runtime-state.contract.test.ts`（削除または旧Path）
- [`40_Develop/coordinator/tests/unit/project-runtime-windows-platform-adapter.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/project-runtime-windows-platform-adapter.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/provider-authority-runtime.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/provider-authority-runtime.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/provider-billing-policy.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/provider-billing-policy.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/provider-eligibility-runtime.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/provider-eligibility-runtime.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/provider-home-coverage.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/provider-home-coverage.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/provider-home-mount-grant-runtime.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/provider-home-mount-grant-runtime.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/provider-home-mount-grant.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/provider-home-mount-grant.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/provider-home-observation.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/provider-home-observation.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/provider-home.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/provider-home.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/provider-isolation-profile.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/provider-isolation-profile.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/provider-lifecycle.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/provider-lifecycle.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/provider-model-profile-runtime.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/provider-model-profile-runtime.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/provider-model-selection-runtime.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/provider-model-selection-runtime.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/provider-task-packet-runtime.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/provider-task-packet-runtime.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/provider-task-structured-result.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/provider-task-structured-result.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/provisioning-signature-primitives.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/provisioning-signature-primitives.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/release-identity-grammar.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/release-identity-grammar.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/root-observation.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/root-observation.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/root-protection-policy.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/root-protection-policy.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/runtime-trace-case.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/runtime-trace-case.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/secret-material-policy.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/secret-material-policy.contract.test.ts>)
- [`40_Develop/coordinator/tests/unit/signed-runner-safety-observation.contract.test.ts`](<../../../40_Develop/coordinator/tests/unit/signed-runner-safety-observation.contract.test.ts>)
- [`40_Develop/coordinator/tsconfig.strict.json`](<../../../40_Develop/coordinator/tsconfig.strict.json>)
- [`40_Develop/coordinator/tsconfig.tests.json`](<../../../40_Develop/coordinator/tsconfig.tests.json>)
- [`40_Develop/platform-access/.gitignore`](<../../../40_Develop/platform-access/.gitignore>)
- [`40_Develop/platform-access/build.rs`](<../../../40_Develop/platform-access/build.rs>)
- [`40_Develop/platform-access/Cargo.lock`](<../../../40_Develop/platform-access/Cargo.lock>)
- [`40_Develop/platform-access/Cargo.toml`](<../../../40_Develop/platform-access/Cargo.toml>)
- [`40_Develop/platform-access/rust-toolchain.toml`](<../../../40_Develop/platform-access/rust-toolchain.toml>)
- `40_Develop/platform-access/src/bin/coordinator.rs`（削除または旧Path）
- [`40_Develop/platform-access/src/docker_repair.rs`](<../../../40_Develop/platform-access/src/docker_repair.rs>)
- [`40_Develop/platform-access/src/main.rs`](<../../../40_Develop/platform-access/src/main.rs>)
- `40_Develop/platform-access/src/native_bootstrap_core.rs`（削除または旧Path）
- [`40_Develop/platform-access/src/protocol.rs`](<../../../40_Develop/platform-access/src/protocol.rs>)
- [`40_Develop/platform-access/src/windows.rs`](<../../../40_Develop/platform-access/src/windows.rs>)
- [`40_Develop/platform-access/tests/cli.rs`](<../../../40_Develop/platform-access/tests/cli.rs>)
- `40_Develop/platform-access/tests/native_bootstrap_core.rs`（削除または旧Path）
- [`51_Document_Audit.md`](<../../../51_Document_Audit.md>)
- [`52_Conformance_Audit.md`](<../../../52_Conformance_Audit.md>)
- [`53_Gap_Impact_Audit.md`](<../../../53_Gap_Impact_Audit.md>)
- `90_Release/Changes/CHG-000001_Human_Decision_Presentation.md`（削除または旧Path）
- `90_Release/Changes/CHG-000002_GitHub_Anchor_Checker_Correction.md`（削除または旧Path）
- `90_Release/Changes/CHG-000004_Checker_Hierarchical_Compatibility.md`（削除または旧Path）
- `90_Release/Changes/CHG-000005_Gitlink_Submodule_Verification.md`（削除または旧Path）
- `90_Release/Changes/CHG-000007_Multi_Location_Remediation.md`（削除または旧Path）
- `90_Release/Changes/CHG-000010_First_Pass_Convergence.md`（削除または旧Path）
- `90_Release/Changes/CHG-000015_Coordinator_Runtime_1_0.md`（削除または旧Path）
- `90_Release/Changes/CHG-000016_Internal_TypeScript_Migration.md`（削除または旧Path）
- `90_Release/Changes/CHG-000017_Tools_Coding_Standards.md`（削除または旧Path）
- `90_Release/Changes/CHG-000054_Agent_Organization_Document_Architecture.md`（削除または旧Path）
- `90_Release/Changes/CHG-000055_CRDD_Long_Term_Evolution_Roadmap.md`（削除または旧Path）
- `90_Release/Changes/CHG-000057_Minimum_AI_Native_Project_Runtime.md`（削除または旧Path）
- `90_Release/Changes/CHG-000061_Test_Levels_and_Automated_Regression.md`（削除または旧Path）
- `90_Release/Changes/Evidence/CHG-000007_Adopter_Trial_Report.md`（削除または旧Path）
- `90_Release/Changes/README.md`（削除または旧Path）
- `99_Roadmap/01_Product_Roadmap.md`（削除または旧Path）
- [`99_Roadmap/Changes/CHG-000007/change.md`](<../../../99_Roadmap/Changes/CHG-000007/change.md>)
- [`AGENTS.md`](<../../../AGENTS.md>)
- [`biome.json`](<../../../biome.json>)
- [`CHANGELOG.md`](<../../../CHANGELOG.md>)
- [`CONTRIBUTING.md`](<../../../CONTRIBUTING.md>)
- [`README.md`](<../../../README.md>)
- [`template/01_Discovery/01_Product_Discovery.md`](<../../../template/01_Discovery/01_Product_Discovery.md>)
- [`template/02_UX/01_User_Experience.md`](<../../../template/02_UX/01_User_Experience.md>)
- [`template/03_IA/01_Information_Architecture.md`](<../../../template/03_IA/01_Information_Architecture.md>)
- [`template/04_UI/01_User_Interface.md`](<../../../template/04_UI/01_User_Interface.md>)
- [`template/05_SPEC/01_Behavior_Specification.md`](<../../../template/05_SPEC/01_Behavior_Specification.md>)
- [`template/06_Architecture/01_Architecture.md`](<../../../template/06_Architecture/01_Architecture.md>)
- [`template/07_Quality/01_Quality_Center.md`](<../../../template/07_Quality/01_Quality_Center.md>)
- [`template/07_Quality/02_Quality_Strategy.md`](<../../../template/07_Quality/02_Quality_Strategy.md>)
- [`template/07_Quality/03_Verification_Design.md`](<../../../template/07_Quality/03_Verification_Design.md>)
- [`template/AGENTS.md`](<../../../template/AGENTS.md>)
- `template/tools/crdd_check.mjs`（削除または旧Path）
- `template/tools/crdd_check.ts`（削除または旧Path）
- [`template/tools/crdd-check.ts`](<../../../template/tools/crdd-check.ts>)
- `tools/checker/.gitignore`（削除または旧Path）
- `tools/checker/crdd_check.test.ts`（削除または旧Path）
- `tools/checker/crdd_check.ts`（削除または旧Path）
- `tools/checker/crdd-check.contract.test.ts`（削除または旧Path）
- `tools/checker/crdd-check.ts`（削除または旧Path）
- `tools/checker/fault-injector.ts`（削除または旧Path）
- `tools/checker/package-lock.json`（削除または旧Path）
- `tools/checker/package.json`（削除または旧Path）
- `tools/checker/tools-naming.contract.test.ts`（削除または旧Path）
- `tools/checker/tsconfig.json`（削除または旧Path）
- `tools/coding-standards.md`（削除または旧Path）
- `tools/coordinator/architecture/README.md`（削除または旧Path）
- `tools/coordinator/bin/coordinator.ts`（削除または旧Path）
- `tools/coordinator/package.json`（削除または旧Path）
- `tools/coordinator/README.md`（削除または旧Path）
- `tools/coordinator/src/core/cli-options.ts`（削除または旧Path）
- `tools/coordinator/src/core/command-report.ts`（削除または旧Path）
- `tools/coordinator/src/core/doctor.ts`（削除または旧Path）
- `tools/coordinator/src/security/authority-grant-verifier.ts`（削除または旧Path）
- `tools/coordinator/src/security/authority-root-locator.ts`（削除または旧Path）
- `tools/coordinator/src/security/coordinator-runtime.ts`（削除または旧Path）
- `tools/coordinator/src/security/docker-isolation.ts`（削除または旧Path）
- `tools/coordinator/src/security/egress-proxy-policy.ts`（削除または旧Path）
- `tools/coordinator/src/security/execution-environment.ts`（削除または旧Path）
- `tools/coordinator/src/security/host-recovery-record.ts`（削除または旧Path）
- `tools/coordinator/src/security/initial-enrollment-pure-core.ts`（削除または旧Path）
- `tools/coordinator/src/security/initial-enrollment-runtime-state.ts`（削除または旧Path）
- `tools/coordinator/src/security/plain-data-snapshot.ts`（削除または旧Path）
- `tools/coordinator/src/security/platform-key-storage-policy.ts`（削除または旧Path）
- `tools/coordinator/src/security/provisioning-ca-pure-core.ts`（削除または旧Path）
- `tools/coordinator/src/security/provisioning-record-enrollment-binding.ts`（削除または旧Path）
- `tools/coordinator/src/security/provisioning-record-pure-core.ts`（削除または旧Path）
- `tools/coordinator/src/security/provisioning-signature-primitives.ts`（削除または旧Path）
- `tools/coordinator/src/security/repository-git-layout-internal.ts`（削除または旧Path）
- `tools/coordinator/src/security/repository-git-layout.ts`（削除または旧Path）
- `tools/coordinator/src/security/runtime-activation-locator-binding.ts`（削除または旧Path）
- `tools/coordinator/src/security/runtime-activation-transition.ts`（削除または旧Path）
- `tools/coordinator/src/security/runtime-root-path-identity.ts`（削除または旧Path）
- `tools/coordinator/tests/authority-file-bundle.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/authority-grant-verifier.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/authority-prelaunch-verifier.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/authority-root-locator.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/authority-root-profile.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/authority-trust-loader.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/cli-options.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/command-report.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/coordinator-runtime.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/doctor.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/dynamic-fake-provider-coverage.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/egress-proxy-policy.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/enrollment-certificate-renewal.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/git-local-exclude.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/initial-enrollment-pure-core.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/initial-enrollment-runtime-state.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/offline-enrollment-bundle-pure-core.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/plain-data-snapshot.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/platform-key-storage-policy.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/platform-provisioner-package-gate.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/platform-provisioner-trust-core.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/provider-authority-coverage.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/provider-isolation-profile.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/provisioning-ca-pure-core.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/provisioning-record-enrollment-binding.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/provisioning-record-pure-core.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/provisioning-signature-primitives.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/repository-git-layout.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/root-protection-policy.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/runtime-activation-locator-binding.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/runtime-activation-record.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/runtime-activation-transition.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/runtime-root-path-identity.contract.test.ts`（削除または旧Path）
- `tools/coordinator/tests/runtime-root-profile.contract.test.ts`（削除または旧Path）
- `tools/coordinator/THREAT_MODEL.md`（削除または旧Path）
- `tools/coordinator/threat-model.md`（削除または旧Path）
- `tools/coordinator/tsconfig.typecheck.json`（削除または旧Path）
- `tools/crdd_check_fault_injector.ts`（削除または旧Path）
- `tools/crdd_check.test.mjs`（削除または旧Path）
- `tools/crdd_check.test.ts`（削除または旧Path）
- `tools/crdd_check.ts`（削除または旧Path）
- `tools/tsconfig.checker.json`（削除または旧Path）

</details>
