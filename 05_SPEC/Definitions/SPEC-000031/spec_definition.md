# SPEC-000031 Repository差分を選びCommit・通常Pushする

成果物種別: SPEC定義
SPEC ID: `SPEC-000031`
状態: Canonical
維持責任者: Qual-Lab

## 振る舞いの目的

検証済みRepositoryの作業差分から変更集合を選び、Commitを作成し、確認済みの設定済みUpstreamへ通常Pushする。

## UX観点の分析結果

| UX分析 | 保持する利用者成果 |
|---|---|
| [UX-000034](../../Analysis/UX-000034/spec_analysis.md) | Projectの意味と作業差分を結び、共有対象を取り違えず通常Pushまで進む |

## IA観点の分析結果

| IA分析 | 保持する情報構造 |
|---|---|
| [IA-000007](../../Analysis/IA-000007/spec_analysis.md) | 履歴管理状態、変更差分、変更集合、外部共有対象および操作結果 |

## 両観点の統合判断

Project判断に対応する検証済みRepositoryで、TreeとDiffを観測し、利用者が選んだ変更だけをStage／Unstageし、Commit後にRemote・Branch・送信Commitを確認して通常Pushする。要求発行、受理、Remote反映および終了後状態を区別する。

## 契機・事前条件・Authority

| 項目 | 契約 |
|---|---|
| 契機 | 利用者が作業差分を確認して共有を選ぶ時 |
| 事前条件 | Repository Root、Branch、HEAD、Tree状態、Diff、Remote、Upstreamを観測できる |
| Authority | Stage、Unstage、Commit、Pushは人間の選択に基づく。Pushは送信対象の明示確認を必要とする |
| 判定不能 | Repository、Remote、Branch、送信CommitまたはAuthorityが不明なら外部Effect 0で停止する |

## 振る舞い・状態・結果

```text
[Tree観測]
   ↓
[差分選択] ── Stage／Unstage ──▶ [変更集合]
   ↓
[Commit作成]
   ↓ Remote・Branch・Commit確認
[通常Push要求] ─▶ [受理／拒否／不明] ─▶ [終了後観測]
```

- Staged、Unstaged、Untracked、Conflictを区別する。
- Commit作成とRemote反映を同一視しない。
- Push拒否、認証失敗、通信断、状態不明を成功へ畳まない。

## 失敗・回復・副作用

- 失敗: Conflict、無効な差分選択、Commit失敗、Push拒否、認証失敗、Remote結果不明。
- 副作用: Stage領域、Commit、Remote Branchを順に変更し得る。各Effectの成立を別々に観測する。
- 回復: 既知のTreeとCommitを保持し、再観測後に利用者が再試行または別入口を選べるようにする。自動Force Pushは行わない。

## 受入条件と検証義務

| 観点 | 受入条件 |
|---|---|
| 正常 | 選択差分だけをCommitし、確認したRemote・Branch・Commitを通常Pushして終了後状態を返す |
| 境界 | 空変更、Untracked、Conflict、Upstreamなし、Remote差分ありを区別する |
| 失敗 | 誤対象を送らず、部分成立と結果不明を成功表示しない |
| 観測不能 | Push結果を確認できなければ再送せず、既知状態と再観測先を返す |
| 対応UI | [UI-000006](../../../04_UI/Definitions/UI-000006/ui_definition.md)のTree・Diff・Stage・Commit・Push確認と一致する |

## 対応するUI

- pairs_with: [UI-000006](../../../04_UI/Definitions/UI-000006/ui_definition.md)

## 制約

Force Push、Branch作成、Merge、RebaseおよびRemote設定管理は対象外とする。Version Control実装は差替可能な境界とし、Git CLIへの直接依存を本定義で固定しない。

## 未確認事項・人間判断・戻り条件

### UX-000034から継承する確認事項

正式入力: [UX-000034](../../../02_UX/Definitions/UX-000034/ux_definition.md)

- 部分Stage、Large Repository、認証失敗時の負担、既存Toolとの比較価値をWorkbench Pilotで確認する。
- 判断者: 開発者、Project運営者／PM、Qual-Lab。
- 未確認時の影響: 性能条件、高度な操作、確認UIを確定しない。

### IA-000007から継承する確認事項

正式入力: [IA-000007](../../../03_IA/Definitions/IA-000007/ia_definition.md)

Git Commitを業務Identityにせず、要求、受理、終了後観測の時点差を維持する。情報構造が不足する場合はIAを再開する。

### SPEC固有の追加判断

通常Pushの確認負担はPilotで評価する。対象外操作が必要になればDiscoveryへ戻す。

## 検証意図

正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。

## 補足定義

なし。

## 正式入力と変換根拠

- 正式入力: [UX-000034](../../../02_UX/Definitions/UX-000034/ux_definition.md)
- 正式入力: [IA-000007](../../../03_IA/Definitions/IA-000007/ia_definition.md)

次の分析記録は正式入力をこの工程の観点へ変換した根拠であり、正式入力そのものではない。

- 変換根拠: [UX-000034のSPEC分析](../../Analysis/UX-000034/spec_analysis.md)
- 変換根拠: [IA-000007のSPEC分析](../../Analysis/IA-000007/spec_analysis.md)

## Checklist

- [x] UX DefinitionとIA Definitionを正式入力とし、各分析記録を変換根拠として処置した
- [x] UX OutcomeとIA Information Contractを保持した
- [x] Actor・Authority、Trigger、PreconditionおよびInput Validationを評価した
- [x] Current State、Behavior、ResultおよびState Transitionを定義した
- [x] Failure・Error、Retry・Recovery、Cancel・UndoおよびSide Effectを評価した
- [x] ConstraintとNon-goalを評価した
- [x] Human Inputの必要性を評価した
- [x] Open・GapとOwner工程へ戻す条件を明示した
- [x] Verification Intentを明示した
- [x] 対応するUIとのRelationを明示した
- [x] UI Presentation、Architecture方式またはSource実装を先取りしていない
- [x] 結果を観測可能な契約として定義した
- [x] 補足定義へ必須情報を退避していない
