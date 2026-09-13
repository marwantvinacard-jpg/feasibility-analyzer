import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface AuthPageProps {
  mode: "login" | "signup";
}

function friendlyError(code: string): string {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Incorrect email or password.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Try signing in.";
    case "auth/weak-password":
      return "Password should be at least 6 characters.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export const AuthPage: React.FC<AuthPageProps> = ({ mode }) => {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isSignup = mode === "signup";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isSignup) {
        await signUp(name, email, password);
      } else {
        await signIn(email, password);
      }
      navigate("/app");
    } catch (err: any) {
      setError(friendlyError(err?.code || ""));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-gray-500 hover:text-charcoal mb-8 text-sm font-medium"
        >
          <ArrowLeft size={18} /> Back to home
        </Link>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 sm:p-10">
          <div className="text-center mb-8">
            <h1 className="font-serif text-3xl text-charcoal mb-1">
              {isSignup ? "Request access" : "Welcome back"}
            </h1>
            <p className="text-gray-500">
              {isSignup ? "Create your studio account" : "Sign in to your studio"}
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {isSignup && (
              <div>
                <label className="block text-sm font-bold text-charcoal mb-1.5">
                  Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent"
                  placeholder="Your name"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-bold text-charcoal mb-1.5">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-charcoal mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent"
                placeholder={isSignup ? "Create a password" : "Your password"}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-charcoal text-white font-bold py-3.5 rounded-lg hover:bg-black transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="animate-spin" size={18} />}
              {isSignup ? "Create account" : "Sign in"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            {isSignup ? (
              <>
                Already have an account?{" "}
                <Link to="/login" className="text-gold-600 font-bold">
                  Sign in
                </Link>
              </>
            ) : (
              <>
                Don't have an account?{" "}
                <Link to="/signup" className="text-gold-600 font-bold">
                  Request access
                </Link>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};
