import {QuestContractType, SampleErc20Type} from './types'
import {expect} from 'chai'
import {ethers, upgrades} from 'hardhat'
import {parseBalanceMap} from '../src/parse-balance-map'

describe('Erc20 Quest', async () => {
    let deployedQuestContract: any
    let deployedSampleErc20Contract: any
    let deployedRabbitholeReceiptContract: any
    let expiryDate: number, startDate: number
    const mockAddress = '0x0000000000000000000000000000000000000000'
    const questId = "asdf"
    const allowList = 'ipfs://someCidToAnArrayOfAddresses'
    const totalRewards = 1000
    const rewardAmount = 10
    const [owner, firstAddress, secondAddress, thirdAddress, fourthAddress] = await ethers.getSigners()
    const questContract = await ethers.getContractFactory('Erc20Quest')
    const sampleERC20Contract = await ethers.getContractFactory('SampleERC20')
    const rabbitholeReceiptContract = await ethers.getContractFactory('RabbitHoleReceipt')

    beforeEach(async () => {
        expiryDate = Math.floor(Date.now() / 1000) + 10000
        startDate = Math.floor(Date.now() / 1000) + 1000
        await deployRabbitholeReceiptContract()
        await deploySampleErc20Contract()
        await deployDistributorContract()
        await transferRewardsToDistributor()
    })

    const deployRabbitholeReceiptContract = async () => {
        deployedRabbitholeReceiptContract = await upgrades.deployProxy(rabbitholeReceiptContract, [
            owner.address,
            owner.address,
            10
        ])
    }

    const deployDistributorContract = async () => {
        deployedQuestContract = await upgrades.deployProxy(questContract, [
            deployedSampleErc20Contract.address,
            expiryDate,
            startDate,
            totalRewards,
            allowList,
            rewardAmount,
            questId,
            deployedRabbitholeReceiptContract.address
        ])
    }

    const deploySampleErc20Contract = async () => {
        deployedSampleErc20Contract = await sampleERC20Contract.deploy('RewardToken', 'RTC', 1000, owner.address)
        await deployedSampleErc20Contract.deployed()
    }

    const transferRewardsToDistributor = async () => {
        const distributorContractAddress = deployedQuestContract.address
        await deployedSampleErc20Contract.functions.transfer(distributorContractAddress, 1000)
    }

    describe('Deployment', () => {
        describe('when start time is in past', () => {
            it('Should revert', async () => {
                expect(
                    upgrades.deployProxy(questContract, [mockAddress, expiryDate, startDate - 1000, totalRewards])
                ).to.be.revertedWithCustomError(questContract, 'StartTimeInPast')
            })
        })

        describe('when end time is in past', () => {
            it('Should revert', async () => {
                expect(
                    upgrades.deployProxy(questContract, [mockAddress, startDate - 1000, startDate, totalRewards])
                ).to.be.revertedWithCustomError(questContract, 'EndTimeInPast')
            })
        })

        describe('setting public variables', () => {
            it('Should set the token address with correct value', async () => {
                const rewardContractAddress = await deployedQuestContract.rewardToken()
                expect(rewardContractAddress).to.equal(deployedSampleErc20Contract.address)
            })

            it('Should set the total reward amount with correct value', async () => {
                const totalAmount = await deployedQuestContract.totalAmount()
                expect(totalAmount).to.equal(totalRewards)
            })

            it('Should set has started with correct value', async () => {
                const hasStarted = await deployedQuestContract.hasStarted()
                expect(hasStarted).to.equal(false)
            })

            it('Should set the end time with correct value', async () => {
                const endTime = await deployedQuestContract.endTime()
                expect(endTime).to.equal(expiryDate)
            })

            it('Should set the start time with correct value', async () => {
                const startTime = await deployedQuestContract.startTime()
                expect(startTime).to.equal(startDate)
            })


            it('Should set the allowList with correct value', async () => {
                const currentAllowList = await deployedQuestContract.allowList()
                expect(currentAllowList).to.equal(allowList)
            })
        })

        it('Deployment should set the correct owner address', async () => {
            expect(await deployedQuestContract.owner()).to.equal(owner.address)
        })
    })

    describe('start()', () => {
        it('should only allow the owner to start', async () => {
            await expect(deployedQuestContract.connect(firstAddress).start()).to.be.revertedWith(
                'Ownable: caller is not the owner'
            )
        })

        it('should set start correctly', async () => {
            expect(await deployedQuestContract.hasStarted()).to.equal(false)
            await deployedQuestContract.connect(owner).start()
            expect(await deployedQuestContract.hasStarted()).to.equal(true)
        })
    })

    describe('pause()', () => {
        it('should only allow the owner to pause', async () => {
            await expect(deployedQuestContract.connect(firstAddress).pause()).to.be.revertedWith(
                'Ownable: caller is not the owner'
            )
        })

        it('should set pause correctly', async () => {
            expect(await deployedQuestContract.hasStarted()).to.equal(false)
            await deployedQuestContract.connect(owner).start()
            expect(await deployedQuestContract.isPaused()).to.equal(false)
            await deployedQuestContract.connect(owner).pause()
            expect(await deployedQuestContract.isPaused()).to.equal(true)
        })
    })

    describe('unPause()', () => {
        it('should only allow the owner to pause', async () => {
            await expect(deployedQuestContract.connect(firstAddress).unPause()).to.be.revertedWith(
                'Ownable: caller is not the owner'
            )
        })

        it('should set unPause correctly', async () => {
            expect(await deployedQuestContract.hasStarted()).to.equal(false)
            expect(await deployedQuestContract.isPaused()).to.equal(false)
            await deployedQuestContract.connect(owner).start()
            expect(await deployedQuestContract.isPaused()).to.equal(false)
            await deployedQuestContract.connect(owner).pause()
            expect(await deployedQuestContract.isPaused()).to.equal(true)
            await deployedQuestContract.connect(owner).unPause()
            expect(await deployedQuestContract.isPaused()).to.equal(false)
        })
    })

    describe('setAllowList()', () => {
        it('should set start correctly', async () => {
            expect(await deployedQuestContract.allowList()).to.equal(allowList)
            await deployedQuestContract
                .connect(owner)
                .setAllowList('ipfs://someOtherCid')
            expect(await deployedQuestContract.allowList()).to.equal(
                'ipfs://someOtherCid'
            )
        })

        it('should only allow the owner to start', async () => {
            await expect(
                deployedQuestContract
                    .connect(firstAddress)
                    .setAllowList('ipfs://someOtherCid')
            ).to.be.revertedWith('Ownable: caller is not the owner')
        })
    })

    describe('claim()', async () => {
        it('should fail if quest has not started yet', async () => {
            expect(await deployedQuestContract.hasStarted()).to.equal(false)
            await expect(deployedQuestContract.claim()).to.be.revertedWithCustomError(
                questContract,
                'NotStarted'
            )
        })

        it('should fail if quest is paused', async () => {
            await deployedQuestContract.start()
            await deployedQuestContract.pause()

            await expect(deployedQuestContract.claim()).to.be.revertedWithCustomError(
                questContract,
                'QuestPaused'
            )
        })

        it('should fail if before start time stamp', async () => {
            await deployedQuestContract.start()
            await expect(deployedQuestContract.claim()).to.be.revertedWithCustomError(
                questContract,
                'ClaimWindowNotStarted'
            )
        })

        it('should fail if the contract is out of rewards', async () => {
            await deployedQuestContract.start()
            await ethers.provider.send('evm_increaseTime', [10000])
            await deployedQuestContract.withdraw()
            await expect(deployedQuestContract.claim()).to.be.revertedWithCustomError(
                questContract,
                'AmountExceedsBalance'
            )
            await ethers.provider.send('evm_increaseTime', [-10000])
        })

        it('should fail if there are no tokens to claim', async () => {
            await deployedQuestContract.start()
            await ethers.provider.send('evm_increaseTime', [1000])

            //todo add in token qcheck of length 0
            await expect(deployedQuestContract.claim()).to.be.revertedWithCustomError(
                questContract,
                'NoTokensToClaim'
            )
            await ethers.provider.send('evm_increaseTime', [-1000])

        })


        it('should only transfer the correct amount of rewards', async () => {
            await deployedRabbitholeReceiptContract.mint(1, questId)
            await deployedQuestContract.start()

            await ethers.provider.send('evm_increaseTime', [1000])

            const startingBalance = await deployedSampleErc20Contract.functions.balanceOf(owner.address)
            expect(startingBalance.toString()).to.equal("0")

            const totalTokens = await deployedRabbitholeReceiptContract.getOwnedTokenIdsOfQuest(questId, owner.address)
            expect(totalTokens.length).to.equal(1)

            expect(await deployedQuestContract.isClaimed(1)).to.equal(false)

            await deployedQuestContract.claim()
            const endingBalance = await deployedSampleErc20Contract.functions.balanceOf(owner.address)
            expect(endingBalance.toString()).to.equal("10")
            await ethers.provider.send('evm_increaseTime', [-1000])
        })

        it('should let you claim mulitiple rewards if you have multiple tokens', async () => {
            await deployedRabbitholeReceiptContract.mint(2, questId)
            await deployedQuestContract.start()

            await ethers.provider.send('evm_increaseTime', [1000])

            const startingBalance = await deployedSampleErc20Contract.functions.balanceOf(owner.address)
            expect(startingBalance.toString()).to.equal("0")

            const totalTokens = await deployedRabbitholeReceiptContract.getOwnedTokenIdsOfQuest(questId, owner.address)
            expect(totalTokens.length).to.equal(2)

            expect(await deployedQuestContract.isClaimed(1)).to.equal(false)

            await deployedQuestContract.claim()
            const endingBalance = await deployedSampleErc20Contract.functions.balanceOf(owner.address)
            expect(endingBalance.toString()).to.equal("20")
            await ethers.provider.send('evm_increaseTime', [-1000])
        })

        it('should let multiple claim if you have already claimed', async () => {
            await deployedRabbitholeReceiptContract.mint(3, questId)
            await deployedRabbitholeReceiptContract.transferFrom(owner.address, firstAddress.address, 2)
            await deployedRabbitholeReceiptContract.transferFrom(owner.address, secondAddress.address, 3)
            await deployedQuestContract.start()

            await ethers.provider.send('evm_increaseTime', [1000])

            const startingBalance = await deployedSampleErc20Contract.functions.balanceOf(owner.address)
            expect(startingBalance.toString()).to.equal("0")

            const totalTokens = await deployedRabbitholeReceiptContract.getOwnedTokenIdsOfQuest(questId, owner.address)
            expect(totalTokens.length).to.equal(1)

            expect(await deployedQuestContract.isClaimed(1)).to.equal(false)

            await deployedQuestContract.claim()
            const endingBalance = await deployedSampleErc20Contract.functions.balanceOf(owner.address)
            expect(endingBalance.toString()).to.equal("10")

            await deployedQuestContract.connect(firstAddress).claim()
            const secondEndingBalance = await deployedSampleErc20Contract.functions.balanceOf(firstAddress.address)
            expect(secondEndingBalance.toString()).to.equal("10")

            await deployedQuestContract.connect(secondAddress).claim()
            const thirdEndingBalance = await deployedSampleErc20Contract.functions.balanceOf(secondAddress.address)
            expect(thirdEndingBalance.toString()).to.equal("10")

            await ethers.provider.send('evm_increaseTime', [-1000])
        })

        it('should not let you claim if you have already claimed', async () => {
            await deployedRabbitholeReceiptContract.mint(1, questId)
            await deployedQuestContract.start()

            await ethers.provider.send('evm_increaseTime', [1000])

            await deployedQuestContract.claim()
            await expect(deployedQuestContract.claim()).to.be.revertedWithCustomError(
                questContract,
                'AlreadyClaimed'
            )
            await ethers.provider.send('evm_increaseTime', [-1000])
        })


    })

    describe('withDraw()', async () => {
        it('should only allow the owner to withdraw', async () => {
            await expect(deployedQuestContract.connect(firstAddress).withdraw()).to.be.revertedWith(
                'Ownable: caller is not the owner'
            )
        })

        it('should revert if trying to withdraw before end date', async () => {
            await expect(deployedQuestContract.connect(owner).withdraw()).to.be.revertedWithCustomError(
                questContract,
                'NoWithdrawDuringClaim'
            )
        })

        it('should transfer all rewards back to owner', async () => {
            const beginningContractBalance = await deployedSampleErc20Contract.functions.balanceOf(
                deployedQuestContract.address
            )
            const beginningOwnerBalance = await deployedSampleErc20Contract.functions.balanceOf(owner.address)
            expect(beginningContractBalance.toString()).to.equal(totalRewards.toString())
            expect(beginningOwnerBalance.toString()).to.equal('0')
            await ethers.provider.send('evm_increaseTime', [10001])
            await deployedQuestContract.connect(owner).withdraw()

            const endContactBalance = await deployedSampleErc20Contract.functions.balanceOf(deployedQuestContract.address)
            expect(endContactBalance.toString()).to.equal('0')
            await ethers.provider.send('evm_increaseTime', [-10001])
        })
    })
})