import { Migration } from '@nocobase/server';
export default class extends Migration {
    on: string;
    up(): Promise<void>;
}
