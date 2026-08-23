export const NATIVE_BOOTSTRAP_PE_MAXIMUM_BYTES = 16 * 1024 * 1024;
const MAXIMUM_SECTIONS = 32;
const MAXIMUM_IMPORT_DESCRIPTORS = 8;
const MAXIMUM_IMPORT_THUNKS = 64;
const MAXIMUM_LIBRARY_NAME_BYTES = 64;
const MAXIMUM_SYMBOL_NAME_BYTES = 256;
const EXPECTED_IMPORTS = Object.freeze({
  "ADVAPI32.DLL": Object.freeze([
    "ConvertStringSecurityDescriptorToSecurityDescriptorW",
    "FreeSid",
    "RegCloseKey",
    "RegDeleteValueW",
    "RegFlushKey",
    "RegOpenKeyExW",
    "RegQueryInfoKeyW",
    "RegQueryValueExW",
    "RegSetValueExW",
  ]),
  "BCRYPT.DLL": Object.freeze([
    "BCryptCloseAlgorithmProvider",
    "BCryptCreateHash",
    "BCryptDestroyHash",
    "BCryptFinishHash",
    "BCryptGetProperty",
    "BCryptHashData",
    "BCryptOpenAlgorithmProvider",
  ]),
  "CRYPT32.DLL": Object.freeze(["CertGetCertificateContextProperty"]),
  "KERNEL32.DLL": Object.freeze([
    "CloseHandle",
    "ConnectNamedPipe",
    "CreateFileW",
    "CreateJobObjectW",
    "CreateMutexW",
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
    "ReleaseMutex",
    "ResumeThread",
    "SetInformationJobObject",
    "Sleep",
    "TerminateJobObject",
    "UpdateProcThreadAttribute",
    "WaitForSingleObject",
    "WriteFile",
  ]),
  "OLE32.DLL": Object.freeze(["CoTaskMemFree"]),
  "SHELL32.DLL": Object.freeze(["SHGetKnownFolderPath"]),
  "USERENV.DLL": Object.freeze(["DeriveAppContainerSidFromAppContainerName"]),
  "WINTRUST.DLL": Object.freeze([
    "WTHelperGetProvSignerFromChain",
    "WTHelperProvDataFromStateData",
    "WinVerifyTrust",
  ]),
});

export type NativeBootstrapPeBlockedReason =
  | "byte_population"
  | "dos_signature"
  | "pe_signature"
  | "machine"
  | "coff_header"
  | "optional_header"
  | "console_subsystem"
  | "aslr_nx"
  | "data_directory_count"
  | "forbidden_directory"
  | "section_population"
  | "section_range"
  | "section_overlap"
  | "entrypoint"
  | "import_directory"
  | "import_descriptor"
  | "import_thunk"
  | "import_name"
  | "import_allowlist";

type Section = Readonly<{
  virtualAddress: number;
  virtualSize: number;
  rawOffset: number;
  rawSize: number;
  characteristics: number;
}>;

type PeContext = Readonly<{
  bytes: Buffer;
  sections: readonly Section[];
}>;

type Inspection =
  | Readonly<{ status: "blocked"; reason: NativeBootstrapPeBlockedReason }>
  | Readonly<{
      status: "accepted";
      machine: "x86_64";
      subsystem: "windows_console";
      imports: Readonly<{
        "ADVAPI32.dll": readonly string[];
        "bcrypt.dll": readonly string[];
        "CRYPT32.dll": readonly string[];
        "KERNEL32.dll": readonly string[];
        "ole32.dll": readonly string[];
        "SHELL32.dll": readonly string[];
        "USERENV.dll": readonly string[];
        "WINTRUST.dll": readonly string[];
      }>;
      workerBindingSha256: string;
      delayImports: 0;
      tlsDirectory: 0;
      boundImports: 0;
      clrRuntimeHeader: 0;
      executableEntrypoint: true;
      dynamicBase: true;
      nxCompat: true;
    }>;

class PeInspectionError extends Error {
  readonly reason: NativeBootstrapPeBlockedReason;

  constructor(reason: NativeBootstrapPeBlockedReason) {
    super(reason);
    this.reason = reason;
  }
}

function blocked(reason: NativeBootstrapPeBlockedReason): never {
  throw new PeInspectionError(reason);
}

function checkedEnd(
  offset: number,
  size: number,
  limit: number,
  reason: NativeBootstrapPeBlockedReason,
) {
  if (
    !Number.isSafeInteger(offset) ||
    !Number.isSafeInteger(size) ||
    offset < 0 ||
    size < 0 ||
    offset > limit ||
    size > limit - offset
  )
    blocked(reason);
  return offset + size;
}

function rangesOverlap(
  leftOffset: number,
  leftSize: number,
  rightOffset: number,
  rightSize: number,
) {
  if (leftSize === 0 || rightSize === 0) return false;
  return (
    leftOffset < rightOffset + rightSize && rightOffset < leftOffset + leftSize
  );
}

function mapRange(
  context: PeContext,
  rva: number,
  size: number,
  reason: NativeBootstrapPeBlockedReason,
) {
  checkedEnd(rva, size, 0x1_0000_0000, reason);
  const candidates = context.sections.filter((section) => {
    if (rva < section.virtualAddress) return false;
    const relative = rva - section.virtualAddress;
    return relative <= section.rawSize && size <= section.rawSize - relative;
  });
  if (candidates.length !== 1) blocked(reason);
  const section = candidates[0];
  if (!section) blocked(reason);
  const offset = section.rawOffset + (rva - section.virtualAddress);
  checkedEnd(offset, size, context.bytes.length, reason);
  return Object.freeze({ offset, section });
}

function readAsciiName(
  context: PeContext,
  rva: number,
  maximumBytes: number,
  reason: NativeBootstrapPeBlockedReason,
) {
  const start = mapRange(context, rva, 1, reason);
  const relative = rva - start.section.virtualAddress;
  const available = Math.min(
    maximumBytes + 1,
    start.section.rawSize - relative,
  );
  const range = mapRange(context, rva, available, reason);
  for (let index = 0; index < available; index += 1) {
    const value = context.bytes[range.offset + index];
    if (value === undefined) blocked(reason);
    if (value === 0) {
      if (index === 0 || index > maximumBytes) blocked(reason);
      return context.bytes.toString(
        "latin1",
        range.offset,
        range.offset + index,
      );
    }
    if (value > 0x7f) blocked(reason);
  }
  blocked(reason);
}

function inspect(bytes: Buffer): Exclude<Inspection, { status: "blocked" }> {
  if (bytes.length < 512 || bytes.length > NATIVE_BOOTSTRAP_PE_MAXIMUM_BYTES)
    blocked("byte_population");
  const need = (
    offset: number,
    size: number,
    reason: NativeBootstrapPeBlockedReason,
  ) => checkedEnd(offset, size, bytes.length, reason);
  const u16 = (offset: number, reason: NativeBootstrapPeBlockedReason) => {
    need(offset, 2, reason);
    return bytes.readUInt16LE(offset);
  };
  const u32 = (offset: number, reason: NativeBootstrapPeBlockedReason) => {
    need(offset, 4, reason);
    return bytes.readUInt32LE(offset);
  };
  const u64 = (offset: number, reason: NativeBootstrapPeBlockedReason) => {
    need(offset, 8, reason);
    return bytes.readBigUInt64LE(offset);
  };
  if (u16(0, "dos_signature") !== 0x5a4d) blocked("dos_signature");
  const peOffset = u32(0x3c, "pe_signature");
  need(peOffset, 24, "pe_signature");
  if (u32(peOffset, "pe_signature") !== 0x00004550) blocked("pe_signature");
  if (u16(peOffset + 4, "machine") !== 0x8664) blocked("machine");
  const sectionCount = u16(peOffset + 6, "coff_header");
  if (sectionCount === 0 || sectionCount > MAXIMUM_SECTIONS)
    blocked("section_population");
  const optionalSize = u16(peOffset + 20, "coff_header");
  const optionalOffset = peOffset + 24;
  if (optionalSize !== 240) blocked("optional_header");
  need(optionalOffset, optionalSize, "optional_header");
  if (u16(optionalOffset, "optional_header") !== 0x20b)
    blocked("optional_header");
  const entrypoint = u32(optionalOffset + 16, "entrypoint");
  const sizeOfHeaders = u32(optionalOffset + 60, "section_range");
  if (u16(optionalOffset + 68, "console_subsystem") !== 3)
    blocked("console_subsystem");
  const dllCharacteristics = u16(optionalOffset + 70, "aslr_nx");
  if ((dllCharacteristics & 0x140) !== 0x140) blocked("aslr_nx");
  if (u32(optionalOffset + 108, "data_directory_count") !== 16)
    blocked("data_directory_count");
  const directory = (index: number) => ({
    rva: u32(optionalOffset + 112 + index * 8, "optional_header"),
    size: u32(optionalOffset + 116 + index * 8, "optional_header"),
  });
  for (const index of [9, 11, 13, 14]) {
    const item = directory(index);
    if (item.rva !== 0 || item.size !== 0) blocked("forbidden_directory");
  }
  const sectionTable = optionalOffset + optionalSize;
  const sectionTableEnd = checkedEnd(
    sectionTable,
    sectionCount * 40,
    bytes.length,
    "section_population",
  );
  if (sizeOfHeaders < sectionTableEnd || sizeOfHeaders > bytes.length)
    blocked("section_range");
  const sections: Section[] = [];
  for (let index = 0; index < sectionCount; index += 1) {
    const offset = sectionTable + index * 40;
    const section = Object.freeze({
      virtualSize: u32(offset + 8, "section_population"),
      virtualAddress: u32(offset + 12, "section_population"),
      rawSize: u32(offset + 16, "section_population"),
      rawOffset: u32(offset + 20, "section_population"),
      characteristics: u32(offset + 36, "section_population"),
    });
    if (
      section.virtualSize === 0 ||
      section.virtualAddress === 0 ||
      (section.rawSize === 0
        ? section.rawOffset !== 0 ||
          (section.characteristics & 0x80000000) === 0 ||
          (section.characteristics & 0x20000000) !== 0
        : section.rawOffset < sizeOfHeaders)
    )
      blocked("section_range");
    checkedEnd(
      section.rawOffset,
      section.rawSize,
      bytes.length,
      "section_range",
    );
    checkedEnd(
      section.virtualAddress,
      Math.max(section.virtualSize, section.rawSize),
      0x1_0000_0000,
      "section_range",
    );
    for (const existing of sections) {
      if (
        rangesOverlap(
          section.rawOffset,
          section.rawSize,
          existing.rawOffset,
          existing.rawSize,
        ) ||
        rangesOverlap(
          section.virtualAddress,
          Math.max(section.virtualSize, section.rawSize),
          existing.virtualAddress,
          Math.max(existing.virtualSize, existing.rawSize),
        )
      )
        blocked("section_overlap");
    }
    sections.push(section);
  }
  const context = Object.freeze({ bytes, sections: Object.freeze(sections) });
  const entrySection = mapRange(context, entrypoint, 1, "entrypoint").section;
  if ((entrySection.characteristics & 0x20000000) === 0) blocked("entrypoint");

  const imports = directory(1);
  if (
    imports.rva === 0 ||
    imports.size < 40 ||
    imports.size > (MAXIMUM_IMPORT_DESCRIPTORS + 1) * 20 ||
    imports.size % 20 !== 0
  )
    blocked("import_directory");
  const importRange = mapRange(
    context,
    imports.rva,
    imports.size,
    "import_directory",
  );
  const libraries = new Map<string, readonly string[]>();
  let isTerminated = false;
  for (let index = 0; index < imports.size / 20; index += 1) {
    const descriptor = importRange.offset + index * 20;
    const descriptorBytes = bytes.subarray(descriptor, descriptor + 20);
    if (descriptorBytes.every((value) => value === 0)) {
      if (index === 0) blocked("import_descriptor");
      const padding = bytes.subarray(
        descriptor + 20,
        importRange.offset + imports.size,
      );
      if (!padding.every((value) => value === 0)) blocked("import_descriptor");
      isTerminated = true;
      break;
    }
    if (index >= MAXIMUM_IMPORT_DESCRIPTORS) blocked("import_descriptor");
    const lookupRva = u32(descriptor, "import_descriptor");
    const nameRva = u32(descriptor + 12, "import_descriptor");
    const addressRva = u32(descriptor + 16, "import_descriptor");
    if (lookupRva === 0 || nameRva === 0 || addressRva === 0)
      blocked("import_descriptor");
    const libraryName = readAsciiName(
      context,
      nameRva,
      MAXIMUM_LIBRARY_NAME_BYTES,
      "import_name",
    ).toUpperCase();
    if (libraries.has(libraryName)) blocked("import_allowlist");

    const readThunks = (thunkRva: number) => {
      const first = mapRange(context, thunkRva, 8, "import_thunk");
      const symbolNames: string[] = [];
      for (
        let thunkIndex = 0;
        thunkIndex <= MAXIMUM_IMPORT_THUNKS;
        thunkIndex += 1
      ) {
        const currentRva = thunkRva + thunkIndex * 8;
        const current = mapRange(context, currentRva, 8, "import_thunk");
        if (current.section !== first.section) blocked("import_thunk");
        const value = u64(current.offset, "import_thunk");
        if (value === 0n) return Object.freeze(symbolNames);
        if (
          thunkIndex === MAXIMUM_IMPORT_THUNKS ||
          (value & (1n << 63n)) !== 0n ||
          value > 0xffff_ffffn
        )
          blocked("import_thunk");
        const hintNameRva = Number(value);
        mapRange(context, hintNameRva, 3, "import_name");
        symbolNames.push(
          readAsciiName(
            context,
            hintNameRva + 2,
            MAXIMUM_SYMBOL_NAME_BYTES,
            "import_name",
          ),
        );
      }
      blocked("import_thunk");
    };
    const lookupNames = readThunks(lookupRva);
    const addressNames = readThunks(addressRva);
    if (
      lookupNames.length !== addressNames.length ||
      lookupNames.some((value, index) => value !== addressNames[index])
    )
      blocked("import_thunk");
    libraries.set(libraryName, lookupNames);
  }
  if (!isTerminated) blocked("import_descriptor");
  if (libraries.size !== Object.keys(EXPECTED_IMPORTS).length)
    blocked("import_allowlist");
  for (const [library, expectedSymbols] of Object.entries(EXPECTED_IMPORTS)) {
    const importedSymbols = libraries.get(library);
    if (
      !importedSymbols ||
      importedSymbols.length !== expectedSymbols.length ||
      [...importedSymbols]
        .sort()
        .some((value, index) => value !== expectedSymbols[index])
    )
      blocked("import_allowlist");
  }
  const bindingMarker = Buffer.from("CRDD-WORKER-SHA256-V1:", "ascii");
  const bindingOffset = bytes.indexOf(bindingMarker);
  const bindingEnd = bindingOffset + bindingMarker.length + 64;
  const bindingSection = sections.find(
    (section) =>
      bindingOffset >= section.rawOffset &&
      bindingEnd <= section.rawOffset + section.rawSize,
  );
  const workerBindingSha256 =
    bindingOffset >= 0
      ? bytes
          .subarray(bindingOffset + bindingMarker.length, bindingEnd)
          .toString("ascii")
      : "";
  if (
    bindingOffset < 0 ||
    bytes.indexOf(bindingMarker, bindingOffset + 1) >= 0 ||
    !/^[0-9a-f]{64}$/u.test(workerBindingSha256) ||
    !bindingSection ||
    (bindingSection.characteristics & 0xa000_0000) !== 0
  )
    blocked("import_allowlist");
  return Object.freeze({
    status: "accepted",
    machine: "x86_64",
    subsystem: "windows_console",
    imports: Object.freeze({
      "ADVAPI32.dll": EXPECTED_IMPORTS["ADVAPI32.DLL"],
      "bcrypt.dll": EXPECTED_IMPORTS["BCRYPT.DLL"],
      "CRYPT32.dll": EXPECTED_IMPORTS["CRYPT32.DLL"],
      "KERNEL32.dll": EXPECTED_IMPORTS["KERNEL32.DLL"],
      "ole32.dll": EXPECTED_IMPORTS["OLE32.DLL"],
      "SHELL32.dll": EXPECTED_IMPORTS["SHELL32.DLL"],
      "USERENV.dll": EXPECTED_IMPORTS["USERENV.DLL"],
      "WINTRUST.dll": EXPECTED_IMPORTS["WINTRUST.DLL"],
    }),
    workerBindingSha256,
    delayImports: 0,
    tlsDirectory: 0,
    boundImports: 0,
    clrRuntimeHeader: 0,
    executableEntrypoint: true,
    dynamicBase: true,
    nxCompat: true,
  });
}

export function inspectNativeBootstrapPe(candidate: unknown): Inspection {
  if (!Buffer.isBuffer(candidate))
    return Object.freeze({ status: "blocked", reason: "byte_population" });
  try {
    return inspect(candidate);
  } catch (error) {
    return Object.freeze({
      status: "blocked",
      reason:
        error instanceof PeInspectionError ? error.reason : "byte_population",
    });
  }
}
