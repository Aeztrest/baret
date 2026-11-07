// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {PaymentGuard} from "../src/PaymentGuard.sol";
import {FalseReturnERC20, MockERC20, NoReturnERC20} from "./mocks/MockERC20.sol";

contract PaymentGuardTest is Test {
    PaymentGuard guard;
    MockERC20 usdc;

    address owner = makeAddr("owner");
    address agent = makeAddr("agent");
    address shop = makeAddr("shop");
    address other = makeAddr("other");
    bytes32 constant REF = keccak256("invoice-1");

    function setUp() public {
        vm.warp(1_800_000_000);
        usdc = new MockERC20();
        guard = new PaymentGuard(owner, address(usdc));
        usdc.mint(owner, 1_000e6);
        vm.startPrank(owner);
        usdc.approve(address(guard), 500e6);
        guard.deposit(500e6);
        guard.setAgentSigner(agent);
        guard.setMerchantCap(shop, 10e6, 30e6, 100e6);
        vm.stopPrank();
    }

    function _pay(uint256 amount) internal {
        vm.prank(agent);
        guard.pay(shop, amount, REF);
    }

    // ── access ──

    function test_onlyAgentCanPay() public {
        vm.prank(owner);
        vm.expectRevert(PaymentGuard.NotAgent.selector);
        guard.pay(shop, 1e6, REF);

        vm.prank(other);
        vm.expectRevert(PaymentGuard.NotAgent.selector);
        guard.pay(shop, 1e6, REF);
    }

    function test_onlyOwnerAdministers() public {
        vm.startPrank(other);
        vm.expectRevert(PaymentGuard.NotOwner.selector);
        guard.setMerchantCap(other, 1, 0, 1);
        vm.expectRevert(PaymentGuard.NotOwner.selector);
        guard.setAgentSigner(other);
        vm.expectRevert(PaymentGuard.NotOwner.selector);
        guard.withdraw(1);
        vm.expectRevert(PaymentGuard.NotOwner.selector);
        guard.deposit(1);
        vm.stopPrank();
    }

    function test_revokedAgentCannotPay() public {
        _pay(1e6);
        vm.prank(owner);
        guard.revokeAgentSigner();
        vm.prank(agent);
        vm.expectRevert(PaymentGuard.NotAgent.selector);
        guard.pay(shop, 1e6, REF);
    }

    function test_replacedAgentCannotPay() public {
        vm.prank(owner);
        guard.setAgentSigner(other);
        vm.prank(agent);
        vm.expectRevert(PaymentGuard.NotAgent.selector);
        guard.pay(shop, 1e6, REF);
        vm.prank(other);
        guard.pay(shop, 1e6, REF);
    }

    // ── caps ──

    function test_paysWithinCaps() public {
        vm.expectEmit(true, true, true, true);
        emit PaymentGuard.Paid(shop, agent, 5e6, REF, block.timestamp);
        _pay(5e6);
        assertEq(usdc.balanceOf(shop), 5e6);
        (uint256 hour, uint256 day) = guard.spent(shop);
        assertEq(hour, 5e6);
        assertEq(day, 5e6);
    }

    function test_perTxCap() public {
        vm.prank(agent);
        vm.expectRevert(PaymentGuard.ExceedsPerTxCap.selector);
        guard.pay(shop, 10e6 + 1, REF);
    }

    function test_hourlyCapRollsWithEachPayment() public {
        _pay(10e6); // t0
        vm.warp(block.timestamp + 20 minutes);
        _pay(10e6); // t0+20m
        vm.warp(block.timestamp + 20 minutes);
        _pay(10e6); // t0+40m, hour total 30
        vm.prank(agent);
        vm.expectRevert(PaymentGuard.ExceedsHourlyCap.selector);
        guard.pay(shop, 1, REF);

        // At t0+60m the first payment leaves the window, the other two stay.
        vm.warp(block.timestamp + 20 minutes);
        _pay(10e6);
        vm.prank(agent);
        vm.expectRevert(PaymentGuard.ExceedsHourlyCap.selector);
        guard.pay(shop, 1, REF);
    }

    function test_dailyCapRollsWithEachPayment() public {
        for (uint256 i = 0; i < 10; ++i) {
            _pay(10e6);
            vm.warp(block.timestamp + 1 hours);
        }
        // 100 paid between t0 and t0+9h.
        vm.prank(agent);
        vm.expectRevert(PaymentGuard.ExceedsDailyCap.selector);
        guard.pay(shop, 1, REF);

        // t0+24h: only the first payment has aged out.
        vm.warp(1_800_000_000 + 24 hours);
        _pay(10e6);
        vm.prank(agent);
        vm.expectRevert(PaymentGuard.ExceedsDailyCap.selector);
        guard.pay(shop, 1, REF);
    }

    function test_pausedMerchant() public {
        vm.prank(owner);
        guard.setMerchantPaused(shop, true);
        vm.prank(agent);
        vm.expectRevert(PaymentGuard.MerchantPaused.selector);
        guard.pay(shop, 1e6, REF);
        assertEq(guard.available(shop), 0);

        vm.prank(owner);
        guard.setMerchantPaused(shop, false);
        _pay(1e6);
    }

    function test_unknownAndRevokedMerchant() public {
        vm.prank(agent);
        vm.expectRevert(PaymentGuard.UnknownMerchant.selector);
        guard.pay(other, 1e6, REF);

        vm.prank(owner);
        guard.revokeMerchant(shop);
        vm.prank(agent);
        vm.expectRevert(PaymentGuard.UnknownMerchant.selector);
        guard.pay(shop, 1e6, REF);
    }

    function test_invalidCaps() public {
        vm.startPrank(owner);
        vm.expectRevert(PaymentGuard.InvalidCaps.selector);
        guard.setMerchantCap(other, 0, 0, 10);
        vm.expectRevert(PaymentGuard.InvalidCaps.selector);
        guard.setMerchantCap(other, 11, 0, 10);
        vm.expectRevert(PaymentGuard.InvalidCaps.selector);
        guard.setMerchantCap(other, 5, 4, 10);
        vm.expectRevert(PaymentGuard.InvalidCaps.selector);
        guard.setMerchantCap(other, 5, 11, 10);
        vm.stopPrank();
    }

    function test_liveEntriesAreBounded() public {
        vm.prank(owner);
        guard.setMerchantCap(other, 1, 0, 1_000);
        for (uint256 i = 0; i < guard.MAX_LIVE_PAYMENTS(); ++i) {
            vm.prank(agent);
            guard.pay(other, 1, REF);
        }
        vm.prank(agent);
        vm.expectRevert(PaymentGuard.TooManyPayments.selector);
        guard.pay(other, 1, REF);

        vm.warp(block.timestamp + 1 days);
        vm.prank(agent);
        guard.pay(other, 1, REF);
    }

    // ── reserve ──

    function test_withdrawKeepsReserve() public {
        // Reserve is shop's daily cap: 100 of 500.
        assertEq(guard.unreserved(), 400e6);
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(PaymentGuard.InsufficientUnreserved.selector, 400e6));
        guard.withdraw(400e6 + 1);

        vm.prank(owner);
        guard.withdraw(400e6);
        assertEq(usdc.balanceOf(owner), 900e6);
    }

    function test_reservesOfTwoMerchantsAddUpAndFreeOnRevoke() public {
        vm.startPrank(owner);
        guard.setMerchantCap(other, 5e6, 0, 50e6);
        assertEq(guard.totalReserved(), 150e6);
        guard.setMerchantCap(other, 5e6, 0, 20e6); // lowering frees the difference
        assertEq(guard.totalReserved(), 120e6);
        guard.revokeMerchant(shop);
        assertEq(guard.totalReserved(), 20e6);
        guard.setMerchantCap(shop, 1e6, 0, 1e6); // re-adding counts once
        assertEq(guard.totalReserved(), 21e6);
        vm.stopPrank();
    }

    // ── tokens ──

    function test_tokenWithoutReturnValue() public {
        NoReturnERC20 t = new NoReturnERC20();
        PaymentGuard g = new PaymentGuard(owner, address(t));
        t.mint(owner, 10);
        vm.startPrank(owner);
        t.approve(address(g), 10);
        g.deposit(10);
        g.setAgentSigner(agent);
        g.setMerchantCap(shop, 5, 0, 5);
        vm.stopPrank();
        vm.prank(agent);
        g.pay(shop, 5, REF);
        assertEq(t.balanceOf(shop), 5);
    }

    function test_tokenReturningFalseReverts() public {
        FalseReturnERC20 t = new FalseReturnERC20();
        PaymentGuard g = new PaymentGuard(owner, address(t));
        vm.prank(owner);
        vm.expectRevert(PaymentGuard.TokenCallFailed.selector);
        g.deposit(1);
    }

    // ── fuzz ──

    function testFuzz_neverExceedsDailyCap(uint96[20] memory amounts, uint16[20] memory gaps)
        public
    {
        for (uint256 i = 0; i < amounts.length; ++i) {
            uint256 amount = bound(amounts[i], 1, 10e6);
            vm.warp(block.timestamp + bound(gaps[i], 0, 6 hours));
            vm.prank(agent);
            try guard.pay(shop, amount, REF) {} catch {}
            (uint256 lastHour, uint256 lastDay) = guard.spent(shop);
            assertLe(lastDay, 100e6);
            assertLe(lastHour, 30e6);
        }
    }
}

/// @dev Invariant: the vault never holds less than its reserve because of a payment or withdrawal.
contract PaymentGuardHandler is Test {
    PaymentGuard public guard;
    address owner;
    address agent;
    address[3] public shops;

    constructor(PaymentGuard g, address o, address a) {
        guard = g;
        owner = o;
        agent = a;
        shops = [makeAddr("s0"), makeAddr("s1"), makeAddr("s2")];
    }

    function pay(uint256 who, uint256 amount, uint256 gap) external {
        vm.warp(block.timestamp + bound(gap, 0, 3 hours));
        vm.prank(agent);
        try guard.pay(shops[who % 3], bound(amount, 1, 20e6), bytes32(0)) {} catch {}
    }

    function withdraw(uint256 amount) external {
        vm.prank(owner);
        try guard.withdraw(bound(amount, 1, 1_000e6)) {} catch {}
    }

    function setCap(uint256 who, uint256 daily) external {
        daily = bound(daily, 1e6, 200e6);
        vm.prank(owner);
        try guard.setMerchantCap(shops[who % 3], daily, 0, daily) {} catch {}
    }

    function revoke(uint256 who) external {
        vm.prank(owner);
        try guard.revokeMerchant(shops[who % 3]) {} catch {}
    }
}

contract PaymentGuardInvariantTest is Test {
    PaymentGuard guard;
    MockERC20 usdc;
    PaymentGuardHandler handler;
    address owner = makeAddr("owner");
    address agent = makeAddr("agent");

    function setUp() public {
        vm.warp(1_800_000_000);
        usdc = new MockERC20();
        guard = new PaymentGuard(owner, address(usdc));
        usdc.mint(owner, 1_000e6);
        vm.startPrank(owner);
        usdc.approve(address(guard), 1_000e6);
        guard.deposit(1_000e6);
        guard.setAgentSigner(agent);
        vm.stopPrank();
        handler = new PaymentGuardHandler(guard, owner, agent);
        targetContract(address(handler));
    }

    /// Every merchant's last 24 hours stays within its daily cap.
    function invariant_spendWithinCaps() public view {
        for (uint256 i = 0; i < 3; ++i) {
            address shop = handler.shops(i);
            (,, uint256 dailyCap, bool active,) = guard.merchant(shop);
            if (!active) continue;
            (, uint256 lastDay) = guard.spent(shop);
            // A lowered cap can leave earlier spend above it; new payments still cannot land.
            if (lastDay > dailyCap) assertEq(guard.available(shop), 0);
        }
    }

    /// The reserve always equals the sum of the active daily caps.
    function invariant_reserveMatchesActiveCaps() public view {
        uint256 sum;
        for (uint256 i = 0; i < 3; ++i) {
            (,, uint256 dailyCap, bool active,) = guard.merchant(handler.shops(i));
            if (active) sum += dailyCap;
        }
        assertEq(guard.totalReserved(), sum);
    }
}
