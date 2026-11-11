//! 退役要求の有界読取りと非秘密の固定拒否応答。
//! @trace ARCH-000008
use std::io::{self, Read, Write};
pub const PROTOCOL_REVISION: u16 = 3;
pub const MAXIMUM_REQUEST_BYTES: usize = 65_536;
const RESPONSE_MAGIC: &[u8; 8] = b"CRDDPR03";
const RESPONSE_BYTES: usize = 86;
/// 入力を上限付きで読み取り、上限超過は拒否する。
pub fn read_request_from(reader: &mut impl Read) -> io::Result<Vec<u8>> {
    let mut bytes = Vec::new();
    reader
        .take(u64::try_from(MAXIMUM_REQUEST_BYTES + 1).unwrap_or(u64::MAX))
        .read_to_end(&mut bytes)?;
    if bytes.len() > MAXIMUM_REQUEST_BYTES {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "request too large",
        ));
    }
    Ok(bytes)
}
/// Path・観測値・Authorityを含まない固定拒否。
pub fn write_response_to(writer: &mut impl Write) -> io::Result<()> {
    let mut bytes = [0_u8; RESPONSE_BYTES];
    bytes[..8].copy_from_slice(RESPONSE_MAGIC);
    bytes[8..10].copy_from_slice(&PROTOCOL_REVISION.to_le_bytes());
    bytes[10] = 1;
    bytes[44..46].copy_from_slice(&2_u16.to_le_bytes());
    writer.write_all(&bytes)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn shared_input_limit_and_rejection_delivery_are_preserved() {
        assert!(read_request_from(&mut &b""[..]).is_ok());
        assert!(read_request_from(&mut &vec![0; MAXIMUM_REQUEST_BYTES][..]).is_ok());
        assert!(read_request_from(&mut &vec![0; MAXIMUM_REQUEST_BYTES + 1][..]).is_err());
        let mut output = Vec::new();
        write_response_to(&mut output).unwrap();
        assert_eq!(output.len(), RESPONSE_BYTES);
        assert_eq!(&output[..8], RESPONSE_MAGIC);
        assert_eq!(output[11], 0);
        assert_eq!(&output[44..46], &2_u16.to_le_bytes());
        let mut unavailable = &mut [][..];
        assert!(write_response_to(&mut unavailable).is_err());
    }
}
