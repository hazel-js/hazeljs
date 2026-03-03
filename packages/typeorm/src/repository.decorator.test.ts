import 'reflect-metadata';
import { Repository, InjectRepository } from './repository.decorator';

describe('Repository decorator', () => {
  it('should store options with object', () => {
    @Repository({ model: 'User' })
    class UserRepo {}

    const meta = Reflect.getMetadata('hazel:repository', UserRepo);
    expect(meta).toEqual({ model: 'User' });
  });

  it('should store options with string shorthand', () => {
    @Repository('Post')
    class PostRepo {}

    const meta = Reflect.getMetadata('hazel:repository', PostRepo);
    expect(meta).toEqual({ model: 'Post' });
  });
});

describe('InjectRepository', () => {
  it('should push repository metadata onto target', () => {
    @Repository({ model: 'User' })
    class UserRepo {}

    class Consumer {
      constructor(@InjectRepository() _repo: UserRepo) {}
    }

    const repos = Reflect.getMetadata('hazel:repositories', Consumer);
    expect(repos).toHaveLength(1);
    expect(repos[0]).toEqual({ index: 0, model: 'User' });
  });

  it('should throw when target repository is not decorated', () => {
    class NotARepo {}

    expect(() => {
      // Class exists only to trigger InjectRepository(); the decorator throws during definition
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      class Consumer {
        constructor(@InjectRepository() _repo: NotARepo) {}
      }
    }).toThrow(/not decorated with @Repository/);
  });
});
