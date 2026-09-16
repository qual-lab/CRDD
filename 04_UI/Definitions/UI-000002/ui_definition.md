# UI-000002 委任・実行状態・判断

成果物種別: UI定義
UI ID: `UI-000002`
状態: Canonical
維持責任者: Qual-Lab

## 利用者成果

任せた範囲と進行状態を理解し、必要な時だけ判断する。

## UX観点の入力

| UX分析 | このUIで保持する利用者成果 |
|---|---|
| [UX-000002](../../Analysis/UX-000002/ui_analysis.md) | 実行前に誰へ何をどこまで任せるかを理解し、暗黙の範囲拡張なく仕事を委ねられる |
| [UX-000003](../../Analysis/UX-000003/ui_analysis.md) | 内部ログを読まず、実行中・待機・停止と現在必要な判断を理解できる |

## IA観点の入力

| IA分析 | このUIで保持する情報構造 |
|---|---|
| [IA-000002](../../Analysis/IA-000002/ui_analysis.md) | 内部Taskを逐次操作せず、何をどこまで誰へ任せ、何をもって受け入れるか理解する。 |
| [IA-000003](../../Analysis/IA-000003/ui_analysis.md) | 失敗後に再接続、再試行、回復、清掃を取り違えず、二重作用を避ける。 |

## 両観点の統合判断

| UX分析 | 利用者が得たい結果 | 対応するIA分析 | UIで成立させる対応 |
|---|---|---|---|
| [UX-000002](../../Analysis/UX-000002/ui_analysis.md) | 実行前に誰へ何をどこまで任せるかを理解し、暗黙の範囲拡張なく仕事を委ねられる | [IA-000002](../../Analysis/IA-000002/ui_analysis.md) | 目的、対象範囲、担い手、決定権限、入力、候補、取消、回復を見分ける。状態は「準備中／許可待ち／実行中／停止。権限発行前後を分ける」。導線は「目的→範囲と担い手→許可→実行」 |
| [UX-000003](../../Analysis/UX-000003/ui_analysis.md) | 内部ログを読まず、実行中・待機・停止と現在必要な判断を理解できる | [IA-000002](../../Analysis/IA-000002/ui_analysis.md) | 作業（Task）、実行主体、現在状態、判断、入力、次の行動を見分ける。状態は「開始可能（ready）／実行中（running）／入力・判断待ち（waiting）／停止（blocked）／完了（completed）／失敗（failed）」。導線は「Task→現在状態→判断要否→待機・入力・取消・回復」 |
| [UX-000003](../../Analysis/UX-000003/ui_analysis.md) | 内部ログを読まず、実行中・待機・停止と現在必要な判断を理解できる | [IA-000003](../../Analysis/IA-000003/ui_analysis.md) | 作業（Task）、実行主体、現在状態、判断、入力、次の行動を見分ける。状態は「開始可能（ready）／実行中（running）／入力・判断待ち（waiting）／停止（blocked）／完了（completed）／失敗（failed）」。導線は「Task→現在状態→判断要否→待機・入力・取消・回復」 |

UIはUX側の目的だけでも、IA側の対象一覧だけでも成立しない。各行の利用者成果を、対応する情報・状態・関係・導線で判断可能にした時だけ、このUIの意味が成立する。

## 表示面と情報の優先順位

```text
委任・実行状態・判断
        ↓
プロジェクト（Project）／節目（Milestone）／目的（Objective）／作業（Task）／決定権限／受入条件／依頼（Request）／試行（Attempt）／外部作用（Effect）／結果（Result）／回復義務（Recovery Obligation）／回復処置（Recovery Action）／終了確認（Settlement Observation）／次の行動（Next Action）
        ↓
現在状態・不足・制限
        ↓
目的→範囲と担い手→許可→実行／Task→現在状態→判断要否→待機・入力・取消・回復
```

| IA分析 | 独立して見分ける対象 | 利用者にとっての意味 | 識別・関係 |
|---|---|---|---|
| IA-000002 | プロジェクト（Project） | 継続する活動の境界 | プロジェクト識別子（Project ID） |
| IA-000002 | 節目（Milestone） | 人が委ね受入を判断する到達点 | Projectに属する安定ID |
| IA-000002 | 目的（Objective） | Milestoneを成立させる目的 | Milestoneに属する安定ID |
| IA-000002 | 作業（Task） | 実行可能な仕事単位 | Objectiveと作業識別子（Task Identity） |
| IA-000002 | 決定権限 | 誰が何を決められるか | 対象・主体・時点へ結合 |
| IA-000002 | 受入条件 | 上位成果を受け入れる条件 | Milestone／Objectiveへ結合 |
| IA-000003 | 依頼（Request） | 利用者の同一依頼 | 依頼識別子（Request Identity） |
| IA-000003 | 試行（Attempt） | 依頼を実行した個別試行 | 依頼（Request）に属する試行識別子（Attempt ID） |
| IA-000003 | 外部作用（Effect） | 外部へ生じ得る変更 | 試行（Attempt）と作用識別子（Effect Identity） |
| IA-000003 | 結果（Result） | 試行または依頼の結果 | 依頼（Request）／試行（Attempt）へ結合 |
| IA-000003 | 回復義務（Recovery Obligation） | 残存を処置し、終了後を確認するまで残る義務 | 同一の回復対象識別子（Recovery Identity） |
| IA-000003 | 回復処置（Recovery Action） | 回復義務を解消するために実行する行動 | 回復義務と処置の試行へ結合 |
| IA-000003 | 終了確認（Settlement Observation） | 回復後に残存や作用が解消したことの確認 | 回復義務と観測時点へ結合 |
| IA-000003 | 次の行動（Next Action） | 現在許される行動 | 状態と権限（Authority）から導く |

同じ画面や応答へ置く場合も、上表の独立軸を一つの成功・信頼・完了へ畳まない。重要な不足、制限、判断要否は詳細へ隠さない。

## 操作とFeedback

主要な操作・判断: 委任する／取消す／判断を返す。

| UX分析 | 利用者が行う判断・行動 | 重要な場面 | 必要なFeedback | 避ける失敗 |
|---|---|---|---|---|
| UX-000002 | 複数AIへ任せる範囲と権限を理解する | 外部作用（Effect）の前の委任境界 | 委任状態・停止理由・回復先を行動可能に示す | 暗黙の範囲拡張や回復不能 |
| UX-000003 | 現在の実行状態と必要な判断を確認する | 応答がなく待機か停止かを判断する場面 | 観測時点・停止理由・必要な判断を行動可能に示す | 古い観測や一律表示を進捗・完了と誤認する |

UI部品や通信方式はここで固定しない。各UX行のFeedbackを、IAの状態・導線と対応付けて表示する。

## 状態と表示差

| UX／IAの対応 | 区別する状態 | 状態から進む導線 |
|---|---|---|
| UX-000002／IA-000002 | 準備中／許可待ち／実行中／停止。権限発行前後を分ける | 目的→範囲と担い手→許可→実行 |
| UX-000003／IA-000002 | 開始可能（ready）／実行中（running）／入力・判断待ち（waiting）／停止（blocked）／完了（completed）／失敗（failed） | Task→現在状態→判断要否→待機・入力・取消・回復 |
| UX-000003／IA-000003 | 開始可能（ready）／実行中（running）／入力・判断待ち（waiting）／停止（blocked）／完了（completed）／失敗（failed） | Task→現在状態→判断要否→待機・入力・取消・回復 |

上表にない処理中、取消、回復その他の状態を一律に追加しない。値なし、未観測、古い値、競合、開示制限または結果不明は、該当するIA定義が要求する場合にだけ別状態として示す。

## 視覚表現とアクセシビリティ

- 「プロジェクト（Project）、節目（Milestone）、目的（Objective）、作業（Task）、決定権限、受入条件、依頼（Request）、試行（Attempt）、外部作用（Effect）、結果（Result）、回復義務（Recovery Obligation）、回復処置（Recovery Action）、終了確認（Settlement Observation）、次の行動（Next Action）」を、色だけでなく表示名、状態語、順序でも見分けられるようにする。
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
| UX-000002 | IA-000002 | 複数AIへ任せる範囲と権限を理解する。委任状態・停止理由・回復先を行動可能に示す | IA-000002 が示す状態・関係を入力条件、成功・停止条件へ接続し、「暗黙の範囲拡張や回復不能」を防ぐ観測可能な結果を確定する |
| UX-000003 | IA-000002 | 現在の実行状態と必要な判断を確認する。観測時点・停止理由・必要な判断を行動可能に示す | IA-000002 が示す状態・関係を入力条件、成功・停止条件へ接続し、「古い観測や一律表示を進捗・完了と誤認する」を防ぐ観測可能な結果を確定する |
| UX-000003 | IA-000003 | 現在の実行状態と必要な判断を確認する。観測時点・停止理由・必要な判断を行動可能に示す | IA-000003 が示す状態・関係を入力条件、成功・停止条件へ接続し、「古い観測や一律表示を進捗・完了と誤認する」を防ぐ観測可能な結果を確定する |

SPECはこの表の結論を転記せず、UX観点とIA観点を別々に分析する。UIの操作に対応する発火条件・結果がない、またはSPECの結果を利用者が認識できない場合は対応レビューを通過しない。

## 対応するSPEC

- pairs_with: [SPEC-000002](../../../05_SPEC/Definitions/SPEC-000002/spec_definition.md)、[SPEC-000003](../../../05_SPEC/Definitions/SPEC-000003/spec_definition.md)、[SPEC-000028](../../../05_SPEC/Definitions/SPEC-000028/spec_definition.md)、[SPEC-000029](../../../05_SPEC/Definitions/SPEC-000029/spec_definition.md)

| UI操作 | 対応する振る舞い契約 |
|---|---|
| 委任する | SPEC-000002 |
| 状態と判断要否を見る | SPEC-000003 |
| 取消す | SPEC-000028 |
| 判断または追加入力を返す | SPEC-000029 |

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

- [UX-000002のUI分析](../../Analysis/UX-000002/ui_analysis.md)
- [UX-000003のUI分析](../../Analysis/UX-000003/ui_analysis.md)
- [IA-000002のUI分析](../../Analysis/IA-000002/ui_analysis.md)
- [IA-000003のUI分析](../../Analysis/IA-000003/ui_analysis.md)

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
