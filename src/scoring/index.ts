import { ShipType } from '@app/game/types';
import log from '@app/log';
import MatchInstance from '@app/models/match.instance';
import MatchPlayer from '@app/models/match.player';
import { AttackResult } from '@app/payloads/common';
import { OutgoingMsgType } from '@app/payloads/outgoing';
import { getSocketDataContainerByPlayerUUID } from '@app/sockets/player.sockets';
import { upsertMatchInCache } from '@app/stores/matchmaking';
import { exist } from 'joi';

type HighScoreEntry = {
  matchId: string;
  playerId: string;
  human: boolean;
  username: string;
  score: number;
  updatedAt: number;
};

const HIGH_SCORE_ENTRY_COUNT = 20;
const SCORE_HIT = 5;
const SCORE_BONUS = 5;
const SCORE_SINK_MAP: { [key in ShipType]: number } = {
  [ShipType.Carrier]: 250,
  [ShipType.Battleship]: 200,
  [ShipType.Submarine]: 150,
  [ShipType.Destroyer]: 100
};

const highscores: HighScoreEntry[] = [];

export function getHighScores() {
  return highscores;
}

/**
 * Returns the score value for a given number of bonus hits
 * @param hits
 * @returns
 */
export function applyScoreForBonus(
  hits: number,
  match: MatchInstance,
  player: MatchPlayer
) {
  updatePlayerScoreAndMatch(hits * SCORE_BONUS, match, player);
}

/**
 * Returns the score value for a given shot
 * @param attack
 * @returns {number}
 */
export function applyScoreForShot(
  attack: AttackResult,
  match: MatchInstance,
  player: MatchPlayer
) {
  let score = 0;

  if (attack.hit) {
    score += SCORE_HIT;

    if (attack.destroyed) {
      score += SCORE_SINK_MAP[attack.type] + SCORE_HIT;
    }
  }

  // Score updates need to be sent *after* the attack-result
  setTimeout(() => updatePlayerScoreAndMatch(score, match, player), 50);
}

/**
 * P
 * @param update
 */
function writeToHighScores(update: HighScoreEntry) {}

/**
 * Determines if a score should be written to the high-score list
 * @param score
 * @param match
 * @param player
 */
function updateHighScores(
  score: number,
  match: MatchInstance,
  player: MatchPlayer
) {
  const lowestHighScore = highscores[highscores.length - 1];

  if (!lowestHighScore || lowestHighScore.score < score) {
    const update = {
      matchId: match.getUUID(),
      playerId: player.getUUID(),
      human: !player.isAiPlayer(),
      username: player.getUsername(),
      score,
      updatedAt: Date.now()
    };

    const existingEntry = highscores.find((e) => {
      return e.matchId === update.matchId && e.playerId === update.playerId;
    });

    if (existingEntry) {
      // Update the existing entry for this player in this match
      existingEntry.score = update.score;
      existingEntry.updatedAt = update.updatedAt;
    } else if (highscores.length < HIGH_SCORE_ENTRY_COUNT) {
      // Write this entry since the board still isn't full
      highscores.push(update);
    } else {
      // Remove the lowest score and replace with this one
      highscores.pop();
      highscores.push(update);
    }

    // Keep the scores sorted for easier replacement of new high-scores.
    // The highest score is index 0, lowest last in the array
    highscores.sort((a, b) => {
      if (a < b) {
        return 1;
      } else if (a > b) {
        return -1;
      } else {
        return 0;
      }
    });
  }
}

async function updatePlayerScoreAndMatch(
  delta: number,
  match: MatchInstance,
  player: MatchPlayer
) {
  // Increment the in-memory player score
  const playerScore = player.incrementScoreBy(delta);

  // Update the leaderboard
  updateHighScores(playerScore, match, player);

  try {
    // Write the match (and associated player reference to cache)
    await upsertMatchInCache(match);

    const container = getSocketDataContainerByPlayerUUID(player.getUUID());

    if (container) {
      log.debug(
        `sending score update to player ${container.getPlayer()?.getUUID()}`
      );

      container.send({
        type: OutgoingMsgType.ScoreUpdate,
        data: {
          delta
        }
      });
    } else {
      // This can happen if score processing is delayed. The match may have
      // ended by the time the backlog has caught up to notify the player
      log.debug(
        `not sending score update. failed to find socket for player ${player.getUUID()}`
      );
    }
  } catch (e) {
    log.error(
      `error updating match ${match.getUUID()} and/or player (${player.getUUID()}) socket with score`
    );
    log.error(e);
  }
}
