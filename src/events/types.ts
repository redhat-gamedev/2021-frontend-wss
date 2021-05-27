import { ShipType } from '@app/game/types';
import { PlayerPositionData } from '@app/models/match.player';

export enum EventType {
  MatchStart = 'matches',
  Attack = 'attacks',
  Bonus = 'bonuses',
  MatchEnd = 'results'
}

export type KafkaEventType =
  | AttackEvent
  | BonusEvent
  | MatchStartEvent
  | MatchEndEvent;
export type KafkaEventBase<T extends KafkaEventType> = {
  game: string;
  match: string;
  data: T;
};

export type BasePlayerData = {
  uuid: string;
  username: string;
  human: boolean;
  board: PlayerPositionData;
};

export type AttackEvent = {
  attacker: string;
  // Hit (true) or miss (false)
  hit: boolean;
  // If this shot destroyed a ship, then the ship type is included
  destroyed?: ShipType;
  // The shot coordinates
  origin: [number, number];
  // The score that this shot was worth
  scoreDelta: number;
};

export type BonusEvent = {
  attacker: string;
  // Number of taps/shots the player managed to perform during the bonus round
  shots: number;
  // The score that this bonus round was worth
  scoreDelta: number;
};

export type MatchStartEvent = {
  playerA: BasePlayerData;
  playerB: BasePlayerData;
};

export type MatchEndEvent = {
  // Send the winner/loser UUIDs
  winner: string;
  loser: string;
};
