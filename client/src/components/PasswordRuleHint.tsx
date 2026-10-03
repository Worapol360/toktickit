export const PASSWORD_RULE_TEXT = 'Password must be at least 8 characters and include a letter and a number.';

export function PasswordRuleHint() {
  return <p>{PASSWORD_RULE_TEXT}</p>;
}