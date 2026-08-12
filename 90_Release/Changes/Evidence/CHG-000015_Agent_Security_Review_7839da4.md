# CHG-000015 Agent／Architecture／Security Review

- 固定対象Commit: `7839da46723850427770e7f65607dba657b70ca3`
- 固定対象Tree: `72a9e93b4b28c2637f96ce6ecc36ec82f265559c`
- Parent: `01736ca0f2ce64e174c862c243a2292d907a4265`
- 結果: `Pass`
- Finding: `0`
- 共通機械確認: Coordinator `216 / 216 Pass`、Checker `143 / 143 Pass`、full checker Error `0`／Warning `0`、diff／worktree clean

`DOC-ENROLLMENT-LOCALE-001`は解消した。README／Threat Modelの現在説明は「登録要求」へ統一され、CHGの現在判断では初出を「登録要求（enrollment request）」、以後を「登録要求」とする。機械値`enrollment_request_binding`と過去履歴は変更していない。

`AG-ENROLL-CHALLENGE-001`の解消も維持した。required inputsはSchema非依存の登録要求bindingを含む5件で、TTL 30分、最初の検証試行における成功／失敗時の消費、期限切れ後の再利用禁止、fresh challenge、PoP、offline fallback禁止および通常run非発火を保持する。

Document／GapのOracle誤認Findingは履歴を保持し、固定人間決定との矛盾を理由に修正案だけを不採用としている。12 blocker、6 current-run evidence、非Effect／Authority／Capability、Gate `blocked`および非Releaseに回帰はない。

新規候補4分類は全て0。exact challenge／request codec、Runtime所有clock、サーバ側消費台帳、Network／CA／keystore Effectは未実装・未評価である。
