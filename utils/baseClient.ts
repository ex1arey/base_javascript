import { publicL1OpStackActions, publicL2OpStackActions, walletL1OpStackActions } from "op-viem"
import {
    Chain,
    createPublicClient,
    createWalletClient, defineChain,
    Hex,
    http,
    HttpTransport,
    PrivateKeyAccount, PublicClient,
    WalletClient
} from "viem"
import {privateKeyToAccount} from "viem/accounts"

export const base = defineChain({
    id: 8453,
    name: 'Base',
    network: 'base',
    nativeCurrency: {
        decimals: 18,
        name: 'Ether',
        symbol: 'ETH',
    },
    rpcUrls: {
        default: {
            http: ['https://mainnet.base.org'],
            webSocket: ['wss://mainnet.base.org'],
        },
        public: {
            http: ['https://mainnet.base.org'],
            webSocket: ['wss://mainnet.base.org'],
        },
    },
    blockExplorers: {
        default: { name: 'Explorer', url: 'https://basescan.org/' },
    }
})

function getPublicBaseClient(): PublicClient {
    return createPublicClient({ chain: base, transport: http() }).extend(publicL1OpStackActions)
}

function getBaseWalletClient(privateKey:Hex): WalletClient<HttpTransport, Chain, PrivateKeyAccount> {
    return createWalletClient({ chain: base, account: privateKeyToAccount(privateKey), transport: http() }).extend(walletL1OpStackActions)
}

export { getPublicBaseClient, getBaseWalletClient }