/**
 * server/whatsapp-notify.js
 * API endpoint: POST /api/whatsapp-notify
 * Sends booking confirmation + UPI QR image to the admin WhatsApp number.
 */
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ADMIN_WA_NUMBER = '917358951722'
const QR_IMAGE_PATH = path.join(__dirname, '../public/logo-assets/upi-qr.png')

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' })
  }

  const { name, date, timing, duration, amount } = req.body || {}

  const caption = [
    `*Turfon24 – Payment Confirmation*`,
    `Player: ${name || '—'}`,
    `Date: ${date || '—'}`,
    `Timing: ${timing || '—'}`,
    `Duration: ${duration || '—'}`,
    `Amount: ₹${amount || '—'}`,
    ``,
    `Please verify the payment and confirm the booking.`,
  ].join('\n')

  try {
    const { sendImage } = await import('./_lib/whatsapp-client.js')
    await sendImage(ADMIN_WA_NUMBER, QR_IMAGE_PATH, caption)
    return res.status(200).json({ success: true, message: 'WhatsApp notification sent.' })
  } catch (err) {
    console.error('[whatsapp-notify] Error:', err.message)
    return res.status(500).json({ success: false, message: err.message })
  }
}
