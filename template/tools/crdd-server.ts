#!/usr/bin/env node
/**
 * CRDD固定配布物からServerを起動する。
 * @packageDocumentation
 * @responsibility 起動引数と終了値を既存CLIへそのまま渡す。
 * @trace ARCH-000012
 * @boundary 採用Repositoryの起動とCRDD ServerのCLI。
 */
import "../../40_Develop/crdd-server/bin/crdd-server.ts";
