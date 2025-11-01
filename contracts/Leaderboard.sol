// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Leaderboard {
    mapping(address => uint256) public bestScore;
    string public season;
    address public relayer;
    address public owner;

    event ScoreSubmitted(address indexed player, uint256 score, uint256 best, string season);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier onlyRelayer() {
        require(msg.sender == relayer, "not relayer");
        _;
    }

    constructor(address initialRelayer, string memory initialSeason) {
        owner = msg.sender;
        relayer = initialRelayer;
        season = initialSeason;
    }

    function submit(address player, uint256 score) external onlyRelayer {
        require(score <= 10_000_000, "score too high");
        uint256 current = bestScore[player];
        if (score > current) {
            current = score;
            bestScore[player] = score;
        }
        emit ScoreSubmitted(player, score, current, season);
    }

    function setRelayer(address newRelayer) external onlyOwner {
        require(newRelayer != address(0), "invalid relayer");
        relayer = newRelayer;
    }

    function setSeason(string calldata newSeason) external onlyOwner {
        season = newSeason;
    }
}
