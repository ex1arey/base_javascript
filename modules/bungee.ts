import { getPublicBaseClient, getBaseWalletClient } from "../utils/baseClient"
import { Hex, PrivateKeyAccount, formatEther, parseEther, parseGwei } from "viem"
import { makeLogger } from "../utils/logger"
import { random, randomFloat, sleep } from "../utils/common"
import { binanceConfig, bungeeConfig, generalConfig, odosConfig, swapConfig } from "../config"
import { approve } from "../utils/approve"
import { tokens } from "../data/base-tokens"
import { getTokenBalance } from "../utils/tokenBalance"
import { privateKeyToAccount } from "viem/accounts"
import { HttpsProxyAgent } from "https-proxy-agent"
import { refill } from "../utils/refill"
import axios from "axios"
import { waitGas } from "../utils/getCurrentGas"
import { bungeeAbi } from "../data/abi/bungee"

export class Bungee {
    privateKey: Hex
    logger: any
    bungeeContract: Hex = '0xe8c5b8488feafb5df316be73ede3bdc26571a773'
    randomNetwork: any
    baseClient: any
    baseWallet: any
    walletAddress: Hex
    account: PrivateKeyAccount
    proxy: string|null = null
    destNetwork: number
    networks = [
        {
            name: 'optimism', 
            id: 10
        },
        {
            name: 'bsc', 
            id: 56
        },
        {
            name: 'polygon', 
            id: 137
        },
        {
            name: 'arbitrum', 
            id: 42161
        },
        {
            name: 'avalanche', 
            id: 43114
        },
        {
            name: 'zksync', 
            id: 324
        },
        {
            name: 'zkevm', 
            id: 1101
        }
    ]

    constructor(privateKey:Hex) {
        this.privateKey = privateKey
        this.logger = makeLogger("Bungee")
        this.baseClient = getPublicBaseClient()
        this.baseWallet = getBaseWalletClient(privateKey)
        this.account = privateKeyToAccount(privateKey)
        this.walletAddress = this.baseWallet.account.address

        if (bungeeConfig.destinationNetwork === 'random') {
            this.randomNetwork = this.networks[random(0, this.networks.length-1)]
        } else {
            this.randomNetwork = this.networks.find(network => network.name === bungeeConfig.destinationNetwork)
        }

        this.destNetwork = this.randomNetwork.id
    }


    async getLimits() {
        let chainData:any
        let limits: any

        await axios.get('https://refuel.socket.tech/chains').then(response => {
            chainData = response.data.result.find((chain: { name: string }) => chain.name === 'Base')
        })
        console.log(chainData)
        limits = chainData.limits.find((limit: { chainId: number }) => limit.chainId === this.destNetwork)

        return limits
    }

    async refuel(amount: string) {
        // await waitGas()
        const value: bigint = BigInt(parseEther(amount))
        this.logger.info(`${this.walletAddress} | Bungee refuel to ${this.randomNetwork.name}`)

        let isSuccess = false
        let retryCount = 1

        while (!isSuccess) {
            try {
                const txHash = await this.baseWallet.writeContract({
                    address: this.bungeeContract,
                    abi: bungeeAbi,
                    functionName: 'depositNativeToken',
                    args: [
                        this.destNetwork,
                        this.walletAddress
                    ],
                    value: value,
                    gasPrice: parseGwei((randomFloat(0.005, 0.006)).toString())
                })
                
                isSuccess = true
                this.logger.info(`${this.walletAddress} | Success refuel to ${this.randomNetwork.name}: https://basescan.org/tx/${txHash}`)
            } catch (e) {
                this.logger.info(`${this.walletAddress} | Error: ${e}`)

                if (retryCount <= 3) {
                    if (retryCount == 1) {
                        if ((e.shortMessage.includes('insufficient funds') || e.shortMessage.includes('exceeds the balance')) && binanceConfig.useRefill) {
                            await refill(this.privateKey)
                        }
                    }
                    
                    this.logger.info(`${this.walletAddress} | Wait 30 sec and retry refuel ${retryCount}/3`)
                    retryCount++
                    await sleep(30 * 1000)
                } else {
                    isSuccess = true
                    this.logger.info(`${this.walletAddress} | Refuel unsuccessful, skip`)
                }
            }
        }
    }
}