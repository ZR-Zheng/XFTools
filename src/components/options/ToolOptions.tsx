import { useContext, type ReactNode } from 'react';
import { FormikProps, FormikValues, useFormikContext } from 'formik';
import ToolOptionGroups, { ToolOptionGroup } from './ToolOptionGroups';
import { useWorkbenchText } from '../../i18n/workbench';
import Glyph from '../workbench/Glyph';
import { ToolPageContext } from '../../tools/page-context';
export type UpdateField<T> = <Y extends keyof T>(field: Y, value: T[Y]) => void;
export type GetGroupsType<T> = (
  formikProps: FormikProps<T> & { updateField: UpdateField<T> }
) => [ToolOptionGroup, ...ToolOptionGroup[]];
export default function ToolOptions<T extends FormikValues>({
  children,
  getGroups,
  vertical
}: {
  children?: ReactNode;
  getGroups: GetGroupsType<T> | null;
  vertical?: boolean;
}) {
  const context = useFormikContext<T>();
  const { w, english } = useWorkbenchText();
  const { experience } = useContext(ToolPageContext);
  if (!getGroups) return null;
  const updateField: UpdateField<T> = (field, value) => {
    void context.setFieldValue(field as string, value);
  };
  const groups = getGroups({ ...context, updateField });
  const primary = experience.primaryGroups
    ? groups.filter((_, index) => experience.primaryGroups!.includes(index))
    : groups;
  const advanced = experience.primaryGroups
    ? groups.filter((_, index) => !experience.primaryGroups!.includes(index))
    : [];
  return (
    <section className="tool-options-panel">
      <h2>
        <Glyph name="grid" size={18} />
        {w('settings')}
      </h2>
      <ToolOptionGroups
        groups={primary.length ? primary : groups}
        vertical={vertical}
      />
      {advanced.length > 0 && primary.length > 0 && (
        <details className="advanced-tool-options">
          <summary>
            {english ? 'Advanced options' : '高级选项'}
            <span>{advanced.length}</span>
          </summary>
          <ToolOptionGroups groups={advanced} vertical={vertical} />
        </details>
      )}
      {children}
    </section>
  );
}
