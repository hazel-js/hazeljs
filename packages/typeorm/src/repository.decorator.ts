import { RepositoryOptions } from '@hazeljs/core';
import 'reflect-metadata';

export function Repository(options: RepositoryOptions | string): ClassDecorator {
  return function (target: object): void {
    const opts = typeof options === 'string' ? { model: options } : options;
    Reflect.defineMetadata('hazel:repository', opts, target);
  };
}

export function InjectRepository(): ParameterDecorator {
  return function (
    target: object,
    propertyKey: string | symbol | undefined,
    parameterIndex: number
  ): void {
    // When propertyKey is undefined, we're on a constructor parameter (target is the constructor)
    const paramTypes = Reflect.getMetadata('design:paramtypes', target) || [];
    const repositoryType = paramTypes[parameterIndex];
    const repoOptions = repositoryType && Reflect.getMetadata('hazel:repository', repositoryType);
    const model = repoOptions?.model;

    if (!model) {
      throw new Error(
        `Repository ${repositoryType?.name ?? 'unknown'} is not decorated with @Repository`
      );
    }

    const repositories = Reflect.getMetadata('hazel:repositories', target) || [];
    repositories.push({
      index: parameterIndex,
      model,
    });
    Reflect.defineMetadata('hazel:repositories', repositories, target);
  };
}
