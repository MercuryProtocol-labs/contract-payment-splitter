const { expect } = require('chai');
const { ethers, waffle } = require('hardhat');
const { deployMockContract } = require('@ethereum-waffle/mock-contract');
const { deployContract } = require('ethereum-waffle');

const ERC20 = require('../artifacts/contracts/WBTCToken.sol/WBTCToken.json');

const { provider } = waffle;
const { utils, BigNumber } = ethers;

describe('PaymentSplitter', function () {
  const amount = utils.parseEther('1');

  context('once deployed', function () {
    let owner, payee1, payee2, payee3, nonpayee1, payer1;

    beforeEach(async function () {
      this.accounts = await ethers.getSigners();
      [owner, payee1, payee2, payee3, nonpayee1, payer1] = this.accounts;

      this.payees = [payee1.address, payee2.address, payee3.address];
      this.shares = [20, 10, 70];

      const ContractFactory = await ethers.getContractFactory('PaymentSplitter');
      this.contract = await ContractFactory.deploy(this.payees, this.shares);

      // this.token = await Token.new("MyToken", "MT", owner, ether("1000"));
    });

    it('has total shares', async function () {
      expect(await this.contract.totalShares()).to.be.equal(100);
    });

    it('has payees', async function () {
      await Promise.all(
        this.payees.map(async (payee, index) => {
          expect(await this.contract.payee(index)).to.equal(payee);

          const released = await this.contract.functions[`released(address)`](payee);
          expect(released[0]).to.be.equal(BigNumber.from('0'));
        }),
      );
    });

    describe('accepts payments', async function () {
      it('Ether', async function () {
        expect(await provider.getBalance(this.contract.address)).to.equal(0);

        await owner.sendTransaction({ to: this.contract.address, value: amount });
        expect(await provider.getBalance(this.contract.address)).to.equal(amount);
      });
    });

    describe('distributes funds to payees', async function () {
      it('Ether', async function () {
        // receive funds
        await owner.sendTransaction({ to: this.contract.address, value: amount });

        const initBalance = await provider.getBalance(this.contract.address);
        expect(initBalance).to.be.equal(amount);

        // distribute to payees

        const initialPayee1Balance = await provider.getBalance(this.payees[0]);
        const initialPayee2Balance = await provider.getBalance(this.payees[1]);
        const initialPayee3Balance = await provider.getBalance(this.payees[2]);

        await this.contract.functions[`release(address)`](this.payees[0]);
        expect(await provider.getBalance(this.payees[0])).to.be.equal(initialPayee1Balance.add(utils.parseEther('0.2')));

        await this.contract.functions[`release(address)`](this.payees[1]);
        expect(await provider.getBalance(this.payees[1])).to.be.equal(initialPayee2Balance.add(utils.parseEther('0.1')));

        await this.contract.functions[`release(address)`](this.payees[2]);
        expect(await provider.getBalance(this.payees[2])).to.be.equal(initialPayee3Balance.add(utils.parseEther('0.7')));

        // end balance should be zero
        expect(await provider.getBalance(this.contract.address)).to.be.equal(utils.parseEther('0'));

        // check correct funds released accounting
        expect((await this.contract.functions['totalReleased()']())[0]).to.be.equal(initBalance);
      });

      it('Ether & distributes twice', async function () {
        // Payment 1 Ether
        await owner.sendTransaction({ to: this.contract.address, value: amount });

        const initialPayee1Balance = await provider.getBalance(this.payees[0]);
        const initialPayee2Balance = await provider.getBalance(this.payees[1]);
        const initialPayee3Balance = await provider.getBalance(this.payees[2]);

        // payee1 release
        await this.contract.functions[`release(address)`](this.payees[0]);
        expect(await provider.getBalance(this.payees[0])).to.be.equal(initialPayee1Balance.add(utils.parseEther('0.2')));
        expect(await provider.getBalance(this.payees[1])).to.be.equal(initialPayee2Balance.add(utils.parseEther('0')));
        expect(await provider.getBalance(this.payees[2])).to.be.equal(initialPayee3Balance.add(utils.parseEther('0')));

        // end balance should be 0.8 Ether
        expect(await provider.getBalance(this.contract.address)).to.be.equal(utils.parseEther('0.8'));

        // Payment 1 Ether again
        await owner.sendTransaction({ to: this.contract.address, value: amount });

        // payee1 & payee2 & payee3 release
        await this.contract.functions[`release(address)`](this.payees[0]);
        await this.contract.functions[`release(address)`](this.payees[1]);
        await this.contract.functions[`release(address)`](this.payees[2]);

        expect(await provider.getBalance(this.payees[0])).to.be.equal(initialPayee1Balance.add(utils.parseEther('0.4')));
        expect(await provider.getBalance(this.payees[1])).to.be.equal(initialPayee2Balance.add(utils.parseEther('0.2')));
        expect(await provider.getBalance(this.payees[2])).to.be.equal(initialPayee3Balance.add(utils.parseEther('1.4')));

        // end balance should be zero
        expect(await provider.getBalance(this.contract.address)).to.be.equal(utils.parseEther('0'));

        // check correct funds released accounting
        expect((await this.contract.functions['totalReleased()']())[0]).to.be.equal(utils.parseEther('2'));
      });
    });

    describe('ERC20', async function () {
      async function setup() {
        const mockERC20 = await deployMockContract(owner, ERC20.abi);

        return { mockERC20 };
      }

      it('Mock Toekn with 8 decimals', async function () {
        const { mockERC20 } = await setup();
        await mockERC20.mock.name.returns('WBTC Token');
        await mockERC20.mock.symbol.returns('WBTC');
        await mockERC20.mock.decimals.returns(8);
        await mockERC20.mock.totalSupply.returns(utils.parseEther('100'));

        expect(await mockERC20.name()).to.be.equal('WBTC Token');
        expect(await mockERC20.symbol()).to.be.equal('WBTC');
        expect(await mockERC20.decimals()).to.be.equal(8);
        expect(await mockERC20.totalSupply()).to.be.equal(utils.parseEther('100'));
      });

      it('ERC20 Token deploy', async function () {
        // deploy
        const token = await deployContract(owner, ERC20, [100]);

        expect(await token.name()).to.be.equal('WBTC Token');
        expect(await token.symbol()).to.be.equal('wBTC');
        expect(await token.totalSupply()).to.be.equal(100);
        expect(await token.decimals()).to.be.equal(8);
      });

      it('ERC20 distributes funds to payees', async function () {
        // deploy
        const token = await deployContract(owner, ERC20, [100]);
        expect(await token.balanceOf(owner.address)).to.be.equal(100);

        expect(await token.balanceOf(this.payees[0])).to.be.equal(0);
        expect(await token.balanceOf(this.payees[1])).to.be.equal(0);
        expect(await token.balanceOf(this.payees[2])).to.be.equal(0);

        // 1. payment wBTC to this.contract
        // 2. payee1 release
        // 2. payee2 release
        // 2. payee3 release

        const initBalance = await token.balanceOf(this.contract.address);
        expect(initBalance).to.be.equal(0);

        await token.mint(this.contract.address, 100);
        expect(await token.balanceOf(this.contract.address)).to.be.equal(100);

        await this.contract.functions[`release(address,address)`](token.address, this.payees[0]);
        await this.contract.functions[`release(address,address)`](token.address, this.payees[1]);
        await this.contract.functions[`release(address,address)`](token.address, this.payees[2]);

        expect(await token.balanceOf(this.payees[0])).to.be.equal(BigNumber.from('20'));
        expect(await token.balanceOf(this.payees[1])).to.be.equal(BigNumber.from('10'));
        expect(await token.balanceOf(this.payees[2])).to.be.equal(BigNumber.from('70'));

        // end balance should be zero
        expect(await token.balanceOf(this.contract.address)).to.be.equal(BigNumber.from('0'));

        // check correct funds released accounting
        expect((await this.contract.functions['totalReleased(address)'](token.address))[0]).to.be.equal(BigNumber.from('100'));
      });
    });
  });
});
