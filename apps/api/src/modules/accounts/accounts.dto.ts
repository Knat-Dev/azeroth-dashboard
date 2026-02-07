import { IsString, IsEmail, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(16)
  newPassword!: string;
}

export class ChangeEmailDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;
}
