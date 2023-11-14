import { APIGatewayProxyEvent } from 'aws-lambda';
import { createResponse } from '@dvsa/mes-microservice-common/application/api/create-response';
import { bootstrapLogging, error } from '@dvsa/mes-microservice-common/application/utils/logger';
import { bootstrapConfig } from './config/config';
import { modifyTask } from './task-modifier';

export async function handler(event: APIGatewayProxyEvent) {
  try {
    bootstrapLogging('update-dms-task-with-date', event);

    await bootstrapConfig();

    await modifyTask();

    return createResponse({});
  } catch (err) {
    error((err instanceof Error) ? err.message : `Unknown error: ${err}`);

    return createResponse({}, 500);
  }
}
