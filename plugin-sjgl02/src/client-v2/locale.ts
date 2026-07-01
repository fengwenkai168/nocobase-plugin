import { tExpr as _tExpr } from '@nocobase/flow-engine';
// @ts-ignore
import pkg from './../../package.json';

export const NAMESPACE = pkg.name;

export function tExpr(key: string) {
  return _tExpr(key, { ns: [pkg.name, 'client'] });
}
