import { Module, type DynamicModule } from '@hazeljs/core';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { TypeOrmService } from './typeorm.service';

@Module({
  providers: [TypeOrmService],
  exports: [TypeOrmService],
})
export class TypeOrmModule {
  /**
   * Register TypeORM with custom DataSource options.
   * Use when you want to pass connection/config in code instead of DATABASE_URL.
   */
  static forRoot(options: DataSourceOptions): DynamicModule {
    return {
      module: TypeOrmModule,
      providers: [
        {
          provide: TypeOrmService,
          useFactory: (): TypeOrmService => {
            const dataSource = new DataSource(options);
            return new TypeOrmService({ dataSource });
          },
        },
      ],
      exports: [TypeOrmService],
    };
  }
}
