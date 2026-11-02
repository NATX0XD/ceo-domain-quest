/** Remove score recaps that are already shown beside the Dome summary. */
export function stripFeedbackScorePrefix(text: string | undefined | null): string {
  return (text ?? '')
    .replace(/^\s*ได้\s+\d+\s*ดาว\s+จากคะแนน[^·\n]*(?:·\s*|$)/i, '')
    .trim()
}
