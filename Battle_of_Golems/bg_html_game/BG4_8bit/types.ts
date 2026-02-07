
export type Direction = 'N' | 'E' | 'S' | 'W';

export type EntityType = 'PLAYER' | 'BOT' | 'ROCK' | 'WATER' | 'BARREL' | 'BRIDGE' | 'NONE';

export interface Position {
  x: number;
  y: number;
}

export interface RobotSystems {
  head: 'OK' | 'DAMAGED';    // 4 cmds -> 3 cmds
  chassis: 'OK' | 'DAMAGED'; // Full -> No Backward
  weapon: 'OK' | 'DAMAGED';  // 2 Dmg -> 1 Dmg
}

export interface Robot {
  id: string;
  type: 'PLAYER' | 'BOT';
  position: Position;
  direction: Direction;
  hp: number;
  maxHp: number;
  isDead: boolean;
  lastAction: string | null;
  wasHit: boolean; // New flag for animation
  systems: RobotSystems;
}

export interface Obstacle {
  id: string;
  type: 'ROCK' | 'WATER' | 'BARREL' | 'BRIDGE';
  position: Position;
}

export type CommandType = 'FORWARD' | 'BACKWARD' | 'TURN_LEFT' | 'TURN_RIGHT' | 'ATTACK' | 'DEFEND' | 'WAIT';

export interface Command {
  id: string;
  type: CommandType;
  label: string;
  colorClass: string;
}

export type GamePhase = 'SETUP' | 'PLANNING' | 'EXECUTING' | 'ROUND_OVER' | 'DAMAGE_ALLOCATION' | 'GAME_OVER';

export interface GameState {
  gridSize: number;
  player: Robot;
  bots: Robot[];
  obstacles: Obstacle[];
  phase: GamePhase;
  turn: number;
  logs: string[];
  pendingDamage: {
    robotId: string;
    amount: number;
  } | null;
}