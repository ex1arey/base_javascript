import { getPublicBaseClient, getBaseWalletClient } from "../utils/baseClient"
import { Hex, parseGwei, PublicClient } from "viem"
import { mintfunAbi } from '../data/abi/mintfun'
import { makeLogger } from "../utils/logger"
import { getRandomContract, submitTx } from "../utils/mintfun"
import { mintfunContracts } from "../data/mintfun-contracts"
import { binanceConfig } from "../config"
import { refill } from "../utils/refill"
import { randomFloat, sleep } from "../utils/common"
import { waitGas } from "../utils/getCurrentGas"

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
        await waitGas()
        
        const baseWallet = getBaseWalletClient(this.privateKey)

        const contract: Hex = getRandomContract(mintfunContracts)
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

        let isSuccess = false
        let retryCount = 1

        while (!isSuccess) {

            try {
                const txHash = await baseWallet.writeContract({
                    address: contract,
                    abi: mintfunAbi,
                    functionName: 'mint',
                    args: [BigInt(1)],
                    gasPrice: parseGwei((randomFloat(0.005, 0.006)).toString())
                })
                isSuccess = true
                this.logger.info(`${baseWallet.account.address} | Success mint: https://basescan.org/tx/${txHash}`)
                await submitTx(baseWallet.account.address, txHash)
            } catch (e) {
                this.logger.info(`${baseWallet.account.address} | Error: ${e.shortMessage}`)

                if (retryCount <= 3) {
                    if (retryCount == 1) {
                        if ((e.shortMessage.includes('insufficient funds') || e.shortMessage.includes('exceeds the balance')) && binanceConfig.useRefill) {
                            await refill(this.privateKey)
                        }
                    }

                    this.logger.info(`${baseWallet.account.address} | Wait 30 sec and retry mint ${retryCount}/3`)
                    retryCount++
                    await sleep(30 * 1000)
                } else {
                    isSuccess = true
                    this.logger.info(`${baseWallet.account.address} | mint unsuccessful, skip`)
                }
            }
        }
    }
}