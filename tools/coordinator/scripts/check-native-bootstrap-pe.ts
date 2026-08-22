import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const TOOLCHAIN = "1.94.1-x86_64-pc-windows-msvc";
const TARGET = "x86_64-pc-windows-msvc";
const coordinatorRoot = path.resolve(import.meta.dirname, "..");
const crateRoot = path.resolve(coordinatorRoot, "..", "platform-access");
const targetRoot = path.join(
  crateRoot,
  "target",
  `native-bootstrap-pe-${process.pid}-${randomBytes(8).toString("hex")}`,
);
const executable = path.join(targetRoot, TARGET, "release", "coordinator.exe");
const expectedProvision = Buffer.from(
  '{"contract":"crdd-coordinator/native-provision-supervisor-result","contractRevision":1,"status":"blocked","reason":"native_provision_supervisor_release_binding_not_implemented","observationAttempted":false,"workerSpawnAttempts":0,"processEffectIssued":false,"helperProcessSpawned":false,"filesystemEffectIssued":false,"networkEffectIssued":false,"runtimeAuthorityConferred":false,"runtimeCapabilityIssued":false}\n',
);
const expectedInvalid = Buffer.from(
  '{"contract":"crdd-coordinator/native-provision-supervisor-result","contractRevision":1,"status":"blocked","reason":"native_provision_supervisor_arguments_invalid","observationAttempted":false,"workerSpawnAttempts":0,"processEffectIssued":false,"helperProcessSpawned":false,"filesystemEffectIssued":false,"networkEffectIssued":false,"runtimeAuthorityConferred":false,"runtimeCapabilityIssued":false}\n',
);

function fail(reason: string): never {
  throw new Error(`native_bootstrap_pe_invalid:${reason}`);
}

function inspectPe(bytes: Buffer) {
  const need = (offset: number, size: number) => {
    if (
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      offset + size > bytes.length
    )
      fail("bounded_read");
  };
  const u16 = (offset: number) => {
    need(offset, 2);
    return bytes.readUInt16LE(offset);
  };
  const u32 = (offset: number) => {
    need(offset, 4);
    return bytes.readUInt32LE(offset);
  };
  const u64 = (offset: number) => {
    need(offset, 8);
    return bytes.readBigUInt64LE(offset);
  };
  const z = (offset: number) => {
    need(offset, 1);
    const end = bytes.indexOf(0, offset);
    if (end < 0 || end - offset > 255) fail("bounded_string");
    return bytes.toString("ascii", offset, end);
  };
  if (u16(0) !== 0x5a4d) fail("dos_signature");
  const pe = u32(0x3c);
  need(pe, 24);
  if (u32(pe) !== 0x00004550) fail("pe_signature");
  if (u16(pe + 4) !== 0x8664) fail("machine");
  const sectionCount = u16(pe + 6);
  const optionalSize = u16(pe + 20);
  const optional = pe + 24;
  need(optional, optionalSize);
  if (u16(optional) !== 0x20b || optionalSize < 240) fail("pe32_plus");
  const entrypoint = u32(optional + 16);
  if (u16(optional + 68) !== 3) fail("console_subsystem");
  const dllCharacteristics = u16(optional + 70);
  if ((dllCharacteristics & 0x140) !== 0x140) fail("aslr_nx");
  if (u32(optional + 108) !== 16) fail("data_directory_count");
  const directory = (index: number) => ({
    rva: u32(optional + 112 + index * 8),
    size: u32(optional + 116 + index * 8),
  });
  for (const index of [9, 13, 14]) {
    const item = directory(index);
    if (item.rva !== 0 || item.size !== 0) fail(`forbidden_directory_${index}`);
  }
  const sections = [] as Array<{
    rva: number;
    size: number;
    raw: number;
    rawSize: number;
    characteristics: number;
  }>;
  const sectionTable = optional + optionalSize;
  for (let index = 0; index < sectionCount; index += 1) {
    const offset = sectionTable + index * 40;
    need(offset, 40);
    sections.push({
      rva: u32(offset + 12),
      size: u32(offset + 8),
      raw: u32(offset + 20),
      rawSize: u32(offset + 16),
      characteristics: u32(offset + 36),
    });
  }
  const map = (rva: number) => {
    const section = sections.find(
      (candidate) =>
        rva >= candidate.rva &&
        rva - candidate.rva < Math.max(candidate.size, candidate.rawSize),
    );
    if (!section || rva - section.rva >= section.rawSize) fail("rva_mapping");
    const offset = section.raw + rva - section.rva;
    need(offset, 1);
    return offset;
  };
  const entrySection = sections.find(
    (candidate) =>
      entrypoint >= candidate.rva &&
      entrypoint - candidate.rva < Math.max(candidate.size, candidate.rawSize),
  );
  if (!entrySection || (entrySection.characteristics & 0x20000000) === 0)
    fail("entrypoint_not_executable");
  const imports = directory(1);
  if (imports.rva === 0 || imports.size < 40) fail("import_directory");
  const libraries = new Map<string, string[]>();
  let descriptor = map(imports.rva);
  for (let count = 0; count < 16; count += 1, descriptor += 20) {
    need(descriptor, 20);
    const lookupRva = u32(descriptor);
    const nameRva = u32(descriptor + 12);
    const addressRva = u32(descriptor + 16);
    if (lookupRva === 0 && nameRva === 0 && addressRva === 0) break;
    if (nameRva === 0 || addressRva === 0) fail("import_descriptor");
    const name = z(map(nameRva)).toUpperCase();
    if (libraries.has(name)) fail("duplicate_library");
    const symbols: string[] = [];
    let thunk = map(lookupRva || addressRva);
    for (let symbolCount = 0; symbolCount < 64; symbolCount += 1, thunk += 8) {
      const value = u64(thunk);
      if (value === 0n) break;
      if ((value & (1n << 63n)) !== 0n || value > 0xffffffffn)
        fail("ordinal_or_large_import");
      symbols.push(z(map(Number(value)) + 2));
    }
    libraries.set(name, symbols);
  }
  const symbols = libraries.get("KERNEL32.DLL");
  const expectedImports = [
    "ExitProcess",
    "GetCommandLineW",
    "GetStdHandle",
    "WriteFile",
  ];
  if (
    libraries.size !== 1 ||
    !symbols ||
    symbols.length !== expectedImports.length ||
    [...symbols].sort().some((value, index) => value !== expectedImports[index])
  )
    fail("import_allowlist");
  return Object.freeze({
    machine: "x86_64",
    subsystem: "windows_console",
    imports: Object.freeze({
      "KERNEL32.dll": Object.freeze(expectedImports),
    }),
    delayImports: 0,
    tlsDirectory: 0,
    clrRuntimeHeader: 0,
    executableEntrypoint: true,
    dynamicBase: true,
    nxCompat: true,
  });
}

function executeBootstrap(commandArguments: readonly string[]) {
  return spawnSync(executable, [...commandArguments], {
    encoding: "buffer",
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

try {
  const build = spawnSync(
    "cargo",
    [
      `+${TOOLCHAIN}`,
      "rustc",
      "--manifest-path",
      path.join(crateRoot, "Cargo.toml"),
      "--locked",
      "--release",
      "--target",
      TARGET,
      "--bin",
      "coordinator",
      "--features",
      "native-bootstrap-release",
      "--",
      "-C",
      "link-arg=/ENTRY:crdd_coordinator_entry",
      "-C",
      "link-arg=/SUBSYSTEM:CONSOLE,6.02",
      "-C",
      "link-arg=/NODEFAULTLIB",
    ],
    {
      cwd: coordinatorRoot,
      env: { ...process.env, CARGO_TARGET_DIR: targetRoot },
    },
  );
  if (build.error || build.status !== 0)
    fail(`build:${build.error?.message ?? build.stderr.toString()}`);
  const bytes = fs.readFileSync(executable);
  const pe = inspectPe(bytes);
  const provision = executeBootstrap(["provision"]);
  const invalid = executeBootstrap(["doctor"]);
  if (
    provision.error ||
    provision.status !== 2 ||
    provision.stderr.length !== 0 ||
    !provision.stdout.equals(expectedProvision)
  )
    fail("provision_result");
  if (
    invalid.error ||
    invalid.status !== 2 ||
    invalid.stderr.length !== 0 ||
    !invalid.stdout.equals(expectedInvalid)
  )
    fail("invalid_result");
  process.stdout.write(
    `${JSON.stringify(
      {
        toolchain: TOOLCHAIN,
        target: TARGET,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        byteLength: bytes.length,
        pe,
        cli: {
          provision: "exact_blocked",
          invalid: "exact_blocked",
          exitCode: 2,
          stderrBytes: 0,
        },
        workerSpawnAttempts: 0,
        processEffectIssued: false,
        helperProcessSpawned: false,
        filesystemEffectIssued: false,
        networkEffectIssued: false,
        runtimeAuthorityConferred: false,
        runtimeCapabilityIssued: false,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  fs.rmSync(targetRoot, { recursive: true, force: true });
}
