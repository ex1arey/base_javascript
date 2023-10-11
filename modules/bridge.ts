import { formatEther, Hex, parseEther } from "viem"
import { getArbWalletClient, getPublicArbClient } from "../utils/arbClient"
import { getEthWalletClient } from "../utils/ethClient"
import { layerzeroAbi } from '../data/abi/layerzero'
import { stargateAbi } from '../data/abi/stargate'
import { bridgeAbi } from "../data/abi/bridge"
import { getOpWalletClient, getPublicOpClient } from "../utils/optimismClient"
import { makeLogger } from "../utils/logger"

const destChain: number = 184 // base

export class Bridge {
    privateKey: Hex
    bridgeContractAddress:Hex = '0x49048044D57e1C92A77f79988d21Fa8fAF74E97e'
    layerzeroArbContractAddress:Hex = '0x53Bf833A5d6c4ddA888F69c22C88C9f356a41614'
    stargateArbContractAddress:Hex = '0xbf22f0f184bccbea268df387a49ff5238dd23e40'
    layerzeroOptContractAddress:Hex = '0xb0d502e938ed5f4df2e681fe6e419ff29631d62b'
    stargateOptContractAddress:Hex = '0xb49c4e680174e331cb0a7ff3ab58afc9738d5f8b'
    logger: any

    constructor(privateKey:Hex) {
        this.privateKey = privateKey
        this.logger = makeLogger("Bridge")
    }

    async stargateArbitrumToBase(amount: string) {
        const arbClient = getPublicArbClient()
        const arbWallet = getArbWalletClient(this.privateKey)
        
        let value: bigint = BigInt(parseEther(amount))

        const ethBalance = await arbClient.getBalance({
            address: arbWallet.account.address,
        })
    
        const dstNativeAddr:`0x${string}` = '0x0000000000000000000000000000000000000001'
        const lzTxParams = {
            'dstGasForCall':  BigInt(0),
            'dstNativeAmount': BigInt(0),
            'dstNativeAddr': dstNativeAddr
        }
    
        const txValue = await arbClient.readContract({
            address: this.layerzeroArbContractAddress,
            abi: layerzeroAbi,
            functionName: 'quoteLayerZeroFee',
            args: [
                destChain,
                1,
                arbWallet.account.address,
                '0x',
                lzTxParams
            ]
        })
    
        let valueL0 = value+txValue[0]
        let amountLD: bigint = BigInt(Math.round(Number(value) * 0.995))

        if (valueL0 > ethBalance) {
            valueL0 = ethBalance - BigInt(parseEther('0.0002'))
            amountLD = ethBalance - txValue[0] - BigInt(parseEther('0.0002'))
        }

        this.logger.info(`${arbWallet.account.address} | Stargate Arbitrum -> Base ${formatEther(amountLD)} ETH`)

        const minAmount: bigint = BigInt(Math.round(Number(amountLD) * 0.995))
    
        const args: readonly [
            number,
            `0x${string}`,
            `0x${string}`,
            bigint,
            bigint
        ] = [destChain, arbWallet.account.address, arbWallet.account.address, amountLD, minAmount]
          
        try {
            const txHash = await arbWallet.writeContract({
                address: this.stargateArbContractAddress,
                abi: stargateAbi,
                functionName: 'swapETH',
                args: args,
                value: valueL0
            })

            this.logger.info(`${arbWallet.account.address} | Stargate Arbitrum -> Base done: https://arbiscan.io/tx/${txHash}`)
        } catch (e) {
            this.logger.error(`${arbWallet.account.address} | Stargate Arbitrum -> Base error: ${e.shortMessage}`)    
        }
    }

    async stargateOptimismToBase(amount: string) {
        const optimismClient = getPublicOpClient()
        const optimismWallet = getOpWalletClient(this.privateKey)
        let value: bigint = BigInt(parseEther(amount))

        const ethBalance = await optimismClient.getBalance({
            address: optimismWallet.account.address,
        })
    
        const dstNativeAddr:`0x${string}` = '0x0000000000000000000000000000000000000001'
        const lzTxParams = {
            'dstGasForCall':  BigInt(0),
            'dstNativeAmount': BigInt(0),
            'dstNativeAddr': dstNativeAddr
        }
    
        const txValue = await optimismClient.readContract({
            address: this.layerzeroOptContractAddress,
            abi: layerzeroAbi,
            functionName: 'quoteLayerZeroFee',
            args: [
                destChain,
                1,
                optimismWallet.account.address,
                '0x',
                lzTxParams
            ]
        })
    
        let valueL0 = value+txValue[0]
        let amountLD: bigint = BigInt(Math.round(Number(value) * 0.995))
        
        if (valueL0 > ethBalance) {
            valueL0 = ethBalance - BigInt(parseEther('0.0002'))
            amountLD = ethBalance - txValue[0] - BigInt(parseEther('0.0002'))
        }
        
        let minAmount: bigint = BigInt(Math.round(Number(amountLD) * 0.995))

        this.logger.info(`${optimismWallet.account.address} | Stargate Optimism -> Base ${formatEther(amountLD)} ETH`)
    
        const args: readonly [
            number,
            `0x${string}`,
            `0x${string}`,
            bigint,
            bigint
        ] = [destChain, optimismWallet.account.address, optimismWallet.account.address, amountLD, minAmount]
          
        try {
            const txHash = await optimismWallet.writeContract({
                address: this.stargateOptContractAddress,
                abi: stargateAbi,
                functionName: 'swapETH',
                args: args,
                value: valueL0
            })
        
            this.logger.info(`${optimismWallet.account.address} | Stargate Optimism -> Base done: https://optimistic.etherscan.io/tx/${txHash}`)
        } catch (e) {
            this.logger.error(`${optimismWallet.account.address} | Stargate Optimism -> Base error: ${e.shortMessage}`)
        }
    }

    async bridge(amount: string) {
        const ethWallet = getEthWalletClient(this.privateKey)
        const value: bigint = BigInt(parseEther(amount))

        this.logger.info(`${ethWallet.account.address} | Official bridge ETH -> Base ${amount} ETH`)
    
        const args: readonly [
            `0x${string}`,
            bigint,
            bigint,
            boolean,
            `0x${string}`
        ] = [ethWallet.account.address, value, BigInt(100000), false, '0x']
        
        try {
            const txHash = await ethWallet.writeContract({
                address: this.bridgeContractAddress,
                abi: bridgeAbi,
                functionName: 'depositTransaction',
                args: args,
                value: value
            })
        
            this.logger.info(`${ethWallet.account.address} | Official bridge ETH -> Base done: https://etherscan.io/tx/${txHash}`)
        } catch (e) {
            this.logger.error(`${ethWallet.account.address} | Official bridge ETH -> Base error: ${e.shortMessage}`)
        }
    }
}