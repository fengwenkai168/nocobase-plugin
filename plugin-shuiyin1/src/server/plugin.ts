import { Plugin } from '@nocobase/server';
import path from 'path';
import fs from 'fs';

export class PluginShuiyin1Server extends Plugin {
  async afterAdd() {}

  async beforeLoad() {}

  async load() {
    console.log('[shuiyin1] load() started', { name: this.name, options: this.options });
    this.app.acl.allow('shuiyin1_settings', '*', 'loggedIn');

    await this.syncVersion();

    this.app.use(async (ctx, next) => {
      if (ctx.path === '/api/plugins/@my-project/plugin-shuiyin1/readme') {
        const readmePath = path.resolve(__dirname, '../../README.md');
        try {
          const content = fs.readFileSync(readmePath, 'utf8');
          ctx.body = `<!DOCTYPE html><html><head><meta charset="utf8"><title>水印插件说明</title><style>body{max-width:800px;margin:0 auto;padding:20px;font-family:sans-serif;line-height:1.6}code{background:#f4f4f4;padding:2px 6px;border-radius:3px}pre{background:#f4f4f4;padding:15px;border-radius:5px;overflow-x:auto}h1,h2,h3{border-bottom:1px solid #eee;padding-bottom:8px}</style></head><body><pre style="background:none;padding:0;white-space:pre-wrap;word-wrap:break-word">${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></body></html>`;
          ctx.type = 'text/html; charset=utf8';
        } catch {
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
  }

  private async migrateEnabledField() {
    const repo = this.db.getRepository('shuiyin1_settings');
    const records = await repo.find();
    for (const record of records) {
      if (record.get('enabled') === undefined || record.get('enabled') === null) {
        record.set('enabled', true);
        await record.save();
        this.app.log.info('[shuiyin1] migrated enabled field for record', record.get('id'));
      }
    }
  }

  private async syncVersion() {
    try {
      const packageName = this.options?.packageName || '@my-project/plugin-shuiyin1';
      const pkg = this.readPackageJson();
      console.log('[shuiyin1] syncVersion', { packageName, version: pkg?.version, dirname: __dirname });

      if (!pkg?.version) {
        console.log('[shuiyin1] syncVersion: cannot read package.json');
        return;
      }

      const repo = this.app.pm?.repository;
      if (!repo) {
        console.log('[shuiyin1] syncVersion: no repository');
        return;
      }

      const item = await repo.findOne({ filter: { packageName } });
      if (!item) {
        console.log('[shuiyin1] syncVersion: no item in _plugins table');
        return;
      }

      const dbVersion = item.get('version');
      console.log('[shuiyin1] syncVersion', { dbVersion, pkgVersion: pkg.version });

      if (dbVersion !== pkg.version) {
        item.set('version', pkg.version);
        await item.save();
        console.log('[shuiyin1] version synced from', dbVersion, 'to', pkg.version);
      }
    } catch (err) {
      console.log('[shuiyin1] syncVersion error:', (err as Error)?.message);
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
      } catch {}
    }
    console.log('[shuiyin1] package.json not found in:'