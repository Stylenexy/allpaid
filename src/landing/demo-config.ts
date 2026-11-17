import { decodeJar, jarCodeFromLink, validateJar } from '../lib/jar';

/** Only a valid public jar configuration can become a payable hero QR. */
export function demoConfig(path: string) {
  const code = jarCodeFromLink(path);
  const config = code ? decodeJar(code) : null;
  return config && config.net !== 'sandbox' && validateJar(config).length === 0 ? config : null;
}
