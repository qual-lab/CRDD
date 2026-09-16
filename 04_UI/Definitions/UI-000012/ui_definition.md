# UI-000012 Agent間の情報引継ぎと再接続

成果物種別: UI定義
UI ID: `UI-000012`
状態: Canonical
維持責任者: Qual-Lab

## 利用者成果

必要な情報を限定して渡し、切断後も同じ仕事へ戻れる。

## UX観点の入力

| UX分析 | このUIで保持する利用者成果 |
|---|---|
| [UX-000019](../../Analysis/UX-000019/ui_analysis.md) | 必要最小限の情報を出所・現行性・許可付きで渡し、相関・完全性付きの結果を同じタスクへ戻せる |
| [UX-000021](../../Analysis/UX-000021/ui_analysis.md) | 応答喪失後に新規実行せず、現在の利用権限で同じ依頼の状態・結果・回復義務へ戻れる |

## IA観点の入力

| IA分析 | このUIで保持する情報構造 |
|---|---|
| [IA-000014](../../Analysis/IA-000014/ui_analysis.md) | 必要最小の情報を出所付きで渡し、同じ仕事へ結果と未決事項を戻す。 |
| [IA-000003](../../Analysis/IA-000003/ui_analysis.md) | 失敗後に再接続、再試行、回復、清掃を取り違えず、二重作用を避ける。 |

## 両観点の統合判断

| UX分析 | 利用者が得たい結果 | 対応するIA分析 | UIで成立させる対応 |
|---|---|---|---|
| [UX-000019](../../Analysis/UX-000019/ui_analysis.md) | 必要最小限の情報を出所・現行性・許可付きで渡し、相関・完全性付きの結果を同じタスクへ戻せる | [IA-000014](../../Analysis/IA-000014/ui_analysis.md) | 仕事用情報一式（Context Package）、情報源（Source）、改訂版（Revision）、選択理由（Selection Reason）、作業（Task）、引き渡し（Handoff）、結果（Result）、判断（Decision）を見分ける。状態は「準備済み（prepared）／送信済み（sent）／受領済み（received）／返却済み（returned）／停止（blocked）」。導線は「情報源→選択→仕事用情報一式（Context Package）→Task→結果（Result）→元の仕事」 |
| [UX-000021](../../Analysis/UX-000021/ui_analysis.md) | 応答喪失後に新規実行せず、現在の利用権限で同じ依頼の状態・結果・回復義務へ戻れる | [IA-000014](../../Analysis/IA-000014/ui_analysis.md) | 依頼識別子（Request Identity）、試行（Attempt）、接続中の作業単位（Session）、現在有効な利用許可（Current Grant）、結果（Result）、回復義務（Recovery Obligation）を見分ける。状態は「進行中（active）／切断（disconnected）／結果取得可能（result_available）／回復必要（recovery_required）／確定済み（settled）」。導線は「再接続→同じ依頼（Request）→現在権限→状態・結果→回復義務」 |
| [UX-000021](../../Analysis/UX-000021/ui_analysis.md) | 応答喪失後に新規実行せず、現在の利用権限で同じ依頼の状態・結果・回復義務へ戻れる | [IA-000003](../../Analysis/IA-000003/ui_analysis.md) | 依頼識別子（Request Identity）、試行（Attempt）、接続中の作業単位（Session）、現在有効な利用許可（Current Grant）、結果（Result）、回復義務（Recovery Obligation）を見分ける。状態は「進行中（active）／切断（disconnected）／結果取得可能（result_available）／回復必要（recovery_required）／確定済み（settled）」。導線は「再接続→同じ依頼（Request）→現在権限→状態・結果→回復義務」 |

UIはUX側の目的だけでも、IA側の対象一覧だけでも成立しない。各行の利用者成果を、対応する情報・状態・関係・導線で判断可能にした時だけ、このUIの意味が成立する。

## 表示面と情報の優先順位

```text
Agent間の情報引継ぎと再接続
        ↓
仕事用情報一式（Context Package）／情報源参照（Source Reference）／選択理由（Selection Reason）／作業（Task）／引き渡し（Handoff）／結果（Result）／判断（Decision）／依頼（Request）／試行（Attempt）／外部作用（Effect）／回復義務（Recovery Obligation）／回復処置（Recovery Action）／終了確認（Settlement Observation）／次の行動（Next Action）
        ↓
現在状態・不足・制限
        ↓
情報源→選択→仕事用情報一式（Context Package）→Task→結果（Result）→元の仕事／再接続→同じ依頼（Request）→現在権限→状態・結果→回復義務
```

| IA分析 | 独立して見分ける対象 | 利用者にとっての意味 | 識別・関係 |
|---|---|---|---|
| IA-000014 | 仕事用情報一式（Context Package） | 選択した仕事用情報一式 | 情報一式の識別子（Package ID） |
| IA-000014 | 情報源参照（Source Reference） | 出所と改訂版（Revision） | 情報源の識別子（Source Identity）＋改訂版（Revision） |
| IA-000014 | 選択理由（Selection Reason） | 含めた理由 | Package Itemへ結合 |
| IA-000014 | 作業（Task） | 受け渡し先の仕事 | 作業識別子（Task Identity） |
| IA-000014 | 引き渡し（Handoff） | 役割間の移送 | 情報源（Source）／Target Role |
| IA-000014 | 結果（Result） | Taskから戻る成果と状態 | Taskへ結合 |
| IA-000014 | 判断（Decision） | 結果とともに元の仕事へ戻す判断・未解決事項 | 責任者（Owner）と決定権限（Decision Authority）へ結ぶ |
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

主要な操作・判断: 引き継ぐ／再接続する／結果を戻す。

| UX分析 | 利用者が行う判断・行動 | 重要な場面 | 必要なFeedback | 避ける失敗 |
|---|---|---|---|---|
| UX-000019 | 必要な情報だけを出所付きで渡す | 外部境界へ情報を出す直前 | 情報源・改訂版・選択理由を保持する | 全量投入・秘密情報混入・古い仮説の現在値化 |
| UX-000021 | 切断後に同じ依頼へ戻る | 再実行するか判断する直前 | 同一識別情報の照会を再実行より先に示す | Timeoutを未実行とみなし新規外部作用（Effect）を起こす |

UI部品や通信方式はここで固定しない。各UX行のFeedbackを、IAの状態・導線と対応付けて表示する。

## 状態と表示差

| UX／IAの対応 | 区別する状態 | 状態から進む導線 |
|---|---|---|
| UX-000019／IA-000014 | 準備済み（prepared）／送信済み（sent）／受領済み（received）／返却済み（returned）／停止（blocked） | 情報源→選択→仕事用情報一式（Context Package）→Task→結果（Result）→元の仕事 |
| UX-000021／IA-000014 | 進行中（active）／切断（disconnected）／結果取得可能（result_available）／回復必要（recovery_required）／確定済み（settled） | 再接続→同じ依頼（Request）→現在権限→状態・結果→回復義務 |
| UX-000021／IA-000003 | 進行中（active）／切断（disconnected）／結果取得可能（result_available）／回復必要（recovery_required）／確定済み（settled） | 再接続→同じ依頼（Request）→現在権限→状態・結果→回復義務 |

上表にない処理中、取消、回復その他の状態を一律に追加しない。値なし、未観測、古い値、競合、開示制限または結果不明は、該当するIA定義が要求する場合にだけ別状態として示す。

## 視覚表現とアクセシビリティ

- 「仕事用情報一式（Context Package）、情報源参照（Source Reference）、選択理由（Selection Reason）、作業（Task）、引き渡し（Handoff）、結果（Result）、判断（Decision）、依頼（Request）、試行（Attempt）、外部作用（Effect）、回復義務（Recovery Obligation）、回復処置（Recovery Action）、終了確認（Settlement Observation）、次の行動（Next Action）」を、色だけでなく表示名、状態語、順序でも見分けられるようにする。
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
| UX-000019 | IA-000014 | 必要な情報だけを出所付きで渡す。情報源・改訂版・選択理由を保持する | IA-000014 が示す状態・関係を入力条件、成功・停止条件へ接続し、「全量投入・秘密情報混入・古い仮説の現在値化」を防ぐ観測可能な結果を確定する |
| UX-000021 | IA-000014 | 切断後に同じ依頼へ戻る。同一識別情報の照会を再実行より先に示す | IA-000014 が示す状態・関係を入力条件、成功・停止条件へ接続し、「Timeoutを未実行とみなし新規外部作用（Effect）を起こす」を防ぐ観測可能な結果を確定する |
| UX-000021 | IA-000003 | 切断後に同じ依頼へ戻る。同一識別情報の照会を再実行より先に示す | IA-000003 が示す状態・関係を入力条件、成功・停止条件へ接続し、「Timeoutを未実行とみなし新規外部作用（Effect）を起こす」を防ぐ観測可能な結果を確定する |

SPECはこの表の結論を転記せず、UX観点とIA観点を別々に分析する。UIの操作に対応する発火条件・結果がない、またはSPECの結果を利用者が認識できない場合は対応レビューを通過しない。

## 対応するSPEC

- pairs_with: [SPEC-000017](../../../05_SPEC/Definitions/SPEC-000017/spec_definition.md)

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

- [UX-000019のUI分析](../../Analysis/UX-000019/ui_analysis.md)
- [UX-000021のUI分析](../../Analysis/UX-000021/ui_analysis.md)
- [IA-000014のUI分析](../../Analysis/IA-000014/ui_analysis.md)
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
