const EMAIL_RE =
  /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+.\-]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;

export function normalizeEmail(raw: unknown): string {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (!value || !EMAIL_RE.test(value)) return "";
  return value;
}

export { EMAIL_RE };
