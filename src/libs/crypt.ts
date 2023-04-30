require('dotenv').config();
import { decrypt, encrypt } from 'crypto-js/aes';
import { enc, format } from 'crypto-js/core';
import CustomError from './error_handler';

const encryptString = (plainString: string): string => {
	try {
		let encryptionKey = process.env.ENCRYPTION_KEY;
		if (!encryptionKey) {
			throw new CustomError('Encryption key not found', 500);
		}
		return encrypt(plainString, encryptionKey).toString(format.Hex);
	} catch (err) {
		throw err;
	}
};

const decryptString = (encryptedString: string): string => {
	try {
		let encryptionKey = process.env.ENCRYPTION_KEY;
		if (!encryptionKey) {
			throw new CustomError('Encryption key not found', 500);
		}
		return decrypt(encryptedString, encryptionKey).toString(enc.Utf8);
	} catch (err) {
		throw err;
	}
};

export { encryptString, decryptString };
