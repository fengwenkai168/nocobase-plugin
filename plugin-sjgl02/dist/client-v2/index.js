var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client-v2/locale.ts
var NAMESPACE;
var init_locale = __esm({
  "src/client-v2/locale.ts"() {
    NAMESPACE = "@my-project/plugin-sjgl02";
  }
});

// src/client-v2/pages/ImportTab.tsx
var ImportTab_exports = {};
__export(ImportTab_exports, {
  default: () => ImportTab
});
function ImportTab() {
  const api = (0, import_client_v2.useAPIClient)();
  const { t } = (0, import_react_i18next.useTranslation)([NAMESPACE, "client"], { nsMode: "fallback" });
  const [currentStep, setCurrentStep] = (0, import_react.useState)(0);
  const [selectedTable, setSelectedTable] = (0, import_react.useState)(null);
  const [importMode, setImportMode] = (0, import_react.useState)("insert");
  const [uploadedFileId, setUploadedFileId] = (0, import_react.useState)(null);
  const [uploadFileName, setUploadFileName] = (0, import_react.useState)("");
  const [fieldMapping, setFieldMapping] = (0, import_react.useState)({});
  const [customValues, setCustomValues] = (0, import_react.useState)({});
  const [uniqueFields, setUniqueFields] = (0, import_react.useState)([]);
  const [tableFields, setTableFields] = (0, import_react.useState)([]);
  const [loading, setLoading] = (0, import_react.useState)(false);
  const [previewData, setPreviewData] = (0, import_react.useState)(null);
  const [executing, setExecuting] = (0, import_react.useState)(false);
  const [headerRow, setHeaderRow] = (0, import_react.useState)(1);
  const [sheetName, setSheetName] = (0, import_react.useState)("Sheet1");
  const [availSheets, setAvailSheets] = (0, import_react.useState)(["Sheet1"]);
  const [excelHeaders, setExcelHeaders] = (0, import_react.useState)([]);
  const { data: tablesData, loading: tablesLoading } = (0, import_ahooks.useRequest)(
    () => api.request({ url: "sjgl02Permissions:tables", method: "get" }),
    { onError: () => import_antd.message.error(t("Load failed")) }
  );
  const rawTables = tablesData?.data?.data || [];
  const tables = rawTables.map((item) => ({
    name: item.name,
    title: item.title || item.name
  }));
  (0, import_react.useEffect)(() => {
    if (selectedTable?.name) {
      setLoading(true);
      api.request({ url: "sjgl02Import:tableFields", method: "get", params: { tableName: selectedTable.name } }).then((res) => {
        const data = res?.data?.data || [];
        setTableFields(Array.isArray(data) ? data : []);
      }).catch(() => {
      }).finally(() => setLoading(false));
    }
  }, [selectedTable?.name, api, t]);
  const handleTableSelect = (value) => {
    const table = tables.find((t2) => t2.name === value);
    setSelectedTable(table || null);
    setFieldMapping({});
  };
  const handleUpload = (info) => {
    if (info.file.status === "done") {
      const resp = info.file.response;
      const fileId = resp?.data?.data?.id || resp?.data?.id || resp?.id;
      if (fileId) {
        setUploadedFileId(fileId);
        setUploadFileName(info.file.name);
        import_antd.message.success(`${info.file.name} \u4E0A\u4F20\u6210\u529F`);
        api.request({
          url: "sjgl02Import:uploadParse",
          method: "post",
          data: { fileId }
        }).then((res) => {
          const d = res?.data?.data;
          if (d) {
            if (d.sheets) setAvailSheets(d.sheets);
            if (d.headerColumns) setExcelHeaders(d.headerColumns);
            if (d.sheets?.[0]) setSheetName(d.sheets[0]);
          }
        }).catch(() => {
          setExcelHeaders([]);
          setAvailSheets(["Sheet1"]);
        });
      } else {
        import_antd.message.error("\u4E0A\u4F20\u54CD\u5E94\u4E2D\u672A\u627E\u5230\u6587\u4EF6ID");
      }
    } else if (info.file.status === "error") {
      import_antd.message.error("\u4E0A\u4F20\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5");
    }
  };
  const handleRefreshHeaders = async () => {
    if (!uploadedFileId) return;
    try {
      const res = await api.request({
        url: "sjgl02Import:uploadParse",
        method: "post",
        data: { fileId: uploadedFileId }
      });
      const d = res?.data?.data;
      if (d?.headerColumns) {
        setExcelHeaders(d.headerColumns);
        if (d.sheets) setAvailSheets(d.sheets);
        import_antd.message.success("\u8868\u5934\u5DF2\u5237\u65B0");
      }
    } catch {
      import_antd.message.error("\u5237\u65B0\u5931\u8D25");
    }
  };
  const usedExcelCols = Object.entries(fieldMapping).filter(([, v]) => v && v !== "__ignore__").map(([, v]) => v);
  const getMappingType = (fieldName) => {
    const v = fieldMapping[fieldName];
    if (!v || v === "__ignore__") return "ignore";
    if (v === "__custom__") return "custom";
    return "excel";
  };
  const canGoStep2 = !!uploadedFileId;
  const handleAutoMatch = () => {
    const mapping = {};
    tableFields.forEach((f) => {
      const match = excelHeaders.find(
        (h) => h.toLowerCase() === f.name.toLowerCase() || f.uiSchema?.title && h.toLowerCase() === f.uiSchema.title.toLowerCase()
      );
      if (match) mapping[f.name] = match;
    });
    setFieldMapping(mapping);
    import_antd.message.success("\u81EA\u52A8\u5339\u914D\u5B8C\u6210");
  };
  const handlePreview = async () => {
    if (!uploadedFileId) return;
    try {
      const res = await api.request({
        url: "sjgl02Import:preview",
        method: "get",
        params: { fileId: uploadedFileId, sheetName, headerRow }
      });
      const data = res?.data?.data ?? null;
      setPreviewData(data || null);
    } catch {
      import_antd.message.error("\u9884\u89C8\u5931\u8D25");
    }
  };
  const handleExecuteImport = () => {
    import_antd.Modal.confirm({
      title: t("Confirm operation"),
      content: "\u5BFC\u5165\u5728\u5355\u4E00\u4E8B\u52A1\u4E2D\u6267\u884C\uFF0C\u4EFB\u4E00\u6570\u636E\u884C\u5931\u8D25\u5219\u6574\u6279\u56DE\u6EDA\u3002",
      onOk: async () => {
        setExecuting(true);
        try {
          const mapped = {};
          for (const [k, v] of Object.entries(fieldMapping)) {
            if (v === "__custom__") {
              mapped[k] = customValues[k] ?? "";
            } else {
              mapped[k] = v;
            }
          }
          await api.request({
            url: "sjgl02Import:execute",
            method: "post",
            data: {
              tableName: selectedTable?.name,
              fileId: uploadedFileId,
              sheetName,
              headerRow,
              fieldMapping: mapped,
              importMode,
              uniqueFields
            }
          });
          import_antd.message.success(t("Saved successfully"));
          setTimeout(() => {
            setCurrentStep(0);
            setSelectedTable(null);
            setUploadedFileId(null);
            setUploadFileName("");
            setFieldMapping({});
            setPreviewData(null);
            setCustomValues({});
          }, 1500);
        } catch {
          import_antd.message.error(t("Save failed"));
        } finally {
          setExecuting(false);
        }
      }
    });
  };
  const mappedCount = Object.values(fieldMapping).filter((v) => v && v !== "__ignore__").length;
  const ignoredCount = Object.values(fieldMapping).filter((v) => !v || v === "__ignore__").length;
  const usedCount = usedExcelCols.length;
  return /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement(import_antd.Steps, { current: currentStep, items: STEP_TITLES.map((title) => ({ title })), style: { marginBottom: 28 } }), currentStep === 0 && /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement(import_antd.Row, { gutter: 16 }, /* @__PURE__ */ import_react.default.createElement(import_antd.Col, { span: 12 }, /* @__PURE__ */ import_react.default.createElement(import_antd.Card, { title: "\u{1F4CB} \u9009\u62E9\u76EE\u6807\u6570\u636E\u8868", size: "small" }, /* @__PURE__ */ import_react.default.createElement(
    import_antd.Select,
    {
      style: { width: "100%" },
      placeholder: "\u2014 \u8BF7\u9009\u62E9\u6570\u636E\u8868 \u2014",
      onChange: handleTableSelect,
      value: selectedTable?.name,
      loading: tablesLoading,
      showSearch: true,
      optionFilterProp: "label",
      options: tables.map((t2) => ({ value: t2.name, label: `\u{1F4C1} ${t2.title} (${t2.name})` }))
    }
  ), /* @__PURE__ */ import_react.default.createElement("div", { style: { fontSize: 11, color: "#999", marginTop: 4 } }, "\u5171 ", tables.length, " \u5F20\u6570\u636E\u8868"))), /* @__PURE__ */ import_react.default.createElement(import_antd.Col, { span: 12 }, /* @__PURE__ */ import_react.default.createElement(import_antd.Card, { title: "\u2139\uFE0F \u5BFC\u5165\u8BF4\u660E", size: "small" }, /* @__PURE__ */ import_react.default.createElement("div", { style: { fontSize: 13, color: "#666", lineHeight: 1.9 } }, /* @__PURE__ */ import_react.default.createElement("p", null, "\u2022 \u652F\u6301 ", /* @__PURE__ */ import_react.default.createElement("strong", null, ".xlsx"), " / ", /* @__PURE__ */ import_react.default.createElement("strong", null, ".xls"), " / ", /* @__PURE__ */ import_react.default.createElement("strong", null, ".csv"), " \u683C\u5F0F"), /* @__PURE__ */ import_react.default.createElement("p", null, "\u2022 \u6587\u4EF6\u6700\u5927 ", /* @__PURE__ */ import_react.default.createElement("strong", null, "50 MB")), /* @__PURE__ */ import_react.default.createElement("p", null, "\u2022 \u4E09\u79CD\u5BFC\u5165\u6A21\u5F0F\uFF1A", /* @__PURE__ */ import_react.default.createElement(import_antd.Tag, { color: "blue" }, "\u65B0\u589E"), " ", /* @__PURE__ */ import_react.default.createElement(import_antd.Tag, { color: "green" }, "\u66F4\u65B0"), " ", /* @__PURE__ */ import_react.default.createElement(import_antd.Tag, { color: "orange" }, "\u65B0\u589E+\u66F4\u65B0")), /* @__PURE__ */ import_react.default.createElement("p", null, "\u2022 \u5BFC\u5165\u5728", /* @__PURE__ */ import_react.default.createElement("strong", null, "\u5355\u4E00\u4E8B\u52A1"), "\u4E2D\u6267\u884C\uFF0C\u4EFB\u4E00\u5931\u8D25\u5219\u6574\u6279\u56DE\u6EDA"))))), /* @__PURE__ */ import_react.default.createElement("div", { style: { textAlign: "right", marginTop: 12 } }, /* @__PURE__ */ import_react.default.createElement(import_antd.Button, { type: "primary", disabled: !selectedTable, onClick: () => setCurrentStep(1) }, "\u4E0B\u4E00\u6B65 \u2192"))), currentStep === 1 && /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement("div", { style: { fontWeight: 600, marginBottom: 12, fontSize: 14 } }, "\u76EE\u6807\u8868\uFF1A", selectedTable?.title || "\u2014"), !uploadedFileId ? /* @__PURE__ */ import_react.default.createElement(
    Dragger,
    {
      name: "file",
      multiple: false,
      accept: ".xlsx,.xls,.csv",
      action: "/api/attachments:create",
      onChange: handleUpload,
      beforeUpload: (file) => {
        const ext = file.name.split(".").pop()?.toLowerCase();
        if (!["xlsx", "xls", "csv"].includes(ext || "")) {
          import_antd.message.error("\u4E0D\u652F\u6301\u7684\u6587\u4EF6\u683C\u5F0F");
          return import_antd.Upload.LIST_IGNORE;
        }
        if (file.size > 50 * 1024 * 1024) {
          import_antd.message.error("\u6587\u4EF6\u8D85\u8FC7 50MB \u9650\u5236");
          return import_antd.Upload.LIST_IGNORE;
        }
        return true;
      },
      style: { marginBottom: 20 }
    },
    /* @__PURE__ */ import_react.default.createElement("p", { className: "ant-upload-drag-icon" }, /* @__PURE__ */ import_react.default.createElement(import_icons.InboxOutlined, null)),
    /* @__PURE__ */ import_react.default.createElement("p", { className: "ant-upload-text" }, t("Click or drag to upload")),
    /* @__PURE__ */ import_react.default.createElement("p", { className: "ant-upload-hint" }, t("Supported formats"))
  ) : /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement(import_antd.Card, { size: "small", style: { marginBottom: 12 } }, /* @__PURE__ */ import_react.default.createElement(import_antd.Space, null, /* @__PURE__ */ import_react.default.createElement(import_antd.Tag, { color: "blue" }, uploadFileName), /* @__PURE__ */ import_react.default.createElement(import_antd.Button, { size: "small", onClick: () => {
    setUploadedFileId(null);
    setUploadFileName("");
    setFieldMapping({});
    setExcelHeaders([]);
  } }, "\u91CD\u65B0\u4E0A\u4F20"))), /* @__PURE__ */ import_react.default.createElement(import_antd.Card, { size: "small", style: { marginBottom: 12 } }, /* @__PURE__ */ import_react.default.createElement(import_antd.Space, { wrap: true }, /* @__PURE__ */ import_react.default.createElement("span", { style: { color: "#999" } }, "Sheet\u540D\u79F0\uFF1A"), /* @__PURE__ */ import_react.default.createElement(
    import_antd.Select,
    {
      value: sheetName,
      onChange: setSheetName,
      style: { width: 150 },
      options: availSheets.map((s) => ({ value: s, label: s }))
    }
  ), /* @__PURE__ */ import_react.default.createElement("span", { style: { color: "#999" } }, "\u8868\u5934\u884C\uFF1A"), /* @__PURE__ */ import_react.default.createElement(import_antd.InputNumber, { min: 1, max: 100, value: headerRow, onChange: (v) => setHeaderRow(v || 1), style: { width: 80 } }), /* @__PURE__ */ import_react.default.createElement(import_antd.Button, { size: "small", onClick: handleRefreshHeaders }, "\u{1F504} \u5237\u65B0"))), /* @__PURE__ */ import_react.default.createElement(import_antd.Card, { size: "small", style: { marginBottom: 12 } }, /* @__PURE__ */ import_react.default.createElement(import_antd.Space, { style: { marginBottom: 12 } }, /* @__PURE__ */ import_react.default.createElement("span", { style: { color: "#999" } }, "\u5BFC\u5165\u6A21\u5F0F\uFF1A"), /* @__PURE__ */ import_react.default.createElement(
    import_antd.Select,
    {
      value: importMode,
      onChange: setImportMode,
      style: { width: 220 },
      options: IMPORT_MODES.map((m) => ({ value: m.value, label: m.label }))
    }
  )), (importMode === "update" || importMode === "upsert") && /* @__PURE__ */ import_react.default.createElement("div", { style: { borderTop: "1px solid #f0f0f0", paddingTop: 14 } }, /* @__PURE__ */ import_react.default.createElement("div", { style: { fontWeight: 600, color: "#fa8c16", marginBottom: 8 } }, "\u{1F511} \u552F\u4E00\u503C\u5B57\u6BB5"), /* @__PURE__ */ import_react.default.createElement(
    import_antd.Select,
    {
      mode: "multiple",
      value: uniqueFields,
      onChange: setUniqueFields,
      style: { width: "100%" },
      placeholder: "\u9009\u62E9\u552F\u4E00\u503C\u5B57\u6BB5",
      options: tableFields.map((f) => ({ value: f.name, label: f.name }))
    }
  ))), /* @__PURE__ */ import_react.default.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 } }, /* @__PURE__ */ import_react.default.createElement("div", { style: { fontWeight: 600, fontSize: 14 } }, "\u{1F4CA} \u5B57\u6BB5\u6620\u5C04", /* @__PURE__ */ import_react.default.createElement("span", { style: { color: "#999", fontWeight: 400, fontSize: 12, marginLeft: 8 } }, "\uFF08\u5171", tableFields.length, "\u5B57\u6BB5/\u5DF2\u6620\u5C04", mappedCount, "/\u5FFD\u7565", ignoredCount, "\uFF1BExcel\u5217\u5171", excelHeaders.length, "/\u5DF2\u7528", usedCount, "/\u5269\u4F59", excelHeaders.length - usedCount, "\uFF09")), /* @__PURE__ */ import_react.default.createElement(import_antd.Button, { size: "small", onClick: handleAutoMatch }, "\u26A1 \u81EA\u52A8\u5339\u914D")), loading ? /* @__PURE__ */ import_react.default.createElement("div", { style: { textAlign: "center", padding: 20 } }, /* @__PURE__ */ import_react.default.createElement(import_antd.Spin, null)) : /* @__PURE__ */ import_react.default.createElement(
    import_antd.Table,
    {
      dataSource: tableFields.map((f, idx) => ({ field: f, key: idx })),
      columns: [
        {
          title: /* @__PURE__ */ import_react.default.createElement("span", null, "Excel\u5217 ", /* @__PURE__ */ import_react.default.createElement(import_antd.Tag, { color: "blue", style: { fontSize: 10 } }, "\u9009\u62E9\u6765\u6E90")),
          width: 220,
          render: (record) => {
            const t2 = getMappingType(record.field.name);
            return /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement(
              import_antd.Select,
              {
                style: { width: "100%" },
                placeholder: "\u672A\u9009\u62E9\uFF08\u5FFD\u7565\uFF09",
                value: fieldMapping[record.field.name],
                onChange: (val) => {
                  setFieldMapping((prev) => ({ ...prev, [record.field.name]: val }));
                  if (val === "__custom__" && !customValues[record.field.name]) {
                    setCustomValues((prev) => ({ ...prev, [record.field.name]: "" }));
                  }
                },
                allowClear: true
              },
              /* @__PURE__ */ import_react.default.createElement(import_antd.Select.Option, { value: "__ignore__" }, "\u{1F6AB} \u5FFD\u7565\u6B64\u5B57\u6BB5"),
              /* @__PURE__ */ import_react.default.createElement(import_antd.Select.Option, { value: "__custom__" }, "\u270F\uFE0F \u81EA\u5B9A\u4E49\u56FA\u5B9A\u503C"),
              excelHeaders.map((h) => /* @__PURE__ */ import_react.default.createElement(
                import_antd.Select.Option,
                {
                  key: h,
                  value: h,
                  disabled: usedExcelCols.includes(h) && fieldMapping[record.field.name] !== h
                },
                "\u{1F4CB} ",
                h,
                " ",
                usedExcelCols.includes(h) && fieldMapping[record.field.name] !== h ? "(\u5DF2\u4F7F\u7528)" : ""
              ))
            ), t2 === "custom" && /* @__PURE__ */ import_react.default.createElement(
              import_antd.Input,
              {
                size: "small",
                style: { marginTop: 4 },
                placeholder: "\u8F93\u5165\u56FA\u5B9A\u503C",
                value: customValues[record.field.name] || "",
                onChange: (e) => setCustomValues((prev) => ({ ...prev, [record.field.name]: e.target.value }))
              }
            ));
          }
        },
        {
          title: "\u6620\u5C04\u65B9\u5F0F",
          width: 80,
          render: (record) => {
            const t2 = getMappingType(record.field.name);
            return t2 === "excel" ? /* @__PURE__ */ import_react.default.createElement(import_antd.Tag, { color: "blue" }, "Excel\u5217") : t2 === "custom" ? /* @__PURE__ */ import_react.default.createElement(import_antd.Tag, { color: "green" }, "\u56FA\u5B9A\u503C") : /* @__PURE__ */ import_react.default.createElement(import_antd.Tag, null, "\u5FFD\u7565");
          }
        },
        { title: "\u2192", width: 30, render: () => /* @__PURE__ */ import_react.default.createElement("span", { style: { color: "#999" } }, "\u2192") },
        {
          title: /* @__PURE__ */ import_react.default.createElement("span", null, "\u5DE5\u4F5C\u8868\u5B57\u6BB5 ", /* @__PURE__ */ import_react.default.createElement(import_antd.Tag, { color: "green", style: { fontSize: 10 } }, "\u76EE\u6807\u5B57\u6BB5")),
          render: (record) => /* @__PURE__ */ import_react.default.createElement("span", null, record.field.isRequired && /* @__PURE__ */ import_react.default.createElement("span", { style: { color: "#ff4d4f" } }, "* "), record.field.uiSchema?.title || record.field.name, "(", record.field.name, ")", ["belongsTo", "hasOne", "hasMany", "belongsToMany"].includes(record.field.type) && /* @__PURE__ */ import_react.default.createElement(import_antd.Tag, { color: "purple", style: { fontSize: 10, marginLeft: 4 } }, "\u5173\u8054"))
        }
      ],
      pagination: false,
      size: "small"
    }
  )), /* @__PURE__ */ import_react.default.createElement("div", { style: { textAlign: "right", marginTop: 12 } }, /* @__PURE__ */ import_react.default.createElement(import_antd.Button, { onClick: () => setCurrentStep(0), style: { marginRight: 8 } }, "\u2190 \u4E0A\u4E00\u6B65"), /* @__PURE__ */ import_react.default.createElement(import_antd.Button, { type: "primary", onClick: async () => {
    await handlePreview();
    setCurrentStep(2);
  }, disabled: !canGoStep2 }, "\u4E0B\u4E00\u6B65 \u2192"))), currentStep === 2 && /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement("div", { style: { fontWeight: 600, fontSize: 14, marginBottom: 16 } }, "\u9884\u89C8\u786E\u8BA4 \u2014 ", selectedTable?.title), /* @__PURE__ */ import_react.default.createElement(import_antd.Row, { gutter: 16, style: { marginBottom: 16 } }, /* @__PURE__ */ import_react.default.createElement(import_antd.Col, { span: 6 }, /* @__PURE__ */ import_react.default.createElement(import_antd.Card, { size: "small" }, /* @__PURE__ */ import_react.default.createElement(import_antd.Statistic, { title: "\u9884\u8BA1\u5BFC\u5165\u884C\u6570", value: previewData?.totalRows || 0 }))), /* @__PURE__ */ import_react.default.createElement(import_antd.Col, { span: 6 }, /* @__PURE__ */ import_react.default.createElement(import_antd.Card, { size: "small" }, /* @__PURE__ */ import_react.default.createElement(import_antd.Statistic, { title: "\u9519\u8BEF\u884C\u6570", value: 0, valueStyle: { color: previewData?.totalRows ? "#52c41a" : void 0 } }))), /* @__PURE__ */ import_react.default.createElement(import_antd.Col, { span: 6 }, /* @__PURE__ */ import_react.default.createElement(import_antd.Card, { size: "small" }, /* @__PURE__ */ import_react.default.createElement(import_antd.Statistic, { title: "\u5BFC\u5165\u6A21\u5F0F", value: IMPORT_MODES.find((m) => m.value === importMode)?.label || importMode }))), /* @__PURE__ */ import_react.default.createElement(import_antd.Col, { span: 6 }, /* @__PURE__ */ import_react.default.createElement(import_antd.Card, { size: "small" }, /* @__PURE__ */ import_react.default.createElement(import_antd.Statistic, { title: "Sheet\u540D\u79F0", value: sheetName })))), (importMode === "update" || importMode === "upsert") && uniqueFields.length > 0 && /* @__PURE__ */ import_react.default.createElement(import_antd.Alert, { type: "info", showIcon: true, message: /* @__PURE__ */ import_react.default.createElement("span", null, "\u552F\u4E00\u503C\u5339\u914D\u5B57\u6BB5\uFF1A", /* @__PURE__ */ import_react.default.createElement("strong", null, uniqueFields.join(", "))), style: { marginBottom: 16 } }), /* @__PURE__ */ import_react.default.createElement("div", { style: { fontWeight: 600, fontSize: 13, marginBottom: 8 } }, "\u{1F441}\uFE0F \u9884\u89C8\u6570\u636E\uFF08\u524D10\u884C\uFF09"), previewData?.preview ? /* @__PURE__ */ import_react.default.createElement(
    import_antd.Table,
    {
      dataSource: previewData.preview.map((r, i) => ({ ...r, key: i })),
      columns: (previewData.columns || []).map((c) => ({ title: c, dataIndex: c, key: c })),
      pagination: false,
      size: "small"
    }
  ) : /* @__PURE__ */ import_react.default.createElement(import_antd.Empty, { description: "\u6682\u65E0\u9884\u89C8\u6570\u636E\uFF0C\u8BF7\u8FD4\u56DE\u4E0A\u4E00\u6B65\u4E0A\u4F20\u6587\u4EF6\u5E76\u9884\u89C8" }), /* @__PURE__ */ import_react.default.createElement("div", { style: { textAlign: "right", marginTop: 16 } }, /* @__PURE__ */ import_react.default.createElement(import_antd.Button, { onClick: () => setCurrentStep(1), style: { marginRight: 8 } }, "\u2190 \u4E0A\u4E00\u6B65"), /* @__PURE__ */ import_react.default.createElement(import_antd.Button, { type: "primary", onClick: handleExecuteImport, loading: executing }, "\u25B6 \u6267\u884C\u5BFC\u5165"))));
}
var import_react, import_antd, import_icons, import_ahooks, import_react_i18next, import_client_v2, Dragger, STEP_TITLES, IMPORT_MODES;
var init_ImportTab = __esm({
  "src/client-v2/pages/ImportTab.tsx"() {
    import_react = __toESM(require("react"));
    import_antd = require("antd");
    import_icons = require("@ant-design/icons");
    import_ahooks = require("ahooks");
    import_react_i18next = require("react-i18next");
    import_client_v2 = require("@nocobase/client-v2");
    init_locale();
    ({ Dragger } = import_antd.Upload);
    STEP_TITLES = ["\u9009\u62E9\u6570\u636E\u8868", "\u4E0A\u4F20\u6587\u4EF6 & \u5B57\u6BB5\u6620\u5C04", "\u9884\u89C8 & \u6267\u884C"];
    IMPORT_MODES = [
      { value: "insert", label: "\u65B0\u589E (insert)" },
      { value: "update", label: "\u66F4\u65B0 (update)" },
      { value: "upsert", label: "\u65B0\u589E+\u66F4\u65B0 (upsert)" }
    ];
  }
});

// src/client-v2/pages/ExportTab.tsx
var ExportTab_exports = {};
__export(ExportTab_exports, {
  default: () => ExportTab
});
function ExportTab() {
  const api = (0, import_client_v22.useAPIClient)();
  const mountedRef = (0, import_react2.useRef)(true);
  const timerRef = (0, import_react2.useRef)(null);
  const { t } = (0, import_react_i18next2.useTranslation)([NAMESPACE, "client"], { nsMode: "fallback" });
  (0, import_react2.useEffect)(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const [currentStep, setCurrentStep] = (0, import_react2.useState)(0);
  const [selectedTable, setSelectedTable] = (0, import_react2.useState)(null);
  const [isAllTables, setIsAllTables] = (0, import_react2.useState)(false);
  const [selectedFields, setSelectedFields] = (0, import_react2.useState)([]);
  const [includeAttachments, setIncludeAttachments] = (0, import_react2.useState)(false);
  const [includeAssocSheet, setIncludeAssocSheet] = (0, import_react2.useState)(false);
  const [selectedAssocTables, setSelectedAssocTables] = (0, import_react2.useState)([]);
  const [dataRange, setDataRange] = (0, import_react2.useState)("all");
  const [exportProgress, setExportProgress] = (0, import_react2.useState)(0);
  const [exporting, setExporting] = (0, import_react2.useState)(false);
  const [exportDone, setExportDone] = (0, import_react2.useState)(false);
  const [downloadTaskId, setDownloadTaskId] = (0, import_react2.useState)(null);
  const [fileNameTemplate, setFileNameTemplate] = (0, import_react2.useState)("{\u8868\u540D}_{\u65E5\u671F}.xlsx");
  const [allFileNameTemplate, setAllFileNameTemplate] = (0, import_react2.useState)("\u5168\u90E8\u6570\u636E\u8868_{\u65E5\u671F}.zip");
  const [exportFields, setExportFields] = (0, import_react2.useState)([]);
  const [loading, setLoading] = (0, import_react2.useState)(false);
  const [estimatedRows, setEstimatedRows] = (0, import_react2.useState)(null);
  const [assocDisplayMode, setAssocDisplayMode] = (0, import_react2.useState)({});
  const [filterConditions, setFilterConditions] = (0, import_react2.useState)([]);
  const { data: tablesData, loading: tablesLoading } = (0, import_ahooks2.useRequest)(
    () => api.request({ url: "sjgl02Permissions:tables", method: "get" }),
    { onError: () => import_antd2.message.error(t("Load failed")) }
  );
  const rawTables = tablesData?.data?.data || [];
  const tables = rawTables.map((item) => ({
    name: item.name,
    title: item.title || item.name
  }));
  (0, import_react2.useEffect)(() => {
    if (selectedTable?.name && selectedTable.name !== "__all__") {
      setLoading(true);
      api.request({ url: "sjgl02Export:tableFields", method: "get", params: { tableName: selectedTable.name } }).then((res) => {
        const fields = (res?.data?.data || []).map((f) => ({ ...f, displayName: f.name }));
        setExportFields(fields);
        const names = fields.map((f) => f.displayName);
        setSelectedFields(names);
        const defaultModes = {};
        fields.forEach((f) => {
          if (["belongsTo", "hasOne", "hasMany", "belongsToMany"].includes(f.type)) {
            defaultModes[f.name] = "\u663E\u793A\u503C";
          }
        });
        setAssocDisplayMode((prev) => ({ ...defaultModes, ...prev }));
      }).catch(() => import_antd2.message.error(t("Load failed"))).finally(() => setLoading(false));
      api.request({ url: "sjgl02Export:previewCount", method: "post", data: { tableName: selectedTable.name } }).then((res) => {
        const c = res?.data?.data?.estimatedRows;
        if (typeof c === "number") setEstimatedRows(c);
      }).catch(() => {
      });
    } else if (selectedTable?.name === "__all__") {
      api.request({ url: "sjgl02Export:previewCount", method: "post", data: { tableName: "__all__" } }).then((res) => {
        const c = res?.data?.data?.estimatedRows;
        if (typeof c === "number") setEstimatedRows(c);
      }).catch(() => {
      });
    }
  }, [selectedTable?.name, api, t]);
  const regularFields = exportFields.filter((f) => !["belongsTo", "hasOne", "hasMany", "belongsToMany", "attachment"].includes(f.type));
  const associationFields = exportFields.filter((f) => ["belongsTo", "hasOne", "hasMany", "belongsToMany"].includes(f.type));
  const attachmentFields = exportFields.filter((f) => f.type === "attachment");
  const totalFieldCount = exportFields.length;
  const handleTableSelect = (value) => {
    setIsAllTables(value === "__all__");
    setSelectedTable(value === "__all__" ? { name: "__all__", title: "\u5168\u90E8\u6570\u636E\u8868" } : tables.find((t2) => t2.name === value) || null);
  };
  const toggleField = (fieldName) => setSelectedFields((prev) => prev.includes(fieldName) ? prev.filter((f) => f !== fieldName) : [...prev, fieldName]);
  const handleSelectAll = () => setSelectedFields(selectedFields.length === totalFieldCount ? [] : exportFields.map((f) => f.displayName));
  const isFieldSelected = (name) => selectedFields.includes(name);
  const handleExecuteExport = () => {
    if (exporting) return;
    import_antd2.Modal.confirm({
      title: t("Confirm operation"),
      content: isAllTables ? "\u5C06\u751F\u6210 .zip \u538B\u7F29\u5305" : "\u5C06\u751F\u6210 .xlsx \u6587\u4EF6",
      onOk: async () => {
        setExporting(true);
        setExportProgress(0);
        setExportDone(false);
        try {
          const execRes = await api.request({
            url: "sjgl02Export:execute",
            method: "post",
            data: {
              tableName: selectedTable?.name,
              selectedFields,
              includeAssociationSheet: includeAssocSheet,
              associationSheetTables: selectedAssocTables,
              includeAttachments,
              associationDisplayMode: assocDisplayMode,
              filter: dataRange === "all" ? void 0 : filterConditions,
              fileNameTemplate: isAllTables ? allFileNameTemplate : fileNameTemplate
            }
          });
          const taskId = execRes?.data?.data?.taskId;
          if (taskId) {
            setDownloadTaskId(taskId);
            let pollCount = 0;
            const maxPolls = 45;
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = setInterval(async () => {
              if (!mountedRef.current) {
                clearInterval(timerRef.current);
                return;
              }
              pollCount++;
              try {
                const pr = await api.request({ url: "sjgl02Export:progress", method: "get", params: { taskId } });
                if (!mountedRef.current) return;
                const pg = pr?.data?.data;
                if (pg) {
                  setExportProgress(pg.progress || 0);
                  if (pg.status === "completed") {
                    clearInterval(timerRef.current);
                    setExportDone(true);
                    setExporting(false);
                    import_antd2.message.success(t("Saved successfully"));
                  } else if (pg.status === "failed") {
                    clearInterval(timerRef.current);
                    setExporting(false);
                    import_antd2.message.error(t("Save failed"));
                  }
                }
                if (pollCount >= maxPolls) {
                  clearInterval(timerRef.current);
                  setExporting(false);
                  import_antd2.message.error("\u5BFC\u51FA\u8D85\u65F6");
                }
              } catch {
                clearInterval(timerRef.current);
                setExporting(false);
                import_antd2.message.error(t("Save failed"));
              }
            }, 2e3);
          } else {
            import_antd2.message.warning("\u672A\u83B7\u53D6\u5230\u4EFB\u52A1ID");
            setExporting(false);
          }
        } catch {
          import_antd2.message.error(t("Save failed"));
          setExporting(false);
        }
      }
    });
  };
  const handleDownload = async () => {
    if (!downloadTaskId) {
      import_antd2.message.warning("\u65E0\u53EF\u7528\u4EFB\u52A1ID");
      return;
    }
    try {
      const res = await api.request({ url: "sjgl02Export:download", method: "get", params: { taskId: downloadTaskId }, responseType: "blob" });
      const disp = res.headers?.["content-disposition"] || "";
      const m = disp.match(/filename\*=UTF-8''(.+)|filename="?([^";]+)/);
      const name = m ? decodeURIComponent(m[1] || m[2] || "export.xlsx") : "export.xlsx";
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      import_antd2.message.error("\u4E0B\u8F7D\u5931\u8D25");
    }
  };
  return /* @__PURE__ */ import_react2.default.createElement("div", null, /* @__PURE__ */ import_react2.default.createElement(import_antd2.Steps, { current: currentStep, items: STEP_TITLES2.map((title) => ({ title })), style: { marginBottom: 28 } }), currentStep === 0 && /* @__PURE__ */ import_react2.default.createElement("div", null, /* @__PURE__ */ import_react2.default.createElement(import_antd2.Row, { gutter: 16 }, /* @__PURE__ */ import_react2.default.createElement(import_antd2.Col, { span: 12 }, /* @__PURE__ */ import_react2.default.createElement(import_antd2.Card, { title: "\u{1F4CB} \u9009\u62E9\u6570\u636E\u8868", size: "small" }, /* @__PURE__ */ import_react2.default.createElement(
    import_antd2.Select,
    {
      style: { width: "100%" },
      placeholder: "\u2014 \u8BF7\u9009\u62E9\u6570\u636E\u8868 \u2014",
      onChange: handleTableSelect,
      value: selectedTable?.name,
      loading: tablesLoading,
      showSearch: true,
      optionFilterProp: "label",
      options: [
        { value: "__all__", label: /* @__PURE__ */ import_react2.default.createElement("span", { style: { fontWeight: 600, color: "#1677ff" } }, "\u{1F4E6} \u5168\u90E8\u6570\u636E\u8868\uFF08\u542B\u7CFB\u7EDF\u8868\uFF09") },
        ...tables.map((t2) => ({ value: t2.name, label: `\u{1F4C1} ${t2.title} (${t2.name})` }))
      ]
    }
  ), /* @__PURE__ */ import_react2.default.createElement("div", { style: { fontSize: 11, color: "#999", marginTop: 4 } }, "\u5171 ", tables.length + 1, " \u4E2A\u9009\u9879"))), /* @__PURE__ */ import_react2.default.createElement(import_antd2.Col, { span: 12 }, /* @__PURE__ */ import_react2.default.createElement(import_antd2.Card, { title: "\u2699\uFE0F \u7B80\u8981\u914D\u7F6E", size: "small" }, /* @__PURE__ */ import_react2.default.createElement("div", { style: { fontSize: 13, color: "#666", lineHeight: 1.9 } }, /* @__PURE__ */ import_react2.default.createElement("p", null, "\u2022 \u652F\u6301\u5168\u5B57\u6BB5\u9009\u62E9\u548C\u81EA\u5B9A\u4E49\u7B5B\u9009"), /* @__PURE__ */ import_react2.default.createElement("p", null, "\u2022 \u5173\u8054\u5B57\u6BB5\u53EF\u9009\u300C\u663E\u793A\u503C\u300D\u6216\u300C\u4EC5ID\u300D"), /* @__PURE__ */ import_react2.default.createElement("p", null, "\u2022 \u652F\u6301\u751F\u6210\u5173\u8054\u6570\u636E\u72EC\u7ACB Sheet"), /* @__PURE__ */ import_react2.default.createElement("p", null, "\u2022 \u81EA\u5B9A\u4E49\u6587\u4EF6\u540D\u6A21\u677F"))))), /* @__PURE__ */ import_react2.default.createElement("div", { style: { textAlign: "right", marginTop: 12 } }, /* @__PURE__ */ import_react2.default.createElement(import_antd2.Button, { type: "primary", disabled: !selectedTable, onClick: () => setCurrentStep(1) }, "\u4E0B\u4E00\u6B65 \u2192"))), currentStep === 1 && /* @__PURE__ */ import_react2.default.createElement("div", null, /* @__PURE__ */ import_react2.default.createElement("div", { style: { fontWeight: 600, marginBottom: 12, fontSize: 14 } }, "\u76EE\u6807\u8868\uFF1A", selectedTable?.title || "\u2014"), isAllTables ? /* @__PURE__ */ import_react2.default.createElement("div", null, /* @__PURE__ */ import_react2.default.createElement(import_antd2.Alert, { type: "info", showIcon: true, message: t("All tables export warning"), style: { marginBottom: 12 } }), /* @__PURE__ */ import_react2.default.createElement(import_antd2.Card, { title: "\u{1F4E6} \u5168\u90E8\u6570\u636E\u8868\u5BFC\u51FA", size: "small" }, /* @__PURE__ */ import_react2.default.createElement("p", null, "\u2705 \u5C06\u5BFC\u51FA\u7CFB\u7EDF\u4E2D ", /* @__PURE__ */ import_react2.default.createElement("strong", null, "\u6240\u6709\u6570\u636E\u8868")), /* @__PURE__ */ import_react2.default.createElement("p", null, "\u{1F4E6} \u6700\u7EC8\u6253\u5305\u4E3A ", /* @__PURE__ */ import_react2.default.createElement("strong", null, "ZIP \u538B\u7F29\u5305"), " \u4E0B\u8F7D"), /* @__PURE__ */ import_react2.default.createElement("p", null, "\u{1F4CB} \u5305\u542B\u4EE5\u4E0B ", tables.length, " \u5F20\u8868\uFF1A"), /* @__PURE__ */ import_react2.default.createElement(import_antd2.Space, { wrap: true }, tables.slice(0, 8).map((tbl) => /* @__PURE__ */ import_react2.default.createElement(import_antd2.Tag, { key: tbl.name, color: "blue" }, tbl.title)))), /* @__PURE__ */ import_react2.default.createElement(import_antd2.Card, { title: "\u2699\uFE0F \u5BFC\u51FA\u914D\u7F6E", size: "small", style: { marginTop: 12 } }, /* @__PURE__ */ import_react2.default.createElement(import_antd2.Space, null, /* @__PURE__ */ import_react2.default.createElement("span", { style: { color: "#999" } }, "\u6587\u4EF6\u547D\u540D\u89C4\u5219\uFF1A"), /* @__PURE__ */ import_react2.default.createElement(import_antd2.Input, { style: { width: 280 }, value: allFileNameTemplate, onChange: (e) => setAllFileNameTemplate(e.target.value) })))) : loading ? /* @__PURE__ */ import_react2.default.createElement("div", { style: { textAlign: "center", padding: 40 } }, "\u52A0\u8F7D\u4E2D...") : /* @__PURE__ */ import_react2.default.createElement("div", null, /* @__PURE__ */ import_react2.default.createElement(import_antd2.Card, { title: "\u2611\uFE0F \u5B57\u6BB5\u9009\u62E9", size: "small", style: { marginBottom: 12 } }, /* @__PURE__ */ import_react2.default.createElement(
    import_antd2.Checkbox,
    {
      indeterminate: selectedFields.length > 0 && selectedFields.length < totalFieldCount,
      checked: selectedFields.length === totalFieldCount && totalFieldCount > 0,
      onChange: handleSelectAll
    },
    t("Select all"),
    " ",
    /* @__PURE__ */ import_react2.default.createElement("span", { style: { color: "#999", fontSize: 12 } }, t("Selected"), ": ", selectedFields.length, "/", totalFieldCount)
  ), regularFields.length > 0 && /* @__PURE__ */ import_react2.default.createElement(import_react2.default.Fragment, null, /* @__PURE__ */ import_react2.default.createElement("div", { style: { fontWeight: 600, fontSize: 12, marginTop: 12, marginBottom: 6 } }, "\u{1F4C4} ", t("Regular fields"), " (", regularFields.length, ")"), /* @__PURE__ */ import_react2.default.createElement(import_antd2.Space, { wrap: true, style: { marginBottom: 12 } }, regularFields.map((f) => /* @__PURE__ */ import_react2.default.createElement(import_antd2.Checkbox, { key: f.name, checked: isFieldSelected(f.displayName), onChange: () => toggleField(f.displayName) }, f.displayName)))), associationFields.length > 0 && /* @__PURE__ */ import_react2.default.createElement(import_react2.default.Fragment, null, /* @__PURE__ */ import_react2.default.createElement("div", { style: { fontWeight: 600, fontSize: 12, color: "#7c3aed", marginBottom: 6 } }, "\u{1F517} ", t("Association fields"), " (", associationFields.length, ")"), /* @__PURE__ */ import_react2.default.createElement(import_antd2.Space, { wrap: true, style: { marginBottom: 12 } }, associationFields.map((f) => /* @__PURE__ */ import_react2.default.createElement(import_antd2.Checkbox, { key: f.name, checked: isFieldSelected(f.displayName), onChange: () => toggleField(f.displayName) }, f.displayName)))), attachmentFields.length > 0 && /* @__PURE__ */ import_react2.default.createElement(import_react2.default.Fragment, null, /* @__PURE__ */ import_react2.default.createElement("div", { style: { fontWeight: 600, fontSize: 12, color: "#0891b2", marginBottom: 6 } }, "\u{1F4CE} ", t("Attachment fields"), " (", attachmentFields.length, ")"), /* @__PURE__ */ import_react2.default.createElement(import_antd2.Space, { wrap: true }, attachmentFields.map((f) => /* @__PURE__ */ import_react2.default.createElement(import_antd2.Checkbox, { key: f.name, checked: isFieldSelected(f.displayName), onChange: () => toggleField(f.displayName) }, f.displayName))))), associationFields.length > 0 && /* @__PURE__ */ import_react2.default.createElement(import_antd2.Card, { title: "\u{1F517} \u5173\u8054\u5B57\u6BB5\u663E\u793A\u6A21\u5F0F", size: "small", style: { marginBottom: 12 } }, /* @__PURE__ */ import_react2.default.createElement(import_antd2.Space, { wrap: true }, associationFields.filter((f) => isFieldSelected(f.displayName)).map((f) => /* @__PURE__ */ import_react2.default.createElement(import_antd2.Space, { key: f.name }, /* @__PURE__ */ import_react2.default.createElement("span", null, f.displayName), /* @__PURE__ */ import_react2.default.createElement(
    import_antd2.Select,
    {
      value: assocDisplayMode[f.name] || "\u663E\u793A\u503C",
      onChange: (val) => setAssocDisplayMode((prev) => ({ ...prev, [f.name]: val })),
      style: { width: 100 },
      options: [{ value: "\u663E\u793A\u503C", label: "\u663E\u793A\u503C" }, { value: "\u4EC5ID", label: "\u4EC5ID" }]
    }
  ))))), /* @__PURE__ */ import_react2.default.createElement(import_antd2.Card, { title: "\u{1F4D1} \u5173\u8054\u6570\u636E Sheet", size: "small", style: { marginBottom: 12 } }, /* @__PURE__ */ import_react2.default.createElement(import_antd2.Space, null, /* @__PURE__ */ import_react2.default.createElement(import_antd2.Switch, { checked: includeAssocSheet, onChange: setIncludeAssocSheet }), /* @__PURE__ */ import_react2.default.createElement("span", null, t("Include association sheet"))), includeAssocSheet && associationFields.filter((f) => isFieldSelected(f.displayName)).length > 0 && /* @__PURE__ */ import_react2.default.createElement("div", { style: { marginTop: 8 } }, /* @__PURE__ */ import_react2.default.createElement(
    import_antd2.Select,
    {
      mode: "multiple",
      style: { width: "100%" },
      placeholder: "\u9009\u62E9\u8981\u5305\u542B\u7684\u5173\u8054\u8868",
      value: selectedAssocTables,
      onChange: setSelectedAssocTables,
      options: associationFields.filter((f) => isFieldSelected(f.displayName)).map((f) => ({ value: f.name, label: f.displayName }))
    }
  ))), /* @__PURE__ */ import_react2.default.createElement(import_antd2.Card, { title: "\u{1F4CA} \u6570\u636E\u8303\u56F4", size: "small", style: { marginBottom: 12 } }, /* @__PURE__ */ import_react2.default.createElement(import_antd2.Space, { style: { marginBottom: 12 } }, /* @__PURE__ */ import_react2.default.createElement(import_antd2.Button, { type: dataRange === "all" ? "primary" : "default", onClick: () => setDataRange("all") }, t("All data")), /* @__PURE__ */ import_react2.default.createElement(import_antd2.Button, { type: dataRange === "filtered" ? "primary" : "default", onClick: () => setDataRange("filtered") }, t("Custom filter"))), dataRange === "filtered" && /* @__PURE__ */ import_react2.default.createElement("div", null, filterConditions.map((cond, i) => /* @__PURE__ */ import_react2.default.createElement(import_antd2.Space, { key: i, style: { marginBottom: 8 } }, /* @__PURE__ */ import_react2.default.createElement(
    import_antd2.Select,
    {
      style: { width: 150 },
      placeholder: "\u5B57\u6BB5",
      value: cond.field,
      onChange: (val) => setFilterConditions((prev) => prev.map((c, j) => j === i ? { ...c, field: val } : c)),
      options: exportFields.map((f) => ({ value: f.name, label: f.displayName }))
    }
  ), /* @__PURE__ */ import_react2.default.createElement(
    import_antd2.Select,
    {
      style: { width: 100 },
      value: cond.op,
      onChange: (val) => setFilterConditions((prev) => prev.map((c, j) => j === i ? { ...c, op: val } : c)),
      options: [{ value: "eq", label: "\u7B49\u4E8E" }, { value: "contains", label: "\u5305\u542B" }, { value: "gt", label: "\u5927\u4E8E" }, { value: "lt", label: "\u5C0F\u4E8E" }]
    }
  ), /* @__PURE__ */ import_react2.default.createElement(import_antd2.Input, { style: { width: 160 }, placeholder: "\u503C", value: cond.value, onChange: (e) => setFilterConditions((prev) => prev.map((c, j) => j === i ? { ...c, value: e.target.value } : c)) }), /* @__PURE__ */ import_react2.default.createElement(import_antd2.Button, { size: "small", danger: true, onClick: () => setFilterConditions((prev) => prev.filter((_, j) => j !== i)) }, "\u5220\u9664"))), /* @__PURE__ */ import_react2.default.createElement(import_antd2.Button, { size: "small", type: "dashed", onClick: () => setFilterConditions((prev) => [...prev, { field: "", op: "eq", value: "" }]) }, "+ \u6DFB\u52A0\u6761\u4EF6"))), /* @__PURE__ */ import_react2.default.createElement(import_antd2.Card, { title: "\u2699\uFE0F \u9AD8\u7EA7\u9009\u9879", size: "small" }, /* @__PURE__ */ import_react2.default.createElement(import_antd2.Space, null, /* @__PURE__ */ import_react2.default.createElement("span", { style: { color: "#999" } }, "\u6587\u4EF6\u547D\u540D\uFF1A"), /* @__PURE__ */ import_react2.default.createElement(import_antd2.Input, { style: { width: 280 }, value: fileNameTemplate, onChange: (e) => setFileNameTemplate(e.target.value) })), /* @__PURE__ */ import_react2.default.createElement("div", { style: { fontSize: 11, color: "#999", marginTop: 8 } }, "\u652F\u6301 ", /* @__PURE__ */ import_react2.default.createElement("code", null, "{\u8868\u540D}"), " ", /* @__PURE__ */ import_react2.default.createElement("code", null, "{\u65E5\u671F}")), /* @__PURE__ */ import_react2.default.createElement(import_antd2.Space, { style: { marginTop: 12 } }, /* @__PURE__ */ import_react2.default.createElement(import_antd2.Switch, { checked: includeAttachments, onChange: setIncludeAttachments }), /* @__PURE__ */ import_react2.default.createElement("span", null, t("Include attachments"))))), /* @__PURE__ */ import_react2.default.createElement("div", { style: { textAlign: "right", marginTop: 12 } }, /* @__PURE__ */ import_react2.default.createElement(import_antd2.Button, { onClick: () => setCurrentStep(0), style: { marginRight: 8 } }, "\u2190 \u4E0A\u4E00\u6B65"), /* @__PURE__ */ import_react2.default.createElement(import_antd2.Button, { type: "primary", onClick: () => setCurrentStep(2), disabled: !selectedTable || !isAllTables && selectedFields.length === 0 }, "\u4E0B\u4E00\u6B65 \u2192"))), currentStep === 2 && /* @__PURE__ */ import_react2.default.createElement("div", null, /* @__PURE__ */ import_react2.default.createElement("div", { style: { fontWeight: 600, fontSize: 14, marginBottom: 16 } }, "\u6267\u884C\u5BFC\u51FA \u2014 ", selectedTable?.title), /* @__PURE__ */ import_react2.default.createElement(import_antd2.Row, { gutter: 16, style: { marginBottom: 16 } }, !isAllTables ? /* @__PURE__ */ import_react2.default.createElement(import_react2.default.Fragment, null, /* @__PURE__ */ import_react2.default.createElement(import_antd2.Col, { span: 6 }, /* @__PURE__ */ import_react2.default.createElement(import_antd2.Card, { size: "small" }, /* @__PURE__ */ import_react2.default.createElement(import_antd2.Statistic, { title: "\u9009\u62E9\u5B57\u6BB5", value: selectedFields.length, suffix: "\u4E2A" }))), /* @__PURE__ */ import_react2.default.createElement(import_antd2.Col, { span: 6 }, /* @__PURE__ */ import_react2.default.createElement(import_antd2.Card, { size: "small" }, /* @__PURE__ */ import_react2.default.createElement(import_antd2.Statistic, { title: "\u9884\u8BA1\u5BFC\u51FA\u884C\u6570", value: estimatedRows ?? "..." }))), /* @__PURE__ */ import_react2.default.createElement(import_antd2.Col, { span: 6 }, /* @__PURE__ */ import_react2.default.createElement(import_antd2.Card, { size: "small" }, /* @__PURE__ */ import_react2.default.createElement(import_antd2.Statistic, { title: "\u6587\u4EF6\u547D\u540D", value: fileNameTemplate }))), /* @__PURE__ */ import_react2.default.createElement(import_antd2.Col, { span: 6 }, /* @__PURE__ */ import_react2.default.createElement(import_antd2.Card, { size: "small" }, /* @__PURE__ */ import_react2.default.createElement(import_antd2.Statistic, { title: "\u751F\u6210\u683C\u5F0F", value: includeAttachments || attachmentFields.some((f) => isFieldSelected(f.displayName)) ? ".zip" : ".xlsx" })))) : /* @__PURE__ */ import_react2.default.createElement(import_react2.default.Fragment, null, /* @__PURE__ */ import_react2.default.createElement(import_antd2.Col, { span: 6 }, /* @__PURE__ */ import_react2.default.createElement(import_antd2.Card, { size: "small" }, /* @__PURE__ */ import_react2.default.createElement(import_antd2.Statistic, { title: "\u5BFC\u51FA\u8868\u6570\u91CF", value: tables.length, suffix: "\u5F20" }))), /* @__PURE__ */ import_react2.default.createElement(import_antd2.Col, { span: 6 }, /* @__PURE__ */ import_react2.default.createElement(import_antd2.Card, { size: "small" }, /* @__PURE__ */ import_react2.default.createElement(import_antd2.Statistic, { title: "\u9884\u8BA1\u603B\u884C\u6570", value: estimatedRows ?? "..." }))), /* @__PURE__ */ import_react2.default.createElement(import_antd2.Col, { span: 6 }, /* @__PURE__ */ import_react2.default.createElement(import_antd2.Card, { size: "small" }, /* @__PURE__ */ import_react2.default.createElement(import_antd2.Statistic, { title: "\u6587\u4EF6\u547D\u540D", value: allFileNameTemplate }))), /* @__PURE__ */ import_react2.default.createElement(import_antd2.Col, { span: 6 }, /* @__PURE__ */ import_react2.default.createElement(import_antd2.Card, { size: "small" }, /* @__PURE__ */ import_react2.default.createElement(import_antd2.Statistic, { title: "\u751F\u6210\u6587\u4EF6", value: ".zip" }))))), exporting && /* @__PURE__ */ import_react2.default.createElement(import_antd2.Card, { size: "small", style: { marginBottom: 16, textAlign: "center", padding: 20 } }, /* @__PURE__ */ import_react2.default.createElement(import_antd2.Progress, { type: "circle", percent: exportProgress }), /* @__PURE__ */ import_react2.default.createElement("div", { style: { marginTop: 8, color: "#999" } }, "\u6B63\u5728\u5BFC\u51FA...")), exportDone && /* @__PURE__ */ import_react2.default.createElement(import_antd2.Alert, { type: "success", showIcon: true, message: /* @__PURE__ */ import_react2.default.createElement(import_antd2.Space, null, /* @__PURE__ */ import_react2.default.createElement("span", null, t("File ready for download")), /* @__PURE__ */ import_react2.default.createElement(import_antd2.Button, { type: "primary", size: "small", onClick: handleDownload }, "\u2B07 ", t("Download"))), style: { marginBottom: 16 } }), /* @__PURE__ */ import_react2.default.createElement("div", { style: { textAlign: "right", marginTop: 16 } }, /* @__PURE__ */ import_react2.default.createElement(import_antd2.Button, { onClick: () => setCurrentStep(1), style: { marginRight: 8 }, disabled: exporting }, "\u2190 \u4E0A\u4E00\u6B65"), /* @__PURE__ */ import_react2.default.createElement(import_antd2.Button, { type: "primary", onClick: handleExecuteExport, loading: exporting, disabled: exportDone }, "\u25B6 \u6267\u884C\u5BFC\u51FA"))));
}
var import_react2, import_antd2, import_ahooks2, import_react_i18next2, import_client_v22, STEP_TITLES2;
var init_ExportTab = __esm({
  "src/client-v2/pages/ExportTab.tsx"() {
    import_react2 = __toESM(require("react"));
    import_antd2 = require("antd");
    import_ahooks2 = require("ahooks");
    import_react_i18next2 = require("react-i18next");
    import_client_v22 = require("@nocobase/client-v2");
    init_locale();
    STEP_TITLES2 = ["\u9009\u62E9\u6570\u636E\u8868", "\u9009\u62E9\u5B57\u6BB5 & \u914D\u7F6E", "\u6267\u884C\u5BFC\u51FA"];
  }
});

// src/client-v2/pages/TaskTab.tsx
var TaskTab_exports = {};
__export(TaskTab_exports, {
  default: () => TaskTab
});
function TaskTab() {
  const api = (0, import_client_v23.useAPIClient)();
  const { t } = (0, import_react_i18next3.useTranslation)([NAMESPACE, "client"], { nsMode: "fallback" });
  const [taskType, setTaskType] = (0, import_react3.useState)("all");
  const [status, setStatus] = (0, import_react3.useState)("all");
  const [searchName, setSearchName] = (0, import_react3.useState)("");
  const [logDrawer, setLogDrawer] = (0, import_react3.useState)({ open: false, task: null });
  const { data, loading, refresh } = (0, import_ahooks3.useRequest)(
    () => api.request({
      url: "sjgl02Tasks:list",
      method: "get",
      params: { taskType, status, page: 1, pageSize: 50 }
    }),
    { refreshDeps: [taskType, status], pollingInterval: 1e4 }
  );
  const resp = data?.data;
  let tasks = resp?.items || [];
  if (searchName) {
    tasks = tasks.filter((t2) => String(t2.tableName || "").toLowerCase().includes(searchName.toLowerCase()));
  }
  const handleCancel = (task) => {
    import_antd3.Modal.confirm({
      title: t("Confirm operation"),
      content: t("Are you sure to cancel this task"),
      onOk: async () => {
        try {
          await api.request({ url: "sjgl02Tasks:cancel", method: "post", data: { taskId: task.id } });
          import_antd3.message.success(t("Saved successfully"));
          refresh();
        } catch {
          import_antd3.message.error(t("Save failed"));
        }
      }
    });
  };
  const handleViewLog = async (task) => {
    try {
      const res = await api.request({ url: "sjgl02Tasks:detail", method: "get", params: { taskId: task.id } });
      setLogDrawer({ open: true, task: res?.data?.data || task });
    } catch {
      setLogDrawer({ open: true, task });
    }
  };
  const handleDownloadExport = async (taskId) => {
    try {
      const res = await api.request({ url: "sjgl02Export:download", method: "get", params: { taskId }, responseType: "blob" });
      const disp = res.headers?.["content-disposition"] || "";
      const m = disp.match(/filename\*=UTF-8''(.+)|filename="?([^";]+)/);
      const name = m ? decodeURIComponent(m[1] || m[2] || "export.xlsx") : "export.xlsx";
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      import_antd3.message.error("\u4E0B\u8F7D\u5931\u8D25");
    }
  };
  const handleDownloadImport = async (fileId) => {
    try {
      window.open(`/api/attachments:download/${fileId}`);
    } catch {
      import_antd3.message.error("\u4E0B\u8F7D\u5931\u8D25");
    }
  };
  const columns = [
    { title: t("Task ID"), dataIndex: "id", key: "id", render: (id) => `#${id}` },
    { title: t("Type"), dataIndex: "taskType", key: "taskType", render: (type) => /* @__PURE__ */ import_react3.default.createElement(import_antd3.Tag, { color: type === "import" ? "blue" : "green" }, type === "import" ? t("Import task") : t("Export task")) },
    { title: t("Target table"), dataIndex: "tableName", key: "tableName" },
    { title: t("Status"), dataIndex: "status", key: "status", render: (s) => {
      const cfg = STATUS_CONFIG[s] || { color: "default", label: s };
      return /* @__PURE__ */ import_react3.default.createElement(import_antd3.Tag, { color: cfg.color }, cfg.label);
    } },
    { title: t("Progress"), dataIndex: "progress", key: "progress", render: (p, r) => /* @__PURE__ */ import_react3.default.createElement(import_antd3.Progress, { percent: p, size: "small", strokeColor: r.status === "failed" ? "#ff4d4f" : r.status === "pending" ? "#d9d9d9" : "#1677ff", style: { minWidth: 100 } }) },
    { title: t("Data count"), key: "dataCount", render: (_, r) => `${r.processedRows || 0}/${r.totalRows || 0}` },
    { title: t("Creator"), dataIndex: ["createdBy", "nickname"], key: "createdBy", render: (val) => val || "\u2014" },
    { title: t("Created at"), dataIndex: "createdAt", key: "createdAt", render: (val) => val ? new Date(val).toLocaleString() : "\u2014" },
    { title: t("Completed at"), dataIndex: "completedAt", key: "completedAt", render: (val) => val ? new Date(val).toLocaleString() : "\u2014" },
    {
      title: t("Actions"),
      key: "actions",
      render: (_, r) => /* @__PURE__ */ import_react3.default.createElement(import_antd3.Space, null, /* @__PURE__ */ import_react3.default.createElement(import_antd3.Button, { type: "link", size: "small", onClick: () => handleViewLog(r) }, "\u{1F441} ", t("View")), ["pending", "processing"].includes(r.status) && /* @__PURE__ */ import_react3.default.createElement(import_antd3.Button, { type: "link", size: "small", danger: true, onClick: () => handleCancel(r) }, "\u23F9 ", t("Cancel")))
    }
  ];
  return /* @__PURE__ */ import_react3.default.createElement("div", null, /* @__PURE__ */ import_react3.default.createElement(import_antd3.Card, { size: "small", style: { marginBottom: 16 } }, /* @__PURE__ */ import_react3.default.createElement(import_antd3.Space, { wrap: true }, /* @__PURE__ */ import_react3.default.createElement("span", { style: { color: "#666", fontSize: 13 } }, t("Type"), "\uFF1A"), TYPE_OPTIONS.map((opt) => /* @__PURE__ */ import_react3.default.createElement(
    import_antd3.Button,
    {
      key: opt.value,
      size: "small",
      type: taskType === opt.value ? "primary" : "default",
      onClick: () => setTaskType(opt.value)
    },
    opt.label
  )), /* @__PURE__ */ import_react3.default.createElement("span", { style: { color: "#666", fontSize: 13, marginLeft: 16 } }, t("Status"), "\uFF1A"), STATUS_OPTIONS.map((opt) => /* @__PURE__ */ import_react3.default.createElement(
    import_antd3.Button,
    {
      key: opt.value,
      size: "small",
      type: status === opt.value ? "primary" : "default",
      onClick: () => setStatus(opt.value)
    },
    opt.label
  )), /* @__PURE__ */ import_react3.default.createElement(
    import_antd3.Input.Search,
    {
      placeholder: "\u641C\u7D22\u8868\u540D",
      allowClear: true,
      style: { width: 180 },
      value: searchName,
      onChange: (e) => setSearchName(e.target.value),
      onSearch: setSearchName
    }
  ), /* @__PURE__ */ import_react3.default.createElement(import_antd3.Button, { onClick: refresh }, "\u{1F504} \u5237\u65B0"))), /* @__PURE__ */ import_react3.default.createElement(import_antd3.Table, { columns, dataSource: tasks, loading, rowKey: "id", pagination: { pageSize: 20 }, size: "small" }), /* @__PURE__ */ import_react3.default.createElement(import_antd3.Drawer, { title: t("Task log"), open: logDrawer.open, onClose: () => setLogDrawer({ open: false, task: null }), width: 680 }, logDrawer.task && /* @__PURE__ */ import_react3.default.createElement("div", null, /* @__PURE__ */ import_react3.default.createElement(import_antd3.Descriptions, { title: t("Task summary"), column: 2, size: "small", bordered: true }, /* @__PURE__ */ import_react3.default.createElement(import_antd3.Descriptions.Item, { label: t("Task ID") }, "#", logDrawer.task.id), /* @__PURE__ */ import_react3.default.createElement(import_antd3.Descriptions.Item, { label: t("Type") }, /* @__PURE__ */ import_react3.default.createElement(import_antd3.Tag, { color: logDrawer.task.taskType === "import" ? "blue" : "green" }, logDrawer.task.taskType === "import" ? t("Import task") : t("Export task"))), /* @__PURE__ */ import_react3.default.createElement(import_antd3.Descriptions.Item, { label: t("Target table") }, logDrawer.task.tableName), /* @__PURE__ */ import_react3.default.createElement(import_antd3.Descriptions.Item, { label: t("Status") }, /* @__PURE__ */ import_react3.default.createElement(import_antd3.Tag, { color: STATUS_CONFIG[logDrawer.task.status]?.color }, STATUS_CONFIG[logDrawer.task.status]?.label || logDrawer.task.status)), /* @__PURE__ */ import_react3.default.createElement(import_antd3.Descriptions.Item, { label: t("Creator") }, logDrawer.task.createdBy?.nickname || "\u2014"), /* @__PURE__ */ import_react3.default.createElement(import_antd3.Descriptions.Item, { label: t("Created at") }, logDrawer.task.createdAt ? new Date(logDrawer.task.createdAt).toLocaleString() : "\u2014"), /* @__PURE__ */ import_react3.default.createElement(import_antd3.Descriptions.Item, { label: t("Completed at") }, logDrawer.task.completedAt ? new Date(logDrawer.task.completedAt).toLocaleString() : "\u2014"), /* @__PURE__ */ import_react3.default.createElement(import_antd3.Descriptions.Item, { label: t("Data count") }, logDrawer.task.processedRows || 0, "/", logDrawer.task.totalRows || 0), /* @__PURE__ */ import_react3.default.createElement(import_antd3.Descriptions.Item, { label: "Sheet\u540D\u79F0" }, logDrawer.task.sheetName || "\u2014"), /* @__PURE__ */ import_react3.default.createElement(import_antd3.Descriptions.Item, { label: "\u6587\u4EF6\u540D" }, logDrawer.task.importFileId ? `\u9644\u4EF6 #${logDrawer.task.importFileId}` : logDrawer.task.exportFileId ? `\u9644\u4EF6 #${logDrawer.task.exportFileId}` : "\u2014")), logDrawer.task.status === "completed" && /* @__PURE__ */ import_react3.default.createElement(import_antd3.Alert, { type: "success", showIcon: true, message: /* @__PURE__ */ import_react3.default.createElement(import_antd3.Space, null, /* @__PURE__ */ import_react3.default.createElement("span", null, logDrawer.task.taskType === "import" ? "\u2705 \u5BFC\u5165\u5B8C\u6210" : t("File ready for download")), logDrawer.task.taskType === "export" && /* @__PURE__ */ import_react3.default.createElement(import_antd3.Button, { type: "primary", size: "small", onClick: () => handleDownloadExport(logDrawer.task.id) }, "\u2B07 ", t("Download")), logDrawer.task.taskType === "import" && logDrawer.task.importFileId && /* @__PURE__ */ import_react3.default.createElement(import_antd3.Button, { type: "primary", size: "small", onClick: () => handleDownloadImport(logDrawer.task.importFileId) }, "\u2B07 \u4E0B\u8F7D\u5BFC\u5165\u6E90\u6587\u4EF6")), style: { margin: "16px 0" } }), /* @__PURE__ */ import_react3.default.createElement("div", { style: { fontWeight: 600, marginTop: 16, marginBottom: 8 } }, "\u{1F4CA} ", t("Field mapping details")), logDrawer.task.fieldMapping ? /* @__PURE__ */ import_react3.default.createElement(
    import_antd3.Table,
    {
      dataSource: Object.entries(logDrawer.task.fieldMapping || {}).filter(([, v]) => v && v !== "__ignore__").map(([tableField, excelCol], i) => ({ key: i, tableField, excelCol })),
      columns: [{ title: "\u5DE5\u4F5C\u8868\u5B57\u6BB5", dataIndex: "tableField" }, { title: "\u2192", width: 30 }, { title: "Excel\u5217", dataIndex: "excelCol" }],
      pagination: false,
      size: "small"
    }
  ) : logDrawer.task.selectedFields ? /* @__PURE__ */ import_react3.default.createElement(import_antd3.Space, { wrap: true }, logDrawer.task.selectedFields.map((f) => /* @__PURE__ */ import_react3.default.createElement(import_antd3.Tag, { key: f, color: "blue" }, f))) : /* @__PURE__ */ import_react3.default.createElement(import_antd3.Empty, { description: "\u6682\u65E0\u6620\u5C04\u6570\u636E" }), /* @__PURE__ */ import_react3.default.createElement("div", { style: { fontWeight: 600, marginTop: 16, marginBottom: 8 } }, "\u274C ", t("Error log")), logDrawer.task.errorLogs && logDrawer.task.errorLogs.length > 0 ? /* @__PURE__ */ import_react3.default.createElement(
    import_antd3.Table,
    {
      dataSource: logDrawer.task.errorLogs.map((log, i) => ({ key: i, ...log })),
      columns: [{ title: t("Row number"), dataIndex: "row" }, { title: t("Error reason"), dataIndex: "reason" }, { title: t("Field value snapshot"), dataIndex: "snapshot" }],
      pagination: false,
      size: "small"
    }
  ) : /* @__PURE__ */ import_react3.default.createElement(import_antd3.Empty, { description: t("No errors") }))));
}
var import_react3, import_antd3, import_ahooks3, import_react_i18next3, import_client_v23, STATUS_CONFIG, TYPE_OPTIONS, STATUS_OPTIONS;
var init_TaskTab = __esm({
  "src/client-v2/pages/TaskTab.tsx"() {
    import_react3 = __toESM(require("react"));
    import_antd3 = require("antd");
    import_ahooks3 = require("ahooks");
    import_react_i18next3 = require("react-i18next");
    import_client_v23 = require("@nocobase/client-v2");
    init_locale();
    STATUS_CONFIG = {
      pending: { color: "orange", label: "\u6392\u961F\u4E2D" },
      processing: { color: "blue", label: "\u8FDB\u884C\u4E2D" },
      completed: { color: "green", label: "\u5DF2\u5B8C\u6210" },
      failed: { color: "red", label: "\u5931\u8D25" },
      cancelled: { color: "default", label: "\u5DF2\u53D6\u6D88" }
    };
    TYPE_OPTIONS = [
      { value: "all", label: "\u5168\u90E8" },
      { value: "import", label: "\u5BFC\u5165" },
      { value: "export", label: "\u5BFC\u51FA" }
    ];
    STATUS_OPTIONS = [
      { value: "all", label: "\u5168\u90E8" },
      { value: "pending", label: "\u6392\u961F\u4E2D" },
      { value: "processing", label: "\u8FDB\u884C\u4E2D" },
      { value: "completed", label: "\u5DF2\u5B8C\u6210" },
      { value: "failed", label: "\u5931\u8D25" },
      { value: "cancelled", label: "\u5DF2\u53D6\u6D88" }
    ];
  }
});

// src/client-v2/pages/PermissionTab.tsx
var PermissionTab_exports = {};
__export(PermissionTab_exports, {
  default: () => PermissionTab
});
function PermissionTab() {
  const api = (0, import_client_v24.useAPIClient)();
  const { t } = (0, import_react_i18next4.useTranslation)([NAMESPACE, "client"], { nsMode: "fallback" });
  const [selectedTarget, setSelectedTarget] = (0, import_react4.useState)(null);
  const [viewScope, setViewScope] = (0, import_react4.useState)("own");
  (0, import_react4.useEffect)(() => {
    api.request({ url: "sjgl02Permissions:settings", method: "get" }).then((res) => {
      const s = res?.data?.data;
      if (s?.taskViewScope) setViewScope(s.taskViewScope);
    }).catch(() => {
    });
  }, [api]);
  const handleViewScopeChange = (val) => {
    setViewScope(val);
    api.request({ url: "sjgl02Permissions:saveSettings", method: "post", data: { taskViewScope: val } }).catch(() => {
    });
  };
  const [perms, setPerms] = (0, import_react4.useState)([]);
  const [editModal, setEditModal] = (0, import_react4.useState)({ open: false });
  const [form] = import_antd4.Form.useForm();
  const [tableList, setTableList] = (0, import_react4.useState)([]);
  const [searchText, setSearchText] = (0, import_react4.useState)("");
  const [modalTableFields, setModalTableFields] = (0, import_react4.useState)([]);
  const [modalLoadingFields, setModalLoadingFields] = (0, import_react4.useState)(false);
  (0, import_react4.useEffect)(() => {
    api.request({ url: "sjgl02Permissions:tables", method: "get" }).then((res) => {
      const tables = res?.data?.data;
      if (Array.isArray(tables)) {
        setTableList(tables.map((item) => ({ name: item.name, title: item.title || item.name })));
      }
    }).catch(() => {
    });
  }, [api]);
  const { data: userRoleData, loading: loadingTargets } = (0, import_ahooks4.useRequest)(
    () => api.request({ url: "sjgl02Permissions:userRoleList", method: "get" }),
    { onError: () => {
    } }
  );
  const { loading: loadingPerms } = (0, import_ahooks4.useRequest)(
    () => api.request({
      url: "sjgl02Permissions:get",
      method: "get",
      params: { targetType: selectedTarget?.type, targetId: selectedTarget?.id }
    }),
    {
      refreshDeps: [selectedTarget],
      onSuccess: (res) => {
        const items = res?.data?.data;
        setPerms(Array.isArray(items) ? items : []);
      }
    }
  );
  const handleTogglePermission = async (tableName, field) => {
    const updated = perms.map(
      (p) => p.tableName === tableName ? { ...p, [field]: !p[field] } : p
    );
    setPerms(updated);
    try {
      await api.request({ url: "sjgl02Permissions:save", method: "post", data: { permissions: updated } });
    } catch {
      import_antd4.message.error(t("Save failed"));
    }
  };
  const handleDeletePermission = async (tableName) => {
    const updated = perms.filter((p) => p.tableName !== tableName);
    setPerms(updated);
    try {
      await api.request({ url: "sjgl02Permissions:save", method: "post", data: { permissions: updated } });
      import_antd4.message.success(t("Saved successfully"));
    } catch {
      import_antd4.message.error(t("Save failed"));
    }
  };
  const handleLoadTableFields = (tableName) => {
    if (!tableName) {
      setModalTableFields([]);
      return;
    }
    setModalLoadingFields(true);
    api.request({ url: "sjgl02Import:tableFields", method: "get", params: { tableName } }).then((res) => {
      const fields = res?.data?.data || [];
      setModalTableFields((Array.isArray(fields) ? fields : []).map((f) => f.name));
    }).catch(() => setModalTableFields([])).finally(() => setModalLoadingFields(false));
  };
  const handleSavePermission = async () => {
    try {
      const values = await form.validateFields();
      let updatedPerms = [...perms];
      if (editModal.perm) {
        updatedPerms = updatedPerms.map(
          (p) => p.tableName === editModal.perm.tableName ? { ...p, ...values } : p
        );
      } else {
        updatedPerms.push({
          targetType: selectedTarget.type,
          targetId: selectedTarget.id,
          targetName: selectedTarget.nickname || selectedTarget.name || "",
          ...values,
          uniqueFields: values.uniqueFields || [],
          requiredFields: values.requiredFields || [],
          importFields: values.importFields || [],
          exportFields: values.exportFields || [],
          exportFilter: null
        });
      }
      setPerms(updatedPerms);
      await api.request({ url: "sjgl02Permissions:save", method: "post", data: { permissions: updatedPerms } });
      import_antd4.message.success(t("Saved successfully"));
      setEditModal({ open: false });
    } catch {
      import_antd4.message.error(t("Save failed"));
    }
  };
  const targetList = [
    ...(userRoleData?.data?.data?.users || []).map((u) => ({ ...u, type: "user" })),
    ...(userRoleData?.data?.data?.roles || []).map((r) => ({
      id: r.id,
      nickname: r.title || r.name,
      type: "role"
    }))
  ];
  const filteredTargets = targetList.filter(
    (t2) => !searchText || (t2.nickname || t2.name || "").toLowerCase().includes(searchText.toLowerCase())
  );
  const userTargets = filteredTargets.filter((t2) => t2.type === "user");
  const roleTargets = filteredTargets.filter((t2) => t2.type === "role");
  const groupConfig = [
    { label: `\u{1F464} ${t("User")}`, items: userTargets, color: "#1677ff" },
    { label: `\u{1F465} ${t("Role")}`, items: roleTargets, color: "#52c41a" }
  ];
  return /* @__PURE__ */ import_react4.default.createElement(import_antd4.Row, { gutter: 20 }, /* @__PURE__ */ import_react4.default.createElement(import_antd4.Col, { span: 6 }, /* @__PURE__ */ import_react4.default.createElement(import_antd4.Card, { title: `${t("User")} / ${t("Role")}`, size: "small", style: { maxHeight: 500, overflow: "auto" } }, /* @__PURE__ */ import_react4.default.createElement(
    import_antd4.Input.Search,
    {
      placeholder: "\u641C\u7D22\u7528\u6237/\u89D2\u8272",
      allowClear: true,
      value: searchText,
      onChange: (e) => setSearchText(e.target.value),
      style: { marginBottom: 8 }
    }
  ), loadingTargets ? /* @__PURE__ */ import_react4.default.createElement("div", { style: { textAlign: "center", padding: 20 } }, /* @__PURE__ */ import_react4.default.createElement(import_antd4.Spin, null)) : filteredTargets.length === 0 ? /* @__PURE__ */ import_react4.default.createElement(import_antd4.Empty, { description: "\u65E0\u5339\u914D\u7ED3\u679C" }) : groupConfig.filter((g) => g.items.length > 0).map((group) => /* @__PURE__ */ import_react4.default.createElement("div", { key: group.label }, /* @__PURE__ */ import_react4.default.createElement("div", { style: { fontSize: 11, color: "#999", padding: "8px 8px 4px", fontWeight: 600 } }, group.label, " (", group.items.length, ")"), group.items.map((item) => /* @__PURE__ */ import_react4.default.createElement(
    "div",
    {
      key: `${item.type}-${item.id}`,
      onClick: () => setSelectedTarget(item),
      style: {
        padding: "8px 10px",
        borderRadius: 6,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 13,
        marginBottom: 2,
        background: selectedTarget?.id === item.id && selectedTarget?.type === item.type ? "#e6f4ff" : void 0,
        color: selectedTarget?.id === item.id && selectedTarget?.type === item.type ? "#1677ff" : void 0
      }
    },
    /* @__PURE__ */ import_react4.default.createElement("div", { style: { width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff", fontWeight: 600, background: item.type === "user" ? "#1677ff" : "#52c41a" } }, item.type === "user" ? "U" : "R"),
    /* @__PURE__ */ import_react4.default.createElement("span", null, item.nickname || item.name || item.title)
  )))))), /* @__PURE__ */ import_react4.default.createElement(import_antd4.Col, { span: 18 }, !selectedTarget ? /* @__PURE__ */ import_react4.default.createElement(import_antd4.Card, null, /* @__PURE__ */ import_react4.default.createElement(import_antd4.Empty, { description: "\u8BF7\u9009\u62E9\u5DE6\u4FA7\u7528\u6237\u6216\u89D2\u8272" })) : /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement(import_antd4.Card, { size: "small", style: { marginBottom: 12 } }, /* @__PURE__ */ import_react4.default.createElement(import_antd4.Space, { style: { width: "100%", justifyContent: "space-between" } }, /* @__PURE__ */ import_react4.default.createElement(import_antd4.Space, null, /* @__PURE__ */ import_react4.default.createElement("div", { style: { width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff", fontWeight: 600, background: selectedTarget.type === "user" ? "#1677ff" : "#52c41a" } }, selectedTarget.type === "user" ? "U" : "R"), /* @__PURE__ */ import_react4.default.createElement("strong", null, selectedTarget.nickname || selectedTarget.name || selectedTarget.title), /* @__PURE__ */ import_react4.default.createElement(import_antd4.Tag, { color: selectedTarget.type === "user" ? "blue" : "green" }, selectedTarget.type === "user" ? t("User") : t("Role"))), /* @__PURE__ */ import_react4.default.createElement(import_antd4.Space, null, /* @__PURE__ */ import_react4.default.createElement("span", { style: { fontSize: 12, color: "#666" } }, t("Task view scope"), "\uFF1A"), /* @__PURE__ */ import_react4.default.createElement(import_antd4.Radio.Group, { value: viewScope, onChange: (e) => handleViewScopeChange(e.target.value), size: "small" }, /* @__PURE__ */ import_react4.default.createElement(import_antd4.Radio.Button, { value: "own" }, t("View own only")), /* @__PURE__ */ import_react4.default.createElement(import_antd4.Radio.Button, { value: "all" }, t("View all"))), /* @__PURE__ */ import_react4.default.createElement(import_antd4.Button, { type: "primary", size: "small", onClick: () => {
    form.resetFields();
    setEditModal({ open: true });
  } }, "+ ", t("Add permission"))))), loadingPerms ? /* @__PURE__ */ import_react4.default.createElement("div", { style: { textAlign: "center", padding: 40 } }, /* @__PURE__ */ import_react4.default.createElement(import_antd4.Spin, null)) : perms.length === 0 ? /* @__PURE__ */ import_react4.default.createElement(import_antd4.Card, null, /* @__PURE__ */ import_react4.default.createElement(import_antd4.Empty, { description: t("No permission configured") })) : perms.map((perm) => /* @__PURE__ */ import_react4.default.createElement(import_antd4.Card, { key: perm.tableName, size: "small", style: { marginBottom: 10 } }, /* @__PURE__ */ import_react4.default.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 } }, /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement("strong", null, perm.tableName), /* @__PURE__ */ import_react4.default.createElement(import_antd4.Space, { style: { marginLeft: 12 } }, /* @__PURE__ */ import_react4.default.createElement(import_antd4.Switch, { checkedChildren: "\u5BFC\u5165", unCheckedChildren: "\u5173", checked: perm.canImport, onChange: () => handleTogglePermission(perm.tableName, "canImport") }), /* @__PURE__ */ import_react4.default.createElement(import_antd4.Switch, { checkedChildren: "\u5BFC\u51FA", unCheckedChildren: "\u5173", checked: perm.canExport, onChange: () => handleTogglePermission(perm.tableName, "canExport") }))), /* @__PURE__ */ import_react4.default.createElement(import_antd4.Space, null, /* @__PURE__ */ import_react4.default.createElement(import_antd4.Button, { size: "small", type: "link", onClick: () => {
    form.setFieldsValue(perm);
    handleLoadTableFields(perm.tableName);
    setEditModal({ open: true, perm });
  } }, "\u7F16\u8F91"), /* @__PURE__ */ import_react4.default.createElement(import_antd4.Button, { size: "small", type: "link", danger: true, onClick: () => handleDeletePermission(perm.tableName) }, "\u5220\u9664"))), /* @__PURE__ */ import_react4.default.createElement(import_antd4.Space, { wrap: true }, /* @__PURE__ */ import_react4.default.createElement(import_antd4.Tag, { color: perm.canImport ? "blue" : "default" }, "\u5BFC\u5165: ", perm.canImport ? "\u662F" : "\u5426"), /* @__PURE__ */ import_react4.default.createElement(import_antd4.Tag, { color: perm.canExport ? "green" : "default" }, "\u5BFC\u51FA: ", perm.canExport ? "\u662F" : "\u5426"), /* @__PURE__ */ import_react4.default.createElement(import_antd4.Tag, { color: "orange" }, "\u5BFC\u5165\u6A21\u5F0F: ", perm.importMode), perm.uniqueFields?.length > 0 && /* @__PURE__ */ import_react4.default.createElement(import_antd4.Tag, { color: "orange" }, "\u552F\u4E00\u503C: ", perm.uniqueFields.join(",")), perm.requiredFields?.length > 0 && /* @__PURE__ */ import_react4.default.createElement(import_antd4.Tag, { color: "red" }, "\u5FC5\u586B: ", perm.requiredFields.join(",")), /* @__PURE__ */ import_react4.default.createElement(import_antd4.Tag, { color: "cyan" }, "\u53EF\u5BFC\u5165: ", perm.importFields?.length === 0 ? "\u5168\u90E8" : perm.importFields?.join(",")), /* @__PURE__ */ import_react4.default.createElement(import_antd4.Tag, { color: "purple" }, "\u53EF\u5BFC\u51FA: ", perm.exportFields?.length === 0 ? "\u5168\u90E8" : perm.exportFields?.join(","))))))), /* @__PURE__ */ import_react4.default.createElement(
    import_antd4.Modal,
    {
      title: editModal.perm ? "\u7F16\u8F91\u6743\u9650" : t("Add permission"),
      open: editModal.open,
      onCancel: () => setEditModal({ open: false }),
      onOk: handleSavePermission,
      width: 720
    },
    /* @__PURE__ */ import_react4.default.createElement(import_antd4.Form, { form, layout: "vertical" }, /* @__PURE__ */ import_react4.default.createElement(import_antd4.Form.Item, { label: t("Select table"), name: "tableName", rules: [{ required: true }] }, /* @__PURE__ */ import_react4.default.createElement(
      import_antd4.Select,
      {
        showSearch: true,
        placeholder: "\u9009\u62E9\u6570\u636E\u8868",
        onChange: (val) => handleLoadTableFields(val),
        options: tableList.map((item) => ({ value: item.name, label: `${item.title} (${item.name})` }))
      }
    )), /* @__PURE__ */ import_react4.default.createElement(import_antd4.Space, { style: { marginBottom: 12 } }, /* @__PURE__ */ import_react4.default.createElement(import_antd4.Form.Item, { label: t("Allow import"), name: "canImport", valuePropName: "checked", noStyle: true }, /* @__PURE__ */ import_react4.default.createElement(import_antd4.Switch, null)), /* @__PURE__ */ import_react4.default.createElement(import_antd4.Form.Item, { label: t("Allow export"), name: "canExport", valuePropName: "checked", noStyle: true }, /* @__PURE__ */ import_react4.default.createElement(import_antd4.Switch, null))), /* @__PURE__ */ import_react4.default.createElement(import_antd4.Form.Item, { label: t("Import mode"), name: "importMode" }, /* @__PURE__ */ import_react4.default.createElement(import_antd4.Select, { options: [{ value: "insert", label: "\u65B0\u589E (insert)" }, { value: "update", label: "\u66F4\u65B0 (update)" }, { value: "upsert", label: "\u65B0\u589E+\u66F4\u65B0 (upsert)" }] })), /* @__PURE__ */ import_react4.default.createElement(import_antd4.Form.Item, { label: "\u552F\u4E00\u503C\u5B57\u6BB5", name: "uniqueFields" }, /* @__PURE__ */ import_react4.default.createElement(
      import_antd4.Select,
      {
        mode: "multiple",
        placeholder: "\u9009\u62E9\u552F\u4E00\u503C\u5B57\u6BB5",
        loading: modalLoadingFields,
        options: modalTableFields.map((v) => ({ value: v, label: v }))
      }
    )), /* @__PURE__ */ import_react4.default.createElement(import_antd4.Form.Item, { label: "\u5FC5\u586B\u5B57\u6BB5", name: "requiredFields" }, /* @__PURE__ */ import_react4.default.createElement(
      import_antd4.Select,
      {
        mode: "multiple",
        placeholder: "\u9009\u62E9\u5FC5\u586B\u5B57\u6BB5",
        loading: modalLoadingFields,
        options: modalTableFields.map((v) => ({ value: v, label: v }))
      }
    )), /* @__PURE__ */ import_react4.default.createElement(import_antd4.Form.Item, { label: t("Importable fields"), name: "importFields" }, /* @__PURE__ */ import_react4.default.createElement(
      import_antd4.Select,
      {
        mode: "multiple",
        placeholder: "\u7A7A=\u5168\u90E8\u5141\u8BB8",
        loading: modalLoadingFields,
        options: modalTableFields.map((v) => ({ value: v, label: v }))
      }
    )), /* @__PURE__ */ import_react4.default.createElement(import_antd4.Form.Item, { label: t("Exportable fields"), name: "exportFields" }, /* @__PURE__ */ import_react4.default.createElement(
      import_antd4.Select,
      {
        mode: "multiple",
        placeholder: "\u7A7A=\u5168\u90E8\u5141\u8BB8",
        loading: modalLoadingFields,
        options: modalTableFields.map((v) => ({ value: v, label: v }))
      }
    )))
  ));
}
var import_react4, import_antd4, import_ahooks4, import_react_i18next4, import_client_v24;
var init_PermissionTab = __esm({
  "src/client-v2/pages/PermissionTab.tsx"() {
    import_react4 = __toESM(require("react"));
    import_antd4 = require("antd");
    import_ahooks4 = require("ahooks");
    import_react_i18next4 = require("react-i18next");
    import_client_v24 = require("@nocobase/client-v2");
    init_locale();
  }
});

// src/client-v2/pages/Sjgl02SettingsPage.tsx
var Sjgl02SettingsPage_exports = {};
__export(Sjgl02SettingsPage_exports, {
  default: () => Sjgl02SettingsPage
});
function Sjgl02SettingsPage() {
  const { t } = (0, import_react_i18next5.useTranslation)([NAMESPACE, "client"], { nsMode: "fallback" });
  const [activeKey, setActiveKey] = (0, import_react5.useState)("import");
  const tabItems = Object.values(TABS).map((tab) => ({
    key: tab.key,
    label: /* @__PURE__ */ import_react5.default.createElement("span", null, tab.label),
    children: tab.key === activeKey ? /* @__PURE__ */ import_react5.default.createElement(TabRenderer, { key: tab.key, loader: tab.loader }) : /* @__PURE__ */ import_react5.default.createElement("div", { style: { minHeight: 400 } })
  }));
  return /* @__PURE__ */ import_react5.default.createElement("div", { style: { maxWidth: 1280, margin: "0 auto" } }, /* @__PURE__ */ import_react5.default.createElement("div", { style: {
    background: "linear-gradient(135deg,#1677ff,#0958d9)",
    borderRadius: 12,
    padding: "14px 24px",
    color: "#fff",
    marginBottom: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between"
  } }, /* @__PURE__ */ import_react5.default.createElement("div", null, /* @__PURE__ */ import_react5.default.createElement("div", { style: { fontSize: 18, fontWeight: 600 } }, "\u{1F4CA} ", t("Data Management")), /* @__PURE__ */ import_react5.default.createElement("div", { style: { opacity: 0.8, fontSize: 12, marginTop: 2 } }, t("Import"), " \xB7 ", t("Export"), " \xB7 ", t("Task Management"), " \xB7 ", t("Permission Management"))), /* @__PURE__ */ import_react5.default.createElement("div", { style: {
    background: "rgba(255,255,255,0.2)",
    borderRadius: 20,
    padding: "4px 14px",
    fontSize: 11
  } }, "@my-project/plugin-sjgl02 v1.0.24")), /* @__PURE__ */ import_react5.default.createElement(import_antd5.Card, { style: { borderRadius: 10, minHeight: 600 } }, /* @__PURE__ */ import_react5.default.createElement(
    import_antd5.Tabs,
    {
      activeKey,
      onChange: setActiveKey,
      items: tabItems,
      size: "large"
    }
  )));
}
function TabRenderer({ loader }) {
  const [Comp, setComp] = (0, import_react5.useState)(null);
  (0, import_react5.useEffect)(() => {
    let cancelled = false;
    loader().then((mod) => {
      if (!cancelled) setComp(() => mod.default);
    });
    return () => {
      cancelled = true;
    };
  }, [loader]);
  if (!Comp) return /* @__PURE__ */ import_react5.default.createElement("div", { style: { padding: 40, textAlign: "center", color: "#999" } }, "\u52A0\u8F7D\u4E2D...");
  return /* @__PURE__ */ import_react5.default.createElement(Comp, null);
}
var import_react5, import_antd5, import_react_i18next5, TABS;
var init_Sjgl02SettingsPage = __esm({
  "src/client-v2/pages/Sjgl02SettingsPage.tsx"() {
    import_react5 = __toESM(require("react"));
    import_antd5 = require("antd");
    import_react_i18next5 = require("react-i18next");
    init_locale();
    TABS = {
      import: { key: "import", label: "\u2B07 \u5BFC\u5165", loader: () => Promise.resolve().then(() => (init_ImportTab(), ImportTab_exports)) },
      export: { key: "export", label: "\u2B06 \u5BFC\u51FA", loader: () => Promise.resolve().then(() => (init_ExportTab(), ExportTab_exports)) },
      tasks: { key: "tasks", label: "\u2630 \u4EFB\u52A1\u7BA1\u7406", loader: () => Promise.resolve().then(() => (init_TaskTab(), TaskTab_exports)) },
      permissions: { key: "permissions", label: "\u2713 \u6743\u9650\u7BA1\u7406", loader: () => Promise.resolve().then(() => (init_PermissionTab(), PermissionTab_exports)) }
    };
  }
});

// src/client-v2/index.tsx
var index_exports = {};
__export(index_exports, {
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);

// src/client-v2/plugin.tsx
var import_client_v25 = require("@nocobase/client-v2");
var PluginSjgl02Client = class extends import_client_v25.Plugin {
  async load() {
    this.pluginSettingsManager.addMenuItem({
      key: "sjgl02",
      title: this.t("Data Management"),
      icon: "DatabaseOutlined"
    });
    this.pluginSettingsManager.addPageTabItem({
      menuKey: "sjgl02",
      key: "index",
      title: this.t("Data Management"),
      componentLoader: () => Promise.resolve().then(() => (init_Sjgl02SettingsPage(), Sjgl02SettingsPage_exports))
    });
  }
};

// src/client-v2/index.tsx
var index_default = PluginSjgl02Client;
