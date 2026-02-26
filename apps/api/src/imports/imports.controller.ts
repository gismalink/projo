import { BadRequestException, Controller, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ErrorCode } from '../common/error-codes';
import { ImportsService } from './imports.service';

type AuthenticatedRequest = {
  user: {
    userId: string;
  };
};

@Controller('imports/xlsx/company')
@UseGuards(JwtAuthGuard)
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Post('preview')
  @UseInterceptors(FileInterceptor('file'))
  preview(@Req() req: AuthenticatedRequest, @UploadedFile() file?: { buffer?: Buffer }) {
    if (!file?.buffer || file.buffer.length === 0) {
      throw new BadRequestException(ErrorCode.IMPORT_XLSX_FILE_REQUIRED);
    }
    return this.importsService.previewCompanyXlsx(req.user.userId, file.buffer);
  }

  @Post('apply')
  @UseInterceptors(FileInterceptor('file'))
  apply(@Req() req: AuthenticatedRequest, @UploadedFile() file?: { buffer?: Buffer }) {
    if (!file?.buffer || file.buffer.length === 0) {
      throw new BadRequestException(ErrorCode.IMPORT_XLSX_FILE_REQUIRED);
    }
    return this.importsService.applyCompanyXlsx(req.user.userId, file.buffer);
  }
}
