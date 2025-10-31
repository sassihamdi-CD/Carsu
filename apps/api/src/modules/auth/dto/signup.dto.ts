/**
 * DTO for user signup. Validates email and password.
 */
import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SignupDto {
  /** Email address for registering the user. */
  @ApiProperty({ example: 'alice@example.com', maxLength: 254 })
  @IsEmail()
  @MaxLength(254)
  email: string;

  /** User password, min 8 chars, max 64. */
  @ApiProperty({
    minLength: 8,
    maxLength: 64,
    description: 'Must contain at least one letter, one number, and no spaces',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)[\S]+$/, {
    message:
      'password must contain at least one letter, one number, and no spaces',
  })
  password: string;
}
