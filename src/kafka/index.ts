'use strict';

import { EventType, KafkaEventType } from '@app/events/types';
import log from '@app/log';
import { Kafka, KafkaConfig } from 'kafkajs';
import { CLUSTER_NAME as cluster, KAFKA_TOPIC_PREFIX } from '@app/config';

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

  return async (type: EventType, data: KafkaEventType) => {
    let key: string;

    if (data.match) {
      // Key using the game and match UUID
      key = `${data.game}:${data.match}`;
    } else if (data.uuid) {
      // Key using the game and player UUID
      key = `${data.game}:${data.uuid}`;
    } else {
      throw new Error(
        'Unable to construct kafka message key. Match or player UUID is required.'
      );
    }

    const ts = Date.now();
    const topic = `${KAFKA_TOPIC_PREFIX}-${type}`;
    const message = {
      key,
      value: JSON.stringify({ ts, data, cluster })
    };

    log.debug(
      `sending match update of type ${type} for key ${message.key} to topic ${topic}`
    );
    log.debug(`sending payload to kafka: %j`, message);

    try {
      await producer.send({
        topic,
        messages: [message]
      });
      log.debug(
        `send success for match update of type ${type} for key ${message.key} to topic ${topic}`
      );
    } catch (e) {
      log.error('error sending to kafka');
      log.error(e);
    }
  };
}
