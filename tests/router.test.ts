import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import type { Router } from '../typechain-types';

describe('Router', function () {
  async function deployFixture() {
    const [owner, user, feeRecipient] = await ethers.getSigners();

    const Router = await ethers.getContractFactory('Router');
    const router = await Router.deploy(feeRecipient.address);
    await router.waitForDeployment();

    return { router, owner, user, feeRecipient };
  }

  describe('Deployment', function () {
    it('should set the owner correctly', async function () {
      const { router, owner } = await loadFixture(deployFixture);
      expect(await router.owner()).to.equal(owner.address);
    });

    it('should set the fee recipient correctly', async function () {
      const { router, feeRecipient } = await loadFixture(deployFixture);
      expect(await router.feeRecipient()).to.equal(feeRecipient.address);
    });

    it('should set default fee to 10 bps', async function () {
      const { router } = await loadFixture(deployFixture);
      expect(await router.feeBps()).to.equal(10);
    });

    it('should not be paused initially', async function () {
      const { router } = await loadFixture(deployFixture);
      expect(await router.paused()).to.equal(false);
    });
  });

  describe('Admin Functions', function () {
    it('should allow owner to set adapter', async function () {
      const { router, user } = await loadFixture(deployFixture);
      await router.setAdapter(0, user.address);
      expect(await router.getAdapter(0)).to.equal(user.address);
    });

    it('should reject non-owner setting adapter', async function () {
      const { router, user } = await loadFixture(deployFixture);
      const routerAsUser = router.connect(user) as Router;
      await expect(
        routerAsUser.setAdapter(0, user.address)
      ).to.be.revertedWithCustomError(router, 'OnlyOwner');
    });

    it('should allow owner to whitelist token', async function () {
      const { router } = await loadFixture(deployFixture);
      const tokenAddr = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
      await router.setTokenSupport(tokenAddr, true);
      expect(await router.supportedTokens(tokenAddr)).to.equal(true);
    });

    it('should allow owner to update fee', async function () {
      const { router } = await loadFixture(deployFixture);
      await router.setFee(25);
      expect(await router.feeBps()).to.equal(25);
    });

    it('should revert if fee exceeds max', async function () {
      const { router } = await loadFixture(deployFixture);
      await expect(router.setFee(100)).to.be.revertedWithCustomError(
        router,
        'FeeTooHigh'
      );
    });

    it('should toggle pause', async function () {
      const { router } = await loadFixture(deployFixture);
      await router.togglePause();
      expect(await router.paused()).to.equal(true);
      await router.togglePause();
      expect(await router.paused()).to.equal(false);
    });

    it('should transfer ownership', async function () {
      const { router, user } = await loadFixture(deployFixture);
      await router.transferOwnership(user.address);
      expect(await router.owner()).to.equal(user.address);
    });
  });

  describe('Deposit Guard Rails', function () {
    it('should revert deposit when paused', async function () {
      const { router } = await loadFixture(deployFixture);
      await router.togglePause();

      const tokenAddr = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
      await expect(
        router.deposit(0, tokenAddr, 1000, '0x')
      ).to.be.revertedWithCustomError(router, 'Paused');
    });

    it('should revert deposit with unsupported token', async function () {
      const { router } = await loadFixture(deployFixture);
      const tokenAddr = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
      await expect(
        router.deposit(0, tokenAddr, 1000, '0x')
      ).to.be.revertedWithCustomError(router, 'UnsupportedToken');
    });

    it('should revert deposit with zero amount', async function () {
      const { router } = await loadFixture(deployFixture);
      const tokenAddr = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
      await router.setTokenSupport(tokenAddr, true);
      await expect(
        router.deposit(0, tokenAddr, 0, '0x')
      ).to.be.revertedWithCustomError(router, 'ZeroAmount');
    });

    it('should revert deposit with no adapter set', async function () {
      const { router } = await loadFixture(deployFixture);
      const tokenAddr = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
      await router.setTokenSupport(tokenAddr, true);
      await expect(
        router.deposit(0, tokenAddr, 1000, '0x')
      ).to.be.revertedWithCustomError(router, 'AdapterNotSet');
    });
  });

  describe('Migration Guard Rails', function () {
    it('should revert migration to same protocol', async function () {
      const { router, user } = await loadFixture(deployFixture);
      const tokenAddr = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
      await router.setTokenSupport(tokenAddr, true);
      await router.setAdapter(0, user.address);

      await expect(
        router.migrate({
          fromProtocol: 0,
          toProtocol: 0,
          token: tokenAddr,
          amount: 1000,
          minReceived: 990,
          extraData: '0x',
        })
      ).to.be.revertedWithCustomError(router, 'SameProtocol');
    });
  });

  describe('View Functions', function () {
    it('should return protocol names', async function () {
      const { router } = await loadFixture(deployFixture);
      expect(await router.getProtocolName(0)).to.equal('Aave V3');
      expect(await router.getProtocolName(1)).to.equal('Curve');
    });

    it('should return supported tokens list', async function () {
      const { router } = await loadFixture(deployFixture);
      const tokenAddr = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
      await router.setTokenSupport(tokenAddr, true);
      const tokens = await router.getSupportedTokens();
      expect(tokens).to.include(tokenAddr);
    });
  });
});
