import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const newToken = process.argv[2];

if (!newToken) {
  console.log(`
===================================================================
🔧 UTILIDAD DE ACTUALIZACIÓN DE TOKEN GOOGLE DRIVE - TRIMEC SpA
===================================================================

Uso:
  node scripts/actualizar_drive_token.mjs <TU_NUEVO_REFRESH_TOKEN>

Ejemplo:
  node scripts/actualizar_drive_token.mjs 1//042jnO0sqhj...

Este script actualizará de forma segura la variable GOOGLE_REFRESH_TOKEN
tanto en backend/.env como en .env.local sin alterar las otras claves.
===================================================================
`);
  process.exit(1);
}

const envFiles = [
  path.join(rootDir, 'backend', '.env'),
  path.join(rootDir, '.env.local')
];

let updatedCount = 0;

for (const envPath of envFiles) {
  if (fs.existsSync(envPath)) {
    let content = fs.readFileSync(envPath, 'utf8');
    if (content.includes('GOOGLE_REFRESH_TOKEN=')) {
      content = content.replace(/GOOGLE_REFRESH_TOKEN=.*(\r?\n|$)/, `GOOGLE_REFRESH_TOKEN=${newToken.trim()}\n`);
    } else {
      content += `\nGOOGLE_REFRESH_TOKEN=${newToken.trim()}\n`;
    }
    fs.writeFileSync(envPath, content, 'utf8');
    console.log(`✅ Token actualizado exitosamente en: ${envPath}`);
    updatedCount++;
  }
}

if (updatedCount === 0) {
  console.error('❌ No se encontraron archivos de entorno para actualizar.');
} else {
  console.log(`\n🎉 ¡Listo! GOOGLE_REFRESH_TOKEN actualizado en ${updatedCount} archivo(s).`);
}
