# Kafka Example

Produce, consume, and stream process Kafka messages with HazelJS.

## Prerequisites

- Docker and Docker Compose

## Run

```bash
# 1. Start Kafka (from hazeljs/example directory)
docker compose -f src/kafka/docker-compose.yml up -d

# 2. Wait for Kafka to be ready (~30 seconds), then run the full example
npm run kafka

# Or streams only (no HTTP server):
npm run kafka:streams
```

To stop Kafka:
```bash
docker compose -f src/kafka/docker-compose.yml down
```

## HTTP Endpoints

- `POST /kafka/orders/` - Create order (produces to `orders` topic)
- `POST /kafka/orders/events` - Publish order event to `order-events` topic

## Kafka Streams

Three stream pipelines run automatically when you start the example:

### Pipeline 1: Enrichment
```
orders -> add processedAt, enriched, orderCount -> enriched-orders
```
Adds computed fields to incoming orders.

### Pipeline 2: Filter
```
enriched-orders -> filter (total >= 100) -> high-value-orders
```
Forwards only high-value orders.

### Pipeline 3: Transformation
```
order-events -> normalize schema -> normalized-order-events
```
Converts events to a standard schema with `eventId`, `schemaVersion`, etc.

## Data Flow

```
POST /kafka/orders/        -> orders (topic)
                                 |
                                 v
                            [Enrichment]
                                 |
                                 v
                            enriched-orders
                                 |
                                 v
                            [Filter: total>=100]
                                 |
                                 v
                            high-value-orders

POST /kafka/orders/events  -> order-events (topic)
                                 |
                                 v
                            [Transform]
                                 |
                                 v
                            normalized-order-events
```

## Consumers

- **OrderConsumer** - Handles `orders`, `order-events` (raw input)
- **StreamOutputConsumer** - Handles `enriched-orders`, `high-value-orders`, `normalized-order-events` (stream output)

## Testing the Full Flow

1. Start Kafka: `docker compose -f src/kafka/docker-compose.yml up -d`
2. Run example: `npm run kafka`
3. Create an order (triggers enrichment + filter pipelines):
   ```bash
   curl -X POST http://localhost:3010/kafka/orders/ \
     -H "Content-Type: application/json" \
     -d '{"id":"1","userId":"u1","items":["a","b"],"total":150}'
   ```
4. Create a high-value order (will appear in high-value-orders):
   ```bash
   curl -X POST http://localhost:3010/kafka/orders/ \
     -H "Content-Type: application/json" \
     -d '{"id":"2","userId":"u2","items":["x"],"total":50}'
   ```
   (Only order 1 appears in high-value-orders; order 2 is filtered out.)
5. Publish event (triggers transform pipeline):
   ```bash
   curl -X POST http://localhost:3010/kafka/orders/events \
     -H "Content-Type: application/json" \
     -d '{"orderId":"1","eventType":"shipped","payload":{"carrier":"UPS"}}'
   ```
