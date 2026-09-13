# 複数のRepositoryを、一つのProjectとして見る

探索ID: `EXP-000009`
状態: 要求採用
主な情報源: Project、Commercial、Topics、Meetingsの分離構想
判断する人: Qual-Lab
記録の性質: Project／Commercial／Topics／Meetings分離の対話とCROS設計候補から再構成

## きっかけ

Commercial、Topics、Meetings、Communicationなどを、必要に応じて別Repositoryへ分けたいという話が出た。情報の種類や読める人が違うため、何でも一つのRepositoryへ集めるのは現実的ではない。

代表例では、一つの案件に開発者向けRepositoryとManagement向けRepositoryがあり、同じProjectに属しながら読める人と所有する情報が異なる。逆に小さな案件では、一つのRepositoryだけで全Contextを持つ方が自然である。

| 構成 | 成立させたいこと |
|---|---|
| 一つのProject・一つのRepository | Federationなしでも通常利用できる |
| 一つのProject・複数Repository | 責務とアクセス境界を保って一つに見せる |
| 一部Repositoryだけ利用可能 | 見えない情報を推定せず、不足として扱う |
| 同じ責務を複数Repositoryが宣言 | 探索順で選ばず競合を返す |

## 最初に混同していたもの

一つのProjectは一つのRepositoryだ、と考えると話が簡単に見える。しかし実際には、一つの案件が製品、開発、管理、Commercialなど複数のRepositoryを持ち得る。逆に、一つのRepositoryの名前や配置だけからProject全体を推定するのも危険である。

## 置いた仮説

Project IDとRepository IDを分け、各Repositoryが「どのProjectに属し、何を担当するか」を宣言すれば、一つの論理Projectとして束ねられると考えた。

```text
Project PRJ-001
  ├─ Repository PRJ-001-DEV   開発・品質
  └─ Repository PRJ-001-MGMT  Project・Commercial
```

各Repositoryは自分の情報だけを持つ。Project全体を一箇所へコピーせず、CROSが許可された範囲だけを読み取って投影する。

| 仮説 | 問題 | 採否 |
|---|---|---|
| 基準Repository配下へ他Repositoryをぶら下げる | 基準側が全Projectの所有者に見え、障害・権限境界も集中する | 不採用 |
| 各RepositoryへProject情報を複製する | 同期と現行性の正本が分からなくなる | 不採用 |
| Project ID、Repository ID、検証済みRootを分けて解決する | 同居と分離の両方を表現できる | 採用 |

Identity分離だけでは十分ではない。責務、利用可否、出典、競合を失って統合した場合は、同じProject IDでも安全なFederationとは扱えない。

## 守ること

- 読めないRepositoryを「存在しない」「問題なし」と扱わない。
- 別Repositoryの本文を同期用に複製しない。
- Repositoryの実アクセス境界を、CROSの要約で迂回しない。
- 同じ役割を複数Repositoryが名乗った時は、探索順で勝手に選ばない。

## 現在の判断

Project、Repository、実際のRootとの結び付けは別のIdentityとして扱う。細かな権限管理製品は作らず、Repositoryのアクセス境界とWorkspaceへの公開範囲を利用する。

## 次工程で確かめること

一つのRepositoryだけのProject、複数RepositoryのProject、読めない情報源、役割の競合を代表例にする。UXでは、通常の利用者へ裏側のRepository分割を意識させず、不足だけは隠さない体験を作る。

## 採用した要求

`REQ-000009`: 論理Project、各Repositoryおよび検証済み実行Rootは、相互に代用しない独立したIdentityとして結び付けられなければならない。

`REQ-000020`: 複数Repositoryを一つのProjectとして解決する場合、各Repositoryの出典、責務、利用可否、欠測および競合を保ち、探索順や複製された本文から正本を推定してはならない。
