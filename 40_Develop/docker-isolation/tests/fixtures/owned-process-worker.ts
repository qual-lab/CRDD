/**
 * 所有する単一Process試験のWorkerを実行する。
 *
 * @packageDocumentation
 * @responsibility 試験Modeに応じて入出力・待機を行い、元Processの終端を観測可能にする。
 * @trace ERB-IT-002
 * @level IT
 * @scope 単一Processの入出力と終了
 * @boundary 固定Worker。子孫を生成せず、安全期限による終了を取消成功の証拠にはしない。
 */
const [mode] = process.argv.slice(2);
// Safety expiry only: all termination assertions must finish before this.
// Exit 99 must never be accepted as evidence of a cancellation.
setTimeout(() => process.exit(99), 30_000).unref();
if (mode === "echo") {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  process.stdout.write(Buffer.concat(chunks));
} else if (mode === "nonzero") {
  process.exitCode = 7;
} else if (mode === "leaf") {
  process.stdout.write("ready\n");
  setInterval(() => undefined, 1_000);
} else if (mode === "stdout-limit" || mode === "stderr-limit") {
  const output = mode === "stdout-limit" ? process.stdout : process.stderr;
  output.write(Buffer.alloc(1_100_000, 65));
  setInterval(() => undefined, 1_000);
} else {
  process.exitCode = 64;
}
