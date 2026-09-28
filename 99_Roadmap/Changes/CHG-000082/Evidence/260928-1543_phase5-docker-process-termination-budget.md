# Phase 5 Docker Process終了全体期限の検証

検証日時: 2026-09-28 15:43 JST
対象変更: `CHG-000082`
対象: Docker Desktop障害修復のNative Process終了待機

## 結論

Processごとに最大10秒を逐次待機して外側Coordinatorの60秒応答期限を超え得た処理を、全Process合計45秒の終了待機へ制約した。個々のProcessは従来どおり最大10秒まで待つが、後続Processは残る全体時間を超えて待たない。

これにより、Native側でEffectが進んだ後にCoordinator側だけが先にtimeoutし、結果を不明化する時間契約の不一致を防ぐ。45秒以内に終了確認できない場合は、完了へ畳まず部分Effectとして停止する。

## 変更した意味

```text
変更前
Process数 × 最大10秒
        ↓
外側60秒を超える可能性

変更後
全Process合計 最大45秒
├ 各Process 最大10秒
└ 残時間不足 → partialとして停止
```

## 検証結果

| 検証 | 結果 | 観測 |
|---|---|---|
| Coordinator Native Helper契約試験 | PASS | 30件中30件成功 |
| 全体期限の大小関係 | PASS | Native 45秒がCoordinator 60秒より短い |
| Rust Format | PASS | `cargo fmt --check` |
| Rust Clippy | PASS | warningをError化して成功 |
| Rust Unit | PASS | 28成功、0失敗、8明示ignored |
| Rust CLI Integration | PASS | 1件中1件成功 |

## 保持した境界

- Process IDを終了Authorityとして再利用しない。
- 同じKernel HandleとCreation Identityの確認を維持する。
- Effect発行後に期限を超えた場合は成功ではなくpartialとして返す。
- Dockerの再起動完了、Engine ReadyまたはFilesystem cleanup完了をProcess終了だけから推定しない。

## Checklist

- [x] 外側Protocol期限より内側処理期限を短くした。
- [x] Process数によって全体待機が無制限に伸びない。
- [x] 個別Processの終了観測を省略していない。
- [x] 期限超過を成功へ畳んでいない。
- [x] NativeとCoordinatorの契約試験を接続した。
