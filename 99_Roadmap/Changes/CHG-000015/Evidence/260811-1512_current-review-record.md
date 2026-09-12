# CHG-000015 現在のレビュー記録

- 固定対象Commit: `fdab76962460bfa9c59f6a9c5678f0b7a098e5cc`
- 固定対象Tree: `129d703d8930a19227ce6391c6ef2db64cb80867`
- 共通機械確認: Checker Error `0` / Warning `0`、Coordinator `93 / 93 Pass`、Checker `143 / 143 Pass`、diff／worktree clean
- 現在状態: Runtime Root選択／明示activation Core候補の独立確認完了／機能は既定無効／Path・activation・無効化・削除未実装／Capability未発行／Execution Environment Gateは`blocked`

| 確認 | 結果 | 固定記録 | SHA-256 |
|---|---|---|---|
| Agent／Architecture／Security Review | `Pass` | [`CHG-000015_Agent_Security_Review_fdab769.md`](CHG-000015_Agent_Security_Review_fdab769.md) | `3B5136596C07B9CB34C801F8C7522D1B5A5EC97ACED97A150B26040D1C5BC362` |
| Document Audit | `Pass` | [`CHG-000015_Document_Audit_fdab769.md`](CHG-000015_Document_Audit_fdab769.md) | `0DB7A000F618D6930686976CEEF0BB7A2A20CAB7C387658CB717468DA161CABA` |
| Gap／Impact＋Conformance Audit | `Pass` | [`CHG-000015_Gap_Conformance_Audit_fdab769.md`](CHG-000015_Gap_Conformance_Audit_fdab769.md) | `86536720B5490097F7E2996C9EC9F1F7317AC2A99D4CBF2B72E92034230CA2B2` |

## 独立確認済み範囲

- 既定`<repository>/.crdd-runtime`、CLI > 環境 > Repository既定、OS暗黙rootなしという選択契約
- 機能既定無効、明示enable要求、Directory／override／ignore状態だけでは非activation
- CLI／環境接続、Path Adapterおよびactivation記録が未実装である状態
- Runtime RootをCandidate Revision、Operation入力およびProvider mountへ含めない意味契約
- 無効化は新規Operation停止、保存データ削除は別操作であり、双方未実装という境界
- 絶対Path非出力、ignore非Security境界、Capability未発行およびGate `blocked`

上記は固定Commit／TreeのRoot選択Core候補と直接利用側に限る。修正前`17603ad`の監査集合は履歴として保持するが、現在の合否へ流用していない。

## 未解決・未評価

- CLI／環境読取り、Root作成、realpath／link／reparse、owner／mode／DACL、実体Identityおよび同時所有は未実装。
- Candidate Revision／Operation入力／Provider mountからの実除外、activation記録、無効化およびデータ削除は未実装。
- Authority Capability、Provider起動結合、Credential Broker、実Proxy、実Egress、実Providerおよび実Operationは未実装または未評価。

## Current Decision Set

次段階では、Repository内に選択したRuntime RootをGitのコミット候補から外すローカルignore方式をQual-Labが決定する必要がある。

推奨は、明示enable時に選択RootがRepository内である場合、Repository Adapterがroot相対の完全一致entryを`.git/info/exclude`へ冪等に追加し、確認できなければactivationを`blocked`にする方式である。trackedな`.gitignore`は自動変更しない。Repository外overrideにはGit excludeを追加しない。これにより、通常の既定RootはRepository単位に閉じ、Runtime設定のためのコミット差分を発生させず、Windows／macOS／Linux／server volumeで同じ契約を使える。

短所は、Repository Adapterへ必要最小限のGit metadata書込み権限が増えることと、`.git/info/exclude`がclone間で共有されないことである。ただしactivation時に各Repositoryで再構成でき、ignore自体をSecurity境界にはしない。代替は利用者がtracked `.gitignore`を明示変更する方式だが、Runtimeの有効化だけでRepository差分が生じるため推奨しない。

判断を保留または不採用とする場合、Git exclude更新、Path Adapter、activation記録および実Operationは開始しない。全体Gateは`blocked`を維持する。

この記録はRuntime完成、機能有効化、利用許可、採用、準拠、移行、Stable、Releaseまたは公開を意味しない。
