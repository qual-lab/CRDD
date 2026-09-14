# REQ-000012 Meetingから候補を経た正本更新

成果物種別: Discovery Definition
要求ID: `REQ-000012`
Discovery判断: 要求採用
判断する人: Qual-Lab

## 要求

Meetingから得た論点、判断または更新内容は候補として既存Contextと照合し、人間の確認後にだけTopicまたは所有正本へ反映しなければならない。

## 対象と利用状況

会議やChatで生じた論点、判断候補、宿題を、後のTopicやCRDD正本へつなぐ参加者・運用者の場面。

## 解く問題と望ましい変化

```text
現在: Meeting、継続Topic、正式正本を同じものとして扱うと、時点記録を上書きするか、議事録に論点を置き去りにする。
    ↓
望ましい変化: Meetingから候補を作り、既存Contextと照合し、人間確認後にだけTopicまたは所有正本へ反映する。
```

## 採用理由と比較

Meetingからの自動更新はAuthorityを飛ばし、媒体別分類は意味を分断するため、目的別の候補Promotionを採る。

## 成立条件

- Meetingの時点記録を保ったまま候補を抽出できる
- 既存Topicへの統合、新規Topic、正式正本更新、不採用を人間が区別できる
- 採用後は所有正本を更新し、候補やProjectionを第二正本にしない

## 制約

- 生Transcriptを正式正本として扱わない
- 既存Contextへ一意に戻せる内容へ新Topicを乱造しない

## 検証意図

既存Topicと重複する候補、新規論点、決定候補、不採用候補を処理し、時点記録、判断、正本反映を観測する。

## 工程引渡し

| 引渡し先 | 失ってはならない意味 | 下流で決めること |
|---|---|---|
| UX | 会議参加者・Context運用者、会議後の整理、論点が継続して次の仕事へ届く変化、確認負担をUXへ渡す。 | Goal、独立Outcome、重要場面、失敗、体験品質 |
| IA以降 | 本要求のIdentity、状態、関係、制約、反証条件 | 各工程固有の情報構造、操作、振る舞い、検証 |

## 関係

- Source Analysis: [EXP-000023](../../Analysis/EXP-000023/exploration.md)
- Formal downstream input: UXは本Definitionを一次入力として分析し、判断理由の再確認が必要な場合だけSource Analysisへ戻る。
