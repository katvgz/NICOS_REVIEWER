import {questionBank} from './questions.js';
import {createSessionSelector} from './question-selection.js';
import {playClick,playWrong} from './sounds.js';

export function createQuiz(navigate) {
  const selectSession=createSessionSelector(questionBank);
  const choices=document.querySelector('#answer-choices');
  const questionText=document.querySelector('#question-text');
  const number=document.querySelector('#question-number');
  const progress=document.querySelector('#quiz-progress');
  const feedback=document.querySelector('#answer-feedback');
  let questions=[],index=0,wrong=new Set(),locked=false,advanceTimer=null,firstAttemptCorrect=0;

  function advance() {
    clearTimeout(advanceTimer);advanceTimer=null;
    index++;wrong.clear();locked=false;
  }
  function pause() {
    // Leaving during the feedback delay must not navigate later in the background.
    if(locked)advance();
  }
  function render() {
    if(!questions.length||index>=questions.length)return;
    const question=questions[index];
    number.textContent=`QUESTION ${index+1} / ${questions.length}`;
    progress.max=questions.length;progress.value=index;
    questionText.textContent=question.text;
    document.querySelector('#quiz').scrollTop=0;
    feedback.textContent='Choose an answer to continue.';
    feedback.className='answer-feedback';
    choices.replaceChildren(...question.choices.map((answer,choiceIndex)=>{
      const button=document.createElement('button');
      button.className='answer-button';button.type='button';
      const letter=document.createElement('span');letter.className='answer-letter';letter.textContent='ABCD'[choiceIndex];
      const label=document.createElement('span');label.className='answer-label';label.textContent=answer;
      const mark=document.createElement('span');mark.className='answer-mark';
      button.append(letter,label,mark);
      if(wrong.has(choiceIndex)){button.disabled=true;button.classList.add('is-wrong');mark.textContent='Incorrect';}
      button.addEventListener('click',()=>{
        if(locked||wrong.has(choiceIndex))return;
        if(choiceIndex!==question.correctIndex){
          playWrong();
          wrong.add(choiceIndex);button.disabled=true;button.classList.add('is-wrong');mark.textContent='Incorrect';
          feedback.textContent='Not quite. Try another answer.';
          feedback.className='answer-feedback';
          choices.querySelector('button:not(:disabled)')?.focus({preventScroll:true});
          return;
        }
        if(wrong.size===0)firstAttemptCorrect++;
        playClick();
        locked=true;button.classList.add('is-correct');mark.textContent='Correct';
        choices.querySelectorAll('button').forEach(choice=>{choice.disabled=true;});
        feedback.textContent='Correct! Well done.';feedback.className='answer-feedback correct';
        progress.value=index+1;
        advanceTimer=setTimeout(()=>{
          advance();
          if(index===questions.length)navigate('results');
          else render();
        },650);
      });
      return button;
    }));
    questionText.focus({preventScroll:true});
  }
  function start(count) {
    if(![10,25,50,100].includes(count))return;
    if(questionBank.length<count)throw new Error('Not enough questions in the question bank.');
    clearTimeout(advanceTimer);advanceTimer=null;
    questions=selectSession(count);index=0;wrong.clear();locked=false;firstAttemptCorrect=0;
    navigate('quiz');
  }
  function renderResults() {
    document.querySelector('#result-score-correct').textContent=firstAttemptCorrect;
    document.querySelector('#result-score-total').textContent=`/ ${questions.length}`;
    document.querySelector('#result-correct').textContent=firstAttemptCorrect;
    document.querySelector('#result-incorrect').textContent=questions.length-firstAttemptCorrect;
    document.querySelector('#results-title').textContent=`Quiz complete. Score: ${firstAttemptCorrect} out of ${questions.length}. Correct: ${firstAttemptCorrect}. Incorrect: ${questions.length-firstAttemptCorrect}.`;
  }
  return {start,render,pause,renderResults,hasSession:()=>questions.length>0,isComplete:()=>questions.length>0&&index===questions.length};
}
