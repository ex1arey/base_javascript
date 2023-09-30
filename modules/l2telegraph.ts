import {getPublicBaseClient, getBaseWalletClient} from "../utils/baseClient"
import {formatEther, Hex, parseEther, PublicClient, toHex, WalletClient} from "viem"
import {getEthWalletClient, getPublicEthClient} from "../utils/ethClient"
import { makeLogger } from "../utils/logger"
import { mintfunContracts } from "../data/mintfun-contracts"
import { l2telegraphAbi } from "../data/abi/l2telegraph_nft"
import { l2telegraphMsgAbi } from "../data/abi/l2telegraph_message"

export class L2Telegraph {
    privateKey: Hex
    logger: any
    destNetwork: number = 175
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
        let txHash: Hex | undefined

        this.logger.info(`${this.walletAddress} | Mint`)

        try {
            txHash = await this.baseWallet.writeContract({
                address: this.nftContract,
                abi: l2telegraphAbi,
                functionName: 'mint'
            })
        
            this.logger.info(`${this.walletAddress} | Success mint: https://basescan.org/tx/${txHash}`)
            return txHash
        } catch (e) {
            this.logger.info(`${this.walletAddress} | Error: ${e.shortMessage}`)
        }
    }

    async mintAndBridge() {
        let txHash = await this.mint()

        if (txHash !== undefined) {
            this.logger.info(`${this.walletAddress} | Bridge`)

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
                    value: value
                })

                this.logger.info(`${this.walletAddress} | Success bridge: https://basescan.org/tx/${txHash}`)
            } catch (e) {
                this.logger.info(`${this.walletAddress} | Error: ${e.shortMessage}`)
            }
        }
    }

    async sendMessage() {
        this.logger.info(`${this.walletAddress} | Send message`)

        try {

            let value = await this.estimateLayerzeroFee('bridge')
            value = value + BigInt(parseEther('0.00025'))

            const txHash = await this.baseWallet.writeContract({
                address: this.messageContract,
                abi: l2telegraphMsgAbi,
                functionName: 'sendMessage',
                args: [
                    'Hello!',
                    this.destNetwork,
                    '0x5f26ea1e4d47071a4d9a2c2611c2ae0665d64b6d64e0f6164ac110b67df9a4848707ffbcb86c87a9'
                ],
                value: value
            })

            this.logger.info(`${this.walletAddress} | Success sent message: https://basescan.org/tx/${txHash}`)
        } catch (e) {
            this.logger.info(`${this.walletAddress} | Error: ${e.shortMessage}`)
        }
    }
}