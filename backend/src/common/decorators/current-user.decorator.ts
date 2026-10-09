import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '../../common/database/schema';

export const CurrentUser = createParamDecorator(
  (data: keyof User | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as User;
    return data ? user?.[data] : user;
  },
);

export const CurrentDevice = createParamDecorator(
  (data: keyof User | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const device = request.device;
    return data ? device?.[data] : device;
  },
);