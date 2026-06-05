import {
  Controller,
  Get,
  Sse,
} from '@nestjs/common';
import { Observable, Subject, map } from 'rxjs';

import { Public } from '../features/auth/auth.decorator';
import { AppService } from './app.service';

@Public()
@Controller()
export class AppController {
  private messageQueue: Subject<string> = new Subject();

  constructor(private readonly appService: AppService) {}

  @Get('/job-count')
  getJobCount() {
    return this.appService.getJobCount();
  }

  @Get('/salary/type/median/ratio')
  getMvSalaryTypeMedianRatio() {
    return this.appService.getMvSalaryTypeMedianRatio();
  }

  @Get('/salary/weighted/ratio')
  getMvSalaryWeightedRatio() {
    return this.appService.getMvSalaryWeightedRatio();
  }

  @Sse('/sse')
  sse(): Observable<MessageEvent> {
    return this.messageQueue.pipe(
      map(data => ({ data }) as MessageEvent),
    );
  }
}
