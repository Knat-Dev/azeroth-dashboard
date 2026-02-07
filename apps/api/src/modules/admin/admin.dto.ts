import { IsString, IsOptional, IsNumber, IsInt, Min, Max, MinLength, MaxLength } from 'class-validator';

export class CreateAccountDto {
  @IsString()
  @MinLength(3)
  @MaxLength(16)
  username!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(16)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2)
  expansion?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(4)
  gmLevel?: number;
}

export class BanAccountDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  reason!: string;

  @IsNumber()
  @Min(0)
  duration!: number;
}

export class ExecuteCommandDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  command!: string;
}

export class BroadcastDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  message!: string;

  @IsString()
  type!: 'announce' | 'notify' | 'both';
}
