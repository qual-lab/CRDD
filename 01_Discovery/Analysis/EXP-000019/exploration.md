# 横断機能を使わなくても、普段の開発を続けられる

成果物種別: Discovery Analysis
分析ID: `EXP-000019`

探索ID: `EXP-000019`
状態: 要求採用
主な情報源: CRDD採用Repositoryの現在の使い方
判断する人: Qual-Lab
記録の性質: 現行の採用Repository利用形態とv0.21構想から再構成
時系列根拠: 2026-09-13の遡及Discovery再編で同時に固定したv0.21構想群の先頭とし、以下は利用者の通常作業から横断利用へ広がる依存順を安定したtie-breakに用いた。

## きっかけ

CROS、Shared Server、Workspace、Workbenchの構想が具体的になるほど、Developerまでその仕組みを理解しなければ作業できなくなる危険が見えてきた。

現在は、対象Repositoryをcloneし、CodexやClaude Code、CLIからそのRepositoryの文書とToolを使える。この単純な使い方は既に役立っている。

```text
現在の通常作業
Repositoryを取得
    ↓
Repository内のCRDD ContextとToolを使う
    ↓
同じRepositoryへ成果を戻す
```

CROSが必要になるのは、別RepositoryのContextや複数Projectを横断する時である。この二つの利用状況を一つの必須構成へ丸める理由はなかった。

## 本当の問題

横断機能が足りないことではなく、新しい機能のために今あるローカル作業を複雑にしてしまうことだった。CROSの設定やServerの障害が、一つのRepository内で完結する仕事まで止めてはいけない。

## 置いた仮説

普段のRepository単独入口はそのまま残し、複数Repositoryや複数Projectを横断したい時だけCROSを使う。入口は二つでも、仕事の意味は同じ公開契約を使えば分岐を抑えられると考えた。

すべてをCROS経由に統一する案は、単一障害点を増やし、既に成立している使い方を失うため選ばなかった。

| 方向 | Developerへの影響 | 採否 |
|---|---|---|
| すべての作業をCROS経由にする | 初期設定、常設Process、障害点が増える | 不採用 |
| LocalとCROSで別の仕事契約を作る | 単独利用は軽いが、結果意味とToolが分岐する | 不採用 |
| Localを基準能力として保ち、横断時だけCROSを重ねる | 現行利用を守りながら拡張できる | 採用 |

この仮説は、CROS導入後にLocal入口が機能縮小する、同じ操作の意味が変わる、またはCROS停止でRepository内作業が止まる場合に反証される。

## 現在の判断

- CROSやWorkbenchがなくてもRepository内の作業は成立させる。
- Developerへ横断構成の理解を強制しない。
- 横断時と単独時で、同じ操作の意味を別々に定義しない。

## 次工程で確かめること

CROSが未設定または停止していても、Repository内のTool、AI作業、検証が続けられることを回帰試験する。UXではWorkbenchを使わないDeveloperの流れも通常経路として扱う。

## 採用した要求

`REQ-000008`: 単一Repository内で完結するCRDDの作業は、CROS、Workbench、Shared Serverまたは別Repositoryを設定・利用しなくても開始し完了できなければならない。
