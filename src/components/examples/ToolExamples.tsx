import ExampleCard, { ExampleCardProps } from './ExampleCard';
import { useContext, type Dispatch, type SetStateAction } from 'react';
import { ToolPageContext } from '../../tools/page-context';
import { GetGroupsType } from '@components/options/ToolOptions';
import { useFormikContext } from 'formik';
import { useTranslation } from 'react-i18next';
export type CardExampleType<T> = Omit<
  ExampleCardProps<T>,
  'getGroups' | 'changeInputResult'
>;
export interface ExampleProps<T> {
  title: string;
  subtitle?: string;
  exampleCards: CardExampleType<T>[];
  getGroups: GetGroupsType<T> | null;
  setInput?: Dispatch<SetStateAction<any>>;
}
export default function ToolExamples<T>({
  title,
  exampleCards,
  getGroups,
  setInput
}: ExampleProps<T>) {
  const { t } = useTranslation();
  const { setValues } = useFormikContext<T>();
  const { experience } = useContext(ToolPageContext);
  function changeInputResult(input: string | undefined, options: T) {
    if (input !== undefined && experience.entry !== 'file') setInput?.(input);
    void setValues(options);
    document.getElementById('tool')?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth'
    });
  }
  return (
    <section id="examples" className="tool-examples">
      <h2>{t('toolExamples.title', { title })}</h2>
      <div className="example-grid">
        {exampleCards.map((card, index) => (
          <ExampleCard
            {...card}
            key={index}
            getGroups={getGroups}
            changeInputResult={changeInputResult}
          />
        ))}
      </div>
    </section>
  );
}
