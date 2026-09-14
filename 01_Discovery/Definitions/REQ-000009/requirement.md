# REQ-000009 Project・Repository・Root Identity分離

成果物種別: Discovery Definition
要求ID: `REQ-000009`
Discovery判断: 要求採用
判断する人: Qual-Lab

## 要求

論理Project、各Repositoryおよび検証済み実行Rootは、相互に代用しない独立したIdentityとして結び付けられなければならない。

## 対象と利用状況

一つの論理Projectが開発、管理、Commercial等の複数Repositoryに分かれる、または一Repositoryだけで成立する場面。

## 解く問題と望ましい変化

```text
現在: Project、Repository、実行Rootを同一視すると、所属、正本、アクセス境界、実行対象を名前やPathから誤推定する。
    ↓
望ましい変化: Project ID、Repository ID、検証済みRootを独立Identityとして結び、同居と分離を同じモデルで扱える。
```

## 採用理由と比較

基準Repository配下への集約は所有と障害を集中し、Project情報の複製は同期を壊すため、明示Bindingを採る。

## 成立条件

- 一Project一Repositoryと一Project複数Repositoryを同じIdentity規則で表せる
- Repository名や配置ではなく検証済みBindingからProject所属とRootを解決する
- 同じProject IDでもRepositoryごとの責務とアクセス境界を保持する

## 制約

- 全Repositoryへ20_Projectの複製を要求しない
- Project IDをRepository IDまたはFilesystem Pathとして利用しない

## 検証意図

単一、複数、移動後Root、偽装Path、重複Identityを与え、Binding解決と拒否を観測する。

## 工程引渡し

| 引渡し先 | 失ってはならない意味 | 下流で決めること |
|---|---|---|
| UX | Projectを扱う利用者、Repository分割を意識する必要がある状況、論理Projectを安全に選べる変化とIdentity表示をUXへ渡す。 | Goal、独立Outcome、重要場面、失敗、体験品質 |
| IA以降 | 本要求のIdentity、状態、関係、制約、反証条件 | 各工程固有の情報構造、操作、振る舞い、検証 |

## 関係

- Source Analysis: [EXP-000020](../../Analysis/EXP-000020/exploration.md)
- Formal downstream input: UXは本Definitionを一次入力として分析し、判断理由の再確認が必要な場合だけSource Analysisへ戻る。
