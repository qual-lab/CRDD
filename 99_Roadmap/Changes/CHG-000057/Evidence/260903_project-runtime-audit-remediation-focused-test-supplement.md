# Project Runtime監査是正後の関連試験補足

## 1. 目的

[監査是正後の署名前検証](2026-09-03_Project_Runtime_Audit_Remediation_Pre_Sign_Verification.md)に記録した関連試験147件の再現入口を補足する。元の検証記録と過去の検証記録は変更しない。

## 2. 固定対象

- 技術候補: `3661c3a1385ce2df8a97fe3e84487e854f22175c`
- Tree: `62c9b60c3b140abbc3ad6cf4bb2799d3a3a0a6aa`
- 作業Directory: `40_Develop/coordinator`

## 3. 実行方法と結果

次の対象をNode.jsのtest runnerで直列実行した。

```powershell
node --test --test-concurrency=1 ./tests/docker-recovery-runtime.contract.test.ts ./tests/mcp-project-runtime-adapter.contract.test.ts ./tests/project-runtime-objective-intake.contract.test.ts ./tests/project-runtime-state.contract.test.ts
```

- 対象: Docker Receipt／Tombstone、MCP公開Projection、Project Objective受付、Project状態・部分再計画
- 結果: 147件中147件成功、失敗・取消・skip 0
- 位置づけ: 同じ対象を含む制限Process試験1,566件の部分集合。実Provider、実Docker資源、認証済み公開MCP Clientまたは署名の成立根拠ではない

## 4. 後続

この補足は実行済み結果の再現入口だけを追加する。監査で検出した件数上限の是正後は、更新された固定候補で対象試験と全体試験を再実行し、新しい結果を別記録へ残す。
