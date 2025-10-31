/**
 * DTO for user login. Used to validate login POST body.
 */
import { IsEmail, IsString, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  /** Email for login. */
  @ApiProperty({ example: 'alice@example.com', maxLength: 254 })
  @IsEmail()
  @MaxLength(254)
  email: string;

  /** Password for login. */
  @ApiProperty({ description: 'No spaces allowed' })
  @IsString()
  @Matches(/^[\S]+$/, { message: 'password must not contain spaces' })
  password: string;
}
