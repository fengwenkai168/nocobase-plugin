export function fieldLabel(name: string, fieldList: Array<{ name: string; title: string }>): string {
  const f = fieldList.find((x) => x.name === name);
  return f ? `${f.title}(${f.name})` : name;
}
