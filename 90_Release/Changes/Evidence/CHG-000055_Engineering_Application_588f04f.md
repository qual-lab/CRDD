# CHG-000055 Engineering Application 評価記録

## 結論

Runtime architecture README 189-208行の正常・準正常・異常設計期待を、短いSigned E2E Evidenceの実測記録へ限定照合した。正常4経路は実Providerで成立した根拠がある。一方、固定Worker timeoutと固定Worker親Process喪失はfixed verification workerの復旧試験であり、実Providerの全異常系成立へは拡張しない。ソースコード、試験コード、Runtime全体の完成、全体監査Passはこの記録の確認範囲外である。

| ケース | 設計上の期待 | 実測根拠 | 終了後状態 | 未確認 |
|---|---|---|---|---|
| 正常4経路 | 4経路、承認、必要なら一回是正、全cleanupによりCandidate公開、Recovery ID 0、残存資源0 | Signed E2E Evidenceで実Provider 4/4完了。Executor／Reviewerは実Provider接続、是正0、再試行0、限定置換、候補完全一致と破棄を記録 | 正本Repository変更0、未解決Recovery 0、cleanup不明0、実行前後Git worktree clean | 是正1回経路、実FrontアプリIdentity認証、任意実務Task、ソースとの整合 |
| 固定Worker timeout | Provider timeout等は安全なblockedまたは決定論的回復。未知状態へ誤昇格しない | Signed E2E Evidenceで復旧入口がtimeoutを確認。固定Workerのみ、Provider認証・外部Provider通信なし | 復旧試験7/7の一部として完了。cleanup不明は結果上0と記録されるが、timeout単独の資源delta詳細はこの短いEvidenceでは未観測 | 実Provider timeout、Runtime内部状態名、operator移送有無、終了後資源の種類別観測 |
| 固定Worker親Process喪失 | 親Process消失はResult非公開、Evidence保持、exact Recoveryまたはoperator移送 | Signed E2E Evidenceで親Process消失からのfresh recoveryを確認。固定検証Workerを用いた試験であり、今回読んだ要約だけでは物理観測の具体的範囲を確定できない | 復旧試験7/7の一部として完了。未解決Recovery 0、cleanup不明0と記録 | 実Provider親Process喪失、manual recovery要否、operator移送条件、終了後観測objectの完全一致 |

## 残る確認

- 入口: Runtime所有者がREADME 189-208行の各期待を、該当する実行入口と機械可読Traceへ接続しているか。
- 所有者: Provider境界、fixed verification worker境界、cleanup観測、manual recovery判断を誰が承認・保守するか。
- 終了後観測: cleanup不明、未観測、0件をEvidenceの粒度で分け、固定Worker異常系を実Provider全異常系の根拠へ読み替えていないか。
- ソース照合: この記録ではソースコードと試験コードを読んでいないため、設計と実装の完全整合は次のレビュー入口で別途確認する。

## 親による追加確認と是正

独立レビュー済み候補には、固定Workerの試験を契約投影だけと断定する表現があったため、上表を「今回読んだ要約からは範囲を確定できない」へ訂正した。元候補は[実行記録](CHG-000055_Focused_Dogfooding_588f04f.json)に保持する。この追記と訂正はRuntime内レビュー後の親による変更であり、最終独立監査は未完了である。

親は追加で[固定版の復旧結果](CHG-000015_Signed_Recovery_Matrix_a619545.json)とCommit `a619545ff7f30f3ec65efa134994abc0f825421a`の`tools/coordinator/scripts/verify-signed-recovery-matrix.ts`にある`verifyParentLossThenRecover`の実装を確認した。同実装は実子Processを開始し、`taskkill`後の終了を観測してfresh recoveryを行う。結果も`childProcessTerminationObserved: true`を保持する。固定Workerであることは実Process観測がないことを意味しない。一方、実Providerの親Process喪失を測定した根拠ではない。説明契約だけを検査する試験と、署名済み実行入口を区別するよう、参照元Architectureの曖昧な一文も是正した。
