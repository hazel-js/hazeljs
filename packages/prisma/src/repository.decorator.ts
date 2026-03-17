import { RepositoryOptions } from '@hazeljs/core';
import 'reflect-metadata';

export function Repository(options: RepositoryOptions | string): ClassDecorator {
  return function (target: object): void {
    const opts = typeof options === 'string' ? { model: options } : options;
    Reflect.defineMetadata('hazel:repository', opts, target);
    Reflect.defineMetadata('hazel:repository:model', opts.model, target);
    // Implicitly mark the class as injectable — @Injectable() is not needed separately.
    // Write metadata directly to avoid the ClassDecorator `Function` type constraint.
    Reflect.defineMetadata('hazel:injectable', opts.scope ? { scope: opts.scope } : {}, target);
    if (opts.scope) {
      Reflect.defineMetadata('hazel:scope', opts.scope, target);
    }
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
