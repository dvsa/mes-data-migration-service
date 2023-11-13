import loggers from '@dvsa/mes-microservice-common/application/utils/logger';
import { ILogger } from  './Ilogger';
import { Error } from './error';

export class ConsoleLogger implements ILogger {

  error = (error: Error) => {
    loggers.error(JSON.stringify(error));
  };
  warn = (message: string) => {
    loggers.warn(`${message}`);
  };
  info = (message: string) => {
    loggers.info(`${message}`);
  };
  debug = (message: string) => {
    loggers.debug(`${message}`);
  };

}
