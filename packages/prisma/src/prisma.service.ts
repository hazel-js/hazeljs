import { Injectable } from '@hazeljs/core';
import { PrismaClient } from '@prisma/client';
import logger from '@hazeljs/core';

interface PrismaQueryEvent {
  query: string;
  params: string;
  duration: number;
}

interface PrismaErrorEvent {
  message: string;
  code?: string;
}

type PrismaEvent = PrismaQueryEvent | PrismaErrorEvent;

function isQueryEvent(event: PrismaEvent): event is PrismaQueryEvent {
  return 'query' in event && 'params' in event && 'duration' in event;
}

function isErrorEvent(event: PrismaEvent): event is PrismaErrorEvent {
  return 'message' in event;
}

@Injectable()
export class PrismaService extends PrismaClient {
  constructor() {
    super({
      log: [
        {
          emit: 'event',
          level: 'query',
        },
        {
          emit: 'event',
          level: 'error',
        },
      ],
    });

    (this as unknown as { $on: (event: string, callback: (e: PrismaEvent) => void) => void }).$on(
      'query',
      (e: PrismaEvent) => {
        if (isQueryEvent(e)) {
          logger.debug(`Query: ${e.query}`);
          logger.debug(`Params: ${e.params}`);
          logger.debug(`Duration: ${e.duration}ms`);
        }
      }
    );

    (this as unknown as { $on: (event: string, callback: (e: PrismaEvent) => void) => void }).$on(
      'error',
      (e: PrismaEvent) => {
        if (isErrorEvent(e)) {
          logger.error('Prisma Error:', e);
        }
      }
    );
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      logger.info('Connected to database');
    } catch (error) {
      logger.error('Failed to connect to database:', error);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.$disconnect();
      logger.info('Disconnected from database');
    } catch (error) {
      logger.error('Error disconnecting from database:', error);
      throw error;
    }
  }
}
