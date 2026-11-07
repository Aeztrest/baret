// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {PaymentGuard} from "../src/PaymentGuard.sol";
import {PaymentGuardFactory} from "../src/PaymentGuardFactory.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract PaymentGuardFactoryTest is Test {
    PaymentGuardFactory factory;
    MockERC20 usdc;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        factory = new PaymentGuardFactory();
        usdc = new MockERC20();
    }

    function test_callerOwnsTheVaultItOpens() public {
        vm.expectEmit(true, true, false, false);
        emit PaymentGuardFactory.VaultCreated(alice, address(usdc), address(0));
        vm.prank(alice);
        PaymentGuard vault = PaymentGuard(factory.createVault(address(usdc)));

        assertEq(vault.owner(), alice);
        assertEq(address(vault.token()), address(usdc));
        assertEq(factory.latestVault(alice), address(vault));
        assertTrue(factory.isVault(address(vault)));
        assertFalse(factory.isVault(address(usdc)));

        // The owner runs it; the factory and other accounts cannot.
        vm.prank(alice);
        vault.setAgentSigner(bob);
        vm.prank(bob);
        vm.expectRevert(PaymentGuard.NotOwner.selector);
        vault.setAgentSigner(bob);
        vm.prank(address(factory));
        vm.expectRevert(PaymentGuard.NotOwner.selector);
        vault.setAgentSigner(bob);
    }

    function test_keepsEachOwnersVaultsApart() public {
        vm.startPrank(alice);
        address first = factory.createVault(address(usdc));
        address second = factory.createVault(address(usdc));
        vm.stopPrank();
        vm.prank(bob);
        address bobs = factory.createVault(address(usdc));

        address[] memory mine = factory.vaultsOf(alice);
        assertEq(mine.length, 2);
        assertEq(mine[0], first);
        assertEq(factory.latestVault(alice), second);
        assertEq(factory.latestVault(bob), bobs);
        assertEq(factory.latestVault(makeAddr("nobody")), address(0));
    }

    function test_rejectsAZeroToken() public {
        vm.expectRevert(PaymentGuardFactory.ZeroAddress.selector);
        factory.createVault(address(0));
    }
}
