import { useState } from "react";

import type { LoginRequest, RegisterRequest } from "../../../../shared/src/auth";

import type { AuthStatus } from "./use-auth";

type AuthMode = "login" | "register";

export interface AuthScreenProps {
  errorMessage: string | null;
  onLogin: (input: LoginRequest) => Promise<void>;
  onRegister: (input: RegisterRequest) => Promise<void>;
  status: AuthStatus;
}

/**
 * Renders the minimal Phase 1.3 auth UI for register and login flows.
 *
 * @param props - Current auth status plus submit handlers
 * @returns The auth entry screen
 */
export function AuthScreen(props: AuthScreenProps) {
  const { errorMessage, onLogin, onRegister, status } = props;
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const isSubmitting = status === "authenticating";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (mode === "register") {
      await onRegister({
        email,
        password,
        display_name: displayName.trim() || undefined,
      });
      return;
    }

    await onLogin({
      email,
      password,
    });
  }

  return (
    <section>
      <h2>{mode === "login" ? "Login" : "Register"}</h2>
      <p>Phase 1.3 MVP currently supports only the minimal auth entry flow.</p>
      <div>
        <button type="button" disabled={isSubmitting} onClick={() => setMode("login")}>
          Login
        </button>
        <button type="button" disabled={isSubmitting} onClick={() => setMode("register")}>
          Register
        </button>
      </div>
      <form onSubmit={handleSubmit}>
        <label>
          Email
          <input
            autoComplete="email"
            disabled={isSubmitting}
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>
        <label>
          Password
          <input
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            disabled={isSubmitting}
            minLength={8}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>
        {mode === "register" ? (
          <label>
            Display name
            <input
              autoComplete="nickname"
              disabled={isSubmitting}
              onChange={(event) => setDisplayName(event.target.value)}
              type="text"
              value={displayName}
            />
          </label>
        ) : null}
        <button disabled={isSubmitting} type="submit">
          {isSubmitting
            ? "Submitting..."
            : mode === "login"
              ? "Login"
              : "Create account"}
        </button>
      </form>
      {errorMessage ? <p>Error: {errorMessage}</p> : null}
    </section>
  );
}
