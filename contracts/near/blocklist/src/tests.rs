use super::*;
use near_sdk::test_utils::{get_logs, VMContextBuilder};
use near_sdk::testing_env;

fn acc(s: &str) -> AccountId {
    s.parse().unwrap()
}

const OWNER: &str = "owner.testnet";
const BAD: &str = "drain-it-all.testnet";
const TX: &str = "7J1F9jWcrvXRnPc72yn1Nq2uoSZ6Po3xd3EzvAkBVo5L";

fn as_caller(who: &str, deposit: NearToken) {
    testing_env!(VMContextBuilder::new()
        .current_account_id(acc("blocklist.testnet"))
        .predecessor_account_id(acc(who))
        .attached_deposit(deposit)
        .block_timestamp(42)
        .build());
}

fn list(threshold: u32) -> Blocklist {
    as_caller(OWNER, NearToken::from_yoctonear(0));
    Blocklist::new(acc(OWNER), threshold)
}

fn report(b: &mut Blocklist, reporter: &str, account: &str) {
    as_caller(reporter, REPORT_DEPOSIT);
    b.report(acc(account), "DRAINER".into(), TX.into());
}

fn flag(b: &Blocklist, account: &str) -> Option<Flag> {
    b.get_flags(vec![acc(account)]).into_iter().next()
}

#[test]
fn a_report_is_kept_with_its_evidence_and_announced() {
    let mut b = list(2);
    report(&mut b, "agent-a.testnet", BAD);
    let e = b.get_entry(acc(BAD)).unwrap();
    assert_eq!(
        e.reports,
        vec![Report {
            reporter: acc("agent-a.testnet"),
            reason: "DRAINER".into(),
            evidence: TX.into(),
            at: 42,
        }]
    );
    assert!(get_logs()[0].contains("\"event\":\"report\""));
}

#[test]
fn below_the_threshold_a_report_is_not_a_flag_at_it_it_is() {
    let mut b = list(2);
    report(&mut b, "agent-a.testnet", BAD);
    let f = flag(&b, BAD).unwrap();
    assert!(!f.flagged);
    assert_eq!(f.reports, 1);
    report(&mut b, "agent-b.testnet", BAD);
    let f = flag(&b, BAD).unwrap();
    assert!(f.flagged);
    assert_eq!(
        (f.reports, f.reason.as_str(), f.evidence.as_str()),
        (2, "DRAINER", TX)
    );
}

#[test]
fn the_owner_confirms_one_report_into_a_flag_and_dismisses_false_ones() {
    let mut b = list(3);
    report(&mut b, "agent-a.testnet", BAD);
    as_caller(OWNER, NearToken::from_yoctonear(0));
    b.confirm(acc(BAD));
    let f = flag(&b, BAD).unwrap();
    assert!(f.flagged && f.confirmed);
    b.dismiss(acc(BAD));
    assert_eq!(flag(&b, BAD), None);
}

#[test]
fn get_flags_answers_only_reported_accounts() {
    let mut b = list(1);
    report(&mut b, "agent-a.testnet", BAD);
    let flags = b.get_flags(vec![acc("shop.testnet"), acc(BAD)]);
    assert_eq!(flags.len(), 1);
    assert_eq!(flags[0].account, acc(BAD));
}

#[test]
#[should_panic(expected = "E_ALREADY_REPORTED")]
fn one_reporter_reports_an_account_once() {
    let mut b = list(2);
    report(&mut b, "agent-a.testnet", BAD);
    report(&mut b, "agent-a.testnet", BAD);
}

#[test]
#[should_panic(expected = "E_DEPOSIT_TOO_LOW")]
fn a_report_costs_its_deposit() {
    let mut b = list(2);
    as_caller("agent-a.testnet", NearToken::from_millinear(1));
    b.report(acc(BAD), "DRAINER".into(), TX.into());
}

#[test]
#[should_panic(expected = "E_SELF_REPORT")]
fn nobody_reports_itself() {
    let mut b = list(2);
    report(&mut b, BAD, BAD);
}

#[test]
#[should_panic(expected = "E_BAD_EVIDENCE")]
fn evidence_must_be_a_transaction_hash() {
    let mut b = list(2);
    as_caller("agent-a.testnet", REPORT_DEPOSIT);
    b.report(acc(BAD), "DRAINER".into(), "trust me".into());
}

#[test]
#[should_panic(expected = "E_BAD_REASON")]
fn a_reason_is_a_code_not_a_sentence() {
    let mut b = list(2);
    as_caller("agent-a.testnet", REPORT_DEPOSIT);
    b.report(acc(BAD), "they stole from me".into(), TX.into());
}

#[test]
#[should_panic(expected = "E_TOO_MANY_REPORTS")]
fn an_entry_holds_a_bounded_number_of_reports() {
    let mut b = list(50);
    for i in 0..=MAX_REPORTS {
        report(&mut b, &format!("agent-{i}.testnet"), BAD);
    }
}

#[test]
#[should_panic(expected = "E_NOT_OWNER")]
fn only_the_owner_confirms() {
    let mut b = list(2);
    report(&mut b, "agent-a.testnet", BAD);
    as_caller("agent-a.testnet", NearToken::from_yoctonear(0));
    b.confirm(acc(BAD));
}

#[test]
#[should_panic(expected = "E_NOT_OWNER")]
fn only_the_owner_replaces_the_code() {
    let b = list(2);
    as_caller("agent-a.testnet", NearToken::from_yoctonear(0));
    b.update_contract();
}

#[test]
#[should_panic(expected = "E_TOO_MANY_ACCOUNTS")]
fn one_read_is_bounded() {
    let b = list(2);
    let many = (0..=MAX_QUERY)
        .map(|i| acc(&format!("a{i}.testnet")))
        .collect();
    b.get_flags(many);
}

#[test]
fn reasons_and_hashes_are_checked_by_shape() {
    assert!(valid_reason("PROMPT_INJECTION_PAYEE"));
    assert!(!valid_reason("drainer"));
    assert!(!valid_reason("D"));
    assert!(valid_tx_hash(TX));
    assert!(!valid_tx_hash(
        "0x7J1F9jWcrvXRnPc72yn1Nq2uoSZ6Po3xd3EzvAkBVo5"
    ));
}
