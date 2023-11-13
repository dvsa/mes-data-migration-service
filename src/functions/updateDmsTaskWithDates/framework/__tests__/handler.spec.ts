import { handler } from '../handler';
import { APIGatewayEvent } from 'aws-lambda';
import { Mock, Times } from 'typemoq';
import * as config from '../config/config';
import * as modifyTasks from '../task-modifier';
import * as resp from '@dvsa/mes-microservice-common/application/api/create-response';
const lambdaTestUtils = require('aws-lambda-test-utils');

describe('updateDmsTaskWithDates handler', () => {
  let dummyApigwEvent: APIGatewayEvent;

  const moqConfigBootstrap = Mock.ofInstance(config.bootstrapConfig);
  const moqModifyTask = Mock.ofInstance(modifyTasks.modifyTask);

  beforeEach(() => {
    moqConfigBootstrap.reset();
    moqModifyTask.reset();

    dummyApigwEvent = lambdaTestUtils.mockEventCreator.createAPIGatewayEvent();

    spyOn(config, 'bootstrapConfig').and.callFake(moqConfigBootstrap.object);
    spyOn(modifyTasks, 'modifyTask').and.callFake(moqModifyTask.object);
    spyOn(resp, 'createResponse');
  });

  it('should bootstrap configuration, modifyTask and return a blank response', async () => {
    await handler(dummyApigwEvent);

    moqConfigBootstrap.verify(x => x(), Times.once());
    moqModifyTask.verify(x => x(), Times.once());
    expect(resp.createResponse).toHaveBeenCalledWith({});
  });

  it('should return an error response when a dependency throws an exception', async () => {
    moqModifyTask.setup(x => x()).throws(new Error('testError'));

    try {
      await handler(dummyApigwEvent);
    } catch (err) {
      expect(resp.createResponse).toHaveBeenCalledWith({}, 500);
    }
  });

});
