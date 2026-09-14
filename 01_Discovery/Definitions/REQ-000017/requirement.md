# REQ-000017 出所付きContext Packageの解決

成果物種別: Discovery Definition
要求ID: `REQ-000017`
Discovery判断: 要求採用
判断する人: Qual-Lab

## 要求

CROSは、許可された正本から仕事に必要な最小Contextを出典、改訂版、利用範囲および欠測付きで組み立て、中央の第二正本を作らずAgentへ提供できなければならない。

## 対象と利用状況

Chat AgentやCROSが、複数Project／Repositoryから限定Taskに必要なContextを選び、Agentへ渡す場面。

## 解く問題と望ましい変化

```text
現在: 全Contextの中央複製や会話全文転送では、出所、改訂版、利用許可、欠測が失われ、第二正本と情報過多を作る。
    ↓
望ましい変化: 仕事に必要な最小Contextを出典、改訂版、利用範囲、欠測付きでPackage化し、Agentが根拠へ戻れる。
```

## 採用理由と比較

中央Index複製と全文転送を避け、Taskごとに許可された正本から解決するContext Packageを採る。

## 成立条件

- Context要素ごとにSource、Revision、利用範囲を保持する
- 許可されない、取得不能、競合する情報を推測で補完しない
- PackageはTask目的に必要な最小範囲で、中央の永続正本にならない

## 制約

- Secretや会話全文を無条件にAgentへ渡さない
- Serverが読める情報を接続利用者も読めるとみなさない

## 検証意図

単一Project、複数Repository、複数Project、部分アクセス、競合を与え、Package内容と欠測、根拠到達を観測する。

## 工程引渡し

| 引渡し先 | 失ってはならない意味 | 下流で決めること |
|---|---|---|
| UX | 依頼者・Agent、横断Contextを使う状況、必要情報だけを出所付きで理解する変化と不足表示をUXへ渡す。 | Goal、独立Outcome、重要場面、失敗、体験品質 |
| IA以降 | 本要求のIdentity、状態、関係、制約、反証条件 | 各工程固有の情報構造、操作、振る舞い、検証 |

## 関係

- Source Analysis: [EXP-000027](../../Analysis/EXP-000027/exploration.md)
- Formal downstream input: UXは本Definitionを一次入力として分析し、判断理由の再確認が必要な場合だけSource Analysisへ戻る。
