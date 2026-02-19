import { NextResponse } from "next/server";
import questions from "../../questions.json";

// Always compute the date fresh at request time — never cache.
export const dynamic = "force-dynamic";

export async function GET() {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" }); // YYYY-MM-DD in Pacific time

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
