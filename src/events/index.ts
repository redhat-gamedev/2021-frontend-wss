import { KAKFAJS_CONFIG } from '@app/config';
import MatchPlayer from '@app/models/match.player';
import GameConfiguration from '@app/models/game.configuration';
import MatchInstance from '@app/models/match.instance';
import { AttackResult } from '@app/payloads/common';
import {
  EventType,
  AttackEvent,
  MatchEndEvent,
  MatchStartEvent,
  BonusEvent,
  BasePlayerData,
  KafkaEventType
} from './types';
import getKafkaSender from '@app/kafka';
import { getBinding, ServiceType, ClientType } from 'kube-service-bindings';
import { KafkaConfig } from 'kafkajs';
import log from '@app/log';

const kafkaConfig = getKafkaConfig();
const kafkaSender = kafkaConfig ? getKafkaSender(kafkaConfig) : undefined;

export function matchStart(
  game: GameConfiguration,
  match: MatchInstance,
  playerA: MatchPlayer,
  playerB: MatchPlayer
): Promise<void> {
  const evt: MatchStartEvent = {
    game: game.getUUID(),
    match: match.getUUID(),

    playerA: toBasePlayerData(playerA),
    playerB: toBasePlayerData(playerB)
  };

  return sendEvent(EventType.MatchStart, evt);
}

export function attack(
  game: GameConfiguration,
  match: MatchInstance,
  by: MatchPlayer,
  attackResult: AttackResult,
  scoreDelta: number
): Promise<void> {
  const evt: AttackEvent = {
    game: game.getUUID(),
    match: match.getUUID(),

    attacker: by.getUUID(),
    hit: attackResult.hit,
    origin: {
      x: attackResult.origin[0],
      y: attackResult.origin[1]
    },
    destroyed:
      attackResult.hit && attackResult.destroyed
        ? attackResult.type
        : undefined,
    scoreDelta
  };

  return sendEvent(EventType.Attack, evt);
}

export function bonus(
  game: GameConfiguration,
  match: MatchInstance,
  player: MatchPlayer,
  shots: number,
  scoreDelta: number
): Promise<void> {
  const evt: BonusEvent = {
    game: game.getUUID(),
    match: match.getUUID(),

    scoreDelta,
    attacker: player.getUUID(),
    shots
  };

  return sendEvent(EventType.Bonus, evt);
}

export async function matchEnd(
  game: GameConfiguration,
  match: MatchInstance,
  winner: MatchPlayer,
  loser: MatchPlayer
): Promise<void> {
  const evt: MatchEndEvent = {
    game: game.getUUID(),
    match: match.getUUID(),

    winner: {
      uuid: winner.getUUID(),
      score: winner.getScore(),
      shotCount: winner.getShotsFiredCount()
    },
    loser: {
      uuid: loser.getUUID(),
      score: loser.getScore()
    }
  };

  return sendEvent(EventType.MatchEnd, evt);
}

/**
 * Utility function to create an BasePlayerData structured type.
 * @param player
 */
function toBasePlayerData(player: MatchPlayer): BasePlayerData {
  return {
    username: player.getUsername(),
    uuid: player.getUUID(),
    human: !player.isAiPlayer(),
    board: player.getShipPositionData()
  };
}

/**
 * Wrapper to handle writing to Kafka, or performs a noop if the Kafka
 * connection is not configured.
 * @param type {EventType}
 * @param data {CloudEventBase}
 * @returns {Promise<void>}
 */
function sendEvent(type: EventType, data: KafkaEventType) {
  return kafkaSender ? kafkaSender(type, data) : Promise.resolve();
}

/**
 * Reads Kafka connection from the environment or service bindings directory.
 * This can return undefined since the Kafka integration is optional.
 * @returns {KafkaConfig}
 */
function getKafkaConfig(): KafkaConfig | undefined {
  if (KAKFAJS_CONFIG.brokers) {
    return KAKFAJS_CONFIG as KafkaConfig;
  } else {
    try {
      return getBinding(ServiceType.Kafka, ClientType.kafkajs) as KafkaConfig;
    } catch (e) {
      log.warn(
        'No Kafka bindings nor environment variables found. Events will not be sent to Kafka'
      );
    }
  }
}
