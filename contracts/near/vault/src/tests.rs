use super::*;
use near_sdk::test_utils::{get_logs, VMContextBuilder};
use near_sdk::testing_env;

fn acc(s: &str) -> AccountId {
    s.parse().unwrap()
}

const OWNER: &str = "owner.testnet";
const AGENT: &str = "agent.testnet";
const SHOP: &str = "shop.testnet";
const USDC: &str = "usdc.testnet";

fn as_caller(who: &str, at: u64) {
    testing_env!(VMContextBuilder::new()
        .current_account_id(acc("vault.testnet"))
        .predecessor_account_id(acc(who))
        .block_timestamp(at)
        .account_balance(NearToken::from_near(100))
        .build());
}

/// A vault with one agent, one receiver, NEAR limited to 1 per transfer and 3 per day,
/// USDC to 5 and 20.
fn vault() -> Vault {
    as_caller(OWNER, 1);
    let mut v = Vault::new(acc(OWNER));
    v.add_agent(acc(AGENT));
    v.add_receiver(NATIVE.into(), acc(SHOP));
    v.add_receiver(USDC.into(), acc(SHOP));
    v.set_limit(
        NATIVE.into(),
        U128(10u128.pow(24)),
        U128(3 * 10u128.pow(24)),
    );
    v.set_limit(USDC.into(), U128(5_000_000), U128(20_000_000));
    v
}

fn near(n: u128) -> U128 {
    U128(n * 10u128.pow(24))
}

#[test]
fn pays_within_the_limits_and_counts_the_spend() {
    let mut v = vault();
    as_caller(AGENT, 10);
    v.execute_transfer(NATIVE.into(), acc(SHOP), near(1), None);
    assert_eq!(v.get_spent_today(NATIVE.into()), near(1));
    assert_eq!(v.get_remaining(NATIVE.into()), near(1));
    assert!(get_logs()
        .iter()
        .any(|l| l.contains("\"event\":\"transfer_executed\"")));
}

#[test]
fn pays_a_token_through_ft_transfer() {
    let mut v = vault();
    as_caller(AGENT, 10);
    v.execute_transfer(
        USDC.into(),
        acc(SHOP),
        U128(5_000_000),
        Some("invoice-7".into()),
    );
    assert_eq!(v.get_spent_today(USDC.into()), U128(5_000_000));
}

#[test]
#[should_panic(expected = "E_NOT_AGENT")]
fn refuses_anyone_who_is_not_an_agent() {
    let mut v = vault();
    as_caller("stranger.testnet", 10);
    v.execute_transfer(NATIVE.into(), acc(SHOP), near(1), None);
}

#[test]
#[should_panic(expected = "E_RECEIVER_NOT_ALLOWED")]
fn refuses_a_receiver_not_on_the_list() {
    let mut v = vault();
    as_caller(AGENT, 10);
    v.execute_transfer(NATIVE.into(), acc("attacker.testnet"), near(1), None);
}

#[test]
#[should_panic(expected = "E_ASSET_NOT_ALLOWED")]
fn refuses_an_asset_with_no_limit() {
    let mut v = vault();
    as_caller(AGENT, 10);
    v.execute_transfer("lookalike-usdc.testnet".into(), acc(SHOP), U128(1), None);
}

#[test]
#[should_panic(expected = "E_PER_TRANSFER_LIMIT")]
fn refuses_a_transfer_above_the_per_transfer_limit() {
    let mut v = vault();
    as_caller(AGENT, 10);
    v.execute_transfer(USDC.into(), acc(SHOP), U128(5_000_001), None);
}

#[test]
#[should_panic(expected = "E_DAILY_LIMIT")]
fn refuses_the_transfer_that_crosses_the_daily_limit() {
    let mut v = vault();
    for i in 0..3 {
        as_caller(AGENT, 10 + i);
        v.execute_transfer(NATIVE.into(), acc(SHOP), near(1), None);
    }
    as_caller(AGENT, 20);
    v.execute_transfer(NATIVE.into(), acc(SHOP), U128(1), None);
}

#[test]
fn rolls_the_daily_window() {
    let mut v = vault();
    for i in 0..3 {
        as_caller(AGENT, HOUR_NS * i);
        v.execute_transfer(NATIVE.into(), acc(SHOP), near(1), None);
    }
    // Counted by the hour: the first transfer (hour 0) leaves the window once hour 25
    // starts, 24 to 25 hours after it was made; never earlier than 24 hours.
    as_caller(AGENT, DAY_NS + 1);
    assert_eq!(v.get_spent_today(NATIVE.into()), near(3));
    as_caller(AGENT, DAY_NS + HOUR_NS);
    assert_eq!(v.get_spent_today(NATIVE.into()), near(2));
    v.execute_transfer(NATIVE.into(), acc(SHOP), near(1), None);
    assert_eq!(v.get_spent_today(NATIVE.into()), near(3));
}

#[test]
#[should_panic(expected = "E_PAUSED")]
fn pays_nobody_while_paused() {
    let mut v = vault();
    as_caller(OWNER, 5);
    v.set_paused(true);
    as_caller(AGENT, 10);
    v.execute_transfer(NATIVE.into(), acc(SHOP), near(1), None);
}

#[test]
#[should_panic(expected = "E_NOT_OWNER")]
fn lets_only_the_owner_change_the_policy() {
    let mut v = vault();
    as_caller(AGENT, 10);
    v.add_receiver(NATIVE.into(), acc("attacker.testnet"));
}

#[test]
#[should_panic(expected = "E_AMOUNT_ZERO")]
fn refuses_a_zero_transfer() {
    let mut v = vault();
    as_caller(AGENT, 10);
    v.execute_transfer(NATIVE.into(), acc(SHOP), U128(0), None);
}

#[test]
#[should_panic(expected = "E_BAD_LIMIT")]
fn refuses_a_per_transfer_limit_above_the_daily_one() {
    let mut v = vault();
    as_caller(OWNER, 5);
    v.set_limit(NATIVE.into(), near(2), near(1));
}

#[test]
fn a_removed_agent_or_asset_stops_at_once() {
    let mut v = vault();
    as_caller(OWNER, 5);
    v.remove_asset(USDC.into());
    assert_eq!(v.get_remaining(USDC.into()), U128(0));
    let policy = v.get_policy();
    assert_eq!(policy.limits.len(), 1);
    assert_eq!(policy.agents, vec![acc(AGENT)]);
    v.remove_agent(acc(AGENT));
    assert!(v.get_policy().agents.is_empty());
}

#[test]
fn a_failed_transfer_gives_its_amount_back() {
    let mut v = vault();
    as_caller(AGENT, 10);
    v.execute_transfer(NATIVE.into(), acc(SHOP), near(1), None);
    as_caller("vault.testnet", 11);
    let ok = v.on_transfer_settled(NATIVE.into(), near(1), 10, Err(PromiseError::Failed));
    assert!(!ok);
    assert_eq!(v.get_spent_today(NATIVE.into()), U128(0));
}

// ------------------------------------------------------------ Chain Signatures (TN.7)

const MONAD: &str = "eip155:10143";
const EVM_SHOP: &str = "0x5bb6ff1fcbe31ed8fbce6805852ce279475522fc";

fn evm_tx(value: &str) -> EvmTransfer {
    EvmTransfer {
        chain_id: 10143,
        nonce: 7,
        max_priority_fee_per_gas: "2000000000".into(),
        max_fee_per_gas: "60000000000".into(),
        gas_limit: 21000,
        // Mixed case on purpose: the vault normalises it.
        to: "0x5BB6fF1FCbE31ED8FBce6805852Ce279475522fc".into(),
        value: value.into(),
    }
}

/// The base vault plus MON on Monad testnet: 0.1 per transfer, 0.3 per day (wei), and
/// the EVM shop on the receiver list.
fn evm_vault() -> Vault {
    let mut v = vault();
    as_caller(OWNER, 2);
    v.set_limit(MONAD.into(), U128(10u128.pow(17)), U128(3 * 10u128.pow(17)));
    v.add_receiver(MONAD.into(), acc(EVM_SHOP));
    v
}

const FEE: u128 = 60_000_000_000 * 21_000;

#[test]
fn signs_an_evm_transfer_and_counts_value_plus_max_fee() {
    let mut v = evm_vault();
    as_caller(AGENT, 10);
    v.request_evm_signature(evm_tx("10000000000000000"));
    assert_eq!(
        v.get_spent_today(MONAD.into()),
        U128(10_000_000_000_000_000 + FEE)
    );
    assert!(get_logs()
        .iter()
        .any(|l| l.contains("\"event\":\"evm_signature_requested\"")
            && l.contains("7ac1463ea822e31e7122d92e407fefee98f1e60d17c7ab6e2e2f410b8d1117ca")));
}

#[test]
fn the_owner_withdraws_evm_funds_past_every_rule_even_while_paused() {
    let mut v = evm_vault();
    v.set_paused(true);
    // Far above the limits, to an address on no list: the owner's own money.
    let mut tx = evm_tx("5000000000000000000");
    tx.to = "0x000000000000000000000000000000000000dEaD".into();
    v.withdraw_evm(tx);
    assert_eq!(v.get_spent_today(MONAD.into()), U128(0));
    assert!(get_logs()
        .iter()
        .any(|l| l.contains("\"event\":\"evm_withdrawal_requested\"")
            && l.contains("0x000000000000000000000000000000000000dead")));
}

#[test]
#[should_panic(expected = "E_NOT_OWNER")]
fn only_the_owner_withdraws_evm_funds() {
    let v = evm_vault();
    as_caller(AGENT, 10);
    v.withdraw_evm(evm_tx("1"));
}

#[test]
#[should_panic(expected = "E_BAD_EVM_TX")]
fn an_evm_withdrawal_is_built_by_the_vault_too() {
    let v = evm_vault();
    let mut tx = evm_tx("1");
    tx.to = "not-an-address".into();
    v.withdraw_evm(tx);
}

#[test]
fn reports_its_version() {
    let v = vault();
    assert_eq!(v.get_version(), "0.2.1");
}

#[test]
fn the_payload_view_is_the_eip1559_hash_viem_computes() {
    let v = evm_vault();
    let p = v.get_evm_payload(evm_tx("10000000000000000"));
    assert_eq!(
        p["payload"],
        "7ac1463ea822e31e7122d92e407fefee98f1e60d17c7ab6e2e2f410b8d1117ca"
    );
    assert_eq!(p["receiver"], EVM_SHOP);
    assert_eq!(p["asset"], MONAD);
}

#[test]
#[should_panic(expected = "E_PER_TRANSFER_LIMIT")]
fn the_fee_counts_against_the_per_transfer_limit() {
    let mut v = evm_vault();
    as_caller(AGENT, 10);
    // Exactly the limit in value: the fee on top crosses it.
    v.request_evm_signature(evm_tx("100000000000000000"));
}

#[test]
#[should_panic(expected = "E_RECEIVER_NOT_ALLOWED")]
fn refuses_an_evm_receiver_not_on_the_list() {
    let mut v = evm_vault();
    as_caller(AGENT, 10);
    let mut tx = evm_tx("1");
    tx.to = "0x000000000000000000000000000000000000dEaD".into();
    v.request_evm_signature(tx);
}

#[test]
#[should_panic(expected = "E_ASSET_NOT_ALLOWED")]
fn refuses_an_evm_chain_with_no_limit() {
    let mut v = evm_vault();
    as_caller(AGENT, 10);
    let mut tx = evm_tx("1");
    tx.chain_id = 1;
    v.request_evm_signature(tx);
}

#[test]
#[should_panic(expected = "E_NOT_AGENT")]
fn refuses_an_evm_signature_for_a_stranger() {
    let mut v = evm_vault();
    as_caller("stranger.testnet", 10);
    v.request_evm_signature(evm_tx("1"));
}

#[test]
#[should_panic(expected = "E_BAD_EVM_TX")]
fn refuses_a_malformed_evm_transfer() {
    let mut v = evm_vault();
    as_caller(AGENT, 10);
    let mut tx = evm_tx("1");
    tx.to = "0x12".into();
    v.request_evm_signature(tx);
}

#[test]
fn a_failed_signature_gives_the_spend_back() {
    let mut v = evm_vault();
    as_caller(AGENT, 10);
    v.request_evm_signature(evm_tx("1000"));
    let spent = 1000 + FEE;
    assert_eq!(v.get_spent_today(MONAD.into()), U128(spent));
    as_caller("vault.testnet", 11);
    let out = v.on_evm_signed(MONAD.into(), U128(spent), 10, Err(PromiseError::Failed));
    assert!(out.is_none());
    assert_eq!(v.get_spent_today(MONAD.into()), U128(0));
}

// ------------------------------------------------------------ 0.2 (review, 2026-11-09)

#[test]
#[should_panic(expected = "E_RECEIVER_NOT_ALLOWED")]
fn an_evm_receiver_cannot_be_paid_in_near() {
    // 0x addresses are valid NEAR account ids (eth-implicit): listed for Monad, the EVM
    // shop must still not receive NEAR from the vault.
    let mut v = evm_vault();
    as_caller(AGENT, 10);
    v.execute_transfer(NATIVE.into(), acc(EVM_SHOP), U128(1), None);
}

#[test]
fn the_policy_lists_receivers_per_asset() {
    let v = evm_vault();
    let p = v.get_policy();
    assert_eq!(p.receivers.len(), 3);
    assert!(p
        .receivers
        .contains(&(MONAD.to_string(), vec![acc(EVM_SHOP)])));
    assert_eq!(v.get_version(), "0.2.0");
}

#[test]
fn a_removed_asset_takes_its_receivers_with_it() {
    let mut v = evm_vault();
    as_caller(OWNER, 5);
    v.remove_asset(MONAD.into());
    assert!(v.get_policy().receivers.iter().all(|(a, _)| a != MONAD));
}

#[test]
fn many_small_transfers_keep_the_spend_history_bounded() {
    let mut v = vault();
    as_caller(OWNER, 5);
    v.set_limit(NATIVE.into(), U128(1), near(1000));
    for i in 0..200u64 {
        // 200 transfers over 50 hours: at most 25 hourly buckets are ever kept.
        as_caller(AGENT, i * HOUR_NS / 4);
        v.execute_transfer(NATIVE.into(), acc(SHOP), U128(1), None);
        assert!(v.spent.get(NATIVE).map_or(0, |l| l.len()) <= 25);
    }
    // The last 25 hours hold 100 transfers of 1 yoctoNEAR (4 per hour).
    assert_eq!(v.get_spent_today(NATIVE.into()), U128(100));
}

#[test]
fn hands_the_vault_over_in_two_steps() {
    let mut v = vault();
    as_caller(OWNER, 5);
    v.propose_owner(acc("new-owner.testnet"));
    assert_eq!(v.get_policy().owner, acc(OWNER));
    as_caller("new-owner.testnet", 6);
    v.accept_owner();
    let p = v.get_policy();
    assert_eq!(p.owner, acc("new-owner.testnet"));
    assert_eq!(p.pending_owner, None);
}

#[test]
#[should_panic(expected = "E_NOT_PENDING_OWNER")]
fn nobody_else_can_take_the_vault() {
    let mut v = vault();
    as_caller(OWNER, 5);
    v.propose_owner(acc("new-owner.testnet"));
    as_caller(AGENT, 6);
    v.accept_owner();
}

#[test]
#[should_panic(expected = "E_NOT_OWNER")]
fn only_the_owner_can_replace_the_code() {
    let v = vault();
    as_caller(AGENT, 10);
    v.update_contract();
}

#[test]
fn migrates_a_0_1_vault_without_resetting_its_limits() {
    as_caller("vault.testnet", HOUR_NS);
    let mut old = VaultV1 {
        owner: acc(OWNER),
        paused: false,
        agents: IterableSet::new(StorageKey::Agents),
        receivers: IterableSet::new(StorageKey::Receivers),
        limits: IterableMap::new(StorageKey::Limits),
        spent: LookupMap::new(StorageKey::Spent),
    };
    old.agents.insert(acc(AGENT));
    old.receivers.insert(acc(SHOP));
    old.receivers.insert(acc(EVM_SHOP));
    old.limits.insert(
        NATIVE.into(),
        Limit {
            per_transfer: near(1),
            per_day: near(3),
        },
    );
    old.limits.insert(
        MONAD.into(),
        Limit {
            per_transfer: U128(10),
            per_day: U128(30),
        },
    );
    old.spent.insert(
        NATIVE.into(),
        vec![SpendV1 {
            at: HOUR_NS / 2,
            amount: 2 * 10u128.pow(24),
        }],
    );
    old.agents.flush();
    old.receivers.flush();
    old.limits.flush();
    old.spent.flush();
    env::state_write(&old);

    let mut v = Vault::migrate();
    let p = v.get_policy();
    assert_eq!(p.agents, vec![acc(AGENT)]);
    assert!(p.receivers.contains(&(NATIVE.to_string(), vec![acc(SHOP)])));
    assert!(p
        .receivers
        .contains(&(MONAD.to_string(), vec![acc(EVM_SHOP)])));
    // The 2 NEAR spent before the update still count.
    assert_eq!(v.get_remaining(NATIVE.into()), near(1));
    // Running migrate again on the 0.2 state keeps it. (On chain #[init] writes the state
    // and its collections; here they are flushed by hand first.)
    v.agents.flush();
    v.receivers.flush();
    v.limits.flush();
    v.spent.flush();
    env::state_write(&v);
    let again = Vault::migrate();
    assert_eq!(again.get_policy().receivers.len(), 2);
}
