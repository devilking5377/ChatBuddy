/**
 * Stores RSA keys in local storage
 */
export const storeKeys = (privateKey, publicKey) => {
  localStorage.setItem('privateKey', privateKey);
  localStorage.setItem('publicKey', publicKey);
};

/**
 * Retrieves RSA keys from local storage
 */
export const getStoredKeys = () => {
  const privateKey = localStorage.getItem('privateKey');
  const publicKey = localStorage.getItem('publicKey');
  return { privateKey, publicKey };
};

/**
 * Encrypts data with RSA public key using SubtleCrypto API
 */
export const encryptWithRSA = async (publicKeyPem, data) => {
  try {
    // Convert PEM to ArrayBuffer
    const publicKeyDER = pemToArrayBuffer(publicKeyPem);
    
    // Import the public key
    const publicKey = await window.crypto.subtle.importKey(
      'spki',
      publicKeyDER,
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256',
      },
      false,
      ['encrypt']
    );
    
    // Convert the data to ArrayBuffer
    const dataBuffer = new TextEncoder().encode(data);
    
    // Encrypt the data
    const encryptedData = await window.crypto.subtle.encrypt(
      {
        name: 'RSA-OAEP'
      },
      publicKey,
      dataBuffer
    );
    
    // Convert the encrypted data to base64
    return arrayBufferToBase64(encryptedData);
  } catch (error) {
    console.error('Error encrypting with RSA:', error);
    throw error;
  }
};

/**
 * Decrypts data with RSA private key using SubtleCrypto API
 */
export const decryptWithRSA = async (privateKeyPem, encryptedData) => {
  try {
    // Convert PEM to ArrayBuffer
    const privateKeyDER = pemToArrayBuffer(privateKeyPem, true);
    
    // Import the private key
    const privateKey = await window.crypto.subtle.importKey(
      'pkcs8',
      privateKeyDER,
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256',
      },
      false,
      ['decrypt']
    );
    
    // Convert the encrypted data from base64 to ArrayBuffer
    const encryptedBuffer = base64ToArrayBuffer(encryptedData);
    
    // Decrypt the data
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'RSA-OAEP'
      },
      privateKey,
      encryptedBuffer
    );
    
    // Convert the decrypted data to string
    return new TextDecoder().decode(decryptedBuffer);
  } catch (error) {
    console.error('Error decrypting with RSA:', error);
    throw error;
  }
};

/**
 * Generates a random AES key
 */
export const generateAESKey = async () => {
  const key = await window.crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );
  
  const keyData = await window.crypto.subtle.exportKey('raw', key);
  return arrayBufferToBase64(keyData);
};

/**
 * Encrypts data with AES key
 */
export const encryptWithAES = async (keyBase64, data) => {
  try {
    const keyBuffer = base64ToArrayBuffer(keyBase64);
    
    const key = await window.crypto.subtle.importKey(
      'raw',
      keyBuffer,
      {
        name: 'AES-GCM',
        length: 256,
      },
      false,
      ['encrypt']
    );
    
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const dataBuffer = new TextEncoder().encode(data);
    
    const encryptedBuffer = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
        tagLength: 128,
      },
      key,
      dataBuffer
    );
    
    // Split the encrypted data and auth tag
    const encryptedLength = encryptedBuffer.byteLength - 16; // Last 16 bytes are the auth tag
    const encryptedContent = encryptedBuffer.slice(0, encryptedLength);
    const authTag = encryptedBuffer.slice(encryptedLength);
    
    return {
      iv: arrayBufferToBase64(iv),
      encryptedData: arrayBufferToBase64(encryptedContent),
      authTag: arrayBufferToBase64(authTag)
    };
  } catch (error) {
    console.error('Error encrypting with AES:', error);
    throw error;
  }
};

/**
 * Decrypts data with AES key
 */
export const decryptWithAES = async (keyBase64, ivBase64, encryptedDataBase64, authTagBase64) => {
  try {
    const keyBuffer = base64ToArrayBuffer(keyBase64);
    const ivBuffer = base64ToArrayBuffer(ivBase64);
    const encryptedBuffer = base64ToArrayBuffer(encryptedDataBase64);
    const authTagBuffer = base64ToArrayBuffer(authTagBase64);
    
    // Combine encrypted content and auth tag
    const combinedBuffer = new Uint8Array(encryptedBuffer.byteLength + authTagBuffer.byteLength);
    combinedBuffer.set(new Uint8Array(encryptedBuffer), 0);
    combinedBuffer.set(new Uint8Array(authTagBuffer), encryptedBuffer.byteLength);
    
    const key = await window.crypto.subtle.importKey(
      'raw',
      keyBuffer,
      {
        name: 'AES-GCM',
        length: 256,
      },
      false,
      ['decrypt']
    );
    
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBuffer,
        tagLength: 128,
      },
      key,
      combinedBuffer
    );
    
    return new TextDecoder().decode(decryptedBuffer);
  } catch (error) {
    console.error('Error decrypting with AES:', error);
    throw error;
  }
};

// Helper functions
const pemToArrayBuffer = (pem, isPrivate = false) => {
  const pemHeader = isPrivate ? '-----BEGIN PRIVATE KEY-----' : '-----BEGIN PUBLIC KEY-----';
  const pemFooter = isPrivate ? '-----END PRIVATE KEY-----' : '-----END PUBLIC KEY-----';
  
  // Remove headers and newlines
  const pemContents = pem.replace(pemHeader, '')
                        .replace(pemFooter, '')
                        .replace(/\s/g, '');
  
  // Convert base64 to ArrayBuffer
  return base64ToArrayBuffer(pemContents);
};

const base64ToArrayBuffer = (base64) => {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

const arrayBufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};