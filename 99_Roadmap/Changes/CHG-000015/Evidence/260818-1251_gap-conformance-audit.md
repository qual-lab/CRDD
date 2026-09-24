# CHG-000022 Gap／Impact＋Conformance Audit

- 固定対象Commit: `f11ac73ad22b1af6d0983c9f941600bef4be9755`
- 固定対象Tree: `49655ba56a3190b696afeaaa43f6e7308ada2c13`
- Parent: `3c3021a6769d9e0dd202950d5def4b70577333e4`
- Gap／Impact結果: `Pass`、Finding `0`
- Conformance結果: `Pass`、Finding `0`

## 確認結果

- `GCI-22-001`／`002`／`R2-001`／`R3-001`は解消し、ASR／DOC同根を含む契約母集団と利用側母集団に未伝播または新規gapはない。
- 専用Homeマウント許可参照はProfile、選択Registry Grant、Authority contextおよびPrelaunch contextのexact key／値として結合される。欠落、余分field、AUTH／CGRANT namespace、長さおよびref差の負例があり、成功候補もGrant発行、Authority、CapabilityまたはEffectを成立させない。
- Provider Authority coverageはexact 4 source／7 test、lines `1038 / 1048`、functions `41 / 41`、branches `318 / 347`、未到達29 branchのIdentity、reason、risk、代替確認、Owner、human decisionおよびrecheckを保持する。
- private doctor revision 3、旧版拒否、production consumer 0、公開CLI入力grammar／Checker／採用Repository Schema非影響およびprivate breaking migrationが整合する。
- C-04、C-07、C-10、C-11、PL-08、PL-16およびPL-19を含む影響基準は`Conformant`である。
- 新規候補4分類は全分類0件である。

## 機械入力と未評価

Coordinator `362 / 362`、Provider lifecycle `15 / 15`、Provider Authority exact 4 source／7 test、Checker `151 / 151`、TypeScript closure production `62`／test `55`／unique `124`、platform-access TypeScript coverage、full checker Error `0`／Warning `0`およびworktree cleanを共通入力として使用した。準拠claimはCHG-000022の監査対象範囲で`Eligible`だが、この結果は採用、統合、Gate open、StableまたはReleaseを意味せず、CRDD全体の準拠表明を発行しない。実OAuth、Home保護、mount Grant発行／失効、固定image、実Egress／quota、dynamic Fake／実Provider processは未評価である。
