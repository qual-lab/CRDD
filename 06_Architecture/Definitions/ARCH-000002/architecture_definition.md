# 契約移行と利用側閉包のArchitecture定義

成果物種別: Architecture定義
Architecture ID: `ARCH-000002`
状態: Canonical
維持責任者: Qual-Lab

## 1. 責務と境界

変更ファイルではなく移動した意味契約から利用側集合を導出し、宣言集合と実ソース集合を比較する。CanonicalなPath・Identity・StateをConsumer側で再解釈させない。

| 区分 | 内容 |
|---|---|
| 状態Owner | 変更影響分析とConsumer Closure契約 |
| 所有する責務 | 責務移動時の旧Owner、新Owner、Producer、全Consumer、派生物、署名・Release経路の閉包 |
| 所有しない責務 | 各Consumerの業務処理、移行完了の人間判断 |
| 主な外部境界 | 変更正本、実ソース、公開入口、配布・署名経路 |

## 2. UI観点の入力

| UI分析 | 守る利用者向けの約束 |
|---|---|
| [UI-000014](../../Analysis/UI-000014/architecture_analysis.md) | 成立済み能力と利用側の確認 |

## 3. SPEC観点の入力

| SPEC分析 | 守る振る舞い契約 |
|---|---|
| [SPEC-000019](../../Analysis/SPEC-000019/architecture_analysis.md) | 責務変更後の利用側閉包を検証する |

## 4. 両観点の統合判断

入力ごとの状態Owner、Authority、Effect、失敗およびlifecycleを次表で分ける。同じ責務に統合しても、読取り、分類、書込み、外部Effectまたは再接続を相互流用しない。

| 入力 | 観点 | State Owner | Authority | Effect／非該当 | Failure Boundary | Lifecycle |
|---|---|---|---|---|---|---|
| UI-000014 | UI | 変更影響分析とConsumer Closure契約 | UI契約はAuthorityを発行しない。利用者操作: 対応を見る／不足箇所へ進む | UI契約はEffectを定義しない。表示上の状態差: 維持／変更／廃止／未確認。導線: 変更→能力→全利用側→置換→反証根拠 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 | 利用者が確認・操作する → 内部変更後も以前の能力がどこで保たれたか確認できる。 → 結果と次の行動を認識する |
| SPEC-000019 | SPEC | 変更影響分析とConsumer Closure契約 | 変更責任者が移行候補を作り、独立確認後に完了を判断する | 検査は読取り専用。Consumer集合不一致では旧処理削除やRelease Effectを許さない。 | 代表経路だけのPassや旧処理の推測削除を許さない。 | [責務変更] -> [Producer／Consumer／派生物／署名経路を導出] -> [宣言集合と比較] -> [閉包／不足] |

## 5. 構造と依存方向

```text
[変更影響分析とConsumer Closure契約]
└─ [SPEC-000019: 責務変更後の利用側閉包を検証する]
   [責務変更] -> [Producer／Consumer／派生物／署名経路を導出] -> [宣言集合と比較] -> [閉包／不足]
```

各SPEC branchはSibling blockであり、前のblockのAuthorityやEffectを暗黙に継承しない。UI契約はこれらの状態を利用者へ表すが、AuthorityやEffectを発行しない。

## 6. データ・状態・Interface

共通するIdentityとDataの関係はこの責務が管理する。ただし、状態Owner、AuthorityおよびEffectは入力単位で次のように分け、責務全体へ一律に拡張しない。

| 入力 | State Owner | Authority | Effect／非該当 |
|---|---|---|---|
| UI-000014 | 変更影響分析とConsumer Closure契約 | UI契約はAuthorityを発行しない。利用者操作: 対応を見る／不足箇所へ進む | UI契約はEffectを定義しない。表示上の状態差: 維持／変更／廃止／未確認。導線: 変更→能力→全利用側→置換→反証根拠 |
| SPEC-000019 | 変更影響分析とConsumer Closure契約 | 変更責任者が移行候補を作り、独立確認後に完了を判断する | 検査は読取り専用。Consumer集合不一致では旧処理削除やRelease Effectを許さない。 |

公開Interfaceは入力IDと対応する契約を保持し、別入力のAuthority、Effectまたはlifecycleを暗黙に継承しない。

## 7. 失敗・回復・観測

- SPEC-000019: 代表経路だけのPassや旧処理の推測削除を許さない。Effect: 検査は読取り専用。Consumer集合不一致では旧処理削除やRelease Effectを許さない。

- 入力SPECが固有Recoveryを定義しない場合、Architectureから追加しない。
- 結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める。

## 8. 品質・保護・運用

| 入力 | 保護する失敗境界 | 検証可能性 |
|---|---|---|
| UI-000014 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 | 利用者が状態差と次の行動を認識でき、UIからAuthorityやEffectが発行されないこと |
| SPEC-000019 | 代表経路だけのPassや旧処理の推測削除を許さない。 | 固有のAuthority、Effect、失敗理由および終了状態を理由別に反証できること |

共通品質を理由に、入力固有の失敗、非該当Effectまたは終了条件を一つの成功状態へまとめない。

## 9. 互換性・移行・成立済み能力

| 基準版Capability | 旧Owner／現行照合先 | 新Owner | 保持状態 | Evidence | Gap／移行 |
|---|---|---|---|---|---|
| v0.20.1のConsumer Closure規則 | Maintenance／Version Control consumer closure | 変更影響分析とConsumer Closure契約 | 保持・強化 | [version-control:integration:consumer-closure](../../../07_Quality/Registry/test-catalog.json) | Architecture関係集合にも適用 |

現行設計はこの比較だけに使い、UI／SPECにない望ましい意味を補わない。新規責務は基準版能力や実装Evidenceが存在するように表示しない。

## 10. 実装と検証への引き渡し

- 実装は「責務移動時の旧Owner、新Owner、Producer、全Consumer、派生物、署名・Release経路の閉包」を所有するCoreと、外部境界を扱うPort／Adapterを分ける。
- 責務変更→集合導出→全数移行→契約試験→独立確認を段階的な結合試験で確認する。
- 代表Consumerだけの成功、宣言漏れ、旧Path語彙残存、Canonical値の再解釈を理由別に反証する。
- Task Recoveryは非該当。移行失敗時は旧能力を削除せず未完了として戻す。

## 11. 情報源と現行照合

正式入力は第2・3節のArchitecture分析だけである。次は成立済み能力とGapを照合するためにだけ参照する。

- [現行照合先](../../01_Architecture.md)
- [現行照合先](../../../19_Maintenance.md)

## Checklist

- [x] UI分析とSPEC分析だけを正式入力として統合した
- [x] UI ContractとSPEC Contractを入力別に保持した
- [x] 独立したArchitecture Responsibilityを説明できる
- [x] 所有する責務、所有しない責務およびBoundaryを明示した
- [x] Major Component、Interfaceおよび依存方向を明示した
- [x] Data／State Ownershipを明示した
- [x] Authority、EffectおよびLifecycleを入力別に評価した
- [x] Failure Boundary、Recovery責任および観測を明示した
- [x] Security／TrustとQuality Constraintを評価した
- [x] Human Inputの必要性とOpen／Gapを評価した
- [x] DetailsへのHandoffを明示した
- [x] Qualityへ渡すVerification Intentを明示した
- [x] 現行Sourceや実装構造から意味を逆輸入していない
- [x] 上流の観測可能な振る舞いをArchitectureで変更していない
