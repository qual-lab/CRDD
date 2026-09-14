# Repositoryで使えるToolを、利用側に推測させない

成果物種別: Discovery Analysis
分析ID: `EXP-000025`

探索ID: `EXP-000025`
状態: 要求採用
主な情報源: CRDD標準Tool、MCP／Coordinator／CIからの共用構想
判断する人: Qual-Lab
記録の性質: CRDD標準Tool、MCP／Coordinator／CI共用の対話から再構成
時系列根拠: 2026-09-13に固定したv0.21構想群で、Project利用契約の後にTool能力を扱う依存順とした。

## きっかけ

Build、Test、Preview、Migrationなどを、人、MCP、Coordinator、Scheduler、CIから共通して使いたいという要求が出た。一方で、ToolごとにLauncherを増やすだけでは、どこからどう起動してよいかが揃わない。

利用側ごとに見えている情報も異なる。人はREADMEやファイル名を読めるが、MCPやSchedulerは機械的な入力・出力・Effect境界を必要とする。実行ファイルが存在しても、現在のHostで利用可能とは限らず、利用可能でも今のOperationに許可されているとは限らない。

```text
ToolがRepositoryに登録されている
        ↓ 別判定
外部入口へ公開されている
        ↓ 別判定
現在のHostで利用できる
        ↓ 別判定
今回のOperationで実行を許可されている
```

## 本当の問題

Toolが少ないことではない。利用側がフォルダ名や実行ファイルの存在から、Working Directory、必要な環境、変更範囲、取消、終了後の清掃まで推測していたことが問題だった。また、Toolが存在することと、今のOperationで実行してよいことも別である。

## 置いた仮説

Repositoryが提供する安定した能力を小さなRegistryへ登録し、TS API、CLI、必要なMCP Adapterから同じ定義を使う。登録、外部公開、Hostでの利用可能性、実行許可は別々に判定する。

Directoryを走査して実行可能なものを自動発見する案は、意味と許可を安全に決められないため選ばなかった。

| 方向 | 利点 | 問題 | 採否 |
|---|---|---|---|
| ファイル名とLauncherを規約化する | 人には分かりやすい | 入出力、Effect、取消、清掃を表現できない | 不採用 |
| Directoryから動的に発見する | 追加が容易 | 任意Codeと正規Capabilityを区別できない | 不採用 |
| 明示Registryと既存実装を結ぶ | 能力と利用条件を検証できる | 登録と実装の閉包確認が必要 | 採用 |

Registryの存在だけで実行可能または許可済みと表示した場合、利用側が再び推測するため、この仮説は失敗である。

## 守ること

- Toolの定義と実装はGit管理し、`.crdd`へ正本を移さない。
- 任意のShellや未登録Executableを実行させない。
- CROS側の一覧を各Repositoryの正本にしない。

## 現在の判断

Repository Tool／Capability Registryをv0.21で設計する。汎用Plugin Frameworkは対象外とする。

## 次工程で確かめること

一つの代表ToolをHuman CLI、MCP、Coordinatorから使い、同じ入力、結果、取消、清掃の意味になるか確認する。不許可の場合は、どの入口からも実行されないことを確かめる。

## 採用した要求

`REQ-000014`: Repositoryが提供するTool能力は安定したRegistryで定義し、登録、外部公開、Hostでの利用可能性およびOperationの実行許可を分けて判定できなければならない。
