# REQ-000005 Runtime責務と依存方向の分離

成果物種別: Discovery Definition
要求ID: `REQ-000005`
Discovery判断: 要求採用
判断する人: Qual-Lab

## 要求

Project管理、AI実行編成、Transport、実行観測およびPlatform境界は、それぞれの所有責務と依存方向を分け、内部配置だけを理由に別責務を所有してはならない。

## 対象と利用状況

Project Runtime、Coordinator、MCP、実行観測、Platform境界を保守・利用する人が、一つの責務変更を行う場面。

## 解く問題と望ましい変化

```text
現在: 近接しているという理由で別責務がCoordinatorへ集まり、変更理由、依存方向、利用側回帰範囲が分からない。
    ↓
望ましい変化: 各Componentが自分の意味責務と公開入口を持ち、Project RuntimeはPortを通して実行能力を利用できる。
```

## 採用理由と比較

子Folderだけでは内部依存が残り、全面Service化では未実証の配布単位が増えるため、意味責務と依存方向を先に分ける。

## 成立条件

- Project管理、実行編成、Transport、観測、Platform境界のOwnerを一意に説明できる
- Project RuntimeからCoordinator実装詳細への依存をPortで反転する
- 各Componentの公開入口以外を利用側が参照せず、単独利用時の契約を確認できる

## 制約

- 公開契約を何でも入る巨大packageへしない
- 似た処理だけを理由に共通Primitiveを増やさない

## 検証意図

依存Graph、公開import、package単独試験、代表利用側を確認し、内部Path参照や逆向き依存を反証する。

## 工程引渡し

| 引渡し先 | 失ってはならない意味 | 下流で決めること |
|---|---|---|
| UX | 保守者と利用者、責務変更または利用の状況、影響範囲を理解して安全に使い続ける変化をUXへ渡す。 | Goal、独立Outcome、重要場面、失敗、体験品質 |
| IA以降 | 本要求のIdentity、状態、関係、制約、反証条件 | 各工程固有の情報構造、操作、振る舞い、検証 |

## 関係

- Source Analysis: [EXP-000014](../../Analysis/EXP-000014/exploration.md)
- Formal downstream input: UXは本Definitionだけを正式入力として分析する。Source Analysisを直接補助入力にせず、意味が不足する場合はDiscoveryへ差し戻す。
