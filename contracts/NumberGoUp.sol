//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Ownable } from '@openzeppelin/contracts/access/Ownable.sol';
import { Strings } from '@openzeppelin/contracts/utils/Strings.sol';
import { ERC404 } from './ERC404.sol';
import {ERC404UniswapV3Exempt} from './extensions/ERC404UniswapV3Exempt.sol';

contract NumberGoUp is Ownable, ERC404, ERC404UniswapV3Exempt {
    string public  _uriBase = "https://ipfs.io/ipfs/QmXdFr6gUJy4Xj2p2ZiNr9VUX8eFARau3s73YCLRXW69Me/";
    uint256 public constant variants = 5;
    using Strings for uint256;

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
            _mintERC20(initialMintRecipient_, maxTotalSupplyERC20_ * units);
        }

        function tokenURI(uint256 id) public view virtual override returns (string memory){
        
        uint256 v= (uint256(keccak256(abi.encode(id)))%1000);
        uint256 d;
        if(v<60){
            d=1;
        }
        if(v>=60&&v<180){
            d=2;
        }
        if(v>=180&&v<380){
            d=3;
        }
        if(v>=380&&v<610){
            d=4;
        }
        if(v>=610){
            d=5;
        }
        return
            string(
                abi.encodePacked(
                    _uriBase,
                    d.toString(),
                    '.json'
                )
            );
    }

        function setERC721TransferExempt(
            address account_,
            bool value_
        ) external onlyOwner {
            _setERC721TransferExempt(account_, value_);
        }
}