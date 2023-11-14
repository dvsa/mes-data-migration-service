import {addBetweenFilter, AndFilter, generateTableMapping, Options, Rule, TableMapping} from '../table-mapping';
import {DateTime} from 'luxon';
import {cloneDeep} from 'lodash';

describe('generateTableMapping', () => {
  const rule1 = {
    'rule-type': 'transformation',
    'rule-id': '1',
    'rule-name': '1',
    'rule-action': 'rename',
    'rule-target': 'schema',
    'object-locator': {
      'schema-name': 'source_schema',
    },
    value: 'dest_schema',
  } as Rule;
  const rule2Base = {
    'rule-type': 'selection',
    'rule-id': '2',
    'rule-name': '2',
    'object-locator': {
      'schema-name': 'source_schema',
      'table-name': 'table1',
    },
    'rule-action': 'include',
  } as Rule;
  const rule3 = {
    'rule-type': 'transformation',
    'rule-id': '3',
    'rule-name': '3',
    'object-locator': {
      'schema-name': 'source_schema',
      'table-name': 'table1',
      'column-name': 'column2',
    },
    'rule-action': 'remove-column',
    'rule-target': 'column',
  } as Rule;
  const filterBase = {
    'filter-type': 'source',
    'column-name': 'column1',
  };
  const filterConditionBase = {
    'filter-operator': 'eq',
    value: 'value1',
  };

  const baseOpts = {
    sourceSchema: 'source_schema',
    destSchema: 'dest_schema',
    tables: [
      {
        sourceName: 'table1',
        andFilters: [
          {
            column: 'column1',
            orConditions: [
              { operator: 'eq', value: 'value1' },
              // { start: 'start', end: 'end' },
            ],
          },
        ],
        removeColumns: ['column2'],
      },
    ],
  } as Options;

  it('should generate a table mapping with schema renaming', () => {
    const tableMapping = generateTableMapping(baseOpts);

    // Assert that the generated table mapping contains the expected rules.
    expect(tableMapping.rules).toEqual([
      rule1,
      {
        ...rule2Base,
        filters: [
          {
            ...filterBase,
            'filter-conditions': [
              filterConditionBase,
            ],
          },
        ],
      },
      rule3,
    ] as Rule[]);
  });

  it('should generate a table with other options', () => {
    const opts = cloneDeep(baseOpts);
    opts.tables[0].andFilters[0].orConditions.push({operator: 'between', start: 'start', end: 'end'});
    const tableMapping = generateTableMapping(opts);
    expect(tableMapping.rules).toEqual([
      rule1,
      {
        ...rule2Base,
        filters: [
          {
            ...filterBase,
            'filter-conditions': [
              filterConditionBase,
              {
                'filter-operator': 'between',
                'start-value': 'start',
                'end-value': 'end',
              },
            ],
          },
        ],
      },
      rule3,
    ] as Rule[]);
  });
});

describe('addBetweenFilter', () => {
  it('should add a between filter to the specified table', () => {
    const options = {
      sourceSchema: 'source_schema',
      destSchema: 'dest_schema',
      tables: [
        {
          sourceName: 'table1',
          andFilters: [],
        },
      ],
    } as Options;

    addBetweenFilter(
      options,
      'table1',
      'column1',
      DateTime.fromISO('2023-01-01T12:00:00Z'),
      DateTime.fromISO('2023-01-31T12:00:00Z'),
    );

    const table = options.tables.find((table) => table.sourceName === 'table1');
    expect(table.andFilters).toEqual([
      {
        column: 'column1',
        orConditions: [
          {
            operator: 'between',
            start: '2023-01-01',
            end: '2023-01-31',
          },
        ],
      },
    ] as AndFilter[]);
  });
});
