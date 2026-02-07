import { IsString, MaxLength, MinLength } from 'class-validator';

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
