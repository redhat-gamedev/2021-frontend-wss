declare module 'kube-service-bindings' {
  export enum ServiceType {
    Kafka = 'KAFKFA'
  }

  export enum ClientType {
    kafkajs = 'kafkajs',
    rdkafka = 'node-rdkafka'
  }

  export function getBinding(service: ServiceType, client: ClientType): unknown;
}
