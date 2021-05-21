'use strict';

import { get } from 'env-var';

const config = {
  CLUSTER_NAME: get('CLUSTER_NAME').required().asString(),
  NODE_ENV: get('NODE_ENV').default('dev').asEnum(['dev', 'prod']),
  LOG_LEVEL: get('LOG_LEVEL').asString(),
  FASTIFY_LOG_ENABLED: get('FASTIFY_LOG_ENABLED').default('false').asBool(),

  // HTTP and WebSocket traffic both use this port
  HTTP_PORT: get('HTTP_PORT').default(8080).asPortNumber(),

  // Maximum number of connections to use when making http requests to
  // a given origin. This does not affect incoming requests to this server
  MAX_HTTP_AGENT_SOCKETS: get('MAX_HTTP_AGENT_SOCKETS')
    .default(250)
    .asIntPositive(),

  // Reject web socket payloads greater than this many bytes (2KB by default)
  WS_MAX_PAYLOAD: get('WS_MAX_PAYLOAD').default(2048).asIntPositive(),

  // Send a heartbeat to clients every so often to keep connections open
  WS_HEARTBEAT_INTERVAL: get('WS_HEARTBEAT_INTERVAL')
    .default('15000')
    .asIntPositive(),

  // If a player action is not received within this time we close their socket
  // Defaults to 30 minutes. We need sufficient time during demos to chat etc.
  WS_ACTIVITY_TIMEOUT_MS: get('WS_ACTIVITY_TIMEOUT_MS')
    .default(30 * 60 * 1000)
    .asIntPositive(),

  // This is the grid size for the game, e.g "5" would produce a 5x5 grid
  GAME_GRID_SIZE: get('GAME_GRID_SIZE').default(5).asIntPositive(),

  // The duration of the bonus round in milliseconds
  GAME_BONUS_DURATION_MS: get('GAME_BONUS_DURATION_MS')
    .default(5000)
    .asIntPositive(),

  // Max number of hits a player can record in a bonus round
  GAME_MAX_BONUS_HITS: get('GAME_MAX_BONUS_HITS').default(100).asIntPositive(),

  AI_AGENT_SERVER_URL: get('AI_AGENT_SERVER_URL')
    .default('http://shipwars-bot-server:8080')
    .asUrlString(),

  SVC_HOSTNAME: get('SVC_HOSTNAME').default('shipwars-game-server').asString(),

  // Optional variables used to enable kafka match update forwarding
  KAKFAJS_CONFIG: {
    clientId: 'shipwars-game-server',
    brokers: get('KAFKACONNECTION_BOOTSTRAPSERVERS').asArray(),
    ssl: get('KAFKACONNECTION_SSL').default('true').asBool(),
    sasl: {
      mechanism: 'plain',
      username: get('KAFKACONNECTION_USER').asString(),
      password: get('KAFKACONNECTION_PASSWORD').asString()
    }
  },

  KAFKA_UPDATES_TOPIC: 'shipwars-updates'
};

export = config;
