// Input is pdftotext -layout output from MSTE_Question_Bank_Exact_Definitions.pdf.
// Only PDF layout whitespace is normalized; wording, punctuation and keys are retained.
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const source=await readFile('artifacts/mste-source.txt','utf8');
const normalize=value=>value.replace(/\s+/g,' ').trim();
const blocks=[...source.replace(/\f/g,'\n').matchAll(/^\s*(\d+)\. ([\s\S]*?)(?=^\s*\d+\. |$(?![\s\S]))/gm)];
const questions=blocks.map(([,number,body])=>{
  const match=body.match(/^([\s\S]*?)^\s*A\. ([\s\S]*?)^\s*B\. ([\s\S]*?)^\s*C\. ([\s\S]*?)^\s*D\. ([\s\S]*?)^\s*Answer:\s*([\s\S]*?)\s*$/m);
  assert(match,`Cannot parse item ${number}`);
  assert.equal(match[0].trim(),body.trim(),`Unconsumed text in item ${number}`);
  const [,prompt,...rest]=match;
  const choices=rest.slice(0,4).map(normalize);
  const answer=normalize(rest[4]);
  const matches=choices.map((value,index)=>value===answer?index:-1).filter(index=>index!==-1);
  assert.equal(matches.length,1,`Item ${number}: answer ${JSON.stringify(answer)} must match exactly one choice: ${JSON.stringify(choices)}`);
  return {id:`mste-${number}`,text:normalize(prompt),choices,correctIndex:matches[0]};
});
assert.equal(questions.length,511,'Expected all 511 source items');
questions.forEach((question,index)=>assert.equal(question.id,`mste-${index+1}`));
await writeFile('js/questions.js',`// Exact PDF question bank: MSTE_Question_Bank_Exact_Definitions.pdf\n// Source numbering is retained in IDs. Only layout whitespace was normalized.\nexport const questionBank = ${JSON.stringify(questions,null,2)};\n`);
const prompts=new Map();
for(const question of questions){const ids=prompts.get(question.text)||[];ids.push(question.id);prompts.set(question.text,ids);}
console.log(JSON.stringify({items:questions.length,duplicatePrompts:[...prompts.values()].filter(ids=>ids.length>1)},null,2));
