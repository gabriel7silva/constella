/**
 * Detect when an agent's message is aimed at the OPERATOR (the human) — either an
 * explicit reserved mention (@operator / @you) or an approval/decision request. The
 * operator has no agent @handle, so this is how an agent "pings the human". Used to
 * raise a persistent in-chat notification (and an inbox approval when it's a request).
 */
const OPERATOR_MENTION = /@(operator|you|boss|human)\b/i;
const ANY_MENTION = /@[a-z0-9-]+/i;
const APPROVAL_REQUEST =
  /\b(approv(e|al)?|sign[- ]?off|go[- ]?ahead|your (ok|sign|approval|decision|call)|permission to|need(s|ed)?\s+(your|operator|human|approval)|should i\b|may i\b|can i\s+(proceed|merge|deploy|continue|ship)|waiting (for|on)\s+(you|your|approval|operator)|please\s+(confirm|approve|decide|review))\b/i;

export function detectOperatorSignals(text: string): { mention: boolean; approvalRequest: boolean } {
  const explicitOperator = OPERATOR_MENTION.test(text);
  const approvalRequest = APPROVAL_REQUEST.test(text);
  // Agents constantly use approval-ish phrasing toward each OTHER ("@grace should I update the
  // footer?", "@edsger please review"). That must NOT ping the human. An approval/decision request
  // reaches the operator ONLY when it isn't directed at a teammate: an explicit @operator, OR
  // approval phrasing with no other @mention at all (a true "asking the human" message).
  const directedAtTeammate = !explicitOperator && ANY_MENTION.test(text);
  const mention = explicitOperator || (approvalRequest && !directedAtTeammate);
  return { mention, approvalRequest };
}
