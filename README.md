# uwu-unstucker

A local Solana transaction rebuilder for claim flows where a web app generated a transaction, the browser wallet signed it, and the backend failed before co-signing or broadcasting it.

This is for the common sponsored-claim failure mode:

- the captured transaction has your wallet as a required signer
- another signer appears to be a sponsor, fee payer, or ATA payer
- the sponsor signature is missing, expired, or unusable
- the claim instruction itself only needs your wallet as the real claim authority

The page rebuilds the transaction with your wallet as the fee payer, removes sponsor SOL top-up transfers, rewrites sponsor-paid ATA creation to be paid by your wallet, asks Phantom to sign, simulates with signature verification, and only enables sending if simulation succeeds.

It does not ask for seed phrases or private keys.

## Run

```bash
cd uwu-unstucker
npm start
```

Open:

```text
http://127.0.0.1:8000/claim.html
```

The page defaults to `http://127.0.0.1:8000/rpc`, a same-origin proxy to `https://api.mainnet-beta.solana.com`. This avoids browser-origin `403 Access forbidden` responses from the public RPC.

To use another upstream mainnet RPC:

```bash
SOLANA_RPC_URL='https://your-mainnet-rpc.example' node server.mjs 8000
```

Use the same browser profile that has Phantom installed.

## Capture The Broken Transaction

1. Open the broken claim page.
2. Open browser DevTools.
3. Go to the Network tab.
4. Clear the Network log.
5. Click the site's claim button and let it fail.
6. Find the failed `POST` request. It often has status `500`.
7. Open the request details.
8. Check Payload, Request, or Request Payload.
9. Copy the serialized Solana transaction. It is usually a long base64 string.
10. Paste it into `Captured base64 transaction`.

Some sites wrap the transaction in JSON, for example:

```json
{ "transaction": "BASE64_TRANSACTION_HERE" }
```

You can paste the whole JSON body. The page will try to find the transaction string inside it.

Do not post the captured payload publicly. It can reveal wallet addresses, claim amounts, and project-specific account addresses.

## Use

1. Paste the captured request payload.
2. Click `Analyze pasted tx`.
3. Connect the same wallet that signed the original claim.
4. Click `Build, sign, simulate`.
5. Read the simulation result and logs.
6. Send only if simulation returns `OK`.

The send button stays disabled until the page has a signed transaction with a clean simulation. Sending still requires a browser confirmation.

## What It Can Fix

It can usually fix transactions where the only unavailable signer is a sponsor-style account used for:

- original fee payer
- associated token account payer
- SOL top-up transfer to the claimant wallet

It cannot bypass real authorization. If the on-chain program truly requires the sponsor as an authority signer, the rebuild will fail before signing or fail in simulation.

## Safety Notes

- Only paste a transaction from the claim page you were already trying to use.
- Do not paste seed phrases or private keys anywhere.
- Review Phantom's prompt before signing.
- A clean simulation is required, but it does not make a malicious pasted transaction safe.
- If simulation fails, do not send. Copy the full logs and inspect them.

## Inspect From Terminal

```bash
node inspect-raw.mjs '<base64 transaction>'
```

This prints the signature slots, static account keys, and compiled instruction layout without needing Phantom.
