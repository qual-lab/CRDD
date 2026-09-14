# REQ-000020 欠測・競合を保つRepository Federation

成果物種別: Discovery Definition
要求ID: `REQ-000020`
Discovery判断: 要求採用
判断する人: Qual-Lab

## 要求

複数Repositoryを一つのProjectとして解決する場合、各Repositoryの出典、責務、利用可否、欠測および競合を保ち、探索順や複製された本文から正本を推定してはならない。

## 対象と利用状況

CROSが複数Repositoryを一つの論理Projectとして読み、利用可能なContextを投影する場面。

## 解く問題と望ましい変化

```text
現在: 本文複製や探索順による選択では、責務が競合した時や一部Repositoryが読めない時に誤った完全視を作る。
    ↓
望ましい変化: Repositoryごとの出典、責務、利用可否、欠測、競合を保ったままProjectを解決できる。
```

## 採用理由と比較

基準Repositoryへの集約と複製を避け、明示Identity／責務Bindingを許可範囲内でFederationする。

## 成立条件

- 一Repositoryと複数RepositoryのProjectを同じ結果契約で投影する
- 読めないRepositoryを不存在または正常と扱わず、開示可能な不足だけを示す
- 同一責務の複数Sourceは探索順で選ばずConflictとして返す

## 制約

- Repositoryのアクセス境界をCROS要約で迂回しない
- 別Repository本文を同期用に複製しない

## 検証意図

完全、部分アクセス、欠測、重複責務、競合Revisionを組み合わせ、投影と非開示を観測する。

## 工程引渡し

| 引渡し先 | 失ってはならない意味 | 下流で決めること |
|---|---|---|
| UX | Project利用者、分散Context確認の状況、Repository分割を意識せず不足だけ理解する変化をUXへ渡す。 | Goal、独立Outcome、重要場面、失敗、体験品質 |
| IA以降 | 本要求のIdentity、状態、関係、制約、反証条件 | 各工程固有の情報構造、操作、振る舞い、検証 |

## 関係

- Source Analysis: [EXP-000020](../../Analysis/EXP-000020/exploration.md)
- Formal downstream input: UXは本Definitionを一次入力として分析し、判断理由の再確認が必要な場合だけSource Analysisへ戻る。
