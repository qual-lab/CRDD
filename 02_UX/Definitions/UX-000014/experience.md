# UX-000014 Meeting内容を候補化し採否を判断する

成果物種別: UX Definition
UX ID: `UX-000014`
状態: Canonical
維持責任者: Qual-Lab

## 利用者成果

会話・観察・仮説・候補・決定を区別し、既存Topicとの関係を根拠付きで判断して所有正本へ戻せる

```text
Project Operator／PM
        │ Meeting後に決定・Topic・Actionを整理する時
        ▼
会議の内容を候補として整理し正本へつなぐ
        │
        ▼
会話と採用判断を混同せず仕事を継続できる
```

## 利用者・状況・Goal

| 項目 | 内容 |
|---|---|
| Primary Persona／Context | [Product横断の利用者像](../../02_Personas.md)の「Project Operator／PM」 |
| Trigger／Situation | Meeting後に決定・Topic・Actionを整理する時 |
| Goal | 会議の内容を候補として整理し正本へつなぐ |
| Outcome | 会話と採用判断を混同せず仕事を継続できる |

## 成立条件

- 会話・観察・仮説・候補・決定を区別し、既存Topicとの関係を根拠付きで判断して所有正本へ戻せる
- 重要場面「候補を採用または却下する場面」で、避ける失敗を利用者が正常状態や完了として誤認しない。
- 入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。

## 重要な体験と品質期待

```text
Meeting後に決定・Topic・Actionを整理する時
        ↓
会議の内容を候補として整理し正本へつなぐ
        │
        ├─ ★ Critical: 候補を採用または却下する場面
        ├─ ⚠ Failure:  会議記録が自動的に正本へ昇格する
        └─ ✓ Quality:  候補・判断・反映結果を区別する
        ↓
会話と採用判断を混同せず仕事を継続できる
```

## 必要な情報

Meeting Item、Candidate、Topic Relation、Decision、Ownerを結ぶ

## 制約

- 画面、Transport、内部Componentまたは特定の実装方式をUX成果そのものにしない。
- 下流工程は利用者成果を弱めず、情報構造、操作、振る舞いおよび実現方式へ具体化する。
- 想定した利用者、状況またはGoalが誤っていると判明した場合は、Source AnalysisとDiscoveryへ戻す。

## 検証意図

会話の自動採用と文字列一致だけの統合・分割を反証する

具体的なTest Level、Scenarioおよび期待結果はQualityで設計し、このDefinitionには実行結果を書き込まない。

## 下流への引き渡し

IAはMeeting、Topic、Candidate、DecisionおよびSource Relationを分ける。Communicationは外部表現への昇格を別判断とし、UI／SPECは候補比較と採用を別操作にする。

## 関係

- Source REQ Analysis: [REQ-000012](../../Analysis/REQ-000012/ux_analysis.md)
- Cross-cutting Synthesis: [Personas](../../02_Personas.md)、[Experience Map](../../03_Experience_Map.md)、[Service Blueprint](../../04_Service_Blueprint.md)、[Quality Expectations](../../05_Quality_Expectations.md)

