//! Host終端記録の保護を自己生成対象だけで確認する結合試験。
//!
//! @packageDocumentation
//! @responsibility 同じ利用者の別Process、共有拒否と明示終了を観測する。ignored診断を既定実行や本番回復成立へ昇格しない。
//! @trace ERB-IT-001
//! @trace ERB-IT-002
//! @level IT
//! @scope 自己生成対象、同じ利用者、固定別Process Workerによるignored局所診断。Production接続と実残存三件は対象外。
//! @boundary Node所有診断→Native試験Process→Windows Filesystem／handle／別Process。既定実行しない。

use super::*;
use crate::filesystem::protection::security_descriptor;
use crate::protocol::access::FileIdentity;
use std::fs;
use std::io::{Read, Write};
use std::os::windows::io::{FromRawHandle, IntoRawHandle};

/// 試験が所有するhandleの終了を明示的に観測する。
///
/// @responsibility CloseHandleの成功をDropと区別し、失敗を成功へ上書きしない。
/// @trace ERB-IT-001
/// @precondition fixtureが一意に所有する有効handleを渡す。
/// @stimulus CloseHandleを一度発行する。
/// @observation Win32の返却と所有slotを確認する。
/// @oracle 非zero返却だけを終了確認とする。
/// @cleanup 成功時だけslotを空にし、失敗時はfixture全体を失敗・保持とする。
/// @boundary 同一試験Process→Windows handle API。
fn close_probe_handle(handle: &mut OwnedHandle) -> bool {
    if handle.0.is_null() || handle.0 == INVALID_HANDLE_VALUE {
        return false;
    }
    // SAFETY: fixture has unique ownership; no pending overlapped I/O uses this handle.
    if unsafe { CloseHandle(handle.0) } == 0 {
        return false;
    }
    handle.0 = null_mut();
    true
}

/// 固定fixture対象を明示access・share modeで開く。
///
/// @responsibility sharing違反とその他の拒否を区別し、未知失敗を排他成功にしない。
/// @trace ERB-IT-001
/// @trace ERB-IT-002
/// @precondition Nodeが検証した固定run親Directoryのread-only観測、または同親内の自己生成fixture／recordの固定名に限定する。親Directoryへの変更は発行しない。
/// @stimulus OPEN_EXISTINGとOPEN_REPARSE_POINTで一回開く。
/// @observation handleまたは直後のWin32 error codeを返す。
/// @oracle 有効handleまたは明示errorを区別する。
/// @cleanup handleは呼出し側がchecked-closeする。失敗はhandleを発行しない。
/// @boundary 同一試験Process→Windows CreateFileW。
fn open_probe_handle(path: &Path, access: u32, share: u32) -> Result<OwnedHandle, u32> {
    let mut wide: Vec<u16> = path.as_os_str().encode_wide().collect();
    wide.push(0);
    // SAFETY: wide is terminated and valid throughout this synchronous call.
    let handle = unsafe {
        CreateFileW(
            wide.as_ptr(),
            access,
            share,
            null(),
            OPEN_EXISTING,
            FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT,
            null_mut(),
        )
    };
    if handle == INVALID_HANDLE_VALUE {
        // SAFETY: no intervening OS call changes the thread's last error.
        return Err(unsafe { GetLastError() });
    }
    Ok(OwnedHandle(handle))
}

/// 同じfixture名のNative Identityを再読取りする。
///
/// @responsibility Node metadataと混ぜず、Volume／File IDおよび非reparse属性を観測する。
/// @trace ERB-IT-001
/// @precondition Nodeが検証した固定run親Directoryのread-only観測、または同親内の自己生成fixture／recordの固定名に限定する。親Directoryへの変更は発行しない。
/// @stimulus read-only観測handleを取得し、情報取得後にchecked-closeする。
/// @observation Native Identity、属性およびCloseHandle返却。
/// @oracle 情報取得・非reparse・close成功が全て成立した場合だけIdentityを返す。
/// @cleanup 観測handleを必ず明示解放試行し、不明を成功へ変換しない。
/// @boundary 同一試験Process→Windows metadata API。
fn probe_identity(path: &Path) -> Result<FileIdentity, &'static str> {
    let mut handle = open_probe_handle(
        path,
        FILE_READ_ATTRIBUTES,
        FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
    )
    .map_err(|_| "identity_open_failed")?;
    let information = root_information(handle.0);
    let closed = close_probe_handle(&mut handle);
    let information = information.ok_or("identity_observation_failed")?;
    if !closed || information.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT != 0 {
        return Err("identity_or_close_unconfirmed");
    }
    Ok(FileIdentity {
        volume_serial_number: information.dwVolumeSerialNumber,
        file_index_high: information.nFileIndexHigh,
        file_index_low: information.nFileIndexLow,
    })
}

/// fixtureの所有者と二ACEのprotected DACLを観測する。
///
/// @responsibility descriptorの局所構造を検査し、別主体の実アクセス検証へ昇格しない。
/// @trace ERB-IT-001
/// @precondition fixtureのREAD_CONTROL handleと取得済みの二SIDを渡す。
/// @stimulus owner、control、DACLおよび各ACEを再読取りする。
/// @observation selected user所有、protected、二つの非継承full-control ACE。
/// @oracle 一致とdescriptorのLocalFree成功が全て成立する。
/// @cleanup descriptorを明示解放し、失敗は保持結果にする。
/// @boundary 同一試験Process→Windows security descriptor API。
fn probe_protection(handle: HANDLE, user: &[u8], system: &[u8]) -> Result<(), &'static str> {
    let mut descriptor = security_descriptor(handle).ok_or("descriptor_unavailable")?;
    let result = (|| {
        let mut owner = null_mut();
        let mut defaulted = 0;
        let mut control = 0;
        let mut revision = 0;
        let mut present = 0;
        let mut dacl = null_mut();
        // SAFETY: descriptor is owned and every output points to writable local storage.
        if unsafe { GetSecurityDescriptorOwner(descriptor.0, &mut owner, &mut defaulted) } == 0
            || defaulted != 0
            || copy_sid_bytes(owner).as_deref() != Some(user)
            || unsafe { GetSecurityDescriptorControl(descriptor.0, &mut control, &mut revision) }
                == 0
            || control & SE_DACL_PROTECTED == 0
            || unsafe {
                GetSecurityDescriptorDacl(descriptor.0, &mut present, &mut dacl, &mut defaulted)
            } == 0
            || present == 0
            || dacl.is_null()
            || defaulted != 0
        {
            return Err("descriptor_mismatch");
        }
        let mut information = ACL_SIZE_INFORMATION::default();
        // SAFETY: the descriptor contains a valid DACL and the output is correctly sized.
        if unsafe {
            GetAclInformation(
                dacl,
                (&raw mut information).cast(),
                size_of::<ACL_SIZE_INFORMATION>() as u32,
                AclSizeInformation,
            )
        } == 0
            || information.AceCount != 2
        {
            return Err("ace_count_mismatch");
        }
        let mut observed = Vec::new();
        for index in 0..2 {
            let mut raw = null_mut();
            // SAFETY: index is inside the two-entry ACL; GetAce owns pointer validation.
            if unsafe { GetAce(dacl, index, &mut raw) } == 0 || raw.is_null() {
                return Err("ace_unavailable");
            }
            // SAFETY: GetAce returned a valid ACE_HEADER, checked before larger access.
            let header = unsafe { &*raw.cast::<windows_sys::Win32::Security::ACE_HEADER>() };
            let length = usize::from(header.AceSize);
            if header.AceType != ACCESS_ALLOWED_ACE_TYPE
                || header.AceFlags != 0
                || length < size_of::<ACCESS_ALLOWED_ACE>()
            {
                return Err("ace_shape_mismatch");
            }
            // SAFETY: type and minimum length were checked above.
            if unsafe { (*raw.cast::<ACCESS_ALLOWED_ACE>()).Mask } != FILE_ALL_ACCESS {
                return Err("ace_access_mismatch");
            }
            observed.push(
                bounded_ace_sid(
                    raw.cast(),
                    length,
                    std::mem::offset_of!(ACCESS_ALLOWED_ACE, SidStart),
                )
                .ok_or("ace_sid_unavailable")?,
            );
        }
        if observed[0].as_slice() != user || observed[1].as_slice() != system {
            return Err("ace_principal_mismatch");
        }
        Ok(())
    })();
    // SAFETY: GetSecurityInfo allocated this uniquely owned descriptor using LocalAlloc.
    if !unsafe { LocalFree(descriptor.0.cast()) }.is_null() {
        return Err("descriptor_free_unconfirmed");
    }
    descriptor.0 = null_mut();
    result
}

/// 親と子に共通の試験実行範囲を、新しいEffect前に確認する。
///
/// @responsibility 任意Pathや旧診断実行物を受理せず、Repository内の同じrunと実行物だけを使う。
/// @trace ERB-IT-001
/// @trace ERB-IT-002
/// @precondition 正式Node入口がfresh runとCargo test実行物を固定している。
/// @stimulus cwd、環境、run名、祖先Identityとcurrent_exeを再観測する。
/// @observation 検証済みRepository、run親、run名と同じ実行物。
/// @oracle 全条件一致だけを返し、不一致ではfixture作成・子起動前に停止する。
/// @cleanup N/A: 読取り確認だけでhandleはprobe_identity内で明示終了する。
/// @boundary Node環境→Native親／子→Repository-local tests領域。
fn protection_fixture_context() -> Result<
    (
        std::path::PathBuf,
        std::path::PathBuf,
        String,
        std::path::PathBuf,
    ),
    &'static str,
> {
    let repository = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .and_then(Path::parent)
        .ok_or("fixture_repository_invalid")?
        .to_path_buf();
    let run = std::env::var("CRDD_NATIVE_PROTECTION_RUN").map_err(|_| "fixture_run_missing")?;
    let uuid = run
        .strip_prefix("native-protection-")
        .ok_or("fixture_run_invalid")?;
    if uuid.len() != 36
        || !uuid.bytes().enumerate().all(|(i, c)| {
            if [8, 13, 18, 23].contains(&i) {
                c == b'-'
            } else {
                c.is_ascii_digit() || (b'a'..=b'f').contains(&c)
            }
        })
    {
        return Err("fixture_run_invalid");
    }
    let parent = repository.join(".crdd").join("tests").join(&run);
    let declared = std::env::var_os("CRDD_NATIVE_PROTECTION_ROOT")
        .map(std::path::PathBuf::from)
        .ok_or("fixture_root_missing")?;
    let executable = std::env::current_exe().map_err(|_| "worker_executable_mismatch")?;
    let declared_exe = std::env::var_os("CRDD_NATIVE_PROTECTION_EXE")
        .map(std::path::PathBuf::from)
        .ok_or("worker_executable_mismatch")?;
    if std::env::current_dir().ok().as_ref() != Some(&repository)
        || declared != parent
        || declared_exe != executable
        || executable.parent()
            != Some(
                repository
                    .join("40_Develop/platform-access/target/x86_64-pc-windows-msvc/debug/deps")
                    .as_path(),
            )
        || std::env::var_os("TEMP").map(std::path::PathBuf::from) != Some(parent.join("tmp"))
        || std::env::var_os("TMP").map(std::path::PathBuf::from) != Some(parent.join("tmp"))
    {
        return Err("fixture_context_mismatch");
    }
    for directory in [
        &repository,
        &repository.join("40_Develop"),
        &repository.join("40_Develop/platform-access"),
        &repository.join("40_Develop/platform-access/target"),
        &repository.join("40_Develop/platform-access/target/x86_64-pc-windows-msvc"),
        &repository.join("40_Develop/platform-access/target/x86_64-pc-windows-msvc/debug"),
        &repository.join("40_Develop/platform-access/target/x86_64-pc-windows-msvc/debug/deps"),
        &repository.join(".crdd"),
        &repository.join(".crdd").join("tests"),
        &parent,
        &parent.join("tmp"),
    ] {
        probe_identity(directory)?;
    }
    Ok((repository, parent, run, executable))
}

/// 固定Workerを一回起動し、役割別の完了receiptと同Process/Jobの終端を確認する。
///
/// @responsibility 期待外exit、期限超過、起動・終端不明を成功にせず、再実行しない。
/// @trace ERB-IT-001
/// @trace ERB-IT-002
/// @precondition 親fixtureが自己生成二対象を保持し、roleと共有cutoffを固定している。
/// @stimulus 同じ固定test binaryのexact Workerを、明示環境と所有Jobで起動する。
/// @observation 起動結果、役割別exit 71/72、exact child終了とJob内Process 0。
/// @oracle 期待exitとcleanup_confirmedの両方が成立した場合だけ成功を返す。
/// @cleanup 既存OwnedChildの終端処理を使い、不明ではfixture清掃と次Workerを許可しない。Job等の全handle checked-closeは主張しない。
/// @boundary 親Native試験Process→Windows Job→同利用者の別Native試験Process。
fn run_protection_probe_worker(role: &str, cutoff: u64) -> Result<(), &'static str> {
    use crate::process::owned_child::{Completion, OwnedChild};
    let expected_exit = match role {
        "held" => 71,
        "released" => 72,
        _ => return Err("worker_role_invalid"),
    };
    let (repository, parent, run, executable) = protection_fixture_context()?;
    // SAFETY: GetTickCount64 is a process-independent monotonic Windows uptime observation.
    if unsafe { windows_sys::Win32::System::SystemInformation::GetTickCount64() } >= cutoff {
        return Err("worker_start_cutoff");
    }
    let command = format!(
        "\"{}\" --exact filesystem::host_record::protection_tests::terminal_protection_fixture_worker --ignored --nocapture --test-threads=1",
        executable.display()
    );
    let environment = format!(
        "CRDD_NATIVE_PROTECTION_CUTOFF={cutoff}\0CRDD_NATIVE_PROTECTION_EXE={}\0CRDD_NATIVE_PROTECTION_ROLE={role}\0CRDD_NATIVE_PROTECTION_ROOT={}\0CRDD_NATIVE_PROTECTION_RUN={run}\0TEMP={}\0TMP={}\0\0",
        executable.display(),
        parent.display(),
        parent.join("tmp").display(),
        parent.join("tmp").display()
    );
    let mut environment: Vec<u16> = environment.encode_utf16().collect();
    let child = OwnedChild::spawn(
        &executable,
        std::ffi::OsStr::new(&command),
        &mut environment,
        &repository,
    )
    .map_err(
        |failure| match (failure.process_created, failure.cleanup_confirmed) {
            (false, true) => "worker_start_not_issued",
            (false, false) => "worker_start_unissued_cleanup_unknown",
            (true, true) => "worker_start_failed_cleanup_confirmed",
            (true, false) => "worker_start_failed_cleanup_unknown",
        },
    )?;
    let outcome = child.wait(std::time::Duration::from_secs(3), || false);
    if !outcome.cleanup_confirmed {
        return Err(match outcome.completion {
            Completion::Exited(_) => "worker_exit_cleanup_unknown",
            Completion::TimedOut => "worker_timeout_cleanup_unknown",
            Completion::Cancelled => "worker_cancel_cleanup_unknown",
            Completion::ObservationFailed => "worker_observation_cleanup_unknown",
        });
    }
    match outcome.completion {
        Completion::Exited(code) if code == expected_exit => Ok(()),
        Completion::Exited(_) => Err("worker_unexpected_exit_cleanup_confirmed"),
        Completion::TimedOut => Err("worker_timeout_cleanup_confirmed"),
        Completion::Cancelled => Err("worker_cancel_cleanup_confirmed"),
        Completion::ObservationFailed => Err("worker_observation_cleanup_confirmed"),
    }
}

/// 親の共有保持中と解除後を、同利用者の別Processから限定観測する。
///
/// @responsibility 全assertionと明示closeの後だけrole固有exitを返し、通常exit 0をreceiptにしない。
/// @trace ERB-IT-001
/// @trace ERB-IT-002
/// @precondition exact Worker、固定run/role/cwd、親が自己生成したfixtureと共有cutoffを使う。
/// @stimulus read後、heldではwrite/delete/rename拒否、releasedではwriteと改名・復元を試す。
/// @observation error 32、read内容、fresh Native Identity、checked-closeとrole固有exit。
/// @oracle 全観測成功後だけ71/72で終了する。両保持中のDirectory拒否をDirectory単独の因果証明にしない。
/// @cleanup 自分のread/write handleだけをchecked-closeする。二対象の削除は親だけが所有する。
/// @boundary 同利用者の別Native試験Process→自己生成二対象。別主体・本番保護・親喪失は未検証。
#[test]
#[ignore = "Fixed child of the repository-local protection fixture only"]
fn terminal_protection_fixture_worker() {
    let (_, parent, _, _) = protection_fixture_context().unwrap();
    let role = std::env::var("CRDD_NATIVE_PROTECTION_ROLE").unwrap();
    assert!(role == "held" || role == "released");
    let cutoff: u64 = std::env::var("CRDD_NATIVE_PROTECTION_CUTOFF")
        .unwrap()
        .parse()
        .unwrap();
    let check_cutoff = || {
        // SAFETY: read-only OS uptime, shared with the parent new-effect cutoff.
        let now = unsafe { windows_sys::Win32::System::SystemInformation::GetTickCount64() };
        assert!(now < cutoff && cutoff - now <= 10_000);
    };
    check_cutoff();
    let parent = parent.as_path();
    let root = parent.join("fixture");
    let root_next = parent.join("fixture-renamed");
    let file_path = root.join("record");
    let file_next = root.join("record-renamed");
    let parent_id = probe_identity(parent).unwrap();
    let root_id = probe_identity(&root).unwrap();
    let file_id = probe_identity(&file_path).unwrap();
    let mut reader = open_probe_handle(
        &file_path,
        FILE_GENERIC_READ,
        FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
    )
    .unwrap();
    // SAFETY: unique read handle ownership is restored before explicit close.
    let mut file = unsafe { fs::File::from_raw_handle(reader.0) };
    reader.0 = null_mut();
    let mut bytes = [0_u8; 5];
    let read = file.read_exact(&mut bytes);
    reader.0 = file.into_raw_handle();
    let closed = close_probe_handle(&mut reader);
    assert!(read.is_ok() && bytes == *b"probe" && closed);
    if role == "held" {
        for access in [FILE_GENERIC_WRITE, DELETE] {
            check_cutoff();
            match open_probe_handle(
                &file_path,
                access,
                FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
            ) {
                Err(32) => (),
                Ok(mut unexpected) => {
                    let _ = close_probe_handle(&mut unexpected);
                    panic!("worker_unexpected_access");
                }
                Err(_) => panic!("worker_wrong_access_error"),
            }
        }
        check_cutoff();
        assert_eq!(
            fs::remove_file(&file_path)
                .err()
                .and_then(|e| e.raw_os_error()),
            Some(32)
        );
        check_cutoff();
        assert_eq!(
            fs::rename(&file_path, &file_next)
                .err()
                .and_then(|e| e.raw_os_error()),
            Some(32)
        );
        check_cutoff();
        assert_eq!(
            fs::rename(&root, &root_next)
                .err()
                .and_then(|e| e.raw_os_error()),
            Some(32)
        );
    } else {
        check_cutoff();
        let mut writer = open_probe_handle(
            &file_path,
            FILE_GENERIC_WRITE,
            FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
        )
        .unwrap();
        // SAFETY: unique write handle ownership is restored before explicit close.
        let mut file = unsafe { fs::File::from_raw_handle(writer.0) };
        writer.0 = null_mut();
        check_cutoff();
        let written = file.write_all(b"child");
        writer.0 = file.into_raw_handle();
        let closed = close_probe_handle(&mut writer);
        assert!(written.is_ok() && closed);
        check_cutoff();
        fs::rename(&file_path, &file_next).unwrap();
        check_cutoff();
        fs::rename(&file_next, &file_path).unwrap();
        check_cutoff();
        fs::rename(&root, &root_next).unwrap();
        check_cutoff();
        fs::rename(&root_next, &root).unwrap();
    }
    assert_eq!(probe_identity(parent).unwrap(), parent_id);
    assert_eq!(probe_identity(&root).unwrap(), root_id);
    assert_eq!(probe_identity(&file_path).unwrap(), file_id);
    check_cutoff();
    std::process::exit(if role == "held" { 71 } else { 72 });
}

/// 自己生成対象だけでDirectoryとfileの共有拒否を分離して観測する。
///
/// @responsibility 保持中の拒否とchecked-close後の正例を分け、実Recoveryへ昇格しない。
/// @trace ERB-IT-001
/// @trace ERB-IT-002
/// @precondition Nodeが固定run参照、exact cwd、親Identityとfresh fixture名を確認済みである。
/// @stimulus 二対象をprotected DACLで作り、同一Processと固定別Processの保持中・解除後を順に観測する。
/// @observation Native Identity、DACL、固定error32、CloseHandle、同じ実体の非再帰清掃と直接不存在。
/// @oracle 全観測・清掃・直接不存在確認が成功した場合だけobservedを返す。清掃開始前の失敗・panic・期限超過では清掃を開始せず、清掃中の失敗・期限超過では追加清掃を停止し、既発行処置を未発行扱いにしない。
/// @cleanup checked-closeをfixtureが登録した保持・観測・Token handleへ試行し、前段観測とchecked-close成功後だけfresh Identityを確認して清掃を開始する。清掃中の部分失敗では追加清掃を停止し、残る状態と既発行処置を保持する。
/// @boundary 親Native試験Process→固定Job/別Native試験Process→自己生成二対象。本番連続排他と親喪失は未検証。
#[test]
#[ignore = "Fixed repository-local diagnostic; invoke through its Node owner only"]
fn terminal_protection_fixture_observes_handle_sharing() {
    let (_, parent, expected_run, _) = protection_fixture_context().unwrap();
    let parent = parent.as_path();
    let root = parent.join("fixture");
    let root_next = parent.join("fixture-renamed");
    let child = root.join("record");
    let child_next = root.join("record-renamed");
    for path in [&root, &root_next] {
        assert_eq!(
            fs::symlink_metadata(path).err().map(|e| e.kind()),
            Some(std::io::ErrorKind::NotFound)
        );
    }
    // SAFETY: fixed interval added to read-only monotonic Windows uptime.
    let worker_cutoff = unsafe { windows_sys::Win32::System::SystemInformation::GetTickCount64() }
        .checked_add(10_000)
        .expect("uptime_cutoff_overflow");
    let cutoff_expired = || {
        // SAFETY: same read-only Windows uptime cutoff as the fixed Workers.
        (unsafe { windows_sys::Win32::System::SystemInformation::GetTickCount64() })
            >= worker_cutoff
    };
    let mut handles = Vec::<OwnedHandle>::new();
    let mut identities = None;
    let mut phase = "preflight";
    let mut held_worker_verified = false;
    let mut released_worker_verified = false;
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let before = probe_identity(parent)?;
        let (primary, impersonation) = process_tokens().ok_or("token_unavailable")?;
        handles.push(primary);
        handles.push(impersonation);
        let user = token_user_sid_bytes(handles[0].0).ok_or("user_unavailable")?;
        let system = local_system_sid_bytes().ok_or("system_unavailable")?;
        let length = size_of::<ACL>()
            + 2 * (size_of::<ACCESS_ALLOWED_ACE>() - size_of::<u32>())
            + user.len()
            + system.len();
        let mut storage = vec![0_u32; length.div_ceil(size_of::<u32>())];
        let acl = storage.as_mut_ptr().cast::<ACL>();
        let mut descriptor = SECURITY_DESCRIPTOR::default();
        let descriptor_pointer = (&raw mut descriptor).cast::<c_void>();
        // SAFETY: aligned bounded ACL/descriptor storage and validated SID allocations
        // remain alive through both synchronous creation calls.
        if unsafe { InitializeAcl(acl, length as u32, ACL_REVISION) } == 0
            || unsafe {
                AddAccessAllowedAceEx(
                    acl,
                    ACL_REVISION,
                    0,
                    FILE_ALL_ACCESS,
                    user.as_ptr().cast_mut().cast(),
                )
            } == 0
            || unsafe {
                AddAccessAllowedAceEx(
                    acl,
                    ACL_REVISION,
                    0,
                    FILE_ALL_ACCESS,
                    system.as_ptr().cast_mut().cast(),
                )
            } == 0
            || unsafe { InitializeSecurityDescriptor(descriptor_pointer, 1) } == 0
            || unsafe {
                SetSecurityDescriptorOwner(descriptor_pointer, user.as_ptr().cast_mut().cast(), 0)
            } == 0
            || unsafe { SetSecurityDescriptorDacl(descriptor_pointer, 1, acl, 0) } == 0
            || unsafe {
                SetSecurityDescriptorControl(
                    descriptor_pointer,
                    SE_DACL_PROTECTED,
                    SE_DACL_PROTECTED,
                )
            } == 0
        {
            return Err("descriptor_creation_failed");
        }
        let attributes = SECURITY_ATTRIBUTES {
            nLength: size_of::<SECURITY_ATTRIBUTES>() as u32,
            lpSecurityDescriptor: descriptor_pointer,
            bInheritHandle: 0,
        };
        if cutoff_expired() || probe_identity(parent)? != before {
            return Err("creation_cutoff_or_parent_changed");
        }
        phase = "directory_creation";
        let mut wide: Vec<u16> = root.as_os_str().encode_wide().collect();
        wide.push(0);
        // SAFETY: terminated exact fixture path and live descriptor buffers.
        if unsafe { CreateDirectoryW(wide.as_ptr(), &attributes) } == 0 {
            return Err("directory_creation_failed");
        }
        handles.push(
            open_probe_handle(&root, FILE_GENERIC_READ | READ_CONTROL, FILE_SHARE_READ)
                .map_err(|_| "directory_hold_failed")?,
        );
        probe_protection(handles[2].0, &user, &system)?;
        let root_id = probe_identity(&root)?;
        if cutoff_expired() {
            return Err("file_creation_cutoff");
        }
        phase = "file_creation";
        let mut wide: Vec<u16> = child.as_os_str().encode_wide().collect();
        wide.push(0);
        // SAFETY: creation is CREATE_NEW with live explicit descriptor and exact child name.
        let created = unsafe {
            CreateFileW(
                wide.as_ptr(),
                FILE_GENERIC_READ | READ_CONTROL,
                FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
                &attributes,
                windows_sys::Win32::Storage::FileSystem::CREATE_NEW,
                FILE_FLAG_OPEN_REPARSE_POINT,
                null_mut(),
            )
        };
        if created == INVALID_HANDLE_VALUE {
            return Err("file_creation_failed");
        }
        handles.push(OwnedHandle(created));
        probe_protection(handles[3].0, &user, &system)?;
        let child_id = probe_identity(&child)?;
        identities = Some((root_id, child_id, before));
        if !close_probe_handle(&mut handles[3]) {
            return Err("creation_handle_close_unknown");
        }
        phase = "directory_only_counterexample";
        if cutoff_expired() {
            return Err("counterexample_cutoff");
        }
        // A directory handle must not be mistaken for a child-file write barrier.
        let mut writer = open_probe_handle(
            &child,
            FILE_GENERIC_WRITE,
            FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
        )
        .map_err(|_| "child_write_open_failed")?;
        // SAFETY: unique ownership is transferred to File and taken back before checked-close.
        let mut file = unsafe { fs::File::from_raw_handle(writer.0) };
        writer.0 = null_mut();
        let written = if !cutoff_expired() {
            file.write_all(b"probe")
        } else {
            Err(std::io::Error::from(std::io::ErrorKind::TimedOut))
        };
        writer.0 = file.into_raw_handle();
        let writer_closed = close_probe_handle(&mut writer);
        if written.is_err() || !writer_closed {
            return Err("child_write_or_close_failed");
        }
        // No child handle remains, so this rejection tests the directory holder alone.
        if cutoff_expired() {
            return Err("directory_rename_cutoff");
        }
        if fs::rename(&root, &root_next)
            .err()
            .and_then(|e| e.raw_os_error())
            != Some(32)
        {
            return Err("directory_rename_oracle_failed");
        }
        phase = "file_hold";
        handles.push(
            open_probe_handle(&child, FILE_GENERIC_READ | READ_CONTROL, FILE_SHARE_READ)
                .map_err(|_| "file_hold_failed")?,
        );
        let mut reader = open_probe_handle(
            &child,
            FILE_GENERIC_READ,
            FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
        )
        .map_err(|_| "child_read_open_failed")?;
        // SAFETY: uniquely owned read handle is returned from File before checked-close.
        let mut file = unsafe { fs::File::from_raw_handle(reader.0) };
        reader.0 = null_mut();
        let mut bytes = [0_u8; 5];
        let read = file.read_exact(&mut bytes);
        reader.0 = file.into_raw_handle();
        let reader_closed = close_probe_handle(&mut reader);
        if read.is_err() || bytes != *b"probe" || !reader_closed {
            return Err("read_or_close_failed");
        }
        for access in [FILE_GENERIC_WRITE, DELETE] {
            match open_probe_handle(
                &child,
                access,
                FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
            ) {
                Err(32) => (),
                Ok(mut unexpected) => {
                    let _ = close_probe_handle(&mut unexpected);
                    return Err("unexpected_access_granted");
                }
                Err(_) => return Err("wrong_access_rejection"),
            }
        }
        if cutoff_expired() {
            return Err("rename_cutoff");
        }
        if fs::remove_file(&child).err().and_then(|e| e.raw_os_error()) != Some(32) {
            return Err("file_delete_oracle_failed");
        }
        if cutoff_expired() {
            return Err("file_rename_cutoff");
        }
        if fs::rename(&child, &child_next)
            .err()
            .and_then(|e| e.raw_os_error())
            != Some(32)
        {
            return Err("file_rename_oracle_failed");
        }
        phase = "held_worker";
        run_protection_probe_worker("held", worker_cutoff)?;
        held_worker_verified = true;
        Ok(())
    }));
    let mut handles_closed = true;
    for handle in handles.iter_mut().rev() {
        if !handle.0.is_null() {
            handles_closed &= close_probe_handle(handle);
        }
    }
    let observed = matches!(result, Ok(Ok(()))) && handles_closed;
    let final_result = if observed {
        (|| {
            phase = "after_close_positive";
            let (root_id, child_id, parent_id) = identities.ok_or("receipts_missing")?;
            if cutoff_expired()
                || probe_identity(parent)? != parent_id
                || probe_identity(&root)? != root_id
                || probe_identity(&child)? != child_id
            {
                return Err("fresh_identity_or_cutoff_failed");
            }
            phase = "released_worker";
            run_protection_probe_worker("released", worker_cutoff)?;
            released_worker_verified = true;
            phase = "after_close_positive";
            let mut writer = open_probe_handle(
                &child,
                FILE_GENERIC_WRITE,
                FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
            )
            .map_err(|_| "after_close_write_failed")?;
            // SAFETY: writer is uniquely owned and is restored before checked-close.
            let mut file = unsafe { fs::File::from_raw_handle(writer.0) };
            writer.0 = null_mut();
            let written = if !cutoff_expired() {
                file.write_all(b"after")
            } else {
                Err(std::io::Error::from(std::io::ErrorKind::TimedOut))
            };
            writer.0 = file.into_raw_handle();
            let closed = close_probe_handle(&mut writer);
            if written.is_err() || !closed {
                return Err("after_close_handle_unknown");
            }
            if cutoff_expired() {
                return Err("file_rename_positive_cutoff");
            }
            fs::rename(&child, &child_next).map_err(|_| "after_close_file_rename_failed")?;
            if cutoff_expired() {
                return Err("file_restore_cutoff");
            }
            fs::rename(&child_next, &child).map_err(|_| "file_restore_failed")?;
            if cutoff_expired() {
                return Err("directory_rename_positive_cutoff");
            }
            fs::rename(&root, &root_next).map_err(|_| "after_close_directory_rename_failed")?;
            if cutoff_expired() {
                return Err("directory_restore_cutoff");
            }
            fs::rename(&root_next, &root).map_err(|_| "directory_restore_failed")?;
            phase = "cleanup";
            if cutoff_expired()
                || probe_identity(parent)? != parent_id
                || probe_identity(&root)? != root_id
                || probe_identity(&child)? != child_id
            {
                return Err("cleanup_identity_or_cutoff_failed");
            }
            fs::remove_file(&child).map_err(|_| "file_cleanup_failed")?;
            if fs::symlink_metadata(&child).err().map(|e| e.kind())
                != Some(std::io::ErrorKind::NotFound)
            {
                return Err("file_absence_unconfirmed");
            }
            if cutoff_expired() || probe_identity(&root)? != root_id {
                return Err("directory_cleanup_identity_or_cutoff_failed");
            }
            fs::remove_dir(&root).map_err(|_| "directory_cleanup_failed")?;
            if fs::symlink_metadata(&root).err().map(|e| e.kind())
                != Some(std::io::ErrorKind::NotFound)
            {
                return Err("directory_absence_unconfirmed");
            }
            Ok(())
        })()
    } else {
        match result {
            Ok(Err(reason)) => Err(reason),
            _ => Err("panic_or_handle_close_unknown"),
        }
    };
    let status = if final_result.is_ok() {
        "observed"
    } else {
        "failed_retained"
    };
    let reason = final_result.err().unwrap_or("fixed_fixture_verified");
    let fixture_handle_closures_confirmed = final_result.is_ok();
    let separate_process_protection_verified =
        final_result.is_ok() && held_worker_verified && released_worker_verified;
    // Separate the bounded record from libtest's progress label on the shared stdout.
    println!(
        "\n{{\"contract\":\"crdd-native/terminal-protection-fixture\",\"revision\":2,\"run\":\"{expected_run}\",\"status\":\"{status}\",\"reason\":\"{reason}\",\"phase\":\"{phase}\",\"fixtureHandleClosuresConfirmed\":{fixture_handle_closures_confirmed},\"heldWorkerVerified\":{held_worker_verified},\"releasedWorkerVerified\":{released_worker_verified},\"productionIntegrationVerified\":false,\"separateProcessProtectionVerified\":{separate_process_protection_verified},\"strictDeadlineClaimed\":false}}"
    );
    assert!(final_result.is_ok(), "fixed_fixture_failed");
}
