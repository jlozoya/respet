import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(mobileRoot, 'resources', 'icon.svg');

const squareIcons = [
  ['resources/icon.png', 1024],
  ['resources/android/icon/drawable-ldpi-icon.png', 36],
  ['resources/android/icon/drawable-mdpi-icon.png', 48],
  ['resources/android/icon/drawable-hdpi-icon.png', 72],
  ['resources/android/icon/drawable-xhdpi-icon.png', 96],
  ['resources/android/icon/drawable-xxhdpi-icon.png', 144],
  ['resources/android/icon/drawable-xxxhdpi-icon.png', 192],
  ['resources/ios/icon/icon.png', 57],
  ['resources/ios/icon/icon@2x.png', 114],
  ['resources/ios/icon/icon-small.png', 29],
  ['resources/ios/icon/icon-small@2x.png', 58],
  ['resources/ios/icon/icon-small@3x.png', 87],
  ['resources/ios/icon/icon-40.png', 40],
  ['resources/ios/icon/icon-40@2x.png', 80],
  ['resources/ios/icon/icon-40@3x.png', 120],
  ['resources/ios/icon/icon-50.png', 50],
  ['resources/ios/icon/icon-50@2x.png', 100],
  ['resources/ios/icon/icon-60.png', 60],
  ['resources/ios/icon/icon-60@2x.png', 120],
  ['resources/ios/icon/icon-60@3x.png', 180],
  ['resources/ios/icon/icon-72.png', 72],
  ['resources/ios/icon/icon-72@2x.png', 144],
  ['resources/ios/icon/icon-76.png', 76],
  ['resources/ios/icon/icon-76@2x.png', 152],
  ['resources/ios/icon/icon-83.5@2x.png', 167],
  ['resources/ios/icon/icon-1024.png', 1024],
  ['src/assets/icon/favicon.png', 64],
  ['src/assets/imgs/icon.png', 1024],
];

for (const [relativePath, size] of squareIcons) {
  const output = path.join(mobileRoot, relativePath);
  await mkdir(path.dirname(output), { recursive: true });
  await sharp(source, { density: 512 })
    .resize(size, size, { fit: 'cover' })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(output);
}

const legacyAppIcon = path.join(mobileRoot, 'src/assets/imgs/appicon.png');
await sharp(source, { density: 512 })
  .resize(170, 170, { fit: 'cover' })
  .extend({
    top: 15,
    bottom: 15,
    left: 0,
    right: 0,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png({ compressionLevel: 9 })
  .toFile(legacyAppIcon);

const iconContents = await readFile(path.join(mobileRoot, 'resources/icon.png'));
const checksum = createHash('md5').update(iconContents).digest('hex');
await writeFile(path.join(mobileRoot, 'resources/icon.png.md5'), `${checksum}\n`, 'utf8');

console.log(`Generated ${squareIcons.length + 1} icon assets from resources/icon.svg.`);
