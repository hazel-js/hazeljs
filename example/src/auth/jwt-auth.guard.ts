import { Injectable, CanActivate, ExecutionContext } from '@hazeljs/core';
import { JwtService } from '@hazeljs/auth';
import { UserService } from '../user/user.service';
import { User } from '../user/user.model';

interface RequestWithUser {
  headers: { authorization?: string };
  user?: User;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UserService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest() as RequestWithUser;
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      return false;
    }

    try {
      const payload = this.jwtService.verify(token);
      const user = await this.userService.findById(Number(payload.sub));

      if (!user) {
        return false;
      }

      request.user = user;
      return true;
    } catch {
      return false;
    }
  }

  private extractTokenFromHeader(request: RequestWithUser): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
