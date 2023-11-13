import { throwIfNotPresent } from '@dvsa/mes-microservice-common/framework/config/config';

export type Config = {
  maxRetries: number;
  retryDelay: number;
  awsRegion: string;
  highLevelWindowDays: number;
  deploymentWindowMonths: number;
  deploymentWindowDays: number;
  journalWindowDaysPast: number;
  sourceArn: string;
  targetArn: string;
  tarsSchema: string;
  replicationInstanceArn: string;
  dateFilteredTaskName: string;
  environmentPrefix: string;
};

let configuration: Config;
export const bootstrapConfig = async (): Promise<void> => {
  if (!configuration) {
    configuration = {
      maxRetries: 60,
      retryDelay: 15000,
      awsRegion: throwIfNotPresent(process.env.AWS_REGION, 'awsRegion'),
      highLevelWindowDays: Number.parseInt(process.env.HIGH_LEVEL_WINDOW_DAYS || '13', 10),
      deploymentWindowMonths: Number.parseInt(process.env.DEPLOYMENT_WINDOW_MONTHS || '6', 10),
      deploymentWindowDays: Number.parseInt(process.env.DEPLOYMENT_WINDOW_DAYS || '1', 10),
      journalWindowDaysPast: Number.parseInt(process.env.JOURNAL_WINDOW_DAYS_PAST  || '14', 10),
      sourceArn: throwIfNotPresent(process.env.SOURCE_ARN, 'sourceArn'),
      targetArn: throwIfNotPresent(process.env.TARGET_ARN, 'targetArn'),
      replicationInstanceArn: throwIfNotPresent(process.env.REPLICATION_INSTANCE_ARN, 'replicationInstanceArn'),
      dateFilteredTaskName: 'dateFiltered-full-load-and-cdc',
      tarsSchema: throwIfNotPresent(process.env.TARS_SCHEMA, 'tarsSchema'),
      environmentPrefix: throwIfNotPresent(process.env.ENVIRONMENT_PREFIX, 'environmentPrefix'),
    };
  }
};

export const config = (): Config => configuration;
