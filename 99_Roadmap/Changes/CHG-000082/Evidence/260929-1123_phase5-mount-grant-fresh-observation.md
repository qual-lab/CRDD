# Phase 5 Mount Grant fresh再観測

記録日時: 2026-09-29 11:23 JST

対象Change: [CHG-000082](../change.md)

対象範囲: Workbench読取り助言Production RuntimeのProvider Home観測、Mount Grant発行・消費およびProvider Effect前の停止条件

## 結論

署名候補のWorkbench直接起動、Shell、固定Browser Bundleおよび構造化Viewの配信は成立した。一方、Codex／Claude実Provider E2EはProvider Effect前に`workbench_ai_advice_mount_authorization_unavailable`で停止した。

原因は、Mount Grant発行で一回限りのProvider Home観測Capabilityを消費した後、同じCapabilityをGrant消費へ再利用していたことである。ArchitectureはGrant消費時のfresh再観測を既に要求していたため、新しい仕様は追加せず本番構成を正本へ合わせた。

## 原因と是正

```text
Provider Home観測A
        ↓
Mount Grant発行で観測Aを消費
        ↓
Provider Home観測B（fresh）
        ↓
Mount Grant消費へ観測Bを結合
        ↓
Mount Authorization
```

| 観点 | 修正前 | 修正後 |
|---|---|---|
| Grant発行 | 観測Aを使用 | 観測Aを使用 |
| Grant消費 | 消費済みの観測Aを再利用 | Provider Homeを再観測し、観測Bを使用 |
| 再観測不能 | 一般的なMount Authorization失敗 | 固有理由で停止し、Grant消費0、Provider Effect 0 |
| Cleanup | Operation cleanupへ移行 | 同じcleanup契約を維持 |

## 局所検証

| 検証 | 結果 |
|---|---|
| Formatter／Lint | PASS |
| Production／Test型検査 | PASS |
| Production Runtime局所契約試験 | PASS — 4／4 |
| Coordinator Portable全回帰 | PASS — 2106 Pass／0 Fail／5 Host限定Skip |
| Coordinator Runtime Traceability | PASS |
| Repository Checker | PASS WITH EXPECTED FEATURE-BRANCH FINDING — 差分由来Finding 0／Warning 0。公開済み`v0.21.0` tagとv0.22 feature HEADの既知差1件だけ |
| 正常経路で異なる2観測Capabilityを使用 | PASS |
| fresh再観測不能時のGrant消費 | PASS — 0件 |
| fresh再観測不能時の未消費Grant失効 | PASS — 1件 |
| fresh再観測不能時のSelection発行 | PASS — 0件 |
| fresh再観測不能時のPacket発行 | PASS — 0件 |
| fresh再観測不能時のRecovery登録 | PASS — 0件 |
| fresh再観測不能時のProcess開始 | PASS — 0件 |
| fresh再観測不能時のProvider Effect | PASS — 0件 |
| fresh再観測不能時のOperation cleanup | PASS — 1件 |
| fresh再観測不能時のProcess poison | PASS — 0件 |
| 独立レビュー／文書監査／Gap影響監査 | PASS — Blocking 0／Non-blocking 0／Finding 0 |

## 未完了Gate

- 新しいSource CommitとCoordinator Runtime再署名
- 修正後署名候補のCodex／Claude実Provider E2E
- 同一Release Identityで必要な四経路E2E

## Checklist

- [x] 実Provider E2Eの失敗を一般的なProvider障害へ畳んでいない
- [x] 既存Architecture契約へ原因を照合した
- [x] 一回限りCapabilityを再利用していない
- [x] 再観測不能時のEffect 0を反証した
- [x] Coordinator全回帰とRepository Checkerを実行した
- [x] 独立レビュー・文書監査・Gap影響監査をFinding 0で閉じた
- [x] 未完了GateをPassへ畳んでいない
