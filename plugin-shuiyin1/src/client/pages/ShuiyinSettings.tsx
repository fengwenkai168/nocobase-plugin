import React, { useState } from 'react';
import { Card, Form, Input, InputNumber, Button, Space, message, Switch } from 'antd';
import { useAPIClient, useRequest } from '@nocobase/client';
import { useTranslation } from 'react-i18next';
// @ts-ignore
import pkg from '../../../package.json';

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
  const { t } = useTranslation(pkg.name);
  const api = useAPIClient();
  const [form] = Form.useForm<WatermarkSettings>();
  const [submitting, setSubmitting] = useState(false);

  const { loading } = useRequest(
    {
      url: 'shuiyin1_settings:list',
    },
    {
      onSuccess: (res: any) => {
        const record = res?.data?.data?.[0] ?? res?.data?.[0];
        if (record) {
          form.setFieldsValue({
            ...defaultValues,
            ...record,
          });
        } else {
          form.setFieldsValue({ ...defaultValues });
        }
      },
      onError: () => {
        message.error(t('Failed to load settings'));
      },
    },
  );

  const handleSave = async () => {
    const values = await form.validateFields();
    const id = form.getFieldValue('id');
    setSubmitting(true);
    try {
      if (id) {
        await api.request({
          url: 'shuiyin1_settings:update',
          method: 'POST',
          params: { filterByTk: id },
          data: values,
        });
      } else {
        const res = await api.request({
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
      setSubmitting(false);
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
            <Button type="primary" onClick={handleSave} loading={submitting}>
              {t('Save')}
            </Button>
            <Button onClick={() => form.resetFields()}>{t('Reset')}</Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
}
