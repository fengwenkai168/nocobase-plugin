import { useTranslation } from 'react-i18next';
// @ts-ignore
import pkg from './../../package.json';

export function useT() {
  const { t } = useTranslation(pkg.name);
  return t;
}

export function tExpr(key: string) {
  return `{{t('${key}', { ns: '${pkg.name}' })}}`;
}
