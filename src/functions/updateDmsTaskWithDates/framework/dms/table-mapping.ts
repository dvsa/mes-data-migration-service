/**
 * Handles generating DMS table mappings from a much simpler logical input.
 */
import { DateTime } from 'luxon';
import { ILogger } from '../logging/Ilogger';

export interface OrCondition {
  operator: string;
  value?: string;
  start?: string;
  end?: string;
}

export interface AndFilter {
  column: string;
  orConditions: OrCondition[];
}

export interface Table {
  sourceName: string;
  andFilters?: AndFilter[];
  removeColumns?: string[];
}

export interface Options {
  sourceSchema: string;
  destSchema: string;
  tables: Table[];
}

export interface TableMapping {
  rules: any[];
}
export function generateTableMapping(options: Options): TableMapping {
  const config:TableMapping = { rules: [] };

  // first add a transformation rule from source to dest schema name...
  config.rules.push({
    'rule-type': 'transformation',
    'rule-id': '1',
    'rule-name': '1',
    'rule-action': 'rename',
    'rule-target': 'schema',
    'object-locator': {
      'schema-name': options.sourceSchema,
    },
    value: options.destSchema,
  });

  let index = 2; // rule 1 is above
  options.tables.forEach((element: Table) => {
    // then add include selection rules for every table...
    const rule: any = {
      'rule-type': 'selection',
      'rule-id': `${index}`,
      'rule-name': `${index}`,
      'object-locator': {
        'schema-name': options.sourceSchema,
        'table-name': element.sourceName,
      },
      'rule-action': 'include',
    };
    if (element.andFilters) {
      rule['filters'] = [];

      const filters = addAndFilters(element);
      rule['filters'] = [...filters];

    }

    config.rules.push(rule);
    index += 1;

    if (element.removeColumns) {

      const removalResult = addRemovecolumns(index, options.sourceSchema, element.sourceName, element.removeColumns);
      config.rules = [...config.rules, ...removalResult.rules];
      index = removalResult.index;
    }
  });

  return config;
}

function addRemovecolumns(index: number, sourceSchema:string, sourceName:string, removeColumns: string[]): any {
  const removeRules: any[] = [];
  let localIndex:number = index;
  removeColumns.forEach((column:string) => {
    const removeRule = {
      'rule-type': 'transformation',
      'rule-id': `${localIndex}`,
      'rule-name': `${localIndex}`,
      'rule-action': 'remove-column',
      'rule-target': 'column',
      'object-locator': {
        'schema-name': sourceSchema,
        'table-name': sourceName,
        'column-name': column,
      },
    };
    removeRules.push(removeRule);
    localIndex += 1;
  });
  return { index: localIndex, rules: removeRules };
}

function addAndFilters(element:Table):any {
  // then add include selection rules for every table...
  const allFilters: any[] = [];
  element.andFilters.forEach((andFilter: AndFilter) => {
    const filter: any = {
      'filter-type': 'source',
      'column-name': andFilter.column,
      'filter-conditions': [],
    };

    const filterConditions = addOrCondition(andFilter.orConditions);
    filter['filter-conditions'] = [...filterConditions];
    allFilters.push(filter);
  });

  return allFilters;
}

function addOrCondition(orConditions: OrCondition[]): any {

  const filterConditions : any[] = [];
  orConditions.forEach((condition: OrCondition) => {
    if (condition.start) {
      // filter with two values
      filterConditions.push({
        'filter-operator': condition.operator,
        'start-value': condition.start,
        'end-value': condition.end,
      });
    } else {
      // filter with one value
      filterConditions.push({
        'filter-operator': condition.operator,
        value: condition.value,
      });
    }
  });
  return filterConditions;
}

function findFilters(options: Options, tableName: string): AndFilter[] {
  const table: Table = options.tables.find(table => table.sourceName === tableName);
  let andFilters: AndFilter[] = table.andFilters;
  if (!andFilters) {
    andFilters = [];
    table.andFilters = andFilters;
  }
  return andFilters;
}

export function addBetweenFilter(options: Options,
                                 tableName: string,
                                 columnName: string,
                                 start: DateTime,
                                 end: DateTime,
                                 logger: ILogger) {
  const filter = {
    column: columnName,
    orConditions: [{
      operator: 'between',
      start: start.toISODate(),
      end: end.toISODate(),
    }],
  };
  findFilters(options, tableName).push(filter);
  logger.debug(`Filtering ${tableName} on ${columnName} from ${start.toISODate()} to ${end.toISODate()}`);
}

export function addOnOrAfterFilter(options: Options,
                                   tableName: string,
                                   columnName: string,
                                   value: DateTime,
                                   logger: ILogger) {
  const filter = {
    column: columnName,
    orConditions: [{
      operator: 'gte',
      value: value.toISODate(),
    }],
  };
  findFilters(options, tableName).push(filter);
  logger.debug(`Filtering ${tableName} on ${columnName} on or after ${value.toISODate()}`);
}

export function addOnOrBeforeFilter(options: Options,
                                    tableName: string,
                                    columnName: string,
                                    value: DateTime,
                                    logger: ILogger) {
  const filter = {
    column: columnName,
    orConditions: [{
      operator: 'ste',
      value: value.toISO(),
    }],
  };
  findFilters(options, tableName).push(filter);
  logger.debug(`Filtering ${tableName} on ${columnName} on or before ${value.toISO()}`);
}
