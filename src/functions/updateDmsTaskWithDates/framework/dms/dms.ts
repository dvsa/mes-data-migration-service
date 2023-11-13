/**
 * Wraps the AWS DMS API.
 */
// just the DMS apis, not the whole SDK

import {
  CreateReplicationTaskCommand,
  CreateReplicationTaskCommandInput,
  DatabaseMigrationServiceClient,
  DescribeReplicationTasksCommand,
  ModifyReplicationTaskCommand,
  StartReplicationTaskCommand,
  StopReplicationTaskCommand,
} from '@aws-sdk/client-database-migration-service';
import * as escapeJSON from 'escape-json-node';
import { generateTableMapping, Options } from './table-mapping';
import { config } from '../config/config';
import { getDmsOptions } from '../config/options';
import { getTaskSettings } from '../config/task-settings';
import { debug, error } from '@dvsa/mes-microservice-common/application/utils/logger';
type UpdateTableMappingCallback = (options: Options) => void;

export class DmsApi {
  private dms: DatabaseMigrationServiceClient;

  constructor(
    readonly region: string,
  ) {
    this.dms = new DatabaseMigrationServiceClient({ apiVersion: '2016-01-01', region: `${region}` });
  }

  async getTaskStatus(taskName: string): Promise<string> {
    try {
      const taskArn = await this.getTaskArn(taskName);

      const params = {
        Filters: [
          { Name: 'replication-task-arn', Values: [taskArn] },
        ],
      };

      const data = await this.dms.send(
        new DescribeReplicationTasksCommand(params)
      );

      return data.ReplicationTasks[0].Status;

    } catch (err) {
      if (err.code === 'ResourceNotFoundFault') {
        error('ResourceNotFoundFault', { err: { name: err.code, message: `Replication Instance ${taskName}` } });
      } else {
        error(
          'Unknown getTaskStatus',
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
    try {
      const taskArn = await this.getTaskArn(taskName);

      const  params = {
        ReplicationTaskArn: taskArn,
      };

      const data = await this.dms.send(
        new StopReplicationTaskCommand(params)
      );

      return data.ReplicationTask.Status;
    } catch (err) {
      error(
        'Unknown stopTask error',
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
    try {
      const taskArn = await this.getTaskArn(taskName);

      const params = {
        ReplicationTaskArn: taskArn,
        StartReplicationTaskType: taskType,
      };

      const data = await this.dms.send(
        new StartReplicationTaskCommand(params)
      );

      return data.ReplicationTask.Status;
    } catch (err) {
      error(
        'Unknown startTask error',
        {
          err: {
            name: err.code,
            message: `Error calling startTask: ${err.message}`,
          },
        });
      throw err;
    }
  }

  async createOrModifyTask(
    taskName: string,
    replicationInstanceArn: string,
    sourceEndpointArn: string,
    destEndpointArn: string,
    callback?: UpdateTableMappingCallback,
  ): Promise<void> {
    const tableMappingInput: Options = getDmsOptions();
    if (callback) {
      callback(tableMappingInput);
    }
    const tableMapping = JSON.stringify(generateTableMapping(tableMappingInput));

    const status = await this.createOrModifyFullLoadTask(
      taskName,
      replicationInstanceArn,
      sourceEndpointArn,
      destEndpointArn,
      tableMapping
    );
    debug(`${taskName} task status is ${status}`);
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
      debug(`Task ${taskName} already exists, so updating it...`);
      return await this.updateTask(taskArn, tableMappings);

    } catch (e) {
      if (e.code === 'ResourceNotFoundFault') {
        debug(`Task ${taskName} doesn\'t already exist, so creating it...`);
        return await this.createFullLoadTask(
          taskName,
          replicationInstanceArn,
          sourceEndpointArn,
          destEndpointArn,
          tableMappings,
        );
      }
      error(
        'Unknown createOrModifyFullLoadTask error',
        {
          err: {
            name: e.code,
            message: `Error calling createOrModifyFullLoadTask: ${JSON.stringify(e)}`,
          },
        });

      throw e;
    }
  }

  private async createFullLoadTask(
    taskName: string,
    replicationInstanceArn: string,
    sourceEndpointArn: string,
    destEndpointArn: string,
    tableMappings: string,
  ): Promise<string> {
    try {
      const params = {
        MigrationType: 'full-load-and-cdc',
        ReplicationInstanceArn: replicationInstanceArn,
        ReplicationTaskIdentifier: taskName,
        ReplicationTaskSettings: JSON.stringify(getTaskSettings()),
        SourceEndpointArn: sourceEndpointArn,
        TableMappings: escapeJSON(tableMappings),
        TargetEndpointArn: destEndpointArn,
      } as CreateReplicationTaskCommandInput;

      const data = await this.dms.send(
        new CreateReplicationTaskCommand(params)
      );

      return data.ReplicationTask.Status;
    } catch (err) {
      error(
        'Error calling createReplicationTask',
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

      const data = await this.dms.send(
        new ModifyReplicationTaskCommand(params)
      );

      return data.ReplicationTask.Status;
    } catch (err) {
      error(
        'Unknown updateTask error',
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
      status = await this.getTaskStatus(taskName);
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

      const data = await this.dms.send(
        new DescribeReplicationTasksCommand(params)
      );

      return data.ReplicationTasks[0].ReplicationTaskArn;
    } catch (err) {
      if (err.code !== 'ResourceNotFoundFault') {
        error(
          'Unknown getTaskArn error',
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
