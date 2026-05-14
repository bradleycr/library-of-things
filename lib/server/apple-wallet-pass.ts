import "server-only"

import { readFileSync, existsSync } from "node:fs"
import path from "node:path"
import { PKPass } from "passkit-generator"
import { getLibraryCardByNumberAndPin } from "@/lib/server/repositories"

function pemFromEnv(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined
  return raw.replace(/\\n/g, "\n").trim()
}

function readPemFile(filePath: string | undefined): string | undefined {
  if (!filePath?.trim()) return undefined
  const resolved = path.isAbsolute(filePath)
    ? filePath
    : path.join(process.cwd(), filePath)
  if (!existsSync(resolved)) return undefined
  return readFileSync(resolved, "utf8")
}

/**
 * Returns true when all required Apple Pass Type ID + signing material env vars
 * are present. Forks that skip Wallet leave these unset; the UI hides the button.
 */
export function isAppleWalletConfigured(): boolean {
  const passType = process.env.APPLE_WALLET_PASS_TYPE_ID?.trim()
  const team = process.env.APPLE_WALLET_TEAM_ID?.trim()
  const wwdr =
    pemFromEnv(process.env.APPLE_WALLET_WWDR_PEM) ??
    readPemFile(process.env.APPLE_WALLET_WWDR_PATH)
  const cert =
    pemFromEnv(process.env.APPLE_WALLET_SIGNER_CERT_PEM) ??
    readPemFile(process.env.APPLE_WALLET_SIGNER_CERT_PATH)
  const key =
    pemFromEnv(process.env.APPLE_WALLET_SIGNER_KEY_PEM) ??
    readPemFile(process.env.APPLE_WALLET_SIGNER_KEY_PATH)
  return Boolean(passType && team && wwdr && cert && key)
}

function getWalletCertificates(): {
  wwdr: string
  signerCert: string
  signerKey: string
  signerKeyPassphrase?: string
} {
  const wwdr =
    pemFromEnv(process.env.APPLE_WALLET_WWDR_PEM) ??
    readPemFile(process.env.APPLE_WALLET_WWDR_PATH)
  const signerCert =
    pemFromEnv(process.env.APPLE_WALLET_SIGNER_CERT_PEM) ??
    readPemFile(process.env.APPLE_WALLET_SIGNER_CERT_PATH)
  const signerKey =
    pemFromEnv(process.env.APPLE_WALLET_SIGNER_KEY_PEM) ??
    readPemFile(process.env.APPLE_WALLET_SIGNER_KEY_PATH)
  if (!wwdr || !signerCert || !signerKey) {
    throw new Error("APPLE_WALLET_CERTS_MISSING")
  }
  const passphrase = process.env.APPLE_WALLET_SIGNER_KEY_PASSPHRASE?.trim()
  return {
    wwdr,
    signerCert,
    signerKey,
    ...(passphrase ? { signerKeyPassphrase: passphrase } : {}),
  }
}

const MODEL_DIR = path.join(process.cwd(), "pass-templates", "library-card.pass")

/**
 * Build a signed .pkpass for the holder's library card.
 * Caller must verify session; this function also checks PIN + card ownership.
 */
export async function buildAppleLibraryCardPkpass(input: {
  sessionUserId: string
  cardNumber: string
  pin: string
  /** Absolute https URL origin for login deep link in QR (e.g. https://example.com). */
  publicOrigin: string
}): Promise<Buffer> {
  if (!isAppleWalletConfigured()) {
    throw new Error("APPLE_WALLET_NOT_CONFIGURED")
  }

  const row = await getLibraryCardByNumberAndPin(input.cardNumber, input.pin)
  if (!row || row.user_id !== input.sessionUserId) {
    throw new Error("CARD_AUTH_FAILED")
  }

  const passTypeId = process.env.APPLE_WALLET_PASS_TYPE_ID!.trim()
  const teamId = process.env.APPLE_WALLET_TEAM_ID!.trim()
  const orgName =
    process.env.APPLE_WALLET_ORGANIZATION_NAME?.trim() || "Library of Things"

  const origin = input.publicOrigin.replace(/\/$/, "")
  const loginUrl = `${origin}/settings?mode=login`

  const pass = await PKPass.from(
    {
      model: MODEL_DIR,
      certificates: getWalletCertificates(),
    },
    {
      serialNumber: row.id,
      teamIdentifier: teamId,
      passTypeIdentifier: passTypeId,
      organizationName: orgName,
      description: "Library of Things — library card",
    },
  )

  pass.setBarcodes({
    format: "PKBarcodeFormatQR",
    message: loginUrl,
    messageEncoding: "utf-8",
    altText: "Open login",
  })

  pass.primaryFields.push({
    key: "holder",
    label: "CARDHOLDER",
    value: row.pseudonym,
  })
  pass.secondaryFields.push({
    key: "cardno",
    label: "CARD NUMBER",
    value: row.card_number,
  })
  pass.backFields.push({
    key: "pin",
    label: "PIN",
    value: input.pin,
  })
  pass.backFields.push({
    key: "how",
    label: "New phone or browser?",
    value: `Open ${loginUrl}, choose Log in with card, then enter this card number and PIN. Keep this pass private — it is the same as your physical card credentials.`,
  })

  return pass.getAsBuffer()
}
