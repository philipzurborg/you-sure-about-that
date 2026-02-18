"use client";

import { useState, useEffect, useRef } from "react";

const GAME_DATA = {
  day: 1,
  category: "NFL",
  question: "This quarterback won the most Super Bowl MVP awards in NFL history, earning the honor a record 5 times.",
  answer: "Tom Brady",
  alternateAnswers: ["brady", "thomas brady", "tom"],
};

const formatPoints = (n) => {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2).replace(/\.00$/, "") + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2).replace(/\.00$/, "") + "M";
  if (n >= 1_000) return n.toLocaleString();
  return String(n);
};

const PHASES = { WAGER: "wager", QUESTION: "question", RESULT: "result" };
const TIMER_SECONDS = 30;

// ─── localStorage helpers ─────────────────────────────────────────────────────
const STORAGE_KEY = "ysat_player";
const SEEN_KEY    = "ysat_seen";
const todayStr    = () => new Date().toISOString().slice(0, 10);

const defaultStats = () => ({
  points: 0, streak: 0, totalCorrect: 0, totalPlayed: 0,
  lastPlayedDate: null, lastPlayedDay: null, history: [],
});

const loadStats = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultStats();
    const saved = JSON.parse(raw);
    if (saved.lastPlayedDate) {
      const daysDiff = Math.round((new Date(todayStr()) - new Date(saved.lastPlayedDate)) / 86400000);
      if (daysDiff > 1) return { ...saved, points: 0, streak: 0 };
    }
    return saved;
  } catch { return defaultStats(); }
};

const saveStats = (s) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {} };

// ─── Rules modal ──────────────────────────────────────────────────────────────
const RULES = [
  {
    icon: "★",
    heading: "Wager your points",
    body: "Each day you see today's category. Decide how many points to bet — up to your total (or 1,000 if you have less than that).",
  },
  {
    icon: "?",
    heading: "Answer the question",
    body: "A Final Jeopardy-style clue is revealed. You have 30 seconds to type your answer. Alternate spellings and last-name-only answers are accepted.",
  },
  {
    icon: "\u2713",
    heading: "Win or lose",
    body: "Correct: wagered points are added. Incorrect or time's up: wagered points are deducted. You can never go below zero.",
  },
  {
    icon: "\uD83D\uDD25",
    heading: "Keep your streak",
    body: "Points and streak accumulate every day you play. Miss a single day and both reset to zero — so come back tomorrow!",
  },
];

function RulesModal({ onClose, isOnboarding }) {
  return (
    <div style={S.modalOverlay} onClick={onClose}>
      <div style={S.modal} className="modalIn" onClick={e => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <div>
            <div style={S.modalEyebrow}>{isOnboarding ? "Welcome to" : "How to play"}</div>
            <div style={S.modalTitle}>You Sure About That?</div>
          </div>
          <button style={S.modalClose} onClick={onClose}>&#x2715;</button>
        </div>

        <div style={S.modalRules}>
          {RULES.map((r, i) => (
            <div key={i} style={S.ruleRow}>
              <div style={S.ruleIcon}>{r.icon}</div>
              <div>
                <div style={S.ruleHeading}>{r.heading}</div>
                <div style={S.ruleBody}>{r.body}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={S.modalNote}>
          A new question drops every day at midnight UTC. Don&apos;t miss a day!
        </div>

        <button style={{ ...S.mainBtn, background: "var(--gold)" }} className="mainBtn" onClick={onClose}>
          {isOnboarding ? "Let's Play!" : "Got It"}
        </button>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [stats, setStats] = useState(() => loadStats());

  const alreadyPlayed = stats.lastPlayedDay === GAME_DATA.day;

  // Detect missed-day: saved data had a positive streak but today's loaded stats zeroed it
  const missedDay = (() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const saved = JSON.parse(raw);
      if (!saved.lastPlayedDate || !saved.streak) return false;
      return Math.round((new Date(todayStr()) - new Date(saved.lastPlayedDate)) / 86400000) > 1;
    } catch { return false; }
  })();

  const [phase, setPhase]             = useState(alreadyPlayed ? PHASES.RESULT : PHASES.WAGER);
  const [wager, setWager]             = useState("");
  const [answer, setAnswer]           = useState("");
  const [result, setResult]           = useState(alreadyPlayed ? (stats.history.at(-1)?.correct ?? null) : null);
  const [timedOut, setTimedOut]       = useState(alreadyPlayed ? (stats.history.at(-1)?.timedOut ?? false) : false);
  const [wagerLocked, setWagerLocked] = useState(alreadyPlayed ? (stats.history.at(-1)?.wager ?? null) : null);
  const [checking, setChecking]       = useState(false);
  const [copied, setCopied]           = useState(false);
  const [matchMethod, setMatchMethod] = useState(null);
  const [showInfo, setShowInfo]       = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try { return !localStorage.getItem(SEEN_KEY); } catch { return true; }
  });
  const inputRef = useRef(null);

  const points       = stats.points;
  const streak       = stats.streak;
  const totalCorrect = stats.totalCorrect;
  const totalPlayed  = stats.totalPlayed;
  const minWager     = 0;
  const maxWager     = points < 1000 ? 1000 : points;

  useEffect(() => { saveStats(stats); }, [stats]);
  useEffect(() => {
    if (phase === PHASES.QUESTION) setTimeout(() => inputRef.current?.focus(), 400);
  }, [phase]);

  const dismissOnboarding = () => {
    try { localStorage.setItem(SEEN_KEY, "1"); } catch {}
    setShowOnboarding(false);
  };

  // ─── Answer matching tiers ───────────────────────────────────────────────
  const normalize = (s) =>
    s.toLowerCase().replace(/['''"".,()\-]/g, "").replace(/\b(the|a|an)\b/g, "").replace(/\s+/g, " ").trim();

  const tierExact = (u, c, alts) => {
    if (u === c || alts.includes(u)) return { match: true, method: "exact" };
    return null;
  };
  const tierNorm = (u, c, alts) => {
    const nu = normalize(u), nc = normalize(c);
    if (nu === nc || alts.map(normalize).includes(nu)) return { match: true, method: "normalized" };
    return null;
  };
  const tierKeyword = (u, c) => {
    const uw = normalize(u).split(" "), cw = normalize(c).split(" ");
    const last = cw[cw.length - 1];
    if (last.length > 2 && uw.includes(last)) return { match: true, method: "keyword" };
    if (uw.length === 1 && cw.includes(uw[0]) && uw[0].length > 3) return { match: true, method: "keyword" };
    return null;
  };
  const tierLLM = async (ua, ca, q, cat) => {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001", max_tokens: 10,
          system: "You are a strict trivia judge. Reply YES or NO only.",
          messages: [{ role: "user", content: `Category: ${cat}\nQuestion: ${q}\nCorrect: ${ca}\nPlayer: ${ua}\n\nCorrect? YES or NO.` }],
        }),
      });
      const data = await res.json();
      const v = data?.content?.[0]?.text?.trim().toUpperCase();
      return { match: v === "YES", method: "ai" };
    } catch { return { match: false, method: "ai-error" }; }
  };

  // ─── Game actions ─────────────────────────────────────────────────────────
  const handleWager = () => {
    const w = parseInt(wager, 10);
    if (isNaN(w) || w < minWager || w > maxWager) return;
    setWagerLocked(w);
    setPhase(PHASES.QUESTION);
  };

  const commitResult = (isCorrect, isTimeout, w) => {
    setStats(prev => {
      const pointsAfter = isCorrect ? prev.points + w : Math.max(0, prev.points - w);
      return {
        ...prev,
        points: pointsAfter,
        streak: isCorrect ? prev.streak + 1 : 0,
        totalCorrect: prev.totalCorrect + (isCorrect ? 1 : 0),
        totalPlayed: prev.totalPlayed + 1,
        lastPlayedDate: todayStr(),
        lastPlayedDay: GAME_DATA.day,
        history: [...prev.history, {
          day: GAME_DATA.day, date: todayStr(), correct: isCorrect,
          timedOut: isTimeout, wager: w, pointsBefore: prev.points, pointsAfter,
        }],
      };
    });
  };

  const checkAnswer = async (isTimeout = false) => {
    if (!answer.trim() && !isTimeout) return;
    setChecking(true);
    if (isTimeout) {
      setTimedOut(true); setResult(false); setMatchMethod(null);
      commitResult(false, true, wagerLocked);
      setChecking(false); setPhase(PHASES.RESULT);
      return;
    }
    const ua = answer.trim();
    const altsLc = GAME_DATA.alternateAnswers.map(a => a.toLowerCase());
    let res =
      tierExact(ua.toLowerCase(), GAME_DATA.answer.toLowerCase(), altsLc) ||
      tierNorm(ua, GAME_DATA.answer, GAME_DATA.alternateAnswers) ||
      tierKeyword(ua, GAME_DATA.answer) ||
      await tierLLM(ua, GAME_DATA.answer, GAME_DATA.question, GAME_DATA.category);
    setMatchMethod(res.method);
    setResult(res.match);
    commitResult(res.match, false, wagerLocked);
    setChecking(false); setPhase(PHASES.RESULT);
  };

  const handleShare = () => {
    const lines = [
      `You Sure About That? #${String(GAME_DATA.day).padStart(3, "0")}`,
      result ? "Answered Correctly" : timedOut ? "Ran Out of Time" : "Answered Incorrectly",
      `Category: ${GAME_DATA.category}`,
      `Wagered: ${formatPoints(wagerLocked)} pts`,
      `Total: ${formatPoints(stats.points)} pts`,
      `Streak: ${stats.streak} days`,
      "",
      "Play at yousureabout.that",
    ];
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={S.root}>
      <style>{css}</style>

      {/* Modals */}
      {showOnboarding && <RulesModal onClose={dismissOnboarding} isOnboarding />}
      {showInfo && !showOnboarding && <RulesModal onClose={() => setShowInfo(false)} />}

      <div style={S.container}>
        {/* ── Header ── */}
        <header style={S.header}>
          <div style={S.headerInner}>
            <div style={S.dayBadge}>#{String(GAME_DATA.day).padStart(3, "0")}</div>
            <h1 style={S.title}>
              <span style={S.titleYou}>You</span>
              <span style={S.titleSure}> Sure </span>
              <span style={S.titleAbout}>About</span>
              <span style={S.titleThat}> That?</span>
            </h1>
            <button style={S.infoBtn} className="infoBtn" onClick={() => setShowInfo(true)} aria-label="How to play">?</button>
          </div>
          <div style={S.pointsBar}>
            <div style={S.pointsLeft}>
              <span style={S.pointsLabel}>Your Points</span>
              <span style={S.pointsValue}>{formatPoints(points)}</span>
            </div>
            <div style={S.streakBadge}>&#x1F525; {streak}</div>
          </div>
        </header>

        {/* ── Missed-day banner ── */}
        {missedDay && phase === PHASES.WAGER && (
          <div style={S.missedDayBanner} className="fadeIn">
            <span style={S.missedDayIcon}>&#x1F494;</span>
            <div>
              <div style={S.missedDayTitle}>Your streak is over</div>
              <div style={S.missedDayText}>Keep playing daily to build your points back up.</div>
            </div>
          </div>
        )}

        {/* ── Main card ── */}
        <main>
          {phase === PHASES.WAGER && (
            <WagerPhase {...{ wager, setWager, maxWager, minWager, handleWager }} />
          )}
          {phase === PHASES.QUESTION && (
            <QuestionPhase {...{ answer, setAnswer, checking, checkAnswer, wagerLocked, inputRef }}
              category={GAME_DATA.category} question={GAME_DATA.question} />
          )}
          {phase === PHASES.RESULT && (
            <ResultPhase {...{ result, wagerLocked, points, streak, totalCorrect, totalPlayed, handleShare, copied, matchMethod, timedOut, alreadyPlayed }}
              correctAnswer={GAME_DATA.answer} userAnswer={answer} />
          )}
        </main>

        <footer style={S.footer}>
          {alreadyPlayed
            ? "Come back tomorrow to keep your streak and points!"
            : "Daily at midnight UTC \u00b7 Don\u2019t miss a day"}
        </footer>
      </div>
    </div>
  );
}

// ─── Wager phase ──────────────────────────────────────────────────────────────
function WagerPhase({ wager, setWager, maxWager, minWager, handleWager }) {
  const w     = parseInt(wager, 10);
  const valid = !isNaN(w) && w >= minWager && w <= maxWager;
  const pct   = valid ? Math.min(100, (w / maxWager) * 100) : 0;
  const presets = [
    { label: "Safe",   val: Math.floor(maxWager * 0.1) },
    { label: "Half",   val: Math.floor(maxWager * 0.5) },
    { label: "All In", val: maxWager },
  ];
  return (
    <div style={S.card} className="fadeIn">
      <div style={S.phaseTag}>PLACE YOUR WAGER</div>
      <div style={S.categoryReveal}>
        <div style={S.categoryLabel}>Today&apos;s Category</div>
        <div style={S.categoryName} className="popIn">{GAME_DATA.category}</div>
      </div>
      <div style={S.wagerSection}>
        <div style={S.wagerRow}>
          <div style={S.wagerInputWrap}>
            <span style={S.wagerCurrency}>&#9733;</span>
            <input type="number" min={minWager} max={maxWager} value={wager}
              onChange={e => setWager(e.target.value)} placeholder="0" style={S.wagerInput}
              onKeyDown={e => e.key === "Enter" && valid && handleWager()} />
          </div>
        </div>
        <div style={S.sliderWrap}>
          <div style={S.sliderTrack}><div style={{ ...S.sliderFill, width: `${pct}%` }} /></div>
          <div style={S.sliderLabels}><span>0</span><span>{formatPoints(maxWager)}</span></div>
        </div>
        <div style={S.presets}>
          {presets.map(p => (
            <button key={p.label} style={S.presetBtn} className="presetBtn" onClick={() => setWager(String(p.val))}>
              {p.label}<span style={S.presetVal}>{formatPoints(p.val)}</span>
            </button>
          ))}
        </div>
        <button style={{ ...S.mainBtn, opacity: valid ? 1 : 0.4, cursor: valid ? "pointer" : "not-allowed" }}
          className={valid ? "mainBtn" : ""} onClick={handleWager} disabled={!valid}>
          Lock It In &#x2192;
        </button>
      </div>
    </div>
  );
}

// ─── Question phase ───────────────────────────────────────────────────────────
function QuestionPhase({ category, question, answer, setAnswer, checking, checkAnswer, wagerLocked, inputRef }) {
  const [timeLeft, setTimeLeft]   = useState(TIMER_SECONDS);
  const [checkStage, setCheckStage] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (checking) { clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); checkAnswer(true); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [checking]);

  useEffect(() => {
    if (!checking) { setCheckStage(0); return; }
    let i = 0;
    const t = setInterval(() => { i++; setCheckStage(Math.min(i, 3)); }, 400);
    return () => clearInterval(t);
  }, [checking]);

  const stages = ["Checking", "Normalizing", "Analyzing", "AI verifying"];
  const pct       = (timeLeft / TIMER_SECONDS) * 100;
  const isUrgent  = timeLeft <= 10;
  const timerColor = timeLeft > 10 ? "var(--gold)" : timeLeft > 5 ? "#ff9500" : "var(--red)";

  return (
    <div style={S.card} className="fadeIn">
      <div style={S.phaseTag}>ANSWER THE QUESTION</div>
      <div style={S.wagerDisplay}>Wagered <strong>{formatPoints(wagerLocked)} pts</strong></div>

      <div style={S.timerWrap}>
        <div style={S.timerRow}>
          <span style={{ ...S.timerCount, color: timerColor }} className={isUrgent ? "timerUrgent" : ""}>{timeLeft}</span>
          <span style={S.timerLabel}>seconds</span>
        </div>
        <div style={S.timerTrack}>
          <div style={{ ...S.timerFill, width: `${pct}%`, background: timerColor, transition: "width 1s linear, background 0.3s ease" }} />
        </div>
      </div>

      <div style={S.questionBox}>
        <div style={S.questionCategory}>{category}</div>
        <p style={S.questionText}>{question}</p>
      </div>

      <div style={S.answerSection}>
        <input ref={inputRef} type="text" value={answer} onChange={e => setAnswer(e.target.value)}
          placeholder="Your answer..." disabled={checking}
          style={{ ...S.answerInput, borderColor: isUrgent ? timerColor : "var(--border)", transition: "border-color 0.3s ease" }}
          onKeyDown={e => e.key === "Enter" && !checking && answer.trim() && checkAnswer(false)} />
        <button style={{ ...S.mainBtn, opacity: answer.trim() && !checking ? 1 : 0.4 }}
          className={answer.trim() && !checking ? "mainBtn" : ""} onClick={() => checkAnswer(false)} disabled={!answer.trim() || checking}>
          {checking
            ? <span className="checking">{stages[checkStage]}<span className="dots">...</span></span>
            : "Submit Answer \u2192"}
        </button>
      </div>
    </div>
  );
}

// ─── Result phase ─────────────────────────────────────────────────────────────
const METHOD_LABELS = {
  exact:      { label: "Exact match",      icon: "\u26A1", color: "rgba(34,197,94,0.15)",  border: "rgba(34,197,94,0.3)"  },
  normalized: { label: "Normalized match", icon: "\u2726",  color: "rgba(34,197,94,0.12)",  border: "rgba(34,197,94,0.25)" },
  keyword:    { label: "Key word match",   icon: "\u25CE",  color: "rgba(234,179,8,0.12)",  border: "rgba(234,179,8,0.3)"  },
  ai:         { label: "AI verified",      icon: "\u2726",  color: "rgba(139,92,246,0.15)", border: "rgba(139,92,246,0.3)" },
  "ai-error": { label: "AI check failed",  icon: "\u26A0",  color: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.2)"  },
};

function ResultPhase({ result, wagerLocked, points, streak, totalCorrect, totalPlayed, handleShare, copied, correctAnswer, userAnswer, matchMethod, timedOut, alreadyPlayed }) {
  const delta       = result ? `+${formatPoints(wagerLocked)}` : `-${formatPoints(wagerLocked)}`;
  const method      = matchMethod && METHOD_LABELS[matchMethod];
  const bannerBg    = result ? "var(--green)" : timedOut ? "var(--purple)" : "var(--red)";
  const bannerIcon  = result ? "\u2713" : timedOut ? "\u23F1" : "\u2717";
  const bannerLabel = result ? "CORRECT!" : timedOut ? "TIME'S UP!" : "INCORRECT";
  const accent      = result ? "var(--green)" : timedOut ? "var(--purple)" : "var(--red)";

  // Streak messaging: after a correct answer keep streak going; after wrong still come back
  const streakMsg = result
    ? "Come back tomorrow to keep your streak and points!"
    : "Come back tomorrow \u2014 you can still keep your streak going!";

  return (
    <div style={S.card} className="fadeIn">
      <div style={{ ...S.resultBanner, background: bannerBg }} className="popIn">
        <span style={S.resultEmoji}>{bannerIcon}</span>
        <span style={S.resultLabel}>{bannerLabel}</span>
      </div>

      {result && method && (
        <div style={{ ...S.matchBadge, background: method.color, border: `1px solid ${method.border}` }}>
          <span>{method.icon}</span>
          <span style={S.matchBadgeText}>{method.label}</span>
        </div>
      )}

      {!result && (
        <div style={{ ...S.correctAnswerBox, background: timedOut ? "rgba(139,92,246,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${timedOut ? "rgba(139,92,246,0.25)" : "rgba(239,68,68,0.2)"}` }}>
          {timedOut && <span style={{ ...S.correctAnswerLabel, color: "var(--purple)" }}>YOU RAN OUT OF TIME</span>}
          <span style={S.correctAnswerLabel}>Correct Answer:</span>
          <span style={S.correctAnswerText}>{correctAnswer}</span>
          {!timedOut && userAnswer && <span style={S.yourAnswerText}>You said: <em>{userAnswer}</em></span>}
        </div>
      )}

      <div style={S.statsGrid}>
        <Stat label="Wagered"       value={`${formatPoints(wagerLocked)} pts`} />
        <Stat label="Points Change" value={delta} accent={accent} />
        <Stat label="New Total"     value={`${formatPoints(points)} pts`} big />
        <Stat label="Streak"        value={`${streak} days \uD83D\uDD25`} />
        <Stat label="Accuracy"      value={totalPlayed ? `${Math.round((totalCorrect / totalPlayed) * 100)}%` : "\u2014"} />
        <Stat label="Games"         value={totalPlayed} />
      </div>

      {/* Come-back reminder */}
      <div style={S.streakMessage}>{streakMsg}</div>

      <button style={{ ...S.mainBtn, background: "var(--gold)" }} className="mainBtn" onClick={handleShare}>
        {copied ? "\u2713 Copied!" : "Share Result"}
      </button>

      {alreadyPlayed && (
        <div style={S.alreadyPlayedNotice}>
          You&apos;ve already played today. Come back tomorrow to keep your streak and points!
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent, big }) {
  return (
    <div style={{ ...S.statCard, ...(big ? S.statCardBig : {}) }}>
      <div style={S.statLabel}>{label}</div>
      <div style={{ ...S.statValue, ...(accent ? { color: accent } : {}), ...(big ? S.statValueBig : {}) }}>{value}</div>
    </div>
  );
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600&display=swap');
  :root {
    --bg:#0d0d0f; --surface:#16161a; --surface2:#1e1e24;
    --border:rgba(255,255,255,0.07); --gold:#f5c518; --gold2:#ffdd6e;
    --green:#22c55e; --red:#ef4444; --purple:#8b5cf6;
    --text:#f0ede8; --muted:rgba(240,237,232,0.45);
  }
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:var(--bg);font-family:'DM Sans',sans-serif;}
  .fadeIn{animation:fadeIn 0.4s ease forwards;}
  @keyframes fadeIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
  .popIn{animation:popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards;}
  @keyframes popIn{from{opacity:0;transform:scale(0.7)}to{opacity:1;transform:scale(1)}}
  .modalIn{animation:modalIn 0.3s cubic-bezier(0.34,1.3,0.64,1) forwards;}
  @keyframes modalIn{from{opacity:0;transform:translateY(30px) scale(0.97)}to{opacity:1;transform:none}}
  .timerUrgent{animation:pulse 0.6s ease-in-out infinite;}
  @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}
  .mainBtn:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(245,197,24,0.35)!important;}
  .mainBtn:active{transform:translateY(0);}
  .infoBtn:hover{background:var(--surface2)!important;border-color:var(--gold)!important;color:var(--gold)!important;}
  .presetBtn:hover{background:var(--surface2)!important;border-color:var(--gold)!important;color:var(--gold)!important;}
  input[type=number]::-webkit-inner-spin-button,
  input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;}
  input[type=number]{-moz-appearance:textfield;}
  .checking{display:inline-flex;align-items:center;gap:2px;}
  .dots{display:inline-block;animation:dots 1s infinite;}
  @keyframes dots{0%,100%{opacity:0.3}50%{opacity:1}}
`;

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  root:       { minHeight:"100vh", background:"var(--bg)", display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"24px 16px 48px", color:"var(--text)" },
  container:  { width:"100%", maxWidth:480, display:"flex", flexDirection:"column", gap:16 },

  header:     { display:"flex", flexDirection:"column", gap:8 },
  headerInner:{ display:"flex", alignItems:"center", justifyContent:"space-between" },
  title:      { fontFamily:"'Bebas Neue',sans-serif", fontSize:28, letterSpacing:"0.02em", lineHeight:1 },
  titleYou:   { color:"var(--text)" },
  titleSure:  { color:"var(--gold)" },
  titleAbout: { color:"var(--text)" },
  titleThat:  { color:"var(--gold2)" },
  dayBadge:   { fontFamily:"'DM Sans',sans-serif", fontSize:11, fontWeight:600, color:"var(--muted)", letterSpacing:"0.08em", background:"var(--surface)", border:"1px solid var(--border)", borderRadius:6, padding:"3px 8px" },
  infoBtn:    { width:32, height:32, borderRadius:"50%", border:"1px solid var(--border)", background:"var(--surface)", color:"var(--muted)", fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", transition:"all 0.15s ease", display:"flex", alignItems:"center", justifyContent:"center" },
  pointsBar:  { display:"flex", justifyContent:"space-between", alignItems:"center", background:"var(--surface)", border:"1px solid var(--border)", borderRadius:10, padding:"10px 16px" },
  pointsLeft: { display:"flex", flexDirection:"column", gap:2 },
  pointsLabel:{ fontSize:11, fontWeight:600, color:"var(--muted)", letterSpacing:"0.08em", textTransform:"uppercase" },
  pointsValue:{ fontFamily:"'Bebas Neue',sans-serif", fontSize:26, color:"var(--gold)", letterSpacing:"0.03em" },
  streakBadge:{ fontSize:13, fontWeight:600, color:"#ff9500", background:"rgba(255,149,0,0.12)", border:"1px solid rgba(255,149,0,0.25)", borderRadius:8, padding:"4px 12px" },

  missedDayBanner:{ display:"flex", alignItems:"flex-start", gap:12, background:"rgba(139,92,246,0.1)", border:"1px solid rgba(139,92,246,0.25)", borderRadius:12, padding:"14px 16px" },
  missedDayIcon:  { fontSize:22, lineHeight:1.2, flexShrink:0 },
  missedDayTitle: { fontSize:13, fontWeight:700, color:"var(--purple)", marginBottom:3 },
  missedDayText:  { fontSize:12, color:"var(--muted)", lineHeight:1.5 },

  card:       { background:"var(--surface)", border:"1px solid var(--border)", borderRadius:16, padding:"24px 20px", display:"flex", flexDirection:"column", gap:20 },
  phaseTag:   { fontSize:10, fontWeight:700, letterSpacing:"0.15em", color:"var(--gold)", textTransform:"uppercase" },

  categoryReveal:{ textAlign:"center", padding:"8px 0" },
  categoryLabel: { fontSize:11, color:"var(--muted)", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8 },
  categoryName:  { fontFamily:"'Bebas Neue',sans-serif", fontSize:64, color:"var(--gold)", lineHeight:1, letterSpacing:"0.04em", textShadow:"0 0 40px rgba(245,197,24,0.4)" },
  wagerSection:  { display:"flex", flexDirection:"column", gap:14 },
  wagerRow:      { display:"flex", justifyContent:"center" },
  wagerInputWrap:{ display:"flex", alignItems:"center", gap:8, background:"var(--surface2)", border:"2px solid var(--gold)", borderRadius:12, padding:"8px 16px", width:"100%", maxWidth:260 },
  wagerCurrency: { color:"var(--gold)", fontSize:18, fontWeight:700, userSelect:"none" },
  wagerInput:    { background:"transparent", border:"none", outline:"none", color:"var(--text)", fontSize:28, fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"0.04em", width:"100%", textAlign:"center" },
  sliderWrap:    { display:"flex", flexDirection:"column", gap:4 },
  sliderTrack:   { height:4, background:"var(--surface2)", borderRadius:99, overflow:"hidden" },
  sliderFill:    { height:"100%", background:"var(--gold)", borderRadius:99, transition:"width 0.2s ease" },
  sliderLabels:  { display:"flex", justifyContent:"space-between", fontSize:10, color:"var(--muted)", letterSpacing:"0.06em" },
  presets:       { display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 },
  presetBtn:     { background:"var(--surface)", border:"1px solid var(--border)", borderRadius:10, color:"var(--text)", padding:"8px 6px", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:2, fontSize:11, fontWeight:600, fontFamily:"'DM Sans',sans-serif", transition:"all 0.15s ease", letterSpacing:"0.04em" },
  presetVal:     { fontSize:10, color:"var(--muted)", fontWeight:400 },
  mainBtn:       { background:"var(--gold)", color:"#0d0d0f", border:"none", borderRadius:12, padding:"14px 20px", fontSize:14, fontWeight:700, fontFamily:"'DM Sans',sans-serif", cursor:"pointer", letterSpacing:"0.04em", transition:"all 0.2s ease", width:"100%" },

  wagerDisplay: { textAlign:"center", fontSize:13, color:"var(--muted)", background:"var(--surface2)", borderRadius:8, padding:"8px 12px" },
  timerWrap:   { display:"flex", flexDirection:"column", gap:6 },
  timerRow:    { display:"flex", alignItems:"baseline", gap:6 },
  timerCount:  { fontFamily:"'Bebas Neue',sans-serif", fontSize:40, lineHeight:1, letterSpacing:"0.02em", display:"inline-block" },
  timerLabel:  { fontSize:11, color:"var(--muted)", textTransform:"uppercase", letterSpacing:"0.1em", fontWeight:600 },
  timerTrack:  { height:5, background:"var(--surface2)", borderRadius:99, overflow:"hidden" },
  timerFill:   { height:"100%", borderRadius:99 },
  questionBox: { background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:12, padding:20, display:"flex", flexDirection:"column", gap:12 },
  questionCategory:{ fontFamily:"'Bebas Neue',sans-serif", fontSize:20, color:"var(--gold)", letterSpacing:"0.08em" },
  questionText:    { fontSize:15, lineHeight:1.6, color:"var(--text)" },
  answerSection:   { display:"flex", flexDirection:"column", gap:12 },
  answerInput:     { background:"var(--surface2)", border:"2px solid var(--border)", borderRadius:12, color:"var(--text)", padding:"12px 16px", fontSize:16, fontFamily:"'DM Sans',sans-serif", outline:"none", width:"100%" },

  resultBanner:    { borderRadius:12, padding:"16px 20px", display:"flex", alignItems:"center", gap:12 },
  resultEmoji:     { fontSize:28, fontWeight:700, color:"#fff" },
  resultLabel:     { fontFamily:"'Bebas Neue',sans-serif", fontSize:32, color:"#fff", letterSpacing:"0.08em" },
  matchBadge:      { display:"flex", alignItems:"center", gap:8, borderRadius:8, padding:"8px 12px" },
  matchBadgeText:  { fontSize:11, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", color:"var(--muted)" },
  correctAnswerBox:{ borderRadius:10, padding:"12px 16px", display:"flex", flexDirection:"column", gap:4 },
  correctAnswerLabel:{ fontSize:10, color:"var(--red)", textTransform:"uppercase", letterSpacing:"0.1em", fontWeight:700 },
  correctAnswerText: { fontSize:16, fontWeight:600, color:"var(--text)" },
  yourAnswerText:    { fontSize:12, color:"var(--muted)" },
  statsGrid:      { display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 },
  statCard:       { background:"var(--surface2)", borderRadius:10, padding:"12px 14px", display:"flex", flexDirection:"column", gap:4 },
  statCardBig:    { gridColumn:"span 2", background:"rgba(245,197,24,0.06)", border:"1px solid rgba(245,197,24,0.2)" },
  statLabel:      { fontSize:10, color:"var(--muted)", textTransform:"uppercase", letterSpacing:"0.1em", fontWeight:600 },
  statValue:      { fontSize:16, fontWeight:600, color:"var(--text)" },
  statValueBig:   { fontSize:28, fontFamily:"'Bebas Neue',sans-serif", color:"var(--gold)", letterSpacing:"0.04em" },
  streakMessage:  { textAlign:"center", fontSize:13, lineHeight:1.6, color:"var(--muted)", fontStyle:"italic", borderTop:"1px solid var(--border)", paddingTop:16 },
  alreadyPlayedNotice:{ textAlign:"center", fontSize:12, color:"var(--muted)", background:"var(--surface2)", borderRadius:8, padding:"10px 14px", lineHeight:1.5 },

  modalOverlay: { position:"fixed", inset:0, background:"rgba(0,0,0,0.72)", backdropFilter:"blur(4px)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:100 },
  modal:        { background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"20px 20px 0 0", padding:"28px 24px 36px", width:"100%", maxWidth:480, display:"flex", flexDirection:"column", gap:20, maxHeight:"90vh", overflowY:"auto" },
  modalHeader:  { display:"flex", justifyContent:"space-between", alignItems:"flex-start" },
  modalEyebrow: { fontSize:11, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--gold)", marginBottom:4 },
  modalTitle:   { fontFamily:"'Bebas Neue',sans-serif", fontSize:36, color:"var(--text)", letterSpacing:"0.02em", lineHeight:1 },
  modalClose:   { background:"var(--surface2)", border:"1px solid var(--border)", color:"var(--muted)", borderRadius:"50%", width:32, height:32, cursor:"pointer", fontSize:13, fontFamily:"'DM Sans',sans-serif", flexShrink:0, transition:"all 0.15s", display:"flex", alignItems:"center", justifyContent:"center" },
  modalRules:   { display:"flex", flexDirection:"column", gap:16 },
  ruleRow:      { display:"flex", gap:14, alignItems:"flex-start" },
  ruleIcon:     { width:36, height:36, borderRadius:10, background:"rgba(245,197,24,0.12)", border:"1px solid rgba(245,197,24,0.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 },
  ruleHeading:  { fontSize:13, fontWeight:700, color:"var(--text)", marginBottom:3 },
  ruleBody:     { fontSize:12, color:"var(--muted)", lineHeight:1.6 },
  modalNote:    { fontSize:12, color:"var(--muted)", background:"var(--surface2)", borderRadius:8, padding:"10px 14px", lineHeight:1.5, textAlign:"center" },

  footer: { textAlign:"center", fontSize:11, color:"var(--muted)", letterSpacing:"0.05em" },
};
