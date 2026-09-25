# WhatsApp Integration with WPPConnect

To reproduce this highly reliable WhatsApp image notification setup in another project, you can use the prompt below with any AI coding assistant, and provide them with the two files below.

## Prompt to send to the AI:

> "I want to set up an automated WhatsApp notification system in my Node.js/Vite backend to send a text message with an image attached. 
> 
> Due to Meta's aggressive anti-bot detection blocking headless Chromium from linking new devices, we MUST use `@wppconnect-team/wppconnect` (instead of `whatsapp-web.js`) and we MUST set `headless: false` along with `autoClose: 0`. This will open a visible Chromium window on the desktop so I can scan the QR code and bypass the blockade. We also need to store the session data outside the project directory (e.g., in `os.homedir() + '/.wppconnect-session'`) so the Vite development file-watcher doesn't crash from `EBUSY` locks. 
> 
> Please install `@wppconnect-team/wppconnect` and implement the two files provided below. Adapt the API endpoint and paths as needed for this specific project."

***

## 1. Install Dependencies
Run this in the project root:
```bash
npm install @wppconnect-team/wppconnect qrcode
```

## 2. Create the WhatsApp Client (`server/_lib/whatsapp-client.js`)
This file initializes the WhatsApp connection, saves the QR code locally using `qrcode` if it can't open the browser, and keeps the browser alive so you can scan it.

```javascript
/**
 * whatsapp-client.js
 * Persistent WhatsApp Web session using @wppconnect-team/wppconnect.
 */
import { createRequire } from 'module'
import path from 'path'
import { fileURLToPath } from 'url'
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

      // IMPORTANT: Store session outside of Vite project to avoid EBUSY crashes
      const SESSION_DIR = path.join(os.homedir(), '.wppconnect-session')
      
      wppconnect
        .create({
          session: 'my-whatsapp-bot',
          folderNameToken: SESSION_DIR,
          catchQR: (base64Qr, asciiQR, attempts, urlCode) => {
            const qrcode = require('qrcode')
            const qrPath = path.join(__dirname, '../../wa-qr.png') // Path where QR is saved
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
          headless: false, // CRITICAL: Bypass Meta's anti-bot headless detection
          autoClose: 0,    // CRITICAL: Give user unlimited time to scan the QR
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
  
  // Format Indian numbers properly (e.g. 917358951722 -> 917358951722@c.us)
  const chatId = to.replace(/\D/g, '') + '@c.us'
  
  // 3rd argument is the filename WhatsApp will display (doesn't have to match actual file)
  await c.sendImage(chatId, filePath, 'image.png', caption)
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

init() // Auto-start connection when backend spins up
```

## 3. Create the API Endpoint to use it (`server/whatsapp-notify.js`)
This is the file your frontend calls to trigger the notification.

```javascript
/**
 * API endpoint: POST /api/whatsapp-notify
 */
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Set the destination number and absolute path to the image
const ADMIN_WA_NUMBER = '91xxxxxxxxxx' // Add country code (e.g. 91 for India) without '+'
const QR_IMAGE_PATH = path.join(__dirname, '../public/my-image.png') 

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' })
  }

  // Example dynamic data from frontend
  const { name, amount } = req.body || {}

  const caption = [
    `*Notification Alert*`,
    `Name: ${name || '—'}`,
    `Amount: ₹${amount || '—'}`,
  ].join('\n')

  try {
    const { sendImage } = await import('./_lib/whatsapp-client.js')
    
    try {
      await sendImage(ADMIN_WA_NUMBER, QR_IMAGE_PATH, caption)
      return res.status(200).json({ success: true, message: 'WhatsApp notification sent with image.' })
    } catch (imageErr) {
      console.warn('[whatsapp-notify] Failed to send image, falling back to text:', imageErr.message)
      
      // Fallback behavior if image sending fails
      const { sendText } = await import('./_lib/whatsapp-client.js')
      const fallbackCaption = caption + '\n\n📸 *View Image:* https://mywebsite.com/my-image.png'
      await sendText(ADMIN_WA_NUMBER, fallbackCaption)
      
      return res.status(200).json({ success: true, message: 'WhatsApp notification sent as text fallback.' })
    }
  } catch (err) {
    console.error('[whatsapp-notify] Critical Error:', err.message)
    return res.status(500).json({ success: false, message: err.message })
  }
}
```
