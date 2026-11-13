//! Baret's shared blocklist on NEAR (TN.14, docs/chains/near.md §2a).
//!
//! Agents (or the people who run them) report an account that tried to take their money,
//! with evidence: the hash of the transaction it happened in and a reason code. Each
//! reporter reports an account once, and pays a small deposit for the storage it uses,
//! so a report has a cost. An account is flagged when the owner confirms it or when
//! `threshold` different reporters have reported it. Baret reads `get_flags` before an
//! agent signs: a flagged receiver is Blocked, a reported one is a Caution.
//!
//! Reporters are not vetted: below the threshold a report is only a warning, and the owner
//! can dismiss an entry made of false reports. Every refusal panics with a stable code.
//!
//! Trust: like the vault, the contract's account keeps no access key once deployed; its
//! code changes only through the owner's `update_contract`.

use near_sdk::store::IterableMap;
use near_sdk::{
    env, near, require, AccountId, BorshStorageKey, Gas, GasWeight, NearToken, PanicOnDefault,
    Promise,
};

pub const VERSION: &str = "0.1.0";
/// What a report costs: about 1 kB of storage at 10^19 yoctoNEAR a byte, kept by the
/// contract (it pays for the report's storage).
pub const REPORT_DEPOSIT: NearToken = NearToken::from_millinear(10);
/// Reports kept per account: enough to flag it, bounded so one account cannot grow the
/// state without end.
pub const MAX_REPORTS: usize = 20;
/// The longest reason code and the most accounts one `get_flags` call reads.
const MAX_REASON: usize = 32;
pub const MAX_QUERY: usize = 50;
const MIGRATE_GAS: Gas = Gas::from_tgas(20);

pub mod errors {
    pub const NOT_OWNER: &str = "E_NOT_OWNER";
    pub const DEPOSIT_TOO_LOW: &str = "E_DEPOSIT_TOO_LOW";
    pub const BAD_REASON: &str = "E_BAD_REASON";
    pub const BAD_EVIDENCE: &str = "E_BAD_EVIDENCE";
    pub const SELF_REPORT: &str = "E_SELF_REPORT";
    pub const ALREADY_REPORTED: &str = "E_ALREADY_REPORTED";
    pub const TOO_MANY_REPORTS: &str = "E_TOO_MANY_REPORTS";
    pub const NOT_FOUND: &str = "E_NOT_FOUND";
    pub const BAD_THRESHOLD: &str = "E_BAD_THRESHOLD";
    pub const TOO_MANY_ACCOUNTS: &str = "E_TOO_MANY_ACCOUNTS";
    pub const NO_CODE: &str = "E_NO_CODE";
    pub const BAD_STATE: &str = "E_BAD_STATE";
}

#[near(serializers = [borsh])]
#[derive(BorshStorageKey)]
enum StorageKey {
    Entries,
}

/// One report: who, why, and the transaction that shows it.
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct Report {
    pub reporter: AccountId,
    /// An upper-case code (`DRAINER`, `PROMPT_INJECTION_PAYEE`, …).
    pub reason: String,
    /// The hash of the transaction the reporter points to (base58, 32 bytes).
    pub evidence: String,
    /// Block timestamp of the report, in nanoseconds.
    pub at: u64,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Entry {
    pub reports: Vec<Report>,
    pub confirmed: bool,
}

/// What Baret reads for one account.
#[near(serializers = [json])]
#[derive(Debug, PartialEq)]
pub struct Flag {
    pub account: AccountId,
    /// Confirmed by the owner, or reported by `threshold` different reporters.
    pub flagged: bool,
    pub confirmed: bool,
    pub reports: u32,
    /// The first report's reason.
    pub reason: String,
    /// The first report's transaction.
    pub evidence: String,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Blocklist {
    owner: AccountId,
    threshold: u32,
    entries: IterableMap<AccountId, Entry>,
}

#[near]
impl Blocklist {
    #[init]
    pub fn new(owner: AccountId, threshold: u32) -> Self {
        require!(threshold >= 1, errors::BAD_THRESHOLD);
        Self {
            owner,
            threshold,
            entries: IterableMap::new(StorageKey::Entries),
        }
    }

    /// Runs after `update_contract`: the state is kept as it is.
    #[private]
    #[init(ignore_state)]
    pub fn migrate() -> Self {
        env::state_read().unwrap_or_else(|| env::panic_str(errors::BAD_STATE))
    }

    /// Reports `account`, with the transaction that shows why. Once per reporter.
    #[payable]
    pub fn report(&mut self, account: AccountId, reason: String, evidence: String) {
        require!(
            env::attached_deposit() >= REPORT_DEPOSIT,
            errors::DEPOSIT_TOO_LOW
        );
        require!(valid_reason(&reason), errors::BAD_REASON);
        require!(valid_tx_hash(&evidence), errors::BAD_EVIDENCE);
        let reporter = env::predecessor_account_id();
        require!(reporter != account, errors::SELF_REPORT);
        let mut entry = self.entries.get(&account).cloned().unwrap_or_default();
        require!(
            !entry.reports.iter().any(|r| r.reporter == reporter),
            errors::ALREADY_REPORTED
        );
        require!(entry.reports.len() < MAX_REPORTS, errors::TOO_MANY_REPORTS);
        entry.reports.push(Report {
            reporter: reporter.clone(),
            reason: reason.clone(),
            evidence: evidence.clone(),
            at: env::block_timestamp(),
        });
        self.entries.insert(account.clone(), entry);
        emit(
            "report",
            &format!(
                "{{\"account\":\"{account}\",\"reporter\":\"{reporter}\",\"reason\":\"{reason}\",\"evidence\":\"{evidence}\"}}"
            ),
        );
    }

    /// The owner confirms a reported account: flagged whatever the count.
    pub fn confirm(&mut self, account: AccountId) {
        self.assert_owner();
        let mut entry = self
            .entries
            .get(&account)
            .cloned()
            .unwrap_or_else(|| env::panic_str(errors::NOT_FOUND));
        entry.confirmed = true;
        self.entries.insert(account.clone(), entry);
        emit("confirm", &format!("{{\"account\":\"{account}\"}}"));
    }

    /// The owner removes an entry made of false reports.
    pub fn dismiss(&mut self, account: AccountId) {
        self.assert_owner();
        require!(self.entries.remove(&account).is_some(), errors::NOT_FOUND);
        emit("dismiss", &format!("{{\"account\":\"{account}\"}}"));
    }

    pub fn set_threshold(&mut self, threshold: u32) {
        self.assert_owner();
        require!(threshold >= 1, errors::BAD_THRESHOLD);
        self.threshold = threshold;
    }

    /// The owner replaces the code (the wasm is the call's raw input) and keeps the state.
    pub fn update_contract(&self) -> Promise {
        self.assert_owner();
        let code = env::input().unwrap_or_else(|| env::panic_str(errors::NO_CODE));
        require!(!code.is_empty(), errors::NO_CODE);
        Promise::new(env::current_account_id())
            .deploy_contract(code)
            .function_call_weight(
                "migrate".to_string(),
                vec![],
                NearToken::from_yoctonear(0),
                MIGRATE_GAS,
                GasWeight(1),
            )
    }

    // ---------------------------------------------------------------- views

    /// The accounts in `accounts` that have at least one report. Baret's one read.
    pub fn get_flags(&self, accounts: Vec<AccountId>) -> Vec<Flag> {
        require!(accounts.len() <= MAX_QUERY, errors::TOO_MANY_ACCOUNTS);
        accounts
            .into_iter()
            .filter_map(|a| {
                let e = self.entries.get(&a)?;
                let first = e.reports.first()?;
                let reports = e.reports.len() as u32;
                Some(Flag {
                    flagged: e.confirmed || reports >= self.threshold,
                    confirmed: e.confirmed,
                    reports,
                    reason: first.reason.clone(),
                    evidence: first.evidence.clone(),
                    account: a,
                })
            })
            .collect()
    }

    pub fn get_entry(&self, account: AccountId) -> Option<Entry> {
        self.entries.get(&account).cloned()
    }

    pub fn get_threshold(&self) -> u32 {
        self.threshold
    }

    pub fn get_owner(&self) -> AccountId {
        self.owner.clone()
    }

    pub fn get_version(&self) -> String {
        VERSION.to_string()
    }

    fn assert_owner(&self) {
        require!(
            env::predecessor_account_id() == self.owner,
            errors::NOT_OWNER
        );
    }
}

/// `DRAINER`, `PROMPT_INJECTION_PAYEE`: an upper-case letter, then letters, digits or `_`.
pub fn valid_reason(r: &str) -> bool {
    let b = r.as_bytes();
    (2..=MAX_REASON).contains(&b.len())
        && b[0].is_ascii_uppercase()
        && b.iter()
            .all(|c| c.is_ascii_uppercase() || c.is_ascii_digit() || *c == b'_')
}

/// A NEAR transaction hash: base58 of 32 bytes (43 or 44 characters).
pub fn valid_tx_hash(h: &str) -> bool {
    const B58: &[u8] = b"123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    (43..=44).contains(&h.len()) && h.bytes().all(|c| B58.contains(&c))
}

fn emit(event: &str, data: &str) {
    env::log_str(&format!(
        "EVENT_JSON:{{\"standard\":\"baret_blocklist\",\"version\":\"1.0.0\",\"event\":\"{event}\",\"data\":[{data}]}}"
    ));
}

#[cfg(test)]
mod tests;
