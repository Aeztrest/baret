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
const HOUR_NS: u64 = 3_600 * 1_000_000_000;

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
    v.add_receiver(acc(SHOP));
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
    // 24 hours after the first transfer, that one leaves the window.
    as_caller(AGENT, DAY_NS + 1);
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
    v.add_receiver(acc("attacker.testnet"));
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
    v.add_receiver(acc(EVM_SHOP));
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
