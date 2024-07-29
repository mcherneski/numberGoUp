import { expect } from 'chai'
import { time, loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { ethers, network } from 'hardhat'
import { MaxUint256 } from 'ethers'

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
        const maxTotalSupplyERC20 = 100000n * units
        const initialOwner = signers[0]
        const initialMintRecipient = signers[0]

        const contract = await factory.deploy(
            name,
            symbol,
            decimals,
            maxTotalSupplyERC20,
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
            for (const feeTier of f.feeTiers) {
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
                const f = await loadFixture(deployNGUUniswapV3)
                expect(await f.contract.erc20TotalSupply()).to.eq(
                    100000n * f.deployConfig.units,
                )
            })
        }),
        describe('ERC721TotalSupply', function () {
            it('Has an ERC721 total supply of 0 on deployment', async function () {
                const f = await loadFixture(deployNGUUniswapV3)

                expect(await f.contract.erc721TotalSupply()).to.eq(0n)
            }),
                it('Has an ERC721 total supply of 5 after transferring 5 tokens to a random address', async function () {
                    const f = await loadFixture(deployNGU404WithSomeTokensTransferredToRandomAddress)

                    expect(await f.contract.erc721TotalSupply()).to.eq(5n)
                    expect(await f.contract.balanceOf(f.randomAddresses[0])).to.eq(5n * f.deployConfig.units)
                    // console.log(`Random Address [0] ERC20 Supply: ${await f.contract.balanceOf(f.randomAddresses[0])}`)
                })
        }),
        describe('approve', async function () {          
            it('Sets the correct approval amount', async function () {
                const f = await loadFixture(deployNGUUniswapV3)
                const spender = f.randomAddresses[0]
                const owner = f.deployConfig.initialOwner
                const amount = 100000n

                await f.contract.approve(spender, amount)
                expect(await f.contract.allowance(owner.address, spender)).to.eq(amount * f.deployConfig.units)
                console.log(`Approved Send Amount: ${await f.contract.allowance(owner.address, spender)}`)
            })
        }),
        describe('transferFrom', async function () {
            it('Transfers the correct amount', async function () {
                // This checks if the UniswapV3 Integration will work. We are trying to use transferFrom with the Uniswapv3 Router

                const f = await loadFixture(deployNGUUniswapV3)
                const owner = f.deployConfig.initialOwner
                console.log('Owner Address: ', owner.address)  
                const recipient = await f.signers[1]
                // const recipient = await f.deployConfig.uniswapV3RouterContract.getAddress()
                console.log(`Uniswap Address: ${recipient.address}`)
                // const runner = await f.deployConfig.uniswapV3RouterContract.runner
                const amount = 100000n
                
                // Double check the work above. Recipient needs to have the approval
                await f.contract.approve(recipient, MaxUint256)
                expect(await f.contract.allowance(owner.address, recipient)).to.eq(MaxUint256)
                
                await f.contract.allowance(owner.address, recipient)
                console.log(`Recipient Approved: ${await f.contract.allowance(owner.address, recipient)}`)
                
                await f.contract.setERC721TransferExempt(recipient.address, true)
                
                const ownerBalanceBefore = await f.contract.balanceOf(owner.address)
                const recipientBalanceBefore = await f.contract.balanceOf(recipient)
                expect(ownerBalanceBefore).to.eq(100000n * f.deployConfig.units)
                expect(recipientBalanceBefore).to.eq(0n)
                
                await f.contract.transferFrom(owner.address, recipient, amount)

                const ownerBalanceAfter = await f.contract.balanceOf(owner.address)
                const recipientBalanceAfter = await f.contract.balanceOf(recipient)
                expect(ownerBalanceAfter).to.eq(0n)
                expect(recipientBalanceAfter).to.eq(100000n * f.deployConfig.units)
                
            })
        })
        
})


