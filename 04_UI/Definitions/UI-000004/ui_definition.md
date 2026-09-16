# UI-000004 Project・節目・Portfolioの状況把握

成果物種別: UI定義
UI ID: `UI-000004`
状態: Canonical
維持責任者: Qual-Lab

## 利用者成果

単一または複数Projectの現在地を根拠と不完全性付きで判断できる。

## UX観点の入力

| UX分析 | このUIで保持する利用者成果 |
|---|---|
| [UX-000005](../../Analysis/UX-000005/ui_analysis.md) | 内部タスクを逐次操作せず、目的・受入条件・統合状態から節目の完成と必要な判断を理解できる |
| [UX-000009](../../Analysis/UX-000009/ui_analysis.md) | 物理構成を意識せずプロジェクトの現在地を理解し、欠測・制限・競合・古さと情報源へ戻れる |
| [UX-000015](../../Analysis/UX-000015/ui_analysis.md) | 許可されたプロジェクトの重要差を比較し、網羅範囲と根拠を保ったまま必要なプロジェクトだけを掘り下げられる |

## IA観点の入力

| IA分析 | このUIで保持する情報構造 |
|---|---|
| [IA-000002](../../Analysis/IA-000002/ui_analysis.md) | 内部Taskを逐次操作せず、何をどこまで誰へ任せ、何をもって受け入れるか理解する。 |
| [IA-000006](../../Analysis/IA-000006/ui_analysis.md) | 論理Projectを一つに見ながら、情報源、物理Root、不完全性を取り違えず現在地を判断する。 |

## 両観点の統合判断

| UX分析 | 利用者が得たい結果 | 対応するIA分析 | UIで成立させる対応 |
|---|---|---|---|
| [UX-000005](../../Analysis/UX-000005/ui_analysis.md) | 内部タスクを追わず統合済みの完成を判断できる | [IA-000002](../../Analysis/IA-000002/ui_analysis.md) | プロジェクト（Project）、節目（Milestone）、目的（Objective）、作業（Task）、受入条件、統合状態、品質を見分ける。状態は「Task完了／Objective受入／Milestone受入を別にする」。導線は「Milestone→目的と受入条件→Task根拠→受入判断」 |
| [UX-000009](../../Analysis/UX-000009/ui_analysis.md) | 物理構成を意識せずプロジェクトの現在地を理解し、欠測・制限・競合・古さと情報源へ戻れる | [IA-000006](../../Analysis/IA-000006/ui_analysis.md) | プロジェクト（Project）、プロジェクト項目、読取り投影（Projection）、情報源（Source）、改訂版（Revision）、観測時点（Observed At）、対象範囲（Coverage）、競合を見分ける。状態は「complete／partial／開示制限（restricted）／stale／競合あり（conflicting）／不明（unknown）」。導線は「プロジェクト→現在投影→不足・競合→情報源→次の判断」 |
| [UX-000015](../../Analysis/UX-000015/ui_analysis.md) | 重要差分から必要なプロジェクトだけを掘り下げられる | [IA-000006](../../Analysis/IA-000006/ui_analysis.md) | プロジェクト概要（Project Summary）、比較軸、対象範囲（Coverage）、観測時点（Observed At）、公開関係（Exposure）、情報源（Source）を見分ける。状態は「complete／partial／開示制限（restricted）／stale／競合あり（conflicting）」。導線は「Portfolio→差→対象範囲（Coverage）→Project→情報源（Source）」 |

UIはUX側の目的だけでも、IA側の対象一覧だけでも成立しない。各行の利用者成果を、対応する情報・状態・関係・導線で判断可能にした時だけ、このUIの意味が成立する。

## 表示面と情報の優先順位

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

## 操作とFeedback

主要な操作・判断: Projectを選ぶ／根拠を見る／比較する。

| UX分析 | 利用者が行う判断・行動 | 重要な場面 | 必要なFeedback | 避ける失敗 |
|---|---|---|---|---|
| UX-000005 | 目的と受入条件で節目を委ねる | タスク成功と節目完成を区別する | 統合・品質・判断待ちを分けて示す | タスク件数を完成と誤認する |
| UX-000009 | プロジェクトの現在地を根拠と不完全性付きで理解する | 現在の表示を信じる直前 | 根拠、不完全性、観測時点を同時に示す | 欠測や古い値を完全な現在値と誤認する |
| UX-000015 | 複数プロジェクトを根拠付きで比較する | 要約から優先判断へ進む直前 | 比較値から根拠・古さ・不足へ戻れる | 単一Scoreや欠測した集計で健全性を断定する |

UI部品や通信方式はここで固定しない。各UX行のFeedbackを、IAの状態・導線と対応付けて表示する。

## 状態と表示差

| UX／IAの対応 | 区別する状態 | 状態から進む導線 |
|---|---|---|
| UX-000005／IA-000002 | Task完了／Objective受入／Milestone受入を別にする | Milestone→目的と受入条件→Task根拠→受入判断 |
| UX-000009／IA-000006 | complete／partial／開示制限（restricted）／stale／競合あり（conflicting）／不明（unknown） | プロジェクト→現在投影→不足・競合→情報源→次の判断 |
| UX-000015／IA-000006 | complete／partial／開示制限（restricted）／stale／競合あり（conflicting） | Portfolio→差→対象範囲（Coverage）→Project→情報源（Source） |

上表にない処理中、取消、回復その他の状態を一律に追加しない。値なし、未観測、古い値、競合、開示制限または結果不明は、該当するIA定義が要求する場合にだけ別状態として示す。

## 視覚表現とアクセシビリティ

- 「プロジェクト（Project）、節目（Milestone）、目的（Objective）、作業（Task）、決定権限、受入条件、リポジトリ（Repository）、結合情報（Binding）、プロジェクト項目、読取り投影（Projection）、対象範囲（Coverage）」を、色だけでなく表示名、状態語、順序でも見分けられるようにする。
- 結論、重大な不足、主要操作、根拠、詳細の順を視覚順と読上げ順で一致させる。
- CLI、MCP、Workbenchで同じ意味の状態と次の導線を対応付ける。
- キーボード操作と文字表示だけでも、上表の判断・根拠・戻り先へ到達できるようにする。

## 制約

- UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。
- 表示の都合でUX成果、IAの独立軸、状態、根拠、対象範囲または開示境界を弱めない。
- 視覚詳細はPrototypeで評価し、未評価の候補を完成表示しない。

## UI／SPEC対応レビューへ渡す項目

両観点の統合内容は前節の正本を参照し、ここへ全文を再掲しない。次表は、SPECが同じUX／IAを別々に分析した後で確定すべき未決事項だけを渡す。

| UX | IA | UIで観測可能にすべき操作・Feedback | SPEC側で未確定の振る舞い |
|---|---|---|---|
| UX-000005 | IA-000002 | 目的と受入条件で節目を委ねる。統合・品質・判断待ちを分けて示す | IA-000002 が示す状態・関係を入力条件、成功・停止条件へ接続し、「タスク件数を完成と誤認する」を防ぐ観測可能な結果を確定する |
| UX-000009 | IA-000006 | プロジェクトの現在地を根拠と不完全性付きで理解する。根拠、不完全性、観測時点を同時に示す | IA-000006 が示す状態・関係を入力条件、成功・停止条件へ接続し、「欠測や古い値を完全な現在値と誤認する」を防ぐ観測可能な結果を確定する |
| UX-000015 | IA-000006 | 複数プロジェクトを根拠付きで比較する。比較値から根拠・古さ・不足へ戻れる | IA-000006 が示す状態・関係を入力条件、成功・停止条件へ接続し、「単一Scoreや欠測した集計で健全性を断定する」を防ぐ観測可能な結果を確定する |

SPECはこの表の結論を転記せず、UX観点とIA観点を別々に分析する。UIの操作に対応する発火条件・結果がない、またはSPECの結果を利用者が認識できない場合は対応レビューを通過しない。

## 対応するSPEC

- pairs_with: [SPEC-000006](../../../05_SPEC/Definitions/SPEC-000006/spec_definition.md)、[SPEC-000007](../../../05_SPEC/Definitions/SPEC-000007/spec_definition.md)

UIは認識・操作・Feedbackを所有し、SPECの条件・状態・結果をこの節で再定義しない。

## 未確認事項・人間判断・戻り条件

| 項目 | 現在の判断 | 不足時に戻す工程 |
|---|---|---|
| 未確認事項 | なし | UI／SPECまたはOwner工程 |
| 人間判断 | 現在のCanonical範囲では追加判断なし | 判断を所有する工程 |
| 戻り条件 | 正式入力、対応関係または成立条件に不足・競合が見つかった場合 | 不足を所有するUX／IA／UI／SPEC |

## 検証意図

正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。

## 補足定義

なし。

## 情報源

- [UX-000005のUI分析](../../Analysis/UX-000005/ui_analysis.md)
- [UX-000009のUI分析](../../Analysis/UX-000009/ui_analysis.md)
- [UX-000015のUI分析](../../Analysis/UX-000015/ui_analysis.md)
- [IA-000002のUI分析](../../Analysis/IA-000002/ui_analysis.md)
- [IA-000006のUI分析](../../Analysis/IA-000006/ui_analysis.md)

## Checklist

- [x] UX DefinitionとIA Definitionの分析を正式入力として処置した
- [x] UX OutcomeとIA Information Contractを保持した
- [x] Surface ResponsibilityとInformation Priorityを定義した
- [x] Presentation、Interaction、Visible StateおよびFeedbackを定義した
- [x] Error・Recovery Presentationを評価した
- [x] AccessibilityとVariantの必要性を評価した
- [x] Failure・Risk、ConstraintおよびNon-goalを評価した
- [x] Human Inputの必要性を評価した
- [x] Open・GapとOwner工程へ戻す条件を明示した
- [x] Verification Intentを明示した
- [x] 対応するSPECとのRelationを明示した
- [x] Behavior Rule、Architecture方式またはSource実装を先取りしていない
- [x] Visual ArtifactだけでContractを代替していない
- [x] 補足定義へ必須情報を退避していない
