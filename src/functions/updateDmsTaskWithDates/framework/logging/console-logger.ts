import { ILogger } from  './Ilogger';
import { Error } from './error';

export class ConsoleLogger implements ILogger {

  error = (error: Error) => {
    console.log(JSON.stringify(error));
  };
  warn = (message: string) => {
    console.log(`warn: ${message}`);
  };
  info = (message: string) => {
    console.log(`info: ${message}`);
  };
  debug = (message: string) => {
    console.log(`debug: ${message}`);
  };

}
