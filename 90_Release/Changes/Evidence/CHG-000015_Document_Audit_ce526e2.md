# CHG-000015 Document Audit

- 固定対象Commit: `ce526e2fb588abb3d58fde169c99730e18fc948c`
- 固定対象Tree: `afa2a547abb766b6360e2bbc72f3d7ed1e682c8d`
- Parent: `da0dd8435a6d6716e2c5c6f4a3e401ee13a3c8e6`
- 結果: `Pass`
- Finding: `0`
- 共通機械確認: Coordinator `221 / 221 Pass`、Checker `143 / 143 Pass`、full checker Error `0`／Warning `0`、diff／worktree clean

3成果物の署名前canonical payload Buffer decoderは`initial-enrollment-pure-core.mjs`を単一正本とし、runtime activation、doctor、試験、README、Threat ModelおよびCHGへ同義に伝播している。decoder 3軸の`implemented_candidate`と署名Envelope／transportの`not_implemented`を分離し、広いwire実装済み表示を作っていない。

README／Threat Modelはlocale-firstを維持し、実装済み候補と時計、台帳、CA Trust、Effect等の未実装範囲を区別する。CHGは旧固定版の完了履歴と今回の`Applied`／`Self-checked`状態を時系列で分離する。anchor／リンク、12 blocker、6 current-run evidence、Gate `blocked`、Authority／Capability／Effect非発行および非Releaseに回帰はない。新規候補4分類は全て0。Envelope／transport、実時計／台帳、CA、Network、keystore、Filesystem、更新およびオフライン経路は未評価である。
