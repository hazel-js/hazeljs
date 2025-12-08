import { RepositoryOptions } from '@hazeljs/core';
import 'reflect-metadata';

export function Repository(options: RepositoryOptions): ClassDecorator {
  return function (target: object): void {
    Reflect.defineMetadata('hazel:repository', options, target);
  };
}

export function InjectRepository(): ParameterDecorator {
  return function (
    target: object,
    propertyKey: string | symbol | undefined,
    parameterIndex: number
  ): void {
    if (!propertyKey) {
      throw new Error('InjectRepository decorator must be used on a method parameter');
    }

    const repositoryType = Reflect.getMetadata('design:paramtypes', target, propertyKey)[
      parameterIndex
    ];
    const model = Reflect.getMetadata('hazel:repository:model', repositoryType);

    if (!model) {
      throw new Error(`Repository ${repositoryType.name} is not decorated with @Repository`);
    }

    const repositories = Reflect.getMetadata('hazel:repositories', target) || [];
    repositories.push({
      index: parameterIndex,
      model,
    });
    Reflect.defineMetadata('hazel:repositories', repositories, target);
  };
}
