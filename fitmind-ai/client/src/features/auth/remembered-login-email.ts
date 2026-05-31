const REMEMBERED_LOGIN_EMAIL_KEY = "fitmind:last-login-email";

export function getRememberedLoginEmail(): string {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    return window.localStorage.getItem(REMEMBERED_LOGIN_EMAIL_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveRememberedLoginEmail(email: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const trimmedEmail = email.trim();

    if (trimmedEmail) {
      window.localStorage.setItem(REMEMBERED_LOGIN_EMAIL_KEY, trimmedEmail);
      return;
    }

    window.localStorage.removeItem(REMEMBERED_LOGIN_EMAIL_KEY);
  } catch {
    // Remembering the email is optional; auth should continue normally.
  }
}
