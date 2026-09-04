# 再ログオン回復の構造是正に関する署名前検証

## 1. 結論

選択ユーザーの安定IdentityとログオンSession Identityを分離し、Docker Desktop修復履歴とDocker Task Recoveryを再ログオン後の現在Sessionへ安全に引き継ぐ構造是正について、関連する決定論的確認はすべて成功した。

元の修復記録、Task Recovery記録およびRecovery IDは変更しない。安定Identityは耐久相関にだけ使い、現在の変更権限は現在の署名済みRuntime、Root Identityと保護、Policy、物理LockおよびfreshなSession観測から再構成する。引継ぎは上限付きの順序付き記録として別に追加し、旧SessionのAuthorityまたは資源を再利用しない。

この結果は署名前の技術候補に対する確認である。独立再監査、Runtime実行Identityの再署名、実際のDocker Desktop修復、Docker Task Recoveryおよび実Provider最終E2Eは未完了であり、v0.19全体の`Pass`またはRelease成立を意味しない。

## 2. 対象と変更禁止範囲

対象は次の一つの構造是正クラスタである。

- Docker Desktop修復履歴の旧Release・再ログオン引継ぎ
- 終了済み旧修復のEffect 0採用・終了と、現在障害の別Operation化
- 未終了修復の段階別分類
- Docker Task Recoveryの同一Recovery IDによるSession引継ぎ
- Host世代、論理Home、Runtime State Lockの観測前解放と同一Identityでの再取得
- 引継ぎ記録の改変、番号飛び、循環および上限の拒否

元記録の書換え・削除、旧Session Authorityの再利用、自動Docker修復、再起動Fenceの緩和、Provider EffectおよびRecovery IDの再発行は行わない。

## 3. 実装した意味

| 境界 | 実装結果 |
|---|---|
| 安定Identity | 再ログオンをまたぐ同一所有者の耐久相関だけに使用 |
| Session Identity | 発行時証拠として元記録へ保持し、現在Authorityへ流用しない |
| 現在Authority | 現在Runtime、Root保護、Policy、Lock、変更前後のfresh観測から再構成 |
| 修復履歴 | 元chainを不変に保ち、Session間の引継ぎと終了を別の順序付き記録へ追加 |
| Task Recovery | 元Recovery IDを維持し、現在Sessionへの引継ぎ後にだけ回復処置を許可 |
| 外部観測 | Host／Runtime State世代Lockを解放して観測し、同じIdentityで再取得できた場合だけ継続 |
| 連鎖上限 | 8件まで。9件目、番号飛び、改変、自己参照・循環・分岐をEffect 0で拒否 |

## 4. 検証結果

実行環境はWindows、Node.js `24.19.0`、対象packageは`40_Develop/coordinator`。実Provider、Release秘密鍵およびDocker修復は使用していない。

| 確認 | 結果 |
|---|---|
| Docker Desktop修復Record、Runtime修復、Docker Task Recoveryの関連3契約群 | 191件中191件成功、失敗・取消・skip 0、112.318秒 |
| TypeScript型検査 | 2構成とも成功 |
| Runtime設計追跡 | 資源9、状態20、遷移21、不変条件11、検証対応10で成功 |
| Lint | 314ファイル、警告・エラー0 |
| 整形確認 | 313ファイル、差分0 |
| 差分形式 | `git diff --check`成功 |

## 5. 反証できた事項

- 同じ安定Identityだけでは、生存中Authorityまたは変更権限を復元しない。
- 現在Session、Root Identity／保護、PolicyまたはRuntime実行Identityが異なる場合は引継ぎ・変更を行わない。
- 終了済み旧修復は現在Dockerを観測できなくてもEffect 0で履歴を閉じられるが、現在障害の修復成功とは扱わない。
- 未終了の旧stageを履歴採用だけで再実行せず、現在状態の観測不能を成功へ畳まない。
- Task Recoveryは再ログオン後も同じRecovery IDを使うが、現在SessionのLockとfresh観測なしに処置しない。
- 外部観測中に保持できない世代Lockを保持したまま観測せず、解放後に別Identityへ置換された場合は停止する。
- 引継ぎ記録が正しいcommit pairでも、番号が飛んでいれば採用しない。
- 8件の引継ぎ成立後の9件目は、新しい記録または回復Effectを発行せず拒否する。

## 6. 残るGate

本記録を含む固定Commitを対象に、合意した意味契約、契約母集団、利用側母集団、反例および変更禁止範囲を独立再監査する。Critical 0件かつMajor 0件を確認した後だけRuntime実行Identityを署名し、署名済み実Docker／実Provider最終E2Eへ進む。

新しい非文書Findingを検出した場合は局所修正を開始せず、構造と伝播範囲を再確認して監査担当と修正方針を再固定する。
