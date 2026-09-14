# IA-000011 Tool能力・利用可否・配布根拠

成果物種別: IA定義
IA ID: `IA-000011`
状態: Canonical
維持責任者: Qual-Lab

## 意味と利用者成果

Repositoryの仕事に必要な標準Toolを、版と根拠を取り違えず選ぶ。

### 利用場面

| 入力UX | 利用者／場面 | 保持する対象 | 区別する状態 | 根拠・判断への導線 |
|---|---|---|---|---|
| [UX-000016](../../Analysis/UX-000016/ia_analysis.md) | 開発者／ツールで処理を始める時 | 利用能力（Capability）、利用可否、実行権限（Authority）、Repository 改訂版（Revision）、配布物（Distribution）、配布目録（Manifest）、実行環境との結合（Runtime Binding） | 利用可能（available）／利用不能（unavailable）／未確認（unverified）／停止（blocked） | 仕事→必要能力→登録Tool→配布根拠→起動 |

この表は入力UXごとの意味保持先である。共有定義へ統合しても、各行の対象・状態・導線を共通語だけへ丸めない。

## 対象・識別・関係

| 対象 | 利用者にとっての意味 | 識別・関係 |
|---|---|---|
| 利用能力（Capability） | Toolが提供する仕事上の能力 | 利用能力（Capability） ID |
| 利用可否（Availability） | 現在利用可能か | 利用能力（Capability）＋環境 |
| 実行権限（Authority） | 実行時に許される作用 | 主体・対象・時点 |
| 配布物（Distribution） | 配布単位 | 配布内容の基点（Content Root） |
| 配布目録（Manifest） | 配布内容と根拠 | 配布目録のハッシュ（Manifest Hash） |
| 実行環境との結合（Runtime Binding） | 配布と実行環境の結合 | 結合識別子（Binding Identity） |

```text
[O: Repository 改訂版（Revision）] --宣言する--> [O: 利用能力（Capability）]
[O: 利用能力（Capability）] --持つ--> [O: 利用可否（Availability）]
[O: 配布物（Distribution）] --説明される--> [O: 配布目録（Manifest）]
[O: 配布物（Distribution）] --結合される--> [O: 実行環境との結合（Runtime Binding）]
[O: 権限（Authority）] --利用を許す--> [O: 利用能力（Capability）の使用]
```

上表は複数の入力UXを横断して利用する中心対象を示す。入力固有の対象は「利用場面」の対応表にも保持し、中心対象へ統合できない意味を欠落として扱う。

## 状態と可視性

入力UXで必要とされた状態は次のとおりである。状態実値を採用する場合は、下流工程で対応関係を定義し、この利用者向け区分を上書きしない。

- `UX-000016`: 利用可能（available）／利用不能（unavailable）／未確認（unverified）／停止（blocked）

重要な状態、不足、判断要否は次の行動と同じ文脈で示す。観測不能を不存在や正常へ丸めない。

## 導線と責任

- 開発者: ツールで処理を始める時に「固定Commitに対応するツール／実行基盤と利用可能性を知る」ために必要な判断を行う。システムは「版不一致・欠落実行基盤・改ざん配布目録（Manifest）を対応版と誤認する」を避けられるよう、Commit・配布集合・配布目録（Manifest）・実行基盤の対応を検証する。

各利用場面の導線は「利用場面」の対応表を正とする。結果なし、判断待ち、失敗、状態不明の場合も、根拠または安全な戻り先へ接続する。

## 制約

具体的な画面、UI部品、API、Schema、保存方式、Process構成は本定義で確定しない。正式な識別子や状態実値を用いる場合は平易な表示と対応付け、利用者が内部構造を知らなくても判断できるようにする。

## 下流への引き渡し

UI／MCPは同じ登録情報（Registry）の投影を使い、Architectureは起動処理（launcher）・配布単位（package）・実行環境との結合（binding）を、Verificationは版一致を保証する。

下流工程は「利用場面」の各行を受入単位として扱い、中心対象だけを実装して入力固有の意味を落とさない。

## 情報源

- [UX-000016のIA分析](../../Analysis/UX-000016/ia_analysis.md)
