# REQ-000024 境界を越えるTask結果の帰還

成果物種別: Discovery Definition
要求ID: `REQ-000024`
Discovery判断: 要求採用
判断する人: Qual-Lab

## 要求

ProjectまたはAgentの境界を越えて仕事を渡す場合、Task Identity、許可範囲、結果の出所および帰還先を維持し、実行結果を元のTaskと所有正本へ戻せなければならない。

## 対象と利用状況

ProjectまたはAgent境界を越えて限定Taskを委ね、成果を元のProject判断や正本へ戻す場面。

## 解く問題と望ましい変化

```text
現在: Contextを渡せてもTask Identity、許可範囲、結果の出所、帰還先が失われると、成果の採否と反映先を決められない。
    ↓
望ましい変化: 境界を越えても元Taskとの相関を保ち、結果と根拠を許可された所有正本へ帰還できる。
```

## 採用理由と比較

Agent間の会話転送や中央成果Storeを避け、Task Identityと帰還先をContext Packageと実行Sessionへ結合する。

## 成立条件

- 委譲前にTask Identity、対象Repository、許可範囲、期待結果、帰還先を固定する
- 実行結果にProducer、対象Revision、変更、Evidenceを結び付ける
- 帰還時にAuthorityを再確認し、元Taskまたは所有正本以外へ反映しない

## 制約

- 結果受領を自動採用または正本更新とみなさない
- Project間の自動最適化を初期範囲に含めない

## 検証意図

正常帰還、結果拒否、帰還先消失、Revision競合、部分結果、再送を行い、相関とEffectを観測する。

## 工程引渡し

| 引渡し先 | 失ってはならない意味 | 下流で決めること |
|---|---|---|
| UX | 依頼者・Agent、横断委譲の状況、成果の由来と戻り先を理解して判断できる変化をUXへ渡す。 | Goal、独立Outcome、重要場面、失敗、体験品質 |
| IA以降 | 本要求のIdentity、状態、関係、制約、反証条件 | 各工程固有の情報構造、操作、振る舞い、検証 |

## 関係

- Source Analysis: [EXP-000027](../../Analysis/EXP-000027/exploration.md)
- Formal downstream input: UXは本Definitionだけを正式入力として分析する。Source Analysisを直接補助入力にせず、意味が不足する場合はDiscoveryへ差し戻す。
