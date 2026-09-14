# REQ-000034 Repository固定Commitから使える標準Tool

成果物種別: Discovery Definition
要求ID: `REQ-000034`
Discovery判断: 要求採用
判断する人: Qual-Lab

## 要求

CRDDをRepositoryまたはsubmoduleとして導入した利用者は、別配布物との手動Version照合なしに、その固定Commitへ結び付いた標準ToolとRuntime入口を利用できなければならない。

## 対象と利用状況

CRDDをRepositoryまたはsubmoduleとして導入した利用者が、取得したCommitに対応する標準Toolをすぐ使う場面。

## 解く問題と望ましい変化

```text
現在: Runtimeを別配布するとVersion照合が利用者責任になり、SourceだけではToolchain差と初回Buildが導入障壁になる。
    ↓
望ましい変化: 固定Commitへ結び付いた標準ToolとRuntime入口を、別配布物との手動照合なしに利用できる。
```

## 採用理由と比較

Repository同梱を採り、Binary更新をRelease／Milestoneの規律に限定してSourceと実行物の対応を保つ。

## 成立条件

- clone／submodule取得した固定Commitから標準入口を発見できる
- 同梱ManifestとRuntimeが対象Commit／配布集合へ整合する
- 別Releaseの手動DownloadやVersion推測なしに代表Toolを起動できる

## 制約

- 毎CommitでBinaryを無条件更新しない
- 将来のLinux、macOS、LFS方式を現行要求で先取りしない

## 検証意図

fresh clone、submodule、版不一致、欠落Runtime、改ざんManifestを用い、発見、拒否、代表起動を観測する。

## 工程引渡し

| 引渡し先 | 失ってはならない意味 | 下流で決めること |
|---|---|---|
| UX | 導入者、初回利用または固定版再現の状況、Version合わせに迷わずToolを使う変化をUXへ渡す。 | Goal、独立Outcome、重要場面、失敗、体験品質 |
| IA以降 | 本要求のIdentity、状態、関係、制約、反証条件 | 各工程固有の情報構造、操作、振る舞い、検証 |

## 関係

- Source Analysis: [EXP-000005](../../Analysis/EXP-000005/exploration.md)
- Formal downstream input: UXは本Definitionを一次入力として分析し、判断理由の再確認が必要な場合だけSource Analysisへ戻る。
