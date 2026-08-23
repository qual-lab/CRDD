import assert from "node:assert/strict";
import { test } from "node:test";
import {
  inspectNativeBootstrapPe,
  NATIVE_BOOTSTRAP_PE_MAXIMUM_BYTES,
  type NativeBootstrapPeBlockedReason,
} from "../src/security/native-bootstrap-pe-inspector.ts";
import {
  createNativeBootstrapPeFixture,
  NATIVE_BOOTSTRAP_PE_FIXTURE_OFFSETS,
} from "./native-bootstrap-pe-fixture.ts";

function expectBlocked(
  mutate: (bytes: Buffer) => void,
  reason: NativeBootstrapPeBlockedReason,
) {
  const bytes = createNativeBootstrapPeFixture();
  mutate(bytes);
  assert.deepEqual(inspectNativeBootstrapPe(bytes), {
    status: "blocked",
    reason,
  });
}

test("固定PE fixtureはexact native bootstrap allowlistだけを受理する", () => {
  assert.deepEqual(inspectNativeBootstrapPe(createNativeBootstrapPeFixture()), {
    status: "accepted",
    machine: "x86_64",
    subsystem: "windows_console",
    imports: {
      "ADVAPI32.dll": [
        "ConvertStringSecurityDescriptorToSecurityDescriptorW",
        "FreeSid",
      ],
      "bcrypt.dll": [
        "BCryptCloseAlgorithmProvider",
        "BCryptCreateHash",
        "BCryptDestroyHash",
        "BCryptFinishHash",
        "BCryptGetProperty",
        "BCryptHashData",
        "BCryptOpenAlgorithmProvider",
      ],
      "CRYPT32.dll": ["CertGetCertificateContextProperty"],
      "KERNEL32.dll": [
        "CloseHandle",
        "ConnectNamedPipe",
        "CreateFileW",
        "CreateJobObjectW",
        "CreateNamedPipeW",
        "CreateProcessW",
        "DeleteProcThreadAttributeList",
        "DisconnectNamedPipe",
        "ExitProcess",
        "GetCommandLineW",
        "GetCurrentProcessId",
        "GetDriveTypeW",
        "GetExitCodeProcess",
        "GetFileInformationByHandle",
        "GetLastError",
        "GetModuleFileNameW",
        "GetNamedPipeClientProcessId",
        "GetProcessHeap",
        "GetStdHandle",
        "GetSystemTime",
        "HeapAlloc",
        "HeapFree",
        "InitializeProcThreadAttributeList",
        "LocalFree",
        "QueryFullProcessImageNameW",
        "QueryInformationJobObject",
        "ReadFile",
        "ResumeThread",
        "SetInformationJobObject",
        "Sleep",
        "TerminateJobObject",
        "UpdateProcThreadAttribute",
        "WaitForSingleObject",
        "WriteFile",
      ],
      "USERENV.dll": ["DeriveAppContainerSidFromAppContainerName"],
      "WINTRUST.dll": [
        "WTHelperGetProvSignerFromChain",
        "WTHelperProvDataFromStateData",
        "WinVerifyTrust",
      ],
    },
    workerBindingSha256: "2".repeat(64),
    delayImports: 0,
    tlsDirectory: 0,
    boundImports: 0,
    clrRuntimeHeader: 0,
    executableEntrypoint: true,
    dynamicBase: true,
    nxCompat: true,
  });
});

test("PE header、platform、subsystem、mitigationおよびdirectory差を拒否する", () => {
  const { pe, optional } = NATIVE_BOOTSTRAP_PE_FIXTURE_OFFSETS;
  for (const [reason, mutate] of [
    ["dos_signature", (bytes: Buffer) => bytes.writeUInt16LE(0, 0)],
    ["pe_signature", (bytes: Buffer) => bytes.writeUInt32LE(0, pe)],
    ["machine", (bytes: Buffer) => bytes.writeUInt16LE(0x14c, pe + 4)],
    ["section_population", (bytes: Buffer) => bytes.writeUInt16LE(33, pe + 6)],
    [
      "optional_header",
      (bytes: Buffer) => bytes.writeUInt16LE(0x10b, optional),
    ],
    [
      "console_subsystem",
      (bytes: Buffer) => bytes.writeUInt16LE(2, optional + 68),
    ],
    ["aslr_nx", (bytes: Buffer) => bytes.writeUInt16LE(0x100, optional + 70)],
    [
      "data_directory_count",
      (bytes: Buffer) => bytes.writeUInt32LE(15, optional + 108),
    ],
    [
      "forbidden_directory",
      (bytes: Buffer) => bytes.writeUInt32LE(0x2000, optional + 112 + 9 * 8),
    ],
    [
      "forbidden_directory",
      (bytes: Buffer) => bytes.writeUInt32LE(0x2000, optional + 112 + 11 * 8),
    ],
    [
      "forbidden_directory",
      (bytes: Buffer) => bytes.writeUInt32LE(0x2000, optional + 112 + 13 * 8),
    ],
    [
      "forbidden_directory",
      (bytes: Buffer) => bytes.writeUInt32LE(0x2000, optional + 112 + 14 * 8),
    ],
  ] as const)
    expectBlocked(mutate, reason);
});

test("section、RVA、entrypointおよびimport directory境界を拒否する", () => {
  const { optional, secondSection, importDirectory } =
    NATIVE_BOOTSTRAP_PE_FIXTURE_OFFSETS;
  for (const [reason, mutate] of [
    [
      "section_range",
      (bytes: Buffer) => bytes.writeUInt32LE(0x180, optional + 60),
    ],
    [
      "section_range",
      (bytes: Buffer) => bytes.writeUInt32LE(0xf00, secondSection + 20),
    ],
    [
      "section_overlap",
      (bytes: Buffer) => bytes.writeUInt32LE(0x500, secondSection + 20),
    ],
    [
      "section_overlap",
      (bytes: Buffer) => bytes.writeUInt32LE(0x1100, secondSection + 12),
    ],
    [
      "entrypoint",
      (bytes: Buffer) => bytes.writeUInt32LE(0x2000, optional + 16),
    ],
    [
      "import_directory",
      (bytes: Buffer) => bytes.writeUInt32LE(20, optional + 116 + 8),
    ],
    [
      "import_directory",
      (bytes: Buffer) => bytes.writeUInt32LE(0x5000, optional + 112 + 8),
    ],
    [
      "import_descriptor",
      (bytes: Buffer) => bytes.writeUInt32LE(0, importDirectory),
    ],
    [
      "import_descriptor",
      (bytes: Buffer) => bytes.writeUInt32LE(0, importDirectory + 20),
    ],
  ] as const)
    expectBlocked(mutate, reason);
});

test("high-bit ASCII alias、未知・重複import、ordinalおよび非終端を拒否する", () => {
  const {
    importDirectory,
    lookupThunks,
    addressThunks,
    libraryName,
    firstSymbolName,
  } = NATIVE_BOOTSTRAP_PE_FIXTURE_OFFSETS;
  for (const [reason, mutate] of [
    [
      "import_name",
      (bytes: Buffer) => {
        bytes[libraryName] = 0xcb;
      },
    ],
    [
      "import_name",
      (bytes: Buffer) => {
        bytes[firstSymbolName] = 0xc5;
      },
    ],
    [
      "import_allowlist",
      (bytes: Buffer) => bytes.write("USER32", libraryName, "latin1"),
    ],
    [
      "import_allowlist",
      (bytes: Buffer) => bytes.write("Other", firstSymbolName, "latin1"),
    ],
    [
      "import_thunk",
      (bytes: Buffer) => bytes.writeBigUInt64LE(1n << 63n, lookupThunks),
    ],
    [
      "import_thunk",
      (bytes: Buffer) => bytes.writeBigUInt64LE(0n, addressThunks),
    ],
    [
      "import_name",
      (bytes: Buffer) => bytes.fill(0x41, libraryName, libraryName + 65),
    ],
    [
      "import_name",
      (bytes: Buffer) => {
        bytes.writeBigUInt64LE(0x29fcn, lookupThunks);
        bytes.writeBigUInt64LE(0x29fcn, addressThunks);
      },
    ],
    [
      "import_descriptor",
      (bytes: Buffer) => {
        bytes[importDirectory + 128] = 1;
      },
    ],
    [
      "import_allowlist",
      (bytes: Buffer) => {
        bytes.copy(
          bytes,
          importDirectory + 20,
          importDirectory,
          importDirectory + 20,
        );
        bytes.fill(0, importDirectory + 40, importDirectory + 60);
      },
    ],
  ] as const)
    expectBlocked(mutate, reason);
});

test("非Buffer、過小および16MiB超過のbyte母集団を拒否する", () => {
  assert.deepEqual(inspectNativeBootstrapPe("MZ"), {
    status: "blocked",
    reason: "byte_population",
  });
  assert.deepEqual(inspectNativeBootstrapPe(Buffer.alloc(511)), {
    status: "blocked",
    reason: "byte_population",
  });
  assert.deepEqual(
    inspectNativeBootstrapPe(
      Buffer.alloc(NATIVE_BOOTSTRAP_PE_MAXIMUM_BYTES + 1),
    ),
    { status: "blocked", reason: "byte_population" },
  );
});
