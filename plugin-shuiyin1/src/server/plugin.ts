import { Plugin } from '@nocobase/server';
import path from 'path';
import fs from 'fs';

export class PluginShuiyin1Server extends Plugin {
  async afterAdd() {}

  async beforeLoad() {}

  async load() {
    this.app.log.info('[shuiyin1] load() started', { name: this.name });
    this.app.acl.allow('shuiyin1_settings', 'list', 'loggedIn');

    await this.syncVersion();

    let readmeHtml: string | null = null;
    const readmePath = path.resolve(__dirname, '../../README.md');
    try {
      const content = fs.readFileSync(readmePath, 'utf8');
      readmeHtml = `<!DOCTYPE html><html><head><meta charset="utf8"><title>水印插件说明</title><style>body{max-width:800px;margin:0 auto;padding:20px;font-family:sans-serif;line-height:1.6}code{background:#f4f4f4;padding:2px 6px;border-radius:3px}pre{background:#f4f4f4;padding:15px;border-radius:5px;overflow-x:auto}h1,h2,h3{border-bottom:1px solid #eee;padding-bottom:8px}</style></head><body><pre style="background:none;padding:0;white-space:pre-wrap;word-wrap:break-word">${content
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')}</pre></body></html>`;
    } catch {
      this.app.log.warn(`[shuiyin1] README.md not found at ${readmePath}`);
    }

    this.app.use(async (ctx, next) => {
      if (ctx.path === '/api/plugins/@my-project/plugin-shuiyin1/readme') {
        if (!ctx.state.currentUser) {
          ctx.status = 401;
          ctx.body = 'Unauthorized';
          return;
        }
        if (readmeHtml) {
          ctx.body = readmeHtml;
          ctx.type = 'text/html; charset=utf8';
        } else {
          ctx.status = 404;
          ctx.body = 'README not found';
        }
        return;
      }
      await next();
    });
  }

  async install() {
    await this.createDefaultSettings();
  }

  async upgrade() {
    this.app.log.info('[shuiyin1] running upgrade');
    await this.syncVersion();
    await this.migrateEnabledField();
    await this.migrateTextSourcesField();
  }

  private async migrateEnabledField() {
    const repo = this.db.getRepository('shuiyin1_settings');
    const records = await repo.find();
    for (const record of records) {
      if (record.get('enabled') === undefined || record.get('enabled') === null) {
        record.set('enabled', true);
        await record.save();
        this.app.log.info(`[shuiyin1] migrated enabled field for record ${record.get('id')}`);
      }
    }
  }

  private async migrateTextSourcesField() {
    const repo = this.db.getRepository('shuiyin1_settings');
    const records = await repo.find();
    for (const record of records) {
      const sources = record.get('textSources');
      if (!Array.isArray(sources) || sources.length === 0) {
        const text = record.get('text');
        record.set('textSources', text ? ['custom'] : ['nickname']);
        await record.save();
        this.app.log.info(`[shuiyin1] migrated textSources field for record ${record.get('id')}`);
      }
    }
  }

  private async syncVersion() {
    try {
      const packageName = this.options?.packageName || '@my-project/plugin-shuiyin1';
      const pkg = this.readPackageJson();
      this.app.log.debug('[shuiyin1] syncVersion', { packageName, version: pkg?.version });

      if (!pkg?.version) {
        this.app.log.warn('[shuiyin1] syncVersion: cannot read package.json');
        return;
      }

      const repo = this.app.pm?.repository;
      if (!repo) {
        this.app.log.warn('[shuiyin1] syncVersion: no repository');
        return;
      }

      const item = await repo.findOne({ filter: { packageName } });
      if (!item) {
        this.app.log.debug('[shuiyin1] syncVersion: no item in applicationPlugins table');
        return;
      }

      const dbVersion = item.get('version');
      this.app.log.debug('[shuiyin1] syncVersion', { dbVersion, pkgVersion: pkg.version });

      if (dbVersion !== pkg.version) {
        item.set('version', pkg.version);
        await item.save();
        this.app.log.info(`[shuiyin1] version synced from ${dbVersion} to ${pkg.version}`);
      }
    } catch (err) {
      this.app.log.error(`[shuiyin1] syncVersion error: ${(err as Error)?.message}`);
    }
  }

  private readPackageJson() {
    const candidates = [
      path.resolve(__dirname, '../../package.json'),
      path.resolve(__dirname, '../../../package.json'),
    ];
    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) {
          return JSON.parse(fs.readFileSync(p, 'utf8'));
        }
      } catch {
        // 忽略单个候选路径的读取/解析失败，继续尝试下一个
      }
    }
    this.app.log.warn(`[shuiyin1] package.json not found in: ${candidates.join(', ')}`);
    return null;
  }

  private async createDefaultSettings() {
    const repo = this.db.getRepository('shuiyin1_settings');
    const count = await repo.count();
    if (count === 0) {
      await repo.create({
        values: {
          text: '',
          textSources: ['nickname'],
          opacity: 0.15,
          fontSize: 10,
          showTime: true,
          density: 5,
          enabled: true,
        },
      });
    }
  }

  async afterEnable() {}
  async afterDisable() {}
  async remove() {}
}

export default PluginShuiyin1Server;
