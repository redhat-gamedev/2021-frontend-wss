import { FastifyInstance } from 'fastify';
import Joi from 'joi';
import WebSocket from 'ws';
import log from '../log';
import connectionHandler from './handler.connection';
import shipPositionHandler from './handler.ship-positions';
import {
  OutgoingMsgType,
  IncomingMsgType,
  MessageHandler,
  MessageHandlerResponse
} from './payloads';
import { heartbeat, send } from './utils';

type ParsedWsData = {
  type: IncomingMsgType;
  data: unknown;
};

const WsDataSchema = Joi.object({
  type: Joi.string().required(),
  data: Joi.object()
});

/**
 * Configures a heartbeat for the WSS attached to the given fastify instance.
 * @param app {FastifyInstance}
 */
export function configureHeartbeat(app: FastifyInstance) {
  heartbeat(app);
}

const MessageHandlers: { [key in IncomingMsgType]: MessageHandler<unknown> } = {
  [IncomingMsgType.Connection]: connectionHandler,
  [IncomingMsgType.ShipPositions]: shipPositionHandler
};

async function _processSocketMessage(ws: WebSocket, data: ParsedWsData) {
  const handler = MessageHandlers[data.type];
  if (handler) {
    let resp!: MessageHandlerResponse<unknown>;

    try {
      resp = await handler(ws, data.data);
    } catch (e) {
      log.error('error processing an incoming message: %j', data);
      log.error(e);
      resp = {
        type: OutgoingMsgType.ServerError,
        data: {
          info: ''
        }
      };
    } finally {
      send(ws, resp);
    }
  } else {
    log.warn('received unknown message type: %j', data);
    send(ws, {
      type: OutgoingMsgType.BadMessageType,
      data: { info: `"${data.type}" is an unrecognised message type` }
    });
  }
}

/**
 * Processes an incoming WS payload
 * @param ws {WebSocket}
 * @param data {WebSocket.Data}
 */
export default async function processSocketMessage(
  ws: WebSocket,
  data: WebSocket.Data
) {
  let parsed: ParsedWsData;

  try {
    parsed = JSON.parse(data.toString());
  } catch (error) {
    log.error('Received Malformed socket message JSON. Data was:\n%j', data);
    return;
  }

  const valid = WsDataSchema.validate(parsed);

  if (valid.error) {
    log.warn('client sent an invalid message payload: %j', parsed);
    log.warn('validation failed with the error(s): %j', valid.error);
    send(ws, {
      type: OutgoingMsgType.BadPayload,
      data: {
        info: 'Your payload was a bit iffy. K thx bye.'
      }
    });
  } else {
    _processSocketMessage(ws, valid.value as ParsedWsData);
  }
}
