# CRDD／CROSの情報オブジェクトと関係

状態: 引き渡し可能（v0.21.0）
担当責任者: Qual-Lab
最終更新日: 2026-09-14

本書は個別IA定義を横断し、利用者が別の対象として見分けるものと、その関係を示す。実装Classや保存表の一覧ではない。

## 1. 中心となる関係

```text
[O: プロジェクト（Project）]
   ├─ --含む--> [O: 節目（Milestone）]
   │                    └─ --含む--> [O: Objective／Task]
   ├─ --構成される--> [O: リポジトリ（Repository）]
   │                              └─ --結合される--> [O: 結合情報（Binding）]
   ├─ --情報源を持つ--> [O: Artifact／Revision]
   └─ --投影される--> [O: 読取り投影（Projection）]
                                  ├─ {state: complete／partial／conflicting／unknown}
                                  └─ --根拠を持つ--> [O: Source／Observed At]

[O: 作業（Task）]
   ├─ --実行される--> [O: 実行主体]
   ├─ --制約される--> [O: 対象範囲／決定権限]
   ├─ --生む--> [O: Result／Candidate]
   └─ --必要とする場合がある--> [O: Decision／Recovery]

[O: 実行基盤]
   ├─ --境界ごとに観測--> [O: 認証／起動／取消／結果取得／回復]
   └─ --状態から判断--> [O: 利用可能能力／利用不能能力／未確認能力]

[O: 現在の仕事]
   └─ --必要な情報を選ぶ--> [O: 判断／仮説／学び]
                                  ├─ --現在有効--> [O: 現在の意図]
                                  ├─ --履歴--> [O: 過去値]
                                  └─ --置換済み--> [O: 置換先]
```

## 2. 横断関係

| 関係 | 意味 | 混同しないもの |
|---|---|---|
| Project―Repository | 一つの論理Projectを一つ以上のRepositoryが支える | Project IDとRepository ID |
| Repository―Binding | 論理Repositoryを検証済みの実在Rootへ結ぶ | 名前・Pathと検証済み結合 |
| Source―Projection | 正本から時点付きの読取り表示を導く | Projectionと正本 |
| Task―Attempt―Result | 同じ依頼と個々の試行・結果を結ぶ | 再接続と新規実行 |
| Effect―Recovery | 外部作用の成立状態と回復義務を結ぶ | 要求発行と作用完了 |
| Meeting―Candidate―Topic | 会話から候補を経て継続論点へ接続する | 会話と採用済み正本 |
| Change―Finding―Evidence | 変更、指摘、是正、確認根拠を同じ改訂版へ結ぶ | Checker合格と全品質合格 |
| Distribution―Trust | 配布物の準拠、完全性、配布者、利用者方針を結ぶ | 公式表示と利用許可 |
| 実行基盤―境界―利用可能能力 | 一部の故障と、その後も続けられる仕事を結ぶ | 一つの境界の故障と実行基盤全体の停止 |
| 過去値―現在の意図―置換先 | 当時の判断と現在有効な情報を結ぶ | 履歴と現在値 |

## 3. 定義への案内

各対象の識別、成立条件、状態、責任、下流義務は[IA定義台帳](01_Information_Architecture.md#3-ia定義台帳)から辿る。本書は定義を置き換えない。
