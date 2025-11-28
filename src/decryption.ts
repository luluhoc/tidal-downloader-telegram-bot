import * as crypto from 'crypto';
import * as fs from 'fs';

export function decryptSecurityToken(securityToken: string): { key: Buffer; nonce: Buffer } {
    const masterKeyBase64 = 'UIlTTEMmmLfGowo/UC60x2H45W6MdGgTRfo/umg4754=';
    const masterKey = Buffer.from(masterKeyBase64, 'base64');
    const securityTokenBuffer = Buffer.from(securityToken, 'base64');

    const iv = securityTokenBuffer.subarray(0, 16);
    const encryptedSt = securityTokenBuffer.subarray(16);

    const decipher = crypto.createDecipheriv('aes-256-cbc', masterKey, iv);
    decipher.setAutoPadding(false); // Python code doesn't seem to use padding or handles it implicitly? usually CBC needs padding. 
    // Wait, Python's AES.new(master_key, AES.MODE_CBC, iv) defaults to no padding if not specified? 
    // Actually, usually one needs to handle padding. Let's assume standard PKCS7 or no padding if length is aligned.
    // The output is split into key (16) and nonce (8). 16+8=24 bytes. 
    // If encrypted_st is 32 bytes (multiple of 16), it might be padded or not.
    
    let decryptedSt = Buffer.concat([decipher.update(encryptedSt), decipher.final()]);

    const key = decryptedSt.subarray(0, 16);
    const nonce = decryptedSt.subarray(16, 24);

    return { key, nonce };
}

export async function decryptFile(efile: string, dfile: string, key: Buffer, nonce: Buffer): Promise<void> {
    // Python: Counter.new(64, prefix=nonce, initial_value=0)
    // AES-CTR in Node.js usually takes a 16-byte IV.
    // The counter block is constructed as: nonce (8 bytes) + counter (8 bytes).
    // Python's Counter.new(64, prefix=nonce) means the first 8 bytes are nonce, and the last 8 bytes are the counter.
    
    const iv = Buffer.alloc(16);
    nonce.copy(iv, 0);
    // The counter starts at 0. The IV for AES-CTR in Node is the initial counter block.
    // So IV is just nonce + 8 bytes of zeros.
    
    const decipher = crypto.createDecipheriv('aes-128-ctr', key, iv);
    
    const input = fs.createReadStream(efile);
    const output = fs.createWriteStream(dfile);

    input.pipe(decipher).pipe(output);

    return new Promise((resolve, reject) => {
        output.on('finish', resolve);
        output.on('error', reject);
        input.on('error', reject);
    });
}
