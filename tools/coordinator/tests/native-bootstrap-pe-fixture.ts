export const NATIVE_BOOTSTRAP_PE_FIXTURE_OFFSETS = Object.freeze({
  pe: 0x80,
  optional: 0x98,
  firstSection: 0x188,
  secondSection: 0x1b0,
  importDirectory: 0x600,
  lookupThunks: 0x700,
  addressThunks: 0x740,
  libraryName: 0x800,
  firstSymbolName: 0x842,
});

function writeAscii(buffer: Buffer, offset: number, value: string) {
  buffer.write(value, offset, "latin1");
  buffer[offset + value.length] = 0;
}

export function createNativeBootstrapPeFixture() {
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
  bytes.writeUInt32LE(40, optional + 116 + 8);
  bytes.writeUInt32LE(0x2140, optional + 112 + 12 * 8);
  bytes.writeUInt32LE(40, optional + 116 + 12 * 8);

  const text = NATIVE_BOOTSTRAP_PE_FIXTURE_OFFSETS.firstSection;
  bytes.write(".text", text, "latin1");
  bytes.writeUInt32LE(0x200, text + 8);
  bytes.writeUInt32LE(0x1000, text + 12);
  bytes.writeUInt32LE(0x200, text + 16);
  bytes.writeUInt32LE(0x400, text + 20);
  bytes.writeUInt32LE(0x60000020, text + 36);
  const rdata = NATIVE_BOOTSTRAP_PE_FIXTURE_OFFSETS.secondSection;
  bytes.write(".rdata", rdata, "latin1");
  bytes.writeUInt32LE(0x600, rdata + 8);
  bytes.writeUInt32LE(0x2000, rdata + 12);
  bytes.writeUInt32LE(0x600, rdata + 16);
  bytes.writeUInt32LE(0x600, rdata + 20);
  bytes.writeUInt32LE(0x40000040, rdata + 36);

  const descriptor = NATIVE_BOOTSTRAP_PE_FIXTURE_OFFSETS.importDirectory;
  bytes.writeUInt32LE(0x2100, descriptor);
  bytes.writeUInt32LE(0x2200, descriptor + 12);
  bytes.writeUInt32LE(0x2140, descriptor + 16);
  const symbolRvas = [0x2240, 0x2260, 0x2280, 0x22a0];
  for (const [index, symbolRva] of symbolRvas.entries()) {
    bytes.writeBigUInt64LE(
      BigInt(symbolRva),
      NATIVE_BOOTSTRAP_PE_FIXTURE_OFFSETS.lookupThunks + index * 8,
    );
    bytes.writeBigUInt64LE(
      BigInt(symbolRva),
      NATIVE_BOOTSTRAP_PE_FIXTURE_OFFSETS.addressThunks + index * 8,
    );
  }
  writeAscii(
    bytes,
    NATIVE_BOOTSTRAP_PE_FIXTURE_OFFSETS.libraryName,
    "KERNEL32.dll",
  );
  for (const [offset, name] of [
    [0x842, "ExitProcess"],
    [0x862, "GetCommandLineW"],
    [0x882, "GetStdHandle"],
    [0x8a2, "WriteFile"],
  ] as const)
    writeAscii(bytes, offset, name);
  return bytes;
}
