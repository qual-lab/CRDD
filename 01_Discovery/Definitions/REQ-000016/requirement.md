# REQ-000016 AIモデルProfileの検証可能な外部構成

成果物種別: Discovery Definition
要求ID: `REQ-000016`
Discovery判断: 要求採用
判断する人: Qual-Lab

## 要求

既存Provider Adapterの意味を変えないモデル、Profile、Role割当およびCLI配置は、Coreの改修を伴わず、検証可能な設定として更新できなければならない。

## 対象と利用状況

AI Runtimeを設定する運用者が、既存Adapterで使えるモデル、Profile、Role割当、CLI配置を更新する場面。

## 解く問題と望ましい変化

```text
現在: モデルCatalogの変化とRuntime Lifecycle変更が同じCoreコードに結び付き、単純更新にもBuild／配布が必要になる。
    ↓
望ましい変化: 既存Adapterの意味を変えない構成は、検証可能な設定として更新し、Host可用性とOperation許可を確認して選択できる。
```

## 採用理由と比較

Coreへの全列挙は更新が重く、任意Executable設定はTrustを失うため、検証済みAdapterの範囲内だけ外部構成する。

## 成立条件

- モデル、Profile、Role割当、CLI配置をSchemaとAdapter対応で検証する
- 登録、Host可用、認証、Operation許可を別々に判定する
- 構成変更後も既存Adapterの起動、取消、結果意味が変わらない

## 制約

- 設定へSecret、任意Executableまたは未検証引数を書かない
- 費用だけでモデルを自動選択しない

## 検証意図

既存モデル追加、Profile変更、CLI移動、未知モデル、Host不可、認証不足を与え、Effect前の選択と拒否を観測する。

## 工程引渡し

| 引渡し先 | 失ってはならない意味 | 下流で決めること |
|---|---|---|
| UX | Runtime設定者と利用者、モデル更新・選択の状況、Core改修なしに妥当な候補を理解する変化をUXへ渡す。 | Goal、独立Outcome、重要場面、失敗、体験品質 |
| IA以降 | 本要求のIdentity、状態、関係、制約、反証条件 | 各工程固有の情報構造、操作、振る舞い、検証 |

## 関係

- Source Analysis: [EXP-000026](../../Analysis/EXP-000026/exploration.md)
- Formal downstream input: UXは本Definitionだけを正式入力として分析する。Source Analysisを直接補助入力にせず、意味が不足する場合はDiscoveryへ差し戻す。
