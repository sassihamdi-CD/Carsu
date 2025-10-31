/**
 * Purpose: Simple ID validation pipe for route params (non-empty string, trimmed).
 * Note: Switch to stricter validation (UUID/cuid) if IDs change.
 */
import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class IdParamPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    const v = (value ?? '').trim();
    if (!v) throw new BadRequestException('Invalid id parameter');
    return v;
  }
}


