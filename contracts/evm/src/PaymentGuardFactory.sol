// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {PaymentGuard} from "./PaymentGuard.sol";

/**
 * @title Baret PaymentGuardFactory
 * @notice Opens a PaymentGuard vault for whoever calls it, in one transaction.
 *
 * A vault's owner is fixed at deployment, so each account needs its own.
 * The factory deploys it with the caller as owner and remembers the vaults
 * per owner, so a wallet can find them again from the owner's address alone.
 * `isVault` lets anyone, the Baret server included, check that an address is
 * a vault this factory deployed: same audited code, nothing else. It holds
 * no funds and has no owner of its own.
 */
contract PaymentGuardFactory {
    mapping(address owner => address[]) private _vaults;
    mapping(address vault => bool) public isVault;

    event VaultCreated(address indexed owner, address indexed token, address vault);

    error ZeroAddress();

    /// @notice Deploy a vault owned by the caller that pays in `token`.
    function createVault(address token) external returns (address vault) {
        if (token == address(0)) revert ZeroAddress();
        vault = address(new PaymentGuard(msg.sender, token));
        _vaults[msg.sender].push(vault);
        isVault[vault] = true;
        emit VaultCreated(msg.sender, token, vault);
    }

    function vaultsOf(address owner) external view returns (address[] memory) {
        return _vaults[owner];
    }

    /// @notice The owner's most recent vault, or the zero address.
    function latestVault(address owner) external view returns (address) {
        address[] storage list = _vaults[owner];
        return list.length == 0 ? address(0) : list[list.length - 1];
    }
}
