# 変更トレース: 工程別の図面処置と意図引き渡し

変更ID: `CHG-000068`
状態: `In Progress`
担当責任者: Qual-Lab
対象版: `v0.21.0`
変更分類: `quality`
最終更新日: 2026-09-12

## 1. 結論と現在状態

CRDDの各工程で、本来必要な図が作成されないまま意図、境界、状態、分岐または未解決事項が後工程へ渡り、実装・試験・E2Eで初めて不足が露出することを防ぐ。

全工程へ同じ図種を強制せず、各工程が自身の判断に必要な基本図、発火条件、記法および出口条件を所有する。固定入口では各基本図を、現行図、参照、理由付き非該当または作成不能のいずれかへ必ず処置する。

Discoveryの業務プロセスViewを起点に、DiscoveryからVerificationまでの工程固有Profile、発火／非発火、プレーンテキスト記法、正本境界および出口接続を具体化した。各固定入口Templateへ基本図の処置一覧を追加し、CRDD自身の現行成果物へ必要図、既存参照、理由付き非該当または作成不能を適用した。Checkerは宣言したTemplate構造と各基本図行の退行を検出する。現在は独立文書監査と不足／影響監査を残す。

## 2. 保持する意図と目指さないこと

| 区分 | 内容 |
|---|---|
| 保持する意図 | 工程間で正しい意図、保持条件、未解決事項および下位義務を引き継ぐ |
| 保持する意図 | 図から設計漏れ、試験不足、未接続経路および意味の不一致を実装・E2E前に検出する |
| 保持する意図 | Markdown単体で人間とAIが同じ意味を読み、Git差分で変更を確認できる |
| 目指さないこと | 全工程へDiscoveryまたはArchitectureの記法を流用する |
| 目指さないこと | 図の枚数、線の本数または形式充足だけを工程合格にする |
| 目指さないこと | 図を第二の正本、独立Databaseまたは新しい安定Context ID台帳にする |
| 目指さないこと | 単純な対象へ架空の状態、Actor、処理、時間または試験を作る |

## 3. 変更する責務

```text
上位工程の意図・保持条件・未解決事項
                    |
                    v
          [工程入口: 図の処置判定]
                    |
                    v
       工程固有の図と正本情報を相互照合
                    |
          +---------+---------+
          |                   |
          v                   v
    設計要素へ接続       検証義務へ接続
          |                   |
          +---------+---------+
                    |
                    v
       [工程出口: 未処置・不一致 0]
                    |
                    v
     下位工程へ保持／変更／未解決を引渡し
```

| 対象 | 現在の弱点 | 目指す状態 |
|---|---|---|
| 工程正本 | 図の推奨はあっても必要性の判定と出口処置が工程ごとに不均一 | 基本図、発火／非発火、意味記法、正本境界、設計・検証接続を定義 |
| 固定入口Template | 文章や任意参照だけで図を省略できる | 基本図ごとの処置一覧と標準セクションを持つ |
| 工程移行 | 図の存在と意図の一致を分けて反証できない | 保持、承認済み変更、未解決、下位義務を対応づける |
| 品質保証 | 図で露出した分岐・境界・状態が検証項目へ届かないことがある | 設計要素、検証義務、検証項目または理由付き非該当へ接続する |
| Checker | 見出しやTemplate退行は検出できても必要図セクションの欠落を検出しない | 宣言した基本セクションと処置欄の構造的欠落を決定論的に検出する |

## 4. 工程別の基本図Profile

次は詳細記法の正本ではなく、各工程で具体化する責務範囲である。最終的な記法、発火条件および非該当条件は各工程正本が所有する。

| 工程 | 基本的に処置する図または関係表示 | 主に防ぐ不足 |
|---|---|---|
| Discovery | 課題・根拠・機会の関係、業務範囲／入出力、Actor別Process、Value Stream、As-Is／To-Be、項目間全体像 | 対象境界、根拠、Root Cause、Handoff、待機、変革意図の欠落 |
| UX | 利用前後を含むJourney、重要場面、Service Blueprint、失敗／回復体験 | 画面操作だけへの縮退、提供責務、裏側支援、回復体験の欠落 |
| IA | Object／Relation、情報階層、Navigation、可視性／状態概念 | Object重複、見つけられない情報、現在位置、関係・状態の混同 |
| UI／SPEC対応 | 操作・表示・System結果の対応、状態差および不一致 | UIだけの操作、SPECだけの状態、Feedback・Error・Recoveryの片側欠落 |
| UI | 論理画面／領域構成、画面・操作Flow、表示状態／Variant、主要Component関係 | 重要情報、代替操作、空・待機・失敗・権限差の表示漏れ |
| SPEC | Use Case／振る舞いFlow、状態遷移、Actor／System間Sequence、Error／Effect分岐 | 条件、例外、状態、Authority、Effect、結果の意味漏れ |
| Architecture | 全体／内部Block、状態遷移、Block間Sequence、Class／Type、DFD、ER図、Schema Responsibility Map | Owner、Boundary、Lifecycle、Data Flow、Entity Relation、Canonical Schema Owner、共通／固有責務、Consumer、Recoveryの未接続 |
| Implementation | Source／Package／Build BlockとArchitectureの対応、必要時の実装Sequence者向けLifecycle表示 | 実装所有者の漂流、設計にない経路、旧Capabilityの消失、試験対象漏れ |
| Verification | 検証義務と試験Level／Boundaryの対応、状態・分岐・Block別Coverage、結果から判断への接続 | 代表成功例への偏り、結合段階、利用側、失敗／回復、未評価範囲の欠落 |

## 5. 成果物の最小構造

各工程の固定入口は、少なくとも次を持つ。

1. 対象範囲、情報源改訂版および網羅状態。
2. 工程固有の基本図ごとの処置一覧。
3. 必要な図を置く標準セクション、または一意な参照。
4. 上位意図の保持、承認済み変更、未解決および下位義務の対応。
5. 図から導出した設計要素、検証義務または理由付き非該当。
6. 工程出口での現行性と未処置0の確認。

図を別ファイルへ分割するかは対象の規模と読みやすさで決める。ファイルを分けること自体を適用深度にせず、固定入口から現在の対象へ一意に到達できるようにする。

## 6. 検証と完了条件

| Gate | 完了条件 |
|---|---|
| 共通契約 | 文書化規則が意図引き渡し、図の処置、非該当、現行性および設計・検証接続を定義する |
| 工程正本 | DiscoveryからVerificationまで、各工程が基本図Profile、発火／非発火、記法および出口条件を持つ |
| Template | 各固定入口に処置一覧と基本図セクションがあり、空欄だけで工程を通過できない |
| 自己適用 | CRDD自身の現行工程成果物で、必要図または理由付き非該当と投影元を確認できる |
| 設計接続 | 図から判明した境界、状態、分岐、例外および未接続が設計要素へ反映される |
| 検証接続 | 同じ要素が検証義務、検証項目または理由付き非該当へ接続される |
| Checker | Templateと宣言構造の欠落を検出し、意味の妥当性を自動合格させない |
| 独立確認 | 文書監査と不足／影響監査が、重複正本、意図劣化および工程横断の未接続なしと確認する |

## 6.1. 実装・自己適用結果

| 対象 | 結果 | 残るGate |
|---|---|---|
| 工程正本 | UX、IA、UI／SPEC対応、UI、SPEC、Implementation、Verificationへ基本図Profileと凡例を追加。既存Discovery／Architectureの記法と責務を維持 | 独立確認 |
| Template | Discovery、UX、IA、UI、SPEC、Architecture、Verificationの固定入口で基本図を必ず処置する構造へ統一 | 独立確認 |
| CRDD自己適用 | 現行Discovery、UX、IA、UI、SPEC、Architecture、Verificationへ処置一覧を追加。未設計のWorkbench Componentは作成不能と再評価契機を明示 | Group BでWorkbenchをDiscoveryから再評価 |
| Implementation | `40_Develop`へ説明用Markdownを増やさず、Architecture BlockからSource／Package／Build／Test／Runtime入口へ接続する規則を追加 | 実装変更時の工程移行レビュー |
| Checker | Templateごとの必須図行を契約試験で確認し、旧Runtime Data Pathの検出対象を試験Consumerまで拡張 | 全体Checker、独立確認 |
| Runtime Data清掃 | 現在のworktreeで`.crdd/test-tmp`と`.crdd/test-fixtures`が存在せず、`.crdd/tmp/.operations`にOperation Recordが残っていないことを確認。試験Fixtureは`.crdd/tests/<execution-unit>/<run-id>`を使用し、自身の実行単位を終了時に清掃する | 旧Path非再生成回帰と現在状態の観測。過去の個別清掃手順は耐久Evidenceがないため完了根拠へ使用しない |

## 7. 変更禁止範囲

- 各工程の決定権限、専門品質または既存の状態語を変更しない。
- Architectureの既存図記法とBlock／状態／Sequence／Class／DFD／ER図／Schema Responsibility Map／結合試験の正本を別文書へ複製しない。
- 図を作れない状態を`Not Applicable`へ畳まず、根拠不足と対象不存在を区別する。
- Checkerの見出し検出を、図の内容、意図一致または工程合格の証明に使わない。
- 上位図を下位工程へコピーして更新元を分岐させない。
