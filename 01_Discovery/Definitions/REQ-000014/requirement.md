# REQ-000014 Repository Tool能力の明示Registry

成果物種別: Discovery Definition
要求ID: `REQ-000014`
Discovery判断: 要求採用
判断する人: Qual-Lab

## 要求

Repositoryが提供するTool能力は安定したRegistryで定義し、登録、外部公開、Hostでの利用可能性およびOperationの実行許可を分けて判定できなければならない。

## 対象と利用状況

人、MCP、Coordinator、Scheduler、CIが、Repositoryで提供されるBuild、Test、Preview等のToolを見つけて使う場面。

## 解く問題と望ましい変化

```text
現在: ファイル名やExecutableの存在だけでは、入力、Working Directory、Effect、取消、清掃、現在の利用可否と実行許可を判断できない。
    ↓
望ましい変化: 安定した能力定義からToolを発見し、登録、外部公開、Host可用性、Operation許可を別々に理解して実行できる。
```

## 採用理由と比較

Launcher命名だけでは契約を表せず、Directory自動発見は任意Codeを正規能力へするため、明示Registryと既存実装の結合を採る。

## 成立条件

- ToolごとにIdentity、入力、結果、Effect、取消、清掃条件をRegistryから確認できる
- 登録済み、公開済み、Host利用可能、Operation許可済みを別状態で返す
- Human CLI、MCP、Coordinatorが同じ能力定義と実装を利用する

## 制約

- 任意Shellや未登録ExecutableをCapabilityとして実行しない
- Registry正本を`.crdd`またはCROS側の一覧へ移さない

## 検証意図

代表Toolを複数入口から実行し、不登録、非公開、Host不可、不許可、取消、清掃を観測する。

## 工程引渡し

| 引渡し先 | 失ってはならない意味 | 下流で決めること |
|---|---|---|
| UX | Tool利用者、仕事に必要な能力を探す状況、Path推測なしで可否と結果を理解する変化をUXへ渡す。 | Goal、独立Outcome、重要場面、失敗、体験品質 |
| IA以降 | 本要求のIdentity、状態、関係、制約、反証条件 | 各工程固有の情報構造、操作、振る舞い、検証 |

## 関係

- Source Analysis: [EXP-000025](../../Analysis/EXP-000025/exploration.md)
- Formal downstream input: UXは本Definitionだけを正式入力として分析する。Source Analysisを直接補助入力にせず、意味が不足する場合はDiscoveryへ差し戻す。
