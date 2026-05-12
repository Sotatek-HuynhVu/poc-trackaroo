import { Injectable } from '@nestjs/common';
import { ValidationError } from '../../common/errors/errors';
import { ScoreInputDto } from './dto/score.dto';

type Band = 'easy' | 'moderate' | 'difficult' | 'extreme';

@Injectable()
export class ScoreService {
  score(dto: ScoreInputDto) {
    const { mode, gradientPercent, awtgsGrade } = dto;

    if (mode === 'foot') {
      if (awtgsGrade == null) throw new ValidationError('awtgsGrade required for foot mode');
      return { mode, grade: awtgsGrade, band: `grade_${awtgsGrade}` };
    }

    if (gradientPercent == null) throw new ValidationError('gradientPercent required for vehicle/trail mode');
    const band = mode === 'vehicle' ? this.scoreVehicle(gradientPercent) : this.scoreTrail(gradientPercent);
    return { mode, gradientPercent, band };
  }

  private scoreVehicle(gradient: number): Band {
    if (gradient <= 10) return 'easy';
    if (gradient <= 20) return 'moderate';
    if (gradient <= 30) return 'difficult';
    return 'extreme';
  }

  private scoreTrail(gradient: number): Band {
    if (gradient <= 5) return 'easy';
    if (gradient <= 15) return 'moderate';
    if (gradient <= 25) return 'difficult';
    return 'extreme';
  }
}
