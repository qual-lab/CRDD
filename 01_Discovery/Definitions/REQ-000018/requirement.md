# REQ-000018 Runtime Trust要素の分離

成果物種別: Discovery Definition
要求ID: `REQ-000018`
Discovery判断: 要求採用
判断する人: Qual-Lab

## 要求

RuntimeのCRDD準拠、Artifact Integrity、Publisher IdentityおよびQual-Lab公式配布の表示は別々に判定でき、一つの署名結果から他の成立を推定してはならない。

## 対象と利用状況

公式Build、組織Fork、Local未署名Buildを導入するDeployment Ownerが、Runtimeを利用できるか判断する場面。

## 解く問題と望ましい変化

```text
現在: Publisher署名を準拠、安全性、公式性、実行許可のすべてとして扱うと、Forkを不当に拒否するか未知Buildを過信する。
    ↓
望ましい変化: CRDD準拠、Artifact Integrity、Publisher Identity、Qual-Lab公式表示を別々に確認し、利用者Policyで判断できる。
```

## 採用理由と比較

Qual-Lab署名のみの資格化はOSS改変性を失い、署名廃止は改ざんと出所を失うため、Trust要素を分離する。

## 成立条件

- 準拠、Integrity、Publisher、公式表示を独立結果として返す
- 一要素のPassから他要素または実行許可を推定しない
- 公式、組織、Local開発Artifactへ同じ判定モデルを適用する

## 制約

- Qual-Lab署名の有無だけでForkの実行可否を固定しない
- 未署名Local Buildを本番信頼済みArtifactへ自動昇格しない

## 検証意図

公式署名、組織署名、改ざん、未署名、準拠不成立を組み合わせ、各結果と最終Policy判断を観測する。

## 工程引渡し

| 引渡し先 | 失ってはならない意味 | 下流で決めること |
|---|---|---|
| UX | Deployment Owner、Runtime導入判断の状況、何を信頼しているか分けて理解する変化をUXへ渡す。 | Goal、独立Outcome、重要場面、失敗、体験品質 |
| IA以降 | 本要求のIdentity、状態、関係、制約、反証条件 | 各工程固有の情報構造、操作、振る舞い、検証 |

## 関係

- Source Analysis: [EXP-000028](../../Analysis/EXP-000028/exploration.md)
- Formal downstream input: UXは本Definitionを一次入力として分析し、判断理由の再確認が必要な場合だけSource Analysisへ戻る。
