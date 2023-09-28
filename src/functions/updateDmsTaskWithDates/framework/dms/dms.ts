/**
 * Wraps the AWS DMS API.
 */
import * as DMS from 'aws-sdk/clients/dms'; // just the DMS apis, not the whole SDK
import * as escapeJSON from 'escape-json-node';
import { generateTableMapping, Options } from './table-mapping';
import { config } from '../config/config';
import { getDmsOptions } from '../config/options';
import { getTaskSettings } from '../config/task-settings';
import { ILogger } from '../logging/Ilogger';
type UpdateTableMappingCallback = (options: Options) => void;

export class DmsApi {
  private dms: DMS;

  constructor(
    readonly region: string,
    private logger: ILogger,
  ) {
    this.dms = new DMS({ apiVersion: '2016-01-01', region: `${region}` });
  }

  async getTaskStatus(taskName: string): Promise<string> {
    const taskArn = await this.getTaskArn(taskName);

    try {
      const params: DMS.Types.DescribeReplicationTasksMessage = {
        Filters: [
          { Name: 'replication-task-arn', Values: [taskArn] },
        ],
      };

      const data = await this.dms.describeReplicationTasks(params).promise();
      return data.ReplicationTasks[0].Status;

    } catch (err) {
      if (err.code === 'ResourceNotFoundFault') {
        this.logger.error({ err: { name: err.code, message: `Replication Instance ${taskName}` } });
      } else {
        this.logger.error(
          {
            err: {
              name: err.code,
              message: `Error calling describeReplicationInstances: ${err.message}`,
            },
          });
      }
      throw err;
    }
  }

  async stopTask(taskName: string): Promise<string> {
    const taskArn = await this.getTaskArn(taskName);
    try {
      const  params = {
        ReplicationTaskArn: taskArn,
      };

      this.logger.debug(`Trying to stop: ${taskName}`);
      const data = await this.dms.stopReplicationTask(params).promise();
      return data.ReplicationTask.Status;
    } catch (err) {
      this.logger.error(
        {
          err: {
            name: err.code,
            message: `Error calling stopTask: ${err.message}`,
          },
        });
      throw err;
    }
  }

  async startTask(taskName: string, taskType: 'start-replication' | 'resume-processing' | 'reload-target') {
    const taskArn = await this.getTaskArn(taskName);
    try {
      const params = {
        ReplicationTaskArn: taskArn,
        StartReplicationTaskType: taskType,
      };

      const data = await this.dms.startReplicationTask(params).promise();
      return data.ReplicationTask.Status;
    } catch (err) {
      this.logger.error(
        {
          err: {
            name: err.code,
            message: `Error calling startTask: ${err.message}`,
          },
        });
      throw err;
    }
  }

  async createOrModifyTask(taskName: string, replicationInstanceArn: string,
                           sourceEndpointArn: string, destEndpointArn: string,
                           callback?: UpdateTableMappingCallback): Promise<void> {
    const tableMappingInput: Options = getDmsOptions();
    if (callback) {
      callback(tableMappingInput);
    }
    const tableMapping = JSON.stringify(generateTableMapping(tableMappingInput));

    const status = await this.createOrModifyFullLoadTask(taskName, replicationInstanceArn,
                                                         sourceEndpointArn, destEndpointArn, tableMapping);
    this.logger.debug(`${taskName} task status is ${status}`);
  }

  private async createOrModifyFullLoadTask(
    taskName: string,
    replicationInstanceArn: string,
    sourceEndpointArn: string,
    destEndpointArn: string,
    tableMappings: string,
  ): Promise<string> {
    try {
      const taskArn = await this.getTaskArn(taskName);
      this.logger.debug(`Task ${taskName} already exists, so updating it...`);
      return await this.updateTask(taskArn, tableMappings);

    } catch (e) {
      if (e.code === 'ResourceNotFoundFault') {
        this.logger.debug(`Task ${taskName} doesn\'t already exist, so creating it...`);
        return await this.createFullLoadTask(
          taskName,
          replicationInstanceArn,
          sourceEndpointArn,
          destEndpointArn,
          tableMappings,
        );
      }
      this.logger.error(
        {
          err: {
            name: e.code,
            message: `Error calling createOrModifyFullLoadTask: ${JSON.stringify(e)}`,
          },
        });

      throw e;
    }
  }

  private async createFullLoadTask(taskName: string, replicationInstanceArn: string,
                                   sourceEndpointArn: string, destEndpointArn: string,
                                   tableMappings: string): Promise<string> {

    try {
      const params = {
        MigrationType: 'full-load-and-cdc',
        ReplicationInstanceArn: replicationInstanceArn,
        ReplicationTaskIdentifier: taskName,
        ReplicationTaskSettings: JSON.stringify(getTaskSettings()),
        SourceEndpointArn: sourceEndpointArn,
        TableMappings: escapeJSON(tableMappings),
        TargetEndpointArn: destEndpointArn,
      };

      const data = await this.dms.createReplicationTask(params).promise();
      return data.ReplicationTask.Status;
    } catch (err) {
      this.logger.error(
        {
          err: {
            name: err.code,
            message: `Error calling createReplicationTask: ${err.message}`,
          },
        });
      throw err;
    }
  }

  private async updateTask(taskArn: string, tableMappings: string): Promise<string> {

    try {
      const params = {
        ReplicationTaskArn: taskArn,
        ReplicationTaskSettings: JSON.stringify(getTaskSettings()),
        TableMappings: escapeJSON(tableMappings),
      };

      this.logger.debug('Modifying Replication Task');
      const data = await this.dms.modifyReplicationTask(params).promise();
      this.logger.debug('Modifying Complete');
      return data.ReplicationTask.Status;
    } catch (err) {
      this.logger.error(
        {
          err: {
            name: err.code,
            message: `Error calling modifyReplicationTask: ${err.message}`,
          },
        });
      throw err;
    }
  }

  async waitForDesiredTaskStatus(taskName: string, desiredStatus: string[]) {
    const { maxRetries, retryDelay } = config();
    let status = '';
    let retryCount = 0;

    do {
      await this.delay(retryDelay);
      status = await this.getTaskStatus(taskName);
      retryCount = retryCount + 1;
    } while (desiredStatus.findIndex(desired => desired === status) < 0 && retryCount < maxRetries);
  }

  async waitTillTaskStopped(taskName: string): Promise<any> {
    const { maxRetries, retryDelay } = config();
    let status = '';
    let retryCount = 0;

    do {
      await this.delay(retryDelay);
      this.logger.debug(`Waiting for ${taskName} to stop. Attempt: ${retryCount}`);
      status = await this.getTaskStatus(taskName);
      this.logger.debug(`${taskName} task status is ${status}`);
      retryCount = retryCount + 1;
    } while (status !== 'stopped' && retryCount < maxRetries);
  }

  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async getTaskArn(taskName: string): Promise<string> {
    try {
      const params = {
        Filters: [{
          Name: 'replication-task-id',
          Values: [taskName],
        }],
      };

      const data = await this.dms.describeReplicationTasks(params).promise();
      return data.ReplicationTasks[0].ReplicationTaskArn;
    } catch (err) {
      if (err.code !== 'ResourceNotFoundFault') {
        this.logger.error(
          {
            err: {
              name: err.code,
              message: `Error calling describeReplicationTasks: ${err.message}`,
            },
          });
      }
      throw err;
    }
  }
}
