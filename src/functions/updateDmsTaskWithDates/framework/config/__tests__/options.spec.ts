import * as conf from '../config';
import {dmsOptions, getDmsOptions} from '../options';
import {Options} from '../../dms/table-mapping';

describe('Options', () => {
  describe('getDmsOptions', () => {
    it('should return the correct DMS options', () => {
      spyOn(conf, 'config').and.returnValue({ tarsSchema: 'your_tars_schema' } as conf.Config);

      const options = getDmsOptions();

      expect(options).toEqual({
        sourceSchema: 'your_tars_schema',
        ...dmsOptions,
      } as Options);
    });
  });
});
