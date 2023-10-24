import { getPublicBaseClient, getBaseWalletClient } from "../utils/baseClient"
import { Hex, formatEther, parseGwei} from "viem"
import { makeLogger } from "../utils/logger"
import { random, randomFloat, sleep } from "../utils/common"
import { tokens } from "../data/base-tokens"
import { approve } from "../utils/approve"
import { getTokenBalance } from "../utils/tokenBalance"
import { binanceConfig, generalConfig, swapConfig } from "../config"
import { woofiRouterAbi } from "../data/abi/woofi_router"
import { refill } from "../utils/refill"
import { waitGas } from "../utils/getCurrentGas"

export class Woofi {
    privateKey: Hex
    logger: any
    woofiRouterContract: Hex = '0x27425e9fb6a9a625e8484cfd9620851d1fa322e5'
    randomNetwork: any
    baseClient: any
    baseWallet: any
    walletAddress: Hex

    constructor(privateKey:Hex) {
        this.privateKey = privateKey
        this.logger = makeLogger("Woofi")
        this.baseClient = getPublicBaseClient()
        this.baseWallet = getBaseWalletClient(privateKey)
        this.walletAddress = this.baseWallet.account.address
    }

    async getMinAmountOut(fromToken: Hex, toToken: Hex, amount: BigInt, slippage: number) {
        const minAmountOut = await this.baseClient.readContract({
            address: this.woofiRouterContract,
            abi: woofiRouterAbi,
            functionName: 'querySwap',
            args: [
                fromToken,
                toToken,
                amount
            ]
        })

        return BigInt(Math.round(Number(minAmountOut) - (Number(minAmountOut) / 100 * slippage)))
    }

    async swapEthToToken(toToken: string = 'USDC', amount: bigint) {
        await waitGas()
        
        this.logger.info(`${this.walletAddress} | Swap ${formatEther(amount)} ETH -> ${toToken}`)
        let successSwap: boolean = false
        let retryCount = 1

        const minAmountOut = await this.getMinAmountOut(tokens['ETH_native'], tokens[toToken], amount, 1)

        while (!successSwap) {
            try {
                const txHash = await this.baseWallet.writeContract({
                    address: this.woofiRouterContract,
                    abi: woofiRouterAbi,
                    functionName: 'swap',
                    args: [
                        tokens['ETH_native'],
                        tokens[toToken],
                        amount,
                        minAmountOut,
                        this.walletAddress,
                        this.walletAddress
                    ],
                    value: amount,
                    gasPrice: parseGwei((randomFloat(0.005, 0.006)).toString())
                })

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
                const minAmountOut = await this.getMinAmountOut(tokens[fromToken], tokens['ETH_native'], amount, 1)

                await approve(this.baseWallet, this.baseClient, tokens[fromToken], this.woofiRouterContract, amount, this.logger)

                const sleepTime = random(generalConfig.sleepFrom, generalConfig.sleepTo)
                this.logger.info(`${this.walletAddress} | Waiting ${sleepTime} sec after approve before swap...`)
                await sleep(sleepTime * 1000)

                const txHash = await this.baseWallet.writeContract({
                    address: this.woofiRouterContract,
                    abi: woofiRouterAbi,
                    functionName: 'swap',
                    args: [
                        tokens[fromToken],
                        tokens['ETH_native'],
                        amount,
                        minAmountOut,
                        this.walletAddress,
                        this.walletAddress
                    ],
                    gasPrice: parseGwei((randomFloat(0.005, 0.006)).toString())
                })

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
        const randomStable = 'USDC'
        let amount: bigint = BigInt(Math.round(Number(ethBalance) * randomPercent))
        const sleepTimeTo = random(generalConfig.sleepFrom, generalConfig.sleepTo)

        await this.swapEthToToken(randomStable, amount)

        this.logger.info(`${this.walletAddress} | Waiting ${sleepTimeTo} sec until next swap...`)
        await sleep(sleepTimeTo * 1000)

        await this.swapTokenToEth(randomStable)
    }
}