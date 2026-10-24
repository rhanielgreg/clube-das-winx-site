import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const [profileSource, bannerSource] = process.argv.slice(2);
if (!profileSource || !bannerSource) {
  console.error('Uso: npm run prepare-assets -- <perfil.png> <banner.png>');
  process.exit(1);
}

const outputDir = path.join(process.cwd(), 'public', 'assets');
await mkdir(outputDir, { recursive: true });

await Promise.all([
  sharp(profileSource)
    .resize(768, 768, { fit: 'cover', position: 'centre', withoutEnlargement: true })
    .webp({ quality: 86, effort: 6 })
    .toFile(path.join(outputDir, 'winx-zomboid-profile.webp')),
  sharp(bannerSource)
    .resize(1800, 1080, { fit: 'cover', position: 'centre', withoutEnlargement: true })
    .webp({ quality: 88, effort: 6 })
    .toFile(path.join(outputDir, 'winx-zomboid-banner.webp')),
]);

console.log(`Assets preparados em ${outputDir}`);
