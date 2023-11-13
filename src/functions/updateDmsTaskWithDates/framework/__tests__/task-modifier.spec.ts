import * as taskMod from '../task-modifier';
import * as conf from '../config/config';
import {Config} from '../config/config';
import * as dms from '../dms/dms';
import {startTaskWhenReady, stopTaskIfExistsAndRunning} from '../task-modifier';
import {It, Mock} from 'typemoq';
describe('TaskModifier', () => {
  beforeEach(() => {
    const mockDmsApi = Mock.ofType(dms.DmsApi);

    // Setup mock behavior for someMethod
    mockDmsApi
      .setup(x => x.createOrModifyTask(
        It.isAnyString(),
        It.isAnyString(),
        It.isAnyString(),
        It.isAnyString(),
      ))
      .returns(() => Promise.resolve());

    mockDmsApi.reset();
  });
  describe('modifyTask', () => {
    it('should modify and return task', async () => {
      spyOn(conf, 'config').and.returnValue({
        dateFilteredTaskName: 'dateFilteredTaskName',
        environmentPrefix: 'environmentPrefix',
        sourceArn: 'sourceArn',
        targetArn: 'targetArn',
        replicationInstanceArn: 'replicationInstanceArn',
        awsRegion: 'awsRegion',
      } as Config);

      spyOn<any>(dms.DmsApi.prototype, 'getTaskArn').and.returnValue(Promise.resolve('taskArn'));
      spyOn<any>(dms.DmsApi.prototype, 'getTaskStatus').and.returnValue(Promise.resolve('task status'));
      spyOn<any>(dms.DmsApi.prototype, 'stopTask').and.returnValue(Promise.resolve('stopTask'));
      spyOn<any>(dms.DmsApi.prototype, 'updateTask').and.returnValue(Promise.resolve('updateTask'));
      spyOn<any>(dms.DmsApi.prototype, 'startTask').and.returnValue(Promise.resolve('startTask'));

      spyOn(taskMod, 'stopTaskIfExistsAndRunning').and.returnValue(Promise.resolve());
      spyOn(taskMod, 'startTaskWhenReady').and.returnValue(Promise.resolve());

      try {
        const task = await taskMod.modifyTask();
        expect(task).toEqual('environmentPrefix-dateFilteredTaskName');
      } catch (err) {}
    });
  });
});
