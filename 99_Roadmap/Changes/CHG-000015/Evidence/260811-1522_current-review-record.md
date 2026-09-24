# CHG-000015 現在のレビュー記録

- 固定対象Commit: `f4b839a6c559d8a14e282092f0397369ac9d4445`
- 固定対象Tree: `fdb4511119cc8c58b0ce23b9c3734640126bb8ef`
- 共通機械確認: Checker Error `0` / Warning `0`、Coordinator `99 / 99 Pass`、Checker `143 / 143 Pass`、diff／worktree clean
- 現在状態: Git local exclude Core候補の独立確認完了／Git directory解決・metadata書込み未実装／機能は既定無効／Capability未発行／Execution Environment Gateは`blocked`

| 確認 | 結果 | 固定記録 | SHA-256 |
|---|---|---|---|
| Agent／Architecture／Security Review | `Pass` | [`CHG-000015_Agent_Security_Review_f4b839a.md`](CHG-000015_Agent_Security_Review_f4b839a.md) | `6E44F7515C357D671B7435F7255D84202B5C760D31342CD8FAF265A298C83C0B` |
| Document Audit | `Pass` | [`CHG-000015_Document_Audit_f4b839a.md`](CHG-000015_Document_Audit_f4b839a.md) | `D4C23731D20BAECD8ECE3B72BE928AF06FF916A8FE9DD5F0477A5C5562709C84` |
| Gap／Impact＋Conformance Audit | `Pass` | [`CHG-000015_Gap_Conformance_Audit_f4b839a.md`](CHG-000015_Gap_Conformance_Audit_f4b839a.md) | `0A7A36B3A1B8FF431E8CABFDB1F0033275157FF5A35557685C60B3C4BCC4AE09` |

## 独立確認済み範囲

- Repository内Rootへroot相対・anchoredな完全一致entryを`.git/info/exclude`へ追加する承認済み契約
- tracked `.gitignore`非変更、Repository外override非対象、冪等書込み／書込み後確認および失敗時blockの要求
- Repository内外の構文判定、Git pattern escape、Repository root／直下`.git`／制御文字の拒否
- plain-data入力、明示enable候補、絶対Path非保持
- Git metadata未書込み、ignore非Security境界、Capability未発行およびGate `blocked`

上記は固定Commit／Treeのlocal exclude Core候補と直接利用側に限る。前段`fdab769`の結果はRoot選択contractの履歴であり、今回差分の合否へ流用していない。

## 未解決・未評価

- Repository Identity、Git directory解決、normal／linked worktree／submodule、link／reparseおよび実体Identityは未実装または未決。
- `.git/info/exclude`の既存内容、line ending、同時更新、原子的／冪等書込みおよび書込み後確認は未実装。
- tracked Root検出、Path／Operation／Provider除外、activation、Authority Capabilityおよび実Operationは未実装。

## Current Decision Set

次段階では、Runtime 1.0の実Repository Adapterが正式対応するGit worktree形態をQual-Labが決定する必要がある。

推奨は、working treeを持つ通常Repository、linked worktreeおよびsubmodule worktreeを正式対象とし、bare Repositoryは対象外としてfail closedにする方式である。Git directoryと`info/exclude`は固定・承認済みGit実体を最小環境で呼ぶRepository Adapterが解決し、返されたGit directory／common directory／exclude fileの実体、Repository Identity、non-link／non-reparseおよび書込み前後IdentityをFilesystem側でも検証する。これによりCodex等が作るworktree、macOS／Linux／Windowsおよびserver上の一般的な非bare Repositoryを同じ契約で扱える。

短所は、`.git`がfileとなるlinked worktree／submodule、common Git directoryおよび共有excludeの検証が必要になり、通常Repositoryだけより実装と試験が増えることである。代替はRuntime 1.0を`.git`が実directoryの通常Repositoryだけに限定する方式で、実装は単純だが、Codex worktreeやsubmodule内Repositoryを利用できず、利用者が別cloneを用意する必要がある。

判断を保留または不採用とする場合、Git directory解決、exclude書込み、activation記録および実Operationを開始しない。全体Gateは`blocked`を維持する。

この記録はRuntime完成、機能有効化、利用許可、採用、準拠、移行、Stable、Releaseまたは公開を意味しない。
