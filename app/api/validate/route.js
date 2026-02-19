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
const tokenize = (s) =>
  normalize(s)
    .split(" ")
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
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

function tierKeyword(userAnswer, correctAnswer) {
  const uw = normalize(userAnswer).split(" ");
  const cw = normalize(correctAnswer).split(" ");
  const last = cw[cw.length - 1];
  // Last significant word of correct answer found in user's answer
  if (last.length > 2 && uw.includes(last)) {
    return { correct: true, method: "keyword" };
  }
  // Single-word user answer that appears in the correct answer
  if (uw.length === 1 && cw.includes(uw[0]) && uw[0].length > 3) {
    return { correct: true, method: "keyword" };
  }
  return null;
}

// Handles multi-ingredient / any-order answers (e.g. mirepoix).
// Only activates when the correct answer has 3+ content words.
// Checks that every stemmed canonical word appears in the user's stemmed word set,
// regardless of order or singular/plural form.
function tierWordSet(userAnswer, correctAnswer) {
  const correctTokens = tokenize(correctAnswer);
  if (correctTokens.length < 3) return null;
  const userTokenSet = new Set(tokenize(userAnswer));
  if (correctTokens.every((t) => userTokenSet.has(t))) {
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
        system: "You are a strict trivia judge. Reply YES or NO only.",
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
    tierKeyword(userAnswer, correctAnswer) ||
    tierWordSet(userAnswer, correctAnswer) ||
    (await tierAI(userAnswer, correctAnswer, question, category));

  return NextResponse.json(result);
}
