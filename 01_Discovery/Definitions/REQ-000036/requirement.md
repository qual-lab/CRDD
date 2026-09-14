# REQ-000036 差し替え可能なVersion Control境界

成果物種別: Discovery Definition
要求ID: `REQ-000036`
Discovery判断: 要求採用
判断する人: Qual-Lab

## 要求

Version Controlを利用する本番Toolは、GitコマンドやGit内部構造を各Componentへ埋め込まず、目的別のVersion Control PortとGit Adapterを介して利用しなければならない。通常の読取り・編集・Communication操作は未Commitでも成立し、Commit SHAを業務ObjectのIdentityまたは通常保存の成立条件にしない。

## 対象と利用状況

CRDDの本番ToolがRepository履歴、差分、追跡対象、Revisionを利用し、将来別Version Control実装へ差し替える場面。

## 解く問題と望ましい変化

```text
現在: Gitコマンドと内部構造を各Componentへ埋め込むと、未Commit作業が成立せず、Commit SHAが業務Identity化し、差替え不能になる。
    ↓
望ましい変化: 目的別Version Control Portを介して必要能力を使い、通常作業は未Commitでも成立し、GitはAdapterとして交換できる。
```

## 採用理由と比較

汎用巨大Git抽象ではなく、Repository確認、追跡対象、Revision等の利用目的ごとに小さなPortを置く。

## 成立条件

- 本番ToolのGit利用箇所がVersion Control Port経由になっている
- 通常の読取り、編集、Communication操作が未Commit状態でも成立する
- CommitやTreeが必要なRelease／Evidence境界だけ明示的にRevisionを要求する

## 制約

- Commit SHAをProject、Topic、Meeting等の業務Object Identityにしない
- Git履歴で再現できるInventoryを別の永続正本として複製しない

## 検証意図

未Commit、別Branch、Git Adapter置換、Repository境界不明、Release固定Revisionを用い、各Capabilityと拒否を観測する。

## 工程引渡し

| 引渡し先 | 失ってはならない意味 | 下流で決めること |
|---|---|---|
| UX | Tool利用者・保守者、通常作業と固定Evidenceの状況、Version Control実装を意識せず必要な履歴能力を使う変化をUXへ渡す。 | Goal、独立Outcome、重要場面、失敗、体験品質 |
| IA以降 | 本要求のIdentity、状態、関係、制約、反証条件 | 各工程固有の情報構造、操作、振る舞い、検証 |

## 関係

- Source Analysis: [EXP-000014](../../Analysis/EXP-000014/exploration.md)
- Formal downstream input: UXは本Definitionだけを正式入力として分析する。Source Analysisを直接補助入力にせず、意味が不足する場合はDiscoveryへ差し戻す。
