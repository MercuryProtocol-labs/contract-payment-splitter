// contracts/GLDToken.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract WBTCToken is ERC20 {
    constructor(uint256 initialSupply) ERC20("WBTC Token", "wBTC") {
        _mint(msg.sender, initialSupply);
    }

    function decimals() public view virtual override returns (uint8) {
        return 8;
    }

    function mint(address account, uint256 amount) public {
        _mint(account, amount);
    }
}
