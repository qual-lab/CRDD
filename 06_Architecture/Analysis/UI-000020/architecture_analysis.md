# UI-000020のArchitecture分析

成果物種別: Architecture分析（UI観点）
分析単位: `UI-000020`
状態: Canonical

## 1. 正式入力

- UI定義: [UI-000020 実行記録の依頼と結果確認](../../../04_UI/Definitions/UI-000020/ui_definition.md)

このUI定義だけを正式入力とする。上流工程、SPEC、現行Architectureまたは実装から不足する意味を補わない。

## 2. Architectureへ引き継ぐUI契約

### 利用者成果

実行記録を作る側が、許可された事実を一度だけ記録し、成否または結果不明を見分けて安全な次の処置へ進める。

### UX観点の分析結果

| UX分析 | このUIで保持する利用者成果 |
|---|---|
| [UX-000032](../../../04_UI/Analysis/UX-000032/ui_analysis.md) | 記録済み・未記録・結果不明を見分け、重複や上書きなく次の処置を選べる |

### IA観点の分析結果

| IA分析 | このUIで保持する情報構造 |
|---|---|
| [IA-000022](../../../04_UI/Analysis/IA-000022/ui_analysis.md) | 実行、情報源、観測、記録試行、公開結果、完成記録、衝突先および回復先 |

### 両観点の統合判断

| UX分析 | 利用者が得たい結果 | 対応するIA分析 | UIで成立させる対応 |
|---|---|---|---|
| [UX-000032](../../../04_UI/Analysis/UX-000032/ui_analysis.md) | 実行事実を安全に記録して結果を確かめる | [IA-000022](../../../04_UI/Analysis/IA-000022/ui_analysis.md) | 記録対象と許可範囲を確認して一度依頼し、同じExecution IDとAttempt IDに結び付いた結果、完成記録または再観測先を返す |

```text
UX-000032 作成側の成果 ─┐
                          ├─→ UI-000020
IA-000022 記録状態と導線 ─┘
```

### 表示面と情報の優先順位

記録対象・許可範囲、記録試行、結果状態、根拠、次の行動の順に示す。`not_recorded`と`unknown`を同じ失敗表示へ畳まず、内部保存方式やLock詳細を最初の結果へ混在させない。

### 操作とFeedback

| UX分析 | 利用者が行う判断・行動 | 重要な場面 | 必要なFeedback | 避ける失敗 |
|---|---|---|---|---|
| UX-000032 | 記録を依頼し、結果に応じて取得・修正後の再依頼・同一試行の再観測を選ぶ | 保存要求後に結果確認が途切れる時 | recorded／not_recorded／unknown、同じ実行・試行、完成記録または再観測先 | unknownを未記録と推定して再発行する |

### 状態と表示差

| UX／IAの対応 | 区別する状態 | 状態から進む導線 |
|---|---|---|
| UX-000032／IA-000022 | prepared／publishing／recorded／not_recorded／unknown | 記録対象→記録試行→結果→完成記録／拒否理由／同一試行の再観測 |

### 視覚表現とアクセシビリティ

- 状態を色だけで区別せず、状態名、対象Execution、Attemptと次の行動を文字で示す。
- CLI、TypeScript API、MCPまたは将来のWorkbenchで、同じ結果状態と再観測の意味を保つ。
- Secret、生出力、不要な個人情報をFeedbackや診断へ複製しない。

### 制約

- UIだけに記録の正本、Authority判断、不変Storeまたは独自状態Storeを作らない。
- 記録AuthorityをTask実行、評価採用または別Source変更へ流用しない。
- 記録結果不明を成功、未記録または空へ畳まない。

### UI／SPEC対応レビューへ渡す項目

| UX | IA | UIで観測可能にすべき操作・Feedback | SPEC側で未確定の振る舞い |
|---|---|---|---|
| UX-000032 | IA-000022 | 記録依頼、結果状態、同じ実行・試行、完成記録または再観測先 | Effect前検査、記録Authority、不変公開、並行衝突、途中失敗、Effect不明、終了後資源 |

### 対応するSPEC

- pairs_with: [SPEC-000030](../../../05_SPEC/Definitions/SPEC-000030/spec_definition.md)

### 未確認事項・人間判断・戻り条件

正式入力に残る未確認事項を、解消済みとみなさず次のとおり継承する。

#### UX-000032から継承する確認事項

入力Definitionから継承した確認事項の由来: [UX-000032](../../../02_UX/Definitions/UX-000032/ux_definition.md)

未確認事項は、統合元の要求ごとに次を保持する。

- REQ-000004: 実行環境の導入・運用者が「実行事実を出所と観測時点付きで比較する」を行う際の判断基準、許容負担、利用環境および失敗後の選択
- 現在判定: 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。
- 確認事項: REQ-000004: 実行環境の導入・運用者が「実行事実を出所と観測時点付きで比較する」を行う際の判断基準、許容負担、利用環境および失敗後の選択
- 判断者: 実行基盤・TypeScriptアプリへ実行記録を組み込む担当者を代表する利用者とQual-Lab。
- 未確認時の影響: 利用者成果、重要場面、失敗および品質期待を仮説として保持し、定量条件や実現方式を確定しない。
- Discoveryへ戻す条件: 想定した利用者、問題、望ましい変化または制約が誤っていると判明した場合。
- UX分析へ戻す条件: 利用場面、目的、得られる結果、重要場面、失敗または品質期待の統合判断が変わる場合。

再評価契機: 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。

#### IA-000022から継承する確認事項

入力Definitionから継承した確認事項の由来: [IA-000022](../../../03_IA/Definitions/IA-000022/ia_definition.md)

| 入力UX | UXから継承する確認事項 | 判断者 | 現在判定 | 未確認時の影響 |
|---|---|---|---|---|
| UX-000032 | REQ-000004: 実行環境の導入・運用者が「実行事実を出所と観測時点付きで比較する」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | 実行基盤・TypeScriptアプリへ実行記録を組み込む担当者を代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 利用者成果、重要場面、失敗および品質期待を仮説として保持し、定量条件や実現方式を確定しない。 |

IA固有の追加人間判断はない。これは入力UXの未確認事項が解消済みという意味ではない。正式入力にないObject、情報境界、所有責任または状態を追加する必要が生じた場合は人間の決定権限者へ戻す。UI／SPEC分析またはQuality Analysis / IAで対象・同一性・関係・状態・可視性・時間的な意味の不足または競合が判明した場合はIAを再開する。

再評価契機: 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。

#### UI固有の追加判断

現時点で追加の判断事項はない。これは上記の継承事項が解消済みという意味ではない。正式入力の意味、対応関係または成立条件に不足・競合が見つかった場合は、その意味を所有するUX／IAへ戻す。

### 検証意図

正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。

### 補足定義

なし。

この節にあるUX／IA／REQ参照は、正式入力である当該UI／SPEC Definitionが報告する来歴であり、Architectureの追加の正式入力ではない。

## 3. Architecture観点の分析

| 責務候補 | 状態Owner | 決定権限 | Effect／非該当 | 主な失敗境界 |
|---|---|---|---|---|
| [実行事実の記録](../../Definitions/ARCH-000018/architecture_definition.md) | 実行記録Writer／Store／Record Attempt | UI契約はAuthorityを発行しない。利用者操作: 入力定義に記録された操作・判断 | UI契約はEffectを定義しない。状態・導線: prepared／publishing／recorded／not_recorded／unknown / 記録対象→記録試行→結果→完成記録／拒否理由／同一試行の再観測 /  | unknownを未記録と推定して再発行する |

```text
記録依頼
   ↓ Effect前検査
prepared
   ↓ 不変公開要求
publishing
   ├ 完成確認 ─→ recorded
   ├ Effect 0確認 → not_recorded
   └ 観測不能 ─→ unknown ─→ 同じIdentity／Attemptで再観測
```

### 観点別評価

| 観点 | 判定 | 根拠・引渡し |
|---|---|---|
| Responsibility | 評価済み | [実行事実の記録](../../Definitions/ARCH-000018/architecture_definition.md)へ入力Contractを意味変更せず渡す。 |
| Boundary／Component／Interface | 評価済み | 状態Ownerは実行記録Writer／Store／Record Attempt。公開境界は入力定義のAuthority・Effect・制約を越えない。 |
| Data／State Ownership | 評価済み | 実行記録Writer／Store／Record AttemptをOwner候補とし、UI表示またはSPEC結果と内部状態を同一視しない。 |
| Failure／Recovery | 評価済み | unknownを未記録と推定して再発行する。Recoveryは入力定義にある場合だけ保持する。 |
| Security／Trust | 評価済み | 入力定義のAuthority、開示、Effect 0および非推定条件を保持する。 |
| Quality Constraint | 評価済み | 未観測・不明・制限・失敗を成功または不存在へ丸めない。 |
| Human Input | 継承あり | REQ-000004: 実行環境の導入・運用者が「実行事実を出所と観測時点付きで比較する」を行う際の判断基準、許容負担、利用環境および失敗後の選択。 |
| Open／Gap | 上流確認を継承 | 現在判定: 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。Architecture固有の追加Gapはない。 |
| Verification Intent | 評価済み | 正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。 |

Human Inputの判断者は「実行基盤・TypeScriptアプリへ実行記録を組み込む担当者を代表する利用者とQual-Lab。」。再評価契機は「対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。」。Architectureはこれらを解消済みとせず、入力の意味が変わる場合はOwner工程へ戻す。

## 4. Architecture処置

| Architecture定義候補 | 処置 | 判断理由 |
|---|---|---|
| [実行事実の記録](../../Definitions/ARCH-000018/architecture_definition.md) | New | 記録Effect、並行書込み、途中失敗、情報境界、結果不明時の再観測を読取りProjectionから分けて所有する |

## 5. SPEC観点との統合時に確認すること

- 対応候補: SPEC-000030
- UIが必要とする記録依頼、結果状態、同一試行の再観測、情報最小化および終了後条件がSPECで観測可能かを一つずつ照合する。
- 差分がある場合はArchitectureで補完せずUI／SPEC対応レビューへ戻す。

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
