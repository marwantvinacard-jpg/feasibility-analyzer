import React from "react";
import { Link } from "react-router-dom";
import { Logo } from "../components/Logo";
import { AIDisclaimer } from "../components/AIDisclaimer";
import { useAuth } from "../context/AuthContext";
import {
  Sparkles,
  KeyRound,
  Images,
  ShieldCheck,
  Wand2,
  ArrowRight,
} from "lucide-react";

const Feature: React.FC<{
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}> = ({ icon, title, children }) => (
  <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
    <div className="w-12 h-12 rounded-xl bg-gold-50 text-gold-600 flex items-center justify-center mb-4">
      {icon}
    </div>
    <h3 className="font-bold text-lg mb-2">{title}</h3>
    <p className="text-gray-500 text-sm leading-relaxed">{children}</p>
  </div>
);

export const LandingPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 text-charcoal font-sans">
      {/* Nav */}
      <header className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <Logo variant="header" size="sm" />
        <div className="flex items-center gap-3">
          {user ? (
            <Link
              to="/app"
              className="bg-charcoal text-white font-bold px-5 py-2.5 rounded-full hover:bg-black"
            >
              Open Studio
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="px-5 py-2.5 rounded-full font-semibold text-gray-600 hover:text-charcoal"
              >
                Sign in
              </Link>
              <Link
                to="/signup"
                className="bg-charcoal text-white font-bold px-5 py-2.5 rounded-full hover:bg-black"
              >
                Request access
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 text-center pt-16 pb-20">
        <div className="inline-flex items-center gap-2 bg-gold-50 text-gold-700 text-xs font-bold uppercase tracking-wider px-4 py-1.5 rounded-full mb-6">
          <Sparkles size={14} /> AI Interior & Architectural Design
        </div>
        <h1 className="font-serif text-5xl lg:text-6xl leading-tight mb-6">
          Reimagine luxury spaces in seconds
        </h1>
        <p className="text-gray-500 text-lg lg:text-xl font-light max-w-2xl mx-auto mb-10">
          Upload a space or describe your vision, choose any style you like,
          and generate five photorealistic, brochure-quality interpretations
          of that exact direction — every time.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            to={user ? "/app" : "/signup"}
            className="inline-flex items-center gap-2 bg-gold-500 text-white font-bold px-8 py-4 rounded-full text-lg shadow-xl hover:bg-gold-600 hover:-translate-y-0.5 transition-all"
          >
            {user ? "Open Studio" : "Get started"} <ArrowRight size={20} />
          </Link>
        </div>
        <p className="text-xs text-gray-400 mt-4">
          Bring your own Gemini API key · Access granted after admin approval
        </p>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Feature icon={<Wand2 size={22} />} title="Any style, five takes">
            Describe or pick any style you want — the AI explores it from five
            creative angles so you can compare variations instantly.
          </Feature>
          <Feature icon={<KeyRound size={22} />} title="Your own API key">
            Use your personal Gemini key. It's encrypted at rest and only ever
            used for your own generations.
          </Feature>
          <Feature icon={<Images size={22} />} title="Persistent gallery">
            Every design you create is saved to your private gallery, available
            from any device.
          </Feature>
          <Feature icon={<ShieldCheck size={22} />} title="Controlled access">
            Studios stay private — new members are reviewed and approved by an
            administrator before they can generate.
          </Feature>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white border-y border-gray-200 py-16">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="font-serif text-3xl text-center mb-10">How it works</h2>
          <ol className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            {[
              ["1", "Request access", "Sign up and wait for admin approval."],
              ["2", "Add your key", "Drop in your Gemini API key in Settings."],
              ["3", "Generate", "Create and save unlimited design concepts."],
            ].map(([n, t, d]) => (
              <li key={n}>
                <div className="mx-auto w-12 h-12 rounded-full bg-charcoal text-white font-black flex items-center justify-center mb-4">
                  {n}
                </div>
                <h3 className="font-bold mb-1">{t}</h3>
                <p className="text-gray-500 text-sm">{d}</p>
              </li>
            ))}
          </ol>
          <div className="text-center mt-12">
            <Link
              to={user ? "/app" : "/signup"}
              className="inline-flex items-center gap-2 bg-charcoal text-white font-bold px-8 py-4 rounded-full hover:bg-black"
            >
              {user ? "Open Studio" : "Request access"} <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-white py-10">
        <div className="max-w-7xl mx-auto px-6 space-y-6">
          <AIDisclaimer variant="dark" />
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
            <span className="font-sans font-black tracking-widest uppercase">
              AI BOTS AUTOMATIONS
            </span>
            <p className="text-xs text-slate-400">
              © 2026 AI BOTS AUTOMATIONS. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};
