import { NextResponse } from "next/server";

// ─── Matching helpers ─────────────────────────────────────────────────────────

const normalize = (s) =>
  s
    .toLowerCase()
    .replace(/['''"".,()\-]/g, "")
    .replace(/\b(the|a|an)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

// Conservative plural stemming: strip trailing 's' from words of 5+ chars.
// Avoids mutating short words like "rays", "days", "this", "was", "us".
const stem = (w) => (w.length >= 5 && w.endsWith("s") ? w.slice(0, -1) : w);

// Connective words to ignore when comparing multi-ingredient answers
const STOP_WORDS = new Set(["and", "or", "of", "in", "with"]);

// Produce a stemmed, de-stopworded token array from an answer string
// Note: allow single-char tokens (digits like "1","2") so numeric list answers work
const tokenize = (s) =>
  normalize(s)
    .split(" ")
    .filter((w) => w.length >= 1 && !STOP_WORDS.has(w))
    .map(stem);

function tierExact(userAnswer, correctAnswer, alternateAnswers) {
  const u = userAnswer.toLowerCase();
  const c = correctAnswer.toLowerCase();
  const alts = alternateAnswers.map((a) => a.toLowerCase());
  if (u === c || alts.includes(u)) return { correct: true, method: "exact" };
  return null;
}

function tierNormalized(userAnswer, correctAnswer, alternateAnswers) {
  const nu = normalize(userAnswer);
  const nc = normalize(correctAnswer);
  if (nu === nc || alternateAnswers.map(normalize).includes(nu)) {
    return { correct: true, method: "normalized" };
  }
  return null;
}

function tierKeyword(userAnswer, correctAnswer, alternateAnswers) {
  const uw = normalize(userAnswer).split(" ");
  const allAnswers = [correctAnswer, ...alternateAnswers];

  // Only attempt keyword matching when the user gave a short answer (1-2 words).
  // A longer user answer that merely contains a keyword from an alternate is not
  // a reliable signal and risks false positives (e.g. "parts" matching "equal parts").
  if (uw.length > 2) return null;

  for (const answer of allAnswers) {
    const cw = normalize(answer).split(" ");
    const last = cw[cw.length - 1];
    // User's single/double answer matches the last significant word of a candidate
    if (last.length > 2 && uw.includes(last)) {
      return { correct: true, method: "keyword" };
    }
    // Single-word user answer that appears verbatim in a candidate
    if (uw.length === 1 && cw.includes(uw[0]) && uw[0].length > 3) {
      return { correct: true, method: "keyword" };
    }
  }
  return null;
}

// Levenshtein distance between two strings
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// Accept answers within 1 edit for short words, 2 edits for longer ones
function tierFuzzy(userAnswer, correctAnswer, alternateAnswers) {
  const nu = normalize(userAnswer);
  if (nu.length < 4) return null; // don't fuzzy-match very short answers
  const candidates = [correctAnswer, ...alternateAnswers].map(normalize);
  for (const candidate of candidates) {
    if (!candidate || candidate.length < 4) continue;
    const threshold = Math.max(nu.length, candidate.length) <= 6 ? 1 : 2;
    if (levenshtein(nu, candidate) <= threshold) {
      return { correct: true, method: "fuzzy" };
    }
  }
  return null;
}

// Handles multi-ingredient / any-order answers (e.g. mirepoix, state lists).
// Only activates when the correct answer (or an alternate) has 3+ content words.
// Checks that every stemmed canonical token appears in the user's token set AND
// the user hasn't introduced extra content tokens (≤1 allowed for natural phrasing).
function tierWordSet(userAnswer, correctAnswer, alternateAnswers = []) {
  const allAnswers = [correctAnswer, ...alternateAnswers];
  const userTokens = tokenize(userAnswer);
  const userTokenSet = new Set(userTokens);

  for (const answer of allAnswers) {
    const correctTokens = tokenize(answer);
    if (correctTokens.length < 3) continue;
    const correctTokenSet = new Set(correctTokens);
    // All correct tokens must appear in user answer
    if (!correctTokens.every((t) => userTokenSet.has(t))) continue;
    // User answer must not introduce more than 1 unrecognized content token
    const extraTokens = userTokens.filter((t) => !correctTokenSet.has(t));
    if (extraTokens.length > 1) continue;
    return { correct: true, method: "word-set" };
  }
  return null;
}

async function tierAI(userAnswer, correctAnswer, question, category) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "your-key-here") {
    return { correct: false, method: "ai-error" };
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 10,
        system: `You are a strict trivia judge. Spelling checkers, fuzzy matchers, and synonym checks have already run before you. Your sole job is to catch answers that are factually and semantically equivalent but phrased differently.

Rules you MUST follow:
- Numbers, ratios, percentages, and measurements must be exact. 1:1 is NOT the same as 100:1. 50% is NOT the same as 25%.
- For list answers, all required items must be present — order does NOT matter, but nothing can be missing or wrong.
- Do NOT accept an answer that is merely related to or reminiscent of the correct answer.
- Do NOT accept partial answers unless the question clearly asks for a partial.
- When in doubt, say NO.

Reply YES or NO only. Nothing else.`,
        messages: [
          {
            role: "user",
            content: `Category: ${category}\nQuestion: ${question}\nCorrect answer: ${correctAnswer}\nPlayer answered: ${userAnswer}\n\nIs the player's answer correct? YES or NO.`,
          },
        ],
      }),
    });

    if (!res.ok) return { correct: false, method: "ai-error" };

    const data = await res.json();
    const verdict = data?.content?.[0]?.text?.trim().toUpperCase();
    return { correct: verdict === "YES", method: "ai" };
  } catch {
    return { correct: false, method: "ai-error" };
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { userAnswer, correctAnswer, alternateAnswers, question, category } = body;

  if (!userAnswer || !correctAnswer || !Array.isArray(alternateAnswers)) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const result =
    tierExact(userAnswer, correctAnswer, alternateAnswers) ||
    tierNormalized(userAnswer, correctAnswer, alternateAnswers) ||
    tierKeyword(userAnswer, correctAnswer, alternateAnswers) ||
    tierFuzzy(userAnswer, correctAnswer, alternateAnswers) ||
    tierWordSet(userAnswer, correctAnswer, alternateAnswers) ||
    (await tierAI(userAnswer, correctAnswer, question, category));

  return NextResponse.json(result);
}
