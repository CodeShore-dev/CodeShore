import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class UpdateIconSlugsDto {
  @ApiProperty({
    type: String,
    description: 'The keyword group id',
    example: 'react',
  })
  @IsString()
  id!: string;

  @ApiProperty({
    type: [String],
    description:
      "Ordered icon sources for the keyword group, each as 'source:slug'. Earlier = higher priority.",
    example: ['thesvg:react', 'simple-icons:react'],
  })
  @IsArray()
  @IsString({ each: true })
  icon_slugs!: string[];
}
