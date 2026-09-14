# REQ-000033 Work LifecycleとEvidence所有の分離

成果物種別: Discovery Definition
要求ID: `REQ-000033`
Discovery判断: 要求採用
判断する人: Qual-Lab

## 要求

Roadmap、Change、Release、EvidenceおよびQualityは、未完了状態、変更差分、公開判断、直接証明対象および現在品質の責務を分け、状態遷移時は全利用側へ伝播しなければならない。

## 対象と利用状況

保守者や利用者が、未完了作業、変更、Release、Evidence、現在品質の所在と関係を確認する場面。

## 解く問題と望ましい変化

```text
現在: Roadmap、CHG、Release状態、Evidence、Quality投影が混在すると、候補と公開済み、履歴と現在値、証拠Ownerを誤る。
    ↓
望ましい変化: 各成果物が未完了状態、変更差分、公開判断、直接証明対象、現在品質を分担し、状態変更が全利用側へ伝播する。
```

## 採用理由と比較

ファイル種別別のEvidence倉庫や巨大Quality Centerを避け、直接証明するCHGまたはReleaseをEvidence Ownerにする。

## 成立条件

- Roadmap、Change、Release、Evidence、Qualityの責務と正本を一意に説明できる
- Release状態変更がOverview、CHANGELOG、Quality、Roadmap等へ同時に伝播する
- Evidenceから対象Revision、結果、所有CHG／Releaseを追跡できる

## 制約

- 同じEvidence本文を複数箇所へ複製しない
- Path名だけで現在性、状態または証明対象を判定しない

## 検証意図

Candidate→Released、Change close、Evidence追加、Quality再評価を行い、全投影、リンク、Owner、旧表示残存を観測する。

## 工程引渡し

| 引渡し先 | 失ってはならない意味 | 下流で決めること |
|---|---|---|
| UX | 作業・Releaseを追う人、現在地確認の状況、置き場所から迷わず根拠へ届く変化をUXへ渡す。 | Goal、独立Outcome、重要場面、失敗、体験品質 |
| IA以降 | 本要求のIdentity、状態、関係、制約、反証条件 | 各工程固有の情報構造、操作、振る舞い、検証 |

## 関係

- Source Analysis: [EXP-000018](../../Analysis/EXP-000018/exploration.md)
- Formal downstream input: UXは本Definitionだけを正式入力として分析する。Source Analysisを直接補助入力にせず、意味が不足する場合はDiscoveryへ差し戻す。
