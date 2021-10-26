import { spawn, ChildProcess } from 'child_process';
import { writeFileSync } from 'fs';

let slsOfflineProcess: ChildProcess;

export const startSlsOffline = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Spawn sls as detached so it leads the process group and kills DynamoDB when it gets SIGINT
    slsOfflineProcess = spawn('npm', ['start'], { detached: true });
    slsOfflineProcess.stdout.pipe(process.stdout);

    console.log(`Serverless: Offline started with PID : ${slsOfflineProcess.pid}`);

    slsOfflineProcess.stdout.on('data', (data) => {
      if (data.includes('Offline listening on')) {
        console.log(data.toString().trim());
        writeFileSync('.sls.pid', String(slsOfflineProcess.pid));
        resolve();
      }
    });

    slsOfflineProcess.stderr.on('data', (errData) => {
      console.log(`Error starting Serverless Offline:\n${errData}`);
      reject(errData);
    });
  });
};

export const stopSlsOffline = (pid: number) => {
  // Usage of negative PID kills the process group
  process.kill(-pid);
  console.log('Serverless Offline stopped');
};
