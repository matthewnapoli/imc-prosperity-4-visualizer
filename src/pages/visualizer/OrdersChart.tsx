import { SegmentedControl } from '@mantine/core';
import Highcharts from 'highcharts/highstock';
import { ReactNode, useState } from 'react';
import { ProsperitySymbol, ResultLogTradeType } from '../../models.ts';
import { useStore } from '../../store.ts';
import { getAskColor, getBidColor } from '../../utils/colors.ts';
import { formatNumber } from '../../utils/format.ts';
import { Chart } from './Chart.tsx';

export interface OrdersChartProps {
  symbol: ProsperitySymbol;
}

type OrdersChartMode = 'mid' | 'bidask' | 'volume';

function getTradeCategory(tradeType?: ResultLogTradeType): 'maker' | 'taker' | 'other' {
  if (tradeType === 'make') return 'maker';
  if (tradeType === 'take' || tradeType === undefined) return 'taker';
  return 'other';
}

function createSubmissionTradeTooltip(
  side: 'Buy' | 'Sell',
  category: 'maker' | 'taker',
  glyph: string,
): Highcharts.SeriesTooltipOptionsObject {
  return {
    pointFormatter(this: Highcharts.Point) {
      const { quantity, buyer, seller } = (this as any).custom ?? {};
      return `<span style="color:${this.color}">${glyph}</span> ${side} (${category}): <b>${this.y}</b> (qty: ${quantity}, buyer: ${buyer}, seller: ${seller})<br/>`;
    },
  };
}

function formatScatterTooltipLine(
  name: string,
  color: string,
  glyph: string,
  point: Highcharts.PointOptionsObject,
): string | null {
  const x = Number(point.x);
  const y = Number(point.y);
  if (Number.isNaN(x) || Number.isNaN(y)) {
    return null;
  }

  const custom = (point as any).custom ?? {};
  const quantity = custom.quantity;
  const buyer = custom.buyer ?? '';
  const seller = custom.seller ?? '';

  if (name === 'Buy (order)' || name === 'Sell (order)') {
    return `<span style="color:${color}">${glyph}</span> ${name}: <b>${formatNumber(y)}</b> (qty: ${quantity})<br/>`;
  }

  if (name === 'Filled mid price') {
    return `<span style="color:${color}">${glyph}</span> Filled mid price: <b>${formatNumber(y)}</b><br/>`;
  }

  return `<span style="color:${color}">${glyph}</span> ${name}: <b>${formatNumber(y)}</b> (qty: ${quantity}, buyer: ${buyer}, seller: ${seller})<br/>`;
}

function addScatterTooltipLines(
  linesByTimestamp: Map<number, string[]>,
  points: Highcharts.PointOptionsObject[],
  name: string,
  color: string,
  glyph: string,
): void {
  for (const point of points) {
    const x = Number(point.x);
    if (Number.isNaN(x)) {
      continue;
    }

    const line = formatScatterTooltipLine(name, color, glyph, point);
    if (line === null) {
      continue;
    }

    const lines = linesByTimestamp.get(x) ?? [];
    lines.push(line);
    linesByTimestamp.set(x, lines);
  }
}

export function OrdersChart({ symbol }: OrdersChartProps): ReactNode {
  const algorithm = useStore(state => state.algorithm)!;
  const [priceMode, setPriceMode] = useState<OrdersChartMode>('bidask');
  const buyOrderColor = getBidColor(0.3);
  const sellOrderColor = getAskColor(0.3);
  const takerBuyColor = getBidColor(1.0);
  const takerSellColor = getAskColor(1.0);
  const makerBuyColor = getBidColor(0.8);
  const makerSellColor = getAskColor(0.8);
  const otherTradeColor = '#a855f7';

  const midPriceData: [number, number][] = [];
  const filledMidPriceData: [number, number][] = [];
  const bid1Data: [number, number][] = [];
  const bid2Data: [number, number][] = [];
  const bid3Data: [number, number][] = [];
  const bid1VolumeData: [number, number][] = [];
  const bid2VolumeData: [number, number][] = [];
  const bid3VolumeData: [number, number][] = [];
  const ask1Data: [number, number][] = [];
  const ask2Data: [number, number][] = [];
  const ask3Data: [number, number][] = [];
  const ask1VolumeData: [number, number][] = [];
  const ask2VolumeData: [number, number][] = [];
  const ask3VolumeData: [number, number][] = [];

  for (const row of algorithm.activityLogs) {
    if (row.product !== symbol) continue;

    midPriceData.push([row.timestamp, row.midPrice]);
    if (row.isFilledMidPrice) {
      filledMidPriceData.push([row.timestamp, row.midPrice]);
    }

    if (row.bidPrices.length >= 1) bid1Data.push([row.timestamp, row.bidPrices[0]]);
    if (row.bidPrices.length >= 2) bid2Data.push([row.timestamp, row.bidPrices[1]]);
    if (row.bidPrices.length >= 3) bid3Data.push([row.timestamp, row.bidPrices[2]]);
    if (row.bidVolumes.length >= 1) bid1VolumeData.push([row.timestamp, row.bidVolumes[0]]);
    if (row.bidVolumes.length >= 2) bid2VolumeData.push([row.timestamp, row.bidVolumes[1]]);
    if (row.bidVolumes.length >= 3) bid3VolumeData.push([row.timestamp, row.bidVolumes[2]]);
    if (row.askPrices.length >= 1) ask1Data.push([row.timestamp, row.askPrices[0]]);
    if (row.askPrices.length >= 2) ask2Data.push([row.timestamp, row.askPrices[1]]);
    if (row.askPrices.length >= 3) ask3Data.push([row.timestamp, row.askPrices[2]]);
    if (row.askVolumes.length >= 1) ask1VolumeData.push([row.timestamp, row.askVolumes[0]]);
    if (row.askVolumes.length >= 2) ask2VolumeData.push([row.timestamp, row.askVolumes[1]]);
    if (row.askVolumes.length >= 3) ask3VolumeData.push([row.timestamp, row.askVolumes[2]]);
  }

  const takerBuyData: Highcharts.PointOptionsObject[] = [];
  const takerSellData: Highcharts.PointOptionsObject[] = [];
  const makerBuyData: Highcharts.PointOptionsObject[] = [];
  const makerSellData: Highcharts.PointOptionsObject[] = [];
  const otherTradeData: Highcharts.PointOptionsObject[] = [];

  for (const trade of algorithm.tradeHistory) {
    if (trade.symbol !== symbol) continue;

    const point: Highcharts.PointOptionsObject = {
      x: trade.timestamp,
      y: trade.price,
      custom: {
        quantity: trade.quantity,
        buyer: trade.buyer,
        seller: trade.seller,
        tradeType: trade.tradeType,
      },
    };

    const category = getTradeCategory(trade.tradeType);

    if (trade.buyer.includes('SUBMISSION')) {
      if (category === 'maker') {
        makerBuyData.push(point);
      } else {
        takerBuyData.push(point);
      }
    } else if (trade.seller.includes('SUBMISSION')) {
      if (category === 'maker') {
        makerSellData.push(point);
      } else {
        takerSellData.push(point);
      }
    } else {
      otherTradeData.push(point);
    }
  }

  const unfilledBuyData: Highcharts.PointOptionsObject[] = [];
  const unfilledSellData: Highcharts.PointOptionsObject[] = [];

  for (const row of algorithm.data) {
    const orders = row.orders[symbol];
    if (!orders) continue;

    for (const order of orders) {
      const point: Highcharts.PointOptionsObject = {
        x: row.state.timestamp,
        y: order.price,
        custom: { quantity: Math.abs(order.quantity) },
      };

      if (order.quantity > 0) {
        unfilledBuyData.push(point);
      } else if (order.quantity < 0) {
        unfilledSellData.push(point);
      }
    }
  }

  const unfilledBuyTooltip: Highcharts.SeriesTooltipOptionsObject = {
    pointFormatter(this: Highcharts.Point) {
      const qty = (this as any).custom?.quantity;
      return `<span style="color:${this.color}">&#9679;</span> Buy (order): <b>${this.y}</b> (qty: ${qty})<br/>`;
    },
  };

  const unfilledSellTooltip: Highcharts.SeriesTooltipOptionsObject = {
    pointFormatter(this: Highcharts.Point) {
      const qty = (this as any).custom?.quantity;
      return `<span style="color:${this.color}">&#9679;</span> Sell (order): <b>${this.y}</b> (qty: ${qty})<br/>`;
    },
  };

  const otherTradeTooltip: Highcharts.SeriesTooltipOptionsObject = {
    pointFormatter(this: Highcharts.Point) {
      const { quantity, buyer, seller } = (this as any).custom ?? {};
      return `<span style="color:${this.color}">&#9670;</span> Trade: <b>${this.y}</b> (qty: ${quantity}, buyer: ${buyer}, seller: ${seller})<br/>`;
    },
  };

  const priceSeries: Highcharts.SeriesOptionsType[] =
    priceMode === 'mid'
      ? [
          {
            type: 'line',
            name: 'Mid price',
            color: 'gray',
            dashStyle: 'Dash',
            data: midPriceData,
            marker: { enabled: false },
            dataGrouping: { enabled: false },
          },
          {
            type: 'scatter',
            name: 'Filled mid price',
            color: '#9ca3af',
            data: filledMidPriceData,
            marker: { symbol: 'rightarrow', radius: 7 },
            dataGrouping: { enabled: false },
          },
        ]
      : [
          {
            type: 'line',
            name: 'Bid 3',
            color: getBidColor(0.5),
            data: bid3Data,
            marker: { enabled: false },
            dataGrouping: { enabled: false },
          },
          {
            type: 'line',
            name: 'Bid 2',
            color: getBidColor(0.75),
            data: bid2Data,
            marker: { enabled: false },
            dataGrouping: { enabled: false },
          },
          {
            type: 'line',
            name: 'Bid 1',
            color: getBidColor(1.0),
            data: bid1Data,
            marker: { enabled: false },
            dataGrouping: { enabled: false },
          },
          {
            type: 'line',
            name: 'Ask 1',
            color: getAskColor(1.0),
            data: ask1Data,
            marker: { enabled: false },
            dataGrouping: { enabled: false },
          },
          {
            type: 'line',
            name: 'Ask 2',
            color: getAskColor(0.75),
            data: ask2Data,
            marker: { enabled: false },
            dataGrouping: { enabled: false },
          },
          {
            type: 'line',
            name: 'Ask 3',
            color: getAskColor(0.5),
            data: ask3Data,
            marker: { enabled: false },
            dataGrouping: { enabled: false },
          },
        ];

  const volumeSeries: Highcharts.SeriesOptionsType[] = [
    {
      type: 'column',
      name: 'Bid 3',
      color: getBidColor(0.5),
      data: bid3VolumeData,
      dataGrouping: { enabled: false },
    },
    {
      type: 'column',
      name: 'Bid 2',
      color: getBidColor(0.75),
      data: bid2VolumeData,
      dataGrouping: { enabled: false },
    },
    {
      type: 'column',
      name: 'Bid 1',
      color: getBidColor(1.0),
      data: bid1VolumeData,
      dataGrouping: { enabled: false },
    },
    {
      type: 'column',
      name: 'Ask 1',
      color: getAskColor(1.0),
      data: ask1VolumeData,
      dataGrouping: { enabled: false },
    },
    {
      type: 'column',
      name: 'Ask 2',
      color: getAskColor(0.75),
      data: ask2VolumeData,
      dataGrouping: { enabled: false },
    },
    {
      type: 'column',
      name: 'Ask 3',
      color: getAskColor(0.5),
      data: ask3VolumeData,
      dataGrouping: { enabled: false },
    },
  ];

  const series: Highcharts.SeriesOptionsType[] =
    priceMode === 'volume'
      ? volumeSeries
      : [
          ...priceSeries,
          {
            type: 'scatter',
            name: 'Buy (order)',
            color: buyOrderColor,
            data: unfilledBuyData,
            marker: { symbol: 'circle', radius: 4 },
            tooltip: unfilledBuyTooltip,
            dataGrouping: { enabled: false },
            visible: false,
          },
          {
            type: 'scatter',
            name: 'Sell (order)',
            color: sellOrderColor,
            data: unfilledSellData,
            marker: { symbol: 'circle', radius: 4 },
            tooltip: unfilledSellTooltip,
            dataGrouping: { enabled: false },
            visible: false,
          },
          {
            type: 'scatter',
            name: 'Buy (taker)',
            color: takerBuyColor,
            data: takerBuyData,
            marker: { symbol: 'diamond', radius: 6 },
            tooltip: createSubmissionTradeTooltip('Buy', 'taker', '&#9670;'),
            dataGrouping: { enabled: false },
          },
          {
            type: 'scatter',
            name: 'Sell (taker)',
            color: takerSellColor,
            data: takerSellData,
            marker: { symbol: 'diamond', radius: 6 },
            tooltip: createSubmissionTradeTooltip('Sell', 'taker', '&#9670;'),
            dataGrouping: { enabled: false },
          },
          {
            type: 'scatter',
            name: 'Buy (maker)',
            color: makerBuyColor,
            data: makerBuyData,
            marker: { symbol: 'star', radius: 7 },
            tooltip: createSubmissionTradeTooltip('Buy', 'maker', '&#9733;'),
            dataGrouping: { enabled: false },
          },
          {
            type: 'scatter',
            name: 'Sell (maker)',
            color: makerSellColor,
            data: makerSellData,
            marker: { symbol: 'star', radius: 7 },
            tooltip: createSubmissionTradeTooltip('Sell', 'maker', '&#9733;'),
            dataGrouping: { enabled: false },
          },
          {
            type: 'scatter',
            name: 'Other trades',
            color: otherTradeColor,
            data: otherTradeData,
            marker: { symbol: 'circle', radius: 5 },
            tooltip: otherTradeTooltip,
            dataGrouping: { enabled: false },
          },
        ];

  const scatterTooltipLinesByTimestamp = new Map<number, string[]>();
  if (priceMode !== 'volume') {
    addScatterTooltipLines(scatterTooltipLinesByTimestamp, filledMidPriceData, 'Filled mid price', '#9ca3af', '&#9654;');
    addScatterTooltipLines(scatterTooltipLinesByTimestamp, unfilledBuyData, 'Buy (order)', buyOrderColor, '&#9679;');
    addScatterTooltipLines(scatterTooltipLinesByTimestamp, unfilledSellData, 'Sell (order)', sellOrderColor, '&#9679;');
    addScatterTooltipLines(scatterTooltipLinesByTimestamp, takerBuyData, 'Buy (taker)', takerBuyColor, '&#9670;');
    addScatterTooltipLines(scatterTooltipLinesByTimestamp, takerSellData, 'Sell (taker)', takerSellColor, '&#9670;');
    addScatterTooltipLines(scatterTooltipLinesByTimestamp, makerBuyData, 'Buy (maker)', makerBuyColor, '&#9733;');
    addScatterTooltipLines(scatterTooltipLinesByTimestamp, makerSellData, 'Sell (maker)', makerSellColor, '&#9733;');
    addScatterTooltipLines(scatterTooltipLinesByTimestamp, otherTradeData, 'Other trades', otherTradeColor, '&#9679;');
  }

  const options: Highcharts.Options =
    priceMode === 'volume'
      ? {}
      : {
          tooltip: {
            shared: true,
            split: false,
            formatter: function () {
              const points = this.points ?? (this.point ? [this.point] : []);
              const plottedSeriesNames = new Set([
                'Mid price',
                'Filled mid price',
                'Bid 1',
                'Bid 2',
                'Bid 3',
                'Ask 1',
                'Ask 2',
                'Ask 3',
              ]);

              const plottedPoints = points.filter(point => plottedSeriesNames.has(point.series.name));
              const plottedLines = plottedPoints
                .map(
                  point =>
                    `<span style="color:${point.color}">&#9679;</span> ${point.series.name}: <b>${formatNumber(
                      Number(point.y),
                    )}</b><br/>`,
                )
                .join('');

              const hoverDetails = scatterTooltipLinesByTimestamp.get(Number(this.x))?.join('') ?? '';

              return `Timestamp ${formatNumber(Number(this.x))}<br/>${plottedLines}${hoverDetails}`;
            },
          },
        };

  const controls = (
    <SegmentedControl
      size="xs"
      value={priceMode}
      onChange={value => setPriceMode(value as OrdersChartMode)}
      data={[
        { label: 'Mid Price', value: 'mid' },
        { label: 'Bid/Ask', value: 'bidask' },
        { label: 'Volume', value: 'volume' },
      ]}
    />
  );

  const title = priceMode === 'volume' ? `${symbol} - Volume` : `${symbol} - Order Book`;

  return <Chart title={title} series={series} controls={controls} options={options} />;
}
