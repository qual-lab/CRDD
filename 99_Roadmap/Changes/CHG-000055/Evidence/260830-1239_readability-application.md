# CHG-000055 読者経路への文書化規則適用評価

## 結論

03_Documentation 4.8.1の主要ロケール優先規則を、変更台帳READMEの読者経路へ机上適用した。
現在の変更を知る読者はCanonical CHGへ進み、旧CHG-000035の当時判断を復元する読者は台帳entryと固定Commit/Pathを分けて扱う必要がある。
本記録はAI机上評価であり、人間の初見理解時間は未測定である。

| 読者 | 入口 | 次の参照 | 取得できる意味 | 限界 |
|---|---|---|---|---|
| 現在の変更を知る読者 | README冒頭の「まず読む場所」 | Canonical一覧の`CHG-000015` | 現在のCapability、Authority、Release状態はCanonical CHGが所有する | 旧IDや固定byteから現在状態を推定しない |
| 旧CHG-000035の当時判断を復元する読者 | `consolidated-chg-000035`節 | 台帳entryの旧Pathと固定Commitによる`git --no-replace-objects show` | 旧題名、統合前判断`In Review`、変更分類`breaking`、移行境界、固定原文の復元条件 | 未投影の旧原文本文は本評価で読んでいない |

## Canonical移管と原文復元の区別

| 対象 | 読み方 | 保持する意味 |
|---|---|---|
| Canonical移管先 | `CHG-000035 -> CHG-000015`として、現在の意味は`CHG-000015_Coordinator_Runtime_1_0.md`へ移ったと読む | 旧IDは統合済み・永久欠番であり、現在状態の第二正本ではない |
| 固定Commit/Path | Commit`718d8fbfebae29e5345b81bc61385a30950831b3`と旧Path`90_Release/Changes/CHG-000035_Native_Provision_Bootstrap_Dependency_Reduction.md`で旧本文を復元する手段と読む | 当時の原文再構成条件であり、Canonicalの現在判断を置き換えない |

## 曖昧な英語表示の1件

| 対象箇所 | 平易な表示案 | 保持すべき正式ID/意味 |
|---|---|---|
| README冒頭の`Current State` | 「現在状態」 | 台帳は旧IDを現在状態の第二正本にしない、という意味を維持する |

## 残る確認

- Canonical移管先本文、関連Evidenceリンク先全件、固定Commitからの旧原文復元は検証していない。
- 台帳field、旧ID、固定Evidenceは変更していない。
