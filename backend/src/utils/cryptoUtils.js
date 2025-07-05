import crypto from 'crypto';

// Generate RSA key pair
export const generateRSAKeyPair = () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });
  
  return { publicKey, privateKey };
};

// Encrypt data with RSA public key
export const encryptWithRSA = (publicKey, data) => {
  const encryptedData = crypto.publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(data)
  );
  
  return encryptedData.toString('base64');
};

// Decrypt data with RSA private key
export const decryptWithRSA = (privateKey, encryptedData) => {
  const decryptedData = crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(encryptedData, 'base64')
  );
  
  return decryptedData.toString();
};

// Generate AES key
export const generateAESKey = () => {
  return crypto.randomBytes(32).toString('base64'); // 256-bit key
};

// Encrypt with AES
export const encryptWithAES = (key, data) => {
  const iv = crypto.randomBytes(16); // Initialization vector
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key, 'base64'), iv);
  
  let encrypted = cipher.update(data, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  // Get the authentication tag
  const authTag = cipher.getAuthTag().toString('base64');
  
  // Return IV, encrypted data, and auth tag
  return {
    iv: iv.toString('base64'),
    encryptedData: encrypted,
    authTag
  };
};

// Decrypt with AES
export const decryptWithAES = (key, iv, encryptedData, authTag) => {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm', 
    Buffer.from(key, 'base64'), 
    Buffer.from(iv, 'base64')
  );
  
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));
  
  let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};