import {getPublicBaseClient, getBaseWalletClient} from "../utils/baseClient"
import {formatEther, Hex, parseEther, PublicClient, toHex, WalletClient} from "viem"
import {getEthWalletClient, getPublicEthClient} from "../utils/ethClient"
import {mintfunAbi} from '../data/abi/mintfun'
import { makeLogger } from "../utils/logger"
import { getRandomContract, submitTx } from "../utils/mintfun"
import { mintfunContracts } from "../data/mintfun-contracts"
import { base } from "viem/chains"

export class Mintfun {
    privateKey: Hex
    logger: any
    client: PublicClient

    constructor(privateKey:Hex) {
        this.privateKey = privateKey
        this.logger = makeLogger("Mintfun")
        this.client = getPublicBaseClient()
    }

    async mintRandom() {
        const baseWallet = getBaseWalletClient(this.privateKey)

        const contract: Hex = getRandomContract(mintfunContracts)
        const amount: bigint = BigInt(1)
        let nftName = ''

        try {
            nftName = await this.client.readContract({
                address: contract,
                abi: mintfunAbi,
                functionName: 'name',
            })
        } catch (e) {
            this.logger.info(`${baseWallet.account.address} | Error: ${e.shortMessage}`)
        }

        this.logger.info(`${baseWallet.account.address} | Mint «${nftName}»`)

        try {
            const txHash = await baseWallet.writeContract({
                address: contract,
                abi: mintfunAbi,
                functionName: 'mint',
                args: [BigInt(1)]
            })
        
            this.logger.info(`${baseWallet.account.address} | Success mint: https://basescan.org/tx/${txHash}`)
            await submitTx(baseWallet.account.address, txHash)
        } catch (e) {
            this.logger.info(`${baseWallet.account.address} | Error: ${e.shortMessage}`)
        }
    }
}