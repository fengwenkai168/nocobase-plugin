export interface ExportTableItem {
  name: string;
  title: string;
}

export interface PermSourceOption {
  value: string;
  label: string;
  type: string;
  id?: string;
}

export interface ExportFieldItem {
  name: string;
  type?: string;
  isForeignKey?: boolean;
  uiSchema?: { title?: string };
  displayName?: string;
}

export function optionsEqual(a: PermSourceOption[], b: PermSourceOption[]) {
  if (a.length !== b.length) return false;
  return a.every(
    (o, i) => o.value === b[i].value && o.label === b[i].label && o.type === b[i].type && o.id === b[i].id,
  );
}
