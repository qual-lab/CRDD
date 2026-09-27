# Phase 3 Repository Work検証

成果物種別: Verification Result
対象変更: [CHG-000082](../change.md)
対象Local Item: `RFD-IT-014`、`RFD-ST-015`
観測日時: 2026-09-27 18:45 JST
基点Commit: `8ffe6d1f66118c9b45f176ed7f745b520216d016`
対象状態: 上記Commitからの未Commit変更候補。固定改訂版はPhase 3 Gate後のCommitで記録する。

## 結論

Phase 3のRepository WorkはPassした。Workbenchから選択PathだけをStage／Unstageし、準備済み差分だけをCommitした後、設定済みupstreamから観測したRemote、BranchおよびCommit Identityを利用者へ提示して、明示確認後だけ通常Pushできる。

Push通信断、Remote反映の再観測不能および操作後のProject Surface再読込失敗を、成功または操作前拒否へ畳まない。公開結果が不明な場合は自動再送せず、同じRemote／Branch／Commitを再観測して人間が次の操作を判断する。Force Pushは発行しない。

## 成立した経路

```text
実Browser
  ↓ 表示されたRepository状態と確認対象を観測
Workbench localhost HTTP
  ↓ 起動ごとの操作Token
Workbench Application Adapter
  ↓ Canonical Change Publication Request
Version Control Port
  ↓ 固定Git Adapter
Local Repository / bare Remote
  ↓
Effect結果と操作後再観測を別々に表示
```

## 実Browser観測

CRDD Repositoryを入力にProduction Workbenchを`127.0.0.1`で開始し、Codex内Browserから次を確認した。RepositoryへのBrowser操作は発行していない。

| 確認 | 結果 |
|---|---|
| 公式ロゴとDirection A | Pass |
| Staged／Working／Untrackedの分離 | Pass |
| Remote | 設定済みupstreamから`origin`を表示 |
| Branch | 設定済みupstreamから`codex/feature/v0.22`を表示 |
| Commit | 現在の固定Revision `8ffe6d1f66118c9b45f176ed7f745b520216d016`を表示 |
| 公開確認 | Remote／Branch／Commitの表示値を確認するCheckboxを持つ |
| Force Push入口 | 0 |
| Credential入力 | 0 |

## 自動検証

| Scenario | 結果 | Oracle |
|---|---|---|
| 不正操作Token | Pass | HTTP 400、Repository Effect 0 |
| 選択Stage／Unstage | Pass | 選択Pathだけを処置 |
| Commit | Pass | 準備済み差分だけからRevisionを作成 |
| 確認後のHEAD変更 | Pass | Push Effect前に拒否 |
| 通常Push | Pass | Forceなし、Remote Revision一致を再観測 |
| Push通信断 | Pass | `unknown`、Effect発行済み、確認不能、自動再送0 |
| Remote反映再観測不能 | Pass | `unknown`、Effect発行済み、確認不能、自動再送0 |
| 操作後Project Surface再読込失敗 | Pass | 操作完了を保持し、Repository表示だけをUnknownへ落とした |
| 終了後状態 | Pass | Listener、Git Processおよび試験Fixtureを残さない |

```text
version-control
tests 44 / pass 44 / fail 0

workbench
tests 6 / pass 6 / fail 0
```

## 入力Manifest

| 入力 | SHA-256 |
|---|---|
| `40_Develop/workbench/src/workbench-server.ts` | `547559cac7ec1fc43aa22fe2e4dd7a600922d63f6798e92429710bcf8f9e8bfc` |
| `40_Develop/workbench/src/project-surface.ts` | `60d00043693de0408bac87ad30e48cfc0a97e8d065ed676588ab4d50fd038b55` |
| `40_Develop/workbench/tests/integration/workbench-server.contract.test.ts` | `2c360130bd95fc36e71d81d220e00ac0fe480f1e3035d66ac3b9f8005d4872e0` |
| `40_Develop/version-control/src/change-publication.ts` | `dff2b6129c3dc51455958649d3c87439e8fc8219f885f12d8522c7e8f6994c6a` |
| `40_Develop/version-control/src/git/change-publication-adapter.ts` | `37f2dafe23fed3ae5f29b8e9f140a31c784bcf7818d159c544cddd7e1b91d512` |
| `40_Develop/version-control/tests/integration/change-publication.integration.test.ts` | `62a0697a1a6315be5690a4cad7770bc23d87114d818fb413bef63664aa4a3621` |

## 限定

- 本結果はRepository単体利用のPhase 3を対象とする。Remote CROS接続、Role Credential、AI依頼、Topic／Meeting CRUDまたは全15 Screenの完成を証明しない。
- Browser観測は表示と確認境界を対象とし、現在のCRDD作業RepositoryへStage／Commit／Pushを発行していない。Effect経路はRepository-local試験Repositoryと一時bare Remoteで検証した。
- 通信断後の自動再送は許可していない。再観測後の再実行には新しい人間判断が必要である。

## Checklist

- [x] Remote、BranchおよびCommitを手入力ではなく観測値として提示した。
- [x] 利用者確認前にPushを発行しない。
- [x] Force Pushと暗黙再送を発行しない。
- [x] Effect結果と操作後Read Model再観測を分離した。
- [x] 拒否、通信断、結果不明および再観測不能を成功へ畳まない。
- [x] 実Browser表示と実Git Effect境界を別々に確認した。
- [x] Credential、生Git出力、Remote URLまたはHost絶対PathをEvidenceへ保存していない。
