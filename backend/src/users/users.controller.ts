import { Controller, Get, Patch, Param, Query, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UseGuards } from '@nestjs/common';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { z } from 'zod';

const updateProfileSchema = z.object({
  displayName: z.string().max(100).optional(),
  avatarUrl: z.string().url().optional(),
});

type UpdateProfileDto = z.infer<typeof updateProfileSchema>;

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile' })
  async getProfile(@CurrentUser('id') userId: string) {
    return this.users.findById(userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(updateProfileSchema)) dto: UpdateProfileDto,
  ) {
    return this.users.updateProfile(userId, dto);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search users by identifier or display name' })
  @ApiResponse({ status: 200, description: 'Matching users' })
  async search(
    @CurrentUser('id') userId: string,
    @Query('q') query: string,
    @Query('limit') limit?: string,
  ) {
    return this.users.searchUsers(query, userId, limit ? parseInt(limit) : 20);
  }

  @Get('me/devices')
  @ApiOperation({ summary: 'Get current user devices' })
  @ApiResponse({ status: 200, description: 'User devices' })
  async getDevices(@CurrentUser('id') userId: string) {
    return this.users.getDevices(userId);
  }

  @Get('me/contacts')
  @ApiOperation({ summary: 'Get current user contacts' })
  @ApiResponse({ status: 200, description: 'User contacts' })
  async getContacts(@CurrentUser('id') userId: string) {
    return this.users.getContacts(userId);
  }

  @Get(':identifier')
  @ApiOperation({ summary: 'Get user by identifier' })
  @ApiResponse({ status: 200, description: 'User profile' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getByIdentifier(@Param('identifier') identifier: string) {
    return this.users.findByIdentifier(identifier);
  }
}