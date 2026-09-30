# Workbench助言のCodexエラー通知分類

## 結論

署名Runtime `52249c52`のCodex助言は、最終回答一件のほかに`item.completed`の`error`通知二件を含み、受理されなかった。固定文字列分類では設定関連一件とcode mode関連一件に一致した。分類は原因候補を絞る根拠であり、具体的なエラー本文、原因または修正方法を確定する証明ではない。

Providerの正常終了、Process Tree終了、Container／Network不存在、資源回収および最終exact回復在庫の正常を確認した。Workbench助言の成功、通常E2E合格または全体品質の成立は確認していない。

## 実測と根拠

| 項目 | 通知種別診断 | エラー分類診断 |
|---|---|---|
| 日時（JST） | 2026-09-30 17:55:30〜17:56:57 | 2026-09-30 18:00:27〜18:01:45 |
| Request | `ai-request.a09c8473-9239-495b-bb31-7d86ea332e7c` | `ai-request.e6f04d26-8317-492b-8aaa-e79cdace7232` |
| Operation | `OP-238160748165515257215603302406067614234` | `OP-268806158597739259431843460247097428383` |
| 通知 | 完了error二件、完了agent_message一件 | 同左。errorの固定分類は設定関連一件、code mode関連一件 |
| 結果 | `blocked / workbench_ai_codex_tool_event_forbidden`、`PROBE_EXIT=2` | 同左 |
| 保存ログ | `.crdd/tmp/workbench-advice-event-classification-52249c52.log.txt` | `.crdd/tmp/workbench-advice-error-classification-52249c52.log.txt` |
| ログSHA-256 | `00d3430126978782ea7e3023d5e4a57270c9e4fe07eb9b83b4c55c11496f9b27` | `1f19f113bf241d68971e60ab4de7842085de1972b4becff69c30cb6fa32b8416` |

両実測はCommit `52249c523453b052ddab0fd3b0b363e43d4426f7`、Sequence `2026093004`の同じ署名Runtimeを使用した。対象抽出器のSHA-256は`74712925edfbbca55308c724143ceb1e22c19a814af7baea529d8fbdbd10062c`で、診断時に一致を確認した。署名stagingと本体コードは変更していない。

既存の固定Task外部送信同意を使用した。候補採用、Commit、Push、Docker再起動、API Key fallbackは発行していない。`PROJECT_CONTEXT.md`の不変を確認したが、全Repository不変の証明にはしていない。

## 診断方法と限界

診断用Workerは同じ検証ProcessのDebuggerに接続し、固定抽出器の一箇所だけで通知種別を分類した。未知値をそのまま出力せず、閉じた候補名、構造欠落および件数だけを返した。エラー分類では`item.message`を評価式内部で固定正規表現と照合し、初回一致の固定カテゴリまたは不明だけを返した。通知本文、Command、秘密値、未知の種別値は保存・公開していない。

Debuggerの一時停止は実行時間へ影響し得る。この実測は種別・原因候補の診断に限定し、通常E2E、時間保証または通常実行のcleanup保証へ算入しない。内部URLやFrame情報の受信がないとは主張せず、保存・公開対象から除外した。

診断差分の独立レビューは二回ともPassだった。確認者の局所実行でも、0／1／2回の観測、非Record／type欠落／非文字列、未知値と秘密markerの非開示、エラー分類、評価失敗、Worker起動失敗および終了通知後の残存Workerの強制終了を確認した。観測Workerの終了確認、Debugger清掃、再開処置と待機期限を維持した。

## 現在の判断と次の確認

### 固定CLIとの追加照合

後続Run `ai-request.4ccad7d7-4014-4e28-89c3-5f147ed21358`、Operation `OP-181751423713322880461753598920882043523`では、二件のerrorのうち一件が固定CLI内の`Code Mode is unavailable because`という文言へ一致した。設定関連のもう一件は、想定した不明設定項目およびモデル情報不整合の固定文言には一致しなかった。そのため、`agents.enabled`の置換や`code_mode_only`の追加だけを原因是正として採用していない。結果は引き続き`blocked`、`PROBE_EXIT=2`で、最終exact回復在庫は正常・手動回復不要だった。保存ログは`.crdd/tmp/workbench-advice-fixed-literal-52249c52.log.txt`、SHA-256は`aade24a22510ddae8aeec1453e05ed60088fec6fc30cc4d135ffbabbc1badd2b`である。

固定Image `sha256:e7fefafffd4b96614811b2d51b9704d3280e4995c358ed5e25ec795215dbd45c`のIdentityを確認後、Repository-local一時領域へImageを書き出した。Container起動、Provider認証・送信、Docker再起動は行っていない。層の内容HashとCLI本体のSHA-256 `73dc5888888f411c1f0fa7b81d866e721dcc86b527ce8e3b2cf4708661e823ba`、Size `258227840`を照合し、本体内のモデル情報から次を抽出した。CLI本体は実行せず、モデルの指示本文は判断根拠として扱っていない。

| 固定CLI内のモデル名 | `tool_mode` | 助言実行との照合 |
|---|---|---|
| `gpt-5.6-sol` | `code_mode_only` | 現行助言Profileが選択するモデルだが、助言実行引数はCode ModeとHostを無効化している |
| `gpt-5.5` | `null` | 既存の作業用互換モデル。ただし現行ProfileのRoleはExecutor／Reviewerであり、助言へ流用できない |

Sourceのモデル実行契約も、`gpt-5.6`のCode Mode Hostが固定Linux Runtimeにないことを一般Taskの互換理由として保持していた。一方、助言用は`gpt-5.6-sol`のままだった。これは助言用モデルと実行境界の契約不整合であり、実測したCode Mode利用不能と整合する。設定関連通知の具体原因およびこの不整合の是正だけで全拒否が解消するかは未確認である。

独立確認では、exact Profile搬送・Role・暗黙fallback禁止と照合し、既存Profileの黙った置換を不可とした。現在の人間判断候補は、助言用の明示的な`gpt-5.5`互換Profileを採用するか、`gpt-5.6-sol`を維持してCode Mode Hostを正式に組み込むかである。前者でもCatalog改訂、Coordinator Role、互換理由、表示と選択確認を閉じる。後者ではToolなしの意図、Host資源lifecycleと署名閉包の設計を追加で確認する。いずれも未採用である。

1. 正常な思考通知を分離する先行修正だけでは今回の拒否は解消しなかった。思考通知が実測原因だったとは扱わない。
2. 公開理由はTool禁止の分類だが、今回観測した二件はerror通知である。Tool操作が二件実行されたという意味へ読み替えない。
3. error通知を無視して最終回答だけを成功として受理する変更は行わない。
4. 固定CLI `0.149.1`の設定契約と助言用実行引数を照合し、設定・code modeに関する原因を具体化する。最新の一般資料だけから固定CLIの仕様を推定しない。
5. 原因確認後に局所是正、静的確認、関連試験と独立レビューを行う。Runtimeが変わる場合だけ新署名候補を作り、単独正常実測を先に確認する。モデル、権限または公開能力の変更が必要なら別途人間の判断範囲を確認する。

後続判断: 人間は6.1 Solを標準、6 Lunaを軽量用途とするProfileと対応固定CLIへの移行を承認した。前節の5.5互換Profile／5.6 Host案は判断前の候補履歴であり、現在の採用方針ではない。初期CatalogのJSON外出しを先行し、モデル、CLI、実行方式と署名閉包を一体で照合する。旧候補の実測は新候補の合格根拠へ流用しない。

## Checklist

- [x] 通知種別と原因候補を区別した。
- [x] エラー本文と未知値を保存・公開しなかった。
- [x] 署名Runtimeと本体受理条件を変更しなかった。
- [x] 診断Toolの局所反証と独立レビューを実施した。
- [x] 監視Worker終了と最終exact回復在庫を確認した。
- [x] 診断限定結果をWorkbench全体のE2E合格へ読み替えなかった。
- [ ] OPEN: 固定CLIの設定契約との照合で原因を具体化し、是正後の単独正常実測を完了する。具体化不能なら情報不足を推測で補完せず停止する。
