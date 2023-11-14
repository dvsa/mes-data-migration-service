import {
  DatabaseMigrationServiceClient,
  DescribeReplicationTasksCommandOutput,
  StopReplicationTaskCommandOutput,
} from '@aws-sdk/client-database-migration-service';
import {DmsApi} from '../dms';
import * as logger from '@dvsa/mes-microservice-common/application/utils/logger';
import {It, Mock, Times} from 'typemoq';
import {mockClient} from 'aws-sdk-client-mock';
import {
  StartReplicationTaskCommandOutput,
} from '@aws-sdk/client-database-migration-service/dist-types/commands/StartReplicationTaskCommand';
import * as confOptions from '../../config/config';
import * as options from '../../config/options';
import * as tableMapping from '../table-mapping';

describe('DmsApi', () => {
  const mockDMSClient = mockClient(DatabaseMigrationServiceClient);
  const moqDMSClient = Mock.ofType<DatabaseMigrationServiceClient>();
  const moqErrorLogger = Mock.ofInstance(logger.error);
  let dmsApi: DmsApi;
  const randomError = {
    code: 'Some other error',
    name: 'Some diff name',
    message: 'Some message',
  };

  beforeEach(() => {
    mockDMSClient.reset();
    moqDMSClient.reset();
    dmsApi = new DmsApi('region');
    dmsApi['dms'] = moqDMSClient.object;

    spyOn(logger, 'error');
  });

  describe('getTaskStatus', () => {
    it('should return task status', async () => {
      const mockResponse = {
        ReplicationTasks: [{Status: 'running'}],
      } as DescribeReplicationTasksCommandOutput;

      moqDMSClient
        .setup(x => x.send(It.isAny()))
        .returns(async () => mockResponse);

      const status = await dmsApi.getTaskStatus('taskName');
      expect(status).toEqual('running');
      moqDMSClient.verifyAll();
    });

    it('should throw async ResourceNotFoundFault error', async () => {
      const e = {
        code: 'ResourceNotFoundFault',
        name: 'Resource not found',
        message: 'This could not be located',
      };

      moqDMSClient
        .setup(x => x.send(It.isAny()))
        .throws(e);

      moqErrorLogger.setup(e => e(It.isAnyString(), It.isAny())).verifiable(Times.once());

      await expectAsync(dmsApi.getTaskStatus('taskName')).toBeRejectedWith(e);

      expect(logger.error).toHaveBeenCalledWith('ResourceNotFoundFault', {
        err: { name: 'ResourceNotFoundFault', message: 'Replication Instance taskName' },
      });
    });

    it('should throw a different error', async () => {
      moqDMSClient
        .setup(x => x.send(It.isAny()))
        .throws(randomError);

      moqErrorLogger.setup(e => e(It.isAnyString(), It.isAny())).verifiable(Times.once());

      await expectAsync(dmsApi.getTaskStatus('taskName')).toBeRejectedWith(randomError);

      expect(logger.error).toHaveBeenCalledWith('Unknown getTaskStatus', {
        err: { name: 'Some other error', message: 'Error calling describeReplicationInstances: Some message' },
      });
    });
  });

  describe('stopTask', () => {
    it('should return task status', async () => {
      spyOn<any>(dmsApi, 'getTaskArn').and.returnValue(Promise.resolve('taskArn'));

      const mockResponse = {
        ReplicationTask: {Status: 'Some status'},
      } as StopReplicationTaskCommandOutput;

      moqDMSClient
        .setup(x => x.send(It.isAny()))
        .returns(async () => mockResponse);

      const status = await dmsApi.stopTask('taskName');
      expect(status).toEqual('Some status');
      moqDMSClient.verifyAll();
    });

    it('should throw an error', async () => {
      spyOn<any>(dmsApi, 'getTaskArn').and.returnValue(Promise.reject(randomError));

      moqErrorLogger.setup(e => e(It.isAnyString(), It.isAny())).verifiable(Times.once());

      await expectAsync(dmsApi.stopTask('taskName')).toBeRejectedWith(randomError);

      expect(logger.error).toHaveBeenCalledWith('Unknown stopTask error', {
        err: { name: 'Some other error', message: 'Error calling stopTask: Some message' },
      });
    });
  });

  describe('startTask', () => {
    it('should return task status', async () => {
      spyOn<any>(dmsApi, 'getTaskArn').and.returnValue(Promise.resolve('taskArn'));

      const mockResponse = {
        ReplicationTask: {Status: 'Some new status'},
      } as StartReplicationTaskCommandOutput;

      moqDMSClient
        .setup(x => x.send(It.isAny()))
        .returns(async () => mockResponse);

      const status = await dmsApi.startTask('taskName', 'start-replication');
      expect(status).toEqual('Some new status');
      moqDMSClient.verifyAll();
    });

    it('should throw an error', async () => {
      spyOn<any>(dmsApi, 'getTaskArn').and.returnValue(Promise.reject(randomError));

      moqErrorLogger.setup(e => e(It.isAnyString(), It.isAny())).verifiable(Times.once());

      await expectAsync(dmsApi.startTask('taskName', 'start-replication')).toBeRejectedWith(randomError);

      expect(logger.error).toHaveBeenCalledWith('Unknown startTask error', {
        err: { name: 'Some other error', message: 'Error calling startTask: Some message' },
      });
    });
  });

  describe('createOrModifyTask', () => {
    beforeEach(() => {
      spyOn<any>(dmsApi, 'createOrModifyFullLoadTask');
      spyOn(confOptions, 'config').and.returnValue({ tarsSchema: 'your_tars_schema' } as confOptions.Config);
      spyOn(options, 'getDmsOptions').and.returnValue({ sourceSchema: 'source-schema' } as tableMapping.Options);
      spyOn(tableMapping, 'generateTableMapping').and.returnValue({ rules: [] } as tableMapping.TableMapping);
    });
    it('should call createOrModifyFullLoadTask with no callback', async () => {
      await dmsApi.createOrModifyTask(
        'taskName',
        'start-replication',
        'sourceTaskArn',
        'destTaskArn'
      );
      expect(dmsApi['createOrModifyFullLoadTask']).toHaveBeenCalledWith(
        'taskName',
        'start-replication',
        'sourceTaskArn',
        'destTaskArn',
        '{"rules":[]}'
      );
    });
    it('should also work with callback provided', async () => {
      await dmsApi.createOrModifyTask(
        'taskName',
        'start-replication',
        'sourceTaskArn',
        'destTaskArn',
        () => ({ sourceSchema: 'source-schema' } as tableMapping.Options)
      );
      expect(dmsApi['createOrModifyFullLoadTask']).toHaveBeenCalledWith(
        'taskName',
        'start-replication',
        'sourceTaskArn',
        'destTaskArn',
        '{"rules":[]}'
      );
    });
  });

  describe('createOrModifyFullLoadTask', () => {
    it('should return the task status', async () => {
      // ARRANGE
      spyOn<any>(dmsApi, 'getTaskArn').and.returnValue(Promise.resolve('taskArn'));
      spyOn<any>(dmsApi, 'updateTask').and.returnValue(Promise.resolve('task updated'));
      // ACT
      const task = await dmsApi['createOrModifyFullLoadTask'](
        'taskName',
        'start-replication',
        'sourceTaskArn',
        'destTaskArn',
        'tableMapping'
      );
      // ASSERT
      expect(dmsApi['getTaskArn']).toHaveBeenCalledWith('taskName');
      expect(dmsApi['updateTask']).toHaveBeenCalledWith('taskArn', 'tableMapping');
      expect(task).toEqual('task updated');
    });
    it('should throw and return value from createFullLoadTask', async () => {
      // ARRANGE
      spyOn<any>(dmsApi, 'getTaskArn').and.returnValue(Promise.reject({
        ...randomError,
        code: 'ResourceNotFoundFault',
      }));
      spyOn<any>(dmsApi, 'createFullLoadTask').and.returnValue(Promise.resolve('load task'));
      // ACT
      const task = await dmsApi['createOrModifyFullLoadTask'](
        'taskName',
        'start-replication',
        'sourceTaskArn',
        'destTaskArn',
        'tableMapping'
      );
      // ASSERT
      expect(dmsApi['createFullLoadTask']).toHaveBeenCalledWith(
        'taskName',
        'start-replication',
        'sourceTaskArn',
        'destTaskArn',
        'tableMapping'
      );
      expect(task).toEqual('load task');
    });
    it('should throw error', async () => {
      // ARRANGE
      spyOn<any>(dmsApi, 'getTaskArn').and.returnValue(Promise.reject({
        ...randomError,
      }));
      moqErrorLogger.setup(e => e(It.isAnyString(), It.isAny())).verifiable(Times.once());

      // ACT
      await expectAsync(dmsApi['createOrModifyFullLoadTask'](
        'taskName',
        'start-replication',
        'sourceTaskArn',
        'destTaskArn',
        'tableMapping'
      )).toBeRejectedWith(randomError);

      // ASSERT
      expect(logger.error).toHaveBeenCalledWith('Unknown createOrModifyFullLoadTask error', {
        err: {
          name: 'Some other error',
          message: 'Error calling createOrModifyFullLoadTask:' +
              ' {"code":"Some other error","name":"Some diff name","message":"Some message"}',
        },
      });
    });
  });

  describe('waitForDesiredTaskStatus', () => {
    beforeEach(() => {
      spyOn<any>(dmsApi, 'delay').and.returnValue(Promise.resolve());
      spyOn<any>(dmsApi, 'getTaskStatus').and.returnValue(Promise.resolve('task'));
    });
    it('should call through to getTaskStatus with a delay', async () => {
      spyOn(confOptions, 'config').and.returnValue({ retryDelay: 123, maxRetries: 1 } as confOptions.Config);

      await dmsApi.waitForDesiredTaskStatus('taskName', ['desired']);
      expect(dmsApi['delay']).toHaveBeenCalledWith(123);
      expect(dmsApi['getTaskStatus']).toHaveBeenCalledWith('taskName');
    });
  });

  describe('waitTillTaskStopped', () => {
    beforeEach(() => {
      spyOn<any>(dmsApi, 'delay').and.returnValue(Promise.resolve());
      spyOn<any>(dmsApi, 'getTaskStatus').and.returnValue(Promise.resolve('task'));
    });
    it('should call through to getTaskStatus with a delay', async () => {
      spyOn(confOptions, 'config').and.returnValue({ retryDelay: 123, maxRetries: 1 } as confOptions.Config);

      await dmsApi.waitTillTaskStopped('taskName');
      expect(dmsApi['delay']).toHaveBeenCalledWith(123);
      expect(dmsApi['getTaskStatus']).toHaveBeenCalledWith('taskName');
    });
  });
});
