// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @dev The ERC-20 surface the vault needs. Return values are checked loosely
///      (see `_callToken`) so tokens that return nothing still work.
interface IERC20Minimal {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title Baret PaymentGuard
 * @notice A spending-limited vault for agent payments on Monad.
 *
 * The owner funds the vault with one token (USDC) and gives each merchant a
 * cap per payment, a rolling one-hour cap and a rolling 24-hour cap. A single
 * agent signer, typically a key derived from the owner's passkey, may then
 * call {pay} without the owner signing each payment. The caps are enforced
 * here, on-chain: a payment that breaks one reverts.
 *
 * Windows are truly rolling. Every payment is logged per merchant; when a new
 * payment comes in, entries older than the window drop out of the running
 * totals. A merchant can hold at most MAX_LIVE_PAYMENTS payments in its
 * 24-hour window, which bounds the gas of any single {pay}.
 *
 * {withdraw} cannot take the vault below the sum of the daily caps of the
 * merchants that are not revoked: a merchant the owner has granted a daily
 * cap can count on it being funded until the owner revokes or lowers it.
 */
contract PaymentGuard {
    uint64 public constant HOUR = 3600;
    uint64 public constant DAY = 86_400;
    uint256 public constant MAX_LIVE_PAYMENTS = 128;

    /// @dev One payment in a merchant's log, packed into one slot.
    struct Spend {
        uint64 timestamp;
        uint192 amount;
    }

    /// @dev Everything about one merchant in one place (storage locality).
    struct Merchant {
        uint256 perTxCap;
        uint256 hourlyCap;
        uint256 dailyCap;
        uint256 hourlySpent;
        uint256 dailySpent;
        /// First log entry still inside the 24-hour window.
        uint64 dayHead;
        /// First log entry still inside the one-hour window.
        uint64 hourHead;
        /// Next free log index.
        uint64 tail;
        bool active;
        bool paused;
    }

    address public immutable owner;
    IERC20Minimal public immutable token;

    address public agent;
    /// Sum of the daily caps of every merchant that is not revoked.
    uint256 public totalReserved;

    mapping(address merchant => Merchant) private _merchants;
    mapping(address merchant => mapping(uint256 index => Spend)) private _log;

    uint256 private _lock = 1;

    error NotOwner();
    error NotAgent();
    error ZeroAddress();
    error ZeroAmount();
    error InvalidCaps();
    error UnknownMerchant();
    error MerchantPaused();
    error ExceedsPerTxCap();
    error ExceedsHourlyCap();
    error ExceedsDailyCap();
    error TooManyPayments();
    error InsufficientUnreserved(uint256 available);
    error TokenCallFailed();
    error Reentrancy();

    event Deposited(address indexed token, uint256 amount);
    event MerchantCapSet(
        address indexed merchant, uint256 perTxCap, uint256 hourlyCap, uint256 dailyCap
    );
    event MerchantPausedSet(address indexed merchant, bool paused);
    event MerchantRevoked(address indexed merchant);
    event AgentSignerSet(address indexed agent);
    event AgentSignerRevoked(address indexed agent);
    event Paid(
        address indexed merchant,
        address indexed agent,
        uint256 amount,
        bytes32 indexed ref,
        uint256 timestamp
    );
    event Withdrawn(address indexed token, uint256 amount);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        if (_lock != 1) revert Reentrancy();
        _lock = 2;
        _;
        _lock = 1;
    }

    constructor(address owner_, address token_) {
        if (owner_ == address(0) || token_ == address(0)) revert ZeroAddress();
        owner = owner_;
        token = IERC20Minimal(token_);
    }

    // ───────────────────────── Owner ─────────────────────────

    /// @notice Fund the vault. The owner must have approved exactly `amount` first.
    function deposit(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        _callToken(abi.encodeCall(IERC20Minimal.transferFrom, (msg.sender, address(this), amount)));
        emit Deposited(address(token), amount);
    }

    /**
     * @notice Add a merchant or change its caps. Spend already in the windows
     *         keeps counting. A zero hourly cap means no hourly limit; the
     *         per-payment and daily caps must be set.
     */
    function setMerchantCap(address merchant, uint256 perTxCap, uint256 hourlyCap, uint256 dailyCap)
        external
        onlyOwner
    {
        if (merchant == address(0)) revert ZeroAddress();
        if (perTxCap == 0 || dailyCap == 0 || perTxCap > dailyCap) revert InvalidCaps();
        if (hourlyCap != 0 && (hourlyCap < perTxCap || hourlyCap > dailyCap)) revert InvalidCaps();

        Merchant storage m = _merchants[merchant];
        if (m.active) totalReserved -= m.dailyCap;
        totalReserved += dailyCap;

        m.perTxCap = perTxCap;
        m.hourlyCap = hourlyCap;
        m.dailyCap = dailyCap;
        m.active = true;
        emit MerchantCapSet(merchant, perTxCap, hourlyCap, dailyCap);
    }

    /// @notice Stop or resume payments to a merchant without losing its caps or history.
    function setMerchantPaused(address merchant, bool paused) external onlyOwner {
        Merchant storage m = _merchants[merchant];
        if (!m.active) revert UnknownMerchant();
        m.paused = paused;
        emit MerchantPausedSet(merchant, paused);
    }

    /// @notice Remove a merchant. Frees its reserve. Its log is kept for audit.
    function revokeMerchant(address merchant) external onlyOwner {
        Merchant storage m = _merchants[merchant];
        if (!m.active) revert UnknownMerchant();
        totalReserved -= m.dailyCap;
        m.active = false;
        m.paused = false;
        emit MerchantRevoked(merchant);
    }

    /// @notice Set the one key allowed to call {pay}. Replaces any earlier agent.
    function setAgentSigner(address newAgent) external onlyOwner {
        if (newAgent == address(0)) revert ZeroAddress();
        address previous = agent;
        agent = newAgent;
        if (previous != address(0)) emit AgentSignerRevoked(previous);
        emit AgentSignerSet(newAgent);
    }

    /// @notice Cut the agent off immediately.
    function revokeAgentSigner() external onlyOwner {
        address previous = agent;
        if (previous == address(0)) revert NotAgent();
        agent = address(0);
        emit AgentSignerRevoked(previous);
    }

    /// @notice Take funds out, leaving at least the reserve of the active merchants.
    function withdraw(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        uint256 available = unreserved();
        if (amount > available) revert InsufficientUnreserved(available);
        _callToken(abi.encodeCall(IERC20Minimal.transfer, (owner, amount)));
        emit Withdrawn(address(token), amount);
    }

    // ───────────────────────── Agent ─────────────────────────

    /**
     * @notice Pay a merchant within its caps. `ref` is the payment reference
     *         (invoice id or x402 memo hash) so the payment can be matched later.
     */
    function pay(address merchant, uint256 amount, bytes32 ref) external nonReentrant {
        if (msg.sender != agent || msg.sender == address(0)) revert NotAgent();
        if (amount == 0) revert ZeroAmount();
        Merchant storage m = _merchants[merchant];
        if (!m.active) revert UnknownMerchant();
        if (m.paused) revert MerchantPaused();
        if (amount > m.perTxCap) revert ExceedsPerTxCap();

        _prune(merchant, m);
        if (m.hourlyCap != 0 && m.hourlySpent + amount > m.hourlyCap) revert ExceedsHourlyCap();
        if (m.dailySpent + amount > m.dailyCap) revert ExceedsDailyCap();
        if (m.tail - m.dayHead >= MAX_LIVE_PAYMENTS) revert TooManyPayments();

        _log[merchant][m.tail] = Spend(uint64(block.timestamp), uint192(amount));
        m.tail += 1;
        m.hourlySpent += amount;
        m.dailySpent += amount;

        _callToken(abi.encodeCall(IERC20Minimal.transfer, (merchant, amount)));
        emit Paid(merchant, msg.sender, amount, ref, block.timestamp);
    }

    // ───────────────────────── Views ─────────────────────────

    function merchant(address who)
        external
        view
        returns (uint256 perTxCap, uint256 hourlyCap, uint256 dailyCap, bool active, bool paused)
    {
        Merchant storage m = _merchants[who];
        return (m.perTxCap, m.hourlyCap, m.dailyCap, m.active, m.paused);
    }

    /// @notice What the merchant has received in the last hour and the last 24 hours.
    function spent(address who) public view returns (uint256 lastHour, uint256 lastDay) {
        uint256 tail = _merchants[who].tail;
        for (uint256 i = _merchants[who].dayHead; i < tail; ++i) {
            Spend memory s = _log[who][i];
            if (s.timestamp + DAY <= block.timestamp) continue;
            lastDay += s.amount;
            if (s.timestamp + HOUR > block.timestamp) lastHour += s.amount;
        }
    }

    /// @notice The most the agent can pay this merchant right now.
    function available(address who) external view returns (uint256) {
        Merchant storage m = _merchants[who];
        if (!m.active || m.paused) return 0;
        (uint256 lastHour, uint256 lastDay) = spent(who);
        uint256 room = m.dailyCap > lastDay ? m.dailyCap - lastDay : 0;
        if (m.hourlyCap != 0) {
            uint256 hourRoom = m.hourlyCap > lastHour ? m.hourlyCap - lastHour : 0;
            if (hourRoom < room) room = hourRoom;
        }
        if (m.perTxCap < room) room = m.perTxCap;
        uint256 balance = token.balanceOf(address(this));
        return balance < room ? balance : room;
    }

    /// @notice Balance the owner may withdraw.
    function unreserved() public view returns (uint256) {
        uint256 balance = token.balanceOf(address(this));
        return balance > totalReserved ? balance - totalReserved : 0;
    }

    // ───────────────────────── Internals ─────────────────────────

    /// @dev Drops expired entries from the front of both windows.
    function _prune(address who, Merchant storage m) private {
        uint64 tail = m.tail;
        uint64 head = m.hourHead;
        while (head < tail) {
            Spend memory s = _log[who][head];
            if (s.timestamp + HOUR > block.timestamp) break;
            m.hourlySpent -= s.amount;
            ++head;
        }
        m.hourHead = head;

        head = m.dayHead;
        while (head < tail) {
            Spend memory s = _log[who][head];
            if (s.timestamp + DAY > block.timestamp) break;
            m.dailySpent -= s.amount;
            ++head;
        }
        m.dayHead = head;
    }

    /// @dev SafeERC20-style call: success, and either no return data or `true`.
    function _callToken(bytes memory data) private {
        (bool ok, bytes memory ret) = address(token).call(data);
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) revert TokenCallFailed();
        if (ret.length == 0 && address(token).code.length == 0) revert TokenCallFailed();
    }
}
