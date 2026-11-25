/** Returns a message if the password is too weak, otherwise null. */
export function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return 'Password must be at least 8 characters.';
  if (pw.length > 72) return 'Password must be 72 characters or fewer.';
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return 'Use both letters and numbers.';
  return null;
}
