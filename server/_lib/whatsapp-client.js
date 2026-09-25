/**
 * whatsapp-client.js
 * Persistent WhatsApp Web session using whatsapp-web.js.
 * Uses global state to survive Vite's cache-busted dynamic re-imports.
 * First run → prints QR in terminal → scan once → stays linked forever.
 */
import { createRequire } from 'module'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import os from 'os'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Store outside the project so Vite's file watcher never touches Chromium's locked files
const SESSION_DIR = path.join(os.homedir(), '.turfon24-wa-session')

// ── Persist state in global so Vite's cache-busted re-imports don't reset it ──
if (!global.__waState) {
  global.__waState = { client: null, ready: false, initPromise: null }
}
const G = global.__waState

function init() {
  if (G.initPromise) return G.initPromise
  G.initPromise = new Promise((resolve) => {
    try {
      const { Client, LocalAuth } = require('whatsapp-web.js')
      const qrcode = require('qrcode-terminal')

      if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true })

      G.client = new Client({
        authStrategy: new LocalAuth({ dataPath: SESSION_DIR }),
        puppeteer: {
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        },
      })

      G.client.on('qr', (qr) => {
        console.log('\n\n========================================')
        console.log('  SCAN THIS QR CODE WITH WHATSAPP')
        console.log('  (Settings → Linked Devices → Link a Device)')
        console.log('========================================\n')
        qrcode.generate(qr, { small: true })
        console.log('\n========================================\n')
      })

      G.client.on('ready', () => {
        G.ready = true
        console.log('[WhatsApp] ✅ Client is ready — messages will now send automatically.')
        resolve(G.client)
      })

      G.client.on('auth_failure', (msg) => {
        console.error('[WhatsApp] Auth failure:', msg)
        G.ready = false
        G.initPromise = null
      })

      G.client.on('disconnected', () => {
        console.warn('[WhatsApp] Disconnected. Will re-init on next request.')
        G.ready = false
        G.initPromise = null
        G.client = null
      })

      G.client.initialize().catch((err) => {
        console.error('[WhatsApp] initialize error:', err.message)
        G.initPromise = null
      })
    } catch (err) {
      console.error('[WhatsApp] whatsapp-web.js not available:', err.message)
      resolve(null)
    }
  })
  return G.initPromise
}

/**
 * Send an image (absolute file path) to a WhatsApp number.
 * @param {string} to       e.g. '917358951722'
 * @param {string} filePath absolute path to image file
 * @param {string} caption  optional caption text
 */
export async function sendImage(to, filePath, caption = '') {
  const { MessageMedia } = require('whatsapp-web.js')
  const c = await init()
  if (!c || !G.ready) throw new Error('WhatsApp client not ready yet — please scan the QR code in the terminal first.')
  const media = MessageMedia.fromFilePath(filePath)
  const chatId = to.replace(/\D/g, '') + '@c.us'
  await c.sendMessage(chatId, media, { caption })
}

/**
 * Send a plain text message to a WhatsApp number.
 * @param {string} to   e.g. '917358951722'
 * @param {string} text
 */
export async function sendText(to, text) {
  const c = await init()
  if (!c || !G.ready) throw new Error('WhatsApp client not ready yet.')
  const chatId = to.replace(/\D/g, '') + '@c.us'
  await c.sendMessage(chatId, text)
}

// Auto-start (only once — guard prevents double-init via global)
init()
