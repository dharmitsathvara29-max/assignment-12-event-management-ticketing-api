const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let db;

if (!admin.apps.length) {
  try {
    let serviceAccount;

    // Mode 1: Production — read from environment variable
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    }
    // Mode 2: Local dev — load from serviceAccountKey.json or any firebase-adminsdk*.json file
    else {
      const rootDir = path.join(__dirname, '..');
      const directKeyPath = path.join(rootDir, 'serviceAccountKey.json');

      if (fs.existsSync(directKeyPath)) {
        serviceAccount = require(directKeyPath);
      } else {
        const matchingFile = fs
          .readdirSync(rootDir)
          .find((f) => f.endsWith('.json') && (f.includes('firebase-adminsdk') || f.includes('serviceAccount')));

        if (matchingFile) {
          serviceAccount = require(path.join(rootDir, matchingFile));
        } else {
          throw new Error(
            'Firebase credentials not found. Either set FIREBASE_SERVICE_ACCOUNT_JSON env var ' +
            'or place serviceAccountKey.json (or your downloaded Firebase JSON key) in the project root.'
          );
        }
      }
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log('✅ Firebase Admin initialized successfully');
  } catch (err) {
    console.error('❌ Firebase initialization error:', err.message);
    process.exit(1);
  }
}

db = admin.firestore();

module.exports = { db, admin };
