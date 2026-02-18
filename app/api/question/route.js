import { NextResponse } from "next/server";
import questions from "../../questions.json";

// Always compute the date fresh at request time — never cache.
export const dynamic = "force-dynamic";

export async function GET() {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD in UTC

  // Only return the question whose date matches today.
  // This implicitly prevents future questions from ever being returned.
  const question = questions.find((q) => q.date === today);

  if (!question) {
    return NextResponse.json(
      { error: "No question available for today." },
      { status: 404 }
    );
  }

  return NextResponse.json(question);
}
