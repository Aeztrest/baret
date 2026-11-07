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
