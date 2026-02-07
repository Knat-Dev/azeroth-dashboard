import { IsString, IsOptional, IsEmail, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MinLength(1)
  @MaxLength(17)
  username!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(16)
  password!: string;
}

export class RegisterDto {
  @IsString()
  @MinLength(3)
  @MaxLength(17)
  username!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(16)
  password!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;
}
