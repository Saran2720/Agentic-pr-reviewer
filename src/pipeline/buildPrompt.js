export function buildreviewPrompt({
  file,
  ragContext,
  prTitle,
  prDescription,
}) {
  return `You are a senior software engineer reviewing a pull request.
    PR Title:${prTitle}
    PR Description:${prDescription}
    ${ragContext ? `Context from related files:\n${ragContext}` : ""}

    Now review this file change:
    Filename:${file.filename}
    Diff:${file.patch.slice(0, 2000)}

    Provide your review in this exact json format:
    {
     "comments":[
     {
      "line": <line number as integer>,
      "issue": "<what is wrong>",
      "suggestion": "<how to fix it>",
      "severity": "critical" | "warning" | "suggestion"
     }
    ],
     "verdict": "approve" | "request_changes",
    "summary": "<2-3 sentence overall summary of this file's changes>"
    }
    Rules:
- Only comment on real issues, not style preferences
- If the code looks good, return empty comments array and verdict "approve"
- Return valid JSON only, no extra text`;
}
