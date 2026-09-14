# REQ-000013 根拠と不完全性を保つPortfolio

成果物種別: Discovery Definition
要求ID: `REQ-000013`
Discovery判断: 要求採用
判断する人: Qual-Lab

## 要求

Portfolioは許可されたProjectだけを出典と不完全性付きで読み取り専用投影し、非開示Projectの存在を漏らさず、根拠Projectへ戻れるようにしなければならない。

## 対象と利用状況

PMやManagementが、複数Projectから注意対象を見つけ、必要な根拠へ降りる場面。

## 解く問題と望ましい変化

```text
現在: 表計算や短い要約へ転記すると、出典、更新時点、読めない範囲が消え、精密な進捗や完全な状態に見える。
    ↓
望ましい変化: 許可されたProjectを出典と不完全性付きで比較し、重要な差から元Projectと正本へ戻れる。
```

## 採用理由と比較

単一進捗率は不確実性を隠し、管理Database新設は正本を二重化するため、小さな読取り専用Portfolioを条件付きで採る。

## 成立条件

- 許可されたProjectだけを比較対象に含める
- ProjectごとのSource、Freshness、Coverage、Conflictを比較時にも保持する
- 一覧の判断から根拠Projectまたは正本へ到達できる

## 制約

- 非開示Projectの存在や件数を漏らさない
- 個人評価、従業員監視または根拠のない精密進捗へ使わない

## 検証意図

完全、部分可視、古い、競合する複数Projectを並べ、差と不足の理解、根拠到達、誤判断を観測する。

## 工程引渡し

| 引渡し先 | 失ってはならない意味 | 下流で決めること |
|---|---|---|
| UX | PM／Management、複数Project比較の状況、注意対象を根拠付きで選ぶ変化、不完全性と非開示境界をUXへ渡す。 | Goal、独立Outcome、重要場面、失敗、体験品質 |
| IA以降 | 本要求のIdentity、状態、関係、制約、反証条件 | 各工程固有の情報構造、操作、振る舞い、検証 |

## 関係

- Source Analysis: [EXP-000024](../../Analysis/EXP-000024/exploration.md)
- Formal downstream input: UXは本Definitionだけを正式入力として分析する。Source Analysisを直接補助入力にせず、意味が不足する場合はDiscoveryへ差し戻す。
