# Phase 5 — Topic／Meeting Collection／Detail閉包

検証日時: 2026-09-28 00:31 JST
対象変更: `CHG-000082`
対象実装: `40_Develop/project-operation`、`40_Develop/workbench`

## 結論

Topic ListとMeeting Listに必要な検索・絞込み・安定並び順・継続読込を共通Applicationへ実装し、Workbenchから同じ条件を利用できる状態にした。Topic／Meetingは一覧内の展開領域だけでなく、安定IDで開く独立Detailを持ち、同じRevisionのMetadata、現在要約、Canonical Markdownおよび処置入口へ到達できる。

```text
Topic／Meeting Canonical Markdown
              ↓
Project Operation Application
  ├─ Query／Filter／Sort
  ├─ Query拘束Cursor
  └─ Stable ID Detail
              ↓
Workbench
  ├─ Collection Controls
  ├─ Continuation
  └─ Independent Detail
```

## 成立した内容

| 対象 | 成立した内容 | 保持した境界 |
|---|---|---|
| Topic List | ID・名称・要約検索、状態・Owner・Relation絞込み、ID・名称・状態順、20件単位の継続読込 | Relationは安定IDだけを受け、任意Pathや正規表現として評価しない |
| Meeting List | ID・名称・要約検索、状態・期間・Relation・未処置Outcome絞込み、新しい順・ID・名称順、20件単位の継続読込 | 日付境界とpending OutcomeはCanonical Recordから判定する |
| Cursor | Query条件と並び順を署名内容へ含め、異なる条件への再利用を拒否 | 条件変更後の重複・欠落を旧Cursorで隠さない |
| Topic Detail | Topic ID、Project、Owner、Revision、状態、要約、Canonical Markdown、編集・確認付き削除を表示 | Detail自身を第二の正本にしない |
| Meeting Detail | Meeting Metadata、未処置Outcome数、Canonical Markdown、Outcome処置、編集・確認付き削除を表示 | 同じRevisionをEffect要求へ渡す |

## 残る差

- Topic／Meeting DetailからOwner Artifactへ昇格する構造化操作とRelation先へのNavigationは未成立である。
- Cross-Repository Owner Relation操作とRemote CROS経由のTopic／Meeting書込みRoutingは未成立である。
- このためTopic DetailとMeeting Detailは`Partial`を維持し、List 2件だけを`Covered`へ更新した。

現在の15画面評価は次のとおりである。

```text
15 Logical Screens
├─ Covered  9
├─ Partial  6
└─ Missing  0
```

## 検証結果

| 対象 | 結果 |
|---|---|
| Project Operation Format／Type／Lint | PASS |
| Project Operation Contract Test | PASS（16件） |
| Workbench Format／Type／Lint | PASS |
| Workbench Integration／System Test | PASS（16件） |
| Topic Query／Cursor条件不一致拒否 | PASS |
| Meeting期間／未処置Outcome Filter | PASS |
| Workbench Topic／Meeting Detail Route | PASS |
| 不存在Detailの非開示404 | PASS |

## Checklist

- [x] 一覧条件をWorkbenchだけで再実装せず、共通Applicationへ置いた。
- [x] CursorをQuery条件と並び順へ拘束した。
- [x] DetailをCanonical Markdownと同じRevisionへ接続した。
- [x] 不存在IDから別Projectや別Kindを推測していない。
- [x] 未成立のRelation遷移とCross-Repository操作をCoveredへ含めていない。
- [x] 既存のReality Auditを上書きせず、現在の差分Evidenceとして記録した。
