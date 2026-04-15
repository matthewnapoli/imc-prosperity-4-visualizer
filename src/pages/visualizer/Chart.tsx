import { Box } from '@mantine/core';
import Highcharts from 'highcharts/highstock';
import HighchartsAccessibility from 'highcharts/modules/accessibility';
import HighchartsExporting from 'highcharts/modules/exporting';
import HighchartsOfflineExporting from 'highcharts/modules/offline-exporting';
import HighchartsHighContrastDarkTheme from 'highcharts/themes/high-contrast-dark';
import HighchartsReact from 'highcharts-react-official';
import merge from 'lodash/merge';
import { ReactNode, useMemo } from 'react';
import { useActualColorScheme } from '../../hooks/use-actual-color-scheme.ts';
import { formatNumber } from '../../utils/format.ts';
import { VisualizerCard } from './VisualizerCard.tsx';

HighchartsAccessibility(Highcharts);
HighchartsExporting(Highcharts);
HighchartsOfflineExporting(Highcharts);

const rendererSymbols = Highcharts.SVGRenderer.prototype.symbols as Record<
  string,
  (x: number, y: number, w: number, h: number) => Highcharts.SVGPathArray
>;

if (rendererSymbols.star === undefined) {
  rendererSymbols.star = (x: number, y: number, w: number, h: number): Highcharts.SVGPathArray => {
    const centerX = x + w / 2;
    const centerY = y + h / 2;
    const outerRadius = Math.min(w, h) / 2;
    const innerRadius = outerRadius * 0.45;
    const path: Highcharts.SVGPathArray = [];

    for (let i = 0; i < 10; i++) {
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const px = centerX + radius * Math.cos(angle);
      const py = centerY + radius * Math.sin(angle);
      path.push([i === 0 ? 'M' : 'L', px, py]);
    }

    path.push(['Z']);
    return path;
  };
}

if (rendererSymbols.rightarrow === undefined) {
  rendererSymbols.rightarrow = (x: number, y: number, w: number, h: number): Highcharts.SVGPathArray => {
    const shaftHeight = h * 0.42;
    const shaftTop = y + (h - shaftHeight) / 2;
    const shaftBottom = shaftTop + shaftHeight;
    const shaftEnd = x + w * 0.52;
    const headTipX = x + w;
    const centerY = y + h / 2;

    return [
      ['M', x, shaftTop],
      ['L', shaftEnd, shaftTop],
      ['L', shaftEnd, y],
      ['L', headTipX, centerY],
      ['L', shaftEnd, y + h],
      ['L', shaftEnd, shaftBottom],
      ['L', x, shaftBottom],
      ['Z'],
    ];
  };
}

// Highcharts themes are distributed as Highcharts extensions
// The normal way to use them is to apply these extensions to the global Highcharts object
// However, themes work by overriding the default options, with no way to rollback
// To make theme switching work, we merge theme options into the local chart options instead
// This way we don't override the global defaults and can change themes without refreshing
// This function is a little workaround to be able to get the options a theme overrides
function getThemeOptions(theme: (highcharts: typeof Highcharts) => void): Highcharts.Options {
  const highchartsMock = {
    _modules: {
      'Core/Globals.js': {
        theme: null,
      },
      'Core/Defaults.js': {
        setOptions: () => {
          // Do nothing
        },
      },
    },
    win: {
      dispatchEvent: () => {},
    },
  };

  theme(highchartsMock as any);

  return highchartsMock._modules['Core/Globals.js'].theme! as Highcharts.Options;
}

interface ChartProps {
  title: string;
  options?: Highcharts.Options;
  series: Highcharts.SeriesOptionsType[];
  min?: number;
  max?: number;
  controls?: ReactNode;
}

export function Chart({ title, options, series, min, max, controls }: ChartProps): ReactNode {
  const colorScheme = useActualColorScheme();

  const fullOptions = useMemo((): Highcharts.Options => {
    const themeOptions = colorScheme === 'light' ? {} : getThemeOptions(HighchartsHighContrastDarkTheme);

    const chartOptions: Highcharts.Options = {
      chart: {
        animation: false,
        height: 400,
        zooming: {
          type: 'x',
          mouseWheel: {
            enabled: false,
          },
        },
        panning: {
          enabled: true,
          type: 'x',
        },
        panKey: 'shift',
        numberFormatter: formatNumber,
        events: {
          load() {
            Highcharts.addEvent(this.tooltip, 'headerFormatter', (e: any) => {
              if (e.isFooter) {
                return true;
              }

              let timestamp = e.labelConfig.point.x;

              if (e.labelConfig.point.dataGroup) {
                const xData = e.labelConfig.series.xData;
                const lastTimestamp = xData[xData.length - 1];
                if (timestamp + 100 * e.labelConfig.point.dataGroup.length >= lastTimestamp) {
                  timestamp = lastTimestamp;
                }
              }

              e.text = `Timestamp ${formatNumber(timestamp)}<br/>`;
              return false;
            });
          },
          fullscreenOpen(this: Highcharts.Chart) {
            (this as any).tooltip.update({ outside: false });
          },
          fullscreenClose(this: Highcharts.Chart) {
            (this as any).tooltip.update({ outside: true });
          },
        },
      },
      title: {
        text: title,
      },
      credits: {
        href: 'javascript:window.open("https://www.highcharts.com/?credits", "_blank")',
      },
      plotOptions: {
        series: {
          dataGrouping: {
            approximation(this: any, values: number[]): number {
              const endIndex = this.dataGroupInfo.start + this.dataGroupInfo.length;
              if (endIndex < this.xData.length) {
                return values[0];
              } else {
                return values[values.length - 1];
              }
            },
            anchor: 'start',
            firstAnchor: 'firstPoint',
            lastAnchor: 'lastPoint',
            units: [['second', [1, 2, 5, 10]]],
          },
        },
      },
      xAxis: {
        type: 'datetime',
        title: {
          text: 'Timestamp',
        },
        crosshair: {
          width: 1,
        },
        labels: {
          formatter: params => formatNumber(params.value as number),
        },
      },
      yAxis: {
        opposite: false,
        allowDecimals: false,
        min,
        max,
      },
      tooltip: {
        split: false,
        shared: true,
        outside: true,
      },
      legend: {
        enabled: true,
      },
      rangeSelector: {
        enabled: false,
      },
      navigator: {
        enabled: false,
      },
      scrollbar: {
        enabled: false,
      },
      series,
      ...options,
    };

    return merge(themeOptions, chartOptions);
  }, [colorScheme, title, options, series, min, max]);

  return (
    <VisualizerCard p={0}>
      {controls && (
        <Box p="md" pb={0}>
          {controls}
        </Box>
      )}
      <HighchartsReact highcharts={Highcharts} constructorType={'stockChart'} options={fullOptions} immutable />
    </VisualizerCard>
  );
}
