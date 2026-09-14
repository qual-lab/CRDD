# UI-000016 外部送信の同意・持帰り・採否

成果物種別: UI定義
UI ID: `UI-000016`
状態: Canonical
維持責任者: Qual-Lab

## 利用者成果

外部へ渡す範囲を理解し、戻った候補を採用前に判断できる。

## UX観点の入力

| UX分析 | このUIで保持する利用者成果 |
|---|---|
| [UX-000024](../../Analysis/UX-000024/ui_analysis.md) | 外部作用（Effect）の前に送信先・目的・操作・情報分類・許可範囲を理解し、外部情報・反応・依存新版を出典付き候補として扱える |

## IA観点の入力

| IA分析 | このUIで保持する情報構造 |
|---|---|
| [IA-000014](../../Analysis/IA-000014/ui_analysis.md) | 必要最小の情報を出所付きで渡し、同じ仕事へ結果と未決事項を戻す。 |
| [IA-000017](../../Analysis/IA-000017/ui_analysis.md) | 外部へ何をなぜ渡すかを判断し、戻った結果を自動採用しない。 |

## 両観点の統合判断

| UX分析 | 利用者が得たい結果 | 対応するIA分析 | UIで成立させる対応 |
|---|---|---|---|
| [UX-000024](../../Analysis/UX-000024/ui_analysis.md) | 不要情報を漏らさず人間判断を保って外部連携できる | [IA-000014](../../Analysis/IA-000014/ui_analysis.md) | 送信先（Destination）、目的（Purpose）、情報分類（Information Classification）、同意（Consent）、送信する最小情報、作業（Task）、持帰り結果（Returned Result）、候補（Candidate）、判断（Decision）を見分ける。状態は「未許可（not_authorized）／許可済み（authorized）／送信済み（sent）／返却済み（returned）／候補（candidate）／採用（adopted）」。導線は「送信候補→境界確認→送信する最小情報→送信→出所付き結果→採否」 |
| [UX-000024](../../Analysis/UX-000024/ui_analysis.md) | 不要情報を漏らさず人間判断を保って外部連携できる | [IA-000017](../../Analysis/IA-000017/ui_analysis.md) | 送信先（Destination）、目的（Purpose）、情報分類（Information Classification）、同意（Consent）、送信する最小情報、作業（Task）、持帰り結果（Returned Result）、候補（Candidate）、判断（Decision）を見分ける。状態は「未許可（not_authorized）／許可済み（authorized）／送信済み（sent）／返却済み（returned）／候補（candidate）／採用（adopted）」。導線は「送信候補→境界確認→送信する最小情報→送信→出所付き結果→採否」 |

UIはUX側の目的だけでも、IA側の対象一覧だけでも成立しない。各行の利用者成果を、対応する情報・状態・関係・導線で判断可能にした時だけ、このUIの意味が成立する。

## 表示面と情報の優先順位

```text
外部送信の同意・持帰り・採否
        ↓
仕事用情報一式（Context Package）／情報源参照（Source Reference）／選択理由（Selection Reason）／作業（Task）／引き渡し（Handoff）／結果（Result）／判断（Decision）／送信先（Destination）／目的（Purpose）／情報分類（Information Classification）／同意（Consent）／送信情報（Outbound Package）／持帰り候補（Returned Candidate）
        ↓
現在状態・不足・制限
        ↓
送信候補→境界確認→送信する最小情報→送信→出所付き結果→採否
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
| IA-000017 | 送信先（Destination） | 情報の送信先 | 提供先の識別子（Provider／Service Identity） |
| IA-000017 | 目的（Purpose） | 許可する操作目的 | 目的識別子（Purpose Identity） |
| IA-000017 | 情報分類（Information Classification） | 送る情報の分類 | Policyに基づく値 |
| IA-000017 | 同意（Consent） | 主体が許可した範囲 | 送信先（Destination）＋目的（Purpose）＋Scope＋Time |
| IA-000017 | 送信情報（Outbound Package） | 実際に送る最小情報 | 情報源参照（Source Reference）集合 |
| IA-000017 | 持帰り候補（Returned Candidate） | 出所付きの戻り結果 | Task＋送信先（Destination） |

同じ画面や応答へ置く場合も、上表の独立軸を一つの成功・信頼・完了へ畳まない。重要な不足、制限、判断要否は詳細へ隠さない。

## 操作とFeedback

主要な操作・判断: 同意する／送信を止める／候補を採用・却下する。

| UX分析 | 利用者が行う判断・行動 | 重要な場面 | 必要なFeedback | 避ける失敗 |
|---|---|---|---|---|
| UX-000024 | 送信範囲と内部へ戻す際の昇格条件を理解する | 外部作用（Effect）の前と結果昇格時 | 同意・投影・採用を分離する | 接続済みを包括許可とし、外部反応や依存新版を要求・因果・方針へ自動昇格する |

UI部品や通信方式はここで固定しない。各UX行のFeedbackを、IAの状態・導線と対応付けて表示する。

## 状態と表示差

| UX／IAの対応 | 区別する状態 | 状態から進む導線 |
|---|---|---|
| UX-000024／IA-000014 | 未許可（not_authorized）／許可済み（authorized）／送信済み（sent）／返却済み（returned）／候補（candidate）／採用（adopted） | 送信候補→境界確認→送信する最小情報→送信→出所付き結果→採否 |
| UX-000024／IA-000017 | 未許可（not_authorized）／許可済み（authorized）／送信済み（sent）／返却済み（returned）／候補（candidate）／採用（adopted） | 送信候補→境界確認→送信する最小情報→送信→出所付き結果→採否 |

上表にない処理中、取消、回復その他の状態を一律に追加しない。値なし、未観測、古い値、競合、開示制限または結果不明は、該当するIA定義が要求する場合にだけ別状態として示す。

## 視覚表現とアクセシビリティ

- 「仕事用情報一式（Context Package）、情報源参照（Source Reference）、選択理由（Selection Reason）、作業（Task）、引き渡し（Handoff）、結果（Result）、判断（Decision）、送信先（Destination）、目的（Purpose）、情報分類（Information Classification）、同意（Consent）、送信情報（Outbound Package）、持帰り候補（Returned Candidate）」を、色だけでなく表示名、状態語、順序でも見分けられるようにする。
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
| UX-000024 | IA-000014 | 送信範囲と内部へ戻す際の昇格条件を理解する。同意・投影・採用を分離する | IA-000014 が示す状態・関係を入力条件、成功・停止条件へ接続し、「接続済みを包括許可とし、外部反応や依存新版を要求・因果・方針へ自動昇格する」を防ぐ観測可能な結果を確定する |
| UX-000024 | IA-000017 | 送信範囲と内部へ戻す際の昇格条件を理解する。同意・投影・採用を分離する | IA-000017 が示す状態・関係を入力条件、成功・停止条件へ接続し、「接続済みを包括許可とし、外部反応や依存新版を要求・因果・方針へ自動昇格する」を防ぐ観測可能な結果を確定する |

SPECはこの表の結論を転記せず、UX観点とIA観点を別々に分析する。UIの操作に対応する発火条件・結果がない、またはSPECの結果を利用者が認識できない場合は対応レビューを通過しない。

## 情報源

- [UX-000024のUI分析](../../Analysis/UX-000024/ui_analysis.md)
- [IA-000014のUI分析](../../Analysis/IA-000014/ui_analysis.md)
- [IA-000017のUI分析](../../Analysis/IA-000017/ui_analysis.md)
