# REQ-000025 Deployment Ownerが所有するTrust Policy

成果物種別: Discovery Definition
要求ID: `REQ-000025`
Discovery判断: 要求採用
判断する人: Qual-Lab

## 要求

Deployment Ownerは、公式版、組織版およびLocal開発版をどの条件で信頼するかをPolicyとして所有し、既定拒否、鍵の更新・失効および移行を管理できなければならない。

## 対象と利用状況

組織またはLocal環境のDeployment Ownerが、どのPublisher／Buildをどの用途で実行可能とするか設定・更新する場面。

## 解く問題と望ましい変化

```text
現在: Qual-LabがTrust判断を固定するとForkが成立せず、未知Publisherや未署名Buildの暗黙許可は安全境界を失う。
    ↓
望ましい変化: Deployment Ownerが公式、組織、Local開発版の許容条件、既定拒否、鍵更新・失効・移行をPolicyとして所有できる。
```

## 採用理由と比較

Publisher署名の証明と利用環境の実行許可を分離し、利用者所有Policyを最終判断境界にする。

## 成立条件

- Policy Owner、信頼Publisher、用途、期限、例外を明示できる
- 未知Publisher、失効鍵、条件外未署名BuildをEffect前に既定拒否する
- 鍵更新、失効、Policy移行後に旧Capabilityが再利用されない

## 制約

- Secret鍵をPolicyやRepositoryへ保存しない
- Local開発例外を本番または別利用者へ自動伝播しない

## 検証意図

公式、組織、Local、未知、失効、移行中のArtifactを評価し、Policy判断、Capability発行、監査記録を観測する。

## 工程引渡し

| 引渡し先 | 失ってはならない意味 | 下流で決めること |
|---|---|---|
| UX | Deployment Owner、Trust設定・更新の状況、自分の環境で許す範囲を理解して管理する変化をUXへ渡す。 | Goal、独立Outcome、重要場面、失敗、体験品質 |
| IA以降 | 本要求のIdentity、状態、関係、制約、反証条件 | 各工程固有の情報構造、操作、振る舞い、検証 |

## 関係

- Source Analysis: [EXP-000028](../../Analysis/EXP-000028/exploration.md)
- Formal downstream input: UXは本Definitionを一次入力として分析し、判断理由の再確認が必要な場合だけSource Analysisへ戻る。
