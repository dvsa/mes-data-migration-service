import { DmsApi } from './dms/dms';
import { addBetweenFilter, addOnOrAfterFilter, addOnOrBeforeFilter, Options } from './dms/table-mapping';
import { DateTime, Duration } from 'luxon';
import { config } from './config/config';
import { error, info } from '@dvsa/mes-microservice-common/application/utils/logger';


export const modifyTask = async (): Promise<string> => {
  const {
    dateFilteredTaskName,
    environmentPrefix,
    sourceArn,
    targetArn,
    replicationInstanceArn,
    awsRegion,
  } = config();

  info(`source endpoint arn is ${sourceArn}`);
  info(`dest endpoint arn is ${targetArn}`);
  info(`repl instance arn is ${replicationInstanceArn}`);

  const dateTaskName = `${environmentPrefix}-${dateFilteredTaskName}`;

  const dms = new DmsApi(awsRegion);

  await stopTaskIfExistsAndRunning(dateTaskName, dms);

  await dms.createOrModifyTask(
    dateTaskName,
    replicationInstanceArn,
    sourceArn,
    targetArn,
    addDateFilters,
  );

  await startTaskWhenReady(dateTaskName, dms);

  return dateTaskName;
};

export async function startTaskWhenReady(taskName: string, dms: DmsApi) {
  await dms.waitForDesiredTaskStatus(taskName, ['ready', 'stopped']);
  const startStatus = await dms.startTask(taskName, 'reload-target');
  info(`status of startTask is ${startStatus}`);
}

export async function stopTaskIfExistsAndRunning(taskName: string, dms: DmsApi) {
  let taskStatus = '';
  try {
    taskStatus = await dms.getTaskStatus(taskName);
  } catch (error) {
    info(`taskname ${taskName} doesn't exist`);
    taskStatus = 'nonexistant';
  }

  if (taskStatus !== 'stopped' && taskStatus !== 'nonexistant') {
    try {
      const stopStatus = await dms.stopTask(taskName);
      info(`status of stopTask is ${stopStatus}`);
      await dms.waitTillTaskStopped(taskName);
    } catch (err) {
      error(err);
    }
  }
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

  addBetweenFilter(options, 'PROGRAMME', 'PROGRAMME_DATE', journalStartDate, endDate);
  addBetweenFilter(options, 'PROGRAMME_SLOT', 'PROGRAMME_DATE', journalStartDate, endDate);

  const personalCommitmentEndDate = startDate.plus(highLevelSlotTimeWindow);
  const personalCommitmentEndDateTime = personalCommitmentEndDate.plus({ hours: 23, minutes: 59, seconds: 59 });

  addOnOrBeforeFilter(options, 'PERSONAL_COMMITMENT', 'START_DATE_TIME',
                      personalCommitmentEndDateTime);
  addOnOrAfterFilter(options, 'PERSONAL_COMMITMENT', 'END_DATE_TIME', journalStartDate);

  const deploymentEndDate = startDate.plus(deploymentTimeWindow);
  addOnOrBeforeFilter(options, 'DEPLOYMENT', 'START_DATE', deploymentEndDate);
  addOnOrAfterFilter(options, 'DEPLOYMENT', 'END_DATE', journalStartDate);

  const ethnicOriginStartDate = startDate.minus(Duration.fromObject({ years: 3 }));
  addBetweenFilter(options, 'ETHNIC_ORIGIN', 'LOADED_DATE', ethnicOriginStartDate, startDate);
}
