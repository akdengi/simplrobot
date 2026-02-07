import React from 'react';
import { 
  ArrowUp, 
  ArrowDown, 
  RotateCcw, 
  RotateCw, 
  Sword, 
  Shield, 
  Zap,
  Cpu,
  Move,
  X
} from 'lucide-react';

const PixelSvg = ({ children, className }: { children?: React.ReactNode, className?: string }) => (
  <svg 
    viewBox="0 0 16 16" 
    xmlns="http://www.w3.org/2000/svg" 
    shapeRendering="crispEdges" // CRITICAL for pixel art look
    className={`w-full h-full ${className || ''}`}
  >
    {children}
  </svg>
);

export const Icons = {
  // --- Card Icons (Clean Vector Icons) ---
  ForwardSymbol: () => <ArrowUp size={24} strokeWidth={3} />,
  BackwardSymbol: () => <ArrowDown size={24} strokeWidth={3} />,
  TurnLeftSymbol: () => <RotateCcw size={24} strokeWidth={3} />,
  TurnRightSymbol: () => <RotateCw size={24} strokeWidth={3} />,
  AttackSymbol: () => <Sword size={24} strokeWidth={3} />,
  DefendSymbol: () => <Shield size={24} strokeWidth={3} />,
  CardArrow: () => <ArrowUp size={16} strokeWidth={4} />,

  // --- UI Icons ---
  SystemHead: () => <Cpu size={16} />,
  SystemChassis: () => <Move size={16} />,
  SystemWeapon: () => <Sword size={16} />,
  Damage: () => <Zap size={16} className="text-yellow-400" />,

  // --- ENTITY PIXEL ART SPRITES (16x16 Grid) ---
  // Default orientation: UP (North)

  // Player Robot (Blue)
  // Palette: Dark Blue (#1d4ed8), Light Blue (#60a5fa), White, Black
  RobotPlayer: () => (
    <PixelSvg>
      {/* Treads */}
      <rect x="2" y="3" width="3" height="10" fill="#333" />
      <rect x="11" y="3" width="3" height="10" fill="#333" />
      
      {/* Body */}
      <rect x="4" y="4" width="8" height="8" fill="#1e40af" /> 
      <rect x="5" y="5" width="6" height="6" fill="#3b82f6" />
      
      {/* Cockpit / Head */}
      <rect x="6" y="6" width="4" height="2" fill="#000" />
      <rect x="7" y="6" width="2" height="2" fill="#06b6d4" />
      
      {/* Sword (Right hand, facing UP) */}
      <rect x="13" y="2" width="2" height="8" fill="#cbd5e1" />
      <rect x="13" y="10" width="2" height="2" fill="#64748b" />
      <rect x="14" y="2" width="1" height="8" fill="#fff" opacity="0.5" />
      
      {/* Shield/Arm (Left hand) */}
      <rect x="1" y="6" width="2" height="4" fill="#1e3a8a" />
      
      {/* Direction Indicator (Yellow triangle at top) */}
      <path d="M7 1 h2 v1 h-2 z M6 2 h4 v1 h-4 z" fill="#facc15" />
    </PixelSvg>
  ),

  // Bot Robot (Red)
  // Palette: Dark Red (#7f1d1d), Red (#dc2626), Green Eye
  RobotBot: () => (
    <PixelSvg>
      {/* Treads */}
      <rect x="2" y="2" width="3" height="11" fill="#292524" />
      <rect x="11" y="2" width="3" height="11" fill="#292524" />
      
      {/* Body */}
      <rect x="4" y="3" width="8" height="9" fill="#7f1d1d" />
      <rect x="5" y="4" width="6" height="6" fill="#b91c1c" />
      
      {/* Eye */}
      <rect x="6" y="5" width="4" height="3" fill="#000" />
      <rect x="7" y="6" width="2" height="1" fill="#4ade80" />
      
      {/* Spikes */}
      <rect x="3" y="1" width="1" height="2" fill="#991b1b" />
      <rect x="12" y="1" width="1" height="2" fill="#991b1b" />
      
      {/* Blade (Right Hand) */}
      <path d="M14 1 h2 v2 h-1 v1 h-1 v1 h1 v1 h-1 v1 h-1 v2 h-1 v2 h2 v-2 h1 v-2 h1 v-6 z" fill="#a8a29e" />
      
      {/* Direction Indicator (Red pixel at top) */}
      <rect x="7" y="0" width="2" height="2" fill="#ef4444" />
    </PixelSvg>
  ),
  
  // Barrel (Brown)
  Barrel: () => (
    <PixelSvg>
      <rect x="3" y="2" width="10" height="12" fill="#78350f" />
      <rect x="3" y="2" width="10" height="1" fill="#451a03" /> {/* Top Rim */}
      <rect x="3" y="13" width="10" height="1" fill="#451a03" /> {/* Bottom Rim */}
      <rect x="3" y="5" width="10" height="1" fill="#000" opacity="0.4" /> {/* Hoop 1 */}
      <rect x="3" y="10" width="10" height="1" fill="#000" opacity="0.4" /> {/* Hoop 2 */}
      {/* Highlights */}
      <rect x="4" y="3" width="1" height="9" fill="#b45309" opacity="0.5" />
    </PixelSvg>
  ),
  
  // Water (Blue with motion)
  Water: () => (
    <PixelSvg>
      <rect x="0" y="0" width="16" height="16" fill="#1e3a8a" />
      <rect x="1" y="1" width="14" height="14" fill="#1d4ed8" />
      <rect x="2" y="4" width="3" height="1" fill="#60a5fa" />
      <rect x="8" y="2" width="2" height="1" fill="#60a5fa" />
      <rect x="10" y="8" width="4" height="1" fill="#60a5fa" />
      <rect x="3" y="11" width="2" height="1" fill="#60a5fa" />
      <rect x="7" y="13" width="3" height="1" fill="#60a5fa" />
    </PixelSvg>
  ),
  
  // Bridge (Barrel floating in water)
  Bridge: () => (
     <PixelSvg>
      {/* Water Background */}
      <rect x="0" y="0" width="16" height="16" fill="#1e3a8a" />
      <rect x="1" y="1" width="14" height="14" fill="#1d4ed8" />
      {/* Barrel Top/Float */}
      <rect x="3" y="3" width="10" height="10" fill="#78350f" />
      <rect x="3" y="3" width="10" height="1" fill="#451a03" />
      <rect x="3" y="12" width="10" height="1" fill="#451a03" />
      <rect x="3" y="3" width="1" height="10" fill="#451a03" />
      <rect x="12" y="3" width="1" height="10" fill="#451a03" />
      {/* Planks */}
      <rect x="4" y="4" width="8" height="8" fill="#b45309" />
      <rect x="8" y="4" width="1" height="8" fill="#451a03" opacity="0.5" />
    </PixelSvg>
  ),
  
  // Rock (Grey)
  Rock: () => (
    <PixelSvg>
      <path d="M4 4 h8 v1 h2 v6 h-2 v2 h-8 v-2 h-2 v-6 h2 z" fill="#57534e" />
      {/* Highlights */}
      <rect x="5" y="5" width="2" height="1" fill="#a8a29e" />
      <rect x="4" y="6" width="1" height="2" fill="#a8a29e" />
      {/* Shadow */}
      <rect x="10" y="10" width="2" height="1" fill="#292524" />
      <rect x="8" y="11" width="2" height="1" fill="#292524" />
    </PixelSvg>
  ),

  Dead: () => (
    <PixelSvg>
        <path d="M5 2h6v2h2v4h-2v2h2v2h-2v2h-2v-2h-2v2H5v-2H3v-2h2v-2H3V4h2V2z M6 6h1v2H6V6z M9 6h1v2H9V6z" fill="#525252" />
    </PixelSvg>
  ),
  
  Wait: () => <X size={20} />
};