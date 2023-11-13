import {bootstrapConfig, Config, config} from '../config';

describe('Config', () => {
  beforeEach(() => {
    process.env.AWS_REGION = 'region';
    process.env.SOURCE_ARN = 'source-arn';
    process.env.TARGET_ARN = 'target-arn';
    process.env.REPLICATION_INSTANCE_ARN = 'replic-inst-arn';
    process.env.TARS_SCHEMA = 'tars-schema';
    process.env.ENVIRONMENT_PREFIX = 'env-prefix';
  });

  describe('bootstrapConfig', () => {
    it('should initialise the config and bind to config()', async () => {
      expect(config()).toBe(undefined);
      await bootstrapConfig();
      expect(config()).toEqual({
        maxRetries: 60,
        retryDelay: 15000,
        awsRegion: 'region',
        highLevelWindowDays: 13,
        deploymentWindowMonths: 6,
        deploymentWindowDays: 1,
        journalWindowDaysPast: 14,
        sourceArn: 'source-arn',
        targetArn: 'target-arn',
        replicationInstanceArn: 'replic-inst-arn',
        dateFilteredTaskName: 'dateFiltered-full-load-and-cdc',
        tarsSchema: 'tars-schema',
        environmentPrefix: 'env-prefix',
      } as Config);
    });
  });
});
