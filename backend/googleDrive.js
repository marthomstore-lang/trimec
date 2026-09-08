import { google } from 'googleapis';
import { Readable } from 'stream';

const PARENT_FOLDER_ID = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID || '1-WvEKcnWOovvsfmRCNGGJ92b8TEEXJoz';

function getAuthClient() {
  // Priorizar Cuenta de Servicio (Service Account) verificada y con permisos
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

  // Fallback a OAuth2 si no hay cuenta de servicio
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (clientId && clientSecret && refreshToken) {
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    return oauth2Client;
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

    // 1. Buscar si la carpeta específica de la OT ya existe dentro de la carpeta raíz
    const escapedName = folderName.replace(/'/g, "\\'");
    const q = `'${PARENT_FOLDER_ID}' in parents and name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;

    const existing = await drive.files.list({
      q,
      fields: 'files(id, name, webViewLink)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });

    if (existing.data.files && existing.data.files.length > 0) {
      const existingFolder = existing.data.files[0];
      console.log(`Carpeta de OT existente encontrada en Google Drive: ${folderName} (ID: ${existingFolder.id})`);
      return `https://drive.google.com/drive/folders/${existingFolder.id}`;
    }

    // 2. Si no existe, crear la subcarpeta privada de la OT dentro de la carpeta raíz
    const fileMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [PARENT_FOLDER_ID]
    };

    const response = await drive.files.create({
      resource: fileMetadata,
      fields: 'id, webViewLink',
      supportsAllDrives: true
    });

    console.log(`Carpeta privada de OT creada con éxito en Google Drive: ${folderName} (ID: ${response.data.id})`);
    return `https://drive.google.com/drive/folders/${response.data.id}`;
  } catch (error) {
    console.error('Error al crear o buscar carpeta en Google Drive (API Error):', error.message || error);
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
      resource: fileMetadata,
      media: media,
      fields: 'id, webViewLink',
      supportsAllDrives: true
    });

    console.log(`Archivo subido exitosamente a Google Drive: ${fileName} (ID: ${response.data.id})`);
    return response.data.webViewLink || `https://drive.google.com/file/d/${response.data.id}/view`;
  } catch (error) {
    console.error('Error al subir archivo a Google Drive (API Error):', error.message || error);
    return null;
  }
}

export async function deleteFileFromDrive(fileId) {
  const auth = getAuthClient();
  if (!auth) {
    console.warn('Google Drive credentials not configured. Skipping file deletion from Drive.');
    return false;
  }

  try {
    const drive = google.drive({ version: 'v3', auth });
    await drive.files.delete({
      fileId: fileId,
      supportsAllDrives: true
    });
    console.log(`Archivo eliminado con éxito de Google Drive (ID: ${fileId})`);
    return true;
  } catch (error) {
    console.error('Error al eliminar archivo de Google Drive (API Error):', error.message || error);
    return false;
  }
}
