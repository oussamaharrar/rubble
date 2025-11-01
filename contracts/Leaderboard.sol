// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Leaderboard {
    mapping(address => uint256) public bestScore;
    string public season;
    address public relayer;
    address public owner;

    event ScoreSubmitted(address indexed player, uint256 score, uint256 best, string season);
    event RelayerUpdated(address indexed previousRelayer, address indexed newRelayer);
    event SeasonUpdated(string previousSeason, string newSeason);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotOwner();
    error NotRelayer();
    error InvalidAddress();
    error ScoreTooHigh();

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert NotOwner();
        }
        _;
    }

    modifier onlyRelayer() {
        if (msg.sender != relayer) {
            revert NotRelayer();
        }
        _;
    }

    constructor(string memory initialSeason, address initialRelayer) {
        if (initialRelayer == address(0)) {
            revert InvalidAddress();
        }
        owner = msg.sender;
        season = initialSeason;
        relayer = initialRelayer;
        emit RelayerUpdated(address(0), initialRelayer);
        emit SeasonUpdated("", initialSeason);
        emit OwnershipTransferred(address(0), owner);
    }

    function submit(address player, uint256 score) external onlyRelayer {
        if (score > 10_000_000) {
            revert ScoreTooHigh();
        }
        uint256 updatedBest = bestScore[player];
        if (score > updatedBest) {
            bestScore[player] = score;
            updatedBest = score;
        }
        emit ScoreSubmitted(player, score, updatedBest, season);
    }

    function setRelayer(address newRelayer) external onlyOwner {
        if (newRelayer == address(0)) {
            revert InvalidAddress();
        }
        address previous = relayer;
        relayer = newRelayer;
        emit RelayerUpdated(previous, newRelayer);
    }

    function setSeason(string calldata newSeason) external onlyOwner {
        string memory previous = season;
        season = newSeason;
        emit SeasonUpdated(previous, newSeason);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) {
            revert InvalidAddress();
        }
        address previous = owner;
        owner = newOwner;
        emit OwnershipTransferred(previous, newOwner);
    }
}
