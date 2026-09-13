const RECENT_KEY='mste-recent-question-ids-v1';

// Rejection sampling avoids modulo bias; Fisher-Yates visits every permutation.
function randomIndex(limit) {
  const value=new Uint32Array(1);
  const ceiling=Math.floor(2**32/limit)*limit;
  do {crypto.getRandomValues(value);}while(value[0]>=ceiling);
  return value[0]%limit;
}
function shuffle(values) {
  const result=[...values];
  for(let i=result.length-1;i>0;i--){const j=randomIndex(i+1);[result[i],result[j]]=[result[j],result[i]];}
  return result;
}

export function selectQuestions(bank,count,recentIds=[]) {
  if(!Number.isInteger(count)||count<1)throw new Error('Invalid question count.');
  const recent=new Set(recentIds);
  // The PDF contains one repeated prompt with different choices. Keep both source
  // items available, but never show the same prompt twice in a session.
  const recentPrompts=new Set(bank.filter(question=>recent.has(question.id)).map(question=>question.text));
  const unused=[],used=[];
  for(const question of bank)(recentPrompts.has(question.text)?used:unused).push(question);
  const selected=[],seen=new Set();
  for(const question of [...shuffle(unused),...shuffle(used)]) {
    if(seen.has(question.text))continue;
    selected.push(question);seen.add(question.text);
    if(selected.length===count)break;
  }
  if(selected.length!==count)throw new Error('Not enough unique questions in the question bank.');
  return shuffle(selected).map(question=>{
    const order=shuffle([0,1,2,3]);
    return {...question,choices:order.map(index=>question.choices[index]),correctIndex:order.indexOf(question.correctIndex)};
  });
}

export function createSessionSelector(bank) {
  let recentIds=[];
  return count=>{
    try {
      const stored=JSON.parse(localStorage.getItem(RECENT_KEY));
      if(Array.isArray(stored)&&stored.every(id=>typeof id==='string'))recentIds=stored;
    }catch{/* Keep in-memory history when storage is blocked or malformed. */}
    const questions=selectQuestions(bank,count,recentIds);
    recentIds=questions.map(question=>question.id);
    try {localStorage.setItem(RECENT_KEY,JSON.stringify(recentIds));}catch{/* The quiz also works without storage. */}
    return questions;
  };
}
