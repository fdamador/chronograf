import {buildQuery} from 'src/utils/influxql'
import {TYPE_SHIFTED, TYPE_QUERY_CONFIG} from 'src/dashboards/constants'
import {
  TEMP_VAR_DASHBOARD_TIME,
  TEMP_VAR_UPPER_DASHBOARD_TIME,
} from 'src/shared/constants'
import {timeRanges} from 'src/shared/data/timeRanges'
import {Source, LayoutQuery, TimeRange} from 'src/types'

const buildCannedDashboardQuery = (
  query: LayoutQuery,
  {lower, upper}: TimeRange,
  host: string
): string => {
  const {defaultGroupBy} = timeRanges.find(range => range.lower === lower) || {
    defaultGroupBy: '5m',
  }
  const {wheres, groupbys} = query

  let text = query.query

  if (upper) {
    text += ` where time > '${lower}' AND time < '${upper}'`
  } else {
    text += ` where time > ${lower}`
  }

  if (host) {
    text += ` and \"host\" = '${host}'`
  }

  if (wheres && wheres.length > 0) {
    text += ` and ${wheres.join(' and ')}`
  }

  if (groupbys) {
    if (groupbys.find(g => g.includes('time'))) {
      text += ` group by ${groupbys.join(',')}`
    } else if (groupbys.length > 0) {
      text += ` group by time(${defaultGroupBy}),${groupbys.join(',')}`
    } else {
      text += ` group by time(${defaultGroupBy})`
    }
  } else {
    text += ` group by time(${defaultGroupBy})`
  }

  return text
}

export const buildQueriesForLayouts = (
  cell,
  source: Source,
  timeRange: TimeRange,
  host: string
) => {
  return cell.queries.map(query => {
    let queryText
    // Canned dashboards use an different a schema different from queryConfig.
    if (query.queryConfig) {
      const {
        queryConfig: {database, measurement, fields, shifts, rawText, range},
      } = query
      const tR = range || {
        upper: TEMP_VAR_UPPER_DASHBOARD_TIME,
        lower: TEMP_VAR_DASHBOARD_TIME,
      }

      queryText =
        rawText || buildQuery(TYPE_QUERY_CONFIG, tR, query.queryConfig)
      const isParsable = database && measurement && fields.length

      if (shifts && shifts.length && isParsable) {
        const shiftedQueries = shifts
          .filter(s => s.unit)
          .map(s => buildQuery(TYPE_SHIFTED, timeRange, query.queryConfig, s))

        queryText = `${queryText};${shiftedQueries.join(';')}`
      }
    } else {
      queryText = buildCannedDashboardQuery(query, timeRange, host)
    }

    return {...query, host: source.links.proxy, text: queryText}
  })
}