# 外部送信・結果帰還・候補採用のArchitecture定義

成果物種別: Architecture定義
Architecture ID: `ARCH-000015`
状態: Canonical
維持責任者: Qual-Lab

## 1. 責務と境界

not_authorized→authorized→sent→returned→candidate→adoptedを別AuthorityとEffectにし、送信、受領、採用を相互流用しない。

| 区分 | 内容 |
|---|---|
| 状態Owner | External Information Boundary |
| 所有する責務 | 目的限定の送信同意、最小化送信、同じ依頼への結果帰還、候補隔離、採否 |
| 所有しない責務 | 送信同意からの結果採用、外部AIへの決定権限移譲、所有正本の無断更新 |
| 主な外部境界 | 外部AI／API／MCP、Candidate Store、所有正本、人間判断 |

## 2. UI観点の入力

| UI分析 | 守る利用者向けの約束 |
|---|---|
| [UI-000016](../../Analysis/UI-000016/architecture_analysis.md) | 外部送信の同意・持帰り・採否 |

## 3. SPEC観点の入力

| SPEC分析 | 守る振る舞い契約 |
|---|---|
| [SPEC-000021](../../Analysis/SPEC-000021/architecture_analysis.md) | 外部送信の同意範囲を検証して送信する |
| [SPEC-000026](../../Analysis/SPEC-000026/architecture_analysis.md) | 外部処理の結果を元の仕事へ持ち帰る |
| [SPEC-000027](../../Analysis/SPEC-000027/architecture_analysis.md) | 持ち帰った候補を所有正本へ昇格する |

## 4. 両観点の統合判断

入力ごとの状態Owner、Authority、Effect、失敗およびlifecycleを次表で分ける。同じ責務に統合しても、読取り、分類、書込み、外部Effectまたは再接続を相互流用しない。

| 入力 | 観点 | State Owner | Authority | Effect／非該当 | Failure Boundary | Lifecycle |
|---|---|---|---|---|---|---|
| UI-000016 | UI | External Information Boundary | UI契約はAuthorityを発行しない。利用者操作: 同意する／送信を止める／候補を採用・却下する | UI契約はEffectを定義しない。表示上の状態差: 未許可（not_authorized）／許可済み（authorized）／送信済み（sent）／返却済み（returned）／候補（candidate）／採用（adopted）。導線: 送信候補→境界確認→送信する最小情報→送信→出所付き結果→採否 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 | 利用者が確認・操作する → 外部へ渡す範囲を理解し、戻った候補を採用前に判断できる。 → 結果と次の行動を認識する |
| SPEC-000021 | SPEC | 外部送信Controller | 送信同意は許可範囲内の送信Effectだけを認め、結果受領や候補採用へ流用しない | 許可範囲の外部送信Effectを発行し、送信時の依頼識別情報と同意範囲を結果へ結合する。 | 期限切れ・範囲変更・不明な同意ではEffect 0で停止する。 | [送信候補] -> [同意検証] ├ valid -> [送信Effect発行] -> [送信済み] └ invalid／unknown -> [Effect 0] |
| SPEC-000026 | SPEC | 外部結果受領・相関Resolver | 外部結果を受領して元の仕事へ返せる主体。新規送信と候補採用のAuthorityは含まない | 受領した結果を元Taskへ結合し、未信頼候補として返す。Provider Effectを再発行しない。 | 送信時の識別情報へ結合できない結果は採用可能な候補へしない。 | [外部応答] -> [依頼Identity照合] ├ exact -> [未信頼候補として帰還] └ missing／ambiguous -> [隔離・採用不可] |
| SPEC-000027 | SPEC | 候補採用Controller | 所有正本の決定権限者だけが採用できる。送信同意や結果受領を流用しない | 採用時だけ所有正本を更新する。却下・保留では正本Effect 0。 | 結果受領や送信許可を候補採用Authorityへ流用しない。 | [未信頼候補] -> [人間判断] ├ 採用 -> [所有正本更新] ├ 却下 -> [候補履歴] └ 保留 -> [判断待ち] |

## 5. 構造と依存方向

```text
[External Information Boundary]
├─ [SPEC-000021: 外部送信の同意範囲を検証して送信する]
   [送信候補] -> [同意検証] ├ valid -> [送信Effect発行] -> [送信済み] └ invalid／unknown -> [Effect 0]
├─ [SPEC-000026: 外部処理の結果を元の仕事へ持ち帰る]
   [外部応答] -> [依頼Identity照合] ├ exact -> [未信頼候補として帰還] └ missing／ambiguous -> [隔離・採用不可]
└─ [SPEC-000027: 持ち帰った候補を所有正本へ昇格する]
   [未信頼候補] -> [人間判断] ├ 採用 -> [所有正本更新] ├ 却下 -> [候補履歴] └ 保留 -> [判断待ち]
```

各SPEC branchはSibling blockであり、前のblockのAuthorityやEffectを暗黙に継承しない。UI契約はこれらの状態を利用者へ表すが、AuthorityやEffectを発行しない。

## 6. データ・状態・Interface

共通するIdentityとDataの関係はこの責務が管理する。ただし、状態Owner、AuthorityおよびEffectは入力単位で次のように分け、責務全体へ一律に拡張しない。

| 入力 | State Owner | Authority | Effect／非該当 |
|---|---|---|---|
| UI-000016 | External Information Boundary | UI契約はAuthorityを発行しない。利用者操作: 同意する／送信を止める／候補を採用・却下する | UI契約はEffectを定義しない。表示上の状態差: 未許可（not_authorized）／許可済み（authorized）／送信済み（sent）／返却済み（returned）／候補（candidate）／採用（adopted）。導線: 送信候補→境界確認→送信する最小情報→送信→出所付き結果→採否 |
| SPEC-000021 | 外部送信Controller | 送信同意は許可範囲内の送信Effectだけを認め、結果受領や候補採用へ流用しない | 許可範囲の外部送信Effectを発行し、送信時の依頼識別情報と同意範囲を結果へ結合する。 |
| SPEC-000026 | 外部結果受領・相関Resolver | 外部結果を受領して元の仕事へ返せる主体。新規送信と候補採用のAuthorityは含まない | 受領した結果を元Taskへ結合し、未信頼候補として返す。Provider Effectを再発行しない。 |
| SPEC-000027 | 候補採用Controller | 所有正本の決定権限者だけが採用できる。送信同意や結果受領を流用しない | 採用時だけ所有正本を更新する。却下・保留では正本Effect 0。 |

公開Interfaceは入力IDと対応する契約を保持し、別入力のAuthority、Effectまたはlifecycleを暗黙に継承しない。

## 7. 失敗・回復・観測

- SPEC-000021: 期限切れ・範囲変更・不明な同意ではEffect 0で停止する。Effect: 許可範囲の外部送信Effectを発行し、送信時の依頼識別情報と同意範囲を結果へ結合する。
- SPEC-000026: 送信時の識別情報へ結合できない結果は採用可能な候補へしない。Effect: 受領した結果を元Taskへ結合し、未信頼候補として返す。Provider Effectを再発行しない。
- SPEC-000027: 結果受領や送信許可を候補採用Authorityへ流用しない。Effect: 採用時だけ所有正本を更新する。却下・保留では正本Effect 0。

- 入力SPECが固有Recoveryを定義しない場合、Architectureから追加しない。
- 結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める。

## 8. 品質・保護・運用

| 入力 | 保護する失敗境界 | 検証可能性 |
|---|---|---|
| UI-000016 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 | 利用者が状態差と次の行動を認識でき、UIからAuthorityやEffectが発行されないこと |
| SPEC-000021 | 期限切れ・範囲変更・不明な同意ではEffect 0で停止する。 | 固有のAuthority、Effect、失敗理由および終了状態を理由別に反証できること |
| SPEC-000026 | 送信時の識別情報へ結合できない結果は採用可能な候補へしない。 | 固有のAuthority、Effect、失敗理由および終了状態を理由別に反証できること |
| SPEC-000027 | 結果受領や送信許可を候補採用Authorityへ流用しない。 | 固有のAuthority、Effect、失敗理由および終了状態を理由別に反証できること |

共通品質を理由に、入力固有の失敗、非該当Effectまたは終了条件を一つの成功状態へまとめない。

## 9. 互換性・移行・成立済み能力

| 基準版Capability | 旧Owner／現行照合先 | 新Owner | 保持状態 | Evidence | Gap／移行 |
|---|---|---|---|---|---|
| v0.20.1の外部送信同意・結果隔離 | Coordinator external-send／candidate store | External Information Boundary | 保持・一般化 | [coordinator:integration:external-send-consent-runtime](../../../07_Quality/04_Test_Catalog.json)、[coordinator:integration:candidate-bundle-store](../../../07_Quality/04_Test_Catalog.json) | CROS経由外部Agentは未実装 |

現行設計はこの比較だけに使い、UI／SPECにない望ましい意味を補わない。新規責務は基準版能力や実装Evidenceが存在するように表示しない。

## 10. 実装と検証への引き渡し

- 実装は「目的限定の送信同意、最小化送信、同じ依頼への結果帰還、候補隔離、採否」を所有するCoreと、外部境界を扱うPort／Adapterを分ける。
- 同意→最小化→送信→帰還→隔離→人間判断→採用時だけ正本更新を段階的な結合試験で確認する。
- Secret送信、同意の目的外流用、別依頼への結果混入、生結果の正本化、自動採用を理由別に反証する。
- なし。外部Effectと正本Effectを含むため完全Lifecycleを必要とする。

## 11. 情報源と現行照合

正式入力は第2・3節のArchitecture分析だけである。次は成立済み能力とGapを照合するためにだけ参照する。

- [現行照合先](../../Details/coordinator/01_Architecture.md)
- [現行照合先](../../Details/cros/01_Architecture.md)
