import { Command, Direction, Position, RobotSystems } from './types';

export const GRID_SIZE = 4;
export const ROBOT_MAX_HP = 3;
export const MAX_ROUNDS = 8;
export const MAX_COPIES_PER_CARD = 2; // Limit per command type

export const INITIAL_SYSTEMS: RobotSystems = {
  head: 'OK',    // Was CPU
  chassis: 'OK', // Was Motor
  weapon: 'OK'
};

// Colors adapted for NES palette approximation (Flat, high contrast)
export const COMMANDS: Command[] = [
  { id: 'cmd_fwd', type: 'FORWARD', label: 'Движение: Вперед', colorClass: 'bg-blue-700' },
  { id: 'cmd_bwd', type: 'BACKWARD', label: 'Движение: Назад', colorClass: 'bg-blue-800' },
  { id: 'cmd_tl', type: 'TURN_LEFT', label: 'Поворот: Влево', colorClass: 'bg-yellow-600' },
  { id: 'cmd_tr', type: 'TURN_RIGHT', label: 'Поворот: Вправо', colorClass: 'bg-yellow-600' },
  { id: 'cmd_atk', type: 'ATTACK', label: 'Удар мечом', colorClass: 'bg-red-700' },
  { id: 'cmd_def', type: 'DEFEND', label: 'Блок щитом', colorClass: 'bg-green-700' },
];

export const INITIAL_PLAYER_POS: Position = { x: 0, y: 3 };
export const INITIAL_PLAYER_DIR: Direction = 'E';

// Helper to get vector from direction
export const getVector = (dir: Direction): Position => {
  switch (dir) {
    case 'N': return { x: 0, y: -1 };
    case 'S': return { x: 0, y: 1 };
    case 'E': return { x: 1, y: 0 };
    case 'W': return { x: -1, y: 0 };
  }
};

// Helper to rotate
export const rotate = (dir: Direction, turn: 'LEFT' | 'RIGHT'): Direction => {
  const dirs: Direction[] = ['N', 'E', 'S', 'W'];
  const idx = dirs.indexOf(dir);
  if (turn === 'RIGHT') return dirs[(idx + 1) % 4];
  return dirs[(idx + 3) % 4];
};