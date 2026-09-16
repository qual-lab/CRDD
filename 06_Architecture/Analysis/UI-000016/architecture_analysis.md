# UI-000016のArchitecture分析

成果物種別: Architecture分析（UI観点）
分析単位: `UI-000016`
状態: Canonical

## 1. 正式入力

- UI定義: [UI-000016 外部送信の同意・持帰り・採否](../../../04_UI/Definitions/UI-000016/ui_definition.md)

このUI定義だけを正式入力とする。反対観点、上流工程、現行Architectureまたは実装から不足する意味を補わない。

## 2. Architectureへ引き継ぐUI契約

### 利用者成果

外部へ渡す範囲を理解し、戻った候補を採用前に判断できる。

### 表示面と情報の優先順位

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

### 操作とFeedback

主要な操作・判断: 同意する／送信を止める／候補を採用・却下する。

| UX分析 | 利用者が行う判断・行動 | 重要な場面 | 必要なFeedback | 避ける失敗 |
|---|---|---|---|---|
| UX-000024 | 送信範囲と内部へ戻す際の昇格条件を理解する | 外部作用（Effect）の前と結果昇格時 | 同意・投影・採用を分離する | 接続済みを包括許可とし、外部反応や依存新版を要求・因果・方針へ自動昇格する |

UI部品や通信方式はここで固定しない。各UX行のFeedbackを、IAの状態・導線と対応付けて表示する。

### 状態と表示差

| UX／IAの対応 | 区別する状態 | 状態から進む導線 |
|---|---|---|
| UX-000024／IA-000014 | 未許可（not_authorized）／許可済み（authorized）／送信済み（sent）／返却済み（returned）／候補（candidate）／採用（adopted） | 送信候補→境界確認→送信する最小情報→送信→出所付き結果→採否 |
| UX-000024／IA-000017 | 未許可（not_authorized）／許可済み（authorized）／送信済み（sent）／返却済み（returned）／候補（candidate）／採用（adopted） | 送信候補→境界確認→送信する最小情報→送信→出所付き結果→採否 |

上表にない処理中、取消、回復その他の状態を一律に追加しない。値なし、未観測、古い値、競合、開示制限または結果不明は、該当するIA定義が要求する場合にだけ別状態として示す。

### 視覚表現とアクセシビリティ

- 「仕事用情報一式（Context Package）、情報源参照（Source Reference）、選択理由（Selection Reason）、作業（Task）、引き渡し（Handoff）、結果（Result）、判断（Decision）、送信先（Destination）、目的（Purpose）、情報分類（Information Classification）、同意（Consent）、送信情報（Outbound Package）、持帰り候補（Returned Candidate）」を、色だけでなく表示名、状態語、順序でも見分けられるようにする。
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
| [外部送信・結果帰還・候補採用のArchitecture定義](../../Definitions/ARCH-000015/architecture_definition.md) | External Information Boundary | UI契約はAuthorityを発行しない。利用者操作: 同意する／送信を止める／候補を採用・却下する | UI契約はEffectを定義しない。表示上の状態差: 未許可（not_authorized）／許可済み（authorized）／送信済み（sent）／返却済み（returned）／候補（candidate）／採用（adopted）。導線: 送信候補→境界確認→送信する最小情報→送信→出所付き結果→採否 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 |

## 4. Architecture処置

| Architecture定義候補 | 処置 | 判断理由 |
|---|---|---|
| [外部送信・結果帰還・候補採用](../../Definitions/ARCH-000015/architecture_definition.md) | New | not_authorized→authorized→sent→returned→candidate→adoptedを別AuthorityとEffectにし、送信、受領、採用を相互流用しない。 |

## 5. SPEC観点との統合時に確認すること

- 対応候補: SPEC-000021、SPEC-000026、SPEC-000027
- この分析にある状態、操作、Feedback、Authority、Effectの適用／非適用、失敗を、対応SPECの契機と結果へ一つずつ照合する。
- 差分がある場合はArchitectureで推測せず、UI／SPEC対応レビューへ戻す。

## Checklist

- [x] 自分自身のUI定義だけを正式入力として処置した
- [x] 利用者が得る結果、認識、操作、Feedbackおよび状態差を保持した
- [x] Architectureが担う責務と担わない責務を評価した
- [x] Boundary、主要ComponentおよびInterfaceの必要性を評価した
- [x] Data／State Ownershipを評価した
- [x] Authority、Effectおよび開示境界を評価した
- [x] Failure BoundaryとRecovery責任を評価した
- [x] Security／TrustとQuality Constraintを評価した
- [x] Human Inputの必要性を評価した
- [x] Open／GapとOwner工程へ戻す条件を明示した
- [x] Verification Intentを評価した
- [x] 現行Sourceや実装構造から意味を逆輸入していない
- [x] SPEC観点との統合時に確認する事項を明示した
