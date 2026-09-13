# CRDDを追加しただけで、標準Toolをその場で使えるようにする

探索ID: `EXP-000027`
状態: 要求採用
主な情報源: CHG-000017、v0.18の配布方式判断
判断する人: Qual-Lab
記録の性質: submodule利用、Runtime同梱、Tool命名と入口整理から再構成
下流の主要CHG: CHG-000017

## きっかけ

CRDD採用RepositoryはCRDD本体をsubmoduleとして取り込む。ところがRuntimeだけを別Releaseから取得し、CommitとVersionを合わせる方式では、「CRDDを入れたのに使えない」状態になり、導入者が配布経路と整合を管理する必要があった。

## 比較した考え

| 配布案 | 利点 | 問題 |
|---|---|---|
| BinaryをReleaseだけで配布 | Git履歴が軽い | submoduleとRuntimeの版合わせが利用者責任になる |
| Sourceだけ同梱し各自Build | 改造しやすい | Toolchain差と初回Buildが導入障壁になる |
| 標準ToolとRuntimeをRepositoryへ同梱 | Cloneだけで固定版を使える | Release時だけBinary更新する規律が必要 |

Repository自体をCRDD Development Environment／Runtime Kitとして扱い、標準Toolは`template/tools`から利用できる形を採用した。Binaryは毎Commit更新せず、Milestoneで固定する。

```text
git clone --recurse-submodules
        ↓
CRDD/template/tools
        ↓
同じCommitに結び付いた標準Toolを利用
```

## 採用した要求

`REQ-000034`: CRDDをRepositoryまたはsubmoduleとして導入した利用者は、別配布物との手動Version照合なしに、その固定Commitへ結び付いた標準ToolとRuntime入口を利用できなければならない。

## 未確認範囲

将来Binaryが大きくなった場合のLFS等への移行、Linux／macOS配布、およびToolごとのLibrary／CLI／MCP公開境界は別の設計判断を要する。
