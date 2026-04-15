import { SegmentedControl } from '@mantine/core';
import Highcharts from 'highcharts/highstock';
import { ReactNode, useState } from 'react';
import { ProsperitySymbol, ResultLogTradeType } from '../../models.ts';
import { useStore } from '../../store.ts';
import { getAskColor, getBidColor } from '../../utils/colors.ts';
import { Chart } from './Chart.tsx';

export interface OrdersChartProps {
  symbol: ProsperitySymbol;
}

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

export function OrdersChart({ symbol }: OrdersChartProps): ReactNode {
  const algorithm = useStore(state => state.algorithm)!;
  const [priceMode, setPriceMode] = useState<'mid' | 'bidask'>('bidask');

  const midPriceData: [number, number][] = [];
  const filledMidPriceData: [number, number][] = [];
  const bid1Data: [number, number][] = [];
  const bid2Data: [number, number][] = [];
  const bid3Data: [number, number][] = [];
  const ask1Data: [number, number][] = [];
  const ask2Data: [number, number][] = [];
  const ask3Data: [number, number][] = [];

  for (const row of algorithm.activityLogs) {
    if (row.product !== symbol) continue;

    midPriceData.push([row.timestamp, row.midPrice]);
    if (row.isFilledMidPrice) {
      filledMidPriceData.push([row.timestamp, row.midPrice]);
    }

    if (row.bidPrices.length >= 1) bid1Data.push([row.timestamp, row.bidPrices[0]]);
    if (row.bidPrices.length >= 2) bid2Data.push([row.timestamp, row.bidPrices[1]]);
    if (row.bidPrices.length >= 3) bid3Data.push([row.timestamp, row.bidPrices[2]]);
    if (row.askPrices.length >= 1) ask1Data.push([row.timestamp, row.askPrices[0]]);
    if (row.askPrices.length >= 2) ask2Data.push([row.timestamp, row.askPrices[1]]);
    if (row.askPrices.length >= 3) ask3Data.push([row.timestamp, row.askPrices[2]]);
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
            enableMouseTracking: false,
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
            enableMouseTracking: false,
          },
          {
            type: 'line',
            name: 'Bid 2',
            color: getBidColor(0.75),
            data: bid2Data,
            marker: { enabled: false },
            enableMouseTracking: false,
          },
          {
            type: 'line',
            name: 'Bid 1',
            color: getBidColor(1.0),
            data: bid1Data,
            marker: { enabled: false },
            enableMouseTracking: false,
          },
          {
            type: 'line',
            name: 'Ask 1',
            color: getAskColor(1.0),
            data: ask1Data,
            marker: { enabled: false },
            enableMouseTracking: false,
          },
          {
            type: 'line',
            name: 'Ask 2',
            color: getAskColor(0.75),
            data: ask2Data,
            marker: { enabled: false },
            enableMouseTracking: false,
          },
          {
            type: 'line',
            name: 'Ask 3',
            color: getAskColor(0.5),
            data: ask3Data,
            marker: { enabled: false },
            enableMouseTracking: false,
          },
        ];

  const series: Highcharts.SeriesOptionsType[] = [
    ...priceSeries,
    {
      type: 'scatter',
      name: 'Buy (order)',
      color: getBidColor(0.3),
      data: unfilledBuyData,
      marker: { symbol: 'circle', radius: 4 },
      tooltip: unfilledBuyTooltip,
      dataGrouping: { enabled: false },
      visible: false,
    },
    {
      type: 'scatter',
      name: 'Sell (order)',
      color: getAskColor(0.3),
      data: unfilledSellData,
      marker: { symbol: 'circle', radius: 4 },
      tooltip: unfilledSellTooltip,
      dataGrouping: { enabled: false },
      visible: false,
    },
    {
      type: 'scatter',
      name: 'Buy (taker)',
      color: getBidColor(1.0),
      data: takerBuyData,
      marker: { symbol: 'diamond', radius: 6 },
      tooltip: createSubmissionTradeTooltip('Buy', 'taker', '&#9670;'),
      dataGrouping: { enabled: false },
    },
    {
      type: 'scatter',
      name: 'Sell (taker)',
      color: getAskColor(1.0),
      data: takerSellData,
      marker: { symbol: 'diamond', radius: 6 },
      tooltip: createSubmissionTradeTooltip('Sell', 'taker', '&#9670;'),
      dataGrouping: { enabled: false },
    },
    {
      type: 'scatter',
      name: 'Buy (maker)',
      color: getBidColor(0.8),
      data: makerBuyData,
      marker: { symbol: 'star', radius: 7 },
      tooltip: createSubmissionTradeTooltip('Buy', 'maker', '&#9733;'),
      dataGrouping: { enabled: false },
    },
    {
      type: 'scatter',
      name: 'Sell (maker)',
      color: getAskColor(0.8),
      data: makerSellData,
      marker: { symbol: 'star', radius: 7 },
      tooltip: createSubmissionTradeTooltip('Sell', 'maker', '&#9733;'),
      dataGrouping: { enabled: false },
    },
    {
      type: 'scatter',
      name: 'Other trades',
      color: '#a855f7',
      data: otherTradeData,
      marker: { symbol: 'circle', radius: 5 },
      tooltip: otherTradeTooltip,
      dataGrouping: { enabled: false },
    },
  ];

  const controls = (
    <SegmentedControl
      size="xs"
      value={priceMode}
      onChange={value => setPriceMode(value as 'mid' | 'bidask')}
      data={[
        { label: 'Mid Price', value: 'mid' },
        { label: 'Bid/Ask', value: 'bidask' },
      ]}
    />
  );

  return <Chart title={`${symbol} - Order Book`} series={series} controls={controls} />;
}
