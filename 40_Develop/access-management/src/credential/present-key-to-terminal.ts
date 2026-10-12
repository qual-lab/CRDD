/**
 * Host対話端末へ短命の接続鍵を一度だけ提示する。
 * @responsibility 初回と交換でNode TTYの提示契約を共有し、保存・認可を所有しない。
 * @trace ARCH-000013
 */

/**
 * 対話端末への一書込みだけを完了通知まで待つ。
 * @responsibility 先行取消・故障を保持し、遅延通知から再送や成功を作らない。
 * @trace ARCH-000013
 * @input Host所有TTY、短命鍵、取消Signal。
 * @returns 当該chunkのサービス側提示を確認できた場合だけtrue。
 * @precondition 信頼されたNode WriteStream。任意の外部Writerの成功申告は受けない。
 * @postcondition 一write以下、callback join後に当該Listenerを除去しBufferを消去する。
 * @effect TTYへ鍵と案内を一writeする。end／destroy／再送は0。
 * @failure throw・error・close・abortはfalse。callback未着は保留を維持する。
 * @invariant callback前の取消・故障を遅延成功で上書きしない。
 * @boundary Node TTYのwrite callback／error／closeと保存Owner。
 * @security Listenerは鍵本文を返さず、JS stringの物理zeroizeは保証しない。
 * @concurrency 同書込みをjoinし、error通知tick後に当該Listenerだけを解放する。
 */
export async function presentKeyToTerminal(
  terminal: NodeJS.WriteStream,
  token: string,
  signal: AbortSignal,
): Promise<boolean> {
  if (signal.aborted || terminal.isTTY !== true || !terminal.writable)
    return false;
  const bytes = Buffer.from(
    `接続鍵（一度だけ表示します。安全な場所へ控えてください）:\n${token}\nこの鍵でWorkbenchまたはMCPへ接続してください。\n`,
    "utf8",
  );
  token = "";
  return new Promise<boolean>((resolve) => {
    let failed = false;
    let callbackJoined = false;
    const fail = () => {
      failed = true;
    };
    const finish = (error?: Error | null) => {
      if (callbackJoined) return;
      callbackJoined = true;
      const presented = !error && !failed && !signal.aborted;
      bytes.fill(0);
      // write errorはcallbackの後に通知されるため、当該Listenerを通知tickまで保持する。
      setImmediate(() => {
        terminal.removeListener("error", fail);
        terminal.removeListener("close", fail);
        signal.removeEventListener("abort", fail);
        resolve(presented && !failed && !signal.aborted);
      });
    };
    terminal.on("error", fail);
    terminal.on("close", fail);
    signal.addEventListener("abort", fail, { once: true });
    if (signal.aborted || terminal.isTTY !== true || !terminal.writable) {
      finish(new Error("terminal_unavailable"));
      return;
    }
    try {
      terminal.write(bytes, finish);
    } catch {
      finish(new Error("terminal_write_failed"));
    }
  });
}
