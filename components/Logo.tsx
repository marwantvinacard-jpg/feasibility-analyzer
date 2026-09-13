import React from 'react';

interface LogoProps {
  className?: string;
  variant?: 'full' | 'icon' | 'horizontal' | 'header';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Logo: React.FC<LogoProps> = ({
  className = '',
  variant = 'full',
  size = 'md',
}) => {
  // Brand color palette matching AI BOTS AUTOMATIONS logo
  const darkSlate = '#2E3642';
  const midSlate = '#3E4856';
  const lightSlate = '#525E70';
  const nodeWhite = '#FFFFFF';

  const sizeClasses = {
    sm: 'h-10 w-auto',
    md: 'h-16 w-auto',
    lg: 'h-28 w-auto',
    xl: 'h-40 w-auto',
  };

  const selectedSize = sizeClasses[size];

  // Precision SVG vector recreation of the AI BOTS AUTOMATIONS head emblem
  const logoIcon = (
    <svg
      viewBox="0 0 200 240"
      className={`${selectedSize} transition-transform duration-300 hover:scale-105 drop-shadow-sm`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* --- LEFT HALF: POLYGONAL FACETED FACE --- */}
      <g>
        {/* Forehead facets */}
        <polygon points="100,20 80,35 100,45" fill={midSlate} stroke="#1E2530" strokeWidth="0.8" />
        <polygon points="80,35 60,50 82,65 100,45" fill={darkSlate} stroke="#1E2530" strokeWidth="0.8" />
        <polygon points="60,50 50,75 75,85 82,65" fill="#242C38" stroke="#1E2530" strokeWidth="0.8" />
        <polygon points="100,45 82,65 100,80" fill={lightSlate} stroke="#1E2530" strokeWidth="0.8" />
        
        {/* Eyebrow & Temple facets */}
        <polygon points="82,65 75,85 100,80" fill={darkSlate} stroke="#1E2530" strokeWidth="0.8" />
        <polygon points="50,75 45,100 68,105 75,85" fill="#1C232E" stroke="#1E2530" strokeWidth="0.8" />
        
        {/* Eye socket & Nose bridge */}
        <polygon points="75,85 68,105 85,102 100,80" fill="#354050" stroke="#1E2530" strokeWidth="0.8" />
        <polygon points="85,102 100,80 100,115" fill={darkSlate} stroke="#1E2530" strokeWidth="0.8" />
        <polygon points="68,105 85,102 82,118 62,120" fill={midSlate} stroke="#1E2530" strokeWidth="0.8" />
        
        {/* Eye shape detail (Left eye) */}
        <path d="M 68 100 Q 77 94 86 100 Q 77 106 68 100 Z" fill="#E2E8F0" stroke="#1E2530" strokeWidth="0.8" />
        <circle cx="77" cy="100" r="3" fill="#1E2530" />

        {/* Cheek & Nose tip */}
        <polygon points="85,102 100,115 100,140 88,135" fill={lightSlate} stroke="#1E2530" strokeWidth="0.8" />
        <polygon points="62,120 82,118 88,135 60,145" fill={darkSlate} stroke="#1E2530" strokeWidth="0.8" />
        <polygon points="45,100 62,120 60,145 42,130" fill="#181F28" stroke="#1E2530" strokeWidth="0.8" />

        {/* Upper lip & Chin structure */}
        <polygon points="88,135 100,140 100,158 85,155" fill={midSlate} stroke="#1E2530" strokeWidth="0.8" />
        <polygon points="60,145 88,135 85,155 58,165" fill={darkSlate} stroke="#1E2530" strokeWidth="0.8" />
        <polygon points="42,130 60,145 58,165 48,160" fill="#1D242F" stroke="#1E2530" strokeWidth="0.8" />

        {/* Jawline & Lower Chin */}
        <polygon points="85,155 100,158 100,185 88,180" fill={darkSlate} stroke="#1E2530" strokeWidth="0.8" />
        <polygon points="58,165 85,155 88,180 65,185" fill="#232B37" stroke="#1E2530" strokeWidth="0.8" />
        <polygon points="88,180 100,185 100,200" fill={midSlate} stroke="#1E2530" strokeWidth="0.8" />
        <polygon points="65,185 88,180 100,200 78,192" fill={darkSlate} stroke="#1E2530" strokeWidth="0.8" />
      </g>

      {/* --- CENTER DIVIDER --- */}
      <line x1="100" y1="20" x2="100" y2="200" stroke="#151A22" strokeWidth="1.5" />

      {/* --- RIGHT HALF: NEURAL MESH & NETWORK NODES --- */}
      <g>
        {/* Subtle background facet fill for right half depth */}
        <polygon points="100,20 120,35 100,45" fill="#2E3642" opacity="0.6" />
        <polygon points="120,35 140,50 118,65 100,45" fill="#242C38" opacity="0.7" />
        <polygon points="140,50 150,75 125,85 118,65" fill="#1C232E" opacity="0.8" />
        <polygon points="100,45 118,65 100,80" fill="#354050" opacity="0.6" />
        <polygon points="118,65 125,85 100,80" fill="#2E3642" opacity="0.7" />
        <polygon points="150,75 155,100 132,105 125,85" fill="#181F28" opacity="0.85" />
        <polygon points="125,85 132,105 115,102 100,80" fill="#2A323D" opacity="0.75" />
        <polygon points="115,102 100,80 100,115" fill="#1D242F" opacity="0.8" />
        <polygon points="132,105 115,102 118,118 138,120" fill="#2E3642" opacity="0.7" />
        <polygon points="115,102 100,115 100,140 112,135" fill="#354050" opacity="0.65" />
        <polygon points="138,120 118,118 112,135 140,145" fill="#242C38" opacity="0.8" />
        <polygon points="112,135 100,140 100,158 115,155" fill="#2E3642" opacity="0.7" />
        <polygon points="140,145 112,135 115,155 142,165" fill="#1C232E" opacity="0.85" />
        <polygon points="115,155 100,158 100,185 112,180" fill="#2E3642" opacity="0.75" />
        <polygon points="142,165 115,155 112,180 135,185" fill="#1D242F" opacity="0.85" />
        <polygon points="112,180 100,185 100,200" fill="#242C38" opacity="0.9" />
        <polygon points="135,185 112,180 100,200 122,192" fill="#181F28" opacity="0.9" />

        {/* Network Connections (White constellation lines) */}
        <g stroke={nodeWhite} strokeWidth="1.2" opacity="0.85" strokeLinecap="round">
          <line x1="100" y1="20" x2="120" y2="35" />
          <line x1="120" y1="35" x2="140" y2="50" />
          <line x1="140" y1="50" x2="150" y2="75" />
          <line x1="150" y1="75" x2="155" y2="100" />
          <line x1="155" y1="100" x2="158" y2="130" />
          <line x1="158" y1="130" x2="152" y2="160" />
          <line x1="152" y1="160" x2="135" y2="185" />
          <line x1="135" y1="185" x2="122" y2="192" />
          <line x1="122" y1="192" x2="100" y2="200" />

          {/* Internal constellation network interconnects */}
          <line x1="100" y1="45" x2="120" y2="35" />
          <line x1="100" y1="45" x2="118" y2="65" />
          <line x1="120" y1="35" x2="118" y2="65" />
          <line x1="140" y1="50" x2="118" y2="65" />
          <line x1="140" y1="50" x2="125" y2="85" />
          <line x1="150" y1="75" x2="125" y2="85" />
          <line x1="100" y1="80" x2="118" y2="65" />
          <line x1="100" y1="80" x2="125" y2="85" />
          <line x1="100" y1="80" x2="115" y2="102" />
          <line x1="125" y1="85" x2="132" y2="105" />
          <line x1="155" y1="100" x2="132" y2="105" />
          <line x1="115" y1="102" x2="132" y2="105" />
          <line x1="115" y1="102" x2="100" y2="115" />
          <line x1="115" y1="102" x2="118" y2="118" />
          <line x1="132" y1="105" x2="138" y2="120" />
          <line x1="155" y1="100" x2="138" y2="120" />
          <line x1="100" y1="115" x2="112" y2="135" />
          <line x1="118" y1="118" x2="112" y2="135" />
          <line x1="138" y1="120" x2="140" y2="145" />
          <line x1="158" y1="130" x2="140" y2="145" />
          <line x1="112" y1="135" x2="140" y2="145" />
          <line x1="100" y1="140" x2="112" y2="135" />
          <line x1="100" y1="140" x2="115" y2="155" />
          <line x1="112" y1="135" x2="115" y2="155" />
          <line x1="140" y1="145" x2="142" y2="165" />
          <line x1="152" y1="160" x2="142" y2="165" />
          <line x1="115" y1="155" x2="142" y2="165" />
          <line x1="100" y1="158" x2="115" y2="155" />
          <line x1="100" y1="185" x2="112" y2="180" />
          <line x1="115" y1="155" x2="112" y2="180" />
          <line x1="142" y1="165" x2="135" y2="185" />
          <line x1="112" y1="180" x2="135" y2="185" />
          <line x1="112" y1="180" x2="122" y2="192" />
        </g>

        {/* Network Nodes (White dots at mesh intersections) */}
        <g fill={nodeWhite}>
          <circle cx="100" cy="20" r="2.5" />
          <circle cx="120" cy="35" r="3" />
          <circle cx="140" cy="50" r="3.5" />
          <circle cx="150" cy="75" r="3" />
          <circle cx="155" cy="100" r="3.5" />
          <circle cx="158" cy="130" r="3" />
          <circle cx="152" cy="160" r="2.5" />
          <circle cx="135" cy="185" r="3" />
          <circle cx="122" cy="192" r="2.5" />
          <circle cx="100" cy="200" r="2.5" />

          {/* Internal nodes */}
          <circle cx="100" cy="45" r="2.5" />
          <circle cx="118" cy="65" r="3" />
          <circle cx="100" cy="80" r="3" />
          <circle cx="125" cy="85" r="3.5" />
          <circle cx="115" cy="102" r="3.5" />
          <circle cx="132" cy="105" r="3" />
          <circle cx="100" cy="115" r="2.5" />
          <circle cx="118" cy="118" r="2.5" />
          <circle cx="138" cy="120" r="3" />
          <circle cx="112" cy="135" r="3.5" />
          <circle cx="140" cy="145" r="3" />
          <circle cx="100" cy="140" r="2.5" />
          <circle cx="115" cy="155" r="3" />
          <circle cx="142" cy="165" r="2.5" />
          <circle cx="100" cy="158" r="2" />
          <circle cx="112" cy="180" r="3" />
          <circle cx="100" cy="185" r="2" />
        </g>
      </g>
    </svg>
  );

  if (variant === 'icon') {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        {logoIcon}
      </div>
    );
  }

  if (variant === 'header') {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className="flex-shrink-0 bg-slate-900 p-1.5 rounded-lg shadow-md border border-slate-800">
          {logoIcon}
        </div>
        <div className="flex flex-col">
          <span className="font-sans text-lg md:text-xl font-black tracking-wider text-slate-900 leading-tight uppercase">
            AI BOTS
          </span>
          <span className="text-[9px] md:text-[10px] font-bold text-slate-500 tracking-[0.35em] uppercase leading-none mt-0.5">
            AUTOMATIONS
          </span>
          <span className="text-[10px] font-semibold text-emerald-600 tracking-wider uppercase mt-1">
            ARCHITECT
          </span>
        </div>
      </div>
    );
  }

  if (variant === 'horizontal') {
    return (
      <div className={`flex flex-col md:flex-row items-center gap-4 md:gap-6 ${className}`}>
        <div className="bg-slate-900 p-3 rounded-xl shadow-lg border border-slate-800 flex-shrink-0">
          {logoIcon}
        </div>
        <div className="text-center md:text-left">
          <h1 className="font-sans text-2xl md:text-3xl font-black text-slate-900 tracking-wider uppercase">
            AI BOTS <span className="font-normal text-slate-600">AUTOMATIONS</span>
          </h1>
          <p className="text-sm font-semibold text-emerald-600 tracking-wider uppercase mt-0.5">
            ARCHITECT APP
          </p>
          <p className="text-xs text-gray-500 font-medium mt-1">
            Next-generation AI-powered architectural and interior visualization engine
          </p>
        </div>
      </div>
    );
  }

  // Default: Full stacked branding logo
  return (
    <div className={`flex flex-col items-center text-center ${className}`}>
      <div className="bg-slate-900 p-4 rounded-2xl shadow-xl border border-slate-800 mb-4">
        {logoIcon}
      </div>
      
      <div className="space-y-1 font-sans">
        <h2 className="text-2xl md:text-3xl font-black tracking-widest text-slate-900 uppercase">
          AI BOTS
        </h2>
        <p className="text-xs md:text-sm font-bold text-slate-500 tracking-[0.4em] uppercase">
          AUTOMATIONS
        </p>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-200 w-full max-w-xs">
        <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full tracking-wider uppercase border border-emerald-200">
          ARCHITECT APP
        </span>
      </div>
    </div>
  );
};
