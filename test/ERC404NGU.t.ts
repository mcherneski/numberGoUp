import { expect } from 'chai'
import { time, loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { ethers, network } from 'hardhat'

describe('NumberGoUp', function () {
    async function deployNGUUniswapV3() {
        const signers = await ethers.getSigners()

        //Deploy Uniswap v3 Factory
        const uniswapV3FactorySource = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json')
        const uniswapV3FactoryContract = await new ethers.ContractFactory(
            uniswapV3FactorySource.abi,
            uniswapV3FactorySource.bytecode,
            signers[0],
        ).deploy()
        await uniswapV3FactoryContract.waitForDeployment()

        // Add the 100bps fee tier.
        await uniswapV3FactoryContract.connect(signers[0]).enableFeeAmount(100, 1)

        // Deploy WETH.
        const wethSource = require('@uniswap/v2-periphery/build/WETH9.json')
        const wethContract = await new ethers.ContractFactory(
            wethSource.interface,
            wethSource.bytecode,
            signers[0],
        ).deploy()
        await wethContract.waitForDeployment()

        const uniswapV3NonfungiblePositionManagerSource = require("@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json")
        const uniswapV3NonfungiblePositionManagerContract =
            await new ethers.ContractFactory(
                uniswapV3NonfungiblePositionManagerSource.abi,
                uniswapV3NonfungiblePositionManagerSource.bytecode,
                signers[0],
            ).deploy(
                await uniswapV3FactoryContract.getAddress(),
                await wethContract.getAddress(),
                // Skip the token descriptor address (we don't really need this for testing).
                ethers.ZeroAddress,
            )
        await uniswapV3NonfungiblePositionManagerContract.waitForDeployment()

        // Deploy Uniswap v3 router.
        const uniswapV3Router = require("@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json")
        const uniswapV3RouterContract = await new ethers.ContractFactory(
            uniswapV3Router.abi,
            uniswapV3Router.bytecode,
            signers[0],
        ).deploy(
            await uniswapV3FactoryContract.getAddress(),
            await wethContract.getAddress(),
        )
        await uniswapV3RouterContract.waitForDeployment()

        const factory = await ethers.getContractFactory("NumberGoUp")

        const name = 'NumberGoUp'
        const symbol = 'NGU'
        const decimals = 18n
        const units = 10n ** decimals
        const maxTotalSupplyERC721 = 100n
        const maxTotalSupplyERC20 = maxTotalSupplyERC721 * units
        const initialOwner = signers[0]
        const initialMintRecipient = signers[0]

        const contract = await factory.deploy(
            name,
            symbol,
            decimals,
            maxTotalSupplyERC721,
            initialOwner.address,
            initialMintRecipient.address,
            await uniswapV3RouterContract.getAddress(),
            await uniswapV3NonfungiblePositionManagerContract.getAddress(),
        )

        await contract.waitForDeployment()
        const contractAddress = await contract.getAddress()

        const randomAddresses = Array.from(
            { length: 10 },
            () => ethers.Wallet.createRandom().address,
        )

        const feeTiers = [100n, 500n, 3000n, 10000n]

        return {
            contract,
            contractAddress,
            signers,
            deployConfig: {
              name,
              symbol,
              decimals,
              units,
              maxTotalSupplyERC721,
              maxTotalSupplyERC20,
              initialOwner,
              initialMintRecipient,
              uniswapV3RouterContract,
              uniswapV3FactoryContract,
              uniswapV3NonfungiblePositionManagerContract,
              wethContract,
            },
            randomAddresses,
            feeTiers,
          }
    }

    async function deployNGU404WithSomeTokensTransferredToRandomAddress() {
        const f = await loadFixture(deployNGUUniswapV3)

        const targetAddress = f.randomAddresses[0]

        await f.contract
        .connect(f.signers[0])
        .transfer(targetAddress, 5n * f.deployConfig.units)

        expect(await f.contract.erc721TotalSupply()).to.equal(5n)

        return {
            ...f,
            targetAddress,
        }
    }
    
    describe('Constructor', function () {
        it('Adds the uniswap v3 NFT position manager to the ERC-721 transfer exempt list', async function () {
            const fixture = await loadFixture(deployNGUUniswapV3)

            const uniswapV3NonFungiblePositionManagerContractAddress = await fixture.deployConfig.uniswapV3NonfungiblePositionManagerContract.getAddress()
            expect(uniswapV3NonFungiblePositionManagerContractAddress).to.not.eq(ethers.ZeroAddress)

            expect(
                await fixture.contract.erc721TransferExempt(await fixture.deployConfig.uniswapV3NonfungiblePositionManagerContract.getAddress(),
            ),
            ).to.equal(true)
        })

        it('Adds the uniswap v3 pool addresses for all free tiers for this token + WETH to the ERC-721 transfer exempt list', async function () {
            const f = await loadFixture(deployNGUUniswapV3)

            //Check all free tiers
            for (const feeTier of f.feeTiers)
                {
                    await f.deployConfig.uniswapV3FactoryContract.createPool(
                        f.contractAddress,
                        await f.deployConfig.wethContract.getAddress(),
                        feeTier
                    )

                    const expectedPairAddress = 
                    await f.deployConfig.uniswapV3FactoryContract.getPool(
                        f.contractAddress,
                        await f.deployConfig.wethContract.getAddress(),
                        feeTier
                    )

                    expect(expectedPairAddress).to.not.eq(ethers.ZeroAddress)

                    expect(
                        await f.contract.erc721TransferExempt(await expectedPairAddress)
                    ).to.equal(true)
                }
        })
    }),
    describe('ERC20TotalSupply', function () {
        it('Returns the correct total supply', async function () {
            const f = await loadFixture(
                deployNGU404WithSomeTokensTransferredToRandomAddress
            )

            expect(await f.contract.erc20TotalSupply()).to.eq(
                100n * f.deployConfig.units,
            )
        })
    }),

    describe('ERC721TotalSupply', function () {
        it('Returns the correct total supply', async function () {
            const f = await loadFixture(
                deployNGU404WithSomeTokensTransferredToRandomAddress
            )

            expect(await f.contract.erc721TotalSupply()).to.eq(5n)
        })
    })
    
    describe('OwnerOf', function() {
        context('Some tokens have been minted', function () {
            it('Reverts if the token ID is below the allowed range', async function () {
                const f = await loadFixture(
                    deployNGU404WithSomeTokensTransferredToRandomAddress
                )

                const minimumValidTokenId = (await f.contract.ID_ENCODING_PREFIX()) + 1n

                expect(await f.contract.ownerOf(minimumValidTokenId)).to.eq(
                    f.targetAddress
                )

                await expect(
                    f.contract.ownerOf(minimumValidTokenId - 1n),
                ).to.be.revertedWithCustomError(f.contract, 'InavalidTokenId')
            })
        })
    })
})