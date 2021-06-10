import { ShipType } from '@app/game/types';
import { PlayerPositionData } from '@app/models/match.player';

export enum EventType {
  PlayerCreate = 'players',
  MatchStart = 'matches',
  Attack = 'attacks',
  Bonus = 'bonuses',
  MatchEnd = 'results'
}

export type KafkaEventType =
  | PlayerCreateEvent
  | AttackEvent
  | BonusEvent
  | MatchStartEvent
  | MatchEndEvent;

export type KafkaEventBase = {
  game: string;
  match?: string;
  uuid?: string;
};

export type PlayerCreateEvent = KafkaEventBase & {
  uuid: string;
  username: string;
  human: boolean;
};

export type AttackEvent = KafkaEventBase & {
  attacker: string;
  // Hit (true) or miss (false)
  hit: boolean;
  // If this shot destroyed a ship, then the ship type is included
  destroyed?: ShipType;
  // The shot coordinates
  origin: {
    x: number;
    y: number;
  };
  // The score that this shot was worth
  scoreDelta: number;
};

export type BonusEvent = KafkaEventBase & {
  attacker: string;
  // Number of taps/shots the player managed to perform during the bonus round
  shots: number;
  // The score that this bonus round was worth
  scoreDelta: number;
};

export type MatchStartEvent = KafkaEventBase & {
  playerA: {
    uuid: string;
    board: PlayerPositionData;
  };
  playerB: {
    uuid: string;
    board: PlayerPositionData;
  };
};

export type MatchEndEvent = KafkaEventBase & {
  // Send the winner/loser UUIDs
  winner: {
    uuid: string;
    score: number;
    shotCount: number;
  };
  loser: {
    uuid: string;
    score: number;
  };
};
