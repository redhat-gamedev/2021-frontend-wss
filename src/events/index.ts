import { KAKFAJS_CONFIG } from '@app/config';
import MatchPlayer from '@app/models/match.player';
import { PredictionData } from '@app/payloads/incoming';
import GameConfiguration from '@app/models/game.configuration';
import MatchInstance from '@app/models/match.instance';
import { AttackResult } from '@app/payloads/common';
import {
  EventType,
  AttackEventData,
  MatchEndEventData,
  MatchStartEventData,
  BonusAttackEventData,
  AttackingPlayerData,
  BasePlayerData,
  CloudEventBase
} from './types';
import getKafkaSender from '@app/kafka';
import { getBinding, ServiceType, ClientType } from 'kube-service-bindings';
import { KafkaConfig } from 'kafkajs';

const kafkaConfig = getKafkaConfig();
const kafkaSender = kafkaConfig ? getKafkaSender(kafkaConfig) : undefined;

export function matchStart(
  game: GameConfiguration,
  match: MatchInstance,
  playerA: MatchPlayer,
  playerB: MatchPlayer
): Promise<void> {
  const evt: MatchStartEventData = {
    game: game.getUUID(),
    match: match.getUUID(),
    playerA: toBasePlayerData(playerA),
    playerB: toBasePlayerData(playerB)
  };
  const type = EventType.MatchStart;

  return sendEvent(type, evt);
}

export function attack(
  game: GameConfiguration,
  match: MatchInstance,
  by: MatchPlayer,
  against: MatchPlayer,
  attackResult: AttackResult,
  prediction?: PredictionData
): Promise<void> {
  const evt: AttackEventData = {
    game: game.getUUID(),
    hit: attackResult.hit,
    origin: `${attackResult.origin[0]},${attackResult.origin[1]}` as const,
    match: match.getUUID(),
    by: toAttackingPlayerData(by, prediction),
    against: toAttackingPlayerData(against, prediction)
  };
  const type = EventType.Attack;

  if (attackResult.hit && attackResult.destroyed) {
    evt.destroyed = attackResult.type;
  }

  return sendEvent(type, evt);
}

export function bonus(
  game: GameConfiguration,
  match: MatchInstance,
  player: MatchPlayer,
  shots: number
): Promise<void> {
  const evt: BonusAttackEventData = {
    game: game.getUUID(),
    match: match.getUUID(),
    by: {
      username: player.getUsername(),
      uuid: player.getUUID(),
      human: !player.isAiPlayer()
    },
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
  const evt: MatchEndEventData = {
    game: game.getUUID(),
    match: match.getUUID(),
    winner: toBasePlayerData(winner),
    loser: toBasePlayerData(loser)
  };

  return sendEvent(EventType.MatchEnd, evt);
}

/**
 * Utility function to create an AttackingPlayerData structured type.
 * @param player
 * @param prediction
 */
function toAttackingPlayerData(
  player: MatchPlayer,
  prediction?: PredictionData
): AttackingPlayerData {
  return {
    consecutiveHitsCount: player.getContinuousHitsCount(),
    shotCount: player.getShotsFiredCount(),
    prediction,
    ...toBasePlayerData(player)
  };
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
function sendEvent(type: EventType, data: CloudEventBase) {
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
