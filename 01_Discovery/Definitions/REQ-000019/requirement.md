# REQ-000019 契約移行時のConsumer閉包

成果物種別: Discovery Definition
要求ID: `REQ-000019`
Discovery判断: 要求採用
判断する人: Qual-Lab

## 要求

Canonical Contractまたは責務の所有者を移す場合、Producerだけでなく、公開入口、派生物、署名、RecoveryおよびReleaseを含む全Consumerを新しい所有境界へ移行し、旧境界の残存を検出できなければならない。

## 対象と利用状況

Canonical Contractまたは責務を移す保守者が、主要機能だけでなく署名、回復、配布等の副次Consumerまで移行する場面。

## 解く問題と望ましい変化

```text
現在: Producerと代表Consumerだけを直すと、稀な公開・Release経路が旧Pathや旧意味を再解釈し、完成後に破綻する。
    ↓
望ましい変化: 実Sourceから導出した全Consumer、派生物、公開入口、署名、Recovery、Releaseが新Ownerへ閉じ、旧境界残存を検出できる。
```

## 採用理由と比較

手書き台帳だけでは記載漏れが盲点になるため、宣言集合と実Sourceから導出した集合を照合する。

## 成立条件

- 変更した意味のProducer、Consumer、派生物、公開・署名・回復・Release経路を列挙する
- 各ConsumerがCanonicalなPath、Identity、Stateを再解釈せず利用する
- 旧API、旧Path語彙、宣言漏れ、実装未接続を固定候補前に検出する

## 制約

- 代表Consumer一件の成功でClosureを主張しない
- Consumer Registryだけを完全性の正本にしない

## 検証意図

Consumer一件を意図的に旧境界へ残す、宣言だけ追加する、Canonical値を再解釈する反例でChecker、契約試験、縦断試験を観測する。

## 工程引渡し

| 引渡し先 | 失ってはならない意味 | 下流で決めること |
|---|---|---|
| UX | 保守者と利用者、責務移動後の利用状況、成立済み能力を安心して使い続ける変化と未移行表示をUXへ渡す。 | Goal、独立Outcome、重要場面、失敗、体験品質 |
| IA以降 | 本要求のIdentity、状態、関係、制約、反証条件 | 各工程固有の情報構造、操作、振る舞い、検証 |

## 関係

- Source Analysis: [EXP-000014](../../Analysis/EXP-000014/exploration.md)
- Formal downstream input: UXは本Definitionを一次入力として分析し、判断理由の再確認が必要な場合だけSource Analysisへ戻る。
