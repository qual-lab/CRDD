# REQ-000012の利用者体験分析

状態: Candidate
要求: `REQ-000012` Meetingから候補を経た正本更新
探索元: [TopicとMeetingの継続](../../../01_Discovery/Explorations/EXP-000023_Topic_and_Meeting_Continuity/exploration.md)

## 1. なぜこの要求を体験として扱うのか

会議で生まれた決定や論点が議事録に閉じると、後の仕事へ届かない。反対に、AIが会話から正本を直接更新すると、候補と採用判断が混ざる。

## 2. 利用者に起きる変化

| 利用前 | 利用後 |
|---|---|
| 過去の議事録を探して論点の経緯を再構成する | Topicから関連Meeting、調査、Decision、CHGを時間順に辿る |
| 会議内容の転記か自動反映の二択になる | 更新候補を比較し、所有正本の決定権限へ戻す |

## 3. UXへの処置

`UX-000004@1`「所有正本へ戻る候補操作」として扱う。`Topic化`や`Decision候補化`は便利な入口だが、それ自体を採用結果にしない。

## 4. 重要場面、失敗、品質期待

- 生Transcript、観察、仮説、決定候補、採用済み判断を区別する。
- 既存TopicとのSame／Newを判断できる根拠を示す。
- 候補の採用先、変更内容、決定権限者が分かる。
- 利用不能なMeeting内容を推測して経緯を埋めない。

## 5. 下流への引き渡し

IAはMeeting、Topic、Candidate、DecisionおよびSource Relationを分ける。Communicationは外部表現への昇格を別判断とし、UI／SPECは候補比較と採用を別操作にする。
