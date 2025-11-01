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

    constructor(string memory initialSeason, address initialRelayer) {
        owner = msg.sender;
        relayer = initialRelayer == address(0) ? msg.sender : initialRelayer;
        season = bytes(initialSeason).length > 0 ? initialSeason : "S1";
    }

    function submit(address player, uint256 score) external onlyRelayer {
        require(score <= 10_000_000, "score too high");
        uint256 current = bestScore[player];
        if (score > current) {
            bestScore[player] = score;
            current = score;
        }
        emit ScoreSubmitted(player, score, current, season);
    }

    function setRelayer(address nextRelayer) external onlyOwner {
        require(nextRelayer != address(0), "invalid relayer");
        relayer = nextRelayer;
    }

    function setSeason(string calldata nextSeason) external onlyOwner {
        season = nextSeason;
    }
}
