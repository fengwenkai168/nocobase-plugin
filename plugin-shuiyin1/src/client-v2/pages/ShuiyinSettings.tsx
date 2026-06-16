import React, { useEffect, useState } from 'react';
import { Card, Form, Input, InputNumber, Button, Space, message, Switch } from 'antd';
import { useApp } from '@nocobase/client-v2';
import { useT } from '../locale';

const SETTINGS_CHANGED_EVENT = 'shuiyin1:settings:changed';

interface WatermarkSettings {
  id?: number;
  text?: string;
  opacity?: number;
  fontSize?: number;
  showTime?: boolean;
  density?: number;
}

const defaultValues: Required<WatermarkSettings> = {
  id: undefined as any,
  text: '',
  opacity: 0.15,
  fontSize: 10,
  showTime: true,
  density: 5,
};

function notifySettingsChanged(settings: Required<WatermarkSettings>) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SETTINGS_CHANGED_EVENT, { detail: settings }));
  }
}

export default function ShuiyinSettings() {
  const app = useApp();
  const t = useT();
  const [form] = Form.useForm<WatermarkSettings>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    app.apiClient
      .request({
        url: 'shuiyin1_settings:list',
        method: 'POST',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
        data: { __refresh: Date.now() },
      })
      .then((res: any) => {
        const record = res?.data?.data?.[0] ?? res?.data?.[0];
        if (record) {
          form.setFieldsValue({ ...defaultValues, ...record });
        } else {
          form.setFieldsValue({ ...defaultValues });
        }
      })
      .catch(() => {
        message.error(t('Failed to load settings'));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [app.apiClient, form, t]);

  const handleSave = async () => {
    const values = await form.validateFields();
    const id = form.getFieldValue('id');
    setSaving(true);
    try {
      if (id) {
        await app.apiClient.request({
          url: 'shuiyin1_settings:update',
          method: 'POST',
          params: { filterByTk: id },
          data: values,
        });
      } else {
        const res = await app.apiClient.request({
          url: 'shuiyin1_settings:create',
          method: 'POST',
          data: values,
        });
        const createdId = res?.data?.data?.id || res?.data?.id || res?.data?.[0]?.id;
        if (createdId) {
          form.setFieldValue('id', createdId);
        }
      }
      notifySettingsChanged({ ...defaultValues, ...values });
      message.success(t('Saved successfully'));
    } catch (err) {
      console.error('[shuiyin1] save failed', err);
      message.error(t('Save failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title={t('Watermark Settings')} loading={loading}>
      <Form form={form} layout="vertical" style={{ maxWidth: 600 }}>
        <Form.Item name="id" hidden>
          <Input />
        </Form.Item>
        <Form.Item
          label={t('Watermark text')}
          name="text"
        >
          <Input placeholder={t('Leave blank to use current user nickname')} />
        </Form.Item>
        <Form.Item
          label={t('Opacity')}
          name="opacity"
          rules={[{ required: true, message: t('Please enter opacity') }]}
        >
          <InputNumber min={0.01} max={1} step={0.01} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item
          label={t('Font size')}
          name="fontSize"
          rules={[{ required: true, message: t('Please enter font size') }]}
        >
          <InputNumber min={8} max={72} step={1} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item
          label={t('Density')}
          name="density"
          rules={[{ required: true, message: t('Please enter density') }]}
        >
          <InputNumber min={1} max={5} step={1} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item
          label={t('Show current time')}
          name="showTime"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary" onClick={handleSave} loading={saving}>
              {t('Save')}
            </Button>
            <Button onClick={() => form.resetFields()}>{t('Reset')}</Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
}
