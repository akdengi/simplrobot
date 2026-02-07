import React, { useState, useEffect, useRef } from 'react';
import { 
  GameState, 
  Command, 
  Obstacle, 
  Robot, 
  CommandType,
  RobotSystems
} from './types';
import { 
  GRID_SIZE, 
  COMMANDS, 
  INITIAL_PLAYER_POS, 
  INITIAL_PLAYER_DIR, 
  ROBOT_MAX_HP,
  INITIAL_SYSTEMS,
  MAX_COPIES_PER_CARD,
  MAX_ROUNDS
} from './constants';
import { processStep, generateBotCommands, isMapPlayable } from './utils/gameLogic';
import { SoundEffects, setGlobalMute } from './utils/audio'; // Import Audio
import { Icons } from './components/Icons';
import { Expand, Smartphone, Volume2, VolumeX } from 'lucide-react';

// --- Components ---

interface ScratchBlockProps {
  command?: Command;
  onClick?: () => void;
  onRemove?: () => void;
  index?: number;
}

const ScratchBlock: React.FC<ScratchBlockProps> = ({ 
  command, 
  onClick, 
  onRemove,
  index 
}) => {
  if (!command) {
    return (
      <div className="w-full h-10 md:h-12 bg-black border-2 border-dashed border-gray-600 flex items-center justify-center text-gray-500 text-[10px] md:text-xs font-mono">
         {index !== undefined ? `СЛОТ ${index + 1}` : ''}
      </div>
    );
  }

  return (
    <div 
      onClick={onClick || onRemove}
      className={`
        relative w-full h-10 md:h-12 ${command.colorClass} 
        text-white text-[10px] md:text-xs uppercase tracking-tighter
        flex items-center px-2 cursor-pointer
        hover:opacity-90 active:translate-y-1 transition-all
        border-b-4 border-r-4 border-black/30
      `}
      style={{ imageRendering: 'pixelated' }}
    >
      <div className="flex items-center gap-2 w-full">
          <div className="w-5 h-5 md:w-6 md:h-6 flex-shrink-0">
            {command.type === 'FORWARD' && <Icons.ForwardSymbol />}
            {command.type === 'BACKWARD' && <Icons.BackwardSymbol />}
            {command.type === 'TURN_LEFT' && <Icons.TurnLeftSymbol />}
            {command.type === 'TURN_RIGHT' && <Icons.TurnRightSymbol />}
            {command.type === 'ATTACK' && <Icons.AttackSymbol />}
            {command.type === 'DEFEND' && <Icons.DefendSymbol />}
          </div>
          <span className="truncate font-bold">{command.label.replace('Движение:', '').replace('Поворот:', '')}</span>
      </div>
      {onRemove && (
        <span className="absolute right-1 text-white hover:text-red-300 font-bold px-1">X</span>
      )}
    </div>
  );
};

const EntityHpBar = ({ hp, maxHp, label, isEnemy, weaponStrength }: { hp: number, maxHp: number, label?: string, isEnemy?: boolean, weaponStrength: number }) => (
    <div className="absolute -top-6 md:-top-8 left-1/2 -translate-x-1/2 flex flex-col items-center z-50 pointer-events-none w-max">
        <div className="flex items-center gap-0.5 md:gap-1 mb-0.5">
           {label && <span className={`text-[6px] md:text-[8px] px-1 ${isEnemy ? 'bg-red-700 text-white' : 'bg-blue-700 text-white'}`}>{label}</span>}
           {/* Weapon Strength Indicator */}
           <div className="flex items-center bg-gray-800 text-white px-0.5 text-[6px] md:text-[8px] border border-gray-500">
               <div className="w-2 h-2 mr-0.5"><Icons.AttackSymbol /></div>
               <span>{weaponStrength}</span>
           </div>
        </div>
        <div className="flex gap-0.5 bg-black p-0.5 border border-white">
            {Array.from({length: maxHp}).map((_, i) => (
                <div 
                    key={i} 
                    className={`w-1.5 h-1.5 md:w-2 md:h-2 ${i < hp ? (isEnemy ? 'bg-red-500' : 'bg-green-500') : 'bg-gray-700'}`}
                ></div>
            ))}
        </div>
    </div>
);

const SystemStatus = ({ systems, label }: { systems: RobotSystems, label: string }) => (
  <div className="flex flex-col gap-2 w-full">
     <div className="text-[8px] text-center text-gray-500 bg-black">{label}</div>
     {/* Head/CPU */}
      <div className={`flex flex-col items-center gap-1 ${systems.head === 'OK' ? 'text-green-400' : 'text-red-500 blink'}`}>
          <div className={`border-2 p-1 bg-black ${systems.head === 'OK' ? 'border-green-600' : 'border-red-600'}`}>
              <Icons.SystemHead />
          </div>
          <span className="text-[6px] md:text-[8px] font-bold">ЦП</span>
      </div>
      
      {/* Chassis/Move */}
      <div className={`flex flex-col items-center gap-1 ${systems.chassis === 'OK' ? 'text-green-400' : 'text-red-500 blink'}`}>
          <div className={`border-2 p-1 bg-black ${systems.chassis === 'OK' ? 'border-green-600' : 'border-red-600'}`}>
              <Icons.SystemChassis />
          </div>
          <span className="text-[6px] md:text-[8px] font-bold">ХОД</span>
      </div>
      
       {/* Weapon/Attack */}
      <div className={`flex flex-col items-center gap-1 ${systems.weapon === 'OK' ? 'text-green-400' : 'text-red-500 blink'}`}>
          <div className={`border-2 p-1 bg-black ${systems.weapon === 'OK' ? 'border-green-600' : 'border-red-600'}`}>
              <Icons.SystemWeapon />
          </div>
          <span className="text-[6px] md:text-[8px] font-bold">АТК</span>
      </div>
  </div>
);

const LeftStatusPanel = ({ player, bots }: { player: Robot, bots: Robot[] }) => (
  <div className="w-10 md:w-14 bg-gray-900 border-r-2 border-white flex flex-col items-center py-2 gap-4 flex-shrink-0 z-10 shadow-[4px_0_10px_rgba(0,0,0,0.5)] overflow-y-auto no-scrollbar">
      <SystemStatus systems={player.systems} label="P1" />
      
      {bots.map((bot, idx) => !bot.isDead && (
        <React.Fragment key={bot.id}>
           <div className="w-full h-0.5 bg-gray-700 my-1"></div>
           <SystemStatus systems={bot.systems} label={`B${idx+1}`} />
        </React.Fragment>
      ))}
  </div>
);

const GameGrid = ({ state }: { state: GameState }) => {
  const cells = [];
  
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const isPlayer = state.player.position.x === x && state.player.position.y === y;
      const botAt = state.bots.find(b => b.position.x === x && b.position.y === y && !b.isDead);
      const obstacle = state.obstacles.find(o => o.position.x === x && o.position.y === y);
      
      const isEven = (x + y) % 2 === 0;
      // Checkerboard Pattern
      const tileColor = isEven ? 'bg-[#333]' : 'bg-[#444]'; 
      
      let groundContent = null;
      let objectContent = null;
      let rotation = 0;
      let scale = 1;
      let hpBar = null;
      let animClass = "";

      // Determine Obstacle Content (Ground vs Object)
      if (obstacle) {
        if (obstacle.type === 'WATER') groundContent = <Icons.Water />;
        else if (obstacle.type === 'BRIDGE') groundContent = <Icons.Bridge />;
        else if (obstacle.type === 'ROCK') objectContent = <Icons.Rock />;
        else if (obstacle.type === 'BARREL') objectContent = <Icons.Barrel />;
      }

      // Determine Entity Content (Overwrites obstacle object, sits on top of ground)
      if (isPlayer && !state.player.isDead) {
        objectContent = <Icons.RobotPlayer />;
        if (state.player.direction === 'E') rotation = 90;
        if (state.player.direction === 'S') rotation = 180;
        if (state.player.direction === 'W') rotation = 270;
        
        if (state.player.wasHit) animClass = "animate-damage";
        else if (state.player.lastAction === 'ATTACK') animClass = "animate-lunge";

        hpBar = <EntityHpBar 
                    hp={state.player.hp} 
                    maxHp={state.player.maxHp} 
                    label="P1" 
                    weaponStrength={state.player.systems.weapon === 'OK' ? 2 : 1}
                />;
      } else if (botAt) {
        objectContent = <Icons.RobotBot />;
        if (botAt.direction === 'E') rotation = 90;
        if (botAt.direction === 'S') rotation = 180;
        if (botAt.direction === 'W') rotation = 270;

        if (botAt.wasHit) animClass = "animate-damage";
        else if (botAt.lastAction === 'ATTACK') animClass = "animate-lunge";

        hpBar = <EntityHpBar 
                    hp={botAt.hp} 
                    maxHp={botAt.maxHp} 
                    label={`BOT`} 
                    isEnemy 
                    weaponStrength={botAt.systems.weapon === 'OK' ? 2 : 1}
                />;
      } else if (isPlayer && state.player.isDead) {
          objectContent = <Icons.Dead />;
      } else if (botAt && botAt.isDead) {
          objectContent = <Icons.Dead />;
      }

      cells.push(
        <div 
          key={`${x}-${y}`} 
          className={`
            relative w-full aspect-square
            ${tileColor}
            flex items-center justify-center
          `}
        >
          {/* Pixel grid overlay for texture */}
          <div className="absolute inset-0 opacity-10 pointer-events-none z-0" style={{ backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)', backgroundSize: '4px 4px' }}></div>
          
          {/* Ground Layer (Water, Bridge) */}
          {groundContent && (
             <div className="absolute inset-0 z-0">
               {groundContent}
             </div>
          )}
          
          {hpBar}

          {/* Object Layer (Robot, Rock, Barrel) */}
          <div 
            className={`robot-transition w-4/5 h-4/5 flex items-center justify-center transform relative z-10 ${animClass}`}
            style={{ 
                transform: `rotate(${rotation}deg) scale(${scale})`,
                imageRendering: 'pixelated'
            }}
          >
            {objectContent}
          </div>
        </div>
      );
    }
  }

  return (
    <div className="h-full aspect-square bg-black border-4 border-white p-1 mx-auto relative shadow-[4px_4px_0_#000]">
        <div className="grid grid-cols-4 gap-0.5 w-full h-full bg-[#222] border-2 border-gray-600">
            {cells}
        </div>
    </div>
  );
};

const INITIAL_STATE_TEMPLATE: GameState = {
  gridSize: GRID_SIZE,
  player: {
    id: 'player',
    type: 'PLAYER',
    position: INITIAL_PLAYER_POS,
    direction: INITIAL_PLAYER_DIR,
    hp: ROBOT_MAX_HP,
    maxHp: ROBOT_MAX_HP,
    isDead: false,
    lastAction: null,
    wasHit: false,
    systems: { ...INITIAL_SYSTEMS }
  },
  bots: [],
  obstacles: [],
  phase: 'SETUP',
  turn: 1,
  logs: [],
  pendingDamage: null
};

export default function App() {
  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE_TEMPLATE);
  const [program, setProgram] = useState<Command[]>([]);
  const [botFullPrograms, setBotFullPrograms] = useState<{ [id: string]: Command[] }>({});
  const [execIndex, setExecIndex] = useState<number>(-1);
  const [botCount, setBotCount] = useState<number>(1);
  const [isPortrait, setIsPortrait] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Check orientation
  useEffect(() => {
    const checkOrientation = () => {
        setIsPortrait(window.innerHeight > window.innerWidth);
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  const requestFullScreen = () => {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
          elem.requestFullscreen();
      } else if ((elem as any).webkitRequestFullscreen) {
          (elem as any).webkitRequestFullscreen();
      }
      SoundEffects.uiClick();
  };

  const toggleMute = () => {
    const newState = !isMuted;
    setIsMuted(newState);
    setGlobalMute(newState);
    if (!newState) SoundEffects.uiClick(); // Play sound only when unmuting
  };

  const initGame = (count: number) => {
    let attempts = 0;
    let validMap = false;
    let newState = { ...INITIAL_STATE_TEMPLATE };

    while (!validMap && attempts < 100) {
        attempts++;
        const obstacles: Obstacle[] = [];
        const occupied = new Set<string>();
        occupied.add(`${INITIAL_PLAYER_POS.x},${INITIAL_PLAYER_POS.y}`);

        const addObs = (type: Obstacle['type'], amount: number) => {
            for(let i=0; i<amount; i++) {
                let placed = false;
                while(!placed) {
                    const x = Math.floor(Math.random() * GRID_SIZE);
                    const y = Math.floor(Math.random() * GRID_SIZE);
                    const key = `${x},${y}`;
                    if (!occupied.has(key)) {
                        const obs: Obstacle = { id: `obs-${type}-${obstacles.length}`, type, position: {x, y} };
                        obstacles.push(obs);
                        occupied.add(key);
                        placed = true;
                    }
                }
            }
        };

        addObs('ROCK', Math.floor(Math.random() * 2) + 1);
        addObs('WATER', Math.floor(Math.random() * 2) + 1);
        addObs('BARREL', Math.floor(Math.random() * 2) + 1);

        const bots: Robot[] = [];
        for (let i = 0; i < count; i++) {
             let placed = false;
             while(!placed) {
                const x = Math.floor(Math.random() * GRID_SIZE);
                const y = Math.floor(Math.random() * GRID_SIZE);
                const key = `${x},${y}`;
                if (!occupied.has(key) && y < 3) {
                    bots.push({
                        id: `bot-${i}`,
                        type: 'BOT',
                        position: { x, y },
                        direction: 'S',
                        hp: ROBOT_MAX_HP,
                        maxHp: ROBOT_MAX_HP,
                        isDead: false,
                        lastAction: null,
                        wasHit: false,
                        systems: { ...INITIAL_SYSTEMS }
                    });
                    occupied.add(key);
                    placed = true;
                }
             }
        }

        if (isMapPlayable(INITIAL_PLAYER_POS, bots.map(b => b.position), obstacles)) {
            newState = {
                ...INITIAL_STATE_TEMPLATE,
                obstacles,
                bots,
                phase: 'PLANNING',
                logs: [`БОЙ НАЧАТ. ВРАГИ: ${count}`]
            };
            validMap = true;
        }
    }

    setGameState(newState);
    setProgram([]);
    setExecIndex(-1);
    SoundEffects.uiStart();
  };

  useEffect(() => {
    if (gameState.phase === 'SETUP') {
        initGame(botCount);
    }
  }, [gameState.phase]);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [gameState.logs]);

  useEffect(() => {
    if (gameState.phase === 'EXECUTING') {
      // Priority check for Game Over before scheduling next steps
      // Note: We check if bots are dead OR player is dead.
      // Time limit check happens AFTER execution finishes below.
      if (gameState.player.isDead || (gameState.bots.length > 0 && gameState.bots.every(b => b.isDead))) {
           setGameState(prev => ({ ...prev, phase: 'GAME_OVER' }));
           return;
      }

      const maxLen = Math.max(program.length, ...Object.values(botFullPrograms).map((p: Command[]) => p.length));

      if (execIndex < maxLen) {
        const timer = setTimeout(() => {
          const playerCmd = program[execIndex] || { id: 'wait-player', type: 'WAIT', label: 'Wait', colorClass: '' };
          const stepBotCmds: { [id: string]: Command } = {};
          
          gameState.bots.forEach(b => {
             const cmds = botFullPrograms[b.id];
             stepBotCmds[b.id] = (cmds && cmds[execIndex]) ? cmds[execIndex] : { id: `wait-${b.id}`, type: 'WAIT', label: 'Wait', colorClass: '' };
          });

          setGameState(prev => processStep(prev, playerCmd, stepBotCmds));
          setExecIndex(prev => prev + 1);
        }, 1000);

        return () => clearTimeout(timer);
      } else {
        // Round Execution Finished. Check limit.
        if (gameState.turn >= MAX_ROUNDS) {
            setGameState(prev => ({ ...prev, phase: 'GAME_OVER' }));
        } else {
            // WAIT FOR USER TO CLICK NEXT ROUND
            setGameState(prev => ({ ...prev, phase: 'ROUND_OVER' }));
        }
      }
    }
  }, [gameState.phase, execIndex, program, botFullPrograms, gameState.player.isDead, gameState.bots, gameState.turn]);

  const handleNextRound = () => {
       setGameState(prev => ({
          ...prev,
          phase: 'PLANNING',
          turn: prev.turn + 1,
          logs: [...prev.logs, `--- РАУНД ${prev.turn + 1} ---`]
        }));
        setProgram([]);
        setExecIndex(-1);
        SoundEffects.uiClick();
  };

  const handleAddCommand = (type: CommandType) => {
    const maxLen = gameState.player.systems.head === 'OK' ? 4 : 3;
    if (program.length >= maxLen) return;
    const currentCount = program.filter(c => c.type === type).length;
    if (currentCount >= MAX_COPIES_PER_CARD) return;
    const cmdDef = COMMANDS.find(c => c.type === type);
    if (!cmdDef) return;
    if (type === 'BACKWARD' && gameState.player.systems.chassis === 'DAMAGED') return;
    setProgram([...program, { ...cmdDef, id: `cmd-${Date.now()}` }]);
    SoundEffects.uiClick();
  };

  const handleStart = () => {
      const maxLen = gameState.player.systems.head === 'OK' ? 4 : 3;
      if (program.length !== maxLen) {
          alert(`НУЖНО ${maxLen} КОМАНД!`);
          return;
      }
      const botProgs: { [id: string]: Command[] } = {};
      const newLogs: string[] = ['>> ЗАПУСК'];

      gameState.bots.forEach((b, idx) => {
          const { commands, mode } = generateBotCommands(b, gameState, 4);
          botProgs[b.id] = commands;
          if (!b.isDead) {
             newLogs.push(`БОТ ${idx + 1}: РЕЖИМ ${mode.toUpperCase()}`);
          }
      });

      setBotFullPrograms(botProgs);
      setGameState(prev => ({ ...prev, phase: 'EXECUTING', logs: [...prev.logs, ...newLogs] }));
      setExecIndex(0);
      SoundEffects.uiStart();
  };

  const handleApplyDamage = (system: keyof RobotSystems) => {
     if (!gameState.pendingDamage) return;
     SoundEffects.hitRobot();
     setGameState(prev => {
         const next = { ...prev };
         // Deep copy player because we modify it
         const r = { ...next.player, systems: { ...next.player.systems } };
         next.player = r;
         // Deep copy pendingDamage
         next.pendingDamage = { ...prev.pendingDamage! };

         r.hp -= 1;
         r.systems[system] = 'DAMAGED';
         
         next.pendingDamage.amount -= 1;
         r.wasHit = true; 

         // Check if done allocating
         if (next.pendingDamage.amount <= 0) {
             next.pendingDamage = null;
             // Check Game Over
             if (r.hp <= 0) {
                 r.isDead = true;
                 next.phase = 'GAME_OVER';
             } else {
                 // Resume
                 next.phase = 'ROUND_OVER'; // Return to state where we wait for next round or executing? 
                 // Actually, if we took damage during execution, we usually want to finish execution or go to round over.
                 // Simplest: Go to round over to review, or Planning if execution was done.
                 // If damage happens mid-execution (e.g. water), we should probably continue execution?
                 // For now, let's default to ROUND_OVER so user can review logs/damage.
                 next.phase = 'ROUND_OVER'; 
             }
         } else {
             // Still have damage to allocate
             if (r.hp <= 0) {
                  // Died before allocating all damage
                 r.isDead = true;
                 next.phase = 'GAME_OVER';
                 next.pendingDamage = null;
             }
             // Else stay in DAMAGE_ALLOCATION
         }
         
         next.logs = [...prev.logs, `СБОЙ ${system.toUpperCase()}!`]; // Add log to array
         return next;
     });
  };

  const getCardCount = (type: CommandType) => program.filter(c => c.type === type).length;
  
  // Prepare Program Slots (Filled + Empty)
  const maxProgramSlots = gameState.player.systems.head === 'OK' ? 4 : 3;
  const programSlots = [...program];
  while (programSlots.length < maxProgramSlots) {
      programSlots.push(null as any);
  }

  // --- Render Portrait Warning ---
  if (isPortrait) {
      return (
          <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center p-8 text-center text-white">
              <Smartphone size={64} className="mb-4 animate-pulse text-yellow-400" />
              <h1 className="text-xl mb-4 font-bold text-yellow-400">ПОВЕРНИТЕ УСТРОЙСТВО</h1>
              <p className="text-xs mb-8 text-gray-400 leading-relaxed">
                  Для доступа к терминалу управления требуется горизонтальная ориентация дисплея.
              </p>
              <button 
                  onClick={requestFullScreen}
                  className="px-6 py-3 border-2 border-white bg-blue-900 active:bg-blue-800 text-[10px] uppercase"
              >
                  Полноэкранный режим
              </button>
          </div>
      );
  }

  // --- Landscape Render (Optimized) ---
  return (
    <div className="fixed inset-0 w-full h-full bg-[#111] overflow-hidden flex flex-row p-1 sm:p-2 gap-2">
        
        {/* Left Column: Status Panel */}
        <LeftStatusPanel player={gameState.player} bots={gameState.bots} />

        {/* Middle Column: Game Area (Maximized) */}
        <div className="flex-1 flex flex-col min-w-0">
            <header className="flex justify-between items-center bg-black border border-gray-600 p-1 mb-1 flex-shrink-0">
                <div className="flex flex-col">
                  <h1 className="text-[10px] md:text-sm text-yellow-400 whitespace-nowrap px-1">
                     8-BIT GOLEM
                  </h1>
                  <span className="text-[8px] text-gray-400 px-1">РАУНД {gameState.turn}/{MAX_ROUNDS}</span>
                </div>
                <div className="flex gap-2 items-center">
                    <button 
                      onClick={toggleMute} 
                      className="text-white p-1 border border-gray-500 bg-black hover:bg-gray-800 active:translate-y-0.5"
                      title={isMuted ? "Включить звук" : "Выключить звук"}
                    >
                        {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                    </button>
                    <select 
                        value={botCount} 
                        onChange={(e) => setBotCount(Number(e.target.value))}
                        className="bg-black text-white border border-gray-500 text-[8px] md:text-[10px] h-6"
                    >
                        <option value={1}>1 ВРАГ</option>
                        <option value={2}>2 ВРАГА</option>
                    </select>
                    <button onClick={() => initGame(botCount)} className="text-[8px] md:text-[10px] bg-red-800 px-1 border border-red-500 text-white h-6">СБРОС</button>
                    <button onClick={requestFullScreen} className="text-white px-1"><Expand size={14}/></button>
                </div>
            </header>

            {/* Game Grid Container */}
            <div className="flex-1 flex items-center justify-center relative min-h-0">
                 <GameGrid state={gameState} />
            </div>

            {/* Start / Next Round Button - MOVED HERE */}
            <div className="mt-2 w-full max-w-md mx-auto">
                 {gameState.phase === 'PLANNING' && (
                     <button
                        onClick={handleStart}
                        className="w-full py-3 md:py-4 border-4 border-black bg-yellow-400 text-black font-bold text-sm md:text-base shadow-[2px_2px_0_#000] hover:bg-yellow-300 active:translate-y-1 active:shadow-none transition-all uppercase"
                    >
                        ЗАПУСК ПРОГРАММЫ
                    </button>
                 )}
                 {gameState.phase === 'EXECUTING' && (
                     <button
                        disabled
                        className="w-full py-3 md:py-4 border-4 border-black bg-gray-700 text-gray-400 font-bold text-sm md:text-base shadow-[2px_2px_0_#000] cursor-wait uppercase"
                    >
                        ВЫПОЛНЕНИЕ...
                    </button>
                 )}
                 {(gameState.phase === 'ROUND_OVER' || gameState.phase === 'DAMAGE_ALLOCATION') && (
                      <button
                        onClick={handleNextRound}
                        disabled={gameState.phase === 'DAMAGE_ALLOCATION'}
                        className={`w-full py-3 md:py-4 border-4 border-black font-bold text-sm md:text-base shadow-[2px_2px_0_#000] active:translate-y-1 active:shadow-none transition-all uppercase ${gameState.phase === 'DAMAGE_ALLOCATION' ? 'bg-gray-600 text-gray-400' : 'bg-green-600 text-white hover:bg-green-500'}`}
                    >
                        СЛЕДУЮЩИЙ РАУНД
                    </button>
                 )}
            </div>
        </div>

        {/* Right Column: Controls OR Logs (Fixed width sidebar) */}
        <div className="w-56 md:w-72 flex-shrink-0 border-l-2 md:border-l-4 border-white bg-gray-900 flex flex-col h-full shadow-[-4px_0_10px_rgba(0,0,0,0.5)] z-20">
            
            {/* PLANNING PHASE: Show Program & Palette */}
            {gameState.phase === 'PLANNING' && (
                <>
                    {/* Top Section: Program Slots */}
                    <div className="p-2 flex-shrink-0">
                        <div className="flex justify-between items-center text-[10px] md:text-xs text-white bg-black px-1 py-0.5 border border-gray-700 mb-1">
                            <span>ПАМЯТЬ</span>
                            <span className={program.length === maxProgramSlots ? 'text-green-500' : 'text-gray-500'}>
                                {program.length}/{maxProgramSlots}
                            </span>
                        </div>
                        
                        <div className="bg-black border-2 border-gray-600 p-1 space-y-1">
                            {programSlots.map((cmd, idx) => (
                                <ScratchBlock 
                                    key={cmd ? cmd.id : `empty-${idx}`} 
                                    command={cmd} 
                                    index={idx}
                                    onRemove={() => {
                                        if (cmd) {
                                            const n = [...program]; n.splice(idx, 1); setProgram(n);
                                        }
                                    }} 
                                />
                            ))}
                        </div>
                    </div>

                    {/* Bottom Section: Command Palette */}
                    <div className="flex-1 p-2 min-h-0 flex flex-col">
                        <div className="text-[10px] md:text-xs text-white bg-black px-1 py-0.5 border border-gray-700 mb-1">
                             КОМАНДЫ
                        </div>
                        <div className="flex-1 bg-black border-2 border-gray-600 p-1 gap-1 flex flex-col overflow-y-auto">
                            {COMMANDS.map(cmd => {
                                const broken = (cmd.type === 'BACKWARD' && gameState.player.systems.chassis === 'DAMAGED');
                                const count = getCardCount(cmd.type);
                                const limitReached = count >= MAX_COPIES_PER_CARD;
                                const disabled = broken || limitReached;

                                return (
                                    <div key={cmd.id} className={disabled ? 'opacity-50 grayscale pointer-events-none relative flex-shrink-0' : 'flex-shrink-0'}>
                                        <div className="relative">
                                            <ScratchBlock command={cmd} onClick={() => handleAddCommand(cmd.type)} />
                                            <div className="absolute right-1 top-1/2 -translate-y-1/2 text-[8px] md:text-[10px] bg-black text-white px-0.5 border border-white">
                                                {count}/{MAX_COPIES_PER_CARD}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </>
            )}

            {/* EXECUTION / ROUND OVER PHASE: Show Log Only */}
            {gameState.phase !== 'PLANNING' && (
                <div className="h-full border-t-2 border-b-2 border-white bg-black p-1 flex flex-col">
                    <div className="bg-[#0000AA] text-white px-1 py-0.5 text-[10px] md:text-xs mb-1 flex-shrink-0">
                       :: LOG ::
                    </div>
                    <div 
                        ref={logContainerRef}
                        className="flex-1 overflow-y-auto text-[10px] md:text-xs text-green-400 font-mono leading-tight"
                    >
                        {gameState.logs.map((l, i) => <div key={i} className="mb-0.5 border-b border-gray-900 pb-0.5">{`> ${l.toUpperCase()}`}</div>)}
                        {/* Dummy element to force scroll to bottom */}
                        <div className="h-4"></div>
                    </div>
                </div>
            )}
            
        </div>

        {/* Damage Modal */}
        {gameState.phase === 'DAMAGE_ALLOCATION' && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
                <div className="bg-red-900 border-4 border-red-500 p-4 max-w-xs w-full shadow-[0_0_20px_red]">
                    <h2 className="text-sm md:text-xl text-white mb-4 text-center blink">СБОЙ СИСТЕМЫ</h2>
                    <p className="text-red-200 text-[8px] md:text-[10px] mb-4 text-center">
                        ОСТАЛОСЬ ПОВРЕЖДЕНИЙ: {gameState.pendingDamage?.amount || 0}
                    </p>
                    
                    <div className="space-y-2">
                        <button 
                            disabled={gameState.player.systems.head === 'DAMAGED'}
                            onClick={() => handleApplyDamage('head')}
                            className="w-full p-2 bg-black text-white border border-white hover:bg-red-800 disabled:opacity-50 text-[8px] md:text-xs flex justify-between"
                        >
                            <span>ЦП</span>
                            {gameState.player.systems.head === 'OK' ? <span>[-1 СЛОТ]</span> : <span>[СБОЙ]</span>}
                        </button>

                        <button 
                            disabled={gameState.player.systems.weapon === 'DAMAGED'}
                            onClick={() => handleApplyDamage('weapon')}
                            className="w-full p-2 bg-black text-white border border-white hover:bg-red-800 disabled:opacity-50 text-[8px] md:text-xs flex justify-between"
                        >
                             <span>ОРУЖИЕ</span>
                             {gameState.player.systems.weapon === 'OK' ? <span>[-1 УРОН]</span> : <span>[СБОЙ]</span>}
                        </button>

                        <button 
                            disabled={gameState.player.systems.chassis === 'DAMAGED'}
                            onClick={() => handleApplyDamage('chassis')}
                            className="w-full p-2 bg-black text-white border border-white hover:bg-red-800 disabled:opacity-50 text-[8px] md:text-xs flex justify-between"
                        >
                             <span>ШАССИ</span>
                             {gameState.player.systems.chassis === 'OK' ? <span>[НЕТ НАЗАД]</span> : <span>[СБОЙ]</span>}
                        </button>
                    </div>
                </div>
            </div>
        )}
        
        {/* Game Over Modal */}
        {gameState.phase === 'GAME_OVER' && (
             <div className="absolute inset-0 bg-black/95 z-50 flex items-center justify-center p-4">
                <div className="text-center border-4 border-white p-6 md:p-8 bg-blue-900 shadow-[10px_10px_0_#000]">
                    <h1 className="text-2xl md:text-4xl text-yellow-400 mb-4 drop-shadow-[4px_4px_0_#000]">
                        {gameState.player.isDead 
                          ? (gameState.bots.length > 1 ? 'ПОБЕДИЛИ БОТЫ' : 'ПОБЕДИЛ БОТ') 
                          : (gameState.turn >= MAX_ROUNDS && !gameState.bots.every(b => b.isDead) ? 'ВРЕМЯ ИСТЕКЛО' : 'ПОБЕДИЛ ИГРОК')}
                    </h1>
                    <button 
                        onClick={() => initGame(botCount)}
                        className="px-4 py-2 md:px-6 md:py-3 bg-white text-black font-bold text-xs md:text-sm border-4 border-black hover:bg-gray-200 active:translate-y-1"
                    >
                        РЕСТАРТ
                    </button>
                </div>
             </div>
        )}
    </div>
  );
}