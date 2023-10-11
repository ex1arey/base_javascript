import {getPublicBaseClient, getBaseWalletClient} from "../utils/baseClient"
import {Hex, encodePacked, parseEther, parseGwei} from "viem"
import { makeLogger } from "../utils/logger"
import { merklyAbi } from "../data/abi/merkly"
import { random, randomFloat, sleep } from "../utils/common"
import { binanceConfig, merklyConfig } from "../config"
import { refill } from "../utils/refill"

export class Merkly {
    privateKey: Hex
    logger: any
    destNetwork: number = 195
    merklyContract: Hex = '0x6bf98654205b1ac38645880ae20fc00b0bb9ffca'
    randomNetwork: any
    baseClient: any
    baseWallet: any
    walletAddress: Hex
    networks = [
        {
            id: 195,
            name: 'Zora'
        },
        {
            id: 175,
            name: 'Arbitrum Nova'
        },
        {
            id: 126,
            name: 'Moonbeam'
        },
        {
            id: 145,
            name: 'Gnosis'
        },
        {
            id: 202,
            name: 'OpBNB'
        },
        {
            id: 210,
            name: 'Astar'
        }
    ]

    constructor(privateKey:Hex) {
        this.privateKey = privateKey
        this.logger = makeLogger("Merkly")
        this.baseClient = getPublicBaseClient()
        this.baseWallet = getBaseWalletClient(privateKey)
        this.walletAddress = this.baseWallet.account.address

        if (merklyConfig.destinationNetwork === 'random') {
            this.randomNetwork = this.networks[random(0, this.networks.length-1)]
        } else {
            this.randomNetwork = this.networks.find(network => network.name === merklyConfig.destinationNetwork)
        }

        this.destNetwork = this.randomNetwork.id
    }

    async estimateLayerzeroFee(adapterParams: any) {
        let value: bigint
        const txValue = await this.baseClient.readContract({
            address: this.merklyContract,
            abi: merklyAbi,
            functionName: 'estimateSendFee',
            args: [
                this.destNetwork,
                '0x',
                adapterParams
            ]
        })

        value = txValue[0]
        return BigInt(Math.round(Number(value) * 1.2))
    }

    async refuel(value: string) {
        this.logger.info(`${this.walletAddress} | Refuel to ${this.randomNetwork.name}`)

        let amount = BigInt(parseEther(value))

        let isSuccess = false
        let retryCount = 1

        while (!isSuccess) {
            try {
                const adapterParams = encodePacked(
                    [
                        "uint16", 
                        "uint", 
                        "uint", 
                        "address"
                    ], 
                    [
                        2, 
                        BigInt('200000'),
                        amount,
                        this.walletAddress
                    ]
                )

                let value = await this.estimateLayerzeroFee(adapterParams)

                const txHash = await this.baseWallet.writeContract({
                    address: this.merklyContract,
                    abi: merklyAbi,
                    functionName: 'bridgeGas',
                    args: [
                        this.destNetwork,
                        this.walletAddress,
                        adapterParams
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