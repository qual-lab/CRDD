#![no_std]
#![no_main]

use core::ffi::c_void;
use core::panic::PanicInfo;
use core::ptr::null_mut;

#[path = "../native_bootstrap_core.rs"]
mod native_bootstrap_core;

const MAXIMUM_COMMAND_LINE_CODE_UNITS: usize = 32_767;
const STD_OUTPUT_HANDLE: u32 = (-11_i32) as u32;
const INVALID_HANDLE_VALUE: *mut c_void = (-1_isize) as *mut c_void;

#[link(name = "kernel32")]
unsafe extern "system" {
    fn GetCommandLineW() -> *const u16;
    fn GetStdHandle(standard_handle: u32) -> *mut c_void;
    fn WriteFile(
        file: *mut c_void,
        buffer: *const c_void,
        bytes_to_write: u32,
        bytes_written: *mut u32,
        overlapped: *mut c_void,
    ) -> i32;
    fn ExitProcess(exit_code: u32) -> !;
}

unsafe fn command_line() -> Option<&'static [u16]> {
    // SAFETY: GetCommandLineW returns a process-lifetime NUL-terminated buffer.
    let pointer = unsafe { GetCommandLineW() };
    if pointer.is_null() {
        return None;
    }
    let mut length = 0;
    while length < MAXIMUM_COMMAND_LINE_CODE_UNITS {
        // SAFETY: the documented command-line buffer is readable through its terminating NUL.
        if unsafe { *pointer.add(length) } == 0 {
            // SAFETY: the process-owned buffer remains valid for process lifetime.
            return Some(unsafe { core::slice::from_raw_parts(pointer, length) });
        }
        length += 1;
    }
    None
}

unsafe fn write_stdout(bytes: &[u8]) -> bool {
    // SAFETY: GetStdHandle has no input pointer and returns a borrowed process handle.
    let output = unsafe { GetStdHandle(STD_OUTPUT_HANDLE) };
    if output.is_null() || output == INVALID_HANDLE_VALUE {
        return false;
    }
    let mut offset = 0;
    while offset < bytes.len() {
        let remaining = match u32::try_from(bytes.len() - offset) {
            Ok(value) => value,
            Err(_) => return false,
        };
        let mut written = 0;
        // SAFETY: output is a borrowed writable handle, the byte suffix is valid for remaining,
        // and written is a writable result. Synchronous output uses no OVERLAPPED structure.
        if unsafe {
            WriteFile(
                output,
                bytes.as_ptr().add(offset).cast::<c_void>(),
                remaining,
                &mut written,
                null_mut(),
            )
        } == 0
            || written == 0
            || written > remaining
        {
            return false;
        }
        offset += written as usize;
    }
    true
}

#[unsafe(no_mangle)]
pub extern "system" fn crdd_coordinator_entry() -> ! {
    // SAFETY: command_line returns a process-owned immutable slice or fails closed.
    let response = unsafe { command_line() }
        .map(native_bootstrap_core::response_for_command_line)
        .unwrap_or(native_bootstrap_core::ARGUMENTS_BLOCKED);
    // SAFETY: response is fixed non-secret static data and stdout is borrowed only for the call.
    let exit_code = if unsafe { write_stdout(response) } {
        2
    } else {
        3
    };
    // SAFETY: this is the process entrypoint and no Rust destructors or DLL-owned state exist.
    unsafe { ExitProcess(exit_code) }
}

#[panic_handler]
fn panic(_information: &PanicInfo<'_>) -> ! {
    // SAFETY: panic is terminal and must not allocate, format, unwind, or emit raw state.
    unsafe { ExitProcess(3) }
}
