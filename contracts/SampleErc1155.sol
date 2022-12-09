// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

contract SampleErc1155 is ERC1155 {
    constructor() public ERC1155("ipfs://cid/{id}.json") {
        _mint(msg.sender, 1, 10, "0x0");
    }
}