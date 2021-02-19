import { NODE_ENV } from '@app/config';
import log from '@app/log';
import GameConfiguration from '@app/models/game.configuration';
import MatchInstance from '@app/models/match.instance';
import Player from '@app/models/player';
import { AWS_BUCKET_NAME } from '@app/config';
import { getStorageInstance } from './s3';

export function writeGameRecord(
  winner: Player,
  loser: Player,
  match: MatchInstance,
  game: GameConfiguration
) {
  if (NODE_ENV === 'dev') {
    log.info(
      `write game record for game ${game.getUUID()} / match ${match.getUUID()}`
    );

    const store = getStorageInstance();

    if (!store) {
      return log.warn(
        `Unable to obtain S3 instance. Not writing ${game.getUUID()} / match ${match.getUUID()}`
      );
    }

    store
      .upload({
        Bucket: AWS_BUCKET_NAME,
        Key: `${new Date().toJSON()}.json`,
        Body: JSON.stringify({
          winner: winner.toJSON(),
          loser: loser.toJSON(),
          match: match.toJSON(),
          game: game.toJSON()
        })
      })
      .promise()
      .then(() => {
        log.info(
          `S3 upload success for game ${game.getUUID()} / match ${match.getUUID()}`
        );
      })
      .catch((e: unknown) => {
        log.error(
          `S3 upload failed for game ${game.getUUID()} / match ${match.getUUID()}`
        );
        log.error(e);
      });
  } else {
    log.debug(
      `In production mode. Skipping S3 write of game ${game.getUUID()} / match ${match.getUUID()}`
    );
  }
}
