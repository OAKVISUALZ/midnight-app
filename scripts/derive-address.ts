/**
 * Derive the unshielded (n_address) for a wallet seed on a given network,
 * entirely offline — no proof server, node, or indexer required.
 *
 * Used by the CI workflow to print the address to fund for public-network
 * deploys: `npx tsx scripts/derive-address.ts <seed-hex-64> <preview|preprod>`
 */
import { Buffer } from 'buffer';
import { HDWallet, Roles, createKeystore } from '@midnight-ntwrk/wallet-sdk';

const seed = process.argv[2];
const network = process.argv[3];
if (!seed || !/^[0-9a-fA-F]{64}$/.test(seed)) {
  console.error('usage: tsx scripts/derive-address.ts <seed-hex-64> <preview|preprod>');
  process.exit(1);
}

const hdWallet = HDWallet.fromSeed(Buffer.from(seed, 'hex'));
if (hdWallet.type !== 'seedOk') throw new Error('Invalid seed');
const result = hdWallet.hdWallet
  .selectAccount(0)
  .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust] as const)
  .deriveKeysAt(0);
if (result.type !== 'keysDerived') throw new Error('Key derivation failed');
hdWallet.hdWallet.clear();

const keys = result.keys as Record<number, Uint8Array>;
const keystore = createKeystore(keys[Roles.NightExternal], network);
process.stdout.write(keystore.getBech32Address().toString() + '\n');