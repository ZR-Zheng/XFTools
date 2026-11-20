import React, {
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState
} from 'react';
import { Box } from '@components/ui';
import { Formik, FormikValues, useFormikContext } from 'formik';
import ToolOptions, { GetGroupsType } from '@components/options/ToolOptions';
import ToolInputAndResult from '@components/ToolInputAndResult';
import ToolInfo from '@components/ToolInfo';
import Separator from '@components/Separator';
import ToolExamples, {
  CardExampleType
} from '@components/examples/ToolExamples';
import { ToolComponentProps } from '@tools/defineTool';
import { ToolInteractionContext } from '../tools/interaction';
import { useWorkbenchText } from '../i18n/workbench';
import { uiText } from '../i18n/uiText';
import {
  ToolPageContext,
  ToolSourceContext,
  ToolResultVisibleContext
} from '../tools/page-context';
import ToolTaskbar from './workbench/ToolTaskbar';

const FormikListenerComponent = <T,>({
  input,
  compute,
  onValuesChange,
  onResultReady
}: {
  input: any;
  compute: (optionsValues: T, input: any) => void;
  onValuesChange?: (values: T) => void;
  onResultReady: (ready: boolean) => void;
}) => {
  const { values, validateForm } = useFormikContext<T>();
  const interaction = useContext(ToolInteractionContext);
  const { english } = useWorkbenchText();
  const { title } = useContext(ToolPageContext);
  const manual = ['image', 'pdf', 'media'].includes(interaction);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState(false);
  const computeRef = useRef(compute);
  computeRef.current = compute;
  const latestInput = useRef({ values, input });
  latestInput.current = { values, input };
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const run = async () => {
    setBusy(true);
    onResultReady(false);
    setError('');
    setCompleted(false);
    try {
      if (manual) {
        const errors = await validateForm();
        if (Object.keys(errors).length) {
          const firstError = (value: unknown): string | undefined => {
            if (typeof value === 'string') return value;
            if (value && typeof value === 'object') {
              for (const child of Object.values(value)) {
                const found = firstError(child);
                if (found) return found;
              }
            }
          };
          setError(
            uiText(
              firstError(errors) ||
                (english ? 'Check the tool options.' : '请检查工具参数。')
            )
          );
          return;
        }
      }
      const computedValues = { ...values } as Record<string, unknown>;
      await computeRef.current(computedValues as T, input);
      if (
        active.current &&
        latestInput.current.values === values &&
        latestInput.current.input === input
      ) {
        setCompleted(true);
        onResultReady(true);
      }
    } catch (exception: unknown) {
      if (active.current)
        setError(
          uiText(
            exception instanceof Error ? exception.message : String(exception)
          )
        );
    } finally {
      if (active.current) setBusy(false);
    }
  };

  React.useEffect(() => {
    setCompleted(false);
    setError('');
    onResultReady(false);
    if (manual) return;
    const timer = setTimeout(() => {
      void run();
    }, 180);
    return () => clearTimeout(timer);
  }, [values, input, manual, english]);

  useEffect(() => {
    onValuesChange?.(values);
  }, [onValuesChange, values]);
  const hasInput =
    input instanceof File ||
    (Array.isArray(input) ? input.length > 0 : Boolean(input));
  return (
    <div className="tool-run-bar">
      {manual && (
        <button
          type="button"
          data-testid="process-tool"
          className="primary-button"
          disabled={busy || !hasInput}
          onClick={() => {
            void run();
          }}
        >
          {busy
            ? english
              ? 'Processing…'
              : '正在处理…'
            : title || (english ? 'Apply' : '应用')}
        </button>
      )}
      <span className="tool-run-status" role="status">
        {busy
          ? english
            ? 'Processing…'
            : '正在处理…'
          : manual
            ? completed
              ? english
                ? 'Processing finished. Save your result below.'
                : '处理完成，可在下方保存结果。'
              : english
                ? 'Choose files and adjust the options, then process.'
                : '选择文件并设置参数后，点击开始处理。'
            : english
              ? 'Updates as you type'
              : '修改内容或参数后自动更新'}
      </span>
      {error && (
        <p className="tool-inline-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

interface ToolContentProps<Options, Input> extends ToolComponentProps {
  inputComponent?: ReactNode;
  resultComponent?: ReactNode;
  renderCustomInput?: (
    values: Options,
    setFieldValue: (fieldName: string, value: any) => void
  ) => ReactNode;
  initialValues: Options;
  /**
   * should return non-empty array or null
   */
  getGroups: GetGroupsType<Options> | null;
  compute: (optionsValues: Options, input: Input) => void;
  toolInfo?: {
    title: string;
    description?: string;
  };
  input?: Input;
  exampleCards?: CardExampleType<Options>[];
  setInput?: React.Dispatch<React.SetStateAction<Input>>;
  validationSchema?: any;
  onValuesChange?: (values: Options) => void;
  verticalGroups?: boolean;
}

export default function ToolContent<T extends FormikValues, I>({
  title,
  inputComponent,
  resultComponent,
  initialValues,
  getGroups,
  compute,
  toolInfo,
  exampleCards,
  input,
  setInput,
  validationSchema,
  renderCustomInput,
  onValuesChange,
  verticalGroups
}: ToolContentProps<T, I>) {
  const interaction = useContext(ToolInteractionContext);
  const { experience } = useContext(ToolPageContext);
  const { english } = useWorkbenchText();
  const fileTool = experience.entry === 'file';
  const [resultReady, setResultReady] = useState(false);
  const hasSource =
    input instanceof File ||
    (Array.isArray(input) ? input.length > 0 : Boolean(input));
  return (
    <ToolSourceContext.Provider value={input}>
      <Box>
        <Formik
          initialValues={initialValues}
          validationSchema={validationSchema}
          onSubmit={() => {}}
        >
          {({ values, setFieldValue, setValues }) => {
            return (
              <>
                <ToolTaskbar
                  canReset={Boolean(getGroups)}
                  onExample={
                    exampleCards?.length
                      ? () => {
                          const example = exampleCards[0];
                          if (!fileTool && example.sampleText !== undefined)
                            setInput?.(example.sampleText as I);
                          void setValues(example.sampleOptions);
                        }
                      : undefined
                  }
                />
                <ToolInputAndResult
                  input={
                    inputComponent ??
                    (renderCustomInput &&
                      renderCustomInput(values, setFieldValue))
                  }
                  result={
                    resultComponent ? (
                      <ToolResultVisibleContext.Provider value={resultReady}>
                        {resultComponent}
                      </ToolResultVisibleContext.Provider>
                    ) : undefined
                  }
                  layout={interaction}
                  experience={experience.layout}
                  phase={fileTool && !hasSource ? 'empty' : 'ready'}
                  settings={
                    getGroups ? (
                      <ToolOptions
                        getGroups={getGroups}
                        vertical={verticalGroups}
                      />
                    ) : undefined
                  }
                  action={
                    <FormikListenerComponent<T>
                      compute={compute}
                      input={input}
                      onValuesChange={onValuesChange}
                      onResultReady={setResultReady}
                    />
                  }
                />

                {((toolInfo?.title && toolInfo.description) ||
                  !!exampleCards?.length) && (
                  <details className="tool-support-details">
                    <summary>
                      {english ? 'Examples & instructions' : '示例与使用说明'}
                    </summary>
                    {toolInfo && toolInfo.title && toolInfo.description && (
                      <ToolInfo
                        title={toolInfo.title}
                        description={toolInfo.description}
                      />
                    )}

                    {exampleCards && exampleCards.length > 0 && (
                      <>
                        <Separator
                          backgroundColor="var(--line)"
                          margin="32px"
                        />
                        <ToolExamples
                          title={title}
                          exampleCards={exampleCards}
                          getGroups={getGroups}
                          setInput={setInput}
                        />
                      </>
                    )}
                  </details>
                )}
              </>
            );
          }}
        </Formik>
      </Box>
    </ToolSourceContext.Provider>
  );
}
