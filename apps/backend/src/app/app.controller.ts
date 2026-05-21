import { Controller, Get, Sse } from '@nestjs/common';
import { Observable, Subject, map } from 'rxjs';

import { Public } from '../features/auth/auth.decorator';
import { AppService } from './app.service';

@Public()
@Controller()
export class AppController {
  private messageQueue: Subject<string> = new Subject();

  constructor(private readonly appService: AppService) {}

  @Get('/salary-range')
  getSalaryRange() {
    return this.appService.getSalaryRange();
  }

  @Get('/job-count')
  getJobCount() {
    return this.appService.getJobCount();
  }

  @Get('/tech-stats')
  getTechStats() {
    return this.appService.getTechStats();
  }

  @Get('/tech-combo-stats')
  getTechComboStats() {
    return this.appService.getTechComboStats();
  }

  @Get('/salary-stats')
  getSalaryStats() {
    return this.appService.getSalaryStats();
  }

  @Sse('/sse')
  sse(): Observable<MessageEvent> {
    return this.messageQueue.pipe(
      map(data => ({ data }) as MessageEvent),
    );
  }
}
