"use client";
import { useActionState } from "react";
import { loginAction } from "@/lib/actions";

export default function Login() {
  const [state, action, pending] = useActionState(loginAction, null);
  return (
    <div className="login">
      <div className="box">
        <h1>Administració</h1>
        <form action={action}>
          <label className="lbl">Correu electrònic</label><input name="email" type="email" required autoComplete="username" />
          <label className="lbl">Contrasenya</label><input name="password" type="password" required autoComplete="current-password" />
          {state?.error && <div className="msg err">{state.error}</div>}
          <button className="btn" disabled={pending}>Entrar</button>
        </form>
      </div>
    </div>
  );
}
