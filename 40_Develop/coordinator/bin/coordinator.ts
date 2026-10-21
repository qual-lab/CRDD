/**
 * Coordinator CLIの単一受付を起動する。
 * @responsibility 独自の引数解析を持たず、同じPackageのCLI受付を一度待機する。
 * @trace ARCH-000004
 */
import { runCoordinatorCommand } from "../src/cli/command.ts";

await runCoordinatorCommand();
