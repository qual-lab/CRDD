# CHG-000015 現在のレビュー記録

- 固定対象Commit: `a639d87aa334bf11d5ec8d603850a2b64d3b5549`
- 固定対象Tree: `aeb794060cb435f7a8f5611521b0608025c23511`
- 共通機械確認: Checker Error `0` / Warning `0`、Coordinator `87 / 87 Pass`、Checker `143 / 143 Pass`、diff／worktree clean
- 現在状態: 固定ローカルAuthority File Bundle Core候補の独立確認完了／Runtime所有Path・ACL・activation未実装／Authority Capability未発行／Execution Environment Gateは`blocked`

| 確認 | 結果 | 固定記録 | SHA-256 |
|---|---|---|---|
| Agent／Architecture／Security Review | `Pass` | [`CHG-000015_Agent_Security_Review_a639d87.md`](CHG-000015_Agent_Security_Review_a639d87.md) | `EF9088A8A515CEEC1B9BC691D79CAD9882E1A84A09BE24AE7B69F0A46A409CB4` |
| Document Audit | `Pass` | [`CHG-000015_Document_Audit_a639d87.md`](CHG-000015_Document_Audit_a639d87.md) | `0AD62A91C9A0AB79184E6DC46A498114CB6AB9703447568154251089B9A6E783` |
| Gap／Impact＋Conformance Audit | `Pass` | [`CHG-000015_Gap_Conformance_Audit_a639d87.md`](CHG-000015_Gap_Conformance_Audit_a639d87.md) | `66ACF085F5C1C141E1679537D56774E3109E41D196F62F19673415589C583DA7` |

## 独立確認済み範囲

- Runtime 1.0の正式取得方式を固定ローカルFile Bundleだけとし、IPC／Network Transportを1.0後へ送る人間決定の伝播
- `bundle.json`、`trust-policy.json`、`authority-registry.json`の固定3ファイル契約
- Manifest／Policy／Registryのbyte上限、所有copy、strict UTF-8、BOM拒否、canonical JSON完全一致、状態および相互Hash
- Prelaunch候補へのBundle ID／revision／Hash、Policy、Registry、Grant、Profile、Operation／ScopeおよびRuntime時刻の結合
- Core候補、Path／ACL／activation未実装、Capability未発行およびGate `blocked`の直接利用側伝播

上記は固定Commit／TreeのFile Bundle Core候補と直接利用側に限る。旧`5d1d337`および`15fdcb2`の結果は各前段Coreの履歴であり、今回差分の合否へ流用していない。

## 未解決・未評価

- Runtime管理root、固定Path、親／各fileのrealpath containment、non-link／non-reparse、所有主体／ACLおよび実体Identityは未実装。
- 3ファイル同一snapshot、原子的置換、前版実Hash照合、revision単調性、取消／有効化および起動直前再読取りは未実装。
- Authority Capability、Provider起動結合、Credential Broker、実Proxy、Docker Network、DNS／TLS、実Egress、実Providerおよび実Operationは未実装または未評価。

## Current Decision Set

次段階ではQual-LabによるWindows正式配置の人間判断が必要である。今回決める対象は、Runtime 1.0のAuthority Bundleを所有する固定machine-wide rootと、導入／更新主体、Runtime読取り主体およびACLモデルである。

推奨は、固定rootを`%ProgramData%\Qual-Lab\CRDD\Coordinator\authority\active`、Runtime主体を専用Windows service identity `NT SERVICE\CRDDCoordinator`とする方式である。`SYSTEM`と`Administrators`だけにroot／Bundleの作成・置換・取消を書込み許可し、Runtime serviceには読取り／実行だけを許可する。通常ユーザー、Provider子プロセスおよび他Operationには到達権を与えない。導入・更新は昇格済みinstaller／管理操作に限定し、Runtime自身はAuthority Bundleを書き換えない。

この方式はユーザー自身によるTrust Policy差替えを防ぎ、machine-wideな自動運用でAuthorityと実行主体を分離できる。一方、導入・更新には管理者権限とservice登録が必要で、開発環境の準備負担が増える。代替のper-user rootは導入が容易だが、同じユーザー権限でBundleを書き換えられるため、Runtime 1.0の正式な無人実行保証には採用しないことを推奨する。

判断を保留または不採用とする場合、Path Adapter、Authority Capability、Provider起動結合、Proxy／Brokerおよび実Operationは開始しない。全体Gateは`blocked`を維持する。

この記録はRuntime完成、利用許可、採用、準拠、移行、Stable、Releaseまたは公開を意味しない。
