import { getPublicBaseClient, getBaseWalletClient } from "../utils/baseClient"
import { Hex, formatEther, parseGwei } from "viem"
import { makeLogger } from "../utils/logger"
import { random, randomFloat, sleep } from "../utils/common"
import { aaveConfig, binanceConfig, generalConfig } from "../config"
import { erc20Abi } from "../data/abi/erc20"
import { aaveAbi } from "../data/abi/aave"
import { approve } from "../utils/approve"
import { refill } from "../utils/refill"

export class Aave {
    privateKey: Hex
    logger: any
    aaveContract: Hex = '0x18cd499e3d7ed42feba981ac9236a278e4cdc2ee'
    aaveWethContract: Hex = '0xD4a0e0b9149BCee3C920d2E00b5dE09138fd8bb7'
    depositAddress: Hex = '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5'
    randomNetwork: any
    baseClient: any
    baseWallet: any
    walletAddress: Hex

    constructor(privateKey:Hex) {
        this.privateKey = privateKey
        this.logger = makeLogger("Aave")
        this.baseClient = getPublicBaseClient()
        this.baseWallet = getBaseWalletClient(privateKey)
        this.walletAddress = this.baseWallet.account.address
    }

    async getDepositAmount() {
        const amount = await this.baseClient.readContract({
            address: this.aaveWethContract,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [
                this.walletAddress
            ]
        })

        return amount
    }

    async deposit(amount: bigint) {
        this.logger.info(`${this.walletAddress} | Deposit ${formatEther(amount)} ETH`)
        let successDeposit: boolean = false
        let retryCount = 1

        while (!successDeposit) {
            try {
                const txHash = await this.baseWallet.writeContract({
                    address: this.aaveContract,
                    abi: aaveAbi,
                    functionName: 'depositETH',
                    args: [
                        this.depositAddress,
                        this.walletAddress,
                        0
                    ],
                    value: amount,
                    gasPrice: parseGwei((randomFloat(0.005, 0.006)).toString())
                })

                successDeposit = true
                this.logger.info(`${this.walletAddress} | Success deposit ${formatEther(amount)} ETH: https://basescan.org/tx/${txHash}`)
            } catch (e) {
                this.logger.info(`${this.walletAddress} | Error: ${e}`)
                if (retryCount <= 3) {
                    if (retryCount == 1) {
                        if ((e.shortMessage.includes('insufficient funds') || e.shortMessage.includes('exceeds the balance')) && binanceConfig.useRefill) {
                            await refill(this.privateKey)
                        }
                    }

                    this.logger.info(`${this.walletAddress} | Wait 30 sec and retry deposit ${retryCount}/3`)
                    retryCount++
                    await sleep(30 * 1000)
                } else {
                    successDeposit = true
                    this.logger.info(`${this.walletAddress} | Deposit unsuccessful, skip`)
                }
            }
        }
    }

    async withdraw() {
        let amount = await this.getDepositAmount()
        let successWithdraw: boolean = false
        let retryCount = 1
        this.logger.info(`${this.walletAddress} | Withdraw ${formatEther(amount)} ETH`)

        await approve(this.baseWallet, this.baseClient, '0xD4a0e0b9149BCee3C920d2E00b5dE09138fd8bb7', this.aaveContract, amount, this.logger)

        const sleepTime = random(generalConfig.sleepFrom, generalConfig.sleepTo)
        this.logger.info(`${this.walletAddress} | Waiting ${sleepTime} sec after approve before withdraw...`)
        await sleep(sleepTime * 1000)

        while (!successWithdraw) {
            try {
                const txHash = await this.baseWallet.writeContract({
                    address: this.aaveContract,
                    abi: aaveAbi,
                    functionName: 'withdrawETH',
                    args: [
                        this.depositAddress,
                        amount,
                        this.walletAddress,
                    ],
                    value: 0,
                    gasPrice: parseGwei((randomFloat(0.005, 0.006)).toString())
                })

                successWithdraw = true
                this.logger.info(`${this.walletAddress} | Success withdraw ${formatEther(amount)} ETH: https://basescan.org/tx/${txHash}`)
            } catch (e) {
                this.logger.info(`${this.walletAddress} | Error: ${e}`)
                if (retryCount <= 3) {
                    if (retryCount == 1) {
                        if ((e.shortMessage.includes('insufficient funds') || e.shortMessage.includes('exceeds the balance')) && binanceConfig.useRefill) {
                            await refill(this.privateKey)
                        }
                    }
                    
                    this.logger.info(`${this.walletAddress} | Wait 30 sec and retry withdraw ${retryCount}/3`)
                    retryCount++
                    await sleep(30 * 1000)
                } else {
                    successWithdraw = true
                    this.logger.info(`${this.walletAddress} | withdraw unsuccessful, skip`)
                }
            }
        }
    }

    async run() {
        const randomPercent: number = random(aaveConfig.depositEthPercentFrom, aaveConfig.depositEthPercentTo) / 100
        const ethBalance: bigint = await this.baseClient.getBalance({ address: this.walletAddress })
        let amount: bigint = BigInt(Math.round(Number(ethBalance) * randomPercent))
        const sleepTime = random(generalConfig.sleepFrom, generalConfig.sleepTo)

        await this.deposit(amount)
        
        if (aaveConfig.makeWithdraw) {
            this.logger.info(`${this.walletAddress} | Waiting ${sleepTime} sec until withdraw...`)
            await sleep(sleepTime * 1000)
            
            await this.withdraw()
        }
    }
}