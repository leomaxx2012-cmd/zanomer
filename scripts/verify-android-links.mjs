import { readFile } from 'node:fs/promises';
import { X509Certificate } from 'node:crypto';

// Read the public signing certificate from APK Signature Scheme v2. This does
// not read or publish the private signing key. CI checks the built APK against
// the website association rather than assuming the signing key stayed the same.
const apk = await readFile(process.argv[2]);
let eocd = -1;
for (let at = apk.length - 22; at >= Math.max(0, apk.length - 65557); at--) {
  if (apk.readUInt32LE(at) === 0x06054b50 && at + 22 + apk.readUInt16LE(at + 20) === apk.length) { eocd = at; break; }
}
if (eocd < 0) throw new Error('APK ZIP directory not found');
const directory = apk.readUInt32LE(eocd + 16);
if (apk.subarray(directory - 16, directory).toString() !== 'APK Sig Block 42') throw new Error('APK signing block not found');
const size = Number(apk.readBigUInt64LE(directory - 24));
const start = directory - size - 8;
if (start < 0 || Number(apk.readBigUInt64LE(start)) !== size) throw new Error('Invalid APK signing block');
function field(buffer, offset = 0) {
  const length = buffer.readUInt32LE(offset);
  if (offset + 4 + length > buffer.length) throw new Error('Invalid APK signature field');
  return { bytes: buffer.subarray(offset + 4, offset + 4 + length), end: offset + 4 + length };
}
let certificate;
for (let at = start + 8; at < directory - 24;) {
  const length = Number(apk.readBigUInt64LE(at));
  if (length < 4 || at + 8 + length > directory - 24) throw new Error('Invalid APK signature pair');
  if (apk.readUInt32LE(at + 8) === 0x7109871a) {
    const signers = field(apk.subarray(at + 12, at + 8 + length)).bytes;
    const signer = field(signers).bytes;
    const signed = field(signer).bytes;
    const digests = field(signed);
    const certificates = field(signed, digests.end).bytes;
    certificate = new X509Certificate(field(certificates).bytes);
    break;
  }
  at += 8 + length;
}
if (!certificate) throw new Error('APK v2 certificate not found');
const fingerprint = certificate.fingerprint256;
console.log(`APK signing SHA-256: ${fingerprint}`);
if (process.argv[3] !== '--print') {
  const associations = JSON.parse(await readFile('public/.well-known/assetlinks.json', 'utf8'));
  const config = JSON.parse(await readFile('app.json', 'utf8'));
  const matching = associations.some(item => item.target?.package_name === config.expo.android.package
    && item.relation?.includes('delegate_permission/common.handle_all_urls')
    && item.target?.sha256_cert_fingerprints?.includes(fingerprint));
  if (!matching) throw new Error('APK signing certificate does not match website App Links association');
  console.log('Android App Links signing certificate matches the website.');
}
