import log from '@app/log';
import * as matchmaking from '@app/stores/matchmaking';
import * as players from '@app/stores/players';
import { GameState } from '@app/models/game.configuration';
import * as ce from '@app/cloud-events/send';
import { isGameOverForPlayer } from '@app/game';
import { MessageHandler } from './common';
import { AttackDataPayload } from '@app/payloads/incoming';
import {
  OutgoingMsgType,
  ValidationErrorPayload
} from '@app/payloads/outgoing';
import PlayerConfiguration, {
  PlayerConfigurationData
} from '@app/models/player.configuration';
import * as ml from '@app/ml';
import { AttackResult } from '@app/payloads/common';
import { getSocketDataContainerByPlayerUUID } from './player.sockets';
import PlayerSocketDataContainer from './player.socket.container';
import { getPlayerSpecificData } from './common';

type AttackResponse = {
  // UUID of the player that performed the attack
  attacker: string;
  result: AttackResult;
};

type MergedAttackReponse = AttackResponse & PlayerConfigurationData;

const attackHandler: MessageHandler<
  AttackDataPayload,
  MergedAttackReponse | ValidationErrorPayload
> = async (container: PlayerSocketDataContainer, attack: AttackDataPayload) => {
  const info = container.getPlayerInfo();

  if (!info) {
    throw new Error('failed to find player associated with this websocket');
  }

  // Despite the fact a player is associated with a socket, we always
  // use the cache as a source of truth. The socket is a lookup reference
  const player = await players.getPlayerWithUUID(info.uuid);
  if (!player) {
    throw new Error('failed to find player data');
  }

  const { game, opponent, match } = await getPlayerSpecificData(player);

  if (!game.isInState(GameState.Active)) {
    throw new Error(
      `player ${player.getUUID()} cannot attack when game state is "${game.getGameState()}"`
    );
  }

  if (!match) {
    throw new Error(
      `failed to find match associated with player ${player.getUUID()}`
    );
  }

  if (!match.isPlayerTurn(player)) {
    throw new Error(
      `player ${player.getUUID()} attempted to attack, but it's not their turn`
    );
  }

  if (!match.isReady()) {
    throw new Error(
      `player ${player.getUUID()} attempted an attack, but match instance is not ready`
    );
  }

  if (!opponent) {
    throw new Error(
      `no opponent was found in attack handler for player ${player.getUUID()}`
    );
  }

  if (player.hasAttackedLocation(attack.origin)) {
    return {
      type: OutgoingMsgType.BadAttack,
      data: {
        info: `location ${attack.origin.join(',')} has already been attacked`
      }
    };
  }

  if (!player.isAiPlayer() && attack.prediction) {
    return {
      type: OutgoingMsgType.BadPayload,
      data: {
        info: `"prediction" key not allowed in data payload`
      }
    };
  }

  log.debug(
    `determine player ${player.getUUID()} attack hit/miss vs ${opponent.getUUID()}. Attack data %j`,
    attack
  );

  // Apply the attack against the opponent to determine the hit vs. miss and
  // if a ship has been destroyed as a result
  const attackResult: AttackResult = opponent.determineAttackResult(attack);

  // Record the attack result in the attacking players state
  player.recordAttackResult(attack, attackResult);

  if (attackResult.hit) {
    log.debug(
      `player ${player.getUUID()} hit ${
        attackResult.type
      } of opponent ${opponent.getUUID()} at %j`,
      attack.origin
    );

    // Send the new cloud event type until we move away from the previous hit/miss/sink
    ce.attack(game, match, player, opponent, attackResult, attack.prediction);
  } else {
    log.debug(
      `player ${player.getUUID()} attack %j did not hit opponent ${opponent.getUUID()} ships`,
      attack.origin
    );
  }

  // Save both updated player objects to cache
  await Promise.all([
    players.upsertPlayerInCache(player),
    players.upsertPlayerInCache(opponent)
  ]);

  if (isGameOverForPlayer(opponent)) {
    log.info(
      `determined that player ${opponent.getUUID()} lost match ${match.getUUID()} against ${player.getMatchInstanceUUID()}`
    );

    // The opponent's ships have all been hit. This player is the winner!
    match.setWinner(player);

    ce.matchEnd(game, match, player, opponent);

    // Write payload to storage for analysis by ML services
    ml.writeGameRecord(player, opponent, match, game);
  } else {
    // Change turns so the player that just received an attack can retaliate
    match.changeTurn();
  }

  await matchmaking.upsertMatchInCache(match);

  // If the opponent is connected, update with attack results too
  // If they're not connected they'll get updated on reconnect
  const opponentSocket = getSocketDataContainerByPlayerUUID(opponent.getUUID());
  if (opponentSocket) {
    opponentSocket.send({
      type: OutgoingMsgType.AttackResult,
      data: {
        result: attackResult,
        attacker: player.getUUID(),
        ...new PlayerConfiguration(game, opponent, match, player).toJSON()
      }
    });
  }

  // Return the attack result to the player
  return {
    type: OutgoingMsgType.AttackResult,
    data: {
      result: attackResult,
      attacker: player.getUUID(),
      ...new PlayerConfiguration(game, player, match, opponent).toJSON()
    }
  };
};

export default attackHandler;
