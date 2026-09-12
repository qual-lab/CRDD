# CHG-000019 Gap／Impact＋Conformance Audit

- 固定対象Commit: `396206d907364d855264b36ba84a26ae21e5ec80`
- 固定対象Tree: `ad4099bac1acf00f50060e4760c978c819e6f056`
- Parent: `dbad1e16955def73636e8ca43655669364dda20e`
- Gap／Impact結果: `Pass`、Finding `0`
- Conformance結果: `Pass`、Finding `0`

## 確認結果

- `GAP-19-01`〜`04`、`GCI-R2-001`および`GCI-R2-002`は解消し、ASR／DOC同根を含む契約母集団と利用側母集団に未伝播または新規gapはない。
- Rust protocol、Windows観測、TypeScript private Adapter、coverage runner、package script、命名closure、README／脅威モデル、Maintenance、coding standardsおよびCHG16〜19は一意に接続される。
- branch coverage `0 / 0`を達成率へ換算せず`Not Available`とし、regions `816 / 907`、functions `36 / 37`、lines `538 / 590`、未到達経路、残存risk、Ownerおよび再確認契機を分離する。PL-16は`Conformant`である。
- Core C-01〜C-11、適用するProduct LifecycleおよびAgentic Delivery基準は`Conformant`、非該当基準は理由付き`Not Applicable`であり、準拠主張は発行しない。
- 公式開発／build環境だけのbreaking migration、v0.17.0への復旧、採用Repository／公開CLIのNo Impact、v0.18 Candidateおよび非Release境界を維持する。

## 機械入力と未評価

Rust `7 / 7`、Coordinator `340 / 340`、Checker `151 / 151`、TypeScript owned source `122`／Rust source `4`、coverage実測、両package／Rust checks、full checker Error `0`／Warning `0`、diff／worktree cleanを共通入力として使用した。production Release binding、process manager、全tree／writer排他、Protection Hash、DACL Effect、Runtime reader、POSIX、initial Trust、activationおよびRelease artifactは未実装・未評価である。
