# BHV-000013 TopicとMeetingを維持し後続へ接続する

成果物種別: SPEC Detail
Behavior ID: `BHV-000013`
状態: Canonical
維持責任者: Qual-Lab

## 1. 目的とSource Definition

- 目的: Topic／Meetingの一通りの操作、Outcome処置、終了・訂正および影響確認付き削除を同じLifecycleで成立させる。
- Source SPEC: [SPEC-000013](../../Definitions/SPEC-000013/spec_definition.md)
- 対象利用側: UI-000009
- 対象外: Source SPECにない画面、実装技術、追加Authorityまたは新しい利用者成果

## 2. Detailed Behavior

| 観点 | 判定 | 契約／理由 |
|---|---|---|
| Trigger | Applicable | 登録・編集・取得・一覧・終了・訂正・削除、またはMeeting Outcome処置を選ぶ時 |
| Precondition | Applicable | 対象Identity、Owner Repository、現在改訂版、Relation、操作Authorityを確認できる。Remote CROSでは対象Repositoryを明示指定し、現在SessionのCredential、Workspace Grant、ExposureおよびRepository BindingをRequestごとに再確認する |
| Authority | Applicable | 通常更新、候補採否、物理削除を分け、削除前に人間の明示確認を得る。Repository IDの指定だけではAuthorityを生成しない |
| Input | Applicable | 対象Repository、Topic／Meeting本文、記録時点、Relation、Decision／Action／候補、削除影響。Repository単体では対象Repository入力を要求しない |
| Validation | Applicable | 前提条件、Authority、対象Identity、入力完全性および現在性をEffect前に確認する |
| State／Transition | Applicable | 継続／終了／撤回／訂正、候補処置、Action追跡、削除候補／確認待ち／削除済みを区別する |
| Sequence | Applicable | Trigger→Precondition／Authority／Validation→State／Effect→Resultの順を保つ |
| Effect | Applicable | Topic／Meeting、Relation、候補処置、Action状態を更新し得る。削除対象外は連鎖削除しない |
| Output | Applicable | Owner、現在状態、時点記録、Relation、処置結果、終了後状態を返す |
| Failure | Applicable | Repository未選択、Grant／Exposure外、競合・権限不足・部分成功・Relation不整合・結果不明を成功へ畳まず、Remote失敗時にLocal Repositoryへfallbackしない |
| Recovery | Applicable | 既知の本文・Relation・処置状態を返し、同じ対象を再観測する |

## 3. Behavior Flow

```text
[Topic／Meeting] -> [登録／編集／取得／一覧]
       ├ [Outcome全件処置] -> [Meeting Close＋Action追跡]
       ├ [終了／撤回／訂正]
       └ [誤登録] -> [影響表示] -> [明示確認] -> [Relation整合＋削除]
```

判定不能時: 不足を既定値で補完せず、新しいEffectを発行せず現在状態と未解消義務を保持する

## 4. UI Detail対応

| SCR／PRT／Interaction | 表示・操作する意味 | Result／Failure／Recovery | Coverage |
|---|---|---|---|
| [SCR-000009／PRT-000009.spec-000013](../../../04_UI/Details/Areas/project-context/SCR-000009/screen.md) | Meeting内容を候補化し所有正本へ昇格するの操作・状態・結果を利用者へ示す | Success／Reject／Failure／Unknown／Recovery | Covered |

## 5. Verification Intent

| Condition | 観測可能な成立／不成立 | Qualityへの引き渡し |
|---|---|---|
| Normal | 一通りの操作とOutcome処置が同じ正本・Lifecycleへ到達する | Source SPECと同じ正常義務へ統合 |
| Boundary | 時点記録／現在状態、終了／撤回／訂正／削除、未完了Action／未処置Outcomeを区別する | 境界条件を独立観測する |
| Failure | 競合、部分成功、Relation不整合、確認なし削除を防ぐ | 失敗を成功・未実行・不存在へ畳まない |
| Unknown | 不足を既定値で補完せず、新しいEffectを発行せず現在状態と未解消義務を保持する | 観測不能を正常値へ畳まず再観測可能にする |
| Recovery | 既知の本文・Relation・処置状態と再観測先を返す | Relation整合と終了後状態を確認する |

## 6. Architectureへの引き渡し

- 保持すべきBehavior Contract: Trigger、Authority、対象Identity、Validation、Effect、Result、FailureおよびRecoveryを分離する。
- 配置を固定してはならない事項: Process、Transport、保存方式、Class、FunctionおよびFrontend／Backend分割。
- Architectureで決める事項: ARCH-000006がComponent、Boundary、Data／State Owner、Failure Boundaryおよび実行環境への配置を所有する。

## 7. 未確認事項・戻り条件

| 項目 | 現在状態 | Owner | 影響 | 戻り条件／再評価契機 |
|---|---|---|---|---|
| 実装配置 | N/A | Architecture工程 | BHVの意味契約には影響しない | Architecture Detailで配置する時 |
| 実利用条件 | OPEN | Source SPECのOwner | 定量条件と利用頻度は未固定 | 対象利用者の実利用確認または前提変更時 |

## 補足分析

Source SPECの観測可能な意味を詳細化した。ArchitectureまたはSource実装から新しい意味を逆輸入していない。

## Checklist

- [x] 独立したTriggerまたはResultを持つ
- [x] Source SPECへ接続した
- [x] TriggerからRecoveryまで全観点を評価した
- [x] N/Aに理由、OPENにOwner・影響・戻り条件を記録した
- [x] Normal、Boundary、Failure、UnknownおよびRecoveryを評価した
- [x] UI認識が必要な結果をUI Detailへ接続した
- [x] Architecture方式やSource実装を先取りしていない
- [x] 新しいUX Outcome、IA Object、UI PresentationまたはAuthorityを創作していない
