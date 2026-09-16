# 過去情報と現在有効な意図のArchitecture定義

成果物種別: Architecture定義
Architecture ID: `ARCH-000016`
状態: Canonical
維持責任者: Qual-Lab

## 1. 責務と境界

過去情報を消さず、現在有効な意図と区別する。Gitで再現できる全量Inventoryを永続化せず、必要なサマリーと参照Hashを保持する。

| 区分 | 内容 |
|---|---|
| 状態Owner | Context Provenance Resolver |
| 所有する責務 | 情報の出所、発生時点、対象改訂版、current／historical／superseded／unknownの解決 |
| 所有しない責務 | 履歴参照からの現在方針採用、内容の正しさの自動判断 |
| 主な外部境界 | Git履歴、Communication、Decision、現在正本 |

## 2. UI観点の入力

| UI分析 | 守る利用者向けの約束 |
|---|---|
| [UI-000017](../../Analysis/UI-000017/architecture_analysis.md) | 過去情報と現在有効な意図の選択 |

## 3. SPEC観点の入力

| SPEC分析 | 守る振る舞い契約 |
|---|---|
| [SPEC-000022](../../Analysis/SPEC-000022/architecture_analysis.md) | 過去情報と現在有効な意図を区別して解決する |

## 4. 両観点の統合判断

入力ごとのState Owner、Authority、Effect、失敗およびLifecycleを次表で分ける。同じ責務に統合しても、読取り、分類、書込み、外部Effectまたは再接続を相互流用しない。

| 入力 | 観点 | State Owner | Authority | Effect／非該当 | Failure Boundary | Lifecycle |
|---|---|---|---|---|---|---|
| UI-000017 | UI | Context Provenance Resolver | UI契約はAuthorityを発行しない。利用者操作: 履歴を見る／現在値を選ぶ／再評価する。 | UI契約はEffectを定義しない | 履歴を上書きし競合する理由を勝手に統合する | 現在有効（current）／履歴（historical）／置換済み（superseded）／不明（unknown） / 現在の仕事→選択した情報→根拠→過去値比較 /  |
| SPEC-000022 | SPEC | Context Provenance Resolver | 履歴を閲覧する主体。参照から現在方針の採用Authorityを推定しない | 読取り解決だけを行い、Gitで再現可能な状態を重複保存・変更しない。 | 古い判断を現在方針へ自動昇格せず、Commit SHAだけを成立条件にしない。 | [参照要求] -> [発生時点／改訂版／置換を照合] -> [current／historical／superseded／unknown] |

## 5. 構造と依存方向

```text
[Architecture Responsibility]
├─ UI-000017 (UI)
   現在有効（current）／履歴（historical）／置換済み（superseded）／不明（unknown） / 現在の仕事→選択した情報→根拠→過去値比較 / 
└─ SPEC-000022 (SPEC)
   [参照要求] -> [発生時点／改訂版／置換を照合] -> [current／historical／superseded／unknown]
```

各入力はSibling contractであり、前の入力のAuthority、EffectまたはLifecycleを暗黙に継承しない。UI契約は利用者へ認識・操作・Feedbackを提供するが、AuthorityやEffectを発行しない。

## 6. データ・状態・Interface

入力が共有するIdentityとDataの関係は、このArchitecture責務が管理する。ただしState Owner、AuthorityおよびEffectは入力単位で分け、責務全体へ一律に拡張しない。

| 入力 | State Owner | Authority | Effect／非該当 |
|---|---|---|---|
| UI-000017 | Context Provenance Resolver | UI契約はAuthorityを発行しない。利用者操作: 履歴を見る／現在値を選ぶ／再評価する。 | UI契約はEffectを定義しない |
| SPEC-000022 | Context Provenance Resolver | 履歴を閲覧する主体。参照から現在方針の採用Authorityを推定しない | 読取り解決だけを行い、Gitで再現可能な状態を重複保存・変更しない。 |

公開Interfaceは入力IDと対応する契約を保持し、別入力のAuthority、EffectまたはLifecycleを暗黙に継承しない。

## 7. 失敗・回復・観測

- UI-000017: 履歴を上書きし競合する理由を勝手に統合する Effect: UI契約はEffectを定義しない
- SPEC-000022: 古い判断を現在方針へ自動昇格せず、Commit SHAだけを成立条件にしない。 Effect: 読取り解決だけを行い、Gitで再現可能な状態を重複保存・変更しない。

- 入力が固有Recoveryを定義しない場合、Architectureから追加しない。
- 結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める。

## 8. 品質・保護・運用

| 入力 | 保護する失敗境界 | 検証意図 |
|---|---|---|
| UI-000017 | 履歴を上書きし競合する理由を勝手に統合する | 正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。 |
| SPEC-000022 | 古い判断を現在方針へ自動昇格せず、Commit SHAだけを成立条件にしない。 | 正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。 |

共通品質を理由に、入力固有の失敗、非該当Effectまたは終了条件を一つの成功状態へまとめない。

### 未確認事項・人間判断・戻り条件

| 入力 | 継承する未確認事項 | 判断者 | 現在判定 | 再評価契機 |
|---|---|---|---|---|
| UI-000017 | REQ-000029: CRDD作成者・保守者が「当時の仮説と現在有効な意図を区別する」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | CRDD作成者・保守者を代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。 |
| SPEC-000022 | REQ-000029: CRDD作成者・保守者が「当時の仮説と現在有効な意図を区別する」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | CRDD作成者・保守者を代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。 |

Architecture固有の追加人間判断はない。これは入力の未確認事項を解消済みとする意味ではない。入力の利用者成果、振る舞い、Authority、Effectまたは失敗境界を変える必要が生じた場合は、その意味を所有するUI／SPEC工程へ戻す。

## 9. 互換性・移行・成立済み能力

| 基準版Capability | 旧Owner／現行照合先 | 新Owner | 保持状態 | Evidence | Gap／移行 |
|---|---|---|---|---|---|
| v0.20.1の履歴／現在正本分離 | Documentation／Change Trace | Context Provenance Resolver | 保持・一般化 | [checker:integration:crdd-check](../../../07_Quality/Registry/test-catalog.json) | CROS Context Packageへの実装は未接続 |

現行設計はこの比較だけに使い、UI／SPECにない望ましい意味を補わない。新規責務は基準版能力や実装Evidenceが存在するように表示しない。

## 10. 実装と検証への引き渡し

- 実装は「情報の出所、発生時点、対象改訂版、current／historical／superseded／unknownの解決」を所有するCoreと、外部境界を扱うPort／Adapterを分ける。
- 情報取得→時点・版・置換関係解決→現在／履歴を区別して返却を段階的な結合試験で確認する。
- 古い仮説の現在値化、時点捏造、Gitで再現可能な全量Inventoryの固定を理由別に反証する。
- 取消・Recoveryは非該当。参照不能はunknownとして残す。

## 11. 情報源と現行照合

正式入力は第2・3節のArchitecture分析だけである。次は成立済み能力とGapを照合するためにだけ参照する。

- [現行照合先](../../01_Architecture.md)
- [現行照合先](../../../03_Documentation.md)

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
