'use strict';

import { EventType, KafkaEventType } from '@app/events/types';
import log from '@app/log';
import { Kafka as KafkaClient, KafkaConfig } from 'kafkajs';
import { CLUSTER_NAME as cluster, KAFKA_TOPIC_PREFIX } from '@app/config';
import { Kafka, CloudEvent, KafkaMessage } from 'cloudevents';

export default function getKafkaSender(config: KafkaConfig) {
  log.trace('creating kafka connection with configuration: %j', config);

  const kafka = new KafkaClient(config);
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

    const topic = `${KAFKA_TOPIC_PREFIX}-${type}`;
    const event = new CloudEvent({
      type,
      partitionkey: key,
      source: 'shipwars-game-server',
      data: { data, cluster }
    });

    const km = Kafka.structured(event) as KafkaMessage;
    log.debug(
      `sending match update of type ${type} for key ${key} to topic ${topic}`
    );
    log.debug(`sending payload to kafka: %j`, km);

    try {
      await producer.send({
        topic,
        messages: [
          {
            key: km.key,
            // TODO: remove "as any" when https://github.com/cloudevents/sdk-javascript/issues/487
            // is resolved
            headers: km.headers as any,
            value: km.value as any
          }
        ]
      });
      log.debug(
        `send success for match update of type ${type} for key ${km.key} to topic ${topic}`
      );
    } catch (e: unknown) {
      log.error('error sending to kafka');
      log.error({ e });
    }
  };
}
