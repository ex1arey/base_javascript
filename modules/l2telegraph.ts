import { getPublicBaseClient, getBaseWalletClient } from "../utils/baseClient"
import { Hex, parseEther, parseGwei } from "viem"
import { makeLogger } from "../utils/logger"
import { l2telegraphAbi } from "../data/abi/l2telegraph_nft"
import { l2telegraphMsgAbi } from "../data/abi/l2telegraph_message"
import { binanceConfig, generalConfig, l2telegraphMessageConfig } from "../config"
import { refill } from "../utils/refill"
import { random, randomFloat, sleep } from "../utils/common"
import { waitGas } from "../utils/getCurrentGas"

export class L2Telegraph {
    privateKey: Hex
    logger: any
    destNetwork: number = 195
    nftContract: Hex = '0x36a358b3ba1fb368e35b71ea40c7f4ab89bfd8e1'
    messageContract: Hex = '0x64e0f6164ac110b67df9a4848707ffbcb86c87a9'
    baseClient
    baseWallet
    walletAddress

    constructor(privateKey:Hex) {
        this.privateKey = privateKey
        this.logger = makeLogger("L2Telegraph")
        this.baseClient = getPublicBaseClient()
        this.baseWallet = getBaseWalletClient(privateKey)
        this.walletAddress = this.baseWallet.account.address
    }

    async estimateLayerzeroFee(method: string = 'bridge') {
        let value: bigint

        if (method === 'bridge') {
            const txValue = await this.baseClient.readContract({
                address: this.nftContract,
                abi: l2telegraphAbi,
                functionName: 'estimateFees',
                args: [
                    this.destNetwork,
                    this.walletAddress,
                    '0x',
                    false,
                    '0x',
                ]
            })

            value = txValue[0]
        } else {
            const txValue = await this.baseClient.readContract({
                address: this.messageContract,
                abi: l2telegraphMsgAbi,
                functionName: 'estimateFees',
                args: [
                    this.destNetwork,
                    this.walletAddress,
                    '0x',
                    false,
                    '0x',
                ]
            })

            value = txValue[0]
        }

        return BigInt(Math.round(Number(value) * 2))
    }

    async mint() {
        await waitGas()
        let txHash: Hex | undefined

        this.logger.info(`${this.walletAddress} | Mint`)

        let isSuccess = false
        let retryCount = 1

        while (!isSuccess) {
            try {
                txHash = await this.baseWallet.writeContract({
                    address: this.nftContract,
                    abi: l2telegraphAbi,
                    functionName: 'mint',
                    gasPrice: parseGwei((randomFloat(0.005, 0.006)).toString())
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

        const sleepTime = random(generalConfig.sleepFrom, generalConfig.sleepTo)
        this.logger.info(`Waiting ${sleepTime} sec after mint and before bridge...`)
        await sleep(sleepTime * 1000)

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
                    let value = await this.estimateLayerzeroFee('bridge')

                    txHash = await this.baseWallet.writeContract({
                        address: this.nftContract,
                        abi: l2telegraphAbi,
                        functionName: 'crossChain',
                        args: [
                            this.destNetwork,
                            '0x5b10ae182c297ec76fe6fe0e3da7c4797cede02d36a358b3ba1fb368e35b71ea40c7f4ab89bfd8e1',
                            tokenId
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

    async sendMessage() {
        await waitGas()
        this.logger.info(`${this.walletAddress} | Send message`)

        let isSuccess = false
        let retryCount = 1

        while (!isSuccess) {
            try {
                let value = await this.estimateLayerzeroFee('bridge')
                value = value + BigInt(parseEther('0.00022'))

                if (value > BigInt(parseEther(l2telegraphMessageConfig.maxMessageCost.toString()))) {
                    this.logger.info(`${this.walletAddress} | Message price too expensive, skip`)
                    isSuccess = true
                } else {
                    const txHash = await this.baseWallet.writeContract({
                        address: this.messageContract,
                        abi: l2telegraphMsgAbi,
                        functionName: 'sendMessage',
                        args: [
                            'Hello!',
                            this.destNetwork,
                            '0x5f26ea1e4d47071a4d9a2c2611c2ae0665d64b6d64e0f6164ac110b67df9a4848707ffbcb86c87a9'
                        ],
                        value: value,
                        gasPrice: parseGwei((randomFloat(0.005, 0.006)).toString())
                    })
                    isSuccess = true
                    this.logger.info(`${this.walletAddress} | Success sent message: https://basescan.org/tx/${txHash}`)
                }
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