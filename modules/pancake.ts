import { getPublicBaseClient, getBaseWalletClient } from "../utils/baseClient"
import { Hex, encodeFunctionData, formatEther, parseGwei } from "viem"
import { makeLogger } from "../utils/logger"
import { random, randomFloat, sleep } from "../utils/common"
import { tokens } from "../data/base-tokens"
import { approve } from "../utils/approve"
import { getTokenBalance } from "../utils/tokenBalance"
import { binanceConfig, generalConfig, swapConfig } from "../config"
import { pancakeQuouterAbi } from "../data/abi/pancake_quoter"
import { pancakeRouterAbi } from "../data/abi/pancake_router"
import { refill } from "../utils/refill"
import { waitGas } from "../utils/getCurrentGas"

export class Pancake {
    privateKey: Hex
    logger: any
    pancakeRouterContract: Hex = '0x678Aa4bF4E210cf2166753e054d5b7c31cc7fa86'
    pancakeFactoryContract: Hex = '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865'
    pancakeQuoterContract: Hex = '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997'
    randomNetwork: any
    baseClient: any
    baseWallet: any
    walletAddress: Hex

    constructor(privateKey:Hex) {
        this.privateKey = privateKey
        this.logger = makeLogger("Pancake")
        this.baseClient = getPublicBaseClient()
        this.baseWallet = getBaseWalletClient(privateKey)
        this.walletAddress = this.baseWallet.account.address
    }

    async getMinAmountOut(fromToken: Hex, toToken: Hex, amount: BigInt, slippage: number) {
        const minAmountOut = await this.baseClient.readContract({
            address: this.pancakeQuoterContract,
            abi: pancakeQuouterAbi,
            functionName: 'quoteExactInputSingle',
            args: [{
                tokenIn: fromToken,
                tokenOut: toToken,
                amountIn: amount,
                fee: 500,
                sqrtPriceLimitX96: BigInt(0)
            }]
        })

        return BigInt(Math.round(Number(minAmountOut[0]) - (Number(minAmountOut[0]) / 100 * slippage)))
    }

    async swapEthToToken(toToken: string = 'USDC', amount: bigint) {
        await waitGas()
        
        this.logger.info(`${this.walletAddress} | Swap ${formatEther(amount)} ETH -> ${toToken}`)
        let successSwap: boolean = false
        let retryCount = 1

        while (!successSwap) {
            try {
                const minAmountOut = await this.getMinAmountOut(tokens['ETH'], tokens[toToken], amount, 1)
                const deadline: number = Math.floor(Date.now() / 1000) + 1000000

                const txData = encodeFunctionData({
                    abi: pancakeRouterAbi,
                    functionName: 'exactInputSingle',
                    args: [{
                        tokenIn: tokens['ETH'],
                        tokenOut: tokens[toToken],
                        fee: 500,
                        recipient: this.walletAddress,
                        amountIn: amount,
                        amountOutMinimum: minAmountOut,
                        sqrtPriceLimitX96: BigInt(0)
                    }]
                })

                const txHash = await this.baseWallet.writeContract({
                    address: this.pancakeRouterContract,
                    abi: pancakeRouterAbi,
                    functionName: 'multicall',
                    args: [
                        deadline,
                        [txData]
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
                const minAmountOut = await this.getMinAmountOut(tokens[fromToken], tokens['ETH'], amount, 1)
                const deadline: number = Math.floor(Date.now() / 1000) + 1000000

                await approve(this.baseWallet, this.baseClient, tokens[fromToken], this.pancakeRouterContract, amount, this.logger)

                const sleepTime = random(generalConfig.sleepFrom, generalConfig.sleepTo)
                this.logger.info(`${this.walletAddress} | Waiting ${sleepTime} sec after approve before swap...`)
                await sleep(sleepTime * 1000)

                const txData = encodeFunctionData({
                    abi: pancakeRouterAbi,
                    functionName: 'exactInputSingle',
                    args: [{
                        tokenIn: tokens[fromToken],
                        tokenOut: tokens['ETH'],
                        fee: 500,
                        recipient: "0x0000000000000000000000000000000000000002",
                        amountIn: amount,
                        amountOutMinimum: minAmountOut,
                        sqrtPriceLimitX96: BigInt(0)
                    }]
                })

                const unwrapData = encodeFunctionData({
                    abi: pancakeRouterAbi,
                    functionName: 'unwrapWETH9',
                    args: [
                        minAmountOut,
                        this.walletAddress
                    ]
                })

                const txHash = await this.baseWallet.writeContract({
                    address: this.pancakeRouterContract,
                    abi: pancakeRouterAbi,
                    functionName: 'multicall',
                    args: [
                        deadline,
                        [txData, unwrapData]
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
        const randomChooice: number = random(1, 2)
        const randomStable = randomChooice > 1 ? 'USDC' : 'DAI'
        let amount: bigint = BigInt(Math.round(Number(ethBalance) * randomPercent))
        const sleepTimeTo = random(generalConfig.sleepFrom, generalConfig.sleepTo)

        await this.swapEthToToken(randomStable, amount)

        this.logger.info(`${this.walletAddress} | Waiting ${sleepTimeTo} sec until next swap...`)
        await sleep(sleepTimeTo * 1000)

        await this.swapTokenToEth(randomStable)
    }

    async swapStablesToEth() {
        let amountUSDC = await getTokenBalance(this.baseClient, tokens['USDC'], this.walletAddress)
        let amountDAI = await getTokenBalance(this.baseClient, tokens['DAI'], this.walletAddress)
        if (amountUSDC > 0) {
            await this.swapTokenToEth('USDC')
            const sleepTime = random(generalConfig.sleepFrom, generalConfig.sleepTo)
            this.logger.info(`${this.walletAddress} | Waiting ${sleepTime} sec until next swap...`)
            await sleep(sleepTime * 1000)
        }

        if (amountDAI > 0) {
            await this.swapTokenToEth('DAI')
        }
    }
}