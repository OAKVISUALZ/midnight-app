# midnight-app

A Midnight Network smart contract that stores messages on-chain with a
`sanitizeMessage` witness that trims whitespace and enforces a maximum
message length of 100 characters.

## Quick start

Requirements: Node 22, Docker (with Compose v2), and the Compact compiler at
the version pinned in `.compact-version` at the create-mn-app repo root (the
version this project was scaffolded against).

```bash
npm install
npm run setup
npm run test:e2e
```

`npm run setup` runs end-to-end with no prompts:

1. `docker compose up -d --wait` — starts a local Midnight devnet (node, indexer, proof-server).
2. `npm run compile` — compiles `contracts/hello-world.compact` to `contracts/managed/hello-world/`.
3. `npm run deploy` — derives the genesis-seed wallet, deploys the contract, writes `.midnight-state.json`.

`npm run test:e2e` reconnects to the deployed contract and reads its ledger
state. Exits 0 if the contract is live and indexable.

`npm run cli` opens an interactive menu:

```
1. Store a message    (calls the storeMessage circuit via the sanitizeMessage witness)
2. Read current message
3. Check wallet balance
4. Exit
```

## Contract design

The contract (`contracts/hello-world.compact`) exposes a single ledger field
`message: Opaque<"string">` and one circuit `storeMessage`:

```
witness sanitizeMessage(raw: Opaque<"string">): Opaque<"string">;

export circuit storeMessage(raw: Opaque<"string">): [] {
    let clean: Opaque<"string"> = sanitizeMessage(raw);
    assert(clean.length() <= 100);
    message = disclose(clean);
}
```

### Witness: sanitizeMessage

The `sanitizeMessage` witness is implemented in TypeScript (not in-circuit).
It receives the raw string and returns it with leading/trailing whitespace
trimmed. Because the witness runs natively, the circuit can efficiently
validate the sanitized result without expensive string operations inside the
zero-knowledge proof.

The witness is provided at deployment time in `src/deploy.ts`, `src/cli.ts`,
and `scripts/e2e-check.ts`:

```typescript
const witnesses = {
  sanitizeMessage: (context: any, raw: string) => {
    return [context.privateState, raw.trim()];
  },
};
```

### Message length

The circuit asserts `clean.length() <= 100` in-circuit, so no message
longer than 100 characters can be stored. The TypeScript front-end is
stateless — validation happens inside the proof.

## Project structure

```
midnight-app/
├── contracts/
│   └── hello-world.compact      # Compact source with witness + length check
├── public/                       # Netlify-deployable landing page
│   └── index.html
├── scripts/
│   └── e2e-check.ts             # smoke + read-back
├── src/
│   ├── network.ts               # network selection + state file management
│   ├── wallet.ts                # wallet construction + sync-state cache
│   ├── setup.ts                 # orchestrator for `npm run setup`
│   ├── deploy.ts                # deploy the contract (provides witnesses)
│   ├── cli.ts                   # interact with deployed contract
│   └── check-balance.ts         # NIGHT / DUST balance
├── docker-compose.yml           # node + indexer + proof-server
├── netlify.toml                 # Netlify deployment config
├── .gitignore
├── package.json
└── tsconfig.json
```

## Deployment

### Local devnet (default)

```bash
npm run setup
npm run cli
```

### Public testnet (preview / preprod)

```bash
npm run setup -- --network preview
# Fund wallet from faucet when prompted
npm run cli
```

### Netlify (static landing page)

The `public/` directory contains a landing page that documents the project.
Deploy to Netlify by connecting the git repository or drag-and-drop `public/`
at https://app.netlify.com.

```bash
npx netlify deploy --prod --dir=public
```

## Available scripts

| Script                  | Description                                                    |
| ----------------------- | -------------------------------------------------------------- |
| `npm run setup`         | One-shot: start devnet, compile, deploy.                       |
| `npm run compile`       | Compile the Compact contract.                                  |
| `npm run deploy`        | Deploy the compiled contract (provides the witness impl).      |
| `npm run cli`           | Interactive CLI to call circuits on the deployed contract.     |
| `npm run check-balance` | Print the genesis-seed wallet's NIGHT and DUST balances.       |
| `npm run test:e2e`      | Smoke + read-back check against the deployed contract.         |
| `npm run clean`         | Remove generated artifacts.                                    |
| `npm run proof-server:start` / `:stop` | Compose lifecycle for the proof-server.           |

## Networks

| Network     | Use case                                                                    | Default |
| ----------- | --------------------------------------------------------------------------- | ------- |
| `undeployed`| Local devnet (`docker-compose.yml`). Genesis seed is hardcoded.             | yes     |
| `preview`   | Public preview testnet ([faucet](https://midnight-tmnight-preview.nethermind.dev)). |         |
| `preprod`   | Public preprod testnet ([faucet](https://midnight-tmnight-preprod.nethermind.dev)).  |         |

The active network is **sticky** — switch with `--network <name>` or
`npm run network <name>`.

## Environment overrides

| Variable                         | Effect                                               |
| -------------------------------- | ---------------------------------------------------- |
| `MIDNIGHT_WALLET_SEED`           | Override the wallet seed (CI / pre-funded wallets).  |
| `MIDNIGHT_INDEXER_URL`           | Override the indexer GraphQL URL.                    |
| `MIDNIGHT_INDEXER_WS_URL`        | Override the indexer WebSocket URL.                  |
| `MIDNIGHT_NODE_URL`              | Override the node RPC URL.                           |
| `MIDNIGHT_FAUCET_URL`            | Override the faucet URL.                             |
| `MIDNIGHT_PROOF_SERVER_URL`      | Use a remote proof server (e.g. Lace public).        |
| `MIDNIGHT_FAUCET_TIMEOUT_MS`     | Faucet poll budget in ms (default 600000 = 10 min).  |
