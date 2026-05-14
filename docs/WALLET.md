# Wallet passes (Apple & Google)

Members can keep a **backup of their library card** in Apple Wallet when the deployment
has Apple Pass signing configured. This is optional: forks that do not set the env vars
simply do not show the button.

## Apple Wallet (PassKit)

Apple requires every `.pkpass` file to be **cryptographically signed** with:

- A **Pass Type ID** registered in the Apple Developer Program
- Your **Team ID**
- The **Apple WWDR intermediate** certificate
- A **pass signing certificate** + private key linked to that Pass Type ID

There is no supported way to add a pass to Apple Wallet without these credentials.
Third-party “pass as a service” products exist, but this app implements signing **on
your own server** so card data never transits a vendor you do not control.

### What the built-in pass contains

- **Front:** cardholder name, card number, QR code that opens `{origin}/settings?mode=login`
- **Back:** PIN and short instructions for logging in on a new device

The QR does **not** embed the PIN (only the login page URL). The pass still stores the
PIN on the back of the pass, similar to writing it on a paper backup — treat the pass
like a physical card.

### Environment variables

Set all of the following in **Vercel** (or `.env.local` for self-host). PEM values can
use literal `\n` for newlines when pasted on one line.

| Variable | Required | Purpose |
|----------|----------|---------|
| `APPLE_WALLET_PASS_TYPE_ID` | Yes | e.g. `pass.com.yourorg.library` |
| `APPLE_WALLET_TEAM_ID` | Yes | 10-character Apple Team ID |
| `APPLE_WALLET_ORGANIZATION_NAME` | No | Shown on the pass (default: `Library of Things`) |
| `APPLE_WALLET_WWDR_PEM` | Yes* | Full PEM text of Apple WWDR G4 (or G3) intermediate |
| `APPLE_WALLET_SIGNER_CERT_PEM` | Yes* | PEM of your pass signing certificate |
| `APPLE_WALLET_SIGNER_KEY_PEM` | Yes* | PEM of the signing private key |
| `APPLE_WALLET_SIGNER_KEY_PASSPHRASE` | No | If the key file is encrypted |

\*Alternatively, for local development you can point at files instead of inline PEM:

- `APPLE_WALLET_WWDR_PATH`
- `APPLE_WALLET_SIGNER_CERT_PATH`
- `APPLE_WALLET_SIGNER_KEY_PATH`

Paths are resolved relative to the project root unless absolute.

### Certificate setup (summary)

1. Enroll in the [Apple Developer Program](https://developer.apple.com/programs/).
2. Create a **Pass Type ID** in Certificates, Identifiers & Profiles.
3. Create a **Pass Type ID Certificate** and export as `.p12`, then convert to PEM
   with OpenSSL (see the [passkit-generator wiki](https://github.com/alexandercerutti/passkit-generator/wiki/Generating-Certificates)).
4. Download the **WWDR** intermediate from Apple and PEM-encode it.
5. Deploy the PEM strings (or paths) in env as above.

### API

- `POST /api/wallet/apple-library-pass` — requires a valid `lot_session` cookie and JSON
  `{ "card_number": "…", "pin": "…" }` that matches the logged-in user. Returns
  `application/vnd.apple.pkpass`.

### Operational notes

- **HTTPS:** In production the pass endpoint refuses non-HTTPS origins so Wallet URLs stay valid.
- **Regenerate pass:** If the user changes PIN in the future, they should remove the old pass and add again (no push-update service is implemented).

## Google Wallet

**Save to Google Wallet** for a custom loyalty-style object is **not** implemented in
this codebase. Google’s flow expects a backend using the [Google Wallet API](https://developers.google.com/wallet) with a Google Cloud project, service account, and JWT
signing to build a “save link”. That is a larger integration than Apple’s single-file
`.pkpass` download.

If you need Google Wallet for your fork, plan on:

1. Creating a Google Cloud project and enabling the Wallet API.
2. Issuer ID + service account JSON on the server.
3. A new API route that mints a one-time “Add to Google Wallet” URL after the same
   session + PIN checks as the Apple route.

Until then, Android users can still use **screenshot / copy** of card number + PIN, or
a password manager note.
