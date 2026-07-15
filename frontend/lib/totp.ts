import crypto from 'crypto';

// Decode base32 string to Buffer
function base32Decode(base32: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let index = 0;
  
  // Allocate buffer size based on base32 length conversion ratio (5 bytes for every 8 base32 characters)
  const output = Buffer.alloc(Math.ceil((base32.length * 5) / 8));
  
  // Clean up padding characters
  const cleaned = base32.toUpperCase().replace(/=+$/, '');
  
  for (let i = 0; i < cleaned.length; i++) {
    const val = alphabet.indexOf(cleaned[i]);
    if (val === -1) {
      throw new Error('Invalid base32 character');
    }
    value = (value << 5) | val;
    bits += 5;
    if (bits >= 8) {
      output[index++] = (value >> (bits - 8)) & 0xFF;
      bits -= 8;
    }
  }
  return output.slice(0, index);
}

/**
 * Verifies a 6-digit TOTP code against a Base32 secret key.
 * Allows a look-ahead/look-behind window of 1 time-step (30 seconds) to account for client-server time drifts.
 */
export function verifyTOTP(token: string, secret: string): boolean {
  try {
    const key = base32Decode(secret);
    const epoch = Math.floor(Date.now() / 1000);
    const timeStep = Math.floor(epoch / 30);
    
    // Verify current step, previous step (-1), and next step (+1) for time drift tolerance
    for (let i = -1; i <= 1; i++) {
      const time = timeStep + i;
      const buffer = Buffer.alloc(8);
      
      // Write 64-bit integer big-endian representation of time step
      buffer.writeUInt32BE(Math.floor(time / 0x100000000), 0);
      buffer.writeUInt32BE(time % 0x100000000, 4);
      
      // Generate HMAC-SHA1
      const hmac = crypto.createHmac('sha1', key).update(buffer).digest();
      
      // Dynamic truncation
      const offset = hmac[hmac.length - 1] & 0xf;
      const code = ((hmac[offset] & 0x7f) << 24) |
                   ((hmac[offset + 1] & 0xff) << 16) |
                   ((hmac[offset + 2] & 0xff) << 8) |
                   (hmac[offset + 3] & 0xff);
      
      const totp = (code % 1000000).toString().padStart(6, '0');
      if (totp === token) {
        return true;
      }
    }
    return false;
  } catch (e) {
    console.error('Error verifying TOTP code:', e);
    return false;
  }
}
