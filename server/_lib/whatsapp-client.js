/**
 * whatsapp-client.js
 * Persistent WhatsApp Web session using @wppconnect-team/wppconnect.
 */
import { createRequire } from 'module'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import os from 'os'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

if (!global.__waState) {
  global.__waState = { client: null, ready: false, initPromise: null }
}
const G = global.__waState

function init() {
  if (G.initPromise) return G.initPromise
  G.initPromise = new Promise(async (resolve) => {
    try {
      const wppconnect = require('@wppconnect-team/wppconnect')

      const SESSION_DIR = path.join(os.homedir(), '.wppconnect-session')
      wppconnect
        .create({
          session: 'turfon24-bot',
          folderNameToken: SESSION_DIR,
          catchQR: (base64Qr, asciiQR, attempts, urlCode) => {
            const qrcode = require('qrcode')
            const qrPath = path.join(__dirname, '../../wa-qr.png')
            qrcode.toFile(qrPath, urlCode, { scale: 8 }, (err) => {
              if (err) {
                console.error('[WhatsApp] Failed to save QR code image:', err)
              } else {
                console.log('\n\n========================================')
                console.log('  [ACTION REQUIRED]')
                console.log(`  A new QR code has been saved to: wa-qr.png`)
                console.log('  Open the wa-qr.png file and scan it with WhatsApp.')
                console.log('========================================\n')
              }
            })
          },
          logQR: false,
          headless: true,
          autoClose: 0,
          puppeteerOptions: {
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
          }
        })
        .then((client) => {
          G.client = client
          G.ready = true
          console.log('[WhatsApp] ✅ WPPConnect Client is ready — messages will now send automatically.')
          resolve(G.client)
        })
        .catch((error) => {
          console.error('[WhatsApp] WPPConnect initialize error:', error)
          G.initPromise = null
          resolve(null)
        })

    } catch (err) {
      console.error('[WhatsApp] wppconnect not available:', err.message)
      resolve(null)
    }
  })
  return G.initPromise
}

/**
 * Send an image (absolute file path) to a WhatsApp number.
 */
export async function sendImage(to, filePath, caption = '') {
  const c = await init()
  if (!c || !G.ready) throw new Error('WhatsApp client not ready yet.')
  const chatId = to.replace(/\D/g, '') + '@c.us'
  await c.sendImage(chatId, filePath, 'upi-qr.png', caption)
}

/**
 * Send a plain text message to a WhatsApp number.
 */
export async function sendText(to, text) {
  const c = await init()
  if (!c || !G.ready) throw new Error('WhatsApp client not ready yet.')
  const chatId = to.replace(/\D/g, '') + '@c.us'
  await c.sendText(chatId, text)
}

init()
