import axios from "axios";
import chalk from "chalk";
import { ethers, FetchRequest } from "ethers";
import fs from "fs";
import path from "path";
import UserAgent from 'user-agents';
import { PING_ABI, PONG_ABI, ROUTER_ABI } from "../config/abi";
import { logMessage } from "../utils/logger";
import { getProxyAgent } from "./proxy";
const userAgent = new UserAgent();
const configPath = path.resolve(__dirname, "../../config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));


export class somniaBot {
  private privkey: string;
  private web3: any;
  private explorer: string;
  private RPC: string;
  private swapaddress: string = "0x6AAC14f090A35EeA150705f72D90E4CDC4a49b2C";
  private pingaddress: string = "0x33e7fab0a8a5da1a923180989bd617c9c2d1c493";
  private pongaddress: string = "0x9beaa0016c22b646ac311ab171270b0ecf23098f";
  private pingContract: any;
  private pongContract: any;
  private swapContract: any;
  private wallet: any;
  private proxy: string | null;
  private axiosConfig: any;
  private currentNum: number;
  private total: number;


  constructor(privkey: string, proxy: string | null = null, currentNum: number, total: number) {
    this.RPC = config.RPC_URL;
    this.explorer = config.EXPLORE_URL;
    this.privkey = privkey;
    this.web3 = this.initializeWeb3();
    this.wallet = new ethers.Wallet(this.privkey, this.web3);
    this.pingContract = new ethers.Contract(this.pingaddress, PING_ABI, this.wallet);
    this.pongContract = new ethers.Contract(this.pongaddress, PONG_ABI, this.wallet);
    this.swapContract = new ethers.Contract(this.swapaddress, ROUTER_ABI, this.wallet);
    this.currentNum = currentNum;
    this.total = total
    this.proxy = proxy;
    this.axiosConfig = {
      ...(this.proxy && { httpsAgent: getProxyAgent(this.proxy, this.currentNum, this.total) }),
      timeout: 60000,
      headers: {
        "User-Agent": userAgent.toString(),
        "Content-Type": "application/json",
        "Accept": "application/json",
        origin: "https://testnet.somnia.network",
        referer: "https://testnet.somnia.network"
      }
    };
  }

  private initializeWeb3() {
    if (this.proxy) {
      FetchRequest.registerGetUrl(
        FetchRequest.createGetUrlFunc({
          agent: getProxyAgent(this.proxy, this.currentNum, this.total),
        })
      );
      return new ethers.JsonRpcProvider(this.RPC);
    }
    return new ethers.JsonRpcProvider(this.RPC);
  }

  async makeRequest(method: string, url: string, config: any = {}) {
    try {
      const response = await axios({
        method,
        url,
        ...this.axiosConfig,
        ...config,
        validateStatus: (status) => status < 500,
      });
      return response;
    } catch (error) {
      logMessage(this.currentNum, this.total, `Request failed: ${(error as any).message}`, "error");
    }
  }


  async claimFaucet() {
    logMessage(this.currentNum, this.total, "Trying claiming faucet...", "process");
    const payload = {
      address: this.wallet.address,
    }

    try {
      const response = await this.makeRequest("POST", "https://testnet.somnia.network/api/faucet", { data: payload });
      if (response?.status === 200) {
        logMessage(this.currentNum, this.total, "Claiming faucet successful", "success");
        return response.data;
      }
      if (response?.status === 429) {
        logMessage(this.currentNum, this.total, "Already claimed", "error");
        return;
      }
    } catch (error) {
      logMessage(this.currentNum, this.total, `Claiming faucet failed: ${(error as any).message}`, "error");
    }
  }

  async sendToRandomAddress() {
    logMessage(this.currentNum, this.total, "Trying sending to random address...", "process");
    try {
      const randomAddress = ethers.Wallet.createRandom().address;
      const tx = await this.wallet.sendTransaction({
        to: randomAddress,
        value: ethers.parseEther('0.001'),
      });
      await tx.wait();
      logMessage(this.currentNum, this.total, `Transaction hash : ${tx.hash}`, "success");
      logMessage(this.currentNum, this.total, `BlockHash URL : ${this.explorer}${tx.hash}`, "success");
      console.log(chalk.white("-".repeat(85)));
      return tx.hash;
    } catch (error: any) {
      logMessage(this.currentNum, this.total, `Sending to random address failed: ${error.message}`, "error");
      return
    }
  }

  async approveToken(tokenContract: any, spenderAddress: any, amount: any) {
    logMessage(this.currentNum, this.total, "Trying approval...", "process");
    try {
      const tx = await tokenContract.approve(
        spenderAddress,
        amount
      );
      await tx.wait();
      logMessage(this.currentNum, this.total, `Transaction hash : ${tx.hash}`, "success");
      logMessage(this.currentNum, this.total, `BlockHash URL : ${this.explorer}${tx.hash}`, "success");
      console.log(chalk.white("-".repeat(85)));
      return tx.hash;
    } catch (error: any) {
      logMessage(this.currentNum, this.total, `Approval failed: ${error.message}`, "error");
      return null;
    }
  }

  async mintPing() {
    try {
      const tx = await this.pingContract.mint(this.wallet.address, ethers.parseUnits("1000", 18));
      await tx.wait();
      logMessage(this.currentNum, this.total, `Minting PING successful`, "success");
      logMessage(this.currentNum, this.total, `Transaction hash : ${tx.hash}`, "success");
      logMessage(this.currentNum, this.total, `BlockHash URL : ${this.explorer}${tx.hash}`, "success");
      console.log(chalk.white("-".repeat(85)));
    } catch (error: any) {
      logMessage(this.currentNum, this.total, `Minting PING failed: ${error.message}`, "error");
    }
  }

  async mintPong() {
    try {
      const tx = await this.pongContract.mint(this.wallet.address, ethers.parseUnits("1000", 18));
      await tx.wait();
      logMessage(this.currentNum, this.total, `Minting PONG successful`, "success");
      logMessage(this.currentNum, this.total, `Transaction hash : ${tx.hash}`, "success");
      logMessage(this.currentNum, this.total, `BlockHash URL : ${this.explorer}${tx.hash}`, "success");
      console.log(chalk.white("-".repeat(85)));
    } catch (error: any) {
      logMessage(this.currentNum, this.total, `Minting PONG failed: ${error.message}`, "error");
    }
  }

  async autoSwap() {
    const count = 3;
    for (let i = 0; i < count; i++) {
      const random = Math.random() < 0.5 ? 'PING->PONG' : 'PONG->PING';
      const amount = Math.floor(Math.random() * 100) + 1;
      const pingBalance = await this.pingContract.balanceOf(this.wallet.address);
      if (BigInt(pingBalance) === BigInt(0)) {
        await this.mintPing();
      }
      const pongBalance = await this.pongContract.balanceOf(this.wallet.address);
      if (BigInt(pongBalance) === BigInt(0)) {
        await this.mintPong();
      }

      logMessage(this.currentNum, this.total, `Balance Before Swap : `, "info");
      logMessage(this.currentNum, this.total, `PING Balance: ${ethers.formatUnits(pingBalance, 18)}`, "info");
      logMessage(this.currentNum, this.total, `PONG Balance: ${ethers.formatUnits(pongBalance, 18)}`, "info");
      console.log(chalk.white("-".repeat(85)));
      try {
        const tokenToApprove = random === 'PING->PONG' ? this.pingContract : this.pongContract;
        await this.approveToken(tokenToApprove, this.swapaddress, ethers.parseUnits(amount.toString(), 18));
        logMessage(this.currentNum, this.total, `Approved ${random === 'PING->PONG' ? 'PING' : 'PONG'} token`, "info");
        const swapTx = await this.swapContract.exactInputSingle({
          tokenIn: random === 'PING->PONG' ? this.pingaddress : this.pongaddress,
          tokenOut: random === 'PING->PONG' ? this.pongaddress : this.pingaddress,
          fee: 500,
          recipient: this.wallet.address,
          amountIn: ethers.parseUnits(amount.toString(), 18),
          amountOutMinimum: 0,
          sqrtPriceLimitX96: 0
        },);

        await swapTx.wait();
        logMessage(this.currentNum, this.total, `Swap ${random} successful`, "success");
        logMessage(this.currentNum, this.total, `Amount: ${amount} `, "success");
        logMessage(this.currentNum, this.total, `Transaction hash: ${swapTx.hash} `, "success");
        logMessage(this.currentNum, this.total, `BlockHash URL: ${this.explorer}${swapTx.hash} `, "success");
        console.log(chalk.white("-".repeat(85)));
      } catch (error: any) {
        logMessage(this.currentNum, this.total, `Auto swap failed: ${error.message} `, "error");
      }
    }
  }

}