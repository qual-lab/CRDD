# REQ-000023 異なるAI Runtime LifecycleのAdapter分離

成果物種別: Discovery Definition
要求ID: `REQ-000023`
Discovery判断: 要求採用
判断する人: Qual-Lab

## 要求

認証、起動、取消、結果取得または回復のLifecycleが既存Provider Adapterと異なるAI Runtimeは、設定だけで任意実行せず、新しいAdapterとして実装・検証しなければならない。

## 対象と利用状況

新しいAI Runtimeを接続する実装者と運用者が、既存Providerとは異なる認証、起動、取消、結果取得、回復を扱う場面。

## 解く問題と望ましい変化

```text
現在: Lifecycle差をモデル設定として扱うと、任意実行を許すか、既存Adapterの保証を偽って再利用する。
    ↓
望ましい変化: 意味が異なるRuntimeは独立Adapterとして実装・検証され、共通Coreには必要Capabilityだけを公開する。
```

## 採用理由と比較

設定による任意Executable化を避け、Lifecycle差がある時だけ新Adapterを要求する。

## 成立条件

- 新Runtimeと既存Adapterの認証、起動、取消、結果、回復Semanticsを比較する
- 差がある場合は設定Aliasでなく専用AdapterとCapability Contractを持つ
- 実環境で開始から終了後清掃までを段階的に検証する

## 制約

- モデル名の追加だけで不要なAdapterを増やさない
- 未知RuntimeをDirectory走査で自動有効化しない

## 検証意図

既存Adapter互換と非互換Runtimeを用意し、構成受理、Adapter選択、取消、結果、回復、清掃を観測する。

## 工程引渡し

| 引渡し先 | 失ってはならない意味 | 下流で決めること |
|---|---|---|
| UX | Runtime拡張者と利用者、新Runtime導入の状況、違いを隠さず安全に選べる変化をUXへ渡す。 | Goal、独立Outcome、重要場面、失敗、体験品質 |
| IA以降 | 本要求のIdentity、状態、関係、制約、反証条件 | 各工程固有の情報構造、操作、振る舞い、検証 |

## 関係

- Source Analysis: [EXP-000026](../../Analysis/EXP-000026/exploration.md)
- Formal downstream input: UXは本Definitionを一次入力として分析し、判断理由の再確認が必要な場合だけSource Analysisへ戻る。
