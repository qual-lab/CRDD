# 固定開発版の双方向実測：2経路とも完了

## 結論

2026-08-31、固定開発版`c6dbabd`の逆方向・順方向がともに完了した。独立レビューは両方とも指摘0・承認、是正とTask再試行は0。候補を破棄し、後片付けを確認した。手動回復、Process再起動、正本Repositoryの変更は不要だった。

| 経路 | 結果 | Task開始からRuntime結果まで |
|---|---|---|
| Claude Front → Codex実装 → Claudeレビュー | 完了、指摘0、是正なし | 436,407.1581 ms（約7分16秒） |
| Codex Front → Claude実装 → Codexレビュー | 完了、指摘0、是正なし | 386,019.5863 ms（約6分26秒） |

実呼出しは計4回。Codexは固定Linux環境の互換性条件により`gpt-5.5`、Claudeは`opus`。実装は低、レビューは中、速度は通常。既存Subscriptionと初期送信同意を使用し、API key・有料APIへの切替・追加購入は行わなかった。開発測定の開始確認は別に人間が入力した。Release鍵・再署名は不要だった。

## 固定対象と結果の再識別

- Repository: `qual-lab/CRDD`、Git object format: `sha1`
- Commit: `c6dbabded59c3b06cf27152e2a8d5a5d5e4ae8b0`
- Tree: `efe0da0b1049ee7dbbf4ba27a5c4be86662e3805`
- 開発package SHA-256: `784921b58e02551d1a8642a4e86944eb1d3e5a8fc810c86f002f1ff87eaa0844`
- 開発source Identity SHA-256: `83c01e6d42eb9678a95160897011dc9c9744a174057a4ddade7a618b7e826508`
- 別途検証したnative配布物manifest SHA-256: `ab73966a659717c28dbb379b5ba2477d3b884925b049658c52bb5b642649605e`
- Node.js: `24.19.0`
- 入力: 固定版の`createSignedGeneralTaskVerificationRequest`が生成する`reverse`、`forward`。最大2Task・8回呼出し、Task再試行なし。
- 入力JSON SHA-256: `8f18984f303a888bef800a798912258f2d7f8ff1b1912e0cf5c9014bc108c1cd`
- 実行入口: Repository-local `.crdd/e2e-distributions/development-c6dbabded59c3b06cf27152e2a8d5a5d5e4ae8b0/tools/coordinator/scripts/measure-development-providers.ts`
- 保存結果: `.crdd/dogfooding/development-measurement-result-1788148852507-36300.json`
- 結果SHA-256: `54ec22f7d2f61f07410d1f15f2d8a77de16c8e332377a5b544c22a12435b81ba`
- 結果生成時刻: 2026-08-31 13:00:52 JST。個別開始・終了時刻は未保存。表は単調時計による測定値で、人間受入までの時間ではない。

測定前後のHEADは上記Commitと一致し、追跡対象の差分はなかった。実行中の同一性確認はRuntimeが行い、両候補の開始Commit／Treeも同じ値だった。結果は`completed` / `measurement_completed`、完了件数2、後片付け確認済み。入口実装がこの結果から終了コード0を設定するが、外部PowerShell自体の終了コードは別保存していない。

結果JSONはGit管理外のため、削除された場合は同じ固定対象・入力から再実測する。Providerの生本文・tool履歴・credentialは記録しない。`credentialAbsenceVerified: false`を秘密情報の不存在証明へ読み替えない。

## 今回分かったことと、まだ分からないこと

[前回の停止と是正](CHG-000015_Development_Routes_56af5a1.md)後、同じ回数上限で逆方向が成功した。固定Taskのレビュー責務とRunnerの機械検証責務を分けた修正版で実行できることを確認した。ただし各経路1回だけであり、前回停止の直接原因や再発率を統計的に確定したものではない。

この入口は一般Taskと候補破棄を確認し、正式署名Runnerのbyte完全一致検査は呼ばない。両候補の変更Path、patchHash、contentManifestHashは一致したが、それだけで末尾LF・byte長・SHA-256の期待値との一致を証明しない。Frontは指定Profileであり、実アプリのIdentity認証ではない。正式4経路、同一Providerの2経路、最新固定版の復旧試験、完成監査またはReleaseの成功へ昇格しない。

実体照合はsession全体で343回、累計711,676.7245 ms。Task側の照合計測値0は、照合がなかったという意味ではない。session側の計測と責務を分ける。累積時間にはTask時間と重なる区間があり、独立した追加時間や削減可能時間へ読み替えない。両Task合計約13分42秒で、今回は完成速度の改善を示していない。

呼出し会計の`stopReason: cancelled`は、測定入口の`finally`でsessionを閉じる実装と合わせて読む。両Task完了・予約2件のsettled・追加呼出しなしという結果を、人間による途中取消へ読み替えない。

## 後続対応

性能と実体照合の反復は、[既存の有用性評価・改善候補](../../../01_Discovery/01_CRDD_Product_Discovery.md#runtime-utility-next-version-candidates)へ接続する。担当責任者はQual-Lab。現在の完成固定と実務自己適用の収束後に再評価し、安全判断へ影響する根拠が出た場合は現行是正へ戻す。今回の成功だけで性能改善済み、または現在の必須条件を次版へ移したとは扱わない。

現在の残件は[CHG-000015](../CHG-000015_Coordinator_Runtime_1_0.md#12-releaseまでの主要残件)で追跡する。次は最新固定対象で必要な残経路・厳密な結果検査・復旧検証を閉じ、E2E収束後に最終独立監査へ進む。
