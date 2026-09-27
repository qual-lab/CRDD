# BHV-000031 Repository差分を選びCommit・通常Pushする

成果物種別: SPEC Detail
Behavior ID: `BHV-000031`
状態: Canonical
維持責任者: Qual-Lab

## 1. 目的とSource Definition

- 目的: 検証済みRepositoryの差分から利用者が変更集合を選び、Commitを作成し、確認済みのUpstreamへ通常Pushする。
- Source SPEC: [SPEC-000031](../../Definitions/SPEC-000031/spec_definition.md)
- 対象利用側: UI-000006
- 対象外: Force Push、Branch作成、Merge、Rebase、Remote設定管理およびGit固有実装の固定

## 2. Detailed Behavior

| 観点 | 判定 | 契約／理由 |
|---|---|---|
| Trigger | Applicable | 利用者が観測済みの作業差分から共有する変更を選ぶ時 |
| Precondition | Applicable | Repository Root、Branch、HEAD、Tree、Diff、RemoteおよびUpstreamを観測できる |
| Authority | Applicable | Stage、Unstage、Commit、Pushは人間の選択に基づき、Push直前にRemote・Branch・送信Commitを確認する |
| Input | Applicable | 検証済みRepository、選択差分、Commit内容、Remote、Branch、送信Commit |
| Validation | Applicable | 対象、差分、Conflict、Upstream、Authorityおよび送信対象を各Effect前に検証する |
| State／Transition | Applicable | Tree観測→差分選択→Stage／Unstage→Commit→Push確認→通常Push→終了後観測を区別する |
| Sequence | Applicable | Commit成立前にPushせず、Push要求、受理、Remote反映および終了後観測を分ける |
| Effect | Applicable | Stage領域、Local Commit、Remote Branchを順に変更し得る。各Effectを個別に観測する |
| Output | Applicable | 選択差分、Commit結果、Push対象、受理／拒否／不明および終了後状態を同じContextで返す |
| Failure | Applicable | Conflict、空変更、Commit失敗、Push拒否、認証失敗、通信断および結果不明を成功へ畳まない |
| Recovery | Applicable | 既知のTreeとCommitを保持し、再観測後に利用者が再試行または別入口を選ぶ。自動再送やForce Pushを行わない |

## 3. Behavior Flow

```text
[Tree／Diff観測]
        ↓
[差分選択] ── Stage／Unstage ──▶ [変更集合]
        ↓
[Commit作成]
        ↓ Remote・Branch・送信Commitを確認
[通常Push要求]
        ├─ 拒否／失敗／不明 → 再送せず既知状態と再観測先
        └─ 受理             → Remote反映と終了後状態を観測
```

判定不能時: Repository、Remote、Branch、送信CommitまたはAuthorityを推測せず、未発行の外部Effectを0に保つ。

## 4. UI Detail対応

| SCR／PRT／Interaction | 表示・操作する意味 | Result／Failure／Recovery | Coverage |
|---|---|---|---|
| [SCR-000006／PRT-000006.spec-000031](../../../04_UI/Details/Areas/project-context/SCR-000006/screen.md) | TreeとDiffを確認し、Stage／Unstage、Commit、通常Pushを選ぶ | Success／Reject／Failure／Unknown／Recovery | Covered |

## 5. Verification Intent

| Condition | 観測可能な成立／不成立 | Qualityへの引き渡し |
|---|---|---|
| Normal | 選択差分だけをCommitし、確認したRemote・Branch・Commitを通常Pushして終了後状態を返す | 各Effectを別々に観測する |
| Boundary | 空変更、Untracked、Conflict、Upstreamなし、Remote差分ありを区別する | 境界条件を独立観測する |
| Failure | 誤対象を送らず、部分成立と結果不明を成功表示しない | 外部Effectと結果搬送を分ける |
| Unknown | Push結果を確認できなければ再送せず、既知状態と再観測先を返す | 観測不能を未実施や成功へ畳まない |
| Recovery | 同じRepositoryとCommitを再観測し、人間が次の操作を選ぶ | 自動Force Pushと暗黙の再送を反証する |

## 6. Architectureへの引き渡し

- 保持すべきBehavior Contract: 読取り、Stage、Commit、PushのAuthority、Effect、結果および失敗境界を分離する。
- 配置を固定してはならない事項: Git CLI、Process、Transport、Class、FunctionおよびFrontend／Backend分割。
- Architectureで決める事項: ARCH-000009が差替可能なVersion Control Port、外部Remote境界、状態Owner、Effect確認および結果搬送を所有する。

## 7. 未確認事項・戻り条件

| 項目 | 現在状態 | Owner | 影響 | 戻り条件／再評価契機 |
|---|---|---|---|---|
| 部分Stageと大規模Repositoryの操作負担 | OPEN | UI／SPEC工程Owner | 定量性能と確認UIは未固定 | Workbench Pilotで実利用を確認した時 |
| 対象外の高度な履歴操作 | N/A | Discovery工程Owner | 本BHVの通常Push契約には影響しない | Force Push、MergeまたはRebaseが必要になった時 |

## 補足分析

Source SPECの観測可能な意味を詳細化した。CommitとPushを一つの成功状態へまとめず、実装方式を逆輸入していない。

## Checklist

- [x] 独立したTriggerまたはResultを持つ
- [x] Source SPECへ接続した
- [x] TriggerからRecoveryまで全観点を評価した
- [x] N/Aに理由、OPENにOwner・影響・戻り条件を記録した
- [x] Normal、Boundary、Failure、UnknownおよびRecoveryを評価した
- [x] UI認識が必要な結果をUI Detailへ接続した
- [x] Architecture方式やSource実装を先取りしていない
- [x] 新しいUX Outcome、IA Object、UI PresentationまたはAuthorityを創作していない
