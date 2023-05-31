import { Server } from 'http';
import { CellArea, CellPosition, Orientation } from '@app/game/types';
import got, { OptionsOfTextResponseBody } from 'got';
import { Agent } from 'http';
import { getAllPossibleShipLayouts } from '@app/game/layouts';
import {
  AI_AGENT_SERVER_URL,
  MAX_HTTP_AGENT_SOCKETS,
  SVC_HOSTNAME,
  AI_AGENT_WSS_URL,
  HTTP_PORT
} from './config';
import log from './log';

// Generates a URL for AI agents to connect to this specific instance.
// Technically this is no longer necessary, since the application is designed
// to run as a regular single Pod deploymet without StatefulSet
const wsUrl = AI_AGENT_WSS_URL
  ? AI_AGENT_WSS_URL
  : `ws://${SVC_HOSTNAME}:${HTTP_PORT}/shipwars/game`;

log.info(`HTTP keep-alive agent will use ${MAX_HTTP_AGENT_SOCKETS} per origin`);
log.info('Will send the following URL for AI agents to connect to: %s', wsUrl);

const DEFAULT_AGENTS: OptionsOfTextResponseBody['agent'] = {
  // TODO: maybe try the new undici http library?
  // Using keep-alive agents can massively improve performance/throughput
  http: new Agent({
    keepAlive: true,
    maxSockets: MAX_HTTP_AGENT_SOCKETS
  })
};

/**
 * Send a request to the AI agent server to create an AI player instance
 * for the given UUID and Username
 * @param aiOpponent {Player}
 * @param gameId {String}
 */
export function createAiOpponentAgent(
  opts: { uuid: string; username: string },
  gameId: string
) {
  const { uuid, username } = opts;
  http(new URL('/agent', AI_AGENT_SERVER_URL).toString(), {
    method: 'POST',
    json: {
      wsUrl,
      gameId,
      uuid,
      username
    }
  })
    .then(() => {
      log.debug(`successfully created AI agent ${uuid}`);
    })
    .catch((e) => {
      log.error(`error returned when creating AI Agent player: %j`, opts);
      log.error(e);
    });
}

/**
 * Returns a random, but valid ship layout.
 */
export function getRandomShipLayout() {
  const layouts = getAllPossibleShipLayouts();
  const idx = Math.floor(Math.random() * layouts.length);

  return layouts[idx];
}

/**
 * Reusable http function. Uses agents with keepAlive=true to boost performance
 * @param url
 * @param opts
 * @param agent
 */
export async function http(
  url: string,
  opts: OptionsOfTextResponseBody,
  agent = DEFAULT_AGENTS
) {
  return got(url, {
    agent,
    ...opts
  });
}

/**
 * Extracts a friendly address string from a http.Server instance
 * @param server
 */
export function getWsAddressFromServer(server: Server): string {
  const addr = server.address();

  if (typeof addr === 'string') {
    return addr;
  } else {
    return `${addr?.address}:${addr?.port}`;
  }
}

/**
 * Determine if two vectors/positions are equal
 * @param a
 * @param b
 */
export function isSameOrigin(a: CellPosition, b: CellPosition) {
  return a[0] === b[0] && a[1] === b[1];
}

/**
 * This function will return an array containing occupied cell coordinates for
 * an input (typically and attack) given area, origin, and orientation.
 * @param origin
 * @param orientation
 * @param area
 */
export function getCellCoverageForOriginOrientationAndArea(
  origin: CellPosition,
  orientation: Orientation,
  area: CellArea
): CellPosition[] {
  let xMax = parseInt(area.split('x')[0], 10);
  let yMax = parseInt(area.split('x')[1], 10);
  const originX = origin[0];
  const originY = origin[1];

  const positions: CellPosition[] = [];

  if (orientation === Orientation.Vertical) {
    const newX = yMax;
    yMax = xMax;
    xMax = newX;
  }

  for (let x = originX; x <= originX + xMax - 1; x++) {
    for (let y = originY; y <= originY + yMax - 1; y++) {
      positions.push([x, y]);
    }
  }

  return positions;
}
