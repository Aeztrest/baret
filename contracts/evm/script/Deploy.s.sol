// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {PaymentGuardFactory} from "../src/PaymentGuardFactory.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";

/**
 * Deploys Baret's EVM product contracts to one chain: the PaymentGuardFactory (owners open
 * their own vaults through it) and the ReputationRegistry.
 *
 *   forge script script/Deploy.s.sol --rpc-url monad_testnet --broadcast --private-key <key>
 *
 * Env: BARET_OWNER (registry owner), BARET_REPUTATION_WRITER (the account allowed to write
 * reports: the deployer during development, the oracle forwarder later). The key is passed
 * on the command line, never stored. Record the result in packages/chains/deployments in the
 * same PR (docs/architecture/contracts.md §2). Mainnet: hardware wallet, multisig owner,
 * audit first (docs/operations/security.md).
 */
contract Deploy is Script {
    function run() external {
        address owner = vm.envAddress("BARET_OWNER");
        address writer = vm.envAddress("BARET_REPUTATION_WRITER");

        vm.startBroadcast();
        PaymentGuardFactory factory = new PaymentGuardFactory();
        ReputationRegistry registry = new ReputationRegistry(owner, writer);
        vm.stopBroadcast();

        console.log("chain id", block.chainid);
        console.log("PaymentGuardFactory", address(factory));
        console.log("ReputationRegistry", address(registry));
    }
}
