import { Activity, lazy, Suspense, useState, type ComponentType } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ToolPageContext } from '@tools/page-context';
import {
  calculatorModeExperiences,
  defaultExperience
} from '@tools/experiences';
import type { ToolComponentProps } from '@tools/defineTool';
import Glyph from '@components/workbench/Glyph';
import {
  AgeCalculator,
  DateDifference,
  DateShift,
  WorkdayCalculator
} from './DateCalculations';
import BasicCalculator from './BasicCalculator';
import TimeArithmetic from './TimeArithmetic';
import '@components/workbench/workspace-theme.css';
import './calculator.css';

const DurationConverter = lazy(() => import('../convert-duration'));
const TimestampWorkbench = lazy(
  () => import('../convert-unix-to-date/TimestampWorkbench')
);
const DiscordTimestamp = lazy(() => import('../discord-timestamp'));
const WeekdayCalculator = lazy(() => import('../date-weekday-calculator'));
const LeapYears = lazy(() => import('../check-leap-years'));
const ClockTruncate = lazy(() => import('../truncate-clock-time'));
const Cron = lazy(() => import('../crontab-guru'));

function LegacyMode({
  component: Panel,
  path,
  locale,
  title
}: {
  component: ComponentType<ToolComponentProps>;
  path: string;
  locale:
    | 'dateWeekdayCalculator'
    | 'checkLeapYears'
    | 'discordTimestamp'
    | 'truncateClockTime'
    | 'crontabGuru';
  title: string;
}) {
  const { t } = useTranslation('time');
  return (
    <ToolPageContext.Provider
      value={{
        path: 'time/calculator',
        title,
        experience: calculatorModeExperiences[path] ?? defaultExperience
      }}
    >
      <Panel title={title} longDescription={t(`${locale}.description`)} />
    </ToolPageContext.Provider>
  );
}

type Mode = {
  id: string;
  title: string;
  render: ComponentType<{ initiallyExact?: boolean }>;
};

const groups: readonly {
  name: string;
  glyph: string;
  modes: readonly Mode[];
}[] = [
  {
    name: '普通计算',
    glyph: 'grid',
    modes: [{ id: 'basic', title: '普通计算', render: BasicCalculator }]
  },
  {
    name: '日期',
    glyph: 'date',
    modes: [
      {
        id: 'difference',
        title: '日期差',
        render: DateDifference
      },
      { id: 'shift', title: '日期推算', render: DateShift },
      { id: 'age', title: '年龄', render: AgeCalculator },
      { id: 'workdays', title: '工作日', render: WorkdayCalculator },
      {
        id: 'weekday',
        title: '星期查询',
        render: () => (
          <LegacyMode
            component={WeekdayCalculator}
            path="time/date-weekday-calculator"
            locale="dateWeekdayCalculator"
            title="指定日期的星期查询"
          />
        )
      },
      {
        id: 'leap',
        title: '闰年查询',
        render: () => (
          <LegacyMode
            component={LeapYears}
            path="time/check-leap-years"
            locale="checkLeapYears"
            title="批量检查闰年"
          />
        )
      }
    ]
  },
  {
    name: '时间',
    glyph: 'clock',
    modes: [
      { id: 'time-math', title: '时长计算', render: TimeArithmetic },
      { id: 'duration', title: '时长换算', render: DurationConverter },
      { id: 'unix', title: 'Unix 时间戳', render: TimestampWorkbench },
      {
        id: 'discord',
        title: 'Discord 时间戳',
        render: () => (
          <LegacyMode
            component={DiscordTimestamp}
            path="time/discord-timestamp"
            locale="discordTimestamp"
            title="Discord 时间戳"
          />
        )
      },
      {
        id: 'truncate',
        title: '截断时间',
        render: () => (
          <LegacyMode
            component={ClockTruncate}
            path="time/truncate-clock-time"
            locale="truncateClockTime"
            title="截断时间"
          />
        )
      },
      {
        id: 'cron',
        title: 'Cron 解析',
        render: () => (
          <LegacyMode
            component={Cron}
            path="time/crontab-guru"
            locale="crontabGuru"
            title="Cron 表达式解析"
          />
        )
      }
    ]
  }
];

// Components stay mounted after their first visit so that switching modes keeps the inputs.
const modes = groups.flatMap((group) => group.modes);

function ModeView({
  id,
  initiallyExact
}: {
  id: string;
  initiallyExact: boolean;
}) {
  const mode = modes.find((item) => item.id === id);
  if (!mode) return null;
  const Panel = mode.render;
  return <Panel initiallyExact={initiallyExact} />;
}

export default function DateTimeCalculator({ title }: { title: string }) {
  const [params, setParams] = useSearchParams();
  const active =
    modes.find((mode) => mode.id === params.get('view'))?.id ?? 'basic';
  const group =
    groups.find((item) => item.modes.some((mode) => mode.id === active)) ??
    groups[0];
  const [visited, setVisited] = useState<string[]>([active]);
  const [lastMode, setLastMode] = useState<Record<string, string>>({});
  if (!visited.includes(active)) setVisited([...visited, active]);

  function navigate(id: string) {
    if (id === active) return;
    setLastMode({ ...lastMode, [group.name]: active });
    const next = new URLSearchParams(params);
    next.set('view', id);
    setParams(next);
  }

  return (
    <section className="workspace-theme datecalc" aria-label={title}>
      <nav className="datecalc-nav" aria-label="计算类别">
        {groups.map((item) => (
          <button
            type="button"
            key={item.name}
            aria-pressed={group === item}
            onClick={() => {
              if (group !== item)
                navigate(lastMode[item.name] ?? item.modes[0].id);
            }}
          >
            <Glyph name={item.glyph} size={17} /> {item.name}
          </button>
        ))}
      </nav>
      {group.modes.length > 1 && (
        <nav className="datecalc-modes" aria-label={`${group.name}计算模式`}>
          {group.modes.map((mode) => (
            <button
              type="button"
              key={mode.id}
              aria-pressed={active === mode.id}
              onClick={() => navigate(mode.id)}
            >
              {mode.title}
            </button>
          ))}
        </nav>
      )}
      <div className="datecalc-view">
        {visited.map((id) => (
          <Activity key={id} mode={id === active ? 'visible' : 'hidden'}>
            <Suspense
              fallback={
                <p className="datecalc-note" role="status">
                  正在加载计算模式…
                </p>
              }
            >
              <ModeView
                id={id}
                initiallyExact={params.get('precision') === 'time'}
              />
            </Suspense>
          </Activity>
        ))}
      </div>
    </section>
  );
}
