import { DmsApi } from './dms/dms';
import { addBetweenFilter, addOnOrAfterFilter, addOnOrBeforeFilter, Options } from './dms/table-mapping';
import { DateTime, Duration } from 'luxon';
import { config } from './config/config';
import { ILogger } from './logging/Ilogger';
import { ConsoleLogger } from './logging/console-logger';
import { TaskStatus } from '../../../common/application/api/TaskStatus';

const logger = new ConsoleLogger();

export const modifyTask = async (): Promise<void> => {
  const { dateFilteredTaskName,
    environmentPrefix,
    sourceArn,
    targetArn,
    replicationInstanceArn,
    awsRegion,
  } = config();

  const dms = new DmsApi(awsRegion, logger);

  logger.debug(`source endpoint arn is ${sourceArn}`);
  logger.debug(`dest endpoint arn is ${targetArn}`);
  logger.debug(`repl instance arn is ${replicationInstanceArn}`);

  const dateTaskName = `${environmentPrefix}-${dateFilteredTaskName}`;

  const taskStatus = await stopTaskIfExistsAndRunning(dateTaskName, dms, logger);

  // prevent function from being called if already modifying
  if (taskStatus !== TaskStatus.MODIFYING) {
    await dms.createOrModifyTask(dateTaskName,
                                 replicationInstanceArn,
                                 sourceArn,
                                 targetArn,
                                 addDateFilters);
  }

  await startTaskWhenReady(dateTaskName, dms, logger);
};

async function startTaskWhenReady(taskName: string, dms: DmsApi, logger: ILogger) {
  await dms.waitForDesiredTaskStatus(taskName, [TaskStatus.READY, TaskStatus.STOPPED]);
  const startStatus = await dms.startTask(taskName, 'reload-target');
  logger.debug(`status of startTask is ${startStatus}`);

}
async function stopTaskIfExistsAndRunning(taskName: string, dms: DmsApi, logger: ILogger): Promise<string> {
  let taskStatus = '';
  try {
    taskStatus = await dms.getTaskStatus(taskName);
    logger.debug(`Current status of ${taskName} is ${taskStatus}`);
  } catch (error) {
    logger.debug(`taskname ${taskName} doesn't exist`);
    taskStatus = TaskStatus.NON_EXISTENT;
  }

  if (taskStatus !== TaskStatus.STOPPED && taskStatus !== TaskStatus.NON_EXISTENT) {
    try {
      const stopStatus = await dms.stopTask(taskName);
      logger.debug(`status of stopTask is ${stopStatus}`);
      await dms.waitTillTaskStopped(taskName);
    } catch (error) {
      logger.error(error);
    }
  }

  return taskStatus;
}
/**
 * Adds source filters to the "datefiltered" dataset.
 * @param options - the options to add to
 */
function addDateFilters(options: Options) {
  const {
    highLevelWindowDays,
    deploymentWindowMonths,
    deploymentWindowDays,
    journalWindowDaysPast,
  } = config();

  let startDate: DateTime;

  if (process.env.TIME_TRAVEL_DATE != null) {
    // Assumes fixed format for TIME_TRAVEL_DATE, e.g. 2019-03-13
    startDate = DateTime.fromFormat(process.env.TIME_TRAVEL_DATE, 'yyyy-MM-dd');
  } else {
    startDate = DateTime.local();
  }

  const highLevelSlotTimeWindow = Duration.fromObject({ days: highLevelWindowDays });
  const deploymentTimeWindow = Duration.fromObject({ months: deploymentWindowMonths })
    .minus({ days: deploymentWindowDays });
  const endDate = startDate.plus(highLevelSlotTimeWindow);
  const journalStartWindow = Duration.fromObject({ days: journalWindowDaysPast });
  const journalStartDate = startDate.minus(journalStartWindow);

  addBetweenFilter(options, 'PROGRAMME', 'PROGRAMME_DATE', journalStartDate, endDate, logger);
  addBetweenFilter(options, 'PROGRAMME_SLOT', 'PROGRAMME_DATE', journalStartDate, endDate, logger);

  const personalCommitmentEndDate = startDate.plus(highLevelSlotTimeWindow);
  const personalCommitmentEndDateTime = personalCommitmentEndDate.plus({ hours: 23, minutes: 59, seconds: 59 });

  addOnOrBeforeFilter(options, 'PERSONAL_COMMITMENT', 'START_DATE_TIME',
                      personalCommitmentEndDateTime, logger);
  addOnOrAfterFilter(options, 'PERSONAL_COMMITMENT', 'END_DATE_TIME', journalStartDate, logger);

  const deploymentEndDate = startDate.plus(deploymentTimeWindow);
  addOnOrBeforeFilter(options, 'DEPLOYMENT', 'START_DATE', deploymentEndDate, logger);
  addOnOrAfterFilter(options, 'DEPLOYMENT', 'END_DATE', journalStartDate, logger);

  const ethnicOriginStartDate = startDate.minus(Duration.fromObject({ years: 3 }));
  addBetweenFilter(options, 'ETHNIC_ORIGIN', 'LOADED_DATE', ethnicOriginStartDate, startDate, logger);
}
