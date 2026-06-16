import { Plugin } from '@nocobase/server';

export class PluginShuiyin1Server extends Plugin {
  async afterAdd() {}

  async beforeLoad() {}

  async load() {
    this.app.acl.allow('shuiyin1_settings', '*', 'loggedIn');
  }

  async install() {
    const repo = this.db.getRepository('shuiyin1_settings');
    const count = await repo.count();
    if (count === 0) {
      await repo.create({
        values: {
          text: '',
          opacity: 0.15,
          fontSize: 10,
          showTime: true,
          density: 5,
        },
      });
    }
  }

  async afterEnable() {}

  async afterDisable() {}

  async remove() {}
}

export default PluginShuiyin1Server;
