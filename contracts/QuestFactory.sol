// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.15;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import {Erc20Quest} from './Erc20Quest.sol';
import {Erc1155Quest} from './Erc1155Quest.sol';
import {RabbitHoleReceipt} from './RabbitHoleReceipt.sol';
import {OwnableUpgradeable} from '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol';

/// @title QuestFactory
/// @author RabbitHole.gg
/// @dev This contract is used to create quests and mint receipts
contract QuestFactory is Initializable, OwnableUpgradeable, AccessControlUpgradeable {
    error QuestIdUsed();
    error OverMaxAllowedToMint();
    error AddressNotSigned();
    error AddressAlreadyMinted();
    error InvalidHash();
    error OnlyOwnerCanCreate1155Quest();
    error RewardNotAllowed();

    event QuestCreated(address indexed creator, address indexed contractAddress, string contractType);

    bytes32 public constant CREATE_QUEST_ROLE = keccak256('CREATE_QUEST_ROLE');

    struct Quest {
        mapping(address => bool) addressMinted;
        address questAddress;
        uint totalAmount;
        uint numberMinted;
    }

    // storage vars. Insert new vars at the end to keep the storage layout the same.
    address public claimSignerAddress;
    address public protocolFeeRecipient;
    mapping(string => Quest) public quests;
    RabbitHoleReceipt public rabbitholeReceiptContract;
    mapping(address => bool) public rewardAllowlist;

    // always be initialized
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    function initialize(
        address claimSignerAddress_,
        address rabbitholeReceiptContract_,
        address protocolFeeRecipient_
    ) public initializer {
        __Ownable_init();
        __AccessControl_init();
        grantDefaultAdminAndCreateQuestRole();
        claimSignerAddress = claimSignerAddress_;
        rabbitholeReceiptContract = RabbitHoleReceipt(rabbitholeReceiptContract_);
        protocolFeeRecipient = protocolFeeRecipient_;
    }

    /// @dev Create either an erc20 or erc1155 quest, only accounts with the CREATE_QUEST_ROLE can create quests
    /// @param rewardTokenAddress_ The contract address of the reward token
    /// @param endTime_ The end time of the quest
    /// @param startTime_ The start time of the quest
    /// @param totalAmount_ The total amount of rewards the quest will have
    /// @param allowList_ Depricated
    /// @param rewardAmountOrTokenId_ The reward amount for an erc20 quest or the token id for an erc1155 quest
    /// @param contractType_ The type of quest, either erc20 or erc1155
    /// @param questId_ The id of the quest
    /// @param questFee_ The fee for the quest
    /// @return address the quest contract address
    function createQuest(
        address rewardTokenAddress_,
        uint256 endTime_,
        uint256 startTime_,
        uint256 totalAmount_,
        string memory allowList_,
        uint256 rewardAmountOrTokenId_,
        string memory contractType_,
        string memory questId_,
        uint256 questFee_
    ) public onlyRole(CREATE_QUEST_ROLE) returns (address) {
        if (quests[questId_].questAddress != address(0)) revert QuestIdUsed();

        if (keccak256(abi.encodePacked(contractType_)) == keccak256(abi.encodePacked('erc20'))) {
            if (rewardAllowlist[rewardTokenAddress_] == false) revert RewardNotAllowed();

            Erc20Quest newQuest = new Erc20Quest(
                rewardTokenAddress_,
                endTime_,
                startTime_,
                totalAmount_,
                allowList_,
                rewardAmountOrTokenId_,
                questId_,
                address(rabbitholeReceiptContract),
                questFee_,
                protocolFeeRecipient,
                address(this)
            );
            newQuest.transferOwnership(msg.sender);

            emit QuestCreated(msg.sender, address(newQuest), contractType_);
            quests[questId_].questAddress = address(newQuest);
            quests[questId_].totalAmount = totalAmount_;
            return address(newQuest);
        }

        if (keccak256(abi.encodePacked(contractType_)) == keccak256(abi.encodePacked('erc1155'))) {
            if (msg.sender != owner()) revert OnlyOwnerCanCreate1155Quest();

            Erc1155Quest newQuest = new Erc1155Quest(
                rewardTokenAddress_,
                endTime_,
                startTime_,
                totalAmount_,
                allowList_,
                rewardAmountOrTokenId_,
                questId_,
                address(rabbitholeReceiptContract)
            );
            newQuest.transferOwnership(msg.sender);

            emit QuestCreated(msg.sender, address(newQuest), contractType_);
            quests[questId_].questAddress = address(newQuest);
            quests[questId_].totalAmount = totalAmount_;
            return address(newQuest);
        }

        return address(0);
    }

    /// @dev grant the create quest role to an account
    /// @param account_ The account to grant the create quest role to
    function grantCreateQuestRole(address account_) public {
        _grantRole(CREATE_QUEST_ROLE, account_);
    }

    /// @dev revoke the create quest role from an account
    /// @param account_ The account to revoke the create quest role from
    function revokeCreateQuestRole(address account_) public {
        _revokeRole(CREATE_QUEST_ROLE, account_);
    }

    /// @dev grant the default admin role and the create quest role to the owner
    function grantDefaultAdminAndCreateQuestRole() public onlyOwner {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(CREATE_QUEST_ROLE, msg.sender);
    }

    /// @dev set the claim signer address
    /// @param claimSignerAddress_ The address of the claim signer
    function setClaimSignerAddress(address claimSignerAddress_) public onlyOwner {
        claimSignerAddress = claimSignerAddress_;
    }

    /// @dev set the protocol fee recipient
    /// @param protocolFeeRecipient_ The address of the protocol fee recipient
    function setProtocolFeeRecipient(address protocolFeeRecipient_) public onlyOwner {
        protocolFeeRecipient = protocolFeeRecipient_;
    }

    /// @dev set the rabbithole receipt contract
    /// @param rabbitholeReceiptContract_ The address of the rabbithole receipt contract
    function setRabbitHoleReceiptContract(address rabbitholeReceiptContract_) public onlyOwner {
        rabbitholeReceiptContract = RabbitHoleReceipt(rabbitholeReceiptContract_);
    }

    /// @dev set or remave a contract address to be used as a reward
    /// @param rewardAddress_ The contract address to set
    /// @param allowed_ Whether the contract address is allowed or not
    function setRewardAllowlistAddress(address rewardAddress_, bool allowed_) public onlyOwner {
        rewardAllowlist[rewardAddress_] = allowed_;
    }

    /// @dev return the number of minted receipts for a quest
    function getNumberMinted(string memory questId_) external view returns (uint) {
        return quests[questId_].numberMinted;
    }

    /// @dev recover the signer from a hash and signature
    function recoverSigner(bytes32 hash, bytes memory signature) public pure returns (address) {
        bytes32 messageDigest = keccak256(abi.encodePacked('\x19Ethereum Signed Message:\n32', hash));
        return ECDSAUpgradeable.recover(messageDigest, signature);
    }

    /// @dev mint a RabbitHole Receipt. Note: this contract must be set as Minter on the receipt contract
    /// @param questId_ The id of the quest
    /// @param hash_ The hash of the message
    /// @param signature_ The signature of the hash
    function mintReceipt(string memory questId_, bytes32 hash_, bytes memory signature_) public {
        if (quests[questId_].numberMinted + 1 > quests[questId_].totalAmount) revert OverMaxAllowedToMint();
        if (quests[questId_].addressMinted[msg.sender] == true) revert AddressAlreadyMinted();
        if (keccak256(abi.encodePacked(msg.sender, questId_)) != hash_) revert InvalidHash();
        if (recoverSigner(hash_, signature_) != claimSignerAddress) revert AddressNotSigned();

        quests[questId_].addressMinted[msg.sender] = true;
        quests[questId_].numberMinted++;
        rabbitholeReceiptContract.mint(msg.sender, questId_);
    }
}
