import { getPublicBaseClient, getBaseWalletClient } from "../utils/baseClient"
import { Hex, PrivateKeyAccount, formatEther, parseGwei } from "viem"
import { makeLogger } from "../utils/logger"
import { random, randomFloat, sleep } from "../utils/common"
import { binanceConfig, generalConfig, odosConfig, openoceanConfig, swapConfig } from "../config"
import { approve } from "../utils/approve"
import { tokens } from "../data/base-tokens"
import { getTokenBalance } from "../utils/tokenBalance"
import { privateKeyToAccount } from "viem/accounts"
import { refill } from "../utils/refill"
import axios from "axios"
import { waitGas } from "../utils/getCurrentGas"

export class Openocean {
    privateKey: Hex
    logger: any
    openoceanContract: Hex = '0x6352a56caadc4f1e25cd6c75970fa768a3304e64'
    randomNetwork: any
    baseClient: any
    baseWallet: any
    walletAddress: Hex
    account: PrivateKeyAccount

    constructor(privateKey:Hex) {
        this.privateKey = privateKey
        this.logger = makeLogger("Openocean")
        this.baseClient = getPublicBaseClient()
        this.baseWallet = getBaseWalletClient(privateKey)
        this.account = privateKeyToAccount(privateKey)
        this.walletAddress = this.baseWallet.account.address
    }

    async getTransactionData(fromToken: Hex, toToken: Hex, amount: bigint, slippage: number) {
        let txData:any
        let agent:any

        let params: any = {
            inTokenAddress: fromToken,
            outTokenAddress: toToken,
            amount: formatEther(amount),
            gasPrice: (randomFloat(0.005, 0.006)).toString(),
            slippage: 1,
            account: this.walletAddress
        }

        if (openoceanConfig.useReferral) {
            params.referrer = '0x2300f68064BfaafA381cd36f2695CDfEAAc09231'
            params.referrerFee = 1
        }
        
        await axios.get('https://open-api.openocean.finance/v3/8453/swap_quote', {
            params: params
        }).then(response => {
            txData = response.data.data
        }).catch(e => {
            this.logger.info(`${this.walletAddress} | Openocean bad request`)
        })

        return txData
    }

    async swapEthToToken(toToken: string = 'USDC', amount: bigint) {
        await waitGas()
        
        this.logger.info(`${this.walletAddress} | Swap ${formatEther(amount)} ETH -> ${toToken}`)
        let successSwap: boolean = false
        let retryCount = 1
        
        while (!successSwap) {
            try {
                const transactionData = await this.getTransactionData(tokens['ETH_zero'], tokens[toToken], amount, 1)
                transactionData.value = parseInt(transactionData.value)
                transactionData.gasPrice = parseGwei((randomFloat(0.0005, 0.0006)).toString())
                
                const txHash = await this.baseWallet.sendTransaction(transactionData)
                
                successSwap = true
                this.logger.info(`${this.walletAddress} | Success swap ${formatEther(amount)} ETH -> ${toToken}: https://basescan.org/tx/${txHash}`)
            } catch (e) {
                this.logger.info(`${this.walletAddress} | Error: ${e}`)
                if (retryCount <= 3) {
                    if (retryCount == 1) {
                        if ((e.shortMessage.includes('insufficient funds') || e.shortMessage.includes('exceeds the balance')) && binanceConfig.useRefill) {
                            await refill(this.privateKey)
                        }
                    }

                    this.logger.info(`${this.walletAddress} | Wait 30 sec and retry swap ${retryCount}/3`)
                    retryCount++
                    await sleep(30 * 1000)
                } else {
                    successSwap = true
                    this.logger.info(`${this.walletAddress} | Swap unsuccessful, skip`)
                }
            }
        }
    }

    async swapTokenToEth(fromToken: string = 'USDC') {
        await waitGas()
        
        let amount = await getTokenBalance(this.baseClient, tokens[fromToken], this.walletAddress)
        let successSwap: boolean = false
        let retryCount = 1

        this.logger.info(`${this.walletAddress} | Swap ${formatEther(amount)} ${fromToken} -> ETH`)

        while (!successSwap) {
            try {
                const transactionData = await this.getTransactionData(tokens[fromToken], tokens['ETH_zero'], amount, 1)
                transactionData.gasPrice = parseGwei((randomFloat(0.0005, 0.0006)).toString())

                await approve(this.baseWallet, this.baseClient, tokens[fromToken], this.openoceanContract, amount, this.logger)

                const sleepTime = random(generalConfig.sleepFrom, generalConfig.sleepTo)
                this.logger.info(`${this.walletAddress} | Waiting ${sleepTime} sec after approve before swap...`)
                await sleep(sleepTime * 1000)

                const txHash = await this.baseWallet.sendTransaction(transactionData)

                successSwap = true
                this.logger.info(`${this.walletAddress} | Success swap ${fromToken} -> ETH: https://basescan.org/tx/${txHash}`)
            } catch (e) {
                this.logger.info(`${this.walletAddress} | Error: ${e}`)
                if (retryCount <= 3) {
                    if (retryCount == 1) {
                        if ((e.shortMessage.includes('insufficient funds') || e.shortMessage.includes('exceeds the balance')) && binanceConfig.useRefill) {
                            await refill(this.privateKey)
                        }
                    }
                    this.logger.info(`${this.walletAddress} | Wait 30 sec and retry swap ${retryCount}/3`)
                    retryCount++
                    await sleep(30 * 1000)
                } else {
                    successSwap = true
                    this.logger.info(`${this.walletAddress} | Swap unsuccessful, skip`)
                }
            }
        }
    }

    async roundSwap() {
        const randomPercent: number = random(swapConfig.swapEthPercentFrom, swapConfig.swapEthPercentTo) / 100
        const ethBalance: bigint = await this.baseClient.getBalance({ address: this.walletAddress })
        const randomChooice: number = random(1, 2)
        const randomStable = randomChooice > 1 ? 'USDC' : 'DAI'
        let amount: bigint = BigInt(Math.round(Number(ethBalance) * randomPercent))
        const sleepTimeTo = random(generalConfig.sleepFrom, generalConfig.sleepTo)

        await this.swapEthToToken(randomStable, amount)

        this.logger.info(`${this.walletAddress} | Waiting ${sleepTimeTo} sec until next swap...`)
        await sleep(sleepTimeTo * 1000)

        await this.swapTokenToEth(randomStable)
    }
}