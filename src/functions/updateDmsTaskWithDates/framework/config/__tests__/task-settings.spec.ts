import {getTaskSettings} from '../task-settings';

describe('TaskSettings', () => {
  describe('getTaskSettings', () => {
    it('should return default task settings', () => {
      expect(getTaskSettings()).toEqual({
        TargetMetadata: {
          TargetSchema: '',
          SupportLobs: true,
          FullLobMode: false,
          LobChunkSize: 64,
          LimitedSizeLobMode: true,
          LobMaxSize: 32,
        },
        FullLoadSettings: {
          FullLoadEnabled: true,
          ApplyChangesEnabled: true,
          TargetTablePrepMode: 'TRUNCATE_BEFORE_LOAD',
          CreatePkAfterFullLoad: false,
          StopTaskCachedChangesApplied: false,
          StopTaskCachedChangesNotApplied: false,
          ResumeEnabled: true,
          ResumeMinTableSize: 1000000,
          ResumeOnlyClusteredPKTables: true,
          MaxFullLoadSubTasks: 2,
          TransactionConsistencyTimeout: 600,
          CommitRate: 10000,
        },
        Logging: {EnableLogging: true},
      });
    });
  });
});
