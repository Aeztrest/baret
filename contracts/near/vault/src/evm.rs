//! An EVM payment the vault signs through NEAR Chain Signatures (TASKS.md TN.7).
//!
//! The vault never signs a hash the agent hands it: a hash says nothing about what it
//! pays. The agent sends the transaction's fields instead, the vault checks the receiver
//! and the amount against its policy, builds the EIP-1559 transaction itself and asks the
//! MPC network to sign the hash of exactly that. Only plain native transfers: no
//! calldata, no access list, so the fields the policy reads are the whole transaction.
//!
//! No dependencies, so the encoding is tested on its own:
//! `rustc --edition 2021 --test --cfg 'feature="standalone"' src/evm.rs`.

/// The fields of an EIP-1559 native transfer, as the agent sends them (JSON numbers as
/// decimal strings, `to` as 0x-prefixed hex).
#[cfg_attr(
    not(feature = "standalone"),
    near_sdk::near(serializers = [json])
)]
#[derive(Clone, Debug, PartialEq)]
pub struct EvmTransfer {
    pub chain_id: u64,
    pub nonce: u64,
    pub max_priority_fee_per_gas: String,
    pub max_fee_per_gas: String,
    pub gas_limit: u64,
    pub to: String,
    pub value: String,
}

/// Why a transfer cannot be built. Mapped to `E_…` codes by the vault.
#[derive(Debug, PartialEq)]
pub enum EvmError {
    BadAddress,
    BadNumber,
    Overflow,
}

impl EvmTransfer {
    /// The receiver as the vault's receiver list stores it: lowercase 0x hex. A NEAR
    /// account id may be exactly that (an "eth-implicit" account id), so EVM receivers
    /// share the list with NEAR receivers.
    pub fn receiver(&self) -> Result<String, EvmError> {
        let hex = self.to.strip_prefix("0x").ok_or(EvmError::BadAddress)?;
        if hex.len() != 40 || !hex.bytes().all(|b| b.is_ascii_hexdigit()) {
            return Err(EvmError::BadAddress);
        }
        Ok(format!("0x{}", hex.to_ascii_lowercase()))
    }

    /// The policy's asset key for this chain's native coin: its CAIP-2 id.
    pub fn asset(&self) -> String {
        format!("eip155:{}", self.chain_id)
    }

    pub fn value_wei(&self) -> Result<u128, EvmError> {
        parse_u128(&self.value)
    }

    /// The most this transaction can take from the signing address: the value plus the
    /// whole gas limit at the maximum fee. The vault counts this against its limits, so a
    /// high fee cannot drain the address around the policy.
    pub fn max_cost(&self) -> Result<u128, EvmError> {
        let fee = parse_u128(&self.max_fee_per_gas)?
            .checked_mul(self.gas_limit as u128)
            .ok_or(EvmError::Overflow)?;
        self.value_wei()?.checked_add(fee).ok_or(EvmError::Overflow)
    }

    /// `0x02 || rlp([chainId, nonce, maxPriorityFeePerGas, maxFeePerGas, gasLimit, to,
    /// value, data, accessList])` with empty data and access list: the bytes whose
    /// keccak256 the signature covers (EIP-1559).
    pub fn unsigned(&self) -> Result<Vec<u8>, EvmError> {
        let to = decode_hex(&self.receiver()?[2..]).ok_or(EvmError::BadAddress)?;
        let items = [
            rlp_uint(self.chain_id as u128),
            rlp_uint(self.nonce as u128),
            rlp_uint(parse_u128(&self.max_priority_fee_per_gas)?),
            rlp_uint(parse_u128(&self.max_fee_per_gas)?),
            rlp_uint(self.gas_limit as u128),
            rlp_bytes(&to),
            rlp_uint(self.value_wei()?),
            rlp_bytes(&[]),
            rlp_list(&[]),
        ];
        let mut out = vec![0x02];
        out.extend(rlp_list(&items));
        Ok(out)
    }
}

fn parse_u128(s: &str) -> Result<u128, EvmError> {
    if s.is_empty() || !s.bytes().all(|b| b.is_ascii_digit()) {
        return Err(EvmError::BadNumber);
    }
    s.parse().map_err(|_| EvmError::Overflow)
}

fn decode_hex(s: &str) -> Option<Vec<u8>> {
    if s.len() % 2 != 0 {
        return None;
    }
    (0..s.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i + 2], 16).ok())
        .collect()
}

pub fn encode_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn rlp_len_prefix(len: usize, short: u8, long: u8) -> Vec<u8> {
    if len < 56 {
        vec![short + len as u8]
    } else {
        let be = (len as u64).to_be_bytes();
        let first = be.iter().position(|b| *b != 0).unwrap_or(7);
        let mut out = vec![long + (8 - first) as u8];
        out.extend_from_slice(&be[first..]);
        out
    }
}

fn rlp_bytes(b: &[u8]) -> Vec<u8> {
    if b.len() == 1 && b[0] < 0x80 {
        return b.to_vec();
    }
    let mut out = rlp_len_prefix(b.len(), 0x80, 0xb7);
    out.extend_from_slice(b);
    out
}

/// An integer as RLP: big-endian with no leading zeros; zero is the empty string.
fn rlp_uint(v: u128) -> Vec<u8> {
    let be = v.to_be_bytes();
    let first = be.iter().position(|b| *b != 0).unwrap_or(be.len());
    rlp_bytes(&be[first..])
}

fn rlp_list(items: &[Vec<u8>]) -> Vec<u8> {
    let body: Vec<u8> = items.concat();
    let mut out = rlp_len_prefix(body.len(), 0xc0, 0xf7);
    out.extend(body);
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> EvmTransfer {
        EvmTransfer {
            chain_id: 10143,
            nonce: 7,
            max_priority_fee_per_gas: "2000000000".into(),
            max_fee_per_gas: "60000000000".into(),
            gas_limit: 21000,
            to: "0x5BB6fF1FCbE31ED8FBce6805852Ce279475522fc".into(),
            value: "10000000000000000".into(),
        }
    }

    /// Same transaction serialised by viem's serializeTransaction (type eip1559).
    #[test]
    fn matches_viem() {
        assert_eq!(
            encode_hex(&sample().unsigned().unwrap()),
            "02f182279f078477359400850df847580082520894\
5bb6ff1fcbe31ed8fbce6805852ce279475522fc872386f26fc1000080c0"
        );
    }

    #[test]
    fn zero_value_and_nonce_encode_as_empty_strings() {
        let mut t = sample();
        t.nonce = 0;
        t.value = "0".into();
        let hex = encode_hex(&t.unsigned().unwrap());
        assert!(hex.starts_with("02"));
        assert!(hex.ends_with("8080c0"));
    }

    #[test]
    fn counts_the_whole_fee_against_the_limit() {
        assert_eq!(
            sample().max_cost().unwrap(),
            10_000_000_000_000_000 + 60_000_000_000 * 21_000
        );
    }

    #[test]
    fn refuses_bad_fields() {
        let mut t = sample();
        t.to = "0x123".into();
        assert_eq!(t.unsigned(), Err(EvmError::BadAddress));
        let mut t = sample();
        t.value = "-1".into();
        assert_eq!(t.max_cost(), Err(EvmError::BadNumber));
        assert_eq!(
            sample().receiver().unwrap(),
            "0x5bb6ff1fcbe31ed8fbce6805852ce279475522fc"
        );
        assert_eq!(sample().asset(), "eip155:10143");
    }
}
