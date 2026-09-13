# Coordinatorへ集まりすぎた責務を分ける

探索ID: `EXP-000014`
状態: 要求採用
主な情報源: v0.20.0、CHG-000063
判断する人: Qual-Lab
記録の性質: CHG-000063、v0.19からv0.20への責務移行記録から再構成
時系列根拠: v0.20.0とCHG-000063を起点とする。

## きっかけ

Project Runtime、MCP、OS操作、実行の計測がCoordinatorの配下で育った。機能は動いていたが、ある契約を変えると、公開入口、署名、回復など離れた利用側に旧い前提が残ることが増えた。

Coordinatorは当初、AI実行を安全にまとめる自然な構成Rootだった。その後、Projectの状態管理、外部入口、観測、OS操作を接続しやすいという理由で近接機能が増え、利用側からは「Coordinatorを使わないとCRDD Runtimeを使えない」ように見え始めた。

```text
AI実行編成
   ├─ Project Lifecycle
   ├─ MCP Transport
   ├─ 実行観測
   ├─ OS／Docker
   └─ 署名・Release経路
        ↓ 同じpackageへ集約
変更理由と回帰範囲を分けられない
```

## 本当の問題は何だったか

ファイル数の多さではなく、意味を決める責務と実装上の置き場所が一致していなかったことが問題だった。Coordinator内部にあるため、本来は別の利用者も使う機能までCoordinator固有に見えていた。

この結合により、主要機能の移動自体は成功しても、署名、Manifest、Recovery、Launcherのような成立条件を支えるConsumerだけが旧境界に残ることがあった。物理的なフォルダ分けだけでは、依存方向と利用側閉包は変わらない。

## こうすれば解けると考えた

役割を次の単位へ分け、Project Runtimeから必要な実行能力をPortとして要求する形に変えることにした。

```text
Project Runtime       Projectの仕事と状態を管理する
Coordinator           AI実行を編成する
MCP                   外部から要求を運ぶ
Execution Intelligence 実行を観測する
Platform Access       OSや外部実行環境との境界を扱う
```

| 方向 | 評価 | 採否 |
|---|---|---|
| Coordinator package内で子Folderだけ分ける | 移動は小さいが、内部Path依存と共通Lifecycleが残る | 不採用 |
| すべてを独立Service／packageにする | 境界は明確だが、未実証のLifecycleと配布単位が増える | 不採用 |
| 意味責務と依存方向を先に分け、必要な単位だけ物理分離する | 現在の利用を保ちながら独立性を検証できる | 採用 |

成功条件はFolder名ではなく、公開入口、依存方向、Adapter、Consumer、署名・Release経路および回帰選択まで新しい所有者へ移ることである。

## 選んだこと、選ばなかったこと

- 依存方向を先に直し、その後に物理配置を分ける。
- MCPやWorkbenchにProjectの意味を再定義させない。
- 公開契約を便利な巨大Packageへ先回りして独立させない。
- 似た処理だけを理由に共通Primitiveを増やさない。

## 後から分かったこと

分離によって、Coordinator内で暗黙に守られていた前提が露出した。入力、永続化、利用側への伝播を各Componentが閉じなければならない。また、契約の所有者を移した時はProducerだけでなく、署名やReleaseを含む全Consumerを確認する必要がある。

## 現在地と次への引き渡し

主要Toolの責務分離はv0.20.0で成立した。今後の拡張は、それぞれの公開入口と依存方向を守り、移動した契約の利用側を機械的に検出できるようにする。

## 採用した要求

`REQ-000005`: Project管理、AI実行編成、Transport、実行観測およびPlatform境界は、それぞれの所有責務と依存方向を分け、内部配置だけを理由に別責務を所有してはならない。

`REQ-000019`: Canonical Contractまたは責務の所有者を移す場合、Producerだけでなく、公開入口、派生物、署名、RecoveryおよびReleaseを含む全Consumerを新しい所有境界へ移行し、旧境界の残存を検出できなければならない。

`REQ-000036`: Version Controlを利用する本番Toolは、GitコマンドやGit内部構造を各Componentへ埋め込まず、目的別のVersion Control PortとGit Adapterを介して利用しなければならない。通常の読取り・編集・Communication操作は未Commitでも成立し、Commit SHAを業務ObjectのIdentityまたは通常保存の成立条件にしない。
