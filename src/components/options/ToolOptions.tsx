import type { ReactNode } from 'react';
import { FormikProps, FormikValues, useFormikContext } from 'formik';
import ToolOptionGroups, { ToolOptionGroup } from './ToolOptionGroups';
import { useWorkbenchText } from '../../i18n/workbench';
import Glyph from '../workbench/Glyph';
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
  const { w } = useWorkbenchText();
  if (!getGroups) return null;
  const updateField: UpdateField<T> = (field, value) => {
    void context.setFieldValue(field as string, value);
  };
  return (
    <section className="tool-options-panel">
      <h2>
        <Glyph name="grid" size={18} />
        {w('settings')}
      </h2>
      <ToolOptionGroups
        groups={getGroups({ ...context, updateField })}
        vertical={vertical}
      />
      {children}
    </section>
  );
}
