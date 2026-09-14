# IA-000017 外部送信先・目的・分類・同意・候補

成果物種別: IA定義
IA ID: `IA-000017`
状態: Canonical
維持責任者: Qual-Lab

## 意味と利用者成果

外部へ何をなぜ渡すかを判断し、戻った結果を自動採用しない。

### 利用場面

| 入力UX | 利用者／場面 | 保持する対象 | 区別する状態 | 根拠・判断への導線 |
|---|---|---|---|---|
| [UX-000024](../../Analysis/UX-000024/ia_analysis.md) | 外部へ渡す情報の所有者／外部AI・検索・公開Communication・管理対象依存を利用する時 | 送信先（Destination）、目的（Purpose）、情報分類（Information Classification）、同意（Consent）、送信する最小情報、作業（Task）、持帰り結果（Returned Result）、候補（Candidate）、判断（Decision） | 未許可（not_authorized）／許可済み（authorized）／送信済み（sent）／返却済み（returned）／候補（candidate）／採用（adopted） | 送信候補→境界確認→送信する最小情報→送信→出所付き結果→採否 |

この表は入力UXごとの意味保持先である。共有定義へ統合しても、各行の対象・状態・導線を共通語だけへ丸めない。

## 対象・識別・関係

| 対象 | 利用者にとっての意味 | 識別・関係 |
|---|---|---|
| 送信先（Destination） | 情報の送信先 | 提供先の識別子（Provider／Service Identity） |
| 目的（Purpose） | 許可する操作目的 | 目的識別子（Purpose Identity） |
| 情報分類（Information Classification） | 送る情報の分類 | Policyに基づく値 |
| 同意（Consent） | 主体が許可した範囲 | 送信先（Destination）＋目的（Purpose）＋Scope＋Time |
| 送信情報（Outbound Package） | 実際に送る最小情報 | 情報源参照（Source Reference）集合 |
| 持帰り候補（Returned Candidate） | 出所付きの戻り結果 | Task＋送信先（Destination） |

```text
[O: 同意（Consent）] --利用を許す--> [O: 送信情報（Outbound Package）]
[O: 送信情報（Outbound Package）] --送信される--> [O: 送信先（Destination）]
[O: 送信情報（Outbound Package）] --目的とする--> [O: 目的（Purpose）]
[O: 送信情報（Outbound Package）] --持つ--> [O: 情報分類（Information Classification）]
[O: 送信先（Destination）] --返す--> [O: 持帰り候補（Returned Candidate）]
```

上表は複数の入力UXを横断して利用する中心対象を示す。入力固有の対象は「利用場面」の対応表にも保持し、中心対象へ統合できない意味を欠落として扱う。

## 状態と可視性

入力UXで必要とされた状態は次のとおりである。状態実値を採用する場合は、下流工程で対応関係を定義し、この利用者向け区分を上書きしない。

- `UX-000024`: 未許可（not_authorized）／許可済み（authorized）／送信済み（sent）／返却済み（returned）／候補（candidate）／採用（adopted）

重要な状態、不足、判断要否は次の行動と同じ文脈で示す。観測不能を不存在や正常へ丸めない。

## 導線と責任

- 外部へ渡す情報の所有者: 外部AI・検索・公開Communication・管理対象依存を利用する時に「送信範囲と内部へ戻す際の昇格条件を理解する」ために必要な判断を行う。システムは「接続済みを包括許可とし、外部反応や依存新版を要求・因果・方針へ自動昇格する」を避けられるよう、同意・投影・採用を分離する。

各利用場面の導線は「利用場面」の対応表を正とする。結果なし、判断待ち、失敗、状態不明の場合も、根拠または安全な戻り先へ接続する。

## 制約

具体的な画面、UI部品、API、Schema、保存方式、Process構成は本定義で確定しない。正式な識別子や状態実値を用いる場合は平易な表示と対応付け、利用者が内部構造を知らなくても判断できるようにする。

## 下流への引き渡し

Communicationは外部表現への昇格を、SPECとArchitectureは送受信境界を、UIは同意と採否を別操作にする。

下流工程は「利用場面」の各行を受入単位として扱い、中心対象だけを実装して入力固有の意味を落とさない。

## 情報源

- [UX-000024のIA分析](../../Analysis/UX-000024/ia_analysis.md)
