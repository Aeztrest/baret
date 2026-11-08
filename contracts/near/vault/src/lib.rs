//! Baret spend-limit vault for AI agents on NEAR (ADR-0011, docs/chains/near.md §3).
//!
//! The owner funds the vault with NEAR and NEP-141 tokens and sets the policy: for each
//! asset a limit per transfer and a limit per rolling 24 hours, and the receivers an
//! agent may pay. An agent's function call key reaches only `execute_transfer` on this
//! contract, so a leaked agent key can spend at most what the policy allows and can never
//! touch the owner's account.
//!
//! Chain Signatures (TN.7): `request_evm_signature` lets the same agent pay on an EVM chain
//! from an address the vault controls through NEAR's MPC network. The vault builds the
//! transaction itself (evm.rs) and applies the same policy: the asset is the chain's
//! CAIP-2 id (`eip155:10143`), the receiver a lowercase 0x address on the receiver list.
//!
//! Fail-closed: an asset with no limit cannot be spent, a receiver not on the list cannot
//! be paid, and a paused vault pays nobody. Every refusal panics with a stable code
//! (`E_…`), never a sentence: the words live in Baret's content (CLAUDE.md rule 4).

mod evm;

pub use evm::EvmTransfer;
use evm::{encode_hex, EvmError};
use near_sdk::json_types::U128;
use near_sdk::serde_json::{self, json, Value};
use near_sdk::store::{IterableMap, IterableSet, LookupMap};
use near_sdk::{
    env, ext_contract, near, require, AccountId, BorshStorageKey, Gas, NearToken, PanicOnDefault,
    Promise, PromiseError, PromiseOrValue,
};

/// The asset id of NEAR itself; any other asset id is a NEP-141 token contract.
pub const NATIVE: &str = "native";
/// Length of the rolling window, in nanoseconds (block timestamps are in ns).
pub const DAY_NS: u64 = 86_400 * 1_000_000_000;
/// Gas for a token's `ft_transfer` and for this vault's own callback.
const FT_TRANSFER_GAS: Gas = Gas::from_tgas(10);
const CALLBACK_GAS: Gas = Gas::from_tgas(10);
/// The derivation path of the vault's EVM address: one address for every EVM chain.
pub const EVM_PATH: &str = "eip155";
/// NEAR's MPC signer (Chain Signatures). The vault's own account says which network it is
/// on, so no state field is needed and an already deployed vault keeps its layout.
const MPC_TESTNET: &str = "v1.signer-prod.testnet";
const MPC_MAINNET: &str = "v1.signer";

/// Refusal codes. Public so tests and clients match them exactly.
pub mod errors {
    pub const NOT_OWNER: &str = "E_NOT_OWNER";
    pub const NOT_AGENT: &str = "E_NOT_AGENT";
    pub const PAUSED: &str = "E_PAUSED";
    pub const AMOUNT_ZERO: &str = "E_AMOUNT_ZERO";
    pub const ASSET_NOT_ALLOWED: &str = "E_ASSET_NOT_ALLOWED";
    pub const RECEIVER_NOT_ALLOWED: &str = "E_RECEIVER_NOT_ALLOWED";
    pub const PER_TRANSFER_LIMIT: &str = "E_PER_TRANSFER_LIMIT";
    pub const DAILY_LIMIT: &str = "E_DAILY_LIMIT";
    pub const BAD_LIMIT: &str = "E_BAD_LIMIT";
    pub const BAD_EVM_TX: &str = "E_BAD_EVM_TX";
}

#[near(serializers = [borsh])]
#[derive(BorshStorageKey)]
enum StorageKey {
    Agents,
    Receivers,
    Limits,
    Spent,
}

/// What one asset may be spent at: per transfer and per rolling 24 hours, in base units.
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct Limit {
    pub per_transfer: U128,
    pub per_day: U128,
}

/// One past transfer, kept for the rolling window.
#[near(serializers = [borsh])]
#[derive(Clone, Debug)]
pub struct Spend {
    pub at: u64,
    pub amount: u128,
}

/// The whole policy, as the view returns it.
#[near(serializers = [json])]
#[derive(Debug)]
pub struct PolicyView {
    pub owner: AccountId,
    pub paused: bool,
    pub agents: Vec<AccountId>,
    pub receivers: Vec<AccountId>,
    pub limits: Vec<(String, Limit)>,
}

#[ext_contract(ext_ft)]
#[allow(dead_code)]
trait FungibleToken {
    fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>);
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Vault {
    owner: AccountId,
    paused: bool,
    agents: IterableSet<AccountId>,
    receivers: IterableSet<AccountId>,
    limits: IterableMap<String, Limit>,
    spent: LookupMap<String, Vec<Spend>>,
}

#[near]
impl Vault {
    #[init]
    pub fn new(owner: AccountId) -> Self {
        Self {
            owner,
            paused: false,
            agents: IterableSet::new(StorageKey::Agents),
            receivers: IterableSet::new(StorageKey::Receivers),
            limits: IterableMap::new(StorageKey::Limits),
            spent: LookupMap::new(StorageKey::Spent),
        }
    }

    // ---------------------------------------------------------------- owner

    /// Sets (or replaces) the limits of an asset. An asset with limits is an allowed asset.
    pub fn set_limit(&mut self, asset: String, per_transfer: U128, per_day: U128) {
        self.assert_owner();
        require!(
            per_transfer.0 > 0 && per_transfer.0 <= per_day.0,
            errors::BAD_LIMIT
        );
        self.limits.insert(
            asset,
            Limit {
                per_transfer,
                per_day,
            },
        );
    }

    /// Removes an asset: it can no longer be spent.
    pub fn remove_asset(&mut self, asset: String) {
        self.assert_owner();
        self.limits.remove(&asset);
    }

    pub fn add_receiver(&mut self, receiver: AccountId) {
        self.assert_owner();
        self.receivers.insert(receiver);
    }

    pub fn remove_receiver(&mut self, receiver: AccountId) {
        self.assert_owner();
        self.receivers.remove(&receiver);
    }

    pub fn add_agent(&mut self, agent: AccountId) {
        self.assert_owner();
        self.agents.insert(agent);
    }

    pub fn remove_agent(&mut self, agent: AccountId) {
        self.assert_owner();
        self.agents.remove(&agent);
    }

    /// The kill switch: a paused vault pays nobody until the owner unpauses it.
    pub fn set_paused(&mut self, paused: bool) {
        self.assert_owner();
        self.paused = paused;
        emit("vault_paused", &format!("{{\"paused\":{paused}}}"));
    }

    /// Funds the vault with NEAR. Anyone may fund it; only the policy decides who is paid.
    #[payable]
    pub fn deposit(&mut self) {}

    /// The owner takes funds back, with no limits.
    pub fn withdraw(&mut self, asset: String, amount: U128) -> Promise {
        self.assert_owner();
        require!(amount.0 > 0, errors::AMOUNT_ZERO);
        self.send(&asset, self.owner.clone(), amount.0, None)
    }

    // ---------------------------------------------------------------- agent

    /// The only call an agent's key can make. Pays `amount` of `asset` to `receiver`
    /// when every rule allows it; refuses with an `E_…` code otherwise.
    pub fn execute_transfer(
        &mut self,
        asset: String,
        receiver: AccountId,
        amount: U128,
        memo: Option<String>,
    ) -> Promise {
        let agent = env::predecessor_account_id();
        let now = env::block_timestamp();
        self.check(&agent, &asset, &receiver, amount.0, now);
        self.record(&asset, amount.0, now);
        emit(
            "transfer_executed",
            &format!(
                "{{\"agent\":\"{agent}\",\"asset\":\"{asset}\",\"receiver\":\"{receiver}\",\"amount\":\"{}\"}}",
                amount.0
            ),
        );
        self.send(&asset, receiver, amount.0, memo).then(
            Self::ext(env::current_account_id())
                .with_static_gas(CALLBACK_GAS)
                .on_transfer_settled(asset, amount, now),
        )
    }

    /// A transfer that failed on the receiving side gives its amount back to the window.
    #[private]
    pub fn on_transfer_settled(
        &mut self,
        asset: String,
        amount: U128,
        at: u64,
        #[callback_result] result: Result<(), PromiseError>,
    ) -> bool {
        if result.is_ok() {
            return true;
        }
        self.unrecord(&asset, amount.0, at);
        emit(
            "transfer_failed",
            &format!("{{\"asset\":\"{asset}\",\"amount\":\"{}\"}}", amount.0),
        );
        false
    }

    /// Signs an EVM native transfer with the vault's derived key when every rule allows it.
    /// The spend counted is the transaction's worst case (value + gas limit x max fee).
    /// Returns the MPC signature (`big_r`, `s`, `recovery_id`), or null when the MPC
    /// network failed, in which case the spend goes back to the window.
    pub fn request_evm_signature(&mut self, tx: EvmTransfer) -> Promise {
        let agent = env::predecessor_account_id();
        let now = env::block_timestamp();
        let (receiver, unsigned, cost) = evm_parts(&tx);
        let asset = tx.asset();
        self.check(&agent, &asset, &receiver, cost, now);
        self.record(&asset, cost, now);
        let payload = encode_hex(&env::keccak256(&unsigned));
        emit(
            "evm_signature_requested",
            &format!(
                "{{\"agent\":\"{agent}\",\"asset\":\"{asset}\",\"receiver\":\"{receiver}\",\"value\":\"{}\",\"max_cost\":\"{cost}\",\"payload\":\"{payload}\"}}",
                tx.value
            ),
        );
        let args = json!({
            "request": { "path": EVM_PATH, "payload_v2": { "Ecdsa": payload }, "domain_id": 0 }
        });
        Promise::new(mpc_account())
            .function_call_weight(
                "sign".to_string(),
                serde_json::to_vec(&args).unwrap_or_default(),
                NearToken::from_yoctonear(1),
                Gas::from_tgas(0),
                near_sdk::GasWeight(1),
            )
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(CALLBACK_GAS)
                    .on_evm_signed(asset, U128(cost), now),
            )
    }

    /// The MPC answer. A failed signature gives its spend back to the window.
    #[private]
    pub fn on_evm_signed(
        &mut self,
        asset: String,
        amount: U128,
        at: u64,
        #[callback_result] result: Result<Value, PromiseError>,
    ) -> Option<Value> {
        match result {
            Ok(signature) => Some(signature),
            Err(_) => {
                self.unrecord(&asset, amount.0, at);
                emit(
                    "evm_signature_failed",
                    &format!("{{\"asset\":\"{asset}\",\"amount\":\"{}\"}}", amount.0),
                );
                None
            }
        }
    }

    // ---------------------------------------------------------------- NEP-141

    /// Accepts any token sent with `ft_transfer_call`; whether it can be spent is the
    /// policy's business, not the deposit's.
    pub fn ft_on_transfer(
        &mut self,
        sender_id: AccountId,
        amount: U128,
        msg: String,
    ) -> PromiseOrValue<U128> {
        let _ = (sender_id, amount, msg);
        PromiseOrValue::Value(U128(0))
    }

    // ---------------------------------------------------------------- views

    pub fn get_policy(&self) -> PolicyView {
        PolicyView {
            owner: self.owner.clone(),
            paused: self.paused,
            agents: self.agents.iter().cloned().collect(),
            receivers: self.receivers.iter().cloned().collect(),
            limits: self
                .limits
                .iter()
                .map(|(k, v)| (k.clone(), v.clone()))
                .collect(),
        }
    }

    /// What `asset` has spent in the last 24 hours, in base units.
    pub fn get_spent_today(&self, asset: String) -> U128 {
        U128(self.window_total(&asset, env::block_timestamp()))
    }

    /// What one more transfer of `asset` could still be, now: the smaller of the
    /// per-transfer limit and what is left of the day. 0 when the asset is not allowed.
    pub fn get_remaining(&self, asset: String) -> U128 {
        let Some(limit) = self.limits.get(&asset) else {
            return U128(0);
        };
        let left = limit
            .per_day
            .0
            .saturating_sub(self.window_total(&asset, env::block_timestamp()));
        U128(left.min(limit.per_transfer.0))
    }

    /// What an EVM transfer would be signed as: the keccak256 the MPC network signs, the
    /// asset and receiver the policy reads and the spend it counts. For clients and Baret's
    /// preflight; it checks no rule.
    pub fn get_evm_payload(&self, tx: EvmTransfer) -> Value {
        let (receiver, unsigned, cost) = evm_parts(&tx);
        json!({
            "payload": encode_hex(&env::keccak256(&unsigned)),
            "asset": tx.asset(),
            "receiver": receiver,
            "max_cost": cost.to_string(),
            "path": EVM_PATH,
        })
    }

    // ---------------------------------------------------------------- internals

    fn assert_owner(&self) {
        require!(
            env::predecessor_account_id() == self.owner,
            errors::NOT_OWNER
        );
    }

    /// Every rule an agent's transfer must pass, in a fixed order so the code names the
    /// first rule that refused.
    fn check(&self, agent: &AccountId, asset: &str, receiver: &AccountId, amount: u128, now: u64) {
        require!(!self.paused, errors::PAUSED);
        require!(self.agents.contains(agent), errors::NOT_AGENT);
        require!(amount > 0, errors::AMOUNT_ZERO);
        let limit = self
            .limits
            .get(asset)
            .unwrap_or_else(|| env::panic_str(errors::ASSET_NOT_ALLOWED));
        require!(
            self.receivers.contains(receiver),
            errors::RECEIVER_NOT_ALLOWED
        );
        require!(amount <= limit.per_transfer.0, errors::PER_TRANSFER_LIMIT);
        let total = self.window_total(asset, now).saturating_add(amount);
        require!(total <= limit.per_day.0, errors::DAILY_LIMIT);
    }

    fn window_total(&self, asset: &str, now: u64) -> u128 {
        let since = now.saturating_sub(DAY_NS);
        self.spent
            .get(asset)
            .map(|list| list.iter().filter(|s| s.at > since).map(|s| s.amount).sum())
            .unwrap_or(0)
    }

    /// Adds a spend and drops the ones the window no longer covers.
    fn record(&mut self, asset: &str, amount: u128, now: u64) {
        let since = now.saturating_sub(DAY_NS);
        let mut list: Vec<Spend> = self
            .spent
            .get(asset)
            .map(|l| l.iter().filter(|s| s.at > since).cloned().collect())
            .unwrap_or_default();
        list.push(Spend { at: now, amount });
        self.spent.insert(asset.to_string(), list);
    }

    fn unrecord(&mut self, asset: &str, amount: u128, at: u64) {
        if let Some(list) = self.spent.get_mut(asset) {
            if let Some(i) = list.iter().position(|s| s.at == at && s.amount == amount) {
                list.remove(i);
            }
        }
    }

    fn send(
        &self,
        asset: &str,
        receiver: AccountId,
        amount: u128,
        memo: Option<String>,
    ) -> Promise {
        if asset == NATIVE {
            Promise::new(receiver).transfer(NearToken::from_yoctonear(amount))
        } else {
            let token: AccountId = asset
                .parse()
                .unwrap_or_else(|_| env::panic_str(errors::ASSET_NOT_ALLOWED));
            ext_ft::ext(token)
                .with_attached_deposit(NearToken::from_yoctonear(1))
                .with_static_gas(FT_TRANSFER_GAS)
                .ft_transfer(receiver, U128(amount), memo)
        }
    }
}

/// The receiver (as an account id), the unsigned bytes and the worst-case cost of an EVM
/// transfer; any malformed field refuses with E_BAD_EVM_TX.
fn evm_parts(tx: &EvmTransfer) -> (AccountId, Vec<u8>, u128) {
    let built = (|| -> Result<_, EvmError> {
        let receiver = tx.receiver()?;
        Ok((receiver, tx.unsigned()?, tx.max_cost()?))
    })();
    let (receiver, unsigned, cost) = built.unwrap_or_else(|_| env::panic_str(errors::BAD_EVM_TX));
    let receiver: AccountId = receiver
        .parse()
        .unwrap_or_else(|_| env::panic_str(errors::BAD_EVM_TX));
    (receiver, unsigned, cost)
}

fn mpc_account() -> AccountId {
    let on_testnet = env::current_account_id().as_str().ends_with(".testnet");
    (if on_testnet { MPC_TESTNET } else { MPC_MAINNET })
        .parse()
        .unwrap_or_else(|_| env::panic_str("E_MPC"))
}

/// A NEP-297 event: `EVENT_JSON:{"standard":"baret_vault","version":"1.0.0",…}`.
fn emit(event: &str, data: &str) {
    env::log_str(&format!(
        "EVENT_JSON:{{\"standard\":\"baret_vault\",\"version\":\"1.0.0\",\"event\":\"{event}\",\"data\":[{data}]}}"
    ));
}

#[cfg(test)]
mod tests;
