//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Ownable } from '@openzeppelin/contracts/access/Ownable.sol';
import { Strings } from '@openzeppelin/contracts/utils/Strings.sol';
import { ERC404 } from './ERC404.sol';
import {ERC404UniswapV3Exempt} from './extensions/ERC404UniswapV3Exempt.sol';

contract NumberGoUp is Ownable, ERC404, ERC404UniswapV3Exempt {
    constructor (
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 maxTotalSupplyERC20_,
        address initialOwner_,
        address initialMintRecipient_,
        address uniswapSwapRouter_,
        address uniswapV3NonfungiblePositionManager_
    )
        ERC404(name_, symbol_, decimals_)
        Ownable(initialOwner_)
        ERC404UniswapV3Exempt(
            uniswapSwapRouter_,
            uniswapV3NonfungiblePositionManager_
        )
        {
            _setERC721TransferExempt(initialMintRecipient_, true);
            //Previous implementation had maxTotalSupplyERC721 * units
            _mintERC20(initialMintRecipient_, maxTotalSupplyERC20_);
        }

        function tokenURI(uint256 id_) public pure override returns (string memory) {
            return string.concat("https://tokenMetaDataDomain.com/token/", Strings.toString(id_));
        }

        function setERC721TransferExempt(
            address account_,
            bool value_
        ) external onlyOwner {
            _setERC721TransferExempt(account_, value_);
        }
}