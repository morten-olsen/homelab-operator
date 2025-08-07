import * as crypto from 'crypto';

import type { GenerateSecretField, GenerateSecretSpec } from './generate-secret.schemas.ts';

const generateRandomString = (length: number, encoding: GenerateSecretField['encoding']): string => {
  let byteLength = 0;
  switch (encoding) {
    case 'base64':
    case 'base64url':
      // Base64 uses 4 characters for every 3 bytes, so we'll generate slightly more bytes
      // than the final length to ensure we can get a string of at least the required length.
      byteLength = Math.ceil((length * 3) / 4);
      break;
    case 'hex':
      byteLength = Math.ceil(length / 2);
      break;
    case 'numeric':
    case 'utf8':
      byteLength = length;
      break;
  }

  const randomBytes = crypto.randomBytes(byteLength);

  let resultString = '';

  switch (encoding) {
    case 'base64':
      resultString = randomBytes.toString('base64');
      break;
    case 'base64url':
      resultString = randomBytes.toString('base64url');
      break;
    case 'hex':
      resultString = randomBytes.toString('hex');
      break;
    case 'numeric':
      resultString = Array.from(randomBytes)
        .map((b) => (b % 10).toString()) // Get a single digit from each byte
        .join('');
      break;
    case 'utf8':
      resultString = randomBytes.toString('utf8');
      break;
  }

  return resultString.slice(0, length);
};

const generateSecrets = (spec: GenerateSecretSpec): Record<string, string> => {
  const secrets: Record<string, string> = {};

  for (const field of spec.fields) {
    if (field.value !== undefined) {
      // If a value is provided, use it directly.
      secrets[field.name] = field.value;
    } else {
      // Generate a new secret based on the specification.
      // Use default values if encoding or length are not provided.
      const encoding = field.encoding || 'base64url';
      const length = field.length || 32;
      secrets[field.name] = generateRandomString(length, encoding);
    }
  }

  return secrets;
};

export { generateRandomString, generateSecrets };
