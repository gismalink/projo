import { BadRequestException, Body, Controller, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
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

  @Post('ai/ask')
  @UseInterceptors(FileInterceptor('file'))
  askAi(
    @Req() req: AuthenticatedRequest,
    @Body() body?: { message?: string; sheetName?: string },
    @UploadedFile() file?: { buffer?: Buffer },
  ) {
    const message = body?.message?.trim();
    if (!message) {
      throw new BadRequestException(ErrorCode.IMPORT_XLSX_INVALID);
    }
    return this.importsService.askCompanyImportAssistant(req.user.userId, message, body?.sheetName, file?.buffer);
  }

  @Post('ai/normalize')
  @UseInterceptors(FileInterceptor('file'))
  normalizeAi(
    @Req() req: AuthenticatedRequest,
    @Body() body?: { message?: string; sheetName?: string },
    @UploadedFile() file?: { buffer?: Buffer },
  ) {
    const message = body?.message?.trim();
    if (!message) {
      throw new BadRequestException(ErrorCode.IMPORT_XLSX_INVALID);
    }
    return this.importsService.normalizeCompanyImportWithAi(req.user.userId, message, body?.sheetName, file?.buffer);
  }

  @Post('sheets')
  @UseInterceptors(FileInterceptor('file'))
  listSheets(@UploadedFile() file?: { buffer?: Buffer }) {
    if (!file?.buffer || file.buffer.length === 0) {
      throw new BadRequestException(ErrorCode.IMPORT_XLSX_FILE_REQUIRED);
    }
    return this.importsService.listCompanyXlsxSheets(file.buffer);
  }

  @Post('preview')
  @UseInterceptors(FileInterceptor('file'))
  preview(
    @Req() req: AuthenticatedRequest,
    @Body() body?: { sheetName?: string },
    @UploadedFile() file?: { buffer?: Buffer },
  ) {
    if (!file?.buffer || file.buffer.length === 0) {
      throw new BadRequestException(ErrorCode.IMPORT_XLSX_FILE_REQUIRED);
    }
    return this.importsService.previewCompanyXlsx(req.user.userId, file.buffer, body?.sheetName);
  }

  @Post('apply')
  @UseInterceptors(FileInterceptor('file'))
  apply(
    @Req() req: AuthenticatedRequest,
    @Body() body?: { sheetName?: string },
    @UploadedFile() file?: { buffer?: Buffer },
  ) {
    if (!file?.buffer || file.buffer.length === 0) {
      throw new BadRequestException(ErrorCode.IMPORT_XLSX_FILE_REQUIRED);
    }
    return this.importsService.applyCompanyXlsx(req.user.userId, file.buffer, body?.sheetName);
  }
}
