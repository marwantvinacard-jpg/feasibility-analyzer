import React from "react";
import { Link } from "react-router-dom";
import { Clock, Ban } from "lucide-react";
import { useAuth } from "../context/AuthContext";

/** Full-screen "not approved yet" / "disabled" message. */
export const GateScreen: React.FC<{ disabled?: boolean }> = ({ disabled }) => (
  <div className="max-w-lg mx-auto text-center py-24 px-6 fade-in">
    <div
      className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-6 ${
        disabled ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"
      }`}
    >
      {disabled ? <Ban size={30} /> : <Clock size={30} />}
    </div>
    <h2 className="font-serif text-3xl text-charcoal mb-3">
      {disabled ? "Account disabled" : "Awaiting approval"}
    </h2>
    <p className="text-gray-500 leading-relaxed">
      {disabled
        ? "Your access has been disabled by an administrator. Please reach out if you believe this is a mistake."
        : "Thanks for signing up! An administrator needs to approve your account before you can start generating. You'll be able to use the studio as soon as you're approved."}
    </p>
    {!disabled && (
      <p className="text-sm text-gray-400 mt-6">
        You can add your Gemini API key now in{" "}
        <Link to="/settings" className="text-gold-600 font-semibold">
          Settings
        </Link>{" "}
        so you're ready to go.
      </p>
    )}
  </div>
);

/**
 * Wraps tool pages so only approved (active) users see the tool; pending or
 * disabled users see the gate screen instead.
 */
export const AccountGate: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { profile } = useAuth();
  if (profile && profile.status !== "active") {
    return <GateScreen disabled={profile.status === "disabled"} />;
  }
  return <>{children}</>;
};
