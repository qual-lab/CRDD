# REQ-000006 Local MCP Transport間の意味統一

成果物種別: Discovery Definition
要求ID: `REQ-000006`
Discovery判断: 要求採用
判断する人: Qual-Lab

## 要求

Localのstdio MCPとlocalhost HTTPはProject Runtimeの同じ公開Application Contractを利用し、Transport固有の状態、権限判断または結果意味を持ってはならない。

## 対象と利用状況

Desktop AI ClientとLocal Appが、stdio MCPまたはlocalhost HTTPから同じProject操作を使う場面。

## 解く問題と望ましい変化

```text
現在: Transportごとに状態、権限判断、失敗分類を持つと、同じObjectiveが入口により異なる意味と結果になる。
    ↓
望ましい変化: 接続方式が違っても同じ公開Application Contract、Authority、結果、不足、取消、終了後状態を利用できる。
```

## 採用理由と比較

HTTP専用APIは意味を二重化し、全入口のMCP強制はLocal LibraryまでServerへ依存するため、薄いTransport Adapterを採る。

## 成立条件

- stdioとlocalhost HTTPが同じ入力を同じApplication Contractへ渡す
- 正常、入力不正、判断待ち、回復要求、取消を同じ結果意味で返す
- Transport終了後にRuntime状態やEffectが入口差で分岐しない

## 制約

- v0.20のLocal契約からRemote公開や汎用認証を推定しない
- MCPはProject状態または更新Authorityを所有しない

## 検証意図

同一Requestを両Transportで実行し、成功、拒否、取消、回復結果とRuntime側Effectを比較する。

## 工程引渡し

| 引渡し先 | 失ってはならない意味 | 下流で決めること |
|---|---|---|
| UX | Local利用者、複数入口を選ぶ状況、入口差を意識せず同じ仕事を行う変化、Transport固有表示だけをUXへ渡す。 | Goal、独立Outcome、重要場面、失敗、体験品質 |
| IA以降 | 本要求のIdentity、状態、関係、制約、反証条件 | 各工程固有の情報構造、操作、振る舞い、検証 |

## 関係

- Source Analysis: [EXP-000015](../../Analysis/EXP-000015/exploration.md)
- Formal downstream input: UXは本Definitionだけを正式入力として分析する。Source Analysisを直接補助入力にせず、意味が不足する場合はDiscoveryへ差し戻す。
