import {getPublicBaseClient, getBaseWalletClient} from "../utils/baseClient"
import {Hex, encodePacked, parseEther} from "viem"
import { makeLogger } from "../utils/logger"
import { merklyAbi } from "../data/abi/merkly"
import { random } from "../utils/common"

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
        this.randomNetwork = this.networks[random(0, this.networks.length-1)]
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

    async refuel() {
        this.logger.info(`${this.walletAddress} | Refuel to ${this.randomNetwork.name}`)
        let amount = BigInt(parseEther('0.00001'))

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
                value: value
            })

            this.logger.info(`${this.walletAddress} | Success refuel to ${this.randomNetwork.name}: https://basescan.org/tx/${txHash}`)
        } catch (e) {
            this.logger.info(`${this.walletAddress} | Error: ${e}`)
        }
    }
}