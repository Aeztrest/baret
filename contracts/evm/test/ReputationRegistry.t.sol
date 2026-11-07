// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";

contract ReputationRegistryTest is Test {
    ReputationRegistry reg;
    address owner = makeAddr("owner");
    address forwarder = makeAddr("forwarder");
    address drainer = makeAddr("drainer");
    address other = makeAddr("other");

    function setUp() public {
        reg = new ReputationRegistry(owner, forwarder);
    }

    function test_forwarderWrites() public {
        vm.prank(forwarder);
        reg.reportFlagged(drainer, 4, "DRAINER_KIT");
        (bool flagged, uint8 severity, string memory reason) = reg.isFlagged(drainer);
        assertTrue(flagged);
        assertEq(severity, 4);
        assertEq(reason, "DRAINER_KIT");
    }

    function test_onlyForwarderWrites() public {
        vm.prank(owner);
        vm.expectRevert(ReputationRegistry.NotForwarder.selector);
        reg.reportFlagged(drainer, 4, "X");
        vm.prank(other);
        vm.expectRevert(ReputationRegistry.NotForwarder.selector);
        reg.onReport("", abi.encode(new address[](0), new uint8[](0), new string[](0)));
    }

    function test_onReportBatch() public {
        address[] memory targets = new address[](2);
        targets[0] = drainer;
        targets[1] = other;
        uint8[] memory sev = new uint8[](2);
        sev[0] = 3;
        sev[1] = 1;
        string[] memory reasons = new string[](2);
        reasons[0] = "PHISHING";
        reasons[1] = "SPAM_TOKEN";
        vm.prank(forwarder);
        reg.onReport("", abi.encode(targets, sev, reasons));
        (bool f1, uint8 s1,) = reg.isFlagged(drainer);
        (bool f2, uint8 s2,) = reg.isFlagged(other);
        assertTrue(f1 && f2);
        assertEq(s1, 3);
        assertEq(s2, 1);
    }

    function test_severityZeroInReportClears() public {
        vm.startPrank(forwarder);
        reg.reportFlagged(drainer, 3, "X");
        address[] memory t = new address[](1);
        t[0] = drainer;
        reg.onReport("", abi.encode(t, new uint8[](1), new string[](1)));
        vm.stopPrank();
        (bool flagged,,) = reg.isFlagged(drainer);
        assertFalse(flagged);
    }

    function test_rejectsBadInput() public {
        vm.startPrank(forwarder);
        vm.expectRevert(ReputationRegistry.InvalidSeverity.selector);
        reg.reportFlagged(drainer, 5, "X");
        vm.expectRevert(ReputationRegistry.InvalidSeverity.selector);
        reg.reportFlagged(drainer, 0, "X");
        vm.expectRevert(ReputationRegistry.LengthMismatch.selector);
        reg.onReport("", abi.encode(new address[](1), new uint8[](0), new string[](1)));
        vm.stopPrank();
    }

    function test_ownerClearsAndRotatesForwarder() public {
        vm.prank(forwarder);
        reg.reportFlagged(drainer, 3, "X");
        vm.prank(owner);
        reg.clearFlag(drainer);
        (bool flagged,,) = reg.isFlagged(drainer);
        assertFalse(flagged);

        vm.prank(other);
        vm.expectRevert(ReputationRegistry.NotAuthorized.selector);
        reg.clearFlag(drainer);

        vm.prank(owner);
        reg.setForwarder(other);
        vm.prank(forwarder);
        vm.expectRevert(ReputationRegistry.NotForwarder.selector);
        reg.reportFlagged(drainer, 3, "X");
        vm.prank(other);
        reg.reportFlagged(drainer, 3, "X");
    }

    function test_onlyOwnerAdministers() public {
        vm.startPrank(other);
        vm.expectRevert(ReputationRegistry.NotOwner.selector);
        reg.setForwarder(other);
        vm.expectRevert(ReputationRegistry.NotOwner.selector);
        reg.transferOwnership(other);
        vm.stopPrank();
    }
}
