import { google } from 'googleapis';

const PARENT_FOLDER_ID = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID || '1-WvEKcnWOovvsfmRCNGGJ92b8TEEXJoz';

export async function createDriveFolder(folderName) {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !privateKey) {
    console.warn('Google Drive Service Account credentials not configured in .env. Skipping folder creation.');
    return null;
  }

  try {
    // Formatear la private key para limpiar comillas externas y reemplazar saltos de línea escapados
    const formattedKey = privateKey.replace(/^"|"$/g, '').replace(/\\n/g, '\n');

    const auth = new google.auth.JWT({
      email: email,
      key: formattedKey,
      scopes: ['https://www.googleapis.com/auth/drive']
    });

    const drive = google.drive({ version: 'v3', auth });

    const fileMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [PARENT_FOLDER_ID]
    };

    const response = await drive.files.create({
      auth,
      resource: fileMetadata,
      fields: 'id, webViewLink'
    });

    console.log(`Google Drive folder created successfully: ${folderName} (ID: ${response.data.id})`);
    
    return response.data.webViewLink;
  } catch (error) {
    console.error('Error creating folder in Google Drive (API Error):', error.message || error);
    return null;
  }
}
