/**
 * Evaluation harness — golden prompts and scorecards (ROADMAP #84).
 */

export interface EvalCase {
  id: string;
  prompt: string;
  expectedContains?: string[];
  suite: string;
}

export interface EvalResult {
  caseId: string;
  passed: boolean;
  output: string;
  latencyMs: number;
}

const BUILTIN_CASES: EvalCase[] = [
  {
    id: "smoke-hello",
    prompt: "Reply with exactly: OK",
    expectedContains: ["OK"],
    suite: "smoke",
  },
  {
    id: "smoke-math",
    prompt: "What is 2+2? Reply with just the number.",
    expectedContains: ["4"],
    suite: "smoke",
  },
  {
    id: "humaneval-style",
    prompt: "Write a one-line JavaScript function that returns the sum of two numbers.",
    expectedContains: ["function", "return"],
    suite: "humaneval-lite",
  },
];

export function listEvalCases(suite?: string): EvalCase[] {
  if (!suite) return BUILTIN_CASES;
  return BUILTIN_CASES.filter((c) => c.suite === suite);
}

export async function runEvalCase(
  run: (prompt: string) => Promise<string>,
  testCase: EvalCase,
): Promise<EvalResult> {
  const start = performance.now();
  const output = await run(testCase.prompt);
  const latencyMs = performance.now() - start;
  const passed =
    !testCase.expectedContains?.length ||
    testCase.expectedContains.every((s) =>
      output.toLowerCase().includes(s.toLowerCase()),
    );
  return { caseId: testCase.id, passed, output, latencyMs };
}

export async function runEvalSuite(
  run: (prompt: string) => Promise<string>,
  suite: string,
): Promise<{ results: EvalResult[]; score: number }> {
  const cases = listEvalCases(suite);
  const results: EvalResult[] = [];
  for (const c of cases) {
    results.push(await runEvalCase(run, c));
  }
  const score = results.filter((r) => r.passed).length / Math.max(1, results.length);
  return { results, score };
}
