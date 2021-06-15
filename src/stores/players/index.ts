import Player, { PlayerData } from '@app/models/player';
import log from '@app/log';
import generateUserName from './username.generator';
import { nanoid } from 'nanoid';
import { ConnectionRequestPayload } from '@app/payloads/incoming';
import { getGameConfiguration } from '@app/stores/game';
import { createMatchInstanceWithData } from '@app/stores/matchmaking';
import NodeCache from 'node-cache';
import * as events from '@app/events';

const cache = new NodeCache({
  stdTTL: 60 * 60 // 1 hour
});

/**
 * Initialises a Player entity based on an incoming "connection" event.
 *
 * After this function has finished we'll have:
 *
 *  - A new player in DATAGRID_PLAYER_DATA_STORE.
 *  - Possibly a new match in  DATAGRID_MATCH_DATA_STORE, or the player will
 *    be assigned to an existing match.
 *
 * @param data
 */
export async function initialisePlayer(data: ConnectionRequestPayload) {
  log.debug('client connected with connection payload: %j', data);

  const game = getGameConfiguration();

  if (data.playerId) {
    log.debug(
      `player "${data.playerId}" is trying to reconnect for game "${
        data.gameId
      }". current game is "${game.getUUID()}"`
    );
  }

  if (game.getUUID() === data.gameId) {
    log.debug(`reading player ${data.playerId} for reconnect`);
    const player = data.playerId
      ? await getPlayerWithUUID(data.playerId)
      : undefined;

    if (
      !player ||
      player.getUsername() !== data.username ||
      game.getUUID() !== data.gameId
    ) {
      // First time this client is connecting, or they provided stale lookup data
      // we compare the usernames as an extra layer of protection, though UUIDs
      // should be enough realistically...
      log.trace(
        `player ${data.playerId} attempted reconnect for game ${data.gameId}, but failed. assigning them a new identity. comparison was: %j`,
        {
          incoming: {
            gameId: data.gameId,
            username: data.playerId
          },
          server: {
            gameId: game.getUUID(),
            username: player?.getUsername()
          }
        }
      );
      return setupNewPlayer();
    } else {
      log.debug('retrieved existing player: %j', player.toJSON());

      return player;
    }
  } else {
    log.debug(
      'setting up connection attempt with data %j as a new player',
      data
    );
    return setupNewPlayer();
  }
}

async function setupNewPlayer() {
  const game = getGameConfiguration();
  const newPlayerData = generateNewPlayerData({ ai: false });
  const newOpponentData = generateNewPlayerData({ ai: true });
  const match = await createMatchInstanceWithData(
    newPlayerData,
    newOpponentData
  );

  log.debug('setting up new player: %j', newPlayerData);
  log.debug(`created AI opponent for player: %j`, newOpponentData);

  const player = new Player({
    ...newPlayerData,
    match: match.getUUID()
  });

  const opponent = new Player({
    ...newOpponentData,
    match: match.getUUID()
  });

  await Promise.all([
    upsertPlayerInCache(opponent),
    upsertPlayerInCache(player)
  ]);

  return player;
}

/**
 * Returns an instance of a Player from the cache, or undefined if the player
 * was not found in the cache
 * @param uuid
 */
async function getPlayerWithUUID(uuid: string): Promise<Player | undefined> {
  log.trace(`reading data for player ${uuid}`);

  const data = cache.get<PlayerData>(uuid);

  if (data) {
    try {
      return Player.from(data);
    } catch {
      log.warn(
        `found player data for "${uuid}", but failed to parse to JSON: %j`,
        data
      );
      return undefined;
    }
  } else {
    return undefined;
  }
}

/**
 * Insert/Update the player entry in the cache
 * @param player
 */
export async function upsertPlayerInCache(player: Player) {
  const data = player.toJSON();

  log.trace(`writing player to cache: %j`, data);

  return cache.set(player.getUUID(), data);
}

/**
 * Creates a new player.
 * TODO: verify that the generated username has not been used yet
 */
export function generateNewPlayerData(opts: { ai: boolean }) {
  const username = generateUserName();
  const uuid = nanoid();

  events.playerCreate(getGameConfiguration(), uuid, username, !opts.ai);

  return { username, isAi: opts.ai, uuid };
}
