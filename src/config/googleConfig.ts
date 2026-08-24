import firebaseConfig from '../../firebase-applet-config.json';

export const GOOGLE_CONFIG = {
  clientId:
    (firebaseConfig as any).oAuthClientId ||
    '552551780325-phn5nrr9ph06mfud173csp4nmc7gvof7.apps.googleusercontent.com',
  scopes: [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ].join(' '),
  rootFolderName: 'GaleriFotoQR',
  albumFolderName: 'Album Pelanggan',
  appDataFolderName: 'App Data',
};

export const FIREBASE_APP_CONFIG = firebaseConfig;

