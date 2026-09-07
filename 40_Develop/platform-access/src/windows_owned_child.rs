//! A bounded child lifetime primitive. Caller owns executable trust and authority.
//! This module does not launch Docker or issue restart authority.

use std::ffi::OsStr;
use std::mem::size_of;
use std::os::windows::ffi::OsStrExt;
use std::path::Path;
use std::ptr::{null, null_mut};
use std::time::{Duration, Instant};
use windows_sys::Win32::Foundation::{
    CloseHandle, GENERIC_READ, GENERIC_WRITE, HANDLE, INVALID_HANDLE_VALUE, WAIT_OBJECT_0,
    WAIT_TIMEOUT,
};
use windows_sys::Win32::Security::SECURITY_ATTRIBUTES;
use windows_sys::Win32::Storage::FileSystem::{
    CreateFileW, FILE_SHARE_READ, FILE_SHARE_WRITE, OPEN_EXISTING,
};
use windows_sys::Win32::System::JobObjects::{
    AssignProcessToJobObject, CreateJobObjectW, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    JOBOBJECT_BASIC_ACCOUNTING_INFORMATION, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
    JobObjectBasicAccountingInformation, JobObjectExtendedLimitInformation,
    QueryInformationJobObject, SetInformationJobObject, TerminateJobObject,
};
use windows_sys::Win32::System::Threading::{
    CREATE_SUSPENDED, CREATE_UNICODE_ENVIRONMENT, CreateProcessW, DeleteProcThreadAttributeList,
    EXTENDED_STARTUPINFO_PRESENT, GetExitCodeProcess, InitializeProcThreadAttributeList,
    LPPROC_THREAD_ATTRIBUTE_LIST, PROC_THREAD_ATTRIBUTE_HANDLE_LIST, PROCESS_INFORMATION,
    ResumeThread, STARTF_USESTDHANDLES, STARTUPINFOEXW, TerminateProcess,
    UpdateProcThreadAttribute, WaitForSingleObject,
};

struct Handle(HANDLE);
struct AttributeList(LPPROC_THREAD_ATTRIBUTE_LIST);
impl Drop for AttributeList {
    fn drop(&mut self) {
        // SAFETY: list was successfully initialized; backing allocation outlives this guard.
        unsafe { DeleteProcThreadAttributeList(self.0) };
    }
}
impl Drop for Handle {
    fn drop(&mut self) {
        if !self.0.is_null() && self.0 != INVALID_HANDLE_VALUE {
            // SAFETY: uniquely owned handle, never inherited by the child.
            unsafe { CloseHandle(self.0) };
        }
    }
}

#[derive(Debug, PartialEq, Eq)]
pub(crate) enum Completion {
    Exited(u32),
    Cancelled,
    TimedOut,
    ObservationFailed,
}

#[derive(Debug, PartialEq, Eq)]
pub(crate) struct Outcome {
    pub(crate) completion: Completion,
    pub(crate) cleanup_confirmed: bool,
}

#[derive(Debug, PartialEq, Eq)]
pub(crate) struct StartFailure {
    pub(crate) process_created: bool,
    pub(crate) cleanup_confirmed: bool,
}

pub(crate) struct OwnedChild {
    // Closing this handle kills only this job and its non-breakaway descendants.
    job: Option<Handle>,
    process: Handle,
}

fn terminated_cleanup(process: &Handle) -> bool {
    // SAFETY: exact handle returned by CreateProcessW, still owned by this scope.
    unsafe {
        TerminateProcess(process.0, 2);
        WaitForSingleObject(process.0, 2_000) == WAIT_OBJECT_0
    }
}

impl OwnedChild {
    /// The supplied environment must be an explicit double-NUL Unicode block.
    pub(crate) fn spawn(
        executable: &Path,
        command_line: &OsStr,
        environment: &mut [u16],
        current_directory: &Path,
    ) -> Result<Self, StartFailure> {
        let unissued = || StartFailure {
            process_created: false,
            cleanup_confirmed: true,
        };
        if !executable.is_absolute()
            || !current_directory.is_absolute()
            || environment.len() < 2
            || environment[environment.len() - 2..] != [0, 0]
        {
            return Err(unissued());
        }
        let mut application: Vec<u16> = executable.as_os_str().encode_wide().collect();
        let mut command: Vec<u16> = command_line.encode_wide().collect();
        let mut directory: Vec<u16> = current_directory.as_os_str().encode_wide().collect();
        if application.contains(&0) || command.contains(&0) || directory.contains(&0) {
            return Err(unissued());
        }
        application.push(0);
        command.push(0);
        directory.push(0);
        // SAFETY: null security attributes make the job handle non-inheritable.
        let job = Handle(unsafe { CreateJobObjectW(null(), null()) });
        if job.0.is_null() {
            return Err(unissued());
        }
        // SAFETY: zero is the documented initial form of this Win32 POD structure.
        let mut limits: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = unsafe { std::mem::zeroed() };
        limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        // SAFETY: limits is a valid initialized buffer of the declared length.
        if unsafe {
            SetInformationJobObject(
                job.0,
                JobObjectExtendedLimitInformation,
                (&limits as *const JOBOBJECT_EXTENDED_LIMIT_INFORMATION).cast(),
                size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            )
        } == 0
        {
            return Err(unissued());
        }
        let attributes = SECURITY_ATTRIBUTES {
            nLength: size_of::<SECURITY_ATTRIBUTES>() as u32,
            lpSecurityDescriptor: null_mut(),
            bInheritHandle: 1,
        };
        let nul_name: Vec<u16> = OsStr::new("NUL").encode_wide().chain(Some(0)).collect();
        // SAFETY: NUL is a fixed OS device; this is the only explicitly inherited handle.
        let nul = Handle(unsafe {
            CreateFileW(
                nul_name.as_ptr(),
                GENERIC_READ | GENERIC_WRITE,
                FILE_SHARE_READ | FILE_SHARE_WRITE,
                &attributes,
                OPEN_EXISTING,
                0,
                null_mut(),
            )
        });
        if nul.0 == INVALID_HANDLE_VALUE || nul.0.is_null() {
            return Err(unissued());
        }
        let mut attribute_bytes = 0;
        // SAFETY: initial sizing call, null buffer is required by the API.
        unsafe { InitializeProcThreadAttributeList(null_mut(), 1, 0, &mut attribute_bytes) };
        if attribute_bytes == 0 || attribute_bytes > 65_536 {
            return Err(unissued());
        }
        let mut storage = vec![0usize; attribute_bytes.div_ceil(size_of::<usize>())];
        let list_pointer = storage.as_mut_ptr().cast();
        // SAFETY: suitably aligned bounded allocation of the required size.
        if unsafe { InitializeProcThreadAttributeList(list_pointer, 1, 0, &mut attribute_bytes) }
            == 0
        {
            return Err(unissued());
        }
        let list = AttributeList(list_pointer);
        let inherited = [nul.0];
        // SAFETY: only NUL is allowed to cross the creation boundary; array stays alive.
        if unsafe {
            UpdateProcThreadAttribute(
                list.0,
                0,
                PROC_THREAD_ATTRIBUTE_HANDLE_LIST as usize,
                inherited.as_ptr().cast(),
                size_of::<HANDLE>(),
                null_mut(),
                null(),
            )
        } == 0
        {
            return Err(unissued());
        }
        // SAFETY: STARTUPINFOEXW is a POD structure initialized before use.
        let mut startup: STARTUPINFOEXW = unsafe { std::mem::zeroed() };
        startup.StartupInfo.cb = size_of::<STARTUPINFOEXW>() as u32;
        startup.StartupInfo.dwFlags = STARTF_USESTDHANDLES;
        startup.StartupInfo.hStdInput = nul.0;
        startup.StartupInfo.hStdOutput = nul.0;
        startup.StartupInfo.hStdError = nul.0;
        startup.lpAttributeList = list.0;
        // SAFETY: PROCESS_INFORMATION is an output POD structure.
        let mut information: PROCESS_INFORMATION = unsafe { std::mem::zeroed() };
        // SAFETY: buffers remain live; inheritance disabled; child cannot run before job assignment.
        if unsafe {
            CreateProcessW(
                application.as_ptr(),
                command.as_mut_ptr(),
                null(),
                null(),
                1,
                CREATE_SUSPENDED | CREATE_UNICODE_ENVIRONMENT | EXTENDED_STARTUPINFO_PRESENT,
                environment.as_mut_ptr().cast(),
                directory.as_ptr(),
                &startup.StartupInfo,
                &mut information,
            )
        } == 0
        {
            return Err(unissued());
        }
        let process = Handle(information.hProcess);
        let thread = Handle(information.hThread);
        // SAFETY: both handles are newly created and owned; no PID reconstruction.
        if unsafe { AssignProcessToJobObject(job.0, process.0) } == 0 {
            return Err(StartFailure {
                process_created: true,
                cleanup_confirmed: terminated_cleanup(&process),
            });
        }
        // SAFETY: resume only after successful assignment to the non-inheritable job.
        if unsafe { ResumeThread(thread.0) } == u32::MAX {
            drop(job);
            return Err(StartFailure {
                process_created: true,
                cleanup_confirmed: terminated_cleanup(&process),
            });
        }
        Ok(Self {
            job: Some(job),
            process,
        })
    }

    /// Cancellation asks only this child to end; it does not undo a requested external effect.
    pub(crate) fn wait(
        mut self,
        timeout: Duration,
        mut cancelled: impl FnMut() -> bool,
    ) -> Outcome {
        let started = Instant::now();
        let completion = loop {
            // SAFETY: process handle remains owned and valid throughout observation.
            let wait = unsafe { WaitForSingleObject(self.process.0, 25) };
            if wait == WAIT_OBJECT_0 {
                let mut code = 0;
                // SAFETY: exact exited child handle and valid writable exit-code pointer.
                break if unsafe { GetExitCodeProcess(self.process.0, &mut code) } != 0 {
                    Completion::Exited(code)
                } else {
                    Completion::ObservationFailed
                };
            }
            if wait != WAIT_TIMEOUT {
                break Completion::ObservationFailed;
            }
            if cancelled() {
                break Completion::Cancelled;
            }
            if started.elapsed() >= timeout {
                break Completion::TimedOut;
            }
        };
        let cleanup_confirmed = self.job.as_ref().is_some_and(|job| {
            // SAFETY: exact owned job, no breakaway rights were enabled.
            unsafe { TerminateJobObject(job.0, 2) };
            let deadline = Instant::now() + Duration::from_secs(2);
            loop {
                // SAFETY: output is a POD buffer of the requested size.
                let mut accounting: JOBOBJECT_BASIC_ACCOUNTING_INFORMATION =
                    unsafe { std::mem::zeroed() };
                let observed = unsafe {
                    QueryInformationJobObject(
                        job.0,
                        JobObjectBasicAccountingInformation,
                        (&mut accounting as *mut JOBOBJECT_BASIC_ACCOUNTING_INFORMATION).cast(),
                        size_of::<JOBOBJECT_BASIC_ACCOUNTING_INFORMATION>() as u32,
                        null_mut(),
                    )
                } != 0;
                // SAFETY: same process handle; job emptiness also covers descendants.
                if observed
                    && accounting.ActiveProcesses == 0
                    && unsafe { WaitForSingleObject(self.process.0, 0) } == WAIT_OBJECT_0
                {
                    break true;
                }
                if Instant::now() >= deadline {
                    break false;
                }
                std::thread::sleep(Duration::from_millis(10));
            }
        });
        self.job.take();
        Outcome {
            completion,
            cleanup_confirmed,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn child(name: &str) -> OwnedChild {
        let exe = std::env::current_exe().unwrap();
        let command = format!(
            "\"{}\" --exact windows_owned_child::tests::{name} --ignored --nocapture",
            exe.display()
        );
        OwnedChild::spawn(
            &exe,
            OsStr::new(&command),
            &mut [0, 0],
            exe.parent().unwrap(),
        )
        .unwrap_or_else(|failure| panic!("{failure:?}"))
    }
    #[test]
    fn same_child_success_and_nonzero_exit_are_distinct() {
        assert_eq!(
            child("exit_zero").wait(Duration::from_secs(3), || false),
            Outcome {
                completion: Completion::Exited(0),
                cleanup_confirmed: true
            }
        );
        assert_eq!(
            child("exit_seven").wait(Duration::from_secs(3), || false),
            Outcome {
                completion: Completion::Exited(7),
                cleanup_confirmed: true
            }
        );
    }
    #[test]
    fn timeout_kills_owned_child_and_observes_exit() {
        assert_eq!(
            child("sleep_child").wait(Duration::from_millis(50), || false),
            Outcome {
                completion: Completion::TimedOut,
                cleanup_confirmed: true
            }
        );
    }
    #[test]
    fn cancellation_kills_owned_child_and_observes_exit() {
        assert_eq!(
            child("sleep_child").wait(Duration::from_secs(3), || true),
            Outcome {
                completion: Completion::Cancelled,
                cleanup_confirmed: true
            }
        );
    }
    #[test]
    fn closing_owner_job_handle_terminates_child_without_stdin_cooperation() {
        let OwnedChild { job, process } = child("sleep_child");
        drop(job);
        // SAFETY: retained exact process handle demonstrates kill-on-close behavior.
        assert_eq!(
            unsafe { WaitForSingleObject(process.0, 2_000) },
            WAIT_OBJECT_0
        );
    }
    #[test]
    fn invalid_executable_is_unissued() {
        let result = OwnedChild::spawn(
            Path::new(r"C:\\crdd-nonexistent.exe"),
            OsStr::new("invalid"),
            &mut [0, 0],
            Path::new(r"C:\\"),
        );
        assert!(matches!(
            result,
            Err(StartFailure {
                process_created: false,
                cleanup_confirmed: true
            })
        ));
    }
    #[test]
    #[ignore]
    fn exit_zero() {
        std::process::exit(0);
    }
    #[test]
    #[ignore]
    fn exit_seven() {
        std::process::exit(7);
    }
    #[test]
    #[ignore]
    fn sleep_child() {
        std::thread::sleep(Duration::from_secs(60));
    }
}
