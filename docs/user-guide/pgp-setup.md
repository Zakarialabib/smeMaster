# SMEMaster — PGP Setup Guide

## What is PGP?

Pretty Good Privacy (PGP) allows you to encrypt and sign your emails so that only the intended recipient can read them. SMEMaster supports PGP encryption for all outgoing and incoming emails.

## Generating a New Key

1. Open Settings → Security & Data → PGP
2. Click "Generate New Key"
3. Enter your name and email address
4. Choose a key strength (2048 or 4096 bits)
5. Enter a strong passphrase
6. Click "Generate"
7. Wait for key generation to complete

## Importing an Existing Key

1. Open Settings → Security & Data → PGP
2. Click "Import Key"
3. Paste your ASCII-armored private key
4. Enter your passphrase
5. Click "Import"

## Exporting Your Public Key

Share your public key with contacts so they can send you encrypted emails:

1. Open Settings → Security & Data → PGP
2. Click "Export Public Key"
3. Copy the key or save it to a file

## Encrypting an Email

1. Compose a new email
2. Click the lock icon to enable encryption
3. The email will be encrypted before sending
4. The recipient needs your public key to decrypt

## Decrypting an Email

SMEMaster automatically decrypts emails sent to you if you have the corresponding private key.

## Key Management Best Practices

- **Backup your keys**: Export your private key and store it securely
- **Use strong passphrases**: At least 16 characters with mixed case, numbers, and symbols
- **Never share your private key**: Only share your public key
- **Revoke lost keys**: Generate a revocation certificate and store it safely