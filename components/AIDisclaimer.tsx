import React from 'react';
import { Sparkles } from 'lucide-react';

interface AIDisclaimerProps {
  /** 'light' for white/cream pages (Landing, Studio, Gallery), 'dark' for the slate Pro Studio surface. */
  variant?: 'light' | 'dark';
  className?: string;
}

/**
 * Transparency notice shown wherever AI-generated output is created or
 * displayed. Being upfront about what the AI does (and doesn't do) builds
 * trust with buyers evaluating hospitality-grade renders — and every render
 * still needs sign-off from a licensed architect/engineer before it informs
 * real construction or procurement decisions.
 */
export const AIDisclaimer: React.FC<AIDisclaimerProps> = ({ variant = 'light', className = '' }) => {
  const isDark = variant === 'dark';
  return (
    <div
      role="note"
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-xs leading-relaxed ${
        isDark
          ? 'bg-slate-900/60 border-slate-800 text-slate-400'
          : 'bg-gray-50 border-gray-200 text-gray-500'
      } ${className}`}
    >
      <Sparkles size={16} className={`shrink-0 mt-0.5 ${isDark ? 'text-emerald-400' : 'text-gold-500'}`} aria-hidden="true" />
      <p>
        <strong className={isDark ? 'text-slate-200' : 'text-charcoal'}>
          Lumina Studio uses AI (Google Gemini) to generate these concepts.
        </strong>{' '}
        Renders are creative visualizations, not architectural or engineering
        documents — dimensions, structural elements, and material feasibility
        should always be verified by a licensed architect, engineer, or
        contractor before any concept is used for construction, procurement,
        or investment decisions.
      </p>
    </div>
  );
};
