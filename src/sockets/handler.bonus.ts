import { GameState } from '@app/models/game.configuration';
import { MessageHandler } from './common';
import { BonusDataPayload } from '@app/payloads/incoming';
import * as events from '@app/events';
import {
  OutgoingMsgType,
  ValidationErrorPayload
} from '@app/payloads/outgoing';
import PlayerConfiguration, {
  PlayerConfigurationData
} from '@app/models/player.configuration';
import { getSocketDataContainerByPlayerUUID } from './player.sockets';
import PlayerSocketDataContainer from './player.socket.container';
import { getPlayerSpecificData } from './common';
import { upsertMatchInCache } from '@app/stores/matchmaking';
import log from '@app/log';
import { MatchPhase } from '@app/models/match.instance';
import { applyScoreForBonus } from '@app/scoring';

const bonusHandler: MessageHandler<
  BonusDataPayload,
  PlayerConfigurationData | ValidationErrorPayload
> = async (container: PlayerSocketDataContainer, bonus) => {
  const basePlayer = container.getPlayer();

  if (!basePlayer) {
    throw new Error('no player associated with websocket for bonus');
  }

  const { game, opponent, match, player } = await getPlayerSpecificData(
    basePlayer
  );

  if (!game.isInState(GameState.Active)) {
    throw new Error(
      `player ${player.getUUID()} cannot send bonus payload when game state is "${game.getGameState()}"`
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

  if (!match.isInPhase(MatchPhase.Bonus)) {
    throw new Error('match is not currently in a bonus round state');
  }

  if (!opponent) {
    throw new Error(
      `no opponent was found in bonus handler for player ${player.getUUID()}`
    );
  }

  log.debug(
    `player ${player.getUUID()} recorded ${
      bonus.hits
    } hits in their bonus round`
  );

  // Bonus is a fire and forget event. It doesn't throw errors either.
  const scoreDelta = applyScoreForBonus(bonus.hits, match, player);
  events.bonus(game, match, player, bonus.hits, scoreDelta);

  match.changeTurn();
  await upsertMatchInCache(match);

  // Update the opponent with new game state
  const opponentSocket = getSocketDataContainerByPlayerUUID(opponent.getUUID());
  if (opponentSocket) {
    opponentSocket.send({
      type: OutgoingMsgType.BonusResult,
      data: new PlayerConfiguration(game, opponent, match).toJSON()
    });
  } else {
    log.warn(
      'cannot inform opponent of bonus result. opponent socket not found'
    );
  }

  // Update the player with new game state information
  return {
    type: OutgoingMsgType.BonusResult,
    data: new PlayerConfiguration(game, player, match).toJSON()
  };
};

export default bonusHandler;
