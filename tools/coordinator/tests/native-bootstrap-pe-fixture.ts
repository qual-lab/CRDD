export const NATIVE_BOOTSTRAP_PE_FIXTURE_OFFSETS = Object.freeze({
  pe: 0x80,
  optional: 0x98,
  firstSection: 0x188,
  secondSection: 0x1b0,
  importDirectory: 0x600,
  lookupThunks: 0x6a0,
  addressThunks: 0x7c0,
  libraryName: 0xf00,
  firstSymbolName: 0xa42,
});

const LIBRARIES = Object.freeze([
  Object.freeze({
    name: "KERNEL32.dll",
    nameOffset: 0xf00,
    lookupOffset: 0x6a0,
    addressOffset: 0x7c0,
    symbols: Object.freeze([
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
    ]),
  }),
  Object.freeze({
    name: "ADVAPI32.dll",
    nameOffset: 0xf20,
    lookupOffset: 0x8e0,
    addressOffset: 0x900,
    symbols: Object.freeze([
      "ConvertStringSecurityDescriptorToSecurityDescriptorW",
      "FreeSid",
    ]),
  }),
  Object.freeze({
    name: "USERENV.dll",
    nameOffset: 0xf40,
    lookupOffset: 0x920,
    addressOffset: 0x930,
    symbols: Object.freeze(["DeriveAppContainerSidFromAppContainerName"]),
  }),
  Object.freeze({
    name: "bcrypt.dll",
    nameOffset: 0xf60,
    lookupOffset: 0x940,
    addressOffset: 0x980,
    symbols: Object.freeze([
      "BCryptCloseAlgorithmProvider",
      "BCryptCreateHash",
      "BCryptDestroyHash",
      "BCryptFinishHash",
      "BCryptGetProperty",
      "BCryptHashData",
      "BCryptOpenAlgorithmProvider",
    ]),
  }),
  Object.freeze({
    name: "WINTRUST.dll",
    nameOffset: 0xf80,
    lookupOffset: 0x9c0,
    addressOffset: 0x9e0,
    symbols: Object.freeze([
      "WTHelperGetProvSignerFromChain",
      "WTHelperProvDataFromStateData",
      "WinVerifyTrust",
    ]),
  }),
  Object.freeze({
    name: "CRYPT32.dll",
    nameOffset: 0xfa0,
    lookupOffset: 0xa00,
    addressOffset: 0xa10,
    symbols: Object.freeze(["CertGetCertificateContextProperty"]),
  }),
]);

function rva(offset: number) {
  return offset + 0x1a00;
}

function writeAscii(buffer: Buffer, offset: number, value: string) {
  buffer.write(value, offset, "latin1");
  buffer[offset + value.length] = 0;
}

export function createNativeBootstrapPeFixture(
  workerBindingSha256 = "2".repeat(64),
) {
  if (!/^[0-9a-f]{64}$/u.test(workerBindingSha256))
    throw new Error("fixture_worker_binding_invalid");
  const bytes = Buffer.alloc(0x1000);
  bytes.writeUInt16LE(0x5a4d, 0);
  bytes.writeUInt32LE(NATIVE_BOOTSTRAP_PE_FIXTURE_OFFSETS.pe, 0x3c);
  const pe = NATIVE_BOOTSTRAP_PE_FIXTURE_OFFSETS.pe;
  bytes.writeUInt32LE(0x00004550, pe);
  bytes.writeUInt16LE(0x8664, pe + 4);
  bytes.writeUInt16LE(2, pe + 6);
  bytes.writeUInt16LE(240, pe + 20);
  bytes.writeUInt16LE(0x22, pe + 22);
  const optional = NATIVE_BOOTSTRAP_PE_FIXTURE_OFFSETS.optional;
  bytes.writeUInt16LE(0x20b, optional);
  bytes.writeUInt32LE(0x1000, optional + 16);
  bytes.writeUInt32LE(0x1000, optional + 20);
  bytes.writeBigUInt64LE(0x1_4000_0000n, optional + 24);
  bytes.writeUInt32LE(0x1000, optional + 32);
  bytes.writeUInt32LE(0x200, optional + 36);
  bytes.writeUInt32LE(0x3000, optional + 56);
  bytes.writeUInt32LE(0x400, optional + 60);
  bytes.writeUInt16LE(3, optional + 68);
  bytes.writeUInt16LE(0x160, optional + 70);
  bytes.writeUInt32LE(16, optional + 108);
  bytes.writeUInt32LE(0x2000, optional + 112 + 8);
  bytes.writeUInt32LE(140, optional + 116 + 8);

  const text = NATIVE_BOOTSTRAP_PE_FIXTURE_OFFSETS.firstSection;
  bytes.write(".text", text, "latin1");
  bytes.writeUInt32LE(0x200, text + 8);
  bytes.writeUInt32LE(0x1000, text + 12);
  bytes.writeUInt32LE(0x200, text + 16);
  bytes.writeUInt32LE(0x400, text + 20);
  bytes.writeUInt32LE(0x60000020, text + 36);
  const rdata = NATIVE_BOOTSTRAP_PE_FIXTURE_OFFSETS.secondSection;
  bytes.write(".rdata", rdata, "latin1");
  bytes.writeUInt32LE(0xa00, rdata + 8);
  bytes.writeUInt32LE(0x2000, rdata + 12);
  bytes.writeUInt32LE(0xa00, rdata + 16);
  bytes.writeUInt32LE(0x600, rdata + 20);
  bytes.writeUInt32LE(0x40000040, rdata + 36);

  let symbolOffset = 0xa40;
  for (const [libraryIndex, library] of LIBRARIES.entries()) {
    const descriptor =
      NATIVE_BOOTSTRAP_PE_FIXTURE_OFFSETS.importDirectory + libraryIndex * 20;
    bytes.writeUInt32LE(rva(library.lookupOffset), descriptor);
    bytes.writeUInt32LE(rva(library.nameOffset), descriptor + 12);
    bytes.writeUInt32LE(rva(library.addressOffset), descriptor + 16);
    writeAscii(bytes, library.nameOffset, library.name);
    for (const [symbolIndex, symbol] of library.symbols.entries()) {
      const symbolRva = rva(symbolOffset);
      bytes.writeBigUInt64LE(
        BigInt(symbolRva),
        library.lookupOffset + symbolIndex * 8,
      );
      bytes.writeBigUInt64LE(
        BigInt(symbolRva),
        library.addressOffset + symbolIndex * 8,
      );
      bytes.writeUInt16LE(0, symbolOffset);
      writeAscii(bytes, symbolOffset + 2, symbol);
      symbolOffset += 2 + symbol.length + 1;
    }
  }
  writeAscii(bytes, 0xe80, `CRDD-WORKER-SHA256-V1:${workerBindingSha256}`);
  return bytes;
}
