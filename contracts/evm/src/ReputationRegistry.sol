// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/**
 * @title Baret ReputationRegistry
 * @notice On-chain threat intelligence for the Baret analysis server.
 *
 * Entries are written by the Chainlink CRE reputation-oracle workflow through
 * its forwarder, which calls {onReport}. Only the forwarder can write; the
 * owner can clear a wrong entry and can rotate the forwarder. Anyone can read
 * an entry with {isFlagged}, so a user can check what Baret saw.
 *
 * Severity: 1 low, 2 medium, 3 high, 4 critical. 3 and above is a blocklist
 * entry; below that, a contract shows as reported. Severity 0 clears.
 */
contract ReputationRegistry {
    uint8 public constant MAX_SEVERITY = 4;

    struct Entry {
        uint8 severity;
        uint64 updatedAt;
        string reasonCode;
    }

    address public owner;
    address public forwarder;
    mapping(address target => Entry) private _entries;

    error NotOwner();
    error NotForwarder();
    error NotAuthorized();
    error ZeroAddress();
    error InvalidSeverity();
    error LengthMismatch();

    event ReputationFlagged(
        address indexed target, uint8 severity, string reasonCode, uint256 timestamp
    );
    event ReputationCleared(address indexed target);
    event ForwarderSet(address indexed forwarder);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyForwarder() {
        if (msg.sender != forwarder) revert NotForwarder();
        _;
    }

    constructor(address owner_, address forwarder_) {
        if (owner_ == address(0) || forwarder_ == address(0)) revert ZeroAddress();
        owner = owner_;
        forwarder = forwarder_;
        emit OwnershipTransferred(address(0), owner_);
        emit ForwarderSet(forwarder_);
    }

    /// @notice CRE receiver entry point. `report` is abi.encode(address[], uint8[], string[]).
    function onReport(bytes calldata, bytes calldata report) external onlyForwarder {
        (address[] memory targets, uint8[] memory severities, string[] memory reasons) =
            abi.decode(report, (address[], uint8[], string[]));
        if (targets.length != severities.length || targets.length != reasons.length) {
            revert LengthMismatch();
        }
        for (uint256 i = 0; i < targets.length; ++i) {
            _write(targets[i], severities[i], reasons[i]);
        }
    }

    function reportFlagged(address target, uint8 severity, string calldata reasonCode)
        external
        onlyForwarder
    {
        if (severity == 0) revert InvalidSeverity();
        _write(target, severity, reasonCode);
    }

    function clearFlag(address target) external {
        if (msg.sender != owner && msg.sender != forwarder) revert NotAuthorized();
        _write(target, 0, "");
    }

    function setForwarder(address forwarder_) external onlyOwner {
        if (forwarder_ == address(0)) revert ZeroAddress();
        forwarder = forwarder_;
        emit ForwarderSet(forwarder_);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function isFlagged(address target)
        external
        view
        returns (bool flagged, uint8 severity, string memory reasonCode)
    {
        Entry storage e = _entries[target];
        return (e.severity != 0, e.severity, e.reasonCode);
    }

    function entry(address target) external view returns (Entry memory) {
        return _entries[target];
    }

    function _write(address target, uint8 severity, string memory reasonCode) private {
        if (target == address(0)) revert ZeroAddress();
        if (severity > MAX_SEVERITY) revert InvalidSeverity();
        if (severity == 0) {
            delete _entries[target];
            emit ReputationCleared(target);
            return;
        }
        _entries[target] = Entry(severity, uint64(block.timestamp), reasonCode);
        emit ReputationFlagged(target, severity, reasonCode, block.timestamp);
    }
}
