# Phase 5 AI依頼モード境界

成果物種別: Verification Evidence
対象Change: `CHG-000082`
観測日時: 2026-09-28 01:37 JST

## 結論

WorkbenchのAI依頼は、`read_only_advice`と`change_candidate`を利用者が明示し、その値をApplication Portへexactに渡す。前者を変更候補へ読み替えず、後者を自動採用しない境界をUI、SPEC、ArchitectureおよびQualityへ伝播した。

実Providerへの送信は行っていない。現行Coordinator Taskは変更候補向けであり、読取り助言へ流用しない。両モードを外部AIへ接続するProduction AdapterとProvider E2Eは未完了である。

## 検証

| 対象 | 結果 | 観測 |
|---|---|---|
| Workbench入力 | PASS | 依頼種別を必須入力とし、許可した2値以外を拒否する |
| Application搬送 | PASS | Profile ID、依頼種別、PromptおよびContext参照を同じCommandへ渡す |
| 結果表示 | PASS | 現在依頼の種別を状態と共に表示する |
| 互換する画面幅 | PASS | 4入力用Desktop Grid、2列中間幅および1列Mobileを定義した |
| Workbench契約試験 | PASS | `workbench-server.contract.test.ts`を含む16件がPass |
| Workbench静的確認 | PASS | format、typecheckおよびlintがPass |
| 外部AI Effect | 未実施 | 外部送信許可を使用せず、Provider Effect 0 |

## 残るGap

- 読取り助言を所有正本Effect 0で実行するCoordinator公開Application契約。
- 変更候補を既存Coordinator Candidate Flowへ接続するProduction Adapter。
- 両モードの外部送信Authority、結果相関、取消、回復および実Provider E2E。

## Checklist

- [x] 読取り助言と変更候補を同じ意味へ畳んでいない
- [x] 変更候補を自動採用していない
- [x] 現行Coordinator Taskを読取り助言へ流用していない
- [x] 実Provider成立を主張していない
- [x] 外部AIへ情報を送信していない
