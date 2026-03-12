import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import type { AaveAdapter, CurveAdapter } from '../typechain-types';

describe('AaveAdapter', function () {
  async function deployFixture() {
    const [owner, router, user] = await ethers.getSigners();

    // Deploy a mock Aave pool (simplified — in production use a proper mock)
    // For testing, we use router's address as the pool placeholder
    const AaveAdapter = await ethers.getContractFactory('AaveAdapter');
    const adapter = await AaveAdapter.deploy(owner.address, router.address);
    await adapter.waitForDeployment();

    return { adapter, owner, router, user };
  }

  describe('Deployment', function () {
    it('should set the router correctly', async function () {
      const { adapter, router } = await loadFixture(deployFixture);
      expect(await adapter.router()).to.equal(router.address);
    });

    it('should set the aave pool correctly', async function () {
      const { adapter, owner } = await loadFixture(deployFixture);
      expect(await adapter.aavePool()).to.equal(owner.address);
    });

    it('should revert with zero address for pool', async function () {
      const [_, router] = await ethers.getSigners();
      const AaveAdapter = await ethers.getContractFactory('AaveAdapter');
      await expect(
        AaveAdapter.deploy(ethers.ZeroAddress, router.address)
      ).to.be.revertedWithCustomError(AaveAdapter, 'ZeroAddress');
    });

    it('should revert with zero address for router', async function () {
      const [owner] = await ethers.getSigners();
      const AaveAdapter = await ethers.getContractFactory('AaveAdapter');
      await expect(
        AaveAdapter.deploy(owner.address, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(AaveAdapter, 'ZeroAddress');
    });
  });

  describe('Access Control', function () {
    it('should revert deposit from non-router', async function () {
      const { adapter, user } = await loadFixture(deployFixture);
      const tokenAddr = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
      const adapterAsUser = adapter.connect(user) as AaveAdapter;
      await expect(
        adapterAsUser.deposit(tokenAddr, 1000, user.address)
      ).to.be.revertedWithCustomError(adapter, 'OnlyRouter');
    });

    it('should revert withdraw from non-router', async function () {
      const { adapter, user } = await loadFixture(deployFixture);
      const tokenAddr = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
      const adapterAsUser = adapter.connect(user) as AaveAdapter;
      await expect(
        adapterAsUser.withdraw(tokenAddr, 1000, user.address)
      ).to.be.revertedWithCustomError(adapter, 'OnlyRouter');
    });
  });

  describe('Validation', function () {
    it('should revert deposit with zero amount', async function () {
      const { adapter, router } = await loadFixture(deployFixture);
      const tokenAddr = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
      const adapterAsRouter = adapter.connect(router) as AaveAdapter;
      await expect(
        adapterAsRouter.deposit(tokenAddr, 0, router.address)
      ).to.be.revertedWithCustomError(adapter, 'ZeroAmount');
    });

    it('should revert withdraw with zero amount', async function () {
      const { adapter, router } = await loadFixture(deployFixture);
      const tokenAddr = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
      const adapterAsRouter = adapter.connect(router) as AaveAdapter;
      await expect(
        adapterAsRouter.withdraw(tokenAddr, 0, router.address)
      ).to.be.revertedWithCustomError(adapter, 'ZeroAmount');
    });
  });
});

describe('CurveAdapter', function () {
  async function deployFixture() {
    const [owner, router, user] = await ethers.getSigners();

    const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
    const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

    const CurveAdapter = await ethers.getContractFactory('CurveAdapter');
    const adapter = await CurveAdapter.deploy(
      owner.address, // mock pool
      user.address,   // mock LP token
      router.address,
      [DAI, USDC]
    );
    await adapter.waitForDeployment();

    return { adapter, owner, router, user, DAI, USDC };
  }

  describe('Deployment', function () {
    it('should set the router correctly', async function () {
      const { adapter, router } = await loadFixture(deployFixture);
      expect(await adapter.router()).to.equal(router.address);
    });

    it('should register supported tokens', async function () {
      const { adapter, DAI, USDC } = await loadFixture(deployFixture);
      expect(await adapter.supportedTokens(DAI)).to.equal(true);
      expect(await adapter.supportedTokens(USDC)).to.equal(true);
    });

    it('should set correct coin indices', async function () {
      const { adapter, DAI, USDC } = await loadFixture(deployFixture);
      expect(await adapter.coinIndex(DAI)).to.equal(0);
      expect(await adapter.coinIndex(USDC)).to.equal(1);
    });
  });

  describe('Access Control', function () {
    it('should revert deposit from non-router', async function () {
      const { adapter, user, DAI } = await loadFixture(deployFixture);
      const adapterAsUser = adapter.connect(user) as CurveAdapter;
      await expect(
        adapterAsUser.deposit(DAI, 1000, user.address, 0)
      ).to.be.revertedWithCustomError(adapter, 'OnlyRouter');
    });

    it('should revert withdraw from non-router', async function () {
      const { adapter, user, DAI } = await loadFixture(deployFixture);
      const adapterAsUser = adapter.connect(user) as CurveAdapter;
      await expect(
        adapterAsUser.withdraw(DAI, 1000, user.address, 0)
      ).to.be.revertedWithCustomError(adapter, 'OnlyRouter');
    });
  });

  describe('Validation', function () {
    it('should revert deposit with unsupported token', async function () {
      const { adapter, router } = await loadFixture(deployFixture);
      const randomToken = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
      const adapterAsRouter = adapter.connect(router) as CurveAdapter;
      await expect(
        adapterAsRouter.deposit(randomToken, 1000, router.address, 0)
      ).to.be.revertedWithCustomError(adapter, 'UnsupportedToken');
    });

    it('should revert deposit with zero amount', async function () {
      const { adapter, router, DAI } = await loadFixture(deployFixture);
      const adapterAsRouter = adapter.connect(router) as CurveAdapter;
      await expect(
        adapterAsRouter.deposit(DAI, 0, router.address, 0)
      ).to.be.revertedWithCustomError(adapter, 'ZeroAmount');
    });
  });
});
