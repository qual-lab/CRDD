# Topic／Meeting Record Contract検証結果

検証対象: `CHG-000082 Phase 2 — Read-only Project Surface`

## 結論

Topic／MeetingのLifecycleから実装を推測せず、Repository保存形式、統制状態、Meeting Outcome Close不変条件およびConsumer Reader契約をArchitecture DetailsとTemplateへ固定した。`CPR-IT-008`の直接境界試験では、Topic現在状態とMeeting時点記録を別Modelとして読めること、pending Outcomeを持つMeetingをclosedとして受理しないことを確認した。

これはReaderとRecord Contractの局所成立であり、Topic／Meetingの永続CRUD、Relation Store、Outcome移管、候補採否および物理削除の成立を意味しない。

## 固定した契約

- Topic: `22_Topics/TOPIC-xxxxxx/topic.md`
- Meeting: `23_Meetings/MTG-xxxxxx/meeting.md`
- Topic状態: `open`、`waiting`、`promoted`、`closed`
- Meeting状態: `recorded`、`closed`、`corrected`
- Outcome状態: `pending`、`completed`、`transferred`、`promoted`、`rejected`
- Meeting Close: pending Outcome 0件。未完了Actionは追跡先へ移管済み

## 実行結果

| 確認 | 結果 | 観測 |
|---|---|---|
| Project Operation format | Pass | Biome formatを適用 |
| Project Operation type／lint | Pass | TypeScriptとBiome lintが成功 |
| Project Operation integration | Pass | 7件成功。Topic／Meeting Reader 2件を含む |
| Topic／Meeting区別 | Pass | waiting Topicとrecorded Meetingを別Modelで保持 |
| Meeting Close反例 | Pass | closed＋pending Outcomeを`meeting_record_pending_outcome`で拒否 |
| 正本Effect | 0 | Reader試験は入力文字列だけを扱う |

## 未完了

- Repository StoreとAtomic Update
- 登録、編集、取得、一覧、終了、訂正
- Outcome／Action移管とRelation整合
- 影響確認付きの誤登録削除
- Workbench／MCPからの実操作

## Checklist

- [x] 保存方式をArchitecture Detailsへ戻してから実装した。
- [x] TopicとMeetingを同じ状態Modelへ畳んでいない。
- [x] Meeting時点記録をTopic現在状態で上書きしていない。
- [x] pending OutcomeをClose済みへ畳んでいない。
- [x] 局所Reader成立をCRUD全体の完成へ読み替えていない。
