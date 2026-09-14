# IA-000014のUI分析

成果物種別: UI分析（IA観点）
分析単位: `IA-000014`
状態: 分析済み

## 1. 正式入力

- IA定義: [IA-000014 受け渡す情報・Task・結果・帰還](../../../03_IA/Definitions/IA-000014/ia_definition.md)

UXやREQを直接読んで不足を補完しない。この分析はIA定義から情報設計観点だけを導き、利用者成果と操作体験はUX観点の分析に委ねる。

## 2. UIへ引き継ぐ情報構造

必要最小の情報を出所付きで渡し、同じ仕事へ結果と未決事項を戻す。

| 対象 | 利用者にとっての意味 | 識別・関係 |
|---|---|---|
| 仕事用情報一式（Context Package） | 選択した仕事用情報一式 | 情報一式の識別子（Package ID） |
| 情報源参照（Source Reference） | 出所と改訂版（Revision） | 情報源の識別子（Source Identity）＋改訂版（Revision） |
| 選択理由（Selection Reason） | 含めた理由 | Package Itemへ結合 |
| 作業（Task） | 受け渡し先の仕事 | 作業識別子（Task Identity） |
| 引き渡し（Handoff） | 役割間の移送 | 情報源（Source）／Target Role |
| 結果（Result） | Taskから戻る成果と状態 | Taskへ結合 |
| 判断（Decision） | 結果とともに元の仕事へ戻す判断・未解決事項 | 責任者（Owner）と決定権限（Decision Authority）へ結ぶ |

UIでは「仕事用情報一式（Context Package）、情報源参照（Source Reference）、選択理由（Selection Reason）、作業（Task）、引き渡し（Handoff）、結果（Result）、判断（Decision）」の識別と関係を維持する。同名・近似値、未観測・不存在、現在値・古い値を表示都合でまとめない。

## 3. 表示の優先順位とNavigation

| 利用場面 | 最初に見分ける対象 | 区別する状態 | 次の導線 |
|---|---|---|---|
| `UX-000019`／外部へ渡す情報の所有者／別Agentやツールへ仕事を渡す時、または結果を受け取る時 | 仕事用情報一式（Context Package）、情報源（Source）、改訂版（Revision）、選択理由（Selection Reason）、作業（Task）、引き渡し（Handoff）、結果（Result）、判断（Decision） | 準備済み（prepared）／送信済み（sent）／受領済み（received）／返却済み（returned）／停止（blocked） | 情報源→選択→仕事用情報一式（Context Package）→Task→結果（Result）→元の仕事 |
| `UX-000021`／プロジェクト運営者／PM／応答喪失後に再接続する時 | 依頼識別子（Request Identity）、試行（Attempt）、接続中の作業単位（Session）、現在有効な利用許可（Current Grant）、結果（Result）、回復義務（Recovery Obligation） | 進行中（active）／切断（disconnected）／結果取得可能（result_available）／回復必要（recovery_required）／確定済み（settled） | 再接続→同じ依頼（Request）→現在権限→状態・結果→回復義務 |
| `UX-000024`／外部へ渡す情報の所有者／外部AI・検索・公開Communication・管理対象依存を利用する時 | 送信先（Destination）、目的（Purpose）、情報分類（Information Classification）、同意（Consent）、送信する最小情報、作業（Task）、持帰り結果（Returned Result）、候補（Candidate）、判断（Decision） | 未許可（not_authorized）／許可済み（authorized）／送信済み（sent）／返却済み（returned）／候補（candidate）／採用（adopted） | 送信候補→境界確認→送信する最小情報→送信→出所付き結果→採否 |

```text
受け渡す情報・Task・結果・帰還
        ↓
対象と現在状態
        ↓
不足・制限・競合
        ↓
関係・根拠
        ↓
判断／回復／次の対象
```

内部ID、生Log、実装詳細は最初の結論へ混在させず、根拠を掘り下げる段階で示す。

## 4. 表示差と開示境界

IA定義が要求する状態区分:

- `UX-000019`: 準備済み（prepared）／送信済み（sent）／受領済み（received）／返却済み（returned）／停止（blocked）
- `UX-000021`: 進行中（active）／切断（disconnected）／結果取得可能（result_available）／回復必要（recovery_required）／確定済み（settled）
- `UX-000024`: 未許可（not_authorized）／許可済み（authorized）／送信済み（sent）／返却済み（returned）／候補（candidate）／採用（adopted）

IA定義が要求する導線と責任:

- 外部へ渡す情報の所有者: 別Agentやツールへ仕事を渡す時、または結果を受け取る時に「必要な情報だけを出所付きで渡す」ために必要な判断を行う。システムは「全量投入・秘密情報混入・古い仮説の現在値化」を避けられるよう、情報源・改訂版・選択理由を保持する。
- プロジェクト運営者／PM: 応答喪失後に再接続する時に「切断後に同じ依頼へ戻る」ために必要な判断を行う。システムは「Timeoutを未実行とみなし新規外部作用（Effect）を起こす」を避けられるよう、同一識別情報の照会を再実行より先に示す。
- 外部へ渡す情報の所有者: 外部AI・検索・公開Communication・管理対象依存を利用する時に「送信範囲と内部へ戻す際の昇格条件を理解する」ために必要な判断を行う。システムは「接続済みを包括許可とし、外部反応や依存新版を要求・因果・方針へ自動昇格する」を避けられるよう、同意・投影・採用を分離する。

値なし、未観測、古い値、競合、部分取得、開示制限および結果不明は、それぞれ利用者の次の判断が異なる場合に別の表示状態として扱う。開示できない対象は、その存在自体を示せるかも決定権限に従う。

## 5. UI処置

| UI候補 | 処置 | 保持する情報・状態・導線 | 判断理由 |
|---|---|---|---|
| [UI-000012 Agent間の情報引継ぎと再接続](../../Definitions/UI-000012/ui_definition.md) | New | 受け渡す情報・Task・結果・帰還 | この情報構造を利用者が判断できる表示へ変換する |
| [UI-000016 外部送信の同意・持帰り・採否](../../Definitions/UI-000016/ui_definition.md) | Same | 受け渡す情報・Task・結果・帰還 | 同じ情報構造を別の利用場面でも使う |

## 6. UX観点との統合時に確認すること

UX観点の分析が求める利用者成果、重要場面、操作およびFeedbackに対し、「受け渡す情報・Task・結果・帰還」の対象・状態・関係・導線が過不足なく判断材料を提供するかをUI定義で確認する。IAからUIへ引き渡す固有の意図は「Architectureは情報解決（Resolver）と通信方式（Transport）を分け、SPECは同じ識別子（Identity）での再取得を、Verificationは出所喪失・過剰投入を反証する。」であり、利用者の目的をここで推測して先取りしない。
