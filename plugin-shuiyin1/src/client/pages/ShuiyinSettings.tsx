import React, { useState } from 'react';
import {
  Card,
  Form,
  Input,
  InputNumber,
  Switch,
  Button,
  Space,
  message,
} from 'antd';
import { useAPIClient, useRequest } from '@nocobase/client';
import { useTranslation } from 'react-i18next';

const defaultSettings = {
  id: undefined as number | undefined,
  text: '',
  opacity: 0.15,
  fontSize: 10,
  showTime: true,
  density: 5,
};

export const ShuiyinSettings: React.FC = () => {
  const { t } = useTranslation('@my-project/plugin-shuiyin1');
  const apiClient = useAPIClient();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const { loading } = useRequest(
    { url: 'shuiyin1_settings:list' },
    {
      onSuccess: (data) => {
        const record = data?.data?.[0] || data?.[0];
        if (record) {
          form.setFieldsValue({ ...defaultSettings, ...record });
        } else {
          form.setFieldsValue({ ...defaultSettings });
        }
      },
      onError: () => {
        message.error(t('Failed to load settings'));
      },
    },
  );

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const id = form.getFieldValue('id');
      setSaving(true);

      if (id) {
        await apiClient.request({
          url: 'shuiyin1_settings:update',
          method: 'POST',
          params: { filterByTk: id },
          data: values,
        });
      } else {
        const res = await apiClient.request({
          url: 'shuiyin1_settings:create',
          method: 'POST',
          data: values,
        });
        const newId =
          res?.data?.data?.id ||
          res?.data?.id ||
          res?.data?.data?.[0]?.id;
        if (newId) form.setFieldValue('id', newId);
      }

      const settings = { ...defaultSettings, ...values };
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('shuiyin1:settings:changed', { detail: settings }),
        );
      }

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
        <Form.Item label={t('Watermark text')} name="text">
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
        <Form.Item label={t('Show current time')} name="showTime" valuePropName="checked">
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
};
