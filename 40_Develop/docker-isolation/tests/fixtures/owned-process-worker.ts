/**
 * 所有Process Tree試験のWorkerを実行する。
 *
 * @packageDocumentation
 * @responsibility 試験Modeに応じて子Processと準備完了通知を生成し、終端を観測可能にする。
 * @trace ERB-IT-002
 * @level IT
 * @scope Process Treeと準備完了通知
 * @boundary 固定Worker→自己生成子Process。安全期限による終了を取消成功の証拠にはしない。
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const [mode, readinessPath] = process.argv.slice(2);
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
} else if (mode === "tree" && readinessPath) {
  const child = spawn(
    process.execPath,
    [fileURLToPath(import.meta.url), "leaf"],
    {
      windowsHide: true,
      shell: false,
      env: {},
      stdio: ["ignore", "pipe", "ignore"],
    },
  );
  child.once("error", () => process.exit(8));
  child.stdout.once("data", () => {
    fs.writeFileSync(readinessPath, JSON.stringify([process.pid, child.pid]), {
      encoding: "utf8",
      flag: "wx",
    });
  });
  setInterval(() => undefined, 1_000);
} else if (mode === "stdout-limit" || mode === "stderr-limit") {
  const output = mode === "stdout-limit" ? process.stdout : process.stderr;
  output.write(Buffer.alloc(1_100_000, 65));
  setInterval(() => undefined, 1_000);
} else {
  process.exitCode = 64;
}
