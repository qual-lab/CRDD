# CRDD／CROSの状態・可視性・責任

状態: 引き渡し可能（v0.21.0）
担当責任者: Qual-Lab
最終更新日: 2026-09-14

## 1. 状態を丸めない

```text
要求した
   ≠ 受理された
   ≠ 開始した
   ≠ 外部作用が成立した
   ≠ 結果を受け取った
   ≠ 正本へ採用した

見つからない
   ├ absent       不存在を確認できた
   ├ restricted   存在を開示できない
   ├ unavailable  現在取得できない
   ├ stale        古い観測だけがある
   ├ conflicting  複数の主張が競合する
   └ unknown      観測できず判断不能

記録されている
   ├ current       現在有効
   ├ historical    履歴として保持
   ├ superseded    別の内容へ置換済み
   └ unknown       現在の有効性を判断不能

実行基盤の境界
   ├ available     利用可能
   ├ blocked       利用不能または停止
   └ unknown       未確認
```

## 2. 可視性

| 情報 | 可視性の義務 |
|---|---|
| 現在状態、判断待ち、重大な危険、回復要否 | 利用者が次の行動を選ぶ文脈から隠さない |
| 欠測、古さ、競合、網羅範囲 | 要約と同時に理解できる |
| Source、Revision、Observed At、技術的Identity | 必要時に辿れる |
| 非開示対象 | 名前、件数、要約を推測表示しない |
| 内部Process、接続口（Port）、保存Path | 通常利用では主役にせず、診断責任者だけが辿れる |

## 3. 責任境界

この節で示す主体は、情報契約上必要な機能責任であり、特定の人物、組織またはComponentへの割当ではない。後続工程は、この責任境界を保ったまま実際の主体へ割り当てる。

```text
Human
├ 目的・許可範囲・採否・信頼方針を決める
└ 不明状態を受容するか、停止・回復するか判断する

CRDD／CROS
├ 対象・状態・根拠・不足・次の行動を意味を変えず投影する
├ 許可外の対象を推測・開示しない
└ CandidateをDecisionやEffectへ自動昇格しない

UI／MCP／CLI
└ 同じ公開契約を、それぞれの入口に適した形で運ぶ

UI／SPEC
└ IAが要求する意味を表示・振る舞いの契約として保持する

Architecture／Provider／Platform
└ UI／SPECを正式入力として実境界で成立させ、診断可能にする
```

## 4. 作業中と正式記録

候補、下書き、実行中の状態、一時投影と、採用済み正本、耐久的回復記録、公開済みEvidenceを区別する。具体的な保存期間や配置はSPEC・Architecture・Maintenanceが定める。

## 5. IA定義への適用

| IA定義 | 処置 | 固有の状態・可視条件・責任・権限 |
|---|---|---|
| [IA-000001](Definitions/IA-000001/ia_definition.md) | 適用 | 未検査／適合／指摘あり／修正中／再確認済みを区別し、Checkerと標準保守責任者を分ける |
| [IA-000002](Definitions/IA-000002/ia_definition.md) | 適用 | 計画中／実行中／判断待ち／受入済み／停止を区別し、PMの管理責任と人間の決定権限者の採否を分ける |
| [IA-000003](Definitions/IA-000003/ia_definition.md) | 適用 | 未開始／実行中／部分成立／失敗／回復必要／終了確認済みを区別し、Runtime記録責任と人間の回復判断を分ける |
| [IA-000004](Definitions/IA-000004/ia_definition.md) | 適用 | 観測済み／一部観測／観測不能、評価前／評価済み、候補／採用を区別する |
| [IA-000005](Definitions/IA-000005/ia_definition.md) | 適用 | 維持済み／一部置換／未対応／根拠不足を区別し、変更担当と能力維持の責任主体を分ける |
| [IA-000006](Definitions/IA-000006/ia_definition.md) | 適用 | 利用可能／一部利用可能／制限／古い／競合／不明を区別し、正本Ownerと投影生成責任を分ける |
| [IA-000007](Definitions/IA-000007/ia_definition.md) | 適用 | 手元で完結／横断参照が必要／横断先なし／制限／不明を区別する |
| [IA-000008](Definitions/IA-000008/ia_definition.md) | 適用 | 未受付／受付済み／作用未発行／作用済み／結果搬送済み／不明を区別する |
| [IA-000009](Definitions/IA-000009/ia_definition.md) | 適用 | 利用可能／資格要求／制限／利用不能／不明を区別し、管理能力を内容閲覧へ流用しない |
| [IA-000010](Definitions/IA-000010/ia_definition.md) | 適用 | 記録済み／候補／検討中／採用／却下／保留を区別する |
| [IA-000011](Definitions/IA-000011/ia_definition.md) | 適用 | 利用可能／未導入／不一致／権限不足／不明を区別する |
| [IA-000012](Definitions/IA-000012/ia_definition.md) | 適用 | 一時／耐久／回復必要／削除可能／清掃済み／不明を区別する |
| [IA-000013](Definitions/IA-000013/ia_definition.md) | 適用 | 利用可能／利用不能／制限／選択済み／再選定必要／不明を区別する |
| [IA-000014](Definitions/IA-000014/ia_definition.md) | 適用 | 準備中／引渡し済み／実行中／結果受領／判断待ち／採用／却下を区別する |
| [IA-000015](Definitions/IA-000015/ia_definition.md) | 適用 | 適合／不適合／未確認、完全／不一致、信頼済み／未信頼／不明を別軸で示す |
| [IA-000016](Definitions/IA-000016/ia_definition.md) | 適用 | 計画／変更中／レビュー中／是正中／検証済み／公開待ち／公開済みを区別する |
| [IA-000017](Definitions/IA-000017/ia_definition.md) | 適用 | 未許可／許可済み／送信済み／持帰り候補／採用／却下／不明を区別する |
| [IA-000018](Definitions/IA-000018/ia_definition.md) | 適用 | Draft／レビュー中／Canonical／置換済みと、図の不足／競合／不明を区別する |
| [IA-000019](Definitions/IA-000019/ia_definition.md) | 適用 | 確認済み／制限付き／未確認／利用不可を区別する |
| [IA-000020](Definitions/IA-000020/ia_definition.md) | 適用 | 利用可能／一部利用可能／故障／回復中／観測不能を境界ごとに区別する |
| [IA-000021](Definitions/IA-000021/ia_definition.md) | 適用 | 現在有効／履歴／置換済み／有効性不明を区別する |
| [IA-000022](Definitions/IA-000022/ia_definition.md) | 適用 | 未記録／記録中／完成／衝突／回復必要／公開不能／不明を区別する |

## 補足分析

なし。個別定義の文章を複製せず、関係と横断パターンだけを投影する。

## Checklist

- [x] 全IA Definitionを一件ずつ処置した
- [x] State、Visibility、Temporal Meaningを区別した
- [x] 不明を正常または不存在へ丸めていない
- [x] ResponsibilityとAuthorityを区別した
- [x] 非開示情報の存在を無断で露出していない
- [x] 個別IA Definitionの意味を再定義していない
- [x] 非該当には理由を記録した
- [x] 補足分析へ必須情報を退避していない
