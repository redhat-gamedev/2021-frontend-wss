import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';
import { getHighScores } from '@app/scoring';

const leaderboardRoutePlugin: FastifyPluginCallback = (
  server,
  options,
  done
) => {
  // This is the WS endpoint, i.e ws://localhost:8181/leaderboard
  server.get('/leaderboard', { websocket: true }, (conn) => {
    let interval = setInterval(() => {
      conn.socket.send(JSON.stringify(getHighScores()));
    }, 2500);

    // Send the initial high-score list
    conn.socket.send(JSON.stringify(getHighScores()));

    conn.socket.on('message', () => {
      conn.socket.send(
        'Sending data to this socket is not permitted. Closing your connection.'
      );
      conn.socket.close();
    });

    conn.on('error', (err) => {
      server.log.error(
        `leaderboard socket error generated. client will be disconnected due to: ${err}`
      );
    });

    conn.on('close', () => {
      server.log.debug(`client leaderboard connection closed`);
      clearInterval(interval);
    });
  });

  done();
};

export default fp(leaderboardRoutePlugin);
