import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ConversationsService } from './conversations.service';
import { CurrentUser, CurrentDevice } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UseGuards } from '@nestjs/common';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { z } from 'zod';

const createConvSchema = z.object({
  type: z.enum(['DIRECT', 'GROUP']),
  title: z.string().max(100).optional(),
  memberDeviceIds: z.array(z.string().uuid()).min(1),
});

const addMemberSchema = z.object({
  deviceId: z.string().uuid(),
});

const updateTimerSchema = z.object({
  timerMs: z.number().int().min(0),
});

type CreateConvDto = z.infer<typeof createConvSchema>;
type AddMemberDto = z.infer<typeof addMemberSchema>;
type UpdateTimerDto = z.infer<typeof updateTimerSchema>;

@ApiTags('conversations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(private conversations: ConversationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new conversation' })
  @ApiResponse({ status: 201, description: 'Conversation created' })
  async create(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(createConvSchema)) dto: CreateConvDto,
  ) {
    return this.conversations.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List current user conversations' })
  @ApiResponse({ status: 200, description: 'User conversations' })
  async list(@CurrentUser('id') userId: string, @CurrentDevice('id') deviceId: string) {
    return this.conversations.getUserConversations(userId, deviceId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get conversation by ID' })
  @ApiResponse({ status: 200, description: 'Conversation details' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getById(@Param('id') id: string) {
    return this.conversations.getById(id);
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Add member to conversation' })
  @ApiResponse({ status: 200, description: 'Member added' })
  async addMember(
    @CurrentUser('id') userId: string,
    @Param('id') conversationId: string,
    @Body(new ZodValidationPipe(addMemberSchema)) dto: AddMemberDto,
  ) {
    return this.conversations.addMember(userId, conversationId, dto.deviceId);
  }

  @Delete(':id/members/:deviceId')
  @ApiOperation({ summary: 'Remove member from conversation' })
  @ApiResponse({ status: 200, description: 'Member removed' })
  async removeMember(
    @CurrentUser('id') userId: string,
    @Param('id') conversationId: string,
    @Param('deviceId') deviceId: string,
  ) {
    return this.conversations.removeMember(userId, conversationId, deviceId);
  }

  @Patch(':id/disappearing-timer')
  @ApiOperation({ summary: 'Update disappearing message timer' })
  @ApiResponse({ status: 200, description: 'Timer updated' })
  async updateTimer(
    @Param('id') conversationId: string,
    @Body(new ZodValidationPipe(updateTimerSchema)) dto: UpdateTimerDto,
  ) {
    return this.conversations.updateDisappearingTimer(conversationId, dto.timerMs);
  }
}