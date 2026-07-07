import React from 'react';
import { Select, Tag, Button, Space, Switch, Modal, Form, Alert, Descriptions, Divider, App } from 'antd';
import { useTranslation } from 'react-i18next';
import { NAMESPACE } from '../../locale';

interface PermEditModalProps {
  open: boolean;
  perm?: any;
  isDetailOnly?: boolean;
  tables: any[];
  perms: any[];
  fields: any[];
  loadingFields: boolean;
  onSave: (values: any, perm?: any) => Promise<boolean>;
  onCancel: () => void;
  loadFields: (tableName: string) => void;
}

export default function PermEditModal({
  open,
  perm,
  isDetailOnly = false,
  tables,
  perms,
  fields,
  loadingFields,
  onSave,
  onCancel,
  loadFields,
}: PermEditModalProps) {
  const { message } = App.useApp();
  const { t } = useTranslation([NAMESPACE, 'client'], { nsMode: 'fallback' });
  const [form] = Form.useForm();
  const formCanImport = Form.useWatch('canImport', form) ?? false;
  const formCanExport = Form.useWatch('canExport', form) ?? false;
  const formMode = Form.useWatch('importMode', form) || [];

  React.useEffect(() => {
    if (open && perm) {
      form.setFieldsValue({
        ...perm,
        canImport: perm.canImport !== false,
        canExport: perm.canExport !== false,
        importMode: Array.isArray(perm.importMode) ? perm.importMode : [perm.importMode || 'insert'],
      });
    } else if (open && !perm) {
      form.resetFields();
      form.setFieldsValue({
        canImport: false,
        canExport: false,
        importMode: ['insert'],
      });
    }
  }, [open, perm, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const ok = await onSave(values, perm);
      if (ok) {
        message.success(t('Saved successfully'));
        onCancel();
      } else {
        message.error(t('Save failed'));
      }
    } catch {
      message.error(t('Save failed'));
    }
  };

  if (isDetailOnly) {
    return (
      <Modal
        title={`📋 ${t('View permission details')}`}
        open={open}
        onCancel={onCancel}
        footer={<Button onClick={onCancel}>{t('Close')}</Button>}
        width={680}
      >
        {perm && (
          <div>
            <Alert
              type="info"
              showIcon
              message={t('This permission is inherited and cannot be edited here')}
              style={{ marginBottom: 12 }}
            />
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label={t('Table')}>
                <b>{perm.tableName}</b>
              </Descriptions.Item>
              <Descriptions.Item label={t('Allow import')}>
                {perm.canImport ? <Tag color="blue">{t('Yes')}</Tag> : <Tag>{t('No')}</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label={t('Allow export')}>
                {perm.canExport ? <Tag color="blue">{t('Yes')}</Tag> : <Tag>{t('No')}</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label={t('Import mode')}>
                {(Array.isArray(perm.importMode) ? perm.importMode : [perm.importMode || 'insert']).map((m: string) => (
                  <Tag key={m} color="orange">
                    {m === 'insert' ? t('Insert only') : m === 'update' ? t('Update only') : t('Upsert')}
                  </Tag>
                ))}
              </Descriptions.Item>
              <Descriptions.Item label={t('Unique key fields')}>
                {perm.uniqueFields?.length > 0 ? perm.uniqueFields.join(', ') : '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('Required fields')}>
                {perm.requiredFields?.length > 0 ? perm.requiredFields.join(', ') : '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('Importable fields')}>
                {perm.importFields?.length > 0 ? perm.importFields.join(', ') : t('All fields allowed')}
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Modal>
    );
  }

  return (
    <Modal
      title={perm ? t('Edit permission') : t('Add permission')}
      open={open}
      onCancel={onCancel}
      onOk={handleSave}
      width={820}
    >
      <Form form={form} layout="vertical">
        <Form.Item label={t('Select table')} name="tableName" rules={[{ required: true }]}>
          <Select
            showSearch
            optionFilterProp="label"
            placeholder={t('Please select a table')}
            filterOption={(input, option) =>
              ((option?.label as string) || '').toLowerCase().includes(input.toLowerCase())
            }
            onChange={(val: string) => loadFields(val)}
            options={tables
              .filter((t: any) => {
                if (perm && perm.tableName === t.name) return true;
                return !perms.some((p: any) => p.tableName === t.name && !p._inherited);
              })
              .map((item: any) => ({ value: item.name, label: `${item.title} (${item.name})` }))}
          />
        </Form.Item>
        <Form.Item label={t('Permission switches')} style={{ marginBottom: 12 }}>
          <Space size="large" align="center">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Form.Item name="canImport" valuePropName="checked" noStyle>
                <Switch
                  onChange={(v) => {
                    if (!v) {
                      form.setFieldsValue({ importMode: [] });
                    } else if (!form.getFieldValue('importMode')?.length) {
                      form.setFieldsValue({ importMode: ['insert'] });
                    }
                  }}
                />
              </Form.Item>
              <span style={{ color: '#333' }}>{t('Allow import')}</span>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Form.Item name="canExport" valuePropName="checked" noStyle>
                <Switch />
              </Form.Item>
              <span style={{ color: '#333' }}>{t('Allow export')}</span>
            </span>
          </Space>
        </Form.Item>
        {formCanImport && (
          <>
            <Divider orientation="left" style={{ margin: '8px 0 16px', color: '#1677ff', fontSize: 13 }}>
              📥 {t('Import configuration')}
            </Divider>
            <Form.Item
              label={`${t('Import mode')}（${t('Multiple select')}）`}
              name="importMode"
              rules={[{ required: true, message: t('Please select import mode') }]}
            >
              <Select
                mode="multiple"
                options={[
                  { value: 'insert', label: t('Insert only') },
                  { value: 'update', label: t('Update only') },
                  { value: 'upsert', label: t('Upsert') },
                ]}
              />
            </Form.Item>
            {formMode.some((m: string) => m === 'update' || m === 'upsert') && (
              <Form.Item
                label={t('Unique key fields')}
                name="uniqueFields"
                rules={[{ required: true, message: t('Unique key fields are required for update/upsert modes') }]}
              >
                <Select
                  mode="multiple"
                  showSearch
                  placeholder={t('Please select unique key fields')}
                  loading={loadingFields}
                  filterOption={(input, option) =>
                    ((option?.label as string) || '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={fields.map((v: any) => ({ value: v.name, label: v.label }))}
                />
              </Form.Item>
            )}
            <Form.Item label={t('Required fields')} name="requiredFields">
              <Select
                mode="multiple"
                showSearch
                placeholder={t('Please select required fields')}
                loading={loadingFields}
                filterOption={(input, option) =>
                  ((option?.label as string) || '').toLowerCase().includes(input.toLowerCase())
                }
                options={fields.map((v: any) => ({ value: v.name, label: v.label }))}
              />
            </Form.Item>
            <Form.Item label={t('Importable fields')} name="importFields">
              <Select
                mode="multiple"
                showSearch
                placeholder={t('Empty means all allowed')}
                loading={loadingFields}
                filterOption={(input, option) =>
                  ((option?.label as string) || '').toLowerCase().includes(input.toLowerCase())
                }
                options={fields.map((v: any) => ({ value: v.name, label: v.label }))}
              />
            </Form.Item>
          </>
        )}
        {formCanExport && (
          <>
            <Divider orientation="left" style={{ margin: '8px 0 16px', color: '#52c41a', fontSize: 13 }}>
              📤 {t('Export configuration')}
            </Divider>
            <Form.Item label={t('Exportable fields')} name="exportFields">
              <Select
                mode="multiple"
                showSearch
                placeholder={t('Empty means all allowed')}
                loading={loadingFields}
                filterOption={(input, option) =>
                  ((option?.label as string) || '').toLowerCase().includes(input.toLowerCase())
                }
                options={fields.map((v: any) => ({ value: v.name, label: v.label }))}
              />
            </Form.Item>
          </>
        )}
      </Form>
    </Modal>
  );
}
