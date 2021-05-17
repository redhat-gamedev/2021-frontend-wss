import { CLUSTER_NAME, GAME_BONUS_DURATION_MS } from '@app/config';
import GameConfiguration, { GameState } from '@app/models/game.configuration';
import { nanoid } from 'nanoid';

let currentGameConfig: GameConfiguration;

/**
 * Power on self test for game data.
 *
 * Previously this was used to connect with an external cache to fetch the
 * configuration, but now we simply generate.
 */
export async function init(): Promise<GameConfiguration> {
  currentGameConfig = GameConfiguration.from({
    uuid: nanoid(),
    date: new Date().toISOString(),
    state: GameState.Active,
    bonusDuration: GAME_BONUS_DURATION_MS,
    cluster: CLUSTER_NAME
  });

  return currentGameConfig;
}

export function getGameConfiguration() {
  return currentGameConfig;
}
