import { google } from 'googleapis';
import { Readable } from 'stream';

const PARENT_FOLDER_ID = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID || '1-WvEKcnWOovvsfmRCNGGJ92b8TEEXJoz';

function getAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (clientId && clientSecret && refreshToken) {
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    return oauth2Client;
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (email && privateKey) {
    const formattedKey = privateKey.replace(/^"|"$/g, '').replace(/\\n/g, '\n');
    return new google.auth.JWT({
      email: email,
      key: formattedKey,
      scopes: ['https://www.googleapis.com/auth/drive']
    });
  }

  console.warn('Google Drive Service Account or OAuth2 credentials not configured.');
  return null;
}

export async function createDriveFolder(folderName) {
  const auth = getAuthClient();
  if (!auth) {
    console.warn('Google Drive credentials not configured. Skipping folder creation.');
    return null;
  }

  try {
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

export async function uploadFileToDrive(folderId, fileName, mimeType, buffer) {
  const auth = getAuthClient();
  if (!auth) {
    console.warn('Google Drive credentials not configured. Skipping file upload to Drive.');
    return null;
  }

  try {
    const drive = google.drive({ version: 'v3', auth });

    const bufferStream = new Readable();
    bufferStream.push(buffer);
    bufferStream.push(null);

    const fileMetadata = {
      name: fileName,
      parents: [folderId]
    };

    const media = {
      mimeType: mimeType,
      body: bufferStream
    };

    const response = await drive.files.create({
      auth,
      resource: fileMetadata,
      media: media,
      fields: 'id, webViewLink'
    });

    console.log(`File uploaded successfully to Google Drive: ${fileName} (ID: ${response.data.id})`);
    return response.data.webViewLink;
  } catch (error) {
    console.error('Error uploading file to Google Drive (API Error):', error.message || error);
    return null;
  }
}
