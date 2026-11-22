#!/usr/bin/env node
/**
 * CRDD ServerのCLIを起動する。
 * @packageDocumentation
 * @responsibility Nodeの実行入口をCLIへ接続する。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @boundary 実行コマンドとCLI。
 * @effect 起動と終了の制御をCLIへ委譲する。
 * @security 引数・環境の解釈はCLIの既存契約に従う。
 */
import { runCrddServerCommand } from "../src/cli/command.ts";

await runCrddServerCommand();
