# 再ログオン回復の構造是正に関する署名前検証

## 1. 結論

選択ユーザーの安定IdentityとログオンSession Identityを分離し、Docker Desktop修復履歴とDocker Task Recoveryを再ログオン後の現在Sessionへ安全に引き継ぐ構造是正について、初回固定版の独立監査で検出した公開途中状態とRelease連鎖の不足を含めて構造是正し、関連する決定論的確認はすべて成功した。

元の修復記録、Task Recovery記録およびRecovery IDは変更しない。安定Identityは耐久相関にだけ使い、現在の変更権限は現在の署名済みRuntime、Root Identityと保護、Policy、物理LockおよびfreshなSession観測から再構成する。引継ぎは上限付きの順序付き記録として別に追加し、旧SessionのAuthorityまたは資源を再利用しない。

初回固定版`f78fff4`の独立監査はCritical 0件、Major 2件、Minor 0件であり、署名適格ではなかった。検出事項は、修復履歴の公開後に準備ファイルだけが残る中断状態から安全に再入場できないことと、Release引継ぎ連鎖の単調性を前の要素との関係で検証していないことだった。両者を公開契約伝播の一つの構造是正として監査担当と再具体化し、読取り専用分類と対象を限定した再入場、耐久公開状態、Release連鎖、実装・利用側・反証試験・設計追跡の全数対応へ反映した。

その後の実Store／実Filesystem縦断では、履歴の存在を理由にRuntimeが永続化処理を省略し、試験用Stubがその差を隠していたことを検出した。これは新しい保証範囲ではなく、合意済みの引継ぎ契約が本番利用側へ伝播していない同じ構造是正クラスタである。履歴の有無だけで分岐せず、不正、履歴なし、終了済み、現在Session、過去Sessionを順序付きで分類し、過去Sessionだけは実Storeへexact 1件の引継ぎを追加するよう是正した。元chainの全fieldを不変に保ち、初回採用、Session引継ぎ、終了で許された差分だけを保存結果から再検証する。保存後の検証失敗または後段失敗でも、耐久記録をrollbackまたは推測削除せず、同じIdentityで次回inventoryへ返す。

この結果は更新後の署名前技術候補に対する自己確認である。更新固定版の独立再監査、Runtime実行Identityの再署名、実際のDocker Desktop修復、Docker Task Recoveryおよび実Provider最終E2Eは未完了であり、Major解消、v0.19全体の`Pass`またはRelease成立を意味しない。

## 2. 対象と変更禁止範囲

対象は次の一つの構造是正クラスタである。

- Docker Desktop修復履歴の旧Release・再ログオン引継ぎ
- 終了済み旧修復のEffect 0採用・終了と、現在障害の別Operation化
- 未終了修復の段階別分類
- Docker Task Recoveryの同一Recovery IDによるSession引継ぎ
- Host世代、論理Home、Runtime State Lockの観測前解放と同一Identityでの再取得
- 引継ぎ記録の改変、番号飛び、循環および上限の拒否
- 修復履歴の準備、公開、準備残存および次回再入場の耐久状態
- 同一Release列だけを許す起点、採用、各引継ぎ、終了、現在境界の単調性

元記録の書換え・削除、旧Session Authorityの再利用、自動Docker修復、再起動Fenceの緩和、Provider EffectおよびRecovery IDの再発行は行わない。

## 3. 実装した意味

| 境界 | 実装結果 |
|---|---|
| 安定Identity | 再ログオンをまたぐ同一所有者の耐久相関だけに使用 |
| Session Identity | 発行時証拠として元記録へ保持し、現在Authorityへ流用しない |
| 現在Authority | 現在Runtime、Root保護、Policy、Lock、変更前後のfresh観測から再構成 |
| 修復履歴 | 元chainを不変に保ち、Session間の引継ぎと終了を別の順序付き記録へ追加 |
| 耐久公開 | 準備ファイルだけの状態と、対象へ公開済みで準備ファイルが残る状態を区別。通常の読取りは変更せず拒否し、現在Authorityを再検証した対象限定の永続化だけが同じ実体の残存準備ファイルを収束 |
| Release連鎖 | `origin <= adoption <= handoff[0] <= ... <= handoff[n] <= closure <= current boundary`を要求し、同じSequenceは同一の署名済みRelease Identityに限定 |
| Task Recovery | 元Recovery IDを維持し、現在Sessionへの引継ぎ後にだけ回復処置を許可 |
| 外部観測 | Host／Runtime State世代Lockを解放して観測し、同じIdentityで再取得できた場合だけ継続 |
| 連鎖上限 | 8件まで。9件目、番号飛び、改変、自己参照・循環・分岐をEffect 0で拒否 |

## 4. 検証結果

実行環境はWindows、Node.js `24.19.0`、対象packageは`40_Develop/coordinator`。実Provider、Release秘密鍵およびDocker修復は使用していない。

| 確認 | 結果 |
|---|---|
| Coordinator制限Process全回帰 | 1,670件中1,670件成功、失敗・取消・skip 0、291.828秒 |
| 修復履歴の耐久公開、実Store縦断、Runtime修復、設計追跡の集中確認 | 130件中130件成功、失敗・取消・skip 0、7.144秒 |
| Windows実Process Gate | 7件中7件成功、失敗・取消・skip 0、3.649秒 |
| TypeScript型検査 | 2構成とも成功 |
| Runtime設計追跡 | 資源10、状態25、遷移24、不変条件12、検証対応15で成功 |
| Project Runtime設計追跡 | Interface 9、耐久記録10、資源14、Lock 4、Authority 7、Effect 9、状態機械7、遷移54、検証対応23で成功 |
| Lint | 318ファイル、警告・エラー0 |
| 整形確認 | 317ファイルで差分0 |
| CRDD全体Checker | Markdown 413件、リンク2,901件、Anchor 980件、エラー・警告0 |
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
- 準備ファイルだけが残る場合は通常読取りを成功へ畳まず、対象を限定した再入場だけが公開を再開する。
- 対象と準備ファイルが残る場合も、同じ内容だけでは所有を推定せず、同じファイル実体であることを確認できる場合だけ準備ファイルを除去する。
- 公開後の準備ファイル除去またはDirectory確定に失敗した結果を成功へ畳まず、次回の同じAuthorityで収束可能な状態として保持する。
- 引継ぎまたは終了のReleaseが直前要素より古い場合、および同じSequenceで署名済みRelease Identityが異なる場合は採用しない。
- 履歴が存在することを、現在Sessionへの引継ぎが保存済みであることと同一視しない。
- 現在Sessionは実行時に観測したexactな`localUserBindingHash`で判定し、呼出側が申告したIdentityを採用しない。
- 実Storeが返した元chainのfield差、許可されていない引継ぎ差分または終了差分を成功へ畳まない。
- 終了済み履歴は認証済みの読取り専用表示に限り、引継ぎ、終了追記、Host観測または新しいEffectへ進めない。

## 6. 残るGate

本記録を含む固定Commitを対象に、合意した意味契約、契約母集団、利用側母集団、反例および変更禁止範囲を独立再監査する。Critical 0件かつMajor 0件を確認した後だけRuntime実行Identityを署名し、署名済み実Docker／実Provider最終E2Eへ進む。

新しい非文書Findingを検出した場合は局所修正を開始せず、構造と伝播範囲を再確認して監査担当と修正方針を再固定する。
