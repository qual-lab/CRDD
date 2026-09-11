use std::io::Write;
use windows_sys::Win32::System::SystemInformation::GetSystemWindowsDirectoryW;

/// Read-only bootstrap observation. No environment, filesystem mutation or authority.
pub fn run(writer: &mut impl Write) -> i32 {
    let mut buffer = vec![0_u16; 32_768];
    // SAFETY: writable UTF-16 buffer with the exact declared capacity.
    let length = unsafe { GetSystemWindowsDirectoryW(buffer.as_mut_ptr(), 32_768) };
    if length == 0 || length >= 32_768 {
        return 2;
    }
    let units = &buffer[..length as usize];
    if units.contains(&0) || String::from_utf16(units).is_err() {
        return 2;
    }
    let mut frame = Vec::with_capacity(12 + units.len() * 2);
    frame.extend_from_slice(b"CRDDWD01");
    frame.extend_from_slice(&length.to_le_bytes());
    for unit in units {
        frame.extend_from_slice(&unit.to_le_bytes());
    }
    if writer.write_all(&frame).is_err() || writer.flush().is_err() {
        return 3;
    }
    0
}

#[cfg(test)]
mod tests {
    #[test]
    fn directory_observation_has_exact_frame_length() {
        let mut output = Vec::new();
        assert_eq!(super::run(&mut output), 0);
        assert_eq!(&output[..8], b"CRDDWD01");
        let length = u32::from_le_bytes(output[8..12].try_into().unwrap());
        assert!(length > 0 && length < 32_768);
        assert_eq!(output.len(), 12 + length as usize * 2);
    }
}
