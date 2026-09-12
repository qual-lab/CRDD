# CHG-000025 不足／影響・準拠監査

- 固定対象Commit: `1c874af10d8ad059e0a34253ae3d73d271654575`
- 固定対象Tree: `e421aa2b8a0ae8094426ee3f87b893ee1b3b14f1`
- Parent: `893e4a491ca24bdac10cb2a16e13d0fd11d3a229`
- 53 Gap／Impact結果: `Pass`／Finding `0`
- 52 Conformance結果: `Pass`
- CHG-000025変更scope claim eligibility: `Eligible`

## 53 Gap／Impact

- `GCI-CANCEL-001`は`Resolved`。Host attach childをmodule-private controllerが所有し、Fake container内process終了とHost attach closeを別状態へ投影する。
- 正常Docker経路は追加終了要求0、異常Node 3 scenarioは終了要求exact 1回とcloseを確認する。最終`verified`は両終了軸、container不存在およびHost cleanupの全ANDで、close不明をcleanup成功で代用しない。
- 契約、実装、verification script、contract test、coverage、README、脅威モデル、Maintenance、CHG、Host recoveryおよび通常doctor／実Providerの非利用境界を全数確認した。
- private breaking migrationは全Repository利用側へ伝播済みで、production consumer／Provider stateは0、永続変換はない。
- 新規候補4分類は全分類0件である。

## 52 Conformance

影響基準のCore `C-03`、`C-04`、`C-06`～`C-11`、Product Lifecycle `PL-01`、`PL-03`、`PL-07`～`PL-09`、`PL-12`、`PL-15`、`PL-16`、`PL-18`、`PL-19`、Agent-Delivered `AD-01`～`AD-06`、`AD-08`～`AD-11`、`AD-17`～`AD-21`はすべて`Conformant`である。`Eligible`はCHG-000025変更scopeに限定した準拠候補であり、監査集合完了、外部準拠表明、統合、Gate open、StableまたはReleaseを意味しない。

## 品質入力と未評価

Coordinator `378 / 378`、Checker `151 / 151`、package checks、full checker Error `0`／Warning `0`、coverage exact 10 source／7 test、lines `4057 / 5792`・functions `165 / 214`・branches `696 / 890`、未到達194 branchの全義務、実Docker5回の`verified`／Host attach close／追加終了要求0／残留0を共通入力として使用した。通常doctorの実行中取消、任意signal、実Provider取消、Host escape一般、OAuth、専用Home、mount Grant、Egress、billing、実Operation、統合後IdentityおよびReleaseは未評価である。
