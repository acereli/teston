// ═══════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════
const SYSTEM_PROMPT = `You are an AI English tutor for a Canadian college preparation app.
Your role is to help a student reach academic English level (IELTS 6.5–7.0) in 8 weeks, for admission to Canadian colleges like Seneca College.

You must:
1. Correct writing tasks (IELTS Task 1 and Task 2)
   - grammar correction
   - structure feedback
   - vocabulary improvement
   - give IELTS band estimate (0–9)

2. Evaluate speaking practice
   - analyze fluency and coherence
   - identify grammar mistakes
   - suggest improvements
   - keep feedback simple and practical

3. Generate IELTS-style questions
   - listening comprehension questions
   - speaking questions (Part 1, 2, 3)
   - writing prompts
   - reading passages with questions

4. Adapt difficulty based on user level: beginner → intermediate → academic

5. Always respond in a structured format using these exact section headers:
   **SCORE:** [number/9 or percentage]
   **STRENGTHS:** [bullet points]
   **WEAKNESSES:** [bullet points]  
   **IMPROVEMENTS:** [specific suggestions]
   **CORRECTED VERSION:** [only for writing tasks]

Tone: strict but supportive, academic, clear, no unnecessary fluff.`;

let state = JSON.parse(localStorage.getItem('aq_state') || 'null') || {
  xp: 0, streak: 0, lastActive: null,
  essays: 0, speakSessions: 0, readTests: 0, sessions: 0,
  skills: {listening:5, speaking:5, reading:5, writing:5},
  currentWeek: 1,
  badges: {},
  currentReadQ: null,
  currentReadAnswers: {},
  readTimerInterval: null,
  readTimeLeft: 0,
};
let sessionStart = Date.now();
let timerInterval = setInterval(updateTimer, 1000);

function save() { localStorage.setItem('aq_state', JSON.stringify(state)); }

// ═══════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════
const pageTitles = {dashboard:'Dashboard',listening:'Listening Module',speaking:'Speaking Module',reading:'Reading Module',writing:'Writing Module',progress:'Progress',badges:'Achievements'};

document.querySelectorAll('.sb-item').forEach(el => {
  el.addEventListener('click', () => {
    const p = el.dataset.page;
    document.querySelectorAll('.sb-item').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
    el.classList.add('active');
    document.getElementById('page-' + p).classList.add('active');
    document.getElementById('topBarTitle').textContent = pageTitles[p];
    if (p === 'dashboard') renderDashboard();
    if (p === 'progress') renderProgress();
    if (p === 'badges') renderBadges();
  });
});

// ═══════════════════════════════════════════
// XP & GAMIFICATION
// ═══════════════════════════════════════════
const LEVELS = [
  {name:'Beginner', min:0, max:500},
  {name:'Pre-Intermediate', min:500, max:1200},
  {name:'Intermediate', min:1200, max:2500},
  {name:'Upper-Intermediate', min:2500, max:4500},
  {name:'Academic Ready', min:4500, max:9999}
];

function addXP(amount, reason) {
  state.xp += amount;
  state.sessions++;
  checkStreak();
  save();
  updateXPBar();
  renderDashboard();
  showToast(`+${amount} XP — ${reason}`);
  checkBadges();
}

function checkStreak() {
  const today = new Date().toDateString();
  if (state.lastActive !== today) {
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    state.streak = (state.lastActive === yesterday) ? state.streak + 1 : 1;
    state.lastActive = today;
  }
}

function getLevelInfo() {
  return LEVELS.find(l => state.xp >= l.min && state.xp < l.max) || LEVELS[LEVELS.length-1];
}

function updateXPBar() {
  const lv = getLevelInfo();
  const pct = Math.min(100, ((state.xp - lv.min) / (lv.max - lv.min)) * 100);
  document.getElementById('xpFill').style.width = pct + '%';
  document.getElementById('xpVal').textContent = state.xp + ' / ' + lv.max + ' XP';
  document.getElementById('levelName').textContent = lv.name;
  document.getElementById('levelPill').textContent = lv.name;
  document.getElementById('streakVal').textContent = state.streak;
}

function updateTimer() {
  const secs = Math.floor((Date.now() - sessionStart) / 1000);
  const m = String(Math.floor(secs/60)).padStart(2,'0');
  const s = String(secs%60).padStart(2,'0');
  document.getElementById('sessionTimer').textContent = m + ':' + s;
}

// ═══════════════════════════════════════════
// BADGES
// ═══════════════════════════════════════════
const BADGES_DEF = [
  {id:'first_essay', icon:'📝', name:'First Draft', desc:'Submit your first essay', check:()=>state.essays>=1},
  {id:'essays5', icon:'📚', name:'Writer', desc:'Submit 5 essays', check:()=>state.essays>=5},
  {id:'essays20', icon:'🖊️', name:'Essayist', desc:'Submit 20 essays', check:()=>state.essays>=20},
  {id:'streak3', icon:'🔥', name:'On Fire', desc:'3 day streak', check:()=>state.streak>=3},
  {id:'streak7', icon:'⚡', name:'Weekly Warrior', desc:'7 day streak', check:()=>state.streak>=7},
  {id:'streak30', icon:'💎', name:'Diamond Streak', desc:'30 day streak', check:()=>state.streak>=30},
  {id:'speak5', icon:'🎙️', name:'Confident Speaker', desc:'Complete 5 speaking sessions', check:()=>state.speakSessions>=5},
  {id:'read5', icon:'📖', name:'Speed Reader', desc:'Complete 5 reading tests', check:()=>state.readTests>=5},
  {id:'xp500', icon:'⭐', name:'XP Hunter', desc:'Earn 500 XP', check:()=>state.xp>=500},
  {id:'xp2000', icon:'🌟', name:'XP Master', desc:'Earn 2000 XP', check:()=>state.xp>=2000},
  {id:'academic', icon:'🎓', name:'Academic Ready', desc:'Reach Academic Ready level', check:()=>state.xp>=4500},
  {id:'allskills50', icon:'🏅', name:'Balanced Learner', desc:'All skills above 50%', check:()=>Object.values(state.skills).every(v=>v>=50)},
];

function checkBadges() {
  let newBadge = false;
  BADGES_DEF.forEach(b => {
    if (!state.badges[b.id] && b.check()) {
      state.badges[b.id] = Date.now();
      newBadge = true;
      setTimeout(() => showToast('🏆 Badge unlocked: ' + b.name), 1500);
    }
  });
  if (newBadge) {
    save();
    document.getElementById('newBadgesBadge').style.display = 'inline';
  }
}

function renderBadges() {
  const g = document.getElementById('badgesGrid');
  g.innerHTML = BADGES_DEF.map(b => `
    <div class="badge-card ${state.badges[b.id] ? '' : 'locked'}">
      <div class="badge-icon">${b.icon}</div>
      <div class="badge-name">${b.name}</div>
      <div class="badge-desc">${b.desc}</div>
      ${state.badges[b.id] ? '<div style="font-size:.65rem;color:var(--green);margin-top:.35rem;font-weight:700">✓ Unlocked</div>' : ''}
    </div>
  `).join('');
  document.getElementById('newBadgesBadge').style.display = 'none';
}

// ═══════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════
let toastTimeout;
function showToast(msg) {
  const t = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => t.classList.remove('show'), 3500);
}

// ═══════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════
const weekThemes = ['Foundation Skills','Core Grammar','IELTS Introduction','Reading & Listening Focus','Speaking Intensive','Writing Intensive','Full Mock Tests','Final Simulation'];
const weekPlanData = [
  {icon:'📚',label:'Foundation'},
  {icon:'🔤',label:'Grammar'},
  {icon:'📝',label:'IELTS Intro'},
  {icon:'🎧',label:'Reading'},
  {icon:'🎙️',label:'Speaking'},
  {icon:'✍️',label:'Writing'},
  {icon:'🧪',label:'Mock Tests'},
  {icon:'🎓',label:'Simulation'},
];

function renderDashboard() {
  // stats
  document.getElementById('statEssays').textContent = state.essays;
  document.getElementById('statSpeaking').textContent = state.speakSessions;
  document.getElementById('statReading').textContent = state.readTests;
  document.getElementById('statXP').textContent = state.xp;

  // seneca
  const s = Math.min(100, Math.round(
    (state.skills.listening + state.skills.speaking + state.skills.reading + state.skills.writing) / 4
  ));
  document.getElementById('senecaScore').innerHTML = s + '<small>/ 100</small>';
  document.getElementById('p-seneca').textContent = s;

  // bars
  ['listening','speaking','reading','writing'].forEach(k => {
    const v = state.skills[k];
    document.getElementById('bar-'+k).style.width = v + '%';
    document.getElementById('pct-'+k).textContent = v + '%';
  });

  // week plan
  const wp = document.getElementById('weekPlan');
  wp.innerHTML = weekPlanData.map((w, i) => {
    const wk = i + 1;
    const cls = wk < state.currentWeek ? 'done' : wk === state.currentWeek ? 'current' : '';
    return `<div class="week-item ${cls}"><div class="wn">W${wk}</div><div class="wicon">${w.icon}</div><div style="font-size:.6rem;color:inherit;opacity:.7">${w.label}</div></div>`;
  }).join('');
  document.getElementById('currentWeekLabel').textContent = `Week ${state.currentWeek} of 8`;
  document.getElementById('weekTheme').textContent = weekThemes[state.currentWeek - 1];

  // today focus
  const focuses = {
    1:'📚 Listening: 30 min academic lecture &nbsp;|&nbsp; 🔊 Shadowing: 20 min &nbsp;|&nbsp; ✍️ Writing: Essay structure basics',
    2:'🔤 Grammar: 30 min conditional sentences &nbsp;|&nbsp; 🎙️ Speaking: Part 1 practice &nbsp;|&nbsp; 📖 Reading: Skim & scan techniques',
    3:'📝 IELTS Task 2 practice &nbsp;|&nbsp; 🎧 Listening: Note-taking &nbsp;|&nbsp; 🎙️ Speaking: Part 2 cue card',
    4:'📖 Timed reading test (20 min) &nbsp;|&nbsp; 🎧 Listening: Multiple choice &nbsp;|&nbsp; ✍️ Writing: Cohesion & coherence',
    5:'🎙️ Speaking recording × 3 &nbsp;|&nbsp; ✍️ Task 1 describe a chart &nbsp;|&nbsp; 📖 Reading: True/False/NG',
    6:'✍️ Full Task 2 essay &nbsp;|&nbsp; 🎙️ Part 3 discussion practice &nbsp;|&nbsp; 📚 Vocabulary building',
    7:'🧪 Full mock IELTS Reading &nbsp;|&nbsp; 🧪 Mock Writing Test &nbsp;|&nbsp; 🎙️ Mock Speaking',
    8:'🎓 Final simulation under exam conditions &nbsp;|&nbsp; 📊 Review all weak areas &nbsp;|&nbsp; ✅ College readiness check',
  };
  document.getElementById('todayFocus').innerHTML = focuses[state.currentWeek] || focuses[1];

  updateXPBar();
}

// ═══════════════════════════════════════════
// PROGRESS PAGE
// ═══════════════════════════════════════════
function renderProgress() {
  document.getElementById('p-xp').textContent = state.xp;
  document.getElementById('p-streak').textContent = state.streak;
  document.getElementById('p-sessions').textContent = state.sessions;
  const s = Math.min(100, Math.round(Object.values(state.skills).reduce((a,b)=>a+b,0) / 4));
  document.getElementById('p-seneca').textContent = s;
  ['listening','speaking','reading','writing'].forEach(k => {
    const v = state.skills[k];
    document.getElementById('pbar-'+k).style.width = v + '%';
    document.getElementById('ppct-'+k).textContent = v + '%';
  });
  const sched = [
    ['Weeks 1–2','Foundation','🎧 Daily lecture listening + shadowing | 🔊 Basic pronunciation | ✍️ Essay structure | 🔤 Grammar: tenses, articles, prepositions'],
    ['Week 3','IELTS Intro','📝 Task 1 + Task 2 introduction | 🎙️ Speaking Part 1 & 2 | 📖 Skim & scan reading techniques'],
    ['Weeks 4–5','IELTS Practice','⏱ Timed reading tests | 🎙️ Speaking recording tasks | 🎧 Listening: note-taking | ✍️ Task 2 full essays'],
    ['Week 6','Writing Intensive','✍️ Daily full essays with AI correction | 📊 Band score tracking | 🎙️ Part 3 abstract discussion'],
    ['Weeks 7–8','Full Simulation','🧪 Weekly complete mock tests | ⏱ Real exam conditions | 📈 Final readiness assessment'],
  ];
  document.getElementById('weeklySchedule').innerHTML = sched.map(([wk, theme, tasks]) =>
    `<div style="margin-bottom:.85rem;padding:.85rem;background:var(--bg);border-radius:var(--r);border-left:3px solid var(--blue)">
      <strong style="color:var(--navy)">${wk}: ${theme}</strong><br>
      <span style="color:var(--text2);font-size:.8rem">${tasks}</span>
    </div>`
  ).join('');
}

// ═══════════════════════════════════════════
// API CALL
// ═══════════════════════════════════════════
async function callAI(userMsg, onChunk) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      stream: true,
      messages: [{role:'user', content:userMsg}]
    })
  });
  if (!res.ok) throw new Error('API error ' + res.status);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  while (true) {
    const {done, value} = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') break;
        try {
          const j = JSON.parse(data);
          if (j.type === 'content_block_delta' && j.delta?.text) {
            full += j.delta.text;
            if (onChunk) onChunk(full);
          }
        } catch {}
      }
    }
  }
  return full;
}

// Non-streaming call
async function callAISimple(userMsg) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{role:'user', content: userMsg}]
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'API error');
  return data.content.map(b => b.text || '').join('');
}

// ═══════════════════════════════════════════
// RENDER AI RESPONSE
// ═══════════════════════════════════════════
function renderResponse(raw, containerId, showBand=false) {
  const container = document.getElementById(containerId);
  // Extract band score
  const bandMatch = raw.match(/\*\*SCORE[:\*]*\s*([\d.]+)/i);
  const band = bandMatch ? bandMatch[1] : null;

  // Parse sections
  const sections = [
    {key:'STRENGTHS', dot:'dot-g', label:'Strengths'},
    {key:'WEAKNESSES', dot:'dot-r', label:'Weaknesses'},
    {key:'IMPROVEMENTS', dot:'dot-b', label:'Improvements'},
    {key:'CORRECTED VERSION', dot:'dot-gd', label:'Corrected Version'},
  ];

  let html = '';
  if (band && showBand) {
    html += `<div class="band-badge"><div class="band-num">${band}</div><div class="band-label">/ 9 IELTS Band</div></div>`;
  }

  // Score items for speaking
  if (raw.includes('fluency') || raw.includes('Fluency')) {
    const fluencyM = raw.match(/fluency[:\s]+(\d+)/i);
    const grammarM = raw.match(/grammar[:\s]+(\d+)/i);
    const vocabM = raw.match(/vocabulary[:\s]+(\d+)/i);
    if (fluencyM || grammarM || vocabM) {
      html += '<div class="score-reveal">';
      if (fluencyM) html += `<div class="score-item"><div class="sv">${fluencyM[1]}/9</div><div class="sl">Fluency</div></div>`;
      if (grammarM) html += `<div class="score-item"><div class="sv">${grammarM[1]}/9</div><div class="sl">Grammar</div></div>`;
      if (vocabM) html += `<div class="score-item"><div class="sv">${vocabM[1]}/9</div><div class="sl">Vocabulary</div></div>`;
      html += '</div>';
    }
  }

  sections.forEach(sec => {
    const regex = new RegExp(`\\*\\*${sec.key}[:\\*]*([\\s\\S]*?)(?=\\*\\*[A-Z]|$)`, 'i');
    const m = raw.match(regex);
    if (m) {
      const content = m[1].trim()
        .replace(/^[-•*]\s*/gm, '• ')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      if (sec.key === 'CORRECTED VERSION') {
        html += `<div class="rsec"><div class="rsec-hd"><div class="dot ${sec.dot}"></div>${sec.label}</div><div class="corrected">${content}</div></div>`;
      } else {
        html += `<div class="rsec"><div class="rsec-hd"><div class="dot ${sec.dot}"></div>${sec.label}</div><div class="resp-text">${content.split('\n').map(l=>`<p>${l}</p>`).join('')}</div></div>`;
      }
    }
  });

  // Fallback: just show raw if no sections found
  if (!html) {
    html = `<div class="resp-text">${raw.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').split('\n').map(l=>`<p>${l}</p>`).join('')}</div>`;
  }
  container.innerHTML = html;
}

// ═══════════════════════════════════════════
// WRITING MODULE
// ═══════════════════════════════════════════
const sampleEssay = `Many people believe that social media has had a negative impact on society, particularly on young people. However, others argue that it has brought numerous benefits. In this essay, I will discuss both sides of this argument and give my own opinion.

On the one hand, social media can be harmful in several ways. Firstly, it can lead to addiction, as people spend hours scrolling through their feeds instead of engaging in productive activities. Furthermore, cyberbullying has become a serious issue, with many young people experiencing harassment online. Additionally, the constant exposure to idealised images can cause low self-esteem and mental health problems.

On the other hand, social media has many positive aspects. It allows people to connect with friends and family across the world instantly. Moreover, it provides a platform for sharing information and raising awareness about important social issues. For businesses, social media is an invaluable marketing tool that helps reach millions of customers.

In conclusion, while social media has its drawbacks, I believe that when used responsibly, its benefits outweigh the negatives. The key is to educate young people about how to use these platforms safely and in moderation.`;

document.getElementById('writeTask').addEventListener('change', e => {
  document.getElementById('templateSection').style.display = e.target.value === 'task2' ? 'block' : 'none';
});
document.getElementById('toggleTemplate').addEventListener('click', () => {
  const s = document.getElementById('templateSection');
  const showing = s.style.display !== 'none';
  s.style.display = showing ? 'none' : 'block';
  document.getElementById('toggleTemplate').textContent = showing ? '📋 Show Template' : '📋 Hide Template';
});
document.getElementById('loadSample').addEventListener('click', () => {
  document.getElementById('writeEssay').value = sampleEssay;
  updateWC('writeEssay','writeWc');
});
document.getElementById('clearWrite').addEventListener('click', () => {
  document.getElementById('writeEssay').value = '';
  updateWC('writeEssay','writeWc');
  document.getElementById('writeResp').classList.remove('show');
});
document.getElementById('writeEssay').addEventListener('input', () => updateWC('writeEssay','writeWc'));

document.getElementById('genWritePrompt').addEventListener('click', async () => {
  const task = document.getElementById('writeTask').value;
  document.getElementById('genWritePrompt').disabled = true;
  try {
    const p = task === 'task1'
      ? 'Generate one IELTS Task 1 writing prompt describing a graph, chart, table, or process. Give only the prompt, nothing else.'
      : 'Generate one IELTS Task 2 writing prompt (argumentative or discussion essay). Give only the prompt, nothing else.';
    const result = await callAISimple(p);
    document.getElementById('writePrompt').value = result.trim();
  } catch(e) { showToast('Error generating prompt'); }
  document.getElementById('genWritePrompt').disabled = false;
});

document.getElementById('submitWrite').addEventListener('click', async () => {
  const essay = document.getElementById('writeEssay').value.trim();
  const task = document.getElementById('writeTask').value;
  const prompt = document.getElementById('writePrompt').value.trim();
  const errEl = document.getElementById('writeError');
  errEl.innerHTML = '';

  if (!essay) { errEl.innerHTML = '<div class="resp-box show" style="border-color:var(--red);background:var(--red2);color:#991B1B;display:block">Please write your essay first.</div>'; return; }
  const wc = essay.split(/\s+/).length;
  const minWords = task === 'task1' ? 150 : 250;
  if (wc < minWords * 0.7) {
    errEl.innerHTML = `<div class="resp-box show" style="border-color:var(--red);background:var(--red2);color:#991B1B;display:block">Your essay is too short (${wc} words). Aim for at least ${minWords} words.</div>`;
    return;
  }

  document.getElementById('writeLoading').classList.add('show');
  document.getElementById('submitWrite').disabled = true;
  document.getElementById('writeResp').classList.remove('show');

  try {
    const msg = `Please evaluate this IELTS ${task === 'task1' ? 'Task 1' : 'Task 2'} essay.
${prompt ? 'Prompt: ' + prompt + '\n' : ''}
Essay:
${essay}

Use the exact structured format: SCORE, STRENGTHS, WEAKNESSES, IMPROVEMENTS, CORRECTED VERSION (first 2 paragraphs only).`;

    let full = '';
    document.getElementById('writeResp').classList.add('show');
    await callAI(msg, (text) => {
      full = text;
      renderResponse(text, 'writeRespContent', true);
    });

    // Update state
    state.essays++;
    const bandMatch = full.match(/\*\*SCORE[:\*]*\s*([\d.]+)/i);
    if (bandMatch) {
      const band = parseFloat(bandMatch[1]);
      const newScore = Math.min(95, Math.round(state.skills.writing + (band / 9) * 5));
      state.skills.writing = newScore;
    } else {
      state.skills.writing = Math.min(95, state.skills.writing + 3);
    }
    addXP(50, 'Essay submitted');
  } catch(e) {
    errEl.innerHTML = `<div class="resp-box show" style="border-color:var(--red);background:var(--red2);color:#991B1B;display:block">Error: ${e.message}</div>`;
  }
  document.getElementById('writeLoading').classList.remove('show');
  document.getElementById('submitWrite').disabled = false;
});

// ═══════════════════════════════════════════
// SPEAKING MODULE
// ═══════════════════════════════════════════
document.querySelectorAll('#speakChips .chip').forEach(c => {
  c.addEventListener('click', () => {
    document.querySelectorAll('#speakChips .chip').forEach(x => x.classList.remove('active'));
    c.classList.add('active');
    document.getElementById('speakTopic').value = c.dataset.t;
  });
});

let currentSpeakQuestion = '';

document.getElementById('genSpeakQ').addEventListener('click', async () => {
  const part = document.getElementById('speakPart').value;
  const topic = document.getElementById('speakTopic').value || 'general';
  document.getElementById('speakGenLoading').classList.add('show');
  document.getElementById('genSpeakQ').disabled = true;
  document.getElementById('speakQuestionArea').style.display = 'none';
  document.getElementById('speakResp').classList.remove('show');

  try {
    const partNum = part === 'part1' ? '1' : part === 'part2' ? '2' : '3';
    const partDesc = {part1:'Personal/everyday questions (30-45 seconds response)',part2:'Cue card long turn (1-2 minutes response)',part3:'Abstract discussion questions (45-90 seconds response)'};
    const hints = {part1:'Answer naturally, give examples from your life. Expand your answers.',part2:'Use the cue card structure: Describe... You should say: what/where/when/why... Remember to include all points.',part3:'Give your opinion clearly, use academic vocabulary, discuss both perspectives.'};

    const q = await callAISimple(`Generate ONE IELTS Speaking ${partNum} question about "${topic}".
Part ${partNum}: ${partDesc[part]}.
Give ONLY the question (and for Part 2, include the cue card bullet points). No introduction.`);

    currentSpeakQuestion = q.trim();
    document.getElementById('speakPartTag').textContent = `IELTS Speaking — Part ${partNum}`;
    document.getElementById('speakQText').textContent = currentSpeakQuestion;
    document.getElementById('speakHint').textContent = '💡 ' + hints[part];
    document.getElementById('speakQuestionArea').style.display = 'block';
    document.getElementById('speakResponse').value = '';
    updateWC('speakResponse','speakWc');
  } catch(e) {
    showToast('Error generating question');
  }
  document.getElementById('speakGenLoading').classList.remove('show');
  document.getElementById('genSpeakQ').disabled = false;
});

document.getElementById('newSpeakQ').addEventListener('click', () => {
  document.getElementById('genSpeakQ').click();
});

document.getElementById('speakResponse').addEventListener('input', () => updateWC('speakResponse','speakWc'));

document.getElementById('submitSpeak').addEventListener('click', async () => {
  const resp = document.getElementById('speakResponse').value.trim();
  const errEl = document.getElementById('speakError');
  errEl.innerHTML = '';
  if (!resp) { errEl.innerHTML = '<div class="resp-box show" style="border-color:var(--red);background:var(--red2);color:#991B1B;display:block">Please write your response first.</div>'; return; }

  document.getElementById('speakFeedbackLoading').classList.add('show');
  document.getElementById('submitSpeak').disabled = true;
  document.getElementById('speakResp').classList.remove('show');

  try {
    const part = document.getElementById('speakPart').value;
    const msg = `Evaluate this IELTS Speaking ${part} response.
Question: ${currentSpeakQuestion}
Response: ${resp}

Rate fluency, grammar, and vocabulary each out of 9 (include the word "fluency:", "grammar:", "vocabulary:" in your response).
Use format: SCORE, STRENGTHS, WEAKNESSES, IMPROVEMENTS.`;

    document.getElementById('speakResp').classList.add('show');
    await callAI(msg, (text) => renderResponse(text, 'speakRespContent', false));

    state.speakSessions++;
    state.skills.speaking = Math.min(95, state.skills.speaking + 4);
    addXP(40, 'Speaking session completed');
  } catch(e) {
    errEl.innerHTML = `<div class="resp-box show" style="border-color:var(--red);background:var(--red2);color:#991B1B;display:block">Error: ${e.message}</div>`;
  }
  document.getElementById('speakFeedbackLoading').classList.remove('show');
  document.getElementById('submitSpeak').disabled = false;
});

// ═══════════════════════════════════════════
// READING MODULE
// ═══════════════════════════════════════════
let readTimerInterval = null;
let readTimeLeft = 0;
let currentReadData = null;

document.getElementById('genReading').addEventListener('click', async () => {
  const type = document.getElementById('readType').value;
  const topic = document.getElementById('readTopic').value || 'technology and society';
  const timerMins = parseInt(document.getElementById('readTimer').value);
  const errEl = document.getElementById('readError');
  errEl.innerHTML = '';

  document.getElementById('readLoading').classList.add('show');
  document.getElementById('genReading').disabled = true;
  document.getElementById('readTest').style.display = 'none';
  document.getElementById('readResults').classList.remove('show');

  try {
    const typeInstructions = {
      tfng: 'True/False/Not Given (5 statements)',
      mcq: 'Multiple Choice A/B/C/D (5 questions)',
      matching: 'Matching Headings (match 4 paragraph headings from a list of 6)',
      short: 'Short Answer questions (5 questions, max 3 words each)',
    };

    const prompt = `Generate an IELTS-style academic reading passage about "${topic}" (approximately 300 words).
Then generate 5 ${typeInstructions[type]} questions.

Respond ONLY in this exact JSON format:
{
  "title": "passage title",
  "passage": "full passage text...",
  "questions": [
    {"id":1,"question":"...","options":["A) ...","B) ...","C) ...","D) ..."],"answer":"A"},
    ...
  ]
}
For True/False/Not Given: options are always ["True","False","Not Given"], answer is one of those.
For Short Answer: options:[], answer is the correct short answer.
For Matching: options are the heading choices A-F, answer is the correct letter.`;

    const raw = await callAISimple(prompt);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Could not parse response');
    currentReadData = JSON.parse(jsonMatch[0]);

    // Render
    document.getElementById('passageTitle').textContent = currentReadData.title;
    document.getElementById('passageText').textContent = currentReadData.passage;

    const qa = document.getElementById('questionsArea');
    qa.innerHTML = currentReadData.questions.map((q, i) => {
      const opts = q.options.length > 0 ? q.options.map((o, j) => `
        <div class="q-opt" data-qi="${i}" data-oi="${j}" data-val="${o.charAt(0)}">${o}</div>
      `).join('') : `<input type="text" class="short-ans" data-qi="${i}" placeholder="Your answer (max 3 words)…" style="margin-top:.25rem">`;
      return `<div class="q-item"><div class="q-text">${i+1}. ${q.question}</div><div class="q-options">${opts}</div></div>`;
    }).join('');

    // Options click
    document.querySelectorAll('.q-opt').forEach(el => {
      el.addEventListener('click', () => {
        document.querySelectorAll(`.q-opt[data-qi="${el.dataset.qi}"]`).forEach(x => x.classList.remove('selected'));
        el.classList.add('selected');
      });
    });

    // Timer
    if (timerMins > 0) {
      readTimeLeft = timerMins * 60;
      clearInterval(readTimerInterval);
      readTimerInterval = setInterval(() => {
        readTimeLeft--;
        const m = String(Math.floor(readTimeLeft/60)).padStart(2,'0');
        const s = String(readTimeLeft%60).padStart(2,'0');
        document.getElementById('readTimerDisplay').textContent = m + ':' + s;
        if (readTimeLeft <= 0) {
          clearInterval(readTimerInterval);
          document.getElementById('checkAnswers').click();
        }
      }, 1000);
      document.getElementById('readTimerDisplay').textContent = timerMins + ':00';
    } else {
      document.getElementById('readTimerDisplay').textContent = '∞';
    }
    document.getElementById('readTest').style.display = 'block';
  } catch(e) {
    errEl.innerHTML = `<div class="resp-box show" style="border-color:var(--red);background:var(--red2);color:#991B1B;display:block">Error generating test: ${e.message}</div>`;
  }
  document.getElementById('readLoading').classList.remove('show');
  document.getElementById('genReading').disabled = false;
});

document.getElementById('endReadBtn').addEventListener('click', () => document.getElementById('checkAnswers').click());

document.getElementById('checkAnswers').addEventListener('click', () => {
  if (!currentReadData) return;
  clearInterval(readTimerInterval);

  let correct = 0;
  currentReadData.questions.forEach((q, i) => {
    const shortInput = document.querySelector(`.short-ans[data-qi="${i}"]`);
    let userAns;
    if (shortInput) {
      userAns = shortInput.value.trim().toLowerCase();
    } else {
      const sel = document.querySelector(`.q-opt.selected[data-qi="${i}"]`);
      userAns = sel ? sel.dataset.val : null;
    }

    const correctAns = q.answer.charAt(0).toUpperCase();
    const isCorrect = shortInput
      ? userAns && q.answer.toLowerCase().includes(userAns) && userAns.length > 0
      : userAns && userAns.toUpperCase() === correctAns;

    if (isCorrect) {
      correct++;
      if (!shortInput) {
        document.querySelectorAll(`.q-opt[data-qi="${i}"]`).forEach(x => {
          if (x.dataset.val === userAns) x.classList.add('correct');
        });
      }
    } else {
      if (!shortInput) {
        document.querySelectorAll(`.q-opt[data-qi="${i}"]`).forEach(x => {
          if (x.dataset.val === userAns) x.classList.add('wrong');
          if (x.dataset.val === correctAns) x.classList.add('correct');
        });
      }
    }
  });

  const total = currentReadData.questions.length;
  const pct = Math.round((correct / total) * 100);
  const band = (correct / total * 4 + 4).toFixed(1);

  document.getElementById('readResultsContent').innerHTML = `
    <div class="score-reveal">
      <div class="score-item"><div class="sv">${correct}/${total}</div><div class="sl">Correct</div></div>
      <div class="score-item"><div class="sv">${pct}%</div><div class="sl">Score</div></div>
      <div class="score-item"><div class="sv">~${band}</div><div class="sl">Est. Band</div></div>
    </div>
    <div class="resp-text">
      <p><strong>${pct >= 70 ? '✅ Well done!' : '📚 Keep practising!'}</strong> You got ${correct} out of ${total} questions correct.</p>
      <p>${pct >= 80 ? 'Excellent reading comprehension. Try a harder topic next time.' : pct >= 60 ? 'Good effort! Focus on reading the passage more carefully before answering.' : 'Review the passage again. Use skim & scan techniques to find key information quickly.'}</p>
    </div>
  `;
  document.getElementById('readResults').classList.add('show');

  state.readTests++;
  state.skills.reading = Math.min(95, state.skills.reading + Math.round(pct / 20));
  addXP(30 + correct * 5, 'Reading test completed');
});

// ═══════════════════════════════════════════
// LISTENING MODULE
// ═══════════════════════════════════════════
const LECTURES = [
  {title:'Climate Change & Global Policy', sub:'Environmental Science', yt:'gxOFGrIHVQI', topic:'climate change, greenhouse gases, Paris Agreement, environmental policy'},
  {title:'The Future of Artificial Intelligence', sub:'Technology & Society', yt:'aircAruvnKk8', topic:'artificial intelligence, machine learning, neural networks, automation'},
  {title:'Urbanisation & Smart Cities', sub:'Urban Studies', yt:'jTU_Dfo-n-c', topic:'urbanisation, smart cities, infrastructure, population growth'},
  {title:'Health & the Global Food System', sub:'Public Health', yt:'9GorqseijPM', topic:'global food system, nutrition, food security, health outcomes'},
  {title:'Psychology of Learning', sub:'Education Science', yt:'O96fE1E-rf8', topic:'learning psychology, memory consolidation, spaced repetition, growth mindset'},
  {title:'Economics of Globalisation', sub:'Global Economics', yt:'JJ0nFD19eT8', topic:'globalisation, free trade, international markets, economic inequality'},
];

let selectedLecture = null;
const lectureTopicsEl = document.getElementById('lectureTopics');
lectureTopicsEl.innerHTML = LECTURES.map((l, i) => `
  <div class="topic-card" data-i="${i}">
    <div class="topic-title">${l.title}</div>
    <div class="topic-sub">${l.sub}</div>
  </div>
`).join('');

document.querySelectorAll('.topic-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.topic-card').forEach(x => x.classList.remove('active'));
    card.classList.add('active');
    const idx = parseInt(card.dataset.i);
    selectedLecture = LECTURES[idx];
    document.getElementById('videoTitle').textContent = selectedLecture.title;
    document.getElementById('ytEmbed').src = `https://www.youtube.com/embed/${selectedLecture.yt}?rel=0`;
    document.getElementById('videoCard').style.display = 'block';
    document.getElementById('listenQs').innerHTML = '';
  });
});

document.getElementById('clearListenQ').addEventListener('click', () => {
  document.getElementById('videoCard').style.display = 'none';
  document.getElementById('listenQs').innerHTML = '';
  document.querySelectorAll('.topic-card').forEach(x => x.classList.remove('active'));
  document.getElementById('ytEmbed').src = '';
  selectedLecture = null;
});

document.getElementById('genListenQ').addEventListener('click', async () => {
  if (!selectedLecture) return;
  document.getElementById('listenLoading').classList.add('show');
  document.getElementById('genListenQ').disabled = true;
  document.getElementById('listenQs').innerHTML = '';

  try {
    const level = document.getElementById('levelPill').textContent;
    const raw = await callAISimple(`Generate 5 IELTS-style listening comprehension questions about a lecture on: "${selectedLecture.topic}".

The student level is: ${level}.

Respond ONLY in JSON format:
{
  "questions": [
    {"id":1, "question":"...", "options":["A) ...","B) ...","C) ...","D) ..."], "answer":"A", "explanation":"..."},
    ...
  ]
}`);

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Parse error');
    const data = JSON.parse(jsonMatch[0]);

    const qa = document.getElementById('listenQs');
    qa.innerHTML = `<div class="card"><div class="card-h"><span class="ic">🧠</span> Comprehension Questions</div>` +
      data.questions.map((q, i) => `
        <div class="q-item">
          <div class="q-text">${i+1}. ${q.question}</div>
          <div class="q-options">
            ${q.options.map((o, j) => `<div class="q-opt" data-lqi="${i}" data-lval="${o.charAt(0)}" data-ans="${q.answer}" data-exp="${q.explanation||''}">${o}</div>`).join('')}
          </div>
          <div id="lexpl-${i}" style="display:none;font-size:.78rem;color:var(--text2);margin-top:.5rem;padding:.5rem .75rem;background:var(--bg);border-radius:8px"></div>
        </div>
      `).join('') + '</div>';

    document.querySelectorAll('.q-opt[data-lqi]').forEach(el => {
      el.addEventListener('click', () => {
        if (el.classList.contains('correct') || el.classList.contains('wrong')) return;
        const qi = el.dataset.lqi;
        document.querySelectorAll(`.q-opt[data-lqi="${qi}"]`).forEach(x => x.classList.remove('selected'));
        el.classList.add('selected');
        const isCorrect = el.dataset.lval === el.dataset.ans;
        el.classList.add(isCorrect ? 'correct' : 'wrong');
        if (!isCorrect) {
          document.querySelectorAll(`.q-opt[data-lqi="${qi}"]`).forEach(x => {
            if (x.dataset.lval === el.dataset.ans) x.classList.add('correct');
          });
        }
        const explEl = document.getElementById('lexpl-' + qi);
        if (el.dataset.exp) {
          explEl.textContent = (isCorrect ? '✅ Correct! ' : '❌ Incorrect. ') + el.dataset.exp;
          explEl.style.display = 'block';
          explEl.style.color = isCorrect ? 'var(--green)' : 'var(--red)';
        }
      });
    });

    state.skills.listening = Math.min(95, state.skills.listening + 3);
    addXP(25, 'Listening comprehension completed');
  } catch(e) {
    showToast('Error generating questions');
  }
  document.getElementById('listenLoading').classList.remove('show');
  document.getElementById('genListenQ').disabled = false;
});

// ═══════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════
function updateWC(inputId, wcId) {
  const val = document.getElementById(inputId).value;
  const wc = val.trim() ? val.trim().split(/\s+/).length : 0;
  const el = document.getElementById(wcId);
  el.textContent = wc + ' words';
  el.className = 'wc' + (wc > 0 && wc < 100 ? ' warn' : '');
}

// ═══════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════
checkStreak();
save();
updateXPBar();
renderDashboard();
