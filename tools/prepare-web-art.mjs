// Format/size optimization only: no crop, recolor or change to layout/alpha.
import sharp from 'sharp';
import {stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const names=['ground-v2','case-brown','case-lid','tray-commission','wallet-commission','welcome-backplate-v3'];
for(const name of names){
 const input=new URL(`../public/art/game-v2/${name}.png`,import.meta.url),output=new URL(`../public/art/game-v2/${name}.webp`,import.meta.url);
 await sharp(fileURLToPath(input)).webp({quality:90,alphaQuality:100,effort:6}).toFile(fileURLToPath(output));
 console.log(name,(await stat(input)).size,'->',(await stat(output)).size);
}
