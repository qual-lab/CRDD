# Topic・Meeting Lifecycleと正本への引渡しのArchitecture定義

成果物種別: Architecture定義
Architecture ID: `ARCH-000006`
状態: Canonical
維持責任者: Qual-Lab

## 1. 責務と境界

Topicの現在状態とMeetingの時点記録を分け、CRUD・終了・訂正・Outcome処置・安全な削除を一つのLifecycleで成立させる。候補作成・採否・所有正本更新・物理削除のAuthorityを分ける。

| 区分 | 内容 |
|---|---|
| 状態Owner | Domain ModelのTopic／Meeting責務。各成果物の状態はそれぞれのOwnerが所有する |
| 所有する責務 | Topic／MeetingのIdentity・改訂版・Relation・Lifecycle、Meeting Outcome処置、Action追跡先、安全な物理削除 |
| 所有しない責務 | Meeting本文の意味決定、候補の自動採用、各所有正本の内部規則、正当な履歴の物理削除 |
| 主な外部境界 | Meeting正本、Topic／Decision等の所有正本、人間判断 |

実装は`domain-model`の用途別Topic／Meeting APIへ統合する。共通部品はIdentity・改訂版・Relation・保存の整合を扱うが、Meeting Outcome、Topic現在状態、Project Taskを一つの汎用状態機械へまとめない。Workbench／MCPは同じ業務契約を利用し、保存の成功からGit Commit／Pushを自動発行しない。候補の採否と正本更新は人間の決定権限を維持する。

## 2. UI観点の入力

| UI分析 | 守る利用者向けの約束 |
|---|---|
| [UI-000009](../../Analysis/UI-000009/architecture_analysis.md) | Meeting・Topic・候補の処置 |

## 3. SPEC観点の入力

| SPEC分析 | 守る振る舞い契約 |
|---|---|
| [SPEC-000013](../../Analysis/SPEC-000013/architecture_analysis.md) | Meeting・Topicを維持し候補を所有正本へ昇格する |

## 4. 両観点の統合判断

入力ごとのState Owner、Authority、Effect、失敗およびLifecycleを次表で分ける。同じ責務に統合しても、読取り、分類、書込み、外部Effectまたは再接続を相互流用しない。

| 入力 | 観点 | State Owner | Authority | Effect／非該当 | Failure Boundary | Lifecycle |
|---|---|---|---|---|---|---|
| UI-000009 | UI | Project Operation Context | UI契約はAuthorityを発行しない。利用者操作: 登録／編集／一覧・取得／終了・訂正／候補化／採否／誤登録削除。 | UI契約はEffectを定義しない | 正当な履歴、関連対象またはRelation整合性を失う | 継続／終了／撤回／訂正、削除候補／確認待ち／削除済み、完了／部分成功／競合／不明 |
| SPEC-000013 | SPEC | Project Operation Context | 通常更新、候補採否、物理削除を分け、削除は影響表示後の人間による明示確認を必要とする | Topic／Meeting本文、Relation、候補処置、Action状態を更新し得る。物理削除では対象以外を連鎖削除しない | 競合改訂版、権限不足、部分更新、Relation不整合、削除結果不明を成功へ畳まない | Topic／Meeting→CRUD／Outcome処置／Action移管→終了後状態。正当な履歴は終了・撤回・訂正、誤登録だけ影響確認後に削除 |

## 5. 構造と依存方向

```text
[Architecture Responsibility]
├─ UI-000009 (UI)
   Topic／Meeting→関係・経緯→処置。削除時は影響→確認→結果→回復
└─ SPEC-000013 (SPEC)
   Topic／Meeting→CRUD／Outcome処置／Action移管→終了後状態
```

各入力はSibling contractであり、前の入力のAuthority、EffectまたはLifecycleを暗黙に継承しない。UI契約は利用者へ認識・操作・Feedbackを提供するが、AuthorityやEffectを発行しない。

## 6. データ・状態・Interface

入力が共有するIdentityとDataの関係は、このArchitecture責務が管理する。ただしState Owner、AuthorityおよびEffectは入力単位で分け、責務全体へ一律に拡張しない。

| 入力 | State Owner | Authority | Effect／非該当 |
|---|---|---|---|
| UI-000009 | Project Operation Context | UI契約はAuthorityを発行しない。利用者操作: 候補化する／比較する／採用・却下する。 | UI契約はEffectを定義しない |
| SPEC-000013 | Project Operation Context | 候補作成と採否判断を分け、正本更新は所有者の採用Authorityを必要とする | 候補記録を作成し、採用時だけ所有正本を更新する。却下時は正本Effect 0。 |

公開Interfaceは入力IDと対応する契約を保持し、別入力のAuthority、EffectまたはLifecycleを暗黙に継承しない。

## 7. 失敗・回復・観測

- UI-000009: 会議記録が自動的に正本へ昇格する Effect: UI契約はEffectを定義しない
- SPEC-000013: 文字列一致だけで統合・分割せず、会話を自動採用しない。 Effect: 候補記録を作成し、採用時だけ所有正本を更新する。却下時は正本Effect 0。

- 入力が固有Recoveryを定義しない場合、Architectureから追加しない。
- 結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める。

## 8. 品質・保護・運用

| 入力 | 保護する失敗境界 | 検証意図 |
|---|---|---|
| UI-000009 | 会議記録が自動的に正本へ昇格する | 正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。 |
| SPEC-000013 | 文字列一致だけで統合・分割せず、会話を自動採用しない。 | 正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。 |

共通品質を理由に、入力固有の失敗、非該当Effectまたは終了条件を一つの成功状態へまとめない。

### 未確認事項・人間判断・戻り条件

| 入力 | 継承する未確認事項 | 判断者 | 現在判定 | 再評価契機 |
|---|---|---|---|---|
| UI-000009 | REQ-000012: プロジェクト運営者／PMが「会議の内容を候補として整理し正本へつなぐ」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | プロジェクト運営者／PMを代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。 |
| SPEC-000013 | REQ-000012: プロジェクト運営者／PMが「会議の内容を候補として整理し正本へつなぐ」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | プロジェクト運営者／PMを代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。 |

Architecture固有の追加人間判断はない。これは入力の未確認事項を解消済みとする意味ではない。入力の利用者成果、振る舞い、Authority、Effectまたは失敗境界を変える必要が生じた場合は、その意味を所有するUI／SPEC工程へ戻す。

### 4.1 UI／SPEC Detailの配置制約

Detailは第2・3節のDefinition入力を置き換えず、その意味を実現する配置・操作・状態・観測の具体的制約として扱う。

| Detail Source | Source Definition | SCR／PRT／Interaction／BHV | Relation／N:N | Coverage | 未解決Gap／戻し先 |
|---|---|---|---|---|---|
| [SCR-000009／PRT-000009](../../../04_UI/Details/Areas/project-context/SCR-000009/screen.md) | UI-000009 | Screen／Partの配置、情報優先度、操作、FeedbackおよびState | Source UIとの直接Relation | Covered | v0.22固有LayoutはUI Detailへ戻す |
| [BHV-000013](../../../05_SPEC/Details/BHV-000013/behavior.md) | SPEC-000013 | Trigger、Authority、Validation、State、Effect、Result、FailureおよびRecovery | Source SPECとの直接Relation | Covered | Behavior意味の変更はSPEC Detailへ戻す |

担当Interaction Relation: `PRT-000009.spec-000013`

全体の逆引きと詳細設計領域への配置は[UI／SPEC Detail Architecture Traceability](../../08_UI_SPEC_Detail_Traceability.md)を中央統合投影とし、本定義は上記RelationのArchitecture責務を局所所有する。

## 9. 互換性・移行・成立済み能力

| 基準版Capability | 旧Owner／現行照合先 | 新Owner | 保持状態 | Evidence | Gap／移行 |
|---|---|---|---|---|---|
| 基準版なし | なし（v0.22新規） | Project Operation Context | 新規 | 実装Evidence未作成 | 候補SchemaとOwner Adapterが未接続 |

現行設計はこの比較だけに使い、UI／SPECにない望ましい意味を補わない。新規責務は基準版能力や実装Evidenceが存在するように表示しない。

## 10. 実装と検証への引き渡し

- 実装はTopic／Meeting本文、改訂版、Relation、Outcome処置および削除結果を一つの整合境界で扱うCoreと、Repository I/Oや外部入口を扱うPort／Adapterを分ける。
- 観測→候補→判断→採用時だけ所有正本へ引渡しを段階的な結合試験で確認する。
- Meeting本文のコピー、出所喪失、自動採用、未処置OutcomeのままのClose、確認なし削除、暗黙の連鎖削除、dangling relationを理由別に反証する。
- Process Recoveryは非該当。引渡し失敗は候補状態を保持して再判断可能にする。

## 11. 情報源と現行照合

正式入力は第2・3節のArchitecture分析だけである。次は成立済み能力とGapを照合するためにだけ参照する。

- [現行照合先](../../Details/project-operation/01_Architecture.md)

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
- OPEN: 基本責務と検証意図は提示済み。新Ownerの詳細API・利用側対応は段階3で確認する — DetailsへのHandoffを明示した
- [x] Qualityへ渡すVerification Intentを明示した
- [x] 現行Sourceや実装構造から意味を逆輸入していない
- [x] 上流の観測可能な振る舞いをArchitectureで変更していない
