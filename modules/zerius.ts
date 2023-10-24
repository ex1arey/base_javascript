import { getPublicBaseClient, getBaseWalletClient } from "../utils/baseClient"
import { Hex, parseEther, parseGwei } from "viem"
import { makeLogger } from "../utils/logger"
import { zeriusAbi } from "../data/abi/zerius"
import { binanceConfig, zeriusConfig } from "../config"
import { refill } from "../utils/refill"
import { random, randomFloat, sleep } from "../utils/common"
import { waitGas } from "../utils/getCurrentGas"

export class Zerius {
    privateKey: Hex
    logger: any
    destNetwork: number = 195
    nftContract: Hex = '0x178608ffe2cca5d36f3fc6e69426c4d3a5a74a41'
    baseClient
    baseWallet
    walletAddress

    constructor(privateKey:Hex) {
        this.privateKey = privateKey
        this.logger = makeLogger("L2Telegraph")
        this.baseClient = getPublicBaseClient()
        this.baseWallet = getBaseWalletClient(privateKey)
        this.walletAddress = this.baseWallet.account.address
        this.destNetwork = zeriusConfig.destinationNetworks[random(0, zeriusConfig.destinationNetworks.length-1)]
    }

    async estimateLayerzeroFee(tokenId: bigint) {
        let value: bigint

        const txValue = await this.baseClient.readContract({
            address: this.nftContract,
            abi: zeriusAbi,
            functionName: 'estimateSendFee',
            args: [
                this.destNetwork,
                this.walletAddress,
                tokenId,
                false,
                '0x',
            ]
        })

        value = txValue[0]

        return BigInt(Math.round(Number(value) * 2))
    }

    async mint() {
        await waitGas()
        
        let txHash: Hex | undefined

        this.logger.info(`${this.walletAddress} | Mint`)

        let isSuccess = false
        let retryCount = 1

        const mintFee = await this.baseClient.readContract({
            address: this.nftContract,
            abi: zeriusAbi,
            functionName: 'mintFee'
        })

        while (!isSuccess) {
            try {
                txHash = await this.baseWallet.writeContract({
                    address: this.nftContract,
                    abi: zeriusAbi,
                    functionName: 'mint',
                    gasPrice: parseGwei((randomFloat(0.005, 0.006)).toString()),
                    value: mintFee
                })
                isSuccess = true
                this.logger.info(`${this.walletAddress} | Success mint: https://basescan.org/tx/${txHash}`)
                return txHash
            } catch (e) {
                this.logger.info(`${this.walletAddress} | Error: ${e.shortMessage}`)
                if (retryCount <= 3) {
                    if (retryCount == 1) {
                        if ((e.shortMessage.includes('insufficient funds') || e.shortMessage.includes('exceeds the balance')) && binanceConfig.useRefill) {
                            await refill(this.privateKey)
                        }
                    }
                    
                    this.logger.info(`${this.walletAddress} | Wait 30 sec and retry mint ${retryCount}/3`)
                    retryCount++
                    await sleep(30 * 1000)
                } else {
                    isSuccess = true
                    this.logger.info(`${this.walletAddress} | Mint unsuccessful, skip`)
                }
            }
        }
    }

    async mintAndBridge() {
        await waitGas()
        
        let txHash = await this.mint()

        if (txHash !== undefined) {
            this.logger.info(`${this.walletAddress} | Bridge`)

            let isSuccess = false
            let retryCount = 1

            while (!isSuccess) {
                try {
                    const receipt = await this.baseClient.waitForTransactionReceipt({ 
                        hash: txHash
                    })

                    let tokenId: bigint = BigInt(parseInt(receipt.logs[0].topics[receipt.logs[0].topics.length - 1], 16))
                    let value = await this.estimateLayerzeroFee(tokenId)

                    txHash = await this.baseWallet.writeContract({
                        address: this.nftContract,
                        abi: zeriusAbi,
                        functionName: 'sendFrom',
                        args: [
                            this.walletAddress,
                            this.destNetwork,
                            this.walletAddress,
                            tokenId,
                            this.walletAddress,
                            '0x0000000000000000000000000000000000000000',
                            '0x0001000000000000000000000000000000000000000000000000000000000003d090'
                        ],
                        value: value,
                        gasPrice: parseGwei((randomFloat(0.005, 0.006)).toString())
                    })
                    isSuccess = true
                    this.logger.info(`${this.walletAddress} | Success bridge: https://basescan.org/tx/${txHash}`)
                } catch (e) {
                    this.logger.info(`${this.walletAddress} | Error: ${e.shortMessage}`)

                    if (retryCount <= 3) {
                        if (retryCount == 1) {
                            if ((e.shortMessage.includes('insufficient funds') || e.shortMessage.includes('exceeds the balance')) && binanceConfig.useRefill) {
                                await refill(this.privateKey)
                            }
                        }
                        
                        this.logger.info(`${this.walletAddress} | Wait 30 sec and retry bridge ${retryCount}/3`)
                        retryCount++
                        await sleep(30 * 1000)
                    } else {
                        isSuccess = true
                        this.logger.info(`${this.walletAddress} | Bridge unsuccessful, skip`)
                    }
                }
            }
        }
    }
}