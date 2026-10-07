//! 共有管理境界の読取りと保護付き初期化を別の閉形式で搬送する。
//!
//! @responsibility 自由Pathを受け付けず、処置前期待値・部分作成・個別終了を保持する。
//! @trace ARCH-000008
//! @trace ARCH-000011

pub(crate) const MAX_REQUEST_BYTES: usize = 98;
pub(crate) const MAX_RESPONSE_BYTES: usize = 1024;

/// 固定OS親の観測または独立期待値付き初期化を表す。
///
/// @responsibility 読取り要求から作成を暗黙発火させない。
/// @trace ARCH-000011
/// @shape nonceと、初期化時だけ親六識別値・選択利用者Hash。
/// @invariant Path、ACL、自由child名、削除許可を持たない。
/// @boundary Coordinator専用frame→Native。
/// @security 期待値はAuthorityではなく、現在実体の照合条件である。
/// @compatibility CRDDNC01とCRDDNI01は混用しない。
pub(crate) struct NamespaceRequest {
    pub nonce: [u8; 32],
    pub expected: Option<([u32; 6], [u8; 32])>,
}

/// 二つの固定childそれぞれの部分結果を保持する。
///
/// @responsibility 未試行、発行、結果不明とclose不明を分ける。
/// @trace ARCH-000011
/// @shape create発行、created三値、handle取得、close三値。
/// @invariant 作成結果やcloseのNoneをfalseまたは成功へ畳まない。
/// @boundary Native初期化→専用応答。
/// @security 共有DirectoryのrollbackやACL移行を許可しない。
/// @compatibility 記録保存receiptとは別の管理Effectである。
#[derive(Clone, Copy)]
pub(crate) struct ChildReceipt {
    pub create_issued: bool,
    pub created: Option<bool>,
    pub handle_acquired: bool,
    pub close: Option<bool>,
}

/// 同じnonceの実体、部分処置と全取得資源の初回終了を返す。
///
/// @responsibility 完了主張を実体・処置・終了の共同成立へ限定する。
/// @trace ARCH-000011
/// @shape status 0=停止、1=親観測、2=初期化確認、三実体、利用者Hash、二receipt、close列。
/// @invariant 初期化確認はTask回復や旧資源の非使用を意味しない。
/// @boundary Native→Coordinator内部初期化Owner。
/// @security Path、SID、元TokenとAuthorityを含まない。
/// @compatibility CRDDNR01 revision 1のみ。
pub(crate) struct NamespaceResponse {
    pub nonce: [u8; 32],
    pub status: u8,
    pub reason: &'static str,
    pub operation_reason: Option<&'static str>,
    pub identities: [Option<[u32; 6]>; 3],
    pub selected_user: Option<[u8; 32]>,
    pub children: [Option<ChildReceipt>; 2],
    pub token_closes: Vec<bool>,
    pub directory_closes: Vec<bool>,
}

/// modeに一致する余剰なし要求を解析する。
///
/// @responsibility 読取りと作成のmagic・長さ・期待値を取得前に区別する。
/// @trace ARCH-000011
/// @input 最大98bytesとdispatchが固定した初期化mode。
/// @returns 閉形式要求、またはNone。
/// @precondition modeはCLIの固定dispatchで決まる。
/// @postcondition 未知形式、空Hash、file/reparse期待値を拒否する。
/// @effect N/A: memory解析だけ。
/// @failure 欠落、余剰、revision、nonce、期待値不正はNone。
/// @invariant parserはOS処置を実行しない。
/// @boundary 固定stdin→用途限定要求。
/// @security 自由Path・ACL指定を受け付けない。
/// @concurrency N/A: 不変bytesの同期検査。
pub(crate) fn parse_request(bytes: &[u8], initialize: bool) -> Option<NamespaceRequest> {
    let magic: &[u8; 8] = if initialize { b"CRDDNI01" } else { b"CRDDNC01" };
    if bytes.len() != if initialize { 98 } else { 42 }
        || bytes.get(..8)? != magic
        || bytes.get(8..10)? != 1_u16.to_le_bytes()
    {
        return None;
    }
    let nonce: [u8; 32] = bytes.get(10..42)?.try_into().ok()?;
    if nonce == [0; 32] {
        return None;
    }
    let expected = if initialize {
        let mut identity = [0; 6];
        for (index, value) in identity.iter_mut().enumerate() {
            let offset = 42 + index * 4;
            *value = u32::from_le_bytes(bytes.get(offset..offset + 4)?.try_into().ok()?);
        }
        let user: [u8; 32] = bytes.get(66..98)?.try_into().ok()?;
        if identity[5] & 0x10 == 0 || identity[5] & 0x400 != 0 || user == [0; 32] {
            return None;
        }
        Some((identity, user))
    } else {
        None
    };
    Some(NamespaceRequest { nonce, expected })
}

/// 処置前拒否の空receiptを構築する。
///
/// @responsibility 未取得を成功したcloseへ偽装しない。
/// @trace ARCH-000011
/// @input 同じnonceと固定理由。
/// @returns status 0、処置と観測なしの結果。
/// @precondition 理由は呼出し元の固定診断値。
/// @postcondition 元nonceを保持する。
/// @effect N/A: memory構築だけ。
/// @failure N/A: OS処置を持たない。
/// @invariant Authority・回復IDを新設しない。
/// @boundary 取得前停止→専用応答。
/// @security 生OS出力やPathを含まない。
/// @concurrency N/A: 局所値だけ。
pub(crate) fn blocked(nonce: [u8; 32], reason: &'static str) -> NamespaceResponse {
    NamespaceResponse {
        nonce,
        status: 0,
        reason,
        operation_reason: None,
        identities: [None; 3],
        selected_user: None,
        children: [None; 2],
        token_closes: Vec::new(),
        directory_closes: Vec::new(),
    }
}

/// 共同成立と閉形式を確認して応答を符号化する。
///
/// @responsibility 部分実体や終了不明のまま完了を出力しない。
/// @trace ARCH-000011
/// @input 同じ要求の結果と部分receipt。
/// @returns 最大1024bytes、またはNone。
/// @precondition close列は取得数と同じで、取得逆順に固定する。
/// @postcondition 完了は全終了と必要実体が成立した場合だけ。
/// @effect N/A: memory符号化だけ。
/// @failure 不正状態、理由、receipt、上限を拒否する。
/// @invariant 未試行のchildは全fieldを0へ縮約せずpresent bitで区別する。
/// @boundary Native結果→専用stdout。
/// @security 自由文字列は小文字の固定terminal診断だけに限定する。
/// @concurrency N/A: 不変borrowのみ。
pub(crate) fn encode_response(response: &NamespaceResponse) -> Option<Vec<u8>> {
    let operation = response.operation_reason.unwrap_or("");
    if response.status > 2
        || response.reason.is_empty()
        || response.token_closes.len() > 2
        || response.directory_closes.len() > 64
        || [response.reason, operation].iter().any(|reason| {
            reason.len() > 96
                || (!reason.is_empty() && !reason.starts_with("terminal_"))
                || !reason
                    .bytes()
                    .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'_')
        })
        || response.children.iter().flatten().any(|child| {
            (!child.create_issued && child.created != Some(false))
                || (!child.handle_acquired && child.close.is_some())
        })
    {
        return None;
    }
    if response.selected_user == Some([0; 32]) {
        return None;
    }
    if response.status != 0 {
        let count = if response.status == 1 { 1 } else { 3 };
        if response.nonce == [0; 32]
            || response.operation_reason.is_some()
            || response
                .identities
                .iter()
                .flatten()
                .any(|identity| identity[5] & 0x10 == 0 || identity[5] & 0x400 != 0)
            || response.selected_user.is_none()
            || response.token_closes != [true, true]
            || response.directory_closes.is_empty()
            || response.directory_closes.contains(&false)
            || response.identities[..count].iter().any(Option::is_none)
            || (response.status == 1
                && (response.children.iter().any(Option::is_some)
                    || response.identities[1..].iter().any(Option::is_some)
                    || response.reason != "terminal_namespace_parent_observed"))
            || (response.status == 2
                && (response.reason != "terminal_namespace_initialized"
                    || response.children.iter().any(|child| {
                        !matches!(
                            child,
                            Some(ChildReceipt {
                                handle_acquired: true,
                                close: Some(true),
                                created: Some(_),
                                ..
                            })
                        )
                    })))
        {
            return None;
        }
        for index in 0..count {
            for other in 0..index {
                if response.identities[index]?.get(..3) == response.identities[other]?.get(..3) {
                    return None;
                }
            }
        }
    }
    let mask = response
        .identities
        .iter()
        .enumerate()
        .fold(0_u8, |mask, (index, value)| {
            mask | (u8::from(value.is_some()) << index)
        });
    let mut bytes = Vec::with_capacity(MAX_RESPONSE_BYTES);
    bytes.extend_from_slice(b"CRDDNR01");
    bytes.extend_from_slice(&1_u16.to_le_bytes());
    bytes.extend_from_slice(&response.nonce);
    bytes.extend_from_slice(&[
        response.status,
        response.reason.len() as u8,
        operation.len() as u8,
        mask,
        u8::from(response.selected_user.is_some()),
        response.token_closes.len() as u8,
        response.directory_closes.len() as u8,
    ]);
    for child in response.children {
        bytes.extend_from_slice(&match child {
            None => [0, 0, 2, 0, 2],
            Some(child) => [
                1,
                u8::from(child.create_issued),
                child.created.map(u8::from).unwrap_or(2),
                u8::from(child.handle_acquired),
                child.close.map(u8::from).unwrap_or(2),
            ],
        });
    }
    bytes.extend_from_slice(response.reason.as_bytes());
    bytes.extend_from_slice(operation.as_bytes());
    if let Some(user) = response.selected_user {
        bytes.extend_from_slice(&user);
    }
    for identity in response.identities.into_iter().flatten() {
        for value in identity {
            bytes.extend_from_slice(&value.to_le_bytes());
        }
    }
    bytes.extend(response.token_closes.iter().map(|value| u8::from(*value)));
    bytes.extend(
        response
            .directory_closes
            .iter()
            .map(|value| u8::from(*value)),
    );
    (bytes.len() <= MAX_RESPONSE_BYTES).then_some(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 読取りと作成要求の混用・欠落・余剰を拒否する。
    ///
    /// @responsibility 作成modeの誤発火を純粋なframe境界で反証する。
    /// @trace ERB-IT-003
    /// @precondition OS取得を伴わない。
    /// @stimulus mode混用、余剰、空nonce、file期待値を与える。
    /// @observation parserのSome/None。
    /// @oracle 正しい各modeだけSome、反例はNone。
    /// @cleanup N/A: 局所bytesのみ。
    /// @boundary frame→parser。
    #[test]
    fn request_modes_are_disjoint() {
        let mut capture = b"CRDDNC01".to_vec();
        capture.extend_from_slice(&1_u16.to_le_bytes());
        capture.extend_from_slice(&[7; 32]);
        assert!(parse_request(&capture, false).is_some());
        assert!(parse_request(&capture, true).is_none());
        let mut initialize = capture.clone();
        initialize[..8].copy_from_slice(b"CRDDNI01");
        for value in [1_u32, 2, 3, 4, 5, 0x10] {
            initialize.extend_from_slice(&value.to_le_bytes());
        }
        initialize.extend_from_slice(&[8; 32]);
        assert!(parse_request(&initialize, true).is_some());
        assert!(parse_request(&initialize, false).is_none());
        initialize.push(0);
        assert!(parse_request(&initialize, true).is_none());
        initialize.pop();
        initialize[62..66].copy_from_slice(&0_u32.to_le_bytes());
        assert!(parse_request(&initialize, true).is_none());
        capture[10..42].fill(0);
        assert!(parse_request(&capture, false).is_none());
    }

    /// 部分処置とclose不明を完了へ畳まない。
    ///
    /// @responsibility 初期化成功の共同条件を固定する。
    /// @trace ERB-IT-003
    /// @precondition 自己生成の非Authority値だけ。
    /// @stimulus 親観測成功、未終了、初期化実体・receipt不足を与える。
    /// @observation encoderのSome/Noneと部分作成frame。
    /// @oracle 完了条件不足はNone、停止の部分処置は保持する。
    /// @cleanup N/A: 局所memoryのみ。
    /// @boundary Native結果→frame。
    #[test]
    fn completion_requires_joint_settlement() {
        let mut response = blocked([7; 32], "terminal_namespace_parent_observed");
        response.status = 1;
        response.identities[0] = Some([1, 2, 3, 4, 5, 0x10]);
        response.selected_user = Some([8; 32]);
        response.token_closes = vec![true, true];
        response.directory_closes = vec![true];
        assert!(encode_response(&response).is_some());
        response.directory_closes[0] = false;
        assert!(encode_response(&response).is_none());
        response.directory_closes[0] = true;
        response.status = 2;
        response.reason = "terminal_namespace_initialized";
        assert!(encode_response(&response).is_none());
        response.status = 0;
        response.reason = "terminal_namespace_create_unconfirmed";
        response.children[0] = Some(ChildReceipt {
            create_issued: true,
            created: None,
            handle_acquired: false,
            close: None,
        });
        assert!(encode_response(&response).is_some());
    }
}
