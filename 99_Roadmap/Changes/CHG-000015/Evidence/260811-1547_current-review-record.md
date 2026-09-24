# CHG-000015 現在のレビュー記録

- 固定対象Commit: `dfa1e5b022b9b5457389e63e0f3085f37511896f`
- 固定対象Tree: `111a48438cddba9de805b0c36979909b6db3504b`
- 共通機械確認: Checker Error `0` / Warning `0`、Coordinator `112 / 112 Pass`、Checker `143 / 143 Pass`、diff／worktree clean
- 現在状態: Repository Git layout読取りCore候補の独立確認完了、Git metadata書込み・activation・Capability未実装、Execution Environment Gateは`blocked`

| 確認 | 結果 | 固定記録 | SHA-256 |
|---|---|---|---|
| Agent／Architecture／Security Review | `Pass` | [`CHG-000015_Agent_Security_Review_dfa1e5b.md`](CHG-000015_Agent_Security_Review_dfa1e5b.md) | `A0E6000313F78F683BBE52A4BFE637881B07E0F8706370AC28B73BA9B9DC8B72` |
| Document Audit | `Pass` | [`CHG-000015_Document_Audit_dfa1e5b.md`](CHG-000015_Document_Audit_dfa1e5b.md) | `873020C679417A946B144959ADC6B3B2C8C14106AC0D1A3DB44A4ECC7EF39732` |
| Gap／Impact＋Conformance Audit | `Pass` | [`CHG-000015_Gap_Conformance_Audit_dfa1e5b.md`](CHG-000015_Gap_Conformance_Audit_dfa1e5b.md) | `DC16B5210BD80DF96AA6131C99E5523395FAC2FD7D4E443C0EAA85D670894BCB` |

## 独立確認済み範囲

- `.git` file、`commondir`および`HEAD`の同一handleによるbounded stable read
- Repository root、Git directory、common Git directoryおよび確認対象entryの実体Identity再照合
- 通常worktree、linked worktreeおよびgitfile形式worktreeの候補分類とbare Repository拒否
- README導入説明における参照submodule、対象自身のsubmodule worktreeおよび別CRDD-Communication Repositoryの分離
- Path／生内容非保持、`candidate`、Capability未発行、metadata書込み未実装およびGate `blocked`

旧`9977fc2`の監査結果は履歴としてだけ保持し、この固定版の合否または解消判定へ流用していない。

## 未解決・未評価

- Repository Identity、全parent chain、case／Unicode alias、Git extensionおよび実Git最終解決
- Git metadataの同時・原子的・冪等書込みと事後確認
- Candidate Revision、Operation入力およびProvider mountからのRuntime Root実除外
- activation、Authority Capability、実Provider／Operation
- linked worktreeで既定Root以外のRepository内custom Rootを共有`info/exclude`へ追加する方針
- 採用、移行、準拠、Stable、Releaseおよび公開

## Current Decision Set

次段階では、linked worktreeの`info/exclude`が同じRepositoryの全worktreeへ共有される点について、Repository内custom Runtime Rootを許可するかQual-Labが判断する必要がある。

推奨は、linked worktreeでは既定`/.crdd-runtime/`だけを自動追加対象とし、Repository内custom Rootは拒否することである。Repository外overrideは従来どおりlocal exclude非対象として許可する。この方式は全worktreeで共通の既定名だけを共有し、custom patternが兄弟worktreeの同名directoryを意図せずignoreすることを避ける。

代替は、Repository内custom Rootのanchored patternをcommon `info/exclude`へ追加し、同じRepositoryの全linked worktreeへ共有される影響を利用者が受容する方式である。柔軟だが、別worktreeの同じ相対Pathまでignoreされる。

判断を保留または不採用とする場合、linked worktreeでのcustom内部Rootに対するmetadata書込み、activationおよび実Operationを開始しない。通常worktree、既定RootおよびRepository外overrideの意味契約を変更しない。この判断はRuntime完成、機能有効化、採用、準拠またはRelease承認ではない。
