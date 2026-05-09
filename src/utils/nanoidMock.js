// nanoidMock.js
// Simplified nanoid/non-secure implementation for compatibility issues
// Generate random alphanumeric IDs

// Caratteri utilizzati per generare gli ID (alfanumerici)
const ExpoCrypto = require('expo-crypto');
const urlAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function randomIndex(maxExclusive) {
  const bytes = ExpoCrypto.getRandomBytes(4);
  const value = ((bytes[0] << 24) >>> 0) + (bytes[1] << 16) + (bytes[2] << 8) + bytes[3];
  return value % maxExclusive;
}

/**
 * Generates a random ID with the requested length
 * @param {number} size - Lunghezza dell'ID da generare (default: 21)
 * @returns {string} - Generated random ID
 */
function nanoid(size = 21) {
  let id = '';
  // Crea un array della dimensione corretta e riempilo con caratteri casuali
  for (let i = 0; i < size; i++) {
    id += urlAlphabet.charAt(randomIndex(urlAlphabet.length));
  }
  return id;
}

module.exports = nanoid;
