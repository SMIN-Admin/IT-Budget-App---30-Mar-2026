"use client";

import { signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "../../src/lib/firebase-client";

export default function LoginPage() {
  const login = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();

      const res = await fetch("/api/auth/firebase-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ idToken }),
      });

      const data = await res.json();

      if (!res.ok) {
        await signOut(auth);
        alert(data.error || "Login failed");
        return;
      }

      window.location.href = "/";
    } catch (error: any) {
      console.error("Firebase login error:", error);
      alert("Login failed: " + (error?.message || "Unknown error"));
    }
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <button
        onClick={login}
        style={{
          padding: "16px 24px",
          fontSize: "18px",
          cursor: "pointer",
          background: "#000",
          color: "#fff",
          borderRadius: "6px",
        }}
      >
        Sign in with Google
      </button>
    </div>
  );
}