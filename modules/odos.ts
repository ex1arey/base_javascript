import { getPublicBaseClient, getBaseWalletClient } from "../utils/baseClient"
import { Hex, PrivateKeyAccount, formatEther } from "viem"
import { makeLogger } from "../utils/logger"
import { random, sleep } from "../utils/common"
import { binanceConfig, generalConfig, odosConfig, swapConfig } from "../config"
import { approve } from "../utils/approve"
import { tokens } from "../data/base-tokens"
import { getTokenBalance } from "../utils/tokenBalance"
import { privateKeyToAccount } from "viem/accounts"
import { HttpsProxyAgent } from "https-proxy-agent"
import { refill } from "../utils/refill"
import axios from "axios"
import { waitGas } from "../utils/getCurrentGas"

export class Odos {
    privateKey: Hex
    logger: any
    odosContract: Hex = '0x19ceead7105607cd444f5ad10dd51356436095a1'
    randomNetwork: any
    baseClient: any
    baseWallet: any
    walletAddress: Hex
    account: PrivateKeyAccount
    proxy: string|null = null

    constructor(privateKey:Hex) {
        this.privateKey = privateKey
        this.logger = makeLogger("Odos")
        this.baseClient = getPublicBaseClient()
        this.baseWallet = getBaseWalletClient(privateKey)
        this.account = privateKeyToAccount(privateKey)
        this.walletAddress = this.baseWallet.account.address
    }

    async quote(fromToken: Hex, toToken: Hex, amount: bigint, slippage: number) {
        let pathId:number = 0
        let agent:any
        if (this.proxy) {
            agent = new HttpsProxyAgent(this.proxy)
        }
        
        await axios.post('https://api.odos.xyz/sor/quote/v2', {
            chainId: 8453,
            inputTokens: [
                {
                    tokenAddress: fromToken,
                    amount: `${amount}`
                }
            ],
            outputTokens: [
                {
                    tokenAddress: toToken,
                    proportion: 1
                }
            ],
            userAddr: this.walletAddress,
            referralCode: odosConfig.useReferral ? 2485206569 : 0,
            compact: true,
            slippageLimitPercent: slippage
        }, {
            httpAgent: this.proxy ? agent : null
        }).then(response => {
            pathId = response.data.pathId
        }).catch(e => {
            this.logger.info(`${this.walletAddress} | Odos bad request`)
        })

        return pathId
    }

    async assemble(pathId: any) {
        let data: any
        let agent:any
        if (this.proxy) {
            agent = new HttpsProxyAgent(this.proxy)
        }

        await axios.post('https://api.odos.xyz/sor/assemble', {
            userAddr: this.walletAddress,
            pathId: pathId
        }, {
            httpAgent: this.proxy ? agent : null
        }).then(response => {
            data = response.data.transaction
        }).catch(e => {
            this.logger.info(`${this.walletAddress} | Odos bad request`)
        })

        return data
    }

    async swapEthToToken(toToken: string = 'USDC', amount: bigint) {
        await waitGas()
        
        this.logger.info(`${this.walletAddress} | Swap ${formatEther(amount)} ETH -> ${toToken}`)
        let successSwap: boolean = false
        let retryCount = 1
        
        while (!successSwap) {
            try {
                const quoteData = await this.quote(tokens['ETH_zero'], tokens[toToken], amount, 1)
                const transactionData = await this.assemble(quoteData)
                transactionData.value = parseInt(transactionData.value)
                
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
                const quoteData = await this.quote(tokens[fromToken], tokens['ETH_zero'], amount, 1)
                const transactionData = await this.assemble(quoteData)

                await approve(this.baseWallet, this.baseClient, tokens[fromToken], this.odosContract, amount, this.logger)

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

    async roundSwap(proxy:string|null = null) {
        this.proxy = proxy
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