# SPEC-000013 Meeting・Topicを維持し候補を所有正本へ昇格する

成果物種別: SPEC定義
SPEC ID: `SPEC-000013`
状態: Canonical
維持責任者: Qual-Lab

## 振る舞いの目的

TopicとMeetingを同じApplication Capabilityから登録・編集・取得・一覧・終了・訂正し、MeetingのDecision／Action／更新候補を処置先へ接続する。正当な履歴を保ち、誤登録だけを影響確認後に物理削除する。

## UX観点の分析結果

| UX分析 | 保持する利用者成果 |
|---|---|
| [UX-000014](../../Analysis/UX-000014/spec_analysis.md) | Meeting内容を候補化し採否を判断する |
| [UX-000033](../../Analysis/UX-000033/spec_analysis.md) | TopicとMeetingを一通り扱い、正当な履歴を残して誤登録だけを安全に除く |

## IA観点の分析結果

| IA分析 | 保持する情報構造 |
|---|---|
| [IA-000010](../../Analysis/IA-000010/spec_analysis.md) | Meeting・Topic・候補・採否 |

## 両観点の統合判断

Meetingの項目を継続論点または決定候補として扱う時、観察・仮説・候補・決定を区別し、既存Topicとの関係と採否を記録して所有正本へ反映する。

## 契機・事前条件・Authority

| 項目 | 契約 |
|---|---|
| 契機 | Topic／Meetingの登録・変更・参照・終了・訂正・削除、またはMeeting Outcomeの処置を選ぶ時 |
| 事前条件 | 対象Identity、Owner Repository、現在改訂版、Relation、操作Authorityを確認できる |
| Authority | 通常更新、候補採否、物理削除を分ける。削除は影響表示後の人間による明示確認を必要とする |
| 判定不能 | 不足を既定値で補完せず、新しいEffectを発行せず現在状態と未解消義務を保持する |

## 振る舞い・状態・結果

```text
[Topic／Meeting] -> [登録／編集／取得／一覧]
       │
       ├ Meeting Outcome -> [完了／Action／Topic／CHG／Owner正本／不採用]
       │                         └ 全件処置後にMeeting Close
       ├ 正当な履歴 -> [終了／撤回／訂正]
       └ 誤登録 -> [影響表示] -> [明示確認] -> [Relation整合＋物理削除]
```

- 振る舞い: Topicの現在状態とMeetingの時点記録を区別し、入口を変えても同じLifecycleと終了後状態を返す。
- 成功条件: Meeting候補を全件処置し、未完了Actionは担当・期限・完了条件・追跡先を確定してMeetingを閉じられる。
- Actionの継続的な調査・判断はTopicへ、採用済み変更はCHGへ接続し、Meeting当時の記録を現在状態で上書きしない。

## 失敗・回復・副作用

- 失敗: 競合改訂版、権限不足、部分更新、Relation不整合、削除結果不明を成功へ畳まない。文字列一致だけで統合・分割せず、会話を自動採用しない。
- 副作用: Topic／Meeting本文、Relation、候補処置、Action状態を更新し得る。物理削除では対象以外を連鎖削除しない。
- 回復: 部分成功では本文・Relation・処置結果の既知状態を返し、同じ対象を再観測する。削除前後のRelation整合を確認できなければ完了にしない。

## 受入条件と検証義務

| 観点 | 受入条件 |
|---|---|
| 正常 | Topic／Meetingの全操作とOutcome処置を同じ正本・Lifecycleで行い、Ownerと終了後状態を辿れる |
| 境界 | Topic／Meeting、時点記録／現在状態、終了／撤回／訂正／削除、未完了Action／未処置Outcomeを分ける |
| 失敗 | 競合・権限不足・部分成功・Relation不整合を隠さず、確認なしの物理削除と暗黙の連鎖削除を行わない |
| 観測不能 | 結果不明を完了へ丸めず既知の本文・Relation・処置状態と再観測先を返す |
| 対応UI | [UI-000009](../../../04_UI/Definitions/UI-000009/ui_definition.md)の操作・Feedbackと契機・結果・失敗が一致する |

## 対応するUI

- pairs_with: [UI-000009](../../../04_UI/Definitions/UI-000009/ui_definition.md)

## 制約

- 物理削除では対象以外を連鎖削除しない。
- API、Process、保存方式、画面、部品または実装技術を本定義で確定しない。現行実装は独立した照合対象であり、望ましい振る舞いの根拠として自動採用しない。

## 未確認事項・人間判断・戻り条件

正式入力に残る未確認事項を、解消済みとみなさず次のとおり継承する。

### UX-000014から継承する確認事項

正式入力: [UX-000014](../../../02_UX/Definitions/UX-000014/ux_definition.md)

未確認事項は、統合元の要求ごとに次を保持する。

- REQ-000012: プロジェクト運営者／PMが「会議の内容を候補として整理し正本へつなぐ」を行う際の判断基準、許容負担、利用環境および失敗後の選択
- 現在判定: 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。
- 確認事項: REQ-000012: プロジェクト運営者／PMが「会議の内容を候補として整理し正本へつなぐ」を行う際の判断基準、許容負担、利用環境および失敗後の選択
- 判断者: プロジェクト運営者／PMを代表する利用者とQual-Lab。
- 未確認時の影響: 利用者成果、重要場面、失敗および品質期待を仮説として保持し、定量条件や実現方式を確定しない。
- Discoveryへ戻す条件: 想定した利用者、問題、望ましい変化または制約が誤っていると判明した場合。
- UX分析へ戻す条件: 利用場面、目的、得られる結果、重要場面、失敗または品質期待の統合判断が変わる場合。

再評価契機: 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。

### IA-000010から継承する確認事項

正式入力: [IA-000010](../../../03_IA/Definitions/IA-000010/ia_definition.md)

| 入力UX | UXから継承する確認事項 | 判断者 | 現在判定 | 未確認時の影響 |
|---|---|---|---|---|
| UX-000014 | REQ-000012: プロジェクト運営者／PMが「会議の内容を候補として整理し正本へつなぐ」を行う際の判断基準、許容負担、利用環境および失敗後の選択 | プロジェクト運営者／PMを代表する利用者とQual-Lab。 | 後続の実利用確認が必要。現在のUX定義をCanonical化する判断を止める事項ではない。 | 利用者成果、重要場面、失敗および品質期待を仮説として保持し、定量条件や実現方式を確定しない。 |

IA固有の追加人間判断はない。これは入力UXの未確認事項が解消済みという意味ではない。正式入力にないObject、情報境界、所有責任または状態を追加する必要が生じた場合は人間の決定権限者へ戻す。UI／SPEC分析またはQuality Analysis / IAで対象・同一性・関係・状態・可視性・時間的な意味の不足または競合が判明した場合はIAを再開する。

再評価契機: 対象利用者による実利用確認、前提変更、または後続工程でこの未確認事項が成立条件へ影響すると判明した時。

### SPEC固有の追加判断

現時点で追加の判断事項はない。これは上記の継承事項が解消済みという意味ではない。正式入力の意味、対応関係または成立条件に不足・競合が見つかった場合は、その意味を所有するUX／IAへ戻す。

## 検証意図

正常、境界、失敗、判断不能および対応関係を、具体的な試験手順を先取りせず観測可能な意味で確認する。

## 補足定義

なし。

## 正式入力と変換根拠

- 正式入力: [UX-000014](../../../02_UX/Definitions/UX-000014/ux_definition.md)
- 正式入力: [UX-000033](../../../02_UX/Definitions/UX-000033/ux_definition.md)
- 正式入力: [IA-000010](../../../03_IA/Definitions/IA-000010/ia_definition.md)

次の分析記録は正式入力をこの工程の観点へ変換した根拠であり、正式入力そのものではない。

- 変換根拠: [UX-000014のSPEC分析](../../Analysis/UX-000014/spec_analysis.md)
- 変換根拠: [UX-000033のSPEC分析](../../Analysis/UX-000033/spec_analysis.md)
- 変換根拠: [IA-000010のSPEC分析](../../Analysis/IA-000010/spec_analysis.md)
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
