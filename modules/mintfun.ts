import {getPublicBaseClient, getBaseWalletClient} from "../utils/baseClient"
import {formatEther, Hex, parseEther, PublicClient, toHex, WalletClient} from "viem"
import {getEthWalletClient, getPublicEthClient} from "../utils/ethClient"
import {mintfunAbi} from '../data/abi/mintfun'
import { makeLogger } from "../utils/logger"
import { getRandomContract } from "../utils/mintfun"
import { mintfunContracts } from "../data/mintfun-contracts"

export class Mintfun {
    privateKey: Hex
    logger: any
    client: PublicClient
    wallet: WalletClient

    constructor(privateKey:Hex) {
        this.privateKey = privateKey
        this.logger = makeLogger("Mintfun")
        this.client = getPublicBaseClient()
        this.wallet = getBaseWalletClient(privateKey)
    }

    async mintRandom() {
        if (this.wallet.account === undefined) {
            return
        }

        const contract: Hex = getRandomContract(mintfunContracts)
        const amount: bigint = BigInt(1)

        const nftName = await this.client.readContract({
            address: contract,
            abi: mintfunAbi,
            functionName: 'name',
        })

        console.log(nftName)
        this.logger.info(`${this.wallet.account.address} | Mint ${nftName}`)

        try {
            // const args: readonly [
            //     bigint
            // ] = [amount]

            // const txHash = await this.wallet.writeContract({
            //     address: contract,
            //     abi: mintfunAbi,
            //     functionName: 'mint',
            //     args: [
            //         BigInt(1)
            //     ]
            // })
        
            // this.logger.info(`${this.wallet.account.address} | Success mint: https://basescan.org/tx/${txHash}`)
        } catch (e) {
            this.logger.info(`${this.wallet.account.address} | Error: ${e.shortMessage}`)
        }
    }
}