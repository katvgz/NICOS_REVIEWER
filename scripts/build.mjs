import {mkdir,copyFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const files=['index.html','styles.css','js/app.js','js/character.js','js/quiz.js','js/questions.js','js/question-selection.js','js/sounds.js','photos/character.png','photos/MSTE.png','photos/QS.png','photos/result.png'];
for(const folder of ['dist','dist/js','dist/photos'])await mkdir(folder,{recursive:true});
for(const file of files){await copyFile(file,`dist/${file}`);}
const source=await readFile('character.png');
const served=await readFile('photos/character.png');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
if(hash(source)!==hash(served))throw new Error('Character source must remain unchanged.');
console.log(`Build complete: ${files.length} files in dist/. Original character verified byte-for-byte.`);
