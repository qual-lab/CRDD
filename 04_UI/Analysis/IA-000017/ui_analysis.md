# IA-000017のUI分析

成果物種別: UI分析（IA観点）
分析単位: `IA-000017`
状態: 分析済み

## 1. 正式入力

- IA定義: [IA-000017 外部送信先・目的・分類・同意・候補](../../../03_IA/Definitions/IA-000017/ia_definition.md)

UXやREQを直接読んで不足を補完しない。この分析はIA定義から情報設計観点だけを導き、利用者成果と操作体験はUX観点の分析に委ねる。

## 2. UIへ引き継ぐ情報構造

外部へ何をなぜ渡すかを判断し、戻った結果を自動採用しない。

| 対象 | 利用者にとっての意味 | 識別・関係 |
|---|---|---|
| 送信先（Destination） | 情報の送信先 | 提供先の識別子（Provider／Service Identity） |
| 目的（Purpose） | 許可する操作目的 | 目的識別子（Purpose Identity） |
| 情報分類（Information Classification） | 送る情報の分類 | Policyに基づく値 |
| 同意（Consent） | 主体が許可した範囲 | 送信先（Destination）＋目的（Purpose）＋Scope＋Time |
| 送信情報（Outbound Package） | 実際に送る最小情報 | 情報源参照（Source Reference）集合 |
| 持帰り候補（Returned Candidate） | 出所付きの戻り結果 | Task＋送信先（Destination） |

UIでは「送信先（Destination）、目的（Purpose）、情報分類（Information Classification）、同意（Consent）、送信情報（Outbound Package）、持帰り候補（Returned Candidate）」の識別と関係を維持する。同名・近似値、未観測・不存在、現在値・古い値を表示都合でまとめない。

## 3. 表示の優先順位とNavigation

| 利用場面 | 最初に見分ける対象 | 区別する状態 | 次の導線 |
|---|---|---|---|
| `UX-000024`／外部へ渡す情報の所有者／外部AI・検索・公開Communication・管理対象依存を利用する時 | 送信先（Destination）、目的（Purpose）、情報分類（Information Classification）、同意（Consent）、送信する最小情報、作業（Task）、持帰り結果（Returned Result）、候補（Candidate）、判断（Decision） | 未許可（not_authorized）／許可済み（authorized）／送信済み（sent）／返却済み（returned）／候補（candidate）／採用（adopted） | 送信候補→境界確認→送信する最小情報→送信→出所付き結果→採否 |

```text
外部送信先・目的・分類・同意・候補
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

- `UX-000024`: 未許可（not_authorized）／許可済み（authorized）／送信済み（sent）／返却済み（returned）／候補（candidate）／採用（adopted）

IA定義が要求する導線と責任:

- 外部へ渡す情報の所有者: 外部AI・検索・公開Communication・管理対象依存を利用する時に「送信範囲と内部へ戻す際の昇格条件を理解する」ために必要な判断を行う。システムは「接続済みを包括許可とし、外部反応や依存新版を要求・因果・方針へ自動昇格する」を避けられるよう、同意・投影・採用を分離する。

値なし、未観測、古い値、競合、部分取得、開示制限および結果不明は、それぞれ利用者の次の判断が異なる場合に別の表示状態として扱う。開示できない対象は、その存在自体を示せるかも決定権限に従う。

## 5. UI処置

| UI候補 | 処置 | 保持する情報・状態・導線 | 判断理由 |
|---|---|---|---|
| [UI-000016 外部送信の同意・持帰り・採否](../../Definitions/UI-000016/ui_definition.md) | New | 外部送信先・目的・分類・同意・候補 | この情報構造を利用者が判断できる表示へ変換する |

## 6. UX観点との統合時に確認すること

UX観点の分析が求める利用者成果、重要場面、操作およびFeedbackに対し、「外部送信先・目的・分類・同意・候補」の対象・状態・関係・導線が過不足なく判断材料を提供するかをUI定義で確認する。IAからUIへ引き渡す固有の意図は「Communicationは外部表現への昇格を、SPECとArchitectureは送受信境界を、UIは同意と採否を別操作にする。」であり、利用者の目的をここで推測して先取りしない。
