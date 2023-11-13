import { config } from './config';
import { Options } from '../dms/table-mapping';

export const dmsOptions = {
  destSchema: 'tarsreplica',
  tables: [
    {
      sourceName: 'PROGRAMME',
      removeColumns: [
        'CHANGE_IND', 'MODIFICATION_SEQ_NUMBER',
      ],
    },
    {
      sourceName: 'PROGRAMME_SLOT',
      removeColumns: [
        'GHOST_IND', 'SLOT_TYPE_CODE', 'DEPLOYED_TO_FROM_TC_COST_CODE',
        'CLOSURE_CODE', 'REPEATED_CLOSURE_CODE', 'SUSPENDED_IND', 'DEPLOYMENT_ID',
        'INSTRUCTOR_ID', 'RESERVED_USER_NAME', 'RESERVED_DATE_TIME',
        'CANCELLED_DEPLOYMENT_IND', 'MODIFICATION_SEQ_NUMBER',
      ],
    },
    {
      sourceName: 'PERSONAL_COMMITMENT',
      removeColumns: [
        'COMMITMENT_TEXT', 'STATE_CODE', 'CREATED_BY', 'CREATED_ON', 'UPDATED_BY', 'UPDATED_ON',
      ],
      andFilters: [
        {
          column: 'STATE_CODE',
          orConditions: [{
            operator: 'eq',
            value: '1',
          }],
        }],
    },
    {
      sourceName: 'DEPLOYMENT',
      removeColumns: [
        'STATE_CODE', 'REQUEST_DATE', 'DEPLOYMENT_TYPE_CODE', 'ALLOWED_TRAVEL_MINUTES',
        'AREA_ID', 'AREA_DEPLOYMENT_NUMBER', 'CANCELLED_DATE', 'FINANCIAL_YEAR',
        'VERSION_NUMBER', 'WELSH_IND', 'COMMENTS_TEXT', 'AREA_DECISION_DATE',
        'CREATED_BY', 'CREATED_ON', 'UPDATED_BY', 'UPDATED_ON', 'DEPLOYMENT_REASON_ID',
        'NUM_CANCELLATIONS_SAVED',
      ],
      andFilters: [
        {
          column: 'STATE_CODE',
          orConditions: [{
            operator: 'eq',
            value: '1002',
          }],
        }],
    },
    {
      sourceName: 'ETHNIC_ORIGIN',
      removeColumns: [
        'THEORY_NUMBER',
      ],
    },
  ],
};

export const getDmsOptions = (): Options => {
  const tarsSchema = config().tarsSchema;
  return { sourceSchema: tarsSchema, ...dmsOptions };
};
