# CHG-000015 Docker正式署名Recovery失敗実測記録

- 実測日: `2026-08-27`
- 署名配布物Commit: `153109228b9ca8f4a65cf2e27af2c71dcbdfa66f`
- 署名配布物Tree: `f53e91647133e7474c799cb558b36b6240a65e5e`
- Docker Desktop: `4.41.2`
- Docker Engine: `28.1.1`
- Recovery契約: `crdd-coordinator/docker-recovery` revision `18`
- 結果: `Blocked`

## 実測経路

Docker Desktopは、Local App Data配下の既知の実行用socketをOSがアクセス不能として起動できなかった。Docker関連Processを停止した後、既存の`run`ディレクトリを同じ親ディレクトリ内の一意な退避名へrenameし、削除せず保持した。Docker Desktopを再起動し、Docker Engineが応答することを確認した。このHost復旧ではCRDD RuntimeState、Provider Home、container、imageまたはvolumeを削除していない。

Engine復旧後、署名配布物から同一のexact Recoveryを2回実行した。両試行はWindows終了コード`0xC0000409`でnative終了した。いずれもreconciled receiptは作成されず、対象の認証Probe containerとRecovery Evidenceは保持された。

## Effect境界

- Provider request: `0`
- Task execution: `0`
- 追加Network Effect: `0`
- canonical Repository変更: `0`
- Recovery receipt作成: `0`
- auth container削除: 未成立
- Recovery residue `0`: 未成立

## read-only縮約Probe

次のread-only Probeは終了コード`0`で完了した。

- Host Operation lock、Provider Home lock、RuntimeState lockの取得と全解放
- Docker recovery hashの再構成
- lock外でのexact container inspect
- container ID、name、ownership labelおよび`Networks.none`の再照合

これらは、Docker接続、exact container照合および`Networks.none`の再構成が単独では成立することを示す。production Recoveryの成功、RuntimeState再検証後のreceipt耐久化、cleanup、残存`0`、native failure主体または全failure／cancel matrixは証明しない。

## 現在の判定

native failureの発生位置はexact reconciliation後からreceipt作成前の境界へ縮約したが、破損主体は未特定である。新しい固定署名版でexact Recovery、cleanup、残存`0`および必要なfailure／cancel matrixが成立するまで、実Provider Dogfooding、Coordinator Runtime 1.0完成およびReleaseの根拠として使用してはならない。

この記録にはCredential、passphrase、秘密値、Provider出力または不要なHost Pathを含めていない。
