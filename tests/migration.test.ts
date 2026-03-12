import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import type { Router } from '../typechain-types';

describe('Migration Flow', function () {
  async function deployFullFixture() {
    const [owner, feeRecipient, user] = await ethers.getSigners();

    const Router = await ethers.getContractFactory('Router');
    const router = await Router.deploy(feeRecipient.address);
    await router.waitForDeployment();

    const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
    const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F';

    // Whitelist tokens
    await router.setTokenSupport(USDC, true);
    await router.setTokenSupport(DAI, true);

    return { router, owner, feeRecipient, user, USDC, DAI };
  }

  describe('Router Migration Setup', function () {
    it('should whitelist tokens properly', async function () {
      const { router, USDC, DAI } = await loadFixture(deployFullFixture);
      expect(await router.supportedTokens(USDC)).to.equal(true);
      expect(await router.supportedTokens(DAI)).to.equal(true);
    });

    it('should reject migration with same protocol', async function () {
      const { router, user, USDC } = await loadFixture(deployFullFixture);
      const routerAsUser = router.connect(user) as Router;
      await expect(
        routerAsUser.migrate({
          fromProtocol: 0,
          toProtocol: 0,
          token: USDC,
          amount: ethers.parseUnits('100', 6),
          minReceived: 0,
          extraData: '0x',
        })
      ).to.be.revertedWithCustomError(router, 'SameProtocol');
    });

    it('should reject migration with unsupported token', async function () {
      const { router, user } = await loadFixture(deployFullFixture);
      const randomToken = '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984';
      const routerAsUser = router.connect(user) as Router;
      await expect(
        routerAsUser.migrate({
          fromProtocol: 0,
          toProtocol: 1,
          token: randomToken,
          amount: ethers.parseUnits('100', 18),
          minReceived: 0,
          extraData: '0x',
        })
      ).to.be.revertedWithCustomError(router, 'UnsupportedToken');
    });

    it('should reject migration with zero amount', async function () {
      const { router, user, USDC } = await loadFixture(deployFullFixture);
      const routerAsUser = router.connect(user) as Router;
      await expect(
        routerAsUser.migrate({
          fromProtocol: 0,
          toProtocol: 1,
          token: USDC,
          amount: 0,
          minReceived: 0,
          extraData: '0x',
        })
      ).to.be.revertedWithCustomError(router, 'ZeroAmount');
    });

    it('should reject migration when paused', async function () {
      const { router, owner, user, USDC } = await loadFixture(deployFullFixture);
      const routerAsOwner = router.connect(owner) as Router;
      await routerAsOwner.togglePause();
      const routerAsUser = router.connect(user) as Router;
      await expect(
        routerAsUser.migrate({
          fromProtocol: 0,
          toProtocol: 1,
          token: USDC,
          amount: ethers.parseUnits('100', 6),
          minReceived: 0,
          extraData: '0x',
        })
      ).to.be.revertedWithCustomError(router, 'Paused');
    });

    it('should reject migration when adapter is not set', async function () {
      const { router, user, USDC } = await loadFixture(deployFullFixture);
      const routerAsUser = router.connect(user) as Router;
      // No adapters set for protocol 0 or 1
      await expect(
        routerAsUser.migrate({
          fromProtocol: 0,
          toProtocol: 1,
          token: USDC,
          amount: ethers.parseUnits('100', 6),
          minReceived: 0,
          extraData: '0x',
        })
      ).to.be.revertedWithCustomError(router, 'AdapterNotSet');
    });
  });

  describe('Fee Configuration', function () {
    it('should enforce max fee cap at 50 bps', async function () {
      const { router, owner } = await loadFixture(deployFullFixture);
      const routerAsOwner = router.connect(owner) as Router;
      await expect(
        routerAsOwner.setFee(51)
      ).to.be.revertedWithCustomError(router, 'FeeTooHigh');
    });

    it('should allow setting fee within cap', async function () {
      const { router, owner } = await loadFixture(deployFullFixture);
      const routerAsOwner = router.connect(owner) as Router;
      await routerAsOwner.setFee(25);
      expect(await router.feeBps()).to.equal(25);
    });

    it('should reject fee change from non-owner', async function () {
      const { router, user } = await loadFixture(deployFullFixture);
      const routerAsUser = router.connect(user) as Router;
      await expect(
        routerAsUser.setFee(10)
      ).to.be.revertedWithCustomError(router, 'OnlyOwner');
    });
  });

  describe('View Functions', function () {
    it('should return correct protocol names', async function () {
      const { router } = await loadFixture(deployFullFixture);
      expect(await router.getProtocolName(0)).to.equal('Aave V3');
      expect(await router.getProtocolName(1)).to.equal('Curve');
    });

    it('should return supported token status', async function () {
      const { router, USDC } = await loadFixture(deployFullFixture);
      const randomToken = '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984';
      expect(await router.supportedTokens(USDC)).to.equal(true);
      expect(await router.supportedTokens(randomToken)).to.equal(false);
    });
  });
});
