# REQ-000015 Runtime Data Rootの所有と用途

成果物種別: Discovery Definition
要求ID: `REQ-000015`
Discovery判断: 要求採用
判断する人: Qual-Lab

## 要求

Repository-local `.crdd`とOS管理のCROS Runtime Rootは所有範囲を分け、用途、Owner、耐久性およびGit管理可否をPath契約から一意に確認できなければならない。

## 対象と利用状況

Repository-local RuntimeとCROS Serverが、設定、状態、実行履歴、回復、候補、一時物を保存する場面。

## 解く問題と望ましい変化

```text
現在: `.crdd`直下やTool別Pathへ由来不明の物が増えると、Owner、耐久性、Git管理、回復要否を後から判断できない。
    ↓
望ましい変化: Repository情報と横断Runtime情報を別Rootに置き、用途、Owner、耐久性、Git管理可否をPath契約から一意に確認できる。
```

## 採用理由と比較

Tool別Top-levelは増殖し、Project IDでの深掘りはRepository自身のIdentityを重複するため、所有範囲と用途による浅い分類を採る。

## 成立条件

- Repository-local `.crdd`を検証済みRepository Root直下だけに作る
- Repository設定、耐久状態、回復情報、再生成可能tmpを区別する
- CROS横断情報をRepository-local Rootへ混在させない

## 制約

- 秘密またはRuntime-only情報をGit管理対象へしない
- Directory名だけで現在性、参照中または削除可否を推定しない

## 検証意図

subdirectory起動、複数Repository、追跡設定、一時物、回復残存を作り、書込みRootと分類を観測する。

## 工程引渡し

| 引渡し先 | 失ってはならない意味 | 下流で決めること |
|---|---|---|
| UX | Runtime利用者・保守者、保存物を確認する状況、何がどこに属するか迷わない変化をUXへ渡す。 | Goal、独立Outcome、重要場面、失敗、体験品質 |
| IA以降 | 本要求のIdentity、状態、関係、制約、反証条件 | 各工程固有の情報構造、操作、振る舞い、検証 |

## 関係

- Source Analysis: [EXP-000016](../../Analysis/EXP-000016/exploration.md)
- Formal downstream input: UXは本Definitionを一次入力として分析し、判断理由の再確認が必要な場合だけSource Analysisへ戻る。
