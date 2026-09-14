# `.crdd`に残ったものの意味を、後から迷わない

成果物種別: Discovery Analysis
探索ID: `EXP-000016`
状態: 要求採用
主な情報源: `.crdd`のPath棚卸し、CHG-000066
判断する人: Qual-Lab
記録の性質: `.crdd`全Path棚卸し、清掃運用およびCHG-000066から再構成
時系列根拠: v0.21のPath棚卸しとCHG-000066を起点とする。

## きっかけ

実行記録、回復情報、試験の一時物、Release候補、設定が`.crdd`へ増えた。直下や`test-tmp`に由来の分からないファイルが残り、消してよいのか、再開に必要なのかを調べ直す場面があった。

実際には、同じ「実行時ファイル」でも終了後に消せる試験一時物、後から読む実行履歴、失敗後の回復義務、Git管理するRepository設定では扱いが異なる。また、単一Repositoryの情報と、複数Repositoryを束ねるCROS Serverの情報を同じRootへ置くと、所有範囲が曖昧になる。

| 種類 | 必要な性質 | 誤って扱った時の影響 |
|---|---|---|
| Repository設定 | Commitと結合し、秘密を含めない | 実行時変更やSecretがGitへ入る |
| 状態・実行履歴 | Ownerと保持期間を辿れる | 古い状態を現在値として読む |
| Recovery | exact Identityと再入場を保つ | 必要資源を削除し、回復不能になる |
| Test／tmp | 再生成可能で終了後に消せる | ゴミが累積し、由来不明になる |

## 本当の問題

フォルダ名が揃っていないことだけではなかった。誰が作り、何に使い、失敗や取消の後にいつ消せるかを、一つのLifecycleとして決めていなかったことが問題だった。

## 置いた仮説

Repository内の`.crdd`には、そのRepositoryに属する情報だけを置く。用途の近いものを浅い親子階層へまとめ、各領域のOwner、耐久性、保持期間、清掃条件、回復の要否を定める。複数Repositoryを横断するCROSの情報は、OS管理のRuntime Rootへ分ける。

| 方向 | 問題 | 採否 |
|---|---|---|
| ToolごとにTop-level Directoryを作る | Tool数とともに分類が増え、Lifecycleを横断できない | 不採用 |
| Project IDごとにRepository-local `.crdd`を深掘りする | 一つのRepository自身の情報なのにIdentityが重複する | 不採用 |
| Repository-localとOS管理Rootを分け、用途で浅く分類する | 所有範囲とLifecycleをPathから確認できる | 採用 |

Directoryを整えるだけで旧Consumer、残存資源、清掃不能が残るなら、構造化は成立していない。

## 守ること

- `.crdd`は検証済みRepository Rootの直下だけに作る。
- Git管理する設定と、実行時だけの情報を分ける。
- `tmp/`は再生成でき、回復に不要なものだけに使う。
- 由来不明や回復途中のものを、名前や古さだけで削除しない。

## 後から分かったこと

フォルダ構成だけでは不十分だった。旧Pathを読む利用側が残ると新旧が混在するため、全Consumerの移行、旧Pathの拒否、全終了経路での清掃まで必要だった。

## 現在の判断

Runtime Data ContractはCHG-000066で実装・検証済みである。Workbenchは独自Storeを作らず、この構造から得た情報を投影する。

## 採用した要求

`REQ-000015`: Repository-local `.crdd`とOS管理のCROS Runtime Rootは所有範囲を分け、用途、Owner、耐久性およびGit管理可否をPath契約から一意に確認できなければならない。

`REQ-000022`: Runtime Dataは保持期限、清掃条件、Recovery要否および終了後状態を持ち、由来不明、参照中または回復途中の残存物を正常状態へ混ぜたり、推測で削除したりしてはならない。
