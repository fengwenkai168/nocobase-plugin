import React, { useEffect, useRef, useState } from 'react';
import { App, Button, Card, Form, Input, InputNumber, Select, Space, Switch } from 'antd';
import { useFlowContext } from '@nocobase/flow-engine';
import { useT } from '../locale';

const defaultSettings = {
  id: undefined as number | undefined,
  text: '',
  textSources: ['nickname'],
  opacity: 0.15,
  fontSize: 10,
  showTime: true,
  density: 5,
  enabled: true,
};

export default function ShuiyinSettingsPage() {
  const t = useT();
  const ctx = useFlowContext();
  const api = ctx.api;
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const tRef = useRef(t);
  tRef.current = t;
  const messageRef = useRef(message);
  messageRef.current = message;

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await api.request({ url: 'shuiyin1_settings:list', method: 'get' });
        const record = res?.data?.data?.[0] || res?.data?.[0];
        if (record && (!Array.isArray(record.textSources) || !record.textSources.length)) {
          record.textSources = record.text ? ['custom'] : ['nickname'];
        }
        form.setFieldsValue({ ...defaultSettings, ...(record || {}) });
      } catch (err) {
        console.error('[shuiyin1] load settings failed', err);
        messageRef.current.error(tRef.current('Failed to load settings'));
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, [api, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const id = form.getFieldValue('id');
      setSaving(true);

      if (id) {
        await api.request({
          url: 'shuiyin1_settings:update',
          method: 'post',
          params: { filterByTk: id },
          data: values,
        });
      } else {
        const res = await api.request({
          url: 'shuiyin1_settings:create',
          method: 'post',
          data: values,
        });
        const newId = res?.data?.data?.id || res?.data?.id || res?.data?.data?.[0]?.id;
        if (newId) form.setFieldValue('id', newId);
      }

      const settings = { ...defaultSettings, ...values };
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('shuiyin1:settings:changed', { detail: settings }));
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
    <div style={{ padding: 24 }}>
      <Card title={t('Watermark Settings')} loading={loading}>
        <Form form={form} layout="vertical" style={{ maxWidth: 600 }}>
          <Form.Item name="id" hidden>
            <Input />
          </Form.Item>
          <Form.Item label={t('Enable watermark')} name="enabled" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item
            label={t('Watermark content')}
            name="textSources"
            rules={[{ required: true, message: t('Please select at least one content source') }]}
          >
            <Select
              mode="multiple"
              options={[
                { value: 'nickname', label: t('Nickname') },
                { value: 'username', label: t('Username') },
                { value: 'custom', label: t('Custom text') },
              ]}
            />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.textSources !== cur.textSources}>
            {({ getFieldValue }) =>
              (getFieldValue('textSources') || []).includes('custom') ? (
                <Form.Item
                  label={t('Custom text')}
                  name="text"
                  rules={[{ required: true, message: t('Please enter custom text') }]}
                >
                  <Input placeholder={t('Please enter custom text')} />
                </Form.Item>
              ) : null
            }
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
              <Button onClick={() => form.setFieldsValue({ ...defaultSettings, id: form.getFieldValue('id') })}>
                {t('Reset')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
