// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title Lock
 * @dev Time-lock contract for secure fund management
 * - Lock funds until specified unlock time
 * - Only owner can withdraw
 * - Uses safe call pattern for fund transfers
 */
contract Lock {
    uint256 public unlockTime;
    address payable public owner;
    bool private locked;

    event Withdrawal(uint256 indexed amount, uint256 indexed when);
    event UnlockTimeExtended(uint256 newUnlockTime);

    modifier reentrancyGuard() {
        require(!locked, "No reentrancy");
        locked = true;
        _;
        locked = false;
    }

    constructor(uint256 _unlockTime) payable {
        require(
            block.timestamp < _unlockTime,
            "Unlock time should be in the future"
        );
        require(msg.value > 0, "Must send ETH to lock");

        unlockTime = _unlockTime;
        owner = payable(msg.sender);
    }

    /**
     * @dev Extend the unlock time (only owner)
     */
    function extendUnlockTime(uint256 _newUnlockTime) external {
        require(msg.sender == owner, "Only owner can extend");
        require(
            _newUnlockTime > unlockTime,
            "New time must be after current time"
        );
        unlockTime = _newUnlockTime;
        emit UnlockTimeExtended(_newUnlockTime);
    }

    /**
     * @dev Withdraw locked funds (safe pattern)
     */
    function withdraw() external reentrancyGuard {
        require(block.timestamp >= unlockTime, "Unlock time not reached");
        require(msg.sender == owner, "Only owner can withdraw");

        uint256 amount = address(this).balance;
        require(amount > 0, "No funds to withdraw");

        emit Withdrawal(amount, block.timestamp);

        (bool success, ) = owner.call{value: amount}("");
        require(success, "Withdrawal failed");
    }

    /**
     * @dev Get current locked balance
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @dev Get time remaining until unlock
     */
    function getTimeRemaining() external view returns (uint256) {
        if (block.timestamp >= unlockTime) {
            return 0;
        }
        return unlockTime - block.timestamp;
    }

    receive() external payable {}
}
