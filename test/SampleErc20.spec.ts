import {expect} from 'chai'
import {ethers} from 'hardhat'

describe('Sample ERC-20 contract', async () => {
  let deployedErc20: any

  beforeEach(async () => {
    const sampleErc20 = await ethers.getContractFactory('SampleERC20')
    const [owner] = await ethers.getSigners()
    deployedErc20 = await sampleErc20.deploy('RewardToken', 'RTC', 1000, owner.address)
    await deployedErc20.deployed()
  })

  describe('Deployment', () => {
    it('deploys a mock erc20', async () => {
      const tokenSymbol = await deployedErc20.symbol()
      expect(tokenSymbol).to.equal('RTC')
    })

    it('deploys with 1000 reward', async () => {
      const totalSupply = await deployedErc20.totalSupply()
      expect(totalSupply).to.equal(1000)
    })
  })
})
