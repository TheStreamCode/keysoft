import * as Crypto from './crypto/cryptoService';
import * as Storage from './storage/storageService';
import * as Auth from './auth/authService';

export const MAX_PASSWORDS_LIMIT = Storage.MAX_PASSWORDS_LIMIT;

export { Crypto, Storage, Auth };
