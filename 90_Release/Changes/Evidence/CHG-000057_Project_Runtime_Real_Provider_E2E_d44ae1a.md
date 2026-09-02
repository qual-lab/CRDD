# Project Runtime実Provider E2E実測

関連変更: [CHG-000057](../CHG-000057_Minimum_AI_Native_Project_Runtime.md)

## 結論

署名固定版Source A `8cb138374d2c360f772b7ef9dbfa7d6e7797fd38`と、Manifestだけを加えたSource B `d44ae1ae91c05eb0d75f061d3fd44aa7cac81172`を使用し、Project Runtimeの実Provider E2Eを実行した。Codex Executor／Claude ReviewerとClaude Executor／Codex Reviewerの2経路はいずれも`project_runtime_milestone_accepted`へ到達し、後者では正本採用Receiptも確認した。

全Taskでcleanupを確認した。手動Recovery、Process再起動義務およびRecovery ID残存は0件だった。MCP stdio Processは2 Objectiveを受け、認証済みprincipal、親EOFのjoin、および無効DecisionのEffect 0を確認した。

## Turn契約是正の実測

| Claudeの役割 | 指定目標 | Provider報告 | 絶対受理上限 | 指定目標超過 | 結果 |
|---|---:|---:|---:|---|---|
| Reviewer | 6 | 10 | 16 | あり | 成功結果を受理 |
| Executor | 8 | 4 | 16 | なし | 成功結果を受理 |

Reviewer経路は、Providerへ渡す作業量由来の目標とRuntimeの絶対受理上限を分離する今回の是正を直接確認した。指定目標超過は上限違反へ読み替えず、閉じた非Authority観測としてcleanup後のTask結果へ残った。絶対上限超過、不正値、Providerの上限到達エラーおよびcleanup未確認時の非公開は固定契約試験で確認しており、本実測から一般化しない。

## 実行結果

- 実行日時: 2026-09-03 03:40～03:49 JST
- 結果契約: `crdd-coordinator/project-runtime-real-provider-verification` revision 3
- 結果: `completed` / `project_runtime_real_providers_verified`
- Project Runtime所有の統合: 成立
- 正本採用: 成立
- 実Provider: Codex、Claude Code
- Task: 固定単一Pathの2件
- cleanup確認: 2/2
- 手動Recovery: 0
- Process再起動義務: 0
- Recovery残存: 0
- Release Authority発行: なし
- ローカル原記録: `.crdd/verification-results/project-runtime-real-providers-1788374981826/result.json`

## 限界

本結果は、固定単一Path Taskを用いた2経路のProject Runtime縦断実測である。任意Task、全Provider組合せ、実Provider処理中の取消、全Recovery組合せ、長期安定性、有用性比較、v0.19全体完成、採用、移行またはReleaseを意味しない。Source Bは実測時点のRepository Revisionであり、後続の文書・Evidence更新はRuntime実行Identityを変更しない。
