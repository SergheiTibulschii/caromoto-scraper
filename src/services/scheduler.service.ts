import cron from 'node-cron';
import { schedulerConfig } from '../core/config/scheduler.config';
import LoggerService from '../common/shared/services/logger.service';

export type JobHandler = () => Promise<void>;

export interface JobConfig {
  name: string;
  cronExpression: string;
  handler: JobHandler;
  runOnStart?: boolean;
  enabled?: boolean;
}

export class SchedulerService {
  private static instance: SchedulerService;
  private logger: LoggerService;
  private jobs: Map<string, cron.ScheduledTask> = new Map();
  private jobHandlers: Map<string, JobHandler> = new Map();
  private runningJobs: Set<string> = new Set();
  private jobStats: Map<
    string,
    {
      lastRun: Date | null;
      lastDuration: number | null;
      totalRuns: number;
      successfulRuns: number;
      failedRuns: number;
    }
  > = new Map();

  private constructor() {
    this.logger = LoggerService.getInstance();
    this.setupProcessHandlers();
  }

  public static getInstance(): SchedulerService {
    if (!SchedulerService.instance) {
      SchedulerService.instance = new SchedulerService();
    }
    return SchedulerService.instance;
  }

  private setupProcessHandlers(): void {
    process.on('SIGTERM', () => this.stopAll());
    process.on('SIGINT', () => this.stopAll());
  }

  public async scheduleJob(config: JobConfig): Promise<void> {
    const {
      name,
      cronExpression,
      handler,
      runOnStart = false,
      enabled = true,
    } = config;

    if (!enabled) {
      this.logger.info(`Job "${name}" is disabled, skipping schedule`);
      return;
    }

    if (this.jobs.has(name)) {
      this.logger.warn(`Job "${name}" already scheduled, skipping`);
      return;
    }

    if (!cron.validate(cronExpression)) {
      throw new Error(
        `Invalid cron expression for job "${name}": ${cronExpression}`,
      );
    }

    this.jobStats.set(name, {
      lastRun: null,
      lastDuration: null,
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
    });

    const task = cron.schedule(
      cronExpression,
      async () => {
        this.logger.info(
          `[CRON TRIGGER] Job "${name}" triggered by cron schedule`,
        );
        await this.executeJob(name, handler);
      },
      {
        scheduled: true,
        timezone: schedulerConfig.timezone,
      },
    );

    this.jobs.set(name, task);
    this.jobHandlers.set(name, handler);

    this.logger.info(
      `✓ Scheduled job "${name}" with cron expression: ${cronExpression} (timezone: ${schedulerConfig.timezone})`,
    );
    this.logger.info(`  Task scheduled: ${task !== undefined ? 'YES' : 'NO'}`);

    if (runOnStart) {
      this.logger.info(`→ Running job "${name}" immediately (runOnStart=true)`);
      setImmediate(() => this.executeJob(name, handler));
    }
  }

  private async executeJob(name: string, handler: JobHandler): Promise<void> {
    if (this.runningJobs.has(name)) {
      this.logger.warn(
        `⚠️  Job "${name}" is already running, skipping this execution`,
      );
      return;
    }

    this.runningJobs.add(name);
    const startTime = Date.now();
    const stats = this.jobStats.get(name)!;

    this.logger.info(
      `▶️  Executing job: ${name} (Run #${stats.totalRuns + 1})`,
    );

    try {
      await handler();

      const duration = Date.now() - startTime;
      stats.lastRun = new Date();
      stats.lastDuration = duration;
      stats.totalRuns++;
      stats.successfulRuns++;

      this.logger.info(
        `✓ Job "${name}" completed successfully in ${(duration / 1000).toFixed(2)}s`,
      );
      this.logger.info(
        `  Stats: ${stats.successfulRuns}/${stats.totalRuns} successful runs`,
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      stats.lastRun = new Date();
      stats.lastDuration = duration;
      stats.totalRuns++;
      stats.failedRuns++;

      this.logger.error(
        `✗ Job "${name}" failed after ${(duration / 1000).toFixed(2)}s`,
        error as Error,
      );
      this.logger.error(
        `  Stats: ${stats.failedRuns}/${stats.totalRuns} failed runs`,
      );
    } finally {
      this.runningJobs.delete(name);
      this.logger.info(
        `◀️  Job "${name}" execution complete, ready for next run`,
      );
    }
  }

  public async runJobNow(name: string): Promise<void> {
    const handler = this.jobHandlers.get(name);
    if (!handler) {
      throw new Error(`Job "${name}" not found`);
    }

    this.logger.info(`Manually triggering job: ${name}`);
    await this.executeJob(name, handler);
  }

  public stopJob(name: string): void {
    const task = this.jobs.get(name);
    if (!task) {
      this.logger.warn(`Job "${name}" not found`);
      return;
    }

    task.stop();
    this.jobs.delete(name);
    this.jobHandlers.delete(name);
    this.logger.info(`Stopped job: ${name}`);
  }

  public stopAll(): void {
    this.logger.info('Stopping all scheduled jobs...');

    for (const [name, task] of this.jobs.entries()) {
      task.stop();
      this.logger.info(`Stopped job: ${name}`);
    }

    this.jobs.clear();
    this.jobHandlers.clear();
    this.logger.info('All jobs stopped');
  }

  public getJobStats(name: string) {
    return this.jobStats.get(name);
  }

  public getAllJobsStats() {
    const stats: Record<string, any> = {};

    for (const [name, stat] of this.jobStats.entries()) {
      const task = this.jobs.get(name);
      stats[name] = {
        ...stat,
        isRunning: this.runningJobs.has(name),
        isScheduled: task !== undefined,
      };
    }

    return stats;
  }

  public listJobs(): string[] {
    return Array.from(this.jobs.keys());
  }

  public isJobRunning(name: string): boolean {
    return this.runningJobs.has(name);
  }
}

export default SchedulerService;
