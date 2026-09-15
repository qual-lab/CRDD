# UI-000004のArchitecture分析

成果物種別: Architecture分析（UI観点）
分析単位: `UI-000004`
状態: Canonical

## 1. 正式入力

- UI定義: [UI-000004 Project・節目・Portfolioの状況把握](../../../04_UI/Definitions/UI-000004/ui_definition.md)

このUI定義だけを正式入力とする。反対観点、上流工程、現行Architectureまたは実装から不足する意味を補わない。

## 2. Architectureへ引き継ぐUI契約

### 利用者成果

単一または複数Projectの現在地を根拠と不完全性付きで判断できる。

### 表示面と情報の優先順位

```text
Project・節目・Portfolioの状況把握
        ↓
プロジェクト（Project）／節目（Milestone）／目的（Objective）／作業（Task）／決定権限／受入条件／リポジトリ（Repository）／結合情報（Binding）／プロジェクト項目／読取り投影（Projection）／対象範囲（Coverage）
        ↓
現在状態・不足・制限
        ↓
Milestone→目的と受入条件→Task根拠→受入判断／プロジェクト→現在投影→不足・競合→情報源→次の判断／Portfolio→差→対象範囲（Coverage）→Project→情報源（Source）
```

| IA分析 | 独立して見分ける対象 | 利用者にとっての意味 | 識別・関係 |
|---|---|---|---|
| IA-000002 | プロジェクト（Project） | 継続する活動の境界 | プロジェクト識別子（Project ID） |
| IA-000002 | 節目（Milestone） | 人が委ね受入を判断する到達点 | Projectに属する安定ID |
| IA-000002 | 目的（Objective） | Milestoneを成立させる目的 | Milestoneに属する安定ID |
| IA-000002 | 作業（Task） | 実行可能な仕事単位 | Objectiveと作業識別子（Task Identity） |
| IA-000002 | 決定権限 | 誰が何を決められるか | 対象・主体・時点へ結合 |
| IA-000002 | 受入条件 | 上位成果を受け入れる条件 | Milestone／Objectiveへ結合 |
| IA-000006 | プロジェクト（Project） | 論理的な案件・活動 | プロジェクト識別子（Project ID） |
| IA-000006 | リポジトリ（Repository） | Projectの一部を所有する正本境界 | リポジトリ識別子（Repository ID） |
| IA-000006 | 結合情報（Binding） | Repositoryと検証済みRootの結合 | 結合識別子（Binding ID） |
| IA-000006 | プロジェクト項目 | リポジトリが正本として所有する文書その他の項目 | リポジトリと項目固有の識別情報で結ぶ |
| IA-000006 | 読取り投影（Projection） | 正本から導出した読取りView | 情報源（Source）＋改訂版（Revision）＋観測時点（Observed At） |
| IA-000006 | 対象範囲（Coverage） | 投影が扱えた範囲 | 情報源（Source）集合と状態 |

同じ画面や応答へ置く場合も、上表の独立軸を一つの成功・信頼・完了へ畳まない。重要な不足、制限、判断要否は詳細へ隠さない。

### 操作とFeedback

主要な操作・判断: Projectを選ぶ／根拠を見る／比較する。

| UX分析 | 利用者が行う判断・行動 | 重要な場面 | 必要なFeedback | 避ける失敗 |
|---|---|---|---|---|
| UX-000005 | 目的と受入条件で節目を委ねる | タスク成功と節目完成を区別する | 統合・品質・判断待ちを分けて示す | タスク件数を完成と誤認する |
| UX-000009 | プロジェクトの現在地を根拠と不完全性付きで理解する | 現在の表示を信じる直前 | 根拠、不完全性、観測時点を同時に示す | 欠測や古い値を完全な現在値と誤認する |
| UX-000015 | 複数プロジェクトを根拠付きで比較する | 要約から優先判断へ進む直前 | 比較値から根拠・古さ・不足へ戻れる | 単一Scoreや欠測した集計で健全性を断定する |

UI部品や通信方式はここで固定しない。各UX行のFeedbackを、IAの状態・導線と対応付けて表示する。

### 状態と表示差

| UX／IAの対応 | 区別する状態 | 状態から進む導線 |
|---|---|---|
| UX-000005／IA-000002 | Task完了／Objective受入／Milestone受入を別にする | Milestone→目的と受入条件→Task根拠→受入判断 |
| UX-000009／IA-000006 | complete／partial／開示制限（restricted）／stale／競合あり（conflicting）／不明（unknown） | プロジェクト→現在投影→不足・競合→情報源→次の判断 |
| UX-000015／IA-000006 | complete／partial／開示制限（restricted）／stale／競合あり（conflicting） | Portfolio→差→対象範囲（Coverage）→Project→情報源（Source） |

上表にない処理中、取消、回復その他の状態を一律に追加しない。値なし、未観測、古い値、競合、開示制限または結果不明は、該当するIA定義が要求する場合にだけ別状態として示す。

### 視覚表現とアクセシビリティ

- 「プロジェクト（Project）、節目（Milestone）、目的（Objective）、作業（Task）、決定権限、受入条件、リポジトリ（Repository）、結合情報（Binding）、プロジェクト項目、読取り投影（Projection）、対象範囲（Coverage）」を、色だけでなく表示名、状態語、順序でも見分けられるようにする。
- 結論、重大な不足、主要操作、根拠、詳細の順を視覚順と読上げ順で一致させる。
- CLI、MCP、Workbenchで同じ意味の状態と次の導線を対応付ける。
- キーボード操作と文字表示だけでも、上表の判断・根拠・戻り先へ到達できるようにする。

### 制約

- UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。
- 表示の都合でUX成果、IAの独立軸、状態、根拠、対象範囲または開示境界を弱めない。
- 視覚詳細はPrototypeで評価し、未評価の候補を完成表示しない。

## 3. Architecture観点の分析

| 責務候補 | 状態Owner | 決定権限 | Effect／非該当 | 主な失敗境界 |
|---|---|---|---|---|
| [Project・Portfolio状態投影のArchitecture定義](../../Definitions/project-state-projection/architecture_definition.md) | Project Management Projection | UI契約はAuthorityを発行しない。利用者操作: Projectを選ぶ／根拠を見る／比較する | UI契約はEffectを定義しない。表示上の状態差: Task完了／Objective受入／Milestone受入を別にする。導線: Milestone→目的と受入条件→Task根拠→受入判断 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 |

## 4. Architecture処置

| Architecture定義候補 | 処置 | 判断理由 |
|---|---|---|
| [Project・Portfolio状態投影](../../Definitions/project-state-projection/architecture_definition.md) | New | Task完了、Objective受入、Milestone受入を分け、complete／partial／restricted／stale／conflicting／unknownを項目ごとに保つ。Portfolio比較でも不足を一つの健康度へ隠さない。 |

## 5. SPEC観点との統合時に確認すること

- 対応候補: SPEC-000006、SPEC-000007
- この分析にある状態、操作、Feedback、Authority、Effectの適用／非適用、失敗を、対応SPECの契機と結果へ一つずつ照合する。
- 差分がある場合はArchitectureで推測せず、UI／SPEC対応レビューへ戻す。
