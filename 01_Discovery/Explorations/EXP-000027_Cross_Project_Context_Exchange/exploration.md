# Projectを越えても、Contextの出所と帰り先を失わない

探索ID: `EXP-000027`
状態: 要求採用
主な情報源: CRDD／CROS長期構想、Personal／Shared Server構想
判断する人: Qual-Lab
記録の性質: CRDD／CROS長期構想、Personal／Shared ServerおよびAgent連携の対話から再構成
時系列根拠: 2026-09-13に固定したv0.21構想群で、単一Project Federationの後にProject間交換を扱う依存順とした。

## きっかけ

Chat AgentとCoding Agent、複数Repository、複数Projectをつなぎ、必要なContextを渡したいという構想が具体化した。単一Repositoryでは足りない仕事がある一方、会話全文や全Projectを一箇所へ集めるのは危険だった。

代表的な仕事は、Chat Agentが複数Projectの状態を調べ、特定RepositoryのCoding Agentへ限定作業を渡し、その結果を元のProject判断へ戻す流れである。ここでは検索、Context選択、実行、結果還流の各段階で、読める範囲と書ける範囲が変わる。

```text
質問したProject
   ↓ 必要な情報を別Projectから解決
限定ContextをTaskへ結合
   ↓
Coding Agentが対象Repositoryで作業
   ↓
結果と根拠を元のTask・所有正本へ戻す
```

## 本当の問題

横断検索がないことではない。別のProjectへ渡した時に、どの正本から得た情報か、誰が読むことを許可したか、結果をどこへ戻すかが失われることだった。CROSが便利な中央正本になってしまう危険もある。

## 置いた仮説

CROSは許可されたProjectとRepositoryから、その仕事に必要なContextだけを改訂版付きで組み立てる。Agentへ渡す時もTaskのIdentityを保ち、結果は元の仕事と所有する正本へ戻す。

```text
Projectの正本
    ↓ 許可された範囲だけ解決
Context Package
    ↓ Taskと結び付けて渡す
Agentの実行
    ↓ 出所と帰り先を保つ
元のProject／正本へ結果を戻す
```

| 方向 | 問題 | 採否 |
|---|---|---|
| 全Contextを中央Indexへ複製する | 横断検索は容易だが、正本、現行性、非開示境界を壊す | 不採用 |
| Agent同士で会話全文を転送する | 文脈は多いが、目的外情報とSecretを混ぜやすい | 不採用 |
| Taskごとに必要なContext Packageを解決する | 出所、許可、改訂版、帰り先を限定できる | 採用 |

Contextを渡せても、結果がどのTask・正本へ戻るか確定しない場合は仕事の往復が閉じない。Context解決と結果還流は同じ探索内で扱うが、後続要求として独立検証できるかを確認する。

## 選ばなかったこと

- 全Contextを中央へ複製すること。
- 会話全文をそのままAgent間で転送すること。
- Serverが読める情報を、接続利用者も読めるとみなすこと。
- v0.21でProject間の自動最適化まで行うこと。

## 現在の判断

CROSはContext解決、Repositoryの束ね方、実行Session、結果の還流に責務を絞る。ProjectのWhyや重要判断は各Projectに残し、汎用IAMも作らない。

## 次工程で確かめること

一つのProject、複数Repository、複数Project、部分的なアクセス、情報源の競合、Agent間の引き渡し、結果の還流を段階的に確認する。UXはこれらの探索を統合し、人とAIがどう仕事を進めるかをService Blueprintへ落とし込む。

## 採用した要求

`REQ-000017`: CROSは、許可された正本から仕事に必要な最小Contextを出典、改訂版、利用範囲および欠測付きで組み立て、中央の第二正本を作らずAgentへ提供できなければならない。

`REQ-000024`: ProjectまたはAgentの境界を越えて仕事を渡す場合、Task Identity、許可範囲、結果の出所および帰還先を維持し、実行結果を元のTaskと所有正本へ戻せなければならない。
