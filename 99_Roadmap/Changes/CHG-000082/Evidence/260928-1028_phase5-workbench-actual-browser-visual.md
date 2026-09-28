# Phase 5 Workbench実Browser Visual Gate

成果物種別: 検証Evidence
対象変更: `CHG-000082`
対象Local Item: `ERB-ST-022`
観測日: 2026-09-28

## 結論

Production Workbenchの15 Logical Screenを、Desktop／Tablet／Mobileと100%／200%／400% Zoomの組合せで実Browser確認し、27条件をすべて合格と判定した。人間によるProfile不適合の許容判断は使用していない。

## 固定した対象

| 観点 | 対象 |
|---|---|
| Production入口 | `40_Develop/workbench`が起動するlocalhost Workbench Server |
| 画面 | Main Workspace内13画面、Topic Detail、Meeting Detailの計15画面 |
| 表示Profile | Desktop `1440×900`、Tablet `1024×768`、Mobile `390×844` |
| Zoom | 100%、200%、400% |
| ブランド | Repository内の承認済みCRDD公式ロゴ |
| 観測 | 必須画面Target、画像読込、文字下限、操作対象、横Overflow、Focus順、Browser Process、専用Profile、Workbench Listener、Repository差分 |

## 実行

```powershell
$env:CRDD_WORKBENCH_VISUAL_E2E='1'
npm.cmd run test:visual
```

実行Directory: `40_Develop/workbench`

## 結果

| 項目 | 結果 | 根拠 |
|---|---|---|
| Test | Pass 1、Fail 0、Skip 0 | `Workbench 15 Logical Screenを全表示Profileと実Browser Zoomで確認する`が完了 |
| 測定条件 | Pass 27／27 | 3画面Target × 3表示Profile × 3 Zoom |
| 必須画面 | Pass | 15 Logical Screenに対応するTargetを全数確認 |
| 公式ロゴ | Pass | 画像読込失敗0 |
| 文字・操作対象 | Pass | 固定下限を下回る対象0 |
| 横Overflow | Pass | 評価対象の不適合0 |
| Focus | Pass | 正の`tabindex`およびFocus不能な操作対象0 |
| Browser資源 | Pass | 条件ごとの所有Processをexact Process Identityで再観測し、残存0 |
| 専用Profile | Pass | 条件ごとの一時Profile残存0 |
| Workbench Listener | Pass | 終了後の接続拒否を観測 |
| Repository | Pass | 検証によるCanonical File差分0 |

## 実行時に見つけた不適合と是正

初回の実Browser観測では、親Containerを文字要素として重複測定した結果、Checkbox／Radioの実効操作対象、狭幅Zoom時の固定最小幅、およびWindowsでのPID再利用を区別できないProcess観測に問題があった。次を是正して同じGateを再実行した。

- 直接Text Nodeを持つ要素だけを文字下限の測定対象にした。
- Checkbox／Radioは対応するLabelを含む実効操作対象で評価した。
- 狭幅・高Zoomでは情報順序を維持したReflowへ切り替え、320px固定最小幅を残さないようにした。
- Browser ProcessはPIDだけでなく生成時刻を含むexact Identityで終了後に再観測した。

## 境界

- 外部AI Provider Effectは発行していない。
- PT／LTは人間から実行指定されていないため実施していない。
- このEvidenceはVisual品質と終了後資源を証明する。Codex／Claudeの実Provider E2E、Shared ServerのTLS配置、人間UATを証明しない。
