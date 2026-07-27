import type Plugin from '../plugin';
import { cleanTitle, listExportableFields } from '../services/field-meta';

export function registerMetaActions(plugin: Plugin) {
  return {
    'collectionMeta': async (ctx, next) => {
      const params = { ...(ctx.action.params || {}), ...(ctx.action.params.values || {}) };
      const { collectionName } = params;
      if (!collectionName) {
        ctx.throw(400, '缺少参数 collectionName');
      }
      const collection = plugin.db.getCollection(String(collectionName));
      if (!collection) {
        ctx.throw(404, `数据表 ${collectionName} 不存在`);
      }
      const pkName = (collection.options.filterTargetKey as string) || collection.model.primaryKeyAttribute || 'id';
      const pkField = collection.getField(pkName);
      const pkType = String(pkField?.options?.type || 'bigInt');
      const pkAuto = ['integer', 'bigInt'].includes(pkType) || ['uuid', 'nanoid', 'snowflakeId', 'uid'].includes(pkType);
      const fields = listExportableFields(plugin.db, String(collectionName)).map((meta) => ({
        name: meta.name,
        title: meta.title,
        type: meta.type,
        interface: meta.interface,
        options: meta.options,
        target: meta.target,
        multiple: meta.multiple,
        attachment: meta.attachment,
        ignored: meta.ignored,
      }));
      ctx.body = {
        collectionName: collection.name,
        collectionTitle: cleanTitle(collection.options.title, collection.name),
        pk: { name: pkName, type: pkType, auto: pkAuto },
        fields,
      };
      await next();
    },
  };
}
