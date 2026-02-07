import { GameState, Robot, Command, Position, Obstacle, Direction, CommandType, RobotSystems } from '../types';
import { GRID_SIZE, getVector, rotate, ROBOT_MAX_HP, INITIAL_SYSTEMS, COMMANDS } from '../constants';
import { SoundEffects } from './audio';

// Deep clone helper
export const cloneState = (state: GameState): GameState => JSON.parse(JSON.stringify(state));

export const isWithinBounds = (pos: Position): boolean => {
  return pos.x >= 0 && pos.x < GRID_SIZE && pos.y >= 0 && pos.y < GRID_SIZE;
};

export const getEntityAt = (pos: Position, state: GameState): 'PLAYER' | 'BOT' | 'OBSTACLE' | 'NONE' => {
  if (state.player.position.x === pos.x && state.player.position.y === pos.y) return 'PLAYER';
  if (state.bots.some(b => b.position.x === pos.x && b.position.y === pos.y && !b.isDead)) return 'BOT';
  if (state.obstacles.some(o => o.position.x === pos.x && o.position.y === pos.y)) return 'OBSTACLE';
  return 'NONE';
};

export const getObstacleAt = (pos: Position, obstacles: Obstacle[]): Obstacle | undefined => {
  return obstacles.find(o => o.position.x === pos.x && o.position.y === pos.y);
};

// --- Pathfinding Check (BFS) ---
export const isMapPlayable = (
  playerPos: Position, 
  botPositions: Position[], 
  obstacles: Obstacle[]
): boolean => {
  const grid = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(false));
  
  obstacles.forEach(o => {
    // Bridge and Barrel are technically movable/walkable for check purposes
    // We only hard block on Rock and Water
    if (o.type === 'ROCK' || o.type === 'WATER') {
      grid[o.position.y][o.position.x] = true; 
    }
  });

  const queue: Position[] = [playerPos];
  const visited = new Set<string>();
  visited.add(`${playerPos.x},${playerPos.y}`);

  let reachableBots = 0;

  while(queue.length > 0) {
    const curr = queue.shift()!;
    if (botPositions.some(b => b.x === curr.x && b.y === curr.y)) {
      reachableBots++;
    }

    const dirs: Position[] = [{x:0, y:1}, {x:0, y:-1}, {x:1, y:0}, {x:-1, y:0}];
    for(const d of dirs) {
      const next = { x: curr.x + d.x, y: curr.y + d.y };
      const key = `${next.x},${next.y}`;
      if (isWithinBounds(next) && !grid[next.y][next.x] && !visited.has(key)) {
        visited.add(key);
        queue.push(next);
      }
    }
  }

  return reachableBots === botPositions.length && visited.size > 2;
};

// --- Step Processing ---

export const processStep = (
  currentState: GameState,
  playerCmd: Command,
  botCommands: { [botId: string]: Command }
): GameState => {
  let nextState = cloneState(currentState);
  const logs: string[] = [];

  // Reset transient animation flags
  nextState.player.wasHit = false;
  nextState.bots.forEach(b => b.wasHit = false);

  // Helper to resolve auto damage for bots
  const resolveBotDamage = (bot: Robot, amount: number) => {
      bot.hp -= amount;
      bot.wasHit = true; // Trigger Animation
      SoundEffects.hitRobot(); // Sound: Bot Hit
      
      // Damage 'amount' random systems
      for(let i=0; i<amount; i++) {
          const systems: (keyof RobotSystems)[] = ['head', 'weapon', 'chassis'];
          const okSystems = systems.filter(s => bot.systems[s] === 'OK');
          if (okSystems.length > 0) {
              const rnd = okSystems[Math.floor(Math.random() * okSystems.length)];
              bot.systems[rnd] = 'DAMAGED';
              logs.push(`Бот ${bot.id.split('-')[1]}: СБОЙ СИСТЕМЫ (${rnd === 'head' ? 'ЦП' : rnd === 'weapon' ? 'ОРУЖИЕ' : 'ШАССИ'}).`);
          }
      }

      if (bot.hp <= 0) {
          bot.isDead = true;
          SoundEffects.explode(); // Sound: Bot Destroyed
          logs.push(`Бот ${bot.id.split('-')[1]} УНИЧТОЖЕН.`);
      }
  };

  const triggerBarrelDestroy = (barrel: Obstacle, responsibleRobot: Robot | null) => {
    nextState.obstacles = nextState.obstacles.filter(o => o.id !== barrel.id);
    SoundEffects.destroyBarrel(); // Sound: Barrel Break
    logs.push('БОЧКА РАЗБИТА.');
  };

  // 1. Process Instant (Rotations, Defend)
  // Приоритет: Сначала стойки и повороты
  const allRobots = [nextState.player, ...nextState.bots];
  
  allRobots.forEach(robot => {
    if (robot.isDead) return;
    const cmd = robot.type === 'PLAYER' ? playerCmd : botCommands[robot.id];
    if (!cmd) return;

    if (cmd.type === 'TURN_LEFT') {
        robot.direction = rotate(robot.direction, 'LEFT');
        robot.lastAction = 'TURN_LEFT';
        SoundEffects.turn(); // Sound: Turn
    } else if (cmd.type === 'TURN_RIGHT') {
        robot.direction = rotate(robot.direction, 'RIGHT');
        robot.lastAction = 'TURN_RIGHT';
        SoundEffects.turn(); // Sound: Turn
    } else if (cmd.type === 'DEFEND') {
        robot.lastAction = 'DEFEND';
    } else if (cmd.type === 'WAIT') {
        robot.lastAction = 'WAIT';
    }
  });

  // 2. Process Movement
  // Приоритет: Движение происходит ДО атаки. Это позволяет уйти из-под удара.
  const moves: { robot: Robot, from: Position, to: Position, cmd: CommandType }[] = [];

  allRobots.forEach(robot => {
      if (robot.isDead) return;
      const cmd = robot.type === 'PLAYER' ? playerCmd : botCommands[robot.id];
      if (!cmd) return;

      // Check CHASSIS Damage
      if (cmd.type === 'BACKWARD' && robot.systems.chassis === 'DAMAGED') {
          logs.push(`${robot.type === 'PLAYER' ? 'ИГРОК' : 'БОТ'}: ОТКАЗ ШАССИ!`);
          SoundEffects.uiClick(); // Using click sound for error/fail feedback
          robot.lastAction = 'FAIL';
          return;
      }

      if (cmd.type === 'FORWARD' || cmd.type === 'BACKWARD') {
          const vec = getVector(robot.direction);
          const mult = cmd.type === 'BACKWARD' ? -1 : 1;
          const nextPos = { x: robot.position.x + (vec.x * mult), y: robot.position.y + (vec.y * mult) };
          moves.push({ robot, from: robot.position, to: nextPos, cmd: cmd.type });
      }
  });

  moves.forEach(move => {
      const { robot, to, cmd } = move;
      const name = robot.type === 'PLAYER' ? 'ИГРОК' : `БОТ ${robot.id.split('-')[1]}`;

      if (!isWithinBounds(to)) {
          logs.push(`${name}: УДАР О СТЕНУ.`);
          SoundEffects.hitWall(); // Sound: Wall Bump
          return;
      }

      const obs = getObstacleAt(to, nextState.obstacles);
      if (obs) {
          if (obs.type === 'ROCK') {
              logs.push(`${name}: УДАР О КАМЕНЬ.`);
              SoundEffects.hitWall(); // Sound: Rock Bump
              return;
          } else if (obs.type === 'WATER') {
              logs.push(`${name}: ПАДЕНИЕ В ВОДУ.`);
              SoundEffects.splash(); // Sound: Water Splash
              
              if (robot.type === 'PLAYER') {
                  const currentAmount = nextState.pendingDamage ? nextState.pendingDamage.amount : 0;
                  nextState.pendingDamage = { robotId: robot.id, amount: currentAmount + 1 };
                  robot.wasHit = true;
              } else {
                  resolveBotDamage(robot, 1);
              }

              // Logic to exit water to any adjacent free cell
              const candidates: Position[] = [
                  { x: to.x, y: to.y - 1 },
                  { x: to.x + 1, y: to.y },
                  { x: to.x, y: to.y + 1 },
                  { x: to.x - 1, y: to.y }
              ];

              const validExits = candidates.filter(pos => {
                  if (!isWithinBounds(pos)) return false;
                  // Check obstacles
                  const o = getObstacleAt(pos, nextState.obstacles);
                  if (o && o.type !== 'BRIDGE') return false; // Can exit to bridge
                  
                  // Check collision with any OTHER robot (alive)
                  // We exclude the moving robot itself so it can return to 'from' if free
                  const occupied = allRobots.some(r => 
                      r.id !== robot.id && !r.isDead && r.position.x === pos.x && r.position.y === pos.y
                  );
                  if (occupied) return false;
                  return true;
              });

              if (validExits.length > 0) {
                  // Pick random valid exit
                  const exit = validExits[Math.floor(Math.random() * validExits.length)];
                  robot.position = exit;
                  logs.push(`${name}: ЭКСТРЕННЫЙ ВЫХОД НА СУШУ.`);
              } else {
                  // No escape possible (trapped by obstacles/robots), stay at previous spot
                  logs.push(`${name}: ЗАСТРЯЛ В ВОДЕ.`);
              }

              return; 
          } else if (obs.type === 'BARREL') {
              const vec = { x: to.x - move.from.x, y: to.y - move.from.y };
              const behindBarrel = { x: to.x + vec.x, y: to.y + vec.y };
              
              const isBlocked = !isWithinBounds(behindBarrel) || 
                                allRobots.some(r => r.position.x === behindBarrel.x && r.position.y === behindBarrel.y && !r.isDead);

              const obsBehind = getObstacleAt(behindBarrel, nextState.obstacles);

              if (isBlocked) {
                  logs.push(`${name}: БОЧКА РАЗДАВЛЕНА.`);
                  triggerBarrelDestroy(obs, robot);
              } else if (obsBehind) {
                   if (obsBehind.type === 'WATER') {
                       // TRANSFORM BARREL TO BRIDGE!
                       // Remove Water
                       nextState.obstacles = nextState.obstacles.filter(o => o.id !== obsBehind.id);
                       // Update Barrel to Bridge at new pos
                       obs.position = behindBarrel;
                       obs.type = 'BRIDGE';
                       
                       robot.position = to;
                       logs.push(`${name}: ПОНТОН УСТАНОВЛЕН.`);
                       SoundEffects.splash(); // Sound: Barrel -> Bridge
                   } else {
                       // Rock, Barrel, Bridge?
                       // Crushing against obstacle
                       logs.push(`${name}: БОЧКА РАЗБИТА О ПРЕПЯТСТВИЕ.`);
                       triggerBarrelDestroy(obs, robot);
                   }
              } else {
                  // Empty space
                  obs.position = behindBarrel;
                  robot.position = to;
                  logs.push(`${name}: ПИНОК БОЧКИ.`);
                  SoundEffects.move(); // Sound: Barrel Move (use move sound or add new one)
              }
              return;
          } else if (obs.type === 'BRIDGE') {
              // Bridge is walkable, proceed to normal move logic below
              // but still check for robot collision on bridge
          }
      }

      const collider = allRobots.find(r => r.id !== robot.id && r.position.x === to.x && r.position.y === to.y && !r.isDead);
      if (collider) {
          logs.push(`${name}: СТОЛКНОВЕНИЕ С ${collider.type === 'PLAYER' ? 'ИГРОКОМ' : 'БОТОМ'}.`);
          SoundEffects.hitRobot(); // Sound: Robot Collision (Crunch)
          return;
      }

      robot.position = to;
      robot.lastAction = cmd;
      SoundEffects.move(); // Sound: Move Success
  });

  // 3. Process Attacks
  // Приоритет: Атаки происходят ПОСЛЕ движения.
  allRobots.forEach(attacker => {
      if (attacker.isDead) return;
      const cmd = attacker.type === 'PLAYER' ? playerCmd : botCommands[attacker.id];
      if (cmd && cmd.type === 'ATTACK') {
          // Force visual action
          attacker.lastAction = 'ATTACK';
          SoundEffects.attack(); // Sound: Attack Whoosh
          
          const vec = getVector(attacker.direction);
          const targetPos = { x: attacker.position.x + vec.x, y: attacker.position.y + vec.y };
          const name = attacker.type === 'PLAYER' ? 'ИГРОК' : `БОТ ${attacker.id.split('-')[1]}`;
          
          // WEAPON DAMAGE CHECK
          const baseDamage = attacker.systems.weapon === 'OK' ? 2 : 1;

          const targetRobot = allRobots.find(r => r.position.x === targetPos.x && r.position.y === targetPos.y && !r.isDead);
          if (targetRobot) {
              const targetName = targetRobot.type === 'PLAYER' ? 'ИГРОКА' : `БОТА ${targetRobot.id.split('-')[1]}`;
              const targetCmd = targetRobot.type === 'PLAYER' ? playerCmd : botCommands[targetRobot.id];
              
              let actualDamage = baseDamage;
              let isBlocked = false;

              if (targetCmd && targetCmd.type === 'DEFEND') {
                   // Shield blocks 1 damage
                   actualDamage = Math.max(0, baseDamage - 1);
                   isBlocked = true;
                   logs.push(`${name} АТАКУЕТ (${baseDamage}), НО ${targetName} БЛОКИРУЕТ (-1)!`);
                   SoundEffects.hitShield(); // Sound: Block
              } else {
                   logs.push(`${name} НАНОСИТ УДАР ПО ${targetName} (${baseDamage})!`);
              }

              if (actualDamage > 0) {
                   if (targetRobot.type === 'PLAYER') {
                       const currentAmount = nextState.pendingDamage ? nextState.pendingDamage.amount : 0;
                       nextState.pendingDamage = { robotId: targetRobot.id, amount: currentAmount + actualDamage };
                       targetRobot.wasHit = true;
                       SoundEffects.hitRobot(); // Sound: Hit
                   } else {
                       resolveBotDamage(targetRobot, actualDamage);
                   }
              } else if (isBlocked && actualDamage === 0) {
                   logs.push(`${targetName} ПОЛНОСТЬЮ ОТРАЗИЛ УДАР.`);
                   SoundEffects.hitShield();
              }

          } else {
              const obstacle = getObstacleAt(targetPos, nextState.obstacles);
              if (obstacle && (obstacle.type === 'BARREL' || obstacle.type === 'BRIDGE')) {
                  // Can destroy barrels and bridges
                  logs.push(`${name} РАЗРУБИЛ ${obstacle.type === 'BARREL' ? 'БОЧКУ' : 'ПОНТОН'}.`);
                  triggerBarrelDestroy(obstacle, attacker);
              } else {
                  logs.push(`${name} РАССЕКАЕТ ВОЗДУХ.`);
              }
          }
      }
  });

  // Check Death
  if (nextState.player.hp <= 0 && !nextState.player.isDead) {
      nextState.player.isDead = true;
      SoundEffects.explode(); // Sound: Player Destroyed
      logs.push('КРИТИЧЕСКИЙ ОТКАЗ СИСТЕМ. ИГРОК ПОВЕРЖЕН.');
  }

  if (nextState.pendingDamage) {
      nextState.phase = 'DAMAGE_ALLOCATION';
  }

  nextState.logs = [...currentState.logs, ...logs];
  return nextState;
};

// --- Updated Bot AI (Based on Provided Code) ---

const DIRECTIONS_ORDER: Direction[] = ['N', 'E', 'S', 'W'];
const DIRECTIONS = [
    { dx: 0, dy: -1 }, // N
    { dx: 1, dy: 0 },  // E
    { dx: 0, dy: 1 },  // S
    { dx: -1, dy: 0 }  // W
];

const manhattanDist = (a: Position, b: Position) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

// Can Move logic adapted for PLANNING (only checks static map, ignores dynamic bots in simulation to keep simple like original code)
const canMove = (unit: Position, dx: number, dy: number, obstacles: Obstacle[]): boolean => {
    const nx = unit.x + dx;
    const ny = unit.y + dy;
    if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) return false;
    
    // Check Rocks and Water (Barrels/Bridges are effectively movable/walkable for planning heuristics)
    const obs = obstacles.find(o => o.position.x === nx && o.position.y === ny);
    if (obs && (obs.type === 'ROCK' || obs.type === 'WATER')) return false;

    return true;
};

const canMoveBack = (unit: Robot, obstacles: Obstacle[]): boolean => {
    const dirIdx = DIRECTIONS_ORDER.indexOf(unit.direction);
    const backDirIdx = (dirIdx + 2) % 4;
    const d = DIRECTIONS[backDirIdx];
    return canMove(unit.position, d.dx, d.dy, obstacles);
};

const getTurnToPlayer = (bot: Robot, playerPos: Position, stock: any, obstacles: Obstacle[]): CommandType | null => {
    const dirIdx = DIRECTIONS_ORDER.indexOf(bot.direction);
    let bestDir = dirIdx;
    let minDist = manhattanDist(bot.position, playerPos);
    let foundBetter = false;

    for (let d = 0; d < 4; d++) {
        const moveVec = DIRECTIONS[d];
        if (canMove(bot.position, moveVec.dx, moveVec.dy, obstacles)) {
            const nx = bot.position.x + moveVec.dx;
            const ny = bot.position.y + moveVec.dy;
            const dist = manhattanDist({x: nx, y: ny}, playerPos);
            if (dist < minDist) {
                minDist = dist;
                bestDir = d;
                foundBetter = true;
            }
        }
    }

    if (!foundBetter) return null;
    const turnDiff = (bestDir - dirIdx + 4) % 4;
    
    if (turnDiff === 1 && stock.R > 0) return 'TURN_RIGHT';
    if (turnDiff === 3 && stock.L > 0) return 'TURN_LEFT';
    if (turnDiff === 2) {
         if (stock.L > 0 && stock.R > 0) return Math.random() > 0.5 ? 'TURN_LEFT' : 'TURN_RIGHT';
         if (stock.L > 0) return 'TURN_LEFT';
         if (stock.R > 0) return 'TURN_RIGHT';
    }
    return null;
};

const getTurnToEscape = (bot: Robot, playerPos: Position, stock: any, obstacles: Obstacle[]): CommandType | null => {
    const dirIdx = DIRECTIONS_ORDER.indexOf(bot.direction);
    let worstDir = dirIdx;
    let maxDist = -1;
    let foundWorse = false;

    for (let d = 0; d < 4; d++) {
        const moveVec = DIRECTIONS[d];
        if (canMove(bot.position, moveVec.dx, moveVec.dy, obstacles)) {
            const nx = bot.position.x + moveVec.dx;
            const ny = bot.position.y + moveVec.dy;
            const dist = manhattanDist({x: nx, y: ny}, playerPos);
            if (dist > maxDist) {
                maxDist = dist;
                worstDir = d;
                foundWorse = true;
            }
        }
    }

    if (!foundWorse) return null;
    const turnDiff = (worstDir - dirIdx + 4) % 4;

    if (turnDiff === 1 && stock.R > 0) return 'TURN_RIGHT';
    if (turnDiff === 3 && stock.L > 0) return 'TURN_LEFT';
    if (turnDiff === 2) {
         if (stock.L > 0 && stock.R > 0) return Math.random() > 0.5 ? 'TURN_LEFT' : 'TURN_RIGHT';
         if (stock.L > 0) return 'TURN_LEFT';
         if (stock.R > 0) return 'TURN_RIGHT';
    }
    return null;
};

export const generateBotCommands = (bot: Robot, state: GameState, length: number): { commands: Command[], mode: string } => {
    const commands: Command[] = [];
    if (bot.isDead) return { commands: [], mode: 'DEAD' };

    const actualLength = bot.systems.head === 'OK' ? 4 : 3;
    
    // Choose Mode
    const modes = ['aggressive', 'normal', 'cautious'];
    const botMode = modes[Math.floor(Math.random() * modes.length)];

    // Initial Stock (from code: 2 of each, 1 Wait)
    const stock = {
        F: 2, // Forward
        B: 2, // Backward
        L: 2, // Left
        R: 2, // Right
        A: 2, // Attack
        D: 2, // Defend
        W: 1  // Wait
    };

    // Simulation State
    let simBot = { ...bot }; // copy for simulation

    for (let step = 0; step < length; step++) {
        if (step >= actualLength) {
             commands.push({ ...COMMANDS.find(c => c.type === 'WAIT')!, id: `bot-${bot.id}-${step}` });
             continue;
        }

        let chosenCmd: 'F'|'B'|'L'|'R'|'A'|'D'|'W' | null = null;
        
        const dirIdx = DIRECTIONS_ORDER.indexOf(simBot.direction);
        const vec = DIRECTIONS[dirIdx];
        const nx = simBot.position.x + vec.dx;
        const ny = simBot.position.y + vec.dy;
        const playerPos = state.player.position;

        const canAttack = (nx === playerPos.x && ny === playerPos.y) && stock.A > 0;
        const dist = manhattanDist(simBot.position, playerPos);
        const adjacent = dist === 1;

        // --- Logic Selection based on Mode ---
        if (botMode === 'aggressive') {
             if (canAttack && stock.A > 0) {
                 chosenCmd = 'A';
             } else {
                 const turnCmd = getTurnToPlayer(simBot, playerPos, stock, state.obstacles);
                 if (turnCmd) {
                     // Map CommandType back to simple code
                     if (turnCmd === 'TURN_LEFT') chosenCmd = 'L';
                     else if (turnCmd === 'TURN_RIGHT') chosenCmd = 'R';
                 } else if (stock.F > 0 && canMove(simBot.position, vec.dx, vec.dy, state.obstacles)) {
                     chosenCmd = 'F';
                 } else {
                     if (stock.A > 0) chosenCmd = 'A';
                     else if (stock.W > 0) chosenCmd = 'W';
                 }
             }
        } else if (botMode === 'cautious') {
             if (adjacent) {
                 if (stock.D > 0) chosenCmd = 'D';
                 else if (stock.B > 0 && simBot.systems.chassis === 'OK' && canMoveBack(simBot, state.obstacles)) chosenCmd = 'B';
                 else if (stock.W > 0) chosenCmd = 'W';
             } else {
                 const escapeTurn = getTurnToEscape(simBot, playerPos, stock, state.obstacles);
                 if (escapeTurn) {
                      if (escapeTurn === 'TURN_LEFT') chosenCmd = 'L';
                      else if (escapeTurn === 'TURN_RIGHT') chosenCmd = 'R';
                 } else if (stock.B > 0 && simBot.systems.chassis === 'OK' && canMoveBack(simBot, state.obstacles)) {
                      chosenCmd = 'B';
                 } else if (stock.W > 0) {
                      chosenCmd = 'W';
                 }
             }
        } else { // normal
             if (adjacent) {
                 if (canAttack && stock.A > 0 && Math.random() < 0.6) {
                     chosenCmd = 'A';
                 } else if (stock.D > 0) {
                     chosenCmd = 'D';
                 } else if (stock.W > 0) {
                     chosenCmd = 'W';
                 }
             } else {
                 const turnCmd = getTurnToPlayer(simBot, playerPos, stock, state.obstacles);
                 if (turnCmd) {
                     if (turnCmd === 'TURN_LEFT') chosenCmd = 'L';
                     else if (turnCmd === 'TURN_RIGHT') chosenCmd = 'R';
                 } else if (stock.F > 0 && canMove(simBot.position, vec.dx, vec.dy, state.obstacles)) {
                     chosenCmd = 'F';
                 } else if (stock.D > 0) {
                     chosenCmd = 'D';
                 } else if (stock.W > 0) {
                     chosenCmd = 'W';
                 }
             }
        }

        // --- Fallback if no command chosen or stock empty ---
        if (!chosenCmd || stock[chosenCmd] <= 0) {
            const options: ('F'|'B'|'L'|'R'|'A'|'D'|'W')[] = [];
            if (stock.L > 0) options.push('L');
            if (stock.R > 0) options.push('R');
            if (stock.F > 0 && canMove(simBot.position, vec.dx, vec.dy, state.obstacles)) options.push('F');
            if (stock.B > 0 && simBot.systems.chassis === 'OK' && canMoveBack(simBot, state.obstacles)) options.push('B');
            if (stock.A > 0) options.push('A');
            if (stock.D > 0) options.push('D');
            if (stock.W > 0) options.push('W');
            
            chosenCmd = options.length ? options[Math.floor(Math.random() * options.length)] : 'W';
        }

        // --- Apply Command & Update Sim ---
        if (stock[chosenCmd] > 0) {
            stock[chosenCmd]--;
            
            // Map simple code to CommandType
            let type: CommandType = 'WAIT';
            if (chosenCmd === 'F') type = 'FORWARD';
            if (chosenCmd === 'B') type = 'BACKWARD';
            if (chosenCmd === 'L') type = 'TURN_LEFT';
            if (chosenCmd === 'R') type = 'TURN_RIGHT';
            if (chosenCmd === 'A') type = 'ATTACK';
            if (chosenCmd === 'D') type = 'DEFEND';
            if (chosenCmd === 'W') type = 'WAIT';

            const cmdDef = COMMANDS.find(c => c.type === type)!;
            commands.push({ ...cmdDef, id: `bot-${bot.id}-${step}` });

            // Simulate effect for next step
            if (chosenCmd === 'F' && canMove(simBot.position, vec.dx, vec.dy, state.obstacles)) {
                simBot.position = { x: simBot.position.x + vec.dx, y: simBot.position.y + vec.dy };
            } else if (chosenCmd === 'B' && canMoveBack(simBot, state.obstacles)) {
                const backDirIdx = (dirIdx + 2) % 4;
                const bVec = DIRECTIONS[backDirIdx];
                simBot.position = { x: simBot.position.x + bVec.dx, y: simBot.position.y + bVec.dy };
            } else if (chosenCmd === 'L') {
                const newIdx = (dirIdx + 3) % 4;
                simBot.direction = DIRECTIONS_ORDER[newIdx];
            } else if (chosenCmd === 'R') {
                const newIdx = (dirIdx + 1) % 4;
                simBot.direction = DIRECTIONS_ORDER[newIdx];
            }
        } else {
             const cmdDef = COMMANDS.find(c => c.type === 'WAIT')!;
             commands.push({ ...cmdDef, id: `bot-${bot.id}-${step}` });
        }
    }

    const modeName = {
        'aggressive': 'Агрессивный',
        'normal': 'Нормальный',
        'cautious': 'Осторожный',
        'DEAD': 'Мертв'
    }[botMode] || botMode;

    return { commands, mode: modeName };
};