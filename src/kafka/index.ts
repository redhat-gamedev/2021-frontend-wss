'use strict';

import { CloudEventBase, EventType } from '@app/events/types';
import log from '@app/log';
import { Kafka, KafkaConfig } from 'kafkajs';
import { CLUSTER_NAME as cluster, KAFKA_UPDATES_TOPIC } from '@app/config';

export default function getKafkaSender(config: KafkaConfig) {
  log.trace('creating kafka connection with configuration: %j', config);

  const kafka = new Kafka(config);
  const producer = kafka.producer();

  producer.on(producer.events.CONNECT, () => {
    log.info(`Kafka producer connected to broker(s) ${config.brokers}`);
  });

  producer.on(producer.events.DISCONNECT, (e) => {
    log.error(`Kafka producer disconnected from broker(s) ${config.brokers}`);
    log.error(e);
    process.exit(1);
  });

  producer.on(producer.events.REQUEST_TIMEOUT, (e) => {
    log.error('Kafka producer had a request timeout');
    log.error(e);
  });

  producer.connect();

  return async (type: EventType, data: CloudEventBase) => {
    const ts = Date.now();
    const message = {
      key: `${data.game}:${data.match}`,
      value: JSON.stringify({ type, ts, data, cluster })
    };

    log.debug(
      `sending match update of type ${type} for key ${message.key} to topic ${KAFKA_UPDATES_TOPIC}`
    );
    log.trace(`sending payload to kafka: %j`, message);

    try {
      await producer.send({
        topic: KAFKA_UPDATES_TOPIC,
        messages: [message]
      });
      log.debug(
        `send success for match update of type ${type} for key ${message.key} to topic ${KAFKA_UPDATES_TOPIC}`
      );
    } catch (e) {
      log.error('error sending to kafka');
      log.error(e);
    }
  };
}
