import Highcharts from 'highcharts';
import { ReactNode } from 'react';
import { useStore } from '../../store.ts';
import { Chart } from './Chart.tsx';

export interface ProfitLossChartProps {
  symbols: string[];
}

export function ProfitLossChart({ symbols }: ProfitLossChartProps): ReactNode {
  const algorithm = useStore(state => state.algorithm)!;

  const dataByTimestamp = new Map<number, number>();
  const filledProfitLossTimestamps = new Set<number>();
  for (const row of algorithm.activityLogs) {
    if (!dataByTimestamp.has(row.timestamp)) {
      dataByTimestamp.set(row.timestamp, row.profitLoss);
    } else {
      dataByTimestamp.set(row.timestamp, dataByTimestamp.get(row.timestamp)! + row.profitLoss);
    }

    if (row.isFilledProfitLoss) {
      filledProfitLossTimestamps.add(row.timestamp);
    }
  }

  const totalData = [...dataByTimestamp.keys()].map(timestamp => [timestamp, dataByTimestamp.get(timestamp)] as [number, number]);
  const filledTotalData = totalData.filter(([timestamp]) => filledProfitLossTimestamps.has(timestamp));

  const series: Highcharts.SeriesOptionsType[] = [
    {
      type: 'line',
      name: 'Total',
      data: totalData,
    },
    {
      type: 'scatter',
      name: 'Filled PnL',
      data: filledTotalData,
      color: '#9ca3af',
      marker: { symbol: 'rightarrow', radius: 7 },
      dataGrouping: { enabled: false },
    },
  ];

  symbols.forEach(symbol => {
    const data: [number, number][] = [];
    const filledData: [number, number][] = [];

    for (const row of algorithm.activityLogs) {
      if (row.product === symbol) {
        data.push([row.timestamp, row.profitLoss]);
        if (row.isFilledProfitLoss) {
          filledData.push([row.timestamp, row.profitLoss]);
        }
      }
    }

    series.push({
      type: 'line',
      name: symbol,
      data,
      dashStyle: 'Dash',
    });

    series.push({
      type: 'scatter',
      name: `${symbol} (filled PnL)`,
      data: filledData,
      color: '#9ca3af',
      marker: { symbol: 'rightarrow', radius: 7 },
      dataGrouping: { enabled: false },
      showInLegend: false,
    });
  });

  return <Chart title="Profit / Loss" series={series} />;
}
